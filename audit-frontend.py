#!/usr/bin/env python3
"""
Audit statique des pages HTML de la plateforme.

Ce script existe parce que les bugs les plus coûteux rencontrés sur ce projet
n'étaient PAS des erreurs de syntaxe — `node --check` les déclarait toutes
valides. C'étaient des références fantômes : un identifiant qui n'existe pas,
une fonction jamais définie, un appel qui ne lève aucune exception visible et
laisse simplement une partie de l'écran inerte.

Exemples réellement rencontrés :
  * `echapper()` appelée dans generateur-modeles.html sans y être définie
  * `fermerModale('voile-classe')` alors que l'identifiant est
    'voile-modale-classe' — la modale serait restée ouverte, sans erreur
  * une page entière tombant en 500 à cause d'un import manquant

Lancer : python3 scripts/audit-frontend.py
Sortie  : liste des problèmes, code de retour 1 s'il y en a.
"""

import glob

import audit_commun as commun
import os
import re
import sys
from collections import Counter

# Méthodes natives et globales du navigateur : appelées partout, jamais
# définies dans le code du projet. Les signaler produirait un bruit tel que
# les vrais problèmes deviendraient invisibles.
NATIF = {
    'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof',
    'Array', 'Object', 'Number', 'String', 'Boolean', 'Math', 'JSON', 'Map', 'Set',
    'Promise', 'Date', 'URL', 'URLSearchParams', 'FormData', 'Intl', 'RegExp', 'Error',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
    'decodeURIComponent', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'console', 'document', 'window', 'fetch', 'confirm', 'alert', 'prompt',
    'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'FileReader',
    'Blob', 'Image', 'Event', 'CustomEvent', 'AbortController', 'Intersection',
    'requestAnimationFrame', 'structuredClone', 'queueMicrotask', 'atob', 'btoa',
}

# Fonctions fournies par les scripts partagés (ui.js, auth.js...) plutôt que
# par la page elle-même : leur absence locale est normale.
PARTAGEES = {
    'appelApi', 'obtenirTokens', 'stockerTokens', 'effacerTokens',
    'obtenirDuStockage', 'ecrireDansStockage', 'supprimerDuStockage',
    'ArdoiseUI', 'ArdoiseRail', 'initialiserRail', 'appliquerTheme',
    'deconnexion', 'afficherMessage', 'echapper',
}

# Balises sans fermeture : les compter comme ouvertes fausserait l'équilibrage.
AUTOFERMANTES = {
    'br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'use', 'path', 'circle',
    'rect', 'line', 'polygon', 'area', 'col', 'embed', 'param', 'track', 'wbr',
    'ellipse', 'stop', 'polyline',
}


def extraire_js(html):
    """Concatène tous les <script> inline (sans src) d'une page."""
    return '\n'.join(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S))


def identifiants_references(js, html):
    """
    Tous les identifiants d'éléments que le code cherche à atteindre.

    Couvre trois formes, pas seulement getElementById : c'est en ne regardant
    que celle-ci qu'un fermerModale('voile-classe') erroné est passé au travers.
    """
    refs = set(re.findall(r"getElementById\('([^']+)'\)", js))
    refs |= set(re.findall(r'getElementById\("([^"]+)"\)', js))
    refs |= set(re.findall(r"querySelector\(\s*'#([\w-]+)'", js))
    refs |= set(re.findall(r'querySelector\(\s*"#([\w-]+)"', js))
    # Helpers du projet qui prennent un identifiant de voile/modale en argument.
    refs |= set(re.findall(r"fermerModale\('([^']+)'\)", js + html))
    refs |= set(re.findall(r"ouvrirModale\('([^']+)'\)", js + html))
    return refs


def identifiants_definis(html, js):
    """Identifiants réellement présents, y compris ceux créés dynamiquement."""
    ids = set(re.findall(r'(?<!data-)\bid="([^"]+)"', html))
    ids |= set(re.findall(r"\.id\s*=\s*'([^']+)'", js))
    ids |= set(re.findall(r'\.id\s*=\s*"([^"]+)"', js))
    # Les identifiants construits par interpolation (`ligne-${x}`) ne sont pas
    # vérifiables statiquement : on les ignore des deux côtés.
    return {i for i in ids if '${' not in i}


def auditer(fichier):
    html = open(fichier, encoding='utf-8').read()
    js = extraire_js(html)
    problemes = []

    # ---- 1. Identifiants référencés mais inexistants ----
    refs = {r for r in identifiants_references(js, html) if '${' not in r}
    definis = identifiants_definis(html, js)
    for manquant in sorted(refs - definis):
        problemes.append(f"identifiant introuvable : '{manquant}'")

    # ---- 2. Identifiants dupliqués ----
    # Uniquement dans le HTML STATIQUE : un identifiant présent à la fois dans
    # le balisage initial et dans un template JS n'est pas un doublon, le second
    # remplaçant le premier via innerHTML — les deux ne coexistent jamais dans
    # le DOM.
    html_statique = re.sub(r'<script.*?</script>', '', html, flags=re.S)
    ids_html = [i for i in re.findall(r'(?<!data-)\bid="([^"]+)"', html_statique) if '${' not in i]
    for identifiant, nombre in Counter(ids_html).items():
        if nombre > 1:
            problemes.append(f"identifiant dupliqué {nombre}x : '{identifiant}'")

    # ---- 3. Fonctions du projet appelées mais jamais définies ----
    # Le (?<![.\w]) exclut les appels de MÉTHODE (ArdoiseUI.ouvrirTousLesMenus())
    # dont la définition vit sur l'objet, pas dans la page. Sans lui, l'audit
    # signalait des fonctions parfaitement définies dans ui.js — et un audit qui
    # crie au loup finit ignoré, ce qui est pire que pas d'audit du tout.
    appelees = set(re.findall(r'(?<![.\w])([a-zA-Z_][\w]*)\s*\(', js))
    definies = set(re.findall(r'function\s+([a-zA-Z_][\w]*)', js))
    definies |= set(re.findall(r'(?:const|let|var)\s+([a-zA-Z_][\w]*)\s*=\s*(?:async\s*)?(?:\(|function)', js))
    # On ne signale que les noms au style du projet (verbe français en camelCase) :
    # tout le reste est du natif ou une méthode d'objet, et noierait le signal.
    motif_projet = re.compile(
        r'^(charger|afficher|construire|calculer|formater|verifier|obtenir|dessiner|'
        r'ouvrir|fermer|remplir|activer|ecrire|generer|valider|creer|modifier|'
        r'supprimer|envoyer|basculer|initialiser|rafraichir|adapter|appliquer)[A-Z]'
    )
    for nom in sorted(appelees - definies - NATIF - PARTAGEES):
        if motif_projet.match(nom):
            problemes.append(f"fonction jamais définie : {nom}()")

    # ---- 4. Balises non fermées ----
    sans_script = re.sub(r'<script.*?</script>|<style.*?</style>|<!--.*?-->', '', html, flags=re.S)
    pile = []
    for m in re.finditer(r'<(/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(/?)>', sans_script):
        fermante, nom, _, auto = m.group(1), m.group(2).lower(), m.group(3), m.group(4)
        if nom in AUTOFERMANTES or auto == '/':
            continue
        if not fermante:
            pile.append(nom)
        elif pile and pile[-1] == nom:
            pile.pop()
    if pile:
        problemes.append(f"balises non fermées : {pile[:5]}")

    return problemes


def auditer_frontend(racine):
    rapport = commun.Rapport('frontend', depot='Scolaire-HTML-main', chemin_depot=racine)

    pages = sorted(glob.glob(os.path.join(racine, '*.html')))
    if not pages:
        rapport.echec_technique(
            f"Aucune page HTML dans {racine}.\n"
            f"  L'audit n'a rien examiné. Vérifiez le chemin : les pages sont\n"
            f"  attendues à la RACINE du dépôt Scolaire-HTML-main.")
        return rapport

    for page in pages:
        rapport.fichier_examine()
        for probleme in auditer(page):
            rapport.constat(os.path.basename(page), 'incoherence_page', probleme,
                            gravite='importante')
    return rapport


def main():
    """LE CHEMIN DE TRAVAIL ÉTAIT FAUX, ET LE REPLI LE MASQUAIT.

    La version précédente calculait :

        racine = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    Deux `dirname` depuis un fichier situé À LA RACINE du dépôt : on remontait
    donc AU-DESSUS du dépôt, là où il n'y a aucune page. Le script ne s'en
    apercevait pas grâce à son repli `glob.glob('*.html')`, qui retombait sur
    le dossier courant — et ne fonctionnait donc que si on le lançait depuis
    le bon endroit, par coïncidence.

    Deux conséquences : la documentation demandait `scripts/audit-frontend.py`
    alors que le fichier est à la racine, et lancé depuis ailleurs le script
    annonçait « 0 pages auditées : aucun problème détecté ».

    Le chemin est désormais explicite, et zéro page est un échec technique.
    """
    p = commun.analyseur(__doc__, besoin_frontend=True)
    args = p.parse_args()
    racine = commun.trouver_depot('frontend', args.frontend, 'ARDOISE_FRONTEND')
    return commun.executer(lambda: auditer_frontend(racine), args)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except commun.EchecTechnique as e:
        print("ÉCHEC TECHNIQUE — l'audit n'a pas pu s'exécuter.\n")
        for ligne in str(e).split('\n'):
            print('  ' + ligne)
        sys.exit(2)
