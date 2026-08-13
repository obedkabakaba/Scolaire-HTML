/* Ardoise — file hors ligne sécurisée */
(function () {
  'use strict';
  var CLE_FILE = 'ardoise_file_hors_ligne_v2';
  var ANCIENNE_CLE = 'ardoise_file_hors_ligne';
  try { localStorage.removeItem(ANCIENNE_CLE); } catch (e) {}

  var AUTORISEES = [
    { methode:'POST', motif:/^\/presences\/classe\/[^/]+$/ },
    { methode:'POST', motif:/^\/notes\/grille$/ },
    { methode:'POST', motif:/^\/notes\/grille-travaux$/ }
  ];

  function differable(chemin, methode) {
    return AUTORISEES.some(function (r) { return r.methode === methode && r.motif.test(chemin); });
  }
  function contexte() {
    try {
      var u = window.ArdoiseSession && window.ArdoiseSession.utilisateur ? window.ArdoiseSession.utilisateur() : null;
      if (!u) return null;
      return { utilisateur_id:u.id || u.utilisateur_id || null, ecole_id:u.ecole_id || (u.ecole && u.ecole.id) || null };
    } catch (e) { return null; }
  }
  function memeContexte(a,b) {
    return !!a && !!b && String(a.utilisateur_id||'') === String(b.utilisateur_id||'') && String(a.ecole_id||'') === String(b.ecole_id||'');
  }
  function lire() { try { var x=JSON.parse(localStorage.getItem(CLE_FILE)||'[]'); return Array.isArray(x)?x:[]; } catch(e){ return []; } }
  function ecrire(x) { try { localStorage.setItem(CLE_FILE, JSON.stringify(x)); } catch(e){} }
  function ajouter(entree) {
    var c=contexte();
    if (!c || !c.utilisateur_id || !c.ecole_id) throw new Error('Session non vérifiable hors ligne.');
    var f=lire();
    entree.contexte=c;
    entree.operation_locale_id=(window.crypto && window.crypto.randomUUID)?window.crypto.randomUUID():String(Date.now())+'-'+Math.random();
    f.push(entree); ecrire(f); maj();
  }

  var bandeau=null;
  function creer(){ if(bandeau||!document.body)return; bandeau=document.createElement('div'); bandeau.id='bandeau-hors-ligne'; bandeau.innerHTML='<span class="bhl-texte"></span><button type="button" class="bhl-action" style="display:none;">Synchroniser</button>'; document.body.appendChild(bandeau); bandeau.querySelector('.bhl-action').addEventListener('click', synchroniser); }
  function maj(){ creer(); if(!bandeau)return; var n=lire().length,t=bandeau.querySelector('.bhl-texte'),a=bandeau.querySelector('.bhl-action'); if(!navigator.onLine){bandeau.className='visible hors-ligne';t.textContent=n?n+' saisie(s) autorisée(s) en attente.':'Hors ligne — seules certaines saisies pédagogiques sont différables.';a.style.display='none';}else if(n){bandeau.className='visible en-attente';t.textContent=n+' saisie(s) à synchroniser.';a.style.display='';}else bandeau.className=''; }
  function annoncer(m,type){creer();if(!bandeau)return;bandeau.className='visible '+(type||'succes');bandeau.querySelector('.bhl-texte').textContent=m;bandeau.querySelector('.bhl-action').style.display='none';setTimeout(maj,5000);}

  function installer(){
    if(typeof window.appelApi!=='function'||window.appelApi.__ardoiseHorsLigne)return;
    var original=window.appelApi;
    async function enveloppe(chemin,options){
      options=options||{}; var m=(options.method||'GET').toUpperCase(); var d=differable(chemin,m); var ecriture=['POST','PUT','PATCH','DELETE'].indexOf(m)!==-1;
      if(!navigator.onLine){
        if(ecriture&&!d) return new Response(JSON.stringify({message:'Cette opération exige une connexion et n’a pas été enregistrée.',hors_ligne:true,differee:false}),{status:503,headers:{'Content-Type':'application/json'}});
        if(d){ ajouter({chemin:chemin,methode:m,corps:typeof options.body==='string'?options.body:JSON.stringify(options.body||null),entetes:options.headers||{'Content-Type':'application/json'},horodatage:Date.now()}); return new Response(JSON.stringify({message:'Saisie conservée localement.',hors_ligne:true,differee:true}),{status:202,headers:{'Content-Type':'application/json'}}); }
      }
      try { return await original(chemin,options); }
      catch(err){ if(!d)throw err; ajouter({chemin:chemin,methode:m,corps:typeof options.body==='string'?options.body:JSON.stringify(options.body||null),entetes:options.headers||{'Content-Type':'application/json'},horodatage:Date.now()}); return new Response(JSON.stringify({message:'Connexion perdue — saisie conservée.',hors_ligne:true,differee:true}),{status:202,headers:{'Content-Type':'application/json'}}); }
    }
    enveloppe.__ardoiseHorsLigne=true; enveloppe.__original=original; window.appelApi=enveloppe;
  }

  var synchro=false;
  async function synchroniser(){
    if(synchro||!navigator.onLine)return; var f=lire(); if(!f.length){maj();return;} var c=contexte(); if(!c){annoncer('Reconnectez-vous avant la synchronisation.','erreur');return;} synchro=true; var reste=[],ok=0,refus=0,autre=0; f.sort(function(a,b){return a.horodatage-b.horodatage;});
    for(var i=0;i<f.length;i++){var e=f[i]; if(!memeContexte(e.contexte,c)){reste.push(e);autre++;continue;} if(!differable(e.chemin,e.methode)){refus++;continue;} try{var envoyer=(window.appelApi&&window.appelApi.__original)||window.appelApi;var r=await envoyer(e.chemin,{method:e.methode,headers:e.entetes,body:e.corps});if(r&&r.ok)ok++;else if(r&&r.status>=400&&r.status<500)refus++;else reste.push(e);}catch(x){reste.push(e);}}
    ecrire(reste); synchro=false; if(autre)annoncer(autre+' saisie(s) appartiennent à une autre session/école et n’ont pas été envoyées.','erreur'); else if(refus)annoncer(ok+' envoyée(s), '+refus+' refusée(s).','erreur'); else if(ok){annoncer(ok+' modification(s) envoyée(s).','succes');setTimeout(function(){location.reload();},1800);} else maj();
  }

  function demarrer(){ if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(function(){}); installer(); maj(); if(navigator.onLine)synchroniser(); addEventListener('online',function(){maj();synchroniser();});addEventListener('offline',maj); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',demarrer);else demarrer();
  window.ArdoiseHorsLigne={enAttente:function(){return lire().length;},synchroniser:synchroniser,vider:function(){ecrire([]);maj();}};
})();
