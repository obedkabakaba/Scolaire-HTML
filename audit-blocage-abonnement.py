#!/usr/bin/env python3
"""
AUDIT DE L'ÉCRAN DE BLOCAGE — dans un vrai navigateur.

CE QUE CET AUDIT PROTÈGE
------------------------
Quand une école n'a plus d'abonnement, le serveur refuse chaque appel avec un
402. Ce qui se passe ALORS dans le navigateur a longtemps été le pire moment
de la plateforme :

  · `session.js` ET `ui.js` réagissaient chacun au même 402, et posaient deux
    voiles plein écran superposés, chacun avec son `backdrop-filter` ;
  · l'application restait vivante derrière — menu, tableaux, et des `.spinner`
    qui tournaient indéfiniment pour un chargement qui n'aboutirait jamais.

Le navigateur floutait donc la page entière, deux fois, à chaque image, en
pleine résolution. Sur les téléphones d'entrée de gamme qui sont l'essentiel du
parc, l'écran devenait brûlant puis cessait de répondre : « ça plante ».

Ces propriétés ne se lisent pas dans le code — elles dépendent du style
CALCULÉ après application des feuilles de style et de l'ordre réel de
chargement des scripts. D'où un vrai navigateur.

L'API est simulée : cet audit teste l'interface, pas le serveur. Le contrat
serveur est couvert par `test/acces-annonce-a-la-connexion.test.js` côté
backend.

    pip install playwright && python3 -m playwright install chromium
    python3 audit-blocage-abonnement.py
"""

import functools
import http.server
import json
import pathlib
import socketserver
import sys
import threading

RACINE = pathlib.Path(__file__).resolve().parent

# Les écrans où une école bloquée peut atterrir. Aucun ne doit peiner.
PAGES_APPLICATIVES = [
    "dashboard-directeur.html", "espace-secretaire.html", "espace-professeur.html",
    "espace-titulaire.html", "frais-scolaires.html", "eleves.html", "presences.html",
    "notes.html", "bulletins.html", "classes.html", "parametres.html", "messages.html",
    "calendrier.html", "utilisateurs.html", "rapports.html", "journal.html",
    "comptabilite.html", "cours.html", "discipline.html", "archives.html",
    "emploi-du-temps.html", "inscriptions.html", "annee-scolaire.html", "orientation.html",
]

# Les pages qui SONT la sortie : payer, écrire au support, reprendre son compte.
# Les recouvrir d'un mur, c'est enfermer l'école dehors.
PAGES_DE_SORTIE = ["abonnements.html", "support.html", "mon-profil.html"]

API = "https://scolaire-saas-backend.onrender.com"

# Ce que le serveur renvoie à une école dont l'abonnement est terminé.
BLOCAGE = {
    "code": "abonnement_expire",
    "message": "Votre abonnement Ardoise n'est plus actif. "
               "Vos données sont intégralement conservées.",
    "action": "Renouvelez votre abonnement pour retrouver l'accès immédiatement.",
    "acces": "expire", "en_demo": False, "fin_at": None,
    "offre_code": "ascension", "offre_nom": "Ascension", "donnees_conservees": True,
}

# Les chemins que le verrou serveur laisse toujours ouverts
# (`CHEMINS_TOUJOURS_OUVERTS`, middleware/offre.middleware.js).
CHEMINS_OUVERTS = ["/abonnements", "/catalogue", "/auth", "/paiements",
                   "/notifications", "/incidents", "/utilisateurs/moi"]

JETON = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature-de-test"

anomalies = []


def signaler(message):
    anomalies.append(message)


def executable_chromium():
    """Chromium fourni par l'image CI, sinon celui installé par Playwright."""
    candidats = list(pathlib.Path("/opt/pw-browsers").glob("chromium-*/chrome-linux/chrome"))
    return str(candidats[0]) if candidats else None


def servir():
    """Le dépôt servi en HTTP.

    `file://` ne conviendrait pas : plusieurs scripts lisent `localStorage`,
    que Chromium refuse sur une origine opaque. On testerait alors une
    application sans session, c'est-à-dire pas celle des écoles.
    """
    class Silencieux(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass                      # le journal d'accès n'apprend rien ici

    gestionnaire = functools.partial(Silencieux, directory=str(RACINE))
    serveur = socketserver.TCPServer(("127.0.0.1", 0), gestionnaire)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    return serveur, f"http://127.0.0.1:{serveur.server_address[1]}"


# Vrai quand le serveur ignore encore le champ `acces` — l'état réel entre le
# déploiement du site et celui du backend, qui partent séparément.
SERVEUR_ANCIEN = {"valeur": False}


def repondre(route):
    """L'API simulée : ouverte là où le serveur l'est, 402 partout ailleurs."""
    chemin = route.request.url.split(API, 1)[-1].split("?")[0]

    def json_ok(corps, statut=200):
        route.fulfill(status=statut, content_type="application/json",
                      body=json.dumps(corps))

    if chemin == "/auth/login":
        corps = {"access_token": JETON, "refresh_token": "r",
                 "user": {"id": 1, "roles": ["directeur"], "ecole_id": 1}}
        if not SERVEUR_ANCIEN["valeur"]:
            corps["acces"] = {"bloquant": True, **BLOCAGE}
        return json_ok(corps)
    if chemin == "/auth/refresh":
        return json_ok({"access_token": JETON, "acces": {"bloquant": True, **BLOCAGE}})

    ouvert = any(chemin == p or chemin.startswith(p + "/") for p in CHEMINS_OUVERTS)
    if not ouvert:
        return json_ok(BLOCAGE, statut=402)

    if chemin == "/abonnements/courant":
        return json_ok({"statut": "expire",
                        "etat_acces": {"acces": "expire", "bloquant": True,
                                       "en_demo": False, "motif": "abonnement_inactif"},
                        "offre": {"code": "ascension", "nom": "Ascension",
                                  "fonctionnalites": {}}})
    if chemin.startswith("/abonnements/renouvellement"):
        return json_ok({
            "ecole": {"nom": "Institut Test", "code": "EC-001", "plan_nom": "Ascension",
                      "abonnement_statut": "expire", "date_expiration": "2026-06-01T00:00:00Z"},
            "depot": {"disponible": True, "numero": "+243 900 000 000",
                      "nom": "Ardoise SARL", "reseau": "Orange Money"},
            "demande": None,
            "plans": [{"id": "p1", "nom": "Ascension", "positionnement": "Complet",
                       "prix": 50, "devise": "USD",
                       "tarifs": {"mensuel": 50, "semestriel": 270, "annuel": 500},
                       "economies": {}, "fonctionnalites_incluses": ["Bulletins"]}],
        })
    return json_ok([])


# Le défaut le plus grave que cet audit doit empêcher de revenir : une page
# ENTIÈREMENT VIDE. Le masquage de l'application et le voile qui la remplace
# doivent rester d'accord ; si le voile disparaît, l'application doit revenir.
ETAT_DE_LA_PAGE = """
() => {
  const voiles = [...document.querySelectorAll('[role="alertdialog"]')];
  const style = (v) => getComputedStyle(v);
  const couche = document.querySelector('.mise-en-page');
  return {
    voiles: voiles.length,
    flous: voiles.filter((v) => {
      const s = style(v);
      const f = s.backdropFilter || s.webkitBackdropFilter;
      return f && f !== 'none';
    }).length,
    applicationDerriere: !!couche && style(couche).display !== 'none',
    animations: document.getAnimations
      ? document.getAnimations().filter((a) => a.playState === 'running').length : 0,
    sortieProposee: voiles.length
      ? !!voiles[0].querySelector('a[href="abonnements.html"]') : false,
    deconnexionPossible: voiles.length
      ? !!voiles[0].querySelector('button') : false
  };
}
"""


def ouvrir_session(page, base):
    page.goto(f"{base}/connexion.html", wait_until="domcontentloaded")
    page.evaluate(
        """(jeton) => {
             localStorage.setItem('ardoise_access_token', jeton);
             localStorage.setItem('ardoise_refresh_token', 'r');
             localStorage.setItem('ardoise_user', JSON.stringify(
               { id: 1, ecole_id: 1, roles: ['directeur','prefet','secretaire',
                                             'professeur','titulaire','comptable'] }));
           }""", JETON)


def auditer_connexion(navigateur, base):
    """On n'entre pas dans une application dont on sait qu'elle ne servira à rien."""
    ctx = navigateur.new_context(viewport={"width": 390, "height": 780}, is_mobile=True,
                                 has_touch=True, service_workers="block")
    ctx.route(f"{API}/**", repondre)
    page = ctx.new_page()

    visitees = []
    page.on("framenavigated",
            lambda f: visitees.append(f.url.split("/")[-1]) if f == page.main_frame else None)

    page.goto(f"{base}/connexion.html", wait_until="domcontentloaded")
    page.fill("#code_ecole", "EC-001")
    page.fill("#email", "directeur@test.cd")
    page.fill("#mot_de_passe", "motdepasse")
    page.click("#bouton-connexion")
    page.wait_for_timeout(2500)

    if "dashboard-directeur.html" in visitees:
        signaler("Connexion : le tableau de bord est ouvert alors que l'accès est bloqué — "
                 "c'est le détour qui fait peiner les téléphones.")
    if not page.url.endswith("abonnements.html"):
        signaler(f"Connexion : le directeur bloqué devrait arriver sur abonnements.html, "
                 f"il est sur {page.url.split('/')[-1]}.")
    else:
        etat = page.evaluate(ETAT_DE_LA_PAGE)
        if etat["voiles"]:
            signaler("Connexion : la page de paiement est recouverte par l'écran de blocage.")
    ctx.close()


def auditer_connexion_serveur_ancien(navigateur, base):
    """Le site est déployé, le backend ne l'est pas encore.

    Les deux dépôts se déploient SÉPARÉMENT. Entre les deux mises en ligne — et
    indéfiniment si l'une échoue — le site est neuf et le serveur ne connaît pas
    encore le champ `acces`. Un correctif qui dépend d'un déploiement qu'on ne
    contrôle pas n'est pas un correctif : la connexion doit alors constater le
    blocage par elle-même, en sondant une route que le verrou ferme.
    """
    SERVEUR_ANCIEN["valeur"] = True
    try:
        ctx = navigateur.new_context(viewport={"width": 390, "height": 780}, is_mobile=True,
                                     has_touch=True, service_workers="block")
        ctx.route(f"{API}/**", repondre)
        page = ctx.new_page()

        visitees = []
        page.on("framenavigated",
                lambda f: visitees.append(f.url.split("/")[-1]) if f == page.main_frame else None)

        page.goto(f"{base}/connexion.html", wait_until="domcontentloaded")
        page.fill("#code_ecole", "EC-001")
        page.fill("#email", "directeur@test.cd")
        page.fill("#mot_de_passe", "motdepasse")
        page.click("#bouton-connexion")
        page.wait_for_timeout(3000)

        if "dashboard-directeur.html" in visitees:
            signaler("Serveur ancien : le tableau de bord est ouvert alors que l'accès est "
                     "bloqué. La protection dépend du déploiement du backend.")
        if not page.url.endswith("abonnements.html"):
            signaler(f"Serveur ancien : le directeur bloqué devrait arriver sur "
                     f"abonnements.html, il est sur {page.url.split('/')[-1]}.")
        ctx.close()
    finally:
        SERVEUR_ANCIEN["valeur"] = False


def auditer_ecran_de_blocage(navigateur, base):
    """Un seul écran, opaque, et plus rien qui peigne derrière."""
    ctx = navigateur.new_context(viewport={"width": 390, "height": 780}, is_mobile=True,
                                 has_touch=True, service_workers="block")
    ctx.route(f"{API}/**", repondre)
    page = ctx.new_page()
    ouvrir_session(page, base)

    for nom in PAGES_APPLICATIVES:
        page.goto(f"{base}/{nom}", wait_until="domcontentloaded")
        # On ATTEND l'écran plutôt que de compter sur un délai fixe : selon la
        # page, le premier appel refusé part au bout de quelques centaines de
        # millisecondes ou de plusieurs secondes. Un délai fixe ferait échouer
        # l'audit au rythme du réseau, pas au rythme des défauts.
        try:
            page.wait_for_selector('[role="alertdialog"]', timeout=8000)
        except Exception:
            signaler(f"{nom} : aucun écran de blocage — l'école lit un message d'erreur "
                     "technique au lieu de son état d'abonnement.")
            continue
        # Un instant de plus : c'est là qu'un SECOND voile viendrait se poser.
        page.wait_for_timeout(1200)
        etat = page.evaluate(ETAT_DE_LA_PAGE)

        if etat["voiles"] == 0:
            signaler(f"{nom} : l'écran de blocage a disparu après son affichage.")
            continue
        if etat["voiles"] > 1:
            signaler(f"{nom} : {etat['voiles']} écrans de blocage superposés.")
        if etat["flous"]:
            signaler(f"{nom} : {etat['flous']} voile(s) avec `backdrop-filter` — "
                     "la page entière est refloutée à chaque image.")
        if etat["applicationDerriere"]:
            signaler(f"{nom} : l'application reste rendue derrière l'écran de blocage.")
        if etat["animations"]:
            signaler(f"{nom} : {etat['animations']} animation(s) continuent de tourner "
                     "derrière l'écran de blocage.")
        if not etat["sortieProposee"]:
            signaler(f"{nom} : l'écran de blocage ne propose pas la page des abonnements.")
        if not etat["deconnexionPossible"]:
            signaler(f"{nom} : impossible de se déconnecter depuis l'écran de blocage.")
    ctx.close()


def auditer_absence_de_page_vide(navigateur, base):
    """Retirer le voile ne doit jamais laisser un écran vide.

    Le premier correctif posait un attribut sur `<html>` et masquait tout ce
    qui n'était pas le voile. Attribut et élément devaient rester d'accord :
    le voile manquant — retiré par un autre script, perdu au retour d'un
    onglet mis en veille par le téléphone — il ne restait plus rien à l'écran,
    pas même un bouton. C'est le défaut qui a été rapporté depuis le terrain,
    et il ne se voit qu'en simulant la disparition du voile.
    """
    ctx = navigateur.new_context(viewport={"width": 390, "height": 780}, is_mobile=True,
                                 has_touch=True, service_workers="block")
    ctx.route(f"{API}/**", repondre)
    page = ctx.new_page()
    ouvrir_session(page, base)

    page.goto(f"{base}/eleves.html", wait_until="domcontentloaded")
    try:
        page.wait_for_selector('[role="alertdialog"]', timeout=8000)
    except Exception:
        signaler("Page vide : impossible de tester, l'écran de blocage ne s'affiche pas.")
        ctx.close()
        return

    page.evaluate("() => document.getElementById('ardoise-expiration-session').remove()")
    page.wait_for_timeout(300)

    lisible = page.evaluate(
        "() => document.body.innerText.trim().length > 0"
        " && [...document.body.children].some((e) => e.tagName !== 'SCRIPT'"
        "      && getComputedStyle(e).display !== 'none')")
    if not lisible:
        signaler("Page vide : sans le voile, l'écran ne montre plus rien du tout — "
                 "c'est l'écran blanc rapporté par les écoles.")

    # Retour sur l'onglet : le blocage doit se rétablir de lui-même.
    page.evaluate("() => document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(600)
    if not page.evaluate("() => !!document.getElementById('ardoise-expiration-session')"):
        signaler("Page vide : l'écran de blocage ne se rétablit pas au retour sur l'onglet.")
    ctx.close()


def auditer_serveur_endormi(navigateur, base):
    """Le serveur ne répond pas : la page doit le DIRE, pas se figer.

    L'hébergement met le serveur en veille après une période d'inactivité. Le
    premier appel du matin paie le réveil — trente à cinquante secondes —
    pendant lesquelles la requête est partie et ne revient pas. Ce n'est pas
    une erreur : c'est une attente, et `fetch` patiente sans limite.

    La page d'abonnement restait donc sur un « Chargement… » muet, sans bouton
    et sans message. C'est le défaut décrit depuis le terrain : « la page
    d'abonnement s'ouvre mais rien ne se clique ». Il ne se voit qu'en laissant
    une requête sans réponse, ce qu'aucun test d'API simulée ne fait
    spontanément.
    """
    ctx = navigateur.new_context(viewport={"width": 390, "height": 780}, is_mobile=True,
                                 has_touch=True, service_workers="block")

    def router(route):
        chemin = route.request.url.split(API, 1)[-1].split("?")[0]
        if chemin.startswith("/abonnements/renouvellement"):
            return          # la requête part et ne revient jamais
        return repondre(route)

    ctx.route(f"{API}/**", router)
    page = ctx.new_page()
    ouvrir_session(page, base)
    page.goto(f"{base}/abonnements.html", wait_until="domcontentloaded")

    # Au-delà du délai après lequel la page doit expliquer l'attente.
    page.wait_for_timeout(9000)

    dit = page.evaluate(
        "() => { const p = document.getElementById('plans');"
        " const c = document.getElementById('etat-compact');"
        " return ((p ? p.textContent : '') + ' ' + (c ? c.textContent : '')).trim(); }")

    if "Chargement" in dit and "réveille" not in dit and "Connexion" not in dit:
        signaler("Serveur endormi : la page reste sur « Chargement… » sans rien expliquer. "
                 "C'est l'écran mort dont les écoles ne peuvent pas sortir.")
    ctx.close()


def auditer_pages_de_sortie(navigateur, base):
    """Payer, écrire au support, changer son mot de passe : jamais recouvert."""
    ctx = navigateur.new_context(viewport={"width": 390, "height": 780}, is_mobile=True,
                                 has_touch=True, service_workers="block")
    ctx.route(f"{API}/**", repondre)
    page = ctx.new_page()
    ouvrir_session(page, base)

    for nom in PAGES_DE_SORTIE:
        page.goto(f"{base}/{nom}", wait_until="domcontentloaded")
        page.wait_for_timeout(2200)
        etat = page.evaluate(ETAT_DE_LA_PAGE)
        if etat["voiles"]:
            signaler(f"{nom} : recouverte par l'écran de blocage, alors que c'est "
                     "précisément la page qui permet d'en sortir.")
        lisible = page.evaluate(
            "() => { const m = document.querySelector('main.contenu');"
            " return !!m && m.getBoundingClientRect().height > 0; }")
        if not lisible:
            signaler(f"{nom} : le contenu de la page n'occupe aucune place à l'écran.")
    ctx.close()


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("=" * 70)
        print("ÉCHEC TECHNIQUE — l'audit n'a pas pu s'exécuter.")
        print("=" * 70)
        print("\n  Playwright n'est pas installé. Cet audit mesure un COÛT DE RENDU")
        print("  réel : sans navigateur, rien n'est vérifié, et il NE DOIT PAS")
        print("  être considéré comme réussi.\n")
        print("      pip install playwright")
        print("      python3 -m playwright install chromium\n")
        return 2

    serveur, base = servir()
    executable = executable_chromium()
    try:
        with sync_playwright() as p:
            navigateur = (p.chromium.launch(executable_path=executable, args=["--no-sandbox"])
                          if executable else p.chromium.launch(args=["--no-sandbox"]))
            auditer_connexion(navigateur, base)
            auditer_connexion_serveur_ancien(navigateur, base)
            auditer_ecran_de_blocage(navigateur, base)
            auditer_absence_de_page_vide(navigateur, base)
            auditer_serveur_endormi(navigateur, base)
            auditer_pages_de_sortie(navigateur, base)
            navigateur.close()
    finally:
        serveur.shutdown()

    print("=" * 70)
    print("AUDIT DE L'ÉCRAN DE BLOCAGE (école sans abonnement actif)")
    print("=" * 70)
    print(f"\n  Pages applicatives vérifiées : {len(PAGES_APPLICATIVES)}")
    print(f"  Pages de sortie vérifiées    : {', '.join(PAGES_DE_SORTIE)}\n")

    if anomalies:
        print(f"{len(anomalies)} ANOMALIE(S) :\n")
        for anomalie in dict.fromkeys(anomalies):
            print(f"  · {anomalie}")
        return 1

    print("  La connexion n'ouvre plus l'application quand l'accès est bloqué,")
    print("  y compris face à un serveur qui ignore encore le champ « acces ».")
    print("  Un seul écran de blocage, opaque, application réellement masquée.")
    print("  Aucune animation ne tourne derrière ; les pages de sortie restent libres.")
    print("  Sans voile, la page redevient lisible : aucun écran vide possible.")
    print("  Un serveur qui ne répond pas est annoncé, jamais laissé en silence.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
