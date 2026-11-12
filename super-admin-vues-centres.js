/* =============================================================================
   SUPER ADMIN — CENTRES DE FORMATION, CLASSES EN DIRECT, SITES ET APPLICATIONS
   =============================================================================

   Tout ce que les centres et les écoles créent « côté public » se contrôle ici :

     · Centres de formation : chaque centre, son offre, son activité réelle
       (apprenants, séances, Classe Ardoise, leçons, encaissements, demandes du
       site) et les réglages de l'IA de sa classe.
     · Classes en direct : les Classes Ardoise ouvertes à cet instant, qui y est,
       ce que fait l'IA (sous-titres, traductions, questions), et la fermeture
       d'une classe pour tous (motif obligatoire, journalisé).
     · Sites et applications : chaque site publié, son adresse, son sous-domaine,
       son application installable, les préinscriptions reçues et celles qui
       attendent une réponse.
   ============================================================================= */

(function () {
  'use strict';

  const SA = window.SA;
  const ui = SA.ui;
  const esc = SA.esc;
  const fmt = SA.fmt;

  function oui(v) { return v ? ui.badge('oui', 'succes') : ui.badge('non', 'neutre'); }
  function depuis(v) {
    if (!v) return '<span class="sa-muet">jamais</span>';
    const j = Math.floor((Date.now() - new Date(v).getTime()) / 86400000);
    if (j <= 0) return 'aujourd’hui';
    if (j === 1) return 'hier';
    return `il y a ${j} j`;
  }
  function lien(url, texte) { return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(texte || url.replace(/^https:\/\//, ''))}</a>` : '<span class="sa-muet">—</span>'; }

  /* =========================================================================
     CENTRES DE FORMATION
     ========================================================================= */
  SA.enregistrerVue('centres', {
    titre: 'Centres de formation',
    sousTitre: 'Chaque centre, son activité réelle, son site et l’IA de sa classe en ligne.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squeletteCartes(4) + ui.squelette(6, 46);
      const d = await SA.api('/super-admin/centres');
      const t = d.totaux || {};
      const q = String(params.q || '').toLowerCase();
      const lignes = (d.centres || []).filter((c) => !q || `${c.nom} ${c.code} ${c.ville || ''} ${c.domaine || ''}`.toLowerCase().includes(q));

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-grille-stats">
            ${ui.carteStat({ valeur: fmt.nombre(t.centres), etiquette: 'Centres', detail: `${fmt.nombre(t.actifs)} actif(s) · ${fmt.nombre(t.sites_publies)} site(s) publié(s)`, ton: 'info' })}
            ${ui.carteStat({ valeur: fmt.nombre(t.apprenants_actifs), etiquette: 'Apprenants actifs', ton: 'succes' })}
            ${ui.carteStat({ valeur: fmt.nombre(t.seances_30j), etiquette: 'Séances données (30 j)', detail: `${fmt.nombre(t.classes_ardoise_30j)} en Classe Ardoise` })}
            ${ui.carteStat({ valeur: fmt.nombre(t.demandes_30j), etiquette: 'Demandes des sites (30 j)', ton: t.demandes_30j ? 'succes' : 'neutre' })}
          </div>
        </section>
        <section class="sa-section">
          <div class="sa-barre-filtres">
            <input type="search" id="filtre-centres" placeholder="Rechercher un centre, une ville, un domaine…" value="${esc(params.q || '')}">
            <a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="#/classes-direct">Classes en direct</a>
            <a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="#/sites">Sites et applications</a>
          </div>
          ${ui.tableau({
            colonnes: [
              { titre: 'Centre', rendu: (c) => `<div style="min-width:180px"><strong>${esc(c.nom)}</strong><div class="sa-muet" style="font-size:.75rem">${esc(c.code)} · ${esc(c.ville || '—')}${c.domaine ? ' · ' + esc(c.domaine) : ''}</div></div>` },
              { titre: 'Offre', rendu: (c) => `${esc(c.offre || '—')}<div>${c.statut_abonnement ? ui.badgeStatut(c.statut_abonnement) : ''}</div>` },
              { titre: 'Apprenants', rendu: (c) => `${fmt.nombre(c.apprenants_actifs)}<div class="sa-muet" style="font-size:.72rem">sur ${fmt.nombre(c.apprenants_total)}</div>` },
              { titre: 'Groupes', rendu: (c) => fmt.nombre(c.groupes_ouverts) },
              { titre: 'Séances 30 j', rendu: (c) => `${fmt.nombre(c.seances_30j)}<div class="sa-muet" style="font-size:.72rem">${fmt.nombre(c.classes_ardoise_30j)} en Classe Ardoise</div>` },
              { titre: 'Leçons', rendu: (c) => fmt.nombre(c.lecons) },
              { titre: 'Encaissé 30 j', rendu: (c) => `${fmt.montant(c.encaisse_30j)}<div class="sa-muet" style="font-size:.7rem">devise du centre</div>` },
              { titre: 'Demandes', rendu: (c) => `${fmt.nombre(c.demandes_30j)}${c.demandes_en_attente ? ' ' + ui.badge(c.demandes_en_attente + ' en attente', c.demandes_en_attente > 3 ? 'attention' : 'info') : ''}` },
              { titre: 'Site', rendu: (c) => c.site_public_actif ? lien(`https://myardoise.com/${c.site_adresse || 'ecole.html?code=' + encodeURIComponent(c.code)}`, c.site_adresse || c.code) : ui.badge('non publié', 'neutre') },
              { titre: 'IA de la classe', rendu: (c) => !c.classe_ardoise ? '<span class="sa-muet">autre outil</span>'
                : [c.ia_classe.sous_titres ? 'sous-titres' : null, c.ia_classe.traduction ? 'traduction' : null, c.ia_classe.assistant ? 'assistant' : null].filter(Boolean).map((x) => ui.badge(x, 'info')).join(' ') || ui.badge('éteinte', 'neutre') },
              { titre: 'Dernière connexion', rendu: (c) => depuis(c.derniere_connexion) }
            ],
            lignes, cliquable: true,
            vide: 'Aucun centre de formation'
          })}
        </section>`;

      const champ = conteneur.querySelector('#filtre-centres');
      champ.addEventListener('input', SA.antiRebond(() => SA.naviguer('centres', champ.value ? { q: champ.value } : {}), 400));
      // Un clic ouvre la fiche du centre (abonnement, utilisateurs, actions), comme dans « Toutes les écoles ».
      conteneur.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', (ev) => {
        if (ev.target.closest('a')) return;
        const id = tr.getAttribute('data-id');
        if (typeof SA.ouvrirFicheEcole === 'function') SA.ouvrirFicheEcole(id, () => SA.rafraichirVue());
        else SA.naviguer('ecoles/statistiques', { ecole_id: id });
      }));
    }
  });

  /* =========================================================================
     CLASSES EN DIRECT
     ========================================================================= */
  const LIBELLES_IA = { classe_ardoise: 'Assistant du coach', classe_ardoise_apprenant: 'Assistant des apprenants', classe_traduction: 'Traduction des sous-titres' };
  const MODES = { tous: ['ouvert à tous', 'succes'], off: ['fermé', 'danger'], super_admin: ['Super Admin seul', 'attention'], pilotes: ['centres pilotes', 'info'], pourcentage: ['pourcentage', 'info'], absent: ['non migré', 'danger'] };

  SA.enregistrerVue('classes-direct', {
    titre: 'Classes en direct',
    sousTitre: 'Les Classes Ardoise ouvertes maintenant, et l’IA qui les accompagne.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squeletteCartes(3) + ui.squelette(4, 46);
      const d = await SA.api('/super-admin/classes-direct');
      const classes = d.classes || [];
      const presents = classes.reduce((a, c) => a + c.connectes, 0);
      const ia = Object.fromEntries((d.ia_mois || []).map((x) => [x.code, x]));
      const appelsIA = (d.ia_mois || []).reduce((a, x) => a + Number(x.appels || 0), 0);
      const coutIA = (d.ia_mois || []).reduce((a, x) => a + Number(x.cout || 0), 0);

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-grille-stats">
            ${ui.carteStat({ valeur: fmt.nombre(classes.length), etiquette: 'Classes ouvertes', ton: classes.length ? 'succes' : 'neutre' })}
            ${ui.carteStat({ valeur: fmt.nombre(presents), etiquette: 'Personnes connectées' })}
            ${ui.carteStat({ valeur: fmt.nombre(classes.reduce((a, c) => a + (c.sous_titres || 0), 0)), etiquette: 'Phrases sous-titrées', detail: 'dans les classes ouvertes' })}
            ${ui.carteStat({ valeur: fmt.nombre(appelsIA), etiquette: 'Appels IA de classe ce mois', detail: `${fmt.montant(coutIA, '$')} estimés`, ton: 'info' })}
          </div>
        </section>

        <section class="sa-section">
          <h3 class="sa-section-titre">L’IA dans la classe — interrupteurs de la plateforme</h3>
          <p class="sa-muet" style="margin:0 0 10px">Chaque centre peut ensuite l’éteindre chez lui (Réglages → Cours en ligne). L’assistant des apprenants se tait pendant les sondages et les exercices, et ne donne jamais de réponse de quiz.</p>
          ${ui.tableau({
            colonnes: [
              { titre: 'Fonction', rendu: (f) => `<strong>${esc(f.libelle || f.cle)}</strong><div class="sa-muet" style="font-size:.75rem">${esc(f.description || '')}</div>` },
              { titre: 'État', rendu: (f) => { const m = MODES[f.mode] || [f.mode, 'neutre']; return ui.badge(m[0] + (f.mode === 'pourcentage' ? ` (${f.pourcentage} %)` : f.mode === 'pilotes' ? ` (${(f.ecoles_pilotes || []).length})` : ''), m[1]); } },
              { titre: 'Clé', rendu: (f) => `<code>${esc(f.cle)}</code>` }
            ],
            lignes: d.drapeaux || [], vide: 'Aucun drapeau'
          })}
          <p style="margin-top:10px"><a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="#/cc/drapeaux">Modifier dans Contrôle → Drapeaux</a></p>
          <div class="sa-grille-stats" style="margin-top:12px">
            ${Object.keys(LIBELLES_IA).map((k) => ui.carteStat({ valeur: fmt.nombre((ia[k] || {}).appels || 0), etiquette: LIBELLES_IA[k], detail: `ce mois · ${fmt.montant((ia[k] || {}).cout || 0, '$')}` })).join('')}
          </div>
        </section>

        <section class="sa-section">
          <h3 class="sa-section-titre">Ouvertes maintenant</h3>
          ${ui.tableau({
            colonnes: [
              { titre: 'Centre', rendu: (c) => `<strong>${esc((c.ecole || {}).nom || c.ecole_id)}</strong><div class="sa-muet" style="font-size:.75rem">${esc((c.ecole || {}).code || '')}</div>` },
              { titre: 'Cours', rendu: (c) => `${esc(c.titre || (c.seance || {}).groupe || '—')}${(c.seance || {}).theme ? `<div class="sa-muet" style="font-size:.75rem">${esc(c.seance.theme)}</div>` : ''}` },
              { titre: 'Coach', rendu: (c) => c.animateur_nom ? esc(c.animateur_nom) : ui.badge('pas de coach', 'attention') },
              { titre: 'Connectés', rendu: (c) => `${fmt.nombre(c.connectes)}<div class="sa-muet" style="font-size:.72rem">${fmt.nombre(c.apprenants)} apprenant(s) · pic ${fmt.nombre(c.pic)}</div>` },
              { titre: 'Ouverte depuis', rendu: (c) => `${fmt.nombre(c.minutes)} min` },
              { titre: 'État', rendu: (c) => [c.terminee ? ui.badge('terminée', 'neutre') : ui.badge('en cours', 'succes'), c.verrouillee ? ui.badge('porte fermée', 'attention') : '', c.sondage_ouvert ? ui.badge('sondage', 'info') : '', ui.badge(c.vue === 'visio' ? 'visio' : 'salle', 'neutre')].join(' ') },
              { titre: 'IA', rendu: (c) => `${fmt.nombre(c.sous_titres)} phrase(s)${(c.langues || []).length ? ' · traduit en ' + esc(c.langues.join(', ')) : ''}<div class="sa-muet" style="font-size:.72rem">${fmt.nombre(c.ia_appels)} appel(s) IA</div>` },
              { titre: '', rendu: (c) => c.terminee ? '' : `<button class="sa-bouton sa-bouton-danger sa-bouton-petit" data-fermer-classe="${esc(c.ecole_id)}|${esc(c.seance_id)}">Fermer</button>` }
            ],
            lignes: classes,
            vide: 'Aucune classe ouverte en ce moment'
          })}
          <p class="sa-muet" style="font-size:.78rem;margin-top:8px">Les classes vivent en mémoire du serveur : la liste est celle de cet instant. Rechargez pour la mettre à jour.</p>
        </section>`;

      conteneur.querySelectorAll('[data-fermer-classe]').forEach((b) => {
        b.addEventListener('click', () => {
          const [ecoleId, seanceId] = b.getAttribute('data-fermer-classe').split('|');
          const m = SA.modale({
            titre: 'Fermer cette classe pour tous',
            sousTitre: 'Chaque participant voit « Le cours est terminé » ; sa participation est enregistrée.',
            contenu: '<label class="sa-champ">Motif (journalisé)<textarea id="motif-fermeture" rows="3" placeholder="ex. classe restée ouverte la nuit, signalement d’un abus…"></textarea></label>',
            actions: '<button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button><button class="sa-bouton sa-bouton-danger" data-role="valider">Fermer la classe</button>'
          });
          m.querySelector('[data-role="annuler"]').addEventListener('click', () => m.fermer());
          m.querySelector('[data-role="valider"]').addEventListener('click', async () => {
            try {
              const r = await SA.api('/super-admin/classes-direct/fermer', { method: 'POST', body: JSON.stringify({ ecole_id: ecoleId, seance_id: seanceId, motif: m.querySelector('#motif-fermeture').value }) });
              m.fermer(); SA.toast(r.message, 'succes'); SA.rafraichirVue();
            } catch (err) { SA.toast(err.message, 'danger'); }
          });
        });
      });
    }
  });

  /* =========================================================================
     SITES ET APPLICATIONS
     ========================================================================= */
  const TYPES = { preinscription: 'Préinscription', test_niveau: 'Test de niveau', contact: 'Message', rendez_vous: 'Rendez-vous' };

  SA.enregistrerVue('sites', {
    titre: 'Sites et applications',
    sousTitre: 'Les sites publics des écoles et des centres, leurs applications et les demandes qu’ils reçoivent.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squeletteCartes(4) + ui.squelette(6, 46);
      const d = await SA.api('/super-admin/sites');
      const t = d.totaux || {};
      const filtre = params.type || 'tous';
      const lignes = (d.sites || []).filter((s) => filtre === 'tous' || s.type_structure === filtre);

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-grille-stats">
            ${ui.carteStat({ valeur: fmt.nombre(t.publies), etiquette: 'Sites publiés', detail: `dont ${fmt.nombre(t.centres)} centre(s) de formation`, ton: 'info' })}
            ${ui.carteStat({ valeur: fmt.nombre(t.demandes_30j), etiquette: 'Demandes reçues (30 j)', ton: 'succes' })}
            ${ui.carteStat({ valeur: fmt.nombre(t.en_attente), etiquette: 'Sans réponse', ton: t.en_attente ? 'attention' : 'neutre', detail: 'préinscriptions et messages à traiter' })}
          </div>
        </section>
        <section class="sa-section">
          <div class="sa-barre-filtres">
            <select id="filtre-type">
              ${[['tous', 'Écoles et centres'], ['ecole', 'Écoles'], ['centre_formation', 'Centres de formation']].map((o) => `<option value="${o[0]}"${o[0] === filtre ? ' selected' : ''}>${o[1]}</option>`).join('')}
            </select>
          </div>
          ${ui.tableau({
            colonnes: [
              { titre: 'Établissement', rendu: (s) => `<strong>${esc(s.nom)}</strong><div class="sa-muet" style="font-size:.75rem">${esc(s.code)} · ${s.type_structure === 'centre_formation' ? 'centre de formation' : 'école'}</div>` },
              { titre: 'Publié', rendu: (s) => oui(s.site_public_actif) },
              { titre: 'Adresse', rendu: (s) => lien(s.url) },
              { titre: 'Sous-domaine', rendu: (s) => s.sous_domaine ? `${lien(s.sous_domaine)}<div class="sa-muet" style="font-size:.7rem">actif quand le DNS pointe vers Ardoise</div>` : '<span class="sa-muet">—</span>' },
              { titre: 'Application', rendu: (s) => s.application ? `${lien(s.application, 'installer')} · ${lien(s.espace, s.type_structure === 'centre_formation' ? 'espace apprenant' : 'espace familles')}` : '<span class="sa-muet">—</span>' },
              { titre: 'Inscriptions en ligne', rendu: (s) => s.inscriptions_en_ligne === false ? ui.badge('fermées', 'neutre') : ui.badge('ouvertes', 'succes') },
              { titre: 'Demandes 30 j', rendu: (s) => `${fmt.nombre(s.demandes_30j || 0)}<div class="sa-muet" style="font-size:.72rem">${fmt.nombre(s.inscriptions_30j || 0)} inscription(s) · ${fmt.nombre(s.traitees_30j || 0)} traitée(s)</div>` },
              { titre: 'En attente', rendu: (s) => s.en_attente ? `${ui.badge(String(s.en_attente), s.en_attente > 3 ? 'attention' : 'info')}<div class="sa-muet" style="font-size:.72rem">la plus ancienne : ${depuis(s.plus_ancienne_en_attente)}</div>` : '<span class="sa-muet">0</span>' }
            ],
            lignes, vide: 'Aucun site'
          })}
        </section>
        <section class="sa-section">
          <h3 class="sa-section-titre">Dernières demandes reçues par les sites</h3>
          ${ui.tableau({
            colonnes: [
              { titre: 'Reçue', rendu: (x) => esc(fmt.dateHeure(x.created_at)) },
              { titre: 'Établissement', rendu: (x) => esc(x.ecole) },
              { titre: 'Type', rendu: (x) => ui.badge(TYPES[x.type] || x.type, x.type === 'preinscription' || x.type === 'test_niveau' ? 'succes' : 'info') },
              { titre: 'Pour', rendu: (x) => esc(x.programme || x.classe || '—') },
              { titre: 'Statut', rendu: (x) => ui.badgeStatut(x.statut === 'nouvelle' ? 'en_attente' : x.statut) }
            ],
            lignes: d.recentes || [], vide: 'Aucune demande pour l’instant'
          })}
          <p class="sa-muet" style="font-size:.78rem;margin-top:8px">Les noms et coordonnées des personnes restent dans l’espace de l’établissement : ici, seulement le volume et le suivi.</p>
        </section>`;

      conteneur.querySelector('#filtre-type').addEventListener('change', (e) => { location.hash = '#/sites' + (e.target.value !== 'tous' ? '?type=' + e.target.value : ''); });
    }
  });
})();
