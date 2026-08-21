/* ==========================================================================
   Ardoise — Types d'événements du calendrier
   --------------------------------------------------------------------------
   POURQUOI CE FICHIER EXISTE

   Le menu « Type » du calendrier proposait sept entrées, écrites en dur dans
   `calendrier.html`, et recopiées à l'identique dans trois tableaux de bord
   pour afficher les libellés. Une école ne pouvait pas inscrire la fin de son
   année scolaire, une réunion de parents, une échéance de frais, un examen
   d'État. Tout finissait sous « Réunion » — et les rappels partaient alors
   aux mauvaises personnes, sans la consigne qui les rend utiles.

   La liste de référence vit maintenant côté serveur
   (`utils/evenements-catalogue.js`) et se lit sur `GET /evenements/types` :
   c'est la même liste qui alimente le menu déroulant, le contrôle de saisie
   et le ciblage des rappels. Ajouter un type ne demande plus qu'une seule
   modification, au même endroit.

   POURQUOI UNE COPIE DE SECOURS FIGURE TOUT DE MÊME ICI

   Le service worker sert les pages hors ligne, et un serveur endormi met
   parfois plusieurs secondes à répondre. Sans repli, le menu « Type »
   s'afficherait VIDE : le formulaire deviendrait inutilisable alors que rien
   n'est cassé. `CATALOGUE_DE_SECOURS` est donc un miroir du catalogue serveur.
   S'il vieillit, la conséquence reste bénigne — quelques types récents
   manquent au menu tant que le serveur n'a pas répondu — mais il doit être
   tenu à jour avec `utils/evenements-catalogue.js`.
   ========================================================================== */
(function (global) {
  'use strict';

  /* Miroir de `utils/evenements-catalogue.js` (backend). Les libellés seuls :
     les rôles et les consignes règlent l'envoi des rappels, ils n'ont rien à
     faire dans un navigateur. */
  const CATALOGUE_DE_SECOURS = [
    { cle: 'annee', libelle: 'Année scolaire', types: [
      { cle: 'debut_cours',    libelle: 'Rentrée — début des cours' },
      { cle: 'debut_periode',  libelle: 'Début de période (trimestre / semestre)' },
      { cle: 'fin_periode',    libelle: 'Fin de période (trimestre / semestre)' },
      { cle: 'fin_annee',      libelle: "Fin de l'année scolaire" },
      { cle: 'cloture_annee',  libelle: "Clôture de l'année scolaire" }
    ] },
    { cle: 'evaluations', libelle: 'Évaluations et résultats', types: [
      { cle: 'evaluation',       libelle: 'Interrogation / évaluation' },
      { cle: 'examen',           libelle: "Session d'examens" },
      { cle: 'depot_sujets',     libelle: "Dépôt des sujets d'examen" },
      { cle: 'examen_etat',      libelle: "Examen d'État (Exétat)" },
      { cle: 'tenafep',          libelle: 'TENAFEP (fin du primaire)' },
      { cle: 'depot_resultats',  libelle: 'Dépôt des résultats' },
      { cle: 'conseil_classe',   libelle: 'Conseil de classe' },
      { cle: 'deliberation',     libelle: 'Délibération / jury' },
      { cle: 'repechage',        libelle: 'Session de repêchage' },
      { cle: 'proclamation',     libelle: 'Proclamation des résultats' },
      { cle: 'remise_bulletins', libelle: 'Remise des bulletins' }
    ] },
    { cle: 'vie_scolaire', libelle: 'Vie scolaire', types: [
      { cle: 'reunion',                libelle: 'Réunion' },
      { cle: 'reunion_parents',        libelle: 'Réunion des parents' },
      { cle: 'reunion_personnel',      libelle: 'Réunion du personnel' },
      { cle: 'journee_pedagogique',    libelle: 'Journée pédagogique' },
      { cle: 'formation',              libelle: 'Formation du personnel' },
      { cle: 'sortie_scolaire',        libelle: 'Sortie / excursion scolaire' },
      { cle: 'activite_parascolaire',  libelle: 'Activité parascolaire (club, atelier)' },
      { cle: 'competition',            libelle: 'Compétition sportive / concours' },
      { cle: 'ceremonie',              libelle: "Cérémonie / fête de l'école" },
      { cle: 'celebration_religieuse', libelle: 'Célébration religieuse' },
      { cle: 'inspection',             libelle: 'Inspection pédagogique' },
      { cle: 'visite_officielle',      libelle: 'Visite officielle' }
    ] },
    { cle: 'administratif', libelle: 'Administration et finances', types: [
      { cle: 'inscriptions',             libelle: 'Période des inscriptions' },
      { cle: 'reinscriptions',           libelle: 'Période des réinscriptions' },
      { cle: 'echeance_frais',           libelle: 'Échéance de paiement des frais' },
      { cle: 'echeance_administrative',  libelle: 'Échéance administrative' },
      { cle: 'photo_scolaire',           libelle: 'Photo scolaire' }
    ] },
    { cle: 'interruptions', libelle: 'Interruptions', types: [
      { cle: 'vacances', libelle: 'Vacances' }
    ] },
    { cle: 'divers', libelle: 'Divers', types: [
      { cle: 'autre', libelle: 'Autre' }
    ] }
  ];

  /* Catalogue courant : le repli, puis celui du serveur dès qu'il a répondu. */
  let catalogue = CATALOGUE_DE_SECOURS;

  /** Index { cle → { libelle, categorie } }, reconstruit à chaque chargement. */
  function indexer(cat) {
    const index = {};
    for (const groupe of cat) {
      for (const type of groupe.types) {
        index[type.cle] = { libelle: type.libelle, categorie: groupe.cle };
      }
    }
    return index;
  }
  let index = indexer(catalogue);

  /**
   * Libellé lisible d'un type.
   * Retombe sur la clé brute plutôt que sur du vide : un événement enregistré
   * avec un type que ce fichier ne connaît pas (encore) reste identifiable.
   */
  function libelle(type) {
    return (index[type] && index[type].libelle) || type || '';
  }

  /** Catégorie d'un type, pour la pastille de couleur. */
  function categorie(type) {
    return (index[type] && index[type].categorie) || 'divers';
  }

  /**
   * Charge le catalogue du serveur. `appelApi` est la fonction d'appel propre
   * à la page (elle porte le jeton et le renouvelle) : ce module ne fait aucun
   * `fetch` de son côté, il n'a donc rien à savoir de l'authentification.
   *
   * Ne rejette jamais : un catalogue indisponible laisse le repli en place, ce
   * qui est très exactement la raison de son existence.
   *
   * Résout à `true` si le catalogue a CHANGÉ. La page peut alors redessiner ce
   * qu'elle avait déjà affiché avec le repli — et ne rien redessiner du tout
   * dans le cas courant, où le repli est à jour : recharger deux fois le mois
   * et la liste à chaque ouverture serait deux requêtes pour un écran
   * strictement identique.
   */
  async function charger(appelApi) {
    let servi = null;
    try {
      const r = await appelApi('/evenements/types');
      if (!r || !r.ok) return false;
      const donnees = await r.json();
      if (!donnees || !Array.isArray(donnees.categories) || donnees.categories.length === 0) {
        return false;
      }
      servi = donnees.categories;
    } catch (e) {
      /* Réseau coupé, serveur endormi : on garde le repli, sans bruit. */
      return false;
    }

    const avant = JSON.stringify(catalogue);
    catalogue = servi;
    index = indexer(catalogue);
    return JSON.stringify(catalogue) !== avant;
  }

  /**
   * Remplit un `<select>` avec le catalogue, un `<optgroup>` par catégorie.
   * Trente types en liste plate ne se parcourent pas ; en six groupes, si.
   *
   * `valeurRetenue` permet de reconstruire le menu sans perdre le choix en
   * cours : la liste est remplacée quand la réponse du serveur arrive, ce qui
   * peut survenir pendant que le formulaire est déjà ouvert.
   */
  function remplirSelect(select, valeurRetenue) {
    if (!select) return;
    const choix = valeurRetenue || select.value;
    select.innerHTML = catalogue.map((groupe) => {
      const options = groupe.types.map((t) =>
        `<option value="${t.cle}">${echapper(t.libelle)}</option>`).join('');
      return `<optgroup label="${echapper(groupe.libelle)}">${options}</optgroup>`;
    }).join('');
    if (choix && index[choix]) select.value = choix;
  }

  function echapper(v) {
    const d = document.createElement('div');
    d.textContent = v == null ? '' : String(v);
    return d.innerHTML;
  }

  global.ArdoiseTypesEvenements = {
    CATALOGUE_DE_SECOURS,
    catalogue: () => catalogue,
    libelle,
    categorie,
    charger,
    remplirSelect
  };
})(window);
