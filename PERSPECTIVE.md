# Yohali (anciennement Perspective)

Apparence optionnelle dans **Mon profil → Apparence → Yohali**, inspirée de la maquette architecturale crème, vert profond et terre cuite. Navigation horizontale sur ordinateur, agenda et aide à droite, typographie sérif et 30 illustrations SVG par rubrique. Les 33 rubriques, dont la coque Super Admin, sont couvertes. Les documents imprimables et pages publiques conservent leur présentation.

Les ajouts sont isolés sous `data-theme="perspective"`. Le rail conserve ses liens et écouteurs ; les paramètres de disposition restent enregistrés pour les autres apparences. Les indicateurs et événements viennent des écrans existants. Aucun chiffre de maquette n’est injecté. Le thème n’ajoute aucune requête métier.

Le serveur doit autoriser `perspective` dans `THEMES_AUTORISES`. Le service worker v72 précache ses ressources en plus d’Élan.

## Vérification

`node test-perspective-browser.cjs` : vrais scripts partagés avec API simulées, tableau de bord, alternance Yohali/Élan/Teranga, conservation des données, profil et rechargement, quatre positions de navigation, tiroir mobile, 32 écrans à 1536 et 390 px, coque Super Admin, migration du cache v70 vers v72 et ressources hors connexion. Les vues inventoriées utilisent leur coque sans exécuter les opérations métier. `PERSPECTIVE_BROWSER` sélectionne un Chromium installé ; `PERSPECTIVE_SHOT` indique le chemin de capture.

## Illustration générée

Outil intégré de génération d’images ; fichier livré : `public/perspective/accueil.webp`. Export WebP optimisé sans retouche du dessin. Les illustrations de menu sont des SVG natifs dérivés de la bibliothèque de dessins existante.

Prompt : standalone dashboard hero illustration for Ardoise Perspective. Refined editorial collage of a cream stone school arch and a few steps, deep forest green bound books, a slim black fountain pen in a ribbed ceramic pot and an olive branch. Architectural geometry, half circles in sage and muted terracotta. Matte paper texture, soft daylight, restrained warm scholarly elegance. Landscape 1536x1024, objects centered with generous plain warm ivory margins. No text, lettering, numbers, UI or people. Colors forest #203C32, sage #A4AB94, stone #DFD5BF, cream #F7F5EF, terracotta #AD6447.

Les noms affichés sont Yohali pour la clé historique `perspective` et Teranga pour la clé historique `yohali` (alias `kivu`). Ces clés restent inchangées afin de préserver les préférences et les styles des comptes existants.
