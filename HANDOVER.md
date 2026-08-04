# HANDOVER COMPLET — PROJET ARDOISE
### Plateforme SaaS de gestion scolaire (République Démocratique du Congo)

**Document généré le** : 2 août 2026, à la demande explicite de l'utilisateur, pour permettre la reprise intégrale du projet dans une nouvelle conversation sans perte de contexte.

**Comment lire ce document** : il est volontairement long et détaillé. Il est conçu pour être la SEULE source d'information du prochain assistant — ne suppose aucune connaissance préalable de la conversation précédente. Chaque section peut être lue indépendamment, mais la section 20 (Contexte implicite) et la section finale (Points qui risquent d'être oubliés) contiennent les pièges les plus probables.

---

## 1. VISION DU PROJET

### Objectif général
Ardoise est une plateforme SaaS multi-tenant de gestion scolaire, conçue spécifiquement pour le système éducatif de la République Démocratique du Congo (RDC). Elle numérise l'ensemble du cycle de vie administratif et pédagogique d'une école : inscriptions, gestion des classes, saisie des notes, génération de bulletins conformes au format officiel du Ministère, gestion financière (frais scolaires en double devise), présences, discipline, communication avec les parents, et pilotage via tableaux de bord.

### Problème résolu
Les écoles congolaises gèrent aujourd'hui ces processus manuellement ou avec des outils disparates (Excel, papier). Les problèmes concrets identifiés et adressés :
- Les bulletins doivent respecter un format officiel strict imposé par le Ministère de l'Éducation Nationale et Nouvelle Citoyenneté (anciennement Ministère de l'Enseignement Primaire, Secondaire et Technique — ce changement de nom a été appliqué dans les gabarits).
- Les écoles manipulent deux devises (Franc Congolais FC et Dollar USD) sans mécanisme fiable de conversion.
- Le calcul des moyennes et classements est sujet à erreur manuelle et à des incohérences de méthode.
- La clôture d'une année scolaire et le passage à la suivante sont des moments à risque (élèves mal promus, notes de l'ancienne année qui refont surface).
- Le suivi de l'assiduité, de la discipline et des paiements manque de traçabilité.

### Public cible
- **Écoles primaires, secondaires (humanités), ou les deux** en RDC — le système distingue explicitement ces deux cycles avec des règles différentes (programme national fixe au primaire vs. options/sections au secondaire).
- **Rôles utilisateurs** : Directeur, Préfet des études, Secrétaire, Professeur, Titulaire (professeur responsable d'une classe), Comptable, Parent, Super Admin (niveau plateforme, gère les écoles clientes), et deux rôles récemment ajoutés mais pas encore exploités dans le code métier : Chargé des présences (`charge_presences`), Directeur de discipline (`directeur_discipline`).

### Fonctionnement global
Chaque école est un tenant isolé (isolation stricte via Row-Level Security PostgreSQL, voir section 4 et 17). Un Super Admin gère la création des écoles et leurs abonnements. Chaque école a un Directeur qui configure sa structure (classes, cours, cycles, années scolaires), et le personnel utilise l'application au quotidien (saisie de notes, présences, etc.). Un module IA en lecture seule permet des requêtes analytiques sécurisées. Le système génère des documents PDF (bulletins, reçus de paiement) fidèles au format officiel congolais.

---

## 2. ARCHITECTURE

### Architecture complète
```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND — 34 pages HTML autonomes (vanilla JS)         │
│  PWA (service worker, manifest, mode hors-ligne)         │
│  Fichiers partagés : ui.css, ui.js, theme.css            │
└───────────────────────┬───────────────────────────────────┘
                         │ fetch() / appelApi()
                         ▼
┌─────────────────────────────────────────────────────────┐
│  BACKEND — Node.js / Express (server.js)                 │
│  ~30 modules de routes, ~35 contrôleurs                  │
│  Middlewares : auth JWT, rôles, rate-limit, mot de       │
│  passe provisoire, permissions bulletins                 │
└───────────────────────┬───────────────────────────────────┘
                         │ pg (node-postgres), runWithTenant()
                         ▼
┌─────────────────────────────────────────────────────────┐
│  BASE DE DONNÉES — PostgreSQL via Supabase                │
│  RLS (Row-Level Security) sur TOUTES les tables          │
│  Isolation par SET LOCAL app.current_ecole_id            │
└─────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   Puppeteer-core   Supabase Storage   Services externes
   (PDF bulletins,  (fichiers/photos)  (Resend emails,
   reçus)                              PawaPay paiements,
                                       WhatsApp Business API)
```

### Technologies utilisées
- **Backend** : Node.js, Express 4.19
- **Base de données** : PostgreSQL (hébergé par Supabase), accès via `pg` (node-postgres), PAS l'ORM Supabase JS pour les requêtes métier — uniquement `@supabase/supabase-js` pour le Storage (fichiers).
- **Authentification** : `jsonwebtoken` (JWT), `bcrypt` (hash mots de passe)
- **Génération PDF** : `puppeteer-core` + `@sparticuz/chromium` (Chromium headless compatible environnement serverless/Render)
- **Frontend** : HTML/CSS/JavaScript vanilla, PAS de framework (pas de React/Vue). PWA avec service worker.
- **Sécurité HTTP** : `helmet`, `cors`, `express-rate-limit`
- **Emails** : Resend (`RESEND_API_KEY`)
- **Paiements mobile money** : PawaPay
- **Messagerie** : WhatsApp Business API (webhook avec vérification de signature Meta)
- **Export tableurs** : `xlsx`
- **Upload fichiers** : `multer`

### Structure des dossiers (backend)
```
scolaire-saas-backend-main/
├── server.js                  # point d'entrée, montage des routes
├── config/
│   └── db.js                  # pool pg, runWithTenant(), harnais IA lecture seule
├── controllers/                # ~35 fichiers, logique métier
├── routes/                     # ~30 fichiers, un par module, montés dans server.js
├── middleware/                 # auth, rôles, rate-limit, permissions bulletins
├── utils/                      # helpers réutilisables (voir section 13)
├── migrations/                 # 001 à 009, SQL brut, à jouer dans Supabase SQL Editor
└── scripts/                    # seed-superadmin.js, reset-superadmin.js
```

### Structure des dossiers (frontend)
```
Scolaire-HTML-main/
├── *.html                      # 34 pages autonomes, chacune avec son <script> inline
├── ui.js                       # helpers partagés : ArdoiseUI, ArdoiseEdition, réparation
│                                # de #message-flash, boîtes de dialogue stylées
├── ui.css                      # styles partagés : toast, flou de modale, filet de
│                                # sécurité :where() pour boutons/champs non stylés
├── theme.css                   # variables CSS, thème clair/nuit, animation d'entrée
└── scripts/
    └── audit-frontend.py        # script d'audit statique (voir section 16 et 19)
```

### Services externes
- **Supabase** : hébergement PostgreSQL + Storage (fichiers/photos)
- **Render** : hébergement du backend Node.js (URL confirmée dans le code frontend : `https://scolaire-saas-backend.onrender.com`)
- **Resend** : envoi d'emails transactionnels
- **PawaPay** : paiements mobile money
- **WhatsApp Business API (Meta)** : notifications/communication
- **cron-job.org (ou équivalent)** : déclenchement des jobs planifiés via `POST /jobs/abonnements` et `POST /jobs/calendrier`, protégés par un secret partagé (`CRON_SECRET`), pas par JWT — car appelés hors contexte utilisateur.

### Raisons des choix techniques
- **Vanilla JS plutôt qu'un framework** : choix du projet original, antérieur à cette conversation. Chaque page HTML est autonome, ce qui a un coût réel de duplication de code (ex. `afficherMessage()` dupliqué dans 23 pages, `echapper()` réimplémentée différemment page par page) — un problème identifié et partiellement corrigé en centralisant certains comportements dans `ui.js`/`ui.css` avec des techniques qui n'exigent pas de modifier les pages (voir section 9 et 16).
- **`pg` brut plutôt qu'un ORM** : permet un contrôle total sur les policies RLS et les requêtes complexes (agrégations de bulletins, etc.), au prix d'une absence de migrations automatiques — les migrations sont des fichiers SQL manuels, numérotés, à jouer dans l'ordre.
- **RLS PostgreSQL pour l'isolation multi-tenant** : plus robuste qu'un simple filtre applicatif `WHERE ecole_id = ?` — même une requête mal écrite dans un contrôleur ne peut pas fuiter les données d'une autre école, car la base elle-même refuse.
- **Puppeteer pour les PDF** : permet un contrôle pixel-parfait du rendu HTML/CSS des bulletins officiels, plus fiable que des bibliothèques de génération PDF programmatique pour reproduire une mise en page administrative complexe.

---

## 3. BASE DE DONNÉES

### Avertissement important
Je (l'assistant précédent) n'ai **jamais eu d'accès direct à une base PostgreSQL réelle** dans cet environnement (pas de réseau). Toutes les migrations ont été écrites, vérifiées syntaxiquement, mais **jamais exécutées contre une vraie base** avant livraison à l'utilisateur. L'utilisateur a rencontré au moins une erreur de migration (`column "cycle" is of type cycle_enseignement but expression is of type type_enseignement`) qui a été corrigée après coup. **Le prochain assistant doit supposer que d'autres erreurs de ce type peuvent exister dans des migrations non encore jouées**, et doit demander à l'utilisateur de confirmer l'état réel de sa base avant d'empiler de nouvelles migrations.

### Tables principales (schéma d'origine, avant cette conversation)
Ces tables existaient déjà au début de cette conversation (je ne les ai pas créées, je les ai modifiées via migrations) :
- `ecoles` — une ligne par établissement client
- `utilisateurs` — comptes de tout le personnel + parents
- `utilisateur_roles` — table de liaison utilisateur ↔ rôle (un utilisateur peut avoir plusieurs rôles)
- `annees_scolaires` — années scolaires d'une école
- `classes` — classes d'une école pour une année donnée
- `classe_cours` — cours rattachés à une classe (avec overrides de maximum)
- `cours` — catalogue des cours d'une école
- `enseignant_cours` — affectation professeur ↔ (classe_cours)
- `eleves` — élèves
- `periodes` — périodes/semestres/trimestres/examens d'une année
- `notes` — notes des élèves par cours et par période
- `bulletins` — résultats calculés (total, pourcentage, classement, mention) par (élève, période)
- `frais_scolaires` — montants attendus par classe/année
- `paiements_frais` — paiements enregistrés
- `presences` — appel journalier
- `documents` — fichiers uploadés (signature, cachet, logo...)
- `modeles_bulletins` / `zones_modele` — modèles de bulletins importés par zone
- `notifications` — notifications internes
- `journal_activite` — journal d'audit
- `options`, `sections`, `vacations` — structure organisationnelle du secondaire
- `discipline` (sanctions, capital de conduite — table existante mais peu exploitée dans cette conversation)
- `eleve_classe_historique` — trace de quelle classe un élève a fréquentée chaque année (utilisé pour les archives)
- `evenements_calendrier` — événements du calendrier scolaire
- `creneaux`, `emploi_du_temps` — grille horaire

### Tables créées ou modifiées pendant cette conversation (détail par migration)

**Migration 001 — `001-annee-pivot-et-finances.sql`**
- Index unique `annees_scolaires_un_seul_pivot` : une seule année `active=true` par école (contrainte partielle `WHERE active`).
- Contrainte `annees_scolaires_pivot_non_cloture` : `CHECK (NOT (active AND cloturee))`.
- Index unique sur libellé d'année par école (évite les doublons "2025-2026" x2).
- `ecoles.devise_principale` (FC/USD), `ecoles.taux_change_usd_fc`, `taux_change_maj_at`, `taux_change_maj_par`.
- `frais_scolaires.devise`, `frais_scolaires.taux_change` (figé à la config).
- `paiements_frais.annee_scolaire_id` (AJOUTÉ — n'existait pas, cause du bug historique majeur des dettes non calculables), `paiements_frais.taux_change`.
- Index unique sur `classe_cours`, `enseignant_cours`, `classes` par nom/année (idempotence du report de structure).

**Migration 002 — `002-bulletins-modeles-par-classe.sql`**
- `cours.maximum_examen` (NULL = 2× la période par défaut, 0 = pas d'examen → case noircie sur bulletin).
- `classe_cours.maximum_examen_override`.
- `classes.modele_periode_id`, `classes.modele_annuel_id` (FK vers `modeles_bulletins`, `ON DELETE SET NULL`).
- `modeles_bulletins.variante` (primaire/secondaire/terminale/NULL).

**Migration 003 — `003-periodes-cycle-et-modeles-officiels.sql`**
- `periodes.cycle` (cycle_enseignement, nullable), rétro-rempli pour écoles mono-cycle uniquement.
- **Point corrigé après coup par l'utilisateur** : la ligne `SET cycle = e.type_enseignement` a échoué car `type_enseignement` (valeurs : primaire/secondaire/**les_deux**) et `cycle_enseignement` (valeurs : primaire/secondaire seulement) sont deux ENUM PostgreSQL distincts. Corrigé en `e.type_enseignement::text::cycle_enseignement`.
- Seed des 3 modèles de bulletins officiels globaux (`ecole_id IS NULL`) : primaire, secondaire, terminale — type `'annuel'` (PAS `'periode'`, erreur initiale corrigée : le modèle officiel couvre l'année entière, pas une seule période).

**Migration 004 — `004-cours-domaine-primaire.sql`**
- `cours.domaine`, `cours.groupe_domaine` (texte libre, pour le regroupement du bulletin primaire par domaines officiels).
- `ecoles.commune` (manquait pour l'en-tête des bulletins officiels).

**Migration 005 — `005-classes-niveau-division.sql`**
- `classes.niveau` (entier 1-8, rang de l'année d'études), `classes.division` (texte, "A"/"B"/"C").
- Index unique `(ecole_id, annee_scolaire_id, niveau, option_id, division)` — sauf si doublons préexistants détectés (avertit sans échouer).
- **IMPORTANT** : le niveau des classes existantes reste NULL après migration (ne peut pas être déduit du nom de classe). La promotion continue de fonctionner via `classe_suivante_id` en attendant.

**Migration 006 — `006-eleves-coordonnees-completes.sql`**
- `eleves.lieu_naissance` (manquait, imprimé sur bulletins officiels).
- `eleves.responsable_adresse` (distincte de `eleves.adresse`).

**Migration 007 — `007-calendrier-jours-speciaux.sql`**
- Type `type_jour_special` ENUM (ferie/vacances/conge/greve/autre).
- Table `jours_speciaux` (plages de dates, cycle nullable, RLS activée).
- `notifications.cle_unicite`, `notifications.lien` (déduplication des rappels automatiques).

**Migration 008 — `008-roles-et-mode-presences.sql`**
- Ajout à l'ENUM `role_utilisateur` : `'charge_presences'`, `'directeur_discipline'` (les deux d'un coup car irréversible).
- `ecoles.mode_presences` (titulaire/professeur/charge).
- `presences.saisi_par_initial`, `presences.motif_modification`, `presences.modifie_at`.

**Migration 009 — `009-horaires-exceptionnels.sql`**
- Table `creneaux_exceptions` (créneau_id, jour 1-7, classe_id nullable, heure_debut/fin, motif). Index unique `(creneau_id, jour, COALESCE(classe_id, uuid_nul))`.

### RLS (Row-Level Security)
**Pattern systématique appliqué à chaque nouvelle table** :
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <table>
  USING (
    ecole_id = (NULLIF(current_setting('app.current_ecole_id', true), ''))::uuid
    OR current_setting('app.is_superadmin', true) = 'true'
  );
```
Ce réglage (`app.current_ecole_id`) est positionné par `runWithTenant()` (voir `config/db.js`) via `SET LOCAL` à chaque transaction — jamais de session partagée entre requêtes. Le Super Admin contourne via `app.is_superadmin`.

### Fonctions/triggers SQL
Aucun trigger PL/pgSQL complexe n'a été ajouté pendant cette conversation. Toute la logique de recalcul (classement, pourcentages) est faite **côté application** (`notes.controller.js`), pas en base. C'est un choix : plus facile à corriger/déboguer en JS qu'en PL/pgSQL, mais signifie que le recalcul n'est PAS automatique en base — il faut appeler explicitement `recalculerClassement()`.

### Point d'attention majeur : valeurs matérialisées
`bulletins.total`, `bulletins.pourcentage`, `bulletins.classement` sont des colonnes **stockées**, pas calculées à la volée. Elles ne se mettent à jour QUE quand `recalculerClassement()` est appelé. C'est la cause du bug le plus significatif rencontré (voir section 11).

---

## 4. AUTHENTIFICATION

### Fonctionnement complet
1. `POST /auth/login` : email + mot de passe → vérifié via `bcrypt.compare`.
2. Si succès : génération d'un **access token JWT** (courte durée, `JWT_ACCESS_EXPIRES`, défaut 15 min) et d'un **refresh token opaque** (pas un JWT — `crypto.randomBytes(48)`, stocké en base sous forme de **hash SHA-256**, jamais en clair).
3. Le refresh token est révocable (stocké en base, peut être invalidé).
4. `POST /auth/refresh` : présente le refresh token brut, le backend le hash et compare à la base, régénère un nouvel access token.
5. `POST /auth/logout` : invalide le refresh token côté serveur.

### JWT — contenu du payload
```js
{
  sub: user.id,
  ecole_id: user.ecole_id,
  roles: user.roles,          // tableau, un utilisateur peut avoir plusieurs rôles
  is_superadmin: user.roles.includes('super_admin')
}
```
Secret : `JWT_ACCESS_SECRET` (à distinguer de `JWT_REFRESH_SECRET`, utilisé différemment — le refresh token n'est PAS un JWT signé, c'est un hash comparé en base, donc `JWT_REFRESH_SECRET` sert probablement à autre chose ou est un nom historique ; **à vérifier dans le code exact, je n'ai pas la certitude à 100% de son usage précis**).

### Permissions / Gestion des rôles
- Middleware `role.middleware.js` : `requireRole(...rolesAutorises)` — vérifie `req.auth.isSuperAdmin || req.auth.roles.some(r => rolesAutorises.includes(r))`.
- Rôles existants dans l'ENUM PostgreSQL `role_utilisateur` : `directeur`, `prefet`, `secretaire`, `professeur`, `titulaire`, `comptable`, `parent`, `super_admin`, et (ajoutés migration 008) `charge_presences`, `directeur_discipline`.
- **`charge_presences` et `directeur_discipline` sont dans l'ENUM mais le code métier de `directeur_discipline` n'est PAS ENCORE ÉCRIT** (le chantier discipline du point 10 de la liste utilisateur n'a pas été commencé). `charge_presences` EST exploité (voir présences, section 5).
- La logique d'autorisation fine (au-delà du simple rôle) est souvent faite DANS le contrôleur plutôt que dans le middleware de route — exemple : `verifierAccesClasse()` dans `presences.controller.js` qui dépend du `mode_presences` de l'école, information que le middleware de route ne peut pas connaître. **Piège identifié et corrigé une fois** : une route trop restrictive au niveau `requireRole()` peut bloquer un utilisateur AVANT que la logique fine du contrôleur n'ait la chance de l'autoriser. Toujours vérifier que la liste de rôles au niveau route est un sur-ensemble large, et laisser le contrôleur affiner.

### Sécurité
- Mots de passe hashés avec `bcrypt`.
- Un flag "mot de passe provisoire" existe (`mot-de-passe-provisoire.middleware.js`) — force le changement de mot de passe au premier login (vérifié dans le middleware, pas dans le détail exact du flux ici).
- Rate limiting global (`rate-limit.middleware.js`) sur toute l'API.
- `helmet` pour les en-têtes de sécurité HTTP.
- Isolation multi-tenant par RLS (voir section 3), donc même une faille applicative ne peut pas fuiter entre écoles.
- Harnais spécial pour l'assistant IA (`config/db.js`) : `SET TRANSACTION READ ONLY` + `SET LOCAL ROLE ia_lecture` (rôle PostgreSQL sans droit d'écriture, sans DDL, colonnes sensibles non lisibles) — protège contre une éventuelle injection SQL générée par le modèle de langage, indépendamment de toute validation applicative.
- Webhook WhatsApp : vérification de signature Meta (mentionné dans le README d'origine, non retravaillé dans cette conversation).

---

## 5. TOUTES LES FONCTIONNALITÉS DÉVELOPPÉES PENDANT CETTE CONVERSATION

Cette section couvre uniquement ce qui a été fait/modifié PENDANT cette conversation (pas l'inventaire du code pré-existant, sauf mention explicite).

### 5.1 Année scolaire pivot
- **Objectif** : garantir qu'une seule année scolaire est "active" par école à tout instant, et qu'aucune donnée d'une année antérieure ne "remonte" chez les utilisateurs courants.
- **Fonctionnement** : contrainte base (index unique + CHECK), fonction `verifierAnneeActive()` dans `annee.utils.js`, garde-fous dans `structure.controller.js` (`resoudreAnneeGestion`, `resoudreAnneeConsultable`), exception pour le comptable qui peut voir les dettes antérieures.
- **Fichiers** : `migrations/001-*.sql`, `utils/annee.utils.js`, `controllers/structure.controller.js`.
- **État** : fonctionnel, testé (simulations avec mocks, pas de vraie base).
- **Limitations** : aucun test contre une vraie base PostgreSQL.
- **Décision** : le comptable est le SEUL rôle autorisé à consulter des données financières d'années antérieures ; les autres doivent passer par le module Archives.

### 5.2 Clôture et enchaînement des années
- **Objectif** : à la clôture d'une année, proposer/créer automatiquement la suivante pour que l'école ne reste jamais sans année active.
- **Fichiers** : `controllers/structure.controller.js` (fonction de clôture).
- **État** : fonctionnel.
- **Décision** : la nouvelle année est créée automatiquement à la clôture (avec confirmation), pas seulement "proposée".

### 5.3 Devises et taux de change
- **Objectif** : permettre à une école de travailler en FC et/ou USD, avec conversion fiable.
- **Fonctionnement** : `ecoles.devise_principale` + `taux_change_usd_fc`. Le taux est **figé** au moment de chaque transaction (`frais_scolaires.taux_change`, `paiements_frais.taux_change`) — changer le taux de l'école N'AFFECTE PAS les transactions déjà enregistrées.
- **Fichiers** : `utils/devise.utils.js` (fonctions `normaliserDevise`, `convertir`, `sqlPaiementConverti`, `sqlFraisConverti`), migration 001.
- **État** : fonctionnel, largement testé par simulation.
- **Décision importante** : pas de service de taux de change automatique/externe — c'est le comptable qui saisit et met à jour manuellement le taux. Le taux n'est PAS rétroactif.

### 5.4 Dettes antérieures (comptable)
- **Objectif** : fonctionnalité demandée explicitement par l'utilisateur, absente du système initial.
- **Fonctionnement** : le comptable peut consulter les soldes dus des années antérieures à l'année active, avec conversion de devise.
- **Fichiers** : `controllers/frais.controller.js`.
- **État** : fonctionnel.

### 5.5 Reçu de paiement (mise en page)
- **Objectif** : corriger la numérotation (année scolaire, pas année civile) et repositionner cachet/logo.
- **Fichiers** : `controllers/frais.controller.js` (génération PDF du reçu).
- **État** : fait.

### 5.6 Report de structure entre années
- **Objectif** : ne pas re-configurer les classes chaque année ; report automatique de la structure (classes, cours, professeurs assignés) d'une année à l'autre, idempotent.
- **Fichiers** : `controllers/structure.controller.js`.
- **État** : fonctionnel.

### 5.7 Bulletins officiels — refonte complète
C'est le chantier le plus lourd de la conversation. Plusieurs sous-parties :

**5.7.1 Gabarits officiels RDC (primaire, secondaire, terminale)**
- **Objectif** : reproduire fidèlement les bulletins officiels du Ministère (fournis en photos par l'utilisateur), avec drapeau RDC et armoiries, en-tête avec le NOUVEAU nom du ministère.
- **Fichiers** : `utils/bulletin-secondaire-rdc.template.js`, `utils/bulletin-primaire-rdc.template.js`, `utils/bulletin-examen-etat.template.js`, `utils/drapeau-rdc.svg.js` (SVG vectoriel, dessiné à la main), `utils/armoiries-rdc.asset.js` (image encodée en base64, fournie par l'utilisateur).
- **État** : ATTENTION — les gabarits primaire et secondaire ont été **réécrits dans une AUTRE conversation** (avec Claude Opus, capable de voir les images) après que ma capacité d'affichage d'images se soit épuisée dans CETTE conversation. Les fichiers livrés par l'utilisateur (`bulletin-secondaire-rdc_template.js`, `bulletin-primaire-rdc_template.js`, `bulletin-examen-etat_template.js`) ont ensuite été intégrés par moi dans le dépôt. **Le prochain assistant doit savoir que la fidélité visuelle de ces gabarits n'a PAS été vérifiée par moi visuellement** — seule leur logique de calcul (barème) l'a été.
- **Barème vérifié** (secondaire) : `examen = 2× maximum de période` PAR DÉFAUT, mais configurable par cours (`cours.maximum_examen`), `0` = pas d'examen (case noircie). Semestre = P1+P2+examen. T.G. annuel = 2×semestre (deux semestres).
- **Socle primaire** : 23 branches officielles codées en dur dans `utils/cours-primaire-officiels.js`, avec vérification automatique que la somme des maxima = 300 (correspond à la ligne "Maxima généraux" du bulletin officiel photographié). Domaines : Langues (Langues congolaises + Français), Mathématiques/Sciences/Technologie, Univers social, Arts, Développement personnel.
- **Terminale** : bloc "Examen d'État" **volontairement laissé VIERGE** (cases à remplir à la main) — les points de l'examen d'État viennent du centre d'examen, pas de l'école. Erreur à ne jamais reproduire : ne pas essayer d'y insérer une valeur calculée.

**5.7.2 Assemblage des données réelles (`bulletin-assemblage-officiel.js`)**
- **Objectif** : transformer les notes brutes de la base en la grille attendue par les gabarits.
- **Règle de nullité centrale** : une colonne dont AUCUNE composante n'est saisie reste `null` (case vide à l'impression) ; dès qu'AU MOINS une composante existe, le total se calcule en traitant les manquantes comme 0. Fonction `sommeSiPresent()`.
- **Règle de classement** : chaque colonne (P1, P2, examen, total semestre, T.G.) a SON PROPRE rang, recalculé indépendamment de `bulletins.classement` stocké (qui utilise une méthode différente, moins fiable — moyenne de pourcentages). Fonction `classerParColonne()` : un élève sans valeur sur une colonne N'EST PAS CLASSÉ (pas de rang à 0/null qui laisserait croire à un résultat nul).
- **Fichiers** : `utils/bulletin-assemblage-officiel.js`. Exporte : `assemblerDonneesSecondaire`, `assemblerDonneesPrimaire`, `assemblerDonneesSemestre`, `sommeSiPresent`, `classerParColonne`.

**5.7.3 Sélection du modèle et branchement**
- **ERREUR CORRIGÉE, IMPORTANTE** : j'ai d'abord branché les gabarits officiels sur le bulletin DE PÉRIODE (`bulletins.controller.js` / `genererPdfClasse`), ce qui était une erreur conceptuelle — les gabarits officiels montrent TOUTE l'année (deux semestres, T.G.), pas une seule période. Après signalement par l'utilisateur (erreur `column c.modele_periode_id does not exist` en prod, car la migration n'était pas jouée, MAIS le vrai problème était le mauvais branchement), j'ai **retiré** le branchement de `bulletins.controller.js` (retour au comportement d'origine, gabarit générique `bulletin-template.js`) et je l'ai mis sur `bulletin-annuel.controller.js`, où il appartient réellement.
- **Sélection actuelle** : modèle assigné à la classe (`classes.modele_annuel_id`) en priorité, sinon modèle actif de l'école pour ce cycle, sinon modèle officiel global. La variante `terminale` n'est JAMAIS choisie automatiquement — seulement via assignation explicite à la classe (rien dans le schéma ne permet de déduire qu'une classe est "terminale").
- **Fichiers** : `controllers/bulletin-annuel.controller.js`, migration 003 (seed des modèles en type `'annuel'`, pas `'periode'` — deuxième erreur corrigée dans la même zone).

**5.7.4 Bulletin de semestre — grille détaillée**
- **Objectif utilisateur explicite** : grille par cours avec colonnes 1ère P / 2ème P / Max (de la période, pas cumulé) / Examen / Max examen / Total général (du semestre) / Max semestre.
- **Fichiers** : `utils/bulletin-semestre-template.js` (réécrit intégralement), `controllers/bulletin-semestre.controller.js` (branché sur `assemblerDonneesSemestre`).
- **État** : testé, vérifié colonne par colonne contre la spécification exacte de l'utilisateur.

**5.7.5 Recalcul automatique et cohérence interface/PDF**
- **Bug majeur découvert** : `bulletins.pourcentage` etc. sont des valeurs MATÉRIALISÉES. `recalculerClassement()` (dans `notes.controller.js`) n'était appelé qu'à la validation des notes, PAS à l'enregistrement simple (`enregistrerGrille`, `enregistrerGrilleTravaux`). Résultat : entre la saisie et la validation, l'écran affichait des valeurs périmées, différentes du PDF (qui, lui, passait par un chemin différent).
- **Corrections** :
  1. `recalculerClassement()` exportée depuis `notes.controller.js`, appelée aussi dans `enregistrerGrille`/`enregistrerGrilleTravaux`.
  2. `listerBulletinsClasse` (l'écran, endpoint `/liste`) recalcule maintenant AVANT de lire — donc l'écran se corrige tout seul sans action utilisateur.
  3. Endpoint `POST /notes/recalculer` ajouté pour forcer un recalcul en masse sur les bulletins déjà générés AVANT le correctif (nécessaire car les valeurs stockées avant le fix restent périmées tant qu'on ne les retouche pas).
- **Piège découvert en cours de route** : dans `enregistrerGrille`, `classeId` peut être ABSENT du corps de requête si l'appelant fournit `classeCoursId` directement — il fallait résoudre la classe réelle depuis `classe_cours.classe_id`, pas depuis un paramètre qui peut ne pas exister.
- **Second défaut de méthode trouvé et corrigé (deux fois, dans deux endroits différents)** : `AVG(pourcentage)` au lieu de "total obtenu / total des maxima". Trouvé dans `recalculerClassement` (corrigé tôt dans la conversation), puis retrouvé dans `recalculerBulletinSemestre` (bulletin-semestre.controller.js) ET dans le palmarès/tableau de bord (voir 5.10).

### 5.8 Migration du concept de classes (niveau/division) et promotion
- **Objectif** : gérer les classes parallèles ("4ème Scientifique A/B/C") et empêcher qu'une promotion mélange des options différentes.
- **Fonctionnement** : `classes.niveau` (entier) + `classes.division` (lettre). La promotion cherche les classes cibles sur `(niveau+1, MÊME option, MÊME cycle)`, jamais par un simple pointeur. Répartition automatique entre divisions selon la capacité déclarée (remplit A jusqu'à saturation, puis B, etc.).
- **Garde-fou double** : la recherche elle-même ne peut PAS retourner une classe d'une autre option (empêche le mélange à la source), ET un second contrôle à l'EXÉCUTION de la promotion vérifie que option_source == option_cible et cycle_source == cycle_cible (empêche un contournement si l'appelant envoie un `classe_cible_id` arbitraire).
- **Exceptions légitimes** : `classe_suivante_id` (destination forcée par le directeur) et `classe_orientation` (le rôle même d'une classe d'orientation est de disperser vers des options différentes).
- **Fichiers** : `migrations/005-*.sql`, `controllers/promotion.controller.js`, `controllers/structure.controller.js` (creerClasse/modifierClasse gèrent niveau/division).
- **État** : testé avec simulations (répartition A pleine → B → C, blocage cross-option, autorisation via classe_suivante_id/orientation).
- **Limitation majeure** : le niveau des classes EXISTANTES reste NULL — aucune déduction automatique depuis le nom. Tant que le directeur n'a pas renseigné `niveau` sur ses classes, la promotion moderne (par niveau/option) ne s'applique pas, et le système retombe sur `classe_suivante_id`.

### 5.9 Calendrier scolaire (socle)
- **Objectif** : brique centrale dont dépendent présences, tableau de bord, notifications.
- **Fonctionnement** : `utils/calendrier.utils.js` — `estJourOuvrable()` (combine bornes d'année scolaire, `ecoles.jours_cours` (jours de la semaine, DÉJÀ existant, réutilisé — pas dupliqué), et `jours_speciaux` (fériés/vacances/congés, nouvelle table)), `periodeCourante()` (déduit la période active à une date donnée depuis les VRAIES dates de `periodes.date_debut/fin`, jamais par déduction d'ordre).
- **Piège corrigé** : `Date.getDay()` renvoie 0 pour dimanche, 1 pour lundi ; la convention métier (`jours_cours`) utilise 1=lundi...7=dimanche. Une conversion explicite (`numeroJourSemaine()`) est nécessaire, sinon toute la semaine est décalée.
- **Interface** : page `calendrier.html` entièrement refaite — vraie grille mensuelle (pas une simple liste), aujourd'hui en surbrillance (cadre, pas fond coloré, pour rester visible même un jour férié), liste latérale des événements avec statuts (passé/en cours/proche/à venir), gestion des jours non ouvrés (fériés/vacances/congés) séparée des événements.
- **Fichiers** : `utils/calendrier.utils.js`, `controllers/calendrier.controller.js` (étendu avec `vueMensuelle`, `verifierJour`, `obtenirPeriodeCourante`, `listerJoursSpeciaux`, `creerJourSpecial`, `supprimerJourSpecial`), `routes/calendrier.routes.js`, `calendrier.html` (refonte complète), `migrations/007-*.sql`.
- **État** : testé (alignement de grille vérifié sur 5 mois incluant cas limites, statuts d'événements vérifiés).

### 5.10 Rappels automatiques (notifications)
- **Objectif** : alerter la direction (clôturer une période) et les professeurs (soumettre leurs notes) automatiquement.
- **Fonctionnement** : job `POST /jobs/calendrier` (protégé par `CRON_SECRET`, à appeler par un planificateur externe quotidien), parcourt toutes les écoles, détecte les périodes se terminant sous 7 jours, notifie la direction et les professeurs n'ayant pas soumis leurs notes.
- **Déduplication cruciale** : `notifications.cle_unicite` (ex. `periode_fin:<id>`, `notes_non_soumises:<periode>:<cours>:<classe>`) — sans elle, le même rappel réapparaîtrait à chaque exécution quotidienne du job.
- **Fichiers** : `utils/notification.utils.js` (complété, PAS remplacé — un `creerEtEnvoyerNotification` pré-existant faisait déjà de l'email au directeur avec une déduplication PAR JOUR, insuffisante ; nouvelles fonctions `notifier`, `notifierPlusieurs`, `utilisateursAvecRole` ajoutées à côté), `controllers/jobs.controller.js` (fonction `executerJobCalendrier` ajoutée), `routes/jobs.routes.js`.
- **État** : testé (déduplication vérifiée sur deux passages consécutifs : 0 doublon au second).
- **Limitation** : PAS de menu de notifications spécifique côté professeur vérifié/construit dans cette conversation (l'utilisateur a demandé "je ne sais plus trop si y en a déjà" — PAS VÉRIFIÉ, `notifications.controller.js` existe avec `lister`/`marquerLue`/`toutMarquerLu`, mais son intégration UI complète pour un professeur n'a pas été auditée).

### 5.11 Présences — trois modes de saisie + nouveau rôle
- **Objectif** : gérer trois organisations différentes selon l'école (titulaire unique, tout professeur avec verrou "un par jour", chargé des présences dédié).
- **Fonctionnement** : `ecoles.mode_presences` (titulaire/professeur/charge). `verifierAccesClasse()` dans `presences.controller.js` applique la règle selon le mode. En mode "professeur", le PREMIER appel du jour verrouille — un second professeur peut MODIFIER mais doit fournir un motif (sauf s'il est l'auteur initial, ou s'il est direction). `presences.saisi_par_initial` conserve l'auteur du tout premier appel (jamais écrasé), distinct de `saisi_par` (dernier modificateur).
- **Nouveau rôle** : `charge_presences` (ajouté à l'ENUM, migration 008). Le titulaire garde TOUJOURS la main sur sa propre classe même en mode "charge" (il reste responsable de ses élèves).
- **Blocage calendrier** : avant tout enregistrement, `estJourOuvrable()` est vérifié — impossible de faire l'appel un jour férié/dimanche/vacances, avec message explicite.
- **Piège corrigé** : la ROUTE (`presences.routes.js`) filtrait initialement sur `requireRole('directeur','prefet','secretaire','titulaire')` — un professeur en mode "professeur" était REJETÉ AVANT MÊME d'atteindre la logique du contrôleur qui l'aurait autorisé. Route élargie pour inclure `professeur` et `charge_presences`, la règle fine restant dans le contrôleur (seul endroit qui connaît le mode ET la classe).
- **Interface** : `presences.html` vérifie le calendrier AVANT d'afficher la feuille (évite de remplir 20 lignes pour se voir refuser à la fin). Si un appel existe déjà (409, motif `appel_deja_fait`), l'interface demande le motif via boîte de dialogue stylée et RENVOIE directement (pas de perte de saisie).
- **Fichiers** : `migrations/008-*.sql`, `controllers/presences.controller.js`, `routes/presences.routes.js`, `presences.html`, `parametres.html` (réglage du mode + champ commune ajouté).
- **État** : testé exhaustivement (11 scénarios de permission vérifiés).

### 5.12 Rapports et tableau de bord — correction des calculs
- **Bugs trouvés et corrigés** (l'utilisateur avait raison de suspecter les calculs) :
  1. **Palmarès** : sans filtre de période, agrégeait TOUTES les périodes confondues — un élève avec 4 bulletins apparaissait 4 fois dans le classement. Corrigé avec `DISTINCT ON (e.id)` (ne garde que le meilleur résultat de la portée choisie).
  2. **Réussite** (taux) : même défaut — comptait un élève autant de fois qu'il a de bulletins.
  3. **Moyenne générale (tableau de bord)** : `AVG(pourcentage)` sur TOUS les bulletins confondus — un élève présent toute l'année pesait 4× plus qu'un élève arrivé en cours d'année. Corrigé en calculant d'abord une moyenne PAR ÉLÈVE, puis la moyenne des moyennes.
  4. **Libellé trompeur** : "Taux de réussite global" affichait en réalité une MOYENNE (`AVG(pourcentage)`), pas un taux de réussite (part d'élèves au-dessus du seuil). Renommé en "Moyenne générale" partout.
- **Nouveau mécanisme de portée** : `resoudrePortee()` dans `rapports.controller.js` — accepte `periodeId` (précis), ou `portee` = 'semestre'/'examen'/'annee'. PAR DÉFAUT (aucun paramètre) : la PÉRIODE COURANTE (via calendrier), jamais "toutes".
- **Nouveaux endpoints** : `GET /rapports/moyennes` (moyenne pondérée par élève, avec détail par classe), `GET /rapports/portees` (liste les filtres proposables, construite depuis les VRAIES périodes créées par l'école).
- **Widget cliquable (tableau de bord)** : demandé explicitement — le filtre reste invisible, cliquer sur la carte "Moyenne générale" ouvre une modale de choix de portée, la carte se met à jour immédiatement.
- **Fichiers** : `controllers/rapports.controller.js` (fonction `resoudrePortee`, `conditionPortee`, endpoints `moyennes`/`porteesDisponibles` ajoutés), `routes/rapports.routes.js`, `rapports.html` (filtres branchés, bannière de portée affichée), `dashboard-directeur.html` (widget cliquable + modale).
- **État** : testé (5 portées vérifiées, DISTINCT ON vérifié, pondération par élève vérifiée).

### 5.13 Étanchéité primaire / secondaire
- **Objectif utilisateur** : une école exclusivement primaire ne doit RIEN voir du secondaire dans toute la plateforme (et vice-versa), sauf si "les_deux".
- **Fait** : filtrage de la liste des modèles de bulletins (`modeles-bulletins.controller.js` / `lister`) par `ecoles.type_enseignement` — testé sur les 3 configurations (primaire→voit primaire seul, secondaire→voit secondaire+terminale, les_deux→voit tout). Verrouillage du sélecteur de cycle dans `classes.html` (une école mono-cycle a le champ pré-rempli et désactivé, plutôt que de proposer un choix qui échouerait après coup).
- **PAS FAIT / reconnu explicitement comme incomplet** : sections/options, menus de navigation, autres écrans de listage (`listerVacations`, `listerOptions`, `listerCours` dans `structure.controller.js` ne filtrent PAS par `type_enseignement` — risque faible en pratique car une école primaire ne créera jamais de vacation secondaire, mais **non vérifié exhaustivement sur toute la plateforme**).
- **Fichiers** : `controllers/modeles-bulletins.controller.js`, `classes.html`.

### 5.14 Modèles de bulletins — aperçu et gestion
- **Bug trouvé** : cliquer sur un modèle OFFICIEL (sans image, purement généré par code) ouvrait l'éditeur de zones (conçu pour les modèles importés avec image), qui affichait un écran vide sans erreur visible — d'où l'impression que "l'aperçu ne marche plus".
- **Corrigé** : nouvel endpoint `GET /modeles-bulletins/:id/apercu` — génère un VRAI PDF de démonstration (identité réelle de l'école, élèves fictifs aux notes plausibles) en réutilisant les gabarits officiels. Cliquer sur un modèle officiel ouvre ce PDF dans un nouvel onglet ; cliquer sur un modèle importé garde l'éditeur de zones.
- **Boutons manquants ajoutés** : Activer et Supprimer (le bouton "supprimer" n'existait auparavant que pour une ZONE à l'intérieur d'un modèle, pas pour le modèle lui-même). Bug JS trouvé au passage : `echapper()` utilisée mais non définie dans cette page (`generateur-modeles.html`) — ajoutée.
- **Fichiers** : `controllers/modeles-bulletins.controller.js` (fonction `apercu`), `routes/modeles-bulletins.routes.js`, `generateur-modeles.html`.
- **État** : testé (génération PDF de démo vérifiée sans erreur).

### 5.15 En-tête des bulletins — nom du ministère et hiérarchie visuelle
- **Fait** : remplacement de "MINISTÈRE DE L'ENSEIGNEMENT PRIMAIRE, SECONDAIRE ET TECHNIQUE" par "MINISTÈRE DE L'ÉDUCATION NATIONALE ET NOUVELLE CITOYENNETÉ" (nouveau nom officiel communiqué par l'utilisateur) dans les DEUX gabarits officiels (primaire, secondaire). Séparation des tailles de police (pays plus visible, ministère en sous-titre plus petit).
- **Fichiers** : `utils/bulletin-secondaire-rdc.template.js`, `utils/bulletin-primaire-rdc.template.js`.
- **Non vérifié visuellement** (capacité d'affichage d'images épuisée) — l'utilisateur devra confirmer le rendu visuel réel.

### 5.16 Élèves — coordonnées complètes et fiche de consultation
- **Bugs trouvés** : `eleves.lieu_naissance` n'existait pas (zone bulletin toujours vide) ; `eleves.responsable_email` existait en base mais n'était géré ni à la création ni à la modification (toujours vide) ; le formulaire ne gérait même pas l'adresse/téléphone de l'ÉLÈVE (seulement du responsable).
- **Fait** : migration 006 (colonnes ajoutées), 5 champs ajoutés au formulaire (`eleves.html`), fiche de consultation en LECTURE SEULE ajoutée (clic sur la ligne ouvre la fiche, bouton "Modifier" bascule vers le formulaire d'édition).
- **Fichiers** : `migrations/006-*.sql`, `controllers/eleves.controller.js`, `eleves.html`.
- **État** : testé, IDs vérifiés par l'audit.

### 5.17 Aperçu de classe (déjà existant — pas construit par moi)
- **Découverte importante** : en voulant construire cette fonctionnalité (point 8 de la liste utilisateur), j'ai découvert qu'elle existait DÉJÀ — probablement construite plus tôt dans cette même conversation, perdue de ma mémoire active. Ma tentative de reconstruction a créé une fonction DUPLIQUÉE (`apercuClasse` définie deux fois dans `structure.controller.js` — en JS, la seconde définition écrase silencieusement la première). J'ai supprimé mon doublon (moins complet) et gardé la version existante, meilleure : détection d'anomalies (pas de titulaire, cours sans professeur, cours sans domaine pour le primaire, effectif > capacité), agrégation correcte de plusieurs professeurs sur un même cours.
- **État** : l'interface (`classes.html`) était déjà entièrement branchée et cohérente avec l'endpoint.
- **Leçon pour le prochain assistant** : **auditer systématiquement l'existant avant de reconstruire quoi que ce soit** — cette conversation est si longue que des fonctionnalités entières peuvent avoir été construites puis oubliées.

### 5.18 Emploi du temps — horaires exceptionnels par jour
- **Découverte similaire** : le mécanisme backend (`creneaux_exceptions`, `listerExceptions`, `definirException`, `supprimerException`) existait DÉJÀ (migration 009 déjà présente), mais RIEN dans l'interface ne s'y branchait.
- **Fait** : carte "Horaires exceptionnels" ajoutée dans l'onglet "Grille horaire" de `emploi-du-temps.html` — jour concerné, créneau habituel, portée (école entière ou une classe), nouvel horaire, motif. Tableau des exceptions actives avec bouton "Rétablir".
- **Sémantique confirmée** : le jour est un JOUR DE LA SEMAINE récurrent (1-7), PAS une date calendaire précise — "le mercredi est toujours écourté", pas "ce mercredi 15 octobre seulement". Interprétation jugée cohérente avec la demande utilisateur ("un jour en particulier" = un jour de semaine spécifique, comme le mercredi).
- **Fichiers** : `emploi-du-temps.html` uniquement (backend déjà présent).
- **État** : backend testé (mercredi écourté, rétablissement, validations de jour/heure), interface construite et auditée.

### 5.19 Corrections d'interface transverses (design)
Chantier déclenché par une remarque de l'utilisateur sur un bouton "Exporter en Excel" au style natif du navigateur cassant le design.
- **Cause racine identifiée** : `theme.css` ne définit sur `.bouton` qu'une TRANSITION, pas l'apparence (fond, bordure, padding) — celle-ci était dupliquée dans le `<style>` de chaque page, et **12 pages sur 34 l'avaient tout simplement oubliée** (archives, rapports, orientation, inscriptions, messages, présences, discipline, emploi-du-temps, site-public, cours-classe-titulaire, et 2 autres).
- **Fix** : règles `:where(.bouton)`, `:where(.bouton-principal)`, etc. ajoutées dans `ui.css`. **`:where()` a une spécificité NULLE** — les 22 pages qui définissent déjà leur propre style de bouton gardent leur apparence exacte (rien n'est écrasé), seules les pages nues reçoivent le filet de sécurité. Même traitement pour les champs de saisie (`input`, `select`, `textarea`).
- **Toast (`#message-flash`)** : repositionné en `position: fixed` flottant en haut à droite, avec animation de glissement. **Bug persistant signalé deux fois par l'utilisateur** ("il faut remonter pour le voir") — cause réelle : `.contenu` porte une animation CSS (`ardoise-apparition` dans `theme.css`) qui anime `transform`, ce qui fait de `.contenu` un "bloc de confinement" pour ses descendants en `position:fixed` (piège CSS documenté). **Fix définitif** : `ui.js` réparente `#message-flash` directement sous `<body>` au chargement de CHAQUE page (placé tout en haut du fichier `ui.js`, avant tout autre code, pour garantir l'exécution même si du code plus loin dans le fichier lève une exception). `!important` ajouté par prudence sur position/top/right/z-index.
- **Flou d'arrière-plan des modales** : `backdrop-filter: blur(4px)` ajouté sur `.voile` (surcharge, même technique de spécificité).
- **Boîtes de dialogue natives remplacées** : 39 appels `confirm()` + 5 `prompt()` sur 20 pages, remplacés PROGRAMMATIQUEMENT (regex `confirm(` → `await ArdoiseUI.confirmer(`, `prompt(` → `await ArdoiseUI.demander(`) plutôt que 44 éditions manuelles. Un cas nécessitait de rendre une fonction englobante `async` (trouvé par `node --check`, qui refuse un `await` hors contexte async). Fonctions `ArdoiseUI.confirmer()`/`ArdoiseUI.demander()` ajoutées à `ui.js`, retournent des Promises, détection automatique du style "danger" (rouge) si le message contient "supprim"/"irréversible"/etc. Testé avec un DOM minimal reconstruit à la main (pas de jsdom disponible, pas de réseau pour l'installer).
- **Mode édition généralisé** : helper `ArdoiseEdition.installer()` dans `ui.js` — reproduit un pattern déjà présent dans `mon-profil.html` (bouton "Modifier" qui déverrouille les champs, "Enregistrer"/"Annuler" apparaissent). Génère lui-même les boutons, aucun HTML à ajouter dans les pages qui l'adoptent. Appliqué à `parametres.html` (3 formulaires) uniquement — PAS déployé sur les autres pages.
- **Script d'audit** (`scripts/audit-frontend.py`) : détecte identifiants fantômes (référencés en JS mais absents du HTML), fonctions "maison" jamais définies, IDs dupliqués, balises non fermées. A trouvé au moins 2 vrais bugs de ma propre main (`fermerModale('voile-classe')` alors que l'ID réel est `voile-modale-classe` ; `echapper()` non définie). A aussi produit 2 faux positifs corrigés dans le script lui-même (regex trop naïve sur les appels de méthode `Objet.methode()`, et sur les identifiants dupliqués entre HTML statique et template JS où l'un remplace l'autre via innerHTML).
- **Fichiers** : `ui.css`, `ui.js`, `scripts/audit-frontend.py`, et les 20+ pages HTML touchées par le remplacement confirm/prompt.

---

## 6. INTERFACES

### Toutes les pages (34 fichiers HTML, tous dans `Scolaire-HTML-main/`)
| Fichier | Rôle |
|---|---|
| `index.html` | Page d'accueil/atterrissage |
| `connexion.html` | Login |
| `changer-mot-de-passe.html` | Changement de mot de passe (dont provisoire) |
| `mon-profil.html` | Profil utilisateur (contient le pattern de référence du mode édition) |
| `dashboard-directeur.html` | Tableau de bord direction, widget moyenne cliquable |
| `parametres.html` | Réglages école (identité, notation, pédagogique — mode présences, seuil promotion...) |
| `classes.html` | Gestion des classes, aperçu au clic |
| `cours.html` | Catalogue des cours (avec colonne Examen configurable) |
| `cours-classe-titulaire.html` | Vue titulaire de ses cours |
| `eleves.html` | Gestion des élèves, fiche de consultation |
| `inscriptions.html` | Inscriptions par concours (chantier PAS traité en détail dans cette conversation, sauf audit initial) |
| `orientation.html` | Orientation post-primaire vers les options du secondaire (chantier PAS traité) |
| `annee-scolaire.html` | Gestion des années scolaires, périodes, promotion |
| `notes.html` | Saisie des notes |
| `bulletins.html` | Génération des bulletins de période/semestre |
| `bulletin-annuel.html` | Génération du bulletin annuel (gabarits officiels branchés ici) |
| `generateur-modeles.html` | Import/gestion de modèles de bulletins personnalisés |
| `frais-scolaires.html` | Gestion des frais, paiements, taux de change |
| `presences.html` | Appel journalier |
| `emploi-du-temps.html` | Grille horaire, horaires exceptionnels |
| `calendrier.html` | Calendrier scolaire (refonte complète) |
| `discipline.html` | Discipline (chantier PAS traité — IA/import règlement demandé, non commencé) |
| `journal.html` | Journal d'activités (chantier PAS traité en détail — l'utilisateur demande recherche + IA) |
| `rapports.html` | Rapports (effectifs, réussite, palmarès, finances, assiduité) |
| `messages.html` | Communication interne, rédaction assistée par IA |
| `archives.html` | Consultation des années clôturées, duplicatas de bulletins |
| `utilisateurs.html` | Gestion des comptes utilisateurs |
| `super-admin.html` | Console Super Admin (gestion des écoles clientes) |
| `ecole.html` | (à vérifier — probablement fiche école côté super-admin) |
| `site-public.html` | Configuration du site public de l'école |
| `espace-professeur.html`, `espace-secretaire.html`, `espace-titulaire.html` | Espaces dédiés par rôle |
| `confidentialite.html` | Page légale |

### Navigation
Menu latéral partagé (`ArdoiseRail` dans `ui.js`), avec version mobile (menu hamburger injecté automatiquement par `ui.js`). Un décorateur d'icônes (`injecterIcones()`) se ré-exécute au changement de thème.

### Composants partagés
- Toast de notification (`#message-flash`, réparé — voir 5.19)
- Modales (`.voile` / `.modale`), maintenant avec flou d'arrière-plan
- Boîtes de dialogue (`ArdoiseUI.confirmer`/`demander`, remplaçant `confirm()`/`prompt()`)
- Mode édition (`ArdoiseEdition.installer()`, déployé sur `parametres.html` seulement)

### États particuliers gérés
- Écran "aucune année scolaire active" (plusieurs pages)
- États de chargement (spinners), états vides ("aucune donnée")
- Verrouillage de champs en mode consultation vs édition (partiel, voir 5.19)

---

## 7. BACKEND — endpoints, contrôleurs, middlewares

### Montage des routes (`server.js`)
```
/auth, /admin/ecoles, /utilisateurs, /eleves, /notes, /travaux, /bulletins,
/jobs, /abonnements, /evenements (calendrier), /dashboard, /modeles-bulletins,
/journal-activite, /notifications, /frais, /promotion, /uploads, /ecole
(paramètres), /mentions, /paiements, /presences, /emploi-du-temps, /public,
/site-public, /discipline, /archives, /rapports, /communication, /ia,
/whatsapp, /inscriptions, /orientation, / (structure : /annees-scolaires,
/options, /classes, /cours, /classe-cours)
```

### Middlewares (ordre d'application global)
`helmet` → `cors` → `morgan` (logs) → rate-limit général → `express.json` → routes `/auth` (sans authMiddleware) → **middleware d'authentification global appliqué après `/auth`** → toutes les autres routes.

Chaque module de routes applique en plus, localement : `requireRole(...)`, parfois `mot-de-passe-provisoire.middleware.js`, `bulletins-permission.middleware.js` (spécifique aux bulletins, autorise les titulaires selon un réglage école).

### Endpoints ajoutés ou modifiés pendant cette conversation (liste consolidée)
- `POST /notes/recalculer` (nouveau)
- `GET /evenements/mois`, `/evenements/jour`, `/evenements/periode-courante`, `/evenements/jours-speciaux` (GET/POST/DELETE) (nouveaux)
- `POST /jobs/calendrier` (nouveau)
- `GET /rapports/moyennes`, `GET /rapports/portees` (nouveaux)
- `GET /modeles-bulletins/:id/apercu` (nouveau)
- `GET /classes/:classe_id/apercu` (existant, découvert — pas créé par moi dans cette session, mais nettoyé d'un doublon)
- `PUT /emploi-du-temps/exceptions`, `GET /emploi-du-temps/exceptions`, `DELETE /emploi-du-temps/exceptions/:id` (existants, découverts — interface branchée par moi)
- Modifications de comportement (pas de nouvelle route mais logique changée) : `POST /presences/classe/:classeId` (3 modes), `PATCH /ecole/moi` (mode_presences, commune), `POST /bulletins/classe/:classeId/imprimer` (revenu au comportement d'origine après erreur de branchement), `GET /bulletins/annuel/classe/:classeId/imprimer` (gabarits officiels branchés ici), `POST /eleves`, `PATCH /eleves/:id` (nouveaux champs), `POST /classes`, `PATCH /classes/:id` (niveau/division/socle primaire automatique), `POST /promotion/executer` (garde-fous option/cycle), `GET /modeles-bulletins` (filtrage par type_enseignement).

### Gestion des erreurs
Convention systématique dans tous les contrôleurs touchés : `try/catch`, si `err.statusCode` existe (erreur métier volontaire, levée via `Object.assign(new Error(...), { statusCode: XXX })`) → renvoyer ce code avec le message ; sinon → `console.error` + 500 générique "Erreur serveur.". **Piège récurrent identifié plusieurs fois** : un `catch` qui ne teste PAS `err.statusCode` transforme silencieusement une erreur métier volontaire (403/409/400) en 500 générique — corrigé à chaque fois qu'observé, mais probablement pas exhaustivement partout dans le code NON touché par cette conversation.

---

## 8. FRONTEND — organisation

Pas de composants au sens framework (pas de React). "Composants" = fonctions JS réutilisées PAR COPIER-COLLER dans chaque page (limite architecturale connue et assumée du projet). Les tentatives de mutualisation se sont concentrées sur `ui.js`/`ui.css`, avec des techniques qui NE MODIFIENT PAS les pages existantes :
- Spécificité CSS nulle (`:where()`) pour ne rien écraser.
- Réparation DOM au chargement (réparentage de `#message-flash`).
- Fonctions globales exposées (`ArdoiseUI.confirmer`, `ArdoiseEdition.installer`) que les pages APPELLENT mais qui ne nécessitent aucune modification de structure HTML.

Pas de state management (pas de Redux équivalent) — chaque page gère son propre état en variables JS locales dans son `<script>`. Formulaires gérés à la main (lecture directe de `document.getElementById(...).value`, pas de bibliothèque de formulaires).

**Aucune optimisation de performance frontend spécifique** n'a été appliquée dans cette conversation (pas de lazy loading, pas de bundling — chaque page charge son JS inline).

---

## 9. CALCULS MÉTIER — TOUTES LES FORMULES

### 9.1 Barème du secondaire (par cours)
```
maximum_examen = cours.maximum_examen ?? (maximum_periode × 2)   // NULL = défaut 2×
maximum_examen = 0  →  branche non examinée, case noircie

tot1 (semestre 1) = P1 + P2 + Examen1        (null si les 3 absents)
tot2 (semestre 2) = P3 + P4 + Examen2
T.G. (total général, semestre) = tot1 + tot2
Maximum semestre  = 2×maxPeriode + maxExamen
Maximum T.G.      = 2 × Maximum semestre
```
**Règle de nullité** : si AUCUNE composante n'existe → résultat NULL (case vide). Si AU MOINS UNE existe → somme en traitant les manquantes comme 0.

### 9.2 Pourcentage (partout dans l'application)
```
pourcentage = (total_obtenu / total_des_maxima) × 100
```
**JAMAIS** une moyenne de pourcentages (`AVG(pourcentage)`). C'est l'erreur de méthode trouvée et corrigée À TROIS ENDROITS DIFFÉRENTS dans le code (recalculerClassement, recalculerBulletinSemestre, moyenne du tableau de bord/palmarès). **Si le prochain assistant trouve un `AVG(pourcentage)` ou `AVG(b.pourcentage)` n'importe où ailleurs dans le code, c'est très probablement le même bug non encore corrigé.**

### 9.3 Classement
Rang = position après tri décroissant sur la valeur de la colonne concernée, égalité départagée par `nom, postnom, prenom` (ordre alphabétique). Un élève sans valeur sur la colonne N'EST PAS CLASSÉ (pas de rang factice).
**Chaque colonne a son propre classement** (P1, P2, examen, total semestre, T.G. — 9 classements distincts sur un bulletin de secondaire), PAS un classement global unique.

### 9.4 Socle du primaire
Somme des maxima des 23 branches officielles = **300** (vérifié programmatiquement au chargement du module `cours-primaire-officiels.js` — lève une exception si la somme diverge). Sous-totaux par domaine, vérifiés contre les photos : Langues congolaises 60, Français 60, Mathématiques/Sciences/Technologie 100, Univers social 30, Arts 20, Développement personnel 30.

Grille primaire : 3 trimestres × (2 périodes + 1 examen) = 6 périodes de travail + 3 examens par cours sur l'année.

### 9.5 Devises
```
convertir(montant, deviseSource, deviseCible, taux) :
  si deviseSource === deviseCible → montant inchangé
  si USD → FC : montant × taux
  si FC → USD : montant / taux
```
Le taux utilisé est TOUJOURS celui FIGÉ au moment de la transaction (`paiements_frais.taux_change`), jamais le taux courant de l'école (sauf absence de taux figé, repli sur le taux courant).

### 9.6 Promotion — recherche de classe cible
```
classes cibles = classes WHERE niveau = niveau_source + 1
                          AND option_id = option_id_source (ou les deux NULL)
                          AND cycle = cycle_source
                          AND annee_scolaire_id = annee_cible
Répartition : remplir par ordre de division (A, B, C...) jusqu'à capacité, puis suivante.
```

### 9.7 Jour ouvrable (calendrier)
```
ouvrable = date DANS [annee.date_debut, annee.date_fin]
       ET numeroJourSemaine(date) DANS ecoles.jours_cours
       ET AUCUN jours_speciaux ne couvre cette date (pour ce cycle ou NULL)
```

### 9.8 Moyenne générale d'école (tableau de bord / rapports)
```
Pour chaque élève : moyenne_élève = AVG(bulletins.pourcentage) sur la portée choisie
Moyenne d'école = AVG(moyenne_élève) sur tous les élèves   ← PAS AVG direct sur tous les bulletins
```

### 9.9 Palmarès
```
SELECT DISTINCT ON (eleve_id) ... ORDER BY eleve_id, pourcentage DESC
puis tri global par pourcentage DESC, LIMIT n
```
Garantit qu'un élève n'apparaît qu'une fois, avec son MEILLEUR résultat sur la portée.

---


### 9 bis. RÈGLE DE CALCUL DES MOYENNES — corrigée

**Ne jamais lire `bulletins.pourcentage` pour un rapport.** C'est une valeur
matérialisée : elle n'existe que si un bulletin a été généré, et les bulletins
antérieurs au correctif du dénominateur portent encore un pourcentage faux.

La règle appliquée, dans `utils/moyennes.utils.js` (source unique, utilisée par
les rapports ET le tableau de bord) :

```
pourcentage = total obtenu / total des maxima × 100
```

- Le dénominateur est le total des maxima de **TOUS les cours de la classe**
  pour la période — pas seulement de ceux où une cote existe. Un cours non noté
  compte pour zéro.
  *Exemple :* classe à 3 cours de 20 points. Un élève noté 18 + 16 avec un
  troisième cours non noté vaut 34/60 = 56,7 %, et non 34/40 = 85 %.
- Sur une période d'**examen**, le maximum d'un cours est `maximum_examen`, pas
  `maximum_points`. Un cours sans maximum d'examen ne compte ni au numérateur ni
  au dénominateur.
- Sur **plusieurs périodes** (dont l'année entière) : on additionne les totaux et
  les maxima. On ne fait JAMAIS la moyenne des pourcentages de période — des
  barèmes différents n'ont pas le même poids.
- Une période n'entre dans le dénominateur d'un élève que s'il y a **au moins
  une note à son nom** sur cette période. Sans cela, un élève arrivé en février
  serait noté sur toute l'année.

`GET /rapports/reussite` et `GET /rapports/moyennes` partagent désormais cette
fonction. Ils divergeaient auparavant : deux écrans côte à côte donnaient deux
chiffres différents sur les mêmes élèves.



### 9 ter. RÈGLE MÉTIER DES INSCRIPTIONS — l'année d'entrée

Un concours d'admission recrute pour l'**année suivante**. L'enchaînement réel
d'une école est :

1. la promotion sortante quitte la classe ;
2. la promotion montante y arrive (promotion interne) ;
3. les places **restantes** sont offertes aux candidats extérieurs.

D'où deux colonnes distinctes sur `sessions_inscription` :

- `annee_scolaire_id` → année pendant laquelle le concours est **organisé** ;
- `annee_cible_id` → année pendant laquelle les admis **entreront**.

Conséquences appliquées dans le code :

- Les classes d'accueil doivent appartenir à l'année d'entrée. Le serveur refuse
  toute autre classe, avec un message qui nomme la classe fautive et son année.
- L'année d'entrée par défaut est l'année suivante, déterminée par
  **`date_debut`** et non par le libellé (les conventions de libellé varient).
- S'il n'existe aucune année suivante, on **refuse** au lieu de retomber sur
  l'année en cours : inscrire quelqu'un au milieu d'une année commencée est une
  décision du directeur, pas un défaut technique. Il peut la prendre en
  choisissant explicitement l'année d'entrée.
- Les places affichées sont les places **restantes** (capacité − effectif déjà
  monté), jamais la capacité brute.
- La conversion des admis en élèves revérifie la cohérence : c'est le seul acte
  irréversible du module.


## 10. DÉCISIONS IMPORTANTES PRISES DURANT CETTE CONVERSATION

1. **RLS plutôt que filtrage applicatif seul** — décision antérieure au projet original, confirmée et étendue à chaque nouvelle table créée. Alternative rejetée : filtrer uniquement `WHERE ecole_id = ?` dans chaque requête (fragile, une seule requête oubliée = fuite de données).

2. **Modèles officiels par variante (`primaire`/`secondaire`/`terminale`) plutôt qu'un système générique unique** — parce que les trois documents ont des structures FONDAMENTALEMENT différentes (domaines vs. cours plats, présence ou non du bloc Examen d'État). Alternative rejetée : un seul gabarit paramétrable — aurait produit un code illisible avec des branches conditionnelles partout.

3. **La maquette importée par une école n'est JAMAIS utilisée comme fond d'image** — sur demande explicite de l'utilisateur : l'IA doit comprendre la structure de la maquette puis régénérer un gabarit ENTIÈREMENT VIDE, pour que les données réelles de l'école (et seulement elles) remplissent le document. Alternative rejetée (et présente dans le code d'origine) : zones positionnées par-dessus l'image importée — rejetée car un élève sans tel cours verrait quand même le libellé imprimé sur l'image.

4. **Le pivot de l'année scolaire est une contrainte DE BASE (index unique + CHECK), pas seulement applicative** — pour qu'aucun bug futur, même non anticipé, ne puisse recréer l'état incohérent (deux années actives) qui causait le bug originel des notes qui "reviennent".

5. **Taux de change jamais rétroactif, toujours figé à la transaction** — compromis : l'école ne peut pas "corriger" a posteriori un ancien reçu si elle se trompe de taux, mais garantit que l'historique financier ne bouge jamais sous les pieds de quelqu'un.

6. **Comptable seul exempté du cantonnement à l'année active** — pour les dettes antérieures uniquement. Alternative rejetée : ouvrir l'accès aux années passées à tout le monde (directeur inclus) — rejetée car c'était la cause du bug initial.

7. **`niveau`/`division` en plus de (et pas à la place de) `classe_suivante_id`** — compromis pour ne pas casser les écoles qui n'auraient pas encore renseigné le niveau de leurs classes. `classe_suivante_id` reste une "échappatoire" explicite.

8. **Recalcul des bulletins fait en JavaScript applicatif, pas en trigger PostgreSQL** — plus facile à corriger/déboguer/tester par simulation dans cet environnement sans accès direct à une vraie base. Compromis : le recalcul n'est PAS automatique en base, il faut se souvenir de l'appeler à chaque point d'écriture de notes (risque de bug si un futur point d'écriture oublie l'appel — DÉJÀ ARRIVÉ deux fois dans cette conversation).

9. **`:where()` pour les correctifs CSS globaux plutôt que d'éditer chaque page** — pour garantir zéro régression sur les 22 pages déjà stylées, au prix d'un correctif "invisible" qui peut sembler redondant si on ne connaît pas la spécificité CSS.

10. **Remplacement programmatique (regex) de `confirm()`/`prompt()` plutôt que 44 éditions manuelles** — plus rapide et surtout plus FIABLE qu'une série d'éditions manuelles sur 20 fichiers (moins de risque d'en oublier un ou de mal transcrire un message).

11. **Le calendrier est traité comme le SOCLE et construit AVANT présences/tableau de bord**, sur la base d'une remarque explicite de l'utilisateur ("il faut déjà penser à un mécanisme qui détermine la période en cours"). Ordre de dépendance respecté délibérément.

12. **Deux rôles ajoutés à l'ENUM en une seule migration (`charge_presences` + `directeur_discipline`)** même si un seul était nécessaire dans l'immédiat — parce que `ALTER TYPE ... ADD VALUE` sur un ENUM PostgreSQL est irréversible (il faut recréer tout le type pour en retirer une valeur), donc autant grouper les ajouts prévisibles.

---

## 11. BUGS CONNUS

### 11.1 Résolus pendant cette conversation
- Pourcentage calculé sur dénominateur partiel (seuls les cours notés) au lieu du total de la classe — **résolu**, `notes.controller.js`.
- `bulletins.pourcentage` non recalculé à l'enregistrement simple des notes — **résolu**, mais nécessite `POST /notes/recalculer` pour rattraper les bulletins déjà générés AVANT le fix.
- Palmarès/réussite comptant un élève plusieurs fois — **résolu**.
- Moyenne pondérée par nombre de bulletins plutôt que par élève — **résolu**.
- Toast invisible sans défilement — **résolu** (réparentage DOM).
- Boutons/champs sans style sur 12 pages — **résolu** (`:where()`).
- Confirm/prompt natifs cassant le design — **résolu** (44 remplacements).
- Migration 003 : erreur de cast entre deux ENUM PostgreSQL distincts (`type_enseignement` vs `cycle_enseignement`) — **résolu** après retour utilisateur en production.
- Gabarits officiels branchés sur le mauvais endpoint (période au lieu d'annuel) — **résolu** après retour utilisateur en production (erreur 500 `column c.modele_periode_id does not exist`, migration non jouée + mauvais branchement combinés).
- Route présences trop restrictive empêchant le mode "professeur" de fonctionner — **résolu**.
- Fonction `apercuClasse` dupliquée par ma propre erreur — **résolu** (suppression du doublon).

### 11.2 NON résolus / connus mais pas corrigés
- **Aucune migration n'a jamais été testée contre une vraie base PostgreSQL** dans cet environnement (pas d'accès réseau). Chaque migration a été relue et son SQL simulé mentalement, mais PAS EXÉCUTÉE avant livraison. Risque non nul d'autres erreurs de syntaxe/type similaires à celle de la migration 003.
- **`listerVacations`, `listerOptions`, `listerCours`** (dans `structure.controller.js`) ne filtrent PAS par `type_enseignement` — fuite potentielle mineure de l'étanchéité primaire/secondaire (section 5.13), non corrigée faute de temps/priorité jugée basse.
- **Le niveau des classes existantes reste NULL** après la migration 005 — la promotion moderne (par niveau/option) ne s'active que si le directeur renseigne manuellement `niveau` sur chaque classe. Pas de script de migration automatique des données existantes (jugé trop risqué de deviner depuis le nom).
- **Un ancien mécanisme laisse des fichiers `.template.js` dans `middleware/`** (`bulletin-annuel-template.js`, `bulletin-personnalise-template.js`, `bulletin-semestre-template.js`, `bulletin-template.js`, datés du 29 juillet, donc antérieurs à cette conversation) — **fichiers MORTS, non référencés par aucun `require()`**, probablement une erreur de placement dans le dépôt ORIGINAL (avant cette conversation). Sans danger mais à nettoyer.
- **Fidélité visuelle des gabarits de bulletins jamais vérifiée par moi** (capacité d'affichage d'images épuisée en cours de conversation) — reconstruits par une autre instance (Opus) dans une conversation séparée, puis intégrés sans relecture visuelle de ma part.
- **Le mode édition (`ArdoiseEdition`) n'est déployé que sur `parametres.html`** — les autres pages avec formulaires de réglages permanents n'ont pas été traitées (l'utilisateur a validé le principe sur cette page avant de passer à autre chose).

### 11.3 Origine générale des bugs rencontrés
La majorité provient de trois sources récurrentes : (a) confusion entre deux types PostgreSQL similaires mais distincts, (b) une valeur MATÉRIALISÉE en base qui n'est pas recalculée à tous les points d'écriture, (c) du code frontend dupliqué page par page où un oubli sur une seule page passe inaperçu jusqu'à ce qu'un audit systématique le trouve.

---

## 11 bis. SESSION DE MAINTENANCE — lots 1 à 9

> Ajoutée après la conversation d'origine. Cette session a repris le projet à
> partir de ce handover et l'a corrigé sur plusieurs points où il se trompait.

### Ce que ce handover affirmait à tort

Trois erreurs de ce document ont été constatées en lisant le code réel. Elles
sont conservées ici plutôt que corrigées en silence : elles indiquent le TYPE
d'erreur qu'un assistant commet sur ce projet.

1. « Chantier discipline — PAS COMMENCÉ ». En réalité le contrôleur faisait
   433 lignes. Il plantait systématiquement (voir ci-dessous), ce qui a
   probablement été confondu avec une absence.
2. « Le mécanisme backend des horaires exceptionnels existait DÉJÀ (migration
   009) ». Faux : `creneaux_exceptions` n'apparaissait dans AUCUN fichier `.js`,
   la table n'existait pas, les routes n'étaient pas montées. L'interface
   appelait trois endpoints qui renvoyaient 404. Le backend a été écrit de zéro.
3. Le point 2 de la liste utilisateur (inscriptions) était décrit comme « audité
   mais pas retravaillé » ; l'audit lui-même avait manqué le défaut principal
   (année d'entrée, voir plus bas).

### Migrations ajoutées (010 à 015)

| # | Objet | Pourquoi |
|---|---|---|
| 010 | `incidents_discipline.sens` | Colonne écrite et relue par le code, jamais créée. Tout signalement renvoyait 500. |
| 011 | `creneaux_exceptions` | Table inexistante, interface pourtant complète. |
| 012 | Index de `journal_activite` | Le volume change d'ordre de grandeur avec la journalisation automatique. |
| 013 | `options.critere_*` | Critères d'admission par option (orientation). |
| 014 | `reglements_discipline`, `regles_discipline` | Barème propre à chaque école. |
| 015 | `sessions_inscription.annee_cible_id` | Année d'ENTRÉE des candidats, distincte de l'année d'organisation. |

**Piège rencontré sur la 014 :** `ANALYSE` est un mot **pleinement réservé** de
PostgreSQL (orthographe britannique d'`ANALYZE`). La colonne `analyse` a dû être
renommée `analyse_ia`. Les cinq migrations ont ensuite été passées au crible de
la liste des mots réservés : c'était le seul cas.

### Corrections de fond

- **Discipline** : colonne `sens` manquante, faits positifs absents de la liste
  des types acceptés (le groupe « Faits à valoriser » de l'écran sortait donc
  toujours vide), rôle `directeur_discipline` cité nulle part dans le code.
  Écran et bulletin appliquaient deux formules différentes de capital de
  conduite : un élève félicité voyait sa conduite BAISSER.
- **Orientation** : faille de permission — un titulaire pouvait lire et
  réécrire les vœux de TOUTES les classes d'orientation de l'école.
- **Inscriptions** : la direction voyait toutes les copies à tout moment et
  pouvait saisir n'importe quelle note. Désormais aucun accès avant publication,
  lecture seule après, et jamais de saisie sans être correcteur désigné.
- **Rapports et tableau de bord** : voir section 9 bis.
- **Tableau de bord** : `dashboard-directeur.html` ne définissait AUCUN style
  `.voile` / `.modale`. `ui.css` ne surcharge que l'apparence, jamais le
  `display`. La modale était donc rendue en permanence dans le flux de la page,
  dès la connexion.

### Ajouts

- Journalisation **automatique** de toutes les écritures via
  `middleware/journal.middleware.js`, monté avant `/auth` pour couvrir les
  connexions. Les 16 appels manuels dispersés restent en place (ils portent un
  sens métier) et se distinguent par `metadata.source`.
- Recherche assistée du journal : l'IA traduit la question en **filtres**, pas
  en SQL. Aucune donnée d'école ne part à l'interprétation ; la synthèse ne voit
  ni `metadata`, ni identifiants, ni emails.
- Règlement intérieur importable (`.docx` lu sans dépendance npm, via `zlib` ;
  PDF explicitement refusé avec message clair).
- Assistant d'utilisation ouvert à TOUS les rôles — possible uniquement parce
  qu'il n'a accès à aucune donnée.
- Didacticiel d'installation sur chaque page (`didacticiel.js`, fichier unique
  partagé, installé par `installer-didacticiel.py`).


### Lots 8 et 9 — suite de la session

**Lot 8 — widget de moyenne du tableau de bord.**
Trois causes distinctes, découvertes l'une après l'autre :
1. `dashboard-directeur.html` ne définissait aucun style `.voile` / `.modale`.
   `ui.css` ne surcharge que l'APPARENCE du voile, jamais son `display` ni son
   `position` — ces règles vivent dans le `<style>` de chaque page. La modale
   était donc rendue en permanence dans le flux de la page.
2. Le gestionnaire de clic commençait par `if (porteesMoyenne.length === 0) return;`
   — un échec de `/rapports/portees` au chargement condamnait le widget pour
   toute la session, en silence.
3. La carte lisait `AVG(bulletins.pourcentage)` pendant que la fenêtre calculait
   depuis les notes : deux chiffres différents à un clic d'écart.

Le widget est désormais **autonome** : chargement paresseux au clic, source de
secours via `/structure/periodes`, et affichage du code HTTP en cas d'échec.

**Lot 9 — cohérence manuel ↔ plateforme.**
- `devise_principale` et `taux_change_usd_fc` existaient en base depuis la
  migration 001 et étaient LUES par `devise.utils.js`, mais **aucun endpoint ni
  écran ne les écrivait**. Écran ajouté dans Paramètres, avec date et auteur de
  la dernière mise à jour, alerte au-delà de 30 jours, et garde-fou de saisie
  (100 à 100 000 FC pour 1 USD).
- `directeur_discipline` était absent de trois endroits : cases à cocher, filtre
  de recherche, et validation de l'import Excel — qui rejetait aussi
  `comptable`.
- **La cote appartient à l'enseignant.** `professeurEstAutorise()` accordait un
  passe-droit total au directeur et au préfet : supprimé. Ils conservent
  valider / dévalider / (bientôt) clôturer — le processus, pas le contenu. Un
  membre de la direction affecté dans `enseignant_cours` saisit normalement :
  c'est sa qualité d'enseignant qui l'autorise, pas son grade.
- Le contournement du **verrou de validation** dont bénéficiait la direction est
  supprimé : toute intervention sur une note validée passe par un
  déverrouillage tracé.
- `GET /orientation/acces` + contrôle dans `ui.js` : le menu Orientation est
  masqué pour un titulaire sans classe d'orientation. En cas d'échec de l'appel,
  le menu RESTE affiché.
- Assistant : code HTTP affiché en cas d'échec, écran d'origine transmis
  (`?assistant=1&ecran=…`), bascule d'onglet rejouée après 300 ms.

### Dette structurelle identifiée

**`ACCES_PAGES` est dupliqué dans les 38 pages HTML.** Chaque page contient sa
propre carte « page → rôles autorisés ». Toute évolution de droits demande 38
modifications cohérentes, et rien ne garantit qu'elles le restent. À
centraliser dans `ui.js`.

### Méthode : angle mort constaté

`node --check` ne vérifie que la syntaxe. Il ne détecte pas un export oublié ni
un `require` vers une fonction inexistante — j'ai livré au lot 6 un
`dashboard.controller.js` important `pourcentagesParEleve` depuis
`rapports.controller.js`, qui ne l'exportait pas. Un vrai chargement des modules
(`require()`) attraperait cette catégorie ; il est impossible dans un
environnement sans `npm install`. **À faire côté développeur avant chaque
déploiement.**

### Documentation vivante

`utils/connaissance.utils.js` est la **source unique** du guide de
configuration, des sept manuels de rôle et de la consigne de l'assistant IA.
Toute modification de procédure doit passer par ce fichier, puis régénérer les
documents. Écrire la même chose à deux endroits garantit qu'ils divergent.

---

## 11 ter. SESSION DE MAINTENANCE — lots 10 à 17 et dettes

> Suite de la §11 bis. **Tous les chantiers demandés sont terminés.**

### Migrations ajoutées (016 à 019)

| # | Objet |
|---|---|
| 016 | Reconduction annuelle, clôture de période, classes terminales, seuils, motifs de sortie |
| 017 | Comptabilité : caisse, catégories, contrats, paie · `paiements_frais.frais_id` |
| 018 | `notifications.expediteur_id` |
| 019 | Examen de repêchage |

### Défauts graves trouvés dans l'existant

Aucun de ces défauts n'avait été signalé : ils ont été découverts en lisant le
code pour autre chose.

1. **`LIMIT 1` sur `frais_scolaires`, à quatre endroits.** La table porte une
   colonne `libelle` : une école déclarant inscription + minerval + laboratoire
   ne voyait **qu'une seule ligne comptée**. Conséquence en chaîne : les
   familles étaient déclarées à jour, et le blocage de bulletin pour impayé ne
   bloquait personne. Règle appliquée désormais : somme de toutes les lignes,
   **une par libellé**, la ligne propre à la classe remplaçant la générale du
   même nom (`utils/frais.utils.js`).
2. **Le report de structure annuelle perdait six attributs de classe**, dont
   `niveau` et `division` — sans lesquels la promotion ne trouve aucune classe
   supérieure et refuse de s'exécuter. Le directeur le découvrait en juin.
   `maximum_examen_override` était perdu aussi, et l'emploi du temps n'était pas
   reporté du tout.
3. **`suggererZones` exigeait `ANTHROPIC_API_KEY`** alors que tout le reste
   utilise `OPENAI_API_KEY`. Une école dont l'assistant fonctionnait se voyait
   répondre « non configuré ». Les deux fournisseurs sont acceptés désormais.
4. **`statsGlobales` refusait tout le récapitulatif** si un seul paiement
   n'était pas convertible : les trois cases du directeur restaient vides, sans
   message. On calcule et on signale, au lieu de refuser.
5. **Le tableau de bord se contredisait** : la carte lisait
   `AVG(bulletins.pourcentage)` pendant que la fenêtre calculait depuis les
   notes.

### Trois doublons évités de justesse

**J'ai failli livrer trois fois du code qui existait déjà** :

| Chantier | Ce qui existait |
|---|---|
| Reconduction annuelle | `reporterStructureAnnee` (structure.controller) |
| Import IA des modèles | `suggererZones` (modeles-bulletins.controller) |
| Écrans du règlement de discipline | livrés au lot 3, jamais déployés |

**Le réflexe correct sur cette base de code est de chercher avant d'écrire,
systématiquement.** Le handover d'origine le disait déjà ; l'avoir lu ne suffit
pas.

### Dettes structurelles résorbées

- **`ACCES_PAGES` était dupliqué dans 30 pages.** Les 30 copies ont été
  comparées (29 entrées, 0 divergence) avant fusion dans `ui.js`
  (`ArdoiseAcces`). Le filtrage s'exécute depuis `ui.js` et non depuis les
  pages : 26 d'entre elles chargent `ui.js` APRÈS leur propre script.
- **Les styles de modale étaient recopiés page par page**, et quatre pages les
  avaient perdus — même bug rattrapé quatre fois (lots 8, 10, 11). La
  **mécanique** (`position`, `display`, `.visible`) est désormais imposée par
  `ui.css` ; l'**apparence** (largeur, marge) reste aux pages, via `:where()`
  dont la spécificité nulle laisse toute règle de page l'emporter.

### Responsive

L'application était structurellement responsive. La vraie cause était
`.conteneur-tableau table { min-width: 560px }` : **tous** les tableaux
imposaient un défilement horizontal. Sous 700 px, chaque ligne devient une
**carte** et chaque cellule une ligne « intitulé → valeur » (`ui.js` pose
`data-libelle`, `ui.css` l'affiche). S'applique à tous les tableaux existants
et à venir.

### Outils d'audit livrés

- `audit-frontend.py` — cohérence fonctionnelle des pages (existait déjà)
- `audit-responsive.py` — causes mesurables de non-responsivité (**nouveau**)
- `test/` — 441 vérifications par simulation, 12 fichiers

---

## 12. TODO — AVANT MISE EN PRODUCTION

> **Tous les chantiers fonctionnels sont terminés.** Ce qui suit n'est plus une
> feuille de route mais une liste de contrôle avant production.

### Décisions arbitrées par le propriétaire — NE PAS REPOSER LA QUESTION

| Sujet | Décision |
|---|---|
| Classes permanentes | Voie 1 : reconduction assistée. Le schéma reste annuel, `reporterStructureAnnee` recopie tout. |
| Examen de repêchage | Critères **configurables par école** — ils relèvent du règlement interne. Défauts : échec < 50 %, 3 cours max, moyenne 40–50 %, note plafonnée, mention refusée. |
| Import des modèles de bulletins | Tous formats. En pratique : image lue visuellement, PDF si clé Anthropic, Word/Excel sans mise en page. |

### À faire, dans l'ordre

1. **Jouer les migrations 001 à 019**, sur une COPIE d'abord, puis en
   production avec sauvegarde. Exécuter les requêtes de contrôle en fin de
   chaque fichier.
   *Aucune migration n'a jamais été exécutée contre une vraie base par un
   assistant : pas de réseau. Le cas `ANALYSE` (mot réservé PostgreSQL,
   migration 014) l'a démontré.*
2. **`npm install`, puis charger réellement chaque module** :
   `node -e "require('./controllers/repechage.controller')"` pour chacun.
   `node --check` ne vérifie que la syntaxe — il ne détecte ni un export
   oublié, ni un `require` vers une fonction inexistante. Cette erreur a été
   commise une fois (lot 6).
3. **Déployer `ui.js` et `ui.css` AVANT** de lancer
   `nettoyer-cartes-droits.py`, sinon les pages se retrouvent sans filtrage de
   navigation.
4. **`POST /notes/recalculer`** sur chaque (classe, période) notée avant le
   correctif du dénominateur.
5. **Configurer avant usage** : devise et taux de change · catégories
   comptables (valeurs de départ en fin de migration 017) · seuils de
   promotion et de redoublement · `niveau` et `division` sur les classes
   existantes · règlement de discipline.
6. **Reprendre les sessions d'inscription** créées avant la migration 015 : la
   requête de contrôle en fin de fichier liste celles à revoir.

### Angles morts — personne n'a vérifié

- **Le rendu des bulletins dans un navigateur.** Seul endroit du projet où ni
  le propriétaire ni aucun assistant n'a jamais regardé le résultat.
- **Le rendu mobile sur un appareil réel.** Les corrections du lot 16 portent
  sur des causes mesurées dans le code, pas sur un rendu observé.
- **Les appels IA en conditions réelles.** Tous les tests remplacent l'IA par
  des réponses factices : ils vérifient le code, pas le modèle.

### Restant, sans urgence

- Export comptable (PDF, Excel) pour un contrôle externe.
- Le tableau d'avancement du tableau de bord pourrait renvoyer directement vers
  la saisie concernée.
- Les écrans cibles de la navigation contextuelle **surlignent** mais ne
  **filtrent** pas.
- Nettoyer `middleware/*.template.js`.
- `audit-frontend.py` ne contrôle pas le JavaScript inline : il faut extraire
  le plus gros bloc `<script>` et lancer `node --check` à la main.

### Non fait volontairement

`listerOptions` et `listerCours` ne sont pas filtrés par `type_enseignement` :
ces tables n'ont aucune colonne de cycle, tout filtre serait une devinette et
masquerait des données que l'école ne pourrait plus corriger.

---

## 13. FICHIERS IMPORTANTS

| Fichier | Rôle |
|---|---|
| `server.js` | Point d'entrée, montage de toutes les routes |
| `config/db.js` | Pool PostgreSQL, `runWithTenant()` (RLS), harnais IA lecture seule |
| `utils/annee.utils.js` | Résolution de l'année scolaire active, garde-fous d'accès |
| `utils/devise.utils.js` | Conversion FC/USD, formatage montants |
| `utils/calendrier.utils.js` | Jour ouvrable, période courante — SOCLE de plusieurs modules |
| `utils/notification.utils.js` | Création de notifications avec déduplication |
| `utils/bulletin-assemblage-officiel.js` | Transforme les notes brutes en grille de bulletin |
| `utils/bulletin-secondaire-rdc.template.js`, `bulletin-primaire-rdc.template.js`, `bulletin-examen-etat.template.js` | Gabarits HTML des bulletins officiels |
| `utils/cours-primaire-officiels.js` | Socle des 23 branches du primaire, avec vérification d'intégrité au chargement |
| `utils/drapeau-rdc.svg.js`, `armoiries-rdc.asset.js` | Assets visuels des bulletins |
| `controllers/structure.controller.js` | Classes, cours, années, périodes — LE plus gros contrôleur |
| `controllers/notes.controller.js` | Saisie de notes, recalcul des classements |
| `controllers/bulletin-annuel.controller.js` | Génération PDF du bulletin annuel (gabarits officiels branchés ici) |
| `controllers/bulletins.controller.js` | Génération PDF du bulletin de période (gabarit générique, PAS les officiels) |
| `controllers/presences.controller.js` | Logique des 3 modes de présence |
| `controllers/calendrier.controller.js` | Vue mensuelle, jours spéciaux, période courante |
| `controllers/rapports.controller.js` | Palmarès, réussite, moyennes, portées |
| `controllers/jobs.controller.js` | Tâches planifiées (abonnements, calendrier) |
| `Scolaire-HTML-main/ui.js` | Helpers JS partagés (réparation DOM, boîtes de dialogue, mode édition) |
| `Scolaire-HTML-main/ui.css` | Styles partagés (toast, flou, filet de sécurité boutons) |
| `Scolaire-HTML-main/scripts/audit-frontend.py` | Audit statique des 34 pages |
| `migrations/001-*.sql` à `009-*.sql` | Toutes les évolutions de schéma de cette conversation, DANS L'ORDRE |

---

## 14. VARIABLES D'ENVIRONNEMENT

| Variable | Usage |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL (Supabase), SSL requis |
| `SUPABASE_URL` | URL du projet Supabase (pour le Storage) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service pour Supabase Storage |
| `JWT_ACCESS_SECRET` | Signature des access tokens JWT |
| `JWT_REFRESH_SECRET` | Utilisé pour le mécanisme de refresh (à vérifier précisément dans le code — le refresh token lui-même est un hash opaque, pas un JWT) |
| `JWT_ACCESS_EXPIRES` | Durée de vie de l'access token (défaut 15m) |
| `JWT_REFRESH_EXPIRES_DAYS` | Durée de vie du refresh token |
| `PORT` | Port d'écoute du serveur Express |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | Compte super admin initial (scripts/seed) |
| `CRON_SECRET` | Secret partagé pour `/jobs/*` (pas de JWT, appel externe par planificateur) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Envoi d'emails |
| `PAWAPAY_API_TOKEN`, `PAWAPAY_BASE_URL` | Paiements mobile money |

---

## 15. DÉPLOIEMENT

- **Backend** : hébergé sur Render (URL confirmée dans le frontend : `https://scolaire-saas-backend.onrender.com`). Le suspend automatique des exports selon le plan Render peut expliquer une latence au réveil (non vérifié dans cette conversation, mention pour information).
- **Base de données** : Supabase (PostgreSQL managé + Storage).
- **Frontend** : fichiers HTML statiques (`Scolaire-HTML-main/`), PWA — hébergement non précisé explicitement dans cette conversation, probablement un simple hébergement de fichiers statiques.
- **Migrations** : PAS automatisées — fichiers SQL à copier-coller manuellement dans l'éditeur SQL de Supabase, dans l'ordre numérique (001 à 009), en respectant scrupuleusement l'ordre car chaque migration suppose que les précédentes sont déjà appliquées.
- **CI/CD** : aucun pipeline automatisé mentionné ou construit dans cette conversation — déploiement manuel présumé (push vers Render).
- **Cron** : deux jobs à déclencher via un planificateur EXTERNE (type cron-job.org), car aucun scheduler interne à Node n'a été mis en place :
  - `POST /jobs/abonnements` (pré-existant)
  - `POST /jobs/calendrier` (nouveau, quotidien recommandé) — les deux protégés par le header `x-cron-secret` devant correspondre à `CRON_SECRET`.

---

## 16. PERFORMANCES

### Optimisations déjà réalisées
- Vue mensuelle du calendrier : UNE seule requête consolidée plutôt qu'un aller-retour par jour (30 requêtes évitées par affichage de mois).
- Recalcul de classement fait par requête SQL agrégée (`WITH ... AS`), pas boucle applicative ligne par ligne.
- Index PostgreSQL ajoutés systématiquement sur les nouvelles tables/colonnes de recherche fréquente (`jours_speciaux_recherche_idx`, `creneaux_exceptions_recherche_idx`, `classes_promotion_idx`, etc.)

### Optimisations restantes / non traitées
- Aucun caching applicatif (Redis ou autre) — chaque requête retape la base.
- Le frontend ne fait aucun bundling/minification — chaque page charge son JS/CSS séparément, sans mise en cache agressive au-delà de ce que le PWA offre par défaut.
- Pas de pagination systématiquement vérifiée sur les listes potentiellement longues (ex. palmarès limité à 100 par un `Math.min`, mais d'autres listes n'ont pas été auditées pour cette conversation).

---

## 17. SÉCURITÉ

### Déjà en place
- RLS PostgreSQL sur toutes les tables touchées (isolation multi-tenant au niveau base, pas seulement applicatif).
- JWT à courte durée + refresh token opaque hashé (jamais stocké en clair), révocable.
- `bcrypt` pour les mots de passe.
- `helmet`, rate limiting, CORS.
- Harnais dédié pour l'assistant IA (transaction lecture seule, rôle PostgreSQL restreint `ia_lecture`) — protège même en cas d'injection SQL réussie dans une requête générée par le modèle.
- Vérification de signature Meta sur le webhook WhatsApp (pré-existant).
- Jobs planifiés protégés par secret partagé plutôt que JWT (cohérent avec un appel hors contexte utilisateur).
- Échappement HTML systématique (fonction `echapper()`, dupliquée par page — voir limitation ci-dessous) pour toute donnée utilisateur insérée dans le DOM.

### Points restant à améliorer
- `echapper()` est réimplémentée indépendamment dans chaque page plutôt que centralisée — un oubli sur une nouvelle page est possible (déjà arrivé une fois avec `eleves.html`, corrigé).
- Pas d'audit de sécurité formalisé (pentest) mentionné dans cette conversation.
- Le nom exact de l'usage de `JWT_REFRESH_SECRET` mériterait d'être revérifié précisément par le prochain assistant (voir section 14, incertitude signalée).

---

## 18. HISTORIQUE DES DÉCISIONS (chronologique, vue d'ensemble de la conversation)

1. Audit initial du dépôt (backend Node/Express/PostgreSQL, frontend HTML vanilla).
2. **Année pivot** : diagnostic du bug "notes qui reviennent après clôture" → cause = absence de contrainte base garantissant une seule année active → migration 001 + garde-fous applicatifs.
3. **Devises et taux de change** : ajout de la configuration FC/USD par école, figée par transaction.
4. **Dettes antérieures** : nouvelle fonctionnalité pour le comptable.
5. **Report de structure entre années** : éviter la reconfiguration annuelle des classes.
6. **Impression Archives** : ajout de duplicatas de bulletins pour les années clôturées.
7. **Bug de calcul du pourcentage** (dénominateur partiel) découvert et corrigé dans `recalculerClassement`.
8. **Refonte complète des bulletins officiels** : découverte progressive via photos envoyées par l'utilisateur (primaire, secondaire, terminale), plusieurs itérations de correction visuelle (dont un aller-retour vers une autre conversation Opus car ma capacité d'affichage d'image s'est épuisée), correction du barème (maximum d'examen configurable), correction de la mise en page (colonnes séparatrices, cases noircies).
9. **Structuration des classes** (niveau/division) et **refonte de la promotion** pour empêcher le mélange d'options.
10. Signalement utilisateur d'un bug de production (`column c.modele_periode_id does not exist`) → diagnostic double (migration non jouée ET mauvais branchement des gabarits sur le mauvais endpoint) → correction des deux.
11. Signalement utilisateur d'incohérences de calcul (bulletin de semestre, palmarès) → réécriture complète du gabarit de semestre selon spécification exacte, correction de trois occurrences du bug "moyenne de pourcentages au lieu de total sur maxima".
12. Onze chantiers listés d'un coup par l'utilisateur ; établissement d'un plan de dépendances (le calendrier comme socle).
13. Construction du calendrier scolaire complet (backend + interface).
14. Construction des présences avec 3 modes et nouveau rôle.
15. Correction des rapports/tableau de bord (doublons, pondération, widget cliquable).
16. Traitement de deux chantiers "légers" (points 8 et 9) → découverte que le point 8 était DÉJÀ construit (doublon accidentel créé puis supprimé), le point 9 avait son backend déjà prêt mais pas son interface.
17. Corrections d'interface transverses suite à une remarque sur un bouton mal stylé → audit complet ayant révélé 12 pages sans style de bouton, un toast structurellement mal positionné (piège CSS `transform`/containing block), 44 boîtes de dialogue natives à remplacer.
18. Ce document de handover.

---

## 19. CONSEILS POUR CONTINUER LE PROJET

1. **Ne JAMAIS supposer qu'une fonctionnalité n'existe pas** avant de l'avoir cherchée dans le code. Cette conversation a démontré deux fois (aperçu de classe, horaires exceptionnels) que des fonctionnalités entières peuvent avoir été construites puis oubliées à cause de la longueur de la conversation. **Toujours `grep` le contrôleur/la page concernée avant d'écrire quoi que ce soit.**
2. **Toujours tester par simulation avant de livrer**, même sans accès à une vraie base : construire un mock minimal de `client.query()` qui reconnaît les motifs de requêtes SQL attendus, appeler la fonction réellement, vérifier le résultat. Cette méthode a permis de trouver plusieurs bugs réels avant livraison (paramètre de route mal nommé, mock incorrect masquant un vrai succès, etc.).
3. **Toujours vérifier `err.statusCode` dans les blocs `catch`** — c'est l'erreur la plus récurrente commise (erreur métier volontaire transformée en 500 générique par un `catch` qui ne teste pas cette propriété).
4. **Utiliser `scripts/audit-frontend.py`** après CHAQUE modification frontend, et se méfier de ses propres faux positifs potentiels (vérifier manuellement avant de "corriger" du code qui pourrait être sain).
5. **Toute modification de gabarit de bulletin doit être vérifiée avec les vraies formules de barème** (voir section 9) — les régressions les plus coûteuses de cette conversation concernent des changements de méthode de calcul (moyenne vs. total/maxima) qui semblent innocents mais changent radicalement les résultats affichés aux familles.
6. **Respecter l'ordre des migrations** (001 à 009) et ne jamais supposer qu'elles ont été jouées sans confirmation explicite de l'utilisateur.
7. **Le calendrier (`calendrier.utils.js`) est un socle** — toute nouvelle fonctionnalité touchant aux dates/périodes doit s'appuyer dessus (`estJourOuvrable`, `periodeCourante`) plutôt que de réinventer une logique de date parallèle.
8. **La capacité d'affichage d'images de l'assistant peut s'épuiser en cours de conversation** (constaté dans cette session) — si cela arrive et que la tâche demande une vérification visuelle (fidélité d'un bulletin, mise en page), le dire explicitement à l'utilisateur plutôt que de deviner, et proposer une nouvelle conversation dédiée si nécessaire.
9. **Les trois chantiers non commencés (discipline, inscriptions/orientation, journal d'activités) ont des questions de conception explicitement posées par l'utilisateur et déjà répondues** (voir section 12 "Important") — ne pas redemander, les réponses sont dans ce document.

---

## 20. CONTEXTE IMPLICITE

- **L'utilisateur communique en français**, et le code (commentaires, noms de variables, messages d'erreur utilisateur) est ENTIÈREMENT en français — convention à respecter strictement pour toute nouvelle contribution.
- **Le ton des commentaires de code** dans ce projet explique systématiquement le POURQUOI d'une décision, pas seulement le QUOI — convention stylistique conservée tout au long de cette conversation, à perpétuer.
- **L'utilisateur est probablement lui-même impliqué dans la gestion ou la connaissance d'écoles congolaises** (connaissance fine des usages : capital de conduite, orientation post-primaire par concours, distinction primaire/humanités, mode de paiement mobile money, etc.) — ses demandes reflètent des besoins réels de terrain, pas des suppositions abstraites.
- **La numérotation des reçus/documents doit toujours suivre l'ANNÉE SCOLAIRE, jamais l'année civile** — principe appliqué au moins une fois (reçu de paiement) et probablement à généraliser à tout document futur portant une numérotation séquentielle.
- **Les documents officiels (bulletins) ont un statut quasi-légal** — la terminale porte une mention "Interdiction formelle de reproduire ce bulletin sous peine des sanctions prévues par la loi" et une référence "IGE/P.S./045". Toute modification de ces gabarits doit être traitée avec le sérieux d'un document administratif officiel, pas comme un simple template.
- **Le bloc "Examen d'État" doit rester VIERGE par principe, pas par oubli** — c'est une contrainte métier forte (les points viennent d'une autorité extérieure à l'école), à ne jamais tenter de "compléter automatiquement" même si cela semblait pratique.
- **Le nom du Ministère a changé pendant la durée réelle du projet** (l'utilisateur l'a signalé comme un fait d'actualité administrative, pas une préférence esthétique) — un signe que ce projet suit l'actualité réglementaire congolaise réelle, et que d'autres changements réglementaires sont probables à l'avenir.
- **L'expression "les_deux" pour `type_enseignement`** (par opposition à "primaire"/"secondaire") est le nom de valeur ENUM réel en base — à ne jamais renommer sans migration.
- **Le rôle "titulaire" a un sens différent au primaire et au secondaire** : au primaire, c'est LE maître qui enseigne tout ; au secondaire, c'est un professeur parmi d'autres qui porte en plus la responsabilité administrative de la classe (vie de classe, signature du bulletin) sans nécessairement enseigner toutes les matières. Cette distinction a été explicitement discutée et une règle d'héritage automatique des cours a été proposée par l'assistant et validée par l'utilisateur pour le primaire (le titulaire hérite automatiquement de tous les cours de sa classe sauf exception configurée), mais **je ne suis pas certain à 100% que cette règle ait été effectivement implémentée en code** avant que la conversation ne bifurque vers d'autres chantiers — À VÉRIFIER PAR LE PROCHAIN ASSISTANT.
- **L'environnement de développement utilisé par l'assistant précédent n'a PAS d'accès réseau** (pas d'installation de paquets npm supplémentaires, pas de connexion à une vraie base de données, pas de navigateur réel pour vérifier visuellement). Toute validation a été faite par simulation (mocks manuels) et vérification syntaxique (`node --check`). Le prochain assistant, s'il a un environnement différent (avec accès réseau/base réelle), devrait EN PRIORITÉ faire tourner les migrations et les tests contre un vrai système pour rattraper ce qui n'a pu être vérifié.
- **Les fichiers sont livrés à l'utilisateur un par un au fil de la conversation** (pas de dépôt Git synchronisé automatiquement) — l'utilisateur copie manuellement chaque fichier livré dans son propre dépôt. Cela signifie qu'il existe un risque réel de désynchronisation entre l'état du dépôt de l'utilisateur et les fichiers de travail de l'assistant — **en cas de bug signalé qui semble déjà corrigé dans le code de travail, toujours envisager que l'utilisateur n'a peut-être pas copié le bon fichier**, comme cela s'est produit au moins une fois explicitement pendant cette conversation (bug du toast).

---

## POINTS QUI RISQUENT D'ÊTRE OUBLIÉS

- Les migrations 001 à 009 doivent être jouées **dans l'ordre strict**, chacune suppose les précédentes appliquées.
- `POST /notes/recalculer` doit être appelé manuellement (ou via script) sur les bulletins déjà générés avant le fix du recalcul automatique — sinon ils restent faux indéfiniment.
- Le nom du ministère dans les gabarits est **"MINISTÈRE DE L'ÉDUCATION NATIONALE ET NOUVELLE CITOYENNETÉ"** (pas l'ancien nom "ENSEIGNEMENT PRIMAIRE, SECONDAIRE ET TECHNIQUE").
- Le bloc Examen d'État (terminale) doit rester VIERGE — ne jamais y insérer de valeur calculée.
- `jour` dans `creneaux_exceptions` est un jour de semaine récurrent (1-7), PAS une date calendaire précise.
- `cle_unicite` sur `notifications` est OBLIGATOIRE pour toute notification générée par une tâche récurrente, sinon duplication quotidienne garantie.
- Ne jamais écrire `valeur || null` sur un champ où `0` est une valeur métier légitime (ex. `maximum_examen = 0` signifie "pas d'examen", pas "non renseigné") — piège JavaScript rencontré et corrigé plusieurs fois dans cette conversation (falsy `0`).
- Les fichiers `middleware/*.template.js` sont des fichiers MORTS (non référencés), antérieurs à cette conversation, à ne pas confondre avec les vrais gabarits dans `utils/`.
- `charge_presences` et `directeur_discipline` existent dans l'ENUM des rôles mais **`directeur_discipline` n'a AUCUNE logique métier écrite** — ne pas supposer que le chantier discipline est entamé juste parce que le rôle existe.
- Le comptable est le SEUL rôle (avec le super admin) autorisé à voir des données financières d'années antérieures à l'année active — règle de sécurité métier, pas un oubli d'interface.
- `:where()` est utilisé délibérément dans `ui.css` pour sa spécificité NULLE — ne pas le remplacer par un sélecteur normal sans comprendre que cela écraserait le style des 22 pages qui ont déjà le leur.
- Le réparentage de `#message-flash` dans `ui.js` doit rester la TOUTE PREMIÈRE instruction exécutée du fichier — le déplacer plus bas réintroduirait le risque qu'une erreur antérieure dans le fichier empêche son exécution.
- `ArdoiseEdition` n'est déployé QUE sur `parametres.html` — ne pas supposer qu'il est actif ailleurs.
- Le socle du primaire (23 branches, somme = 300) est vérifié par une assertion qui LÈVE UNE EXCEPTION AU CHARGEMENT DU MODULE si la somme diverge — c'est volontaire (erreur bruyante préférée à un bug silencieux sur tous les bulletins primaires).
- `niveau` des classes existantes est NULL par défaut après migration — ne pas supposer que la promotion moderne fonctionne pour toutes les écoles sans vérification préalable.
- Les gabarits de bulletins primaire/secondaire actuellement dans le dépôt viennent d'une conversation PARALLÈLE (avec Opus) et n'ont jamais été vérifiés visuellement par l'assistant qui a écrit ce document.

---

## 21. EXAMEN DE REPÊCHAGE — conception, RÉALISÉE au lot 17

> **Livrée au lot 17.** Le propriétaire a tranché en indiquant que les critères
> relèvent du règlement interne de chaque école : les trois points en suspens
> sont donc devenus des RÉGLAGES, avec des défauts conformes à l'usage
> congolais. Une seule règle n'est pas configurable — la note d'origine n'est
> jamais écrasée — parce que l'école, les parents et l'établissement d'accueil
> ont le droit de savoir qu'un élève a été repêché.

### Le besoin, tel qu'exprimé

- Une session de repêchage **à la fin de l'année** seulement.
- Elle porte sur **les examens ratés** et **les cours en échec**.
- Sa portée va **jusqu'au bulletin final**.
- Les conditions doivent être **configurables**.

### Le problème que ça pose

Un repêchage n'est pas une note de plus : c'est une **note de remplacement
conditionnelle**. Trois questions doivent être tranchées, et c'est là que se
joue la justice du dispositif.

**1. Qui a droit au repêchage ?**
Proposition : configurable par école, avec trois réglages —
- un **seuil d'échec** par cours (ex. moins de 50 % dans un cours) ;
- un **nombre maximum de cours** repêchables (ex. 3) — au-delà, l'élève
  redouble, le repêchage n'est pas fait pour rattraper une année entière ;
- une **fourchette de moyenne générale** (ex. entre 40 % et 50 %) : en dessous,
  l'écart est trop grand ; au-dessus, l'élève passe déjà.

**2. Que devient la note d'origine ?**
C'est la question la plus importante, et la réponse doit être : **la note
d'origine n'est jamais écrasée.** Le repêchage s'enregistre dans une table
distincte, et le bulletin final affiche les deux. Écraser rendrait impossible
de savoir qu'un élève a été repêché — or c'est une information que l'école, les
parents et l'établissement d'accueil ont le droit de connaître.

**3. Comment la note repêchée compte-t-elle ?**
Trois politiques possibles, à rendre configurables :
- **Plafonnée au seuil** (recommandé par défaut) : un repêchage réussi ramène
  le cours exactement au minimum de passage, jamais au-dessus. Il rattrape, il
  ne récompense pas.
- **Remplacement intégral** : la note de repêchage remplace la note d'examen.
- **Moyenne des deux**.

### Modèle de données proposé

```
sessions_repechage
  id, ecole_id, annee_scolaire_id, libelle,
  date_debut, date_fin,
  statut ('preparee' | 'ouverte' | 'cloturee'),
  -- conditions figées AU MOMENT de l'ouverture : changer le règlement en
  -- cours de session ne doit pas requalifier des élèves déjà écartés
  seuil_echec_cours numeric,
  max_cours_repechables integer,
  moyenne_min numeric, moyenne_max numeric,
  politique_note ('plafonnee' | 'remplacement' | 'moyenne'),
  cree_par, cloture_par, cloture_at

candidats_repechage
  id, ecole_id, session_id, eleve_id, classe_cours_id,
  note_origine numeric,        -- copiée, jamais modifiée
  note_repechage numeric,
  note_retenue numeric,        -- résultat de la politique, recalculable
  statut ('eligible' | 'inscrit' | 'compose' | 'reussi' | 'echoue'),
  saisi_par, updated_at
```

### Enchaînement proposé

1. **Fin d'année, toutes les périodes clôturées.** Le repêchage n'a de sens
   qu'une fois les résultats définitifs — c'est un contrôle bloquant.
2. La direction crée la session : les conditions sont **figées** à ce moment.
3. La plateforme **propose la liste des éligibles**, cours par cours, avec le
   motif de chaque éligibilité. La direction peut retirer quelqu'un, jamais en
   ajouter un qui ne remplit pas les conditions — sinon les conditions ne
   servent à rien.
4. Les enseignants saisissent les notes de repêchage, comme une grille
   ordinaire, sur les seuls cours concernés.
5. **Clôture** : la note retenue est calculée selon la politique, le bulletin
   final est recalculé, et la décision de passage réévaluée.
6. Le bulletin final **mentionne le repêchage** : cours concerné, note
   d'origine, note de repêchage, note retenue.

### Points d'attention repérés

- Le calcul des moyennes (`utils/moyennes.utils.js`) devra utiliser la **note
  retenue** et non la note d'origine, mais **uniquement après clôture** de la
  session. Avant, les résultats afficheraient un rattrapage non acquis.
- Un élève repêché ne doit pas pouvoir prétendre à une **mention** : à trancher
  avec le propriétaire.
- L'orientation de fin de 8ᵉ et la promotion doivent attendre la clôture du
  repêchage, sinon elles décideront sur des données périmées.
- Interaction avec les **classes terminales** (lot 10) : un élève de terminale
  repêché est-il diplômé ? Probablement oui, mais c'est une décision d'école.

### Questions restant à trancher

1. Quelle politique de note par défaut ? (recommandation : plafonnée)
2. Un élève repêché peut-il obtenir une mention ?
3. Le repêchage porte-t-il sur les cours, sur les examens, ou sur les deux
   séparément — avec des conditions distinctes ?

---

## 22. INVENTAIRE DES AJOUTS — session de maintenance

### Migrations (à jouer dans l'ordre, après 001–009)

`010` sens discipline · `011` creneaux_exceptions · `012` index journal ·
`013` critères orientation · `014` règlement discipline · `015` année d'entrée
inscriptions · `016` reconduction et clôture · `017` comptabilité ·
`018` expéditeur messagerie · `019` repêchage

### Contrôleurs créés

| Fichier | Rôle |
|---|---|
| `cloture.controller.js` | Clôture et réouverture de période *(anciennement reconduction.controller, renommé)* |
| `comptabilite.controller.js` | Caisse, catégories, contrats, paie |
| `parcours.controller.js` | Fiches élève, classe, cours |
| `repechage.controller.js` | Examen de repêchage |
| `assistant.controller.js` | Aide à l'utilisation, manuels |
| `discipline-reglement.controller.js` | Import et validation du règlement |

### Utilitaires créés

| Fichier | Pourquoi il existe |
|---|---|
| `moyennes.utils.js` | **Source unique** du calcul des moyennes. Rapports, tableau de bord et fiches l'utilisent : trois calculs parallèles donnaient trois chiffres. |
| `frais.utils.js` | **Source unique** du total dû par élève. Corrige le `LIMIT 1`. |
| `connaissance.utils.js` | **Source unique** du guide, des 7 manuels et de la consigne de l'assistant. |
| `document-texte.utils.js` | Extraction de texte sans dépendance npm (docx via `zlib`). |

### Middleware

`journal.middleware.js` — journalisation automatique de toutes les écritures.
Monté **avant `/auth`** dans `server.js` pour couvrir les connexions.

### Pages créées

`comptabilite.html` · `repechage.html`

### Fichiers partagés modifiés — attention aux versions

`ui.js` et `ui.css` ont été modifiés à **cinq reprises** (lots 9, 11, 16, et
dettes). Ne déployez que la dernière version : elle contient tout.

### Scripts d'installation livrés

`installer-didacticiel.py` · `installer-lien-comptabilite.py` ·
`installer-lien-repechage.py` · `nettoyer-cartes-droits.py`

Tous idempotents, tous avec un mode `--simulation`.

### Tests

Douze fichiers dans `test/`, **441 vérifications**. Ils remplacent `config/db`
par un faux client SQL et appellent réellement les contrôleurs. Ils ne testent
ni PostgreSQL, ni les modèles d'IA, ni le rendu HTML.

Pour les lancer :

```bash
cd test && for t in test-*.js; do node "$t"; done
```

