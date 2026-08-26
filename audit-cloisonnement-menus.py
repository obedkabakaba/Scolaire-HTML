#!/usr/bin/env python3
"""
Régression statique du cloisonnement des espaces.

Le défaut d'origine n'était pas « Abonnements » : c'était la DUPLICATION.
La même question — « quel rôle ouvre quelle page ? » — était répondue dans
trente blocs `gererAccesParRole` recopiés à la main, dans `ROLES_NAVIGATION`
de ui.js, dans la garde d'abonnements-page.js et dans connexion.html. Il a
suffi qu'une copie oublie une ligne pour qu'un Professeur voie l'entrée
« Abonnements », arrive sur une page qui affichait le rail COMPLET du
Directeur, et y trouve Élèves, Comptabilité, Utilisateurs, Journal et
Paramètres.

Cet audit ne vérifie donc pas une page : il vérifie qu'il n'existe plus
qu'UNE table, que personne n'en a refait une copie, et qu'aucun rail ne
s'affiche avant d'avoir été trié.

    python3 audit-cloisonnement-menus.py
"""
import pathlib
import re
import sys

RACINE = pathlib.Path(__file__).resolve().parent

# Pages hors application : site public, connexion, aperçus imprimables et
# console Super Admin. Elles ne portent pas le rail métier.
HORS_APPLICATION = {
    'index.html', 'connexion.html', 'site-public.html', 'services.html',
    'tarifs.html', 'super-admin.html', 'reinitialiser-mot-de-passe.html',
    'changer-mot-de-passe.html', 'journal.html',
}


def lire(nom):
    return (RACINE / nom).read_text(encoding='utf-8')


def table_partagee():
    """Extrait ROLES_PAR_PAGE et PAGES_OUVERTES de session.js."""
    session = lire('session.js')
    bloc = re.search(r'var ROLES_PAR_PAGE = \{(.*?)\n  \};', session, re.S)
    ouvertes = re.search(r'var PAGES_OUVERTES = \[(.*?)\];', session, re.S)
    if not bloc or not ouvertes:
        return None, None
    table = {}
    for page, roles in re.findall(r"'([a-z0-9\-]+\.html)':\s*\[([^\]]*)\]", bloc.group(1)):
        table[page] = sorted(re.findall(r"'([a-z_]+)'", roles))
    return table, set(re.findall(r"'([a-z0-9\-]+\.html)'", ouvertes.group(1)))


def pages_avec_rail():
    for chemin in sorted(RACINE.glob('*.html')):
        texte = chemin.read_text(encoding='utf-8')
        if 'class="nav-liste"' in texte:
            yield chemin.name, texte


def hrefs_du_rail(texte):
    liens = set()
    for balise in re.finditer(r'<a\b[^>]*>', texte):
        if 'nav-item' not in balise.group(0):
            continue
        href = re.search(r'href="([^"]+)"', balise.group(0))
        if href and not href.group(1).startswith('#'):
            liens.add(href.group(1).split('/')[-1].lower())
    return liens


def main():
    erreurs = []
    table, ouvertes = table_partagee()

    if table is None:
        print('ÉCHEC — session.js n’expose plus de table ROLES_PAR_PAGE')
        return 1

    session = lire('session.js')
    ui = lire('ui.js')
    page_abo = lire('abonnements-page.js')
    connexion = lire('connexion.html')

    # 1. La table est bien publiée, et elle est la seule.
    if 'window.ArdoiseAcces' not in session:
        erreurs.append('session.js ne publie pas window.ArdoiseAcces')
    if 'var ROLES_NAVIGATION' in ui:
        erreurs.append('ui.js a refait une copie de la table (ROLES_NAVIGATION)')
    if 'abonnements.html' not in table:
        erreurs.append('« abonnements.html » ne figure pas dans la table partagée')
    elif table['abonnements.html'] != ['directeur']:
        erreurs.append('« abonnements.html » n’est plus réservée au Directeur : '
                       + str(table['abonnements.html']))

    # 2. Les gardes de page lisent la table au lieu d’en garder une copie.
    for nom, texte in pages_avec_rail():
        if 'const permissions = {' in texte or 'var permissions = {' in texte:
            erreurs.append(f'{nom} : copie locale de la table des rôles')
        if 'gererAccesParRole' in texte and 'ArdoiseAcces' not in texte:
            erreurs.append(f'{nom} : garde de page qui ne lit pas la table partagée')

    # 3. Aucun rail ne s’affiche avant d’avoir été trié.
    #    C’est la faille telle qu’elle était visible : `support.html` et
    #    `abonnements.html` peignaient le rail entier du Directeur dès la
    #    première image, à tout rôle qui les ouvrait.
    for nom, texte in pages_avec_rail():
        if not re.search(r'\.nav-liste\s*\{[^}]*visibility:\s*hidden', texte):
            erreurs.append(f'{nom} : rail affiché avant le filtrage par rôle')

    # 4. Toute entrée de rail est décrite quelque part.
    for nom, texte in pages_avec_rail():
        for href in sorted(hrefs_du_rail(texte)):
            if href not in table and href not in ouvertes:
                erreurs.append(f'{nom} : « {href} » n’est décrite ni dans la table '
                               'ni dans les pages ouvertes')

    # 5. Chaque page à rail charge la table AVANT sa garde, et la garde
    #    universelle de ui.js.
    for nom, texte in pages_avec_rail():
        if 'src="session.js"' not in texte:
            erreurs.append(f'{nom} : ne charge pas session.js, la table est absente')
        if 'src="ui.js"' not in texte:
            erreurs.append(f'{nom} : ne charge pas ui.js, pas de garde d’URL')

    # 6. La garde d’URL universelle existe et s’exécute en premier.
    if 'function verrouillerPageCourante' not in ui:
        erreurs.append('ui.js n’a plus de garde d’URL universelle')
    elif not re.search(r'function demarrer\(\) \{[^}]*?verrouillerPageCourante\(\)', ui, re.S):
        erreurs.append('la garde d’URL de ui.js ne s’exécute pas au démarrage')

    # 7. La garde de la page Abonnements lit la même règle.
    if 'ArdoiseAcces.peutGererAbonnements' not in page_abo:
        erreurs.append('abonnements-page.js ne lit pas la règle partagée')
    if 'location.replace' not in page_abo:
        erreurs.append('abonnements-page.js ne renvoie plus les rôles interdits')

    # 8. connexion.html se charge sans session.js : sa règle est écrite en
    #    clair, mais elle doit dire la même chose que la table.
    redirection = re.search(
        r'function routerAccesBloque\(.*?\n  \}', connexion, re.S)
    if not redirection:
        erreurs.append('connexion.html : routerAccesBloque introuvable')
    else:
        vers_abo = re.search(
            r"if \((.*?)\) \{\s*window\.location\.href = 'abonnements\.html';",
            redirection.group(0), re.S)
        if not vers_abo:
            erreurs.append('connexion.html : plus de redirection vers Abonnements')
        else:
            roles_connexion = set(re.findall(r"'([a-z_]+)'", vers_abo.group(1)))
            attendus = set(table.get('abonnements.html', [])) | {'super_admin'}
            if roles_connexion != attendus:
                erreurs.append(
                    'connexion.html envoie ' + str(sorted(roles_connexion))
                    + ' sur Abonnements, la table dit ' + str(sorted(attendus)))

    # 9. L’écran de blocage de session.js ne propose pas l’abonnement à tous.
    if 'if (peutGerer) actions.appendChild(abonnements)' not in session:
        erreurs.append('l’écran de blocage propose l’abonnement à tous les rôles')

    if erreurs:
        print('ÉCHEC — cloisonnement des espaces')
        for erreur in erreurs:
            print('  ·', erreur)
        return 1

    print(f'OK — une seule table ({len(table)} écrans), '
          f'{len(list(pages_avec_rail()))} rails fermés par défaut')
    return 0


if __name__ == '__main__':
    sys.exit(main())
