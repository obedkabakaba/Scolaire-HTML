/* ==========================================================================
   Ardoise — Super Admin : Centre Finance
   --------------------------------------------------------------------------
   Tableau de bord financier, rentabilité, seuil de rentabilité, prévisions,
   alertes, coût des fonctionnalités, journal financier, permissions, exports.

   Aucune donnée n'est fabriquée ici. Quand le serveur renvoie `null`, on
   affiche « — » et, s'il l'accompagne d'une explication, on l'affiche aussi.
   Un tableau de bord financier qui remplit ses trous tout seul est un
   tableau de bord qui ment.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui, graphe } = SA;

  /* ---------- Formatage propre à la finance ---------- */

  let deviseCourante = 'USD';

  /** Montant dans la devise de référence, avec repli explicite. */
  function argent(v, decimales) {
    if (v === null || v === undefined || v === '') return '<span class="sa-muet">—</span>';
    const n = Number(v);
    if (!Number.isFinite(n)) return '<span class="sa-muet">—</span>';
    const texte = n.toLocaleString('fr-FR', {
      minimumFractionDigits: decimales === undefined ? 2 : decimales,
      maximumFractionDigits: decimales === undefined ? 2 : decimales
    });
    return `${esc(texte)} <span class="sa-devise">${esc(deviseCourante)}</span>`;
  }

  /** Montant signé : le signe porte l'information, la couleur la souligne. */
  function argentSigne(v) {
    if (v === null || v === undefined) return '<span class="sa-muet">—</span>';
    const n = Number(v);
    const classe = n > 0 ? 'sa-positif' : n < 0 ? 'sa-negatif' : '';
    return `<span class="${classe}">${n > 0 ? '+' : ''}${argent(n)}</span>`;
  }

  function pourcent(v, decimales) {
    if (v === null || v === undefined) return '<span class="sa-muet">—</span>';
    const n = Number(v);
    const classe = n < 0 ? 'sa-negatif' : '';
    return `<span class="${classe}">${esc(fmt.decimal(n, decimales === undefined ? 1 : decimales))} %</span>`;
  }

  function moisLisible(m) {
    if (!m) return '—';
    const d = new Date(`${m}-01T00:00:00Z`);
    return isNaN(d) ? m : d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  }

  /** Série {mois, valeur} → points de courbe. */
  function points(serie) {
    return (serie || []).map((d) => ({ x: moisLisible(d.mois), y: Number(d.valeur) || 0 }));
  }

  /** Bandeau listant ce qui manque pour que les chiffres soient complets. */
  function bandeauManquant(liste) {
    if (!liste || !liste.length) return '';
    return `<div class="sa-encart-info">
      <div class="sa-encart-titre">⚠️ Données à compléter</div>
      <ul class="sa-encart-liste">
        ${liste.map((d) => `<li><strong>${esc(d.indicateur)}</strong> — ${esc(d.raison)}
          <span class="sa-muet">${esc(d.action || '')}</span></li>`).join('')}
      </ul>
    </div>`;
  }

  /** Bandeau « lecture seule » quand le compte n'a pas le droit d'écrire. */
  function bandeauLecture(peutEcrire) {
    if (peutEcrire !== false) return '';
    return `<div class="sa-bandeau-lecture">
      Accès financier en lecture seule : les actions de création et de modification sont désactivées.
    </div>`;
  }

  /* ======================================================================
     1. Tableau de bord financier
     ====================================================================== */

  SA.enregistrerVue('finance', {
    titre: 'Finance',
    sousTitre: "Ce qu'Ardoise rapporte, ce qu'Ardoise coûte, ce qu'il en reste.",

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squeletteCartes(8) + '<div style="height:16px"></div>' + ui.squelette(3, 200);

      const d = await SA.api('/super-admin/finance/tableau-de-bord');
      deviseCourante = d.devise_reference || 'USD';

      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `
          <span class="sa-muet" style="align-self:center;font-size:.78rem">
            Mis à jour ${esc(fmt.relatif(d.genere_a))}
          </span>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-exports">Exporter</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-actualiser">Actualiser</button>`;
        const btnA = document.getElementById('btn-actualiser');
        if (btnA) btnA.addEventListener('click', async () => {
          await SA.api('/super-admin/finance/tableau-de-bord?forcer=oui');
          SA.rafraichirVue();
        });
        const btnE = document.getElementById('btn-exports');
        if (btnE) btnE.addEventListener('click', () => SA.naviguer('finance/exports'));
      }

      const r = d.revenus || {};
      const c = d.couts || {};
      const res = d.resultat || {};
      const ab = d.abonnements || {};
      const pa = d.paiements || {};
      const rm = d.remises || {};

      const cartes = [
        { valeur: argent(r.chiffre_affaires_mensuel), etiquette: 'Chiffre d\'affaires du mois', icone: '💵' },
        { valeur: argent(r.chiffre_affaires_annuel), etiquette: 'Chiffre d\'affaires de l\'année', icone: '📅' },
        { valeur: argent(r.mrr), etiquette: 'MRR — revenu récurrent mensuel', ton: 'info', icone: '🔁' },
        { valeur: argent(r.arr), etiquette: 'ARR — revenu récurrent annuel', ton: 'info', icone: '📈' },
        { valeur: argent(c.mensuel), etiquette: 'Coûts du mois', ton: 'attention', icone: '💸' },
        {
          valeur: argentSigne(res.benefice_mensuel), etiquette: 'Bénéfice estimé du mois',
          ton: res.benefice_mensuel < 0 ? 'danger' : 'succes', icone: '⚖️'
        },
        {
          valeur: pourcent(res.marge_mensuelle), etiquette: 'Marge estimée',
          ton: res.marge_mensuelle === null ? null : res.marge_mensuelle < 0 ? 'danger' : res.marge_mensuelle < 20 ? 'attention' : 'succes',
          icone: '%'
        },
        { valeur: fmt.nombre(ab.ecoles_payantes), etiquette: 'Écoles payantes', detail: `${fmt.nombre(ab.en_essai)} en période d'essai`, icone: '🏫' }
      ];

      const cartes2 = [
        { valeur: fmt.nombre(ab.actifs), etiquette: 'Abonnements actifs', icone: '✓' },
        { valeur: fmt.nombre(ab.expires), etiquette: 'Abonnements expirés', ton: ab.expires ? 'danger' : null, icone: '⛔' },
        { valeur: fmt.nombre(ab.en_attente_paiement), etiquette: 'En attente de paiement', ton: ab.en_attente_paiement ? 'attention' : null, icone: '⏳' },
        { valeur: fmt.nombre(pa.reussis_ce_mois), etiquette: 'Paiements réussis ce mois', ton: 'succes', icone: '💳' },
        { valeur: pa.echoues_ce_mois === null ? '—' : fmt.nombre(pa.echoues_ce_mois), etiquette: 'Paiements échoués', ton: pa.echoues_ce_mois ? 'danger' : null, icone: '✕' },
        { valeur: fmt.nombre(rm.tarifs_negocies_actifs), etiquette: 'Tarifs négociés actifs', detail: `${argent(rm.manque_a_gagner_mensuel)} / mois`, icone: '🏷️' },
        { valeur: argent(c.infrastructure), etiquette: 'Coût infrastructure', icone: '🖥️' },
        { valeur: argent(c.api), etiquette: 'Coût API', icone: '🔌' }
      ];

      conteneur.innerHTML = `
        ${bandeauLecture(d.peut_ecrire)}
        ${d.conversion_approximative ? `<div class="sa-encart-alerte">
          <strong>Consolidation approximative.</strong> Aucun taux de change n'est saisi pour :
          ${esc((d.devises_sans_taux || []).join(', '))}. Ces montants sont additionnés sans conversion.
          <a href="#/couts/taux-change">Saisir un taux →</a>
        </div>` : ''}

        <section class="sa-section">
          <div class="sa-grille-stats">${cartes.map(ui.carteStat).join('')}</div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Abonnements, paiements et remises</h2>
          <div class="sa-grille-stats">${cartes2.map(ui.carteStat).join('')}</div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Revenus, dépenses et bénéfice sur 12 mois</h2>
          <div class="sa-panneau">
            ${graphe.courbe([
              { nom: 'Revenus encaissés', points: points(d.courbes && d.courbes.revenus), couleur: 'var(--vert-ok)' },
              { nom: 'Dépenses', points: points(d.courbes && d.courbes.depenses), couleur: 'var(--rouge)' },
              { nom: 'Bénéfice', points: points(d.courbes && d.courbes.benefice), couleur: 'var(--ocre)' }
            ], { titre: 'Revenus, dépenses et bénéfice', aire: false, hauteur: 260 })}
          </div>
          <div class="sa-grille-2" style="margin-top:16px">
            <div class="sa-panneau">
              <h3 class="sa-section-titre">Écoles payantes</h3>
              ${graphe.courbe([{ nom: 'Écoles', points: points(d.courbes && d.courbes.ecoles_payantes) }], { titre: 'Écoles payantes' })}
            </div>
            <div class="sa-panneau">
              <h3 class="sa-section-titre">
                MRR reconstitué
                <span class="sa-annexe" title="${esc(d.avertissement_mrr_historique || '')}">estimation</span>
              </h3>
              ${graphe.courbe([{ nom: 'MRR', points: points(d.courbes && d.courbes.mrr_reconstitue), couleur: 'var(--encre)' }], { titre: 'MRR' })}
              <p class="sa-note">${esc(d.avertissement_mrr_historique || '')}</p>
            </div>
          </div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Répartition des coûts du mois</h2>
          <div class="sa-grille-2">
            <div class="sa-panneau">
              ${(c.par_categorie && c.par_categorie.length)
                ? graphe.barres(c.par_categorie.map((x) => ({ libelle: x.categorie, valeur: x.montant })),
                    { format: (v) => `${fmt.decimal(v, 2)} ${deviseCourante}` })
                : ui.etatVide('Aucun coût enregistré', 'Renseignez vos services dans « Services & Infrastructure ».')}
            </div>
            <div class="sa-panneau">
              <h3 class="sa-section-titre">Indicateurs unitaires</h3>
              <div class="sa-liste-infos">
                <div class="sa-ligne-info"><span>Revenu moyen par école (ARPU)</span><span>${argent(res.arpu)}</span></div>
                <div class="sa-ligne-info"><span>Coût moyen par école</span><span>${argent(res.cout_moyen_par_ecole)}</span></div>
                <div class="sa-ligne-info"><span>Revenu moyen par élève</span><span>${argent(res.revenu_moyen_par_eleve, 3)}</span></div>
                <div class="sa-ligne-info"><span>Coût moyen par élève</span><span>${argent(res.cout_moyen_par_eleve, 3)}</span></div>
                <div class="sa-ligne-info"><span>Coûts fixes</span><span>${argent(c.fixes)}</span></div>
                <div class="sa-ligne-info"><span>Coûts variables</span><span>${argent(c.variables)}</span></div>
                <div class="sa-ligne-info"><span>Dépenses ponctuelles</span><span>${argent(c.ponctuels)}</span></div>
                <div class="sa-ligne-info"><span>Coût annuel constaté</span><span>${argent(c.annuel_constate)}</span></div>
              </div>
              <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
                <a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="#/finance/rentabilite">Rentabilité</a>
                <a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="#/finance/seuil">Seuil de rentabilité</a>
                <a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="#/finance/previsions">Prévisions</a>
              </div>
            </div>
          </div>
        </section>

        ${bandeauManquant(d.donnees_manquantes)}`;
    }
  });

  /* ======================================================================
     2. Rentabilité
     ====================================================================== */

  SA.enregistrerVue('finance/rentabilite', {
    titre: 'Rentabilité',
    sousTitre: 'Quelle offre et quelle école rapportent réellement.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squeletteCartes(6) + ui.squelette(4, 60);

      const d = await SA.api(SA.url('/super-admin/finance/rentabilite', { mois: params.mois }));
      deviseCourante = d.devise_reference || 'USD';
      const s = d.synthese || {};
      const ch = d.churn || {};

      const cartes = [
        { valeur: argent(s.revenu_total), etiquette: 'Revenu mensuel (MRR)', icone: '💵' },
        { valeur: argent(s.cout_total), etiquette: 'Coûts du mois', ton: 'attention', icone: '💸' },
        { valeur: argentSigne(s.benefice_brut), etiquette: 'Bénéfice brut', ton: s.benefice_brut < 0 ? 'danger' : 'succes', icone: '⚖️' },
        { valeur: pourcent(s.marge), etiquette: 'Marge', icone: '%' },
        { valeur: argent(s.revenu_moyen_par_ecole), etiquette: 'Revenu moyen / école', icone: '🏫' },
        { valeur: argent(s.cout_moyen_par_ecole), etiquette: 'Coût moyen / école', icone: '🧾' },
        {
          valeur: ch.mesurable ? pourcent(ch.taux_mensuel, 2) : '—',
          etiquette: 'Churn mensuel',
          detail: ch.mesurable ? `${fmt.nombre(ch.ecoles_perdues)} école(s) perdue(s)` : esc(ch.raison || ''),
          ton: ch.mesurable && ch.taux_mensuel > 5 ? 'danger' : null, icone: '📉'
        },
        {
          valeur: s.lifetime_value === null ? '—' : argent(s.lifetime_value),
          etiquette: 'Lifetime value (LTV)',
          detail: s.cout_acquisition_client === null ? 'CAC non disponible' : `CAC ${fmt.decimal(s.cout_acquisition_client, 2)}`,
          icone: '♾️'
        }
      ];

      const colonnesOffres = [
        { cle: 'plan_nom', titre: 'Offre' },
        { cle: 'nb_ecoles', titre: 'Écoles', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb_ecoles) },
        { cle: 'nb_eleves', titre: 'Élèves', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb_eleves) },
        { cle: 'revenu', titre: 'Revenu', classe: 'sa-num', rendu: (l) => argent(l.revenu) },
        { cle: 'cout', titre: 'Coût', classe: 'sa-num', rendu: (l) => argent(l.cout) },
        { cle: 'marge', titre: 'Marge', classe: 'sa-num', rendu: (l) => argentSigne(l.marge) },
        { cle: 'marge_pourcentage', titre: '%', classe: 'sa-num', rendu: (l) => pourcent(l.marge_pourcentage) }
      ];

      const colonnesEcoles = [
        { cle: 'ecole_nom', titre: 'École', rendu: (l) => `${esc(l.ecole_nom)}${l.en_periode_essai ? ' ' + ui.badge('essai', 'info') : ''}` },
        { cle: 'plan_nom', titre: 'Offre', rendu: (l) => l.plan_nom ? esc(l.plan_nom) : '<span class="sa-muet">aucune</span>' },
        { cle: 'nb_eleves', titre: 'Élèves', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb_eleves) },
        { cle: 'revenu_mensuel', titre: 'Revenu', classe: 'sa-num', rendu: (l) => argent(l.revenu_mensuel) },
        { cle: 'cout_total', titre: 'Coût', classe: 'sa-num', rendu: (l) => argent(l.cout_total) },
        { cle: 'marge', titre: 'Marge', classe: 'sa-num', rendu: (l) => argentSigne(l.marge) },
        { cle: 'marge_pourcentage', titre: '%', classe: 'sa-num', rendu: (l) => pourcent(l.marge_pourcentage) }
      ];

      const limites = (d.methode && d.methode.limites) || [];

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-barre-filtres">
            <label class="sa-champ-bloc" style="max-width:200px"><span>Mois</span>
              <input type="month" class="sa-champ sa-champ-date" id="filtre-mois" value="${esc(d.mois)}" />
            </label>
          </div>
          <div class="sa-grille-stats">${cartes.map(ui.carteStat).join('')}</div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Rentabilité par offre</h2>
          ${ui.tableau({ colonnes: colonnesOffres, lignes: d.par_offre, vide: 'Aucune offre souscrite' })}
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">
            Rentabilité par école
            <span class="sa-annexe">les moins rentables en premier</span>
          </h2>
          ${ui.tableau({ colonnes: colonnesEcoles, lignes: d.par_ecole, vide: 'Aucune école' })}
        </section>

        <section class="sa-section">
          <div class="sa-encart-info">
            <div class="sa-encart-titre">Comment ces chiffres sont obtenus</div>
            <ul class="sa-encart-liste">
              <li>${esc(d.methode && d.methode.repartition)}</li>
              <li>${esc(d.methode && d.methode.api)}</li>
              ${limites.map((l) => `<li>${esc(l)}</li>`).join('')}
            </ul>
          </div>
        </section>`;

      const champMois = document.getElementById('filtre-mois');
      if (champMois) champMois.addEventListener('change', () => SA.majParams({ mois: champMois.value }));
    }
  });

  /* ======================================================================
     3. Seuil de rentabilité
     ====================================================================== */

  SA.enregistrerVue('finance/seuil', {
    titre: 'Seuil de rentabilité',
    sousTitre: "Combien d'écoles pour couvrir tous les coûts.",

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(4, 80);

      const d = await SA.api(SA.url('/super-admin/finance/seuil-rentabilite', {
        cout_fixe: params.cout_fixe, prix_moyen: params.prix_moyen, cout_variable_ecole: params.cout_variable_ecole
      }));
      deviseCourante = d.devise_reference || 'USD';
      const p = d.parametres || {};
      const r = d.resultat || {};

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-grille-2">
            <div class="sa-panneau">
              <h3 class="sa-section-titre">Hypothèses</h3>
              <p class="sa-note">Modifiez une valeur pour simuler. Les champs vides reprennent les données réelles.</p>
              <label class="sa-champ-bloc"><span>Coûts fixes mensuels (${esc(deviseCourante)})</span>
                <input class="sa-champ" type="number" step="0.01" min="0" id="sim-fixe" value="${esc(p.cout_fixe_mensuel)}" /></label>
              <label class="sa-champ-bloc"><span>Prix moyen par école (${esc(deviseCourante)})</span>
                <input class="sa-champ" type="number" step="0.01" min="0" id="sim-prix" value="${esc(p.prix_moyen_par_ecole)}" /></label>
              <label class="sa-champ-bloc"><span>Coût variable par école (${esc(deviseCourante)})</span>
                <input class="sa-champ" type="number" step="0.01" min="0" id="sim-variable" value="${esc(p.cout_variable_par_ecole)}" /></label>
              <div style="display:flex;gap:8px;margin-top:10px">
                <button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="sim-lancer">Recalculer</button>
                <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="sim-reinit">Données réelles</button>
              </div>
              ${p.simulation ? '<p class="sa-note">Vous consultez une simulation, pas les valeurs mesurées.</p>' : ''}
            </div>

            <div class="sa-panneau">
              <h3 class="sa-section-titre">Résultat</h3>
              ${r.atteignable ? `
                <div class="sa-chiffre-cle">
                  <div class="sa-chiffre-cle-valeur">${fmt.nombre(r.ecoles_necessaires)}</div>
                  <div class="sa-chiffre-cle-libelle">écoles nécessaires</div>
                </div>
                <div class="sa-liste-infos">
                  <div class="sa-ligne-info"><span>Écoles actuelles</span><span>${fmt.nombre(r.ecoles_actuelles)}</span></div>
                  <div class="sa-ligne-info"><span>Écart</span><span>${r.ecart > 0 ? `il en manque <strong>${fmt.nombre(r.ecart)}</strong>` : `<span class="sa-positif">seuil dépassé de ${fmt.nombre(Math.abs(r.ecart))}</span>`}</span></div>
                  <div class="sa-ligne-info"><span>Marge unitaire</span><span>${argent(r.marge_unitaire)}</span></div>
                  <div class="sa-ligne-info"><span>CA au seuil</span><span>${argent(r.chiffre_affaires_au_seuil)}</span></div>
                  <div class="sa-ligne-info"><span>Couverture actuelle des coûts</span><span>${pourcent(r.taux_couverture)}</span></div>
                </div>
                <div style="margin-top:14px">
                  ${graphe.anneau({
                    valeur: Math.min(100, Number(r.taux_couverture) || 0), max: 100,
                    libelle: 'couverture', unite: '%',
                    ton: r.seuil_atteint ? 'succes' : (r.taux_couverture || 0) > 60 ? 'attention' : 'danger'
                  })}
                </div>`
              : `<div class="sa-encart-alerte"><strong>Seuil hors d'atteinte.</strong> ${esc(d.explication)}</div>`}
            </div>
          </div>
          ${r.atteignable ? `<p class="sa-note">${esc(d.explication)}</p>` : ''}
        </section>

        <section class="sa-section">
          <div class="sa-encart-info">
            <div class="sa-encart-titre">Origine des valeurs</div>
            <ul class="sa-encart-liste">
              ${Object.entries(d.sources || {}).map(([k, v]) => `<li><strong>${esc(k.replace(/_/g, ' '))}</strong> — ${esc(v)}</li>`).join('')}
            </ul>
          </div>
        </section>`;

      const lire = (id) => {
        const el = document.getElementById(id);
        return el && el.value !== '' ? el.value : undefined;
      };
      const btn = document.getElementById('sim-lancer');
      if (btn) btn.addEventListener('click', () => SA.majParams({
        cout_fixe: lire('sim-fixe'), prix_moyen: lire('sim-prix'), cout_variable_ecole: lire('sim-variable')
      }));
      const btnR = document.getElementById('sim-reinit');
      if (btnR) btnR.addEventListener('click', () => SA.naviguer('finance/seuil'));
    }
  });

  /* ======================================================================
     4. Prévisions
     ====================================================================== */

  SA.enregistrerVue('finance/previsions', {
    titre: 'Prévisions',
    sousTitre: 'Trois scénarios, hypothèses affichées.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(3, 140);

      const d = await SA.api(SA.url('/super-admin/finance/previsions', { croissance: params.croissance }));
      deviseCourante = d.devise_reference || 'USD';
      const dep = d.point_de_depart || {};
      const fi = d.fiabilite || {};

      const ordre = ['prudent', 'normal', 'optimiste'];
      const libelles = { prudent: 'Prudent', normal: 'Normal', optimiste: 'Optimiste' };

      const colonnes = [
        { cle: 'horizon_mois', titre: 'Horizon', rendu: (l) => `${l.horizon_mois} mois` },
        { cle: 'ecoles', titre: 'Écoles', classe: 'sa-num', rendu: (l) => fmt.nombre(l.ecoles) },
        { cle: 'mrr', titre: 'MRR', classe: 'sa-num', rendu: (l) => argent(l.mrr) },
        { cle: 'arr', titre: 'ARR', classe: 'sa-num', rendu: (l) => argent(l.arr) },
        { cle: 'couts_mensuels', titre: 'Coûts', classe: 'sa-num', rendu: (l) => argent(l.couts_mensuels) },
        { cle: 'benefice_mensuel', titre: 'Bénéfice', classe: 'sa-num', rendu: (l) => argentSigne(l.benefice_mensuel) },
        { cle: 'marge', titre: 'Marge', classe: 'sa-num', rendu: (l) => pourcent(l.marge) }
      ];

      conteneur.innerHTML = `
        <section class="sa-section">
          <h2 class="sa-section-titre">Point de départ — ${esc(moisLisible(dep.mois))}</h2>
          <div class="sa-grille-stats">
            ${ui.carteStat({ valeur: fmt.nombre(dep.ecoles_payantes), etiquette: 'Écoles payantes', icone: '🏫' })}
            ${ui.carteStat({ valeur: argent(dep.prix_moyen), etiquette: 'Prix moyen', icone: '🏷️' })}
            ${ui.carteStat({ valeur: argent(dep.mrr), etiquette: 'MRR', icone: '🔁' })}
            ${ui.carteStat({ valeur: argent(dep.couts_mensuels), etiquette: 'Coûts mensuels', icone: '💸' })}
          </div>
        </section>

        <section class="sa-section">
          <div class="sa-barre-filtres">
            <label class="sa-champ-bloc" style="max-width:280px">
              <span>Croissance mensuelle du scénario « normal » (%)</span>
              <input class="sa-champ" type="number" step="0.5" min="0" max="100" id="prev-croissance"
                     value="${esc(d.scenarios && d.scenarios.normal ? d.scenarios.normal.hypotheses.croissance_mensuelle_pourcent : '')}" />
            </label>
            <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="prev-appliquer" style="align-self:flex-end">Appliquer</button>
          </div>
        </section>

        ${ordre.map((cle) => {
          const sc = (d.scenarios || {})[cle];
          if (!sc) return '';
          const h = sc.hypotheses;
          return `<section class="sa-section">
            <h2 class="sa-section-titre">
              Scénario ${esc(libelles[cle])}
              <span class="sa-annexe">croissance ${esc(h.croissance_mensuelle_pourcent)} %/mois ·
                churn ${esc(h.churn_mensuel_pourcent)} %/mois ·
                inflation coûts ${esc(h.inflation_couts_annuelle_pourcent)} %/an</span>
            </h2>
            ${ui.tableau({ colonnes, lignes: sc.projections, vide: 'Aucune projection' })}
          </section>`;
        }).join('')}

        <section class="sa-section">
          <div class="sa-encart-info">
            <div class="sa-encart-titre">Fiabilité de ces projections</div>
            <ul class="sa-encart-liste">
              <li><strong>Churn</strong> — ${esc(fi.origine_churn)}</li>
              <li><strong>Croissance</strong> — ${esc(fi.origine_croissance)}</li>
              <li>${esc(fi.avertissement)}</li>
            </ul>
          </div>
        </section>`;

      const btn = document.getElementById('prev-appliquer');
      if (btn) btn.addEventListener('click', () => {
        const v = document.getElementById('prev-croissance');
        SA.majParams({ croissance: v && v.value !== '' ? v.value : undefined });
      });
    }
  });

  /* ======================================================================
     5. Alertes financières
     ====================================================================== */

  SA.enregistrerVue('finance/alertes', {
    titre: 'Alertes financières',
    sousTitre: 'Ce qui demande une décision maintenant.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(6, 62);

      const d = await SA.api('/super-admin/finance/alertes');
      const co = d.compteurs || {};
      const icones = { critique: '🔴', avertissement: '🟠', info: '🔵' };

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-grille-stats">
            ${ui.carteStat({ valeur: fmt.nombre(co.critiques), etiquette: 'Critiques', ton: co.critiques ? 'danger' : 'succes', icone: '🔴' })}
            ${ui.carteStat({ valeur: fmt.nombre(co.avertissements), etiquette: 'Avertissements', ton: co.avertissements ? 'attention' : null, icone: '🟠' })}
            ${ui.carteStat({ valeur: fmt.nombre(co.informations), etiquette: 'Informations', icone: '🔵' })}
          </div>
        </section>

        <section class="sa-section">
          ${(d.alertes && d.alertes.length) ? `
            <div class="sa-conteneur-tableau">
              ${d.alertes.map((a) => `
                <div class="sa-resultat">
                  <span class="sa-resultat-icone">${icones[a.niveau] || '•'}</span>
                  <div class="sa-resultat-corps">
                    <div class="sa-resultat-titre">${esc(a.titre)}</div>
                    <div class="sa-resultat-detail">${esc(a.detail)}</div>
                  </div>
                  ${a.lien ? `<a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="#/${esc(a.lien)}">Voir</a>` : ''}
                </div>`).join('')}
            </div>`
          : ui.etatVide('Aucune alerte', 'Les seuils configurés ne sont franchis nulle part.')}
        </section>

        <section class="sa-section">
          <div class="sa-encart-info">
            <div class="sa-encart-titre">Seuils appliqués</div>
            <ul class="sa-encart-liste">
              <li>Marge considérée comme faible en dessous de <strong>${esc(d.seuils.marge_faible)} %</strong></li>
              <li>Hausse des coûts API signalée au-delà de <strong>${esc(d.seuils.hausse_cout_api)} %</strong> d'un mois sur l'autre</li>
              <li>Renouvellements annoncés <strong>${esc(d.seuils.prealerte_renouvellement_jours)} jours</strong> à l'avance</li>
              <li>Budget signalé à partir de <strong>${esc(d.seuils.budget)} %</strong> consommés</li>
            </ul>
            <p class="sa-note">Ces seuils se modifient dans <a href="#/configuration">Configuration</a>, catégorie « finance ».</p>
          </div>
        </section>`;
    }
  });

  /* ======================================================================
     6. Coût des fonctionnalités
     ====================================================================== */

  SA.enregistrerVue('finance/fonctionnalites', {
    titre: 'Coût des fonctionnalités',
    sousTitre: 'Ce que chaque grande fonction consomme.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(4, 90);

      const d = await SA.api(SA.url('/super-admin/finance/cout-fonctionnalites', { mois: params.mois }));
      deviseCourante = d.devise_reference || 'USD';

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-barre-filtres">
            <label class="sa-champ-bloc" style="max-width:200px"><span>Mois</span>
              <input type="month" class="sa-champ sa-champ-date" id="filtre-mois" value="${esc(d.mois)}" /></label>
          </div>
          <div class="sa-grille-2">
            ${(d.fonctionnalites || []).map((f) => `
              <div class="sa-panneau">
                <h3 class="sa-section-titre">${esc(f.libelle)}</h3>
                <div class="sa-liste-infos">
                  <div class="sa-ligne-info"><span>Volume</span><span>${f.volume === null ? '<span class="sa-muet">—</span>' : `${fmt.nombre(f.volume)} ${esc(f.unite)}`}</span></div>
                  <div class="sa-ligne-info"><span>Coût estimé</span><span>${argent(f.cout_estime)}</span></div>
                  <div class="sa-ligne-info"><span>Coût unitaire</span><span>${f.cout_unitaire === null ? '<span class="sa-muet">—</span>' : argent(f.cout_unitaire, 4)}</span></div>
                </div>
                <p class="sa-note"><strong>Source :</strong> ${esc(f.source)}</p>
                ${f.manquant ? `<p class="sa-note sa-manquant">${esc(f.manquant)}</p>` : ''}
              </div>`).join('')}
          </div>
          <p class="sa-note">${esc(d.note)}</p>
        </section>`;

      const champMois = document.getElementById('filtre-mois');
      if (champMois) champMois.addEventListener('change', () => SA.majParams({ mois: champMois.value }));
    }
  });

  /* ======================================================================
     7. Journal financier
     ====================================================================== */

  SA.enregistrerVue('finance/journal', {
    titre: 'Journal financier',
    sousTitre: 'Chaque décision financière, avec son avant, son après et son motif.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(10, 46);

      const d = await SA.api(SA.url('/super-admin/finance/journal', {
        page: params.page, action: params.action, depuis: params.depuis, jusqu: params.jusqu
      }));

      const valeurLisible = (v) => {
        if (v === null || v === undefined) return '<span class="sa-muet">—</span>';
        if (typeof v !== 'object') return esc(String(v));
        return Object.entries(v).map(([k, x]) =>
          `<span class="sa-mono">${esc(k)}: ${esc(x === null ? '—' : String(x))}</span>`).join(' · ');
      };

      const colonnes = [
        { cle: 'created_at', titre: 'Date', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
        { cle: 'action', titre: 'Action', rendu: (l) => ui.badge(String(l.action).replace(/[._]/g, ' '), 'neutre') },
        { cle: 'libelle', titre: 'Objet', rendu: (l) => esc(l.libelle || l.entite) },
        { cle: 'ancienne_valeur', titre: 'Avant', rendu: (l) => valeurLisible(l.ancienne_valeur) },
        { cle: 'nouvelle_valeur', titre: 'Après', rendu: (l) => valeurLisible(l.nouvelle_valeur) },
        { cle: 'raison', titre: 'Motif', rendu: (l) => l.raison ? esc(l.raison) : '<span class="sa-muet">—</span>' },
        { cle: 'utilisateur_nom', titre: 'Par', rendu: (l) => esc(l.utilisateur_nom || l.utilisateur_email || '—') }
      ];

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-barre-filtres">
            <label class="sa-champ-bloc"><span>Famille d'action</span>
              <select class="sa-champ" id="filtre-action">
                <option value="">Toutes</option>
                ${(d.familles || []).map((f) => `<option value="${esc(f)}" ${params.action === f ? 'selected' : ''}>${esc(f)}</option>`).join('')}
              </select></label>
            <label class="sa-champ-bloc"><span>Depuis</span>
              <input type="date" class="sa-champ sa-champ-date" id="filtre-depuis" value="${esc(params.depuis || '')}" /></label>
            <label class="sa-champ-bloc"><span>Jusqu'au</span>
              <input type="date" class="sa-champ sa-champ-date" id="filtre-jusqu" value="${esc(params.jusqu || '')}" /></label>
          </div>
          ${ui.tableau({ colonnes, lignes: d.donnees, vide: 'Aucune écriture financière' })}
          ${ui.pagination(d.pagination)}
        </section>`;

      ['action', 'depuis', 'jusqu'].forEach((cle) => {
        const el = document.getElementById(`filtre-${cle}`);
        if (el) el.addEventListener('change', () => SA.majParams({ [cle]: el.value || undefined, page: 1 }));
      });
      conteneur.querySelectorAll('[data-page]').forEach((b) =>
        b.addEventListener('click', () => SA.majParams({ page: b.dataset.page })));
    }
  });

  /* ======================================================================
     8. Exports financiers
     ====================================================================== */

  SA.enregistrerVue('finance/exports', {
    titre: 'Exports financiers',
    sousTitre: 'CSV, Excel, PDF imprimable ou JSON.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(5, 60);
      const d = await SA.api('/super-admin/finance/exports');

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-conteneur-tableau">
            ${(d.rapports || []).map((r) => `
              <div class="sa-resultat">
                <span class="sa-resultat-icone">📄</span>
                <div class="sa-resultat-corps">
                  <div class="sa-resultat-titre">${esc(r.libelle)}</div>
                  <div class="sa-resultat-detail sa-mono">${esc(r.cle)}</div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${(d.formats || []).map((f) => `
                    <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
                            data-rapport="${esc(r.cle)}" data-format="${esc(f)}">${esc(f.toUpperCase())}</button>`).join('')}
                </div>
              </div>`).join('')}
          </div>
          <p class="sa-note">
            Chaque export est journalisé : la date, le format et l'auteur sont enregistrés au journal financier.
            Le format PDF ouvre une page prête à imprimer.
          </p>
        </section>`;

      conteneur.querySelectorAll('[data-rapport]').forEach((b) => {
        b.addEventListener('click', async () => {
          const { rapport, format } = b.dataset;
          const chemin = `/super-admin/finance/exports/${rapport}?format=${format}`;
          b.disabled = true;
          try {
            if (format === 'pdf') {
              const html = await SA.api(chemin);
              const fenetre = window.open('', '_blank');
              if (fenetre) { fenetre.document.write(html); fenetre.document.close(); }
              else SA.toast('Le navigateur a bloqué la fenêtre d\'impression.', 'attention');
            } else if (format === 'json') {
              const donnees = await SA.api(chemin);
              const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' });
              const lien = document.createElement('a');
              lien.href = URL.createObjectURL(blob);
              lien.download = `ardoise-${rapport}.json`;
              lien.click();
              setTimeout(() => URL.revokeObjectURL(lien.href), 4000);
            } else {
              await SA.telecharger(chemin, `ardoise-${rapport}.${format}`);
            }
            SA.toast('Export généré.', 'succes');
          } catch (e) {
            SA.toast(e.message || 'Export impossible.', 'danger');
          } finally {
            b.disabled = false;
          }
        });
      });
    }
  });

  /* ======================================================================
     9. Permissions financières
     ====================================================================== */

  SA.enregistrerVue('finance/permissions', {
    titre: 'Permissions financières',
    sousTitre: 'Qui peut agir sur la finance, qui ne peut que consulter.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(5, 56);
      const d = await SA.api('/super-admin/finance/permissions');

      const colonnes = [
        { cle: 'nom', titre: 'Super Administrateur', rendu: (l) => `${esc(l.nom || '—')}<div class="sa-muet sa-mono">${esc(l.email)}</div>` },
        { cle: 'niveau', titre: 'Accès finance', rendu: (l) => ui.badge(l.niveau === 'lecture' ? 'lecture seule' : 'complet', l.niveau === 'lecture' ? 'attention' : 'succes') },
        { cle: 'note', titre: 'Note', rendu: (l) => l.note ? esc(l.note) : '<span class="sa-muet">—</span>' },
        { cle: 'updated_at', titre: 'Depuis', rendu: (l) => l.updated_at ? esc(fmt.relatif(l.updated_at)) : '<span class="sa-muet">par défaut</span>' },
        {
          cle: 'actions', titre: '', rendu: (l) => `
            <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
                    data-utilisateur="${esc(l.utilisateur_id)}"
                    data-niveau="${l.niveau === 'lecture' ? 'complet' : 'lecture'}"
                    data-nom="${esc(l.nom || l.email)}">
              ${l.niveau === 'lecture' ? 'Donner l\'accès complet' : 'Passer en lecture seule'}
            </button>`
        }
      ];

      conteneur.innerHTML = `
        <section class="sa-section">
          ${ui.tableau({ colonnes, lignes: d.donnees, vide: 'Aucun Super Administrateur' })}
          <div class="sa-encart-info" style="margin-top:16px">
            <div class="sa-encart-titre">Ce que chaque niveau autorise</div>
            <ul class="sa-encart-liste">
              ${(d.niveaux || []).map((n) => `<li><strong>${esc(n.libelle)}</strong> — ${esc(n.description)}</li>`).join('')}
              <li>${esc(d.note)}</li>
              <li>Les clés d'API, jetons et secrets ne sont jamais affichés, quel que soit le niveau.</li>
            </ul>
          </div>
        </section>`;

      conteneur.querySelectorAll('[data-utilisateur]').forEach((b) => {
        b.addEventListener('click', async () => {
          const { utilisateur, niveau, nom } = b.dataset;
          const ok = await SA.confirmer({
            titre: niveau === 'lecture' ? 'Restreindre l\'accès financier' : 'Rendre l\'accès complet',
            message: niveau === 'lecture'
              ? `${nom} ne pourra plus créer ni modifier d'offre, de promotion, de dépense ou de tarif. La consultation reste possible.`
              : `${nom} retrouvera le droit d'agir sur toute la gestion commerciale et financière.`,
            libelleValider: 'Confirmer',
            danger: niveau === 'lecture'
          });
          if (!ok) return;
          try {
            await SA.api(`/super-admin/finance/permissions/${utilisateur}`, {
              method: 'PUT',
              body: JSON.stringify({ niveau, confirmation: true })
            });
            SA.toast('Niveau d\'accès mis à jour.', 'succes');
            SA.rafraichirVue();
          } catch (e) {
            SA.toast(e.message || 'Modification impossible.', 'danger');
          }
        });
      });
    }
  });

  /* Exposé aux autres modules de vues : ils partagent le même formatage
     monétaire, et une deuxième implémentation divergerait au premier arrondi. */
  SA.finance = {
    argent, argentSigne, pourcent, moisLisible, points,
    bandeauLecture, bandeauManquant,
    devise(v) { if (v) deviseCourante = v; return deviseCourante; }
  };
})();
