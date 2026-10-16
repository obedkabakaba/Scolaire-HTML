/**
 * Ardoise — scène de vérification du paiement.
 *
 * POURQUOI
 * ---------------------------------------------------------------------------
 * Après l'envoi de la référence, l'école voyait un texte « Vérification
 * Ardoise » immobile, et devait actualiser la page pour apprendre que son
 * paiement était refusé — ou accepté. Cette scène raconte la vérification en
 * direct : le SMS voyage du téléphone vers Ardoise, chaque contrôle se coche,
 * et la fenêtre se transforme d'elle-même en célébration ou en alerte dès que
 * le serveur a tranché.
 *
 * Elle ne décide de RIEN : elle affiche l'état que la page lui transmet
 * (abonnements-page.js interroge le serveur toutes les 3 s tant qu'elle est
 * ouverte). La fermer n'interrompt aucune vérification.
 *
 * API : window.ArdoiseScenePaiement
 *   .ouvrir({ reference, montant, devise, reseau, onFermer, onCorriger })
 *   .attente(etatVerification)       — 'envoi' | 'attente_operateur' | 'verification_en_cours'
 *   .alerte({ titre, texte, motif, ton, corriger })
 *   .succes({ ecole, plan, periodicite, expiration, montant, devise })
 *   .fermer()  .estOuverte()
 */
(function () {
  'use strict';

  var ASTUCES = [
    'Ardoise compare votre référence au SMS que l’opérateur nous envoie. Cela prend en général moins de deux minutes.',
    'Vous pouvez fermer cette fenêtre : la vérification continue, et vous serez prévenu par e-mail.',
    'Le montant, la devise et la référence doivent correspondre exactement à votre demande.',
    'Une erreur de saisie ? Si rien n’arrive, vous pourrez corriger la référence vous-même.',
    'Votre abonnement s’activera tout seul, sans intervention de notre équipe.'
  ];

  var ETAPES = [
    { cle: 'recue', libelle: 'Référence enregistrée' },
    { cle: 'sms', libelle: 'Recherche du SMS de l’opérateur' },
    { cle: 'montant', libelle: 'Contrôle du montant' },
    { cle: 'activation', libelle: 'Activation de l’abonnement' }
  ];

  var voile = null, carte = null, minuteurAstuce = null, minuteurChrono = null;
  var debut = 0, options = {}, etatCourant = null;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function argent(n, d) {
    var v = Number(n);
    return Number.isFinite(v) ? v.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' ' + (d || 'USD') : '—';
  }
  function dateLongue(v) {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return '—'; }
  }
  function mouvementReduit() {
    return document.documentElement.getAttribute('data-animations') === 'non'
      || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  var SCENE_SVG =
    '<div class="ps-scene" aria-hidden="true">'
    + '<svg class="ps-telephone" viewBox="0 0 54 92"><rect class="coque" x="1" y="1" width="52" height="90" rx="10"/>'
    + '<rect class="ecran" x="6" y="12" width="42" height="64" rx="3"/>'
    + '<rect class="barre" x="11" y="22" width="26" height="6" rx="3"/><rect class="barre" x="11" y="33" width="18" height="6" rx="3" opacity=".55"/>'
    + '<rect class="barre" x="11" y="44" width="30" height="6" rx="3" opacity=".35"/></svg>'
    + '<div class="ps-route"></div><div class="ps-message"></div>'
    + '<div class="ps-sceau"><span class="ps-sceau-onde"></span><span class="ps-sceau-onde o2"></span>'
    + '<div class="ps-sceau-disque"><span class="ps-lettre">A</span>'
    + '<svg class="ps-coche" viewBox="0 0 72 72"><path d="M22 37 L32 47 L51 27"/></svg></div></div>'
    + '</div>';

  function etapesHTML() {
    return '<ol class="ps-etapes">' + ETAPES.map(function (e) {
      return '<li data-etape="' + e.cle + '"><span class="ps-puce"></span><span>' + esc(e.libelle) + '</span></li>';
    }).join('') + '</ol>';
  }

  function marquer(fait, actif, alerte) {
    if (!carte) return;
    ETAPES.forEach(function (e, i) {
      var li = carte.querySelector('[data-etape="' + e.cle + '"]');
      if (!li) return;
      li.classList.toggle('fait', i < fait);
      li.classList.toggle('actif', i === actif);
      li.classList.toggle('alerte', i === alerte);
      li.querySelector('.ps-puce').textContent = i < fait ? '✓' : i === alerte ? '!' : '';
    });
  }

  function arreterMinuteurs() {
    clearInterval(minuteurAstuce); clearInterval(minuteurChrono);
    minuteurAstuce = minuteurChrono = null;
  }

  function demarrerMinuteurs() {
    arreterMinuteurs();
    var i = 0;
    minuteurAstuce = setInterval(function () {
      var a = carte && carte.querySelector('.ps-astuce');
      if (!a) return;
      a.style.opacity = '0';
      setTimeout(function () { i = (i + 1) % ASTUCES.length; a.textContent = ASTUCES[i]; a.style.opacity = '1'; }, 350);
    }, 6000);
    minuteurChrono = setInterval(function () {
      var c = carte && carte.querySelector('.ps-chrono');
      if (!c) return;
      var s = Math.round((Date.now() - debut) / 1000);
      c.textContent = 'Vérification en cours depuis ' + (s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + (s % 60) + ' s');
      // Au-delà de 90 s, on rassure plutôt que de laisser attendre.
      if (s === 90) {
        var t = carte.querySelector('.ps-sous-titre');
        if (t) t.textContent = 'Le SMS de l’opérateur n’est pas encore arrivé. Ce n’est pas grave : '
          + 'fermez cette fenêtre si vous le souhaitez, l’activation se fera toute seule dès sa réception.';
      }
    }, 1000);
  }

  function boutonsHTML(liste) {
    return '<div class="ps-actions">' + liste.map(function (b) {
      return '<button type="button" class="bouton ' + (b.principal ? 'bouton-principal' : 'bouton-secondaire')
        + '" data-ps="' + b.action + '">' + esc(b.libelle) + '</button>';
    }).join('') + '</div>';
  }

  function brancher() {
    if (!carte) return;
    Array.prototype.forEach.call(carte.querySelectorAll('[data-ps]'), function (b) {
      b.onclick = function () {
        var a = b.getAttribute('data-ps');
        if (a === 'fermer') fermer();
        else if (a === 'corriger') { var f = options.onCorriger; fermer(); if (f) f(); }
        else if (a === 'support') { location.href = 'support.html'; }
      };
    });
  }

  function ouvrir(opt) {
    options = opt || {};
    fermer(true);
    debut = Date.now();
    voile = document.createElement('div');
    voile.className = 'ps-voile';
    voile.setAttribute('role', 'dialog');
    voile.setAttribute('aria-modal', 'true');
    voile.setAttribute('aria-labelledby', 'ps-titre');
    voile.innerHTML = '<div class="ps-carte" aria-live="polite">'
      + '<button type="button" class="ps-fermer" data-ps="fermer" aria-label="Fermer">×</button>'
      + SCENE_SVG
      + '<h2 class="ps-titre" id="ps-titre">Nous vérifions votre paiement</h2>'
      + '<p class="ps-sous-titre">Votre référence est partie. Ardoise la compare au SMS de l’opérateur.</p>'
      + (options.reference ? '<div class="ps-reference">Référence <code>' + esc(options.reference) + '</code>'
        + (options.montant != null ? '<span class="ps-montant">' + esc(argent(options.montant, options.devise)) + '</span>' : '') + '</div>' : '')
      + etapesHTML()
      + '<p class="ps-astuce">' + esc(ASTUCES[0]) + '</p>'
      + '<div class="ps-chrono">Vérification en cours…</div>'
      + boutonsHTML([{ action: 'fermer', libelle: 'Fermer, je serai prévenu' }])
      + '</div>';
    document.body.appendChild(voile);
    carte = voile.querySelector('.ps-carte');
    voile.addEventListener('click', function (e) { if (e.target === voile) fermer(); });
    document.addEventListener('keydown', echap);
    brancher();
    attente('envoi');
    demarrerMinuteurs();
    var f = carte.querySelector('.ps-fermer');
    if (f) f.focus();
  }

  function echap(e) { if (e.key === 'Escape') fermer(); }

  function attente(etat) {
    if (!carte) return;
    etatCourant = etat;
    carte.classList.remove('alerte', 'attention', 'succes');
    if (etat === 'envoi') marquer(0, 0);
    else if (etat === 'verification_en_cours') marquer(2, 2);
    else marquer(1, 1);   // attente_operateur, verification_manuelle…
  }

  /** Remplace le contenu sous la scène, en gardant l'animation du sceau. */
  function recomposer(html) {
    if (!carte) return;
    arreterMinuteurs();
    var garder = carte.querySelector('.ps-scene');
    var fermerBtn = carte.querySelector('.ps-fermer');
    carte.innerHTML = '';
    carte.appendChild(fermerBtn);
    carte.appendChild(garder);
    carte.insertAdjacentHTML('beforeend', html);
    brancher();
  }

  function alerte(a) {
    if (!carte) return;
    etatCourant = 'alerte';
    var ton = a.ton === 'attention' ? 'attention' : 'alerte';
    carte.classList.remove('succes', 'alerte', 'attention');
    // Le reflow relance l'animation de secousse à chaque nouvelle alerte.
    void carte.offsetWidth;
    carte.classList.add(ton === 'attention' ? 'attention' : 'alerte');
    var lettre = carte.querySelector('.ps-lettre');
    if (lettre) lettre.textContent = '!';
    var boutons = [];
    if (a.corriger) boutons.push({ action: 'corriger', libelle: 'Corriger la référence', principal: true });
    boutons.push({ action: 'support', libelle: 'Écrire au support' });
    boutons.push({ action: 'fermer', libelle: 'Fermer' });
    recomposer(
      '<h2 class="ps-titre" id="ps-titre">' + esc(a.titre || 'Nous n’avons pas pu confirmer ce paiement') + '</h2>'
      + (a.texte ? '<p class="ps-sous-titre">' + esc(a.texte) + '</p>' : '')
      + (a.motif ? '<div class="ps-motif"><strong>Motif</strong>' + esc(a.motif) + '</div>' : '')
      + boutonsHTML(boutons));
  }

  function succes(s) {
    if (!carte) { ouvrir({}); }
    etatCourant = 'succes';
    marquer(4, -1);
    var lettre = carte.querySelector('.ps-lettre');
    if (lettre) lettre.textContent = 'A';
    carte.classList.remove('alerte', 'attention');
    // Les quatre coches d'abord, la transformation du sceau ensuite : on voit
    // le travail se terminer avant la fête.
    setTimeout(function () {
      if (!carte) return;
      carte.classList.add('succes');
      recomposer(
        '<h2 class="ps-titre" id="ps-titre">Abonnement activé !</h2>'
        + '<p class="ps-sous-titre">Merci' + (s.ecole ? ', ' + esc(s.ecole) : '')
        + '. Votre paiement est confirmé et Ardoise est entièrement à vous.</p>'
        + '<div class="ps-recap">'
        + '<div><small>Offre</small><strong>' + esc(s.plan || '—') + '</strong></div>'
        + '<div><small>Montant</small><strong>' + esc(argent(s.montant, s.devise)) + '</strong></div>'
        + '<div><small>Actif jusqu’au</small><strong>' + esc(dateLongue(s.expiration)) + '</strong></div>'
        + '</div>'
        + '<p class="ps-astuce">Un reçu vous a été envoyé par e-mail. Votre facture est disponible dans Ardoise.</p>'
        + boutonsHTML([{ action: 'fermer', libelle: 'Continuer', principal: true }]));
      if (!mouvementReduit()) confettis();
    }, mouvementReduit() ? 0 : 650);
  }

  /** Une pluie de confettis aux couleurs du thème, ~2,5 s, puis plus rien. */
  function confettis() {
    var styles = getComputedStyle(document.documentElement);
    var couleurs = ['--ocre', '--vert-ok', '--ardoise', '--ocre-clair', '--rouge']
      .map(function (v) { return styles.getPropertyValue(v).trim(); })
      .filter(Boolean);
    if (!couleurs.length) couleurs = ['#C98A3E', '#2E7D4F', '#1F2B24'];

    var toile = document.createElement('canvas');
    toile.className = 'ps-confettis';
    document.body.appendChild(toile);
    var ctx = toile.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    function dimensionner() {
      toile.width = innerWidth * dpr; toile.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    dimensionner();

    var cx = innerWidth / 2, cy = Math.min(innerHeight * 0.38, 300);
    var pieces = [];
    for (var i = 0; i < 160; i++) {
      var angle = Math.random() * Math.PI * 2;
      var vitesse = 4 + Math.random() * 9;
      pieces.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * vitesse, vy: Math.sin(angle) * vitesse - 5,
        t: 5 + Math.random() * 7, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
        c: couleurs[i % couleurs.length], forme: i % 3
      });
    }
    var depart = performance.now();
    (function image(maintenant) {
      var age = maintenant - depart;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      var opacite = age > 1900 ? Math.max(0, 1 - (age - 1900) / 700) : 1;
      pieces.forEach(function (p) {
        p.vy += 0.22; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = opacite;
        ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        if (p.forme === 0) ctx.fillRect(-p.t / 2, -p.t / 4, p.t, p.t / 2);
        else if (p.forme === 1) { ctx.beginPath(); ctx.arc(0, 0, p.t / 3, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(0, -p.t / 2); ctx.lineTo(p.t / 2, p.t / 2); ctx.lineTo(-p.t / 2, p.t / 2); ctx.fill(); }
        ctx.restore();
      });
      if (age < 2600) requestAnimationFrame(image);
      else toile.remove();
    })(depart);
  }

  function fermer(silencieux) {
    arreterMinuteurs();
    document.removeEventListener('keydown', echap);
    if (voile) voile.remove();
    var f = options.onFermer;
    voile = carte = null;
    etatCourant = null;
    if (!silencieux && typeof f === 'function') f();
  }

  window.ArdoiseScenePaiement = {
    ouvrir: ouvrir,
    attente: attente,
    alerte: alerte,
    succes: succes,
    fermer: function () { fermer(false); },
    estOuverte: function () { return Boolean(voile); },
    etat: function () { return etatCourant; }
  };
})();
