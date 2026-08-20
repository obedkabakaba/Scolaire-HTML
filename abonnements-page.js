/**
 * Ardoise — page Abonnements.
 *
 * LE PRINCIPE : ON NE MONTRE QUE L'ÉTAPE EN COURS
 * ---------------------------------------------------------------------------
 * La version précédente affichait simultanément l'état, les offres, la durée,
 * les deux modes de règlement, le numéro de dépôt et le champ de référence.
 * Un directeur qui voulait seulement savoir quand son abonnement expirait
 * tombait sur un formulaire de paiement complet — et un directeur qui voulait
 * payer devait deviner par où commencer.
 *
 * Ici, chaque étape n'apparaît qu'une fois la précédente franchie, et l'état
 * courant reste toujours visible en haut. Les choix déjà faits ne sont jamais
 * perdus quand on revient en arrière : `etat.plan` et `etat.periodicite`
 * survivent aux allers-retours, et une référence refusée se corrige sans
 * repasser par le choix d'offre.
 *
 * LA SYNCHRONISATION EST SILENCIEUSE, PAR CONSTRUCTION
 * ---------------------------------------------------------------------------
 * La page interroge le serveur régulièrement pour voir si Ardoise a validé le
 * paiement. Elle ne redessine RIEN tant que la signature des données n'a pas
 * changé (voir `signature()`), et elle ne touche jamais au DOM pendant qu'un
 * champ est en cours de saisie. Pas de squelette, pas de clignotement, pas de
 * défilement qui saute.
 */
(function () {
  'use strict';
  if (!window.ArdoiseSession || !ArdoiseSession.connecte()) { location.replace('connexion.html'); return; }

  /* --------------------------------------------------------------- Outils */

  var $ = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* COMBIEN DE TEMPS ON ATTEND, ET POURQUOI CES DURÉES

     L'hébergement met le serveur en veille après une période d'inactivité. Le
     premier appel du matin paie donc le réveil : trente à cinquante secondes,
     parfois plus. Pendant ce temps la requête est PARTIE et ne revient pas —
     ce n'est pas une erreur, c'est une attente. Sans délai, `fetch` patiente
     sans limite et la page reste sur « Chargement… », sans bouton, sans
     message : exactement ce que les écoles décrivaient comme « la page
     d'abonnement s'ouvre mais rien ne se clique ».

     · 6 s  → on DIT que le serveur se réveille. Le plus important des deux :
              une attente expliquée n'est plus une panne.
     · 45 s → on abandonne et on montre l'écran d'erreur, qui porte, lui, un
              bouton « Réessayer » et deux moyens de nous joindre. Assez long
              pour laisser un vrai réveil aboutir, assez court pour ne pas
              laisser quelqu'un devant un écran mort. */
  var DELAI_REVEIL = 6000;
  var DELAI_ABANDON = 45000;

  function api(path, opt) {
    var reglage = {};
    var source = opt || {};
    for (var cle in source) {
      if (Object.prototype.hasOwnProperty.call(source, cle)) reglage[cle] = source[cle];
    }

    var minuteur = null;
    if (reglage.delai && typeof AbortController === 'function') {
      var controleur = new AbortController();
      reglage.signal = controleur.signal;
      minuteur = setTimeout(function () { controleur.abort(); }, reglage.delai);
    }
    var arreter = function () { if (minuteur) clearTimeout(minuteur); };

    return ArdoiseSession.appelApi(path, reglage).then(function (r) {
      arreter();
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.message || 'Opération impossible.'); e.status = r.status; throw e; }
        return j;
      });
    }, function (e) {
      arreter();
      // `AbortError` : c'est NOTRE délai qui a coupé, pas le réseau. Le dire
      // autrement ferait accuser la connexion de l'école.
      if (e && (e.name === 'AbortError' || e.code === 20)) {
        var abandon = new Error('Le serveur n’a pas répondu à temps.');
        abandon.expire = true;
        throw abandon;
      }
      throw e;
    });
  }

  function money(n, d) {
    var v = Number(n);
    return Number.isFinite(v)
      ? v.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' ' + (d || 'USD')
      : '—';
  }

  function libPeriode(p) { return p === 'annuel' ? 'Annuel' : p === 'semestriel' ? '6 mois' : 'Mensuel'; }

  function dateCourte(v) {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch (e) { return '—'; }
  }

  /** Jours restants avant échéance. Négatif = déjà expiré. */
  function joursRestants(v) {
    if (!v) return null;
    var d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  }

  function flash(message, type) {
    var e = $('message-flash');
    if (!e) return;
    e.textContent = message;
    e.style.background = type === 'erreur' ? 'var(--rouge)' : type === 'succes' ? 'var(--vert-ok)' : 'var(--ardoise)';
    e.classList.add('visible');
    clearTimeout(e._t);
    e._t = setTimeout(function () { e.classList.remove('visible'); }, 4200);
  }

  function setBusy(btn, on, texte) {
    if (!btn) return;
    if (on) { btn.dataset.texte = btn.textContent; btn.disabled = true; btn.textContent = texte || 'Traitement…'; }
    else { btn.disabled = false; if (btn.dataset.texte) btn.textContent = btn.dataset.texte; }
  }

  function montrer(id, visible) { var e = $(id); if (e) e.classList.toggle('cache', !visible); }

  /** Défilement doux vers une étape, sans jamais l'imposer sur mobile clavier ouvert. */
  function amener(id) {
    var e = $(id);
    if (!e) return;
    setTimeout(function () { e.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 40);
  }

  /* ---------------------------------------------------------------- État */

  var data = null;
  var etat = { plan: null, periodicite: 'annuel', etape: null };
  var signatureActuelle = '';
  var envoiEnCours = false;
  /* Sur un réseau lent, une synchro peut durer plus longtemps que l'intervalle
     qui la déclenche. Sans ce verrou, les appels s'empilent et chacun ralentit
     les autres — sur une connexion facturée au mégaoctet, en plus. */
  var synchroEnCours = false;

  /* Une clé stable par tentative : deux clics sur « Continuer » envoient la
     MÊME clé, et le serveur renvoie la demande déjà créée au lieu d'en ouvrir
     une seconde. Elle est renouvelée dès qu'un choix change. */
  var cleIdempotence = null;
  function nouvelleCle() {
    cleIdempotence = 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  /** Les états où une demande est encore en cours côté école. */
  var EN_COURS = ['en_attente_paiement', 'a_verifier', 'agent_demande',
    'agent_pris_en_charge', 'agent_assigne', 'rdv_planifie', 'paiement_recupere'];

  var LIB_STATUT = {
    en_attente_paiement: 'Dépôt à effectuer',
    a_verifier: 'Paiement en cours de vérification',
    agent_demande: 'Demande reçue',
    agent_pris_en_charge: 'Prise en charge',
    agent_assigne: 'Agent assigné',
    rdv_planifie: 'Rendez-vous prévu',
    paiement_recupere: 'Paiement récupéré',
    validee: 'Abonnement activé',
    refusee: 'Paiement à corriger',
    annulee: 'Demande remplacée'
  };

  /* ----------------------------------------------------- Étape 0 : état */

  function renduEtat() {
    var e = (data && data.ecole) || {};
    /* `en_attente` est l'état AVANT le premier paiement. Ce n'est ni un
       abonnement actif ni un abonnement expiré, même si l'ancienne ligne porte
       déjà une date d'expiration technique. Cette date ne doit donc jamais être
       montrée au client comme une échéance qu'il aurait ratée. */
    var sansAbonnement = !e.abonnement_statut || e.abonnement_statut === 'en_attente';
    var jours = sansAbonnement ? null : joursRestants(e.date_expiration);
    var expire = !sansAbonnement && jours !== null && jours < 0;

    var blocActivation = sansAbonnement
      ? '<div class="resume-case"><small>Activation</small><strong>À choisir</strong></div>'
      : '<div class="resume-case"><small>' + (expire ? 'Expiré depuis' : 'Prochaine échéance') + '</small>'
        + '<strong>' + dateCourte(e.date_expiration) + '</strong>'
        + (jours !== null
          ? '<div class="muted" style="margin-top:4px">'
            + (expire ? Math.abs(jours) + ' jour' + (Math.abs(jours) > 1 ? 's' : '')
              : 'dans ' + jours + ' jour' + (jours > 1 ? 's' : '')) + '</div>'
          : '')
        + '</div>';

    $('ecole').innerHTML =
      '<div class="resume-case"><small>École</small><strong>' + esc(e.nom || '—') + '</strong>'
      + '<div class="muted code" style="margin-top:4px">' + esc(e.code || '') + '</div></div>'
      + '<div class="resume-case"><small>Bouquet actuel</small><strong>'
      + (sansAbonnement ? 'Aucun abonnement actif' : esc(e.plan_nom || '—')) + '</strong>'
      + (sansAbonnement && e.plan_nom
        ? '<div class="muted" style="margin-top:4px">Offre présélectionnée : ' + esc(e.plan_nom) + '</div>' : '')
      + '</div>'
      + blocActivation;

    var compact = $('etat-compact');
    if (compact) {
      compact.textContent = sansAbonnement ? 'Sans abonnement'
        : expire ? 'Expiré'
          : e.abonnement_statut === 'actif' ? 'Actif'
            : e.abonnement_statut ? String(e.abonnement_statut).replace(/_/g, ' ') : 'Sans abonnement';
      compact.classList.toggle('ton-alerte', expire);
      compact.classList.toggle('ton-ok', !sansAbonnement && !expire && e.abonnement_statut === 'actif');
    }

    /* Chaque état commercial a son propre message. Une école qui n'a jamais
       payé ne doit surtout pas lire « votre abonnement est arrivé à échéance ». */
    var zone = $('etat-message');
    if (sansAbonnement) {
      zone.innerHTML = '<div class="etat-demande"><p style="margin:0">'
        + '<strong>Votre établissement n’a pas encore d’abonnement actif.</strong><br>'
        + 'Choisissez une offre et un mode de règlement pour activer Ardoise. '
        + 'Votre espace est déjà créé et sera disponible dès l’activation.</p></div>';
    } else if (expire) {
      zone.innerHTML = '<div class="etat-demande"><p style="margin:0">'
        + '<strong>Votre abonnement est arrivé à échéance.</strong><br>'
        + 'Vos données sont conservées. Renouvelez votre abonnement pour reprendre '
        + 'l’utilisation complète d’Ardoise.</p></div>';
    } else if (jours !== null && jours <= 30) {
      zone.innerHTML = '<div class="etat-demande"><p style="margin:0">'
        + 'Votre abonnement expire dans ' + jours + ' jour' + (jours > 1 ? 's' : '')
        + '. Vous pouvez le renouveler dès maintenant : les jours restants sont conservés.</p></div>';
    } else {
      zone.innerHTML = '';
    }
  }

  /** Le bouton principal — présent seulement quand aucune demande n'est en cours. */
  function renduActions() {
    var d = data && data.demande;
    var enCours = d && EN_COURS.indexOf(d.statut) !== -1;
    var zone = $('etat-actions');

    if (enCours || (d && d.statut === 'refusee')) { zone.innerHTML = ''; return; }
    if (etat.etape) { zone.innerHTML = ''; return; }

    var e = (data && data.ecole) || {};
    var sansAbonnement = !e.abonnement_statut || e.abonnement_statut === 'en_attente';
    zone.innerHTML = '<button type="button" class="bouton bouton-principal" id="btn-renouveler">'
      + (sansAbonnement ? 'Choisir mon abonnement' : 'Renouveler mon abonnement') + '</button>';
    $('btn-renouveler').addEventListener('click', function () {
      ouvrirTunnel();
      amener('etape-offre');
    });
  }

  /* ------------------------------------------------- Suivi d'une demande */

  /** Les jalons affichés à l'école, selon le mode de règlement. */
  function jalons(d) {
    if (d.mode_paiement === 'agent') {
      return [
        { cle: 'agent_demande', libelle: 'Demande reçue' },
        { cle: 'agent_pris_en_charge', libelle: 'Prise en charge' },
        { cle: 'agent_assigne', libelle: 'Agent assigné' },
        { cle: 'rdv_planifie', libelle: 'Rendez-vous prévu' },
        { cle: 'paiement_recupere', libelle: 'Paiement récupéré' },
        { cle: 'validee', libelle: 'Terminé' }
      ];
    }
    return [
      { cle: 'en_attente_paiement', libelle: 'Dépôt effectué' },
      { cle: 'a_verifier', libelle: 'Référence envoyée' },
      { cle: 'verification', libelle: 'Vérification Ardoise' },
      { cle: 'validee', libelle: 'Activation' }
    ];
  }

  function indiceJalon(d) {
    var liste = jalons(d);
    if (d.statut === 'validee') return liste.length - 1;
    // « Vérification Ardoise » et « Référence envoyée » se déclenchent ensemble :
    // dès que la référence part, la vérification est en cours.
    if (d.statut === 'a_verifier') return 2;
    for (var i = 0; i < liste.length; i++) if (liste[i].cle === d.statut) return i;
    return 0;
  }

  function renduSuivi() {
    var d = data && data.demande;
    var pertinent = d && (EN_COURS.indexOf(d.statut) !== -1 || d.statut === 'refusee'
      || (d.statut === 'validee' && !etat.etape));

    if (!pertinent) { montrer('suivi', false); return; }

    // Une demande validée n'a plus rien à suivre une fois la page rechargée :
    // l'état en haut dit déjà « Actif ».
    if (d.statut === 'validee') { montrer('suivi', false); return; }

    montrer('suivi', true);

    if (d.statut === 'refusee') {
      $('suivi').innerHTML =
        '<div class="carte-titre-ligne"><div><span class="sur-titre">Renouvellement</span>'
        + '<h2>Nous n’avons pas pu confirmer ce paiement.</h2></div></div>'
        + '<div class="etat-demande erreur">'
        + (d.refuse_motif ? '<div class="etat-motif"><strong>Motif :</strong> ' + esc(d.refuse_motif) + '</div>' : '')
        + '<p style="margin:8px 0 0">Votre offre et votre durée sont conservées. '
        + 'Vous n’avez qu’à corriger la référence de transaction.</p></div>'
        + recapHTML(d)
        + '<div class="etat-actions"><button type="button" class="bouton bouton-principal" id="btn-corriger">'
        + 'Corriger la référence</button></div>';

      $('btn-corriger').addEventListener('click', function () {
        // On rouvre UNIQUEMENT l'étape dépôt : ni offre, ni durée à refaire.
        restaurerChoixDepuisDemande(d);
        ouvrirTunnel();
        allerEtape('depot');
        amener('etape-depot');
      });
      return;
    }

    var liste = jalons(d);
    var courant = indiceJalon(d);
    var etapes = liste.map(function (j, i) {
      var cls = i < courant ? 'fait' : i === courant ? 'actif' : '';
      return '<li class="' + cls + '"><span>' + (i < courant ? '✓' : i === courant ? '●' : '○')
        + '</span><div>' + esc(j.libelle) + '</div></li>';
    }).join('');

    var complement = '';
    if (d.statut === 'a_verifier' && d.reference_transaction) {
      complement = '<div class="etat-reference">Référence : <span class="code">'
        + esc(d.reference_transaction) + '</span></div>';
    }
    if (d.statut === 'rdv_planifie' && d.rdv_at) {
      complement = '<div class="etat-reference">Rendez-vous : <strong>' + dateCourte(d.rdv_at) + '</strong></div>';
    }
    if (d.statut === 'agent_assigne' && d.agent_nom) {
      complement = '<div class="etat-reference">Agent : <strong>' + esc(d.agent_nom) + '</strong></div>';
    }

    $('suivi').innerHTML =
      '<div class="carte-titre-ligne"><div><span class="sur-titre">Renouvellement en cours</span>'
      + '<h2>' + esc(LIB_STATUT[d.statut] || d.statut) + '</h2></div>'
      + '<span class="etat-compact">' + esc(libPeriode(d.periodicite)) + '</span></div>'
      + recapHTML(d)
      + '<ol class="jalons">' + etapes + '</ol>'
      + complement
      + '<p class="aide" style="margin-top:12px">'
      + (d.mode_paiement === 'agent'
        ? 'L’équipe Ardoise vous contactera. Votre école sera avertie à chaque étape.'
        : 'Votre école sera avertie dès que le paiement sera validé.')
      + '</p>';
  }

  function recapHTML(d) {
    return '<div class="recap-choix">'
      + '<div><small>Offre</small><strong>' + esc(d.plan_nom || '—') + '</strong></div>'
      + '<div><small>Durée</small><strong>' + esc(libPeriode(d.periodicite)) + '</strong></div>'
      + '<div><small>Montant</small><strong>' + money(d.montant_attendu, d.devise) + '</strong></div>'
      + '</div>';
  }

  /* ------------------------------------------------------- Étape 1 : offre */

  function caracteristiques(p) {
    var f = Array.isArray(p.fonctionnalites_incluses) ? p.fonctionnalites_incluses : [];
    return f.slice(0, 4).map(function (x) {
      var t = typeof x === 'string' ? x : (x.nom || x.cle || '');
      return t ? '<li>' + esc(t.replace(/_/g, ' ')) + '</li>' : '';
    }).join('');
  }

  function renduPlans() {
    var ecole = data.ecole || {};
    var sansAbonnement = !ecole.abonnement_statut || ecole.abonnement_statut === 'en_attente';
    var courant = sansAbonnement ? null : ecole.abonnement_plan_id;
    var plans = data.plans || [];
    if (!plans.length) {
      $('plans').innerHTML = '<div class="carte-section erreur">Aucune offre disponible pour le moment.</div>';
      return;
    }

    $('plans').innerHTML = plans.map(function (p) {
      var actuel = p.id === courant;
      var choisi = etat.plan && etat.plan.id === p.id;
      var libelleBouton = actuel ? 'Renouveler' : (sansAbonnement ? 'Choisir cette offre' : 'Passer à cette offre');
      return '<article class="plan' + (actuel ? ' actuel' : '') + (choisi ? ' choisi' : '') + '">'
        + (actuel ? '<span class="plan-badge">Votre bouquet actuel</span>' : '')
        + '<h3>' + esc(p.nom) + '</h3>'
        + '<div class="plan-desc">' + esc(p.positionnement || p.description || '') + '</div>'
        + '<div class="plan-prix">' + money(p.prix, p.devise) + ' <small>/ mois</small></div>'
        + '<ul>' + caracteristiques(p) + '</ul>'
        + '<button type="button" class="bouton ' + (actuel ? 'bouton-principal' : 'bouton-secondaire')
        + '" data-plan="' + esc(p.id) + '">' + libelleBouton + '</button>'
        + '</article>';
    }).join('');

    Array.prototype.forEach.call($('plans').querySelectorAll('[data-plan]'), function (b) {
      b.addEventListener('click', function () {
        var plan = plans.find(function (p) { return p.id === b.dataset.plan; });
        if (!plan) return;
        choisirPlan(plan, plan.id !== courant);
      });
    });
  }

  function choisirPlan(plan, estChangement) {
    etat.plan = plan;
    nouvelleCle();
    renduPlans();
    renduPeriodes();
    allerEtape('duree');

    var e = (data && data.ecole) || {};
    var sansAbonnement = !e.abonnement_statut || e.abonnement_statut === 'en_attente';
    if (sansAbonnement) {
      flash('Vous avez choisi le bouquet ' + plan.nom + '. Sélectionnez maintenant la durée.', 'info');
    } else if (estChangement) {
      /* Changer de bouquet n'est pas anodin : on le dit, sans bloquer. */
      flash('Vous passez au bouquet ' + plan.nom + '. Votre offre actuelle sera remplacée après validation.', 'info');
    }
    amener('etape-duree');
  }

  /* ------------------------------------------------------ Étape 2 : durée */

  function renduPeriodes() {
    if (!etat.plan) return;
    var p = etat.plan;
    var tarifs = p.tarifs || {};
    var economies = p.economies || {};

    var options = [
      { cle: 'mensuel', titre: 'Mensuel', mois: 1 },
      { cle: 'semestriel', titre: '6 mois', mois: 6 },
      { cle: 'annuel', titre: 'Annuel', mois: 12 }
    ];

    $('periodes').innerHTML = options.map(function (o) {
      var total = tarifs[o.cle];
      var eco = economies[o.cle] || 0;
      var parMois = o.mois > 1 && Number.isFinite(Number(total)) ? Number(total) / o.mois : null;

      return '<button type="button" class="periode-option' + (etat.periodicite === o.cle ? ' actif' : '')
        + '" data-periode="' + o.cle + '">'
        + '<span>' + o.titre + '</span>'
        + '<strong>' + money(total, p.devise) + '</strong>'
        // Le montant réellement à payer et l'équivalent mensuel sont montrés
        // ensemble : c'est la confusion la plus fréquente sur ce type d'écran.
        + (parMois !== null ? '<em>' + money(Math.round(parMois * 100) / 100, p.devise) + ' / mois équivalent</em>' : '')
        // Aucune économie inventée : le serveur renvoie 0 quand il n'y a pas
        // de remise réelle au catalogue, et rien ne s'affiche alors.
        + (eco > 0 ? '<small>Économisez ' + money(eco, p.devise) + '</small>' : '')
        + (o.cle === 'annuel' && eco > 0 ? '<i class="marque-reco">Recommandé</i>' : '')
        + '</button>';
    }).join('');

    Array.prototype.forEach.call($('periodes').querySelectorAll('[data-periode]'), function (b) {
      b.addEventListener('click', function () {
        etat.periodicite = b.dataset.periode;
        nouvelleCle();
        renduPeriodes();
        allerEtape('mode');
        amener('etape-mode');
      });
    });
  }

  /* ------------------------------------------------------- Étape 3 : mode */

  function renduDisponibiliteDepot() {
    var d = (data && data.depot) || {};
    var z = $('depot-disponibilite');
    if (!z) return;
    if (!d.disponible) {
      z.innerHTML = '<span class="indispo-point"></span>Dépôt temporairement indisponible : demandez un agent.';
      $('btn-depot').disabled = true;
      return;
    }
    $('btn-depot').disabled = false;
    z.innerHTML = '<span class="dispo-point"></span>Dépôt disponible'
      + (d.reseau ? ' via ' + esc(d.reseau) : '') + '.';
  }

  /* ------------------------------------------------------ Étape 4 : dépôt */

  function renduEtapeDepot() {
    var d = (data && data.demande) || {};
    var dep = (data && data.depot) || {};
    var plan = etat.plan || {};

    $('recap-depot').innerHTML =
      '<div><small>Offre</small><strong>' + esc(d.plan_nom || plan.nom || '—') + '</strong></div>'
      + '<div><small>Durée</small><strong>' + esc(libPeriode(d.periodicite || etat.periodicite)) + '</strong></div>'
      + '<div><small>Montant</small><strong>'
      + money(d.montant_attendu != null ? d.montant_attendu : (plan.tarifs || {})[etat.periodicite],
        d.devise || plan.devise) + '</strong></div>';

    $('montant-depot').textContent = money(
      d.montant_attendu != null ? d.montant_attendu : (plan.tarifs || {})[etat.periodicite],
      d.devise || plan.devise);
    $('reseau-depot').textContent = d.reseau_depot || dep.reseau || 'Dépôt Ardoise';
    $('numero-depot').textContent = d.numero_depot || dep.numero || '—';
    $('nom-depot').textContent = d.nom_depot || dep.nom || 'Ardoise';
  }

  /* ------------------------------------------------- Machine à états */

  var ETAPES = ['offre', 'duree', 'mode', 'depot'];

  function ouvrirTunnel() {
    montrer('tunnel', true);
    if (!etat.etape) allerEtape('offre');
  }

  function fermerTunnel() {
    montrer('tunnel', false);
    etat.etape = null;
    renduActions();
  }

  function allerEtape(nom) {
    etat.etape = nom;
    var atteint = ETAPES.indexOf(nom);

    // Une étape n'est visible que si elle est atteinte. Revenir en arrière
    // referme les suivantes sans effacer les choix qu'elles portaient.
    montrer('etape-offre', atteint >= 0);
    montrer('etape-duree', atteint >= 1);
    montrer('etape-mode', atteint >= 2);
    montrer('etape-depot', atteint >= 3);

    if (atteint >= 1) renduPeriodes();
    if (atteint >= 2) renduDisponibiliteDepot();
    if (atteint >= 3) renduEtapeDepot();

    renduFil();
    renduActions();
  }

  function renduFil() {
    var libelles = [
      { cle: 'offre', titre: 'Offre' },
      { cle: 'duree', titre: 'Durée' },
      { cle: 'mode', titre: 'Règlement' },
      { cle: 'depot', titre: 'Dépôt' }
    ];
    var courant = ETAPES.indexOf(etat.etape);
    // L'étape « Dépôt » n'apparaît au fil que si elle est atteinte : elle ne
    // concerne pas le parcours agent.
    var visibles = libelles.slice(0, Math.max(3, courant + 1));

    $('tunnel-fil').innerHTML = visibles.map(function (l, i) {
      var cls = i < courant ? 'fait' : i === courant ? 'actif' : '';
      return '<span class="fil-etape ' + cls + '"><b>' + (i < courant ? '✓' : (i + 1)) + '</b>'
        + esc(l.titre) + '</span>';
    }).join('<i class="fil-trait"></i>');
  }

  /** Rétablit offre et durée depuis une demande existante, sans rien redemander. */
  function restaurerChoixDepuisDemande(d) {
    if (!d) return;
    var plan = (data.plans || []).find(function (p) { return p.id === d.plan_id; });
    if (plan) etat.plan = plan;
    if (d.periodicite) etat.periodicite = d.periodicite;
  }

  /* ------------------------------------------------------------ Actions */

  function creerDemande(mode, btn) {
    if (!etat.plan || envoiEnCours) return;
    envoiEnCours = true;
    setBusy(btn, true, mode === 'agent' ? 'Envoi de la demande…' : 'Préparation du dépôt…');

    api('/abonnements/renouvellements', {
      method: 'POST',
      body: {
        plan_id: etat.plan.id,
        periodicite: etat.periodicite,
        mode_paiement: mode,
        cle_idempotence: cleIdempotence
      }
    }).then(function (r) {
      data.demande = r.demande || data.demande;
      signatureActuelle = signature(data);
      if (mode === 'depot') {
        allerEtape('depot');
        renduSuivi();
        amener('etape-depot');
      } else {
        fermerTunnel();
        renduSuivi();
        montrer('suivi', true);
        amener('suivi');
      }
      renduEtat();
      flash(r.message || 'Demande enregistrée.', 'succes');
    }).catch(function (e) {
      flash(e.message, 'erreur');
    }).finally(function () {
      envoiEnCours = false;
      setBusy(btn, false);
    });
  }

  function envoyerReference() {
    var d = data && data.demande;
    var ref = $('reference').value.trim();
    var btn = $('btn-reference');

    if (!d || ['en_attente_paiement', 'refusee'].indexOf(d.statut) === -1) {
      flash('Cette demande n’attend pas de nouvelle référence.', 'erreur');
      return;
    }
    if (ref.length < 4) {
      flash('Entrez la référence complète de la transaction.', 'erreur');
      $('reference').focus();
      return;
    }
    if (envoiEnCours) return;
    envoiEnCours = true;
    setBusy(btn, true, 'Envoi pour vérification…');

    /* Une référence refusée se corrige SUR LA MÊME DEMANDE : le serveur
       accepte désormais la transition `refusee → a_verifier`. La version
       précédente créait ici une seconde demande pour contourner un serveur qui
       refusait — l'école changeait d'identifiant de dossier et l'historique du
       refus disparaissait. */
    api('/abonnements/renouvellements/' + encodeURIComponent(d.id) + '/reference', {
      method: 'PATCH', body: { reference: ref }
    }).then(function (r) {
      data.demande = r.demande || data.demande;
      signatureActuelle = signature(data);
      $('reference').value = '';
      fermerTunnel();

      if (r.validation_automatique || (data.demande && data.demande.statut === 'validee')) {
        flash(r.message || 'Paiement validé : votre abonnement est actif.', 'succes');
        return charger(false);
      }
      renduSuivi();
      renduEtat();
      montrer('suivi', true);
      amener('suivi');
      flash(r.message || 'Référence transmise.', 'succes');
    }).catch(function (e) {
      flash(e.message, 'erreur');
    }).finally(function () {
      envoiEnCours = false;
      setBusy(btn, false);
    });
  }

  /* -------------------------------------------- Confirmation « agent » */

  function ouvrirConfirmationAgent() {
    if (!etat.plan) return;
    var e = (data && data.ecole) || {};
    var adresse = [e.adresse, e.commune, e.ville].filter(Boolean).join(', ');

    $('recap-agent').innerHTML =
      '<div><small>École</small><strong>' + esc(e.nom || '—') + '</strong></div>'
      + '<div><small>Adresse</small><strong>' + esc(adresse || 'Non renseignée') + '</strong></div>'
      + '<div><small>Téléphone</small><strong>' + esc(e.telephone || 'Non renseigné') + '</strong></div>'
      + '<div><small>Offre</small><strong>' + esc(etat.plan.nom) + '</strong></div>'
      + '<div><small>Durée</small><strong>' + esc(libPeriode(etat.periodicite)) + '</strong></div>'
      + '<div><small>Montant</small><strong>'
      + money((etat.plan.tarifs || {})[etat.periodicite], etat.plan.devise) + '</strong></div>';

    montrer('voile-agent', true);
    $('agent-confirmer').focus();
  }

  function fermerConfirmationAgent() { montrer('voile-agent', false); }

  /* ------------------------------------------------------- Chargement */

  /**
   * Signature des données affichées. Tant qu'elle ne change pas, la
   * synchronisation de fond ne touche à AUCUN nœud du DOM — c'est ce qui
   * supprime le clignotement et les sauts de défilement.
   */
  function signature(d) {
    if (!d) return '';
    var e = d.ecole || {};
    var de = d.demande || {};
    return [
      e.plan_nom, e.abonnement_statut, e.date_expiration,
      de.id, de.statut, de.updated_at, de.reference_transaction,
      de.refuse_motif, de.rdv_at, de.agent_nom
    ].join('|');
  }

  function peindre() {
    renduEtat();
    renduSuivi();
    renduActions();
    if (etat.etape) renduPlans();
  }

  /**
   * Ce qu'on dit quand le chargement échoue.
   *
   * Le message brut du serveur est conservé — il nomme la cause — mais il ne
   * suffit pas : le plus fréquent, en RDC, n'est pas une panne mais un
   * serveur endormi qui met quelques secondes à répondre, ou une connexion
   * qui a lâché au mauvais moment. Sans cette phrase, le directeur conclut
   * que son espace est cassé et appelle ; avec elle, il réessaie.
   */
  function messageDeCharge(e) {
    var brut = (e && e.message) ? String(e.message) : '';
    if (e && e.expire) {
      return brut + ' Il se réveille peut-être encore : réessayez dans un instant. '
           + 'Si cela dure, écrivez-nous — nous pouvons activer votre abonnement de notre côté.';
    }
    var reseau = !e || !e.status;
    return (brut ? brut + ' ' : '')
      + (reseau
        ? 'Le serveur met parfois quelques secondes à se réveiller : réessayez, '
          + 'ou écrivez-nous si cela persiste.'
        : 'Réessayez dans un instant, ou écrivez-nous si cela persiste.');
  }

  /**
   * Dire qu'on attend, plutôt que de laisser croire que rien ne se passe.
   *
   * Le message remplace le « Chargement… » muet au bout de quelques secondes.
   * Il ne s'affiche que si l'attente dure vraiment : sur un serveur déjà
   * réveillé, personne ne le voit jamais.
   */
  function annoncerReveil() {
    var minuteur = setTimeout(function () {
      var compact = $('etat-compact');
      if (compact) compact.textContent = 'Connexion au serveur…';
      var plans = $('plans');
      if (plans && /Chargement des offres/.test(plans.textContent)) {
        plans.innerHTML = '<div class="carte-section muted">Le serveur se réveille — '
          + 'cela peut prendre jusqu’à une minute la première fois de la journée.</div>';
      }
    }, DELAI_REVEIL);
    return function () { clearTimeout(minuteur); };
  }

  function charger(premier) {
    if (premier) $('plans').innerHTML = '<div class="carte-section muted">Chargement des offres…</div>';

    /* L'ERREUR NE DISPARAÎT QU'AVEC LA RÉUSSITE, JAMAIS AVANT.
       La masquer au DÉBUT de chaque tentative retirait le bouton « Réessayer »
       et les deux moyens de nous joindre dès qu'une nouvelle tentative
       partait — automatique comprise. L'école se retrouvait à nouveau devant
       un écran sans recours, pour quarante-cinq secondes de plus. */
    var finReveil = premier ? annoncerReveil() : function () {};

    return api('/abonnements/renouvellement', { delai: DELAI_ABANDON }).then(function (r) {
      finReveil();
      montrer('erreur-chargement', false);
      data = r;
      signatureActuelle = signature(r);
      renduPlans();
      peindre();

      /* Reprise d'un parcours interrompu : une demande de dépôt en attente
         rouvre directement l'étape référence, avec offre et durée déjà
         remplies. L'utilisateur ne recommence jamais ce qu'il a déjà fait. */
      var d = r.demande;
      if (d && d.statut === 'en_attente_paiement') {
        restaurerChoixDepuisDemande(d);
        ouvrirTunnel();
        allerEtape('depot');
      }
      return r;
    }).catch(function (e) {
      finReveil();
      montrer('erreur-chargement', true);

      /* On n'écrit QUE dans le conteneur de texte. Réécrire le bloc entier
         emportait le bouton « Réessayer » avec le message : la page devenait
         un cul-de-sac où plus rien ne se cliquait — sur l'écran même qui sert
         à payer, et où arrive désormais toute école dont l'abonnement est
         terminé. */
      $('erreur-chargement-detail').textContent = messageDeCharge(e);
      $('plans').innerHTML = '';
      flash(e.message, 'erreur');
      throw e;
    });
  }

  /**
   * Synchronisation de fond.
   *
   * Trois garde-fous, dans cet ordre :
   *   1. onglet caché         → on ne fait rien ;
   *   2. saisie en cours      → on ne touche pas au DOM sous les doigts ;
   *   3. signature inchangée  → on ne redessine rien.
   */
  function synchroniser() {
    if (document.hidden) return;
    if (envoiEnCours) return;

    var champ = $('reference');
    var saisieEnCours = champ && (document.activeElement === champ || champ.value.trim().length > 0);

    if (synchroEnCours) return;
    synchroEnCours = true;

    api('/abonnements/renouvellement', { delai: 15000 }).then(function (r) {
      synchroEnCours = false;
      var nouvelle = signature(r);
      if (nouvelle === signatureActuelle) return;   // rien n'a changé : DOM intact

      var ancienStatut = data && data.demande && data.demande.statut;
      data.ecole = r.ecole;
      data.depot = r.depot;
      data.demande = r.demande;
      data.plans = r.plans || data.plans;
      signatureActuelle = nouvelle;

      // L'état en haut est toujours sûr à redessiner : il ne contient aucun champ.
      renduEtat();
      if (saisieEnCours) return;

      var statut = r.demande && r.demande.statut;
      if (statut === 'validee' && ancienStatut !== 'validee') {
        fermerTunnel();
        flash('Paiement validé : votre abonnement est actif.', 'succes');
      }
      if (statut === 'refusee' && ancienStatut !== 'refusee') {
        fermerTunnel();
      }
      renduSuivi();
      renduActions();
    }).catch(function () {
      // Une synchro ratée est sans conséquence : la suivante repartira dans
      // vingt secondes. On libère seulement le verrou.
      synchroEnCours = false;
    });
  }

  /* ------------------------------------------------------------ Câblage */

  $('btn-depot').addEventListener('click', function () { creerDemande('depot', this); });
  $('btn-agent').addEventListener('click', ouvrirConfirmationAgent);
  $('agent-annuler').addEventListener('click', fermerConfirmationAgent);
  $('agent-confirmer').addEventListener('click', function () {
    fermerConfirmationAgent();
    creerDemande('agent', $('btn-agent'));
  });
  $('btn-reference').addEventListener('click', envoyerReference);
  $('reference').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); envoyerReference(); }
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-retour]'), function (b) {
    b.addEventListener('click', function () {
      allerEtape(b.dataset.retour);
      amener('etape-' + b.dataset.retour);
    });
  });

  $('copier-numero').addEventListener('click', function () {
    var numero = $('numero-depot').textContent.trim();
    if (!numero || numero === '—') return;
    var btn = this;
    var ok = function () {
      var ancien = btn.textContent;
      btn.textContent = 'Numéro copié ✓';
      setTimeout(function () { btn.textContent = ancien; }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(numero).then(ok).catch(function () {});
    } else {
      var t = document.createElement('textarea');
      t.value = numero;
      document.body.appendChild(t);
      t.select();
      try { document.execCommand('copy'); ok(); } catch (e) {}
      t.remove();
    }
  });

  $('reessayer').addEventListener('click', function () {
    var btn = this;
    setBusy(btn, true, 'Nouvelle tentative…');
    charger(true).catch(function () {}).then(function () { setBusy(btn, false); });
  });
  $('bouton-deconnexion-nav').addEventListener('click', function () { ArdoiseSession.terminer(); });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !$('voile-agent').classList.contains('cache')) fermerConfirmationAgent();
  });

  nouvelleCle();

  /* UNE SECONDE TENTATIVE, AUTOMATIQUE, APRÈS TROIS SECONDES.
     -------------------------------------------------------------------------
     L'hébergement met le serveur en veille après une période d'inactivité : le
     tout premier appel d'une école qui se connecte le matin peut donc échouer
     ou traîner le temps du réveil. Le directeur, lui, ne sait rien de cela — il
     voit une page vide sur l'écran où il vient payer.

     Une seule reprise, et seulement si la première a échoué : ce n'est pas une
     boucle de rattrapage, c'est le temps de réveil du serveur. Si la seconde
     échoue aussi, l'écran d'erreur reste, avec son bouton et ses recours. */
  charger(true).catch(function () {
    setTimeout(function () {
      var detail = $('erreur-chargement-detail');
      if (detail) detail.textContent = 'Nouvelle tentative en cours… ' + detail.textContent;
      charger(true).catch(function () {});
    }, 3000);
  });
  setInterval(synchroniser, 20000);
})();