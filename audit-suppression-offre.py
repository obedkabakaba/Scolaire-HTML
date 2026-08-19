#!/usr/bin/env python3
"""
AUDIT — L'ÉCRAN SUPER ADMIN NE DOIT JAMAIS CONTREDIRE LA BASE.

CE QU'IL PROTÈGE
----------------
Une écriture qui échoue côté navigateur peut parfaitement avoir abouti côté
serveur : la transaction est validée, puis la réponse se perd — connexion
coupée, délai dépassé, passerelle qui rend la main pendant le réveil de
l'hébergement. C'est le quotidien d'une connexion d'école en RDC.

La suppression d'une offre en donnait la démonstration : la ligne disparaissait
de la base, restait à l'écran, et le clic suivant répondait « offre
introuvable ». L'écran affirmait l'inverse de la base — et c'est l'écran qu'on
croit.

Deux propriétés sont vérifiées ici, dans un vrai navigateur, parce qu'aucune
lecture du code ne prouve ce qui reste affiché après un échec réseau :

  1. quand la réponse d'une suppression se perd, la liste est tout de même
     rechargée : la ligne fantôme disparaît ;
  2. quand on supprime une ligne fantôme, le « 404 » n'est pas présenté comme
     un échec : c'est la preuve que le travail était déjà fait.

L'API est simulée. Le parcours serveur est couvert côté backend.

    pip install playwright && python3 -m playwright install chromium
    python3 audit-suppression-offre.py
"""

import functools
import http.server
import json
import pathlib
import socketserver
import sys
import threading

RACINE = pathlib.Path(__file__).resolve().parent
API = "https://scolaire-saas-backend.onrender.com"
JETON = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature-de-test"

anomalies = []


def signaler(message):
    anomalies.append(message)


def executable_chromium():
    candidats = list(pathlib.Path("/opt/pw-browsers").glob("chromium-*/chrome-linux/chrome"))
    return str(candidats[0]) if candidats else None


def servir():
    class Silencieux(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    gestionnaire = functools.partial(Silencieux, directory=str(RACINE))
    serveur = socketserver.TCPServer(("127.0.0.1", 0), gestionnaire)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    return serveur, f"http://127.0.0.1:{serveur.server_address[1]}"


def offre(identifiant, nom, prix):
    """Une offre que rien n'empêche de supprimer : jamais souscrite."""
    return {
        "id": identifiant, "nom": nom, "code": nom.lower(), "prix": prix, "devise": "USD",
        "statut": "actif", "visible_public": True, "duree_jours": 30, "ordre_affichage": 1,
        "abonnements_actifs": 0, "abonnements_total": 0, "en_essai": 0,
        "tarifs_negocies": 0, "tarifs_negocies_total": 0, "mrr": 0, "arr": 0,
        "revenu_encaisse": 0, "remises_mensuelles": 0,
        "supprimable": True, "espaces": {}, "limites": {},
    }


class Serveur:
    """L'état du serveur simulé, et la façon dont il répond."""

    def __init__(self, perdre_la_reponse=False):
        self.offres = [offre("o1", "Ascension", 30), offre("o2", "Prime", 60)]
        self.perdre_la_reponse = perdre_la_reponse

    def ids(self):
        return [o["id"] for o in self.offres]

    def router(self, route):
        requete = route.request
        chemin = requete.url.split(API, 1)[-1].split("?")[0]

        def json_ok(corps, statut=200):
            route.fulfill(status=statut, content_type="application/json", body=json.dumps(corps))

        if chemin == "/auth/login":
            return json_ok({"access_token": JETON, "refresh_token": "r",
                            "user": {"id": 1, "roles": ["super_admin"], "prenom": "Test", "nom": "Admin"}})

        if requete.method == "DELETE" and chemin.startswith("/super-admin/offres/"):
            identifiant = chemin.rsplit("/", 1)[-1]
            avant = len(self.offres)
            self.offres = [o for o in self.offres if o["id"] != identifiant]
            if len(self.offres) == avant:
                return json_ok({"message": "Offre introuvable."}, statut=404)
            if self.perdre_la_reponse:
                # La suppression a eu lieu ; la réponse, elle, n'arrivera jamais.
                return route.abort("connectionfailed")
            return json_ok({"message": "Offre supprimée."})

        if chemin == "/super-admin/offres":
            return json_ok({"offres": self.offres, "peut_ecrire": True,
                            "devise_reference": "USD"})

        return json_ok({"donnees": [], "offres": [], "ecoles": [], "plans": self.offres})


def ouvrir_super_admin(navigateur, base, serveur):
    ctx = navigateur.new_context(viewport={"width": 1280, "height": 900},
                                 service_workers="block")
    ctx.route(f"{API}/**", serveur.router)
    page = ctx.new_page()
    page.goto(f"{base}/super-admin.html", wait_until="domcontentloaded")
    page.wait_for_timeout(500)
    page.fill("#champ-email", "admin@ardoise.cd")
    page.fill("#champ-mot-de-passe", "motdepasse")
    page.click("#formulaire-connexion [type=submit]")
    page.wait_for_timeout(1200)
    page.evaluate("() => { location.hash = '#/offres'; }")
    page.wait_for_selector("[data-supprimer]", timeout=10000)
    return ctx, page


def lignes(page):
    return page.evaluate(
        "() => [...document.querySelectorAll('[data-supprimer]')].map((b) => b.dataset.supprimer)")


def demander_suppression(page, nom):
    page.fill("#f-nom_confirmation", nom)
    page.fill("#f-raison", "Audit automatique.")
    page.click('[data-role="valider"]')
    page.wait_for_timeout(2000)


def auditer_reponse_perdue(navigateur, base):
    """La réponse se perd, la suppression a bien eu lieu."""
    serveur = Serveur(perdre_la_reponse=True)
    ctx, page = ouvrir_super_admin(navigateur, base, serveur)

    page.click('[data-supprimer="o1"]')
    page.wait_for_timeout(400)
    demander_suppression(page, "Ascension")

    affichees = lignes(page)
    if "o1" in affichees:
        signaler("Réponse perdue : l'offre supprimée reste affichée. L'écran contredit la base, "
                 "et le clic suivant répondra « offre introuvable ».")
    if affichees != serveur.ids():
        signaler(f"Réponse perdue : la liste affiche {affichees}, le serveur a {serveur.ids()}.")

    # L'échec doit rester visible : la liste est juste, mais quelque chose a raté.
    erreur = page.evaluate(
        "() => { const e = document.getElementById('sa-form-erreur');"
        " return e && !e.hidden ? e.textContent.trim() : null; }")
    if not erreur:
        signaler("Réponse perdue : aucune erreur n'est montrée — l'échec passe inaperçu.")
    ctx.close()


def auditer_ligne_fantome(navigateur, base):
    """La ligne n'existe déjà plus : le refus ne doit pas ressembler à une panne."""
    serveur = Serveur()
    ctx, page = ouvrir_super_admin(navigateur, base, serveur)

    # L'offre disparaît côté serveur sans que l'écran en sache rien.
    serveur.offres = [o for o in serveur.offres if o["id"] != "o1"]

    page.click('[data-supprimer="o1"]')
    page.wait_for_timeout(400)
    demander_suppression(page, "Ascension")

    if page.query_selector('[data-role="valider"]'):
        signaler("Ligne fantôme : la modale reste ouverte sur un refus, alors que "
                 "la suppression demandée était déjà faite.")
    if "o1" in lignes(page):
        signaler("Ligne fantôme : la liste n'a pas été rechargée après le refus.")
    ctx.close()


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("=" * 70)
        print("ÉCHEC TECHNIQUE — l'audit n'a pas pu s'exécuter.")
        print("=" * 70)
        print("\n  Playwright n'est pas installé. Cet audit mesure ce qui RESTE À")
        print("  L'ÉCRAN après un échec réseau : sans navigateur, rien n'est")
        print("  vérifié, et il NE DOIT PAS être considéré comme réussi.\n")
        print("      pip install playwright")
        print("      python3 -m playwright install chromium\n")
        return 2

    serveur, base = servir()
    executable = executable_chromium()
    try:
        with sync_playwright() as p:
            navigateur = (p.chromium.launch(executable_path=executable, args=["--no-sandbox"])
                          if executable else p.chromium.launch(args=["--no-sandbox"]))
            auditer_reponse_perdue(navigateur, base)
            auditer_ligne_fantome(navigateur, base)
            navigateur.close()
    finally:
        serveur.shutdown()

    print("=" * 70)
    print("AUDIT — SUPPRESSION D'UNE OFFRE (espace Super Admin)")
    print("=" * 70)

    if anomalies:
        print(f"\n{len(anomalies)} ANOMALIE(S) :\n")
        for anomalie in dict.fromkeys(anomalies):
            print(f"  · {anomalie}")
        return 1

    print("\n  Une réponse perdue ne laisse pas de ligne fantôme à l'écran.")
    print("  Supprimer une ligne déjà supprimée n'est pas présenté comme une panne.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
