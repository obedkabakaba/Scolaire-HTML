/* ==========================================================================
   ARDOISE CONTROL CENTER — INTELLIGENCE ARTIFICIELLE
   --------------------------------------------------------------------------
   Conseil stratégique et rapports. Le Copilote, la cause racine, la liste des
   correctifs et les coûts ont rejoint les écrans qui faisaient la même chose
   (redirections ci-dessous).

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
     1. COPILOTE — fusionné dans l'Assistant IA (ia/studio)

     Le Copilote et l'Assistant IA répondaient tous deux aux questions sur
     Ardoise ; l'Assistant reçoit les mêmes outils de lecture que le Copilote
     (voir `utils/ia/studio-outils.utils.js`, FAMILLE_PAR_OUTIL), plus la
     connaissance, l'historique des conversations et la proposition de
     corrections. Deux portes pour la même question, c'était ne plus savoir
     laquelle ouvrir.
     ====================================================================== */

  SA.enregistrerRedirection('cc/copilote', 'ia/studio');

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
                     placeholder="ex. faut-il ouvrir l'espace Comptabilité dès Prime ?"></label>
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
     3. CAUSE RACINE — fusionnée dans l'Assistant IA (ia/studio)

     Elle rassemblait les erreurs, journaux, vérifications et incidents des
     dernières heures et demandait au modèle s'ils avaient une cause commune.
     L'Assistant lit ces mêmes sources par ses outils (getRecentErrors,
     getLogs, getSystemHealth, getIncidents) ; la question figure parmi ses
     suggestions.
     ====================================================================== */

  SA.enregistrerRedirection('cc/cause-racine', 'ia/studio');

  /* ======================================================================
     4. CORRECTIFS PROPOSÉS — repris par la fiche de chaque écart

     Un correctif est toujours rattaché à un écart, et la fiche de l'écart
     l'affichait déjà avec ses boutons Accepter / Rejeter ; elle porte
     désormais aussi « Marquer appliqué ». La liste séparée faisait doublon.
     ====================================================================== */

  SA.enregistrerRedirection('cc/correctifs', 'cc/constats');

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

  /* Ancien écran « Copilote et budgets » : il lisait `ia_consommation` et
     `ia_budgets`, comme « Coût de l'IA » (ia/couts), qui reprend aussi son
     tableau mensuel. */
  SA.enregistrerRedirection('cc/couts-ia', 'ia/couts');
})();
