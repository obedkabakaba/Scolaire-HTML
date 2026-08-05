/* ==========================================================================
   Ardoise — Service worker
   --------------------------------------------------------------------------
   Rend la plateforme utilisable sans connexion :

     · les pages et leurs ressources sont servies depuis le cache ;
     · les dernières données consultées restent lisibles hors ligne ;
     · les écritures ne passent JAMAIS par ici — elles sont mises en file
       d'attente par hors-ligne.js, côté page.

   IMPORTANT : à chaque déploiement, incrémentez VERSION. C'est ce qui
   déclenche le remplacement du cache chez tous les utilisateurs ; sans ça,
   ils continueraient d'utiliser l'ancienne version des pages.
   ========================================================================== */

const VERSION = 'ardoise-v32';
const CACHE_COQUILLE = `${VERSION}-coquille`;
const CACHE_DONNEES = `${VERSION}-donnees`;

// Pages et ressources indispensables au fonctionnement hors ligne.
const COQUILLE = [
  './',
  'connexion.html',
  'changer-mot-de-passe.html',
  'dashboard-directeur.html',
  'espace-professeur.html',
  'espace-titulaire.html',
  'espace-secretaire.html',
  'presences.html',
  'emploi-du-temps.html',
  'notes.html',
  'bulletins.html',
  'bulletin-annuel.html',
  'cours-classe-titulaire.html',
  'eleves.html',
  'inscriptions.html',
  'orientation.html',
  'classes.html',
  'utilisateurs.html',
  'annee-scolaire.html',
  'frais-scolaires.html',
  'calendrier.html',
  'journal.html',
  'parametres.html',
  'generateur-modeles.html',
  'mon-profil.html',
  'messages.html',
  'site-public.html',
  'discipline.html',
  'cours.html',
  'archives.html',
  'rapports.html',
  'super-admin.html',
  'theme.css',
  'ui.css',
  'theme.js',
  'ui.js',
  'acces-presences.js',
  'hors-ligne.js',
  'manifest.json',
  'icone-192.png',
  'icone-512.png',
  'icone-ios-180.png',
  'icone-maskable-512.png'
];

// Jamais mis en cache : la sécurité ne doit pas dépendre d'une copie locale.
const JAMAIS_EN_CACHE = ['/auth/', '/uploads/'];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil((async () => {
    const cache = await caches.open(CACHE_COQUILLE);
    // addAll échoue en bloc si un seul fichier manque : on ajoute donc
    // les ressources une par une pour qu'un oubli ne casse pas l'installation.
    await Promise.all(COQUILLE.map(async (chemin) => {
      try { await cache.add(new Request(chemin, { cache: 'reload' })); }
      catch (e) { console.warn('[SW] ressource ignorée :', chemin); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(
      noms.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

// Permet à la page de forcer l'activation d'une nouvelle version.
self.addEventListener('message', (evenement) => {
  if (evenement.data === 'ardoise:activer-maintenant') self.skipWaiting();
});

function estRessourceSensible(url) {
  return JAMAIS_EN_CACHE.some((motif) => url.pathname.includes(motif));
}

/** Réseau d'abord, cache en secours. Utilisé pour les pages et les données. */
async function reseauPuisCache(requete, nomCache) {
  const cache = await caches.open(nomCache);
  try {
    const reponse = await fetch(requete);
    if (reponse && reponse.ok) cache.put(requete, reponse.clone());
    return reponse;
  } catch (e) {
    const enCache = await cache.match(requete);
    if (enCache) {
      // On signale à la page que la donnée vient du cache, afin qu'elle
      // puisse afficher un avertissement plutôt que de faire croire au direct.
      const entetes = new Headers(enCache.headers);
      entetes.set('X-Ardoise-Cache', 'hors-ligne');
      return new Response(enCache.body, {
        status: enCache.status, statusText: enCache.statusText, headers: entetes
      });
    }
    throw e;
  }
}

/** Cache d'abord, mise à jour en arrière-plan. Utilisé pour le CSS et le JS. */
async function cachePuisReseau(requete, nomCache) {
  const cache = await caches.open(nomCache);
  const enCache = await cache.match(requete);
  const promesseReseau = fetch(requete)
    .then((reponse) => {
      if (reponse && reponse.ok) cache.put(requete, reponse.clone());
      return reponse;
    })
    .catch(() => null);
  return enCache || promesseReseau.then((r) => r || Promise.reject(new Error('hors ligne')));
}

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  const url = new URL(requete.url);

  // Les écritures traversent sans interception : c'est hors-ligne.js qui
  // décide de les mettre en file d'attente quand la connexion manque.
  if (requete.method !== 'GET') return;
  if (estRessourceSensible(url)) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Navigation entre pages : réseau d'abord pour recevoir les mises à jour,
  // cache en secours pour que la coupure ne produise pas une page blanche.
  if (requete.mode === 'navigate') {
    evenement.respondWith((async () => {
      try {
        return await reseauPuisCache(requete, CACHE_COQUILLE);
      } catch (e) {
        const cache = await caches.open(CACHE_COQUILLE);
        return (await cache.match(requete))
          || (await cache.match('connexion.html'))
          || new Response('Hors ligne', { status: 503, statusText: 'Hors ligne' });
      }
    })());
    return;
  }

  // Appels de données vers le backend.
  if (url.origin !== self.location.origin) {
    evenement.respondWith(
      reseauPuisCache(requete, CACHE_DONNEES).catch(() =>
        new Response(
          JSON.stringify({ message: 'Vous êtes hors ligne et cette donnée n\'a jamais été consultée sur cet appareil.', hors_ligne: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Ressources locales : polices, styles, scripts, images.
  evenement.respondWith(
    cachePuisReseau(requete, CACHE_COQUILLE).catch(() =>
      new Response('', { status: 503, statusText: 'Hors ligne' })
    )
  );
});
