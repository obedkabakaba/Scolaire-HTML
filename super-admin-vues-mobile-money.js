/* Super Admin — boîte de réception Mobile Money.
 *
 * POURQUOI CET ÉCRAN EXISTE
 * ---------------------------------------------------------------------------
 * Le serveur reçoit, du téléphone relais, une preuve pour chaque SMS de dépôt
 * (Orange Money, Airtel Money, M-Pesa) et la rapproche de la référence que
 * l'école a saisie. Tout cela se passait sans écran : une anomalie de montant,
 * une école qui attend un SMS jamais relayé, un téléphone éteint depuis deux
 * jours — rien ne se voyait avant qu'une école n'appelle.
 *
 * Quatre questions, dans l'ordre où on se les pose :
 *
 *   1. Le téléphone relais fonctionne-t-il ?
 *   2. Quelles écoles attendent une confirmation qui n'arrive pas ?
 *   3. Quelles preuves sont en anomalie ?
 *   4. Que s'est-il passé récemment ?
 *
 * LE RATTRAPAGE
 * ---------------------------------------------------------------------------
 * L'automatisation iPhone peut ne pas se déclencher, et elle ne relit jamais
 * la messagerie. « Coller un SMS » envoie le texte au MÊME moteur que le
 * téléphone : il n'active que ce qu'une école attend, au bon montant et dans
 * la bonne devise. Pour activer sans preuve, la fiche du renouvellement reste
 * la seule porte.
 */
(function enregistrerQuandPret() {
  'use strict';
  if (!window.SA || typeof SA.enregistrerVue !== 'function') {
    setTimeout(enregistrerQuandPret, 30);
    return;
  }
  if (SA.vues && SA.vues.has && SA.vues.has('mobile-money')) return;

  var ui = SA.ui, esc = SA.esc;

  var LIB_STATUT = {
    non_rapprochee: 'En attente de l’école',
    rapprochee: 'Rapprochée',
    anomalie: 'Anomalie'
  };
  var TON_STATUT = { non_rapprochee: 'info', rapprochee: 'succes', anomalie: 'danger' };

  var LIB_RESEAU = { orange_money: 'Orange Money', airtel_money: 'Airtel Money', mpesa: 'M-Pesa' };

  var LIB_ANOMALIE = {
    reference_ok_montant_ou_devise_differents: 'Montant ou devise différent de la demande',
    doublon_reference_donnees_differentes: 'Même référence reçue deux fois avec des montants différents',
    plusieurs_demandes_meme_reference: 'Plusieurs écoles ont déclaré cette référence'
  };

  var LIB_SOURCE = {
    saisie_super_admin: 'Saisie manuelle',
    orange_money_shortcuts: 'iPhone', airtel_money_shortcuts: 'iPhone', mpesa_shortcuts: 'iPhone',
    orange_money_android: 'Android', airtel_money_android: 'Android', mpesa_android: 'Android'
  };

  var ONGLETS = [
    { cle: 'tous', titre: 'Toutes' },
    { cle: 'anomalie', titre: 'Anomalies' },
    { cle: 'en_attente', titre: 'En attente' },
    { cle: 'rapprochee', titre: 'Rapprochées' }
  ];

  function argent(v, devise) { return esc(SA.fmt.montant(v, devise)); }
  function relatif(v) { return esc(SA.fmt.relatif(v)); }

  /* ================================================== COLLER UN SMS */

  function modaleSaisie(referenceAttendue, apres) {
    var contenu =
      '<p class="sa-texte">Collez le SMS de l’opérateur <strong>tel que vous l’avez reçu</strong>. '
      + 'Ardoise en lit le montant, la devise et la référence, puis l’applique exactement comme '
      + 'si le téléphone l’avait relayé.</p>'
      + (referenceAttendue
        ? '<p class="sa-texte sa-muet">Référence déclarée par l’école : <span class="sa-mono">'
          + esc(referenceAttendue) + '</span></p>'
        : '')
      + '<label class="sa-champ"><span>Texte du SMS</span>'
      + '<textarea id="mm-sms" rows="5" data-sans-ia spellcheck="false" autocomplete="off" placeholder="Vous avez recu 50 USD de 0850000000 . Nouveau solde: … . Ref: PP2610…"></textarea></label>'
      + '<label class="sa-champ"><span>Réseau</span><select id="mm-reseau">'
      + '<option value="">Déduire du SMS (Orange par défaut)</option>'
      + '<option value="orange_money">Orange Money</option>'
      + '<option value="airtel_money">Airtel Money</option>'
      + '<option value="mpesa">M-Pesa</option></select></label>'
      + '<div id="mm-resultat"></div>'
      + '<p data-erreur class="sa-erreur-modale" hidden></p>';

    var m = SA.modale({
      titre: 'Coller un SMS reçu',
      sousTitre: 'Rattrapage d’un paiement que le téléphone n’a pas relayé',
      contenu: contenu,
      actions: '<button class="sa-bouton sa-bouton-secondaire" data-annuler>Fermer</button>'
        + '<button class="sa-bouton sa-bouton-principal" data-ok>Enregistrer la preuve</button>'
    });

    m.querySelector('[data-annuler]').onclick = function () { m.fermer(); };
    m.querySelector('[data-ok]').onclick = async function () {
      var bouton = this, erreur = m.querySelector('[data-erreur]');
      var resultat = m.querySelector('#mm-resultat');
      erreur.hidden = true;
      resultat.innerHTML = '';
      var sms = m.querySelector('#mm-sms').value.trim();
      if (sms.length < 10) {
        erreur.hidden = false;
        erreur.textContent = 'Collez le texte complet du SMS.';
        return;
      }
      bouton.disabled = true;
      try {
        var corps = { sms: sms, confirmation: true };
        var reseau = m.querySelector('#mm-reseau').value;
        if (reseau) corps.reseau = reseau;
        var r = await SA.api('/super-admin/mobile-money/receptions/saisie',
          { method: 'POST', body: JSON.stringify(corps) });
        var recu = r.recu || {};
        resultat.innerHTML = '<div class="mm-lu">'
          + '<div><small>Montant lu</small><strong>' + argent(recu.montant, recu.devise) + '</strong></div>'
          + '<div><small>Référence lue</small><strong class="sa-mono">' + esc(recu.reference || '—') + '</strong></div>'
          + '<div><small>Réseau</small><strong>' + esc(LIB_RESEAU[recu.reseau] || recu.reseau || '—') + '</strong></div>'
          + '</div>'
          + '<p class="sa-texte">' + ui.badge(r.matched ? 'Abonnement activé' : (r.anomalie ? 'Anomalie' : 'Enregistrée'),
            r.matched ? 'succes' : (r.anomalie ? 'danger' : 'info')) + ' ' + esc(r.message || '') + '</p>';
        SA.toast(r.resume || r.message || 'Preuve enregistrée.', r.matched ? 'succes' : 'info');
        m.querySelector('#mm-sms').value = '';
        if (typeof apres === 'function') apres();
      } catch (e) {
        erreur.hidden = false;
        erreur.textContent = e.message || 'Lecture du SMS impossible.';
      } finally {
        bouton.disabled = false;
      }
    };
    setTimeout(function () { var t = m.querySelector('#mm-sms'); if (t) t.focus(); }, 50);
  }

  /* ============================================================ LA VUE */

  SA.enregistrerVue('mobile-money', {
    titre: 'Mobile Money',
    sousTitre: 'Preuves de dépôt relayées par le téléphone, rapprochement automatique et rattrapage.',

    async rendu(conteneur, params) {
      clearInterval(window.__ardoiseMobileMoneyTimer);
      var filtre = params.statut || 'tous';
      var empreinte = '';

      conteneur.innerHTML = ui.squeletteCartes(4) + ui.squelette(6, 52);

      function blocRelais(r) {
        var appareils = r.appareils || [];
        var depot = r.depot || {};
        var relais = r.relais || {};

        var config = !depot.disponible
          ? '<div class="mm-alerte ton-danger">Aucun numéro de dépôt configuré : les écoles ne peuvent pas payer par dépôt. '
            + 'Renseignez <span class="sa-mono">RENOUVELLEMENT_DEPOT_NUMERO</span> sur le serveur.</div>'
          : !depot.methode
            ? '<div class="mm-alerte ton-attention">Le réseau du numéro de dépôt n’est pas reconnu : '
              + 'le rapprochement automatique est désactivé. Renseignez '
              + '<span class="sa-mono">RENOUVELLEMENT_DEPOT_METHODE</span> (orange_money, airtel_money ou mpesa).</div>'
            : '<div class="mm-depot"><span>Compte de dépôt</span><strong class="sa-mono">' + esc(depot.numero) + '</strong>'
              + '<span>' + esc(LIB_RESEAU[depot.methode] || depot.reseau || '') + (depot.nom ? ' · ' + esc(depot.nom) : '') + '</span></div>';

        var liste = appareils.length
          ? appareils.map(function (a) {
            return '<div class="mm-appareil">'
              + '<div><strong>' + esc(a.nom || a.id) + '</strong>'
              + '<span class="sa-muet">' + esc([a.plateforme, a.version].filter(Boolean).join(' · ') || a.id) + '</span></div>'
              + '<div>' + ui.badge(a.en_ligne ? 'En ligne' : 'Muet', a.en_ligne ? 'succes' : 'danger') + '</div>'
              + '<div><small>Dernier signe de vie</small><span>' + relatif(a.derniere_activite_at) + '</span></div>'
              + '<div><small>Dernier SMS relayé</small><span>' + relatif(a.derniere_reception_at) + '</span></div>'
              + '<div><small>SMS relayés</small><span>' + SA.fmt.nombre(a.receptions_total) + '</span></div>'
              + (a.derniere_erreur ? '<div class="mm-erreur"><small>Dernière erreur</small><span>' + esc(a.derniere_erreur) + '</span></div>' : '')
              + '</div>';
          }).join('')
          : '<p class="sa-texte sa-muet">Aucun téléphone ne s’est encore identifié. '
            + (relais.dernier_relais_at
              ? 'Dernier SMS relayé : <strong>' + relatif(relais.dernier_relais_at) + '</strong>. '
              : 'Aucun SMS relayé pour l’instant. ')
            + 'Ajoutez <span class="sa-mono">appareil_id</span> au raccourci iPhone pour suivre son état ici.</p>';

        return '<section class="sa-section mm-bloc"><div class="mm-bloc-titre"><h3>Téléphone relais</h3>'
          + '<button type="button" class="sa-bouton sa-bouton-principal sa-bouton-petit" data-coller>Coller un SMS reçu</button></div>'
          + config + liste + '</section>';
      }

      function blocAttentes(attentes) {
        if (!attentes || !attentes.length) return '';
        return '<section class="sa-section mm-bloc"><div class="mm-bloc-titre"><h3>Écoles qui attendent leur confirmation</h3>'
          + '<span class="sa-muet">Référence déclarée, aucun SMS correspondant reçu</span></div>'
          + '<div class="mm-attentes">'
          + attentes.map(function (a) {
            return '<div class="mm-attente">'
              + '<div><strong>' + esc(a.ecole_nom) + '</strong><span class="sa-muet sa-mono">' + esc(a.ecole_code || '') + '</span></div>'
              + '<div><small>Référence</small><span class="sa-mono">' + esc(a.reference_transaction || '—') + '</span></div>'
              + '<div><small>Montant</small><span>' + argent(a.montant_attendu, a.devise) + '</span></div>'
              + '<div><small>Depuis</small><span>' + relatif(a.updated_at) + '</span></div>'
              + '<button type="button" class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-coller-ref="'
              + esc(a.reference_transaction || '') + '">Coller son SMS</button>'
              + '</div>';
          }).join('')
          + '</div><p class="sa-texte sa-muet">Cherchez la référence dans la messagerie du téléphone de dépôt. '
          + 'Si le SMS n’existe pas, l’école s’est peut-être trompée : elle peut corriger sa référence elle-même, '
          + 'trois fois au plus.</p></section>';
      }

      function tableauReceptions(lignes) {
        return ui.tableau({
          vide: 'Aucune preuve dans cette vue',
          lignes: lignes,
          colonnes: [
            { cle: 'recu_at', titre: 'Reçu', rendu: function (l) { return esc(SA.fmt.dateHeure(l.recu_at)); } },
            { cle: 'reference', titre: 'Référence', rendu: function (l) { return '<span class="sa-mono">' + esc(l.reference) + '</span>'; } },
            { cle: 'montant', titre: 'Montant', rendu: function (l) { return '<strong>' + argent(l.montant, l.devise) + '</strong>'; } },
            { cle: 'reseau', titre: 'Réseau', rendu: function (l) {
              return esc(LIB_RESEAU[l.reseau] || l.reseau) + '<br><span class="sa-muet">' + esc(LIB_SOURCE[l.source] || l.source || '') + '</span>';
            } },
            { cle: 'statut', titre: 'État', rendu: function (l) {
              var html = ui.badge(LIB_STATUT[l.statut] || l.statut, TON_STATUT[l.statut] || 'neutre');
              if (l.anomalie) html += '<br><span class="sa-muet">' + esc(LIB_ANOMALIE[l.anomalie] || l.anomalie) + '</span>';
              if (l.derniere_erreur && l.statut === 'non_rapprochee') {
                html += '<br><span class="mm-texte-erreur">Erreur technique : ' + esc(l.derniere_erreur) + '</span>';
              }
              return html;
            } },
            { cle: 'ecole_nom', titre: 'École', rendu: function (l) {
              if (!l.ecole_nom) return '<span class="sa-muet">—</span>';
              return esc(l.ecole_nom) + (l.montant_attendu != null
                ? '<br><span class="sa-muet">attendu ' + argent(l.montant_attendu, l.devise_attendue) + '</span>' : '');
            } }
          ]
        });
      }

      function peindre(r) {
        var s = r.statistiques || {};
        conteneur.innerHTML =
          '<section class="sa-section"><div class="sa-grille-stats">'
          + ui.carteStat({ valeur: s.anomalies || 0, etiquette: 'Anomalies', ton: Number(s.anomalies) > 0 ? 'danger' : 'neutre' })
          + ui.carteStat({ valeur: s.ecoles_en_attente_sms || 0, etiquette: 'Écoles sans SMS reçu', ton: Number(s.ecoles_en_attente_sms) > 0 ? 'attention' : 'neutre' })
          + ui.carteStat({ valeur: s.en_attente || 0, etiquette: 'SMS sans école', detail: Number(s.en_attente_agees) > 0 ? esc(s.en_attente_agees + ' depuis plus de 3 jours') : '', ton: 'info' })
          + ui.carteStat({ valeur: s.rapprochees_aujourdhui || 0, etiquette: 'Activés aujourd’hui', ton: 'succes' })
          + '</div></section>'
          + blocRelais(r)
          + blocAttentes(r.attentes)
          + '<section class="sa-section"><div class="renouv-barre"><div class="sa-onglets" role="tablist">'
          + ONGLETS.map(function (o) {
            return '<button type="button" class="sa-onglet' + (o.cle === filtre ? ' actif' : '') + '" data-onglet="' + o.cle + '">' + esc(o.titre) + '</button>';
          }).join('')
          + '</div><div class="renouv-maj"><button type="button" class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-actualiser>Actualiser</button></div></div>'
          + '<div class="mm-tableau">' + tableauReceptions(r.donnees || []) + '</div></section>';

        conteneur.querySelectorAll('[data-onglet]').forEach(function (b) {
          b.onclick = function () {
            filtre = b.dataset.onglet;
            SA.majParams({ statut: filtre });
            charger(true);
          };
        });
        var act = conteneur.querySelector('[data-actualiser]');
        if (act) act.onclick = function () { charger(true); };
        var coller = conteneur.querySelector('[data-coller]');
        if (coller) coller.onclick = function () { modaleSaisie(null, function () { charger(true); }); };
        conteneur.querySelectorAll('[data-coller-ref]').forEach(function (b) {
          b.onclick = function () { modaleSaisie(b.dataset.collerRef, function () { charger(true); }); };
        });
      }

      async function charger(force) {
        try {
          var r = await SA.api(SA.url('/super-admin/mobile-money/receptions', { statut: filtre }));
          var e = JSON.stringify(r);
          if (!force && e === empreinte) return;     // rien n'a changé : on ne repeint pas
          empreinte = e;
          peindre(r);
        } catch (err) {
          if (force) conteneur.innerHTML = ui.etatErreur(err.message || 'Boîte de réception indisponible.');
        }
      }

      await charger(true);

      window.__ardoiseMobileMoneyTimer = setInterval(function () {
        if (location.hash.indexOf('#/mobile-money') !== 0) {
          clearInterval(window.__ardoiseMobileMoneyTimer);
          return;
        }
        if (document.hidden || document.querySelector('.sa-modale')) return;
        charger(false);
      }, 30000);
    }
  });
})();
