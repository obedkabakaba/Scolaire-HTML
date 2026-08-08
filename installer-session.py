#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Installe `session.js` en tête de chaque page d'Ardoise.

POURQUOI UN SCRIPT PLUTÔT QU'UNE MODIFICATION À LA MAIN
-------------------------------------------------------
Trente-sept pages doivent charger le même fichier, avant les autres. Le faire à
la main, c'est trente-sept occasions d'oublier — et un oubli ne se voit pas :
la page fonctionne, jusqu'au jour où quelqu'un la rouvre après un quart d'heure
et que le guide ne s'affiche plus. Exactement le défaut qu'on corrige.

L'ORDRE EST LE POINT ESSENTIEL
------------------------------
`session.js` enveloppe `window.fetch`. `filtre-cycle.js` l'enveloppe aussi, et
capture la référence au moment de son chargement pour ses propres appels
(`fetchOrigine`). Si `filtre-cycle.js` se charge en premier, ces appels-là
contournent le rejeu et continuent d'échouer en 401. `session.js` doit donc
venir avant lui — et avant `acces-presences.js`, `ui.js` et `didacticiel.js`,
pour la même raison.

Le script insère donc la balise juste avant la PREMIÈRE balise <script src>
de la page, quelle qu'elle soit.

IDEMPOTENT
----------
Relancer le script ne fait rien sur une page déjà traitée. On peut le rejouer
après chaque `git pull` sans réfléchir.

USAGE
-----
    python3 installer-session.py            # applique
    python3 installer-session.py --verifier # n'écrit rien, dit ce qui manque
"""

import os
import re
import sys

# Les pages sans session : elles n'ont pas de jeton à renouveler.
#   · connexion / réinitialisation : on n'y est pas connecté ;
#   · les quatre aperçus de bulletin : vues d'impression autonomes, sans API ;
#   · super-admin : sa session utilise des clés de stockage distinctes, et
#     enveloppes fetch pour deux systèmes d'authentification différents sur la
#     même page serait une source de confusion durable.
EXCLUES = {
    'index.html',
    'connexion.html',
    'changer-mot-de-passe.html',
    'reinitialiser-mot-de-passe.html',
    'confidentialite.html',
    'apercu-bulletin-primaire.html',
    'apercu-bulletin-secondaire.html',
    'apercu-bulletin-semestre.html',
    'apercu-bulletin-terminale.html',
    'super-admin.html',
}

BALISE = '<script src="session.js"></script>'

# Première balise <script src="…"> de la page, quelle qu'elle soit.
PREMIER_SCRIPT = re.compile(r'([ \t]*)<script\s+src=', re.IGNORECASE)


def traiter(chemin, verifier_seulement):
    with open(chemin, 'r', encoding='utf-8', newline='') as f:
        contenu = f.read()

    nom = os.path.basename(chemin)

    if 'session.js' in contenu:
        return 'deja'

    # Une page sans aucun script externe n'a rien à protéger.
    m = PREMIER_SCRIPT.search(contenu)
    if not m:
        return 'aucun-script'

    if verifier_seulement:
        return 'manquant'

    # On respecte la fin de ligne du fichier : le dépôt mêle LF et CRLF, et
    # réécrire une page entière dans l'autre convention rendrait le diff
    # illisible pour un changement d'une ligne.
    fin_ligne = '\r\n' if '\r\n' in contenu[:4000] else '\n'
    indentation = m.group(1)

    insertion = (
        indentation + '<!-- Session partagée : renouvellement du jeton et rejeu des requêtes'
        + fin_ligne + indentation + '     expirées. Doit rester AVANT les autres scripts. -->'
        + fin_ligne + indentation + BALISE + fin_ligne
    )

    contenu = contenu[:m.start()] + insertion + contenu[m.start():]

    with open(chemin, 'w', encoding='utf-8', newline='') as f:
        f.write(contenu)
    return 'ajoute'


def main():
    verifier = '--verifier' in sys.argv
    dossier = os.path.dirname(os.path.abspath(__file__))

    bilan = {'ajoute': [], 'deja': [], 'manquant': [], 'aucun-script': [], 'exclue': []}

    for nom in sorted(os.listdir(dossier)):
        if not nom.endswith('.html'):
            continue
        if nom in EXCLUES:
            bilan['exclue'].append(nom)
            continue
        bilan[traiter(os.path.join(dossier, nom), verifier)].append(nom)

    if verifier:
        print("Vérification (aucun fichier modifié)")
        print("  déjà équipées : %d" % len(bilan['deja']))
        print("  à équiper     : %d" % len(bilan['manquant']))
        for n in bilan['manquant']:
            print("      - %s" % n)
    else:
        print("session.js ajouté à %d page(s)" % len(bilan['ajoute']))
        for n in bilan['ajoute']:
            print("      + %s" % n)
        if bilan['deja']:
            print("déjà équipées : %d" % len(bilan['deja']))

    if bilan['exclue']:
        print("exclues volontairement : %s" % ', '.join(bilan['exclue']))
    if bilan['aucun-script']:
        print("sans script externe (ignorées) : %s" % ', '.join(bilan['aucun-script']))

    return 0


if __name__ == '__main__':
    sys.exit(main())
