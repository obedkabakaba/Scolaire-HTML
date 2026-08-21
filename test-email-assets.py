#!/usr/bin/env python3
"""Vérifie les illustrations adaptatives des e-mails Ardoise, sans dépendance."""

from pathlib import Path
import struct
import zlib


DOSSIER = Path("public/email/adaptive")
ATTENDUS = {
    "abo-active.png",
    "abo-expire.png",
    "abo-renouvele.png",
    "bienvenue.png",
    "bulletin.png",
    "demande.png",
    "eleve-ajoute.png",
    "essai-active.png",
    "essai-fin-proche.png",
    "essai-termine.png",
    "maintenance.png",
    "mdp-change.png",
    "nouveau-compte.png",
    "nouvelle-fonction.png",
    "prof-ajoute.png",
    "reset-mdp.png",
    "verif-email.png",
}


def paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    return a if pa <= pb and pa <= pc else b if pb <= pc else c


def lire_alpha(chemin):
    donnees = chemin.read_bytes()
    assert donnees[:8] == b"\x89PNG\r\n\x1a\n", f"{chemin}: signature PNG invalide"

    position = 8
    idat = bytearray()
    largeur = hauteur = profondeur = couleur = entrelacement = None
    while position < len(donnees):
        taille = struct.unpack(">I", donnees[position:position + 4])[0]
        type_chunk = donnees[position + 4:position + 8]
        contenu = donnees[position + 8:position + 8 + taille]
        position += taille + 12
        if type_chunk == b"IHDR":
            largeur, hauteur, profondeur, couleur, _, _, entrelacement = struct.unpack(
                ">IIBBBBB", contenu
            )
        elif type_chunk == b"IDAT":
            idat.extend(contenu)
        elif type_chunk == b"IEND":
            break

    assert (largeur, hauteur) == (640, 640), f"{chemin}: dimensions {largeur}×{hauteur}"
    assert profondeur == 8 and couleur == 6, f"{chemin}: le PNG doit être RGBA 8 bits"
    assert entrelacement == 0, f"{chemin}: entrelacement PNG non pris en charge"

    brut = zlib.decompress(bytes(idat))
    octets_pixel = 4
    longueur_ligne = largeur * octets_pixel
    precedent = bytearray(longueur_ligne)
    alphas = []
    curseur = 0

    for _ in range(hauteur):
        filtre = brut[curseur]
        curseur += 1
        source = brut[curseur:curseur + longueur_ligne]
        curseur += longueur_ligne
        ligne = bytearray(longueur_ligne)

        for i, valeur in enumerate(source):
            gauche = ligne[i - octets_pixel] if i >= octets_pixel else 0
            haut = precedent[i]
            haut_gauche = precedent[i - octets_pixel] if i >= octets_pixel else 0
            if filtre == 0:
                corrige = valeur
            elif filtre == 1:
                corrige = (valeur + gauche) & 255
            elif filtre == 2:
                corrige = (valeur + haut) & 255
            elif filtre == 3:
                corrige = (valeur + ((gauche + haut) // 2)) & 255
            elif filtre == 4:
                corrige = (valeur + paeth(gauche, haut, haut_gauche)) & 255
            else:
                raise AssertionError(f"{chemin}: filtre PNG inconnu {filtre}")
            ligne[i] = corrige

        alphas.extend(ligne[3::4])
        precedent = ligne

    transparents = sum(alpha == 0 for alpha in alphas)
    opaques = sum(alpha >= 240 for alpha in alphas)
    total = largeur * hauteur
    assert transparents >= total * 0.10, f"{chemin}: fond non réellement transparent"
    assert opaques >= total * 0.05, f"{chemin}: sujet presque entièrement transparent"
    assert all(alphas[i] == 0 for i in (0, largeur - 1, total - largeur, total - 1)), (
        f"{chemin}: les quatre coins doivent être transparents"
    )


def main():
    trouves = {p.name for p in DOSSIER.glob("*.png")}
    manquants = ATTENDUS - trouves
    inattendus = trouves - ATTENDUS
    assert not manquants, f"Illustrations e-mail manquantes : {sorted(manquants)}"
    assert not inattendus, f"Ajouter les nouveaux visuels au contrôle : {sorted(inattendus)}"

    for nom in sorted(ATTENDUS):
        lire_alpha(DOSSIER / nom)
        print(f"OK {nom}")

    print(f"{len(ATTENDUS)} illustrations adaptatives valides.")


if __name__ == "__main__":
    main()
