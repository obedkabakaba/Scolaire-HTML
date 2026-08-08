/* =============================================================================
   ARDOISE — SESSION PARTAGÉE
   =============================================================================

   LE PROBLÈME QU'IL RÈGLE
   -----------------------
   L'access token vit quinze minutes. Passé ce délai, chaque page se rattrape
   toute seule : son `appelApi()` reçoit un 401, appelle `/auth/refresh`, et
   rejoue la requête. C'est écrit trente-sept fois, une par page, et ça marche.

   Mais QUATRE scripts sont partagés par ces trente-sept pages —
   `didacticiel.js`, `ui.js`, `acces-presences.js`, `filtre-cycle.js` — et
   aucun ne passe par ce `appelApi()`. Ils lisent le jeton dans le stockage et
   font un `fetch` brut. Sur un jeton expiré, ils reçoivent un 401 et
   s'arrêtent là, définitivement. Le commentaire de `didacticiel.js` l'assume
   d'ailleurs explicitement : « il ne tente pas de rafraîchir le jeton : un 401
   fait simplement taire le didacticiel ».

   D'où la trace observée dans le navigateur, où TOUT part en 401 au chargement :

     GET /assistant/onboarding?ecran=…   401   (didacticiel.js)
     GET /notifications?limite=200       401   (ui.js)
     GET /ecole/moi                      401   (acces-presences.js, filtre-cycle.js)
     GET /ia/quota                       401   (page)

   La page finit par se réparer, les scripts partagés non. Conséquences
   visibles : le didacticiel « ne s'ouvre pas parfois », la pastille des
   messages reste vide, le filtre de cycle ignore le type de l'école, et le
   menu Présences se masque ou s'affiche à tort.

   `filtre-cycle.js` apparaissait en tête de chaque pile d'appel — il enveloppe
   `window.fetch` — ce qui le faisait passer pour le coupable. Il ne l'était
   pas : il n'était que le dernier maillon visible.

   CE QU'IL FAIT
   -------------
   Une seule chose, à un seul endroit : il enveloppe `fetch`. Toute réponse 401
   provenant de l'API, sur une requête qui portait un en-tête Authorization,
   déclenche un rafraîchissement, puis la requête est rejouée avec le nouveau
   jeton. L'appelant, lui, ne voit qu'une réponse qui a fini par aboutir.

   POURQUOI ENVELOPPER `fetch` PLUTÔT QUE CORRIGER LES QUATRE SCRIPTS
   -----------------------------------------------------------------
   Parce que la même correction recopiée quatre fois, c'est quatre versions qui
   divergeront, et surtout : le cinquième script partagé écrit demain
   retomberait exactement dans le même trou. En complétant `fetch` une fois, on
   couvre ce qui existe et ce qui viendra. C'est le raisonnement que
   `filtre-cycle.js` tenait déjà pour le paramètre de cycle, et il vaut ici
   pour la même raison.

   UN SEUL RAFRAÎCHISSEMENT À LA FOIS
   ----------------------------------
   Au chargement d'une page, cinq à sept requêtes partent ensemble et échouent
   ensemble. Sans précaution, ce sont sept appels simultanés à `/auth/refresh`.
   Le serveur ne fait pas tourner le refresh token — il les accepterait tous —
   mais sept allers-retours sur une connexion congolaise à la rentrée, c'est
   une seconde et demie perdue pour rien, et sept écritures concurrentes du
   même jeton dans le stockage. La promesse est donc partagée : le premier
   401 lance le rafraîchissement, les six autres attendent le même résultat.

   ORDRE DE CHARGEMENT
   -------------------
   Ce fichier doit venir EN PREMIER, avant `filtre-cycle.js`, `ui.js`,
   `acces-presences.js` et `didacticiel.js`. Il enveloppe `fetch` en premier,
   les autres enveloppent par-dessus, et leur `fetchOrigine` capturé est donc
   cette enveloppe-ci — y compris pour les appels que `filtre-cycle.js` fait
   délibérément hors de son propre filtre.

   CE QU'IL NE FAIT PAS
   --------------------
   Il ne touche pas au `appelApi()` des pages. Elles gardent leur logique, qui
   fonctionne ; la seule différence est que leur premier 401 sera souvent déjà
   résolu quand il leur parvient. Aucune page n'a besoin d'être réécrite.
   ========================================================================== */
(function () {
  'use strict';

  if (window.ArdoiseSession) return;   // déjà installé

  var REPLI_API = 'https://scolaire-saas-backend.onrender.com';

  /* ------------------------------------------------------------------
     1. Stockage

     Même règle que partout ailleurs : sessionStorage d'abord (session non
     persistante), localStorage ensuite (« Se souvenir de moi »). L'ordre
     compte — le lire à l'envers ferait ressortir un jeton périmé laissé par
     une connexion précédente.
     ------------------------------------------------------------------ */
  function lire(cle) {
    try { return sessionStorage.getItem(cle) || localStorage.getItem(cle); }
    catch (e) { return null; }
  }

  function ecrire(cle, valeur) {
    try {
      if (sessionStorage.getItem('ardoise_refresh_token')) sessionStorage.setItem(cle, valeur);
      else localStorage.setItem(cle, valeur);
    } catch (e) {}
  }

  function effacer() {
    ['ardoise_access_token', 'ardoise_refresh_token', 'ardoise_user'].forEach(function (c) {
      try { localStorage.removeItem(c); sessionStorage.removeItem(c); } catch (e) {}
    });
  }

  function jeton() { return lire('ardoise_access_token'); }
  function jetonRafraichissement() { return lire('ardoise_refresh_token'); }

  /** Base de l'API, résolue à l'appel : chaque page déclare sa propre
   *  constante `API_BASE_URL`, parfois après ce script. */
  function baseAPI() {
    try {
      if (typeof API_BASE_URL === 'string' && API_BASE_URL) return API_BASE_URL;
    } catch (e) {}
    return window.API_BASE_URL || REPLI_API;
  }

  /** L'URL vise-t-elle notre API ? On ne rejoue rien qui parte ailleurs. */
  function versAPI(url) {
    try {
      var absolue = new URL(url, window.location.href);
      var base = new URL(baseAPI(), window.location.href);
      return absolue.origin === base.origin;
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------
     2. Le rafraîchissement, partagé
     ------------------------------------------------------------------ */

  var fetchNatif = window.fetch ? window.fetch.bind(window) : null;
  var enCours = null;          // promesse partagée du rafraîchissement
  var redirectionLancee = false;

  /**
   * Renvoie une promesse du nouveau jeton, ou de `null` si la session est
   * réellement finie.
   *
   * Le `finally` remet `enCours` à null : sans lui, un rafraîchissement raté
   * une fois interdirait tous les suivants pour la durée de vie de la page.
   */
  function rafraichir() {
    if (enCours) return enCours;

    var refresh = jetonRafraichissement();
    if (!refresh || !fetchNatif) return Promise.resolve(null);

    enCours = fetchNatif(baseAPI() + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.access_token) return null;
        ecrire('ardoise_access_token', d.access_token);
        return d.access_token;
      })
      .catch(function () {
        // Backend injoignable (Render en veille, coupure réseau) : ce n'est
        // pas une session expirée. On ne déconnecte personne pour une panne
        // de réseau — la requête échouera, et la prochaine réessaiera.
        return null;
      })
      .then(function (t) { enCours = null; return t; });

    return enCours;
  }

  /**
   * Session définitivement perdue.
   *
   * Volontairement NON automatique : ce module ne redirige que si la page le
   * lui demande explicitement. Une redirection déclenchée depuis un script
   * partagé arracherait l'utilisateur à un formulaire à moitié rempli parce
   * que la pastille des messages n'a pas pu se charger — ce qui serait pire
   * que le défaut qu'on corrige.
   */
  function terminer() {
    if (redirectionLancee) return;
    redirectionLancee = true;
    effacer();
    window.location.href = 'connexion.html';
  }

  /* ------------------------------------------------------------------
     3. L'enveloppe de fetch
     ------------------------------------------------------------------ */

  /** Remplace l'en-tête Authorization d'une requête déjà construite. */
  function avecJeton(options, token) {
    var o = {};
    for (var k in (options || {})) if (Object.prototype.hasOwnProperty.call(options, k)) o[k] = options[k];
    var entetes = {};
    var source = (options && options.headers) || {};
    if (source instanceof Headers) {
      source.forEach(function (v, k) { entetes[k] = v; });
    } else {
      for (var h in source) if (Object.prototype.hasOwnProperty.call(source, h)) entetes[h] = source[h];
    }
    entetes.Authorization = 'Bearer ' + token;
    o.headers = entetes;
    return o;
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
      var url = (typeof entree === 'string') ? entree : (entree && entree.url) || '';

      // On ne s'occupe QUE des appels authentifiés vers notre API. Le reste —
      // le login, le refresh lui-même, les fichiers statiques, les appels vers
      // un tiers — passe sans être touché.
      var concerne = versAPI(url)
        && url.indexOf('/auth/refresh') === -1
        && url.indexOf('/auth/login') === -1
        && portaitUnJeton(entree, options);

      if (!concerne) return fetchNatif(entree, options);

      return fetchNatif(entree, options).then(function (reponse) {
        if (reponse.status !== 401) return reponse;
        if (!jetonRafraichissement()) return reponse;

        return rafraichir().then(function (nouveau) {
          // Pas de nouveau jeton : on rend le 401 tel quel. C'est la page qui
          // décide de renvoyer vers la connexion — pas ce module.
          if (!nouveau) return reponse;

          // Une Request déjà consommée ne se rejoue pas : on la reconstruit à
          // partir de son URL, avec le nouvel en-tête.
          if (typeof entree === 'string') {
            return fetchNatif(entree, avecJeton(options, nouveau));
          }
          return fetchNatif(entree.url, avecJeton(options || {
            method: entree.method,
            headers: entree.headers
          }, nouveau));
        });
      });
    };
  }

  /* ------------------------------------------------------------------
     4. Rafraîchissement d'avance

     Le rejeu ci-dessus suffit à la correction, mais il coûte un aller-retour
     perdu à chaque première requête d'une page ouverte après une pause. Comme
     le jeton est un JWT dont l'échéance est lisible, autant la regarder :
     si elle est passée ou proche, on rafraîchit avant même que la page ne
     commence à travailler.

     En cas de doute — jeton illisible, horloge du poste décalée — on ne fait
     rien : le rejeu reste le filet, et il fonctionne quelle que soit l'heure
     qu'affiche la machine.
     ------------------------------------------------------------------ */

  function echeance(token) {
    try {
      var charge = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof charge.exp === 'number' ? charge.exp * 1000 : null;
    } catch (e) { return null; }
  }

  function rafraichirSiProche() {
    var t = jeton();
    if (!t || !jetonRafraichissement()) return Promise.resolve(null);
    var exp = echeance(t);
    if (exp === null) return Promise.resolve(null);
    // Marge d'une minute : rafraîchir un jeton qui expirera pendant que la
    // requête voyage ne servirait à rien.
    if (Date.now() < exp - 60000) return Promise.resolve(t);
    return rafraichir();
  }

  /* ------------------------------------------------------------------
     5. Interface publique

     `appelApi` est offert aux scripts partagés qui n'ont pas de fonction
     d'appel à eux. Les pages gardent la leur.
     ------------------------------------------------------------------ */

  function appelApi(chemin, options) {
    var o = options || {};
    return rafraichirSiProche().then(function () {
      var t = jeton();
      if (!t) return Promise.reject(new Error('Aucune session.'));
      var entetes = {};
      var source = o.headers || {};
      for (var h in source) if (Object.prototype.hasOwnProperty.call(source, h)) entetes[h] = source[h];
      entetes.Authorization = 'Bearer ' + t;
      if (o.body && !entetes['Content-Type']) entetes['Content-Type'] = 'application/json';
      return window.fetch(baseAPI() + chemin, {
        method: o.method || 'GET',
        headers: entetes,
        body: (o.body && typeof o.body !== 'string') ? JSON.stringify(o.body) : o.body
      });
    });
  }

  function utilisateur() {
    try { return JSON.parse(lire('ardoise_user') || 'null'); } catch (e) { return null; }
  }

  window.ArdoiseSession = {
    jeton: jeton,
    baseAPI: baseAPI,
    lire: lire,
    ecrire: ecrire,
    utilisateur: utilisateur,
    roles: function () { var u = utilisateur(); return (u && u.roles) || []; },
    connecte: function () { return !!jeton(); },
    rafraichir: rafraichir,
    rafraichirSiProche: rafraichirSiProche,
    appelApi: appelApi,
    terminer: terminer
  };

  // Un rafraîchissement d'avance dès le chargement : les requêtes des scripts
  // partagés partent souvent dans la même milliseconde que celui-ci, et
  // trouveront la promesse déjà en vol plutôt qu'un jeton mort.
  rafraichirSiProche();
})();
