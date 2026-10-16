# Fluide — verre liquide

Apparence optionnelle dans **Mon profil → Apparence → Fluide**. Son histoire :
*Le Lagon* — une école vue à travers l'eau claire d'un lagon (voir aussi
SIGNATURES.md).

## La matière

Fluide reprend l'esprit du verre « liquide » des systèmes récents. Chaque
surface (cartes, panneaux, rail, barre haute, dock, palette) est faite de
quatre couches, sans pseudo-élément ajouté aux composants métier :

1. **un fond vivant** (`.fl-fond`) : cinq nappes de couleur floues qui dérivent
   lentement et une caustique de lumière, pour que le verre ait quelque chose à
   réfracter ;
2. **le flou et la saturation de l'arrière-plan** (`backdrop-filter`) ;
3. **un reflet spéculaire mobile**, peint dans le fond de la surface et piloté
   par `--lg-x` / `--lg-y` : `theme-fluide.js` suit le pointeur (souris et
   stylet, pas le doigt) et la lumière glisse sur la carte survolée ;
4. **un liseré lumineux**, plus vif en haut à gauche, fait d'ombres intérieures.

Les surfaces réagissent comme une goutte : légère élévation au survol,
écrasement (`scale(.95–.985)`) à l'appui, retour avec un ressort. Les champs
sont du verre « creusé » ; les boutons principaux un verre teinté bleu lagon.

## La composition

- **Barre haute** en capsule flottante, plus opaque dès qu'on fait défiler.
- **Île dynamique** dans la barre haute : l'heure ; au survol ou au clavier,
  elle s'allonge et montre la date et le prochain événement de l'écran.
- **Rail** flottant de 210 px, éléments en pilules ; l'écran actif est une
  lentille de verre plus claire. « Sortir » reste au bout du rail, qui défile
  sur un petit écran.
- **Dock** façon barre d'onglets : Accueil et jusqu'à trois raccourcis
  autorisés, puis une loupe ronde (Ctrl/Cmd+K). Une lentille de verre glisse
  vers l'onglet survolé, s'étire pendant le trajet puis se repose.
- **Widget « La journée se remplit »** : un verre d'eau dont le niveau suit la
  journée de classe (7 h → 17 h).
- Titre d'accueil au reflet animé, emblème de vague qui flotte.

Les compteurs et le bloc notes/événements restent les nœuds d'origine,
déplacés puis remis à leur place en quittant Fluide, avec leurs écouteurs. Les
raccourcis sont limités aux pages autorisées par `ArdoiseAcces`. Aucune requête
métier n'est ajoutée et aucun chiffre n'est inventé.

## Replis

- Sans `backdrop-filter` : surfaces pleines claires.
- `prefers-reduced-transparency` : surfaces pleines, fond vivant masqué.
- `prefers-reduced-motion` : fond, reflet du titre et ressorts figés.
- Impression : rien de Fluide n'est imprimé, les compteurs et événements oui.

Une réfraction par filtre SVG dans `backdrop-filter` a été essayée : Chromium
l'ignore sans erreur. Elle n'est pas livrée.

## Vérifications

`node test-fluide-browser.cjs` (transparence et flou calculés, raccourcis,
nœuds conservés, alternance avec les autres apparences, recherche, profil,
positions, mobile, rôle professeur, hors connexion) et
`node test-signatures-browser.cjs` (déconnexion atteignable, widget, accueil).
`FLUIDE_BROWSER` / `FLUIDE_SHOT` comme avant. Le backend accepte la clé
`fluide`.
