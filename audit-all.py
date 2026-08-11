#!/usr/bin/env python3
"""
AUDIT GLOBAL — Ardoise
===========================================================================

UNE COMMANDE, TOUS LES AUDITS, UN CODE DE SORTIE JUSTE.

    python3 audit-all.py --backend /chemin/vers/scolaire-saas-backend-main

CE QU'IL RÉSOUT
---------------
Les six audits s'exécutaient séparément, avec chacun ses arguments, ses
conventions de chemin et sa propre idée du code de sortie. Personne ne les
lançait tous. Et celui qui les lançait tous devait lire six sorties pour
répondre à une seule question : « est-ce que je peux déployer ? »

LA DISTINCTION QUI FAIT TOUT LE TRAVAIL
---------------------------------------
Ce script sépare deux choses que les précédents confondaient :

    ANOMALIE PRODUIT      le dépôt a un défaut       → à corriger
    OUTIL MAL INSTALLÉ    l'audit n'a pas tourné     → à installer

Un audit absent n'est PAS un audit réussi. C'est la règle que l'ancien
outillage violait systématiquement, et c'est celle qui décide du code de
sortie global :

    0   tous les audits ont tourné, aucune anomalie
    1   tous les audits ont tourné, des anomalies produit
    2   au moins un audit n'a pas pu tourner

Un 2 est PLUS grave qu'un 1 : avec un 1, on sait ce qui ne va pas. Avec un 2,
on ne sait pas ce qu'on ignore.
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timezone

import audit_commun as commun

ICI = os.path.dirname(os.path.abspath(__file__))


def definir_audits(frontend, backend, site_genere):
    """
    Les audits à lancer, dans l'ordre du plus rapide au plus lent.

    L'ordre compte pour l'usage quotidien : une erreur d'import ou de contrat
    d'API se corrige en trente secondes et rend inutile d'attendre les deux
    minutes de l'audit mobile.

    `facultatif` marque les audits dont l'absence d'outillage ne condamne pas
    l'ensemble. Un seul l'est — l'audit mobile, qui exige Chromium — et il est
    signalé comme IGNORÉ, jamais comme réussi. La nuance est visible dans le
    rapport et n'affecte pas le code de sortie.
    """
    return [
        {
            'nom': 'imports',
            'titre': 'Imports et handlers du backend',
            'commande': ['node', 'scripts/verifier-imports.js'],
            'dossier': backend,
            'facultatif': False,
        },
        {
            'nom': 'tests_backend',
            'titre': 'Tests unitaires du backend',
            'commande': ['node', '--test',
                         'test/bareme.test.js', 'test/catalogue.test.js',
                         'test/onboarding-offre.test.js', 'test/matrice-offres.test.js',
                         'test/erreurs-remontee.test.js'],
            'dossier': backend,
            'facultatif': False,
            'env': {'ARDOISE_FRONTEND': frontend},
        },
        {
            'nom': 'offres',
            'titre': "Cohérence des fonctionnalités d'offre",
            'commande': ['node', 'middleware/offre-middleware.test.js'],
            'dossier': backend,
            'facultatif': False,
        },
        {
            'nom': 'frontend',
            'titre': 'Cohérence interne des pages',
            'commande': [sys.executable, 'audit-frontend.py', '--frontend', frontend],
            'dossier': ICI,
            'facultatif': False,
        },
        {
            'nom': 'contrat_api',
            'titre': 'Contrat frontend ↔ backend',
            'commande': [sys.executable, 'audit-contrat-api.py',
                         '--frontend', frontend, '--backend', backend],
            'dossier': ICI,
            'facultatif': False,
        },
        {
            'nom': 'sql',
            'titre': 'Requêtes SQL du backend',
            'commande': [sys.executable, 'audit-sql.py', '--backend', backend],
            'dossier': ICI,
            'facultatif': False,
        },
        {
            'nom': 'responsive',
            'titre': 'Responsive (analyse statique)',
            'commande': [sys.executable, 'audit-responsive.py', '--frontend', frontend],
            'dossier': ICI,
            'facultatif': False,
        },
        {
            'nom': 'generateur',
            'titre': 'Site public généré',
            'commande': [sys.executable, 'generateur/audit.py', site_genere],
            'dossier': ICI,
            'facultatif': True,
            'env': {'SORTIE': site_genere, 'SOURCE_HTML': frontend},
            'prealable': (
                "Le site doit être construit d'abord :\n"
                "    SORTIE=<dossier> python3 generateur/build.py"),
        },
        {
            'nom': 'mobile',
            'titre': 'Responsive (mesure dans Chromium)',
            'commande': [sys.executable, 'audit-mobile.py', '--frontend', frontend],
            'dossier': ICI,
            'facultatif': True,
            'prealable': (
                'Exige Playwright :\n'
                '    pip install playwright && python3 -m playwright install chromium'),
        },
    ]


def lancer(audit, timeout=600):
    """
    Exécute un audit et interprète son code de sortie.

    LA TRADUCTION EST LE CŒUR DE CE SCRIPT :

        0  → reussi            l'outil a tourné, rien trouvé
        1  → anomalies         l'outil a tourné, a trouvé
        2  → echec_technique   l'outil n'a pas pu tourner
        *  → echec_technique   code inattendu : on ne devine pas, on alerte

    Le dernier cas est important. Un script qui plante avec un code 3, ou tué
    par un signal, ne doit jamais être compté comme réussi par défaut. Le doute
    profite à l'alerte, pas au déploiement.
    """
    env = dict(os.environ)
    env.update(audit.get('env') or {})

    debut = datetime.now(timezone.utc)
    try:
        r = subprocess.run(audit['commande'], cwd=audit['dossier'], env=env,
                           capture_output=True, text=True, timeout=timeout)
        code, sortie = r.returncode, (r.stdout or '') + (r.stderr or '')
    except FileNotFoundError as e:
        return {'statut': commun.ECHEC_TECHNIQUE, 'code': None,
                'sortie': f"Exécutable introuvable : {e}", 'duree': 0}
    except subprocess.TimeoutExpired:
        return {'statut': commun.ECHEC_TECHNIQUE, 'code': None,
                'sortie': f"Interrompu après {timeout}s.", 'duree': timeout}

    duree = (datetime.now(timezone.utc) - debut).total_seconds()

    if code == 0:
        statut = commun.REUSSI
    elif code == 1:
        statut = commun.ANOMALIES
    elif code == 2:
        statut = commun.ECHEC_TECHNIQUE
    else:
        statut = commun.ECHEC_TECHNIQUE
        sortie = f"[code de sortie inattendu : {code}]\n" + sortie

    return {'statut': statut, 'code': code, 'sortie': sortie, 'duree': round(duree, 1)}


SYMBOLES = {
    commun.REUSSI: '  OK  ',
    commun.ANOMALIES: 'ANOMAL',
    commun.ECHEC_TECHNIQUE: 'ÉCHEC ',
    'ignore': 'IGNORÉ',
}


def main():
    p = commun.analyseur(__doc__, besoin_frontend=True, besoin_backend=True)
    p.add_argument('--site', metavar='CHEMIN', default=os.environ.get('SORTIE', ''),
                   help='Dossier du site public généré (pour audit du générateur)')
    p.add_argument('--verbeux', action='store_true',
                   help='Affiche la sortie complète de chaque audit')
    args = p.parse_args()

    frontend = commun.trouver_depot('frontend', args.frontend, 'ARDOISE_FRONTEND')
    backend = commun.trouver_depot('backend', args.backend, 'ARDOISE_BACKEND')
    site = args.site or os.path.join(ICI, 'generateur', 'site')

    print('=' * 74)
    print('AUDIT GLOBAL — ARDOISE')
    print('=' * 74)
    print(f"frontend : {frontend}")
    print(f"backend  : {backend}")
    commit_f, commit_b = commun.commit_de(frontend), commun.commit_de(backend)
    if commit_f or commit_b:
        print(f"commits  : front {commit_f or '?'} · back {commit_b or '?'}")
    print()

    audits = definir_audits(frontend, backend, site)
    resultats = []

    for audit in audits:
        print(f"  … {audit['titre']:<45}", end='', flush=True)
        r = lancer(audit)

        # Un audit FACULTATIF en échec technique est signalé « ignoré » : son
        # outillage manque, ce n'est pas un défaut du dépôt. Il ne compte pas
        # dans le code de sortie, mais il est visible — jamais silencieux, et
        # surtout jamais compté comme réussi.
        affiche = r['statut']
        if r['statut'] == commun.ECHEC_TECHNIQUE and audit['facultatif']:
            affiche = 'ignore'

        print(f"[{SYMBOLES[affiche]}]  {r['duree']}s")
        resultats.append({**audit, **r, 'affiche': affiche})

    # ---- Détail ------------------------------------------------------------
    print()
    for r in resultats:
        if r['affiche'] == commun.REUSSI and not args.verbeux:
            continue
        print('-' * 74)
        print(f"{r['titre']}  [{SYMBOLES[r['affiche']].strip()}]")
        print('-' * 74)
        if r['affiche'] == 'ignore':
            print("  Outil non disponible — cet audit N'A PAS tourné.")
            print("  Ce n'est pas un succès : rien n'a été vérifié ici.\n")
            if r.get('prealable'):
                for l in r['prealable'].split('\n'):
                    print('  ' + l)
            print()
        lignes = r['sortie'].strip().split('\n')
        extrait = lignes if args.verbeux else lignes[-25:]
        for l in extrait:
            print('  ' + l)
        print()

    # ---- Bilan -------------------------------------------------------------
    bloquants = [r for r in resultats if not r['facultatif']]
    echecs = [r for r in bloquants if r['statut'] == commun.ECHEC_TECHNIQUE]
    anomalies = [r for r in bloquants if r['statut'] == commun.ANOMALIES]
    ignores = [r for r in resultats if r['affiche'] == 'ignore']

    print('=' * 74)
    print(f"{len(resultats)} audits · "
          f"{len([r for r in resultats if r['statut'] == commun.REUSSI])} réussis · "
          f"{len(anomalies)} avec anomalies · "
          f"{len(echecs)} en échec technique · {len(ignores)} ignorés")
    print('=' * 74)

    if echecs:
        print("\nÉCHEC TECHNIQUE — au moins un audit n'a pas pu s'exécuter :")
        for r in echecs:
            print(f"  · {r['titre']}")
        print("\nOn ne sait pas ce qu'on ignore : ce résultat est PLUS grave")
        print("qu'une liste d'anomalies connues.")
        code_final = 2
    elif anomalies:
        print("\nANOMALIES PRODUIT — les outils ont tourné et ont trouvé :")
        for r in anomalies:
            print(f"  · {r['titre']}")
        code_final = 1
    else:
        print("\nTous les audits bloquants ont tourné sans rien trouver.")
        code_final = 0

    if ignores:
        print(f"\nRappel — {len(ignores)} audit(s) non exécuté(s), donc non vérifié(s) :")
        for r in ignores:
            print(f"  · {r['titre']}")

    # ---- Sorties machine ---------------------------------------------------
    rapport = {
        'type_audit': 'global',
        'depot': 'Ardoise (frontend + backend)',
        'commit_sha': commit_f,
        'branche': commun.branche_de(frontend),
        'demarre_at': datetime.now(timezone.utc).isoformat(),
        'termine_at': datetime.now(timezone.utc).isoformat(),
        'statut': {0: commun.REUSSI, 1: commun.ANOMALIES,
                   2: commun.ECHEC_TECHNIQUE}[code_final],
        # Le nombre d'audits RÉELLEMENT exécutés — jamais le nombre lancé.
        # C'est ce compteur que le backend contrôle pour refuser un rapport vide.
        'nb_fichiers': len([r for r in resultats if r['statut'] != commun.ECHEC_TECHNIQUE]),
        'nb_anomalies': len(anomalies) + len(echecs),
        'message': f"{len(anomalies)} audit(s) avec anomalies, "
                   f"{len(echecs)} en échec technique, {len(ignores)} ignoré(s).",
        'resultats': [
            {
                'fichier': r['nom'],
                'ligne': None,
                'gravite': ('critique' if r['statut'] == commun.ECHEC_TECHNIQUE
                            and not r['facultatif'] else
                            'importante' if r['statut'] == commun.ANOMALIES else 'info'),
                'code': r['statut'],
                'message': f"{r['titre']} — {r['statut']} (code {r['code']})",
                'contexte': {'duree_s': r['duree'], 'facultatif': r['facultatif']},
            }
            for r in resultats if r['statut'] != commun.REUSSI
        ],
    }

    if args.json:
        with open(args.json, 'w', encoding='utf-8') as f:
            json.dump(rapport, f, ensure_ascii=False, indent=2)
        print(f"\nRapport JSON : {args.json}")

    if args.publier:
        commun.publier(rapport)

    return code_final


if __name__ == '__main__':
    try:
        sys.exit(main())
    except commun.EchecTechnique as e:
        print("ÉCHEC TECHNIQUE — l'audit global n'a pas pu démarrer.\n")
        for ligne in str(e).split('\n'):
            print('  ' + ligne)
        sys.exit(2)
