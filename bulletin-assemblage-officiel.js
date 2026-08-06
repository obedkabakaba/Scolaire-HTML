const { grouperParMaximum, bareme } = require('./bulletin-secondaire-rdc.template');
const { baremePrimaire } = require('./bulletin-primaire-rdc.template');

const CURRENT_ECOLE = "NULLIF(current_setting('app.current_ecole_id', true), '')::uuid";

/**
 * Ce module transforme les notes brutes de la base en la grille complète
 * attendue par les gabarits officiels (utils/bulletin-secondaire-rdc.template.js
 * et utils/bulletin-primaire-rdc.template.js) — p1, p2, examen, totaux courants,
 * rangs par colonne, appréciations.
 *
 * RÈGLE DE NULLITÉ, appliquée partout ici : une colonne dont AUCUNE composante
 * n'a encore été saisie reste `null` (case vide à l'impression) ; dès qu'AU
 * MOINS une composante existe, le total se calcule en traitant les composantes
 * manquantes comme 0. Sans cette règle, imprimer un bulletin en cours de
 * semestre — avant que l'examen ne soit passé — afficherait un total à 0 là où
 * il doit rester vide, ce qui se lirait comme "cet élève a eu zéro à l'examen"
 * plutôt que "l'examen n'a pas encore eu lieu".
 *
 * RÈGLE DE CLASSEMENT : chaque colonne (P1, P2, examen, total de semestre,
 * total général...) porte SON propre rang — c'est ainsi que le modèle officiel
 * l'imprime (une ligne "PLACE / NBRE D'ÉLÈVES" par colonne, pas une seule ligne
 * de classement général). Le rang se calcule ici à partir des totaux déjà
 * assemblés, indépendamment de tout classement stocké ailleurs — notamment
 * indépendamment de bulletins.classement calculé par recalculerBulletinSemestre,
 * qui utilise une moyenne de pourcentages (AVG) plutôt qu'un total de points sur
 * un total de maxima. Recalculer ici évite de propager cet écart de méthode
 * dans un document officiel de fin de semestre.
 */

/** Somme "null-safe" : null si tout est absent, sinon somme des valeurs présentes. */
function sommeSiPresent(...valeurs) {
  const presentes = valeurs.filter((v) => v !== null && v !== undefined);
  if (presentes.length === 0) return null;
  return presentes.reduce((total, v) => total + Number(v), 0);
}

/**
 * Classe les élèves d'une classe sur une colonne donnée, et écrit le rang dans
 * `eleve.places[colonne]`, au format "rang/effectif" tel qu'imprimé sur le
 * modèle officiel. Les élèves sans valeur sur cette colonne (case encore
 * vide) ne sont pas classés : ils n'ont simplement rien à cette place.
 *
 * Tie-break identique à recalculerClassement (nom, postnom, prénom) : la même
 * convention partout dans l'application évite qu'une égalité de points classe
 * différemment un élève selon l'écran consulté.
 */
function classerParColonne(eleves, cle, lireValeur, options = {}) {
  // `avecEffectif` : le secondaire imprime « 3/28 » dans une seule case, le
  // primaire sépare la place et l'effectif sur deux lignes du modèle officiel.
  // Le même calcul de rang sert les deux, seule la mise en forme change.
  const avecEffectif = options.avecEffectif !== false;
  const effectif = eleves.length;
  const classables = eleves
    .filter((e) => lireValeur(e) !== null && lireValeur(e) !== undefined)
    .sort((a, b) =>
      Number(lireValeur(b)) - Number(lireValeur(a))
      || a.nom.localeCompare(b.nom, 'fr')
      || (a.postnom || '').localeCompare(b.postnom || '', 'fr'));

  classables.forEach((e, i) => {
    e.places[cle] = avecEffectif ? `${i + 1}/${effectif}` : String(i + 1);
  });
}

/* ==========================================================================
   SECONDAIRE (ordinaire et terminale — même grille, seul le bloc de droite
   du gabarit diffère selon la variante)
   ========================================================================== */

/**
 * Retrouve les deux arbres de semestre (numero 1 et 2) d'une classe de
 * secondaire pour une année donnée, avec leurs trois enfants chacun : deux
 * périodes (P1/P2 ou P3/P4) et un examen. Une classe qui n'a que le premier
 * semestre de créé (année en cours) reçoit `semestre2: null` — le gabarit
 * imprime alors les colonnes du second semestre vides, ce qui est le
 * comportement correct en cours d'année.
 */
async function trouverArbreSemestres(client, { anneeScolaireId }) {
  const semestres = await client.query(
    `SELECT id, numero FROM periodes
      WHERE annee_scolaire_id = $1 AND ecole_id = ${CURRENT_ECOLE}
        AND type = 'semestre' AND (cycle IS NULL OR cycle = 'secondaire')
      ORDER BY numero`,
    [anneeScolaireId]
  );

  const arbre = { semestre1: null, semestre2: null };
  for (const s of semestres.rows) {
    const enfants = await client.query(
      `SELECT id, type, numero FROM periodes WHERE semestre_id = $1 ORDER BY numero`,
      [s.id]
    );
    // Les deux périodes de travail journalier se distinguent de l'examen par
    // leur type, pas par leur position : on ne suppose jamais que "le premier
    // enfant trouvé" est P1 si l'école les a créés dans un ordre différent.
    const periodes = enfants.rows.filter((e) => e.type === 'periode').sort((a, b) => a.numero - b.numero);
    const examen = enfants.rows.find((e) => e.type === 'examen') || null;
    const cible = s.numero === 1 ? 'semestre1' : 'semestre2';
    arbre[cible] = { id: s.id, p1: periodes[0] || null, p2: periodes[1] || null, examen };
  }
  return arbre;
}

/**
 * Assemble la grille complète (cotes + synthèse) d'une classe de secondaire,
 * pour tous ses cours et tous ses élèves actifs, sur les deux semestres de
 * l'année.
 */
async function assemblerDonneesSecondaire(client, { classeId, anneeScolaireId }) {
  const coursResult = await client.query(
    `SELECT cc.id AS classe_cours_id, c.id, c.nom,
            COALESCE(cc.maximum_points_override, c.maximum_points) AS maximum,
            COALESCE(cc.maximum_examen_override, c.maximum_examen) AS maximum_examen
       FROM classe_cours cc
       JOIN cours c ON c.id = cc.cours_id
      WHERE cc.classe_id = $1
      ORDER BY c.nom`,
    [classeId]
  );
  const cours = coursResult.rows;

  const elevesResult = await client.query(
    `SELECT id, nom, postnom, prenom, sexe, matricule,
            to_char(date_naissance, 'DD/MM/YYYY') AS date_naissance
       FROM eleves WHERE classe_id = $1 AND statut = 'actif'
      ORDER BY nom, postnom`,
    [classeId]
  );
  const eleves = elevesResult.rows.map((e) => ({
    ...e, cotes: {}, totaux: {}, pourcentages: {}, places: {},
    applications: {}, conduites: {}
  }));
  if (eleves.length === 0 || cours.length === 0) return { cours, eleves };

  const arbre = await trouverArbreSemestres(client, { anneeScolaireId });

  /** Notes brutes d'un classe_cours pour une période donnée, indexées par élève. */
  async function notesDe(periode) {
    if (!periode) return new Map();
    const r = await client.query(
      `SELECT n.eleve_id, n.classe_cours_id, n.points_obtenus
         FROM notes n WHERE n.periode_id = $1 AND n.classe_cours_id = ANY($2::uuid[])`,
      [periode.id, cours.map((c) => c.classe_cours_id)]
    );
    const parEleveEtCours = new Map();
    for (const ligne of r.rows) {
      parEleveEtCours.set(`${ligne.eleve_id}|${ligne.classe_cours_id}`, ligne.points_obtenus);
    }
    return parEleveEtCours;
  }

  /** Appréciation (conduite/application) portée par le bulletin d'une période. */
  async function appreciationsDe(periode) {
    if (!periode) return new Map();
    const r = await client.query(
      `SELECT eleve_id, application, conduite FROM bulletins WHERE periode_id = $1`,
      [periode.id]
    );
    const m = new Map();
    for (const ligne of r.rows) m.set(ligne.eleve_id, ligne);
    return m;
  }

  for (const cle of ['semestre1', 'semestre2']) {
    const s = arbre[cle];
    const numP1 = cle === 'semestre1' ? 'p1' : 'p3';
    const numP2 = cle === 'semestre1' ? 'p2' : 'p4';
    const numEx = cle === 'semestre1' ? 'ex' : 'ex2';
    const numTot = cle === 'semestre1' ? 'tot1' : 'tot2';

    const notesP1 = await notesDe(s?.p1);
    const notesP2 = await notesDe(s?.p2);
    const notesEx = await notesDe(s?.examen);
    const appreciations = await appreciationsDe(s?.p1); // conduite/application saisies sur la 1ère période du semestre

    for (const eleve of eleves) {
      for (const c of cours) {
        const clef = `${eleve.id}|${c.classe_cours_id}`;
        const p1 = notesP1.get(clef) ?? null;
        const p2 = notesP2.get(clef) ?? null;
        const ex = notesEx.get(clef) ?? null;

        if (!eleve.cotes[c.id]) eleve.cotes[c.id] = {};
        eleve.cotes[c.id][numP1] = p1;
        eleve.cotes[c.id][numP2] = p2;
        eleve.cotes[c.id][numEx] = ex;
        eleve.cotes[c.id][numTot] = sommeSiPresent(p1, p2, ex);
      }

      const app = appreciations.get(eleve.id);
      eleve.applications[numP1] = app?.application ?? null;
      eleve.applications[numP2] = null; // renseignée séparément si la 2ᵉ période a son propre bulletin
      eleve.conduites[numP1] = app?.conduite ?? null;
      eleve.conduites[numP2] = null;
    }

    // La 2ᵉ période du semestre porte sa propre appréciation (bulletin distinct).
    const appreciationsP2 = await appreciationsDe(s?.p2);
    for (const eleve of eleves) {
      const app = appreciationsP2.get(eleve.id);
      eleve.applications[numP2] = app?.application ?? eleve.applications[numP2];
      eleve.conduites[numP2] = app?.conduite ?? eleve.conduites[numP2];
    }
  }

  // ---------- T.G. par cours, puis synthèse par élève ----------
  for (const eleve of eleves) {
    for (const c of cours) {
      const cc = eleve.cotes[c.id];
      cc.tg = sommeSiPresent(cc.tot1, cc.tot2);
    }

    const colonnes = ['p1', 'p2', 'ex', 'tot1', 'p3', 'p4', 'ex2', 'tot2', 'tg'];
    for (const col of colonnes) {
      eleve.totaux[col] = sommeSiPresent(...cours.map((c) => eleve.cotes[c.id][col]));
    }
  }

  // ---------- Maxima généraux (mêmes groupes que ceux affichés par le gabarit) ----------
  const groupes = grouperParMaximum(cours.map((c) => ({ ...c, maximum: c.maximum })));
  const maximaGeneraux = groupes.reduce((acc, g) => {
    const b = bareme(g.maximum, g.maximumExamen);
    const n = g.cours.length;
    acc.p1 += b.periode * n; acc.p2 += b.periode * n; acc.ex += (b.examen || 0) * n; acc.tot1 += b.semestre * n;
    acc.p3 += b.periode * n; acc.p4 += b.periode * n; acc.ex2 += (b.examen || 0) * n; acc.tot2 += b.semestre * n;
    acc.tg += b.general * n;
    return acc;
  }, { p1: 0, p2: 0, ex: 0, tot1: 0, p3: 0, p4: 0, ex2: 0, tot2: 0, tg: 0 });

  for (const eleve of eleves) {
    for (const col of Object.keys(maximaGeneraux)) {
      const total = eleve.totaux[col];
      eleve.pourcentages[col] = total === null || !maximaGeneraux[col]
        ? null
        : Math.round((total / maximaGeneraux[col]) * 10000) / 100;
    }
  }

  // ---------- Classement, colonne par colonne ----------
  for (const col of ['p1', 'p2', 'ex', 'tot1', 'p3', 'p4', 'ex2', 'tot2', 'tg']) {
    classerParColonne(eleves, col, (e) => e.totaux[col]);
  }

  return { cours, eleves };
}

/* ==========================================================================
   PRIMAIRE (trimestres, domaines et groupes)
   ========================================================================== */

/**
 * Retrouve les trois arbres de trimestre (numero 1, 2, 3) d'une classe de
 * primaire pour une année donnée, chacun avec ses trois enfants (deux
 * périodes + un examen) — même mécanique que les semestres du secondaire,
 * `semestre_id` servant de lien générique vers n'importe quel type de parent.
 */
async function trouverArbreTrimestres(client, { anneeScolaireId }) {
  const trimestres = await client.query(
    `SELECT id, numero FROM periodes
      WHERE annee_scolaire_id = $1 AND ecole_id = ${CURRENT_ECOLE}
        AND type = 'trimestre' AND (cycle IS NULL OR cycle = 'primaire')
      ORDER BY numero`,
    [anneeScolaireId]
  );

  const arbre = { trimestre1: null, trimestre2: null, trimestre3: null };
  for (const t of trimestres.rows) {
    const enfants = await client.query(
      `SELECT id, type, numero FROM periodes WHERE semestre_id = $1 ORDER BY numero`,
      [t.id]
    );
    const periodes = enfants.rows.filter((e) => e.type === 'periode').sort((a, b) => a.numero - b.numero);
    const examen = enfants.rows.find((e) => e.type === 'examen') || null;
    const cible = ['trimestre1', 'trimestre2', 'trimestre3'][t.numero - 1];
    if (cible) arbre[cible] = { id: t.id, p1: periodes[0] || null, p2: periodes[1] || null, examen };
  }
  return arbre;
}

/**
 * Regroupe les cours d'une classe de primaire par domaine puis par groupe,
 * dans l'ordre officiel (LANGUES, MATHÉMATIQUES/SCIENCES/TECHNOLOGIE, UNIVERS
 * SOCIAL, ARTS, DÉVELOPPEMENT PERSONNEL), et rejette explicitement tout cours
 * sans domaine renseigné plutôt que de le placer au hasard.
 *
 * L'ordre est fixé ici, pas alphabétique : c'est celui du modèle officiel, et
 * il ne doit pas changer selon l'ordre de création des cours par l'école.
 */
const ORDRE_DOMAINES = [
  'DOMAINE DES LANGUES',
  'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',
  "DOMAINE DE L'UNIVERS SOCIAL ET ENVIRONNEMENT",
  'DOMAINE DES ARTS',
  'DOMAINE DU DÉVELOPPEMENT PERSONNEL',
];

function grouperParDomaine(cours) {
  const sansDomaine = cours.filter((c) => !c.domaine);
  const parDomaine = new Map();

  for (const c of cours) {
    if (!c.domaine) continue;
    if (!parDomaine.has(c.domaine)) parDomaine.set(c.domaine, new Map());
    const parGroupe = parDomaine.get(c.domaine);
    const cle = c.groupe_domaine || '__sans_groupe__';
    if (!parGroupe.has(cle)) parGroupe.set(cle, []);
    parGroupe.get(cle).push(c);
  }

  const domaines = [];
  const domainesConnus = new Set(parDomaine.keys());
  const ordre = [...ORDRE_DOMAINES.filter((d) => domainesConnus.has(d)),
                  ...[...domainesConnus].filter((d) => !ORDRE_DOMAINES.includes(d)).sort()];

  for (const nomDomaine of ordre) {
    const parGroupe = parDomaine.get(nomDomaine);
    const groupesNommes = [...parGroupe.entries()].filter(([cle]) => cle !== '__sans_groupe__');
    const sansGroupe = parGroupe.get('__sans_groupe__') || [];

    if (groupesNommes.length > 0) {
      domaines.push({
        nom: nomDomaine,
        groupes: groupesNommes.map(([nom, liste]) => ({ nom, cours: liste }))
          .concat(sansGroupe.length ? [{ nom: null, cours: sansGroupe }] : [])
      });
    } else {
      domaines.push({ nom: nomDomaine, cours: sansGroupe });
    }
  }

  return { domaines, sansDomaine };
}

/**
 * Colonnes de POINTS du modèle primaire (les colonnes de maximum en sont
 * exclues : elles sont noircies sur les lignes de synthèse).
 */
const COLONNES_POINTS_PRIMAIRE = [
  'p1', 'p2', 'ex1', 't1',
  'p3', 'p4', 'ex2', 't2',
  'p5', 'p6', 'ex3', 't3',
  'total'
];

/** Appréciations (application / conduite) portées par le bulletin d'une période. */
async function appreciationsPrimaireDe(client, periode) {
  if (!periode) return new Map();
  const r = await client.query(
    `SELECT eleve_id, application, conduite FROM bulletins WHERE periode_id = $1`,
    [periode.id]
  );
  const m = new Map();
  for (const ligne of r.rows) m.set(ligne.eleve_id, ligne);
  return m;
}

async function assemblerDonneesPrimaire(client, { classeId, anneeScolaireId }) {
  const coursResult = await client.query(
    `SELECT cc.id AS classe_cours_id, c.id, c.nom, c.domaine, c.groupe_domaine,
            COALESCE(cc.maximum_points_override, c.maximum_points) AS maximum
       FROM classe_cours cc
       JOIN cours c ON c.id = cc.cours_id
      WHERE cc.classe_id = $1
      ORDER BY c.nom`,
    [classeId]
  );
  const cours = coursResult.rows;
  const { domaines, sansDomaine } = grouperParDomaine(cours);

  const elevesResult = await client.query(
    `SELECT id, nom, postnom, prenom, sexe, matricule,
            to_char(date_naissance, 'DD/MM/YYYY') AS date_naissance
       FROM eleves WHERE classe_id = $1 AND statut = 'actif'
      ORDER BY nom, postnom`,
    [classeId]
  );
  const eleves = elevesResult.rows.map((e) => ({
    ...e, cotes: {}, totaux: {}, pourcentages: {}, places: {}, effectifs: {},
    applications: {}, conduites: {}
  }));
  if (eleves.length === 0 || cours.length === 0) return { domaines, eleves, sansDomaine };

  const arbre = await trouverArbreTrimestres(client, { anneeScolaireId });

  async function notesDe(periode) {
    if (!periode) return new Map();
    const r = await client.query(
      `SELECT n.eleve_id, n.classe_cours_id, n.points_obtenus
         FROM notes n WHERE n.periode_id = $1 AND n.classe_cours_id = ANY($2::uuid[])`,
      [periode.id, cours.map((c) => c.classe_cours_id)]
    );
    const m = new Map();
    for (const ligne of r.rows) m.set(`${ligne.eleve_id}|${ligne.classe_cours_id}`, ligne.points_obtenus);
    return m;
  }

  const suffixes = ['trimestre1', 'trimestre2', 'trimestre3'];
  for (let i = 0; i < suffixes.length; i++) {
    const t = arbre[suffixes[i]];
    const nP1 = ['p1', 'p3', 'p5'][i], nP2 = ['p2', 'p4', 'p6'][i];
    const nEx = ['ex1', 'ex2', 'ex3'][i], nTot = ['t1', 't2', 't3'][i];

    const notesP1 = await notesDe(t?.p1);
    const notesP2 = await notesDe(t?.p2);
    const notesEx = await notesDe(t?.examen);

    for (const eleve of eleves) {
      for (const c of cours) {
        const clef = `${eleve.id}|${c.classe_cours_id}`;
        const p1 = notesP1.get(clef) ?? null;
        const p2 = notesP2.get(clef) ?? null;
        const ex = notesEx.get(clef) ?? null;

        if (!eleve.cotes[c.id]) eleve.cotes[c.id] = {};
        eleve.cotes[c.id][nP1] = p1;
        eleve.cotes[c.id][nP2] = p2;
        eleve.cotes[c.id][nEx] = ex;
        eleve.cotes[c.id][nTot] = sommeSiPresent(p1, p2, ex);
      }
    }

    // Application et conduite : une appréciation par période de travail, prise
    // sur le bulletin de cette période. Ce sont des lettres, elles ne se
    // cumulent ni ne se moyennent — on les reporte telles quelles.
    const apprP1 = await appreciationsPrimaireDe(client, t?.p1);
    const apprP2 = await appreciationsPrimaireDe(client, t?.p2);
    for (const eleve of eleves) {
      eleve.applications[nP1] = apprP1.get(eleve.id)?.application ?? null;
      eleve.applications[nP2] = apprP2.get(eleve.id)?.application ?? null;
      eleve.conduites[nP1] = apprP1.get(eleve.id)?.conduite ?? null;
      eleve.conduites[nP2] = apprP2.get(eleve.id)?.conduite ?? null;
    }
  }

  for (const eleve of eleves) {
    for (const c of cours) {
      const cc = eleve.cotes[c.id];
      cc.total = sommeSiPresent(cc.t1, cc.t2, cc.t3);
    }
  }

  /* ------------------------------------------------------------------------
     SYNTHÈSE DU BAS DE TABLEAU — pourcentage, place, effectif.

     Ces trois lignes s'imprimaient VIDES : le gabarit primaire lit
     `eleve.pourcentages`, `eleve.places` et `eleve.effectifs`, qu'aucun code ne
     remplissait. Le bulletin annuel du primaire sortait donc avec ses cotes et
     ses totaux justes, mais sans aucun pourcentage ni aucun classement — sur
     un document de fin d'année, c'est l'information que le parent lit en
     premier. L'équivalent secondaire, lui, les calculait déjà.

     Une ligne par colonne de points, comme sur le modèle officiel : chaque
     période, chaque examen, chaque trimestre et le total ont leur propre
     pourcentage et leur propre place.
     ------------------------------------------------------------------------ */
  const maximaParColonne = cours.reduce((acc, c) => {
    const b = baremePrimaire(c.maximum);
    for (const k of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) acc[k] += b.periode;
    for (const k of ['ex1', 'ex2', 'ex3']) acc[k] += b.examen;
    for (const k of ['t1', 't2', 't3']) acc[k] += b.trimestre;
    acc.total += b.total;
    return acc;
  }, {
    p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0,
    ex1: 0, ex2: 0, ex3: 0, t1: 0, t2: 0, t3: 0, total: 0
  });

  const effectif = eleves.length;

  for (const eleve of eleves) {
    for (const col of COLONNES_POINTS_PRIMAIRE) {
      eleve.totaux[col] = sommeSiPresent(...cours.map((c) => eleve.cotes[c.id][col]));
      const total = eleve.totaux[col];
      eleve.pourcentages[col] = (total === null || !maximaParColonne[col])
        ? null
        : Math.round((total / maximaParColonne[col]) * 10000) / 100;
      // Le modèle primaire sépare la place et l'effectif sur DEUX lignes
      // (« PLACE » puis « NBRE D'ÉLÈVES »), là où le secondaire les réunit en
      // « 3/28 » sur une seule. On remplit donc les deux.
      eleve.effectifs[col] = total === null ? null : effectif;
    }
  }

  for (const col of COLONNES_POINTS_PRIMAIRE) {
    classerParColonne(eleves, col, (e) => e.totaux[col], { avecEffectif: false });
  }

  return { domaines, eleves, sansDomaine, maxima: maximaParColonne, effectif };
}

module.exports = {
  assemblerDonneesSecondaire,
  assemblerDonneesPrimaire,
  sommeSiPresent,
  classerParColonne,
  // Exporté pour que les bulletins de période et d'examen rangent leurs
  // branches comme le bulletin annuel, au lieu de chacun sa présentation.
  grouperParDomaine,
};


/* ==========================================================================
   BULLETIN D'UN REGROUPEMENT — semestre OU trimestre, grille par cours
   ========================================================================== */

/**
 * Assemble la grille d'un REGROUPEMENT de périodes, cours par cours.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI CETTE FONCTION N'EST PLUS « assemblerDonneesSemestre »
 *
 * Elle supposait qu'un regroupement contienne exactement deux périodes de
 * travail et un examen, et nommait ses colonnes p1 / p2 / ex en dur. Cela
 * décrit un semestre du secondaire, et rien d'autre. Or la même mécanique
 * s'applique mot pour mot à un TRIMESTRE du primaire (deux périodes + un
 * examen), qui n'était de ce fait imprimable nulle part : la page Bulletins
 * n'aiguillait que le type « semestre » vers l'agrégation, et un trimestre
 * partait vers la route des périodes ordinaires, où l'on cherchait des notes
 * saisies directement sur le trimestre — il n'y en a jamais. Le bulletin
 * sortait avec toutes ses cotes vides.
 *
 * Les colonnes sont donc DÉDUITES des enfants du regroupement, et non écrites
 * d'avance. Trois formes en découlent, sans code particulier pour aucune :
 *
 *   semestre du secondaire → 1ʳᵉ P. | 2ᵉ P. | Exam. | Total
 *   trimestre du primaire  → 1ʳᵉ P. | 2ᵉ P. | Exam. | Total
 *
 * Les deux cycles ont le même découpage interne — deux périodes de travail et
 * un examen — et ne diffèrent que par le nombre de regroupements dans l'année :
 * deux semestres au secondaire, trois trimestres au primaire. C'est exactement
 * ce que montre le bulletin officiel du degré élémentaire, dont les colonnes
 * vont de PREMIER TRIMESTRE à TROISIÈME TRIMESTRE puis TOTAL.
 *
 * La descente jusqu'aux périodes qui portent les notes est néanmoins récursive :
 * elle ne coûte rien et évite d'avoir à réécrire cette fonction si une école
 * intercale un jour un niveau supplémentaire.
 *
 * ---------------------------------------------------------------------------
 * GROUPES DE MAXIMA
 *
 * Le modèle imprime une colonne « Max » partagée par les colonnes de même
 * barème (les deux périodes partagent le leur, l'examen a le sien). On calcule
 * donc des groupes de colonnes consécutives dont le maximum est identique pour
 * TOUS les cours. Ce regroupement se déduit des données au lieu d'être posé
 * d'avance, ce qui le rend juste aussi bien pour trois colonnes de trimestres
 * que pour deux périodes et un examen.
 *
 * ---------------------------------------------------------------------------
 * Le pourcentage se calcule en total obtenu sur total des maxima — et non en
 * moyenne des pourcentages de période comme le fait `recalculerBulletinSemestre`.
 * Les deux méthodes divergent dès que les cours n'ont pas tous le même maximum :
 * une moyenne de pourcentages donne le même poids à un cours sur 10 et à un
 * cours sur 100, ce qui n'est pas ce qu'attend un bulletin.
 */

/** Types de périodes qui ne portent jamais de notes : ce sont des contenants. */
const TYPES_REGROUPEMENT = ['semestre', 'trimestre'];

/** Libellé court d'une colonne, tel qu'imprimé en tête de grille. */
function libelleColonne(enfant, rangPeriode) {
  if (enfant.type === 'examen') return 'Exam.';
  if (enfant.type === 'periode') {
    return rangPeriode === 1 ? '1<sup>ère</sup> P.' : `${rangPeriode}<sup>ème</sup> P.`;
  }
  // Regroupement imbriqué : T1, T2… ou S1, S2…
  const initiale = enfant.type === 'trimestre' ? 'T' : 'S';
  return `${initiale}${enfant.numero}`;
}

/**
 * Feuilles d'un enfant du regroupement : les périodes qui portent réellement
 * des notes. Un enfant qui est lui-même un regroupement délègue à ses propres
 * enfants — c'est ce qui permet à un semestre de primaire de sommer ses
 * trimestres sans que personne n'ait à décrire cette imbrication.
 */
async function feuillesDe(client, enfant) {
  if (!TYPES_REGROUPEMENT.includes(enfant.type)) return [enfant];

  const petitsEnfants = await client.query(
    `SELECT id, type, numero FROM periodes WHERE semestre_id = $1 ORDER BY numero`,
    [enfant.id]
  );
  const feuilles = [];
  for (const pe of petitsEnfants.rows) {
    feuilles.push(...await feuillesDe(client, pe));
  }
  return feuilles;
}

async function assemblerDonneesRegroupement(client, { classeId, regroupementId }) {
  const parentResult = await client.query(
    `SELECT id, type, libelle, numero FROM periodes WHERE id = $1`,
    [regroupementId]
  );
  const parent = parentResult.rows[0];
  if (!parent) {
    throw Object.assign(new Error('Période introuvable.'), { statusCode: 404 });
  }
  if (!TYPES_REGROUPEMENT.includes(parent.type)) {
    throw Object.assign(
      new Error(`« ${parent.libelle} » est une période de travail, pas un regroupement : son bulletin s'imprime par la route des bulletins de période.`),
      { statusCode: 400 }
    );
  }

  const enfantsResult = await client.query(
    `SELECT id, type, numero FROM periodes WHERE semestre_id = $1 ORDER BY numero`,
    [regroupementId]
  );
  const enfants = enfantsResult.rows;

  const coursResult = await client.query(
    `SELECT cc.id AS classe_cours_id, c.id, c.nom, c.domaine, c.groupe_domaine,
            COALESCE(cc.maximum_points_override, c.maximum_points) AS maximum,
            COALESCE(cc.maximum_examen_override, c.maximum_examen) AS maximum_examen
       FROM classe_cours cc
       JOIN cours c ON c.id = cc.cours_id
      WHERE cc.classe_id = $1
      ORDER BY c.nom`,
    [classeId]
  );
  const cours = coursResult.rows.map((c) => {
    const maxPeriode = Number(c.maximum || 0);
    // Même règle que le bulletin annuel : maximum_examen NULL = 2× la période,
    // 0 = branche non examinée (la case est alors noircie).
    const maxExamen = (c.maximum_examen === null || c.maximum_examen === undefined)
      ? maxPeriode * 2
      : Number(c.maximum_examen);
    return { ...c, maxPeriode, maxExamen, sansExamen: maxExamen === 0, maxima: {} };
  });

  const elevesResult = await client.query(
    `SELECT id, nom, postnom, prenom, matricule
       FROM eleves WHERE classe_id = $1 AND statut = 'actif'
      ORDER BY nom, postnom`,
    [classeId]
  );
  const eleves = elevesResult.rows.map((e) => ({
    ...e, cotes: {}, totaux: {}, pourcentages: {}, places: {},
    applications: {}, conduites: {}
  }));

  /* ---------- Colonnes, déduites des enfants ---------- */
  const colonnes = [];
  let rangPeriode = 0;
  for (let i = 0; i < enfants.length; i++) {
    const enfant = enfants[i];
    if (enfant.type === 'periode') rangPeriode += 1;
    const feuilles = await feuillesDe(client, enfant);
    colonnes.push({
      cle: `c${i}`,
      libelle: libelleColonne(enfant, rangPeriode),
      type: enfant.type,
      periodeId: enfant.id,
      // Une colonne qui ne contient QUE des examens se noircit pour un cours
      // non examiné ; une colonne mixte (un trimestre entier) ne le peut pas :
      // elle contient aussi des périodes, que le cours passe bel et bien.
      feuilles,
      queDesExamens: feuilles.length > 0 && feuilles.every((f) => f.type === 'examen')
    });
  }

  if (eleves.length === 0 || cours.length === 0) {
    return { cours, eleves, colonnes, groupes: [], maxima: null, domaines: null, regroupement: parent };
  }

  /* ---------- Maximum de chaque cours, colonne par colonne ---------- */
  for (const c of cours) {
    for (const col of colonnes) {
      if (c.sansExamen && col.queDesExamens) { c.maxima[col.cle] = null; continue; }
      c.maxima[col.cle] = col.feuilles.reduce(
        (t, f) => t + (f.type === 'examen' ? (c.sansExamen ? 0 : c.maxExamen) : c.maxPeriode),
        0
      );
    }
    c.maxima.total = colonnes.reduce((t, col) => t + (c.maxima[col.cle] || 0), 0);
  }

  /** Notes brutes d'une période feuille, indexées par élève et par cours. */
  async function notesDe(periode) {
    const r = await client.query(
      `SELECT eleve_id, classe_cours_id, points_obtenus
         FROM notes WHERE periode_id = $1 AND classe_cours_id = ANY($2::uuid[])`,
      [periode.id, cours.map((c) => c.classe_cours_id)]
    );
    const m = new Map();
    for (const l of r.rows) m.set(`${l.eleve_id}|${l.classe_cours_id}`, l.points_obtenus);
    return m;
  }

  // Une seule requête par période feuille, réutilisée pour tous les élèves.
  const notesParFeuille = new Map();
  for (const col of colonnes) {
    for (const f of col.feuilles) {
      if (!notesParFeuille.has(f.id)) notesParFeuille.set(f.id, await notesDe(f));
    }
  }

  const CLES = colonnes.map((c) => c.cle);

  for (const eleve of eleves) {
    for (const c of cours) {
      const cotes = {};
      for (const col of colonnes) {
        if (c.sansExamen && col.queDesExamens) { cotes[col.cle] = null; continue; }
        const valeurs = col.feuilles.map((f) => {
          if (c.sansExamen && f.type === 'examen') return null;
          return notesParFeuille.get(f.id)?.get(`${eleve.id}|${c.classe_cours_id}`) ?? null;
        });
        cotes[col.cle] = sommeSiPresent(...valeurs);
      }
      cotes.total = sommeSiPresent(...CLES.map((k) => cotes[k]));
      eleve.cotes[c.id] = cotes;
    }

    for (const cle of [...CLES, 'total']) {
      eleve.totaux[cle] = sommeSiPresent(...cours.map((c) => eleve.cotes[c.id][cle]));
    }
  }

  /* ---------- Maxima de la classe ---------- */
  const maxima = {};
  for (const cle of [...CLES, 'total']) {
    maxima[cle] = cours.reduce((t, c) => t + (c.maxima[cle] || 0), 0);
  }

  for (const eleve of eleves) {
    for (const cle of [...CLES, 'total']) {
      const total = eleve.totaux[cle];
      eleve.pourcentages[cle] = (total === null || !maxima[cle])
        ? null
        : Math.round((total / maxima[cle]) * 10000) / 100;
    }
    eleve.pourcentage = eleve.pourcentages.total;
  }

  /* ---------- Appréciations ----------
     Conduite et application sont des lettres : elles ne s'additionnent pas.
     On ne les reporte donc que sous une colonne qui EST une période de travail.
     Sous une colonne « T1 » (un trimestre entier), il n'existe pas
     d'appréciation unique à afficher — la case reste fermée. */
  for (const col of colonnes) {
    if (col.type !== 'periode') continue;
    const r = await client.query(
      `SELECT eleve_id, application, conduite FROM bulletins WHERE periode_id = $1`,
      [col.periodeId]
    );
    const m = new Map(r.rows.map((l) => [l.eleve_id, l]));
    for (const eleve of eleves) {
      eleve.applications[col.cle] = m.get(eleve.id)?.application ?? null;
      eleve.conduites[col.cle] = m.get(eleve.id)?.conduite ?? null;
    }
  }

  /* ---------- Classement, colonne par colonne ----------
     Le modèle imprime une place par colonne, et non un seul rang général : un
     élève peut être 3ᵉ en première période, 1ᵉʳ à l'examen et 2ᵉ au total. Ne
     classer que sur le total ferait disparaître cette lecture, qui est la
     raison d'être d'un récapitulatif. */
  for (const cle of [...CLES, 'total']) {
    classerParColonne(eleves, cle, (e) => e.totaux[cle]);
  }

  /* ---------- Groupes de maxima ----------
     Deux colonnes consécutives forment un groupe si leur maximum est identique
     POUR CHAQUE COURS. Un seul « Max » les couvre alors, comme sur le modèle
     où les deux périodes partagent le leur. */
  const groupes = [];
  for (const col of colonnes) {
    const dernier = groupes[groupes.length - 1];
    const memeBareme = dernier && cours.every((c) =>
      c.maxima[dernier.colonnes[dernier.colonnes.length - 1].cle] === c.maxima[col.cle]);
    if (memeBareme) dernier.colonnes.push(col);
    else groupes.push({ colonnes: [col] });
  }
  for (const g of groupes) {
    g.cleMax = g.colonnes[0].cle;
    g.queDesExamens = g.colonnes.every((c) => c.queDesExamens);
  }

  /* ---------- Regroupement par domaines (primaire) ----------
     Le bulletin du primaire ne présente pas une liste plate de branches : il
     les range par domaine, avec un sous-total par groupe — c'est ce que montre
     le bulletin officiel, où « Sous-total » revient après les langues
     congolaises, après le français, après les mathématiques, et ainsi de suite.
     Le bulletin de trimestre, qui est la vue rapprochée du même document, doit
     donc porter la même structure ; sans elle, l'instituteur lit sa classe
     rangée par domaines en fin d'année et par ordre alphabétique en cours
     d'année.

     La structure n'est produite QUE si les cours portent un domaine. Une classe
     de secondaire, dont les cours n'en ont pas, reçoit `domaines: null` et le
     gabarit imprime alors sa liste plate habituelle — rien ne change pour elle. */
  const auMoinsUnDomaine = cours.some((c) => c.domaine);
  let domaines = null;
  if (auMoinsUnDomaine) {
    const groupement = grouperParDomaine(cours);
    domaines = groupement.domaines;
    // Un cours sans domaine dans une classe qui en a serait silencieusement
    // absent du tableau. On le rattache à un domaine explicite plutôt que de
    // le laisser disparaître : un bulletin amputé d'une branche ne se remarque
    // pas à la lecture, et c'est le pire des défauts pour ce document.
    if (groupement.sansDomaine.length > 0) {
      domaines = domaines.concat([{ nom: 'AUTRES BRANCHES', cours: groupement.sansDomaine }]);
    }
  }

  /**
   * Sous-total d'un ensemble de branches, colonne par colonne.
   * Utilisé pour les lignes « Sous-total » du primaire ; calculé ici et non
   * dans le gabarit, pour que la même somme serve à l'affichage et à tout
   * contrôle ultérieur.
   */
  function sousTotalDe(liste, eleve) {
    const somme = { maxima: {} };
    for (const cle of [...CLES, 'total']) {
      somme[cle] = sommeSiPresent(...liste.map((c) => eleve.cotes[c.id][cle]));
      somme.maxima[cle] = liste.reduce((t, c) => t + (c.maxima[cle] || 0), 0);
    }
    return somme;
  }

  if (domaines) {
    for (const eleve of eleves) {
      eleve.sousTotaux = {};
      for (const d of domaines) {
        if (d.groupes && d.groupes.length) {
          for (const g of d.groupes) {
            eleve.sousTotaux[`${d.nom}|${g.nom}`] = sousTotalDe(g.cours || [], eleve);
          }
        } else {
          eleve.sousTotaux[d.nom] = sousTotalDe(d.cours || [], eleve);
        }
      }
    }
  }

  return { cours, eleves, colonnes, groupes, maxima, domaines, regroupement: parent };
}

module.exports.assemblerDonneesRegroupement = assemblerDonneesRegroupement;
// Ancien nom, conservé pour ne casser aucun appel existant.
module.exports.assemblerDonneesSemestre = (client, { classeId, semestreId }) =>
  assemblerDonneesRegroupement(client, { classeId, regroupementId: semestreId });
