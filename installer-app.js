/* =====================================================================
   L'APPLICATION DE L'ÉCOLE — installée depuis son site public

   Chaque école, chaque centre a SON application : son nom, son logo, et
   elle s'ouvre directement sur son site, là où élèves, parents et
   apprenants se connectent. Plus besoin de retenir une adresse ni de
   chercher son école parmi d'autres.

   · Sur <adresse>.myardoise.com, le manifeste est servi par le serveur.
   · Sur myardoise.com/<adresse>, il est demandé à l'API.
   · Android et ordinateur : le bouton déclenche l'installation du
     navigateur. iPhone : la marche à suivre (Partager → Écran d'accueil).
   · Dans le navigateur de Facebook ou WhatsApp, qui ne sait pas installer :
     on explique comment ouvrir la page dans Chrome, avec le lien à copier.
   ===================================================================== */
(function () {
  'use strict';
  if (window.ArdoiseInstallerApp) return;

  var invite = window.__ardoiseInvite || null;
  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault(); invite = ev; window.__ardoiseInvite = ev; majPastille();
  });
  window.addEventListener('appinstalled', function () {
    invite = null; var p = document.getElementById('ard-app-pastille'); if (p) p.remove();
  });

  var cfg = null;
  function e(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function installee() {
    try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (x) { return false; }
  }
  var ua = navigator.userAgent || '';
  var iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /Android/i.test(ua);
  var navigateurIntegre = /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(ua);
  var mobile = iOS || android;

  function style() {
    if (document.getElementById('ard-app-style')) return;
    var s = document.createElement('style');
    s.id = 'ard-app-style';
    s.textContent = [
      '#ard-app-pastille{position:fixed;left:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:900;display:flex;align-items:center;gap:8px;background:#0E1C33;color:#fff;border-radius:999px;padding:10px 12px 10px 14px;box-shadow:0 8px 24px rgba(0,0,0,.25);font:600 14px/1.2 system-ui,sans-serif;max-width:calc(100vw - 28px)}',
      '#ard-app-pastille button{background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0}',
      '#ard-app-pastille .x{opacity:.7;font-size:18px;padding:0 4px;margin-left:2px}',
      '#ard-app-pastille img{width:26px;height:26px;border-radius:7px;object-fit:cover;background:#fff}',
      '.ard-app-voile{position:fixed;inset:0;background:rgba(10,15,25,.55);z-index:1000;display:flex;align-items:flex-end;justify-content:center}',
      '@media (min-width:700px){.ard-app-voile{align-items:center}}',
      '.ard-app-feuille{background:#fff;color:#1d2a2a;width:100%;max-width:440px;border-radius:22px 22px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom,0px));font:15px/1.5 system-ui,sans-serif;max-height:88vh;overflow:auto}',
      '@media (min-width:700px){.ard-app-feuille{border-radius:22px}}',
      '.ard-app-tete{display:flex;gap:12px;align-items:center;margin-bottom:12px}',
      '.ard-app-tete img{width:56px;height:56px;border-radius:14px;object-fit:cover;background:#f2f2f2;border:1px solid #eee}',
      '.ard-app-tete strong{display:block;font-size:17px}',
      '.ard-app-feuille ol{padding-left:20px;margin:10px 0}.ard-app-feuille li{margin:6px 0}',
      '.ard-app-btn{display:block;width:100%;border:0;border-radius:12px;padding:13px;font:600 15px system-ui,sans-serif;cursor:pointer;margin-top:10px;text-align:center;text-decoration:none}',
      '.ard-app-btn.principal{background:#0E1C33;color:#fff}.ard-app-btn.second{background:#f1f1ee;color:#1d2a2a}',
      '.ard-app-doux{color:#5d6766;font-size:13.5px}'
    ].join('');
    document.head.appendChild(s);
  }

  function icone() { return cfg && cfg.logo ? cfg.logo : '/icone-192.png'; }

  function majPastille() {
    if (!cfg || installee()) return;
    var cle = 'ard-app-refus:' + cfg.adresse;
    try { if (Number(localStorage.getItem(cle) || 0) > Date.now()) return; } catch (x) {}
    // La pastille ne s'impose que là où l'installation est vraiment utile :
    // sur téléphone, ou quand le navigateur propose l'installation.
    if (!invite && !mobile) return;
    if (document.getElementById('ard-app-pastille')) return;
    style();
    var p = document.createElement('div');
    p.id = 'ard-app-pastille';
    p.innerHTML = '<img alt="" src="' + e(icone()) + '"><button type="button" data-ouvrir>Installer l’application</button><button type="button" class="x" aria-label="Plus tard">×</button>';
    p.querySelector('[data-ouvrir]').addEventListener('click', ouvrir);
    p.querySelector('.x').addEventListener('click', function () {
      try { localStorage.setItem(cle, String(Date.now() + 14 * 864e5)); } catch (x) {}
      p.remove();
    });
    document.body.appendChild(p);
  }

  function lienPersonnel() {
    return 'https://myardoise.com/connexion.html?code=' + encodeURIComponent(cfg.code || cfg.adresse);
  }

  function ouvrir() {
    if (!cfg) return;
    if (invite && !iOS) {
      var ev = invite;
      ev.prompt();
      Promise.resolve(ev.userChoice).then(function (choix) {
        if (choix && choix.outcome === 'accepted') { invite = null; var p = document.getElementById('ard-app-pastille'); if (p) p.remove(); }
      });
      return;
    }
    style();
    var etapes;
    if (installee()) {
      etapes = '<p>L’application est déjà installée sur cet appareil. 👍</p>';
    } else if (iOS) {
      etapes = '<ol><li>Ouvrez cette page dans <strong>Safari</strong>.</li><li>Touchez le bouton <strong>Partager</strong> <span aria-hidden="true">⬆︎</span> en bas de l’écran.</li><li>Choisissez <strong>« Sur l’écran d’accueil »</strong>, puis <strong>Ajouter</strong>.</li></ol>';
    } else if (navigateurIntegre) {
      etapes = '<p>Ce navigateur (Facebook, WhatsApp…) ne sait pas installer d’application.</p><ol><li>Touchez <strong>⋮</strong> ou <strong>…</strong> en haut à droite.</li><li>Choisissez <strong>« Ouvrir dans Chrome »</strong> (ou « dans le navigateur »).</li><li>Revenez sur ce bouton.</li></ol>';
    } else if (android) {
      etapes = '<ol><li>Dans <strong>Chrome</strong>, touchez le menu <strong>⋮</strong> en haut à droite.</li><li>Choisissez <strong>« Installer l’application »</strong> ou <strong>« Ajouter à l’écran d’accueil »</strong>.</li></ol>';
    } else {
      etapes = '<ol><li>Dans <strong>Chrome</strong> ou <strong>Edge</strong>, cliquez sur l’icône d’installation à droite de la barre d’adresse.</li><li>Ou ouvrez cette page sur votre téléphone pour l’avoir toujours sur vous.</li></ol>';
    }
    var v = document.createElement('div');
    v.className = 'ard-app-voile';
    v.innerHTML = '<div class="ard-app-feuille" role="dialog" aria-modal="true" aria-label="Installer l’application">' +
      '<div class="ard-app-tete"><img alt="" src="' + e(icone()) + '"><div><strong>' + e(cfg.nom) + '</strong><span class="ard-app-doux">L’application ' + (cfg.centre ? 'du centre' : 'de l’école') + ', sur votre écran d’accueil</span></div></div>' +
      '<p class="ard-app-doux">Elle s’ouvre directement sur ' + (cfg.centre ? 'l’espace apprenant, le planning et les cours en ligne' : 'l’espace des parents et des élèves') + ' — sans chercher l’adresse, même avec une petite connexion.</p>' +
      etapes +
      (navigateurIntegre || !invite ? '<button type="button" class="ard-app-btn second" data-copier>Copier le lien de la page</button>' : '') +
      '<a class="ard-app-btn second" href="' + e(lienPersonnel()) + '">Personnel : se connecter à Ardoise</a>' +
      '<button type="button" class="ard-app-btn principal" data-fermer>Fermer</button></div>';
    document.body.appendChild(v);
    function fermer() { v.remove(); }
    v.addEventListener('click', function (ev) { if (ev.target === v) fermer(); });
    v.querySelector('[data-fermer]').addEventListener('click', fermer);
    var c = v.querySelector('[data-copier]');
    if (c) c.addEventListener('click', function () {
      var url = window.location.href.split('#')[0];
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { c.textContent = 'Lien copié ✓'; }).catch(function () { window.prompt('Copiez ce lien :', url); });
    });
  }

  /**
   * @param {{adresse:string, code:string, nom:string, logo:?string, api:string, centre:boolean}} options
   */
  function preparer(options) {
    cfg = options;
    var surDomaine = !!window.ARDOISE_SITE_DOMAINE;
    if (!surDomaine && !document.querySelector('link[rel="manifest"]') && /(^|\.)myardoise\.com$/.test(location.hostname)) {
      var l = document.createElement('link');
      l.rel = 'manifest';
      l.href = options.api + '/public/site/' + encodeURIComponent(options.adresse) + '/manifest.webmanifest';
      document.head.appendChild(l);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]') && options.logo) {
      var a = document.createElement('link'); a.rel = 'apple-touch-icon'; a.href = options.logo; document.head.appendChild(a);
      var t = document.createElement('meta'); t.name = 'apple-mobile-web-app-title'; t.content = options.nom; document.head.appendChild(t);
    }
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      var portee = surDomaine ? '/' : '/' + options.adresse;
      if (surDomaine || location.pathname.toLowerCase().indexOf('/' + options.adresse.toLowerCase()) === 0) {
        navigator.serviceWorker.register('/sw-site.js', { scope: portee }).catch(function () {});
      }
    }
    majPastille();
    // Lien « ?installer=1 » (depuis « L'application de mon école ») : on
    // ouvre directement la marche à suivre.
    if (/[?&]installer=1/.test(location.search)) setTimeout(ouvrir, 600);
  }

  window.ArdoiseInstallerApp = { preparer: preparer, ouvrir: ouvrir, lienPersonnel: function () { return cfg ? lienPersonnel() : '/connexion.html'; } };
})();
