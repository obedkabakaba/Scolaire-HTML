#!/usr/bin/env python3
"""
Installe le didacticiel dans toutes les pages HTML du dépôt Scolaire-HTML.

POURQUOI UN SCRIPT PLUTÔT QUE 35 FICHIERS LIVRÉS
------------------------------------------------
L'installation consiste en UNE ligne ajoutée avant </body> dans chaque page.
Livrer 35 fichiers quasi identiques vous obligerait à tous les remplacer — et
à écraser au passage d'éventuelles modifications que vous auriez faites de
votre côté. Ce script n'ajoute que la ligne manquante et ne touche à rien
d'autre.

UTILISATION
-----------
    cd /chemin/vers/Scolaire-HTML-main
    python3 installer-didacticiel.py

    # pour voir ce qui serait fait, sans rien modifier :
    python3 installer-didacticiel.py --simulation

Le script est IDEMPOTENT : le relancer ne crée pas de doublon.
"""
import os
import sys

# Noms d'écran lisibles. Ils orientent la réponse de l'assistant : il sait
# depuis quel écran la question est posée.
ECRANS = {
    'dashboard-directeur': 'Tableau de bord',
    'dashboard-professeur': 'Tableau de bord enseignant',
    'dashboard-titulaire': 'Tableau de bord titulaire',
    'dashboard-secretaire': 'Tableau de bord secrétariat',
    'dashboard-comptable': 'Tableau de bord comptable',
    'dashboard-prefet': 'Tableau de bord préfet',
    'classes': 'Classes', 'eleves': 'Élèves', 'notes': 'Notes',
    'bulletins': 'Bulletins', 'presences': 'Présences', 'discipline': 'Discipline',
    'finances': 'Finances', 'frais': 'Frais scolaires', 'structure': 'Structure',
    'parametres': 'Paramètres', 'utilisateurs': 'Utilisateurs',
    'emploi-du-temps': 'Emploi du temps', 'calendrier': 'Calendrier',
    'rapports': 'Rapports', 'journal': "Journal d'activité",
    'orientation': 'Orientation', 'inscriptions': 'Inscriptions',
    'promotion': 'Promotion', 'archives': 'Archives', 'messages': 'Messagerie',
    'annonces': 'Annonces', 'travaux': 'Travaux',
    'modeles-bulletins': 'Modèles de bulletins', 'site-public': 'Site public',
    'profil': 'Mon profil', 'notifications': 'Notifications',
}

# Pages sans session ouverte : y poser un bouton d'aide qui appelle l'API
# produirait une erreur au chargement.
SANS_AIDE = {'index', 'connexion', 'changer-mot-de-passe'}

COMMENTAIRE = ("<!-- Didacticiel d'installation : bouton d'aide contextuel, "
               "partagé par toutes les pages. -->")


def main():
    simulation = '--simulation' in sys.argv

    if not os.path.exists('didacticiel.js'):
        print("ERREUR : didacticiel.js est absent de ce dossier.")
        print("Copiez-le ici avant de lancer l'installation.")
        return 1

    modifiees, deja, ignorees = [], [], []

    for fichier in sorted(os.listdir('.')):
        if not fichier.endswith('.html'):
            continue
        base = fichier[:-5]

        if base in SANS_AIDE:
            ignorees.append(f"{fichier} (pas de session)")
            continue

        contenu = open(fichier, encoding='utf-8').read()

        if 'didacticiel.js' in contenu:
            deja.append(fichier)
            continue
        if '</body>' not in contenu:
            ignorees.append(f"{fichier} (pas de balise </body>)")
            continue

        nom = ECRANS.get(base, base.replace('-', ' ').capitalize())
        balise = f'{COMMENTAIRE}\n<script src="didacticiel.js" data-ecran="{nom}"></script>\n'

        if not simulation:
            open(fichier, 'w', encoding='utf-8').write(
                contenu.replace('</body>', balise + '</body>')
            )
        modifiees.append(f"{fichier}  →  « {nom} »")

    verbe = "seraient équipées" if simulation else "équipées"
    print(f"\n{len(modifiees)} page(s) {verbe} :")
    for m in modifiees:
        print(f"  {m}")

    if deja:
        print(f"\n{len(deja)} page(s) déjà équipée(s), laissée(s) telle(s) quelle(s) :")
        print('  ' + ', '.join(deja))

    if ignorees:
        print(f"\n{len(ignorees)} page(s) volontairement ignorée(s) :")
        for i in ignorees:
            print(f"  {i}")

    if simulation:
        print("\n(simulation : aucun fichier n'a été modifié)")

    return 0


if __name__ == '__main__':
    sys.exit(main())
