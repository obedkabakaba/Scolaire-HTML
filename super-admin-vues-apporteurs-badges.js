/* ==========================================================================
   Ardoise — Super Admin : badges, formations, missions, campagnes
   --------------------------------------------------------------------------
   · Demandes de badge et formations : tarifs (annoncés automatiquement aux
     partenaires à chaque changement), demandes reçues par la messagerie,
     frais réglés, sessions, formation tenue → qualification sur la fiche.
   · Missions : installations et formations commandées par les écoles,
     confiées aux configurateurs et formateurs qualifiés.
   · Campagnes et présomptions : annonces des partenaires stratégiques et
     écoles inscrites sans code qui les ont (ou non) confirmées.

   Chaque décision qui concerne un partenaire lui est expliquée par un
   message préparé, côté serveur : l'écran n'a rien à rédiger.

   Dépend de super-admin-vues-offres.js (SA.finance.formulaire, envoyer) et
   de super-admin-vues-apporteurs.js, chargés avant ce fichier.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui } = SA;
  const BASE = '/super-admin/apporteurs';
  const F = () => SA.finance;

  const BADGES = {
    apporteur_affaires: { libelle: "Apporteur d'affaires", icone: '🤝' },
    configurateur: { libelle: 'Configurateur', icone: '🛠' },
    formateur: { libelle: 'Formateur', icone: '🎓' },
    partenaire_strategique: { libelle: 'Partenaire stratégique', icone: '🏛' }
  };
  const LIBELLES = {
    demandee: 'Demande reçue', frais_regles: 'Frais réglés', formation_planifiee: 'Formation planifiée', qualifiee: 'Qualifiée',
    refusee: 'Refusée', annulee: 'Annulée', planifiee: 'Planifiée', tenue: 'Tenue',
    ouverte: 'Ouverte', attribuee: 'Attribuée', realisee: 'Compte rendu reçu', cloturee: 'Clôturée',
    candidat: 'Candidat', retenu: 'Retenu', non_retenu: 'Non retenu', desiste: 'Désisté',
    proposee: 'Proposée', active: 'Active', close: 'Close', rejetee: 'Refusée',
    a_confirmer: 'À confirmer', confirmee: 'Confirmée', infirmee: 'Infirmée', expiree: 'Sans réponse', ecartee: 'Écartée',
    actif: 'Actif', en_qualification: 'En qualification', suspendu: 'Suspendu', retire: 'Retiré'
  };
  const TONS = {
    demandee: 'attention', frais_regles: 'info', formation_planifiee: 'info', qualifiee: 'succes', refusee: 'neutre',
    planifiee: 'info', tenue: 'succes', annulee: 'neutre', ouverte: 'attention', attribuee: 'info', realisee: 'attention',
    cloturee: 'succes', candidat: 'attention', retenu: 'succes', proposee: 'attention', active: 'succes', close: 'neutre',
    a_confirmer: 'attention', confirmee: 'succes', infirmee: 'neutre', expiree: 'attention', ecartee: 'neutre',
    actif: 'succes', en_qualification: 'attention', suspendu: 'danger', retire: 'neutre'
  };
  const CANAUX = {
    communique_officiel: 'Communiqué officiel', reseaux_sociaux: 'Réseaux sociaux', radio_tv: 'Radio / TV',
    evenement: 'Événement', presse: 'Presse', autre: 'Autre'
  };
  const SERVICES = { campagne_capture: 'Campagne de capture', installation: 'Installation', formation_express: 'Formation express', formation_complete: 'Formation complète', formation_personnalisee: 'Formation personnalisée' };

  const statut = (s) => ui.badge(LIBELLES[s] || String(s || '—').replace(/_/g, ' '), TONS[s] || 'neutre');
  const nomComplet = (p, n) => [p, n].filter(Boolean).join(' ');
  const badge = (b) => `${(BADGES[b] || {}).icone || ''} ${esc((BADGES[b] || {}).libelle || b)}`;

  function actionsEntete(html) {
    const zone = document.getElementById('sa-entete-actions');
    if (zone) zone.innerHTML = html;
    return zone;
  }

  function onglets(liste, courant) {
    return `<div class="sa-onglets">${liste.map(([cle, libelle]) =>
      `<button class="sa-onglet ${cle === courant ? 'actif' : ''}" data-onglet="${cle}">${esc(libelle)}</button>`).join('')}</div>`;
  }

  /** Demande un motif ou une note ; résout null si l'on annule. */
  function saisir({ titre, sousTitre, libelle, libelleValider, danger, champsSup = [], requis = true }) {
    return new Promise((resoudre) => {
      let fini = false;
      const voile = F().formulaire({
        titre, sousTitre, large: false, danger, libelleValider: libelleValider || 'Confirmer',
        champs: [...champsSup, ...(libelle ? [{ cle: 'motif', libelle, type: 'zone', lignes: 3, requis }] : [])],
        soumettre: async (v) => { fini = true; resoudre(v); }
      });
      const observer = new MutationObserver(() => {
        if (!document.body.contains(voile)) { observer.disconnect(); if (!fini) resoudre(null); }
      });
      observer.observe(document.body, { childList: true });
    });
  }

  async function agir(chemin, corps, message) {
    try {
      const r = await SA.api(chemin, { method: 'POST', body: JSON.stringify(corps || {}) });
      SA.toast(message || (r && r.message) || 'Enregistré.', 'succes');
      SA.rafraichirVue();
      return r;
    } catch (e) { SA.toast(e.message || 'Opération impossible.', 'danger'); return null; }
  }

  /* ======================================================================
     TARIF D'UNE FORMATION — aperçu du message préparé, puis confirmation
     ====================================================================== */

  function modaleTarif(f) {
    F().formulaire({
      titre: `Tarif — ${f.libelle}`,
      sousTitre: 'Montant affiché aux partenaires dans leur espace (jamais sur le site public). Un changement publie automatiquement une annonce et l’envoie par e-mail à tous les partenaires et à l’équipe.',
      large: false, danger: true, libelleValider: 'Voir le message et confirmer',
      champs: [
        { cle: 'montant', libelle: 'Montant (vide = à définir)', type: 'nombre', min: 0, valeur: f.montant },
        { cle: 'devise', libelle: 'Devise', type: 'liste', valeur: f.devise || 'USD', options: [{ valeur: 'USD', libelle: 'USD ($)' }, { valeur: 'CDF', libelle: 'CDF (FC)' }] },
        { cle: 'contenu', libelle: 'Contenu de la formation (affiché aux partenaires)', type: 'zone', lignes: 3, valeur: f.contenu },
        { cle: 'note', libelle: 'Note ajoutée à l’annonce (facultatif)', type: 'zone', lignes: 2 }
      ],
      soumettre: async (v) => {
        const apercu = await SA.api(`${BASE}/formations/${f.badge}/apercu`, { method: 'POST', body: JSON.stringify(v) });
        const ok = await new Promise((resoudre) => {
          const m = SA.modale({
            titre: 'Message qui sera envoyé',
            sousTitre: `Salon « Annonces » de l’espace partenaire + e-mail à ${apercu.destinataires} partenaire(s) et à l’équipe. Seulement si le montant change.`,
            contenu: `<div class="ab-apercu">${esc(apercu.annonce)}</div>`,
            actions: `<button class="sa-bouton sa-bouton-secondaire" data-role="non">Modifier</button>
                      <button class="sa-bouton sa-bouton-principal" data-role="oui">Enregistrer et envoyer</button>`
          });
          m.querySelector('[data-role="non"]').addEventListener('click', () => { m.fermer(); resoudre(false); });
          m.querySelector('[data-role="oui"]').addEventListener('click', () => { m.fermer(); resoudre(true); });
          m.querySelector('.sa-fermer').addEventListener('click', () => resoudre(false));
        });
        if (!ok) throw new Error('Rien n’a été envoyé : ajustez puis validez de nouveau.');
        await F().envoyer(`${BASE}/formations/${f.badge}`, 'PUT', { ...v, confirmation: true });
      }
    });
  }

  function panneauFormations(formations) {
    return `<div class="sa-panneau">
      <h2 class="sa-section-titre">Formations de qualification <span class="sa-annexe">visibles des seuls partenaires connectés</span></h2>
      ${Object.values(formations).map((f) => `<div class="ab-formation">
        <div><strong>${badge(f.badge)} — ${esc(f.libelle)}</strong>
          <div class="sa-muet">${esc(f.contenu || '')}</div>
          <div class="sa-muet">Modifié ${esc(fmt.date(f.updated_at))}</div></div>
        <div class="ab-formation-prix">${f.montant === null ? '<span class="sa-attention-texte">À définir</span>' : esc(f.montant_texte)}</div>
        <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-tarif="${esc(f.badge)}">Modifier</button>
      </div>`).join('')}
      <p class="sa-note">Une demande de badge garde le montant en vigueur le jour où elle a été envoyée.</p>
    </div>`;
  }

  function brancherFormations(conteneur, formations) {
    conteneur.querySelectorAll('[data-tarif]').forEach((b) => b.addEventListener('click', () => modaleTarif(formations[b.dataset.tarif])));
  }

  // Exposé pour la vue « Programme et barèmes ».
  SA.apporteursFormations = { panneauFormations, brancherFormations };

  /* ======================================================================
     1. DEMANDES DE BADGE ET FORMATIONS
     ====================================================================== */

  SA.enregistrerVue('apporteurs/badges', {
    titre: 'Demandes de badge et formations',
    sousTitre: 'Les demandes envoyées depuis la messagerie des partenaires, les sessions de formation et leurs tarifs.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(6, 46);
      const onglet = params.onglet || 'demandes';
      const [demandes, sessions, formations] = await Promise.all([
        SA.api(SA.url(`${BASE}/demandes-badges`, { statut: params.statut || 'ouvertes' })),
        SA.api(`${BASE}/sessions`),
        SA.api(`${BASE}/formations`)
      ]);
      const zone = actionsEntete('<button class="sa-bouton sa-bouton-principal" data-session>Nouvelle session</button>');
      zone.querySelector('[data-session]').addEventListener('click', () => formulaireSession());
      const planifiees = sessions.donnees.filter((s) => s.statut === 'planifiee');
      const ouvertes = demandes.compteurs.filter((c) => ['demandee', 'frais_regles', 'formation_planifiee'].includes(c.statut)).reduce((n, c) => n + c.n, 0);

      const tableaux = {
        demandes: () => `
          <div class="sa-filtres">${[['ouvertes', 'En cours'], ['qualifiee', 'Qualifiées'], ['refusee', 'Refusées'], ['toutes', 'Toutes']].map(([k, l]) =>
            `<button class="sa-bouton sa-bouton-petit ${(params.statut || 'ouvertes') === k ? 'sa-bouton-principal' : 'sa-bouton-secondaire'}" data-statut="${k}">${esc(l)}</button>`).join('')}</div>
          ${ui.tableau({
            lignes: demandes.donnees, vide: 'Aucune demande',
            colonnes: [
              { cle: 'created_at', titre: 'Reçue', rendu: (l) => `${esc(fmt.date(l.created_at))}<div class="sa-muet">${esc(fmt.relatif(l.created_at))}</div>` },
              { cle: 'apporteur', titre: 'Partenaire', rendu: (l) => `<a href="#/apporteurs/profils/fiche/${esc(l.apporteur_id)}"><strong>${esc(nomComplet(l.prenom, l.nom))}</strong></a>
                  <div class="sa-muet">${esc([l.ville, l.province].filter(Boolean).join(', '))}${l.telephone ? ` · <span class="sa-mono">${esc(l.telephone)}</span>` : ''}</div>` },
              { cle: 'badge', titre: 'Badge', rendu: (l) => badge(l.badge) },
              { cle: 'frais', titre: 'Frais (figés)', rendu: (l) => l.badge === 'partenaire_strategique' ? '<span class="sa-muet">aucun</span>'
                  : `${l.frais_montant === null ? '<span class="sa-attention-texte">à définir</span>' : esc(fmt.montant(l.frais_montant, l.frais_devise))}${l.frais_reference ? `<div class="sa-muet sa-mono">${esc(l.frais_reference)}</div>` : ''}` },
              { cle: 'session', titre: 'Session', rendu: (l) => l.session_debut ? `${esc(fmt.dateHeure(l.session_debut))}<div class="sa-muet">${esc(l.session_lieu || '')}</div>` : '' },
              { cle: 'statut', titre: 'Étape', rendu: (l) => `${statut(l.statut)}${l.badge_statut ? `<div class="sa-muet">badge : ${esc(LIBELLES[l.badge_statut] || l.badge_statut)}</div>` : ''}` },
              { cle: 'act', titre: '', rendu: (l) => actionsDemande(l) }
            ]
          })}`,
        sessions: () => ui.tableau({
          lignes: sessions.donnees, vide: 'Aucune session : créez-en une, puis inscrivez-y les demandes.',
          colonnes: [
            { cle: 'debut', titre: 'Date', rendu: (l) => `<strong>${esc(fmt.dateHeure(l.debut))}</strong><div class="sa-muet">${Math.round(l.duree_minutes / 6) / 10} h</div>` },
            { cle: 'badge', titre: 'Formation', rendu: (l) => badge(l.badge) },
            { cle: 'lieu', titre: 'Lieu', rendu: (l) => `${esc(l.lieu || '')}${l.lien_visio ? `<div class="sa-muet">${esc(l.lien_visio)}</div>` : ''}` },
            { cle: 'participants', titre: 'Participants', rendu: (l) => `${l.participants.length}${l.capacite ? ` / ${l.capacite}` : ''}
                <div class="sa-muet">${l.participants.map((p) => esc(nomComplet(p.prenom, p.nom))).join(', ')}</div>` },
            { cle: 'statut', titre: 'Statut', rendu: (l) => statut(l.statut) },
            { cle: 'act', titre: '', rendu: (l) => l.statut === 'planifiee' ? `<div class="ab-actions">
                ${new Date(l.debut).getTime() <= Date.now() ? `<button class="sa-bouton sa-bouton-principal sa-bouton-petit" data-action="tenue" data-id="${esc(l.id)}">Marquer tenue</button>` : ''}
                <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-action="annuler-session" data-id="${esc(l.id)}">Annuler</button></div>`
              : (l.statut === 'tenue' ? l.participants.filter((p) => p.badge_statut !== 'actif').map((p) =>
                `<a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="#/apporteurs/profils/fiche/${esc(p.apporteur_id)}">Qualifier ${esc(p.prenom || p.nom)}</a>`).join(' ') : '') }
          ]
        }),
        tarifs: () => panneauFormations(formations.formations)
      };

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-encart">Le partenaire demande un badge depuis « Mes badges » : un message préparé part dans sa conversation avec l’équipe et la demande apparaît ici, avec les frais <strong>figés au tarif du jour</strong>. Chaque étape lui est annoncée automatiquement. La qualification se valide ensuite sur sa fiche (preuve obligatoire) : les sections du badge s’ouvrent alors dans son espace.</div>
          ${onglets([['demandes', `Demandes (${ouvertes} en cours)`], ['sessions', `Sessions (${planifiees.length} planifiée(s))`], ['tarifs', 'Tarifs des formations']], onglet)}
          ${tableaux[onglet] ? tableaux[onglet]() : tableaux.demandes()}
        </section>`;

      conteneur.querySelectorAll('[data-onglet]').forEach((b) => b.addEventListener('click', () => { SA.majParams({ onglet: b.dataset.onglet }); SA.rafraichirVue(); }));
      conteneur.querySelectorAll('[data-statut]').forEach((b) => b.addEventListener('click', () => { SA.majParams({ onglet: 'demandes', statut: b.dataset.statut }); SA.rafraichirVue(); }));
      brancherFormations(conteneur, formations.formations);

      conteneur.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        const d = demandes.donnees.find((x) => x.id === id);
        switch (b.dataset.action) {
          case 'frais': {
            const v = await saisir({
              titre: 'Frais de formation réglés', libelleValider: 'Enregistrer',
              sousTitre: d.frais_montant === null ? 'Demande faite avant que le tarif soit fixé : indiquez le montant réglé.' : `Montant figé à la demande : ${fmt.montant(d.frais_montant, d.frais_devise)}.`,
              champsSup: [
                { cle: 'reference', libelle: 'Référence du paiement (reçu, transaction Mobile Money…)', requis: true },
                ...(d.frais_montant === null ? [{ cle: 'montant', libelle: 'Montant réglé', type: 'nombre', min: 0, requis: true },
                  { cle: 'devise', libelle: 'Devise', type: 'liste', valeur: 'USD', options: ['USD', 'CDF'] }] : [])
              ]
            });
            if (v) await agir(`${BASE}/demandes-badges/${id}/frais`, v);
            break;
          }
          case 'session': {
            const possibles = planifiees.filter((s) => s.badge === d.badge);
            if (!possibles.length) { SA.toast('Aucune session planifiée pour ce badge : créez-en une d’abord.', 'danger'); formulaireSession(d.badge); return; }
            const v = await saisir({
              titre: `Inscrire ${nomComplet(d.prenom, d.nom)}`, libelleValider: 'Inscrire et prévenir',
              champsSup: [{ cle: 'session_id', libelle: 'Session', type: 'liste', requis: true,
                options: possibles.map((s) => ({ valeur: s.id, libelle: `${fmt.dateHeure(s.debut)} — ${s.lieu || 'visio'} (${s.participants.length}${s.capacite ? `/${s.capacite}` : ''})` })) }]
            });
            if (v) await agir(`${BASE}/demandes-badges/${id}/session`, v);
            break;
          }
          case 'refuser': {
            const v = await saisir({ titre: 'Refuser la demande', libelle: 'Motif (communiqué au partenaire)', libelleValider: 'Refuser', danger: true });
            if (v) await agir(`${BASE}/demandes-badges/${id}/refuser`, v);
            break;
          }
          case 'conversation':
            SA.naviguer('apporteurs/messagerie', { c: d.conversation_id });
            break;
          case 'tenue':
            if (await SA.confirmer({ titre: 'Session tenue', message: 'Les participants sont prévenus ; leur qualification se valide ensuite sur leur fiche.' })) {
              await agir(`${BASE}/sessions/${id}/tenue`, {});
            }
            break;
          case 'annuler-session': {
            const v = await saisir({ titre: 'Annuler la session', libelle: 'Motif (communiqué aux inscrits)', libelleValider: 'Annuler la session', danger: true });
            if (v) await agir(`${BASE}/sessions/${id}/annuler`, v);
            break;
          }
          default:
        }
      }));
    }
  });

  function actionsDemande(l) {
    const b = (action, libelle, principal) => `<button class="sa-bouton ${principal ? 'sa-bouton-principal' : 'sa-bouton-secondaire'} sa-bouton-petit" data-action="${action}" data-id="${esc(l.id)}">${esc(libelle)}</button>`;
    if (!['demandee', 'frais_regles', 'formation_planifiee'].includes(l.statut)) return l.motif ? `<span class="sa-muet">${esc(l.motif)}</span>` : '';
    const formation = l.badge !== 'partenaire_strategique';
    return `<div class="ab-actions">
      ${formation && l.statut === 'demandee' ? b('frais', 'Frais réglés', true) : ''}
      ${formation && (l.statut === 'frais_regles' || (l.statut === 'demandee' && !(Number(l.frais_montant) > 0))) ? b('session', 'Inscrire à une session', true) : ''}
      ${formation && l.statut === 'formation_planifiee' ? b('session', 'Changer de session') : ''}
      ${!formation ? `<a class="sa-bouton sa-bouton-principal sa-bouton-petit" href="#/apporteurs/profils/fiche/${esc(l.apporteur_id)}">Activer sur la fiche</a>` : ''}
      ${b('conversation', 'Conversation')}
      ${b('refuser', 'Refuser')}</div>`;
  }

  function formulaireSession(badgeDefaut) {
    F().formulaire({
      titre: 'Nouvelle session de formation', large: false, libelleValider: 'Créer la session',
      sousTitre: 'Inscrivez-y ensuite les demandes : chaque inscrit reçoit la date, le lieu ou le lien par message.',
      champs: [
        { cle: 'badge', libelle: 'Formation', type: 'liste', requis: true, valeur: badgeDefaut || 'configurateur',
          options: [{ valeur: 'configurateur', libelle: 'Configurateur' }, { valeur: 'formateur', libelle: 'Formateur' }] },
        { cle: 'jour', libelle: 'Date', type: 'date', requis: true },
        { cle: 'heure', libelle: 'Heure (Kinshasa)', requis: true, exemple: '09:00', valeur: '09:00' },
        { cle: 'duree_minutes', libelle: 'Durée (minutes)', type: 'nombre', pas: '15', min: 15, valeur: 180 },
        { cle: 'lieu', libelle: 'Lieu (ou laisser vide si en ligne)', exemple: 'Kinshasa, bureau Ardoise — Gombe' },
        { cle: 'lien_visio', libelle: 'Lien de visioconférence (facultatif)', exemple: 'https://…' },
        { cle: 'capacite', libelle: 'Places (facultatif)', type: 'nombre', pas: '1', min: 1 },
        { cle: 'note', libelle: 'À apporter, consignes (facultatif)', type: 'zone', lignes: 2 }
      ],
      soumettre: (v) => {
        if (!/^\d{1,2}:\d{2}$/.test(v.heure || '')) throw new Error('Heure attendue au format 09:00.');
        const [h, m] = v.heure.split(':');
        // Heure de Kinshasa (UTC+1), quelle que soit la machine du Super Admin.
        const debut = new Date(`${v.jour}T${h.padStart(2, '0')}:${m}:00+01:00`).toISOString();
        const corps = { ...v, debut };
        delete corps.jour; delete corps.heure;
        return F().envoyer(`${BASE}/sessions`, 'POST', corps, 'Session créée.');
      }
    });
  }

  /* ======================================================================
     2. MISSIONS
     ====================================================================== */

  SA.enregistrerVue('apporteurs/missions', {
    titre: 'Missions des partenaires',
    sousTitre: 'Installations, formations et campagnes de capture commandées par les écoles, confiées aux partenaires puis rémunérées comme prestations.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(6, 46);
      const d = await SA.api(SA.url(`${BASE}/missions`, { statut: params.statut, type: params.type }));
      const zone = actionsEntete('<button class="sa-bouton sa-bouton-secondaire" data-capture>Lancer une campagne de capture</button> <button class="sa-bouton sa-bouton-principal" data-nouvelle>Publier une mission</button>');
      zone.querySelector('[data-nouvelle]').addEventListener('click', () => formulaireMission());
      zone.querySelector('[data-capture]').addEventListener('click', () => formulaireCapture());
      const c = d.compteurs || {};
      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-filtres">${[['', 'Toutes'], ['ouverte', 'Ouvertes'], ['attribuee', 'Attribuées'], ['realisee', 'À clôturer'], ['cloturee', 'Clôturées'], ['annulee', 'Annulées']].map(([k, l]) =>
            `<button class="sa-bouton sa-bouton-petit ${(params.statut || '') === k ? 'sa-bouton-principal' : 'sa-bouton-secondaire'}" data-statut="${k}">${esc(l)}${k && c[k] ? ` <span class="sa-mono">${c[k]}</span>` : ''}</button>`).join('')}
            <span class="sa-muet" style="margin:0 6px">·</span>${[['', 'Tous types'], ['capture', 'Capture'], ['installation', 'Installation'], ['formation', 'Formation']].map(([k, l]) =>
            `<button class="sa-bouton sa-bouton-petit ${(params.type || '') === k ? 'sa-bouton-principal' : 'sa-bouton-secondaire'}" data-type="${k}">${esc(l)}</button>`).join('')}</div>
          ${ui.tableau({
            lignes: d.donnees, vide: 'Aucune mission',
            colonnes: [
              { cle: 'ecole', titre: 'École', rendu: (l) => `<strong>${esc(l.ecole_nom)}</strong><div class="sa-muet">${esc([l.ville, l.province].filter(Boolean).join(' · '))}</div>
                  ${l.contact_nom || l.contact_telephone ? `<div class="sa-muet">${esc([l.contact_nom, l.contact_telephone].filter(Boolean).join(' · '))}</div>` : ''}` },
              { cle: 'service', titre: 'Prestation', rendu: (l) => `${esc(SERVICES[l.service_code] || l.service_code)}${l.date_souhaitee ? `<div class="sa-muet">souhaitée le ${esc(fmt.date(l.date_souhaitee))}</div>` : ''}
                  ${l.type === 'capture' ? `<div class="sa-muet">≈ ${esc(l.effectif_estime || '?')} élèves · ${esc(l.places)} place(s)${l.adhesion_libre ? ' · adhésion libre' : ''}</div>
                    <div class="sa-muet">${l.acces_ouvert ? `🔓 accès jusqu’au ${esc(fmt.date(l.acces_expire_le))}` : '🔒 accès fermé'}</div>
                    ${l.bilan ? `<div class="sa-muet">${esc(l.bilan.eleves_photographies)} photo(s) · ${esc(l.bilan.eleves_crees)} élève(s) créé(s)</div>` : ''}` : ''}` },
              { cle: 'intervenants', titre: 'Partenaires', rendu: (l) => (l.prise_en_charge_equipe ? '<div>Équipe Ardoise</div>' : '') + (l.intervenants.length ? l.intervenants.map((i) =>
                  `<div>${esc(nomComplet(i.prenom, i.nom))} ${statut(i.statut)}${i.termine_le ? ' <span class="sa-muet">part terminée</span>' : ''}${i.badge_actif ? '' : ' <span class="sa-attention-texte">badge inactif</span>'}</div>`).join('') : (l.prise_en_charge_equipe ? '' : '<span class="sa-muet">Aucune proposition</span>')) },
              { cle: 'statut', titre: 'Statut', rendu: (l) => `${statut(l.statut)}${l.compte_rendu ? `<details class="sa-muet"><summary>Compte rendu</summary><div class="ab-apercu">${esc(l.compte_rendu)}</div>
                  <div>${Object.entries(l.checklist || {}).map(([k, v]) => `${v ? '✓' : '✗'} ${esc(k.replace(/_/g, ' '))}`).join('<br />')}</div></details>` : ''}` },
              { cle: 'act', titre: '', rendu: (l) => `<div class="ab-actions">
                  ${l.type === 'capture' ? `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-action="suivre" data-id="${esc(l.id)}">Suivre</button>` : ''}
                  ${l.type === 'capture' && l.acces_ouvert ? `<a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" style="text-decoration:none" href="capture.html?mission=${encodeURIComponent(l.id)}&mode=equipe">Ouvrir l’espace de capture</a>` : ''}
                  ${l.type === 'capture' && ['ouverte', 'attribuee'].includes(l.statut) ? `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-action="prolonger" data-id="${esc(l.id)}">Prolonger l’accès</button>` : ''}
                  ${['ouverte', 'attribuee'].includes(l.statut) ? `<button class="sa-bouton sa-bouton-principal sa-bouton-petit" data-action="retenir" data-id="${esc(l.id)}">${l.type === 'capture' ? 'Équipe' : 'Confier'}</button>` : ''}
                  ${l.statut === 'realisee' ? `<button class="sa-bouton sa-bouton-principal sa-bouton-petit" data-action="cloturer" data-id="${esc(l.id)}">Clôturer</button>` : ''}
                  ${!['cloturee', 'annulee'].includes(l.statut) ? `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-action="annuler" data-id="${esc(l.id)}">Annuler</button>` : ''}</div>` }
            ]
          })}
          <p class="sa-note">Une mission n’engage aucun montant : après la clôture, enregistrez la prestation (Rémunération → Prestations) pour rémunérer les intervenants. Un partenaire qui perd son badge est retiré automatiquement des missions non réalisées.</p>
        </section>`;
      conteneur.querySelectorAll('[data-statut]').forEach((b) => b.addEventListener('click', () => { SA.majParams({ statut: b.dataset.statut || undefined, type: params.type }); SA.rafraichirVue(); }));
      conteneur.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => { SA.majParams({ statut: params.statut, type: b.dataset.type || undefined }); SA.rafraichirVue(); }));
      conteneur.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const m = d.donnees.find((x) => x.id === b.dataset.id);
        if (b.dataset.action === 'retenir') { if (m.type === 'capture') modaleEquipeCapture(m); else modaleRetenir(m); }
        if (b.dataset.action === 'suivre') suivreCapture(m);
        if (b.dataset.action === 'prolonger') {
          const v = await saisir({ titre: 'Prolonger l’accès à la liste', sousTitre: 'Les partenaires en cours sont prévenus.', libelleValider: 'Prolonger',
            champsSup: [{ cle: 'jours', libelle: 'Jours d’accès à partir d’aujourd’hui', type: 'nombre', pas: '1', min: 1, max: 90, valeur: 7, requis: true }] });
          if (v) await agir(`${BASE}/missions/${m.id}/prolonger`, { jours: v.jours });
        }
        if (b.dataset.action === 'cloturer') {
          if (m.type === 'capture' && !window.confirm('Clôturer la campagne ? La commande de l’école passe « réalisée » et le bilan est figé.')) return;
          const r = await agir(`${BASE}/missions/${m.id}/cloturer`, {});
          if (r) SA.toast('Pensez à enregistrer la prestation pour rémunérer les intervenants.', 'info');
        }
        if (b.dataset.action === 'annuler') {
          const v = await saisir({ titre: 'Annuler la mission', libelle: 'Motif (communiqué aux partenaires concernés)', libelleValider: 'Annuler la mission', danger: true });
          if (v) await agir(`${BASE}/missions/${m.id}/annuler`, v);
        }
      }));
    }
  });

  function modaleRetenir(m) {
    const actifs = m.intervenants.filter((i) => i.badge_actif && ['candidat', 'retenu', 'non_retenu'].includes(i.statut));
    if (!actifs.length) { SA.toast('Aucun partenaire qualifié ne s’est encore proposé pour cette mission.', 'info'); return; }
    const voile = SA.modale({
      titre: `Confier : ${m.ecole_nom}`,
      sousTitre: `${m.places} place(s). Les partenaires retenus reçoivent le contact de l’école ; les autres sont prévenus poliment.`,
      contenu: `<div class="ab-choix">${actifs.map((i) => `<label class="ab-choix-ligne"><input type="checkbox" value="${esc(i.apporteur_id)}" ${i.statut === 'retenu' ? 'checked' : ''} />
        <span><strong>${esc(nomComplet(i.prenom, i.nom))}</strong> <span class="sa-muet">${esc(i.ville || '')}</span>${i.message ? `<br /><span class="sa-muet">« ${esc(i.message)} »</span>` : ''}</span></label>`).join('')}</div>`,
      actions: '<button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button><button class="sa-bouton sa-bouton-principal" data-role="valider">Confier la mission</button>'
    });
    voile.querySelector('[data-role="annuler"]').addEventListener('click', () => voile.fermer());
    voile.querySelector('[data-role="valider"]').addEventListener('click', async () => {
      const ids = [...voile.querySelectorAll('input:checked')].map((x) => x.value);
      if (!ids.length) { SA.toast('Choisissez au moins un partenaire.', 'danger'); return; }
      if (await agir(`${BASE}/missions/${m.id}/retenir`, { apporteur_ids: ids })) voile.fermer();
    });
  }

  async function formulaireMission(commandeId) {
    let commandes = [];
    try { commandes = (await SA.api(`${BASE}/missions/commandes`)).donnees || []; } catch (e) { /* saisie libre possible */ }
    const ecoles = (SA.referentiels && SA.referentiels.ecoles) || [];
    F().formulaire({
      titre: 'Publier une mission', large: true, libelleValider: 'Publier',
      sousTitre: 'Visible aussitôt des configurateurs (installation) ou formateurs (formation) actifs, sans le contact de l’école tant qu’elle n’est pas confiée.',
      champs: [
        { cle: 'commande_service_id', libelle: 'À partir d’une commande d’école (recommandé)', type: 'liste', valeur: commandeId || '',
          options: [{ valeur: '', libelle: commandes.length ? 'Choisir une commande…' : 'Aucune commande en attente' }]
            .concat(commandes.filter((c) => c.service_code !== 'campagne_capture').map((c) => ({ valeur: c.id, libelle: `${c.ecole_nom} — ${SERVICES[c.service_code] || c.service_nom} (${c.ville || '—'})` }))) },
        { cle: 'ecole_id', libelle: '… ou école (sans commande)', type: 'liste',
          options: [{ valeur: '', libelle: '—' }].concat(ecoles.map((e) => ({ valeur: e.id, libelle: e.nom }))) },
        { cle: 'service_code', libelle: 'Prestation (sans commande)', type: 'liste', valeur: 'installation',
          options: Object.entries(SERVICES).filter(([k]) => k !== 'campagne_capture').map(([k, l]) => ({ valeur: k, libelle: l })) },
        { cle: 'date_souhaitee', libelle: 'Date souhaitée', type: 'date' },
        { cle: 'places', libelle: 'Intervenants', type: 'nombre', pas: '1', min: 1, max: 10, valeur: 1 },
        { cle: 'description', libelle: 'Ce qui est attendu (visible des partenaires)', type: 'zone', lignes: 3 }
      ],
      soumettre: (v) => {
        if (!v.commande_service_id && !v.ecole_id) throw new Error('Choisissez une commande, ou une école et une prestation.');
        return F().envoyer(`${BASE}/missions`, 'POST', v);
      }
    });
  }


  /* ======================================================================
     2 bis. CAMPAGNES DE CAPTURE
     ----------------------------------------------------------------------
     La plateforme PROPOSE un nombre d'intervenants d'après l'effectif ; le
     Super Admin décide : s'en charger lui-même, désigner des partenaires,
     et/ou laisser des places ouvertes — l'aperçu part alors vers les
     partenaires libres, et les premiers qui adhèrent sont retenus d'office.
     ====================================================================== */

  async function partenairesCapture() {
    try {
      return ((await SA.api(SA.url(BASE, { statut: 'actif', badge: 'apporteur_affaires' }))).donnees || [])
        .filter((a) => a.acces_active);
    } catch (e) { return []; }
  }

  function blocSuggestion(s) {
    if (!s) return '';
    return `<div class="ab-apercu" style="margin-bottom:12px">Proposition pour ≈ ${esc(s.effectif)} élèves (≈ ${esc(s.capacite_jour)} photos par intervenant et par jour) :
${s.options.map((o) => `${o.recommande ? '★ ' : '  '}${o.intervenants} intervenant(s) → ${o.jours} jour(s) sur place`).join('\n')}</div>`;
  }

  async function formulaireCapture(commandeId) {
    let commandes = [];
    try { commandes = ((await SA.api(`${BASE}/missions/commandes`)).donnees || []).filter((c) => c.service_code === 'campagne_capture'); } catch (e) { /* saisie libre */ }
    const partenaires = await partenairesCapture();
    const ecoles = (SA.referentiels && SA.referentiels.ecoles) || [];
    const voile = SA.modale({
      titre: 'Lancer une campagne de capture', large: true,
      sousTitre: 'Photographier (et au besoin enregistrer) les élèves d’une école. L’accès des partenaires à la liste est limité à la mission et se ferme à sa fin.',
      contenu: `<form id="cap-form">
        <label class="sa-champ-bloc"><span>Commande de l’école</span><select class="sa-champ" name="commande_service_id">
          <option value="">${commandes.length ? 'Choisir une commande…' : 'Aucune commande en attente'}</option>
          ${commandes.map((c) => `<option value="${esc(c.id)}">${esc(c.ecole_nom)} — ${esc(Math.round(c.quantite))} élèves annoncés (${esc(c.ville || '—')})${c.consentement_photos_le ? '' : ' ⚠ sans attestation'}</option>`).join('')}
        </select></label>
        <label class="sa-champ-bloc"><span>… ou école (sans commande)</span><select class="sa-champ" name="ecole_id">
          <option value="">—</option>${ecoles.map((e) => `<option value="${esc(e.id)}">${esc(e.nom)}</option>`).join('')}</select></label>
        <div id="cap-suggestion"></div>
        <div class="sa-grille-2">
          <label class="sa-champ-bloc"><span>Nombre d’intervenants</span><input class="sa-champ" type="number" name="places" min="1" max="20" step="1" value="1" required /></label>
          <label class="sa-champ-bloc"><span>Date prévue</span><input class="sa-champ" type="date" name="date_souhaitee" /></label>
          <label class="sa-champ-bloc"><span>Jours d’accès après la date prévue</span><input class="sa-champ" type="number" name="acces_jours" min="1" max="90" step="1" value="21" /></label>
          <label class="sa-champ-bloc"><span>Qui mène la campagne ?</span><select class="sa-champ" name="mode">
            <option value="partenaires">Des partenaires</option><option value="equipe">L’équipe Ardoise elle-même</option></select></label>
        </div>
        <div id="cap-partenaires">
          <p class="sa-note">Désignez des partenaires (facultatif). Les places non désignées sont proposées aux partenaires libres si « adhésion libre » est cochée.</p>
          <div class="ab-choix" style="max-height:220px;overflow:auto">${partenaires.length ? partenaires.map((a) => `<label class="ab-choix-ligne"><input type="checkbox" name="designe" value="${esc(a.id)}" />
            <span><strong>${esc(nomComplet(a.prenom, a.nom))}</strong> <span class="sa-muet">${esc([a.ville, a.province].filter(Boolean).join(', '))}</span></span></label>`).join('')
            : '<p class="sa-muet">Aucun partenaire actif avec le badge « Apporteur d’affaires ».</p>'}</div>
          <label class="ab-choix-ligne" style="margin-top:8px"><input type="checkbox" name="adhesion_libre" checked />
            <span>Adhésion libre : envoyer l’aperçu aux partenaires libres pour les places non désignées</span></label>
        </div>
        <label class="sa-champ-bloc"><span>Consignes (visibles des partenaires)</span><textarea class="sa-champ" name="description" rows="3" maxlength="2000"
          placeholder="Horaires, vacations, matériel, personne à demander à l’accueil…"></textarea></label>
        <label class="ab-choix-ligne" id="cap-consentement"><input type="checkbox" name="consentement_confirme" />
          <span>L’école m’a confirmé que les parents sont informés de la prise de photo.</span></label>
      </form><div class="sa-form-erreur" id="cap-erreur" hidden></div>`,
      actions: '<button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button><button class="sa-bouton sa-bouton-principal" data-role="valider">Lancer la campagne</button>'
    });
    const f = voile.querySelector('#cap-form');
    const majConsentement = () => {
      const cmd = commandes.find((c) => c.id === f.commande_service_id.value);
      voile.querySelector('#cap-consentement').style.display = cmd && cmd.consentement_photos_le ? 'none' : '';
    };
    const majSuggestion = async () => {
      const cmd = commandes.find((c) => c.id === f.commande_service_id.value);
      let s = cmd && cmd.suggestion;
      if (!s && f.ecole_id.value) {
        try { s = await SA.api(SA.url(`${BASE}/missions/suggestion`, { ecole_id: f.ecole_id.value })); } catch (e) { s = null; }
      }
      voile.querySelector('#cap-suggestion').innerHTML = blocSuggestion(s);
      if (s) f.places.value = s.recommande;
      if (cmd && cmd.date_planifiee) f.date_souhaitee.value = String(cmd.date_planifiee).slice(0, 10);
      majConsentement();
    };
    f.commande_service_id.addEventListener('change', majSuggestion);
    f.ecole_id.addEventListener('change', majSuggestion);
    f.mode.addEventListener('change', () => { voile.querySelector('#cap-partenaires').hidden = f.mode.value === 'equipe'; });
    if (commandeId && commandes.some((c) => c.id === commandeId)) { f.commande_service_id.value = commandeId; majSuggestion(); }
    majConsentement();
    voile.querySelector('[data-role="annuler"]').addEventListener('click', () => voile.fermer());
    const bouton = voile.querySelector('[data-role="valider"]');
    const erreur = voile.querySelector('#cap-erreur');
    bouton.addEventListener('click', async () => {
      erreur.hidden = true;
      if (!f.commande_service_id.value && !f.ecole_id.value) { erreur.textContent = 'Choisissez une commande ou une école.'; erreur.hidden = false; return; }
      const designes = [...f.querySelectorAll('input[name="designe"]:checked')].map((x) => x.value);
      const corps = {
        commande_service_id: f.commande_service_id.value || undefined,
        ecole_id: f.commande_service_id.value ? undefined : f.ecole_id.value,
        service_code: 'campagne_capture',
        places: Number(f.places.value) || 1,
        date_souhaitee: f.date_souhaitee.value || undefined,
        acces_jours: Number(f.acces_jours.value) || 21,
        mode: f.mode.value,
        apporteur_ids: f.mode.value === 'equipe' ? [] : designes,
        adhesion_libre: f.adhesion_libre.checked,
        description: f.description.value || undefined,
        consentement_confirme: f.consentement_confirme.checked
      };
      bouton.disabled = true;
      try {
        const r = await SA.api(`${BASE}/missions`, { method: 'POST', body: JSON.stringify(corps) });
        voile.fermer();
        SA.toast(r.message || 'Campagne lancée.', 'succes');
        SA.rafraichirVue();
      } catch (e) {
        erreur.textContent = e.message || 'Lancement impossible.'; erreur.hidden = false;
      } finally { bouton.disabled = false; }
    });
  }

  /** Équipe d'une campagne : ajouter, retirer (son accès se ferme), répartir. */
  async function modaleEquipeCapture(m) {
    const partenaires = await partenairesCapture();
    const actuels = new Set(m.intervenants.filter((i) => i.statut === 'retenu').map((i) => i.apporteur_id));
    const voile = SA.modale({
      titre: `Équipe : ${m.ecole_nom}`,
      sousTitre: `${m.places} place(s). Décocher un partenaire le retire et ferme son accès à la liste ; les nouveaux reçoivent le contact de l’école.`,
      contenu: `<div class="ab-choix" style="max-height:320px;overflow:auto">${partenaires.map((a) => `<label class="ab-choix-ligne"><input type="checkbox" value="${esc(a.id)}" ${actuels.has(a.id) ? 'checked' : ''} />
        <span><strong>${esc(nomComplet(a.prenom, a.nom))}</strong> <span class="sa-muet">${esc(a.ville || '')}</span></span></label>`).join('') || '<p class="sa-muet">Aucun partenaire disponible.</p>'}</div>`,
      actions: '<button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button><button class="sa-bouton sa-bouton-principal" data-role="valider">Enregistrer l’équipe</button>'
    });
    voile.querySelector('[data-role="annuler"]').addEventListener('click', () => voile.fermer());
    voile.querySelector('[data-role="valider"]').addEventListener('click', async () => {
      const ids = [...voile.querySelectorAll('input:checked')].map((x) => x.value);
      if (!ids.length) { SA.toast('Choisissez au moins un partenaire (ou annulez la campagne).', 'danger'); return; }
      if (await agir(`${BASE}/missions/${m.id}/retenir`, { apporteur_ids: ids })) voile.fermer();
    });
  }

  /** Suivi : avancement par classe, équipe et répartition, journal. */
  async function suivreCapture(m) {
    let d;
    try { d = await SA.api(`${BASE}/missions/${m.id}/capture`); } catch (e) { SA.toast(e.message, 'danger'); return; }
    const enCours = d.equipe.filter((x) => x.statut === 'retenu' && !x.termine_le);
    const nomsClasses = Object.fromEntries(d.classes.map((c) => [c.id, c.nom]));
    const libelleAction = { liste_consultee: 'a consulté', eleve_cree: 'a enregistré', eleve_modifie: 'a modifié', photo_ajoutee: 'a photographié',
      photo_remplacee: 'a repris la photo de', part_terminee: 'a terminé sa part', acces_refuse: 'accès refusé' };
    const voile = SA.modale({
      titre: `Campagne : ${d.mission.ecole_nom}`, large: true,
      sousTitre: `${d.acces.ouvert ? `Accès ouvert jusqu’au ${fmt.date(d.mission.acces_expire_le)}` : `Accès fermé (${d.acces.message || ''})`} · ${d.bilan.eleves_photographies} élève(s) photographié(s), ${d.bilan.eleves_crees} enregistré(s)`,
      contenu: `
        <h3 style="margin:16px 0 8px;font-size:.95rem">Classes</h3>
        ${ui.tableau({ lignes: d.classes, vide: 'Aucune classe', colonnes: [
          { cle: 'nom', titre: 'Classe', rendu: (c) => esc(c.nom) },
          { cle: 'p', titre: 'Photos', rendu: (c) => `${c.avec_photo} / ${c.effectif}` },
          { cle: 'qui', titre: 'Confiée à', rendu: (c) => esc(d.equipe.filter((x) => (x.classes || []).includes(c.id)).map((x) => nomComplet(x.prenom, x.nom)).join(', ') || 'toute l’équipe') }
        ] })}
        <h3 style="margin:16px 0 8px;font-size:.95rem">Équipe</h3>
        ${d.equipe.length ? d.equipe.map((x) => `<div>${esc(nomComplet(x.prenom, x.nom))} ${statut(x.statut)} ${x.termine_le ? `<span class="sa-muet">part terminée le ${esc(fmt.date(x.termine_le))}</span>` : ''}
          ${(x.classes || []).length ? `<span class="sa-muet"> · ${esc(x.classes.map((id) => nomsClasses[id] || '?').join(', '))}</span>` : ''}
          ${x.compte_rendu ? `<details class="sa-muet"><summary>Compte rendu</summary><div class="ab-apercu">${esc(x.compte_rendu)}</div></details>` : ''}</div>`).join('') : '<p class="sa-muet">Aucun partenaire.</p>'}
        ${enCours.length > 1 && d.acces.ouvert ? `<p style="margin-top:10px"><button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-repartir>Répartir les classes automatiquement</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-toutes>Toutes les classes à tous</button></p>` : ''}
        <h3 style="margin:16px 0 8px;font-size:.95rem">Journal (200 dernières opérations)</h3>
        <div style="max-height:260px;overflow:auto;font-size:.85rem">${d.journal.map((o) => `<div><span class="sa-mono">${esc(fmt.date(o.created_at))} ${esc(new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))}</span>
          ${esc(o.acteur_nom || o.acteur_type)} ${esc(libelleAction[o.action] || o.action)} ${esc([o.eleve_nom, o.eleve_prenom].filter(Boolean).join(' ') || o.classe_nom || '')}</div>`).join('') || '<p class="sa-muet">Rien pour l’instant.</p>'}</div>`,
      actions: '<button class="sa-bouton sa-bouton-secondaire" data-role="fermer">Fermer</button>'
    });
    voile.querySelector('[data-role="fermer"]').addEventListener('click', () => voile.fermer());
    const auto = voile.querySelector('[data-repartir]');
    if (auto) auto.addEventListener('click', async () => { if (await agir(`${BASE}/missions/${m.id}/repartition`, { auto: true })) voile.fermer(); });
    const toutes = voile.querySelector('[data-toutes]');
    if (toutes) toutes.addEventListener('click', async () => { if (await agir(`${BASE}/missions/${m.id}/repartition`, { aucune: true })) voile.fermer(); });
  }


  /* ======================================================================
     2 ter. COMMANDES DE SERVICES DES ÉCOLES
     ----------------------------------------------------------------------
     Là où mène la notification « Commande de service » : chaque demande
     d'une école (campagne de capture, installation, formation), son état,
     et l'action suivante — confirmer, lancer la mission, annuler.
     ====================================================================== */

  const STATUTS_COMMANDE = {
    demandee: ['Demandée', 'attention'], confirmee: ['Confirmée', 'info'], planifiee: ['Planifiée', 'info'],
    en_cours: ['En cours', 'info'], realisee: ['Réalisée', 'succes'], annulee: ['Annulée', 'neutre']
  };
  const FILTRES_COMMANDE = [['a_traiter', 'À traiter'], ['en_cours', 'En cours'], ['realisee', 'Réalisées'], ['annulee', 'Annulées'], ['toutes', 'Toutes']];
  const LISTES_ELEVES = { complete: 'liste complète dans Ardoise', partielle: 'liste partielle', absente: 'élèves à enregistrer' };

  async function majCommande(id, corps, message) {
    try {
      await SA.api(`/super-admin/services/commandes/${id}`, { method: 'PATCH', body: JSON.stringify(corps) });
      SA.toast(message || 'Commande mise à jour.', 'succes');
      SA.rafraichirVue();
    } catch (e) { SA.toast(e.message || 'Mise à jour impossible.', 'danger'); }
  }

  SA.enregistrerVue('services/commandes', {
    titre: 'Commandes des écoles',
    sousTitre: 'Campagnes de capture, installations et formations demandées par les écoles : confirmer, confier en mission, suivre.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(6, 46);
      const d = await SA.api('/super-admin/services/commandes');
      const filtre = params.id ? 'toutes' : (params.filtre || 'a_traiter');
      const toutes = d.commandes || [];
      const garder = {
        a_traiter: (c) => ['demandee', 'confirmee', 'planifiee'].includes(c.statut) && !c.mission,
        en_cours: (c) => ['confirmee', 'planifiee', 'en_cours'].includes(c.statut) && c.mission,
        realisee: (c) => c.statut === 'realisee', annulee: (c) => c.statut === 'annulee', toutes: () => true
      }[filtre] || (() => true);
      const lignes = toutes.filter(garder);
      const compte = (k) => toutes.filter({ a_traiter: (c) => ['demandee', 'confirmee', 'planifiee'].includes(c.statut) && !c.mission,
        en_cours: (c) => ['confirmee', 'planifiee', 'en_cours'].includes(c.statut) && c.mission }[k] || (() => false)).length;
      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-filtres">${FILTRES_COMMANDE.map(([k, l]) => `<button class="sa-bouton sa-bouton-petit ${filtre === k ? 'sa-bouton-principal' : 'sa-bouton-secondaire'}" data-filtre="${k}">${esc(l)}${['a_traiter', 'en_cours'].includes(k) && compte(k) ? ` <span class="sa-mono">${compte(k)}</span>` : ''}</button>`).join('')}</div>
          ${ui.tableau({
            lignes, vide: filtre === 'a_traiter' ? 'Aucune commande à traiter' : 'Aucune commande',
            colonnes: [
              { cle: 'date', titre: 'Demandée le', rendu: (c) => esc(fmt.date(c.date_demande)) },
              { cle: 'ecole', titre: 'École', rendu: (c) => `<strong>${esc(c.ecole_nom)}</strong><div class="sa-muet">${esc(c.ville || '')}</div>
                  ${c.contact_nom || c.contact_telephone ? `<div class="sa-muet">${esc([c.contact_nom, c.contact_telephone].filter(Boolean).join(' · '))}</div>` : ''}` },
              { cle: 'service', titre: 'Prestation', rendu: (c) => `${esc(c.service_nom)}
                  <div class="sa-muet">${esc(Number(c.quantite).toLocaleString('fr-FR'))} × ${esc(Number(c.prix_unitaire_applique).toLocaleString('fr-FR', { minimumFractionDigits: 2 }))} = <strong>${esc(Number(c.montant_total).toLocaleString('fr-FR', { minimumFractionDigits: 2 }))} ${esc(c.devise)}</strong></div>
                  ${c.service_code === 'campagne_capture' ? `<div class="sa-muet">${c.eleves_inscrits !== null ? `${esc(c.eleves_inscrits)} élève(s) déjà dans Ardoise · ` : ''}${esc(LISTES_ELEVES[c.liste_eleves] || 'liste non précisée')}</div>
                    <div class="${c.consentement_photos_le ? 'sa-muet' : 'sa-attention-texte'}">${c.consentement_photos_le ? '✓ parents informés (attesté par l’école)' : '⚠ attestation des parents manquante'}</div>` : ''}
                  ${c.date_planifiee ? `<div class="sa-muet">souhaitée le ${esc(fmt.date(c.date_planifiee))}</div>` : ''}
                  ${c.note ? `<details class="sa-muet"><summary>Note de l’école</summary><div class="ab-apercu">${esc(c.note)}</div></details>` : ''}` },
              { cle: 'statut', titre: 'Statut', rendu: (c) => `${ui.badge(...(STATUTS_COMMANDE[c.statut] || [c.statut, 'neutre']))}
                  ${c.mission ? `<div class="sa-muet">mission ${esc(LIBELLES[c.mission.statut] || c.mission.statut)}</div>` : ''}` },
              { cle: 'act', titre: '', rendu: (c) => {
                  const ouverte = ['demandee', 'confirmee', 'planifiee'].includes(c.statut);
                  const mission = c.service_code === 'campagne_capture' ? 'Lancer la campagne' : 'Publier la mission';
                  return `<div class="ab-actions">
                    ${ouverte && !c.mission ? `<button class="sa-bouton sa-bouton-principal sa-bouton-petit" data-act="mission" data-id="${esc(c.id)}">${mission}</button>` : ''}
                    ${c.statut === 'demandee' ? `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-act="confirmer" data-id="${esc(c.id)}">Confirmer à l’école</button>` : ''}
                    ${c.mission ? `<a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" style="text-decoration:none" href="#/apporteurs/missions?type=${esc(c.mission.type)}">Voir la mission</a>` : ''}
                    ${ouverte ? `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-act="annuler" data-id="${esc(c.id)}">Annuler</button>` : ''}
                  </div>`;
                } }
            ]
          })}
          <p class="sa-note">Rien n’est facturé à la demande. « Lancer la campagne » ouvre la proposition du nombre d’intervenants ; la commande passe « planifiée », puis « en cours » à la première photo, et « réalisée » à la clôture de la mission.</p>
        </section>`;
      conteneur.querySelectorAll('[data-filtre]').forEach((b) => b.addEventListener('click', () => { SA.majParams({ filtre: b.dataset.filtre }); SA.rafraichirVue(); }));
      conteneur.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const c = toutes.find((x) => x.id === b.dataset.id);
        if (b.dataset.act === 'mission') {
          if (c.service_code === 'campagne_capture') formulaireCapture(c.id); else formulaireMission(c.id);
        }
        if (b.dataset.act === 'confirmer') await majCommande(c.id, { statut: 'confirmee' }, 'Commande confirmée.');
        if (b.dataset.act === 'annuler') {
          const v = await saisir({ titre: 'Annuler la commande', libelle: 'Motif (gardé dans la note de la commande)', libelleValider: 'Annuler la commande', danger: true });
          if (v) await majCommande(c.id, { statut: 'annulee', note: [c.note, `Annulée : ${v.motif}`].filter(Boolean).join('\n') }, 'Commande annulée.');
        }
      }));
      // Arrivée depuis une notification : la commande visée est mise en évidence.
      if (params.id) {
        const bouton = conteneur.querySelector(`[data-id="${CSS.escape(params.id)}"]`);
        const ligne = bouton && bouton.closest('tr');
        if (ligne) { ligne.style.outline = '2px solid var(--sa-accent, #C98A3E)'; ligne.scrollIntoView({ block: 'center' }); }
        else SA.toast('Cette commande n’apparaît plus dans la liste (annulée ou supprimée).', 'info');
      }
    }
  });

  /* ======================================================================
     3. CAMPAGNES ET PRÉSOMPTIONS
     ====================================================================== */

  SA.enregistrerVue('apporteurs/campagnes', {
    titre: 'Campagnes et présomptions',
    sousTitre: 'Les annonces des partenaires stratégiques, et les écoles inscrites sans code qui disent les avoir vues.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(6, 46);
      const onglet = params.onglet || 'campagnes';
      const [k, p] = await Promise.all([
        SA.api(SA.url(`${BASE}/campagnes`, { statut: onglet === 'campagnes' ? params.statut : undefined })),
        SA.api(SA.url(`${BASE}/presomptions`, { statut: onglet === 'presomptions' ? (params.statut || 'a_confirmer') : 'a_confirmer' }))
      ]);
      const zone = actionsEntete('<button class="sa-bouton sa-bouton-principal" data-nouvelle>Créer une campagne</button>');
      zone.querySelector('[data-nouvelle]').addEventListener('click', () => formulaireCampagne());
      const pc = p.compteurs || {};
      const aConfirmer = (pc.a_confirmer || 0) + (pc.expiree || 0);

      const vues = {
        campagnes: () => ui.tableau({
          lignes: k.donnees, vide: 'Aucune campagne',
          colonnes: [
            { cle: 'nom', titre: 'Campagne', rendu: (l) => `<strong>${esc(l.nom_public)}</strong>
                <div class="sa-muet">${esc(CANAUX[l.canal] || l.canal)} · diffusion ${esc(fmt.date(l.date_diffusion))}${l.preuve_diffusion ? ` · preuve : ${esc(l.preuve_diffusion)}` : ''}</div>` },
            { cle: 'partenaire', titre: 'Partenaire', rendu: (l) => `<a href="#/apporteurs/profils/fiche/${esc(l.apporteur_id)}">${esc(nomComplet(l.prenom, l.nom))}</a>
                ${l.organisation ? `<div class="sa-muet">${esc(l.organisation)}</div>` : ''}${l.badge_actif ? '' : '<div class="sa-attention-texte">badge inactif</div>'}` },
            { cle: 'fenetre', titre: 'Fenêtre et zone', rendu: (l) => `${l.statut === 'proposee' ? 'à fixer' : `jusqu’au ${esc(fmt.date(l.date_fin_fenetre))}`}
                <div class="sa-muet">${esc((l.zones || []).join(', ') || 'tout le pays')}</div>` },
            { cle: 'code', titre: 'Code', rendu: (l) => l.code ? `<span class="sa-mono">${esc(l.code)}</span>${l.code_actif ? '' : ' <span class="sa-muet">(désactivé)</span>'}` : '' },
            { cle: 'resultats', titre: 'Résultats', rendu: (l) => l.statut === 'proposee' ? '' : `${l.visites} visite(s) · ${l.inscriptions_code} avec code
                <div class="sa-muet">${(l.presomptions.a_confirmer || 0) + (l.presomptions.expiree || 0)} à confirmer · ${l.presomptions.confirmee || 0} confirmée(s) · ${l.presomptions.infirmee || 0} infirmée(s)</div>` },
            { cle: 'statut', titre: 'Statut', rendu: (l) => `${statut(l.statut)}${l.motif ? `<div class="sa-muet">${esc(l.motif)}</div>` : ''}` },
            { cle: 'act', titre: '', rendu: (l) => `<div class="ab-actions">
                ${l.statut === 'proposee' ? `<button class="sa-bouton sa-bouton-principal sa-bouton-petit" data-action="valider" data-id="${esc(l.id)}">Valider</button>
                  <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-action="rejeter" data-id="${esc(l.id)}">Refuser</button>` : ''}
                ${l.statut === 'active' ? `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-action="clore" data-id="${esc(l.id)}">Clore</button>` : ''}</div>` }
          ]
        }),
        presomptions: () => `
          <div class="sa-filtres">${[['a_confirmer', 'À confirmer'], ['expiree', 'Sans réponse'], ['confirmee', 'Confirmées'], ['infirmee', 'Infirmées'], ['ecartee', 'Écartées'], ['toutes', 'Toutes']].map(([s, l]) =>
            `<button class="sa-bouton sa-bouton-petit ${(params.statut || 'a_confirmer') === s ? 'sa-bouton-principal' : 'sa-bouton-secondaire'}" data-statut-p="${s}">${esc(l)}${pc[s] ? ` <span class="sa-mono">${pc[s]}</span>` : ''}</button>`).join('')}</div>
          ${ui.tableau({
            lignes: p.donnees, vide: 'Aucune présomption',
            colonnes: [
              { cle: 'ecole', titre: 'École', rendu: (l) => `<strong>${esc(l.ecole_nom)}</strong><div class="sa-muet">${esc(l.ecole_ville || '')} · inscrite le ${esc(fmt.date(l.created_at))}</div>` },
              { cle: 'source', titre: 'Ce que l’école a déclaré', rendu: (l) => `${esc(l.source_libelle || '')}${l.source_precision ? `<div class="sa-muet">« ${esc(l.source_precision)} »</div>` : ''}` },
              { cle: 'campagne', titre: 'Campagne présumée', rendu: (l) => `${esc(l.nom_public)}<div class="sa-muet">${esc(nomComplet(l.prenom, l.nom))}${l.autres_campagnes ? ` · ${l.autres_campagnes} autre(s) campagne(s) possible(s)` : ''}</div>` },
              { cle: 'contact', titre: 'Contact de l’école', rendu: (l) => `${esc(nomComplet(l.responsable_prenom, l.responsable_nom))}${l.responsable_fonction ? ` (${esc(l.responsable_fonction)})` : ''}
                  <div class="sa-muet sa-mono">${esc([l.ecole_telephone, l.ecole_email].filter(Boolean).join(' · '))}</div>` },
              { cle: 'statut', titre: 'Statut', rendu: (l) => `${statut(l.statut)}${l.reponse_note ? `<div class="sa-muet">${esc(l.reponse_note)}</div>` : ''}
                  ${l.mode_reponse ? `<div class="sa-muet">${l.mode_reponse === 'ecole' ? 'réponse de l’école' : 'confirmé par l’équipe'}</div>` : ''}` },
              { cle: 'act', titre: '', rendu: (l) => ['a_confirmer', 'expiree'].includes(l.statut) ? `<div class="ab-actions">
                  <button class="sa-bouton sa-bouton-principal sa-bouton-petit" data-action="confirmer-p" data-id="${esc(l.id)}">Confirmée par appel</button>
                  <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-action="relancer-p" data-id="${esc(l.id)}">Renvoyer la question</button>
                  <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-action="ecarter-p" data-id="${esc(l.id)}">Écarter</button></div>` : '' }
            ]
          })}`
      };

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-encart"><strong>Le mécanisme.</strong> Un partenaire stratégique déclare sa campagne <em>avant</em> de la diffuser ; une fois validée, elle reçoit un code à citer dans l’annonce, une zone et une fenêtre.
            Avec le code, l’école est rattachée comme pour un apporteur. Sans code, une école de la zone qui s’inscrit dans la fenêtre et déclare avoir connu Ardoise par une annonce
            reçoit un lien « était-ce cette annonce ? » : <strong>c’est elle qui confirme</strong>. Une confirmation crée une attribution <em>proposée</em>, à valider comme les autres ; la commission ne porte que sur les paiements encaissés.</div>
          ${onglets([['campagnes', `Campagnes (${k.donnees.filter((x) => x.statut === 'proposee').length} à valider)`], ['presomptions', `Présomptions (${aConfirmer} ouvertes)`]], onglet)}
          ${vues[onglet] ? vues[onglet]() : vues.campagnes()}
        </section>`;

      conteneur.querySelectorAll('[data-onglet]').forEach((b) => b.addEventListener('click', () => { SA.majParams({ onglet: b.dataset.onglet }); SA.rafraichirVue(); }));
      conteneur.querySelectorAll('[data-statut-p]').forEach((b) => b.addEventListener('click', () => { SA.majParams({ onglet: 'presomptions', statut: b.dataset.statutP }); SA.rafraichirVue(); }));
      conteneur.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        const camp = k.donnees.find((x) => x.id === id);
        switch (b.dataset.action) {
          case 'valider': {
            const v = await saisir({
              titre: `Valider « ${camp.nom_public} »`, libelleValider: 'Valider et envoyer le code',
              sousTitre: 'Le partenaire reçoit son code dédié, la phrase à insérer dans l’annonce, la zone et la fenêtre.',
              champsSup: [
                { cle: 'fenetre_jours', libelle: 'Fenêtre d’attribution (jours après la diffusion)', type: 'nombre', pas: '1', min: 7, max: 365, valeur: camp.fenetre_jours },
                { cle: 'zones', libelle: 'Zone (villes ou provinces, séparées par des virgules ; vide = tout le pays)', valeur: (camp.zones || []).join(', '), longueurMax: 600 },
                { cle: 'prefixe_code', libelle: 'Préfixe du code (facultatif)', exemple: 'FEDE' }
              ]
            });
            if (v) await agir(`${BASE}/campagnes/${id}/valider`, v);
            break;
          }
          case 'rejeter': {
            const v = await saisir({ titre: 'Refuser la campagne', libelle: 'Motif (communiqué au partenaire)', libelleValider: 'Refuser', danger: true });
            if (v) await agir(`${BASE}/campagnes/${id}/rejeter`, v);
            break;
          }
          case 'clore': {
            const v = await saisir({ titre: 'Clore la campagne', libelle: 'Motif (facultatif)', requis: false, libelleValider: 'Clore' });
            if (v) await agir(`${BASE}/campagnes/${id}/clore`, v);
            break;
          }
          case 'confirmer-p': {
            const v = await saisir({ titre: 'Confirmation par l’équipe', libelleValider: 'Enregistrer la confirmation',
              sousTitre: 'Seulement si l’école vous a confirmé elle-même avoir connu Ardoise par cette campagne.',
              champsSup: [{ cle: 'note', libelle: 'Qui, quand, comment (ex. « appel au préfet, 14/11, confirme le communiqué »)', type: 'zone', lignes: 3, requis: true }] });
            if (v) await agir(`${BASE}/presomptions/${id}/confirmer`, v);
            break;
          }
          case 'relancer-p':
            await agir(`${BASE}/presomptions/${id}/relancer`, {});
            break;
          case 'ecarter-p': {
            const v = await saisir({ titre: 'Écarter la présomption', libelle: 'Motif', libelleValider: 'Écarter', danger: true });
            if (v) await agir(`${BASE}/presomptions/${id}/ecarter`, v);
            break;
          }
          default:
        }
      }));
    }
  });

  async function formulaireCampagne() {
    let options = [];
    try {
      const d = await SA.api(SA.url(BASE, { statut: 'actif', badge: 'partenaire_strategique' }));
      options = (d.donnees || []).map((a) => ({ valeur: a.id, libelle: `${nomComplet(a.prenom, a.nom)}${a.organisation ? ` — ${a.organisation}` : ''}` }));
    } catch (e) { /* liste vide */ }
    if (!options.length) { SA.toast('Aucun partenaire ne détient le badge « Partenaire stratégique » actif.', 'danger'); return; }
    F().formulaire({
      titre: 'Créer une campagne (active d’emblée)', large: true, libelleValider: 'Créer et envoyer le code',
      sousTitre: 'Pour une annonce convenue avec un partenaire. Déjà diffusée : la preuve de diffusion est obligatoire.',
      champs: [
        { cle: 'apporteur_id', libelle: 'Partenaire', type: 'liste', requis: true, options: [{ valeur: '', libelle: 'Choisir…' }].concat(options) },
        { cle: 'nom_public', libelle: 'L’annonce telle qu’une école la reconnaîtra', requis: true, longueurMax: 200 },
        { cle: 'canal', libelle: 'Canal', type: 'liste', valeur: 'communique_officiel', options: Object.entries(CANAUX).map(([v, l]) => ({ valeur: v, libelle: l })) },
        { cle: 'date_diffusion', libelle: 'Date de diffusion', type: 'date', requis: true },
        { cle: 'fenetre_jours', libelle: 'Fenêtre (jours)', type: 'nombre', pas: '1', min: 7, max: 365, valeur: 90 },
        { cle: 'zones', libelle: 'Zone (vide = tout le pays)', longueurMax: 600 },
        { cle: 'preuve_diffusion', libelle: 'Preuve de diffusion (lien, référence)', longueurMax: 1000 },
        { cle: 'public_vise', libelle: 'Public visé (facultatif)', longueurMax: 500 }
      ],
      soumettre: (v) => F().envoyer(`${BASE}/campagnes`, 'POST', v)
    });
  }
})();
