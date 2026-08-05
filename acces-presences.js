/* ==========================================================================
   Ardoise — Accès à l'écran Présences selon le mode choisi par l'école
   --------------------------------------------------------------------------
   Le directeur choisit dans Paramètres QUI fait l'appel (`ecoles.mode_presences`) :

     'titulaire'  → le titulaire de la classe (défaut, adapté au primaire)
     'professeur' → tout professeur de la classe (un seul appel par jour)
     'charge'     → UNE personne dédiée pour toute l'école

   Ce réglage existait déjà côté serveur, mais le menu de navigation, lui,
   était figé : « Présences » restait affiché aux mêmes rôles quoi qu'ait
   décidé l'école. Un titulaire voyait donc un écran qui lui répondait 403,
   et le chargé des présences — dont le rôle existait dans la base sans
   qu'aucun écran ne permette de le nommer — ne voyait rien du tout.

   Ce fichier corrige les deux points : il expose la liste des rôles qui
   voient « Présences » POUR LE MODE COURANT, et il tient cette information à
   jour sans obliger l'utilisateur à se reconnecter.

   POURQUOI UN CACHE
   Le filtrage du menu, dans chaque page, est synchrone : il s'exécute avant
   que la moindre requête réseau ait pu répondre. Attendre le serveur ferait
   clignoter le menu à chaque chargement. Le mode est donc conservé dans le
   stockage du navigateur, relu instantanément, puis rafraîchi en arrière-plan
   par un appel à GET /ecole/moi. Un changement de mode par le directeur est
   ainsi pris en compte au chargement de page suivant, pas à la reconnexion.

   CHARGEMENT : ce fichier doit être chargé dans le <head>, donc AVANT le
   script de chaque page qui construit sa table de permissions. Il ne touche à
   aucun élément du DOM au chargement — il se contente de définir
   window.ArdoisePresences — et peut donc s'exécuter avant le <body>.
   ========================================================================== */
(function () {
  'use strict';

  var CLE_MODE = 'ardoise_mode_presences';
  var CLE_RECHARGE = 'ardoise_presences_recharge';
  var REPLI = 'https://scolaire-saas-backend.onrender.com';

  /* ------------------------------------------------------------------
     Qui voit « Présences », mode par mode.

     Modifier CETTE table suffit à changer la règle dans toute la
     plateforme : les 30 pages y font référence, aucune ne redéfinit la
     liste de son côté.

     · En mode 'charge', l'appel est confié à une personne et à une seule.
       Le menu est donc retiré à tout le monde — direction comprise — et
       n'est laissé qu'au chargé des présences et au directeur de
       discipline, pour qui l'assiduité est la matière première du travail.
       (Pour rendre au directeur un accès de correction, il suffit
       d'ajouter 'directeur' à cette ligne : le serveur, lui, l'autorise
       déjà dans tous les modes.)
     · Le directeur de discipline voit l'écran dans TOUS les modes : les
       absences sont le point de départ de son suivi, quel que soit celui
       qui les saisit.
     · Le professeur n'apparaît qu'en mode 'professeur' — ailleurs, le
       serveur lui refuserait la feuille d'appel.
     ------------------------------------------------------------------ */
  var ROLES_PAR_MODE = {
    titulaire:  ['directeur', 'prefet', 'secretaire', 'titulaire', 'directeur_discipline'],
    professeur: ['directeur', 'prefet', 'secretaire', 'titulaire', 'professeur', 'directeur_discipline'],
    charge:     ['charge_presences', 'directeur_discipline']
  };

  function lireStockage(cle) {
    try { return sessionStorage.getItem(cle) || localStorage.getItem(cle); } catch (e) { return null; }
  }

  function ecrireStockage(cle, valeur) {
    try {
      // Même règle que le reste de la plateforme : la session suit le choix
      // fait à la connexion (« Se souvenir de moi » ou non).
      if (sessionStorage.getItem('ardoise_refresh_token')) sessionStorage.setItem(cle, valeur);
      else localStorage.setItem(cle, valeur);
    } catch (e) {}
  }

  /** Mode connu de l'école. 'titulaire' tant que rien n'a été appris — c'est
   *  aussi le défaut du serveur, donc le repli ne ment pas. */
  function mode() {
    var m = lireStockage(CLE_MODE);
    return ROLES_PAR_MODE[m] ? m : 'titulaire';
  }

  function rolesAutorises(modeForce) {
    return ROLES_PAR_MODE[modeForce] || ROLES_PAR_MODE[mode()];
  }

  function rolesUtilisateur() {
    try {
      var u = JSON.parse(lireStockage('ardoise_user') || 'null');
      return (u && u.roles) || [];
    } catch (e) { return []; }
  }

  function estAutorise() {
    var roles = rolesUtilisateur();
    if (roles.indexOf('super_admin') !== -1) return true;
    var permis = rolesAutorises();
    return roles.some(function (r) { return permis.indexOf(r) !== -1; });
  }

  function pageCourante() {
    return window.location.pathname.split('/').pop() || '';
  }

  /**
   * Applique la décision APRÈS coup, quand le serveur a répondu et que le
   * mode a changé depuis le dernier passage.
   *
   * Ne fait que MASQUER, jamais réafficher : à ce moment-là ui.js a déjà
   * réduit le rail aux menus épinglés, et forcer un affichage ferait
   * ressortir une entrée que l'utilisateur avait justement rangée.
   */
  function appliquer() {
    var autorise = estAutorise();

    if (!autorise) {
      var liens = document.querySelectorAll('.nav-item[href="presences.html"]');
      for (var i = 0; i < liens.length; i++) {
        var li = liens[i].closest('li');
        if (li) li.style.display = 'none';
      }
    }

    // Cas limite : l'utilisateur est SUR l'écran des présences au moment où
    // le directeur lui en retire l'accès. Un simple rechargement laisse la
    // logique de repli déjà présente dans la page faire son travail, avec
    // cette fois le bon mode en cache. Le drapeau évite toute boucle.
    if (pageCourante() === 'presences.html') {
      try {
        if (!autorise && !sessionStorage.getItem(CLE_RECHARGE)) {
          sessionStorage.setItem(CLE_RECHARGE, '1');
          window.location.reload();
        } else if (autorise) {
          sessionStorage.removeItem(CLE_RECHARGE);
        }
      } catch (e) {}
    }
  }

  function definirMode(valeur) {
    if (!ROLES_PAR_MODE[valeur]) return;
    var ancien = lireStockage(CLE_MODE);
    ecrireStockage(CLE_MODE, valeur);
    if (ancien !== valeur) appliquer();
  }

  /**
   * Va rechercher le mode réel auprès du serveur.
   *
   * Le jeton d'accès ne vit que 15 minutes : au tout premier instant d'une
   * page, il peut être expiré et c'est le `appelApi()` de la page qui le
   * renouvellera. On ne rejoue donc qu'une seule fois, quelques secondes plus
   * tard, plutôt que d'insister — le mode en cache reste valable entre-temps.
   */
  function rafraichir(deuxiemeEssai) {
    var jeton = lireStockage('ardoise_access_token');
    if (!jeton) return;

    var base = REPLI;
    try { if (typeof API_BASE_URL === 'string' && API_BASE_URL) base = API_BASE_URL; } catch (e) {}

    fetch(base + '/ecole/moi', { headers: { Authorization: 'Bearer ' + jeton } })
      .then(function (r) {
        if (r.status === 401 && !deuxiemeEssai) {
          setTimeout(function () { rafraichir(true); }, 4000);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then(function (ecole) {
        if (!ecole) return;
        definirMode(ecole.mode_presences || 'titulaire');
      })
      .catch(function () { /* hors ligne : le cache fait foi */ });
  }

  window.ArdoisePresences = {
    mode: mode,
    rolesAutorises: rolesAutorises,
    estAutorise: estAutorise,
    definirMode: definirMode,
    rafraichir: rafraichir,
    ROLES_PAR_MODE: ROLES_PAR_MODE
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { rafraichir(false); });
  } else {
    rafraichir(false);
  }
})();
