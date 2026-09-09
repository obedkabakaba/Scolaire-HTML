# Nexus

Apparence optionnelle dans **Mon profil → Apparence → Nexus** : graphite et vert lime, navigation horizontale, carte des espaces de l'école, panneau contextuel et barre de recherche. Sur téléphone, la carte passe en deux colonnes et le tiroir de navigation existant reste disponible.

La carte relie Élèves, Classes, Notes et bulletins, Gestion et Équipe. Chaque rubrique reçoit le contexte de son domaine et des liens vers ses outils. Le Super Admin conserve son organisation particulière. Les formulaires, les actions métier et les documents imprimés restent ceux des écrans existants.

Les liens proviennent du rail existant et sont vérifiés par ArdoiseAcces. La classification en cinq domaines ne constitue pas une seconde politique d'autorisation. Les effectifs et événements sont lus depuis les données affichées par l'écran. La liste de classes utilise GET /classes uniquement lorsque cet accès est autorisé ; les noms sont insérés comme texte, avec état vide, erreur et nouvelle tentative. Aucun chiffre fictif n'est livré.

Le CSS est limité à data-theme="nexus" et le script est chargé à la sélection. Le changement de thème ferme la recherche et masque les éléments Nexus. Le panneau fixe ne dépend pas de l'animation d'entrée du contenu. Le fond du réseau et ses pictogrammes sont des SVG natifs. Le service worker v75 précache ces ressources. La préférence nexus est ajoutée à la liste autorisée du backend.

## Vérification

`node test-nexus-browser.cjs` utilise les vrais scripts partagés et des API simulées : carte, panneau, mises à jour des effectifs, recherche et Échap, changements d'apparence, profil, quatre positions de navigation, tiroir mobile, accès d'un professeur, migration du cache v74 et ressources hors ligne. Il contrôle les coques de 32 écrans à 1536, 1024 et 390 px, plus le Super Admin. Les opérations métier de ces coques sont désactivées : ce contrôle vérifie leur présentation et leur navigation, pas chaque parcours de saisie. Il vérifie aussi la couleur finale et l'absence de chevauchement du panneau après changement de thème.

`NEXUS_BROWSER` permet de choisir un Chromium installé et `NEXUS_SHOT` le chemin de capture. Les audits de cloisonnement, de frontend et d'abonnements ainsi que les tests des apparences précédentes restent dans la CI.
