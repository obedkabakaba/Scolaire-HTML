#!/usr/bin/env python3
"""
Audit responsive — repère ce qui casse sur un écran étroit.

POURQUOI UN AUDIT AUTOMATIQUE
-----------------------------
Je n'ai pas de navigateur : je ne peux pas REGARDER les pages sur un téléphone.
Mais les causes de non-responsivité sont mesurables dans le code, et ce sont
presque toujours les mêmes :

  · absence de <meta viewport> → le navigateur simule 980 px et dézoome tout,
    ce qui rend le texte illisible ;
  · largeurs FIXES en pixels supérieures à ~360 px ;
  · grilles dont la colonne minimale dépasse la largeur d'un téléphone ;
  · tableaux sans conteneur de défilement horizontal ;
  · absence totale de media query.

Cet audit ne remplace pas un vrai test sur appareil. Il élimine les causes
certaines, ce qui est déjà l'essentiel.
"""
import os
import re
import sys

import audit_commun as commun

# Largeur de référence : un téléphone d'entrée de gamme répandu en RDC.
LARGEUR_MOBILE = 360


def auditer(fichier):
    s = open(fichier, encoding='utf-8').read()
    problemes = []

    # 1. Le viewport : sans lui, RIEN n'est responsive, quelles que soient les
    #    media queries écrites ensuite.
    if 'name="viewport"' not in s:
        problemes.append(('CRITIQUE', 'aucune balise <meta viewport>'))

    # 2. Media queries
    nb_media = len(re.findall(r'@media[^{]*max-width', s))
    if nb_media == 0 and '<style>' in s:
        problemes.append(('IMPORTANT', 'aucune media query dans la page'))

    # 3. Largeurs fixes dépassant un écran de téléphone
    #
    # EXCEPTION JUSTIFIÉE : LES ÉLÉMENTS MIS À L'ÉCHELLE.
    #
    # Une largeur de 400px assortie d'un `transform: scale(0.25)` rend à
    # 100px : elle ne déborde pas, et la signaler est un FAUX POSITIF. C'est
    # le cas de la vignette de `generateur-modeles.html`, qui affiche un
    # modèle A4 en miniature — la largeur logique DOIT rester grande, sinon
    # la vignette n'a plus les proportions de la page qu'elle représente.
    #
    # Ce n'est pas une mise en liste d'exceptions : aucun nom de fichier
    # n'est codé ici. La règle est générale et vérifiable — « une largeur
    # réduite par une transformation d'échelle n'est pas une largeur
    # effective » — et la mesure dans Chromium (`audit-mobile.py`) la
    # confirme indépendamment : zéro débordement horizontal sur les 43 pages.
    #
    # On ne dispense que si l'échelle ramène RÉELLEMENT sous la limite ; une
    # vignette à `scale(0.9)` resterait signalée.
    for m in re.finditer(r'(?<!max-)(?<!min-)width:\s*(\d{3,4})px', s):
        largeur = int(m.group(1))
        if largeur <= LARGEUR_MOBILE:
            continue

        # Contexte : la règle CSS qui entoure cette déclaration.
        debut_regle = s.rfind('{', 0, m.start())
        fin_regle = s.find('}', m.end())
        regle = s[debut_regle:fin_regle] if debut_regle != -1 and fin_regle != -1 else ''

        echelle = re.search(r'transform:[^;}]*scale\(\s*([\d.]+)', regle)
        if echelle and largeur * float(echelle.group(1)) <= LARGEUR_MOBILE:
            continue

        ligne = s[:m.start()].count('\n') + 1
        problemes.append(('IMPORTANT', f'largeur fixe {largeur}px (ligne {ligne})'))

    # 4. Grilles à colonne minimale trop large : `minmax(320px, 1fr)` tient,
    #    `minmax(400px, 1fr)` déborde.
    for m in re.finditer(r'minmax\((\d{2,4})px', s):
        mini = int(m.group(1))
        if mini > 300:
            ligne = s[:m.start()].count('\n') + 1
            problemes.append(('MOYEN', f'colonne minimale {mini}px (ligne {ligne})'))

    # 5. Tableaux sans conteneur de défilement
    nb_tables = len(re.findall(r'<table', s))
    nb_conteneurs = len(re.findall(r'conteneur-tableau|overflow-x', s))
    if nb_tables > 0 and nb_conteneurs == 0:
        problemes.append(('IMPORTANT', f'{nb_tables} tableau(x) sans conteneur de défilement'))

    # 6. Padding généreux non réduit sur mobile
    gros_padding = len(re.findall(r'padding:\s*(?:2[4-9]|[3-9]\d)px', s))
    if gros_padding > 3 and nb_media == 0:
        problemes.append(('MOYEN', f'{gros_padding} paddings ≥ 24px sans allègement mobile'))

    return problemes


# Correspondance vers le vocabulaire commun des audits.
NIVEAUX = {'CRITIQUE': 'critique', 'IMPORTANT': 'importante', 'MOYEN': 'moyenne'}


def auditer_responsive(dossier):
    rapport = commun.Rapport('responsive', depot='Scolaire-HTML-main', chemin_depot=dossier)

    pages = [f for f in sorted(os.listdir(dossier)) if f.endswith('.html')]
    if not pages:
        rapport.echec_technique(
            f"Aucune page HTML dans {dossier}.\n"
            f"  L'audit n'a rien pu examiner : ce n'est pas un dépôt sain,\n"
            f"  c'est un chemin de travail incorrect.")
        return rapport

    for fichier in pages:
        rapport.fichier_examine()
        # Regroupé par type : dix fois « largeur fixe 400px » sur une même page
        # est UN problème à corriger, pas dix à compter.
        vus = {}
        for gravite, detail in auditer(os.path.join(dossier, fichier)):
            cle = (gravite, re.sub(r'\(ligne \d+\)', '', detail).strip())
            vus[cle] = vus.get(cle, 0) + 1

        for (gravite, detail), nb in sorted(vus.items()):
            rapport.constat(
                fichier, 'responsive_' + NIVEAUX[gravite],
                detail + (f"  ×{nb}" if nb > 1 else ''),
                gravite=NIVEAUX[gravite])

    return rapport


def main():
    p = commun.analyseur(__doc__, besoin_frontend=True)
    p.add_argument('dossier', nargs='?', help='Dossier des pages (par défaut : le dépôt frontend)')
    args = p.parse_args()

    dossier = args.dossier or args.frontend
    if not dossier:
        dossier = commun.trouver_depot('frontend', None, 'ARDOISE_FRONTEND')
    if not os.path.isdir(dossier):
        raise commun.EchecTechnique(f"Dossier introuvable : {dossier}")

    """LE CODE DE SORTIE ÉTAIT LE VRAI DÉFAUT DE CE SCRIPT.

    Il détectait correctement les douze problèmes importants, les affichait
    proprement… puis terminait par `return 0`. Une intégration continue qui
    n'inspecte que le code de sortie — c'est-à-dire toutes — voyait donc un
    audit vert. Le script disait la vérité à l'écran et mentait à la machine,
    et c'est la machine qui décide de déployer.

    `commun.executer` calcule le code depuis le rapport : 0 réussi,
    1 anomalies, 2 échec technique. Il n'y a plus de `return 0` à oublier.
    """
    return commun.executer(lambda: auditer_responsive(dossier), args)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except commun.EchecTechnique as e:
        print("ÉCHEC TECHNIQUE — l'audit n'a pas pu s'exécuter.\n")
        for ligne in str(e).split('\n'):
            print('  ' + ligne)
        sys.exit(2)
