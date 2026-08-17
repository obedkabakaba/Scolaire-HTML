/* ==========================================================================
   Ardoise — Gestion des thèmes
   --------------------------------------------------------------------------
   Ce fichier ne s'occupe QUE de la persistance et de la synchronisation.
   L'application visuelle immédiate est faite par le petit script synchrone
   présent dans le <head> de chaque page (pour éviter tout clignotement).

   AJOUTER UN THÈME : une entrée dans THEMES ci-dessous + un bloc dans
   theme.css. Rien d'autre à modifier dans les 21 pages.
   ========================================================================== */

/* ==========================================================================
   Disposition du rail de navigation
   Position et compacité sont des préférences d'AFFICHAGE, conservées dans le
   navigateur : elles suivent l'écran plutôt que le compte. Un même directeur
   veut souvent un rail latéral sur son bureau et une barre haute sur son
   portable.
   ========================================================================== */
(function appliquerDisposition() {
  var POSITIONS = ['gauche', 'droite', 'haut', 'bas'];
  var CLE_POS = 'ardoise_nav_position';
  var CLE_COMPACT = 'ardoise_nav_compact';

  function lire(cle, defaut) {
    try { return localStorage.getItem(cle) || defaut; } catch (e) { return defaut; }
  }

  window.ArdoiseDisposition = {
    positions: POSITIONS,
    obtenir: function () {
      return {
        position: lire(CLE_POS, 'gauche'),
        compact: lire(CLE_COMPACT, 'non') === 'oui'
      };
    },
    definir: function (position, compact) {
      if (position && POSITIONS.indexOf(position) !== -1) {
        try { localStorage.setItem(CLE_POS, position); } catch (e) {}
        document.documentElement.setAttribute('data-nav-position', position);
      }
      if (typeof compact === 'boolean') {
        try { localStorage.setItem(CLE_COMPACT, compact ? 'oui' : 'non'); } catch (e) {}
        document.documentElement.setAttribute('data-nav-compact', compact ? 'oui' : 'non');
      }
    },
    appliquer: function () {
      var etat = window.ArdoiseDisposition.obtenir();
      document.documentElement.setAttribute('data-nav-position', etat.position);
      document.documentElement.setAttribute('data-nav-compact', etat.compact ? 'oui' : 'non');
    }
  };

  if (document.documentElement.getAttribute('data-theme') !== 'public') {
    window.ArdoiseDisposition.appliquer();
  }
})();

/* ==========================================================================
   Contraste minimal WCAG du thème Ardoise
   ========================================================================== */
(function appliquerContrasteArdoise() {
  var style = document.createElement('style');
  style.id = 'ardoise-contraste-wcag';
  style.textContent = [
    'html[data-theme="ardoise"]{--texte-att:#686F66;--vert-ok:#467052;}',
    'html[data-theme="ardoise"] .valider{color:var(--texte-sombre,#1F2B24)!important;}',
    'html[data-theme="ardoise"] #sa-identite{color:var(--nav-texte-fort,#F6F2E7)!important;}',
    'html[data-theme="ardoise"] .sa-muet,html[data-theme="ardoise"] .sa-carte-detail{opacity:1!important;color:var(--texte-att,#686F66)!important;}'
  ].join('');
  (document.head || document.documentElement).appendChild(style);
})();

window.ARDOISE_THEMES = [
  {
    cle: 'studio',
    nom: 'Studio',
    description: 'Rail sombre déplaçable, accent indigo, cartes sans bordure. Le plus proche des outils professionnels actuels.',
    apercu: { fond: '#F4F6FB', surface: '#FFFFFF', accent: '#4C5FD5', barre: '#1B2559', texte: '#101828' }
  },
  {
    cle: 'ardoise',
    nom: 'Ardoise',
    description: 'Craie et ocre, titres en serif. Chaleureux et identitaire.',
    apercu: { fond: '#F6F2E7', surface: '#FBF9F3', accent: '#C98A3E', barre: '#1F2B24', texte: '#1F2B24' }
  },
  {
    cle: 'pure',
    nom: 'Pure',
    description: 'Fond blanc, angles nets, aucune ombre. Sobre et dense.',
    apercu: { fond: '#FFFFFF', surface: '#FFFFFF', accent: '#2563A8', barre: '#FAFAFA', texte: '#14171A' }
  },
  {
    cle: 'nuit',
    nom: 'Nuit',
    description: 'Thème sombre, reposant en soirée et économe en batterie.',
    apercu: { fond: '#12171A', surface: '#1B2226', accent: '#5FB08C', barre: '#0C1013', texte: '#E8EDE9' }
  },
  {
    cle: 'yohali',
    nom: 'Yohali',
    description: 'Terracotta et vert profond, grands rayons. Expressif.',
    apercu: { fond: '#FDF6EE', surface: '#FFFFFF', accent: '#C2542F', barre: '#1E5B4F', texte: '#26201B' }
  }
];

window.ARDOISE_THEME_DEFAUT = 'ardoise';

(function () {
  var CLE_STOCKAGE = 'ardoise_theme';
  var ALIASES = { kivu: 'yohali' };

  function clesValides() {
    return window.ARDOISE_THEMES.map(function (t) { return t.cle; });
  }

  function normaliser(cle) {
    var canonique = ALIASES[cle] || cle;
    return clesValides().indexOf(canonique) !== -1 ? canonique : window.ARDOISE_THEME_DEFAUT;
  }

  function themeActuel() {
    return normaliser(
      document.documentElement.getAttribute('data-theme') ||
      localStorage.getItem(CLE_STOCKAGE) ||
      sessionStorage.getItem(CLE_STOCKAGE)
    );
  }

  function appliquerTheme(cle, options) {
    var theme = normaliser(cle);
    var reglages = options || {};
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(CLE_STOCKAGE, theme);
      if (sessionStorage.getItem('ardoise_refresh_token')) sessionStorage.setItem(CLE_STOCKAGE, theme);
    } catch (e) {}
    try {
      if (theme === 'studio' && !localStorage.getItem('ardoise_nav_compact')) {
        localStorage.setItem('ardoise_nav_compact', 'oui');
      }
      if (window.ArdoiseDisposition) ArdoiseDisposition.appliquer();
    } catch (e) {}
    document.dispatchEvent(new CustomEvent('ardoise:theme-change', { detail: { theme: theme } }));
    if (reglages.synchroniserServeur !== false) enregistrerSurServeur(theme);
    return theme;
  }

  function enregistrerSurServeur(theme) {
    if (typeof appelApi !== 'function') return;
    try {
      appelApi('/utilisateurs/moi', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: theme })
      });
    } catch (e) {}
  }

  function synchroniserDepuisServeur() {
    if (typeof appelApi !== 'function') return;
    var dejaChoisiIci = false;
    try {
      dejaChoisiIci = !!(localStorage.getItem(CLE_STOCKAGE) || sessionStorage.getItem(CLE_STOCKAGE));
    } catch (e) {}
    if (dejaChoisiIci) return;
    appelApi('/utilisateurs/moi')
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (profil) {
        if (!profil || !profil.theme) return;
        appliquerTheme(normaliser(profil.theme), { synchroniserServeur: false });
      })
      .catch(function () {});
  }

  window.ArdoiseTheme = {
    liste: window.ARDOISE_THEMES,
    actuel: themeActuel,
    appliquer: appliquerTheme,
    synchroniser: synchroniserDepuisServeur
  };

  appliquerTheme(themeActuel(), { synchroniserServeur: false });
  synchroniserDepuisServeur();
})();

/* Correctifs UX communs de l'abonnement. Chargé depuis le seul fichier déjà
   présent sur tous les écrans, afin de ne pas modifier chaque page une à une. */
(function chargerSubscriptionUX() {
  if (document.querySelector('script[data-ardoise-subscription-ux]')) return;
  var s = document.createElement('script');
  s.src = 'subscription-ux.js';
  s.defer = true;
  s.setAttribute('data-ardoise-subscription-ux', '');
  (document.head || document.documentElement).appendChild(s);
})();
