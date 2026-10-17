/**
 * Ardoise — scène de génération des documents (bulletins, fiches, reçus…).
 *
 * POURQUOI
 * ---------------------------------------------------------------------------
 * Deux défauts, un seul fichier pour les régler :
 *
 * 1. L'ATTENTE MUETTE. Générer les bulletins d'une classe de quarante élèves
 *    prend souvent vingt à quarante secondes (le serveur rassemble les cotes,
 *    calcule les places, met en page puis imprime en PDF). Pendant ce temps,
 *    le bouton affichait « Génération en cours… » et rien d'autre : beaucoup
 *    d'utilisateurs recliquaient, croyant la page figée. La scène raconte
 *    maintenant ce qui se passe — une feuille s'écrit, le sceau se pose, les
 *    étapes se cochent, un chronomètre tourne — et propose de continuer à
 *    travailler pendant que le PDF se prépare.
 *
 * 2. LA FENÊTRE BLOQUÉE. Le PDF était ouvert par `window.open()` APRÈS
 *    l'attente réseau. Pour le navigateur, cette ouverture ne vient plus d'un
 *    clic : il la traite comme une publicité et la bloque. L'utilisateur devait
 *    autoriser les fenêtres surgissantes, puis tout regénérer. Désormais le PDF
 *    s'affiche DANS la page, dans une visionneuse intégrée ; « Imprimer »,
 *    « Télécharger » et « Ouvrir dans un onglet » sont des clics directs de
 *    l'utilisateur, qu'aucun navigateur ne bloque.
 *
 * Sur téléphone, où les navigateurs n'affichent pas un PDF dans un cadre, la
 * scène propose deux grands boutons (ouvrir / télécharger) au lieu du cadre.
 *
 * API : window.ArdoiseGeneration
 *   .lancer({ titre, sujet, etapes, astuces, requete, nomFichier, libellePret })
 *       → Promise<boolean>  (true si un PDF a été produit)
 *       `requete` est une fonction qui renvoie la Response (typiquement
 *       `() => appelApi(chemin)`). La scène s'ouvre IMMÉDIATEMENT : appelez
 *       `lancer` directement dans le gestionnaire de clic.
 *   .afficherPdf(blob, { titre, nomFichier })   — visionneuse seule
 *   .fermer()
 */
(function () {
  'use strict';

  var ASTUCES_DEFAUT = [
    'Vous pouvez continuer à travailler : cliquez sur « Continuer en arrière-plan », Ardoise vous prévient dès que le document est prêt.',
    'Le PDF s’affiche ici même, sans fenêtre surgissante : rien à autoriser dans votre navigateur.',
    'Avant d’imprimer toute une classe, « Vérifier puis imprimer » signale les cotes manquantes.',
    'Les places et pourcentages sont recalculés à chaque génération : le document reflète toujours les dernières cotes validées.'
  ];

  var ETAPES_DEFAUT = [
    'Rassemblement des données',
    'Calculs',
    'Mise en page',
    'Préparation du PDF'
  ];

  var voile = null, carte = null, pastille = null;
  var minuteurs = [];
  var urlCourante = null, nomCourant = 'document.pdf', titreCourant = '';
  var resultatEnAttente = null; // PDF arrivé pendant que la scène était réduite

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* Un téléphone ou une tablette n'affichent pas de PDF dans un cadre :
     Chrome Android montre un écran gris, Safari iOS la seule première page. */
  function sansVisionneuseIntegree() {
    if (navigator.pdfViewerEnabled === false) return true;
    var ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua)) return true;
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
    return false;
  }

  function planifier(fn, delai) { minuteurs.push(setTimeout(fn, delai)); }
  function repeter(fn, delai) { minuteurs.push(setInterval(fn, delai)); }
  function arreterMinuteurs() {
    minuteurs.forEach(function (m) { clearTimeout(m); clearInterval(m); });
    minuteurs = [];
  }

  function libererUrl() {
    if (urlCourante) {
      var u = urlCourante;
      // Laisse le temps à un onglet ouvert à l'instant de lire le document.
      setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
      urlCourante = null;
    }
  }

  function surTouche(e) {
    if (e.key === 'Escape' && voile && !voile.classList.contains('gs-en-cours')) fermer();
  }

  function construireVoile() {
    if (voile) voile.remove();
    voile = document.createElement('div');
    voile.className = 'gs-voile';
    voile.setAttribute('role', 'dialog');
    voile.setAttribute('aria-modal', 'true');
    carte = document.createElement('div');
    carte.className = 'gs-carte';
    voile.appendChild(carte);
    document.body.appendChild(voile);
    document.addEventListener('keydown', surTouche);
  }

  function fermer() {
    arreterMinuteurs();
    document.removeEventListener('keydown', surTouche);
    if (voile) {
      var v = voile;
      v.classList.add('gs-sortie');
      setTimeout(function () { v.remove(); }, 200);
    }
    voile = null; carte = null;
    libererUrl();
  }

  /* --------------------------------------------------------------------
     La feuille qui s'écrit : un bulletin miniature dont les lignes se
     remplissent, puis le sceau de l'école se pose, et la feuille rejoint
     la pile. Purement décoratif — aucune information n'en dépend.
     -------------------------------------------------------------------- */
  var SCENE_HTML =
    '<div class="gs-scene" aria-hidden="true">'
    + '<div class="gs-pile"><span></span><span></span><span></span></div>'
    + '<div class="gs-feuille">'
    + '<div class="gs-entete"><i></i><b></b></div>'
    + '<div class="gs-lignes">'
    + '<span style="--l:78%;--d:0s"></span><span style="--l:64%;--d:.25s"></span>'
    + '<span style="--l:84%;--d:.5s"></span><span style="--l:58%;--d:.75s"></span>'
    + '<span style="--l:72%;--d:1s"></span><span style="--l:46%;--d:1.25s"></span>'
    + '</div>'
    + '<div class="gs-sceau"></div>'
    + '</div>'
    + '<svg class="gs-plume" viewBox="0 0 24 24"><path d="M3 21l3.5-1 11-11-2.5-2.5-11 11L3 21z"/><path d="M14 6.5l2.5 2.5"/></svg>'
    + '</div>';

  function compteurFeuilles() { return carte && carte.querySelector('.gs-compteur b'); }

  /**
   * @param {object} o
   * @param {string}   o.titre        « Génération des bulletins »
   * @param {string}  [o.sujet]       « 6e A · 1re période »
   * @param {string[]}[o.etapes]      étapes affichées et cochées au fil du temps
   * @param {string[]}[o.astuces]
   * @param {number}  [o.dureeEstimee] secondes, pour cadencer les étapes (défaut 18)
   * @param {Function} o.requete      () => Promise<Response>
   * @param {string}  [o.nomFichier]
   * @param {string}  [o.libellePret] « Vos bulletins sont prêts »
   */
  function lancer(o) {
    o = o || {};
    var etapes = (o.etapes && o.etapes.length ? o.etapes : ETAPES_DEFAUT).slice();
    var astuces = (o.astuces && o.astuces.length ? o.astuces : []).concat(ASTUCES_DEFAUT);
    var duree = Math.max(4, Number(o.dureeEstimee) || 18);
    titreCourant = o.titre || 'Génération du document';
    nomCourant = o.nomFichier || 'document.pdf';
    resultatEnAttente = null;
    retirerPastille();

    arreterMinuteurs();
    construireVoile();
    voile.classList.add('gs-en-cours');
    carte.innerHTML =
      '<button type="button" class="gs-reduire" title="Continuer en arrière-plan">Continuer en arrière-plan ↘</button>'
      + SCENE_HTML
      + '<h3 class="gs-titre">' + esc(titreCourant) + '</h3>'
      + (o.sujet ? '<p class="gs-sujet">' + esc(o.sujet) + '</p>' : '')
      + '<ol class="gs-etapes">' + etapes.map(function (e, i) {
          return '<li data-i="' + i + '"><span class="gs-puce"></span>' + esc(e) + '</li>';
        }).join('') + '</ol>'
      + '<div class="gs-barre"><span></span></div>'
      + '<p class="gs-chrono"><span class="gs-temps">0 s</span> · <span class="gs-compteur"><b>0</b> feuille(s) écrite(s)</span></p>'
      + '<p class="gs-astuce"></p>';

    // Étapes : chacune s'allume à son tour ; la dernière reste « en cours »
    // jusqu'à la réponse du serveur — on ne coche jamais ce qui n'est pas fait.
    var items = carte.querySelectorAll('.gs-etapes li');
    function allumer(i) {
      if (!carte) return;
      items.forEach(function (li, j) {
        li.classList.toggle('fait', j < i);
        li.classList.toggle('actif', j === i);
      });
    }
    allumer(0);
    var pas = (duree * 1000) / etapes.length;
    for (var i = 1; i < etapes.length; i++) {
      (function (k) { planifier(function () { allumer(k); }, pas * k); })(i);
    }

    var debut = Date.now();
    repeter(function () {
      var t = carte && carte.querySelector('.gs-temps');
      if (!t) return;
      var s = Math.round((Date.now() - debut) / 1000);
      t.textContent = s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + (s % 60) + ' s';
      var barre = carte.querySelector('.gs-barre span');
      // Progression asymptotique : avance vite au début, ne touche jamais 100 %
      // avant la réponse réelle.
      if (barre) barre.style.width = (95 * (1 - Math.exp(-(Date.now() - debut) / (duree * 700)))) + '%';
    }, 250);

    // Chaque cycle de l'animation (3,2 s) « écrit » une feuille de plus.
    var feuilles = 0;
    repeter(function () {
      var b = compteurFeuilles();
      if (b) b.textContent = String(++feuilles);
    }, 3200);

    var ia = 0;
    function astuceSuivante() {
      var p = carte && carte.querySelector('.gs-astuce');
      if (!p) return;
      p.classList.remove('visible');
      setTimeout(function () {
        if (!p.isConnected) return;
        p.textContent = astuces[ia % astuces.length];
        ia++;
        p.classList.add('visible');
      }, 200);
    }
    astuceSuivante();
    repeter(astuceSuivante, 6500);

    carte.querySelector('.gs-reduire').addEventListener('click', reduire);

    return Promise.resolve()
      .then(function () { return o.requete(); })
      .then(function (r) {
        if (!r) { // appelApi renvoie null quand la session a expiré (redirection en cours)
          fermer(); retirerPastille();
          return false;
        }
        if (!r.ok) {
          return r.json().catch(function () { return {}; }).then(function (d) {
            afficherErreur(d.message || 'La génération a échoué (erreur ' + r.status + ').');
            return false;
          });
        }
        return r.blob().then(function (blob) {
          var pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
          if (!voile) { // scène réduite : on prévient sans rien imposer
            resultatEnAttente = pdf;
            pastillePrete(o.libellePret);
          } else {
            afficherPdf(pdf, { titre: o.libellePret, nomFichier: nomCourant });
          }
          return true;
        });
      })
      .catch(function (e) {
        afficherErreur('Connexion interrompue pendant la génération. Vérifiez votre connexion puis réessayez.');
        if (window.console) console.error(e);
        return false;
      });
  }

  function afficherErreur(message) {
    arreterMinuteurs();
    if (!voile) {
      // La scène avait été réduite : on la rouvre pour expliquer l'échec.
      retirerPastille();
      construireVoile();
    }
    voile.classList.remove('gs-en-cours');
    carte.className = 'gs-carte gs-erreur';
    carte.innerHTML =
      '<div class="gs-icone-erreur" aria-hidden="true">!</div>'
      + '<h3 class="gs-titre">' + esc(titreCourant) + ' impossible</h3>'
      + '<p class="gs-message"></p>'
      + '<div class="gs-actions"><button type="button" class="bouton bouton-principal gs-ok">Compris</button></div>';
    carte.querySelector('.gs-message').textContent = message;
    carte.querySelector('.gs-ok').addEventListener('click', fermer);
    carte.querySelector('.gs-ok').focus();
  }

  /* ---------------- Réduction en pastille ---------------- */
  function reduire() {
    arreterMinuteurs();
    document.removeEventListener('keydown', surTouche);
    if (voile) voile.remove();
    voile = null; carte = null;
    retirerPastille();
    pastille = document.createElement('button');
    pastille.type = 'button';
    pastille.className = 'gs-pastille';
    pastille.innerHTML = '<span class="gs-mini-spin"></span><span>' + esc(titreCourant) + '…</span>';
    pastille.title = 'Génération en cours — vous serez prévenu dès que le document est prêt';
    document.body.appendChild(pastille);
  }

  function pastillePrete(libelle) {
    if (!pastille) reduire();
    pastille.classList.add('prete');
    pastille.innerHTML = '<span class="gs-mini-ok">✓</span><span>' + esc(libelle || 'Document prêt') + ' — Afficher</span>';
    pastille.title = '';
    pastille.onclick = function () {
      var pdf = resultatEnAttente;
      resultatEnAttente = null;
      retirerPastille();
      if (pdf) afficherPdf(pdf, { titre: libelle, nomFichier: nomCourant });
    };
  }

  function retirerPastille() {
    if (pastille) pastille.remove();
    pastille = null;
  }

  /* ---------------- Visionneuse ---------------- */
  function telecharger() {
    if (!urlCourante) return;
    var a = document.createElement('a');
    a.href = urlCourante; a.download = nomCourant;
    document.body.appendChild(a); a.click(); a.remove();
  }

  function ouvrirOnglet() {
    if (!urlCourante) return;
    // Appelé depuis un clic : le navigateur l'autorise sans broncher.
    var a = document.createElement('a');
    a.href = urlCourante; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function imprimer(cadre) {
    try {
      cadre.contentWindow.focus();
      cadre.contentWindow.print();
    } catch (e) {
      // Certains navigateurs refusent d'imprimer un PDF hébergé dans un cadre :
      // l'onglet, ouvert par ce même clic, prend le relais.
      ouvrirOnglet();
    }
  }

  function afficherPdf(blob, opts) {
    opts = opts || {};
    arreterMinuteurs();
    libererUrl();
    if (opts.nomFichier) nomCourant = opts.nomFichier;
    urlCourante = URL.createObjectURL(blob);
    if (!voile) construireVoile();
    voile.classList.remove('gs-en-cours');
    var titre = opts.titre || 'Document prêt';
    var mobile = sansVisionneuseIntegree();

    carte.className = 'gs-carte gs-pret' + (mobile ? ' gs-pret-mobile' : ' gs-visionneuse');
    carte.innerHTML =
      '<div class="gs-barre-outils">'
      + '<div class="gs-titre-pret"><span class="gs-mini-ok">✓</span><strong></strong></div>'
      + '<div class="gs-outils">'
      + (mobile ? '' : '<button type="button" class="bouton bouton-principal gs-imprimer">🖨️ Imprimer</button>')
      + '<button type="button" class="bouton bouton-secondaire gs-telecharger">⬇ Télécharger</button>'
      + '<button type="button" class="bouton bouton-secondaire gs-onglet">↗ Ouvrir dans un onglet</button>'
      + '<button type="button" class="gs-fermer" title="Fermer" aria-label="Fermer">×</button>'
      + '</div></div>'
      + (mobile
        ? '<div class="gs-confettis" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>'
          + '<p class="gs-message">Votre document est prêt. Ouvrez-le pour l’imprimer ou l’enregistrer.</p>'
        : '<iframe class="gs-cadre" title="Aperçu du document"></iframe>');

    carte.querySelector('.gs-titre-pret strong').textContent = titre;
    var cadre = carte.querySelector('.gs-cadre');
    if (cadre) cadre.src = urlCourante;
    var bImprimer = carte.querySelector('.gs-imprimer');
    if (bImprimer) bImprimer.addEventListener('click', function () { imprimer(cadre); });
    carte.querySelector('.gs-telecharger').addEventListener('click', telecharger);
    carte.querySelector('.gs-onglet').addEventListener('click', ouvrirOnglet);
    carte.querySelector('.gs-fermer').addEventListener('click', fermer);
    voile.addEventListener('click', function (e) { if (e.target === voile) fermer(); });
    if (mobile) carte.querySelector('.gs-onglet').classList.replace('bouton-secondaire', 'bouton-principal');
  }

  window.ArdoiseGeneration = { lancer: lancer, afficherPdf: afficherPdf, fermer: fermer };
})();
