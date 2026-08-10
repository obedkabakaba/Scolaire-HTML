# -*- coding: utf-8 -*-
"""
ARDOISE — générateur du site public.

Une seule vérité pour le <head>, la navigation et le pied de page. Chaque page
n'écrit que son contenu ; le reste est produit ici, ce qui rend impossible la
divergence classique d'un site multi-pages en HTML plat : un lien de menu
ajouté sur trois pages et oublié sur douze.
"""

import json
import os

SITE = "https://myardoise.com"
DATE = "2026-08-09"

POLICES = ("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;"
           "9..144,600;9..144,700&family=Inter:wght@400;500;600;700&"
           "family=IBM+Plex+Mono:wght@400;500&display=swap")


# ---------------------------------------------------------------- Navigation
#
# UNE structure de données, trois rendus : le menu de bureau, le panneau
# mobile, et le pied de page. Ajouter une page dédiée revient à ajouter une
# ligne ici — elle apparaît partout, et le plan du site la reprend.

MENU = [
    {
        "cle": "produit",
        "libelle": "Produit",
        "colonnes": [
            {
                "titre": "Vue d'ensemble",
                "liens": [
                    ("/fonctionnalites/", "Toutes les fonctionnalités",
                     "Ce qu'Ardoise couvre, module par module"),
                    ("/fonctionnalites/ia/", "Intelligence artificielle",
                     "Assistance, appréciations, analyse des données"),
                    ("/securite/", "Sécurité et données",
                     "Isolation, rôles, traçabilité, sauvegardes"),
                ],
            },
            {
                "titre": "Par domaine",
                "liens": [
                    ("/fonctionnalites/gestion-scolaire/", "Gestion scolaire",
                     "Élèves, classes, cours, années scolaires"),
                    ("/fonctionnalites/notes-et-bulletins/", "Notes et bulletins",
                     "Cotes, moyennes, bulletins officiels RDC"),
                    ("/fonctionnalites/vie-scolaire/", "Vie scolaire",
                     "Présences, discipline, emploi du temps"),
                    ("/fonctionnalites/finances/", "Finances de l'école",
                     "Frais scolaires, caisse, paie"),
                    ("/fonctionnalites/admissions-et-orientation/", "Admissions et orientation",
                     "Concours, candidats, vœux, affectation"),
                    ("/fonctionnalites/direction-et-pilotage/", "Direction et pilotage",
                     "Rapports, communication, archives"),
                ],
            },
        ],
    },
    {
        "cle": "tarifs",
        "libelle": "Tarifs",
        "colonnes": [
            {
                "titre": "Abonnement",
                "liens": [
                    ("/tarifs/", "Les quatre offres",
                     "Ascension, Prime, Pilote, Infinite"),
                    ("/tarifs/comparer/", "Comparer les offres",
                     "Le tableau ligne par ligne"),
                ],
            },
        ],
    },
    {
        "cle": "services",
        "libelle": "Services",
        "colonnes": [
            {
                "titre": "Accompagnement",
                "liens": [
                    ("/services/", "Tous les services", "Ce que notre équipe fait pour vous"),
                    ("/services/installation/", "Installation et configuration", "60 $, forfait unique"),
                    ("/services/formation/", "Formation du personnel", "30, 60 ou 100 $"),
                    ("/services/campagne-de-capture/", "Campagne de capture", "0,50 $ par élève"),
                ],
            },
        ],
    },
    {
        "cle": "ressources",
        "libelle": "Ressources",
        "colonnes": [
            {
                "titre": "Comprendre Ardoise",
                "liens": [
                    ("/faq/", "Questions fréquentes", "Les 25 questions posées avant de signer"),
                    ("/securite/", "Sécurité et données", "Où sont les données, qui y accède"),
                    ("/contact/", "Parler à quelqu'un", "Demander un accompagnement"),
                ],
            },
        ],
    },
]


def _menu_bureau(actif):
    parts = ['<ul class="nav-niveau1">']
    for bloc in MENU:
        ouvert = ' data-actif="oui"' if actif == bloc["cle"] else ""
        parts.append(f'<li class="a-sous-menu"{ouvert}>')
        parts.append(
            f'<button type="button" class="declencheur" aria-expanded="false" '
            f'aria-controls="sm-{bloc["cle"]}">{bloc["libelle"]}'
            f'<span class="chevron" aria-hidden="true"></span></button>'
        )
        parts.append(f'<div class="sous-menu" id="sm-{bloc["cle"]}" hidden>')
        parts.append('<div class="sm-conteneur">')
        for col in bloc["colonnes"]:
            parts.append('<div class="sm-colonne">')
            parts.append(f'<p class="sm-titre">{col["titre"]}</p>')
            parts.append("<ul>")
            for url, libelle, note in col["liens"]:
                parts.append(
                    f'<li><a href="{url}"><span class="sm-lien">{libelle}</span>'
                    f'<span class="sm-note">{note}</span></a></li>'
                )
            parts.append("</ul></div>")
        parts.append("</div></div></li>")
    parts.append("</ul>")
    return "\n".join(parts)


def _menu_mobile():
    parts = ['<div class="panneau-mobile" id="panneau-mobile" hidden>', '<div class="conteneur">']
    for bloc in MENU:
        parts.append('<section class="bloc-mobile">')
        parts.append(f'<h2>{bloc["libelle"]}</h2>')
        for col in bloc["colonnes"]:
            parts.append("<ul>")
            for url, libelle, note in col["liens"]:
                parts.append(f'<li><a href="{url}">{libelle}</a></li>')
            parts.append("</ul>")
        parts.append("</section>")
    parts.append(
        '<div class="actions-mobile">'
        '<a class="bouton secondaire pleine-largeur" href="/connexion.html">Se connecter</a>'
        '<a class="bouton ocre pleine-largeur" href="/contact/">Découvrir Ardoise</a>'
        "</div>"
    )
    parts.append("</div></div>")
    return "\n".join(parts)


def entete(actif):
    return f"""<header class="entete">
  <div class="conteneur">
    <a class="marque" href="/">Ardoise</a>

    <nav class="nav-site" aria-label="Navigation principale">
      {_menu_bureau(actif)}
    </nav>

    <div class="actions-entete">
      <button class="bascule-theme" data-bascule-theme type="button" aria-label="Changer de thème">☾</button>
      <a class="lien-connexion" href="/connexion.html">Se connecter</a>
      <a class="bouton ocre petit" href="/contact/">Découvrir Ardoise</a>
      <button class="bascule-menu" type="button" aria-expanded="false"
              aria-controls="panneau-mobile" aria-label="Ouvrir le menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
  {_menu_mobile()}
</header>"""


PIED = """<footer class="pied">
  <div class="conteneur">
    <div class="grille">
      <div>
        <div class="marque">Ardoise</div>
        <p class="description">
          Plateforme de gestion scolaire pour les établissements de la République
          démocratique du Congo et d'Afrique francophone.
        </p>
      </div>
      <div>
        <h2>Produit</h2>
        <ul>
          <li><a href="/fonctionnalites/">Fonctionnalités</a></li>
          <li><a href="/fonctionnalites/ia/">Intelligence artificielle</a></li>
          <li><a href="/securite/">Sécurité</a></li>
        </ul>
      </div>
      <div>
        <h2>Par domaine</h2>
        <ul>
          <li><a href="/fonctionnalites/gestion-scolaire/">Gestion scolaire</a></li>
          <li><a href="/fonctionnalites/notes-et-bulletins/">Notes et bulletins</a></li>
          <li><a href="/fonctionnalites/vie-scolaire/">Vie scolaire</a></li>
          <li><a href="/fonctionnalites/finances/">Finances</a></li>
          <li><a href="/fonctionnalites/admissions-et-orientation/">Admissions et orientation</a></li>
          <li><a href="/fonctionnalites/direction-et-pilotage/">Direction et pilotage</a></li>
        </ul>
      </div>
      <div>
        <h2>Offres et services</h2>
        <ul>
          <li><a href="/tarifs/">Tarifs</a></li>
          <li><a href="/tarifs/comparer/">Comparer les offres</a></li>
          <li><a href="/services/installation/">Installation</a></li>
          <li><a href="/services/formation/">Formation</a></li>
          <li><a href="/services/campagne-de-capture/">Campagne de capture</a></li>
        </ul>
      </div>
      <div>
        <h2>Ressources</h2>
        <ul>
          <li><a href="/faq/">Questions fréquentes</a></li>
          <li><a href="/contact/">Nous contacter</a></li>
          <li><a href="/connexion.html">Se connecter</a></li>
          <li><a href="/confidentialite.html">Confidentialité</a></li>
        </ul>
      </div>
    </div>
    <div class="bas">
      <div>© 2026 Ardoise — Logiciel de gestion scolaire.</div>
      <div>Fait pour les écoles de la RDC.</div>
    </div>
  </div>
</footer>"""


# ------------------------------------------------------------------- Rendus

def fil(items):
    """Fil d'Ariane visible + BreadcrumbList. Le dernier élément n'est pas un lien."""
    if not items:
        return "", None
    html = ['<nav class="fil-ariane" aria-label="Fil d\'Ariane"><div class="conteneur"><ol>']
    elements = []
    for i, (libelle, url) in enumerate(items):
        dernier = i == len(items) - 1
        if dernier:
            html.append(f'<li aria-current="page">{libelle}</li>')
        else:
            html.append(f'<li><a href="{url}">{libelle}</a></li>')
        elements.append({
            "@type": "ListItem", "position": i + 1, "name": libelle,
            "item": SITE + url if url else None,
        })
    for e in elements:
        if e["item"] is None:
            del e["item"]
    html.append("</ol></div></nav>")
    return "\n".join(html), {"@type": "BreadcrumbList", "itemListElement": elements}


def hero(eyebrow, h1, chapeau, boutons=None, mention=None, aparte=None,
         illustration=None):
    """Hero d'une page fille.

    `illustration` prend un couple (clé, libellé) et remplit la seconde
    colonne de la grille — celle qui restait vide sur toutes les pages de
    domaine. C'est une alternative à `aparte`, pas un ajout : les deux
    occupent la même colonne, et aucune page n'a besoin des deux.
    """
    b = ""
    if boutons:
        liens = "".join(
            f'<a class="bouton {classe}" href="{url}">{libelle}</a>'
            for url, libelle, classe in boutons
        )
        b = f'<div class="groupe-cta">{liens}</div>'
    m = f'<p class="mention-cta">{mention}</p>' if mention else ""
    if aparte:
        droite = f'<div class="hero-aparte">{aparte}</div>'
    elif illustration:
        import illustrations
        droite = illustrations.figure(illustration[0], illustration[1])
    else:
        droite = ""
    classe_grille = "grille" if (aparte or illustration) else ""
    return f"""<section class="hero-page regle">
  <div class="conteneur {classe_grille}">
    <div>
      <p class="eyebrow">{eyebrow}</p>
      <h1>{h1}</h1>
      <p class="chapeau">{chapeau}</p>
      {b}{m}
    </div>
    {droite}
  </div>
</section>"""


def cta_final(titre, texte, boutons):
    liens = "".join(
        f'<a class="bouton {classe}" href="{url}">{libelle}</a>'
        for url, libelle, classe in boutons
    )
    return f"""<section class="cta-final">
  <div class="conteneur">
    <h2>{titre}</h2>
    <p>{texte}</p>
    <div class="groupe-cta" style="justify-content:center">{liens}</div>
  </div>
</section>"""


def pour_aller_plus_loin(liens):
    """Maillage interne explicite en fin de page. Trois à cinq liens, jamais plus."""
    cartes = "".join(
        f'<a class="carte-lien" href="{url}"><span class="titre">{titre}</span>'
        f'<span class="texte">{texte}</span></a>'
        for url, titre, texte in liens
    )
    return f"""<section class="section serree" aria-labelledby="plus-loin">
  <div class="conteneur">
    <h2 id="plus-loin" class="titre-maillage">Pour aller plus loin</h2>
    <div class="grille-liens">{cartes}</div>
  </div>
</section>"""


def faq_bloc(titre, questions, id_section="questions", intro=None):
    """Bloc FAQ visible. Le JSON-LD correspondant est produit par faq_jsonld()."""
    details = "".join(
        f"<details><summary>{q}</summary><div>{r}</div></details>"
        for q, r in questions
    )
    p = f'<p class="chapeau">{intro}</p>' if intro else ""
    return f"""<section class="section alt" id="{id_section}">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Questions</span>
      <h2>{titre}</h2>
      {p}
    </div>
    <div class="faq">{details}</div>
  </div>
</section>"""


def faq_jsonld(questions):
    import re
    def net(t):
        return re.sub(r"<[^>]+>", "", t).replace("&nbsp;", " ").replace("\u00a0", " ").strip()
    return {
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": net(q),
             "acceptedAnswer": {"@type": "Answer", "text": net(r)}}
            for q, r in questions
        ],
    }


def rendre(chemin, url, titre, description, corps, actif=None,
           jsonld=None, og_type="website", scripts=None):
    """Écrit une page complète. `url` est le chemin canonique (avec / final)."""
    graphe = list(jsonld or [])
    for i, obj in enumerate(graphe):
        obj.setdefault("@id", f"{SITE}{url}#n{i}")
    bloc_ld = ""
    if graphe:
        bloc_ld = ('<script type="application/ld+json">\n'
                   + json.dumps({"@context": "https://schema.org", "@graph": graphe},
                                ensure_ascii=False, indent=2)
                   + "\n</script>")

    js = '<script src="/catalogue.js" defer></script>\n<script src="/nav.js" defer></script>'
    if scripts:
        js += "\n" + scripts

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />

<title>{titre}</title>
<meta name="description" content="{description}" />
<link rel="canonical" href="{SITE}{url}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="author" content="Ardoise" />
<meta name="theme-color" content="#F6F2E7" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#141C18" media="(prefers-color-scheme: dark)" />

<meta property="og:type" content="{og_type}" />
<meta property="og:site_name" content="Ardoise" />
<meta property="og:locale" content="fr_CD" />
<meta property="og:url" content="{SITE}{url}" />
<meta property="og:title" content="{titre}" />
<meta property="og:description" content="{description}" />
<meta property="og:image" content="{SITE}/icone-512.png" />
<meta property="og:image:alt" content="Ardoise, plateforme de gestion scolaire" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{titre}" />
<meta name="twitter:description" content="{description}" />
<meta name="twitter:image" content="{SITE}/icone-512.png" />

<link rel="icon" type="image/png" sizes="192x192" href="/icone-192.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/icone-ios-180.png" />
<link rel="manifest" href="/manifest.json" />

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preconnect" href="https://scolaire-saas-backend.onrender.com" />
<link href="{POLICES}" rel="stylesheet" />
<link rel="stylesheet" href="/site.css" />

{bloc_ld}
</head>

<body>
<a class="saut-contenu" href="#contenu">Aller au contenu</a>

{entete(actif)}

<main id="contenu">

{corps}

</main>

{PIED}

{js}
</body>
</html>
"""
    dest = os.path.join(SORTIE, chemin)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w", encoding="utf-8") as f:
        f.write(html)
    return url


SORTIE = os.environ.get("SORTIE", "/home/claude/work/site")
