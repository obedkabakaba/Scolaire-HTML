/* ==========================================================================
   ARDOISE CONTROL CENTER — INTELLIGENCE ARTIFICIELLE
   --------------------------------------------------------------------------
   Copilote, conseil stratégique, cause racine, correctifs proposés, rapports,
   coûts.

   CE QUE CES ÉCRANS RAPPELLENT EN PERMANENCE
   ------------------------------------------
   L'IA lit et propose ; elle n'exécute pas. Ce n'est pas une formule de
   politesse affichée une fois : chaque écran qui produit une recommandation
   affiche aussi la limite de ce qu'elle vaut, et chaque correctif proposé
   porte son avertissement. Sur une plateforme qui gère des notes et des
   paiements, une IA qu'on croit sur parole coûte plus cher que pas d'IA.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui } = SA;

  /* ======================================================================
     1. COPILOTE
     ====================================================================== */

  const SUGGESTIONS = [
    "Quels problèmes dois-je régler en priorité ?",
    "Quels sont les risques de sécurité actuels ?",
    "Est-ce que les permissions du Directeur sont cohérentes ?",
    "Comment fonctionne la génération des bulletins ?",
    "Quelle route permet de créer un élève ?",
    "Pourquoi le comptable ne peut-il pas enregistrer un paiement ?",
    "Qu'est-ce qui a changé cette semaine ?",
    "Quelles écoles risquent d'abandonner ?"
  ];

  SA.enregistrerVue('cc/copilote', {
    titre: 'Copilote Ardoise',
    sousTitre: "Il lit le système par des outils nommés. Il ne peut rien modifier.",

    async rendu(conteneur) {
      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="cc-ia-outils">Voir ses outils</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="cc-ia-vider">Nouvelle conversation</button>`;
      }

      // L'historique vit dans la page : il n'est pas conservé côté serveur.
      // Une conversation d'administration peut contenir des noms d'écoles et
      // des détails d'incidents ; la garder en base demanderait une politique
      // de rétention qui n'existe pas encore.
      const historique = [];

      conteneur.innerHTML = `
        <div class="cc-copilote">
          <div class="cc-conversation" id="cc-conv">
            <div class="cc-message assistant">
              <div class="cc-message-corps">Bonjour. Je peux consulter l'état de la plateforme, les erreurs, les écarts d'audit, la matrice des permissions, les règles métier, les journaux et les indicateurs commerciaux.

Je réponds en distinguant systématiquement :
· FAIT — ce que mes outils ont réellement renvoyé
· HYPOTHÈSE — mon interprétation, avec ce qui permettrait de la vérifier
· RECOMMANDATION — ce que je propose, avec le risque associé

Je ne peux modifier ni le code, ni la configuration, ni les données : aucun de mes outils n'écrit.</div>
              <div class="cc-suggestions" id="cc-sugg">
                ${SUGGESTIONS.map((s) => `<button class="cc-suggestion">${esc(s)}</button>`).join('')}
              </div>
            </div>
          </div>
          <div class="cc-saisie">
            <textarea id="cc-question" rows="1"
              placeholder="Posez votre question — Entrée pour envoyer, Maj+Entrée pour un retour à la ligne"></textarea>
            <button class="sa-bouton sa-bouton-principal" id="cc-envoyer">Envoyer</button>
          </div>
        </div>`;

      const conv = document.getElementById('cc-conv');
      const champ = document.getElementById('cc-question');
      const bouton = document.getElementById('cc-envoyer');

      function ajouterMessage(role, texte, meta) {
        const el = document.createElement('div');
        el.className = `cc-message ${role}`;
        el.innerHTML = `<div class="cc-message-corps">${esc(texte)}</div>`
          + (meta ? `<div class="cc-message-meta">${meta}</div>` : '');
        conv.appendChild(el);
        conv.scrollTop = conv.scrollHeight;
        return el;
      }

      async function envoyer(question) {
        const q = String(question || champ.value).trim();
        if (!q) return;

        champ.value = '';
        const sugg = document.getElementById('cc-sugg');
        if (sugg) sugg.remove();

        ajouterMessage('utilisateur', q);
        historique.push({ role: 'user', content: q });

        const attente = document.createElement('div');
        attente.className = 'cc-message assistant';
        attente.innerHTML = '<div class="cc-message-corps"><span class="cc-reflexion"><span></span><span></span><span></span></span></div>';
        conv.appendChild(attente);
        conv.scrollTop = conv.scrollHeight;

        bouton.disabled = true;
        champ.disabled = true;

        try {
          const r = await SA.api('/super-admin/control-center/ia/demander', {
            method: 'POST',
            body: JSON.stringify({ question: q, historique: historique.slice(-8) })
          });
          attente.remove();

          const meta = [
            `<span>${esc(r.modele)}</span>`,
            `<span>${esc(fmt.duree(r.duree_ms))}</span>`,
            r.cout_estime_usd ? `<span>≈ ${esc(r.cout_estime_usd.toFixed(5))} USD</span>` : '',
            ...(r.outils_appeles || []).map((o) => `<span class="cc-outil-appele">${esc(o)}</span>`)
          ].filter(Boolean).join('');

          ajouterMessage('assistant', r.reponse, meta);
          historique.push({ role: 'assistant', content: r.reponse });
        } catch (err) {
          attente.remove();
          ajouterMessage('assistant',
            `Je n'ai pas pu répondre : ${err.message}`,
            '<span>erreur</span>');
        } finally {
          bouton.disabled = false;
          champ.disabled = false;
          champ.focus();
        }
      }

      bouton.addEventListener('click', () => envoyer());
      champ.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); envoyer(); }
      });
      // Le champ grandit avec le texte : une question de six lignes ne doit pas
      // se saisir dans une fente d'une ligne.
      champ.addEventListener('input', () => {
        champ.style.height = 'auto';
        champ.style.height = Math.min(140, champ.scrollHeight) + 'px';
      });

      conteneur.querySelectorAll('.cc-suggestion').forEach((b) => {
        b.addEventListener('click', () => envoyer(b.textContent));
      });

      const btnOutils = document.getElementById('cc-ia-outils');
      if (btnOutils) {
        btnOutils.addEventListener('click', async () => {
          const d = await SA.api('/super-admin/control-center/ia/outils');
          SA.modale({
            titre: "Ce que le copilote peut faire",
            sousTitre: `${d.outils.length} outils, tous en lecture`,
            large: true,
            contenu: `
              <div class="cc-encart-fait">${esc(d.garantie)}</div>
              ${d.outils.map((o) => `
                <div class="cc-champ">
                  <dt class="sa-mono">${esc(o.nom)}</dt>
                  <dd>${esc(o.description)}
                    ${o.parametres.length ? `<br><span class="sa-annexe sa-mono">${esc(o.parametres.join(', '))}</span>` : ''}
                  </dd>
                </div>`).join('')}
              <h3 class="sa-section-titre" style="margin-top:18px">Protections</h3>
              ${Object.entries(d.protections || {}).map(([k, v]) => `
                <div class="cc-champ"><dt>${esc(k.replace(/_/g, ' '))}</dt><dd>${esc(v)}</dd></div>`).join('')}`
          });
        });
      }

      const btnVider = document.getElementById('cc-ia-vider');
      if (btnVider) btnVider.addEventListener('click', () => SA.rafraichirVue());

      champ.focus();
    }
  });

  /* ======================================================================
     2. CONSEIL STRATÉGIQUE
     ====================================================================== */

  SA.enregistrerVue('cc/conseil', {
    titre: 'Conseil stratégique',
    sousTitre: "Produit, commercial, financier, technique, adoption — à partir des chiffres réels.",

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(4, 60);
      const d = await SA.api('/super-admin/control-center/ia/domaines-conseil');
      const choisi = params.domaine || '';

      conteneur.innerHTML = `
        <div class="cc-grille-3">
          ${(d.domaines || []).map((x) => `
            <div class="sa-panneau">
              <h3 class="sa-section-titre" style="margin-top:0">${esc(x.libelle)}</h3>
              <p class="sa-annexe" style="line-height:1.55">${esc(x.consigne)}</p>
              <button class="sa-bouton sa-bouton-principal sa-bouton-petit"
                      data-domaine="${esc(x.cle)}" style="margin-top:10px">Demander un conseil</button>
            </div>`).join('')}
        </div>

        <section class="sa-section">
          <h2 class="sa-section-titre">Question précise (facultatif)</h2>
          <div class="cc-filtres">
            <label class="cc-filtre cc-filtre-large"><span>Votre question</span>
              <input class="sa-champ" id="cc-conseil-q"
                     placeholder="ex. faut-il créer une offre intermédiaire entre 250 et 600 élèves ?"></label>
          </div>
        </section>

        <div id="cc-conseil-sortie"></div>`;

      conteneur.querySelectorAll('[data-domaine]').forEach((b) => {
        b.addEventListener('click', async () => {
          const domaine = b.getAttribute('data-domaine');
          const zone = document.getElementById('cc-conseil-sortie');
          const avant = b.textContent;
          b.disabled = true; b.textContent = 'Analyse…';
          zone.innerHTML = '<div class="sa-panneau">' + ui.squelette(5, 22) + '</div>';
          try {
            const r = await SA.api('/super-admin/control-center/ia/conseil', {
              method: 'POST',
              body: JSON.stringify({
                domaine,
                question: (document.getElementById('cc-conseil-q') || {}).value || null
              })
            });
            zone.innerHTML = `
              <section class="sa-section">
                <h2 class="sa-section-titre">${esc(r.libelle)}
                  <span class="sa-annexe">${esc(r.modele)} · ${esc(fmt.duree(r.duree_ms))}</span></h2>
                <div class="sa-panneau" style="white-space:pre-wrap;line-height:1.7;font-size:.9rem">${esc(r.conseil)}</div>
                <div class="cc-source">
                  Données transmises au modèle : ${(r.donnees_transmises || []).map(esc).join(', ')}.<br>
                  ${esc(r.note || '')}
                </div>
              </section>`;
          } catch (err) {
            zone.innerHTML = `<div class="cc-encart-danger">${esc(err.message)}</div>`;
          } finally { b.disabled = false; b.textContent = avant; }
        });
      });

      if (choisi) {
        const b = conteneur.querySelector(`[data-domaine="${choisi}"]`);
        if (b) b.click();
      }
    }
  });

  /* ======================================================================
     3. CAUSE RACINE
     ====================================================================== */

  SA.enregistrerVue('cc/cause-racine', {
    titre: 'Analyse de cause racine',
    sousTitre: "Plusieurs symptômes en même temps viennent-ils d'une même panne ?",

    async rendu(conteneur) {
      conteneur.innerHTML = `
        <section class="sa-panneau">
          <p class="sa-texte" style="margin-top:0">
            Quand cinquante erreurs de paiement, vingt-neuf délais dépassés et quatorze
            erreurs de base surviennent ensemble, la question utile n'est pas
            « laquelle corriger » mais « ont-elles la même cause ». C'est ce que cette
            analyse cherche — et elle dit aussi quand la réponse est non.
          </p>
          <div class="cc-filtres">
            <label class="cc-filtre"><span>Fenêtre d'analyse</span>
              <select class="sa-champ" id="cc-cr-heures">
                <option value="1">Dernière heure</option>
                <option value="6" selected>6 heures</option>
                <option value="24">24 heures</option>
                <option value="72">3 jours</option>
              </select></label>
            <button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="cc-cr-lancer">Analyser</button>
          </div>
        </section>
        <div id="cc-cr-sortie"></div>`;

      const btn = document.getElementById('cc-cr-lancer');
      btn.addEventListener('click', async () => {
        const zone = document.getElementById('cc-cr-sortie');
        btn.disabled = true; btn.textContent = 'Analyse…';
        zone.innerHTML = '<div class="sa-panneau">' + ui.squelette(5, 22) + '</div>';
        try {
          const r = await SA.api('/super-admin/control-center/ia/cause-racine', {
            method: 'POST',
            body: JSON.stringify({ heures: Number(document.getElementById('cc-cr-heures').value) })
          });

          if (r.verdict === 'aucun symptôme') {
            zone.innerHTML = `
              <div class="cc-encart-fait">
                <strong>Rien à corréler.</strong><br>${esc(r.analyse)}<br><br>
                <span class="sa-annexe">${esc(r.cout_evite || '')}</span>
              </div>`;
            return;
          }

          const s = r.symptomes || {};
          zone.innerHTML = `
            <div class="sa-grille-stats" style="margin:18px 0">
              ${ui.carteStat({ valeur: fmt.nombre(s.erreurs_distinctes), etiquette: 'Erreurs distinctes' })}
              ${ui.carteStat({ valeur: fmt.nombre(s.occurrences_totales), etiquette: 'Occurrences' })}
              ${ui.carteStat({ valeur: fmt.nombre(s.verifications_en_echec), etiquette: 'Vérifications en échec',
                               ton: s.verifications_en_echec ? 'danger' : 'succes' })}
              ${ui.carteStat({ valeur: fmt.nombre(s.incidents_ouverts), etiquette: 'Incidents ouverts' })}
            </div>
            <section class="sa-section">
              <h2 class="sa-section-titre">Analyse <span class="sa-annexe">${esc(r.modele)}</span></h2>
              <div class="sa-panneau" style="white-space:pre-wrap;line-height:1.7;font-size:.9rem">${esc(r.analyse)}</div>
              <div class="cc-encart-hypothese">${esc(r.avertissement)}</div>
            </section>`;
        } catch (err) {
          zone.innerHTML = `<div class="cc-encart-danger">${esc(err.message)}</div>`;
        } finally { btn.disabled = false; btn.textContent = 'Analyser'; }
      });
    }
  });

  /* ======================================================================
     4. CORRECTIFS PROPOSÉS
     ====================================================================== */

  SA.enregistrerVue('cc/correctifs', {
    titre: 'Correctifs proposés',
    sousTitre: "Détection, proposition, exécution : trois étapes séparées. La troisième est la vôtre.",

    async rendu(conteneur, params) {
      const requete = { statut: params.statut || '', risque: params.risque || '', page: params.page || 1 };
      conteneur.innerHTML = ui.squelette(6);
      const d = await SA.api(SA.url('/super-admin/control-center/correctifs', requete));

      conteneur.innerHTML = `
        <div class="cc-encart-danger">
          Un correctif « accepté » n'est PAS appliqué : cette plateforme ne dispose
          d'aucun mécanisme d'écriture dans les fichiers source. L'acceptation
          enregistre votre décision ; l'application se fait dans le dépôt, en revue de
          code, par un humain.
        </div>

        <div class="cc-filtres">
          <label class="cc-filtre"><span>Statut</span>
            <select class="sa-champ" id="cc-co-statut">
              <option value="">Tous</option>
              ${['proposee', 'acceptee', 'rejetee', 'appliquee'].map((s) =>
                `<option value="${s}"${requete.statut === s ? ' selected' : ''}>${s}</option>`).join('')}
            </select></label>
          <label class="cc-filtre"><span>Risque</span>
            <select class="sa-champ" id="cc-co-risque">
              <option value="">Tous</option>
              ${['faible', 'moyen', 'eleve', 'critique'].map((s) =>
                `<option value="${s}"${requete.risque === s ? ' selected' : ''}>${s}</option>`).join('')}
            </select></label>
        </div>

        ${(d.donnees || []).map((p) => `
          <div class="sa-panneau" style="margin-bottom:14px">
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:9px">
              ${ui.badgeStatut(p.statut)}
              ${ui.badge('risque ' + p.risque, p.risque === 'faible' ? 'succes' : p.risque === 'moyen' ? 'attention' : 'danger')}
              <span class="sa-mono sa-annexe">${esc(p.fichier)}${p.fonction ? ' → ' + esc(p.fonction) : ''}</span>
              <span class="sa-annexe">${esc(fmt.relatif(p.created_at))}</span>
            </div>
            ${p.constat_titre ? `<div style="font-weight:500;margin-bottom:7px">${esc(p.constat_titre)}</div>` : ''}
            ${p.pourquoi ? `<p class="sa-texte" style="margin:0 0 9px">${esc(p.pourquoi)}</p>` : ''}
            ${p.diff_propose ? `<pre class="cc-code">${esc(p.diff_propose)}</pre>` : ''}
            ${p.impact ? `<div class="cc-champ"><dt>Impact</dt><dd>${esc(p.impact)}</dd></div>` : ''}
            ${p.tests_necessaires ? `<div class="cc-champ"><dt>Tests nécessaires</dt><dd>${esc(p.tests_necessaires)}</dd></div>` : ''}
            ${p.motif_decision ? `<div class="cc-champ"><dt>Décision</dt><dd>${esc(p.motif_decision)} — ${esc(p.decide_par_nom || '')}</dd></div>` : ''}
            ${p.statut === 'proposee' ? `
              <div style="display:flex;gap:8px;margin-top:10px">
                <button class="sa-bouton sa-bouton-principal sa-bouton-petit" data-id="${esc(p.id)}" data-d="acceptee">Accepter</button>
                <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-id="${esc(p.id)}" data-d="rejetee">Rejeter</button>
              </div>` : p.statut === 'acceptee' ? `
              <div style="display:flex;gap:8px;margin-top:10px">
                <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-id="${esc(p.id)}" data-d="appliquee">Marquer appliqué dans le dépôt</button>
              </div>` : ''}
          </div>`).join('') || ui.etatVide('Aucun correctif proposé',
            "Ouvrez un écart et demandez une proposition à l'IA.")}

        ${ui.pagination(d.pagination)}
        <div class="cc-source">${esc(d.rappel || '')}</div>`;

      ['statut', 'risque'].forEach((n) => {
        const el = document.getElementById(`cc-co-${n}`);
        if (el) el.addEventListener('change', () =>
          SA.naviguer('cc/correctifs', Object.assign({}, requete, { [n]: el.value, page: 1 })));
      });

      conteneur.querySelectorAll('[data-d]').forEach((b) => {
        b.addEventListener('click', async () => {
          const decision = b.getAttribute('data-d');
          let motif = null;
          if (decision === 'rejetee') {
            motif = window.prompt('Motif du rejet (obligatoire) :');
            if (!motif || !motif.trim()) return;
          }
          try {
            await SA.api(`/super-admin/control-center/correctifs/${b.getAttribute('data-id')}`, {
              method: 'PATCH', body: JSON.stringify({ statut: decision, motif })
            });
            SA.toast('Décision enregistrée.', 'succes');
            SA.rafraichirVue();
          } catch (err) { SA.toast(err.message, 'danger'); }
        });
      });
    }
  });

  /* ======================================================================
     5. RAPPORTS
     ====================================================================== */

  SA.enregistrerVue('cc/rapports', {
    titre: 'Rapports automatiques',
    sousTitre: 'Journaliers et hebdomadaires, conservés tels quels.',

    async rendu(conteneur, params) {
      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-type="journalier">Rapport du jour</button>
          <button class="sa-bouton sa-bouton-principal sa-bouton-petit" data-type="hebdomadaire">Rapport de la semaine</button>`;
      }

      conteneur.innerHTML = ui.squelette(6);
      const d = await SA.api(SA.url('/super-admin/control-center/rapports',
        params.type ? { type: params.type } : {}));

      conteneur.innerHTML = `
        ${(d.donnees || []).map((r) => {
          const s = r.scores || {};
          const c = r.contenu || {};
          return `
            <div class="sa-panneau" style="margin-bottom:14px">
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px">
                ${ui.badge(r.type, 'neutre')}
                <strong>${esc(fmt.dateHeure(r.genere_at))}</strong>
              </div>
              <div class="sa-grille-stats" style="margin-bottom:12px">
                ${ui.carteStat({ valeur: esc(s.global), etiquette: 'Global' })}
                ${ui.carteStat({ valeur: esc(s.sante), etiquette: 'Santé' })}
                ${ui.carteStat({ valeur: esc(s.securite), etiquette: 'Sécurité' })}
                ${ui.carteStat({ valeur: esc(s.performance), etiquette: 'Performance' })}
                ${ui.carteStat({ valeur: esc(s.donnees), etiquette: 'Données' })}
              </div>
              <dl>
                <div class="cc-champ"><dt>Nouvelles erreurs</dt><dd>${esc(fmt.nombre(c.nouvelles_erreurs))}</dd></div>
                <div class="cc-champ"><dt>Nouvelles écoles</dt><dd>${esc(fmt.nombre(c.nouvelles_ecoles))}</dd></div>
                <div class="cc-champ"><dt>Coût IA sur la période</dt><dd>${esc(c.cout_ia_usd)} USD</dd></div>
                <div class="cc-champ"><dt>API</dt><dd>${esc(fmt.nombre((c.api || {}).requetes))} requêtes ·
                  ${esc((c.api || {}).taux_erreur)} % d'erreur · p95 ${esc((c.api || {}).latence_p95_ms)} ms</dd></div>
              </dl>
              ${r.synthese_ia
                ? `<div class="sa-panneau" style="white-space:pre-wrap;line-height:1.65;font-size:.89rem;margin-top:10px">${esc(r.synthese_ia)}</div>`
                : `<div class="cc-encart-hypothese">Synthèse IA non disponible pour ce rapport. Les chiffres, eux, sont complets : ils ne dépendent pas de l'IA.</div>`}
            </div>`;
        }).join('') || ui.etatVide('Aucun rapport',
          "Générez le premier avec les boutons en haut à droite.")}
        ${ui.pagination(d.pagination)}`;

      document.querySelectorAll('[data-type]').forEach((b) => {
        b.addEventListener('click', async () => {
          const avant = b.textContent;
          b.disabled = true; b.textContent = 'Génération…';
          try {
            const r = await SA.api('/super-admin/control-center/ia/rapport', {
              method: 'POST', body: JSON.stringify({ type: b.getAttribute('data-type') })
            });
            SA.toast(r.synthese_ia_disponible
              ? 'Rapport généré avec sa synthèse.'
              : 'Rapport généré (synthèse IA indisponible).', 'succes');
            SA.rafraichirVue();
          } catch (err) {
            SA.toast(err.message, 'danger');
            b.disabled = false; b.textContent = avant;
          }
        });
      });
    }
  });

  /* ======================================================================
     6. COÛTS DE L'IA
     ====================================================================== */

  SA.enregistrerVue('cc/couts-ia', {
    titre: "Coût de l'IA",
    sousTitre: 'Appels, jetons, modèles, budget — estimés, et le mot est important.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(6);
      const d = await SA.api('/super-admin/control-center/ia/couts');
      const m = d.mois_courant || {};

      conteneur.innerHTML = `
        <div class="sa-grille-stats" style="margin-bottom:20px">
          ${ui.carteStat({ valeur: `${esc(m.cout_usd)} $`, etiquette: 'Coût du mois en cours',
                           ton: m.depasse ? 'danger' : 'succes' })}
          ${ui.carteStat({ valeur: m.budget_usd === null ? '—' : `${esc(m.budget_usd)} $`,
                           etiquette: 'Budget mensuel' })}
          ${ui.carteStat({ valeur: m.part_pourcent === null ? '—' : fmt.pourcent(m.part_pourcent),
                           etiquette: 'Part consommée',
                           ton: m.part_pourcent > (m.seuil_alerte_pct || 80) ? 'attention' : 'succes' })}
        </div>

        <section class="sa-section">
          <h2 class="sa-section-titre">Par fonctionnalité — 30 derniers jours</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'fonctionnalite', titre: 'Fonctionnalité' },
              { cle: 'modele', titre: 'Modèle', classe: 'sa-mono' },
              { cle: 'appels', titre: 'Appels', classe: 'sa-num', rendu: (l) => fmt.nombre(l.appels) },
              { cle: 'cout_usd', titre: 'Coût', classe: 'sa-num', rendu: (l) => `${esc(l.cout_usd)} $` },
              { cle: 'duree_moyenne_ms', titre: 'Durée moy.', classe: 'sa-num', rendu: (l) => esc(fmt.duree(l.duree_moyenne_ms)) },
              { cle: 'echecs', titre: 'Échecs', classe: 'sa-num', rendu: (l) =>
                Number(l.echecs) ? `<span style="color:var(--rouge)">${esc(l.echecs)}</span>` : '0' }
            ], lignes: d.par_fonctionnalite_30j || [], vide: 'Aucun appel IA sur la période'
          })}
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Par mois</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'mois', titre: 'Mois' },
              { cle: 'appels', titre: 'Appels', classe: 'sa-num', rendu: (l) => fmt.nombre(l.appels) },
              { cle: 'jetons_entree', titre: 'Jetons entrée', classe: 'sa-num', rendu: (l) => fmt.nombre(l.jetons_entree) },
              { cle: 'jetons_sortie', titre: 'Jetons sortie', classe: 'sa-num', rendu: (l) => fmt.nombre(l.jetons_sortie) },
              { cle: 'cout_usd', titre: 'Coût', classe: 'sa-num', rendu: (l) => `${esc(l.cout_usd)} $` }
            ], lignes: d.par_mois || [], vide: 'Aucune donnée'
          })}
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Quotas des écoles</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'mois', titre: 'Mois' },
              { cle: 'appels', titre: 'Appels', classe: 'sa-num', rendu: (l) => fmt.nombre(l.appels) },
              { cle: 'ecoles', titre: 'Écoles', classe: 'sa-num', rendu: (l) => fmt.nombre(l.ecoles) }
            ], lignes: d.quotas_ecoles || [], vide: 'Aucune donnée'
          })}
          <div class="cc-source">
            Ce tableau vient de <span class="sa-mono">ia_utilisations</span>, le compteur
            de quota commercial par école. Il ne mesure ni les jetons ni le coût — d'où
            la table séparée utilisée ci-dessus.
          </div>
        </section>

        <div class="cc-encart-hypothese">${esc(d.avertissement || '')}</div>`;
    }
  });
})();
