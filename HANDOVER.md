# HANDOVER COMPLET — PROJET ARDOISE
### Plateforme SaaS de gestion scolaire (République Démocratique du Congo)

**Document généré le** : 2 août 2026, à la demande explicite de l'utilisateur, pour permettre la reprise intégrale du projet dans une nouvelle conversation sans perte de contexte.

**Dernière mise à jour** : 11 août 2026 — e-mails, correctifs Gmail sombre,
page Prospects, prospectus commercial et état de consolidation.

> **À LIRE EN PREMIER — 7 août 2026.** Un audit complet a été mené sur la
> totalité du dépôt. Ses conclusions sont en **§11 quater**, et elles
> CORRIGENT ce document sur plusieurs points où il se trompait (notamment
> §9.2 et §11 ter, qui déclaraient résolus des défauts qui ne l'étaient
> pas). En cas de contradiction, §11 quater fait foi : c'est la seule
> section vérifiée dans le code ligne à ligne.

> **MISE À JOUR À LIRE EN PREMIER — 11 août 2026.** La session de correction
> approfondie est documentée en **§11 quinquies**. Les travaux réalisés ensuite
> sur les e-mails transactionnels, Gmail en mode sombre, la page Prospects et
> le prospectus commercial sont consignés en **§23 à §25**. Ces sections sont
> les plus récentes pour ces sujets et font foi en cas de contradiction avec
> une description antérieure du système d'e-mails ou des demandes
> d'accompagnement.

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
- **Rôles utilisateurs** : Directeur, Préfet des études, Secrétaire, Professeur, Titulaire (professeur responsable d'une classe), Comptable, Parent, Super Admin (niveau plateforme, gère les écoles clientes), Chargé des présences (`charge_presences`) et Directeur de discipline (`directeur_discipline`), désormais l'un et l'autre attribuables depuis l'écran Utilisateurs et exploités par le module Présences.

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
- `charge_presences` et `directeur_discipline` sont dans l'ENUM, attribuables depuis l'écran Utilisateurs, et tous deux exploités par le module Présences (voir section 5). **Le chantier discipline proprement dit (point 10 de la liste utilisateur) n'est toujours PAS commencé** : `directeur_discipline` ouvre aujourd'hui le menu Discipline et le menu Présences, rien de plus — aucune règle métier propre à la discipline n'a été écrite pour lui.
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
- **Rôle `charge_presences`** (ENUM, migration 008), attribuable depuis l'écran Utilisateurs. En mode "charge", l'appel lui revient EXCLUSIVEMENT : le titulaire n'a plus de repli sur sa propre classe (ce repli existait au départ, il a été retiré parce qu'il laissait deux personnes également fondées à saisir la même feuille sans savoir laquelle devait le faire). Seule la direction — et le directeur de discipline, rangé avec elle pour les présences — conserve un accès de correction côté serveur.
- **Le menu suit le mode** : `acces-presences.js` (front) est la SEULE source de vérité pour savoir qui voit l'écran Présences. Les 30 pages y font appel au lieu de coder la liste en dur ; le mode de l'école est mis en cache dans le navigateur (lecture synchrone, sans clignotement) puis rafraîchi en arrière-plan par `GET /ecole/moi`. En mode "charge", le menu quitte tout le monde — direction comprise — et ne reste qu'au chargé et au directeur de discipline. Pour rendre l'écran au directeur, ajouter `'directeur'` à la ligne `charge:` de `ROLES_PAR_MODE`, rien d'autre.
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

## 11 quater. AUDIT COMPLET — 7 août 2026

> Audit technique, métier, sécurité et architecture mené sur la totalité du
> dépôt, à la demande du propriétaire. Cette section REMPLACE, sur les points
> qu'elle traite, ce que les sections précédentes affirment. Là où elles se
> contredisent, c'est celle-ci qui a été vérifiée dans le code.

### Périmètre réel, et ce qui n'a PAS pu l'être

**Ce qui a été lu** : les 141 fichiers `.js` du backend, les 41 pages du
frontend, et le schéma PostgreSQL exporté de la base réelle (fourni en cours
d'audit).

**Ce qui n'a pas pu l'être — à dire sans détour** :

| Élément | État |
|---|---|
| Migrations `001` à `021` | **ABSENTES du dépôt fourni.** Aucun fichier `.sql`. Leur contenu n'a pas pu être relu. |
| Répertoire `test/` (« 441 vérifications, 12 fichiers ») | **ABSENT du dépôt fourni.** |
| Exécution contre PostgreSQL | Impossible : ni `npm install`, ni réseau. |
| Chargement réel des modules (`require()`) | Impossible pour la même raison. Remplacé par une analyse statique, voir plus bas. |
| Rendu navigateur, PDF, mobile | Non vérifié. |
| Appels IA réels | Non vérifiés. |

Le schéma exporté ne contient **aucun index** : ni `CREATE INDEX`, ni index
d'unicité partiel. Il est donc impossible d'affirmer depuis lui que les treize
index dont dépendent les clauses `ON CONFLICT` du code existent. La migration
`022` livrée avec cet audit contient la requête qui répond à la question.

**Niveau de preuve employé dans toute cette section** : *vérifié statiquement*.
Rien n'a été testé contre une vraie base, dans un navigateur, ni en production.

---

### Ce que ce handover affirmait à tort — troisième série

1. « Le bug du `LIMIT 1` sur `frais_scolaires` a été corrigé à quatre
   endroits » (§11 ter). En réalité **deux** appelants seulement employaient
   `utils/frais.utils.js`. **Sept** autres calculs de frais dus portaient
   encore le défaut, ou sa variante inverse.
2. « Les `AVG(pourcentage)` ont été corrigés à trois endroits » (§9.2).
   **Six** subsistaient, dont deux sur des décisions qui engagent la scolarité
   d'un élève : la promotion et l'orientation.
3. « `test/` — 441 vérifications » (§11 ter) : ce répertoire n'existe pas dans
   le dépôt livré. Une suite neuve, sans dépendance, l'a remplacé.

Le motif est constant depuis le début du projet : **une règle est corrigée là
où le bug a été observé, jamais là où le même code avait été recopié.** Les
trois corrections structurelles de cet audit (`bareme.utils.js`,
`frais.utils.js` généralisée, `moyennes.utils.js` généralisée) visent
précisément à supprimer la possibilité de recopie.

---

### Bugs trouvés et corrigés

#### AUD-01 · P0 · Le maximum d'examen était ignoré à la saisie et au calcul

**Problème.** La règle du projet — `maximum_examen` à `NULL` vaut 2 × le
maximum de période, `0` signifie « cours non examiné » — était appliquée dans
`bulletin-assemblage-officiel.js` et `moyennes.utils.js`, et **nulle part**
dans `notes.controller.js`.

Trois conséquences, toutes sur les sessions d'examen :
- `GET /notes/grille` renvoyait le maximum de PÉRIODE ; l'écran affichait
  « sur 20 » là où le barème est 40 ;
- `POST /notes/grille` **refusait les cotes valides** : un professeur saisissant
  35 sur 40 recevait « la note doit être comprise entre 0 et 20 ». La saisie
  des examens était donc inutilisable pour toute école n'ayant pas configuré
  `maximum_examen` — c'est-à-dire le cas par défaut, `NULL` ;
- `recalculerClassement()` divisait par le maximum de période :
  `bulletins.pourcentage` pouvait **dépasser 100 %**, et le classement comme la
  mention en découlaient.

**Cause.** `resoudreClasseCours()` ne recevait pas la période et ne pouvait
donc pas connaître son type.

**Correction.** Nouvelle source unique `utils/bareme.utils.js`
(`maximumApplicable` en JS, `sqlMaximumApplicable` en SQL).
`resoudreClasseCours()` prend désormais `periodeId` et renvoie `maximum`,
`maximum_periode` et `type_periode`. Le dénominateur de `recalculerClassement`
emploie le fragment SQL commun. Un refus explicite a été ajouté quand un cours
à `maximum_examen = 0` reçoit une cote d'examen — sans lui, la validation
répondait « comprise entre 0 et 0 ».

**Fichiers.** `utils/bareme.utils.js` (nouveau), `controllers/notes.controller.js`.

**Test.** `test/bareme.test.js` — 12 assertions sur la règle, 3 sur le fichier.

**Statut.** Corrigé, vérifié statiquement.

---

#### AUD-02 · P0 · La promotion se décidait sur `AVG(bulletins.pourcentage)`

**Problème.** `promotion.controller.js` calculait la moyenne annuelle en
moyennant les pourcentages de bulletins de période. C'est exactement ce que
§9 bis de ce document interdit. Deux erreurs cumulées sur le chiffre qui décide
si un élève passe, redouble ou sort :
- `bulletins.pourcentage` est **matérialisé** : il n'existe que si un bulletin
  a été généré. Une classe notée mais dont les bulletins n'étaient pas encore
  produits donnait `NULL` — et ses élèves étaient traités comme « sans notes »,
  donc proposés à la SORTIE ;
- moyenner des pourcentages de barèmes différents donne le même poids à une
  session d'examen et à une période ordinaire.

**Correction.** Passage par `pourcentagesParEleve()` (`utils/moyennes.utils.js`),
la source déjà employée par les rapports, le tableau de bord et le repêchage.
`inclureNonNotes: false` préserve la distinction « aucune cote » / « mauvais
résultats », dont dépend la proposition de sortie.

**Fichiers.** `controllers/promotion.controller.js`.

**Statut.** Corrigé, vérifié statiquement. **À revérifier contre une vraie base**
sur une classe réelle avant la promotion de fin d'année.

---

#### AUD-03 · P0 · Deux imports cassés faisaient échouer l'impression des bulletins

Trouvés par le vérificateur statique livré avec cet audit, pas à la lecture.

- `grouperParDomaine` est **définie** dans `bulletin-assemblage-officiel.js`
  (ligne 294) mais était **absente de ses exports**. `bulletins.controller.js`
  et `archives-impression.controller.js` l'importent et l'appellent :
  `undefined is not a function` à chaque impression de bulletin **primaire**,
  et à chaque réimpression depuis les Archives. Erreur 500 sans explication.
- `bulletin-semestre.controller.js` importait `assemblerDonneesRegroupement`,
  **un nom qui n'existe nulle part**. La fonction s'appelle
  `assemblerDonneesSemestre` et sa signature diffère (`semestreId`, pas
  `regroupementId`). Toute impression de bulletin de **semestre** échouait.

C'est précisément la catégorie que §11 bis annonçait comme non détectable par
`node --check`. Elle l'est désormais : voir « Outils » plus bas.

**Statut.** Corrigés. **Le rendu des PDF reste non vérifié visuellement** — ces
corrections rétablissent l'appel, elles ne disent rien de la mise en page.

---

#### AUD-04 · P1 · Sept calculs de frais dus étaient faux

Le `LIMIT 1` que §11 ter déclarait corrigé subsistait, ou sa variante inverse.

| Fichier | Défaut | Conséquence |
|---|---|---|
| `rapports.controller.js` | `LIMIT 1` | État de recouvrement sous-évalué |
| `frais.controller.js` (statsGlobales) | `LIMIT 1` | Les trois cases du Directeur fausses |
| `frais.controller.js` (reçu) | `LIMIT 1` | **Le reçu remis à la famille annonçait un montant dû partiel** |
| `dashboard.controller.js` | `LIMIT 1` | Carte des impayés fausse |
| `public.controller.js` | `LIMIT 1` | **Le blocage de bulletin pour impayé ne bloquait personne** |
| `parcours.controller.js` | `SUM` de TOUTES les lignes | Défaut **inverse** : la ligne de classe s'ajoutait à la ligne générale du même libellé — 100 + 120 = 220 réclamés au lieu de 120. Et **aucune conversion de devise** : FC et USD additionnés bruts |
| `assistant-outils.utils.js` | `LIMIT 1` + toutes années + toutes devises + **aucune devise affichée** | Réponse WhatsApp au parent : « il vous reste 200 », sans unité, calculé sur la mauvaise base |

Le reçu et la page publique sont les deux plus graves : ce sont les seuls
documents que la famille lit, et l'erreur y survit à toute correction d'écran.

**Correction.** Tous passent par `sqlTotalFraisDus()` (`utils/frais.utils.js`),
sauf `public.controller.js` — cette route est publique, elle n'a pas de contexte
de locataire, la règle y est réécrite à l'identique avec l'école en paramètre.
Les versements sont convertis via `sqlPaiementConverti()` et filtrés sur
l'année.

**Statut.** Corrigés, vérifiés statiquement. Un test refuse le motif exact.

---

#### AUD-05 · P1 · L'orientation classait les élèves sur une moyenne fausse

Même défaut qu'AUD-02, sur `chargerEleves()` : `AVG(b.pourcentage)`, avec le
tri au mérite fait en SQL sur cette même expression. Un élève dont la classe
n'avait pas encore imprimé ses bulletins sortait **sans moyenne**, donc en fin
de classement — dernier servi sur les options les plus demandées, pour une
raison purement technique.

**Correction.** `pourcentagesParEleve()`, tri déplacé en JavaScript avec la
règle d'égalité du projet (alphabétique).

---

#### AUD-06 · P1 · Le maximum d'examen replié sur 0

`repechage.controller.js` et `parcours.controller.js` écrivaient
`COALESCE(…, maximum_examen, 0)` : un barème **pas encore configuré** était
traité comme **« pas d'examen »**. Le dénominateur s'effondrait, le pourcentage
par cours gonflait — et **des élèves réellement en échec n'étaient plus
proposés au jury de repêchage**. Sur la fiche de cours, le taux de réussite
comparait chaque note à un seuil de 0 : tout examen comptait pour une réussite.

**Correction.** `sqlMaximumApplicable()` aux deux endroits. Un test refuse le
motif `COALESCE(..., maximum_examen, 0)`.

---

#### AUD-07 · P1 · Deux contrôleurs neufs n'étaient jamais chargés

`routes/super-admin.controller.js` et `routes/abonnements.controller.js`
étaient des versions **plus complètes**, posées dans le mauvais dossier.
`server.js` charge `controllers/`. Conséquence vérifiable de bout en bout :

`super-admin-vues-ecoles.js` (ligne 554) lit
`SA.referentiels.methodes_paiement`, que la version chargée ne renvoyait pas.
L'écran répondait donc **« Méthodes de paiement indisponibles. Rechargez la
page. »** en permanence, et l'encaissement d'un abonnement réglé **en espèces**
était impossible. Or c'est le mode de paiement le plus fréquent : les écoles
concernées restaient suspendues alors qu'elles avaient payé.

La version morte apportait aussi : validation du montant et de la méthode,
référence obligatoire pour un règlement manuel, prolongation à partir de
l'échéance en cours (l'ancienne repartait de `now()` et **faisait perdre à une
école les semaines qu'elle avait payées en renouvelant en avance**), et
`utilisateur_id` dans le journal d'audit.

**Correction.** Les deux fichiers ont été promus dans `controllers/`, les
copies égarées supprimées.

---

#### AUD-08 · P1 · Contrôleur public : années mélangées, effectif faux

- Les bulletins renvoyés au parent n'étaient filtrés **que sur l'élève**. Ceux
  de toutes ses années remontaient ensemble, triés par `p.numero` : la première
  période de 2024 et celle de 2025 portent le même numéro. La famille voyait
  deux lignes « 1ère période » aux résultats différents.
- L'effectif de classe était compté **par nom de classe** (`c.nom = $1`), donc
  à travers les années et les divisions parallèles. C'est le dénominateur du
  rang affiché : « 12e sur 45 » où 45 n'était pas l'effectif de la classe.

**Correction.** Année active résolue une seule fois et appliquée aux deux
blocs ; effectif compté sur `classe_id`.

---

#### AUD-09 · P2 · Rang attribué à des élèves sans moyenne (repris par AUD-11)

`bulletin-semestre.controller.js` et `bulletin-annuel.controller.js`
attribuaient `classement = i + 1` après un `ORDER BY … NULLS LAST`. Un élève
sans aucune cote se voyait donc imprimer « 42e sur 42 », contre la règle §9.3
(« un élève sans valeur n'est pas classé »).

**Correction.** Compteur de rang distinct de l'indice de boucle ; `classement`
vaut `null` sans moyenne.

---

#### AUD-10 · P2 · CORS ouvert à toutes les origines

`app.use(cors())` sans restriction. Sur une API à jeton d'en-tête ce n'est pas
une fuite immédiate, mais c'est le dernier filet, et il n'existait pas.

**Correction.** `ORIGINES_AUTORISEES` (liste séparée par des virgules). **Non
renseignée, l'ancien comportement est conservé** avec un avertissement au
démarrage : une école en production ne doit pas tomber parce qu'une variable
manque. À renseigner avant mise en production.

---

#### AUD-13 · P1 · La relance des enseignants avant clôture échouait à 100 %

`annee-scolaire.html` appelait `POST /communication/messages` : **ce chemin
n'existe pas**, la route est `/communication/envoyer`. La charge utile était
fausse elle aussi — `cible_type` / `destinataires` au lieu de
`cible: { type, utilisateurs }`, et `canaux` absent alors qu'il est obligatoire.

Le backend avait pourtant été écrit POUR cet appelant : son commentaire
mentionne explicitement « la relance nominative depuis la clôture de période ».
Seule la moitié frontend n'a jamais été mise à jour.

**Effet réel** : avant chaque clôture de période, le Directeur ouvre la liste
des enseignants dont les notes ne sont pas validées, clique « Relancer », et lit
« 0 envoyé(s), 4 en échec ». Aucun moyen de joindre les retardataires depuis
l'écran prévu pour ça. Le `404` était avalé par `appelApi`, donc aucune erreur
JavaScript, aucune trace en console.

**Correction.** Chemin et charge utile alignés sur le contrat réel de la route.

---

#### AUD-14 · P2 · Le filet de sécurité du tableau de bord était troué

`dashboard-directeur.html` appelait `/structure/periodes` en repli quand
`/rapports/portees` échoue. Les routes de structure sont montées à la RACINE :
le chemin est `/periodes`. Le repli échouait donc systématiquement.

Le commentaire du fichier explique longuement que ce repli existe pour que « le
widget rende un service dégradé mais réel, au lieu de ne rien rendre du tout ».
Il ne rendait rien du tout. Un filet troué donne l'illusion d'en avoir un — et
personne ne le teste, puisqu'il ne se déclenche qu'en cas de panne.

**Correction.** `/periodes`.

---

### Audit frontend — ce qui a été fait, et l'angle mort de l'outil existant

`audit-frontend.py` déclare les 41 pages saines, et c'est exact pour ce qu'il
contrôle : identifiants, fonctions, balises. **Il ne franchit jamais la
frontière entre les deux moitiés de l'application.** C'est son angle mort, et
c'est exactement là que vivaient AUD-07, AUD-13 et AUD-14 — trois écrans
inutilisables en production sur des pages déclarées sans problème.

**`audit-contrat-api.py`** (nouveau) ajoute les trois contrôles manquants :

1. **Chaque `appelApi('/chemin')` correspond-il à une route montée ?** Le script
   lit `server.js` pour reconstituer les préfixes, puis chaque fichier de
   routes, et transforme `/frais/paiements/:id` en expression acceptant un
   segment quelconque. 335 routes recensées, 54 fichiers frontend confrontés.
   Un `404` ne produit aucune erreur visible — `appelApi` l'avale — donc ce
   contrôle est le seul moyen de voir ces pannes sans ouvrir chaque écran.
2. **Chaque `onclick="machin()"` correspond-il à une fonction définie ?**
   `audit-frontend.py` ne lit que les appels situés DANS les `<script>`. Un
   bouton dont le seul appelant est son attribut de balisage n'était jamais
   contrôlé — et c'est précisément la forme que prend « le bouton ne fait rien ».
3. **Reste-t-il des `confirm()` / `prompt()` / `alert()` natifs ?** Le projet a
   ses propres modales ; les natives bloquent le fil et ignorent le thème sombre.

**Deux faux positifs ont été corrigés dans l'outil avant de rapporter quoi que
ce soit**, parce qu'un audit qui crie au loup finit ignoré :
- `re.escape` n'échappe plus les deux-points depuis Python 3.7 : toutes les
  routes paramétrées passaient pour introuvables. 106 « anomalies » dont 99
  fausses.
- Les cinq `confirm()`/`prompt()` de `ui.js` sont dans le COMMENTAIRE qui
  documente comment les remplacer. Les commentaires sont désormais blanchis
  avant l'analyse, en préservant les numéros de ligne.

État final : **`54 fichiers : contrat frontend/backend cohérent.`** et
`41 pages auditées : aucun problème détecté.`

### Années scolaires — vérifié, rien à corriger

Le cantonnement est solide et n'a pas été touché :
- `verifierPeriodeModifiable` contrôle TROIS niveaux avant toute écriture de
  note — période clôturée, année clôturée, année non active — avec un message
  distinct pour chacun ;
- `anneeActive` exige `active = true AND cloturee = false` et impose un
  `ORDER BY` déterministe ;
- `resoudreAnneeConsultable` centralise la règle et vérifie l'appartenance à
  l'école avant d'autoriser une année hors pivot au comptable ;
- la clôture fige les inscriptions dans `eleve_classe_historique` avant de
  verrouiller, puis crée et active l'année suivante — l'école n'est jamais
  laissée sans pivot.

**Signalé, non corrigé** : `cloturerAnnee` écrit `cloturee = true, active =
false` mais **pas `statut = 'cloturee'`**. C'est la dérive 3a de la migration
022, confirmée ici sur le chemin de code qui la produit.

### Présences — vérifié, rien à corriger

Module sérieux : refus des dates futures ; `estJourOuvrable` refuse dimanche,
fériés et vacances **par cycle** (une session d'examens du secondaire ne bloque
pas le primaire) ; verrouillage journalier en mode professeur avec motif
obligatoire pour écraser l'appel d'un collègue ; `saisi_par_initial` jamais
écrasé ; élèves confrontés à la classe avant écriture, ce qui ferme l'IDOR.

**Signalé, non corrigé** : la borne d'année dans `estJourOuvrable` est
conditionnée à `date_debut` ET `date_fin`, tous deux nullables. Une école qui
crée une année sans renseigner ses dates perd cette protection en silence, et
peut faire l'appel à n'importe quelle date passée. Ajouter un refus casserait
les écoles qui n'ont jamais rempli ces champs : à traiter par une exigence à la
création d'année, pas par un blocage rétroactif.

---

#### AUD-15 · P1 · Un salaire pouvait être payé deux fois

`payerSalaire` lisait le bulletin de paie, vérifiait que son statut n'était pas
déjà `paye`, puis insérait une sortie de caisse et mettait le statut à jour.
Trois opérations, aucun verrou.

Deux requêtes simultanées — un double-clic, ou deux personnes sur le même
bulletin — lisent toutes deux `a_payer`, passent toutes deux le contrôle, et
insèrent **chacune** un mouvement de caisse. Le salaire sort donc deux fois du
compte, tandis que `salaires.mouvement_id` ne retient que le dernier : le
premier mouvement devient un **débit orphelin**, que plus rien ne rattache à un
bulletin de paie. Personne ne le retrouve à la clôture du mois.

**Correction.** `FOR UPDATE OF s` sur la ligne de paie : les transactions
concurrentes sont sérialisées, la seconde voit le statut `paye` et reçoit le
409 prévu.

---

#### AUD-16 · P1 · Un abonnement pouvait être prolongé deux fois

Même motif dans `confirmerPaiement`. Un double-clic du Super Admin émettait
deux factures, enregistrait deux paiements, et prolongeait l'abonnement **deux
fois** — puisque la nouvelle échéance se calcule à partir de l'échéance
courante. L'école recevait des mois qu'elle n'avait pas payés, et la caisse
plateforme deux entrées pour un seul règlement.

**Correction.** `FOR UPDATE OF a`. Le verrou ne porte que sur la ligne : deux
écoles différentes restent encaissables en parallèle.

---

### Concurrence — constat général

**Le projet ne contenait aucun `FOR UPDATE`.** Le motif « je lis, je vérifie,
j'écris » est donc non protégé partout ; AUD-15 et AUD-16 sont les deux instances qui
touchent à l'argent, et ce sont les seules corrigées.

Une exception notable, et bien faite : la numérotation des reçus
(`frais.controller.js`) emploie `SAVEPOINT` + reprise sur violation d'unicité.
C'est le bon motif, et il montre que la question avait été pensée à cet
endroit-là — mais nulle part ailleurs.

**Restent à examiner** : `cloturerPeriode`, `cloturerAnnee`, `executerPromotion`
et l'ouverture/clôture de session de repêchage suivent la même forme. Ils ne
manipulent pas d'argent, mais un double déclenchement y produirait des états
incohérents. Non corrigés faute d'avoir pu les dérouler.

### Énumération `paiements.methode` — VÉRIFIÉE sur la base réelle

Valeurs présentes : `orange_money`, `airtel_money`, `mpesa`, `cash`, `stripe`,
`virement`, `especes`, `virement_bancaire`, `cheque`.

**AUD-07 est confirmé sûr** : les trois valeurs dont il a besoin existent.
L'encaissement d'abonnement en espèces fonctionnera.

**Mais trois valeurs ne sont écrites ni lues par aucune ligne de code** :
`cash`, `stripe`, `virement`. Deux font doublon avec les valeurs actuelles :

```
cash      ≡ especes
virement  ≡ virement_bancaire
```

Un même règlement peut donc exister sous deux étiquettes selon l'époque de sa
saisie. Tout `GROUP BY methode` — état de caisse, export comptable, tableau de
bord — coupera la même réalité en deux colonnes sans le signaler. La migration
022, partie 3e, contient la requête de comptage et la marche à suivre (normaliser
d'abord, retirer ensuite — jamais l'inverse).

### Index de déduplication — ajouté à la migration 022

Un quatorzième index conditionne le bon fonctionnement des tâches cron :
`notifications (ecole_id, utilisateur_id, cle_unicite) WHERE cle_unicite IS NOT
NULL`. Il avait été omis de la première version de la migration.

S'il manque, les deux consommateurs échouent **différemment**, ce qui rend le
diagnostic trompeur :
- `notification.utils.js` cible explicitement le conflit → `42P10`, envoi en
  erreur, visible ;
- la diffusion d'annonces plateforme emploie `ON CONFLICT DO NOTHING` **sans
  cible** → ne lève rien, ne déduplique simplement pas. Republier une annonce
  trois fois la dépose trois fois dans chaque boîte, en silence.

---

#### AUD-17 · P1 · La clôture d'une période ne valait que pour les notes

`verifierPeriodeModifiable` — les trois verrous (période clôturée / année
clôturée / année non active) — était une fonction **locale et non exportée** de
`notes.controller.js`. Elle y protégeait parfaitement ses huit chemins
d'écriture, et rien d'autre.

Or trois modules écrivent dans la table `bulletins`, pas un :

| Module | Écrit | Verrou avant correction |
|---|---|---|
| `notes.controller` | total, pourcentage, classement, mention | ✅ les trois |
| `discipline.controller` | conduite | ❌ aucun |
| `ia.controller` | observation | ❌ seulement `signe_at IS NULL` |

**Effet réel** : un Préfet clôture la 2ᵉ période. Les notes se figent, comme
promis. Et le report de conduite continue d'écrire dessus ; les appréciations
générées par l'IA aussi, des mois après. Un bulletin non signé d'une période
clôturée restait modifiable par deux chemins sur trois.

La clôture est une promesse faite à l'école : « à partir de maintenant, plus
rien ne bouge ». Une promesse qui ne tient que sur un module sur trois n'en est
pas une.

**Correction.** Extraction dans `utils/periode.utils.js`, appliqué aux trois
modules. Le paramètre `quoi` adapte le message : « plus aucune note ne peut y
être saisie » devant un report de conduite n'aurait rien voulu dire.

**Test.** 5 assertions vérifient que les trois modules importent ET appellent le
verrou, et qu'aucune copie locale ne subsiste — deux copies divergeraient dès la
première correction.

---

### Index d'unicité — VÉRIFIÉS sur la base réelle le 7 août 2026

La partie 1 de la migration 022 a été exécutée. **Les 13 index attendus
existent tous** (`existe = true` sur les 13 lignes). Le risque `42P10` sur les
clauses `ON CONFLICT` est **écarté**.

Reste à vérifier le **quatorzième**, partiel et donc absent de cette requête :
`notifications (ecole_id, utilisateur_id, cle_unicite) WHERE cle_unicite IS NOT
NULL`. La requête dédiée est dans la partie 1 du fichier.

### Isolation multi-écoles — le point qui reste ouvert, et pourquoi

Un décompte a été fait sur le code : **236 requêtes** filtrent sur un
identifiant venu du client (`WHERE id = $1`, `WHERE eleve_id = $1`…) **sans
mentionner l'école dans la même requête**. Réparties ainsi :

```
structure 29 · inscriptions 23 · notes 22 · bulletins 17 · archives 13
présences 12 · discipline 10 · ia 10 · emploi-du-temps 8 · travaux 8 …
```

**Ce n'est pas un défaut** — c'est le bon design : confier l'isolation à la RLS
plutôt qu'à la vigilance de chaque contrôleur rend l'oubli impossible. Mais cela
transfère toute la sécurité multi-écoles sur trois faits de base de données,
dont **aucun n'apparaît dans un export de schéma** :

1. RLS activée sur chaque table portant `ecole_id` ;
2. une policy effectivement posée sur chacune ;
3. le rôle de connexion n'est ni propriétaire des tables, ni SUPERUSER, ni
   BYPASSRLS.

Le point 3 est le plus traître. **Le propriétaire d'une table ignore RLS par
défaut**, sans erreur ni avertissement : les policies existent, elles sont
correctes, elles ne s'appliquent pas. C'est exactement le piège évoqué par le
commentaire d'`auth.controller.js` (« au lieu du rôle postgres qui le
contournait »). `FORCE ROW LEVEL SECURITY` est la seule parade.

Si l'une des trois conditions manque, un utilisateur lit les données d'une autre
école en remplaçant un UUID dans l'URL — sur 236 requêtes.

**Impossible à trancher depuis le code seul.** La partie 4 de la migration 022
contient les quatre requêtes qui répondent, dont un test VIVANT (4d) qui pose
`app.current_ecole_id` et compte les lignes d'autres écoles. C'est le seul
résultat de tout ce fichier qui justifierait d'arrêter la production.

---

### Permissions — matrice passée en revue

Les dix rôles ont été parcourus route par route. **Aucun changement de droits
n'a été appliqué** : le découpage existant s'est révélé cohérent, et le seul
point discutable relève d'une décision de produit (voir « À arbitrer »).

Points contrôlés et jugés corrects :
- la cote appartient à l'enseignant ; direction et préfet valident, dévalident
  et clôturent, mais n'écrivent pas dans une grille où ils ne sont pas affectés
  (`professeurEstAutorise`) ;
- le verrou de validation vaut pour tout le monde, direction comprise ;
- le mode observation du Super Admin est en lecture seule, verrouillé
  globalement dans `server.js` et non route par route ;
- l'Explorateur Super Admin est en lecture seule par branche entière ;
- `verifierAccesClasse()` distingue lecture et écriture selon le
  `mode_presences` de l'école ;
- les routes `/jobs` et `/public` sont les seules non authentifiées, et le sont
  volontairement.

**Non résolu, signalé** : `server.js` laisse passer sans authentification toute
requête dépourvue d'en-tête `Authorization` (`if (!req.headers.authorization)
return next()`). Chaque module de routes rattrape avec son propre
`router.use(authMiddleware)` — la vérification a été faite, aucun module n'y
échappe aujourd'hui. Mais **toute route ajoutée sans ce garde-fou local serait
publique sans que rien ne le signale.** À reprendre.

### Calculs — règles vérifiées et harmonisées

| Règle | Source unique désormais | Employée par |
|---|---|---|
| Maximum d'un cours selon le type de période | `utils/bareme.utils.js` (**nouveau**) | notes, repêchage, parcours ; déjà appliquée dans les gabarits officiels et `moyennes.utils` |
| Pourcentage d'un élève sur une portée | `utils/moyennes.utils.js` | rapports, tableau de bord, repêchage, **promotion**, **orientation**, **bulletin de semestre**, **bulletin annuel** (tous nouveaux) |
| Total d'un semestre / de l'année | somme des points sur somme des maxima (§9.1) | plus aucun `AVG(pourcentage)` sur un bulletin |
| Total des frais dus | `utils/frais.utils.js` | frais, contrôle financier, **rapports, tableau de bord, reçu, parcours, assistant** (nouveaux) |
| Conversion de devise | `utils/devise.utils.js` | inchangé, étendu à parcours et à l'assistant |

### Sécurité — ce qui a été contrôlé

Vérifié et jugé correct : hachage bcrypt ; jeton d'accès court + jeton de
rafraîchissement opaque haché en base ; message générique sur mot de passe
oublié ; révocation des sessions à la réinitialisation ; secret partagé sur les
routes cron ; signature Meta sur le webhook WhatsApp ; harnais IA
(`SET TRANSACTION READ ONLY` + `SET LOCAL ROLE ia_lecture` + `statement_timeout`)
et garde-fou SQL applicatif refusant les instructions multiples, les
commentaires et les relations hors des onze vues `ia_*` ; limiteurs de débit
dédiés sur connexion, résultats publics, IA, recherche et outils.

Aucun accès direct au pool ne contourne `runWithTenant()` : vérifié, zéro
occurrence de `pool.query` hors `config/db.js`.

**Risques signalés, non corrigés** — voir « Risques connus ».

### Outils livrés

- **`scripts/verifier-imports.js`** (nouveau, sans dépendance). Contrôle que
  chaque `require` relatif pointe vers un fichier existant, que chaque nom
  destructuré est réellement exporté, que chaque handler `ctrl.machin` d'un
  fichier de routes existe, et que `CURRENT_ECOLE` n'est jamais employée sans
  être définie. C'est le contrôle que §11 bis réclamait et qu'un `require()`
  réel exigerait — impossible sans `npm install`. **Il a trouvé AUD-03**, que
  la lecture avait manqué, et a rattrapé une erreur commise pendant l'audit
  lui-même (`CURRENT_ECOLE` non définie après un déplacement de requête).
  État : `✓ 141 fichiers analysés — aucun import ni handler cassé.`
- **`test/bareme.test.js`** (nouveau, sans dépendance). 49 vérifications :
  la règle de barème, la forme du fragment SQL, et l'**absence des motifs
  exacts** qui ont produit chacun des défauts corrigés. Ce dernier point est
  délibéré : ces bugs se sont propagés par copier-coller, un test qui refuse le
  motif est le seul à empêcher la recopie. État : `49 réussies, 0 échec`.
- **`audit-contrat-api.py`** (nouveau, frontend). Le contrôle qui manquait à
  `audit-frontend.py` : la frontière entre les deux moitiés. Voir « Audit
  frontend » plus haut.
- **`migrations/022-controle-unicite-et-derives.sql`** (nouveau). Ne modifie
  rien par défaut. Contient la requête qui dit lesquels des treize index
  d'unicité attendus par le code existent réellement, et documente cinq dérives
  de schéma constatées.

### Commandes

```bash
npm test          # vérificateur d'imports + suite de barème
npm run verifier  # vérificateur d'imports seul
```

### Dérives de schéma constatées (schéma réel, aucune action automatique)

1. **`utilisateurs` ne porte aucune unicité sur (email, école).** `login`
   sélectionne `WHERE email = $1 AND ecole_id IS NOT DISTINCT FROM $2` puis
   prend `rows[0]` **sans `ORDER BY`**. Deux comptes de même adresse dans la
   même école, et c'est PostgreSQL qui choisit lequel se connecte — mot de
   passe comparé, rôles accordés et identité journalisée compris. Le cas
   survient sans malveillance : un compte créé deux fois pour la même personne.
   Migration `022`, partie 2 : requête de détection des doublons puis index,
   commenté, à décommenter une fois les doublons tranchés.
2. **`annees_scolaires` porte trois drapeaux pour deux états** : `active`,
   `cloturee` (tous deux écrits par le code) et `statut` (**écrit par personne**).
   `statut` vaut donc « active » sur toutes les années, y compris clôturées.
3. **`eleve_classe_historique`** porte `resultat_final` ET `resultat`.
4. **`frais_scolaires.montant_usd` / `.montant_fc`** ne sont ni lues ni écrites
   nulle part : colonnes mortes depuis la migration 001.
5. **`regles_classement`** (colonne `regle_egalite`) n'apparaît dans aucun `.js` :
   la table promet un réglage qui n'existe pas, la règle est écrite en dur.
6. **`paiements.methode`** est une énumération : vérifier qu'elle connaît
   `especes`, `virement_bancaire` et `cheque`, sinon AUD-07 échoue en `22P02`.

#### AUD-11 · P0 · Bulletins de semestre et annuel : moyenne au lieu de somme

**Arbitré par le propriétaire le 7 août 2026** : le total annuel est la SOMME
des deux semestres. C'est la règle §9.1, celle du bulletin officiel :

```
tot1 = P1 + P2 + Examen1        sur  2 × maxPériode + maxExamen
tot2 = P3 + P4 + Examen2        sur  2 × maxPériode + maxExamen
T.G. = tot1 + tot2              sur  2 × maximum d'un semestre
```

**Problème.** `recalculerBulletinSemestre` faisait la MOYENNE DES POURCENTAGES
de ses trois composantes, et `recalculerBulletinAnnuel` la moyenne des deux
semestres.

Au niveau du SEMESTRE, c'est faux sans discussion : les trois composantes n'ont
pas le même barème, l'examen vaut le double d'une période.

```
P1 8/10 · P2 8/10 · Examen 10/20
  somme officielle : 26/40                = 65,0 %
  moyenne des %    : (80 + 80 + 50) / 3   = 70,0 %
```

Cinq points d'écart **sur le même document** : la grille imprimée par
`assemblerDonneesSemestre` affichait 65 % pendant que la ligne stockée dans
`bulletins` — celle qui décide de la mention et du rang — portait 70.

Au niveau de l'ANNÉE, la moyenne des deux semestres donne le même nombre que la
somme **tant que les deux semestres ont exactement le même maximum**. C'est le
cas normal : le résultat était juste par accident. Il divergeait dès que
l'hypothèse tombait — cours ajouté au second semestre, examen configuré d'un
seul côté, élève n'ayant composé qu'un semestre, ou école en trimestres.

**Correction.** Les deux passent par `pourcentagesParEleve()` : somme des points
obtenus sur somme des maxima. L'année n'a plus besoin des lignes de
regroupement comme intermédiaire de calcul — additionner les deux semestres
revient à additionner toutes les périodes de travail. Les regroupements restent
recalculés parce que le bulletin les IMPRIME.

`bulletins.total` est désormais renseigné sur ces deux lignes : elles disaient
le rang et la mention sans jamais dire d'où ils venaient.

**Effet de bord vertueux** : un élève sans aucune cote n'apparaît plus du tout
dans le calcul (`inclureNonNotes: false`), donc ne peut plus recevoir de rang
factice. Cela remplace le correctif AUD-09, qui traitait le symptôme.

**Fichiers.** `controllers/bulletin-semestre.controller.js`,
`controllers/bulletin-annuel.controller.js`, `utils/moyennes.utils.js`
(expose désormais `nom` / `postnom` / `prenom` en plus de `nom_complet`, que
`bulletin-annuel.html` affiche colonne par colonne).

**ATTENTION — cette correction change des mentions déjà attribuées.** Les
bulletins de semestre et d'année produits avant elle portent un pourcentage
plus élevé lorsque le barème d'examen diffère du double de la période. Rejouer
`POST /notes/recalculer` puis régénérer les bulletins concernés, et prévenir les
écoles avant de republier.

---

#### AUD-12 · P1 · Le bulletin annuel du primaire sortait vide

Trouvé en corrigeant AUD-11. `recalculerBulletinAnnuel` cherchait ses
regroupements avec `type = 'semestre'` — uniquement. Une école PRIMAIRE tourne
sur **trois trimestres** : la requête ne ramenait rien, aucun regroupement
n'était recalculé, et le tableau récapitulatif du bulletin annuel restait vide.
Le commentaire du fichier mentionnait pourtant « deux semestres (ou trois
trimestres au primaire) » : l'intention était écrite, le filtre ne l'a jamais
suivie.

**Correction.** `type::text IN ('semestre', 'trimestre')`, aux deux endroits —
le recalcul et la grille imprimée.

**Statut.** Corrigé, vérifié statiquement. **Le rendu du bulletin primaire
reste non vérifié visuellement.**

---

### À arbitrer par le propriétaire — décision NON prise

**Qui enregistre un paiement de frais ?** `POST /frais/paiements` est ouvert au
Directeur et au Comptable. La question posée dans la commande d'audit est
légitime, mais beaucoup d'écoles congolaises n'ont pas de comptable : retirer ce
droit au Directeur les mettrait à l'arrêt. **Recommandation : conserver.**

En revanche un défaut réel se cache à côté : `DELETE /frais/paiements/:id`
**supprime** la ligne. Un encaissement doit s'annuler de façon tracée, jamais
disparaître — un reçu a été remis à une famille. À reprendre en annulation
(`annule_at`, `annule_par`, `motif_annulation`) plutôt qu'en suppression.

### Fonctionnalités encore incomplètes

- **Discipline** : le module existe et fonctionne (signalement, capital de
  conduite, règlement importable), mais son **impact sur les bulletins** n'est
  branché que partiellement. `bulletins.conduite` est écrit ; rien ne relie
  automatiquement le capital de conduite au bulletin annuel.
- **Export comptable** (PDF, Excel) pour contrôle externe : non commencé.
- **Mode édition (`ArdoiseEdition`)** : toujours déployé sur la seule page
  `parametres.html`.
- **Navigation contextuelle** : les écrans cibles surlignent mais ne filtrent pas.
- **`middleware/*.template.js`** : quatre fichiers morts, non référencés,
  toujours présents. Non supprimés pendant cet audit — sans le dépôt complet,
  la prudence l'emporte sur le nettoyage.

### Risques connus — ce qui reste à vérifier par un humain

1. **Les migrations n'ont pas pu être relues** : elles ne sont pas dans le dépôt
   fourni. Tout ce que cette section dit du schéma vient de l'export SQL, qui
   ne contient aucun index.
2. **Les treize `ON CONFLICT` du code** dépendent d'index d'unicité dont
   l'existence n'est pas prouvable depuis l'export. Un seul manquant fait
   échouer toute une fonctionnalité (`42P10`). Migration `022`, partie 1.
3. **Aucune correction n'a été exécutée contre PostgreSQL.** Les requêtes SQL
   modifiées sont syntaxiquement plausibles et suivent les motifs existants du
   projet ; elles n'ont pas tourné.
4. **Le rendu des bulletins reste non vérifié visuellement**, y compris après
   AUD-03 : rétablir l'appel n'est pas vérifier la mise en page.
5. **AUD-02 change des décisions de promotion.** À rejouer sur une classe réelle
   et à comparer aux résultats attendus avant la promotion de fin d'année.
6. **AUD-04 change des montants dus affichés aux familles.** Les montants
   augmenteront là où plusieurs lignes de frais existent : c'est la correction,
   mais elle doit être annoncée aux écoles concernées.
7. **`server.js` : authentification globale contournable par absence d'en-tête**
   (voir « Permissions »). Aujourd'hui sans effet, structurellement fragile.
8. **Le rendu mobile et les appels IA réels** restent non vérifiés, comme
   l'indiquait déjà §12.

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

## 12 bis. FILTRE DE CYCLE (primaire / secondaire / les deux)

- **Pour qui** : les seules écoles `type_enseignement = 'les_deux'`. Ailleurs le
  sélecteur ne s'affiche pas et aucun paramètre n'est ajouté.
- **Où** : `utils/cycle.utils.js` (serveur) et `Scolaire-HTML-main/filtre-cycle.js`
  (écran). Le module front complète `window.fetch` une seule fois plutôt que les
  centaines d'appels des pages : le premier oubli rouvrirait le mélange que le
  filtre ferme. Seuls les GET d'une liste explicite de chemins sont complétés.
- **Le filtrage est fait par le SERVEUR.** Filtrer dans le navigateur laisserait
  toujours une liste déroulante remplie avant l'application du filtre.
- **`cycle IS NULL` est toujours accepté** : les lignes antérieures à la
  migration 003 n'ont pas de cycle. Les exclure ferait disparaître des classes
  bien réelles que l'école ne pourrait plus corriger, puisqu'elle ne les verrait
  plus.
- **Écrans couverts** : Classes, Élèves, Inscriptions, Orientation, Notes,
  Bulletins, Bulletin annuel, Repêchage, Présences, Discipline, Emploi du temps,
  Rapports, Année scolaire (promotion).
- **Volontairement NON couverts** : Cours et Options (ces tables n'ont aucune
  colonne de cycle — voir « Non fait volontairement »), Frais, Comptabilité,
  Utilisateurs, Paramètres.
- **Piège traité** : dans `moyennes.utils.js`, la CTE `maxima` croisait TOUTES
  les classes avec TOUTES les périodes de la portée. Sur une portée large
  (« tous les examens », « année complète ») d'une école mixte, une classe du
  secondaire recevait donc le barème des sessions du primaire par-dessus le
  sien. La CTE joint désormais `classes` et n'apparie que les cycles compatibles.

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
| `AUDIT_INGEST_SECRET` | **Nouveau (session 11 quinquies).** Secret technique du point d'ingestion des audits (`POST /audits/executions`). **Minimum 16 caractères.** Non défini ou trop court ⇒ le point d'entrée est FERMÉ (401), ce qui est le comportement voulu : il ne s'ouvre jamais « en attendant la configuration ». Ne donne accès qu'aux tables `audit_runs` et `audit_findings` — aucune donnée métier. |
| `ARDOISE_API_URL` | **Nouveau.** Côté CI/terminal uniquement (pas Render). Adresse du backend pour `audit-all.py --publier`. |
| `RENDER_GIT_COMMIT` | Fourni automatiquement par Render. Repris dans les métadonnées des bugs pour identifier le déploiement fautif. À défaut, `VERSION_DEPLOIEMENT`. |

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
- `directeur_discipline` ouvre les menus Discipline et Présences, mais **aucune logique métier propre à la discipline n'est écrite pour lui** — ne pas supposer que le chantier discipline est entamé juste parce que le rôle est branché.
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


---

## 11 quinquies. SESSION DE CORRECTION — 11 août 2026

Cette section complète les sections 11 bis à 11 quater. Elle ne les remplace
pas et ne crée pas de second document : tout reste dans ce `HANDOVER.md`.

### A. Les cinq causes racines

**1. Le didacticiel ne connaissait pas l'offre de l'école.**
`construireParcours()` recevait `{ cycle: f._cycle }` et rien d'autre.
`catalogue.utils.js` savait tout des droits, `onboarding.utils.js` n'en savait
rien, et les deux ne se parlaient pas. Une école en Ardoise Ascension se voyait
donc proposer « Emploi du temps » — étape que son menu masque et que la route
refuse en 402. Elle ne pouvait ni la faire, ni la passer : sa progression
plafonnait sous 100 % **définitivement**, et le directeur en concluait
raisonnablement que la plateforme était cassée.

**2. `modeles_bulletins` exigeait un geste impossible.**
L'étape était obligatoire, pointait vers `generateur-modeles.html` (verrouillé
par `modeles_personnalises`) et demandait « Cliquez sur Nouveau modèle ». Or
`bulletins.controller.js` retombe sur les gabarits officiels RDC dès que la
sélection de modèle actif ne renvoie rien : **aucune école n'a jamais eu besoin
de créer un modèle pour imprimer un bulletin conforme.** L'étape rendait donc le
parcours infranchissable pour exiger quelque chose d'inutile.

**3. Le point de signalement des bugs était derrière `superAdminSeul`.**
Dans `super-admin.routes.js`, toutes les routes suivent
`router.use(authMiddleware, superAdminSeul)` — y compris
`POST /super-admin/bugs/signaler`, dont le commentaire affirmait pourtant
qu'elle était « utilisable par le front applicatif ». Elle ne l'était pas.
Conjuguée au fait que seul l'espace Super Admin posait des capteurs globaux, la
conséquence était nette : **la seule personne dont les incidents étaient
enregistrés était celle qui pouvait déjà les lire.**

**4. Six fonctionnalités vendues n'étaient verrouillées nulle part.**
`emploi_du_temps`, `site_public`, `concours_admission`, `orientation`,
`repechage`, `rapports_avances`. Le menu les masquait ; l'URL directe les
servait. Masquer une entrée de menu n'a jamais été une sécurité.

**5. Les audits pouvaient réussir sans rien vérifier.**
Chemins en dur propres à une machine, `glob` sur un dossier inexistant qui
renvoie une liste vide sans lever, code de sortie 0 malgré des anomalies. Trois
scripts sur six annonçaient « aucun problème » **après avoir examiné zéro
fichier** — le pire mode de défaillance possible pour un outil de contrôle,
puisqu'il est indiscernable d'un succès.

### B. Fichiers modifiés

**Backend — modifiés**

| Fichier | Nature |
|---|---|
| `utils/onboarding.utils.js` | Moteur d'applicabilité ; champs `fonctionnalite`, `categorie`, `depend_souple` ; `modeles_bulletins` réécrite ; `modeles_personnalises` et 3 découvertes ajoutées ; `lireProgression` v2 ; `centreApprentissage(roles, droits)` |
| `controllers/assistant.controller.js` | `chargerDroits()` ; droits transmis aux 3 points d'entrée ; `etat-installation` devenue couche de compatibilité sur le même moteur ; actions `non_utilisee` / `reactiver_etape` ; détection des modèles officiels |
| `utils/catalogue.utils.js` | `droitsDeLEcole()`, `droitsComplets()`, `signatureDroits()` |
| `routes/emploi-du-temps.routes.js` | Verrou d'offre par route (voir matrice) |
| `routes/site-public.routes.js`, `inscriptions.routes.js`, `repechage.routes.js` | Verrou d'offre sur le routeur entier |
| `routes/orientation.routes.js` | Verrou sur tout sauf `/acces` |
| `routes/rapports.routes.js` | Verrou sur les rapports analytiques seulement |
| `controllers/rapports.controller.js` | Contrôle d'offre **par type** dans `exporter()` — ferme le contournement `?type=palmares` |
| `routes/super-admin.routes.js` | Routes `prospects` enfin montées ; routes de lecture des audits |
| `controllers/super-admin-support.controller.js` | `body.ecole_id` conditionné à `isSuperAdmin` |
| `server.js` | Corrélation, capteur 5xx, `/incidents`, `/audits`, gestionnaire final persistant |
| `scripts/verifier-imports.js` | Neutralisation des commentaires avant analyse |

**Backend — créés**

`utils/journal-erreurs.utils.js`, `middleware/erreurs.middleware.js`,
`routes/incidents.routes.js`, `controllers/audits.controller.js`,
`routes/audits.routes.js`, `migrations/030-journal-erreurs-et-audits.sql`,
`test/onboarding-offre.test.js`, `test/matrice-offres.test.js`,
`test/erreurs-remontee.test.js`.

**Backend — renommé**

`routes/super-admin.routes.EXTRAIT.js` → `.EXTRAIT.js.md`.

**Frontend — modifiés**

`ui.js` (bannière autonome à la place de `alert()`), `audit-contrat-api.py`,
`audit-sql.py`, `audit-frontend.py`, `audit-responsive.py`, `audit-mobile.py`,
`generateur/audit.py`, `annee-scolaire.html` (garde de forme), les 4
`apercu-bulletin-*.html`, `changer-mot-de-passe.html`,
`reinitialiser-mot-de-passe.html`, `confidentialite.html`, et les 33 pages
applicatives (balise `remontee-erreurs.js`).

**Frontend — créés**

`remontee-erreurs.js`, `audit_commun.py`, `audit-all.py`,
`installer-remontee-erreurs.py`.

### C. Migration

**Une seule migration ajoutée : `030-journal-erreurs-et-audits.sql`.**
À jouer **après `029-correctif-rls-catalogue.sql`**. Idempotente.

Elle fait trois choses :

1. **Index unique sur `bugs_plateforme.empreinte`.** Point le plus important
   du fichier : `signalerBug` écrit depuis toujours avec
   `ON CONFLICT (empreinte) DO UPDATE`, clause qui **exige** une contrainte
   d'unicité. Sans l'index, PostgreSQL refuse l'insertion, le contrôleur
   rattrape et répond 202 « non enregistré » — **le centre de bugs reste vide
   en permanence et rien ne le signale.** Un dédoublonnage préalable reporte
   les compteurs d'occurrences avant création de l'index.
2. Tables `audit_runs` et `audit_findings`, avec la contrainte
   `audit_runs_zero_fichier_non_reussi` : **zéro fichier examiné avec un
   statut « réussi » est rejeté par la base**, pas seulement par convention
   dans les scripts.
3. RLS Super Admin exclusif sur les deux tables. Attention au nom du
   paramètre : `app.is_superadmin` **en un seul mot**, tel que `config/db.js`
   le pose. Écrit `app.is_super_admin`, `current_setting` renvoie NULL sans
   lever, la politique est toujours fausse, et les tables deviennent
   invisibles **y compris au Super Admin** — l'ingestion répondrait alors
   « 0 anomalie » de façon parfaitement crédible.

### D. Matrice offres / pages / routes / étapes

Vérifiée par `test/matrice-offres.test.js`, qui échoue si une fonctionnalité
est ajoutée au catalogue sans être inscrite dans la matrice.

| Fonctionnalité | Pages | Routes verrouillées | Laissé ouvert (et pourquoi) | Étapes | Rôles |
|---|---|---|---|---|---|
| `emploi_du_temps` | `emploi-du-temps.html` | `/configuration`, `/classe/:id`, `/seance`, `/exceptions` | `/mon-emploi`, `/aujourdhui` — appelées au chargement de tous les écrans ; un 402 y ouvrirait la modale d'offre en boucle | `creneaux`, `emploi_du_temps`, `decouverte_emploi_du_temps` | directeur, préfet |
| `site_public` | `site-public.html` | routeur entier | — (les pages familles sont dans `public.routes.js`, sans jeton) | `decouverte_site_public` | directeur, secrétaire |
| `concours_admission` | `inscriptions.html` | routeur entier | — (**inscrire** un élève passe par `/eleves`, jamais verrouillé) | `decouverte_inscriptions` | directeur, préfet, secrétaire |
| `orientation` | `orientation.html` | `/`, `/voeux`, `/repartir`, `/options/:id/critere`, `/:eleveId` | `/acces` — sonde de menu appelée sur toutes les pages, ne renvoie qu'un booléen | `decouverte_orientation` | directeur, préfet, titulaire |
| `repechage` | `repechage.html` | routeur entier | — | `decouverte_repechage` | directeur, préfet |
| `rapports_avances` | `rapports.html` | `/reussite`, `/palmares`, `/moyennes`, `/portees`, `/assiduite` | `/effectifs`, `/finances` (gestion quotidienne) ; `/export` contrôlé **par type** dans le contrôleur | — | directeur, préfet, secrétaire, comptable |
| `comptabilite` | `comptabilite.html` | `/categories`, `/mouvements`, `/tresorerie` | — | `decouverte_comptabilite` | directeur, comptable |
| `paie` | `comptabilite.html` | `/contrats`, `/paie` | la page reste conditionnée sur `comptabilite` : masquer la page entière priverait de sa caisse une école qui n'a pas la paie | — | directeur, comptable |
| `discipline` | `discipline.html` | `/incidents` | — | `discipline_bareme`, `decouverte_discipline` | directeur, titulaire, dir. discipline |
| `modeles_personnalises` | `generateur-modeles.html` | routeur modèles | — | `modeles_personnalises` | directeur |
| `communication_masse` | `messages.html` | diffusion (contrôleur) | `/messages` — écrire à un collègue est ouvert à tous | — | directeur, préfet, secrétaire |
| `ia_analyse_donnees`, `ia_reglement_discipline`, `whatsapp` | — | routes IA / WhatsApp | — | — | directeur, préfet |

**Socle jamais verrouillable** — élèves, classes, cours, notes, bulletins
officiels, présences, frais. Un test vérifie qu'aucune de leurs routes ne porte
`exigeFonctionnalite`, et qu'aucun de ces mots n'existe comme code de
fonctionnalité.

**Exceptions sans verrou, justifiées** : `assistant_aide`, `ia_appreciations`
(ouverts dans les quatre offres), `support_prioritaire` (engagement humain, pas
une route). La liste est plafonnée à quatre entrées par le test.

### E. Résultats de tests — avant / après

| Vérification | Avant | Après |
|---|---|---|
| `node scripts/verifier-imports.js` | **1 anomalie** | 167 fichiers, **0** |
| `node middleware/offre-middleware.test.js` | **14/15 — ÉCHEC** | **15/15** |
| `node test/bareme.test.js` | 49/49 | 49/49 |
| `node test/notifications.test.js` | 182/182 | 182/182 |
| `node test/catalogue.test.js` | 15/15 | 15/15 |
| `test/onboarding-offre.test.js` *(nouveau)* | — | **24/24** |
| `test/matrice-offres.test.js` *(nouveau)* | — | **16/16** |
| `test/erreurs-remontee.test.js` *(nouveau)* | — | **22/22** |
| `audit-frontend.py` | 43 pages par repli accidentel | 43 pages, chemin explicite, **0** |
| `audit-responsive.py` | 12 importants, **code 0** | **0 anomalie**, code 0 |
| `audit-sql.py` | **0 requête**, « 0 en défaut » | **1135 requêtes**, 0 en défaut |
| `audit-contrat-api.py` | `FileNotFoundError` | 63 fichiers, **0** |
| `generateur/audit.py` | 0 fichier = « succès » | **20 pages réelles**, 0 |
| `audit-mobile.py` | impossible à lancer | 43 pages mesurées, **0 débordement** |
| `audit-all.py` *(nouveau)* | — | 9 audits, 8 verts |

### F. Configuration Render / Supabase / GitHub Actions

**Supabase** — jouer `030-journal-erreurs-et-audits.sql` après `029`. Vérifier
ensuite :

```sql
SELECT indexname FROM pg_indexes
 WHERE tablename = 'bugs_plateforme' AND indexname LIKE '%empreinte%';
-- doit renvoyer bugs_plateforme_empreinte_key
```

**Render** — ajouter `AUDIT_INGEST_SECRET` (≥ 16 caractères, généré
aléatoirement). Sans lui, `/audits/executions` répond 401 à tout : c'est
volontaire. `RENDER_GIT_COMMIT` est fourni automatiquement.

**GitHub Actions** — workflow suggéré (non créé dans cette session) :

```yaml
- run: pip install playwright && python3 -m playwright install --with-deps chromium
- run: python3 audit-all.py --backend ../backend --json rapport.json --publier
  env:
    ARDOISE_API_URL: ${{ secrets.ARDOISE_API_URL }}
    AUDIT_INGEST_SECRET: ${{ secrets.AUDIT_INGEST_SECRET }}
```

Codes de sortie : `0` réussi, `1` anomalies produit, `2` au moins un audit n'a
pas pu tourner. **Un `2` est plus grave qu'un `1`** : avec un `1` on sait ce qui
ne va pas, avec un `2` on ne sait pas ce qu'on ignore.

### G. Risques restants

1. **La migration `030` n'a pas été exécutée** — aucune base disponible pendant
   cette session. Idempotente et avec dédoublonnage préalable, mais à jouer sur
   une copie avant production. C'est le risque numéro un de cette livraison.
2. **Le didacticiel n'a pas été essayé dans un navigateur** contre un backend
   réel. La logique est couverte par 24 tests, mais le rendu de
   `etapes_ecartees` dans `didacticiel.js` reste à câbler côté interface :
   le backend l'expose, le frontend ne l'affiche pas encore.
3. **`remontee-erreurs.js` n'a pas été vu à l'œuvre contre un vrai serveur.**
   Le nettoyage des secrets et des piles est testé unitairement ; le trajet
   complet navigateur → `/incidents/signaler` → `bugs_plateforme` ne l'est pas.
4. **L'audit mobile signale 54 constats de faible gravité** — textes sous
   11,5 px et cibles tactiles sous 36 px, surtout sur les aperçus de bulletins
   (inhérent à un A4 rendu en miniature) et les tableaux denses. Aucun
   débordement horizontal. À traiter au fil de l'eau, pas bloquant.
5. **La bannière de repli de `ui.js`** (remplaçant `alert()`) n'a pas été
   testée visuellement sur les pages hors session.
6. Les découvertes `orientation`, `repechage` et `site_public` supposent que
   `orientation.html`, `repechage.html` et `site-public.html` existent bien —
   c'est le cas dans ce dépôt, mais un renommage casserait le guidage sans
   qu'aucun test ne le voie.

---

## 23. SYSTÈME D'E-MAILS TRANSACTIONNELS — refonte et correctifs Gmail (11 août 2026)

Cette section remplace toute description antérieure de l'apparence ou du
fonctionnement des e-mails. L'ancien rendu était sombre par défaut, très
textuel, et le logo horizontal était forcé dans une boîte carrée de
`36 × 36 px`. Les illustrations présentes dans le dépôt n'étaient pas
injectées dans le gabarit. Plusieurs appels construisaient encore leur propre
HTML, ce qui produisait des rendus incohérents selon le message.

### 23.1 Architecture retenue

Tous les messages passent désormais par le gabarit partagé
`utils/email-template.js`. Il fournit :

- un HTML en tableaux et styles en ligne, compatible avec Outlook et les
  anciens webmails ;
- un thème clair fiable par défaut et un thème sombre progressif pour les
  clients respectant `prefers-color-scheme` ;
- un logo Ardoise aux bonnes proportions ;
- une illustration contextuelle, sans texte important peint dans l'image ;
- des cartes, tableaux financiers, boîtes de code et boutons réutilisables ;
- une version texte automatique quand le HTML ou les images sont bloqués ;
- un expéditeur `From` maintenu sur le domaine vérifié par Resend, avec les
  réponses dirigées par `Reply-To` ;
- des URL et contenus variables échappés avant insertion.

Le catalogue couvre notamment : bienvenue, création de compte,
réinitialisation et changement de mot de passe, vérification d'e-mail,
paiements, abonnement, maintenance, bulletin, paie, frais scolaires, absence,
discipline, calendrier, admission, support, messages et demandes
d'accompagnement.

### 23.2 Correctif spécifique Gmail iOS en mode sombre

Les essais réels sur iPhone ont révélé que Gmail peut forcer son thème sombre
sans remplacer l'image claire déclarée dans un `<picture>`. Il peut aussi
éclaircir le texte d'une carte sans inverser son fond blanc. Cela produisait du
texte blanc sur fond blanc, un encadrement extérieur blanc et une zone blanche
autour du bouton.

Le correctif final applique quatre règles :

1. les cartes internes et boîtes de données restent transparentes et héritent
   de la surface principale ;
2. la carte extérieure n'impose plus un grand fond blanc indépendant ;
3. le bouton principal utilise un `bgcolor` sûr et une protection
   `mix-blend-mode` ciblée pour l'inversion Gmail ;
4. les messages les plus sensibles utilisent un PNG adaptatif réellement
   transparent et contrasté dans les deux thèmes.

Deux illustrations adaptatives sont donc utilisées :

```text
public/email/adaptive/demande.png
public/email/adaptive/reset-mdp.png
```

La réinitialisation de mot de passe pointe explicitement vers
`adaptive/reset-mdp.png`. Avant ce correctif, les images attendues répondaient
en `404`, d'où l'icône d'image cassée observée dans l'e-mail. Gmail ne permet
pas un contrôle absolu de son inversion forcée, mais le contenu, les boutons et
les cartes restent maintenant lisibles même si le client conserve une image
unique.

### 23.3 Fichiers concernés

**Backend — 11 fichiers modifiés ou ajoutés par la refonte initiale :**

```text
.env.example
env.example
NOTIFICATIONS.md
package.json
controllers/super-admin-support.controller.js
scripts/generer-apercus-email.js
test/email-template.test.js
utils/email-template.js
utils/email.utils.js
utils/notifications-catalogue.js
utils/prospects.utils.js
```

Le correctif sombre final modifie de nouveau :

```text
utils/email-template.js
test/email-template.test.js
```

**Frontend — assets de production :**

- `public/email/logo/logo-mark.png` ;
- 10 illustrations dans `public/email/illustrations/light/` ;
- les 10 variantes correspondantes dans
  `public/email/illustrations/dark/` ;
- les deux images adaptatives dans `public/email/adaptive/`.

Les dix illustrations portent les noms : `absence`, `admission`, `calendrier`,
`demande`, `discipline`, `frais-paiement`, `frais-rappel`, `message`, `salaire`
et `support`.

Le dossier `email-previews/` et ses 15 scénarios sont des aperçus de contrôle,
pas des fichiers nécessaires en production.

### 23.4 Configuration et ordre de déploiement

Variables à vérifier sur Render :

```env
EMAIL_ASSET_BASE_URL=https://myardoise.com/public/email
RESEND_FROM_EMAIL=adresse@domaine-verifie.com
RESEND_FROM_NAME=Ardoise
SUPPORT_EMAIL=adresse-de-support
FRONTEND_URL=https://myardoise.com
```

Ordre obligatoire :

1. publier d'abord le logo, les variantes clair/sombre et les deux images
   adaptatives sur le frontend GitHub Pages ;
2. vérifier que leurs URL publiques répondent `200` ;
3. déployer ensuite le backend sur Render ;
4. envoyer de nouveaux e-mails de test. Les e-mails déjà reçus ne sont pas
   réécrits.

### 23.5 Validation exécutée

```text
node test/email-template.test.js  → 32/32
node test/notifications.test.js   → 182/182
```

Les tests contrôlent notamment le rendu de chaque type, l'échappement, les
proportions du logo, la présence du thème sombre, l'absence de fond blanc figé,
le visuel adaptatif de réinitialisation, la lisibilité des cartes internes et
la version texte.

---

## 24. PAGE PROSPECTS — demandes d'accompagnement (11 août 2026)

Le bouton **« Ouvrir dans l'espace Super Admin »** des e-mails de nouvelle
demande conduit désormais à :

```text
https://myardoise.com/super-admin.html#/prospects
```

La cause initiale était une intégration incomplète : la vue, son CSS et une
partie de la logique existaient, mais le menu ne les chargeait pas et les
routes API restaient dans des fichiers `EXTRAIT` au lieu du routeur de
production.

### 24.1 Fonctionnalités de la page

- entrée **Prospects** dans le menu du Super Admin ;
- recherche par contact, école, ville, téléphone ou e-mail ;
- filtres `nouvelle`, `contactee`, `convertie` et `sans_suite` ;
- repère du délai de rappel de 48 heures ouvrées ;
- fiche complète : coordonnées, école, offre et services souhaités ;
- modification du statut ;
- rattachement à une école après conversion.

Les trois services complémentaires restent distincts de l'abonnement :
installation/configuration, formation du personnel et campagne de capture des
élèves.

### 24.2 API et sécurité

Les routes réelles sont montées après `authMiddleware` et `superAdminSeul` :

```text
GET   /super-admin/prospects
PATCH /super-admin/prospects/:id
```

La page utilise `demandes_accompagnement`, créée par
`028-catalogue-commercial.sql` et corrigée/sécurisée par
`029-correctif-rls-catalogue.sql`. **Aucune nouvelle migration n'est requise**
pour cette page si `028` et `029` sont déjà appliquées.

Tous les fichiers exécutables `super-admin.routes.EXTRAIT.js` ont été retirés
après intégration. Les extraits ne doivent jamais rester avec une extension
`.js` dans un dépôt de production ; s'ils sont conservés à titre documentaire,
ils doivent porter une extension comme `.EXTRAIT.js.md`.

### 24.3 Fichiers concernés

```text
Scolaire-HTML-main/super-admin.html
Scolaire-HTML-main/super-admin-vues-prospects.js
Scolaire-HTML-main/super-admin-styles-prospects.css
scolaire-saas-backend-main/routes/super-admin.routes.js
scolaire-saas-backend-main/controllers/prospects.controller.js
scolaire-saas-backend-main/utils/prospects.utils.js
scolaire-saas-backend-main/test/prospects-page.test.js
scolaire-saas-backend-main/package.json
```

### 24.4 Validation exécutée

```text
node test/prospects-page.test.js  → 3/3
```

Le test vérifie le menu, le chargement du CSS et du script, la présence des
routes derrière la garde Super Admin et la destination du bouton d'e-mail.
Dans le paquet d'intégration Prospects, `verifier-imports.js` a également
analysé 163 fichiers sans import ni handler cassé. Ce nombre appartient à ce
paquet précis ; la session complète du §11 quinquies conserve son propre total
de 167 fichiers.

---

## 25. PROSPECTUS COMMERCIAL A4 (11 août 2026)

Un prospectus d'une page a été créé pour les visites commerciales dans les
écoles. Il existe en image haute définition et en PDF d'impression :

```text
Prospectus-Ardoise-A4-v2.png  — 2481 × 3508 px
Prospectus-Ardoise-A4-v2.pdf  — A4, 595,276 × 841,89 points
```

Le document présente :

- l'idée générale d'Ardoise : gestion académique, administrative et
  financière sur téléphone et ordinateur ;
- les espaces et modules principaux : élèves, notes et bulletins officiels
  RDC, vie scolaire, frais, organisation, IA et rapports ;
- les quatre offres mensuelles affichées au moment de la création :
  Ascension `35 $`, Prime `59 $`, Pilote `99 $`, Infinite `159 $` ;
- les services facultatifs facturés séparément : installation, formation du
  personnel et campagne de capture ;
- un QR code vers `myardoise.com` ;
- l'adresse `myardoise@gmail.com` ;
- WhatsApp : `0855035693` ;
- une illustration de téléphone et un ordinateur portable identifiable avec
  écran, clavier et pavé tactile.

Le PDF a été vérifié comme une page A4 réelle, prête à l'impression. Si la
grille commerciale change dans le centre des offres du Super Admin, le
prospectus doit être régénéré : il s'agit d'un document statique et il ne lit
pas les prix depuis la base.

---

## 26. ÉTAT DE CONSOLIDATION ET PROCHAINE VÉRIFICATION

Les sections §11 quinquies, §23, §24 et §25 décrivent des travaux réalisés dans
plusieurs correctifs successifs. Les petits paquets de livraison ont été testés
séparément. Après application de tous ces fichiers dans les dépôts officiels,
exécuter de nouveau la suite complète afin de confirmer qu'aucun ancien fichier
n'a écrasé une version plus récente, en particulier :

```bash
node scripts/verifier-imports.js
node test/email-template.test.js
node test/notifications.test.js
node test/prospects-page.test.js
node test/onboarding-offre.test.js
node test/matrice-offres.test.js
node test/erreurs-remontee.test.js
node middleware/offre-middleware.test.js
```

Vérifier aussi manuellement :

1. e-mail de demande d'accompagnement sur Gmail iPhone en clair et sombre ;
2. e-mail de réinitialisation de mot de passe, image comprise ;
3. bouton d'e-mail vers `#/prospects` après authentification Super Admin ;
4. lecture et mise à jour d'une demande réelle ;
5. absence de fichier exécutable `*.EXTRAIT.js` ;
6. réponse HTTP `200` de tous les assets sous `/public/email/`.

Le risque principal restant est un déploiement partiel : backend mis à jour
avant les images, migration `030` non jouée, ou mélange d'anciens et de nouveaux
correctifs. Dans ce cas, le code peut être correct localement tout en affichant
encore des images cassées ou en laissant le centre de bugs vide en production.


---

## 27. SUPER ADMIN INTELLIGENCE & CONTROL CENTER

*Section ajoutée par la livraison « Ardoise Control Center ». Elle documente une
couche ADDITIVE : aucune table existante n'a été modifiée, aucun écran actuel
n'a été touché, aucune route existante n'a changé de comportement.*

---

### 27.1 Ce qui existait déjà, et pourquoi on n'y a pas touché

L'espace Super Admin était loin d'être vide. Avant cette livraison, il
comportait déjà :

| Existant | Fichier | Ce qu'il fait |
|---|---|---|
| Santé de la plateforme | `super-admin-systeme.controller.js` → `sante` | API, PostgreSQL, mémoire, cache, messagerie |
| Centre de bugs | `super-admin-support.controller.js` + `bugs_plateforme` | Exceptions de production, regroupées par empreinte |
| Capture des erreurs | `middleware/erreurs.middleware.js` | Capteur 5xx + gestionnaire final, masquage des secrets |
| Métriques d'API | `middleware/metriques.middleware.js` | Anneau en mémoire, latences, taux d'erreur |
| Journal d'activité | `middleware/journal.middleware.js` | Toute écriture, toute connexion |
| Audits statiques | `audits.controller.js` + `audit_runs`/`audit_findings` | Ingestion CI par secret technique |
| Sécurité | `super-admin-systeme.controller.js` → `securite` | Connexions échouées, sessions, appareils |
| Finance / Offres / Coûts | 3 contrôleurs + 3 fichiers de vues | Centre commercial complet |
| Explorateur | `super-admin-explorer.controller.js` | Données d'école en lecture seule stricte |
| Mode « Voir comme » | `verrouObservation` | Jeton d'observation, lecture seule globale |

**Rien de tout cela n'a été remplacé.** Le Control Center s'appuie dessus :

- il LIT `bugs_plateforme` (il ne crée pas un second centre de bugs) ;
- il LIT le collecteur de `metriques.middleware.js` (il n'en pose pas un autre) ;
- il RÉUTILISE `masquer()` / `masquerObjet()` de `journal-erreurs.utils.js`
  (une seule liste de motifs pour toute la plateforme) ;
- il RÉUTILISE `mesurer()` / `lignes()` / `pagination()` de `super-admin.utils.js` ;
- côté interface, il RÉUTILISE `SA.ui.*`, `SA.fmt.*`, `SA.graphe.*` du noyau.

### Pourquoi de nouvelles tables plutôt qu'étendre les existantes

`bugs_plateforme` répond à « quelle exception s'est produite ». Le Control
Center pose quatre questions d'une autre nature :

- cette permission correspond-elle à la règle métier ? → **constat d'audit**
- qu'a fait le système, pas seulement ce qui a planté ? → **journal technique**
- plusieurs symptômes viennent-ils d'une même panne ? → **incident**
- la plateforme va-t-elle bien, globalement ? → **score**

Aucune n'est une exception. Les loger dans `bugs_plateforme` aurait obligé à
inventer des colonnes vides pour chacune et à filtrer en permanence pour
retrouver les vrais bugs — c'est-à-dire à dégrader l'outil qui fonctionne.

---

### 27.2 Architecture — la chaîne complète

```
  RÈGLE MÉTIER          utils/regles-metier.registry.js     (45 règles, versionnées)
        ↓
  MATRICE               utils/matrice-permissions.utils.js  (rôle × ressource × action)
        ↓
  CODE RÉEL             utils/analyse-code.utils.js         (399 routes extraites de routes/*.js)
        ↓
  ÉCART                 utils/audit-*.utils.js              (3 auditeurs)
        ↓
  CONSTAT               table constats_audit                (dédupliqué, priorisé, cycle de vie)
        ↓
  DÉCISION HUMAINE      propositions_correctifs             (statut « proposee » → validation)
```

Chaque maillon est consultable séparément dans l'interface. C'est ce qui permet
de répondre à « pourquoi ce constat ? » en remontant jusqu'à l'énoncé de la
règle, plutôt qu'en faisant confiance.

### Le registre des règles est la pièce centrale

Sans lui, une IA à qui l'on montre `notes.controller.js` peut au mieux dire
« cette permission me semble étrange ». Avec lui :

```
règle RULE-GRADE-002 : un professeur ne modifie que les notes de ses cours
implémentation       : POST /notes/grille — requireRole(professeur, directeur, prefet)
écart                : le contrôleur ne vérifie pas enseignant_cours avant l'écriture
```

On passe d'une impression à une comparaison.

Le registre vit **dans le code** (`utils/regles-metier.registry.js`), versionné
et relu en revue. La base en garde une copie synchronisée au démarrage, pour
trois usages qui, eux, ont besoin de la base : jointures avec les constats,
historique des modifications, et règles ajoutées depuis l'interface
(`source = 'admin'`, jamais écrasées par un déploiement).

---

### 27.3 Tables ajoutées — migration `030-control-center.sql`

21 tables, toutes réservées au Super Admin (policy `super_admin_seul`,
`current_setting('app.is_superadmin', true) = 'true'` — le nom en un seul mot,
celui de `config/db.js`, pas celui qui avait causé la migration 029).

| Table | Rôle | Volume attendu |
|---|---|---|
| `journal_technique` | Log Explorer — ce que le système fait | **Fort** — purge par rétention |
| `regles_metier` + `_historique` | Registre synchronisé + versions | ~45 lignes |
| `constats_audit` + `_evenements` | Écarts détectés, dédupliqués par empreinte | Dizaines |
| `propositions_correctifs` | Correctifs IA en attente de validation | Faible |
| `incidents` + `_evenements` | Incidents et chronologie | Faible |
| `scores_plateforme` | Relevé horaire des 4 scores | 24 lignes/jour |
| `verifications_resultats` | Résultats des contrôles automatiques | ~500/jour |
| `drapeaux_fonctionnalites` + `_historique` | Feature flags + retour arrière | ~10 lignes |
| `maintenance_plateforme` | Mode maintenance (index unique partiel : une seule active) | Faible |
| `alertes_plateforme` + `alertes_regles` | Alertes groupées par fenêtre + configuration | Faible |
| `ia_consommation` + `ia_budgets` | Jetons, coût, modèle, budget | Modéré |
| `base_connaissance` | Fiches lues par l'IA avant de répondre | Faible |
| `decisions_techniques` | Journal des décisions | Faible |
| `rapports_automatiques` | Rapports journaliers/hebdomadaires conservés | Faible |
| `reauthentifications_super_admin` | Fenêtres d'actions critiques + trace d'usage | Faible |

**Rétention différenciée** de `journal_technique`, appliquée par la purge
quotidienne (`utils/journal-technique.utils.js` → `purger`) :

```
SECURITY 365 j · PAYMENT 365 j · TENANT 365 j · AUTH 180 j
BUSINESS 90 j · AI 90 j · CRON 60 j · EMAIL 60 j
DATABASE 30 j · FRONTEND 30 j · SYSTEM 30 j · API 14 j
```

On ne cherche pas une intrusion dans la même fenêtre de temps qu'une lenteur.

**Le rôle `ia_lecture` est explicitement révoqué** sur 9 de ces tables. Il n'a
de toute façon pas le contexte super admin, mais un `REVOKE` se modifie plus
difficilement qu'une policy.

---

### 27.4 Fichiers créés

### Backend (16 fichiers)

| Fichier | Rôle |
|---|---|
| `migrations/030-control-center.sql` | 21 tables, index, RLS, amorçage |
| `utils/regles-metier.registry.js` | **45 règles métier** + synchronisation |
| `utils/analyse-code.utils.js` | Analyseur statique — 399 routes, 55 contrôleurs |
| `utils/matrice-permissions.utils.js` | Matrice théorique rôle × ressource × action |
| `utils/audit-permissions.utils.js` | Auditeur des permissions |
| `utils/audit-multitenant.utils.js` | Auditeur d'isolation (3 angles) |
| `utils/audit-donnees.utils.js` | 18 contrôles de qualité et de workflow |
| `utils/constats.utils.js` | Persistance, déduplication, cycle de vie |
| `utils/priorites.utils.js` | Moteur de priorité |
| `utils/score-sante.utils.js` | 4 scores + décomposition + historique |
| `utils/verifications-sante.utils.js` | 11 vérifications + parcours synthétiques |
| `utils/journal-technique.utils.js` | Log Explorer — écriture par lots |
| `utils/alertes.utils.js` | Alertes groupées par fenêtre |
| `utils/drapeaux.utils.js` | Feature flags, hachage stable |
| `utils/ia-superadmin.utils.js` | Copilote — 16 outils, tous en lecture |
| `test/control-center.test.js` | **43 tests**, sans base ni réseau |

Middlewares : `reauthentification.middleware.js`, `maintenance.middleware.js`.
Contrôleurs : `control-center.controller.js`, `-audit`, `-ia`, `-systeme`.
Routes : `control-center.routes.js` (57 routes).

### Frontend (6 fichiers)

`super-admin-control-center.css`, `super-admin-vues-controle.js`,
`super-admin-vues-audit.js`, `super-admin-vues-cc-ia.js`,
`super-admin-vues-cc-systeme.js`, `super-admin-palette.js`.

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `server.js` | Middleware de maintenance + amorçage et 4 tâches périodiques |
| `routes/super-admin.routes.js` | Une ligne : montage sur `/control-center` |
| `package.json` | `test/control-center.test.js` dans `npm test` + 2 scripts |
| `test/prospects-page.test.js` | Chemin frontend tolérant (`Scolaire-HTML` **ou** `-main`) |
| `super-admin.html` | Menu (4 groupes), 1 feuille de styles, 5 scripts, `SCRIPTS_REQUIS` |
| `.gitignore` (les deux dépôts) | Créés — `node_modules` n'était retenu par rien |

---

### 27.5 L'analyseur statique — ce qu'il sait, ce qu'il ne sait pas

`utils/analyse-code.utils.js` lit `server.js`, `routes/*.js`, `controllers/*.js`
et en extrait :

- **399 routes** : méthode, chemin absolu résolu, rôles effectifs
  (intersection ligne × branche), middlewares, contrôleur et fonction visés ;
- **278 fonctions de contrôleur** : signaux d'isolation multi-écoles.

C'est de l'analyse textuelle, pas un arbre syntaxique : le projet compte
quatorze dépendances au total et tourne sur une instance Render d'entrée de
gamme. **Les limites sont énoncées dans le fichier**, pas cachées, et chacune
produit une ABSENCE de constat — jamais un faux constat.

### Deux pièges corrigés pendant l'écriture

Ils méritent d'être documentés, car ils sont exactement le genre de défaut qui
tue un outil d'audit :

1. **Gardes hoistées.** Cinq fichiers de routes déclarent
   `const PEUT_GERER = requireRole('directeur', 'prefet', 'secretaire');`
   Sans résolution, l'analyseur concluait que `router.post('/', PEUT_GERER, …)`
   n'imposait **aucun rôle**, et produisait un constat critique parfaitement
   faux sur une route parfaitement gardée. Huit routes concernées.

2. **Collision de motif de route.** Le libellé `PATCH /utilisateurs/:id`
   capturait aussi `PATCH /utilisateurs/moi`, et l'auditeur signalait en
   critique que « modifier son propre profil n'impose aucun rôle ». La
   correspondance exacte l'emporte désormais toujours.

**Trois faux constats suffisent à ce qu'un écran d'audit ne soit plus jamais
ouvert.** Les deux cas sont couverts par des tests dédiés.

### Ce que l'analyseur ne voit pas

- une route construite dynamiquement (`router[methode](...)`) — il n'y en a
  aucune aujourd'hui, et `routes_non_analysables` la signalerait ;
- un `requireRole` dont la liste de rôles serait calculée ;
- une accolade non échappée dans une chaîne peut tronquer un corps de fonction.

---

### 27.6 Les trois auditeurs

### Permissions — `utils/audit-permissions.utils.js`

Compare matrice ↔ routes réelles. Quatre familles de contrôles :

1. **écarts de rôles** — en distinguant « rôle en trop » (risque de sécurité,
   gravité élevée) de « rôle manquant » (gêne fonctionnelle, gravité modérée,
   et parfois c'est la matrice qui a tort). Les afficher pareil ferait passer un
   inconfort d'ergonomie pour une faille ;
2. **middlewares exigés** — une règle qui exige `superAdminSeul` ou
   `autoriserGenerationBulletinsTitulaire` vérifie qu'il est bien traversé ;
3. **contrôle fin annoncé** — quand la matrice déclare que le filtre de rôle
   est large À DESSEIN parce qu'une fonction du contrôleur applique la vraie
   règle (`verifierAccesClasse` pour les présences), l'auditeur **vérifie que
   cette fonction existe**. Un filtre large adossé à un contrôle fin est une
   architecture ; adossé à rien, c'est une porte ouverte. Dans le fichier de
   routes, les deux sont indiscernables ;
4. **routes d'écriture non gardées** — avec une liste `PUBLIQUES_LEGITIMES` de
   19 entrées, chacune portant SA justification (webhook signé, secret cron…).

**Couverture actuelle : 18,8 %** des 165 routes d'écriture métier. C'est
affiché à côté du verdict, jamais dissimulé — annoncer « 0 anomalie » sur un
périmètre non examiné serait le seul vrai mensonge que cet outil puisse dire.

### Multi-tenant — `utils/audit-multitenant.utils.js`

Trois angles, parce qu'aucun ne suffit seul :

| Angle | Question | Preuve |
|---|---|---|
| Statique | Que dit le code ? | `req.body.ecole_id` sans `req.auth.ecoleId` |
| Schéma | Que dit la base ? | Table portant `ecole_id` sans RLS |
| Données | Que montrent les lignes ? | Paiement dont l'école ≠ celle de son élève |

Le troisième **prouve** ; les deux premiers **préviennent**.

**La nuance la plus utile de cet auditeur** : il distingue trois situations que
le code fait se ressembler.

- *Aucun périmètre* — ni `runWithTenant(tenantContextFromReq(req))`, ni filtre
  `ecole_id` : **critique**.
- *RLS seule* — le contexte est posé, donc les policies s'appliquent, mais la
  requête ne mentionne pas `ecole_id`. Pas de fuite aujourd'hui ; **dépendance
  totale à une policy**. Une policy retirée ou mal recréée par une migration
  transforme silencieusement l'écriture en écriture inter-écoles. Classé
  **moyenne**, comme dette de défense en profondeur — **12 fonctions** sont
  dans ce cas dans le dépôt actuel.
- *Défense en profondeur* — les deux : rien à signaler.

Confondre « une seule barrière » et « aucune barrière » ferait perdre de vue le
premier cas, qui est le grave.

### Qualité des données — `utils/audit-donnees.utils.js`

18 contrôles déclaratifs, séparés en `donnees` (structure : orphelins,
doublons, références mortes) et `workflow` (processus : abonnements actifs
multiples, factures payées sans transaction, doublons de paiement, file de
notifications bloquée). Corriger la ligne sans corriger le code la fait revenir
la semaine suivante — d'où les deux types.

Un contrôle qui ne peut pas s'exécuter (colonne absente — le HANDOVER §11
quater documente des dérives de schéma) est déclaré **NON MESURABLE**, jamais
« conforme ».

**Ce module LIT.** Il ne supprime pas un doublon, ne rattache pas un orphelin.
La requête de correction suggérée est affichée pour relecture ; son exécution
est une décision humaine, hors de cet outil.

---

### 27.7 Le score de santé

```
Santé 94 · Sécurité 91 · Performance 86 · Données 98
```

**La règle qui gouverne tout le module** : un score dont on ne peut pas
expliquer la composition ne sert qu'à décorer. Chaque pénalité est nommée,
chiffrée, justifiée, et rattachée à sa source. L'interface montre la liste
complète au clic sur la carte.

### Sources — aucune donnée inventée

| Axe | Sources |
|---|---|
| Santé | collecteur de métriques, `verifications_resultats`, file du journal, `pg_stat_activity`, incidents critiques ouverts |
| Sécurité | constats `securite`/`permission`/`multitenant`, variables d'environnement, CORS, connexions échouées 24 h |
| Performance | p95/p99, requêtes lentes, `pg_locks`, requêtes longues en cours, constats de performance |
| Données | constats `donnees` et `workflow` |

Si une source est indisponible, **l'axe le dit** (`sources_indisponibles`) et sa
pénalité n'est pas appliquée. Un score calculé sur des données absentes
afficherait 100 et signifierait « je n'ai rien mesuré ».

### Pourquoi quatre scores, et un global plafonné

Le global est une moyenne pondérée (santé 30 %, sécurité 30 %, performance
20 %, données 20 %) **plafonnée au plus faible des axes + 10**. Sans ce
plafond, on pourrait afficher 88 avec une sécurité à 55, compensée par trois
axes à 99. Une plateforme qui fuit n'est pas « bonne à 88 ».

Relevé **toutes les heures** dans `scores_plateforme` : « 86 » ne dit rien,
« 86 contre 94 lundi » dit tout.

---

### 27.8 Moteur de priorité

Un auditeur quotidien produit vite 150 constats. Présentés à plat, ils ont tous
l'air également urgents, donc aucun ne l'est, et l'écran se ferme.

Score = `(gravité + écoles + utilisateurs + fréquence + récurrence + financier
+ ancienneté) × multiplicateur_de_type`, puis quatre paliers : **immédiat ·
aujourd'hui · cette semaine · plus tard**.

Trois décisions qui comptent :

- **Impact logarithmique ET plafonné** (écoles ≤ 40 pts, fréquence ≤ 25 pts).
  Un test a trouvé le défaut : sans plafond, un constat de performance touchant
  500 écoles (133 pts) devançait une fuite d'isolation critique (117 pts).
  L'ampleur module la priorité, elle ne la détermine jamais seule.
- **Le multiplicateur s'applique à l'ensemble**, pas à la seule gravité : un
  défaut d'isolation compte double sous tous ses aspects.
- **Règle absolue** : un constat `multitenant` de gravité haute ou critique est
  **toujours** en « immédiat », indépendamment du calcul. Aucune pondération ne
  peut le rétrograder.
- **Une hypothèse est décotée de 30 %** : l'IA et l'analyse par motifs
  proposent ; elles ne préemptent pas l'attention.

---

### 27.9 L'IA — architecture contrôlée

### Le modèle ne voit jamais la base

Il demande l'exécution d'un **outil nommé** ; le backend l'exécute avec le
périmètre décidé et renvoie le résultat. Pas de SQL, pas de connexion, pas
d'élargissement possible.

**16 outils, tous en lecture** :

```
getSystemHealth      getScores           getConstats        inspectConstat
getRecentErrors      inspectError        getRegleMetier     getPermissionMatrix
auditRole            getRoutes           getLogs            getIncidents
getBusinessMetrics   getSchoolStatistics getSystemDocumentation  getCoutsIA
```

Un test vérifie qu'aucun nom ne commence par un verbe d'écriture et que tous
commencent par `get`/`inspect`/`audit`. **C'est vérifiable en trente secondes
de lecture** — la meilleure garantie possible.

### Protection contre les injections d'invite (RULE-SEC-003)

Trois mesures cumulées, parce qu'aucune ne suffit seule :

1. tout contenu utilisateur est encadré par `<donnees_non_fiables>` ;
2. les séquences ressemblant à des instructions système sont **neutralisées**
   (annotées, pas supprimées : une tentative d'injection doit rester visible,
   c'est en soi une information de sécurité) ; les chevrons sont remplacés pour
   qu'un contenu ne puisse pas refermer son propre encadrement ;
3. **le modèle n'a aucun outil d'écriture.** Même convaincu, il ne peut rien
   faire. C'est la mesure la plus solide : elle ne dépend pas de la capacité du
   modèle à résister.

### Détection / proposition / exécution (RULE-SEC-004)

```
  auditeurs        ce fichier          humain, dans le dépôt
  DÉTECTION   →    PROPOSITION    →    EXÉCUTION
```

Une proposition de correctif est écrite dans `propositions_correctifs` au
statut `proposee`. **Aucune route de cette plateforme n'écrit dans un fichier
source.** Accepter une proposition change son statut, rien d'autre.

Détail volontaire : marquer un correctif « appliqué » **ne clôt pas** le
constat. C'est le prochain audit qui dira si l'écart a disparu — le fermer sur
déclaration reviendrait à croire le correctif sur parole.

### FAIT / HYPOTHÈSE / RECOMMANDATION

Imposé par l'invite système, rappelé dans chaque résultat d'outil, et **affiché
différemment** dans l'interface (pastille verte pleine contre contour pointillé
gris). Une IA qui présente une hypothèse comme un constat envoie corriger le
mauvais fichier.

### Coût

Chaque appel est mesuré dans `ia_consommation` : modèle, jetons, coût estimé,
outils appelés, durée, succès.

**Les jetons sont ESTIMÉS** à 4 caractères par jeton — `conversationAvecOutils`
ne remonte pas le champ `usage` d'OpenAI. C'est un ordre de grandeur pour le
pilotage, pas une facture, et l'interface le dit.

---

### 27.10 Sécurité de l'espace lui-même

### Ré-authentification (RULE-ADMIN-003)

Un onglet Super Admin resté ouvert sur un poste partagé ne doit pas suffire à
couper la plateforme. Une confirmation de mot de passe ouvre une fenêtre de
**15 minutes** (`REAUTH_DUREE_MINUTES`, borné 2–60), **stockée en base** — les
instances Render redémarrent souvent, et une fenêtre en mémoire produirait un
comportement apparemment capricieux. Une protection qui paraît capricieuse
finit par être désactivée.

Exigée sur : `POST /control-center/maintenance`, et la bascule d'un drapeau
vers `tous` (contrôle fait dans le contrôleur, car il dépend de la VALEUR
envoyée, pas du chemin appelé).

Chaque usage inscrit l'action dans `reauthentifications_super_admin.actions`.

**Ce n'est pas du MFA.** C'est une preuve de présence. Le TOTP reste à faire —
voir §27.14.

### Deux sens de défaillance, délibérément opposés

| Middleware | En cas de panne de lecture | Pourquoi |
|---|---|---|
| `reauthentification` | **refuse** (503) | Laisser passer transformerait une panne de base en contournement de la protection |
| `maintenance` | **laisse passer** | Refuser fermerait la plateforme entière à cause d'un incident de lecture |

Se tromper de sens sur l'un des deux serait une faute grave.

### Maintenance — les exemptions qui évitent de se verrouiller dehors

`/auth`, `/super-admin`, `/jobs`, les webhooks et `/incidents` restent
toujours ouverts, et **le Super Admin n'est jamais bloqué**. Sans ces
exemptions, activer la maintenance couperait l'accès à l'écran permettant de la
lever — exactement la situation qu'un mode maintenance est censé éviter.

### Alertes — pourquoi elles ne passent pas par `notifications_plateforme`

Cette table est celle des annonces **destinées aux écoles** : sa colonne
`cible` ne connaît que `toutes`, `ecole` et `role`. Y écrire « fuite
d'isolation détectée » avec `cible = 'toutes'` enverrait le diagnostic interne
de la plateforme à tous ses clients. Le canal « notification Super Admin » est
donc `alertes_plateforme` elle-même, lisible uniquement sous contexte super
admin.

---

### 27.11 Endpoints ajoutés (57, tous sous `/super-admin/control-center`)

```text
SUPERVISION
  GET    /synthese                       scores + priorités + état
  GET    /scores                         détail et historique
  GET    /recherche?q=                   recherche système
  GET    /performance
  GET    /logs                           filtres, regroupement, pagination
  GET    /logs/:empreinte                fiche d'un groupe
  GET    /erreurs                        erreurs rattachées à leur contrôleur
  GET    /erreurs/:id
  GET  POST /incidents
  GET  PATCH /incidents/:id
  GET    /alertes
  PATCH  /alertes/regles/:categorie
  POST   /alertes/:id/acquitter
  GET    /verifications
  POST   /verifications/executer
  POST   /verifications/parcours

AUDIT
  GET  POST /regles
  GET  PATCH /regles/:code
  GET    /matrice
  GET    /matrice/role/:role
  GET    /routes
  GET    /audits
  POST   /audits/:famille                permissions | multitenant | donnees | tout
  GET    /constats
  GET  PATCH /constats/:id

IA  (limiteur : 12 appels/minute)
  GET    /ia/outils                      liste vérifiable des 16 outils
  GET    /ia/domaines-conseil
  GET    /ia/couts
  POST   /ia/demander                    copilote
  POST   /ia/analyser-erreur/:id
  POST   /ia/analyser-constat/:id
  POST   /ia/proposer-correctif/:constatId
  POST   /ia/cause-racine
  POST   /ia/conseil
  POST   /ia/rapport
  GET    /correctifs
  PATCH  /correctifs/:id
  GET    /rapports

SYSTÈME
  GET  POST /reauthentifier
  GET    /drapeaux
  PATCH  /drapeaux/:cle
  POST   /drapeaux/:cle/retour-arriere
  GET    /maintenance
  POST   /maintenance                    ← exigerReauthentification
  GET  POST /decisions
  GET    /connaissance
  PUT    /connaissance/:cle
  GET    /dependances
  GET    /base
  GET    /infrastructure
```

---

### 27.12 Variables d'environnement

**Aucune n'est obligatoire.** Le Control Center fonctionne sans, en mode
dégradé annoncé.

| Variable | Défaut | Effet si absente |
|---|---|---|
| `CONTROL_CENTER` | activé | `non` désactive amorçage et tâches périodiques |
| `SUPER_ADMIN_EMAIL` | — | Les alertes par email ne partent pas. **Journalisé explicitement** : on doit pouvoir le découvrir avant l'incident |
| `REAUTH_DUREE_MINUTES` | `15` | Borné 2–60 |
| `JOURNAL_TECHNIQUE_NIVEAU` | `info` en prod | `debug` gonflerait le volume |
| `OPENAI_API_KEY` | — | Copilote et analyses IA indisponibles ; **tout le reste fonctionne** |
| `AUDIT_INGEST_SECRET` | — | (existante) Ingestion CI fermée |

---

### 27.13 Tests

`npm test` → **63 tests, 0 échec** (43 pour le Control Center).

Aucun n'exige de base ni de réseau : ils portent sur l'analyse statique, les
fonctions pures et les structures de données. C'est délibéré — **ils tournent
vraiment**.

Ils protègent les propriétés dont la violation serait grave ET silencieuse :

- l'analyseur ne produit pas de faux constat (gardes hoistées, collision `/moi`
  contre `/:id`, rôles pris pour des middlewares) ;
- toute route `/super-admin` traverse `superAdminSeul` ; les 57 du Control
  Center sont réservées au Super Admin ; la maintenance exige la
  ré-authentification ; l'Explorateur ne déclare aucune écriture ;
- le masquage attrape les secrets, y compris **en JSON** et **imbriqués** ;
- aucun outil d'IA n'écrit ; les injections d'invite sont neutralisées ;
  l'encadrement ne peut pas être refermé de l'intérieur ;
- la matrice ne cite ni règle ni rôle inexistant, et **toutes ses routes
  existent réellement** ;
- le tirage de pourcentage est stable et bien réparti ;
- **contrat frontend ↔ backend** : chaque chemin appelé correspond à une route
  montée, chaque entrée de menu mène à une vue, aucune vue n'en écrase une
  autre, les scripts sont chargés ET listés dans `SCRIPTS_REQUIS`.

### Deux tests ont trouvé de vrais défauts pendant l'écriture

1. `const { ecole_id } = req.body` — la déstructuration, forme idiomatique,
   n'était pas détectée par l'analyseur d'isolation ;
2. un constat de performance touchant 500 écoles passait devant une fuite
   inter-écoles critique.

Les deux sont corrigés, et les tests qui les ont trouvés restent en place.

---

### 27.14 Limites actuelles — à lire avant de promettre quoi que ce soit

**Ce qui n'est pas fait, et qui n'est pas prétendu fait :**

1. **Aucune analyse de vulnérabilités des dépendances.** Cela exige
   d'interroger une base d'avis (npm audit, OSV), donc un appel réseau sortant.
   L'écran le DIT au lieu d'afficher un voyant vert non mesuré. Chemin
   recommandé : `npm audit --json` en CI → `POST /audits/executions` avec
   `AUDIT_INGEST_SECRET` (le mécanisme existe déjà).
2. **Pas de MFA/TOTP.** La ré-authentification est une preuve de présence, pas
   un second facteur.
3. **Coûts d'infrastructure saisis à la main.** Render, Supabase et Resend
   n'exposent pas d'API de facturation exploitable sans identifiants
   supplémentaires. Les montants affichés sont ceux saisis dans « Services &
   coûts », pas des relevés. Seul le coût IA est calculé — et estimé.
4. **Un seul parcours synthétique** (école → année → classe → élève →
   relecture). Les parcours bulletin et abonnement restent à écrire.
5. **Couverture de la matrice : 18,8 %.** Elle couvre les ressources sensibles.
   L'étendre est du travail de saisie, guidé par
   `couverture.non_couvertes`.
6. **Métriques d'API en mémoire.** Un redéploiement Render remet le collecteur
   à zéro. Le relevé horaire dans `scores_plateforme` conserve l'essentiel ;
   la synthèse affiche l'uptime du processus pour qu'on ne confonde pas « peu
   de trafic » et « redéployé il y a dix minutes ».
7. **Les rapports ne sont pas encore planifiés** : `POST /ia/rapport` existe,
   son déclenchement quotidien reste à câbler (cron Render → route `/jobs`).
8. **La conversation du copilote n'est pas conservée** entre deux visites : elle
   peut contenir des noms d'écoles et des détails d'incidents, et la garder
   demanderait une politique de rétention qui n'existe pas encore.

---

### 27.15 Ce que le premier audit a trouvé sur le dépôt actuel

Résultats réels, sur le code tel qu'il est :

**Permissions — 6 constats**, tous `moyenne`, tous marqués **hypothèse** :
six routes d'écriture authentifiées sans aucune restriction de rôle
(`POST /assistant/question`, `PATCH /assistant/onboarding`,
`POST /assistant/aide-contextuelle`, `PATCH /notifications/:id/lu`,
`POST /notifications/tout-marquer-lu`,
`POST /uploads/photo-utilisateur/:utilisateurId`).

Les routes `/moi` sont exclues par un critère écrit. **La dernière mérite un
regard** : le chemin porte un `:utilisateurId`, et rien dans la route ne
restreint qui peut envoyer une photo pour qui.

**Multi-tenant — 12 constats**, tous `moyenne`, tous **faits** : douze fonctions
posent bien le contexte de cloisonnement mais n'écrivent aucun `ecole_id` dans
leurs requêtes (`calendrier.modifier`, `comptabilite.modifierCategorie`,
`discipline.supprimerIncident`, `emploi-du-temps.retirerSeance`,
`frais.supprimerConfig`, `ia.appliquerAppreciations`,
`inscriptions.modifierSession`, `inscriptions.publierSession`,
`modeles-bulletins.supprimerModele`, `structure.retirerCoursDeClasse`,
`structure.modifierPeriode`, `travaux.supprimer`).

**Aucune fuite aujourd'hui** : RLS s'applique. Mais l'isolation de ces douze
écritures repose entièrement sur la policy de leur table. Le correctif est d'un
paramètre : `AND ecole_id = $n`.

**Aucun constat critique**, et aucune route d'écriture non authentifiée hors
liste documentée.

**Qualité des données** : nécessite une connexion à la base — non exécuté ici.

---

### 27.16 Comment démarrer

```bash
# 1. Appliquer la migration (obligatoire)
psql "$DATABASE_URL" -f migrations/030-control-center.sql

# 2. Redémarrer le backend
#    → synchronise les 45 règles métier vers la base
#    → arme les tâches périodiques (scores, vérifications, purge)

# 3. Dans l'espace Super Admin : « Control Center » puis « Lancer un audit complet »
```

Sans la migration, le serveur démarre normalement et affiche un avertissement
nommant le fichier à appliquer. Les écrans du Control Center répondront en
erreur, **le reste de la plateforme n'est pas affecté**.

Vérification :

```sql
SELECT count(*) FROM regles_metier;   -- 45 attendues
SELECT count(*) FROM alertes_regles;  -- 12 attendues
```
