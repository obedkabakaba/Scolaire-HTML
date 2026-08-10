/* =============================================================================
   ARDOISE — COQUE MOBILE
   =============================================================================

   CE QUE FAIT CE FICHIER
   ----------------------
   Il pose sur les écrans applicatifs les trois pièces qu'une application de
   téléphone possède et qu'un site converti n'a jamais :

     1. une barre supérieure fixe, qui porte le nom de l'écran et le bouton du
        menu, et qui reste là quand la page défile ;
     2. un tiroir de navigation qui glisse par-dessus le contenu au lieu de le
        pousser vers le bas ;
     3. une barre inférieure avec les quatre écrans que l'utilisateur a
        épinglés — la zone qu'un pouce atteint sans changer de prise.

   POURQUOI EN JAVASCRIPT ET NON DANS LES PAGES
   --------------------------------------------
   Même raison que `ui.js` : trente-sept pages à modifier, ce sont trente-sept
   occasions d'oublier, et un menu qui diverge d'un écran à l'autre. Une page
   ajoutée demain reçoit sa coque sans qu'on y touche.

   CE QU'IL NE FAIT PAS
   --------------------
   Il ne remplace aucun comportement existant. Le bouton hamburger de `ui.js`
   bascule toujours la même classe `nav-ouverte` sur `.barre-laterale` ; ce
   fichier se contente de l'observer et d'en tirer les conséquences (voile,
   verrouillage du défilement, état du bouton). Si ce script ne se charge pas,
   la plateforme fonctionne exactement comme avant.
   ============================================================================= */

(function () {
  'use strict';

  var SEUIL = 780;
  var petitEcran = window.matchMedia('(max-width: ' + SEUIL + 'px)');

  /* Familles du menu — reprises de `ui.js` pour que le tiroir et le lanceur
     racontent la même organisation. Une page absente de cette table reste
     accessible : elle tombe simplement dans « Autres ». */
  var FAMILLES = [
    { titre: 'Accueil', pages: ['dashboard-directeur.html', 'espace-secretaire.html',
        'espace-professeur.html', 'espace-titulaire.html'] },
    { titre: 'Élèves et parcours', pages: ['eleves.html', 'inscriptions.html',
        'orientation.html', 'presences.html'] },
    { titre: 'Pédagogie', pages: ['classes.html', 'cours.html', 'emploi-du-temps.html',
        'notes.html', 'cours-classe-titulaire.html'] },
    { titre: 'Bulletins', pages: ['bulletins.html', 'bulletin-annuel.html',
        'generateur-modeles.html', 'repechage.html'] },
    { titre: 'Vie scolaire', pages: ['discipline.html', 'calendrier.html', 'messages.html'] },
    { titre: 'Finances', pages: ['frais-scolaires.html', 'comptabilite.html'] },
    { titre: 'Pilotage', pages: ['rapports.html', 'archives.html', 'journal.html'] },
    { titre: 'Administration', pages: ['annee-scolaire.html', 'utilisateurs.html',
        'site-public.html', 'parametres.html', 'mon-profil.html'] }
  ];

  var ICONE_MENU = '<circle cx="5" cy="6" r="1.4"/><circle cx="5" cy="12" r="1.4"/>'
    + '<circle cx="5" cy="18" r="1.4"/><path d="M10 6h10"/><path d="M10 12h10"/><path d="M10 18h10"/>';

  function page() {
    return window.location.pathname.split('/').pop() || '';
  }

  /* ==========================================================================
     1. APERÇUS DE BULLETIN
     Quatre pages en millimètres, sans barre de navigation. Elles n'ont pas de
     coque à recevoir : elles ont besoin d'être mises à l'échelle de l'écran.
     ========================================================================== */
  function ajusterFeuille() {
    var feuilles = document.querySelectorAll('.page');
    if (!feuilles.length) return false;
    document.body.classList.add('ard-mob-feuille');

    function recalculer() {
      if (!petitEcran.matches) {
        document.body.style.removeProperty('--mob-echelle');
        for (var j = 0; j < feuilles.length; j++) feuilles[j].style.marginBottom = '';
        return;
      }
      var dispo = document.documentElement.clientWidth;
      for (var i = 0; i < feuilles.length; i++) {
        var f = feuilles[i];
        /* La largeur NATURELLE de la feuille, mesurée hors mise à l'échelle.
           `scrollWidth` et non `offsetWidth` : sur ces bulletins, certaines
           cases (signatures, grilles de cotes) débordent volontairement du
           cadre. Se fier au seul cadre laissait ces débordements hors écran —
           c'est-à-dire la colonne de droite du bulletin, coupée. */
        var naturelle = Math.max(f.offsetWidth, f.scrollWidth);
        if (!naturelle) continue;
        var echelle = Math.min(1, dispo / naturelle);
        document.body.style.setProperty('--mob-echelle', String(echelle));
        // Une transformation ne change pas la place réservée dans le flux :
        // sans cette correction, la page garderait la hauteur d'origine et
        // laisserait un grand vide sous chaque bulletin.
        f.style.marginBottom = -(f.offsetHeight * (1 - echelle)) + 'px';
      }
    }

    recalculer();
    window.addEventListener('resize', recalculer);
    window.addEventListener('orientationchange', recalculer);
    return true;
  }

  /* ==========================================================================
     2. LA COQUE
     ========================================================================== */
  var barre = null, voile = null, pied = null, titreEl = null, pastilleEl = null;

  function construireBarreHaute(nav) {
    barre = document.createElement('header');
    barre.className = 'ard-mob-barre';

    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'ard-mob-bouton';
    bouton.setAttribute('aria-label', 'Ouvrir le menu');
    bouton.setAttribute('aria-expanded', 'false');
    bouton.setAttribute('aria-controls', 'ard-mob-tiroir');
    bouton.innerHTML = '<span></span><span></span><span></span>';
    bouton.addEventListener('click', function () { basculer(); });

    titreEl = document.createElement('span');
    titreEl.className = 'ard-mob-titre';
    titreEl.textContent = titrePage();

    pastilleEl = document.createElement('span');
    pastilleEl.className = 'ard-mob-pastille';

    barre.appendChild(bouton);
    barre.appendChild(titreEl);
    barre.appendChild(pastilleEl);
    document.body.insertBefore(barre, document.body.firstChild);

    /* Drapeau lu par `mobile.css`. C'est lui, et non la simple largeur de
       l'écran, qui autorise la feuille à réserver 56 px en haut et 58 px en
       bas de <body>. Les pages sans barre latérale — tout le site public —
       n'arrivent jamais ici et gardent donc leur mise en page intacte. */
    document.documentElement.classList.add('ard-mob-coque');

    voile = document.createElement('div');
    voile.className = 'ard-mob-voile';
    voile.addEventListener('click', function () { basculer(false); });
    document.body.appendChild(voile);

    nav.id = nav.id || 'ard-mob-tiroir';

    /* Une croix dans le tiroir.
       Le voile, le balayage et la touche Échap referment déjà le panneau — mais
       aucun des trois ne se voit. Le hamburger, lui, passe SOUS le tiroir une
       fois celui-ci ouvert : l'utilisateur qui vient de l'actionner ne le
       retrouve plus. Il faut donc une cible explicite, et elle doit vivre dans
       le panneau. */
    var fermer = document.createElement('button');
    fermer.type = 'button';
    fermer.className = 'ard-mob-fermer';
    fermer.setAttribute('aria-label', 'Fermer le menu');
    fermer.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
      + '<path d="m6 6 12 12"/><path d="m18 6-12 12"/></svg>';
    fermer.addEventListener('click', function () { basculer(false); });
    nav.insertBefore(fermer, nav.firstChild);
  }

  /**
   * Le nom de l'écran.
   *
   * Le `<h1>` de la page est la source la plus juste : c'est le mot que
   * l'utilisateur vient de lire dans le menu. Le `<title>` sert de repli, une
   * fois retiré le préfixe « Ardoise — » qui ne dit rien de plus que le logo
   * déjà présent sur la barre.
   */
  function titrePage() {
    var h1 = document.querySelector('.entete-page h1, .contenu h1');
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();
    return (document.title || 'Ardoise').replace(/^Ardoise\s*[—–-]\s*/, '');
  }

  /* ------------------------------------------------------ Ouverture/fermeture */

  function estOuvert(nav) {
    return nav.classList.contains('nav-ouverte');
  }

  function basculer(forcer) {
    var nav = document.querySelector('.barre-laterale');
    if (!nav) return;
    var ouvrir = forcer !== undefined ? forcer : !estOuvert(nav);
    nav.classList.toggle('nav-ouverte', ouvrir);
    synchroniser();
  }

  /**
   * Aligne la coque sur l'état réel du tiroir.
   *
   * On passe par un observateur plutôt que par un simple gestionnaire de clic
   * parce que `ui.js` bascule la même classe de son côté (bouton d'origine,
   * touche Échap, clic sur un lien, retour en grand écran). Observer l'état
   * plutôt que les gestes garantit que le voile et le verrouillage ne se
   * désynchronisent jamais, quel que soit le chemin emprunté.
   */
  function synchroniser() {
    var nav = document.querySelector('.barre-laterale');
    if (!nav) return;
    var ouvert = estOuvert(nav) && petitEcran.matches;
    document.documentElement.classList.toggle('ard-mob-ouvert', ouvert);
    if (barre) {
      var b = barre.querySelector('.ard-mob-bouton');
      b.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      b.setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu');
    }
    nav.setAttribute('aria-hidden', (!ouvert && petitEcran.matches) ? 'true' : 'false');
  }

  /* ------------------------------------------------- Organisation du tiroir */

  /**
   * Rend au menu les entrées repliées par le rail, et les regroupe par famille.
   *
   * `reduireRail()` (ui.js) n'affiche que les écrans épinglés : c'est le bon
   * choix sur un rail latéral haut de 700 px, ce n'est pas le bon dans un
   * tiroir qui occupe tout l'écran et qui défile. Un tiroir dans un tiroir
   * n'est pas une navigation, c'est une chasse au trésor.
   *
   * On ne touche qu'aux entrées portant `data-epingle` : cet attribut n'est
   * posé que par le rail. Les entrées écartées par le RÔLE n'en ont pas et
   * restent masquées — un professeur ne doit pas voir la comptabilité parce
   * qu'il a tourné son téléphone.
   */
  function deployerMenu(nav) {
    var liste = nav.querySelector('.nav-liste');
    if (!liste) return;

    // « Tous les menus » perd son objet une fois la liste complète affichée.
    var tiroir = liste.querySelector('.nav-tiroir');
    if (tiroir && tiroir.parentNode) tiroir.parentNode.classList.add('ard-mob-sans-objet');

    if (liste.dataset.mobGroupe === 'oui') return;

    var lis = [].slice.call(liste.children);
    var parPage = {};
    lis.forEach(function (li) {
      var lien = li.querySelector('.nav-item[href]');
      if (!lien) return;
      var href = lien.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;   // entrées d'action
      parPage[href.split('/').pop()] = li;
    });
    if (Object.keys(parPage).length < 6) return;     // menu déjà court : on laisse

    var places = {};
    FAMILLES.forEach(function (famille) {
      var dedans = famille.pages.filter(function (p) {
        var li = parPage[p];
        // Une entrée masquée PAR LE RÔLE ne compte pas dans sa famille : un
        // titre de section suivi de rien serait pire que pas de titre.
        return li && !(li.style.display === 'none' && !li.dataset.epingle);
      });
      if (!dedans.length) return;

      var separateur = document.createElement('li');
      separateur.className = 'ard-mob-famille';
      separateur.setAttribute('aria-hidden', 'true');
      separateur.textContent = famille.titre;
      liste.appendChild(separateur);

      dedans.forEach(function (p) {
        places[p] = true;
        liste.appendChild(parPage[p]);
      });
    });

    // Ce qui n'appartient à aucune famille reste à la fin, dans l'ordre.
    var orphelines = Object.keys(parPage).filter(function (p) { return !places[p]; });
    if (orphelines.length) {
      var autres = document.createElement('li');
      autres.className = 'ard-mob-famille';
      autres.setAttribute('aria-hidden', 'true');
      autres.textContent = 'Autres';
      liste.appendChild(autres);
      orphelines.forEach(function (p) { liste.appendChild(parPage[p]); });
    }

    // L'entrée « Aide & Tutoriels », posée par didacticiel.js, ferme la marche.
    var aide = document.getElementById('ard-di-nav');
    if (aide) liste.appendChild(aide);

    liste.dataset.mobGroupe = 'oui';
  }

  /* ------------------------------------------------------ Barre inférieure */

  function construireBarreBasse(nav) {
    if (document.querySelector('.ard-mob-pied')) return;
    var liste = nav.querySelector('.nav-liste');
    if (!liste) return;

    var courante = page();
    var candidats = [];
    var lis = liste.querySelectorAll('li');
    for (var i = 0; i < lis.length; i++) {
      var li = lis[i];
      if (li.classList.contains('ard-mob-famille')) continue;
      if (li.classList.contains('ard-mob-sans-objet')) continue;
      var lien = li.querySelector('.nav-item[href]');
      if (!lien) continue;
      var href = lien.getAttribute('href');
      if (!href || href.charAt(0) === '#') continue;
      // Masquée par le rôle : elle n'a rien à faire en bas d'écran non plus.
      if (li.style.display === 'none' && !li.dataset.epingle) continue;
      candidats.push({
        href: href,
        libelle: (lien.querySelector('.nav-libelle') || lien).textContent.trim(),
        icone: lien.querySelector('.nav-icone'),
        epingle: li.dataset.epingle === 'oui'
      });
    }
    if (candidats.length < 3) return;

    // Les écrans que l'utilisateur a épinglés d'abord : c'est SON choix, pas
    // une liste décidée ici. L'écran courant est toujours présent, sinon la
    // barre n'indiquerait jamais où l'on se trouve.
    var choisis = candidats.filter(function (c) { return c.epingle; });
    if (choisis.length < 4) {
      candidats.forEach(function (c) {
        if (choisis.length < 4 && choisis.indexOf(c) === -1) choisis.push(c);
      });
    }
    choisis = choisis.slice(0, 4);
    if (!choisis.some(function (c) { return c.href === courante; })) {
      var ici = candidats.filter(function (c) { return c.href === courante; })[0];
      if (ici) choisis[3] = ici;
    }

    pied = document.createElement('nav');
    pied.className = 'ard-mob-pied';
    pied.setAttribute('aria-label', 'Accès rapide');

    choisis.forEach(function (c) {
      var a = document.createElement('a');
      a.href = c.href;
      if (c.href === courante) {
        a.className = 'actif';
        a.setAttribute('aria-current', 'page');
      }
      var svg = c.icone
        ? c.icone.cloneNode(true)
        : svgDepuis(ICONE_MENU);
      svg.removeAttribute('class');
      svg.setAttribute('aria-hidden', 'true');
      a.appendChild(svg);
      var texte = document.createElement('span');
      texte.textContent = c.libelle;
      a.appendChild(texte);
      pied.appendChild(a);
    });

    // Le cinquième doigt : tout le reste du menu.
    var menu = document.createElement('a');
    menu.href = '#';
    menu.setAttribute('role', 'button');
    menu.appendChild(svgDepuis(ICONE_MENU));
    var lib = document.createElement('span');
    lib.textContent = 'Menu';
    menu.appendChild(lib);
    menu.addEventListener('click', function (e) { e.preventDefault(); basculer(true); });
    pied.appendChild(menu);

    document.body.appendChild(pied);
  }

  function svgDepuis(contenu) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = contenu;
    return svg;
  }

  /* ------------------------------------------------------------- Tableaux */

  /**
   * Enveloppe les tableaux laissés à nu.
   *
   * `ui.css` transforme les lignes en cartes, mais seulement à l'intérieur
   * d'un `.conteneur-tableau`. Un tableau oublié hors conteneur élargit la
   * page entière — c'est le cas de `confidentialite.html` et des aperçus.
   */
  function envelopperTableaux() {
    var tables = document.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      if (t.closest('.conteneur-tableau')) continue;
      if (t.closest('.page')) continue;          // feuille A4 : mise à l'échelle
      var boite = document.createElement('div');
      boite.className = 'conteneur-tableau';
      t.parentNode.insertBefore(boite, t);
      boite.appendChild(t);
    }
  }

  /* --------------------------------------------------- Pastille de messages */

  function suivrePastille() {
    if (!pastilleEl) return;
    function relire() {
      var source = document.querySelector('.badge-nav-messages');
      var n = source && source.textContent.trim();
      var visible = !!(n && n !== '0' && getComputedStyle(source).display !== 'none');
      pastilleEl.textContent = visible ? n : '';
      pastilleEl.classList.toggle('visible', visible);
      pastilleEl.setAttribute('aria-label', visible ? n + ' message(s) non lu(s)' : '');
    }
    relire();
    var obs = new MutationObserver(relire);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /* ==========================================================================
     3. DÉMARRAGE
     ========================================================================== */

  function demarrer() {
    // Les aperçus de bulletin n'ont pas de navigation : ils suivent un chemin
    // à part et s'arrêtent là.
    if (ajusterFeuille()) return;

    var nav = document.querySelector('.barre-laterale');
    if (!nav) return;

    try { construireBarreHaute(nav); } catch (e) { /* la page reste navigable */ }
    try { envelopperTableaux(); } catch (e) {}

    // Un lien du tiroir referme le tiroir. Par délégation : les entrées
    // ajoutées après coup (« Aide & Tutoriels ») en profitent aussi.
    nav.addEventListener('click', function (e) {
      if (e.target.closest('.nav-item, .nav-deconnexion')) basculer(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') basculer(false);
    });

    // Un geste de balayage vers la gauche referme le tiroir : c'est ce que le
    // pouce essaie de faire avant de chercher le bouton.
    var departX = null;
    nav.addEventListener('touchstart', function (e) {
      departX = e.touches[0].clientX;
    }, { passive: true });
    nav.addEventListener('touchend', function (e) {
      if (departX === null) return;
      var delta = e.changedTouches[0].clientX - departX;
      departX = null;
      if (delta < -60) basculer(false);
    }, { passive: true });

    // L'état du tiroir, quel qu'en soit l'auteur.
    new MutationObserver(synchroniser)
      .observe(nav, { attributes: true, attributeFilter: ['class'] });
    petitEcran.addEventListener('change', function () {
      if (!petitEcran.matches) basculer(false);
      else activerMobile(nav);
      synchroniser();
    });
    synchroniser();

    /* Le rail (`reduireRail`) et le badge de messages s'exécutent 60 ms après
       le chargement, une fois le filtrage par rôle des pages appliqué. On se
       place après eux : déployer le menu avant qu'il soit filtré afficherait
       des écrans interdits pendant une fraction de seconde. */
    setTimeout(function () {
      activerMobile(nav);
      try { suivrePastille(); } catch (e) {}
      if (titreEl) titreEl.textContent = titrePage();
    }, 260);
  }

  /**
   * Réorganisation réservée au téléphone.
   *
   * `deployerMenu()` déplace des éléments du DOM et insère des titres de
   * famille. Sur un grand écran, ces titres n'ont pas de style — ils
   * s'afficheraient comme des lignes de liste ordinaires au milieu du rail —
   * et l'ordre voulu par le rail serait perdu. La réorganisation n'a donc lieu
   * que sous 780 px, et seulement à ce moment-là : un utilisateur qui tourne
   * son téléphone ou réduit sa fenêtre la déclenche en arrivant. L'opération
   * est idempotente (`data-mob-groupe`), elle ne se rejoue jamais deux fois.
   */
  function activerMobile(nav) {
    if (!petitEcran.matches) return;
    try { deployerMenu(nav); } catch (e) { /* menu conservé tel quel */ }
    try { construireBarreBasse(nav); } catch (e) { /* la barre haute suffit */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();
