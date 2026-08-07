#!/usr/bin/env python3
"""
VÉRIFICATEUR DU CONTRAT FRONTEND ↔ BACKEND — Ardoise
===========================================================================

POURQUOI CE SCRIPT EXISTE
-------------------------
`audit-frontend.py` vérifie que la page est cohérente AVEC ELLE-MÊME :
identifiants, fonctions, balises. Il déclare les 41 pages saines. Il l'a fait
alors qu'un écran entier — l'encaissement d'abonnement en espèces — était
inutilisable en production, parce que le backend ne renvoyait pas le champ que
la page attendait.

C'est son angle mort : il ne franchit jamais la frontière. Trois contrôles
manquaient, tous portant sur ce qui se passe ENTRE les deux moitiés :

  1. Chaque `appelApi('/chemin')` correspond-il à une route réellement montée
     dans `server.js` ? Une route renommée côté backend laisse la page muette,
     sans erreur JavaScript : le 404 est avalé par `appelApi`.

  2. Chaque gestionnaire écrit dans le BALISAGE (`onclick="machin()"`)
     correspond-il à une fonction définie ? `audit-frontend.py` ne lit que les
     appels situés dans les `<script>`. Un bouton dont le seul appelant est son
     attribut `onclick` n'est jamais contrôlé — et c'est exactement la forme
     que prend « le bouton ne fait rien ».

  3. Reste-t-il des `confirm()` / `prompt()` / `alert()` natifs ? Le projet
     dispose de ses propres modales ; les natives bloquent le fil, ignorent le
     thème sombre, et sont bloquées par certains navigateurs mobiles.

Lancer : python3 audit-contrat-api.py
Sortie : liste des anomalies, code 1 s'il y en a.

CE QU'IL NE FAIT PAS
--------------------
Il ne teste rien à l'exécution. Un chemin peut exister et répondre 500. Une
fonction peut être définie et ne rien faire. Ce script dit seulement que les
deux moitiés se parlent avec le même vocabulaire.
"""

import glob
import os
import re
import sys

RACINE_FRONT = os.path.dirname(os.path.abspath(__file__))
RACINE_BACK = os.path.join(os.path.dirname(RACINE_FRONT), 'scolaire-saas-backend-main')

# Fonctions fournies par les scripts partagés, jamais définies dans une page.
PARTAGEES = {
    'appelApi', 'obtenirTokens', 'stockerTokens', 'effacerTokens',
    'obtenirDuStockage', 'ecrireDansStockage', 'supprimerDuStockage',
    'ArdoiseUI', 'ArdoiseRail', 'initialiserRail', 'appliquerTheme',
    'deconnexion', 'afficherMessage', 'echapper', 'ouvrirModale', 'fermerModale',
    'ArdoiseEdition', 'ArdoiseDidacticiel', 'ArdoiseFiltreCycle', 'ArdoiseAccesPresences',
}

NATIF = {
    'return', 'if', 'this', 'event', 'window', 'document', 'console', 'alert',
    'confirm', 'prompt', 'setTimeout', 'JSON', 'Number', 'String', 'Boolean',
    'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent',
}


# --------------------------------------------------------------------------
# 1. Routes réellement exposées par le backend
# --------------------------------------------------------------------------

def prefixes_montes():
    """Lit server.js : quel fichier de routes est monté sous quel préfixe."""
    chemin = os.path.join(RACINE_BACK, 'server.js')
    source = open(chemin, encoding='utf-8').read()
    # Retire les commentaires de ligne : `// app.use('/vieux', ...)` ne compte pas.
    source = re.sub(r'^\s*//.*$', '', source, flags=re.M)

    montages = []
    # app.use('/frais', fraisRoutes)  ou  app.use('/ia', require('./routes/x'))
    for m in re.finditer(r"app\.use\(\s*'([^']*)'\s*,\s*([^)]+)\)", source):
        prefixe, cible = m.group(1), m.group(2)
        fichier = re.search(r"require\(\s*'\./routes/([^']+)'", cible)
        if fichier:
            montages.append((prefixe, fichier.group(1)))
            continue
        # Variable : retrouver son require plus haut dans le fichier.
        nom = cible.strip()
        decl = re.search(
            r"(?:const|let|var)\s+%s\s*=\s*require\(\s*'\./routes/([^']+)'" % re.escape(nom),
            source)
        if decl:
            montages.append((prefixe, decl.group(1)))
    return montages


def chemins_backend():
    """
    Ensemble des motifs de chemin exposés, préfixe compris.

    Chaque `router.get('/x/:id')` monté sous `/frais` devient `/frais/x/:id`,
    puis est transformé en expression régulière où `:id` accepte n'importe quel
    segment — c'est ainsi que le frontend l'appelle, avec un UUID interpolé.
    """
    motifs = []
    for prefixe, fichier in prefixes_montes():
        chemin = os.path.join(RACINE_BACK, 'routes', fichier)
        if not chemin.endswith('.js'):
            chemin += '.js'
        if not os.path.exists(chemin):
            continue
        source = open(chemin, encoding='utf-8').read()
        source = re.sub(r'^\s*//.*$', '', source, flags=re.M)
        for m in re.finditer(
                r"router\.(get|post|put|patch|delete)\(\s*'([^']*)'", source):
            methode, route = m.group(1).upper(), m.group(2)
            complet = (prefixe.rstrip('/') + route).rstrip('/') or '/'
            motifs.append((methode, complet))
    return motifs


def en_regex(motif):
    """`/frais/paiements/:id` → expression acceptant un segment quelconque."""
    # `re.escape` n'échappe plus les deux-points depuis Python 3.7 : chercher
    # « \: » ne trouve donc rien, et TOUTES les routes paramétrées passaient
    # pour introuvables. On accepte les deux formes plutôt que de parier sur la
    # version de Python installée.
    echappe = re.escape(motif)
    echappe = re.sub(r'\\?:[A-Za-z_][\w]*', r'[^/]+', echappe)
    return re.compile('^' + echappe + '$')


# --------------------------------------------------------------------------
# 2. Appels API du frontend
# --------------------------------------------------------------------------

def appels_frontend(source):
    """
    Chemins passés à `appelApi`, avec les interpolations neutralisées.

    `${x}` devient un segment générique : on vérifie la FORME du chemin, pas
    la valeur — c'est tout ce qu'une analyse statique peut affirmer.
    """
    trouves = []
    for m in re.finditer(r"appelApi\(\s*([`'\"])([^`'\"]*)\1", source):
        brut = m.group(2)
        chemin = brut.split('?')[0]
        chemin = re.sub(r'\$\{[^}]*\}', 'X', chemin)
        if not chemin.startswith('/'):
            continue
        # Méthode : cherchée dans les ~200 caractères qui suivent l'appel.
        suite = source[m.end():m.end() + 220]
        meth = re.search(r"method\s*:\s*'(\w+)'", suite)
        trouves.append((meth.group(1).upper() if meth else 'GET', chemin.rstrip('/') or '/', brut))
    return trouves


# --------------------------------------------------------------------------
# 3. Contrôles
# --------------------------------------------------------------------------

def main():
    motifs = chemins_backend()
    regex_par_methode = {}
    for methode, motif in motifs:
        regex_par_methode.setdefault(methode, []).append((en_regex(motif), motif))

    anomalies = []
    pages = sorted(glob.glob(os.path.join(RACINE_FRONT, '*.html'))
                   + glob.glob(os.path.join(RACINE_FRONT, '*.js')))

    for page in pages:
        nom = os.path.basename(page)
        source = open(page, encoding='utf-8').read()
        locales = []

        # ---- 1. Appels API sans route correspondante ----
        for methode, chemin, brut in appels_frontend(source):
            candidats = regex_par_methode.get(methode, [])
            if any(rx.match(chemin.replace('X', 'aaa')) for rx, _ in candidats):
                continue
            # La méthode peut être mal devinée ; on retente toutes méthodes.
            toutes = [c for liste in regex_par_methode.values() for c in liste]
            if any(rx.match(chemin.replace('X', 'aaa')) for rx, _ in toutes):
                continue
            locales.append(f"appel API sans route : {methode} {brut}")

        # ---- 2. Gestionnaires du balisage sans fonction définie ----
        js = '\n'.join(re.findall(
            r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', source, re.S)) or source
        definies = set(re.findall(r'function\s+([a-zA-Z_][\w]*)', js))
        definies |= set(re.findall(
            r'(?:const|let|var)\s+([a-zA-Z_][\w]*)\s*=\s*(?:async\s*)?(?:\(|function)', js))
        definies |= set(re.findall(r'window\.([a-zA-Z_][\w]*)\s*=', js))

        for m in re.finditer(
                r'\bon(?:click|change|input|submit|keyup|keydown|blur|focus)\s*=\s*"([^"]*)"',
                source):
            for appel in re.finditer(r'(?<![.\w$])([a-zA-Z_][\w]*)\s*\(', m.group(1)):
                fonction = appel.group(1)
                if fonction in definies or fonction in PARTAGEES or fonction in NATIF:
                    continue
                locales.append(f"gestionnaire sans fonction : on…=\"{fonction}(…)\"")

        # ---- 3. Boîtes de dialogue natives ----
        #
        # Les COMMENTAIRES sont retirés d'abord. Sans cela, `ui.js` se signale
        # cinq fois — dans le commentaire qui documente précisément comment
        # remplacer `confirm()` par `ArdoiseUI.confirmer()`. Un audit qui
        # dénonce sa propre documentation finit par être ignoré, et c'est pire
        # que pas d'audit du tout.
        #
        # Les positions sont préservées : on remplace chaque commentaire par
        # des espaces de même longueur, pour que les numéros de ligne restent
        # justes et qu'on puisse aller voir sur place.
        def blanchir(texte):
            def espaces(m):
                return re.sub(r'[^\n]', ' ', m.group(0))
            texte = re.sub(r'<!--.*?-->', espaces, texte, flags=re.S)
            texte = re.sub(r'/\*.*?\*/', espaces, texte, flags=re.S)
            texte = re.sub(r'(?<!:)//[^\n]*', espaces, texte)
            return texte

        propre = blanchir(source)
        for m in re.finditer(r'(?<![.\w])(confirm|prompt|alert)\s*\(', propre):
            ligne = propre[:m.start()].count('\n') + 1
            locales.append(f"boîte native {m.group(1)}() ligne {ligne}")

        if locales:
            anomalies.append((nom, sorted(set(locales))))

    if not anomalies:
        print(f"{len(pages)} fichiers : contrat frontend/backend cohérent.")
        return 0

    total = 0
    for nom, liste in anomalies:
        print(f"\n{nom}")
        for a in liste:
            total += 1
            print(f"   - {a}")
    print(f"\n{len(pages)} fichiers analysés, {total} anomalie(s).")
    print(f"({len(motifs)} routes backend recensées)")
    return 1


if __name__ == '__main__':
    sys.exit(main())
