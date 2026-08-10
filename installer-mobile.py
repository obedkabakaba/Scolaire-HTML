#!/usr/bin/env python3
"""
Branche `mobile.css` et `mobile.js` dans les pages de la plateforme.

POURQUOI UN SCRIPT
------------------
Trente-sept pages, deux balises chacune. À la main, c'est trente-sept
occasions d'oublier — et un oubli ne se voit pas : la page reste belle sur
l'ordinateur du développeur et casse sur le téléphone du titulaire.

OÙ LES BALISES SONT POSÉES, ET POURQUOI LÀ
------------------------------------------
`mobile.css` est inséré en DERNIER dans le <head>, après `ui.css`. À
spécificité égale, c'est la dernière règle lue qui gagne : c'est la seule
position depuis laquelle une couche corrective peut corriger quoi que ce soit.

`mobile.js` est inséré en DERNIER avant </body>, après `didacticiel.js` : il a
besoin que l'entrée « Aide & Tutoriels » existe déjà au moment où il réorganise
le tiroir.

Le script est idempotent : relancé, il ne double aucune balise.
"""
import os
import re
import sys

RACINE = sys.argv[1] if len(sys.argv) > 1 else '.'

LIEN_CSS = '<link rel="stylesheet" href="{prefixe}mobile.css" />'
BALISE_JS = '<script src="{prefixe}mobile.js"></script>'


def profondeur(chemin, racine):
    """Un fichier dans /faq/ doit écrire ../mobile.css, pas mobile.css."""
    relatif = os.path.relpath(chemin, racine)
    niveaux = len(relatif.split(os.sep)) - 1
    return '../' * niveaux


def traiter(chemin, racine):
    # `newline=''` désactive la traduction universelle des fins de ligne.
    # Sans lui, Python lit les CRLF de Windows, les rend en LF, et réécrit tout
    # le fichier en LF : deux balises ajoutées font alors apparaître les 1040
    # lignes de la page comme modifiées, et la revue du diff devient impossible.
    with open(chemin, encoding='utf-8', newline='') as f:
        source = f.read()

    # Une page sans <head> ni <body> n'est pas une page : on n'y touche pas.
    if '</head>' not in source.lower() or '</body>' not in source.lower():
        return None

    # On adopte la fin de ligne majoritaire du fichier pour les lignes ajoutées.
    saut = '\r\n' if source.count('\r\n') > source.count('\n') - source.count('\r\n') else '\n'

    prefixe = profondeur(chemin, racine)
    css = LIEN_CSS.format(prefixe=prefixe)
    js = BALISE_JS.format(prefixe=prefixe)
    modifie = source
    actions = []

    if 'mobile.css' not in modifie:
        # Juste avant la fermeture du <head> : après toute autre feuille.
        i = modifie.lower().rindex('</head>')
        modifie = modifie[:i] + css + saut + modifie[i:]
        actions.append('css')

    if 'mobile.js' not in modifie:
        i = modifie.lower().rindex('</body>')
        modifie = modifie[:i] + js + saut + modifie[i:]
        actions.append('js')

    if not actions:
        return []

    with open(chemin, 'w', encoding='utf-8', newline='') as f:
        f.write(modifie)
    return actions


def main():
    total, touchees = 0, 0
    for dossier, sous, fichiers in os.walk(RACINE):
        # Rien à faire dans les ressources.
        if any(p in dossier for p in ('/public', '/.git')):
            continue
        for nom in sorted(fichiers):
            if not nom.endswith('.html'):
                continue
            chemin = os.path.join(dossier, nom)
            total += 1
            actions = traiter(chemin, RACINE)
            if actions is None:
                print(f'  ignorée (pas une page complète) : {chemin}')
            elif actions:
                touchees += 1
                print(f'  + {"+".join(actions):8} {os.path.relpath(chemin, RACINE)}')
    print(f'\n{touchees} page(s) équipée(s) sur {total} examinée(s).')


if __name__ == '__main__':
    main()
