# -*- coding: utf-8 -*-
"""Illustrations matricielles du site public Ardoise.

Chaque scène existe en deux variantes WebP : une pour le cahier clair et une
pour le tableau sombre. Le HTML conserve la même enveloppe qu'auparavant ; le
CSS choisit simplement l'image adaptée au thème actif.
"""


CHEMIN = "/public/site/illustrations"


def figure(cle, alt, classe="illus-hero"):
    """Retourne une illustration responsive adaptée aux deux thèmes."""
    prioritaire = classe == "illus-accueil"
    chargement = "eager" if prioritaire else "lazy"
    priorite = ' fetchpriority="high"' if prioritaire else ""
    source_claire = f"{CHEMIN}/light/{cle}.webp"
    source_sombre = f"{CHEMIN}/dark/{cle}.webp"
    return (
        f'<figure class="illus {classe} illus-{cle}">'
        '<div class="illus-cadre">'
        f'<img class="illus-image" src="{source_claire}" alt="{alt}" '
        f'data-src-clair="{source_claire}" data-src-sombre="{source_sombre}" '
        f'width="800" height="800" loading="{chargement}" '
        f'decoding="async"{priorite}>'
        '</div></figure>'
    )
