/* Isolated browser check: real shared navigation/theme scripts, fixture data only. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root=__dirname;
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
 const ext=path.extname(f);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[ext]||'application/octet-stream');res.end(body);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(process.env.ELAN_BROWSER?{executablePath:process.env.ELAN_BROWSER,headless:true}:{headless:true});
 const ctx=await browser.newContext({viewport:{width:1536,height:1024},serviceWorkers:'block',reducedMotion:'reduce'});
 await ctx.addInitScript(u=>{
   localStorage.setItem('ardoise_user',JSON.stringify(u));localStorage.setItem('ardoise_token','test');
   localStorage.setItem('ardoise_access_token','test');localStorage.setItem('ardoise_theme','elan');
   localStorage.setItem('ardoise_nav_position','gauche');localStorage.setItem('ardoise_nav_compact','oui');
 },user);
 await ctx.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin===base)return route.continue();
   if(/google|gstatic/.test(url.hostname))return route.abort();
   let value=[];
   if(url.pathname.endsWith('/dashboard/directeur'))value=data;
   else if(url.pathname.includes('/presences/resume-jour'))value={nb_classes:18,nb_classes_appelees:18,total_absents:3,total_retards:0,classes:[]};
   else if(url.pathname.endsWith('/utilisateurs/moi'))value=user;
   else if(url.pathname.endsWith('/ecoles/moi'))value={id:1,nom:'École de démonstration',abonnement_statut:'actif'};
   else if(url.pathname.includes('/messages'))value={messages:[],non_lus:0};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
 });
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(base+'/dashboard-directeur.html');await page.waitForSelector('.elan-hero');
 await page.waitForTimeout(1800);
 await page.screenshot({path:process.env.ELAN_SHOT||path.join(root,'elan-preview.png')});
 console.log('Dashboard errors:',JSON.stringify(errors));
 console.log('Calendar geometry:',await page.locator('.elan-calendar').evaluate(e=>({width:e.getBoundingClientRect().width,parent:e.parentElement.getBoundingClientRect().width,style:getComputedStyle(e).cssText,td:e.querySelector('td').getBoundingClientRect().width})));
 assert.deepEqual(errors,[]);
 assert.equal(await page.locator('#stat-eleves').textContent(),'428');
 assert.equal(await page.locator('.elan-events').count(),1);
 assert.ok((await page.locator('.elan-events').textContent()).includes('Réunion pédagogique'));
 await page.locator('.elan-month button').last().click();
 assert.equal(await page.locator('.elan-calendar td').count(),42);
 const sourceData=await page.locator('#stat-eleves').textContent();
 await page.evaluate(()=>ArdoiseTheme.appliquer('yohali',{synchroniserServeur:false}));
 assert.equal(await page.locator('.elan-hero').isVisible(),false);
 assert.equal(await page.locator('#stat-eleves').textContent(),sourceData);
 assert.equal(await page.evaluate(()=>localStorage.getItem('ardoise_nav_position')),'gauche');
 await page.evaluate(()=>ArdoiseTheme.appliquer('elan',{synchroniserServeur:false}));
 assert.equal(await page.locator('.elan-hero').count(),1);
 assert.equal(await page.locator('.elan-aside').count(),1);
 // Original menu button and original drawer, with their own role filtering.
 await page.locator('.nav-tiroir').click();
 await page.waitForSelector('#voile-tiroir.ouvert');
 await page.waitForTimeout(100);
 assert.ok(await page.locator('.tiroir-ligne .elan-tile-art').count()>5);
 await page.keyboard.press('Escape');
 // Navigation stays horizontal even with a previous compact/right preference.
 for(const position of ['gauche','droite','haut','bas']){
   await page.evaluate(p=>ArdoiseDisposition.definir(p,true),position);
   const box=await page.locator('.barre-laterale').boundingBox();
   assert.ok(box.width>1400&&box.height<130,JSON.stringify({position,box}));
 }
 await page.evaluate(()=>ArdoiseDisposition.definir('gauche',true));
 await page.screenshot({path:process.env.ELAN_SHOT||path.join(root,'elan-preview.png')});
 const scenes=await page.evaluate(()=>ArdoiseElan.scenes);
 await page.goto(base+'/mon-profil.html');await page.waitForSelector('.carte-theme[data-theme="elan"]');
 await page.locator('.carte-theme[data-theme="nuit"]').click();
 assert.equal(await page.locator('.elan-hero').isVisible(),false);
 await page.locator('.carte-theme[data-theme="elan"]').click();
 assert.equal(await page.locator('.elan-hero').isVisible(),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('ardoise_theme')),'elan');
 await page.reload();await page.waitForSelector('.elan-hero');
 assert.equal(await page.locator('.carte-theme[data-theme="elan"]').getAttribute('aria-pressed'),'true');
 await page.setViewportSize({width:390,height:844});
 await page.locator('.ard-mob-barre .ard-mob-bouton').click();
 assert.equal(await page.locator('.barre-laterale').getAttribute('aria-hidden'),'false');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.barre-laterale').getAttribute('aria-hidden'),'true');
 await page.screenshot({path:(process.env.ELAN_SHOT||path.join(root,'elan-preview.png')).replace('.png','-mobile.png')});
 const failures=[];
 for(const name of scenes.filter(p=>p!=='super-admin')){
   await page.goto(base+'/'+name+'.html?shell');
   // Choose the role needed by the page using the application's own policy.
   if(!page.url().includes(name+'.html')){
     await page.evaluate(()=>{const u=JSON.parse(localStorage.getItem('ardoise_user'));u.roles=['directeur','professeur','titulaire','secretaire'];localStorage.setItem('ardoise_user',JSON.stringify(u));});
     await page.goto(base+'/'+name+'.html?shell');
   }
   await page.waitForTimeout(180);
   await page.evaluate(()=>{document.querySelectorAll('.mise-en-page').forEach(e=>e.style.display='grid');document.querySelectorAll('#ecran-chargement').forEach(e=>e.style.display='none');});
   for(const width of [1536,390]){
     await page.setViewportSize({width,height:1000});await page.waitForTimeout(80);
     const state=await page.evaluate(()=>({
       hero:!!document.querySelector('.elan-hero'),
       broken:[...document.querySelectorAll('.elan-only img,img.elan-only')].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),
       overflow:document.documentElement.scrollWidth-innerWidth
     }));
     if(!state.hero||state.broken.length||state.overflow>2)failures.push({name,width,...state});
   }
 }
 console.log('Screen checks:',scenes.length-1,'x 2 viewports');console.log('Failures:',JSON.stringify(failures));
 await page.setViewportSize({width:1536,height:1000});
 await page.evaluate(()=>{const u=JSON.parse(localStorage.getItem('ardoise_user'));u.roles=['super_admin'];localStorage.setItem('ardoise_user',JSON.stringify(u));});
 await page.goto(base+'/super-admin.html?shell');
 await page.evaluate(()=>{document.querySelector('.sa-application').style.display='flex';});
 await page.waitForSelector('.sa-principal .elan-hero');
 assert.equal(await page.locator('.sa-principal .elan-hero').count(),1);
 console.log('Profile selection/reload, mobile drawer, navigation positions and Super Admin passed.');
 // Real service-worker installation and offline delivery of the new theme.
 const offline=await browser.newContext({serviceWorkers:'allow'});
 const op=await offline.newPage();await op.goto(base+'/theme.css');
 await op.evaluate(async()=>{
   await caches.open('ardoise-v69-coquille');
   await navigator.serviceWorker.register('/sw.js');
   await navigator.serviceWorker.ready;
 });
 await op.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 const keys=await op.evaluate(()=>caches.keys());
 assert.ok(keys.includes('ardoise-v72-coquille'));assert.ok(!keys.includes('ardoise-v69-coquille'));
 await offline.setOffline(true);
 const offlineFiles=await op.evaluate(async()=>Promise.all(
   ['theme-elan.css','theme-elan.js','public/elan/accueil.webp','public/elan/aide.svg'].map(async p=>{
     const response=await fetch(p);return response.ok&&(await response.arrayBuffer()).byteLength>0;
   })));
 assert.ok(offlineFiles.every(Boolean));await offline.close();
 console.log('PWA v69 → v72 and offline Élan assets passed.');
 await browser.close();server.closeAllConnections();server.close();
 assert.deepEqual(failures,[]);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
