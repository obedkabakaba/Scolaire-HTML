# Vibra

Apparence ivoire, or et bleu pétrole, inspirée de la maquette validée. Le campus imaginaire sert de décor ; les compteurs restent les éléments existants du tableau de bord, sans valeurs inventées. Les priorités et la recherche utilisent les liens autorisés du rail. L'agenda reflète les événements existants, sans requête API supplémentaire.

Le thème comprend la navigation flottante, un dock de raccourcis, les tableaux, formulaires, panneaux, le profil et des emblèmes par rubrique. Sur mobile, le menu natif est conservé. Les paramètres de position du rail sont conservés pour les thèmes compatibles. Les nœuds déplacés retrouvent leur place au changement de thème, avec leurs écouteurs. Les contrôles ajoutés sont masqués à l'impression.

Sélection : Mon profil → Apparence → Vibra. Clé de préférence : `vibra`. Service worker : v79, illustration et ressources incluses dans le cache statique.

## Validation

`node test-vibra-browser.cjs` vérifie 32 coques d'écran à 1536, 1024 et 390 px, le SuperAdmin, la navigation selon les préférences existantes, les droits professeur, les transitions entre thèmes, les nœuds et événements du tableau de bord, la recherche clavier, le profil, le menu mobile, l'impression et la disponibilité hors ligne après migration du cache v78. Les données des tests sont simulées ; il ne s'agit pas d'une validation complète des opérations métier de chaque écran.

## Illustration

Fichier intégré : `public/vibra/campus.webp` (1200 × 800, environ 165 Ko). Créé avec l'outil intégré imagegen, puis encodé en WebP pour le chargement. Les pictogrammes SVG sont natifs du projet.

Prompt utilisé :

> Use case: stylized-concept. Asset type: wide 3D illustration inside Ardoise Vibra school dashboard, NOT a screenshot or interface. Create a spectacular but refined futuristic African school campus viewed isometrically, centered on a deep petrol teal (#143640) backdrop. Cream stone buildings with curved bronze and gold roofs, blue solar panels, lush small trees, a circular central courtyard with a crystalline blue knowledge beacon. Delicate concentric amber holographic rings surround the whole campus, precise sacred geometry and subtle cyan network connections. Warm golden lighting balanced with luminous cyan glass. Premium Afrofuturist technology aesthetic, optimistic and academic, mature yet imaginative. Wide landscape 3:2 composition, entire campus visible with generous dark teal margin, polished architectural miniature render. No humans, no UI, no cards, no buttons, no writing, no logos, no numbers, no watermark. The image is an artistic metaphor, not a real building or data map.
