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

  /* ======================================================================
     Commandes locales
     ====================================================================== */

  const COMMANDES = [
    { groupe: 'Control Center', icone: '◎', libelle: "Vue d'ensemble", route: 'cc' },
    { groupe: 'Control Center', icone: '⚠', libelle: 'Écarts constatés', route: 'cc/constats' },
    { groupe: 'Control Center', icone: '⚠', libelle: 'Écarts à traiter immédiatement', route: 'cc/constats', params: { urgence: 'immediat' } },
    { groupe: 'Control Center', icone: '🐞', libelle: 'Suivi des erreurs', route: 'cc/erreurs' },
    { groupe: 'Control Center', icone: '📜', libelle: 'Explorateur de journaux', route: 'cc/logs' },
    { groupe: 'Control Center', icone: '📜', libelle: 'Journaux de sécurité', route: 'cc/logs', params: { categorie: 'SECURITY' } },
    { groupe: 'Control Center', icone: '📜', libelle: 'Journaux de paiement', route: 'cc/logs', params: { categorie: 'PAYMENT' } },
    { groupe: 'Control Center', icone: '⚡', libelle: 'Performance', route: 'cc/performance' },
    { groupe: 'Control Center', icone: '🚨', libelle: 'Incidents', route: 'cc/incidents' },
    { groupe: 'Control Center', icone: '🔔', libelle: 'Alertes', route: 'cc/alertes' },
    { groupe: 'Control Center', icone: '🩺', libelle: 'Vérifications de santé', route: 'cc/verifications' },

    { groupe: 'Audit', icone: '📐', libelle: 'Règles métier', route: 'cc/regles' },
    { groupe: 'Audit', icone: '🔑', libelle: 'Matrice des permissions', route: 'cc/matrice' },
    { groupe: 'Audit', icone: '🔍', libelle: 'Lancer les audits', route: 'cc/audits' },
    { groupe: 'Audit', icone: '🗺', libelle: 'Carte des routes', route: 'cc/routes' },
    { groupe: 'Audit', icone: '👤', libelle: 'Ce que peut faire le Directeur', route: 'cc/roles/directeur' },
    { groupe: 'Audit', icone: '👤', libelle: 'Ce que peut faire le Comptable', route: 'cc/roles/comptable' },
    { groupe: 'Audit', icone: '👤', libelle: 'Ce que peut faire le Professeur', route: 'cc/roles/professeur' },
    { groupe: 'Audit', icone: '👤', libelle: 'Ce que peut faire le Titulaire', route: 'cc/roles/titulaire' },

    { groupe: 'IA', icone: '🤖', libelle: "Demander à l'IA", route: 'cc/copilote' },
    { groupe: 'IA', icone: '🧭', libelle: 'Conseil stratégique', route: 'cc/conseil' },
    { groupe: 'IA', icone: '🔬', libelle: 'Analyse de cause racine', route: 'cc/cause-racine' },
    { groupe: 'IA', icone: '🩹', libelle: 'Correctifs proposés', route: 'cc/correctifs' },
    { groupe: 'IA', icone: '📄', libelle: 'Rapports automatiques', route: 'cc/rapports' },
    { groupe: 'IA', icone: '💸', libelle: "Coût de l'IA", route: 'cc/couts-ia' },

    { groupe: 'Système', icone: '🚩', libelle: 'Drapeaux de fonctionnalités', route: 'cc/drapeaux' },
    { groupe: 'Système', icone: '🛑', libelle: 'Mode maintenance', route: 'cc/maintenance' },
    { groupe: 'Système', icone: '📘', libelle: 'Journal des décisions', route: 'cc/decisions' },
    { groupe: 'Système', icone: '📚', libelle: 'Base de connaissance', route: 'cc/connaissance' },
    { groupe: 'Système', icone: '📦', libelle: 'Dépendances', route: 'cc/dependances' },
    { groupe: 'Système', icone: '🗄', libelle: 'Inspecteur de base', route: 'cc/base' },
    { groupe: 'Système', icone: '☁', libelle: 'Infrastructure et coûts', route: 'cc/infrastructure' },

    { groupe: 'Espace existant', icone: '📊', libelle: 'Tableau de bord', route: 'tableau-de-bord' },
    { groupe: 'Espace existant', icone: '🏫', libelle: 'Toutes les écoles', route: 'ecoles' },

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

    { groupe: 'Espace existant', icone: '👥', libelle: 'Utilisateurs', route: 'utilisateurs' },
    { groupe: 'Espace existant', icone: '💰', libelle: 'Finance', route: 'finance' },
    { groupe: 'Espace existant', icone: '💳', libelle: 'Offres', route: 'offres' },
    { groupe: 'Espace existant', icone: '🩺', libelle: 'Santé de la plateforme', route: 'sante' },
    { groupe: 'Espace existant', icone: '🔐', libelle: 'Sécurité', route: 'securite' },
    { groupe: 'Espace existant', icone: '🎫', libelle: 'Support', route: 'support' }
  ];

  /** Correspondance approximative : chaque terme saisi doit apparaître. */
  function correspond(texte, requete) {
    const t = texte.toLowerCase();
    return requete.toLowerCase().split(/\s+/).filter(Boolean).every((mot) => t.includes(mot));
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
        <input id="cc-pal-champ" placeholder="Aller à… ou rechercher une erreur, un écart, une règle, une route"
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
        const locales = COMMANDES.filter((c) => correspond(`${c.libelle} ${c.groupe}`, q));
        afficher([...locales, ...distants]);
      } catch { /* la recherche est un service, pas une obligation */ }
    }, 260);

    champ.addEventListener('input', () => {
      const q = champ.value.trim();
      afficher(q ? COMMANDES.filter((c) => correspond(`${c.libelle} ${c.groupe}`, q)) : COMMANDES);
      if (q.length >= 3) chercher(q);
    });

    voile.addEventListener('click', (ev) => { if (ev.target === voile) fermer(); });
    document.addEventListener('keydown', surTouche, true);

    afficher(COMMANDES);
    champ.focus();
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
