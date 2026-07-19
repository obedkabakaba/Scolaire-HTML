const { runWithTenant } = require('../config/db');
const { tenantContextFromReq } = require('../utils/tenant.utils');

const CURRENT_ECOLE = "current_setting('app.current_ecole_id', true)::uuid";

/**
 * GET /modeles-bulletins?type=periode|annuel
 * Renvoie les modèles globaux (Super Admin) + ceux propres à l'école courante.
 * La policy RLS s'en charge déjà, ici on filtre juste par type si demandé.
 */
async function lister(req, res) {
  const { type } = req.query;
  try {
    // Un modèle est visible s'il est global (ecole_id NULL) ou appartient à l'école courante.
    const conditions = [`(ecole_id IS NULL OR ecole_id = ${CURRENT_ECOLE})`];
    const params = [];
    if (type) { params.push(type); conditions.push(`type = $${params.length}`); }

    const result = await runWithTenant(tenantContextFromReq(req), (client) =>
      client.query(
        `SELECT * FROM modeles_bulletins WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
        params
      )
    );
    return res.json(result.rows);
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
async function recupererModeleAutorise(client, req, modeleId) {
  const result = await client.query(`SELECT * FROM modeles_bulletins WHERE id = $1`, [modeleId]);
  const modele = result.rows[0];
  if (!modele) return null;

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
    console.error('Erreur activation modèle:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}

module.exports = {
  lister, creer, supprimerModele, activerModele,
  listerZones, ajouterZone, modifierZone, supprimerZone
};
