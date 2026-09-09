/* Isolated browser check: real shared navigation/theme scripts, fixture data only. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root=__dirname;
const cacheVersion=fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const VERSION='([^']+)'/)[1];
const user={id:42,ecole_id:1,nom:'Exemple',prenom:'Direction',roles:['directeur'],email:'test@example.invalid'};
const data={effectifs:{nb_eleves:428,nb_professeurs:32,nb_classes:18},taux_reussite_global:86,
 impayes:{nb_eleves_en_retard:7},annee_active:{libelle:'2026–2027'},notes:{encodees:340,attendues:400,restantes:60},
 periode_courante:{libelle:'Première période'},etat_periodes_par_classe:[],
 evenements_a_venir:[{titre:'Réunion pédagogique',date_debut:'2026-09-12',type:'reunion'}]};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');let f=path.join(root,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname));
 if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404).end();return;}
 let body=fs.readFileSync(f);
 if(u.searchParams.has('shell')&&f.endsWith('.html')){
   body=body.toString().replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi,'')
     .replace(/<script[^>]+src="([^"]+)"[^>]*><\/script>/gi,(tag,src)=>/^(theme|ui|mobile|session|acces-presences|evenements-types|didacticiel)\.js$/.test(src)?tag:'');
 }
 const ext=path.extname(f);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[ext]||'application/octet-stream');res.end(body);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(process.env.NEXUS_BROWSER?{executablePath:process.env.NEXUS_BROWSER,headless:true}:{headless:true});
 const ctx=await browser.newContext({viewport:{width:1536,height:1024},serviceWorkers:'block',reducedMotion:'reduce'});
 await ctx.addInitScript(u=>{
   localStorage.setItem('ardoise_user',JSON.stringify(u));localStorage.setItem('ardoise_token','test');
   localStorage.setItem('ardoise_access_token','test');localStorage.setItem('ardoise_theme','nexus');
   localStorage.setItem('ardoise_nav_position','gauche');localStorage.setItem('ardoise_nav_compact','oui');
 },user);
 await ctx.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin===base)return route.continue();
   if(/google|gstatic/.test(url.hostname))return route.abort();
   let value=[];
   if(url.pathname.endsWith('/dashboard/directeur'))value=data;
   else if(url.pathname.includes('/presences/resume-jour'))value={nb_classes:18,nb_classes_appelees:18,total_absents:3,total_retards:0,classes:[]};
   else if(url.pathname.endsWith('/classes'))value=Array.from({length:18},(_,i)=>({id:i+1,nom:i===0?'6e A':i===1?'<em>6e B</em>':'Classe '+(i+1),nb_eleves:20+i}));
   else if(url.pathname.endsWith('/utilisateurs/moi'))value=user;
   else if(url.pathname.endsWith('/ecoles/moi'))value={id:1,nom:'École de démonstration',abonnement_statut:'actif'};
   else if(url.pathname.includes('/messages'))value={messages:[],non_lus:0};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
 });
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(base+'/dashboard-directeur.html');await page.waitForSelector('.nx-node[data-group="classes"]');
 await page.waitForSelector('.nx-class-list li');
 await page.waitForTimeout(600);
 await page.screenshot({path:process.env.NEXUS_SHOT||path.join(root,'nexus-preview.png')});
 assert.deepEqual(errors,[]);
 assert.equal(await page.locator('.nx-node').count(),5);
 assert.equal(await page.locator('.nx-class-list li').count(),8);
 assert.equal(await page.locator('.nx-class-list em').count(),0);
 assert.ok((await page.locator('.nx-class-list').textContent()).includes('<em>6e B</em>'));
 assert.ok((await page.locator('.nx-node[data-group="eleves"]').textContent()).includes('428'));
 assert.ok((await page.locator('.nx-events').textContent()).includes('Réunion pédagogique'));
 await page.locator('.nx-node[data-group="gestion"]').click();
 assert.equal(await page.locator('#nx-context').getAttribute('data-group'),'gestion');
 assert.equal(await page.locator('.nx-node[data-group="gestion"]').getAttribute('aria-pressed'),'true');
 assert.ok(await page.locator('#nx-context a[href="comptabilite.html"]').count());
 await page.locator('.nx-node[data-group="classes"]').click();
 await page.evaluate(()=>document.getElementById('stat-eleves').textContent='429');
 await page.waitForFunction(()=>document.querySelector('.nx-node[data-group="eleves"]').textContent.includes('429'));
 await page.locator('.nx-dock button').last().click();
 await page.locator('#nx-tools input').fill('comptabilite');
 assert.equal(await page.locator('#nx-tools nav a').count(),1);
 assert.equal(await page.locator('#nx-tools nav a').getAttribute('href'),'comptabilite.html');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#nx-tools').isVisible(),false);
 for(const theme of ['elan','perspective','recre','yohali','nexus']){
   await page.evaluate(t=>ArdoiseTheme.appliquer(t,{synchroniserServeur:false}),theme);
   if(theme!=='yohali'&&theme!=='nexus')await page.waitForSelector('.'+theme+'-hero');
   assert.equal(await page.locator('.nx-workspace').isVisible(),theme==='nexus');
   assert.equal(await page.locator('#stat-eleves').textContent(),'429');
 }
 assert.equal(await page.locator('.nx-workspace').count(),1);
 for(const position of ['gauche','droite','haut','bas']){
   await page.evaluate(p=>ArdoiseDisposition.definir(p,true),position);
   const box=await page.locator('.barre-laterale').boundingBox();assert.ok(box.width>1400&&box.height<130,JSON.stringify({position,box}));
 }
 await page.evaluate(()=>ArdoiseDisposition.definir('gauche',true));
 await page.waitForTimeout(600);
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(16, 21, 23)');
 const mapBox=await page.locator('.nx-map').boundingBox(),panelBox=await page.locator('.nx-inspector').boundingBox();
 assert.ok(mapBox.x+mapBox.width<=panelBox.x,JSON.stringify({mapBox,panelBox}));
 assert.equal(Math.round(panelBox.y),104);
 await page.screenshot({path:process.env.NEXUS_SHOT||path.join(root,'nexus-preview.png')});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:(process.env.NEXUS_SHOT||path.join(root,'nexus-preview.png')).replace('.png','-mobile.png')});
 await page.locator('.nx-node[data-group="eleves"]').click();
 assert.equal(await page.locator('#nx-context').getAttribute('data-group'),'eleves');
 await page.goto(base+'/mon-profil.html');await page.waitForSelector('.carte-theme[data-theme="nexus"]');
 await page.locator('.carte-theme[data-theme="nuit"]').click();assert.equal(await page.locator('.nx-workspace').isVisible(),false);
 await page.locator('.carte-theme[data-theme="nexus"]').click();assert.equal(await page.locator('.nx-workspace').isVisible(),true);
 await page.reload();await page.waitForSelector('.nx-workspace');assert.equal(await page.locator('.carte-theme[data-theme="nexus"]').getAttribute('aria-pressed'),'true');
 await page.locator('.ard-mob-barre .ard-mob-bouton').click();assert.equal(await page.locator('.barre-laterale').getAttribute('aria-hidden'),'false');
 await page.keyboard.press('Escape');assert.equal(await page.locator('.barre-laterale').getAttribute('aria-hidden'),'true');
 const failures=[];
 const scenes=["dashboard-directeur", "espace-secretaire", "espace-professeur", "espace-titulaire", "eleves", "inscriptions", "classes", "cours", "cours-classe-titulaire", "notes", "presences", "discipline", "bulletins", "bulletin-annuel", "generateur-modeles", "repechage", "orientation", "calendrier", "emploi-du-temps", "annee-scolaire", "frais-scolaires", "comptabilite", "rapports", "archives", "journal", "messages", "utilisateurs", "parametres", "mon-profil", "site-public", "abonnements", "support", "super-admin"];
 for(const name of scenes.filter(p=>p!=='super-admin')){
   await page.goto(base+'/'+name+'.html?shell');await page.waitForTimeout(180);
   await page.evaluate(()=>{document.querySelectorAll('.mise-en-page').forEach(e=>e.style.display='grid');document.querySelectorAll('#ecran-chargement').forEach(e=>e.style.display='none');});
   for(const width of [1536,1024,390]){
     await page.setViewportSize({width,height:1000});await page.waitForTimeout(80);
     const state=await page.evaluate(()=>({workspace:!!document.querySelector('.nx-workspace'),overflow:document.documentElement.scrollWidth-innerWidth}));
     if(!state.workspace||state.overflow>2)failures.push({name,width,...state});
     if(process.env.NEXUS_SHOT&&width===1536&&['classes','inscriptions'].includes(name))await page.screenshot({path:process.env.NEXUS_SHOT.replace('.png','-'+name+'.png')});
   }
 }
 console.log('Screen checks:',scenes.length-1,'x 3 viewports',JSON.stringify(failures));
 await page.setViewportSize({width:1536,height:1000});
 await page.evaluate(()=>{const u=JSON.parse(localStorage.getItem('ardoise_user'));u.roles=['super_admin'];localStorage.setItem('ardoise_user',JSON.stringify(u));});
 await page.goto(base+'/super-admin.html?shell');await page.evaluate(()=>document.querySelector('.sa-application').style.display='flex');
 await page.waitForSelector('.sa-principal .nx-workspace');
 // Independently exercise a professor's allowed navigation, including the new palette.
 const prof=await browser.newContext({serviceWorkers:'block'});
 await prof.addInitScript(()=>{localStorage.setItem('ardoise_user',JSON.stringify({id:7,ecole_id:1,roles:['professeur']}));localStorage.setItem('ardoise_token','test');localStorage.setItem('ardoise_access_token','test');localStorage.setItem('ardoise_theme','nexus');});
 let financeRequests=0;
 await prof.route('**/*',route=>{if(new URL(route.request().url()).origin===base)return route.continue();if(/\/(classes|comptabilite|frais|paiements)(?:[/?]|$)/.test(route.request().url()))financeRequests++;return route.fulfill({status:200,contentType:'application/json',body:'[]'});});
 const pp=await prof.newPage();await pp.goto(base+'/espace-professeur.html?shell');await pp.evaluate(()=>document.querySelector('.mise-en-page').style.display='grid');await pp.waitForSelector('.nx-node');
 assert.equal(await pp.locator('.nx-node[data-group="gestion"]').count(),0);
 await pp.locator('.nx-dock button').last().click();
 assert.equal(await pp.locator('#nx-tools a[href="abonnements.html"],#nx-tools a[href="comptabilite.html"]').count(),0);
 assert.equal(financeRequests,0);await prof.close();
 const offline=await browser.newContext({serviceWorkers:'allow'}),op=await offline.newPage();await op.goto(base+'/theme.css');
 await op.evaluate(async()=>{await caches.open('ardoise-v74-coquille');await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
 await op.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 const keys=await op.evaluate(()=>caches.keys());assert.ok(keys.includes(cacheVersion+'-coquille'));assert.ok(!keys.includes('ardoise-v74-coquille'));
 await offline.setOffline(true);
 const ok=await op.evaluate(async()=>Promise.all(['theme-nexus.css','theme-nexus.js','public/nexus/reseau.svg'].map(async p=>{const r=await fetch(p);return r.ok&&(await r.text()).length>0;})));assert.ok(ok.every(Boolean));await offline.close();
 await browser.close();server.closeAllConnections();server.close();
 assert.deepEqual(failures,[]);console.log('Nexus: map, inspector, real data updates, search, theme switching, profile, mobile, role filtering and offline passed.');
})().catch(e=>{console.error(e);server.close();process.exit(1)});
