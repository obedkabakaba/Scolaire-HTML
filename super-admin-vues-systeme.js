/* ==========================================================================
   Ardoise — Super Admin : santé, bugs, journal, sécurité, sauvegardes,
   notifications, support, IA, configuration, outils développeur
   --------------------------------------------------------------------------
   Le Journal d'activité s'appuie sur /journal-activite, la route qui existait
   déjà et qui accepte le Super Admin depuis l'origine (avec un filtre par
   école). Aucune route jumelle n'a été créée : deux implémentations du même
   journal finiraient par ne plus dire la même chose.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui } = SA;

  function paginationSimple(zone, route, requete) {
    zone.querySelectorAll('.sa-bouton-page[data-page]').forEach((bouton) => {
      if (bouton.disabled) return;
      bouton.addEventListener('click', () =>
        SA.naviguer(route, Object.assign({}, requete, { page: bouton.getAttribute('data-page') })));
    });
  }

  /* ======================================================================
     Santé de la plateforme
     ====================================================================== */

  SA.enregistrerVue('sante', {
    titre: 'Santé de la plateforme',
    sousTitre: 'API, base de données, serveur, messagerie, cache et stockage.',

    async rendu(conteneur) {
      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `
          <label class="sa-champ-date"><span>Rafraîchissement</span>
            <select class="sa-champ" id="champ-auto">
              <option value="0">Manuel</option>
              <option value="15">15 s</option>
              <option value="60">1 min</option>
            </select>
          </label>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-actualiser-sante">Actualiser</button>`;
      }

      const zone = document.createElement('div');
      zone.innerHTML = ui.squelette(5, 130);
      conteneur.innerHTML = '';
      conteneur.appendChild(zone);

      let minuteur = null;

      async function charger() {
        const d = await SA.api('/super-admin/sante');
        const api = d.api || {};
        const bdd = d.base_de_donnees || {};
        const srv = d.serveur || {};
        const cache = d.cache || {};
        const msg = bdd.messagerie || {};
        const connexions = bdd.connexions || {};

        zone.innerHTML = `
          <div class="sa-grille-stats" style="margin-bottom:20px">
            ${ui.carteStat({ valeur: ui.badgeStatut(srv.etat), etiquette: 'État général', ton: srv.etat === 'operationnel' ? 'succes' : 'attention' })}
            ${ui.carteStat({ valeur: fmt.duree(api.latence_moyenne_ms), etiquette: 'Latence moyenne', detail: `p95 : ${fmt.duree(api.latence_p95_ms)}` })}
            ${ui.carteStat({ valeur: fmt.pourcent(api.taux_erreur), etiquette: "Taux d'erreur", ton: api.taux_erreur > 2 ? 'danger' : 'succes' })}
            ${ui.carteStat({ valeur: fmt.decimal(api.requetes_par_minute), etiquette: 'Requêtes / minute' })}
            ${ui.carteStat({ valeur: fmt.dureeSecondes(srv.uptime_processus_s), etiquette: 'Disponibilité du service' })}
            ${ui.carteStat({ valeur: fmt.nombre(connexions.actives), etiquette: 'Connexions BDD actives', detail: `${fmt.nombre(connexions.total)} au total / ${fmt.nombre(connexions.maximum)} max` })}
          </div>

          <section class="sa-section">
            <h2 class="sa-section-titre">API <span class="sa-annexe">${esc(api.fenetre_minutes)} dernières minutes</span></h2>
            <div class="sa-panneau">
              ${SA.graphe.courbe([
                { nom: 'Requêtes', points: (api.courbe || []).map((c) => ({ x: new Date(c.horodatage).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), y: c.requetes })) },
                { nom: 'Erreurs', points: (api.courbe || []).map((c) => ({ x: '', y: c.erreurs })), couleur: 'var(--rouge)' }
              ], { aire: false })}
            </div>
            <div class="sa-grille-2" style="margin-top:14px">
              <div class="sa-panneau">
                <h3 class="sa-section-titre">Routes les plus lentes</h3>
                ${ui.tableau({
                  colonnes: [
                    { cle: 'route', titre: 'Route', classe: 'sa-mono' },
                    { cle: 'nb', titre: 'Appels', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb) },
                    { cle: 'moyenne_ms', titre: 'Moyenne', classe: 'sa-num', rendu: (l) => esc(fmt.duree(l.moyenne_ms)) },
                    { cle: 'max_ms', titre: 'Pire', classe: 'sa-num', rendu: (l) => esc(fmt.duree(l.max_ms)) }
                  ],
                  lignes: api.routes_les_plus_lentes || [],
                  vide: 'Aucune requête mesurée'
                })}
              </div>
              <div class="sa-panneau">
                <h3 class="sa-section-titre">Réponses par famille de code</h3>
                ${SA.graphe.repartition(Object.entries(api.par_statut || {}).map(([code, nb]) => ({
                  libelle: code, valeur: nb,
                  couleur: code === '5xx' ? 'var(--rouge)' : code === '4xx' ? 'var(--ocre)' : 'var(--vert-ok)'
                })))}
                <div class="sa-liste-infos" style="margin-top:14px">
                  <div class="sa-ligne-info"><span>Requêtes lentes (&gt; 1,5 s)</span><span>${esc(fmt.nombre(api.requetes_lentes))}</span></div>
                  <div class="sa-ligne-info"><span>Médiane</span><span>${esc(fmt.duree(api.latence_p50_ms))}</span></div>
                  <div class="sa-ligne-info"><span>p99</span><span>${esc(fmt.duree(api.latence_p99_ms))}</span></div>
                  <div class="sa-ligne-info"><span>Depuis le démarrage</span><span>${esc(fmt.nombre(api.total_depuis_demarrage))} requêtes</span></div>
                </div>
              </div>
            </div>
          </section>

          <section class="sa-section">
            <h2 class="sa-section-titre">Base de données</h2>
            <div class="sa-grille-2">
              <div class="sa-panneau">
                <h3 class="sa-section-titre">Connexions et verrous</h3>
                <div class="sa-liste-infos">
                  <div class="sa-ligne-info"><span>Connexions actives</span><span>${esc(fmt.nombre(connexions.actives))}</span></div>
                  <div class="sa-ligne-info"><span>Connexions inactives</span><span>${esc(fmt.nombre(connexions.inactives))}</span></div>
                  <div class="sa-ligne-info"><span>En attente d'un verrou</span><span>${esc(fmt.nombre(connexions.en_attente_verrou))}</span></div>
                  <div class="sa-ligne-info"><span>Verrous bloquants</span><span>${ui.badge(fmt.nombre(bdd.verrous && bdd.verrous.verrous_bloquants), (bdd.verrous && Number(bdd.verrous.verrous_bloquants)) ? 'danger' : 'succes')}</span></div>
                  <div class="sa-ligne-info"><span>Taille de la base</span><span>${esc((bdd.taille && bdd.taille.lisible) || '—')}</span></div>
                  <div class="sa-ligne-info"><span>Pool applicatif</span><span>${esc(fmt.nombre(bdd.pool && bdd.pool.total))} ouvertes · ${esc(fmt.nombre(bdd.pool && bdd.pool.libres))} libres</span></div>
                </div>
              </div>
              <div class="sa-panneau">
                <h3 class="sa-section-titre">Requêtes en cours &gt; 3 s</h3>
                ${ui.tableau({
                  colonnes: [
                    { cle: 'duree_s', titre: 'Durée', classe: 'sa-num', rendu: (l) => `${esc(l.duree_s)} s` },
                    { cle: 'requete', titre: 'Requête', classe: 'sa-mono', rendu: (l) => `<span class="sa-tronque" title="${esc(l.requete)}">${esc(l.requete)}</span>` }
                  ],
                  lignes: bdd.requetes_lentes || [],
                  vide: 'Aucune requête lente en cours'
                })}
              </div>
            </div>
            <div class="sa-panneau" style="margin-top:14px">
              <h3 class="sa-section-titre">Tables les plus volumineuses</h3>
              ${SA.graphe.barres((bdd.tables_volumineuses || []).map((t) => ({
                libelle: t.table_nom, valeur: Number(t.octets)
              })), { format: fmt.octets, couleur: 'var(--encre)' })}
            </div>
          </section>

          <section class="sa-section">
            <h2 class="sa-section-titre">Serveur</h2>
            <div class="sa-grille-3">
              <div class="sa-panneau">
                <h3 class="sa-section-titre">Processeur</h3>
                <div class="sa-liste-infos">
                  <div class="sa-ligne-info"><span>Cœurs</span><span>${esc(fmt.nombre(srv.cpu && srv.cpu.coeurs))}</span></div>
                  <div class="sa-ligne-info"><span>Charge 1 min</span><span>${esc(fmt.decimal(srv.cpu && srv.cpu.charge_1min, 2))}</span></div>
                  <div class="sa-ligne-info"><span>Charge 5 min</span><span>${esc(fmt.decimal(srv.cpu && srv.cpu.charge_5min, 2))}</span></div>
                  <div class="sa-ligne-info"><span>Charge 15 min</span><span>${esc(fmt.decimal(srv.cpu && srv.cpu.charge_15min, 2))}</span></div>
                </div>
              </div>
              <div class="sa-panneau">
                <h3 class="sa-section-titre">Mémoire</h3>
                ${SA.graphe.anneau({
                  valeur: (srv.memoire && srv.memoire.taux_occupation) || 0, max: 100,
                  libelle: 'occupée', unite: '%',
                  ton: (srv.memoire && srv.memoire.taux_occupation) > 85 ? 'danger' : 'succes'
                })}
                <div class="sa-liste-infos" style="margin-top:10px">
                  <div class="sa-ligne-info"><span>Processus</span><span>${esc(fmt.nombre(srv.memoire && srv.memoire.processus_rss_mo))} Mo</span></div>
                  <div class="sa-ligne-info"><span>Machine</span><span>${esc(fmt.nombre(srv.memoire && srv.memoire.machine_totale_mo))} Mo</span></div>
                </div>
              </div>
              <div class="sa-panneau">
                <h3 class="sa-section-titre">Environnement</h3>
                <div class="sa-liste-infos">
                  <div class="sa-ligne-info"><span>Node</span><span class="sa-mono">${esc(srv.node)}</span></div>
                  <div class="sa-ligne-info"><span>Plateforme</span><span>${esc(srv.plateforme)}</span></div>
                  <div class="sa-ligne-info"><span>Hôte</span><span class="sa-mono">${esc(srv.reseau && srv.reseau.nom_hote)}</span></div>
                  <div class="sa-ligne-info"><span>Machine active depuis</span><span>${esc(fmt.dureeSecondes(srv.uptime_machine_s))}</span></div>
                </div>
              </div>
            </div>
          </section>

          <section class="sa-section">
            <h2 class="sa-section-titre">Messagerie, cache et stockage</h2>
            <div class="sa-grille-3">
              <div class="sa-panneau">
                <h3 class="sa-section-titre">Emails et notifications</h3>
                <div class="sa-liste-infos">
                  <div class="sa-ligne-info"><span>Emails envoyés</span><span>${esc(fmt.nombre(msg.emails_envoyes))}</span></div>
                  <div class="sa-ligne-info"><span>Emails en échec</span><span>${ui.badge(fmt.nombre(msg.emails_echoues), Number(msg.emails_echoues) ? 'danger' : 'succes')}</span></div>
                  <div class="sa-ligne-info"><span>Notifications envoyées</span><span>${esc(fmt.nombre(msg.notifications_envoyees))}</span></div>
                  <div class="sa-ligne-info"><span>Notifications en échec</span><span>${ui.badge(fmt.nombre(msg.notifications_echouees), Number(msg.notifications_echouees) ? 'attention' : 'succes')}</span></div>
                  <div class="sa-ligne-info"><span>WhatsApp envoyés</span><span>${esc(fmt.nombre(msg.whatsapp_envoyes))}</span></div>
                  <div class="sa-ligne-info"><span>WhatsApp en échec</span><span>${esc(fmt.nombre(msg.whatsapp_echoues))}</span></div>
                </div>
              </div>
              <div class="sa-panneau">
                <h3 class="sa-section-titre">Cache</h3>
                ${SA.graphe.anneau({
                  valeur: cache.taux_succes || 0, max: 100, libelle: 'de succès', unite: '%',
                  ton: (cache.taux_succes || 0) > 50 ? 'succes' : 'attention'
                })}
                <div class="sa-liste-infos" style="margin-top:10px">
                  <div class="sa-ligne-info"><span>État</span><span>${ui.badgeStatut(cache.etat)}</span></div>
                  <div class="sa-ligne-info"><span>Entrées</span><span>${esc(fmt.nombre(cache.entrees))} / ${esc(fmt.nombre(cache.capacite))}</span></div>
                  <div class="sa-ligne-info"><span>Occupation</span><span>${esc(fmt.pourcent(cache.taux_occupation))}</span></div>
                  <div class="sa-ligne-info"><span>Évictions</span><span>${esc(fmt.nombre(cache.evictions))}</span></div>
                </div>
              </div>
              <div class="sa-panneau">
                <h3 class="sa-section-titre">Stockage</h3>
                <div class="sa-liste-infos">
                  <div class="sa-ligne-info"><span>Fournisseur</span><span>${esc(d.stockage && d.stockage.fournisseur)}</span></div>
                  <div class="sa-ligne-info"><span>Bucket</span><span class="sa-mono">${esc(d.stockage && d.stockage.bucket)}</span></div>
                  <div class="sa-ligne-info"><span>Documents</span><span>${esc(fmt.nombre(d.stockage && d.stockage.documents))}</span></div>
                </div>
                <p class="sa-note" style="margin-top:12px">${esc(d.stockage && d.stockage.note)}</p>
              </div>
            </div>
          </section>

          <section class="sa-section">
            <h2 class="sa-section-titre">Services externes</h2>
            ${ui.tableau({
              colonnes: [
                { cle: 'service', titre: 'Service' },
                { cle: 'variable', titre: "Variable d'environnement", classe: 'sa-mono' },
                { cle: 'defini', titre: 'État', rendu: (l) => ui.badge(l.defini ? 'configuré' : 'absent', l.defini ? 'succes' : 'danger') },
                { cle: 'apercu', titre: 'Empreinte', classe: 'sa-mono', rendu: (l) => l.apercu ? esc(l.apercu) : '<span class="sa-muet">—</span>' }
              ],
              lignes: d.services_externes || [],
              vide: 'Aucun service déclaré'
            })}
            <p class="sa-note" style="margin-top:12px">
              Seule la présence des clés est affichée, jamais leur contenu.
              L'empreinte (trois premiers et deux derniers caractères) permet de
              vérifier qu'il s'agit bien de la clé attendue sans jamais la révéler.
            </p>
          </section>`;
      }

      await charger();

      const boutonActualiser = document.getElementById('btn-actualiser-sante');
      if (boutonActualiser) boutonActualiser.addEventListener('click', () => charger().catch((e) => SA.toast(e.message, 'erreur')));

      const champAuto = document.getElementById('champ-auto');
      if (champAuto) {
        champAuto.addEventListener('change', () => {
          clearInterval(minuteur);
          const secondes = Number(champAuto.value);
          if (!secondes) return;
          minuteur = setInterval(() => {
            // La vue a pu changer entre-temps : on arrête plutôt que de
            // réécrire par-dessus une autre page.
            if (!document.body.contains(zone)) return clearInterval(minuteur);
            charger().catch(() => clearInterval(minuteur));
          }, secondes * 1000);
        });
      }
    }
  });

  /* ======================================================================
     Bugs et erreurs
     ====================================================================== */

  SA.enregistrerVue('bugs', {
    titre: 'Bugs & erreurs',
    sousTitre: 'Erreurs remontées par les interfaces et par le serveur, regroupées par empreinte.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = '';
      const barre = document.createElement('div');
      const zone = document.createElement('div');
      zone.innerHTML = ui.squelette(8);
      conteneur.append(barre, zone);

      const filtres = SA.ui.barreFiltres(barre, [
        { type: 'recherche', nom: 'recherche', libelle: 'Message, page, pile d\'appels…', valeur: params.recherche },
        {
          type: 'select', nom: 'statut', libelle: 'Tous les statuts', valeur: params.statut,
          options: [
            { valeur: 'ouvert', libelle: 'Ouverts' },
            { valeur: 'en_cours', libelle: 'En cours' },
            { valeur: 'resolu', libelle: 'Résolus' },
            { valeur: 'ignore', libelle: 'Ignorés' }
          ]
        },
        {
          type: 'select', nom: 'gravite', libelle: 'Toutes les gravités', valeur: params.gravite,
          options: [
            { valeur: 'critique', libelle: 'Critique' },
            { valeur: 'haute', libelle: 'Haute' },
            { valeur: 'moyenne', libelle: 'Moyenne' },
            { valeur: 'basse', libelle: 'Basse' }
          ]
        },
        {
          type: 'select', nom: 'origine', libelle: 'Toutes les origines', valeur: params.origine,
          options: [
            { valeur: 'frontend', libelle: 'Interface' },
            { valeur: 'backend', libelle: 'Serveur' },
            { valeur: 'job', libelle: 'Tâche planifiée' }
          ]
        },
        { type: 'ecoles', nom: 'ecole_id', libelle: 'Toutes les écoles', valeur: params.ecole_id }
      ], (valeurs) => SA.naviguer('bugs', Object.assign({}, valeurs, { page: 1 })));

      const requete = Object.assign({}, filtres.lire(), { page: params.page || 1 });
      const d = await SA.api(SA.url('/super-admin/bugs', requete));
      const s = d.statistiques || {};

      zone.innerHTML = `
        <div class="sa-grille-stats" style="margin-bottom:16px">
          ${ui.carteStat({ valeur: fmt.nombre(s.ouverts), etiquette: 'Ouverts', ton: Number(s.ouverts) ? 'attention' : 'succes' })}
          ${ui.carteStat({ valeur: fmt.nombre(s.en_cours), etiquette: 'En cours', ton: 'info' })}
          ${ui.carteStat({ valeur: fmt.nombre(s.critiques), etiquette: 'Critiques non résolus', ton: Number(s.critiques) ? 'danger' : 'succes' })}
          ${ui.carteStat({ valeur: fmt.nombre(s.resolus), etiquette: 'Résolus' })}
          ${ui.carteStat({ valeur: fmt.nombre(s.occurrences_totales), etiquette: 'Occurrences cumulées' })}
        </div>

        ${ui.tableau({
          cliquable: true,
          colonnes: [
            { cle: 'gravite', titre: 'Gravité', rendu: (l) => ui.badgeStatut(l.gravite) },
            {
              cle: 'message', titre: 'Erreur',
              rendu: (l) => `<span class="sa-tronque" title="${esc(l.message)}">${esc(l.message)}</span>
                             <div class="sa-muet" style="font-size:.74rem">${esc(l.page || l.chemin || '—')}</div>`
            },
            { cle: 'origine', titre: 'Origine', rendu: (l) => ui.badge(l.origine, 'neutre') },
            { cle: 'ecole_nom', titre: 'École' },
            { cle: 'occurrences', titre: 'Occurrences', classe: 'sa-num', rendu: (l) => fmt.nombre(l.occurrences) },
            { cle: 'derniere_occurrence', titre: 'Dernière', rendu: (l) => esc(fmt.relatif(l.derniere_occurrence)) },
            { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) }
          ],
          lignes: d.donnees,
          vide: 'Aucun bug enregistré'
        })}
        ${ui.pagination(d.pagination)}`;

      paginationSimple(zone, 'bugs', requete);
      zone.querySelectorAll('tbody tr[data-id]').forEach((ligne) => {
        ligne.addEventListener('click', () => ouvrirBug(ligne.getAttribute('data-id')));
      });
    }
  });

  async function ouvrirBug(id) {
    const modale = SA.modale({ titre: 'Chargement…', large: true, contenu: ui.squelette(5) });

    let d;
    try {
      d = await SA.api(`/super-admin/bugs/${id}`);
    } catch (erreur) {
      modale.querySelector('.sa-modale-corps').innerHTML = ui.etatErreur(erreur.message);
      return;
    }

    const b = d.bug;
    modale.querySelector('.sa-modale-entete h2').textContent = 'Détail de l\'erreur';

    modale.querySelector('.sa-modale-corps').innerHTML = `
      <div class="sa-liste-infos">
        <div class="sa-ligne-info"><span>Message</span><span>${esc(b.message)}</span></div>
        <div class="sa-ligne-info"><span>Origine</span><span>${ui.badge(b.origine, 'neutre')}</span></div>
        <div class="sa-ligne-info"><span>Page</span><span class="sa-mono">${esc(b.page || '—')}</span></div>
        <div class="sa-ligne-info"><span>Requête</span><span class="sa-mono">${esc([b.methode, b.chemin].filter(Boolean).join(' ') || '—')}${b.code_http ? ' → ' + esc(b.code_http) : ''}</span></div>
        <div class="sa-ligne-info"><span>École</span><span>${esc(b.ecole_nom || '—')}</span></div>
        <div class="sa-ligne-info"><span>Utilisateur</span><span>${esc(b.utilisateur || '—')}${b.utilisateur_email ? ' · ' + esc(b.utilisateur_email) : ''}</span></div>
        <div class="sa-ligne-info"><span>Navigateur</span><span><span class="sa-tronque" title="${esc(b.navigateur)}">${esc(b.navigateur || '—')}</span></span></div>
        <div class="sa-ligne-info"><span>Système</span><span>${esc(b.systeme || '—')}</span></div>
        <div class="sa-ligne-info"><span>Occurrences</span><span>${esc(fmt.nombre(b.occurrences))}</span></div>
        <div class="sa-ligne-info"><span>Première fois</span><span>${esc(fmt.dateHeure(b.premiere_occurrence))}</span></div>
        <div class="sa-ligne-info"><span>Dernière fois</span><span>${esc(fmt.dateHeure(b.derniere_occurrence))}</span></div>
      </div>

      ${b.stack ? `<h4 class="sa-section-titre" style="margin-top:18px">Pile d'appels</h4>
        <div class="sa-bloc-code">${esc(b.stack)}</div>` : ''}

      <h4 class="sa-section-titre" style="margin-top:18px">Traitement</h4>
      <div class="sa-grille-2">
        <label class="sa-champ-bloc"><span>Statut</span>
          <select class="sa-champ" id="bug-statut">
            ${['ouvert', 'en_cours', 'resolu', 'ignore'].map((v) =>
              `<option value="${v}" ${b.statut === v ? 'selected' : ''}>${v.replace('_', ' ')}</option>`).join('')}
          </select>
        </label>
        <label class="sa-champ-bloc"><span>Gravité</span>
          <select class="sa-champ" id="bug-gravite">
            ${['basse', 'moyenne', 'haute', 'critique'].map((v) =>
              `<option value="${v}" ${b.gravite === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </label>
      </div>
      <button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="bug-enregistrer">Enregistrer</button>

      <h4 class="sa-section-titre" style="margin-top:22px">Commentaires</h4>
      <div id="bug-commentaires">
        ${(d.commentaires || []).length
          ? d.commentaires.map((c) => `
              <div class="sa-panneau" style="margin-bottom:8px">
                <div class="sa-muet" style="font-size:.76rem">${esc(c.auteur || 'inconnu')} · ${esc(fmt.dateHeure(c.created_at))}</div>
                <div style="margin-top:5px;font-size:.88rem">${esc(c.contenu)}</div>
              </div>`).join('')
          : `<p class="sa-muet">Aucun commentaire.</p>`}
      </div>
      <label class="sa-champ-bloc" style="margin-top:12px"><span>Ajouter un commentaire</span>
        <textarea class="sa-champ" id="bug-commentaire" placeholder="Diagnostic, cause identifiée, correctif prévu…"></textarea>
      </label>
      <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="bug-commenter">Publier</button>`;

    modale.querySelector('#bug-enregistrer').addEventListener('click', async (evenement) => {
      const bouton = evenement.currentTarget;
      bouton.disabled = true;
      try {
        await SA.api(`/super-admin/bugs/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            statut: modale.querySelector('#bug-statut').value,
            gravite: modale.querySelector('#bug-gravite').value
          })
        });
        SA.toast('Bug mis à jour.', 'succes');
        modale.fermer();
        SA.rafraichirVue();
      } catch (erreur) {
        SA.toast(erreur.message, 'erreur');
        bouton.disabled = false;
      }
    });

    modale.querySelector('#bug-commenter').addEventListener('click', async () => {
      const champ = modale.querySelector('#bug-commentaire');
      if (!champ.value.trim()) return;
      try {
        await SA.api(`/super-admin/bugs/${id}/commentaires`, {
          method: 'POST',
          body: JSON.stringify({ contenu: champ.value.trim() })
        });
        SA.toast('Commentaire publié.', 'succes');
        modale.fermer();
        ouvrirBug(id);
      } catch (erreur) {
        SA.toast(erreur.message, 'erreur');
      }
    });
  }

  /* ======================================================================
     Journal d'activité (route existante /journal-activite)
     ====================================================================== */

  SA.enregistrerVue('journal', {
    titre: "Journal d'activité",
    sousTitre: 'Toutes les actions de tous les utilisateurs, toutes écoles confondues.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = '';
      const barre = document.createElement('div');
      const zone = document.createElement('div');
      zone.innerHTML = ui.squelette(10);
      conteneur.append(barre, zone);

      let filtresDisponibles = { actions: [], auteurs: [] };
      try {
        filtresDisponibles = await SA.api(SA.url('/journal-activite/filtres', { ecoleId: params.ecoleId }));
      } catch (e) { /* les listes resteront vides, la recherche libre suffit */ }

      const filtres = SA.ui.barreFiltres(barre, [
        { type: 'recherche', nom: 'recherche', libelle: 'Action, personne, contenu…', valeur: params.recherche },
        { type: 'ecoles', nom: 'ecoleId', libelle: 'Toutes les écoles', valeur: params.ecoleId },
        {
          type: 'select', nom: 'action', libelle: 'Toutes les actions', valeur: params.action,
          options: (filtresDisponibles.actions || []).map((a) => ({
            valeur: a.action, libelle: `${a.action} (${a.nb})`
          }))
        },
        {
          type: 'select', nom: 'resultat', libelle: 'Tous les résultats', valeur: params.resultat,
          options: [
            { valeur: 'succes', libelle: 'Succès' },
            { valeur: 'echec', libelle: 'Échecs' }
          ]
        },
        {
          type: 'select', nom: 'source', libelle: 'Toutes les sources', valeur: params.source,
          options: [
            { valeur: 'metier', libelle: 'Événements métier' },
            { valeur: 'automatique', libelle: 'Trace automatique' }
          ]
        },
        { type: 'date', nom: 'depuis', libelle: 'Du', valeur: params.depuis },
        { type: 'date', nom: 'jusqu', libelle: 'Au', valeur: params.jusqu }
      ], (valeurs) => SA.naviguer('journal', Object.assign({}, valeurs, { page: 1 })));

      const page = Math.max(1, parseInt(params.page, 10) || 1);
      const taille = 50;

      const requete = Object.assign({}, filtres.lire(), {
        limit: taille, offset: (page - 1) * taille
      });

      const d = await SA.api(SA.url('/journal-activite', requete));

      zone.innerHTML = ui.tableau({
        cliquable: true,
        colonnes: [
          { cle: 'created_at', titre: 'Horodatage', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
          {
            cle: 'action_libelle', titre: 'Action',
            rendu: (l) => `${esc(l.action_libelle)}
                           <div class="sa-muet sa-mono" style="font-size:.72rem">${esc(l.action)}</div>`
          },
          {
            cle: 'utilisateur', titre: 'Par',
            rendu: (l) => l.utilisateur_nom
              ? `${esc([l.utilisateur_prenom, l.utilisateur_nom].filter(Boolean).join(' '))}
                 <div class="sa-muet" style="font-size:.73rem">${esc(l.utilisateur_email || '')}</div>`
              : '<span class="sa-muet">système</span>'
          },
          { cle: 'cible_type', titre: 'Cible' },
          {
            cle: 'reussite', titre: 'Résultat',
            rendu: (l) => ui.badge(l.reussite ? 'succès' : 'échec', l.reussite ? 'succes' : 'danger')
          },
          {
            cle: 'automatique', titre: 'Source',
            rendu: (l) => ui.badge(l.automatique ? 'automatique' : 'métier', l.automatique ? 'neutre' : 'info')
          }
        ],
        lignes: d.entrees || [],
        vide: 'Aucune entrée ne correspond'
      }) + ui.pagination({
        page,
        taille,
        total: d.total,
        pages: Math.max(1, Math.ceil((d.total || 0) / taille))
      });

      paginationSimple(zone, 'journal', filtres.lire());

      zone.querySelectorAll('tbody tr[data-index]').forEach((ligne) => {
        ligne.addEventListener('click', () => {
          const entree = (d.entrees || [])[Number(ligne.getAttribute('data-index'))];
          if (!entree) return;
          SA.modale({
            titre: entree.action_libelle,
            sousTitre: fmt.dateHeure(entree.created_at),
            contenu: `
              <div class="sa-liste-infos">
                <div class="sa-ligne-info"><span>Code technique</span><span class="sa-mono">${esc(entree.action)}</span></div>
                <div class="sa-ligne-info"><span>Type de cible</span><span>${esc(entree.cible_type || '—')}</span></div>
                <div class="sa-ligne-info"><span>Identifiant cible</span><span class="sa-mono">${esc(entree.cible_id || '—')}</span></div>
                <div class="sa-ligne-info"><span>Utilisateur</span><span>${esc([entree.utilisateur_prenom, entree.utilisateur_nom].filter(Boolean).join(' ') || 'système')}</span></div>
              </div>
              <h4 class="sa-section-titre" style="margin-top:16px">Métadonnées</h4>
              <div class="sa-bloc-code">${esc(JSON.stringify(entree.metadata || {}, null, 2))}</div>`,
            large: true
          });
        });
      });
    }
  });

  /* ======================================================================
     Sécurité
     ====================================================================== */

  SA.enregistrerVue('securite', {
    titre: 'Sécurité',
    sousTitre: 'Connexions, sessions, comptes verrouillés et signaux inhabituels.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = '';
      const barre = document.createElement('div');
      const zone = document.createElement('div');
      zone.innerHTML = ui.squelette(6, 110);
      conteneur.append(barre, zone);

      SA.ui.barreFiltres(barre, [
        {
          type: 'select', nom: 'jours', libelle: 'Période', valeur: params.jours || '7',
          options: [
            { valeur: '1', libelle: '24 heures' },
            { valeur: '7', libelle: '7 jours' },
            { valeur: '30', libelle: '30 jours' },
            { valeur: '90', libelle: '90 jours' }
          ]
        }
      ], (valeurs) => SA.naviguer('securite', valeurs));

      const d = await SA.api(SA.url('/super-admin/securite', { jours: params.jours || 7 }));
      const r = d.resume || {};

      zone.innerHTML = `
        <div class="sa-grille-stats" style="margin-bottom:18px">
          ${ui.carteStat({ valeur: fmt.nombre(r.sessions_actives), etiquette: 'Sessions ouvertes', ton: 'info' })}
          ${ui.carteStat({ valeur: fmt.nombre(r.echecs_periode), etiquette: 'Échecs de connexion', ton: Number(r.echecs_periode) > 20 ? 'danger' : null })}
          ${ui.carteStat({ valeur: fmt.nombre(r.comptes_bloques), etiquette: 'Comptes non actifs', ton: Number(r.comptes_bloques) ? 'attention' : 'succes' })}
          ${ui.carteStat({ valeur: fmt.nombre(r.mots_de_passe_provisoires), etiquette: 'Mots de passe provisoires' })}
          ${ui.carteStat({ valeur: fmt.nombre(r.observations_periode), etiquette: 'Observations Super Admin' })}
          ${ui.carteStat({ valeur: fmt.nombre((d.adresses_suspectes || []).length), etiquette: 'Adresses à surveiller', ton: (d.adresses_suspectes || []).length ? 'attention' : 'succes' })}
        </div>

        <div class="sa-onglets" id="onglets-securite">
          <button class="sa-onglet actif" data-onglet="sessions">Sessions ouvertes</button>
          <button class="sa-onglet" data-onglet="echecs">Tentatives échouées</button>
          <button class="sa-onglet" data-onglet="ip">Adresses suspectes</button>
          <button class="sa-onglet" data-onglet="comptes">Comptes verrouillés</button>
          <button class="sa-onglet" data-onglet="appareils">Appareils</button>
          <button class="sa-onglet" data-onglet="signaux">Signaux inhabituels</button>
        </div>

        <div data-panneau="sessions">
          ${ui.tableau({
            colonnes: [
              { cle: 'utilisateur', titre: 'Utilisateur', rendu: (l) => `${esc(l.utilisateur || '—')}<div class="sa-muet" style="font-size:.74rem">${esc(l.email || '')}</div>` },
              { cle: 'ecole_nom', titre: 'École' },
              { cle: 'roles', titre: 'Rôles' },
              { cle: 'ip', titre: 'Adresse IP', classe: 'sa-mono' },
              { cle: 'appareil', titre: 'Appareil', rendu: (l) => `${esc(l.appareil.navigateur)} · ${esc(l.appareil.systeme)} <span class="sa-muet">(${esc(l.appareil.type)})</span>` },
              { cle: 'created_at', titre: 'Ouverte', rendu: (l) => esc(fmt.relatif(l.created_at)) },
              { cle: 'expire_at', titre: 'Expire', rendu: (l) => esc(fmt.dateHeure(l.expire_at)) }
            ],
            lignes: d.sessions_ouvertes || [],
            vide: 'Aucune session ouverte'
          })}
        </div>

        <div data-panneau="echecs" style="display:none">
          ${ui.tableau({
            colonnes: [
              { cle: 'created_at', titre: 'Horodatage', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
              { cle: 'email', titre: 'Identifiant tenté' },
              { cle: 'ip', titre: 'Adresse IP', classe: 'sa-mono' },
              { cle: 'ecole_nom', titre: 'École' },
              { cle: 'motif', titre: 'Motif' }
            ],
            lignes: d.tentatives_echouees || [],
            vide: 'Aucune tentative échouée sur la période'
          })}
        </div>

        <div data-panneau="ip" style="display:none">
          <p class="sa-note" style="margin-bottom:12px">
            Adresses ayant accumulé au moins trois échecs de connexion sur la période.
            Un chiffre élevé n'est pas nécessairement une attaque : un mot de passe
            oublié dans une salle des professeurs produit le même signal.
          </p>
          ${ui.tableau({
            colonnes: [
              { cle: 'ip', titre: 'Adresse IP', classe: 'sa-mono' },
              { cle: 'tentatives', titre: 'Tentatives', classe: 'sa-num', rendu: (l) => fmt.nombre(l.tentatives) },
              { cle: 'echecs', titre: 'Échecs', classe: 'sa-num', rendu: (l) => ui.badge(fmt.nombre(l.echecs), Number(l.echecs) > 10 ? 'danger' : 'attention') },
              { cle: 'derniere', titre: 'Dernière', rendu: (l) => esc(fmt.relatif(l.derniere)) }
            ],
            lignes: d.adresses_suspectes || [],
            vide: 'Aucune adresse à surveiller'
          })}
        </div>

        <div data-panneau="comptes" style="display:none">
          ${ui.tableau({
            colonnes: [
              { cle: 'nom', titre: 'Compte', rendu: (l) => `${esc([l.prenom, l.nom].filter(Boolean).join(' '))}<div class="sa-muet" style="font-size:.74rem">${esc(l.email)}</div>` },
              { cle: 'ecole_nom', titre: 'École' },
              { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) },
              { cle: 'mot_de_passe_provisoire', titre: 'Mot de passe', rendu: (l) => l.mot_de_passe_provisoire ? ui.badge('provisoire', 'attention') : '<span class="sa-muet">définitif</span>' }
            ],
            lignes: d.comptes_verrouilles || [],
            vide: 'Aucun compte verrouillé'
          })}
        </div>

        <div data-panneau="appareils" style="display:none">
          ${ui.tableau({
            colonnes: [
              { cle: 'appareil', titre: 'Appareil', rendu: (l) => `${esc(l.appareil.navigateur)} · ${esc(l.appareil.systeme)}` },
              { cle: 'type', titre: 'Type', rendu: (l) => ui.badge(l.appareil.type, 'neutre') },
              { cle: 'nb', titre: 'Sessions', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb) }
            ],
            lignes: d.appareils || [],
            vide: 'Aucun appareil connecté'
          })}
        </div>

        <div data-panneau="signaux" style="display:none">
          <p class="sa-note" style="margin-bottom:12px">
            Comptes vus depuis au moins trois adresses différentes sur la période.
            À rapprocher du contexte : un directeur en déplacement et un compte partagé
            produisent le même motif.
          </p>
          ${ui.tableau({
            colonnes: [
              { cle: 'utilisateur', titre: 'Utilisateur', rendu: (l) => `${esc(l.utilisateur)}<div class="sa-muet" style="font-size:.74rem">${esc(l.email)}</div>` },
              { cle: 'ecole_nom', titre: 'École' },
              { cle: 'nb_adresses', titre: 'Adresses', classe: 'sa-num', rendu: (l) => ui.badge(fmt.nombre(l.nb_adresses), Number(l.nb_adresses) > 5 ? 'danger' : 'attention') },
              { cle: 'nb_sessions', titre: 'Sessions', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb_sessions) },
              { cle: 'derniere', titre: 'Dernière', rendu: (l) => esc(fmt.relatif(l.derniere)) }
            ],
            lignes: d.activites_suspectes || [],
            vide: 'Aucun signal inhabituel'
          })}
        </div>`;

      brancherOnglets(zone, 'onglets-securite');
    }
  });

  function brancherOnglets(racine, idOnglets) {
    const onglets = document.getElementById(idOnglets);
    if (!onglets) return;
    onglets.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('[data-onglet]');
      if (!bouton) return;
      onglets.querySelectorAll('.sa-onglet').forEach((o) => o.classList.remove('actif'));
      bouton.classList.add('actif');
      racine.querySelectorAll('[data-panneau]').forEach((panneau) => {
        panneau.style.display = panneau.getAttribute('data-panneau') === bouton.getAttribute('data-onglet') ? '' : 'none';
      });
    });
  }

  /* ======================================================================
     Sauvegardes
     ====================================================================== */

  SA.enregistrerVue('sauvegardes', {
    titre: 'Sauvegardes',
    sousTitre: 'Registre des exports déclenchés depuis Ardoise.',

    async rendu(conteneur, params) {
      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `<button class="sa-bouton sa-bouton-principal" id="btn-sauvegarder">Lancer une sauvegarde</button>`;
      }

      const zone = document.createElement('div');
      zone.innerHTML = ui.squelette(7);
      conteneur.innerHTML = '';
      conteneur.appendChild(zone);

      const requete = { page: params.page || 1 };
      const d = await SA.api(SA.url('/super-admin/sauvegardes', requete));
      const s = d.statistiques || {};

      zone.innerHTML = `
        <div class="sa-bandeau-lecture" style="margin-bottom:16px">
          <span>ℹ️</span>
          <span>${esc(d.pitr && d.pitr.note)}</span>
        </div>

        <div class="sa-grille-stats" style="margin-bottom:16px">
          ${ui.carteStat({ valeur: fmt.nombre(s.total), etiquette: 'Sauvegardes enregistrées' })}
          ${ui.carteStat({ valeur: fmt.nombre(s.reussies), etiquette: 'Réussies', ton: 'succes' })}
          ${ui.carteStat({ valeur: fmt.nombre(s.echouees), etiquette: 'Échouées', ton: Number(s.echouees) ? 'danger' : null })}
          ${ui.carteStat({ valeur: fmt.relatif(s.derniere_reussie), etiquette: 'Dernière réussie' })}
          ${ui.carteStat({ valeur: fmt.duree(s.duree_moyenne_ms), etiquette: 'Durée moyenne' })}
        </div>

        ${ui.tableau({
          colonnes: [
            { cle: 'demarree_at', titre: 'Date', rendu: (l) => esc(fmt.dateHeure(l.demarree_at)) },
            { cle: 'type', titre: 'Type', rendu: (l) => ui.badge(l.type, 'neutre') },
            { cle: 'portee', titre: 'Portée', rendu: (l) => esc(l.ecole_nom || l.portee) },
            { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) },
            { cle: 'taille_octets', titre: 'Taille', classe: 'sa-num', rendu: (l) => esc(fmt.octets(l.taille_octets)) },
            { cle: 'duree_ms', titre: 'Durée', classe: 'sa-num', rendu: (l) => esc(fmt.duree(l.duree_ms)) },
            { cle: 'declenchee_par_nom', titre: 'Déclenchée par' },
            {
              cle: 'actions', titre: '',
              rendu: (l) => l.statut === 'reussie'
                ? `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-telecharger="${esc(l.id)}">Télécharger</button>`
                : ''
            }
          ],
          lignes: d.donnees,
          vide: 'Aucune sauvegarde enregistrée'
        })}
        ${ui.pagination(d.pagination)}`;

      paginationSimple(zone, 'sauvegardes', requete);

      zone.querySelectorAll('[data-telecharger]').forEach((bouton) => {
        bouton.addEventListener('click', async (evenement) => {
          evenement.stopPropagation();
          bouton.disabled = true;
          try {
            await SA.telecharger(
              `/super-admin/sauvegardes/${bouton.getAttribute('data-telecharger')}/telecharger`,
              `ardoise-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
            );
          } catch (erreur) {
            SA.toast(erreur.message, 'erreur');
          } finally {
            bouton.disabled = false;
          }
        });
      });

      const boutonLancer = document.getElementById('btn-sauvegarder');
      if (boutonLancer) {
        boutonLancer.addEventListener('click', async () => {
          const confirme = await SA.confirmer({
            titre: 'Lancer une sauvegarde',
            message: "Un export logique des tables de référence sera produit et inscrit au registre. Cette opération ne remplace pas la sauvegarde automatique de l'hébergeur.",
            libelleValider: 'Lancer'
          });
          if (!confirme) return;

          boutonLancer.disabled = true;
          boutonLancer.textContent = 'Sauvegarde…';
          try {
            const r = await SA.api('/super-admin/sauvegardes', {
              method: 'POST', body: JSON.stringify({ portee: 'complete' })
            });
            SA.toast(`Sauvegarde terminée (${fmt.octets(r.taille_octets)} en ${fmt.duree(r.duree_ms)}).`, 'succes');
            SA.rafraichirVue();
          } catch (erreur) {
            SA.toast(erreur.message, 'erreur');
            boutonLancer.disabled = false;
            boutonLancer.textContent = 'Lancer une sauvegarde';
          }
        });
      }
    }
  });

  /* ======================================================================
     Notifications système
     ====================================================================== */

  SA.enregistrerVue('notifications', {
    titre: 'Notifications système',
    sousTitre: 'Annonces émises par la plateforme vers les écoles.',

    async rendu(conteneur, params) {
      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `<button class="sa-bouton sa-bouton-principal" id="btn-nouvelle-notif">+ Nouvelle annonce</button>`;
        document.getElementById('btn-nouvelle-notif').addEventListener('click', ouvrirCompositionNotification);
      }

      const zone = document.createElement('div');
      zone.innerHTML = ui.squelette(7);
      conteneur.innerHTML = '';
      conteneur.appendChild(zone);

      const requete = { page: params.page || 1 };
      const d = await SA.api(SA.url('/super-admin/notifications', requete));

      zone.innerHTML = ui.tableau({
        colonnes: [
          { cle: 'created_at', titre: 'Date', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
          { cle: 'titre', titre: 'Titre', rendu: (l) => `<strong>${esc(l.titre)}</strong><div class="sa-muet sa-tronque" style="font-size:.76rem" title="${esc(l.contenu)}">${esc(l.contenu)}</div>` },
          { cle: 'niveau', titre: 'Niveau', rendu: (l) => ui.badgeStatut(l.niveau) },
          { cle: 'cible', titre: 'Cible', rendu: (l) => esc(l.ecole_nom || (l.cible === 'toutes' ? 'Toutes les écoles' : l.cible)) },
          { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) },
          { cle: 'nb_destinataires', titre: 'Destinataires', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb_destinataires) },
          { cle: 'cree_par_nom', titre: 'Émise par' }
        ],
        lignes: d.donnees,
        vide: 'Aucune annonce émise'
      }) + ui.pagination(d.pagination);

      paginationSimple(zone, 'notifications', requete);
    }
  });

  function ouvrirCompositionNotification() {
    const modale = SA.modale({
      titre: 'Nouvelle annonce',
      sousTitre: 'Déposée dans le centre de notifications des écoles concernées.',
      contenu: `
        <label class="sa-champ-bloc"><span>Titre *</span><input class="sa-champ" id="n-titre" /></label>
        <label class="sa-champ-bloc"><span>Contenu *</span><textarea class="sa-champ" id="n-contenu"></textarea></label>
        <div class="sa-grille-2">
          <label class="sa-champ-bloc"><span>Niveau</span>
            <select class="sa-champ" id="n-niveau">
              <option value="info">Information</option>
              <option value="succes">Bonne nouvelle</option>
              <option value="avertissement">Avertissement</option>
              <option value="critique">Critique</option>
            </select>
          </label>
          <label class="sa-champ-bloc"><span>Destinataires</span>
            <select class="sa-champ" id="n-cible">
              <option value="toutes">Toutes les écoles actives</option>
              <option value="ecole">Une école précise</option>
            </select>
          </label>
        </div>
        <label class="sa-champ-bloc" id="bloc-ecole" style="display:none"><span>École</span>
          ${SA.ui.selecteurEcoles('', { libelleVide: 'Choisir…' })}
        </label>
        <label class="sa-champ-bloc"><span>Rôle destinataire</span>
          <select class="sa-champ" id="n-role">
            <option value="">Direction (directeurs et préfets)</option>
            <option value="professeur">Professeurs</option>
            <option value="titulaire">Titulaires</option>
            <option value="secretaire">Secrétaires</option>
            <option value="comptable">Comptables</option>
            <option value="parent">Parents</option>
          </select>
        </label>
        <p class="sa-note">
          L'annonce est déposée nominativement dans le centre de notifications de chaque
          personne visée. Sans publication, elle reste en brouillon.
        </p>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="brouillon">Enregistrer en brouillon</button>
        <button class="sa-bouton sa-bouton-principal" data-role="publier">Publier</button>`,
      large: true
    });

    const cible = modale.querySelector('#n-cible');
    cible.addEventListener('change', () => {
      modale.querySelector('#bloc-ecole').style.display = cible.value === 'ecole' ? '' : 'none';
    });

    async function envoyer(publier, bouton) {
      const titre = modale.querySelector('#n-titre').value.trim();
      const contenu = modale.querySelector('#n-contenu').value.trim();
      if (!titre || !contenu) return SA.toast('Titre et contenu sont requis.', 'attention');

      bouton.disabled = true;
      try {
        const r = await SA.api('/super-admin/notifications', {
          method: 'POST',
          body: JSON.stringify({
            titre, contenu,
            niveau: modale.querySelector('#n-niveau').value,
            cible: cible.value,
            ecole_id: cible.value === 'ecole' ? modale.querySelector('[data-filtre="ecole_id"]').value : null,
            role_cible: modale.querySelector('#n-role').value || null,
            publier
          })
        });
        SA.toast(publier
          ? `Annonce déposée à ${r.destinataires} destinataire(s) dans ${r.ecoles_touchees} école(s).`
          : 'Brouillon enregistré.', 'succes');
        modale.fermer();
        SA.rafraichirVue();
      } catch (erreur) {
        SA.toast(erreur.message, 'erreur');
        bouton.disabled = false;
      }
    }

    modale.querySelector('[data-role="brouillon"]')
      .addEventListener('click', (e) => envoyer(false, e.currentTarget));
    modale.querySelector('[data-role="publier"]')
      .addEventListener('click', (e) => envoyer(true, e.currentTarget));
  }

  /* ======================================================================
     Support
     ====================================================================== */

  SA.enregistrerVue('support', {
    titre: 'Support',
    sousTitre: 'Tickets remontés par les écoles.',

    async rendu(conteneur, params) {
      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `<button class="sa-bouton sa-bouton-principal" id="btn-nouveau-ticket">+ Nouveau ticket</button>`;
        document.getElementById('btn-nouveau-ticket').addEventListener('click', ouvrirCreationTicket);
      }

      conteneur.innerHTML = '';
      const barre = document.createElement('div');
      const zone = document.createElement('div');
      zone.innerHTML = ui.squelette(8);
      conteneur.append(barre, zone);

      const filtres = SA.ui.barreFiltres(barre, [
        { type: 'recherche', nom: 'recherche', libelle: 'Sujet, référence, école…', valeur: params.recherche },
        {
          type: 'select', nom: 'statut', libelle: 'Tous les statuts', valeur: params.statut,
          options: [
            { valeur: 'ouvert', libelle: 'Ouverts' },
            { valeur: 'en_cours', libelle: 'En cours' },
            { valeur: 'attente_client', libelle: 'En attente du client' },
            { valeur: 'resolu', libelle: 'Résolus' },
            { valeur: 'ferme', libelle: 'Fermés' }
          ]
        },
        {
          type: 'select', nom: 'priorite', libelle: 'Toutes les priorités', valeur: params.priorite,
          options: [
            { valeur: 'urgente', libelle: 'Urgente' },
            { valeur: 'haute', libelle: 'Haute' },
            { valeur: 'normale', libelle: 'Normale' },
            { valeur: 'basse', libelle: 'Basse' }
          ]
        },
        { type: 'ecoles', nom: 'ecole_id', libelle: 'Toutes les écoles', valeur: params.ecole_id }
      ], (valeurs) => SA.naviguer('support', Object.assign({}, valeurs, { page: 1 })));

      const requete = Object.assign({}, filtres.lire(), { page: params.page || 1 });
      const d = await SA.api(SA.url('/super-admin/tickets', requete));
      const s = d.statistiques || {};

      zone.innerHTML = `
        <div class="sa-grille-stats" style="margin-bottom:16px">
          ${ui.carteStat({ valeur: fmt.nombre(s.ouverts), etiquette: 'Ouverts', ton: Number(s.ouverts) ? 'attention' : 'succes' })}
          ${ui.carteStat({ valeur: fmt.nombre(s.en_cours), etiquette: 'En cours', ton: 'info' })}
          ${ui.carteStat({ valeur: fmt.nombre(s.urgents), etiquette: 'Urgents', ton: Number(s.urgents) ? 'danger' : 'succes' })}
          ${ui.carteStat({ valeur: fmt.nombre(s.clos), etiquette: 'Clos' })}
          ${ui.carteStat({ valeur: s.delai_reponse_moyen_h ? `${fmt.decimal(s.delai_reponse_moyen_h)} h` : '—', etiquette: 'Délai moyen de 1re réponse' })}
        </div>

        ${ui.tableau({
          cliquable: true,
          colonnes: [
            { cle: 'reference', titre: 'Réf.', classe: 'sa-mono' },
            { cle: 'sujet', titre: 'Sujet', rendu: (l) => `<strong>${esc(l.sujet)}</strong>` },
            { cle: 'ecole_nom', titre: 'École' },
            { cle: 'priorite', titre: 'Priorité', rendu: (l) => ui.badgeStatut(l.priorite) },
            { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) },
            { cle: 'responsable', titre: 'Responsable' },
            { cle: 'nb_messages', titre: 'Messages', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb_messages) },
            { cle: 'created_at', titre: 'Ouvert', rendu: (l) => esc(fmt.relatif(l.created_at)) }
          ],
          lignes: d.donnees,
          vide: 'Aucun ticket'
        })}
        ${ui.pagination(d.pagination)}`;

      paginationSimple(zone, 'support', requete);
      zone.querySelectorAll('tbody tr[data-id]').forEach((ligne) => {
        ligne.addEventListener('click', () => ouvrirTicket(ligne.getAttribute('data-id')));
      });
    }
  });

  function ouvrirCreationTicket() {
    const modale = SA.modale({
      titre: 'Nouveau ticket',
      contenu: `
        <label class="sa-champ-bloc"><span>École</span>
          ${SA.ui.selecteurEcoles('', { libelleVide: 'Aucune école (interne)' })}
        </label>
        <label class="sa-champ-bloc"><span>Sujet *</span><input class="sa-champ" id="t-sujet" /></label>
        <label class="sa-champ-bloc"><span>Description</span><textarea class="sa-champ" id="t-description"></textarea></label>
        <div class="sa-grille-2">
          <label class="sa-champ-bloc"><span>Priorité</span>
            <select class="sa-champ" id="t-priorite">
              <option value="basse">Basse</option>
              <option value="normale" selected>Normale</option>
              <option value="haute">Haute</option>
              <option value="urgente">Urgente</option>
            </select>
          </label>
          <label class="sa-champ-bloc"><span>Catégorie</span>
            <select class="sa-champ" id="t-categorie">
              <option value="technique">Technique</option>
              <option value="facturation">Facturation</option>
              <option value="formation">Formation</option>
              <option value="anomalie">Anomalie</option>
              <option value="autre">Autre</option>
            </select>
          </label>
        </div>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-principal" data-role="creer">Créer</button>`
    });

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());
    modale.querySelector('[data-role="creer"]').addEventListener('click', async (evenement) => {
      const sujet = modale.querySelector('#t-sujet').value.trim();
      if (!sujet) return SA.toast('Le sujet est requis.', 'attention');

      evenement.currentTarget.disabled = true;
      try {
        await SA.api('/super-admin/tickets', {
          method: 'POST',
          body: JSON.stringify({
            ecole_id: modale.querySelector('[data-filtre="ecole_id"]').value || null,
            sujet,
            description: modale.querySelector('#t-description').value.trim(),
            priorite: modale.querySelector('#t-priorite').value,
            categorie: modale.querySelector('#t-categorie').value
          })
        });
        SA.toast('Ticket créé.', 'succes');
        modale.fermer();
        SA.rafraichirVue();
      } catch (erreur) {
        SA.toast(erreur.message, 'erreur');
        evenement.currentTarget.disabled = false;
      }
    });
  }

  async function ouvrirTicket(id) {
    const modale = SA.modale({ titre: 'Chargement…', large: true, contenu: ui.squelette(5) });

    let d;
    try {
      d = await SA.api(`/super-admin/tickets/${id}`);
    } catch (erreur) {
      modale.querySelector('.sa-modale-corps').innerHTML = ui.etatErreur(erreur.message);
      return;
    }

    const t = d.ticket;
    modale.querySelector('.sa-modale-entete h2').textContent = t.sujet;
    modale.querySelector('.sa-modale-entete').querySelector('div').insertAdjacentHTML('beforeend',
      `<p class="sa-modale-sous-titre">${esc(t.reference || '')} · ${esc(t.ecole_nom || 'interne')}</p>`);

    modale.querySelector('.sa-modale-corps').innerHTML = `
      <div class="sa-grille-2">
        <label class="sa-champ-bloc"><span>Statut</span>
          <select class="sa-champ" id="t-statut">
            ${['ouvert', 'en_cours', 'attente_client', 'resolu', 'ferme'].map((v) =>
              `<option value="${v}" ${t.statut === v ? 'selected' : ''}>${v.replace(/_/g, ' ')}</option>`).join('')}
          </select>
        </label>
        <label class="sa-champ-bloc"><span>Priorité</span>
          <select class="sa-champ" id="t-prio">
            ${['basse', 'normale', 'haute', 'urgente'].map((v) =>
              `<option value="${v}" ${t.priorite === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </label>
      </div>
      <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="t-enregistrer">Mettre à jour</button>

      ${t.description ? `<h4 class="sa-section-titre" style="margin-top:20px">Demande initiale</h4>
        <div class="sa-panneau"><div style="font-size:.88rem;white-space:pre-wrap">${esc(t.description)}</div></div>` : ''}

      <h4 class="sa-section-titre" style="margin-top:20px">Échanges</h4>
      <div>
        ${(d.messages || []).length ? d.messages.map((m) => `
          <div class="sa-panneau" style="margin-bottom:8px;${m.cote === 'support' ? 'border-left:3px solid var(--ocre)' : ''}">
            <div class="sa-muet" style="font-size:.76rem">
              ${esc(m.auteur || 'inconnu')} · ${esc(m.cote === 'support' ? 'Support' : 'École')} · ${esc(fmt.dateHeure(m.created_at))}
            </div>
            <div style="margin-top:5px;font-size:.88rem;white-space:pre-wrap">${esc(m.contenu)}</div>
          </div>`).join('') : '<p class="sa-muet">Aucun échange.</p>'}
      </div>

      <label class="sa-champ-bloc" style="margin-top:14px"><span>Répondre</span>
        <textarea class="sa-champ" id="t-reponse" placeholder="Votre réponse à l'école…"></textarea>
      </label>
      <label style="display:flex;align-items:center;gap:8px;font-size:.84rem;margin-bottom:12px">
        <input type="checkbox" id="t-notifier" checked /> Notifier l'école par email
      </label>
      <button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="t-repondre">Envoyer la réponse</button>`;

    modale.querySelector('#t-enregistrer').addEventListener('click', async (evenement) => {
      evenement.currentTarget.disabled = true;
      try {
        await SA.api(`/super-admin/tickets/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            statut: modale.querySelector('#t-statut').value,
            priorite: modale.querySelector('#t-prio').value
          })
        });
        SA.toast('Ticket mis à jour.', 'succes');
        modale.fermer();
        SA.rafraichirVue();
      } catch (erreur) {
        SA.toast(erreur.message, 'erreur');
        evenement.currentTarget.disabled = false;
      }
    });

    modale.querySelector('#t-repondre').addEventListener('click', async (evenement) => {
      const contenu = modale.querySelector('#t-reponse').value.trim();
      if (!contenu) return;
      evenement.currentTarget.disabled = true;
      try {
        await SA.api(`/super-admin/tickets/${id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ contenu, notifier: modale.querySelector('#t-notifier').checked })
        });
        SA.toast('Réponse envoyée.', 'succes');
        modale.fermer();
        ouvrirTicket(id);
      } catch (erreur) {
        SA.toast(erreur.message, 'erreur');
        evenement.currentTarget.disabled = false;
      }
    });
  }

  /* ======================================================================
     Intelligence artificielle
     ====================================================================== */

  SA.enregistrerVue('ia', {
    titre: 'Intelligence artificielle',
    sousTitre: 'Consommation, coût estimé, modèle utilisé, temps de réponse et erreurs.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = '';
      const barre = document.createElement('div');
      const zone = document.createElement('div');
      zone.innerHTML = ui.squelette(6, 120);
      conteneur.append(barre, zone);

      SA.ui.barreFiltres(barre, [
        {
          type: 'select', nom: 'jours', libelle: 'Période', valeur: params.jours || '90',
          options: [
            { valeur: '30', libelle: '30 jours' },
            { valeur: '90', libelle: '90 jours' },
            { valeur: '180', libelle: '6 mois' },
            { valeur: '365', libelle: '12 mois' }
          ]
        }
      ], (valeurs) => SA.naviguer('ia', valeurs));

      const d = await SA.api(SA.url('/super-admin/ia', { jours: params.jours || 90 }));
      const cout = d.cout || {};
      const appelsMois = (d.consommation_par_mois || [])[0];
      const erreurs = (d.repartition_par_statut || []).filter((s) => s.statut !== 'succes')
        .reduce((total, s) => total + Number(s.nb), 0);

      zone.innerHTML = `
        <div class="sa-grille-stats" style="margin-bottom:18px">
          ${ui.carteStat({ valeur: esc(d.modele_configure), etiquette: 'Modèle configuré' })}
          ${ui.carteStat({ valeur: fmt.nombre(appelsMois && appelsMois.appels), etiquette: 'Appels ce mois-ci' })}
          ${ui.carteStat({ valeur: `${fmt.decimal(cout.cout_estime_mois_courant_usd, 2)} $`, etiquette: 'Coût estimé du mois', ton: 'attention' })}
          ${ui.carteStat({ valeur: fmt.nombre(erreurs), etiquette: 'Requêtes en erreur', ton: erreurs ? 'danger' : 'succes' })}
          ${ui.carteStat({ valeur: d.cle_api && d.cle_api.defini ? ui.badge('configurée', 'succes') : ui.badge('absente', 'danger'), etiquette: 'Clé API' })}
        </div>

        <div class="sa-grille-2">
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Appels par mois</h3>
            ${SA.graphe.barres((d.consommation_par_mois || []).slice(0, 12).reverse().map((m) => ({
              libelle: m.mois, valeur: Number(m.appels)
            })))}
          </div>
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Temps de réponse par jour</h3>
            ${SA.graphe.courbe([{
              nom: 'Durée moyenne',
              points: (d.latence_par_jour || []).map((l) => ({
                x: new Date(l.jour).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
                y: Number(l.duree_moyenne_ms) || 0
              })),
              couleur: 'var(--encre)'
            }])}
          </div>
        </div>

        <div class="sa-grille-2" style="margin-top:16px">
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Consommation par école</h3>
            ${ui.tableau({
              colonnes: [
                { cle: 'ecole', titre: 'École' },
                { cle: 'appels', titre: 'Appels', classe: 'sa-num', rendu: (l) => fmt.nombre(l.appels) },
                { cle: 'quota', titre: 'Quota mensuel', classe: 'sa-num', rendu: (l) => fmt.nombre(l.quota) }
              ],
              lignes: d.consommation_par_ecole || [],
              vide: 'Aucune consommation enregistrée'
            })}
          </div>
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Répartition par modèle et par résultat</h3>
            ${SA.graphe.repartition((d.repartition_par_statut || []).map((s) => ({
              libelle: s.statut, valeur: Number(s.nb),
              couleur: s.statut === 'succes' ? 'var(--vert-ok)' : 'var(--rouge)'
            })))}
            <div style="margin-top:16px">
              ${ui.tableau({
                colonnes: [
                  { cle: 'modele', titre: 'Modèle', classe: 'sa-mono' },
                  { cle: 'appels', titre: 'Appels', classe: 'sa-num', rendu: (l) => fmt.nombre(l.appels) },
                  { cle: 'duree_moyenne_ms', titre: 'Durée moyenne', classe: 'sa-num', rendu: (l) => esc(fmt.duree(l.duree_moyenne_ms)) }
                ],
                lignes: d.repartition_par_modele || [],
                vide: 'Aucun appel journalisé'
              })}
            </div>
          </div>
        </div>

        <div class="sa-section" style="margin-top:18px">
          <h2 class="sa-section-titre">Requêtes récentes</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'created_at', titre: 'Date', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
              { cle: 'ecole_nom', titre: 'École' },
              { cle: 'utilisateur', titre: 'Par' },
              { cle: 'question', titre: 'Question', rendu: (l) => `<span class="sa-tronque" title="${esc(l.question)}">${esc(l.question)}</span>` },
              { cle: 'duree_ms', titre: 'Durée', classe: 'sa-num', rendu: (l) => esc(fmt.duree(l.duree_ms)) },
              { cle: 'nb_lignes', titre: 'Lignes', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb_lignes) },
              { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) }
            ],
            lignes: d.requetes_recentes || [],
            vide: 'Aucune requête IA journalisée'
          })}
        </div>

        <p class="sa-note" style="margin-top:16px">${esc(cout.avertissement || '')}</p>`;
    }
  });

  /* ======================================================================
     Configuration
     ====================================================================== */

  SA.enregistrerVue('configuration', {
    titre: 'Configuration',
    sousTitre: 'Paramètres généraux, image de marque, emails, stockage et intégrations.',

    async rendu(conteneur) {
      const d = await SA.api('/super-admin/configuration');
      const categories = d.categories || {};

      const libelles = {
        general: 'Paramètres généraux', branding: 'Image de marque', emails: 'Emails',
        stockage: 'Stockage', integrations: 'Intégrations', limites: 'Limites et quotas'
      };

      conteneur.innerHTML = `
        <div class="sa-bandeau-lecture" style="margin-bottom:18px">
          <span>🔑</span>
          <span>
            Les clés d'API ne sont jamais stockées en base ni affichées en clair. Elles vivent
            dans les variables d'environnement de l'hébergeur ; cette page se contente d'indiquer
            si elles sont définies.
          </span>
        </div>

        ${Object.entries(categories).map(([categorie, entrees]) => `
          <section class="sa-section">
            <h2 class="sa-section-titre">${esc(libelles[categorie] || categorie)}</h2>
            <div class="sa-panneau">
              ${entrees.map((e) => rendreEntreeConfiguration(e)).join('')}
            </div>
          </section>`).join('')}

        <div style="display:flex;gap:9px;position:sticky;bottom:16px">
          <button class="sa-bouton sa-bouton-principal" id="btn-enregistrer-config">Enregistrer les modifications</button>
        </div>`;

      document.getElementById('btn-enregistrer-config').addEventListener('click', async (evenement) => {
        const bouton = evenement.currentTarget;
        const modifications = [];

        conteneur.querySelectorAll('[data-cle]').forEach((champ) => {
          if (champ.disabled) return;
          const cle = champ.getAttribute('data-cle');
          const type = champ.getAttribute('data-type');
          let valeur;
          if (type === 'boolean') valeur = champ.checked;
          else if (type === 'number') valeur = champ.value === '' ? null : Number(champ.value);
          else valeur = champ.value === '' ? null : champ.value;

          if (String(champ.getAttribute('data-initial')) !== String(valeur)) {
            modifications.push({ cle, valeur });
          }
        });

        if (!modifications.length) return SA.toast('Aucune modification à enregistrer.', 'info');

        bouton.disabled = true;
        try {
          const r = await SA.api('/super-admin/configuration', {
            method: 'PATCH', body: JSON.stringify({ modifications })
          });
          SA.toast(`${r.appliquees.length} paramètre(s) enregistré(s).`, 'succes');
          if (r.refusees && r.refusees.length) {
            SA.toast(`${r.refusees.length} refusé(s) : ${r.refusees[0].motif}`, 'attention', 9000);
          }
          SA.rafraichirVue();
        } catch (erreur) {
          SA.toast(erreur.message, 'erreur');
          bouton.disabled = false;
        }
      });
    }
  });

  function rendreEntreeConfiguration(e) {
    const enTete = `
      <div style="display:flex;justify-content:space-between;gap:14px;align-items:baseline">
        <strong style="font-size:.9rem">${esc(e.libelle || e.cle)}</strong>
        <code class="sa-muet" style="font-size:.72rem;font-family:var(--police-mono)">${esc(e.cle)}</code>
      </div>
      ${e.description ? `<div class="sa-muet" style="font-size:.78rem;margin:3px 0 7px">${esc(e.description)}</div>` : ''}`;

    if (e.secret) {
      const s = e.valeur_secrete || {};
      return `<div style="padding:12px 0;border-bottom:1px solid var(--bordure)">
        ${enTete}
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          ${ui.badge(s.defini ? 'définie' : 'absente', s.defini ? 'succes' : 'danger')}
          ${s.apercu ? `<code class="sa-mono">${esc(s.apercu)}</code>` : ''}
          <span class="sa-muet" style="font-size:.76rem">
            à définir dans la variable <code class="sa-mono">${esc(e.variable_env || '—')}</code>
          </span>
        </div>
      </div>`;
    }

    const valeur = e.valeur;
    const type = typeof valeur === 'boolean' ? 'boolean' : typeof valeur === 'number' ? 'number' : 'string';

    let champ;
    if (type === 'boolean') {
      champ = `<label style="display:flex;align-items:center;gap:8px;font-size:.86rem">
        <input type="checkbox" data-cle="${esc(e.cle)}" data-type="boolean"
               data-initial="${valeur ? 'true' : 'false'}" ${valeur ? 'checked' : ''} />
        Activé
      </label>`;
    } else if (type === 'number') {
      champ = `<input type="number" class="sa-champ" style="max-width:220px"
                      data-cle="${esc(e.cle)}" data-type="number"
                      data-initial="${esc(valeur)}" value="${esc(valeur)}" />`;
    } else {
      champ = `<input class="sa-champ" style="max-width:420px;width:100%"
                      data-cle="${esc(e.cle)}" data-type="string"
                      data-initial="${esc(valeur === null ? '' : valeur)}"
                      value="${esc(valeur === null ? '' : valeur)}" />`;
    }

    return `<div style="padding:12px 0;border-bottom:1px solid var(--bordure)">
      ${enTete}${champ}
      ${e.updated_at ? `<div class="sa-muet" style="font-size:.72rem;margin-top:5px">
        modifié ${esc(fmt.relatif(e.updated_at))}${e.modifie_par ? ' par ' + esc(e.modifie_par) : ''}
      </div>` : ''}
    </div>`;
  }

  /* ======================================================================
     Outils développeur
     ====================================================================== */

  SA.enregistrerVue('outils', {
    titre: 'Outils développeur',
    sousTitre: 'Tests de chaîne, tâches planifiées, cache et journaux techniques.',

    async rendu(conteneur) {
      const taches = await SA.api('/super-admin/outils/taches');

      conteneur.innerHTML = `
        <div class="sa-bandeau-lecture sa-bandeau-observation" style="margin-bottom:18px">
          <span>⚠️</span>
          <span>
            Ces outils déclenchent des actions réelles : envois d'emails, messages WhatsApp,
            exécution de tâches planifiées. Ils sont limités à douze appels par minute.
          </span>
        </div>

        <div class="sa-grille-2">
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Test de la chaîne email</h3>
            <label class="sa-champ-bloc"><span>Destinataire</span>
              <input type="email" class="sa-champ" id="o-email" placeholder="vous@exemple.cd" />
            </label>
            <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-test-email">Envoyer un email de test</button>
            <div id="res-email" class="sa-bloc-code" style="display:none;margin-top:10px"></div>
          </div>

          <div class="sa-panneau">
            <h3 class="sa-section-titre">Test des notifications</h3>
            <label class="sa-champ-bloc"><span>École destinataire</span>
              ${SA.ui.selecteurEcoles('', { libelleVide: 'Choisir…' })}
            </label>
            <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-test-notif">Déposer une notification</button>
            <div id="res-notif" class="sa-bloc-code" style="display:none;margin-top:10px"></div>
          </div>

          <div class="sa-panneau">
            <h3 class="sa-section-titre">Test WhatsApp</h3>
            <label class="sa-champ-bloc"><span>Numéro</span>
              <input class="sa-champ" id="o-numero" placeholder="0812345678 ou +243812345678" />
            </label>
            <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-test-whatsapp">Envoyer un message de test</button>
            <div id="res-whatsapp" class="sa-bloc-code" style="display:none;margin-top:10px"></div>
          </div>

          <div class="sa-panneau">
            <h3 class="sa-section-titre">Cache applicatif</h3>
            <p class="sa-texte">
              Vide le cache des agrégats du tableau de bord et des analyses.
              Sans effet sur les données, seulement sur leur fraîcheur.
            </p>
            <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-vider-cache">Vider le cache</button>
            <div id="res-cache" class="sa-bloc-code" style="display:none;margin-top:10px"></div>
          </div>
        </div>

        <section class="sa-section" style="margin-top:20px">
          <h2 class="sa-section-titre">
            Tâches planifiées
            <span class="sa-annexe">${taches.cron_secret_configure ? 'secret configuré' : 'CRON_SECRET absent'}</span>
          </h2>
          <div class="sa-grille-3">
            ${(taches.taches || []).map((t) => `
              <div class="sa-panneau">
                <h3 class="sa-section-titre">${esc(t.libelle)}</h3>
                <code class="sa-muet sa-mono" style="font-size:.74rem">${esc(t.chemin)}</code>
                <div style="margin-top:10px">
                  <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
                          data-tache="${esc(t.cle)}" ${taches.cron_secret_configure ? '' : 'disabled'}>
                    Exécuter maintenant
                  </button>
                </div>
                <div class="sa-bloc-code" data-res-tache="${esc(t.cle)}" style="display:none;margin-top:10px"></div>
              </div>`).join('')}
          </div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">
            Journaux techniques
            <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-charger-logs">Charger</button>
          </h2>
          <div id="zone-logs">${ui.etatVide('Journaux non chargés', 'Cliquez sur « Charger » pour afficher les dernières anomalies.')}</div>
        </section>`;

      /* ---- Test email ---- */
      document.getElementById('btn-test-email').addEventListener('click', async (evenement) => {
        await executerTest(evenement.currentTarget, 'res-email', () =>
          SA.api('/super-admin/outils/test-email', {
            method: 'POST',
            body: JSON.stringify({ destinataire: document.getElementById('o-email').value.trim() })
          }));
      });

      /* ---- Test notification ---- */
      document.getElementById('btn-test-notif').addEventListener('click', async (evenement) => {
        const ecole = conteneur.querySelector('[data-filtre="ecole_id"]').value;
        if (!ecole) return SA.toast('Choisissez une école.', 'attention');
        await executerTest(evenement.currentTarget, 'res-notif', () =>
          SA.api('/super-admin/outils/test-notification', {
            method: 'POST', body: JSON.stringify({ ecole_id: ecole })
          }));
      });

      /* ---- Test WhatsApp ---- */
      document.getElementById('btn-test-whatsapp').addEventListener('click', async (evenement) => {
        await executerTest(evenement.currentTarget, 'res-whatsapp', () =>
          SA.api('/super-admin/outils/test-whatsapp', {
            method: 'POST',
            body: JSON.stringify({ numero: document.getElementById('o-numero').value.trim() })
          }));
      });

      /* ---- Cache ---- */
      document.getElementById('btn-vider-cache').addEventListener('click', async (evenement) => {
        await executerTest(evenement.currentTarget, 'res-cache', () =>
          SA.api('/super-admin/outils/vider-cache', { method: 'POST', body: JSON.stringify({}) }));
      });

      /* ---- Tâches ---- */
      conteneur.querySelectorAll('[data-tache]').forEach((bouton) => {
        bouton.addEventListener('click', async () => {
          const cle = bouton.getAttribute('data-tache');
          const confirme = await SA.confirmer({
            titre: 'Exécuter la tâche',
            message: "Cette tâche peut envoyer des emails et modifier des statuts d'abonnement. Confirmer ?",
            libelleValider: 'Exécuter'
          });
          if (!confirme) return;

          const zone = conteneur.querySelector(`[data-res-tache="${cle}"]`);
          bouton.disabled = true;
          const libelle = bouton.textContent;
          bouton.textContent = 'Exécution…';
          try {
            const r = await SA.api(`/super-admin/outils/taches/${cle}`, { method: 'POST' });
            zone.style.display = '';
            zone.textContent = JSON.stringify(r, null, 2);
            SA.toast('Tâche exécutée.', 'succes');
          } catch (erreur) {
            zone.style.display = '';
            zone.textContent = erreur.message;
            SA.toast(erreur.message, 'erreur');
          } finally {
            bouton.disabled = false;
            bouton.textContent = libelle;
          }
        });
      });

      /* ---- Journaux ---- */
      document.getElementById('btn-charger-logs').addEventListener('click', async (evenement) => {
        const bouton = evenement.currentTarget;
        const zone = document.getElementById('zone-logs');
        bouton.disabled = true;
        zone.innerHTML = ui.squelette(6);
        try {
          const d = await SA.api('/super-admin/outils/logs');
          zone.innerHTML = `
            <div class="sa-grille-2">
              <div class="sa-panneau">
                <h3 class="sa-section-titre">Requêtes en erreur (5xx)</h3>
                ${ui.tableau({
                  colonnes: [
                    { cle: 'at', titre: 'Horodatage', rendu: (l) => esc(fmt.dateHeure(l.at)) },
                    { cle: 'methode', titre: 'Méthode' },
                    { cle: 'chemin', titre: 'Route', classe: 'sa-mono' },
                    { cle: 'statut', titre: 'Code', classe: 'sa-num' },
                    { cle: 'dureeMs', titre: 'Durée', classe: 'sa-num', rendu: (l) => esc(fmt.duree(l.dureeMs)) }
                  ],
                  lignes: d.erreurs_http || [],
                  vide: 'Aucune erreur serveur récente'
                })}
              </div>
              <div class="sa-panneau">
                <h3 class="sa-section-titre">Anomalies du journal d'audit</h3>
                ${ui.tableau({
                  colonnes: [
                    { cle: 'created_at', titre: 'Horodatage', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
                    { cle: 'action', titre: 'Action', classe: 'sa-mono' },
                    { cle: 'ecole_nom', titre: 'École' },
                    { cle: 'utilisateur', titre: 'Par' }
                  ],
                  lignes: d.journal_anomalies || [],
                  vide: 'Aucune anomalie'
                })}
              </div>
            </div>
            <p class="sa-note" style="margin-top:12px">${esc(d.note)}</p>`;
        } catch (erreur) {
          zone.innerHTML = ui.etatErreur(erreur.message);
        } finally {
          bouton.disabled = false;
        }
      });
    }
  });

  async function executerTest(bouton, idZone, action) {
    const zone = document.getElementById(idZone);
    const libelle = bouton.textContent;
    bouton.disabled = true;
    bouton.textContent = 'En cours…';
    try {
      const r = await action();
      zone.style.display = '';
      zone.textContent = JSON.stringify(r, null, 2);
      SA.toast('Test exécuté.', 'succes');
    } catch (erreur) {
      zone.style.display = '';
      zone.textContent = `${erreur.message}\n${JSON.stringify(erreur.corps || {}, null, 2)}`;
      SA.toast(erreur.message, 'erreur');
    } finally {
      bouton.disabled = false;
      bouton.textContent = libelle;
    }
  }

  /* ======================================================================
     Apparence
     ------------------------------------------------------------------
     Même sélecteur que la carte « Apparence » de mon-profil.html, rendu ici
     avec les classes sa-. La liste des thèmes et leur application viennent
     de theme.js (window.ArdoiseTheme), chargé par super-admin.html pour
     cette seule raison — voir le commentaire d'isolation en tête de cette
     page. Aucune route « moi » n'existe côté Super Admin : le choix reste
     local à cet appareil, comme la disposition du menu sur les pages
     applicatives.
     ====================================================================== */

  SA.enregistrerVue('apparence', {
    titre: 'Apparence',
    sousTitre: 'Le thème visuel et la disposition de ce panneau d\'administration.',

    async rendu(conteneur) {
      if (!window.ArdoiseTheme) {
        conteneur.innerHTML = ui.etatErreur('theme.js n\'a pas pu être chargé : la liste des thèmes est indisponible.');
        return;
      }

      function dessiner() {
        const actuel = ArdoiseTheme.actuel();
        conteneur.innerHTML = `
          <section class="sa-section">
            <p class="sa-muet" style="font-size:.85rem;margin:-4px 0 18px;max-width:640px">
              Ce choix ne concerne que votre poste : il ne change rien pour les autres
              administrateurs, et rien pour les écoles, qui gardent chacune leur propre thème.
            </p>
            <div class="sa-grille-themes">
              ${ArdoiseTheme.liste.map((t) => `
                <button type="button" class="sa-carte-theme ${t.cle === actuel ? 'actif' : ''}" data-theme="${esc(t.cle)}"
                        aria-pressed="${t.cle === actuel}">
                  <div class="sa-apercu-theme" style="background:${t.apercu.fond}">
                    <div class="sa-bande-theme" style="background:${t.apercu.barre}"></div>
                    <div class="sa-corps-theme">
                      <div class="sa-ligne-theme-1" style="background:${t.apercu.texte}"></div>
                      <div class="sa-ligne-theme-2" style="background:${t.apercu.texte}"></div>
                      <div class="sa-pastille-theme" style="background:${t.apercu.accent}"></div>
                    </div>
                  </div>
                  <div class="sa-pied-theme">
                    <div class="sa-nom-theme">${esc(t.nom)}<span class="sa-coche-theme">${t.cle === actuel ? '✓' : ''}</span></div>
                    <div class="sa-desc-theme">${esc(t.description)}</div>
                  </div>
                </button>
              `).join('')}
            </div>
          </section>

          <section class="sa-panneau" style="margin-top:18px;max-width:720px">
            <div class="sa-section-titre">
              <h2>Barre latérale</h2>
            </div>
            <label class="sa-interrupteur-disposition">
              <input type="checkbox" id="sa-case-nav-compact" />
              <span>
                <strong>Activer la barre rétractable</strong>
                <span class="sa-aide-disposition">
                  Le menu n'affiche que les icônes au repos et se déploie lorsque vous
                  le survolez ou l'utilisez au clavier. Ce réglage reste propre à cet appareil.
                </span>
              </span>
            </label>
            <p class="sa-confirmation-disposition" id="sa-confirmation-nav" aria-live="polite"></p>
          </section>`;

        conteneur.querySelectorAll('.sa-carte-theme').forEach((bouton) => {
          bouton.addEventListener('click', () => {
            ArdoiseTheme.appliquer(bouton.dataset.theme);
            dessiner();
            SA.toast('Thème appliqué.', 'succes');
          });
        });

        const caseCompacte = conteneur.querySelector('#sa-case-nav-compact');
        const confirmation = conteneur.querySelector('#sa-confirmation-nav');
        if (caseCompacte && window.ArdoiseDisposition) {
          caseCompacte.checked = ArdoiseDisposition.obtenir().compact;
          caseCompacte.addEventListener('change', () => {
            ArdoiseDisposition.definir(null, caseCompacte.checked);
            confirmation.textContent = caseCompacte.checked
              ? 'Barre rétractable activée : survolez le menu pour le déployer.'
              : 'Barre rétractable désactivée : le menu reste entièrement affiché.';
            SA.toast(caseCompacte.checked
              ? 'Barre rétractable activée.'
              : 'Barre rétractable désactivée.', 'succes');
          });
        }
      }

      dessiner();
    }
  });
})();
