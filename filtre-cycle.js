/* ==========================================================================
   Ardoise — Filtre de cycle : primaire / secondaire / les deux
   --------------------------------------------------------------------------
   POURQUOI CE FILTRE EXISTE
   Une école qui tient le primaire ET les humanités travaille en réalité sur
   deux établissements superposés : programmes différents, découpage de
   l'année différent (trimestres d'un côté, semestres de l'autre), bulletins
   différents. Sans filtre, chaque écran les additionne — et une liste
   déroulante de classes propose « 3e année primaire » juste au-dessus de
   « 4e Humanités Scientifiques ». Les moyennes d'établissement, elles,
   mélangent deux barèmes qui n'ont rien de comparable.

   CE QU'IL FAIT
   Il pose un sélecteur à trois positions en haut des écrans concernés, retient
   le choix, et l'ajoute à CHAQUE requête de lecture partant de la page. Le
   filtrage lui-même est fait par le serveur : c'est la seule façon de garantir
   qu'aucune liste ne se remplit avec l'autre cycle avant que le filtre ne
   s'applique. Filtrer dans le navigateur laisserait toujours passer le contenu
   d'un menu construit trop tôt.

   POURQUOI IL S'ACCROCHE À fetch
   Chaque page possède sa propre fonction d'appel (`appelApi`), déclarée dans
   son script. Passer par elles obligerait à modifier des centaines d'appels un
   par un, et le premier oubli rouvrirait exactement le mélange qu'on cherche à
   fermer. En complétant `fetch` une seule fois, le filtre couvre tout ce qui
   part de la page, y compris ce qui sera ajouté demain.

   Seules les LECTURES sont touchées (GET), et seulement sur une liste de
   chemins explicites : une écriture ne doit jamais voir son corps ou sa cible
   modifiés par un réglage d'affichage.

   ÉCOLES MONO-CYCLE : le sélecteur ne s'affiche pas et rien n'est ajouté aux
   requêtes. Proposer un choix entre « primaire » et « secondaire » à une école
   qui n'a que le primaire n'aurait aucun sens.
   ========================================================================== */
(function () {
  'use strict';

  var CLE_CYCLE = 'ardoise_cycle';
  var CLE_TYPE = 'ardoise_type_enseignement';
  var REPLI_API = 'https://scolaire-saas-backend.onrender.com';

  // Chemins dont les résultats dépendent du cycle. Tout le reste est laissé
  // intact : ajouter un paramètre à une route qui l'ignore est sans effet,
  // mais mieux vaut une liste explicite qu'un filtre qui se propage à
  // l'aveugle vers des écrans où il n'a pas été réfléchi.
  var CHEMINS_FILTRES = [
    '/classes', '/eleves', '/periodes',
    '/notes', '/bulletins', '/presences', '/discipline',
    '/emploi-du-temps', '/rapports', '/inscriptions', '/orientation',
    '/repechage', '/promotion'
  ];

  function lire(cle) {
    try { return sessionStorage.getItem(cle) || localStorage.getItem(cle); } catch (e) { return null; }
  }
  function ecrire(cle, valeur) {
    try {
      if (sessionStorage.getItem('ardoise_refresh_token')) sessionStorage.setItem(cle, valeur);
      else localStorage.setItem(cle, valeur);
    } catch (e) {}
  }

  /** 'primaire' | 'secondaire' | 'les_deux' — 'les_deux' par défaut. */
  function valeur() {
    var v = lire(CLE_CYCLE);
    return (v === 'primaire' || v === 'secondaire') ? v : 'les_deux';
  }

  /** Le paramètre à transmettre, ou null quand il ne faut rien filtrer. */
  function parametre() {
    if (!estEcoleMixte()) return null;
    var v = valeur();
    return v === 'les_deux' ? null : v;
  }

  function estEcoleMixte() {
    return lire(CLE_TYPE) === 'les_deux';
  }

  // ------------------------------------------------------------------
  //  1. Le paramètre s'ajoute aux lectures
  // ------------------------------------------------------------------
  var fetchOrigine = window.fetch ? window.fetch.bind(window) : null;

  function cheminConcerne(url) {
    try {
      var chemin = new URL(url, window.location.href).pathname;
      return CHEMINS_FILTRES.some(function (c) {
        return chemin === c || chemin.indexOf(c + '/') === 0 || chemin.indexOf(c + '?') === 0;
      });
    } catch (e) { return false; }
  }

  function completerUrl(url) {
    var cycle = parametre();
    if (!cycle || !cheminConcerne(url)) return url;
    // Un `cycle` déjà présent dans l'URL l'emporte : c'est un appel qui sait
    // ce qu'il demande, on ne le contredit pas.
    if (/[?&]cycle=/.test(url)) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'cycle=' + encodeURIComponent(cycle);
  }

  if (fetchOrigine) {
    window.fetch = function (entree, options) {
      var methode = ((options && options.method) || (entree && entree.method) || 'GET').toUpperCase();
      if (methode !== 'GET') return fetchOrigine(entree, options);

      if (typeof entree === 'string') return fetchOrigine(completerUrl(entree), options);
      if (entree && entree.url) {
        var complet = completerUrl(entree.url);
        if (complet !== entree.url) return fetchOrigine(complet, options);
      }
      return fetchOrigine(entree, options);
    };
  }

  // ------------------------------------------------------------------
  //  2. Le sélecteur
  // ------------------------------------------------------------------
  var OPTIONS = [
    { cle: 'primaire', libelle: 'Primaire' },
    { cle: 'secondaire', libelle: 'Secondaire / Humanités' },
    { cle: 'les_deux', libelle: 'Les deux' }
  ];

  function construireSelecteur() {
    if (!estEcoleMixte()) return;
    if (document.getElementById('barre-filtre-cycle')) return;

    // Le sélecteur se pose sous le titre de la page, là où l'œil cherche de
    // quoi parle l'écran. Aucune page n'a besoin d'être modifiée pour
    // l'accueillir.
    var contenu = document.querySelector('.contenu') || document.querySelector('main');
    if (!contenu) return;
    var titre = contenu.querySelector('h1');

    var barre = document.createElement('div');
    barre.id = 'barre-filtre-cycle';
    barre.setAttribute('role', 'group');
    barre.setAttribute('aria-label', "Cycle d'enseignement affiché");
    barre.style.cssText = 'display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:0 0 18px;';

    var etiquette = document.createElement('span');
    etiquette.textContent = 'Cycle affiché';
    etiquette.style.cssText = 'font-size:0.76rem; font-weight:600; text-transform:uppercase;'
      + ' letter-spacing:0.04em; color:var(--texte-att); margin-right:2px;';
    barre.appendChild(etiquette);

    OPTIONS.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.cycle = o.cle;
      b.textContent = o.libelle;
      b.style.cssText = 'padding:7px 13px; border-radius:var(--r-bouton); cursor:pointer;'
        + ' font-family:var(--police-corps); font-size:0.84rem; border:1.5px solid var(--bordure);'
        + ' background:var(--craie-2); color:var(--texte-sombre);';
      b.addEventListener('click', function () { definir(o.cle); });
      barre.appendChild(b);
    });

    if (titre && titre.parentNode) titre.parentNode.insertBefore(barre, titre.nextSibling);
    else contenu.insertBefore(barre, contenu.firstChild);

    majSelecteur();
  }

  function majSelecteur() {
    var courant = valeur();
    var boutons = document.querySelectorAll('#barre-filtre-cycle [data-cycle]');
    for (var i = 0; i < boutons.length; i++) {
      var actif = boutons[i].dataset.cycle === courant;
      boutons[i].style.background = actif ? 'var(--encre)' : 'var(--craie-2)';
      boutons[i].style.color = actif ? 'var(--craie)' : 'var(--texte-sombre)';
      boutons[i].style.borderColor = actif ? 'var(--encre)' : 'var(--bordure)';
      boutons[i].setAttribute('aria-pressed', actif ? 'true' : 'false');
    }
  }

  /**
   * Changer de cycle recharge la page.
   *
   * Un écran affiche souvent plusieurs listes déjà chargées, dont certaines
   * dépendent les unes des autres (la classe choisie détermine les élèves, qui
   * déterminent les cotes). Les rafraîchir une par une laisserait forcément,
   * quelque part, une donnée de l'ancien cycle à côté d'une donnée du nouveau
   * — précisément le mélange que ce filtre existe pour empêcher. Le
   * rechargement garantit un écran homogène.
   */
  function definir(nouveau) {
    if (valeur() === nouveau) return;
    ecrire(CLE_CYCLE, nouveau);
    majSelecteur();
    window.location.reload();
  }

  // ------------------------------------------------------------------
  //  3. Savoir si l'école est mixte
  // ------------------------------------------------------------------
  function rafraichirType(deuxiemeEssai) {
    var jeton = lire('ardoise_access_token');
    if (!jeton) return;
    var base = REPLI_API;
    try { if (typeof API_BASE_URL === 'string' && API_BASE_URL) base = API_BASE_URL; } catch (e) {}

    // fetchOrigine : cette requête ne doit pas être filtrée par elle-même.
    (fetchOrigine || window.fetch)(base + '/ecole/moi', { headers: { Authorization: 'Bearer ' + jeton } })
      .then(function (r) {
        if (r.status === 401 && !deuxiemeEssai) {
          setTimeout(function () { rafraichirType(true); }, 4000);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then(function (ecole) {
        if (!ecole) return;
        var ancien = lire(CLE_TYPE);
        var type = ecole.type_enseignement || null;
        if (type) ecrire(CLE_TYPE, type);
        // L'école vient de passer en mixte : le sélecteur apparaît sans
        // attendre la navigation suivante.
        if (type === 'les_deux' && ancien !== 'les_deux') construireSelecteur();
        // Elle a cessé de l'être : un filtre resté en mémoire masquerait la
        // moitié de ses données sans que rien ne l'explique.
        if (type && type !== 'les_deux' && valeur() !== 'les_deux') {
          ecrire(CLE_CYCLE, 'les_deux');
          window.location.reload();
        }
      })
      .catch(function () { /* hors ligne : le dernier état connu fait foi */ });
  }

  window.ArdoiseCycle = {
    valeur: valeur,
    parametre: parametre,
    definir: definir,
    estEcoleMixte: estEcoleMixte,
    completerUrl: completerUrl
  };

  function demarrer() {
    construireSelecteur();
    rafraichirType(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
