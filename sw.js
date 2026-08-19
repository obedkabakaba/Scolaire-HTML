/* Ardoise — Service worker sécurisé
   Les ressources statiques restent disponibles hors ligne.
   Les réponses API authentifiées NE SONT PLUS mises en cache tant qu'un cache
   partitionné par utilisateur + école n'a pas été conçu et testé. */

/* VERSION DU CACHE — à incrémenter à CHAQUE changement d'actif statique.
   -----------------------------------------------------------------------
   `activate` supprime tout cache dont le nom ne commence pas par VERSION.
   Sans cet incrément, un téléphone où Ardoise est déjà installée continuerait
   de servir les anciennes ressources depuis CacheStorage.

   v54 : charge le parcours corrigé des écoles sans abonnement actif.
   v55 : un seul écran de blocage, opaque, application réellement masquée —
         sans cet incrément, les téléphones déjà installés continueraient de
         servir depuis le cache les `session.js` et `ui.js` qui superposaient
         deux voiles floutés, c'est-à-dire précisément le défaut corrigé.
   v56 : une mise à jour ne peut plus laisser un téléphone sans rien.

   CE QUE v56 CORRIGE, ET POURQUOI ÇA COMPTE ICI
   -----------------------------------------------------------------------
   `activate` supprimait l'ancien cache DÈS que le nouveau était déclaré
   installé — or `install` ignore volontairement les ressources qu'il n'a pas
   pu télécharger (`catch` par fichier). Sur une connexion d'école, quelques
   fichiers manquent presque toujours. L'ancien cache parti, ces fichiers-là
   n'existaient plus nulle part, et `fetch` renvoyait alors une réponse 503
   VIDE : page sans style, sans script — ou entièrement blanche.

   Autrement dit, chaque incrément de version faisait courir ce risque à
   toutes les écoles, et il grandissait avec la qualité du réseau. Deux
   garde-fous : on ne supprime l'ancien cache que si le nouveau est COMPLET,
   et un fichier introuvable est cherché dans les caches précédents avant
   qu'on abandonne. */
const VERSION='ardoise-v56';
const CACHE_COQUILLE=`${VERSION}-coquille`;
const COQUILLE=[
  './','connexion.html','changer-mot-de-passe.html','dashboard-directeur.html',
  'espace-professeur.html','espace-titulaire.html','espace-secretaire.html',
  'presences.html','emploi-du-temps.html','notes.html','bulletins.html',
  'bulletin-annuel.html','cours-classe-titulaire.html','eleves.html','inscriptions.html',
  'orientation.html','classes.html','utilisateurs.html','annee-scolaire.html',
  'frais-scolaires.html','comptabilite.html','repechage.html','calendrier.html',
  'journal.html','parametres.html','generateur-modeles.html',
  'apercu-bulletin-primaire.html','apercu-bulletin-secondaire.html',
  'apercu-bulletin-terminale.html','apercu-bulletin-semestre.html',
  'mon-profil.html','messages.html','site-public.html','discipline.html','cours.html',
  'archives.html','rapports.html','super-admin.html','theme.css','theme-base.css','ui.css','mobile.css',
  'mobile.js','theme.js','ui.js','session.js','abonnements-page.js','acces-presences.js','filtre-cycle.js',
  'hors-ligne.js','didacticiel.js','didacticiel.css','super-admin-styles.css',
  'super-admin-noyau.js','super-admin-vues-pilotage.js','super-admin-vues-ecoles.js',
  'super-admin-vues-explorer.js','super-admin-vues-systeme.js','manifest.json',
  'icone-192.png','icone-384.png','icone-512.png','icone-ios-180.png',
  'icone-maskable-192.png','icone-maskable-512.png','manifest.webmanifest'
];

self.addEventListener('install',(event)=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_COQUILLE);
    await Promise.all(COQUILLE.map(async(p)=>{try{await cache.add(new Request(p,{cache:'reload'}));}catch(e){console.warn('[SW] ressource ignorée',p);}}));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',(event)=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_COQUILLE);

    /* On ne jette l'ancien cache QUE si le nouveau tient debout tout seul.
       Sinon on le garde : servir un fichier de la version précédente est un
       inconvénient, ne rien servir du tout est une panne. Le cache neuf se
       complétera de lui-même à la première visite en réseau correct — chaque
       réponse valide y est déposée par `cachePuisReseauLocal`. */
    const manquants=(await Promise.all(
      COQUILLE.map(async(p)=>(await cache.match(p))?null:p))).filter(Boolean);

    if(manquants.length){
      console.warn('[SW] installation incomplète ('+manquants.length+' ressource(s)) :'
        +' cache précédent conservé.');
    }else{
      const noms=await caches.keys();
      await Promise.all(noms.filter((n)=>!n.startsWith(VERSION)).map((n)=>caches.delete(n)));
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message',(event)=>{
  if(event.data==='ardoise:activer-maintenant')self.skipWaiting();
  if(event.data==='ardoise:purger-donnees'){
    event.waitUntil(caches.keys().then((noms)=>Promise.all(noms.filter((n)=>n!==CACHE_COQUILLE).map((n)=>caches.delete(n)))));
  }
});

async function reseauPuisCacheLocal(req){
  const cache=await caches.open(CACHE_COQUILLE);
  try{const r=await fetch(req);if(r&&r.ok)cache.put(req,r.clone());return r;}
  // `caches.match` cherche dans TOUS les caches, y compris celui d'une version
  // précédente resté en place faute d'installation complète.
  catch(e){const c=(await cache.match(req))||(await caches.match(req));if(c)return c;throw e;}
}
async function cachePuisReseauLocal(req){
  const cache=await caches.open(CACHE_COQUILLE);
  const c=await cache.match(req);
  if(c)return c;
  try{
    const r=await fetch(req);
    if(r&&r.ok)cache.put(req,r.clone());
    return r;
  }catch(e){
    /* DERNIER RECOURS AVANT LE VIDE. Un fichier absent du cache neuf et
       injoignable par le réseau existe peut-être encore dans le cache d'hier.
       Servir un `ui.js` d'hier n'est pas idéal ; renvoyer une réponse vide à
       la place d'une feuille de style ou d'un script donne une page blanche,
       et c'est bien pire. */
    const ancien=await caches.match(req);
    if(ancien)return ancien;
    throw e;
  }
}

self.addEventListener('fetch',(event)=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.protocol!=='http:'&&url.protocol!=='https:')return;

  /* SÉCURITÉ MULTI-TENANT : toute requête cross-origin est potentiellement une
     réponse de l'API Render. On la laisse au réseau et on ne la stocke jamais.
     Ainsi A ne peut pas laisser dans CacheStorage une réponse que B lirait
     ensuite hors ligne sur le même appareil. */
  if(url.origin!==self.location.origin){
    event.respondWith(fetch(req).catch(()=>new Response(JSON.stringify({
      message:'Cette donnée nécessite une connexion. Aucune copie d’une autre session n’est servie.',
      hors_ligne:true
    }),{status:503,headers:{'Content-Type':'application/json','X-Ardoise-Cache':'desactive-donnees'}})));
    return;
  }

  if(req.mode==='navigate'){
    event.respondWith(reseauPuisCacheLocal(req).catch(async()=>{
      const cache=await caches.open(CACHE_COQUILLE);
      return (await cache.match(req))||(await cache.match('connexion.html'))||new Response('Hors ligne',{status:503});
    }));
    return;
  }

  event.respondWith(cachePuisReseauLocal(req).catch(()=>new Response('',{status:503,statusText:'Hors ligne'})));
});