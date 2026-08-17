/**
 * Ardoise — page Support.
 *
 * CE N'EST PAS UN SYSTÈME DE TICKETS, C'EST UNE CONVERSATION
 * ---------------------------------------------------------------------------
 * La version précédente ouvrait sur deux boutons (« Nouvelle demande » / « Mes
 * demandes »), un formulaire à cinq champs dont un sélecteur de priorité
 * basse/normale/haute/urgente, et une liste affichant « attente_client ».
 * C'était le vocabulaire de l'outil, pas celui de l'école.
 *
 * L'école voit maintenant d'abord la question qui la concerne — « Comment
 * pouvons-nous vous aider ? » — puis, une fois le sujet choisi, un champ pour
 * raconter. La priorité n'est plus demandée : le serveur la déduit
 * (`utils/renouvellements.regles.js`). Une échelle où chacun s'auto-évalue
 * finit avec tout en « urgente » et ne trie plus rien.
 *
 * La liste se rafraîchit en arrière-plan sans jamais redessiner ce qui n'a pas
 * changé, ni interrompre une réponse en cours de frappe.
 */
(function () {
  'use strict';
  if (!window.ArdoiseSession || !ArdoiseSession.connecte()) { location.replace('connexion.html'); return; }

  var $ = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function api(path, opt) {
    return ArdoiseSession.appelApi(path, opt || {}).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.message || 'Opération impossible.'); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  /* Les statuts, dits comme l'école les comprend. « attente_client » ne veut
     rien dire pour un directeur : ce qu'il doit savoir, c'est qu'on attend
     quelque chose DE LUI. */
  var STATUTS = {
    ouvert: 'Ouvert',
    en_cours: 'En cours',
    attente_client: 'En attente de votre réponse',
    resolu: 'Résolu',
    ferme: 'Clôturé'
  };

  /* Les entrées d'accueil. Elles reprennent les catégories acceptées par le
     serveur (`CATEGORIES_SUPPORT`) — un libellé qui ne correspondrait à aucune
     retomberait silencieusement sur « autre ». */
  var MOTIFS = [
    { cle: 'technique', titre: 'Problème technique', aide: 'Une page ne s’ouvre pas, un bouton ne répond plus.' },
    { cle: 'facturation', titre: 'Paiement et abonnement', aide: 'Renouvellement, facture, offre.' },
    { cle: 'compte', titre: 'Compte et accès', aide: 'Connexion, mot de passe, utilisateurs.' },
    { cle: 'notes', titre: 'Notes et bulletins', aide: 'Saisie, calcul, impression des bulletins.' },
    { cle: 'donnees', titre: 'Données de l’école', aide: 'Élèves, classes, années scolaires.' },
    { cle: 'formation', titre: 'Formation / utilisation', aide: 'Comment faire telle ou telle chose.' },
    { cle: 'autre', titre: 'Autre', aide: 'Tout ce qui n’entre pas dans les cases ci-dessus.' }
  ];

  var actif = null;
  var motif = null;
  var signatureListe = '';
  var signatureDetail = '';

  function flash(message, type) {
    var e = $('message-flash');
    if (!e) return;
    e.textContent = message;
    e.style.background = type === 'erreur' ? 'var(--rouge)' : type === 'succes' ? 'var(--vert-ok)' : 'var(--ardoise)';
    e.classList.add('visible');
    clearTimeout(e._t);
    e._t = setTimeout(function () { e.classList.remove('visible'); }, 4500);
  }

  function setBusy(btn, on, texte) {
    if (!btn) return;
    if (on) { btn.dataset.texte = btn.textContent; btn.disabled = true; btn.textContent = texte || 'Traitement…'; }
    else { btn.disabled = false; if (btn.dataset.texte) btn.textContent = btn.dataset.texte; }
  }

  function montrer(id, visible) { var e = $(id); if (e) e.classList.toggle('cache', !visible); }

  function date(v) {
    try { return new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); }
    catch (e) { return ''; }
  }

  /* ------------------------------------------------------------- Accueil */

  function renduMotifs() {
    $('motifs').innerHTML = MOTIFS.map(function (m) {
      return '<button type="button" class="motif' + (motif === m.cle ? ' actif' : '') + '" data-motif="' + m.cle + '">'
        + '<strong>' + esc(m.titre) + '</strong><span>' + esc(m.aide) + '</span></button>';
    }).join('');

    Array.prototype.forEach.call($('motifs').querySelectorAll('[data-motif]'), function (b) {
      b.addEventListener('click', function () { choisirMotif(b.dataset.motif); });
    });
  }

  function choisirMotif(cle) {
    motif = cle;
    var m = MOTIFS.find(function (x) { return x.cle === cle; }) || MOTIFS[MOTIFS.length - 1];
    renduMotifs();
    $('motif-choisi').textContent = m.titre;
    montrer('nouvelle-demande', true);
    montrer('centre-tickets', false);
    setTimeout(function () {
      $('nouvelle-demande').scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('sujet').focus({ preventScroll: true });
    }, 40);
  }

  function afficherListe() {
    motif = null;
    renduMotifs();
    montrer('nouvelle-demande', false);
    montrer('centre-tickets', true);
  }

  function afficherAccueil() {
    montrer('centre-tickets', false);
    montrer('nouvelle-demande', false);
    motif = null;
    renduMotifs();
    $('accueil-support').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* -------------------------------------------------------------- Liste */

  function signatureDe(liste) {
    return liste.map(function (t) { return [t.id, t.statut, t.updated_at, t.nb_messages].join(':'); }).join('|');
  }

  function chargerListe(silencieux) {
    if (!silencieux) $('tickets').innerHTML = '<div class="vide">Chargement de vos demandes…</div>';

    return api('/abonnements/support/tickets').then(function (r) {
      var l = r.donnees || [];

      $('compteur-tickets').textContent = l.length ? '(' + l.length + ')' : '';

      // Rien n'a bougé : on ne touche pas au DOM. C'est ce qui évite le
      // clignotement de la liste toutes les quinze secondes.
      var sig = signatureDe(l);
      if (silencieux && sig === signatureListe) return l;
      signatureListe = sig;

      if (!l.length) {
        $('tickets').innerHTML = '<div class="vide etat-vide">Aucune demande pour le moment.<br>'
          + '<button type="button" class="bouton bouton-principal" id="creer-premier" style="margin-top:12px">'
          + 'Créer une demande</button></div>';
        var p = $('creer-premier');
        if (p) p.addEventListener('click', afficherAccueil);
        return l;
      }

      $('tickets').innerHTML = l.map(function (t) {
        return '<button type="button" class="ticket' + (t.id === actif ? ' actif' : '') + '" data-id="' + esc(t.id) + '">'
          + '<div class="ticket-top"><strong>' + esc(t.sujet) + '</strong>'
          + '<span class="badge">' + esc(STATUTS[t.statut] || t.statut) + '</span></div>'
          + '<div class="ticket-meta"><span class="code">' + esc(t.reference) + '</span>'
          + '<br>Dernière réponse ' + date(t.updated_at) + '</div></button>';
      }).join('');

      Array.prototype.forEach.call($('tickets').querySelectorAll('.ticket'), function (x) {
        x.addEventListener('click', function () { ouvrir(x.dataset.id, true); });
      });
      return l;
    }).catch(function (e) {
      $('tickets').innerHTML = '<div class="erreur aide">' + esc(e.message) + '</div>';
      throw e;
    });
  }

  /* -------------------------------------------------------- Conversation */

  function ouvrir(id, defiler) {
    actif = id;
    Array.prototype.forEach.call(document.querySelectorAll('.ticket'), function (t) {
      t.classList.toggle('actif', t.dataset.id === id);
    });
    montrer('detail-vide', false);
    montrer('detail', true);

    return api('/abonnements/support/tickets/' + encodeURIComponent(id)).then(function (r) {
      var sig = [r.ticket.statut, r.ticket.updated_at, (r.messages || []).length].join('|');
      if (sig === signatureDetail && !defiler) return r;   // conversation inchangée
      signatureDetail = sig;

      $('detail-entete').innerHTML =
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">'
        + '<div><h3 style="margin:0 0 5px">' + esc(r.ticket.sujet) + '</h3>'
        + '<div class="aide"><span class="code">' + esc(r.ticket.reference) + '</span>'
        + ' · Dernière réponse ' + date(r.ticket.updated_at) + '</div></div>'
        + '<span class="badge">' + esc(STATUTS[r.ticket.statut] || r.ticket.statut) + '</span></div>';

      $('messages').innerHTML = (r.messages || []).map(function (m) {
        // « support » = Ardoise, « client » = l'école. Les deux sont
        // visuellement distincts mais partagent la même bulle : c'est une
        // conversation, pas deux systèmes qui se parlent.
        return '<div class="msg ' + (m.cote === 'support' ? 'support' : '') + '">'
          + esc(m.contenu)
          + '<small>' + esc(m.auteur || (m.cote === 'support' ? 'Ardoise' : 'Vous'))
          + ' · ' + date(m.created_at) + '</small></div>';
      }).join('') || '<div class="vide">Aucun message.</div>';

      $('messages').scrollTop = $('messages').scrollHeight;
      montrer('zone-reponse', r.ticket.statut !== 'ferme');

      if (defiler && window.matchMedia('(max-width:780px)').matches) {
        setTimeout(function () { $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
      }
      return r;
    }).catch(function (e) {
      $('detail-entete').innerHTML = '<div class="erreur">' + esc(e.message) + '</div>';
      flash(e.message, 'erreur');
    });
  }

  /* ------------------------------------------------------------ Actions */

  function creerTicket() {
    var btn = $('creer');
    var sujet = $('sujet').value.trim();
    var description = $('description').value.trim();

    if (sujet.length < 4 || description.length < 8) {
      flash('Ajoutez un sujet clair et quelques détails sur le problème.', 'erreur');
      return;
    }
    setBusy(btn, true, 'Envoi au support…');

    // Aucune priorité n'est transmise : le serveur l'ignorerait de toute façon.
    api('/abonnements/support/tickets', {
      method: 'POST',
      body: { categorie: motif || 'autre', sujet: sujet, description: description }
    }).then(function (r) {
      $('sujet').value = '';
      $('description').value = '';
      flash(r.message || 'Demande envoyée.', 'succes');
      afficherListe();
      signatureListe = '';
      return chargerListe(true).then(function () { return ouvrir(r.ticket.id, true); });
    }).catch(function (e) {
      flash(e.message, 'erreur');
    }).finally(function () { setBusy(btn, false); });
  }

  function repondre() {
    if (!actif) return;
    var contenu = $('reponse').value.trim();
    var btn = $('envoyer-reponse');
    if (contenu.length < 2) { flash('Écrivez votre message avant de l’envoyer.', 'erreur'); return; }

    setBusy(btn, true, 'Envoi…');
    api('/abonnements/support/tickets/' + encodeURIComponent(actif) + '/messages', {
      method: 'POST', body: { contenu: contenu }
    }).then(function () {
      $('reponse').value = '';
      signatureDetail = '';
      signatureListe = '';
      flash('Message envoyé. Ardoise a été averti.', 'succes');
      return Promise.all([ouvrir(actif, false), chargerListe(true)]);
    }).catch(function (e) {
      flash(e.message, 'erreur');
    }).finally(function () { setBusy(btn, false); });
  }

  /* ------------------------------------------------------------ Câblage */

  $('action-tickets').addEventListener('click', afficherListe);
  $('action-nouveau').addEventListener('click', afficherAccueil);
  $('changer-motif').addEventListener('click', afficherAccueil);
  $('annuler-nouveau').addEventListener('click', afficherListe);
  $('creer').addEventListener('click', creerTicket);
  $('envoyer-reponse').addEventListener('click', repondre);
  $('reponse').addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); repondre(); }
  });
  $('bouton-deconnexion-nav').addEventListener('click', function () { ArdoiseSession.terminer(); });

  renduMotifs();
  chargerListe(false).then(function (l) {
    // Une école qui a déjà des demandes en cours veut d'abord les voir ; une
    // école qui n'en a aucune veut l'accueil, pas une liste vide.
    if (l && l.length) afficherListe();
  }).catch(function () {});

  /* Rafraîchissement de fond : jamais pendant une frappe, jamais si rien n'a
     changé. Les deux conditions ensemble suppriment le clignotement que
     l'ancienne version produisait toutes les quinze secondes. */
  setInterval(function () {
    if (document.hidden) return;
    var zone = $('reponse');
    if (zone && (document.activeElement === zone || zone.value.trim())) return;
    if ($('nouvelle-demande') && !$('nouvelle-demande').classList.contains('cache')) return;

    chargerListe(true).then(function () {
      if (actif) return ouvrir(actif, false);
    }).catch(function () {});
  }, 20000);
})();
