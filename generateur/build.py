# -*- coding: utf-8 -*-
"""
CONSTRUCTION DU SITE PUBLIC ARDOISE.

    python3 build.py

Produit dans SORTIE l'arborescence complète des pages publiques, le plan du
site, le fichier robots, les redirections des anciennes URL et les deux
ressources statiques (site.css complété, nav.js).
"""

import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import base
from base import SITE, DATE, SORTIE

import contenu_accueil
import contenu_fonctionnalites_a
import contenu_fonctionnalites_b
import contenu_fonctionnalites_c
import contenu_tarifs
import contenu_services
import contenu_divers
import contenu_guides

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE_DEPOT = os.path.dirname(ICI)
SOURCE_HTML = os.environ.get("SOURCE_HTML", RACINE_DEPOT)


# ------------------------------------------------------------------ Pages

def construire_pages():
    urls = [contenu_accueil.construire()]
    for module in (contenu_fonctionnalites_a, contenu_fonctionnalites_b,
                   contenu_fonctionnalites_c, contenu_tarifs,
                   contenu_services, contenu_divers):
        urls.extend(module.construire())
    urls.extend(contenu_guides.construire())
    return urls


# ----------------------------------------------------------- Redirections
#
# GitHub Pages ne sait pas répondre 301. La redirection se fait donc en trois
# couches, dans cet ordre d'efficacité : la balise canonique dit au robot où se
# trouve la version de référence, le rafraîchissement méta déplace le visiteur
# même sans JavaScript, et le lien visible garantit qu'une page vide n'est
# jamais servie à personne.

REDIRECTIONS = {
    "tarifs.html": ("/tarifs/", "Tarifs Ardoise"),
    "services.html": ("/services/", "Services Ardoise"),
}


def gabarit_redirection(vers, titre):
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{titre} — page déplacée</title>
<link rel="canonical" href="{SITE}{vers}" />
<meta name="robots" content="noindex, follow" />
<meta http-equiv="refresh" content="0; url={vers}" />
<link rel="stylesheet" href="/site.css" />
<script>location.replace("{vers}" + location.hash);</script>
<link rel="stylesheet" href="mobile.css" />
</head>
<body>
<main id="contenu" class="section">
  <div class="conteneur">
    <h1>Cette page a déménagé</h1>
    <p class="chapeau">Elle se trouve désormais à l'adresse
       <a href="{vers}">{SITE}{vers}</a>.</p>
    <p class="groupe-cta"><a class="bouton ocre" href="{vers}">Continuer</a></p>
  </div>
</main>
<!-- Session partagée : renouvellement du jeton et rejeu des requêtes
     expirées. Doit rester AVANT les autres scripts. -->
<script src="session.js"></script>
<script src="remontee-erreurs.js"></script>
<script src="mobile.js"></script>
</body>
</html>
"""


def construire_redirections():
    for fichier, (vers, titre) in REDIRECTIONS.items():
        chemin = os.path.join(SORTIE, fichier)
        with open(chemin, "w", encoding="utf-8") as f:
            f.write(gabarit_redirection(vers, titre))


# ------------------------------------------------------------- Ressources

def construire_ressources():
    """site.css = feuille d'origine + bloc multi-pages + bloc illustrations.

    Les ajouts sont conditionnels. `site.css` du dépôt est lui-même un produit
    de ce script : le relire tel quel et lui recoller le bloc multi-pages
    dupliquerait 13 ko de règles à chaque reconstruction, et la feuille
    grossirait d'un bloc entier à chaque passage. On ne concatène donc que ce
    qui manque, ce qui rend `build.py` rejouable sur sa propre sortie.
    """
    origine = os.path.join(SOURCE_HTML, "site.css")
    with open(origine, encoding="utf-8") as f:
        css = f.read()

    # On coupe sur le titre du bloc, pas sur son contenu. Comparer les
    # contenus ne marche pas : le `site.css` du dépôt a été produit par une
    # version antérieure de `site-pages.css`, et les deux textes ont depuis
    # divergé de quelques commentaires. Le titre, lui, est stable — c'est le
    # seul repère qui survive aux retouches rédactionnelles.
    for marqueur in ("ARDOISE — SITE MULTI-PAGES", "ARDOISE — ILLUSTRATIONS"):
        pos = css.find(marqueur)
        if pos != -1:
            debut = css.rfind("/*", 0, pos)
            css = css[:debut].rstrip() + "\n"

    for fichier in ("site-pages.css", "site-illustrations.css"):
        with open(os.path.join(ICI, fichier), encoding="utf-8") as f:
            css += "\n" + f.read()

    with open(os.path.join(SORTIE, "site.css"), "w", encoding="utf-8") as f:
        f.write(css)

    shutil.copy(os.path.join(ICI, "nav.js"), os.path.join(SORTIE, "nav.js"))

    # catalogue.js est repris tel quel, à un correctif près : voir le commentaire
    # « Pas de sélecteur sur toutes les pages » dans le fichier.
    shutil.copy(os.path.join(ICI, "catalogue.js"), os.path.join(SORTIE, "catalogue.js"))


# ------------------------------------------------------------ Plan du site
#
# Les priorités ne sont pas décoratives : elles disent au robot par où
# commencer quand son budget d'exploration est limité. L'accueil et les tarifs
# passent devant les pages de fonctionnalité, qui passent devant la FAQ.

PRIORITES = {
    "/": ("1.0", "monthly"),
    "/tarifs/": ("0.9", "monthly"),
    "/tarifs/comparer/": ("0.9", "monthly"),
    "/fonctionnalites/": ("0.8", "monthly"),
    "/services/": ("0.8", "monthly"),
    "/guides/": ("0.8", "monthly"),
    "/a-propos/": ("0.7", "yearly"),
    "/contact/": ("0.7", "yearly"),
}
DEFAUT = ("0.7", "monthly")


def construire_sitemap(urls):
    lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
              "<!--",
              "  Ardoise — plan du site public.",
              "",
              "  Seules les pages publiques y figurent. Les écrans de l'application",
              "  sont exclus ici comme dans robots.txt : demander l'indexation d'une",
              "  page qu'on interdit par ailleurs ne produit que des avertissements.",
              "",
              "  `lastmod` doit être mis à jour lors d'une modification réelle du",
              "  contenu. Une date fausse est ignorée après quelques passages.",
              "-->",
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url in urls:
        prio, freq = PRIORITES.get(url, DEFAUT)
        lignes += ["", "  <url>",
                   f"    <loc>{SITE}{url}</loc>",
                   f"    <lastmod>{DATE}</lastmod>",
                   f"    <changefreq>{freq}</changefreq>",
                   f"    <priority>{prio}</priority>",
                   "  </url>"]
    lignes += ["", "  <url>",
               f"    <loc>{SITE}/confidentialite.html</loc>",
               f"    <lastmod>{DATE}</lastmod>",
               "    <changefreq>yearly</changefreq>",
               "    <priority>0.3</priority>",
               "  </url>", "", "</urlset>", ""]
    with open(os.path.join(SORTIE, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write("\n".join(lignes))


# --------------------------------------------------------------- robots.txt

ECRANS_APPLICATION = """connexion.html changer-mot-de-passe.html
reinitialiser-mot-de-passe.html mon-profil.html dashboard-directeur.html
espace-professeur.html espace-titulaire.html espace-secretaire.html
super-admin.html eleves.html notes.html bulletins.html classes.html cours.html
cours-classe-titulaire.html presences.html discipline.html frais-scolaires.html
comptabilite.html emploi-du-temps.html calendrier.html inscriptions.html
orientation.html repechage.html archives.html rapports.html journal.html
messages.html parametres.html utilisateurs.html annee-scolaire.html ecole.html
generateur-modeles.html bulletin-annuel.html apercu-bulletin-primaire.html
apercu-bulletin-secondaire.html apercu-bulletin-semestre.html
apercu-bulletin-terminale.html""".split()


def construire_robots(urls):
    autorises = "\n".join(f"Allow: {u}" for u in urls)
    interdits = "\n".join(f"Disallow: /{f}" for f in ECRANS_APPLICATION)
    texte = f"""# Ardoise — myardoise.com
#
# Le site public est destiné à être indexé, page par page : chaque adresse
# ci-dessous répond à une intention de recherche distincte et porte son propre
# titre, sa propre description et son propre contenu.
#
# L'application, elle, ne l'est pas : ses pages exigent un jeton, ne rendent
# rien d'utile à un robot, et leur présence dans un index n'apporterait que des
# résultats morts pointant vers un écran de connexion.

User-agent: *
Allow: /$
{autorises}
Allow: /site-public.html
Allow: /confidentialite.html

# Anciennes adresses, conservées en redirection.
Allow: /tarifs.html
Allow: /services.html

# Écrans de l'application — inutiles hors session.
{interdits}

Sitemap: {SITE}/sitemap.xml
"""
    with open(os.path.join(SORTIE, "robots.txt"), "w", encoding="utf-8") as f:
        f.write(texte)


# ------------------------------------------------------------------- Main

def main():
    if os.path.isdir(SORTIE):
        shutil.rmtree(SORTIE)
    os.makedirs(SORTIE, exist_ok=True)

    urls = construire_pages()
    construire_redirections()
    construire_ressources()
    construire_sitemap(urls)
    construire_robots(urls)

    print(f"{len(urls)} pages construites dans {SORTIE}")
    for u in urls:
        print("  " + u)


if __name__ == "__main__":
    main()
