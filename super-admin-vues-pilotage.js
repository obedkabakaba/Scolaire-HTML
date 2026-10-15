/* ==========================================================================
   Ardoise — Super Admin : tour de contrôle, analyses, rapports
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui, graphe } = SA;

  /** Transforme une série {jour, valeur} en points de courbe. */
  function points(serie, cleX, cleY) {
    return (serie || []).map((d) => ({
      x: formaterAbscisse(d[cleX || 'jour']),
      y: Number(d[cleY || 'valeur']) || 0
    }));
  }

  function formaterAbscisse(v) {
    const texte = String(v || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(texte)) {
      const d = new Date(texte);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    }
    if (/^\d{4}-\d{2}$/.test(texte)) {
      const d = new Date(texte + '-01');
      return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    }
    return texte;
  }

  /* ======================================================================
     Tour de contrôle — la page d'accueil de l'espace
     ----------------------------------------------------------------------
     Trois questions, dans cet ordre, et rien d'autre en haut de page :

       1. La plateforme va-t-elle bien ?          → bandeau d'état
       2. Qu'est-ce qui m'attend ?                 → file « À traiter »
       3. Comment évolue-t-elle ?                  → indicateurs et tendance

     Le détail (douze compteurs, quatre courbes) reste disponible dans
     « Analyses » et dans chaque domaine : la page d'accueil choisit, elle ne
     déverse pas.

     AUCUN CHIFFRE INVENTÉ
     ---------------------
     Chaque bloc lit une route qui existe déjà. Les sources sont interrogées
     séparément (`Promise.allSettled`) : si le Control Center ou la finance ne
     répondent pas, leur bloc le DIT et le reste de la page s'affiche. Une file
     dont la source a échoué n'est jamais présentée comme vide.

     L'ancienne page affichait « Base de données : connectée » en dur, sans
     rien mesurer, et titrait « Revenus d'abonnement » une somme de paiements
     de devises différentes additionnés sans conversion. Les deux ont disparu.
     ====================================================================== */

  const SOURCES_ACCUEIL = {
    tdb: { libelle: 'tableau de bord plateforme', appel: () => SA.api('/super-admin/tableau-de-bord') },
    cc: { libelle: 'synthèse technique (Control Center)', appel: () => SA.api('/super-admin/control-center/synthese') },
    renouv: { libelle: 'renouvellements', appel: () => SA.api('/super-admin/renouvellements?statut=a_traiter') },
    tickets: { libelle: 'tickets de support', appel: () => SA.api('/super-admin/tickets?taille=1') },
    prospects: { libelle: 'demandes du site public', appel: () => SA.api('/super-admin/prospects?statut=nouvelle&taille=5') },
    demos: { libelle: 'démonstrations', appel: () => SA.api('/super-admin/demonstrations-resume') },
    finAlertes: { libelle: 'alertes financières', appel: () => SA.api('/super-admin/finance/alertes') },
    finance: { libelle: 'tableau financier', appel: () => SA.api('/super-admin/finance/tableau-de-bord') },
    mfa: { libelle: 'double authentification', appel: () => SA.api('/super-admin/mfa') }
  };

  /* Les files sont triées par urgence : au-delà de huit tuiles, les suivantes
     attendent un clic. Une page d'accueil qui montre tout à égalité ne
     hiérarchise plus rien. */
  const VISIBLES_FILE = 8;
  const icone = (nom, taille) => (SA.ui.icone ? SA.ui.icone(nom, taille) : '');
  const n = (v) => Number(v) || 0;

  function tonScore(v) {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) return 'neutre';
    return v >= 90 ? 'succes' : v >= 75 ? 'attention' : 'danger';
  }

  /** Les files d'attente réelles, transformées en tuiles. Une file vide n'apparaît pas. */
  function fileATraiter(r) {
    const taches = [];
    const ajouter = (t) => { if (t.nombre > 0) taches.push(t); };

    if (r.renouv) {
      const lignes = r.renouv.donnees || [];
      const plusAncien = lignes.reduce((min, l) => (l.created_at && (!min || l.created_at < min) ? l.created_at : min), null);
      ajouter({ nombre: lignes.length, libelle: 'Renouvellements à valider', icone: 'portefeuille', ton: 'attention',
        detail: plusAncien ? `Le plus ancien déclaré ${fmt.relatif(plusAncien)}` : 'Paiements déclarés et passages d’agent',
        route: 'renouvellements' });
    }
    if (r.tickets) {
      const s = r.tickets.statistiques || {};
      const urgents = n(s.urgents);
      ajouter({ nombre: n(s.ouverts), libelle: 'Tickets ouverts', icone: 'bulle', ton: urgents ? 'danger' : 'info',
        detail: urgents ? `${urgents} urgent${urgents > 1 ? 's' : ''}` : `${fmt.nombre(n(s.en_cours))} en cours de traitement`,
        route: 'support' });
    }
    if (r.prospects) {
      ajouter({ nombre: n((r.prospects.compteurs || {}).nouvelle), libelle: 'Nouvelles demandes', icone: 'bulle', ton: 'info',
        detail: 'Site public, en attente d’une première réponse', route: 'prospects', params: { statut: 'nouvelle' } });
    }
    if (r.demos) {
      ajouter({ nombre: n(r.demos.a_verifier), libelle: 'Démonstrations à vérifier', icone: 'croissance', ton: 'attention',
        detail: 'Essais en attente de validation', route: 'demonstrations' });
      ajouter({ nombre: n(r.demos.expirent_bientot), libelle: 'Essais expirant sous 48 h', icone: 'horloge', ton: 'info',
        detail: 'Le bon moment pour proposer une offre', route: 'demonstrations' });
    }
    if (r.cc) {
      const p = (r.cc.priorites || {}).par_palier || {};
      const e = r.cc.etat || {};
      ajouter({ nombre: n(p.immediat), libelle: 'Écarts à traiter immédiatement', icone: 'alerte', ton: 'danger',
        detail: 'Priorité calculée par le moteur d’audit', route: 'cc/constats', params: { urgence: 'immediat' } });
      ajouter({ nombre: (e.incidents_ouverts || []).length, libelle: 'Incidents ouverts', icone: 'alerte', ton: 'danger',
        detail: 'Pannes en cours, avec leur chronologie', route: 'cc/incidents' });
      const echecs = (e.verifications || []).filter((v) => v.statut === 'echec').length;
      ajouter({ nombre: echecs, libelle: 'Vérifications en échec', icone: 'pouls', ton: 'danger',
        detail: 'Contrôles automatiques de bon fonctionnement', route: 'cc/verifications' });
      ajouter({ nombre: n(e.alertes_actives), libelle: 'Alertes techniques', icone: 'pouls', ton: 'attention',
        detail: 'Non acquittées', route: 'cc/alertes' });
    }
    if (r.finAlertes) {
      const c = r.finAlertes.compteurs || {};
      const critiques = n(c.critiques);
      ajouter({ nombre: critiques + n(c.avertissements), libelle: 'Alertes financières', icone: 'portefeuille',
        ton: critiques ? 'danger' : 'attention',
        detail: critiques ? `${critiques} critique${critiques > 1 ? 's' : ''}` : 'Marge, budgets, échéances',
        route: 'finance/alertes' });
    }
    if (r.tdb) {
      const e = r.tdb.ecoles || {};
      ajouter({ nombre: n(e.abonnements_expirant), libelle: 'Abonnements expirant sous 14 j', icone: 'horloge', ton: 'attention',
        detail: 'À relancer avant l’échéance', route: 'ecoles/abonnements' });
      ajouter({ nombre: n(e.suspendues), libelle: 'Écoles suspendues', icone: 'ecole', ton: 'danger',
        detail: 'Sans accès à la plateforme', route: 'ecoles', params: { statut: 'suspendu' } });
    }

    const rang = { danger: 0, attention: 1, info: 2 };
    return taches.sort((a, b) => (rang[a.ton] - rang[b.ton]) || (b.nombre - a.nombre));
  }

  function lienRoute(route, params) {
    const q = params && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
    return `#/${route}${q}`;
  }

  function serie(courbe) {
    return (courbe || []).map((p) => ({ x: formaterAbscisse(p.jour), y: Number(p.valeur) || 0 }));
  }

  SA.enregistrerVue('tableau-de-bord', {
    titre: 'Tour de contrôle',
    sousTitre: "Ce qui demande votre attention, l'état de la plateforme et ses tendances.",

    async rendu(conteneur) {
      conteneur.innerHTML = `<div class="tc-accueil">
        ${ui.squelette(1, 64)}${ui.squeletteCartes(4)}${ui.squeletteCartes(6)}${ui.squelette(2, 220)}</div>`;

      const cles = Object.keys(SOURCES_ACCUEIL);
      const reponses = await Promise.allSettled(cles.map((c) => SOURCES_ACCUEIL[c].appel()));
      const r = {};
      const echecs = [];
      reponses.forEach((rep, i) => {
        if (rep.status === 'fulfilled') r[cles[i]] = rep.value;
        else echecs.push({ cle: cles[i], erreur: rep.reason });
      });

      // Rien n'a répondu : c'est une panne, pas une page vide.
      if (echecs.length === cles.length) {
        throw echecs[0].erreur instanceof SA.ErreurApi ? echecs[0].erreur : new SA.ErreurApi('Aucune source ne répond.', 0);
      }

      if (r.finance && r.finance.devise_reference && SA.finance) SA.finance.devise(r.finance.devise_reference);

      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `
          <span class="sa-muet" style="font-size:.78rem">Mis à jour ${esc(fmt.relatif((r.tdb && r.tdb.genere_a) || new Date()))}</span>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="tc-actualiser">${icone('rafraichir', 14)} Actualiser</button>`;
        const btn = document.getElementById('tc-actualiser');
        if (btn) btn.addEventListener('click', () => SA.rafraichirVue());
      }

      const taches = fileATraiter(r);
      const sourcesFile = ['renouv', 'tickets', 'prospects', 'demos', 'cc', 'finAlertes', 'tdb'];
      const filesKo = echecs.filter((x) => sourcesFile.includes(x.cle)).map((x) => SOURCES_ACCUEIL[x.cle].libelle);

      // Les pastilles du menu suivent ce que la page vient de mesurer.
      if (SA.coque) {
        const cc = r.cc && r.cc.etat;
        const fa = r.finAlertes && r.finAlertes.compteurs;
        SA.coque.majCompteurs({
          renouvellements: r.renouv ? { n: (r.renouv.donnees || []).length, ton: 'attention' } : undefined,
          finance: fa ? { n: n(fa.critiques) + n(fa.avertissements), ton: n(fa.critiques) ? 'danger' : 'attention' } : undefined,
          supervision: cc ? { n: (cc.incidents_ouverts || []).length + n(cc.alertes_actives),
                              ton: (cc.incidents_ouverts || []).length ? 'danger' : 'attention' } : undefined
        });
      }

      conteneur.innerHTML = `<div class="tc-accueil">
        ${blocEtat(r)}
        ${blocSecuriteCompte(r)}
        <section>
          <div class="tc-titre-bloc">
            <h2>À traiter</h2>
            <span class="tc-annexe">${taches.length ? `${taches.length} file${taches.length > 1 ? 's' : ''} en attente` : ''}</span>
          </div>
          ${taches.length ? `<div class="tc-file" id="tc-file">${taches.map((t, i) => `
            <a class="tc-tache ton-${esc(t.ton)}" href="${esc(lienRoute(t.route, t.params))}"${i >= VISIBLES_FILE ? ' hidden' : ''}>
              <span class="tc-tache-haut"><span class="tc-tache-nombre">${esc(fmt.nombre(t.nombre))}</span>${icone(t.icone, 18)}</span>
              <span class="tc-tache-libelle">${esc(t.libelle)}</span>
              <span class="tc-tache-detail">${esc(t.detail)}</span>
            </a>`).join('')}</div>
            ${taches.length > VISIBLES_FILE ? `<button type="button" class="tc-plus" id="tc-plus" aria-controls="tc-file">
              Afficher ${taches.length - VISIBLES_FILE} autre${taches.length - VISIBLES_FILE > 1 ? 's' : ''} file${taches.length - VISIBLES_FILE > 1 ? 's' : ''} moins urgente${taches.length - VISIBLES_FILE > 1 ? 's' : ''}</button>` : ''}`
          : `<div class="tc-calme">${icone('valide', 22)}<span>Rien n'attend de décision dans les files mesurées.
              ${filesKo.length ? 'Certaines sources n’ont pas répondu : voir ci-dessous.' : ''}</span></div>`}
          ${filesKo.length ? `<p class="tc-sources-ko">Non mesuré, faute de réponse : ${filesKo.map(esc).join(' · ')}.
              Ces files peuvent contenir des éléments.</p>` : ''}
        </section>

        ${blocIndicateurs(r)}

        <div class="tc-grille">
          ${blocTendance(r)}
          ${blocPlateforme(r)}
        </div>

        <div class="tc-grille tc-grille-egale">
          ${blocEcolesASurveiller(r)}
          ${blocAlertesFinance(r)}
          ${blocPrioritesTechniques(r)}
        </div>

        <section>
          <div class="tc-titre-bloc"><h2>Tous les espaces</h2>
            <span class="tc-annexe">Ou Ctrl K pour aller directement à un écran</span></div>
          ${SA.coque ? SA.coque.carteDomaines() : ''}
        </section>
      </div>`;

      brancherTendance(conteneur, r);
      const plus = conteneur.querySelector('#tc-plus');
      if (plus) plus.addEventListener('click', () => {
        conteneur.querySelectorAll('#tc-file .tc-tache[hidden]').forEach((t) => { t.hidden = false; });
        plus.remove();
      });
    }
  });

  function blocEtat(r) {
    if (!r.cc) {
      return `<div class="tc-bandeau">
        <div class="tc-bandeau-etat"><span class="tc-voyant"></span>
          <div><div class="tc-bandeau-titre">État technique non mesuré</div>
          <div class="tc-bandeau-detail">La synthèse du Control Center n'a pas répondu : aucun verdict n'est affiché à sa place.</div></div>
        </div>
        <div class="tc-bandeau-actions"><a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="#/sante">Santé des services</a></div>
      </div>`;
    }
    const s = r.cc.scores || {};
    const e = r.cc.etat || {};
    const api = e.api || {};
    const incidents = (e.incidents_ouverts || []).length;
    let ton = tonScore(s.global);
    let titre = ton === 'succes' ? 'Plateforme opérationnelle'
      : ton === 'attention' ? 'Plateforme sous surveillance'
      : ton === 'danger' ? 'Plateforme dégradée' : 'Score non calculé';
    if (incidents) { ton = 'danger'; titre = `${incidents} incident${incidents > 1 ? 's' : ''} en cours`; }
    if (r.cc.maintenance_active) { ton = 'attention'; titre = 'Mode maintenance actif — les écoles n’ont pas accès'; }

    const details = [];
    if (Number.isFinite(Number(s.global))) details.push(`Score global ${s.global}/100`);
    if (api.requetes !== 0 && api.taux_erreur !== undefined && api.taux_erreur !== null) details.push(`${fmt.pourcent(api.taux_erreur)} d'erreurs sur 60 min`);
    if (api.latence_p95_ms) details.push(`p95 ${fmt.duree(api.latence_p95_ms)}`);
    if ((s.sources_indisponibles || []).length) details.push('périmètre de mesure incomplet');

    return `<div class="tc-bandeau">
      <div class="tc-bandeau-etat"><span class="tc-voyant ton-${esc(ton)}"></span>
        <div><div class="tc-bandeau-titre">${esc(titre)}</div>
        <div class="tc-bandeau-detail">${esc(details.join(' · ') || 'Aucune mesure récente')}</div></div>
      </div>
      <div class="tc-bandeau-actions">
        ${r.cc.maintenance_active ? '<a class="sa-bouton sa-bouton-principal sa-bouton-petit" href="#/cc/maintenance">Gérer la maintenance</a>' : ''}
        <a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="#/cc">Vue technique</a>
      </div>
    </div>`;
  }

  /* Le compte qui voit toutes les écoles, protégé par un seul mot de passe :
     c'est le premier risque de la plateforme, il passe avant les tendances. */
  function blocSecuriteCompte(r) {
    if (!r.mfa || !r.mfa.migration_appliquee || r.mfa.active) return '';
    return `<div class="tc-bandeau tc-bandeau-securite">
      <div class="tc-bandeau-etat"><span class="tc-voyant ton-attention"></span>
        <div><div class="tc-bandeau-titre">Votre compte n'est protégé que par un mot de passe</div>
        <div class="tc-bandeau-detail">Activez la double authentification : un mot de passe volé ne suffira plus à ouvrir l'espace qui voit toutes les écoles.</div></div>
      </div>
      <div class="tc-bandeau-actions"><a class="sa-bouton sa-bouton-principal sa-bouton-petit" href="#/compte/securite">Activer</a></div>
    </div>`;
  }

  function kpi({ libelle, valeur, detail, tonDetail, route }) {
    const balise = route ? 'a' : 'div';
    return `<${balise} class="tc-kpi"${route ? ` href="#/${esc(route)}"` : ''}>
      <span class="tc-kpi-libelle">${esc(libelle)}</span>
      <span class="tc-kpi-valeur">${valeur}</span>
      ${detail ? `<span class="tc-kpi-detail${tonDetail ? ' ton-' + esc(tonDetail) : ''}">${detail}</span>` : ''}
    </${balise}>`;
  }

  function blocIndicateurs(r) {
    const cartes = [];
    if (r.tdb) {
      const e = r.tdb.ecoles || {};
      const p = r.tdb.personnes || {};
      const a = r.tdb.activite || {};
      cartes.push(kpi({ libelle: 'Écoles actives', valeur: esc(fmt.nombre(e.actives)), route: 'ecoles',
        detail: `sur ${esc(fmt.nombre(e.total))} · ${esc(fmt.nombre(e.en_essai))} en essai` }));
      cartes.push(kpi({ libelle: 'Élèves actifs', valeur: esc(fmt.nombre(p.eleves)), route: 'analyses',
        detail: `${esc(fmt.nombre(p.professeurs))} enseignants · ${esc(fmt.nombre(p.parents))} parents` }));
      cartes.push(kpi({ libelle: 'Sessions ouvertes', valeur: esc(fmt.nombre(a.sessions_ouvertes)), route: 'securite',
        detail: `${esc(fmt.nombre(a.connexions_aujourdhui))} connexions aujourd'hui` }));
      cartes.push(kpi({ libelle: 'Bulletins ce mois', valeur: esc(fmt.nombre(a.bulletins_ce_mois)), route: 'analyses',
        detail: `${esc(fmt.nombre(a.bulletins_generes))} au total` }));
    }
    if (r.finance && SA.finance) {
      const rev = r.finance.revenus || {};
      const res = r.finance.resultat || {};
      const marge = res.marge_mensuelle;
      cartes.push(kpi({ libelle: 'Revenu récurrent mensuel', valeur: SA.finance.argent(rev.mrr, 0), route: 'finance',
        detail: `ARR ${SA.finance.argent(rev.arr, 0)}` }));
      cartes.push(kpi({ libelle: 'Marge estimée du mois', valeur: SA.finance.pourcent(marge), route: 'finance/rentabilite',
        detail: marge === null || marge === undefined ? 'Revenu récurrent nul : marge non calculable' : 'Revenu récurrent moins coûts du mois',
        tonDetail: marge !== null && marge !== undefined && marge < 0 ? 'danger' : null }));
    }
    if (!cartes.length) return '';
    return `<section>
      <div class="tc-titre-bloc"><h2>Indicateurs clés</h2>
        ${!r.finance ? '<span class="tc-annexe">Indicateurs financiers indisponibles</span>' : ''}</div>
      <div class="tc-kpis">${cartes.join('')}</div>
    </section>`;
  }

  /* Une seule courbe affichée à la fois : quatre graphiques côte à côte se
     lisent mal et se comparent encore plus mal, leurs échelles n'ayant rien
     de commun. */
  const SERIES_TENDANCE = [
    { cle: 'connexions', libelle: 'Connexions', cumul: false, unite: 'connexions sur 30 jours', couleur: 'var(--encre)' },
    { cle: 'ecoles', libelle: 'Écoles', cumul: true, unite: 'écoles inscrites', couleur: 'var(--ocre)' },
    { cle: 'eleves', libelle: 'Élèves', cumul: true, unite: 'élèves inscrits', couleur: 'var(--vert-ok)' },
    { cle: 'paiements', libelle: 'Encaissements', cumul: false, unite: 'encaissés sur 30 jours (montants bruts)', couleur: 'var(--ocre-dark)' }
  ];

  function blocTendance(r) {
    if (!r.tdb) {
      return `<section class="tc-carte"><div class="tc-titre-bloc"><h2>Activité sur 30 jours</h2></div>
        <p class="tc-indisponible">Courbes indisponibles : le tableau de bord plateforme n'a pas répondu.</p></section>`;
    }
    return `<section class="tc-carte" id="tc-tendance">
      <div class="tc-titre-bloc">
        <h2>Activité sur 30 jours</h2>
        <div class="tc-segments" role="group" aria-label="Série affichée">
          ${SERIES_TENDANCE.map((s, i) => `<button type="button" data-serie="${esc(s.cle)}" aria-pressed="${i === 0}">${esc(s.libelle)}</button>`).join('')}
        </div>
      </div>
      <div id="tc-tendance-corps"></div>
    </section>`;
  }

  function brancherTendance(conteneur, r) {
    const carte = conteneur.querySelector('#tc-tendance');
    if (!carte || !r.tdb) return;
    const corps = carte.querySelector('#tc-tendance-corps');
    const courbes = r.tdb.courbes || {};

    function dessiner(cle) {
      const def = SERIES_TENDANCE.find((s) => s.cle === cle) || SERIES_TENDANCE[0];
      const points = serie(courbes[def.cle]);
      let chiffre = '—';
      let annexe = def.unite;
      if (points.length) {
        if (def.cumul) {
          const dernier = points[points.length - 1].y;
          const ecart = dernier - points[0].y;
          chiffre = fmt.nombre(dernier);
          annexe = `${def.unite} · ${ecart >= 0 ? '+' : ''}${fmt.nombre(ecart)} en 30 jours`;
        } else {
          chiffre = fmt.nombre(points.reduce((s, p) => s + p.y, 0));
        }
      }
      corps.innerHTML = `
        <div class="tc-chiffre-courbe"><strong>${esc(chiffre)}</strong><span>${esc(annexe)}</span></div>
        ${graphe.courbe([{ nom: def.libelle, points, couleur: def.couleur }], { titre: def.libelle, hauteur: 200 })}
        ${def.cle === 'paiements' ? `<p class="tc-note">Somme brute des paiements confirmés, toutes devises
          confondues et sans conversion. Les montants convertis sont dans <a class="tc-lien" href="#/finance">Finance</a>.</p>` : ''}`;
      carte.querySelectorAll('[data-serie]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-serie') === def.cle)));
    }

    carte.querySelectorAll('[data-serie]').forEach((b) => b.addEventListener('click', () => dessiner(b.getAttribute('data-serie'))));
    dessiner(SERIES_TENDANCE[0].cle);
  }

  function blocPlateforme(r) {
    const lignes = [];
    const sys = r.tdb && r.tdb.systeme;
    let haut = '';

    if (r.cc) {
      const s = r.cc.scores || {};
      const e = r.cc.etat || {};
      const axes = [['sante', 'Santé'], ['securite', 'Sécurité'], ['performance', 'Performance'], ['donnees', 'Données']];
      haut = `
        <div class="tc-score">
          <div class="tc-score-valeur">${Number.isFinite(Number(s.global)) ? esc(s.global) : '—'}<small>/100</small></div>
          <div class="tc-score-libelle">Score global, plafonné par l'axe le plus faible.
            <a class="tc-lien" href="#/cc">Décomposition</a></div>
        </div>
        <div class="tc-axes">${axes.map(([cle, lib]) => {
          const v = Number(s[cle]);
          const ok = Number.isFinite(v);
          return `<div class="tc-axe"><span>${esc(lib)}</span>
            <span class="tc-piste"><span class="ton-${esc(tonScore(v))}" style="width:${ok ? Math.max(0, Math.min(100, v)) : 0}%"></span></span>
            <strong>${ok ? esc(v) : '—'}</strong></div>`;
        }).join('')}</div>`;
      const api = e.api || {};
      lignes.push(['Erreurs serveur sur 24 h', esc(fmt.nombre(e.bugs_24h))]);
      lignes.push(['Latence p95', esc(fmt.duree(api.latence_p95_ms))]);
    } else if (sys) {
      lignes.push(["Taux d'erreur (15 min)", esc(fmt.pourcent(sys.api && sys.api.taux_erreur))]);
      lignes.push(['Latence moyenne', esc(fmt.duree(sys.api && sys.api.latence_moyenne_ms))]);
    }
    if (sys) {
      lignes.push(['Processus démarré depuis', esc(fmt.dureeSecondes(sys.serveur && sys.serveur.uptime_secondes))]);
      lignes.push(['Dernière sauvegarde réussie', sys.derniere_sauvegarde
        ? esc(fmt.relatif(sys.derniere_sauvegarde)) : '<span class="sa-badge ton-attention">aucune</span>']);
    }
    if (r.tdb && r.tdb.supervision) {
      lignes.push(['Bugs ouverts', esc(fmt.nombre(r.tdb.supervision.bugs_ouverts))]);
    }

    return `<section class="tc-carte">
      <div class="tc-titre-bloc"><h2>État de la plateforme</h2><a class="tc-lien" href="#/cc">Supervision ${icone('fleche', 13)}</a></div>
      ${haut || '<p class="tc-indisponible">Scores indisponibles : la synthèse technique n\'a pas répondu.</p>'}
      <div class="tc-lignes">${lignes.map(([a, b]) => `<div class="tc-ligne"><span>${esc(a)}</span><span>${b}</span></div>`).join('')}</div>
      ${r.cc && r.cc.avertissement_metriques ? `<p class="tc-note">${esc(r.cc.avertissement_metriques)}</p>` : ''}
    </section>`;
  }

  function carteListe(titre, lien, contenu) {
    return `<section class="tc-carte">
      <div class="tc-titre-bloc"><h2>${esc(titre)}</h2>${lien}</div>
      ${contenu}
    </section>`;
  }

  function tonNiveau(niveau) {
    return niveau === 'critique' ? 'danger' : niveau === 'avertissement' ? 'attention' : 'info';
  }

  function blocEcolesASurveiller(r) {
    const lien = '<a class="tc-lien" href="#/ecoles">Toutes les écoles</a>';
    if (!r.tdb) return carteListe('Écoles à surveiller', lien, '<p class="tc-indisponible">Source indisponible.</p>');
    const alertes = r.tdb.alertes || [];
    if (!alertes.length) {
      return carteListe('Écoles à surveiller', lien,
        '<p class="tc-indisponible">Aucune école suspendue, inactive depuis 30 jours ou en fin d\'abonnement.</p>');
    }
    const rang = { critique: 0, avertissement: 1, info: 2 };
    const tries = alertes.slice().sort((a, b) => (rang[a.niveau] ?? 3) - (rang[b.niveau] ?? 3));
    return carteListe('Écoles à surveiller', lien, `<div class="tc-liste">
      ${tries.slice(0, 6).map((al) => `
        <a class="tc-element" href="#/explorer/ecole/${esc(al.ecole_id)}">
          <span class="tc-voyant ton-${esc(tonNiveau(al.niveau))}"></span>
          <span class="tc-element-corps"><span class="tc-element-titre">${esc(al.libelle)}</span>
          <span class="tc-element-detail">${esc(al.detail)}</span></span>
        </a>`).join('')}
      ${alertes.length > 6 ? `<p class="tc-note">${esc(alertes.length - 6)} autre(s) dans la liste des écoles.</p>` : ''}
    </div>`);
  }

  function blocAlertesFinance(r) {
    const lien = '<a class="tc-lien" href="#/finance/alertes">Toutes les alertes</a>';
    if (!r.finAlertes) return carteListe('Alertes financières', lien, '<p class="tc-indisponible">Source indisponible.</p>');
    const liste = r.finAlertes.alertes || [];
    if (!liste.length) return carteListe('Alertes financières', lien, '<p class="tc-indisponible">Aucune alerte : marge, budgets et échéances dans les seuils.</p>');
    return carteListe('Alertes financières', lien, `<div class="tc-liste">
      ${liste.slice(0, 5).map((al) => `
        <a class="tc-element" href="#/${esc(al.lien || 'finance/alertes')}">
          <span class="tc-voyant ton-${esc(tonNiveau(al.niveau))}"></span>
          <span class="tc-element-corps"><span class="tc-element-titre">${esc(al.titre)}</span>
          <span class="tc-element-detail">${esc(al.detail)}</span></span>
        </a>`).join('')}
    </div>`);
  }

  function blocPrioritesTechniques(r) {
    const lien = '<a class="tc-lien" href="#/cc/constats">Tous les écarts</a>';
    if (!r.cc) return carteListe('Priorités techniques', lien, '<p class="tc-indisponible">Source indisponible.</p>');
    const top = (r.cc.priorites || {}).top || [];
    const incidents = (r.cc.etat || {}).incidents_ouverts || [];
    if (!top.length && !incidents.length) {
      return carteListe('Priorités techniques', lien,
        '<p class="tc-indisponible">Aucun écart ouvert ni incident. Si aucun audit n\'a encore tourné, lancez-en un depuis la vue technique.</p>');
    }
    return carteListe('Priorités techniques', lien, `<div class="tc-liste">
      ${incidents.slice(0, 2).map((i) => `
        <a class="tc-element" href="#/cc/incidents/${esc(i.id)}">
          <span class="tc-voyant ton-danger"></span>
          <span class="tc-element-corps"><span class="tc-element-titre">${esc(i.code)} — ${esc(i.titre)}</span>
          <span class="tc-element-detail">Incident ${esc(String(i.statut || '').replace(/_/g, ' '))}, depuis ${esc(fmt.relatif(i.debut))}</span></span>
        </a>`).join('')}
      ${top.slice(0, Math.max(0, 5 - Math.min(2, incidents.length))).map((c) => `
        <a class="tc-element" href="#/cc/constats/${esc(c.id)}">
          <span class="tc-voyant ton-${esc(SA.ui.tonStatut(c.gravite))}"></span>
          <span class="tc-element-corps"><span class="tc-element-titre">${esc(c.titre)}</span>
          <span class="tc-element-detail">${esc(c.type)} · gravité ${esc(c.gravite)}${c.confiance === 'hypothese' ? ' · hypothèse' : ''}</span></span>
        </a>`).join('')}
    </div>`);
  }

  /* ======================================================================
     Analyses
     ====================================================================== */

  SA.enregistrerVue('analyses', {
    titre: 'Analyses',
    sousTitre: "Croissance, usage, résultats scolaires et assiduité.",

    async rendu(conteneur, params) {
      const jours = params.jours || '90';
      const ecoleId = params.ecole_id || '';

      const barre = document.createElement('div');
      conteneur.innerHTML = '';
      conteneur.appendChild(barre);

      const zone = document.createElement('div');
      zone.innerHTML = ui.squelette(4, 190);
      conteneur.appendChild(zone);

      SA.ui.barreFiltres(barre, [
        {
          type: 'select', nom: 'jours', libelle: 'Période', valeur: jours,
          options: [
            { valeur: '30', libelle: '30 derniers jours' },
            { valeur: '90', libelle: '3 derniers mois' },
            { valeur: '180', libelle: '6 derniers mois' },
            { valeur: '365', libelle: '12 derniers mois' }
          ]
        },
        { type: 'ecoles', nom: 'ecole_id', libelle: 'Toutes les écoles', valeur: ecoleId }
      ], (valeurs) => SA.naviguer('analyses', valeurs));

      const d = await SA.api(SA.url('/super-admin/analyses', { jours, ecole_id: ecoleId }));

      const connexionsRole = (d.connexions_par_role || [])
        .map((r) => ({ libelle: fmt.role(r.libelle), valeur: Number(r.valeur) }));

      zone.innerHTML = `
        <div class="sa-grille-2">
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Croissance des écoles</h3>
            ${graphe.courbe([{ nom: 'Écoles', points: points(d.croissance_ecoles, 'periode') }])}
          </div>
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Nouvelles inscriptions d'élèves</h3>
            ${graphe.courbe([{ nom: 'Inscriptions', points: points(d.inscriptions, 'periode'), couleur: 'var(--vert-ok)' }])}
          </div>
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Revenus d'abonnement</h3>
            ${graphe.courbe([{ nom: 'Montant', points: points(d.paiements, 'periode'), couleur: 'var(--ocre-dark)' }])}
          </div>
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Activité de la plateforme</h3>
            ${graphe.courbe([
              { nom: 'Actions', points: points(d.activite_quotidienne, 'periode') },
              { nom: 'Connexions', points: points(d.activite_quotidienne, 'periode', 'connexions'), couleur: 'var(--encre)' }
            ], { aire: false })}
          </div>
        </div>

        <div class="sa-grille-2" style="margin-top:16px">
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Connexions par rôle</h3>
            ${graphe.barres(connexionsRole)}
          </div>
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Modules les plus utilisés <span class="sa-annexe">30 jours</span></h3>
            ${graphe.barres((d.utilisation_modules || []).map((m) => ({ libelle: m.module, valeur: Number(m.valeur) })), { couleur: 'var(--encre)' })}
          </div>
        </div>

        <div class="sa-section" style="margin-top:24px">
          <h2 class="sa-section-titre">Fréquentation <span class="sa-annexe">taux de présence par période</span></h2>
          ${(d.frequentation && d.frequentation.length)
            ? graphe.courbe([{
                nom: 'Taux de présence',
                points: (d.frequentation || []).map((f) => ({ x: formaterAbscisse(f.periode), y: Number(f.taux_presence) || 0 })),
                couleur: 'var(--vert-ok)'
              }])
            : ui.etatVide('Aucun relevé de présence sur la période')}
        </div>

        <div class="sa-grille-2" style="margin-top:16px">
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Taux de réussite par école</h3>
            ${ui.tableau({
              colonnes: [
                { cle: 'ecole', titre: 'École' },
                { cle: 'bulletins', titre: 'Bulletins', classe: 'sa-num', rendu: (l) => fmt.nombre(l.bulletins) },
                { cle: 'moyenne', titre: 'Moyenne', classe: 'sa-num', rendu: (l) => fmt.pourcent(l.moyenne) },
                { cle: 'taux_reussite', titre: 'Réussite', classe: 'sa-num',
                  rendu: (l) => ui.badge(fmt.pourcent(l.taux_reussite), Number(l.taux_reussite) >= 60 ? 'succes' : Number(l.taux_reussite) >= 40 ? 'attention' : 'danger') }
              ],
              lignes: d.taux_reussite_par_ecole || [],
              vide: 'Aucun bulletin calculé'
            })}
          </div>
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Taux d'absence par école <span class="sa-annexe">90 jours</span></h3>
            ${ui.tableau({
              colonnes: [
                { cle: 'ecole', titre: 'École' },
                { cle: 'total', titre: 'Relevés', classe: 'sa-num', rendu: (l) => fmt.nombre(l.total) },
                { cle: 'absences', titre: 'Absences', classe: 'sa-num', rendu: (l) => fmt.nombre(l.absences) },
                { cle: 'taux_absence', titre: 'Taux', classe: 'sa-num',
                  rendu: (l) => ui.badge(fmt.pourcent(l.taux_absence), Number(l.taux_absence) > 15 ? 'danger' : Number(l.taux_absence) > 8 ? 'attention' : 'succes') }
              ],
              lignes: d.taux_absence_par_ecole || [],
              vide: 'Aucun relevé de présence'
            })}
          </div>
        </div>

        <div class="sa-section" style="margin-top:16px">
          <h2 class="sa-section-titre">Écoles les plus actives <span class="sa-annexe">30 derniers jours</span></h2>
          ${graphe.barres((d.ecoles_les_plus_actives || []).map((e) => ({ libelle: e.ecole, valeur: Number(e.actions) })))}
        </div>`;
    }
  });

  /* ======================================================================
     Rapports
     ====================================================================== */

  SA.enregistrerVue('rapports', {
    titre: 'Rapports',
    sousTitre: 'Exports de la plateforme au format Excel, CSV, PDF ou JSON.',

    async rendu(conteneur) {
      const d = await SA.api('/super-admin/rapports');

      conteneur.innerHTML = `
        <p class="sa-note" style="margin-bottom:18px">
          Les exports respectent les mêmes règles que l'affichage : aucune donnée
          sensible (mot de passe, jeton, clé d'API) n'y figure. Le format PDF
          ouvre une page prête à imprimer — le navigateur produit le fichier,
          ce qui évite de faire tourner un moteur de rendu sur le serveur.
        </p>
        <div class="sa-grille-3">
          ${(d.rapports || []).map((r) => `
            <div class="sa-panneau">
              <h3 class="sa-section-titre">${esc(r.libelle)}</h3>
              <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px">
                ${(d.formats || []).map((f) => `
                  <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
                          data-rapport="${esc(r.cle)}" data-format="${esc(f)}">
                    ${esc(f.toUpperCase())}
                  </button>`).join('')}
              </div>
            </div>`).join('')}
        </div>`;

      conteneur.addEventListener('click', async (evenement) => {
        const bouton = evenement.target.closest('[data-rapport]');
        if (!bouton) return;

        const rapport = bouton.getAttribute('data-rapport');
        const format = bouton.getAttribute('data-format');
        const libelleOrigine = bouton.textContent;

        if (format === 'pdf') {
          // La page imprimable a besoin du jeton : on la récupère puis on
          // l'ouvre depuis un blob, un simple window.open n'étant pas
          // authentifié.
          bouton.disabled = true;
          bouton.textContent = '…';
          try {
            const html = await SA.api(`/super-admin/rapports/${rapport}?format=pdf`);
            const blob = new Blob([html], { type: 'text/html' });
            const fenetre = window.open(URL.createObjectURL(blob), '_blank');
            if (!fenetre) SA.toast('Le navigateur a bloqué la fenêtre. Autorisez les pop-ups.', 'attention');
          } catch (erreur) {
            SA.toast(erreur.message, 'erreur');
          } finally {
            bouton.disabled = false;
            bouton.textContent = libelleOrigine;
          }
          return;
        }

        const extensions = { xlsx: 'xlsx', csv: 'csv', json: 'json' };
        bouton.disabled = true;
        bouton.textContent = '…';
        try {
          await SA.telecharger(
            `/super-admin/rapports/${rapport}?format=${format}`,
            `ardoise-${rapport}-${new Date().toISOString().slice(0, 10)}.${extensions[format]}`
          );
          SA.toast('Export téléchargé.', 'succes');
        } catch (erreur) {
          SA.toast(erreur.message, 'erreur');
        } finally {
          bouton.disabled = false;
          bouton.textContent = libelleOrigine;
        }
      });
    }
  });
})();
