/* ==========================================================================
   Ardoise — SIGNATURES DES APPARENCES
   --------------------------------------------------------------------------
   Chaque apparence raconte une histoire. Ce fichier lui donne :
     · un récit et une devise (affichés dans Mon profil et au changement) ;
     · une scène : un décor animé, discret, derrière le contenu ;
     · un widget qui lui est propre sur les pages d'accueil ;
     · ses gestes : entrée des cartes, effet au clic, suivi du pointeur ;
     · un rideau de transition quand on la choisit.
   Il porte aussi deux services transverses :
     · l'animation d'accueil de la toute première connexion ;
     · le garde-fou de déconnexion : si une apparence venait à masquer le
       bouton « Se déconnecter », une commande de secours apparaît.

   Règles : présentation pure et réversible. Aucune requête métier, aucun
   chiffre inventé ; les widgets lisent l'heure, la date ou ce que l'écran
   affiche déjà, et ce que l'utilisateur écrit reste sur son appareil.
   Tout s'arrête quand l'onglet est caché et se fige si le système demande
   moins d'animations. Rien n'est imprimé.
   ========================================================================== */
(function () {
  'use strict';
  if (window.ArdoiseSignatures) return;

  var html = document.documentElement;
  var page = location.pathname.split('/').pop() || 'index.html';
  var accueil = /^(dashboard-directeur|espace-)/.test(page);
  var admin = page === 'super-admin.html';
  var calme = window.matchMedia('(prefers-reduced-motion: reduce)');
  var bureau = window.matchMedia('(min-width: 781px)');
  var NS = 'http://www.w3.org/2000/svg';

  function theme() { return html.getAttribute('data-theme') || ''; }
  function el(tag, cls, texte) { var n = document.createElement(tag); if (cls) n.className = cls; if (texte != null) n.textContent = texte; return n; }
  function aleatoire(min, max) { return min + Math.random() * (max - min); }
  function utilisateur() {
    try { return JSON.parse(localStorage.getItem('ardoise_user') || sessionStorage.getItem('ardoise_user') || 'null') || {}; } catch (e) { return {}; }
  }
  function cleLocale(nom) { return 'ardoise_sg_' + nom + '_' + (utilisateur().id || 'anonyme'); }
  function lire(nom, defaut) { try { var v = localStorage.getItem(cleLocale(nom)); return v == null ? defaut : JSON.parse(v); } catch (e) { return defaut; } }
  function ecrire(nom, valeur) { try { localStorage.setItem(cleLocale(nom), JSON.stringify(valeur)); } catch (e) {} }
  function aujourdhui() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function heure(d, secondes) { return new Intl.DateTimeFormat('fr', secondes ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : { hour: '2-digit', minute: '2-digit' }).format(d || new Date()); }

  /* ------------------------------------------------------------------------
     1. Les récits
     ------------------------------------------------------------------------ */
  var RECITS = {
    ardoise: { titre: 'Le Tableau', recit: 'Tout commence par une ardoise : un tableau vert, un bâton de craie, une main qui écrit. Chaque journée s’y trace à la craie, puis s’efface le soir pour laisser place à la suivante.' },
    studio: { titre: 'L’Atelier', recit: 'Un atelier silencieux éclairé par un projecteur indigo. Les outils sont rangés, chaque geste est précis et la lumière suit votre travail.' },
    pure: { titre: 'La Page blanche', recit: 'Une feuille blanche, une grille suisse et un seul accent bleu. Les cartes sont numérotées comme les pages d’un registre ; la donnée parle d’elle-même.' },
    nuit: { titre: 'La Veillée', recit: 'Quand l’école s’endort, l’observatoire s’allume. Sous un ciel étoilé où passe parfois une étoile filante, on prépare le lendemain au calme, les yeux reposés.' },
    yohali: { titre: 'Teranga', recit: 'Teranga, c’est l’hospitalité : la porte ouverte, le thé partagé, la place faite à chacun. Les motifs du wax et la terre cuite accueillent les familles comme à la maison, dans toutes les langues.' },
    elan: { titre: 'L’Élan', recit: 'Le matin, sur la piste, on prend son élan. Chaque petite victoire pousse la suivante : un appel fait, un bulletin terminé, une famille rassurée. Cochez-les, l’élan fait le reste.' },
    perspective: { titre: 'L’Atelier d’architecte', recit: 'Une table à dessin, une voûte de pierre, des lignes qui fuient vers l’horizon. Chaque espace de l’école est pensé comme une pièce d’architecture : les cartes ont du relief et la journée se lit comme un plan.' },
    recre: { titre: 'La Récré', recit: 'Dring ! La cloche sonne et la cour s’anime : crayons de couleur, avions en papier, cahiers à petits carreaux. Un post-it attend vos idées, et un avion décolle quand on le lui demande.' },
    nexus: { titre: 'Le Réseau', recit: 'Nexus voit l’école comme un réseau vivant : chaque élève, chaque classe, chaque note est un nœud. Les données circulent en impulsions de lumière et la console veille.' },
    orbite: { titre: 'L’Aube orbitale', recit: 'Vue depuis l’orbite, l’école est un point lumineux qui s’éveille avec l’aube. Le ciel change de couleur avec l’heure, les satellites veillent et la course du soleil rythme la journée.' },
    fluide: { titre: 'Le Lagon', recit: 'Une école vue à travers l’eau claire d’un lagon. Chaque surface est une goutte de verre : elle laisse passer la lumière, capte le reflet sous votre doigt et la journée s’y remplit comme un verre d’eau.' },
    pro: { titre: 'Le Cockpit',
      recit: 'Une salle de pilotage silencieuse : un rail marine, un seul voyant bleu, des chiffres alignés au cordeau. Pro transforme les compteurs de votre école en indicateurs clés et laisse le reste se taire.' },
    savane: { titre: 'L’Heure dorée',
      recit: 'Fin d’après-midi dans la savane : le soleil descend, les acacias se découpent sur le ciel et les oiseaux rentrent. On avance d’un pas régulier ; la semaine se lit comme une piste où chaque jour laisse son empreinte.' },
    vibra: { titre: 'Le Campus vibrant', recit: 'Dans un campus afrofuturiste, l’or et le bleu pétrole vibrent ensemble. Chaque connexion entre élèves, professeurs et familles allume un fil de lumière, et le pouls de l’école bat sous vos yeux.' }
  };

  /* La devise vit dans la fiche de l'apparence (theme.js), que Mon profil et
     la page Apparence du Super Admin affichent ; le récit complet vit ici. */
  (window.ARDOISE_THEMES || []).forEach(function (t) {
    var r = RECITS[t.cle];
    if (r) { r.devise = t.devise || ''; t.recit = r.recit; t.titreRecit = r.titre; }
  });

  /* ------------------------------------------------------------------------
     2. Minuteries : une seule horloge, coupée quand l'onglet est caché
     ------------------------------------------------------------------------ */
  var tics = [];
  setInterval(function () {
    if (document.hidden) return;
    tics = tics.filter(function (f) { return f() !== false; });
  }, 1000);
  /* Premier appel au tour suivant : le widget est alors posé dans la page
     (une fonction qui trouve son widget détaché se retire de l'horloge). */
  function chaqueSeconde(f) { setTimeout(function () { if (f() !== false) tics.push(f); }, 0); }

  /* ------------------------------------------------------------------------
     3. Les scènes
     ------------------------------------------------------------------------ */
  function tirer(conteneur, n, cls, reglage) {
    for (var i = 0; i < n; i++) { var s = el('i', cls); reglage(s, i); conteneur.append(s); }
  }
  var SCENES = {
    ardoise: function (s) {
      tirer(s, 22, 'sg-poussiere', function (p) {
        p.style.left = aleatoire(0, 100) + '%'; p.style.top = aleatoire(-10, 90) + '%';
        p.style.setProperty('--sg-taille', aleatoire(2, 5).toFixed(1) + 'px');
        p.style.animationDuration = aleatoire(14, 30).toFixed(1) + 's';
        p.style.animationDelay = (-aleatoire(0, 30)).toFixed(1) + 's';
      });
    },
    studio: function (s) { s.append(el('div', 'sg-grille-points'), el('div', 'sg-projecteur')); },
    pure: function (s) { tirer(s, 12, 'sg-colonne', function (c, i) { c.style.left = (i / 12 * 100) + '%'; c.style.animationDelay = (i * 0.05) + 's'; }); },
    nuit: function (s) {
      s.append(el('div', 'sg-aurore'));
      tirer(s, 120, 'sg-etoile', function (e) {
        e.style.left = aleatoire(0, 100) + '%'; e.style.top = aleatoire(0, 100) + '%';
        var t = Math.random(); e.style.setProperty('--sg-taille', (t > 0.92 ? 3 : t > 0.7 ? 2 : 1) + 'px');
        e.style.animationDuration = aleatoire(2.5, 7).toFixed(1) + 's';
        e.style.animationDelay = (-aleatoire(0, 7)).toFixed(1) + 's';
      });
      tirer(s, 2, 'sg-filante', function (f, i) { f.style.top = (8 + i * 22) + '%'; f.style.animationDelay = (4 + i * 9) + 's'; });
    },
    yohali: function (s) { s.append(el('div', 'sg-soleil'), el('div', 'sg-wax')); },
    elan: function (s) {
      s.append(el('div', 'sg-soleil-levant'));
      tirer(s, 9, 'sg-trainee', function (t) {
        t.style.top = aleatoire(5, 95) + '%'; t.style.width = aleatoire(80, 260) + 'px';
        t.style.animationDuration = aleatoire(5, 11).toFixed(1) + 's'; t.style.animationDelay = (-aleatoire(0, 11)).toFixed(1) + 's';
      });
    },
    perspective: function (s) {
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 1000 600'); svg.setAttribute('preserveAspectRatio', 'none'); svg.classList.add('sg-plan');
      var fuite = { x: 760, y: 120 }, bords = [], k;
      for (k = 0; k <= 4; k++) bords.push([0, k * 150]);
      for (k = 1; k <= 8; k++) bords.push([k * 125, 600]);
      for (k = 3; k >= 1; k--) bords.push([1000, k * 150]);
      bords.forEach(function (b, i) {
        var l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', fuite.x); l.setAttribute('y1', fuite.y); l.setAttribute('x2', b[0]); l.setAttribute('y2', b[1]);
        l.style.animationDelay = (i * 0.06) + 's';
        svg.append(l);
      });
      for (var j = 1; j <= 5; j++) {
        var h = document.createElementNS(NS, 'line');
        var y = fuite.y + Math.pow(j / 5, 1.8) * (600 - fuite.y);
        h.setAttribute('x1', 0); h.setAttribute('x2', 1000); h.setAttribute('y1', y); h.setAttribute('y2', y);
        h.style.animationDelay = (1 + j * 0.1) + 's';
        svg.append(h);
      }
      s.append(svg);
    },
    recre: function (s) {
      ['★', '✿', '☁', '✎', '♪', '✶'].forEach(function (g, i) {
        var d = el('span', 'sg-gribouillis', g);
        d.style.left = [4, 92, 8, 88, 50, 70][i] + '%'; d.style.top = [18, 30, 70, 82, 92, 8][i] + '%';
        d.style.animationDelay = (i * 0.7) + 's';
        s.append(d);
      });
    },
    nexus: function (s) {
      s.append(el('div', 'sg-maillage'), el('div', 'sg-balayage'));
      tirer(s, 10, 'sg-impulsion', function (p, i) {
        var horizontale = i % 2 === 0; p.classList.add(horizontale ? 'sg-h' : 'sg-v');
        p.style[horizontale ? 'top' : 'left'] = (Math.round(aleatoire(1, 20)) * 5) + '%';
        p.style.animationDuration = aleatoire(4, 9).toFixed(1) + 's'; p.style.animationDelay = (-aleatoire(0, 9)).toFixed(1) + 's';
      });
    },
    orbite: function (s) {
      [1, 2, 3].forEach(function (i) {
        var anneau = el('div', 'sg-anneau sg-anneau-' + i); anneau.append(el('i', 'sg-satellite')); s.append(anneau);
      });
    },
    pro: function (s) { s.append(el('div', 'sg-quadrillage'), el('div', 'sg-radar')); },
    savane: function (s) {
      s.append(el('div', 'sg-soleil-couchant'), el('div', 'sg-acacias'));
      tirer(s, 4, 'sg-oiseau', function (o, i) {
        o.style.top = (10 + i * 7) + '%'; o.style.animationDuration = (34 + i * 9) + 's'; o.style.animationDelay = (-i * 11) + 's';
        o.style.setProperty('--sg-echelle', (1 - i * 0.15).toFixed(2));
      });
      tirer(s, 14, 'sg-herbe', function (h, i) { h.style.left = (i / 14 * 100 + aleatoire(0, 5)) + '%'; h.style.animationDelay = (-aleatoire(0, 4)).toFixed(1) + 's'; h.style.height = aleatoire(18, 38).toFixed(0) + 'px'; });
    },
    fluide: null, /* le lagon de verre liquide est dessiné par theme-fluide.js */
    vibra: function (s) { var c = el('canvas', 'sg-constellation'); s.append(c); constellation(c); }
  };

  /* Constellation de Vibra : quarante points d'or qui se relient quand ils
     se frôlent. Une seule boucle, suspendue hors écran et sous « calme ». */
  function constellation(canvas) {
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    var pts = [], w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function taille() { w = canvas.clientWidth; h = canvas.clientHeight; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function dessiner() {
      if (!canvas.isConnected) return;
      requestAnimationFrame(dessiner);
      if (document.hidden || theme() !== 'vibra') return;
      // Mesuré ici : au moment de sa création, le canevas n'est pas encore dans la page.
      if (canvas.clientWidth !== w || canvas.clientHeight !== h) taille();
      if (!w || !h) return;
      while (pts.length < 42) pts.push({ x: Math.random() * w, y: Math.random() * h, vx: aleatoire(-0.18, 0.18), vy: aleatoire(-0.18, 0.18), r: aleatoire(0.8, 2.2) });
      ctx.clearRect(0, 0, w, h);
      for (var a = 0; a < pts.length; a++) {
        var p = pts[a];
        if (!calme.matches) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; }
        for (var b = a + 1; b < pts.length; b++) {
          var q = pts[b], dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy;
          if (d < 19000) { ctx.strokeStyle = 'rgba(201,160,90,' + (0.28 * (1 - d / 19000)).toFixed(3) + ')'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
        }
        ctx.fillStyle = 'rgba(231,196,128,.75)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
    }
    requestAnimationFrame(dessiner);
  }

  function poserScene(t) {
    var ancienne = document.querySelector('.sg-scene');
    if (ancienne && ancienne.dataset.sg === t) return;
    if (ancienne) ancienne.remove();
    var f = SCENES[t];
    if (!f) return;
    var s = el('div', 'sg-scene'); s.dataset.sg = t; s.setAttribute('aria-hidden', 'true');
    f(s);
    document.body.prepend(s);
  }

  /* ------------------------------------------------------------------------
     4. Les widgets des pages d'accueil
     ------------------------------------------------------------------------ */
  function carte(t, titre, sousTitre) {
    var w = el('section', 'sg-widget sg-w-' + t); w.setAttribute('aria-label', titre);
    var tete = el('header', 'sg-w-tete'); tete.append(el('h2', 'sg-w-titre', titre));
    if (sousTitre) tete.append(el('p', 'sg-w-sous', sousTitre));
    w.append(tete);
    return w;
  }
  function bouton(texte, cls) { var b = el('button', 'sg-w-bouton' + (cls ? ' ' + cls : ''), texte); b.type = 'button'; return b; }

  var PROVERBES = [
    'Petit à petit, l’oiseau fait son nid.',
    'C’est en forgeant qu’on devient forgeron.',
    'Le savoir est la seule richesse qu’on ne peut voler.',
    'Qui veut aller loin ménage sa monture.',
    'Un enfant qui lit sera un adulte qui pense.',
    'L’arbre qui tombe fait plus de bruit que la forêt qui pousse.',
    'Apprendre, c’est découvrir ce que l’on sait déjà.',
    'Ce que l’on conçoit bien s’énonce clairement.',
    'La patience est amère, mais son fruit est doux.',
    'Seul on va plus vite, ensemble on va plus loin.',
    'L’éducation est l’arme la plus puissante pour changer le monde.',
    'Le bâton qui est dans l’eau ne craint pas le feu… l’école non plus ne craint pas l’effort.'
  ];
  function jourDeLAnnee(d) { var debut = new Date(d.getFullYear(), 0, 0); return Math.floor((d - debut) / 86400000); }
  function semaineIso(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); var j = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - j); var a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - a) / 86400000 + 1) / 7); }
  function anneeScolaire(d) {
    var debut = new Date(d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1, 8, 1);
    var fin = new Date(debut.getFullYear() + 1, 6, 2);
    return Math.max(0, Math.min(1, (d - debut) / (fin - debut)));
  }
  function journeeScolaire(d) { var m = d.getHours() * 60 + d.getMinutes(); return Math.max(0, Math.min(1, (m - 7 * 60) / (10 * 60))); }

  var WIDGETS = {
    /* Le mot du jour, écrit à la craie ; l'éponge l'efface et en écrit un autre. */
    ardoise: function () {
      var w = carte('ardoise', 'Le mot du jour', 'Écrit à la craie, effacé ce soir.');
      var tableau = el('div', 'sg-tableau'), texte = el('p', 'sg-craie');
      texte.setAttribute('aria-live', 'polite');
      var rebord = el('div', 'sg-rebord'); rebord.append(el('span', 'sg-baton'), el('span', 'sg-brosse'));
      var effacer = bouton('Effacer le tableau');
      var index = jourDeLAnnee(new Date()) % PROVERBES.length;
      function ecrireCraie(phrase) {
        texte.textContent = phrase;
        texte.style.setProperty('--sg-lettres', phrase.length);
        texte.classList.remove('sg-ecrit'); void texte.offsetWidth; texte.classList.add('sg-ecrit');
      }
      effacer.onclick = function () {
        tableau.classList.add('sg-efface');
        setTimeout(function () { tableau.classList.remove('sg-efface'); index = (index + 1) % PROVERBES.length; ecrireCraie(PROVERBES[index]); }, calme.matches ? 0 : 650);
      };
      tableau.append(texte, rebord);
      w.append(tableau, effacer);
      ecrireCraie(PROVERBES[index]);
      return w;
    },

    /* Session de concentration de 25 minutes, mémorisée sur cet appareil. */
    studio: function () {
      var w = carte('studio', 'Session de concentration', 'Vingt-cinq minutes, un seul sujet.');
      var DUREE = 25 * 60;
      var etat = lire('focus', { fin: 0, reste: DUREE });
      var anneau = el('div', 'sg-anneau-focus'), temps = el('strong', 'sg-focus-temps'), libelle = el('span', 'sg-focus-libelle');
      anneau.append(temps, libelle);
      var lancer = bouton('Démarrer', 'sg-principal'), remise = bouton('Remettre à zéro');
      var actions = el('div', 'sg-w-actions'); actions.append(lancer, remise);
      function restant() { return etat.fin ? Math.max(0, Math.round((etat.fin - Date.now()) / 1000)) : etat.reste; }
      function rendu() {
        if (!w.isConnected) return false;
        var r = restant();
        if (etat.fin && r === 0) { etat = { fin: 0, reste: DUREE }; ecrire('focus', etat); w.classList.add('sg-termine'); libelle.textContent = 'Bravo, pause méritée'; }
        temps.textContent = String(Math.floor(r / 60)).padStart(2, '0') + ':' + String(r % 60).padStart(2, '0');
        anneau.style.setProperty('--sg-avance', ((1 - r / DUREE) * 360).toFixed(1) + 'deg');
        if (!w.classList.contains('sg-termine')) libelle.textContent = etat.fin ? 'Concentration en cours' : (r < DUREE ? 'En pause' : 'Prêt');
        lancer.textContent = etat.fin ? 'Pause' : (r < DUREE ? 'Reprendre' : 'Démarrer');
        w.classList.toggle('sg-actif', !!etat.fin);
      }
      lancer.onclick = function () {
        w.classList.remove('sg-termine');
        etat = etat.fin ? { fin: 0, reste: restant() } : { fin: Date.now() + restant() * 1000, reste: 0 };
        ecrire('focus', etat); rendu();
      };
      remise.onclick = function () { w.classList.remove('sg-termine'); etat = { fin: 0, reste: DUREE }; ecrire('focus', etat); rendu(); };
      w.append(anneau, actions);
      chaqueSeconde(rendu);
      return w;
    },

    /* Calendrier typographique : jour, semaine, avancée de l'année. */
    pure: function () {
      var w = carte('pure', 'Registre du jour');
      var grand = el('div', 'sg-jour-grand'), meta = el('div', 'sg-jour-meta'), barres = el('div', 'sg-barres');
      function ligne(nom) { var l = el('div', 'sg-barre'), lib = el('span', 'sg-barre-lib', nom), v = el('span', 'sg-barre-val'), piste = el('i'); l.append(lib, v, piste); barres.append(l); return { v: v, piste: piste }; }
      var annee = ligne('Année civile'), scolaire = ligne('Année scolaire'), journee = ligne('Journée de classe');
      function rendu() {
        if (!w.isConnected) return false;
        var d = new Date();
        grand.textContent = String(d.getDate()).padStart(2, '0');
        meta.replaceChildren(el('strong', '', new Intl.DateTimeFormat('fr', { weekday: 'long' }).format(d)), el('span', '', new Intl.DateTimeFormat('fr', { month: 'long', year: 'numeric' }).format(d)), el('span', 'sg-mono', 'Semaine ' + semaineIso(d) + ' · jour ' + jourDeLAnnee(d)));
        [[annee, jourDeLAnnee(d) / 365], [scolaire, anneeScolaire(d)], [journee, journeeScolaire(d)]].forEach(function (x) {
          x[0].v.textContent = Math.round(x[1] * 100) + ' %'; x[0].piste.style.setProperty('--sg-part', (x[1] * 100).toFixed(1) + '%');
        });
      }
      var corps = el('div', 'sg-registre'); var gauche = el('div'); gauche.append(grand, meta); corps.append(gauche, barres);
      w.append(corps);
      chaqueSeconde(function () { if (new Date().getSeconds() === 0 || !grand.textContent) return rendu(); return w.isConnected ? undefined : false; });
      return w;
    },

    /* Le ciel de ce soir : la vraie phase de la Lune. */
    nuit: function () {
      var w = carte('nuit', 'Le ciel de ce soir');
      var lune = el('div', 'sg-lune');
      var dessin = document.createElementNS(NS, 'svg'); dessin.setAttribute('viewBox', '0 0 100 100'); dessin.setAttribute('aria-hidden', 'true');
      var fondLune = document.createElementNS(NS, 'circle'); fondLune.setAttribute('cx', 50); fondLune.setAttribute('cy', 50); fondLune.setAttribute('r', 48); fondLune.setAttribute('class', 'sg-lune-nuit');
      var lumiere = document.createElementNS(NS, 'path'); lumiere.setAttribute('class', 'sg-lune-jour');
      dessin.append(fondLune, lumiere); lune.append(dessin);
      var info = el('div', 'sg-lune-info'), nom = el('strong'), detail = el('span'), salut = el('p', 'sg-salut');
      info.append(nom, detail);
      var ligne = el('div', 'sg-ciel'); ligne.append(lune, info);
      w.append(salut, ligne);
      var PHASES = ['Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Lune gibbeuse croissante', 'Pleine lune', 'Lune gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant'];
      function rendu() {
        if (!w.isConnected) return false;
        var d = new Date();
        var cycle = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
        var age = (((d - ref) / 86400000) % cycle + cycle) % cycle, f = age / cycle;
        var eclaire = (1 - Math.cos(f * 2 * Math.PI)) / 2;
        nom.textContent = PHASES[Math.round(f * 8) % 8];
        detail.textContent = Math.round(eclaire * 100) + ' % éclairée · ' + Math.floor(age) + 'ᵉ jour du cycle';
        /* Partie éclairée : un demi-disque du côté du Soleil (droite quand
           elle croît, gauche quand elle décroît) fermé par le terminateur,
           une demi-ellipse de largeur r·|cos(2πf)|. */
        var k = Math.cos(f * 2 * Math.PI), rx = (48 * Math.abs(k)).toFixed(2), croit = f < 0.5;
        var bord = croit ? 'A48 48 0 0 1 50 98' : 'A48 48 0 0 0 50 98';
        var terminateur = croit ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0);
        lumiere.setAttribute('d', 'M50 2 ' + bord + ' A' + rx + ' 48 0 0 ' + terminateur + ' 50 2 Z');
        var h = d.getHours();
        salut.textContent = h < 5 ? 'Il est tard : pensez à vous reposer.' : h < 12 ? 'Bonne matinée, le ciel s’est éclairci.' : h < 18 ? 'Bel après-midi ; les étoiles attendent le soir.' : 'Bonne soirée sous les étoiles.';
      }
      chaqueSeconde(function () { return w.isConnected ? (new Date().getSeconds() === 0 || !nom.textContent ? rendu() : undefined) : false; });
      return w;
    },

    /* Teranga : « bienvenue » dans les langues des familles. */
    yohali: function () {
      var w = carte('yohali', 'Akwaba, Karibu, Bienvenue', 'L’accueil, dans les langues des familles.');
      var SALUTS = [['Bienvenue', 'français'], ['Boyei malamu', 'lingala'], ['Karibu', 'swahili'], ['Dalal ak jàmm', 'wolof'], ['Akwaaba', 'twi'], ['Ẹ kú àbọ̀', 'yoruba'], ['Wamukelekile', 'zoulou'], ['Murakaza neza', 'kinyarwanda'], ['Welcome', 'anglais'], ['Marhaban', 'arabe']];
      var scene = el('div', 'sg-salut-scene'), mot = el('p', 'sg-salut-mot'), langue = el('p', 'sg-salut-langue');
      mot.setAttribute('aria-live', 'polite');
      scene.append(mot, langue);
      var i = Math.floor(Math.random() * SALUTS.length), n = 0;
      function suivant() { mot.classList.remove('sg-entre'); void mot.offsetWidth; mot.textContent = SALUTS[i][0]; langue.textContent = 'en ' + SALUTS[i][1]; mot.classList.add('sg-entre'); i = (i + 1) % SALUTS.length; }
      w.append(scene, el('div', 'sg-frise'));
      suivant();
      chaqueSeconde(function () { if (!w.isConnected) return false; if (++n % 4 === 0) suivant(); });
      return w;
    },

    /* L'élan : trois victoires du jour, une gerbe quand tout est coché. */
    elan: function () {
      var w = carte('elan', 'Mes trois victoires du jour', 'Notez-les ce matin, cochez-les ce soir.');
      var etat = lire('victoires', null);
      if (!etat || etat.jour !== aujourdhui()) etat = { jour: aujourdhui(), items: [{ t: '', ok: false }, { t: '', ok: false }, { t: '', ok: false }] };
      var jauge = el('div', 'sg-jauge'), chiffre = el('strong', 'sg-jauge-chiffre'); jauge.append(chiffre);
      var liste = el('ul', 'sg-victoires');
      var EXEMPLES = ['Faire l’appel', 'Valider les notes', 'Rappeler une famille'];
      function sauver() { ecrire('victoires', etat); compter(); }
      function compter() {
        var fait = etat.items.filter(function (x) { return x.ok; }).length;
        chiffre.textContent = fait + '/3';
        jauge.style.setProperty('--sg-part', (fait / 3 * 100) + '%');
        var bravo = fait === 3;
        if (bravo && !w.classList.contains('sg-bravo')) gerbe(jauge);
        w.classList.toggle('sg-bravo', bravo);
      }
      etat.items.forEach(function (it, i) {
        var li = el('li'), id = 'sg-v-' + i, c = el('input'), champ = el('input');
        c.type = 'checkbox'; c.id = id; c.checked = it.ok; c.setAttribute('aria-label', 'Victoire ' + (i + 1) + ' accomplie');
        champ.type = 'text'; champ.value = it.t; champ.placeholder = EXEMPLES[i]; champ.maxLength = 60; champ.setAttribute('aria-label', 'Victoire ' + (i + 1));
        c.onchange = function () { it.ok = c.checked; li.classList.toggle('sg-coche', it.ok); sauver(); };
        champ.oninput = function () { it.t = champ.value; ecrire('victoires', etat); };
        li.classList.toggle('sg-coche', it.ok);
        li.append(c, champ); liste.append(li);
      });
      var corps = el('div', 'sg-elan-corps'); corps.append(jauge, liste);
      w.append(corps);
      compter();
      return w;
    },

    /* Le plan de la journée : un relevé d'architecte de 7 h à 18 h. */
    perspective: function () {
      var w = carte('perspective', 'Plan de la journée', 'Relevé au trait, de 7 h à 18 h.');
      var plan = el('div', 'sg-releve');
      for (var h = 7; h <= 18; h++) { var g = el('span', 'sg-graduation' + (h % 3 === 0 ? ' sg-forte' : '')); g.style.left = ((h - 7) / 11 * 100) + '%'; if (h % 3 === 0 || h === 7 || h === 18) g.dataset.h = h + ' h'; plan.append(g); }
      [['Matin', 0, 5 / 11], ['Midi', 5 / 11, 7 / 11], ['Après-midi', 7 / 11, 1]].forEach(function (z) { var b = el('span', 'sg-zone', z[0]); b.style.left = z[1] * 100 + '%'; b.style.width = (z[2] - z[1]) * 100 + '%'; plan.append(b); });
      var repere = el('i', 'sg-repere'), cote = el('span', 'sg-cote'); repere.append(cote); plan.append(repere);
      var note = el('p', 'sg-w-note');
      w.append(plan, note);
      function rendu() {
        if (!w.isConnected) return false;
        var d = new Date(), m = d.getHours() * 60 + d.getMinutes(), p = (m - 420) / 660;
        repere.style.left = (Math.max(0, Math.min(1, p)) * 100).toFixed(2) + '%';
        repere.hidden = p < 0 || p > 1;
        cote.textContent = heure(d);
        note.textContent = p < 0 ? 'Le chantier ouvre à 7 h.' : p > 1 ? 'Journée bouclée : le plan est rangé.' : 'Il reste ' + Math.floor((660 - (m - 420)) / 60) + ' h ' + String((660 - (m - 420)) % 60).padStart(2, '0') + ' de journée.';
      }
      chaqueSeconde(function () { return w.isConnected ? (new Date().getSeconds() === 0 || !note.textContent ? rendu() : undefined) : false; });
      return w;
    },

    /* La récré : un post-it et un avion en papier. */
    recre: function () {
      var w = carte('recre', 'Mon post-it');
      var postit = el('div', 'sg-postit'); postit.append(el('span', 'sg-scotch'));
      var zone = el('textarea'); zone.maxLength = 280; zone.rows = 4; zone.placeholder = 'Une idée, un rappel, un mot doux…'; zone.setAttribute('aria-label', 'Mon post-it'); zone.value = lire('postit', '');
      var minuterie; zone.oninput = function () { clearTimeout(minuterie); minuterie = setTimeout(function () { ecrire('postit', zone.value); }, 300); };
      postit.append(zone);
      var avion = bouton('✈ Lancer un avion en papier');
      avion.onclick = function () { lancerAvion(); };
      w.append(postit, avion);
      return w;
    },

    /* La console du réseau : état réel de la connexion et de la page. */
    nexus: function () {
      var w = carte('nexus', 'Console');
      var ecran = el('pre', 'sg-console'); ecran.setAttribute('aria-live', 'off');
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      var chargement = nav ? Math.round(nav.loadEventEnd || nav.domContentLoadedEventEnd || 0) : 0;
      var titre = (document.querySelector('.entete-page h1') || {}).textContent || document.title;
      var lignes = [
        '> nexus.connecter()',
        function () { return navigator.onLine ? '✓ réseau en ligne' : '✗ hors ligne — les saisies attendent'; },
        function () { return '◷ ' + heure(new Date(), true); },
        '▸ écran : ' + String(titre).trim().slice(0, 34),
        chargement ? '▸ chargé en ' + chargement + ' ms' : '▸ chargement mesuré indisponible',
        '> _'
      ];
      var tape = 0;
      function rendu() {
        if (!w.isConnected) return false;
        var texte = lignes.map(function (l) { return typeof l === 'function' ? l() : l; }).join('\n');
        if (!calme.matches && tape < texte.length) { tape = Math.min(texte.length, tape + 40); texte = texte.slice(0, tape); }
        ecran.textContent = texte;
      }
      w.append(ecran);
      chaqueSeconde(rendu);
      return w;
    },

    /* La course du soleil, de 6 h à 18 h. */
    orbite: function () {
      var w = carte('orbite', 'Course du soleil');
      var arc = el('div', 'sg-arc'), astre = el('i', 'sg-astre'); arc.append(astre, el('span', 'sg-arc-lever', '6 h'), el('span', 'sg-arc-coucher', '18 h'));
      var note = el('p', 'sg-w-note');
      w.append(arc, note);
      function rendu() {
        if (!w.isConnected) return false;
        var d = new Date(), m = d.getHours() * 60 + d.getMinutes();
        var jour = m >= 360 && m <= 1080, p = jour ? (m - 360) / 720 : ((m < 360 ? m + 1440 : m) - 1080) / 720;
        var a = Math.PI * (1 - p);
        astre.style.left = (50 + Math.cos(a) * 46).toFixed(2) + '%';
        astre.style.top = (92 - Math.sin(a) * 80).toFixed(2) + '%';
        w.classList.toggle('sg-nocturne', !jour);
        note.textContent = (jour ? 'Le soleil a parcouru ' + Math.round(p * 100) + ' % de sa course.' : 'La lune a pris le relais.') + ' Il est ' + heure(d) + '.';
      }
      chaqueSeconde(function () { return w.isConnected ? (new Date().getSeconds() === 0 || !note.textContent ? rendu() : undefined) : false; });
      return w;
    },

    /* Le verre se remplit au fil de la journée de classe. */
    fluide: function () {
      var w = carte('fluide', 'La journée se remplit');
      var verre = el('div', 'sg-verre'), eau = el('div', 'sg-eau'), part = el('strong', 'sg-verre-part');
      eau.append(el('i', 'sg-vague'), el('i', 'sg-vague sg-vague-2'));
      verre.append(eau, part);
      var note = el('p', 'sg-w-note');
      w.append(verre, note);
      function rendu() {
        if (!w.isConnected) return false;
        var d = new Date(), p = journeeScolaire(d);
        eau.style.setProperty('--sg-niveau', (p * 100).toFixed(1) + '%');
        part.textContent = Math.round(p * 100) + ' %';
        note.textContent = p <= 0 ? 'La journée commence à 7 h : le verre est encore vide.' : p >= 1 ? 'Journée pleine. Bonne soirée !' : 'De 7 h à 17 h, la journée de classe se remplit goutte à goutte.';
      }
      chaqueSeconde(function () { return w.isConnected ? (new Date().getSeconds() === 0 || !note.textContent ? rendu() : undefined) : false; });
      return w;
    },

    /* Le pouls de l'école : les compteurs réels du tableau de bord. */
    vibra: function () {
      var w = carte('vibra', 'Pouls de l’école');
      var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 300 60'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('sg-ecg');
      var trace = document.createElementNS(NS, 'path');
      trace.setAttribute('d', 'M0 30 H60 L70 30 L78 12 L86 48 L94 4 L102 56 L110 30 H170 L178 22 L186 38 L194 30 H300');
      svg.append(trace);
      var mesures = el('ul', 'sg-mesures');
      w.append(svg, mesures);
      function lireStat(id, nom) { var n = document.getElementById(id); var v = n && n.textContent.trim(); return v && /\d/.test(v) && v !== '–' ? [v, nom] : null; }
      function rendu() {
        if (!w.isConnected) return false;
        var donnees = [lireStat('stat-eleves', 'élèves'), lireStat('stat-profs', 'professeurs'), lireStat('stat-classes', 'classes')].filter(Boolean);
        var sig = donnees.map(function (d) { return d.join(' '); }).join('|');
        if (mesures.dataset.sig === sig) return;
        mesures.dataset.sig = sig; mesures.replaceChildren();
        if (!donnees.length) { mesures.append(el('li', 'sg-muet', 'Le campus s’éveille.')); return; }
        donnees.forEach(function (d) { var li = el('li'); li.append(el('strong', '', d[0]), el('span', '', d[1])); mesures.append(li); });
      }
      chaqueSeconde(rendu);
      return w;
    },

    /* Indicateurs clés : des rapports calculés à partir des compteurs que
       l'écran affiche déjà. Rien n'est demandé au serveur, rien n'est inventé ;
       un indicateur dont les compteurs manquent n'est pas affiché. */
    pro: function () {
      var w = carte('pro', 'Indicateurs clés', 'Calculés en direct depuis les compteurs de cet écran.');
      var grille = el('div', 'sg-pro-grille');
      var note = el('p', 'sg-w-note');
      w.append(grille, note);
      function nombre(id) { var n = document.getElementById(id); var v = n && n.textContent.replace(/[\s\u202f]/g, '').replace(',', '.'); var m = v && v.match(/^-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; }
      var fmt = new Intl.NumberFormat('fr', { maximumFractionDigits: 1 });
      function rendu() {
        if (!w.isConnected) return false;
        var e = nombre('stat-eleves'), p = nombre('stat-profs'), c = nombre('stat-classes'), r = nombre('stat-impayes'), m = nombre('stat-reussite');
        var kpi = [];
        if (e && c) kpi.push(['Élèves par classe', fmt.format(e / c), Math.min(1, e / c / 45), e / c > 40 ? 'alerte' : '']);
        if (e && p) kpi.push(['Élèves par professeur', fmt.format(e / p), Math.min(1, e / p / 40), e / p > 35 ? 'alerte' : '']);
        if (e && r !== null) kpi.push(['Retards de paiement', fmt.format(r / e * 100) + ' %', Math.min(1, r / e), r / e > 0.15 ? 'alerte' : '']);
        if (m !== null) kpi.push(['Moyenne générale', fmt.format(m) + ' %', Math.min(1, m / 100), m < 50 ? 'alerte' : '']);
        var sig = JSON.stringify(kpi);
        if (grille.dataset.sig === sig) return;
        grille.dataset.sig = sig; grille.replaceChildren();
        kpi.forEach(function (k) {
          var t = el('div', 'sg-pro-kpi' + (k[3] ? ' sg-pro-alerte' : '')), barre = el('i', 'sg-pro-barre');
          barre.style.setProperty('--sg-part', (k[2] * 100).toFixed(1) + '%');
          t.append(el('span', 'sg-pro-lib', k[0]), el('strong', 'sg-pro-valeur', k[1]), barre);
          grille.append(t);
        });
        note.textContent = kpi.length ? 'Mise à jour ' + heure(new Date(), true) + ' · un liseré rouge signale un seuil dépassé.' : 'Les indicateurs apparaissent dès que les compteurs de l’écran sont chargés.';
      }
      chaqueSeconde(rendu);
      return w;
    },

    /* La marche de la semaine : chaque jour passé laisse une empreinte, le
       soleil marque aujourd'hui et les événements de l'écran se posent sur
       leur jour. */
    savane: function () {
      var w = carte('savane', 'La marche de la semaine', 'Chaque jour laisse son empreinte sur la piste.');
      var piste = el('ol', 'sg-piste'), note = el('p', 'sg-w-note');
      w.append(piste, note);
      var MOIS = { janv: 0, 'févr': 1, fevr: 1, mars: 2, avr: 3, mai: 4, juin: 5, juil: 6, 'août': 7, aout: 7, sept: 8, oct: 9, nov: 10, 'déc': 11, dec: 11 };
      function evenements(lundi) {
        var parJour = {}, src = document.getElementById('liste-evenements');
        if (!src) return parJour;
        Array.from(src.children).forEach(function (li) {
          var t = li.textContent.replace(/\s+/g, ' ').trim(), m = t.match(/(\d{1,2})\s+(janv|févr|fevr|mars|avr|mai|juin|juil|août|aout|sept|oct|nov|déc|dec)/i);
          if (!m) return;
          var d = new Date(lundi.getFullYear(), MOIS[m[2].toLowerCase()], +m[1]);
          if (d < lundi - 180 * 86400000) d.setFullYear(d.getFullYear() + 1);
          var i = Math.round((d - lundi) / 86400000);
          if (i >= 0 && i < 7) (parJour[i] = parJour[i] || []).push(t.replace(m[0], '').replace(/^[\s.·—-]+/, '').slice(0, 60));
        });
        return parJour;
      }
      function rendu() {
        if (!w.isConnected) return false;
        var d = new Date(), j = (d.getDay() + 6) % 7, lundi = new Date(d.getFullYear(), d.getMonth(), d.getDate() - j);
        var ev = evenements(lundi), sig = j + JSON.stringify(ev);
        if (piste.dataset.sig === sig) return;
        piste.dataset.sig = sig; piste.replaceChildren();
        ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach(function (nom, i) {
          var li = el('li', 'sg-jour' + (i < j ? ' sg-passe' : i === j ? ' sg-aujourdhui' : '') + (i > 4 ? ' sg-repos' : ''));
          var date = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i);
          li.append(el('span', 'sg-trace'), el('span', 'sg-jour-nom', nom), el('span', 'sg-jour-num', String(date.getDate())));
          if (ev[i]) { li.classList.add('sg-evenement'); li.title = ev[i].join(' · '); li.setAttribute('aria-label', nom + ' ' + date.getDate() + ' : ' + ev[i].join(', ')); }
          piste.append(li);
        });
        var nbEv = Object.keys(ev).reduce(function (n, k) { return n + ev[k].length; }, 0);
        note.textContent = (j < 5 ? (j === 4 ? 'Dernier jour de classe de la semaine.' : (4 - j) + ' jour' + (4 - j > 1 ? 's' : '') + ' de classe avant le week-end.') : 'C’est le week-end : la savane se repose.') + (nbEv ? ' ' + nbEv + ' événement' + (nbEv > 1 ? 's' : '') + ' cette semaine.' : '');
      }
      chaqueSeconde(rendu);
      return w;
    }
  };

  /* Où poser le widget : dans la colonne de l'apparence quand elle en a une,
     sinon dans un bandeau « récit » au-dessus des compteurs. */
  var ANCRES = {
    fluide: ['.fl-aside', 'append'], vibra: ['.vb-aside', 'append'], orbite: ['.ob-aside', 'append'],
    nexus: ['.nx-main', 'append'], elan: ['.elan-aside', 'second'], perspective: ['.perspective-aside', 'second'], recre: ['.recre-aside', 'second']
  };
  function poserWidget(t, essai) {
    document.querySelectorAll('.sg-widget,.sg-bandeau').forEach(function (n) { if (!n.classList.contains('sg-w-' + t) && !(n.classList.contains('sg-bandeau') && n.dataset.sg === t)) n.remove(); });
    if (!accueil || admin || !WIDGETS[t]) return;
    if (document.querySelector('.sg-w-' + t)) return;
    var contenu = document.querySelector('.mise-en-page > .contenu');
    if (!contenu) return;
    var ancre = ANCRES[t], cible = ancre && document.querySelector(ancre[0]);
    if (ancre && !cible) {
      // La coque de l'apparence n'est pas encore construite : on réessaie.
      if ((essai || 0) < 30) setTimeout(function () { if (theme() === t) poserWidget(t, (essai || 0) + 1); }, 100);
      return;
    }
    var w = WIDGETS[t]();
    if (ancre) {
      if (ancre[1] === 'second' && cible.firstElementChild) cible.firstElementChild.after(w); else cible.append(w);
      return;
    }
    var r = RECITS[t], bandeau = el('section', 'sg-bandeau'); bandeau.dataset.sg = t; bandeau.setAttribute('aria-label', r.titre);
    var recit = el('div', 'sg-bandeau-recit');
    recit.append(el('p', 'sg-bandeau-sur', 'Apparence · ' + r.titre), el('p', 'sg-bandeau-devise', r.devise), el('p', 'sg-bandeau-texte', r.recit));
    bandeau.append(recit, w);
    var stats = contenu.querySelector(':scope > .grille-stats'), entete = contenu.querySelector(':scope > .entete-page');
    if (stats) stats.before(bandeau); else if (entete) entete.after(bandeau); else contenu.prepend(bandeau);
  }

  /* ------------------------------------------------------------------------
     5. Gestes : entrée des cartes, pointeur, clic
     ------------------------------------------------------------------------ */
  var CARTES = '.carte-stat,.panneau,.widget,.carte-section,.carte-config,.carte-cours,.carte-recap,.sg-widget,.sa-carte,.sa-panneau';
  function entree() {
    if (calme.matches) return;
    var i = 0;
    document.querySelectorAll(CARTES).forEach(function (c) {
      if (i > 14) return;
      var r = c.getBoundingClientRect();
      if (!r.width || r.top > innerHeight) return;
      c.style.setProperty('--sg-i', i++);
      c.classList.remove('sg-entre'); void c.offsetWidth; c.classList.add('sg-entre');
    });
    setTimeout(function () { document.querySelectorAll('.sg-entre').forEach(function (c) { c.classList.remove('sg-entre'); }); }, 1800);
  }

  var POINTEUR = { studio: 1, perspective: 1, vibra: 1, nexus: 1 };
  var survol = null, attente = false, dernier = null;
  document.addEventListener('pointermove', function (e) {
    var t = theme();
    if (t === 'studio' || t === 'nuit') { html.style.setProperty('--sg-px', e.clientX + 'px'); html.style.setProperty('--sg-py', e.clientY + 'px'); }
    if (!POINTEUR[t] || e.pointerType === 'touch') return;
    dernier = e; if (attente) return; attente = true;
    requestAnimationFrame(function () {
      attente = false;
      var c = dernier.target && dernier.target.closest ? dernier.target.closest(CARTES) : null;
      if (survol && survol !== c) { ['--sg-x', '--sg-y', '--sg-rx', '--sg-ry'].forEach(function (p) { survol.style.removeProperty(p); }); }
      survol = c; if (!c) return;
      var r = c.getBoundingClientRect(); if (!r.width) return;
      var x = (dernier.clientX - r.left) / r.width, y = (dernier.clientY - r.top) / r.height;
      c.style.setProperty('--sg-x', (x * 100).toFixed(1) + '%'); c.style.setProperty('--sg-y', (y * 100).toFixed(1) + '%');
      if (t === 'perspective' && !calme.matches) { c.style.setProperty('--sg-rx', ((0.5 - y) * 5).toFixed(2) + 'deg'); c.style.setProperty('--sg-ry', ((x - 0.5) * 6).toFixed(2) + 'deg'); }
    });
  }, { passive: true });

  var EFFETS = { ardoise: 'poudre', fluide: 'onde', recre: 'etoiles', vibra: 'pulsation', elan: 'etincelles', nexus: 'cible', orbite: 'onde', nuit: 'etoiles', yohali: 'pulsation', perspective: 'cible', studio: 'onde', pure: 'cible', pro: 'cible', savane: 'etincelles' };
  document.addEventListener('pointerdown', function (e) {
    if (calme.matches || e.button > 0) return;
    var cible = e.target.closest && e.target.closest('button,.bouton,.nav-item,a.carte-stat,.carte-stat,[role="button"],.fl-onglet,.sg-w-bouton');
    if (!cible || cible.closest('.sg-accueil')) return;
    var type = EFFETS[theme()]; if (!type) return;
    var fx = el('span', 'sg-clic sg-clic-' + type); fx.setAttribute('aria-hidden', 'true');
    fx.style.left = e.clientX + 'px'; fx.style.top = e.clientY + 'px';
    if (type === 'poudre' || type === 'etoiles' || type === 'etincelles') {
      for (var i = 0; i < 8; i++) { var p = el('i'); p.style.setProperty('--sg-a', (i * 45 + aleatoire(-15, 15)) + 'deg'); p.style.setProperty('--sg-d', aleatoire(18, 34) + 'px'); fx.append(p); }
    }
    document.body.append(fx);
    setTimeout(function () { fx.remove(); }, 900);
  }, true);

  /* Petites joies réutilisables. */
  function gerbe(origine) {
    if (calme.matches) return;
    var r = origine.getBoundingClientRect(), fx = el('span', 'sg-gerbe'); fx.setAttribute('aria-hidden', 'true');
    fx.style.left = (r.left + r.width / 2) + 'px'; fx.style.top = (r.top + r.height / 2) + 'px';
    var couleurs = ['#2165B5', '#5CC8A8', '#FFC93C', '#F27C5C', '#7AA7FF'];
    for (var i = 0; i < 28; i++) { var p = el('i'); p.style.background = couleurs[i % couleurs.length]; p.style.setProperty('--sg-a', (i / 28 * 360) + 'deg'); p.style.setProperty('--sg-d', aleatoire(50, 110) + 'px'); p.style.animationDelay = aleatoire(0, 0.12) + 's'; fx.append(p); }
    document.body.append(fx); setTimeout(function () { fx.remove(); }, 1400);
  }
  function lancerAvion() {
    var a = el('span', 'sg-avion'); a.setAttribute('aria-hidden', 'true');
    a.innerHTML = '<svg viewBox="0 0 48 32"><path d="M2 14 46 2 30 30 22 19z" fill="#FFFFFF" stroke="#122642" stroke-width="1.6" stroke-linejoin="round"/><path d="M46 2 22 19l-2 9 6-6" fill="none" stroke="#122642" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    a.style.top = aleatoire(20, 60) + 'vh';
    document.body.append(a);
    setTimeout(function () { a.remove(); }, calme.matches ? 0 : 4200);
  }
  // Récré : un avion traverse la page de temps en temps.
  setInterval(function () { if (theme() === 'recre' && !document.hidden && !calme.matches && Math.random() < 0.35) lancerAvion(); }, 20000);

  /* Orbite : la couleur du ciel suit le moment de la journée. */
  function moment() {
    var h = new Date().getHours();
    html.setAttribute('data-sg-moment', h < 5 ? 'nuit' : h < 9 ? 'aube' : h < 17 ? 'jour' : h < 20 ? 'crepuscule' : 'nuit');
  }

  /* ------------------------------------------------------------------------
     6. Rideau de transition et annonce de l'apparence
     ------------------------------------------------------------------------ */
  var pret = false;
  function rideau(t) {
    if (!pret) return;
    document.querySelectorAll('.sg-rideau,.sg-annonce').forEach(function (n) { n.remove(); });
    var r = RECITS[t]; if (!r) return;
    if (!calme.matches) {
      var v = el('div', 'sg-rideau'); v.dataset.sg = t; v.setAttribute('aria-hidden', 'true');
      document.body.append(v); setTimeout(function () { v.remove(); }, 1300);
    }
    var nom = ((window.ARDOISE_THEMES || []).find(function (x) { return x.cle === t; }) || {}).nom || t;
    var a = el('div', 'sg-annonce'); a.dataset.sg = t; a.setAttribute('role', 'status');
    a.append(el('strong', '', nom + ' — ' + r.titre), el('span', '', r.devise));
    document.body.append(a); setTimeout(function () { a.classList.add('sg-sort'); }, 2800); setTimeout(function () { a.remove(); }, 3400);
  }

  /* ------------------------------------------------------------------------
     7. Garde-fou : la déconnexion ne doit jamais disparaître
     ------------------------------------------------------------------------ */
  function sortieVisible(b) {
    if (!b || !b.isConnected) return false;
    var r = b.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    var s = getComputedStyle(b);
    if (s.visibility === 'hidden' || parseFloat(s.opacity) < 0.3) return false;
    // Hors de l'écran, il doit au moins appartenir à un conteneur que l'on peut faire défiler.
    if (r.bottom > innerHeight + 1 || r.top < -1 || r.right > innerWidth + 1 || r.left < -1) {
      for (var p = b.parentElement; p && p !== document.body; p = p.parentElement) {
        var o = getComputedStyle(p).overflowY;
        if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return true;
      }
      return getComputedStyle(b.closest('.barre-laterale') || b).position !== 'fixed' && r.top >= 0;
    }
    // Le premier élément touché à cet endroit, en ignorant le bouton de secours lui-même.
    var pile = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).filter(function (n) { return !n.closest('#sg-sortie-secours,.sg-clic'); });
    var tete = pile[0];
    return !!tete && (tete === b || b.contains(tete) || tete.contains(b));
  }
  function verifierSortie() {
    var vrai = document.getElementById('bouton-deconnexion-nav');
    var secours = document.getElementById('sg-sortie-secours');
    var utile = !!vrai && bureau.matches && !admin && !!document.querySelector('.mise-en-page') && getComputedStyle(document.querySelector('.mise-en-page')).display !== 'none' && !sortieVisible(vrai);
    if (utile && !secours) {
      secours = el('button', 'sg-sortie-secours'); secours.id = 'sg-sortie-secours'; secours.type = 'button';
      secours.append(el('span', 'sg-sortie-icone'), el('span', '', 'Se déconnecter'));
      secours.onclick = function () { var v = document.getElementById('bouton-deconnexion-nav'); if (v) v.click(); };
      document.body.append(secours);
    } else if (!utile && secours) secours.remove();
  }

  /* ------------------------------------------------------------------------
     8. Première connexion : l'animation d'accueil
     ------------------------------------------------------------------------ */
  function accueillir() {
    var drapeau;
    try { drapeau = sessionStorage.getItem('ardoise_premiere_connexion'); } catch (e) { return; }
    if (!drapeau || admin || !document.querySelector('.mise-en-page')) return;
    var u = utilisateur();
    try { sessionStorage.removeItem('ardoise_premiere_connexion'); } catch (e) {}
    if (u.id && lire('accueil_vu', false)) return;
    ecrire('accueil_vu', true);

    var voile = el('div', 'sg-accueil'); voile.setAttribute('role', 'dialog'); voile.setAttribute('aria-modal', 'true'); voile.setAttribute('aria-label', 'Bienvenue sur Ardoise');
    voile.dataset.sg = theme();
    var halo = el('div', 'sg-accueil-halo');
    var marque = el('p', 'sg-accueil-marque');
    'Ardoise'.split('').forEach(function (c, i) {
      var l = el('span', 'sg-lettre' + (c === 'i' ? ' sg-lettre-i' : ''), c === 'i' ? 'ı' : c);
      if (c === 'i') l.append(el('span', 'sg-point'));
      l.style.setProperty('--sg-i', i); marque.append(l);
    });
    var bonjour = el('h1', 'sg-accueil-titre', 'Bienvenue sur Ardoise');
    var sous = el('p', 'sg-accueil-sous', 'Votre école est prête. Tout ce qu’il faut pour la faire vivre est à portée de main.');
    var puces = el('ul', 'sg-accueil-puces');
    ['Vos élèves', 'Vos notes', 'Vos bulletins', 'Vos familles'].forEach(function (p, i) { var li = el('li', '', p); li.style.setProperty('--sg-i', i); puces.append(li); });
    var passer = el('button', 'sg-accueil-passer', 'Passer'); passer.type = 'button';
    var commencer = el('button', 'sg-accueil-go', 'Entrer dans mon école'); commencer.type = 'button';
    var scene = el('div', 'sg-accueil-scene'); scene.append(marque, bonjour, sous, puces, commencer);
    voile.append(halo, scene, passer);
    document.body.append(voile);
    document.documentElement.classList.add('sg-accueil-ouvert');
    var precedent = document.activeElement;
    passer.focus({ preventScroll: true });

    var fini = false, minuteries = [];
    function fermer() {
      if (fini) return; fini = true;
      minuteries.forEach(clearTimeout);
      voile.classList.add('sg-accueil-fin');
      setTimeout(function () {
        voile.remove(); document.documentElement.classList.remove('sg-accueil-ouvert');
        if (precedent && precedent.focus) try { precedent.focus({ preventScroll: true }); } catch (e) {}
        entree();
      }, calme.matches ? 0 : 900);
      document.removeEventListener('keydown', clavier, true);
    }
    function clavier(e) {
      if (e.key === 'Escape') { e.preventDefault(); fermer(); }
      if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === passer ? commencer : passer).focus(); }
    }
    document.addEventListener('keydown', clavier, true);
    passer.onclick = fermer; commencer.onclick = fermer;
    requestAnimationFrame(function () { voile.classList.add('sg-accueil-joue'); });
    minuteries.push(setTimeout(function () { voile.classList.add('sg-accueil-etape-2'); }, calme.matches ? 0 : 1500));
    minuteries.push(setTimeout(fermer, calme.matches ? 6000 : 7800));

    // Le prénom, s'il arrive à temps : on n'attend jamais le serveur.
    var api = (window.ArdoiseSession && window.ArdoiseSession.appelApi) || window.appelApi;
    if (typeof api === 'function') {
      try {
        api('/utilisateurs/moi').then(function (r) { return r && r.ok ? r.json() : null; }).then(function (p) {
          var prenom = p && (p.prenom || p.nom);
          if (prenom && !fini) bonjour.textContent = 'Bienvenue, ' + String(prenom).trim() + ' !';
        }).catch(function () {});
      } catch (e) {}
    }
  }

  /* ------------------------------------------------------------------------
     9. Installation
     ------------------------------------------------------------------------ */
  function installer() {
    var t = theme();
    if (!t || t === 'public') return;
    html.setAttribute('data-sg', t);
    poserScene(t);
    poserWidget(t);
    moment();
    setTimeout(verifierSortie, 400);
    setTimeout(verifierSortie, 1600);
  }

  document.addEventListener('ardoise:theme-change', function (e) {
    var t = (e.detail && e.detail.theme) || theme();
    // Après les gestionnaires propres à chaque apparence (déplacements de nœuds).
    queueMicrotask(function () { requestAnimationFrame(function () { installer(); entree(); }); });
    rideau(t);
  });
  window.addEventListener('resize', function () { clearTimeout(verifierSortie._t); verifierSortie._t = setTimeout(verifierSortie, 250); });
  setInterval(moment, 300000);

  function demarrer() {
    installer();
    entree();
    accueillir();
    setTimeout(function () { pret = true; }, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();

  window.ArdoiseSignatures = { recits: RECITS, installer: installer, verifierSortie: verifierSortie, accueillir: accueillir, lancerAvion: lancerAvion };
})();
