/* ===========================================================================
   ARDOISE — REMONTÉE CONTRÔLÉE DES ERREURS DU NAVIGATEUR
   ===========================================================================

   CE QUI MANQUAIT
   ---------------
   Seuls `super-admin-noyau.js` et l'espace Super Admin posaient des capteurs
   d'erreurs globaux. Autrement dit : la seule personne dont les incidents
   étaient enregistrés était celle qui pouvait déjà les lire.

   Un directeur devant un écran blanc, un professeur dont la saisie de cotes
   ne répond plus, un comptable dont l'export tombe — rien. L'écran restait
   figé, la personne téléphonait, et il n'y avait rien à regarder.

   CE QUE CE FICHIER CAPTE
   -----------------------
     · `window.onerror`          exceptions non rattrapées
     · `unhandledrejection`      promesses rejetées sans `.catch()`
     · réponses HTTP 5xx         via une enveloppe autour de `fetch`
     · échecs de chargement      exceptions pendant l'initialisation d'un écran
     · erreurs avalées           `ArdoiseErreurs.signaler()`, pour les nombreux
                                 `catch` locaux qui ne faisaient rien

   CE QU'IL NE CAPTE PAS, ET POURQUOI
   ----------------------------------
   Les 401, 402, 403, 404 et autres refus métier. Ce sont des réponses
   ATTENDUES : le jeton a expiré, l'offre ne comprend pas ce module, le rôle
   ne permet pas. Les remonter noierait le centre de bugs sous le
   fonctionnement normal de la plateforme, et ferait passer une invitation
   commerciale pour une panne. Le serveur applique le même filtre, en second
   rideau.

   CE QU'IL NE TRANSMET JAMAIS
   ---------------------------
   Aucun jeton, aucun mot de passe, aucun corps de requête, aucun nom d'élève.
   Le nettoyage est fait ICI, avant l'envoi — et refait côté serveur. Deux
   passes, parce qu'une seule finit toujours par avoir un trou.

   IMPORTANT — CE FICHIER NE DOIT JAMAIS FAIRE ÉCHOUER UNE PAGE.
   Tout est enveloppé. Un capteur d'erreurs qui plante est le pire des
   scénarios : il transforme un défaut en deux, dont le second n'a plus de
   témoin.
   =========================================================================== */

(function () {
  'use strict';

  if (window.ArdoiseErreurs) return;          // déjà installé

  /* L'ADRESSE DE L'API — LA MÊME QUE PARTOUT, PAS UNE DEUXIÈME.
     `session.js` la résout ainsi : constante globale `API_BASE_URL` si une
     page la définit, sinon le repli de production. Recopier une variable
     inventée (`API_URL`) aurait rendu ce fichier définitivement muet : `API`
     serait resté vide, `signaler()` serait sorti à la première ligne, et
     aucun signalement ne serait jamais parti — sans la moindre erreur pour
     le faire remarquer. C'est exactement le genre de panne silencieuse que ce
     fichier a pour but de rendre visible. */
  var API = (function () {
    try {
      if (typeof API_BASE_URL === 'string' && API_BASE_URL) return API_BASE_URL;
    } catch (e) { /* non déclarée sur cette page */ }
    return window.API_BASE_URL || 'https://scolaire-saas-backend.onrender.com';
  })().replace(/\/$/, '');

  var CHEMIN = '/incidents/signaler';

  /* -------------------------------------------------------------------------
     GARDES — POURQUOI ELLES SONT PLUS STRICTES QUE CÔTÉ SERVEUR

     Une page dont le rendu plante peut relancer son rendu, replanter, et
     boucler des centaines de fois par seconde. Côté serveur, la garde protège
     la base ; ici, elle protège aussi le RÉSEAU de la personne — en RDC, la
     connexion est souvent facturée au mégaoctet, et noyer un forfait sous des
     signalements serait un dommage bien réel.
     ------------------------------------------------------------------------- */
  var MAX_PAR_SESSION = 20;
  var MAX_PAR_EMPREINTE = 2;
  var envoyes = 0;
  var vues = {};

  var DEPLOIEMENT = (function () {
    var m = document.querySelector('meta[name="ardoise-version"]');
    return (m && m.getAttribute('content')) || null;
  })();

  // Identifiant de corrélation de la session : permet de relier plusieurs
  // incidents d'une même personne pendant un même épisode, sans jamais
  // l'identifier. Régénéré à chaque chargement de page.
  var CORRELATION = (function () {
    try {
      return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    } catch (e) { return null; }
  })();

  /* -------------------------------------------------------------------------
     NETTOYAGE
     ------------------------------------------------------------------------- */

  var MOTIFS = [
    [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [masqué]'],
    [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, '[jwt masqué]'],
    [/["']?\b(mot_de_passe|password|pwd|passe|secret|token|access_token|refresh_token|api_key|apikey|cle_api|authorization)\b["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s"',;}&]+)/gi,
     '$1: [masqué]'],
    [/\bsk-[A-Za-z0-9_-]{16,}/g, '[clé api masquée]'],
    [/\b[A-Za-z0-9._%+-]{1,64}@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '[email]@$1'],
    [/\+?\d[\d\s.-]{9,17}\d/g, '[téléphone]']
  ];

  function nettoyer(texte, limite) {
    if (texte === null || texte === undefined) return null;
    var s;
    try { s = String(texte); } catch (e) { return null; }
    for (var i = 0; i < MOTIFS.length; i++) {
      try { s = s.replace(MOTIFS[i][0], MOTIFS[i][1]); } catch (e) { /* ignoré */ }
    }
    return s.slice(0, limite || 1000);
  }

  /**
   * Nettoie une pile d'appels.
   *
   * Les URL complètes sont réduites au nom de fichier. Une pile brute contient
   * l'origine, le port et parfois une chaîne de requête avec un jeton — et
   * `https://ardoise.cd/notes.html?token=…:412:9` n'apprend rien de plus que
   * `notes.html:412:9`, qui suffit à retrouver la ligne.
   */
  function nettoyerPile(pile) {
    if (!pile) return null;
    var s;
    try { s = String(pile); } catch (e) { return null; }

    /* L'ORDRE COMPTE, ET IL A DÛ ÊTRE INVERSÉ.

       En masquant les secrets AVANT de réduire les URL, une pile de la forme

           at f (https://ardoise.cd/notes.html?token=abc:412:9)

       perdait ses coordonnées : le motif « token=… » avalait `abc:412:9`
       jusqu'à la parenthèse, et il ne restait plus que `notes.html`. Or
       `notes.html:412:9` est précisément ce qui permet d'aller voir la ligne ;
       sans elle, la pile ne sert plus à rien et le signalement devient un
       constat d'impuissance.

       On réduit donc les URL d'abord — ce qui SUPPRIME la chaîne de requête,
       et donc le secret, plutôt que de le masquer — en conservant le
       `:ligne:colonne` final. Le masquage passe ensuite sur ce qui reste. */
    try {
      s = s.replace(
        /https?:\/\/[^\s)]*?\/([^/\s?):]+)(?:\?[^\s):]*)?(:\d+:\d+)?/g,
        function (tout, fichier, position) { return fichier + (position || ''); });
    } catch (e) { /* on continue avec la pile brute */ }

    return nettoyer(s, 6000);
  }

  function pageCourante() {
    try {
      // Le nom de fichier seul : le chemin complet et la chaîne de requête
      // peuvent porter des identifiants d'élève ou de classe.
      return (location.pathname.split('/').pop() || 'index.html').slice(0, 120);
    } catch (e) { return null; }
  }

  function empreinteLocale(message, page) {
    var base = String(message || '').replace(/\d+/g, ':n').slice(0, 160) + '|' + (page || '');
    var h = 0;
    for (var i = 0; i < base.length; i++) {
      h = ((h << 5) - h + base.charCodeAt(i)) | 0;
    }
    return String(h);
  }

  function roleCourant() {
    try {
      var brut = (window.obtenirDuStockage && window.obtenirDuStockage('ardoise_user'))
              || localStorage.getItem('ardoise_user');
      if (!brut) return null;
      var u = JSON.parse(brut);
      // Les RÔLES, jamais l'identité. « ça plante chez les titulaires » est un
      // diagnostic ; le nom de la personne n'en est pas un.
      return Array.isArray(u.roles) ? u.roles.join(',') : null;
    } catch (e) { return null; }
  }

  /* -------------------------------------------------------------------------
     ENVOI
     ------------------------------------------------------------------------- */

  var ATTENDUS = { 400: 1, 401: 1, 402: 1, 403: 1, 404: 1, 405: 1, 409: 1, 410: 1, 422: 1, 429: 1 };

  function signaler(details) {
    try {
      if (!API) return;                     // hors session applicative
      if (envoyes >= MAX_PAR_SESSION) return;

      var d = details || {};
      if (d.code_http && ATTENDUS[d.code_http]) return;   // refus métier attendu

      var page = d.page || pageCourante();
      var message = nettoyer(d.message, 1000);
      if (!message) return;

      var cle = empreinteLocale(message, page);
      vues[cle] = (vues[cle] || 0) + 1;
      if (vues[cle] > MAX_PAR_EMPREINTE) return;

      envoyes++;

      var corps = {
        message: message,
        stack: nettoyerPile(d.stack),
        page: page,
        chemin: nettoyer(d.chemin, 300),
        methode: d.methode || null,
        code_http: d.code_http || null,
        // `ecole_id` n'est VOLONTAIREMENT pas envoyé : le serveur le lit du
        // jeton. L'ajouter ici n'apporterait rien et ouvrirait la porte à
        // l'usurpation que le correctif serveur vient de fermer.
        systeme: nettoyer(navigator.platform, 120),
        gravite: d.gravite || 'moyenne',
        correlation: CORRELATION,
        deploiement: DEPLOIEMENT,
        contexte: d.contexte || null
      };

      var jeton = null;
      try {
        jeton = (window.obtenirTokens && window.obtenirTokens().access)
             || localStorage.getItem('ardoise_access_token');
      } catch (e) { /* pas de session : on n'envoie pas */ }
      if (!jeton) return;

      /* `keepalive` : la requête survit à la fermeture de l'onglet. C'est
         indispensable — les incidents les plus graves sont précisément ceux
         après lesquels la personne ferme la page. Sans lui, on ne collecterait
         que les erreurs bénignes. */
      fetch(API + CHEMIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + jeton
        },
        body: JSON.stringify(corps),
        keepalive: true
      }).catch(function () {
        /* SILENCE VOLONTAIRE. Un échec d'envoi de signalement ne doit jamais
           produire d'erreur — qui serait captée par nos propres capteurs, et
           renverrait un signalement, qui échouerait à son tour. C'est la
           boucle exacte que ce bloc vide empêche. */
      });
    } catch (e) {
      /* Le capteur ne casse rien, jamais. */
    }
  }

  /* -------------------------------------------------------------------------
     CAPTEURS GLOBAUX
     ------------------------------------------------------------------------- */

  window.addEventListener('error', function (e) {
    // Les erreurs de CHARGEMENT de ressource (img, script) arrivent aussi ici,
    // sans objet `error`. Elles sont utiles — un script manquant casse un
    // écran entier — mais se reconnaissent à leur cible.
    if (e && e.target && e.target !== window && e.target.tagName) {
      var src = e.target.src || e.target.href;
      if (src) {
        signaler({
          message: 'Ressource non chargée : ' + e.target.tagName.toLowerCase(),
          chemin: nettoyer(src, 200),
          gravite: 'haute',
          contexte: { type: 'ressource' }
        });
      }
      return;
    }
    signaler({
      message: (e && e.message) || 'Erreur JavaScript',
      stack: e && e.error && e.error.stack,
      gravite: 'haute',
      contexte: {
        ligne: e && e.lineno ? e.lineno : null,
        colonne: e && e.colno ? e.colno : null,
        // `e.filename` est une URL : on ne garde que le fichier.
        fichier: e && e.filename ? String(e.filename).split('/').pop() : null
      }
    });
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    signaler({
      message: 'Promesse rejetée : ' + ((r && r.message) || r || 'sans motif'),
      stack: r && r.stack,
      gravite: 'haute',
      contexte: { type: 'unhandledrejection' }
    });
  });

  /* -------------------------------------------------------------------------
     ENVELOPPE AUTOUR DE `fetch`

     POURQUOI ENVELOPPER PLUTÔT QUE MODIFIER `appelApi`

     Il existe des dizaines d'implémentations locales de `appelApi` dans les
     pages, toutes légèrement différentes, et la plupart avalent leurs erreurs
     dans un `catch` vide. Les modifier une par une aurait demandé autant de
     correctifs que de pages, avec autant d'occasions d'en oublier une.

     `fetch` est le point de passage OBLIGÉ de toutes ces implémentations. Une
     seule enveloppe les couvre donc intégralement, y compris celles qui seront
     écrites demain.

     L'enveloppe est TRANSPARENTE : elle renvoie la promesse d'origine sans la
     modifier. Une page ne peut pas se comporter différemment selon que ce
     fichier est chargé ou non.
     ------------------------------------------------------------------------- */
  if (typeof window.fetch === 'function' && !window.fetch.__ardoiseEnveloppe) {
    var fetchOrigine = window.fetch;

    var enveloppe = function (ressource, options) {
      var debut = Date.now();
      var url = '';
      try {
        url = typeof ressource === 'string' ? ressource : (ressource && ressource.url) || '';
      } catch (e) { /* ignoré */ }

      var methode = (options && options.method) || 'GET';

      // On n'observe QUE les appels à notre propre API : les requêtes vers des
      // tiers ne nous concernent pas, et signaler l'échec d'une police de
      // caractères remplirait le centre de bugs pour rien.
      var interne = API && url.indexOf(API) === 0;

      // Et JAMAIS le point de signalement lui-même : un 500 sur
      // `/incidents/signaler` déclencherait un signalement de l'échec du
      // signalement, en boucle.
      var estSignalement = url.indexOf(CHEMIN) !== -1;

      return fetchOrigine.apply(this, arguments).then(function (reponse) {
        try {
          if (interne && !estSignalement && reponse && reponse.status >= 500) {
            signaler({
              message: 'HTTP ' + reponse.status + ' sur ' + methode + ' ' + cheminDe(url),
              chemin: cheminDe(url),
              methode: methode,
              code_http: reponse.status,
              gravite: reponse.status === 500 ? 'haute' : 'moyenne',
              contexte: { duree_ms: Date.now() - debut }
            });
          }
        } catch (e) { /* ignoré */ }
        return reponse;
      }, function (erreur) {
        try {
          if (interne && !estSignalement) {
            /* Panne RÉSEAU, pas erreur serveur : la requête n'est jamais
               partie. En RDC, c'est très souvent une coupure de connexion, et
               ce n'est PAS un défaut de la plateforme. On l'enregistre en
               gravité basse pour pouvoir distinguer « le serveur est tombé »
               de « le réseau de cette école est mauvais » — deux diagnostics
               qui appellent des réponses opposées. */
            signaler({
              message: 'Requête réseau échouée : ' + ((erreur && erreur.message) || 'inconnue'),
              chemin: cheminDe(url),
              methode: methode,
              gravite: 'basse',
              contexte: { type: 'reseau', duree_ms: Date.now() - debut }
            });
          }
        } catch (e) { /* ignoré */ }
        throw erreur;      // la promesse rejetée est PROPAGÉE, jamais avalée
      });
    };

    enveloppe.__ardoiseEnveloppe = true;
    window.fetch = enveloppe;
  }

  function cheminDe(url) {
    try {
      var sansApi = API && url.indexOf(API) === 0 ? url.slice(API.length) : url;
      return nettoyer(sansApi.split('?')[0], 300);
    } catch (e) { return null; }
  }

  /* -------------------------------------------------------------------------
     API PUBLIQUE
     ------------------------------------------------------------------------- */

  window.ArdoiseErreurs = {
    /**
     * À appeler depuis un `catch` qui affiche un message sûr à l'utilisateur.
     *
     *   } catch (e) {
     *     ArdoiseErreurs.signaler(e, { ou: 'chargement des cotes' });
     *     afficherMessage('Impossible de charger les cotes.', 'erreur');
     *   }
     */
    signaler: function (erreur, contexte) {
      var c = contexte || {};
      signaler({
        message: (erreur && erreur.message) || String(erreur),
        stack: erreur && erreur.stack,
        gravite: c.gravite || 'moyenne',
        contexte: { ou: c.ou || null }
      });
    },

    /**
     * Enveloppe l'initialisation d'un écran.
     *
     * Une exception pendant le chargement laisse la page à moitié dessinée,
     * sans message : c'est la forme la plus fréquente de « ça ne marche pas »
     * et la plus difficile à diagnostiquer par téléphone.
     */
    surCharger: function (nomEcran, fonction) {
      return function () {
        try {
          var r = fonction.apply(this, arguments);
          if (r && typeof r.catch === 'function') {
            r.catch(function (e) {
              signaler({
                message: 'Échec du chargement de « ' + nomEcran + " » : "
                       + ((e && e.message) || e),
                stack: e && e.stack, gravite: 'haute',
                contexte: { ecran: nomEcran }
              });
            });
          }
          return r;
        } catch (e) {
          signaler({
            message: 'Échec du chargement de « ' + nomEcran + " » : " + ((e && e.message) || e),
            stack: e && e.stack, gravite: 'haute',
            contexte: { ecran: nomEcran }
          });
          throw e;
        }
      };
    },

    // Exposés pour les tests et le diagnostic. `nettoyer` en particulier doit
    // pouvoir être vérifié sans envoyer quoi que ce soit.
    _nettoyer: nettoyer,
    _nettoyerPile: nettoyerPile,
    _correlation: function () { return CORRELATION; }
  };
})();
