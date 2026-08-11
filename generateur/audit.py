# -*- coding: utf-8 -*-
"""Contrôle du site produit. Sort en erreur si quelque chose ne tient pas."""

import json
import os
import re
import sys
from html.parser import HTMLParser

# Le dossier de sortie n'a PAS de valeur par défaut plausible, et c'est
# volontaire. La version précédente proposait "/home/claude/work/site" : un
# chemin propre à une machine, qui n'existe nulle part ailleurs. `os.walk` sur
# un dossier inexistant ne lève pas — il ne produit simplement aucun résultat.
# Le script parcourait donc zéro page et concluait :
#
#     0 fichiers HTML analysés
#     Aucun problème détecté.
#
# avec un code de sortie 0. Un site jamais construit se présentait comme un
# site parfaitement conforme.
SORTIE = os.environ.get("SORTIE")
# Le chemin du dépôt est lu dans l'environnement, comme dans build.py :
# la valeur en dur pointait vers un répertoire propre à la machine sur
# laquelle le script a été écrit, et audit.py s'arrêtait ailleurs.
SOURCE_HTML = os.environ.get("SOURCE_HTML",
                             os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import audit_commun as commun   # noqa: E402


def _resoudre_sortie():
    """Détermine le dossier du site GÉNÉRÉ, ou explique quoi faire.

    Ce dossier n'existe qu'APRÈS `build.py`. Auditer avant génération n'a aucun
    sens : il faut le dire, pas répondre « aucun problème ».
    """
    if len(sys.argv) > 1 and not sys.argv[1].startswith('-'):
        candidat = sys.argv[1]
    elif SORTIE:
        candidat = SORTIE
    else:
        # Emplacement conventionnel produit par build.py, à côté du générateur.
        candidat = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'site')

    if not os.path.isdir(candidat):
        raise commun.EchecTechnique(
            f"Dossier du site généré introuvable :\n"
            f"    {candidat}\n\n"
            f"  Ce dossier n'existe qu'APRÈS la génération. Construisez le site\n"
            f"  d'abord, puis relancez l'audit :\n\n"
            f"      python3 generateur/build.py\n"
            f"      python3 generateur/audit.py <dossier-de-sortie>\n\n"
            f"  Ou indiquez le dossier : SORTIE=/chemin/vers/site python3 generateur/audit.py")

    pages_trouvees = [os.path.join(r, f)
                      for r, _, fs in os.walk(candidat)
                      for f in fs if f.endswith('.html')]
    if not pages_trouvees:
        raise commun.EchecTechnique(
            f"Aucune page HTML dans {candidat}.\n\n"
            f"  L'audit n'a RIEN analysé. « 0 fichiers HTML analysés — aucun\n"
            f"  problème détecté » n'est pas un succès : c'est un site qui n'a\n"
            f"  pas été construit, ou un dossier de sortie erroné.")
    return candidat


try:
    SORTIE = _resoudre_sortie()
except commun.EchecTechnique as _e:
    print("ÉCHEC TECHNIQUE — l'audit du générateur n'a pas pu s'exécuter.\n")
    for _l in str(_e).split('\n'):
        print('  ' + _l)
    sys.exit(2)

pages = []
for racine, _, fichiers in os.walk(SORTIE):
    for f in fichiers:
        if f.endswith(".html"):
            pages.append(os.path.join(racine, f))
pages.sort()

problemes = []
titres, descriptions, h1s, canoniques = {}, {}, {}, {}
liens_internes = []


class Balises(HTMLParser):
    def __init__(self):
        super().__init__()
        self.pile = []
        self.erreurs = []
        self.auto = {"meta", "link", "br", "img", "input", "hr", "source", "col"}

    def handle_starttag(self, tag, attrs):
        if tag not in self.auto:
            self.pile.append(tag)

    def handle_endtag(self, tag):
        if tag in self.auto:
            return
        if not self.pile:
            self.erreurs.append(f"</{tag}> sans ouverture")
            return
        if self.pile[-1] == tag:
            self.pile.pop()
        elif tag in self.pile:
            while self.pile and self.pile[-1] != tag:
                self.erreurs.append(f"<{self.pile[-1]}> non fermé avant </{tag}>")
                self.pile.pop()
            if self.pile:
                self.pile.pop()
        else:
            self.erreurs.append(f"</{tag}> inattendu")


for chemin in pages:
    rel = os.path.relpath(chemin, SORTIE)
    contenu = open(chemin, encoding="utf-8").read()

    if 'meta name="robots" content="noindex' in contenu:
        continue  # redirections

    # --- structure
    p = Balises()
    p.feed(contenu)
    if p.erreurs or p.pile:
        problemes.append(f"{rel} : balisage — {(p.erreurs + ['non fermé: ' + t for t in p.pile])[:4]}")

    # --- unicité SEO
    t = re.search(r"<title>(.*?)</title>", contenu, re.S)
    d = re.search(r'<meta name="description" content="(.*?)"', contenu, re.S)
    c = re.search(r'<link rel="canonical" href="(.*?)"', contenu)
    h = re.findall(r"<h1[^>]*>(.*?)</h1>", contenu, re.S)

    if not t: problemes.append(f"{rel} : title manquant")
    if not d: problemes.append(f"{rel} : description manquante")
    if not c: problemes.append(f"{rel} : canonical manquant")
    if len(h) != 1: problemes.append(f"{rel} : {len(h)} H1")

    if t: titres.setdefault(t.group(1).strip(), []).append(rel)
    if d: descriptions.setdefault(d.group(1).strip(), []).append(rel)
    if h: h1s.setdefault(re.sub(r"<[^>]+>", "", h[0]).strip(), []).append(rel)
    if c: canoniques.setdefault(c.group(1), []).append(rel)

    if t and len(t.group(1)) > 65:
        problemes.append(f"{rel} : title {len(t.group(1))} caractères (> 65)")
    if d:
        n = len(d.group(1))
        if n > 165 or n < 70:
            problemes.append(f"{rel} : description {n} caractères (viser 70-165)")

    # --- hiérarchie des titres
    niveaux = [int(m) for m in re.findall(r"<h([1-6])[^>]*>", contenu)]
    corps = contenu.split('<main id="contenu">')[-1].split("</main>")[0]
    niveaux_corps = [int(m) for m in re.findall(r"<h([1-6])[^>]*>", corps)]
    precedent = 0
    for n in niveaux_corps:
        if precedent and n > precedent + 1:
            problemes.append(f"{rel} : saut de H{precedent} à H{n}")
            break
        precedent = n

    # --- JSON-LD
    for bloc in re.findall(r'<script type="application/ld\+json">(.*?)</script>', contenu, re.S):
        try:
            json.loads(bloc)
        except Exception as e:
            problemes.append(f"{rel} : JSON-LD invalide — {e}")

    # --- liens
    for href in re.findall(r'href="([^"#][^"]*)"', contenu):
        if href.startswith(("http", "mailto:", "tel:")):
            continue
        liens_internes.append((rel, href.split("#")[0].split("?")[0]))

for libelle, dico in (("title", titres), ("description", descriptions),
                      ("H1", h1s), ("canonical", canoniques)):
    for valeur, fichiers in dico.items():
        if len(fichiers) > 1:
            problemes.append(f"{libelle} en double : {fichiers} → {valeur[:60]}")

# --- cibles des liens
existants = set()
for racine, _, fichiers in os.walk(SORTIE):
    for f in fichiers:
        existants.add("/" + os.path.relpath(os.path.join(racine, f), SORTIE))
anciens = set("/" + f for f in os.listdir(SOURCE_HTML))

manquants = set()
for source, href in liens_internes:
    if not href or not href.startswith("/"):
        if href:
            manquants.add((source, href))
        continue
    cible = href
    if cible.endswith("/"):
        cible += "index.html"
    if cible not in existants and cible not in anciens:
        manquants.add((source, href))

for source, href in sorted(manquants):
    problemes.append(f"lien mort : {source} → {href}")

_rapport = commun.Rapport('generateur', depot='Scolaire-HTML-main', chemin_depot=SOURCE_HTML)
_rapport.fichier_examine(len(pages))
for _p in problemes:
    _rapport.constat(SORTIE, 'site_genere', _p, gravite='importante')
_rapport.message = f"{len(pages)} page(s) générée(s) analysée(s) dans {SORTIE}."
_rapport.afficher()

# Publication et JSON facultatifs, comme les autres audits.
if '--json' in sys.argv:
    _cible = sys.argv[sys.argv.index('--json') + 1]
    _rapport.ecrire_json(_cible)
    print(f"\nRapport JSON : {_cible}")
if '--publier' in sys.argv:
    commun.publier(_rapport.en_dict())

sys.exit(_rapport.code_sortie)
