#!/usr/bin/env python3
"""
Ajoute l'entrée « Comptabilité » à la navigation des pages existantes.

POURQUOI UN SCRIPT PLUTÔT QUE 28 FICHIERS
-----------------------------------------
L'ajout consiste en DEUX lignes par page : une entrée de menu, et une entrée
dans la carte des droits — sans cette seconde ligne, le lien s'affiche puis
disparaît au filtrage par rôle, ce qui donne l'impression d'un bug.

Livrer 28 fichiers vous obligerait à tous les remplacer, en écrasant au passage
vos propres modifications. Ce script n'ajoute que ce qui manque.

UTILISATION
-----------
    cd /chemin/vers/Scolaire-HTML-main
    python3 installer-lien-comptabilite.py --simulation   # pour voir
    python3 installer-lien-comptabilite.py               # pour appliquer

Le script est IDEMPOTENT : le relancer ne crée pas de doublon.
"""
import os
import re
import sys

LIEN = '        <li><a class="nav-item" href="comptabilite.html">Comptabilité</a></li>\n'

# La comptabilité expose la rémunération du personnel : elle reste au directeur
# et au comptable. Le préfet et le secrétariat en sont exclus.
DROITS = "      'comptabilite.html': ['directeur', 'comptable'],\n"


def main():
    simulation = '--simulation' in sys.argv
    modifiees, deja, sans_menu, sans_droits = [], [], [], []

    for fichier in sorted(os.listdir('.')):
        if not fichier.endswith('.html'):
            continue
        contenu = open(fichier, encoding='utf-8').read()

        if 'comptabilite.html' in contenu:
            deja.append(fichier)
            continue
        # Les pages sans menu (connexion, aperçus de bulletins) sont hors sujet.
        if 'frais-scolaires.html"' not in contenu:
            sans_menu.append(fichier)
            continue

        nouveau = re.sub(
            r'(\s*<li><a class="nav-item" href="frais-scolaires\.html">[^<]*</a></li>\n)',
            r'\1' + LIEN, contenu, count=1)

        # La carte des droits doit connaître la nouvelle page, sinon le lien
        # est retiré au filtrage.
        avec_droits = re.sub(
            r"('frais-scolaires\.html':\s*\[[^\]]*\],\n)",
            r"\1" + DROITS, nouveau, count=1)

        if avec_droits == nouveau:
            # Menu ajouté mais pas de carte de droits trouvée : on le signale
            # plutôt que de laisser un lien qui disparaîtra sans explication.
            sans_droits.append(fichier)

        if not simulation:
            open(fichier, 'w', encoding='utf-8').write(avec_droits)
        modifiees.append(fichier)

    verbe = 'seraient modifiées' if simulation else 'modifiées'
    print(f"\n{len(modifiees)} page(s) {verbe} :")
    print('  ' + ', '.join(modifiees))

    if deja:
        print(f"\n{len(deja)} page(s) déjà à jour : " + ', '.join(deja))
    if sans_menu:
        print(f"\n{len(sans_menu)} page(s) sans menu, ignorées : " + ', '.join(sans_menu))
    if sans_droits:
        print(f"\nATTENTION — {len(sans_droits)} page(s) ont reçu le lien mais aucune")
        print("carte de droits n'y a été trouvée. Le lien pourrait y rester visible")
        print("pour des rôles non autorisés : " + ', '.join(sans_droits))

    if simulation:
        print("\n(simulation : aucun fichier modifié)")
    return 0


if __name__ == '__main__':
    sys.exit(main())
