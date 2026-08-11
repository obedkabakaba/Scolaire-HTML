#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Contrôle statique des requêtes SQL du serveur.

Pourquoi cet outil : aucune base PostgreSQL n'est joignable depuis cet
environnement, donc `node --check` valide le JavaScript mais ne regarde jamais
à l'intérieur des chaînes SQL. Une virgule manquante entre deux CTE passe donc
tous les contrôles et n'échoue qu'en production, en 500.

Trois familles d'erreurs sont cherchées :
  1. parenthèses déséquilibrées ;
  2. deux CTE consécutives sans virgule entre elles (`) nom AS (`) ;
  3. un paramètre $N utilisé au-delà du nombre d'arguments passés.

Le troisième contrôle est indicatif : le tableau d'arguments n'est pas toujours
littéral. Il n'est signalé que lorsqu'il est lisible sans ambiguïté.
"""
import re, sys, glob, os

import audit_commun as commun

# LE CHEMIN EN DUR A ÉTÉ SUPPRIMÉ.
#
# Ce fichier portait :
#
#     RACINE = '/home/claude/work/back/scolaire-saas-backend-main'
#
# c'est-à-dire l'arborescence de la machine sur laquelle il a été écrit. Chez
# quiconque d'autre, `glob.glob` sur un dossier inexistant ne LÈVE PAS : il
# renvoie une liste vide. Le script parcourait donc zéro fichier, examinait
# zéro requête, et imprimait fièrement « 0 requêtes examinées, 0 en défaut. »
# avec un code de sortie 0.
#
# C'est la forme la plus coûteuse de faux succès : elle est indiscernable d'un
# audit réussi, et elle se produit sur TOUTES les machines sauf une.
RACINE = None


def extraire_requetes(source):
    """Renvoie (ligne_de_depart, texte_sql, arguments_bruts) pour chaque `...`."""
    requetes = []
    i = 0
    while i < len(source):
        if source[i] == '`':
            debut = i + 1
            j = debut
            while j < len(source):
                if source[j] == '\\':
                    j += 2
                    continue
                if source[j] == '`':
                    break
                j += 1
            texte = source[debut:j]
            # Les sources d'expressions régulières contiennent les mêmes mots
            # que du SQL sans en être : les écarter évite une alerte permanente
            # qui apprendrait à ignorer l'outil.
            est_regex = '\\\\s' in texte or '\\\\b' in texte
            if not est_regex and re.search(r'\b(SELECT|INSERT|UPDATE|DELETE|WITH)\b', texte, re.I):
                # arguments : ce qui suit le backtick fermant jusqu'à la parenthèse
                suite = source[j + 1:j + 400]
                requetes.append((source.count('\n', 0, debut) + 1, texte, suite))
            i = j + 1
        else:
            i += 1
    return requetes


def sans_bruit(sql):
    """Retire commentaires et littéraux, qui fausseraient le comptage."""
    sql = re.sub(r'--[^\n]*', ' ', sql)
    sql = re.sub(r"'(?:[^']|'')*'", "''", sql)
    # `${CURRENT_ECOLE}` et consorts : interpolations JS, neutralisées
    sql = re.sub(r'\$\{[^}]*\}', ' X ', sql)
    return sql


def controler(sql):
    anomalies = []
    net = sans_bruit(sql)

    if net.count('(') != net.count(')'):
        anomalies.append(f"parenthèses déséquilibrées ({net.count('(')} ouvrantes, {net.count(')')} fermantes)")

    # Virgule manquante entre deux CTE : une parenthèse fermante suivie d'un
    # identifiant puis de « AS ( » sans virgule.
    for m in re.finditer(r'\)\s*([A-Za-z_][A-Za-z_0-9]*)\s+AS\s*\(', net, re.I):
        mot = m.group(1).upper()
        if mot not in ('SELECT', 'WHERE', 'FROM', 'ON', 'AND', 'OR'):
            anomalies.append(f"virgule manquante avant la CTE « {m.group(1)} »")

    return anomalies


def controler_parametres(sql, suite):
    indices = [int(x) for x in re.findall(r'\$(\d+)', sql)]
    if not indices:
        return []
    maxi = max(indices)
    # Lecture du tableau d'arguments en suivant la profondeur des crochets :
    # une expression comme `req.headers['user-agent']` contient un « ] » qui
    # n'est PAS la fin du tableau, et une lecture naïve compte un argument de
    # trop en moins — puis accuse une requête parfaitement saine.
    debut = suite.find('[')
    if debut == -1 or suite[:debut].strip() not in (',', ''):
        return []
    profondeur, fin = 0, -1
    dans_texte = None
    for k in range(debut, len(suite)):
        c = suite[k]
        if dans_texte:
            if c == dans_texte and suite[k - 1] != '\\':
                dans_texte = None
            continue
        if c in '\'"`':
            dans_texte = c
            continue
        if c in '[({':
            profondeur += 1
        elif c in '])}':
            profondeur -= 1
            if profondeur == 0:
                fin = k
                break
    if fin == -1:
        return []
    contenu = suite[debut + 1:fin]
    if '...' in contenu or '`' in contenu:
        return []
    profondeur, nb, courant = 0, 0, ''
    for c in contenu:
        if c in '([{':
            profondeur += 1
        elif c in ')]}':
            profondeur -= 1
        if c == ',' and profondeur == 0:
            nb += 1 if courant.strip() else 0
            courant = ''
        else:
            courant += c
    nb += 1 if courant.strip() else 0
    if nb and maxi > nb:
        return [f"$" + str(maxi) + f" utilisé mais {nb} argument(s) fourni(s)"]
    return []


def auditer_sql(cibles):
    rapport = commun.Rapport('sql', depot='scolaire-saas-backend-main', chemin_depot=RACINE)

    total = 0
    for chemin in sorted(cibles):
        try:
            source = open(chemin, encoding='utf-8').read()
        except OSError as e:
            raise commun.EchecTechnique(f"Lecture impossible de {chemin} : {e}")

        for ligne, sql, suite in extraire_requetes(source):
            total += 1
            for a in controler(sql) + controler_parametres(sql, suite):
                rapport.constat(
                    os.path.relpath(chemin, RACINE), 'sql_incorrect', a,
                    gravite='critique', ligne=ligne,
                    contexte={'extrait': ' '.join(sql.split())[:200]})

    """ZÉRO REQUÊTE EXAMINÉE = AUDIT NON EXÉCUTÉ.

    Le compteur de fichiers du rapport est alimenté avec le nombre de REQUÊTES,
    pas de fichiers : c'est la bonne unité ici. Un dépôt dont on aurait lu
    cinquante fichiers sans y trouver une seule requête SQL signale tout autant
    un problème d'outillage — mauvais dossier, mauvaise extension — qu'un
    dossier vide. Dans les deux cas, l'audit n'a rien vérifié.
    """
    rapport.fichier_examine(total)
    if total == 0:
        rapport.echec_technique(
            f"Aucune requête SQL trouvée dans {RACINE}.\n"
            f"  L'audit n'a donc RIEN vérifié — ce n'est pas un dépôt sain,\n"
            f"  c'est un audit qui n'a pas tourné. Vérifiez le chemin fourni :\n"
            f"  les requêtes sont attendues dans controllers/ et utils/.")
    else:
        rapport.message = f"{total} requête(s) SQL examinée(s)."
    return rapport


def main():
    global RACINE

    p = commun.analyseur(__doc__, besoin_backend=True)
    p.add_argument('fichiers', nargs='*',
                   help='Fichiers à examiner (par défaut : controllers/ et utils/ du backend)')
    args = p.parse_args()

    # Compatibilité : le premier argument positionnel peut être le dépôt
    # lui-même, comme le documentait l'ancien mode d'emploi
    # (`python3 audit-sql.py <chemin-backend>`).
    positionnels = list(args.fichiers)
    backend = args.backend
    if not backend and len(positionnels) == 1 and os.path.isdir(positionnels[0]):
        backend, positionnels = positionnels[0], []

    RACINE = commun.trouver_depot('backend', backend, 'ARDOISE_BACKEND')

    cibles = positionnels or (
        glob.glob(os.path.join(RACINE, 'controllers', '*.js'))
        + glob.glob(os.path.join(RACINE, 'utils', '*.js')))

    return commun.executer(lambda: auditer_sql(cibles), args)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except commun.EchecTechnique as e:
        print("ÉCHEC TECHNIQUE — l'audit n'a pas pu s'exécuter.\n")
        for ligne in str(e).split('\n'):
            print('  ' + ligne)
        sys.exit(2)
