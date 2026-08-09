/* ==========================================================================
   RÉPARATION DE #message-flash : sortie du conteneur animé

   Cause du bug « le message oblige à remonter la page, et le flou d'une
   fenêtre ouverte le floute aussi » :

   `.contenu` porte une animation d'entrée (`ardoise-apparition`, dans
   theme.css) qui anime `transform`. N'IMPORTE QUEL élément qui anime
   `transform` — même vers `transform: none` en fin de course, même une fois
   l'animation terminée avec `fill-mode: both` — devient un « bloc de
   confinement » pour ses descendants en `position: fixed`. Ce point du CSS
   est peu connu mais bien documenté : un `position: fixed` cesse alors de se
   positionner par rapport à la fenêtre et se positionne par rapport à CE
   conteneur à la place.

   `#message-flash` est un enfant de `.contenu` dans les 34 pages. Ses
   `top`/`right` en position fixe s'appliquaient donc en haut du CONTENU DE LA
   PAGE plutôt qu'en haut de l'écran — d'où l'obligation de remonter le
   défilement pour l'apercevoir. Et parce qu'il restait ainsi « piégé » dans le
   même arbre d'empilement que le reste de la page, le flou d'arrière-plan
   (`backdrop-filter`) d'une fenêtre ouverte le traversait aussi.

   La réparation ne touche à AUCUNE des 34 pages : elle sort le nœud de son
   conteneur et le rattache directement à <body>, où plus aucun ancêtre ne
   peut casser sa position fixe. Son identifiant est conservé, donc le
   `afficherMessage()` propre à chaque page continue de fonctionner sans
   modification.

   PLACÉ TOUT EN HAUT DU FICHIER, avant tout le reste : ui.js contient environ
   1000 lignes d'autres scripts (icônes, animations, squelettes de
   chargement...). Une erreur non interceptée n'importe où dans ce code
   arrêterait l'exécution du fichier — et avec elle, tout ce qui suit,
   y compris ce correctif s'il était resté à sa place initiale, en fin de
   fichier. Cette réparation touche à l'affichage des retours utilisateur
   (succès/échec de CHAQUE action de la plateforme) : elle ne peut pas se
   permettre de dépendre du bon déroulement de code sans rapport avec elle.
   ========================================================================== */
(function () {
  var message = document.getElementById('message-flash');
  if (message && message.parentNode !== document.body) {
    document.body.appendChild(message);
  }
})();

/* ==========================================================================
   Ardoise — Comportements visuels (étape B)
   --------------------------------------------------------------------------
   Chargé après theme.js. Trois rôles, tous non intrusifs : si ce fichier
   ne se charge pas, la plateforme fonctionne exactement comme avant.

     1. Injection des icônes de navigation
     2. Animation des chiffres des cartes statistiques
     3. Squelettes de chargement à la place des lignes « Chargement… »
   ========================================================================== */

(function () {
  'use strict';

  var animationsReduites = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     1. Icônes de navigation
     Chaque entrée du menu est identifiée par son lien : aucune page n'a
     besoin d'être modifiée pour recevoir son icône.
     ------------------------------------------------------------------ */
  var ICONES = {
    'dashboard-directeur.html':
      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>' +
      '<rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    'annee-scolaire.html':
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
    'espace-secretaire.html':
      '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 12h6"/><path d="M9 16h4"/>',
    'espace-professeur.html':
      '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16"/><path d="M13 9h3"/><path d="M13 13h3"/>',
    'espace-titulaire.html':
      '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5a3 3 0 0 1 0 6"/><path d="M18 20a5 5 0 0 0-3-4.6"/>',
    'cours-classe-titulaire.html':
      '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>',
    'orientation.html':
      '<path d="M12 3v6"/><path d="M12 9 6 21"/><path d="m12 9 6 12"/><circle cx="12" cy="6" r="2.5"/>',
    'inscriptions.html':
      '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 13h4"/><path d="m15.5 15.5 1.5 1.5 3-3"/>',
    'eleves.html':
      '<path d="M12 4 2 9l10 5 10-5z"/><path d="M6 11.5V17c0 1.5 3 3 6 3s6-1.5 6-3v-5.5"/>',
    'frais-scolaires.html':
      '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18"/><circle cx="17" cy="15" r="1.3"/>',
    'comptabilite.html':
      '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10"/><path d="M14.5 9.5A2.5 2.5 0 0 0 12 8.5h-.5a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4H12a2.5 2.5 0 0 1-2.5-1"/>',
    'utilisateurs.html':
      '<circle cx="10" cy="8" r="3.5"/><path d="M3 20a7 7 0 0 1 14 0"/><path d="M19 8v6"/><path d="M16 11h6"/>',
    'cours.html':
      '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z"/><path d="M9 7h6"/>',
    'classes.html':
      '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-5h6v5"/><path d="M9 8h.01"/><path d="M15 8h.01"/>',
    'discipline.html':
      '<path d="M12 3 4 6v6c0 4.4 3.4 8.2 8 9 4.6-.8 8-4.6 8-9V6z"/><path d="M12 9v4"/><path d="M12 16h.01"/>',
    'site-public.html':
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18"/><path d="M12 3a15 15 0 0 0 0 18"/>',
    'emploi-du-temps.html':
      '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/><path d="M9 9v12"/><path d="M15 9v12"/><path d="M3 15h18"/>',
    'presences.html':
      '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="m8.5 13 2 2 4-4"/>',
    'notes.html':
      '<path d="M4 20h4L18 10a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5 17.5 10.5"/>',
    'bulletins.html':
      '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13h6"/><path d="M9 17h6"/>',
    'bulletin-annuel.html':
      '<circle cx="12" cy="9" r="5"/><path d="M9 13.5 8 21l4-2 4 2-1-7.5"/>',
    'repechage.html':
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="m6.3 6.3 3.2 3.2"/><path d="m14.5 14.5 3.2 3.2"/><path d="m17.7 6.3-3.2 3.2"/><path d="m9.5 14.5-3.2 3.2"/>',
    'generateur-modeles.html':
      '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M10 9v11"/>',
    'calendrier.html':
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/><rect x="7" y="13" width="4" height="4" rx="1"/>',
    'rapports.html':
      '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    'archives.html':
      '<path d="M3 7h5l2 2.5h11V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7V5a1 1 0 0 1 1-1h4l2 2.5"/><path d="M9 14h6"/>',
    'journal.html':
      '<path d="M3 12h4l2.5 6 5-13 2.5 7h4"/>',
    'parametres.html':
      '<path d="M4 7h9"/><path d="M18 7h2"/><circle cx="15.5" cy="7" r="2.2"/><path d="M4 17h3"/><path d="M12 17h8"/><circle cx="9.5" cy="17" r="2.2"/>',
    'messages.html':
      '<path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
    'mon-profil.html':
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.4 19.2a6.2 6.2 0 0 1 11.2 0"/>'
  };

  function injecterIcones() {
    var liens = document.querySelectorAll('.nav-item[href]');
    for (var i = 0; i < liens.length; i++) {
      var lien = liens[i];
      if (lien.querySelector('.nav-icone')) continue;

      var contenu = ICONES[lien.getAttribute('href')];
      if (!contenu) continue;

      // Le libellé existant est encapsulé pour que l'icône et le texte
      // puissent être alignés proprement en flex.
      var libelle = document.createElement('span');
      libelle.className = 'nav-libelle';
      while (lien.firstChild) libelle.appendChild(lien.firstChild);

      var icone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icone.setAttribute('class', 'nav-icone');
      icone.setAttribute('viewBox', '0 0 24 24');
      icone.setAttribute('aria-hidden', 'true');
      icone.innerHTML = contenu;

      lien.appendChild(icone);
      lien.appendChild(libelle);
    }
  }

  /* ------------------------------------------------------------------
     2. Chiffres animés des cartes statistiques
     On observe les valeurs : dès qu'un nombre remplace le tiret d'attente,
     il défile jusqu'à sa valeur. Les textes non numériques (« — », « 72,4% »
     partiel, dates) sont laissés intacts.
     ------------------------------------------------------------------ */
  function animerNombre(element, valeurFinale, suffixe, prefixe) {
    var duree = 620;
    var debut = null;
    element.dataset.animation = 'en-cours';

    function etape(horodatage) {
      if (debut === null) debut = horodatage;
      var progression = Math.min((horodatage - debut) / duree, 1);
      // Décélération : rapide au départ, posé à l'arrivée.
      var adouci = 1 - Math.pow(1 - progression, 3);
      var courant = valeurFinale * adouci;
      var decimales = String(valeurFinale).indexOf('.') !== -1 ? 1 : 0;
      element.textContent = prefixe + courant.toFixed(decimales).replace('.', ',') + suffixe;

      if (progression < 1) {
        requestAnimationFrame(etape);
      } else {
        element.textContent = prefixe + String(valeurFinale).replace('.', ',') + suffixe;
        delete element.dataset.animation;
      }
    }
    requestAnimationFrame(etape);
  }

  function traiterValeur(element) {
    if (animationsReduites || element.dataset.animation === 'en-cours') return;

    var texte = (element.textContent || '').trim();
    // Format accepté : un nombre éventuellement encadré (ex. « 128 », « 72,4% », « 1 250 FC »)
    var correspondance = texte.match(/^([^0-9-]*)(-?[0-9]+(?:[.,][0-9]+)?)(.*)$/);
    if (!correspondance) return;

    var prefixe = correspondance[1];
    var nombre = parseFloat(correspondance[2].replace(',', '.'));
    var suffixe = correspondance[3];
    if (isNaN(nombre) || nombre === 0) return;
    if (element.dataset.dernierNombre === String(nombre)) return;

    element.dataset.dernierNombre = String(nombre);
    animerNombre(element, nombre, suffixe, prefixe);
  }

  function surveillerValeurs() {
    var valeurs = document.querySelectorAll('.carte-stat .valeur, .carte-recap .valeur');
    if (!valeurs.length || !window.MutationObserver) return;

    for (var i = 0; i < valeurs.length; i++) traiterValeur(valeurs[i]);

    var observateur = new MutationObserver(function (mutations) {
      for (var j = 0; j < mutations.length; j++) {
        var cible = mutations[j].target;
        var element = cible.nodeType === 1 ? cible : cible.parentElement;
        if (element && element.classList && element.classList.contains('valeur')) {
          traiterValeur(element);
        }
      }
    });

    for (var k = 0; k < valeurs.length; k++) {
      observateur.observe(valeurs[k], { childList: true, characterData: true, subtree: true });
    }
  }

  /* ------------------------------------------------------------------
     3. Squelettes de chargement
     Une ligne « Chargement… » est remplacée par des barres qui ondulent :
     l'utilisateur voit la forme du contenu à venir plutôt qu'un vide.
     ------------------------------------------------------------------ */
  function poserSquelettes() {
    var cellules = document.querySelectorAll('td.etat-vide-tableau, td[colspan]');
    for (var i = 0; i < cellules.length; i++) {
      var cellule = cellules[i];
      if (!/Chargement/i.test(cellule.textContent || '')) continue;
      if (cellule.querySelector('.squelette')) continue;

      var colonnes = parseInt(cellule.getAttribute('colspan') || '3', 10);
      if (isNaN(colonnes) || colonnes < 1) colonnes = 3;

      var largeurs = ['70%', '52%', '84%', '61%', '46%'];
      var html = '<div style="display:flex; flex-direction:column; gap:11px; padding:6px 0;">';
      for (var ligne = 0; ligne < 3; ligne++) {
        html += '<span class="squelette" style="width:' + largeurs[(ligne + colonnes) % largeurs.length] + ';"></span>';
      }
      html += '</div>';

      cellule.classList.remove('etat-vide-tableau');
      cellule.innerHTML = html;
    }
  }


  /* ------------------------------------------------------------------
     4. Fabrique de widgets
     Les pages fournissent des données, jamais du dessin. Chaque widget
     est autonome : s'il reçoit des données absentes, il affiche un tiret
     plutôt que de casser la page.
     ------------------------------------------------------------------ */
  var RAYON = 42;
  var CIRCONFERENCE = 2 * Math.PI * RAYON;

  function nombreOuNul(valeur) {
    var n = Number(valeur);
    return isNaN(n) ? null : n;
  }

  /**
   * Anneau de progression.
   * @param {Element|string} cible  élément ou identifiant
   * @param {object} donnees { valeur, max, unite, detail }
   */
  function anneau(cible, donnees) {
    var hote = typeof cible === 'string' ? document.getElementById(cible) : cible;
    if (!hote) return;

    var valeur = nombreOuNul(donnees.valeur);
    var max = nombreOuNul(donnees.max);
    var pourcentage = (valeur !== null && max) ? Math.max(0, Math.min(100, (valeur / max) * 100)) : 0;
    var affichage = donnees.affichage !== undefined
      ? donnees.affichage
      : (valeur === null ? '—' : Math.round(pourcentage) + '%');

    hote.innerHTML =
      '<div class="widget-anneau">' +
        '<div class="anneau-graphe">' +
          '<svg viewBox="0 0 100 100" aria-hidden="true">' +
            '<circle class="anneau-fond" cx="50" cy="50" r="' + RAYON + '"></circle>' +
            '<circle class="anneau-trait" cx="50" cy="50" r="' + RAYON + '" ' +
              'stroke-dasharray="' + CIRCONFERENCE.toFixed(2) + '" ' +
              'stroke-dashoffset="' + CIRCONFERENCE.toFixed(2) + '"></circle>' +
          '</svg>' +
          '<div class="anneau-centre"><span class="anneau-valeur">' + affichage + '</span></div>' +
        '</div>' +
        '<div class="anneau-detail">' + (donnees.detail || '') + '</div>' +
      '</div>';

    // Le décalage est appliqué après un cycle d'affichage : sans cela, le
    // navigateur dessine directement l'état final et l'animation est perdue.
    var trait = hote.querySelector('.anneau-trait');
    if (donnees.couleur) trait.style.stroke = donnees.couleur;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        trait.setAttribute('stroke-dashoffset',
          (CIRCONFERENCE * (1 - pourcentage / 100)).toFixed(2));
      });
    });
  }

  /** Anneau réduit, destiné à s'insérer dans une carte existante. */
  function anneauCompact(donnees) {
    var valeur = nombreOuNul(donnees.valeur);
    var max = nombreOuNul(donnees.max);
    var pourcentage = (valeur !== null && max) ? Math.max(0, Math.min(100, (valeur / max) * 100)) : 0;
    var decalage = (CIRCONFERENCE * (1 - pourcentage / 100)).toFixed(2);
    var couleur = pourcentage >= 100 ? 'var(--vert-ok)' : 'var(--ocre)';

    return '<div class="anneau-compact" title="' + (donnees.titre || '') + '">' +
      '<svg viewBox="0 0 100 100" aria-hidden="true">' +
        '<circle class="anneau-fond" cx="50" cy="50" r="' + RAYON + '"></circle>' +
        '<circle class="anneau-trait" cx="50" cy="50" r="' + RAYON + '" stroke="' + couleur + '" ' +
          'stroke-dasharray="' + CIRCONFERENCE.toFixed(2) + '" stroke-dashoffset="' + decalage + '"></circle>' +
      '</svg>' +
      '<span class="etiquette-centre">' + (donnees.affichage || '') + '</span>' +
    '</div>';
  }

  /**
   * Barres comparatives.
   * @param {Element|string} cible
   * @param {Array} lignes  [{ libelle, valeur, max }]
   */
  function barres(cible, lignes, options) {
    var hote = typeof cible === 'string' ? document.getElementById(cible) : cible;
    if (!hote) return;
    var reglages = options || {};

    if (!lignes || !lignes.length) {
      hote.innerHTML = '<p style="font-size:0.85rem; color:var(--texte-att); margin:0;">' +
        (reglages.messageVide || 'Aucune donnée à afficher.') + '</p>';
      return;
    }

    var maxGlobal = reglages.max || Math.max.apply(null, lignes.map(function (l) {
      return nombreOuNul(l.max) || nombreOuNul(l.valeur) || 0;
    })) || 1;

    hote.innerHTML = '<div class="mini-barres">' + lignes.map(function (ligne) {
      var valeur = nombreOuNul(ligne.valeur) || 0;
      var max = nombreOuNul(ligne.max) || maxGlobal;
      var part = max ? Math.max(0, Math.min(100, (valeur / max) * 100)) : 0;
      var complet = part >= 100 ? ' complet' : '';
      var affichage = ligne.affichage !== undefined ? ligne.affichage : valeur;
      return '<div class="mini-barre">' +
          '<span class="mb-libelle" title="' + ligne.libelle + '">' + ligne.libelle + '</span>' +
          '<span class="mb-piste"><span class="mb-remplissage' + complet + '" data-part="' + part.toFixed(1) + '"></span></span>' +
          '<span class="mb-valeur">' + affichage + '</span>' +
        '</div>';
    }).join('') + '</div>';

    var remplissages = hote.querySelectorAll('.mb-remplissage');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        for (var i = 0; i < remplissages.length; i++) {
          remplissages[i].style.width = remplissages[i].dataset.part + '%';
        }
      });
    });
  }

  window.ArdoiseUI = {
    anneau: anneau, anneauCompact: anneauCompact, barres: barres,
    marquerTuile: marquerTuile,
    ouvrirTousLesMenus: function () { if (window.ArdoiseRail) window.ArdoiseRail.ouvrir(); },
    avatar: avatar, cellulePersonne: cellulePersonne, pileAvatars: pileAvatars,
    badge: badge, decorerCarte: decorerCarte, decorerCartes: decorerCartes
  };


  /* ------------------------------------------------------------------
     5. Menu mobile
     Le bouton est injecté ici plutôt que dans les 22 pages : ajouter une
     page plus tard lui donnera automatiquement sa navigation mobile.
     ------------------------------------------------------------------ */
  function installerMenuMobile() {
    var barre = document.querySelector('.barre-laterale');
    if (!barre || barre.querySelector('.bouton-menu')) return;

    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'bouton-menu';
    bouton.setAttribute('aria-label', 'Ouvrir le menu');
    bouton.setAttribute('aria-expanded', 'false');
    bouton.innerHTML = '<span></span><span></span><span></span>';

    // Placé après le conteneur du titre : sur mobile, la règle CSS
    // « display: contents » le remet à sa place à droite de la barre.
    barre.appendChild(bouton);

    function basculer(ouvrir) {
      var ouvert = ouvrir !== undefined ? ouvrir : !barre.classList.contains('nav-ouverte');
      barre.classList.toggle('nav-ouverte', ouvert);
      bouton.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      bouton.setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu');

      // La liste est masquée au chargement par les pages, le temps que le
      // filtrage par rôle s'applique. On la révèle à l'ouverture au cas où
      // ce filtrage n'aurait pas encore eu lieu.
      var liste = barre.querySelector('.nav-liste');
      if (ouvert && liste) liste.style.visibility = 'visible';
    }

    bouton.addEventListener('click', function () { basculer(); });

    // Le menu se referme après un choix : sur une page déjà ouverte, le lien
    // ne provoque aucune navigation et le panneau resterait déployé.
    barre.querySelectorAll('.nav-item').forEach(function (lien) {
      lien.addEventListener('click', function () { basculer(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') basculer(false);
    });

    // Retour en paysage ou sur grand écran : on repart d'un état propre.
    window.addEventListener('resize', function () {
      if (window.innerWidth > 780) basculer(false);
    });
  }


  /* ------------------------------------------------------------------
     6. Lanceur d'actions rapides
     Le lanceur est construit à partir des liens de navigation RÉELLEMENT
     présents dans la page. Comme ceux-ci sont déjà filtrés par rôle, le
     lanceur est automatiquement juste pour chaque utilisateur — et il le
     restera quand de nouvelles pages seront ajoutées.
     ------------------------------------------------------------------ */
  var GROUPES = [
    { titre: 'Élèves et parcours', pages: ['eleves.html', 'inscriptions.html', 'orientation.html', 'presences.html'] },
    { titre: 'Pédagogie', pages: ['classes.html', 'cours.html', 'emploi-du-temps.html', 'notes.html', 'cours-classe-titulaire.html'] },
    { titre: 'Bulletins', pages: ['bulletins.html', 'bulletin-annuel.html', 'generateur-modeles.html', 'repechage.html'] },
    { titre: 'Vie scolaire', pages: ['discipline.html', 'calendrier.html', 'messages.html'] },
    { titre: 'Finances', pages: ['frais-scolaires.html', 'comptabilite.html'] },
    { titre: 'Pilotage', pages: ['rapports.html', 'archives.html', 'journal.html'] },
    { titre: 'Administration', pages: ['annee-scolaire.html', 'utilisateurs.html', 'site-public.html', 'parametres.html', 'mon-profil.html'] }
  ];

  var DESCRIPTIONS = {
    'eleves.html': 'Registre et fiches',
    'inscriptions.html': "Concours et admissions",
    'orientation.html': "Vœux d'option",
    'presences.html': "Feuille d'appel",
    'classes.html': 'Classes et sections',
    'cours.html': "Catalogue des cours",
    'emploi-du-temps.html': 'Grille hebdomadaire',
    'notes.html': 'Saisie des cotes',
    'cours-classe-titulaire.html': 'Suivi de ma classe',
    'bulletins.html': 'Périodes et signatures',
    'bulletin-annuel.html': 'Résultats annuels',
    'generateur-modeles.html': 'Mise en page',
    'repechage.html': 'Sessions et décisions',
    'discipline.html': 'Faits et conduite',
    'calendrier.html': 'Événements',
    'messages.html': 'Réception et diffusion',
    'frais-scolaires.html': 'Frais et paiements',
    'comptabilite.html': 'Rémunération et dépenses',
    'rapports.html': 'Statistiques et exports',
    'archives.html': 'Années clôturées',
    'journal.html': 'Traçabilité',
    'annee-scolaire.html': 'Périodes et clôture',
    'utilisateurs.html': 'Comptes et rôles',
    'site-public.html': "Vitrine de l'école",
    'parametres.html': "Réglages de l'école",
    'mon-profil.html': 'Compte et apparence'
  };

  var CLE_USAGE = 'ardoise_usage_lanceur';

  function lireUsage() {
    try { return JSON.parse(localStorage.getItem(CLE_USAGE) || '{}'); }
    catch (e) { return {}; }
  }

  function noterUsage(page) {
    try {
      var usage = lireUsage();
      usage[page] = (usage[page] || 0) + 1;
      localStorage.setItem(CLE_USAGE, JSON.stringify(usage));
    } catch (e) { /* navigation privée */ }
  }

  function construireLanceur() {
    var hote = document.getElementById('lanceur');
    if (!hote || hote.dataset.construit === 'oui') return;

    // Les liens visibles font foi : ce sont ceux que le filtrage par rôle
    // a laissés en place. Une page interdite n'apparaît donc jamais ici.
    var disponibles = {};
    var liens = document.querySelectorAll('.nav-liste .nav-item[href]');
    for (var i = 0; i < liens.length; i++) {
      var lien = liens[i];
      var parent = lien.closest('li');
      if (parent && parent.style.display === 'none') continue;
      var href = lien.getAttribute('href');
      var libelle = (lien.querySelector('.nav-libelle') || lien).textContent.trim();
      if (href && libelle) disponibles[href] = libelle;
    }
    if (Object.keys(disponibles).length === 0) return;

    // Cinq raccourcis, pas davantage : une grille de vingt tuiles n'aide
    // personne. Les plus ouverts remontent ; s'il n'y a pas encore assez
    // d'historique, on complète avec les écrans épinglés au rail.
    var usage = lireUsage();
    var frequents = Object.keys(disponibles)
      .filter(function (p) { return usage[p] > 0; })
      .sort(function (a, b) { return usage[b] - usage[a]; });

    if (frequents.length < 5) {
      var complement = [];
      try {
        complement = JSON.parse(localStorage.getItem('ardoise_menus_epingles') || '[]');
      } catch (e) {}
      complement.forEach(function (p) {
        if (disponibles[p] && frequents.indexOf(p) === -1) frequents.push(p);
      });
      Object.keys(disponibles).forEach(function (p) {
        if (frequents.length < 5 && frequents.indexOf(p) === -1) frequents.push(p);
      });
    }
    frequents = frequents.slice(0, 5);

    function tuile(page) {
      var icone = ICONES[page] || '';
      return '<a class="tuile" href="' + page + '" data-page="' + page + '"'
        + ' data-recherche="' + (disponibles[page] + ' ' + (DESCRIPTIONS[page] || '')).toLowerCase() + '">'
        + '<span class="jeton"><svg viewBox="0 0 24 24" aria-hidden="true">' + icone + '</svg></span>'
        + '<span class="textes">'
        + '<span class="nom">' + disponibles[page] + '</span>'
        + '<span class="desc">' + (DESCRIPTIONS[page] || '') + '</span>'
        + '</span></a>';
    }

    var html = '<div class="lanceur-entete">'
      + '<h2>Actions rapides</h2>'
      + '<button type="button" class="lanceur-tout" id="lanceur-tout">Tous les écrans</button>'
      + '</div>';

    html += '<div class="lanceur-groupe" data-groupe>'
      + '<div class="lanceur-grille">' + frequents.map(tuile).join('') + '</div></div>';

    hote.className = 'lanceur';
    hote.innerHTML = html;
    hote.dataset.construit = 'oui';

    hote.querySelectorAll('[data-page]').forEach(function (t) {
      t.addEventListener('click', function () { noterUsage(t.dataset.page); });
    });

    document.getElementById('lanceur-tout').addEventListener('click', function () {
      if (window.ArdoiseRail) window.ArdoiseRail.ouvrir();
    });
  }

  /**
   * Pose un compteur vivant sur une tuile.
   * @param {string} page   ex. « presences.html »
   * @param {string} texte  ex. « 3 sans appel »
   * @param {boolean} calme vert plutôt que rouge
   */
  function marquerTuile(page, texte, calme) {
    var tuile = document.querySelector('.tuile[data-page="' + page + '"]');
    if (!tuile || !texte) return;
    var existante = tuile.querySelector('.pastille-vive');
    if (existante) existante.remove();
    var pastille = document.createElement('span');
    pastille.className = 'pastille-vive' + (calme ? ' calme' : '');
    pastille.textContent = texte;
    tuile.appendChild(pastille);
  }


  /* ------------------------------------------------------------------
     7. Rail réduit et tiroir « Tous les menus »

     Le rail n'affiche que les écrans ÉPINGLÉS, quatre par défaut. Le reste
     vit dans un tiroir. Trois principes :

       · la page courante reste toujours visible dans le rail, même non
         épinglée — sinon l'utilisateur perd son repère de position ;
       · les épingles sont propres à chaque personne, conservées dans le
         navigateur ;
       · si tout est épinglé, « Tous les menus » disparaît : un tiroir vide
         n'aurait aucune raison d'exister.
     ------------------------------------------------------------------ */
  var CLE_EPINGLES = 'ardoise_menus_epingles';
  var EPINGLES_DEFAUT = {
    directeur: ['dashboard-directeur.html', 'eleves.html', 'bulletins.html', 'rapports.html'],
    prefet: ['dashboard-directeur.html', 'classes.html', 'emploi-du-temps.html', 'discipline.html'],
    secretaire: ['espace-secretaire.html', 'eleves.html', 'inscriptions.html', 'frais-scolaires.html'],
    professeur: ['espace-professeur.html', 'notes.html', 'presences.html', 'emploi-du-temps.html'],
    titulaire: ['espace-titulaire.html', 'notes.html', 'presences.html', 'bulletins.html'],
    comptable: ['frais-scolaires.html', 'rapports.html', 'messages.html', 'mon-profil.html'],
    // Deux métiers tenus par un seul écran : l'épingler d'office évite de
    // laisser ces comptes devant un rail qui ne montre rien de leur travail.
    charge_presences: ['presences.html', 'calendrier.html', 'messages.html', 'mon-profil.html'],
    directeur_discipline: ['discipline.html', 'presences.html', 'messages.html', 'mon-profil.html']
  };

  function rolesCourants() {
    try {
      var u = JSON.parse(localStorage.getItem('ardoise_user') || sessionStorage.getItem('ardoise_user') || 'null');
      return (u && u.roles) || [];
    } catch (e) { return []; }
  }

  function epinglesParDefaut(disponibles) {
    var roles = rolesCourants();
    for (var i = 0; i < roles.length; i++) {
      if (EPINGLES_DEFAUT[roles[i]]) {
        var choix = EPINGLES_DEFAUT[roles[i]].filter(function (p) { return disponibles[p]; });
        if (choix.length) return choix;
      }
    }
    // Rôle inattendu : on prend les quatre premiers écrans accessibles.
    return Object.keys(disponibles).slice(0, 4);
  }

  function lireEpingles(disponibles) {
    try {
      var brut = JSON.parse(localStorage.getItem(CLE_EPINGLES) || 'null');
      if (Array.isArray(brut)) {
        var valides = brut.filter(function (p) { return disponibles[p]; });
        if (valides.length) return valides;
      }
    } catch (e) {}
    return epinglesParDefaut(disponibles);
  }

  function ecrireEpingles(liste) {
    try { localStorage.setItem(CLE_EPINGLES, JSON.stringify(liste)); } catch (e) {}
  }

  function pageCourante() {
    var p = window.location.pathname.split('/').pop();
    return p || 'dashboard-directeur.html';
  }

  function reduireRail() {
    var liste = document.querySelector('.nav-liste');
    if (!liste || liste.dataset.reduit === 'oui') return;

    var elements = [];
    var lis = liste.querySelectorAll('li');
    for (var i = 0; i < lis.length; i++) {
      var li = lis[i];
      if (li.style.display === 'none') continue;      // écarté par le rôle
      var lien = li.querySelector('.nav-item[href]');
      if (!lien) continue;
      elements.push({
        li: li,
        page: lien.getAttribute('href'),
        libelle: (lien.querySelector('.nav-libelle') || lien).textContent.trim()
      });
    }
    if (elements.length <= 5) { liste.dataset.reduit = 'oui'; return; }

    var disponibles = {};
    elements.forEach(function (e) { disponibles[e.page] = e.libelle; });

    var epingles = lireEpingles(disponibles);
    var courante = pageCourante();

    elements.forEach(function (e) {
      var visible = epingles.indexOf(e.page) !== -1 || e.page === courante;
      e.li.style.display = visible ? '' : 'none';
      e.li.dataset.epingle = epingles.indexOf(e.page) !== -1 ? 'oui' : 'non';
    });

    // « Tous les menus » n'apparaît que s'il reste quelque chose à y montrer.
    var restants = elements.length - epingles.length;
    var ancien = liste.querySelector('.nav-tiroir');
    if (ancien) ancien.closest('li').remove();

    if (restants > 0) {
      var li = document.createElement('li');
      li.innerHTML = '<button type="button" class="nav-item nav-tiroir">'
        + '<svg class="nav-icone" viewBox="0 0 24 24" aria-hidden="true">'
        + '<circle cx="5" cy="6" r="1.4"/><circle cx="5" cy="12" r="1.4"/><circle cx="5" cy="18" r="1.4"/>'
        + '<path d="M10 6h10"/><path d="M10 12h10"/><path d="M10 18h10"/></svg>'
        + '<span class="nav-libelle">Tous les menus</span>'
        + '<span class="chevron">' + restants + '</span></button>';
      liste.appendChild(li);
      li.querySelector('.nav-tiroir').addEventListener('click', function () {
        ouvrirTiroir(elements, disponibles);
      });
    }

    liste.dataset.reduit = 'oui';
    window.ArdoiseRail = {
      elements: elements,
      disponibles: disponibles,
      ouvrir: function () { ouvrirTiroir(elements, disponibles); }
    };
  }

  function ouvrirTiroir(elements, disponibles) {
    var voile = document.getElementById('voile-tiroir');
    if (!voile) {
      voile = document.createElement('div');
      voile.id = 'voile-tiroir';
      voile.className = 'voile-tiroir';
      voile.innerHTML = '<div class="tiroir" role="dialog" aria-label="Tous les menus"></div>';
      document.body.appendChild(voile);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && voile.classList.contains('ouvert')) fermerTiroir();
      });
    }

    var epingles = lireEpingles(disponibles);
    var boite = voile.querySelector('.tiroir');

    function ligne(e) {
      var actif = epingles.indexOf(e.page) !== -1;
      return '<div class="tiroir-ligne">'
        + '<a class="lien" href="' + e.page + '">'
        + '<span class="jeton-menu"><svg viewBox="0 0 24 24" aria-hidden="true">'
        + (ICONES[e.page] || '') + '</svg></span>'
        + '<span class="texte">' + e.libelle + '</span></a>'
        + '<button type="button" class="epingle' + (actif ? ' active' : '') + '"'
        + ' data-page="' + e.page + '" title="' + (actif ? 'Retirer du menu' : 'Ajouter au menu') + '"'
        + ' aria-pressed="' + actif + '">'
        + '<svg viewBox="0 0 24 24"><path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/></svg>'
        + '</button></div>';
    }

    var html = '<div class="tiroir-entete">'
      + '<h2>Tous les menus</h2>'
      + '<input type="search" class="tiroir-recherche" id="tiroir-recherche" placeholder="Rechercher un écran…" aria-label="Rechercher un écran" />'
      + '<button type="button" class="tiroir-fermer" id="tiroir-fermer">← Retour</button>'
      + '</div>'
      + '<p class="tiroir-aide">Épinglez les écrans que vous utilisez le plus : ils apparaîtront directement dans le menu de gauche.</p>';

    var placees = {};
    for (var g = 0; g < GROUPES.length; g++) {
      var dedans = elements.filter(function (e) { return GROUPES[g].pages.indexOf(e.page) !== -1; });
      if (!dedans.length) continue;
      dedans.forEach(function (e) { placees[e.page] = true; });
      html += '<div class="tiroir-groupe" data-groupe><div class="titre">' + GROUPES[g].titre + '</div>'
        + '<div class="tiroir-grille">' + dedans.map(ligne).join('') + '</div></div>';
    }
    // Les écrans hors catalogue restent accessibles : une page ajoutée
    // demain ne doit pas disparaître faute d'avoir été classée.
    var orphelines = elements.filter(function (e) { return !placees[e.page]; });
    if (orphelines.length) {
      html += '<div class="tiroir-groupe" data-groupe><div class="titre">Autres</div>'
        + '<div class="tiroir-grille">' + orphelines.map(ligne).join('') + '</div></div>';
    }

    html += '<div class="tiroir-pied">'
      + '<span id="tiroir-compte"></span>'
      + '<button type="button" class="lien-reinit" id="tiroir-reinit">Rétablir le menu par défaut</button>'
      + '</div>';

    boite.innerHTML = html;
    voile.classList.add('ouvert');
    document.body.style.overflow = 'hidden';

    // Le tiroir vient d'être reconstruit : sa ligne « Messages » (si elle y
    // figure) part sans badge tant qu'on ne le lui repose pas.
    try { appliquerBadgeMessages(messagesNonLusCache); } catch (e) {}

    function majCompte() {
      var n = lireEpingles(disponibles).length;
      document.getElementById('tiroir-compte').textContent =
        n + ' écran(s) épinglé(s) sur ' + elements.length;
    }
    majCompte();

    boite.querySelectorAll('.epingle').forEach(function (b) {
      b.addEventListener('click', function () {
        var liste = lireEpingles(disponibles);
        var i = liste.indexOf(b.dataset.page);
        if (i === -1) liste.push(b.dataset.page);
        else if (liste.length > 1) liste.splice(i, 1);
        else return;   // on ne vide jamais complètement le rail
        ecrireEpingles(liste);
        b.classList.toggle('active', liste.indexOf(b.dataset.page) !== -1);
        b.setAttribute('aria-pressed', liste.indexOf(b.dataset.page) !== -1);
        majCompte();
        appliquerEpingles(liste);
      });
    });

    document.getElementById('tiroir-fermer').addEventListener('click', fermerTiroir);
    document.getElementById('tiroir-reinit').addEventListener('click', function () {
      try { localStorage.removeItem(CLE_EPINGLES); } catch (e) {}
      fermerTiroir();
      window.location.reload();
    });

    var champ = document.getElementById('tiroir-recherche');
    champ.addEventListener('input', function () {
      var q = champ.value.trim().toLowerCase();
      boite.querySelectorAll('[data-groupe]').forEach(function (groupe) {
        var visibles = 0;
        groupe.querySelectorAll('.tiroir-ligne').forEach(function (l) {
          var ok = !q || l.textContent.toLowerCase().indexOf(q) !== -1;
          l.style.display = ok ? '' : 'none';
          if (ok) visibles++;
        });
        groupe.style.display = visibles ? '' : 'none';
      });
    });
    champ.focus();
  }

  function fermerTiroir() {
    var voile = document.getElementById('voile-tiroir');
    if (voile) voile.classList.remove('ouvert');
    document.body.style.overflow = '';
  }

  /** Met le rail à jour sans recharger la page. */
  function appliquerEpingles(epingles) {
    if (!window.ArdoiseRail) return;
    var courante = pageCourante();
    var restants = 0;
    window.ArdoiseRail.elements.forEach(function (e) {
      var epingle = epingles.indexOf(e.page) !== -1;
      e.li.style.display = (epingle || e.page === courante) ? '' : 'none';
      e.li.dataset.epingle = epingle ? 'oui' : 'non';
      if (!epingle) restants++;
    });
    var bouton = document.querySelector('.nav-tiroir');
    if (bouton) {
      var li = bouton.closest('li');
      // Tout est épinglé : le tiroir n'a plus de raison d'être.
      li.style.display = restants > 0 ? '' : 'none';
      bouton.querySelector('.chevron').textContent = restants;
    }
  }


  /* ------------------------------------------------------------------
     8. Composants de densité
     Fonctions publiques appelées par les pages. Elles produisent du HTML
     plutôt que des nœuds : c'est ce dont les pages ont besoin, puisqu'elles
     assemblent leurs tableaux par chaînes.
     ------------------------------------------------------------------ */

  // Teintes d'avatar : dérivées du nom, donc STABLES d'un écran à l'autre.
  // Une couleur tirée au hasard changerait à chaque rechargement et
  // empêcherait de reconnaître quelqu'un du coin de l'œil.
  var TEINTES_AVATAR = ['#4C5FD5', '#12B76A', '#C98A3E', '#7E56D4', '#0E9384', '#B23A2E', '#3C5A62'];

  function teintePour(nom) {
    var somme = 0;
    var texte = String(nom || '?');
    for (var i = 0; i < texte.length; i++) somme = (somme + texte.charCodeAt(i)) % 9973;
    return TEINTES_AVATAR[somme % TEINTES_AVATAR.length];
  }

  function initialesDe(nom) {
    return String(nom || '?').trim().split(/\s+/).slice(0, 2)
      .map(function (m) { return (m[0] || '').toUpperCase(); }).join('') || '?';
  }

  function proteger(t) {
    var d = document.createElement('div');
    d.textContent = t == null ? '' : String(t);
    return d.innerHTML;
  }

  function urlImage(v) {
    return (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) ? v.trim() : null;
  }

  /**
   * Avatar seul.
   * @param {string} nom
   * @param {string} [photoUrl] ignorée si ce n'est pas une adresse http(s)
   */
  function avatar(nom, photoUrl) {
    var src = urlImage(photoUrl);
    if (src) {
      return '<img class="avatar" src="' + proteger(src) + '" alt="" loading="lazy" />';
    }
    return '<span class="avatar-initiales" style="background:' + teintePour(nom) + '" aria-hidden="true">'
      + proteger(initialesDe(nom)) + '</span>';
  }

  /** Cellule de tableau : avatar, nom, et une ligne secondaire facultative. */
  function cellulePersonne(nom, sousTitre, photoUrl) {
    return '<div class="cellule-personne">' + avatar(nom, photoUrl)
      + '<div class="identite"><div class="nom-personne">' + proteger(nom) + '</div>'
      + (sousTitre ? '<div class="sous-nom">' + proteger(sousTitre) + '</div>' : '')
      + '</div></div>';
  }

  /** Pile compacte. @param {Array} personnes  [{ nom, photo_url }] */
  function pileAvatars(personnes, maximum) {
    var max = maximum || 4;
    var liste = (personnes || []).slice(0, max);
    var reste = (personnes || []).length - liste.length;
    return '<div class="pile-avatars">'
      + liste.map(function (p) { return avatar(p.nom, p.photo_url); }).join('')
      + (reste > 0 ? '<span class="reste">+' + reste + '</span>' : '')
      + '</div>';
  }

  /**
   * Badge d'état.
   * @param {string} texte
   * @param {'succes'|'alerte'|'danger'|'neutre'|'info'} ton
   */
  function badge(texte, ton) {
    var tons = { succes: 1, alerte: 1, danger: 1, neutre: 1, info: 1 };
    var retenu = tons[ton] ? ton : 'neutre';
    return '<span class="badge badge-' + retenu + '">' + proteger(texte) + '</span>';
  }

  var PICTOGRAMMES = {
    eleves: '<path d="M12 3 2 8l10 5 10-5z"/><path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5"/>',
    enseignants: '<circle cx="12" cy="8" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    classes: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 20h10"/><path d="M7 9h7"/>',
    argent: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10"/><path d="M14.5 9.5A2.5 2.5 0 0 0 12 8.5h-.5a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4H12a2.5 2.5 0 0 1-2.5-1"/>',
    presence: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M8 2.5v4"/><path d="M16 2.5v4"/><path d="m9 13.5 2 2 4-4"/>',
    alerte: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
    reussite: '<path d="m4 13 5 5L20 7"/>',
    temps: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>'
  };

  /**
   * Pose un pictogramme coloré sur une carte de chiffre.
   * @param {string} selecteur  ex. « #carte-eleves » ou « .carte-stat:nth-child(1) »
   * @param {string} type       clé de PICTOGRAMMES
   * @param {string} teinte     bleu | vert | ocre | rouge | violet
   */
  function decorerCarte(selecteur, type, teinte) {
    var carte = document.querySelector(selecteur);
    if (!carte || !PICTOGRAMMES[type]) return;
    if (carte.querySelector('.pictogramme')) return;
    var span = document.createElement('span');
    span.className = 'pictogramme pict-' + (teinte || 'bleu');
    span.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + PICTOGRAMMES[type] + '</svg>';
    carte.appendChild(span);
  }

  /** Décore plusieurs cartes d'un coup. @param {Array} plan [[sel, type, teinte]] */
  function decorerCartes(plan) {
    (plan || []).forEach(function (p) { decorerCarte(p[0], p[1], p[2]); });
  }

  /* ------------------------------------------------------------------
     Badge de messages non lus

     La cloche de notifications n'existe aujourd'hui que sur le tableau
     de bord du directeur : sur les 30 autres écrans, rien ne signale un
     message en attente. Or l'écran Messages n'est qu'une autre vue de la
     table `notifications` (voir messages.html, qui lit `/notifications`
     exactement comme la cloche) : le badge peut donc s'appuyer sur le
     même point d'API, sans rien changer côté serveur.

     Posé ICI, dans le fichier partagé, pour apparaître sur les 30 pages
     d'un coup plutôt que d'être dupliqué : sur le lien « Messages » de la
     barre latérale (pastille normale, ou simple point sur l'icône si le
     rail est réduit), sur sa tuile dans le lanceur « Actions rapides »
     si elle y figure, et sur sa ligne dans le tiroir « Tous les menus »
     si celui-ci est déjà ouvert.

     Échec réseau ou absence de session : le badge reste simplement
     invisible, comme `affinerMenuOrientation` ci-dessous — une pastille
     qui ne se met pas à jour serait pire qu'une pastille absente.
     ------------------------------------------------------------------ */
  var messagesNonLusCache = 0;

  function jetonMessages() {
    try {
      return localStorage.getItem('ardoise_access_token')
          || sessionStorage.getItem('ardoise_access_token');
    } catch (e) { return null; }
  }

  function poserBadgeMessages(lien, n) {
    if (!lien) return;
    var badge = lien.querySelector('.badge-nav-messages');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'badge-nav-messages';
      lien.appendChild(badge);
    }
    if (n > 0) {
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.style.display = 'inline-block';
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  }

  function appliquerBadgeMessages(n) {
    document.querySelectorAll('.nav-item[href="messages.html"]').forEach(function (lien) {
      poserBadgeMessages(lien, n);
    });

    var ligneTiroir = document.querySelector('.tiroir-ligne .lien[href="messages.html"]');
    if (ligneTiroir) poserBadgeMessages(ligneTiroir, n);

    try {
      if (n > 0) {
        marquerTuile('messages.html', n > 99 ? '99+' : String(n));
      } else {
        var pastille = document.querySelector('.tuile[data-page="messages.html"] .pastille-vive');
        if (pastille) pastille.remove();
      }
    } catch (e) { /* lanceur pas encore construit : rien à faire */ }
  }

  function chargerBadgeMessages() {
    var jeton = jetonMessages();
    if (!jeton) return;
    var base = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) || window.API_BASE_URL || '';
    fetch(base + '/notifications?limite=200', { headers: { Authorization: 'Bearer ' + jeton } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (liste) {
        if (!Array.isArray(liste)) return;
        var n = 0;
        for (var i = 0; i < liste.length; i++) { if (!liste[i].lu) n++; }
        messagesNonLusCache = n;
        appliquerBadgeMessages(n);
      })
      .catch(function () { /* voir commentaire ci-dessus */ });
  }

  // La cloche du tableau de bord et l'écran Messages déclenchent cet
  // évènement dès qu'un message est marqué lu : le badge se met à jour
  // immédiatement, sans attendre le prochain chargement de page.
  document.addEventListener('ardoise:messages-maj', function () {
    chargerBadgeMessages();
  });


  /* ------------------------------------------------------------------
     Démarrage
     ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------
     Menu Orientation — visibilité affinée

     La carte des rôles écrite en dur dans chaque page sait qu'un titulaire
     peut accéder à l'orientation. Elle ne peut pas savoir si CE titulaire
     tient une classe d'orientation : un enseignant de 3e année voyait donc un
     menu qui ne lui répondait que par un refus.

     Le contrôle est fait ICI, dans le fichier partagé, et non dans les 38
     pages : la carte des rôles y est déjà dupliquée 38 fois, il n'y a aucune
     raison d'y ajouter une 39e duplication.

     En cas d'échec de l'appel, le menu RESTE affiché : masquer une entrée sur
     une erreur réseau ferait croire à une perte de droits.
     ------------------------------------------------------------------ */
  function affinerMenuOrientation() {
    var liens = document.querySelectorAll('a[href="orientation.html"]');
    if (liens.length === 0) return;

    var jeton = null;
    try {
      jeton = localStorage.getItem('ardoise_access_token')
           || sessionStorage.getItem('ardoise_access_token');
    } catch (e) { return; }
    if (!jeton) return;

    var utilisateur = null;
    try {
      utilisateur = JSON.parse(
        localStorage.getItem('ardoise_user') || sessionStorage.getItem('ardoise_user') || 'null'
      );
    } catch (e) {}
    var roles = (utilisateur && utilisateur.roles) || [];

    // La direction et le secrétariat voient toujours l'orientation : le
    // contrôle ne concerne que les titulaires.
    var concerne = roles.indexOf('titulaire') !== -1
      && !roles.some(function (r) {
        return ['directeur', 'prefet', 'secretaire', 'super_admin'].indexOf(r) !== -1;
      });
    if (!concerne) return;

    var base = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) || window.API_BASE_URL || '';
    fetch(base + '/orientation/acces', { headers: { Authorization: 'Bearer ' + jeton } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || d.autorise !== false) return;
        liens.forEach(function (lien) {
          var li = lien.closest('li') || lien;
          li.style.display = 'none';
        });
      })
      .catch(function () { /* menu conservé : voir commentaire ci-dessus */ });
  }


  /* ==================================================================
     NAVIGATION CIBLÉE — « montre-moi CET élève, ici »

     Depuis la fiche d'un élève, on peut ouvrir ses présences, sa discipline,
     ses frais. Le problème : ces écrans affichent une classe entière, et
     retrouver un enfant parmi trois cents annule tout le bénéfice du lien.

     Deux réponses possibles — surligner sa ligne, ou n'afficher que lui. On
     fait LES DEUX, parce qu'elles ne servent pas au même moment :
       · un bandeau annonce qui l'on consulte et propose de revenir à la liste
         complète — c'est la réponse « ne montre que lui » ;
       · la ligne correspondante est surlignée et amenée à l'écran — c'est la
         réponse « où est-il ? », utile quand la page ne sait pas filtrer.

     Le surlignage s'applique à toute ligne portant `data-eleve-id`,
     `data-id` ou `data-classe-id`. Les pages n'ont rien à faire pour en
     bénéficier ; celles qui savent filtrer lisent en plus le paramètre.

     Implémenté ICI et non dans chaque page : la même mécanique servira aux
     classes et aux cours, et 38 copies divergeraient dès la première
     évolution.
     ================================================================== */
  var CIBLES = [
    { param: 'eleve', libelle: 'élève', attributs: ['data-eleve-id', 'data-id'] },
    { param: 'classe', libelle: 'classe', attributs: ['data-classe-id', 'data-id'] },
    { param: 'cours', libelle: 'cours', attributs: ['data-cours-id', 'data-id'] }
  ];

  function installerFocus() {
    var params = new URLSearchParams(window.location.search);
    var cible = null;
    for (var i = 0; i < CIBLES.length; i++) {
      var valeur = params.get(CIBLES[i].param);
      if (valeur) { cible = { def: CIBLES[i], id: valeur }; break; }
    }
    if (!cible) return;

    var nom = params.get('nom') || '';
    afficherBandeauFocus(cible, nom);

    // La liste arrive par un appel réseau : elle n'est pas encore là au
    // chargement. On observe le DOM plutôt que de deviner un délai — un
    // setTimeout arbitraire rate la cible sur une connexion lente, ce qui est
    // précisément le cas des écoles visées.
    var trouve = false;
    var observateur = new MutationObserver(function () {
      if (trouve) return;
      if (surlignerCible(cible)) {
        trouve = true;
        observateur.disconnect();
      }
    });
    observateur.observe(document.body, { childList: true, subtree: true });

    // Filet : on arrête d'observer au bout de 15 secondes, sinon l'observateur
    // tourne pour rien pendant toute la session.
    setTimeout(function () { observateur.disconnect(); }, 15000);
    surlignerCible(cible);
  }

  function surlignerCible(cible) {
    for (var i = 0; i < cible.def.attributs.length; i++) {
      var attribut = cible.def.attributs[i];
      var element = document.querySelector('[' + attribut + '="' + cible.id.replace(/"/g, '') + '"]');
      if (!element) continue;
      var ligne = element.closest('tr') || element.closest('li') || element;
      ligne.classList.add('ard-ligne-ciblee');
      try { ligne.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      return true;
    }
    return false;
  }

  function afficherBandeauFocus(cible, nom) {
    if (document.getElementById('ard-bandeau-focus')) return;

    var url = new URL(window.location.href);
    url.searchParams.delete(cible.def.param);
    url.searchParams.delete('nom');

    var bandeau = document.createElement('div');
    bandeau.id = 'ard-bandeau-focus';
    bandeau.className = 'ard-bandeau-focus';
    bandeau.innerHTML =
      '<span>Vous consultez ' + (nom
        ? '<strong>' + nom.replace(/[&<>"]/g, '') + '</strong>'
        : 'un ' + cible.def.libelle + ' en particulier')
      + '.</span> <a href="' + url.pathname + url.search + '">Voir tout</a>';

    var contenu = document.querySelector('.contenu') || document.body;
    var premier = contenu.querySelector('h1');
    if (premier && premier.parentNode) {
      premier.parentNode.insertBefore(bandeau, premier.nextSibling);
    } else {
      contenu.insertBefore(bandeau, contenu.firstChild);
    }
  }


  /* ==================================================================
     TABLEAUX EN CARTES SUR TÉLÉPHONE

     Les tableaux étaient rendus dans un conteneur à défilement horizontal,
     avec une largeur minimale de 560 px. Sur un téléphone de 360 px, cela
     oblige à balayer de côté pour lire chaque ligne — et à revenir en arrière
     pour savoir de quel élève il s'agit. C'est ce qui donne l'impression que
     l'application « n'est pas responsive du tout », alors que la mise en page
     générale l'est.

     La bonne réponse pour un tableau de données sur mobile n'est pas de le
     rétrécir : c'est de le retourner. Chaque LIGNE devient une carte, et
     chaque CELLULE une ligne « intitulé → valeur ».

     Le CSS seul ne peut pas le faire : il faudrait recopier l'en-tête de
     colonne dans chaque cellule, ce que seul le JavaScript sait faire. On
     pose donc `data-libelle` sur chaque cellule, et la feuille de style s'en
     sert comme préfixe.

     POURQUOI ICI, ET NON DANS CHAQUE PAGE
     Trente-neuf pages, des dizaines de tableaux, tous reconstruits
     dynamiquement à chaque chargement de données. Une solution par page serait
     à réécrire à chaque nouveau tableau ; celle-ci s'applique à tout ce qui
     existe et à tout ce qui viendra.
     ================================================================== */
  var LARGEUR_CARTES = 700;

  function etiqueterCellules(tableau) {
    var entetes = tableau.querySelectorAll('thead th');
    if (entetes.length === 0) return;

    var libelles = [];
    for (var i = 0; i < entetes.length; i++) {
      libelles.push((entetes[i].textContent || '').trim());
    }

    var lignes = tableau.querySelectorAll('tbody tr');
    for (var l = 0; l < lignes.length; l++) {
      var cellules = lignes[l].children;
      // Une ligne d'état vide (« Aucun résultat ») s'étale sur toute la
      // largeur : la transformer en carte n'aurait aucun sens.
      if (cellules.length === 1 && cellules[0].hasAttribute('colspan')) {
        lignes[l].classList.add('ard-ligne-pleine');
        continue;
      }
      for (var c = 0; c < cellules.length && c < libelles.length; c++) {
        if (libelles[c]) cellules[c].setAttribute('data-libelle', libelles[c]);
        // Une cellule vide n'a pas à occuper une ligne dans la carte.
        if (!(cellules[c].textContent || '').trim() && !cellules[c].children.length) {
          cellules[c].classList.add('ard-cellule-vide');
        }
      }
    }
  }

  function activerTableauxCartes() {
    if (window.innerWidth > LARGEUR_CARTES) return;
    var tableaux = document.querySelectorAll('.conteneur-tableau table');
    for (var i = 0; i < tableaux.length; i++) {
      try { etiqueterCellules(tableaux[i]); } catch (e) { /* tableau laissé tel quel */ }
    }
  }

  function surveillerTableaux() {
    activerTableauxCartes();
    // Les tableaux sont remplis par des appels réseau, souvent plusieurs fois
    // (filtres, pagination). On réétiquette à chaque reconstruction plutôt que
    // d'espérer un bon moment.
    var enAttente = false;
    var observateur = new MutationObserver(function () {
      if (enAttente) return;
      enAttente = true;
      // Regroupé sur une frame : un tableau de 300 lignes déclenche 300
      // mutations, et réétiqueter à chacune bloquerait le fil d'exécution.
      requestAnimationFrame(function () {
        enAttente = false;
        activerTableauxCartes();
      });
    });
    var conteneurs = document.querySelectorAll('.conteneur-tableau');
    for (var i = 0; i < conteneurs.length; i++) {
      observateur.observe(conteneurs[i], { childList: true, subtree: true });
    }
  }

  function demarrer() {
    try { injecterIcones(); } catch (e) { /* la navigation reste utilisable sans icônes */ }
    try { installerMenuMobile(); } catch (e) { /* la barre reste affichée sans bouton */ }
    // Le lanceur attend le filtrage par rôle des pages, qui s'exécute juste après.
    setTimeout(function () {
      // Après le filtrage par rôle des pages : on affine ce qu'il a laissé.
      try { affinerMenuOrientation(); } catch (e) { /* menu conservé */ }
      try { installerFocus(); } catch (e) { /* la page reste utilisable sans surlignage */ }
      try { surveillerTableaux(); } catch (e) { /* les tableaux restent en défilement horizontal */ }
      try { reduireRail(); } catch (e) { /* le rail complet reste utilisable */ }
      try { construireLanceur(); } catch (e) {}
      try { chargerBadgeMessages(); } catch (e) { /* pas de badge plutôt qu'une page cassée */ }
    }, 60);
    try { surveillerValeurs(); } catch (e) { /* les chiffres restent affichés sans animation */ }
    if (!animationsReduites) {
      try { poserSquelettes(); } catch (e) { /* le texte « Chargement… » reste affiché */ }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }

  // Les icônes sont réinjectées si le thème change (le menu peut être redessiné).
  document.addEventListener('ardoise:theme-change', function () {
    try { injecterIcones(); } catch (e) {}
  });
})();

/* ==========================================================================
   MODE ÉDITION DES FORMULAIRES

   Reproduit — et généralise — le comportement déjà en place dans
   mon-profil.html : un formulaire d'édition s'ouvre VERROUILLÉ, champs
   désactivés et bouton « Modifier ». Cliquer dessus déverrouille et fait
   apparaître « Enregistrer » et « Annuler ».

   Pourquoi ce n'est pas qu'une question d'apparence : un formulaire ouvert en
   permanence invite à modifier par inadvertance des réglages structurants
   (seuil de promotion, type d'enseignement, taux de change...). Le clic sur
   « Modifier » est une intention explicite.

   Ne s'applique QU'AUX FORMULAIRES D'ÉDITION. Un formulaire de création n'a
   rien à « modifier » : il s'ouvre déjà en saisie, et le laisser verrouillé
   n'aurait aucun sens.

   Usage :
     ArdoiseEdition.installer({
       formulaire: 'formulaire-parametres',
       champs: ['champ-a', 'champ-b'],          // ou omis = tous les champs du formulaire
       boutonEnregistrer: 'bouton-enregistrer',
       libelleModifier: 'Modifier'              // optionnel
     });

   L'appelant garde la main sur la soumission : après un enregistrement réussi
   il appelle `verrouiller()`, après un échec il ne fait rien — le formulaire
   RESTE en édition avec les valeurs saisies, pour que l'utilisateur corrige
   sans avoir à tout retaper.
   ========================================================================== */
(function () {
  'use strict';

  function champsDuFormulaire(formulaire, ids) {
    if (ids && ids.length) {
      return ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    }
    // Les boutons ne sont pas des champs : les désactiver rendrait « Modifier »
    // lui-même inutilisable, et le formulaire définitivement figé.
    return Array.prototype.filter.call(
      formulaire.querySelectorAll('input, select, textarea'),
      function (el) { return el.type !== 'submit' && el.type !== 'button'; }
    );
  }

  function installer(options) {
    var formulaire = document.getElementById(options.formulaire);
    var boutonEnregistrer = document.getElementById(options.boutonEnregistrer);
    if (!formulaire || !boutonEnregistrer) return null;

    var champs = champsDuFormulaire(formulaire, options.champs);

    // Les deux boutons sont créés ici plutôt qu'ajoutés dans les 20 pages :
    // une page qui adopte le mode édition n'a aucun balisage à écrire.
    var boutonModifier = document.createElement('button');
    boutonModifier.type = 'button';
    boutonModifier.className = boutonEnregistrer.className;
    boutonModifier.textContent = options.libelleModifier || 'Modifier';

    var boutonAnnuler = document.createElement('button');
    boutonAnnuler.type = 'button';
    boutonAnnuler.className = 'bouton bouton-secondaire';
    boutonAnnuler.textContent = 'Annuler';
    boutonAnnuler.style.display = 'none';

    boutonEnregistrer.parentNode.insertBefore(boutonModifier, boutonEnregistrer);
    boutonEnregistrer.parentNode.insertBefore(boutonAnnuler, boutonEnregistrer);

    // Valeurs de référence, pour qu'« Annuler » restaure réellement l'état
    // d'origine au lieu de laisser des modifications à moitié saisies.
    var valeurs = {};
    function memoriser() {
      champs.forEach(function (c, i) {
        valeurs[i] = (c.type === 'checkbox' || c.type === 'radio') ? c.checked : c.value;
      });
    }
    function restaurer() {
      champs.forEach(function (c, i) {
        if (c.type === 'checkbox' || c.type === 'radio') c.checked = valeurs[i];
        else c.value = valeurs[i];
      });
    }

    function verrouiller() {
      champs.forEach(function (c) { c.disabled = true; });
      boutonModifier.style.display = '';
      boutonEnregistrer.style.display = 'none';
      boutonAnnuler.style.display = 'none';
    }

    function deverrouiller() {
      memoriser();
      champs.forEach(function (c) { c.disabled = false; });
      boutonModifier.style.display = 'none';
      boutonEnregistrer.style.display = '';
      boutonAnnuler.style.display = '';
      if (champs[0]) champs[0].focus();
    }

    boutonModifier.addEventListener('click', deverrouiller);
    boutonAnnuler.addEventListener('click', function () {
      restaurer();
      verrouiller();
    });

    verrouiller();
    return { verrouiller: verrouiller, deverrouiller: deverrouiller, memoriser: memoriser };
  }

  window.ArdoiseEdition = { installer: installer };
})();

/* ==========================================================================
   BOÎTES DE DIALOGUE STYLÉES — remplacent confirm() et prompt()

   Les boîtes natives du navigateur (grises, police système, position
   imposée) tranchent avec le reste de l'interface — au même titre que les
   boutons non stylés corrigés plus haut. Ces deux fonctions reproduisent leur
   usage (retour par Promise, à utiliser avec `await`) sans dépendre d'aucun
   balisage ajouté dans les pages : la boîte est construite et détruite en JS
   pur à chaque appel, ce qui évite de modifier les 34 fichiers HTML pour
   ajouter un conteneur.

   Utilisation, en remplacement direct de l'existant :
     if (!confirm('Supprimer ?')) return;
       devient
     if (!(await ArdoiseUI.confirmer('Supprimer ?'))) return;

     const motif = prompt('Motif ?');
       devient
     const motif = await ArdoiseUI.demander('Motif ?');
   ========================================================================== */
(function () {
  'use strict';

  /** Devine si l'action est destructrice, pour styler le bouton en rouge. */
  function estDangereux(message) {
    return /supprim|irr[ée]versible|retirer d[ée]finitivement|écarter/i.test(message);
  }

  function construireBoite(contenuInterne, classeBoite) {
    const voile = document.createElement('div');
    voile.className = 'voile-confirmation';
    voile.innerHTML = `<div class="boite-confirmation${classeBoite ? ' ' + classeBoite : ''}">${contenuInterne}</div>`;
    document.body.appendChild(voile);
    // Un cadre à peine posé dans le DOM n'anime pas sa transition d'opacité :
    // le rAF laisse le navigateur peindre l'état initial avant de basculer.
    requestAnimationFrame(() => requestAnimationFrame(() => voile.classList.add('visible')));
    return voile;
  }

  function detruireBoite(voile) {
    voile.classList.remove('visible');
    setTimeout(() => voile.remove(), 220);
  }

  /**
   * @param {string} message
   * @param {object} [options]
   * @param {boolean} [options.danger]         force ou désactive le style rouge
   * @param {string}  [options.libelleValider]  par défaut "Supprimer" ou "Confirmer"
   * @param {string}  [options.libelleAnnuler]  par défaut "Annuler"
   * @returns {Promise<boolean>}
   */
  function confirmer(message, options) {
    options = options || {};
    const danger = options.danger !== undefined ? options.danger : estDangereux(message);
    const libelleValider = options.libelleValider || (danger ? 'Supprimer' : 'Confirmer');
    const libelleAnnuler = options.libelleAnnuler || 'Annuler';

    return new Promise((resolve) => {
      const voile = construireBoite(
        `<h3></h3><p></p>
         <div class="actions">
           <button type="button" class="annuler"></button>
           <button type="button" class="valider"></button>
         </div>`,
        danger ? 'danger' : ''
      );
      // textContent, jamais innerHTML, pour le message : il contient souvent
      // des noms d'élèves ou de classes saisis par l'école, jamais fiables
      // comme HTML.
      voile.querySelector('h3').textContent = danger ? 'Confirmer la suppression' : 'Confirmation';
      voile.querySelector('p').textContent = message;
      voile.querySelector('.annuler').textContent = libelleAnnuler;
      voile.querySelector('.valider').textContent = libelleValider;

      function conclure(resultat) {
        document.removeEventListener('keydown', surEchap);
        detruireBoite(voile);
        resolve(resultat);
      }
      function surEchap(e) { if (e.key === 'Escape') conclure(false); }

      voile.querySelector('.annuler').addEventListener('click', () => conclure(false));
      voile.querySelector('.valider').addEventListener('click', () => conclure(true));
      // Cliquer hors de la boîte équivaut à Annuler, jamais à Confirmer : une
      // action destructrice ne doit jamais pouvoir se déclencher par un clic
      // égaré à l'extérieur.
      voile.addEventListener('click', (e) => { if (e.target === voile) conclure(false); });
      document.addEventListener('keydown', surEchap);
      voile.querySelector('.valider').focus();
    });
  }

  /**
   * @param {string} message
   * @param {string} [valeurDefaut]
   * @returns {Promise<string|null>} null si annulé, comme prompt()
   */
  function demander(message, valeurDefaut) {
    return new Promise((resolve) => {
      const voile = construireBoite(
        `<h3></h3><p></p>
         <input type="text" class="champ-demande" style="width:100%; box-sizing:border-box; margin-bottom:16px;
                padding:9px 11px; border:1.5px solid var(--bordure,#ddd); border-radius:var(--r-bouton,8px);
                font-family:inherit; font-size:0.9rem;" />
         <div class="actions">
           <button type="button" class="annuler">Annuler</button>
           <button type="button" class="valider">Valider</button>
         </div>`
      );
      voile.querySelector('h3').textContent = 'Une information';
      voile.querySelector('p').textContent = message;
      const champ = voile.querySelector('.champ-demande');
      champ.value = valeurDefaut || '';

      function conclure(resultat) {
        document.removeEventListener('keydown', surTouche);
        detruireBoite(voile);
        resolve(resultat);
      }
      function surTouche(e) {
        if (e.key === 'Escape') conclure(null);
        if (e.key === 'Enter' && document.activeElement === champ) conclure(champ.value);
      }

      voile.querySelector('.annuler').addEventListener('click', () => conclure(null));
      voile.querySelector('.valider').addEventListener('click', () => conclure(champ.value));
      voile.addEventListener('click', (e) => { if (e.target === voile) conclure(null); });
      document.addEventListener('keydown', surTouche);
      setTimeout(() => champ.focus(), 50);
    });
  }

  window.ArdoiseUI = window.ArdoiseUI || {};
  window.ArdoiseUI.confirmer = confirmer;
  window.ArdoiseUI.demander = demander;
})();


/* =============================================================================
   ARDOISE — CE QUE L'OFFRE DE L'ÉCOLE OUVRE, ET CE QU'ELLE N'OUVRE PAS
   =============================================================================

   LE PROBLÈME QU'IL RÈGLE
   -----------------------
   Le serveur refuse maintenant les modules qu'une école n'a pas souscrits, avec
   un code 402 et un message clair. C'est la bonne décision côté sécurité — mais
   à l'écran, sans ce module, le directeur d'une école en Ascension voit
   « Comptabilité » dans son menu, clique, et reçoit une erreur. Il en conclut
   que le logiciel est cassé, pas que son offre ne comprend pas ce module.

   CE QU'IL FAIT
   -------------
     1. Il retire du menu les entrées que l'offre ne comprend pas. Ce qui n'est
        pas proposé n'est pas montré grisé ni barré : il n'est pas montré.
     2. Il intercepte les 402 restants — lien direct, favori, redirection — et
        affiche un message qui nomme ce qui manque, avec un chemin vers les
        offres.

   POURQUOI ICI ET PAS DANS UN FICHIER À PART
   ------------------------------------------
   Parce que `ui.js` est déjà chargé par les trente écrans de l'application et
   construit déjà le menu. Un trente-et-unième fichier aurait demandé d'ajouter
   une balise `<script>` à trente pages HTML, avec la certitude d'en oublier
   une — et c'est sur celle-là que l'entrée morte serait restée.

   CE QU'IL N'EST PAS
   ------------------
   Un contrôle de sécurité. Masquer une entrée de menu n'empêche personne
   d'appeler l'API. Le seul verrou qui compte est celui du serveur
   (`middleware/offre.middleware.js`) ; celui-ci ne sert qu'au confort.

   UNE LIMITE ASSUMÉE
   ------------------
   Les droits sont lus par le réseau, donc APRÈS la construction du menu. Pour
   éviter que chaque page ne montre l'entrée une fraction de seconde avant de la
   retirer, la réponse est mise en cache dans `sessionStorage` et appliquée
   immédiatement au chargement suivant. Conséquence : après un changement
   d'offre, la première page affichée peut encore montrer l'ancien menu. La
   suivante est juste, et le serveur, lui, était déjà à jour.
   ============================================================================= */

(function () {
  'use strict';

  /* Quelle page dépend de quelle fonctionnalité.
     Une page absente de cette table reste visible dans les quatre offres —
     c'est le bon défaut : une page oubliée ici reste accessible, alors qu'un
     verrou posé par erreur masquerait une fonction essentielle. */
  var PAGES_CONDITIONNEES = {
    'comptabilite.html':       'comptabilite',
    'emploi-du-temps.html':    'emploi_du_temps',
    'discipline.html':         'discipline',
    'inscriptions.html':       'concours_admission',
    'orientation.html':        'orientation',
    'repechage.html':          'repechage',
    'rapports.html':           'rapports_avances',
    'generateur-modeles.html': 'modeles_personnalises'
  };

  /* Comment nommer une fonctionnalité à un directeur. Le code technique
     (`ia_reglement_discipline`) ne veut rien dire pour lui. */
  var LIBELLES = {
    comptabilite:            'la comptabilité',
    paie:                    'la paie du personnel',
    emploi_du_temps:         "l'emploi du temps",
    discipline:              'la discipline',
    concours_admission:      "les concours d'admission",
    orientation:             "l'orientation des élèves",
    repechage:               'la session de repêchage',
    rapports_avances:        'les rapports avancés',
    modeles_personnalises:   "l'éditeur de modèles de bulletins",
    communication_masse:     'la diffusion de messages aux parents',
    site_public:             "le site public de l'école",
    whatsapp:                "l'assistant WhatsApp",
    ia_analyse_donnees:      "l'analyse des données par l'IA",
    ia_reglement_discipline: "la lecture du règlement intérieur par l'IA"
  };

  var CLE_CACHE = 'ardoise_droits_offre';

  function baseApi() {
    if (typeof API_BASE_URL === 'string' && API_BASE_URL) return API_BASE_URL;
    return window.API_BASE_URL || 'https://scolaire-saas-backend.onrender.com';
  }

  /* Même lecture que session.js : sessionStorage d'abord, localStorage ensuite.
     Recopier la logique plutôt que de l'exporter est un choix discutable ; ces
     deux lignes suivraient un changement de nom de clé sans qu'on y pense, et
     c'est le genre de dette qu'on paie un jour. */
  function jeton() {
    try {
      return sessionStorage.getItem('ardoise_access_token')
          || localStorage.getItem('ardoise_access_token');
    } catch (e) { return null; }
  }

  function lireCache() {
    try {
      var brut = sessionStorage.getItem(CLE_CACHE);
      return brut ? JSON.parse(brut) : null;
    } catch (e) { return null; }
  }

  function ecrireCache(droits) {
    try { sessionStorage.setItem(CLE_CACHE, JSON.stringify(droits)); } catch (e) { /* mode privé */ }
  }

  /* ------------------------------------------------------------- Le menu */

  function appliquer(droits) {
    if (!droits) return;

    Object.keys(PAGES_CONDITIONNEES).forEach(function (page) {
      if (droits[PAGES_CONDITIONNEES[page]] === true) return;

      document.querySelectorAll('.nav-item[href="' + page + '"]').forEach(function (lien) {
        var li = lien.closest('li');
        // `style.display = 'none'` et non `remove()` : c'est exactement ce que
        // fait déjà le masquage par rôle plus haut dans ce fichier, et le
        // réducteur de rail (`reduireRail`) s'appuie sur cette convention pour
        // écarter les entrées. Retirer l'élément du DOM lui ferait recompter un
        // menu dont il garde des références.
        if (li) li.style.display = 'none'; else lien.hidden = true;
      });

      // Le tiroir « Tous les menus » a capturé sa liste avant nous : on l'y
      // retire aussi, sans quoi une entrée masquée y resterait cliquable.
      if (window.ArdoiseRail && Array.isArray(window.ArdoiseRail.elements)) {
        window.ArdoiseRail.elements = window.ArdoiseRail.elements.filter(function (e) {
          return e.page !== page;
        });
        if (window.ArdoiseRail.disponibles) delete window.ArdoiseRail.disponibles[page];
      }
    });
  }

  function chargerDroits() {
    // Le cache d'abord : le menu est juste dès la deuxième page.
    appliquer(lireCache());

    var t = jeton();
    if (!t) return;

    fetch(baseApi() + '/abonnements/courant', { headers: { Authorization: 'Bearer ' + t } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (abonnement) {
        // Pas d'abonnement lisible : on ne masque RIEN et on ne touche pas au
        // cache. Une panne de facturation ne doit pas vider le menu d'une école
        // qui a payé — c'est la même règle que côté serveur.
        if (!abonnement || !abonnement.offre || !abonnement.offre.fonctionnalites) return;
        ecrireCache(abonnement.offre.fonctionnalites);
        appliquer(abonnement.offre.fonctionnalites);
      })
      .catch(function () { /* silencieux : le menu reste tel quel */ });
  }

  /* ---------------------------------------------------------- Les refus */

  function intercepter402() {
    var fetchOrigine = window.fetch;

    window.fetch = function () {
      return fetchOrigine.apply(this, arguments).then(function (reponse) {
        if (reponse.status !== 402) return reponse;

        // On lit une COPIE : le corps d'une réponse ne se lit qu'une fois, et
        // la page appelante a le droit de le lire à son tour.
        reponse.clone().json().then(function (corps) {
          if (!corps) return;
          if (corps.code !== 'offre_insuffisante' && corps.code !== 'plafond_atteint') return;

          var message;
          if (corps.code === 'plafond_atteint') {
            message = corps.message
                    + ' Vos données restent intactes et modifiables : seules les créations '
                    + 'supplémentaires sont suspendues.';
          } else {
            var quoi = LIBELLES[corps.fonctionnalite] || 'ce module';
            message = 'Votre abonnement ne comprend pas ' + quoi + '. '
                    + 'Rien n\u2019est perdu : il s\u2019ouvre dès le changement d\u2019offre.';
          }

          if (window.ArdoiseUI && window.ArdoiseUI.confirmer) {
            window.ArdoiseUI.confirmer(message, {
              danger: false,
              libelleValider: 'Voir mon abonnement',
              libelleAnnuler: 'Fermer'
            }).then(function (ok) {
              // `#details-abonnement` est l'identifiant RÉEL du bloc dans
              // parametres.html. `#abonnement` n'existe pas : le lien aurait
              // ouvert la page en haut, et le directeur aurait cherché son
              // abonnement au milieu de dix autres réglages.
              if (ok) window.location.href = 'parametres.html#details-abonnement';
            });
          } else {
            alert(message);
          }
        }).catch(function () { /* corps illisible : on n'invente pas de message */ });

        return reponse;
      });
    };
  }

  function demarrer() {
    intercepter402();
    chargerDroits();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();
