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
     Démarrage
     ------------------------------------------------------------------ */
  function demarrer() {
    try { injecterIcones(); } catch (e) { /* la navigation reste utilisable sans icônes */ }
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
