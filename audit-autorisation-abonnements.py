#!/usr/bin/env python3
"""Régression statique de la frontière Professeur / Abonnements."""
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

    exiger("directionSeulement: true" in ui,
           "l'entrée Abonnements n'est pas marquée Direction seule", erreurs)
    exiger("'abonnements.html': ['directeur']" in ui
           and "filtrerNavigationParRole();" in ui,
           "les pages transversales ne filtrent pas le rail complet par rôle", erreurs)
    exiger("fetch(baseApi() + '/abonnements/droits'" in ui,
           "les menus lisent encore l'abonnement commercial complet", erreurs)
    exiger("if (!peutGerer)" in page and "location.replace(accueil)" in page,
           "l'URL abonnements.html ne redirige pas les rôles interdits", erreurs)
    exiger("if (peutGerer) actions.appendChild(abonnements)" in session,
           "l'écran de blocage propose encore l'abonnement à tous les rôles", erreurs)
    exiger(re.search(r"rolesPage\.indexOf\('directeur'\).*rolesPage\.indexOf\('super_admin'\)",
                     page, re.S) is not None,
           "la garde de page n'autorise pas explicitement Direction/Super Admin", erreurs)

    if erreurs:
        print("ÉCHEC — autorisation Abonnements")
        for erreur in erreurs:
            print("  ·", erreur)
        return 1
    print("OK — Professeur séparé de la gestion des abonnements")
    return 0


if __name__ == "__main__":
    sys.exit(main())
