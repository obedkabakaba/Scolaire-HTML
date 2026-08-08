/* =============================================================================
   ARDOISE — DIDACTICIEL / GUIDE INTELLIGENT
   =============================================================================

   CE QUE CE FICHIER ÉTAIT, ET CE QU'IL EST DEVENU
   -----------------------------------------------
   Il posait un bouton d'aide sur chaque écran, qui répondait à une question :
   « qu'est-ce que je dois faire maintenant ? ». Il le fait toujours — c'était
   la bonne question, et la réponse venait déjà de la base de données et non
   d'une case cochée à la main.

   Ce qui a été ajouté autour de ce noyau :

     · un accueil à la première connexion, personnalisé et court ;
     · un parcours calculé par RÔLE et par état réel de l'établissement,
       au lieu d'une liste unique réservée à la direction ;
     · un guidage DANS l'interface — projecteur, bulle, flèche — au lieu d'un
       simple lien « aller à l'écran » ;
     · la détection de l'action réellement effectuée, par relecture de la base ;
     · des mini-tutoriels à la première ouverture d'un écran ;
     · l'IA en copilote, avec le contexte du parcours.

   CE QUI N'A PAS CHANGÉ, ET NE DEVAIT PAS
   ---------------------------------------
   L'installation dans les pages : `<script src="didacticiel.js" data-ecran="…">`
   avant `</body>`. Les trente-sept pages n'ont pas été touchées. Le contrat de
   l'ancienne route `/assistant/etat-installation` non plus — voir `modeAncien()`
   plus bas, qui reprend l'affichage d'origine si le serveur n'a pas encore la
   nouvelle route.

   POURQUOI TOUJOURS UN SEUL FICHIER PARTAGÉ
   -----------------------------------------
   La raison d'origine tient encore : trente-huit copies d'un même panneau
   d'aide, ce sont trente-huit versions qui divergent au premier changement.
   Seule la feuille de style a été sortie (`didacticiel.css`), parce qu'un
   projecteur et une bulle positionnée ne s'écrivent pas dans un tableau de
   chaînes JavaScript.

   INSTALLATION DANS UNE PAGE
   --------------------------
     <script src="didacticiel.js" data-ecran="Classes"></script>

   L'attribut `data-ecran` sert à orienter la réponse de l'assistant ; s'il
   manque, le nom du fichier est utilisé.
   ========================================================================== */

(function () {
  'use strict';

  /* ==========================================================================
     0. GARDE-FOUS
     ========================================================================== */

  // La page de connexion et le changement de mot de passe n'ont pas de session :
  // y afficher un bouton d'aide qui appelle l'API produirait une erreur.
  // Les quatre aperçus de bulletin sont des vues d'impression autonomes,
  // sans barre de navigation (`.nav-liste` absente) et sans API_BASE_URL
  // défini sur la page : y afficher le bouton d'aide n'a pas de sens et ne
  // faisait jusqu'ici qu'échouer silencieusement contre l'origine du site.
  var PAGES_SANS_AIDE = ['index.html', 'connexion.html', 'changer-mot-de-passe.html',
                         'reinitialiser-mot-de-passe.html', 'confidentialite.html',
                         'apercu-bulletin-primaire.html', 'apercu-bulletin-secondaire.html',
                         'apercu-bulletin-semestre.html', 'apercu-bulletin-terminale.html', ''];
  var FICHIER = (window.location.pathname.split('/').pop() || '').toLowerCase();
  if (PAGES_SANS_AIDE.indexOf(FICHIER) !== -1) return;

  // Deux instances sur la même page se battraient pour le projecteur.
  if (window.__ardoiseDidacticiel) return;
  window.__ardoiseDidacticiel = true;

  var script = document.currentScript;
  var NOM_ECRAN = (script && script.dataset && script.dataset.ecran)
    || FICHIER.replace('.html', '').replace(/-/g, ' ');

  function lireStockage(cle) {
    try { return localStorage.getItem(cle) || sessionStorage.getItem(cle); }
    catch (e) { return null; }
  }

  var jeton = lireStockage('ardoise_access_token');
  if (!jeton) return;   // pas connecté : rien à afficher

  var utilisateur = null;
  try { utilisateur = JSON.parse(lireStockage('ardoise_user') || 'null'); } catch (e) {}
  var ROLES = (utilisateur && utilisateur.roles) || [];

  // Le Super Admin est exclu, comme demandé : il n'appartient à aucune école.
  // Le contrôle est fait ici EN PLUS du contrôle serveur — inutile de partir
  // en requête pour se faire répondre « actif: false ».
  if (ROLES.indexOf('super_admin') !== -1) return;

  /**
   * Base de l'API, résolue À L'APPEL et non une fois pour toutes ici.
   *
   * Raison : `const API_BASE_URL = "…"` est déclarée par chaque page dans un
   * <script> inline, et `<script src="didacticiel.js">` est un script
   * classique (ni `defer` ni `async`) : il s'exécute immédiatement, dans
   * l'ordre du document. Sur les pages où la balise didacticiel se trouve
   * AVANT la déclaration de la constante (ex. cours.html, classes.html,
   * annee-scolaire.html, eleves.html), lire `API_BASE_URL` ici renvoyait
   * `undefined` et gelait la base sur `''` pour toute la durée de vie de la
   * page. Résultat observé : les appels partaient vers l'origine du site
   * statique (`https://myardoise.com/assistant/…`) au lieu du backend
   * (`https://scolaire-saas-backend.onrender.com/assistant/…`), d'où les 404.
   * En recalculant à chaque appel (et en démarrant après DOMContentLoaded,
   * voir §12), la constante — déclarée n'importe où sur la page — est
   * toujours visible le moment venu.
   */
  function baseAPI() {
    return (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) || window.API_BASE_URL || '';
  }

  /* ==========================================================================
     1. OUTILS
     ========================================================================== */

  function echapper(t) {
    var d = document.createElement('div');
    d.textContent = (t === null || t === undefined) ? '' : String(t);
    return d.innerHTML;
  }

  /**
   * Appel API.
   *
   * On ne réutilise pas `appelApi()` des pages : il n'existe pas partout sous
   * le même nom, et le didacticiel doit fonctionner de façon identique sur les
   * trente-sept écrans.
   *
   * LE 401 N'EST PLUS FATAL
   * -----------------------
   * Ce commentaire disait : « il ne tente pas de rafraîchir le jeton : un 401
   * fait simplement taire le didacticiel ». C'était la cause du défaut le plus
   * visible du guide — il ne s'ouvrait pas « parfois ». Ce parfois, c'était :
   * chaque fois que la page était rouverte plus de quinze minutes après la
   * connexion. La page mère renouvelait bien le jeton pour ses propres appels,
   * mais celui du didacticiel était déjà parti, et personne ne le rejouait.
   *
   * `session.js` enveloppe désormais `fetch` et rejoue toute requête
   * authentifiée revenue en 401, une fois le jeton renouvelé. Il n'y a donc
   * plus rien à faire ici — sinon lire le jeton au moment de l'appel plutôt
   * qu'au chargement, pour repartir du jeton frais quand il vient d'être
   * renouvelé par quelqu'un d'autre.
   */
  function appeler(chemin, options) {
    var o = options || {};
    var entetes = { Authorization: 'Bearer ' + lireStockage('ardoise_access_token') };
    if (o.body) entetes['Content-Type'] = 'application/json';
    return fetch(baseAPI() + chemin, {
      method: o.method || 'GET',
      headers: entetes,
      body: o.body ? JSON.stringify(o.body) : undefined
    });
  }

  /** Enregistre une action de progression. Volontairement silencieux : une
   *  progression non enregistrée est un désagrément, pas une panne. */
  function noter(action, valeur) {
    return appeler('/assistant/onboarding', {
      method: 'PATCH',
      body: valeur ? { action: action, valeur: valeur } : { action: action }
    }).catch(function () { /* hors ligne : la progression se rattrapera */ });
  }

  // Mémoire de session : sert au guidage qui traverse une navigation.
  // sessionStorage et non localStorage — un guidage abandonné ne doit pas
  // ressurgir trois jours plus tard dans un autre onglet.
  var CLE_GUIDAGE = 'ardoise_didacticiel_guidage';
  function lireGuidage() {
    try { return JSON.parse(sessionStorage.getItem(CLE_GUIDAGE) || 'null'); }
    catch (e) { return null; }
  }
  function ecrireGuidage(v) {
    try {
      if (v) sessionStorage.setItem(CLE_GUIDAGE, JSON.stringify(v));
      else sessionStorage.removeItem(CLE_GUIDAGE);
    } catch (e) {}
  }

  /* ==========================================================================
     2. HABILLAGE
     ========================================================================== */

  (function chargerStyles() {
    if (document.getElementById('ard-di-styles')) return;
    var base = (script && script.src) ? script.src.replace(/didacticiel\.js.*$/, '') : '';
    var lien = document.createElement('link');
    lien.id = 'ard-di-styles';
    lien.rel = 'stylesheet';
    lien.href = base + 'didacticiel.css';
    document.head.appendChild(lien);
  })();

  var bouton = document.createElement('button');
  bouton.className = 'ard-di-bouton';
  bouton.type = 'button';
  bouton.setAttribute('aria-haspopup', 'dialog');
  bouton.setAttribute('aria-label', 'Aide et guide de prise en main');
  bouton.innerHTML = '<span class="ard-di-glyphe" aria-hidden="true">?</span>'
    + '<span class="ard-di-libelle"></span>';
  document.body.appendChild(bouton);

  var voile = document.createElement('div');
  voile.className = 'ard-di-voile';
  voile.innerHTML = '<div class="ard-di-panneau" role="dialog" aria-modal="true" '
    + 'aria-labelledby="ard-di-titre" tabindex="-1"></div>';
  document.body.appendChild(voile);
  var panneau = voile.firstChild;

  /* --------------------------------------------------------------------------
     Entrée « Aide & Tutoriels » dans le menu.

     Le cahier des charges demande que le didacticiel reste atteignable même
     après un « Passer pour l'instant ». Le bouton flottant le permet déjà,
     mais c'est un bouton sans nom : on ne le cherche pas quand on veut « le
     tutoriel ». Une entrée de menu porte un mot.

     Elle est POSÉE PAR CE FICHIER, et non ajoutée dans les trente-sept pages :
     modifier trente-sept menus à la main, c'est trente-sept occasions
     d'oublier, et un menu qui diverge d'une page à l'autre.
     -------------------------------------------------------------------------- */
  /* --------------------------------------------------------------------------
     L'ICÔNE ET LE CLIC QUI NE FAISAIT RIEN

     Deux défauts se cumulaient sur cette entrée de menu :

     · Pas d'icône. `ui.js` pose les icônes en cherchant le `href` du lien dans
       sa table `ICONES`. Ce lien portait `href="#"`, qui n'y figure pas : la
       ligne restait donc nue au milieu d'un menu entièrement illustré, ce qui
       la faisait passer pour un élément cassé. L'icône est maintenant posée
       ici, directement, avec la même structure que celles de `ui.js`
       (`<svg class="nav-icone">` + `<span class="nav-libelle">`) pour que
       l'alignement en flex soit identique.

     · Le clic ouvrait un panneau vide. `ouvrir()` dessine à partir de `etat` ;
       si le chargement avait échoué — typiquement le 401 corrigé plus haut —
       `etat` valait `null` et le panneau affichait « Chargement… »
       indéfiniment. D'où « on clique dessus et rien ne se passe ». Le clic
       relance désormais le chargement s'il manque, et affiche un message
       utile s'il échoue vraiment.
     -------------------------------------------------------------------------- */
  var ICONE_AIDE = '<circle cx="12" cy="12" r="9"/>'
    + '<path d="M9.6 9.2a2.5 2.5 0 1 1 3.2 3.1c-.6.3-.9.8-.9 1.4v.4"/>'
    + '<path d="M12 17.2h.01"/>';

  (function poserEntreeMenu() {
    var liste = document.querySelector('.nav-liste');
    if (!liste || document.getElementById('ard-di-nav')) return;
    var li = document.createElement('li');
    li.id = 'ard-di-nav';
    var lien = document.createElement('a');
    lien.className = 'nav-item';
    lien.href = '#';
    lien.setAttribute('role', 'button');

    var icone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icone.setAttribute('class', 'nav-icone');
    icone.setAttribute('viewBox', '0 0 24 24');
    icone.setAttribute('aria-hidden', 'true');
    icone.innerHTML = ICONE_AIDE;

    var libelle = document.createElement('span');
    libelle.className = 'nav-libelle';
    libelle.textContent = 'Aide & Tutoriels';

    lien.appendChild(icone);
    lien.appendChild(libelle);

    lien.addEventListener('click', function (e) {
      e.preventDefault();
      ouvrirDepuisMenu();
    });
    li.appendChild(lien);
    liste.appendChild(li);
  })();

  /**
   * Ouverture par l'entrée de menu.
   *
   * Si l'état n'a pas encore été chargé — ou n'a pas pu l'être — on ouvre
   * quand même, on montre que ça travaille, et on charge. Ne rien afficher du
   * tout laisse croire que le menu est mort.
   */
  function ouvrirDepuisMenu() {
    if (etat) {
      ouvrir(etat.progression && !etat.progression.termine ? 'parcours' : 'centre');
      return;
    }
    ouvrir('parcours');
    panneau.innerHTML = attente('Chargement du guide…');
    charger().then(function (d) {
      if (d) { dessiner(); return; }
      // Vraie panne : on le dit, et on laisse une porte de sortie plutôt
      // qu'un panneau figé sur « Chargement… ».
      panneau.innerHTML = entete('Aide & Tutoriels', '')
        + '<div class="ard-di-corps"><p>Le guide n\'a pas pu être chargé. '
        + 'Vérifiez votre connexion, puis réessayez.</p></div>'
        + '<div class="ard-di-pied">'
        + '<button type="button" class="ard-di-btn ard-di-btn-discret" data-action="fermer">Fermer</button>'
        + '<button type="button" class="ard-di-btn ard-di-btn-principal" data-action="recharger">Réessayer</button>'
        + '</div>';
      brancher();
    });
  }

  var annonceur = document.createElement('div');
  annonceur.className = 'ard-di-lecture-seule';
  annonceur.setAttribute('role', 'status');
  annonceur.setAttribute('aria-live', 'polite');
  document.body.appendChild(annonceur);
  function annoncer(t) { annonceur.textContent = t; }

  /* ==========================================================================
     3. ÉTAT
     ========================================================================== */

  var etat = null;            // dernière réponse de /assistant/onboarding
  var vue = 'parcours';       // 'bienvenue' | 'parcours' | 'etape' | 'centre'
  var etapeAffichee = null;   // code de l'étape ouverte dans la vue 'etape'
  var reponseIA = null;       // { texte } | { attente: true } | { erreur }
  var focusAvant = null;      // élément qui avait le focus avant ouverture
  var ancienMode = false;     // repli sur /assistant/etat-installation

  function etapeParCode(code) {
    if (!etat || !etat.etapes) return null;
    for (var i = 0; i < etat.etapes.length; i++) {
      if (etat.etapes[i].code === code) return etat.etapes[i];
    }
    return null;
  }

  /* ==========================================================================
     4. OUVERTURE / FERMETURE — avec piège de focus

     Une modale sans piège de focus laisse la tabulation partir derrière le
     voile : le lecteur d'écran annonce des boutons que l'œil ne voit pas, et
     l'on ne sait plus où l'on est. Les trois règles minimales sont ici :
     capter le focus à l'ouverture, le retenir en boucle, le rendre à la
     fermeture.
     ========================================================================== */

  var SELECTEURS_FOCUS = 'a[href], button:not([disabled]), input:not([disabled]),'
    + ' select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function ouvrir(nouvelleVue) {
    if (nouvelleVue) vue = nouvelleVue;
    focusAvant = document.activeElement;
    voile.classList.add('ouvert');
    dessiner();
    var premier = panneau.querySelector(SELECTEURS_FOCUS);
    (premier || panneau).focus();
  }

  function fermer() {
    voile.classList.remove('ouvert');
    reponseIA = null;
    if (focusAvant && focusAvant.focus) { try { focusAvant.focus(); } catch (e) {} }
    focusAvant = null;
  }

  voile.addEventListener('click', function (e) { if (e.target === voile) fermer(); });

  document.addEventListener('keydown', function (e) {
    if (!voile.classList.contains('ouvert')) {
      // Échap ferme aussi le guidage, même panneau fermé : c'est la sortie
      // d'urgence attendue de tout overlay.
      if (e.key === 'Escape' && lireGuidage()) arreterGuidage();
      return;
    }
    if (e.key === 'Escape') { fermer(); return; }
    if (e.key !== 'Tab') return;

    var focusables = Array.prototype.filter.call(
      panneau.querySelectorAll(SELECTEURS_FOCUS),
      function (el) { return el.offsetParent !== null; }
    );
    if (focusables.length === 0) return;
    var premier = focusables[0];
    var dernier = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  });

  bouton.addEventListener('click', function () {
    if (voile.classList.contains('ouvert')) { fermer(); return; }
    ouvrir(etat && etat.progression && !etat.progression.vu_bienvenue ? 'bienvenue' : 'parcours');
  });

  /* ==========================================================================
     5. RENDU
     ========================================================================== */

  function dessiner() {
    if (!etat) { panneau.innerHTML = attente('Chargement…'); return; }
    if (ancienMode) { panneau.innerHTML = modeAncien(); brancher(); return; }

    if (vue === 'bienvenue') panneau.innerHTML = vueBienvenue();
    else if (vue === 'etape') panneau.innerHTML = vueEtape();
    else if (vue === 'centre') panneau.innerHTML = vueCentre();
    else panneau.innerHTML = vueParcours();

    brancher();
  }

  function attente(texte) {
    return '<div class="ard-di-corps"><p class="ard-di-attente">' + echapper(texte) + '</p></div>';
  }

  function entete(titre, sous, boutonFermer) {
    return '<div class="ard-di-entete"><div>'
      + '<h2 id="ard-di-titre">' + titre + '</h2>'
      + (sous ? '<p class="ard-di-sous">' + sous + '</p>' : '')
      + '</div>'
      + (boutonFermer === false ? '' :
         '<button type="button" class="ard-di-fermer" data-action="fermer" aria-label="Fermer">✕</button>')
      + '</div>';
  }

  /* -------------------------------------------------------------------------
     5.1 BIENVENUE

     Court, chaleureux, personnalisé avec ce qui est disponible — et seulement
     avec ce qui est disponible. « Bonjour undefined » est pire que « Bonjour ».
     ------------------------------------------------------------------------- */
  function vueBienvenue() {
    var u = etat.utilisateur || {};
    var ecole = (etat.ecole && etat.ecole.nom) || null;

    var salut = u.prenom
      ? 'Bonjour ' + echapper(u.prenom) + ' 👋'
      : (ecole ? 'Bienvenue à ' + echapper(ecole) + ' 👋' : 'Bienvenue 👋');

    var TEXTES = {
      directeur: "Nous allons vous accompagner pour configurer votre établissement et découvrir votre espace.",
      prefet: "Nous allons parcourir ensemble la structure pédagogique de l'établissement et votre espace de travail.",
      secretaire: "Nous allons vous montrer où se trouvent les élèves, les inscriptions et les documents du secrétariat.",
      comptable: "Nous allons vous montrer les frais, les paiements et le suivi des impayés.",
      professeur: "Nous allons vous montrer vos cours, la saisie des cotes et l'appel.",
      titulaire: "Nous allons vous montrer votre classe, la saisie des cotes et les bulletins.",
      charge_presences: "Nous allons vous montrer la feuille d'appel et le calendrier.",
      directeur_discipline: "Nous allons vous montrer le suivi de discipline et les présences.",
      parent: "Nous allons vous montrer où suivre la scolarité de votre enfant.",
      eleve: "Nous allons vous montrer votre espace."
    };
    var texte = TEXTES[u.role_dominant] || "Nous allons vous faire découvrir votre espace.";

    // Établissement déjà largement configuré : on ne fait refaire les étapes à
    // personne. Le message le dit franchement, sinon la personne croit qu'on
    // n'a pas vu son travail.
    //
    // Réservé à ceux qui ONT des étapes de configuration. Un professeur est
    // toujours en mode « découverte », puisqu'il ne configure rien : lui dire
    // « votre établissement est déjà bien configuré » le renseignerait sur un
    // travail qui n'est pas le sien, et lui ferait manquer la seule phrase qui
    // l'intéresse — où trouver ses cours.
    var aDesConfigs = (etat.etapes || []).some(function (e) { return e.type === 'configuration'; });
    if (aDesConfigs && (etat.mode === 'decouverte' || etat.mode === 'termine')) {
      texte = ecole
        ? 'Votre établissement est déjà bien configuré. Nous allons simplement vous faire découvrir les principales fonctionnalités.'
        : 'Votre espace est déjà prêt. Nous allons simplement vous faire découvrir les principales fonctionnalités.';
    }

    var initiale = (u.prenom || ecole || 'A').charAt(0).toUpperCase();

    // Pas d'en-tête ici, volontairement : ni titre de section, ni croix de
    // fermeture. Le premier écran que voit quelqu'un ne doit pas ressembler à
    // une boîte de dialogue système. Les deux issues sont les deux boutons du
    // bas, et Échap reste actif.
    return '<div class="ard-di-bienvenue">'
      + '<div class="ard-di-marque" aria-hidden="true">' + echapper(initiale) + '</div>'
      + '<h2 class="ard-di-salut" id="ard-di-titre">' + salut + '</h2>'
      + '<p class="ard-di-texte">' + echapper(texte) + '</p>'
      + '</div>'
      + '<div class="ard-di-bienvenue-pied">'
      + '<button type="button" class="ard-di-btn ard-di-btn-discret" data-action="reporter">Passer pour l\'instant</button>'
      + '<button type="button" class="ard-di-btn ard-di-btn-principal" data-action="demarrer">Commencer</button>'
      + '</div>';
  }

  /* -------------------------------------------------------------------------
     5.2 PARCOURS — la checklist et la prochaine action
     ------------------------------------------------------------------------- */
  function vueParcours() {
    var p = etat.progression || {};
    var titre = etat.mode === 'configuration'
      ? "Configuration de votre établissement"
      : 'Prise en main d\'Ardoise';

    var pct = (p.pourcentage_configuration !== null && p.pourcentage_configuration !== undefined
               && etat.mode === 'configuration')
      ? p.pourcentage_configuration
      : p.pourcentage;

    var html = entete(echapper(titre), 'Écran actuel · ' + echapper(NOM_ECRAN))
      + '<div class="ard-di-onglets" role="tablist">'
      + '<button type="button" role="tab" aria-selected="true" data-vue="parcours">Mon parcours</button>'
      + '<button type="button" role="tab" aria-selected="false" data-vue="centre">Apprendre Ardoise</button>'
      + '</div>'
      + '<div class="ard-di-corps">';

    html += '<div class="ard-di-jauge"><span style="width:' + pct + '%"></span></div>'
      + '<p class="ard-di-jauge-texte"><span>' + pct + ' % terminé</span>'
      + '<span>' + compteLisible() + '</span></p>';

    // Les alertes AVANT la prochaine étape. Règle héritée du didacticiel
    // d'origine, et l'une des meilleures : un réglage incomplet fait des
    // dégâts silencieux, il passe avant l'avancement.
    (etat.alertes || []).forEach(function (a) {
      html += '<div class="ard-di-alerte"><strong>' + echapper(a.titre) + '</strong><br/>'
        + echapper(a.alerte)
        + ' <button type="button" class="ard-di-btn ard-di-btn-discret" style="padding:2px 6px;font-size:0.8rem"'
        + ' data-action="guider" data-code="' + echapper(a.code) + '">Corriger</button></div>';
    });

    if (etat.prochaine) {
      html += carteEtape(etat.prochaine, etapeParCode(etat.prochaine.code));
    } else if (p.termine) {
      html += '<div class="ard-di-succes"><strong>Votre espace est prêt 🎉</strong><br/>'
        + "Tout l'essentiel est en place. Le guide reste disponible à tout moment "
        + 'depuis ce bouton, et l\'onglet « Apprendre Ardoise » regroupe les modes d\'emploi.</div>';
    }

    html += '<ul class="ard-di-liste">' + (etat.etapes || []).map(ligneEtape).join('') + '</ul>';
    html += '</div>';

    html += '<div class="ard-di-pied">';
    if (p.statut === 'reporte') {
      html += '<button type="button" class="ard-di-btn ard-di-btn-principal" data-action="reprendre">Continuer ma configuration</button>';
    } else if (etat.prochaine) {
      html += '<button type="button" class="ard-di-btn ard-di-btn-discret" data-action="reporter">Plus tard</button>'
        + '<button type="button" class="ard-di-btn ard-di-btn-principal" data-action="guider"'
        + ' data-code="' + echapper(etat.prochaine.code) + '">Me guider</button>';
    } else {
      html += '<button type="button" class="ard-di-btn ard-di-btn-discret" data-action="reinitialiser">Refaire la visite</button>'
        + '<button type="button" class="ard-di-btn ard-di-btn-principal" data-action="fermer">Fermer</button>';
    }
    html += '</div>';
    return html;
  }

  function compteLisible() {
    var e = etat.etapes || [];
    var comptees = e.filter(function (x) { return x.obligatoire && !x.ignoree; });
    var faites = comptees.filter(function (x) { return x.fait; });
    return faites.length + ' / ' + comptees.length + ' étapes';
  }

  function ligneEtape(e) {
    var classes = [];
    if (e.fait) classes.push('fait');
    if (e.ignoree) classes.push('ignoree');
    if (e.bloquee && !e.fait) classes.push('bloquee');
    if (etat.prochaine && etat.prochaine.code === e.code) classes.push('courante');

    var note = '';
    if (e.ignoree) note = 'Étape passée';
    else if (e.bloquee && !e.fait && e.bloquee_par && e.bloquee_par.length) {
      var dep = etapeParCode(e.bloquee_par[0]);
      note = 'Nécessite d\'abord : ' + (dep ? dep.titre : e.bloquee_par[0]);
    }

    return '<li class="' + classes.join(' ') + '">'
      + '<span class="ard-di-coche" aria-hidden="true">' + (e.fait ? '✓' : '') + '</span>'
      + '<span class="ard-di-nom">' + echapper(e.titre)
      + (e.obligatoire ? '' : ' <span class="ard-di-facultatif">facultatif</span>')
      + (note ? '<span class="ard-di-note">' + echapper(note) + '</span>' : '')
      + '</span>'
      + (e.fait ? '<span class="ard-di-lecture-seule">terminé</span>'
                : '<button type="button" class="ard-di-aller" data-action="ouvrir-etape"'
                  + ' data-code="' + echapper(e.code) + '">Voir</button>')
      + '</li>';
  }

  /** La carte détaillée d'une étape : quoi, pourquoi, quel piège. */
  function carteEtape(detail, sommaire) {
    var html = '<div class="ard-di-etape">'
      + '<div class="ard-di-cartouche">'
      + (detail.type === 'decouverte' ? 'À découvrir' : 'Prochaine étape')
      + ' · ' + echapper(detail.ecran_officiel || detail.ancre || '') + '</div>'
      + '<h3>' + echapper(detail.titre) + '</h3>'
      + '<p>' + echapper(detail.quoi || detail.resume) + '</p>';

    // LES GESTES, DANS L'ORDRE.
    //
    // C'est ce qui manquait. La carte nommait l'écran et s'arrêtait là : la
    // personne arrivait devant un formulaire de quinze champs sans savoir
    // lequel comptait. `details` porte la suite — les gestes concrets à faire
    // DANS l'écran — et `champs` le contenu exact de la fenêtre, replié pour
    // ne pas noyer la consigne principale.
    var gestes = detail.details || (sommaire && sommaire.details) || [];
    if (gestes.length) {
      html += '<ol class="ard-di-gestes">'
        + gestes.map(function (g) { return '<li>' + echapper(g) + '</li>'; }).join('')
        + '</ol>';
    }

    if ((detail.champs || []).length) {
      html += '<details class="ard-di-champs"><summary>Ce que contient cet écran</summary><ul>'
        + detail.champs.map(function (c) { return '<li>' + echapper(c) + '</li>'; }).join('')
        + '</ul></details>';
    }

    if (detail.pourquoi) html += '<p class="ard-di-pourquoi">' + echapper(detail.pourquoi) + '</p>';
    if (detail.piege) html += '<p class="ard-di-piege">' + echapper(detail.piege) + '</p>';

    if (sommaire && sommaire.alerte) {
      html += '<p class="ard-di-alerte" style="margin-top:11px">' + echapper(sommaire.alerte) + '</p>';
    }
    html += '</div>';
    return html;
  }

  /* -------------------------------------------------------------------------
     5.3 ÉTAPE — la vue détaillée, avec l'IA en copilote
     ------------------------------------------------------------------------- */
  function vueEtape() {
    var detail = etat._detailCourant;
    if (!detail) return vueParcours();
    var sommaire = etapeParCode(detail.code);

    var html = entete(echapper(detail.titre), 'Écran · ' + echapper(detail.ancre || detail.ecran))
      + '<div class="ard-di-corps">'
      + carteEtape(detail, sommaire);

    // L'IA : proposée, jamais imposée. Le didacticiel reste le guide ; elle
    // n'intervient que si la personne le demande.
    if (reponseIA && reponseIA.attente) {
      html += '<div class="ard-di-ia"><p class="ard-di-attente">Ardoise IA réfléchit…</p></div>';
    } else if (reponseIA && reponseIA.texte) {
      html += '<div class="ard-di-ia">'
        + '<div class="ard-di-cartouche">' + (reponseIA.source === 'ia' ? 'Ardoise IA' : 'Manuel') + '</div>'
        + '<p>' + echapper(reponseIA.texte) + '</p></div>';
    }

    html += '<div class="ard-di-champ">'
      + '<input type="text" id="ard-di-question" placeholder="Une question sur cette étape ?"'
      + ' maxlength="400" aria-label="Poser une question sur cette étape" />'
      + '<button type="button" class="ard-di-btn ard-di-btn-ia" data-action="ia">'
      + (reponseIA ? 'Demander' : 'Demander à Ardoise IA') + '</button>'
      + '</div>';

    html += '</div><div class="ard-di-pied">'
      + '<button type="button" class="ard-di-btn ard-di-btn-discret" data-action="retour">Retour</button>';

    if (sommaire && !sommaire.fait && sommaire.obligatoire === false) {
      html += '<button type="button" class="ard-di-btn ard-di-btn-discret" data-action="ignorer"'
        + ' data-code="' + echapper(detail.code) + '">Passer cette étape</button>';
    }
    html += '<button type="button" class="ard-di-btn ard-di-btn-principal" data-action="guider"'
      + ' data-code="' + echapper(detail.code) + '">Me montrer</button>'
      + '</div>';
    return html;
  }

  /* -------------------------------------------------------------------------
     5.4 CENTRE « APPRENDRE ARDOISE »
     ------------------------------------------------------------------------- */
  function vueCentre() {
    var html = entete('Apprendre Ardoise', 'Les modes d\'emploi qui concernent votre rôle')
      + '<div class="ard-di-onglets" role="tablist">'
      + '<button type="button" role="tab" aria-selected="false" data-vue="parcours">Mon parcours</button>'
      + '<button type="button" role="tab" aria-selected="true" data-vue="centre">Apprendre Ardoise</button>'
      + '</div>'
      + '<div class="ard-di-corps">';

    (etat.centre || []).forEach(function (rubrique, i) {
      html += '<div class="ard-di-rubrique" data-ouvert="' + (i === 0 ? 'oui' : 'non') + '">'
        + '<button type="button" data-action="basculer-rubrique" aria-expanded="' + (i === 0) + '">'
        + echapper(rubrique.titre)
        + '<span class="ard-di-chevron" aria-hidden="true">›</span></button>'
        + '<ul class="ard-di-articles"' + (i === 0 ? '' : ' hidden') + '>';
      rubrique.articles.forEach(function (a) {
        html += '<li>'
          + (a.etape
              ? '<button type="button" data-action="ouvrir-etape" data-code="' + echapper(a.etape) + '">'
                + echapper(a.titre) + '</button>'
              : '<span>' + echapper(a.titre) + '</span>')
          + (a.description ? '<span class="ard-di-desc">' + echapper(a.description) + '</span>' : '')
          + '</li>';
      });
      html += '</ul></div>';
    });

    if (!etat.centre || etat.centre.length === 0) {
      html += '<p class="ard-di-sous">Aucun mode d\'emploi ne correspond à votre rôle pour le moment.</p>';
    }

    html += '</div><div class="ard-di-pied">'
      + '<button type="button" class="ard-di-btn ard-di-btn-principal" data-action="fermer">Fermer</button>'
      + '</div>';
    return html;
  }

  /* -------------------------------------------------------------------------
     5.5 MODE ANCIEN — repli si le serveur n'a pas encore les nouvelles routes

     Le front et le back ne sont pas déployés à la même seconde. Sans ce repli,
     une mise en ligne du front avant celle du back laisserait les
     trente-sept écrans avec un bouton d'aide qui ne répond plus.
     ------------------------------------------------------------------------- */
  function modeAncien() {
    var d = etat;
    var html = entete("Configuration de l'école", 'Écran actuel · ' + echapper(NOM_ECRAN))
      + '<div class="ard-di-corps">';

    if (typeof d.progression === 'number') {
      html += '<div class="ard-di-jauge"><span style="width:' + d.progression + '%"></span></div>'
        + '<p class="ard-di-jauge-texte"><span>' + d.progression + ' % de la configuration effectuée</span></p>';
    }
    (d.alertes || []).forEach(function (a) {
      html += '<div class="ard-di-alerte"><strong>Étape ' + a.etape + ' — ' + echapper(a.titre)
        + '</strong><br/>' + echapper(a.alerte) + '</div>';
    });
    if (d.prochaine_etape) {
      var e = d.prochaine_etape;
      html += '<div class="ard-di-etape">'
        + '<div class="ard-di-cartouche">Prochaine étape · ' + echapper(e.ecran) + '</div>'
        + '<h3>' + e.etape + '. ' + echapper(e.titre) + '</h3>'
        + '<p>' + echapper(e.quoi) + '</p>'
        + '<p class="ard-di-pourquoi">' + echapper(e.pourquoi) + '</p>'
        + '<p class="ard-di-piege">' + echapper(e.piege) + '</p></div>';
    } else if (d.termine) {
      html += '<p>La configuration essentielle est complète.</p>';
    }
    html += '</div><div class="ard-di-pied">'
      + '<a class="ard-di-btn" href="messages.html?assistant=1&ecran=' + encodeURIComponent(NOM_ECRAN) + '">'
      + 'Poser une question à l\'assistant</a>'
      + '<button type="button" class="ard-di-btn ard-di-btn-principal" data-action="fermer">Fermer</button>'
      + '</div>';
    return html;
  }

  /* ==========================================================================
     6. ACTIONS
     ========================================================================== */

  function brancher() {
    panneau.querySelectorAll('[data-action]').forEach(function (el) {
      el.addEventListener('click', function () { agir(el.dataset.action, el.dataset.code, el); });
    });
    panneau.querySelectorAll('[data-vue]').forEach(function (el) {
      el.addEventListener('click', function () { vue = el.dataset.vue; dessiner(); });
    });
    var champ = panneau.querySelector('#ard-di-question');
    if (champ) {
      champ.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); agir('ia'); }
      });
    }
  }

  function agir(action, code, element) {
    switch (action) {
      case 'fermer':
        fermer();
        break;

      case 'recharger':
        panneau.innerHTML = attente('Chargement du guide…');
        charger().then(function (d) { if (d) dessiner(); });
        break;

      case 'demarrer':
        noter('demarrer');
        if (etat.progression) { etat.progression.vu_bienvenue = true; etat.progression.statut = 'en_cours'; }
        // On enchaîne directement sur la première action : c'est ce qui
        // distingue un accueil d'un écran de félicitations. Si rien n'est à
        // faire, on retombe sur la checklist.
        if (etat.prochaine) { ouvrirEtape(etat.prochaine.code); }
        else { vue = 'parcours'; dessiner(); }
        break;

      case 'reporter':
        // « Passer pour l'instant » ne supprime rien : la progression reste,
        // et le bouton d'aide changera de libellé pour inviter à reprendre.
        noter('reporter');
        if (etat.progression) { etat.progression.vu_bienvenue = true; etat.progression.statut = 'reporte'; }
        arreterGuidage();
        fermer();
        majBouton();
        break;

      case 'reprendre':
        noter('reprendre');
        if (etat.progression) etat.progression.statut = 'en_cours';
        if (etat.prochaine) ouvrirEtape(etat.prochaine.code);
        else dessiner();
        majBouton();
        break;

      case 'reinitialiser':
        noter('reinitialiser').then(charger);
        vue = 'bienvenue';
        break;

      case 'ouvrir-etape':
        ouvrirEtape(code);
        break;

      case 'retour':
        vue = 'parcours'; reponseIA = null; dessiner();
        break;

      case 'ignorer':
        noter('ignorer_etape', code).then(charger);
        vue = 'parcours';
        break;

      case 'guider':
        demarrerGuidage(code);
        break;

      case 'ia':
        demanderIA(code || etapeAffichee);
        break;

      case 'basculer-rubrique':
        var rubrique = element.closest('.ard-di-rubrique');
        var ouvert = rubrique.dataset.ouvert === 'oui';
        rubrique.dataset.ouvert = ouvert ? 'non' : 'oui';
        element.setAttribute('aria-expanded', String(!ouvert));
        rubrique.querySelector('.ard-di-articles').hidden = ouvert;
        break;
    }
  }

  /** Ouvre la vue détaillée d'une étape, en chargeant son texte complet. */
  function ouvrirEtape(code) {
    etapeAffichee = code;
    reponseIA = null;
    // Le détail complet (quoi / pourquoi / piège) n'est renvoyé que pour la
    // prochaine étape. Pour les autres, on demande à l'IA contextuelle son
    // repli — qui contient exactement le même texte, sans consommer de quota
    // puisqu'on n'envoie pas de question.
    if (etat.prochaine && etat.prochaine.code === code) {
      etat._detailCourant = etat.prochaine;
      vue = 'etape'; dessiner();
      return;
    }
    var sommaire = etapeParCode(code);
    etat._detailCourant = sommaire ? {
      code: sommaire.code, type: sommaire.type, titre: sommaire.titre,
      resume: sommaire.resume, ecran: sommaire.ecran, ancre: sommaire.ancre,
      selecteurs: sommaire.selecteurs
    } : null;
    vue = 'etape';
    dessiner();
  }

  /* ==========================================================================
     7. L'IA EN COPILOTE
     ========================================================================== */

  function demanderIA(code) {
    var champ = panneau.querySelector('#ard-di-question');
    var question = champ ? champ.value.trim() : '';
    reponseIA = { attente: true };
    dessiner();

    appeler('/assistant/aide-contextuelle', {
      method: 'POST',
      body: { etape: code || etapeAffichee || null, question: question || null, ecran: FICHIER }
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        var d = res.d || {};
        if (res.ok && d.source === 'ia' && d.reponse) {
          reponseIA = { texte: d.reponse, source: 'ia' };
        } else if (d.repli) {
          // Repli : l'explication écrite de l'étape. Ce n'est pas un message
          // d'erreur — la personne obtient une vraie réponse, simplement pas
          // rédigée sur mesure.
          reponseIA = {
            source: 'manuel',
            texte: [d.message, d.repli.quoi, d.repli.pourquoi, d.repli.piege]
              .filter(Boolean).join('\n\n')
          };
        } else {
          reponseIA = { source: 'manuel', texte: d.message || "L'assistant n'a pas pu répondre. Le manuel de votre rôle reste disponible dans « Apprendre Ardoise »." };
        }
        dessiner();
      })
      .catch(function () {
        reponseIA = { source: 'manuel', texte: "La requête n'a pas abouti. Vérifiez votre connexion." };
        dessiner();
      });
  }

  /* ==========================================================================
     8. LE GUIDAGE DANS L'INTERFACE

     Deux cas :
       · l'étape se joue sur CET écran → on éclaire tout de suite ;
       · elle se joue ailleurs → on mémorise l'intention et on navigue. Le
         guidage reprend tout seul au chargement de la page d'arrivée, sans
         que la personne ait à rouvrir quoi que ce soit.
     ========================================================================== */

  var projecteur = null, halo = null, bulle = null, observateur = null, minuterie = null;

  function demarrerGuidage(code) {
    var e = etapeParCode(code) || (etat.prochaine && etat.prochaine.code === code ? etat.prochaine : null);
    if (!e) return;

    ecrireGuidage({ code: code, ecran: e.ecran, debut: Date.now() });
    fermer();

    if (e.ecran && e.ecran.toLowerCase() !== FICHIER) {
      window.location.href = e.ecran;
      return;
    }
    eclairer(code);
  }

  function arreterGuidage() {
    ecrireGuidage(null);
    if (observateur) { observateur.disconnect(); observateur = null; }
    if (minuterie) { clearTimeout(minuterie); minuterie = null; }
    [projecteur, halo, bulle].forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
    projecteur = halo = bulle = null;
    window.removeEventListener('resize', repositionner);
    window.removeEventListener('scroll', repositionner, true);
  }

  /**
   * Trouve la cible du projecteur.
   *
   * Les sélecteurs sont essayés dans l'ordre du catalogue, puis on retombe sur
   * l'entrée de menu correspondant à l'écran — elle existe toujours, ce qui
   * garantit qu'un guidage ne se retrouve jamais sans cible visible.
   */
  function trouverCible(e) {
    var candidats = (e.selecteurs || []).concat([
      '.nav-item[href="' + (e.ecran || '') + '"]',
      '.tuile[data-page="' + (e.ecran || '') + '"]'
    ]);
    for (var i = 0; i < candidats.length; i++) {
      try {
        var el = document.querySelector(candidats[i]);
        if (el && el.offsetParent !== null) return el;
      } catch (err) { /* sélecteur invalide : on passe au suivant */ }
    }
    return null;
  }

  var cibleCourante = null;
  var etapeGuidee = null;

  function eclairer(code) {
    var e = etapeParCode(code)
      || (etat.prochaine && etat.prochaine.code === code ? etat.prochaine : null);
    if (!e) return;
    etapeGuidee = e;

    var cible = trouverCible(e);
    if (!cible) {
      // La page charge ses données par le réseau : la cible n'existe pas
      // encore. On observe le DOM plutôt que de deviner un délai — un
      // setTimeout arbitraire rate la cible sur une connexion lente, ce qui
      // est précisément le cas des écoles visées.
      if (observateur) observateur.disconnect();
      observateur = new MutationObserver(function () {
        var c = trouverCible(e);
        if (!c) return;
        observateur.disconnect(); observateur = null;
        eclairer(code);
      });
      observateur.observe(document.body, { childList: true, subtree: true });
      // Filet : au bout de dix secondes on abandonne le projecteur mais on
      // affiche quand même la bulle, ancrée au bouton d'aide. Mieux vaut une
      // consigne sans projecteur qu'un écran où rien n'arrive.
      minuterie = setTimeout(function () {
        if (observateur) { observateur.disconnect(); observateur = null; }
        cibleCourante = bouton;
        poser();
      }, 10000);
      return;
    }

    if (minuterie) { clearTimeout(minuterie); minuterie = null; }
    cibleCourante = cible;
    try { cible.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (err) {}
    poser();
  }

  function poser() {
    if (!projecteur) {
      projecteur = document.createElement('div');
      projecteur.className = 'ard-di-projecteur';
      // Quatre panneaux : le trou entre eux reste cliquable.
      projecteur.innerHTML = '<div class="ard-di-vitre" data-c="haut"></div>'
        + '<div class="ard-di-vitre" data-c="bas"></div>'
        + '<div class="ard-di-vitre" data-c="gauche"></div>'
        + '<div class="ard-di-vitre" data-c="droite"></div>';
      document.body.appendChild(projecteur);
      // Cliquer dans le noir sort du guidage : c'est le geste attendu, et
      // laisser quelqu'un enfermé dans un overlay est impardonnable.
      projecteur.addEventListener('click', arreterGuidage);
    }
    if (!halo) {
      halo = document.createElement('div');
      halo.className = 'ard-di-halo';
      document.body.appendChild(halo);
    }
    if (!bulle) {
      bulle = document.createElement('div');
      bulle.className = 'ard-di-bulle';
      bulle.setAttribute('role', 'dialog');
      bulle.setAttribute('aria-live', 'polite');
      document.body.appendChild(bulle);
    }

    var e = etapeGuidee;
    var restantes = (etat.etapes || []).filter(function (x) { return !x.fait && !x.ignoree; }).length;

    bulle.innerHTML = '<span class="ard-di-fleche" aria-hidden="true"></span>'
      + '<div class="ard-di-cartouche"><span>'
      + (e.type === 'decouverte' ? 'Découverte' : 'Étape') + '</span>'
      + '<span>' + restantes + ' restante' + (restantes > 1 ? 's' : '') + '</span></div>'
      + '<h3>' + echapper(e.titre) + '</h3>'
      + '<p>' + echapper(e.resume || '') + '</p>'
      // La bulle disait « créez vos classes » et laissait la personne devant
      // le formulaire. Les trois premiers gestes tiennent dans la bulle ; le
      // reste s'obtient par « Détails », qui rouvre la fiche complète.
      + ((e.details && e.details.length)
          ? '<ol class="ard-di-gestes ard-di-gestes-bulle">'
            + e.details.slice(0, 3).map(function (g) {
                return '<li>' + echapper(g) + '</li>';
              }).join('')
            + '</ol>'
            + (e.details.length > 3
                ? '<button type="button" class="ard-di-plus" data-g="details">'
                  + 'Voir les ' + e.details.length + ' étapes</button>'
                : '')
          : '')
      + '<div class="ard-di-bulle-actions">'
      + '<button type="button" class="ard-di-btn ard-di-btn-discret" data-g="arreter">Fermer</button>'
      + '<button type="button" class="ard-di-btn ard-di-btn-ia" data-g="aide">Besoin d\'aide ?</button>'
      + '<button type="button" class="ard-di-btn ard-di-btn-principal" data-g="suivante">'
      + (e.type === 'decouverte' ? 'J\'ai vu' : 'Continuer') + '</button>'
      + '</div>';

    bulle.querySelectorAll('[data-g]').forEach(function (b) {
      b.addEventListener('click', function () {
        var g = b.dataset.g;
        if (g === 'arreter') { arreterGuidage(); return; }
        if (g === 'details') { arreterGuidage(); ouvrirEtape(e.code); ouvrir('etape'); return; }
        if (g === 'aide') { arreterGuidage(); ouvrirEtape(e.code); ouvrir('etape'); demanderIA(e.code); return; }
        if (g === 'suivante') {
          /* ----------------------------------------------------------------
             POURQUOI « CONTINUER » NE CONTINUAIT PAS

             L'ancien code faisait exactement deux choses : `arreterGuidage()`,
             puis `charger(true)`. Autrement dit : il effaçait le projecteur et
             relisait la base. Si l'étape n'était pas encore faite — le cas
             normal, puisqu'on clique « Continuer » AVANT d'avoir rempli le
             formulaire — la bulle disparaissait et il ne se passait plus rien.
             Rien à l'écran, rien dans la console, aucun message. Le bouton
             avait l'air cassé parce qu'il ne faisait, littéralement, rien de
             visible.

             Il fait maintenant les trois choses qu'on attend de lui :

               · une DÉCOUVERTE se valide en la voyant, et on enchaîne
                 immédiatement sur l'étape suivante ;
               · une CONFIGURATION est relue en base. Si elle est faite, on
                 félicite et on enchaîne ;
               · si elle ne l'est pas, on le DIT — sans reproche — et on laisse
                 la bulle en place avec ce qui reste à faire. Se taire était
                 le vrai défaut : la personne ne pouvait pas savoir si elle
                 avait mal fait ou si le bouton était mort.
             ---------------------------------------------------------------- */
          var boutonSuivant = b;
          boutonSuivant.disabled = true;
          boutonSuivant.textContent = 'Vérification…';

          if (e.type === 'decouverte') {
            noter('ecran_visite', e.ecran);
            arreterGuidage();
            charger(true).then(function () { enchainer(e.code); });
            return;
          }

          charger(true).then(function () {
            var apres = etapeParCode(e.code);

            if (apres && apres.fait) {
              arreterGuidage();
              enchainer(e.code);
              return;
            }

            // Pas encore fait : on reste sur place et on explique.
            boutonSuivant.disabled = false;
            boutonSuivant.textContent = 'J\'ai terminé';
            var deja = bulle.querySelector('.ard-di-attente-etape');
            if (deja) deja.remove();
            var note = document.createElement('p');
            note.className = 'ard-di-attente-etape';
            note.textContent = "Cette étape n'est pas encore enregistrée. "
              + "Terminez-la sur l'écran, puis revenez cliquer ici — "
              + "ou passez à la suite avec « Étape suivante ».";
            var actions = bulle.querySelector('.ard-di-bulle-actions');
            bulle.insertBefore(note, actions);

            // Une porte de sortie explicite : rester bloqué sur une étape
            // qu'on ne veut pas faire maintenant est exactement ce qui fait
            // abandonner un guide.
            if (!bulle.querySelector('[data-g="passer"]')) {
              var passer = document.createElement('button');
              passer.type = 'button';
              passer.className = 'ard-di-btn ard-di-btn-discret';
              passer.dataset.g = 'passer';
              passer.textContent = 'Étape suivante';
              passer.addEventListener('click', function () {
                arreterGuidage();
                enchainer(e.code);
              });
              actions.insertBefore(passer, actions.firstChild);
            }
            repositionner();
          });
        }
      });
    });

    repositionner();
    window.addEventListener('resize', repositionner);
    window.addEventListener('scroll', repositionner, true);
    annoncer(e.titre + '. ' + (e.resume || ''));
    var premierBouton = bulle.querySelector('.ard-di-btn-principal');
    if (premierBouton) premierBouton.focus();
  }

  /**
   * Passe à l'étape suivante du parcours.
   *
   * C'est la pièce qui manquait : le guidage savait démarrer sur une étape,
   * mais pas passer à la suivante. Chaque étape était donc un cul-de-sac dont
   * on ne sortait qu'en rouvrant le panneau à la main.
   *
   * `apres` est le code de l'étape qu'on vient de quitter : on l'écarte pour
   * ne pas y revenir en boucle si le serveur la propose encore (une étape
   * ignorée ou non détectable reste « prochaine » tant qu'on ne l'a pas
   * dépassée).
   *
   * Quand l'étape suivante se joue sur un AUTRE écran, `demarrerGuidage()`
   * mémorise l'intention et navigue : le guidage reprend tout seul à
   * l'arrivée, comme il le faisait déjà.
   */
  function enchainer(apres) {
    var suivante = null;

    if (etat && etat.prochaine && etat.prochaine.code !== apres) {
      suivante = etat.prochaine.code;
    } else {
      var candidates = (etat && etat.etapes ? etat.etapes : []).filter(function (x) {
        return !x.fait && !x.ignoree && !x.bloquee && x.code !== apres;
      });
      if (candidates.length) suivante = candidates[0].code;
    }

    if (suivante) { demarrerGuidage(suivante); return; }

    // Plus rien à faire : on le montre, plutôt que de laisser l'écran nu.
    vue = 'parcours';
    ouvrir('parcours');
  }

  function repositionner() {
    if (!cibleCourante || !halo || !bulle) return;
    var r = cibleCourante.getBoundingClientRect();
    var marge = 6;
    var h = window.innerHeight, l = window.innerWidth;

    var t = Math.max(0, r.top - marge), b = Math.min(h, r.bottom + marge);
    var g = Math.max(0, r.left - marge), d = Math.min(l, r.right + marge);

    var vitres = projecteur.querySelectorAll('.ard-di-vitre');
    function pose(el, css) { Object.keys(css).forEach(function (k) { el.style[k] = css[k]; }); }
    pose(vitres[0], { top: '0px', left: '0px', width: l + 'px', height: t + 'px' });
    pose(vitres[1], { top: b + 'px', left: '0px', width: l + 'px', height: Math.max(0, h - b) + 'px' });
    pose(vitres[2], { top: t + 'px', left: '0px', width: g + 'px', height: (b - t) + 'px' });
    pose(vitres[3], { top: t + 'px', left: d + 'px', width: Math.max(0, l - d) + 'px', height: (b - t) + 'px' });

    halo.style.top = t + 'px'; halo.style.left = g + 'px';
    halo.style.width = (d - g) + 'px'; halo.style.height = (b - t) + 'px';

    // Côté de la bulle : sous la cible si la place existe, sinon au-dessus,
    // sinon à côté. Une bulle qui déborde de l'écran ne se lit pas.
    var lb = Math.min(320, l - 32), hb = bulle.offsetHeight || 170, cote, x, y;
    if (h - b > hb + 20) { cote = 'bas'; y = b + 12; x = r.left + r.width / 2 - lb / 2; }
    else if (t > hb + 20) { cote = 'haut'; y = t - hb - 12; x = r.left + r.width / 2 - lb / 2; }
    else if (l - d > lb + 20) { cote = 'droite'; x = d + 12; y = Math.max(12, r.top); }
    else { cote = 'gauche'; x = Math.max(12, g - lb - 12); y = Math.max(12, r.top); }

    x = Math.max(12, Math.min(x, l - lb - 12));
    y = Math.max(12, Math.min(y, h - hb - 12));
    bulle.style.width = lb + 'px';
    bulle.style.left = x + 'px';
    bulle.style.top = y + 'px';
    bulle.dataset.cote = cote;

    var fleche = bulle.querySelector('.ard-di-fleche');
    if (fleche) {
      if (cote === 'bas' || cote === 'haut') {
        fleche.style.left = Math.max(12, Math.min(lb - 24, r.left + r.width / 2 - x - 6)) + 'px';
        fleche.style.top = '';
      } else {
        fleche.style.top = Math.max(12, Math.min(hb - 24, r.top + r.height / 2 - y - 6)) + 'px';
        fleche.style.left = '';
      }
    }
  }

  /* ==========================================================================
     9. MINI-TUTORIEL CONTEXTUEL
     ========================================================================== */

  function afficherTutoriel(t) {
    if (document.getElementById('ard-di-tuto')) return;
    var boite = document.createElement('div');
    boite.id = 'ard-di-tuto';
    boite.className = 'ard-di-tuto';
    boite.setAttribute('role', 'note');
    boite.style.position = 'fixed';
    boite.innerHTML = '<button type="button" class="ard-di-fermer" aria-label="Fermer">✕</button>'
      + '<h3>' + echapper(t.titre) + '</h3>'
      + '<ul>' + t.points.map(function (p) { return '<li>' + echapper(p) + '</li>'; }).join('') + '</ul>'
      + '<button type="button" class="ard-di-btn ard-di-btn-principal" style="padding:7px 14px;font-size:0.83rem">'
      + 'J\'ai compris</button>';
    document.body.appendChild(boite);

    function ranger() {
      // Mémorisé dès la fermeture, quelle qu'en soit la façon : un tutoriel
      // qui revient à chaque visite cesse d'être lu au bout de deux fois.
      noter('tutoriel_vu', t.ecran);
      if (boite.parentNode) boite.parentNode.removeChild(boite);
    }
    boite.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', ranger); });
    annoncer(t.titre);
  }

  /* ==========================================================================
     10. LE BOUTON — libellé et pastille

     La pastille ne s'allume que s'il reste quelque chose à faire, et le
     libellé change selon l'état : sans ce signal, personne n'ouvre un panneau
     d'aide de sa propre initiative.
     ========================================================================== */

  function majBouton() {
    var libelle = bouton.querySelector('.ard-di-libelle');
    var ancienne = bouton.querySelector('.ard-di-pastille');
    if (ancienne) ancienne.remove();

    if (!etat || ancienMode || !etat.progression) {
      libelle.textContent = '';
      bouton.title = "Aide — où en est la configuration ?";
      return;
    }

    var restantes = (etat.etapes || []).filter(function (e) {
      return e.obligatoire && !e.fait && !e.ignoree;
    }).length;

    if (etat.progression.statut === 'reporte' && restantes > 0) {
      libelle.textContent = 'Continuer';
      bouton.title = 'Reprendre votre configuration';
    } else if (restantes > 0) {
      libelle.textContent = 'Guide';
      bouton.title = restantes + ' étape(s) à terminer';
    } else {
      libelle.textContent = '';
      bouton.title = 'Aide et tutoriels';
    }

    if (restantes > 0 || (etat.alertes && etat.alertes.length)) {
      var pastille = document.createElement('span');
      pastille.className = 'ard-di-pastille';
      pastille.textContent = restantes > 0 ? String(restantes) : '!';
      pastille.setAttribute('aria-hidden', 'true');
      bouton.appendChild(pastille);
    }
  }

  /* ==========================================================================
     11. CHARGEMENT ET DÉTECTION DE L'ACTION

     `charger(celebrer)` relit l'état depuis la base. C'est ici que se joue la
     détection de l'action : on ne coche rien parce qu'un bouton a été cliqué,
     on REGARDE si la classe existe désormais. Si l'étape guidée est passée à
     « faite » entre deux lectures, c'est que la personne l'a réellement
     accomplie — et c'est le seul moment où l'on félicite.
     ========================================================================== */

  var codeGuideAvant = null;

  function charger(celebrer) {
    return appeler('/assistant/onboarding?ecran=' + encodeURIComponent(FICHIER))
      .then(function (r) {
        if (r.status === 404) return chargerAncien();      // serveur pas encore à jour
        if (!r.ok) return null;
        return r.json().then(function (d) {
          if (!d || d.actif === false) { bouton.remove(); return null; }

          var avant = etat;
          etat = d;
          ancienMode = false;

          // A-t-on terminé l'étape sur laquelle on était guidé ?
          if (celebrer && codeGuideAvant) {
            var e = etapeParCode(codeGuideAvant);
            var precedente = avant ? (avant.etapes || []).filter(function (x) {
              return x.code === codeGuideAvant;
            })[0] : null;
            if (e && e.fait && (!precedente || !precedente.fait)) {
              feliciter(e);
            }
          }

          majBouton();
          if (voile.classList.contains('ouvert')) dessiner();
          return d;
        });
      })
      // On rend `null` plutôt que `undefined` : les appelants enchaînent sur
      // `.then()` et doivent pouvoir distinguer « chargé » de « échoué ».
      .catch(function () { return null; });
  }

  function chargerAncien() {
    return appeler('/assistant/etat-installation')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) { bouton.remove(); return null; }
        etat = d;
        ancienMode = true;
        majBouton();
        if (d.prochaine_etape || (d.alertes && d.alertes.length)) {
          var pastille = document.createElement('span');
          pastille.className = 'ard-di-pastille';
          pastille.textContent = '!';
          bouton.appendChild(pastille);
        }
        if (voile.classList.contains('ouvert')) dessiner();
        return d;
      })
      .catch(function () { bouton.remove(); });
  }

  function feliciter(e) {
    annoncer('Étape terminée : ' + e.titre);
    vue = 'parcours';
    ouvrir('parcours');
    var corps = panneau.querySelector('.ard-di-corps');
    if (corps) {
      var bandeau = document.createElement('div');
      bandeau.className = 'ard-di-succes';
      bandeau.innerHTML = '<strong>🎉 Parfait !</strong> ' + echapper(e.titre)
        + ' — c\'est fait. ' + (etat.prochaine
            ? 'Passons à la suite.'
            : 'Votre espace est prêt.');
      corps.insertBefore(bandeau, corps.firstChild);
    }
  }

  /* ==========================================================================
     12. DÉMARRAGE

     Reporté à `DOMContentLoaded` — jamais lancé en réaction au simple fait
     que ce script vient de s'exécuter. Raison : `charger()` fait le premier
     `fetch()`, qui lit `API_BASE_URL` via `baseAPI()` (§1). Si on appelait
     `demarrer()` tout de suite, sur une page où la balise
     `<script src="didacticiel.js">` précède la déclaration de la constante,
     le premier appel partirait quand même trop tôt. `DOMContentLoaded` ne se
     déclenche qu'une fois TOUS les scripts synchrones de la page exécutés
     (c'est ce qui bloque le parseur) : à ce moment-là, la constante — quel
     que soit l'endroit où la page la déclare — existe forcément déjà. Si le
     document est déjà prêt quand ce fichier s'exécute (chargement tardif,
     script injecté dynamiquement…), on démarre immédiatement.
     ========================================================================== */

  function demarrer() {
    charger().then(function (d) {
      if (!d || ancienMode) return;

      // 1. Première connexion : l'accueil, tout de suite. Le laisser attendre un
      //    clic sur le bouton d'aide reviendrait à ne jamais l'afficher.
      if (d.progression && !d.progression.vu_bienvenue) {
        noter('bienvenue_vue');
        ouvrir('bienvenue');
        return;
      }

      // 2. Un guidage était en cours et nous a amenés ici : on le reprend.
      var g = lireGuidage();
      if (g && g.ecran && g.ecran.toLowerCase() === FICHIER) {
        codeGuideAvant = g.code;
        eclairer(g.code);
        return;
      }
      if (g && Date.now() - (g.debut || 0) > 30 * 60 * 1000) ecrireGuidage(null);

      // 3. Sinon, le mini-tutoriel de l'écran, s'il y en a un et s'il est neuf.
      if (d.tutoriel) afficherTutoriel(d.tutoriel);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }

  /* --------------------------------------------------------------------------
     Relecture au retour sur l'onglet.

     C'est le mécanisme de détection le plus simple qui soit fiable : la
     personne crée sa classe, la page se recharge ou elle revient sur l'onglet,
     on relit la base. Aucun accrochage aux formulaires des trente-sept pages —
     qui serait à refaire à chaque nouvel écran, et raterait les créations
     faites par import ou depuis un autre appareil.

     Bridé à une relecture par minute : le didacticiel ne doit pas peser sur
     une connexion déjà lente.
     -------------------------------------------------------------------------- */
  var derniereLecture = Date.now();
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (Date.now() - derniereLecture < 60000) return;
    derniereLecture = Date.now();
    codeGuideAvant = (lireGuidage() || {}).code || codeGuideAvant;
    charger(true);
  });

  // Pendant un guidage actif, on relit plus souvent : c'est le moment où
  // l'action est en train d'être faite, et où la félicitation a du sens.
  setInterval(function () {
    if (document.hidden || !lireGuidage()) return;
    derniereLecture = Date.now();
    codeGuideAvant = (lireGuidage() || {}).code;
    charger(true);
  }, 20000);

  /* --------------------------------------------------------------------------
     Ouverture depuis l'extérieur : une page peut appeler
     `window.ArdoiseDidacticiel.ouvrir()` pour proposer « Aide & Tutoriels »
     dans son propre menu, sans dupliquer quoi que ce soit.
     -------------------------------------------------------------------------- */
  window.ArdoiseDidacticiel = {
    ouvrir: function (v) { ouvrir(v || 'parcours'); },
    centre: function () { ouvrir('centre'); },
    guider: function (code) { demarrerGuidage(code); },
    rafraichir: function () { return charger(true); },
    etat: function () { return etat; }
  };
})();
