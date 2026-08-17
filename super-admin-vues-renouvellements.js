/* Super Admin — boîte de traitement des renouvellements.
 *
 * POURQUOI CE N'EST PLUS UN TABLEAU
 * ---------------------------------------------------------------------------
 * La version précédente affichait neuf colonnes : école, contact, offre,
 * montant, mode, référence, statut, date, actions. Sur un portable c'était
 * illisible, et même sur un grand écran il fallait relire la ligne entière pour
 * décider. Or la question posée à chaque dossier est simple — « est-ce que je
 * valide, et avec quelles informations ? ».
 *
 * Chaque demande est donc une FICHE : la liste montre ce qu'il faut pour
 * choisir, la fiche montre tout ce qu'il faut pour agir.
 *
 * LE RAFRAÎCHISSEMENT NE DOIT PLUS SE VOIR
 * ---------------------------------------------------------------------------
 * L'ancienne vue rechargeait toutes les 10 s et, au moindre octet différent,
 * remplaçait `conteneur.innerHTML` en entier : le défilement sautait, le filtre
 * reprenait sa valeur par défaut et une fiche ouverte disparaissait.
 *
 * Ici :
 *   · la coque (cartes, onglets, liste) n'est construite qu'UNE fois ;
 *   · une actualisation ne touche que les nœuds dont les données ont changé ;
 *   · un dossier ouvert n'est jamais remplacé sous les yeux de l'utilisateur ;
 *   · aucun squelette après le premier chargement.
 */
(function enregistrerQuandPret() {
  'use strict';
  if (!window.SA || typeof SA.enregistrerVue !== 'function') {
    setTimeout(enregistrerQuandPret, 30);
    return;
  }
  if (SA.vues && SA.vues.has && SA.vues.has('renouvellements')) return;

  var ui = SA.ui, esc = SA.esc;

  var LIB = {
    en_attente_paiement: 'Dépôt en attente',
    a_verifier: 'À vérifier',
    agent_demande: 'Agent demandé',
    agent_pris_en_charge: 'Pris en charge',
    agent_assigne: 'Agent assigné',
    rdv_planifie: 'Rendez-vous prévu',
    paiement_recupere: 'Paiement récupéré',
    validee: 'Validée',
    refusee: 'Refusée',
    annulee: 'Annulée'
  };

  var TON = {
    a_verifier: 'attention', agent_demande: 'attention', paiement_recupere: 'attention',
    agent_pris_en_charge: 'info', agent_assigne: 'info', rdv_planifie: 'info',
    en_attente_paiement: 'neutre', validee: 'succes', refusee: 'danger', annulee: 'neutre'
  };

  var ONGLETS = [
    { cle: 'a_traiter', titre: 'À traiter' },
    { cle: 'depots', titre: 'Dépôts' },
    { cle: 'agents', titre: 'Agents' },
    { cle: 'valides', titre: 'Validés' },
    { cle: 'refuses', titre: 'Refusés' },
    { cle: 'tous', titre: 'Tous' }
  ];

  /* Les étapes proposées à partir de l'état courant. Le serveur applique la
     même table (`TRANSITIONS_AGENT`) : ce qui est masqué ici est de toute
     façon refusé là-bas. */
  var SUITES = {
    agent_demande: [
      { statut: 'agent_pris_en_charge', libelle: 'Marquer pris en charge' },
      { statut: 'agent_assigne', libelle: 'Assigner un agent' }
    ],
    agent_pris_en_charge: [
      { statut: 'agent_assigne', libelle: 'Assigner un agent' },
      { statut: 'rdv_planifie', libelle: 'Planifier le rendez-vous' }
    ],
    agent_assigne: [
      { statut: 'rdv_planifie', libelle: 'Planifier le rendez-vous' },
      { statut: 'paiement_recupere', libelle: 'Paiement récupéré' }
    ],
    rdv_planifie: [
      { statut: 'paiement_recupere', libelle: 'Paiement récupéré' },
      { statut: 'agent_assigne', libelle: 'Changer d’agent' }
    ],
    paiement_recupere: []
  };

  function injecterMenu() {
    if (document.querySelector('[data-route="renouvellements"]')) return;
    var groupe = document.querySelector('[data-groupe="offres"] .sa-sous-menu');
    if (!groupe) return;
    var li = document.createElement('li');
    li.innerHTML = '<a href="#/renouvellements" data-route="renouvellements">Renouvellements à traiter</a>';
    groupe.appendChild(li);
  }

  function montant(l) { return SA.fmt.nombre(Number(l.montant_attendu)) + ' ' + esc(l.devise || ''); }

  function dateHeure(v) {
    if (!v) return '—';
    try { return new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); }
    catch (e) { return '—'; }
  }

  function jour(v) {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return '—'; }
  }

  /** Signature d'une ligne : sert à ne redessiner QUE ce qui a bougé. */
  function empreinteLigne(l) {
    return [l.statut, l.updated_at, l.reference_transaction, l.refuse_motif,
      l.agent_id, l.rdv_at, l.montant_attendu].join('|');
  }

  /* ==================================================================== FICHE */

  function ouvrirFiche(id, apresAction) {
    var m = SA.modale({
      titre: 'Dossier de renouvellement',
      sousTitre: 'Chargement…',
      contenu: '<div class="sa-muet">Chargement de la fiche…</div>',
      large: true,
      actions: '<button class="sa-bouton sa-bouton-secondaire" data-fermer>Fermer</button>'
    });
    m.querySelector('[data-fermer]').onclick = function () { m.fermer(); };

    SA.api('/super-admin/renouvellements/' + id).then(function (r) {
      peindreFiche(m, r, apresAction);
    }).catch(function (e) {
      m.querySelector('.sa-modale-corps').innerHTML =
        '<p class="sa-erreur-modale">' + esc(e.message || 'Fiche indisponible.') + '</p>';
    });
  }

  function peindreFiche(m, r, apresAction) {
    var d = r.demande;
    var estAgent = d.mode_paiement === 'agent';
    var decidable = ['a_verifier', 'agent_demande', 'agent_pris_en_charge',
      'agent_assigne', 'rdv_planifie', 'paiement_recupere'].indexOf(d.statut) !== -1;

    var adresse = [d.adresse, d.commune, d.ville].filter(Boolean).join(' · ');

    var bloc = function (titre, lignes) {
      return '<section class="sa-fiche-bloc"><h4>' + esc(titre) + '</h4><dl>'
        + lignes.filter(function (x) { return x; }).map(function (x) {
          return '<div><dt>' + esc(x[0]) + '</dt><dd>' + (x[2] ? x[1] : esc(x[1] || '—')) + '</dd></div>';
        }).join('') + '</dl></section>';
    };

    var telephone = d.ecole_telephone || '';
    var actionsTel = telephone
      ? '<a class="sa-bouton sa-bouton-petit sa-bouton-secondaire" href="tel:'
        + esc(telephone.replace(/\s/g, '')) + '">Appeler</a>'
        + '<button class="sa-bouton sa-bouton-petit sa-bouton-secondaire" data-copier="'
        + esc(telephone) + '">Copier</button>'
      : '';

    var corps =
      bloc('École', [
        ['Nom', d.ecole_nom],
        ['Code', '<span class="sa-mono">' + esc(d.ecole_code || '') + '</span>', true],
        ['Téléphone', (esc(telephone || '—') + ' <span class="sa-fiche-actions">' + actionsTel + '</span>'), true],
        ['E-mail', d.ecole_email],
        ['Adresse', adresse]
      ])
      + bloc('Demande', [
        ['Offre', d.plan_nom],
        ['Durée', d.periodicite],
        ['Montant', '<strong>' + montant(d) + '</strong>', true],
        ['Demandée le', dateHeure(d.created_at)],
        ['Par', d.demandeur_nom || d.demandeur_email],
        ['Statut', ui.badge(LIB[d.statut] || d.statut, TON[d.statut] || 'neutre'), true]
      ])
      + bloc(estAgent ? 'Suivi agent' : 'Paiement', estAgent
        ? [
          ['Agent', d.agent_nom],
          ['Téléphone agent', d.agent_telephone],
          ['Pris en charge', d.pris_en_charge_at ? dateHeure(d.pris_en_charge_at) : null],
          ['Rendez-vous', d.rdv_at ? jour(d.rdv_at) : null],
          ['Note', d.rdv_note]
        ]
        : [
          ['Réseau', d.reseau_depot],
          ['Numéro utilisé', d.numero_depot ? '<span class="sa-mono">' + esc(d.numero_depot) + '</span>' : null, true],
          ['Référence client', d.reference_transaction
            ? '<span class="sa-mono sa-fiche-ref">' + esc(d.reference_transaction) + '</span>'
            : '<span class="sa-muet">Pas encore transmise</span>', true],
          ['Motif de refus', d.refuse_motif]
        ])
      + (r.historique && r.historique.length
        ? '<section class="sa-fiche-bloc"><h4>Demandes précédentes</h4><ul class="sa-fiche-histo">'
          + r.historique.map(function (h) {
            return '<li>' + esc(jour(h.created_at)) + ' — ' + esc(LIB[h.statut] || h.statut)
              + ' · ' + SA.fmt.nombre(Number(h.montant_attendu)) + ' ' + esc(h.devise || '')
              + (h.refuse_motif ? ' <span class="sa-muet">(' + esc(h.refuse_motif) + ')</span>' : '')
              + '</li>';
          }).join('') + '</ul></section>'
        : '')
      + '<p data-erreur class="sa-erreur-modale" hidden></p>';

    m.querySelector('.sa-modale-corps').innerHTML = '<div class="sa-fiche">' + corps + '</div>';
    var sousTitre = m.querySelector('.sa-modale-sous-titre');
    if (sousTitre) sousTitre.textContent = d.ecole_nom + ' — ' + d.plan_nom;

    /* Actions : les étapes du suivi agent d'abord (elles n'engagent rien),
       puis les deux décisions financières. */
    var suites = estAgent ? (SUITES[d.statut] || []) : [];
    var actions =
      suites.map(function (s) {
        return '<button class="sa-bouton sa-bouton-petit sa-bouton-secondaire" data-etape="'
          + s.statut + '">' + esc(s.libelle) + '</button>';
      }).join('')
      + '<button class="sa-bouton sa-bouton-secondaire" data-fermer>Fermer</button>'
      + (decidable
        ? '<button class="sa-bouton sa-bouton-danger" data-refuser>Refuser</button>'
          + '<button class="sa-bouton sa-bouton-principal" data-valider>Valider</button>'
        : '');

    var zone = m.querySelector('.sa-modale-actions');
    if (zone) zone.innerHTML = actions;

    m.querySelectorAll('[data-fermer]').forEach(function (b) { b.onclick = function () { m.fermer(); }; });

    m.querySelectorAll('[data-copier]').forEach(function (b) {
      b.onclick = function () {
        var v = b.dataset.copier;
        var fini = function () { var a = b.textContent; b.textContent = 'Copié ✓'; setTimeout(function () { b.textContent = a; }, 1600); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(fini).catch(function () {});
      };
    });

    m.querySelectorAll('[data-etape]').forEach(function (b) {
      b.onclick = function () { avancerAgent(m, d, b.dataset.etape, r.agents || [], apresAction); };
    });

    var valider = m.querySelector('[data-valider]');
    if (valider) valider.onclick = function () { m.fermer(); modalDecision(d, 'valider', apresAction); };
    var refuser = m.querySelector('[data-refuser]');
    if (refuser) refuser.onclick = function () { m.fermer(); modalDecision(d, 'refuser', apresAction); };
  }

  /* ======================================================= SUIVI AGENT */

  function avancerAgent(fiche, d, statut, agents, apresAction) {
    var besoinAgent = statut === 'agent_assigne';
    var besoinDate = statut === 'rdv_planifie';

    var contenu =
      (besoinAgent
        ? '<label class="sa-champ"><span>Agent chargé du dossier</span><select id="renouv-agent">'
          + agents.map(function (a) {
            return '<option value="' + esc(a.id) + '"' + (a.id === d.agent_id ? ' selected' : '') + '>'
              + esc(a.nom || '—') + (a.telephone ? ' · ' + esc(a.telephone) : '') + '</option>';
          }).join('')
          + '</select></label>'
        : '')
      + (besoinDate
        ? '<label class="sa-champ"><span>Date et heure du rendez-vous</span>'
          + '<input type="datetime-local" id="renouv-rdv" /></label>'
        : '')
      + '<label class="sa-champ"><span>Note (facultative)</span><textarea id="renouv-note-agent" rows="2"></textarea></label>'
      + '<p class="sa-texte sa-muet">L’école est informée automatiquement de ce changement.</p>'
      + '<p data-erreur class="sa-erreur-modale" hidden></p>';

    var m = SA.modale({
      titre: 'Faire avancer le dossier',
      sousTitre: d.ecole_nom,
      contenu: contenu,
      actions: '<button class="sa-bouton sa-bouton-secondaire" data-annuler>Annuler</button>'
        + '<button class="sa-bouton sa-bouton-principal" data-ok>Confirmer</button>'
    });

    m.querySelector('[data-annuler]').onclick = function () { m.fermer(); };
    m.querySelector('[data-ok]').onclick = async function () {
      var bouton = this, erreur = m.querySelector('[data-erreur]');
      bouton.disabled = true;
      try {
        var corps = { statut: statut };
        if (besoinAgent) {
          corps.agent_id = m.querySelector('#renouv-agent') && m.querySelector('#renouv-agent').value;
          if (!corps.agent_id) throw new Error('Choisissez l’agent à assigner.');
        }
        if (besoinDate) {
          var v = m.querySelector('#renouv-rdv').value;
          if (!v) throw new Error('Indiquez la date du rendez-vous.');
          corps.rdv_at = new Date(v).toISOString();
        }
        var note = m.querySelector('#renouv-note-agent').value.trim();
        if (note) corps.note = note;

        var r = await SA.api('/super-admin/renouvellements/' + d.id + '/agent',
          { method: 'POST', body: JSON.stringify(corps) });
        m.fermer();
        if (fiche && fiche.fermer) fiche.fermer();
        SA.toast(r.message || 'Suivi mis à jour.', 'succes');
        if (typeof apresAction === 'function') apresAction();
      } catch (e) {
        erreur.hidden = false;
        erreur.textContent = e.message || 'Opération impossible.';
      } finally {
        bouton.disabled = false;
      }
    };
  }

  /* ==================================================== VALIDER / REFUSER */

  function modalDecision(ligne, mode, apresAction) {
    var validation = mode === 'valider';
    var reference = ligne.reference_transaction || '';

    var contenu = validation
      ? '<p class="sa-texte">Validez seulement après avoir vérifié que le paiement est réellement reçu.</p>'
        + '<div class="sa-rappel-montant"><span>Montant attendu</span><strong>' + montant(ligne) + '</strong></div>'
        + '<label class="sa-champ"><span>Méthode constatée</span><select id="renouv-methode">'
        + '<option value="mpesa">M-Pesa</option><option value="orange_money">Orange Money</option>'
        + '<option value="airtel_money">Airtel Money</option><option value="especes">Espèces</option>'
        + '<option value="virement_bancaire">Virement bancaire</option><option value="cheque">Chèque</option></select></label>'
        + '<label class="sa-champ"><span>Référence vérifiée / reçu</span><input id="renouv-ref" value="' + esc(reference) + '" /></label>'
        + '<label class="sa-champ"><span>Note interne (facultative)</span><textarea id="renouv-note" rows="2"></textarea></label>'
      : '<p class="sa-texte">Le motif sera envoyé à l’école. Pour un dépôt, elle pourra corriger sa référence '
        + 'et la renvoyer <strong>sans refaire son choix d’offre</strong>.</p>'
        + '<label class="sa-champ"><span>Motif</span><textarea id="renouv-motif" rows="3" '
        + 'placeholder="Ex. Référence introuvable dans le relevé"></textarea></label>';

    var m = SA.modale({
      titre: validation ? 'Valider le renouvellement' : 'Refuser la demande',
      sousTitre: ligne.ecole_nom + ' — ' + ligne.plan_nom,
      contenu: contenu + '<p data-erreur class="sa-erreur-modale" hidden></p>',
      actions: '<button class="sa-bouton sa-bouton-secondaire" data-annuler>Annuler</button>'
        + '<button class="sa-bouton ' + (validation ? 'sa-bouton-principal' : 'sa-bouton-danger') + '" data-valider>'
        + (validation ? 'Activer l’abonnement' : 'Refuser') + '</button>'
    });

    m.querySelector('[data-annuler]').onclick = function () { m.fermer(); };
    m.querySelector('[data-valider]').onclick = async function () {
      var bouton = this, erreur = m.querySelector('[data-erreur]');
      bouton.disabled = true;
      try {
        var body = { confirmation: true }, chemin;
        if (validation) {
          body.methode = m.querySelector('#renouv-methode').value;
          body.reference = m.querySelector('#renouv-ref').value.trim();
          body.note = m.querySelector('#renouv-note').value.trim();
          if (body.reference.length < 3) throw new Error('Une référence ou un numéro de reçu est requis.');
          chemin = '/super-admin/renouvellements/' + ligne.id + '/valider';
        } else {
          body.motif = m.querySelector('#renouv-motif').value.trim();
          if (body.motif.length < 3) throw new Error('Indiquez le motif du refus.');
          chemin = '/super-admin/renouvellements/' + ligne.id + '/refuser';
        }
        var r = await SA.api(chemin, { method: 'POST', body: JSON.stringify(body) });
        m.fermer();
        SA.toast(r.message || 'Demande mise à jour.', 'succes');
        if (typeof apresAction === 'function') apresAction();
      } catch (e) {
        erreur.hidden = false;
        erreur.textContent = e.message || 'Opération impossible.';
      } finally {
        bouton.disabled = false;
      }
    };
  }

  /* ============================================================== LA VUE */

  SA.enregistrerVue('renouvellements', {
    titre: 'Renouvellements',
    sousTitre: 'Paiements déclarés et demandes de passage d’un agent, à traiter en priorité.',

    async rendu(conteneur, params) {
      injecterMenu();
      clearInterval(window.__ardoiseRenouvTimer);

      var filtre = params.statut || 'a_traiter';
      var lignesAffichees = {};     // id -> empreinte, pour ne redessiner que le nécessaire
      var coqueConstruite = false;
      var derniereMaj = null;
      var chargementEnCours = false;

      // Premier affichage seulement : après, plus jamais de squelette.
      conteneur.innerHTML = ui.squeletteCartes(4) + ui.squelette(5, 64);

      function urlListe() {
        return SA.url('/super-admin/renouvellements', { statut: filtre });
      }

      function construireCoque() {
        conteneur.innerHTML =
          '<section class="sa-section"><div class="sa-grille-stats" id="renouv-stats"></div></section>'
          + '<section class="sa-section">'
          + '<div class="sa-barre-filtres renouv-barre">'
          + '<div class="sa-onglets" id="renouv-onglets" role="tablist">'
          + ONGLETS.map(function (o) {
            return '<button type="button" class="sa-onglet' + (o.cle === filtre ? ' actif' : '')
              + '" data-onglet="' + o.cle + '" role="tab">' + esc(o.titre) + '</button>';
          }).join('')
          + '</div>'
          + '<div class="renouv-maj"><span class="sa-muet" id="renouv-horloge"></span>'
          + '<button type="button" class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="renouv-actualiser">'
          + 'Actualiser</button></div>'
          + '</div>'
          + '<div class="renouv-liste" id="renouv-liste"></div>'
          + '</section>';

        conteneur.querySelectorAll('[data-onglet]').forEach(function (b) {
          b.onclick = function () {
            if (filtre === b.dataset.onglet) return;
            filtre = b.dataset.onglet;
            conteneur.querySelectorAll('[data-onglet]').forEach(function (x) {
              x.classList.toggle('actif', x.dataset.onglet === filtre);
            });
            SA.majParams({ statut: filtre });
            lignesAffichees = {};                 // le jeu de lignes change entièrement
            charger(true);
          };
        });

        conteneur.querySelector('#renouv-actualiser').onclick = function () { charger(true, this); };
        coqueConstruite = true;
      }

      function carteHTML(l) {
        var estAgent = l.mode_paiement === 'agent';
        var decidable = ['a_verifier', 'agent_demande', 'agent_pris_en_charge',
          'agent_assigne', 'rdv_planifie', 'paiement_recupere'].indexOf(l.statut) !== -1;

        return '<div class="renouv-carte-entete">'
          + '<div class="renouv-ecole"><strong>' + esc(l.ecole_nom) + '</strong>'
          + '<span class="sa-mono sa-muet">' + esc(l.ecole_code || '') + '</span></div>'
          + ui.badge(LIB[l.statut] || l.statut, TON[l.statut] || 'neutre')
          + '</div>'
          + '<div class="renouv-carte-corps">'
          + '<div><small>Offre</small><span>' + esc(l.plan_nom) + ' · ' + esc(l.periodicite) + '</span></div>'
          + '<div><small>Montant</small><span class="renouv-montant">' + montant(l) + '</span></div>'
          + '<div><small>Mode</small><span>' + (estAgent ? 'Agent' : 'Dépôt'
            + (l.reseau_depot ? ' · ' + esc(l.reseau_depot) : '')) + '</span></div>'
          + '<div><small>' + (estAgent ? 'Agent' : 'Référence') + '</small><span class="sa-mono">'
          + esc(estAgent ? (l.agent_nom || '—') : (l.reference_transaction || '—')) + '</span></div>'
          + '<div><small>Demandé</small><span>' + dateHeure(l.created_at) + '</span></div>'
          + '</div>'
          + '<div class="renouv-carte-actions">'
          + '<button class="sa-bouton sa-bouton-petit sa-bouton-secondaire" data-fiche="' + esc(l.id) + '">'
          + 'Ouvrir la fiche</button>'
          + (decidable
            ? '<button class="sa-bouton sa-bouton-petit sa-bouton-principal" data-valider="' + esc(l.id) + '">Valider</button>'
            : '')
          + '</div>';
      }

      function brancherCarte(noeud, l) {
        var f = noeud.querySelector('[data-fiche]');
        if (f) f.onclick = function () { ouvrirFiche(l.id, function () { charger(true); }); };
        var v = noeud.querySelector('[data-valider]');
        if (v) v.onclick = function () { modalDecision(l, 'valider', function () { charger(true); }); };
      }

      /**
       * Mise à jour ciblée de la liste.
       *
       * On compare l'empreinte de chaque ligne à celle déjà affichée :
       *   · inchangée → on ne touche à RIEN (pas même une classe) ;
       *   · modifiée  → on remplace le contenu de CETTE carte seulement ;
       *   · nouvelle  → on l'insère ;
       *   · disparue  → on la retire.
       * Le défilement, le focus et l'onglet actif survivent donc à chaque cycle.
       */
      function majListe(lignes) {
        var liste = conteneur.querySelector('#renouv-liste');
        if (!liste) return;

        if (!lignes.length) {
          if (!liste.querySelector('.renouv-vide')) {
            liste.innerHTML = '<div class="renouv-vide sa-muet">Aucune demande dans cette vue.</div>';
            lignesAffichees = {};
          }
          return;
        }
        var vide = liste.querySelector('.renouv-vide');
        if (vide) { vide.remove(); lignesAffichees = {}; }

        var vus = {};
        lignes.forEach(function (l, index) {
          vus[l.id] = true;
          var empreinte = empreinteLigne(l);
          var noeud = liste.querySelector('[data-ligne="' + l.id + '"]');

          if (noeud && lignesAffichees[l.id] === empreinte) {
            // Rien n'a changé pour ce dossier : on le laisse strictement tel quel.
            return;
          }
          if (!noeud) {
            noeud = document.createElement('article');
            noeud.className = 'renouv-carte';
            noeud.setAttribute('data-ligne', l.id);
            var apres = liste.children[index];
            liste.insertBefore(noeud, apres || null);
          }
          noeud.innerHTML = carteHTML(l);
          brancherCarte(noeud, l);
          lignesAffichees[l.id] = empreinte;
        });

        // Les dossiers sortis du filtre disparaissent, sans reconstruire le reste.
        Array.prototype.slice.call(liste.querySelectorAll('[data-ligne]')).forEach(function (n) {
          if (!vus[n.getAttribute('data-ligne')]) {
            delete lignesAffichees[n.getAttribute('data-ligne')];
            n.remove();
          }
        });
      }

      function majStats(s) {
        var zone = conteneur.querySelector('#renouv-stats');
        if (!zone) return;
        var html = ui.carteStat({ valeur: s.a_verifier || 0, etiquette: 'À vérifier', ton: Number(s.a_verifier) > 0 ? 'attention' : 'neutre' })
          + ui.carteStat({ valeur: s.agents || 0, etiquette: 'Agents demandés', ton: Number(s.agents) > 0 ? 'attention' : 'neutre' })
          + ui.carteStat({ valeur: s.ouvertes || 0, etiquette: 'En cours', ton: 'info' })
          + ui.carteStat({ valeur: s.traitees_aujourdhui || 0, etiquette: 'Traités aujourd’hui', ton: 'succes' });
        // On ne réécrit que si le contenu diffère : sinon l'animation des
        // chiffres se relancerait à chaque cycle, ce qui se voit.
        if (zone.innerHTML !== html) zone.innerHTML = html;
      }

      function majHorloge() {
        var e = conteneur.querySelector('#renouv-horloge');
        if (!e || !derniereMaj) return;
        var s = Math.round((Date.now() - derniereMaj) / 1000);
        e.textContent = s < 5 ? 'Mis à jour à l’instant'
          : s < 60 ? 'Mis à jour il y a ' + s + ' s'
            : 'Mis à jour il y a ' + Math.round(s / 60) + ' min';
      }

      async function charger(visible, bouton) {
        if (chargementEnCours) return;
        chargementEnCours = true;
        var texte;
        if (bouton) { texte = bouton.textContent; bouton.disabled = true; bouton.textContent = 'Actualisation…'; }
        try {
          var r = await SA.api(urlListe());
          if (!coqueConstruite) construireCoque();
          majStats(r.statistiques || {});
          majListe(r.donnees || []);
          derniereMaj = Date.now();
          majHorloge();
        } catch (e) {
          // Un échec silencieux en arrière-plan : on ne dérange que si
          // l'utilisateur a lui-même demandé l'actualisation.
          if (visible) SA.toast(e.message || 'Impossible d’actualiser les renouvellements.', 'erreur');
        } finally {
          chargementEnCours = false;
          if (bouton && document.body.contains(bouton)) {
            bouton.disabled = false;
            bouton.textContent = texte || 'Actualiser';
          }
        }
      }

      await charger(true);

      /* Le cycle de fond est passé de 10 s à 30 s : il ne sert qu'à faire
         remonter un dossier arrivé entre-temps, et rien à l'écran ne bouge
         quand il n'y a rien de neuf. L'horloge, elle, se met à jour chaque
         seconde — c'est du texte, pas une repeinture. */
      window.__ardoiseRenouvTimer = setInterval(function () {
        if (location.hash.indexOf('#/renouvellements') !== 0) {
          clearInterval(window.__ardoiseRenouvTimer);
          return;
        }
        majHorloge();
        if (document.hidden) return;
        // On n'actualise pas pendant qu'une fenêtre est ouverte : le contenu
        // sous les yeux de l'utilisateur ne doit jamais changer tout seul.
        if (document.querySelector('.sa-modale')) return;
        if (derniereMaj && Date.now() - derniereMaj < 30000) return;
        charger(false);
      }, 1000);
    }
  });

  injecterMenu();
  if (location.hash.indexOf('#/renouvellements') === 0 && SA.rafraichirVue) setTimeout(SA.rafraichirVue, 0);
})();
