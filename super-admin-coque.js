/* ==========================================================================
   Ardoise — Espace Super Admin : COQUE DE NAVIGATION PAR DOMAINES
   --------------------------------------------------------------------------
   Ce fichier ne contient aucun écran métier. Il donne une charpente aux
   quatre-vingt-dix écrans qui existent déjà :

     · un RAIL de domaines (Pilotage, Écoles, Finance, Supervision…) ;
     · un PANNEAU qui ne montre que les sections du domaine courant ;
     · une BARRE HAUTE : fil d'Ariane et recherche (Ctrl K) ;
     · des ESPACES DE TRAVAIL : les écrans d'un même sujet partagent une
       barre d'onglets au lieu d'occuper chacun une ligne de menu ;
     · une VUE D'ENSEMBLE par domaine (#/espace/<domaine>) ;
     · des PASTILLES de comptage, alimentées par les vraies files d'attente.

   SOURCE UNIQUE
   -------------
   Tout est lu dans le bloc <nav id="sa-navigation"> de super-admin.html. Rien
   n'est déclaré une seconde fois ici : une table en double finit toujours par
   diverger de l'autre, et l'on obtient un menu qui mène à un écran que le fil
   d'Ariane ne connaît pas.

   CE QUE CE FICHIER NE FAIT PAS
   -----------------------------
   Il n'appelle aucune route d'écriture, ne lit que des listes déjà exposées
   au Super Admin, et ne remplace aucune vue. Si une source de comptage
   échoue, sa pastille disparaît : on n'affiche pas « 0 » sur une mesure
   qu'on n'a pas pu faire.
   ========================================================================== */

(function () {
  'use strict';

  if (!window.SA) return;
  const { esc } = SA;

  /* ======================================================================
     1. Icônes — tracées à la main, trait `currentColor`
     ----------------------------------------------------------------------
     Des pictogrammes au trait plutôt que des émojis : ils prennent la couleur
     du thème (y compris Nuit), restent nets à toutes les tailles et se lisent
     de la même façon sur tous les systèmes.
     ====================================================================== */

  const ICONES = {
    jauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    ecole: '<path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M10 21v-5h4v5"/><circle cx="12" cy="11" r="1.6"/>',
    bulle: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    croissance: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    utilisateurs: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.6a6.5 6.5 0 0 1 3.5 5.4"/>',
    portefeuille: '<rect x="2.5" y="5.5" width="19" height="14" rx="2.2"/><path d="M2.5 10h19"/><path d="M15.5 15h3"/>',
    pouls: '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
    coche: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    etincelle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    reglages: '<path d="M4 6h9"/><path d="M19 6h1"/><circle cx="16" cy="6" r="2.2"/><path d="M4 12h2"/><path d="M12 12h8"/><circle cx="9" cy="12" r="2.2"/><path d="M4 18h11"/><circle cx="18" cy="18" r="2.2"/>',
    recherche: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-4-4-7.5-9-7.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.3" r="1"/><circle cx="14.6" cy="7.3" r="1"/>',
    sortie: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="m10 17-5-5 5-5"/><path d="M5 12h11"/>',
    fleche: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    alerte: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4"/><path d="M12 17.2h.01"/>',
    horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    valide: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    rafraichir: '<path d="M20 11a8 8 0 0 0-14.9-3.9L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.9 3.9L20 15"/><path d="M20 20v-5h-5"/>',
    grille: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'
  };

  SA.ui.icone = function (nom, taille) {
    const t = taille || 18;
    return `<svg class="sa-svg" width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONES[nom] || ICONES.grille}</svg>`;
  };

  /* ======================================================================
     2. Lecture du menu déclaré dans la page
     ====================================================================== */

  const nav = document.getElementById('sa-navigation');
  const panneau = document.getElementById('sa-panneau-nav');
  const zoneRail = document.getElementById('sa-rail-domaines');
  if (!nav || !panneau || !zoneRail) return;

  const texte = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  /**
   * Modèle lu une fois au démarrage :
   *   domaines[] → { id, libelle, icone, accueil, description, element,
   *                  groupes[] → { titre, avance, entrees[] } }
   *   entree     → { libelle, route, compteur, element, onglets[] | null }
   */
  const domaines = [...panneau.querySelectorAll('.sa-domaine')].map((section) => {
    const groupes = [...section.querySelectorAll('.sa-nav-groupe')].map((groupe) => {
      const titre = texte(groupe.querySelector(':scope > .sa-nav-groupe-titre'));
      const entrees = [...groupe.querySelectorAll(':scope > .sa-menu > li')].map((li) => {
        const liens = [...li.querySelectorAll('a[data-route]')];
        if (!liens.length) return null;
        const espace = li.classList.contains('sa-espace');
        return {
          libelle: espace ? li.getAttribute('data-espace') : texte(liens[0]),
          route: liens[0].getAttribute('data-route'),
          compteur: li.getAttribute('data-compteur') || liens[0].getAttribute('data-compteur') || null,
          element: li,
          onglets: espace
            ? liens.map((a) => ({ route: a.getAttribute('data-route'), libelle: texte(a) }))
            : null
        };
      }).filter(Boolean);
      return { titre, avance: groupe.classList.contains('sa-nav-avance'), entrees, element: groupe };
    });

    return {
      id: section.getAttribute('data-domaine'),
      libelle: section.getAttribute('data-libelle'),
      icone: section.getAttribute('data-icone'),
      accueil: section.getAttribute('data-accueil'),
      description: section.getAttribute('data-description') || '',
      element: section,
      groupes
    };
  });

  /** Toutes les routes déclarées → l'entrée, l'onglet et le domaine qui les portent. */
  const index = [];
  domaines.forEach((d) => d.groupes.forEach((g) => g.entrees.forEach((e) => {
    (e.onglets || [{ route: e.route, libelle: e.libelle }]).forEach((o) => {
      index.push({ route: o.route, libelle: o.libelle, domaine: d, groupe: g, entree: e, onglet: e.onglets ? o : null });
    });
  })));

  /**
   * Correspondance la plus longue, comme l'ancien `marquerMenuActif` : sur
   * `#/cc/regles`, « Vue technique » (route `cc`) ne doit pas s'allumer en
   * même temps que « Règles métier ».
   */
  function trouver(chemin) {
    let meilleure = null;
    for (const item of index) {
      if (chemin !== item.route && !chemin.startsWith(item.route + '/')) continue;
      if (!meilleure || item.route.length > meilleure.route.length) meilleure = item;
    }
    return meilleure;
  }

  /* ======================================================================
     3. Construction : rail, panneau, espaces de travail
     ====================================================================== */

  zoneRail.innerHTML = domaines.map((d) => `
    <button type="button" class="sa-rail-domaine" role="tab" aria-selected="false"
            data-domaine-rail="${esc(d.id)}" aria-label="${esc(d.libelle)}" data-infobulle="${esc(d.libelle)}">
      ${SA.ui.icone(d.icone, 20)}
      <span class="sa-rail-point" hidden></span>
    </button>`).join('');

  const boutonRecherche = document.getElementById('sa-rail-recherche');
  if (boutonRecherche) boutonRecherche.innerHTML = SA.ui.icone('recherche', 19);
  const lienApparence = nav.querySelector('.sa-rail-pied a[data-route="apparence"]');
  if (lienApparence) lienApparence.innerHTML = SA.ui.icone('palette', 19);
  const loupe = document.querySelector('.sa-recherche-icone');
  if (loupe) loupe.innerHTML = SA.ui.icone('recherche', 16);

  domaines.forEach((d) => {
    // Titre du domaine → sa vue d'ensemble.
    const titre = d.element.querySelector('.sa-domaine-titre');
    if (titre) {
      titre.innerHTML = `<span>${esc(d.libelle)}</span>
        <a class="sa-domaine-apercu" href="#/espace/${esc(d.id)}" data-route="espace/${esc(d.id)}"
           title="Vue d'ensemble : ${esc(d.libelle)}" aria-label="Vue d'ensemble du domaine ${esc(d.libelle)}">${SA.ui.icone('grille', 16)}</a>`;
    }
    // Un espace de travail n'occupe qu'UNE ligne : ses écrans deviennent des onglets.
    d.groupes.forEach((g) => g.entrees.forEach((e) => {
      if (!e.onglets) return;
      const lien = document.createElement('a');
      lien.className = 'sa-espace-lien';
      lien.href = `#/${e.route}`;
      lien.innerHTML = `<span>${esc(e.libelle)}</span>`;
      lien.title = e.onglets.map((o) => o.libelle).join(' · ');
      e.element.insertBefore(lien, e.element.firstChild);
    }));
  });

  // Le pied (identité, déconnexion) devient le menu du compte, ouvert depuis le rail.
  const pied = panneau.querySelector('.sa-nav-pied');
  const boutonProfil = document.getElementById('sa-rail-profil');
  if (pied && boutonProfil) {
    pied.classList.add('sa-menu-compte');
    // Un simple groupe de liens : `role="menu"` exigerait des `menuitem` et la
    // navigation au clavier propre aux menus applicatifs (axe : aria-required-children).
    pied.setAttribute('role', 'group');
    pied.setAttribute('aria-label', 'Mon compte');
    pied.hidden = true;
    nav.appendChild(pied);
    const deconnexion = pied.querySelector('#bouton-deconnexion');
    if (deconnexion) deconnexion.innerHTML = `${SA.ui.icone('sortie', 16)}<span>Se déconnecter</span>`;
    const securite = document.createElement('a');
    securite.href = '#/compte/securite';
    securite.className = 'sa-menu-compte-lien';
    securite.innerHTML = `${SA.ui.icone('coche', 16)}<span>Sécurité du compte</span><span class="sa-compte-mfa" id="sa-compte-mfa"></span>`;
    pied.insertBefore(securite, deconnexion || null);
    const apparence = document.createElement('a');
    apparence.href = '#/apparence';
    apparence.className = 'sa-menu-compte-lien';
    apparence.innerHTML = `${SA.ui.icone('palette', 16)}<span>Apparence</span>`;
    pied.insertBefore(apparence, deconnexion || null);

    const basculer = (ouvrir) => {
      const etat = typeof ouvrir === 'boolean' ? ouvrir : pied.hidden;
      pied.hidden = !etat;
      boutonProfil.setAttribute('aria-expanded', String(etat));
    };
    boutonProfil.addEventListener('click', (ev) => { ev.stopPropagation(); basculer(); });
    document.addEventListener('click', (ev) => {
      if (!pied.hidden && !ev.target.closest('.sa-menu-compte')) basculer(false);
    });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') basculer(false); });
    pied.addEventListener('click', (ev) => { if (ev.target.closest('a')) basculer(false); });
  }

  /* Déconnexion directe depuis le rail. Le menu du compte la propose aussi,
     mais elle ne doit jamais dépendre d'un seul chemin : c'est le bouton
     d'origine (#bouton-deconnexion) qui est déclenché, avec son gestionnaire
     de session et la propagation aux autres onglets. */
  const piedRail = nav.querySelector('.sa-rail-pied');
  if (piedRail && !piedRail.querySelector('.sa-rail-sortie')) {
    const sortie = document.createElement('button');
    sortie.type = 'button';
    sortie.className = 'sa-rail-bouton sa-rail-sortie';
    sortie.setAttribute('aria-label', 'Se déconnecter');
    sortie.setAttribute('data-infobulle', 'Se déconnecter');
    sortie.innerHTML = SA.ui.icone('sortie', 19);
    sortie.addEventListener('click', () => {
      const vrai = document.getElementById('bouton-deconnexion');
      if (vrai) vrai.click();
    });
    piedRail.appendChild(sortie);
  }

  /* Infobulles du rail en position fixe : le rail défile désormais, et un
     conteneur défilant coupe tout pseudo-élément qui en déborde. */
  (function infobullesRail() {
    const rail = document.getElementById('sa-rail');
    if (!rail) return;
    const bulle = document.createElement('div');
    bulle.className = 'sa-infobulle-flottante';
    bulle.setAttribute('aria-hidden', 'true');
    bulle.hidden = true;
    document.body.appendChild(bulle);
    const grandEcran = window.matchMedia('(hover: hover) and (min-width: 981px)');
    const montrer = (cible) => {
      if (!grandEcran.matches) return;
      const texte = cible.getAttribute('data-infobulle');
      if (!texte) return;
      const r = cible.getBoundingClientRect();
      bulle.textContent = texte;
      bulle.style.left = `${Math.round(r.right + 12)}px`;
      bulle.style.top = `${Math.round(r.top + r.height / 2)}px`;
      bulle.hidden = false;
    };
    const cacher = () => { bulle.hidden = true; };
    rail.addEventListener('mouseover', (ev) => { const c = ev.target.closest('[data-infobulle]'); if (c) montrer(c); });
    rail.addEventListener('mouseout', (ev) => { const c = ev.target.closest('[data-infobulle]'); if (c && !c.contains(ev.relatedTarget)) cacher(); });
    rail.addEventListener('focusin', (ev) => { const c = ev.target.closest('[data-infobulle]'); if (c && c.matches(':focus-visible')) montrer(c); });
    rail.addEventListener('focusout', cacher);
    rail.addEventListener('scroll', cacher, true);
    window.addEventListener('resize', cacher);

    // Fondu en haut / en bas quand des domaines sont cachés par le défilement.
    const zone = document.getElementById('sa-rail-domaines');
    if (!zone) return;
    const ombres = () => {
      zone.classList.toggle('sa-defile-haut', zone.scrollTop > 2);
      zone.classList.toggle('sa-defile-bas', zone.scrollTop + zone.clientHeight < zone.scrollHeight - 2);
    };
    zone.addEventListener('scroll', ombres, { passive: true });
    window.addEventListener('resize', ombres);
    requestAnimationFrame(ombres);
    // Le domaine actif reste visible quand on change de section.
    zone.addEventListener('click', (ev) => {
      const b = ev.target.closest('.sa-rail-domaine');
      if (b) b.scrollIntoView({ block: 'nearest' });
    });
  })();

  document.documentElement.classList.add('sa-coque-prete');

  /* ======================================================================
     4. Domaine affiché
     ====================================================================== */

  let domaineAffiche = null;

  function afficherDomaine(id) {
    const d = domaines.find((x) => x.id === id) || domaines[0];
    domaineAffiche = d;
    domaines.forEach((x) => x.element.classList.toggle('sa-domaine-visible', x === d));
    zoneRail.querySelectorAll('[data-domaine-rail]').forEach((b) => {
      const actif = b.getAttribute('data-domaine-rail') === d.id;
      b.setAttribute('aria-selected', String(actif));
      b.classList.toggle('actif', actif);
    });
    return d;
  }

  const mobile = () => window.matchMedia('(max-width: 980px)').matches;

  zoneRail.addEventListener('click', (ev) => {
    const bouton = ev.target.closest('[data-domaine-rail]');
    if (!bouton) return;
    const d = afficherDomaine(bouton.getAttribute('data-domaine-rail'));
    // Sur téléphone, le rail CHOISIT le domaine : on reste dans le tiroir pour
    // choisir la section. Sur ordinateur, on ouvre l'accueil du domaine —
    // sauf si l'écran courant en fait déjà partie.
    if (mobile()) return;
    const courant = SA.routeCourante && trouver(SA.routeCourante.chemin);
    const dansCeDomaine = (courant && courant.domaine === d)
      || (SA.routeCourante && SA.routeCourante.chemin === `espace/${d.id}`);
    if (!dansCeDomaine) SA.naviguer(d.accueil);
  });

  /* ======================================================================
     5. Après chaque rendu : domaine, entrée active, fil d'Ariane, onglets
     ====================================================================== */

  function domaineDeChemin(chemin) {
    const m = /^espace\/([\w-]+)/.exec(chemin || '');
    if (m) return { domaine: domaines.find((d) => d.id === m[1]) || null, item: null };
    const item = trouver(chemin || '');
    return { domaine: item ? item.domaine : null, item };
  }

  function surNavigation(routeCourante, chemin) {
    const { domaine, item } = domaineDeChemin(chemin);
    if (domaine) afficherDomaine(domaine.id);
    else if (!domaineAffiche) afficherDomaine(domaines[0].id);

    // Entrée active : une seule, la plus spécifique.
    panneau.querySelectorAll('.actif').forEach((el) => el.classList.remove('actif'));
    panneau.querySelectorAll('[aria-current]').forEach((el) => el.removeAttribute('aria-current'));
    if (item) {
      item.entree.element.classList.add('actif');
      const lien = item.entree.onglets
        ? item.entree.element.querySelector('.sa-espace-lien')
        : item.entree.element.querySelector('a[data-route]');
      if (lien) { lien.classList.add('actif'); lien.setAttribute('aria-current', 'page'); }
      if (item.groupe.avance && item.groupe.element.tagName === 'DETAILS') item.groupe.element.open = true;
    } else if (domaine) {
      const apercu = domaine.element.querySelector('.sa-domaine-apercu');
      if (apercu) { apercu.classList.add('actif'); apercu.setAttribute('aria-current', 'page'); }
    }
    const lienApp = nav.querySelector('.sa-rail-pied a[data-route="apparence"]');
    if (lienApp) lienApp.classList.toggle('actif', chemin === 'apparence');
    const profil = document.getElementById('sa-rail-profil');
    if (profil) profil.classList.toggle('actif', /^compte\//.test(chemin || ''));

    const titrePage = texte(document.querySelector('#sa-entete h1'));
    poserFil(domaine, item, titrePage, chemin);
    poserOnglets(item);
    document.title = `${titrePage || 'Super Admin'} · Ardoise Admin`;

    fermerTiroir();

    // Mode replié : le panneau reste ouvert tant que le focus est dedans. Une
    // fois l'écran choisi, on le rend à la page, sinon le panneau masquerait
    // le contenu qu'on vient d'ouvrir.
    if (document.documentElement.getAttribute('data-nav-compact') === 'oui'
        && document.activeElement && nav.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  }

  function poserFil(domaine, item, titrePage, chemin) {
    const fil = document.getElementById('sa-fil');
    if (!fil) return;
    const morceaux = [];
    if (domaine) {
      morceaux.push(`<a href="#/espace/${esc(domaine.id)}">${esc(domaine.libelle)}</a>`);
    } else if (chemin === 'apparence' || /^compte\//.test(chemin || '')) {
      morceaux.push('<span>Mon compte</span>');
    }
    if (item && item.entree.onglets) {
      morceaux.push(`<a href="#/${esc(item.entree.route)}">${esc(item.entree.libelle)}</a>`);
    }
    if (titrePage && !(domaine && !item)) {
      morceaux.push(`<span aria-current="page">${esc(titrePage)}</span>`);
    }
    fil.innerHTML = morceaux.join('<span class="sa-fil-sep" aria-hidden="true">/</span>');
  }

  function poserOnglets(item) {
    const entete = document.getElementById('sa-entete');
    if (!entete) return;
    const existants = entete.querySelector('.sa-onglets-espace');
    if (existants) existants.remove();
    if (!item || !item.entree.onglets) return;

    const barre = document.createElement('nav');
    barre.className = 'sa-onglets-espace';
    barre.setAttribute('aria-label', item.entree.libelle);
    barre.innerHTML = item.entree.onglets.map((o) => {
      const actif = item.onglet && item.onglet.route === o.route;
      return `<a href="#/${esc(o.route)}"${actif ? ' class="actif" aria-current="page"' : ''}>${esc(o.libelle)}</a>`;
    }).join('');
    entete.appendChild(barre);
    const actif = barre.querySelector('.actif');
    if (actif && actif.scrollIntoView) actif.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* ======================================================================
     6. Tiroir mobile
     ====================================================================== */

  const boutonNav = document.getElementById('sa-bouton-nav');
  function fermerTiroir() {
    document.body.classList.remove('sa-nav-ouverte');
    if (boutonNav) boutonNav.setAttribute('aria-expanded', 'false');
  }
  if (boutonNav) {
    boutonNav.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const ouvert = document.body.classList.toggle('sa-nav-ouverte');
      boutonNav.setAttribute('aria-expanded', String(ouvert));
    });
  }
  document.addEventListener('click', (ev) => {
    if (document.body.classList.contains('sa-nav-ouverte')
        && !ev.target.closest('.sa-navigation') && !ev.target.closest('#sa-bouton-nav')) {
      fermerTiroir();
    }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && document.body.classList.contains('sa-nav-ouverte')) fermerTiroir();
  });

  /* ======================================================================
     7. Recherche : la barre haute et le rail ouvrent la palette
     ====================================================================== */

  function ouvrirRecherche() {
    if (typeof SA.ouvrirPalette === 'function') SA.ouvrirPalette();
    else SA.naviguer('explorer/recherche');
  }
  ['sa-recherche-globale', 'sa-rail-recherche'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', ouvrirRecherche);
  });

  // « / » ouvre la recherche, sauf pendant une saisie.
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== '/' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const cible = ev.target;
    if (cible && (cible.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName))) return;
    if (!SA.session.connecte()) return;
    ev.preventDefault();
    ouvrirRecherche();
  });

  /* ======================================================================
     8. Pastilles de comptage — les vraies files d'attente
     ----------------------------------------------------------------------
     Quatre listes légères, relues toutes les cinq minutes tant que l'onglet
     est visible. La finance et la supervision coûtent plus cher à calculer :
     elles sont relevées par la tour de contrôle quand elle s'affiche, et lui
     empruntent `SA.coque.majCompteurs`.
     ====================================================================== */

  const compteurs = {};   // cle → { n, ton } ; absent = non mesuré

  /* Les pastilles lisent GET /super-admin/compteurs : quatre `count(*)`. Si le
     serveur en ligne ne connaît pas encore cette route (déploiement décalé du
     frontend et du backend), on retombe sur les listes complètes. */
  const SOURCES_REPLI = {
    renouvellements: async () => {
      const d = await SA.api('/super-admin/renouvellements?statut=a_traiter');
      return { n: (d.donnees || []).length, ton: 'attention' };
    },
    tickets: async () => {
      const d = await SA.api('/super-admin/tickets?taille=1');
      const s = d.statistiques || {};
      return { n: Number(s.ouverts) || 0, ton: Number(s.urgents) ? 'danger' : 'info' };
    },
    prospects: async () => {
      const d = await SA.api('/super-admin/prospects?statut=nouvelle&taille=5');
      return { n: Number((d.compteurs || {}).nouvelle) || 0, ton: 'info' };
    },
    demonstrations: async () => {
      const d = await SA.api('/super-admin/demonstrations-resume');
      return { n: Number(d.a_verifier) || 0, ton: 'attention' };
    }
  };

  let routeCompteursAbsente = false;

  async function lireCompteurs() {
    if (!routeCompteursAbsente) {
      try {
        const d = await SA.api('/super-admin/compteurs');
        const c = (n, ton) => (n === null || n === undefined ? null : { n: Number(n) || 0, ton });
        return {
          renouvellements: c(d.renouvellements, 'attention'),
          tickets: d.tickets ? { n: Number(d.tickets.ouverts) || 0, ton: Number(d.tickets.urgents) ? 'danger' : 'info' } : null,
          prospects: c(d.prospects, 'info'),
          demonstrations: c(d.demonstrations, 'attention')
        };
      } catch (err) {
        if (err.statut !== 404) throw err;
        routeCompteursAbsente = true;
      }
    }
    const cles = Object.keys(SOURCES_REPLI);
    const resultats = await Promise.allSettled(cles.map((c) => SOURCES_REPLI[c]()));
    const valeurs = {};
    resultats.forEach((r, i) => { valeurs[cles[i]] = r.status === 'fulfilled' ? r.value : null; });
    return valeurs;
  }

  function majCompteurs(valeurs) {
    Object.entries(valeurs || {}).forEach(([cle, v]) => {
      if (v === null || v === undefined) delete compteurs[cle];
      else compteurs[cle] = typeof v === 'number' ? { n: v, ton: 'attention' } : v;
    });
    dessinerCompteurs();
  }

  function dessinerCompteurs() {
    domaines.forEach((d) => {
      let total = 0;
      d.groupes.forEach((g) => g.entrees.forEach((e) => {
        if (!e.compteur) return;
        const hote = e.onglets ? e.element.querySelector('.sa-espace-lien') : e.element.querySelector('a[data-route]');
        if (!hote) return;
        let pastille = hote.querySelector('.sa-compteur');
        const c = compteurs[e.compteur];
        if (!c || !c.n) { if (pastille) pastille.remove(); return; }
        if (!pastille) {
          pastille = document.createElement('span');
          hote.appendChild(pastille);
        }
        pastille.className = `sa-compteur ton-${c.ton || 'attention'}`;
        pastille.textContent = c.n > 99 ? '99+' : String(c.n);
        pastille.setAttribute('aria-label', `${c.n} à traiter`);
        total += c.n;
      }));
      const point = zoneRail.querySelector(`[data-domaine-rail="${d.id}"] .sa-rail-point`);
      const bouton = zoneRail.querySelector(`[data-domaine-rail="${d.id}"]`);
      if (point) point.hidden = total === 0;
      if (bouton) {
        bouton.setAttribute('aria-label', total ? `${d.libelle} — ${total} élément(s) à traiter` : d.libelle);
      }
    });
  }

  let minuteur = null;
  async function chargerCompteurs() {
    clearTimeout(minuteur);
    if (!SA.session.connecte()) return;
    if (document.visibilityState === 'visible') {
      try {
        majCompteurs(await lireCompteurs());
      } catch (err) {
        // Mesure impossible : pas de pastille plutôt qu'un zéro rassurant.
        majCompteurs({ renouvellements: null, tickets: null, prospects: null, demonstrations: null });
      }
    }
    minuteur = setTimeout(chargerCompteurs, 5 * 60 * 1000);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && SA.session.connecte()) chargerCompteurs();
  });

  /* ======================================================================
     9. Vues d'ensemble des domaines — #/espace/<domaine>
     ----------------------------------------------------------------------
     Une carte par section, décrite par le sous-titre que l'écran déclare
     lui-même : la description ne peut donc pas diverger de l'écran.
     ====================================================================== */

  function descriptionDe(route) {
    const v = SA.vues.get(route);
    return v && typeof v.sousTitre === 'string' ? v.sousTitre : '';
  }

  SA.enregistrerVue('espace', {
    titre(segments) {
      const d = domaines.find((x) => x.id === (segments || [])[0]);
      return d ? d.libelle : 'Domaines';
    },
    sousTitre: '',

    async rendu(conteneur, params, segments) {
      const d = domaines.find((x) => x.id === (segments || [])[0]);
      if (!d) {
        conteneur.innerHTML = carteDomaines();
        return;
      }
      const sous = document.querySelector('#sa-entete .sa-entete-titres');
      if (sous && d.description) {
        sous.insertAdjacentHTML('beforeend', `<p class="sa-sous-titre">${esc(d.description)}</p>`);
      }

      conteneur.innerHTML = d.groupes.map((g) => `
        <section class="sa-section">
          ${g.titre ? `<h2 class="sa-section-titre">${esc(g.titre)}</h2>` : ''}
          <div class="sa-cartes-sections">
            ${g.entrees.map((e) => {
              const c = e.compteur && compteurs[e.compteur];
              const description = descriptionDe(e.route);
              return `
              <a class="sa-carte-section" href="#/${esc(e.route)}">
                <span class="sa-carte-section-icone">${SA.ui.icone(d.icone, 18)}</span>
                <span class="sa-carte-section-corps">
                  <span class="sa-carte-section-titre">${esc(e.libelle)}
                    ${c && c.n ? `<span class="sa-compteur ton-${esc(c.ton || 'attention')}">${esc(c.n)}</span>` : ''}
                  </span>
                  ${description ? `<span class="sa-carte-section-texte">${esc(description)}</span>` : ''}
                  ${e.onglets ? `<span class="sa-carte-section-onglets">${e.onglets.map((o) => esc(o.libelle)).join(' · ')}</span>` : ''}
                </span>
                <span class="sa-carte-section-fleche">${SA.ui.icone('fleche', 16)}</span>
              </a>`;
            }).join('')}
          </div>
        </section>`).join('');
    }
  });

  /** Grille des domaines — réutilisée par la tour de contrôle. */
  function carteDomaines() {
    return `<div class="sa-cartes-domaines">${domaines.map((d) => {
      const nb = d.groupes.reduce((s, g) => s + g.entrees.reduce((t, e) => t + (e.onglets ? e.onglets.length : 1), 0), 0);
      return `
      <a class="sa-carte-domaine" href="#/${esc(d.accueil)}">
        <span class="sa-carte-domaine-icone">${SA.ui.icone(d.icone, 20)}</span>
        <span class="sa-carte-domaine-titre">${esc(d.libelle)}</span>
        <span class="sa-carte-domaine-texte">${esc(d.description)}</span>
        <span class="sa-carte-domaine-pied">${nb} écran${nb > 1 ? 's' : ''}</span>
      </a>`;
    }).join('')}</div>`;
  }

  /* ======================================================================
     10. Interface publique
     ====================================================================== */

  SA.coque = {
    domaines,
    surNavigation,
    majCompteurs,
    chargerCompteurs,
    carteDomaines,
    compteurs: () => Object.assign({}, compteurs),

    /** Tous les écrans navigables, pour la palette de commandes. */
    ecrans() {
      const liste = [];
      domaines.forEach((d) => {
        liste.push({ groupe: d.libelle, libelle: `${d.libelle} — vue d'ensemble`, route: `espace/${d.id}` });
        d.groupes.forEach((g) => g.entrees.forEach((e) => {
          (e.onglets || [{ route: e.route, libelle: e.libelle }]).forEach((o) => {
            const libelle = e.onglets ? `${e.libelle} — ${o.libelle}` : o.libelle;
            liste.push({ groupe: d.libelle, libelle, route: o.route, description: descriptionDe(o.route) });
          });
        }));
      });
      liste.push({ groupe: 'Mon compte', libelle: 'Apparence', route: 'apparence' });
      liste.push({ groupe: 'Mon compte', libelle: 'Sécurité du compte — double authentification',
        route: 'compte/securite', description: descriptionDe('compte/securite') });
      return liste;
    }
  };

  // Les pastilles se chargent une fois la session ouverte : `demarrer` est
  // appelé après connexion, ou tout de suite si une session existe déjà.
  const demarrerOriginal = SA.demarrer;
  SA.demarrer = async function () {
    const resultat = await demarrerOriginal.apply(this, arguments);
    const profil = SA.session.profil() || {};
    const avatar = document.getElementById('sa-avatar');
    if (avatar) {
      const nom = [profil.prenom, profil.nom].filter(Boolean).join(' ') || profil.email || 'Super Admin';
      const initiales = nom.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('');
      avatar.textContent = initiales || 'SA';
      const bouton = document.getElementById('sa-rail-profil');
      if (bouton) bouton.setAttribute('data-infobulle', profil.email || 'Mon compte');
    }
    chargerCompteurs();
    lireEtatMfa();
    return resultat;
  };

  /* Un compte Super Admin sans second facteur est signalé dans le menu du
     compte. Silencieux si le serveur ne connaît pas encore la route. */
  async function lireEtatMfa() {
    const zone = document.getElementById('sa-compte-mfa');
    if (!zone) return;
    try {
      const d = await SA.api('/super-admin/mfa');
      const aActiver = d.migration_appliquee && !d.active;
      zone.className = aActiver ? 'sa-compteur ton-attention' : 'sa-compte-mfa';
      zone.textContent = aActiver ? 'à activer' : '';
      const point = document.querySelector('#sa-rail-profil .sa-rail-point');
      if (point) point.hidden = !aActiver;
    } catch (e) { zone.textContent = ''; }
  }
  SA.coque.lireEtatMfa = lireEtatMfa;
})();
