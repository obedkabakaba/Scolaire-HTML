/* ==========================================================================
   SITE DES ÉCOLES — moteur de ecole.html
   --------------------------------------------------------------------------
   Une seule page HTML, plusieurs rubriques adressées par l'ancre :
     #/          accueil              #/vie       vie scolaire
     #/ecole     l'établissement      #/infos     informations pratiques
     #/inscriptions                   #/contact
     #/parents   espace parents       #/eleve     espace élève

   Deux adresses mènent ici :
     · myardoise.com/ecole.html?code=CODE   — l'ancienne, toujours valable ;
     · myardoise.com/<adresse-de-l-ecole>   — l'adresse courte. Aucun fichier
       ne porte ce nom : GitHub Pages sert alors 404.html, qui charge ce
       même script ; l'adresse est lue dans le chemin.

   Tout ce qui s'affiche vient de GET /public/ecole/:code. Une école qui n'a
   rien configuré obtient malgré tout un site complet : les textes par défaut
   ci-dessous sont volontairement GÉNÉRAUX (aucun chiffre, aucune date, aucun
   nom inventé) et les données réelles (effectifs, options, calendrier,
   sessions d'inscription) remplissent le reste.

   Sécurité : tout texte passe par `e()` ; toute URL par `urlSure()`. Les
   contenus viennent d'une école, mais la page est ouverte à tous.
   ========================================================================== */
(function () {
  'use strict';

  var API = 'https://scolaire-saas-backend.onrender.com';
  var params = new URLSearchParams(window.location.search);
  var CODE = (params.get('code') || '').trim();
  var APERCU = params.get('apercu') === '1';
  // Adresse courte : premier segment du chemin, s'il a la forme d'une
  // adresse d'école. `/faq/` ou `/ecole.html` n'en sont pas.
  var ADRESSE_COURTE = false;
  if (!CODE && !APERCU) {
    var segment = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, '');
    if (/^[a-z0-9]+(-[a-z0-9]+)*$/i.test(segment) && segment.length >= 3 && segment.length <= 40) {
      CODE = segment.toLowerCase();
      ADRESSE_COURTE = true;
    }
  }

  var etat = { d: null, c: null, page: 'accueil', famille: { liste: [], actif: 0, donnees: null, onglet: null } };

  /* ------------------------------------------------------------------ */
  /*  Outils                                                             */
  /* ------------------------------------------------------------------ */
  function e(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function urlSure(v) {
    return typeof v === 'string' && /^https?:\/\//i.test(v.trim()) ? v.trim() : null;
  }
  function $(sel, racine) { return (racine || document).querySelector(sel); }
  function $$(sel, racine) { return Array.prototype.slice.call((racine || document).querySelectorAll(sel)); }
  function initiales(nom) {
    var mots = String(nom || '').replace(/\(.*?\)/g, '').trim().split(/\s+/)
      .filter(function (m) { return m.length > 2 || /^[A-Z]/.test(m); })
      .filter(function (m) { return !/^(de|du|des|la|le|les|et|l'|d')$/i.test(m); });
    return (mots.slice(0, 3).map(function (m) { return m[0]; }).join('') || 'É').toUpperCase();
  }
  var MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  function dateLongue(v) {
    if (!v) return '';
    var d = new Date(v); if (isNaN(d)) return '';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function dateObj(v) { var d = new Date(String(v).length === 10 ? v + 'T00:00:00' : v); return isNaN(d) ? null : d; }
  function montant(v, devise) {
    var n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(v) || 0);
    return devise === 'USD' ? n + ' $' : n + ' FC';
  }
  function lien(page) { return '#/' + (page === 'accueil' ? '' : page); }
  function tel(v) { return 'tel:' + String(v).replace(/[^\d+]/g, ''); }

  /* ------------------------------------------------------------------ */
  /*  Icônes (tracés au trait, 24×24)                                    */
  /* ------------------------------------------------------------------ */
  var TRACES = {
    resultats: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    inscription: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    calendrier: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    telephone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    courriel: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    lieu: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    horloge: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    equipe: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    livre: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2ZM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z"/>',
    etoile: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/>',
    bouclier: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    coeur: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
    portefeuille: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
    coche: '<path d="M20 6 9 17l-5-5"/>',
    sortie: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    cadenas: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    graphique: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    presence: '<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="m9 15 2 2 4-4"/>',
    accueil: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    fleche: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z"/>',
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h0"/>',
    youtube: '<path d="M22.5 6.4a2.8 2.8 0 0 0-2-2C18.8 4 12 4 12 4s-6.8 0-8.5.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 5.6 2.8 2.8 0 0 0 2 2c1.7.4 8.5.4 8.5.4s6.8 0 8.5-.4a2.8 2.8 0 0 0 2-2A29 29 0 0 0 23 12a29 29 0 0 0-.5-5.6Z"/><path d="m10 15 5-3-5-3Z"/>',
    whatsapp: '<path d="M3 21l1.7-5A9 9 0 1 1 8 19.4Z"/><path d="M9 10c0 3 2 5 5 5l1.5-1.5-2-1-1 1c-1 0-2.5-1.5-2.5-2.5l1-1-1-2Z"/>',
    vide: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1Z"/>'
  };
  function ico(nom) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (TRACES[nom] || '') + '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /*  Identité visuelle : blason et illustration                         */
  /* ------------------------------------------------------------------ */
  function blasonSvg(nom) {
    var ini = initiales(nom).slice(0, 3);
    var taille = ini.length > 2 ? 15 : 19;
    return '<svg class="blason" viewBox="0 0 48 48" aria-hidden="true">' +
      '<path d="M24 2 43 8v14c0 12-8.5 20.5-19 24C13.5 42.5 5 34 5 22V8Z" style="fill:var(--accent)"/>' +
      '<path d="M24 6.5 39 11.2V22c0 9.6-6.6 16.6-15 19.6C15.6 38.6 9 31.6 9 22V11.2Z" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1"/>' +
      '<text x="24" y="' + (ini.length > 2 ? 28.5 : 30) + '" text-anchor="middle" fill="#fff" style="font-family:var(--police-titre);font-weight:700;font-size:' + taille + 'px;letter-spacing:.5px">' + e(ini) + '</text></svg>';
  }
  function blason(ecole) {
    var logo = urlSure(ecole.logo_url);
    return logo ? '<img class="blason" src="' + e(logo) + '" alt="" />' : blasonSvg(ecole.nom);
  }

  /* Une école sans photo de couverture garde un héros dessiné : bâtiment,
     drapeau, arbres et soleil, teintés par sa couleur. `clair` = sur fond
     clair (Horizon, Épure) ; sinon trait blanc sur fond sombre. */
  function illustration(clair) {
    var t = clair ? 'var(--texte)' : '#fff';
    var o = clair ? '.9' : '.75';
    var f = clair ? 'var(--surface)' : 'rgba(255,255,255,.07)';
    var fenetres = '';
    for (var r = 0; r < 2; r++) {
      for (var i = 0; i < 4; i++) {
        var x = 152 + i * 34 + (i > 1 ? 112 : 0);
        fenetres += '<rect x="' + x + '" y="' + (238 + r * 48) + '" width="20" height="28" rx="10" style="fill:' + (r === 0 && i % 3 === 0 ? 'var(--accent)' : 'none') + ';fill-opacity:.55;stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2"/>';
      }
    }
    return '<svg viewBox="0 0 600 420" fill="none" aria-hidden="true" style="width:100%;height:100%">' +
      '<circle cx="470" cy="96" r="44" style="fill:var(--accent)" fill-opacity="' + (clair ? '.25' : '.5') + '"/>' +
      '<circle cx="470" cy="96" r="64" style="stroke:var(--accent)" stroke-opacity=".35" stroke-width="2" stroke-dasharray="3 9"/>' +
      '<path d="M96 120c10-6 18-6 26 0M128 104c8-5 15-5 22 0" style="stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M30 360h540" style="stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2.5" stroke-linecap="round"/>' +
      '<rect x="130" y="210" width="340" height="150" style="fill:' + f + ';stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2.5"/>' +
      '<path d="M120 212 300 140l180 72" style="stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<rect x="262" y="150" width="76" height="210" style="fill:' + (clair ? 'var(--fond-alt)' : 'rgba(255,255,255,.1)') + ';stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2.5"/>' +
      '<path d="M255 152 300 112l45 40" style="stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<circle cx="300" cy="190" r="16" style="stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2.5"/><path d="M300 181v9l6 4" style="stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M278 360v-62a22 22 0 0 1 44 0v62" style="fill:var(--accent);fill-opacity:.85;stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2.5"/>' +
      '<path d="M300 112V52" style="stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2.5"/><path d="M300 54h42l-10 12 10 12h-42Z" style="fill:var(--accent)"/>' +
      fenetres +
      '<path d="M70 360v-46" style="stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2.5"/><circle cx="70" cy="292" r="30" style="fill:var(--accent);fill-opacity:.3;stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2.5"/>' +
      '<path d="M530 360v-36" style="stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2.5"/><circle cx="530" cy="306" r="22" style="fill:var(--accent);fill-opacity:.3;stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2.5"/>' +
      '<path d="M480 360v-22" style="stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2.5"/><circle cx="480" cy="330" r="14" style="stroke:' + t + '" stroke-opacity="' + o + '" stroke-width="2.5"/>' +
      '<path d="M200 372h200M230 384h140" style="stroke:' + t + '" stroke-opacity=".3" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /*  Contenus par défaut — généraux, jamais inventés                    */
  /* ------------------------------------------------------------------ */
  function niveau(ecole) {
    return { primaire: 'du primaire', secondaire: 'du secondaire', les_deux: 'du primaire et du secondaire' }[ecole.type_enseignement] || '';
  }
  function lieuEcole(ecole) { return [ecole.commune, ecole.ville].filter(Boolean).join(', ') || ecole.province || ''; }
  function sloganDefaut(ecole) {
    return {
      primaire: 'Apprendre, grandir et s’épanouir — un enfant à la fois.',
      secondaire: 'Former des esprits rigoureux, curieux et responsables.',
      les_deux: 'Du premier cahier au diplôme : un parcours complet, suivi avec soin.'
    }[ecole.type_enseignement] || 'Apprendre, grandir et réussir ensemble.';
  }
  function presentationDefaut(ecole) {
    var lieu = lieuEcole(ecole);
    return ecole.nom + ' accueille les élèves ' + niveau(ecole) + (lieu ? ' à ' + lieu : '') + '. ' +
      'L’établissement accompagne chaque élève avec un encadrement attentif, un suivi régulier de ses résultats ' +
      'et un dialogue suivi avec les familles.\n\nLes parents suivent la scolarité de leur enfant en ligne : ' +
      'bulletins, présences et informations de l’école, depuis l’espace parents de ce site.';
  }
  function atoutsDefaut() {
    return [
      { titre: 'Un encadrement attentif', texte: 'Chaque classe a son titulaire, qui suit les élèves au quotidien et reste l’interlocuteur des familles.', ico: 'equipe' },
      { titre: 'Les résultats en ligne', texte: 'Les bulletins validés sont consultables depuis l’espace parents, avec le matricule et le code d’accès de l’élève.', ico: 'graphique' },
      { titre: 'Une école qui informe', texte: 'Annonces, calendrier et événements de l’année sont publiés ici, au fur et à mesure.', ico: 'message' },
      { titre: 'Discipline et respect', texte: 'Un cadre clair, connu des élèves et des parents, au service des apprentissages.', ico: 'bouclier' }
    ];
  }
  var ICONES_ATOUTS = ['etoile', 'livre', 'coeur', 'bouclier', 'equipe', 'soleil'];
  function piecesDefaut() {
    return ['Acte de naissance ou attestation de naissance', 'Bulletins de l’année scolaire précédente',
      'Deux photos d’identité récentes', 'Attestation de réussite ou de fréquentation (élèves venant d’une autre école)'];
  }
  function faqDefaut(c) {
    var q = [];
    if (c.pages.parents) {
      q.push({ question: 'Comment consulter les résultats de mon enfant ?', reponse: 'Ouvrez l’espace parents de ce site et saisissez le matricule de l’élève et son code d’accès. Ces deux informations sont remises par le secrétariat de l’école.' });
      q.push({ question: 'J’ai perdu le code d’accès. Que faire ?', reponse: 'Adressez-vous au secrétariat : un nouveau code peut être attribué à l’élève. L’ancien cesse alors immédiatement de fonctionner.' });
      q.push({ question: 'Pourquoi les résultats n’apparaissent-ils pas encore ?', reponse: 'Les bulletins sont publiés après leur validation par l’école. Si une date de publication est prévue, elle s’affiche dans l’espace parents. En cas de doute, le secrétariat vous renseignera.' });
    }
    if (c.pages.inscriptions) q.push({ question: 'Comment inscrire mon enfant ?', reponse: 'Remplissez la préinscription en ligne depuis la rubrique Inscriptions, ou présentez-vous au secrétariat. L’école vous recontacte pour compléter le dossier.' });
    q.push({ question: 'Comment joindre l’école ?', reponse: 'Les coordonnées et un formulaire de message se trouvent dans la rubrique Contact. Vous pouvez aussi y demander un rendez-vous avec la direction.' });
    return q;
  }

  /* ------------------------------------------------------------------ */
  /*  Polices par apparence                                              */
  /* ------------------------------------------------------------------ */
  var POLICES = {
    prestige: 'Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700',
    horizon: 'Plus+Jakarta+Sans:wght@400;500;600;700;800',
    eveil: 'Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800',
    campus: 'DM+Serif+Display&family=Inter:wght@400;500;600;700',
    verdure: 'Lora:wght@500;600;700&family=Nunito+Sans:wght@400;600;700',
    epure: 'Manrope:wght@400;500;600;700'
  };
  function appliquerApparence(c) {
    var html = document.documentElement;
    html.setAttribute('data-apparence', c.theme);
    if (/^#[0-9a-f]{6}$/i.test(c.couleur || '')) {
      html.style.setProperty('--accent', c.couleur);
      // Texte lisible sur l'accent : noir si la couleur est claire.
      var r = parseInt(c.couleur.substr(1, 2), 16), g = parseInt(c.couleur.substr(3, 2), 16), b = parseInt(c.couleur.substr(5, 2), 16);
      html.style.setProperty('--sur-accent', (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? '#111' : '#fff');
      var meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', c.couleur);
    }
    var lienPolice = $('#police-site');
    var href = 'https://fonts.googleapis.com/css2?family=' + POLICES[c.theme] + '&display=swap';
    if (lienPolice.getAttribute('href') !== href) lienPolice.setAttribute('href', href);
  }

  /* ------------------------------------------------------------------ */
  /*  Rubriques                                                          */
  /* ------------------------------------------------------------------ */
  var RUBRIQUES = [
    { cle: 'accueil', libelle: 'Accueil' },
    { cle: 'ecole', libelle: 'L’école' },
    { cle: 'inscriptions', libelle: 'Inscriptions' },
    { cle: 'vie', libelle: 'Vie scolaire' },
    { cle: 'infos', libelle: 'Infos pratiques' },
    { cle: 'contact', libelle: 'Contact' }
  ];
  function ouverte(cle) {
    if (cle === 'accueil') return true;
    if (cle === 'eleve') return etat.c.pages.eleves !== false;
    return etat.c.pages[cle] !== false;
  }

  /* ------------------------------------------------------------------ */
  /*  Coquille : en-tête, tiroir, pied                                   */
  /* ------------------------------------------------------------------ */
  function dessinerCoquille() {
    var d = etat.d, ec = d.ecole, c = etat.c;
    var rubriques = RUBRIQUES.filter(function (r) { return ouverte(r.cle); });
    var marque = '<a class="marque" href="#/">' + blason(ec) +
      '<span class="textes"><span class="nom">' + e(ec.nom) + '</span>' +
      (lieuEcole(ec) ? '<span class="lieu">' + e(lieuEcole(ec)) + '</span>' : '') + '</span></a>';

    var haut = '';
    if (ec.telephone || ec.email || d.annee_active) {
      haut = '<div class="bandeau-haut"><div class="contenant"><div class="coord">' +
        (ec.telephone ? '<span>' + ico('telephone') + '<a href="' + e(tel(ec.telephone)) + '">' + e(ec.telephone) + '</a></span>' : '') +
        (ec.email ? '<span>' + ico('courriel') + '<a href="mailto:' + e(ec.email) + '">' + e(ec.email) + '</a></span>' : '') +
        '</div><div class="coord">' +
        (d.annee_active ? '<span>' + ico('calendrier') + 'Année scolaire ' + e(d.annee_active) + '</span>' : '') +
        (ouverte('eleve') ? '<a href="#/eleve">Espace élève</a>' : '') +
        '</div></div></div>';
    }

    var menu = rubriques.map(function (r) {
      return '<a href="' + lien(r.cle) + '" data-page="' + r.cle + '">' + e(r.libelle) + '</a>';
    }).join('');
    var cta = c.pages.parents
      ? '<a class="bouton bouton-entete" href="#/parents">' + ico('cadenas') + 'Espace parents</a>' : '';

    var tiroir = rubriques.map(function (r) {
      return '<a class="lien" href="' + lien(r.cle) + '" data-page="' + r.cle + '">' + e(r.libelle) + '<span>›</span></a>';
    }).join('') + '<div class="actions">' +
      (c.pages.parents ? '<a class="bouton plein" href="#/parents">' + ico('cadenas') + 'Espace parents</a>' : '') +
      (ouverte('eleve') ? '<a class="bouton contour plein" href="#/eleve">Espace élève</a>' : '') +
      (ec.telephone ? '<a class="bouton contour plein" href="' + e(tel(ec.telephone)) + '">' + ico('telephone') + 'Appeler l’école</a>' : '') + '</div>';

    $('#site').innerHTML = haut +
      '<header class="entete" id="entete"><div class="contenant">' + marque +
      '<nav class="menu" aria-label="Menu principal">' + menu + '</nav>' + cta +
      '<button class="burger" id="burger" aria-label="Ouvrir le menu" aria-expanded="false"><span></span></button>' +
      '</div></header><div class="tiroir" id="tiroir">' + tiroir + '</div>' +
      '<main id="contenu" tabindex="-1"></main>' + piedDePage() +
      '<div class="visionneuse" id="visionneuse" role="dialog" aria-modal="true" aria-label="Photo">' +
      '<button class="fermer" aria-label="Fermer">×</button><button class="prec" aria-label="Précédente">‹</button>' +
      '<button class="suiv" aria-label="Suivante">›</button><figure style="margin:0"><img alt="" /><p></p></figure></div>' +
      (APERCU ? '<div class="bandeau-apercu">Aperçu — modifications non enregistrées</div>' : '');

    $('#burger').addEventListener('click', function () {
      var ouvert = document.body.classList.toggle('menu-ouvert');
      this.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    });
    $$('#tiroir a').forEach(function (a) { a.addEventListener('click', function () { document.body.classList.remove('menu-ouvert'); }); });
    brancherVisionneuse();
  }

  function liensReseaux(c) {
    var r = c.reseaux || {}, l = [];
    if (urlSure(r.facebook)) l.push('<a href="' + e(r.facebook) + '" target="_blank" rel="noopener" aria-label="Facebook">' + ico('facebook') + '</a>');
    if (urlSure(r.instagram)) l.push('<a href="' + e(r.instagram) + '" target="_blank" rel="noopener" aria-label="Instagram">' + ico('instagram') + '</a>');
    if (urlSure(r.youtube)) l.push('<a href="' + e(r.youtube) + '" target="_blank" rel="noopener" aria-label="YouTube">' + ico('youtube') + '</a>');
    var wa = String(r.whatsapp || '').replace(/[^0-9]/g, '');
    if (wa) l.push('<a href="https://wa.me/' + e(wa) + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + ico('whatsapp') + '</a>');
    if (urlSure(r.site)) l.push('<a href="' + e(r.site) + '" target="_blank" rel="noopener" aria-label="Site web">' + ico('globe') + '</a>');
    return l.length ? '<div class="reseaux">' + l.join('') + '</div>' : '';
  }

  function piedDePage() {
    var d = etat.d, ec = d.ecole, c = etat.c;
    var rubriques = RUBRIQUES.filter(function (r) { return ouverte(r.cle); });
    var familles = [];
    if (c.pages.parents) familles.push('<li><a href="#/parents">Espace parents</a></li>');
    if (ouverte('eleve')) familles.push('<li><a href="#/eleve">Espace élève</a></li>');
    if (c.pages.inscriptions) familles.push('<li><a href="#/inscriptions">Préinscription en ligne</a></li>');
    if (c.pages.contact) familles.push('<li><a href="#/contact">Prendre rendez-vous</a></li>');
    return '<footer class="pied"><div class="contenant"><div class="colonnes">' +
      '<div><a class="marque" href="#/">' + blason(ec) + '<span class="textes"><span class="nom">' + e(ec.nom) + '</span>' +
      (lieuEcole(ec) ? '<span class="lieu">' + e(lieuEcole(ec)) + '</span>' : '') + '</span></a>' +
      '<p class="devise">' + e(c.slogan || ec.site_message_accueil || sloganDefaut(ec)) + '</p>' + liensReseaux(c) + '</div>' +
      '<div><h4>Le site</h4><ul>' + rubriques.map(function (r) { return '<li><a href="' + lien(r.cle) + '">' + e(r.libelle) + '</a></li>'; }).join('') + '</ul></div>' +
      '<div><h4>Familles</h4><ul>' + familles.join('') + '</ul></div>' +
      '<div><h4>Nous trouver</h4><ul>' +
      (ec.adresse ? '<li>' + e(ec.adresse) + '</li>' : '') +
      (lieuEcole(ec) ? '<li>' + e([lieuEcole(ec), ec.province].filter(Boolean).join(' — ')) + '</li>' : '') +
      (ec.telephone ? '<li><a href="' + e(tel(ec.telephone)) + '">' + e(ec.telephone) + '</a></li>' : '') +
      (ec.email ? '<li><a href="mailto:' + e(ec.email) + '">' + e(ec.email) + '</a></li>' : '') +
      '</ul></div></div>' +
      '<div class="bas"><span>© ' + new Date().getFullYear() + ' ' + e(ec.nom) + '. Tous droits réservés.</span>' +
      '<a href="/connexion.html">Accès du personnel</a></div></div></footer>';
  }

  /* ------------------------------------------------------------------ */
  /*  Blocs réutilisables                                                */
  /* ------------------------------------------------------------------ */
  function enteteSection(surtitre, titre, chapeau, classe) {
    return '<div class="entete-section apparait ' + (classe || '') + '">' +
      (surtitre ? '<span class="surtitre">' + e(surtitre) + '</span>' : '') + '<h2>' + e(titre) + '</h2>' +
      (chapeau ? '<p class="chapeau">' + e(chapeau) + '</p>' : '') + '</div>';
  }
  function herosPage(titre, chapeau, fil) {
    var couv = urlSure(etat.c.couverture_url);
    return '<section class="heros-page">' + (couv ? '<div class="photo" style="background-image:url(\'' + e(couv).replace(/'/g, '%27') + '\')"></div>' : '') +
      '<div class="contenant"><div class="fil"><a href="#/">Accueil</a><span>/</span><span>' + e(fil || titre) + '</span></div>' +
      '<h1>' + e(titre) + '</h1>' + (chapeau ? '<p class="chapeau">' + e(chapeau) + '</p>' : '') + '</div></section>';
  }
  function chiffresCles() {
    var d = etat.d, c = etat.c, l = [];
    if (c.chiffres && c.chiffres.length) return c.chiffres.slice(0, 4);
    if (c.annee_fondation) {
      var ans = new Date().getFullYear() - c.annee_fondation;
      if (ans > 0) l.push({ valeur: String(ans), libelle: 'années d’enseignement' });
    }
    if (d.chiffres.eleves > 0) l.push({ valeur: String(d.chiffres.eleves), libelle: 'élèves cette année' });
    if (d.chiffres.enseignants > 0) l.push({ valeur: String(d.chiffres.enseignants), libelle: 'enseignants' });
    if (d.chiffres.classes > 0) l.push({ valeur: String(d.chiffres.classes), libelle: 'classes' });
    if (d.chiffres.options > 0) l.push({ valeur: String(d.chiffres.options), libelle: d.chiffres.options > 1 ? 'options proposées' : 'option proposée' });
    return l.slice(0, 4);
  }
  function blocChiffres(classe) {
    var l = chiffresCles();
    if (l.length < 2) return '';
    return '<section class="section ' + (classe || 'sombre') + '"><div class="contenant"><div class="chiffres apparait">' +
      l.map(function (x) {
        return '<div class="chiffre"><div class="nb" data-compte="' + e(x.valeur) + '">' + e(x.valeur) + '</div><div class="libelle">' + e(x.libelle) + '</div></div>';
      }).join('') + '</div></div></section>';
  }
  function atouts() {
    var a = etat.c.atouts && etat.c.atouts.length ? etat.c.atouts : atoutsDefaut();
    return a.map(function (x, i) {
      return '<article class="carte vivante apparait"><div class="ico">' + ico(x.ico || ICONES_ATOUTS[i % ICONES_ATOUTS.length]) + '</div>' +
        '<h3>' + e(x.titre) + '</h3><p class="petit">' + e(x.texte) + '</p></article>';
    }).join('');
  }
  function motDirecteur() {
    var m = etat.c.mot_directeur || {};
    if (!m.texte) return '';
    var photo = urlSure(m.photo_url);
    return '<section class="section surface"><div class="contenant"><div class="mot">' +
      '<div class="portrait apparait">' + (photo ? '<img src="' + e(photo) + '" alt="' + e(m.nom || 'La direction') + '" loading="lazy" />' : '<span class="initiales-grandes">' + e(initiales(m.nom || etat.d.ecole.nom)) + '</span>') + '</div>' +
      '<div class="apparait"><span class="surtitre">Le mot ' + (m.fonction && /pr[ée]fet/i.test(m.fonction) ? 'du préfet' : 'de la direction') + '</span>' +
      '<div class="citation texte-libre" style="margin-top:46px">' + e(m.texte) + '</div>' +
      '<div class="signature"><strong>' + e(m.nom || '') + '</strong><span>' + e(m.fonction || '') + '</span></div></div></div></div></section>';
  }
  function evenements(liste, max) {
    if (!liste || !liste.length) return '<div class="vide">' + ico('calendrier') + 'Le calendrier de l’année sera publié ici.</div>';
    return '<div class="agenda">' + liste.slice(0, max || 6).map(function (ev) {
      var d1 = dateObj(ev.date_debut), d2 = ev.date_fin ? dateObj(ev.date_fin) : null;
      var plage = d2 && d2 - d1 > 0 ? 'Du ' + dateLongue(ev.date_debut) + ' au ' + dateLongue(ev.date_fin) : dateLongue(ev.date_debut);
      return '<div class="evenement"><div class="jour"><b>' + (d1 ? d1.getDate() : '') + '</b><small>' + (d1 ? MOIS_COURTS[d1.getMonth()] : '') + '</small></div>' +
        '<div><strong>' + e(ev.titre) + '</strong><span>' + e(plage) + (ev.type ? ' · ' + e(String(ev.type).replace(/_/g, ' ')) : '') + '</span></div></div>';
    }).join('') + '</div>';
  }
  function actualites(liste, max) {
    if (!liste || !liste.length) return '';
    return '<div class="grille g3">' + liste.slice(0, max || 3).map(function (a) {
      return '<article class="carte actu apparait"><div class="date">' + e(dateLongue(a.date_publication)) + '</div>' +
        '<h3>' + e(a.titre) + '</h3><div class="extrait">' + e(a.contenu || '') + '</div>' +
        (String(a.contenu || '').length > 220 ? '<button class="lire" data-lire>Lire la suite</button>' : '') + '</article>';
    }).join('') + '</div>';
  }
  function galerie(max) {
    var g = (etat.c.galerie || []).filter(function (x) { return urlSure(x.url); });
    if (!g.length) return '';
    return '<div class="galerie">' + g.slice(0, max || 24).map(function (x, i) {
      return '<button data-photo="' + i + '" aria-label="' + e(x.legende || 'Agrandir la photo') + '"><img src="' + e(x.url) + '" alt="' + e(x.legende || '') + '" loading="lazy" />' +
        (x.legende ? '<figcaption>' + e(x.legende) + '</figcaption>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function appel(titre, texte) {
    var c = etat.c, ec = etat.d.ecole;
    return '<section class="section"><div class="contenant"><div class="appel apparait"><div><h2>' + e(titre) + '</h2><p>' + e(texte) + '</p></div>' +
      '<div class="actions">' +
      (c.pages.inscriptions ? '<a class="bouton blanc" href="#/inscriptions">Inscrire mon enfant</a>' : '') +
      (c.pages.contact ? '<a class="bouton clair" href="#/contact">Nous écrire</a>' : (ec.telephone ? '<a class="bouton clair" href="' + e(tel(ec.telephone)) + '">Appeler</a>' : '')) +
      '</div></div></div></section>';
  }

  /* ------------------------------------------------------------------ */
  /*  ACCUEIL                                                            */
  /* ------------------------------------------------------------------ */
  function pageAccueil() {
    var d = etat.d, ec = d.ecole, c = etat.c;
    var couv = urlSure(c.couverture_url);
    var clair = c.theme === 'horizon' || c.theme === 'epure';
    var slogan = c.slogan || ec.site_message_accueil || sloganDefaut(ec);
    var session = (d.inscriptions || [])[0];
    var pastille = session
      ? '<a class="pastille" href="#/inscriptions" style="text-decoration:none"><i></i>Inscriptions ouvertes' + (session.date_cloture ? ' jusqu’au ' + e(dateLongue(session.date_cloture)) : '') + '</a>'
      : (d.annee_active ? '<span class="pastille"><i></i>Année scolaire ' + e(d.annee_active) + '</span>' : '');

    var titre = c.theme === 'horizon'
      ? e(ec.nom).replace(/^(\S+\s+\S+)/, '<span class="trait">$1</span>')
      : e(ec.nom);
    var actions = '<div class="actions">' +
      (c.pages.inscriptions ? '<a class="bouton' + (clair ? '' : ' blanc') + '" href="#/inscriptions">Inscrire mon enfant</a>' : '') +
      (c.pages.parents ? '<a class="bouton clair" href="#/parents">Résultats scolaires</a>' : '') + '</div>';

    var heros;
    if (c.theme === 'horizon') {
      heros = '<section class="heros"><div class="contenant dedans"><div class="texte">' + pastille + '<h1>' + titre + '</h1>' +
        '<p class="accroche">' + e(slogan) + '</p>' + actions + '</div>' +
        '<div class="visuel">' + (couv ? '<div class="image" style="background-image:url(\'' + e(couv).replace(/'/g, '%27') + '\')"></div>' : '<div style="padding:8%;height:100%">' + illustration(true) + '</div>') + '</div></div></section>';
    } else if (c.theme === 'epure') {
      heros = '<section class="heros"><div class="contenant dedans" style="display:block"><div class="texte">' + pastille + '<h1>' + titre + '</h1>' +
        '<p class="accroche">' + e(slogan) + '</p>' + actions + '</div></div>' +
        (couv ? '<div class="contenant"><div class="photo" style="background-image:url(\'' + e(couv).replace(/'/g, '%27') + '\')"></div></div>'
          : '<div class="contenant" style="max-width:820px;padding-bottom:30px">' + illustration(true) + '</div>') + '</section>';
    } else {
      var art = couv ? '' : '<div class="art" style="right:max(-80px,calc(50% - 720px));bottom:-10px;width:min(620px,70vw);opacity:' + (c.theme === 'prestige' ? '.2' : '.9') + '">' + illustration(false) + '</div>';
      heros = '<section class="heros">' + (couv ? '<div class="photo" style="background-image:url(\'' + e(couv).replace(/'/g, '%27') + '\')"></div>' : '') +
        '<div class="voile"></div>' + art + '<div class="contenant dedans"><div class="texte">' + pastille +
        (c.theme === 'prestige' ? '<div style="width:84px;height:84px;margin:0 auto 26px">' + (urlSure(ec.logo_url) ? '<img src="' + e(ec.logo_url) + '" alt="" style="width:100%;height:100%;object-fit:contain" />' : blasonSvg(ec.nom).replace('class="blason"', 'style="width:100%;height:100%"')) + '</div>' : '') +
        '<h1>' + titre + '</h1><p class="accroche">' + e(slogan) + '</p>' + actions + '</div></div>' +
        (c.theme === 'eveil' ? '' : '<span class="defiler" aria-hidden="true"></span>') + '</section>';
    }

    var acces = [];
    if (c.pages.parents) acces.push(['#/parents', 'resultats', 'Résultats scolaires', 'Bulletins, présences et suivi de votre enfant']);
    if (c.pages.inscriptions) acces.push(['#/inscriptions', 'inscription', 'Inscriptions', session ? 'Session ouverte — préinscrivez-vous en ligne' : 'Conditions, pièces et préinscription']);
    if (c.pages.vie) acces.push(['#/vie', 'calendrier', 'Agenda & actualités', 'Les événements de l’année scolaire']);
    if (c.pages.contact) acces.push(['#/contact', 'telephone', 'Nous contacter', 'Message, appel ou rendez-vous']);
    else if (c.pages.infos) acces.push(['#/infos', 'horloge', 'Infos pratiques', 'Horaires, accès et documents']);
    var nbAcces = Math.min(acces.length, 4);
    var blocAcces = acces.length ? '<div class="contenant acces"><div class="grille g' + (nbAcces === 4 ? 4 : nbAcces) + '">' + acces.slice(0, 4).map(function (a) {
      return '<a class="carte-acces" href="' + a[0] + '"><span class="ico">' + ico(a[1]) + '</span><span><strong>' + e(a[2]) + '</strong><span>' + e(a[3]) + '</span></span></a>';
    }).join('') + '</div></div>' : '';

    var presentation = ec.site_description || presentationDefaut(ec);
    var extrait = presentation.length > 520 ? presentation.slice(0, presentation.lastIndexOf(' ', 500)) + '…' : presentation;
    var blocPresentation = '<section class="section"><div class="contenant deux-colonnes"><div class="apparait">' +
      '<span class="surtitre">Bienvenue</span><h2>' + e(c.mission ? 'Notre ambition pour chaque élève' : 'Un établissement au service de chaque élève') + '</h2>' +
      '<p class="chapeau texte-libre" style="margin-top:20px">' + e(c.mission || extrait) + '</p>' +
      (c.valeurs.length ? '<div class="valeurs" style="margin:26px 0 30px">' + c.valeurs.map(function (v) { return '<span class="valeur">' + e(v) + '</span>'; }).join('') + '</div>' : '<div style="height:18px"></div>') +
      (ouverte('ecole') ? '<a class="lien-fleche" href="#/ecole">Découvrir l’établissement</a>' : '') + '</div>' +
      '<div class="grille g2">' + atouts() + '</div></div></section>';

    var blocVie = '';
    if (d.annonces.length || d.evenements.length) {
      blocVie = '<section class="section alt"><div class="contenant">' +
        '<div class="entete-section ligne apparait"><div><span class="surtitre">Vie de l’école</span><h2>Actualités et agenda</h2></div>' +
        (ouverte('vie') ? '<a class="lien-fleche" href="#/vie">Toute la vie scolaire</a>' : '') + '</div>' +
        '<div class="deux-colonnes large-etroit">' +
        '<div>' + (d.annonces.length ? actualites(d.annonces, 2).replace('grille g3', 'grille g2') : '<div class="vide">' + ico('message') + 'Les actualités de l’école paraîtront ici.</div>') + '</div>' +
        '<div class="carte apparait"><h3 style="margin-bottom:6px">À venir</h3>' + evenements(d.evenements, 4) + '</div></div></div></section>';
    }

    var blocInscription = session && c.pages.inscriptions
      ? '<section class="section" style="padding-bottom:0"><div class="contenant"><div class="session-ouverte apparait"><div><h3>' + e(session.libelle) + '</h3>' +
        '<p>' + (session.date_cloture ? 'Préinscriptions ouvertes jusqu’au ' + e(dateLongue(session.date_cloture)) : 'Les préinscriptions sont ouvertes') +
        (session.date_test ? ' · Test d’admission le ' + e(dateLongue(session.date_test)) : '') + '</p></div>' +
        '<a class="bouton blanc" href="#/inscriptions">Préinscrire mon enfant</a></div></div></section>' : '';

    var gal = galerie(5);
    var blocGalerie = gal ? '<section class="section"><div class="contenant">' +
      '<div class="entete-section ligne apparait"><div><span class="surtitre">En images</span><h2>La vie à l’école</h2></div>' +
      (ouverte('vie') ? '<a class="lien-fleche" href="#/vie">Voir la galerie</a>' : '') + '</div>' + gal + '</div></section>' : '';

    var tem = (c.temoignages || []);
    var blocTemoignages = tem.length ? '<section class="section surface"><div class="contenant">' +
      enteteSection('Ils en parlent', 'La parole aux familles et aux anciens', null, 'centre') +
      '<div class="grille g' + Math.min(tem.length, 3) + '">' + tem.slice(0, 3).map(function (t) {
        return '<figure class="carte temoignage apparait" style="margin:0"><blockquote>« ' + e(t.texte) + ' »</blockquote>' +
          '<figcaption><span class="rond">' + e(initiales(t.auteur || '?')) + '</span><span><strong>' + e(t.auteur) + '</strong><small>' + e(t.qualite) + '</small></span></figcaption></figure>';
      }).join('') + '</div></div></section>' : '';

    return heros + blocAcces + blocPresentation + blocChiffres() + motDirecteur() + blocInscription + blocVie + blocGalerie + blocTemoignages +
      appel(c.pages.inscriptions ? 'Votre enfant rejoint l’école ?' : 'Une question sur l’école ?',
        c.pages.inscriptions ? 'Préinscrivez-le en quelques minutes : l’école vous recontacte pour la suite du dossier.' : 'Écrivez-nous ou passez au secrétariat : nous vous répondrons.');
  }

  /* ------------------------------------------------------------------ */
  /*  L'ÉCOLE                                                            */
  /* ------------------------------------------------------------------ */
  function pageEcole() {
    var d = etat.d, ec = d.ecole, c = etat.c;
    var presentation = ec.site_description || presentationDefaut(ec);
    var h = herosPage('L’établissement', c.slogan || ec.site_message_accueil || sloganDefaut(ec));

    h += '<section class="section"><div class="contenant deux-colonnes" style="align-items:start"><div class="apparait">' +
      '<span class="surtitre">' + (c.annee_fondation ? 'Depuis ' + e(c.annee_fondation) : 'Qui sommes-nous') + '</span>' +
      '<h2>' + e(ec.nom) + '</h2><div class="chapeau texte-libre" style="margin-top:22px">' + e(presentation) + '</div></div>' +
      '<div class="apparait">' +
      (c.mission ? '<div class="carte" style="margin-bottom:24px"><div class="ico">' + ico('etoile') + '</div><h3>Notre mission</h3><p class="petit texte-libre">' + e(c.mission) + '</p></div>' : '') +
      (c.valeurs.length ? '<div class="carte"><h3 style="margin-bottom:18px">Nos valeurs</h3><div class="valeurs">' + c.valeurs.map(function (v) { return '<span class="valeur">' + e(v) + '</span>'; }).join('') + '</div></div>' : '') +
      (!c.mission && !c.valeurs.length ? '<div class="carte"><div class="ico">' + ico('accueil') + '</div><h3>L’école en bref</h3><ul class="liste-coches">' +
        (niveau(ec) ? '<li>Enseignement ' + e(niveau(ec)) + '</li>' : '') +
        (lieuEcole(ec) ? '<li>Situé à ' + e(lieuEcole(ec)) + '</li>' : '') +
        (d.annee_active ? '<li>Année scolaire ' + e(d.annee_active) + '</li>' : '') +
        (c.pages.parents ? '<li>Résultats consultables en ligne par les familles</li>' : '') + '</ul></div>' : '') +
      '</div></div></section>';

    h += blocChiffres();
    h += motDirecteur();

    h += '<section class="section alt"><div class="contenant">' + enteteSection('Notre engagement', 'Ce qui fait notre école', null) +
      '<div class="grille g' + ((c.atouts && c.atouts.length) === 3 ? 3 : 4) + '">' + atouts() + '</div></div></section>';

    var cursus = '';
    if (d.sections.length || d.options.length) {
      cursus = '<section class="section"><div class="contenant">' + enteteSection('Formations', 'Sections et options',
        'Les filières proposées par l’établissement cette année.') +
        '<div class="grille g2">' +
        (d.sections.length ? '<div class="carte apparait"><div class="ico">' + ico('livre') + '</div><h3>Sections</h3><div class="puces" style="margin-top:14px">' + d.sections.map(function (s) { return '<span class="puce">' + e(s) + '</span>'; }).join('') + '</div></div>' : '') +
        (d.options.length ? '<div class="carte apparait"><div class="ico">' + ico('resultats') + '</div><h3>Options</h3><div class="puces" style="margin-top:14px">' + d.options.map(function (s) { return '<span class="puce">' + e(s) + '</span>'; }).join('') + '</div></div>' : '') +
        '</div></div></section>';
    }
    h += cursus;

    if (c.equipe.length) {
      h += '<section class="section surface"><div class="contenant">' + enteteSection('Encadrement', 'L’équipe de direction', null, 'centre') +
        '<div class="grille g4">' + c.equipe.map(function (m) {
          var p = urlSure(m.photo_url);
          return '<div class="membre apparait"><div class="photo-membre">' + (p ? '<img src="' + e(p) + '" alt="' + e(m.nom) + '" loading="lazy" />' : e(initiales(m.nom))) + '</div>' +
            '<strong>' + e(m.nom) + '</strong><span>' + e(m.fonction) + '</span></div>';
        }).join('') + '</div></div></section>';
    }
    return h + appel('Venez nous rencontrer', 'La direction reçoit les familles sur rendez-vous. Écrivez-nous pour convenir d’un moment.');
  }

  /* ------------------------------------------------------------------ */
  /*  INSCRIPTIONS                                                       */
  /* ------------------------------------------------------------------ */
  function pageInscriptions() {
    var d = etat.d, c = etat.c;
    var sessions = d.inscriptions || [];
    var s0 = sessions[0];
    var h = herosPage('Inscriptions', s0
      ? 'Les préinscriptions sont ouvertes' + (s0.date_cloture ? ' jusqu’au ' + dateLongue(s0.date_cloture) : '') + '. Voici comment rejoindre l’école.'
      : 'Comment rejoindre l’école : les étapes, les conditions et les pièces à fournir.');

    if (sessions.length) {
      h += '<section class="section" style="padding-bottom:0"><div class="contenant grille">' + sessions.map(function (s) {
        return '<div class="session-ouverte apparait"><div><span class="etiquette" style="background:rgba(255,255,255,.18);color:inherit">Session ouverte</span>' +
          '<h3 style="margin-top:10px">' + e(s.libelle) + '</h3><p>' +
          [s.date_cloture ? 'Clôture le ' + dateLongue(s.date_cloture) : null, s.date_test ? 'Test d’admission le ' + dateLongue(s.date_test) : null,
            s.classes && s.classes.length ? 'Classes : ' + s.classes.join(', ') : null].filter(Boolean).map(e).join(' · ') + '</p></div>' +
          (c.inscriptions_en_ligne ? '<a class="bouton blanc" href="#/inscriptions" data-defiler="formulaire-inscription">Se préinscrire</a>' : '') + '</div>';
      }).join('') + '</div></section>';
    }

    var aTest = sessions.some(function (s) { return s.date_test; });
    var etapes = [
      ['Préinscription', c.inscriptions_en_ligne ? 'En ligne sur cette page, ou directement au secrétariat de l’école.' : 'Au secrétariat de l’école, aux heures d’ouverture.'],
      ['Dossier', 'Vous déposez les pièces demandées au secrétariat, qui vérifie le dossier.'],
      [aTest ? 'Test d’admission' : 'Entretien', aTest ? 'L’élève passe le test à la date indiquée par l’école.' : 'Selon la classe demandée, l’école peut proposer une rencontre ou une évaluation.'],
      ['Confirmation', 'L’école confirme l’admission et vous indique les modalités de rentrée.']
    ];
    h += '<section class="section"><div class="contenant">' + enteteSection('Le parcours', 'Quatre étapes pour rejoindre l’école', null, 'centre') +
      '<div class="etapes">' + etapes.map(function (x, i) {
        return '<div class="etape apparait"><span class="pastille-num">' + (i + 1) + '</span><h3>' + e(x[0]) + '</h3><p>' + e(x[1]) + '</p></div>';
      }).join('') + '</div></div></section>';

    var pieces = c.pieces.length ? c.pieces : piecesDefaut();
    h += '<section class="section alt"><div class="contenant deux-colonnes" style="align-items:start">' +
      '<div class="apparait"><span class="surtitre">Conditions</span><h2>Admission</h2>' +
      '<div class="chapeau texte-libre" style="margin-top:20px">' + e(c.admission || 'Les admissions se font dans la limite des places disponibles par classe. Le secrétariat vous renseigne sur les classes ouvertes, le calendrier et les éventuels tests d’entrée.') + '</div>' +
      (c.horaires ? '<p class="petit" style="margin-top:18px"><strong>Secrétariat :</strong> ' + e(c.horaires) + '</p>' : '') + '</div>' +
      '<div class="carte apparait"><div class="ico">' + ico('document') + '</div><h3>Pièces à fournir</h3>' +
      (c.pieces.length ? '' : '<p class="petit">Liste indicative — le secrétariat confirme les pièces exactes selon la classe.</p>') +
      '<ul class="liste-coches" style="margin-top:16px">' + pieces.map(function (p) { return '<li>' + e(p) + '</li>'; }).join('') + '</ul></div>' +
      '</div></section>';

    if (c.afficher_frais && d.frais.length) {
      h += '<section class="section"><div class="contenant">' + enteteSection('Frais scolaires', 'Les frais de l’année ' + (d.annee_active || ''), 'Montants publiés par l’école pour l’année en cours.') +
        '<div class="tableau-conteneur apparait"><table><thead><tr><th>Frais</th><th>Classe</th><th class="nombre">Montant</th></tr></thead><tbody>' +
        d.frais.map(function (f) { return '<tr><td>' + e(f.libelle) + '</td><td>' + e(f.classe || 'Toutes les classes') + '</td><td class="nombre">' + e(montant(f.montant, f.devise)) + '</td></tr>'; }).join('') +
        '</tbody></table></div></div></section>';
    }

    if (c.inscriptions_en_ligne) {
      var classes = d.classes || [];
      h += '<section class="section surface" id="formulaire-inscription"><div class="contenant deux-colonnes" style="align-items:start">' +
        '<div class="apparait"><span class="surtitre">Préinscription en ligne</span><h2>Préinscrire mon enfant</h2>' +
        '<p class="chapeau" style="margin-top:18px">Remplissez ce formulaire en quelques minutes. La préinscription n’est pas une admission : le secrétariat vous recontacte pour compléter le dossier.</p>' +
        '<ul class="liste-coches" style="margin-top:26px"><li>Aucun document à envoyer à ce stade</li><li>Réponse de l’école par téléphone ou par e-mail</li><li>Vos informations ne sont transmises qu’à l’école</li></ul></div>' +
        '<form class="panneau formulaire apparait" data-demande="preinscription" novalidate>' +
        '<div class="message" role="status"></div>' +
        '<div class="ligne"><div class="champ"><label for="pi-enfant">Nom complet de l’enfant <em>*</em></label><input id="pi-enfant" name="enfant_nom" required maxlength="120" autocomplete="off" /></div>' +
        '<div class="champ"><label for="pi-naissance">Date de naissance</label><input id="pi-naissance" name="enfant_date_naissance" type="date" /></div></div>' +
        '<div class="ligne"><div class="champ"><label for="pi-classe">Classe demandée</label>' +
        (classes.length ? '<select id="pi-classe" name="classe_souhaitee"><option value="">— Choisir —</option>' + classes.map(function (x) { return '<option>' + e(x) + '</option>'; }).join('') + '</select>' : '<input id="pi-classe" name="classe_souhaitee" maxlength="80" placeholder="ex. 1re année" />') + '</div>' +
        '<div class="champ"><label for="pi-sexe">Sexe</label><select id="pi-sexe" name="enfant_sexe"><option value="">—</option><option value="F">Fille</option><option value="M">Garçon</option></select></div></div>' +
        '<div class="champ"><label for="pi-provenance">École fréquentée actuellement</label><input id="pi-provenance" name="ecole_provenance" maxlength="160" /></div>' +
        '<div class="ligne"><div class="champ"><label for="pi-parent">Nom du parent ou tuteur <em>*</em></label><input id="pi-parent" name="nom" required maxlength="120" autocomplete="name" /></div>' +
        '<div class="champ"><label for="pi-tel">Téléphone <em>*</em></label><input id="pi-tel" name="telephone" type="tel" maxlength="40" autocomplete="tel" placeholder="+243 …" /></div></div>' +
        '<div class="champ"><label for="pi-mail">E-mail</label><input id="pi-mail" name="email" type="email" maxlength="160" autocomplete="email" /></div>' +
        '<div class="champ"><label for="pi-msg">Précisions (facultatif)</label><textarea id="pi-msg" name="message" maxlength="3000" style="min-height:90px"></textarea></div>' +
        '<div class="pot" aria-hidden="true"><label>Ne pas remplir<input name="site_web" tabindex="-1" autocomplete="off" /></label></div>' +
        '<button class="bouton plein" type="submit">Envoyer la préinscription</button></form></div></section>';
    } else {
      h += appel('Pour inscrire votre enfant', 'Présentez-vous au secrétariat de l’école ou contactez-nous : nous vous indiquerons la marche à suivre.');
    }
    return h;
  }

  /* ------------------------------------------------------------------ */
  /*  VIE SCOLAIRE                                                       */
  /* ------------------------------------------------------------------ */
  function pageVie() {
    var d = etat.d, c = etat.c;
    var h = herosPage('Vie scolaire', 'Actualités, événements, activités et souvenirs de l’année.');

    h += '<section class="section"><div class="contenant">' + enteteSection('Actualités', 'Les nouvelles de l’école') +
      (d.annonces.length ? actualites(d.annonces, 12) : '<div class="vide">' + ico('message') + 'Aucune actualité publiée pour le moment.</div>') + '</div></section>';

    h += '<section class="section alt"><div class="contenant deux-colonnes" style="align-items:start">' +
      '<div class="apparait"><span class="surtitre">Agenda</span><h2>Les prochains rendez-vous</h2>' +
      '<p class="chapeau" style="margin-top:18px">Rentrée, examens, congés, réunions de parents : les dates importantes de l’année.</p></div>' +
      '<div class="carte apparait">' + evenements(d.evenements, 12) + '</div></div></section>';

    if (c.activites.length) {
      h += '<section class="section"><div class="contenant">' + enteteSection('Au-delà des cours', 'Activités et clubs') +
        '<div class="grille g3">' + c.activites.map(function (a, i) {
          return '<article class="carte vivante apparait"><span class="numero-carte">' + (i < 9 ? '0' : '') + (i + 1) + '</span><h3>' + e(a.titre) + '</h3><p class="petit">' + e(a.texte) + '</p></article>';
        }).join('') + '</div></div></section>';
    }
    var gal = galerie();
    if (gal) h += '<section class="section surface"><div class="contenant">' + enteteSection('Galerie', 'En images') + gal + '</div></section>';
    return h;
  }

  /* ------------------------------------------------------------------ */
  /*  INFOS PRATIQUES                                                    */
  /* ------------------------------------------------------------------ */
  function pageInfos() {
    var d = etat.d, ec = d.ecole, c = etat.c;
    var h = herosPage('Informations pratiques', 'Horaires, accès, documents utiles et réponses aux questions fréquentes.');
    var carte = urlSure(c.plan_url);
    h += '<section class="section"><div class="contenant grille g3">' +
      '<div class="carte apparait"><div class="ico">' + ico('horloge') + '</div><h3>Horaires</h3><p class="petit texte-libre">' + e(c.horaires || 'Les horaires des cours et du secrétariat sont communiqués par l’école en début d’année.') + '</p></div>' +
      '<div class="carte apparait"><div class="ico">' + ico('lieu') + '</div><h3>Adresse</h3><p class="petit">' + e([ec.adresse, lieuEcole(ec), ec.province].filter(Boolean).join(', ') || 'Adresse communiquée par le secrétariat.') + '</p>' +
      (carte ? '<a class="lien-fleche" href="' + e(carte) + '" target="_blank" rel="noopener">Voir sur la carte</a>' : '') + '</div>' +
      '<div class="carte apparait"><div class="ico">' + ico('calendrier') + '</div><h3>Année scolaire</h3><p class="petit">' + (d.annee_active ? 'Année ' + e(d.annee_active) + '. ' : '') + 'Les dates de l’année sont publiées dans l’agenda.</p>' +
      (ouverte('vie') ? '<a class="lien-fleche" href="#/vie">Voir l’agenda</a>' : '') + '</div></div></section>';

    if (c.documents.length) {
      h += '<section class="section alt"><div class="contenant">' + enteteSection('À télécharger', 'Documents utiles') +
        '<div class="grille g3">' + c.documents.map(function (doc) {
          return '<a class="carte apparait" href="' + e(doc.url) + '" target="_blank" rel="noopener" style="display:flex;gap:16px;align-items:center;padding:22px"><span class="ico" style="margin:0;flex:none">' + ico('document') + '</span><strong>' + e(doc.titre) + '</strong></a>';
        }).join('') + '</div></div></section>';
    }
    var faq = c.faq.length ? c.faq : faqDefaut(c);
    h += '<section class="section"><div class="contenant etroit">' + enteteSection('Questions fréquentes', 'Vous vous demandez…', null, 'centre') +
      '<div class="faq apparait">' + faq.map(function (q, i) {
        return '<details' + (i === 0 ? ' open' : '') + '><summary>' + e(q.question) + '</summary><div class="reponse">' + e(q.reponse) + '</div></details>';
      }).join('') + '</div></div></section>';
    return h;
  }

  /* ------------------------------------------------------------------ */
  /*  CONTACT                                                            */
  /* ------------------------------------------------------------------ */
  function pageContact() {
    var d = etat.d, ec = d.ecole, c = etat.c;
    var h = herosPage('Nous contacter', 'Une question, un rendez-vous avec la direction ? Écrivez-nous, l’école vous répond.');
    var coord = [];
    if (ec.telephone) coord.push('<a class="coordonnee" href="' + e(tel(ec.telephone)) + '"><span class="ico">' + ico('telephone') + '</span><span><small>Téléphone</small><strong>' + e(ec.telephone) + '</strong></span></a>');
    if (ec.email) coord.push('<a class="coordonnee" href="mailto:' + e(ec.email) + '"><span class="ico">' + ico('courriel') + '</span><span><small>E-mail</small><strong>' + e(ec.email) + '</strong></span></a>');
    var adr = [ec.adresse, lieuEcole(ec), ec.province].filter(Boolean).join(', ');
    if (adr) coord.push((urlSure(c.plan_url) ? '<a class="coordonnee" href="' + e(c.plan_url) + '" target="_blank" rel="noopener">' : '<div class="coordonnee">') + '<span class="ico">' + ico('lieu') + '</span><span><small>Adresse</small><strong>' + e(adr) + '</strong></span>' + (urlSure(c.plan_url) ? '</a>' : '</div>'));
    if (c.horaires) coord.push('<div class="coordonnee"><span class="ico">' + ico('horloge') + '</span><span><small>Horaires</small><strong class="texte-libre" style="font-weight:500">' + e(c.horaires) + '</strong></span></div>');

    h += '<section class="section"><div class="contenant deux-colonnes" style="align-items:start">' +
      '<div class="apparait"><span class="surtitre">Coordonnées</span><h2>L’école à votre écoute</h2>' +
      '<div class="coordonnees" style="margin:28px 0">' + (coord.join('') || '<div class="vide">Coordonnées disponibles au secrétariat.</div>') + '</div>' + liensReseaux(c) + '</div>' +
      '<form class="panneau formulaire apparait" data-demande="contact" novalidate>' +
      '<div class="bascule" role="tablist"><button type="button" class="actif" data-type="contact">Envoyer un message</button><button type="button" data-type="rendez_vous">Demander un rendez-vous</button></div>' +
      '<div class="message" role="status"></div>' +
      '<div class="ligne"><div class="champ"><label for="ct-nom">Votre nom <em>*</em></label><input id="ct-nom" name="nom" required maxlength="120" autocomplete="name" /></div>' +
      '<div class="champ"><label for="ct-tel">Téléphone</label><input id="ct-tel" name="telephone" type="tel" maxlength="40" autocomplete="tel" /></div></div>' +
      '<div class="champ"><label for="ct-mail">E-mail</label><input id="ct-mail" name="email" type="email" maxlength="160" autocomplete="email" /><p class="aide">Indiquez au moins un téléphone ou un e-mail pour être recontacté.</p></div>' +
      '<div class="champ" data-seulement="rendez_vous" hidden><label for="ct-date">Date souhaitée</label><input id="ct-date" name="date_souhaitee" type="date" /></div>' +
      '<div class="champ"><label for="ct-objet">Objet</label><input id="ct-objet" name="objet" maxlength="160" /></div>' +
      '<div class="champ"><label for="ct-msg">Message <em>*</em></label><textarea id="ct-msg" name="message" maxlength="3000"></textarea></div>' +
      '<div class="pot" aria-hidden="true"><label>Ne pas remplir<input name="site_web" tabindex="-1" autocomplete="off" /></label></div>' +
      '<button class="bouton plein" type="submit">Envoyer</button></form></div></section>';
    return h;
  }

  /* ------------------------------------------------------------------ */
  /*  Formulaires de demande                                             */
  /* ------------------------------------------------------------------ */
  function brancherFormulaires() {
    $$('form[data-demande]').forEach(function (f) {
      var type = f.getAttribute('data-demande');
      $$('.bascule button', f).forEach(function (b) {
        b.addEventListener('click', function () {
          type = b.getAttribute('data-type');
          $$('.bascule button', f).forEach(function (x) { x.classList.toggle('actif', x === b); });
          $$('[data-seulement]', f).forEach(function (x) { x.hidden = x.getAttribute('data-seulement') !== type; });
          var msg = f.querySelector('label[for="ct-msg"]');
          if (msg) msg.innerHTML = type === 'rendez_vous' ? 'Motif du rendez-vous' : 'Message <em>*</em>';
        });
      });
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var zone = f.querySelector('.message');
        var corps = { type: type };
        $$('input[name], select[name], textarea[name]', f).forEach(function (ch) { corps[ch.name] = ch.value.trim(); });
        var erreur = null;
        if (type === 'preinscription' && !corps.enfant_nom) erreur = 'Indiquez le nom de l’enfant.';
        else if (!corps.nom) erreur = 'Indiquez votre nom.';
        else if (!corps.telephone && !corps.email) erreur = 'Indiquez un téléphone ou un e-mail pour être recontacté.';
        else if (type === 'contact' && !corps.message) erreur = 'Écrivez votre message.';
        if (erreur) { afficher(zone, erreur, 'erreur'); return; }
        if (APERCU) { afficher(zone, 'Aperçu : le formulaire fonctionnera une fois le site publié.', 'info'); return; }
        var bouton = f.querySelector('button[type="submit"]');
        bouton.disabled = true;
        fetch(API + '/public/ecole/' + encodeURIComponent(CODE) + '/demandes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps)
        }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            bouton.disabled = false;
            if (!res.ok) { afficher(zone, res.j.message || 'Envoi impossible. Réessayez.', 'erreur'); return; }
            f.reset();
            afficher(zone, res.j.message || 'Envoyé. Merci !', 'succes');
          })
          .catch(function () { bouton.disabled = false; afficher(zone, 'Connexion impossible. Vérifiez votre réseau et réessayez.', 'erreur'); });
      });
    });
  }
  function afficher(zone, texte, type) {
    zone.textContent = texte;
    zone.className = 'message visible ' + type;
    zone.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ------------------------------------------------------------------ */
  /*  ESPACE PARENTS / ESPACE ÉLÈVE                                      */
  /* ------------------------------------------------------------------ */
  /* Les identifiants restent dans sessionStorage : ils disparaissent à la
     fermeture du navigateur, et un parent peut y ranger plusieurs enfants. */
  function cleSession(vue) { return 'site-' + CODE.toLowerCase() + '-' + vue; }
  function lireSession(vue) {
    try { return JSON.parse(sessionStorage.getItem(cleSession(vue)) || '[]'); } catch (x) { return []; }
  }
  function ecrireSession(vue, liste) {
    try { sessionStorage.setItem(cleSession(vue), JSON.stringify(liste)); } catch (x) { /* navigation privée */ }
  }

  function pageFamille(vue) {
    var c = etat.c;
    var parents = vue === 'parents';
    if ((parents && !c.pages.parents) || (!parents && !ouverte('eleve'))) return pageAccueil();
    etat.famille.liste = lireSession(vue);
    var titre = parents ? 'Espace parents' : 'Espace élève';
    var h = herosPage(titre, parents
      ? 'Suivez la scolarité de votre enfant : résultats, présences, frais et emploi du temps.'
      : 'Ton emploi du temps, tes résultats, tes frais, ta conduite et l’agenda de l’école, au même endroit.');
    h += '<section class="section" style="padding-top:clamp(40px,6vw,70px)"><div class="contenant" id="zone-famille"></div></section>';
    setTimeout(function () {
      if (etat.famille.liste.length) chargerFamille(vue, etat.famille.actif < etat.famille.liste.length ? etat.famille.actif : 0);
      else formulaireFamille(vue);
    }, 0);
    return h;
  }

  function formulaireFamille(vue, message) {
    var parents = vue === 'parents';
    var zone = $('#zone-famille'); if (!zone) return;
    var ajout = etat.famille.liste.length > 0;
    zone.innerHTML = '<div class="connexion-famille"><div class="apparait vu">' +
      '<span class="surtitre">' + (ajout ? 'Ajouter un enfant' : 'Connexion') + '</span>' +
      '<h2>' + (parents ? 'Accédez au suivi de votre enfant' : 'Connecte-toi à ton espace') + '</h2>' +
      '<p class="chapeau" style="margin:18px 0 28px">' + (parents
        ? 'Munissez-vous du matricule de l’élève et du code d’accès remis par le secrétariat. Aucun compte à créer.'
        : 'Il te faut ton matricule et ton code d’accès. Demande-les à tes parents ou au secrétariat.') + '</p>' +
      '<div class="carte-code" aria-hidden="true"><div class="puce-or"></div><div style="font-weight:700">' + e(etat.d.ecole.nom) + '</div>' +
      '<div class="ligne-code"><span>Matricule</span><span>Code d’accès</span></div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:4px"><span class="valeur-code">A-0000</span><span class="valeur-code">K7P•••</span></div></div></div>' +
      '<form class="panneau formulaire apparait vu" id="form-famille" novalidate>' +
      '<div class="message' + (message ? ' visible erreur' : '') + '" role="status">' + e(message || '') + '</div>' +
      '<div class="champ"><label for="fa-matricule">Matricule de l’élève</label><input id="fa-matricule" autocomplete="off" autocapitalize="characters" required placeholder="ex. ELV-0001" /></div>' +
      '<div class="champ"><label for="fa-code">Code d’accès</label><input id="fa-code" autocomplete="off" autocapitalize="characters" maxlength="12" required style="text-transform:uppercase;letter-spacing:.14em;font-family:ui-monospace,monospace" placeholder="XXXXXX" />' +
      '<p class="aide">Six caractères, sans confusion possible entre O et 0 ni entre I et 1.</p></div>' +
      '<button class="bouton plein" type="submit">' + ico('cadenas') + (ajout ? 'Ajouter cet enfant' : 'Accéder à l’espace') + '</button>' +
      (ajout ? '<button class="bouton contour plein" type="button" id="annuler-ajout">Annuler</button>' : '') +
      '</form></div>';
    $('#form-famille').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var m = $('#fa-matricule').value.trim(), code = $('#fa-code').value.trim().toUpperCase();
      if (!m || !code) { var z = $('#form-famille .message'); afficher(z, 'Renseignez le matricule et le code d’accès.', 'erreur'); return; }
      etat.famille.liste = etat.famille.liste.filter(function (x) { return x.matricule.toUpperCase() !== m.toUpperCase(); });
      etat.famille.liste.push({ matricule: m, code_acces: code });
      chargerFamille(vue, etat.famille.liste.length - 1, true);
    });
    var annuler = $('#annuler-ajout');
    if (annuler) annuler.addEventListener('click', function () { chargerFamille(vue, etat.famille.actif); });
  }

  function chargerFamille(vue, index, nouveau) {
    var zone = $('#zone-famille'); if (!zone) return;
    var id = etat.famille.liste[index];
    if (APERCU) { formulaireFamille(vue, 'Aperçu : la connexion fonctionnera une fois le site publié.'); return; }
    zone.innerHTML = '<div class="ecran-etat" style="min-height:240px"><div class="anneau"></div>Chargement…</div>';
    fetch(API + '/public/famille', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code_ecole: CODE, matricule: id.matricule, code_acces: id.code_acces, vue: vue === 'parents' ? 'parents' : 'eleve' })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        if (!res.ok) {
          etat.famille.liste.splice(index, 1);
          ecrireSession(vue, etat.famille.liste);
          formulaireFamille(vue, res.status === 429 ? res.j.message : (res.j.message || 'Matricule ou code d’accès incorrect.'));
          return;
        }
        etat.famille.actif = index;
        ecrireSession(vue, etat.famille.liste);
        etat.famille.donnees = res.j;
        if (nouveau || !etat.famille.onglet) etat.famille.onglet = vue === 'parents' ? 'apercu' : 'journee';
        tableauFamille(vue);
      })
      .catch(function () { zone.innerHTML = '<div class="vide">' + ico('vide') + 'Connexion au serveur impossible. Vérifiez votre réseau puis rechargez la page.</div>'; });
  }

  function tableauFamille(vue) {
    var D = etat.famille.donnees, parents = vue === 'parents';
    var onglets = parents
      ? [['apercu', 'accueil', 'Vue d’ensemble'], ['resultats', 'resultats', 'Résultats'], D.finances ? ['finances', 'portefeuille', 'Frais scolaires'] : null,
        D.presences ? ['presences', 'presence', 'Présences'] : null, D.discipline ? ['discipline', 'bouclier', 'Discipline'] : null,
        D.emploi_du_temps ? ['edt', 'horloge', 'Emploi du temps'] : null, ['agenda', 'calendrier', 'Agenda']]
      : [['journee', 'soleil', 'Ma journée'], ['resultats', 'resultats', 'Mes résultats'], D.finances ? ['finances', 'portefeuille', 'Mes frais'] : null,
        D.presences ? ['presences', 'presence', 'Mes présences'] : null,
        D.discipline ? ['discipline', 'etoile', 'Ma conduite'] : null, ['agenda', 'calendrier', 'Agenda']];
    onglets = onglets.filter(Boolean);
    if (!onglets.some(function (o) { return o[0] === etat.famille.onglet; })) etat.famille.onglet = onglets[0][0];

    var enfants = parents && etat.famille.liste.length
      ? '<div class="enfants">' + etat.famille.liste.map(function (x, i) {
        return '<button data-enfant="' + i + '" class="' + (i === etat.famille.actif ? 'actif' : '') + '">' + e(i === etat.famille.actif ? D.eleve.prenom : x.matricule) + '</button>';
      }).join('') + '<button data-ajouter>+ Enfant</button></div>' : '';

    $('#zone-famille').innerHTML = '<div class="tableau-bord"><aside class="panneau profil-eleve">' +
      '<div class="avatar">' + e(initiales(D.eleve.nom_complet)) + '</div>' +
      '<h2>' + e(parents ? D.eleve.nom_complet : 'Bonjour ' + D.eleve.prenom) + '</h2>' +
      '<div class="meta">' + e(D.eleve.classe || 'Classe non renseignée') + (D.annee ? ' · ' + e(D.annee) : '') + '</div>' +
      '<span class="matricule">' + e(D.eleve.matricule) + '</span>' + enfants +
      '<nav class="onglets-famille">' + onglets.map(function (o) {
        return '<button data-onglet="' + o[0] + '" class="' + (o[0] === etat.famille.onglet ? 'actif' : '') + '">' + ico(o[1]) + e(o[2]) + '</button>';
      }).join('') + '<button data-sortir>' + ico('sortie') + 'Se déconnecter</button></nav></aside>' +
      '<div id="volet-famille"></div></div>';

    $$('[data-onglet]').forEach(function (b) {
      b.addEventListener('click', function () { etat.famille.onglet = b.getAttribute('data-onglet'); tableauFamille(vue); });
    });
    $$('[data-enfant]').forEach(function (b) {
      b.addEventListener('click', function () { chargerFamille(vue, Number(b.getAttribute('data-enfant'))); });
    });
    var aj = $('[data-ajouter]'); if (aj) aj.addEventListener('click', function () { formulaireFamille(vue); });
    $('[data-sortir]').addEventListener('click', function () {
      ecrireSession(vue, []); etat.famille = { liste: [], actif: 0, donnees: null, onglet: null }; formulaireFamille(vue);
    });
    $('#volet-famille').innerHTML = voletFamille(etat.famille.onglet, D, parents);
    requestAnimationFrame(function () {
      $$('.barre-progression i[data-largeur]').forEach(function (i) { i.style.width = i.getAttribute('data-largeur'); });
    });
  }

  function titreVolet(t, s) { return '<div style="margin-bottom:22px"><h2 style="font-size:1.7rem">' + e(t) + '</h2>' + (s ? '<p class="petit" style="color:var(--texte-doux);margin:6px 0 0">' + e(s) + '</p>' : '') + '</div>'; }

  function dernierBulletin(R) { return R && R.bulletins && R.bulletins.length ? R.bulletins[R.bulletins.length - 1] : null; }

  function voletResultats(R, parents) {
    if (R.bloque) {
      return '<div class="panneau"><div class="ico" style="width:52px;height:52px;border-radius:14px;background:#FDECEA;color:#B5361F;display:flex;align-items:center;justify-content:center;margin-bottom:18px">' + ico('cadenas') + '</div>' +
        '<h3>Les résultats ne sont pas encore consultables</h3><p class="petit" style="margin-top:10px">' +
        'Un solde de <strong>' + e(montant(R.reste_du, (etat.famille.donnees.finances || {}).devise)) + '</strong> reste dû sur les frais scolaires de l’année. ' +
        (parents ? 'Rapprochez-vous du secrétariat de l’établissement.' : 'Parles-en à tes parents ; ils peuvent se rapprocher du secrétariat.') + '</p></div>';
    }
    if (!R.bulletins.length) {
      return '<div class="vide">' + ico('resultats') + (R.prochaine_publication
        ? 'Les résultats seront disponibles ici à partir du <strong>' + e(new Date(R.prochaine_publication).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })) + '</strong>.'
        : 'Aucun bulletin n’a encore été publié cette année.') + '</div>';
    }
    return '<div class="bulletins">' + R.bulletins.map(function (b) {
      var p = b.pourcentage != null ? Number(b.pourcentage) : null;
      return '<div class="bulletin"><div class="periode">' + e(b.periode) + '</div>' +
        '<div class="jauge" style="--p:' + (p == null ? 0 : Math.max(0, Math.min(100, p))) + (p != null && p < 50 ? ';--couleur-jauge:#D2462E' : '') + '" data-texte="' + (p == null ? '—' : e(p) + '%') + '"></div>' +
        (b.mention ? '<div class="mention">' + e(b.mention) + '</div>' : '') +
        (b.classement != null ? '<div class="rang">' + e(b.classement) + (R.effectif_classe ? ' / ' + e(R.effectif_classe) : '') + ' en classe</div>' : '') +
        (b.conduite ? '<div class="rang">Conduite : ' + e(b.conduite) + '</div>' : '') + '</div>';
    }).join('') + '</div>' + '<p class="petit" style="color:var(--texte-doux);margin-top:18px">Le bulletin complet, signé, est remis par l’école.</p>';
  }

  function voletPresences(P) {
    var total = P.compte.present + P.compte.absent + P.compte.retard + P.compte.excuse;
    var taux = total ? Math.round((P.compte.present + P.compte.retard) / total * 100) : null;
    var LIB = { absent: 'Absence', retard: 'Retard', excuse: 'Absence excusée' };
    return '<div class="tuiles"><div class="tuile ' + (taux != null && taux >= 90 ? 'bonne' : (taux != null && taux < 75 ? 'alerte' : '')) + '"><small>Assiduité</small><b>' + (taux == null ? '—' : taux + '%') + '</b></div>' +
      '<div class="tuile ' + (P.compte.absent ? 'alerte' : '') + '"><small>Absences</small><b>' + P.compte.absent + '</b></div>' +
      '<div class="tuile"><small>Retards</small><b>' + P.compte.retard + '</b></div></div>' +
      (P.recents.length ? '<div class="tableau-conteneur"><table><thead><tr><th>Date</th><th>Type</th><th>Motif</th></tr></thead><tbody>' +
        P.recents.map(function (r) { return '<tr><td>' + e(dateLongue(r.date_jour)) + '</td><td>' + e(LIB[r.statut] || r.statut) + '</td><td>' + e(r.motif || '—') + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="vide">' + ico('coche') + 'Aucune absence ni aucun retard enregistré.</div>');
  }

  function voletDiscipline(Q) {
    var ratio = Q.capital ? Math.max(0, Math.min(100, Math.round(Q.solde / Q.capital * 100))) : 0;
    return '<div class="panneau" style="margin-bottom:20px"><small style="font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--texte-doux)">Points de conduite</small>' +
      '<div style="font-family:var(--police-titre);font-size:2.6rem;line-height:1.1;margin-top:6px">' + e(Q.solde) + ' <span style="font-size:1.1rem;color:var(--texte-doux)">/ ' + e(Q.capital) + '</span></div>' +
      '<div class="barre-progression"><i data-largeur="' + ratio + '%" style="width:0;' + (ratio < 60 ? 'background:#D2462E' : '') + '"></i></div></div>' +
      (Q.incidents.length ? '<div class="tableau-conteneur"><table><thead><tr><th>Date</th><th>Fait</th><th>Mesure</th><th class="nombre">Points</th></tr></thead><tbody>' +
        Q.incidents.map(function (i) {
          return '<tr><td>' + e(dateLongue(i.date_incident)) + '</td><td>' + e(i.type || '') + (i.description ? '<div class="petit" style="color:var(--texte-doux)">' + e(i.description) + '</div>' : '') + '</td><td>' + e(i.mesure || '—') + '</td>' +
            '<td class="nombre" style="color:' + (i.sens === 'positif' ? '#1D7A45' : '#B5361F') + '">' + (i.sens === 'positif' ? '+' : '−') + e(i.points) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="vide">' + ico('bouclier') + 'Aucun incident enregistré cette année.</div>');
  }

  function voletFinances(F, parents) {
    var ratio = F.attendu > 0 ? Math.min(100, Math.round(F.verse / F.attendu * 100)) : 0;
    return '<div class="tuiles"><div class="tuile"><small>Frais de l’année</small><b>' + e(montant(F.attendu, F.devise)) + '</b></div>' +
      '<div class="tuile bonne"><small>Déjà versé</small><b>' + e(montant(F.verse, F.devise)) + '</b></div>' +
      '<div class="tuile ' + (F.reste > 0 ? 'alerte' : 'bonne') + '"><small>Reste à payer</small><b>' + e(montant(F.reste, F.devise)) + '</b></div></div>' +
      (F.attendu > 0 ? '<div class="panneau" style="margin-bottom:20px"><strong>' + ratio + '% réglé</strong><div class="barre-progression"><i data-largeur="' + ratio + '%" style="width:0"></i></div></div>' : '') +
      (F.paiements.length ? '<div class="tableau-conteneur"><table><thead><tr><th>Date</th><th>Libellé</th><th>Référence</th><th class="nombre">Montant</th></tr></thead><tbody>' +
        F.paiements.map(function (p) { return '<tr><td>' + e(dateLongue(p.date_paiement)) + '</td><td>' + e(p.libelle || 'Paiement') + '</td><td>' + e(p.reference || '—') + '</td><td class="nombre">' + e(montant(p.montant, p.devise)) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="vide">' + ico('portefeuille') + 'Aucun paiement enregistré cette année.</div>') +
      '<p class="petit" style="color:var(--texte-doux);margin-top:16px">' + (parents
        ? 'Pour toute question sur un paiement, munissez-vous de votre reçu et adressez-vous au secrétariat.'
        : 'Ces informations te sont données à titre indicatif : les paiements se règlent entre tes parents et le secrétariat.') + '</p>';
  }

  function voletEdt(edt, seulementAujourdhui) {
    if (!edt || !edt.length) return '<div class="vide">' + ico('horloge') + 'L’emploi du temps n’a pas encore été publié.</div>';
    var auj = new Date().getDay() || 7;
    var jours = [];
    edt.forEach(function (s) { if (jours.indexOf(s.jour) < 0) jours.push(s.jour); });
    jours.sort();
    if (seulementAujourdhui) {
      var j = jours.indexOf(auj) >= 0 ? auj : (jours.filter(function (x) { return x > auj; })[0] || jours[0]);
      var seances = edt.filter(function (s) { return s.jour === j; });
      return '<h3 style="margin-bottom:12px">' + (j === auj ? 'Aujourd’hui' : JOURS[j]) + '</h3>' + seances.map(function (s) {
        return '<div class="seance"><small>' + e(s.debut) + ' – ' + e(s.fin) + '</small>' + e(s.cours) + '</div>';
      }).join('');
    }
    return '<div class="edt" style="--jours:' + jours.length + '">' + jours.map(function (j) {
      return '<div class="colonne' + (j === auj ? ' aujourdhui' : '') + '"><h4>' + JOURS[j] + '</h4>' + edt.filter(function (s) { return s.jour === j; }).map(function (s) {
        return '<div class="seance"><small>' + e(s.debut) + ' – ' + e(s.fin) + '</small>' + e(s.cours) + '</div>';
      }).join('') + '</div>';
    }).join('') + '</div>';
  }

  function voletFamille(onglet, D, parents) {
    var R = D.resultats;
    switch (onglet) {
      case 'resultats': return titreVolet(parents ? 'Résultats scolaires' : 'Mes résultats', 'Bulletins validés et publiés par l’école' + (D.annee ? ' pour l’année ' + D.annee : '') + '.') + voletResultats(R, parents);
      case 'finances': return titreVolet(parents ? 'Frais scolaires' : 'Mes frais scolaires', 'Situation de l’année en cours.') + voletFinances(D.finances, parents);
      case 'presences': return titreVolet(parents ? 'Présences' : 'Mes présences', 'Depuis le début de l’année scolaire.') + voletPresences(D.presences);
      case 'discipline': return titreVolet(parents ? 'Discipline' : 'Ma conduite') + voletDiscipline(D.discipline);
      case 'edt': return titreVolet('Emploi du temps', 'Semaine type de la classe.') + voletEdt(D.emploi_du_temps);
      case 'agenda': return titreVolet('Agenda de l’école') + '<div class="panneau">' + evenements(D.evenements, 10) + '</div>';
      case 'journee': {
        var b = dernierBulletin(R);
        return titreVolet('Ma journée', new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })) +
          '<div class="grille g2" style="align-items:start"><div class="panneau">' + voletEdt(D.emploi_du_temps, true) + '</div>' +
          '<div class="grille">' + (b && !R.bloque ? '<div class="tuile"><small>Dernier bulletin — ' + e(b.periode) + '</small><b>' + (b.pourcentage != null ? e(b.pourcentage) + '%' : '—') + '</b></div>' : '') +
          (D.discipline ? '<div class="tuile"><small>Points de conduite</small><b>' + e(D.discipline.solde) + ' / ' + e(D.discipline.capital) + '</b></div>' : '') +
          (D.finances ? '<div class="tuile ' + (D.finances.reste > 0 ? 'alerte' : 'bonne') + '"><small>Frais restant à payer</small><b>' + e(montant(D.finances.reste, D.finances.devise)) + '</b></div>' : '') +
          '<div class="panneau"><h3 style="margin-bottom:6px">Bientôt</h3>' + evenements(D.evenements, 3) + '</div></div></div>';
      }
      default: {
        var dernier = dernierBulletin(R);
        var P = D.presences, F = D.finances;
        var total = P ? P.compte.present + P.compte.absent + P.compte.retard + P.compte.excuse : 0;
        var taux = total ? Math.round((P.compte.present + P.compte.retard) / total * 100) : null;
        return titreVolet('Vue d’ensemble', 'L’essentiel de la scolarité de ' + D.eleve.prenom + '.') +
          '<div class="tuiles">' +
          '<div class="tuile"><small>Dernier bulletin</small><b>' + (R.bloque ? '—' : (dernier && dernier.pourcentage != null ? e(dernier.pourcentage) + '%' : '—')) + '</b>' + (dernier && !R.bloque ? '<span class="petit" style="color:var(--texte-doux)">' + e(dernier.periode) + '</span>' : '') + '</div>' +
          (P ? '<div class="tuile ' + (taux != null && taux >= 90 ? 'bonne' : '') + '"><small>Assiduité</small><b>' + (taux == null ? '—' : taux + '%') + '</b></div>' : '') +
          (F ? '<div class="tuile ' + (F.reste > 0 ? 'alerte' : 'bonne') + '"><small>Reste à payer</small><b>' + e(montant(F.reste, F.devise)) + '</b></div>' : '') +
          '</div><div class="grille g2" style="align-items:start"><div class="panneau"><h3 style="margin-bottom:14px">Résultats</h3>' + voletResultats(R, true).replace('class="bulletins"', 'class="bulletins compacts"') + '</div>' +
          '<div class="panneau"><h3 style="margin-bottom:6px">Agenda</h3>' + evenements(D.evenements, 4) + '</div></div>';
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Visionneuse de la galerie                                          */
  /* ------------------------------------------------------------------ */
  var photoCourante = 0;
  var ecouteursGlobaux = false;
  function montrerPhoto(i) {
    var v = $('#visionneuse');
    var g = (etat.c.galerie || []).filter(function (x) { return urlSure(x.url); });
    if (!v || !g.length) return;
    photoCourante = (i + g.length) % g.length;
    $('img', v).src = g[photoCourante].url; $('img', v).alt = g[photoCourante].legende || '';
    $('p', v).textContent = g[photoCourante].legende || '';
    v.classList.add('visible');
  }
  function fermerPhoto() { var v = $('#visionneuse'); if (v) v.classList.remove('visible'); }
  function brancherVisionneuse() {
    var v = $('#visionneuse');
    $('.fermer', v).addEventListener('click', fermerPhoto);
    $('.prec', v).addEventListener('click', function () { montrerPhoto(photoCourante - 1); });
    $('.suiv', v).addEventListener('click', function () { montrerPhoto(photoCourante + 1); });
    v.addEventListener('click', function (ev) { if (ev.target === v) fermerPhoto(); });

    // Écouteurs du document : posés une seule fois, même si l'aperçu
    // redessine la page à chaque frappe de la direction.
    if (ecouteursGlobaux) return;
    ecouteursGlobaux = true;
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest) return;
      var b = ev.target.closest('[data-photo]');
      if (b) montrerPhoto(Number(b.getAttribute('data-photo')));
      var lire = ev.target.closest('[data-lire]');
      if (lire) { var a = lire.closest('.actu'); a.classList.toggle('ouverte'); lire.textContent = a.classList.contains('ouverte') ? 'Réduire' : 'Lire la suite'; }
      var cible = ev.target.closest('[data-defiler]');
      if (cible) {
        var zone = document.getElementById(cible.getAttribute('data-defiler'));
        if (zone) { ev.preventDefault(); zone.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      }
    });
    document.addEventListener('keydown', function (ev) {
      var vis = $('#visionneuse');
      if (!vis || !vis.classList.contains('visible')) return;
      if (ev.key === 'Escape') fermerPhoto();
      if (ev.key === 'ArrowLeft') montrerPhoto(photoCourante - 1);
      if (ev.key === 'ArrowRight') montrerPhoto(photoCourante + 1);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Animations : apparition et compteurs                               */
  /* ------------------------------------------------------------------ */
  var observateur = 'IntersectionObserver' in window ? new IntersectionObserver(function (entrees) {
    entrees.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('vu');
      $$('[data-compte]', en.target).forEach(compter);
      observateur.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }) : null;

  function compter(el) {
    var cible = parseInt(el.getAttribute('data-compte'), 10);
    if (!(cible > 0) || String(cible) !== el.getAttribute('data-compte')) return;
    var debut = null;
    function pas(t) {
      if (!debut) debut = t;
      var p = Math.min(1, (t - debut) / 1300);
      el.textContent = Math.round(cible * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(pas);
    }
    requestAnimationFrame(pas);
  }
  function animer() {
    $$('.apparait').forEach(function (el) { if (observateur) observateur.observe(el); else el.classList.add('vu'); });
  }

  /* ------------------------------------------------------------------ */
  /*  Navigation                                                         */
  /* ------------------------------------------------------------------ */
  var PAGES = { accueil: pageAccueil, ecole: pageEcole, inscriptions: pageInscriptions, vie: pageVie, infos: pageInfos, contact: pageContact,
    parents: function () { return pageFamille('parents'); }, eleve: function () { return pageFamille('eleve'); } };
  var TITRES = { ecole: 'L’établissement', inscriptions: 'Inscriptions', vie: 'Vie scolaire', infos: 'Informations pratiques', contact: 'Contact', parents: 'Espace parents', eleve: 'Espace élève' };

  function naviguer() {
    if (!etat.d) return;
    var cle = (window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'accueil');
    if (!PAGES[cle] || !ouverte(cle)) cle = 'accueil';
    var changement = cle !== etat.page;
    etat.page = cle;
    $('#contenu').innerHTML = PAGES[cle]();
    document.title = (cle === 'accueil' ? '' : TITRES[cle] + ' — ') + etat.d.ecole.nom;
    $$('[data-page]').forEach(function (a) { a.classList.toggle('actif', a.getAttribute('data-page') === cle); });
    document.body.classList.remove('menu-ouvert');
    brancherFormulaires();
    animer();
    if (changement) window.scrollTo(0, 0);
  }

  function rendre(donnees) {
    etat.d = donnees;
    etat.d.annonces = donnees.annonces || [];
    etat.d.evenements = donnees.evenements || [];
    etat.d.options = donnees.options || [];
    etat.d.sections = donnees.sections || [];
    etat.d.frais = donnees.frais || [];
    etat.d.chiffres = donnees.chiffres || {};
    etat.c = normaliser(donnees.ecole.site_config || {});
    appliquerApparence(etat.c);
    favicon(donnees.ecole);
    dessinerCoquille();
    $('#chargement').style.display = 'none';
    $('#site').style.display = '';
    etat.page = null;
    naviguer();
    adresseDansLaBarre(donnees.ecole);
  }

  /* Un ancien lien (ecole.html?code=…) affiche l'adresse courte dans la
     barre du navigateur : c'est elle que les familles recopient et
     partagent. Seulement sur le vrai domaine — ailleurs (aperçu, test
     local), le chemin court ne serait pas servi par 404.html. */
  function adresseDansLaBarre(ecole) {
    if (APERCU || ADRESSE_COURTE || !ecole.site_adresse) return;
    if (!/(^|\.)myardoise\.com$/.test(window.location.hostname)) return;
    try { history.replaceState(null, '', '/' + ecole.site_adresse + window.location.hash); } catch (x) { /* navigateur ancien */ }
  }

  /* Le serveur renvoie une configuration déjà nettoyée ; l'aperçu, lui,
     reçoit celle de l'écran de saisie. Les valeurs manquantes sont donc
     complétées ici dans les deux cas. */
  function normaliser(c) {
    var THEMES = ['prestige', 'horizon', 'eveil', 'campus', 'verdure', 'epure'];
    var HERITES = { classique: 'prestige', moderne: 'horizon', chaleureux: 'verdure' };
    var x = Object.assign({}, c);
    x.theme = HERITES[x.theme] || x.theme;
    if (THEMES.indexOf(x.theme) < 0) x.theme = 'prestige';
    x.pages = Object.assign({ ecole: true, inscriptions: true, vie: true, infos: true, contact: true, parents: true, eleves: true }, c.pages || {});
    ['valeurs', 'chiffres', 'atouts', 'pieces', 'activites', 'equipe', 'galerie', 'temoignages', 'faq', 'documents'].forEach(function (k) {
      if (!Array.isArray(x[k])) x[k] = [];
    });
    x.mot_directeur = x.mot_directeur || {};
    x.reseaux = x.reseaux || {};
    x.inscriptions_en_ligne = x.inscriptions_en_ligne !== false;
    return x;
  }

  function favicon(ecole) {
    var l = $('link[rel="icon"]');
    var logo = urlSure(ecole.logo_url);
    if (logo) { l.href = logo; return; }
    var couleur = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1E4E8C';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M24 2 43 8v14c0 12-8.5 20.5-19 24C13.5 42.5 5 34 5 22V8Z" fill="' + couleur + '"/>' +
      '<text x="24" y="30" text-anchor="middle" fill="#fff" font-family="Georgia,serif" font-weight="700" font-size="18">' + e(initiales(ecole.nom).slice(0, 2)) + '</text></svg>';
    l.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function erreur(texte, retourAccueil) {
    $('#chargement').innerHTML = '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6">' + TRACES.vide + '</svg><p style="max-width:420px">' + e(texte) + '</p>' +
      (retourAccueil ? '<a class="bouton" href="/">Revenir à l’accueil</a>' : '');
  }

  window.addEventListener('hashchange', naviguer);
  window.addEventListener('scroll', function () {
    var h = $('#entete'); if (h) h.classList.toggle('defile', window.scrollY > 10);
  }, { passive: true });

  /* Aperçu : l'écran « Site public » de la direction envoie la page à
     afficher. Seuls les messages de la même origine sont acceptés. */
  if (APERCU) {
    window.addEventListener('message', function (ev) {
      if (ev.origin !== window.location.origin || !ev.data || ev.data.type !== 'apercu-site') return;
      var garde = etat.page;
      CODE = ev.data.donnees.ecole.code || CODE;
      rendre(ev.data.donnees);
      if (garde && garde !== 'accueil' && window.location.hash.indexOf(garde) < 0) window.location.hash = '#/' + garde;
    });
    if (window.parent !== window) window.parent.postMessage({ type: 'apercu-pret' }, window.location.origin);
    return;
  }

  // 404.html sans adresse d'école reconnaissable : c'est une vraie page
  // introuvable du site, pas un site d'école.
  if (!CODE && document.documentElement.hasAttribute('data-page-introuvable')) {
    document.title = 'Page introuvable';
    erreur('Cette page n’existe pas ou a été déplacée.', true);
    return;
  }
  if (!CODE) { erreur('Adresse incomplète : le code de l’école est manquant.'); return; }
  fetch(API + '/public/ecole/' + encodeURIComponent(CODE))
    .then(function (r) {
      if (r.status === 404 && ADRESSE_COURTE) {
        document.title = 'Page introuvable';
        throw Object.assign(new Error('Aucun site ne correspond à cette adresse. Vérifiez l’orthographe, ou demandez l’adresse exacte à l’école.'), { accueil: true });
      }
      if (r.status === 404) throw new Error('Ce site n’est pas disponible pour le moment.');
      if (!r.ok) throw new Error('Une erreur est survenue. Réessayez dans quelques instants.');
      return r.json();
    })
    .then(rendre)
    .catch(function (x) { erreur(x && x.message && !/fetch/i.test(x.message) ? x.message : 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.', x && x.accueil); });
})();
