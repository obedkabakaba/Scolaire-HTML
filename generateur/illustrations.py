# -*- coding: utf-8 -*-
"""Illustrations détourées du site public Ardoise.

Les scènes n'ont plus de toile rectangulaire : leur transparence laisse le
cahier clair ou le tableau sombre apparaître naturellement. Une seule source
est donc volontairement utilisée dans les deux thèmes ; le CSS adapte l'ombre
portée sans rogner ni déformer l'image.
"""


CHEMIN = "/public/site/illustrations"

DIMENSIONS = {
    "ecole": (1000, 848), "cahiers": (1000, 684), "roles": (1000, 961),
    "bulletin": (1000, 861), "appel": (1000, 845), "recu": (1000, 844),
    "concours": (1000, 815), "pilotage": (1000, 758), "ia": (1000, 924),
    "fonctionnalites": (1000, 925), "services": (1000, 804),
    "installation": (1000, 890), "formation": (1000, 717),
    "capture": (1000, 854), "securite": (996, 1000),
    "guides": (1000, 772), "a-propos": (1000, 525),
    "offre-ascension": (611, 640), "offre-prime": (640, 450),
    "offre-pilote": (640, 563), "offre-infinite": (640, 429),
}


def image(cle, alt, classe="illus-image", chargement="lazy"):
    """Retourne une image détourée, avec ses dimensions réelles."""
    largeur, hauteur = DIMENSIONS[cle]
    source = f"{CHEMIN}/{cle}.webp"
    return (
        f'<img class="{classe}" src="{source}" alt="{alt}" '
        f'data-src-clair="{source}" data-src-sombre="{source}" '
        f'width="{largeur}" height="{hauteur}" loading="{chargement}" '
        'decoding="async">'
    )


def figure(cle, alt, classe="illus-hero"):
    """Retourne une illustration responsive qui laisse voir le thème."""
    prioritaire = classe == "illus-accueil"
    chargement = "eager" if prioritaire else "lazy"
    contenu = image(cle, alt, chargement=chargement)
    if prioritaire:
        contenu = contenu.replace('decoding="async">',
                                  'decoding="async" fetchpriority="high">')
    return (
        f'<figure class="illus {classe} illus-{cle}">'
        '<div class="illus-cadre">'
        f'{contenu}'
        '</div></figure>'
    )


def offre(code, alt):
    """Petit emblème placé en tête d'une carte tarifaire."""
    return image(f"offre-{code}", alt, classe="illustration-offre")
