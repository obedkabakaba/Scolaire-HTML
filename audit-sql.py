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

RACINE = '/home/claude/work/back/scolaire-saas-backend-main'


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


def main():
    cibles = sys.argv[1:] or (
        glob.glob(os.path.join(RACINE, 'controllers', '*.js'))
        + glob.glob(os.path.join(RACINE, 'utils', '*.js'))
    )
    total, fautives = 0, 0
    for chemin in sorted(cibles):
        source = open(chemin, encoding='utf-8').read()
        for ligne, sql, suite in extraire_requetes(source):
            total += 1
            anomalies = controler(sql) + controler_parametres(sql, suite)
            if anomalies:
                fautives += 1
                print(f"\n{os.path.relpath(chemin, RACINE)}:{ligne}")
                for a in anomalies:
                    print(f"    ✗ {a}")
                print('   ', ' '.join(sql.split())[:110], '…')
    print(f"\n{total} requêtes examinées, {fautives} en défaut.")
    return 1 if fautives else 0


if __name__ == '__main__':
    sys.exit(main())
