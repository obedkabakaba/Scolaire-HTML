/* ==========================================================================
   Ardoise — Super Admin : écoles, abonnements, statistiques, utilisateurs
   --------------------------------------------------------------------------
   Les actions d'écriture (créer une école, suspendre, changer de plan,
   réinitialiser le mot de passe du Directeur) appellent les routes qui
   existaient déjà — /admin/ecoles — plutôt que d'en créer des jumelles sous
   /super-admin. Deux chemins pour la même opération finiraient par diverger,
   et l'un des deux oublierait un jour de journaliser.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui } = SA;

  /* ======================================================================
     Liste des écoles
     ====================================================================== */

  SA.enregistrerVue('ecoles', {
    titre: 'Toutes les écoles',
    sousTitre: 'Rechercher, filtrer, trier et administrer les établissements clients.',

    async rendu(conteneur, params) {
      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `
          <button class="sa-bouton sa-bouton-secondaire" id="btn-ecole-test">🧪 École de test</button>
          <button class="sa-bouton sa-bouton-principal" id="btn-nouvelle-ecole">+ Nouvelle école</button>`;
        document.getElementById('btn-nouvelle-ecole')
          .addEventListener('click', () => ouvrirCreationEcole());
        document.getElementById('btn-ecole-test')
          .addEventListener('click', () => ouvrirCreationEcole({ modeTest: true }));
      }

      conteneur.innerHTML = '';
      const barre = document.createElement('div');
      const zone = document.createElement('div');
      zone.innerHTML = ui.squelette(8);
      conteneur.append(barre, zone);

      const plans = (SA.referentiels && SA.referentiels.plans) || [];

      const filtres = SA.ui.barreFiltres(barre, [
        { type: 'recherche', nom: 'recherche', libelle: 'Nom, code, ville, email…', valeur: params.recherche },
        {
          type: 'select', nom: 'statut', libelle: 'Tous les statuts', valeur: params.statut,
          options: [
            { valeur: 'actif', libelle: 'Actives' },
            { valeur: 'suspendu', libelle: 'Suspendues' },
            { valeur: 'inactif', libelle: 'Inactives' }
          ]
        },
        {
          type: 'select', nom: 'statut_abonnement', libelle: 'Tous les abonnements', valeur: params.statut_abonnement,
          options: [
            { valeur: 'actif', libelle: 'Abonnement actif' },
            { valeur: 'en_attente', libelle: 'En attente' },
            { valeur: 'expire', libelle: 'Expiré' },
            { valeur: 'suspendu', libelle: 'Suspendu' }
          ]
        },
        {
          type: 'select', nom: 'plan_id', libelle: 'Tous les plans', valeur: params.plan_id,
          options: plans.map((p) => ({ valeur: p.id, libelle: p.nom }))
        },
        {
          /* Trois états et non deux : on cherche tantôt ses bacs à sable,
             tantôt une liste de clients qui n'en contienne aucun. Un filtre
             binaire « masquer les écoles de test » ne répondrait qu'à la
             seconde question. */
          type: 'select', nom: 'mode_test', libelle: 'Test et clients', valeur: params.mode_test,
          options: [
            { valeur: '1', libelle: 'Écoles de test uniquement' },
            { valeur: '0', libelle: 'Clients uniquement' }
          ]
        },
        {
          type: 'select', nom: 'type_enseignement', libelle: 'Tous les cycles', valeur: params.type_enseignement,
          options: [
            { valeur: 'primaire', libelle: 'Primaire' },
            { valeur: 'secondaire', libelle: 'Secondaire' },
            { valeur: 'les_deux', libelle: 'Primaire et secondaire' }
          ]
        }
      ], (valeurs) => SA.naviguer('ecoles', Object.assign({}, valeurs, { page: 1 })));

      async function charger() {
        zone.innerHTML = ui.squelette(8);
        const requete = Object.assign({}, filtres.lire(), {
          page: params.page || 1,
          tri: params.tri || 'creation',
          sens: params.sens || 'desc'
        });

        const d = await SA.api(SA.url('/super-admin/ecoles', requete));

        zone.innerHTML = ui.tableau({
          cliquable: true,
          tri: d.tri,
          colonnes: [
            {
              cle: 'nom', titre: 'École', triable: true,
              rendu: (l) => `<strong>${esc(l.nom)}</strong>
                             ${l.mode_test ? ' ' + ui.badge('test', 'info') : ''}
                             <div class="sa-muet" style="font-size:.76rem">${esc(l.code)}${l.ville ? ' · ' + esc(l.ville) : ''}</div>`
            },
            { cle: 'statut', titre: 'Statut', triable: true, rendu: (l) => ui.badgeStatut(l.statut) },
            {
              cle: 'plan_nom', titre: 'Abonnement',
              // Une école de test n'a pas d'abonnement « aucun » : elle n'en a
              // pas besoin. Afficher le vide laisserait croire à un oubli de
              // facturation là où il y a une décision assumée.
              rendu: (l) => l.mode_test
                ? '<span class="sa-muet">sans objet</span><div style="margin-top:3px">'
                  + ui.badge('accès de test', 'info') + '</div>'
                : `${l.plan_nom ? esc(l.plan_nom) : '<span class="sa-muet">aucun</span>'}
                   <div style="margin-top:3px">${ui.badgeStatut(l.statut_abonnement)}</div>`
            },
            { cle: 'eleves', titre: 'Élèves', classe: 'sa-num', triable: true, rendu: (l) => fmt.nombre(l.nb_eleves) },
            { cle: 'utilisateurs', titre: 'Utilisateurs', classe: 'sa-num', triable: true, rendu: (l) => fmt.nombre(l.nb_utilisateurs) },
            { cle: 'stockage', titre: 'Documents', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb_documents) },
            {
              cle: 'derniere_connexion', titre: 'Dernière connexion', triable: true,
              rendu: (l) => l.derniere_connexion
                ? `<span title="${esc(fmt.dateHeure(l.derniere_connexion))}">${esc(fmt.relatif(l.derniere_connexion))}</span>`
                : '<span class="sa-muet">jamais</span>'
            },
            { cle: 'expiration', titre: 'Expire le', triable: true, rendu: (l) => esc(fmt.date(l.date_expiration)) },
            { cle: 'creation', titre: 'Créée le', triable: true, rendu: (l) => esc(fmt.date(l.created_at)) }
          ],
          lignes: d.donnees,
          vide: 'Aucune école ne correspond'
        }) + ui.pagination(d.pagination);

        brancherTri(zone, 'ecoles', requete);
        brancherPagination(zone, 'ecoles', requete);

        zone.querySelectorAll('tbody tr[data-id]').forEach((ligne) => {
          ligne.addEventListener('click', () => ouvrirFicheEcole(ligne.getAttribute('data-id'), charger));
        });
      }

      await charger();
    }
  });

  /** Rebranche le tri des en-têtes sur la navigation. */
  function brancherTri(zone, route, requete) {
    zone.querySelectorAll('th[data-tri]').forEach((entete) => {
      entete.addEventListener('click', () => {
        SA.naviguer(route, Object.assign({}, requete, {
          tri: entete.getAttribute('data-tri'),
          sens: entete.getAttribute('data-sens'),
          page: 1
        }));
      });
    });
  }

  function brancherPagination(zone, route, requete) {
    zone.querySelectorAll('.sa-bouton-page[data-page]').forEach((bouton) => {
      if (bouton.disabled) return;
      bouton.addEventListener('click', () => {
        SA.naviguer(route, Object.assign({}, requete, { page: bouton.getAttribute('data-page') }));
      });
    });
  }

  /* ======================================================================
     Fiche détaillée d'une école
     ====================================================================== */

  async function ouvrirFicheEcole(ecoleId, surChangement) {
    const modale = SA.modale({
      titre: 'Chargement…',
      large: true,
      contenu: ui.squelette(6)
    });

    let detail, stats;
    try {
      [detail, stats] = await Promise.all([
        SA.api(`/admin/ecoles/${ecoleId}`),
        SA.api(`/super-admin/ecoles/${ecoleId}/statistiques`)
      ]);
    } catch (erreur) {
      modale.querySelector('.sa-modale-corps').innerHTML = ui.etatErreur(erreur.message);
      return;
    }

    const ecole = detail.ecole;
    const abonnement = detail.abonnement;
    const directeur = detail.directeur_principal;
    const plans = (SA.referentiels && SA.referentiels.plans) || [];
    const suspendue = ecole.statut === 'suspendu';
    const enTest = ecole.mode_test === true;

    modale.querySelector('.sa-modale-entete h2').textContent =
      ecole.nom + (enTest ? '  🧪' : '');
    modale.querySelector('.sa-modale-corps').innerHTML = `
      ${enTest ? `<div class="sa-note" style="margin-bottom:14px">
        <strong>École de test.</strong> Accès complet à toutes les fonctionnalités,
        sans abonnement et sans aucun paiement enregistré. Elle est exclue du
        chiffre d'affaires, du MRR et du nombre d'écoles clientes.
        ${ecole.mode_test_motif ? `<br><span class="sa-muet">Motif : ${esc(ecole.mode_test_motif)}</span>` : ''}
        ${ecole.mode_test_active_at ? `<br><span class="sa-muet">Activé le ${esc(fmt.dateHeure(ecole.mode_test_active_at))}</span>` : ''}
      </div>` : ''}

      <div class="sa-grille-stats" style="margin-bottom:18px">
        ${ui.carteStat({ valeur: fmt.nombre(detail.stats && detail.stats.nb_eleves), etiquette: 'Élèves actifs' })}
        ${ui.carteStat({ valeur: fmt.nombre(detail.stats && detail.stats.nb_utilisateurs), etiquette: 'Utilisateurs' })}
        ${ui.carteStat({ valeur: fmt.nombre(detail.stats && detail.stats.nb_classes), etiquette: 'Classes' })}
        ${ui.carteStat({ valeur: fmt.pourcent(stats.reussite && stats.reussite.taux_reussite), etiquette: 'Taux de réussite' })}
      </div>

      <div class="sa-onglets" id="onglets-ecole">
        <button class="sa-onglet actif" data-onglet="identite">Identité</button>
        <button class="sa-onglet" data-onglet="abonnement">Abonnement</button>
        <button class="sa-onglet" data-onglet="activite">Activité</button>
        <button class="sa-onglet" data-onglet="acces">Accès</button>
      </div>

      <div data-panneau="identite">
        <div class="sa-liste-infos">
          <div class="sa-ligne-info"><span>Code</span><span class="sa-mono">${esc(ecole.code)}</span></div>
          <div class="sa-ligne-info"><span>Statut</span><span>${ui.badgeStatut(ecole.statut)}</span></div>
          <div class="sa-ligne-info"><span>Email</span><span>${esc(ecole.email || '—')}</span></div>
          <div class="sa-ligne-info"><span>Téléphone</span><span>${esc(ecole.telephone || '—')}</span></div>
          <div class="sa-ligne-info"><span>Ville / Province</span><span>${esc([ecole.ville, ecole.province].filter(Boolean).join(' · ') || '—')}</span></div>
          <div class="sa-ligne-info"><span>Type d'enseignement</span><span>${esc(String(ecole.type_enseignement || '').replace('_', ' '))}</span></div>
          <div class="sa-ligne-info"><span>Créée le</span><span>${esc(fmt.date(ecole.created_at))}</span></div>
          <div class="sa-ligne-info"><span>Mode test</span><span>${enTest ? ui.badge('activé', 'info') : '<span class="sa-muet">non</span>'}</span></div>
        </div>
        <div style="display:flex;gap:9px;margin-top:16px;flex-wrap:wrap">
          <button class="sa-bouton ${suspendue ? 'sa-bouton-principal' : 'sa-bouton-danger'} sa-bouton-petit" id="btn-statut">
            ${suspendue ? "Réactiver l'école" : "Suspendre l'école"}
          </button>
          <button class="sa-bouton ${enTest ? 'sa-bouton-secondaire' : 'sa-bouton-principal'} sa-bouton-petit" id="btn-mode-test">
            ${enTest ? 'Désactiver le mode test' : '🧪 Passer en école de test'}
          </button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-explorer">Explorer l'école</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-observer">Voir comme Directeur</button>
        </div>
      </div>

      <div data-panneau="abonnement" style="display:none">
        <div class="sa-liste-infos">
          <div class="sa-ligne-info"><span>Plan actuel</span><span>${esc(abonnement && abonnement.plan_nom || '—')}</span></div>
          <div class="sa-ligne-info"><span>Statut</span><span>${ui.badgeStatut(abonnement && abonnement.statut)}</span></div>
          <div class="sa-ligne-info"><span>Période d'essai</span><span>${abonnement && abonnement.en_periode_essai ? 'Oui' : 'Non'}</span></div>
          <div class="sa-ligne-info"><span>Expire le</span><span>${esc(fmt.date(abonnement && abonnement.date_expiration))}</span></div>
          <div class="sa-ligne-info"><span>Tarif</span><span>${esc(fmt.montant(abonnement && abonnement.prix, abonnement && abonnement.devise))}</span></div>
        </div>

        <h4 class="sa-section-titre" style="margin-top:18px">Ajuster l'abonnement</h4>
        <label class="sa-champ-bloc"><span>Changer de plan</span>
          <select class="sa-champ" id="champ-plan">
            <option value="">— inchangé —</option>
            ${plans.map((p) => `<option value="${esc(p.id)}" ${abonnement && abonnement.plan_id === p.id ? 'selected' : ''}>
              ${esc(p.nom)} — ${esc(fmt.montant(p.prix, p.devise))}</option>`).join('')}
          </select>
        </label>
        <label class="sa-champ-bloc"><span>Nouvelle date d'expiration</span>
          <input type="date" class="sa-champ" id="champ-expiration" />
        </label>
        <div style="display:flex;gap:9px;flex-wrap:wrap">
          <button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="btn-appliquer-abonnement">Appliquer</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-reactiver-abonnement">Réactiver l'abonnement</button>
        </div>

        <h4 class="sa-section-titre" style="margin-top:22px">Encaisser un paiement</h4>
        <p class="sa-note" style="margin-bottom:12px">
          Espèces, virement, chèque ou mobile money reçu hors ligne. L'enregistrement
          émet la facture, confirme le paiement, prolonge l'abonnement et remet
          l'école en service — en une seule opération.
        </p>
        <div style="display:flex;gap:9px;flex-wrap:wrap">
          <button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="btn-encaisser"
                  ${abonnement ? '' : 'disabled title="Cette école n\'a pas d\'abonnement"'}>
            Enregistrer un paiement
          </button>
        </div>

        <h4 class="sa-section-titre" style="margin-top:22px">Paiements récents</h4>
        ${ui.tableau({
          colonnes: [
            { cle: 'date_paiement', titre: 'Date', rendu: (l) => esc(fmt.date(l.date_paiement)) },
            { cle: 'montant', titre: 'Montant', classe: 'sa-num', rendu: (l) => esc(fmt.nombre(l.montant)) },
            {
              cle: 'methode', titre: 'Méthode',
              rendu: (l) => {
                const libelles = {
                  especes: 'Espèces', virement_bancaire: 'Virement', cheque: 'Chèque',
                  orange_money: 'Orange Money', airtel_money: 'Airtel Money', mpesa: 'M-Pesa'
                };
                const manuel = ['especes', 'virement_bancaire', 'cheque'].includes(l.methode);
                return ui.badge(libelles[l.methode] || l.methode, manuel ? 'attention' : 'info');
              }
            },
            {
              // La référence est la seule pièce rattachant un paiement en
              // espèces à un justificatif papier : elle doit être visible ici,
              // pas seulement dans le journal.
              cle: 'reference_externe', titre: 'Référence', classe: 'sa-mono',
              rendu: (l) => l.reference_externe
                ? esc(l.reference_externe) : '<span class="sa-muet">—</span>'
            },
            { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) }
          ],
          lignes: detail.paiements || [],
          vide: 'Aucun paiement enregistré'
        })}
      </div>

      <div data-panneau="activite" style="display:none">
        <h4 class="sa-section-titre">Activité sur 30 jours</h4>
        ${SA.graphe.courbe([{
          nom: 'Actions',
          points: (stats.activite_30_jours || []).map((a) => ({
            x: new Date(a.jour).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
            y: a.valeur
          }))
        }])}

        <h4 class="sa-section-titre" style="margin-top:18px">Assiduité <span class="sa-annexe">90 derniers jours</span></h4>
        <div class="sa-liste-infos">
          <div class="sa-ligne-info"><span>Taux de présence</span><span>${esc(fmt.pourcent(stats.assiduite && stats.assiduite.taux_presence))}</span></div>
          <div class="sa-ligne-info"><span>Taux d'absence</span><span>${esc(fmt.pourcent(stats.assiduite && stats.assiduite.taux_absence))}</span></div>
          <div class="sa-ligne-info"><span>Moyenne générale</span><span>${esc(fmt.pourcent(stats.reussite && stats.reussite.moyenne))}</span></div>
        </div>

        <h4 class="sa-section-titre" style="margin-top:18px">Effectifs par classe</h4>
        ${SA.graphe.barres((stats.classes || []).slice(0, 20).map((c) => ({ libelle: c.nom, valeur: c.effectif })))}
      </div>

      <div data-panneau="acces" style="display:none">
        <h4 class="sa-section-titre">Compte Directeur principal</h4>
        ${directeur ? `
          <div class="sa-liste-infos">
            <div class="sa-ligne-info"><span>Nom</span><span>${esc([directeur.prenom, directeur.nom].filter(Boolean).join(' '))}</span></div>
            <div class="sa-ligne-info"><span>Email</span><span>${esc(directeur.email)}</span></div>
            <div class="sa-ligne-info"><span>Statut</span><span>${ui.badgeStatut(directeur.statut)}</span></div>
            <div class="sa-ligne-info"><span>Créé le</span><span>${esc(fmt.date(directeur.created_at))}</span></div>
          </div>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-reset-mdp" style="margin-top:14px">
            Réinitialiser son mot de passe
          </button>
          <div id="zone-mdp" style="display:none;margin-top:12px" class="sa-bloc-code"></div>
        ` : ui.etatVide('Aucun compte Directeur', "Cette école n'a pas de compte directeur principal.")}
      </div>`;

    /* ---- Onglets ---- */
    const onglets = modale.querySelector('#onglets-ecole');
    onglets.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('[data-onglet]');
      if (!bouton) return;
      onglets.querySelectorAll('.sa-onglet').forEach((o) => o.classList.remove('actif'));
      bouton.classList.add('actif');
      modale.querySelectorAll('[data-panneau]').forEach((panneau) => {
        panneau.style.display = panneau.getAttribute('data-panneau') === bouton.getAttribute('data-onglet') ? '' : 'none';
      });
    });

    /* ---- Actions ---- */
    modale.querySelector('#btn-explorer').addEventListener('click', () => {
      modale.fermer();
      SA.naviguer(`explorer/ecole/${ecoleId}`);
    });

    modale.querySelector('#btn-observer').addEventListener('click', () => {
      modale.fermer();
      SA.naviguer('explorer/voir-comme', { ecole_id: ecoleId });
    });

    modale.querySelector('#btn-statut').addEventListener('click', async () => {
      const confirme = await SA.confirmer({
        titre: suspendue ? "Réactiver l'école" : "Suspendre l'école",
        message: suspendue
          ? `Les utilisateurs de « ${ecole.nom} » pourront à nouveau se connecter.`
          : `Les utilisateurs de « ${ecole.nom} » ne pourront plus se connecter. Aucune donnée n'est supprimée.`,
        libelleValider: suspendue ? 'Réactiver' : 'Suspendre',
        danger: !suspendue
      });
      if (!confirme) return;

      try {
        await SA.api(`/admin/ecoles/${ecoleId}`, {
          method: 'PATCH',
          body: JSON.stringify({ statut: suspendue ? 'actif' : 'suspendu' })
        });
        SA.toast(suspendue ? 'École réactivée.' : 'École suspendue.', 'succes');
        modale.fermer();
        if (surChangement) surChangement();
      } catch (erreur) {
        SA.toast(erreur.message, 'erreur');
      }
    });

    modale.querySelector('#btn-mode-test').addEventListener('click', async () => {
      const applique = async (corps) => {
        try {
          await SA.api(`/admin/ecoles/${ecoleId}/mode-test`, {
            method: 'PATCH',
            body: JSON.stringify(corps)
          });
          SA.toast(corps.actif
            ? 'Mode test activé : accès complet, sans abonnement ni paiement.'
            : "Mode test désactivé : l'école repasse sous le régime des abonnements.",
            'succes');
          modale.fermer();
          if (surChangement) surChangement();
        } catch (erreur) {
          SA.toast(erreur.message, 'erreur');
        }
      };

      if (enTest) {
        // La désactivation est le geste RISQUÉ des deux : une école de test
        // sans abonnement se referme dès qu'on lui retire le drapeau. Le
        // message le dit, plutôt que de laisser le Super Admin le découvrir
        // en recevant l'appel du directeur.
        const confirme = await SA.confirmer({
          titre: 'Désactiver le mode test',
          message: `« ${ecole.nom} » repassera sous le régime des abonnements. `
                 + `Sans abonnement actif, son accès sera de nouveau bloqué. `
                 + `Aucune donnée n'est supprimée.`,
          libelleValider: 'Désactiver',
          danger: true
        });
        if (confirme) await applique({ actif: false });
        return;
      }

      // L'activation demande un motif. Il n'est pas obligatoire côté serveur,
      // mais le champ est là parce que dans six mois, « pourquoi cette école
      // a-t-elle un accès gratuit ? » sera une vraie question, et le journal
      // sera le seul endroit à pouvoir y répondre.
      const demande = SA.modale({
        titre: 'Passer en école de test',
        sousTitre: `« ${ecole.nom} » aura accès à toutes les fonctionnalités.`,
        contenu: `
          <p class="sa-texte">
            Aucun abonnement ne sera créé et aucun paiement ne sera enregistré.
            L'école est exclue du chiffre d'affaires, du MRR et du nombre
            d'écoles clientes. Si elle était suspendue, elle est réactivée.
          </p>
          <label class="sa-champ-bloc"><span>Motif (recommandé)</span>
            <input class="sa-champ" id="f-motif-test"
                   placeholder="Démonstration commerciale, recette interne, formation…" />
          </label>`,
        actions: `
          <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
          <button class="sa-bouton sa-bouton-principal" data-role="valider">Activer le mode test</button>`
      });
      demande.querySelector('[data-role="annuler"]').addEventListener('click', () => demande.fermer());
      demande.querySelector('[data-role="valider"]').addEventListener('click', async () => {
        const motif = demande.querySelector('#f-motif-test').value.trim();
        demande.fermer();
        await applique({ actif: true, motif: motif || undefined });
      });
    });

    const boutonEncaisser = modale.querySelector('#btn-encaisser');
    if (boutonEncaisser && abonnement) {
      boutonEncaisser.addEventListener('click', () => {
        // La fiche école n'expose pas les mêmes noms que la liste des
        // abonnements : on normalise ici pour que le formulaire reçoive
        // toujours la même forme, quel que soit l'écran d'où on l'ouvre.
        ouvrirEncaissement({
          id: abonnement.id,
          ecole_nom: ecole.nom,
          ecole_statut: ecole.statut,
          plan_nom: abonnement.plan_nom,
          prix: abonnement.prix,
          devise: abonnement.devise,
          duree_jours: abonnement.duree_jours,
          date_expiration: abonnement.date_expiration
        }, () => {
          modale.fermer();
          if (surChangement) surChangement();
        });
      });
    }

    modale.querySelector('#btn-appliquer-abonnement').addEventListener('click', async () => {
      const planId = modale.querySelector('#champ-plan').value;
      const expiration = modale.querySelector('#champ-expiration').value;
      if (!planId && !expiration) return SA.toast('Aucun changement à appliquer.', 'attention');

      try {
        await SA.api(`/admin/ecoles/${ecoleId}/abonnement`, {
          method: 'PATCH',
          body: JSON.stringify({ plan_id: planId || undefined, date_expiration: expiration || undefined })
        });
        SA.toast('Abonnement mis à jour.', 'succes');
        modale.fermer();
        if (surChangement) surChangement();
      } catch (erreur) {
        SA.toast(erreur.message, 'erreur');
      }
    });

    modale.querySelector('#btn-reactiver-abonnement').addEventListener('click', async () => {
      try {
        await SA.api(`/admin/ecoles/${ecoleId}/abonnement`, {
          method: 'PATCH',
          body: JSON.stringify({ statut: 'actif' })
        });
        SA.toast('Abonnement réactivé.', 'succes');
        modale.fermer();
        if (surChangement) surChangement();
      } catch (erreur) {
        SA.toast(erreur.message, 'erreur');
      }
    });

    const boutonReset = modale.querySelector('#btn-reset-mdp');
    if (boutonReset) {
      boutonReset.addEventListener('click', async () => {
        const confirme = await SA.confirmer({
          titre: 'Réinitialiser le mot de passe',
          message: "Un nouveau mot de passe sera généré et affiché une seule fois. Les sessions ouvertes de ce compte seront fermées.",
          libelleValider: 'Réinitialiser',
          danger: true
        });
        if (!confirme) return;

        try {
          const r = await SA.api(`/admin/ecoles/${ecoleId}/reset-directeur-password`, { method: 'POST' });
          const zone = modale.querySelector('#zone-mdp');
          zone.style.display = '';
          zone.textContent = `${r.email}\n${r.nouveau_mot_de_passe}`;
          SA.toast('Mot de passe régénéré. Copiez-le maintenant : il ne sera plus affiché.', 'attention', 12000);
        } catch (erreur) {
          SA.toast(erreur.message, 'erreur');
        }
      });
    }
  }

  /* ======================================================================
     Création d'une école
     ====================================================================== */

  /**
   * Formulaire de création, en deux variantes.
   *
   * `{ modeTest: true }` ne masque pas seulement le choix du plan : il change
   * ce qui est CRÉÉ. Une école de test naît sans aucune ligne dans
   * `abonnements`, ce qui est précisément la raison d'être du mode — un
   * abonnement offert resterait un abonnement, avec son échéance, ses relances
   * de renouvellement et sa place dans le compte des écoles sous contrat.
   */
  function ouvrirCreationEcole(options = {}) {
    const modeTest = options.modeTest === true;
    const plans = (SA.referentiels && SA.referentiels.plans) || [];

    const modale = SA.modale({
      titre: modeTest ? 'Nouvelle école de test' : 'Nouvelle école',
      sousTitre: modeTest
        ? "Accès complet à toutes les fonctionnalités, sans abonnement ni paiement."
        : "Crée l'établissement, son abonnement et le premier compte Directeur.",
      contenu: `
        <h4 class="sa-section-titre">École</h4>
        <div class="sa-grille-3">
          <label class="sa-champ-bloc"><span>Nom *</span><input class="sa-champ" id="f-nom" required /></label>
          <label class="sa-champ-bloc"><span>Code de connexion *</span><input class="sa-champ" id="f-code" placeholder="college-boboto" required /></label>
          <label class="sa-champ-bloc"><span>Ville</span><input class="sa-champ" id="f-ville" /></label>
          <label class="sa-champ-bloc"><span>Province</span><input class="sa-champ" id="f-province" /></label>
          <label class="sa-champ-bloc"><span>Email</span><input type="email" class="sa-champ" id="f-email" /></label>
          <label class="sa-champ-bloc"><span>Téléphone</span><input class="sa-champ" id="f-telephone" /></label>
          <label class="sa-champ-bloc"><span>Type d'enseignement</span>
            <select class="sa-champ" id="f-type">
              <option value="les_deux">Primaire et secondaire</option>
              <option value="primaire">Primaire uniquement</option>
              <option value="secondaire">Secondaire uniquement</option>
            </select>
          </label>
          ${modeTest ? `
            <label class="sa-champ-bloc"><span>Motif (recommandé)</span>
              <input class="sa-champ" id="f-motif-test"
                     placeholder="Démonstration commerciale, recette interne, formation…" />
            </label>
          ` : `
            <label class="sa-champ-bloc"><span>Plan d'abonnement *</span>
              <select class="sa-champ" id="f-plan" required>
                ${plans.map((p) => `<option value="${esc(p.id)}">${esc(p.nom)} — ${esc(fmt.montant(p.prix, p.devise))}</option>`).join('')}
              </select>
            </label>
          `}
        </div>
        ${modeTest ? `<p class="sa-note">
          Aucun abonnement n'est créé et aucun paiement n'est enregistré. L'école
          est exclue du chiffre d'affaires, du MRR et du nombre d'écoles clientes.
          Le mode test se désactive à tout moment depuis sa fiche.
        </p>` : ''}

        <h4 class="sa-section-titre" style="margin-top:14px">Premier compte Directeur</h4>
        <div class="sa-grille-3">
          <label class="sa-champ-bloc"><span>Nom *</span><input class="sa-champ" id="f-dir-nom" required /></label>
          <label class="sa-champ-bloc"><span>Prénom</span><input class="sa-champ" id="f-dir-prenom" /></label>
          <label class="sa-champ-bloc"><span>Email *</span><input type="email" class="sa-champ" id="f-dir-email" required /></label>
        </div>
        <label class="sa-champ-bloc"><span>Mot de passe provisoire *</span>
          <input class="sa-champ" id="f-dir-mdp" required />
        </label>
        <p class="sa-note">Le directeur devra changer ce mot de passe à sa première connexion.</p>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-principal" data-role="creer">
          ${modeTest ? "Créer l'école de test" : "Créer l'école"}
        </button>`,
      large: true
    });

    // Mot de passe provisoire pré-généré : laisser l'administrateur en
    // inventer un l'amène à choisir toujours le même.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const aleatoire = new Uint32Array(10);
    (window.crypto || window.msCrypto).getRandomValues(aleatoire);
    modale.querySelector('#f-dir-mdp').value =
      Array.from(aleatoire).map((n) => alphabet[n % alphabet.length]).join('');

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());

    modale.querySelector('[data-role="creer"]').addEventListener('click', async (evenement) => {
      const bouton = evenement.currentTarget;
      const lire = (id) => modale.querySelector(id).value.trim();

      const corps = {
        nom: lire('#f-nom'), code: lire('#f-code'), ville: lire('#f-ville'),
        province: lire('#f-province'), email: lire('#f-email'),
        telephone: lire('#f-telephone'), type_enseignement: lire('#f-type'),
        directeur: {
          nom: lire('#f-dir-nom'), prenom: lire('#f-dir-prenom'),
          email: lire('#f-dir-email'), password: lire('#f-dir-mdp')
        }
      };

      if (modeTest) {
        corps.mode_test = true;
        const motif = lire('#f-motif-test');
        if (motif) corps.mode_test_motif = motif;
      } else {
        corps.plan_id = lire('#f-plan');
      }

      if (!corps.nom || !corps.code || !corps.directeur.email || !corps.directeur.password
          || (!modeTest && !corps.plan_id)) {
        return SA.toast('Renseignez les champs marqués d\'une étoile.', 'attention');
      }

      bouton.disabled = true;
      bouton.textContent = 'Création…';
      try {
        await SA.api('/admin/ecoles', { method: 'POST', body: JSON.stringify(corps) });
        SA.toast(modeTest
          ? 'École de test créée : accès complet, sans abonnement ni paiement.'
          : 'École créée.', 'succes');
        modale.fermer();
        await SA.chargerReferentiels(true);
        SA.rafraichirVue();
      } catch (erreur) {
        SA.toast(erreur.message, 'erreur');
        bouton.disabled = false;
        bouton.textContent = modeTest ? "Créer l'école de test" : "Créer l'école";
      }
    });
  }


  /* Exposé pour la palette de commandes (Ctrl/Cmd + K), qui ne connaît pas la
     portée de ce module. C'est le seul point d'entrée public de ce fichier :
     tout le reste passe par les vues enregistrées. */
  SA.ouvrirEcoleDeTest = function () {
    // La palette peut être ouverte depuis n'importe quel écran. On revient sur
    // la liste des écoles pour que la création, une fois terminée, rafraîchisse
    // quelque chose de visible plutôt que la page Finance.
    if (!SA.routeCourante || SA.routeCourante.cle !== 'ecoles') SA.naviguer('ecoles');
    ouvrirCreationEcole({ modeTest: true });
  };

  /* ======================================================================
     Encaissement d'un paiement d'abonnement
     ----------------------------------------------------------------------
     Beaucoup d'écoles règlent en espèces, de la main à la main. Ce paiement
     existait dans la réalité mais n'était enregistrable nulle part : le
     Directeur ne peut initier qu'un mobile money, et rien ne permettait au
     Super Admin de prendre acte d'un billet reçu. L'abonnement restait donc
     « en attente » et l'école suspendue, alors qu'elle avait payé.

     Le formulaire appelle la route qui existait déjà,
     POST /abonnements/:id/confirmer-paiement, laquelle enchaîne en une seule
     transaction : facture payée, paiement confirmé, abonnement réactivé avec
     une nouvelle échéance, et école remise en service. Aucune route jumelle
     n'a été créée pour l'occasion.
     ====================================================================== */

  function ouvrirEncaissement(abonnement, surSucces) {
    const methodes = (SA.referentiels && SA.referentiels.methodes_paiement) || [];
    if (!methodes.length) {
      return SA.toast('Méthodes de paiement indisponibles. Rechargez la page.', 'attention');
    }

    // Espèces en tête : c'est le cas le plus fréquent, il doit être le
    // premier sous la souris plutôt qu'à chercher dans la liste.
    const ordonnees = [...methodes].sort((a, b) =>
      (a.cle === 'especes' ? -1 : b.cle === 'especes' ? 1 : 0));

    const aujourdhui = new Date().toISOString().slice(0, 10);

    const modale = SA.modale({
      titre: 'Enregistrer un paiement',
      sousTitre: `${abonnement.ecole_nom || ''} — ${abonnement.plan_nom || 'sans plan'}`,
      contenu: `
        <p class="sa-note" style="margin-bottom:16px">
          À utiliser lorsque l'argent a <strong>déjà été reçu</strong>. L'enregistrement
          réactive l'abonnement et remet l'école en service immédiatement.
        </p>

        <div class="sa-grille-2">
          <label class="sa-champ-bloc"><span>Méthode *</span>
            <select class="sa-champ" id="p-methode">
              ${ordonnees.map((m) => `<option value="${esc(m.cle)}" data-manuel="${m.manuel ? '1' : ''}">
                ${esc(m.libelle)}</option>`).join('')}
            </select>
          </label>
          <label class="sa-champ-bloc"><span>Montant *</span>
            <input type="number" step="0.01" min="0" class="sa-champ" id="p-montant"
                   value="${esc(abonnement.prix || '')}" />
          </label>
          <label class="sa-champ-bloc"><span>Devise</span>
            <select class="sa-champ" id="p-devise">
              <option value="USD" ${abonnement.devise === 'USD' ? 'selected' : ''}>USD</option>
              <option value="FC" ${abonnement.devise === 'FC' ? 'selected' : ''}>FC</option>
            </select>
          </label>
          <label class="sa-champ-bloc"><span>Date de réception</span>
            <input type="date" class="sa-champ" id="p-date" value="${aujourdhui}" />
          </label>
        </div>

        <label class="sa-champ-bloc" id="bloc-reference">
          <span>Référence * <span style="font-weight:400;text-transform:none;letter-spacing:0">
            (n° de reçu, bordereau ou chèque)</span></span>
          <input class="sa-champ" id="p-reference" placeholder="ex. REC-2026-0184" />
        </label>

        <label class="sa-champ-bloc"><span>Note (facultatif)</span>
          <textarea class="sa-champ" id="p-note" style="min-height:64px"
                    placeholder="Remis par…, contexte, observation"></textarea>
        </label>

        <div class="sa-note" id="p-apercu"></div>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-principal" data-role="valider">Enregistrer le paiement</button>`,
      large: true
    });

    const champMethode = modale.querySelector('#p-methode');
    const blocReference = modale.querySelector('#bloc-reference');
    const champReference = modale.querySelector('#p-reference');
    const apercu = modale.querySelector('#p-apercu');

    // Aperçu de la nouvelle échéance, calculé côté interface avec la même
    // règle que le serveur : on repart de l'échéance en cours si elle n'est
    // pas atteinte, de maintenant sinon. L'administrateur voit donc ce qu'il
    // s'apprête à décider avant de cliquer.
    function rafraichirApercu() {
      const duree = Number(abonnement.duree_jours) || 0;
      const maintenant = new Date();
      const actuelle = abonnement.date_expiration ? new Date(abonnement.date_expiration) : null;
      const depart = (actuelle && actuelle > maintenant) ? actuelle : maintenant;
      const nouvelle = new Date(depart.getTime() + duree * 86400000);

      const prolonge = actuelle && actuelle > maintenant;
      apercu.innerHTML = `
        Nouvelle échéance : <strong>${esc(fmt.date(nouvelle))}</strong>
        ${duree ? ` (+${duree} jours)` : ''}.
        ${prolonge
          ? `L'échéance actuelle du ${esc(fmt.date(actuelle))} n'étant pas atteinte,
             les jours restants sont conservés.`
          : `L'abonnement passera en <strong>actif</strong>.`}
        ${abonnement.ecole_statut && abonnement.ecole_statut !== 'actif'
          ? `<br>L'école, actuellement <strong>${esc(abonnement.ecole_statut)}</strong>,
             sera remise en service.`
          : ''}`;
    }

    function rafraichirReference() {
      const manuel = champMethode.selectedOptions[0].getAttribute('data-manuel') === '1';
      blocReference.style.display = manuel ? '' : 'none';
      champReference.placeholder = manuel
        ? 'ex. REC-2026-0184' : 'ex. identifiant de transaction';
      // Pour un mobile money enregistré à la main, la référence reste utile
      // mais n'est pas exigée : la transaction laisse une trace chez l'opérateur.
      if (!manuel) blocReference.style.display = '';
    }

    champMethode.addEventListener('change', rafraichirReference);
    rafraichirReference();
    rafraichirApercu();

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());

    modale.querySelector('[data-role="valider"]').addEventListener('click', async (evenement) => {
      const bouton = evenement.currentTarget;
      const methode = champMethode.value;
      const manuel = champMethode.selectedOptions[0].getAttribute('data-manuel') === '1';
      const montant = modale.querySelector('#p-montant').value;
      const reference = champReference.value.trim();

      if (!montant || Number(montant) <= 0) {
        return SA.toast('Indiquez un montant supérieur à zéro.', 'attention');
      }
      if (manuel && !reference) {
        return SA.toast('Une référence est requise pour un règlement manuel.', 'attention');
      }

      const confirme = await SA.confirmer({
        titre: 'Confirmer l\'encaissement',
        message: `Enregistrer ${montant} ${modale.querySelector('#p-devise').value} `
               + `en ${champMethode.selectedOptions[0].textContent.trim().toLowerCase()} `
               + `pour « ${abonnement.ecole_nom} » ? `
               + `L'abonnement sera réactivé et l'école remise en service.`,
        libelleValider: 'Enregistrer'
      });
      if (!confirme) return;

      bouton.disabled = true;
      bouton.textContent = 'Enregistrement…';
      try {
        const r = await SA.api(`/abonnements/${abonnement.id}/confirmer-paiement`, {
          method: 'POST',
          body: JSON.stringify({
            montant: Number(montant),
            methode,
            devise: modale.querySelector('#p-devise').value,
            reference: reference || null,
            note: modale.querySelector('#p-note').value.trim() || null
          })
        });

        SA.toast(
          `${r.message} Facture ${r.facture}, échéance au ${fmt.date(r.nouvelleExpiration)}.`,
          'succes', 9000);
        modale.fermer();
        await SA.chargerReferentiels(true);
        if (surSucces) surSucces();
      } catch (erreur) {
        SA.toast(erreur.message, 'erreur', 9000);
        bouton.disabled = false;
        bouton.textContent = 'Enregistrer le paiement';
      }
    });
  }

  SA.ouvrirEncaissement = ouvrirEncaissement;

  /* ======================================================================
     Abonnements
     ====================================================================== */

  SA.enregistrerVue('ecoles/abonnements', {
    titre: 'Abonnements',
    sousTitre: 'Échéances, plans et revenus par établissement.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = '';
      const barre = document.createElement('div');
      const zone = document.createElement('div');
      zone.innerHTML = ui.squelette(8);
      conteneur.append(barre, zone);

      const plans = (SA.referentiels && SA.referentiels.plans) || [];

      const filtres = SA.ui.barreFiltres(barre, [
        { type: 'recherche', nom: 'recherche', libelle: 'Nom ou code d\'école…', valeur: params.recherche },
        {
          type: 'select', nom: 'statut', libelle: 'Tous les statuts', valeur: params.statut,
          options: [
            { valeur: 'actif', libelle: 'Actif' },
            { valeur: 'en_attente', libelle: 'En attente' },
            { valeur: 'expire', libelle: 'Expiré' },
            { valeur: 'suspendu', libelle: 'Suspendu' }
          ]
        },
        {
          type: 'select', nom: 'plan_id', libelle: 'Tous les plans', valeur: params.plan_id,
          options: plans.map((p) => ({ valeur: p.id, libelle: p.nom }))
        }
      ], (valeurs) => SA.naviguer('ecoles/abonnements', Object.assign({}, valeurs, { page: 1 })));

      const requete = Object.assign({}, filtres.lire(), { page: params.page || 1 });
      const d = await SA.api(SA.url('/super-admin/abonnements', requete));

      zone.innerHTML = `
        ${(d.repartition_par_plan && d.repartition_par_plan.length) ? `
        <div class="sa-panneau" style="margin-bottom:16px">
          <h3 class="sa-section-titre">Répartition des abonnements actifs</h3>
          ${SA.graphe.repartition(d.repartition_par_plan.map((r) => ({
            libelle: r.plan_nom || 'sans plan', valeur: Number(r.nb)
          })))}
        </div>` : ''}

        ${ui.tableau({
          cliquable: true,
          colonnes: [
            {
              cle: 'ecole_nom', titre: 'École',
              rendu: (l) => `<strong>${esc(l.ecole_nom)}</strong>
                             <div class="sa-muet" style="font-size:.76rem">${esc(l.ecole_code)}</div>`
            },
            { cle: 'plan_nom', titre: 'Plan' },
            { cle: 'prix', titre: 'Tarif', classe: 'sa-num', rendu: (l) => esc(fmt.montant(l.prix, l.devise)) },
            { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) },
            {
              cle: 'en_periode_essai', titre: 'Essai',
              rendu: (l) => l.en_periode_essai ? ui.badge('essai', 'info') : '<span class="sa-muet">—</span>'
            },
            { cle: 'date_expiration', titre: 'Expire le', rendu: (l) => esc(fmt.date(l.date_expiration)) },
            {
              cle: 'jours_restants', titre: 'Reste', classe: 'sa-num',
              rendu: (l) => {
                const j = Number(l.jours_restants);
                if (!Number.isFinite(j)) return '<span class="sa-muet">—</span>';
                const ton = j < 0 ? 'danger' : j <= 14 ? 'attention' : 'succes';
                return ui.badge(j < 0 ? `${Math.abs(j)} j de retard` : `${j} j`, ton);
              }
            },
            { cle: 'revenu_cumule', titre: 'Revenu cumulé', classe: 'sa-num', rendu: (l) => esc(fmt.nombre(l.revenu_cumule)) },
            {
              cle: 'encaisser', titre: '',
              rendu: (l, i) => `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
                                        data-encaisser="${i}">Encaisser</button>`
            }
          ],
          lignes: d.donnees,
          vide: 'Aucun abonnement'
        })}
        ${ui.pagination(d.pagination)}`;

      brancherPagination(zone, 'ecoles/abonnements', requete);

      // Le bouton d'encaissement est posé AVANT l'écouteur de ligne et coupe
      // la propagation : sans cela, un clic dessus ouvrirait aussi la fiche
      // école par-dessus le formulaire de paiement.
      zone.querySelectorAll('[data-encaisser]').forEach((bouton) => {
        bouton.addEventListener('click', (evenement) => {
          evenement.stopPropagation();
          const abonnement = d.donnees[Number(bouton.getAttribute('data-encaisser'))];
          if (abonnement) ouvrirEncaissement(abonnement, () => SA.rafraichirVue());
        });
      });

      zone.querySelectorAll('tbody tr').forEach((ligne, index) => {
        ligne.addEventListener('click', () => {
          const abonnement = d.donnees[index];
          if (abonnement) ouvrirFicheEcole(abonnement.ecole_id, () => SA.rafraichirVue());
        });
      });
    }
  });

  /* ======================================================================
     Statistiques par école
     ====================================================================== */

  SA.enregistrerVue('ecoles/statistiques', {
    titre: 'Statistiques par école',
    sousTitre: 'Effectifs, activité, assiduité et résultats d\'un établissement.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = '';
      const barre = document.createElement('div');
      const zone = document.createElement('div');
      conteneur.append(barre, zone);

      const ecoles = (SA.referentiels && SA.referentiels.ecoles) || [];
      const ecoleId = params.ecole_id || (ecoles[0] && ecoles[0].id) || '';

      SA.ui.barreFiltres(barre, [
        { type: 'ecoles', nom: 'ecole_id', libelle: 'Choisir une école', valeur: ecoleId }
      ], (valeurs) => SA.naviguer('ecoles/statistiques', valeurs));

      if (!ecoleId) {
        zone.innerHTML = ui.etatVide('Aucune école', 'Créez une école pour consulter ses statistiques.');
        return;
      }

      zone.innerHTML = ui.squelette(5, 150);
      const d = await SA.api(`/super-admin/ecoles/${ecoleId}/statistiques`);
      const ecole = d.ecole || {};

      zone.innerHTML = `
        <div class="sa-grille-stats" style="margin-bottom:18px">
          ${ui.carteStat({ valeur: fmt.nombre((d.classes || []).reduce((s, c) => s + c.effectif, 0)), etiquette: 'Élèves répartis en classe' })}
          ${ui.carteStat({ valeur: fmt.nombre((d.classes || []).length), etiquette: 'Classes' })}
          ${ui.carteStat({ valeur: fmt.pourcent(d.assiduite && d.assiduite.taux_presence), etiquette: 'Taux de présence (90 j)', ton: 'succes' })}
          ${ui.carteStat({ valeur: fmt.pourcent(d.reussite && d.reussite.taux_reussite), etiquette: 'Taux de réussite' })}
          ${ui.carteStat({ valeur: fmt.pourcent(d.reussite && d.reussite.moyenne), etiquette: 'Moyenne générale' })}
          ${ui.carteStat({ valeur: ui.badgeStatut(ecole.statut_abonnement), etiquette: 'Abonnement', detail: fmt.date(ecole.date_expiration) })}
        </div>

        <div class="sa-grille-2">
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Activité sur 30 jours</h3>
            ${SA.graphe.courbe([{
              nom: 'Actions',
              points: (d.activite_30_jours || []).map((a) => ({
                x: new Date(a.jour).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
                y: a.valeur
              }))
            }])}
          </div>
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Frais scolaires encaissés</h3>
            ${SA.graphe.barres((d.finances_par_mois || []).slice().reverse().map((f) => ({
              libelle: f.mois, valeur: f.montant
            })), { couleur: 'var(--ocre-dark)' })}
          </div>
        </div>

        <div class="sa-section" style="margin-top:18px">
          <h2 class="sa-section-titre">Effectifs par classe</h2>
          ${SA.graphe.barres((d.classes || []).map((c) => ({ libelle: c.nom, valeur: c.effectif })))}
        </div>

        <div style="margin-top:18px;display:flex;gap:9px;flex-wrap:wrap">
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-explorer-stats">Explorer cette école</button>
        </div>`;

      const bouton = document.getElementById('btn-explorer-stats');
      if (bouton) bouton.addEventListener('click', () => SA.naviguer(`explorer/ecole/${ecoleId}`));
    }
  });

  /* ======================================================================
     Utilisateurs
     ====================================================================== */

  SA.enregistrerVue('utilisateurs', {
    titre: 'Utilisateurs',
    sousTitre: 'Tous les comptes de la plateforme, toutes écoles confondues.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = '';
      const barre = document.createElement('div');
      const zone = document.createElement('div');
      zone.innerHTML = ui.squelette(9);
      conteneur.append(barre, zone);

      const roles = (SA.referentiels && SA.referentiels.roles) || [];

      const filtres = SA.ui.barreFiltres(barre, [
        { type: 'recherche', nom: 'recherche', libelle: 'Nom, email, téléphone…', valeur: params.recherche },
        { type: 'ecoles', nom: 'ecole_id', libelle: 'Toutes les écoles', valeur: params.ecole_id },
        {
          type: 'select', nom: 'role', libelle: 'Tous les rôles', valeur: params.role,
          options: roles.map((r) => ({ valeur: r.role, libelle: fmt.role(r.role) }))
        },
        {
          type: 'select', nom: 'statut', libelle: 'Tous les statuts', valeur: params.statut,
          options: [
            { valeur: 'actif', libelle: 'Actif' },
            { valeur: 'inactif', libelle: 'Inactif' },
            { valeur: 'bloque', libelle: 'Bloqué' }
          ]
        }
      ], (valeurs) => SA.naviguer('utilisateurs', Object.assign({}, valeurs, { page: 1 })));

      const requete = Object.assign({}, filtres.lire(), {
        page: params.page || 1,
        tri: params.tri || 'creation',
        sens: params.sens || 'desc'
      });

      const d = await SA.api(SA.url('/super-admin/utilisateurs', requete));

      zone.innerHTML = `
        ${(d.repartition_par_role && d.repartition_par_role.length) ? `
        <div class="sa-panneau" style="margin-bottom:16px">
          <h3 class="sa-section-titre">Répartition par rôle</h3>
          ${SA.graphe.repartition(d.repartition_par_role.map((r) => ({
            libelle: fmt.role(r.role), valeur: Number(r.nb)
          })))}
        </div>` : ''}

        ${ui.tableau({
          cliquable: true,
          tri: d.tri,
          colonnes: [
            {
              cle: 'nom', titre: 'Compte', triable: true,
              rendu: (l) => `<strong>${esc([l.prenom, l.nom].filter(Boolean).join(' ') || '—')}</strong>
                             <div class="sa-muet" style="font-size:.76rem">${esc(l.email)}</div>`
            },
            {
              cle: 'roles', titre: 'Rôles',
              rendu: (l) => (l.roles || []).length
                ? (l.roles || []).map((r) => ui.badge(fmt.role(r), r === 'super_admin' ? 'attention' : 'info')).join(' ')
                : '<span class="sa-muet">aucun</span>'
            },
            { cle: 'ecole', titre: 'École', triable: true, rendu: (l) => esc(l.ecole_nom || 'Plateforme') },
            { cle: 'telephone', titre: 'Téléphone' },
            {
              cle: 'statut', titre: 'Statut', triable: true,
              rendu: (l) => `${ui.badgeStatut(l.statut)}
                             ${l.mot_de_passe_provisoire ? ' ' + ui.badge('mdp provisoire', 'attention') : ''}`
            },
            {
              cle: 'derniere_connexion', titre: 'Dernière connexion', triable: true,
              rendu: (l) => l.derniere_connexion
                ? `<span title="${esc(fmt.dateHeure(l.derniere_connexion))}">${esc(fmt.relatif(l.derniere_connexion))}</span>`
                : '<span class="sa-muet">jamais</span>'
            },
            {
              cle: 'sessions_actives', titre: 'Sessions', classe: 'sa-num',
              rendu: (l) => Number(l.sessions_actives)
                ? ui.badge(String(l.sessions_actives), 'succes')
                : '<span class="sa-muet">0</span>'
            }
          ],
          lignes: d.donnees,
          vide: 'Aucun compte ne correspond'
        })}
        ${ui.pagination(d.pagination)}`;

      brancherTri(zone, 'utilisateurs', requete);
      brancherPagination(zone, 'utilisateurs', requete);

      zone.querySelectorAll('tbody tr[data-id]').forEach((ligne) => {
        ligne.addEventListener('click', () => ouvrirFicheUtilisateur(ligne.getAttribute('data-id')));
      });
    }
  });

  async function ouvrirFicheUtilisateur(id) {
    const modale = SA.modale({ titre: 'Chargement…', large: true, contenu: ui.squelette(5) });

    let d;
    try {
      d = await SA.api(`/super-admin/utilisateurs/${id}`);
    } catch (erreur) {
      modale.querySelector('.sa-modale-corps').innerHTML = ui.etatErreur(erreur.message);
      return;
    }

    const c = d.compte;
    modale.querySelector('.sa-modale-entete h2').textContent =
      [c.prenom, c.nom].filter(Boolean).join(' ') || c.email;

    modale.querySelector('.sa-modale-corps').innerHTML = `
      <div class="sa-liste-infos">
        <div class="sa-ligne-info"><span>Email</span><span>${esc(c.email)}</span></div>
        <div class="sa-ligne-info"><span>Téléphone</span><span>${esc(c.telephone || '—')}</span></div>
        <div class="sa-ligne-info"><span>École</span><span>${esc(c.ecole_nom || 'Plateforme')}</span></div>
        <div class="sa-ligne-info"><span>Rôles</span><span>${(c.roles || []).map((r) => ui.badge(fmt.role(r), 'info')).join(' ') || '—'}</span></div>
        <div class="sa-ligne-info"><span>Statut</span><span>${ui.badgeStatut(c.statut)}</span></div>
        <div class="sa-ligne-info"><span>Mot de passe provisoire</span><span>${c.mot_de_passe_provisoire ? 'Oui' : 'Non'}</span></div>
        <div class="sa-ligne-info"><span>Créé le</span><span>${esc(fmt.dateHeure(c.created_at))}</span></div>
      </div>

      <h4 class="sa-section-titre" style="margin-top:20px">Sessions</h4>
      ${ui.tableau({
        colonnes: [
          { cle: 'created_at', titre: 'Ouverte le', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
          { cle: 'ip', titre: 'Adresse IP', classe: 'sa-mono' },
          { cle: 'user_agent', titre: 'Appareil', rendu: (l) => `<span class="sa-tronque" title="${esc(l.user_agent)}">${esc(l.user_agent || '—')}</span>` },
          { cle: 'active', titre: 'État', rendu: (l) => ui.badge(l.active ? 'active' : 'expirée', l.active ? 'succes' : 'neutre') }
        ],
        lignes: d.sessions || [],
        vide: 'Aucune session'
      })}

      <h4 class="sa-section-titre" style="margin-top:20px">Actions récentes</h4>
      ${ui.tableau({
        colonnes: [
          { cle: 'created_at', titre: 'Date', rendu: (l) => esc(fmt.dateHeure(l.created_at)) },
          { cle: 'action', titre: 'Action', classe: 'sa-mono' },
          { cle: 'cible_type', titre: 'Cible' }
        ],
        lignes: d.actions_recentes || [],
        vide: 'Aucune action journalisée'
      })}

      <p class="sa-note" style="margin-top:18px">
        Cette fiche est en consultation. La modification d'un compte se fait
        depuis l'espace de son école, par son directeur — c'est lui qui répond
        de son personnel.
      </p>`;
  }
})();
