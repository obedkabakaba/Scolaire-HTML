/* ==========================================================================
   Ardoise — Fonctionnement hors ligne (côté page)
   --------------------------------------------------------------------------
   Trois rôles :

     1. Installer le service worker (cache des pages et des données lues)
     2. Mettre les écritures en file d'attente quand la connexion manque
     3. Rejouer cette file dès le retour du réseau

   Ce fichier n'exige aucune modification des pages : il enveloppe la
   fonction appelApi() que chacune définit déjà.
   ========================================================================== */

(function () {
  'use strict';

  var CLE_FILE = 'ardoise_file_hors_ligne';
  var METHODES_ECRITURE = ['POST', 'PUT', 'PATCH', 'DELETE'];

  // Ces appels ne doivent jamais être différés : les rejouer plus tard n'a
  // aucun sens et pourrait produire des effets inattendus.
  var JAMAIS_DIFFERE = ['/auth/', '/uploads/'];

  // ------------------------------------------------------------------
  //  File d'attente (localStorage : suffisant pour des charges légères
  //  et bien plus simple à auditer qu'IndexedDB)
  // ------------------------------------------------------------------
  function lireFile() {
    try { return JSON.parse(localStorage.getItem(CLE_FILE) || '[]'); }
    catch (e) { return []; }
  }

  function ecrireFile(file) {
    try { localStorage.setItem(CLE_FILE, JSON.stringify(file)); }
    catch (e) { /* stockage plein ou navigation privée */ }
  }

  function ajouterAlaFile(entree) {
    var file = lireFile();
    file.push(entree);
    ecrireFile(file);
    majBandeau();
  }

  // ------------------------------------------------------------------
  //  Bandeau d'état
  // ------------------------------------------------------------------
  var bandeau = null;

  function creerBandeau() {
    if (bandeau || !document.body) return;
    bandeau = document.createElement('div');
    bandeau.id = 'bandeau-hors-ligne';
    bandeau.innerHTML =
      '<span class="bhl-texte"></span>' +
      '<button type="button" class="bhl-action" style="display:none;">Synchroniser</button>';
    document.body.appendChild(bandeau);
    bandeau.querySelector('.bhl-action').addEventListener('click', synchroniser);
  }

  function majBandeau() {
    creerBandeau();
    if (!bandeau) return;

    var enAttente = lireFile().length;
    var texte = bandeau.querySelector('.bhl-texte');
    var action = bandeau.querySelector('.bhl-action');

    if (!navigator.onLine) {
      bandeau.className = 'visible hors-ligne';
      texte.textContent = enAttente > 0
        ? 'Hors ligne — ' + enAttente + ' modification(s) en attente d\'envoi.'
        : 'Hors ligne — vous consultez les dernières données enregistrées.';
      action.style.display = 'none';
      return;
    }

    if (enAttente > 0) {
      bandeau.className = 'visible en-attente';
      texte.textContent = enAttente + ' modification(s) à envoyer.';
      action.style.display = '';
      return;
    }

    bandeau.className = '';
  }

  function annoncer(message, type) {
    creerBandeau();
    if (!bandeau) return;
    bandeau.className = 'visible ' + (type || 'succes');
    bandeau.querySelector('.bhl-texte').textContent = message;
    bandeau.querySelector('.bhl-action').style.display = 'none';
    setTimeout(majBandeau, 5000);
  }

  // ------------------------------------------------------------------
  //  Enveloppe autour de appelApi()
  // ------------------------------------------------------------------
  function installerEnveloppe() {
    if (typeof window.appelApi !== 'function' || window.appelApi.__ardoiseHorsLigne) return;

    var original = window.appelApi;

    async function appelApiHorsLigne(chemin, options) {
      options = options || {};
      var methode = (options.method || 'GET').toUpperCase();
      var estEcriture = METHODES_ECRITURE.indexOf(methode) !== -1;
      var differable = estEcriture && !JAMAIS_DIFFERE.some(function (m) { return chemin.indexOf(m) === 0; });

      // Hors ligne + écriture différable : on met de côté et on répond
      // comme si c'était passé, en le disant clairement à l'utilisateur.
      if (differable && !navigator.onLine) {
        ajouterAlaFile({
          chemin: chemin,
          methode: methode,
          corps: typeof options.body === 'string' ? options.body : null,
          entetes: options.headers || { 'Content-Type': 'application/json' },
          horodatage: Date.now()
        });
        return new Response(
          JSON.stringify({
            message: 'Enregistré sur cet appareil — sera envoyé dès le retour de la connexion.',
            hors_ligne: true
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      try {
        return await original(chemin, options);
      } catch (erreur) {
        // La connexion a lâché en cours de route : même traitement.
        if (differable) {
          ajouterAlaFile({
            chemin: chemin, methode: methode,
            corps: typeof options.body === 'string' ? options.body : null,
            entetes: options.headers || { 'Content-Type': 'application/json' },
            horodatage: Date.now()
          });
          return new Response(
            JSON.stringify({
              message: 'Connexion perdue — la modification est conservée et sera envoyée plus tard.',
              hors_ligne: true
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw erreur;
      }
    }

    appelApiHorsLigne.__ardoiseHorsLigne = true;
    // On garde la fonction d'origine telle quelle : c'est elle qui sait
    // rafraîchir le jeton d'accès. Le rejeu doit impérativement passer par
    // elle, sinon une saisie hors ligne de plus de quinze minutes se ferait
    // refuser pour jeton expiré — et serait perdue.
    appelApiHorsLigne.__original = original;
    window.appelApi = appelApiHorsLigne;
  }

  // ------------------------------------------------------------------
  //  Rejeu de la file
  // ------------------------------------------------------------------
  var synchronisationEnCours = false;

  async function synchroniser() {
    if (synchronisationEnCours || !navigator.onLine) return;
    var file = lireFile();
    if (file.length === 0) { majBandeau(); return; }

    synchronisationEnCours = true;
    annoncer('Envoi de ' + file.length + ' modification(s)…', 'en-attente');

    var restantes = [];
    var envoyees = 0;
    var rejetees = 0;

    // L'ordre chronologique est respecté : une correction saisie après une
    // première version doit arriver après elle, jamais l'inverse.
    file.sort(function (a, b) { return a.horodatage - b.horodatage; });

    for (var i = 0; i < file.length; i++) {
      var entree = file[i];
      try {
        var envoyer = (window.appelApi && window.appelApi.__original) || window.appelApi;
        if (typeof envoyer !== 'function') { restantes.push(entree); continue; }
        var reponse = await envoyer(entree.chemin, {
          method: entree.methode,
          headers: entree.entetes,
          body: entree.corps
        });
        if (!reponse) { restantes.push(entree); continue; }

        if (reponse.ok) {
          envoyees++;
        } else if (reponse.status >= 400 && reponse.status < 500) {
          // Refus définitif du serveur (donnée devenue invalide, droits
          // retirés…). La rejouer indéfiniment ne servirait à rien.
          rejetees++;
        } else {
          restantes.push(entree);
        }
      } catch (e) {
        restantes.push(entree);
      }
    }

    ecrireFile(restantes);
    synchronisationEnCours = false;

    if (rejetees > 0) {
      annoncer(
        envoyees + ' modification(s) envoyée(s), ' + rejetees + ' refusée(s) par le serveur — à ressaisir.',
        'erreur'
      );
    } else if (envoyees > 0) {
      annoncer(envoyees + ' modification(s) envoyée(s).', 'succes');
      // Les écrans affichent des données désormais périmées : on recharge.
      setTimeout(function () { window.location.reload(); }, 1800);
    } else {
      majBandeau();
    }
  }

  // ------------------------------------------------------------------
  //  Service worker
  // ------------------------------------------------------------------
  function installerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Chemin relatif : indispensable sur GitHub Pages, où le site vit dans
    // un sous-dossier et non à la racine du domaine.
    navigator.serviceWorker.register('sw.js').catch(function (e) {
      console.warn('[Ardoise] service worker non installé :', e);
    });
  }

  // ------------------------------------------------------------------
  //  Démarrage
  // ------------------------------------------------------------------
  function demarrer() {
    installerServiceWorker();
    installerEnveloppe();

    majBandeau();
    if (navigator.onLine) synchroniser();

    window.addEventListener('online', function () { majBandeau(); synchroniser(); });
    window.addEventListener('offline', majBandeau);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }

  window.ArdoiseHorsLigne = {
    enAttente: function () { return lireFile().length; },
    synchroniser: synchroniser,
    vider: function () { ecrireFile([]); majBandeau(); }
  };
})();
