/* ========================================================================== 
   Ardoise — Gestion des thèmes
   ========================================================================== */
(function appliquerDisposition() {
  var POSITIONS = ['gauche', 'droite', 'haut', 'bas'];
  var CLE_POS = 'ardoise_nav_position';
  var CLE_COMPACT = 'ardoise_nav_compact';
  function lire(cle, defaut) { try { return localStorage.getItem(cle) || defaut; } catch (e) { return defaut; } }
  window.ArdoiseDisposition = {
    positions: POSITIONS,
    obtenir: function () { return { position: lire(CLE_POS, 'gauche'), compact: lire(CLE_COMPACT, 'non') === 'oui' }; },
    definir: function (position, compact) {
      if (position && POSITIONS.indexOf(position) !== -1) { try { localStorage.setItem(CLE_POS, position); } catch (e) {} document.documentElement.setAttribute('data-nav-position', position); }
      if (typeof compact === 'boolean') { try { localStorage.setItem(CLE_COMPACT, compact ? 'oui' : 'non'); } catch (e) {} document.documentElement.setAttribute('data-nav-compact', compact ? 'oui' : 'non'); }
    },
    appliquer: function () { var etat = window.ArdoiseDisposition.obtenir(); document.documentElement.setAttribute('data-nav-position', etat.position); document.documentElement.setAttribute('data-nav-compact', etat.compact ? 'oui' : 'non'); }
  };
  if (document.documentElement.getAttribute('data-theme') !== 'public') window.ArdoiseDisposition.appliquer();
})();

/*
   ANIMATIONS : un choix propre à cet appareil, comme la disposition du menu.
   « Désactivées » fige tout ce qui bouge (scènes, entrées, rideaux, effets au
   clic, accueil) : chaque élément s'affiche directement dans son état final.
   « Activées » (par défaut) garde les animations, tout en continuant de
   respecter le réglage « réduire les animations » du système. Les pages posent
   déjà l'attribut avant le premier affichage ; ce module en est la source.
*/
(function gererAnimations() {
  var CLE = 'ardoise_animations';
  function actives() { try { return localStorage.getItem(CLE) !== 'non'; } catch (e) { return true; } }
  function appliquer() {
    if (actives()) document.documentElement.removeAttribute('data-animations');
    else document.documentElement.setAttribute('data-animations', 'non');
  }
  window.ArdoiseAnimations = {
    actives: actives,
    /* Le système demande-t-il moins de mouvement, ou l'utilisateur les a-t-il coupées ? */
    calmes: function () { return !actives() || window.matchMedia('(prefers-reduced-motion: reduce)').matches; },
    definir: function (oui) {
      try { if (oui) localStorage.removeItem(CLE); else localStorage.setItem(CLE, 'non'); } catch (e) {}
      appliquer();
      document.dispatchEvent(new CustomEvent('ardoise:animations-change', { detail: { actives: !!oui } }));
    }
  };
  appliquer();
  // Un autre onglet a changé le réglage : on suit.
  window.addEventListener('storage', function (e) { if (e.key === CLE) appliquer(); });
})();

(function appliquerContrasteArdoise() {
  var style = document.createElement('style');
  style.id = 'ardoise-contraste-wcag';
  style.textContent = [
    'html[data-theme="ardoise"]{--texte-att:#686F66;--vert-ok:#467052;}',
    'html[data-theme="ardoise"] .valider{color:var(--texte-sombre,#1F2B24)!important;}',
    /* #sa-identite n'est plus forcé en couleur claire : l'identité du Super
       Admin est passée de la barre latérale sombre au menu du compte, sur fond
       clair, où ce forçage la rendait illisible (1,06:1). Le contraste y est
       assuré par super-admin-coque.css. */
    'html[data-theme="ardoise"] .sa-muet,html[data-theme="ardoise"] .sa-carte-detail{opacity:1!important;color:var(--texte-att,#686F66)!important;}',
    /* #6A461D sur le fond réel #F2E8D6 de la bannière = ~6,9:1.
       Le précédent var(--ocre) (#C98A3E) ne donnait que 2,4:1 et faisait
       échouer axe dans le Browser E2E du Directeur. La règle est volontairement
       cross-theme : cette bannière exprime un état fonctionnel, pas une couleur
       d'accent décorative, et doit rester lisible quel que soit le thème. */
    '.banniere-abonnement.info{color:#6A461D!important;}'
  ].join('');
  (document.head || document.documentElement).appendChild(style);
})();

/*
   `dispositionMenu: false` signifie que l'apparence possède sa propre coque de
   navigation. Dans ce cas, gauche/droite/haut/bas et le mode compact ne sont
   pas des réglages applicables : les afficher dans le profil ferait croire à
   l'utilisateur qu'une commande cassée existe. La préférence locale reste
   néanmoins conservée et redevient active dès qu'un thème compatible est
   sélectionné.
*/
window.ARDOISE_THEMES = [
  { cle: 'pro', nom: 'Pro', description: 'Le cockpit : rail marine, accent bleu électrique, chiffres alignés au cordeau et indicateurs clés calculés depuis vos compteurs.', devise: 'Piloter, pas subir.', apercu: { fond: '#F3F5F9', surface: '#FFFFFF', accent: '#2563EB', barre: '#0B1220', texte: '#0B1220' } },
  { cle: 'savane', nom: 'Savane', description: 'L’heure dorée : soleil bas, acacias en ombre chinoise, oiseaux de passage et la marche de la semaine.', devise: 'Avancer sans hâte, arriver sans faute.', apercu: { fond: '#F8EFDF', surface: '#FFF9EF', accent: '#AE5418', barre: '#3B2617', texte: '#2E2117' } },
  { cle: 'vibra', nom: 'Vibra', dispositionMenu: false, description: 'Le campus vibrant : ivoire, or et bleu pétrole, constellation de lumière et pouls de l’école.', devise: 'Relier, révéler, rayonner.', apercu: { fond: '#17343B', surface: '#F6EFE4', accent: '#A5793D', barre: '#EAD8BD', texte: '#17303B' } },
  { cle: 'fluide', nom: 'Fluide', dispositionMenu: false, description: 'Le lagon : verre liquide translucide, reflets qui suivent le doigt, dock flottant et île dynamique.', devise: 'Voir clair, en toute fluidité.', apercu: { fond: '#D1E4EA', surface: '#EBF6F8', accent: '#007E9B', barre: '#C4E8ED', texte: '#10354E' } },
  { cle: 'orbite', nom: 'Orbite Aube', dispositionMenu: false, description: 'L’aube orbitale : bleu céleste, satellites, ciel qui change avec l’heure et course du soleil.', devise: 'Garder le cap, en douceur.', apercu: { fond: '#F1F8FF', surface: '#FFFFFF', accent: '#0860D9', barre: '#FFFFFF', texte: '#102B52' } },
  { cle: 'nexus', nom: 'Nexus', dispositionMenu: false, description: 'Le réseau : graphite et vert électrique, impulsions de données, carte des espaces et console.', devise: 'Tout est connecté.', apercu: { fond: '#101517', surface: '#182024', accent: '#C9F65F', barre: '#101719', texte: '#F0F4EE' } },
  { cle: 'recre', nom: 'Récré', dispositionMenu: false, description: 'La récré : jaune soleil, papier crème, post-it, gribouillis et avions en papier.', devise: 'Apprendre en s’amusant.', apercu: { fond: '#FFFCF2', surface: '#FFFFFF', accent: '#FFD34E', barre: '#FFEBA1', texte: '#122642' } },
  { cle: 'perspective', nom: 'Yohali', dispositionMenu: false, description: 'L’atelier d’architecte : crème, vert profond et terre cuite, lignes de fuite et cartes en relief.', devise: 'Bâtir avec justesse.', apercu: { fond: '#FAF9F5', surface: '#FDFCF9', accent: '#2E5040', barre: '#EAE8DC', texte: '#203C32' } },
  { cle: 'elan', nom: 'Élan', dispositionMenu: false, description: 'L’élan : bleu, menthe et soleil levant, traînées de vitesse et victoires du jour à cocher.', devise: 'Un pas, puis l’autre, et l’on s’envole.', apercu: { fond: '#FFFDF8', surface: '#FFFFFF', accent: '#2165B5', barre: '#FFF2BF', texte: '#142D46' } },
  { cle: 'studio', nom: 'Studio', description: 'L’atelier : rail sombre, accent indigo, projecteur qui suit le pointeur et minuteur de concentration.', devise: 'Moins de bruit, plus d’œuvre.', apercu: { fond: '#F4F6FB', surface: '#FFFFFF', accent: '#4C5FD5', barre: '#1B2559', texte: '#101828' } },
  { cle: 'ardoise', nom: 'Ardoise', description: 'Le tableau : craie et ocre, mot du jour écrit à la craie, poussière qui flotte dans la classe.', devise: 'Écrire, effacer, recommencer.', apercu: { fond: '#F6F2E7', surface: '#FBF9F3', accent: '#C98A3E', barre: '#1F2B24', texte: '#1F2B24' } },
  { cle: 'pure', nom: 'Pure', description: 'La page blanche : grille suisse, cartes numérotées comme un registre, aucun superflu.', devise: 'L’essentiel, et rien d’autre.', apercu: { fond: '#FFFFFF', surface: '#FFFFFF', accent: '#2563A8', barre: '#FAFAFA', texte: '#14171A' } },
  { cle: 'nuit', nom: 'Nuit', description: 'La veillée : thème sombre sous un ciel étoilé, étoiles filantes et vraie phase de la Lune.', devise: 'Travailler à la lueur des étoiles.', apercu: { fond: '#12171A', surface: '#1B2226', accent: '#5FB08C', barre: '#0C1013', texte: '#E8EDE9' } },
  { cle: 'yohali', nom: 'Terranga', description: 'Teranga : terracotta et vert profond, motifs wax et « bienvenue » dans les langues des familles.', devise: 'Ici, chacun est attendu.', apercu: { fond: '#FDF6EE', surface: '#FFFFFF', accent: '#C2542F', barre: '#1E5B4F', texte: '#26201B' } }
];
window.ARDOISE_THEME_DEFAUT = 'ardoise';

(function () {
  var CLE_STOCKAGE = 'ardoise_theme';
  var ALIASES = { kivu: 'yohali' };
  function clesValides() { return window.ARDOISE_THEMES.map(function (t) { return t.cle; }); }
  function normaliser(cle) { var canonique = ALIASES[cle] || cle; return clesValides().indexOf(canonique) !== -1 ? canonique : window.ARDOISE_THEME_DEFAUT; }
  function themeActuel() { return normaliser(document.documentElement.getAttribute('data-theme') || localStorage.getItem(CLE_STOCKAGE) || sessionStorage.getItem(CLE_STOCKAGE)); }
  function dispositionDisponible(cle) {
    var theme = normaliser(cle);
    var definition = window.ARDOISE_THEMES.find(function (t) { return t.cle === theme; });
    return !definition || definition.dispositionMenu !== false;
  }
  function appliquerTheme(cle, options) {
    var theme = normaliser(cle), reglages = options || {};
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(CLE_STOCKAGE, theme); if (sessionStorage.getItem('ardoise_refresh_token')) sessionStorage.setItem(CLE_STOCKAGE, theme); } catch (e) {}
    try { if (theme === 'studio' && !localStorage.getItem('ardoise_nav_compact')) localStorage.setItem('ardoise_nav_compact', 'oui'); if (window.ArdoiseDisposition) ArdoiseDisposition.appliquer(); } catch (e) {}
    document.dispatchEvent(new CustomEvent('ardoise:theme-change', { detail: { theme: theme } }));
    if (theme === 'vibra' && !document.querySelector('script[data-ardoise-vibra]')) {
      var scriptVibra = document.createElement('script');
      scriptVibra.src = 'theme-vibra.js';
      scriptVibra.dataset.ardoiseVibra = '';
      scriptVibra.onerror = function () { scriptVibra.remove(); };
      document.head.appendChild(scriptVibra);
    }
    if (theme === 'fluide' && !document.querySelector('script[data-ardoise-fluide]')) {
      var scriptFluide = document.createElement('script');
      scriptFluide.src = 'theme-fluide.js';
      scriptFluide.dataset.ardoiseFluide = '';
      scriptFluide.onerror = function () { scriptFluide.remove(); };
      document.head.appendChild(scriptFluide);
    }
    if (theme === 'orbite' && !document.querySelector('script[data-ardoise-orbite]')) {
      var scriptOrbite = document.createElement('script');
      scriptOrbite.src = 'theme-orbite.js';
      scriptOrbite.dataset.ardoiseOrbite = '';
      scriptOrbite.onerror = function () { scriptOrbite.remove(); };
      document.head.appendChild(scriptOrbite);
    }
    if (theme === 'nexus' && !document.querySelector('script[data-ardoise-nexus]')) {
      var scriptNexus = document.createElement('script');
      scriptNexus.src = 'theme-nexus.js';
      scriptNexus.dataset.ardoiseNexus = '';
      scriptNexus.onerror = function () { scriptNexus.remove(); };
      document.head.appendChild(scriptNexus);
    }
    if (theme === 'recre' && !document.querySelector('script[data-ardoise-recre]')) {
      var scriptRecre = document.createElement('script');
      scriptRecre.src = 'theme-recre.js';
      scriptRecre.dataset.ardoiseRecre = '';
      scriptRecre.onerror = function () { scriptRecre.remove(); };
      document.head.appendChild(scriptRecre);
    }
    if (theme === 'perspective' && !document.querySelector('script[data-ardoise-perspective]')) {
      var scriptPerspective = document.createElement('script');
      scriptPerspective.src = 'theme-perspective.js';
      scriptPerspective.dataset.ardoisePerspective = '';
      scriptPerspective.onerror = function () { scriptPerspective.remove(); };
      document.head.appendChild(scriptPerspective);
    }
    if (theme === 'elan' && !document.querySelector('script[data-ardoise-elan]')) {
      var scriptElan = document.createElement('script');
      scriptElan.src = 'theme-elan.js';
      scriptElan.dataset.ardoiseElan = '';
      scriptElan.onerror = function () { scriptElan.remove(); };
      document.head.appendChild(scriptElan);
    }
    /* Signatures (récit, scène, widget, gestes) : communes à toutes les
       apparences, chargées une seule fois, jamais sur les pages publiques. */
    if (theme !== 'public' && !document.querySelector('script[data-ardoise-signatures]')) {
      var scriptSignatures = document.createElement('script');
      scriptSignatures.src = 'theme-signatures.js';
      scriptSignatures.dataset.ardoiseSignatures = '';
      scriptSignatures.onerror = function () { scriptSignatures.remove(); };
      document.head.appendChild(scriptSignatures);
    }
    if (reglages.synchroniserServeur !== false) enregistrerSurServeur(theme);
    return theme;
  }
  function enregistrerSurServeur(theme) {
    if (typeof appelApi !== 'function') return;
    try { appelApi('/utilisateurs/moi', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: theme }) }); } catch (e) {}
  }
  function synchroniserDepuisServeur() {
    if (typeof appelApi !== 'function') return;
    var dejaChoisiIci = false;
    try { dejaChoisiIci = !!(localStorage.getItem(CLE_STOCKAGE) || sessionStorage.getItem(CLE_STOCKAGE)); } catch (e) {}
    if (dejaChoisiIci) return;
    appelApi('/utilisateurs/moi').then(function (r) { return r && r.ok ? r.json() : null; }).then(function (profil) { if (profil && profil.theme) appliquerTheme(normaliser(profil.theme), { synchroniserServeur: false }); }).catch(function () {});
  }
  window.ArdoiseTheme = { liste: window.ARDOISE_THEMES, actuel: themeActuel, appliquer: appliquerTheme, synchroniser: synchroniserDepuisServeur, dispositionDisponible: dispositionDisponible };
  appliquerTheme(themeActuel(), { synchroniserServeur: false });
  synchroniserDepuisServeur();
})();

/*
   Mon profil contient une commande générique « Disposition du menu ». Les
   thèmes à navigation dédiée ne peuvent pas honnêtement promettre ces quatre
   positions sans casser leur composition. On masque donc uniquement les
   commandes inapplicables, tout en gardant « Choisir les écrans du menu ».
*/
(function synchroniserDispositionProfil() {
  var TEXTE_LIBRE = 'Contrairement au thème, ces réglages restent propres à cet appareil : un rail latéral sur un grand écran, une barre haute sur un portable.';
  var TEXTE_FIXE = 'Cette apparence utilise une navigation conçue spécialement pour son style. Sa position et son mode compact sont donc fixes. Vous pouvez toujours choisir les écrans affichés dans le menu.';

  function mettreAJour() {
    var choix = document.getElementById('choix-position');
    if (!choix || !window.ArdoiseTheme || typeof window.ArdoiseTheme.dispositionDisponible !== 'function') return;

    var section = choix.closest('.carte-section');
    if (!section) return;

    var libre = window.ArdoiseTheme.dispositionDisponible(window.ArdoiseTheme.actuel());
    var titre = section.querySelector('h2');
    var intro = titre ? titre.nextElementSibling : null;
    var champ = choix.closest('.champ-disposition');
    var compact = document.getElementById('case-compact');
    var blocCompact = compact ? compact.closest('.interrupteur-disposition') : null;
    var confirmation = document.getElementById('confirmation-disposition');

    if (titre) titre.textContent = libre ? 'Disposition du menu' : 'Menu';
    if (intro && intro.tagName === 'P') intro.textContent = libre ? TEXTE_LIBRE : TEXTE_FIXE;
    if (champ) champ.style.display = libre ? '' : 'none';
    if (blocCompact) blocCompact.style.display = libre ? '' : 'none';
    if (confirmation) {
      confirmation.style.display = libre ? '' : 'none';
      if (!libre) confirmation.textContent = '';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mettreAJour);
  else mettreAJour();
  document.addEventListener('ardoise:theme-change', function () { setTimeout(mettreAJour, 0); });
})();

/* `subscription-ux.js` a été retiré, et ce n'est pas une suppression de
   fonctionnalité : son contenu vit désormais dans `ui.js`, à la source.

   Ce fichier corrigeait APRÈS COUP ce que `ui.js` produisait mal : il
   enveloppait `ArdoiseUI.confirmer` pour dédoublonner les avertissements
   d'offre, et surveillait le DOM en permanence (MutationObserver sur tout le
   document) pour réécrire les liens « Contacter Ardoise » et « Voir mon
   abonnement » que `ui.js` pointait vers les mauvaises pages.

   Deux implémentations du même écran, dont l'une réparait l'autre à chaud.
   `ui.js` pose maintenant les bons liens directement et dédoublonne lui-même
   ses avertissements — le correctif n'a plus rien à corriger, et la
   surveillance permanente du DOM disparaît avec lui. */

/* La vue « Renouvellements » du Super Admin était injectée ici. Elle est
   désormais chargée par super-admin.html comme toutes les autres vues : un
   script partagé par toutes les pages n'a pas à connaître les écrans d'un
   espace qui se veut isolé. */
