/* Vibra : présentation réversible, les droits et actions restent ceux d'Ardoise. */
(function(){
 'use strict';
 var html=document.documentElement,page=location.pathname.split('/').pop(),home=/^(dashboard-directeur|espace-)/.test(page),admin=page==='super-admin.html';
 var moves=[],observer,queued=false,signature='';
 function active(){return html.dataset.theme==='vibra';}
 function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;}
 function allowed(p){var a=window.ArdoiseAcces;return !!(a&&a.pageConnue(p)&&a.peutVoirPage(p));}
 function links(){var items=window.ArdoiseRail?window.ArdoiseRail.elements:[];var seen=new Set();return items.filter(function(a){if(!allowed(a.page)||seen.has(a.page))return false;seen.add(a.page);return true;});}
 function link(a,cls){var n=el('a',cls,a.libelle);n.href=a.page;return n;}
 function wave(){var img=el('img','vb-emblem');var icon=/eleves|inscriptions|utilisateurs|classes/.test(page)?'people':/notes|cours|bulletin|orientation|repechage/.test(page)?'pen':/frais|comptabilite|abonnements/.test(page)?'card':/messages|support/.test(page)?'send':'symbole';img.src='public/vibra/'+icon+'.svg';img.alt='';img.width=96;img.height=64;return img;}
 function palette(query){
  var d=document.getElementById('vb-tools');
  if(!d){d=el('dialog','vb-only vb-tools');d.id='vb-tools';d.setAttribute('aria-labelledby','vb-tools-title');var row=el('div','vb-row'),title=el('h2','','Votre destination');title.id='vb-tools-title';var close=el('button','vb-button','Fermer');close.type='button';close.onclick=function(){d.close();};row.append(title,close);var input=el('input');input.type='search';input.setAttribute('aria-label','Rechercher un écran');input.placeholder='Élèves, classes, documents…';input.oninput=render;d.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();d.close();}});d.append(row,input,el('nav','vb-results'));d.querySelector('nav').setAttribute('aria-label','Écrans disponibles');document.body.append(d);}
  function render(){var q=d.querySelector('input').value.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'');var list=d.querySelector('nav');list.replaceChildren();links().filter(function(a){return a.libelle.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q);}).forEach(function(a){list.append(link(a,'vb-result'));});if(!list.children.length)list.append(el('p','vb-muted','Aucun écran trouvé.'));}
  d.querySelector('input').value=query||'';render();if(!d.open)d.showModal();d.querySelector('input').focus();
 }
 function commands(){
  var dock=document.querySelector('.vb-dock');if(dock){dock.replaceChildren();['inscriptions.html','notes.html','messages.html'].forEach(function(p){var a=links().find(function(x){return x.page===p;});if(a)dock.append(link(a,'vb-button'));});var all=el('button','vb-button','Tous les outils');all.type='button';all.onclick=function(){palette();};dock.append(all);}
  var host=document.querySelector('.vb-actions');if(!host)return;host.replaceChildren();host.append(el('h2','','Vos priorités'));var items=links();
  var options=[['inscriptions.html','Inscription','Accueillir les nouveaux élèves','people'],['notes.html','Notes','Saisir et consulter','pen'],['bulletins.html','Préparer les bulletins','Génération et relecture','card'],['messages.html','Messages','Communiquer','send']];
  options.forEach(function(o){var a=items.find(function(x){return x.page===o[0];});if(!a)return;var n=link(a,'vb-action');n.dataset.kind=o[3];n.replaceChildren();var symbol=el('span','vb-action-symbol');symbol.setAttribute('aria-hidden','true');n.append(symbol,el('strong','',o[1]),el('span','vb-muted',o[2]));host.append(n);});
  if(host.children.length===1){var all=el('button','vb-button','Ouvrir mes outils');all.type='button';all.onclick=function(){palette();};host.append(all);}
  var team=document.querySelector('.vb-team');if(team){team.replaceChildren();team.append(el('h2','','Le temps éclaire l’action'),el('time','vb-agenda-date'),el('ul','vb-events'));var calendar=items.find(function(x){return x.page==='calendrier.html';});if(calendar)team.append(link(calendar,'vb-text-link'));}
 }
 function day(){
  var time=document.querySelector('.vb-date');if(time){var now=new Date();time.dateTime=now.toISOString();time.textContent=new Intl.DateTimeFormat('fr',{dateStyle:'full'}).format(now);}
  var time2=document.querySelector('.vb-agenda-date');if(time2)time2.textContent=new Intl.DateTimeFormat('fr',{dateStyle:'full'}).format(new Date());
  var events=document.querySelector('.vb-events'),src=document.getElementById('liste-evenements');if(events){events.replaceChildren();if(src&&src.children.length)Array.from(src.children).slice(0,3).forEach(function(n){events.append(el('li','',n.textContent.replace(/\s+/g,' ').trim()));});else events.append(el('li','','Retrouvez les rendez-vous dans votre agenda.'));}

 }
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;if(!active())return;var next=links().map(function(a){return a.page;}).join('|');if(next!==signature){signature=next;commands();}day();});}
 function move(n,to){if(!n||moves.some(function(m){return m.node===n;}))return;var mark=document.createComment('Emplacement avant Vibra');n.before(mark);moves.push({node:n,mark:mark});to.append(n);}
 function restore(){moves.forEach(function(m){if(m.mark.isConnected)m.mark.replaceWith(m.node);});moves=[];}
 function install(){
  if(!active()){restore();var modal=document.getElementById('vb-tools');if(modal&&modal.open)modal.close();return;}
  var content=document.querySelector('.mise-en-page > .contenu,.sa-principal');if(!content)return;content.classList.add('vb-content');if(home)content.classList.add('vb-home');
  if(!content.querySelector('.vb-banner')){
   var header=content.querySelector(':scope > .entete-page,:scope > .sa-entete'),banner=el('section','vb-only vb-banner');banner.setAttribute('aria-label','Vibra');banner.append(el('p','vb-kicker','Vibra'),wave());
   if(home)banner.append(el('h2','','Une école. Toutes les connexions.'),el('p','vb-muted','Données. Humains. Possibilités.'),el('time','vb-date'));else{var h=header&&header.querySelector('h1');banner.append(el('p','vb-muted',h?h.textContent:'Votre espace de travail'));}
   if(header)header.after(banner);else content.prepend(banner);
   if(!admin){var top=el('header','vb-only vb-top'),brand=el('div','vb-brand','Ardoise');brand.append(el('span','','/  VIBRA'));var form=el('form','vb-search'),input=el('input');input.type='search';input.placeholder='Rechercher un écran…';input.setAttribute('aria-label','Rechercher un écran');var b=el('button','vb-button','Rechercher');b.type='submit';form.append(input,b);form.onsubmit=function(e){e.preventDefault();palette(input.value);};top.append(brand,form,link({page:'mon-profil.html',libelle:'Mon profil'},'vb-profile'));document.body.append(top,el('nav','vb-only vb-dock'));document.querySelector('.vb-dock').setAttribute('aria-label','Actions Vibra');}
   if(home){var shell=el('section','vb-only vb-shell'),main=el('div','vb-main'),aside=el('aside','vb-aside');aside.setAttribute('aria-label','Priorités et agenda');aside.append(el('nav','vb-actions'),el('section','vb-team'));aside.querySelector('nav').setAttribute('aria-label','Actions rapides');var campus=el('figure','vb-campus');var img=el('img');img.src='public/vibra/campus.webp';img.alt='Campus imaginaire entouré de connexions lumineuses';img.width=1200;img.height=800;campus.append(img,el('figcaption','','Campus imaginaire · Apprendre, relier, révéler'));main.append(campus);shell.append(main,aside);banner.after(shell);}

  }
  if(home){var main=content.querySelector('.vb-main');move(content.querySelector(':scope > .grille-stats'),main);move(content.querySelector(':scope > .grille-basse'),main);}
  if(!observer){observer=new MutationObserver(schedule);document.querySelectorAll('.nav-liste,#liste-evenements').forEach(function(n){observer.observe(n,{childList:true,subtree:true,characterData:true});});}
  signature='';commands();day();
 }
 // Restore before the other themes move nodes; install after their synchronous listeners.
 document.addEventListener('ardoise:theme-change',function(){if(!active())restore();},true);
 document.addEventListener('ardoise:theme-change',function(){queueMicrotask(install);});
 document.addEventListener('keydown',function(e){if(active()&&!admin&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();palette();}});
 // Une horloge réelle, rafraîchie seulement lorsque ce thème est visible.
 setInterval(function(){if(active()&&!document.hidden)day();},60000);
 document.addEventListener('visibilitychange',function(){if(active()&&!document.hidden)day();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
 window.ArdoiseVibra={installer:install};
})();
