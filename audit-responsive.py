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
    for m in re.finditer(r'(?<!max-)(?<!min-)width:\s*(\d{3,4})px', s):
        largeur = int(m.group(1))
        if largeur > LARGEUR_MOBILE:
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


def main():
    dossier = sys.argv[1] if len(sys.argv) > 1 else '.'
    total = {'CRITIQUE': 0, 'IMPORTANT': 0, 'MOYEN': 0}
    pages_touchees = 0

    for fichier in sorted(os.listdir(dossier)):
        if not fichier.endswith('.html'):
            continue
        problemes = auditer(os.path.join(dossier, fichier))
        if not problemes:
            continue
        pages_touchees += 1
        print(f"\n{fichier}")
        # Regroupé par type : dix fois « largeur fixe 400px » est UN problème,
        # pas dix.
        vus = {}
        for gravite, detail in problemes:
            total[gravite] += 1
            cle = re.sub(r'\(ligne \d+\)', '', detail).strip()
            vus.setdefault((gravite, cle), 0)
            vus[(gravite, cle)] += 1
        for (gravite, detail), nb in sorted(vus.items()):
            print(f"  [{gravite:9}] {detail}" + (f"  ×{nb}" if nb > 1 else ''))

    print(f"\n{'=' * 60}")
    print(f"{pages_touchees} page(s) concernée(s)")
    print(f"  critiques : {total['CRITIQUE']}  |  importants : {total['IMPORTANT']}"
          f"  |  moyens : {total['MOYEN']}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
