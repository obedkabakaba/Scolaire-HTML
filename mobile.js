/* =============================================================================
   ARDOISE — COQUE MOBILE (« application native »)
   =============================================================================

   CE QUE FAIT CE FICHIER
   ----------------------
   Il pose sur les écrans applicatifs les pièces qu'une application de
   téléphone possède et qu'un site converti n'a jamais :

     1. une barre de navigation sous la barre d'état (encoche et île
        dynamique comprises), qui reprend le nom de l'écran quand le grand
        titre passe dessous ;
     2. une barre d'onglets : capsule de verre flottante sur iOS, barre
        Material 3 sur Android ;
     3. le menu complet dans une feuille qui monte du bas — avec profil,
        recherche, écrans groupés — et qu'on referme d'un geste vers le bas ;
     4. des listes à la place des tableaux, et une feuille d'actions à la
        place des rangées de liens « Modifier · Historique · Supprimer ».

   POURQUOI EN JAVASCRIPT ET NON DANS LES PAGES
   --------------------------------------------
   Trente-sept pages : trente-sept occasions d'oublier. Une page ajoutée
   demain reçoit sa coque sans qu'on y touche.

   CE QU'IL NE FAIT PAS
   --------------------
   Il ne remplace aucun comportement existant. La feuille de menu EST la
   `.barre-laterale` de la page, mise en forme autrement : le filtrage par
   rôle, « Aide & Tutoriels », le bouton de déconnexion et leurs écouteurs
   restent ceux d'origine. Les tableaux ne sont pas reconstruits : leurs
   cellules reçoivent des classes, et les scripts des pages les retrouvent à
   l'identique. Si ce fichier ne se charge pas, la plateforme fonctionne
   exactement comme avant.
   ============================================================================= */

(function () {
  'use strict';

  var SEUIL = 780;
  var petitEcran = window.matchMedia('(max-width: ' + SEUIL + 'px)');
  var ecranListes = window.matchMedia('(max-width: 700px)');
  var racine = document.documentElement;

  /* Familles du menu — reprises de `ui.js` pour que la feuille et le lanceur
     racontent la même organisation. Chaque famille a sa couleur, comme les
     rubriques des réglages d'un téléphone. Une page absente de cette table
     reste accessible : elle tombe dans « Autres ». */
  var FAMILLES = [
    { titre: 'Accueil', teinte: '#007AFF', pages: ['dashboard-directeur.html', 'espace-secretaire.html',
        'espace-professeur.html', 'espace-titulaire.html'] },
    { titre: 'Élèves et parcours', teinte: '#34C759', pages: ['eleves.html', 'inscriptions.html',
        'orientation.html', 'presences.html'] },
    { titre: 'Pédagogie', teinte: '#FF9500', pages: ['classes.html', 'cours.html', 'emploi-du-temps.html',
        'notes.html', 'cours-classe-titulaire.html'] },
    { titre: 'Bulletins', teinte: '#AF52DE', pages: ['bulletins.html', 'bulletin-annuel.html',
        'generateur-modeles.html', 'repechage.html'] },
    { titre: 'Vie scolaire', teinte: '#FF2D55', pages: ['discipline.html', 'calendrier.html', 'messages.html'] },
    { titre: 'Finances', teinte: '#30B0C7', pages: ['frais-scolaires.html', 'comptabilite.html'] },
    { titre: 'Pilotage', teinte: '#5856D6', pages: ['rapports.html', 'archives.html', 'journal.html'] },
    { titre: 'Administration', teinte: '#8E8E93', pages: ['annee-scolaire.html', 'utilisateurs.html',
        'site-public.html', 'parametres.html', 'mon-profil.html'] }
  ];
  var TEINTE_AUTRES = '#A2845E';
  var TEINTE_AIDE = '#32ADE6';

  /* Les onglets ont la place d'un mot. */
  var LIBELLES_COURTS = {
    'dashboard-directeur.html': 'Accueil', 'espace-secretaire.html': 'Accueil',
    'espace-professeur.html': 'Mes cours', 'espace-titulaire.html': 'Ma classe',
    'emploi-du-temps.html': 'Horaire', 'frais-scolaires.html': 'Frais',
    'journal.html': 'Journal', 'generateur-modeles.html': 'Modèles',
    'cours-classe-titulaire.html': 'Cours', 'bulletin-annuel.html': 'Annuel',
    'annee-scolaire.html': 'Année', 'comptabilite.html': 'Compta',
    'site-public.html': 'Site', 'mon-profil.html': 'Profil'
  };
  /* Si l'utilisateur n'a rien épinglé : les écrans du quotidien d'abord. */
  var PRIORITE_ONGLETS = ['eleves.html', 'presences.html', 'notes.html', 'bulletins.html',
    'frais-scolaires.html', 'emploi-du-temps.html', 'messages.html', 'classes.html',
    'inscriptions.html', 'cours.html', 'calendrier.html', 'rapports.html'];

  var LIBELLES_ROLES = {
    directeur: 'Direction', prefet: 'Préfet des études', secretaire: 'Secrétariat',
    professeur: 'Professeur', titulaire: 'Titulaire', comptable: 'Comptabilité',
    econome: 'Économat', super_admin: 'Super admin', surveillant: 'Discipline'
  };

  var SVG = {
    menu: '<circle cx="5" cy="6" r="1.4"/><circle cx="5" cy="12" r="1.4"/>'
      + '<circle cx="5" cy="18" r="1.4"/><path d="M10 6h10"/><path d="M10 12h10"/><path d="M10 18h10"/>',
    retour: '<path d="M15 4.5 7.5 12l7.5 7.5"/>',
    personne: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 19.5c1.2-3.4 4-5.2 7-5.2s5.8 1.8 7 5.2"/>',
    cloche: '<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
    fermer: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
    loupe: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'
  };

  function page(chemin) {
    return (chemin || window.location.pathname).split('?')[0].split('#')[0].split('/').pop() || '';
  }

  function svg(contenu, classe) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    if (classe) s.setAttribute('class', classe);
    s.innerHTML = contenu;
    return s;
  }

  function el(balise, classe, texte) {
    var n = document.createElement(balise);
    if (classe) n.className = classe;
    if (texte) n.textContent = texte;
    return n;
  }

  function sansAccents(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function utilisateur() {
    try {
      return JSON.parse(sessionStorage.getItem('ardoise_user') || localStorage.getItem('ardoise_user') || 'null') || {};
    } catch (e) { return {}; }
  }

  /* Une entrée masquée PAR LE RÔLE porte `display: none` sans `data-epingle`
     (cet attribut n'est posé que par le rail, sur les entrées autorisées). */
  function masqueeParRole(li) {
    return li.style.display === 'none' && !li.dataset.epingle;
  }

  /* ==========================================================================
     0. PLATEFORME ET ZONES SÛRES
     ========================================================================== */
  function detecterPlateforme() {
    var ua = navigator.userAgent || '';
    var ios = /iP(hone|od|ad)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var android = /Android/i.test(ua);
    racine.classList.toggle('ard-ios', ios);
    racine.classList.toggle('ard-android', android && !ios);
    var autonome = window.navigator.standalone === true
      || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    racine.classList.toggle('ard-autonome', !!autonome);
    // Réfraction SVG dans `backdrop-filter` : Chromium seulement. WebKit (tous
    // les navigateurs d'iOS) et Firefox l'ignoreraient — ou effaceraient le
    // verre entier — : ils gardent le verre en calques.
    refraction = !ios && /Chrome\/|Chromium|Edg\//.test(ua) && !/Firefox/.test(ua)
      && !!(window.CSS && CSS.supports('backdrop-filter', 'blur(1px)'));
    racine.classList.toggle('ard-refraction', refraction);
  }

  /* Sans `viewport-fit=cover`, iOS déclare des zones sûres nulles : la barre
     du haut passait sous l'heure et l'île dynamique, celle du bas sur
     l'indicateur d'accueil. Les pages l'écrivent désormais dans leur balise
     (installer-mobile.py) ; ce filet couvre celles qui seraient ajoutées. */
  function couvrirEncoche() {
    var meta = document.querySelector('meta[name="viewport"]');
    if (meta && !/viewport-fit/.test(meta.content)) {
      meta.setAttribute('content', meta.content + ', viewport-fit=cover');
    }
  }

  /* ==========================================================================
     1. APERÇUS DE BULLETIN
     Pages en millimètres, sans navigation : mises à l'échelle de l'écran.
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
        /* `scrollWidth` : certaines cases débordent volontairement du cadre ;
           se fier au seul cadre coupait la colonne de droite du bulletin. */
        var naturelle = Math.max(f.offsetWidth, f.scrollWidth);
        if (!naturelle) continue;
        var echelle = Math.min(1, dispo / naturelle);
        document.body.style.setProperty('--mob-echelle', String(echelle));
        // Une transformation ne libère pas la place réservée dans le flux.
        f.style.marginBottom = -(f.offsetHeight * (1 - echelle)) + 'px';
      }
    }

    recalculer();
    window.addEventListener('resize', recalculer);
    window.addEventListener('orientationchange', recalculer);
    return true;
  }

  /* ==========================================================================
     2. TEINTES
     La barre d'état d'iOS (mode « black-translucent » des pages) écrit en
     blanc : la barre du haut doit donc être sombre, quelle que soit
     l'apparence. On prend la teinte sombre de l'apparence — son rail si
     celui-ci est sombre, sinon son encre — pour que la barre lui appartienne.
     ========================================================================== */
  /* Normalise une couleur CSS par un contexte 2D hors document : insérer une
     sonde dans la page et lire son style forçait un recalcul complet des
     styles à chaque couleur — quatre fois par changement d'apparence. */
  var toileCouleur = null;
  function lireRgb(valeur) {
    if (!valeur) return null;
    if (!toileCouleur) toileCouleur = document.createElement('canvas').getContext('2d');
    if (!toileCouleur) return null;
    toileCouleur.fillStyle = '#000';
    toileCouleur.fillStyle = valeur;
    var calcule = toileCouleur.fillStyle;
    var hex = /^#([0-9a-f]{6})$/i.exec(calcule);
    if (hex) {
      var n = parseInt(hex[1], 16);
      // Une valeur illisible laisse le noir posé juste avant : on l'écarte.
      if (n === 0 && !/^\s*(#0{3,6}|black|rgba?\(\s*0[ ,]+0[ ,]+0)/i.test(valeur)) return null;
      return [n >> 16, (n >> 8) & 255, n & 255];
    }
    var m = calcule.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?/);
    if (!m) return null;
    if (m[4] !== undefined && parseFloat(m[4]) < 0.5) return null;   // transparent
    return [+m[1], +m[2], +m[3]];
  }

  function luminance(rgb) {
    var c = rgb.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function definitionTheme(cle) {
    var liste = window.ARDOISE_THEMES || [];
    for (var i = 0; i < liste.length; i++) if (liste[i].cle === cle) return liste[i];
    return null;
  }

  /**
   * Les teintes sont tirées de la FICHE de l'apparence (`ARDOISE_THEMES`,
   * theme.js) : ses couleurs de barre, d'encre et de surface. Les relire dans
   * les styles calculés juste après un changement d'apparence forçait le
   * navigateur à recalculer toute la page une fois de plus. Les styles ne
   * servent plus que de repli, pour une apparence sans fiche.
   */
  function appliquerTeintes(cleTheme) {
    var def = definitionTheme(cleTheme || racine.getAttribute('data-theme'));
    var ap = def && def.apercu;
    var choisi = null, fond = null, cs = null;
    // 0,18 de luminance : le blanc y garde un contraste supérieur à 4,5:1.
    var valeurs = ap ? [ap.barre, ap.texte] : [];
    if (ap) fond = lireRgb(ap.surface);
    if (!ap || !fond) {
      cs = getComputedStyle(racine);
      valeurs = ['--nav-fond', '--texte-sombre', '--ardoise'].map(function (v) { return cs.getPropertyValue(v).trim(); });
      fond = lireRgb(cs.getPropertyValue('--craie').trim());
    }
    for (var i = 0; i < valeurs.length && !choisi; i++) {
      var rgb = lireRgb(valeurs[i]);
      if (rgb && luminance(rgb) < 0.18) choisi = rgb;
    }
    var teinte = 'rgb(' + (choisi || [28, 28, 30]).join(',') + ')';
    racine.style.setProperty('--ard-entete', teinte);

    // Android et les navigateurs colorent la barre d'état d'après cette balise.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', teinte);

    racine.classList.toggle('ard-mob-sombre', !!fond && luminance(fond) < 0.25);
  }

  /* ==========================================================================
     3. LA BARRE DU HAUT
     ========================================================================== */
  var barre = null, titreEl = null, pastilleEl = null, retourEl = null, clocheEl = null;

  /* La session ne garde que l'identifiant et les rôles : sans le nom, l'avatar
     affichait un « ? » que l'on prenait pour le bouton d'aide. Le profil est
     donc demandé une fois à `/utilisateurs/moi` et gardé par compte. */
  var CLE_PROFIL = 'ardoise_profil_mobile';

  function profilEnCache(id) {
    try {
      var p = JSON.parse(localStorage.getItem(CLE_PROFIL) || 'null');
      return (p && p.id === id) ? p : null;
    } catch (e) { return null; }
  }

  function utilisateurComplet() {
    var u = utilisateur();
    var p = u.id ? profilEnCache(u.id) : null;
    if (!p) return u;
    var fusion = {};
    for (var k in u) fusion[k] = u[k];
    ['prenom', 'nom', 'email', 'photo_url'].forEach(function (c) { if (p[c]) fusion[c] = p[c]; });
    return fusion;
  }

  function initiales(u) {
    var p = (u.prenom || '').trim(), n = (u.nom || '').trim();
    return ((p.charAt(0) + n.charAt(0)) || (u.email || '').charAt(0)).toUpperCase();
  }

  function remplirAvatar(a, u) {
    a.textContent = '';
    var lettres = initiales(u);
    function repli() {
      a.textContent = '';
      if (lettres) a.textContent = lettres;
      else a.appendChild(svg(SVG.personne));
    }
    if (u.photo_url) {
      var img = document.createElement('img');
      img.alt = '';
      img.src = u.photo_url;
      img.onerror = repli;
      a.appendChild(img);
    } else {
      repli();
    }
  }

  function avatar(u) {
    var a = el('span', 'ard-mob-avatar');
    remplirAvatar(a, u);
    return a;
  }

  function chargerProfil() {
    var u = utilisateur();
    if (!u.id || !window.ArdoiseSession || !window.ArdoiseSession.appelApi) return;
    window.ArdoiseSession.appelApi('/utilisateurs/moi').then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (d) {
      var m = d && (d.utilisateur || d.user || d.data || d);
      if (!m || (m.id && m.id !== u.id)) return;
      var p = { id: u.id, prenom: m.prenom || '', nom: m.nom || '', email: m.email || '', photo_url: m.photo_url || '' };
      var avant = profilEnCache(u.id);
      try { localStorage.setItem(CLE_PROFIL, JSON.stringify(p)); } catch (e) {}
      if (avant && JSON.stringify(avant) === JSON.stringify(p)) return;
      var complet = utilisateurComplet();
      document.querySelectorAll('.ard-mob-avatar').forEach(function (a) { remplirAvatar(a, complet); });
      var nom = profilEl && profilEl.querySelector('.ard-feuille-profil-texte strong');
      if (nom) nom.textContent = [complet.prenom, complet.nom].filter(Boolean).join(' ') || complet.email || 'Mon compte';
    }).catch(function () { /* l'avatar garde son repli */ });
  }

  function construireBarreHaute(nav) {
    barre = el('header', 'ard-mob-barre');

    var gauche = el('div', 'ard-mob-gauche');
    retourEl = el('button', 'ard-mob-icone ard-mob-retour');
    retourEl.type = 'button';
    retourEl.hidden = true;
    retourEl.setAttribute('aria-label', 'Retour');
    retourEl.appendChild(svg(SVG.retour));
    retourEl.appendChild(el('span', '', 'Retour'));
    retourEl.addEventListener('click', function () { window.history.back(); });
    gauche.appendChild(retourEl);

    var centre = el('div', 'ard-mob-centre');
    var marque = el('span', 'ard-mob-marque');
    var source = nav.querySelector('.marque');
    if (source) marque.innerHTML = source.innerHTML; else marque.textContent = 'Ardoise';
    titreEl = el('span', 'ard-mob-titre', titrePage());
    centre.appendChild(marque);
    centre.appendChild(titreEl);

    var droite = el('div', 'ard-mob-droite');
    clocheEl = el('a', 'ard-mob-icone ard-mob-cloche');
    clocheEl.href = 'messages.html';
    clocheEl.hidden = true;
    clocheEl.setAttribute('aria-label', 'Messages');
    clocheEl.appendChild(svg(SVG.cloche));
    pastilleEl = el('span', 'ard-mob-pastille');
    clocheEl.appendChild(pastilleEl);

    /* L'avatar ouvre la feuille de menu. Il garde la classe historique
       `ard-mob-bouton` : c'est par elle que les tests d'apparence ouvrent le
       menu sur téléphone. */
    var compte = el('button', 'ard-mob-icone ard-mob-bouton');
    compte.type = 'button';
    compte.setAttribute('aria-label', 'Ouvrir le menu');
    compte.setAttribute('aria-expanded', 'false');
    compte.setAttribute('aria-controls', nav.id || 'ard-mob-tiroir');
    compte.appendChild(avatar(utilisateurComplet()));
    compte.addEventListener('click', function () { basculer(); });

    droite.appendChild(clocheEl);
    droite.appendChild(compte);

    barre.appendChild(gauche);
    barre.appendChild(centre);
    barre.appendChild(droite);
    document.body.insertBefore(barre, document.body.firstChild);

    /* Drapeau lu par `mobile.css` : lui seul autorise la feuille à réserver
       la place des barres. Les pages sans barre latérale (site public)
       n'arrivent jamais ici et gardent leur mise en page intacte. */
    racine.classList.add('ard-mob-coque');
  }

  /**
   * Le nom de l'écran : le `<h1>` (le mot que l'utilisateur vient de lire
   * dans le menu), sinon le `<title>` sans le préfixe « Ardoise — ».
   */
  function titrePage() {
    var h1 = document.querySelector('.entete-page h1, .contenu h1');
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();
    return (document.title || 'Ardoise').replace(/^Ardoise\s*[—–-]\s*/, '');
  }

  /**
   * Le grand titre remonte dans la barre quand il passe dessous.
   *
   * Un `IntersectionObserver` le signale sans rien mesurer. Lire la position
   * du titre à chaque défilement forçait un recalcul complet de la page — et,
   * juste après un changement d'apparence, le plus coûteux de tous.
   */
  function suivreDefilement() {
    var h1 = null, observateur = null;

    function brancherTitre() {
      var nouveau = document.querySelector('.entete-page h1, .contenu h1');
      if (nouveau === h1 && observateur) return;
      if (observateur) observateur.disconnect();
      observateur = null;
      h1 = nouveau;
      if (!h1 || !window.IntersectionObserver) return;
      var hauteurBarre = barre ? barre.offsetHeight : 0;
      observateur = new IntersectionObserver(function (entrees) {
        var e = entrees[entrees.length - 1];
        racine.classList.toggle('ard-titre-replie', !e.isIntersecting && e.boundingClientRect.top < hauteurBarre);
      }, { rootMargin: '-' + hauteurBarre + 'px 0px 0px 0px', threshold: 0 });
      observateur.observe(h1);
    }

    /* « La page a-t-elle défilé ? » : deux repères invisibles en haut du
       document (3 px et 40 px), observés eux aussi. Lire `scrollY` à chaque
       défilement obligeait le navigateur à finir sa mise en page sur-le-champ. */
    var defile = false, au40 = false;
    function majDefilement() {
      racine.classList.toggle('ard-defile', defile);
      // Écran sans grand titre : la barre prend le nom de l'écran au défilement.
      if (!h1) racine.classList.toggle('ard-titre-replie', au40);
    }
    function repere(hauteur, rappel) {
      var r = document.createElement('div');
      r.setAttribute('aria-hidden', 'true');
      r.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:' + hauteur + 'px;pointer-events:none;visibility:hidden';
      document.body.appendChild(r);
      new IntersectionObserver(function (entrees) {
        rappel(!entrees[entrees.length - 1].isIntersecting);
        majDefilement();
      }).observe(r);
    }
    if (window.IntersectionObserver) {
      repere(3, function (v) { defile = v; });
      repere(40, function (v) { au40 = v; });
    }
    window.addEventListener('orientationchange', function () { observateur = null; setTimeout(brancherTitre, 300); });

    brancherTitre();
    return function () { brancherTitre(); majDefilement(); };
  }

  /* ==========================================================================
     4. LA FEUILLE DE MENU
     ========================================================================== */
  var rechercheEl = null, videEl = null, profilEl = null;

  function estOuvert(nav) { return nav.classList.contains('nav-ouverte'); }

  function basculer(forcer) {
    var nav = document.querySelector('.barre-laterale');
    if (!nav) return;
    var ouvrir = forcer !== undefined ? forcer : !estOuvert(nav);
    if (ouvrir && !estOuvert(nav)) {
      nav.scrollTop = 0;
      if (rechercheEl && rechercheEl.value) { rechercheEl.value = ''; filtrer(nav, ''); }
    }
    nav.style.removeProperty('--ard-tire');
    nav.classList.toggle('nav-ouverte', ouvrir);
    synchroniser();
  }

  /**
   * Aligne la coque sur l'état réel du menu. Un observateur plutôt qu'un
   * gestionnaire de clic : `ui.js` bascule la même classe de son côté (touche
   * Échap, clic sur un lien, retour en grand écran).
   */
  function synchroniser() {
    var nav = document.querySelector('.barre-laterale');
    if (!nav) return;
    var ouvert = estOuvert(nav) && petitEcran.matches;
    racine.classList.toggle('ard-mob-ouvert', ouvert);
    if (barre) {
      var b = barre.querySelector('.ard-mob-bouton');
      b.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      b.setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu');
    }
    nav.setAttribute('aria-hidden', (!ouvert && petitEcran.matches) ? 'true' : 'false');
    if (petitEcran.matches) {
      nav.setAttribute('role', 'dialog');
      nav.setAttribute('aria-modal', ouvert ? 'true' : 'false');
      nav.setAttribute('aria-label', 'Menu');
    }
  }

  function construireFeuille(nav) {
    nav.id = nav.id || 'ard-mob-tiroir';

    var voile = el('div', 'ard-mob-voile');
    voile.addEventListener('click', function () { basculer(false); });
    document.body.appendChild(voile);

    var entete = el('div', 'ard-feuille-entete');
    entete.appendChild(el('span', 'ard-feuille-poignee'));
    var titre = el('h2', 'ard-feuille-titre', 'Menu');
    entete.appendChild(titre);
    var fermer = el('button', 'ard-mob-fermer');
    fermer.type = 'button';
    fermer.setAttribute('aria-label', 'Fermer le menu');
    fermer.appendChild(svg(SVG.fermer));
    fermer.addEventListener('click', function () { basculer(false); });
    entete.appendChild(fermer);

    var recherche = el('label', 'ard-feuille-recherche');
    recherche.appendChild(svg(SVG.loupe));
    rechercheEl = document.createElement('input');
    rechercheEl.type = 'search';
    rechercheEl.placeholder = 'Rechercher un écran';
    rechercheEl.setAttribute('aria-label', 'Rechercher un écran');
    rechercheEl.setAttribute('autocomplete', 'off');
    rechercheEl.setAttribute('enterkeyhint', 'go');
    rechercheEl.addEventListener('input', function () { filtrer(nav, rechercheEl.value); });
    rechercheEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      // Entrée ouvre le premier écran trouvé.
      var premier = [].filter.call(nav.querySelectorAll('.nav-liste > li:not(.ard-mob-famille)'),
        function (li) { return getComputedStyle(li).display !== 'none'; })[0];
      var lien = premier && premier.querySelector('.nav-item');
      if (lien) lien.click();
    });
    recherche.appendChild(rechercheEl);

    videEl = el('p', 'ard-feuille-vide', 'Aucun écran ne correspond.');
    videEl.hidden = true;

    nav.insertBefore(recherche, nav.firstChild);
    nav.insertBefore(entete, nav.firstChild);
    var bloc = nav.querySelector(':scope > div:not(.ard-feuille-entete)');
    if (bloc) bloc.appendChild(videEl);

    installerGesteFeuille(nav, entete);
  }

  /* Le geste du pouce : tirer la feuille vers le bas la referme. */
  function installerGesteFeuille(nav, entete) {
    var y0 = null, dy = 0, t0 = 0, tire = false, depuisEntete = false;

    nav.addEventListener('touchstart', function (e) {
      if (!estOuvert(nav) || e.touches.length !== 1) { y0 = null; return; }
      depuisEntete = !!e.target.closest('.ard-feuille-entete');
      if (!depuisEntete && nav.scrollTop > 0) { y0 = null; return; }
      if (e.target.closest('input')) { y0 = null; return; }
      y0 = e.touches[0].clientY; t0 = Date.now(); dy = 0; tire = false;
    }, { passive: true });

    nav.addEventListener('touchmove', function (e) {
      if (y0 === null) return;
      dy = e.touches[0].clientY - y0;
      if (!tire) {
        if (dy > 6 && (depuisEntete || nav.scrollTop <= 0)) {
          tire = true;
          nav.classList.add('ard-tire-en-cours');
        } else if (dy < -4) { y0 = null; return; } else { return; }
      }
      if (e.cancelable) e.preventDefault();
      // Au-delà du bord, la feuille résiste un peu, comme un ressort.
      nav.style.setProperty('--ard-tire', Math.max(0, dy) + 'px');
    }, { passive: false });

    function relacher() {
      if (y0 === null) return;
      y0 = null;
      if (!tire) return;
      tire = false;
      nav.classList.remove('ard-tire-en-cours');
      var vitesse = dy / Math.max(1, Date.now() - t0);
      if (dy > 110 || vitesse > 0.55) basculer(false);
      else nav.style.removeProperty('--ard-tire');
    }
    nav.addEventListener('touchend', relacher, { passive: true });
    nav.addEventListener('touchcancel', relacher, { passive: true });
  }

  /* Recherche d'un écran par son nom, sans tenir compte des accents. */
  function filtrer(nav, requete) {
    var liste = nav.querySelector('.nav-liste');
    if (!liste) return;
    var q = sansAccents(requete);
    var enfants = [].slice.call(liste.children);
    var trouves = 0;
    enfants.forEach(function (li) {
      if (li.classList.contains('ard-mob-famille')) return;
      var correspond = !q || sansAccents(li.textContent).indexOf(q) !== -1;
      li.classList.toggle('ard-cache-recherche', !correspond);
      if (correspond && getComputedStyle(li).display !== 'none') trouves++;
    });
    // Un titre de famille suivi de rien est masqué.
    var titre = null, contenu = 0;
    function clore() { if (titre) titre.classList.toggle('ard-cache-recherche', contenu === 0); }
    enfants.forEach(function (li) {
      if (li.classList.contains('ard-mob-famille')) { clore(); titre = li; contenu = 0; return; }
      if (getComputedStyle(li).display !== 'none') contenu++;
    });
    clore();
    if (videEl) videEl.hidden = trouves > 0;
    var sortie = nav.querySelector('.nav-deconnexion');
    if (sortie) sortie.style.display = q ? 'none' : '';
    if (profilEl) profilEl.style.display = q ? 'none' : '';
    calculerGroupes(liste);
  }

  /**
   * Rend au menu les entrées repliées par le rail et les regroupe par
   * famille. On ne touche qu'aux entrées portant `data-epingle` : les
   * entrées écartées par le RÔLE n'en ont pas et restent masquées — un
   * professeur ne doit pas voir la comptabilité parce qu'il a tourné son
   * téléphone.
   */
  function deployerMenu(nav) {
    var liste = nav.querySelector('.nav-liste');
    if (!liste) return;

    // « Tous les menus » perd son objet une fois la liste complète affichée.
    var tiroir = liste.querySelector('.nav-tiroir');
    if (tiroir && tiroir.parentNode) tiroir.parentNode.classList.add('ard-mob-sans-objet');

    if (liste.dataset.mobGroupe === 'oui') return;

    var parPage = {};
    [].slice.call(liste.children).forEach(function (li) {
      var lien = li.querySelector('.nav-item[href]');
      if (!lien) return;
      var href = lien.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;   // entrées d'action
      parPage[page(href)] = li;
    });

    var places = {};
    FAMILLES.forEach(function (famille) {
      var dedans = famille.pages.filter(function (p) {
        // Une entrée masquée par le rôle ne compte pas dans sa famille : un
        // titre de section suivi de rien serait pire que pas de titre.
        return parPage[p] && !masqueeParRole(parPage[p]);
      });
      if (!dedans.length) return;

      var separateur = el('li', 'ard-mob-famille', famille.titre);
      separateur.setAttribute('aria-hidden', 'true');
      liste.appendChild(separateur);

      dedans.forEach(function (p) {
        places[p] = true;
        parPage[p].style.setProperty('--ard-teinte', famille.teinte);
        liste.appendChild(parPage[p]);
      });
    });

    var orphelines = Object.keys(parPage).filter(function (p) {
      return !places[p] && !masqueeParRole(parPage[p]);
    });
    if (orphelines.length) {
      var autres = el('li', 'ard-mob-famille', 'Autres');
      autres.setAttribute('aria-hidden', 'true');
      liste.appendChild(autres);
      orphelines.forEach(function (p) {
        parPage[p].style.setProperty('--ard-teinte', TEINTE_AUTRES);
        liste.appendChild(parPage[p]);
      });
    }

    // « Aide & Tutoriels » (didacticiel.js) ferme la marche, à part.
    var aide = document.getElementById('ard-di-nav');
    if (aide) {
      aide.style.setProperty('--ard-teinte', TEINTE_AIDE);
      liste.appendChild(aide);
    }

    liste.dataset.mobGroupe = 'oui';
  }

  /* Coins arrondis du premier et du dernier élément VISIBLE de chaque
     groupe : un sélecteur CSS d'adjacence se tromperait dès qu'une entrée
     est masquée par le rôle ou par la recherche. */
  function calculerGroupes(liste) {
    if (!liste) return;
    var groupe = [];
    function clore() {
      groupe.forEach(function (li, i) {
        li.classList.toggle('ard-premier', i === 0);
        li.classList.toggle('ard-dernier', i === groupe.length - 1);
      });
      groupe = [];
    }
    [].slice.call(liste.children).forEach(function (li) {
      li.classList.remove('ard-premier', 'ard-dernier', 'ard-seul');
      if (li.classList.contains('ard-mob-famille')) { clore(); return; }
      if (getComputedStyle(li).display === 'none') return;
      if (li.id === 'ard-di-nav') {
        clore();
        li.classList.add('ard-seul');
        groupe = [li];
        clore();
        return;
      }
      groupe.push(li);
    });
    clore();
  }

  function construireProfil(nav) {
    if (profilEl || !nav) return;
    var u = utilisateurComplet();
    var lienProfil = nav.querySelector('.nav-item[href$="mon-profil.html"]');
    var liProfil = lienProfil && lienProfil.closest('li');
    var accessible = liProfil && !masqueeParRole(liProfil);

    profilEl = el(accessible ? 'a' : 'div', 'ard-feuille-profil');
    if (accessible) profilEl.href = 'mon-profil.html';
    profilEl.appendChild(avatar(u));
    var texte = el('span', 'ard-feuille-profil-texte');
    var nom = [u.prenom, u.nom].filter(Boolean).join(' ') || u.email || 'Mon compte';
    texte.appendChild(el('strong', '', nom));
    var roles = (u.roles || []).map(function (r) {
      return LIBELLES_ROLES[r] || (r.charAt(0).toUpperCase() + r.slice(1)).replace(/_/g, ' ');
    }).join(' · ');
    texte.appendChild(el('span', '', accessible ? (roles ? roles + ' · Mon profil' : 'Mon profil') : roles));
    profilEl.appendChild(texte);

    var recherche = nav.querySelector('.ard-feuille-recherche');
    nav.insertBefore(profilEl, recherche || nav.firstChild);

    // « Mon profil » ne figure pas deux fois dans la feuille.
    if (accessible) liProfil.classList.add('ard-mob-doublon');
  }

  /* ==========================================================================
     5. LA BARRE D'ONGLETS
     ========================================================================== */
  var onglets = null, capsule = null, lentille = null, pagesOnglets = [];

  function candidatsOnglets(nav) {
    var liste = nav.querySelector('.nav-liste');
    if (!liste) return [];
    var vus = {}, candidats = [];
    [].forEach.call(liste.querySelectorAll('li'), function (li) {
      if (li.classList.contains('ard-mob-famille') || li.classList.contains('ard-mob-sans-objet')) return;
      var lien = li.querySelector('.nav-item[href]');
      if (!lien) return;
      var href = lien.getAttribute('href');
      if (!href || href.charAt(0) === '#' || masqueeParRole(li)) return;
      var p = page(href);
      if (vus[p]) return;
      vus[p] = true;
      candidats.push({
        page: p,
        href: href,
        libelle: LIBELLES_COURTS[p] || (lien.querySelector('.nav-libelle') || lien).textContent.trim(),
        icone: lien.querySelector('.nav-icone'),
        epingle: li.dataset.epingle === 'oui'
      });
    });
    return candidats;
  }

  /* Quatre onglets STABLES : l'accueil, puis les écrans épinglés par
     l'utilisateur, puis ceux du quotidien. L'écran courant ne vient pas
     remplacer un onglet (les onglets ne doivent jamais changer de place) :
     atteint par le menu, c'est le bouton de menu qui s'allume. */
  function choisirOnglets(candidats) {
    var choisis = [];
    function ajouter(c) { if (c && choisis.length < 4 && choisis.indexOf(c) === -1) choisis.push(c); }
    var accueil = candidats.filter(function (c) { return FAMILLES[0].pages.indexOf(c.page) !== -1; })[0];
    ajouter(accueil);
    candidats.filter(function (c) { return c.epingle; }).forEach(ajouter);
    PRIORITE_ONGLETS.forEach(function (p) {
      ajouter(candidats.filter(function (c) { return c.page === p; })[0]);
    });
    candidats.forEach(ajouter);
    return choisis;
  }

  function construireOnglets(nav) {
    if (onglets) return;
    var candidats = candidatsOnglets(nav);
    if (candidats.length < 2) return;
    var choisis = choisirOnglets(candidats);
    var courante = page();
    pagesOnglets = choisis.map(function (c) { return c.page; });

    onglets = el('nav', 'ard-onglets');
    onglets.setAttribute('aria-label', 'Navigation principale');
    capsule = el('div', 'ard-onglets-capsule');
    poserCouchesVerre(capsule);
    lentille = el('span', 'ard-onglets-lentille');
    lentille.setAttribute('aria-hidden', 'true');
    capsule.appendChild(lentille);

    choisis.forEach(function (c) {
      var a = el('a', 'ard-onglet');
      a.href = c.href;
      // Un lien se glisse-dépose nativement : le geste de la lentille serait
      // annulé (`pointercancel`) dès que le doigt ou la souris se déplace.
      a.draggable = false;
      if (c.page === courante) {
        a.classList.add('actif');
        a.setAttribute('aria-current', 'page');
      }
      var icone = c.icone ? c.icone.cloneNode(true) : svg(SVG.menu);
      icone.removeAttribute('class');
      icone.setAttribute('aria-hidden', 'true');
      a.appendChild(icone);
      a.appendChild(el('span', '', c.libelle));
      capsule.appendChild(a);
    });
    // Barre réduite : l'onglet courant reste, sinon l'accueil.
    (capsule.querySelector('.ard-onglet.actif') || capsule.querySelector('.ard-onglet')).classList.add('ard-garde');

    var menu = el('button', 'ard-onglets-menu ard-mob-menu');
    menu.type = 'button';
    menu.setAttribute('aria-label', 'Tous les écrans');
    poserCouchesVerre(menu);
    menu.appendChild(svg(SVG.menu));
    menu.appendChild(el('span', '', 'Menu'));
    if (pagesOnglets.indexOf(courante) === -1) menu.classList.add('actif');
    menu.addEventListener('click', function () { basculer(true); });

    onglets.appendChild(capsule);
    onglets.appendChild(menu);
    document.body.appendChild(onglets);

    installerGlisserOnglets();
    installerBarreReduite();
    suivreTailleVerre([capsule, menu]);

    requestAnimationFrame(function () {
      placerLentille(capsule.querySelector('.ard-onglet.actif'), true);
    });
  }

  function placerLentille(cible, sansAnimation) {
    if (!lentille || !capsule) return;
    if (!cible) { lentille.classList.remove('posee'); return; }
    if (sansAnimation) lentille.style.transition = 'none';
    lentille.style.setProperty('--ard-lentille-x', cible.offsetLeft + 'px');
    lentille.style.setProperty('--ard-lentille-l', cible.offsetWidth + 'px');
    lentille.style.removeProperty('--ard-etire');
    lentille.classList.add('posee');
    if (sansAnimation) {
      void lentille.offsetWidth;
      lentille.style.transition = '';
    }
  }

  function ongletsListe() { return [].slice.call(capsule.querySelectorAll('.ard-onglet')); }

  function ongletSous(x) {
    var trouve = null;
    ongletsListe().forEach(function (o) {
      var r = o.getBoundingClientRect();
      if (x >= r.left && x <= r.right) trouve = o;
    });
    return trouve;
  }

  /**
   * Le geste d'iOS 26 : on pose le doigt, la lentille enfle et devient une
   * goutte de verre ; on la fait glisser d'un onglet à l'autre (elle s'étire
   * avec la vitesse) ; on relâche, elle se pose et l'écran s'ouvre.
   *
   * Pointeur capturé : le `click` des liens n'arrive plus — la navigation
   * est donc faite ici, au relâcher. Au clavier, les liens restent des liens.
   */
  function installerGlisserOnglets() {
    var actif = false, depart = 0, bouge = false, dernierX = 0, dernierT = 0, pointeur = null;
    var ignorerClic = false;

    function suivre(x) {
      var r = capsule.getBoundingClientRect();
      var largeur = parseFloat(lentille.style.getPropertyValue('--ard-lentille-l')) || 64;
      var gauche = Math.max(4, Math.min(r.width - largeur - 4, x - r.left - largeur / 2));
      var maintenant = performance.now();
      var vitesse = Math.abs(x - dernierX) / Math.max(1, maintenant - dernierT);
      dernierX = x; dernierT = maintenant;
      lentille.style.setProperty('--ard-lentille-x', gauche + 'px');
      lentille.style.setProperty('--ard-etire', String(1 + Math.min(0.32, vitesse * 0.35)));
      capsule.style.setProperty('--ard-reflet-x', (x - r.left) + 'px');
      var sous = ongletSous(x);
      ongletsListe().forEach(function (o) { o.classList.toggle('ard-survol', o === sous); });
    }

    function finir(e, annule) {
      if (!actif) return;
      actif = false;
      racine.classList.remove('ard-onglets-presse');
      capsule.style.removeProperty('--ard-reflet-x');
      lentille.style.backdropFilter = ''; lentille.style.webkitBackdropFilter = '';
      ongletsListe().forEach(function (o) { o.classList.remove('ard-survol'); });
      try { if (pointeur !== null) capsule.releasePointerCapture(pointeur); } catch (er) {}
      pointeur = null;
      var choisi = annule ? null : ongletSous(e.clientX);
      var courant = capsule.querySelector('.ard-onglet.actif');
      if (choisi && choisi !== courant) {
        ongletsListe().forEach(function (o) { o.classList.toggle('actif', o === choisi); });
        placerLentille(choisi);
        ignorerClic = true;
        setTimeout(function () { window.location.href = choisi.href; }, 140);
      } else {
        placerLentille(courant);
        if (bouge) ignorerClic = true;
      }
    }

    capsule.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (racine.classList.contains('ard-onglets-mini')) {
        // Barre réduite : le premier contact la redéploie.
        e.preventDefault();
        ignorerClic = true;
        reduireOnglets(false);
        return;
      }
      actif = true; bouge = false; depart = dernierX = e.clientX; dernierT = performance.now();
      pointeur = e.pointerId;
      try { capsule.setPointerCapture(e.pointerId); } catch (er) {}
      racine.classList.add('ard-onglets-presse');
      filtreLentille();
      suivre(e.clientX);
    });
    capsule.addEventListener('pointermove', function (e) {
      if (!actif) return;
      if (Math.abs(e.clientX - depart) > 6) bouge = true;
      suivre(e.clientX);
    });
    capsule.addEventListener('pointerup', function (e) { finir(e, false); });
    capsule.addEventListener('pointercancel', function (e) { finir(e, true); });
    capsule.addEventListener('lostpointercapture', function (e) { if (actif) finir(e, false); });
    capsule.addEventListener('click', function (e) {
      if (!ignorerClic) return;
      ignorerClic = false;
      e.preventDefault();
    }, true);
  }

  /* ---------------------------------------------- Barre réduite au défilement */
  var reduite = false;

  function reduireOnglets(oui) {
    if (reduite === oui || !capsule) return;
    reduite = oui;
    racine.classList.toggle('ard-onglets-mini', oui);
    // La lentille se repose sur l'onglet une fois la capsule redéployée.
    if (!oui) setTimeout(function () { placerLentille(capsule.querySelector('.ard-onglet.actif'), true); }, 480);
  }

  function installerBarreReduite() {
    var dernier = window.scrollY, cumul = 0, attente = false;
    window.addEventListener('scroll', function () {
      if (attente) return;
      attente = true;
      requestAnimationFrame(function () {
        attente = false;
        var y = window.scrollY, delta = y - dernier;
        dernier = y;
        if (racine.classList.contains('ard-onglets-presse')) return;
        cumul = (delta > 0) === (cumul > 0) ? cumul + delta : delta;
        if (y < 80) reduireOnglets(false);
        else if (cumul > 36) reduireOnglets(true);
        else if (cumul < -18) reduireOnglets(false);
      });
    }, { passive: true });
  }

  /* ==========================================================================
     5 bis. VERRE LIQUIDE
     Sur iOS, Safari n'expose pas le verre « Liquid Glass » d'Apple aux pages
     web, et WebKit n'accepte pas de filtre SVG dans `backdrop-filter`. Le
     verre y est donc composé de calques (voir mobile.css) : givre, anneau de
     lentille plus flou et plus lumineux, reflets — tous rendus par le GPU via
     `backdrop-filter`.

     Là où le moteur l'accepte (Chromium), on ajoute la VRAIE réfraction : une
     carte de déplacement calculée à la taille exacte de la forme (rectangle à
     coins ronds), qui tord ce qui passe sous le bord du verre comme le ferait
     une lentille. Le centre reste net ; la lentille d'appui grossit en plus.
     ========================================================================== */
  var refraction = false, defsVerre = null, compteurFiltre = 0;

  function poserCouchesVerre(hote) {
    ['ard-verre-fond', 'ard-verre-bord', 'ard-verre-reflet'].forEach(function (c) {
      var n = el('span', c);
      n.setAttribute('aria-hidden', 'true');
      hote.appendChild(n);
    });
  }

  /* Carte de déplacement : R et G codent le décalage horizontal et vertical
     (128 = aucun). Près du bord, on va chercher l'image plus à l'intérieur,
     d'autant plus fort qu'on s'approche de la tranche (profil quadratique) ;
     `loupe` ajoute un grossissement vers le centre. */
  function carteRefraction(w, h, rayon, biseau, loupe) {
    var toile = document.createElement('canvas');
    toile.width = w; toile.height = h;
    var ctx = toile.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
    var hx = w / 2, hy = h / 2, ix = hx - rayon, iy = hy - rayon;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var px = x + 0.5 - hx, py = y + 0.5 - hy;
        var sx = px < 0 ? -1 : 1, sy = py < 0 ? -1 : 1;
        var qx = Math.abs(px) - ix, qy = Math.abs(py) - iy, dist, nx, ny;
        if (qx > 0 && qy > 0) {
          var l = Math.sqrt(qx * qx + qy * qy) || 1;
          dist = rayon - l; nx = (qx / l) * sx; ny = (qy / l) * sy;
        } else if (qx > qy) { dist = rayon - qx; nx = sx; ny = 0; }
        else { dist = rayon - qy; nx = 0; ny = sy; }
        var t = Math.max(0, 1 - Math.max(0, dist) / biseau), m = t * t;
        var vx = -nx * m, vy = -ny * m;
        if (loupe) { vx -= (px / hx) * loupe; vy -= (py / hy) * loupe; }
        vx = Math.max(-1, Math.min(1, vx)); vy = Math.max(-1, Math.min(1, vy));
        var i = (y * w + x) * 4;
        d[i] = 128 + vx * 127; d[i + 1] = 128 + vy * 127; d[i + 2] = 128; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toile.toDataURL();
  }

  function filtreRefraction(cible, force, loupe, suite) {
    if (!refraction || !cible) return;
    var w = Math.round(cible.offsetWidth), h = Math.round(cible.offsetHeight);
    if (w < 8 || h < 8) return;
    var rayon = Math.min(h / 2, w / 2, parseFloat(getComputedStyle(cible).borderTopLeftRadius) || h / 2);
    if (!defsVerre) {
      var hoteSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      // Ni `display: none` ni `visibility: hidden` : le filtre ne serait plus rendu.
      hoteSvg.setAttribute('width', '0'); hoteSvg.setAttribute('height', '0');
      hoteSvg.setAttribute('aria-hidden', 'true');
      hoteSvg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      defsVerre = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      hoteSvg.appendChild(defsVerre);
      document.body.appendChild(hoteSvg);
    }
    var id = cible.dataset.ardFiltre || ('ard-verre-' + (++compteurFiltre));
    cible.dataset.ardFiltre = id;
    var ancien = document.getElementById(id);
    if (ancien) ancien.remove();
    var ns = 'http://www.w3.org/2000/svg';
    var f = document.createElementNS(ns, 'filter');
    f.setAttribute('id', id);
    f.setAttribute('x', '0'); f.setAttribute('y', '0');
    f.setAttribute('width', String(w)); f.setAttribute('height', String(h));
    f.setAttribute('filterUnits', 'userSpaceOnUse');
    f.setAttribute('primitiveUnits', 'userSpaceOnUse');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    var image = document.createElementNS(ns, 'feImage');
    image.setAttribute('href', carteRefraction(w, h, rayon, Math.min(22, h * 0.42), loupe || 0));
    image.setAttribute('x', '0'); image.setAttribute('y', '0');
    image.setAttribute('width', String(w)); image.setAttribute('height', String(h));
    image.setAttribute('preserveAspectRatio', 'none');
    image.setAttribute('result', 'carte');
    var depl = document.createElementNS(ns, 'feDisplacementMap');
    depl.setAttribute('in', 'SourceGraphic');
    depl.setAttribute('in2', 'carte');
    depl.setAttribute('scale', String(force));
    depl.setAttribute('xChannelSelector', 'R');
    depl.setAttribute('yChannelSelector', 'G');
    f.appendChild(image); f.appendChild(depl);
    defsVerre.appendChild(f);
    var valeur = 'url(#' + id + ') ' + suite;
    cible.style.backdropFilter = valeur;
    cible.style.webkitBackdropFilter = valeur;
  }

  function appliquerRefraction(hote) {
    if (!refraction || racine.classList.contains('ard-android')) return;
    var fond = hote.querySelector(':scope > .ard-verre-fond');
    var bord = hote.querySelector(':scope > .ard-verre-bord');
    // La vraie lentille remplace l'anneau d'approximation.
    if (bord) bord.style.display = 'none';
    filtreRefraction(fond, 34, 0, 'blur(2px) saturate(190%) brightness(1.05)');
  }

  /* La forme change (barre réduite, rotation) : la carte est recalculée une
     fois la taille posée — l'étirer pendant la transition suffit à l'œil. */
  function suivreTailleVerre(hotes) {
    if (!refraction) return;
    hotes.forEach(appliquerRefraction);
    if (!window.ResizeObserver) return;
    var minuteur = 0;
    var obs = new ResizeObserver(function () {
      clearTimeout(minuteur);
      minuteur = setTimeout(function () { hotes.forEach(appliquerRefraction); }, 160);
    });
    hotes.forEach(function (h) { obs.observe(h); });
  }

  /* La goutte d'appui grossit ce qu'elle survole. Le filtre n'est actif que
     pendant l'appui (le style « au repos » n'a pas de `backdrop-filter`). */
  function filtreLentille() {
    if (!refraction || !lentille) return;
    filtreRefraction(lentille, 16, 0.1, 'saturate(160%) brightness(1.03)');
  }

  /* Bouton retour : seulement sur un écran qui n'est pas un onglet, atteint
     depuis un autre écran de l'application. */
  function majRetour() {
    if (!retourEl) return;
    var ref = document.referrer, memeOrigine = false;
    try { memeOrigine = !!ref && new URL(ref).origin === window.location.origin; } catch (e) {}
    var afficher = memeOrigine && window.history.length > 1
      && page(new URL(ref).pathname) !== page()
      && pagesOnglets.indexOf(page()) === -1;
    retourEl.hidden = !afficher;
  }

  function majCloche(nav) {
    if (!clocheEl) return;
    var lien = nav.querySelector('.nav-item[href$="messages.html"]');
    var li = lien && lien.closest('li');
    clocheEl.hidden = !li || masqueeParRole(li) || page() === 'messages.html';
  }

  /* --------------------------------------------------- Pastille de messages */
  function suivrePastille() {
    if (!pastilleEl) return;
    function relire() {
      var source = document.querySelector('.badge-nav-messages');
      var n = source && source.textContent.trim();
      var visible = !!(n && n !== '0' && getComputedStyle(source).display !== 'none');
      var texte = visible ? n : '';
      var aria = visible ? n + ' message(s) non lu(s)' : '';
      // N'écrire que ce qui change : la pastille ne doit jamais relancer
      // l'observateur (une boucle bloquait le navigateur).
      if (pastilleEl.textContent !== texte) pastilleEl.textContent = texte;
      if (pastilleEl.classList.contains('visible') !== visible) pastilleEl.classList.toggle('visible', visible);
      if (pastilleEl.getAttribute('aria-label') !== aria) pastilleEl.setAttribute('aria-label', aria);
    }
    var source = document.querySelector('.badge-nav-messages');
    relire();
    if (!source) return;
    new MutationObserver(relire).observe(source, {
      childList: true, characterData: true, subtree: true,
      attributes: true, attributeFilter: ['style', 'class', 'hidden', 'aria-hidden']
    });
  }

  /* ==========================================================================
     6. CLAVIER VIRTUEL
     Clavier ouvert, la barre d'onglets s'efface : elle flotterait au-dessus
     des touches et cacherait le champ qu'on remplit.
     ========================================================================== */
  function surveillerClavier() {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    function saisissable(n) {
      return n && (n.isContentEditable || /^(TEXTAREA|SELECT)$/.test(n.tagName)
        || (n.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|file|range|color)$/i.test(n.type)));
    }
    document.addEventListener('focusin', function (e) {
      if (saisissable(e.target)) racine.classList.add('ard-clavier');
    });
    document.addEventListener('focusout', function () {
      setTimeout(function () {
        if (!saisissable(document.activeElement)) racine.classList.remove('ard-clavier');
      }, 80);
    });
  }

  /* ==========================================================================
     7. TABLEAUX → LISTES
     Chaque cellule reçoit un rôle (voir `mobile.css`, section 12). Les
     intitulés de colonnes disent souvent ce qu'est une cellule ; à défaut,
     son contenu (un badge, un champ, des boutons) le dit.
     ========================================================================== */
  var MOTIFS_TITRE = [
    /^(élève|eleve|nom|nom complet|personne|apprenant|candidat|enseignant|professeur)\b/i,
    /^(libellé|libelle|titre|objet|intitulé|intitule)\b/i,
    /^(cours|branche|épreuve|epreuve|session|classe|option|frais|fait|catégorie|categorie|période|periode|jour|prestataire|formulaire|numéro de copie|année scolaire)\b/i
  ];
  var MOTIFS_FIN = [
    /^(statut|état|etat)$/i,
    /^(résultat|resultat|décision|decision|mention|affectation|bulletin)/i,
    /^(solde|net|dette totale|reste|montant|total|taux|moyenne|pourcentage|note|points|côte|cote|réussite)/i
  ];
  var MOTIF_SOUS = /^(matricule|code|classe|classe actuelle|sexe|date|e-?mail|email|option|poste|session|année|annee|numéro|numero|jour|période|periode|rôles?|roles?|catégorie|categorie|titulaire|signalé par|depuis|correcteur)\b/i;
  var SELECTEUR_BADGE = '[class*="badge"], .etat-bulletin, .pastille, .statut, .etiquette-statut';
  var SELECTEUR_ACTION = 'button, a[href], .lien-action';

  function texteSansActions(td) {
    var copie = td.cloneNode(true);
    [].forEach.call(copie.querySelectorAll(SELECTEUR_ACTION + ', input, select, textarea'), function (n) { n.remove(); });
    return copie.textContent.replace(/\s+/g, ' ').trim();
  }

  function actionsVisibles(td) {
    var vus = [];
    [].forEach.call(td.querySelectorAll(SELECTEUR_ACTION), function (n) {
      if (n.hidden || n.style.display === 'none') return;
      if (n.parentElement && n.parentElement.closest(SELECTEUR_ACTION) && td.contains(n.parentElement.closest(SELECTEUR_ACTION))) return;
      vus.push(n);
    });
    return vus;
  }

  function natureCellule(td, libelle) {
    if (td.classList.contains('col-selection')) return 'sel';
    var champs = td.querySelectorAll('input:not([type="hidden"]), select, textarea');
    if (champs.length) {
      var cases = td.querySelectorAll('input[type="checkbox"], input[type="radio"]');
      if (cases.length === champs.length && cases.length === 1) return libelle ? 'compact' : 'sel';
      if (champs.length === 1 && champs[0].matches('input[type="number"], .champ-note')) return 'compact';
      return 'saisie';
    }
    // « Classe », « Élève »… : le nom de la ligne, même cliquable (bouton
    // « fiche », puce d'alerte), n'est ni une action ni un choix.
    if (MOTIFS_TITRE.some(function (m) { return m.test(libelle); })) return 'donnee';
    var actions = actionsVisibles(td);
    if (actions.length && !texteSansActions(td)) {
      if (!libelle || /^actions?$/i.test(libelle)) return 'actions';
      if (actions.length > 1) return 'saisie';         // groupe de choix
    }
    return 'donnee';
  }

  var ROLES = ['ard-c-sel', 'ard-c-titre', 'ard-c-sous', 'ard-c-fin', 'ard-c-actions', 'ard-c-meta',
    'ard-c-saisie', 'ard-c-compact', 'ard-plusieurs', 'ard-long', 'ard-fin-legende'];

  function indexParMotifs(libelles, motifs, permis) {
    for (var m = 0; m < motifs.length; m++) {
      for (var i = 0; i < libelles.length; i++) {
        if (permis(i) && motifs[m].test(libelles[i])) return i;
      }
    }
    return -1;
  }

  function traiterLigne(tr, libelles) {
    var cellules = [].slice.call(tr.cells);
    if (!cellules.length) return;
    if (cellules.length === 1 || (cellules[0].colSpan > 1 && cellules.length <= 2)) {
      tr.classList.add('ard-ligne-pleine');
      return;
    }
    tr.classList.remove('ard-ligne-pleine');

    var natures = cellules.map(function (td, i) {
      ROLES.forEach(function (r) { td.classList.remove(r); });
      if (libelles[i]) td.setAttribute('data-libelle', libelles[i]);
      return natureCellule(td, libelles[i] || '');
    });
    var textes = cellules.map(function (td) { return td.textContent.replace(/\s+/g, ' ').trim(); });
    function estDonnee(i) { return natures[i] === 'donnee' && !!textes[i] && textes[i] !== '—' && textes[i] !== '-'; }

    var iTitre = indexParMotifs(libelles, MOTIFS_TITRE, estDonnee);
    if (iTitre === -1) {
      for (var t = 0; t < cellules.length; t++) { if (estDonnee(t)) { iTitre = t; break; } }
    }

    var aCompact = natures.indexOf('compact') !== -1;
    // À droite : le statut d'abord, sinon le premier badge, sinon le chiffre
    // clé (solde, moyenne…).
    var iFin = -1;
    if (!aCompact) {
      iFin = indexParMotifs(libelles, [MOTIFS_FIN[0]], function (i) {
        return i !== iTitre && estDonnee(i) && textes[i].length <= 28;
      });
      for (var b = 0; b < cellules.length && iFin === -1; b++) {
        if (b !== iTitre && estDonnee(b) && textes[b].length <= 28 && cellules[b].querySelector(SELECTEUR_BADGE)) iFin = b;
      }
      if (iFin === -1) {
        iFin = indexParMotifs(libelles, MOTIFS_FIN.slice(1), function (i) {
          return i !== iTitre && estDonnee(i) && textes[i].length <= 18;
        });
      }
    }

    // Pas de statut : un nombre court (effectif, total…) passe à droite, son
    // intitulé en légende — plutôt qu'une pastille seule sur toute la largeur.
    var finLegende = false;
    if (iFin === -1 && !aCompact) {
      for (var k = 0; k < cellules.length; k++) {
        if (k !== iTitre && estDonnee(k) && !MOTIF_SOUS.test(libelles[k] || '')
            && /^[\d\s.,:%/+−-]{1,10}$/.test(textes[k])) { iFin = k; finLegende = !!libelles[k]; break; }
      }
    }

    var sous = [], titreTexte = iTitre !== -1 ? sansAccents(textes[iTitre]) : '';
    var aSuite = false;
    cellules.forEach(function (td, i) {
      var n = natures[i];
      if (n === 'sel') { td.classList.add('ard-c-sel'); return; }
      if (n === 'compact') { td.classList.add('ard-c-compact'); return; }
      if (n === 'saisie') { td.classList.add('ard-c-saisie'); aSuite = true; return; }
      if (n === 'actions') {
        td.classList.add('ard-c-actions');
        if (actionsVisibles(td).length > 1) {
          td.classList.add('ard-plusieurs');
          td.setAttribute('role', 'button');
          td.setAttribute('tabindex', '0');
          td.setAttribute('aria-label', 'Actions');
        } else {
          td.removeAttribute('role');
          td.removeAttribute('tabindex');
          td.removeAttribute('aria-label');
        }
        return;
      }
      if (i === iTitre) { td.classList.add('ard-c-titre'); return; }
      if (i === iFin) {
        td.classList.add('ard-c-fin');
        td.classList.toggle('ard-fin-legende', finLegende);
        return;
      }
      if (!textes[i] && !td.children.length) { td.classList.add('ard-cellule-vide'); return; }
      if (sous.length < 3 && iTitre !== -1 && MOTIF_SOUS.test(libelles[i] || '') && textes[i].length <= 32 && estDonnee(i)) {
        td.classList.add('ard-c-sous');
        // Inutile de répéter ce que le titre dit déjà (« 6e A » sous le nom).
        if (titreTexte.indexOf(sansAccents(textes[i])) === -1) sous.push(textes[i]);
        return;
      }
      td.classList.add('ard-c-meta');
      if (textes[i].length > 38) td.classList.add('ard-long');
      aSuite = true;
    });

    // Le sous-titre : sous le nom de la personne s'il y en a un, sinon sous
    // le texte de la cellule titre.
    if (iTitre !== -1) {
      var titre = cellules[iTitre];
      // Une cellule « personne » a déjà une ligne grise (la classe) : les
      // identifiants s'y ajoutent, sur la même ligne.
      var porteur = titre.querySelector('.sous-nom') || titre.querySelector('.identite') || titre;
      [titre, titre.querySelector('.identite'), titre.querySelector('.sous-nom')].forEach(function (n) {
        if (n) n.removeAttribute('data-ard-sous');
      });
      if (sous.length) porteur.setAttribute('data-ard-sous', sous.join(' · '));
      tr.classList.toggle('ard-avec-avatar', !!titre.querySelector('.avatar'));
    }
    tr.classList.toggle('ard-a-suite', aSuite);
  }

  function traiterTableau(table) {
    if (!ecranListes.matches || !table.isConnected) return;
    if (table.closest('.page') || table.dataset.mobile === 'tableau') return;
    var boite = table.closest('.conteneur-tableau');
    if (!boite) return;
    var lignesEntete = table.tHead ? table.tHead.rows : [];
    // Les en-têtes sur deux rangées (colonnes groupées) ne se lisent pas en
    // liste : ces tableaux gardent le rendu en fiches de `ui.css`.
    if (lignesEntete.length > 1) return;
    var libelles = lignesEntete.length
      ? [].map.call(lignesEntete[0].cells, function (th) { return th.textContent.replace(/\s+/g, ' ').trim(); })
      : [];
    if (lignesEntete.length && [].some.call(lignesEntete[0].cells, function (th) { return th.colSpan > 1; })) return;

    table.classList.add('ard-liste');
    boite.classList.add('ard-liste-boite');
    [].forEach.call(table.tBodies, function (corps) {
      [].forEach.call(corps.rows, function (tr) {
        try { traiterLigne(tr, libelles); } catch (e) { /* ligne laissée telle quelle */ }
      });
    });
    if (table.tFoot) {
      [].forEach.call(table.tFoot.rows, function (tr) {
        try { traiterLigne(tr, libelles); } catch (e) {}
      });
    }
  }

  function surveillerListes() {
    var aTraiter = [], attente = 0;
    function planifier(table) {
      if (aTraiter.indexOf(table) === -1) aTraiter.push(table);
      if (attente) return;
      // Regroupé sur une frame : un tableau de trois cents lignes déclenche
      // trois cents mutations.
      attente = requestAnimationFrame(function () {
        attente = 0;
        var lot = aTraiter; aTraiter = [];
        lot.forEach(traiterTableau);
      });
    }
    function tout() {
      [].forEach.call(document.querySelectorAll('.conteneur-tableau table'), planifier);
    }
    tout();
    new MutationObserver(function (enregistrements) {
      if (!ecranListes.matches) return;
      enregistrements.forEach(function (r) {
        var cible = r.target.nodeType === 1 ? r.target : r.target.parentElement;
        var table = cible && cible.closest && cible.closest('table');
        if (table) { planifier(table); return; }
        [].forEach.call(r.addedNodes, function (n) {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'TABLE') planifier(n);
          else if (n.querySelectorAll) [].forEach.call(n.querySelectorAll('table'), planifier);
        });
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    ecranListes.addEventListener('change', function () { if (ecranListes.matches) tout(); });
  }

  /**
   * Enveloppe les tableaux laissés à nu : le rendu en liste ne s'applique
   * qu'à l'intérieur d'un `.conteneur-tableau`.
   */
  function envelopperTableaux() {
    [].forEach.call(document.querySelectorAll('table'), function (t) {
      if (t.closest('.conteneur-tableau') || t.closest('.page')) return;
      var boite = el('div', 'conteneur-tableau');
      t.parentNode.insertBefore(boite, t);
      boite.appendChild(t);
    });
  }

  /* ==========================================================================
     8. FEUILLE D'ACTIONS
     « Modifier · Historique · Supprimer » sur chaque ligne, c'était trois
     liens serrés. Un bouton « ••• » ouvre la feuille ; chaque choix déclenche
     le VRAI bouton de la ligne, avec ses écouteurs.
     ========================================================================== */
  var feuilleActions = null, voileActions = null, retourFocus = null;

  function fermerActions() {
    racine.classList.remove('ard-actions-ouvert');
    if (retourFocus && retourFocus.focus) { try { retourFocus.focus({ preventScroll: true }); } catch (e) {} }
    retourFocus = null;
  }

  function ouvrirActions(td) {
    var actions = actionsVisibles(td);
    if (!actions.length) return;
    if (!feuilleActions) {
      voileActions = el('div', 'ard-actions-voile');
      voileActions.addEventListener('click', fermerActions);
      feuilleActions = el('div', 'ard-actions');
      feuilleActions.setAttribute('role', 'dialog');
      feuilleActions.setAttribute('aria-modal', 'true');
      document.body.appendChild(voileActions);
      document.body.appendChild(feuilleActions);
    }
    feuilleActions.innerHTML = '';
    var groupe = el('div', 'ard-actions-groupe');
    var tr = td.closest('tr');
    var titre = tr && tr.querySelector('.ard-c-titre');
    var nomTitre = titre ? ((titre.querySelector('.nom-personne') || titre).textContent || '').replace(/\s+/g, ' ').trim() : '';
    if (nomTitre) {
      groupe.appendChild(el('div', 'ard-actions-titre', nomTitre));
      feuilleActions.setAttribute('aria-label', nomTitre);
    }
    actions.forEach(function (source) {
      var libelle = (source.textContent || source.getAttribute('aria-label') || source.title || 'Action').replace(/\s+/g, ' ').trim();
      var b = el('button', '', libelle);
      b.type = 'button';
      if (source.disabled) b.disabled = true;
      if (/suppr|danger|rouge|destruct/i.test(source.className) || /^(supprimer|retirer|désactiver|desactiver|révoquer|revoquer|bloquer|annuler l)/i.test(libelle)) {
        b.classList.add('ard-destructif');
      }
      b.addEventListener('click', function () {
        fermerActions();
        setTimeout(function () { source.click(); }, 30);
      });
      groupe.appendChild(b);
    });
    feuilleActions.appendChild(groupe);
    var annuler = el('button', 'ard-actions-annuler', 'Annuler');
    annuler.type = 'button';
    annuler.addEventListener('click', fermerActions);
    feuilleActions.appendChild(annuler);

    retourFocus = td;
    void feuilleActions.offsetWidth;
    racine.classList.add('ard-actions-ouvert');
    var premier = feuilleActions.querySelector('button:not(:disabled)');
    if (premier) premier.focus({ preventScroll: true });
  }

  function installerActions() {
    document.addEventListener('click', function (e) {
      if (!ecranListes.matches) return;
      var td = e.target.closest && e.target.closest('td.ard-c-actions.ard-plusieurs');
      if (!td) return;
      e.preventDefault();
      e.stopPropagation();
      ouvrirActions(td);
    }, true);
    document.addEventListener('keydown', function (e) {
      var td = e.target.closest && e.target.closest('td.ard-c-actions.ard-plusieurs');
      if (td && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ouvrirActions(td); }
    });
  }

  /* ==========================================================================
     9. DÉMARRAGE
     ========================================================================== */
  var majDefilement = null;

  function demarrer() {
    // Les aperçus de bulletin suivent un chemin à part et s'arrêtent là.
    if (ajusterFeuille()) return;

    var nav = document.querySelector('.barre-laterale');
    if (!nav) return;

    detecterPlateforme();
    couvrirEncoche();
    try { construireBarreHaute(nav); } catch (e) { /* la page reste navigable */ }
    try { construireFeuille(nav); } catch (e) {}
    try { appliquerTeintes(); } catch (e) {}
    try { envelopperTableaux(); } catch (e) {}
    try { majDefilement = suivreDefilement(); } catch (e) {}
    try { surveillerClavier(); } catch (e) {}
    try { surveillerListes(); } catch (e) {}
    try { installerActions(); } catch (e) {}
    try { chargerProfil(); } catch (e) {}

    /* « Tous les menus » et « Tous les écrans » (ui.js) passent par ici : sur
       téléphone, ils ouvrent la feuille de menu, pas l'ancien panneau. */
    window.ArdoiseMobile = {
      ouvrirMenu: function () {
        if (!petitEcran.matches || !racine.classList.contains('ard-mob-coque')) return false;
        var voile = document.getElementById('voile-tiroir');
        if (voile) voile.classList.remove('ouvert');
        basculer(true);
        return true;
      }
    };

    // Un lien de la feuille la referme. Par délégation : les entrées
    // ajoutées après coup (« Aide & Tutoriels ») en profitent aussi.
    nav.addEventListener('click', function (e) {
      if (e.target.closest('.nav-item, .nav-deconnexion, .ard-feuille-profil')) basculer(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (racine.classList.contains('ard-actions-ouvert')) { fermerActions(); return; }
      basculer(false);
    });

    new MutationObserver(synchroniser).observe(nav, { attributes: true, attributeFilter: ['class'] });
    petitEcran.addEventListener('change', function () {
      if (!petitEcran.matches) basculer(false);
      else activerMobile(nav);
      synchroniser();
    });
    synchroniser();

    // L'apparence change (profil) : la barre suit sa teinte, lue dans sa fiche.
    document.addEventListener('ardoise:theme-change', function (e) {
      try { appliquerTeintes(e.detail && e.detail.theme); } catch (er) {}
    });

    // Retour arrière restauré depuis le cache : feuilles fermées, lentille
    // remise sous l'onglet de l'écran.
    window.addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      basculer(false);
      fermerActions();
      if (capsule) {
        [].forEach.call(capsule.querySelectorAll('.ard-onglet'), function (o) {
          o.classList.toggle('actif', page(o.getAttribute('href')) === page());
        });
        placerLentille(capsule.querySelector('.ard-onglet.actif'), true);
      }
    });
    window.addEventListener('resize', function () {
      if (capsule) placerLentille(capsule.querySelector('.ard-onglet.actif'), true);
    });

    /* Le rail (`reduireRail`) et le badge de messages s'exécutent 60 ms après
       le chargement, une fois le filtrage par rôle appliqué. On se place
       après eux : déployer le menu avant qu'il soit filtré afficherait des
       écrans interdits pendant une fraction de seconde. */
    setTimeout(function () {
      activerMobile(nav);
      try { suivrePastille(); } catch (e) {}
      if (titreEl) titreEl.textContent = titrePage();
      try { appliquerTeintes(); } catch (e) {}
      if (majDefilement) majDefilement();
    }, 260);
  }

  /**
   * Réorganisation réservée au téléphone : sur grand écran, les titres de
   * famille n'ont pas de style et l'ordre voulu par le rail serait perdu.
   * Idempotente (`data-mob-groupe`).
   */
  function activerMobile(nav) {
    if (!petitEcran.matches) return;
    try { deployerMenu(nav); } catch (e) { /* menu conservé tel quel */ }
    try { construireProfil(nav); } catch (e) {}
    try { calculerGroupes(nav.querySelector('.nav-liste')); } catch (e) {}
    try { construireOnglets(nav); } catch (e) { /* la barre haute suffit */ }
    try { majRetour(); majCloche(nav); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();
