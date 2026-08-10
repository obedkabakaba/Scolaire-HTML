# Intégration au dépôt Scolaire-HTML

Ce dossier contient **uniquement les fichiers nouveaux ou modifiés**. Tout le
reste du dépôt (les 37 écrans de l'application, les icônes, `ui.css`, `sw.js`…)
est inchangé et ne figure pas ici.

## Ce qu'il faut copier à la racine du dépôt

```
index.html                    ← REMPLACE l'ancien (accueil raccourcie)
site.css                      ← REMPLACE l'ancien (feuille d'origine + bloc multi-pages)
catalogue.js                  ← REMPLACE l'ancien (un seul correctif, commenté dans le fichier)
robots.txt                    ← REMPLACE l'ancien
sitemap.xml                   ← REMPLACE l'ancien
tarifs.html                   ← REMPLACE l'ancien (devient une redirection vers /tarifs/)
services.html                 ← REMPLACE l'ancien (devient une redirection vers /services/)

nav.js                        ← NOUVEAU
fonctionnalites/              ← NOUVEAU (7 pages)
tarifs/                       ← NOUVEAU (2 pages)
services/                     ← NOUVEAU (4 pages)
securite/                     ← NOUVEAU
faq/                          ← NOUVEAU
contact/                      ← NOUVEAU
```

`ARCHITECTURE.md` et ce fichier sont de la documentation : à garder dans le
dépôt ou à écarter, au choix.

## Trois points de vigilance

### 1. Les URL absolues

Toutes les ressources sont référencées en absolu (`/site.css`, `/nav.js`,
`/icone-192.png`), parce que les pages vivent maintenant dans des
sous-répertoires. Cela suppose un service à la racine du domaine — ce qui est
le cas avec le `CNAME` vers `myardoise.com`. **En cas de prévisualisation sur
`username.github.io/Scolaire-HTML/`, rien ne se chargera** : testez avec un
serveur local à la racine, par exemple `python3 -m http.server` dans le dossier
du dépôt.

### 2. `scripts/generer-tarifs-statiques.js` (dépôt backend)

Le script réécrit les prix dans les pages statiques. Sa constante `PAGES` vise
encore les anciens chemins :

```js
const PAGES = ['index.html', 'tarifs.html'];
```

À remplacer par :

```js
const PAGES = ['index.html', 'tarifs/index.html', 'tarifs/comparer/index.html'];
```

Sans quoi une baisse de prix décidée dans l'espace Super Admin sera reflétée par
l'API — donc visible à l'écran — mais pas réécrite dans le HTML servi aux
robots. `tarifs/comparer/index.html` est ajouté parce que le tableau comparatif
contient désormais un groupe « Prix ».

### 3. Le formulaire de contact

`/contact/` appelle le même point d'entrée qu'avant
(`POST /catalogue/demande-accompagnement`) et n'exige aucune modification côté
API. Les liens `/contact/?offre=prime` et `/contact/?service=formation_complete`
posés depuis `/tarifs/` et `/services/` prérremplissent le formulaire ; le
paramètre est ignoré s'il ne correspond à rien.

## Régénérer le site

Le dossier `generateur/` contient de quoi reconstruire les 18 pages :

```bash
cd generateur
SOURCE_HTML=/chemin/vers/Scolaire-HTML-main SORTIE=/chemin/de/sortie python3 build.py
python3 audit.py        # titres uniques, H1, hiérarchie, JSON-LD, liens morts
```

`build.py` reconstruit tout : pages, `sitemap.xml`, `robots.txt`, redirections,
`site.css` recomposé. Le contenu rédactionnel vit dans les fichiers
`contenu_*.py`, l'ossature commune (head, navigation, pied de page) dans
`base.py`, et les illustrations dans `illustrations.py`. Ajouter une page
dédiée = une entrée dans `MENU` de `base.py` et une fonction dans un fichier
de contenu ; le menu, le pied de page, le plan du site et `robots.txt` se
mettent à jour seuls.

`build.py` est rejouable : relancé avec sa propre sortie comme `SOURCE_HTML`,
il produit un résultat identique. Il tronque les blocs qu'il a lui-même
ajoutés à `site.css` (repérés par leur titre) avant de les recoller. Sans
cela, la feuille grossissait d'un bloc entier à chaque reconstruction.

`audit.py` doit sortir sans erreur avant toute mise en ligne. Il vérifie
notamment qu'aucun lien interne ne pointe vers une page inexistante — l'erreur
la plus facile à commettre en passant de 3 à 18 pages.

## Les illustrations

`generateur/illustrations.py` contient neuf dessins SVG écrits à la main :
deux sur l'accueil, un dans le hero de chaque page de domaine. Ils sont posés
directement dans le HTML — aucune requête réseau, environ 1,4 ko par page.

Ils n'ont **pas** de couleurs en dur. Le trait suit `currentColor` et les
accents lisent `var(--accent)`, ce qui leur permet de basculer entre le mode
clair et le mode sombre sans qu'il existe deux versions à maintenir. Une image
matricielle aurait exigé deux fichiers par dessin.

Pour ajouter une illustration : une entrée dans `DESSINS`, puis
`illustration=("clé", "libellé")` passé à `hero()`. Le libellé part dans
`aria-label` ; il doit rester court, le dessin étant décoratif.

Neuf pages sur dix-huit n'en portent aucune, volontairement : tarifs,
comparatif, les quatre pages de services, sécurité, FAQ et contact sont déjà
structurés par des prix, des tableaux ou des questions.

## Les états vides de l'application

`ui.js` pose `data-ecran` sur `<html>` d'après le nom du fichier ; `ui.css`
s'en sert pour changer `--illustration-vide` écran par écran. « Aucune classe
créée » et « aucun mouvement de caisse » n'ont donc plus le même pictogramme,
sans qu'aucune des 38 pages n'ait été modifiée.

Deux points de vigilance :

  · le bloc qui pose l'attribut est placé **en tête** de `ui.js`. Une exception
    levée plus haut dans le fichier arrêterait tout ce qui suit — le fichier
    documente déjà ce risque pour la réparation de `#message-flash` ;
  · `super-admin.html` charge `ui.css` sans `ui.js` : il garde donc le dessin
    par défaut. C'est le bon comportement, et il ne concerne pas les écoles.


---

# Lot mobile — la plateforme sur téléphone

## Le constat de départ

Mesuré dans un vrai navigateur à 360 px (le téléphone d'entrée de gamme qui
sert de référence), avant ce lot :

| | |
|---|---|
| Pages plus larges que l'écran | **13**, jusqu'à 817 px |
| Entrées de menu visibles sur téléphone | 5 sur 32 |
| Entrée « Aide & Tutoriels » | invisible sur toutes les pages |

Après, sur les 60 pages du dépôt :

| Largeur | Pages qui tiennent dans l'écran |
|---|---|
| 320 px | 60 / 60 |
| 360 px | 60 / 60 |
| 390 px | 60 / 60 |
| 768 px | 60 / 60 |
| 1280 px | 60 / 60 |

## Fichiers

```
mobile.css              ← NOUVEAU — couche mobile (coque, tiroir, onglets, modales)
mobile.js               ← NOUVEAU — barre supérieure, tiroir, barre inférieure
installer-mobile.py     ← NOUVEAU — branche les deux dans toutes les pages (idempotent)
audit-mobile.py         ← NOUVEAU — audit responsive par la mesure, dans un navigateur

ui.js                   ← MODIFIÉ — `reduireRail()` ne replie plus les entrées d'action
didacticiel.js          ← MODIFIÉ — l'entrée d'aide est marquée permanente
sw.js                   ← MODIFIÉ — mobile.css/js mis en cache, VERSION → v40
*.html (60 pages)       ← MODIFIÉ — deux balises chacune, posées par installer-mobile.py
```

`installer-mobile.py` est relançable : après l'ajout d'un écran, `python3
installer-mobile.py .` équipe la nouvelle page et ne touche pas aux autres.

## Les trois causes qui expliquaient tout

**1. `min-width: auto` sur les cellules de grille.** `.contenu` est une cellule
de `.mise-en-page`. Une cellule de grille vaut « au moins la largeur minimale
de son contenu » : une seule barre d'onglets non sécable élargissait la colonne
et, avec elle, la page entière. Un `min-width: 0` règle treize pages d'un coup.

**2. Le menu n'était pas un menu.** Sur téléphone, un accordéon qui poussait le
contenu vers le bas, et le rail réduit n'y montrait que les écrans épinglés —
les vingt-sept autres vivaient dans un tiroir dans un tiroir. Le tiroir mobile
affiche désormais la liste complète, groupée par famille.

**3. « Aide & Tutoriels » était classée comme une page.** `reduireRail()`
raisonne en pages : il range chaque entrée par son `href`, masque celles qui ne
sont pas épinglées, et redessine les autres dans « Tous les menus ». Cette
entrée porte `href="#"` — ce n'est pas une page, c'est un bouton. Elle était
donc masquée dans le menu, et réapparaissait dans le tiroir sans icône
(`ICONES['#']` n'existe pas) et pointant vers nulle part. Un même défaut,
deux symptômes : « pas d'icône » et « quand on clique ça n'entre pas ».

## Corrigé au passage

L'animation d'entrée de `.contenu` anime `transform`, ce qui en fait un bloc de
confinement pour ses descendants en `position: fixed`. Les modales (`.voile`)
étant des enfants de `.contenu` dans les trente-sept pages, elles se
positionnaient par rapport au CONTENU et non à l'écran : sur une page longue,
la boîte de dialogue s'ouvrait hors champ. `ui.js` avait déjà dû déplacer
`#message-flash` pour la même raison. L'animation est retirée sous 780 px.

## Ce qui n'a pas changé

Rien au-dessus de 780 px : rail de 240 px, tiroir « Tous les menus », modales
centrées, ordre du menu. Vérifié à 1280 et 1440 px, et dans les deux sens de
rotation. La console super-admin garde sa propre coque (tiroir à 980 px) ;
elle reçoit seulement le filet de largeur. Si `mobile.js` ne se charge pas, la
plateforme fonctionne exactement comme avant.
