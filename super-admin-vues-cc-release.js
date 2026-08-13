/* ==========================================================================
   ARDOISE CONTROL CENTER — RELEASE READINESS
   --------------------------------------------------------------------------
   Une seule question, posée à un commit :

       peut-on livrer ceci à des écoles réelles ?

   CE QUE CET ÉCRAN N'EST PAS
   --------------------------
   Ce n'est pas un second Control Center. Il ne mesure rien lui-même : il lit
   `/super-admin/control-center/release-readiness`, qui agrège les passages de
   CI déjà ingérés dans `audit_runs` et applique le moteur de verdict partagé
   (`utils/quality-gate.utils.js`). Le même moteur rend le verdict en ligne de
   commande et ici — il ne peut donc pas y avoir deux vérités.

   LA RÈGLE QUE CET ÉCRAN EXISTE POUR TENIR
   ----------------------------------------
       NON MESURÉ N'EST PAS VERT.

   C'est la règle qu'un tableau de bord viole le plus naturellement, parce
   qu'il est plus facile d'afficher « 0 anomalie » que « je n'ai pas pu
   regarder ». Une catégorie sans résultat est donc rendue avec sa propre
   couleur, listée nommément dans un encart dédié, et comptée dans le résumé.
   Elle n'est jamais omise, et elle n'est jamais verte.

   De même, le nombre affiché est celui des tests RÉELLEMENT EXÉCUTÉS. Une
   suite qui rapporte zéro test n'a pas réussi : elle n'a rien fait.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui } = SA;

  /* Verdicts. Les trois seuls états possibles, et leur traduction visuelle. */
  const TONS_VERDICT = { READY: 'succes', WARNING: 'attention', BLOCKED: 'danger' };

  const LIBELLES_VERDICT = {
    READY:   'Livrable',
    WARNING: 'Livrable sous réserve',
    BLOCKED: 'Non livrable'
  };

  /* Statuts de catégorie. `non_mesure` a délibérément son propre ton, distinct
     de « réussi » ET de « échoué » : c'est un troisième état, pas une nuance
     de l'un des deux. */
  const TONS_STATUT = {
    reussi: 'succes',
    echec: 'danger',
    echec_technique: 'danger',
    non_mesure: 'neutre',
    avertissement: 'attention'
  };

  const LIBELLES_STATUT = {
    reussi: 'réussi',
    echec: 'échec',
    echec_technique: 'échec technique',
    non_mesure: 'NON MESURÉ',
    avertissement: 'réserve'
  };

  function badgeStatut(statut) {
    return ui.badge(LIBELLES_STATUT[statut] || statut, TONS_STATUT[statut] || 'neutre');
  }

  /** Abrège un SHA sans le rendre méconnaissable. */
  function sha(valeur) {
    if (!valeur) return '<span class="sa-muet">non fourni</span>';
    return `<span class="sa-mono">${esc(String(valeur).slice(0, 12))}</span>`;
  }

  function dateOuJamais(valeur) {
    if (!valeur) return '<span class="sa-muet">jamais</span>';
    return esc(fmt.dateHeure ? fmt.dateHeure(valeur) : String(valeur));
  }

  SA.enregistrerVue('cc/release', {
    titre: 'Release Readiness',
    sousTitre: 'Peut-on livrer ce commit à des écoles réelles ?',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(8);

      const d = await SA.api('/super-admin/control-center/release-readiness');

      const verdict = d.verdict || 'BLOCKED';
      const tests = d.tests || {};
      const categories = Object.values(d.categories || {});
      const nonMesurees = d.non_mesurees || [];
      const blocages = d.blocages_durs || [];
      const avertissements = d.avertissements || [];

      /* ------------------------------------------------------------------
         BANDEAU DE VERDICT
         Le verdict d'abord, la justification ensuite. Quelqu'un qui vient
         décider d'une livraison doit pouvoir repartir après trois secondes
         de lecture s'il est BLOCKED.
         ------------------------------------------------------------------ */
      const bandeau = `
        <div class="cc-encart-${verdict === 'BLOCKED' ? 'danger' : verdict === 'READY' ? 'fait' : 'hypothese'}"
             style="margin-bottom:20px">
          <div style="font-size:22px;font-weight:700;margin-bottom:6px">
            ${esc(verdict)} — ${esc(LIBELLES_VERDICT[verdict] || '')}
          </div>
          <div>${esc(d.resume_lisible || '')}</div>
        </div>`;

      /* ------------------------------------------------------------------
         IDENTITÉ DE LA MESURE
         Un verdict sans commit ne veut rien dire : il faut savoir CE QUI a
         été mesuré, et quand.
         ------------------------------------------------------------------ */
      const identite = `
        <div class="sa-grille-stats" style="margin-bottom:20px">
          ${ui.carteStat({ valeur: sha(d.commits && d.commits.backend), etiquette: 'Commit backend' })}
          ${ui.carteStat({ valeur: sha(d.commits && d.commits.frontend), etiquette: 'Commit frontend' })}
          ${ui.carteStat({ valeur: esc(d.environnement || 'inconnu'), etiquette: 'Environnement' })}
          ${ui.carteStat({ valeur: dateOuJamais(d.genere_a), etiquette: 'Verdict rendu le' })}
        </div>

        <div class="sa-grille-stats" style="margin-bottom:20px">
          ${ui.carteStat({
            valeur: fmt.nombre(tests.executes || 0),
            etiquette: 'Tests réellement exécutés',
            detail: 'un test non exécuté n\'est pas un test réussi'
          })}
          ${ui.carteStat({ valeur: fmt.nombre(tests.reussis || 0), etiquette: 'Réussis', ton: 'succes' })}
          ${ui.carteStat({
            valeur: fmt.nombre(tests.echoues || 0), etiquette: 'Échoués',
            ton: (tests.echoues || 0) > 0 ? 'danger' : undefined
          })}
          ${ui.carteStat({
            valeur: fmt.nombre(tests.ignores || 0), etiquette: 'Ignorés',
            ton: (tests.ignores || 0) > 0 ? 'attention' : undefined,
            detail: 'non exécutés, donc non prouvés'
          })}
        </div>`;

      /* ------------------------------------------------------------------
         BLOCAGES DURS
         Aucun score ne les neutralise : ils passent donc AVANT le détail.
         ------------------------------------------------------------------ */
      const blocBlocages = blocages.length ? `
        <section class="sa-section">
          <h2 class="sa-section-titre">Blocages durs</h2>
          <div class="cc-encart-danger">
            <strong>Aucun score ne neutralise un blocage dur.</strong>
            Un 99/100 accompagné d'une fuite entre deux écoles reste non livrable.
          </div>
          ${ui.tableau({
            colonnes: [
              { cle: 'gravite', titre: 'Gravité',
                rendu: (l) => ui.badge(l.gravite || 'critique', 'danger') },
              { cle: 'code', titre: 'Blocage' },
              { cle: 'message', titre: 'Constat' }
            ],
            lignes: blocages, vide: ''
          })}
        </section>` : '';

      /* ------------------------------------------------------------------
         NON MESURÉ — l'encart le plus important de l'écran
         ------------------------------------------------------------------ */
      const blocNonMesure = nonMesurees.length ? `
        <section class="sa-section">
          <h2 class="sa-section-titre">Non mesuré</h2>
          <div class="cc-encart-hypothese">
            <strong>${nonMesurees.length} source(s) n'ont produit aucun résultat.</strong><br>
            Ni réussies, ni échouées : inconnues. Elles sont listées ici plutôt
            qu'omises, parce qu'une absence silencieuse se lit comme
            « rien à signaler » — ce qu'elle n'est pas.
            <div style="margin-top:10px">
              ${nonMesurees.map((n) => `<code class="sa-mono">${esc(n)}</code>`).join(' · ')}
            </div>
          </div>
        </section>` : '';

      /* ------------------------------------------------------------------
         DÉTAIL PAR CATÉGORIE
         ------------------------------------------------------------------ */
      const blocCategories = `
        <section class="sa-section">
          <h2 class="sa-section-titre">Détail des mesures</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'statut', titre: 'État', rendu: (l) => badgeStatut(l.statut) },
              { cle: 'libelle', titre: 'Mesure' },
              { cle: 'obligatoire', titre: 'Obligatoire',
                rendu: (l) => l.obligatoire ? ui.badge('oui', 'info') : '<span class="sa-muet">—</span>' },
              { cle: 'message', titre: 'Ce qui a été constaté' },
              { cle: 'source', titre: 'Source', classe: 'sa-mono',
                rendu: (l) => l.source
                  ? esc(l.source)
                  : '<span class="sa-muet">aucune</span>' }
            ],
            lignes: categories, vide: 'Aucune catégorie évaluée.'
          })}
          <div class="cc-source">
            ${esc((d.sources && d.sources.note) || '')}
          </div>
        </section>`;

      /* ------------------------------------------------------------------
         RÉSERVES
         ------------------------------------------------------------------ */
      const blocAvertissements = avertissements.length ? `
        <section class="sa-section">
          <h2 class="sa-section-titre">Réserves</h2>
          ${ui.tableau({
            colonnes: [{ cle: 'message', titre: 'Réserve' }],
            lignes: avertissements, vide: ''
          })}
        </section>` : '';

      /* ------------------------------------------------------------------
         DERNIERS PASSAGES DE CI
         Répond à « d'où sort ce chiffre ? » sans lire le code.
         ------------------------------------------------------------------ */
      const blocPassages = `
        <section class="sa-section">
          <h2 class="sa-section-titre">Derniers passages de CI</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'type_audit', titre: 'Type', classe: 'sa-mono' },
              { cle: 'statut', titre: 'Statut', rendu: (l) => badgeStatut(l.statut) },
              { cle: 'commit_sha', titre: 'Commit', rendu: (l) => sha(l.commit_sha) },
              { cle: 'depot', titre: 'Dépôt' },
              { cle: 'branche', titre: 'Branche' },
              { cle: 'nb_anomalies', titre: 'Anomalies' },
              { cle: 'demarre_at', titre: 'Le', rendu: (l) => dateOuJamais(l.demarre_at) }
            ],
            lignes: d.derniers_passages || [],
            vide: 'Aucun passage de CI ingéré. Toutes les catégories valent donc NON MESURÉ.'
          })}
        </section>`;

      /* ------------------------------------------------------------------
         HISTORIQUE
         Un verdict isolé ne dit pas si la situation s'améliore.
         ------------------------------------------------------------------ */
      const blocHistorique = `
        <section class="sa-section">
          <h2 class="sa-section-titre">Dix dernières releases</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'commit_sha', titre: 'Commit', rendu: (l) => sha(l.commit_sha) },
              { cle: 'statut', titre: 'Verdict', rendu: (l) => badgeStatut(l.statut) },
              { cle: 'message', titre: 'Résumé' },
              { cle: 'demarre_at', titre: 'Le', rendu: (l) => dateOuJamais(l.demarre_at) }
            ],
            lignes: d.historique_releases || [],
            vide: 'Aucune release évaluée pour l\'instant.'
          })}
        </section>`;

      conteneur.innerHTML = bandeau + identite + blocBlocages + blocNonMesure
        + blocCategories + blocAvertissements + blocPassages + blocHistorique;
    }
  });
})();
