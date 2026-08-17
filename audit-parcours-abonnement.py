#!/usr/bin/env python3
"""
AUDIT DU PARCOURS ABONNEMENT / SUPPORT — dans un vrai navigateur.

CE QUE CET AUDIT PROTÈGE
------------------------
La page Abonnements repose sur une divulgation progressive : à aucun moment
l'école ne doit voir une étape qu'elle n'a pas encore atteinte. C'est une
propriété facile à casser sans s'en rendre compte — il suffit qu'un `cache`
disparaisse d'un gabarit, ou qu'une fonction de rendu soit appelée trop tôt,
pour que le numéro de dépôt et le champ de référence réapparaissent en haut de
page. Rien ne planterait ; l'écran redeviendrait simplement le formulaire
fourre-tout qu'il était.

Ces vérifications ne peuvent pas se faire en lisant le code : elles portent sur
ce qui est RÉELLEMENT visible après application des feuilles de style et du
script. D'où un vrai navigateur.

L'API est simulée : l'audit teste l'interface, pas le serveur. Les parcours
serveur sont couverts côté backend par
`test/renouvellements-parcours.test.js`.

    pip install playwright && python3 -m playwright install chromium
    python3 audit-parcours-abonnement.py
"""

import pathlib
import sys

RACINE = pathlib.Path(__file__).resolve().parent

# Un jeu de données stable : deux offres, l'école étant abonnée à la seconde.
# Les montants sont choisis pour que l'économie annuelle soit vérifiable à
# l'œil : 30 $/mois → 324 $/an, soit 27 $/mois équivalent et 36 $ économisés.
STUB = """
window.ArdoiseSession = { connecte: () => true, terminer: () => {}, appelApi: (chemin, opt) => {
  const d = {
    ecole: { nom: 'Institut Test', code: 'EC-001', plan_nom: 'Prime', abonnement_plan_id: 'p2',
      abonnement_statut: 'actif', date_expiration: '2026-09-30T00:00:00Z',
      telephone: '+243900000000', adresse: '12 av. Test', commune: 'Gombe', ville: 'Kinshasa' },
    demande: null,
    depot: { disponible: true, numero: '+243 900 000 000', nom: 'Ardoise SARL', reseau: 'Orange Money' },
    plans: [
      { id: 'p1', nom: 'Essentiel', positionnement: 'Pour démarrer', prix: 15, devise: 'USD',
        tarifs: { mensuel: 15, semestriel: 84, annuel: 150 },
        economies: { semestriel: 6, annuel: 30 },
        fonctionnalites_incluses: ['Bulletins', 'Élèves'] },
      { id: 'p2', nom: 'Prime', positionnement: 'Le plus complet', prix: 30, devise: 'USD',
        tarifs: { mensuel: 30, semestriel: 168, annuel: 324 },
        economies: { semestriel: 12, annuel: 36 },
        fonctionnalites_incluses: ['Tout Essentiel', 'Comptabilité', 'Rapports'] }
    ],
    donnees: [],
    message: 'Demande créée.'
  };
  if (opt && opt.method === 'POST') {
    d.demande = { id: 'd1', statut: 'en_attente_paiement', plan_id: 'p2', plan_nom: 'Prime',
      periodicite: 'annuel', montant_attendu: 324, devise: 'USD', mode_paiement: 'depot',
      numero_depot: '+243 900 000 000', reseau_depot: 'Orange Money', nom_depot: 'Ardoise SARL' };
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve(d) });
} };
"""

TAILLES = [
    ("iPhone étroit", 320, 568),
    ("iPhone standard", 390, 844),
    ("Android standard", 412, 915),
    ("Tablette", 768, 1024),
    ("Desktop", 1440, 900),
]

THEMES = ["ardoise", "nuit", "pure", "yohali", "studio", "kivu", "public"]

anomalies = []


def signaler(message):
    anomalies.append(message)


def executable_chromium():
    """Chromium fourni par l'image CI, sinon celui installé par Playwright."""
    candidats = list(pathlib.Path("/opt/pw-browsers").glob("chromium-*/chrome-linux/chrome"))
    return str(candidats[0]) if candidats else None


def visible(page, selecteur):
    return page.evaluate(
        "(s) => { const e = document.querySelector(s);"
        " return !!e && !e.classList.contains('cache'); }", selecteur)


def occupe_de_la_place(page, selecteur):
    """Vrai si l'élément a une surface réelle à l'écran (donc lisible)."""
    return page.evaluate(
        "(s) => { const e = document.querySelector(s); if (!e) return false;"
        " const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }", selecteur)


def auditer_divulgation(navigateur):
    """Le cœur : chaque étape n'apparaît qu'une fois la précédente franchie."""
    ctx = navigateur.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    page.add_init_script(STUB)
    page.goto(f"file://{RACINE / 'abonnements.html'}", wait_until="domcontentloaded")
    page.wait_for_timeout(500)

    # --- Étape 0 : l'état, et rien d'autre.
    for selecteur in ["#tunnel", "#etape-duree", "#etape-mode", "#etape-depot"]:
        if visible(page, selecteur):
            signaler(f"Étape 0 : {selecteur} est visible alors que rien n'a été demandé.")
    if not page.query_selector("#btn-renouveler"):
        signaler("Étape 0 : le bouton « Renouveler mon abonnement » est absent.")
    if occupe_de_la_place(page, "#numero-depot"):
        signaler("Étape 0 : le numéro de dépôt est affiché d'emblée.")

    # --- Étape 1 : les offres.
    page.click("#btn-renouveler")
    page.wait_for_timeout(300)
    if not visible(page, "#etape-offre"):
        signaler("Étape 1 : les offres ne s'affichent pas.")
    if visible(page, "#etape-duree"):
        signaler("Étape 1 : l'étape Durée apparaît avant le choix de l'offre.")
    if not page.query_selector(".plan.actuel .plan-badge"):
        signaler("Étape 1 : l'offre actuelle n'est pas identifiable.")

    libelle = page.evaluate("() => document.querySelector('.plan.actuel [data-plan]').textContent.trim()")
    if libelle != "Renouveler":
        signaler(f"Étape 1 : l'offre actuelle propose « {libelle} » au lieu de « Renouveler ».")
    autre = page.evaluate("() => document.querySelector('.plan:not(.actuel) [data-plan]').textContent.trim()")
    if autre != "Passer à cette offre":
        signaler(f"Étape 1 : les autres offres proposent « {autre} ».")

    # --- Étape 2 : la durée, avec le vrai montant ET l'équivalent mensuel.
    page.click(".plan.actuel [data-plan]")
    page.wait_for_timeout(300)
    if not visible(page, "#etape-duree"):
        signaler("Étape 2 : la durée ne s'affiche pas après le choix de l'offre.")
    if visible(page, "#etape-mode"):
        signaler("Étape 2 : le mode de règlement apparaît avant le choix de la durée.")

    texte = page.evaluate("() => document.querySelector('[data-periode=annuel]').innerText")
    for attendu, quoi in [("324", "le montant réellement à payer"),
                          ("27", "l'équivalent mensuel"),
                          ("36", "l'économie réelle")]:
        if attendu not in texte:
            signaler(f"Étape 2 : {quoi} n'apparaît pas sur l'option annuelle ({texte!r}).")

    # Une économie ne doit JAMAIS être annoncée quand il n'y en a pas.
    mensuel = page.evaluate("() => document.querySelector('[data-periode=mensuel]').innerText")
    if "conomis" in mensuel:
        signaler("Étape 2 : une économie est annoncée sur l'offre mensuelle.")

    # --- Étape 3 : le mode, SANS le numéro ni le champ de référence.
    page.click("[data-periode=annuel]")
    page.wait_for_timeout(300)
    if not visible(page, "#etape-mode"):
        signaler("Étape 3 : le mode de règlement ne s'affiche pas.")
    if visible(page, "#etape-depot"):
        signaler("Étape 3 : l'étape Dépôt apparaît avant le choix du mode.")
    if occupe_de_la_place(page, "#numero-depot"):
        signaler("Étape 3 : le numéro de dépôt est visible avant que le dépôt soit choisi.")
    if occupe_de_la_place(page, "#reference"):
        signaler("Étape 3 : le champ de référence est visible avant l'étape Dépôt.")

    # --- Étape 4 : le dépôt, comme étape à part entière.
    page.click("#btn-depot")
    page.wait_for_timeout(500)
    if not visible(page, "#etape-depot"):
        signaler("Étape 4 : l'étape Dépôt ne s'affiche pas.")
    if not page.query_selector("#reference"):
        signaler("Étape 4 : le champ de référence est absent.")
    recap = page.evaluate("() => document.querySelector('#recap-depot').innerText")
    for attendu in ["Prime", "Annuel", "324"]:
        if attendu not in recap:
            signaler(f"Étape 4 : le récapitulatif n'affiche pas « {attendu} » ({recap!r}).")

    # --- Retour en arrière : les choix survivent (§6 du cahier des charges).
    page.click("[data-retour=mode]")
    page.wait_for_timeout(250)
    page.click("[data-retour=duree]")
    page.wait_for_timeout(250)
    actif = page.evaluate("() => { const e = document.querySelector('.periode-option.actif');"
                          " return e && e.dataset.periode; }")
    if actif != "annuel":
        signaler(f"Retour : la durée choisie est perdue (« {actif} »).")
    if not page.evaluate("() => !!document.querySelector('.plan.choisi')"):
        signaler("Retour : l'offre choisie est perdue.")

    ctx.close()


def auditer_tailles(navigateur):
    """Aucun débordement horizontal, aucun bouton hors écran."""
    for page_nom in ["abonnements.html", "support.html"]:
        for nom, largeur, hauteur in TAILLES:
            ctx = navigateur.new_context(viewport={"width": largeur, "height": hauteur})
            page = ctx.new_page()
            page.add_init_script(STUB)
            page.goto(f"file://{RACINE / page_nom}", wait_until="domcontentloaded")
            page.wait_for_timeout(400)

            debord = page.evaluate("() => document.documentElement.scrollWidth"
                                   " - document.documentElement.clientWidth")
            if debord > 1:
                signaler(f"{page_nom} — {nom} ({largeur}px) : défilement horizontal de {debord}px.")

            hors = page.evaluate("""() => {
              const sortis = [];
              document.querySelectorAll('button,input,textarea,select,a.bouton').forEach(e => {
                const r = e.getBoundingClientRect();
                if (r.width > 0 && r.right > window.innerWidth + 1) {
                  sortis.push((e.id || e.className || e.tagName) + ' (droite ' + Math.round(r.right) + 'px)');
                }
              });
              return sortis.slice(0, 3);
            }""")
            for element in hors:
                signaler(f"{page_nom} — {nom} : élément hors écran → {element}")

            ctx.close()


def auditer_themes(navigateur):
    """Chaque thème doit rendre la page lisible — le mode Nuit en particulier."""
    fonds = {}
    for theme in THEMES:
        ctx = navigateur.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        page.add_init_script(f"try {{ localStorage.setItem('ardoise_theme', '{theme}'); }} catch (e) {{}}")
        page.add_init_script(STUB)
        page.goto(f"file://{RACINE / 'abonnements.html'}", wait_until="domcontentloaded")
        page.wait_for_timeout(400)

        fond = page.evaluate("() => getComputedStyle(document.body).backgroundColor")
        texte = page.evaluate("() => getComputedStyle(document.body).color")
        fonds[theme] = fond

        if fond == texte:
            signaler(f"Thème {theme} : le texte a exactement la couleur du fond ({texte}).")
        # Un fond transparent signifie qu'aucun token n'a été appliqué : la page
        # emprunterait alors la couleur de ce qu'il y a derrière.
        if "rgba(0, 0, 0, 0)" in fond:
            signaler(f"Thème {theme} : le corps de page n'a pas de fond explicite.")
        ctx.close()

    if len(set(fonds.values())) < 3:
        signaler(f"Les thèmes rendent des fonds quasi identiques : {fonds}")
    return fonds


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("=" * 70)
        print("ÉCHEC TECHNIQUE — l'audit n'a pas pu s'exécuter.")
        print("=" * 70)
        print("\n  Playwright n'est pas installé. Cet audit mesure ce qui est")
        print("  RÉELLEMENT visible dans un navigateur : sans lui, rien n'est")
        print("  vérifié, et il NE DOIT PAS être considéré comme réussi.\n")
        print("      pip install playwright")
        print("      python3 -m playwright install chromium\n")
        return 2

    executable = executable_chromium()
    with sync_playwright() as p:
        navigateur = (p.chromium.launch(executable_path=executable, args=["--no-sandbox"])
                      if executable else p.chromium.launch(args=["--no-sandbox"]))
        auditer_divulgation(navigateur)
        auditer_tailles(navigateur)
        fonds = auditer_themes(navigateur)
        navigateur.close()

    print("=" * 70)
    print("AUDIT DU PARCOURS ABONNEMENT / SUPPORT")
    print("=" * 70)
    print(f"\n  Tailles testées : {', '.join(n for n, _, _ in TAILLES)}")
    print(f"  Thèmes testés   : {', '.join(THEMES)}")
    print(f"  Fond du thème Nuit : {fonds.get('nuit', '?')}\n")

    if anomalies:
        print(f"{len(anomalies)} ANOMALIE(S) :\n")
        for anomalie in dict.fromkeys(anomalies):
            print(f"  · {anomalie}")
        return 1

    print("  Divulgation progressive respectée à chaque étape.")
    print("  Aucun débordement horizontal, aucun bouton hors écran.")
    print("  Tous les thèmes rendent la page lisible.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
