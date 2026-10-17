/* =============================================================================
   ARDOISE — NOTIFICATIONS SUR L'APPAREIL (Web Push)
   =============================================================================

   CE QUE FAIT CE FICHIER
   ----------------------
   Il permet à Ardoise d'afficher une notification système — « Grâce Mukendi
   — Réunion des titulaires » — sur le téléphone ou l'ordinateur, même
   application fermée, dès qu'un message ou une alerte arrive. Le serveur
   (utils/push.service.js) envoie ; ce fichier abonne l'appareil, et `sw.js`
   affiche la notification puis ouvre le bon écran au toucher.

   QUAND L'AUTORISATION EST DEMANDÉE
   ---------------------------------
   Un navigateur n'accorde les notifications qu'à la suite d'un geste de
   l'utilisateur (sur iPhone, c'est obligatoire). Ce fichier présente donc une
   invitation, avec un bouton « Activer » :

     · au PREMIER LANCEMENT de l'application installée (écran d'accueil) ;
     · une fois dans le navigateur, quelques secondes après l'arrivée ;
     · « Plus tard » la fait revenir une semaine après.

   Une fois l'autorisation donnée, tout est automatique : l'appareil est
   (ré)enregistré à chaque ouverture, pour le compte connecté. Le réglage
   « Notifications sur cet appareil » de Mon profil permet de les couper.

   iPhone et iPad : Apple ne permet les notifications web qu'aux applications
   AJOUTÉES À L'ÉCRAN D'ACCUEIL (iOS 16.4 et plus). Dans un onglet Safari,
   l'invitation n'apparaît pas, et Mon profil explique comment faire.

   Rien ne s'affiche tant que le serveur n'est pas prêt (clés et migration
   073) : la route de clé répond alors « indisponible ».
   ============================================================================= */

(function () {
  'use strict';

  if (window.ArdoisePush) return;

  var CLE_REPORT = 'ardoise_push_report';
  var CLE_COUPE = 'ardoise_push_coupe';
  var CLE_SYNCHRO = 'ardoise_push_synchro';
  var CLE_VU_INSTALLE = 'ardoise_push_invite_installee';
  var REPORT_MS = 7 * 24 * 3600 * 1000;

  function lire(cle) { try { return localStorage.getItem(cle); } catch (e) { return null; } }
  function ecrire(cle, valeur) {
    try {
      if (valeur === null) localStorage.removeItem(cle); else localStorage.setItem(cle, valeur);
    } catch (e) { /* stockage indisponible : l'invitation reviendra, sans plus */ }
  }

  function estIOS() {
    var ua = navigator.userAgent || '';
    return /iP(hone|od|ad)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function estInstallee() {
    return window.navigator.standalone === true
      || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function supporte() {
    return window.isSecureContext && 'serviceWorker' in navigator
      && 'PushManager' in window && 'Notification' in window;
  }
  function enObservation() { return !!lire('ardoise_observation'); }

  /* ------------------------------------------------------------- Serveur */

  function connecte() {
    if (window.ArdoiseSession && ArdoiseSession.connecte) return ArdoiseSession.connecte();
    if (window.SA && SA.session && SA.session.jetons) {
      try { return !!SA.session.jetons().acces; } catch (e) { return false; }
    }
    return false;
  }

  function utilisateurId() {
    var u = null;
    if (window.ArdoiseSession && ArdoiseSession.utilisateur) u = ArdoiseSession.utilisateur();
    if (!u) { try { u = JSON.parse(lire('ardoise_user') || sessionStorage.getItem('ardoise_user') || 'null'); } catch (e) {} }
    return (u && (u.id || u.utilisateur_id)) || '';
  }

  /** Appel authentifié, par l'outil de la page (école ou console). */
  function appeler(chemin, options) {
    if (window.ArdoiseSession && ArdoiseSession.appelApi) {
      return ArdoiseSession.appelApi(chemin, options).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          return { ok: r.ok, statut: r.status, donnees: d || {} };
        });
      });
    }
    if (window.SA && SA.api) {
      return SA.api(chemin, options).then(
        function (d) { return { ok: true, statut: 200, donnees: d || {} }; },
        function (e) { return { ok: false, statut: (e && e.statut) || 0, donnees: {} }; }
      );
    }
    return Promise.reject(new Error('Aucune session.'));
  }

  var cleServeur = null;   // null : pas encore demandée ; '' : indisponible
  function obtenirCle() {
    if (cleServeur !== null) return Promise.resolve(cleServeur);
    return appeler('/notifications/push/cle').then(function (r) {
      cleServeur = (r.ok && r.donnees.disponible && r.donnees.cle) ? r.donnees.cle : '';
      return cleServeur;
    }).catch(function () {
      // Réseau absent : on ne conclut rien, la prochaine ouverture redemandera.
      return '';
    });
  }

  function octets(base64url) {
    var b = (base64url + '==='.slice((base64url.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    var brut = atob(b), sortie = new Uint8Array(brut.length);
    for (var i = 0; i < brut.length; i++) sortie[i] = brut.charCodeAt(i);
    return sortie;
  }

  function nomAppareil() {
    var ua = navigator.userAgent || '';
    var systeme = estIOS() ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android'
      : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Appareil';
    var nav = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
      : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
    return (systeme + (nav ? ' · ' + nav : '') + (estInstallee() ? ' · application' : '')).slice(0, 120);
  }

  /* -------------------------------------------------------- Abonnement */

  function enregistrementSW() {
    // `hors-ligne.js` enregistre déjà `sw.js` sur les écrans de l'école ; la
    // console ne le charge pas. `register` est idempotent.
    return navigator.serviceWorker.getRegistration().then(function (reg) {
      return reg || navigator.serviceWorker.register('sw.js');
    }).then(function () { return navigator.serviceWorker.ready; });
  }

  function abonnementActuel() {
    return enregistrementSW().then(function (reg) { return reg.pushManager.getSubscription(); });
  }

  function marqueSynchro(sub) {
    var jour = new Date().toISOString().slice(0, 10);
    return utilisateurId() + '|' + sub.endpoint + '|' + jour;
  }

  function envoyerAuServeur(sub, confirmer) {
    return appeler('/notifications/push/abonnement', {
      method: 'POST',
      body: JSON.stringify({ abonnement: sub.toJSON(), appareil: nomAppareil(), confirmer: !!confirmer })
    }).then(function (r) {
      if (r.ok) ecrire(CLE_SYNCHRO, marqueSynchro(sub));
      return r.ok;
    });
  }

  function abonner(cle) {
    return enregistrementSW().then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) {
        return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octets(cle) });
      });
    });
  }

  /**
   * Active les notifications. À appeler DEPUIS un geste (toucher, clic) :
   * c'est la seule façon d'obtenir l'autorisation, et la seule admise par iOS.
   * @returns {Promise<'active'|'refuse'|'ignore'|'indisponible'|'non_supporte'>}
   */
  function activer() {
    if (!supporte()) return Promise.resolve('non_supporte');
    ecrire(CLE_COUPE, null);
    var demande;
    try {
      demande = Notification.requestPermission();
    } catch (e) {
      demande = new Promise(function (ok) { Notification.requestPermission(ok); });
    }
    return Promise.resolve(demande).then(function (perm) {
      if (perm === 'denied') return 'refuse';
      if (perm !== 'granted') return 'ignore';
      return obtenirCle().then(function (cle) {
        if (!cle) return 'indisponible';
        return abonner(cle)
          .then(function (sub) { return envoyerAuServeur(sub, true); })
          .then(function (ok) { return ok ? 'active' : 'indisponible'; });
      });
    }).catch(function () { return 'indisponible'; });
  }

  /** Coupe les notifications sur CET appareil (les autres ne changent pas). */
  function desactiver() {
    ecrire(CLE_COUPE, '1');
    ecrire(CLE_SYNCHRO, null);
    if (!supporte()) return Promise.resolve(true);
    return abonnementActuel().then(function (sub) {
      if (!sub) return true;
      var endpoint = sub.endpoint;
      return sub.unsubscribe().catch(function () {}).then(function () {
        return appeler('/notifications/push/abonnement', {
          method: 'DELETE', body: JSON.stringify({ endpoint: endpoint })
        }).catch(function () {});
      }).then(function () { return true; });
    });
  }

  /** État de cet appareil, pour Mon profil et l'invitation. */
  function etat() {
    if (!supporte()) {
      return Promise.resolve(estIOS() && !estInstallee() ? 'ios_navigateur' : 'non_supporte');
    }
    if (Notification.permission === 'denied') return Promise.resolve('refuse');
    if (Notification.permission !== 'granted') return Promise.resolve('a_demander');
    if (lire(CLE_COUPE)) return Promise.resolve('coupe');
    return abonnementActuel().then(function (sub) { return sub ? 'active' : 'a_reprendre'; })
      .catch(function () { return 'a_reprendre'; });
  }

  /**
   * Autorisation déjà donnée : l'appareil est rattaché au compte connecté,
   * sans rien demander. Une fois par jour et par compte, ou dès que le point
   * de livraison change (le navigateur peut le renouveler).
   */
  var synchroEnCours = null;
  function synchroniser() {
    if (!supporte() || Notification.permission !== 'granted' || lire(CLE_COUPE)) return Promise.resolve();
    // Le démarrage et Mon profil la demandent tous deux : un seul envoi.
    if (synchroEnCours) return synchroEnCours;
    synchroEnCours = obtenirCle().then(function (cle) {
      if (!cle) return null;
      return abonner(cle).then(function (sub) {
        if (lire(CLE_SYNCHRO) === marqueSynchro(sub)) return null;
        return envoyerAuServeur(sub, false);
      });
    }).catch(function () {}).then(function () { synchroEnCours = null; });
    return synchroEnCours;
  }

  /* ---------------------------------------------------------- Invitation */

  var STYLE = [
    '.ard-push-invite{position:fixed;z-index:1350;left:12px;right:12px;bottom:calc(var(--ard-reserve-bas,16px) + 4px);',
    'max-width:420px;margin:0 auto;display:grid;grid-template-columns:auto 1fr;gap:12px 14px;align-items:start;',
    'padding:16px;border-radius:22px;background:var(--craie-2,#fff);color:var(--texte-sombre,#1c1c1e);',
    'box-shadow:0 18px 50px rgba(0,0,0,.22),0 2px 8px rgba(0,0,0,.08),inset 0 0 0 1px rgba(0,0,0,.04);',
    'font-family:var(--police-corps,system-ui,-apple-system,sans-serif);',
    'transform:translateY(24px);opacity:0;transition:transform .45s cubic-bezier(.32,.72,0,1),opacity .3s ease}',
    '.ard-push-invite.visible{transform:none;opacity:1}',
    'html[data-theme="fluide"] .ard-push-invite{background:linear-gradient(170deg,rgba(255,255,255,.95),rgba(236,246,251,.93));',
    '-webkit-backdrop-filter:blur(30px) saturate(200%);backdrop-filter:blur(30px) saturate(200%)}',
    '@media (min-width:781px){.ard-push-invite{left:auto;right:24px;bottom:24px;width:380px}}',
    '.ard-push-icone{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;',
    'background:var(--ocre,#C98A3E);color:#fff}',
    '.ard-push-icone svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}',
    '.ard-push-texte strong{display:block;font-size:16px;font-weight:650;margin:2px 0 4px}',
    '.ard-push-texte span{display:block;font-size:14px;line-height:1.4;color:var(--texte-att,#6b7269)}',
    '.ard-push-actions{grid-column:1/-1;display:flex;gap:8px;justify-content:flex-end}',
    '.ard-push-actions button{min-height:42px;padding:9px 18px;border-radius:999px;border:0;font:inherit;',
    'font-size:15px;font-weight:600;cursor:pointer}',
    '.ard-push-plus-tard{background:rgba(118,118,128,.14);color:inherit}',
    '.ard-push-activer{background:var(--ocre,#C98A3E);color:#fff}',
    '.ard-push-actions button:disabled{opacity:.6}',
    'html.ard-mob-ouvert .ard-push-invite,html.ard-clavier .ard-push-invite{display:none}',
    '@media print{.ard-push-invite{display:none}}',
    '@media (prefers-reduced-motion:reduce){.ard-push-invite{transition:none}}'
  ].join('');

  var CLOCHE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z"/>'
    + '<path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>';

  function fermerInvitation(carte) {
    carte.classList.remove('visible');
    setTimeout(function () { if (carte.parentNode) carte.parentNode.removeChild(carte); }, 450);
  }

  function montrerInvitation() {
    if (document.querySelector('.ard-push-invite')) return;
    if (!document.getElementById('ard-push-style')) {
      var st = document.createElement('style');
      st.id = 'ard-push-style';
      st.textContent = STYLE;
      document.head.appendChild(st);
    }
    var carte = document.createElement('div');
    carte.className = 'ard-push-invite';
    carte.setAttribute('role', 'dialog');
    carte.setAttribute('aria-labelledby', 'ard-push-titre');
    carte.innerHTML = '<div class="ard-push-icone">' + CLOCHE + '</div>'
      + '<div class="ard-push-texte"><strong id="ard-push-titre">Recevoir les messages d’Ardoise</strong>'
      + '<span>Soyez prévenu sur cet appareil dès qu’un message ou une alerte arrive, même quand l’application est fermée.</span></div>'
      + '<div class="ard-push-actions"><button type="button" class="ard-push-plus-tard">Plus tard</button>'
      + '<button type="button" class="ard-push-activer">Activer</button></div>';
    document.body.appendChild(carte);
    requestAnimationFrame(function () { requestAnimationFrame(function () { carte.classList.add('visible'); }); });

    var texte = carte.querySelector('.ard-push-texte span');
    var boutonActiver = carte.querySelector('.ard-push-activer');
    var boutonPlusTard = carte.querySelector('.ard-push-plus-tard');

    boutonPlusTard.addEventListener('click', function () {
      ecrire(CLE_REPORT, String(Date.now()));
      fermerInvitation(carte);
    });
    boutonActiver.addEventListener('click', function () {
      boutonActiver.disabled = true;
      // Appelé dans le geste : condition de l'autorisation, surtout sur iOS.
      activer().then(function (resultat) {
        if (resultat === 'active') {
          carte.querySelector('strong').textContent = 'Notifications activées';
          texte.textContent = 'Vous serez prévenu ici dès qu’un message arrive.';
          carte.querySelector('.ard-push-actions').style.display = 'none';
          setTimeout(function () { fermerInvitation(carte); }, 2400);
        } else if (resultat === 'refuse') {
          texte.textContent = 'Autorisation refusée. Vous pourrez la donner plus tard dans les réglages de l’appareil, puis dans Mon profil.';
          boutonActiver.style.display = 'none';
          boutonPlusTard.textContent = 'Fermer';
          ecrire(CLE_REPORT, String(Date.now()));
        } else {
          // Fenêtre système fermée sans choix, ou serveur momentanément
          // injoignable : on reproposera plus tard.
          ecrire(CLE_REPORT, String(Date.now()));
          fermerInvitation(carte);
        }
      });
    });
  }

  /** Faut-il inviter maintenant ? */
  function inviterSiPertinent() {
    if (!supporte() || Notification.permission !== 'default' || lire(CLE_COUPE)) return;
    var installee = estInstallee();
    // Premier lancement de l'application installée : l'invitation vient
    // toujours, même après un « Plus tard » donné dans le navigateur.
    var premierLancement = installee && !lire(CLE_VU_INSTALLE);
    var report = Number(lire(CLE_REPORT) || 0);
    if (!premierLancement && report && Date.now() - report < REPORT_MS) return;
    obtenirCle().then(function (cle) {
      if (!cle) return;
      setTimeout(function () {
        if (Notification.permission !== 'default') return;
        if (installee) ecrire(CLE_VU_INSTALLE, '1');
        montrerInvitation();
      }, installee ? 1500 : 4000);
    });
  }

  /* ------------------------------------------------------- Mon profil */

  var AIDES = {
    active: 'Les messages et alertes d’Ardoise s’affichent sur cet appareil, même application fermée.',
    a_demander: 'Recevez sur cet appareil les messages et alertes d’Ardoise, même application fermée.',
    a_reprendre: 'Recevez sur cet appareil les messages et alertes d’Ardoise, même application fermée.',
    coupe: 'Notifications coupées sur cet appareil. Vos autres appareils ne changent pas.',
    refuse: 'Les notifications sont bloquées pour Ardoise dans les réglages de cet appareil ou du navigateur. Autorisez-les là, puis revenez ici.',
    ios_navigateur: 'Sur iPhone et iPad, ajoutez d’abord Ardoise à l’écran d’accueil (Partager → « Sur l’écran d’accueil »), puis ouvrez-la depuis son icône : le réglage apparaîtra ici.',
    non_supporte: 'Ce navigateur ne permet pas les notifications. Essayez Chrome, Edge, Firefox ou Safari récents.',
    indisponible: 'Les notifications ne sont pas encore ouvertes sur Ardoise. Réessayez plus tard.'
  };

  function brancherProfil() {
    var section = document.getElementById('section-notifications-push');
    var caseAcocher = document.getElementById('case-notifications-push');
    if (!section || !caseAcocher) return;
    var aide = document.getElementById('aide-notifications-push');
    var confirmation = document.getElementById('confirmation-notifications-push');

    function afficher(e) {
      caseAcocher.checked = e === 'active';
      caseAcocher.disabled = e === 'refuse' || e === 'ios_navigateur' || e === 'non_supporte';
      if (aide) aide.textContent = AIDES[e] || AIDES.a_demander;
    }

    // L'état n'est lu qu'après la synchronisation : sinon un appareil
    // autorisé mais pas encore rattaché s'afficherait « coupé ».
    obtenirCle().then(function (cle) {
      return (enObservation() ? Promise.resolve() : synchroniser()).then(function () { return cle; });
    }).then(function (cle) {
      section.hidden = false;
      return etat().then(function (e) {
        // Serveur pas encore prêt : l'appareil le permettrait, Ardoise pas encore.
        var horsService = !cle && e !== 'ios_navigateur' && e !== 'non_supporte';
        afficher(horsService ? 'indisponible' : e);
        if (horsService) caseAcocher.disabled = true;
      });
    });

    caseAcocher.addEventListener('change', function () {
      caseAcocher.disabled = true;
      if (confirmation) confirmation.textContent = '';
      var action = caseAcocher.checked ? activer() : desactiver().then(function () { return 'coupe'; });
      action.then(function (r) {
        return etat().then(function (e) {
          afficher(r === 'indisponible' ? 'indisponible' : e);
          if (r === 'indisponible') caseAcocher.disabled = false;
          if (confirmation) {
            confirmation.textContent = r === 'active' ? 'Notifications activées sur cet appareil.'
              : r === 'coupe' ? 'Notifications coupées sur cet appareil.' : '';
          }
        });
      });
    });
  }

  /* -------------------------------------------------------- Démarrage */

  function demarrer() {
    brancherProfil();
    var essais = 0;
    // La console Super Admin ouvre sa session APRÈS le chargement (écran de
    // connexion) : on attend qu'elle existe, sans insister indéfiniment.
    (function attendre() {
      if (!connecte()) {
        if (++essais < 40) setTimeout(attendre, 3000);
        return;
      }
      if (enObservation()) return;
      synchroniser();
      inviterSiPertinent();
    })();
  }

  window.ArdoisePush = { activer: activer, desactiver: desactiver, etat: etat, synchroniser: synchroniser };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
