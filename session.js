/* =============================================================================
   ARDOISE — SESSION PARTAGÉE
   =============================================================================

   Ce module est chargé avant les autres scripts applicatifs. Il centralise :
   - la lecture/écriture des jetons ;
   - le rafraîchissement d'un access token expiré ;
   - le rejeu automatique des requêtes authentifiées après un 401 ;
   - le traitement immédiat des 402 qui signifient que l'accès global de
     l'établissement est terminé, suspendu ou pas encore activé.

   L'ordre de chargement est essentiel : les pages font souvent leur premier
   appel API avant ui.js. Si un abonnement est expiré — ou encore à activer —,
   attendre ui.js ferait tomber la page dans son message générique « Vérifie ta
   connexion » alors qu'il ne s'agit pas d'une panne réseau.
   ============================================================================= */
(function () {
  'use strict';

  if (window.ArdoiseSession) return;

  var REPLI_API = 'https://scolaire-saas-backend.onrender.com';

  /* ------------------------------------------------------------------
     0. Garde de chargement mobile

     `mobile.css` transforme `.mise-en-page` en bloc avec `!important` sous
     780 px. C'est correct une fois la page prête, mais cela écrasait aussi le
     `style="display:none"` utilisé par plusieurs écrans pendant leur premier
     appel API. Résultat : le téléphone affichait simultanément « Chargement… »
     ET l'interface encore vide/squelettique.

     Ce garde ne change rien au layout final : il ne s'applique que tant que la
     page porte explicitement `display:none`. Dès que son JavaScript remplace
     cette valeur par `grid`, `block`, etc., la règle cesse de correspondre et
     la couche mobile reprend normalement la main.
     ------------------------------------------------------------------ */
  (function installerGardeChargementMobile() {
    if (document.getElementById('ardoise-garde-chargement-mobile')) return;
    var style = document.createElement('style');
    style.id = 'ardoise-garde-chargement-mobile';
    style.textContent = '@media (max-width:780px){'
      + '.mise-en-page[style*="display:none"],'
      + '.mise-en-page[style*="display: none"]{display:none!important}'
      + '}';
    (document.head || document.documentElement).appendChild(style);
  })();

  /* ------------------------------------------------------------------
     1. Stockage
     ------------------------------------------------------------------ */
  function lire(cle) {
    try { return sessionStorage.getItem(cle) || localStorage.getItem(cle); }
    catch (e) { return null; }
  }

  function ecrire(cle, valeur) {
    try {
      if (sessionStorage.getItem('ardoise_refresh_token')) {
        sessionStorage.setItem(cle, valeur);
      } else {
        localStorage.setItem(cle, valeur);
      }
    } catch (e) {}
  }

  function effacer() {
    ['ardoise_access_token', 'ardoise_refresh_token', 'ardoise_user'].forEach(function (cle) {
      try {
        localStorage.removeItem(cle);
        sessionStorage.removeItem(cle);
      } catch (e) {}
    });
    try { sessionStorage.removeItem('ardoise_droits_offre'); } catch (e) {}
  }

  function jeton() { return lire('ardoise_access_token'); }
  function jetonRafraichissement() { return lire('ardoise_refresh_token'); }

  function baseAPI() {
    try {
      if (typeof API_BASE_URL === 'string' && API_BASE_URL) return API_BASE_URL;
    } catch (e) {}
    return window.API_BASE_URL || REPLI_API;
  }

  function versAPI(url) {
    try {
      var absolue = new URL(url, window.location.href);
      var base = new URL(baseAPI(), window.location.href);
      return absolue.origin === base.origin;
    } catch (e) {
      return false;
    }
  }

  /* ------------------------------------------------------------------
     2. Rafraîchissement partagé
     ------------------------------------------------------------------ */
  var fetchNatif = window.fetch ? window.fetch.bind(window) : null;
  var enCours = null;
  var redirectionLancee = false;

  function rafraichir() {
    if (enCours) return enCours;

    var refresh = jetonRafraichissement();
    if (!refresh || !fetchNatif) return Promise.resolve(null);

    enCours = fetchNatif(baseAPI() + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh })
    })
      .then(function (reponse) {
        return reponse.ok ? reponse.json() : null;
      })
      .then(function (donnees) {
        if (!donnees || !donnees.access_token) return null;
        ecrire('ardoise_access_token', donnees.access_token);
        return donnees.access_token;
      })
      .catch(function () {
        // Une panne réseau ne doit jamais être confondue avec une session finie.
        return null;
      })
      .then(function (nouveauJeton) {
        enCours = null;
        return nouveauJeton;
      });

    return enCours;
  }

  function terminer() {
    if (redirectionLancee) return;
    redirectionLancee = true;
    effacer();
    window.location.href = 'connexion.html';
  }

  /* ------------------------------------------------------------------
     3. Accès bloquant : traitement PRÉCOCE
     ------------------------------------------------------------------ */
  var CODES_BLOQUANTS = {
    abonnement_requis: true,
    essai_expire: true,
    abonnement_expire: true,
    essai_suspendu: true,
    ecole_suspendue: true
  };

  var ecranBlocageAffiche = false;

  /* Les pages qui SONT la sortie de secours.

     Elles n'ont rien à bloquer : `abonnements.html` est là pour payer,
     `support.html` pour signaler, `mon-profil.html` et
     `changer-mot-de-passe.html` pour reprendre la main sur son compte. Le
     serveur les laisse d'ailleurs ouvertes (`CHEMINS_TOUJOURS_OUVERTS`).

     Sans cette liste, il suffisait qu'un script partagé — `filtre-cycle.js` ou
     `acces-presences.js`, qui interrogent `/ecole/moi` sur toutes les pages —
     reçoive son 402 pour que l'écran de blocage recouvre la page de paiement
     elle-même. Le directeur cliquait « Voir les abonnements », arrivait sur la
     bonne page… et y retrouvait le même mur, avec le même bouton. */
  var PAGES_DE_SORTIE = {
    'abonnements.html': true,
    'support.html': true,
    'mon-profil.html': true,
    'changer-mot-de-passe.html': true,
    'reinitialiser-mot-de-passe.html': true,
    'connexion.html': true
  };

  function pageCourante() {
    try {
      return (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    } catch (e) { return ''; }
  }

  function estPageDeSortie() {
    return PAGES_DE_SORTIE[pageCourante()] === true;
  }

  /**
   * Masque l'application derrière l'écran de blocage.
   *
   * POURQUOI ON MASQUE
   * ------------------
   * La version d'origine masquait `getElementById('mise-en-page')`. Or une
   * SEULE page porte cet identifiant : les trente autres ne déclarent que la
   * CLASSE. Sur toutes ces pages, l'application restait donc entièrement
   * rendue derrière le voile — menu, tableaux, et surtout les `.spinner` d'un
   * chargement qui n'aboutirait jamais, qui tournaient indéfiniment. Chaque
   * image recomposait la page complète PUIS la floutait, en pleine
   * résolution : c'est ce qui faisait chauffer puis lâcher les téléphones
   * d'entrée de gamme.
   *
   * POURQUOI LE MASQUAGE EST CONDITIONNÉ À LA PRÉSENCE DU VOILE
   * ----------------------------------------------------------
   * Le premier correctif posait un attribut sur `<html>` et masquait tout
   * `body > *` sauf le voile. Un attribut et un élément qui doivent rester
   * d'accord : si le voile venait à manquer — retiré par un autre script,
   * perdu au retour d'un onglet mis en veille par le téléphone, ou jamais
   * monté parce qu'une erreur a interrompu sa construction — il ne restait
   * plus RIEN à l'écran. Une page entièrement vide, de la couleur du fond,
   * sans même un bouton « retour » utile. C'est le défaut qui a été rapporté.
   *
   * Le sélecteur `:has()` supprime la classe entière de ce défaut : la règle
   * ne s'applique QUE tant que le voile est réellement dans la page. S'il
   * disparaît, l'application réapparaît d'elle-même. Et sur un navigateur qui
   * ignore `:has()` — Chrome < 105, encore présent sur de vieux Android — la
   * règle est simplement ignorée : on retombe alors sur le masquage
   * JavaScript ci-dessous, ciblé, qui ne peut pas non plus vider la page.
   *
   * Une page blanche n'est donc plus atteignable par aucun des deux chemins.
   */
  function masquerPageBloquee() {
    if (!document.getElementById('ardoise-style-blocage')) {
      var style = document.createElement('style');
      style.id = 'ardoise-style-blocage';
      var garde = 'html[data-ardoise-bloque]:has(#ardoise-expiration-session)';
      style.textContent = garde + ',' + garde + ' body{'
        + 'background:#111A19!important;overflow:hidden!important}'
        + garde + ' body>*:not(#ardoise-expiration-session){'
        + 'display:none!important}';
      (document.head || document.documentElement).appendChild(style);
    }
    document.documentElement.setAttribute('data-ardoise-bloque', '');

    /* Le filet des navigateurs sans `:has()`. On ne masque que ce qui est
       identifiable sans risque : la mise en page applicative et les deux
       écrans d'état. Le voile n'est dans aucun des trois, il ne peut donc pas
       être emporté. */
    var couches = document.querySelectorAll(
      '.mise-en-page, #mise-en-page, #ecran-chargement, #ecran-erreur');
    for (var i = 0; i < couches.length; i++) {
      couches[i].style.setProperty('display', 'none', 'important');
    }
  }

  /**
   * Rend la page si le voile a disparu.
   *
   * Ceinture ET bretelles : `:has()` couvre déjà le cas côté style, mais le
   * masquage JavaScript, lui, ne se défait pas tout seul. On le vérifie aux
   * deux moments où un téléphone rend la main à une page qu'il avait mise de
   * côté — c'est là que le vide avait été constaté.
   */
  function verifierEcranBloque() {
    if (!document.documentElement.hasAttribute('data-ardoise-bloque')) return;
    if (document.getElementById('ardoise-expiration-session')) return;

    document.documentElement.removeAttribute('data-ardoise-bloque');
    var couches = document.querySelectorAll(
      '.mise-en-page, #mise-en-page, #ecran-chargement, #ecran-erreur');
    for (var i = 0; i < couches.length; i++) {
      couches[i].style.removeProperty('display');
    }

    // Le blocage, lui, n'a pas disparu : on remonte l'écran plutôt que de
    // rendre une application dont chaque bouton renverra le même refus.
    ecranBlocageAffiche = false;
    window.__ardoiseExpirationAffichee = false;
    if (window.__ardoiseAccesBloque) afficherEcranBlocage(window.__ardoiseAccesBloque);
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) verifierEcranBloque();
  });
  window.addEventListener('pageshow', verifierEcranBloque);

  /**
   * Bandeau discret, pour les pages qui sont elles-mêmes la sortie.
   *
   * On informe sans recouvrir : la page de paiement doit rester utilisable,
   * c'est tout son intérêt.
   */
  function afficherBandeauBlocage(corps) {
    function monter() {
      if (!document.body) {
        document.addEventListener('DOMContentLoaded', monter, { once: true });
        return;
      }
      if (document.getElementById('ardoise-bandeau-blocage')) return;

      var bandeau = document.createElement('div');
      bandeau.id = 'ardoise-bandeau-blocage';
      bandeau.setAttribute('role', 'status');
      bandeau.style.cssText = [
        'position:sticky', 'top:0', 'z-index:9000',
        'background:#C98A3E', 'color:#fff',
        'padding:10px 16px', 'text-align:center',
        'font-size:.9rem', 'font-weight:500',
        'font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif'
      ].join(';');
      bandeau.textContent = corps.message
        || 'L’accès aux fonctions de gestion est suspendu. Vos données sont conservées.';

      document.body.insertBefore(bandeau, document.body.firstChild);
    }

    monter();
  }

  function afficherEcranBlocage(corps) {
    if (!corps || !CODES_BLOQUANTS[corps.code]) return;
    if (ecranBlocageAffiche || window.__ardoiseExpirationAffichee) return;

    ecranBlocageAffiche = true;
    window.__ardoiseExpirationAffichee = true;
    window.__ardoiseAccesBloque = corps;

    if (estPageDeSortie()) {
      afficherBandeauBlocage(corps);
      try { sessionStorage.removeItem('ardoise_droits_offre'); } catch (e) {}
      return;
    }

    function monter() {
      if (!document.body) {
        document.addEventListener('DOMContentLoaded', monter, { once: true });
        return;
      }
      if (document.getElementById('ardoise-expiration-session')) return;

      var activationRequise = corps.code === 'abonnement_requis';
      var titres = {
        abonnement_requis: 'Choisissez un abonnement pour continuer',
        essai_expire: 'Votre période d’essai Ardoise est terminée',
        abonnement_expire: 'Votre abonnement Ardoise a expiré',
        essai_suspendu: 'Votre démonstration a été suspendue',
        ecole_suspendue: 'L’accès à votre établissement est suspendu'
      };

      var voile = document.createElement('div');
      voile.id = 'ardoise-expiration-session';
      voile.setAttribute('role', 'alertdialog');
      voile.setAttribute('aria-modal', 'true');
      voile.setAttribute('aria-labelledby', 'ardoise-expiration-session-titre');
      voile.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2147483646',
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:24px', 'box-sizing:border-box',
        /* FOND OPAQUE, SANS `backdrop-filter`.
           Le flou obligeait le navigateur à re-rastériser TOUTE la page
           derrière le voile, à chaque image, en pleine résolution. Une fois
           l'application masquée (`masquerPageBloquee`), il n'y a de toute
           façon plus rien à flouter : la même image, pour un coût nul. */
        'background:#111A19',
        'font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif'
      ].join(';');

      var carte = document.createElement('div');
      carte.style.cssText = [
        'max-width:560px', 'width:100%', 'box-sizing:border-box',
        'background:#F6F2E7', 'color:#1F2B24',
        'border-radius:16px', 'padding:32px',
        'box-shadow:0 24px 64px rgba(0,0,0,.45)',
        'text-align:center', 'max-height:90vh', 'overflow-y:auto'
      ].join(';');

      var titre = document.createElement('h2');
      titre.id = 'ardoise-expiration-session-titre';
      titre.textContent = titres[corps.code] || titres.abonnement_expire;
      titre.style.cssText = 'margin:0 0 16px;font-size:1.5rem;line-height:1.25;font-weight:700';

      var message = document.createElement('p');
      message.textContent = corps.message || 'Votre accès à Ardoise est temporairement limité.';
      message.style.cssText = 'margin:0 0 12px;line-height:1.6;font-size:1rem';

      var conservation = document.createElement('p');
      conservation.innerHTML = activationRequise
        ? '<strong>Votre espace Ardoise est prêt.</strong> Choisissez une offre et un mode de règlement. Les fonctions de gestion s’ouvriront dès l’activation de votre abonnement.'
        : '<strong>Vos données sont conservées.</strong> Élèves, notes, classes, bulletins et paramètres restent intacts et seront disponibles dès le rétablissement de l’accès.';
      conservation.style.cssText = 'margin:0 0 24px;line-height:1.6;font-size:.95rem;color:#4A554E';

      var actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center';

      var abonnements = document.createElement('a');
      abonnements.href = 'abonnements.html';
      abonnements.textContent = activationRequise ? 'Choisir un abonnement' : 'Voir les abonnements';
      abonnements.style.cssText = [
        'display:inline-block', 'padding:12px 24px', 'border-radius:10px',
        'background:#C98A3E', 'color:#fff', 'text-decoration:none', 'font-weight:600'
      ].join(';');

      var support = document.createElement('a');
      support.href = 'support.html';
      support.textContent = 'Contacter le support';
      support.style.cssText = [
        'display:inline-block', 'padding:12px 24px', 'border-radius:10px',
        'border:1px solid #C7BFAC', 'color:#1F2B24',
        'text-decoration:none', 'font-weight:600'
      ].join(';');

      var deconnexion = document.createElement('button');
      deconnexion.type = 'button';
      deconnexion.textContent = 'Se déconnecter';
      deconnexion.style.cssText = [
        'display:block', 'margin:18px auto 0', 'padding:10px 18px',
        'border:0', 'background:none', 'color:#4A554E',
        'text-decoration:underline', 'cursor:pointer', 'font:inherit'
      ].join(';');
      deconnexion.addEventListener('click', terminer);

      actions.appendChild(abonnements);
      actions.appendChild(support);
      carte.appendChild(titre);
      carte.appendChild(message);
      carte.appendChild(conservation);
      carte.appendChild(actions);
      carte.appendChild(deconnexion);
      voile.appendChild(carte);
      document.body.appendChild(voile);

      /* On masque l'application APRÈS avoir posé le voile, et jamais avant :
         si la construction ci-dessus échouait, une page masquée sans voile ne
         laisserait qu'un écran noir, sans explication ni moyen d'en sortir. */
      masquerPageBloquee();

      try { sessionStorage.removeItem('ardoise_droits_offre'); } catch (e) {}
    }

    monter();
  }

  function traiter402(reponse) {
    if (!reponse || reponse.status !== 402) return Promise.resolve(reponse);

    try {
      return reponse.clone().json()
        .then(function (corps) {
          if (corps && CODES_BLOQUANTS[corps.code]) afficherEcranBlocage(corps);
          return reponse;
        })
        .catch(function () {
          // Corps illisible : on laisse la page traiter la réponse elle-même.
          return reponse;
        });
    } catch (e) {
      return Promise.resolve(reponse);
    }
  }

  /* ------------------------------------------------------------------
     4. Enveloppe de fetch : 401 + 402
     ------------------------------------------------------------------ */
  function avecJeton(options, token) {
    var resultat = {};
    for (var cle in (options || {})) {
      if (Object.prototype.hasOwnProperty.call(options, cle)) resultat[cle] = options[cle];
    }

    var entetes = {};
    var source = (options && options.headers) || {};
    if (source instanceof Headers) {
      source.forEach(function (valeur, nom) { entetes[nom] = valeur; });
    } else {
      for (var h in source) {
        if (Object.prototype.hasOwnProperty.call(source, h)) entetes[h] = source[h];
      }
    }

    entetes.Authorization = 'Bearer ' + token;
    resultat.headers = entetes;
    return resultat;
  }

  function portaitUnJeton(entree, options) {
    var source = (options && options.headers) || (entree && entree.headers) || null;
    if (!source) return false;

    if (source instanceof Headers) return !!source.get('Authorization');

    for (var h in source) {
      if (String(h).toLowerCase() === 'authorization') return true;
    }
    return false;
  }

  if (fetchNatif) {
    window.fetch = function (entree, options) {
      var url = (typeof entree === 'string')
        ? entree
        : (entree && entree.url) || '';

      var concerne = versAPI(url)
        && url.indexOf('/auth/refresh') === -1
        && url.indexOf('/auth/login') === -1
        && portaitUnJeton(entree, options);

      if (!concerne) return fetchNatif(entree, options);

      return fetchNatif(entree, options).then(function (reponse) {
        if (reponse.status !== 401) return traiter402(reponse);
        if (!jetonRafraichissement()) return reponse;

        return rafraichir().then(function (nouveau) {
          if (!nouveau) return reponse;

          if (typeof entree === 'string') {
            return fetchNatif(entree, avecJeton(options, nouveau)).then(traiter402);
          }

          return fetchNatif(entree.url, avecJeton(options || {
            method: entree.method,
            headers: entree.headers
          }, nouveau)).then(traiter402);
        });
      });
    };
  }

  /* ------------------------------------------------------------------
     5. Rafraîchissement d'avance
     ------------------------------------------------------------------ */
  function echeance(token) {
    try {
      var charge = JSON.parse(
        atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
      );
      return typeof charge.exp === 'number' ? charge.exp * 1000 : null;
    } catch (e) {
      return null;
    }
  }

  function rafraichirSiProche() {
    var access = jeton();
    if (!access || !jetonRafraichissement()) return Promise.resolve(null);

    var expiration = echeance(access);
    if (expiration === null) return Promise.resolve(null);
    if (Date.now() < expiration - 60000) return Promise.resolve(access);

    return rafraichir();
  }

  /* ------------------------------------------------------------------
     6. Interface publique
     ------------------------------------------------------------------ */
  function appelApi(chemin, options) {
    var reglage = options || {};

    return rafraichirSiProche().then(function () {
      var access = jeton();
      if (!access) return Promise.reject(new Error('Aucune session.'));

      var entetes = {};
      var source = reglage.headers || {};
      for (var h in source) {
        if (Object.prototype.hasOwnProperty.call(source, h)) entetes[h] = source[h];
      }

      entetes.Authorization = 'Bearer ' + access;
      if (reglage.body && !entetes['Content-Type']) {
        entetes['Content-Type'] = 'application/json';
      }

      return window.fetch(baseAPI() + chemin, {
        method: reglage.method || 'GET',
        headers: entetes,
        // `signal` est transmis tel quel : sans lui, aucun appelant ne peut
        // poser de délai, et une requête partie vers un serveur endormi reste
        // en attente indéfiniment — la page attend avec elle.
        signal: reglage.signal,
        body: (reglage.body && typeof reglage.body !== 'string')
          ? JSON.stringify(reglage.body)
          : reglage.body
      });
    });
  }

  function utilisateur() {
    try { return JSON.parse(lire('ardoise_user') || 'null'); }
    catch (e) { return null; }
  }

  window.ArdoiseSession = {
    jeton: jeton,
    baseAPI: baseAPI,
    lire: lire,
    ecrire: ecrire,
    utilisateur: utilisateur,
    roles: function () {
      var user = utilisateur();
      return (user && user.roles) || [];
    },
    connecte: function () { return !!jeton(); },
    rafraichir: rafraichir,
    rafraichirSiProche: rafraichirSiProche,
    appelApi: appelApi,
    terminer: terminer,
    traiter402: traiter402,
    afficherEcranBlocage: afficherEcranBlocage
  };

  rafraichirSiProche();
})();