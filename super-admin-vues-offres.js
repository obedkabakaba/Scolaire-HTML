/* ==========================================================================
   Ardoise — Super Admin : Offres, promotions et tarification
   --------------------------------------------------------------------------
   Offres commerciales, changement de prix tracé, promotions, offres
   spéciales, tarifs négociés, abonnements clients.

   Aucun nom d'offre n'est écrit ici. « Ascension », « Prime », « Pilote »,
   « Infinite » sont des lignes créées depuis ces écrans : renommer une offre
   ne demande aucun déploiement.

   Ce module s'appuie sur `SA.finance` (défini par super-admin-vues-finance.js)
   pour le formatage monétaire — deux implémentations du même arrondi
   finiraient par diverger d'un centime, puis d'une explication.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui } = SA;
  const FIN = SA.finance || {};
  const argent = FIN.argent || ((v) => esc(v));
  const argentSigne = FIN.argentSigne || argent;
  const pourcent = FIN.pourcent || ((v) => `${esc(v)} %`);

  /* ======================================================================
     Fabrique de formulaires en modale
     ----------------------------------------------------------------------
     Les six écrans de ce module ouvrent tous le même genre de boîte : des
     champs, un bouton, un appel API, un toast. Écrit une fois ici plutôt que
     six fois plus bas — et surtout, la gestion d'erreur est identique
     partout, ce qui n'aurait pas duré trois relectures autrement.
     ====================================================================== */

  /** Décrit un champ. type : texte, nombre, date, mois, zone, liste, bascule. */
  function champHtml(c) {
    const id = `f-${c.cle}`;
    const valeur = c.valeur === null || c.valeur === undefined ? '' : c.valeur;
    const requis = c.requis ? 'required' : '';

    let controle;
    switch (c.type) {
      case 'zone':
        controle = `<textarea class="sa-champ" id="${id}" rows="${c.lignes || 3}" ${requis}
                      placeholder="${esc(c.exemple || '')}">${esc(valeur)}</textarea>`;
        break;
      case 'liste':
        controle = `<select class="sa-champ" id="${id}" ${requis}>
          ${(c.options || []).map((o) => {
            const v = typeof o === 'string' ? o : o.valeur;
            const l = typeof o === 'string' ? o : o.libelle;
            return `<option value="${esc(v)}" ${String(valeur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
          }).join('')}
        </select>`;
        break;
      case 'bascule':
        controle = `<label class="sa-bascule">
          <input type="checkbox" id="${id}" ${valeur ? 'checked' : ''} />
          <span>${esc(c.texteBascule || 'Activé')}</span></label>`;
        break;
      case 'nombre':
        controle = `<input class="sa-champ" type="number" id="${id}" value="${esc(valeur)}"
                      step="${c.pas || '0.01'}" ${c.min !== undefined ? `min="${c.min}"` : ''}
                      ${c.max !== undefined ? `max="${c.max}"` : ''} ${requis}
                      placeholder="${esc(c.exemple || '')}" />`;
        break;
      case 'date':
        controle = `<input class="sa-champ sa-champ-date" type="date" id="${id}" value="${esc(valeur)}" ${requis} />`;
        break;
      case 'mois':
        controle = `<input class="sa-champ sa-champ-date" type="month" id="${id}" value="${esc(valeur)}" ${requis} />`;
        break;
      default:
        controle = `<input class="sa-champ" type="text" id="${id}" value="${esc(valeur)}" ${requis}
                      maxlength="${c.longueurMax || 200}" placeholder="${esc(c.exemple || '')}" />`;
    }

    return `<label class="sa-champ-bloc">
      <span>${esc(c.libelle)}${c.requis ? ' <em class="sa-requis">*</em>' : ''}</span>
      ${controle}
      ${c.aide ? `<small class="sa-note">${esc(c.aide)}</small>` : ''}
    </label>`;
  }

  function lireChamps(voile, champs) {
    const valeurs = {};
    for (const c of champs) {
      const el = voile.querySelector(`#f-${c.cle}`);
      if (!el) continue;
      if (c.type === 'bascule') valeurs[c.cle] = el.checked;
      else if (c.type === 'nombre') valeurs[c.cle] = el.value === '' ? null : Number(el.value);
      else valeurs[c.cle] = el.value === '' ? null : el.value;
    }
    return valeurs;
  }

  /**
   * Ouvre un formulaire. `soumettre(valeurs)` doit renvoyer une promesse ;
   * la modale ne se ferme que si elle aboutit, pour que l'utilisateur ne
   * perde pas sa saisie quand le serveur refuse.
   */
  function formulaire({ titre, sousTitre, champs, libelleValider, large, soumettre, danger }) {
    const colonnes = champs.length > 5;
    const voile = SA.modale({
      titre, sousTitre, large: large !== false,
      contenu: `<form id="sa-form" class="${colonnes ? 'sa-grille-2' : ''}">
                  ${champs.map(champHtml).join('')}
                </form>
                <div class="sa-form-erreur" id="sa-form-erreur" hidden></div>`,
      actions: `<button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
                <button class="sa-bouton ${danger ? 'sa-bouton-danger' : 'sa-bouton-principal'}"
                        data-role="valider">${esc(libelleValider || 'Enregistrer')}</button>`
    });

    voile.querySelector('[data-role="annuler"]').addEventListener('click', () => voile.fermer());

    const bouton = voile.querySelector('[data-role="valider"]');
    const zoneErreur = voile.querySelector('#sa-form-erreur');

    bouton.addEventListener('click', async () => {
      const formulaireDom = voile.querySelector('#sa-form');
      if (!formulaireDom.reportValidity()) return;

      bouton.disabled = true;
      zoneErreur.hidden = true;
      try {
        await soumettre(lireChamps(voile, champs));
        voile.fermer();
      } catch (e) {
        zoneErreur.textContent = e.message || 'Enregistrement impossible.';
        zoneErreur.hidden = false;
      } finally {
        bouton.disabled = false;
      }
    });

    return voile;
  }

  /** Raccourci : POST/PATCH/PUT JSON puis toast et rafraîchissement. */
  async function envoyer(chemin, methode, corps, messageSucces) {
    const reponse = await SA.api(chemin, { method: methode, body: JSON.stringify(corps) });
    SA.toast(messageSucces || (reponse && reponse.message) || 'Enregistré.', 'succes');
    SA.rafraichirVue();
    return reponse;
  }

  /** Liste d'options { valeur, libelle } à partir d'une collection. */
  function options(liste, cleValeur, cleLibelle, vide) {
    const base = vide ? [{ valeur: '', libelle: vide }] : [];
    return base.concat((liste || []).map((x) => ({ valeur: x[cleValeur], libelle: x[cleLibelle] })));
  }

  /* ======================================================================
     1. Offres
     ====================================================================== */

  const CHAMPS_OFFRE = (o = {}) => [
    { cle: 'nom', libelle: "Nom de l'offre", requis: true, valeur: o.nom, exemple: 'Ex. Formule Découverte' },
    { cle: 'code', libelle: 'Code interne', valeur: o.code, longueurMax: 40, aide: 'Repère stable pour les exports. Facultatif.' },
    { cle: 'prix', libelle: 'Prix', type: 'nombre', min: 0, requis: true, valeur: o.prix,
      aide: o.id ? 'Le prix se modifie depuis le bouton dédié : il exige un motif.' : 'Prix facturé sur la durée indiquée.' },
    { cle: 'devise', libelle: 'Devise', valeur: o.devise || 'USD', longueurMax: 8 },
    { cle: 'duree_jours', libelle: 'Durée facturée (jours)', type: 'nombre', pas: '1', min: 1, valeur: o.duree_jours || 30,
      aide: '30 pour un abonnement mensuel, 365 pour un annuel.' },
    { cle: 'prix_annuel', libelle: 'Prix annuel (facultatif)', type: 'nombre', min: 0, valeur: o.prix_annuel },
    { cle: 'max_eleves', libelle: "Plafond d'élèves", type: 'nombre', pas: '1', min: 0, valeur: o.max_eleves,
      aide: 'Vide = illimité.' },
    { cle: 'max_utilisateurs', libelle: "Plafond d'utilisateurs", type: 'nombre', pas: '1', min: 0, valeur: o.max_utilisateurs },
    { cle: 'ordre_affichage', libelle: 'Ordre', type: 'nombre', pas: '1', min: 0, valeur: o.ordre_affichage || 0 },
    { cle: 'badge', libelle: 'Badge', valeur: o.badge, longueurMax: 40, exemple: 'Ex. Le plus choisi' },
    { cle: 'description', libelle: 'Description', type: 'zone', valeur: o.description },
    { cle: 'texte_marketing', libelle: 'Argumentaire commercial', type: 'zone', valeur: o.texte_marketing },
    { cle: 'visible_public', libelle: 'Visible publiquement', type: 'bascule',
      valeur: o.visible_public !== false, texteBascule: 'Affichée sur le site public' }
  ];

  SA.enregistrerVue('offres', {
    titre: 'Offres & tarification',
    sousTitre: 'La grille tarifaire, et ce que chaque offre rapporte réellement.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(4, 120);

      const archivees = params.archivees === 'oui';
      const d = await SA.api(SA.url('/super-admin/offres', { archivees: archivees ? 'oui' : undefined }));
      if (FIN.devise) FIN.devise(d.devise_reference);

      const peut = d.peut_ecrire !== false;

      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `
          <label class="sa-champ-inline"><input type="checkbox" id="voir-archivees" ${archivees ? 'checked' : ''} />
            <span>Voir les archivées</span></label>
          ${peut ? '<button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="btn-nouvelle">Nouvelle offre</button>' : ''}`;

        const c = document.getElementById('voir-archivees');
        if (c) c.addEventListener('change', () => SA.naviguer('offres', c.checked ? { archivees: 'oui' } : {}));

        const b = document.getElementById('btn-nouvelle');
        if (b) b.addEventListener('click', () => formulaire({
          titre: 'Nouvelle offre',
          sousTitre: 'Elle sera créée inactive côté public tant que vous ne la rendez pas visible.',
          champs: CHAMPS_OFFRE(),
          libelleValider: "Créer l'offre",
          soumettre: (v) => envoyer('/super-admin/offres', 'POST', v, 'Offre créée.')
        }));
      }

      const total = (d.offres || []).reduce((s, o) => s + (Number(o.mrr) || 0), 0);

      conteneur.innerHTML = `
        ${FIN.bandeauLecture ? FIN.bandeauLecture(d.peut_ecrire) : ''}
        ${d.conversion_approximative ? `<div class="sa-encart-alerte">
          Montants consolidés sans taux de change pour ${esc((d.devises_sans_taux || []).join(', '))}.
          <a href="#/couts/taux-change">Saisir un taux →</a></div>` : ''}

        <section class="sa-section">
          <div class="sa-grille-stats">
            ${ui.carteStat({ valeur: fmt.nombre((d.offres || []).filter((o) => o.statut === 'actif').length), etiquette: 'Offres actives', icone: '🏷️' })}
            ${ui.carteStat({ valeur: argent(total), etiquette: 'MRR total', ton: 'info', icone: '🔁' })}
            ${ui.carteStat({ valeur: argent(total * 12), etiquette: 'ARR total', icone: '📈' })}
            ${ui.carteStat({ valeur: fmt.nombre((d.offres || []).reduce((s, o) => s + Number(o.abonnements_actifs || 0), 0)), etiquette: 'Abonnements actifs', icone: '🏫' })}
          </div>
        </section>

        <section class="sa-section">
          <div class="sa-grille-3">
            ${(d.offres || []).map((o) => carteOffre(o, peut)).join('') || ui.etatVide('Aucune offre', 'Créez votre première offre pour commencer à facturer.')}
          </div>
        </section>`;

      brancherActionsOffres(conteneur, d);
    }
  });

  function carteOffre(o, peut) {
    const tonStatut = o.statut === 'actif' ? 'succes' : o.statut === 'archive' ? 'neutre' : 'attention';
    return `<div class="sa-panneau sa-carte-offre ${o.statut !== 'actif' ? 'sa-attenuee' : ''}">
      <div class="sa-carte-offre-entete">
        <div>
          <h3 class="sa-section-titre">${esc(o.nom)}</h3>
          <div class="sa-muet sa-mono">${esc(o.code || '—')}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          ${ui.badge(o.statut, tonStatut)}
          ${o.badge ? ui.badge(o.badge, 'info') : ''}
          ${o.visible_public === false ? ui.badge('non publiée', 'neutre') : ''}
        </div>
      </div>

      <div class="sa-chiffre-cle">
        <div class="sa-chiffre-cle-valeur">${argent(o.prix)}</div>
        <div class="sa-chiffre-cle-libelle">pour ${fmt.nombre(o.duree_jours)} jours
          ${Number(o.duree_jours) !== 30 ? ` · soit ${argent(o.prix_mensuel_equivalent)}/mois` : ''}</div>
      </div>

      <div class="sa-liste-infos">
        <div class="sa-ligne-info"><span>Écoles abonnées</span><span>${fmt.nombre(o.abonnements_actifs)}${Number(o.en_essai) ? ` <span class="sa-muet">(${fmt.nombre(o.en_essai)} en essai)</span>` : ''}</span></div>
        <div class="sa-ligne-info"><span>MRR généré</span><span>${argent(o.mrr)}</span></div>
        <div class="sa-ligne-info"><span>ARR généré</span><span>${argent(o.arr)}</span></div>
        <div class="sa-ligne-info"><span>Encaissé à ce jour</span><span>${argent(o.revenu_encaisse)}</span></div>
        <div class="sa-ligne-info"><span>Remises en cours</span><span>${Number(o.remises_mensuelles) ? `<span class="sa-negatif">−${fmt.decimal(o.remises_mensuelles, 2)}</span>` : '<span class="sa-muet">aucune</span>'}${Number(o.tarifs_negocies) ? ` <span class="sa-muet">· ${fmt.nombre(o.tarifs_negocies)} négocié(s)</span>` : ''}</span></div>
        <div class="sa-ligne-info"><span>Plafonds</span><span>${o.max_eleves ? `${fmt.nombre(o.max_eleves)} élèves` : 'élèves illimités'}${o.max_utilisateurs ? ` · ${fmt.nombre(o.max_utilisateurs)} utilisateurs` : ''}</span></div>
      </div>

      ${o.description ? `<p class="sa-note">${esc(o.description)}</p>` : ''}

      <div class="sa-carte-offre-actions">
        <a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="#/offres/historique-prix?plan=${esc(o.id)}">Historique des prix</a>
        ${peut ? `
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-modifier="${esc(o.id)}">Modifier</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-prix="${esc(o.id)}">Changer le prix</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-statut="${esc(o.id)}">Statut</button>` : ''}
      </div>
    </div>`;
  }

  function brancherActionsOffres(conteneur, d) {
    const trouver = (id) => (d.offres || []).find((o) => String(o.id) === String(id));

    conteneur.querySelectorAll('[data-modifier]').forEach((b) => b.addEventListener('click', () => {
      const o = trouver(b.dataset.modifier);
      const champs = CHAMPS_OFFRE(o).filter((c) => c.cle !== 'prix');
      formulaire({
        titre: `Modifier « ${o.nom} »`,
        sousTitre: 'Le prix ne se modifie pas ici : il exige un motif et alimente un historique.',
        champs,
        soumettre: (v) => envoyer(`/super-admin/offres/${o.id}`, 'PATCH', v, 'Offre mise à jour.')
      });
    }));

    conteneur.querySelectorAll('[data-prix]').forEach((b) => b.addEventListener('click', () => {
      const o = trouver(b.dataset.prix);
      ouvrirChangementPrix(o);
    }));

    conteneur.querySelectorAll('[data-statut]').forEach((b) => b.addEventListener('click', () => {
      const o = trouver(b.dataset.statut);
      formulaire({
        titre: `Statut de « ${o.nom} »`,
        sousTitre: 'Désactiver retire l\'offre des nouvelles souscriptions sans toucher aux abonnements en cours. '
                 + 'Archiver n\'est possible que si plus aucune école n\'y est abonnée.',
        large: false,
        champs: [
          { cle: 'statut', libelle: 'Nouveau statut', type: 'liste', valeur: o.statut, options: [
            { valeur: 'actif', libelle: 'Active — proposée aux nouvelles écoles' },
            { valeur: 'inactif', libelle: 'Désactivée — plus proposée, abonnements maintenus' },
            { valeur: 'archive', libelle: 'Archivée — retirée des écrans' }
          ] },
          { cle: 'raison', libelle: 'Motif', type: 'zone', lignes: 2 }
        ],
        libelleValider: 'Appliquer',
        soumettre: (v) => envoyer(`/super-admin/offres/${o.id}/statut`, 'POST',
          Object.assign({ confirmation: true }, v), 'Statut mis à jour.')
      });
    }));
  }

  /**
   * Changement de prix en deux temps.
   * ----------------------------------------------------------------------
   * On demande d'abord au serveur l'impact réel (écoles concernées, variation
   * du MRR), puis on l'affiche avant de laisser confirmer. Calculer cet impact
   * dans le navigateur aurait été plus rapide à écrire et faux : le navigateur
   * ne sait pas quelles écoles sont protégées par un tarif négocié.
   */
  function ouvrirChangementPrix(o) {
    formulaire({
      titre: `Changer le prix de « ${o.nom} »`,
      sousTitre: `Prix actuel : ${Number(o.prix).toLocaleString('fr-FR')} ${o.devise || ''} pour ${o.duree_jours} jours.`,
      large: false,
      champs: [
        { cle: 'nouveau_prix', libelle: 'Nouveau prix', type: 'nombre', min: 0, requis: true, valeur: o.prix },
        { cle: 'nouveau_prix_annuel', libelle: 'Nouveau prix annuel', type: 'nombre', min: 0, valeur: o.prix_annuel },
        { cle: 'date_application', libelle: "Date d'application", type: 'date',
          valeur: new Date().toISOString().slice(0, 10) },
        { cle: 'raison', libelle: 'Motif du changement', type: 'zone', requis: true, lignes: 2,
          aide: 'Obligatoire. Il sera lisible dans l\'historique et le journal financier.' }
      ],
      libelleValider: 'Voir l\'impact',
      async soumettre(v) {
        const impact = await SA.api(`/super-admin/offres/${o.id}/impact-prix`, {
          method: 'POST', body: JSON.stringify({ nouveau_prix: v.nouveau_prix })
        });

        const hausse = impact.variation_absolue > 0;
        const voile = SA.modale({
          titre: 'Confirmer le changement de prix',
          sousTitre: o.nom,
          contenu: `
            <div class="sa-comparaison-prix">
              <div><div class="sa-muet">Prix actuel</div>
                <div class="sa-chiffre-cle-valeur">${fmt.decimal(impact.ancien_prix, 2)} ${esc(o.devise || '')}</div></div>
              <div class="sa-fleche">→</div>
              <div><div class="sa-muet">Nouveau prix</div>
                <div class="sa-chiffre-cle-valeur ${hausse ? 'sa-positif' : 'sa-negatif'}">
                  ${fmt.decimal(impact.nouveau_prix, 2)} ${esc(o.devise || '')}</div></div>
            </div>
            <div class="sa-liste-infos" style="margin-top:14px">
              <div class="sa-ligne-info"><span>Variation</span><span>${argentSigne(impact.variation_absolue)}
                ${impact.variation_pourcentage !== null ? ` (${pourcent(impact.variation_pourcentage)})` : ''}</span></div>
              <div class="sa-ligne-info"><span>Écoles impactées</span><span>${fmt.nombre(impact.ecoles_impactees)}</span></div>
              <div class="sa-ligne-info"><span>Écoles au tarif négocié</span><span>${fmt.nombre(impact.ecoles_au_tarif_negocie)} <span class="sa-muet">(prix inchangé)</span></span></div>
              <div class="sa-ligne-info"><span>Impact sur le MRR</span><span>${argentSigne(impact.impact_mrr)}</span></div>
              <div class="sa-ligne-info"><span>Impact sur l'ARR</span><span>${argentSigne(impact.impact_arr)}</span></div>
              <div class="sa-ligne-info"><span>Date d'application</span><span>${esc(v.date_application || 'aujourd\'hui')}</span></div>
              <div class="sa-ligne-info"><span>Motif</span><span>${esc(v.raison)}</span></div>
            </div>
            <p class="sa-note">${esc(impact.note)} Les écoles concernées verront le nouveau prix à leur prochain renouvellement ;
              les factures déjà émises ne changent pas.</p>`,
          actions: `<button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
                    <button class="sa-bouton sa-bouton-principal" data-role="valider">Appliquer le nouveau prix</button>`
        });

        voile.querySelector('[data-role="annuler"]').addEventListener('click', () => voile.fermer());
        voile.querySelector('[data-role="valider"]').addEventListener('click', async (e) => {
          e.target.disabled = true;
          try {
            await envoyer(`/super-admin/offres/${o.id}/prix`, 'POST', {
              confirmation: true,
              nouveau_prix: v.nouveau_prix,
              nouveau_prix_annuel: v.nouveau_prix_annuel,
              date_application: v.date_application,
              raison: v.raison
            });
            voile.fermer();
          } catch (err) {
            SA.toast(err.message || 'Changement refusé.', 'danger');
            e.target.disabled = false;
          }
        });
      }
    });
  }

  /* ======================================================================
     2. Historique des prix
     ====================================================================== */

  SA.enregistrerVue('offres/historique-prix', {
    titre: 'Historique des prix',
    sousTitre: 'Chaque prix qu\'une offre a porté, avec son motif.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(6, 46);

      const offres = await SA.api('/super-admin/offres?archivees=oui');
      if (FIN.devise) FIN.devise(offres.devise_reference);

      const planId = params.plan || (offres.offres && offres.offres[0] ? offres.offres[0].id : null);
      if (!planId) {
        conteneur.innerHTML = ui.etatVide('Aucune offre', 'Créez une offre pour suivre son prix dans le temps.');
        return;
      }

      const d = await SA.api(`/super-admin/offres/${planId}/historique-prix`);

      const colonnes = [
        { cle: 'created_at', titre: 'Enregistré le', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
        { cle: 'date_application', titre: 'Appliqué le', rendu: (l) => esc(fmt.date(l.date_application)) },
        { cle: 'ancien_prix', titre: 'Ancien prix', classe: 'sa-num',
          rendu: (l) => l.ancien_prix === null ? '<span class="sa-muet">création</span>' : `${fmt.decimal(l.ancien_prix, 2)} ${esc(l.devise || '')}` },
        { cle: 'nouveau_prix', titre: 'Nouveau prix', classe: 'sa-num',
          rendu: (l) => `${fmt.decimal(l.nouveau_prix, 2)} ${esc(l.devise || '')}` },
        { cle: 'variation', titre: 'Variation', classe: 'sa-num', rendu: (l) => {
          if (l.ancien_prix === null) return '<span class="sa-muet">—</span>';
          const delta = Number(l.nouveau_prix) - Number(l.ancien_prix);
          const pct = Number(l.ancien_prix) ? (delta / Number(l.ancien_prix)) * 100 : null;
          return `<span class="${delta > 0 ? 'sa-positif' : delta < 0 ? 'sa-negatif' : ''}">${delta > 0 ? '+' : ''}${fmt.decimal(delta, 2)}${pct === null ? '' : ` (${fmt.decimal(pct, 1)} %)`}</span>`;
        } },
        { cle: 'ecoles_impactees', titre: 'Écoles', classe: 'sa-num', rendu: (l) => l.ecoles_impactees === null ? '—' : fmt.nombre(l.ecoles_impactees) },
        { cle: 'impact_mrr_estime', titre: 'Impact MRR', classe: 'sa-num', rendu: (l) => l.impact_mrr_estime === null ? '—' : argentSigne(l.impact_mrr_estime) },
        { cle: 'raison', titre: 'Motif', rendu: (l) => esc(l.raison || '—') },
        { cle: 'modifie_par_nom', titre: 'Par', rendu: (l) => esc(l.modifie_par_nom || '—') }
      ];

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-barre-filtres">
            <label class="sa-champ-bloc" style="max-width:320px"><span>Offre</span>
              <select class="sa-champ" id="filtre-plan">
                ${(offres.offres || []).map((o) => `<option value="${esc(o.id)}" ${String(o.id) === String(planId) ? 'selected' : ''}>${esc(o.nom)}</option>`).join('')}
              </select></label>
          </div>
          ${ui.tableau({ colonnes, lignes: d.donnees, vide: 'Aucun changement de prix enregistré' })}
          <p class="sa-note">Cet historique n'est jamais purgé : il justifie a posteriori tout écart constaté sur une facture.</p>
        </section>`;

      const sel = document.getElementById('filtre-plan');
      if (sel) sel.addEventListener('change', () => SA.majParams({ plan: sel.value }) || SA.rafraichirVue());
    }
  });

  /* ======================================================================
     3. Promotions
     ====================================================================== */

  SA.enregistrerVue('offres/promotions', {
    titre: 'Promotions',
    sousTitre: 'Codes promo et réductions à durée limitée.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(8, 46);

      const [d, offres] = await Promise.all([
        SA.api(SA.url('/super-admin/promotions', { page: params.page, statut: params.statut, recherche: params.recherche })),
        SA.api('/super-admin/offres')
      ]);

      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = '<button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="btn-nouvelle">Nouvelle promotion</button>';
        const b = document.getElementById('btn-nouvelle');
        if (b) b.addEventListener('click', () => formulaire({
          titre: 'Nouvelle promotion',
          sousTitre: 'Elle sera enregistrée et journalisée. Une promotion ne se supprime pas : elle s\'archive.',
          champs: [
            { cle: 'nom', libelle: 'Nom', requis: true, exemple: 'Ex. Rentrée 2026' },
            { cle: 'code', libelle: 'Code promo', longueurMax: 40, aide: 'Mis en majuscules automatiquement.' },
            { cle: 'type_reduction', libelle: 'Type de réduction', type: 'liste', options: [
              { valeur: 'pourcentage', libelle: 'Pourcentage de remise' },
              { valeur: 'montant_fixe', libelle: 'Montant fixe déduit' },
              { valeur: 'mois_offerts', libelle: 'Mois offerts' }
            ] },
            { cle: 'valeur', libelle: 'Valeur', type: 'nombre', min: 0, requis: true,
              aide: 'Pourcentage entre 0 et 100, ou montant, ou nombre de mois.' },
            { cle: 'duree_mois', libelle: 'Durée d\'application (mois)', type: 'nombre', pas: '1', min: 1,
              aide: 'Vide = tant que la promotion est active.' },
            { cle: 'cible', libelle: 'Public visé', type: 'liste', options: [
              { valeur: 'tous', libelle: 'Toutes les écoles' },
              { valeur: 'nouveaux', libelle: 'Nouvelles écoles uniquement' },
              { valeur: 'anciens', libelle: 'Écoles existantes uniquement' }
            ] },
            { cle: 'date_debut', libelle: 'Début', type: 'date' },
            { cle: 'date_fin', libelle: 'Fin', type: 'date' },
            { cle: 'max_utilisations', libelle: 'Nombre maximal d\'utilisations', type: 'nombre', pas: '1', min: 1 },
            { cle: 'description', libelle: 'Description', type: 'zone' }
          ],
          libelleValider: 'Créer la promotion',
          soumettre: (v) => envoyer('/super-admin/promotions', 'POST',
            Object.assign({ confirmation: true }, v), 'Promotion créée.')
        }));
      }

      const colonnes = [
        { cle: 'nom', titre: 'Promotion', rendu: (l) => `${esc(l.nom)}${l.code ? `<div class="sa-mono sa-muet">${esc(l.code)}</div>` : ''}` },
        { cle: 'type_reduction', titre: 'Réduction', rendu: (l) => {
          const v = Number(l.valeur);
          if (l.type_reduction === 'pourcentage') return `<strong>−${fmt.decimal(v, v % 1 ? 1 : 0)} %</strong>`;
          if (l.type_reduction === 'mois_offerts') return `<strong>${fmt.nombre(v)} mois offert(s)</strong>`;
          return `<strong>−${fmt.decimal(v, 2)} ${esc(l.devise || '')}</strong>`;
        } },
        { cle: 'cible', titre: 'Cible', rendu: (l) => ui.badge(l.cible, 'neutre') },
        { cle: 'periode', titre: 'Période', rendu: (l) => {
          if (!l.date_debut && !l.date_fin) return '<span class="sa-muet">sans limite</span>';
          return `${l.date_debut ? esc(fmt.date(l.date_debut)) : '…'} → ${l.date_fin ? esc(fmt.date(l.date_fin)) : '…'}`;
        } },
        { cle: 'nb_utilisations', titre: 'Utilisations', classe: 'sa-num',
          rendu: (l) => `${fmt.nombre(l.nb_utilisations)}${l.max_utilisations ? ` / ${fmt.nombre(l.max_utilisations)}` : ''}` },
        { cle: 'statut', titre: 'Statut', rendu: (l) => {
          if (l.statut === 'active' && l.echue) return ui.badge('échue', 'attention');
          if (l.statut === 'active' && l.epuisee) return ui.badge('épuisée', 'attention');
          return ui.badgeStatut(l.statut === 'active' ? 'actif' : l.statut);
        } },
        { cle: 'actions', titre: '', rendu: (l) => `
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-promo="${esc(l.id)}">Modifier</button>` }
      ];

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-barre-filtres">
            <label class="sa-champ-bloc"><span>Statut</span>
              <select class="sa-champ" id="filtre-statut">
                <option value="">Tous</option>
                ${['active', 'inactive', 'expiree', 'archivee'].map((s) => `<option value="${s}" ${params.statut === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select></label>
            <label class="sa-champ-bloc"><span>Recherche</span>
              <input class="sa-champ" id="filtre-recherche" value="${esc(params.recherche || '')}" placeholder="Nom ou code" /></label>
          </div>
          ${ui.tableau({ colonnes, lignes: d.donnees, vide: 'Aucune promotion' })}
          ${ui.pagination(d.pagination)}
          <p class="sa-note">
            Les promotions sont enregistrées et consultables. Leur application automatique au moment de la
            souscription n'est pas encore branchée sur le tunnel de paiement : pour l'instant, une remise se
            matérialise par un tarif personnalisé sur l'école concernée.
          </p>
        </section>`;

      const sel = document.getElementById('filtre-statut');
      if (sel) sel.addEventListener('change', () => SA.majParams({ statut: sel.value || undefined, page: 1 }) || SA.rafraichirVue());

      const rech = document.getElementById('filtre-recherche');
      if (rech) rech.addEventListener('input', SA.antiRebond(() => {
        SA.majParams({ recherche: rech.value || undefined, page: 1 });
        SA.rafraichirVue();
      }, 380));

      conteneur.querySelectorAll('[data-promo]').forEach((b) => b.addEventListener('click', () => {
        const p = (d.donnees || []).find((x) => String(x.id) === String(b.dataset.promo));
        formulaire({
          titre: `Modifier « ${p.nom} »`,
          champs: [
            { cle: 'nom', libelle: 'Nom', requis: true, valeur: p.nom },
            { cle: 'valeur', libelle: 'Valeur', type: 'nombre', min: 0, valeur: p.valeur },
            { cle: 'duree_mois', libelle: 'Durée (mois)', type: 'nombre', pas: '1', min: 1, valeur: p.duree_mois },
            { cle: 'date_debut', libelle: 'Début', type: 'date', valeur: p.date_debut ? String(p.date_debut).slice(0, 10) : '' },
            { cle: 'date_fin', libelle: 'Fin', type: 'date', valeur: p.date_fin ? String(p.date_fin).slice(0, 10) : '' },
            { cle: 'max_utilisations', libelle: 'Utilisations maximales', type: 'nombre', pas: '1', min: 1, valeur: p.max_utilisations },
            { cle: 'statut', libelle: 'Statut', type: 'liste', valeur: p.statut, options: [
              { valeur: 'active', libelle: 'Active' }, { valeur: 'inactive', libelle: 'Inactive' },
              { valeur: 'expiree', libelle: 'Expirée' }, { valeur: 'archivee', libelle: 'Archivée' }
            ] },
            { cle: 'description', libelle: 'Description', type: 'zone', valeur: p.description },
            { cle: 'raison', libelle: 'Motif de la modification', type: 'zone', lignes: 2 }
          ],
          soumettre: (v) => envoyer(`/super-admin/promotions/${p.id}`, 'PATCH', v, 'Promotion mise à jour.')
        });
      }));

      void offres;
    }
  });

  /* ======================================================================
     4. Offres spéciales
     ====================================================================== */

  SA.enregistrerVue('offres/speciales', {
    titre: 'Offres spéciales',
    sousTitre: 'Gestes commerciaux ponctuels, partenariats, lancements.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(6, 46);

      const [d, offres, ecoles] = await Promise.all([
        SA.api(SA.url('/super-admin/offres-speciales', { statut: params.statut })),
        SA.api('/super-admin/offres'),
        SA.api('/super-admin/ecoles?taille=200').catch(() => ({ donnees: [] }))
      ]);

      const listeEcoles = ecoles.donnees || ecoles.ecoles || [];

      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = '<button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="btn-nouvelle">Nouvelle offre spéciale</button>';
        const b = document.getElementById('btn-nouvelle');
        if (b) b.addEventListener('click', () => formulaire({
          titre: 'Nouvelle offre spéciale',
          champs: [
            { cle: 'nom', libelle: 'Nom', requis: true },
            { cle: 'type_offre', libelle: 'Type', type: 'liste', options: [
              { valeur: 'premier_mois_gratuit', libelle: 'Premier mois gratuit' },
              { valeur: 'mois_reduits', libelle: 'Mois à tarif réduit' },
              { valeur: 'reduction_annuelle', libelle: 'Réduction sur engagement annuel' },
              { valeur: 'lancement', libelle: 'Offre de lancement' },
              { valeur: 'ecole_specifique', libelle: 'Geste pour une école' },
              { valeur: 'partenaire', libelle: 'Partenariat' },
              { valeur: 'exceptionnelle', libelle: 'Exceptionnelle' },
              { valeur: 'autre', libelle: 'Autre' }
            ] },
            { cle: 'valeur', libelle: 'Valeur', type: 'nombre', min: 0 },
            { cle: 'unite', libelle: 'Unité', longueurMax: 24, exemple: '%, USD, mois…' },
            { cle: 'duree_mois', libelle: 'Durée (mois)', type: 'nombre', pas: '1', min: 1 },
            { cle: 'plan_id', libelle: 'Offre concernée', type: 'liste',
              options: options(offres.offres, 'id', 'nom', 'Toutes les offres') },
            { cle: 'ecole_id', libelle: 'École concernée', type: 'liste',
              options: options(listeEcoles, 'id', 'nom', 'Toutes les écoles') },
            { cle: 'date_debut', libelle: 'Début', type: 'date' },
            { cle: 'date_fin', libelle: 'Fin', type: 'date' },
            { cle: 'description', libelle: 'Description', type: 'zone' }
          ],
          libelleValider: 'Créer',
          soumettre: (v) => envoyer('/super-admin/offres-speciales', 'POST', v, 'Offre spéciale créée.')
        }));
      }

      const colonnes = [
        { cle: 'nom', titre: 'Offre spéciale', rendu: (l) => `${esc(l.nom)}${l.description ? `<div class="sa-muet">${esc(l.description)}</div>` : ''}` },
        { cle: 'type_offre', titre: 'Type', rendu: (l) => ui.badge(String(l.type_offre).replace(/_/g, ' '), 'info') },
        { cle: 'valeur', titre: 'Valeur', classe: 'sa-num',
          rendu: (l) => l.valeur === null ? '<span class="sa-muet">—</span>' : `${fmt.decimal(l.valeur, 2)} ${esc(l.unite || '')}` },
        { cle: 'cible', titre: 'Portée', rendu: (l) => l.ecole_nom ? esc(l.ecole_nom) : (l.plan_nom ? esc(l.plan_nom) : '<span class="sa-muet">générale</span>') },
        { cle: 'periode', titre: 'Période', rendu: (l) => `${l.date_debut ? esc(fmt.date(l.date_debut)) : '…'} → ${l.date_fin ? esc(fmt.date(l.date_fin)) : '…'}` },
        { cle: 'statut', titre: 'Statut', rendu: (l) => l.echue && l.statut === 'active' ? ui.badge('échue', 'attention') : ui.badgeStatut(l.statut === 'active' ? 'actif' : l.statut) },
        { cle: 'actions', titre: '', rendu: (l) => `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-speciale="${esc(l.id)}">Modifier</button>` }
      ];

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-barre-filtres">
            <label class="sa-champ-bloc"><span>Statut</span>
              <select class="sa-champ" id="filtre-statut">
                <option value="">Tous</option>
                ${['active', 'inactive', 'expiree', 'archivee'].map((s) => `<option value="${s}" ${params.statut === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select></label>
          </div>
          ${ui.tableau({ colonnes, lignes: d.donnees, vide: 'Aucune offre spéciale' })}
        </section>`;

      const sel = document.getElementById('filtre-statut');
      if (sel) sel.addEventListener('change', () => SA.majParams({ statut: sel.value || undefined }) || SA.rafraichirVue());

      conteneur.querySelectorAll('[data-speciale]').forEach((b) => b.addEventListener('click', () => {
        const o = (d.donnees || []).find((x) => String(x.id) === String(b.dataset.speciale));
        formulaire({
          titre: `Modifier « ${o.nom} »`, large: false,
          champs: [
            { cle: 'nom', libelle: 'Nom', valeur: o.nom, requis: true },
            { cle: 'date_fin', libelle: 'Fin', type: 'date', valeur: o.date_fin ? String(o.date_fin).slice(0, 10) : '' },
            { cle: 'statut', libelle: 'Statut', type: 'liste', valeur: o.statut, options: [
              { valeur: 'active', libelle: 'Active' }, { valeur: 'inactive', libelle: 'Inactive' },
              { valeur: 'expiree', libelle: 'Expirée' }, { valeur: 'archivee', libelle: 'Archivée' }
            ] },
            { cle: 'raison', libelle: 'Motif', type: 'zone', lignes: 2 }
          ],
          soumettre: (v) => envoyer(`/super-admin/offres-speciales/${o.id}`, 'PATCH', v, 'Offre spéciale mise à jour.')
        });
      }));
    }
  });

  /* ======================================================================
     5. Tarifs personnalisés
     ====================================================================== */

  SA.enregistrerVue('offres/tarifs', {
    titre: 'Tarifs négociés',
    sousTitre: 'Prix accordés école par école, avec leur motif.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(6, 46);

      const [d, ecoles] = await Promise.all([
        SA.api(SA.url('/super-admin/tarifs-personnalises', { statut: params.statut || 'actif' })),
        SA.api('/super-admin/ecoles?taille=200').catch(() => ({ donnees: [] }))
      ]);
      const listeEcoles = ecoles.donnees || ecoles.ecoles || [];

      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = '<button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="btn-nouveau">Accorder un tarif</button>';
        const b = document.getElementById('btn-nouveau');
        if (b) b.addEventListener('click', () => formulaire({
          titre: 'Accorder un tarif négocié',
          sousTitre: "Le prix catalogue est relu en base au moment de l'enregistrement : "
                   + "la remise affichée sera toujours calculée sur le prix en vigueur.",
          large: false,
          champs: [
            { cle: 'ecole_id', libelle: 'École', type: 'liste', requis: true,
              options: options(listeEcoles, 'id', 'nom', 'Choisir une école…') },
            { cle: 'prix_personnalise', libelle: 'Prix accordé', type: 'nombre', min: 0, requis: true },
            { cle: 'periodicite', libelle: 'Périodicité', type: 'liste', options: [
              { valeur: 'mensuel', libelle: 'Mensuel' }, { valeur: 'trimestriel', libelle: 'Trimestriel' },
              { valeur: 'annuel', libelle: 'Annuel' }
            ] },
            { cle: 'date_debut', libelle: 'À partir du', type: 'date', valeur: new Date().toISOString().slice(0, 10) },
            { cle: 'date_fin', libelle: 'Jusqu\'au (facultatif)', type: 'date' },
            { cle: 'raison', libelle: 'Motif', type: 'zone', requis: true, lignes: 2,
              aide: 'Obligatoire. Un tarif négocié sans motif devient inexplicable au bout de six mois.' }
          ],
          libelleValider: 'Accorder',
          soumettre: (v) => envoyer('/super-admin/tarifs-personnalises', 'POST',
            Object.assign({ confirmation: true }, v), 'Tarif négocié appliqué.')
        }));
      }

      const colonnes = [
        { cle: 'ecole_nom', titre: 'École', rendu: (l) => `${esc(l.ecole_nom)}<div class="sa-muet sa-mono">${esc(l.ecole_code || '')}</div>` },
        { cle: 'plan_nom', titre: 'Offre', rendu: (l) => esc(l.plan_nom || '—') },
        { cle: 'prix_catalogue', titre: 'Prix catalogue', classe: 'sa-num',
          rendu: (l) => l.prix_catalogue === null ? '<span class="sa-muet">—</span>' : `${fmt.decimal(l.prix_catalogue, 2)} ${esc(l.devise || '')}` },
        { cle: 'prix_personnalise', titre: 'Prix accordé', classe: 'sa-num',
          rendu: (l) => `<strong>${fmt.decimal(l.prix_personnalise, 2)} ${esc(l.devise || '')}</strong>` },
        { cle: 'remise', titre: 'Remise', classe: 'sa-num', rendu: (l) => l.remise_pourcentage === null
          ? '<span class="sa-muet">—</span>'
          : `<span class="sa-negatif">−${fmt.decimal(l.remise_montant, 2)} (${fmt.decimal(l.remise_pourcentage, 1)} %)</span>` },
        { cle: 'raison', titre: 'Motif', rendu: (l) => esc(l.raison) },
        { cle: 'date_debut', titre: 'Depuis', rendu: (l) => esc(fmt.date(l.date_debut)) },
        { cle: 'accorde_par_nom', titre: 'Par', rendu: (l) => esc(l.accorde_par_nom || '—') },
        { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) },
        { cle: 'actions', titre: '', rendu: (l) => l.statut === 'actif'
          ? `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-terminer="${esc(l.id)}" data-ecole="${esc(l.ecole_nom)}">Terminer</button>`
          : '' }
      ];

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-barre-filtres">
            <label class="sa-champ-bloc"><span>Statut</span>
              <select class="sa-champ" id="filtre-statut">
                ${[['actif', 'Actifs'], ['termine', 'Terminés'], ['annule', 'Annulés'], ['', 'Tous']].map(([v, l]) =>
                  `<option value="${v}" ${(params.statut || 'actif') === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select></label>
          </div>
          ${ui.tableau({ colonnes, lignes: d.donnees, vide: 'Aucun tarif négocié' })}
          <p class="sa-note">
            Une école ne peut avoir qu'un seul tarif négocié actif à la fois. En accorder un nouveau termine
            automatiquement le précédent, qui reste consultable.
          </p>
        </section>`;

      const sel = document.getElementById('filtre-statut');
      if (sel) sel.addEventListener('change', () => SA.majParams({ statut: sel.value || undefined }) || SA.rafraichirVue());

      conteneur.querySelectorAll('[data-terminer]').forEach((b) => b.addEventListener('click', () => {
        formulaire({
          titre: 'Terminer le tarif négocié', large: false,
          sousTitre: `${b.dataset.ecole} reviendra au prix catalogue à son prochain renouvellement.`,
          champs: [{ cle: 'raison', libelle: 'Motif', type: 'zone', lignes: 2, requis: true }],
          libelleValider: 'Terminer', danger: true,
          soumettre: (v) => envoyer(`/super-admin/tarifs-personnalises/${b.dataset.terminer}/terminer`, 'POST', v, 'Tarif terminé.')
        });
      }));
    }
  });

  /* ======================================================================
     6. Abonnements clients
     ====================================================================== */

  SA.enregistrerVue('offres/abonnements', {
    titre: 'Abonnements clients',
    sousTitre: 'Prix catalogue, prix réellement payé, et l\'écart entre les deux.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(10, 46);

      const [d, offres] = await Promise.all([
        SA.api(SA.url('/super-admin/abonnements-detail', {
          page: params.page, statut: params.statut, plan_id: params.plan_id,
          recherche: params.recherche, avec_remise: params.avec_remise
        })),
        SA.api('/super-admin/offres')
      ]);

      const s = d.synthese || {};
      if (FIN.devise) FIN.devise(s.devise_reference);

      const colonnes = [
        { cle: 'ecole_nom', titre: 'École', rendu: (l) => `${esc(l.ecole_nom)}<div class="sa-muet sa-mono">${esc(l.ecole_code || '')}</div>` },
        { cle: 'plan_nom', titre: 'Offre', rendu: (l) => esc(l.plan_nom || '—') },
        { cle: 'nb_eleves', titre: 'Élèves', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb_eleves) },
        { cle: 'prix_catalogue_mensuel', titre: 'Prix catalogue', classe: 'sa-num', rendu: (l) => argent(l.prix_catalogue_mensuel) },
        { cle: 'prix_paye_mensuel', titre: 'Prix payé', classe: 'sa-num', rendu: (l) => `<strong>${argent(l.prix_paye_mensuel)}</strong>` },
        { cle: 'remise_mensuelle', titre: 'Remise', classe: 'sa-num', rendu: (l) => Number(l.remise_mensuelle)
          ? `<span class="sa-negatif">−${fmt.decimal(l.remise_mensuelle, 2)} (${fmt.decimal(l.remise_pourcentage, 1)} %)</span>`
          : '<span class="sa-muet">—</span>' },
        { cle: 'revenu_cumule', titre: 'Encaissé', classe: 'sa-num', rendu: (l) => argent(l.revenu_cumule) },
        { cle: 'dernier_paiement', titre: 'Dernier paiement', rendu: (l) => l.dernier_paiement ? esc(fmt.date(l.dernier_paiement)) : '<span class="sa-muet">aucun</span>' },
        { cle: 'date_expiration', titre: 'Échéance', rendu: (l) => {
          if (!l.date_expiration) return '<span class="sa-muet">—</span>';
          const j = Number(l.jours_restants);
          const ton = j < 0 ? 'sa-negatif' : j <= 14 ? 'sa-attention-texte' : '';
          return `<span class="${ton}">${esc(fmt.date(l.date_expiration))}</span>
                  <div class="sa-muet">${j < 0 ? `échu depuis ${Math.abs(j)} j` : `dans ${j} j`}</div>`;
        } },
        { cle: 'statut', titre: 'Statut', rendu: (l) => `${ui.badgeStatut(l.statut)}${l.en_periode_essai ? ' ' + ui.badge('essai', 'info') : ''}` }
      ];

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-grille-stats">
            ${ui.carteStat({ valeur: argent(s.mrr_catalogue), etiquette: 'MRR au prix catalogue', icone: '📋' })}
            ${ui.carteStat({ valeur: argent(s.mrr_reel), etiquette: 'MRR réellement facturé', ton: 'info', icone: '🔁' })}
            ${ui.carteStat({ valeur: argent(s.remises_mensuelles), etiquette: 'Remises accordées', ton: Number(s.remises_mensuelles) ? 'attention' : null, icone: '🏷️' })}
            ${ui.carteStat({ valeur: pourcent(s.taux_remise), etiquette: 'Taux de remise', icone: '%' })}
          </div>
          <p class="sa-note">${esc(s.note_page || '')}</p>
        </section>

        <section class="sa-section">
          <div class="sa-barre-filtres">
            <label class="sa-champ-bloc"><span>Recherche</span>
              <input class="sa-champ" id="filtre-recherche" value="${esc(params.recherche || '')}" placeholder="Nom ou code d'école" /></label>
            <label class="sa-champ-bloc"><span>Offre</span>
              <select class="sa-champ" id="filtre-plan">
                <option value="">Toutes</option>
                ${(offres.offres || []).map((o) => `<option value="${esc(o.id)}" ${params.plan_id === String(o.id) ? 'selected' : ''}>${esc(o.nom)}</option>`).join('')}
              </select></label>
            <label class="sa-champ-bloc"><span>Statut</span>
              <select class="sa-champ" id="filtre-statut">
                <option value="">Tous</option>
                ${['actif', 'expire', 'suspendu', 'annule'].map((v) => `<option value="${v}" ${params.statut === v ? 'selected' : ''}>${v}</option>`).join('')}
              </select></label>
            <label class="sa-champ-inline" style="align-self:flex-end">
              <input type="checkbox" id="filtre-remise" ${params.avec_remise === 'oui' ? 'checked' : ''} />
              <span>Seulement les remises</span></label>
          </div>
          ${ui.tableau({ colonnes, lignes: d.donnees, vide: 'Aucun abonnement' })}
          ${ui.pagination(d.pagination)}
        </section>`;

      const majEtRendre = (p) => { SA.majParams(p); SA.rafraichirVue(); };

      ['plan', 'statut'].forEach((cle) => {
        const el = document.getElementById(`filtre-${cle}`);
        if (el) el.addEventListener('change', () => majEtRendre({
          [cle === 'plan' ? 'plan_id' : 'statut']: el.value || undefined, page: 1
        }));
      });

      const rech = document.getElementById('filtre-recherche');
      if (rech) rech.addEventListener('input', SA.antiRebond(() => majEtRendre({ recherche: rech.value || undefined, page: 1 }), 380));

      const rem = document.getElementById('filtre-remise');
      if (rem) rem.addEventListener('change', () => majEtRendre({ avec_remise: rem.checked ? 'oui' : undefined, page: 1 }));

      conteneur.querySelectorAll('[data-page]').forEach((b) =>
        b.addEventListener('click', () => majEtRendre({ page: b.dataset.page })));
    }
  });

  /* Partagé avec le module « coûts », chargé après celui-ci. */
  SA.finance = Object.assign(SA.finance || {}, { formulaire, envoyer, options, champHtml });
})();
