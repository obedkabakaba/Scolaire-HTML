/* =====================================================================
   ARDOISE — TOUTE FENÊTRE SE REFERME
   ---------------------------------------------------------------------
   Une fenêtre qu'on ne sait pas refermer est un piège : on recharge la
   page, on perd ce qu'on faisait. Ce filet de sécurité vaut pour TOUTES
   les fenêtres de la plateforme, celles d'aujourd'hui et celles qu'on
   ajoutera :

     · une croix ✕ toujours visible en haut, si la fenêtre n'a pas déjà
       un bouton de fermeture visible sans faire défiler ;
     · la touche Échap (ordinateur) ferme la fenêtre du dessus ;
     · la touche Retour du téléphone ferme la fenêtre du dessus au lieu
       de quitter la page.

   Pour fermer, on utilise d'abord le bouton de la fenêtre elle-même
   (« Fermer », « Annuler », ✕…) : la page fait alors exactement ce
   qu'elle prévoit (remettre un formulaire à zéro, rafraîchir une liste).
   La classe en ligne a sa propre sortie (« Quitter la classe ? ») et
   n'est pas concernée.
   ===================================================================== */
(function () {
  'use strict';
  if (window.ArdoiseFermetures) return;

  var FENETRES = '.voile, .voile-confirmation, .cf-voile, .app-voile, .ard-app-voile, .modale-voile, .ard-visionneuse, [data-fenetre]';
  var BOITES = '.modale, .boite-confirmation, .cf-modale, .app-feuille, .ard-app-feuille, .ard-feuille-mobile, [role="dialog"], [role="alertdialog"], .carte-modale, .panneau-modale';
  var CONTROLES = '[data-fermer], .fermer, .bouton-fermer, [id^="bouton-fermer"], [id*="-fermer"], [id*="annuler"], button[aria-label="Fermer"], .commande-fermer, .commande-annuler, .annuler, [data-rester], .ard-di-fermer, .cf-modale header button';
  var TEXTES = /^\s*(✕|×|x|fermer|annuler|retour|non merci|plus tard|rester dans la classe|j’ai compris|j'ai compris|ok|compris)\s*$/i;

  function visible(el) {
    if (!el || !el.isConnected || el.hidden) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function exclue(v) {
    return !!(v.closest('.ca-racine') || v.closest('[data-sans-fermeture]'));
  }
  function ouvertes() {
    var liste = Array.prototype.filter.call(document.querySelectorAll(FENETRES), function (v) {
      if (exclue(v) || !visible(v)) return false;
      var cs = getComputedStyle(v);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
      var r = v.getBoundingClientRect();
      return r.width >= window.innerWidth * 0.6 && r.height >= window.innerHeight * 0.5;
    });
    // La fenêtre du dessus : la plus récente dans le document, à z-index égal.
    return liste.sort(function (a, b) {
      var za = Number(getComputedStyle(a).zIndex) || 0, zb = Number(getComputedStyle(b).zIndex) || 0;
      if (za !== zb) return za - zb;
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }
  function boiteDe(v) { return v.querySelector(BOITES) || v.firstElementChild || v; }
  function controles(v) {
    var c = Array.prototype.slice.call(v.querySelectorAll(CONTROLES));
    Array.prototype.forEach.call(v.querySelectorAll('button, a'), function (b) {
      if (c.indexOf(b) < 0 && TEXTES.test(b.textContent || '')) c.push(b);
    });
    return c.filter(function (b) { return visible(b) && !b.disabled && !b.classList.contains('ard-x-auto'); });
  }
  function dansLEcran(b) {
    var r = b.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
  }

  /** Ferme la fenêtre v par SON bouton, sinon en la masquant. */
  function fermer(v) {
    var c = controles(v);
    // Le ✕ ou « Fermer » d'abord ; « Annuler » ensuite ; pas un « OK »
    // qui validerait quelque chose.
    var choix = c.filter(function (b) { return /^\s*(✕|×|x|fermer)\s*$/i.test(b.textContent || '') || b.matches('[data-fermer], .fermer, .bouton-fermer, [aria-label="Fermer"], .commande-fermer, .ard-di-fermer, .cf-modale header button'); })[0]
      || c.filter(function (b) { return /annuler|retour|plus tard|non merci|rester/i.test(b.textContent || '') || b.matches('.annuler, .commande-annuler, [data-rester]'); })[0]
      || c[0];
    if (choix) { choix.click(); return; }
    v.classList.remove('visible', 'ouvert', 'actif', 'show', 'ouverte');
    if (visible(v)) v.style.display = 'none';
  }

  /** Une croix ✕ visible, si la fenêtre n'a aucun moyen de fermeture visible. */
  function garantirCroix(v) {
    if (v.classList.contains('ard-visionneuse')) return; // a déjà « Fermer » en haut
    var c = controles(v).filter(dansLEcran);
    var boite = boiteDe(v);
    var croix = boite.querySelector(':scope > .ard-x-auto');
    if (c.length) { if (croix) croix.remove(); return; }
    if (croix) return;
    croix = document.createElement('button');
    croix.type = 'button';
    croix.className = 'ard-x-auto';
    croix.setAttribute('aria-label', 'Fermer');
    croix.textContent = '✕';
    croix.addEventListener('click', function (ev) { ev.stopPropagation(); fermer(v); });
    boite.insertBefore(croix, boite.firstChild);
  }

  /* ---------- Échap ---------- */
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape' || ev.defaultPrevented) return;
    var o = ouvertes(); if (!o.length) return;
    fermer(o[o.length - 1]);
  });

  /* ---------- Retour du téléphone ----------
     À chaque fenêtre qui s'ouvre, une entrée d'historique (même adresse) ;
     Retour la consomme en fermant la fenêtre. Si la fenêtre se ferme
     autrement, l'entrée est retirée sans bouger de page. */
  var pile = 0, ignorer = 0;
  function majHistorique() {
    var n = ouvertes().filter(function (v) { return !v.classList.contains('ard-visionneuse'); }).length;
    while (pile < n) { try { history.pushState({ ardFenetre: true }, ''); } catch (x) { break; } pile++; }
    if (pile > n && history.state && history.state.ardFenetre) {
      var trop = pile - n; pile = n; ignorer += trop;
      try { history.go(-trop); } catch (x) { ignorer -= trop; }
    }
  }
  window.addEventListener('popstate', function () {
    if (ignorer > 0) { ignorer--; return; }
    if (pile <= 0) return;
    pile--;
    var o = ouvertes().filter(function (v) { return !v.classList.contains('ard-visionneuse'); });
    if (o.length) fermer(o[o.length - 1]);
  });

  /* ---------- Surveillance ---------- */
  var prevu = false;
  function examiner() {
    prevu = false;
    var o = ouvertes();
    o.forEach(garantirCroix);
    majHistorique();
  }
  function planifier() {
    if (prevu) return;
    prevu = true;
    // Deux passages : juste après le changement, puis après l'animation
    // d'ouverture ou de fermeture (fondu).
    requestAnimationFrame(function () { setTimeout(examiner, 60); setTimeout(examiner, 380); });
  }
  document.addEventListener('transitionend', planifier, true);
  new MutationObserver(planifier).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
  window.addEventListener('resize', planifier);

  var style = document.createElement('style');
  style.textContent = '.ard-x-auto{position:sticky;top:0;float:right;z-index:5;width:38px;height:38px;margin:-4px -4px 6px 10px;border:0;border-radius:50%;' +
    'background:rgba(0,0,0,.06);color:inherit;font:600 18px/38px system-ui,sans-serif;text-align:center;cursor:pointer;padding:0}' +
    '.ard-x-auto:hover{background:rgba(0,0,0,.12)}';
  document.head.appendChild(style);

  window.ArdoiseFermetures = { fermer: fermer, ouvertes: ouvertes, examiner: examiner };
})();
