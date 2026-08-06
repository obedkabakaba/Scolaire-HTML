/* ==========================================================================
   Ardoise — Super Admin : Explorateur, Voir comme, Recherche globale
   --------------------------------------------------------------------------
   Tout ce fichier est en consultation. Aucune vue n'émet de requête d'écriture
   sur une donnée pédagogique, et aucun bouton d'action n'est rendu — pas même
   masqué par CSS. Le serveur refuserait de toute façon (la branche
   /super-admin/explorer n'accepte que GET), mais une interface qui montre un
   bouton inopérant est une interface qui ment.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui } = SA;

  const BANDEAU_LECTURE = `
    <div class="sa-bandeau-lecture">
      <span>🔒</span>
      <span>Consultation en lecture seule. Aucune donnée pédagogique ne peut être modifiée depuis cet espace.</span>
    </div>`;

  /** Sélecteur d'école commun aux vues de l'Explorateur. */
  function selecteurEcole(conteneur, valeurCourante, surChangement) {
    const barre = document.createElement('div');
    barre.className = 'sa-barre-filtres';
    barre.innerHTML = SA.ui.selecteurEcoles(valeurCourante, { libelleVide: 'Choisir une école…' });
    conteneur.appendChild(barre);
    barre.querySelector('select').addEventListener('change', (e) => surChangement(e.target.value));
    return barre;
  }

  function ecoleParDefaut(params) {
    const ecoles = (SA.referentiels && SA.referentiels.ecoles) || [];
    return params.ecole_id || (ecoles[0] && ecoles[0].id) || '';
  }

  /* ======================================================================
     Explorateur — choix de l'école
     ====================================================================== */

  SA.enregistrerVue('explorer', {
    titre: 'Explorateur',
    sousTitre: "Parcourir une école comme le ferait son directeur — sans rien pouvoir y changer.",

    async rendu(conteneur) {
      const ecoles = (SA.referentiels && SA.referentiels.ecoles) || [];

      conteneur.innerHTML = BANDEAU_LECTURE + `
        <div class="sa-barre-filtres">
          <input type="search" class="sa-champ sa-champ-recherche" id="filtre-ecoles"
                 placeholder="Filtrer les écoles…" />
        </div>
        <div class="sa-grille-3" id="grille-ecoles"></div>`;

      const grille = document.getElementById('grille-ecoles');

      function dessiner(motif) {
        const filtrees = ecoles.filter((e) =>
          !motif || (e.nom + ' ' + e.code).toLowerCase().includes(motif.toLowerCase()));

        if (!filtrees.length) {
          grille.innerHTML = ui.etatVide('Aucune école', 'Ajustez le filtre.');
          return;
        }

        grille.innerHTML = filtrees.map((e) => `
          <button class="sa-panneau" data-ecole="${esc(e.id)}"
                  style="text-align:left;cursor:pointer;font:inherit;color:inherit;border-width:1px">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
              <strong>${esc(e.nom)}</strong>
              ${ui.badgeStatut(e.statut)}
            </div>
            <div class="sa-muet" style="font-size:.78rem;margin-top:5px">${esc(e.code)}</div>
          </button>`).join('');

        grille.querySelectorAll('[data-ecole]').forEach((carte) => {
          carte.addEventListener('click', () => SA.naviguer(`explorer/ecole/${carte.getAttribute('data-ecole')}`));
        });
      }

      dessiner('');
      document.getElementById('filtre-ecoles')
        .addEventListener('input', SA.antiRebond((e) => dessiner(e.target.value), 200));
    }
  });

  /* ======================================================================
     Explorateur — une école
     ====================================================================== */

  const RESSOURCES_LIBELLES = {
    classes: 'Classes', eleves: 'Élèves', enseignants: 'Enseignants', parents: 'Parents',
    cours: 'Cours', horaires: 'Horaires', presences: 'Présences', notes: 'Notes',
    bulletins: 'Bulletins', paiements: 'Paiements', messages: 'Messages', archives: 'Archives'
  };

  /**
   * Colonnes d'affichage par ressource. Le serveur choisit les colonnes SQL,
   * l'interface choisit lesquelles montrer et comment : les deux listes sont
   * volontairement séparées, pour qu'ajouter une colonne à l'écran n'oblige
   * pas à toucher au SQL, et inversement.
   */
  const COLONNES = {
    classes: [
      { cle: 'nom', titre: 'Classe' },
      { cle: 'annee', titre: 'Année' },
      { cle: 'option', titre: 'Option' },
      { cle: 'effectif', titre: 'Effectif', classe: 'sa-num', rendu: (l) => fmt.nombre(l.effectif) },
      { cle: 'nb_cours', titre: 'Cours', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb_cours) }
    ],
    eleves: [
      { cle: 'matricule', titre: 'Matricule', classe: 'sa-mono' },
      { cle: 'nom', titre: 'Élève', rendu: (l) => esc([l.nom, l.postnom, l.prenom].filter(Boolean).join(' ')) },
      { cle: 'sexe', titre: 'Sexe' },
      { cle: 'date_naissance', titre: 'Naissance', rendu: (l) => esc(fmt.date(l.date_naissance)) },
      { cle: 'classe', titre: 'Classe' },
      { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) }
    ],
    enseignants: [
      { cle: 'nom', titre: 'Enseignant', rendu: (l) => esc([l.prenom, l.nom].filter(Boolean).join(' ')) },
      { cle: 'email', titre: 'Email' },
      { cle: 'telephone', titre: 'Téléphone' },
      { cle: 'roles', titre: 'Rôles', rendu: (l) => (l.roles || []).map((r) => ui.badge(fmt.role(r), 'info')).join(' ') },
      { cle: 'nb_affectations', titre: 'Cours', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb_affectations) },
      { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) }
    ],
    parents: [
      { cle: 'nom', titre: 'Parent', rendu: (l) => esc([l.prenom, l.nom].filter(Boolean).join(' ')) },
      { cle: 'email', titre: 'Email' },
      { cle: 'telephone', titre: 'Téléphone' },
      { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) },
      { cle: 'created_at', titre: 'Inscrit le', rendu: (l) => esc(fmt.date(l.created_at)) }
    ],
    cours: [
      { cle: 'nom', titre: 'Cours' },
      { cle: 'maximum', titre: 'Maximum', classe: 'sa-num' },
      { cle: 'coefficient', titre: 'Coeff.', classe: 'sa-num' },
      { cle: 'domaine', titre: 'Domaine' },
      { cle: 'nb_classes', titre: 'Classes', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb_classes) }
    ],
    horaires: [
      {
        cle: 'jour', titre: 'Jour',
        rendu: (l) => esc(['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi',
                           'Vendredi', 'Samedi', 'Dimanche'][Number(l.jour)] || l.jour)
      },
      { cle: 'creneau', titre: 'Créneau' },
      { cle: 'heure_debut', titre: 'Début' },
      { cle: 'heure_fin', titre: 'Fin' },
      { cle: 'classe', titre: 'Classe' },
      { cle: 'cours', titre: 'Cours' },
      { cle: 'enseignant', titre: 'Enseignant' }
    ],
    presences: [
      { cle: 'date', titre: 'Date', rendu: (l) => esc(fmt.date(l.date)) },
      { cle: 'eleve', titre: 'Élève' },
      { cle: 'matricule', titre: 'Matricule', classe: 'sa-mono' },
      { cle: 'classe', titre: 'Classe' },
      { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badge(l.statut, l.statut === 'present' ? 'succes' : l.statut === 'retard' ? 'attention' : 'danger') },
      { cle: 'motif', titre: 'Motif' }
    ],
    notes: [
      { cle: 'eleve', titre: 'Élève' },
      { cle: 'cours', titre: 'Cours' },
      { cle: 'classe', titre: 'Classe' },
      { cle: 'periode', titre: 'Période' },
      { cle: 'points_obtenus', titre: 'Points', classe: 'sa-num' },
      { cle: 'created_at', titre: 'Dernière saisie', rendu: (l) => esc(fmt.date(l.created_at)) },
              { cle: 'valide', titre: 'Validée', rendu: (l) => l.valide ? ui.badge('validée', 'succes') : '<span class="sa-muet">non</span>' }
    ],
    bulletins: [
      { cle: 'eleve', titre: 'Élève' },
      { cle: 'classe', titre: 'Classe' },
      { cle: 'periode', titre: 'Période' },
      { cle: 'total', titre: 'Total', classe: 'sa-num' },
      { cle: 'pourcentage', titre: '%', classe: 'sa-num', rendu: (l) => esc(fmt.pourcent(l.pourcentage)) },
      { cle: 'classement', titre: 'Rang', classe: 'sa-num' },
      { cle: 'mention', titre: 'Mention' }
    ],
    paiements: [
      { cle: 'date_paiement', titre: 'Date', rendu: (l) => esc(fmt.date(l.date_paiement)) },
      { cle: 'eleve', titre: 'Élève' },
      { cle: 'classe', titre: 'Classe' },
      { cle: 'montant', titre: 'Montant', classe: 'sa-num', rendu: (l) => esc(fmt.montant(l.montant, l.devise)) },
      { cle: 'mode_paiement', titre: 'Mode' },
      { cle: 'reference', titre: 'Référence', classe: 'sa-mono' }
    ],
    messages: [
      { cle: 'created_at', titre: 'Date', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
      { cle: 'sujet', titre: 'Sujet' },
      { cle: 'canal', titre: 'Canal' },
      { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) },
      { cle: 'contenu', titre: 'Contenu', rendu: (l) => `<span class="sa-tronque" title="${esc(l.contenu)}">${esc(l.contenu)}</span>` }
    ],
    archives: [
      { cle: 'annee', titre: 'Année' },
      { cle: 'eleve', titre: 'Élève' },
      { cle: 'matricule', titre: 'Matricule', classe: 'sa-mono' },
      { cle: 'classe', titre: 'Classe' }
    ]
  };

  SA.enregistrerVue('explorer/ecole', {
    titre: 'Exploration d\'une école',
    sousTitre: 'Consultation intégrale, en lecture seule.',

    async rendu(conteneur, params, segments) {
      const ecoleId = segments[0];
      if (!ecoleId) {
        conteneur.innerHTML = ui.etatVide('Aucune école sélectionnée', 'Revenez à l\'Explorateur.');
        return;
      }

      const ressource = params.ressource || 'apercu';

      conteneur.innerHTML = BANDEAU_LECTURE + `
        <div class="sa-onglets" id="onglets-ressources">
          <button class="sa-onglet${ressource === 'apercu' ? ' actif' : ''}" data-ressource="apercu">Aperçu</button>
          ${Object.entries(RESSOURCES_LIBELLES).map(([cle, libelle]) => `
            <button class="sa-onglet${ressource === cle ? ' actif' : ''}" data-ressource="${esc(cle)}">${esc(libelle)}</button>`).join('')}
        </div>
        <div id="zone-ressource">${ui.squelette(7)}</div>`;

      document.getElementById('onglets-ressources').addEventListener('click', (evenement) => {
        const bouton = evenement.target.closest('[data-ressource]');
        if (!bouton) return;
        SA.naviguer(`explorer/ecole/${ecoleId}`, { ressource: bouton.getAttribute('data-ressource') });
      });

      const zone = document.getElementById('zone-ressource');

      if (ressource === 'apercu') {
        await rendreApercu(zone, ecoleId);
        return;
      }

      await rendreRessource(zone, ecoleId, ressource, params);
    }
  });

  async function rendreApercu(zone, ecoleId) {
    const d = await SA.api(`/super-admin/explorer/${ecoleId}/apercu`);
    const c = d.compteurs || {};
    const e = d.ecole || {};

    const entete = document.querySelector('#sa-entete h1');
    if (entete) entete.textContent = e.nom || 'École';

    const actions = document.getElementById('sa-entete-actions');
    if (actions) {
      actions.innerHTML = `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-voir-comme">Voir comme…</button>`;
      document.getElementById('btn-voir-comme')
        .addEventListener('click', () => SA.naviguer('explorer/voir-comme', { ecole_id: ecoleId }));
    }

    zone.innerHTML = `
      <div class="sa-grille-stats" style="margin-bottom:18px">
        ${ui.carteStat({ valeur: fmt.nombre(c.eleves), etiquette: 'Élèves actifs' })}
        ${ui.carteStat({ valeur: fmt.nombre(c.classes), etiquette: 'Classes' })}
        ${ui.carteStat({ valeur: fmt.nombre(c.cours), etiquette: 'Cours' })}
        ${ui.carteStat({ valeur: fmt.nombre(c.utilisateurs), etiquette: 'Utilisateurs' })}
        ${ui.carteStat({ valeur: fmt.nombre(c.bulletins), etiquette: 'Bulletins' })}
        ${ui.carteStat({ valeur: fmt.nombre(c.notes), etiquette: 'Notes saisies' })}
        ${ui.carteStat({ valeur: fmt.nombre(c.presences), etiquette: 'Relevés de présence' })}
        ${ui.carteStat({ valeur: fmt.nombre(c.documents), etiquette: 'Documents' })}
      </div>

      <div class="sa-grille-2">
        <div class="sa-panneau">
          <h3 class="sa-section-titre">Identité</h3>
          <div class="sa-liste-infos">
            <div class="sa-ligne-info"><span>Code</span><span class="sa-mono">${esc(e.code)}</span></div>
            <div class="sa-ligne-info"><span>Statut</span><span>${ui.badgeStatut(e.statut)}</span></div>
            <div class="sa-ligne-info"><span>Ville</span><span>${esc(e.ville || '—')}</span></div>
            <div class="sa-ligne-info"><span>Province</span><span>${esc(e.province || '—')}</span></div>
            <div class="sa-ligne-info"><span>Email</span><span>${esc(e.email || '—')}</span></div>
            <div class="sa-ligne-info"><span>Téléphone</span><span>${esc(e.telephone || '—')}</span></div>
            <div class="sa-ligne-info"><span>Devise</span><span>${esc(e.devise_principale || '—')}</span></div>
          </div>
        </div>
        <div class="sa-panneau">
          <h3 class="sa-section-titre">Années scolaires</h3>
          ${ui.tableau({
            colonnes: [
              { cle: 'libelle', titre: 'Année' },
              { cle: 'active', titre: 'Pivot', rendu: (l) => l.active ? ui.badge('active', 'succes') : '<span class="sa-muet">—</span>' },
              { cle: 'cloturee', titre: 'Clôturée', rendu: (l) => l.cloturee ? ui.badge('clôturée', 'neutre') : '<span class="sa-muet">non</span>' }
            ],
            lignes: d.annees_scolaires || [],
            vide: 'Aucune année scolaire'
          })}
        </div>
      </div>

      <div class="sa-section" style="margin-top:18px">
        <h2 class="sa-section-titre">Effectifs par classe</h2>
        ${SA.graphe.barres((d.classes || []).map((c) => ({ libelle: c.nom, valeur: c.effectif })))}
      </div>

      <div class="sa-section">
        <h2 class="sa-section-titre">Activité récente</h2>
        ${ui.tableau({
          colonnes: [
            { cle: 'created_at', titre: 'Date', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
            { cle: 'action', titre: 'Action', classe: 'sa-mono' },
            { cle: 'utilisateur', titre: 'Par' }
          ],
          lignes: d.activite_recente || [],
          vide: 'Aucune activité enregistrée'
        })}
      </div>`;
  }

  async function rendreRessource(zone, ecoleId, ressource, params) {
    zone.innerHTML = '';
    const barre = document.createElement('div');
    const liste = document.createElement('div');
    liste.innerHTML = ui.squelette(8);
    zone.append(barre, liste);

    const filtres = SA.ui.barreFiltres(barre, [
      { type: 'recherche', nom: 'recherche', libelle: 'Rechercher…', valeur: params.recherche }
    ], (valeurs) => SA.naviguer(`explorer/ecole/${ecoleId}`, Object.assign({ ressource }, valeurs, { page: 1 })));

    const requete = Object.assign({}, filtres.lire(), { page: params.page || 1 });
    const d = await SA.api(SA.url(`/super-admin/explorer/${ecoleId}/${ressource}`, requete));

    liste.innerHTML = ui.tableau({
      colonnes: COLONNES[ressource] || Object.keys(d.donnees[0] || {}).map((k) => ({ cle: k, titre: k })),
      lignes: d.donnees,
      cliquable: ressource === 'eleves',
      vide: `Aucun élément dans « ${RESSOURCES_LIBELLES[ressource] || ressource} »`
    }) + ui.pagination(d.pagination);

    liste.querySelectorAll('.sa-bouton-page[data-page]').forEach((bouton) => {
      if (bouton.disabled) return;
      bouton.addEventListener('click', () => {
        SA.naviguer(`explorer/ecole/${ecoleId}`,
          Object.assign({ ressource }, requete, { page: bouton.getAttribute('data-page') }));
      });
    });

    if (ressource === 'eleves') {
      liste.querySelectorAll('tbody tr[data-id]').forEach((ligne) => {
        ligne.addEventListener('click', () => SA.naviguer(`explorer/eleve/${ligne.getAttribute('data-id')}`));
      });
    }
  }

  /* ======================================================================
     Dossier d'un élève
     ====================================================================== */

  SA.enregistrerVue('explorer/eleve', {
    titre: "Dossier de l'élève",
    sousTitre: 'Consultation intégrale et verrouillée.',

    async rendu(conteneur, params, segments) {
      const eleveId = segments[0];
      if (!eleveId) {
        conteneur.innerHTML = ui.etatVide('Aucun élève sélectionné');
        return;
      }

      const d = await SA.api(`/super-admin/explorer/eleve/${eleveId}`);
      const i = d.identite || {};
      const nomComplet = [i.nom, i.postnom, i.prenom].filter(Boolean).join(' ');

      const entete = document.querySelector('#sa-entete h1');
      if (entete) entete.textContent = nomComplet || 'Élève';

      const actions = document.getElementById('sa-entete-actions');
      if (actions && i.ecole_id) {
        actions.innerHTML = `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-retour-ecole">← ${esc(i.ecole_nom || 'École')}</button>`;
        document.getElementById('btn-retour-ecole').addEventListener('click',
          () => SA.naviguer(`explorer/ecole/${i.ecole_id}`, { ressource: 'eleves' }));
      }

      const photo = i.photo_url
        ? `<img src="${esc(i.photo_url)}" alt="" style="width:88px;height:88px;object-fit:cover;border-radius:var(--r-carte);border:1px solid var(--bordure)" />`
        : `<div style="width:88px;height:88px;border-radius:var(--r-carte);border:1px dashed var(--bordure);display:flex;align-items:center;justify-content:center;color:var(--texte-att);font-size:1.7rem">👤</div>`;

      const resume = d.resume_absences || {};

      conteneur.innerHTML = BANDEAU_LECTURE + `
        <div class="sa-panneau" style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap;margin-bottom:18px">
          ${photo}
          <div style="flex:1;min-width:240px">
            <h2 style="font-family:var(--police-titre);margin:0 0 4px;font-size:1.25rem">${esc(nomComplet)}</h2>
            <div class="sa-muet" style="font-size:.82rem">
              ${esc(i.matricule || 'sans matricule')} · ${esc(i.classe_nom || 'sans classe')} · ${esc(i.ecole_nom || '')}
            </div>
            <div style="margin-top:9px">${ui.badgeStatut(i.statut)}</div>
          </div>
          <div class="sa-grille-stats" style="flex:2;min-width:280px">
            ${ui.carteStat({ valeur: fmt.pourcent(d.moyennes && d.moyennes.moyenne_generale), etiquette: 'Moyenne générale' })}
            ${ui.carteStat({ valeur: fmt.nombre(d.bulletins && d.bulletins.length), etiquette: 'Bulletins' })}
            ${ui.carteStat({ valeur: fmt.nombre(resume.absences), etiquette: 'Absences', ton: resume.absences > 10 ? 'attention' : null })}
            ${ui.carteStat({ valeur: fmt.nombre(d.sanctions && d.sanctions.length), etiquette: 'Faits de discipline' })}
          </div>
        </div>

        <div class="sa-onglets" id="onglets-eleve">
          <button class="sa-onglet actif" data-onglet="identite">Identité</button>
          <button class="sa-onglet" data-onglet="parcours">Parcours</button>
          <button class="sa-onglet" data-onglet="bulletins">Bulletins</button>
          <button class="sa-onglet" data-onglet="notes">Notes</button>
          <button class="sa-onglet" data-onglet="absences">Absences</button>
          <button class="sa-onglet" data-onglet="sanctions">Discipline</button>
          <button class="sa-onglet" data-onglet="paiements">Paiements</button>
          <button class="sa-onglet" data-onglet="historique">Historique</button>
        </div>

        <div data-panneau="identite">
          <div class="sa-panneau"><div class="sa-liste-infos">
            <div class="sa-ligne-info"><span>Matricule</span><span class="sa-mono">${esc(i.matricule || '—')}</span></div>
            <div class="sa-ligne-info"><span>Sexe</span><span>${esc(i.sexe || '—')}</span></div>
            <div class="sa-ligne-info"><span>Date de naissance</span><span>${esc(fmt.date(i.date_naissance))}</span></div>
            <div class="sa-ligne-info"><span>Lieu de naissance</span><span>${esc(i.lieu_naissance || '—')}</span></div>
            <div class="sa-ligne-info"><span>Classe</span><span>${esc(i.classe_nom || '—')}</span></div>
            <div class="sa-ligne-info"><span>Année en cours</span><span>${esc(i.annee_courante || '—')}</span></div>
            <div class="sa-ligne-info"><span>Adresse</span><span>${esc(i.adresse || '—')}</span></div>
            <div class="sa-ligne-info"><span>Responsable</span><span>${esc(i.responsable_nom || i.nom_responsable || '—')}</span></div>
            <div class="sa-ligne-info"><span>Téléphone responsable</span><span>${esc(i.responsable_telephone || i.telephone_responsable || '—')}</span></div>
            <div class="sa-ligne-info"><span>Inscrit le</span><span>${esc(fmt.date(i.created_at))}</span></div>
          </div></div>
        </div>

        <div data-panneau="parcours" style="display:none">
          ${ui.tableau({
            colonnes: [
              { cle: 'annee', titre: 'Année scolaire' },
              { cle: 'classe', titre: 'Classe' },
              {
                cle: 'resultat_final', titre: 'Résultat',
                rendu: (l) => {
                  const r = l.resultat_final || l.resultat;
                  if (!r) return '<span class="sa-muet">—</span>';
                  const reussi = /admis|r\u00e9ussi|promu/i.test(r);
                  return ui.badge(r, reussi ? 'succes' : 'attention');
                }
              }
            ],
            lignes: d.parcours || [],
            vide: 'Aucun historique de scolarité'
          })}
        </div>

        <div data-panneau="bulletins" style="display:none">
          ${ui.tableau({
            colonnes: [
              { cle: 'periode', titre: 'Période' },
              { cle: 'classe', titre: 'Classe' },
              { cle: 'total', titre: 'Total', classe: 'sa-num' },
              { cle: 'pourcentage', titre: 'Pourcentage', classe: 'sa-num', rendu: (l) => esc(fmt.pourcent(l.pourcentage)) },
              { cle: 'classement', titre: 'Rang', classe: 'sa-num' },
              { cle: 'mention', titre: 'Mention' },
              { cle: 'conduite', titre: 'Conduite' },
              {
                cle: 'pdf_url', titre: 'Bulletin',
                rendu: (l) => l.pdf_url
                  ? `<a href="${esc(l.pdf_url)}" target="_blank" rel="noopener">PDF</a>`
                  : '<span class="sa-muet">non généré</span>'
              }
            ],
            lignes: d.bulletins || [],
            vide: 'Aucun bulletin'
          })}
        </div>

        <div data-panneau="notes" style="display:none">
          ${ui.tableau({
            colonnes: [
              { cle: 'cours', titre: 'Cours' },
              { cle: 'periode', titre: 'Période' },
              { cle: 'points_obtenus', titre: 'Points', classe: 'sa-num' },
              { cle: 'maximum', titre: 'Maximum', classe: 'sa-num' },
              { cle: 'created_at', titre: 'Dernière saisie', rendu: (l) => esc(fmt.date(l.created_at)) },
              { cle: 'valide', titre: 'Validée', rendu: (l) => l.valide ? ui.badge('validée', 'succes') : '<span class="sa-muet">non</span>' }
            ],
            lignes: d.notes || [],
            vide: 'Aucune note'
          })}
        </div>

        <div data-panneau="absences" style="display:none">
          <div class="sa-grille-stats" style="margin-bottom:14px">
            ${ui.carteStat({ valeur: fmt.nombre(resume.total_releves), etiquette: 'Relevés' })}
            ${ui.carteStat({ valeur: fmt.nombre(resume.absences), etiquette: 'Absences' })}
            ${ui.carteStat({ valeur: fmt.nombre(resume.retards), etiquette: 'Retards' })}
          </div>
          ${ui.tableau({
            colonnes: [
              { cle: 'date', titre: 'Date', rendu: (l) => esc(fmt.date(l.date)) },
              { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badge(l.statut, l.statut === 'present' ? 'succes' : l.statut === 'retard' ? 'attention' : 'danger') },
              { cle: 'motif', titre: 'Motif' }
            ],
            lignes: d.absences || [],
            vide: 'Aucun relevé de présence'
          })}
        </div>

        <div data-panneau="sanctions" style="display:none">
          <p class="sa-note" style="margin-bottom:12px">
            Cette table recense aussi bien les sanctions que les mérites : le sens
            indique s'il s'agit de points retirés ou accordés.
          </p>
          ${ui.tableau({
            colonnes: [
              { cle: 'date_incident', titre: 'Date', rendu: (l) => esc(fmt.date(l.date_incident || l.created_at)) },
              { cle: 'type', titre: 'Type' },
              {
                cle: 'sens', titre: 'Sens',
                rendu: (l) => ui.badge(
                  String(l.sens || '').toLowerCase().startsWith('pos') ? 'mérite' : 'sanction',
                  String(l.sens || '').toLowerCase().startsWith('pos') ? 'succes' : 'danger')
              },
              { cle: 'points', titre: 'Points', classe: 'sa-num', rendu: (l) => esc(fmt.nombre(l.points)) },
              { cle: 'mesure', titre: 'Mesure prise' },
              { cle: 'description', titre: 'Description', rendu: (l) => `<span class="sa-tronque" title="${esc(l.description)}">${esc(l.description)}</span>` }
            ],
            lignes: d.sanctions || [],
            vide: 'Aucun fait de discipline'
          })}
        </div>

        <div data-panneau="paiements" style="display:none">
          ${ui.tableau({
            colonnes: [
              { cle: 'date_paiement', titre: 'Date', rendu: (l) => esc(fmt.date(l.date_paiement)) },
              { cle: 'montant', titre: 'Montant', classe: 'sa-num', rendu: (l) => esc(fmt.montant(l.montant, l.devise)) },
              { cle: 'libelle', titre: 'Motif' },
              { cle: 'mode_paiement', titre: 'Mode' },
              { cle: 'reference', titre: 'Référence', classe: 'sa-mono' }
            ],
            lignes: d.paiements || [],
            vide: 'Aucun paiement'
          })}
        </div>

        <div data-panneau="historique" style="display:none">
          ${ui.tableau({
            colonnes: [
              { cle: 'created_at', titre: 'Date', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
              { cle: 'action', titre: 'Action', classe: 'sa-mono' },
              { cle: 'par', titre: 'Par' }
            ],
            lignes: d.historique || [],
            vide: 'Aucune trace dans le journal'
          })}
        </div>`;

      const onglets = document.getElementById('onglets-eleve');
      onglets.addEventListener('click', (evenement) => {
        const bouton = evenement.target.closest('[data-onglet]');
        if (!bouton) return;
        onglets.querySelectorAll('.sa-onglet').forEach((o) => o.classList.remove('actif'));
        bouton.classList.add('actif');
        conteneur.querySelectorAll('[data-panneau]').forEach((panneau) => {
          panneau.style.display = panneau.getAttribute('data-panneau') === bouton.getAttribute('data-onglet') ? '' : 'none';
        });
      });
    }
  });

  /* ======================================================================
     Annuaires transversaux (Élèves / Professeurs / Parents / Classes)
     ====================================================================== */

  ['eleves', 'enseignants', 'parents', 'classes'].forEach((ressource) => {
    SA.enregistrerVue(`explorer/annuaire/${ressource}`, {
      titre: RESSOURCES_LIBELLES[ressource],
      sousTitre: 'Consultation par école, en lecture seule.',

      async rendu(conteneur, params) {
        const ecoleId = ecoleParDefaut(params);

        conteneur.innerHTML = BANDEAU_LECTURE;
        const barreEcole = document.createElement('div');
        conteneur.appendChild(barreEcole);

        selecteurEcole(barreEcole, ecoleId, (valeur) =>
          SA.naviguer(`explorer/annuaire/${ressource}`, { ecole_id: valeur }));

        const zone = document.createElement('div');
        conteneur.appendChild(zone);

        if (!ecoleId) {
          zone.innerHTML = ui.etatVide('Choisissez une école', 'La consultation se fait établissement par établissement.');
          return;
        }

        await rendreRessource(zone, ecoleId, ressource, params);
      }
    });
  });

  /* ======================================================================
     Recherche globale
     ====================================================================== */

  const ICONES_FAMILLE = {
    ecole: '🏫', eleve: '🎓', utilisateur: '👤',
    classe: '🚪', bulletin: '📄', paiement: '💳'
  };
  const LIBELLES_FAMILLE = {
    ecole: 'Écoles', eleve: 'Élèves', utilisateur: 'Utilisateurs',
    classe: 'Classes', bulletin: 'Bulletins', paiement: 'Paiements'
  };

  SA.enregistrerVue('explorer/recherche', {
    titre: 'Recherche globale',
    sousTitre: 'Retrouver une école, un élève, un compte, une classe, un bulletin ou un paiement.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = `
        <div class="sa-barre-filtres">
          <input type="search" class="sa-champ sa-champ-recherche" id="champ-recherche-globale"
                 placeholder="Nom, matricule, email, code d'école, référence…"
                 value="${esc(params.q || '')}" autofocus />
          <span class="sa-muet" id="duree-recherche"></span>
        </div>
        <div id="resultats-recherche">
          ${ui.etatVide('Saisissez au moins 2 caractères', 'La recherche porte sur toutes les écoles.')}
        </div>`;

      const champ = document.getElementById('champ-recherche-globale');
      const zone = document.getElementById('resultats-recherche');
      const duree = document.getElementById('duree-recherche');

      async function chercher(q) {
        if (!q || q.trim().length < 2) {
          zone.innerHTML = ui.etatVide('Saisissez au moins 2 caractères', 'La recherche porte sur toutes les écoles.');
          duree.textContent = '';
          return;
        }

        zone.innerHTML = ui.squelette(5, 54);
        SA.majParams({ q });

        try {
          const d = await SA.api(SA.url('/super-admin/recherche', { q }));
          duree.textContent = `${d.total} résultat(s) en ${d.duree_ms} ms`;

          if (!d.total) {
            zone.innerHTML = ui.etatVide('Aucun résultat', `Rien ne correspond à « ${q} ».`);
            return;
          }

          zone.innerHTML = Object.entries(d.groupes).map(([famille, resultats]) => `
            <section class="sa-section">
              <h2 class="sa-section-titre">
                ${esc(ICONES_FAMILLE[famille] || '')} ${esc(LIBELLES_FAMILLE[famille] || famille)}
                <span class="sa-annexe">${resultats.length}</span>
              </h2>
              <div class="sa-conteneur-tableau">
                ${resultats.map((r) => `
                  <div class="sa-resultat" data-famille="${esc(famille)}"
                       data-id="${esc(r.id)}" data-ecole="${esc(r.ecole_id || '')}">
                    <span class="sa-resultat-icone">${esc(ICONES_FAMILLE[famille] || '•')}</span>
                    <div class="sa-resultat-corps">
                      <div class="sa-resultat-titre">${esc(r.titre)}</div>
                      <div class="sa-resultat-detail">${esc(r.sous_titre || '')}</div>
                    </div>
                    <span class="sa-resultat-ecole">${esc(r.ecole_nom || '')}</span>
                  </div>`).join('')}
              </div>
            </section>`).join('');

          zone.querySelectorAll('.sa-resultat').forEach((ligne) => {
            ligne.addEventListener('click', () => {
              const famille = ligne.getAttribute('data-famille');
              const id = ligne.getAttribute('data-id');
              const ecole = ligne.getAttribute('data-ecole');

              if (famille === 'eleve') return SA.naviguer(`explorer/eleve/${id}`);
              if (famille === 'ecole') return SA.naviguer(`explorer/ecole/${id}`);
              if (famille === 'utilisateur') return SA.naviguer('utilisateurs', { recherche: ligne.querySelector('.sa-resultat-titre').textContent.trim() });
              if (ecole) {
                const ressources = { classe: 'classes', bulletin: 'bulletins', paiement: 'paiements' };
                return SA.naviguer(`explorer/ecole/${ecole}`, { ressource: ressources[famille] || 'apercu' });
              }
            });
          });
        } catch (erreur) {
          zone.innerHTML = ui.etatErreur(erreur.message);
        }
      }

      champ.addEventListener('input', SA.antiRebond((e) => chercher(e.target.value), 300));
      if (params.q) chercher(params.q);
    }
  });

  /* ======================================================================
     Mode « Voir comme »
     ====================================================================== */

  const ROLES_OBSERVABLES = [
    { valeur: 'directeur', libelle: 'Directeur' },
    { valeur: 'prefet', libelle: 'Préfet' },
    { valeur: 'professeur', libelle: 'Professeur' },
    { valeur: 'titulaire', libelle: 'Titulaire' },
    { valeur: 'parent', libelle: 'Parent' },
    { valeur: 'comptable', libelle: 'Comptable' },
    { valeur: 'secretaire', libelle: 'Secrétaire' }
  ];

  SA.enregistrerVue('explorer/voir-comme', {
    titre: 'Voir comme…',
    sousTitre: "Observer l'interface d'une école du point de vue d'un rôle donné.",

    async rendu(conteneur, params) {
      const ecoleId = params.ecole_id || '';

      conteneur.innerHTML = `
        <div class="sa-bandeau-lecture sa-bandeau-observation">
          <span>👁</span>
          <span>
            L'observation délivre un jeton temporaire de 30 minutes portant les droits du rôle choisi,
            <strong>strictement en lecture</strong>. Le serveur refuse toute écriture tant qu'il est actif,
            et chaque session d'observation est inscrite au journal d'audit de l'école concernée.
          </span>
        </div>

        <div class="sa-grille-2">
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Démarrer une observation</h3>
            <label class="sa-champ-bloc"><span>École</span>
              ${SA.ui.selecteurEcoles(ecoleId, { libelleVide: 'Choisir une école…' })}
            </label>
            <label class="sa-champ-bloc"><span>Rôle observé</span>
              <select class="sa-champ" id="champ-role">
                ${ROLES_OBSERVABLES.map((r) => `<option value="${esc(r.valeur)}">${esc(r.libelle)}</option>`).join('')}
              </select>
            </label>
            <label class="sa-champ-bloc"><span>Motif (inscrit au journal)</span>
              <input class="sa-champ" id="champ-motif" placeholder="ex. diagnostic ticket TCK-2026-00042" />
            </label>
            <button class="sa-bouton sa-bouton-principal" id="btn-observer">Démarrer l'observation</button>
            <div id="zone-jeton" style="display:none;margin-top:16px"></div>
          </div>

          <div class="sa-panneau">
            <h3 class="sa-section-titre">Comment cela fonctionne</h3>
            <p class="sa-texte">
              Le jeton d'observation porte l'école visée et le rôle choisi, mais reste
              attaché à votre identité : le journal d'audit nomme toujours le Super
              Administrateur, jamais la personne dont l'interface est empruntée.
            </p>
            <p class="sa-texte">
              Les protections tiennent au serveur, pas à l'affichage : toute requête
              autre qu'une lecture est refusée, y compris si elle est émise depuis
              une autre page ou un outil externe.
            </p>
            <p class="sa-note">
              Le jeton expire seul au bout de 30 minutes et ne peut pas être renouvelé.
            </p>
          </div>
        </div>

        <div class="sa-section" style="margin-top:22px">
          <h2 class="sa-section-titre">Observations récentes</h2>
          <div id="zone-observations">${ui.squelette(4)}</div>
        </div>`;

      const selecteur = conteneur.querySelector('[data-filtre="ecole_id"]');

      document.getElementById('btn-observer').addEventListener('click', async (evenement) => {
        const bouton = evenement.currentTarget;
        const ecole = selecteur.value;
        if (!ecole) return SA.toast('Choisissez une école.', 'attention');

        bouton.disabled = true;
        bouton.textContent = 'Ouverture…';

        try {
          const d = await SA.api('/super-admin/observation', {
            method: 'POST',
            body: JSON.stringify({
              ecole_id: ecole,
              role: document.getElementById('champ-role').value,
              motif: document.getElementById('champ-motif').value.trim() || null
            })
          });

          // Le jeton est déposé sous les clés applicatives ordinaires : c'est
          // ce que lisent les pages de l'espace école. Il chasse une éventuelle
          // session d'école ouverte dans cet onglet, jamais la session
          // Super Admin, qui vit sous des clés distinctes.
          try {
            localStorage.setItem('ardoise_access_token', d.jeton_observation);
            localStorage.removeItem('ardoise_refresh_token');
            localStorage.setItem('ardoise_observation', JSON.stringify({
              ecole: d.ecole, role: d.role, expire_at: d.expire_at, observation_id: d.observation_id
            }));
          } catch (e) { /* stockage indisponible : le lien direct reste utilisable */ }

          const zone = document.getElementById('zone-jeton');
          zone.style.display = '';
          zone.innerHTML = `
            <div class="sa-bandeau-lecture sa-bandeau-observation" style="margin:0 0 12px">
              Observation active sur <strong>${esc(d.ecole.nom)}</strong> en tant que
              <strong>${esc(fmt.role(d.role))}</strong>, jusqu'à ${esc(fmt.dateHeure(d.expire_at))}.
            </div>
            <div style="display:flex;gap:9px;flex-wrap:wrap">
              <a class="sa-bouton sa-bouton-principal sa-bouton-petit" target="_blank" rel="noopener"
                 href="${esc(pageDeRole(d.role))}">Ouvrir l'interface ${esc(fmt.role(d.role))}</a>
              <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-fin-observation">Terminer l'observation</button>
            </div>`;

          document.getElementById('btn-fin-observation').addEventListener('click', async () => {
            try {
              if (d.observation_id) {
                await SA.api(`/super-admin/observation/${d.observation_id}/fin`, { method: 'POST' });
              }
              localStorage.removeItem('ardoise_access_token');
              localStorage.removeItem('ardoise_observation');
              SA.toast('Observation terminée.', 'succes');
              SA.rafraichirVue();
            } catch (erreur) {
              SA.toast(erreur.message, 'erreur');
            }
          });

          SA.toast('Observation ouverte. Ouvrez l\'interface dans un nouvel onglet.', 'succes');
        } catch (erreur) {
          SA.toast(erreur.message, 'erreur');
        } finally {
          bouton.disabled = false;
          bouton.textContent = "Démarrer l'observation";
        }
      });

      // Historique
      try {
        const h = await SA.api('/super-admin/observation');
        document.getElementById('zone-observations').innerHTML = ui.tableau({
          colonnes: [
            { cle: 'demarree_at', titre: 'Démarrée', rendu: (l) => esc(fmt.dateHeure(l.demarree_at)) },
            { cle: 'ecole_nom', titre: 'École' },
            { cle: 'role_observe', titre: 'Rôle', rendu: (l) => ui.badge(fmt.role(l.role_observe), 'info') },
            { cle: 'super_admin', titre: 'Par' },
            { cle: 'motif', titre: 'Motif' },
            {
              cle: 'terminee_at', titre: 'État',
              rendu: (l) => l.terminee_at
                ? ui.badge('terminée', 'neutre')
                : (new Date(l.expire_at) > new Date() ? ui.badge('active', 'succes') : ui.badge('expirée', 'neutre'))
            }
          ],
          lignes: h.donnees || [],
          vide: 'Aucune observation enregistrée'
        });
      } catch (erreur) {
        document.getElementById('zone-observations').innerHTML = ui.etatErreur(erreur.message);
      }
    }
  });

  /** Page d'accueil correspondant à chaque rôle observé. */
  function pageDeRole(role) {
    const pages = {
      directeur: 'dashboard-directeur.html',
      prefet: 'dashboard-directeur.html',
      professeur: 'espace-professeur.html',
      titulaire: 'espace-titulaire.html',
      secretaire: 'espace-secretaire.html',
      comptable: 'comptabilite.html',
      parent: 'mon-profil.html'
    };
    return pages[role] || 'dashboard-directeur.html';
  }
})();
