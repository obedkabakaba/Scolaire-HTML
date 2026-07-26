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

  // Appliqué immédiatement, avant le premier rendu : sinon la page
  // s'afficherait un instant avec le rail au mauvais endroit.
  if (document.documentElement.getAttribute('data-theme') !== 'public') {
    window.ArdoiseDisposition.appliquer();
  }
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
    cle: 'kivu',
    nom: 'Kivu',
    description: 'Terracotta et vert profond, grands rayons. Expressif.',
    apercu: { fond: '#FDF6EE', surface: '#FFFFFF', accent: '#C2542F', barre: '#1E5B4F', texte: '#26201B' }
  }
];

window.ARDOISE_THEME_DEFAUT = 'ardoise';

(function () {
  var CLE_STOCKAGE = 'ardoise_theme';

  function clesValides() {
    return window.ARDOISE_THEMES.map(function (t) { return t.cle; });
  }

  function normaliser(cle) {
    return clesValides().indexOf(cle) !== -1 ? cle : window.ARDOISE_THEME_DEFAUT;
  }

  /** Thème actuellement retenu sur cet appareil. */
  function themeActuel() {
    return normaliser(
      document.documentElement.getAttribute('data-theme') ||
      localStorage.getItem(CLE_STOCKAGE) ||
      sessionStorage.getItem(CLE_STOCKAGE)
    );
  }

  /**
   * Applique un thème immédiatement et le mémorise.
   * @param {string} cle
   * @param {{synchroniserServeur?: boolean}} options
   */
  function appliquerTheme(cle, options) {
    var theme = normaliser(cle);
    var reglages = options || {};

    document.documentElement.setAttribute('data-theme', theme);

    // Mémorisation locale : le thème s'affiche instantanément au prochain
    // chargement, sans attendre la réponse du serveur.
    try {
      localStorage.setItem(CLE_STOCKAGE, theme);
      if (sessionStorage.getItem('ardoise_refresh_token')) {
        sessionStorage.setItem(CLE_STOCKAGE, theme);
      }
    } catch (e) { /* navigation privée : on continue sans mémoriser */ }

    document.dispatchEvent(new CustomEvent('ardoise:theme-change', { detail: { theme: theme } }));

    if (reglages.synchroniserServeur !== false) {
      enregistrerSurServeur(theme);
    }
    return theme;
  }

  /**
   * Enregistre le thème sur le compte de l'utilisateur pour qu'il le retrouve
   * sur ses autres appareils. Échec silencieux : le thème local reste appliqué.
   */
  function enregistrerSurServeur(theme) {
    if (typeof appelApi !== 'function') return; // page publique (index, connexion)
    try {
      appelApi('/utilisateurs/moi', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: theme })
      });
    } catch (e) { /* hors ligne ou backend en veille : sans conséquence */ }
  }

  /**
   * Aligne le thème local sur celui enregistré dans le compte.
   * Utile quand l'utilisateur se connecte depuis un nouvel appareil.
   */
  function synchroniserDepuisServeur() {
    if (typeof appelApi !== 'function') return;
    appelApi('/utilisateurs/moi')
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (profil) {
        if (!profil || !profil.theme) return;
        var distant = normaliser(profil.theme);
        if (distant !== themeActuel()) {
          appliquerTheme(distant, { synchroniserServeur: false });
        }
      })
      .catch(function () { /* sans conséquence */ });
  }

  window.ArdoiseTheme = {
    liste: window.ARDOISE_THEMES,
    actuel: themeActuel,
    appliquer: appliquerTheme,
    synchroniser: synchroniserDepuisServeur
  };

  // Le thème est déjà posé par le script du <head> ; on se contente de vérifier
  // qu'il est valide, puis de récupérer le réglage du compte en arrière-plan.
  appliquerTheme(themeActuel(), { synchroniserServeur: false });
  synchroniserDepuisServeur();
})();
