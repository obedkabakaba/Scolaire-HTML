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
    { titre: 'Bulletins', pages: ['bulletins.html', 'bulletin-annuel.html', 'generateur-modeles.html'] },
    { titre: 'Vie scolaire', pages: ['discipline.html', 'calendrier.html', 'messages.html'] },
    { titre: 'Finances', pages: ['frais-scolaires.html'] },
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
    'discipline.html': 'Faits et conduite',
    'calendrier.html': 'Événements',
    'messages.html': 'Réception et diffusion',
    'frais-scolaires.html': 'Frais et paiements',
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
    comptable: ['frais-scolaires.html', 'rapports.html', 'messages.html', 'mon-profil.html']
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
        + '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONES[e.page] || '') + '</svg>'
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
     Démarrage
     ------------------------------------------------------------------ */
  function demarrer() {
    try { injecterIcones(); } catch (e) { /* la navigation reste utilisable sans icônes */ }
    try { installerMenuMobile(); } catch (e) { /* la barre reste affichée sans bouton */ }
    // Le lanceur attend le filtrage par rôle des pages, qui s'exécute juste après.
    setTimeout(function () {
      try { reduireRail(); } catch (e) { /* le rail complet reste utilisable */ }
      try { construireLanceur(); } catch (e) {}
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
