/* Nexus : navigation contextuelle. La politique et les actions métier restent celles d’Ardoise. */
(function () {
  'use strict';
  var html=document.documentElement, page=location.pathname.split('/').pop();
  var home=/^(dashboard-directeur|espace-)/.test(page), isAdmin=page==='super-admin.html';
  var selected='classes', signature='', scheduled=false, observed=false, classesPromise=null;
  var groups=[
    {id:'eleves',title:'Élèves',icon:'people',desc:'Dossiers, inscriptions et parcours.',pages:['eleves.html','inscriptions.html','orientation.html'],stat:'stat-eleves',unit:'élèves'},
    {id:'classes',title:'Classes',icon:'book',desc:'Cours, horaires et organisation scolaire.',pages:['classes.html','cours.html','cours-classe-titulaire.html','emploi-du-temps.html','annee-scolaire.html','calendrier.html'],stat:'stat-classes',unit:'classes'},
    {id:'resultats',title:'Notes & bulletins',icon:'document',desc:'Résultats, assiduité et suivi pédagogique.',pages:['notes.html','bulletins.html','bulletin-annuel.html','presences.html','discipline.html','repechage.html','generateur-modeles.html'],stat:'stat-reussite',unit:'moyenne générale'},
    {id:'gestion',title:'Gestion',icon:'coins',desc:'Finances, rapports et administration.',pages:['frais-scolaires.html','comptabilite.html','rapports.html','archives.html','journal.html','abonnements.html'],stat:'stat-impayes',unit:'élèves en retard de paiement'},
    {id:'equipe',title:'Équipe',icon:'team',desc:'Comptes, échanges et espace personnel.',pages:['utilisateurs.html','messages.html','parametres.html','site-public.html','mon-profil.html','support.html','changer-mot-de-passe.html'],stat:'stat-profs',unit:'professeurs'}
  ];
  var icons={
    school:'M3 21V9l9-6 9 6v12M8 21v-6h8v6M6 10h2m8 0h2M6 13h2m8 0h2M12 6v5m-2-2h4',
    people:'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M1 21v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 8m1 3q5 0 5 6',
    book:'M12 5Q6 1 2 4v16q5-3 10 1 5-4 10-1V4q-4-3-10 1Zm0 0v16',
    document:'M5 2h10l5 5v15H5ZM14 2v6h6M8 12h9M8 16h9M8 19h6',
    coins:'M3 6a9 4 0 1 0 18 0 9 4 0 1 0-18 0m0 0v12c0 5 18 5 18 0V6M3 12c0 5 18 5 18 0',
    team:'M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M3 21v-3a6 6 0 0 1 12 0v3M17 10a3 3 0 1 0 0-6m0 10q6 0 6 7',
    arrow:'M5 12h14m-6-6 6 6-6 6',
    search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6'
  };
  function active(){return html.dataset.theme==='nexus';}
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;}
  function icon(name){var s=document.createElementNS('http://www.w3.org/2000/svg','svg'),p=document.createElementNS(s.namespaceURI,'path');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');p.setAttribute('d',icons[name]||icons.document);s.append(p);return s;}
  function groupFor(p){return groups.find(function(g){return g.pages.indexOf(p)!==-1;})||groups[4];}
  function allowed(p){var a=window.ArdoiseAcces;return !!(a&&a.pageConnue(p)&&a.peutVoirPage(p));}
  function links(){
    // Le rail a déjà appliqué les droits et les suppressions d’écrans indisponibles.
    var items=window.ArdoiseRail?window.ArdoiseRail.elements:[];
    if(!items.length)items=Array.from(document.querySelectorAll('.barre-laterale .nav-item[href]')).filter(function(a){return !a.hidden;}).map(function(a){return {page:a.getAttribute('href'),libelle:(a.querySelector('.nav-libelle')||a).textContent.trim()};});
    var found=new Set();
    return items.filter(function(e){if(!allowed(e.page)||found.has(e.page))return false;found.add(e.page);return true;}).map(function(e){return {page:e.page,libelle:e.libelle};});
  }
  function value(g){var n=document.getElementById(g.stat);return n?n.textContent.trim():'';}
  function link(item,cls){var a=el('a',cls,item.libelle);a.href=item.page;return a;}
  function groupLinks(g){return links().filter(function(a){return g.pages.indexOf(a.page)!==-1;});}
  function statText(g){var v=value(g);return v&&v!=='–'&&v!=='—'?v+' '+g.unit:g.desc;}
  function renderInspector(){
    var host=document.querySelector('.nx-inspector');if(!host)return;
    var g=groups.find(function(x){return x.id===selected;})||groups[4], items=groupLinks(g);
    host.replaceChildren();host.dataset.group=g.id;
    host.append(el('p','nx-eyebrow','Contexte / '+g.title));
    var title=el('h2');title.append(icon(g.icon),el('span','',g.title));host.append(title,el('p','nx-muted',g.desc));
    var summary=el('p','nx-summary',statText(g));host.append(summary);
    var nav=el('nav','nx-related');nav.setAttribute('aria-label','Accès '+g.title);
    items.forEach(function(a){var n=link(a,'nx-related-link');if(a.page===page)n.setAttribute('aria-current','page');n.append(icon('arrow'));nav.append(n);});
    if(!items.length)nav.append(el('p','nx-muted','Retrouvez les outils de votre espace dans le menu.'));
    host.append(nav);
    if(home&&g.id==='classes'&&items.some(function(a){return a.page==='classes.html';})){
      var list=el('div','nx-class-list');list.setAttribute('aria-live','polite');list.append(el('p','nx-muted','Chargement des classes…'));host.append(list);
      loadClasses().then(function(rows){
        if(!list.isConnected)return;list.replaceChildren();
        if(rows===null){list.append(el('p','nx-muted','Les classes ne sont pas disponibles pour le moment.'));var retry=el('button','nx-secondary','Réessayer');retry.type='button';retry.onclick=function(){classesPromise=null;renderInspector();};list.append(retry);return;}
        if(!rows.length){list.append(el('p','nx-muted','Aucune classe enregistrée.'));return;}
        var ul=el('ul');
        rows.slice(0,8).forEach(function(c){var li=el('li');li.append(el('span','',String(c.nom||'Classe')),el('span','nx-muted',Number.isFinite(Number(c.nb_eleves))&&c.nb_eleves!=null?String(c.nb_eleves)+' élèves':''));ul.append(li);});
        list.append(ul);if(rows.length>8)list.append(el('p','nx-muted',String(rows.length)+' classes au total'));
      });
    }
    var primary=items.find(function(a){return a.page===g.pages[0]&&a.page!==page;})||items.find(function(a){return a.page!==page;})||items[0];
    if(primary){var a=link(primary,'nx-primary');a.textContent='Ouvrir · '+primary.libelle;a.append(icon('arrow'));host.append(a);}
    var help=el('button','nx-help','Aide & tutoriels');help.type='button';help.onclick=function(){if(window.ArdoiseAide)window.ArdoiseAide.ouvrir();else help.textContent='Le guide est en cours de chargement…';};host.append(help);
  }
  function loadClasses(){
    if(!allowed('classes.html'))return Promise.resolve(null);
    if(!classesPromise){
      var api=window.ArdoiseSession&&window.ArdoiseSession.appelApi;
      if(!api)return Promise.resolve(null);
      classesPromise=api('/classes').then(function(r){return r&&r.ok?r.json():null;}).then(function(r){return Array.isArray(r)?r:null;}).catch(function(){return null;});
    }
    return classesPromise;
  }
  function select(id){selected=id;document.querySelectorAll('.nx-node').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.group===id));});renderInspector();}
  function renderMap(){
    var map=document.querySelector('.nx-map');if(!map)return;
    map.replaceChildren();var available=groups.filter(function(g){return groupLinks(g).length;});
    if(!available.some(function(g){return g.id===selected;}))selected=available.length?available[0].id:'equipe';
    var hub=el('div','nx-hub');hub.append(icon('school'),el('h3','','Mon école'),el('p','nx-muted','Vos espaces connectés'));map.append(hub);
    available.forEach(function(g,i){
      var b=el('button','nx-node');b.type='button';b.dataset.group=g.id;b.style.setProperty('--slot',i);b.setAttribute('aria-controls','nx-context');b.setAttribute('aria-pressed',String(g.id===selected));
      b.append(icon(g.icon),el('strong','',g.title),el('span','nx-node-stat',statText(g)),icon('arrow'));b.onclick=function(){select(g.id);};map.append(b);
    });map.dataset.count=available.length;
  }
  function refreshData(){
    groups.forEach(function(g){var n=document.querySelector('.nx-node[data-group="'+g.id+'"] .nx-node-stat');if(n)n.textContent=statText(g);});
    var group=groups.find(function(g){return g.id===selected;});var summary=document.querySelector('.nx-summary');if(summary&&group)summary.textContent=statText(group);
    var strip=document.querySelector('.nx-events');if(strip){strip.replaceChildren();strip.append(el('span','nx-eyebrow','À venir'));var src=document.getElementById('liste-evenements');
      if(src&&src.children.length)Array.from(src.children).slice(0,3).forEach(function(li){strip.append(el('p','nx-event',li.textContent.replace(/\s+/g,' ').trim()));});
      else strip.append(el('p','nx-muted',new Intl.DateTimeFormat('fr',{dateStyle:'full'}).format(new Date())));
    }
  }
  function toolsDialog(query){
    var dialog=document.getElementById('nx-tools');if(!dialog){
      dialog=el('dialog','nx-only nx-tools');dialog.id='nx-tools';dialog.setAttribute('aria-labelledby','nx-tools-title');
      dialog.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();dialog.close();}});
      var head=el('div','nx-tools-head'),title=el('h2','','Tous les outils');title.id='nx-tools-title';var close=el('button','nx-secondary','Fermer');close.type='button';close.onclick=function(){dialog.close();};head.append(title,close);
      var input=el('input');input.type='search';input.placeholder='Rechercher un écran…';input.setAttribute('aria-label','Rechercher un écran');
      var results=el('nav','nx-tools-results');results.setAttribute('aria-label','Résultats de la recherche');input.oninput=function(){renderResults();};dialog.append(head,input,results);document.body.append(dialog);
    }
    function renderResults(){var q=dialog.querySelector('input').value.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'');var results=dialog.querySelector('nav');results.replaceChildren();
      links().filter(function(a){return a.libelle.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q);}).forEach(function(a){results.append(link(a,'nx-related-link'));});
      if(!results.children.length)results.append(el('p','nx-muted','Aucun écran trouvé.'));
    }
    dialog.querySelector('input').value=query||'';renderResults();if(!dialog.open)dialog.showModal();dialog.querySelector('input').focus();
  }
  function renderDock(){
    var dock=document.querySelector('.nx-dock');if(!dock)return;dock.replaceChildren();
    var form=el('form','nx-search'),input=el('input');input.type='search';input.placeholder='Rechercher un écran…';input.setAttribute('aria-label','Rechercher un écran');var submit=el('button','nx-secondary');submit.type='submit';submit.setAttribute('aria-label','Rechercher');submit.append(icon('search'));form.append(input,submit);form.onsubmit=function(e){e.preventDefault();toolsDialog(input.value);};dock.append(form);
    var items=links();['inscriptions.html','notes.html','messages.html'].forEach(function(p){var a=items.find(function(a){return a.page===p;});if(a)dock.append(link(a,'nx-dock-link'));});
    var all=el('button','nx-secondary','Tous les outils');all.type='button';all.onclick=function(){toolsDialog();};dock.append(all);
  }
  function update(){
    if(!active())return;var items=links(),next=JSON.stringify(items);
    if(next!==signature){signature=next;renderMap();renderInspector();renderDock();}
    refreshData();
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;update();});}
  function install(){
    if(!active()){var modal=document.getElementById('nx-tools');if(modal&&modal.open)modal.close();return;}
    var content=document.querySelector('.mise-en-page > .contenu, .sa-principal');if(!content)return;
    content.classList.add('nx-content');if(home)content.classList.add('nx-home');
    if(!content.querySelector('.nx-workspace')){
      var workspace=el('section','nx-only nx-workspace');workspace.setAttribute('aria-label','Espace Nexus');
      var main=el('div','nx-main');
      if(home){var events=el('section','nx-events');events.setAttribute('aria-label','Prochains événements');main.append(events);main.append(el('p','nx-eyebrow','Nexus / Vue globale'),el('h2','','Carte de votre école'),el('p','nx-muted','Un même lieu, toutes les connexions.'));
        var map=el('div','nx-map');map.setAttribute('role','group');map.setAttribute('aria-label','Choisir un espace');main.append(map);
      }else{
        selected=groupFor(page).id;
        var title=document.querySelector('.entete-page h1,.sa-entete h1');main.append(el('p','nx-eyebrow','Nexus / '+(isAdmin?'Plateforme':groupFor(page).title)),el('h2','nx-page-title',title?title.textContent:'Votre espace'),el('p','nx-muted','Vos données et vos actions, au centre.'));
      }
      var inspector=el('aside','nx-inspector');inspector.id='nx-context';inspector.setAttribute('aria-label','Panneau contextuel');workspace.append(main,inspector);
      var header=content.querySelector(':scope > .entete-page,:scope > .sa-entete');if(header)header.after(workspace);else content.prepend(workspace);
      if(!isAdmin){var dock=el('nav','nx-only nx-dock');dock.setAttribute('aria-label','Commandes Nexus');document.body.append(dock);}
      var profile=el('a','nx-only nx-profile','Mon profil');profile.href='mon-profil.html';var nav=document.querySelector('.barre-laterale');if(nav)nav.append(profile);
    }
    if(!observed){
      var observer=new MutationObserver(schedule);
      document.querySelectorAll('.nav-liste,#liste-evenements,#stat-eleves,#stat-classes,#stat-profs,#stat-reussite,#stat-impayes').forEach(function(n){observer.observe(n,{childList:true,subtree:true,characterData:true});});
      if(isAdmin){var heading=document.querySelector('.sa-entete');if(heading)new MutationObserver(function(){var h=document.querySelector('.sa-entete h1'),n=document.querySelector('.nx-page-title');if(h&&n)n.textContent=h.textContent;}).observe(heading,{childList:true,subtree:true,characterData:true});}
      observed=true;
    }
    signature='';update();
  }
  document.addEventListener('ardoise:theme-change',install);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.ArdoiseNexus={installer:install};
})();
