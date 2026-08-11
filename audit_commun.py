#!/usr/bin/env python3
"""
SOCLE COMMUN DES AUDITS — Ardoise
===========================================================================

POURQUOI CE FICHIER EXISTE
--------------------------
Les six scripts d'audit répétaient chacun leur propre façon de trouver un
dépôt, de compter ce qu'ils avaient examiné et de décider d'un code de sortie.
Chacun s'est trompé différemment, et toujours dans le même sens — celui du
faux succès :

  · `audit-sql.py` portait en dur `/home/claude/work/back/…`, un chemin propre
    à la machine de la personne qui l'a écrit. Ailleurs, il examinait zéro
    requête et annonçait « 0 en défaut » ;
  · `generateur/audit.py` cherchait un dossier de sortie qui n'existe qu'après
    une génération, trouvait zéro fichier HTML et concluait « aucun problème
    détecté » ;
  · `audit-contrat-api.py` supposait le backend dans un dossier frère et
    s'arrêtait sur un `FileNotFoundError` illisible ;
  · `audit-responsive.py` trouvait douze problèmes importants et sortait 0.

LA RÈGLE QUE CE MODULE IMPOSE
-----------------------------
Trois issues, jamais deux :

    RÉUSSI            l'audit a tourné et n'a rien trouvé      → code 0
    ANOMALIES         l'audit a tourné et a trouvé             → code 1
    ÉCHEC_TECHNIQUE   l'audit n'a PAS pu tourner               → code 2

La troisième est la seule qui manquait, et c'est celle qui compte. « Je n'ai
rien trouvé » et « je n'ai pas pu chercher » se ressemblent sur un terminal
et n'ont rien à voir : la première autorise un déploiement, la seconde doit
l'interdire. Zéro fichier examiné est TOUJOURS un échec technique, quelle que
soit la raison.
"""

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

REUSSI = 'reussi'
ANOMALIES = 'anomalies'
ECHEC_TECHNIQUE = 'echec_technique'

CODE_SORTIE = {REUSSI: 0, ANOMALIES: 1, ECHEC_TECHNIQUE: 2}

GRAVITES = ('info', 'faible', 'moyenne', 'importante', 'critique')


class EchecTechnique(Exception):
    """
    L'audit ne peut pas s'exécuter.

    Distincte d'une anomalie produit, et c'est tout l'objet de la classe. Un
    `raise EchecTechnique("Playwright absent")` produit un message d'action
    clair et un code 2 ; il ne se confond jamais avec « le dépôt est sain ».
    """


# ==========================================================================
#  1. TROUVER LES DÉPÔTS
# ==========================================================================

MARQUEURS = {
    'frontend': ['ui.js', 'session.js', 'connexion.html'],
    'backend': ['server.js', 'package.json', 'controllers'],
}


def _ressemble_a(chemin, genre):
    """Un dossier est-il vraiment le dépôt annoncé ?

    On vérifie des marqueurs plutôt que le NOM du dossier : quelqu'un qui
    clone dans `~/ardoise-back` ne doit pas être puni pour ça, et un dossier
    nommé `scolaire-saas-backend-main` mais vide ne doit pas être accepté.
    """
    if not chemin or not os.path.isdir(chemin):
        return False
    return all(os.path.exists(os.path.join(chemin, m)) for m in MARQUEURS[genre])


def trouver_depot(genre, explicite=None, variable_env=None):
    """
    Localise un dépôt, dans cet ordre de priorité :

      1. l'argument de ligne de commande (`--backend`), qui fait toujours foi ;
      2. la variable d'environnement documentée ;
      3. le dossier du script lui-même, puis ses dossiers frères ;
      4. la racine du dépôt git courant.

    Échoue avec un message d'ACTION, jamais avec une trace d'appels. Une
    personne qui lance un audit pour la première fois doit lire quoi faire,
    pas où le script a planté.
    """
    if explicite:
        if not _ressemble_a(explicite, genre):
            raise EchecTechnique(
                f"Le chemin fourni pour le dépôt {genre} ne ressemble pas à ce dépôt :\n"
                f"    {explicite}\n"
                f"  Attendus à la racine : {', '.join(MARQUEURS[genre])}")
        return os.path.abspath(explicite)

    if variable_env:
        depuis_env = os.environ.get(variable_env)
        if depuis_env:
            if not _ressemble_a(depuis_env, genre):
                raise EchecTechnique(
                    f"{variable_env} vaut « {depuis_env} », qui n'est pas le dépôt {genre}.\n"
                    f"  Attendus à la racine : {', '.join(MARQUEURS[genre])}")
            return os.path.abspath(depuis_env)

    ici = os.path.dirname(os.path.abspath(sys.argv[0])) or os.getcwd()
    candidats = [ici, os.path.dirname(ici)]

    def enfants(dossier, profondeur):
        """Sous-dossiers, jusqu'à `profondeur` niveaux, sans jamais explorer
        l'arborescence entière.

        Deux niveaux suffisent et sont nécessaires : l'agencement le plus
        courant place les deux dépôts dans des dossiers intermédiaires
        (`~/ardoise/back/scolaire-saas-backend-main` et
        `~/ardoise/front/Scolaire-HTML-main`). Chercher à un seul niveau ne
        trouve alors que `back` et `front`, qui ne sont pas des dépôts — et le
        script conclut à tort qu'il faut renseigner un chemin.

        Les dossiers de dépendances et de contrôle de version sont écartés :
        descendre dans `node_modules` coûterait des secondes pour rien.
        """
        if profondeur <= 0 or not os.path.isdir(dossier):
            return []
        trouves = []
        try:
            noms = sorted(os.listdir(dossier))
        except OSError:
            return []
        for nom in noms:
            if nom.startswith('.') or nom in ('node_modules', '__pycache__', 'venv'):
                continue
            complet = os.path.join(dossier, nom)
            if os.path.isdir(complet):
                trouves.append(complet)
                trouves += enfants(complet, profondeur - 1)
        return trouves

    parent = os.path.dirname(ici)
    candidats += enfants(parent, 1)
    candidats += enfants(os.path.dirname(parent), 2)

    for c in candidats:
        if _ressemble_a(c, genre):
            return os.path.abspath(c)

    option = '--backend' if genre == 'backend' else '--frontend'
    env = variable_env or ('ARDOISE_BACKEND' if genre == 'backend' else 'ARDOISE_FRONTEND')
    raise EchecTechnique(
        f"Dépôt {genre} introuvable.\n"
        f"  Les deux dépôts d'Ardoise sont séparés : rien ne garantit qu'ils soient\n"
        f"  côte à côte sur votre machine ou dans votre intégration continue.\n\n"
        f"  Indiquez-le explicitement :\n"
        f"      {os.path.basename(sys.argv[0])} {option} /chemin/vers/le/depot\n"
        f"  ou définissez la variable d'environnement :\n"
        f"      export {env}=/chemin/vers/le/depot\n\n"
        f"  Cherché depuis : {ici}")


def commit_de(depot):
    """SHA court du dépôt, ou None. Jamais bloquant : un export ZIP n'a pas de .git."""
    try:
        r = subprocess.run(['git', '-C', depot, 'rev-parse', '--short', 'HEAD'],
                           capture_output=True, text=True, timeout=5)
        return r.stdout.strip() or None if r.returncode == 0 else None
    except Exception:
        return None


def branche_de(depot):
    try:
        r = subprocess.run(['git', '-C', depot, 'rev-parse', '--abbrev-ref', 'HEAD'],
                           capture_output=True, text=True, timeout=5)
        return r.stdout.strip() or None if r.returncode == 0 else None
    except Exception:
        return None


# ==========================================================================
#  2. LE RAPPORT
# ==========================================================================

class Rapport:
    """
    Accumule les constats d'un audit et décide seul de son issue.

    Le point important : `statut` n'est PAS un champ que le script renseigne,
    c'est une propriété calculée. Aucun audit ne peut donc se déclarer réussi
    en ayant examiné zéro fichier — la règle n'est plus une consigne qu'on
    peut oublier, c'est une propriété du type.
    """

    def __init__(self, type_audit, depot=None, chemin_depot=None):
        self.type_audit = type_audit
        self.depot = depot
        self.chemin_depot = chemin_depot
        self.commit = commit_de(chemin_depot) if chemin_depot else None
        self.branche = branche_de(chemin_depot) if chemin_depot else None
        self.demarre_at = datetime.now(timezone.utc).isoformat()
        self.termine_at = None
        self.nb_fichiers = 0
        self.resultats = []
        self.message = None
        self._echec = None

    def fichier_examine(self, n=1):
        self.nb_fichiers += n

    def constat(self, fichier, code, message, gravite='moyenne', ligne=None, contexte=None):
        if gravite not in GRAVITES:
            gravite = 'moyenne'
        self.resultats.append({
            'fichier': fichier, 'ligne': ligne, 'gravite': gravite,
            'code': code, 'message': message, 'contexte': contexte or {}
        })

    def echec_technique(self, message):
        self._echec = message

    @property
    def statut(self):
        if self._echec:
            return ECHEC_TECHNIQUE
        # LA RÈGLE CENTRALE. Elle est ici, une seule fois, et pas dans six
        # scripts qui l'auraient chacun oubliée à leur tour.
        if self.nb_fichiers == 0:
            return ECHEC_TECHNIQUE
        return ANOMALIES if self.resultats else REUSSI

    @property
    def message_final(self):
        if self._echec:
            return self._echec
        if self.nb_fichiers == 0:
            return ("Aucun fichier examiné : l'audit n'a pas réellement tourné. "
                    "Vérifiez le chemin fourni, ou générez d'abord ce qui doit être analysé.")
        return self.message

    def bilan_par_gravite(self):
        b = {g: 0 for g in GRAVITES}
        for r in self.resultats:
            b[r['gravite']] += 1
        return b

    def en_dict(self):
        return {
            'type_audit': self.type_audit,
            'depot': self.depot,
            'commit_sha': self.commit,
            'branche': self.branche,
            'demarre_at': self.demarre_at,
            'termine_at': self.termine_at or datetime.now(timezone.utc).isoformat(),
            'statut': self.statut,
            'nb_fichiers': self.nb_fichiers,
            'nb_anomalies': len(self.resultats),
            'message': self.message_final,
            'resultats': self.resultats,
        }

    # ---------------------------------------------------------------- sortie

    def afficher(self, flux=None):
        """Rapport humain. Volontairement sobre : ce qui compte est la dernière ligne."""
        flux = flux or sys.stdout
        titre = f"AUDIT {self.type_audit.upper()}"
        print('=' * 70, file=flux)
        print(titre + (f"  —  {self.depot}" if self.depot else ''), file=flux)
        if self.commit:
            print(f"commit {self.commit}" + (f" ({self.branche})" if self.branche else ''), file=flux)
        print('=' * 70, file=flux)

        if self.statut == ECHEC_TECHNIQUE:
            print(file=flux)
            print("ÉCHEC TECHNIQUE — l'audit n'a pas pu s'exécuter.", file=flux)
            print(file=flux)
            for ligne in (self.message_final or '').split('\n'):
                print('  ' + ligne, file=flux)
            print(file=flux)
            print("Ce n'est PAS un rapport de conformité : rien n'a été vérifié.", file=flux)
            return

        par_fichier = {}
        for r in self.resultats:
            par_fichier.setdefault(r['fichier'], []).append(r)

        for fichier in sorted(par_fichier):
            print(f"\n{fichier}", file=flux)
            for r in sorted(par_fichier[fichier], key=lambda x: GRAVITES.index(x['gravite']), reverse=True):
                pos = f":{r['ligne']}" if r['ligne'] else ''
                print(f"  [{r['gravite'].upper()}]{pos} {r['message']}", file=flux)

        b = self.bilan_par_gravite()
        print(file=flux)
        print('-' * 70, file=flux)
        print(f"{self.nb_fichiers} fichier(s) examiné(s) · "
              f"{len(self.resultats)} anomalie(s)", file=flux)
        if self.resultats:
            print('  ' + '  |  '.join(f"{g} : {b[g]}" for g in reversed(GRAVITES) if b[g]), file=flux)
        print(f"→ {self.statut.upper()}", file=flux)

    def ecrire_json(self, chemin):
        with open(chemin, 'w', encoding='utf-8') as f:
            json.dump(self.en_dict(), f, ensure_ascii=False, indent=2)

    @property
    def code_sortie(self):
        return CODE_SORTIE[self.statut]


# ==========================================================================
#  3. PUBLICATION VERS LE SUPER ADMIN
# ==========================================================================

def publier(rapport_dict, url_base=None, secret=None, silencieux=False):
    """
    Envoie un rapport à `POST /audits/executions`.

    NE FAIT RIEN sans configuration, et le dit. Publier est facultatif : un
    développeur qui lance un audit sur son poste ne doit pas voir d'erreur
    réseau, et une CI mal configurée doit comprendre pourquoi rien n'arrive.

    Un échec de publication n'échoue PAS l'audit. Le résultat est déjà à
    l'écran et dans le JSON ; le réseau est un canal supplémentaire, pas le
    juge de paix.
    """
    url_base = url_base or os.environ.get('ARDOISE_API_URL')
    secret = secret or os.environ.get('AUDIT_INGEST_SECRET')

    if not url_base or not secret:
        if not silencieux:
            manquant = []
            if not url_base:
                manquant.append('ARDOISE_API_URL')
            if not secret:
                manquant.append('AUDIT_INGEST_SECRET')
            print(f"\n(publication ignorée — {' et '.join(manquant)} non défini(s))")
        return False

    corps = dict(rapport_dict)
    corps['declenche_par'] = os.environ.get('CI') and 'ci' or 'manuel'

    requete = urllib.request.Request(
        url_base.rstrip('/') + '/audits/executions',
        data=json.dumps(corps).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            # Le secret voyage en en-tête, jamais dans l'URL : une URL finit
            # dans les journaux d'accès du serveur et dans l'historique du
            # shell, un en-tête non.
            'X-Audit-Secret': secret,
        },
        method='POST')

    try:
        with urllib.request.urlopen(requete, timeout=20) as r:
            reponse = json.loads(r.read().decode('utf-8'))
        etat = reponse.get('statut')
        print(f"\n✓ Publié — exécution {reponse.get('id')} · statut retenu : {etat}")
        if reponse.get('requalifie'):
            print("  ATTENTION : le serveur a requalifié ce rapport. "
                  "Un audit sans fichier examiné ne peut pas être un succès.")
        return True
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'replace')[:300]
        print(f"\n✗ Publication refusée ({e.code}) : {detail}")
        return False
    except Exception as e:
        print(f"\n✗ Publication impossible : {e}")
        return False


# ==========================================================================
#  4. ARGUMENTS PARTAGÉS
# ==========================================================================

def analyseur(description, besoin_frontend=False, besoin_backend=False):
    """Construit un analyseur d'arguments avec les options communes à tous les audits."""
    p = argparse.ArgumentParser(
        description=description,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    if besoin_frontend:
        p.add_argument('--frontend', metavar='CHEMIN',
                       help='Racine du dépôt Scolaire-HTML-main '
                            '(par défaut : ARDOISE_FRONTEND, sinon détection)')
    if besoin_backend:
        p.add_argument('--backend', metavar='CHEMIN',
                       help='Racine du dépôt scolaire-saas-backend-main '
                            '(par défaut : ARDOISE_BACKEND, sinon détection)')
    p.add_argument('--json', metavar='FICHIER',
                   help='Écrit le rapport normalisé dans ce fichier')
    p.add_argument('--publier', action='store_true',
                   help='Publie vers le Super Admin (exige ARDOISE_API_URL et AUDIT_INGEST_SECRET)')
    p.add_argument('--silencieux', action='store_true',
                   help="N'affiche que le bilan final")
    return p


def executer(rapport_ou_fonction, args):
    """
    Enveloppe d'exécution commune : capture les échecs techniques, écrit le
    JSON, publie si demandé, et renvoie le bon code de sortie.

    Elle existe pour qu'aucun script n'ait à se souvenir de l'ordre de ces
    quatre gestes — l'oubli le plus fréquent étant le code de sortie, que
    `audit-responsive.py` avait laissé à 0 malgré douze problèmes importants.
    """
    try:
        rapport = rapport_ou_fonction() if callable(rapport_ou_fonction) else rapport_ou_fonction
    except EchecTechnique as e:
        print('=' * 70)
        print("ÉCHEC TECHNIQUE — l'audit n'a pas pu s'exécuter.")
        print('=' * 70)
        print()
        for ligne in str(e).split('\n'):
            print('  ' + ligne)
        print()
        print("Ce n'est PAS un rapport de conformité : rien n'a été vérifié.")
        return CODE_SORTIE[ECHEC_TECHNIQUE]

    rapport.termine_at = datetime.now(timezone.utc).isoformat()

    if not getattr(args, 'silencieux', False):
        rapport.afficher()

    if getattr(args, 'json', None):
        rapport.ecrire_json(args.json)
        print(f"\nRapport JSON : {args.json}")

    if getattr(args, 'publier', False):
        publier(rapport.en_dict())

    return rapport.code_sortie
