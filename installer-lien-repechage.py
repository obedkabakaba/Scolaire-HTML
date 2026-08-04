#!/usr/bin/env python3
"""
Ajoute l'entrée « Repêchage » à la navigation des pages existantes.

DEUX lignes par page : l'entrée de menu ET l'entrée dans la carte des droits.
Sans la seconde, le lien s'affiche puis disparaît au filtrage par rôle, ce qui
ressemble à un bug.

    cd /chemin/vers/Scolaire-HTML-main
    python3 installer-lien-repechage.py --simulation
    python3 installer-lien-repechage.py

Idempotent : le relancer ne crée pas de doublon.
"""
import os
import re
import sys

LIEN = '        <li><a class="nav-item" href="repechage.html">Repêchage</a></li>\n'

# Le repêchage décide du passage : la direction le pilote, les enseignants
# saisissent les notes. Le secrétariat et la comptabilité n'y interviennent pas.
DROITS = "      'repechage.html': ['directeur', 'prefet', 'professeur', 'titulaire'],\n"

# Voisin logique : le repêchage se prononce juste après les résultats annuels.
ANCRE = 'bulletin-annuel.html'


def main():
    simulation = '--simulation' in sys.argv
    modifiees, deja, sans_menu, sans_droits = [], [], [], []

    for fichier in sorted(os.listdir('.')):
        if not fichier.endswith('.html'):
            continue
        contenu = open(fichier, encoding='utf-8').read()

        if 'repechage.html' in contenu:
            deja.append(fichier)
            continue
        if f'{ANCRE}"' not in contenu:
            sans_menu.append(fichier)
            continue

        nouveau = re.sub(
            r'(\s*<li><a class="nav-item" href="' + ANCRE.replace('.', r'\.') + r'">[^<]*</a></li>\n)',
            r'\1' + LIEN, contenu, count=1)

        avec_droits = re.sub(
            r"('" + ANCRE.replace('.', r'\.') + r"':\s*\[[^\]]*\],\n)",
            r"\1" + DROITS, nouveau, count=1)

        if avec_droits == nouveau:
            sans_droits.append(fichier)

        if not simulation:
            open(fichier, 'w', encoding='utf-8').write(avec_droits)
        modifiees.append(fichier)

    verbe = 'seraient modifiées' if simulation else 'modifiées'
    print(f"\n{len(modifiees)} page(s) {verbe} :\n  " + ', '.join(modifiees))
    if deja:
        print(f"\n{len(deja)} déjà à jour : " + ', '.join(deja))
    if sans_menu:
        print(f"\n{len(sans_menu)} sans menu, ignorées : " + ', '.join(sans_menu))
    if sans_droits:
        print(f"\nATTENTION — {len(sans_droits)} page(s) ont reçu le lien sans carte de droits.")
        print("Le lien pourrait y rester visible pour des rôles non autorisés : "
              + ', '.join(sans_droits))
    if simulation:
        print("\n(simulation : aucun fichier modifié)")
    return 0


if __name__ == '__main__':
    sys.exit(main())
