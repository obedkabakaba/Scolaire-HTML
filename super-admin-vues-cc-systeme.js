/* ==========================================================================
   ARDOISE CONTROL CENTER — SYSTÈME
   --------------------------------------------------------------------------
   Drapeaux de fonctionnalités, maintenance, décisions, base de connaissance,
   dépendances, inspecteur de base, infrastructure.

   LES ÉCRANS DANGEREUX SONT ICI
   -----------------------------
   Deux actions de ce fichier agissent sur la production : couper le service,
   et ouvrir une fonctionnalité à toutes les écoles. Toutes deux passent par
   une confirmation de mot de passe côté serveur — l'interface se contente de
   la demander au bon moment, elle ne l'invente pas et ne peut pas la
   contourner.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui } = SA;

  /**
   * Demande la ré-authentification et rejoue l'action.
   *
   * Le serveur répond 403 avec le code `REAUTHENTIFICATION_REQUISE` : c'est LUI
   * qui décide, pas l'interface. On se contente de présenter la boîte au bon
   * moment plutôt que d'afficher un refus sans issue.
   */
  async function avecReauthentification(action) {
    try {
      return await action();
    } catch (err) {
      if (!err || err.code !== 'REAUTHENTIFICATION_REQUISE') throw err;

      const motDePasse = await demanderMotDePasse();
      if (!motDePasse) return null;

      await SA.api('/super-admin/control-center/reauthentifier', {
        method: 'POST', body: JSON.stringify({ mot_de_passe: motDePasse })
      });
      return action();
    }
  }

  function demanderMotDePasse() {
    return new Promise((resoudre) => {
      const modale = SA.modale({
        titre: 'Confirmez votre mot de passe',
        sousTitre: "Cette action agit sur la production. Un onglet resté ouvert ne suffit pas.",
        contenu: `
          <p class="sa-texte" style="margin-top:0">
            La confirmation ouvre une fenêtre de quelques minutes pendant laquelle les
            actions critiques sont autorisées. Chaque usage de cette fenêtre est tracé.
          </p>
          <label class="sa-connexion-champ"><span>Mot de passe</span>
            <input type="password" class="sa-champ" id="cc-reauth-mdp" autocomplete="current-password"></label>`,
        actions: `
          <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
          <button class="sa-bouton sa-bouton-principal" data-role="ok">Confirmer</button>`
      });

      const champ = modale.querySelector('#cc-reauth-mdp');
      const valider = () => {
        const v = champ.value;
        modale.fermer();
        resoudre(v || null);
      };
      modale.querySelector('[data-role="ok"]').addEventListener('click', valider);
      modale.querySelector('[data-role="annuler"]').addEventListener('click', () => {
        modale.fermer(); resoudre(null);
      });
      champ.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') valider(); });
      setTimeout(() => champ.focus(), 30);
    });
  }

  /* ======================================================================
     1. DRAPEAUX DE FONCTIONNALITÉS
     ====================================================================== */

  SA.enregistrerVue('cc/drapeaux', {
    titre: 'Drapeaux de fonctionnalités',
    sousTitre: 'Ouvrir une nouveauté progressivement, et refermer en un clic.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(5, 70);
      const d = await SA.api('/super-admin/control-center/drapeaux');

      conteneur.innerHTML = `
        ${(d.drapeaux || []).map((f) => {
          const p = f.portee || {};
          return `
            <div class="sa-panneau" style="margin-bottom:14px">
              <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:8px">
                <strong style="font-size:1rem">${esc(f.libelle)}</strong>
                ${ui.badge(f.mode, f.mode === 'tous' ? 'succes' : f.mode === 'off' ? 'neutre' : 'info')}
                <span class="sa-annexe sa-mono">${esc(f.cle)}</span>
              </div>
              ${f.description ? `<p class="sa-annexe" style="margin:0 0 10px;line-height:1.55">${esc(f.description)}</p>` : ''}

              <div class="cc-champ">
                <dt>Portée réelle</dt>
                <dd>
                  <strong>${esc(fmt.nombre(p.ecoles_concernees))}</strong> école(s)
                  sur ${esc(fmt.nombre(p.ecoles_actives))} actives
                  ${p.part_reelle !== undefined ? ` — ${esc(fmt.pourcent(p.part_reelle))}` : ''}
                  ${f.mode === 'pourcentage' ? `<span class="sa-annexe"> (consigne : ${esc(f.pourcentage)} %)</span>` : ''}
                </dd>
              </div>

              <div class="cc-filtres" style="margin:10px 0 0">
                <label class="cc-filtre"><span>Mode</span>
                  <select class="sa-champ" data-mode="${esc(f.cle)}">
                    ${(d.modes || []).map((m) =>
                      `<option value="${esc(m)}"${f.mode === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}
                  </select></label>
                <label class="cc-filtre"><span>Pourcentage</span>
                  <input type="number" min="0" max="100" class="sa-champ" style="width:90px"
                         data-pct="${esc(f.cle)}" value="${esc(f.pourcentage)}"></label>
                <button class="sa-bouton sa-bouton-principal sa-bouton-petit" data-appliquer="${esc(f.cle)}">Appliquer</button>
                ${f.mode_precedent ? `
                  <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-retour="${esc(f.cle)}">
                    Revenir à « ${esc(f.mode_precedent)} »</button>` : ''}
              </div>
            </div>`;
        }).join('')}

        <section class="sa-section">
          <h2 class="sa-section-titre">Comment les modes se comportent</h2>
          <dl>
            ${Object.entries(d.explication_modes || {}).map(([m, t]) =>
              `<div class="cc-champ"><dt class="sa-mono">${esc(m)}</dt><dd>${esc(t)}</dd></div>`).join('')}
          </dl>
          <div class="cc-source">${esc(d.propagation || '')}</div>
        </section>

        ${(d.historique || []).length ? `
          <section class="sa-section">
            <h2 class="sa-section-titre">Historique des bascules</h2>
            ${ui.tableau({
              colonnes: [
                { cle: 'cle', titre: 'Drapeau', classe: 'sa-mono' },
                { cle: 'avant', titre: 'Avant', rendu: (l) => esc((l.avant || {}).mode || '—') },
                { cle: 'apres', titre: 'Après', rendu: (l) => esc((l.apres || {}).mode || '—') },
                { cle: 'motif', titre: 'Motif' },
                { cle: 'modifie_par_nom', titre: 'Par' },
                { cle: 'created_at', titre: 'Quand', rendu: (l) => esc(fmt.dateHeure(l.created_at)) }
              ], lignes: d.historique, vide: ''
            })}
          </section>` : ''}`;

      conteneur.querySelectorAll('[data-appliquer]').forEach((b) => {
        b.addEventListener('click', async () => {
          const cle = b.getAttribute('data-appliquer');
          const mode = conteneur.querySelector(`[data-mode="${cle}"]`).value;
          const pct = conteneur.querySelector(`[data-pct="${cle}"]`).value;

          if (mode === 'tous') {
            const ok = await SA.confirmer({
              titre: 'Ouvrir à toutes les écoles',
              message: "Cette fonctionnalité sera active pour TOUTES les écoles "
                     + "immédiatement. Une confirmation de mot de passe sera demandée.",
              libelleValider: 'Continuer', danger: true
            });
            if (!ok) return;
          }

          try {
            await avecReauthentification(() =>
              SA.api(`/super-admin/control-center/drapeaux/${encodeURIComponent(cle)}`, {
                method: 'PATCH',
                body: JSON.stringify({ mode, pourcentage: Number(pct) })
              }));
            SA.toast('Drapeau mis à jour.', 'succes');
            SA.rafraichirVue();
          } catch (err) { SA.toast(err.message, 'danger'); }
        });
      });

      conteneur.querySelectorAll('[data-retour]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            await SA.api(`/super-admin/control-center/drapeaux/${encodeURIComponent(b.getAttribute('data-retour'))}/retour-arriere`,
              { method: 'POST' });
            SA.toast('État précédent restauré.', 'succes');
            SA.rafraichirVue();
          } catch (err) { SA.toast(err.message, 'danger'); }
        });
      });
    }
  });

  /* ======================================================================
     2. MAINTENANCE
     ====================================================================== */

  SA.enregistrerVue('cc/maintenance', {
    titre: 'Mode maintenance',
    sousTitre: "Couper proprement, plutôt que laisser les écoles rencontrer des erreurs.",

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(4, 60);
      const d = await SA.api('/super-admin/control-center/maintenance');
      const a = d.active;

      conteneur.innerHTML = `
        ${a ? `
          <div class="cc-bandeau-maintenance">
            <span><strong>Maintenance active depuis ${esc(fmt.relatif(a.debut))}.</strong>
              Portée : ${esc(a.portee)}${a.portee === 'modules' ? ` (${(a.modules || []).map(esc).join(', ')})` : ''}.</span>
            <button class="sa-bouton sa-bouton-petit" id="cc-mt-lever">Lever la maintenance</button>
          </div>
          <section class="sa-panneau">
            <dl>
              <div class="cc-champ"><dt>Message affiché</dt><dd>${esc(a.message)}</dd></div>
              <div class="cc-champ"><dt>Activée par</dt><dd>${esc(a.active_par_nom || '—')}</dd></div>
              <div class="cc-champ"><dt>Fin prévue</dt><dd>${a.fin_prevue ? esc(fmt.dateHeure(a.fin_prevue)) : 'non précisée'}</dd></div>
              <div class="cc-champ"><dt>Écoles exemptées</dt><dd>${(a.ecoles_exemptees || []).length || 'aucune'}</dd></div>
            </dl>
          </section>`
        : `
          <section class="sa-panneau">
            <p class="sa-texte" style="margin-top:0">
              La plateforme est ouverte. Activer la maintenance renverra un message
              lisible aux écoles à la place des erreurs, pendant une migration ou une
              intervention.
            </p>
            <label class="sa-connexion-champ"><span>Message affiché aux écoles</span>
              <textarea class="sa-champ" id="cc-mt-message" rows="2">Ardoise est en maintenance. Merci de réessayer dans quelques minutes.</textarea></label>
            <label class="sa-connexion-champ"><span>Portée</span>
              <select class="sa-champ" id="cc-mt-portee">
                <option value="globale">Globale — toute la plateforme</option>
                <option value="modules">Modules précis seulement</option>
              </select></label>
            <label class="sa-connexion-champ"><span>Modules (si portée « modules ») — préfixes séparés par des virgules</span>
              <input class="sa-champ" id="cc-mt-modules" placeholder="/notes, /bulletins"></label>
            <button class="sa-bouton sa-bouton-danger" id="cc-mt-activer" style="margin-top:10px">
              Activer la maintenance</button>
          </section>`}

        <section class="sa-section">
          <h2 class="sa-section-titre">Exemptions permanentes</h2>
          <p class="sa-texte">
            Ces chemins restent accessibles quoi qu'il arrive :
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:7px">
            ${(d.exemptions_permanentes || []).map((x) => `<span class="sa-mono">${esc(x)}</span>`).join(' · ')}
          </div>
          <div class="cc-encart-fait">${esc(d.note || '')}</div>
        </section>

        ${(d.historique || []).length ? `
          <section class="sa-section">
            <h2 class="sa-section-titre">Historique</h2>
            ${ui.tableau({
              colonnes: [
                { cle: 'debut', titre: 'Début', rendu: (l) => esc(fmt.dateHeure(l.debut)) },
                { cle: 'portee', titre: 'Portée' },
                { cle: 'modules', titre: 'Modules', rendu: (l) => (l.modules || []).join(', ') || '—' },
                { cle: 'message', titre: 'Message' }
              ], lignes: d.historique, vide: ''
            })}
          </section>` : ''}`;

      const btnAct = document.getElementById('cc-mt-activer');
      if (btnAct) {
        btnAct.addEventListener('click', async () => {
          const ok = await SA.confirmer({
            titre: 'Activer la maintenance',
            message: "Les écoles ne pourront plus utiliser Ardoise. Vous, Super Admin, "
                   + "gardez l'accès complet — sans quoi vous ne pourriez pas lever la "
                   + "maintenance. Une confirmation de mot de passe va être demandée.",
            libelleValider: 'Activer', danger: true
          });
          if (!ok) return;

          const modules = (document.getElementById('cc-mt-modules').value || '')
            .split(',').map((s) => s.trim()).filter(Boolean);

          try {
            const r = await avecReauthentification(() =>
              SA.api('/super-admin/control-center/maintenance', {
                method: 'POST',
                body: JSON.stringify({
                  actif: true,
                  portee: document.getElementById('cc-mt-portee').value,
                  modules,
                  message: document.getElementById('cc-mt-message').value
                })
              }));
            if (r) { SA.toast('Maintenance activée.', 'attention'); SA.rafraichirVue(); }
          } catch (err) { SA.toast(err.message, 'danger'); }
        });
      }

      const btnLev = document.getElementById('cc-mt-lever');
      if (btnLev) {
        btnLev.addEventListener('click', async () => {
          try {
            const r = await avecReauthentification(() =>
              SA.api('/super-admin/control-center/maintenance', {
                method: 'POST', body: JSON.stringify({ actif: false })
              }));
            if (r) { SA.toast('Maintenance levée.', 'succes'); SA.rafraichirVue(); }
          } catch (err) { SA.toast(err.message, 'danger'); }
        });
      }
    }
  });

  /* ======================================================================
     3. JOURNAL DES DÉCISIONS
     ====================================================================== */

  SA.enregistrerVue('cc/decisions', {
    titre: 'Journal des décisions',
    sousTitre: "Pourquoi telle règle existe — la question qu'on se pose six mois plus tard.",

    async rendu(conteneur, params) {
      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `<button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="cc-dec-nouvelle">Consigner une décision</button>`;
      }

      conteneur.innerHTML = ui.squelette(6);
      const d = await SA.api(SA.url('/super-admin/control-center/decisions', { page: params.page || 1 }));

      conteneur.innerHTML = `
        ${(d.donnees || []).map((x) => `
          <div class="sa-panneau" style="margin-bottom:14px">
            <div style="display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-bottom:8px">
              <span class="cc-regle">${esc(x.code)}</span>
              <strong>${esc(x.titre)}</strong>
              ${ui.badge(x.domaine, 'neutre')}
              <span class="sa-annexe">${esc(fmt.date(x.date_decision))}</span>
            </div>
            <dl>
              <div class="cc-champ"><dt>Décision</dt><dd>${esc(x.decision)}</dd></div>
              <div class="cc-champ"><dt>Raison</dt><dd>${esc(x.raison)}</dd></div>
              ${x.impact ? `<div class="cc-champ"><dt>Impact</dt><dd>${esc(x.impact)}</dd></div>` : ''}
              ${x.alternatives ? `<div class="cc-champ"><dt>Alternatives écartées</dt><dd>${esc(x.alternatives)}</dd></div>` : ''}
              ${(x.regles_liees || []).length ? `<div class="cc-champ"><dt>Règles liées</dt>
                <dd>${(x.regles_liees || []).map((c) => `<a class="cc-regle" href="#/cc/regles/${esc(c)}">${esc(c)}</a>`).join(' ')}</dd></div>` : ''}
            </dl>
          </div>`).join('') || ui.etatVide('Aucune décision consignée',
            "Consignez-en une dès qu'une règle change : c'est ce qui évite de la remettre "
            + "en cause faute de se rappeler pourquoi elle existe.")}
        ${ui.pagination(d.pagination)}
        <div class="cc-source">${esc(d.raison_d_etre || '')}</div>`;

      const btn = document.getElementById('cc-dec-nouvelle');
      if (btn) {
        btn.addEventListener('click', () => {
          const modale = SA.modale({
            titre: 'Consigner une décision',
            large: true,
            contenu: `
              <label class="sa-connexion-champ"><span>Titre</span><input class="sa-champ" id="cc-nd-titre"></label>
              <label class="sa-connexion-champ"><span>Décision prise</span><textarea class="sa-champ" id="cc-nd-dec" rows="2"></textarea></label>
              <label class="sa-connexion-champ"><span>Raison — c'est le champ qu'on relit</span><textarea class="sa-champ" id="cc-nd-raison" rows="3"></textarea></label>
              <label class="sa-connexion-champ"><span>Impact</span><textarea class="sa-champ" id="cc-nd-impact" rows="2"></textarea></label>
              <label class="sa-connexion-champ"><span>Alternatives écartées</span><textarea class="sa-champ" id="cc-nd-alt" rows="2"></textarea></label>
              <label class="sa-connexion-champ"><span>Domaine</span><input class="sa-champ" id="cc-nd-domaine" value="technique"></label>
              <label class="sa-connexion-champ"><span>Règles liées (codes séparés par des virgules)</span><input class="sa-champ" id="cc-nd-regles"></label>`,
            actions: `<button class="sa-bouton sa-bouton-principal" data-role="ok">Consigner</button>`
          });
          modale.querySelector('[data-role="ok"]').addEventListener('click', async () => {
            try {
              await SA.api('/super-admin/control-center/decisions', {
                method: 'POST',
                body: JSON.stringify({
                  titre: document.getElementById('cc-nd-titre').value,
                  decision: document.getElementById('cc-nd-dec').value,
                  raison: document.getElementById('cc-nd-raison').value,
                  impact: document.getElementById('cc-nd-impact').value,
                  alternatives: document.getElementById('cc-nd-alt').value,
                  domaine: document.getElementById('cc-nd-domaine').value,
                  regles_liees: (document.getElementById('cc-nd-regles').value || '')
                    .split(',').map((s) => s.trim()).filter(Boolean)
                })
              });
              modale.fermer();
              SA.toast('Décision consignée.', 'succes');
              SA.rafraichirVue();
            } catch (err) { SA.toast(err.message, 'danger'); }
          });
        });
      }
    }
  });

  /* ======================================================================
     4. BASE DE CONNAISSANCE
     ====================================================================== */

  SA.enregistrerVue('cc/connaissance', {
    titre: 'Base de connaissance',
    sousTitre: "Ce que l'IA lit avant de répondre. Sans elle, elle invente du plausible.",

    async rendu(conteneur, params) {
      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `<button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="cc-kb-nouvelle">Ajouter une fiche</button>`;
      }

      conteneur.innerHTML = ui.squelette(6);
      const d = await SA.api(SA.url('/super-admin/control-center/connaissance',
        Object.assign({}, params.q ? { q: params.q } : {}, params.categorie ? { categorie: params.categorie } : {})));

      conteneur.innerHTML = `
        <div class="cc-filtres">
          <label class="cc-filtre cc-filtre-large"><span>Recherche</span>
            <input class="sa-champ" id="cc-kb-q" value="${esc(params.q || '')}"></label>
          <label class="cc-filtre"><span>Catégorie</span>
            <select class="sa-champ" id="cc-kb-cat">
              <option value="">Toutes</option>
              ${(d.categories || []).map((c) =>
                `<option value="${esc(c)}"${params.categorie === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
            </select></label>
        </div>

        ${d.etat ? `<div class="cc-encart-hypothese">${esc(d.etat)}</div>` : ''}

        ${(d.fiches || []).map((f) => `
          <div class="sa-panneau" style="margin-bottom:12px">
            <div style="display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-bottom:8px">
              <strong>${esc(f.titre)}</strong>
              ${ui.badge(f.categorie, 'neutre')}
              <span class="sa-annexe sa-mono">${esc(f.cle)}</span>
              <span class="sa-annexe">v${esc(f.version)} · ${esc(fmt.relatif(f.updated_at))}</span>
            </div>
            <div style="white-space:pre-wrap;line-height:1.6;font-size:.88rem">${esc(f.contenu)}</div>
            ${(f.mots_cles || []).length ? `<div style="margin-top:8px">${(f.mots_cles || []).map((m) => ui.badge(m, 'neutre')).join(' ')}</div>` : ''}
            <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" style="margin-top:9px"
                    data-editer="${esc(f.cle)}">Modifier</button>
          </div>`).join('') || ''}

        <div class="cc-source">${esc(d.raison_d_etre || '')}</div>`;

      const q = document.getElementById('cc-kb-q');
      if (q) q.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') SA.naviguer('cc/connaissance', { q: q.value.trim() });
      });
      const cat = document.getElementById('cc-kb-cat');
      if (cat) cat.addEventListener('change', () =>
        SA.naviguer('cc/connaissance', cat.value ? { categorie: cat.value } : {}));

      function editeur(fiche) {
        const modale = SA.modale({
          titre: fiche ? 'Modifier la fiche' : 'Ajouter une fiche',
          sousTitre: "Écrivez ce que fait VRAIMENT Ardoise : c'est ce texte que l'IA citera.",
          large: true,
          contenu: `
            <label class="sa-connexion-champ"><span>Clé (identifiant stable)</span>
              <input class="sa-champ" id="cc-kb-cle" value="${esc(fiche ? fiche.cle : '')}"
                     ${fiche ? 'readonly' : ''} placeholder="module.bulletins"></label>
            <label class="sa-connexion-champ"><span>Catégorie</span>
              <select class="sa-champ" id="cc-kb-fcat">
                ${(d.categories || []).map((c) =>
                  `<option value="${esc(c)}"${fiche && fiche.categorie === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
              </select></label>
            <label class="sa-connexion-champ"><span>Titre</span>
              <input class="sa-champ" id="cc-kb-titre" value="${esc(fiche ? fiche.titre : '')}"></label>
            <label class="sa-connexion-champ"><span>Contenu</span>
              <textarea class="sa-champ" id="cc-kb-contenu" rows="10">${esc(fiche ? fiche.contenu : '')}</textarea></label>
            <label class="sa-connexion-champ"><span>Mots-clés (séparés par des virgules)</span>
              <input class="sa-champ" id="cc-kb-mots" value="${esc(fiche ? (fiche.mots_cles || []).join(', ') : '')}"></label>`,
          actions: `<button class="sa-bouton sa-bouton-principal" data-role="ok">Enregistrer</button>`
        });
        modale.querySelector('[data-role="ok"]').addEventListener('click', async () => {
          const cle = document.getElementById('cc-kb-cle').value.trim();
          if (!cle) { SA.toast('La clé est obligatoire.', 'danger'); return; }
          try {
            await SA.api(`/super-admin/control-center/connaissance/${encodeURIComponent(cle)}`, {
              method: 'PUT',
              body: JSON.stringify({
                categorie: document.getElementById('cc-kb-fcat').value,
                titre: document.getElementById('cc-kb-titre').value,
                contenu: document.getElementById('cc-kb-contenu').value,
                mots_cles: (document.getElementById('cc-kb-mots').value || '')
                  .split(',').map((s) => s.trim()).filter(Boolean)
              })
            });
            modale.fermer();
            SA.toast('Fiche enregistrée.', 'succes');
            SA.rafraichirVue();
          } catch (err) { SA.toast(err.message, 'danger'); }
        });
      }

      const btnN = document.getElementById('cc-kb-nouvelle');
      if (btnN) btnN.addEventListener('click', () => editeur(null));
      conteneur.querySelectorAll('[data-editer]').forEach((b) => {
        b.addEventListener('click', () =>
          editeur((d.fiches || []).find((f) => f.cle === b.getAttribute('data-editer'))));
      });
    }
  });

  /* ======================================================================
     5. DÉPENDANCES
     ====================================================================== */

  SA.enregistrerVue('cc/dependances', {
    titre: 'Dépendances et versions',
    sousTitre: 'Ce qui est déclaré, ce qui est installé, ce qui ne sert à rien.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(6);
      const d = await SA.api('/super-admin/control-center/dependances');
      const a = d.application || {};
      const r = d.resume || {};
      const v = d.analyse_vulnerabilites || {};

      conteneur.innerHTML = `
        <div class="sa-grille-stats" style="margin-bottom:20px">
          ${ui.carteStat({ valeur: fmt.nombre(r.total), etiquette: 'Dépendances' })}
          ${ui.carteStat({ valeur: fmt.nombre(r.epinglees), etiquette: 'Versions épinglées',
                           detail: 'aucun correctif automatique' })}
          ${ui.carteStat({ valeur: fmt.nombre(r.potentiellement_inutilisees),
                           etiquette: 'Potentiellement inutilisées',
                           ton: r.potentiellement_inutilisees ? 'attention' : 'succes' })}
          ${ui.carteStat({ valeur: esc(a.node_execution), etiquette: "Node à l'exécution" })}
        </div>

        <div class="cc-encart-hypothese">
          <strong>Aucune analyse de vulnérabilités n'a été faite.</strong><br>
          ${esc(v.pourquoi || '')}<br><br>
          <strong>Comment l'obtenir :</strong> ${esc(v.comment_faire || '')}
        </div>

        <section class="sa-section">
          <h2 class="sa-section-titre">Paquets</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'nom', titre: 'Paquet', classe: 'sa-mono' },
              { cle: 'version_declaree', titre: 'Déclarée', classe: 'sa-mono' },
              { cle: 'version_installee', titre: 'Installée', classe: 'sa-mono',
                rendu: (l) => l.version_installee ? esc(l.version_installee) : '<span class="sa-muet">non installée ici</span>' },
              { cle: 'epinglee', titre: 'Épinglée', rendu: (l) => l.epinglee
                ? ui.badge('oui', 'attention') : '—' },
              { cle: 'utilise_dans_le_code', titre: 'Utilisée', rendu: (l) => l.utilise_dans_le_code
                ? ui.badge('oui', 'succes') : ui.badge('non trouvée', 'attention') }
            ], lignes: d.dependances || [], vide: ''
          })}
          <div class="cc-source">${esc(d.note_inutilisees || '')}</div>
        </section>`;
    }
  });

  /* ======================================================================
     6. INSPECTEUR DE BASE
     ====================================================================== */

  SA.enregistrerVue('cc/base', {
    titre: 'Inspecteur de base de données',
    sousTitre: 'Lecture seule. Aucun éditeur SQL n\'est exposé par cette plateforme.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(8);
      const d = await SA.api('/super-admin/control-center/base');

      conteneur.innerHTML = `
        <div class="sa-grille-stats" style="margin-bottom:20px">
          ${ui.carteStat({ valeur: esc((d.base || {}).lisible || '—'), etiquette: 'Taille de la base' })}
          ${ui.carteStat({ valeur: fmt.nombre((d.tables || []).length), etiquette: 'Tables' })}
          ${ui.carteStat({ valeur: fmt.nombre((d.tables_cloisonnees_sans_rls || []).length),
                           etiquette: 'Tables sans RLS',
                           ton: (d.tables_cloisonnees_sans_rls || []).length ? 'danger' : 'succes' })}
          ${ui.carteStat({ valeur: fmt.nombre((d.pool || {}).total), etiquette: 'Connexions du pool',
                           detail: `${esc((d.pool || {}).libres)} libres` })}
        </div>

        ${(d.alertes_schema || []).map((a) => `
          <div class="${a.niveau === 'critique' ? 'cc-encart-danger' : 'cc-encart-hypothese'}">
            ${esc(a.message)} ${a.regle ? `<a class="cc-regle" href="#/cc/regles/${esc(a.regle)}">${esc(a.regle)}</a>` : ''}
          </div>`).join('')}

        <section class="sa-section">
          <h2 class="sa-section-titre">Tables</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'table_nom', titre: 'Table', classe: 'sa-mono' },
              { cle: 'taille', titre: 'Taille', classe: 'sa-num' },
              { cle: 'lignes_vivantes', titre: 'Lignes', classe: 'sa-num', rendu: (l) => fmt.nombre(l.lignes_vivantes) },
              { cle: 'taux_lignes_mortes', titre: 'Lignes mortes', classe: 'sa-num', rendu: (l) =>
                l.taux_lignes_mortes > 20 ? `<span style="color:var(--rouge)">${esc(l.taux_lignes_mortes)} %</span>`
                                          : `${esc(l.taux_lignes_mortes)} %` },
              { cle: 'rls_active', titre: 'RLS', rendu: (l) => l.rls_active
                ? ui.badge('active', 'succes') : ui.badge('inactive', 'neutre') },
              { cle: 'policies', titre: 'Policies', classe: 'sa-num', rendu: (l) => fmt.nombre(l.policies) },
              { cle: 'balayages_sequentiels', titre: 'Seq scans', classe: 'sa-num', rendu: (l) => fmt.nombre(l.balayages_sequentiels) },
              { cle: 'balayages_index', titre: 'Index scans', classe: 'sa-num', rendu: (l) => fmt.nombre(l.balayages_index) }
            ], lignes: d.tables || [], vide: 'Catalogue non lisible avec ce rôle'
          })}
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Index peu utilisés</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'table_nom', titre: 'Table', classe: 'sa-mono' },
              { cle: 'index_nom', titre: 'Index', classe: 'sa-mono' },
              { cle: 'balayages', titre: 'Balayages', classe: 'sa-num', rendu: (l) => fmt.nombre(l.balayages) },
              { cle: 'taille', titre: 'Taille', classe: 'sa-num' }
            ], lignes: d.index_peu_utilises || [], vide: 'Aucun'
          })}
        </section>

        <div class="cc-encart-fait">${esc(d.garde_fou || '')}</div>`;
    }
  });

  /* ======================================================================
     7. INFRASTRUCTURE ET COÛTS
     ====================================================================== */

  SA.enregistrerVue('cc/infrastructure', {
    titre: 'Infrastructure et coûts',
    sousTitre: 'Services externes, variables configurées, coût par école.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(6);
      const d = await SA.api('/super-admin/control-center/infrastructure');
      const c = d.couts || {};

      conteneur.innerHTML = `
        <div class="sa-grille-stats" style="margin-bottom:20px">
          ${ui.carteStat({ valeur: `${esc(c.total_estime_mensuel)} $`, etiquette: 'Coût mensuel estimé' })}
          ${ui.carteStat({ valeur: `${esc(c.services_declares_mensuel)} $`, etiquette: 'Services déclarés' })}
          ${ui.carteStat({ valeur: `${esc(c.ia_mois_courant)} $`, etiquette: 'IA ce mois-ci' })}
          ${ui.carteStat({ valeur: c.par_ecole === null ? '—' : `${esc(c.par_ecole)} $`, etiquette: 'Coût par école' })}
          ${ui.carteStat({ valeur: c.par_utilisateur === null ? '—' : `${esc(c.par_utilisateur)} $`,
                           etiquette: 'Coût par utilisateur' })}
        </div>

        <section class="sa-section">
          <h2 class="sa-section-titre">Variables d'environnement</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'service', titre: 'Service' },
              { cle: 'variable', titre: 'Variable', classe: 'sa-mono' },
              { cle: 'defini', titre: 'État', rendu: (l) => l.defini
                ? ui.badge('configurée', 'succes') : ui.badge('absente', 'danger') },
              { cle: 'apercu', titre: 'Aperçu', classe: 'sa-mono',
                rendu: (l) => l.apercu ? esc(l.apercu) : '—' }
            ], lignes: d.variables_environnement || [], vide: ''
          })}
          <div class="cc-encart-fait">${esc(d.note_secrets || '')}</div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Services déclarés</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'nom', titre: 'Service' },
              { cle: 'cout_mensuel', titre: 'Coût mensuel', classe: 'sa-num',
                rendu: (l) => l.cout_mensuel ? `${esc(l.cout_mensuel)} ${esc(l.devise || '')}` : '—' },
              { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) }
            ], lignes: d.services_declares || [],
            vide: "Aucun service déclaré — renseignez-les dans « Services & coûts »"
          })}
        </section>

        <div class="cc-encart-hypothese">${esc(d.limites_de_la_mesure || '')}</div>`;
    }
  });
})();
