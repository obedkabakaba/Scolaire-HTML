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
    'eleves.html':
      '<path d="M12 4 2 9l10 5 10-5z"/><path d="M6 11.5V17c0 1.5 3 3 6 3s6-1.5 6-3v-5.5"/>',
    'frais-scolaires.html':
      '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18"/><circle cx="17" cy="15" r="1.3"/>',
    'utilisateurs.html':
      '<circle cx="10" cy="8" r="3.5"/><path d="M3 20a7 7 0 0 1 14 0"/><path d="M19 8v6"/><path d="M16 11h6"/>',
    'classes.html':
      '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-5h6v5"/><path d="M9 8h.01"/><path d="M15 8h.01"/>',
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
    'journal.html':
      '<path d="M3 12h4l2.5 6 5-13 2.5 7h4"/>',
    'parametres.html':
      '<path d="M4 7h9"/><path d="M18 7h2"/><circle cx="15.5" cy="7" r="2.2"/><path d="M4 17h3"/><path d="M12 17h8"/><circle cx="9.5" cy="17" r="2.2"/>',
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

  window.ArdoiseUI = { anneau: anneau, anneauCompact: anneauCompact, barres: barres };


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
     Démarrage
     ------------------------------------------------------------------ */
  function demarrer() {
    try { injecterIcones(); } catch (e) { /* la navigation reste utilisable sans icônes */ }
    try { installerMenuMobile(); } catch (e) { /* la barre reste affichée sans bouton */ }
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
