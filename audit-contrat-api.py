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

  4. La copie de secours des types d'événements (`evenements-types.js`) dit-elle
     la même chose que le catalogue serveur (`utils/evenements-catalogue.js`) ?
     Elle sert le menu déroulant tant que `GET /evenements/types` n'a pas
     répondu — c'est-à-dire hors ligne, et à chaque réveil de serveur. Un type
     qui n'y figure pas est proposé au secrétariat par intermittence ; un
     libellé qui a dérivé nomme deux choses différentes selon la latence.

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

import audit_commun as commun

# Renseignés par `main()` à partir de --backend / --frontend / des variables
# d'environnement / de la détection. JAMAIS calculés au chargement du module :
# la version précédente posait
#
#     RACINE_BACK = os.path.join(os.path.dirname(RACINE_FRONT),
#                                'scolaire-saas-backend-main')
#
# c'est-à-dire « le backend est forcément le dossier frère, et il porte
# forcément ce nom-là ». Dès que les deux dépôts étaient clonés séparément —
# ce qui est le cas dans l'intégration continue, où chacun arrive dans son
# propre espace de travail — le script s'arrêtait sur un `FileNotFoundError`
# brut désignant `server.js`, sans dire lequel ni pourquoi.
RACINE_FRONT = None
RACINE_BACK = None

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
    if not os.path.exists(chemin):
        raise commun.EchecTechnique(
            f"server.js est introuvable dans le dépôt backend :\n"
            f"    {chemin}\n"
            f"  Sans lui, aucune route n'est connue et TOUS les appels du frontend\n"
            f"  seraient signalés comme sans route — un rapport catastrophiste et faux.")
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
    for m in re.finditer(r"appelApi\(\s*([`\'\"])([^`\'\"]*)\1", source):
        brut = m.group(2)
        chemin = brut.split('?')[0]
        chemin = re.sub(r'\$\{[^}]*\}', 'X', chemin)
        if not chemin.startswith('/'):
            continue

        """MÉTHODE HTTP — POURQUOI LA FENÊTRE NE SUFFIT PAS

        La version précédente cherchait `method: 'X'` dans les 220 caractères
        SUIVANT l'appel. Elle rate la forme la plus répandue du dépôt :

            options = { method: 'POST', body: formulaire };   // ← 10 lignes plus haut
            ...
            const r = await appelApi('/discipline/reglement/importer', options);

        Ici la méthode est DÉCLARÉE AVANT, dans une variable passée en second
        argument. La fenêtre ne voit rien, le script suppose GET, et signale
        une méthode incorrecte sur un appel parfaitement correct.

        Un audit qui produit de faux positifs est plus nuisible qu'un audit
        absent : on apprend à ignorer ses sorties, et le jour où il a raison
        personne ne lit. On regarde donc aussi EN AMONT, et on remonte à la
        variable quand le second argument en est une.
        """
        suite = source[m.end():m.end() + 220]
        methode = None

        meth = re.search(r"method\s*:\s*['\"](\w+)['\"]", suite)
        if meth:
            methode = meth.group(1)
        else:
            # Second argument : `appelApi('/x', options)` → nom de la variable.
            arg = re.match(r"\s*,\s*([A-Za-z_$][\w$]*)\s*\)", suite)
            if arg:
                # Dernière affectation de cette variable AVANT l'appel.
                amont = source[:m.start()]
                affectations = re.findall(
                    r"%s\s*=\s*\{[^{}]*method\s*:\s*['\"](\w+)['\"]" % re.escape(arg.group(1)),
                    amont)
                if affectations:
                    methode = affectations[-1]

        trouves.append((
            (methode or 'GET').upper(),
            chemin.rstrip('/') or '/',
            brut,
            # Vrai si le chemin se termine par une interpolation COLLÉE au
            # dernier segment (`/eleves/export${params}`). Dans ce cas, la
            # partie interpolée est presque toujours une chaîne de requête
            # (`?classeId=…`), pas un segment de plus — et `/eleves/export`
            # est le chemin réellement appelé. Sans cette distinction,
            # `/eleves/exportX` allait se faire capturer par `DELETE /eleves/:id`
            # et le script annonçait une méthode incorrecte inexistante.
            bool(re.search(r'[^/]\$\{[^}]*\}$', brut))))
    return trouves


# --------------------------------------------------------------------------
# 3. Contrôles
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# 4. Catalogue des types d'événements : le repli du navigateur contre la
#    référence du serveur
# --------------------------------------------------------------------------

def _types_backend():
    """{ clé: libellé } lus dans `utils/evenements-catalogue.js`."""
    chemin = os.path.join(RACINE_BACK, 'utils', 'evenements-catalogue.js')
    if not os.path.exists(chemin):
        return None
    source = open(chemin, encoding='utf-8').read()
    bloc = re.search(r'const TYPES_EVENEMENTS = \{(.*?)\n\};', source, re.S)
    if not bloc:
        return None
    trouves = {}
    # Une entrée : la clé en tête de ligne, puis `libelle` sur la ligne suivante.
    # Le libellé ne franchit ni sa propre quote ni la fin de ligne : sans cette
    # borne, la capture paresseuse enjambait l'entrée suivante et lui volait sa
    # clé — le contrôle déclarait alors manquants des types parfaitement
    # présents des deux côtés.
    for m in re.finditer(
            r"""^  ([a-z][a-z0-9_]*): \{\s*\n\s*libelle: (['"])((?:(?!\2)[^\\\n]|\\.)*)\2,""",
            bloc.group(1), re.M):
        trouves[m.group(1)] = m.group(3).replace("\\'", "'")
    return trouves


def _types_frontend():
    """{ clé: libellé } lus dans le repli de `evenements-types.js`."""
    chemin = os.path.join(RACINE_FRONT, 'evenements-types.js')
    if not os.path.exists(chemin):
        return None
    source = open(chemin, encoding='utf-8').read()
    bloc = re.search(r'const CATALOGUE_DE_SECOURS = \[(.*?)\n  \];', source, re.S)
    if not bloc:
        return None
    trouves = {}
    for m in re.finditer(
            r"""\{\s*cle: '([a-z][a-z0-9_]*)',\s*libelle: (['"])((?:(?!\2)[^\\\n]|\\.)*)\2\s*\}""",
            bloc.group(1)):
        trouves[m.group(1)] = m.group(3).replace("\\'", "'")
    return trouves


def verifier_catalogue_evenements(rapport):
    """Signale toute dérive entre les deux listes de types d'événements."""
    nom = 'evenements-types.js'
    backend = _types_backend()
    frontend = _types_frontend()

    # Aucun des deux fichiers n'est indispensable au reste de l'audit : s'ils
    # sont absents ou remaniés au point d'être illisibles, on le DIT plutôt que
    # de laisser croire au silence d'un contrôle qui n'a pas tourné.
    if backend is None or frontend is None:
        rapport.constat(
            nom, 'catalogue_evenements_illisible',
            "catalogue des types d'événements non comparé : "
            + ("`utils/evenements-catalogue.js` " if backend is None else '')
            + ("`evenements-types.js` " if frontend is None else '')
            + "introuvable ou de forme inattendue",
            gravite='moyenne')
        return

    for cle in sorted(set(backend) - set(frontend)):
        rapport.constat(
            nom, 'type_evenement_absent_du_repli',
            f"type « {cle} » servi par le backend mais absent de la copie de "
            f"secours : il manquera au menu tant que le serveur n'aura pas répondu",
            gravite='moyenne')

    for cle in sorted(set(frontend) - set(backend)):
        rapport.constat(
            nom, 'type_evenement_inconnu_du_backend',
            f"type « {cle} » proposé par la copie de secours mais inconnu du "
            f"backend : l'enregistrement sera refusé (400)",
            gravite='importante')

    for cle in sorted(set(frontend) & set(backend)):
        if frontend[cle] != backend[cle]:
            rapport.constat(
                nom, 'libelle_type_evenement_divergent',
                f"type « {cle} » : « {frontend[cle]} » côté page, "
                f"« {backend[cle]} » côté serveur",
                gravite='moyenne')


def auditer_contrat():
    motifs = chemins_backend()
    rapport = commun.Rapport('contrat_api', depot='Scolaire-HTML-main',
                             chemin_depot=RACINE_FRONT)
    regex_par_methode = {}
    for methode, motif in motifs:
        regex_par_methode.setdefault(methode, []).append((en_regex(motif), motif))

    pages = sorted(glob.glob(os.path.join(RACINE_FRONT, '*.html'))
                   + glob.glob(os.path.join(RACINE_FRONT, '*.js')))

    # Les extraits de documentation portent l'extension `.js` sans être du
    # code monté : les analyser produirait des anomalies sur des lignes qui ne
    # s'exécutent nulle part.
    pages = [p for p in pages if '.EXTRAIT.' not in os.path.basename(p)]

    for page in pages:
        nom = os.path.basename(page)
        rapport.fichier_examine()
        source = open(page, encoding='utf-8').read()
        locales = []

        # ---- 1. Appels API sans route correspondante ----
        #
        # LE REPLI « TOUTES MÉTHODES » A ÉTÉ SUPPRIMÉ, ET C'ÉTAIT LE PLUS
        # DANGEREUX DES TROIS DÉFAUTS DE CE SCRIPT.
        #
        # L'ancienne version, ne trouvant pas `POST /eleves/import`, réessayait
        # sur TOUTES les méthodes ; elle tombait sur `GET /eleves/import`,
        # concluait que le contrat était honoré et se taisait. Or une route GET
        # ne satisfait pas un appel POST : le serveur répond 404, la page reste
        # muette, et l'audit vient d'affirmer que tout va bien.
        #
        # Un chemin qui existe avec une AUTRE méthode est désormais signalé
        # comme tel — avec sa propre gravité, parce que le diagnostic n'est pas
        # le même. « La route n'existe pas » se corrige côté backend ; « la
        # route existe en GET » se corrige presque toujours côté frontend, et
        # savoir lequel des deux fait gagner l'essentiel du temps.
        for methode, chemin, brut, suffixe_colle in appels_frontend(source):
            # Deux formes à essayer quand l'interpolation est collée : avec, et
            # sans — c'est-à-dire en la traitant comme une chaîne de requête.
            cibles = [chemin.replace('X', 'aaa')]
            if suffixe_colle:
                cibles.append(re.sub(r'X$', '', chemin).rstrip('/') or '/')

            def existe(meth):
                return any(rx.match(c) for c in cibles
                           for rx, _ in regex_par_methode.get(meth, []))

            if existe(methode):
                continue

            autres = sorted(m for m in regex_par_methode if m != methode and existe(m))
            if autres:
                locales.append(
                    (f"méthode HTTP incorrecte : le frontend appelle {methode} {brut}, "
                     f"le backend n'expose ce chemin qu'en {', '.join(autres)}",
                     'importante', 'methode_http_incorrecte'))
            else:
                locales.append((f"appel API sans route : {methode} {brut}",
                                'critique', 'appel_api_sans_route'))

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
                locales.append((f"gestionnaire sans fonction : on…=\"{fonction}(…)\"",
                                'importante', 'gestionnaire_sans_fonction'))

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
            locales.append((f"boîte native {m.group(1)}()", 'moyenne',
                            'boite_native', ligne))

        for constat in sorted(set(locales)):
            message, gravite, code = constat[0], constat[1], constat[2]
            ligne = constat[3] if len(constat) > 3 else None
            rapport.constat(nom, code, message, gravite=gravite, ligne=ligne)

    verifier_catalogue_evenements(rapport)

    rapport.message = f"{len(motifs)} routes backend recensées."
    return rapport


def main():
    global RACINE_FRONT, RACINE_BACK

    args = commun.analyseur(
        __doc__, besoin_frontend=True, besoin_backend=True).parse_args()

    RACINE_FRONT = commun.trouver_depot('frontend', args.frontend, 'ARDOISE_FRONTEND')
    RACINE_BACK = commun.trouver_depot('backend', args.backend, 'ARDOISE_BACKEND')

    return commun.executer(lambda: auditer_contrat(), args)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except commun.EchecTechnique as e:
        # Attrapé ICI aussi : la résolution des chemins a lieu AVANT
        # `commun.executer`, qui ne peut donc pas la couvrir. Sans ce bloc, une
        # variable d'environnement mal renseignée redonnerait la trace d'appels
        # illisible que ce correctif avait justement pour objet de supprimer.
        print("ÉCHEC TECHNIQUE — l'audit n'a pas pu s'exécuter.\n")
        for ligne in str(e).split('\n'):
            print('  ' + ligne)
        sys.exit(2)
