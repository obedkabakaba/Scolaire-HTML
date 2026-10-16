/* Fluide : présentation réversible, les droits et actions restent ceux d'Ardoise. */
(function(){
 'use strict';
 var html=document.documentElement,page=location.pathname.split('/').pop(),home=/^(dashboard-directeur|espace-)/.test(page),admin=page==='super-admin.html';
 var moves=[],observer,queued=false,signature='';
 function active(){return html.dataset.theme==='fluide';}
 function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;}
 function allowed(p){var a=window.ArdoiseAcces;return !!(a&&a.pageConnue(p)&&a.peutVoirPage(p));}
 function links(){var items=window.ArdoiseRail?window.ArdoiseRail.elements:[];var seen=new Set();return items.filter(function(a){if(!allowed(a.page)||seen.has(a.page))return false;seen.add(a.page);return true;});}
 function link(a,cls){var n=el('a',cls,a.libelle);n.href=a.page;return n;}
 function wave(){var img=el('img','fl-emblem');img.src='public/fluide/vague.svg';img.alt='';img.width=96;img.height=64;return img;}
 function palette(query){
  var d=document.getElementById('fl-tools');
  if(!d){d=el('dialog','fl-only fl-tools');d.id='fl-tools';d.setAttribute('aria-labelledby','fl-tools-title');var row=el('div','fl-row'),title=el('h2','','Votre destination');title.id='fl-tools-title';var close=el('button','fl-button','Fermer');close.type='button';close.onclick=function(){d.close();};row.append(title,close);var input=el('input');input.type='search';input.setAttribute('aria-label','Rechercher un écran');input.placeholder='Élèves, classes, documents…';input.oninput=render;d.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();d.close();}});d.append(row,input,el('nav','fl-results'));d.querySelector('nav').setAttribute('aria-label','Écrans disponibles');document.body.append(d);}
  function render(){var q=d.querySelector('input').value.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'');var list=d.querySelector('nav');list.replaceChildren();links().filter(function(a){return a.libelle.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q);}).forEach(function(a){list.append(link(a,'fl-result'));});if(!list.children.length)list.append(el('p','fl-muted','Aucun écran trouvé.'));}
  d.querySelector('input').value=query||'';render();if(!d.open)d.showModal();d.querySelector('input').focus();
 }
 var ICONES={accueil:'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',inscriptions:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6',notes:'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',messages:'M22 2 11 13M22 2l-7 20-4-9-9-4z','frais-scolaires':'M2 7h20v12H2zM2 11h20',eleves:'M22 10 12 5 2 10l10 5zM6 12v5c3 2 9 2 12 0v-5',loupe:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4'};
 function icone(nom){var ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg'),p=document.createElementNS(ns,'path');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('fill','none');s.setAttribute('stroke','currentColor');s.setAttribute('stroke-width','1.9');s.setAttribute('stroke-linecap','round');s.setAttribute('stroke-linejoin','round');s.setAttribute('aria-hidden','true');p.setAttribute('d',ICONES[nom]||ICONES.accueil);s.append(p);return s;}
 /* Dock façon barre d'onglets : une « lentille » de verre glisse vers
    l'onglet survolé, s'étire pendant le trajet puis se repose. */
 function dockTabs(dock,items){
  dock.replaceChildren();var lens=el('span','fl-lentille');lens.setAttribute('aria-hidden','true');dock.append(lens);
  var home=items[0];var choix=[home&&{page:home.page,libelle:'Accueil',ic:'accueil'}];
  [['inscriptions.html','Inscrire','inscriptions'],['notes.html','Notes','notes'],['eleves.html','Élèves','eleves'],['messages.html','Messages','messages'],['frais-scolaires.html','Paiements','frais-scolaires']].forEach(function(o){if(choix.length>=4)return;var a=items.find(function(x){return x.page===o[0];});if(a&&(!home||a.page!==home.page))choix.push({page:a.page,libelle:o[1],ic:o[2]});});
  choix.filter(Boolean).forEach(function(c){var n=el('a','fl-onglet');n.href=c.page;n.append(icone(c.ic),el('span','',c.libelle));if(c.page===page)n.setAttribute('aria-current','page');dock.append(n);});
  dock.append(el('span','fl-sep'));
  var loupe=el('button','fl-onglet fl-loupe');loupe.type='button';loupe.setAttribute('aria-label','Rechercher une action (Ctrl K)');loupe.title='Rechercher · Ctrl K';loupe.append(icone('loupe'));loupe.onclick=function(){palette();};dock.append(loupe);
  function poser(cible){if(!cible){var cur=dock.querySelector('.fl-onglet[aria-current="page"]');if(!cur){lens.style.opacity='0';return;}cible=cur;}lens.style.opacity='1';lens.classList.add('fl-etire');lens.style.left=cible.offsetLeft+'px';lens.style.width=cible.offsetWidth+'px';clearTimeout(lens._t);lens._t=setTimeout(function(){lens.classList.remove('fl-etire');},260);}
  dock.onpointerover=function(e){var t=e.target.closest('.fl-onglet:not(.fl-loupe)');if(t)poser(t);};
  dock.onpointerleave=function(){poser(null);};
  dock.onfocusin=function(e){var t=e.target.closest('.fl-onglet:not(.fl-loupe)');if(t)poser(t);};
  requestAnimationFrame(function(){poser(null);});
 }
 function commands(){
  var dock=document.querySelector('.fl-dock');if(dock)dockTabs(dock,links());
  var host=document.querySelector('.fl-actions');if(!host)return;host.replaceChildren();var items=links();
  var options=[['inscriptions.html','Inscription','Accueillir les nouveaux élèves','people'],['notes.html','Notes','Saisir et consulter','pen'],['frais-scolaires.html','Paiement','Suivre les frais et paiements','card'],['messages.html','Messages','Communiquer','send']];
  options.forEach(function(o){var a=items.find(function(x){return x.page===o[0];});if(!a)return;var n=link(a,'fl-action');n.dataset.kind=o[3];n.replaceChildren();var symbol=el('span','fl-action-symbol');symbol.setAttribute('aria-hidden','true');n.append(symbol,el('strong','',o[1]),el('span','fl-muted',o[2]));host.append(n);});
  if(!host.children.length){var all=el('button','fl-button','Ouvrir mes outils');all.type='button';all.onclick=function(){palette();};host.append(all);}
  var team=document.querySelector('.fl-team');if(team){team.replaceChildren();team.append(el('h2','','Ensemble, chaque jour'),el('p','fl-team-count'));var a=items.find(function(x){return x.page==='utilisateurs.html';})||items.find(function(x){return x.page==='messages.html';});if(a)team.append(link(a,'fl-text-link'));}
 }
 function day(){
  var time=document.querySelector('.fl-date');if(time){var now=new Date();time.dateTime=now.toISOString();time.textContent=new Intl.DateTimeFormat('fr',{dateStyle:'full'}).format(now);}
  var ile=document.querySelector('.fl-ile');if(ile){var maintenant=new Date();ile.querySelector('.fl-ile-heure').textContent=new Intl.DateTimeFormat('fr',{hour:'2-digit',minute:'2-digit'}).format(maintenant);var src=document.getElementById('liste-evenements'),prochain=src&&src.firstElementChild&&src.firstElementChild.textContent.replace(/\s+/g,' ').trim();ile.querySelector('.fl-ile-detail').textContent=new Intl.DateTimeFormat('fr',{weekday:'long',day:'numeric',month:'long'}).format(maintenant)+(prochain&&!/aucun|chargement/i.test(prochain)?' · '+prochain.slice(0,48):'');}
  var team=document.querySelector('.fl-team-count'),stat=document.getElementById('stat-profs');if(team)team.textContent=stat&&/^\d+$/.test(stat.textContent.trim())?stat.textContent.trim()+' professeurs dans votre école':'Retrouvez les échanges et les outils de votre espace.';
 }
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;if(!active())return;var next=links().map(function(a){return a.page;}).join('|');if(next!==signature){signature=next;commands();}day();});}
 function move(n,to){if(!n||moves.some(function(m){return m.node===n;}))return;var mark=document.createComment('Emplacement avant Fluide');n.before(mark);moves.push({node:n,mark:mark});to.append(n);}
 function restore(){moves.forEach(function(m){if(m.mark.isConnected)m.mark.replaceWith(m.node);});moves=[];}
 function install(){
  if(!active()){restore();var modal=document.getElementById('fl-tools');if(modal&&modal.open)modal.close();return;}
  var content=document.querySelector('.mise-en-page > .contenu,.sa-principal');if(!content)return;content.classList.add('fl-content');if(home)content.classList.add('fl-home');
  if(!content.querySelector('.fl-banner')){
   var header=content.querySelector(':scope > .entete-page,:scope > .sa-entete'),banner=el('section','fl-only fl-banner');banner.setAttribute('aria-label','Fluide');banner.append(el('p','fl-kicker','Fluide'),wave());
   if(home)banner.append(el('h2','','Votre journée, en toute clarté.'),el('p','fl-muted','Apprendre. Grandir. Ensemble.'),el('time','fl-date'));else{var h=header&&header.querySelector('h1');banner.append(el('p','fl-muted',h?h.textContent:'Votre espace de travail'));}
   if(header)header.after(banner);else content.prepend(banner);
   if(!admin){var top=el('header','fl-only fl-top'),brand=el('div','fl-brand','Ardoise');brand.append(el('span','','/  FLUIDE'));var form=el('form','fl-search'),input=el('input');input.type='search';input.placeholder='Rechercher un écran…';input.setAttribute('aria-label','Rechercher un écran');var b=el('button','fl-button','Rechercher');b.type='submit';form.append(input,b);form.onsubmit=function(e){e.preventDefault();palette(input.value);};var ile=el('div','fl-ile');ile.tabIndex=0;ile.setAttribute('role','status');ile.setAttribute('aria-label','Heure et prochain rendez-vous');ile.append(el('span','fl-ile-point'),el('span','fl-ile-heure'),el('span','fl-ile-detail'));top.append(brand,ile,form,link({page:'mon-profil.html',libelle:'Mon profil'},'fl-profile'));document.body.append(top,el('nav','fl-only fl-dock'));document.querySelector('.fl-dock').setAttribute('aria-label','Actions Fluide');}
   if(home){var shell=el('section','fl-only fl-shell'),main=el('div','fl-main'),aside=el('aside','fl-aside');aside.setAttribute('aria-label','Raccourcis et équipe');aside.append(el('nav','fl-actions'),el('section','fl-team'));aside.querySelector('nav').setAttribute('aria-label','Actions rapides');shell.append(main,aside);banner.after(shell);}

  }
  if(home){var main=content.querySelector('.fl-main');move(content.querySelector(':scope > .grille-stats'),main);move(content.querySelector(':scope > .grille-basse'),main);}
  if(!observer){observer=new MutationObserver(schedule);document.querySelectorAll('.nav-liste,#stat-profs').forEach(function(n){observer.observe(n,{childList:true,subtree:true,characterData:true});});}
  matiere();signature='';commands();day();
 }
 /* Matière : fond vivant et reflet qui suit le pointeur. */
 var VERRE='.carte-stat,.panneau,.widget,.carte-section,.carte-config,.carte-cours,.carte-recap,.fiche,.sa-carte,.sa-panneau,.fl-top,.fl-actions,.fl-action,.fl-team,.fl-dock,.fl-ile,.barre-laterale';
 function matiere(){
  if(!document.querySelector('.fl-fond')){var fond=el('div','fl-only fl-fond');fond.setAttribute('aria-hidden','true');for(var i=0;i<5;i++)fond.append(el('i'));document.body.prepend(fond);}
 }
 var survole=null,cadre=false,dernier=null;
 document.addEventListener('pointermove',function(e){if(!active()||e.pointerType==='touch')return;dernier=e;if(cadre)return;cadre=true;requestAnimationFrame(function(){cadre=false;var t=dernier.target&&dernier.target.closest?dernier.target.closest(VERRE):null;if(survole&&survole!==t){survole.style.removeProperty('--lg-x');survole.style.removeProperty('--lg-y');}survole=t;if(!t)return;var r=t.getBoundingClientRect();if(!r.width||!r.height)return;t.style.setProperty('--lg-x',((dernier.clientX-r.left)/r.width*100).toFixed(1)+'%');t.style.setProperty('--lg-y',((dernier.clientY-r.top)/r.height*100-30).toFixed(1)+'%');});},{passive:true});
 window.addEventListener('scroll',function(){if(active())html.classList.toggle('fl-defile',window.scrollY>12);},{passive:true});
 document.addEventListener('ardoise:theme-change',function(){if(!active()){html.classList.remove('fl-defile');if(survole){survole.style.removeProperty('--lg-x');survole.style.removeProperty('--lg-y');survole=null;}}});
 // Restore before the other themes move nodes; install after their synchronous listeners.
 document.addEventListener('ardoise:theme-change',function(){if(!active())restore();},true);
 document.addEventListener('ardoise:theme-change',function(){queueMicrotask(install);});
 document.addEventListener('keydown',function(e){if(active()&&!admin&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();palette();}});
 // Une horloge réelle, rafraîchie seulement lorsque ce thème est visible.
 setInterval(function(){if(active()&&!document.hidden)day();},60000);
 document.addEventListener('visibilitychange',function(){if(active()&&!document.hidden)day();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
 window.ArdoiseFluide={installer:install};
})();
