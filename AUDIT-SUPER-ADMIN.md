# Espace Super Admin — audit, rationalisation et refonte en tour de contrôle

## 1. Constat de départ

| | Avant | Après |
|---|---|---|
| Entrées visibles dans la barre latérale | ~100 lignes à plat (11 groupes + 14 liens isolés) | 10 domaines dans un rail, puis 3 à 12 lignes par domaine |
| Écrans atteignables | 95 vues enregistrées | 95 vues, toutes routes conservées |
| Écran introuvable par le menu | « Renouvellements » (paiements à valider) | aucun |
| Recherche | palette Ctrl K limitée à ~40 écrans | barre de recherche permanente, palette qui connaît **tous** les écrans |
| Page d'accueil | 12 compteurs + 4 courbes + état système en dur | tour de contrôle hiérarchisée (voir §4) |

## 2. Nouvelle architecture

**Source unique** : le bloc `<nav id="sa-navigation">` de `super-admin.html`. La coque
(`super-admin-coque.js`) le lit pour construire le rail, le panneau, le fil d'Ariane, les
onglets, les vues d'ensemble et la palette. Ajouter un écran = une ligne de HTML.

| Domaine | Contenu |
|---|---|
| **Pilotage** | Tour de contrôle · Analyses · *Rapports et exports* (exports plateforme, exports financiers, rapports automatiques) |
| **Écoles & clients** | Toutes les écoles · Statistiques · Renouvellements à traiter · *Abonnements* (échéancier, prix payés et remises) · *Explorateur* (écoles, élèves, professeurs, parents, classes) · Recherche dans les écoles |
| **Relation client** | Tickets de support · Demandes et messages · Annonces aux écoles |
| **Croissance** | Démonstrations · Apporteurs d'affaires (vue d'ensemble, *Réseau*, *Rémunération*, *Programme*) |
| **Utilisateurs & accès** | Utilisateurs · Connexions et sessions · Voir comme… · *Droits par rôle* (matrice, par rôle) · Permissions financières |
| **Finance** | Tableau financier · Alertes · *Analyse* (4) · *Offres et prix* · *Remises* (3) · *Dépenses et services* (5) · Journal financier |
| **Supervision** | Vue technique · *Santé et performance* · *Erreurs* · *Incidents et alertes* · *Journaux* |
| **Qualité & audit** | Prêt à livrer ? · *Écarts et correctifs* · *Référentiel* |
| **Intelligence artificielle** | Copilote, conseil, cause racine, AI Studio, *Actions IA* · fournisseurs, modèles, *Routage*, autorisations · *Knowledge Hub* · *Coûts de l'IA* |
| **Configuration** | Paramètres · Drapeaux · Maintenance · Sauvegardes · Inspecteur de base · *Outils techniques* (repliés : infrastructure, dépendances, outils développeur, décisions) |

*En italique* : un **espace de travail** — une seule ligne dans le menu, ses écrans
deviennent des onglets en tête de page. Chaque domaine a aussi une vue d'ensemble
(`#/espace/<domaine>`) dont les cartes reprennent le sous-titre déclaré par chaque écran.

Barre haute : fil d'Ariane cliquable + recherche (clic, `Ctrl K` ou `/`). Rail : pastilles
« à traiter » alimentées par les vraies files (renouvellements, tickets, demandes,
démonstrations ; finance et supervision relevées par la tour de contrôle). Une source qui
échoue fait disparaître sa pastille : jamais de « 0 » non mesuré.

## 3. Décisions, fonctionnalité par fonctionnalité

| Élément | Décision | Justification |
|---|---|---|
| Tableau de bord (`tableau-de-bord`) | **Remplacé** par la tour de contrôle | Affichait « Base de données : connectée » **sans rien mesurer** et titrait « Revenus d'abonnement » une somme de paiements de devises différentes, non convertis. |
| Renouvellements (`renouvellements`) | **Corrigé** | Injecté par `theme.js` ; son entrée de menu n'apparaissait qu'**après** une visite de l'écran. Chargé désormais par la page, entrée permanente avec compteur. |
| Base de connaissance CC (`cc/connaissance`) | **Supprimé → redirection** vers le Knowledge Hub | Éditait `base_connaissance` sans écrire `connaissance_versions` : chaque enregistrement effaçait l'état précédent, contournant la garantie d'historique du Hub, qui gère les mêmes fiches. |
| 3 écrans de coût IA (`ia/couts`, `cc/couts-ia`, `ia`) | **Fusionnés** en un espace à 3 onglets | Même table `ia_consommation` pour les deux premiers ; le troisième (usage des écoles, `ia_utilisations`) garde un angle propre. |
| 2 écrans d'abonnements (`ecoles/abonnements`, `offres/abonnements`) | **Fusionnés** en un espace | Même liste, deux angles : échéances / prix payés et remises. |
| 2 écrans d'erreurs (`cc/erreurs`, `bugs`) | **Fusionnés** | Même table `bugs_plateforme` ; suivi technique d'un côté, triage et commentaires de l'autre. |
| Journaux (`cc/logs`, `journal`) | **Fusionnés** | Technique et activité utilisateur, côte à côte. |
| Santé (`sante`, `cc/performance`, `cc/verifications`) | **Fusionnés** | Trois mesures d'un même sujet. |
| Exports (`rapports`, `finance/exports`, `cc/rapports`) | **Fusionnés** dans « Rapports et exports » | On cherchait trois endroits pour exporter. |
| Recherche globale | **Améliorée** | Accessible partout (barre haute) ; la palette propose « Rechercher X dans les écoles » vers l'écran tracé, sans contourner sa traçabilité. |
| Configuration (`configuration`) | **Améliorée** | Catégories à gauche, une ouverte ; barre « N modifications non enregistrées » + Annuler. Logique d'enregistrement inchangée. |
| Apparence | **Déplacée** dans le menu du compte (rail) | Préférence personnelle, pas un domaine métier. |
| Mode compact | **Corrigé** | Masquait tous les libellés au repos ; désormais le rail reste, le panneau se déplie au survol/clavier. |
| Palette Ctrl K | **Améliorée** | Connaît tous les écrans, recherche sans accents, groupes = domaines. |
| Retour en haut de page | **Corrigé** | `scrollIntoView` sur le contenu masquait le titre et les onglets. |
| Tous les autres écrans | **Conservés tels quels** | Fonctionnels, sans doublon ; seule leur place change. |

## 4. Tour de contrôle

1. **Bandeau d'état** — score global, incidents, maintenance (Control Center).
2. **À traiter** — une tuile par file **non vide**, triée par urgence, 8 visibles puis
   « afficher les autres ». Sources : renouvellements, tickets, demandes, démonstrations,
   écarts immédiats, incidents, vérifications en échec, alertes techniques et financières,
   abonnements expirant, écoles suspendues. Les sources muettes sont nommées.
3. **Indicateurs clés** — écoles, élèves, sessions, bulletins, MRR, marge.
4. **Activité sur 30 jours** — une courbe à la fois (connexions, écoles, élèves,
   encaissements bruts avec avertissement sur les devises) et **état de la plateforme**.
5. **Écoles à surveiller · alertes financières · priorités techniques**, puis tous les espaces.

Chaque bloc lit une route existante via `Promise.allSettled` : une panne partielle
n'empêche pas l'affichage, et le bloc concerné le dit.

## 5. Ce qui n'a pas changé

Routes (toutes les adresses `#/…` existantes fonctionnent), permissions (`superAdminSeul`
côté serveur), session isolée `ardoise_admin_*`, lecture seule de l'Explorateur,
ré-authentification, isolation des écoles, intégrations, API : **aucune modification
backend**. Compatibilité thèmes : `.sa-principal`, `#sa-entete` et son `h1` gardent leur
structure (Élan, Perspective, Récré, Nexus, Orbite, Fluide, Vibra testés).

## 6. Manques comblés (seconde livraison, frontend + backend)

| Manque | Réalisation |
|---|---|
| **Second facteur (TOTP)** | Connexion en deux étapes (`POST /auth/mfa/verifier`), écran « Mon compte → Sécurité du compte », 10 codes de secours à usage unique, anti-rejeu, blocage après 5 erreurs, secret chiffré AES-256-GCM. La ré-authentification des actions critiques exige aussi le code. Désactiver exige mot de passe ET code. Le tableau de bord et le menu du compte signalent un compte non protégé. |
| **Journal des actions du Super Admin** | Onglet « Actions des Super Admins » dans Supervision → Journaux (`/journal-activite?acteur=super_admin`). Les connexions Super Admin, jusque-là jamais journalisées, le sont désormais. |
| **Route de comptage légère** | `GET /super-admin/compteurs` (4 `count(*)`), avec repli automatique sur les listes si le serveur en ligne ne la connaît pas encore. |
| **`PUT /control-center/connaissance/:cle`** | Retirée (contrôleur et route). La lecture reste. |
| **Actions groupées sur les écoles** | Sélection multiple dans « Toutes les écoles » (persistante entre les pages), « Envoyer une annonce » et « Relancer l'échéance » (modèle prérempli), envoi école par école via la route existante des annonces, réessai limité aux écoles en échec. |

Défaut découvert par le test de bout en bout (serveur et base réels) : **toute annonce
ciblée sur une école échouait en 500** (`POST /super-admin/notifications`). L'identifiant
de l'annonce était passé après `ecole_id`, si bien que `$5` désignait l'école et que
PostgreSQL refusait la requête. Corrigé, et couvert par
`test/integration/annonces-ciblees.test.js`. La migration `063` déclare aussi trois colonnes
que le code écrit et que la production possède, mais qu'aucune migration du dépôt ne créait.

Autre défaut corrigé au passage : un mot de passe erroné à la ré-authentification
renvoyait 401, que l'interface lisait comme une session expirée — le Super Admin était
déconnecté pour une faute de frappe. Le serveur répond désormais 403.

### Déploiement

1. Backend : `migrations/062-mfa-super-admin.sql` et `063` sont appliquées en production,
   `MFA_CLE_CHIFFREMENT` est définie sur Render. Cette clé ne doit plus jamais changer :
   les secrets déjà enregistrés deviendraient illisibles.
2. Troisième livraison : `migrations/065-sessions-persistantes.sql` doit être appliquée
   AVANT le déploiement du code qui l'écrit (la connexion insère la colonne).

### Points ouverts de la deuxième livraison, traités dans la troisième

- **QR code** à la configuration de la double authentification : calculé par le serveur
  (`qrcode-generator`, sans dépendance), renvoyé sous forme de grille de modules et
  dessiné en SVG par la page à partir de nombres seulement. Le secret ne passe par aucun
  script tiers ; la clé et le lien `otpauth://` restent proposés.
- **« Se souvenir de moi »** respecté par le serveur : case décochée → session de 12 h
  (`JWT_SESSION_COURTE_HEURES`), prolongée à chaque rafraîchissement ; case cochée →
  30 jours ; un client qui n'envoie pas le champ garde les 30 jours d'avant.
- **Annonces par e-mail** : le canal (notification, notification + e-mail, e-mail seul)
  se choisit dans le formulaire, et le serveur met les e-mails dans la file d'envoi
  existante (réessais, suivi d'état). La liste affiche le sort réel : envoyés, en
  attente, non remis, personnes sans adresse. Les relances groupées depuis la liste des
  écoles restent des notifications internes.

## 7. Vérifications

Seconde livraison : base PostgreSQL de test reconstruite depuis le dépôt (baseline + toutes
les migrations) ; intégration **79/79** (dont 13 tests MFA et la régression des annonces),
cloisonnement 18/18, suite rapide 466/466 ; scénario navigateur de bout en bout contre le
vrai serveur — configuration MFA, codes de secours, connexion en deux étapes, code faux,
ré-authentification avec code, relance groupée, journal Super Admin — 17/17.

Première livraison :

- Parcours automatisé des 106 routes du menu à 1440 et 390 px : domaine, entrée active,
  onglet, fil d'Ariane, débordement horizontal — 212/212.
- Scénario interactif : connexion, pastilles (dont source en panne), rail, onglets,
  redirection, palette, menu du compte, mode replié, déconnexion.
- Backend : `control-center`, `prospects-page`, `offres-suppression`,
  `prospects-reponse-officielle` (contrat frontend ↔ backend) — 85/85.
- Audits du dépôt : frontend, cloisonnement, responsive, parcours abonnement, écritures
  Super Admin, fenêtre rail, e-mails, offline ; 7 tests de thèmes.
