const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { runWithTenant } = require('../config/db');
const { tenantContextFromReq } = require('../utils/tenant.utils');
const { construireHtmlBulletinSecondaire, bareme } = require('../utils/bulletin-secondaire-rdc.template');
const { construireHtmlBulletinPrimaire } = require('../utils/bulletin-primaire-rdc.template');
const { COURS_PRIMAIRE_OFFICIELS } = require('../utils/cours-primaire-officiels');
const { sommeSiPresent, classerParColonne } = require('../utils/bulletin-assemblage-officiel');

const CURRENT_ECOLE = "NULLIF(current_setting('app.current_ecole_id', true), '')::uuid";

/**
 * GET /modeles-bulletins?type=periode|annuel
 * Renvoie les modèles globaux (Super Admin) + ceux propres à l'école courante.
 * La policy RLS s'en charge déjà, ici on filtre juste par type si demandé.
 */
/**
 * Fabrique des cotes de démonstration plausibles pour un cours, pour deux
 * élèves fictifs — l'un brillant, l'autre en difficulté, pour que l'aperçu
 * montre à quoi ressemble un bulletin réellement rempli plutôt qu'une grille
 * vide. Les totaux et pourcentages sont calculés avec les MÊMES fonctions
 * (bareme, sommeSiPresent) que l'assemblage réel — pas de formule réinventée
 * ici qui pourrait diverger de ce que produit un vrai bulletin.
 */
function coterDemoSecondaire(cours, { bareme, sommeSiPresent, classerParColonne }) {
  const eleves = [
    { id: 'demo1', nom: 'MUKENDI', postnom: 'Exemple', prenom: 'Aline', sexe: 'F',
      matricule: 'DEMO-001', date_naissance: '12/03/2009', proportion: 0.9 },
    { id: 'demo2', nom: 'KABEYA', postnom: 'Exemple', prenom: 'Junior', sexe: 'M',
      matricule: 'DEMO-002', date_naissance: '05/07/2008', proportion: 0.55 },
  ].map((e) => ({ ...e, cotes: {}, totaux: {}, pourcentages: {}, places: {}, applications: {}, conduites: {} }));

  for (const eleve of eleves) {
    for (const c of cours) {
      const b = bareme(c.maximum, c.maximum_examen);
      const val = (max) => (max ? Math.round(max * eleve.proportion) : null);
      const p1 = val(b.periode), p2 = val(b.periode);
      const ex = b.sansExamen ? null : val(b.examen);
      const p3 = val(b.periode), p4 = val(b.periode);
      const ex2 = b.sansExamen ? null : val(b.examen);
      eleve.cotes[c.id] = {
        p1, p2, ex, tot1: sommeSiPresent(p1, p2, ex),
        p3, p4, ex2, tot2: sommeSiPresent(p3, p4, ex2),
      };
      eleve.cotes[c.id].tg = sommeSiPresent(eleve.cotes[c.id].tot1, eleve.cotes[c.id].tot2);
    }
    for (const col of ['p1', 'p2', 'ex', 'tot1', 'p3', 'p4', 'ex2', 'tot2', 'tg']) {
      eleve.totaux[col] = sommeSiPresent(...cours.map((c) => eleve.cotes[c.id][col]));
    }
    eleve.applications = { p1: 'TB', p2: 'TB', p3: 'B', p4: 'B' };
    eleve.conduites = { p1: 'TB', p2: 'TB', p3: 'TB', p4: 'TB' };
  }

  for (const col of ['p1', 'p2', 'ex', 'tot1', 'p3', 'p4', 'ex2', 'tot2', 'tg']) {
    classerParColonne(eleves, col, (e) => e.totaux[col]);
  }
  return eleves;
}

/** Même principe pour le primaire, à partir du socle officiel réel. */
function coterDemoPrimaire(cours, { sommeSiPresent, classerParColonne }) {
  const eleves = [
    { id: 'demo1', nom: 'MWAMBA', postnom: 'Exemple', prenom: 'Grace', sexe: 'F',
      matricule: 'DEMO-001', date_naissance: '20/01/2017', proportion: 0.85 },
  ].map((e) => ({ ...e, cotes: {} }));

  for (const eleve of eleves) {
    for (const c of cours) {
      const max = Number(c.maximum || 0);
      const valeur = (m) => Math.round(m * eleve.proportion);
      const p1 = valeur(max), p2 = valeur(max), ex1 = valeur(max * 2);
      const p3 = valeur(max), p4 = valeur(max), ex2 = valeur(max * 2);
      const p5 = valeur(max), p6 = valeur(max), ex3 = valeur(max * 2);
      eleve.cotes[c.id] = {
        p1, p2, ex1, t1: sommeSiPresent(p1, p2, ex1),
        p3, p4, ex2, t2: sommeSiPresent(p3, p4, ex2),
        p5, p6, ex3, t3: sommeSiPresent(p5, p6, ex3),
      };
      const cc = eleve.cotes[c.id];
      cc.total = sommeSiPresent(cc.t1, cc.t2, cc.t3);
    }
  }
  return eleves;
}

/**
 * GET /modeles-bulletins/:id/apercu
 *
 * Génère un bulletin de DÉMONSTRATION à partir des données réelles de l'école
 * (nom, ville) mais d'élèves et de notes fictifs, pour que le Directeur voie
 * concrètement à quoi ressemble le modèle avant de l'activer.
 *
 * Nécessaire uniquement pour les modèles OFFICIELS (primaire/secondaire/
 * terminale) : ce sont des gabarits entièrement pilotés par le code, sans
 * image ni zone à positionner — l'éditeur de zones n'a donc rien à leur
 * montrer. Un modèle importé par l'école, lui, reste prévisualisé par
 * l'éditeur de zones existant, où l'image de la maquette sert de fond.
 */
async function apercu(req, res) {
  const { id } = req.params;
  let browser;

  try {
    const donnees = await runWithTenant(tenantContextFromReq(req), async (client) => {
      const modeleResult = await client.query(
        `SELECT * FROM modeles_bulletins
          WHERE id = $1 AND ((ecole_id = ${CURRENT_ECOLE} OR ecole_id IS NULL))`,
        [id]
      );
      const modele = modeleResult.rows[0];
      if (!modele) throw Object.assign(new Error('Modèle introuvable.'), { statusCode: 404 });
      if (!modele.variante) {
        throw Object.assign(
          new Error("Ce modèle n'a pas de mise en page officielle : utilisez l'éditeur de zones pour le prévisualiser."),
          { statusCode: 400 }
        );
      }

      const ecoleResult = await client.query(
        `SELECT nom, ville, commune, province FROM ecoles WHERE id = ${CURRENT_ECOLE}`
      );
      const ecole = ecoleResult.rows[0] || { nom: 'École de démonstration' };

      return { modele, ecole };
    });

    const classeDemo = { nom: 'Classe de démonstration', section_nom: null, option_nom: null };
    const commun = { ecole: donnees.ecole, anneeLibelle: '2026-2027', classe: classeDemo };

    let html;
    if (donnees.modele.variante === 'primaire') {
      const cours = COURS_PRIMAIRE_OFFICIELS.map((c, i) => ({
        id: `demo-c${i}`, nom: c.nom, maximum: c.maximum, domaine: c.domaine, groupe_domaine: c.groupe
      }));
      // Regroupement par domaine identique à l'assemblage réel.
      const parDomaine = new Map();
      for (const c of cours) {
        if (!parDomaine.has(c.domaine)) parDomaine.set(c.domaine, new Map());
        const cle = c.groupe_domaine || '__sans_groupe__';
        const pg = parDomaine.get(c.domaine);
        if (!pg.has(cle)) pg.set(cle, []);
        pg.get(cle).push(c);
      }
      const domaines = [...parDomaine.entries()].map(([nom, pg]) => {
        const nommes = [...pg.entries()].filter(([cle]) => cle !== '__sans_groupe__');
        const sansGroupe = pg.get('__sans_groupe__') || [];
        return nommes.length > 0
          ? { nom, groupes: nommes.map(([n, l]) => ({ nom: n, cours: l })) }
          : { nom, cours: sansGroupe };
      });

      const eleves = coterDemoPrimaire(cours, { sommeSiPresent, classerParColonne });
      html = construireHtmlBulletinPrimaire({ ...commun, eleves, domaines });
    } else {
      const cours = [
        { id: 'demo-c1', nom: 'Mathématiques', maximum: 20, maximum_examen: null },
        { id: 'demo-c2', nom: 'Français', maximum: 20, maximum_examen: null },
        { id: 'demo-c3', nom: 'Anglais', maximum: 10, maximum_examen: null },
        { id: 'demo-c4', nom: 'Activités complémentaires', maximum: 10, maximum_examen: 0 },
        { id: 'demo-c5', nom: 'Comptabilité générale', maximum: 40, maximum_examen: null },
      ];
      const eleves = coterDemoSecondaire(cours, { bareme, sommeSiPresent, classerParColonne });
      html = construireHtmlBulletinSecondaire({
        ...commun, eleves, cours, variante: donnees.modele.variante
      });
    }

    browser = await puppeteer.launch({
      args: chromium.args, executablePath: await chromium.executablePath(), headless: chromium.headless
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="apercu-modele.pdf"');
    return res.send(pdf);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    console.error('Erreur aperçu modèle:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function lister(req, res) {
  const { type } = req.query;
  try {
    const donnees = await runWithTenant(tenantContextFromReq(req), async (client) => {
      const ecoleResult = await client.query(
        `SELECT type_enseignement FROM ecoles WHERE id = ${CURRENT_ECOLE}`
      );
      const typeEnseignement = ecoleResult.rows[0]?.type_enseignement;

      // Une école qui n'a que le primaire n'a rien à faire du modèle officiel
      // du secondaire, ni de sa variante terminale — et réciproquement. Ce
      // filtre s'applique uniquement aux modèles OFFICIELS (cycle renseigné) :
      // un modèle importé par l'école elle-même n'a pas de cycle assigné par
      // la plateforme, il reste toujours visible à son propriétaire.
      const conditions = [`(ecole_id IS NULL OR ecole_id = ${CURRENT_ECOLE})`];
      const params = [];
      if (type) { params.push(type); conditions.push(`type = $${params.length}`); }
      if (typeEnseignement && typeEnseignement !== 'les_deux') {
        params.push(typeEnseignement);
        conditions.push(`(cycle IS NULL OR cycle::text = $${params.length})`);
      }

      return client.query(
        `SELECT *,
                -- Un modèle officiel fourni par la plateforme se reconnaît à
                -- ecole_id NULL + une variante. L'interface s'en sert pour
                -- masquer les boutons Modifier/Supprimer : mieux vaut ne pas
                -- proposer une action que l'API refusera de toute façon.
                (ecole_id IS NULL AND variante IS NOT NULL) AS est_officiel,
                (ecole_id IS NULL) AS est_global
         FROM modeles_bulletins WHERE ${conditions.join(' AND ')}
         ORDER BY (ecole_id IS NULL) DESC, created_at DESC`,
        params
      );
    });
    return res.json(donnees.rows);
  } catch (err) {
    console.error('Erreur liste modèles bulletins:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}

/**
 * POST /modeles-bulletins
 * body: { nom, type, fichier_source_url, layout, global }
 * "global" (bool, Super Admin uniquement) crée un modèle partagé par toutes les écoles.
 */
async function creer(req, res) {
  const { nom, type, fichier_source_url, layout, global } = req.body;
  if (!nom) {
    return res.status(400).json({ message: 'nom requis.' });
  }

  const creeGlobal = req.auth.isSuperAdmin && global === true;
  if (!creeGlobal && !req.auth.ecoleId) {
    return res.status(400).json({ message: "Contexte école manquant pour créer un modèle non global." });
  }

  try {
    const result = await runWithTenant(tenantContextFromReq(req), (client) =>
      client.query(
        `INSERT INTO modeles_bulletins (ecole_id, nom, type, fichier_source_url, layout)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [creeGlobal ? null : req.auth.ecoleId, nom, type || 'periode', fichier_source_url || null, layout || null]
      )
    );
    return res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Erreur création modèle bulletin:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}

/**
 * Vérifie que l'utilisateur a le droit de modifier ce modèle
 * (propriétaire de l'école, ou Super Admin pour un modèle global).
 */
/**
 * Vérifie que l'utilisateur a le droit de modifier ce modèle.
 *
 * Les modèles officiels fournis par la plateforme (ecole_id NULL + variante)
 * sont en LECTURE SEULE pour les écoles : une école peut importer et activer
 * son propre modèle autant qu'elle veut, mais ne peut ni altérer ni supprimer
 * les modèles de référence — ils sont partagés par toutes les écoles, et une
 * suppression accidentelle priverait tout le monde du bulletin conforme.
 *
 * Techniquement, la comparaison `modele.ecole_id === req.auth.ecoleId` suffisait
 * déjà à les protéger (NULL n'égale aucun ecoleId), mais elle renvoyait un
 * « introuvable » trompeur. On distingue désormais les deux cas pour que le
 * directeur comprenne qu'il s'agit d'une règle, pas d'un bug.
 */
async function recupererModeleAutorise(client, req, modeleId) {
  const result = await client.query(`SELECT * FROM modeles_bulletins WHERE id = $1`, [modeleId]);
  const modele = result.rows[0];
  if (!modele) return null;

  const estOfficiel = modele.ecole_id === null && modele.variante !== null;
  if (estOfficiel && !req.auth.isSuperAdmin) {
    throw Object.assign(
      new Error("Ce modèle officiel est fourni par la plateforme et ne peut pas être modifié ni supprimé. Importez votre propre modèle si vous souhaitez une mise en page différente : il sera utilisé en priorité pour vos classes."),
      { statusCode: 403 }
    );
  }

  const autorise = req.auth.isSuperAdmin || modele.ecole_id === req.auth.ecoleId;
  return autorise ? modele : null;
}

/**
 * DELETE /modeles-bulletins/:id
 */
async function supprimerModele(req, res) {
  const { id } = req.params;
  try {
    const supprime = await runWithTenant(tenantContextFromReq(req), async (client) => {
      const modele = await recupererModeleAutorise(client, req, id);
      if (!modele) return false;
      await client.query('DELETE FROM modeles_bulletins WHERE id = $1', [id]);
      return true;
    });

    if (!supprime) return res.status(404).json({ message: 'Modèle introuvable ou non autorisé.' });
    return res.json({ message: 'Modèle supprimé.' });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    if (err.code === '23503') {
      return res.status(409).json({ message: 'Impossible de supprimer : ce modèle a déjà été utilisé pour générer des bulletins.' });
    }
    console.error('Erreur suppression modèle:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}

/**
 * GET /modeles-bulletins/:id/zones
 */
async function listerZones(req, res) {
  const { id } = req.params;
  try {
    const result = await runWithTenant(tenantContextFromReq(req), (client) =>
      client.query('SELECT * FROM zones_modele WHERE modele_id = $1 ORDER BY cle', [id])
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Erreur liste zones:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}

/**
 * POST /modeles-bulletins/:id/zones
 * body: { cle, x, y, largeur, hauteur, police, taille, alignement }
 * Une "zone" = une case positionnée sur le modèle importé (ex: "nom_eleve", "total_periode1"...),
 * coordonnées en % de la page (0-100), pour rester indépendant de la résolution de l'image importée.
 */
async function ajouterZone(req, res) {
  const { id } = req.params;
  const { cle, x, y, largeur, hauteur, police, taille, alignement } = req.body;

  if (!cle || x === undefined || y === undefined) {
    return res.status(400).json({ message: 'cle, x et y sont requis.' });
  }

  try {
    const resultat = await runWithTenant(tenantContextFromReq(req), async (client) => {
      const modele = await recupererModeleAutorise(client, req, id);
      if (!modele) return null;

      const zoneResult = await client.query(
        `INSERT INTO zones_modele (modele_id, cle, x, y, largeur, hauteur, police, taille, alignement)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [id, cle, x, y, largeur || null, hauteur || null, police || null, taille || null, alignement || null]
      );
      return zoneResult.rows[0].id;
    });

    if (!resultat) return res.status(404).json({ message: 'Modèle introuvable ou non autorisé.' });
    return res.status(201).json({ id: resultat });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    console.error('Erreur ajout zone:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}

/**
 * PATCH /modeles-bulletins/zones/:zoneId
 */
async function modifierZone(req, res) {
  const { zoneId } = req.params;
  const { x, y, largeur, hauteur, police, taille, alignement } = req.body;

  try {
    const resultat = await runWithTenant(tenantContextFromReq(req), async (client) => {
      const zoneActuelle = await client.query(
        `SELECT z.*, m.ecole_id FROM zones_modele z
         JOIN modeles_bulletins m ON m.id = z.modele_id
         WHERE z.id = $1`,
        [zoneId]
      );
      if (zoneActuelle.rows.length === 0) return false;

      const autorise = req.auth.isSuperAdmin || zoneActuelle.rows[0].ecole_id === req.auth.ecoleId;
      if (!autorise) return false;

      await client.query(
        `UPDATE zones_modele SET
           x = COALESCE($1, x), y = COALESCE($2, y),
           largeur = COALESCE($3, largeur), hauteur = COALESCE($4, hauteur),
           police = COALESCE($5, police), taille = COALESCE($6, taille),
           alignement = COALESCE($7, alignement)
         WHERE id = $8`,
        [x, y, largeur, hauteur, police, taille, alignement, zoneId]
      );
      return true;
    });

    if (!resultat) return res.status(404).json({ message: 'Zone introuvable ou non autorisée.' });
    return res.json({ message: 'Zone mise à jour.' });
  } catch (err) {
    console.error('Erreur modification zone:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}

/**
 * DELETE /modeles-bulletins/zones/:zoneId
 */
async function supprimerZone(req, res) {
  const { zoneId } = req.params;
  try {
    const resultat = await runWithTenant(tenantContextFromReq(req), async (client) => {
      const zoneActuelle = await client.query(
        `SELECT z.id, m.ecole_id FROM zones_modele z
         JOIN modeles_bulletins m ON m.id = z.modele_id
         WHERE z.id = $1`,
        [zoneId]
      );
      if (zoneActuelle.rows.length === 0) return false;

      const autorise = req.auth.isSuperAdmin || zoneActuelle.rows[0].ecole_id === req.auth.ecoleId;
      if (!autorise) return false;

      await client.query('DELETE FROM zones_modele WHERE id = $1', [zoneId]);
      return true;
    });

    if (!resultat) return res.status(404).json({ message: 'Zone introuvable ou non autorisée.' });
    return res.json({ message: 'Zone supprimée.' });
  } catch (err) {
    console.error('Erreur suppression zone:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}

/**
 * POST /modeles-bulletins/:id/activer  (Directeur/Super Admin)
 * Marque ce modèle comme celui à utiliser pour la génération des bulletins
 * (désactive les autres modèles du même type pour cette école).
 */
async function activerModele(req, res) {
  const { id } = req.params;
  try {
    const resultat = await runWithTenant(tenantContextFromReq(req), async (client) => {
      const modele = await recupererModeleAutorise(client, req, id);
      if (!modele) return null;

      await client.query(
        `UPDATE modeles_bulletins SET actif = false
         WHERE type = $1 AND (ecole_id = $2 OR (ecole_id IS NULL AND $2 IS NULL))`,
        [modele.type, modele.ecole_id]
      );
      await client.query(`UPDATE modeles_bulletins SET actif = true WHERE id = $1`, [id]);
      return true;
    });

    if (!resultat) return res.status(404).json({ message: 'Modèle introuvable ou non autorisé.' });
    return res.json({ message: 'Modèle activé pour la génération des bulletins.' });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    console.error('Erreur activation modèle:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}

/**
 * POST /modeles-bulletins/:id/suggerer-zones  (Directeur/Super Admin)
 * Analyse le fichier importé (image ou PDF) avec Claude (vision) et propose
 * automatiquement un premier placement des zones habituelles — l'utilisateur
 * peut ensuite les ajuster ou les supprimer normalement, comme des zones
 * créées à la main. Ne remplace pas les zones déjà existantes.
 */

/**
 * Validation et enregistrement des zones proposées.
 *
 * Écrite UNE fois et partagée par les deux fournisseurs d'IA : deux
 * validations parallèles finiraient par diverger, et l'une accepterait une clé
 * que l'autre refuse — selon la clé configurée sur le serveur, ce qui serait
 * incompréhensible à diagnostiquer.
 */
async function finaliserZonesSuggerees(req, res, modeleId, texteBrut) {
  const CLES_VALIDES = new Set([
    'nom_eleve', 'postnom_eleve', 'prenom_eleve', 'matricule', 'classe', 'option',
    'annee_scolaire', 'periode', 'total', 'pourcentage', 'classement', 'mention',
    'conduite', 'application', 'observation', 'signature', 'cachet', 'date', 'logo_ecole'
  ]);

  let zonesSuggerees;
  try {
    const correspondance = String(texteBrut).match(/\[[\s\S]*\]/);
    zonesSuggerees = JSON.parse(correspondance ? correspondance[0] : texteBrut);
    if (!Array.isArray(zonesSuggerees)) throw new Error('pas un tableau');
  } catch (e) {
    console.error('Réponse IA non exploitable:', String(texteBrut).slice(0, 300));
    return res.status(502).json({
      message: "L'assistant n'a pas renvoyé un résultat exploitable. Réessayez avec une image plus nette, "
        + "ou placez les zones à la main."
    });
  }

  const idsCrees = await runWithTenant(tenantContextFromReq(req), async (client) => {
    const ids = [];
    for (const z of zonesSuggerees) {
      // Une clé inventée serait affichée VIDE sur le bulletin final, ce qui
      // ressemblerait à un bug du logiciel plutôt qu'à une erreur de l'IA.
      if (!z || !CLES_VALIDES.has(z.cle) || typeof z.x !== 'number' || typeof z.y !== 'number') continue;
      const r = await client.query(
        `INSERT INTO zones_modele (modele_id, cle, x, y, largeur, hauteur) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [modeleId, z.cle, Math.max(0, Math.min(100, z.x)), Math.max(0, Math.min(100, z.y)),
         Math.max(3, Math.min(100, z.largeur || 15)), Math.max(2, Math.min(100, z.hauteur || 5))]
      );
      ids.push(r.rows[0].id);
    }
    return ids;
  });

  if (idsCrees.length === 0) {
    return res.status(200).json({
      message: "Aucune zone n'a pu être identifiée avec certitude sur ce modèle. Placez-les à la main sur l'aperçu.",
      nb: 0
    });
  }
  return res.json({
    message: `${idsCrees.length} zone(s) proposée(s). Vérifiez leur position avant d'imprimer un bulletin réel.`,
    nb: idsCrees.length
  });
}

async function suggererZones(req, res) {
  const { id } = req.params;

  try {
    const modele = await runWithTenant(tenantContextFromReq(req), (client) => recupererModeleAutorise(client, req, id));
    if (!modele) return res.status(404).json({ message: 'Modèle introuvable ou non autorisé.' });
    if (!modele.fichier_source_url) {
      return res.status(400).json({ message: "Ce modèle n'a pas encore de fichier importé." });
    }

    // DEUX FOURNISSEURS POSSIBLES, ET C'EST NÉCESSAIRE.
    //
    // Cette fonction exigeait ANTHROPIC_API_KEY, alors que tout le reste de la
    // plateforme (assistant, journal, règlement de discipline) utilise
    // OPENAI_API_KEY. Une école dont l'assistant fonctionne parfaitement se
    // voyait donc répondre « la suggestion automatique n'est pas configurée » —
    // message incompréhensible, puisque l'IA marchait ailleurs.
    //
    // On garde Anthropic quand la clé existe : il lit les PDF nativement, ce
    // qu'OpenAI ne fait pas. Sinon on bascule sur OpenAI en vision, qui couvre
    // les images.
    const cleApi = process.env.ANTHROPIC_API_KEY;
    if (!cleApi && !process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        message: "L'analyse automatique n'est pas configurée sur ce serveur. "
          + "Vous pouvez placer les zones à la main sur l'aperçu du modèle."
      });
    }

    // Télécharger le fichier importé pour l'envoyer en analyse
    const reponseFichier = await fetch(modele.fichier_source_url);
    if (!reponseFichier.ok) {
      return res.status(502).json({ message: "Impossible de récupérer le fichier importé pour l'analyser." });
    }
    const buffer = Buffer.from(await reponseFichier.arrayBuffer());
    const base64 = buffer.toString('base64');
    const contentType = reponseFichier.headers.get('content-type') || 'image/png';
    const estPdf = contentType.includes('pdf');

    const promptTexte = `Tu analyses l'image d'un modèle de bulletin scolaire congolais VIERGE (juste la mise en page, sans données réelles remplies).

Pour chacune des clés suivantes qui a VISUELLEMENT un espace clairement dédié sur cette page, propose une zone rectangulaire où insérer cette donnée. Coordonnées en pourcentage de la largeur/hauteur totale de la page (0 à 100), origine en haut à gauche (x=0 à gauche, y=0 en haut).

Clés possibles (n'utilise que celles-ci, et seulement si tu es raisonnablement confiant qu'un espace leur est dédié) :
nom_eleve, postnom_eleve, prenom_eleve, matricule, classe, option, annee_scolaire, periode, total, pourcentage, classement, mention, conduite, application, observation, signature, cachet, date, logo_ecole.

Réponds UNIQUEMENT avec un tableau JSON valide, sans aucun texte avant ou après, au format exact :
[{"cle": "nom_eleve", "x": 12.5, "y": 8.0, "largeur": 30, "hauteur": 5}]

Si tu n'es pas sûr qu'une clé ait un espace dédié sur cette page précise, ne l'inclus simplement pas plutôt que de deviner au hasard.`;

    // ---------- Chemin OpenAI (pas de clé Anthropic) ----------
    if (!cleApi) {
      if (estPdf) {
        return res.status(400).json({
          message: "Le modèle est un PDF, et le fournisseur d'IA configuré ne sait pas les lire. "
            + "Réimportez-le sous forme d'image (photo ou capture d'écran), ou placez les zones à la main."
        });
      }
      const { appelerIAVision } = require('../utils/ia.utils');
      let texteOpenAI;
      try {
        texteOpenAI = await appelerIAVision({
          systeme: "Tu analyses un modèle de bulletin scolaire. Réponds uniquement par un tableau JSON.",
          message: promptTexte,
          images: [{ base64, type: contentType }],
          maxTokens: 2000
        });
      } catch (e) {
        return res.status(e.statusCode || 502).json({ message: e.message });
      }
      return finaliserZonesSuggerees(req, res, id, texteOpenAI);
    }

    const reponseIA = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': cleApi,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            estPdf
              ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
              : { type: 'image', source: { type: 'base64', media_type: contentType, data: base64 } },
            { type: 'text', text: promptTexte }
          ]
        }]
      })
    });

    const donneesIA = await reponseIA.json();
    if (!reponseIA.ok) {
      console.error('Erreur API Anthropic (suggestion zones):', donneesIA);
      return res.status(502).json({ message: "Erreur lors de l'analyse IA du modèle." });
    }

    const texteBrut = (donneesIA.content || []).find((bloc) => bloc.type === 'text')?.text || '';
    return finaliserZonesSuggerees(req, res, id, texteBrut);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    console.error('Erreur suggestion zones IA:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}


module.exports = {
  lister, creer, supprimerModele, activerModele, apercu,
  listerZones, ajouterZone, modifierZone, supprimerZone, suggererZones
};
