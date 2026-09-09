# Récré

Apparence optionnelle dans **Mon profil → Apparence → Récré**, inspirée de la première maquette : papier crème à points, jaune soleil, dessins de cahier et crayons de couleur. Navigation horizontale sur ordinateur, agenda et aide à droite sur l’accueil. Les 33 rubriques applicatives ont un bandeau et les raccourcis utilisent 30 illustrations SVG adaptées aux menus.

Les styles restent sous `data-theme="recre"`. Les liens du rail, leur filtrage par rôle et leurs écouteurs sont conservés ; les préférences de position restent disponibles pour les autres apparences. Le tiroir mobile et les commandes métier restent ceux de l’application. Les chiffres et événements viennent des écrans existants, sans introduire les données fictives de la maquette. Les documents imprimables et le site public conservent leur présentation.

Le backend autorise la préférence `recre`. Le service worker v74 précache les styles, le script et toutes les illustrations de Récré. Les contrôles des thèmes précédents lisent désormais la version réelle du service worker, pour ne pas conserver une assertion obsolète à chaque livraison.

## Validation

`node test-recre-browser.cjs` utilise Playwright avec les vrais scripts partagés et des API simulées : tableau de bord, alternance Élan/Yohali/Terranga/Récré, conservation des données, choix et rechargement du profil, quatre préférences de position, tiroir mobile, 32 écrans à 1536 et 390 px, coque Super Admin, migration v73 vers le nouveau cache et ressources hors connexion. Les coques inventoriées ne déclenchent pas les opérations métier. `RECRE_BROWSER` sélectionne le Chromium installé ; `RECRE_SHOT` indique le chemin de capture.

## Illustration principale

Fichier : `public/recre/accueil.webp`. Généré avec l’outil intégré de génération d’images, puis exporté en WebP sans retouche du dessin. Les illustrations de menu sont des SVG natifs dérivés de la bibliothèque existante, avec motifs de cahier et hachures de crayon.

Prompt : Joyful hand-drawn colored-pencil and ink illustration on plain pale warm ivory paper: stack of three school notebooks/books in grassy green, orange and blue, a speckled ceramic cup holding colored pencils, a small terracotta potted green plant, and a white paper airplane above with a short loose dashed flight trail. Visible cross-hatching, charming sketchbook linework, playful warm school stationery, handcrafted editorial drawing, airy and friendly. Entire objects inside frame with generous margins; landscape 1536x1024. Palette navy #122642, sunny yellow #FFD34E, leaf green #8AA75B, cornflower #6C9ECE, apricot #EEA36D. No text, labels, numbers, UI, logos or people. Background plain #FFFBEE with gentle paper grain, no panels or border.
