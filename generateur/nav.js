/* =============================================================================
   ARDOISE — NAVIGATION DU SITE PUBLIC
   =============================================================================

   Quarante lignes utiles, et une règle : le menu doit fonctionner sans souris.
   Les sous-menus sont donc pilotés par des <button aria-expanded>, pas par
   :hover seul — un menu déroulant qui n'existe qu'au survol est inatteignable
   au clavier et capricieux au doigt.

   Le survol reste branché sur les grands écrans, parce que c'est ce qu'un
   visiteur attend d'une barre de navigation ; il ouvre le même panneau, par le
   même chemin, et met à jour le même attribut.
   ============================================================================= */

(function () {
  'use strict';

  var GRAND_ECRAN = window.matchMedia('(min-width: 1001px)');
  var groupes = [].slice.call(document.querySelectorAll('.a-sous-menu'));
  var bascule = document.querySelector('.bascule-menu');
  var panneau = document.getElementById('panneau-mobile');

  function ouvrir(groupe, etat) {
    var bouton = groupe.querySelector('.declencheur');
    var panneauSm = groupe.querySelector('.sous-menu');
    if (!bouton || !panneauSm) return;
    bouton.setAttribute('aria-expanded', String(etat));
    panneauSm.hidden = !etat;
  }

  function toutFermer(sauf) {
    groupes.forEach(function (g) { if (g !== sauf) ouvrir(g, false); });
  }

  groupes.forEach(function (groupe) {
    var bouton = groupe.querySelector('.declencheur');
    if (!bouton) return;

    bouton.addEventListener('click', function () {
      var ouvertMaintenant = bouton.getAttribute('aria-expanded') === 'true';
      toutFermer(groupe);
      ouvrir(groupe, !ouvertMaintenant);
    });

    // Survol : uniquement là où il y a un pointeur fin et de la place.
    groupe.addEventListener('mouseenter', function () {
      if (!GRAND_ECRAN.matches) return;
      toutFermer(groupe);
      ouvrir(groupe, true);
    });
    groupe.addEventListener('mouseleave', function () {
      if (!GRAND_ECRAN.matches) return;
      ouvrir(groupe, false);
    });

    // Le panneau se ferme dès que le focus quitte le groupe : sans cela, un
    // utilisateur au clavier laisse derrière lui une traînée de menus ouverts.
    groupe.addEventListener('focusout', function (e) {
      if (!groupe.contains(e.relatedTarget)) ouvrir(groupe, false);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var actif = document.querySelector('.declencheur[aria-expanded="true"]');
    toutFermer(null);
    if (actif) actif.focus();
    if (panneau && !panneau.hidden) fermerPanneau();
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.a-sous-menu')) toutFermer(null);
  });

  /* ------------------------------------------------------ Panneau mobile */

  function fermerPanneau() {
    if (!panneau || !bascule) return;
    panneau.hidden = true;
    bascule.setAttribute('aria-expanded', 'false');
    bascule.setAttribute('aria-label', 'Ouvrir le menu');
    document.body.style.overflow = '';
  }

  if (bascule && panneau) {
    bascule.addEventListener('click', function () {
      var ouvert = bascule.getAttribute('aria-expanded') === 'true';
      if (ouvert) { fermerPanneau(); return; }
      panneau.hidden = false;
      bascule.setAttribute('aria-expanded', 'true');
      bascule.setAttribute('aria-label', 'Fermer le menu');
      document.body.style.overflow = 'hidden';
    });

    // Un lien suivi doit refermer le panneau : sur une ancre interne, la page
    // ne se recharge pas et le menu resterait ouvert par-dessus le contenu.
    panneau.addEventListener('click', function (e) {
      if (e.target.closest('a')) fermerPanneau();
    });

    GRAND_ECRAN.addEventListener('change', function (e) {
      if (e.matches) fermerPanneau();
    });
  }
})();
