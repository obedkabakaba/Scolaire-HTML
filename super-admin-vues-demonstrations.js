/* =============================================================================
   SUPER ADMIN — DÉMONSTRATIONS
   =============================================================================

   CE QUE CET ÉCRAN SERT À FAIRE
   -----------------------------
   Les essais gratuits se créent tout seuls depuis /essai/. Cet écran n'est donc
   pas un formulaire de création : c'est un poste de pilotage. Il répond à trois
   questions, dans cet ordre :

     · laquelle demande une décision maintenant ? (à vérifier, expire demain)
     · laquelle travaille vraiment ? (élèves saisis, dernière activité)
     · laquelle s'est convertie ?

   D'où le tri par défaut : les démos « à vérifier » d'abord, puis les actives
   par échéance la plus proche. Trier par date de création enterrerait sous les
   anciennes celle qui expire demain — c'est-à-dire exactement celle qu'il faut
   rappeler aujourd'hui.

   TOUTES LES ACTIONS SONT RÉELLES
   -------------------------------
   Chaque bouton appelle une route qui modifie l'abonnement ET le dossier de
   démonstration, et journalise l'opération avec le nom du Super Admin. Aucun
   bouton décoratif : suspendre suspend vraiment, et l'école le constate à la
   requête suivante.
   ============================================================================= */

(function () {
  'use strict';

  const SA = window.SA;
  const ui = SA.ui;
  const esc = SA.esc;

  /** Ton visuel par statut de démonstration. */
  const TONS = {
    active: 'succes', a_verifier: 'attention', suspendue: 'danger',
    expiree: 'neutre', convertie: 'succes', terminee: 'neutre'
  };
  const LIBELLES = {
    active: 'Active', a_verifier: 'À vérifier', suspendue: 'Suspendue',
    expiree: 'Expirée', convertie: 'Convertie', terminee: 'Terminée'
  };

  /**
   * Le compte à rebours, lisible d'un coup d'œil.
   *
   * Le nombre vient du SERVEUR (`jours_restants`), calculé par PostgreSQL. Le
   * recalculer ici à partir de `Date.now()` ferait dépendre l'affichage de
   * l'horloge du poste du Super Admin, qui n'est pas celle qui décide.
   */
  function joursRestants(l) {
    if (l.statut === 'convertie') return '<span class="sa-muet">converti</span>';
    if (l.statut === 'expiree' || l.statut === 'terminee') return '<span class="sa-muet">terminé</span>';
    const j = Number(l.jours_restants);
    if (!Number.isFinite(j)) return '<span class="sa-muet">—</span>';
    if (j <= 0) return ui.badge('expire aujourd’hui', 'danger');
    if (j <= 2) return ui.badge(`${j} j`, 'danger');
    if (j <= 4) return ui.badge(`${j} j`, 'attention');
    return `${j} j`;
  }

  /**
   * Signe d'activité réelle.
   *
   * Un compte créé n'est pas un usage. Une démo sans le moindre élève au bout
   * de trois jours ne se convertira pas : ce sont ces deux chiffres, et non la
   * date de création, qui disent lesquelles méritent un appel.
   */
  function activite(l) {
    const e = Number(l.nb_eleves) || 0;
    const c = Number(l.nb_classes) || 0;
    if (!e && !c) return ui.badge('aucune saisie', 'attention');
    return `<span class="sa-mono">${SA.fmt.nombre(e)} élève(s) · ${SA.fmt.nombre(c)} classe(s)</span>`;
  }

  /* =========================================================================
     ACTIONS
     ========================================================================= */

  async function appeler(chemin, corps, messageSucces) {
    try {
      await SA.api(chemin, {
        method: 'POST',
        body: JSON.stringify(Object.assign({ confirmation: true }, corps || {}))
      });
      SA.toast(messageSucces, 'succes');
      SA.rafraichirVue();
    } catch (err) {
      SA.toast(err.message || 'Opération impossible.', 'erreur');
    }
  }

  /**
   * Ouvre une modale de saisie et branche ses deux boutons.
   *
   * `SA.modale` attend ses actions sous forme de CHAÎNE HTML et ne gère aucun
   * rappel : le câblage est donc à faire soi-même. Cet enrobage évite de le
   * recopier dans les cinq modales de l'écran, et garantit qu'elles se ferment
   * toutes de la même façon.
   *
   * `valider` peut REFUSER en renvoyant un message : la modale reste alors
   * ouverte avec l'erreur affichée, au lieu de disparaître en obligeant
   * l'utilisateur à tout retaper.
   */
  function modaleSaisie({ titre, sousTitre, contenu, libelleValider, danger, valider }) {
    const modale = SA.modale({
      titre, sousTitre,
      contenu: contenu + '<p class="sa-erreur-modale" data-erreur hidden></p>',
      actions: '<button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>'
        + '<button class="sa-bouton ' + (danger ? 'sa-bouton-danger' : 'sa-bouton-principal') + '"'
        + ' data-role="valider">' + esc(libelleValider) + '</button>'
    });

    const erreur = modale.querySelector('[data-erreur]');
    const bValider = modale.querySelector('[data-role="valider"]');
    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());
    bValider.addEventListener('click', async () => {
      bValider.disabled = true;
      try {
        const refus = await valider(modale);
        if (refus) { erreur.hidden = false; erreur.textContent = refus; return; }
        modale.fermer();
      } finally { bValider.disabled = false; }
    });
    return modale;
  }

  /** Suspendre / réactiver / terminer. Le motif est exigé côté serveur aussi. */
  function actionStatut(l, action, libelle, danger) {
    const besoinMotif = action === 'suspendre' || action === 'terminer';
    const explication = action === 'suspendre'
      ? "L'école perdra l'accès immédiatement. Ses données sont intégralement conservées."
      : action === 'terminer'
        ? "L'essai sera clos. Les données restent en base et l'école pourra être convertie plus tard."
        : "L'accès est rétabli selon la date d'expiration en cours. Cette action ne prolonge pas l'essai — utilisez « Prolonger » pour cela.";

    modaleSaisie({
      titre: libelle + ' la démonstration',
      sousTitre: l.ecole_nom + ' — ' + l.responsable_nom,
      libelleValider: libelle,
      danger: danger,
      contenu: '<p class="sa-texte">' + explication + '</p>'
        + (besoinMotif
            ? '<label class="sa-champ"><span>Motif (obligatoire)</span>'
              + '<textarea id="demo-motif" rows="3" placeholder="Journalisé : il permettra de '
              + 'répondre au directeur s\'il appelle."></textarea></label>'
            : ''),
      valider: async () => {
        const motif = besoinMotif
          ? String((document.getElementById('demo-motif') || {}).value || '').trim() : '';
        if (besoinMotif && motif.length < 3) return 'Un motif est requis pour cette action.';
        await appeler('/super-admin/demonstrations/' + l.id + '/' + action, { motif },
          'Démonstration mise à jour.');
      }
    });
  }

  function actionProlonger(l) {
    const deja = Number(l.jours_prolongation) > 0
      ? '<strong>Cette démonstration a déjà été prolongée de ' + l.jours_prolongation
        + ' jour(s).</strong>' : '';

    modaleSaisie({
      titre: 'Prolonger la démonstration',
      sousTitre: l.ecole_nom + ' — expire le ' + SA.fmt.date(l.fin_at),
      libelleValider: 'Prolonger',
      contenu: '<p class="sa-texte">Une prolongation est une faveur commerciale : elle est '
        + 'journalisée à votre nom. ' + deja + '</p>'
        + '<label class="sa-champ"><span>Nombre de jours (1 à 90)</span>'
        + '<input type="number" id="demo-jours" min="1" max="90" value="7" /></label>'
        + '<label class="sa-champ"><span>Motif (obligatoire)</span>'
        + '<textarea id="demo-motif" rows="3" placeholder="ex. essai entamé pendant les congés, '
        + 'école rappelée le 12"></textarea></label>',
      valider: async () => {
        const jours = Number((document.getElementById('demo-jours') || {}).value);
        const motif = String((document.getElementById('demo-motif') || {}).value || '').trim();
        if (!Number.isInteger(jours) || jours < 1 || jours > 90) {
          return 'Indiquez un nombre de jours entier entre 1 et 90.';
        }
        if (motif.length < 3) return 'Un motif est requis.';
        await appeler('/super-admin/demonstrations/' + l.id + '/prolonger', { jours, motif },
          'Démonstration prolongée de ' + jours + ' jour(s).');
      }
    });
  }

  function actionConvertir(l, offres) {
    const options = (offres || []).map((o) =>
      '<option value="' + esc(o.id) + '">' + esc(o.nom) + '</option>').join('');

    modaleSaisie({
      titre: 'Convertir en abonnement payant',
      sousTitre: l.ecole_nom + ' — a testé ' + (l.offre_nom || '—'),
      libelleValider: 'Convertir',
      contenu: "<p class=\"sa-texte\"><strong>Aucune donnée n'est déplacée ni recréée.</strong> "
        + "L'école garde son espace, ses élèves et ses notes ; seul l'abonnement change. Elle "
        + "n'est pas tenue de souscrire l'offre testée : une démo en Prime suivie d'un achat en "
        + "Ascension est un cas normal.</p>"
        + '<label class="sa-champ"><span>Offre souscrite</span>'
        + '<select id="demo-plan">' + options + '</select></label>'
        + '<label class="sa-champ"><span>Périodicité</span><select id="demo-periodicite">'
        + '<option value="mensuel">Mensuel</option>'
        + '<option value="semestriel">Semestriel</option>'
        + '<option value="annuel" selected>Annuel</option></select></label>',
      valider: async () => {
        const plan = (document.getElementById('demo-plan') || {}).value;
        const per = (document.getElementById('demo-periodicite') || {}).value;
        if (!plan) return 'Choisissez une offre.';
        await appeler('/super-admin/demonstrations/' + l.id + '/convertir',
          { plan_id: plan, periodicite: per }, 'Abonnement activé. Données conservées.');
      }
    });
  }

  function actionChangerOffre(l, offres) {
    const options = (offres || []).map((o) =>
      '<option value="' + esc(o.id) + '"' + (o.code === l.offre_code ? ' selected' : '')
      + '>' + esc(o.nom) + '</option>').join('');

    modaleSaisie({
      titre: "Changer l'offre testée",
      sousTitre: l.ecole_nom + " — sans prolonger ni convertir l'essai",
      libelleValider: "Changer l'offre",
      contenu: "<p class=\"sa-texte\">Utile quand un établissement demande à tester un module "
        + "que l'offre de démonstration par défaut ne comprend pas. La date d'expiration ne "
        + "bouge pas.</p>"
        + '<label class="sa-champ"><span>Offre servie pendant l\'essai</span>'
        + '<select id="demo-plan">' + options + '</select></label>',
      valider: async () => {
        const plan = (document.getElementById('demo-plan') || {}).value;
        await appeler('/super-admin/demonstrations/' + l.id + '/offre', { plan_id: plan },
          'Offre de démonstration modifiée.');
      }
    });
  }

  /* =========================================================================
     VUE PRINCIPALE
     ========================================================================= */

  SA.enregistrerVue('demonstrations', {
    titre: 'Démonstrations',
    sousTitre: 'Les essais gratuits en cours, leur activité réelle et leur conversion.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squeletteCartes(4) + ui.squelette(6, 46);

      const statut = params.statut || 'tous';
      const [resume, liste, reglages] = await Promise.all([
        SA.api('/super-admin/demonstrations-resume'),
        SA.api(SA.url('/super-admin/demonstrations', {
          statut: statut === 'tous' ? undefined : statut,
          q: params.q || undefined,
          page: params.page || undefined
        })),
        SA.api('/super-admin/demonstrations-reglages')
      ]);

      const offres = reglages.offres_disponibles || [];

      /* ------------------------------------------------ Actions d'en-tête */
      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-reglages">Réglages de l'essai</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="btn-expirer">Passer les échues</button>`;

        document.getElementById('btn-reglages').addEventListener('click', () =>
          modaleReglages(reglages));

        // Le travail de fond le fait déjà périodiquement. Ce bouton évite
        // d'attendre le prochain passage quand on veut vérifier un cas.
        document.getElementById('btn-expirer').addEventListener('click', async () => {
          try {
            const r = await SA.api('/super-admin/demonstrations-expirer', { method: 'POST' });
            SA.toast(r.message, 'succes');
            SA.rafraichirVue();
          } catch (err) { SA.toast(err.message, 'erreur'); }
        });
      }

      /* ------------------------------------------------------- Rendu */
      const r = resume;
      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-grille-stats">
            ${ui.carteStat({ valeur: SA.fmt.nombre(r.actives), etiquette: 'Essais en cours', ton: 'succes' })}
            ${ui.carteStat({ valeur: SA.fmt.nombre(r.expirent_bientot), etiquette: 'Expirent sous 48 h',
                             ton: Number(r.expirent_bientot) > 0 ? 'attention' : 'neutre',
                             detail: 'À rappeler en priorité' })}
            ${ui.carteStat({ valeur: SA.fmt.nombre(r.a_verifier), etiquette: 'À vérifier',
                             ton: Number(r.a_verifier) > 0 ? 'attention' : 'neutre',
                             detail: 'Empreinte déjà vue' })}
            ${ui.carteStat({
                valeur: r.taux_conversion === null ? '—' : r.taux_conversion + ' %',
                etiquette: 'Taux de conversion',
                ton: 'info',
                detail: r.base_conversion
                  ? `sur ${SA.fmt.nombre(r.base_conversion)} essai(s) terminé(s)`
                  : 'aucun essai encore terminé' })}
          </div>
        </section>

        <section class="sa-section">
          <div class="sa-barre-filtres">
            <select id="filtre-statut">
              ${['tous', 'active', 'a_verifier', 'suspendue', 'expiree', 'convertie', 'terminee']
                .map((s) => `<option value="${s}"${s === statut ? ' selected' : ''}>${
                  s === 'tous' ? 'Tous les statuts' : LIBELLES[s]}</option>`).join('')}
            </select>
            <input type="search" id="filtre-q" placeholder="École, responsable ou e-mail…"
                   value="${esc(params.q || '')}" />
          </div>

          ${ui.tableau({
            colonnes: [
              { cle: 'ecole_nom', titre: 'École',
                rendu: (l) => `<strong>${esc(l.ecole_nom)}</strong>
                  <div class="sa-muet">${esc(l.ville || '')}${l.commune ? ' · ' + esc(l.commune) : ''}</div>` },
              { cle: 'responsable_nom', titre: 'Responsable',
                rendu: (l) => `${esc(l.responsable_nom)}
                  ${l.responsable_fonction ? `<div class="sa-muet">${esc(l.responsable_fonction)}</div>` : ''}
                  <div class="sa-muet sa-mono">${esc(l.responsable_email)}</div>` },
              { cle: 'offre_nom', titre: 'Offre testée',
                rendu: (l) => esc(l.offre_nom || '—')
                  + (l.offre_souscrite_nom
                      ? `<div class="sa-muet">→ ${esc(l.offre_souscrite_nom)}</div>` : '') },
              { cle: 'statut', titre: 'Statut',
                rendu: (l) => ui.badge(LIBELLES[l.statut] || l.statut, TONS[l.statut])
                  + (l.motif_verification ? `<div class="sa-muet" title="${esc(l.motif_verification)}">signalée</div>` : '') },
              { cle: 'fin_at', titre: 'Reste', classe: 'sa-num', rendu: joursRestants },
              { cle: 'activite', titre: 'Activité', rendu: activite },
              { cle: 'derniere_activite', titre: 'Dernière activité',
                rendu: (l) => l.derniere_activite
                  ? `<span class="sa-muet">${SA.fmt.date(l.derniere_activite)}</span>`
                  : '<span class="sa-muet">jamais</span>' },
              { cle: 'actions', titre: '', classe: 'sa-actions',
                rendu: (l) => boutonsLigne(l) }
            ],
            lignes: liste.donnees || [],
            vide: 'Aucune démonstration'
          })}
          ${ui.pagination(liste.pagination)}
        </section>`;

      /* ------------------------------------------------------ Liaisons */
      const majEtRendre = (p) => { SA.majParams(p); SA.rafraichirVue(); };

      const fs = document.getElementById('filtre-statut');
      if (fs) fs.addEventListener('change', () => majEtRendre({ statut: fs.value, page: 1 }));

      const fq = document.getElementById('filtre-q');
      if (fq) fq.addEventListener('input', SA.antiRebond(
        () => majEtRendre({ q: fq.value || undefined, page: 1 }), 380));

      conteneur.querySelectorAll('[data-page]').forEach((b) =>
        b.addEventListener('click', () => majEtRendre({ page: b.dataset.page })));

      const parId = {};
      (liste.donnees || []).forEach((l) => { parId[l.id] = l; });

      conteneur.querySelectorAll('[data-demo-action]').forEach((b) => {
        b.addEventListener('click', (evt) => {
          evt.stopPropagation();
          const l = parId[b.dataset.demoId];
          if (!l) return;
          switch (b.dataset.demoAction) {
            case 'suspendre':  return actionStatut(l, 'suspendre', 'Suspendre', true);
            case 'reactiver':  return actionStatut(l, 'reactiver', 'Réactiver', false);
            case 'terminer':   return actionStatut(l, 'terminer', 'Terminer', true);
            case 'prolonger':  return actionProlonger(l);
            case 'convertir':  return actionConvertir(l, offres);
            case 'offre':      return actionChangerOffre(l, offres);
          }
        });
      });
    }
  });

  /**
   * Les boutons dépendent du statut : proposer « Suspendre » sur une démo déjà
   * convertie afficherait une action que le serveur refuserait en 409. Un
   * bouton qui ne peut pas aboutir ne doit pas être offert.
   */
  function boutonsLigne(l) {
    const b = (action, libelle) =>
      `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
               data-demo-action="${action}" data-demo-id="${esc(l.id)}">${libelle}</button>`;

    const encours = ['active', 'a_verifier'].includes(l.statut);
    const out = [];

    if (encours) { out.push(b('suspendre', 'Suspendre')); out.push(b('offre', 'Offre')); }
    if (l.statut === 'suspendue' || l.statut === 'a_verifier') out.push(b('reactiver', 'Réactiver'));
    if (l.statut !== 'convertie') out.push(b('prolonger', 'Prolonger'));
    if (l.statut !== 'convertie') out.push(b('convertir', 'Convertir'));
    if (encours || l.statut === 'suspendue') out.push(b('terminer', 'Terminer'));

    return `<div class="sa-groupe-actions">${out.join('')}</div>`;
  }

  /* =========================================================================
     RÉGLAGES GLOBAUX
     -------------------------------------------------------------------------
     C'est ce qui rend l'offre de démonstration configurable sans déploiement.
     Prime aujourd'hui, Pilote demain, sans toucher au code.
     ========================================================================= */

  function modaleReglages(d) {
    const r = d.reglages || {};
    const options = (d.offres_disponibles || []).map((o) =>
      '<option value="' + esc(o.code) + '"' + (o.code === r.offre_code ? ' selected' : '')
      + '>' + esc(o.nom) + '</option>').join('');

    modaleSaisie({
      titre: "Réglages de l'essai gratuit",
      sousTitre: 'Ils prennent effet immédiatement, pour toute nouvelle démonstration.',
      libelleValider: 'Enregistrer',
      contenu: '<label class="sa-champ"><span>Offre servie pendant l\'essai</span>'
        + '<select id="reg-offre">' + options + '</select></label>'
        + '<p class="sa-muet">Les démonstrations déjà en cours conservent l\'offre qui leur a '
        + 'été attribuée.</p>'
        + '<label class="sa-champ"><span>Durée (jours)</span>'
        + '<input type="number" id="reg-duree" min="1" max="365" value="' + esc(r.duree_jours) + '" /></label>'
        + '<label class="sa-champ"><span>Avertir l\'école à (jours restants, séparés par des '
        + 'virgules)</span><input type="text" id="reg-preavis" value="'
        + esc((r.preavis_jours || []).join(', ')) + '" /></label>'
        + '<label class="sa-champ-inline"><input type="checkbox" id="reg-ouverte" '
        + (r.ouverte ? 'checked' : '') + ' /><span>Démonstrations en libre-service ouvertes</span></label>'
        + '<p class="sa-muet">Décoché, la page publique refuse les nouvelles demandes ; les '
        + 'essais en cours continuent normalement.</p>',
      valider: async () => {
        const preavis = String((document.getElementById('reg-preavis') || {}).value || '')
          .split(',').map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x > 0);
        try {
          await SA.api('/super-admin/demonstrations-reglages', {
            method: 'PATCH',
            body: JSON.stringify({
              offre_code: (document.getElementById('reg-offre') || {}).value,
              duree_jours: Number((document.getElementById('reg-duree') || {}).value),
              preavis_jours: preavis,
              ouverte: (document.getElementById('reg-ouverte') || {}).checked
            })
          });
          SA.toast('Réglages enregistrés.', 'succes');
          SA.rafraichirVue();
        } catch (err) {
          return err.message || 'Enregistrement impossible.';
        }
      }
    });
  }
})();
