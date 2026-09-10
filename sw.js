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
   qu'on abandonne.
   v57 : suppression d'offre — l'écran Super Admin ne contredit plus la base.
         `super-admin-vues-offres.js` ne figure pas dans la coquille ci-dessous,
         mais toute réponse valide est mise en cache à la première visite puis
         servie AVANT le réseau : sans incrément, le correctif n'atteindrait
         jamais un navigateur ayant déjà ouvert cet écran.
   v58 : le garde-fou descend dans `super-admin-noyau.js`, qui figure, lui,
         dans la coquille précachée — il serait servi depuis le cache pendant
         des semaines sans cet incrément.
   v59 : la connexion constate elle-même un accès bloqué quand le serveur ne
         l'annonce pas encore, et `cachePuisReseauLocal` relit à nouveau le
         réseau derrière un fichier servi depuis le cache — sans cela, un
         fichier corrigé n'atteignait le téléphone qu'au prochain incrément.
   v60 : la page Abonnements pose un délai sur son chargement. Sans lui, une
         requête partie vers un serveur endormi n'aboutissait jamais et la page
         restait sur « Chargement… », sans bouton ni message.
   v61 : quand aucune offre n'est proposable, la page le dit et donne un humain
         à joindre, au lieu d'un bouton qui ouvre une étape vide.
   v62 : le calendrier accepte trente-cinq types d'événements au lieu de sept,
         et les lit dans `evenements-types.js` — un fichier NOUVEAU, absent de
         la coquille d'un téléphone déjà installé. Sans cet incrément, il ne
         serait jamais téléchargé : le menu « Type » resterait vide et le
         formulaire d'ajout d'événement inutilisable sur ces appareils.
   v63 : `messages.html` gagne le canal WhatsApp. Ce fichier fait partie de la
         coquille : sans cet incrément, un téléphone où Ardoise est déjà
         installée continuerait d'afficher un formulaire à deux canaux, et son
         directeur conclurait que la fonctionnalité annoncée n'existe pas.
   v65 : le centre Support et ses styles entrent dans la coquille. La mise à
         jour corrige ses formulaires, ses erreurs réseau et ses conversations
         sans jamais mettre en cache les réponses authentifiées de l'API.
   v66 : le Support charge directement la base du thème et possède une coque
         de secours ; ce changement doit remplacer immédiatement l'ancienne
         page brute encore présente dans certains caches PWA.
   v67 : Abonnements reçoit le même garde-fou visuel et entre explicitement
         dans la coquille précachée afin que son écran de renouvellement ne
         puisse plus rester avec un rail incomplet après une mise à jour.
   v68 : recharge ui.css pour afficher le coin supérieur gauche arrondi du
         panneau principal sur les applications déjà installées.
   v69 : l'arrondi intérieur suit le rail déployé ou replié et reste visible
         pendant le défilement du contenu. Terranga (clé interne yohali) et son
         alias Kivu conservent leur apparence d'origine, sans cet ajout. */
const VERSION='ardoise-v79';
/* v78 : Fluide, panneaux de verre et raccourcis contextuels. */
/* v77 : Orbite garde son rail vertical après une ancienne position haut/bas. */
/* v76 : Orbite Aube, rail flottant et agenda lumineux. */
/* v75 : Nexus, carte contextuelle et commandes rapides. */
/* v74 : Récré, papier crème et dessins de cahier pour chaque rubrique. */
/* v73 : contraste WCAG de la bannière d’abonnement du Directeur. */
/* v72 : nouveaux noms d’apparence — Perspective devient Yohali, l’ancien Yohali devient Terranga. */
/* v71 : Perspective, illustrations architecturales et papeterie par rubrique. */
/* v70 : Élan, navigation horizontale et illustrations locales par rubrique. */
const CACHE_COQUILLE=`${VERSION}-coquille`;
const COQUILLE=[
  'theme-vibra.css',
  'theme-vibra.js',
  'public/vibra/campus.webp',
  'public/vibra/symbole.svg',
  'public/vibra/people.svg',
  'public/vibra/pen.svg',
  'public/vibra/card.svg',
  'public/vibra/send.svg',
  'theme-fluide.css',
  'theme-fluide.js',
  'public/fluide/card.svg',
  'public/fluide/pen.svg',
  'public/fluide/people.svg',
  'public/fluide/send.svg',
  'public/fluide/vague.svg',

  'theme-orbite.css',
  'theme-orbite.js',
  'public/orbite/horizon.svg',
  'public/orbite/symbole.svg',
  'theme-nexus.css',
  'theme-nexus.js',
  'public/nexus/reseau.svg',
  'theme-recre.css',
  'theme-recre.js',
  'public/recre/abonnement.svg',
  'public/recre/accueil.webp',
  'public/recre/agenda.svg',
  'public/recre/aide.svg',
  'public/recre/annee.svg',
  'public/recre/annuel.svg',
  'public/recre/archives.svg',
  'public/recre/bulletin.svg',
  'public/recre/cahier.svg',
  'public/recre/classe.svg',
  'public/recre/comptabilite.svg',
  'public/recre/discipline.svg',
  'public/recre/dossiers.svg',
  'public/recre/eleves.svg',
  'public/recre/equipe.svg',
  'public/recre/horaire.svg',
  'public/recre/inscriptions.svg',
  'public/recre/journal.svg',
  'public/recre/livres.svg',
  'public/recre/messages.svg',
  'public/recre/modeles.svg',
  'public/recre/notes.svg',
  'public/recre/orientation.svg',
  'public/recre/paiements.svg',
  'public/recre/pilotage.svg',
  'public/recre/presences.svg',
  'public/recre/profil.svg',
  'public/recre/rapports.svg',
  'public/recre/reglages.svg',
  'public/recre/repechage.svg',
  'public/recre/site.svg',
  'theme-perspective.css',
  'theme-perspective.js',
  'public/perspective/abonnement.svg',
  'public/perspective/accueil.webp',
  'public/perspective/agenda.svg',
  'public/perspective/aide.svg',
  'public/perspective/annee.svg',
  'public/perspective/annuel.svg',
  'public/perspective/archives.svg',
  'public/perspective/bulletin.svg',
  'public/perspective/cahier.svg',
  'public/perspective/classe.svg',
  'public/perspective/comptabilite.svg',
  'public/perspective/discipline.svg',
  'public/perspective/dossiers.svg',
  'public/perspective/eleves.svg',
  'public/perspective/equipe.svg',
  'public/perspective/horaire.svg',
  'public/perspective/inscriptions.svg',
  'public/perspective/journal.svg',
  'public/perspective/livres.svg',
  'public/perspective/messages.svg',
  'public/perspective/modeles.svg',
  'public/perspective/notes.svg',
  'public/perspective/orientation.svg',
  'public/perspective/paiements.svg',
  'public/perspective/pilotage.svg',
  'public/perspective/presences.svg',
  'public/perspective/profil.svg',
  'public/perspective/rapports.svg',
  'public/perspective/reglages.svg',
  'public/perspective/repechage.svg',
  'public/perspective/site.svg',
  'theme-elan.css',
  'theme-elan.js',
  'public/elan/abonnement.svg',
  'public/elan/accueil.webp',
  'public/elan/agenda.svg',
  'public/elan/aide.svg',
  'public/elan/annee.svg',
  'public/elan/annuel.svg',
  'public/elan/archives.svg',
  'public/elan/bulletin.svg',
  'public/elan/cahier.svg',
  'public/elan/classe.svg',
  'public/elan/comptabilite.svg',
  'public/elan/discipline.svg',
  'public/elan/dossiers.svg',
  'public/elan/eleves.svg',
  'public/elan/equipe.svg',
  'public/elan/horaire.svg',
  'public/elan/inscriptions.svg',
  'public/elan/journal.svg',
  'public/elan/livres.svg',
  'public/elan/messages.svg',
  'public/elan/modeles.svg',
  'public/elan/notes.svg',
  'public/elan/orientation.svg',
  'public/elan/paiements.svg',
  'public/elan/pilotage.svg',
  'public/elan/presences.svg',
  'public/elan/profil.svg',
  'public/elan/rapports.svg',
  'public/elan/reglages.svg',
  'public/elan/repechage.svg',
  'public/elan/site.svg',
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
  'abonnements.html','support.html','support-page.js','support-abonnements.css',
  'archives.html','rapports.html','super-admin.html','theme.css','theme-base.css','ui.css','mobile.css',
  'mobile.js','theme.js','ui.js','session.js','abonnements-page.js','acces-presences.js','filtre-cycle.js',
  'evenements-types.js',
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
  if(c){
    /* On sert le cache ET on rafraîchit derrière. Sans cette relecture, un
       fichier n'était plus jamais remis à jour à l'intérieur d'une même
       version : la correction d'un script n'atteignait le téléphone qu'au
       prochain incrément de VERSION. Le `catch` est vide à dessein — un
       rafraîchissement raté ne doit rien changer à la page déjà servie. */
    fetch(req).then((r)=>{if(r&&r.ok)cache.put(req,r.clone());}).catch(()=>{});
    return c;
  }
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
