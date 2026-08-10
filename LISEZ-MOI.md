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

