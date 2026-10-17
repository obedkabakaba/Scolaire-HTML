/* Notifications sur l'appareil (notifications-push.js) : invitation, activation,
   « Plus tard », serveur pas encore prêt, synchronisation silencieuse, réglage
   de Mon profil, mode « Voir comme ». Serveur simulé, Push API simulée (un
   navigateur sans interface n'a pas de service de push). */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root=__dirname;
// Une clé publique P-256 valide (65 octets) : seule sa forme compte ici.
const cle='BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://x');let f=path.join(root,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404).end();return;}res.setHeader('Content-Type',{'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.json':'application/json'}[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
const FAUX_PUSH=()=>{
  // Notification : « default » jusqu'au geste, puis « granted ».
  let perm=localStorage.getItem('test_perm')||'default';
  Object.defineProperty(Notification,'permission',{get:()=>perm,configurable:true});
  Notification.requestPermission=()=>{perm=localStorage.getItem('test_reponse')||'granted';return Promise.resolve(perm);};
  let sub=null;
  const fabriquer=()=>({endpoint:'https://fcm.googleapis.com/fcm/send/test-'+Math.random().toString(36).slice(2),toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',auth:'tBHItJI5svbpez7KI4CCXg'}};},unsubscribe(){sub=null;window.__desabonne=true;return Promise.resolve(true);}});
  PushManager.prototype.getSubscription=function(){return Promise.resolve(sub);};
  PushManager.prototype.subscribe=function(o){window.__optionsAbonnement={visible:o.userVisibleOnly,cle:o.applicationServerKey&&o.applicationServerKey.length};sub=fabriquer();return Promise.resolve(sub);};
};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const b=await chromium.launch(process.env.PUSH_BROWSER?{executablePath:process.env.PUSH_BROWSER}:{});const ecran=process.env.PUSH_SHOT||'';const capture=(p,nom)=>ecran?p.screenshot({path:ecran+'-'+nom+'.png'}):null;
async function contexte({pret=true,mobile=false,perm=null,observation=false}={}){
  const ctx=await b.newContext(mobile?{viewport:{width:393,height:852},isMobile:true,hasTouch:true,deviceScaleFactor:3}:{viewport:{width:1440,height:900}});
  await ctx.addInitScript(()=>{localStorage.setItem('ardoise_user',JSON.stringify({id:'u-1',nom:'Mukendi',prenom:'Grâce',roles:['directeur']}));localStorage.setItem('ardoise_access_token','t');localStorage.setItem('ardoise_didacticiel_vu','oui');});
  await ctx.addInitScript(([perm,obs])=>{if(perm&&!sessionStorage.getItem('perm_pose')){localStorage.setItem('test_perm',perm);sessionStorage.setItem('perm_pose','1');}if(obs)localStorage.setItem('ardoise_observation',JSON.stringify({expire:Date.now()+3600e3}));},[perm,observation]);
  await ctx.addInitScript(FAUX_PUSH);
  const appels=[];
  await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin===base)return r.continue();if(/google|gstatic/.test(u.hostname))return r.abort();
    if(u.pathname.endsWith('/notifications/push/cle'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(pret?{disponible:true,cle:process.env.CLE||''}:{disponible:false})});
    if(u.pathname.endsWith('/notifications/push/abonnement')){appels.push({methode:r.request().method(),corps:JSON.parse(r.request().postData()||'{}')});return r.fulfill({status:r.request().method()==='POST'?201:200,contentType:'application/json',body:'{}'});}
    return r.fulfill({status:200,contentType:'application/json',body:'[]'});});
  return {ctx,appels};
}
process.env.CLE=cle;
// 1. Navigateur, permission jamais demandée : invitation, Activer → abonnement envoyé avec confirmation.
{const {ctx,appels}=await contexte();const p=await ctx.newPage();const err=[];p.on('pageerror',e=>err.push(e.message));
 await p.goto(base+'/dashboard-directeur.html');await p.waitForSelector('.ard-push-invite.visible',{timeout:9000});
 await capture(p,'invitation-bureau');
 await p.click('.ard-push-activer');await p.waitForTimeout(1200);
 const post=appels.filter(a=>a.methode==='POST');assert.equal(post.length,1,'un abonnement envoyé');
 assert.equal(post[0].corps.confirmer,true);assert.match(post[0].corps.abonnement.endpoint,/^https:\/\/fcm/);assert.ok(post[0].corps.appareil);
 assert.deepEqual(await p.evaluate(()=>window.__optionsAbonnement),{visible:true,cle:65});
 assert.match(await p.locator('.ard-push-invite strong').textContent(),/activées/);
 // Page suivante : déjà synchronisé aujourd'hui → aucun nouvel envoi, aucune invitation.
 await p.evaluate(()=>localStorage.setItem('test_perm','granted'));
 await p.goto(base+'/eleves.html');await p.waitForTimeout(5500);
 assert.equal(await p.locator('.ard-push-invite').count(),0);
 assert.deepEqual(err.filter(m=>!/reading 'filter'/.test(m)),[]);console.log('1. invitation + activation + pas de doublon : OK');await ctx.close();}
// 2. « Plus tard » : l'invitation ne revient pas la semaine suivante.
{const {ctx}=await contexte();const p=await ctx.newPage();
 await p.goto(base+'/eleves.html');await p.waitForSelector('.ard-push-invite.visible',{timeout:9000});await p.click('.ard-push-plus-tard');
 await p.goto(base+'/classes.html');await p.waitForTimeout(5500);assert.equal(await p.locator('.ard-push-invite').count(),0);
 console.log('2. plus tard respecté : OK');await ctx.close();}
// 3. Serveur pas prêt (migration non appliquée) : rien ne s'affiche, Mon profil l'explique.
{const {ctx,appels}=await contexte({pret:false});const p=await ctx.newPage();
 await p.goto(base+'/mon-profil.html');await p.waitForTimeout(5500);
 assert.equal(await p.locator('.ard-push-invite').count(),0);assert.equal(appels.length,0);
 assert.equal(await p.locator('#section-notifications-push').isVisible(),true);
 assert.equal(await p.locator('#case-notifications-push').isDisabled(),true);
 assert.match(await p.locator('#aide-notifications-push').textContent(),/pas encore/);
 console.log('3. serveur pas prêt : silence : OK');await ctx.close();}
// 4. Autorisation déjà donnée : abonnement silencieux ; Mon profil coupe et rallume.
{const {ctx,appels}=await contexte({mobile:true,perm:'granted'});const p=await ctx.newPage();
 await p.goto(base+'/mon-profil.html');for(let i=0;i<40&&!appels.length;i++)await p.waitForTimeout(250);
 assert.equal(appels.filter(a=>a.methode==='POST').length,1,'synchro silencieuse');assert.equal(appels[0].corps.confirmer,false);
 await p.locator('#section-notifications-push').scrollIntoViewIfNeeded();
 await p.waitForFunction(()=>document.getElementById('case-notifications-push').checked);
 await capture(p,'profil');
 await p.locator('#case-notifications-push').click();await p.waitForTimeout(800);
 assert.equal(appels.filter(a=>a.methode==='DELETE').length,1);assert.equal(await p.evaluate(()=>window.__desabonne),true);
 assert.match(await p.locator('#confirmation-notifications-push').textContent(),/coupées/);
 await p.goto(base+'/eleves.html');await p.waitForTimeout(5500);
 assert.equal(appels.filter(a=>a.methode==='POST').length,1,'coupé : pas de réabonnement automatique');
 console.log('4. synchro silencieuse + couper depuis le profil : OK');await ctx.close();}
// 5. Téléphone, première ouverture : invitation au-dessus de la barre d'onglets.
{const {ctx}=await contexte({mobile:true});const p=await ctx.newPage();
 await p.goto(base+'/dashboard-directeur.html');await p.waitForSelector('.ard-push-invite.visible',{timeout:9000});await p.waitForTimeout(500);
 const inv=await p.locator('.ard-push-invite').boundingBox(),ong=await p.locator('.ard-onglets').boundingBox();
 assert.ok(inv.y+inv.height<=ong.y+2,'au-dessus de la barre d’onglets');
 await capture(p,'invitation-mobile');console.log('5. invitation sur téléphone : OK');await ctx.close();}
// 6. Mode « Voir comme » : jamais d'abonnement.
{const {ctx,appels}=await contexte({perm:'granted',observation:true});const p=await ctx.newPage();
 await p.goto(base+'/eleves.html');await p.waitForTimeout(3000);assert.equal(appels.length,0);console.log('6. mode observation : OK');await ctx.close();}
console.log('Notifications sur l’appareil : 6 parcours conformes.');
await b.close();server.close();})().catch(e=>{console.error(e);process.exit(1);});
