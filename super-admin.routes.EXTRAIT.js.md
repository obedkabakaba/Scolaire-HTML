/* =============================================================================
   À INSÉRER DANS  routes/super-admin.routes.js
   =============================================================================

   EMPLACEMENT : juste après le bloc « Services complémentaires », c'est-à-dire
   après ces deux lignes existantes —

       router.get('/services/commandes', services.listerCommandesAdmin);
       router.patch('/services/commandes/:id', services.majCommandeAdmin);

   — et AVANT la ligne finale qui monte le routeur Finance :

       router.use('/', require('./super-admin-finance.routes'));

   L'ordre compte : le routeur Finance est monté sur '/', donc tout ce qui est
   déclaré après lui risquerait d'être masqué par une de ses routes.

   Les deux routes héritent du `router.use(authMiddleware, superAdminSeul)`
   posé en haut du fichier. Aucun contrôle n'est à répéter.
   ============================================================================= */

/* ---------- Demandes d'accompagnement (prospects) ----------
 * Ce que le formulaire du site public dépose, et le suivi commercial qui
 * s'ensuit. Distinct des commandes de services juste au-dessus : ici l'école
 * n'existe pas encore, et la transformer en client est précisément le travail.
 */
const prospects = require('../controllers/prospects.controller');
router.get('/prospects', prospects.lister);
router.patch('/prospects/:id', prospects.majDemande);
