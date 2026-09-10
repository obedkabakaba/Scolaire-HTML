/* Orbite Aube : présentation réversible, les droits et actions restent ceux d'Ardoise. */
(function(){
 'use strict';
 var html=document.documentElement,page=location.pathname.split('/').pop(),home=/^(dashboard-directeur|espace-)/.test(page),admin=page==='super-admin.html';
 var moves=[],observer,queued=false,signature='',classesPromise;
 function active(){return html.dataset.theme==='orbite';}
 function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;}
 function allowed(p){var a=window.ArdoiseAcces;return !!(a&&a.pageConnue(p)&&a.peutVoirPage(p));}
 function links(){var items=window.ArdoiseRail?window.ArdoiseRail.elements:[];var seen=new Set();return items.filter(function(a){if(!allowed(a.page)||seen.has(a.page))return false;seen.add(a.page);return true;});}
 function link(a,cls){var n=el('a',cls,a.libelle);n.href=a.page;return n;}
 function orbit(){var s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 100 100');s.setAttribute('aria-hidden','true');s.classList.add('ob-emblem');[['circle',{cx:50,cy:50,r:25}],['ellipse',{cx:50,cy:50,rx:45,ry:15,transform:'rotate(-35 50 50)'}],['circle',{cx:84,cy:28,r:5}]].forEach(function(v){var n=document.createElementNS(s.namespaceURI,v[0]);Object.keys(v[1]).forEach(function(k){n.setAttribute(k,v[1][k]);});s.append(n);});return s;}
 function palette(query){
  var d=document.getElementById('ob-tools');
  if(!d){d=el('dialog','ob-only ob-tools');d.id='ob-tools';d.setAttribute('aria-labelledby','ob-tools-title');var row=el('div','ob-row'),title=el('h2','','Votre destination');title.id='ob-tools-title';var close=el('button','ob-button','Fermer');close.type='button';close.onclick=function(){d.close();};row.append(title,close);var input=el('input');input.type='search';input.setAttribute('aria-label','Rechercher un écran');input.placeholder='Élèves, classes, documents…';input.oninput=render;d.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();d.close();}});d.append(row,input,el('nav','ob-results'));d.querySelector('nav').setAttribute('aria-label','Écrans disponibles');document.body.append(d);}
  function render(){var q=d.querySelector('input').value.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'');var list=d.querySelector('nav');list.replaceChildren();links().filter(function(a){return a.libelle.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q);}).forEach(function(a){list.append(link(a,'ob-result'));});if(!list.children.length)list.append(el('p','ob-muted','Aucun écran trouvé.'));}
  d.querySelector('input').value=query||'';render();if(!d.open)d.showModal();d.querySelector('input').focus();
 }
 function commands(){
  var dock=document.querySelector('.ob-dock');if(!dock)return;dock.replaceChildren();var items=links();['inscriptions.html','notes.html','messages.html'].forEach(function(p){var a=items.find(function(x){return x.page===p;});if(a)dock.append(link(a,'ob-button'));});var all=el('button','ob-button','Tous les outils');all.type='button';all.onclick=function(){palette();};dock.append(all);
 }
 function classes(){
  var host=document.querySelector('.ob-classes');if(!host)return;
  if(!links().some(function(a){return a.page==='classes.html';})){host.hidden=true;return;}
  host.hidden=false;if(host.dataset.loaded)return;host.dataset.loaded='true';
  host.replaceChildren();var row=el('div','ob-row');row.append(el('h2','','Vos classes'),link({page:'classes.html',libelle:'Voir les classes →'},'ob-text-link'));var list=el('div','ob-class-grid');list.setAttribute('aria-live','polite');list.append(el('p','ob-muted','Chargement des classes…'));host.append(row,list);
  if(!classesPromise){var api=window.ArdoiseSession&&window.ArdoiseSession.appelApi;classesPromise=api?api('/classes').then(function(r){return r&&r.ok?r.json():null;}).then(function(r){return Array.isArray(r)?r:null;}).catch(function(){return null;}):Promise.resolve(null);}
  classesPromise.then(function(rows){if(!list.isConnected)return;list.replaceChildren();if(rows===null){list.append(el('p','ob-muted','Les classes ne sont pas disponibles pour le moment.'));var retry=el('button','ob-button','Réessayer');retry.type='button';retry.onclick=function(){classesPromise=null;delete host.dataset.loaded;classes();};list.append(retry);return;}if(!rows.length){list.append(el('p','ob-muted','Aucune classe enregistrée.'));return;}rows.slice(0,4).forEach(function(c){var card=el('article','ob-class');card.append(el('h3','',String(c.nom||'Classe')),el('p','ob-muted',c.nb_eleves!=null&&Number.isFinite(Number(c.nb_eleves))?c.nb_eleves+' élèves inscrits':'Effectif non renseigné'));var detail=[c.niveau,c.option_nom].filter(Boolean).join(' · ');if(detail)card.append(el('p','ob-class-detail',detail));list.append(card);});});
 }
 function day(){
  var aside=document.querySelector('.ob-aside');if(!aside)return;
  var now=new Date(),time=aside.querySelector('time');time.dateTime=now.toISOString();time.textContent=new Intl.DateTimeFormat('fr',{dateStyle:'full'}).format(now);
  var dial=aside.querySelector('.ob-dial');dial.style.setProperty('--ob-time',(now.getHours()*15+now.getMinutes()/4)+'deg');dial.querySelector('strong').textContent=new Intl.DateTimeFormat('fr',{hour:'2-digit',minute:'2-digit'}).format(now);
  var events=aside.querySelector('.ob-events'),src=document.getElementById('liste-evenements');events.replaceChildren();if(src&&src.children.length){Array.from(src.children).slice(0,4).forEach(function(li){events.append(el('li','',li.textContent.replace(/\s+/g,' ').trim()));});}else events.append(el('li','ob-muted','Votre agenda est accessible depuis les outils de votre espace.'));
 }
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;if(!active())return;var next=links().map(function(a){return a.page;}).join('|');if(next!==signature){signature=next;commands();classes();}day();});}
 function move(n,to){if(!n||moves.some(function(m){return m.node===n;}))return;var mark=document.createComment('Emplacement avant Orbite Aube');n.before(mark);moves.push({node:n,mark:mark});to.prepend(n);}
 function restore(){moves.forEach(function(m){if(m.mark.isConnected)m.mark.replaceWith(m.node);});moves=[];}
 function install(){
  if(!active()){restore();var modal=document.getElementById('ob-tools');if(modal&&modal.open)modal.close();return;}
  var content=document.querySelector('.mise-en-page > .contenu,.sa-principal');if(!content)return;content.classList.add('ob-content');if(home)content.classList.add('ob-home');
  if(!content.querySelector('.ob-banner')){
   var header=content.querySelector(':scope > .entete-page,:scope > .sa-entete'),banner=el('section','ob-only ob-banner');banner.setAttribute('aria-label','Orbite Aube');banner.append(el('p','ob-kicker','Orbite Aube'),orbit());
   if(home)banner.append(el('h2','','L’essentiel, à portée de regard.'),el('p','ob-muted','Une école plus sereine, chaque jour.'));else{var h=header&&header.querySelector('h1');banner.append(el('p','ob-muted',h?h.textContent:'Votre espace de travail'));}
   if(header)header.after(banner);else content.prepend(banner);
   if(!admin){var top=el('header','ob-only ob-top'),brand=el('div','ob-brand','Ardoise');brand.append(el('span','','/  ORBITE AUBE'));var form=el('form','ob-search'),input=el('input');input.type='search';input.placeholder='Rechercher un écran…';input.setAttribute('aria-label','Rechercher un écran');var b=el('button','ob-button','Rechercher');b.type='submit';form.append(input,b);form.onsubmit=function(e){e.preventDefault();palette(input.value);};top.append(brand,form,link({page:'mon-profil.html',libelle:'Mon profil'},'ob-profile'));document.body.append(top,el('nav','ob-only ob-dock'));document.querySelector('.ob-dock').setAttribute('aria-label','Actions Orbite Aube');}
   if(home){var shell=el('section','ob-only ob-shell'),main=el('div','ob-main');main.append(el('section','ob-classes'));var aside=el('aside','ob-aside');aside.setAttribute('aria-label','Repères et agenda');aside.append(el('h2','','Aujourd’hui'),el('time','ob-muted'));var dial=el('div','ob-dial');dial.setAttribute('aria-label','Heure locale');dial.append(el('span','ob-dial-label','Votre journée'),el('strong'),el('i'));aside.append(dial,el('h3','','Prochains événements'),el('ul','ob-events'));var calendar=links().find(function(a){return a.page==='calendrier.html';});if(calendar)aside.append(link(calendar,'ob-text-link'));shell.append(main,aside);banner.after(shell);}
  }
  if(home)move(content.querySelector(':scope > .grille-stats'),content.querySelector('.ob-main'));
  if(!observer){observer=new MutationObserver(schedule);document.querySelectorAll('.nav-liste,#liste-evenements').forEach(function(n){observer.observe(n,{childList:true,subtree:true,characterData:true});});}
  signature='';commands();classes();day();
 }
 document.addEventListener('ardoise:theme-change',install);
 document.addEventListener('keydown',function(e){if(active()&&!admin&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();palette();}});
 // Une horloge réelle, rafraîchie seulement lorsque ce thème est visible.
 setInterval(function(){if(active()&&!document.hidden)day();},60000);
 document.addEventListener('visibilitychange',function(){if(active()&&!document.hidden)day();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
 window.ArdoiseOrbite={installer:install};
})();
