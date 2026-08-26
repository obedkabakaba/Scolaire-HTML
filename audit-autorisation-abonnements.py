#!/usr/bin/env python3
"""
Régression nommée : la frontière Professeur / Abonnements.

Ce fichier ne vérifie qu'une chose, mais il la vérifie de bout en bout, du
menu jusqu'à l'URL tapée à la main. Le cloisonnement dans son ensemble est
couvert par `audit-cloisonnement-menus.py` ; celui-ci existe pour que le
défaut précis qui a été signalé — « le professeur voyait le menu Abonnement,
et ça lui donnait accès à l'espace réservé à d'autres » — ait son propre
témoin, avec son propre message d'échec.

    python3 audit-autorisation-abonnements.py
"""
import pathlib
import re
import sys

RACINE = pathlib.Path(__file__).resolve().parent


def lire(nom):
    return (RACINE / nom).read_text(encoding="utf-8")


def exiger(condition, message, erreurs):
    if not condition:
        erreurs.append(message)


def main():
    erreurs = []
    ui = lire("ui.js")
    session = lire("session.js")
    page = lire("abonnements-page.js")
    abonnements_html = lire("abonnements.html")
    support_html = lire("support.html")

    # 1. La règle existe, à un seul endroit, et dit « Direction ».
    exiger(re.search(r"'abonnements\.html': \['directeur'\]", session) is not None,
           "la table partagée ne réserve plus Abonnements au Directeur", erreurs)
    exiger("window.ArdoiseAcces" in session,
           "session.js ne publie pas la table partagée", erreurs)
    exiger("var ROLES_NAVIGATION" not in ui,
           "ui.js a refait une copie de la table : elle divergera", erreurs)

    # 2. L'entrée de menu ne s'écrit pas pour qui ne peut pas y aller.
    exiger("directionSeulement: true" in ui,
           "l'entrée Abonnements n'est plus marquée Direction seule", erreurs)
    exiger("if (entree.directionSeulement && !peutGererAbonnements()) return;" in ui,
           "l'entrée Abonnements est injectée sans vérifier le rôle", erreurs)
    exiger("function peutGererAbonnements" in ui
           and "peutVoirPage('abonnements.html'" in ui,
           "ui.js ne déduit plus le droit d'abonnement de la table", erreurs)

    # 3. L'URL tapée à la main est refusée — deux fois, par la page et par ui.js.
    exiger("ArdoiseAcces.peutGererAbonnements(rolesPage)" in page
           and "location.replace(" in page,
           "l'URL abonnements.html ne renvoie plus les rôles interdits", erreurs)
    exiger("function verrouillerPageCourante" in ui,
           "ui.js n'a plus de garde d'URL universelle", erreurs)

    # 4. Le rail de la page ne se montre pas avant d'avoir été trié. C'est
    #    par là que le Professeur atteignait Élèves, Comptabilité, Journal.
    for nom, texte in (("abonnements.html", abonnements_html),
                       ("support.html", support_html)):
        exiger(re.search(r"\.nav-liste\s*\{[^}]*visibility:\s*hidden", texte) is not None,
               f"{nom} peint le rail complet du Directeur avant tout filtrage",
               erreurs)

    # 5. Les menus lisent les droits fonctionnels, pas le dossier commercial.
    exiger("fetch(baseApi() + '/abonnements/droits'" in ui,
           "les menus lisent encore l'abonnement commercial complet", erreurs)

    # 6. L'écran de blocage ne propose pas de payer à qui ne le peut pas.
    exiger("if (peutGerer) actions.appendChild(abonnements)" in session,
           "l'écran de blocage propose encore l'abonnement à tous les rôles", erreurs)

    if erreurs:
        print("ÉCHEC — autorisation Abonnements")
        for erreur in erreurs:
            print("  ·", erreur)
        return 1
    print("OK — Professeur séparé de la gestion des abonnements")
    return 0


if __name__ == "__main__":
    sys.exit(main())
