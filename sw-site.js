/* Service worker du SITE d'une école ou d'un centre (et de son application
   installée). Volontairement minuscule : il ne connaît QUE le site — jamais
   l'application Ardoise, qui a le sien (sw.js) sur myardoise.com.

   · Les pages et les fichiers du site : réseau d'abord, copie en secours.
     Sans réseau, l'application de l'école s'ouvre quand même sur la
     dernière version vue.
   · L'API (autre domaine) n'est jamais interceptée : les données vivantes
     (planning, notes, classe en ligne) viennent toujours du serveur. */
var CACHE = 'ardoise-site-v2';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (c) { return c.indexOf('ardoise-site-') === 0 && c !== CACHE; })
      .map(function (c) { return caches.delete(c); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (ev) {
  var r = ev.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  var page = r.mode === 'navigate';
  if (!page && !/\.(css|js|png|jpe?g|svg|webp|gif|ico|woff2?)$/i.test(u.pathname)) return;
  ev.respondWith(fetch(r).then(function (rep) {
    if (rep && rep.ok) {
      var copie = rep.clone();
      caches.open(CACHE).then(function (c) { c.put(page ? new Request(self.registration.scope) : r, copie); });
    }
    return rep;
  }).catch(function () {
    return caches.match(page ? new Request(self.registration.scope) : r).then(function (m) {
      return m || new Response('Hors connexion.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    });
  }));
});

/* NOTIFICATIONS — messages du coach et du groupe, rappels de cours,
   résumés. Le serveur envoie { titre, corps, lien, tag, icone } ; « lien » est
   relatif à l'application du site (ex. « #/apprenant?onglet=discussions »). */
self.addEventListener('push', function (ev) {
  var d = {};
  try { d = ev.data ? ev.data.json() : {}; } catch (x) { d = { titre: 'Nouveau message', corps: ev.data ? ev.data.text() : '' }; }
  var titre = d.titre || 'Nouveau message';
  ev.waitUntil(self.registration.showNotification(titre, {
    body: d.corps || '',
    tag: d.tag || 'ardoise-site',
    renotify: true,
    icon: d.icone || '/icone-192.png',
    badge: '/icone-192.png',
    data: { lien: d.lien || '#/apprenant' },
    timestamp: d.date || Date.now()
  }));
});

self.addEventListener('notificationclick', function (ev) {
  ev.notification.close();
  var lien = (ev.notification.data && ev.notification.data.lien) || '#/apprenant';
  // Portée « https://myardoise.com/speak-up » → « …/speak-up#/apprenant » ;
  // portée « https://eacenter.myardoise.com/ » → « …/#/apprenant ».
  var cible = lien.charAt(0) === '#' ? self.registration.scope + lien : new URL(lien, self.registration.scope).href;
  ev.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (fenetres) {
    for (var i = 0; i < fenetres.length; i += 1) {
      var f = fenetres[i];
      if (f.url.indexOf(self.registration.scope.replace(/\/$/, '')) === 0 && 'focus' in f) {
        if ('navigate' in f) f.navigate(cible).catch(function () {});
        return f.focus();
      }
    }
    return self.clients.openWindow(cible);
  }));
});
