#!/usr/bin/env python3
"""
INSTALLATION DE LA REMONTÉE D'ERREURS DANS LES PAGES
===========================================================================

POURQUOI UN SCRIPT PLUTÔT QU'UNE ÉDITION MANUELLE
-------------------------------------------------
Trente-trois pages doivent charger `remontee-erreurs.js`. Les modifier à la
main, c'est en oublier une — et la page oubliée est précisément celle dont on
ne saura jamais qu'elle plante, puisqu'elle est la seule à ne rien signaler.

Ce script est IDEMPOTENT : le relancer ne fait rien de plus. Il peut donc être
rejoué après l'ajout d'un nouvel écran.

L'ORDRE D'INSERTION EST LE POINT DÉLICAT
----------------------------------------
`remontee-erreurs.js` doit être chargé :

  · APRÈS `session.js`, qui définit la résolution de `API_BASE_URL` et le
    stockage des jetons. Sans jeton, le capteur ne peut rien envoyer ;
  · AVANT les scripts propres à la page, pour que son enveloppe autour de
    `fetch` soit déjà posée quand ceux-ci lancent leurs premiers appels.

Placé trop tôt, il ne saurait pas où envoyer. Placé trop tard, il manquerait
exactement les erreurs de chargement — c'est-à-dire les plus fréquentes.
"""

import glob
import os
import re
import sys

BALISE = '<script src="remontee-erreurs.js"></script>'

# Pages HORS session applicative. Elles n'ont pas de jeton : le capteur y
# resterait muet, et l'y ajouter donnerait la fausse impression d'être couvert.
# Les erreurs de connexion se diagnostiquent côté serveur, où la tentative
# laisse une trace.
HORS_SESSION = {
    'connexion.html',
    'mot-de-passe-oublie.html',
    'reinitialiser-mot-de-passe.html',
    'index.html',
    'confidentialite.html',
    'conditions.html',
}


def installer(chemin):
    source = open(chemin, encoding='utf-8').read()
    nom = os.path.basename(chemin)

    if BALISE in source:
        return 'deja'
    if nom in HORS_SESSION:
        return 'ignoree'
    if 'src="session.js"' not in source:
        # Pas de session.js : soit page publique, soit page à part.
        return 'sans_session'

    # Juste après session.js — voir l'explication d'ordre en tête de fichier.
    motif = re.compile(r'([ \t]*)<script src="session\.js"></script>')
    m = motif.search(source)
    if not m:
        return 'motif_absent'

    indentation = m.group(1)
    remplacement = m.group(0) + '\n' + indentation + BALISE
    source = source[:m.start()] + remplacement + source[m.end():]

    open(chemin, 'w', encoding='utf-8').write(source)
    return 'installe'


def main():
    racine = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))

    if not os.path.exists(os.path.join(racine, 'remontee-erreurs.js')):
        print(f"ÉCHEC : remontee-erreurs.js est absent de {racine}.")
        print("  Installer la balise sans le fichier produirait un 404 sur")
        print("  chaque page — soit exactement le contraire du but recherché.")
        return 2

    bilan = {}
    for chemin in sorted(glob.glob(os.path.join(racine, '*.html'))):
        etat = installer(chemin)
        bilan.setdefault(etat, []).append(os.path.basename(chemin))

    libelles = {
        'installe': 'installé',
        'deja': 'déjà présent',
        'ignoree': 'hors session (volontairement ignorée)',
        'sans_session': 'sans session.js',
        'motif_absent': 'ATTENTION — session.js présent mais non localisable',
    }

    for etat in ('installe', 'deja', 'ignoree', 'sans_session', 'motif_absent'):
        pages = bilan.get(etat)
        if not pages:
            continue
        print(f"\n{libelles[etat]} : {len(pages)}")
        if etat in ('installe', 'motif_absent'):
            for p in pages:
                print(f"    {p}")

    # Un `motif_absent` est une vraie anomalie : la page charge la session mais
    # le script n'a pas su où s'insérer. La signaler par un code de sortie non
    # nul évite qu'elle passe inaperçue dans le défilement.
    return 1 if bilan.get('motif_absent') else 0


if __name__ == '__main__':
    sys.exit(main())
