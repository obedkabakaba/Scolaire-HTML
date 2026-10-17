/**
 * Ardoise — Studio de bulletins (éditeur des modèles importés).
 *
 * L'école importe l'image (ou le PDF) de SON bulletin. Le studio lui permet de
 * dire à Ardoise où écrire chaque donnée :
 *
 *   · des CHAMPS : nom de l'élève, classe, pourcentage, place, signature…
 *   · un TABLEAU DES COTES : un rectangle posé sur la grille des branches,
 *     découpé en colonnes. Chaque colonne dit ce qu'elle reçoit (nom de la
 *     branche, maximum, 1re période, examen, total du semestre…). Les lignes
 *     se remplissent toutes seules avec les branches de la classe — ou, si
 *     les noms sont déjà imprimés sur le modèle, en face du bon libellé.
 *
 * « Ardoise repère les zones » demande à l'IA une première proposition, que
 * l'école ajuste ensuite à la souris (ou au doigt sur tablette). L'aperçu
 * avec des données fictives montre, sur l'image même, ce que donnera le
 * bulletin ; « Aperçu PDF » produit le vrai document.
 *
 * Le rendu définitif est fait par le serveur
 * (utils/bulletin-personnalise-template.js) : ce fichier ne décide d'aucune
 * valeur, il ne fait que positionner et configurer.
 *
 * Dépend des fonctions globales de la page : appelApi, afficherMessage.
 * API : window.ArdoiseStudio.ouvrir(modele, { surRetour })
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     CATALOGUE — mêmes clés que le serveur. [clé, libellé, valeur fictive]
     ------------------------------------------------------------------ */
  var CHAMPS = [
    { groupe: 'Élève', cles: [
      ['nom_complet', 'Nom complet', 'MUKENDI KABASELE Aline'],
      ['nom_eleve', 'Nom', 'MUKENDI'],
      ['postnom_eleve', 'Postnom', 'KABASELE'],
      ['prenom_eleve', 'Prénom', 'Aline'],
      ['matricule', 'Matricule', 'DEMO-001'],
      ['sexe', 'Sexe', 'F'],
      ['date_naissance', 'Date de naissance', '12/03/2009'],
      ['lieu_naissance', 'Lieu de naissance', 'Kinshasa'],
      ['photo_eleve', 'Photo de l’élève', '[photo]']
    ] },
    { groupe: 'École et classe', cles: [
      ['ecole_nom', 'Nom de l’école', 'Complexe scolaire La Réussite'],
      ['ecole_province', 'Province', 'Kinshasa'],
      ['ecole_ville', 'Ville', 'Kinshasa'],
      ['ecole_commune', 'Commune', 'Lemba'],
      ['logo_ecole', 'Logo de l’école', '[logo]'],
      ['classe', 'Classe', '4e Commerciale'],
      ['section', 'Section', 'Commerciale'],
      ['option', 'Option', 'Gestion'],
      ['annee_scolaire', 'Année scolaire', '2026-2027'],
      ['periode', 'Période', '1re période'],
      ['nb_eleves', 'Effectif de la classe', '38']
    ] },
    { groupe: 'Résultats de la période', cles: [
      ['total', 'Total obtenu', '312'],
      ['total_maximum', 'Total maximum', '400'],
      ['pourcentage', 'Pourcentage', '78%'],
      ['classement', 'Place / effectif', '3/38'],
      ['mention', 'Mention', 'Distinction'],
      ['application', 'Application', 'TB'],
      ['conduite', 'Conduite', 'TB'],
      ['observation', 'Observation', 'Excellent travail.']
    ] },
    { groupe: 'Signatures et date', cles: [
      ['signature', 'Signature', '[signature]'],
      ['cachet', 'Cachet de l’école', '[cachet]'],
      ['fait_a_le', '« Fait à …, le … »', 'Fait à Kinshasa, le 15 décembre 2026'],
      ['date', 'Date d’édition', '15/12/2026'],
      ['duplicata', 'Mention « duplicata »', 'DUPLICATA'],
      ['texte_libre', 'Texte fixe', 'Texte']
    ] }
  ];

  var EPREUVES = [
    ['p1', '1re période'], ['p2', '2e période'], ['ex', 'Examen S1'], ['tot1', 'Total S1'],
    ['p3', '3e période'], ['p4', '4e période'], ['ex2', 'Examen S2'], ['tot2', 'Total S2'], ['tg', 'Total général']
  ];
  var FAMILLES = [
    ['total', 'Total'], ['pourcentage', 'Pourcentage'], ['place', 'Place'],
    ['maxima', 'Maxima généraux'], ['application', 'Application'], ['conduite', 'Conduite']
  ];

  var SOURCES = [
    ['cours', 'Nom de la branche', 'Mathématiques'],
    ['maximum', 'Maximum (de la période)', '20'],
    ['cote', 'Cote de la période', '16'],
    ['pourcentage', '% de la branche', '80%'],
    ['p1', '1re période', '16'], ['p2', '2e période', '14'], ['ex', 'Examen S1', '30'], ['tot1', 'Total S1', '60'],
    ['p3', '3e période', '15'], ['p4', '4e période', '17'], ['ex2', 'Examen S2', '33'], ['tot2', 'Total S2', '65'],
    ['tg', 'Total général', '125'],
    ['max_p1', 'Max. période', '20'], ['max_ex', 'Max. examen S1', '40'], ['max_tot1', 'Max. total S1', '80'],
    ['max_ex2', 'Max. examen S2', '40'], ['max_tot2', 'Max. total S2', '80'], ['max_tg', 'Max. total général', '160'],
    ['vide', '(ne rien écrire)', '']
  ];

  var PRESETS_TABLEAU = {
    periode: { titre: 'Bulletin de période', lignes: 12, colonnes: [['cours', 50], ['maximum', 25], ['cote', 25]] },
    semestre: { titre: 'Grille RDC (2 semestres)', lignes: 14, colonnes: [
      ['cours', 28], ['p1', 7], ['p2', 7], ['ex', 7], ['tot1', 8], ['p3', 7], ['p4', 7], ['ex2', 7], ['tot2', 8], ['tg', 14]] },
    imprime: { titre: 'Noms déjà imprimés', lignes: 14, ordre: 'personnalise', colonnes: [
      ['vide', 30], ['p1', 10], ['p2', 10], ['ex', 10], ['tot1', 10], ['tg', 30]] }
  };

  var LIBELLES = {};
  var FICTIFS = {};
  CHAMPS.forEach(function (g) { g.cles.forEach(function (c) { LIBELLES[c[0]] = c[1]; FICTIFS[c[0]] = c[2]; }); });
  var LIBELLE_SOURCE = {}, FICTIF_SOURCE = {};
  SOURCES.forEach(function (s) { LIBELLE_SOURCE[s[0]] = s[1]; FICTIF_SOURCE[s[0]] = s[2]; });
  var NOMS_FICTIFS = ['Mathématiques', 'Français', 'Anglais', 'Physique', 'Histoire', 'Religion', 'Chimie',
    'Géographie', 'Éducation civique', 'Biologie', 'Informatique', 'Dessin', 'Éducation physique', 'Musique'];

  function libelleZone(z) {
    if (z.config && z.config.type === 'tableau') return 'Tableau des cotes';
    if (LIBELLES[z.cle]) return LIBELLES[z.cle];
    var m = /^(total|pourcentage|place|maxima|application|conduite)_([a-z0-9]+)$/.exec(z.cle);
    if (m) {
      var f = FAMILLES.find(function (x) { return x[0] === m[1]; });
      var e = EPREUVES.find(function (x) { return x[0] === m[2]; });
      return (f ? f[1] : m[1]) + ' · ' + (e ? e[1] : m[2]);
    }
    if (/^note_/.test(z.cle)) return 'Cote : ' + z.cle.slice(5).replace(/_/g, ' ');
    return z.cle;
  }

  function fictif(z) {
    if (z.cle === 'texte_libre') return (z.config && z.config.texte_fixe) || 'Texte';
    if (FICTIFS[z.cle] !== undefined) return FICTIFS[z.cle];
    var m = /^(total|pourcentage|place|maxima|application|conduite)_/.exec(z.cle);
    if (m) return { total: '312', pourcentage: '78%', place: '3/38', maxima: '400', application: 'TB', conduite: 'B' }[m[1]];
    return '12';
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* ------------------------------------------------------------------
     ÉTAT
     ------------------------------------------------------------------ */
  var racine = null, modele = null, zones = [], selection = null, apercu = true, options = {};
  var minuteursSauvegarde = {};

  function api(chemin, opts) { return window.appelApi(chemin, opts); }
  function message(t, type) { if (window.afficherMessage) window.afficherMessage(t, type); }

  function json(methode, corps) {
    return { method: methode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) };
  }

  /* ------------------------------------------------------------------
     STRUCTURE
     ------------------------------------------------------------------ */
  function ouvrir(m, opts) {
    modele = m; options = opts || {}; zones = []; selection = null;
    racine = document.getElementById('vue-editeur');
    racine.innerHTML =
      '<div class="st-barre">'
      + '<button type="button" class="bouton bouton-secondaire bouton-petit" data-action="retour">← Modèles</button>'
      + '<input class="st-nom" type="text" aria-label="Nom du modèle" />'
      + '<div class="st-barre-droite">'
      + '<label class="st-interrupteur"><input type="checkbox" data-action="apercu" checked /> Données fictives</label>'
      + '<select class="st-orientation" aria-label="Orientation"><option value="portrait">Portrait</option><option value="paysage">Paysage</option></select>'
      + '<button type="button" class="bouton bouton-secondaire" data-action="pdf">📄 Aperçu PDF</button>'
      + '<button type="button" class="bouton bouton-principal" data-action="activer"></button>'
      + '</div></div>'
      + '<ol class="st-guide">'
      + '<li><b>1</b> Posez les champs (nom, classe, pourcentage…)</li>'
      + '<li><b>2</b> Dessinez le tableau des cotes et ses colonnes</li>'
      + '<li><b>3</b> Vérifiez l’aperçu PDF, puis activez le modèle</li>'
      + '</ol>'
      + '<div class="st-travail">'
      + '<div class="st-cadre-canvas"><div class="st-canvas" tabindex="0"><img alt="Modèle importé" draggable="false" /></div></div>'
      + '<aside class="st-panneau">'
      + '<div class="st-onglets"><button type="button" data-onglet="ajouter" class="actif">Ajouter</button>'
      + '<button type="button" data-onglet="zones">Zones <span class="st-nb">0</span></button>'
      + '<button type="button" data-onglet="proprietes" disabled>Réglages</button></div>'
      + '<div class="st-vue" data-vue="ajouter"></div>'
      + '<div class="st-vue" data-vue="zones" hidden></div>'
      + '<div class="st-vue" data-vue="proprietes" hidden></div>'
      + '</aside></div>';
    racine.style.display = 'block';

    racine.querySelector('.st-nom').value = m.nom || '';
    racine.querySelector('.st-orientation').value = (m.layout && m.layout.orientation) || 'portrait';
    racine.querySelector('.st-canvas img').src = m.fichier_source_url || '';
    majBoutonActiver();
    construirePanneauAjouter();
    brancherBarre();
    brancherCanvas();
    chargerZones();
  }

  function majBoutonActiver() {
    var b = racine.querySelector('[data-action="activer"]');
    b.textContent = modele.actif ? '✓ Actif — désactiver' : 'Activer ce modèle';
    b.classList.toggle('bouton-principal', !modele.actif);
    b.classList.toggle('bouton-secondaire', !!modele.actif);
  }

  function brancherBarre() {
    racine.querySelector('[data-action="retour"]').addEventListener('click', function () {
      racine.style.display = 'none';
      if (options.surRetour) options.surRetour();
    });
    racine.querySelector('.st-nom').addEventListener('change', function (e) {
      var nom = e.target.value.trim();
      if (!nom) return;
      api('/modeles-bulletins/' + modele.id, json('PATCH', { nom: nom })).then(function (r) {
        if (r && r.ok) { modele.nom = nom; message('Nom enregistré.', 'succes'); }
      });
    });
    racine.querySelector('.st-orientation').addEventListener('change', function (e) {
      api('/modeles-bulletins/' + modele.id, json('PATCH', { orientation: e.target.value })).then(function (r) {
        if (r && r.ok) message('Orientation enregistrée : ' + e.target.value + '.', 'succes');
      });
    });
    racine.querySelector('[data-action="apercu"]').addEventListener('change', function (e) {
      apercu = e.target.checked; dessinerZones();
    });
    racine.querySelector('[data-action="pdf"]').addEventListener('click', function () {
      window.ArdoiseGeneration.lancer({
        titre: 'Aperçu du modèle',
        sujet: modele.nom,
        etapes: ['Élèves et cotes fictifs', 'Placement sur votre image', 'Assemblage du PDF'],
        dureeEstimee: 10,
        requete: function () { return api('/modeles-bulletins/' + modele.id + '/apercu'); },
        nomFichier: 'apercu-modele.pdf',
        libellePret: 'Aperçu de votre modèle'
      });
    });
    racine.querySelector('[data-action="activer"]').addEventListener('click', async function () {
      if (modele.actif) {
        if (!await window.ArdoiseUI.confirmer('Ne plus utiliser ce modèle ? Les bulletins reviendront à la mise en page officielle.', { libelleValider: 'Désactiver' })) return;
        var r1 = await api('/modeles-bulletins/' + modele.id + '/desactiver', { method: 'POST' });
        if (r1 && r1.ok) { modele.actif = false; majBoutonActiver(); message('Modèle désactivé.', 'succes'); }
        return;
      }
      var tableau = zones.some(function (z) { return z.config && z.config.type === 'tableau'; });
      var avert = tableau ? '' : '\n\nAttention : ce modèle n’a pas encore de tableau des cotes — les notes par branche n’y figureront pas.';
      if (!await window.ArdoiseUI.confirmer('Utiliser ce modèle pour générer les bulletins de l’école à partir de maintenant ?' + avert, { libelleValider: 'Activer' })) return;
      var r = await api('/modeles-bulletins/' + modele.id + '/activer', { method: 'POST' });
      if (r && r.ok) { modele.actif = true; majBoutonActiver(); message('Modèle activé : il sera utilisé pour les bulletins.', 'succes'); }
      else message('Activation impossible.', 'erreur');
    });

    racine.querySelectorAll('.st-onglets button').forEach(function (b) {
      b.addEventListener('click', function () { montrerOnglet(b.dataset.onglet); });
    });
  }

  function montrerOnglet(nom) {
    racine.querySelectorAll('.st-onglets button').forEach(function (b) { b.classList.toggle('actif', b.dataset.onglet === nom); });
    racine.querySelectorAll('.st-vue').forEach(function (v) { v.hidden = v.dataset.vue !== nom; });
  }

  /* ------------------------------------------------------------------
     PANNEAU « AJOUTER »
     ------------------------------------------------------------------ */
  function construirePanneauAjouter() {
    var v = racine.querySelector('[data-vue="ajouter"]');
    var html = '<button type="button" class="st-ia" data-action="ia"><span class="st-ia-icone">🪄</span>'
      + '<span><b>Ardoise repère les zones</b><small>L’IA lit votre modèle et propose un placement, tableau des cotes compris.</small></span></button>'
      + '<div class="st-ia-etat" hidden></div>'
      + '<h4>Tableau des cotes</h4><div class="st-presets">';
    Object.keys(PRESETS_TABLEAU).forEach(function (k) {
      html += '<button type="button" class="st-preset" data-preset="' + k + '">▦ ' + esc(PRESETS_TABLEAU[k].titre) + '</button>';
    });
    html += '</div>';
    CHAMPS.forEach(function (g) {
      html += '<details' + (g.groupe === 'Élève' ? ' open' : '') + '><summary>' + esc(g.groupe) + '</summary><div class="st-puces">'
        + g.cles.map(function (c) { return '<button type="button" class="st-puce" data-cle="' + c[0] + '">+ ' + esc(c[1]) + '</button>'; }).join('')
        + '</div></details>';
    });
    html += '<details><summary>Résultats par épreuve (bulletin semestriel)</summary>'
      + '<p class="st-aide">Pour les lignes du bas d’une grille à deux semestres : TOTAUX, POURCENTAGE, PLACE… sous chaque colonne.</p>'
      + '<div class="st-ligne"><select class="st-famille">' + FAMILLES.map(function (f) { return '<option value="' + f[0] + '">' + esc(f[1]) + '</option>'; }).join('') + '</select>'
      + '<select class="st-epreuve">' + EPREUVES.map(function (e) { return '<option value="' + e[0] + '">' + esc(e[1]) + '</option>'; }).join('') + '</select>'
      + '<button type="button" class="bouton bouton-secondaire bouton-petit" data-action="ajout-synthese">+</button></div>'
      + '<button type="button" class="st-lien" data-action="ligne-synthese">Ajouter toute la ligne (9 colonnes)</button>'
      + '</details>';
    v.innerHTML = html;

    v.querySelectorAll('.st-puce').forEach(function (b) {
      b.addEventListener('click', function () { creerZone({ cle: b.dataset.cle }); });
    });
    v.querySelectorAll('.st-preset').forEach(function (b) {
      b.addEventListener('click', function () { creerTableau(b.dataset.preset); });
    });
    v.querySelector('[data-action="ajout-synthese"]').addEventListener('click', function () {
      creerZone({ cle: v.querySelector('.st-famille').value + '_' + v.querySelector('.st-epreuve').value, largeur: 7, hauteur: 2.5 });
    });
    v.querySelector('[data-action="ligne-synthese"]').addEventListener('click', async function () {
      var fam = v.querySelector('.st-famille').value;
      for (var i = 0; i < EPREUVES.length; i++) {
        await creerZone({ cle: fam + '_' + EPREUVES[i][0], x: 30 + i * 7.4, y: 75, largeur: 7, hauteur: 2.2, sansSelection: true });
      }
      message('Ligne ajoutée : ajustez sa position sous les colonnes du tableau.', 'succes');
    });
    v.querySelector('[data-action="ia"]').addEventListener('click', lancerIA);
  }

  async function lancerIA() {
    var etat = racine.querySelector('.st-ia-etat');
    var bouton = racine.querySelector('[data-action="ia"]');
    if (zones.length && !await window.ArdoiseUI.confirmer('Des zones existent déjà. Ardoise va en proposer d’autres sans supprimer les vôtres. Continuer ?', { libelleValider: 'Continuer' })) return;
    bouton.disabled = true; etat.hidden = false;
    var phrases = ['Lecture de l’image du bulletin…', 'Repérage de l’en-tête et de l’identité de l’élève…',
      'Recherche de la grille des branches…', 'Découpage des colonnes du tableau…', 'Vérification des positions…'];
    var i = 0;
    etat.innerHTML = '<span class="st-points"><i></i><i></i><i></i></span><span class="st-ia-texte"></span>';
    var texte = etat.querySelector('.st-ia-texte');
    texte.textContent = phrases[0];
    var minuteur = setInterval(function () { i = Math.min(i + 1, phrases.length - 1); texte.textContent = phrases[i]; }, 3500);
    var r = await api('/modeles-bulletins/' + modele.id + '/suggerer-zones', { method: 'POST' });
    clearInterval(minuteur);
    bouton.disabled = false; etat.hidden = true;
    if (!r) return;
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) { message(d.message || 'Analyse impossible.', 'erreur'); return; }
    message(d.message, d.nb > 0 ? 'succes' : 'erreur');
    if (d.nb > 0) { await chargerZones(); montrerOnglet('zones'); }
  }

  /* ------------------------------------------------------------------
     ZONES — chargement, création, sauvegarde
     ------------------------------------------------------------------ */
  async function chargerZones() {
    var r = await api('/modeles-bulletins/' + modele.id + '/zones');
    if (!r || !r.ok) return;
    zones = (await r.json()).map(normaliser);
    dessinerZones(); majListe();
    if (selection && !zones.find(function (z) { return z.id === selection; })) selectionner(null);
  }

  function normaliser(z) {
    ['x', 'y', 'largeur', 'hauteur', 'taille'].forEach(function (k) { if (z[k] !== null && z[k] !== undefined) z[k] = Number(z[k]); });
    z.largeur = z.largeur || 15; z.hauteur = z.hauteur || 4;
    return z;
  }

  async function creerZone(o) {
    var corps = {
      cle: o.cle, x: o.x != null ? o.x : 35, y: o.y != null ? o.y : 40,
      largeur: o.largeur || (o.cle === 'signature' || o.cle === 'cachet' || /logo|photo/.test(o.cle) ? 14 : 22),
      hauteur: o.hauteur || (o.cle === 'signature' || o.cle === 'cachet' || /logo|photo/.test(o.cle) ? 8 : 2.6),
      taille: o.taille || 10
    };
    if (o.config) corps.config = o.config;
    var r = await api('/modeles-bulletins/' + modele.id + '/zones', json('POST', corps));
    if (!r || !r.ok) {
      var d = r ? await r.json().catch(function () { return {}; }) : {};
      message(d.message || 'Ajout impossible.', 'erreur'); return null;
    }
    var id = (await r.json()).id;
    await chargerZones();
    if (!o.sansSelection) selectionner(id);
    return id;
  }

  function creerTableau(cle) {
    var p = PRESETS_TABLEAU[cle];
    var config = {
      type: 'tableau', lignes: p.lignes, ordre: p.ordre || 'alphabetique',
      colonnes: p.colonnes.map(function (c) { return { source: c[0], largeur: c[1] }; })
    };
    if (p.ordre === 'personnalise') config.cours_ordre = [];
    return creerZone({ cle: 'tableau_cotes', x: 5, y: 35, largeur: 90, hauteur: 40, taille: 8, config: config }).then(function (id) {
      if (id && p.ordre === 'personnalise') message('Indiquez dans « Réglages » les noms des branches imprimés sur votre modèle, de haut en bas.', 'succes');
    });
  }

  /** Sauvegarde différée : un glisser produit des dizaines de mouvements, une seule écriture. */
  function sauvegarder(z, champs, delai) {
    clearTimeout(minuteursSauvegarde[z.id]);
    minuteursSauvegarde[z.id] = setTimeout(async function () {
      var r = await api('/modeles-bulletins/zones/' + z.id, json('PATCH', champs));
      if (r && !r.ok) {
        var d = await r.json().catch(function () { return {}; });
        message(d.message || 'Enregistrement impossible.', 'erreur');
      }
    }, delai == null ? 350 : delai);
  }

  function geometrie(z) { return { x: arrondi(z.x), y: arrondi(z.y), largeur: arrondi(z.largeur), hauteur: arrondi(z.hauteur) }; }
  function arrondi(v) { return Math.round(v * 100) / 100; }

  async function supprimerZone(z) {
    var r = await api('/modeles-bulletins/zones/' + z.id, { method: 'DELETE' });
    if (r && r.ok) { if (selection === z.id) selectionner(null); await chargerZones(); message('Zone supprimée.', 'succes'); }
  }

  /* ------------------------------------------------------------------
     DESSIN
     ------------------------------------------------------------------ */
  function canvas() { return racine.querySelector('.st-canvas'); }

  function dessinerZones() {
    var c = canvas();
    c.querySelectorAll('.st-zone').forEach(function (b) { b.remove(); });
    zones.forEach(function (z) { c.appendChild(boite(z)); });
    racine.querySelector('.st-nb').textContent = String(zones.length);
  }

  function boite(z) {
    var b = document.createElement('div');
    var tableau = z.config && z.config.type === 'tableau';
    b.className = 'st-zone' + (tableau ? ' st-tableau' : '') + (z.id === selection ? ' selectionnee' : '') + (apercu ? ' apercu' : '');
    b.dataset.id = z.id;
    placer(b, z);
    b.innerHTML = '<span class="st-etiquette">' + esc(libelleZone(z)) + '</span>'
      + (tableau ? contenuTableau(z) : '<span class="st-texte" style="' + styleTexte(z) + '">' + (apercu ? esc(fictif(z)) : '') + '</span>')
      + '<span class="st-poignee" data-poignee="1" title="Redimensionner"></span>';
    brancherBoite(b, z);
    return b;
  }

  function placer(b, z) {
    b.style.left = z.x + '%'; b.style.top = z.y + '%';
    b.style.width = z.largeur + '%'; b.style.height = z.hauteur + '%';
  }

  function styleTexte(z) {
    var cfg = z.config || {};
    // La taille est en px de PAGE A4 (794 px de large à 96 dpi) : on la
    // ramène à la largeur affichée, pour que l'aperçu dise la vérité.
    var largeurCanvas = canvas() ? canvas().clientWidth || 794 : 794;
    var px = (Number(z.taille) || 10) * largeurCanvas / 794;
    return 'font-size:' + px.toFixed(1) + 'px;text-align:' + (z.alignement || 'left') + ';justify-content:'
      + ({ left: 'flex-start', center: 'center', right: 'flex-end' }[z.alignement || 'left'])
      + (cfg.gras ? ';font-weight:700' : '');
  }

  function contenuTableau(z) {
    var cfg = z.config;
    var cols = cfg.colonnes || [];
    var total = cols.reduce(function (t, c) { return t + (Number(c.largeur) || 0); }, 0) || 100;
    var noms = cfg.ordre === 'personnalise' && cfg.cours_ordre && cfg.cours_ordre.length ? cfg.cours_ordre : NOMS_FICTIFS;
    var n = Math.max(1, Number(cfg.lignes) || 10);
    var h = 100 / n;
    var html = '<div class="st-entetes">';
    var g = 0;
    cols.forEach(function (c, i) {
      var l = (Number(c.largeur) || 0) / total * 100;
      html += '<span class="st-entete" style="left:' + g + '%;width:' + l + '%" data-col="' + i + '" title="' + esc(LIBELLE_SOURCE[c.source] || c.source) + '">' + esc(court(c.source)) + '</span>';
      g += l;
    });
    html += '</div>';
    for (var r = 1; r < n; r++) html += '<span class="st-trait-h" style="top:' + (r * h) + '%"></span>';
    g = 0;
    cols.forEach(function (c, i) {
      g += (Number(c.largeur) || 0) / total * 100;
      if (i < cols.length - 1) html += '<span class="st-separateur" data-sep="' + i + '" style="left:' + g + '%" title="Glisser pour ajuster la colonne"></span>';
    });
    if (apercu) {
      var taille = 'font-size:' + ((Number(z.taille) || 8) * (canvas() ? canvas().clientWidth || 794 : 794) / 794).toFixed(1) + 'px';
      for (var k = 0; k < n; k++) {
        var nom = noms[k % noms.length];
        if (!nom && cfg.ordre === 'personnalise') continue;
        g = 0;
        html += '<div class="st-ligne-fictive" style="top:' + (k * h) + '%;height:' + h + '%;' + taille + '">';
        cols.forEach(function (c) {
          var l = (Number(c.largeur) || 0) / total * 100;
          var v = c.source === 'cours' ? nom : (c.source === 'vide' ? '' : fictifCellule(c.source, k));
          html += '<span style="left:' + g + '%;width:' + l + '%;text-align:' + (c.alignement || (c.source === 'cours' ? 'left' : 'center')) + '">' + esc(v) + '</span>';
          g += l;
        });
        html += '</div>';
      }
    }
    return html;
  }

  function court(source) {
    return ({ cours: 'Branche', maximum: 'Max', cote: 'Cote', pourcentage: '%', vide: '—', p1: 'P1', p2: 'P2', ex: 'Ex', tot1: 'Tot', p3: 'P3', p4: 'P4', ex2: 'Ex', tot2: 'Tot', tg: 'TG' })[source]
      || (LIBELLE_SOURCE[source] || source).replace('Max. ', 'M.');
  }

  function fictifCellule(source, k) {
    var base = Number(FICTIF_SOURCE[source]) || 10;
    if (/^max_/.test(source) || source === 'maximum') return String(base);
    var v = Math.max(0, Math.round(base * (0.75 + ((k * 37) % 25) / 100)));
    return source === 'pourcentage' ? (60 + (k * 7) % 35) + '%' : String(v);
  }

  /* ------------------------------------------------------------------
     INTERACTIONS (souris, doigt, clavier)
     ------------------------------------------------------------------ */
  function brancherCanvas() {
    var c = canvas();
    c.addEventListener('pointerdown', function (e) { if (e.target === c || e.target.tagName === 'IMG') selectionner(null); });
    if (!clavierBranche) { document.addEventListener('keydown', surTouche); clavierBranche = true; }
    window.addEventListener('resize', function () { if (racine && racine.style.display !== 'none') dessinerZones(); });
    var img = c.querySelector('img');
    img.addEventListener('load', dessinerZones);
  }

  /* Le clavier agit sur la zone sélectionnée où que soit le focus — sauf
     pendant une saisie dans le panneau, où les flèches gardent leur sens. */
  var clavierBranche = false;
  function surTouche(e) {
    if (!racine || racine.style.display === 'none' || !document.body.contains(racine)) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable)) return;
    if (document.querySelector('.gs-voile, .voile-confirmation')) return;
    var c = canvas();
    {
      var z = zones.find(function (x) { return x.id === selection; });
      if (!z) return;
      var pas = e.shiftKey ? 1 : 0.2;
      var dx = { ArrowLeft: -pas, ArrowRight: pas }[e.key] || 0;
      var dy = { ArrowUp: -pas, ArrowDown: pas }[e.key] || 0;
      if (dx || dy) {
        e.preventDefault();
        z.x = borne(z.x + dx, 0, 100 - z.largeur); z.y = borne(z.y + dy, 0, 100 - z.hauteur);
        var b = c.querySelector('.st-zone[data-id="' + z.id + '"]'); if (b) placer(b, z);
        sauvegarder(z, geometrie(z), 600);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault(); supprimerZone(z);
      } else if (e.key === 'Escape') {
        selectionner(null);
      }
    }
  }

  function borne(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function brancherBoite(b, z) {
    b.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      if (selection !== z.id) selectionner(z.id);
      canvas().focus({ preventScroll: true });
      var r = canvas().getBoundingClientRect();
      var depart = { x: e.clientX, y: e.clientY, zx: z.x, zy: z.y, zl: z.largeur, zh: z.hauteur };
      var mode = e.target.dataset.poignee ? 'taille' : (e.target.dataset.sep !== undefined ? 'sep' : 'deplacer');
      var sep = mode === 'sep' ? Number(e.target.dataset.sep) : null;
      var colsDepart = mode === 'sep' ? z.config.colonnes.map(function (c) { return Number(c.largeur) || 0; }) : null;
      b.setPointerCapture(e.pointerId);
      e.preventDefault();

      function bouger(ev) {
        var dx = (ev.clientX - depart.x) / r.width * 100;
        var dy = (ev.clientY - depart.y) / r.height * 100;
        if (mode === 'deplacer') {
          z.x = borne(depart.zx + dx, 0, 100 - z.largeur); z.y = borne(depart.zy + dy, 0, 100 - z.hauteur);
          placer(b, z);
        } else if (mode === 'taille') {
          z.largeur = borne(depart.zl + dx, 2, 100 - z.x); z.hauteur = borne(depart.zh + dy, 1, 100 - z.y);
          placer(b, z);
        } else {
          // Le séparateur déplace la frontière entre deux colonnes voisines,
          // sans toucher aux autres : la somme reste la même.
          var total = colsDepart.reduce(function (t, v) { return t + v; }, 0);
          var delta = dx / z.largeur * total;
          var a = colsDepart[sep] + delta, c2 = colsDepart[sep + 1] - delta;
          if (a < 1 || c2 < 1) return;
          z.config.colonnes[sep].largeur = arrondi(a); z.config.colonnes[sep + 1].largeur = arrondi(c2);
          remplacerBoite(z);
        }
      }
      function finir() {
        b.removeEventListener('pointermove', bouger);
        b.removeEventListener('pointerup', finir);
        b.removeEventListener('pointercancel', finir);
        if (mode === 'sep') { sauvegarder(z, { config: z.config }); construireProprietes(); }
        else if (depart.zx !== z.x || depart.zy !== z.y || depart.zl !== z.largeur || depart.zh !== z.hauteur) {
          sauvegarder(z, geometrie(z), 0);
          if (mode === 'taille') remplacerBoite(z);
        }
      }
      b.addEventListener('pointermove', bouger);
      b.addEventListener('pointerup', finir);
      b.addEventListener('pointercancel', finir);
    });
  }

  /** Reconstruit une boîte sans perdre la capture du pointeur en cours sur l'ancienne. */
  function remplacerBoite(z) {
    var ancienne = canvas().querySelector('.st-zone[data-id="' + z.id + '"]');
    if (!ancienne) return;
    var neuve = boite(z);
    // Pendant un glisser de séparateur, on ne remplace que le contenu.
    ancienne.innerHTML = neuve.innerHTML;
    placer(ancienne, z);
  }

  function selectionner(id) {
    selection = id;
    racine.querySelectorAll('.st-zone').forEach(function (b) { b.classList.toggle('selectionnee', b.dataset.id === id); });
    racine.querySelectorAll('.st-liste li').forEach(function (li) { li.classList.toggle('actif', li.dataset.id === id); });
    var onglet = racine.querySelector('[data-onglet="proprietes"]');
    onglet.disabled = !id;
    if (id) { construireProprietes(); montrerOnglet('proprietes'); }
    else if (onglet.classList.contains('actif')) montrerOnglet('ajouter');
  }

  /* ------------------------------------------------------------------
     LISTE DES ZONES
     ------------------------------------------------------------------ */
  function majListe() {
    var v = racine.querySelector('[data-vue="zones"]');
    if (!zones.length) {
      v.innerHTML = '<p class="st-aide">Aucune zone pour l’instant. Commencez par « Ardoise repère les zones », ou ajoutez-les une à une.</p>';
      return;
    }
    var tableau = zones.some(function (z) { return z.config && z.config.type === 'tableau'; });
    v.innerHTML = (tableau ? '' : '<p class="st-alerte">Pas encore de tableau des cotes : les notes par branche n’apparaîtront pas.</p>')
      + '<ul class="st-liste">' + zones.map(function (z) {
        return '<li data-id="' + z.id + '"' + (z.id === selection ? ' class="actif"' : '') + '><span>' + esc(libelleZone(z)) + '</span>'
          + '<button type="button" data-suppr="' + z.id + '" title="Supprimer" aria-label="Supprimer">✕</button></li>';
      }).join('') + '</ul>'
      + '<p class="st-aide">Astuce : sélectionnez une zone puis utilisez les flèches du clavier pour l’ajuster finement (Maj = pas plus grand), Suppr pour l’effacer.</p>';
    v.querySelectorAll('li').forEach(function (li) {
      li.addEventListener('click', function (e) {
        if (e.target.dataset.suppr) return;
        selectionner(li.dataset.id);
      });
    });
    v.querySelectorAll('[data-suppr]').forEach(function (b) {
      b.addEventListener('click', function () { supprimerZone(zones.find(function (z) { return z.id === b.dataset.suppr; })); });
    });
  }

  /* ------------------------------------------------------------------
     RÉGLAGES DE LA ZONE SÉLECTIONNÉE
     ------------------------------------------------------------------ */
  function optionsChamps(courante) {
    var html = '';
    CHAMPS.forEach(function (g) {
      html += '<optgroup label="' + esc(g.groupe) + '">' + g.cles.map(function (c) {
        return '<option value="' + c[0] + '"' + (c[0] === courante ? ' selected' : '') + '>' + esc(c[1]) + '</option>';
      }).join('') + '</optgroup>';
    });
    var connue = CHAMPS.some(function (g) { return g.cles.some(function (c) { return c[0] === courante; }); });
    if (!connue) html = '<option value="' + esc(courante) + '" selected>' + esc(libelleZone({ cle: courante })) + '</option>' + html;
    return html;
  }

  function construireProprietes() {
    var v = racine.querySelector('[data-vue="proprietes"]');
    var z = zones.find(function (x) { return x.id === selection; });
    if (!z) { v.innerHTML = ''; return; }
    var cfg = z.config || {};
    var tableau = cfg.type === 'tableau';
    var html = '<h4>' + esc(libelleZone(z)) + '</h4>';
    if (!tableau) {
      html += '<label class="st-champ">Donnée affichée<select data-p="cle">' + optionsChamps(z.cle) + '</select></label>';
      if (z.cle === 'texte_libre') {
        html += '<label class="st-champ">Texte<textarea data-p="texte_fixe" rows="2">' + esc(cfg.texte_fixe || '') + '</textarea></label>';
      }
    }
    html += '<div class="st-ligne"><label class="st-champ">Taille du texte<input type="number" min="5" max="40" step="0.5" data-p="taille" value="' + (z.taille || 10) + '" /></label>'
      + '<label class="st-champ st-coche"><input type="checkbox" data-p="gras"' + (cfg.gras ? ' checked' : '') + ' /> Gras</label></div>';
    if (!tableau) {
      html += '<div class="st-alignements" role="group" aria-label="Alignement">'
        + ['left', 'center', 'right'].map(function (a) {
          return '<button type="button" data-align="' + a + '" class="' + ((z.alignement || 'left') === a ? 'actif' : '') + '">'
            + ({ left: '⟸ Gauche', center: '⟺ Centre', right: 'Droite ⟹' })[a] + '</button>';
        }).join('') + '</div>';
    } else {
      html += '<label class="st-champ">Nombre de lignes dessinées sur le modèle<input type="number" min="1" max="80" data-p="lignes" value="' + (cfg.lignes || 10) + '" /></label>'
        + '<label class="st-champ">Ordre des branches<select data-p="ordre">'
        + [['alphabetique', 'Alphabétique'], ['maximum', 'Par maximum (comme le bulletin officiel)'], ['personnalise', 'Noms déjà imprimés sur le modèle']]
          .map(function (o) { return '<option value="' + o[0] + '"' + (cfg.ordre === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')
        + '</select></label>';
      if (cfg.ordre === 'personnalise') {
        html += '<label class="st-champ">Branches imprimées, une par ligne, de haut en bas'
          + '<textarea data-p="cours_ordre" rows="7" placeholder="Religion&#10;Éducation civique&#10;Français&#10;…">' + esc((cfg.cours_ordre || []).map(function (n) { return n || ''; }).join('\n')) + '</textarea>'
          + '<small>Une ligne vide = ligne du modèle sans branche. Les noms sont reconnus sans tenir compte des accents ni des majuscules.</small></label>'
          + '<label class="st-champ st-coche"><input type="checkbox" data-p="ajouter_autres"' + (cfg.ajouter_autres === false ? '' : ' checked') + ' /> Ajouter en dessous les branches non listées</label>';
      }
      html += '<label class="st-champ st-coche"><input type="checkbox" data-p="noircir"' + (cfg.noircir === false ? '' : ' checked') + ' /> Noircir les cases non évaluées (plan d’évaluation)</label>';
      html += '<h5>Colonnes, de gauche à droite</h5><ol class="st-colonnes">'
        + (cfg.colonnes || []).map(function (c, i) {
          return '<li><select data-col-source="' + i + '">' + SOURCES.map(function (s) {
            return '<option value="' + s[0] + '"' + (s[0] === c.source ? ' selected' : '') + '>' + esc(s[1]) + '</option>';
          }).join('') + '</select><input type="number" min="1" max="100" step="0.5" data-col-largeur="' + i + '" value="' + c.largeur + '" title="Largeur relative" />'
            + '<button type="button" data-col-suppr="' + i + '" title="Retirer la colonne" aria-label="Retirer la colonne">✕</button></li>';
        }).join('') + '</ol>'
        + '<div class="st-ligne"><button type="button" class="bouton bouton-secondaire bouton-petit" data-action="col-ajout">+ Colonne</button>'
        + '<button type="button" class="bouton bouton-secondaire bouton-petit" data-action="col-egal">Largeurs égales</button></div>'
        + '<p class="st-aide">Glissez les traits verticaux du tableau, sur l’image, pour caler chaque colonne sur celles du modèle.</p>';
    }
    html += '<button type="button" class="st-supprimer" data-action="suppr-zone">Supprimer cette zone</button>';
    v.innerHTML = html;

    function majConfig(maj) {
      z.config = Object.assign({}, z.config || {}, maj);
      remplacerOuDessiner(z);
      sauvegarder(z, { config: z.config });
    }

    v.querySelectorAll('[data-p]').forEach(function (el) {
      el.addEventListener(el.tagName === 'TEXTAREA' || el.type === 'number' ? 'input' : 'change', function () {
        var p = el.dataset.p;
        if (p === 'cle') {
          z.cle = el.value; remplacerOuDessiner(z); majListe(); sauvegarder(z, { cle: z.cle }, 0); construireProprietes();
        } else if (p === 'taille') {
          z.taille = Number(el.value) || 10; remplacerOuDessiner(z); sauvegarder(z, { taille: z.taille });
        } else if (p === 'gras' || p === 'noircir' || p === 'ajouter_autres') {
          var maj = {}; maj[p] = el.checked; majConfig(maj);
        } else if (p === 'lignes') {
          majConfig({ lignes: Math.max(1, Math.min(80, Number(el.value) || 1)) });
        } else if (p === 'ordre') {
          majConfig({ ordre: el.value, cours_ordre: z.config.cours_ordre || [] }); construireProprietes();
        } else if (p === 'cours_ordre') {
          var noms = el.value.split('\n').map(function (l) { return l.trim() || null; });
          while (noms.length && noms[noms.length - 1] === null) noms.pop();
          var majo = { cours_ordre: noms };
          if (noms.length) majo.lignes = Math.max(z.config.lignes || 1, noms.length);
          majConfig(majo);
        } else if (p === 'texte_fixe') {
          majConfig({ texte_fixe: el.value });
        }
      });
    });
    v.querySelectorAll('[data-align]').forEach(function (b) {
      b.addEventListener('click', function () {
        z.alignement = b.dataset.align; remplacerOuDessiner(z); sauvegarder(z, { alignement: z.alignement }, 0); construireProprietes();
      });
    });
    v.querySelectorAll('[data-col-source]').forEach(function (s) {
      s.addEventListener('change', function () {
        z.config.colonnes[Number(s.dataset.colSource)].source = s.value; majConfig({});
      });
    });
    v.querySelectorAll('[data-col-largeur]').forEach(function (s) {
      s.addEventListener('input', function () {
        z.config.colonnes[Number(s.dataset.colLargeur)].largeur = Math.max(1, Number(s.value) || 1); majConfig({});
      });
    });
    v.querySelectorAll('[data-col-suppr]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (z.config.colonnes.length <= 1) { message('Un tableau garde au moins une colonne.', 'erreur'); return; }
        z.config.colonnes.splice(Number(b.dataset.colSuppr), 1); majConfig({}); construireProprietes();
      });
    });
    var ajout = v.querySelector('[data-action="col-ajout"]');
    if (ajout) ajout.addEventListener('click', function () {
      z.config.colonnes.push({ source: 'vide', largeur: 8 }); majConfig({}); construireProprietes();
    });
    var egal = v.querySelector('[data-action="col-egal"]');
    if (egal) egal.addEventListener('click', function () {
      var n = z.config.colonnes.length;
      z.config.colonnes.forEach(function (c) { c.largeur = arrondi(100 / n); }); majConfig({}); construireProprietes();
    });
    v.querySelector('[data-action="suppr-zone"]').addEventListener('click', function () { supprimerZone(z); });
  }

  function remplacerOuDessiner(z) {
    var b = canvas().querySelector('.st-zone[data-id="' + z.id + '"]');
    if (!b) { dessinerZones(); return; }
    var neuve = boite(z);
    b.replaceWith(neuve);
  }

  window.ArdoiseStudio = { ouvrir: ouvrir, LIBELLES: LIBELLES };
})();
