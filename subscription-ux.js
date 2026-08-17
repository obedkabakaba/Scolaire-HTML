/* Ardoise — navigation abonnement/support et anti-répétition des avertissements. */
(function () {
  'use strict';

  function sessionEcoleActive() {
    try {
      return Boolean(
        sessionStorage.getItem('ardoise_access_token')
        || localStorage.getItem('ardoise_access_token')
      );
    } catch (e) {
      return Boolean(window.ArdoiseSession && ArdoiseSession.connecte && ArdoiseSession.connecte());
    }
  }

  function cleMessage(message) {
    var normalise = String(message || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    return 'ardoise_avertissement_offre:' + normalise;
  }

  function dejaVu(message) {
    try {
      var cle = cleMessage(message);
      if (sessionStorage.getItem(cle) === '1') return true;
      sessionStorage.setItem(cle, '1');
    } catch (e) {
      window.__ardoiseOffreVus = window.__ardoiseOffreVus || {};
      var k = cleMessage(message);
      if (window.__ardoiseOffreVus[k]) return true;
      window.__ardoiseOffreVus[k] = true;
    }
    return false;
  }

  function estAvertissementOffre(message) {
    var m = String(message || '').toLowerCase();
    return m.indexOf('votre abonnement ne comprend pas') !== -1
      || m.indexOf('votre offre') !== -1 && (m.indexOf('comprend pas') !== -1 || m.indexOf('disponible') !== -1)
      || m.indexOf('espace') !== -1 && m.indexOf('offre') !== -1;
  }

  function installerConfirmation() {
    if (!sessionEcoleActive()) return false;
    if (!window.ArdoiseUI || typeof window.ArdoiseUI.confirmer !== 'function') return false;
    if (window.ArdoiseUI.confirmer.__abonnementCorrige) return true;

    var origine = window.ArdoiseUI.confirmer;
    var enveloppe = function (message, options) {
      var estOffre = estAvertissementOffre(message);
      if (estOffre && dejaVu(message)) return Promise.resolve(false);

      return Promise.resolve(origine(message, options)).then(function (ok) {
        if (ok && options && (options.libelleValider === 'Voir mon abonnement'
            || options.libelleValider === 'Voir les abonnements')) {
          window.location.href = 'abonnements.html';
          // L'appelant historique essaierait ensuite d'ouvrir paramètres.html.
          // On lui renvoie false : la navigation correcte a déjà été lancée.
          return false;
        }
        return ok;
      });
    };
    enveloppe.__abonnementCorrige = true;
    window.ArdoiseUI.confirmer = enveloppe;
    return true;
  }

  function corrigerLiens(racine) {
    // Le site public conserve son formulaire commercial. Ces redirections ne
    // concernent que l'application d'une école déjà authentifiée.
    if (!sessionEcoleActive()) return;

    var scope = racine && racine.querySelectorAll ? racine : document;
    scope.querySelectorAll('a').forEach(function (a) {
      var texte = String(a.textContent || '').trim().toLowerCase();
      if (texte === 'voir les abonnements' || texte === 'voir mon abonnement') {
        a.setAttribute('href', 'abonnements.html');
      }
      if (texte === 'contacter ardoise') {
        a.setAttribute('href', 'support.html');
      }
    });
  }

  function installer() {
    installerConfirmation();
    corrigerLiens(document);

    var observateur = new MutationObserver(function (mutations) {
      installerConfirmation();
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1) corrigerLiens(n);
        });
      });
    });
    observateur.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installer, { once: true });
  } else {
    installer();
  }
})();
