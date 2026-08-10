# -*- coding: utf-8 -*-
"""Contrôle du site produit. Sort en erreur si quelque chose ne tient pas."""

import json
import os
import re
import sys
from html.parser import HTMLParser

SORTIE = os.environ.get("SORTIE", "/home/claude/work/site")
# Le chemin du dépôt est lu dans l'environnement, comme dans build.py :
# la valeur en dur pointait vers un répertoire propre à la machine sur
# laquelle le script a été écrit, et audit.py s'arrêtait ailleurs.
SOURCE_HTML = os.environ.get("SOURCE_HTML",
                             os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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

print(f"{len(pages)} fichiers HTML analysés")
if problemes:
    print(f"\n{len(problemes)} problème(s) :")
    for p in problemes:
        print("  · " + p)
    sys.exit(1)
print("Aucun problème détecté.")
