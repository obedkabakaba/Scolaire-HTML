/**
 * Ardoise — Studio de bulletins : mode RECONSTRUCTION.
 *
 * Pour une photo de bulletin DÉJÀ REMPLI (ou mal cadrée, ou floue), écrire
 * par-dessus l'image n'a pas de sens. L'IA lit la photo et décrit la mise en
 * page imprimée — en-tête, libellés, colonnes du tableau, lignes du bas,
 * pied de page, illustrations — sans reprendre ce qui y était écrit. Ardoise
 * redessine alors le bulletin à neuf (utils/bulletin-reconstruit.template.js
 * côté serveur) :
 *
 *   · le tableau des cotes compte autant de lignes que la classe a de
 *     branches — 10, 13 ou 16, sans rien régler ;
 *   · les armoiries, le drapeau ou le logo sont recopiés de la photo ;
 *   · le résultat est net, quelle que soit la qualité de la photo.
 *
 * Cet écran montre l'aperçu VIVANT (avec un nombre de branches au choix pour
 * vérifier l'adaptation), et permet de corriger la description bloc par bloc.
 *
 * API : window.ArdoiseReconstruction.ouvrir(modele, options)
 *       window.ArdoiseReconstruction.lancer(modele, options)
 * Dépend des fonctions globales de la page : appelApi, afficherMessage.
 */
(function () {
  'use strict';

  var TYPES = {
    entete: 'En-tête', champs: 'Renseignements', titre: 'Titre', texte: 'Texte',
    tableau: 'Tableau des cotes', signatures: 'Signatures', espace: 'Espace'
  };
  var CLES = [
    ['', '(rien — laisser un blanc)'], ['nom_complet', 'Nom complet de l’élève'], ['nom_eleve', 'Nom'],
    ['postnom_eleve', 'Postnom'], ['prenom_eleve', 'Prénom'], ['matricule', 'Matricule'], ['sexe', 'Sexe'],
    ['date_naissance', 'Date de naissance'], ['lieu_naissance', 'Lieu de naissance'], ['classe', 'Classe'],
    ['section', 'Section'], ['option', 'Option'], ['annee_scolaire', 'Année scolaire'], ['periode', 'Période'],
    ['ecole_nom', 'Nom de l’école'], ['ecole_province', 'Province'], ['ecole_ville', 'Ville'],
    ['ecole_commune', 'Commune'], ['nb_eleves', 'Effectif'], ['total', 'Total'], ['pourcentage', 'Pourcentage'],
    ['classement', 'Place'], ['mention', 'Mention'], ['conduite', 'Conduite'], ['application', 'Application'],
    ['observation', 'Observation']
  ];
  var CLES_SIGNATURE = [['', '(case vide)'], ['signature', 'Signature (directeur ou titulaire)'], ['cachet', 'Cachet de l’école'], ['fait_a_le', '« Fait à …, le … »'], ['date', 'Date']];
  var SOURCES = [
    ['cours', 'Nom de la branche'], ['maximum', 'Maximum (période)'], ['cote', 'Cote de la période'],
    ['pourcentage', '% de la branche'], ['p1', '1re période'], ['p2', '2e période'], ['ex', 'Examen S1'],
    ['tot1', 'Total S1'], ['p3', '3e période'], ['p4', '4e période'], ['ex2', 'Examen S2'], ['tot2', 'Total S2'],
    ['tg', 'Total général'], ['max_p1', 'Max. période'], ['max_ex', 'Max. examen S1'], ['max_tot1', 'Max. total S1'],
    ['max_ex2', 'Max. examen S2'], ['max_tot2', 'Max. total S2'], ['max_tg', 'Max. total général'], ['vide', '(ne rien écrire)']
  ];
  var FAMILLES = [['total', 'Totaux'], ['pourcentage', 'Pourcentages'], ['place', 'Places'], ['maxima', 'Maxima généraux'],
    ['application', 'Application'], ['conduite', 'Conduite'], ['vide', '(ligne vide)']];
  var TAILLES = [['petit', 'Petit'], ['normal', 'Normal'], ['grand', 'Grand'], ['tres_grand', 'Très grand']];

  var racine = null, modele = null, options = {}, spec = null, nbDemo = 13, minuteur = null, ouvert = null;
  var controles = null, observateur = null;

  function api(c, o) { return window.appelApi(c, o); }
  function message(t, ty) { if (window.afficherMessage) window.afficherMessage(t, ty); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function options_(liste, courant) {
    return liste.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(courant || '') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }
  function json(m, corps) { return { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }; }

  /* ------------------------------------------------------------------
     LANCEMENT DE L'ANALYSE
     ------------------------------------------------------------------ */
  async function lancer(m, opts) {
    modele = m; options = opts || options;
    racine = document.getElementById('vue-editeur');
    racine.style.display = 'block';
    racine.innerHTML = '<div class="sr-analyse"><div class="sr-scan"><img alt="" src="' + esc(m.fichier_source_url || '') + '" /><span class="sr-faisceau"></span></div>'
      + '<div><h2>Ardoise reconstruit votre bulletin</h2><ol class="sr-etapes">'
      + ['Lecture de la photo', 'En-tête et illustrations', 'Libellés imprimés (les données écrites sont ignorées)', 'Colonnes et lignes du tableau des cotes', 'Pied de page et signatures']
        .map(function (t, i) { return '<li data-i="' + i + '">' + esc(t) + '</li>'; }).join('')
      + '</ol><p class="st-aide">Cela prend en général 20 à 40 secondes.</p></div></div>';
    var i = 0;
    var etapes = racine.querySelectorAll('.sr-etapes li');
    etapes[0].classList.add('actif');
    var t = setInterval(function () {
      if (i < etapes.length - 1) { etapes[i].classList.replace('actif', 'fait'); i++; etapes[i].classList.add('actif'); }
    }, 5000);
    var r = await api('/modeles-bulletins/' + m.id + '/reconstruire', { method: 'POST' });
    clearInterval(t);
    var d = r ? await r.json().catch(function () { return {}; }) : {};
    if (!r || !r.ok) {
      message((d && d.message) || 'La reconstruction n’a pas abouti.', 'erreur');
      if (window.ArdoiseStudio) window.ArdoiseStudio.ouvrir(m, options);
      return;
    }
    m.layout = Object.assign({}, m.layout || {}, { mode: 'reconstruit', reconstruction: d.reconstruction, orientation: d.reconstruction.orientation });
    m.controles_reconstruction = d.controles || null;
    message(d.message, 'succes');
    ouvrir(m, options);
  }

  /* ------------------------------------------------------------------
     ÉCRAN
     ------------------------------------------------------------------ */
  function ouvrir(m, opts) {
    modele = m; options = opts || {};
    spec = JSON.parse(JSON.stringify((m.layout && m.layout.reconstruction) || null));
    if (!spec) { lancer(m, opts); return; }
    controles = m.controles_reconstruction || null;
    racine = document.getElementById('vue-editeur');
    racine.style.display = 'block';
    racine.innerHTML =
      '<div class="st-barre">'
      + '<button type="button" class="bouton bouton-secondaire bouton-petit" data-a="retour">← Modèles</button>'
      + '<input class="st-nom" type="text" aria-label="Nom du modèle" />'
      + '<div class="st-barre-droite">'
      + '<label class="st-interrupteur">Classe de démonstration : <select data-a="nb">'
      + [8, 10, 13, 16].map(function (n) { return '<option value="' + n + '"' + (n === nbDemo ? ' selected' : '') + '>' + n + ' branches</option>'; }).join('')
      + '</select></label>'
      + '<button type="button" class="bouton bouton-secondaire" data-a="pdf">📄 Aperçu PDF</button>'
      + '<button type="button" class="bouton bouton-principal" data-a="activer"></button>'
      + '</div></div>'
      + '<div class="sr-bandeau">🔁 <b>Bulletin reconstruit</b> — Ardoise a redessiné votre modèle à partir de la photo'
      + (spec.rempli ? ', <b>sans les données qui y étaient écrites</b>' : '')
      + '. Le tableau prend autant de lignes que la classe a de branches : changez « Classe de démonstration » pour le voir.'
      + (spec.remarques ? '<br><small>Remarque de l’analyse : ' + esc(spec.remarques) + '</small>' : '') + '</div>'
      + '<div class="st-travail">'
      + '<div class="st-cadre-canvas"><div class="sr-apercu"><iframe title="Aperçu du bulletin reconstruit"></iframe></div></div>'
      + '<aside class="st-panneau">'
      + '<div class="st-onglets"><button type="button" data-onglet="structure" class="actif">Structure</button>'
      + '<button type="button" data-onglet="photo">Photo d’origine</button>'
      + '<button type="button" data-onglet="mode">Mode</button></div>'
      + '<div class="st-vue" data-vue="structure"></div>'
      + '<div class="st-vue" data-vue="photo" hidden></div>'
      + '<div class="st-vue" data-vue="mode" hidden></div>'
      + '</aside></div>';

    racine.querySelector('.st-nom').value = m.nom || '';
    brancherBarre();
    construireStructure();
    construirePhoto();
    construireMode();
    rafraichirApercu();
    window.addEventListener('resize', ajusterApercu);
    // Le cadre change de largeur quand le panneau se replie (téléphone,
    // tablette) : l'aperçu se recalibre, au lieu d'être coupé à droite.
    if (observateur) observateur.disconnect();
    if (window.ResizeObserver) {
      observateur = new ResizeObserver(ajusterApercu);
      observateur.observe(racine.querySelector('.st-cadre-canvas'));
    }
  }

  function majActiver() {
    var b = racine.querySelector('[data-a="activer"]');
    b.textContent = modele.actif ? '✓ Actif — désactiver' : 'Activer ce modèle';
    b.classList.toggle('bouton-principal', !modele.actif);
    b.classList.toggle('bouton-secondaire', !!modele.actif);
  }

  function brancherBarre() {
    majActiver();
    racine.querySelector('[data-a="retour"]').addEventListener('click', function () {
      window.removeEventListener('resize', ajusterApercu);
      racine.style.display = 'none';
      if (options.surRetour) options.surRetour();
    });
    racine.querySelector('.st-nom').addEventListener('change', function (e) {
      var nom = e.target.value.trim(); if (!nom) return;
      api('/modeles-bulletins/' + modele.id, json('PATCH', { nom: nom })).then(function (r) { if (r && r.ok) { modele.nom = nom; message('Nom enregistré.', 'succes'); } });
    });
    racine.querySelector('[data-a="nb"]').addEventListener('change', function (e) { nbDemo = Number(e.target.value); rafraichirApercu(); });
    racine.querySelector('[data-a="pdf"]').addEventListener('click', function () {
      window.ArdoiseGeneration.lancer({
        titre: 'Aperçu du bulletin reconstruit', sujet: modele.nom + ' · ' + nbDemo + ' branches',
        etapes: ['Élèves et cotes fictifs', 'Dessin du bulletin', 'Assemblage du PDF'], dureeEstimee: 10,
        requete: function () { return api('/modeles-bulletins/' + modele.id + '/apercu?nb=' + nbDemo); },
        nomFichier: 'apercu-bulletin-reconstruit.pdf', libellePret: 'Aperçu de votre bulletin'
      });
    });
    racine.querySelector('[data-a="activer"]').addEventListener('click', async function () {
      if (modele.actif) {
        if (!await window.ArdoiseUI.confirmer('Ne plus utiliser ce modèle ? Les bulletins reviendront à la mise en page officielle.', { libelleValider: 'Désactiver' })) return;
        var r1 = await api('/modeles-bulletins/' + modele.id + '/desactiver', { method: 'POST' });
        if (r1 && r1.ok) { modele.actif = false; majActiver(); message('Modèle désactivé.', 'succes'); }
        return;
      }
      if (!await window.ArdoiseUI.confirmer('Utiliser ce bulletin reconstruit pour générer les bulletins de l’école à partir de maintenant ?', { libelleValider: 'Activer' })) return;
      var r = await api('/modeles-bulletins/' + modele.id + '/activer', { method: 'POST' });
      if (r && r.ok) { modele.actif = true; majActiver(); message('Modèle activé.', 'succes'); } else message('Activation impossible.', 'erreur');
    });
    racine.querySelectorAll('.st-onglets button').forEach(function (b) {
      b.addEventListener('click', function () {
        racine.querySelectorAll('.st-onglets button').forEach(function (x) { x.classList.toggle('actif', x === b); });
        racine.querySelectorAll('.st-vue').forEach(function (v) { v.hidden = v.dataset.vue !== b.dataset.onglet; });
      });
    });
  }

  /* ------------------------------------------------------------------
     APERÇU VIVANT
     ------------------------------------------------------------------ */
  async function rafraichirApercu() {
    var r = await api('/modeles-bulletins/' + modele.id + '/apercu?format=html&nb=' + nbDemo);
    if (!r || !r.ok) return;
    var html = await r.text();
    html = html.replace('</style>', '@media screen { body { background: #fff; padding: 22px; width: 794px; box-sizing: border-box; } '
      + '.page { padding-bottom: 26px; margin-bottom: 26px; border-bottom: 2px dashed #bbb; } .page:last-child { border: 0; } }</style>');
    var iframe = racine.querySelector('.sr-apercu iframe');
    iframe.onload = ajusterApercu;
    iframe.srcdoc = html;
  }

  function ajusterApercu() {
    if (!racine) return;
    var cadre = racine.querySelector('.sr-apercu'), iframe = cadre && cadre.querySelector('iframe');
    if (!iframe || !iframe.contentDocument || !iframe.contentDocument.body) return;
    var largeur = cadre.parentElement ? cadre.parentElement.clientWidth - 28 : cadre.clientWidth;
    var k = Math.min(1.3, Math.max(0.2, largeur / 794));
    cadre.style.width = Math.floor(794 * k) + 'px';
    var h = iframe.contentDocument.documentElement.scrollHeight;
    iframe.style.height = h + 'px';
    iframe.style.transform = 'scale(' + k + ')';
    cadre.style.height = Math.ceil(h * k) + 'px';
  }

  /** Enregistre la description puis rafraîchit l'aperçu (une seule écriture par rafale de frappe). */
  function enregistrer() {
    clearTimeout(minuteur);
    minuteur = setTimeout(async function () {
      var r = await api('/modeles-bulletins/' + modele.id, json('PATCH', { reconstruction: spec }));
      if (!r) return;
      var d = await r.json().catch(function () { return {}; });
      if (!r.ok) { message(d.message || 'Enregistrement impossible.', 'erreur'); return; }
      modele.layout = Object.assign({}, modele.layout || {}, { reconstruction: spec });
      if (d.controles) { controles = d.controles; modele.controles_reconstruction = controles; afficherControles(); }
      rafraichirApercu();
    }, 450);
  }

  /* ------------------------------------------------------------------
     STRUCTURE — un bloc à la fois
     ------------------------------------------------------------------ */
  function resume(b) {
    if (b.type === 'tableau') return b.colonnes.length + ' colonnes · ' + (b.branches === 'imprimees' ? 'branches imprimées' : 'une ligne par branche de la classe');
    if (b.type === 'champs') return b.champs.map(function (c) { return c.libelle; }).join(', ');
    if (b.type === 'entete') return b.colonnes.map(function (c) { return c.image ? '[' + c.image + ']' : (c.lignes || []).map(function (l) { return l.texte; })[0] || ''; }).join(' · ');
    if (b.type === 'signatures') return b.cases.map(function (c) { return c.libelle; }).join(' · ');
    if (b.lignes) return (b.lignes[0] || {}).texte || '';
    return '';
  }

  function construireStructure() {
    var v = racine.querySelector('[data-vue="structure"]');
    v.innerHTML = '<div class="sr-controles"></div>'
      + '<p class="st-aide">Le bulletin, de haut en bas. Ouvrez un bloc pour corriger un libellé, une colonne ou une donnée ; l’aperçu suit.</p>'
      + spec.blocs.map(function (b, i) {
        return '<div class="sr-bloc' + (ouvert === i ? ' ouvert' : '') + '" data-i="' + i + '">'
          + '<div class="sr-bloc-tete"><button type="button" class="sr-bloc-titre" data-ouvrir="' + i + '"><b>' + esc(TYPES[b.type] || b.type) + '</b><span>' + esc(resume(b)).slice(0, 90) + '</span></button>'
          + '<span class="sr-bloc-outils"><button type="button" data-monter="' + i + '" title="Monter" aria-label="Monter">↑</button>'
          + '<button type="button" data-descendre="' + i + '" title="Descendre" aria-label="Descendre">↓</button>'
          + (b.type === 'tableau' ? '' : '<button type="button" data-suppr="' + i + '" title="Supprimer" aria-label="Supprimer">✕</button>') + '</span></div>'
          + (ouvert === i ? '<div class="sr-bloc-corps">' + corpsBloc(b, i) + '</div>' : '')
          + '</div>';
      }).join('')
      + '<div class="st-ligne" style="margin-top:10px"><select data-ajout-type>' + options_([['texte', 'Texte'], ['titre', 'Titre'], ['champs', 'Renseignements'], ['signatures', 'Signatures'], ['espace', 'Espace']], 'texte')
      + '</select><button type="button" class="bouton bouton-secondaire bouton-petit" data-ajout>+ Ajouter un bloc</button></div>'
      + '<button type="button" class="st-lien" data-relancer>🪄 Relancer la reconstruction depuis la photo</button>';

    v.querySelectorAll('[data-ouvrir]').forEach(function (b) { b.addEventListener('click', function () { var i = Number(b.dataset.ouvrir); ouvert = ouvert === i ? null : i; construireStructure(); }); });
    v.querySelectorAll('[data-monter]').forEach(function (b) { b.addEventListener('click', function () { deplacer(Number(b.dataset.monter), -1); }); });
    v.querySelectorAll('[data-descendre]').forEach(function (b) { b.addEventListener('click', function () { deplacer(Number(b.dataset.descendre), 1); }); });
    v.querySelectorAll('[data-suppr]').forEach(function (b) { b.addEventListener('click', function () { spec.blocs.splice(Number(b.dataset.suppr), 1); ouvert = null; construireStructure(); enregistrer(); }); });
    v.querySelector('[data-ajout]').addEventListener('click', function () {
      var t = v.querySelector('[data-ajout-type]').value;
      var neuf = { type: t };
      if (t === 'texte' || t === 'titre') neuf.lignes = [{ texte: 'Nouveau texte' }];
      if (t === 'champs') { neuf.colonnes = 2; neuf.champs = [{ libelle: 'NOUVEAU CHAMP', cle: null }]; }
      if (t === 'signatures') neuf.cases = [{ libelle: 'Signature', cle: 'signature' }];
      if (t === 'espace') neuf.hauteur = 4;
      spec.blocs.push(neuf); ouvert = spec.blocs.length - 1; construireStructure(); enregistrer();
    });
    v.querySelector('[data-relancer]').addEventListener('click', async function () {
      if (!await window.ArdoiseUI.confirmer('Relancer l’analyse de la photo ? Vos corrections seront remplacées par une nouvelle reconstruction.', { libelleValider: 'Relancer' })) return;
      lancer(modele, options);
    });
    brancherCorps(v);
    afficherControles();
  }

  /**
   * Résultat du contrôle des colonnes (serveur) : chaque colonne reçoit-elle
   * la donnée que son en-tête annonce ? Les corrections faites d'office et
   * les doutes sont montrés ici, en tête de la structure.
   */
  function afficherControles() {
    var boite = racine && racine.querySelector('.sr-controles');
    if (!boite) return;
    var c = controles || { alertes: [], corrections: [] };
    if (!c.alertes.length && !c.corrections.length) {
      boite.innerHTML = controles ? '<p class="sr-ok">✓ Chaque colonne du tableau reçoit la donnée que son en-tête annonce.</p>' : '';
      return;
    }
    boite.innerHTML = (c.alertes.length ? '<div class="sr-alertes"><b>À vérifier</b><ul>' + c.alertes.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div>' : '')
      + (c.corrections.length ? '<div class="sr-corrections"><b>Corrigé automatiquement</b><ul>' + c.corrections.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div>' : '');
  }

  function deplacer(i, sens) {
    var j = i + sens;
    if (j < 0 || j >= spec.blocs.length) return;
    var t = spec.blocs[i]; spec.blocs[i] = spec.blocs[j]; spec.blocs[j] = t;
    if (ouvert === i) ouvert = j;
    construireStructure(); enregistrer();
  }

  function lignesEditeur(lignes, chemin) {
    return '<div class="sr-lignes">' + lignes.map(function (l, k) {
      return '<div class="sr-ligne"><input type="text" data-c="' + chemin + '.' + k + '.texte" value="' + esc(l.texte) + '" />'
        + '<select data-c="' + chemin + '.' + k + '.taille" title="Taille">' + options_(TAILLES, l.taille || 'normal') + '</select>'
        + '<label title="Gras"><input type="checkbox" data-c="' + chemin + '.' + k + '.gras"' + (l.gras ? ' checked' : '') + ' /> G</label>'
        + '<button type="button" data-retirer="' + chemin + '.' + k + '" aria-label="Retirer la ligne">✕</button>'
        + (l.droite !== undefined ? '<input type="text" class="sr-droite" placeholder="Texte à droite" data-c="' + chemin + '.' + k + '.droite" value="' + esc(l.droite) + '" />' : '')
        + '</div>';
    }).join('') + '<button type="button" class="st-lien" data-ajouter-ligne="' + chemin + '">+ ligne</button></div>';
  }

  function corpsBloc(b, i) {
    var h = '<label class="st-champ st-coche"><input type="checkbox" data-c="blocs.' + i + '.cadre"' + (b.cadre ? ' checked' : '') + ' /> Encadré</label>';
    if (b.type === 'titre' || b.type === 'texte') {
      h += lignesEditeur(b.lignes, 'blocs.' + i + '.lignes')
        + '<p class="st-aide">Une donnée dans le texte s’écrit entre accolades : {classe}, {annee_scolaire}, {nom_complet}, {fait_a_le}…</p>';
    } else if (b.type === 'entete') {
      b.colonnes.forEach(function (c, k) {
        h += '<div class="sr-sous">Colonne ' + (k + 1) + ' — ' + (c.image ? 'illustration « ' + esc(c.image) + ' »' : (c.cle === 'logo_ecole' ? 'logo de l’école' : 'texte')) + '</div>';
        if (c.lignes) h += lignesEditeur(c.lignes, 'blocs.' + i + '.colonnes.' + k + '.lignes');
      });
    } else if (b.type === 'champs') {
      h += '<label class="st-champ">Colonnes<select data-c="blocs.' + i + '.colonnes" data-nombre="1">' + options_([['1', '1'], ['2', '2'], ['3', '3']], String(b.colonnes)) + '</select></label>'
        + b.champs.map(function (c, k) {
          return '<div class="sr-ligne"><input type="text" data-c="blocs.' + i + '.champs.' + k + '.libelle" value="' + esc(c.libelle) + '" />'
            + '<select data-c="blocs.' + i + '.champs.' + k + '.cle">' + options_(CLES, c.cle || '') + '</select>'
            + '<button type="button" data-retirer="blocs.' + i + '.champs.' + k + '" aria-label="Retirer">✕</button></div>';
        }).join('') + '<button type="button" class="st-lien" data-ajouter-champ="' + i + '">+ champ</button>';
    } else if (b.type === 'signatures') {
      h += b.cases.map(function (c, k) {
        return '<div class="sr-ligne"><input type="text" data-c="blocs.' + i + '.cases.' + k + '.libelle" value="' + esc(c.libelle) + '" />'
          + '<select data-c="blocs.' + i + '.cases.' + k + '.cle">' + options_(CLES_SIGNATURE, c.cle || '') + '</select>'
          + '<button type="button" data-retirer="blocs.' + i + '.cases.' + k + '" aria-label="Retirer">✕</button></div>';
      }).join('') + '<button type="button" class="st-lien" data-ajouter-case="' + i + '">+ case</button>';
    } else if (b.type === 'espace') {
      h += '<label class="st-champ">Hauteur (mm)<input type="number" min="1" max="60" data-c="blocs.' + i + '.hauteur" data-nombre="1" value="' + b.hauteur + '" /></label>';
    } else if (b.type === 'tableau') {
      h += '<label class="st-champ">Lignes des branches<select data-c="blocs.' + i + '.branches">'
        + options_([['dynamique', 'Une ligne par branche de la classe (recommandé)'], ['imprimees', 'Noms de branches imprimés (liste fixe)']], b.branches) + '</select></label>';
      if (b.branches === 'imprimees') {
        h += '<label class="st-champ">Branches, de haut en bas<textarea rows="6" data-liste="blocs.' + i + '.branches_imprimees">' + esc((b.branches_imprimees || []).map(function (n) { return n || ''; }).join('\n')) + '</textarea></label>';
      } else {
        h += '<label class="st-champ">Ordre<select data-c="blocs.' + i + '.ordre">' + options_([['maximum', 'Par maximum (comme le bulletin officiel)'], ['alphabetique', 'Alphabétique']], b.ordre) + '</select></label>'
          + '<label class="st-champ">Lignes « MAXIMA »<select data-c="blocs.' + i + '.maxima">' + options_([['par_groupe', 'Une ligne MAXIMA avant chaque groupe de branches'], ['aucun', 'Aucune']], b.maxima) + '</select></label>';
      }
      h += '<h5>Colonnes, de gauche à droite</h5><div class="sr-colonnes">' + b.colonnes.map(function (c, k) {
        var p = 'blocs.' + i + '.colonnes.' + k;
        return '<div class="sr-colonne"><div class="sr-colonne-n">' + (k + 1) + '</div>'
          + '<input type="text" placeholder="Groupe" data-c="' + p + '.groupe" value="' + esc(c.groupe || '') + '" />'
          + '<input type="text" placeholder="Sous-groupe" data-c="' + p + '.sous_groupe" value="' + esc(c.sous_groupe || '') + '" />'
          + '<input type="text" placeholder="En-tête" data-c="' + p + '.entete" value="' + esc(c.entete) + '" />'
          + '<select data-c="' + p + '.source">' + options_(SOURCES, c.source) + '</select>'
          + '<input type="number" min="1" max="100" step="0.5" data-c="' + p + '.largeur" data-nombre="1" value="' + c.largeur + '" title="Largeur relative" />'
          + '<button type="button" data-retirer="' + p + '" aria-label="Retirer la colonne">✕</button>'
          + '<label class="sr-coche-colonne"><input type="checkbox" data-c="' + p + '.noire_sur_maxima"' + (c.noire_sur_maxima ? ' checked' : '') + ' /> noire sur les lignes MAXIMA</label></div>';
      }).join('') + '</div><button type="button" class="st-lien" data-ajouter-colonne="' + i + '">+ colonne</button>'
        + '<h5>Lignes du bas du tableau</h5>'
        + '<p class="st-aide">Cases noires : cliquez les numéros des colonnes noircies sur votre bulletin. « Auto » applique la règle officielle (application et conduite seulement par période).</p>'
        + b.synthese.map(function (s, k) {
          var auto = !Array.isArray(s.noires);
          return '<div class="sr-ligne"><input type="text" data-c="blocs.' + i + '.synthese.' + k + '.libelle" value="' + esc(s.libelle) + '" />'
            + '<select data-c="blocs.' + i + '.synthese.' + k + '.famille">' + options_(FAMILLES, s.famille) + '</select>'
            + '<button type="button" data-retirer="blocs.' + i + '.synthese.' + k + '" aria-label="Retirer">✕</button></div>'
            + '<div class="sr-noires"><button type="button" class="' + (auto ? 'actif' : '') + '" data-noires-auto="' + i + '.' + k + '">Auto</button>'
            + b.colonnes.map(function (col, n) {
              if (n === 0) return '';
              var noire = !auto && s.noires.indexOf(n) !== -1;
              return '<button type="button" class="' + (noire ? 'noire' : '') + '" data-noire="' + i + '.' + k + '.' + n + '" title="' + esc([col.groupe, col.sous_groupe, col.entete].filter(Boolean).join(' › ')) + '">' + n + '</button>';
            }).join('') + '</div>';
        }).join('') + '<button type="button" class="st-lien" data-ajouter-synthese="' + i + '">+ ligne</button>';
    }
    return h;
  }

  /** Lit ou écrit une valeur de `spec` désignée par un chemin « blocs.3.colonnes.2.source ». */
  function cible(chemin) {
    var morceaux = chemin.split('.');
    var objet = spec;
    for (var k = 0; k < morceaux.length - 1; k++) objet = objet[morceaux[k]];
    return { objet: objet, cle: morceaux[morceaux.length - 1] };
  }

  function brancherCorps(v) {
    v.querySelectorAll('[data-c]').forEach(function (el) {
      el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', function () {
        var t = cible(el.dataset.c);
        var valeur = el.type === 'checkbox' ? el.checked : el.value;
        if (el.dataset.nombre) valeur = Number(valeur);
        if (['groupe', 'sous_groupe', 'cle'].indexOf(t.cle) !== -1 && valeur === '') valeur = null;
        t.objet[t.cle] = valeur;
        enregistrer();
        if (el.tagName === 'SELECT' && (t.cle === 'branches')) construireStructure();
        else majResumes();
      });
    });
    v.querySelectorAll('[data-liste]').forEach(function (el) {
      el.addEventListener('input', function () {
        var t = cible(el.dataset.liste);
        t.objet[t.cle] = el.value.split('\n').map(function (l) { return l.trim() || null; });
        enregistrer();
      });
    });
    v.querySelectorAll('[data-retirer]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = cible(b.dataset.retirer);
        if (Array.isArray(t.objet) && t.objet.length > 1) { t.objet.splice(Number(t.cle), 1); construireStructure(); enregistrer(); }
        else message('Gardez au moins un élément.', 'erreur');
      });
    });
    v.querySelectorAll('[data-noire]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.dataset.noire.split('.').map(Number);
        var ligne = spec.blocs[p[0]].synthese[p[1]];
        var liste = Array.isArray(ligne.noires) ? ligne.noires.slice() : [];
        var pos = liste.indexOf(p[2]);
        if (pos === -1) liste.push(p[2]); else liste.splice(pos, 1);
        ligne.noires = liste.sort(function (a, c) { return a - c; });
        construireStructure(); enregistrer();
      });
    });
    v.querySelectorAll('[data-noires-auto]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.dataset.noiresAuto.split('.').map(Number);
        delete spec.blocs[p[0]].synthese[p[1]].noires;
        construireStructure(); enregistrer();
      });
    });
    function ajout(attr, fab) {
      v.querySelectorAll('[' + attr + ']').forEach(function (b) {
        b.addEventListener('click', function () { fab(b.getAttribute(attr)); construireStructure(); enregistrer(); });
      });
    }
    ajout('data-ajouter-ligne', function (chemin) { var t = cible(chemin); t.objet[t.cle].push({ texte: '' }); });
    ajout('data-ajouter-champ', function (i) { spec.blocs[i].champs.push({ libelle: 'NOUVEAU', cle: null }); });
    ajout('data-ajouter-case', function (i) { spec.blocs[i].cases.push({ libelle: 'Signature', cle: null }); });
    ajout('data-ajouter-colonne', function (i) { spec.blocs[i].colonnes.push({ entete: '', groupe: null, sous_groupe: null, source: 'vide', largeur: 8 }); });
    ajout('data-ajouter-synthese', function (i) { spec.blocs[i].synthese.push({ libelle: '', famille: 'vide' }); });
  }

  function majResumes() {
    racine.querySelectorAll('.sr-bloc').forEach(function (el) {
      var b = spec.blocs[Number(el.dataset.i)];
      var s = el.querySelector('.sr-bloc-titre span');
      if (b && s) s.textContent = resume(b).slice(0, 90);
    });
  }

  /* ------------------------------------------------------------------
     PHOTO D'ORIGINE — régions des illustrations recopiées
     ------------------------------------------------------------------ */
  function vignette(im) {
    var px = im.largeur >= 100 ? 0 : (im.x / (100 - im.largeur)) * 100;
    var py = im.hauteur >= 100 ? 0 : (im.y / (100 - im.hauteur)) * 100;
    return '<span class="sr-vignette" style="background-image:url(\'' + esc(modele.fichier_source_url) + '\');background-size:'
      + (10000 / im.largeur) + '% ' + (10000 / im.hauteur) + '%;background-position:' + px + '% ' + py + '%"></span>';
  }

  function construirePhoto() {
    var v = racine.querySelector('[data-vue="photo"]');
    var cadres = (spec.images || []).map(function (im, k) {
      return '<span class="sr-region" style="left:' + im.x + '%;top:' + im.y + '%;width:' + im.largeur + '%;height:' + im.hauteur + '%"><b>' + esc(im.id) + '</b></span>';
    }).join('');
    v.innerHTML = '<p class="st-aide">Les illustrations (armoiries, drapeau, logo) sont recopiées telles quelles depuis ces cadres de la photo. Ajustez un cadre s’il coupe l’image.</p>'
      + '<div class="sr-photo"><img alt="Photo d’origine" src="' + esc(modele.fichier_source_url || '') + '" />' + cadres + '</div>'
      + (spec.images || []).map(function (im, k) {
        var p = 'images.' + k;
        return '<div class="sr-image">' + vignette(im) + '<div><b>' + esc(im.id) + '</b> <small>(' + esc(im.role) + ')</small><div class="sr-quatre">'
          + [['x', 'Gauche'], ['y', 'Haut'], ['largeur', 'Largeur'], ['hauteur', 'Hauteur']].map(function (c) {
            return '<label>' + c[1] + '<input type="number" step="0.1" min="0" max="100" data-img="' + p + '.' + c[0] + '" value="' + im[c[0]] + '" /></label>';
          }).join('') + '</div></div></div>';
      }).join('');
    v.querySelectorAll('[data-img]').forEach(function (el) {
      el.addEventListener('change', function () {
        var t = cible(el.dataset.img);
        t.objet[t.cle] = Math.max(0, Math.min(100, Number(el.value) || 0));
        construirePhoto(); enregistrer();
      });
    });
  }

  function construireMode() {
    var v = racine.querySelector('[data-vue="mode"]');
    v.innerHTML = '<p class="st-aide"><b>Reconstruit</b> (actuel) : Ardoise redessine le bulletin. Recommandé pour une photo déjà remplie, prise de travers ou floue, et pour des classes de tailles différentes.</p>'
      + '<p class="st-aide"><b>Écrire sur l’image</b> : Ardoise imprime votre photo telle quelle et écrit dans les blancs. À réserver à un scan VIERGE et bien droit.</p>'
      + '<button type="button" class="bouton bouton-secondaire" data-mode-image>Passer en mode « écrire sur l’image »</button>';
    v.querySelector('[data-mode-image]').addEventListener('click', async function () {
      var r = await api('/modeles-bulletins/' + modele.id, json('PATCH', { mode: 'image' }));
      if (!r || !r.ok) { message('Changement de mode impossible.', 'erreur'); return; }
      modele.layout = Object.assign({}, modele.layout || {}, { mode: 'image' });
      window.removeEventListener('resize', ajusterApercu);
      window.ArdoiseStudio.ouvrir(modele, options);
    });
  }

  window.ArdoiseReconstruction = { ouvrir: ouvrir, lancer: lancer };
})();
