require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const ecolesRoutes = require('./routes/ecoles.routes');
const utilisateursRoutes = require('./routes/utilisateurs.routes');
const structureRoutes = require('./routes/structure.routes');
const elevesRoutes = require('./routes/eleves.routes');
const notesRoutes = require('./routes/notes.routes');
const travauxRoutes = require('./routes/travaux.routes');
const bulletinsRoutes = require('./routes/bulletins.routes');
const jobsRoutes = require('./routes/jobs.routes');
const abonnementsRoutes = require('./routes/abonnements.routes');
const calendrierRoutes = require('./routes/calendrier.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const modelesBulletinsRoutes = require('./routes/modeles-bulletins.routes');
const journalRoutes = require('./routes/journal.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const fraisRoutes = require('./routes/frais.routes');
const promotionRoutes = require('./routes/promotion.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const ecoleParametresRoutes = require('./routes/ecole-parametres.routes');
const mentionsRoutes = require('./routes/mentions.routes');
const paiementsRoutes = require('./routes/paiements.routes');
const presencesRoutes = require('./routes/presences.routes');
const emploiDuTempsRoutes = require('./routes/emploi-du-temps.routes');
const publicRoutes = require('./routes/public.routes');
const sitePublicRoutes = require('./routes/site-public.routes');
const disciplineRoutes = require('./routes/discipline.routes');
const archivesRoutes = require('./routes/archives.routes');
const rapportsRoutes = require('./routes/rapports.routes');

const app = express();

// Render (comme la plupart des hébergeurs) place l'app derrière un proxy inverse.
// Nécessaire pour qu'express-rate-limit identifie correctement l'IP réelle du client.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(require('./middleware/rate-limit.middleware').limiteurGeneral);
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'scolaire-saas-backend' });
});

app.use('/auth', authRoutes);
app.use('/admin/ecoles', ecolesRoutes);
app.use('/utilisateurs', utilisateursRoutes);
app.use('/eleves', elevesRoutes);
app.use('/notes', notesRoutes);
app.use('/travaux', travauxRoutes);
app.use('/bulletins', bulletinsRoutes);
app.use('/jobs', jobsRoutes);
app.use('/abonnements', abonnementsRoutes);
app.use('/evenements', calendrierRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/modeles-bulletins', modelesBulletinsRoutes);
app.use('/journal-activite', journalRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/frais', fraisRoutes);
app.use('/promotion', promotionRoutes);
app.use('/uploads', uploadsRoutes);
app.use('/ecole', ecoleParametresRoutes);
app.use('/mentions', mentionsRoutes);
app.use('/paiements', paiementsRoutes);
app.use('/presences', presencesRoutes);
app.use('/emploi-du-temps', emploiDuTempsRoutes);
app.use('/public', publicRoutes);
app.use('/site-public', sitePublicRoutes);
app.use('/discipline', disciplineRoutes);
app.use('/archives', archivesRoutes);
app.use('/rapports', rapportsRoutes);
app.use('/', structureRoutes); // expose /annees-scolaires, /sections, /options, /classes, /cours, /classe-cours

// Gestionnaire d'erreurs générique
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Erreur interne du serveur.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend démarré sur le port ${PORT}`);
});
