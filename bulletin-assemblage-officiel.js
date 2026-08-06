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
function classerParColonne(eleves, cle, lireValeur) {
  const effectif = eleves.length;
  const classables = eleves
    .filter((e) => lireValeur(e) !== null && lireValeur(e) !== undefined)
    .sort((a, b) =>
      Number(lireValeur(b)) - Number(lireValeur(a))
      || a.nom.localeCompare(b.nom, 'fr')
      || (a.postnom || '').localeCompare(b.postnom || '', 'fr'));

  classables.forEach((e, i) => {
    e.places[cle] = `${i + 1}/${effectif}`;
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
  const eleves = elevesResult.rows.map((e) => ({ ...e, cotes: {} }));
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
  }

  for (const eleve of eleves) {
    for (const c of cours) {
      const cc = eleve.cotes[c.id];
      cc.total = sommeSiPresent(cc.t1, cc.t2, cc.t3);
    }
  }

  return { domaines, eleves, sansDomaine };
}

module.exports = {
  assemblerDonneesSecondaire,
  assemblerDonneesPrimaire,
  sommeSiPresent,
  classerParColonne,
};

/* ==========================================================================
   BULLETIN DE SEMESTRE — grille par cours
   ========================================================================== */

/**
 * Assemble la grille d'un SEUL semestre, cours par cours.
 *
 * Structure produite, conforme au bulletin de semestre demandé :
 *
 *   Cours | 1ère P | 2ème P | Max période | Examen | Max examen | Total | Max semestre
 *
 * Le « Max période » est le maximum d'UN cours POUR UNE période — pas le cumul
 * des deux. C'est le point qui distingue ce bulletin du bulletin annuel : il
 * sert de repère de lecture pour les deux colonnes de période à sa gauche, qui
 * partagent le même barème.
 *
 * Le total est celui du SEMESTRE (P1 + P2 + examen), jamais de l'année.
 *
 * Le pourcentage se calcule en total obtenu sur total des maxima — et non en
 * moyenne des pourcentages de période comme le faisait `recalculerBulletinSemestre`.
 * Les deux méthodes divergent dès que les cours n'ont pas tous le même maximum :
 * une moyenne de pourcentages donne le même poids à un cours sur 10 et à un
 * cours sur 100, ce qui n'est pas ce qu'attend un bulletin.
 */
/** Les quatre colonnes chiffrées du bulletin de semestre, dans l'ordre imprimé. */
const COLONNES_SEMESTRE = ['p1', 'p2', 'ex', 'total'];

async function assemblerDonneesSemestre(client, { classeId, semestreId }) {
  // Les trois enfants du semestre : deux périodes de travail journalier et un
  // examen. On les distingue par leur TYPE, jamais par leur ordre d'insertion.
  const enfants = await client.query(
    `SELECT id, type, numero FROM periodes WHERE semestre_id = $1 ORDER BY numero`,
    [semestreId]
  );
  const periodes = enfants.rows.filter((e) => e.type === 'periode').sort((a, b) => a.numero - b.numero);
  const examen = enfants.rows.find((e) => e.type === 'examen') || null;

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
  const cours = coursResult.rows.map((c) => {
    const maxPeriode = Number(c.maximum || 0);
    // Même règle que le bulletin annuel : maximum_examen NULL = 2x la période,
    // 0 = branche non examinée (la case est alors noircie).
    const maxExamen = (c.maximum_examen === null || c.maximum_examen === undefined)
      ? maxPeriode * 2
      : Number(c.maximum_examen);
    return {
      ...c,
      maxPeriode,
      maxExamen,
      sansExamen: maxExamen === 0,
      // Total du semestre pour ce cours : les deux périodes + l'examen.
      maxSemestre: maxPeriode * 2 + maxExamen,
    };
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
  if (eleves.length === 0 || cours.length === 0) return { cours, eleves, maxima: null };

  async function notesDe(periode) {
    if (!periode) return new Map();
    const r = await client.query(
      `SELECT eleve_id, classe_cours_id, points_obtenus
         FROM notes WHERE periode_id = $1 AND classe_cours_id = ANY($2::uuid[])`,
      [periode.id, cours.map((c) => c.classe_cours_id)]
    );
    const m = new Map();
    for (const l of r.rows) m.set(`${l.eleve_id}|${l.classe_cours_id}`, l.points_obtenus);
    return m;
  }

  const notesP1 = await notesDe(periodes[0]);
  const notesP2 = await notesDe(periodes[1]);
  const notesEx = await notesDe(examen);

  for (const eleve of eleves) {
    for (const c of cours) {
      const clef = `${eleve.id}|${c.classe_cours_id}`;
      const p1 = notesP1.get(clef) ?? null;
      const p2 = notesP2.get(clef) ?? null;
      const ex = c.sansExamen ? null : (notesEx.get(clef) ?? null);
      eleve.cotes[c.id] = { p1, p2, ex, total: sommeSiPresent(p1, p2, ex) };
    }
    for (const col of COLONNES_SEMESTRE) {
      eleve.totaux[col] = sommeSiPresent(...cours.map((c) => eleve.cotes[c.id][col]));
    }
  }

  // Maxima généraux de la classe, pour la ligne de synthèse.
  const maxima = cours.reduce((acc, c) => {
    acc.p1 += c.maxPeriode;
    acc.p2 += c.maxPeriode;
    acc.ex += c.maxExamen;
    acc.total += c.maxSemestre;
    return acc;
  }, { p1: 0, p2: 0, ex: 0, total: 0 });

  for (const eleve of eleves) {
    eleve.pourcentages = {};
    for (const col of COLONNES_SEMESTRE) {
      const total = eleve.totaux[col];
      eleve.pourcentages[col] = (total === null || !maxima[col])
        ? null
        : Math.round((total / maxima[col]) * 10000) / 100;
    }
    // Conservé pour les appels qui ne lisaient qu'un pourcentage unique.
    eleve.pourcentage = eleve.pourcentages.total;
  }

  /* ---------- Appréciations, période par période ----------
     Conduite et application ne s'additionnent pas et ne se moyennent pas : ce
     sont des lettres. Le bulletin de semestre les REPORTE donc, une colonne
     par période, exactement comme le bulletin officiel de fin d'année. Les
     colonnes Examen et Total restent fermées : il n'existe pas de conduite
     « du total du semestre ». */
  async function appreciationsDe(periode) {
    if (!periode) return new Map();
    const r = await client.query(
      `SELECT eleve_id, application, conduite FROM bulletins WHERE periode_id = $1`,
      [periode.id]
    );
    const m = new Map();
    for (const l of r.rows) m.set(l.eleve_id, l);
    return m;
  }

  const apprP1 = await appreciationsDe(periodes[0]);
  const apprP2 = await appreciationsDe(periodes[1]);
  for (const eleve of eleves) {
    const a1 = apprP1.get(eleve.id) || {};
    const a2 = apprP2.get(eleve.id) || {};
    eleve.applications = { p1: a1.application ?? null, p2: a2.application ?? null };
    eleve.conduites = { p1: a1.conduite ?? null, p2: a2.conduite ?? null };
  }

  /* ---------- Classement, colonne par colonne ----------
     Le modèle imprime une place par colonne, et non un seul rang général :
     un élève peut être 3ᵉ en première période, 1ᵉʳ à l'examen et 2ᵉ au total.
     Ne classer que sur le total ferait disparaître cette lecture, qui est la
     raison d'être d'un récapitulatif de semestre.

     Un élève dépourvu de cote sur une colonne n'y est pas classé : lui donner
     un rang laisserait croire à un résultat nul là où rien n'a été saisi. */
  for (const col of COLONNES_SEMESTRE) {
    classerParColonne(eleves, col, (e) => e.totaux[col]);
  }

  return { cours, eleves, maxima, periodes, examen };
}

module.exports.assemblerDonneesSemestre = assemblerDonneesSemestre;
module.exports.COLONNES_SEMESTRE = COLONNES_SEMESTRE;
