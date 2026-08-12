/* ==========================================================================
   ARDOISE CONTROL CENTER — AUDIT
   --------------------------------------------------------------------------
   Règles métier, matrice des permissions, audits, constats.

   LA CHAÎNE QUE CES ÉCRANS RENDENT VISIBLE
   ----------------------------------------
       règle métier → matrice → code réel → écart → constat → décision

   Chaque maillon est consultable, et chaque constat remonte jusqu'à l'énoncé
   de la règle qui le fonde. C'est ce qui distingue « cette permission semble
   étrange » de « RULE-PAY-001 attend directeur et comptable, la route autorise
   aussi le secrétaire, ligne 31 de frais.routes.js ».
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui } = SA;

  function badgeConfiance(c) {
    return c === 'hypothese'
      ? '<span class="cc-confiance hypothese">hypothèse</span>'
      : '<span class="cc-confiance fait">fait</span>';
  }

  function badgeRegle(code) {
    return code ? `<a class="cc-regle" href="#/cc/regles/${esc(code)}">${esc(code)}</a>` : '';
  }

  function paginationSimple(zone, route, requete) {
    zone.querySelectorAll('.sa-bouton-page[data-page]').forEach((b) => {
      if (b.disabled) return;
      b.addEventListener('click', () =>
        SA.naviguer(route, Object.assign({}, requete, { page: b.getAttribute('data-page') })));
    });
  }

  /* ======================================================================
     1. RÈGLES MÉTIER — le registre
     ====================================================================== */

  SA.enregistrerVue('cc/regles', {
    titre: 'Règles métier',
    sousTitre: "La référence à laquelle le code est comparé. Sans elle, un audit n'est qu'une opinion.",

    async rendu(conteneur, params, segments) {
      if (segments && segments.length) return ficheRegle(conteneur, segments[0]);

      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="cc-r-nouvelle">Ajouter une règle</button>`;
      }

      conteneur.innerHTML = ui.squelette(8, 40);
      const d = await SA.api(SA.url('/super-admin/control-center/regles',
        params.domaine ? { domaine: params.domaine } : {}));

      const t = d.totaux || {};
      const parDomaine = {};
      for (const r of d.regles) (parDomaine[r.domaine] = parDomaine[r.domaine] || []).push(r);

      conteneur.innerHTML = `
        <div class="sa-grille-stats" style="margin-bottom:20px">
          ${ui.carteStat({ valeur: fmt.nombre(t.total), etiquette: 'Règles au registre' })}
          ${ui.carteStat({ valeur: fmt.nombre(t.verifiables_automatiquement),
                           etiquette: 'Vérifiables automatiquement',
                           detail: 'un auditeur sait les contrôler' })}
          ${ui.carteStat({ valeur: fmt.nombre(t.documentaires), etiquette: 'Documentaires',
                           detail: 'vérifiables par lecture ou par l\'IA' })}
          ${(t.par_criticite || []).filter((c) => c.criticite === 'critique').map((c) =>
            ui.carteStat({ valeur: fmt.nombre(c.nb), etiquette: 'Règles critiques', ton: 'danger' })).join('')}
        </div>

        <div class="cc-filtres">
          <label class="cc-filtre"><span>Domaine</span>
            <select class="sa-champ" id="cc-r-domaine">
              <option value="">Tous</option>
              ${(d.domaines || []).map((x) =>
                `<option value="${esc(x)}"${params.domaine === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}
            </select></label>
        </div>

        ${Object.entries(parDomaine).map(([domaine, regles]) => `
          <section class="sa-section">
            <h2 class="sa-section-titre">${esc(domaine)} <span class="sa-annexe">${regles.length} règle(s)</span></h2>
            ${ui.tableau({
              colonnes: [
                { cle: 'code', titre: 'Code', rendu: (l) => badgeRegle(l.code) },
                { cle: 'titre', titre: 'Règle' },
                { cle: 'criticite', titre: 'Criticité', rendu: (l) => ui.badge(l.criticite, SA.ui.tonStatut(l.criticite)) },
                { cle: 'verificateur', titre: 'Vérification', rendu: (l) => l.verificateur
                  ? ui.badge(l.verificateur, 'succes') : '<span class="sa-muet">documentaire</span>' },
                { cle: 'constats_ouverts', titre: 'Écarts ouverts', classe: 'sa-num', rendu: (l) =>
                  Number(l.constats_ouverts) ? `<strong style="color:var(--rouge)">${esc(l.constats_ouverts)}</strong>` : '0' },
                { cle: 'source', titre: 'Source', rendu: (l) => ui.badge(l.source === 'code' ? 'versionnée' : 'interface',
                  l.source === 'code' ? 'info' : 'neutre') }
              ],
              lignes: regles, cliquable: true, vide: ''
            })}
          </section>`).join('')}

        <div class="cc-source">${esc(d.note || '')}<br>Source : ${esc(d.source || '')}</div>`;

      const sel = document.getElementById('cc-r-domaine');
      if (sel) sel.addEventListener('change', () =>
        SA.naviguer('cc/regles', sel.value ? { domaine: sel.value } : {}));

      conteneur.querySelectorAll('tr').forEach((tr) => {
        const lien = tr.querySelector('.cc-regle');
        if (lien) tr.addEventListener('click', () => { location.hash = lien.getAttribute('href').slice(1); });
      });

      const btn = document.getElementById('cc-r-nouvelle');
      if (btn) btn.addEventListener('click', formulaireNouvelleRegle);
    }
  });

  async function ficheRegle(conteneur, code) {
    conteneur.innerHTML = ui.squelette(6);
    const d = await SA.api(`/super-admin/control-center/regles/${encodeURIComponent(code)}`);
    const r = d.regle;

    conteneur.innerHTML = `
      <section class="sa-panneau">
        <h3 class="sa-section-titre">
          <span class="cc-regle">${esc(r.code)}</span> ${esc(r.titre)}
        </h3>
        <p class="sa-texte" style="font-size:.95rem;line-height:1.7">${esc(r.enonce)}</p>
        ${r.justification ? `
          <div class="cc-encart-fait">
            <strong>Pourquoi cette règle existe</strong><br>${esc(r.justification)}
          </div>` : ''}
        <dl style="margin-top:14px">
          <div class="cc-champ"><dt>Domaine</dt><dd>${esc(r.domaine)}</dd></div>
          <div class="cc-champ"><dt>Criticité</dt><dd>${ui.badge(r.criticite, SA.ui.tonStatut(r.criticite))}</dd></div>
          <div class="cc-champ"><dt>Vérification</dt><dd>${r.verificateur
            ? `automatique — auditeur <span class="sa-mono">${esc(r.verificateur)}</span>`
            : "documentaire : vérifiable par lecture ou par l'IA, pas par un auditeur automatique"}</dd></div>
          <div class="cc-champ"><dt>Source</dt><dd>${r.source === 'code'
            ? 'registre versionné (<span class="sa-mono">utils/regles-metier.registry.js</span>) — modifiable en revue de code seulement'
            : 'ajoutée depuis cette interface'}</dd></div>
          <div class="cc-champ"><dt>Version</dt><dd>${esc(r.version || 1)}</dd></div>
        </dl>
      </section>

      <section class="sa-section">
        <h2 class="sa-section-titre">Implémentation trouvée dans le code</h2>
        ${(d.implementation || []).length ? (d.implementation || []).map((i) => `
          <div class="sa-panneau" style="margin-bottom:12px">
            <div class="sa-mono" style="font-weight:600;margin-bottom:8px">${esc(i.route)}</div>
            <div class="cc-comparaison">
              <div class="cc-comparaison-bloc attendu">
                <h4>Permission attendue</h4>
                ${(i.attendu || []).map((x) => ui.badge(x, 'succes')).join(' ') || '<span class="sa-muet">aucun rôle d\'école</span>'}
              </div>
              <div class="cc-comparaison-bloc trouve">
                <h4>Permission implémentée</h4>
                ${i.implemente === null
                  ? '<span style="color:var(--rouge)">aucune restriction de rôle</span>'
                  : (i.implemente || []).map((x) => ui.badge(x, (i.attendu || []).includes(x) ? 'succes' : 'danger')).join(' ')}
              </div>
            </div>
            <div class="sa-annexe sa-mono">${esc(i.fichier)} → ${esc(i.controleur || '')} · ${esc(i.fonction || '')}</div>
            ${i.conforme
              ? '<div class="cc-encart-fait" style="margin-bottom:0">Conforme à la matrice.</div>'
              : '<div class="cc-encart-danger" style="margin-bottom:0">Écart avec la matrice — voir les constats ci-dessous.</div>'}
          </div>`).join('')
        : ui.etatVide("Aucune route rattachée",
            "Cette règle est documentaire, ou sa vérification passe par un auditeur de données "
            + "plutôt que par une comparaison de rôles.")}
        <div class="cc-source">${esc(d.verdict || '')}</div>
      </section>

      ${(d.constats || []).length ? `
        <section class="sa-section">
          <h2 class="sa-section-titre">Écarts constatés</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'gravite', titre: 'Gravité', rendu: (l) => ui.badge(l.gravite, SA.ui.tonStatut(l.gravite)) },
              { cle: 'titre', titre: 'Constat' },
              { cle: 'fichier', titre: 'Fichier', classe: 'sa-mono', rendu: (l) =>
                l.fichier ? `${esc(l.fichier)}${l.ligne ? ':' + esc(l.ligne) : ''}` : '—' },
              { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) },
              { cle: 'derniere_detection', titre: 'Vu', rendu: (l) => esc(fmt.relatif(l.derniere_detection)) }
            ], lignes: d.constats, cliquable: true, vide: ''
          })}
        </section>` : ''}

      ${(d.historique || []).length ? `
        <section class="sa-section">
          <h2 class="sa-section-titre">Historique de la règle</h2>
          <div class="cc-timeline">
            ${(d.historique || []).map((h) => `
              <div class="cc-timeline-item">
                <div class="cc-timeline-heure">version ${esc(h.version)} — ${esc(fmt.dateHeure(h.created_at))}</div>
                <div class="cc-timeline-contenu">${esc(h.motif || 'Modification')}</div>
              </div>`).join('')}
          </div>
          <div class="cc-source">
            Une règle qui change laisse une trace : sans cela, un constat d'hier
            deviendrait incompréhensible aujourd'hui.
          </div>
        </section>` : ''}`;

    conteneur.querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', () => SA.naviguer(`cc/constats/${tr.getAttribute('data-id')}`));
    });
  }

  function formulaireNouvelleRegle() {
    const modale = SA.modale({
      titre: 'Ajouter une règle métier',
      sousTitre: "Elle sera marquée « interface » et ne sera jamais écrasée par un déploiement.",
      large: true,
      contenu: `
        <label class="sa-connexion-champ"><span>Code (format RULE-DOMAINE-001)</span>
          <input class="sa-champ" id="cc-nr-code" placeholder="RULE-PAY-005"></label>
        <label class="sa-connexion-champ"><span>Domaine</span>
          <input class="sa-champ" id="cc-nr-domaine" placeholder="paiements"></label>
        <label class="sa-connexion-champ"><span>Titre</span>
          <input class="sa-champ" id="cc-nr-titre"></label>
        <label class="sa-connexion-champ"><span>Énoncé — écrivez-le pour être compris, c'est ce texte que l'IA reçoit</span>
          <textarea class="sa-champ" id="cc-nr-enonce" rows="4"></textarea></label>
        <label class="sa-connexion-champ"><span>Justification — pourquoi cette règle existe</span>
          <textarea class="sa-champ" id="cc-nr-just" rows="3"></textarea></label>
        <label class="sa-connexion-champ"><span>Criticité</span>
          <select class="sa-champ" id="cc-nr-crit">
            <option value="moyenne">Moyenne</option><option value="haute">Haute</option>
            <option value="critique">Critique</option><option value="basse">Basse</option>
          </select></label>`,
      actions: `<button class="sa-bouton sa-bouton-principal" data-role="ok">Enregistrer</button>`
    });
    modale.querySelector('[data-role="ok"]').addEventListener('click', async () => {
      try {
        await SA.api('/super-admin/control-center/regles', {
          method: 'POST',
          body: JSON.stringify({
            code: document.getElementById('cc-nr-code').value,
            domaine: document.getElementById('cc-nr-domaine').value,
            titre: document.getElementById('cc-nr-titre').value,
            enonce: document.getElementById('cc-nr-enonce').value,
            justification: document.getElementById('cc-nr-just').value,
            criticite: document.getElementById('cc-nr-crit').value
          })
        });
        modale.fermer();
        SA.toast('Règle ajoutée.', 'succes');
        SA.rafraichirVue();
      } catch (err) { SA.toast(err.message, 'danger'); }
    });
  }

  /* ======================================================================
     2. MATRICE DES PERMISSIONS
     ====================================================================== */

  SA.enregistrerVue('cc/matrice', {
    titre: 'Matrice des permissions',
    sousTitre: 'Permission théorique contre permission réellement implémentée.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(8, 34);
      const d = await SA.api('/super-admin/control-center/matrice');
      const g = d.grille || {};
      const r = d.resume || {};

      const parRessource = {};
      for (const c of d.comparaison) (parRessource[c.ressource] = parRessource[c.ressource] || []).push(c);

      conteneur.innerHTML = `
        <div class="sa-grille-stats" style="margin-bottom:20px">
          ${ui.carteStat({ valeur: fmt.nombre(r.lignes_matrice), etiquette: 'Croisements décrits' })}
          ${ui.carteStat({ valeur: fmt.nombre(r.conformes), etiquette: 'Conformes', ton: 'succes' })}
          ${ui.carteStat({ valeur: fmt.nombre(r.en_ecart), etiquette: 'En écart',
                           ton: r.en_ecart ? 'danger' : 'succes' })}
          ${ui.carteStat({ valeur: fmt.pourcent(r.taux_conformite), etiquette: 'Taux de conformité' })}
          ${ui.carteStat({ valeur: fmt.nombre(r.routes_serveur), etiquette: 'Routes du serveur',
                           detail: 'analysées statiquement' })}
        </div>

        <section class="sa-section">
          <h2 class="sa-section-titre">Grille rôles × ressources × actions</h2>
          <div class="cc-matrice-conteneur">
            <table class="cc-matrice">
              <thead>
                <tr>
                  <th class="cc-col-ressource">Ressource · action</th>
                  ${(g.roles || []).map((x) => `<th>${esc(fmt.role(x))}</th>`).join('')}
                  <th>Code</th>
                </tr>
              </thead>
              <tbody>
                ${(g.lignes || []).map((l) => {
                  const comp = d.comparaison.find((c) => c.ressource === l.ressource && c.action === l.action);
                  const ecart = comp && !comp.conforme;
                  return `
                    <tr class="${ecart ? 'cc-ecart' : ''}" data-ressource="${esc(l.ressource)}" data-action="${esc(l.action)}">
                      <td class="cc-col-ressource">
                        <strong>${esc(l.ressource)}</strong> · ${esc(l.action)}
                        ${l.regle ? '<br>' + badgeRegle(l.regle) : ''}
                      </td>
                      ${(l.cases || []).map((ok) =>
                        `<td class="${ok ? 'cc-case-oui' : 'cc-case-non'}">${ok ? '●' : '○'}</td>`).join('')}
                      <td>${ecart ? ui.badge('écart', 'danger') : ui.badge('conforme', 'succes')}</td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div class="cc-source">
            ● la matrice accorde la permission · ○ elle ne l'accorde pas.
            La colonne « Code » compare cette théorie à ce que les fichiers de routes
            font réellement. Cliquez une ligne pour le détail.
          </div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Écarts détaillés</h2>
          ${d.comparaison.filter((c) => !c.conforme).map((c) => `
            <div class="sa-panneau" style="margin-bottom:12px">
              <div style="font-weight:600;margin-bottom:6px">
                ${esc(c.ressource)} · ${esc(c.action)} ${badgeRegle(c.regle)}
                ${ui.badge(c.criticite, SA.ui.tonStatut(c.criticite))}
              </div>
              ${c.note ? `<p class="sa-annexe" style="margin:0 0 9px">${esc(c.note)}</p>` : ''}
              ${(c.implementations || []).map((i) => i.introuvable ? `
                <div class="cc-encart-hypothese" style="margin:6px 0">
                  Route <span class="sa-mono">${esc(i.route)}</span> décrite par la matrice
                  mais absente du code.
                </div>` : `
                <div class="cc-comparaison">
                  <div class="cc-comparaison-bloc attendu">
                    <h4>Attendu</h4>
                    ${(c.roles_attendus || []).map((x) => ui.badge(x, 'succes')).join(' ') || '<span class="sa-muet">aucun rôle d\'école</span>'}
                  </div>
                  <div class="cc-comparaison-bloc trouve">
                    <h4>Implémenté — <span class="sa-mono">${esc(i.route)}</span></h4>
                    ${i.roles_implementes === null
                      ? '<span style="color:var(--rouge)">aucune restriction</span>'
                      : (i.roles_implementes || []).map((x) =>
                          ui.badge(x, (c.roles_attendus || []).includes(x) ? 'succes' : 'danger')).join(' ')}
                    ${(i.roles_en_trop || []).length
                      ? `<div style="margin-top:7px;font-size:.8rem;color:var(--rouge)">En trop : ${(i.roles_en_trop || []).map(esc).join(', ')}</div>` : ''}
                    ${(i.roles_manquants || []).length
                      ? `<div style="margin-top:4px;font-size:.8rem;color:var(--texte-att)">Manquants : ${(i.roles_manquants || []).map(esc).join(', ')}</div>` : ''}
                    ${i.middleware_exige && i.middleware_present === false
                      ? `<div style="margin-top:7px;font-size:.8rem;color:var(--rouge)">Middleware obligatoire absent : ${esc(i.middleware_exige)}</div>` : ''}
                  </div>
                </div>
                <div class="sa-annexe sa-mono">${esc(i.fichier || '')}</div>`).join('')}
            </div>`).join('') || ui.etatVide('Aucun écart',
              "Sur le périmètre décrit par la matrice, le code fait ce que la logique métier prévoit.")}
        </section>

        <div class="cc-source">
          Théorique : ${esc((d.source || {}).theorique || '')}<br>
          Implémenté : ${esc((d.source || {}).implemente || '')}<br>
          ${esc((d.source || {}).limites || '')}
        </div>`;

      conteneur.querySelectorAll('tr[data-ressource]').forEach((tr) => {
        tr.addEventListener('click', () => {
          const c = d.comparaison.find((x) =>
            x.ressource === tr.getAttribute('data-ressource') && x.action === tr.getAttribute('data-action'));
          if (!c) return;
          SA.modale({
            titre: `${c.ressource} · ${c.action}`,
            sousTitre: c.regle ? `Fondée sur ${c.regle}` : 'Aucune règle métier rattachée',
            large: true,
            contenu: `
              ${c.note ? `<p class="sa-texte">${esc(c.note)}</p>` : ''}
              <div class="cc-comparaison">
                <div class="cc-comparaison-bloc attendu"><h4>Rôles attendus</h4>
                  ${(c.roles_attendus || []).map((x) => ui.badge(x, 'succes')).join(' ') || '—'}</div>
                <div class="cc-comparaison-bloc trouve"><h4>Criticité</h4>
                  ${ui.badge(c.criticite, SA.ui.tonStatut(c.criticite))}</div>
              </div>
              ${(c.implementations || []).map((i) => `
                <div class="cc-champ">
                  <dt class="sa-mono">${esc(i.route)}</dt>
                  <dd>${i.introuvable ? 'route absente du code'
                    : `${i.roles_implementes === null ? 'aucune restriction' : (i.roles_implementes || []).join(', ')}
                       <br><span class="sa-annexe sa-mono">${esc(i.fichier || '')}</span>`}</dd>
                </div>`).join('')}
              ${c.controle_fin ? `
                <div class="cc-encart-fait">
                  Le filtre de rôle est volontairement large : la règle réelle est
                  appliquée par <span class="sa-mono">${esc(c.controle_fin)}()</span> dans
                  le contrôleur. L'auditeur vérifie que cette fonction existe bien.
                </div>` : ''}`
          });
        });
      });
    }
  });

  /* ---------- Audit d'un rôle ---------- */

  SA.enregistrerVue('cc/roles', {
    titre: 'Ce que peut faire un rôle',
    sousTitre: "Tout ce qu'un rôle atteint réellement dans le code.",

    async rendu(conteneur, params, segments) {
      const role = segments && segments[0] ? segments[0] : (params.role || 'directeur');
      conteneur.innerHTML = ui.squelette(8, 34);

      const d = await SA.api(`/super-admin/control-center/matrice/role/${encodeURIComponent(role)}`);
      const r = d.resume || {};

      conteneur.innerHTML = `
        <div class="cc-filtres">
          <label class="cc-filtre"><span>Rôle</span>
            <select class="sa-champ" id="cc-role-sel">
              ${['directeur', 'prefet', 'secretaire', 'professeur', 'titulaire', 'comptable',
                 'directeur_discipline', 'charge_presences', 'parent', 'eleve'].map((x) =>
                `<option value="${x}"${x === role ? ' selected' : ''}>${esc(fmt.role(x))}</option>`).join('')}
            </select></label>
        </div>

        <div class="sa-grille-stats" style="margin-bottom:20px">
          ${ui.carteStat({ valeur: fmt.nombre(r.routes_accessibles), etiquette: 'Routes accessibles' })}
          ${ui.carteStat({ valeur: fmt.nombre(r.dont_ecritures), etiquette: 'Dont écritures',
                           ton: 'attention' })}
          ${ui.carteStat({ valeur: fmt.nombre(r.dont_sans_restriction),
                           etiquette: 'Sans restriction de rôle',
                           detail: 'ouvertes à tout compte authentifié' })}
          ${ui.carteStat({ valeur: fmt.nombre(r.actions_accordees_par_matrice),
                           etiquette: 'Accordées par la matrice' })}
        </div>

        ${(d.constats || []).length ? `
          <section class="sa-section">
            <h2 class="sa-section-titre">Écarts concernant ce rôle</h2>
            ${ui.tableau({
              colonnes: [
                { cle: 'gravite', titre: 'Gravité', rendu: (l) => ui.badge(l.gravite, SA.ui.tonStatut(l.gravite)) },
                { cle: 'titre', titre: 'Constat' },
                { cle: 'route', titre: 'Route', classe: 'sa-mono' },
                { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) }
              ], lignes: d.constats, cliquable: true, vide: ''
            })}
          </section>` : ''}

        <section class="sa-section">
          <h2 class="sa-section-titre">Routes atteignables</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'route', titre: 'Route', classe: 'sa-mono' },
              { cle: 'sans_restriction', titre: '', rendu: (l) => l.sans_restriction
                ? ui.badge('sans restriction', 'attention') : '' },
              { cle: 'roles', titre: 'Rôles admis', rendu: (l) => l.roles
                ? (l.roles || []).map((x) => ui.badge(x, x === role ? 'info' : 'neutre')).join(' ')
                : '<span class="sa-muet">tous</span>' },
              { cle: 'controleur', titre: 'Contrôleur', classe: 'sa-mono' },
              { cle: 'fonction', titre: 'Fonction', classe: 'sa-mono' }
            ], lignes: d.detail || [], vide: 'Aucune route'
          })}
          <div class="cc-source">${esc(d.note || '')}</div>
        </section>`;

      const sel = document.getElementById('cc-role-sel');
      if (sel) sel.addEventListener('change', () => SA.naviguer(`cc/roles/${sel.value}`));

      conteneur.querySelectorAll('tr[data-id]').forEach((tr) => {
        tr.addEventListener('click', () => SA.naviguer(`cc/constats/${tr.getAttribute('data-id')}`));
      });
    }
  });

  /* ======================================================================
     3. AUDITS
     ====================================================================== */

  SA.enregistrerVue('cc/audits', {
    titre: 'Audits',
    sousTitre: 'Permissions, isolation multi-écoles, qualité des données et workflows.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(6, 60);
      const d = await SA.api('/super-admin/control-center/audits');

      conteneur.innerHTML = `
        <section class="sa-section">
          <h2 class="sa-section-titre">Lancer un audit</h2>
          <div class="cc-grille-3">
            ${(d.audits_disponibles || []).map((a) => `
              <div class="sa-panneau">
                <h3 class="sa-section-titre" style="margin-top:0">${esc(a.libelle)}</h3>
                <p class="sa-annexe">
                  Règles couvertes : ${(a.regles_couvertes || []).map((c) => badgeRegle(c)).join(' ') || 'aucune'}
                </p>
                <button class="sa-bouton sa-bouton-principal sa-bouton-petit"
                        data-audit="${esc(a.cle)}" style="margin-top:9px">Lancer</button>
              </div>`).join('')}
          </div>
          <div style="margin-top:14px">
            <button class="sa-bouton sa-bouton-secondaire" data-audit="tout">Tout auditer</button>
          </div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">État par famille</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'type', titre: 'Famille' },
              { cle: 'ouverts', titre: 'Ouverts', classe: 'sa-num', rendu: (l) => fmt.nombre(l.ouverts) },
              { cle: 'critiques_ouverts', titre: 'Critiques', classe: 'sa-num', rendu: (l) =>
                Number(l.critiques_ouverts) ? `<strong style="color:var(--rouge)">${esc(l.critiques_ouverts)}</strong>` : '0' },
              { cle: 'reapparus', titre: 'Réapparus', classe: 'sa-num', rendu: (l) =>
                Number(l.reapparus) ? `<strong style="color:var(--ocre)">${esc(l.reapparus)}</strong>` : '0' },
              { cle: 'corriges', titre: 'Corrigés', classe: 'sa-num', rendu: (l) => fmt.nombre(l.corriges) },
              { cle: 'ignores', titre: 'Ignorés', classe: 'sa-num', rendu: (l) => fmt.nombre(l.ignores) },
              { cle: 'derniere_execution', titre: 'Dernier passage', rendu: (l) => esc(fmt.relatif(l.derniere_execution)) }
            ], lignes: d.etat_par_type || [], vide: "Aucun audit n'a encore tourné"
          })}
        </section>

        ${(d.constats_reapparus || []).length ? `
          <section class="sa-section">
            <h2 class="sa-section-titre">Écarts réapparus</h2>
            <div class="cc-encart-danger">${esc(d.note_reapparition || '')}</div>
            ${ui.tableau({
              colonnes: [
                { cle: 'titre', titre: 'Constat' },
                { cle: 'type', titre: 'Famille' },
                { cle: 'gravite', titre: 'Gravité', rendu: (l) => ui.badge(l.gravite, SA.ui.tonStatut(l.gravite)) },
                { cle: 'occurrences', titre: '×', classe: 'sa-num', rendu: (l) => fmt.nombre(l.occurrences) },
                { cle: 'derniere_detection', titre: 'Revu', rendu: (l) => esc(fmt.relatif(l.derniere_detection)) }
              ], lignes: d.constats_reapparus, cliquable: true, vide: ''
            })}
          </section>` : ''}

        <div class="cc-source">
          Registre : ${esc((d.regles || {}).total)} règles, dont
          ${esc((d.regles || {}).verifiables)} vérifiables automatiquement et
          ${esc((d.regles || {}).documentaires)} documentaires.
          Un audit LIT le code et les données ; il n'écrit que dans ses propres tables
          de constats.
        </div>`;

      conteneur.querySelectorAll('[data-audit]').forEach((b) => {
        b.addEventListener('click', async () => {
          const cle = b.getAttribute('data-audit');
          const avant = b.textContent;
          b.disabled = true; b.textContent = 'En cours…';
          try {
            const r = await SA.api(`/super-admin/control-center/audits/${cle}`, { method: 'POST' });
            SA.toast(
              `${r.resume_global.constats} constat(s) — ${r.resume_global.critiques} critique(s), `
              + `${r.resume_global.faits} fait(s), ${r.resume_global.hypotheses} hypothèse(s). `
              + `${fmt.duree(r.duree_ms)}.`,
              r.resume_global.critiques ? 'danger' : 'succes', 9000);
            SA.rafraichirVue();
          } catch (err) {
            SA.toast(err.message, 'danger');
            b.disabled = false; b.textContent = avant;
          }
        });
      });

      conteneur.querySelectorAll('tr[data-id]').forEach((tr) => {
        tr.addEventListener('click', () => SA.naviguer(`cc/constats/${tr.getAttribute('data-id')}`));
      });
    }
  });

  /* ======================================================================
     4. CONSTATS
     ====================================================================== */

  SA.enregistrerVue('cc/constats', {
    titre: 'Écarts constatés',
    sousTitre: "Un écart n'est pas un bug : il peut n'avoir provoqué aucune erreur et être bien plus grave.",

    async rendu(conteneur, params, segments) {
      if (segments && segments.length) return ficheConstat(conteneur, segments[0]);

      const requete = {
        type: params.type || '', gravite: params.gravite || '',
        urgence: params.urgence || '', statut: params.statut || '',
        confiance: params.confiance || '', q: params.q || '', page: params.page || 1
      };

      conteneur.innerHTML = ui.squelette(8);
      const d = await SA.api(SA.url('/super-admin/control-center/constats', requete));
      const f = d.filtres || {};

      conteneur.innerHTML = `
        <div class="cc-filtres">
          <label class="cc-filtre cc-filtre-large"><span>Recherche</span>
            <input class="sa-champ" id="cc-c-q" value="${esc(requete.q)}" placeholder="titre ou fichier"></label>
          ${[['type', 'Famille', f.types], ['gravite', 'Gravité', f.gravites],
             ['urgence', 'Urgence', f.urgences], ['statut', 'Statut', f.statuts],
             ['confiance', 'Confiance', ['fait', 'hypothese']]].map(([cle, lib, opts]) => `
            <label class="cc-filtre"><span>${lib}</span>
              <select class="sa-champ" id="cc-c-${cle}">
                <option value="">Tous</option>
                ${(opts || []).map((o) =>
                  `<option value="${esc(o)}"${requete[cle] === o ? ' selected' : ''}>${esc(String(o).replace(/_/g, ' '))}</option>`).join('')}
              </select></label>`).join('')}
        </div>

        ${ui.tableau({
          colonnes: [
            { cle: 'urgence', titre: 'Urgence', rendu: (l) =>
              ui.badge(String(l.urgence).replace(/_/g, ' '),
                l.urgence === 'immediat' ? 'danger' : l.urgence === 'aujourd_hui' ? 'attention' : 'neutre') },
            { cle: 'gravite', titre: 'Gravité', rendu: (l) => ui.badge(l.gravite, SA.ui.tonStatut(l.gravite)) },
            { cle: 'confiance', titre: '', rendu: (l) => badgeConfiance(l.confiance) },
            { cle: 'titre', titre: 'Constat', rendu: (l) =>
              `<div>${esc(l.titre)}</div>`
              + `<div class="sa-annexe">${badgeRegle(l.code_regle)} `
              + `${l.fichier ? `<span class="sa-mono">${esc(l.fichier)}${l.ligne ? ':' + esc(l.ligne) : ''}</span>` : ''}</div>` },
            { cle: 'type', titre: 'Famille', rendu: (l) => ui.badge(l.type, 'neutre') },
            { cle: 'statut', titre: 'Statut', rendu: (l) => l.statut === 'reapparu'
              ? ui.badge('réapparu', 'danger') : ui.badgeStatut(l.statut) },
            { cle: 'score_priorite', titre: 'Priorité', classe: 'sa-num', rendu: (l) => fmt.nombre(l.score_priorite) }
          ], lignes: d.donnees, cliquable: true, vide: 'Aucun écart avec ces filtres'
        })}
        ${ui.pagination(d.pagination)}`;

      const relancer = (m) => SA.naviguer('cc/constats', Object.assign({}, requete, m, { page: 1 }));
      const q = document.getElementById('cc-c-q');
      if (q) q.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') relancer({ q: q.value.trim() }); });
      ['type', 'gravite', 'urgence', 'statut', 'confiance'].forEach((n) => {
        const el = document.getElementById(`cc-c-${n}`);
        if (el) el.addEventListener('change', () => relancer({ [n]: el.value }));
      });

      conteneur.querySelectorAll('tr[data-id]').forEach((tr) => {
        tr.addEventListener('click', () => SA.naviguer(`cc/constats/${tr.getAttribute('data-id')}`));
      });
      paginationSimple(conteneur, 'cc/constats', requete);
    }
  });

  async function ficheConstat(conteneur, id) {
    conteneur.innerHTML = ui.squelette(6);
    const d = await SA.api(`/super-admin/control-center/constats/${id}`);
    const c = d.constat;
    const regle = d.regle_metier;
    const prio = d.priorite || {};

    conteneur.innerHTML = `
      <section class="sa-panneau">
        <h3 class="sa-section-titre" style="margin-top:0">${esc(c.titre)}</h3>
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px">
          ${badgeConfiance(c.confiance)}
          ${ui.badge(c.type, 'neutre')}
          ${ui.badge(c.gravite, SA.ui.tonStatut(c.gravite))}
          ${ui.badge(String(c.urgence).replace(/_/g, ' '), c.urgence === 'immediat' ? 'danger' : 'neutre')}
          ${c.statut === 'reapparu' ? ui.badge('réapparu', 'danger') : ui.badgeStatut(c.statut)}
          ${badgeRegle(c.code_regle)}
        </div>

        <div class="${c.confiance === 'hypothese' ? 'cc-encart-hypothese' : 'cc-encart-fait'}">
          ${esc(d.rappel_confiance || '')}
        </div>

        <div style="white-space:pre-wrap;line-height:1.65;font-size:.9rem">${esc(c.description || '')}</div>

        <dl style="margin-top:16px">
          <div class="cc-champ"><dt>Fichier</dt><dd class="sa-mono">${esc(c.fichier || '—')}${c.ligne ? ':' + esc(c.ligne) : ''}</dd></div>
          <div class="cc-champ"><dt>Fonction</dt><dd class="sa-mono">${esc(c.fonction || '—')}</dd></div>
          <div class="cc-champ"><dt>Route</dt><dd class="sa-mono">${esc(c.route || '—')}</dd></div>
          <div class="cc-champ"><dt>Rôle concerné</dt><dd>${c.role_concerne ? ui.badge(c.role_concerne, 'neutre') : '—'}</dd></div>
          <div class="cc-champ"><dt>Occurrences</dt><dd>${esc(fmt.nombre(c.occurrences))}</dd></div>
          <div class="cc-champ"><dt>Première détection</dt><dd>${esc(fmt.dateHeure(c.premiere_detection))}</dd></div>
          <div class="cc-champ"><dt>Dernière détection</dt><dd>${esc(fmt.dateHeure(c.derniere_detection))}</dd></div>
          <div class="cc-champ"><dt>Écoles touchées</dt><dd>${esc(fmt.nombre(c.ecoles_touchees))}</dd></div>
        </dl>
      </section>

      ${regle ? `
        <section class="sa-panneau">
          <h3 class="sa-section-titre">Règle métier violée</h3>
          <div style="font-weight:600;margin-bottom:7px">
            <span class="cc-regle">${esc(regle.code)}</span> ${esc(regle.titre)}
          </div>
          <p class="sa-texte" style="margin:0">${esc(regle.enonce)}</p>
          ${regle.justification ? `<div class="cc-encart-fait"><strong>Pourquoi</strong><br>${esc(regle.justification)}</div>` : ''}
        </section>` : ''}

      <section class="sa-panneau">
        <h3 class="sa-section-titre">Preuve</h3>
        <pre class="cc-code">${esc(JSON.stringify(c.preuve || {}, null, 2))}</pre>
        <div class="cc-source">
          Priorité ${esc(prio.score)} — ${esc((prio.facteurs && JSON.stringify(prio.facteurs)) || '')}
        </div>
      </section>

      <section class="sa-section">
        <h2 class="sa-section-titre">Actions</h2>
        <div style="display:flex;flex-wrap:wrap;gap:9px;margin-bottom:12px">
          <button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="cc-cf-ia">Demander l'analyse de l'IA</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="cc-cf-correctif">Proposer un correctif</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-statut="investigation">En investigation</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-statut="corrige">Marquer corrigé</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-statut="ignore">Ignorer</button>
        </div>
        <div class="cc-source">
          Aucune de ces actions ne modifie le code ni les données. « Marquer corrigé »
          est une déclaration : c'est le prochain audit qui confirmera, et le constat
          repassera en « réapparu » s'il revient.
        </div>
      </section>

      <div id="cc-cf-sortie"></div>

      ${(d.correctifs || []).length ? `
        <section class="sa-section">
          <h2 class="sa-section-titre">Correctifs proposés</h2>
          ${(d.correctifs || []).map((p) => `
            <div class="sa-panneau" style="margin-bottom:12px">
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
                ${ui.badgeStatut(p.statut)} ${ui.badge('risque ' + p.risque, SA.ui.tonStatut(p.risque === 'eleve' ? 'haute' : p.risque))}
                <span class="sa-annexe sa-mono">${esc(p.fichier)}</span>
              </div>
              ${p.pourquoi ? `<p class="sa-texte">${esc(p.pourquoi)}</p>` : ''}
              ${p.diff_propose ? `<pre class="cc-code">${esc(p.diff_propose)}</pre>` : ''}
              ${p.statut === 'proposee' ? `
                <div style="display:flex;gap:8px;margin-top:9px">
                  <button class="sa-bouton sa-bouton-principal sa-bouton-petit" data-correctif="${esc(p.id)}" data-decision="acceptee">Accepter</button>
                  <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-correctif="${esc(p.id)}" data-decision="rejetee">Rejeter</button>
                </div>` : ''}
            </div>`).join('')}
        </section>` : ''}

      ${(d.evenements || []).length ? `
        <section class="sa-section">
          <h2 class="sa-section-titre">Historique</h2>
          <div class="cc-timeline">
            ${(d.evenements || []).map((e) => `
              <div class="cc-timeline-item type-${esc(e.type)}">
                <div class="cc-timeline-heure">${esc(fmt.dateHeure(e.created_at))} ${e.auteur ? '· ' + esc(e.auteur) : ''} · ${esc(e.type)}</div>
                <div class="cc-timeline-contenu" style="white-space:pre-wrap">${esc(e.contenu || '')}</div>
              </div>`).join('')}
          </div>
        </section>` : ''}`;

    /* --- Changement de statut --- */
    conteneur.querySelectorAll('[data-statut]').forEach((b) => {
      b.addEventListener('click', async () => {
        const statut = b.getAttribute('data-statut');
        let motif = null;
        if (statut === 'ignore') {
          motif = window.prompt(
            "Ignorer un écart exige un motif : il sera relu par la personne suivante.");
          if (!motif || !motif.trim()) return;
        }
        try {
          await SA.api(`/super-admin/control-center/constats/${c.id}`, {
            method: 'PATCH', body: JSON.stringify({ statut, motif })
          });
          SA.toast('Statut mis à jour.', 'succes');
          SA.rafraichirVue();
        } catch (err) { SA.toast(err.message, 'danger'); }
      });
    });

    /* --- Analyse IA --- */
    const btnIA = document.getElementById('cc-cf-ia');
    if (btnIA) {
      btnIA.addEventListener('click', async () => {
        const zone = document.getElementById('cc-cf-sortie');
        btnIA.disabled = true; btnIA.textContent = 'Analyse…';
        zone.innerHTML = '<div class="sa-panneau">' + ui.squelette(4, 22) + '</div>';
        try {
          const r = await SA.api(`/super-admin/control-center/ia/analyser-constat/${c.id}`, { method: 'POST' });
          zone.innerHTML = `
            <section class="sa-section">
              <h2 class="sa-section-titre">Analyse de l'IA <span class="sa-annexe">${esc(r.modele)}</span></h2>
              <div class="sa-panneau" style="white-space:pre-wrap;line-height:1.65;font-size:.89rem">${esc(r.analyse)}</div>
              <div class="cc-source">${esc(r.conserve || '')}</div>
            </section>`;
        } catch (err) {
          zone.innerHTML = `<div class="cc-encart-danger">${esc(err.message)}</div>`;
        } finally { btnIA.disabled = false; btnIA.textContent = "Demander l'analyse de l'IA"; }
      });
    }

    /* --- Proposition de correctif --- */
    const btnC = document.getElementById('cc-cf-correctif');
    if (btnC) {
      btnC.addEventListener('click', async () => {
        const zone = document.getElementById('cc-cf-sortie');
        btnC.disabled = true; btnC.textContent = 'Génération…';
        zone.innerHTML = '<div class="sa-panneau">' + ui.squelette(5, 22) + '</div>';
        try {
          const r = await SA.api(`/super-admin/control-center/ia/proposer-correctif/${c.id}`, { method: 'POST' });
          zone.innerHTML = `
            <section class="sa-section">
              <h2 class="sa-section-titre">Correctif proposé
                <span class="sa-annexe">risque ${esc(r.proposition.risque)}</span></h2>
              <div class="cc-encart-danger">${esc(r.garantie)}</div>
              <div class="sa-panneau" style="white-space:pre-wrap;line-height:1.65;font-size:.88rem">${esc(r.reponse_complete)}</div>
            </section>`;
          SA.toast('Correctif proposé. Il attend votre validation.', 'info', 8000);
        } catch (err) {
          zone.innerHTML = `<div class="cc-encart-danger">${esc(err.message)}</div>`;
        } finally { btnC.disabled = false; btnC.textContent = 'Proposer un correctif'; }
      });
    }

    /* --- Décision sur un correctif --- */
    conteneur.querySelectorAll('[data-correctif]').forEach((b) => {
      b.addEventListener('click', async () => {
        const decision = b.getAttribute('data-decision');
        let motif = null;
        if (decision === 'rejetee') {
          motif = window.prompt('Motif du rejet (obligatoire) :');
          if (!motif || !motif.trim()) return;
        }
        try {
          await SA.api(`/super-admin/control-center/correctifs/${b.getAttribute('data-correctif')}`, {
            method: 'PATCH', body: JSON.stringify({ statut: decision, motif })
          });
          SA.toast(decision === 'acceptee'
            ? "Correctif accepté. Son application dans le dépôt reste un acte humain distinct."
            : 'Correctif rejeté.', 'succes', 7000);
          SA.rafraichirVue();
        } catch (err) { SA.toast(err.message, 'danger'); }
      });
    });
  }

  /* ======================================================================
     5. CARTE DES ROUTES
     ====================================================================== */

  SA.enregistrerVue('cc/routes', {
    titre: 'Carte des routes',
    sousTitre: 'Toutes les routes du serveur, extraites du code du déploiement en cours.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(10, 30);
      const d = await SA.api(SA.url('/super-admin/control-center/routes',
        params.q ? { q: params.q } : {}));

      conteneur.innerHTML = `
        <div class="cc-filtres">
          <label class="cc-filtre cc-filtre-large"><span>Rechercher une route, un contrôleur, une fonction</span>
            <input class="sa-champ" id="cc-rt-q" value="${esc(params.q || '')}" placeholder="ex. paiement, bulletin, notes.controller"></label>
        </div>

        <div class="sa-grille-stats" style="margin-bottom:18px">
          ${ui.carteStat({ valeur: fmt.nombre(d.totaux.routes), etiquette: 'Routes' })}
          ${ui.carteStat({ valeur: fmt.nombre(d.totaux.fichiers_routes), etiquette: 'Fichiers de routes' })}
          ${ui.carteStat({ valeur: fmt.nombre(d.totaux.controleurs), etiquette: 'Contrôleurs' })}
          ${ui.carteStat({ valeur: fmt.nombre(d.totaux.fonctions), etiquette: 'Fonctions exportées' })}
          ${ui.carteStat({ valeur: fmt.duree(d.duree_analyse_ms), etiquette: "Durée de l'analyse" })}
        </div>

        ${ui.tableau({
          colonnes: [
            { cle: 'methode', titre: 'Méthode', rendu: (l) => ui.badge(l.methode,
              ['POST', 'PUT', 'PATCH', 'DELETE'].includes(l.methode) ? 'attention' : 'neutre') },
            { cle: 'chemin', titre: 'Chemin', classe: 'sa-mono' },
            { cle: 'roles', titre: 'Rôles', rendu: (l) => l.roles
              ? (l.roles || []).map((x) => ui.badge(x, 'neutre')).join(' ')
              : (l.authentifie ? '<span class="sa-muet">tout compte authentifié</span>'
                               : ui.badge('public', 'attention')) },
            { cle: 'controleur', titre: 'Contrôleur', classe: 'sa-mono' },
            { cle: 'fonction', titre: 'Fonction', classe: 'sa-mono' },
            { cle: 'ligne', titre: 'Source', classe: 'sa-mono', rendu: (l) => `${esc(l.fichier)}:${esc(l.ligne)}` }
          ], lignes: d.routes, vide: 'Aucune route'
        })}

        ${(d.non_analysables || []).length ? `
          <div class="cc-encart-hypothese">
            ${d.non_analysables.length} déclaration(s) de route n'ont pas pu être analysées
            statiquement. Elles sont signalées plutôt qu'ignorées en silence — mais elles
            échappent aux audits de permissions.
          </div>` : ''}

        <div class="cc-source">
          Analyse relevée à ${esc(fmt.dateHeure(d.genere_a))}. Cette carte reflète le code
          du déploiement en cours, pas une documentation qui pourrait avoir vieilli.
        </div>`;

      const q = document.getElementById('cc-rt-q');
      if (q) q.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') SA.naviguer('cc/routes', { q: q.value.trim() });
      });
    }
  });
})();
