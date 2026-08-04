#!/usr/bin/env python3
"""
Retire la carte des droits dupliquée dans les pages HTML.

CE QUE FAIT CE SCRIPT
---------------------
Chaque page portait sa propre copie de `gererAccesParRole()` — une carte de
29 entrées « page → rôles autorisés », suivie de la logique de filtrage. Trente
copies rigoureusement identiques.

Cette logique vit désormais dans `ui.js` (`ArdoiseAcces`). Le script supprime
les copies devenues inutiles et laisse un commentaire à leur place, pour qu'un
lecteur comprenne où elle est passée plutôt que de constater son absence.

VÉRIFICATION FAITE AVANT DE CENTRALISER
---------------------------------------
Les 30 copies ont été comparées entre elles : 29 entrées chacune, aucune
divergence, aucun droit différent d'une page à l'autre. La fusion ne change
donc AUCUNE permission — c'est une déduplication, pas une refonte.

PRÉREQUIS
---------
Déployez d'abord `ui.js` : sans lui, les pages nettoyées n'auraient plus aucun
filtrage. (Le serveur refuserait quand même les accès non autorisés, mais les
liens resteraient visibles.)

UTILISATION
-----------
    cd /chemin/vers/Scolaire-HTML-main
    python3 nettoyer-cartes-droits.py --simulation
    python3 nettoyer-cartes-droits.py

Idempotent : le relancer ne fait rien de plus.
"""
import os
import re
import sys

REMPLACEMENT = (
    "// Filtrage des droits : centralisé dans ui.js (ArdoiseAcces).\n"
    "  // La carte des permissions était recopiée dans 30 pages ; elle est\n"
    "  // désormais unique. Voir ui.js pour la modifier."
)


def main():
    simulation = '--simulation' in sys.argv

    if not os.path.exists('ui.js'):
        print("ERREUR : ui.js est absent de ce dossier.")
        return 1
    if 'ArdoiseAcces' not in open('ui.js', encoding='utf-8').read():
        print("ERREUR : le ui.js présent ne contient pas ArdoiseAcces.")
        print("Déployez d'abord la nouvelle version, sinon les pages nettoyées")
        print("n'auraient plus aucun filtrage de navigation.")
        return 1

    nettoyees, deja, sans = [], [], []

    for fichier in sorted(os.listdir('.')):
        if not fichier.endswith('.html'):
            continue
        contenu = open(fichier, encoding='utf-8').read()

        debut = contenu.find('(function gererAccesParRole()')
        if debut == -1:
            (deja if 'ArdoiseAcces' in contenu or 'centralisé dans ui.js' in contenu
             else sans).append(fichier)
            continue

        fin = contenu.index('})();', debut) + 5
        retire = fin - debut
        if not simulation:
            open(fichier, 'w', encoding='utf-8').write(
                contenu[:debut] + REMPLACEMENT + contenu[fin:])
        nettoyees.append((fichier, retire))

    verbe = 'seraient nettoyées' if simulation else 'nettoyées'
    total = sum(n for _, n in nettoyees)
    print(f"\n{len(nettoyees)} page(s) {verbe} — {total} caractères de duplication retirés :")
    for f, n in nettoyees:
        print(f"  {f:34} −{n} caractères")

    if deja:
        print(f"\n{len(deja)} déjà nettoyée(s).")
    if sans:
        print(f"\n{len(sans)} page(s) sans carte de droits (normal pour les pages "
              f"publiques et les aperçus) : " + ', '.join(sans))

    if simulation:
        print("\n(simulation : aucun fichier modifié)")
    else:
        print("\nVérifiez ensuite qu'un compte non-directeur ne voit toujours pas")
        print("les menus qui ne le concernent pas.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
