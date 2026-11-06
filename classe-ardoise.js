/*
 * ARDOISE — LA CLASSE ARDOISE (navigateur)
 * ===========================================================================
 *
 * Une vraie salle de classe, vue d'en haut : le tableau au mur (la vidéo du
 * coach, son écran ou la craie s'y affichent), le bureau du coach, les bancs.
 * Chacun choisit son avatar, entre par la porte et prend une place. On lève
 * la main, le coach donne la parole, écrit au tableau, lance un sondage où
 * chacun lève son carton, démarre un minuteur ; on applaudit.
 *
 * RÉSEAU (voir utils/classe-live.js côté serveur) :
 *   · la classe elle-même (places, mains, parole, tableau, sondages,
 *     discussion) passe par le serveur d'Ardoise, en petits messages ;
 *   · le son et l'image vont en direct, en ÉTOILE autour du coach : chaque
 *     apprenant n'a qu'une connexion et ne reçoit qu'UN flux de son, mélangé
 *     par le navigateur du coach ;
 *   · la qualité est mesurée en continu : si elle baisse, la classe PROPOSE
 *     le mode connexion faible (son et tableau seulement).
 *
 * Utilisation : ClasseArdoise.ouvrir({ api, paquet, quitter }) où `paquet`
 * est la réponse de /formation/seances/:id/classe ou de
 * /public/centre/:code/apprenant/classe.
 */
(function () {
  'use strict';

  /* =====================================================================
     OUTILS
     ===================================================================== */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function borne(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function deux(n) { return (n < 10 ? '0' : '') + n; }

  /* =====================================================================
     AVATARS — bustes dessinés, sans aucune image téléchargée
     ===================================================================== */
  var PEAU = { p1: '#f6d3b3', p2: '#e8b48c', p3: '#c98e62', p4: '#a8693f', p5: '#7d4a28', p6: '#573420' };
  var CHEVEUX = { noir: '#1d1a19', brun: '#4a2e1d', chatain: '#7a5230', roux: '#b5541f', gris: '#a9a9a9', bleu: '#2f5fd0' };
  var HAUT = { bleu: '#2a78d6', rouge: '#d64545', vert: '#2f9e6b', jaune: '#e5b52a', violet: '#7a4fc9', orange: '#eb6834', blanc: '#eeeeee', noir: '#2b2b2b' };
  var CHOIX = {
    peau: { titre: 'Teint', valeurs: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] },
    coiffure: { titre: 'Coiffure', valeurs: ['court', 'afro', 'tresses', 'chignon', 'foulard', 'long', 'rase', 'locks'],
      noms: { court: 'Courte', afro: 'Afro', tresses: 'Tresses', chignon: 'Chignon', foulard: 'Foulard', long: 'Longue', rase: 'Rasée', locks: 'Locks' } },
    cheveux: { titre: 'Couleur', valeurs: ['noir', 'brun', 'chatain', 'roux', 'gris', 'bleu'] },
    haut: { titre: 'Tenue', valeurs: ['bleu', 'rouge', 'vert', 'jaune', 'violet', 'orange', 'blanc', 'noir'] },
    accessoire: { titre: 'Accessoire', valeurs: ['aucun', 'lunettes', 'casquette', 'noeud', 'boucles', 'casque'],
      noms: { aucun: 'Aucun', lunettes: 'Lunettes', casquette: 'Casquette', noeud: 'Nœud', boucles: 'Boucles', casque: 'Casque' } }
  };
  var COULEURS_CHOIX = { peau: PEAU, cheveux: CHEVEUX, haut: HAUT };

  function teinte(hex, f) {
    var n = parseInt(String(hex).slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function c(x) { return borne(Math.round(x * f), 0, 255); }
    return '#' + ((1 << 24) + (c(r) << 16) + (c(g) << 8) + c(b)).toString(16).slice(1);
  }

  /** Buste de face (viewBox 64×64), bras levé et bouche qui parle pilotés en CSS. */
  function avatarSvg(av) {
    av = av || {};
    var pe = PEAU[av.peau] || PEAU.p3, ch = CHEVEUX[av.cheveux] || CHEVEUX.noir, ht = HAUT[av.haut] || HAUT.bleu;
    var co = av.coiffure || 'court', ac = av.accessoire || 'aucun';
    var calotte = '<path d="M18 25 q0 -14 14 -14 q14 0 14 14 q-3 -7 -9 -7.5 q-6 3.5 -14 2.5 q-4 1.5 -5 5z" fill="' + ch + '"/>';
    var arriere = '', avant = calotte;
    if (co === 'afro') { arriere = '<circle cx="32" cy="22" r="19" fill="' + ch + '"/><circle cx="18" cy="28" r="6" fill="' + ch + '"/><circle cx="46" cy="28" r="6" fill="' + ch + '"/>'; avant = '<path d="M17 24 q15 -12 30 0 q-3 -12 -15 -12 q-12 0 -15 12z" fill="' + ch + '"/>'; }
    else if (co === 'tresses') arriere = '<g stroke="' + ch + '" stroke-width="3.2" stroke-linecap="round" fill="none"><path d="M19 26 q-3 10 -2 21"/><path d="M45 26 q3 10 2 21"/><path d="M22 22 q-5 12 -3 24"/><path d="M42 22 q5 12 3 24"/></g><circle cx="17" cy="47" r="1.8" fill="#f2c94c"/><circle cx="47" cy="47" r="1.8" fill="#f2c94c"/>';
    else if (co === 'chignon') arriere = '<circle cx="32" cy="9.5" r="6.5" fill="' + ch + '"/>';
    else if (co === 'long') arriere = '<path d="M16 27 q0 -18 16 -18 q16 0 16 18 v17 q-4 3 -8 1 v-16 h-16 v16 q-4 2 -8 -1z" fill="' + ch + '"/>';
    else if (co === 'rase') avant = '<path d="M18.5 23 q2 -11.5 13.5 -11.5 q11.5 0 13.5 11.5 q-13.5 -5 -27 0z" fill="' + ch + '" opacity=".55"/>';
    else if (co === 'locks') arriere = '<g stroke="' + ch + '" stroke-width="4" stroke-linecap="round"><path d="M18 24 v18"/><path d="M46 24 v18"/><path d="M21 20 v24"/><path d="M43 20 v24"/></g>';
    else if (co === 'foulard') {
      var wax = teinte(ht, 0.82);
      avant = '<path d="M15.5 27 q0 -19 16.5 -19 q16.5 0 16.5 19 q-16.5 -7 -33 0z" fill="' + wax + '"/><path d="M17 22 q15 -6 30 0" stroke="#fff" stroke-opacity=".45" stroke-width="1.4" fill="none" stroke-dasharray="2 2.5"/>' +
        '<ellipse cx="25" cy="8.5" rx="6" ry="4" fill="' + wax + '" transform="rotate(-24 25 8.5)"/><ellipse cx="39" cy="8.5" rx="6" ry="4" fill="' + wax + '" transform="rotate(24 39 8.5)"/><circle cx="32" cy="10" r="3" fill="' + teinte(wax, 0.85) + '"/>';
    }
    var acc = '';
    if (ac === 'lunettes') acc = '<g stroke="#222" stroke-width="1.4" fill="rgba(255,255,255,.18)"><circle cx="27" cy="27" r="4"/><circle cx="37" cy="27" r="4"/></g><path d="M31 27 h2" stroke="#222" stroke-width="1.4"/>';
    else if (ac === 'casquette') acc = '<path d="M17 22 q1 -12.5 15 -12.5 q14 0 15 12.5z" fill="' + teinte(ht, 0.75) + '"/><ellipse cx="32" cy="22" rx="17" ry="3" fill="' + teinte(ht, 0.6) + '"/><circle cx="32" cy="10" r="1.6" fill="' + teinte(ht, 0.6) + '"/>';
    else if (ac === 'noeud') acc = '<path d="M38 14 l6 -4 v8z M50 14 l-6 -4 v8z" fill="#e0457b"/><circle cx="44" cy="14" r="2" fill="#b8325f"/>';
    else if (ac === 'boucles') acc = '<circle cx="18" cy="32" r="1.8" fill="#f2c94c"/><circle cx="46" cy="32" r="1.8" fill="#f2c94c"/>';
    else if (ac === 'casque') acc = '<path d="M16 27 q0 -19 16 -19 q16 0 16 19" stroke="#333" stroke-width="3" fill="none"/><rect x="12.5" y="23" width="6" height="10" rx="2.5" fill="#333"/><rect x="45.5" y="23" width="6" height="10" rx="2.5" fill="#333"/>';
    return '<svg viewBox="0 0 64 64" class="ca-buste" aria-hidden="true">' + arriere +
      '<g class="ca-bras"><path d="M47 52 q9 -9 9 -32" stroke="' + ht + '" stroke-width="6" stroke-linecap="round" fill="none"/><circle cx="56" cy="17" r="4.6" fill="' + pe + '"/></g>' +
      '<path d="M9 64 q0 -21 23 -22 q23 1 23 22z" fill="' + ht + '"/><path d="M25 43 l7 6 l7 -6" stroke="' + teinte(ht, 0.7) + '" stroke-width="2" fill="none" stroke-linejoin="round"/>' +
      '<rect x="28" y="36" width="8" height="8" rx="3" fill="' + teinte(pe, 0.9) + '"/>' +
      '<circle cx="18" cy="27" r="3.2" fill="' + teinte(pe, 0.94) + '"/><circle cx="46" cy="27" r="3.2" fill="' + teinte(pe, 0.94) + '"/>' +
      '<circle cx="32" cy="26" r="14" fill="' + pe + '"/>' + avant +
      '<g class="ca-yeux"><ellipse cx="27" cy="27" rx="1.6" ry="2" fill="#222"/><ellipse cx="37" cy="27" rx="1.6" ry="2" fill="#222"/></g>' +
      '<circle cx="23.5" cy="31" r="2.2" fill="#ff7b7b" opacity=".22"/><circle cx="40.5" cy="31" r="2.2" fill="#ff7b7b" opacity=".22"/>' +
      '<path class="ca-sourire" d="M28 32.5 q4 3.2 8 0" stroke="#5a2a1a" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
      '<ellipse class="ca-bouche" cx="32" cy="33.5" rx="2.6" ry="2" fill="#5a2a1a"/>' + acc + '</svg>';
  }

  /* =====================================================================
     LA SALLE — 1000 × 800 unités ; le mur du fond est vu de face (le
     tableau y est accroché), le sol vu d'en haut
     ===================================================================== */
  var TABLEAU = { x: 240, y: 16, l: 520, h: 292 };   // 16:9 exactement
  var BUREAU = { x: 410, y: 360, l: 180, h: 40 };
  var COLONNES = [150, 385, 615, 850];
  var PORTE = { x: 72, y: 860 };

  function dispositionPlaces(nombre) {
    var rangs = Math.ceil(nombre / 8);
    var pas = rangs > 1 ? Math.min(78, (765 - 470) / (rangs - 1)) : 0;
    var places = [];
    for (var r = 0; r < rangs; r += 1) {
      for (var c = 0; c < 4; c += 1) {
        for (var k = 0; k < 2; k += 1) {
          if (places.length >= nombre) break;
          places.push({ i: places.length, rang: r, x: COLONNES[c] + (k ? 42 : -42), y: 470 + r * pas, banc: r * 4 + c });
        }
      }
    }
    return places;
  }

  function decorSvg() {
    var horloge = '<g transform="translate(880 112)"><circle r="52" fill="#fff" stroke="#6b4f3a" stroke-width="7"/>' +
      Array.apply(null, Array(12)).map(function (_, i) { var a = i * Math.PI / 6; return '<line x1="' + (Math.sin(a) * 40).toFixed(1) + '" y1="' + (-Math.cos(a) * 40).toFixed(1) + '" x2="' + (Math.sin(a) * 46).toFixed(1) + '" y2="' + (-Math.cos(a) * 46).toFixed(1) + '" stroke="#6b4f3a" stroke-width="' + (i % 3 ? 2 : 4) + '"/>'; }).join('') +
      '<line class="ca-aiguille-h" x1="0" y1="0" x2="0" y2="-24" stroke="#2b2b2b" stroke-width="5" stroke-linecap="round"/><line class="ca-aiguille-m" x1="0" y1="0" x2="0" y2="-36" stroke="#2b2b2b" stroke-width="3.5" stroke-linecap="round"/><line class="ca-aiguille-s" x1="0" y1="6" x2="0" y2="-40" stroke="#eb6834" stroke-width="1.6"/><circle r="3.5" fill="#eb6834"/></g>';
    var fenetre = '<g><rect x="36" y="40" width="150" height="196" rx="6" fill="#bfe3ff" stroke="#f5efe4" stroke-width="10"/><path d="M111 40 v196 M36 138 h150" stroke="#f5efe4" stroke-width="7"/>' +
      '<circle cx="152" cy="80" r="14" fill="#ffe27a" opacity=".9"/><path d="M50 210 q30 -40 60 -10 q25 -30 60 6 v30 h-120z" fill="#7cc48f" opacity=".75"/>' +
      '<path d="M30 34 q16 110 0 210 h22 q-10 -100 0 -210z" fill="#d95f5f"/><path d="M192 34 q-16 110 0 210 h-22 q10 -100 0 -210z" fill="#d95f5f"/><rect x="24" y="28" width="174" height="10" rx="4" fill="#8a6a48"/></g>';
    var affiche = '<g transform="translate(818 196) rotate(2)"><rect width="124" height="92" rx="4" fill="#fff8e6" stroke="#e0cfa8" stroke-width="2"/><text x="62" y="34" text-anchor="middle" font-family="Georgia,serif" font-size="20" fill="#1E4E8C" font-weight="700">A · B · C</text><text x="62" y="62" text-anchor="middle" font-family="Georgia,serif" font-size="13" fill="#7a5230">Apprendre,</text><text x="62" y="80" text-anchor="middle" font-family="Georgia,serif" font-size="13" fill="#7a5230">c’est grandir</text><circle cx="62" cy="-2" r="4" fill="#d64545"/></g>';
    var plante = function (x, y) { return '<g transform="translate(' + x + ' ' + y + ')"><ellipse cx="0" cy="34" rx="26" ry="8" fill="rgba(0,0,0,.18)"/><path d="M-18 6 h36 l-5 28 h-26z" fill="#c4713b"/><g fill="#3f9b5a"><ellipse cx="-12" cy="-8" rx="9" ry="20" transform="rotate(-30 -12 -8)"/><ellipse cx="12" cy="-8" rx="9" ry="20" transform="rotate(30 12 -8)"/><ellipse cx="0" cy="-16" rx="9" ry="22"/></g><g fill="#2f7d47"><ellipse cx="-5" cy="-2" rx="5" ry="14" transform="rotate(-12 -5 -2)"/><ellipse cx="6" cy="-4" rx="5" ry="14" transform="rotate(16 6 -4)"/></g></g>'; };
    var etagere = '<g transform="translate(940 520)"><rect x="-16" y="-120" width="40" height="240" rx="4" fill="#8a6a48"/>' + [-100, -40, 20, 80].map(function (y, i) { return '<rect x="-12" y="' + y + '" width="9" height="34" fill="' + ['#2a78d6', '#d64545', '#e5b52a', '#2f9e6b'][i] + '"/><rect x="-1" y="' + (y + 4) + '" width="8" height="30" fill="' + ['#7a4fc9', '#eb6834', '#2a78d6', '#d64545'][i] + '"/><rect x="9" y="' + (y + 2) + '" width="9" height="32" fill="' + ['#2f9e6b', '#2a78d6', '#7a4fc9', '#e5b52a'][i] + '"/>'; }).join('') + '</g>';
    return '<svg class="ca-decor" viewBox="0 0 1000 800" preserveAspectRatio="none" aria-hidden="true"><defs>' +
      '<pattern id="ca-parquet" width="120" height="44" patternUnits="userSpaceOnUse"><rect width="120" height="44" fill="#d8b382"/><rect width="120" height="22" fill="#d2ab78"/><path d="M0 22 h120 M0 44 h120 M40 0 v22 M100 0 v22 M10 22 v22 M70 22 v22" stroke="#b98f5d" stroke-width="2"/></pattern>' +
      '<linearGradient id="ca-mur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3ead9"/><stop offset="1" stop-color="#e7dbc4"/></linearGradient>' +
      '<radialGradient id="ca-lumiere" cx=".5" cy=".55" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></radialGradient></defs>' +
      '<rect width="1000" height="800" fill="url(#ca-parquet)"/>' +
      '<rect width="1000" height="328" fill="url(#ca-mur)"/><rect y="316" width="1000" height="14" fill="#b88a5b"/><rect y="328" width="1000" height="6" fill="rgba(0,0,0,.12)"/>' +
      fenetre + horloge + affiche +
      '<rect x="228" y="6" width="544" height="314" rx="8" fill="#6d4c2f"/><rect x="236" y="12" width="528" height="300" rx="4" fill="#5a3d24"/>' +
      '<rect x="250" y="308" width="500" height="10" rx="3" fill="#8a6a48"/><rect x="300" y="303" width="22" height="6" rx="2" fill="#fff"/><rect x="330" y="304" width="16" height="5" rx="2" fill="#f7d25c"/><rect x="660" y="302" width="40" height="8" rx="2" fill="#3a5f9a"/>' +
      '<ellipse cx="500" cy="392" rx="190" ry="44" fill="#a33b3b" opacity=".35"/><ellipse cx="500" cy="392" rx="170" ry="34" fill="none" stroke="#f5d48a" stroke-width="3" opacity=".5" stroke-dasharray="10 8"/>' +
      plante(60, 380) + etagere +
      '<path d="M0 800 h30 M130 800 h870" stroke="#6b4f3a" stroke-width="16"/><path d="M0 330 v470 M1000 330 v470" stroke="#6b4f3a" stroke-width="12"/>' +
      '<path d="M30 800 a100 100 0 0 1 100 -100" stroke="#8a6a48" stroke-width="3" fill="none" stroke-dasharray="6 6"/><rect x="38" y="770" width="84" height="22" rx="6" fill="#4b7a5a" opacity=".85"/><text x="80" y="786" text-anchor="middle" font-size="12" fill="#fff" font-family="system-ui,sans-serif">Entrée</text>' +
      '<rect width="1000" height="800" fill="url(#ca-lumiere)"/></svg>';
  }

  /* =====================================================================
     LA CLASSE
     ===================================================================== */
  function ouvrir(opts) {
    var API = String(opts.api || '').replace(/\/+$/, '');
    var P = opts.paquet;
    var J = P.jeton;
    var MOI = P.pid;
    var REACTIONS = P.reactions || ['👏', '👍', '❤️', '😂', '😮', '❓', '✅', '🎉'];
    var etroit = function () { return window.matchMedia('(max-width: 820px)').matches; };
    var S = {
      participants: {}, animateur: null, scene: 'attente', micros_libres: !!(P.salle && P.salle.micros_libres), places_verrouillees: false,
      places: (P.salle && P.salle.places) || 20, chat: [], tableau: { traits: [], texte: '' }, sondage: null, minuteur: null,
      parleurs: [], decalage: 0, terminee: false, nonLus: 0,
      vue: (P.salle && P.salle.vue) || 'salle', ecran: [], cameras_apprenants: !(P.salle && P.salle.cameras_apprenants === false)
    };
    var PLACES = dispositionPlaces(S.places);
    var monAvatar = chargerAvatar();
    function vueParDefaut(mode) { return mode === 'visio' ? 'visio' : (etroit() ? 'tableau' : 'salle'); }
    var vueCourante = vueParDefaut(S.vue);
    var premierEtat = true;
    var panneau = etroit() ? null : 'discussion';
    var source = null, fermee = false;

    function chargerAvatar() {
      try { var a = JSON.parse(localStorage.getItem('ardoise-avatar') || 'null'); if (a && a.peau) return a; } catch (x) { /* rien */ }
      return null;
    }

    /* ---------- Squelette ---------- */
    var racine = el('<div class="ca-racine" data-role="' + esc(P.role) + '" role="dialog" aria-label="Classe Ardoise">' +
      '<header class="ca-entete"><div class="ca-titre"><span class="ca-pastille" aria-hidden="true"></span><div><strong>' + esc(P.salle.titre || 'Cours') + '</strong><span>' + esc([P.salle.theme, P.salle.heure_debut ? String(P.salle.heure_debut).slice(0, 5).replace(':', ' h ') : ''].filter(Boolean).join(' · ')) + '</span></div></div>' +
      '<div class="ca-vues" role="tablist"><button data-vue="salle" role="tab" title="La salle de classe dessinée, avec les avatars">🏫 Salle</button><button data-vue="visio" role="tab" title="La visio classique : le coach en grand, les vignettes des participants">🎥 Visio</button><button data-vue="tableau" role="tab" title="Le tableau en grand">🖥 Tableau</button></div>' +
      '<div class="ca-etat-reseau" data-reseau title="Qualité de votre connexion"><i></i><i></i><i></i><span>Connexion…</span></div>' +
      '<div class="ca-compte" data-compte>👥 0</div><button class="ca-quitter" data-quitter>Quitter</button></header>' +
      '<div class="ca-corps"><div class="ca-zone" data-zone><div class="ca-piece" data-piece>' + decorSvg() +
      '<div class="ca-tableau" data-tableau><video class="ca-video" playsinline muted></video><canvas class="ca-craie"></canvas><div class="ca-tableau-texte" data-texte-tableau></div>' +
      '<div class="ca-tableau-attente" data-attente><span>🧑‍🏫</span><strong>En attente du coach…</strong><small>La classe est ouverte : choisissez votre place.</small></div>' +
      '<button class="ca-agrandir" data-agrandir title="Agrandir le tableau">⤢</button><div class="ca-outils-craie" data-outils-craie></div></div>' +
      '<div class="ca-minuteur" data-minuteur hidden></div><div class="ca-scene" data-scene></div><div class="ca-flottants" data-flottants></div></div>' +
      '<div class="ca-bande" data-bande></div><div class="ca-vignettes" data-vignettes></div></div>' +
      '<aside class="ca-panneau" data-panneau><div class="ca-onglets"><button data-onglet="discussion">💬 Discussion<b data-non-lus hidden></b></button><button data-onglet="participants">👥 Classe</button><button data-onglet="sondage">📊 Sondage</button><button class="ca-fermer-panneau" data-fermer-panneau aria-label="Fermer">✕</button></div><div class="ca-volet" data-volet></div></aside></div>' +
      '<footer class="ca-barre" data-barre></footer><div class="ca-toasts" data-toasts></div><audio data-son autoplay></audio></div>');
    document.body.appendChild(racine);
    document.documentElement.classList.add('ca-ouverte');
    var video = $('.ca-video', racine), son = $('[data-son]', racine), toile = $('.ca-craie', racine);

    /* ---------- Réseau : actions et flux ---------- */
    function agir(type, corps) {
      return fetch(API + '/classe/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ j: J, type: type }, corps || {})) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.message || 'Action refusée.'); e.status = r.status; throw e; } return j; }); },
          function () { var e = new Error('Pas de connexion : réessayez dans un instant.'); e.horsLigne = true; throw e; });
    }
    function agirSilencieux(type, corps) { return agir(type, corps).catch(function (e) { if (!e.horsLigne) toast(e.message, 'alerte'); }); }

    var dernierMessage = Date.now(), echecsFlux = 0;
    function ouvrirFlux() {
      if (fermee) return;
      source = new EventSource(API + '/classe/flux?j=' + encodeURIComponent(J));
      source.onmessage = function (ev) {
        dernierMessage = Date.now(); echecsFlux = 0;
        var m; try { m = JSON.parse(ev.data); } catch (x) { return; }
        recevoir(m);
      };
      source.onerror = function () {
        marquerReseau('coupe');
        if (source.readyState === 2) {
          echecsFlux += 1;
          fetch(API + '/classe/ice?j=' + encodeURIComponent(J)).then(function (r) {
            if (r.status === 401) { finir('Votre accès à la classe a expiré. Rouvrez-la depuis Ardoise.'); return; }
            setTimeout(ouvrirFlux, Math.min(15000, 2000 * echecsFlux));
          }, function () { setTimeout(ouvrirFlux, Math.min(15000, 2000 * echecsFlux)); });
        }
      };
    }

    /* ---------- Réception ---------- */
    function participant(pid) { return S.participants[pid]; }
    function moi() { return S.participants[MOI] || {}; }
    function jeSuisAnimateur() { return S.animateur === MOI; }

    function recevoir(m) {
      switch (m.t) {
        case 'etat':
          S.decalage = m.maintenant - Date.now();
          S.participants = {}; m.participants.forEach(function (p) { S.participants[p.pid] = p; });
          S.participants[MOI] = m.moi;
          ['animateur', 'scene', 'micros_libres', 'places_verrouillees', 'tableau', 'sondage', 'minuteur', 'parleurs', 'terminee'].forEach(function (k) { S[k] = m[k]; });
          if (m.vue) S.vue = m.vue;
          S.ecran = m.ecran || [];
          if (typeof m.cameras_apprenants === 'boolean') S.cameras_apprenants = m.cameras_apprenants;
          if (premierEtat) { premierEtat = false; voirVue(vueParDefaut(S.vue)); }
          S.chat = m.chat || [];
          if (m.places && m.places !== S.places) { S.places = m.places; PLACES = dispositionPlaces(S.places); }
          if (m.terminee) { finir(); return; }
          redessinerTout();
          Media.surEtat();
          proposerPlace();
          break;
        case 'participant': {
          var avant = S.participants[m.p.pid];
          S.participants[m.p.pid] = m.p;
          if (m.p.pid === MOI && avant && avant.parole && !m.p.parole) Media.couperMicro(true);
          if (!avant && m.p.pid !== MOI && m.p.en_ligne) sonnerie('arrivee');
          rendreScene(); rendreBarre(); if (panneau === 'participants') rendreVolet();
          Media.surParticipant(m.p, avant);
          break;
        }
        case 'depart':
          delete S.participants[m.pid];
          rendreScene(); if (panneau === 'participants') rendreVolet();
          Media.surDepart(m.pid);
          break;
        case 'animateur': S.animateur = m.pid; rendreScene(); rendreBarre(); Media.surAnimateur(); break;
        case 'chat':
          S.chat.push(m.m); if (S.chat.length > 120) S.chat.shift();
          if (panneau === 'discussion') rendreVolet(); else { S.nonLus += 1; majNonLus(); }
          if (m.m.pid !== MOI) bulle(m.m.pid, m.m.texte);
          break;
        case 'reaction': reaction(m.pid, m.e); break;
        case 'parleurs': S.parleurs = m.pids || []; rendreParleurs(); break;
        case 'parole':
          if (m.donner) { toast('🎙️ Le coach vous donne la parole.', 'succes', { bouton: 'Parler maintenant', action: function () { Media.basculerMicro(true); } }); Media.basculerMicro(true, { silencieux: true }); }
          else { Media.couperMicro(true); toast('Le coach a repris la parole.'); }
          break;
        case 'muet': Media.couperMicro(true); toast('Le coach a coupé les micros.'); break;
        case 'traits': m.traits.forEach(function (t) { S.tableau.traits.push(t); dessinerTrait(t); }); break;
        case 'tableau': S.tableau = m.tableau; redessinerCraie(); rendreTexteTableau(); break;
        case 'tableau_texte': S.tableau.texte = m.texte; rendreTexteTableau(); break;
        case 'sondage':
          var etaitOuvert = S.sondage && S.sondage.ouvert;
          S.sondage = m.sondage;
          if (S.sondage && S.sondage.ouvert && !etaitOuvert && !jeSuisAnimateur()) { ouvrirPanneau('sondage'); sonnerie('sondage'); }
          if (panneau === 'sondage') rendreVolet();
          rendreScene();
          break;
        case 'minuteur': S.decalage = m.maintenant - Date.now(); S.minuteur = m.minuteur; rendreMinuteur(); break;
        case 'scene': S.scene = m.scene; rendreTableau(); break;
        case 'reglages':
          S.micros_libres = m.micros_libres; S.places_verrouillees = m.places_verrouillees;
          if (typeof m.cameras_apprenants === 'boolean') S.cameras_apprenants = m.cameras_apprenants;
          rendreBarre(); if (panneau === 'participants') rendreVolet(); break;
        case 'vue':
          S.vue = m.vue;
          voirVue(vueParDefaut(m.vue));
          if (!jeSuisAnimateur()) toast(m.vue === 'visio' ? '🎥 Le coach passe la classe en mode visio. Vous pouvez revenir à la salle en haut de l’écran.' : '🏫 Le coach passe la classe en mode salle.');
          break;
        case 'ecran': S.ecran = m.pids || []; Media.majEcran(); rendreVisio(); break;
        case 'cameras_coupees': Media.couperCamera(true); toast('Le coach a désactivé les caméras des apprenants.'); break;
        case 'signal': Media.surSignal(m.de, m.donnees); break;
        case 'fin': finir(null, m.bilan); break;
        case 'ping': S.decalage = m.maintenant - Date.now(); break;
        default: break;
      }
    }

    /* ---------- Rendu : la scène ---------- */
    var elements = {};        // pid → élément avatar
    var bancsDessines = false;

    function positionDe(p) {
      if (p.pid === S.animateur) return { x: 500, y: BUREAU.y, rang: -1, coach: true };
      if (p.role === 'observateur' || p.role === 'animateur') {
        var obs = Object.keys(S.participants).filter(function (k) { var x = S.participants[k]; return x.en_ligne && x.pid !== S.animateur && (x.role === 'observateur' || x.role === 'animateur') && x.place === null; }).sort();
        var i = obs.indexOf(p.pid);
        if (p.place === null || p.place === undefined) return { x: 948, y: 420 + Math.max(0, i) * 70, rang: 6, debout: true };
      }
      if (p.place !== null && p.place !== undefined && PLACES[p.place]) { var pl = PLACES[p.place]; return { x: pl.x, y: pl.y, rang: pl.rang }; }
      var attente = Object.keys(S.participants).filter(function (k) { var x = S.participants[k]; return x.en_ligne && (x.place === null || x.place === undefined) && x.pid !== S.animateur && x.role === 'apprenant'; }).sort();
      var j = Math.max(0, attente.indexOf(p.pid));
      return { x: 70 + (j % 3) * 34, y: 700 - Math.floor(j / 3) * 40, rang: 7, debout: true };
    }

    function pct(x, axe) { return (axe === 'x' ? x / 10 : x / 8) + '%'; }

    function dessinerBancs() {
      var sc = $('[data-scene]', racine);
      $$('.ca-banc, .ca-chaise, .ca-bureau, .ca-place', sc).forEach(function (n) { n.remove(); });
      var bancs = {};
      PLACES.forEach(function (pl) {
        if (!bancs[pl.banc]) {
          bancs[pl.banc] = true;
          var cx = COLONNES[pl.banc % 4];
          var b = el('<div class="ca-banc" aria-hidden="true"></div>');
          b.style.left = pct(cx - 85, 'x'); b.style.top = pct(pl.y, 'y'); b.style.width = '17%'; b.style.height = pct(30, 'y');
          b.style.zIndex = String(pl.rang * 10 + 5);
          sc.appendChild(b);
        }
        var bouton = el('<button class="ca-place" data-place="' + pl.i + '" aria-label="S’asseoir à la place ' + (pl.i + 1) + '"><span>+</span></button>');
        bouton.style.left = pct(pl.x - 26, 'x'); bouton.style.top = pct(pl.y - 50, 'y'); bouton.style.zIndex = String(pl.rang * 10 + 2);
        sc.appendChild(bouton);
      });
      var bu = el('<div class="ca-bureau" aria-hidden="true"><span class="ca-pomme">🍎</span><span class="ca-livres"></span></div>');
      bu.style.left = pct(BUREAU.x, 'x'); bu.style.top = pct(BUREAU.y, 'y'); bu.style.width = pct(BUREAU.l, 'x'); bu.style.height = pct(BUREAU.h, 'y');
      bu.style.zIndex = '5';
      sc.appendChild(bu);
      bancsDessines = true;
    }

    function classesAvatar(p) {
      var c = ['ca-avatar'];
      if (p.main) c.push('main');
      if (p.micro) c.push('micro');
      if (p.parole) c.push('parole');
      if (p.faible) c.push('faible');
      if (S.parleurs.indexOf(p.pid) >= 0) c.push('parle');
      if (p.pid === S.animateur) c.push('coach');
      if (p.pid === MOI) c.push('moi');
      return c.join(' ');
    }

    function rendreScene() {
      if (!bancsDessines) dessinerBancs();
      var sc = $('[data-scene]', racine);
      var occupees = {};
      Object.keys(S.participants).forEach(function (k) { var p = S.participants[k]; if (p.en_ligne && p.place !== null && p.place !== undefined) occupees[p.place] = p.pid; });
      $$('.ca-place', sc).forEach(function (b) {
        var i = Number(b.getAttribute('data-place'));
        var libre = !(i in occupees);
        b.classList.toggle('libre', libre && moi().role === 'apprenant' && !(S.places_verrouillees && moi().place !== null && moi().place !== undefined));
        b.classList.toggle('a-choisir', libre && moi().role === 'apprenant' && (moi().place === null || moi().place === undefined));
      });
      var vus = {};
      Object.keys(S.participants).forEach(function (k) {
        var p = S.participants[k];
        if (!p.en_ligne && p.pid !== MOI) return;
        vus[p.pid] = true;
        var pos = positionDe(p);
        var n = elements[p.pid];
        var nouveau = !n;
        if (nouveau) {
          n = el('<div class="ca-avatar"><div class="ca-halo"></div><div class="ca-carton" data-carton></div><div class="ca-main-levee" aria-hidden="true">✋</div>' +
            '<div class="ca-corps-avatar"></div></div>');
          // Le nom est posé sur le devant du banc (un chevalet), au-dessus des bancs :
          // sous l'avatar, il serait caché par le banc.
          n._tag = el('<div class="ca-etiquette"><span class="ca-nom"></span><span class="ca-icones"></span></div>');
          n._tag.style.left = pct(PORTE.x, 'x'); n._tag.style.top = pct(PORTE.y, 'y');
          sc.appendChild(n._tag);
          n.style.left = pct(PORTE.x - 36, 'x'); n.style.top = pct(PORTE.y - 62, 'y');
          sc.appendChild(n);
          elements[p.pid] = n;
          n.addEventListener('click', function () { if (jeSuisAnimateur() && p.pid !== MOI) ficheParticipant(p.pid); });
        }
        var cle = JSON.stringify(p.avatar);
        if (n.getAttribute('data-av') !== cle) { $('.ca-corps-avatar', n).innerHTML = avatarSvg(p.avatar); n.setAttribute('data-av', cle); }
        n.className = classesAvatar(p) + (pos.debout ? ' debout' : '');
        var tag = n._tag;
        $('.ca-nom', tag).textContent = p.pid === S.animateur ? 'Coach ' + p.nom : p.nom + (p.pid === MOI ? ' (vous)' : '');
        $('.ca-icones', tag).textContent = (p.micro ? '🎙️' : '') + (p.faible ? '🐢' : '');
        tag.className = 'ca-etiquette' + (p.pid === MOI ? ' moi' : '') + (p.pid === S.animateur ? ' coach' : '');
        var cible = { left: pct(pos.x - 36, 'x'), top: pct(pos.y - (pos.coach ? 70 : 62), 'y') };
        n.style.zIndex = String(pos.rang < 0 ? 4 : pos.rang * 10 + 3);
        tag.style.zIndex = String(pos.rang < 0 ? 6 : pos.rang * 10 + 6);
        var cibleTag = { left: pct(pos.x, 'x'), top: pct(pos.y + (pos.coach ? 10 : pos.debout ? 4 : 8), 'y') };
        if (n.style.left !== cible.left || n.style.top !== cible.top) {
          var deplacer = function () { n.classList.add('marche'); n.style.left = cible.left; n.style.top = cible.top; tag.style.left = cibleTag.left; tag.style.top = cibleTag.top; clearTimeout(n._fin); n._fin = setTimeout(function () { n.classList.remove('marche'); }, 1700); };
          if (nouveau) requestAnimationFrame(function () { requestAnimationFrame(deplacer); }); else deplacer();
        }
        // Carton du sondage, levé une fois les réponses révélées.
        var carton = $('[data-carton]', n);
        var rep = S.sondage && S.sondage.cartons ? S.sondage.cartons[p.pid] : undefined;
        if (rep !== undefined && rep !== null) {
          carton.textContent = String.fromCharCode(65 + rep);
          carton.className = 'ca-carton visible c' + rep + (S.sondage.bonne !== null && S.sondage.bonne !== undefined ? (S.sondage.bonne === rep ? ' juste' : ' faux') : '');
        } else carton.className = 'ca-carton';
      });
      Object.keys(elements).forEach(function (pid) {
        if (vus[pid]) return;
        var n = elements[pid]; delete elements[pid];
        n.classList.add('marche', 'sortie'); n.style.left = pct(PORTE.x - 32, 'x'); n.style.top = pct(PORTE.y - 30, 'y');
        if (n._tag) n._tag.remove();
        setTimeout(function () { n.remove(); }, 1600);
      });
      var nb = Object.keys(S.participants).filter(function (k) { return S.participants[k].en_ligne; }).length;
      $('[data-compte]', racine).textContent = '👥 ' + nb;
      rendreBande();
      rendreVisio();
    }

    function rendreParleurs() {
      Object.keys(elements).forEach(function (pid) { elements[pid].classList.toggle('parle', S.parleurs.indexOf(pid) >= 0); });
      $$('[data-bande] .ca-mini', racine).forEach(function (m) { m.classList.toggle('parle', S.parleurs.indexOf(m.getAttribute('data-pid')) >= 0); });
      $$('[data-vignettes] .ca-vignette', racine).forEach(function (m) { m.classList.toggle('parle', S.parleurs.indexOf(m.getAttribute('data-pid')) >= 0); });
    }

    /* ---------- Mode visio : les vignettes des participants ---------- */
    var vignettes = {};       // pid → élément
    var epingles = [];        // animateur : apprenants mis à l'écran à la main, dans l'ordre
    function rendreVisio() {
      var z = $('[data-vignettes]', racine);
      if (vueCourante !== 'visio') return;
      var liste = Object.keys(S.participants).map(function (k) { return S.participants[k]; }).filter(function (p) { return p.en_ligne || p.pid === MOI; })
        .sort(function (a, b) {
          var ra = a.pid === MOI ? 0 : a.pid === S.animateur ? 1 : (S.ecran.indexOf(a.pid) >= 0 ? 2 : a.camera ? 3 : 4);
          var rb = b.pid === MOI ? 0 : b.pid === S.animateur ? 1 : (S.ecran.indexOf(b.pid) >= 0 ? 2 : b.camera ? 3 : 4);
          return ra - rb || String(a.nom).localeCompare(b.nom);
        });
      var vus = {};
      liste.forEach(function (p, i) {
        vus[p.pid] = true;
        var v = vignettes[p.pid];
        if (!v) {
          v = el('<div class="ca-vignette" data-pid="' + esc(p.pid) + '"><video muted playsinline autoplay></video><div class="ca-vi-av"></div>' +
            '<div class="ca-vi-bas"><span class="ca-vi-nom"></span><span class="ca-vi-ic"></span></div><i class="ca-vi-main">✋</i><span class="ca-vi-note"></span></div>');
          v.addEventListener('click', function () { cliquerVignette(p.pid); });
          vignettes[p.pid] = v;
        }
        if (z.children[i] !== v) z.insertBefore(v, z.children[i] || null);
        var flux = Media.fluxDe(p.pid);
        var vid = $('video', v);
        if (vid.srcObject !== flux) { vid.srcObject = flux || null; if (flux) vid.play().catch(function () {}); }
        var cle = JSON.stringify(p.avatar);
        if (v.getAttribute('data-av') !== cle) { $('.ca-vi-av', v).innerHTML = avatarSvg(p.avatar); v.setAttribute('data-av', cle); }
        v.className = 'ca-vignette' + (flux ? ' avec-video' : '') + (p.pid === MOI ? ' moi' : '') + (p.pid === S.animateur ? ' coach' : '') + (p.main ? ' main' : '') +
          (S.parleurs.indexOf(p.pid) >= 0 ? ' parle' : '') + (epingles.indexOf(p.pid) >= 0 ? ' epingle' : '');
        $('.ca-vi-nom', v).textContent = (p.pid === S.animateur ? 'Coach ' : '') + p.nom + (p.pid === MOI ? ' (vous)' : '');
        $('.ca-vi-ic', v).textContent = (p.micro ? '🎙️' : '🔇') + (p.faible ? ' 🐢' : '') + (epingles.indexOf(p.pid) >= 0 ? ' 📌' : '');
        var note = '';
        if (p.pid === S.animateur) note = 'au tableau';
        else if (p.pid === MOI && p.camera && !jeSuisAnimateur()) note = S.ecran.indexOf(MOI) >= 0 ? 'vous êtes à l’écran' : 'visible par le coach';
        else if (!jeSuisAnimateur() && p.camera && S.ecran.indexOf(p.pid) < 0) note = '📷';
        $('.ca-vi-note', v).textContent = note;
      });
      Object.keys(vignettes).forEach(function (pid) { if (!vus[pid]) { vignettes[pid].remove(); delete vignettes[pid]; } });
    }
    function cliquerVignette(pid) {
      var p = participant(pid); if (!p || pid === MOI) return;
      if (!jeSuisAnimateur() || p.role !== 'apprenant') return;
      var i = epingles.indexOf(pid);
      if (i >= 0) { epingles.splice(i, 1); toast(p.nom + ' n’est plus épinglé à l’écran.'); }
      else if (!p.camera) { toast(p.nom + ' n’a pas ouvert sa caméra.', '', { bouton: p.parole ? 'Reprendre la parole' : 'Donner la parole', action: function () { agirSilencieux('parole', { pid: pid, donner: !p.parole }); } }); return; }
      else { epingles.unshift(pid); toast('📌 ' + p.nom + ' est à l’écran de toute la classe.'); }
      Media.choisirEcran(true);
      rendreVisio();
    }

    function rendreBande() {
      var b = $('[data-bande]', racine);
      var liste = Object.keys(S.participants).map(function (k) { return S.participants[k]; }).filter(function (p) { return p.en_ligne; })
        .sort(function (a, c) { return (c.pid === S.animateur) - (a.pid === S.animateur) || (c.main ? 1 : 0) - (a.main ? 1 : 0) || String(a.nom).localeCompare(c.nom); });
      b.innerHTML = liste.map(function (p) {
        return '<div class="ca-mini' + (p.main ? ' main' : '') + (p.micro ? ' micro' : '') + (S.parleurs.indexOf(p.pid) >= 0 ? ' parle' : '') + '" data-pid="' + esc(p.pid) + '">' + avatarSvg(p.avatar) +
          '<span>' + esc(p.pid === S.animateur ? 'Coach' : String(p.nom).split(' ')[0]) + '</span>' + (p.main ? '<i>✋</i>' : '') + '</div>';
      }).join('');
    }

    function proposerPlace() {
      var m = moi();
      if (m.role !== 'apprenant' || (m.place !== null && m.place !== undefined)) return;
      clearTimeout(proposerPlace.t);
      // Pas de choix au bout de vingt secondes : une place libre, près du tableau.
      proposerPlace.t = setTimeout(function () {
        var m2 = moi(); if (m2.place !== null && m2.place !== undefined) return;
        var prises = {}; Object.keys(S.participants).forEach(function (k) { var p = S.participants[k]; if (p.en_ligne && p.place !== null && p.place !== undefined) prises[p.place] = 1; });
        var libre = PLACES.filter(function (pl) { return !prises[pl.i]; })[0];
        if (libre) agirSilencieux('place', { place: libre.i });
      }, 20000);
    }

    /* ---------- Rendu : le tableau ---------- */
    function rendreTableau() {
      var t = $('[data-tableau]', racine);
      var coachLa = !!S.animateur;
      t.setAttribute('data-mode', S.scene);
      var avecVideo = (S.scene === 'video' || S.scene === 'ecran') && !moi().faible;
      video.classList.toggle('visible', avecVideo && Media.videoDisponible());
      var att = $('[data-attente]', racine);
      att.hidden = coachLa && S.scene !== 'attente';
      $('strong', att).textContent = !coachLa ? 'En attente du coach…' : jeSuisAnimateur() ? 'Vous animez la classe' : 'Le coach est là';
      $('small', att).textContent = !coachLa ? 'La classe est ouverte : choisissez votre place.' : jeSuisAnimateur() ? 'Activez votre caméra, partagez votre écran ou écrivez au tableau.' : moi().faible ? 'Mode connexion faible : vous gardez le son et le tableau.' : 'Le cours va commencer.';
      if (moi().faible && (S.scene === 'video' || S.scene === 'ecran')) { att.hidden = false; $('span', att).textContent = '🐢'; $('strong', att).textContent = 'Mode connexion faible'; }
      else $('span', att).textContent = '🧑‍🏫';
      t.classList.toggle('craie-active', jeSuisAnimateur() && outil.actif);
      rendreOutilsCraie();
      redimensionnerCraie();
    }

    function rendreTexteTableau() {
      var z = $('[data-texte-tableau]', racine);
      z.textContent = S.tableau.texte || '';
      z.hidden = !S.tableau.texte;
    }

    /* ---------- La craie ---------- */
    var outil = { actif: false, couleur: '#ffffff', epaisseur: 4, gomme: false };
    var COULEURS_CRAIE = ['#ffffff', '#ffe066', '#7fd4ff', '#ff9ec7', '#9be89b'];
    var ctx2d = toile.getContext('2d');

    function redimensionnerCraie() {
      var r = toile.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var l = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (toile.width !== l || toile.height !== h) { toile.width = l; toile.height = h; redessinerCraie(); }
    }
    function dessinerTrait(t) {
      var l = toile.width, h = toile.height;
      if (!t.pts || !t.pts.length) return;
      ctx2d.save();
      ctx2d.globalCompositeOperation = t.g ? 'destination-out' : 'source-over';
      ctx2d.strokeStyle = t.c; ctx2d.fillStyle = t.c;
      ctx2d.lineWidth = t.l * (l / 1000) * (t.g ? 4 : 1); ctx2d.lineCap = 'round'; ctx2d.lineJoin = 'round';
      ctx2d.globalAlpha = t.g ? 1 : 0.92;
      ctx2d.beginPath();
      ctx2d.moveTo(t.pts[0][0] / 1000 * l, t.pts[0][1] / 1000 * h);
      if (t.pts.length === 1) ctx2d.lineTo(t.pts[0][0] / 1000 * l + 0.1, t.pts[0][1] / 1000 * h);
      for (var i = 1; i < t.pts.length; i += 1) ctx2d.lineTo(t.pts[i][0] / 1000 * l, t.pts[i][1] / 1000 * h);
      ctx2d.stroke();
      ctx2d.restore();
    }
    function redessinerCraie() { ctx2d.clearRect(0, 0, toile.width, toile.height); (S.tableau.traits || []).forEach(dessinerTrait); }

    (function brancherCraie() {
      var enCours = null, enAttente = [], minuterie = null;
      function point(ev) { var r = toile.getBoundingClientRect(); return [Math.round(borne((ev.clientX - r.left) / r.width, 0, 1) * 1000), Math.round(borne((ev.clientY - r.top) / r.height, 0, 1) * 1000)]; }
      function vider() {
        minuterie = null;
        if (!enAttente.length) return;
        var lot = enAttente; enAttente = [];
        agirSilencieux('trait', { traits: lot });
      }
      function pousser(final) {
        if (!enCours || enCours.pts.length < (final ? 1 : 2)) return;
        var morceau = { id: enCours.id, c: enCours.c, l: enCours.l, g: enCours.g, pts: enCours.pts.slice() };
        S.tableau.traits.push(morceau);
        enAttente.push(morceau);
        enCours.pts = [enCours.pts[enCours.pts.length - 1]];
        if (!minuterie) minuterie = setTimeout(vider, 120);
      }
      toile.addEventListener('pointerdown', function (ev) {
        if (!jeSuisAnimateur() || !outil.actif) return;
        ev.preventDefault(); toile.setPointerCapture(ev.pointerId);
        enCours = { id: Math.random().toString(36).slice(2, 10), c: outil.couleur, l: outil.epaisseur, g: outil.gomme, pts: [point(ev)] };
      });
      toile.addEventListener('pointermove', function (ev) {
        if (!enCours) return;
        var pt = point(ev), der = enCours.pts[enCours.pts.length - 1];
        if (Math.abs(pt[0] - der[0]) + Math.abs(pt[1] - der[1]) < 3) return;
        enCours.pts.push(pt);
        dessinerTrait({ c: enCours.c, l: enCours.l, g: enCours.g, pts: [der, pt] });
        if (enCours.pts.length >= 24) pousser();
      });
      function fin() { if (!enCours) return; if (enCours.pts.length === 1) dessinerTrait(enCours); pousser(true); enCours = null; }
      toile.addEventListener('pointerup', fin);
      toile.addEventListener('pointercancel', fin);
    })();

    function rendreOutilsCraie() {
      var z = $('[data-outils-craie]', racine);
      if (!jeSuisAnimateur() || !outil.actif) { z.innerHTML = ''; return; }
      z.innerHTML = COULEURS_CRAIE.map(function (c) { return '<button class="ca-craie-c' + (!outil.gomme && outil.couleur === c ? ' actif' : '') + '" data-c="' + c + '" style="background:' + c + '" aria-label="Craie"></button>'; }).join('') +
        '<button class="ca-craie-b' + (outil.epaisseur > 5 ? ' actif' : '') + '" data-ep title="Épaisseur">' + (outil.epaisseur > 5 ? '●' : '•') + '</button>' +
        '<button class="ca-craie-b' + (outil.gomme ? ' actif' : '') + '" data-gomme title="Gomme">🧽</button><button class="ca-craie-b" data-mot title="Écrire un mot au tableau">Aa</button><button class="ca-craie-b" data-effacer title="Tout effacer">🗑</button>';
      $$('[data-c]', z).forEach(function (b) { b.addEventListener('click', function () { outil.couleur = b.getAttribute('data-c'); outil.gomme = false; rendreOutilsCraie(); }); });
      $('[data-ep]', z).addEventListener('click', function () { outil.epaisseur = outil.epaisseur > 5 ? 4 : 9; rendreOutilsCraie(); });
      $('[data-gomme]', z).addEventListener('click', function () { outil.gomme = !outil.gomme; rendreOutilsCraie(); });
      $('[data-effacer]', z).addEventListener('click', function () { agirSilencieux('tableau_effacer'); });
      $('[data-mot]', z).addEventListener('click', function () {
        var t = window.prompt('Le mot ou la phrase à écrire en grand au tableau (vide pour effacer) :', S.tableau.texte || '');
        if (t !== null) agirSilencieux('tableau_texte', { texte: t });
      });
    }

    /* ---------- Minuteur et horloge ---------- */
    function rendreMinuteur() {
      var z = $('[data-minuteur]', racine);
      if (!S.minuteur) { z.hidden = true; return; }
      z.hidden = false;
      tic();
    }
    var dernierBip = 0;
    function tic() {
      var d = new Date(Date.now() + S.decalage);
      var h = $('.ca-aiguille-h', racine), mi = $('.ca-aiguille-m', racine), se = $('.ca-aiguille-s', racine);
      if (h) {
        h.setAttribute('transform', 'rotate(' + ((d.getHours() % 12) * 30 + d.getMinutes() * 0.5) + ')');
        mi.setAttribute('transform', 'rotate(' + (d.getMinutes() * 6) + ')');
        se.setAttribute('transform', 'rotate(' + (d.getSeconds() * 6) + ')');
      }
      if (S.minuteur) {
        var reste = Math.max(0, Math.round((S.minuteur.fin - (Date.now() + S.decalage)) / 1000));
        var z = $('[data-minuteur]', racine);
        z.innerHTML = '<span>⏱ ' + esc(S.minuteur.libelle) + '</span><strong>' + Math.floor(reste / 60) + ':' + deux(reste % 60) + '</strong>' + (jeSuisAnimateur() ? '<button data-arret-minuteur aria-label="Arrêter">✕</button>' : '');
        z.classList.toggle('fini', reste === 0);
        var b = $('[data-arret-minuteur]', z); if (b) b.onclick = function () { agirSilencieux('minuteur', { minutes: 0 }); };
        if (reste === 0 && S.minuteur.fin !== dernierBip) { dernierBip = S.minuteur.fin; sonnerie('fin'); toast('⏰ Temps écoulé : ' + S.minuteur.libelle); }
      }
    }
    var horloge = setInterval(tic, 1000);

    /* ---------- Réactions, bulles, sons ---------- */
    function centreAvatar(pid) {
      var n = elements[pid]; if (!n) return null;
      var r = n.getBoundingClientRect(), z = $('[data-piece]', racine).getBoundingClientRect();
      return { x: r.left - z.left + r.width / 2, y: r.top - z.top };
    }
    function reaction(pid, e) {
      var c = centreAvatar(pid); if (!c) return;
      var f = el('<div class="ca-reaction">' + esc(e) + '</div>');
      f.style.left = c.x + 'px'; f.style.top = c.y + 'px';
      $('[data-flottants]', racine).appendChild(f);
      setTimeout(function () { f.remove(); }, 2400);
      if (e === '👏') sonnerie('bravo');
      if (e === '❓' && jeSuisAnimateur()) {
        var t = Date.now();
        incompris = incompris.filter(function (x) { return t - x.at < 120000 && x.pid !== pid; });
        incompris.push({ pid: pid, at: t });
        clearTimeout(reaction.t);
        reaction.t = setTimeout(function () {
          var n = incompris.length;
          toast('❓ ' + n + ' participant' + (n > 1 ? 's n’ont' : ' n’a') + ' pas compris (deux dernières minutes). Une reformulation, un exemple ?', 'alerte', { bouton: 'Sondage « Avez-vous compris ? »', action: function () { agirSilencieux('sondage_ouvrir', { question: 'Avez-vous compris ?', choix: ['Oui', 'Pas tout', 'Non'] }); ouvrirPanneau('sondage'); } });
        }, 1500);
      }
    }
    var incompris = [];
    function bulle(pid, texte) {
      var c = centreAvatar(pid); if (!c || vueCourante !== 'salle') return;
      var b = el('<div class="ca-bulle">' + esc(texte.length > 60 ? texte.slice(0, 58) + '…' : texte) + '</div>');
      b.style.left = c.x + 'px'; b.style.top = c.y + 'px';
      $('[data-flottants]', racine).appendChild(b);
      setTimeout(function () { b.remove(); }, 4500);
    }
    var ctxSon = null;
    function sonnerie(genre) {
      try {
        ctxSon = ctxSon || new (window.AudioContext || window.webkitAudioContext)();
        var notes = { arrivee: [660], sondage: [523, 659], fin: [784, 659, 523], bravo: [880] }[genre] || [600];
        notes.forEach(function (f, i) {
          var o = ctxSon.createOscillator(), g = ctxSon.createGain(), t0 = ctxSon.currentTime + i * 0.16;
          o.frequency.value = f; o.type = 'sine';
          g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(genre === 'arrivee' ? 0.03 : 0.08, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
          o.connect(g); g.connect(ctxSon.destination); o.start(t0); o.stop(t0 + 0.32);
        });
      } catch (x) { /* pas de son : tant pis */ }
    }

    /* ---------- Notifications ---------- */
    function toast(texte, genre, o) {
      o = o || {};
      var t = el('<div class="ca-toast ' + (genre || '') + '"><span>' + esc(texte) + '</span>' + (o.bouton ? '<button>' + esc(o.bouton) + '</button>' : '') + (o.bouton2 ? '<button class="second">' + esc(o.bouton2) + '</button>' : '') + '</div>');
      $('[data-toasts]', racine).appendChild(t);
      var boutons = $$('button', t);
      if (o.bouton) boutons[0].addEventListener('click', function () { t.remove(); o.action && o.action(); });
      if (o.bouton2) boutons[1].addEventListener('click', function () { t.remove(); o.action2 && o.action2(); });
      setTimeout(function () { t.classList.add('sort'); setTimeout(function () { t.remove(); }, 400); }, o.duree || (o.bouton ? 14000 : 4200));
      return t;
    }

    /* ---------- Le panneau ---------- */
    function ouvrirPanneau(nom) {
      panneau = nom;
      racine.classList.toggle('panneau-ouvert', !!nom);
      $$('[data-onglet]', racine).forEach(function (b) { b.classList.toggle('actif', b.getAttribute('data-onglet') === nom); });
      if (nom === 'discussion') { S.nonLus = 0; majNonLus(); }
      rendreVolet();
      rendreBarre();
    }
    function majNonLus() {
      var b = $('[data-non-lus]', racine); b.hidden = !S.nonLus; b.textContent = S.nonLus;
      var bb = $('[data-b="discussion"] b', racine); if (bb) { bb.hidden = !S.nonLus; bb.textContent = S.nonLus; }
    }
    $$('[data-onglet]', racine).forEach(function (b) { b.addEventListener('click', function () { ouvrirPanneau(b.getAttribute('data-onglet')); }); });
    $('[data-fermer-panneau]', racine).addEventListener('click', function () { ouvrirPanneau(null); });

    function rendreVolet() {
      var v = $('[data-volet]', racine);
      if (!panneau) { v.innerHTML = ''; return; }
      if (panneau === 'discussion') {
        var bas = v.scrollHeight - v.scrollTop - v.clientHeight < 40 || !v.querySelector('.ca-messages');
        v.innerHTML = '<div class="ca-messages">' + (S.chat.length ? S.chat.map(function (m) {
          return '<div class="ca-msg' + (m.pid === MOI ? ' moi' : '') + (m.role === 'animateur' ? ' coach' : '') + '"><b>' + esc(m.role === 'animateur' ? '🧑‍🏫 ' + m.nom : m.nom) + '</b><span>' + esc(m.texte) + '</span><time>' + new Date(m.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '</time></div>';
        }).join('') : '<p class="ca-vide">Écrivez à la classe : une question, un mot, un lien.</p>') + '</div>' +
          '<form class="ca-ecrire"><input name="t" maxlength="500" placeholder="Votre message…" autocomplete="off"><button aria-label="Envoyer">➤</button></form>';
        var msgs = $('.ca-messages', v); if (bas) msgs.scrollTop = msgs.scrollHeight;
        var f = $('form', v);
        f.addEventListener('submit', function (ev) { ev.preventDefault(); var t = f.elements.t.value.trim(); if (!t) return; f.elements.t.value = ''; agirSilencieux('chat', { texte: t }); });
        if (!etroit()) f.elements.t.focus({ preventScroll: true });
      } else if (panneau === 'participants') {
        v.innerHTML = voletParticipants();
        brancherVoletParticipants(v);
      } else if (panneau === 'sondage') {
        v.innerHTML = voletSondage();
        brancherVoletSondage(v);
      }
    }

    function voletParticipants() {
      var liste = Object.keys(S.participants).map(function (k) { return S.participants[k]; }).filter(function (p) { return p.en_ligne; });
      var mains = liste.filter(function (p) { return p.main; }).sort(function (a, b) { return a.main - b.main; });
      var anim = jeSuisAnimateur();
      var html = '';
      if (anim) {
        html += '<div class="ca-commandes"><button data-cmd="muet_tous">🔇 Couper les micros</button><button data-cmd="mains_baisser">✋ Baisser les mains</button>' +
          '<label class="ca-interrupteur"><input type="checkbox" data-reg="micros_libres"' + (S.micros_libres ? ' checked' : '') + '><span>Micros libres</span></label>' +
          '<label class="ca-interrupteur"><input type="checkbox" data-reg="places_verrouillees"' + (S.places_verrouillees ? ' checked' : '') + '><span>Figer les places</span></label>' +
          '<label class="ca-interrupteur"><input type="checkbox" data-reg="cameras_apprenants"' + (S.cameras_apprenants ? ' checked' : '') + '><span>Caméras des apprenants</span></label></div>' +
          '<div class="ca-commandes ca-modes"><span>Toute la classe en mode :</span><button data-mode="salle"' + (S.vue === 'salle' ? ' class="actif"' : '') + '>🏫 Salle</button><button data-mode="visio"' + (S.vue === 'visio' ? ' class="actif"' : '') + '>🎥 Visio</button></div>' +
          (S.ecran.length ? '<p class="ca-aide">À l’écran de toute la classe : ' + S.ecran.map(function (x) { return esc((participant(x) || {}).nom || '?'); }).join(', ') + '. En mode visio, touchez une vignette pour épingler un apprenant.</p>' : '<p class="ca-aide">En mode visio, touchez la vignette d’un apprenant qui a ouvert sa caméra pour la montrer à toute la classe.</p>');
      }
      if (mains.length) {
        html += '<h4>✋ Mains levées</h4><ol class="ca-file">' + mains.map(function (p) {
          return '<li><span>' + esc(p.nom) + '</span>' + (anim ? '<button data-parole="' + esc(p.pid) + '">Donner la parole</button>' : '') + '</li>';
        }).join('') + '</ol>';
      }
      html += '<h4>Dans la classe (' + liste.length + ')</h4><ul class="ca-liste">' + liste.sort(function (a, b) { return (b.pid === S.animateur) - (a.pid === S.animateur) || String(a.nom).localeCompare(b.nom); }).map(function (p) {
        var q = Media.qualite(p.pid);
        return '<li><span class="ca-mini-av">' + avatarSvg(p.avatar) + '</span><span class="ca-li-nom">' + esc(p.nom) + (p.pid === S.animateur ? ' <em>coach</em>' : p.role === 'observateur' ? ' <em>visiteur</em>' : '') + '</span>' +
          '<span class="ca-li-etat">' + (p.main ? '✋' : '') + (p.micro ? '🎙️' : '') + (p.faible ? '🐢' : '') + (q ? '<i class="ca-q ' + q + '" title="Connexion ' + q + '"></i>' : '') + '</span>' +
          (anim && p.pid !== MOI && p.role === 'apprenant' ? '<button data-' + (p.parole ? 'retirer' : 'parole') + '="' + esc(p.pid) + '">' + (p.parole ? 'Reprendre' : 'Parole') + '</button>' : '') + '</li>';
      }).join('') + '</ul>';
      if (anim && P.inscrits) {
        var absents = P.inscrits.filter(function (a) { return !(S.participants[a.pid] && S.participants[a.pid].en_ligne); });
        if (absents.length) html += '<h4>Pas encore arrivés (' + absents.length + ')</h4><p class="ca-absents">' + absents.map(function (a) { return esc(a.nom); }).join(' · ') + '</p>';
      }
      return html;
    }
    function brancherVoletParticipants(v) {
      $$('[data-cmd]', v).forEach(function (b) { b.addEventListener('click', function () { agirSilencieux(b.getAttribute('data-cmd')); }); });
      $$('[data-mode]', v).forEach(function (b) { b.addEventListener('click', function () { agirSilencieux('vue', { vue: b.getAttribute('data-mode') }); }); });
      $$('[data-reg]', v).forEach(function (c) { c.addEventListener('change', function () { var o = {}; o[c.getAttribute('data-reg')] = c.checked; agirSilencieux('reglages', o); }); });
      $$('[data-parole]', v).forEach(function (b) { b.addEventListener('click', function () { agirSilencieux('parole', { pid: b.getAttribute('data-parole'), donner: true }); }); });
      $$('[data-retirer]', v).forEach(function (b) { b.addEventListener('click', function () { agirSilencieux('parole', { pid: b.getAttribute('data-retirer'), donner: false }); }); });
    }

    function ficheParticipant(pid) {
      var p = participant(pid); if (!p) return;
      ouvrirPanneau('participants');
      toast(p.nom + (p.main ? ' lève la main.' : '.'), '', p.role === 'apprenant' ? { bouton: p.parole ? 'Reprendre la parole' : 'Donner la parole', action: function () { agirSilencieux('parole', { pid: pid, donner: !p.parole }); } } : {});
    }

    function voletSondage() {
      var q = S.sondage, anim = jeSuisAnimateur();
      if (!q) {
        return anim ? '<p class="ca-vide">Posez une question à toute la classe : chacun répond, puis lève son carton quand vous révélez.</p>' +
          '<div class="ca-rapides"><button data-rapide="vf">Vrai / Faux</button><button data-rapide="abcd">A · B · C · D</button><button data-rapide="oui">Oui / Non / Je ne sais pas</button></div>' +
          '<form class="ca-form-sondage"><label>Question<input name="q" maxlength="200" placeholder="ex. Quel est le passé de « go » ?"></label>' +
          [0, 1, 2, 3].map(function (i) { return '<label class="ca-choix-l"><span>' + String.fromCharCode(65 + i) + '</span><input name="c' + i + '" maxlength="80" placeholder="Réponse ' + String.fromCharCode(65 + i) + (i > 1 ? ' (facultatif)' : '') + '"><input type="radio" name="bonne" value="' + i + '" title="Bonne réponse"></label>'; }).join('') +
          '<p class="ca-aide">Cochez la bonne réponse (facultatif) : elle compte dans la participation.</p><button class="ca-principal">Lancer le sondage</button></form>'
          : '<p class="ca-vide">Aucun sondage pour l’instant. Quand le coach en lance un, il apparaît ici.</p>';
      }
      var compte = q.compte || [];
      var total = q.total || 0;
      var html = '<div class="ca-question">' + esc(q.question) + '</div><div class="ca-reponses">' + q.choix.map(function (c, i) {
        var n = compte[i] || 0, pc = total ? Math.round(n / total * 100) : 0;
        var juste = q.revele && q.bonne === i;
        return '<button class="ca-rep c' + i + (q.ma_reponse === i ? ' choisie' : '') + (juste ? ' juste' : '') + '" data-rep="' + i + '"' + (!q.ouvert || anim ? ' disabled' : '') + '>' +
          '<b>' + String.fromCharCode(65 + i) + '</b><span>' + esc(c) + '</span>' + (q.compte ? '<em>' + n + ' · ' + pc + ' %</em><i style="width:' + pc + '%"></i>' : '') + (juste ? '<strong>✓</strong>' : '') + '</button>';
      }).join('') + '</div><p class="ca-aide">' + total + ' réponse' + (total > 1 ? 's' : '') + (q.ouvert ? (anim ? ' — en direct' : (q.ma_reponse !== null && q.ma_reponse !== undefined ? ' — vous pouvez changer d’avis jusqu’à la révélation' : '')) : ' — résultats révélés') + '</p>';
      if (anim) html += '<div class="ca-commandes">' + (q.ouvert ? '<button class="ca-principal" data-reveler>Révéler : tout le monde lève son carton</button>' : '') + '<button data-fermer-sondage>' + (q.ouvert ? 'Annuler' : 'Nouveau sondage') + '</button></div>';
      return html;
    }
    function brancherVoletSondage(v) {
      $$('[data-rep]', v).forEach(function (b) { b.addEventListener('click', function () { agirSilencieux('sondage_reponse', { choix: Number(b.getAttribute('data-rep')) }); }); });
      var rv = $('[data-reveler]', v); if (rv) rv.addEventListener('click', function () { agirSilencieux('sondage_reveler'); });
      var fs = $('[data-fermer-sondage]', v); if (fs) fs.addEventListener('click', function () { agirSilencieux('sondage_fermer'); });
      $$('[data-rapide]', v).forEach(function (b) {
        b.addEventListener('click', function () {
          var r = b.getAttribute('data-rapide');
          var q = $('form [name=q]', v).value.trim();
          agirSilencieux('sondage_ouvrir', r === 'vf' ? { question: q || 'Vrai ou faux ?', choix: ['Vrai', 'Faux'] } : r === 'oui' ? { question: q || 'Avez-vous compris ?', choix: ['Oui', 'Non', 'Je ne sais pas'] } : { question: q || 'Votre réponse ?', choix: [] });
        });
      });
      var f = $('.ca-form-sondage', v);
      if (f) f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var choix = [0, 1, 2, 3].map(function (i) { return f.elements['c' + i].value.trim(); });
        var bonneBrute = (f.querySelector('input[name=bonne]:checked') || {}).value;
        var gardes = []; var bonne = null;
        choix.forEach(function (c, i) { if (c) { if (String(i) === bonneBrute) bonne = gardes.length; gardes.push(c); } });
        if (gardes.length && gardes.length < 2) { toast('Donnez au moins deux réponses, ou utilisez un sondage rapide.'); return; }
        agirSilencieux('sondage_ouvrir', { question: f.elements.q.value, choix: gardes, bonne: bonne });
      });
    }

    /* ---------- La barre d'outils ---------- */
    function bouton(cle, icone, libelle, o) {
      o = o || {};
      return '<button class="ca-b' + (o.actif ? ' actif' : '') + (o.alerte ? ' alerte' : '') + (o.classe ? ' ' + o.classe : '') + '" data-b="' + cle + '"' + (o.titre ? ' title="' + esc(o.titre) + '"' : '') + (o.desactive ? ' disabled' : '') + '><span>' + icone + '</span><small>' + esc(libelle) + '</small>' + (o.pastille ? '<b' + (o.pastille === '0' ? ' hidden' : '') + '>' + esc(o.pastille) + '</b>' : '') + '</button>';
    }
    function rendreBarre() {
      var b = $('[data-barre]', racine), m = moi(), anim = jeSuisAnimateur();
      var peutParler = anim || m.role !== 'apprenant' || S.micros_libres || m.parole;
      var html = bouton('micro', Media.micActif() ? '🎙️' : (peutParler ? '🎤' : '🔒'), Media.micActif() ? 'Micro ouvert' : 'Micro', { actif: Media.micActif(), titre: peutParler ? 'Ouvrir / fermer votre micro' : 'Levez la main : le coach vous donnera la parole' });
      if (anim) {
        html += bouton('camera', '📷', 'Caméra', { actif: S.scene === 'video' && Media.videoDisponible() }) + bouton('ecran', '🖥', 'Écran', { actif: S.scene === 'ecran' }) +
          bouton('craie', '✏️', 'Tableau', { actif: outil.actif }) + bouton('sondage', '📊', 'Sondage', { actif: panneau === 'sondage' }) + bouton('minuteur', '⏱', 'Minuteur', { actif: !!S.minuteur }) +
          bouton('enregistrer', Media.enregistre() ? '⏺' : '⏺', Media.enregistre() ? 'Arrêter' : 'Enregistrer', { actif: Media.enregistre(), classe: Media.enregistre() ? 'rec' : '' });
      } else {
        if (S.cameras_apprenants) html += bouton('camera_moi', Media.cameraActive() ? '📷' : '📷', Media.cameraActive() ? 'Caméra ouverte' : 'Caméra', { actif: Media.cameraActive(), desactive: !!m.faible, titre: m.faible ? 'Indisponible en mode connexion faible' : 'Ouvrir votre caméra (le coach vous voit ; il peut vous mettre à l’écran de toute la classe)' });
        html += bouton('main', '✋', m.main ? 'Baisser' : 'Lever la main', { actif: !!m.main }) + bouton('reactions', '😀', 'Réagir') +
          bouton('compris', '❓', 'Pas compris', { titre: 'Signaler au coach que vous n’avez pas compris' });
      }
      html += bouton('discussion', '💬', 'Discussion', { actif: panneau === 'discussion', pastille: String(S.nonLus || 0) }) + bouton('participants', '👥', 'Classe', { actif: panneau === 'participants' }) +
        bouton('faible', moi().faible ? '🐢' : '📶', moi().faible ? 'Connexion faible' : 'Connexion', { actif: !!moi().faible, titre: 'Mode connexion faible : le son et le tableau, sans l’image' });
      if (!anim) html += bouton('avatar', '🎨', 'Avatar');
      if (anim) html += bouton('terminer', '🏁', 'Terminer', { classe: 'fin' });
      b.innerHTML = html;
      $$('[data-b]', b).forEach(function (x) { x.addEventListener('click', function () { actionBarre(x.getAttribute('data-b'), x); }); });
      majNonLus();
    }

    function actionBarre(cle, btn) {
      var m = moi();
      switch (cle) {
        case 'micro': Media.basculerMicro(!Media.micActif()); break;
        case 'main': agirSilencieux('main', { levee: !m.main }); break;
        case 'reactions': menuReactions(btn); break;
        case 'compris': agirSilencieux('reaction', { e: '❓' }); toast('Le coach voit que vous n’avez pas compris. Vous pouvez aussi lever la main.'); break;
        case 'discussion': case 'participants': case 'sondage': ouvrirPanneau(panneau === cle && etroit() ? null : cle); break;
        case 'faible': Media.modeFaible(!m.faible); break;
        case 'avatar': choisirAvatar(false); break;
        case 'camera': Media.camera(); break;
        case 'camera_moi': Media.basculerCamera(!Media.cameraActive()); break;
        case 'ecran': Media.ecran(); break;
        case 'craie':
          outil.actif = !outil.actif;
          if (outil.actif) { if (S.scene === 'attente') agirSilencieux('scene', { scene: 'tableau' }); voirVue('tableau'); }
          rendreTableau(); rendreBarre();
          break;
        case 'minuteur': {
          if (S.minuteur) { agirSilencieux('minuteur', { minutes: 0 }); break; }
          var mn = window.prompt('Durée de l’exercice, en minutes :', '5');
          if (mn === null) break;
          var lib = window.prompt('Nom de l’exercice :', 'Exercice') || 'Exercice';
          agirSilencieux('minuteur', { minutes: Number(String(mn).replace(',', '.')) || 5, libelle: lib });
          break;
        }
        case 'enregistrer': Media.enregistrer(); break;
        case 'terminer':
          if (window.confirm('Terminer le cours pour tout le monde ? La participation de chacun est enregistrée.')) agir('terminer').catch(function (e) { toast(e.message, 'alerte'); });
          break;
        default: break;
      }
    }

    function menuReactions(btn) {
      var ancien = $('.ca-menu-reactions', racine); if (ancien) { ancien.remove(); return; }
      var menu = el('<div class="ca-menu-reactions">' + REACTIONS.map(function (r) { return '<button>' + r + '</button>'; }).join('') + '</div>');
      racine.appendChild(menu);
      var r = btn.getBoundingClientRect();
      menu.style.left = Math.max(8, Math.min(window.innerWidth - 260, r.left - 90)) + 'px';
      menu.style.bottom = (window.innerHeight - r.top + 8) + 'px';
      $$('button', menu).forEach(function (b) { b.addEventListener('click', function () { agirSilencieux('reaction', { e: b.textContent }); menu.remove(); }); });
      setTimeout(function () { document.addEventListener('click', function f(ev) { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', f); } }); }, 0);
    }

    /* ---------- Vues ---------- */
    function voirVue(v) {
      vueCourante = v;
      racine.setAttribute('data-vue', v);
      $$('[data-vue]', racine).forEach(function (b) { b.classList.toggle('actif', b.getAttribute('data-vue') === v); });
      rendreVisio();
      setTimeout(redimensionnerCraie, 50);
    }
    $$('.ca-vues [data-vue]', racine).forEach(function (b) { b.addEventListener('click', function () { voirVue(b.getAttribute('data-vue')); }); });
    $('[data-agrandir]', racine).addEventListener('click', function () { voirVue(vueCourante === 'tableau' ? 'salle' : 'tableau'); });
    window.addEventListener('resize', redimensionnerCraie);

    $('[data-scene]', racine).addEventListener('click', function (ev) {
      var b = ev.target.closest('.ca-place');
      if (!b || !b.classList.contains('libre')) return;
      agir('place', { place: Number(b.getAttribute('data-place')) }).then(function () { sonnerie('arrivee'); }).catch(function (e) { toast(e.message, 'alerte'); });
    });

    function redessinerTout() {
      dessinerBancs();
      rendreScene(); rendreTableau(); rendreTexteTableau(); redessinerCraie(); rendreMinuteur(); rendreBarre(); rendreVolet();
    }

    function marquerReseau(q) {
      var z = $('[data-reseau]', racine);
      z.className = 'ca-etat-reseau ' + q;
      $('span', z).textContent = { bonne: 'Bonne connexion', moyenne: 'Connexion moyenne', faible: 'Connexion faible', coupe: 'Reconnexion…' }[q] || 'Connexion…';
    }

    /* =================================================================
       LE SON ET L'IMAGE — WebRTC en étoile autour de l'animateur
       ================================================================= */
    var Media = (function () {
      var ctx = null, micFlux = null, micPiste = null, micGain = null, micAnalyse = null, micOuvert = false;
      var videoPiste = null, camFlux = null, ecranFlux = null;
      var liens = {};           // animateur : pid → { pc, dest, tv, ta, entree, analyse, audio, facteur, faible, qualite }
      var pc = null, enAttenteIce = [], dernierPret = 0, essaisPret = 0, connecteUneFois = false;
      var fluxRecu = null, enregistreur = null, morceaux = [];
      var qualiteMoi = null, mauvais = 0, bons = 0, refusFaibleJusqua = 0, precedent = {};
      var parleursLocaux = [];
      var NB_ECRAN = 4;          // emplacements vidéo relayés par l'animateur (= MAX_ECRAN côté serveur)
      var camFluxMoi = null, camPisteMoi = null, slotsRecus = [];

      function audioCtx() {
        if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); micGain = ctx.createGain(); micGain.gain.value = 0; micAnalyse = ctx.createAnalyser(); micAnalyse.fftSize = 512; micGain.connect(micAnalyse); }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
      }

      function assurerMicro() {
        if (micPiste && micPiste.readyState === 'live') return Promise.resolve(micPiste);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject(new Error('Ce navigateur ne permet pas d’utiliser le micro.'));
        return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }).then(function (f) {
          micFlux = f; micPiste = f.getAudioTracks()[0];
          if (jeSuisAnimateur()) { audioCtx(); ctx.createMediaStreamSource(f).connect(micGain); }
          return micPiste;
        });
      }

      function micActif() { return micOuvert; }

      /** Ouvre ou ferme le micro (et le dit à la classe). */
      function basculerMicro(ouvrirMic, o) {
        o = o || {};
        var m = moi();
        if (ouvrirMic && !jeSuisAnimateur() && m.role === 'apprenant' && !S.micros_libres && !m.parole) {
          if (!o.silencieux) toast('Levez la main : le coach vous donnera la parole.', '', { bouton: 'Lever la main', action: function () { agirSilencieux('main', { levee: true }); } });
          return Promise.resolve();
        }
        if (!ouvrirMic) return couperMicro(false);
        return assurerMicro().then(function (piste) {
          micOuvert = true;
          if (jeSuisAnimateur()) { micGain.gain.value = 1; }
          else if (pc) { var t = transceiverAudio(); if (t) t.sender.replaceTrack(piste); }
          rendreBarre();
          return agir('micro', { actif: true });
        }).catch(function (e) {
          micOuvert = false;
          if (!jeSuisAnimateur() && pc) { var t = transceiverAudio(); if (t) t.sender.replaceTrack(null); }
          rendreBarre();
          if (!o.silencieux) toast(e && e.name === 'NotAllowedError' ? 'Autorisez le micro dans votre navigateur (icône à gauche de l’adresse).' : (e.message || 'Micro indisponible.'), 'alerte');
        });
      }

      function couperMicro(silencieux) {
        var etait = micOuvert;
        micOuvert = false;
        if (micGain) micGain.gain.value = 0;
        if (pc) { var t = transceiverAudio(); if (t) t.sender.replaceTrack(null); }
        rendreBarre();
        if (etait && !silencieux) return agir('micro', { actif: false }).catch(function () {});
        if (etait && silencieux) agirSilencieux('micro', { actif: false });
        return Promise.resolve();
      }

      function transceiverAudio() {
        if (!pc) return null;
        return pc.getTransceivers().filter(function (t) { return t.receiver && t.receiver.track && t.receiver.track.kind === 'audio'; })[0] || null;
      }

      function videoDisponible() { return jeSuisAnimateur() ? !!videoPiste : !!(fluxRecu && fluxRecu.getVideoTracks().some(function (t) { return t.readyState === 'live' && !t.muted; })); }

      /* ----- Animateur ----- */
      function signaler(a, donnees) { return agir('signal', { a: a, donnees: donnees }).catch(function () {}); }

      function lienPour(pid) {
        fermerLien(pid);
        audioCtx();
        var p = new RTCPeerConnection({ iceServers: P.ice, bundlePolicy: 'max-bundle' });
        var dest = ctx.createMediaStreamDestination();
        micGain.connect(dest);
        var flux = new MediaStream();
        var tv = p.addTransceiver('video', { direction: 'sendonly', streams: [flux] });
        var ta = p.addTransceiver(dest.stream.getAudioTracks()[0], { direction: 'sendrecv', streams: [flux] });
        // Mode visio : quatre emplacements où l'animateur relaie la vidéo d'autres
        // apprenants, puis la caméra de CET apprenant, qui ne va qu'à l'animateur.
        var slots = [];
        for (var k = 0; k < NB_ECRAN; k += 1) slots.push(p.addTransceiver('video', { direction: 'sendonly' }));
        var tcam = p.addTransceiver('video', { direction: 'recvonly' });
        var l = { pid: pid, pc: p, dest: dest, tv: tv, ta: ta, slots: slots, tcam: tcam, cam: null, entree: null, analyse: null, audio: null, facteur: 1, faible: !!(participant(pid) || {}).faible, qualite: null, prec: {} };
        liens[pid] = l;
        if (videoPiste && !l.faible) tv.sender.replaceTrack(videoPiste);
        majEcranPour(l);
        p.onicecandidate = function (ev) { if (ev.candidate) signaler(pid, { cand: ev.candidate }); };
        p.ontrack = function (ev) {
          if (ev.track.kind === 'audio') { brancherVoix(l, ev.streams[0] || new MediaStream([ev.track])); return; }
          if (ev.transceiver === tcam) {
            l.cam = new MediaStream([ev.track]);
            ev.track.onunmute = ev.track.onmute = function () { majEcran(); rendreVisio(); };
            majEcran(); rendreVisio();
          }
        };
        p.onconnectionstatechange = function () {
          if (p.connectionState === 'connected') { appliquerDebits(); rendrePanneauSiBesoin(); }
          if (p.connectionState === 'failed') redemarrer(l);
        };
        p.createOffer().then(function (o) { return p.setLocalDescription(o); }).then(function () { signaler(pid, { sdp: p.localDescription }); }).catch(function () {});
        return l;
      }

      function redemarrer(l) {
        try {
          l.pc.createOffer({ iceRestart: true }).then(function (o) { return l.pc.setLocalDescription(o); }).then(function () { signaler(l.pid, { sdp: l.pc.localDescription, restart: true }); }).catch(function () {});
        } catch (x) { /* rien */ }
      }

      function brancherVoix(l, flux) {
        if (l.audio) { l.audio.srcObject = null; }
        l.audio = new Audio(); l.audio.autoplay = true; l.audio.srcObject = flux;
        l.audio.play().catch(function () {});
        try { if (l.entree) l.entree.disconnect(); } catch (x) { /* rien */ }
        var src = ctx.createMediaStreamSource(flux);
        l.entree = ctx.createGain(); src.connect(l.entree);
        l.analyse = ctx.createAnalyser(); l.analyse.fftSize = 512; l.entree.connect(l.analyse);
        reconstruireMelange();
      }

      /**
       * Chaque apprenant reçoit : la voix du coach + celle des AUTRES apprenants
       * dont le micro est ouvert. Jamais sa propre voix (pas d'écho).
       */
      function reconstruireMelange() {
        Object.keys(liens).forEach(function (pid) {
          var l = liens[pid];
          if (!l.entree) return;
          try { l.entree.disconnect(); } catch (x) { /* rien */ }
          l.entree.connect(l.analyse);
          var p = participant(pid);
          if (!p || !p.micro) return;
          Object.keys(liens).forEach(function (autre) { if (autre !== pid) l.entree.connect(liens[autre].dest); });
          if (enregistreur && enregistreur._dest) l.entree.connect(enregistreur._dest);
        });
      }

      function fermerLien(pid) {
        var l = liens[pid]; if (!l) return;
        try { l.pc.close(); } catch (x) { /* rien */ }
        try { if (l.entree) l.entree.disconnect(); } catch (x) { /* rien */ }
        try { micGain.disconnect(l.dest); } catch (x) { /* rien */ }
        if (l.audio) l.audio.srcObject = null;
        delete liens[pid];
        reconstruireMelange();
      }

      function definirVideo(piste, scene) {
        videoPiste = piste || null;
        Object.keys(liens).forEach(function (pid) { var l = liens[pid]; l.tv.sender.replaceTrack(l.faible ? null : videoPiste).catch(function () {}); });
        if (videoPiste) { video.srcObject = new MediaStream([videoPiste]); video.play().catch(function () {}); } else video.srcObject = null;
        appliquerDebits();
        agirSilencieux('scene', { scene: scene || (videoPiste ? 'video' : (outil.actif ? 'tableau' : 'attente')) });
        rendreBarre();
      }

      function camera() {
        if (camFlux) { camFlux.getTracks().forEach(function (t) { t.stop(); }); camFlux = null; definirVideo(null); return; }
        navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24, max: 30 } } }).then(function (f) {
          if (ecranFlux) { ecranFlux.getTracks().forEach(function (t) { t.stop(); }); ecranFlux = null; }
          camFlux = f; var t = f.getVideoTracks()[0]; t.contentHint = 'motion';
          definirVideo(t, 'video');
        }).catch(function (e) { toast(e && e.name === 'NotAllowedError' ? 'Autorisez la caméra dans votre navigateur.' : 'Caméra indisponible.', 'alerte'); });
      }

      function ecran() {
        if (ecranFlux) { ecranFlux.getTracks().forEach(function (t) { t.stop(); }); ecranFlux = null; definirVideo(camFlux ? camFlux.getVideoTracks()[0] : null); return; }
        if (!navigator.mediaDevices.getDisplayMedia) { toast('Le partage d’écran se fait depuis un ordinateur.', 'alerte'); return; }
        navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 8, max: 12 } }, audio: false }).then(function (f) {
          ecranFlux = f; var t = f.getVideoTracks()[0]; t.contentHint = 'detail';
          t.addEventListener('ended', function () { ecranFlux = null; definirVideo(camFlux ? camFlux.getVideoTracks()[0] : null); });
          definirVideo(t, 'ecran');
        }).catch(function () {});
      }

      /** Répartit le débit vidéo entre les apprenants, selon leur qualité mesurée. */
      function appliquerDebits() {
        var actifs = Object.keys(liens).filter(function (pid) { return !liens[pid].faible; });
        var part = borne(((P.salle && P.salle.debit) || 2500) * 1000 / Math.max(1, actifs.length), 90000, 900000);
        Object.keys(liens).forEach(function (pid) {
          var l = liens[pid], s = l.tv.sender;
          if (!s.getParameters) return;
          var prm = s.getParameters();
          if (!prm.encodings || !prm.encodings.length) prm.encodings = [{}];
          var nbRelais = l.slots ? l.slots.filter(function (t) { return t._piste; }).length : 0;
          var debit = Math.round(borne(part * l.facteur - nbRelais * 110000, 60000, 900000));
          prm.encodings[0].active = !l.faible && !!videoPiste;
          prm.encodings[0].maxBitrate = debit;
          prm.encodings[0].scaleResolutionDownBy = S.scene === 'ecran' ? 1 : debit > 500000 ? 1 : debit > 260000 ? 1.5 : debit > 150000 ? 2 : 3;
          prm.encodings[0].maxFramerate = S.scene === 'ecran' ? 8 : debit < 150000 ? 15 : 24;
          s.setParameters(prm).catch(function () {});
        });
      }

      /* ----- Mode visio : qui est à l'écran de toute la classe ----- */
      function partParApprenant() {
        var actifs = Object.keys(liens).filter(function (pid) { return !liens[pid].faible; });
        return ((P.salle && P.salle.debit) || 2500) * 1000 / Math.max(1, actifs.length);
      }
      function pisteCam(pid) {
        var l = liens[pid];
        var t = l && l.cam && l.cam.getVideoTracks()[0];
        return t && t.readyState === 'live' && (participant(pid) || {}).camera ? t : null;
      }
      /** Animateur : choisit les vidéos relayées, autant que le débit le permet. */
      function choisirEcran(force) {
        if (!jeSuisAnimateur()) return;
        var part = partParApprenant();
        var nb = part >= 600000 ? 4 : part >= 420000 ? 2 : part >= 260000 ? 1 : 0;
        var avecCam = Object.keys(liens).filter(function (pid) { return pisteCam(pid); });
        var choix = [];
        function ajouter(pid) { if (choix.length < nb && choix.indexOf(pid) < 0 && avecCam.indexOf(pid) >= 0) choix.push(pid); }
        epingles.forEach(ajouter);
        avecCam.filter(function (pid) { return (participant(pid) || {}).parole; }).forEach(ajouter);
        avecCam.filter(function (pid) { return dernierFort[pid] && Date.now() - dernierFort[pid] < 20000; })
          .sort(function (a, b) { return dernierFort[b] - dernierFort[a]; }).forEach(ajouter);
        if (vueCourante === 'visio' || S.vue === 'visio') S.ecran.concat(avecCam).forEach(ajouter);
        if (force || choix.join() !== S.ecran.join()) {
          if (choix.join() !== S.ecran.join()) agir('ecran', { pids: choix }).catch(function () {});
        }
      }
      function majEcranPour(l) {
        if (!l.slots) return;
        l.slots.forEach(function (t, k) {
          var pid = S.ecran[k];
          var piste = !l.faible && pid && pid !== l.pid ? pisteCam(pid) : null;
          if (t._piste === piste) return;
          t._piste = piste;
          t.sender.replaceTrack(piste).catch(function () {});
          if (t.sender.getParameters) {
            var prm = t.sender.getParameters();
            if (!prm.encodings || !prm.encodings.length) prm.encodings = [{}];
            prm.encodings[0].active = !!piste; prm.encodings[0].maxBitrate = 110000; prm.encodings[0].maxFramerate = 15;
            t.sender.setParameters(prm).catch(function () {});
          }
        });
      }
      function majEcran() { Object.keys(liens).forEach(function (pid) { majEcranPour(liens[pid]); }); appliquerDebits(); }

      /* ----- Caméra de l'apprenant (mode visio) ----- */
      function cameraActive() { return !!(camPisteMoi && camPisteMoi.readyState === 'live'); }
      function transceiverCam() {
        if (!pc) return null;
        var tr = pc.getTransceivers();
        return tr.length > 2 + NB_ECRAN ? tr[tr.length - 1] : null;
      }
      function brancherCamMoi() {
        var t = transceiverCam(); if (!t) return;
        t.sender.replaceTrack(cameraActive() ? camPisteMoi : null).catch(function () {});
        if (t.sender.getParameters) {
          var prm = t.sender.getParameters();
          if (!prm.encodings || !prm.encodings.length) prm.encodings = [{}];
          prm.encodings[0].maxBitrate = 150000; prm.encodings[0].maxFramerate = 15;
          t.sender.setParameters(prm).catch(function () {});
        }
      }
      function basculerCamera(ouvrirCam) {
        if (!ouvrirCam) return couperCamera(false);
        if (moi().faible) { toast('La caméra est coupée en mode connexion faible.'); return Promise.resolve(); }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('Ce navigateur ne permet pas d’utiliser la caméra.', 'alerte'); return Promise.resolve(); }
        return navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 15 }, facingMode: 'user' } }).then(function (f) {
          camFluxMoi = f; camPisteMoi = f.getVideoTracks()[0];
          brancherCamMoi();
          return agir('camera', { actif: true });
        }).then(function () {
          rendreBarre(); rendreVisio();
          if (vueCourante !== 'visio') toast('📷 Caméra ouverte. Passez en mode Visio pour voir les vignettes.', '', { bouton: 'Mode visio', action: function () { voirVue('visio'); } });
        }).catch(function (e) {
          couperCamera(true);
          toast(e && e.name === 'NotAllowedError' ? 'Autorisez la caméra dans votre navigateur.' : (e && e.message) || 'Caméra indisponible.', 'alerte');
        });
      }
      function couperCamera(silencieux) {
        var etait = cameraActive();
        if (camFluxMoi) camFluxMoi.getTracks().forEach(function (t) { t.stop(); });
        camFluxMoi = null; camPisteMoi = null;
        brancherCamMoi();
        rendreBarre(); rendreVisio();
        if (etait) agirSilencieux('camera', { actif: false });
        return Promise.resolve();
      }

      /** Le flux à montrer dans la vignette d'un participant (ou null : son avatar). */
      function fluxDe(pid) {
        if (pid === MOI) return cameraActive() ? camFluxMoi : null;
        if (pid === S.animateur) return null; // il est en grand, au tableau
        if (jeSuisAnimateur()) { var t = pisteCam(pid); return t ? liens[pid].cam : null; }
        var k = S.ecran.indexOf(pid);
        var f = k >= 0 ? slotsRecus[k] : null;
        var piste = f && f.getVideoTracks()[0];
        return piste && piste.readyState === 'live' && !piste.muted ? f : null;
      }

      /* ----- Apprenant (et visiteur) ----- */
      function demanderLien() {
        if (!S.animateur || jeSuisAnimateur()) return;
        if (Date.now() - dernierPret < 4000) return;
        dernierPret = Date.now(); essaisPret += 1;
        signaler(S.animateur, { pret: true, faible: !!moi().faible });
        clearTimeout(demanderLien.t);
        demanderLien.t = setTimeout(function () {
          if (pc && pc.connectionState === 'connected') return;
          if (essaisPret < 4) { dernierPret = 0; demanderLien(); return; }
          if (!demanderLien.prevenu) {
            demanderLien.prevenu = true;
            toast('Le son et l’image n’arrivent pas à passer sur ce réseau. La classe continue : tableau, discussion, sondages.', 'alerte',
              P.secours && P.secours.url ? { bouton: 'Visio de secours', action: function () { window.open(P.secours.url_leger || P.secours.url, '_blank', 'noopener'); }, bouton2: 'Réessayer', action2: function () { essaisPret = 0; dernierPret = 0; demanderLien(); }, duree: 30000 } : { bouton: 'Réessayer', action: function () { essaisPret = 0; dernierPret = 0; demanderLien(); } });
          }
        }, 9000);
      }

      function nouveauPc() {
        if (pc) { try { pc.close(); } catch (x) { /* rien */ } }
        enAttenteIce = [];
        pc = new RTCPeerConnection({ iceServers: P.ice, bundlePolicy: 'max-bundle' });
        pc.onicecandidate = function (ev) { if (ev.candidate && S.animateur) signaler(S.animateur, { cand: ev.candidate }); };
        pc.ontrack = function (ev) {
          var idx = pc.getTransceivers().indexOf(ev.transceiver);
          if (idx >= 2 && idx < 2 + NB_ECRAN) {
            // Un emplacement « à l'écran » : la vidéo d'un autre apprenant, relayée par le coach.
            slotsRecus[idx - 2] = new MediaStream([ev.track]);
            ev.track.onunmute = ev.track.onmute = function () { rendreVisio(); };
            rendreVisio();
            return;
          }
          if (idx >= 2 + NB_ECRAN) return;
          fluxRecu = ev.streams[0] || fluxRecu || new MediaStream();
          if (!ev.streams[0]) fluxRecu.addTrack(ev.track);
          if (ev.track.kind === 'video') {
            video.srcObject = fluxRecu; video.muted = true; video.play().catch(function () {});
            ev.track.onunmute = ev.track.onmute = function () { rendreTableau(); };
          } else { son.srcObject = fluxRecu; son.play().catch(function () { toast('Touchez l’écran pour entendre le cours.', '', { bouton: 'Activer le son', action: function () { son.play(); } }); }); }
          rendreTableau();
        };
        pc.onconnectionstatechange = function () {
          if (pc.connectionState === 'connected') { connecteUneFois = true; essaisPret = 0; demanderLien.prevenu = false; marquerReseau('bonne'); }
          if (pc.connectionState === 'failed') { dernierPret = 0; demanderLien(); }
        };
        return pc;
      }

      function surSignal(de, d) {
        if (!d) return;
        if (jeSuisAnimateur()) {
          if (d.pret) { var l = lienPour(de); l.faible = !!d.faible; return; }
          var lien = liens[de]; if (!lien) return;
          if (d.sdp && d.sdp.type === 'answer') lien.pc.setRemoteDescription(d.sdp).then(function () { (lien.ice || []).forEach(function (c) { lien.pc.addIceCandidate(c).catch(function () {}); }); lien.ice = []; }).catch(function () {});
          else if (d.cand) { if (lien.pc.remoteDescription) lien.pc.addIceCandidate(d.cand).catch(function () {}); else (lien.ice = lien.ice || []).push(d.cand); }
          return;
        }
        if (de !== S.animateur) return;
        if (d.sdp && d.sdp.type === 'offer') {
          // Une offre de redémarrage réseau reprend la même connexion ; toute autre en ouvre une neuve.
          var p = d.restart && pc && pc.signalingState !== 'closed' ? pc : nouveauPc();
          if (!d.restart) slotsRecus = []; // avant : ontrack arrive PENDANT setRemoteDescription
          p.setRemoteDescription(d.sdp).then(function () {
            var t = transceiverAudio();
            if (t) { t.direction = 'sendrecv'; t.sender.replaceTrack(micOuvert && micPiste ? micPiste : null); }
            var tr = p.getTransceivers();
            tr.forEach(function (x, i) {
              if (!x.receiver.track || x.receiver.track.kind !== 'video') return;
              x.direction = tr.length > 2 + NB_ECRAN && i === tr.length - 1 ? 'sendonly' : 'recvonly';
            });
            brancherCamMoi();
            return p.createAnswer();
          }).then(function (r) { return p.setLocalDescription(r); }).then(function () {
            signaler(de, { sdp: p.localDescription });
            enAttenteIce.forEach(function (c) { p.addIceCandidate(c).catch(function () {}); }); enAttenteIce = [];
          }).catch(function () { dernierPret = 0; });
        } else if (d.cand) {
          if (pc && pc.remoteDescription) pc.addIceCandidate(d.cand).catch(function () {}); else enAttenteIce.push(d.cand);
        }
      }

      /* ----- Mesure de la qualité et proposition du mode faible ----- */
      function lireStats(p, prec) {
        return p.getStats().then(function (rapport) {
          var r = { perte: null, rtt: null, ips: null, limite: null };
          rapport.forEach(function (s) {
            if (s.type === 'inbound-rtp' && s.kind === 'video') {
              var recus = s.packetsReceived - (prec.recus || 0), perdus = s.packetsLost - (prec.perdus || 0);
              if (recus + perdus > 20) r.perte = perdus / (recus + perdus);
              prec.recus = s.packetsReceived; prec.perdus = s.packetsLost;
              r.ips = s.framesPerSecond != null ? s.framesPerSecond : null;
            }
            if (s.type === 'inbound-rtp' && s.kind === 'audio' && r.perte === null) {
              var ra = s.packetsReceived - (prec.recusA || 0), pa = s.packetsLost - (prec.perdusA || 0);
              if (ra + pa > 20) r.perteA = pa / (ra + pa);
              prec.recusA = s.packetsReceived; prec.perdusA = s.packetsLost;
            }
            if (s.type === 'remote-inbound-rtp' && s.kind === 'video') { r.perte = s.fractionLost != null ? s.fractionLost : r.perte; r.rtt = s.roundTripTime != null ? s.roundTripTime : r.rtt; }
            if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded' && s.currentRoundTripTime != null) r.rtt = r.rtt === null ? s.currentRoundTripTime : r.rtt;
            if (s.type === 'outbound-rtp' && s.kind === 'video' && s.qualityLimitationReason) r.limite = s.qualityLimitationReason;
          });
          if (r.perte === null && r.perteA != null) r.perte = r.perteA;
          return r;
        });
      }
      function noter(r) {
        var eff = navigator.connection && navigator.connection.effectiveType;
        if ((r.perte != null && r.perte > 0.1) || (r.rtt != null && r.rtt > 0.9) || eff === '2g' || eff === 'slow-2g') return 'faible';
        if ((r.perte != null && r.perte > 0.03) || (r.rtt != null && r.rtt > 0.45) || (r.ips != null && r.ips > 0 && r.ips < 10)) return 'moyenne';
        return 'bonne';
      }
      var surveillance = setInterval(function () {
        if (fermee) return;
        if (Date.now() - dernierMessage > 50000) marquerReseau('coupe');
        if (jeSuisAnimateur()) {
          var limites = 0, n = 0;
          Object.keys(liens).forEach(function (pid) {
            var l = liens[pid];
            if (l.pc.connectionState !== 'connected') return;
            n += 1;
            lireStats(l.pc, l.prec).then(function (r) {
              var q = noter(r); l.qualite = q;
              // Débit adapté à chacun : on baisse vite, on remonte doucement.
              l.facteur = q === 'faible' ? Math.max(0.3, l.facteur * 0.7) : q === 'moyenne' ? Math.max(0.4, l.facteur * 0.9) : Math.min(1.3, l.facteur * 1.08);
              if (r.limite === 'bandwidth') limites += 1;
            });
          });
          setTimeout(function () {
            appliquerDebits();
            marquerReseau(n && limites >= Math.max(1, n / 2) ? 'moyenne' : 'bonne');
            if (n && limites >= Math.max(2, n * 0.6) && videoPiste && Date.now() > refusFaibleJusqua) {
              refusFaibleJusqua = Date.now() + 10 * 60000;
              toast('Votre connexion sature en envoyant la vidéo à ' + n + ' apprenants.', 'alerte', { bouton: 'Passer au tableau (sans vidéo)', action: function () { if (camFlux) camera(); else definirVideo(null, 'tableau'); outil.actif = true; rendreTableau(); }, duree: 20000 });
            }
            if (panneau === 'participants') rendreVolet();
          }, 600);
          return;
        }
        if (!pc || pc.connectionState !== 'connected') {
          if (S.animateur && (!pc || ['failed', 'closed', 'new', 'disconnected'].indexOf(pc.connectionState) >= 0)) demanderLien();
          return;
        }
        lireStats(pc, precedent).then(function (r) {
          var q = noter(r); qualiteMoi = q; marquerReseau(q);
          if (q === 'faible') { mauvais += 1; bons = 0; } else if (q === 'bonne') { bons += 1; mauvais = 0; } else { mauvais = Math.max(0, mauvais - 1); }
          if (!moi().faible && mauvais >= 3 && Date.now() > refusFaibleJusqua) {
            mauvais = 0; refusFaibleJusqua = Date.now() + 5 * 60000;
            toast('Votre connexion semble lente. Passer en mode connexion faible ? Vous gardez le son, le tableau et la discussion.', 'alerte',
              { bouton: 'Oui, mode faible', action: function () { modeFaible(true); }, bouton2: 'Garder la vidéo', duree: 25000 });
          }
          if (moi().faible && bons >= 20 && Date.now() > refusFaibleJusqua) {
            bons = 0; refusFaibleJusqua = Date.now() + 5 * 60000;
            toast('Votre connexion s’est améliorée. Réactiver l’image du coach ?', 'succes', { bouton: 'Réactiver', action: function () { modeFaible(false); }, bouton2: 'Non merci' });
          }
        }).catch(function () {});
      }, 3000);
      // Qui parle ? Le coach seul entend tout le monde : il écoute souvent (150 ms) et
      // annonce la liste au plus toutes les 700 ms. « Parle » = un son net depuis moins d'une seconde.
      var dernierFort = {}, derniereAnnonce = 0, dernierChoixEcran = 0;
      var surveillanceParole = setInterval(function () {
        if (!jeSuisAnimateur() || fermee) return;
        var t = Date.now();
        if (micOuvert && niveau(micAnalyse) > 0.03) dernierFort[MOI] = t;
        Object.keys(liens).forEach(function (pid) { if (liens[pid].analyse && (participant(pid) || {}).micro && niveau(liens[pid].analyse) > 0.03) dernierFort[pid] = t; });
        if (t - dernierChoixEcran > 2000) { dernierChoixEcran = t; choisirEcran(); }
        if (t - derniereAnnonce < 700) return;
        var parlent = Object.keys(dernierFort).filter(function (pid) { return t - dernierFort[pid] < 1000 && (pid === MOI ? micOuvert : (participant(pid) || {}).micro); }).sort();
        if (parlent.join() !== parleursLocaux.join()) { derniereAnnonce = t; parleursLocaux = parlent; S.parleurs = parlent; rendreParleurs(); agir('parleurs', { pids: parlent }).catch(function () {}); }
      }, 150);
      var tampon = new Uint8Array(512);
      function niveau(a) {
        if (!a) return 0;
        a.getByteTimeDomainData(tampon);
        var s = 0; for (var i = 0; i < tampon.length; i += 1) { var v = (tampon[i] - 128) / 128; s += v * v; }
        return Math.sqrt(s / tampon.length);
      }

      function modeFaible(actif) {
        if (actif) couperCamera(false);
        agir('faible', { actif: actif }).then(function () {
          toast(actif ? '🐢 Mode connexion faible : le son et le tableau d’abord, sans l’image.' : 'Image du coach réactivée.', 'succes');
          rendreTableau();
        }).catch(function (e) { toast(e.message, 'alerte'); });
      }

      /* ----- Enregistrement du cours (chez l'animateur) ----- */
      function enregistre() { return !!enregistreur; }
      function enregistrer() {
        if (enregistreur) { enregistreur.stop(); return; }
        if (!window.MediaRecorder) { toast('Ce navigateur ne sait pas enregistrer : utilisez Chrome sur ordinateur.', 'alerte'); return; }
        audioCtx();
        var dest = ctx.createMediaStreamDestination();
        micGain.connect(dest);
        // On filme le tableau tel que la classe le voit : vidéo ou écran, craie, mot écrit.
        var toileRec = document.createElement('canvas'); toileRec.width = 1280; toileRec.height = 720;
        var c = toileRec.getContext('2d');
        var dessin = setInterval(function () {
          c.fillStyle = '#23463a'; c.fillRect(0, 0, 1280, 720);
          if (videoPiste && video.readyState >= 2) {
            var vr = video.videoWidth / video.videoHeight || 16 / 9, l = 1280, h = 1280 / vr; if (h > 720) { h = 720; l = 720 * vr; }
            c.drawImage(video, (1280 - l) / 2, (720 - h) / 2, l, h);
          }
          if (toile.width) c.drawImage(toile, 0, 0, 1280, 720);
          if (S.tableau.texte) { c.fillStyle = '#fff'; c.font = 'bold 64px "Comic Sans MS", "Chalkboard SE", cursive'; c.textAlign = 'center'; c.fillText(S.tableau.texte.slice(0, 40), 640, 140); }
        }, 100);
        var flux = new MediaStream([toileRec.captureStream(10).getVideoTracks()[0], dest.stream.getAudioTracks()[0]]);
        var type = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0];
        morceaux = [];
        try { enregistreur = new MediaRecorder(flux, type ? { mimeType: type, videoBitsPerSecond: 700000 } : undefined); } catch (x) { clearInterval(dessin); toast('Enregistrement impossible sur ce navigateur.', 'alerte'); return; }
        enregistreur._dest = dest;
        reconstruireMelange();
        enregistreur.ondataavailable = function (e) { if (e.data && e.data.size) morceaux.push(e.data); };
        enregistreur.onstop = function () {
          clearInterval(dessin);
          var blob = new Blob(morceaux, { type: (type || 'video/webm').split(';')[0] });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a'); a.href = url; a.download = 'cours-' + (P.salle.date_seance || 'ardoise') + '.' + (/mp4/.test(type || '') ? 'mp4' : 'webm');
          document.body.appendChild(a); a.click(); a.remove();
          toast('Enregistrement téléchargé. Mettez-le sur YouTube (non répertorié) ou Google Drive, puis publiez le lien dans « Replay » : les absents le suivront et leur présence sera comptée.', 'succes', { duree: 20000 });
          enregistreur = null; rendreBarre();
        };
        enregistreur.start(5000);
        toast('⏺ Enregistrement du cours en cours (sur cet appareil).', 'succes');
        rendreBarre();
      }

      function rendrePanneauSiBesoin() { if (panneau === 'participants') rendreVolet(); }

      /* ----- Réactions aux changements de la classe ----- */
      function surEtat() {
        if (jeSuisAnimateur()) { audioCtx(); return; }
        if (S.animateur && (!pc || pc.connectionState !== 'connected')) { dernierPret = 0; demanderLien(); }
      }
      function surParticipant(p, avant) {
        if (jeSuisAnimateur()) {
          var l = liens[p.pid];
          if (l && !!p.faible !== l.faible) { l.faible = !!p.faible; l.tv.sender.replaceTrack(l.faible ? null : videoPiste).catch(function () {}); appliquerDebits(); }
          if (!avant || !!avant.micro !== !!p.micro) reconstruireMelange();
          if (l && (!avant || !!avant.camera !== !!p.camera || !!avant.parole !== !!p.parole)) { if (!p.camera) { var e = epingles.indexOf(p.pid); if (e >= 0) epingles.splice(e, 1); } choisirEcran(); majEcran(); }
        } else if (p.pid === MOI && avant && !!avant.faible !== !!p.faible) rendreTableau();
      }
      function surDepart(pid) { if (jeSuisAnimateur()) { fermerLien(pid); var e = epingles.indexOf(pid); if (e >= 0) epingles.splice(e, 1); choisirEcran(); } }
      function surAnimateur() {
        if (jeSuisAnimateur()) { audioCtx(); Object.keys(liens).forEach(fermerLien); if (micOuvert) micGain.gain.value = 1; return; }
        if (pc) { try { pc.close(); } catch (x) { /* rien */ } pc = null; }
        essaisPret = 0; dernierPret = 0;
        if (S.animateur) setTimeout(demanderLien, 400);
      }
      function qualite(pid) { if (pid === MOI) return qualiteMoi; var l = liens[pid]; return l ? l.qualite : null; }

      function arreter() {
        clearInterval(surveillance); clearInterval(surveillanceParole);
        Object.keys(liens).forEach(fermerLien);
        if (pc) { try { pc.close(); } catch (x) { /* rien */ } }
        [micFlux, camFlux, ecranFlux, camFluxMoi].forEach(function (f) { if (f) f.getTracks().forEach(function (t) { t.stop(); }); });
        if (enregistreur) try { enregistreur.stop(); } catch (x) { /* rien */ }
        if (ctx) ctx.close().catch(function () {});
      }

      return {
        basculerMicro: basculerMicro, couperMicro: couperMicro, micActif: micActif, videoDisponible: videoDisponible,
        camera: camera, ecran: ecran, enregistrer: enregistrer, enregistre: enregistre, modeFaible: modeFaible,
        surSignal: surSignal, surEtat: surEtat, surParticipant: surParticipant, surDepart: surDepart, surAnimateur: surAnimateur,
        qualite: qualite, arreter: arreter, audioCtx: audioCtx, assurerMicro: assurerMicro, connecte: function () { return connecteUneFois; },
        basculerCamera: basculerCamera, couperCamera: couperCamera, cameraActive: cameraActive, fluxDe: fluxDe,
        majEcran: function () { majEcran(); }, choisirEcran: choisirEcran
      };
    })();

    /* ---------- Choix de l'avatar (et entrée dans la classe) ---------- */
    function choisirAvatar(entree) {
      var av = Object.assign({ peau: 'p3', coiffure: 'court', cheveux: 'noir', haut: 'bleu', accessoire: 'aucun' }, monAvatar || {});
      var m = el('<div class="ca-voile"><div class="ca-carte-avatar" role="dialog" aria-label="Votre avatar"><div class="ca-apercu" data-apercu></div><div class="ca-reglages-avatar">' +
        '<h2>' + (entree ? 'Bienvenue en classe' : 'Votre avatar') + '</h2><p>' + (entree ? 'Choisissez votre avatar : il prendra votre place dans la salle.' + (P.role === 'apprenant' ? ' Votre présence est déjà enregistrée.' : '') : 'Changez de tête quand vous voulez.') + '</p>' +
        Object.keys(CHOIX).map(function (k) {
          var c = CHOIX[k];
          return '<div class="ca-groupe-choix"><span>' + c.titre + '</span><div>' + c.valeurs.map(function (v) {
            var coul = COULEURS_CHOIX[k] ? COULEURS_CHOIX[k][v] : null;
            return '<button data-k="' + k + '" data-v="' + v + '" class="' + (coul ? 'pastille' : 'mot') + (av[k] === v ? ' actif' : '') + '"' + (coul ? ' style="background:' + coul + '" aria-label="' + v + '"' : '') + '>' + (coul ? '' : esc(c.noms[v])) + '</button>';
          }).join('') + '</div></div>';
        }).join('') +
        '<div class="ca-actions-avatar"><button class="ca-hasard" data-hasard>🎲 Au hasard</button><button class="ca-principal" data-ok>' + (entree ? 'Entrer dans la classe' : 'Enregistrer') + '</button></div>' +
        (entree && P.role !== 'apprenant' ? '<p class="ca-aide">Vous animez : votre micro et votre caméra vous seront demandés quand vous les activerez.</p>' : '') + '</div></div></div>');
      racine.appendChild(m);
      function apercu() { $('[data-apercu]', m).innerHTML = avatarSvg(av); }
      apercu();
      $$('[data-k]', m).forEach(function (b) {
        b.addEventListener('click', function () {
          av[b.getAttribute('data-k')] = b.getAttribute('data-v');
          $$('[data-k="' + b.getAttribute('data-k') + '"]', m).forEach(function (x) { x.classList.toggle('actif', x === b); });
          apercu();
        });
      });
      $('[data-hasard]', m).addEventListener('click', function () {
        Object.keys(CHOIX).forEach(function (k) { var v = CHOIX[k].valeurs; av[k] = v[Math.floor(Math.random() * (k === 'accessoire' ? 3 : v.length))]; });
        $$('[data-k]', m).forEach(function (x) { x.classList.toggle('actif', av[x.getAttribute('data-k')] === x.getAttribute('data-v')); });
        apercu();
      });
      $('[data-ok]', m).addEventListener('click', function () {
        monAvatar = av;
        try { localStorage.setItem('ardoise-avatar', JSON.stringify(av)); } catch (x) { /* rien */ }
        m.remove();
        if (entree) entrer(); else agirSilencieux('avatar', { avatar: av });
      });
    }

    function entrer() {
      // Ce clic est le geste qui autorise le son : on prépare l'audio maintenant.
      if (P.role !== 'apprenant') Media.audioCtx();
      son.play && son.play().catch(function () {});
      if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').then(function (v) { racine._veille = v; }).catch(function () {});
      voirVue(vueCourante);
      ouvrirPanneau(panneau);
      ouvrirFlux();
      setTimeout(function () { if (monAvatar) agirSilencieux('avatar', { avatar: monAvatar }); }, 1200);
      var eff = navigator.connection && navigator.connection.effectiveType;
      if (P.role === 'apprenant' && (eff === '2g' || eff === 'slow-2g')) {
        setTimeout(function () { toast('Votre réseau est lent (2G). Le mode connexion faible vous garde le son et le tableau.', 'alerte', { bouton: 'Mode connexion faible', action: function () { Media.modeFaible(true); }, bouton2: 'Non merci' }); }, 2500);
      }
    }

    /* ---------- Fin ---------- */
    function finir(message, bilan) {
      if (fermee) return;
      fermee = true;
      if (source) source.close();
      Media.arreter();
      clearInterval(horloge);
      if (racine._veille) racine._veille.release().catch(function () {});
      var m = el('<div class="ca-voile"><div class="ca-carte-fin"><div class="ca-fin-icone">' + (message ? '🔒' : '🎓') + '</div><h2>' + esc(message ? 'Classe fermée' : 'Le cours est terminé') + '</h2><p>' + esc(message || 'Merci à tous ! Votre participation est enregistrée.') + '</p>' +
        (bilan ? '<div class="ca-bilan"><div><strong>' + esc(bilan.duree_minutes) + ' min</strong><span>de cours</span></div><div><strong>' + esc(bilan.pic) + '</strong><span>connectés au plus</span></div><div><strong>' + esc((bilan.sondages || []).length) + '</strong><span>sondage' + ((bilan.sondages || []).length > 1 ? 's' : '') + '</span></div></div>' : '') +
        '<button class="ca-principal" data-sortir>Retour</button></div></div>');
      racine.appendChild(m);
      $('[data-sortir]', m).addEventListener('click', quitter);
    }
    function quitter() {
      if (!fermee) { fermee = true; if (source) source.close(); Media.arreter(); clearInterval(horloge); }
      window.removeEventListener('resize', redimensionnerCraie);
      racine.remove();
      document.documentElement.classList.remove('ca-ouverte');
      if (typeof opts.quitter === 'function') opts.quitter();
    }
    $('[data-quitter]', racine).addEventListener('click', function () {
      if (fermee || window.confirm(jeSuisAnimateur() ? 'Quitter la classe ? Elle reste ouverte : un autre membre du personnel peut l’animer, ou vous pouvez revenir.' : 'Quitter la classe ? Vous pouvez revenir tant que le cours dure.')) quitter();
    });
    window.addEventListener('beforeunload', function () { if (source) source.close(); });

    // Premier rendu (avant même le flux), puis le choix de l'avatar.
    S.participants[MOI] = { pid: MOI, role: P.role === 'animateur' ? 'animateur' : P.role, nom: P.nom, avatar: monAvatar, place: null, en_ligne: true };
    if (P.role === 'animateur') S.animateur = MOI;
    voirVue(vueCourante);
    redessinerTout();
    choisirAvatar(true);

    return { quitter: quitter, etat: S };
  }

  window.ClasseArdoise = { ouvrir: ouvrir, avatarSvg: avatarSvg, CHOIX: CHOIX };
})();
