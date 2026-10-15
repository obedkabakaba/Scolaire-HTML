/* ==========================================================================
   Ardoise — Super Admin : programme des apporteurs d'affaires
   --------------------------------------------------------------------------
   Profils et badges cumulables, candidatures, déclarations, attributions
   (conflits, validation, prolongation, révocation), partenariats,
   commissions, prestations, règlements, barèmes et journal.

   Tous les montants affichés viennent de l'API, qui les tire des
   encaissements réels. Aucune vue ne calcule ni n'estime un montant dû :
   elle montre ce que le serveur a enregistré, devise par devise.

   Dépend de super-admin-vues-offres.js (SA.finance.formulaire, envoyer),
   chargé avant ce fichier.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui } = SA;
  const BASE = '/super-admin/apporteurs';

  const BADGES = {
    apporteur_affaires: { libelle: "Apporteur d'affaires", court: 'Apporteur', icone: '🤝' },
    configurateur: { libelle: 'Configurateur', court: 'Configurateur', icone: '🛠' },
    formateur: { libelle: 'Formateur', court: 'Formateur', icone: '🎓' },
    partenaire_strategique: { libelle: 'Partenaire stratégique / institutionnel', court: 'Partenaire', icone: '🏛' }
  };
  const CODES_BADGES = Object.keys(BADGES);

  const LIBELLES = {
    nouvelle: 'Nouvelle', en_examen: 'En examen', retenue: 'Retenue', refusee: 'Refusée',
    en_attente: 'En attente', rattachee: 'Rattachée', rejetee: 'Rejetée',
    proposee: 'Proposée', validee: 'Validée', revoquee: 'Révoquée',
    gagnee: 'Gagnée', due: 'Due', reglee: 'Réglée', annulee: 'Annulée',
    a_valider: 'À valider', en_qualification: 'En qualification', actif: 'Actif',
    suspendu: 'Suspendu', retire: 'Retiré', clos: 'Clos',
    declaration_apporteur: 'Déclaration', code_inscription: 'Code à l’inscription', saisie_admin: 'Justificatif'
  };
  const TONS = {
    nouvelle: 'attention', en_examen: 'info', retenue: 'succes', refusee: 'neutre',
    en_attente: 'attention', rattachee: 'succes', rejetee: 'neutre',
    proposee: 'attention', validee: 'succes', revoquee: 'danger',
    gagnee: 'info', due: 'attention', reglee: 'succes', annulee: 'neutre', a_valider: 'attention',
    en_qualification: 'attention', actif: 'succes', suspendu: 'danger', retire: 'neutre', clos: 'neutre'
  };
  const statut = (s) => ui.badge(LIBELLES[s] || String(s || '—').replace(/_/g, ' '), TONS[s] || 'neutre');
  const nomComplet = (p, n) => [p, n].filter(Boolean).join(' ');
  const F = () => SA.finance;

  /** Montant dans SA devise — jamais converti, jamais additionné à une autre. */
  function argent(v, devise) {
    if (v === null || v === undefined || v === '') return '<span class="sa-muet">—</span>';
    const n = Number(v);
    const texte = n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `<span class="${n < 0 ? 'sa-negatif' : ''}">${esc(texte)} <span class="sa-devise">${esc(devise || '')}</span></span>`;
  }

  /** { USD: { gagnee: 12, due: 3 } } → lignes lisibles. */
  function totauxHtml(totaux, ordre = ['gagnee', 'due', 'a_valider', 'reglee']) {
    const devises = Object.keys(totaux || {});
    if (!devises.length) return '<span class="sa-muet ap-vide">Aucun montant enregistré</span>';
    return devises.map((d) => ordre.filter((s) => totaux[d][s] !== undefined)
      .map((s) => `<div>${statut(s)} ${argent(totaux[d][s], d)}</div>`).join('')).join('');
  }

  function objetDevises(obj) {
    const cles = Object.keys(obj || {});
    if (!cles.length) return '<span class="sa-muet">—</span>';
    return cles.map((d) => argent(obj[d], d)).join('<br />');
  }

  function badgesHtml(liste) {
    const actifs = (liste || []);
    if (!actifs.length) return '<span class="sa-muet">Aucun badge</span>';
    return actifs.map((b) => {
      const def = BADGES[b.badge] || { court: b.badge, icone: '' };
      const ton = b.statut === 'actif' ? 'succes' : b.statut === 'en_qualification' ? 'attention' : 'neutre';
      return `<span class="sa-badge ton-${ton}" title="${esc(def.libelle || '')} — ${esc(LIBELLES[b.statut] || b.statut)}">${def.icone} ${esc(def.court)}</span>`;
    }).join(' ');
  }

  function lectureSeule(d) {
    return d && d.peut_ecrire === false
      ? '<div class="sa-encart">Accès financier en <strong>lecture seule</strong> : les décisions sont réservées au Super Administrateur à accès complet.</div>'
      : '';
  }

  /** Demande un motif (et confirme) avant une décision. Résout null si annulé. */
  function demanderMotif({ titre, sousTitre, libelle, libelleValider, danger, champsSup = [] }) {
    return new Promise((resoudre) => {
      let fini = false;
      const voile = F().formulaire({
        titre, sousTitre, large: false, danger,
        libelleValider: libelleValider || 'Confirmer',
        champs: [...champsSup, { cle: 'motif', libelle: libelle || 'Motif', type: 'zone', lignes: 3, requis: true }],
        soumettre: async (v) => { fini = true; resoudre(v); }
      });
      const observer = new MutationObserver(() => {
        if (!document.body.contains(voile)) { observer.disconnect(); if (!fini) resoudre(null); }
      });
      observer.observe(document.body, { childList: true });
    });
  }

  async function agir(chemin, methode, corps, message) {
    try {
      const r = await SA.api(chemin, { method: methode, body: JSON.stringify(corps || {}) });
      SA.toast(message || (r && r.message) || 'Enregistré.', 'succes');
      SA.rafraichirVue();
      return r;
    } catch (e) {
      SA.toast(e.message || 'Opération impossible.', 'danger');
      throw e;
    }
  }

  function ecolesOptions(vide) {
    const ecoles = (SA.referentiels && SA.referentiels.ecoles) || [];
    return [{ valeur: '', libelle: vide || 'Choisir une école' }]
      .concat(ecoles.map((e) => ({ valeur: e.id, libelle: e.nom })));
  }

  async function apporteursOptions(vide, filtreBadge) {
    const d = await SA.api(SA.url(BASE, { statut: 'actif', badge: filtreBadge }));
    return [{ valeur: '', libelle: vide || 'Choisir un apporteur' }]
      .concat((d.donnees || []).map((a) => ({ valeur: a.id, libelle: `${nomComplet(a.prenom, a.nom)}${a.organisation ? ` — ${a.organisation}` : ''}` })));
  }

  function brancherFiltres(conteneur) {
    conteneur.querySelectorAll('[data-filtre-statut]').forEach((b) => b.addEventListener('click', () => {
      SA.majParams({ statut: b.dataset.filtreStatut || undefined }); SA.rafraichirVue();
    }));
  }

  function pastilles(liste, courant, compteurs) {
    return `<div class="sa-filtres">${liste.map(([cle, libelle]) => {
      const n = compteurs ? (cle ? compteurs[cle] || 0 : Object.values(compteurs).reduce((s, v) => s + v, 0)) : null;
      return `<button class="sa-bouton sa-bouton-petit ${(courant || '') === cle ? 'sa-bouton-principal' : 'sa-bouton-secondaire'}" data-filtre-statut="${cle}">${esc(libelle)}${n !== null ? ` <span class="sa-mono">${n}</span>` : ''}</button>`;
    }).join('')}</div>`;
  }

  function actionsEntete(html) {
    const zone = document.getElementById('sa-entete-actions');
    if (zone) zone.innerHTML = html;
    return zone;
  }

  /* ======================================================================
     1. VUE D'ENSEMBLE
     ====================================================================== */

  SA.enregistrerVue('apporteurs', {
    titre: "Apporteurs d'affaires",
    sousTitre: 'Programme, décisions en attente et montants issus des encaissements réels.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squeletteCartes(4) + ui.squelette(4, 46);
      const d = await SA.api(`${BASE}/tableau-de-bord`);
      const somme = (o) => Object.values(o || {}).reduce((s, v) => s + v, 0);
      const actifs = (b) => ((d.badges || {})[b] || {}).actif || 0;

      const zone = actionsEntete(d.peut_ecrire === false ? '' :
        '<button class="sa-bouton sa-bouton-secondaire" data-synchroniser>Recalculer les commissions</button>');
      const btn = zone && zone.querySelector('[data-synchroniser]');
      if (btn) btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          const r = await SA.api(`${BASE}/commissions/synchroniser`, { method: 'POST', body: '{}' });
          SA.toast(`${r.creees} commission(s) créée(s), ${r.annulees} annulée(s), ${r.regularisations} régularisation(s).`, 'succes');
          SA.rafraichirVue();
        } catch (e) { SA.toast(e.message, 'danger'); btn.disabled = false; }
      });

      const aTraiter = [
        [d.messages_non_lus, 'message(s) de partenaires non lu(s)', 'apporteurs/messagerie'],
        [(d.candidatures || {}).nouvelle, 'candidature(s) à examiner (ancien formulaire)', 'apporteurs/candidatures?statut=nouvelle'],
        [(d.declarations || {}).en_attente, 'déclaration(s) de prospect en attente', 'apporteurs/declarations?statut=en_attente'],
        [(d.attributions || {}).proposee, 'attribution(s) proposée(s) à décider', 'apporteurs/attributions?statut=proposee'],
        [d.ecoles_en_conflit, 'école(s) revendiquée(s) par plusieurs apporteurs', 'apporteurs/attributions?conflit=1'],
        [d.prolongations_en_attente, 'prolongation(s) en attente de validation', 'apporteurs/attributions?onglet=prolongations']
      ].filter(([n]) => n);

      conteneur.innerHTML = `
        ${lectureSeule(d)}
        <section class="sa-section">
          <div class="sa-grille-stats">
            ${ui.carteStat({ valeur: fmt.nombre((d.apporteurs || {}).actif || 0), etiquette: 'Apporteurs actifs', icone: '👥',
              detail: `${fmt.nombre(somme(d.apporteurs))} profil(s) au total · ${fmt.nombre((d.inscriptions || {}).nouveaux_30j || 0)} inscrit(s) en 30 j${(d.inscriptions || {}).en_attente_confirmation ? ` · ${fmt.nombre(d.inscriptions.en_attente_confirmation)} adresse(s) à confirmer` : ''}` })}
            ${ui.carteStat({ valeur: fmt.nombre((d.attributions || {}).validee || 0), etiquette: 'Écoles attribuées (validées)', ton: 'succes', icone: '🏫' })}
            ${ui.carteStat({ valeur: fmt.nombre(aTraiter.reduce((s, [n]) => s + n, 0)), etiquette: 'Décisions en attente', ton: aTraiter.length ? 'attention' : null, icone: '⏳' })}
            ${ui.carteStat({ valeur: fmt.nombre(actifs('configurateur') + actifs('formateur')), etiquette: 'Configurateurs et formateurs qualifiés', icone: '🎓',
              detail: `${actifs('configurateur')} configurateur(s), ${actifs('formateur')} formateur(s)` })}
          </div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">À traiter</h2>
          ${aTraiter.length
            ? `<div class="sa-panneau">${aTraiter.map(([n, texte, lien]) =>
                `<p class="sa-texte"><strong>${fmt.nombre(n)}</strong> ${esc(texte)} — <a href="#/${lien}">ouvrir</a></p>`).join('')}</div>`
            : ui.etatVide('Rien en attente', 'Candidatures, déclarations, attributions et prolongations sont à jour.')}
        </section>

        <section class="sa-section sa-grille-2">
          <div class="sa-panneau">
            <h2 class="sa-section-titre">Commissions sur abonnements</h2>
            ${totauxHtml(d.commissions)}
            <p class="sa-note">« Gagnée » : calculée sur un paiement confirmé, à vérifier. « Due » : vérifiée, à verser. « Réglée » : versée.</p>
          </div>
          <div class="sa-panneau">
            <h2 class="sa-section-titre">Prestations rémunérées</h2>
            ${totauxHtml(d.prestations)}
            <h2 class="sa-section-titre" style="margin-top:16px">Versé aux apporteurs</h2>
            ${(d.reglements || []).length ? d.reglements.map((r) => `<div>${argent(r.montant, r.devise)} <span class="sa-muet">— ${fmt.nombre(r.n)} règlement(s)</span></div>`).join('') : '<span class="sa-muet">Aucun règlement</span>'}
          </div>
        </section>

        <p class="sa-note">
          Dernier calcul des commissions :
          ${d.derniere_synchronisation ? esc(fmt.dateHeure(d.derniere_synchronisation.created_at)) : 'aucun calcul ayant produit de ligne pour le moment'}.
          Le calcul tourne automatiquement toutes les six heures et après chaque validation.
        </p>`;
    }
  });

  /* ======================================================================
     2. PROFILS
     ====================================================================== */

  function formulaireProfil(profil) {
    const p = profil || {};
    return F().formulaire({
      titre: profil ? 'Modifier le profil' : 'Nouvel apporteur',
      sousTitre: profil ? null : 'Le profil naît sans badge actif. Les badges et leurs qualifications se décident ensuite.',
      libelleValider: profil ? 'Enregistrer' : 'Créer le profil',
      champs: [
        { cle: 'nom', libelle: 'Nom', requis: true, valeur: p.nom },
        { cle: 'prenom', libelle: 'Prénom', valeur: p.prenom },
        { cle: 'email', libelle: 'E-mail (identifiant du portail)', requis: true, valeur: p.email },
        { cle: 'telephone', libelle: 'Téléphone', valeur: p.telephone },
        { cle: 'ville', libelle: 'Ville', valeur: p.ville },
        { cle: 'province', libelle: 'Province', valeur: p.province },
        { cle: 'organisation', libelle: 'Organisation (facultatif)', valeur: p.organisation },
        { cle: 'notes_internes', libelle: 'Notes internes (jamais visibles par l’apporteur)', type: 'zone', lignes: 3, valeur: p.notes_internes }
      ],
      soumettre: async (v) => {
        const r = profil
          ? await F().envoyer(`${BASE}/${profil.id}`, 'PATCH', v, 'Profil mis à jour.')
          : await SA.api(BASE, { method: 'POST', body: JSON.stringify(v) });
        if (!profil) { SA.toast(`Profil créé — code ${r.code}.`, 'succes'); SA.naviguer(`apporteurs/profils/fiche/${r.apporteur.id}`); }
      }
    });
  }

  SA.enregistrerVue('apporteurs/profils', {
    titre: 'Profils et badges',
    sousTitre: 'Badges cumulables : un même profil peut être apporteur, configurateur, formateur et partenaire.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(8, 46);
      const d = await SA.api(SA.url(BASE, { recherche: params.recherche, statut: params.statut, badge: params.badge }));
      const zone = actionsEntete('<button class="sa-bouton sa-bouton-principal" data-nouveau>Nouvel apporteur</button>');
      zone.querySelector('[data-nouveau]').addEventListener('click', () => formulaireProfil(null));

      const colonnes = [
        { cle: 'nom', titre: 'Apporteur', rendu: (l) => `<strong>${esc(nomComplet(l.prenom, l.nom))}</strong>
            <div class="sa-muet">${esc([l.organisation, l.ville].filter(Boolean).join(' · '))}</div>` },
        { cle: 'badges', titre: 'Badges', rendu: (l) => badgesHtml(l.badges) },
        { cle: 'ecoles', titre: 'Écoles', classe: 'sa-num', rendu: (l) => `${fmt.nombre(l.ecoles_validees)}${l.ecoles_proposees ? `<div class="sa-muet">+${l.ecoles_proposees} proposée(s)</div>` : ''}` },
        { cle: 'a_verser', titre: 'Gagné / dû', classe: 'sa-num', rendu: (l) => objetDevises(l.a_verser) },
        { cle: 'acces', titre: 'Portail', rendu: (l) => (l.acces_active ? ui.badge('Activé', 'succes')
            : (l.origine === 'inscription' && !l.email_verifie_le ? ui.badge('Adresse à confirmer', 'attention') : ui.badge('Non activé', 'neutre')))
            + (l.origine === 'inscription' ? '<div class="sa-muet">Inscrit en ligne</div>' : '') },
        { cle: 'statut', titre: 'Statut', rendu: (l) => statut(l.statut) }
      ];

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-barre-filtres">
            <label class="sa-champ-bloc"><span>Recherche</span>
              <input class="sa-champ" id="f-recherche" value="${esc(params.recherche || '')}" placeholder="Nom, e-mail, ville, organisation" /></label>
            <label class="sa-champ-bloc"><span>Badge actif</span>
              <select class="sa-champ" id="f-badge"><option value="">Tous</option>
                ${CODES_BADGES.map((b) => `<option value="${b}" ${params.badge === b ? 'selected' : ''}>${esc(BADGES[b].libelle)}</option>`).join('')}
              </select></label>
            <label class="sa-champ-bloc"><span>Statut</span>
              <select class="sa-champ" id="f-statut"><option value="">Tous</option>
                ${['actif', 'suspendu', 'clos'].map((s) => `<option value="${s}" ${params.statut === s ? 'selected' : ''}>${LIBELLES[s]}</option>`).join('')}
              </select></label>
          </div>
          ${ui.tableau({ colonnes, lignes: d.donnees, cliquable: true, vide: 'Aucun apporteur pour ces critères' })}
        </section>`;

      const maj = (p) => { SA.majParams(Object.assign({}, params, p)); SA.rafraichirVue(); };
      const rech = conteneur.querySelector('#f-recherche');
      rech.addEventListener('input', SA.antiRebond(() => maj({ recherche: rech.value || undefined }), 380));
      conteneur.querySelector('#f-badge').addEventListener('change', (e) => maj({ badge: e.target.value || undefined }));
      conteneur.querySelector('#f-statut').addEventListener('change', (e) => maj({ statut: e.target.value || undefined }));
      conteneur.querySelectorAll('tr[data-id]').forEach((tr) =>
        tr.addEventListener('click', () => SA.naviguer(`apporteurs/profils/fiche/${tr.dataset.id}`)));
    }
  });

  function modaleBadge(apporteurId, badge, actuel) {
    const def = BADGES[badge];
    const qualif = badge === 'configurateur' || badge === 'formateur';
    const a = actuel || {};
    F().formulaire({
      titre: def.libelle,
      sousTitre: qualif
        ? 'Ce badge exige une qualification validée : décrivez la preuve. L’accès à la formation de qualification peut être payant ; ses frais se consignent ici.'
        : 'Ce badge ne donne aucun accès à l’administration d’Ardoise.',
      large: true,
      champs: [
        { cle: 'statut', libelle: 'Statut', type: 'liste', requis: true, valeur: a.statut || 'en_qualification',
          options: ['en_qualification', 'actif', 'suspendu', 'retire'].map((s) => ({ valeur: s, libelle: LIBELLES[s] })) },
        ...(qualif ? [
          { cle: 'qualification_preuve', libelle: 'Preuve de qualification', type: 'zone', lignes: 3, valeur: a.qualification_preuve,
            exemple: 'Évaluation pratique réussie le…, session observée par…, attestation n°…' },
          { cle: 'formation_suivie_le', libelle: 'Formation de qualification suivie le', type: 'date', valeur: (a.formation_suivie_le || '').slice(0, 10) },
          { cle: 'frais_formation_montant', libelle: 'Frais de formation (si payante)', type: 'nombre', min: 0, valeur: a.frais_formation_montant },
          { cle: 'frais_formation_devise', libelle: 'Devise des frais', type: 'liste', valeur: a.frais_formation_devise || 'USD',
            options: [{ valeur: 'USD', libelle: 'USD' }, { valeur: 'FC', libelle: 'FC' }] },
          { cle: 'frais_formation_regles', libelle: 'Frais réglés', type: 'bascule', texteBascule: 'Oui', valeur: a.frais_formation_regles }
        ] : []),
        { cle: 'motif', libelle: 'Motif (obligatoire pour suspendre ou retirer)', type: 'zone', lignes: 2, valeur: '' }
      ],
      soumettre: (v) => {
        if (!qualif) { delete v.frais_formation_devise; }
        return F().envoyer(`${BASE}/${apporteurId}/badges/${badge}`, 'PUT', v, 'Badge mis à jour.');
      }
    });
  }

  SA.enregistrerVue('apporteurs/profils/fiche', {
    titre: 'Fiche apporteur',
    sousTitre: 'Badges, codes, écoles, commissions, prestations, règlements et historique.',

    async rendu(conteneur, params, segments) {
      const id = (segments || [])[0];
      if (!id) { conteneur.innerHTML = ui.etatVide('Aucun apporteur sélectionné', 'Ouvrez une fiche depuis la liste.'); return; }
      conteneur.innerHTML = ui.squelette(8, 46);
      const d = await SA.api(`${BASE}/${id}`);
      const p = d.profil;
      const onglet = params.onglet || 'ecoles';
      document.querySelector('#sa-entete h1').textContent = nomComplet(p.prenom, p.nom);

      const zone = actionsEntete(`
        <button class="sa-bouton sa-bouton-secondaire" data-modifier>Modifier</button>
        <button class="sa-bouton sa-bouton-secondaire" data-acces>${p.acces_active ? 'Nouveau lien d’accès' : 'Envoyer l’accès au portail'}</button>
        <button class="sa-bouton sa-bouton-secondaire" data-releve>Relevé CSV</button>
        <button class="sa-bouton sa-bouton-principal" data-ecrire>Écrire</button>`);
      zone.querySelector('[data-ecrire]').addEventListener('click', async () => {
        try {
          const r = await SA.api(`${BASE}/messagerie/equipe/${id}`, { method: 'POST', body: '{}' });
          SA.naviguer('apporteurs/messagerie', { c: r.id });
        } catch (e) { SA.toast(e.message, 'danger'); }
      });
      zone.querySelector('[data-modifier]').addEventListener('click', () => formulaireProfil(p));
      zone.querySelector('[data-releve]').addEventListener('click', () =>
        SA.telecharger(`${BASE}/${id}/releve?format=csv`, `releve-${(p.nom || 'apporteur').toLowerCase()}.csv`));
      zone.querySelector('[data-acces]').addEventListener('click', async () => {
        try {
          const r = await SA.api(`${BASE}/${id}/acces`, { method: 'POST', body: '{}' });
          SA.modale({
            titre: 'Lien d’accès au portail',
            sousTitre: r.envoye ? `Envoyé par e-mail à ${p.email}.` : 'L’e-mail n’a pas pu partir.',
            contenu: `<p class="sa-texte">${esc(r.message)}</p>
              <input class="sa-champ sa-mono" readonly value="${esc(r.lien)}" onclick="this.select()" />
              <p class="sa-note">Lien personnel, à usage unique, valable 72 heures. Transmettez-le uniquement à ${esc(nomComplet(p.prenom, p.nom))}.</p>`
          });
        } catch (e) { SA.toast(e.message, 'danger'); }
      });

      const parBadge = Object.fromEntries((d.badges || []).map((b) => [b.badge, b]));
      const cartesBadges = CODES_BADGES.map((b) => {
        const x = parBadge[b];
        return `<div class="sa-panneau ap-badge">
          <div class="ap-badge-tete"><span class="ap-badge-icone">${BADGES[b].icone}</span>
            <strong>${esc(BADGES[b].libelle)}</strong></div>
          <div>${x ? statut(x.statut) : ui.badge('Non détenu', 'neutre')}</div>
          ${x && x.qualification_validee_le ? `<div class="sa-muet">Validé le ${esc(fmt.date(x.qualification_validee_le))}${x.validee_par_nom ? ` par ${esc(x.validee_par_nom)}` : ''}</div>` : ''}
          ${x && x.qualification_preuve ? `<div class="sa-muet ap-preuve">${esc(x.qualification_preuve)}</div>` : ''}
          ${x && x.frais_formation_montant !== null && x.frais_formation_montant !== undefined
            ? `<div class="sa-muet">Frais de formation : ${argent(x.frais_formation_montant, x.frais_formation_devise)} ${x.frais_formation_regles ? '(réglés)' : '(non réglés)'}</div>` : ''}
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-badge="${b}">${x ? 'Gérer' : 'Attribuer'}</button>
        </div>`;
      }).join('');

      const ONGLETS = [['ecoles', `Écoles (${d.attributions.length})`], ['commissions', `Commissions (${d.commissions.length})`],
        ['prestations', `Prestations (${d.prestations.length})`], ['reglements', `Règlements (${d.reglements.length})`],
        ['declarations', `Déclarations (${d.declarations.length})`], ['journal', 'Historique']];

      const tableaux = {
        ecoles: () => ui.tableau({
          lignes: d.attributions, vide: 'Aucune école attribuée', cliquable: true,
          colonnes: [
            { cle: 'ecole_nom', titre: 'École', rendu: (l) => `<strong>${esc(l.ecole_nom)}</strong><div class="sa-muet">${esc(l.ecole_ville || '')}</div>` },
            { cle: 'source', titre: 'Origine', rendu: (l) => `${esc(LIBELLES[l.source] || l.source)}${l.partenariat_nom ? `<div class="sa-muet">${esc(l.partenariat_nom)}</div>` : ''}` },
            { cle: 'fenetre', titre: 'Fenêtre', rendu: (l) => l.date_debut ? `${esc(fmt.date(l.date_debut))} → ${esc(fmt.date(l.date_fin))}` : '' },
            { cle: 'statut', titre: 'Statut', rendu: (l) => statut(l.statut) }
          ]
        }),
        commissions: () => ui.tableau({
          lignes: d.commissions, vide: 'Aucune commission',
          colonnes: [
            { cle: 'date_paiement', titre: 'Paiement du', rendu: (l) => esc(fmt.date(l.date_paiement)) },
            { cle: 'ecole_nom', titre: 'École', rendu: (l) => esc(l.ecole_nom) },
            { cle: 'calcul', titre: 'Calcul', classe: 'sa-num', rendu: (l) => `${fmt.decimal(l.taux, 0)} % de ${argent(l.montant_base, l.devise)}` },
            { cle: 'montant', titre: 'Commission', classe: 'sa-num', rendu: (l) => `<strong>${argent(l.montant, l.devise)}</strong>` },
            { cle: 'statut', titre: 'Statut', rendu: (l) => statut(l.statut) }
          ]
        }),
        prestations: () => ui.tableau({
          lignes: d.prestations, vide: 'Aucune prestation',
          colonnes: [
            { cle: 'date_realisation', titre: 'Réalisée le', rendu: (l) => esc(fmt.date(l.date_realisation)) },
            { cle: 'libelle', titre: 'Prestation', rendu: (l) => `${esc(l.libelle)}<div class="sa-muet">${esc(l.ecole_nom)}</div>` },
            { cle: 'part', titre: 'Part', classe: 'sa-num', rendu: (l) => `${fmt.decimal(l.part_pourcent, 0)} %` },
            { cle: 'montant', titre: 'Montant', classe: 'sa-num', rendu: (l) => argent(l.montant, l.devise) },
            { cle: 'statut', titre: 'Statut', rendu: (l) => statut(l.statut) }
          ]
        }),
        reglements: () => ui.tableau({
          lignes: d.reglements, vide: 'Aucun règlement',
          colonnes: [
            { cle: 'date_reglement', titre: 'Date', rendu: (l) => esc(fmt.date(l.date_reglement)) },
            { cle: 'montant', titre: 'Montant', classe: 'sa-num', rendu: (l) => `<strong>${argent(l.montant, l.devise)}</strong>` },
            { cle: 'methode', titre: 'Mode', rendu: (l) => `${esc(l.methode)}<div class="sa-mono">${esc(l.reference)}</div>` },
            { cle: 'regle_par_nom', titre: 'Enregistré par', rendu: (l) => esc(l.regle_par_nom || '') }
          ]
        }),
        declarations: () => ui.tableau({
          lignes: d.declarations, vide: 'Aucune déclaration',
          colonnes: [
            { cle: 'created_at', titre: 'Déclarée le', rendu: (l) => esc(fmt.date(l.created_at)) },
            { cle: 'ecole_nom', titre: 'École', rendu: (l) => `${esc(l.ecole_nom)}<div class="sa-muet">${esc(l.ville || '')}</div>` },
            { cle: 'source', titre: 'Origine', rendu: (l) => esc(LIBELLES[l.source] || l.source) },
            { cle: 'statut', titre: 'Statut', rendu: (l) => statut(l.statut) }
          ]
        }),
        journal: () => journalHtml(d.journal)
      };

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-panneau">
            <div class="sa-fiche">
              <div class="sa-fiche-ligne"><span class="sa-muet">Contact</span><div>${esc(p.email)}${p.telephone ? ` · <span class="sa-mono">${esc(p.telephone)}</span>` : ''}</div></div>
              <div class="sa-fiche-ligne"><span class="sa-muet">Localisation</span><div>${esc([p.ville, p.province].filter(Boolean).join(', ') || '—')}</div></div>
              <div class="sa-fiche-ligne"><span class="sa-muet">Statut</span><div>${statut(p.statut)} ${p.acces_active ? ui.badge('Portail activé', 'succes') : ui.badge('Portail non activé', 'neutre')}
                ${p.derniere_connexion_at ? `<span class="sa-muet"> · dernière connexion ${esc(fmt.relatif(p.derniere_connexion_at))}</span>` : ''}</div></div>
              ${p.notes_internes ? `<div class="sa-fiche-ligne"><span class="sa-muet">Notes internes</span><div class="sa-texte">${esc(p.notes_internes)}</div></div>` : ''}
            </div>
          </div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Badges <span class="sa-annexe">cumulables et indépendants — aucun ne donne accès à l’administration</span></h2>
          <div class="ap-grille-badges">${cartesBadges}</div>
        </section>

        <section class="sa-section sa-grille-2">
          <div class="sa-panneau">
            <h2 class="sa-section-titre">Codes de référencement
              <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-nouveau-code>Nouveau code</button></h2>
            ${(d.codes || []).map((c) => `
              <div class="ap-code">
                <div><span class="sa-mono ap-code-valeur">${esc(c.code)}</span> ${c.actif ? ui.badge('Actif', 'succes') : ui.badge('Désactivé', 'neutre')}
                  <div class="sa-muet">${esc(c.partenariat_nom ? `Partenariat : ${c.partenariat_nom}` : (c.libelle || ''))}</div>
                  <div class="sa-muet ap-lien">${esc(c.lien)}</div></div>
                <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-code="${esc(c.id)}" data-actif="${c.actif ? '0' : '1'}">${c.actif ? 'Désactiver' : 'Réactiver'}</button>
              </div>`).join('') || '<span class="sa-muet">Aucun code</span>'}
          </div>
          <div class="sa-panneau">
            <h2 class="sa-section-titre">Totaux</h2>
            <p class="sa-muet" style="margin:0 0 6px">Commissions</p>${totauxHtml(d.totaux.commissions)}
            <p class="sa-muet" style="margin:12px 0 6px">Prestations</p>${totauxHtml(d.totaux.prestations)}
            <p class="sa-muet" style="margin:12px 0 6px">Versé</p>${totauxHtml(d.totaux.reglements, ['verse'])}
          </div>
        </section>

        <section class="sa-section">
          <div class="sa-onglets">${ONGLETS.map(([cle, libelle]) =>
            `<button class="sa-onglet ${cle === onglet ? 'actif' : ''}" data-onglet="${cle}">${esc(libelle)}</button>`).join('')}</div>
          ${(tableaux[onglet] || tableaux.ecoles)()}
        </section>`;

      conteneur.querySelectorAll('[data-badge]').forEach((b) =>
        b.addEventListener('click', () => modaleBadge(id, b.dataset.badge, parBadge[b.dataset.badge])));
      conteneur.querySelectorAll('[data-onglet]').forEach((b) => b.addEventListener('click', () => {
        SA.majParams({ onglet: b.dataset.onglet }); SA.rafraichirVue();
      }));
      conteneur.querySelectorAll('[data-code]').forEach((b) => b.addEventListener('click', () =>
        agir(`${BASE}/codes/${b.dataset.code}`, 'PATCH', { actif: b.dataset.actif === '1' }, 'Code mis à jour.').catch(() => {})));
      const nouveauCode = conteneur.querySelector('[data-nouveau-code]');
      nouveauCode.addEventListener('click', () => F().formulaire({
        titre: 'Nouveau code de référencement', large: false,
        sousTitre: 'Pour une campagne ou un réseau particulier. Chaque code reste rattaché à cet apporteur.',
        champs: [
          { cle: 'libelle', libelle: 'Libellé (usage interne)', exemple: 'Campagne de rentrée — Kasaï' },
          { cle: 'partenariat_id', libelle: 'Partenariat', type: 'liste',
            options: [{ valeur: '', libelle: 'Aucun (code personnel)' }].concat((d.partenariats || []).map((x) => ({ valeur: x.id, libelle: x.nom }))) }
        ],
        soumettre: (v) => F().envoyer(`${BASE}/${id}/codes`, 'POST', v, 'Code créé.')
      }));
      if (onglet === 'ecoles') {
        conteneur.querySelectorAll('tr[data-id]').forEach((tr) =>
          tr.addEventListener('click', () => ouvrirAttribution(tr.dataset.id)));
      }
    }
  });

  function journalHtml(lignes) {
    return ui.tableau({
      lignes, vide: 'Aucune opération enregistrée',
      colonnes: [
        { cle: 'created_at', titre: 'Date', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
        { cle: 'action', titre: 'Opération', rendu: (l) => `<strong>${esc(l.entite)}</strong> · ${esc(String(l.action).replace(/_/g, ' '))}` },
        { cle: 'acteur', titre: 'Par', rendu: (l) => l.acteur_type === 'super_admin'
          ? esc(nomComplet(l.acteur_prenom, l.acteur_nom) || 'Super Admin') : esc(LIBELLES[l.acteur_type] || l.acteur_type) },
        { cle: 'motif', titre: 'Motif', rendu: (l) => l.motif ? `<span class="sa-texte">${esc(l.motif)}</span>` : '' }
      ]
    });
  }

  /* ======================================================================
     3. CANDIDATURES
     ====================================================================== */

  SA.enregistrerVue('apporteurs/candidatures', {
    titre: 'Candidatures',
    sousTitre: 'Reçues depuis la page publique. Une candidature n’accorde ni badge, ni code, ni accès.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(8, 46);
      const d = await SA.api(SA.url(`${BASE}/candidatures`, { statut: params.statut }));
      const colonnes = [
        { cle: 'nom', titre: 'Candidat', rendu: (l) => `<strong>${esc(nomComplet(l.prenom, l.nom))}</strong><div class="sa-muet">${esc([l.profession, l.organisation].filter(Boolean).join(' · '))}</div>` },
        { cle: 'contact', titre: 'Contact', rendu: (l) => `<span class="sa-mono">${esc(l.telephone)}</span>${l.email ? `<div>${esc(l.email)}</div>` : ''}` },
        { cle: 'ville', titre: 'Ville', rendu: (l) => esc([l.ville, l.province].filter(Boolean).join(', ')) },
        { cle: 'profils', titre: 'Intéressé par', rendu: (l) => (l.profils_souhaites || []).map((b) => `<span class="sa-etiquette">${esc((BADGES[b] || {}).court || b)}</span>`).join(' ') },
        { cle: 'created_at', titre: 'Reçue', rendu: (l) => esc(fmt.date(l.created_at)) },
        { cle: 'statut', titre: 'Statut', rendu: (l) => statut(l.statut) }
      ];
      conteneur.innerHTML = `
        <section class="sa-section">
          ${pastilles([['', 'Toutes'], ['nouvelle', 'Nouvelles'], ['en_examen', 'En examen'], ['retenue', 'Retenues'], ['refusee', 'Refusées']], params.statut, d.compteurs)}
          ${ui.tableau({ colonnes, lignes: d.donnees, cliquable: true, vide: 'Aucune candidature' })}
        </section>`;
      brancherFiltres(conteneur);
      conteneur.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () =>
        ouvrirCandidature(d.donnees.find((x) => x.id === tr.dataset.id))));
    }
  });

  function ouvrirCandidature(k) {
    const ligne = (libelle, valeur) => valeur ? `<div class="sa-fiche-ligne"><span class="sa-muet">${esc(libelle)}</span><div class="sa-texte">${esc(valeur)}</div></div>` : '';
    const voile = SA.modale({
      titre: nomComplet(k.prenom, k.nom), sousTitre: `Candidature reçue le ${fmt.date(k.created_at)}`, large: true,
      contenu: `<div class="sa-fiche">
          ${ligne('Téléphone', k.telephone)}${ligne('E-mail', k.email)}
          ${ligne('Ville', [k.ville, k.province].filter(Boolean).join(', '))}
          ${ligne('Profession', k.profession)}${ligne('Organisation', k.organisation)}
          ${ligne('Motivation', k.motivation)}${ligne('Réseau', k.reseau)}${ligne('Expérience', k.experience)}
        </div>
        <hr class="sa-separateur" />
        <label class="sa-champ-bloc"><span>Note d’examen</span>
          <textarea class="sa-champ" id="k-note" rows="3">${esc(k.note_examen || '')}</textarea></label>
        ${k.apporteur_id ? `<div class="sa-encart">Convertie en profil. <a href="#/apporteurs/profils/fiche/${esc(k.apporteur_id)}">Ouvrir la fiche</a></div>` : `
        <fieldset class="sa-panneau" style="border:1px solid var(--bordure)">
          <legend class="sa-muet">Badges à DEMANDER à la création du profil (ils naissent « en qualification », jamais actifs)</legend>
          ${CODES_BADGES.map((b) => `<label class="sa-champ-inline"><input type="checkbox" value="${b}" data-badge-k ${(k.profils_souhaites || []).includes(b) ? 'checked' : ''} /> <span>${esc(BADGES[b].libelle)}</span></label>`).join('')}
          ${k.email ? '' : `<label class="sa-champ-bloc"><span>E-mail (requis pour le portail)</span><input class="sa-champ" id="k-email" type="email" /></label>`}
        </fieldset>`}`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-st="en_examen">Mettre en examen</button>
        <button class="sa-bouton sa-bouton-secondaire" data-st="refusee">Refuser</button>
        ${k.apporteur_id ? '' : '<button class="sa-bouton sa-bouton-principal" data-convertir>Créer le profil</button>'}`
    });
    const note = () => voile.querySelector('#k-note').value.trim();
    voile.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', async () => {
      try {
        await agir(`${BASE}/candidatures/${k.id}`, 'PATCH', { statut: b.dataset.st, note_examen: note() }, 'Candidature mise à jour.');
        voile.fermer();
      } catch (e) { /* toast déjà affiché */ }
    }));
    const conv = voile.querySelector('[data-convertir]');
    if (conv) conv.addEventListener('click', async () => {
      conv.disabled = true;
      try {
        const badges = [...voile.querySelectorAll('[data-badge-k]:checked')].map((c) => c.value);
        const email = voile.querySelector('#k-email') ? voile.querySelector('#k-email').value.trim() : undefined;
        const r = await SA.api(`${BASE}/candidatures/${k.id}/convertir`, { method: 'POST', body: JSON.stringify({ badges, email, notes_internes: note() || undefined }) });
        voile.fermer();
        SA.toast(`Profil créé — code ${r.code}. Qualifiez maintenant ses badges.`, 'succes');
        SA.naviguer(`apporteurs/profils/fiche/${r.apporteur.id}`);
      } catch (e) { conv.disabled = false; SA.toast(e.message, 'danger'); }
    });
  }

  /* ======================================================================
     4. DÉCLARATIONS
     ====================================================================== */

  SA.enregistrerVue('apporteurs/declarations', {
    titre: 'Déclarations de prospects',
    sousTitre: 'La preuve d’antériorité d’un apporteur. Une déclaration n’attribue rien : elle se rattache à une école, puis se valide.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(8, 46);
      const d = await SA.api(SA.url(`${BASE}/declarations`, { statut: params.statut }));
      const colonnes = [
        { cle: 'created_at', titre: 'Déclarée le', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
        { cle: 'ecole_nom', titre: 'École déclarée', rendu: (l) => `<strong>${esc(l.ecole_nom)}</strong><div class="sa-muet">${esc(l.ville || '')}</div>` },
        { cle: 'apporteur', titre: 'Apporteur', rendu: (l) => `${esc(nomComplet(l.apporteur_prenom, l.apporteur_nom))}${l.partenariat_nom ? `<div class="sa-muet">${esc(l.partenariat_nom)}</div>` : ''}` },
        { cle: 'source', titre: 'Origine', rendu: (l) => `${esc(LIBELLES[l.source] || l.source)}${l.code ? `<div class="sa-mono">${esc(l.code)}</div>` : ''}` },
        { cle: 'ecole_actuelle', titre: 'Rattachée à', rendu: (l) => esc(l.ecole_actuelle || '') },
        { cle: 'statut', titre: 'Statut', rendu: (l) => statut(l.statut) },
        { cle: 'actions', titre: '', rendu: (l) => l.statut === 'en_attente'
          ? `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-traiter="${esc(l.id)}">Traiter</button>` : '' }
      ];
      conteneur.innerHTML = `
        <section class="sa-section">
          ${pastilles([['', 'Toutes'], ['en_attente', 'En attente'], ['rattachee', 'Rattachées'], ['rejetee', 'Rejetées']], params.statut)}
          ${ui.tableau({ colonnes, lignes: d.donnees, vide: 'Aucune déclaration' })}
        </section>`;
      brancherFiltres(conteneur);
      conteneur.querySelectorAll('[data-traiter]').forEach((b) => b.addEventListener('click', () => {
        const decl = d.donnees.find((x) => x.id === b.dataset.traiter);
        F().formulaire({
          titre: `Traiter « ${decl.ecole_nom} »`,
          sousTitre: `Déclarée par ${nomComplet(decl.apporteur_prenom, decl.apporteur_nom)} le ${fmt.date(decl.created_at)}. Rattacher crée une attribution PROPOSÉE, à valider ensuite.`,
          champs: [
            { cle: 'action', libelle: 'Décision', type: 'liste', requis: true, valeur: 'rattacher',
              options: [{ valeur: 'rattacher', libelle: 'Rattacher à une école inscrite' }, { valeur: 'rejeter', libelle: 'Rejeter' }] },
            { cle: 'ecole_id', libelle: 'École inscrite correspondante', type: 'liste', options: ecolesOptions() },
            { cle: 'preuve', libelle: 'Vérification effectuée', type: 'zone', lignes: 2, exemple: 'Le directeur confirme avoir été contacté par cet apporteur le…' },
            { cle: 'motif', libelle: 'Motif (obligatoire pour rejeter)', type: 'zone', lignes: 2 }
          ],
          soumettre: (v) => F().envoyer(`${BASE}/declarations/${decl.id}`, 'PATCH', v)
        });
      }));
    }
  });

  /* ======================================================================
     5. ATTRIBUTIONS ET PROLONGATIONS
     ====================================================================== */

  async function ouvrirAttribution(id) {
    let d;
    try { d = await SA.api(`${BASE}/attributions/${id}`); } catch (e) { SA.toast(e.message, 'danger'); return; }
    const a = d.attribution;
    const ap = d.apercu_validation;
    const ligne = (libelle, html) => html ? `<div class="sa-fiche-ligne"><span class="sa-muet">${esc(libelle)}</span><div>${html}</div></div>` : '';

    const voile = SA.modale({
      titre: a.ecole_nom_actuel || a.ecole_nom,
      sousTitre: `${nomComplet(a.apporteur_prenom, a.apporteur_nom)}${a.partenariat_nom ? ` — ${a.partenariat_nom}` : ''}`,
      large: true,
      contenu: `
        ${a.ecole_test ? '<div class="sa-encart">École en <strong>mode test</strong> : aucun de ses paiements ne produira de commission.</div>' : ''}
        ${a.ecole_deja_cliente ? '<div class="sa-encart"><strong>École déjà cliente</strong> avant la preuve d’apport : seule une validation par dérogation écrite est possible, et pour les seuls encaissements futurs.</div>' : ''}
        ${d.concurrentes.filter((c) => ['proposee', 'validee'].includes(c.statut)).length
          ? `<div class="sa-encart"><strong>Conflit :</strong> ${d.concurrentes.filter((c) => ['proposee', 'validee'].includes(c.statut)).map((c) =>
              `${esc(nomComplet(c.apporteur_prenom, c.apporteur_nom))} (${esc(LIBELLES[c.statut])}, preuve du ${esc(fmt.date(c.date_preuve))})`).join(' ; ')}.
              Valider cette attribution rejettera les autres propositions, avec la référence de cette décision.</div>` : ''}
        <div class="sa-fiche">
          ${ligne('Statut', statut(a.statut))}
          ${ligne('Origine', esc(LIBELLES[a.source] || a.source))}
          ${ligne('Preuve', `<div class="sa-texte">${esc(a.preuve)}</div><span class="sa-muet">datée du ${esc(fmt.date(a.date_preuve))}</span>`)}
          ${a.statut !== 'proposee' ? ligne('Conditions figées', a.taux_commission !== null
            ? `${fmt.decimal(a.taux_commission, 0)} % des encaissements du ${esc(fmt.date(a.date_debut))} au ${esc(fmt.date(a.date_fin))}${a.date_fin_initiale && a.date_fin !== a.date_fin_initiale ? ` <span class="sa-muet">(fin initiale : ${esc(fmt.date(a.date_fin_initiale))})</span>` : ''}` : '') : ''}
          ${a.statut === 'proposee' && ap ? ligne('Si validée aujourd’hui', `${fmt.decimal(ap.taux_commission, 0)} % des encaissements du ${esc(fmt.date(ap.date_debut))} au ${esc(fmt.date(ap.date_fin))} (${ap.duree_mois} mois)`) : ''}
          ${ligne('Décision', a.motif_decision ? `<div class="sa-texte">${esc(a.motif_decision)}</div>${a.validee_par_nom ? `<span class="sa-muet">par ${esc(a.validee_par_nom)}</span>` : ''}` : '')}
          ${ligne('Commissions', objetDevises(a.commissions))}
        </div>
        ${d.prolongations.length ? `<h3 style="margin:16px 0 8px">Prolongations</h3>${ui.tableau({
          lignes: d.prolongations, colonnes: [
            { cle: 'mois', titre: 'Durée', rendu: (l) => `+${l.mois_supplementaires} mois` },
            { cle: 'dates', titre: 'Fin', rendu: (l) => `${esc(fmt.date(l.ancienne_date_fin))} → ${esc(fmt.date(l.nouvelle_date_fin))}` },
            { cle: 'motif', titre: 'Motif', rendu: (l) => `<span class="sa-texte">${esc(l.motif)}</span>` },
            { cle: 'statut', titre: 'Statut', rendu: (l) => `${statut(l.statut)}${l.meme_personne ? '<div class="sa-muet">validée par la personne qui l’a proposée</div>' : ''}` },
            { cle: 'act', titre: '', rendu: (l) => l.statut === 'proposee'
              ? `<button class="sa-bouton sa-bouton-principal sa-bouton-petit" data-prol-valider="${esc(l.id)}">Valider</button>
                 <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-prol-rejeter="${esc(l.id)}">Rejeter</button>` : '' }
          ] })}` : ''}
        <h3 style="margin:16px 0 8px">Historique</h3>
        ${journalHtml(d.historique)}`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="fermer">Fermer</button>
        ${a.statut === 'proposee' ? `
          <button class="sa-bouton sa-bouton-secondaire" data-rejeter>Rejeter</button>
          <button class="sa-bouton sa-bouton-principal" data-valider>Valider l’attribution</button>` : ''}
        ${a.statut === 'validee' ? `
          <button class="sa-bouton sa-bouton-secondaire" data-prolonger>Proposer une prolongation</button>
          <button class="sa-bouton sa-bouton-danger" data-revoquer>Révoquer</button>` : ''}`
    });
    voile.querySelector('[data-role="fermer"]').addEventListener('click', () => voile.fermer());
    const sur = (sel, fn) => { const el = voile.querySelector(sel); if (el) el.addEventListener('click', fn); };

    sur('[data-valider]', async () => {
      const v = await demanderMotif({
        titre: 'Valider l’attribution',
        sousTitre: 'Le taux et la fenêtre sont figés à cet instant, selon le barème du programme. Les commissions sont ensuite calculées sur les seuls paiements confirmés.',
        libelle: 'Motif de la décision', libelleValider: 'Valider',
        champsSup: [
          { cle: 'date_debut', libelle: 'Début de fenêtre (facultatif — jamais avant la preuve)', type: 'date' },
          ...(a.ecole_deja_cliente ? [{ cle: 'derogation', libelle: 'Justification de la dérogation (école déjà cliente)', type: 'zone', lignes: 2, requis: true }] : [])
        ]
      });
      if (!v) return;
      try { await agir(`${BASE}/attributions/${id}/valider`, 'POST', { ...v, confirmation: true }, 'Attribution validée.'); voile.fermer(); } catch (e) { /* toast */ }
    });
    sur('[data-rejeter]', async () => {
      const v = await demanderMotif({ titre: 'Rejeter l’attribution', libelleValider: 'Rejeter', danger: true });
      if (!v) return;
      try { await agir(`${BASE}/attributions/${id}/rejeter`, 'POST', v, 'Attribution rejetée.'); voile.fermer(); } catch (e) { /* toast */ }
    });
    sur('[data-revoquer]', async () => {
      const v = await demanderMotif({
        titre: 'Révoquer l’attribution', danger: true, libelleValider: 'Révoquer',
        sousTitre: 'Les commissions déjà versées restent acquises. Celles calculées sur des paiements à partir de la date de révocation, non versées, sont annulées.',
        champsSup: [{ cle: 'date', libelle: 'Date de révocation (aujourd’hui par défaut)', type: 'date' }]
      });
      if (!v) return;
      try { await agir(`${BASE}/attributions/${id}/revoquer`, 'POST', { ...v, confirmation: true }, 'Attribution révoquée.'); voile.fermer(); } catch (e) { /* toast */ }
    });
    sur('[data-prolonger]', () => F().formulaire({
      titre: 'Proposer une prolongation exceptionnelle', large: false,
      sousTitre: 'Pour cette école seulement. La prolongation ne prend effet qu’après validation par une personne autorisée.',
      champs: [
        { cle: 'mois_supplementaires', libelle: 'Mois supplémentaires', type: 'nombre', pas: '1', min: 1, max: 36, requis: true },
        { cle: 'resultats', libelle: 'Résultats qui la justifient', type: 'zone', lignes: 3, requis: true, exemple: 'Écoles apportées, abonnements encaissés, période…' },
        { cle: 'motif', libelle: 'Motif', type: 'zone', lignes: 2, requis: true }
      ],
      soumettre: async (v) => { await F().envoyer(`${BASE}/attributions/${id}/prolongations`, 'POST', v); voile.fermer(); }
    }));
    voile.querySelectorAll('[data-prol-valider], [data-prol-rejeter]').forEach((b) => b.addEventListener('click', async () => {
      const valider = Boolean(b.dataset.prolValider);
      const v = await demanderMotif({ titre: valider ? 'Valider la prolongation' : 'Rejeter la prolongation', danger: !valider,
        libelleValider: valider ? 'Valider' : 'Rejeter' });
      if (!v) return;
      const pid = b.dataset.prolValider || b.dataset.prolRejeter;
      try {
        await agir(`${BASE}/prolongations/${pid}/${valider ? 'valider' : 'rejeter'}`, 'POST', { ...v, confirmation: true },
          valider ? 'Prolongation validée.' : 'Prolongation rejetée.');
        voile.fermer();
      } catch (e) { /* toast */ }
    }));
  }

  SA.enregistrerVue('apporteurs/attributions', {
    titre: 'Attributions d’écoles',
    sousTitre: 'Qui a apporté quelle école : preuve, décision, fenêtre de commission et conflits.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(8, 46);
      if (params.onglet === 'prolongations') return rendreProlongations(conteneur, params);
      const [d, apporteurs, partenariats] = await Promise.all([
        SA.api(SA.url(`${BASE}/attributions`, { statut: params.statut, conflit: params.conflit, apporteur_id: params.apporteur_id })),
        apporteursOptions('Choisir un apporteur'),
        SA.api(`${BASE}/partenariats`)
      ]);
      actionsEntete('<button class="sa-bouton sa-bouton-principal" data-proposer>Proposer une attribution</button>')
        .querySelector('[data-proposer]').addEventListener('click', () => F().formulaire({
          titre: 'Proposer une attribution sur justificatif',
          sousTitre: 'Pour une école inscrite indirectement : décrivez la preuve vérifiable (convention, liste nominative signée, attestation de la direction). La proposition se valide ensuite.',
          champs: [
            { cle: 'ecole_id', libelle: 'École', type: 'liste', requis: true, options: ecolesOptions() },
            { cle: 'apporteur_id', libelle: 'Apporteur', type: 'liste', requis: true, options: apporteurs },
            { cle: 'partenariat_id', libelle: 'Partenariat (doit appartenir à l’apporteur)', type: 'liste',
              options: [{ valeur: '', libelle: 'Aucun' }].concat((partenariats.donnees || []).filter((p) => p.statut === 'actif')
                .map((p) => ({ valeur: p.id, libelle: `${p.nom} — ${nomComplet(p.titulaire_prenom, p.titulaire_nom)}` }))) },
            { cle: 'date_preuve', libelle: 'Date de la preuve', type: 'date' },
            { cle: 'preuve', libelle: 'Preuve vérifiable', type: 'zone', lignes: 3, requis: true }
          ],
          soumettre: (v) => F().envoyer(`${BASE}/attributions`, 'POST', v, 'Attribution proposée.')
        }));

      const colonnes = [
        { cle: 'ecole_nom', titre: 'École', rendu: (l) => `<strong>${esc(l.ecole_nom_actuel || l.ecole_nom)}</strong>${l.ecole_test ? ' ' + ui.badge('Test', 'neutre') : ''}<div class="sa-muet">${esc(l.ecole_ville || '')}</div>` },
        { cle: 'apporteur', titre: 'Apporteur', rendu: (l) => `${esc(nomComplet(l.apporteur_prenom, l.apporteur_nom))}${l.partenariat_nom ? `<div class="sa-muet">${esc(l.partenariat_nom)}</div>` : ''}` },
        { cle: 'source', titre: 'Origine', rendu: (l) => `${esc(LIBELLES[l.source] || l.source)}<div class="sa-muet">preuve du ${esc(fmt.date(l.date_preuve))}</div>` },
        { cle: 'alertes', titre: 'Signaux', rendu: (l) => [l.concurrentes ? ui.badge(`${l.concurrentes} concurrente(s)`, 'danger') : '',
          l.ecole_deja_cliente ? ui.badge('Déjà cliente', 'attention') : ''].filter(Boolean).join(' ') },
        { cle: 'fenetre', titre: 'Fenêtre', rendu: (l) => l.date_debut ? `${esc(fmt.date(l.date_debut))}<div class="sa-muet">→ ${esc(fmt.date(l.date_fin))}</div>` : '' },
        { cle: 'commissions', titre: 'Commissions', classe: 'sa-num', rendu: (l) => objetDevises(l.commissions) },
        { cle: 'statut', titre: 'Statut', rendu: (l) => statut(l.statut) }
      ];
      conteneur.innerHTML = `
        <div class="sa-onglets">
          <button class="sa-onglet actif">Attributions</button>
          <button class="sa-onglet" data-vers-prolongations>Prolongations</button>
        </div>
        <section class="sa-section">
          ${pastilles([['', 'Toutes'], ['proposee', 'Proposées'], ['validee', 'Validées'], ['rejetee', 'Rejetées'], ['revoquee', 'Révoquées']], params.statut)}
          ${params.conflit === '1' ? '<div class="sa-encart">Affichage limité aux écoles revendiquées par plusieurs apporteurs. <a href="#/apporteurs/attributions">Tout afficher</a></div>' : ''}
          ${ui.tableau({ colonnes, lignes: d.donnees, cliquable: true, vide: 'Aucune attribution' })}
          <p class="sa-note">Critères d’attribution : une preuve datée et vérifiable (code saisi par l’école à son inscription, déclaration préalable de l’apporteur, ou justificatif écrit). Une seule attribution validée par école. Jamais de commission sur un paiement antérieur à la preuve.</p>
        </section>`;
      brancherFiltres(conteneur);
      conteneur.querySelector('[data-vers-prolongations]').addEventListener('click', () => { SA.majParams({ onglet: 'prolongations' }); SA.rafraichirVue(); });
      conteneur.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => ouvrirAttribution(tr.dataset.id)));
    }
  });

  async function rendreProlongations(conteneur, params) {
    const d = await SA.api(SA.url(`${BASE}/prolongations`, { statut: params.statut }));
    actionsEntete('');
    conteneur.innerHTML = `
      <div class="sa-onglets">
        <button class="sa-onglet" data-vers-attributions>Attributions</button>
        <button class="sa-onglet actif">Prolongations</button>
      </div>
      <section class="sa-section">
        <div class="sa-encart">Une prolongation est négociée école par école, motivée par des résultats, et ne prend effet qu’après validation. Elle n’existe jamais « pour toutes les écoles ».</div>
        ${ui.tableau({
          lignes: d.donnees, cliquable: true, vide: 'Aucune prolongation',
          colonnes: [
            { cle: 'ecole_nom', titre: 'École', rendu: (l) => `<strong>${esc(l.ecole_nom)}</strong><div class="sa-muet">${esc(nomComplet(l.apporteur_prenom, l.apporteur_nom))}${l.partenariat_nom ? ` — ${esc(l.partenariat_nom)}` : ''}</div>` },
            { cle: 'mois', titre: 'Durée', rendu: (l) => `+${l.mois_supplementaires} mois` },
            { cle: 'dates', titre: 'Fin', rendu: (l) => `${esc(fmt.date(l.ancienne_date_fin))} → ${esc(fmt.date(l.nouvelle_date_fin))}` },
            { cle: 'resultats', titre: 'Résultats', rendu: (l) => `<span class="sa-texte">${esc(l.resultats || '')}</span>` },
            { cle: 'qui', titre: 'Proposée / décidée', rendu: (l) => `${esc(l.demandee_par_nom || '—')}${l.decidee_par_nom ? `<div class="sa-muet">${esc(l.decidee_par_nom)}${l.meme_personne ? ' (même personne)' : ''}</div>` : ''}` },
            { cle: 'statut', titre: 'Statut', rendu: (l) => statut(l.statut) }
          ]
        })}
      </section>`;
    conteneur.querySelector('[data-vers-attributions]').addEventListener('click', () => { SA.majParams({}); SA.rafraichirVue(); });
    conteneur.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => {
      const l = d.donnees.find((x) => x.id === tr.dataset.id);
      if (l) ouvrirAttribution(l.attribution_id);
    }));
  }

  /* ======================================================================
     6. PARTENARIATS
     ====================================================================== */

  SA.enregistrerVue('apporteurs/partenariats', {
    titre: 'Partenariats stratégiques',
    sousTitre: 'Initiatives à grande échelle : code dédié, écoles rattachées une à une sur preuve, relevé vérifiable.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(6, 60);
      const d = await SA.api(`${BASE}/partenariats`);
      actionsEntete('<button class="sa-bouton sa-bouton-principal" data-nouveau>Nouveau partenariat</button>')
        .querySelector('[data-nouveau]').addEventListener('click', async () => {
          const titulaires = await apporteursOptions('Choisir le titulaire', 'partenaire_strategique');
          F().formulaire({
            titre: 'Nouveau partenariat',
            sousTitre: 'Le titulaire doit détenir le badge partenaire stratégique actif. Le taux reste celui du programme ; toute condition particulière passe par une prolongation validée, école par école.',
            champs: [
              { cle: 'apporteur_id', libelle: 'Titulaire', type: 'liste', requis: true, options: titulaires },
              { cle: 'nom', libelle: 'Nom de l’initiative', requis: true },
              { cle: 'perimetre', libelle: 'Périmètre', exemple: 'Provinces, réseau d’écoles, type d’établissements' },
              { cle: 'date_debut', libelle: 'Début', type: 'date' },
              { cle: 'date_fin', libelle: 'Fin (facultatif)', type: 'date' },
              { cle: 'description', libelle: 'Description', type: 'zone', lignes: 3 },
              { cle: 'conditions', libelle: 'Conditions convenues (texte de l’accord)', type: 'zone', lignes: 3 }
            ],
            soumettre: async (v) => {
              const r = await SA.api(`${BASE}/partenariats`, { method: 'POST', body: JSON.stringify(v) });
              SA.toast(`Partenariat créé — code ${r.code}.`, 'succes');
              SA.rafraichirVue();
            }
          });
        });

      conteneur.innerHTML = `<section class="sa-section">${d.donnees.length ? d.donnees.map((p) => `
        <div class="sa-panneau" style="margin-bottom:14px">
          <h2 class="sa-section-titre">${esc(p.nom)} ${statut(p.statut)}
            <span><button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-releve="${esc(p.id)}">Relevé</button>
            <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-csv="${esc(p.id)}">CSV</button>
            <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-modifier="${esc(p.id)}">Modifier</button></span></h2>
          <div class="sa-fiche">
            <div class="sa-fiche-ligne"><span class="sa-muet">Titulaire</span><div><a href="#/apporteurs/profils/fiche/${esc(p.apporteur_id)}">${esc(nomComplet(p.titulaire_prenom, p.titulaire_nom))}</a>${p.titulaire_organisation ? ` — ${esc(p.titulaire_organisation)}` : ''}</div></div>
            <div class="sa-fiche-ligne"><span class="sa-muet">Identifiant</span><div class="sa-mono">${esc(p.id)}</div></div>
            <div class="sa-fiche-ligne"><span class="sa-muet">Code(s)</span><div><span class="sa-mono ap-code-valeur">${esc(p.codes || '—')}</span>${p.liens.map((l) => `<div class="sa-muet ap-lien">${esc(l)}</div>`).join('')}</div></div>
            <div class="sa-fiche-ligne"><span class="sa-muet">Période</span><div>${esc(fmt.date(p.date_debut))}${p.date_fin ? ` → ${esc(fmt.date(p.date_fin))}` : ' → sans échéance'}</div></div>
            ${p.perimetre ? `<div class="sa-fiche-ligne"><span class="sa-muet">Périmètre</span><div>${esc(p.perimetre)}</div></div>` : ''}
            <div class="sa-fiche-ligne"><span class="sa-muet">Écoles</span><div>${fmt.nombre(p.ecoles_validees)} validée(s), ${fmt.nombre(p.ecoles_proposees)} proposée(s), ${fmt.nombre(p.declarations)} déclaration(s)</div></div>
            <div class="sa-fiche-ligne"><span class="sa-muet">Commissions</span><div>${objetDevises(p.commissions)}</div></div>
          </div>
        </div>`).join('') : ui.etatVide('Aucun partenariat', 'Créez-en un pour un titulaire qui détient le badge partenaire stratégique.')}</section>`;

      conteneur.querySelectorAll('[data-csv]').forEach((b) => b.addEventListener('click', () =>
        SA.telecharger(`${BASE}/partenariats/${b.dataset.csv}/releve?format=csv`, 'releve-partenariat.csv')));
      conteneur.querySelectorAll('[data-modifier]').forEach((b) => b.addEventListener('click', () => {
        const p = d.donnees.find((x) => x.id === b.dataset.modifier);
        F().formulaire({
          titre: `Modifier « ${p.nom} »`,
          champs: [
            { cle: 'nom', libelle: 'Nom', requis: true, valeur: p.nom },
            { cle: 'perimetre', libelle: 'Périmètre', valeur: p.perimetre },
            { cle: 'date_fin', libelle: 'Fin', type: 'date', valeur: (p.date_fin || '').slice(0, 10) },
            { cle: 'statut', libelle: 'Statut', type: 'liste', valeur: p.statut, options: ['actif', 'suspendu', 'clos'].map((s) => ({ valeur: s, libelle: LIBELLES[s] })) },
            { cle: 'conditions', libelle: 'Conditions convenues', type: 'zone', lignes: 3, valeur: p.conditions },
            { cle: 'motif', libelle: 'Motif (obligatoire si le statut change)', type: 'zone', lignes: 2 }
          ],
          soumettre: (v) => F().envoyer(`${BASE}/partenariats/${p.id}`, 'PATCH', v, 'Partenariat mis à jour.')
        });
      }));
      conteneur.querySelectorAll('[data-releve]').forEach((b) => b.addEventListener('click', async () => {
        try {
          const r = await SA.api(`${BASE}/partenariats/${b.dataset.releve}/releve`);
          SA.modale({
            titre: `Relevé — ${r.partenariat.nom}`, sousTitre: 'Chaque école, la preuve de son rattachement, sa fenêtre et chaque commission.', large: true,
            contenu: `<p class="sa-muet">Totaux</p>${totauxHtml(r.totaux)}
              <h3 style="margin:16px 0 8px">Écoles</h3>
              ${ui.tableau({ lignes: r.attributions, vide: 'Aucune école rattachée', colonnes: [
                { cle: 'ecole_nom', titre: 'École', rendu: (l) => `<strong>${esc(l.ecole_nom)}</strong><div class="sa-muet">${esc(l.ecole_ville || '')}</div>` },
                { cle: 'preuve', titre: 'Preuve', rendu: (l) => `<span class="sa-texte">${esc(l.preuve)}</span>` },
                { cle: 'fenetre', titre: 'Fenêtre', rendu: (l) => l.date_debut ? `${esc(fmt.date(l.date_debut))} → ${esc(fmt.date(l.date_fin))}` : '' },
                { cle: 'statut', titre: 'Statut', rendu: (l) => statut(l.statut) }] })}
              <h3 style="margin:16px 0 8px">Commissions</h3>
              ${ui.tableau({ lignes: r.commissions, vide: 'Aucune commission', colonnes: [
                { cle: 'date_paiement', titre: 'Paiement du', rendu: (l) => esc(fmt.date(l.date_paiement)) },
                { cle: 'ecole_nom', titre: 'École', rendu: (l) => esc(l.ecole_nom) },
                { cle: 'calcul', titre: 'Calcul', classe: 'sa-num', rendu: (l) => `${fmt.decimal(l.taux, 0)} % de ${argent(l.montant_base, l.devise)}` },
                { cle: 'montant', titre: 'Commission', classe: 'sa-num', rendu: (l) => argent(l.montant, l.devise) },
                { cle: 'statut', titre: 'Statut', rendu: (l) => statut(l.statut) }] })}`
          });
        } catch (e) { SA.toast(e.message, 'danger'); }
      }));
    }
  });

  /* ======================================================================
     7. COMMISSIONS
     ====================================================================== */

  SA.enregistrerVue('apporteurs/commissions', {
    titre: 'Commissions',
    sousTitre: 'Une ligne par paiement d’abonnement confirmé, encaissé dans la fenêtre d’une attribution validée.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(10, 42);
      const d = await SA.api(SA.url(`${BASE}/commissions`, {
        statut: params.statut, apporteur_id: params.apporteur_id, devise: params.devise, du: params.du, au: params.au, page: params.page
      }));
      const colonnes = [
        { cle: 'sel', titre: '', rendu: (l) => l.statut === 'gagnee' ? `<input type="checkbox" data-sel="${esc(l.id)}" aria-label="Sélectionner" />` : '' },
        { cle: 'date_paiement', titre: 'Paiement du', rendu: (l) => esc(fmt.date(l.date_paiement)) },
        { cle: 'ecole_nom', titre: 'École', rendu: (l) => `${esc(l.ecole_nom)}${l.type === 'regularisation' ? ' ' + ui.badge('Régularisation', 'danger') : ''}` },
        { cle: 'apporteur', titre: 'Apporteur', rendu: (l) => `<a href="#/apporteurs/profils/fiche/${esc(l.apporteur_id)}">${esc(nomComplet(l.apporteur_prenom, l.apporteur_nom))}</a>${l.partenariat_nom ? `<div class="sa-muet">${esc(l.partenariat_nom)}</div>` : ''}` },
        { cle: 'base', titre: 'Encaissé', classe: 'sa-num', rendu: (l) => argent(l.montant_base, l.devise) },
        { cle: 'taux', titre: 'Taux', classe: 'sa-num', rendu: (l) => `${fmt.decimal(l.taux, 0)} %` },
        { cle: 'montant', titre: 'Commission', classe: 'sa-num', rendu: (l) => `<strong>${argent(l.montant, l.devise)}</strong>` },
        { cle: 'statut', titre: 'Statut', rendu: (l) => `${statut(l.statut)}${l.reglement_reference ? `<div class="sa-mono">${esc(l.reglement_reference)}</div>` : ''}${l.motif ? `<div class="sa-muet">${esc(l.motif)}</div>` : ''}` },
        { cle: 'act', titre: '', rendu: (l) => ['gagnee', 'due'].includes(l.statut)
          ? `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-annuler="${esc(l.id)}">Annuler</button>` : '' }
      ];
      const zone = actionsEntete(`
        <button class="sa-bouton sa-bouton-secondaire" data-synchroniser>Recalculer</button>
        <button class="sa-bouton sa-bouton-principal" data-valider disabled>Valider la sélection</button>`);
      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-panneau">${totauxHtml(d.totaux, ['gagnee', 'due', 'reglee', 'annulee'])}</div>
        </section>
        <section class="sa-section">
          ${pastilles([['', 'Toutes'], ['gagnee', 'Gagnées (à vérifier)'], ['due', 'Dues'], ['reglee', 'Réglées'], ['annulee', 'Annulées']], params.statut)}
          ${ui.tableau({ colonnes, lignes: d.donnees, vide: 'Aucune commission pour ces critères' })}
          ${ui.pagination(d.pagination)}
          <p class="sa-note">Valider une commission atteste qu’elle a été vérifiée : elle devient due et peut être réglée. Un paiement remboursé après versement produit une régularisation négative — rien n’est effacé.</p>
        </section>`;
      brancherFiltres(conteneur);
      const valider = zone.querySelector('[data-valider]');
      const cases = () => [...conteneur.querySelectorAll('[data-sel]:checked')].map((c) => c.dataset.sel);
      conteneur.querySelectorAll('[data-sel]').forEach((c) => c.addEventListener('change', () => {
        valider.disabled = !cases().length; valider.textContent = cases().length ? `Valider (${cases().length})` : 'Valider la sélection';
      }));
      valider.addEventListener('click', () => agir(`${BASE}/commissions/valider`, 'POST', { ids: cases() }).catch(() => {}));
      zone.querySelector('[data-synchroniser]').addEventListener('click', () => agir(`${BASE}/commissions/synchroniser`, 'POST', {}, 'Commissions recalculées.').catch(() => {}));
      conteneur.querySelectorAll('[data-annuler]').forEach((b) => b.addEventListener('click', async () => {
        const v = await demanderMotif({ titre: 'Annuler la commission', danger: true, libelleValider: 'Annuler la commission' });
        if (v) agir(`${BASE}/commissions/${b.dataset.annuler}/annuler`, 'POST', v, 'Commission annulée.').catch(() => {});
      }));
      conteneur.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => {
        SA.majParams(Object.assign({}, params, { page: b.dataset.page })); SA.rafraichirVue();
      }));
    }
  });

  /* ======================================================================
     8. PRESTATIONS
     ====================================================================== */

  SA.enregistrerVue('apporteurs/prestations', {
    titre: 'Prestations',
    sousTitre: 'Installation, formation et capture réellement réalisées, et la part de chaque intervenant.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(8, 46);
      const [d, commandes, programme] = await Promise.all([
        SA.api(SA.url(`${BASE}/prestations`, { statut: params.statut })),
        SA.api(`${BASE}/prestations/commandes`),
        SA.api(`${BASE}/programme`)
      ]);
      const baremes = programme.baremes.filter((b) => b.categorie !== 'commission');

      actionsEntete('<button class="sa-bouton sa-bouton-principal" data-nouvelle>Enregistrer une prestation</button>')
        .querySelector('[data-nouvelle]').addEventListener('click', async () => {
          const intervenants = await apporteursOptions('—');
          F().formulaire({
            titre: 'Enregistrer une prestation réalisée',
            sousTitre: 'Avec une commande liée, l’école, la quantité et le montant viennent de la commande. Sans commande, le montant de référence est le tarif public du catalogue et une justification est exigée. Les intervenants doivent détenir le badge requis.',
            champs: [
              { cle: 'service_code', libelle: 'Prestation', type: 'liste', requis: true,
                options: baremes.map((b) => ({ valeur: b.code, libelle: `${b.libelle}${b.mode === 'a_definir' ? ' — rémunération à saisir' : ''}` })) },
              { cle: 'commande_service_id', libelle: 'Commande réalisée (recommandé)', type: 'liste',
                options: [{ valeur: '', libelle: 'Aucune commande liée' }].concat((commandes.donnees || []).map((c) => ({
                  valeur: c.id, libelle: `${c.ecole_nom} — ${c.service_nom} — ${fmt.montant(c.montant_total, c.devise)}${c.encaissee ? ' (encaissée)' : ''}` }))) },
              { cle: 'ecole_id', libelle: 'École (sans commande)', type: 'liste', options: ecolesOptions('—') },
              { cle: 'date_realisation', libelle: 'Réalisée le', type: 'date' },
              { cle: 'quantite', libelle: 'Nombre d’élèves (capture)', type: 'nombre', pas: '1', min: 1 },
              { cle: 'intervenant_1', libelle: 'Intervenant', type: 'liste', requis: true, options: intervenants },
              { cle: 'intervenant_2', libelle: 'Second intervenant (partage à parts égales)', type: 'liste', options: intervenants },
              { cle: 'remuneration_totale', libelle: 'Rémunération totale convenue (si non fixée par le barème)', type: 'nombre', min: 0 },
              { cle: 'justification', libelle: 'Justification', type: 'zone', lignes: 2 }
            ],
            soumettre: (v) => {
              const corps = { ...v, intervenants: [v.intervenant_1, v.intervenant_2].filter(Boolean) };
              delete corps.intervenant_1; delete corps.intervenant_2;
              return F().envoyer(`${BASE}/prestations`, 'POST', corps, 'Prestation enregistrée — à valider.');
            }
          });
        });

      const colonnes = [
        { cle: 'date_realisation', titre: 'Réalisée le', rendu: (l) => esc(fmt.date(l.date_realisation)) },
        { cle: 'libelle', titre: 'Prestation', rendu: (l) => `<strong>${esc(l.libelle)}</strong><div class="sa-muet">${esc(l.ecole_nom)}${l.quantite ? ` · ${fmt.nombre(l.quantite)} élève(s)` : ''}</div>` },
        { cle: 'ref', titre: 'Référence', classe: 'sa-num', rendu: (l) => argent(l.montant_reference, l.devise) },
        { cle: 'remuneration', titre: 'Rémunération', classe: 'sa-num', rendu: (l) => `<strong>${argent(l.remuneration_totale, l.devise)}</strong><div class="sa-muet">${l.mode_calcul === 'bareme' ? 'barème' : 'saisie justifiée'}</div>` },
        { cle: 'intervenants', titre: 'Intervenants', rendu: (l) => (l.intervenants || []).map((i) => `<div>${esc(nomComplet(i.prenom, i.nom))} — ${argent(i.montant, l.devise)} ${statut(i.statut)}</div>`).join('') },
        { cle: 'statut', titre: 'Statut', rendu: (l) => `${statut(l.statut)}${l.justification ? `<div class="sa-muet">${esc(l.justification)}</div>` : ''}` },
        { cle: 'act', titre: '', rendu: (l) => l.statut === 'a_valider'
          ? `<button class="sa-bouton sa-bouton-principal sa-bouton-petit" data-valider="${esc(l.id)}">Valider</button>
             <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-annuler="${esc(l.id)}">Annuler</button>`
          : l.statut === 'validee' ? `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-annuler="${esc(l.id)}">Annuler</button>` : '' }
      ];
      conteneur.innerHTML = `
        <section class="sa-section">
          ${commandes.donnees.length ? `<div class="sa-encart"><strong>${fmt.nombre(commandes.donnees.length)}</strong> commande(s) de service réalisée(s) sans prestation enregistrée.</div>` : ''}
          ${pastilles([['', 'Toutes'], ['a_valider', 'À valider'], ['validee', 'Validées'], ['annulee', 'Annulées']], params.statut)}
          ${ui.tableau({ colonnes, lignes: d.donnees, vide: 'Aucune prestation enregistrée' })}
          <p class="sa-note">Barèmes en vigueur : ${baremes.map((b) => `${esc(b.libelle)} — ${b.mode === 'pourcentage_prestation' ? `${fmt.decimal(b.valeur, 0)} % du montant de référence${b.max_intervenants ? `, ${b.max_intervenants} intervenant(s) au plus` : ''}` : 'à définir (saisie justifiée)'}`).join(' · ')}.</p>
        </section>`;
      brancherFiltres(conteneur);
      conteneur.querySelectorAll('[data-valider]').forEach((b) => b.addEventListener('click', () =>
        agir(`${BASE}/prestations/${b.dataset.valider}/valider`, 'POST', {}).catch(() => {})));
      conteneur.querySelectorAll('[data-annuler]').forEach((b) => b.addEventListener('click', async () => {
        const v = await demanderMotif({ titre: 'Annuler la prestation', danger: true, libelleValider: 'Annuler la prestation' });
        if (v) agir(`${BASE}/prestations/${b.dataset.annuler}/annuler`, 'POST', v).catch(() => {});
      }));
    }
  });

  /* ======================================================================
     9. RÈGLEMENTS
     ====================================================================== */

  SA.enregistrerVue('apporteurs/reglements', {
    titre: 'Règlements',
    sousTitre: 'Versements aux apporteurs, chacun rattaché aux montants dus qu’il solde.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(8, 46);
      const d = await SA.api(`${BASE}/reglements`);
      actionsEntete('<button class="sa-bouton sa-bouton-principal" data-nouveau>Enregistrer un règlement</button>')
        .querySelector('[data-nouveau]').addEventListener('click', ouvrirReglement);
      conteneur.innerHTML = `<section class="sa-section">${ui.tableau({
        lignes: d.donnees, vide: 'Aucun règlement enregistré',
        colonnes: [
          { cle: 'date_reglement', titre: 'Date', rendu: (l) => esc(fmt.date(l.date_reglement)) },
          { cle: 'apporteur', titre: 'Apporteur', rendu: (l) => `<a href="#/apporteurs/profils/fiche/${esc(l.apporteur_id)}">${esc(nomComplet(l.apporteur_prenom, l.apporteur_nom))}</a>` },
          { cle: 'montant', titre: 'Montant', classe: 'sa-num', rendu: (l) => `<strong>${argent(l.montant, l.devise)}</strong>` },
          { cle: 'methode', titre: 'Mode et référence', rendu: (l) => `${esc(l.methode)}<div class="sa-mono">${esc(l.reference)}</div>` },
          { cle: 'lignes', titre: 'Soldé', rendu: (l) => `${fmt.nombre(l.nb_commissions)} commission(s), ${fmt.nombre(l.nb_prestations)} prestation(s)` },
          { cle: 'regle_par_nom', titre: 'Enregistré par', rendu: (l) => esc(l.regle_par_nom || '') }
        ]
      })}</section>`;
    }
  });

  async function ouvrirReglement() {
    const apporteurs = await apporteursOptions('Choisir un apporteur');
    const voile = SA.modale({
      titre: 'Enregistrer un règlement', large: true,
      sousTitre: 'Sélectionnez les montants DUS que ce versement solde. Le total est calculé par le serveur ; une seule devise par règlement.',
      contenu: `
        <label class="sa-champ-bloc"><span>Apporteur</span>
          <select class="sa-champ" id="r-apporteur">${apporteurs.map((o) => `<option value="${esc(o.valeur)}">${esc(o.libelle)}</option>`).join('')}</select></label>
        <div id="r-lignes" class="sa-muet">Choisissez un apporteur pour afficher ses montants dus.</div>
        <div class="sa-grille-2">
          <label class="sa-champ-bloc"><span>Mode de règlement <em class="sa-requis">*</em></span>
            <select class="sa-champ" id="r-methode">
              <option value="mobile_money">Mobile Money</option><option value="especes">Espèces</option>
              <option value="virement_bancaire">Virement bancaire</option><option value="cheque">Chèque</option></select></label>
          <label class="sa-champ-bloc"><span>Référence vérifiable <em class="sa-requis">*</em></span>
            <input class="sa-champ" id="r-reference" maxlength="120" placeholder="N° de transaction, de reçu ou de virement" /></label>
          <label class="sa-champ-bloc"><span>Date</span><input class="sa-champ" type="date" id="r-date" /></label>
          <label class="sa-champ-bloc"><span>Note</span><input class="sa-champ" id="r-note" maxlength="500" /></label>
        </div>
        <div class="sa-form-erreur" id="r-erreur" hidden></div>`,
      actions: `<button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
                <button class="sa-bouton sa-bouton-principal" data-role="valider" disabled>Enregistrer le règlement</button>`
    });
    voile.querySelector('[data-role="annuler"]').addEventListener('click', () => voile.fermer());
    const zone = voile.querySelector('#r-lignes');
    const bouton = voile.querySelector('[data-role="valider"]');
    let donnees = null;

    const total = () => {
      const choisies = [...zone.querySelectorAll('input[type=checkbox]:checked')];
      const devises = new Set(choisies.map((c) => c.dataset.devise));
      const somme = choisies.reduce((s, c) => s + Math.round(Number(c.dataset.montant) * 100), 0) / 100;
      const resume = zone.querySelector('#r-total');
      if (resume) resume.innerHTML = devises.size > 1
        ? '<span class="sa-negatif">Une seule devise par règlement.</span>'
        : choisies.length ? `Total : <strong>${argent(somme, [...devises][0])}</strong>` : '';
      bouton.disabled = !choisies.length || devises.size !== 1 || somme <= 0;
    };

    voile.querySelector('#r-apporteur').addEventListener('change', async (e) => {
      if (!e.target.value) { zone.innerHTML = ''; bouton.disabled = true; return; }
      zone.innerHTML = ui.squelette(2, 30);
      donnees = await SA.api(SA.url(`${BASE}/reglements/a-regler`, { apporteur_id: e.target.value }));
      const lignes = [
        ...donnees.commissions.map((c) => ({ type: 'c', id: c.id, texte: `Commission — ${c.ecole_nom} (${fmt.date(c.date_paiement)})${c.type === 'regularisation' ? ' — régularisation' : ''}`, montant: c.montant, devise: c.devise })),
        ...donnees.interventions.map((i) => ({ type: 'i', id: i.id, texte: `${i.libelle} — ${i.ecole_nom} (${fmt.date(i.date_realisation)})`, montant: i.montant, devise: i.devise }))
      ];
      zone.innerHTML = lignes.length
        ? `${lignes.map((l) => `<label class="sa-champ-inline"><input type="checkbox" data-type="${l.type}" data-id="${esc(l.id)}" data-montant="${esc(l.montant)}" data-devise="${esc(l.devise)}" />
            <span>${esc(l.texte)} — ${argent(l.montant, l.devise)}</span></label>`).join('')}<p id="r-total" class="sa-texte"></p>`
        : '<div class="sa-encart">Aucun montant dû. Les commissions doivent d’abord être validées, et les prestations validées.</div>';
      zone.querySelectorAll('input[type=checkbox]').forEach((c) => c.addEventListener('change', total));
      total();
    });

    bouton.addEventListener('click', async () => {
      const choisies = [...zone.querySelectorAll('input[type=checkbox]:checked')];
      const erreur = voile.querySelector('#r-erreur');
      bouton.disabled = true; erreur.hidden = true;
      try {
        await SA.api(`${BASE}/reglements`, {
          method: 'POST',
          body: JSON.stringify({
            apporteur_id: voile.querySelector('#r-apporteur').value,
            devise: choisies[0].dataset.devise,
            commission_ids: choisies.filter((c) => c.dataset.type === 'c').map((c) => c.dataset.id),
            intervention_ids: choisies.filter((c) => c.dataset.type === 'i').map((c) => c.dataset.id),
            methode: voile.querySelector('#r-methode').value,
            reference: voile.querySelector('#r-reference').value.trim(),
            date_reglement: voile.querySelector('#r-date').value || undefined,
            note: voile.querySelector('#r-note').value.trim() || undefined,
            montant: choisies.reduce((s, c) => s + Math.round(Number(c.dataset.montant) * 100), 0) / 100,
            confirmation: true
          })
        });
        voile.fermer();
        SA.toast('Règlement enregistré.', 'succes');
        SA.rafraichirVue();
      } catch (e) {
        erreur.textContent = e.message || 'Enregistrement impossible.';
        erreur.hidden = false;
        bouton.disabled = false;
      }
    });
  }

  /* ======================================================================
     10. PROGRAMME (BARÈMES)
     ====================================================================== */

  SA.enregistrerVue('apporteurs/programme', {
    titre: 'Programme et barèmes',
    sousTitre: 'Conditions du programme. Une modification vaut pour les décisions à venir ; une attribution validée garde ses conditions.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(6, 50);
      const d = await SA.api(`${BASE}/programme`);
      const decrire = (b) => b.mode === 'taux_paiement'
        ? `${fmt.decimal(b.valeur, 0)} % de chaque paiement d’abonnement encaissé, pendant ${b.duree_mois} mois`
        : b.mode === 'pourcentage_prestation'
          ? `${fmt.decimal(b.valeur, 0)} % du montant de référence${b.max_intervenants ? `, partagé à parts égales entre ${b.max_intervenants} intervenant(s) au plus` : ''}`
          : '<span class="sa-attention-texte">À définir</span> — montant saisi et justifié à chaque prestation';
      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-encart">Les badges sont <strong>indépendants et cumulables</strong>. Aucun ne donne accès à l’administration d’Ardoise : ils conditionnent seulement ce que le programme peut confier à un apporteur.</div>
          ${ui.tableau({
            lignes: d.baremes.map((b) => ({ ...b, id: b.code })),
            colonnes: [
              { cle: 'libelle', titre: 'Élément', rendu: (l) => `<strong>${esc(l.libelle)}</strong><div class="sa-muet">${esc(l.description || '')}</div>` },
              { cle: 'regle', titre: 'Règle', rendu: decrire },
              { cle: 'tarif', titre: 'Tarif public', rendu: (l) => l.tarif_public ? `${fmt.montant(l.tarif_public.prix_unitaire, l.tarif_public.devise)}${l.tarif_public.mode_tarification === 'par_eleve' ? ' / élève' : ''}` : '' },
              { cle: 'badge', titre: 'Badge requis', rendu: (l) => l.badge_requis ? esc((BADGES[l.badge_requis] || {}).libelle || l.badge_requis) : '<span class="sa-muet">aucun</span>' },
              { cle: 'maj', titre: 'Modifié', rendu: (l) => esc(fmt.date(l.updated_at)) },
              { cle: 'act', titre: '', rendu: (l) => `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-modifier="${esc(l.code)}">Modifier</button>` }
            ]
          })}
        </section>`;
      conteneur.querySelectorAll('[data-modifier]').forEach((btn) => btn.addEventListener('click', () => {
        const b = d.baremes.find((x) => x.code === btn.dataset.modifier);
        const commission = b.categorie === 'commission';
        F().formulaire({
          titre: `Modifier « ${b.libelle} »`, large: false, danger: true, libelleValider: 'Modifier le barème',
          sousTitre: 'Condition financière du programme : la modification est journalisée et ne s’applique qu’aux décisions futures.',
          champs: [
            ...(commission ? [] : [{ cle: 'mode', libelle: 'Mode', type: 'liste', valeur: b.mode,
              options: [{ valeur: 'pourcentage_prestation', libelle: 'Pourcentage du montant de référence' }, { valeur: 'a_definir', libelle: 'À définir (saisie justifiée)' }] }]),
            { cle: 'valeur', libelle: 'Pourcentage', type: 'nombre', min: 0, max: 100, valeur: b.valeur },
            ...(commission ? [{ cle: 'duree_mois', libelle: 'Durée (mois)', type: 'nombre', pas: '1', min: 1, max: 120, valeur: b.duree_mois }] : []),
            ...(commission ? [] : [{ cle: 'max_intervenants', libelle: 'Intervenants au plus', type: 'nombre', pas: '1', min: 1, max: 10, valeur: b.max_intervenants }]),
            { cle: 'motif', libelle: 'Motif de la modification', type: 'zone', lignes: 2, requis: true }
          ],
          soumettre: (v) => F().envoyer(`${BASE}/programme/${b.code}`, 'PUT', { ...v, confirmation: true }, 'Barème modifié.')
        });
      }));
    }
  });

  /* ======================================================================
     11. JOURNAL
     ====================================================================== */

  SA.enregistrerVue('apporteurs/journal', {
    titre: 'Historique du programme',
    sousTitre: 'Journal en ajout seul : aucune ligne ne peut être modifiée ni supprimée, même par le serveur.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(10, 40);
      const d = await SA.api(SA.url(`${BASE}/journal`, { entite: params.entite, page: params.page }));
      const entites = [['', 'Tout'], ['attribution', 'Attributions'], ['commission', 'Commissions'], ['reglement', 'Règlements'],
        ['badge', 'Badges'], ['prestation', 'Prestations'], ['partenariat', 'Partenariats'], ['candidature', 'Candidatures'], ['bareme', 'Barèmes'], ['apporteur', 'Profils']];
      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-filtres">${entites.map(([cle, libelle]) => `<button class="sa-bouton sa-bouton-petit ${(params.entite || '') === cle ? 'sa-bouton-principal' : 'sa-bouton-secondaire'}" data-entite="${cle}">${esc(libelle)}</button>`).join('')}</div>
          ${ui.tableau({
            lignes: d.donnees, vide: 'Aucune opération',
            colonnes: [
              { cle: 'created_at', titre: 'Date', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
              { cle: 'action', titre: 'Opération', rendu: (l) => `<strong>${esc(l.entite)}</strong> · ${esc(String(l.action).replace(/_/g, ' '))}` },
              { cle: 'apporteur', titre: 'Apporteur', rendu: (l) => l.apporteur_id ? `<a href="#/apporteurs/profils/fiche/${esc(l.apporteur_id)}">${esc(nomComplet(l.apporteur_prenom, l.apporteur_nom))}</a>` : '' },
              { cle: 'acteur', titre: 'Par', rendu: (l) => l.acteur_type === 'super_admin' ? esc(nomComplet(l.acteur_prenom, l.acteur_nom) || 'Super Admin') : esc(l.acteur_type) },
              { cle: 'motif', titre: 'Motif', rendu: (l) => l.motif ? `<span class="sa-texte">${esc(l.motif)}</span>` : '' }
            ]
          })}
          ${ui.pagination(d.pagination)}
        </section>`;
      conteneur.querySelectorAll('[data-entite]').forEach((b) => b.addEventListener('click', () => {
        SA.majParams({ entite: b.dataset.entite || undefined }); SA.rafraichirVue();
      }));
      conteneur.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => {
        SA.majParams({ entite: params.entite, page: b.dataset.page }); SA.rafraichirVue();
      }));
    }
  });

  /* ======================================================================
     MESSAGERIE — conversations privées et salons du programme
     ----------------------------------------------------------------------
     Toute réponse part au nom de « Équipe Ardoise » : le portail ne montre
     jamais le nom ni le rôle de la personne qui a écrit. La mention « écrit
     par … » ci-dessous n'est visible que de l'équipe, pour se coordonner.
     ====================================================================== */

  const MSG = `${BASE}/messagerie`;

  SA.enregistrerVue('apporteurs/messagerie', {
    titre: 'Messagerie des partenaires',
    sousTitre: 'Conversations privées avec chaque partenaire et salons du programme. Vos réponses sont signées « Équipe Ardoise ».',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(6, 46);
      let conversations = [];
      let courante = null;
      let messages = [];
      let recherche = params.q || '';
      actionsEntete('');

      conteneur.innerHTML = `<div class="am-messagerie">
        <aside class="am-liste"><div class="am-liste-tete">
          <input class="sa-champ" id="am-recherche" placeholder="Rechercher un partenaire…" value="${esc(recherche)}" /></div>
          <div id="am-conversations"></div></aside>
        <section class="am-fil" id="am-fil">${ui.etatVide('Choisissez une conversation', 'Les conversations non lues apparaissent en premier.')}</section>
      </div>`;

      const heure = (v) => new Date(v).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

      function dessinerListe() {
        const salons = conversations.filter((c) => c.type === 'salon');
        const prives = conversations.filter((c) => c.type === 'equipe')
          .sort((a, b) => (b.non_lus - a.non_lus) || String(b.dernier_message_at || '').localeCompare(String(a.dernier_message_at || '')));
        const ligne = (c) => `<button type="button" class="am-conv ${courante && courante.id === c.id ? 'actif' : ''} ${c.non_lus ? 'non-lu' : ''}" data-conv="${esc(c.id)}">
          <span class="am-conv-icone">${c.type === 'salon' ? esc(c.icone || '#') : esc((c.nom || '?').slice(0, 1).toUpperCase())}</span>
          <span class="am-conv-texte"><strong>${esc(c.nom || 'Partenaire')}</strong>
            <small>${c.dernier ? `${esc(c.dernier.auteur_type === 'apporteur' ? c.dernier.auteur_nom : 'Équipe')} : ${c.dernier.contenu === null ? '<em>retiré</em>' : esc(c.dernier.contenu)}` : esc(c.description || '')}</small></span>
          ${c.non_lus ? `<span class="sa-badge ton-danger">${c.non_lus}</span>` : ''}</button>`;
        conteneur.querySelector('#am-conversations').innerHTML =
          `<p class="am-groupe">Salons</p>${salons.map(ligne).join('')}
           <p class="am-groupe">Partenaires</p>${prives.map(ligne).join('') || '<p class="sa-muet am-vide">Aucune conversation pour le moment.</p>'}`;
        conteneur.querySelectorAll('[data-conv]').forEach((b) => b.addEventListener('click', () => ouvrir(b.dataset.conv)));
      }

      async function chargerListe() {
        const d = await SA.api(SA.url(MSG, { q: recherche || undefined }));
        conversations = d.conversations || [];
        dessinerListe();
      }

      function dessinerFil() {
        const zone = conteneur.querySelector('#am-messages');
        if (!zone) return;
        zone.innerHTML = messages.map((m) => `
          <div class="am-message ${m.auteur_type}">
            <div class="am-message-tete"><strong>${esc(m.auteur_type === 'apporteur' ? m.auteur_nom : 'Équipe Ardoise')}</strong>
              ${m.ecrit_par ? `<span class="sa-muet">— écrit par ${esc(m.ecrit_par)}, invisible du partenaire</span>` : ''}
              <span class="sa-muet">${esc(heure(m.created_at))}</span>
              ${m.supprime ? '' : `<button type="button" class="am-retirer" data-retirer="${esc(m.id)}" title="Retirer ce message">Retirer</button>`}</div>
            <div class="am-message-corps">${m.supprime ? `<em class="sa-muet">Retiré${m.supprime_par === 'equipe' ? ' par l’équipe' : ' par son auteur'}${m.contenu_retire ? ` : « ${esc(m.contenu_retire)} »` : ''}</em>` : esc(m.contenu)}</div>
          </div>`).join('') || ui.etatVide('Aucun message', 'Écrivez le premier message.');
        zone.scrollTop = zone.scrollHeight;
        zone.querySelectorAll('[data-retirer]').forEach((b) => b.addEventListener('click', async () => {
          const v = await demanderMotif({ titre: 'Retirer ce message', libelle: 'Motif (gardé au journal)', libelleValider: 'Retirer', danger: true });
          if (!v) return;
          try {
            await SA.api(`${MSG}/messages/${b.dataset.retirer}`, { method: 'DELETE', body: JSON.stringify(v) });
            SA.toast('Message retiré.', 'succes');
            ouvrir(courante.id);
          } catch (e) { SA.toast(e.message, 'danger'); }
        }));
      }

      async function ouvrir(id) {
        courante = conversations.find((c) => c.id === id) || { id, type: 'equipe', nom: 'Partenaire' };
        SA.majParams(Object.assign({}, params, { c: id }));
        dessinerListe();
        conteneur.querySelector('#am-fil').innerHTML = `
          <header class="am-fil-tete"><div><h3>${esc(courante.nom || '')}</h3><p class="sa-muet">${esc(courante.description || '')}</p></div>
            ${courante.apporteur_id ? `<a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="#/apporteurs/profils/fiche/${esc(courante.apporteur_id)}">Fiche</a>` : ''}</header>
          <div class="am-messages" id="am-messages">${ui.squelette(3, 40)}</div>
          <form class="am-composer" id="am-composer">
            <textarea class="sa-champ" rows="3" maxlength="4000" placeholder="${courante.type === 'salon' ? 'Publier dans le salon au nom de l’équipe…' : 'Répondre au nom de l’équipe Ardoise…'}"></textarea>
            <div class="am-composer-pied"><span class="sa-note">Signé « Équipe Ardoise ».${courante.type === 'equipe' ? ' Le partenaire est prévenu par e-mail s’il l’a accepté.' : ''}</span>
              <button type="submit" class="sa-bouton sa-bouton-principal">Envoyer</button></div>
          </form>`;
        const d = await SA.api(`${MSG}/${id}/messages`);
        if (!courante || courante.id !== id) return;
        messages = d.messages || [];
        dessinerFil();
        SA.api(`${MSG}/${id}/lu`, { method: 'POST', body: '{}' }).then(() => { courante.non_lus = 0; dessinerListe(); }).catch(() => {});
        const form = conteneur.querySelector('#am-composer');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const zone = form.querySelector('textarea');
          const texte = zone.value.trim();
          if (!texte) return;
          const bouton = form.querySelector('[type=submit]');
          bouton.disabled = true;
          try {
            const r = await SA.api(`${MSG}/${id}/messages`, { method: 'POST', body: JSON.stringify({ contenu: texte }) });
            messages.push(r.message);
            zone.value = '';
            dessinerFil();
            chargerListe();
          } catch (err) { SA.toast(err.message, 'danger'); }
          finally { bouton.disabled = false; }
        });
      }

      const champ = conteneur.querySelector('#am-recherche');
      champ.addEventListener('input', SA.antiRebond(() => { recherche = champ.value.trim(); chargerListe(); }, 350));

      await chargerListe();
      const cible = params.c || (conversations.find((c) => c.non_lus) || {}).id;
      if (cible) await ouvrir(cible);

      // Rafraîchissement tant que la vue est affichée.
      const minuteur = setInterval(async () => {
        if (!SA.routeCourante || SA.routeCourante.cle !== 'apporteurs/messagerie') { clearInterval(minuteur); return; }
        if (document.hidden) return;
        try {
          await chargerListe();
          if (courante) {
            const d = await SA.api(`${MSG}/${courante.id}/messages`);
            if ((d.messages || []).length !== messages.length) { messages = d.messages; dessinerFil(); }
          }
        } catch (e) { /* réessai au prochain passage */ }
      }, 15000);
    }
  });
})();
