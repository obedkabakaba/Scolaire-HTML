/* Récré : décoration progressive, sans requête métier ni réécriture des écrans. */
(function () {
  'use strict';
  var html = document.documentElement;
  var base = new URL('public/recre/', document.currentScript.src);
  var page = location.pathname.split('/').pop().replace(/\.html$/, '');
  var scenes = {
    'dashboard-directeur':['accueil','Une belle journée pour apprendre.','Votre école, en un clin d’œil.'],
    'espace-secretaire':['dossiers','Chaque dossier trouve sa place.','Les élèves, les inscriptions et les documents, à portée de main.'],
    'espace-professeur':['cahier','Transmettre, accompagner, faire grandir.','Vos cours et le suivi de vos élèves, au même endroit.'],
    'espace-titulaire':['classe','Une classe, mille possibilités.','Gardez le fil des parcours et de la vie de votre classe.'],
    'eleves':['eleves','Chaque élève a son histoire.','Retrouvez les dossiers et accompagnez chaque parcours.'],
    'inscriptions':['inscriptions','De nouveaux parcours commencent.','Organisez les admissions et accueillez les nouveaux élèves.'],
    'classes':['classe','De la place pour toutes les idées.','Organisez vos classes, vos sections et vos options.'],
    'cours':['livres','Le savoir prend forme.','Construisez un catalogue de cours clair et vivant.'],
    'cours-classe-titulaire':['cahier','Le fil conducteur de votre classe.','Retrouvez les cours et suivez leur progression.'],
    'notes':['notes','Les progrès se dessinent ici.','Saisissez les cotes et suivez les résultats avec clarté.'],
    'presences':['presences','Chaque présence compte.','Faites l’appel et repérez les absences.'],
    'discipline':['discipline','Un cadre pour bien grandir.','Suivez la conduite et les événements de la vie scolaire.'],
    'bulletins':['bulletin','Donnez forme aux progrès.','Préparez les bulletins et suivez les validations.'],
    'bulletin-annuel':['annuel','Une année de chemin parcouru.','Rassemblez les résultats et préparez les bilans annuels.'],
    'generateur-modeles':['modeles','Votre école, jusque dans les détails.','Composez des documents clairs à l’image de votre établissement.'],
    'repechage':['repechage','Une nouvelle chance d’avancer.','Organisez les sessions et accompagnez les décisions.'],
    'orientation':['orientation','Ouvrir le champ des possibles.','Accompagnez les choix et les prochaines étapes.'],
    'calendrier':['agenda','Les temps forts se préparent.','Gardez une vue claire sur les événements de l’école.'],
    'emploi-du-temps':['horaire','Le bon rythme pour apprendre.','Organisez les cours et les horaires de la semaine.'],
    'annee-scolaire':['annee','Une année bien organisée.','Préparez les périodes et les étapes de l’année scolaire.'],
    'frais-scolaires':['paiements','Des comptes faciles à suivre.','Retrouvez les frais, les paiements et les soldes.'],
    'comptabilite':['comptabilite','Une gestion qui garde le cap.','Suivez les mouvements et les dépenses de l’établissement.'],
    'rapports':['rapports','Les chiffres racontent l’essentiel.','Analysez les résultats et préparez vos rapports.'],
    'archives':['archives','La mémoire de votre école.','Retrouvez les années et les dossiers conservés.'],
    'journal':['journal','Le fil de vos activités.','Consultez les opérations et leur historique.'],
    'messages':['messages','Le dialogue fait avancer.','Retrouvez vos échanges et les communications de l’école.'],
    'utilisateurs':['equipe','Une équipe bien connectée.','Gérez les comptes et les rôles de votre établissement.'],
    'parametres':['reglages','Une école à votre mesure.','Retrouvez les réglages et les informations de votre établissement.'],
    'mon-profil':['profil','Votre espace, votre style.','Personnalisez votre compte et choisissez votre apparence.'],
    'site-public':['site','Votre école se présente.','Mettez en valeur votre établissement et ses informations.'],
    'abonnements':['abonnement','De la place pour vos ambitions.','Choisissez votre offre et suivez votre abonnement.'],
    'support':['aide','Un coup de main, au bon moment.','Retrouvez vos demandes et échangez avec le support.'],
    'super-admin':['pilotage','Une vue claire pour agir.','Pilotez la plateforme et accompagnez les établissements.']
  };
  var statScenes = ['eleves','equipe','classe','rapports','paiements'];
  var navObserver, eventsObserver, adminObserver, scheduled = false;
  function actif() { return html.dataset.theme === 'recre'; }
  function node(tag, cls, text) {
    var n = document.createElement(tag); if (cls) n.className = cls;
    if (text) n.textContent = text; return n;
  }
  function art(scene, cls) {
    var img = node('img', 'recre-only ' + cls);
    img.src = new URL(scene + (scene === 'accueil' ? '.webp' : '.svg'), base).href;
    img.alt = ''; img.setAttribute('aria-hidden','true'); img.width = 320; img.height = 240;
    img.decoding = 'async'; return img;
  }
  function scenePour(p) { return scenes[p] || ['livres','Un espace pour avancer.','Retrouvez les outils utiles à votre journée.']; }
  function mettreArt(cible, scene, cls) {
    if (!cible.querySelector('.' + cls)) cible.prepend(art(scene,cls));
  }
  function dessinerEntete(contenu) {
    if (contenu.querySelector(':scope > .recre-hero')) return;
    var scene = scenePour(page), home = /^(dashboard-directeur|espace-)/.test(page);
    var hero = node('section','recre-only recre-hero' + (home ? ' recre-home-hero' : ''));
    hero.setAttribute('aria-label','Votre espace Récré');
    var copy = node('div','recre-hero-copy');
    copy.append(node('p','recre-kicker','Ardoise · Récré'),node('h2','',scene[1]),node('p','',scene[2]));
    if (home) copy.append(node('time','recre-date',new Intl.DateTimeFormat('fr',{day:'numeric',month:'long',year:'numeric'}).format(new Date())));
    hero.append(copy,art(home ? 'accueil' : scene[0],'recre-hero-art'));
    var entete = contenu.querySelector(':scope > .entete-page, :scope > .sa-entete');
    if (entete) entete.after(hero); else contenu.prepend(hero);
  }
  function calendrier(hote) {
    var affichage = new Date(); affichage.setDate(1);
    var barre = node('div','recre-month'), titre = node('strong');
    titre.setAttribute('aria-live','polite');
    function bouton(libelle,texte,delta) {
      var b = node('button','',texte); b.type='button'; b.setAttribute('aria-label',libelle);
      b.addEventListener('click',function(){affichage.setMonth(affichage.getMonth()+delta); rendre();}); return b;
    }
    barre.append(bouton('Mois précédent','‹',-1),titre,bouton('Mois suivant','›',1));
    var table = node('table','recre-calendar'); table.setAttribute('aria-label','Calendrier du mois');
    hote.append(barre,table);
    function rendre() {
      titre.textContent = new Intl.DateTimeFormat('fr',{month:'long',year:'numeric'}).format(affichage);
      table.replaceChildren();
      var head = table.createTHead(), ligne = head.insertRow();
      ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach(function(j){var th=node('th','',j);th.scope='col';ligne.append(th);});
      var body = table.createTBody(), debut = new Date(affichage), today = new Date();
      debut.setDate(1 - ((debut.getDay()+6)%7));
      for(var r=0;r<6;r++){
        var tr=body.insertRow();
        for(var c=0;c<7;c++){
          var td=tr.insertCell();td.textContent=debut.getDate();
          if(debut.getMonth()!==affichage.getMonth())td.className='recre-other';
          if(debut.toDateString()===today.toDateString()){td.className='recre-today';td.setAttribute('aria-current','date');}
          debut.setDate(debut.getDate()+1);
        }
      }
    }
    rendre();
  }
  function aide(hote) {
    var section = node('section','recre-help'), b = node('button','','Aide & tutoriels'); b.type='button';
    section.append(node('h2','','Besoin d’un coup de pouce ?'),art('aide','recre-help-art'),node('p','','Des guides pour vous accompagner, à chaque étape.'),b);
    b.addEventListener('click',function(){
      if(window.ArdoiseAide && typeof window.ArdoiseAide.ouvrir==='function') window.ArdoiseAide.ouvrir();
      else {
        var lien=document.querySelector('#ard-di-nav .nav-item, [data-action="aide-tutoriels"]');
        if(lien && lien!==b)lien.click();
        else { section.querySelector('p').textContent='Le guide est encore en cours de chargement. Réessayez dans un instant.'; }
      }
    }); hote.append(section);
  }
  function accueil(contenu) {
    contenu.classList.add('recre-home');
    if(contenu.querySelector(':scope > .recre-aside'))return;
    var aside=node('aside','recre-only recre-aside'); aside.setAttribute('aria-label','Agenda et accompagnement');
    var agenda=node('section','recre-agenda');agenda.append(node('h2','','Mon agenda'));
    calendrier(agenda);
    var source=document.getElementById('liste-evenements');
    if(source) {
      var events=node('div','recre-events');events.append(node('h3','','Prochains événements'));
      var liste=node('ul','liste-evenements');events.append(liste);agenda.append(events);
      function synchroniser(){
        liste.replaceChildren();
        Array.from(source.children).forEach(function(li){
          var copie=li.cloneNode(true);copie.removeAttribute('id');
          copie.querySelectorAll('[id]').forEach(function(n){n.removeAttribute('id');});liste.append(copie);
        });
      }
      synchroniser(); eventsObserver=new MutationObserver(synchroniser);
      eventsObserver.observe(source,{childList:true,subtree:true,characterData:true});
      var original=source.closest('.panneau');if(original)original.classList.add('recre-events-original');
    } else agenda.append(node('p','recre-calendar-caption','Votre repère pour organiser la journée.'));
    aside.append(agenda);aide(aside);contenu.append(aside);
  }
  function decorerLiens() {
    if(!actif())return;
    document.querySelectorAll('.tuile[data-page],.tiroir-ligne .lien[href]').forEach(function(lien){
      var p=(lien.dataset.page||lien.getAttribute('href')||'').split('/').pop().replace(/\.html$/,'');
      mettreArt(lien,p==='#'?'aide':scenePour(p)[0],'recre-tile-art');
    });
    document.querySelectorAll('.carte-stat').forEach(function(c,i){mettreArt(c,statScenes[i%statScenes.length],'recre-stat-art');});
  }
  function decorerAdmin(){
    var hero=document.querySelector('.sa-principal > .recre-hero');
    if(!hero)return;
    var route=location.hash.slice(2), section=route.split('/').pop()||'pilotage';
    var image=/ecol|prospect|demonstr/.test(route)?'equipe':/financ|cout|offr|renouvel/.test(route)?'comptabilite':/knowledge|ia|studio/.test(route)?'livres':/audit|journal/.test(route)?'journal':'pilotage';
    var img=hero.querySelector('img');img.src=new URL(image+'.svg',base).href;
    var titre=document.querySelector('.sa-entete h1');
    if(titre && titre.textContent!=='Chargement…')hero.querySelector('h2').textContent=titre.textContent;
    hero.dataset.section=section;
  }
  function planifier() {
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(function(){scheduled=false;decorerLiens();});
  }
  function installer() {
    if(!actif())return;
    var contenu=document.querySelector('.mise-en-page > .contenu, .sa-principal');
    if(!contenu)return;
    dessinerEntete(contenu);
    if(/^(dashboard-directeur|espace-)/.test(page))accueil(contenu);
    var nav=document.querySelector('.barre-laterale');
    if(nav && !nav.querySelector('.recre-profile-link')){
      var profil=node('a','recre-only recre-profile-link','Mon profil');profil.href='mon-profil.html';nav.append(profil);
    }
    decorerLiens();
    if(!navObserver) {
      // Observer seulement les hôtes que ui.js reconstruit (épingles et raccourcis).
      navObserver=new MutationObserver(planifier);
      document.querySelectorAll('.nav-liste,#lanceur').forEach(function(n){navObserver.observe(n,{childList:true,subtree:true});});
      document.addEventListener('click',function(e){
        if(e.target.closest('.nav-tiroir,#lanceur-tout,.epingle'))planifier();
      });
    }
    if(page==='mon-profil' && !document.querySelector('.recre-layout-note')) {
      var grille=document.getElementById('grille-themes');
      if(grille)grille.after(node('p','recre-only recre-layout-note','Récré utilise une navigation en haut sur ordinateur. Vos préférences de barre latérale sont conservées pour les autres apparences.'));
    }
    if(page==='super-admin'){
      decorerAdmin();
      if(!adminObserver){
        var h=document.getElementById('sa-entete');
        if(h){adminObserver=new MutationObserver(decorerAdmin);adminObserver.observe(h,{childList:true,subtree:true,characterData:true});}
        window.addEventListener('hashchange',decorerAdmin);
      }
    }
  }
  document.addEventListener('ardoise:theme-change',installer);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installer);else installer();
  window.ArdoiseRecre={scenes:Object.keys(scenes),installer:installer};
})();
