/* ==========================================================================
   ARDOISE CONTROL CENTER — PALETTE DE COMMANDES ET RECHERCHE SYSTÈME
   --------------------------------------------------------------------------
   Ctrl/Cmd + K ouvre une palette : on tape trois lettres, on arrive.

   POURQUOI CELA COMPTE ICI PLUS QU'AILLEURS
   -----------------------------------------
   L'espace Super Admin compte désormais une quarantaine d'écrans. Une barre
   latérale de quarante entrées ne se parcourt plus : elle se subit. La palette
   rend la profondeur de l'arborescence indolore — on n'a plus besoin de savoir
   OÙ se trouve « constats réapparus », seulement de savoir qu'on le cherche.

   DEUX NIVEAUX
   ------------
     · commandes locales — navigation et actions, instantanées, sans réseau ;
     · recherche serveur — constats, incidents, erreurs, journaux, règles,
       routes. Déclenchée seulement à partir de trois caractères, et avec un
       anti-rebond : sans cela, chaque frappe déclencherait six requêtes.

   La recherche porte sur le SYSTÈME. Chercher une école ou un élève reste dans
   l'espace Écoles, dont les consultations sont tracées séparément.
   ========================================================================== */

(function () {
  'use strict';

  const { esc } = SA;

  /**
   * L'écran de suppression est isolé dans son propre module et chargé seulement
   * à la demande. Cela évite d'alourdir le démarrage du Super Admin pour une
   * action rare et destructive.
   */
  async function ouvrirSuppressionEcole() {
    try {
      const module = await import('./super-admin-suppression-ecoles.js');
      await module.ouvrirSuppressionEcole();
    } catch (erreur) {
      console.error('Impossible de charger la suppression école:', erreur);
      SA.toast("Impossible d'ouvrir l'outil de suppression.", 'erreur');
    }
  }

  /* ======================================================================
     Commandes locales
     ====================================================================== */

  const COMMANDES = [
    { groupe: 'Pilotage', icone: '◎', libelle: 'Tour de contrôle', route: 'tableau-de-bord' },
    { groupe: 'Supervision', icone: '◎', libelle: 'Vue technique', route: 'cc' },
    { groupe: 'Supervision', icone: '⚠', libelle: 'Écarts constatés', route: 'cc/constats' },
    { groupe: 'Supervision', icone: '⚠', libelle: 'Écarts à traiter immédiatement', route: 'cc/constats', params: { urgence: 'immediat' } },
    { groupe: 'Supervision', icone: '🐞', libelle: 'Suivi des erreurs', route: 'cc/erreurs' },
    { groupe: 'Supervision', icone: '📜', libelle: 'Explorateur de journaux', route: 'cc/logs' },
    { groupe: 'Supervision', icone: '📜', libelle: 'Journaux de sécurité', route: 'cc/logs', params: { categorie: 'SECURITY' } },
    { groupe: 'Supervision', icone: '📜', libelle: 'Journaux de paiement', route: 'cc/logs', params: { categorie: 'PAYMENT' } },
    { groupe: 'Supervision', icone: '⚡', libelle: 'Performance', route: 'cc/performance' },
    { groupe: 'Supervision', icone: '🚨', libelle: 'Incidents', route: 'cc/incidents' },
    { groupe: 'Supervision', icone: '🔔', libelle: 'Alertes', route: 'cc/alertes' },
    { groupe: 'Supervision', icone: '🩺', libelle: 'Vérifications de santé', route: 'cc/verifications' },

    { groupe: 'Qualité & audit', icone: '📐', libelle: 'Règles métier', route: 'cc/regles' },
    { groupe: 'Qualité & audit', icone: '🔑', libelle: 'Matrice des permissions', route: 'cc/matrice' },
    { groupe: 'Qualité & audit', icone: '🔍', libelle: 'Lancer les audits', route: 'cc/audits' },
    { groupe: 'Qualité & audit', icone: '🗺', libelle: 'Carte des routes', route: 'cc/routes' },
    { groupe: 'Qualité & audit', icone: '👤', libelle: 'Ce que peut faire le Directeur', route: 'cc/roles/directeur' },
    { groupe: 'Qualité & audit', icone: '👤', libelle: 'Ce que peut faire le Comptable', route: 'cc/roles/comptable' },
    { groupe: 'Qualité & audit', icone: '👤', libelle: 'Ce que peut faire le Professeur', route: 'cc/roles/professeur' },
    { groupe: 'Qualité & audit', icone: '👤', libelle: 'Ce que peut faire le Titulaire', route: 'cc/roles/titulaire' },

    { groupe: 'Intelligence artificielle', icone: '🤖', libelle: "Demander à l'IA", route: 'cc/copilote' },
    { groupe: 'Intelligence artificielle', icone: '🧭', libelle: 'Conseil stratégique', route: 'cc/conseil' },
    { groupe: 'Intelligence artificielle', icone: '🔬', libelle: 'Analyse de cause racine', route: 'cc/cause-racine' },
    { groupe: 'Intelligence artificielle', icone: '🩹', libelle: 'Correctifs proposés', route: 'cc/correctifs' },
    { groupe: 'Intelligence artificielle', icone: '📄', libelle: 'Rapports automatiques', route: 'cc/rapports' },
    { groupe: 'Intelligence artificielle', icone: '💸', libelle: "Coût de l'IA", route: 'cc/couts-ia' },

    { groupe: 'Configuration', icone: '🚩', libelle: 'Drapeaux de fonctionnalités', route: 'cc/drapeaux' },
    { groupe: 'Configuration', icone: '🛑', libelle: 'Mode maintenance', route: 'cc/maintenance' },
    { groupe: 'Configuration', icone: '📘', libelle: 'Journal des décisions', route: 'cc/decisions' },
    { groupe: 'Configuration', icone: '📚', libelle: 'Base de connaissance (Knowledge Hub)', route: 'ia/connaissance' },
    { groupe: 'Configuration', icone: '📦', libelle: 'Dépendances', route: 'cc/dependances' },
    { groupe: 'Configuration', icone: '🗄', libelle: 'Inspecteur de base', route: 'cc/base' },
    { groupe: 'Configuration', icone: '☁', libelle: 'Infrastructure et coûts', route: 'cc/infrastructure' },


    /* École de test — la seule commande de cette palette qui ÉCRIT.
       ------------------------------------------------------------------
       Les autres entrées naviguent ; celle-ci ouvre un formulaire de
       création. Elle est ici plutôt qu'enfouie dans un menu parce que c'est
       une opération d'exploitation, faite en dépannage, souvent au téléphone
       avec une école bloquée — on la cherche par son nom, pas par son
       emplacement. */
    { groupe: 'Écoles de test', icone: '🧪', libelle: 'Créer une école de test',
      action: () => {
        if (typeof SA.ouvrirEcoleDeTest === 'function') return SA.ouvrirEcoleDeTest();
        SA.naviguer('ecoles', { mode_test: '1' });
      } },
    { groupe: 'Écoles de test', icone: '🧪', libelle: 'Voir les écoles de test',
      route: 'ecoles', params: { mode_test: '1' } },
    { groupe: 'Écoles de test', icone: '🏫', libelle: 'Voir les écoles clientes (hors test)',
      route: 'ecoles', params: { mode_test: '0' } },

    /* Destruction de tenant : volontairement séparée des actions ordinaires.
       La commande ouvre deux étapes de confirmation et le backend réexige la
       phrase exacte ; un clic dans la palette ne peut donc jamais supprimer. */
    { groupe: 'Écoles', icone: '🗑', libelle: 'Supprimer définitivement une école',
      action: ouvrirSuppressionEcole },

  ];

  /**
   * Toutes les commandes : celles écrites ci-dessus (raccourcis filtrés,
   * actions), puis CHAQUE écran déclaré dans le menu, lu par la coque. La
   * palette ne connaissait qu'une quarantaine d'écrans écrits à la main ; elle
   * ignorait les apporteurs, l'IA & modèles, la finance détaillée — c'est-à-dire
   * précisément ceux qu'on ne sait pas où chercher.
   */
  function commandes() {
    const liste = COMMANDES.slice();
    const dejaLa = new Set(COMMANDES.filter((c) => c.route && !c.params).map((c) => c.route));
    const ecrans = (SA.coque && SA.coque.ecrans) ? SA.coque.ecrans() : [];
    ecrans.forEach((e) => {
      if (dejaLa.has(e.route)) return;
      dejaLa.add(e.route);
      liste.push({ groupe: e.groupe, icone: '›', libelle: e.libelle, route: e.route, mots: e.description || '' });
    });
    return liste;
  }

  /** Correspondance approximative, sans tenir compte des accents : chaque terme saisi doit apparaître. */
  const sansAccent = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function correspond(texte, requete) {
    const t = sansAccent(texte);
    return sansAccent(requete).split(/\s+/).filter(Boolean).every((mot) => t.includes(mot));
  }

  /** La recherche dans les DONNÉES des écoles reste dans son écran dédié, dont
   *  les consultations sont tracées : la palette y mène, elle ne la fait pas. */
  function rechercheEcoles(q) {
    return { groupe: 'Données des écoles', icone: '🔎', libelle: `Rechercher « ${q} » dans les écoles, élèves et comptes`,
      route: 'explorer/recherche', params: { q } };
  }

  /* ======================================================================
     Palette
     ====================================================================== */

  let ouverte = null;

  function ouvrir() {
    if (ouverte) return;

    const voile = document.createElement('div');
    voile.className = 'cc-palette-voile';
    voile.innerHTML = `
      <div class="cc-palette" role="dialog" aria-modal="true" aria-label="Palette de commandes">
        <input id="cc-pal-champ" placeholder="Aller à un écran, rechercher une école, une erreur, une règle…"
               autocomplete="off" spellcheck="false">
        <div class="cc-palette-resultats" id="cc-pal-res"></div>
        <div class="cc-palette-pied">
          <span><span class="cc-touche">↑</span><span class="cc-touche">↓</span> naviguer</span>
          <span><span class="cc-touche">↵</span> ouvrir</span>
          <span><span class="cc-touche">Échap</span> fermer</span>
        </div>
      </div>`;

    document.body.appendChild(voile);
    ouverte = voile;

    const champ = voile.querySelector('#cc-pal-champ');
    const zone = voile.querySelector('#cc-pal-res');
    const toutes = commandes();
    let items = [];
    let index = 0;

    function fermer() {
      voile.remove();
      ouverte = null;
      document.removeEventListener('keydown', surTouche, true);
    }

    function afficher(liste) {
      items = liste;
      index = 0;
      if (!liste.length) {
        zone.innerHTML = '<div class="cc-palette-item"><span class="cc-palette-libelle">Aucun résultat</span></div>';
        return;
      }
      zone.innerHTML = liste.map((it, i) => `
        <div class="cc-palette-item${i === 0 ? ' actif' : ''}" data-i="${i}">
          <span class="cc-palette-icone">${esc(it.icone || '›')}</span>
          <span class="cc-palette-libelle">${esc(it.libelle)}</span>
          <span class="cc-palette-groupe">${esc(it.groupe || '')}</span>
        </div>`).join('');

      zone.querySelectorAll('[data-i]').forEach((el) => {
        el.addEventListener('click', () => activer(Number(el.getAttribute('data-i'))));
        el.addEventListener('mousemove', () => marquer(Number(el.getAttribute('data-i'))));
      });
    }

    function marquer(i) {
      index = i;
      zone.querySelectorAll('.cc-palette-item').forEach((el, j) =>
        el.classList.toggle('actif', j === i));
    }

    function activer(i) {
      const it = items[i];
      if (!it) return;
      fermer();
      if (it.action) it.action();
      else SA.naviguer(it.route, it.params);
    }

    function surTouche(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); fermer(); return; }
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        marquer(Math.min(items.length - 1, index + 1));
        const el = zone.querySelectorAll('.cc-palette-item')[index];
        if (el) el.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        marquer(Math.max(0, index - 1));
        const el = zone.querySelectorAll('.cc-palette-item')[index];
        if (el) el.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (ev.key === 'Enter') { ev.preventDefault(); activer(index); }
    }

    /* Recherche serveur, avec anti-rebond. Sans lui, taper « paiement »
       déclencherait huit requêtes balayant six familles de tables chacune. */
    const chercher = SA.antiRebond(async (q) => {
      if (q.length < 3) return;
      try {
        const d = await SA.api(SA.url('/super-admin/control-center/recherche', { q }));
        const r = d.resultats || {};
        const distants = [
          ...(r.constats || []).map((x) => ({
            groupe: 'Écart', icone: '⚠', libelle: x.titre, route: `cc/constats/${x.id}` })),
          ...(r.regles_metier || []).map((x) => ({
            groupe: 'Règle', icone: '📐', libelle: `${x.code} — ${x.titre}`, route: `cc/regles/${x.code}` })),
          ...(r.incidents || []).map((x) => ({
            groupe: 'Incident', icone: '🚨', libelle: `${x.code} — ${x.titre}`, route: `cc/incidents/${x.id}` })),
          ...(r.erreurs || []).map((x) => ({
            groupe: 'Erreur', icone: '🐞', libelle: `${String(x.message).slice(0, 70)} (${x.chemin || ''})`,
            route: `cc/erreurs/${x.id}` })),
          ...(r.routes || []).map((x) => ({
            groupe: 'Route', icone: '🗺', libelle: `${x.route} → ${x.controleur || ''} ${x.fonction || ''}`,
            route: 'cc/routes', params: { q: x.fonction || x.route.split(' ')[1] } })),
          ...(r.journaux || []).map((x) => ({
            groupe: 'Journal', icone: '📜', libelle: String(x.message).slice(0, 80),
            route: 'cc/logs', params: { q: String(x.message).slice(0, 30) } }))
        ];

        // La saisie a pu changer pendant l'appel : on ne remplace la liste que
        // si la requête est encore celle affichée.
        if (champ.value.trim() !== q) return;
        const locales = toutes.filter((c) => correspond(`${c.libelle} ${c.groupe} ${c.mots || ''}`, q));
        afficher([...locales, rechercheEcoles(q), ...distants]);
      } catch { /* la recherche est un service, pas une obligation */ }
    }, 260);

    champ.addEventListener('input', () => {
      const q = champ.value.trim();
      if (!q) { afficher(toutes); return; }
      const locales = toutes.filter((c) => correspond(`${c.libelle} ${c.groupe} ${c.mots || ''}`, q));
      afficher(q.length >= 2 ? [...locales, rechercheEcoles(q)] : locales);
      if (q.length >= 3) chercher(q);
    });

    voile.addEventListener('click', (ev) => { if (ev.target === voile) fermer(); });
    document.addEventListener('keydown', surTouche, true);

    afficher(toutes);
    champ.focus();
  }

  /* ======================================================================
     Action visible sur la liste des écoles
     ====================================================================== */

  const vueEcoles = SA.vues && SA.vues.get('ecoles');
  if (vueEcoles && !vueEcoles.__suppressionEcoleInstallee) {
    const renduEcolesOriginal = vueEcoles.rendu;
    vueEcoles.__suppressionEcoleInstallee = true;

    vueEcoles.rendu = async function (conteneur, params) {
      const resultat = await renduEcolesOriginal.call(this, conteneur, params);
      const actions = document.getElementById('sa-entete-actions');
      if (actions && !actions.querySelector('#btn-supprimer-ecole')) {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.id = 'btn-supprimer-ecole';
        bouton.className = 'sa-bouton sa-bouton-danger';
        bouton.textContent = 'Supprimer une école';
        bouton.addEventListener('click', ouvrirSuppressionEcole);
        actions.insertBefore(bouton, actions.firstChild);
      }
      return resultat;
    };
  }

  /* ======================================================================
     Raccourci clavier
     ====================================================================== */

  document.addEventListener('keydown', (ev) => {
    // Ctrl/Cmd + K. `metaKey` pour macOS, `ctrlKey` ailleurs.
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) {
      ev.preventDefault();
      if (ouverte) { ouverte.remove(); ouverte = null; return; }
      // Inutile — et déroutant — d'ouvrir la palette sur l'écran de connexion.
      if (SA.session && SA.session.connecte && SA.session.connecte()) ouvrir();
    }
  });

  SA.ouvrirPalette = ouvrir;
})();
