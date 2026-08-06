/* ==========================================================================
   Ardoise — Super Admin : tableau de bord, analyses, rapports
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui, graphe } = SA;

  /** Transforme une série {jour, valeur} en points de courbe. */
  function points(serie, cleX, cleY) {
    return (serie || []).map((d) => ({
      x: formaterAbscisse(d[cleX || 'jour']),
      y: Number(d[cleY || 'valeur']) || 0
    }));
  }

  function formaterAbscisse(v) {
    const texte = String(v || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(texte)) {
      const d = new Date(texte);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    }
    if (/^\d{4}-\d{2}$/.test(texte)) {
      const d = new Date(texte + '-01');
      return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    }
    return texte;
  }

  /* ======================================================================
     Tableau de bord
     ====================================================================== */

  SA.enregistrerVue('tableau-de-bord', {
    titre: 'Tableau de bord',
    sousTitre: "Vue d'ensemble de la plateforme, toutes écoles confondues.",

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squeletteCartes(8) + '<div style="height:16px"></div>' + ui.squelette(3, 180);

      const d = await SA.api('/super-admin/tableau-de-bord');

      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `
          <span class="sa-muet" style="align-self:center;font-size:.78rem">
            Mis à jour ${esc(fmt.relatif(d.genere_a))}
          </span>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-actualiser">Actualiser</button>`;
        const btn = document.getElementById('btn-actualiser');
        if (btn) btn.addEventListener('click', () => SA.rafraichirVue());
      }

      const e = d.ecoles || {};
      const p = d.personnes || {};
      const a = d.activite || {};
      const f = d.finances || {};
      const s = d.systeme || {};

      const cartes = [
        { valeur: fmt.nombre(e.total), etiquette: 'Écoles au total', icone: '🏫' },
        { valeur: fmt.nombre(e.actives), etiquette: 'Écoles actives', ton: 'succes', icone: '✓' },
        { valeur: fmt.nombre(e.suspendues), etiquette: 'Écoles suspendues', ton: e.suspendues ? 'danger' : null, icone: '⏸' },
        { valeur: fmt.nombre(e.abonnements_expirant), etiquette: 'Abonnements expirant sous 14 j', ton: e.abonnements_expirant ? 'attention' : null, icone: '⏳' },
        { valeur: fmt.nombre(p.eleves), etiquette: 'Élèves', icone: '🎓' },
        { valeur: fmt.nombre(p.professeurs), etiquette: 'Professeurs', icone: '👩‍🏫' },
        { valeur: fmt.nombre(p.parents), etiquette: 'Parents', icone: '👪' },
        { valeur: fmt.nombre(p.utilisateurs), etiquette: 'Comptes utilisateurs', icone: '👥' },
        { valeur: fmt.nombre(a.sessions_ouvertes), etiquette: 'Utilisateurs connectés', ton: 'info', icone: '🟢' },
        { valeur: fmt.nombre(a.connexions_aujourdhui), etiquette: "Connexions aujourd'hui", detail: `${fmt.nombre(a.connexions_7_jours)} sur 7 jours`, icone: '🔑' },
        { valeur: fmt.nombre(a.bulletins_generes), etiquette: 'Bulletins générés', detail: `${fmt.nombre(a.bulletins_ce_mois)} ce mois-ci`, icone: '📄' },
        { valeur: fmt.nombre(f.paiements_confirmes), etiquette: 'Paiements confirmés', detail: `${fmt.nombre(f.revenu_total)} cumulés`, icone: '💳' }
      ];

      const supervision = d.supervision || {};

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-grille-stats">${cartes.map(ui.carteStat).join('')}</div>
        </section>

        ${(d.alertes && d.alertes.length) ? `
        <section class="sa-section">
          <h2 class="sa-section-titre">
            Points d'attention
            <span class="sa-annexe">${d.alertes.length} élément(s)</span>
          </h2>
          <div class="sa-conteneur-tableau" id="zone-alertes">
            ${d.alertes.slice(0, 12).map((al) => `
              <div class="sa-resultat" data-ecole="${esc(al.ecole_id)}">
                <span class="sa-resultat-icone">${al.niveau === 'critique' ? '🔴' : al.niveau === 'avertissement' ? '🟠' : '🔵'}</span>
                <div class="sa-resultat-corps">
                  <div class="sa-resultat-titre">${esc(al.libelle)}</div>
                  <div class="sa-resultat-detail">${esc(al.detail)}</div>
                </div>
                ${ui.badge(al.type, SA.ui.tonStatut(al.niveau))}
              </div>`).join('')}
          </div>
        </section>` : ''}

        <section class="sa-section">
          <h2 class="sa-section-titre">Évolution sur 30 jours</h2>
          <div class="sa-grille-2">
            <div class="sa-panneau">
              <h3 class="sa-section-titre">Écoles inscrites</h3>
              ${graphe.courbe([{ nom: 'Écoles', points: points(d.courbes && d.courbes.ecoles) }], { titre: 'Croissance des écoles' })}
            </div>
            <div class="sa-panneau">
              <h3 class="sa-section-titre">Connexions quotidiennes</h3>
              ${graphe.courbe([{ nom: 'Connexions', points: points(d.courbes && d.courbes.connexions), couleur: 'var(--encre)' }], { titre: 'Connexions' })}
            </div>
            <div class="sa-panneau">
              <h3 class="sa-section-titre">Élèves inscrits</h3>
              ${graphe.courbe([{ nom: 'Élèves', points: points(d.courbes && d.courbes.eleves), couleur: 'var(--vert-ok)' }], { titre: 'Élèves' })}
            </div>
            <div class="sa-panneau">
              <h3 class="sa-section-titre">Revenus d'abonnement</h3>
              ${graphe.courbe([{ nom: 'Paiements', points: points(d.courbes && d.courbes.paiements), couleur: 'var(--ocre-dark)' }], { titre: 'Paiements' })}
            </div>
          </div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">État du système</h2>
          <div class="sa-grille-3">
            <div class="sa-panneau">
              <h3 class="sa-section-titre">Serveur</h3>
              <div class="sa-liste-infos">
                <div class="sa-ligne-info"><span>État</span><span>${ui.badgeStatut(s.serveur && s.serveur.etat)}</span></div>
                <div class="sa-ligne-info"><span>Disponibilité</span><span>${esc(fmt.dureeSecondes(s.serveur && s.serveur.uptime_secondes))}</span></div>
                <div class="sa-ligne-info"><span>Mémoire</span><span>${esc(fmt.nombre(s.serveur && s.serveur.memoire_utilisee_mo))} Mo</span></div>
                <div class="sa-ligne-info"><span>Charge (1 min)</span><span>${esc(fmt.decimal(s.serveur && s.serveur.charge_1min, 2))}</span></div>
              </div>
            </div>
            <div class="sa-panneau">
              <h3 class="sa-section-titre">API</h3>
              <div class="sa-liste-infos">
                <div class="sa-ligne-info"><span>Latence moyenne</span><span>${esc(fmt.duree(s.api && s.api.latence_moyenne_ms))}</span></div>
                <div class="sa-ligne-info"><span>Taux d'erreur</span><span>${esc(fmt.pourcent(s.api && s.api.taux_erreur))}</span></div>
                <div class="sa-ligne-info"><span>Débit</span><span>${esc(fmt.decimal(s.api && s.api.requetes_par_minute))} req/min</span></div>
                <div class="sa-ligne-info"><span>Base de données</span><span>${ui.badge('connectée', 'succes')}</span></div>
              </div>
            </div>
            <div class="sa-panneau">
              <h3 class="sa-section-titre">Données</h3>
              <div class="sa-liste-infos">
                <div class="sa-ligne-info"><span>Documents stockés</span><span>${esc(fmt.nombre(s.stockage && s.stockage.documents))}</span></div>
                <div class="sa-ligne-info"><span>Dernière sauvegarde</span><span>${esc(fmt.relatif(s.derniere_sauvegarde))}</span></div>
                <div class="sa-ligne-info"><span>Bugs ouverts</span><span>${ui.badge(fmt.nombre(supervision.bugs_ouverts), supervision.bugs_ouverts ? 'attention' : 'succes')}</span></div>
                <div class="sa-ligne-info"><span>Tickets ouverts</span><span>${ui.badge(fmt.nombre(supervision.tickets_ouverts), supervision.tickets_ouverts ? 'info' : 'succes')}</span></div>
              </div>
            </div>
          </div>
        </section>`;

      const zone = document.getElementById('zone-alertes');
      if (zone) {
        zone.addEventListener('click', (evenement) => {
          const ligne = evenement.target.closest('[data-ecole]');
          if (ligne && ligne.getAttribute('data-ecole')) {
            SA.naviguer(`explorer/ecole/${ligne.getAttribute('data-ecole')}`);
          }
        });
      }
    }
  });

  /* ======================================================================
     Analyses
     ====================================================================== */

  SA.enregistrerVue('analyses', {
    titre: 'Analyses',
    sousTitre: "Croissance, usage, résultats scolaires et assiduité.",

    async rendu(conteneur, params) {
      const jours = params.jours || '90';
      const ecoleId = params.ecole_id || '';

      const barre = document.createElement('div');
      conteneur.innerHTML = '';
      conteneur.appendChild(barre);

      const zone = document.createElement('div');
      zone.innerHTML = ui.squelette(4, 190);
      conteneur.appendChild(zone);

      SA.ui.barreFiltres(barre, [
        {
          type: 'select', nom: 'jours', libelle: 'Période', valeur: jours,
          options: [
            { valeur: '30', libelle: '30 derniers jours' },
            { valeur: '90', libelle: '3 derniers mois' },
            { valeur: '180', libelle: '6 derniers mois' },
            { valeur: '365', libelle: '12 derniers mois' }
          ]
        },
        { type: 'ecoles', nom: 'ecole_id', libelle: 'Toutes les écoles', valeur: ecoleId }
      ], (valeurs) => SA.naviguer('analyses', valeurs));

      const d = await SA.api(SA.url('/super-admin/analyses', { jours, ecole_id: ecoleId }));

      const connexionsRole = (d.connexions_par_role || [])
        .map((r) => ({ libelle: fmt.role(r.libelle), valeur: Number(r.valeur) }));

      zone.innerHTML = `
        <div class="sa-grille-2">
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Croissance des écoles</h3>
            ${graphe.courbe([{ nom: 'Écoles', points: points(d.croissance_ecoles, 'periode') }])}
          </div>
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Nouvelles inscriptions d'élèves</h3>
            ${graphe.courbe([{ nom: 'Inscriptions', points: points(d.inscriptions, 'periode'), couleur: 'var(--vert-ok)' }])}
          </div>
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Revenus d'abonnement</h3>
            ${graphe.courbe([{ nom: 'Montant', points: points(d.paiements, 'periode'), couleur: 'var(--ocre-dark)' }])}
          </div>
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Activité de la plateforme</h3>
            ${graphe.courbe([
              { nom: 'Actions', points: points(d.activite_quotidienne, 'periode') },
              { nom: 'Connexions', points: points(d.activite_quotidienne, 'periode', 'connexions'), couleur: 'var(--encre)' }
            ], { aire: false })}
          </div>
        </div>

        <div class="sa-grille-2" style="margin-top:16px">
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Connexions par rôle</h3>
            ${graphe.barres(connexionsRole)}
          </div>
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Modules les plus utilisés <span class="sa-annexe">30 jours</span></h3>
            ${graphe.barres((d.utilisation_modules || []).map((m) => ({ libelle: m.module, valeur: Number(m.valeur) })), { couleur: 'var(--encre)' })}
          </div>
        </div>

        <div class="sa-section" style="margin-top:24px">
          <h2 class="sa-section-titre">Fréquentation <span class="sa-annexe">taux de présence par période</span></h2>
          ${(d.frequentation && d.frequentation.length)
            ? graphe.courbe([{
                nom: 'Taux de présence',
                points: (d.frequentation || []).map((f) => ({ x: formaterAbscisse(f.periode), y: Number(f.taux_presence) || 0 })),
                couleur: 'var(--vert-ok)'
              }])
            : ui.etatVide('Aucun relevé de présence sur la période')}
        </div>

        <div class="sa-grille-2" style="margin-top:16px">
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Taux de réussite par école</h3>
            ${ui.tableau({
              colonnes: [
                { cle: 'ecole', titre: 'École' },
                { cle: 'bulletins', titre: 'Bulletins', classe: 'sa-num', rendu: (l) => fmt.nombre(l.bulletins) },
                { cle: 'moyenne', titre: 'Moyenne', classe: 'sa-num', rendu: (l) => fmt.pourcent(l.moyenne) },
                { cle: 'taux_reussite', titre: 'Réussite', classe: 'sa-num',
                  rendu: (l) => ui.badge(fmt.pourcent(l.taux_reussite), Number(l.taux_reussite) >= 60 ? 'succes' : Number(l.taux_reussite) >= 40 ? 'attention' : 'danger') }
              ],
              lignes: d.taux_reussite_par_ecole || [],
              vide: 'Aucun bulletin calculé'
            })}
          </div>
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Taux d'absence par école <span class="sa-annexe">90 jours</span></h3>
            ${ui.tableau({
              colonnes: [
                { cle: 'ecole', titre: 'École' },
                { cle: 'total', titre: 'Relevés', classe: 'sa-num', rendu: (l) => fmt.nombre(l.total) },
                { cle: 'absences', titre: 'Absences', classe: 'sa-num', rendu: (l) => fmt.nombre(l.absences) },
                { cle: 'taux_absence', titre: 'Taux', classe: 'sa-num',
                  rendu: (l) => ui.badge(fmt.pourcent(l.taux_absence), Number(l.taux_absence) > 15 ? 'danger' : Number(l.taux_absence) > 8 ? 'attention' : 'succes') }
              ],
              lignes: d.taux_absence_par_ecole || [],
              vide: 'Aucun relevé de présence'
            })}
          </div>
        </div>

        <div class="sa-section" style="margin-top:16px">
          <h2 class="sa-section-titre">Écoles les plus actives <span class="sa-annexe">30 derniers jours</span></h2>
          ${graphe.barres((d.ecoles_les_plus_actives || []).map((e) => ({ libelle: e.ecole, valeur: Number(e.actions) })))}
        </div>`;
    }
  });

  /* ======================================================================
     Rapports
     ====================================================================== */

  SA.enregistrerVue('rapports', {
    titre: 'Rapports',
    sousTitre: 'Exports de la plateforme au format Excel, CSV, PDF ou JSON.',

    async rendu(conteneur) {
      const d = await SA.api('/super-admin/rapports');

      conteneur.innerHTML = `
        <p class="sa-note" style="margin-bottom:18px">
          Les exports respectent les mêmes règles que l'affichage : aucune donnée
          sensible (mot de passe, jeton, clé d'API) n'y figure. Le format PDF
          ouvre une page prête à imprimer — le navigateur produit le fichier,
          ce qui évite de faire tourner un moteur de rendu sur le serveur.
        </p>
        <div class="sa-grille-3">
          ${(d.rapports || []).map((r) => `
            <div class="sa-panneau">
              <h3 class="sa-section-titre">${esc(r.libelle)}</h3>
              <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px">
                ${(d.formats || []).map((f) => `
                  <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
                          data-rapport="${esc(r.cle)}" data-format="${esc(f)}">
                    ${esc(f.toUpperCase())}
                  </button>`).join('')}
              </div>
            </div>`).join('')}
        </div>`;

      conteneur.addEventListener('click', async (evenement) => {
        const bouton = evenement.target.closest('[data-rapport]');
        if (!bouton) return;

        const rapport = bouton.getAttribute('data-rapport');
        const format = bouton.getAttribute('data-format');
        const libelleOrigine = bouton.textContent;

        if (format === 'pdf') {
          // La page imprimable a besoin du jeton : on la récupère puis on
          // l'ouvre depuis un blob, un simple window.open n'étant pas
          // authentifié.
          bouton.disabled = true;
          bouton.textContent = '…';
          try {
            const html = await SA.api(`/super-admin/rapports/${rapport}?format=pdf`);
            const blob = new Blob([html], { type: 'text/html' });
            const fenetre = window.open(URL.createObjectURL(blob), '_blank');
            if (!fenetre) SA.toast('Le navigateur a bloqué la fenêtre. Autorisez les pop-ups.', 'attention');
          } catch (erreur) {
            SA.toast(erreur.message, 'erreur');
          } finally {
            bouton.disabled = false;
            bouton.textContent = libelleOrigine;
          }
          return;
        }

        const extensions = { xlsx: 'xlsx', csv: 'csv', json: 'json' };
        bouton.disabled = true;
        bouton.textContent = '…';
        try {
          await SA.telecharger(
            `/super-admin/rapports/${rapport}?format=${format}`,
            `ardoise-${rapport}-${new Date().toISOString().slice(0, 10)}.${extensions[format]}`
          );
          SA.toast('Export téléchargé.', 'succes');
        } catch (erreur) {
          SA.toast(erreur.message, 'erreur');
        } finally {
          bouton.disabled = false;
          bouton.textContent = libelleOrigine;
        }
      });
    }
  });
})();
