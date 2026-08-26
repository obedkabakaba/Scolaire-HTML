#!/usr/bin/env python3
"""
AUDIT DE LA FENÊTRE D'EXPOSITION DU RAIL — dans un vrai navigateur.

CE QUE CET AUDIT PROTÈGE
------------------------
Filtrer le rail par rôle en JavaScript ne suffit pas : entre le moment où le
navigateur peint le HTML et celui où le script s'exécute, le rail est là,
COMPLET, et cliquable. Sur une connexion lente, un cache froid ou un onglet
en arrière-plan, cette fenêtre dure le temps de télécharger ui.js.

C'est très exactement le défaut signalé : un Professeur ouvrait le Support —
page à laquelle il a droit —, y voyait le rail du Directeur avec Abonnements,
Comptabilité, Utilisateurs, Journal et Paramètres, et pouvait cliquer avant
que quoi que ce soit ne l'en empêche.

La parade est du CSS, pas du JavaScript : `.nav-liste { visibility: hidden }`
dans la page, et `filtrerNavigationParRole()` qui rend la liste visible une
fois le tri fait. On montre après avoir trié, jamais avant.

Cette propriété ne se vérifie pas en lisant le code — `audit-cloisonnement-
menus.py` vérifie que la règle est écrite, celui-ci vérifie qu'elle produit
l'effet attendu. D'où un vrai navigateur, et un ui.js volontairement ralenti.

    pip install playwright && python3 -m playwright install chromium
    python3 audit-fenetre-rail.py
"""

import functools
import http.server
import json
import pathlib
import socketserver
import sys
import threading
import time

RACINE = pathlib.Path(__file__).resolve().parent

# Le rôle le plus éloigné de la gestion de l'école : s'il ne voit rien fuir,
# personne ne voit rien fuir.
PROFESSEUR = {"id": 42, "prenom": "Test", "nom": "Professeur",
              "roles": ["professeur"], "ecole_id": 1}

# Les pages transversales : ouvertes à des rôles très différents, elles
# portent pourtant le rail complet écrit en dur dans le HTML.
PAGES = ["support.html", "abonnements.html"]

# Ce qu'un Professeur ne doit jamais pouvoir atteindre depuis un rail, même
# une fraction de seconde.
INTERDITS = {
    "abonnements.html", "comptabilite.html", "frais-scolaires.html",
    "utilisateurs.html", "journal.html", "parametres.html",
    "dashboard-directeur.html", "archives.html", "eleves.html",
    "classes.html", "annee-scolaire.html", "generateur-modeles.html",
    "site-public.html", "rapports.html", "espace-secretaire.html",
    "espace-titulaire.html", "cours.html", "cours-classe-titulaire.html",
    "bulletins.html", "bulletin-annuel.html", "orientation.html",
    "discipline.html", "presences.html",
}

# Une sonde posée AVANT tout script de la page : elle relève, image par
# image, ce que le rail montre. `domcontentloaded` ne conviendrait pas — il
# attend ui.js, c'est-à-dire précisément la fin de la fenêtre à mesurer.
SONDE = """
window.__traces = [];
(function boucle() {
  const liste = document.querySelector('.nav-liste');
  if (liste) {
    const style = getComputedStyle(liste);
    window.__traces.push({
      cache: style.visibility === 'hidden' || style.display === 'none',
      liens: [...liste.querySelectorAll('.nav-item[href]')]
        .filter((a) => {
          const li = a.closest('li');
          return !((li && li.style.display === 'none') || a.hidden);
        })
        .map((a) => (a.getAttribute('href') || '').split('/').pop())
    });
  }
  requestAnimationFrame(boucle);
})();
"""


def executable_chromium():
    """Chromium fourni par l'image CI, sinon celui installé par Playwright."""
    candidats = list(pathlib.Path("/opt/pw-browsers").glob("chromium-*/chrome-linux/chrome"))
    return str(candidats[0]) if candidats else None


class ServeurMuet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class Serveur(socketserver.TCPServer):
    allow_reuse_address = True


def servir():
    """Les pages doivent venir d'une vraie origine : `file://` n'a pas de
    localStorage partagé entre pages, et le service worker ne s'y installe pas."""
    httpd = Serveur(("127.0.0.1", 0),
                    functools.partial(ServeurMuet, directory=str(RACINE)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}"


def auditer(navigateur, base):
    anomalies = []
    contexte = navigateur.new_context(viewport={"width": 1400, "height": 900})
    contexte.add_init_script(
        "localStorage.setItem('ardoise_user', %s);"
        "localStorage.setItem('ardoise_token', 'jeton-audit');"
        "localStorage.setItem('ardoise_access_token', 'jeton-audit');"
        % json.dumps(json.dumps(PROFESSEUR)))
    contexte.add_init_script(SONDE)

    # ui.js arrive avec 1,5 s de retard : le navigateur a largement eu le
    # temps de peindre le rail. C'est la situation d'un premier chargement
    # sur une connexion ordinaire à Kinshasa, pas un cas de laboratoire.
    def retarder(route):
        time.sleep(1.5)
        route.continue_()

    contexte.route("**/ui.js", retarder)
    # Aucun appel réseau applicatif : l'audit mesure le rail, pas l'API.
    contexte.route("**/api/**", lambda route: route.abort())

    for cible in PAGES:
        page = contexte.new_page()
        page.goto(f"{base}/{cible}", wait_until="commit")
        page.wait_for_timeout(700)      # ui.js n'est pas encore arrivé
        traces = page.evaluate("window.__traces || []")
        page.close()

        if not traces:
            anomalies.append((cible, "le rail n'a jamais été observé "
                                     "(la page n'a pas été rendue)"))
            continue

        fuites = set()
        for trace in traces:
            if trace["cache"]:
                continue
            fuites |= (set(trace["liens"]) & INTERDITS)

        if fuites:
            anomalies.append((cible, "rail visible avant filtrage — "
                                     f"{len(fuites)} écran(s) interdits offerts : "
                                     + ", ".join(sorted(fuites))))
        else:
            print(f"  OK  {cible} — rail masqué jusqu'au tri par rôle "
                  f"({len(traces)} images observées)")

    contexte.close()
    return anomalies


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("=" * 70)
        print("ÉCHEC TECHNIQUE — l'audit n'a pas pu s'exécuter.")
        print("=" * 70)
        print("\n  Playwright n'est pas installé. Cet audit mesure ce qui est")
        print("  RÉELLEMENT peint par le navigateur avant que le script ne")
        print("  s'exécute : sans lui, rien n'est vérifié, et il NE DOIT PAS")
        print("  être considéré comme réussi.\n")
        print("      pip install playwright")
        print("      python3 -m playwright install chromium\n")
        return 2

    print("=" * 70)
    print("AUDIT — fenêtre d'exposition du rail de navigation")
    print("=" * 70)

    httpd, base = servir()
    executable = executable_chromium()
    try:
        with sync_playwright() as p:
            navigateur = (p.chromium.launch(executable_path=executable, args=["--no-sandbox"])
                          if executable else p.chromium.launch(args=["--no-sandbox"]))
            anomalies = auditer(navigateur, base)
            navigateur.close()
    finally:
        httpd.shutdown()

    print("-" * 70)
    if anomalies:
        for page, message in anomalies:
            print(f"  [CRITIQUE] {page} : {message}")
        print(f"\n{len(anomalies)} anomalie(s)\n→ ANOMALIES")
        return 1
    print(f"{len(PAGES)} page(s) transversale(s) examinée(s) · 0 anomalie\n→ REUSSI")
    return 0


if __name__ == "__main__":
    sys.exit(main())
