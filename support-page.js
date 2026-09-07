/**
 * Ardoise — Centre Support côté école.
 *
 * Principes : une conversation simple, aucun identifiant d'école fourni par le
 * navigateur, des états réseau explicites et une interface utilisable au
 * clavier comme au toucher. L'API reste la seule source de vérité ; aucune
 * conversation n'est conservée dans localStorage, CacheStorage ou IndexedDB.
 */
(function () {
  'use strict';

  if (!window.ArdoiseSession || !ArdoiseSession.connecte()) {
    location.replace('connexion.html');
    return;
  }

  var $ = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function api(path, options) {
    var opt = options || {};
    var controleur = typeof AbortController === 'function' ? new AbortController() : null;
    var delai = setTimeout(function () {
      if (controleur) controleur.abort();
    }, opt.delaiMs || 18000);

    var reglages = {
      method: opt.method || 'GET',
      headers: opt.headers || {},
      body: opt.body,
      signal: controleur ? controleur.signal : opt.signal
    };

    return ArdoiseSession.appelApi(path, reglages).then(function (reponse) {
      return reponse.json().catch(function () { return {}; }).then(function (donnees) {
        if (!reponse.ok) {
          var erreur = new Error(donnees.message || 'Cette opération n’a pas abouti.');
          erreur.status = reponse.status;
          throw erreur;
        }
        return donnees;
      });
    }).catch(function (erreur) {
      if (erreur && erreur.name === 'AbortError') {
        throw new Error('Le serveur met trop de temps à répondre. Réessayez dans quelques instants.');
      }
      if (!navigator.onLine) {
        throw new Error('Vous êtes hors connexion. Reconnectez-vous puis réessayez.');
      }
      throw erreur;
    }).finally(function () { clearTimeout(delai); });
  }

  var STATUTS = {
    ouvert: 'Ouvert',
    en_cours: 'En cours',
    attente_client: 'En attente de votre réponse',
    resolu: 'Résolu',
    ferme: 'Clôturé'
  };

  var MOTIFS = [
    { cle: 'technique', titre: 'Problème technique', aide: 'Une page ne s’ouvre pas, un bouton ne répond plus.' },
    { cle: 'facturation', titre: 'Paiement et abonnement', aide: 'Renouvellement, facture, offre.' },
    { cle: 'compte', titre: 'Compte et accès', aide: 'Connexion, mot de passe, utilisateurs.' },
    { cle: 'notes', titre: 'Notes et bulletins', aide: 'Saisie, calcul, impression des bulletins.' },
    { cle: 'donnees', titre: 'Données de l’école', aide: 'Élèves, classes, années scolaires.' },
    { cle: 'formation', titre: 'Formation et utilisation', aide: 'Comment réaliser une action dans Ardoise.' },
    { cle: 'autre', titre: 'Autre', aide: 'Une demande qui ne correspond à aucun sujet ci-dessus.' }
  ];

  var actif = null;
  var motif = null;
  var dernierSujetAutomatique = '';
  var signatureListe = '';
  var signatureDetail = '';
  var listeChargee = false;
  var chargementListe = null;
  var chargementDetail = null;

  function flash(message, type) {
    var element = $('message-flash');
    if (!element) return;
    element.textContent = message;
    element.classList.remove('erreur', 'succes', 'info');
    element.classList.add(type === 'erreur' ? 'erreur' : type === 'succes' ? 'succes' : 'info');
    element.classList.add('visible');
    clearTimeout(element._minuterie);
    element._minuterie = setTimeout(function () { element.classList.remove('visible'); }, 5500);
  }

  function setBusy(bouton, actifBusy, texte) {
    if (!bouton) return;
    if (actifBusy) {
      if (!bouton.dataset.texteInitial) bouton.dataset.texteInitial = bouton.textContent;
      bouton.disabled = true;
      bouton.setAttribute('aria-busy', 'true');
      bouton.textContent = texte || 'Traitement…';
      return;
    }
    bouton.disabled = false;
    bouton.removeAttribute('aria-busy');
    if (bouton.dataset.texteInitial) bouton.textContent = bouton.dataset.texteInitial;
  }

  function montrer(id, visible) {
    var element = $(id);
    if (element) element.classList.toggle('cache', !visible);
  }

  function formaterDate(valeur) {
    if (!valeur) return 'date inconnue';
    try {
      var objet = new Date(valeur);
      if (isNaN(objet.getTime())) return 'date inconnue';
      return objet.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return 'date inconnue';
    }
  }

  function estDirecteur() {
    var roles = ArdoiseSession.roles ? ArdoiseSession.roles() : [];
    return roles.indexOf('directeur') !== -1;
  }

  function configurerSelonRole() {
    if (estDirecteur()) {
      $('libelle-action-tickets').textContent = 'Demandes de l’école';
      $('titre-liste-tickets').textContent = 'Demandes de l’école';
    }

    var lienAbonnements = $('lien-abonnements');
    var acces = window.ArdoiseAcces;
    var peutGerer = acces && typeof acces.peutGererAbonnements === 'function'
      ? acces.peutGererAbonnements(ArdoiseSession.roles())
      : estDirecteur();
    if (lienAbonnements && !peutGerer) {
      lienAbonnements.hidden = true;
      lienAbonnements.style.display = 'none';
    }
  }

  function mettreAJourConnexion() {
    montrer('etat-connexion', !navigator.onLine);
  }

  function mettreAJourCompteur(champ, compteur, maximum) {
    var entree = $(champ);
    var sortie = $(compteur);
    if (!entree || !sortie) return;
    var longueur = entree.value.length.toLocaleString('fr-FR');
    sortie.textContent = longueur + ' / ' + maximum.toLocaleString('fr-FR');
  }

  /* ------------------------------------------------------------- Accueil */

  function renduMotifs() {
    $('motifs').innerHTML = MOTIFS.map(function (m) {
      var choisi = motif === m.cle;
      return '<button type="button" class="motif' + (choisi ? ' actif' : '') + '" data-motif="' + m.cle + '"'
        + ' aria-pressed="' + (choisi ? 'true' : 'false') + '">'
        + '<strong>' + esc(m.titre) + '</strong><span>' + esc(m.aide) + '</span></button>';
    }).join('');

    Array.prototype.forEach.call($('motifs').querySelectorAll('[data-motif]'), function (bouton) {
      bouton.addEventListener('click', function () { choisirMotif(bouton.dataset.motif); });
    });
  }

  function choisirMotif(cle) {
    motif = MOTIFS.some(function (m) { return m.cle === cle; }) ? cle : 'autre';
    var choisi = MOTIFS.find(function (m) { return m.cle === motif; }) || MOTIFS[MOTIFS.length - 1];
    renduMotifs();
    $('motif-choisi').textContent = choisi.titre;

    var champSujet = $('sujet');
    if (champSujet && (!champSujet.value.trim() || champSujet.value === dernierSujetAutomatique)) {
      champSujet.value = choisi.titre;
      dernierSujetAutomatique = choisi.titre;
      mettreAJourCompteur('sujet', 'compteur-sujet', 300);
    }

    montrer('nouvelle-demande', true);
    montrer('centre-tickets', false);
    $('action-tickets').setAttribute('aria-expanded', 'false');
    setTimeout(function () {
      $('nouvelle-demande').scrollIntoView({ behavior: 'smooth', block: 'start' });
      try { $('sujet').focus({ preventScroll: true }); } catch (e) { $('sujet').focus(); }
    }, 40);
  }

  function afficherListe(recharger) {
    motif = null;
    renduMotifs();
    montrer('nouvelle-demande', false);
    montrer('centre-tickets', true);
    $('action-tickets').setAttribute('aria-expanded', 'true');
    if (recharger || !listeChargee) chargerListe(false).catch(function () {});
  }

  function afficherAccueil() {
    montrer('centre-tickets', false);
    montrer('nouvelle-demande', false);
    $('action-tickets').setAttribute('aria-expanded', 'false');
    motif = null;
    renduMotifs();
    $('accueil-support').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* -------------------------------------------------------------- Liste */

  function signatureDe(liste) {
    return liste.map(function (ticket) {
      return [ticket.id, ticket.statut, ticket.updated_at, ticket.nb_messages].join(':');
    }).join('|');
  }

  function renduErreurListe(message) {
    $('tickets').innerHTML = '<div class="vide etat-erreur-support">'
      + '<strong>Impossible de charger les demandes</strong><span>' + esc(message) + '</span>'
      + '<button type="button" class="bouton bouton-secondaire bouton-petit" id="reessayer-liste">Réessayer</button>'
      + '</div>';
    $('reessayer-liste').addEventListener('click', function () { chargerListe(false).catch(function () {}); });
  }

  function chargerListe(silencieux) {
    if (chargementListe) return chargementListe;
    if (!silencieux) $('tickets').innerHTML = '<div class="vide support-chargement">Chargement de vos demandes…</div>';
    $('tickets').setAttribute('aria-busy', 'true');

    chargementListe = api('/abonnements/support/tickets').then(function (reponse) {
      var liste = Array.isArray(reponse.donnees) ? reponse.donnees : [];
      listeChargee = true;
      $('compteur-tickets').textContent = liste.length ? '(' + liste.length + ')' : '';

      var signature = signatureDe(liste);
      if (silencieux && signature === signatureListe) return liste;
      signatureListe = signature;

      if (!liste.length) {
        actif = null;
        montrer('detail', false);
        montrer('detail-vide', true);
        $('tickets').innerHTML = '<div class="vide etat-vide">Aucune demande pour le moment.<br>'
          + '<button type="button" class="bouton bouton-principal" id="creer-premier">Créer une demande</button></div>';
        $('creer-premier').addEventListener('click', afficherAccueil);
        return liste;
      }

      if (actif && !liste.some(function (ticket) { return String(ticket.id) === String(actif); })) {
        actif = null;
        montrer('detail', false);
        montrer('detail-vide', true);
      }

      $('tickets').innerHTML = liste.map(function (ticket) {
        var statut = ticket.statut in STATUTS ? ticket.statut : 'ouvert';
        return '<button type="button" class="ticket' + (String(ticket.id) === String(actif) ? ' actif' : '') + '"'
          + ' data-id="' + esc(ticket.id) + '" aria-pressed="' + (String(ticket.id) === String(actif) ? 'true' : 'false') + '">'
          + '<div class="ticket-top"><strong>' + esc(ticket.sujet) + '</strong>'
          + '<span class="badge statut-' + esc(statut) + '">' + esc(STATUTS[ticket.statut] || 'Ouvert') + '</span></div>'
          + '<div class="ticket-meta"><span class="code">' + esc(ticket.reference) + '</span>'
          + '<br>Mis à jour le ' + formaterDate(ticket.updated_at) + '</div></button>';
      }).join('');

      Array.prototype.forEach.call($('tickets').querySelectorAll('.ticket'), function (bouton) {
        bouton.addEventListener('click', function () { ouvrir(bouton.dataset.id, true); });
      });
      return liste;
    }).catch(function (erreur) {
      listeChargee = false;
      renduErreurListe(erreur.message);
      throw erreur;
    }).finally(function () {
      $('tickets').removeAttribute('aria-busy');
      chargementListe = null;
    });
    return chargementListe;
  }

  /* -------------------------------------------------------- Conversation */

  function ouvrir(id, defiler) {
    if (!id) return Promise.resolve(null);
    var conversationDejaAffichee = String(actif) === String(id)
      && !$('detail').classList.contains('cache')
      && !!signatureDetail;
    actif = id;
    Array.prototype.forEach.call(document.querySelectorAll('.ticket'), function (ticket) {
      var selectionne = ticket.dataset.id === String(id);
      ticket.classList.toggle('actif', selectionne);
      ticket.setAttribute('aria-pressed', selectionne ? 'true' : 'false');
    });
    montrer('detail-vide', false);
    montrer('detail', true);
    $('detail').setAttribute('aria-busy', 'true');
    if (!conversationDejaAffichee) {
      $('detail-entete').innerHTML = '<div class="support-chargement">Ouverture de la conversation…</div>';
      $('messages').innerHTML = '';
    }

    var requete = api('/abonnements/support/tickets/' + encodeURIComponent(id));
    chargementDetail = requete;

    return requete.then(function (reponse) {
      if (chargementDetail !== requete || String(actif) !== String(id)) return reponse;
      if (!reponse.ticket) throw new Error('La réponse du serveur est incomplète.');
      var messages = Array.isArray(reponse.messages) ? reponse.messages : [];
      var signature = [reponse.ticket.statut, reponse.ticket.updated_at,
        messages.length, messages.length ? messages[messages.length - 1].id : ''].join('|');
      if (signature === signatureDetail && !defiler) return reponse;
      signatureDetail = signature;

      var statut = reponse.ticket.statut in STATUTS ? reponse.ticket.statut : 'ouvert';
      $('detail-entete').innerHTML = '<div class="conversation-titre">'
        + '<div><h3>' + esc(reponse.ticket.sujet) + '</h3>'
        + '<div class="aide"><span class="code">' + esc(reponse.ticket.reference) + '</span>'
        + ' · Mis à jour le ' + formaterDate(reponse.ticket.updated_at) + '</div></div>'
        + '<span class="badge statut-' + esc(statut) + '">' + esc(STATUTS[reponse.ticket.statut] || 'Ouvert') + '</span></div>';

      $('messages').innerHTML = messages.map(function (message) {
        var vientSupport = message.cote === 'support';
        return '<article class="msg ' + (vientSupport ? 'support' : 'client') + '">'
          + '<div>' + esc(message.contenu) + '</div>'
          + '<small>' + esc(message.auteur || (vientSupport ? 'Support Ardoise' : 'Vous'))
          + ' · ' + formaterDate(message.created_at) + '</small></article>';
      }).join('') || '<div class="vide">Aucun message dans cette conversation.</div>';

      $('messages').scrollTop = $('messages').scrollHeight;
      var ferme = reponse.ticket.statut === 'ferme';
      montrer('zone-reponse', !ferme);
      montrer('ticket-ferme', ferme);

      if (defiler && window.matchMedia('(max-width:780px)').matches) {
        setTimeout(function () { $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
      }
      return reponse;
    }).catch(function (erreur) {
      if (chargementDetail !== requete) return null;
      $('detail-entete').innerHTML = '<div class="etat-erreur-support"><strong>Conversation indisponible</strong>'
        + '<span>' + esc(erreur.message) + '</span>'
        + '<button type="button" class="bouton bouton-secondaire bouton-petit" id="reessayer-detail">Réessayer</button></div>';
      $('reessayer-detail').addEventListener('click', function () { ouvrir(id, false); });
      flash(erreur.message, 'erreur');
      return null;
    }).finally(function () {
      if (chargementDetail === requete) {
        chargementDetail = null;
        $('detail').removeAttribute('aria-busy');
      }
    });
  }

  /* ------------------------------------------------------------ Actions */

  function creerTicket() {
    var formulaire = $('form-demande');
    var sujet = $('sujet').value.trim();
    var description = $('description').value.trim();
    if (!formulaire.checkValidity() || sujet.length < 4 || description.length < 8) {
      formulaire.reportValidity();
      flash('Complétez le sujet et la description avant l’envoi.', 'erreur');
      return;
    }
    if (!navigator.onLine) {
      flash('Vous êtes hors connexion. Reconnectez-vous avant l’envoi.', 'erreur');
      return;
    }

    var bouton = $('creer');
    setBusy(bouton, true, 'Envoi au support…');

    api('/abonnements/support/tickets', {
      method: 'POST',
      body: { categorie: motif || 'autre', sujet: sujet, description: description }
    }).then(function (reponse) {
      if (!reponse.ticket || !reponse.ticket.id) throw new Error('La demande a été reçue, mais son suivi ne peut pas encore être ouvert.');
      formulaire.reset();
      dernierSujetAutomatique = '';
      mettreAJourCompteur('sujet', 'compteur-sujet', 300);
      mettreAJourCompteur('description', 'compteur-description', 10000);
      flash(reponse.message || 'Demande envoyée.', 'succes');
      afficherListe(false);
      signatureListe = '';
      listeChargee = false;
      return chargerListe(true).then(function () { return ouvrir(reponse.ticket.id, true); });
    }).catch(function (erreur) {
      flash(erreur.message, 'erreur');
    }).finally(function () { setBusy(bouton, false); });
  }

  function repondre() {
    if (!actif) return;
    var formulaire = $('form-reponse');
    var contenu = $('reponse').value.trim();
    if (!formulaire.checkValidity() || contenu.length < 2) {
      formulaire.reportValidity();
      flash('Écrivez votre message avant de l’envoyer.', 'erreur');
      return;
    }
    if (!navigator.onLine) {
      flash('Vous êtes hors connexion. Votre message n’a pas été envoyé.', 'erreur');
      return;
    }
    var bouton = $('envoyer-reponse');
    setBusy(bouton, true, 'Envoi…');
    api('/abonnements/support/tickets/' + encodeURIComponent(actif) + '/messages', {
      method: 'POST', body: { contenu: contenu }
    }).then(function () {
      formulaire.reset();
      signatureDetail = '';
      signatureListe = '';
      flash('Message envoyé. L’équipe Ardoise a été avertie.', 'succes');
      return Promise.all([ouvrir(actif, false), chargerListe(true)]);
    }).catch(function (erreur) {
      flash(erreur.message, 'erreur');
    }).finally(function () { setBusy(bouton, false); });
  }

  /* ------------------------------------------------------------ Câblage */

  $('action-tickets').addEventListener('click', function () { afficherListe(true); });
  $('action-nouveau').addEventListener('click', afficherAccueil);
  $('changer-motif').addEventListener('click', afficherAccueil);
  $('annuler-nouveau').addEventListener('click', afficherListe);
  $('form-demande').addEventListener('submit', function (e) { e.preventDefault(); creerTicket(); });
  $('form-reponse').addEventListener('submit', function (e) { e.preventDefault(); repondre(); });
  $('sujet').addEventListener('input', function () { mettreAJourCompteur('sujet', 'compteur-sujet', 300); });
  $('description').addEventListener('input', function () { mettreAJourCompteur('description', 'compteur-description', 10000); });
  $('reponse').addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      $('form-reponse').requestSubmit();
    }
  });
  $('bouton-deconnexion-nav').addEventListener('click', function () { ArdoiseSession.terminer(); });
  window.addEventListener('online', function () {
    mettreAJourConnexion();
    if (!listeChargee) chargerListe(true).catch(function () {});
  });
  window.addEventListener('offline', mettreAJourConnexion);

  configurerSelonRole();
  mettreAJourConnexion();
  mettreAJourCompteur('sujet', 'compteur-sujet', 300);
  mettreAJourCompteur('description', 'compteur-description', 10000);
  renduMotifs();
  chargerListe(false).then(function (liste) {
    if (liste && liste.length) afficherListe(false);
  }).catch(function (erreur) {
    flash(erreur.message, 'erreur');
  });

  setInterval(function () {
    if (document.hidden || !navigator.onLine || chargementListe || chargementDetail) return;
    if ($('centre-tickets').classList.contains('cache')) return;
    var zone = $('reponse');
    if (zone && (document.activeElement === zone || zone.value.trim())) return;

    chargerListe(true).then(function () {
      if (actif) return ouvrir(actif, false);
    }).catch(function () {});
  }, 20000);
})();