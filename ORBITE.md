# Orbite Aube

Apparence optionnelle dans **Mon profil → Apparence → Orbite Aube** (clé `orbite`). La maquette claire se traduit par un rail flottant à gauche, un en-tête de recherche, des cartes bleu et blanc, des classes et un agenda sur l'accueil. Les autres rubriques conservent leurs outils dans un espace large et reçoivent les mêmes styles de formulaires, tableaux et boutons. Le Super Admin conserve son organisation propre.

Les compteurs de l'accueil sont les éléments d'origine, déplacés avec leurs écouteurs et replacés exactement lorsqu'on quitte le thème. Aucun compteur n'est cloné. Les classes viennent de GET /classes, uniquement si le rail et ArdoiseAcces autorisent cet écran ; les noms sont insérés comme texte. Une erreur permet de réessayer, et une liste vide n'affiche pas de données inventées. L'agenda reprend les événements disponibles dans l'écran. Le cadran représente l'heure locale, et non un emploi du temps fictif. Les taux de présence fictifs de la maquette ne sont pas repris.

La recherche (bouton ou Ctrl/Cmd+K) liste les écrans autorisés. Échap ferme la fenêtre. Les raccourcis et les liens du rail gardent les contrôles existants. Sur téléphone, le tiroir et la navigation mobile de l'application restent en service ; les cartes et l'agenda s'empilent.

Les styles sont limités à `data-theme="orbite"`. Les SVG de l'horizon et du symbole orbital sont natifs et locaux. Le service worker v76 précache les ressources. La préférence orbite est ajoutée aux thèmes acceptés par le backend.

## Validation

`node test-orbite-browser.cjs` utilise les vrais scripts partagés et des API simulées : classes, agenda, restitution des compteurs et de leurs clics après plusieurs changements de thème, recherche, profil, quatre préférences de position, menu mobile, restrictions d'un professeur et migration du cache v75 vers le cache courant. Les coques de 32 écrans sont contrôlées à 1536, 1024 et 390 px, ainsi que le Super Admin. Les scripts métier de ces coques ne sont pas exécutés : ce test ne prétend pas couvrir tous les parcours de saisie.

`ORBITE_BROWSER` sélectionne un Chromium local ; `ORBITE_SHOT` indique le chemin des captures. La CI conserve également les tests de Nexus, Récré, Yohali et Élan et les contrôles d'abonnement et de fonctionnement hors connexion.
