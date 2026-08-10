# -*- coding: utf-8 -*-
"""
ARDOISE — ILLUSTRATIONS DU SITE PUBLIC.

POURQUOI DU SVG ÉCRIT À LA MAIN, ET PAS DES IMAGES
--------------------------------------------------
Le site a deux modes : le papier du cahier (clair) et le tableau de la classe
(sombre). Une image matricielle — PNG, JPEG, même WebP — est figée : celle qui
tient sur la craie devient illisible sur l'ardoise, et l'inverse. Il faudrait
donc deux fichiers par illustration, deux fois le poids, et un risque
permanent de divergence entre les deux versions.

Le SVG posé directement dans le HTML n'a pas ce défaut : ses traits héritent
du `color` de la page (`currentColor`) et ses aplats lisent les jetons
(`var(--accent)`, `var(--fond-2)`). Une seule illustration, deux rendus
corrects, zéro requête réseau supplémentaire, et un poids de l'ordre de 2 ko —
moins qu'une icône. Le basculement clair/sombre est instantané, sans clignoter.

LA RÈGLE DE DESSIN
------------------
Trait de 1,6 px, extrémités et jointures arrondies, aucun aplat sauf une
touche d'ocre par illustration — celle qui désigne l'objet dont parle le
texte à côté. Le vocabulaire est celui du produit : un registre, un bulletin,
une feuille d'appel, un reçu. Jamais de personnage souriant devant un
graphique qui monte.

OÙ ELLES VIVENT
---------------
Neuf illustrations, pas une de plus : deux sur l'accueil, une par page de
domaine. Les pages de tarifs, de services, la FAQ, la sécurité et le contact
n'en portent aucune — leur contenu est déjà structuré par des tableaux, des
prix et des questions, qui sont leur propre repère visuel.
"""


# --------------------------------------------------------------- Enveloppe

def figure(cle, alt, classe="illus-hero"):
    """Enveloppe une illustration.

    `alt` part dans `aria-label` et non dans un `<title>` : le SVG est
    décoratif, il redit ce que le texte voisin explique déjà. Un lecteur
    d'écran doit pouvoir le sauter, d'où `role="img"` accompagné d'un libellé
    court plutôt qu'une description longue qui ferait doublon.
    """
    svg = DESSINS[cle]
    return (f'<figure class="illus {classe}" aria-hidden="true">'
            f'<div class="illus-cadre">{svg}</div>'
            f'</figure>')


# ------------------------------------------------------------- Les dessins
#
# Chaque dessin est un SVG autonome, sans largeur ni hauteur fixes : la mise à
# l'échelle est faite par le CSS (`.illus svg { width: 100% }`), ce qui évite
# d'avoir à toucher au dessin quand une colonne change de largeur.

_OUVERTURE = ('<svg viewBox="0 0 {vb}" xmlns="http://www.w3.org/2000/svg" '
              'fill="none" stroke="currentColor" stroke-width="1.6" '
              'stroke-linecap="round" stroke-linejoin="round" '
              'role="img" focusable="false">')


def _svg(vb, corps):
    return _OUVERTURE.format(vb=vb) + corps + "</svg>"


# ---------------------------------------------------------------- Accueil 1
#
# L'école et Ardoise. Le bâtiment est reconnaissable en deux traits ; devant
# lui, l'écran qui porte la liste d'appel. L'ocre est sur l'écran : c'est lui
# le sujet, pas le bâtiment.

_ECOLE = _svg("400 280", """
<g opacity=".55">
  <path d="M40 196V120l64-34 64 34v76"/>
  <path d="M28 120 104 79l76 41"/>
  <path d="M104 79V50"/>
  <path d="M106 52h24l-10 9 10 9h-24Z" fill="var(--accent)" stroke="var(--accent)"/>
  <rect x="60" y="134" width="24" height="22" rx="2"/>
  <path d="M72 134v22M60 145h24" opacity=".7"/>
  <path d="M92 196v-30a12 12 0 0 1 24 0v30"/>
</g>
<path d="M24 196h352" opacity=".75"/>
<g>
  <rect x="150" y="96" width="200" height="128" rx="10" fill="var(--fond-2)"/>
  <path d="M150 122h200"/>
  <circle cx="166" cy="109" r="2.6" fill="currentColor" stroke="none" opacity=".5"/>
  <circle cx="176" cy="109" r="2.6" fill="currentColor" stroke="none" opacity=".5"/>
  <circle cx="186" cy="109" r="2.6" fill="currentColor" stroke="none" opacity=".5"/>
  <path d="M168 142h96" opacity=".8"/>
  <path d="M168 160h74" opacity=".55"/>
  <path d="M168 178h84" opacity=".55"/>
  <path d="M168 196h62" opacity=".55"/>
  <rect x="286" y="134" width="42" height="16" rx="4"
        fill="var(--accent)" stroke="var(--accent)" opacity=".9"/>
  <path d="M292 170h36" opacity=".45"/>
  <path d="M292 188h36" opacity=".45"/>
  <path d="M150 224h200" opacity=".9"/>
  <path d="M214 224v14h72v-14" opacity=".6"/>
  <path d="M198 238h104" opacity=".6"/>
</g>
""")


# ---------------------------------------------------------------- Accueil 2
#
# Douze cahiers, un seul dossier. C'est la thèse de la page, dessinée : à
# gauche des registres qui ne se parlent pas, à droite le dossier unique.
# Sans cette illustration, le paragraphe le plus important de l'accueil est
# un mur de texte.

_CAHIERS = _svg("440 260", """
<g opacity=".65">
  <g transform="rotate(-8 70 96)">
    <rect x="30" y="60" width="80" height="102" rx="4" fill="var(--fond-2)"/>
    <path d="M46 60v102" opacity=".7"/>
    <path d="M60 86h34M60 104h26M60 122h30"/>
  </g>
  <g transform="rotate(6 108 140)">
    <rect x="66" y="104" width="80" height="102" rx="4" fill="var(--fond-2)"/>
    <path d="M82 104v102" opacity=".7"/>
    <path d="M96 130h34M96 148h22M96 166h30"/>
  </g>
  <g transform="rotate(-3 44 176)">
    <rect x="14" y="150" width="76" height="96" rx="4" fill="var(--fond-2)"/>
    <path d="M29 150v96" opacity=".7"/>
    <path d="M42 174h32M42 192h20"/>
  </g>
</g>
<g opacity=".9">
  <path d="M188 130h48"/>
  <path d="M226 120l12 10-12 10"/>
</g>
<g>
  <path d="M266 74h58l12 16h72a8 8 0 0 1 8 8v104a8 8 0 0 1-8 8H266a8 8 0 0 1-8-8V82a8 8 0 0 1 8-8Z"
        fill="var(--fond-2)"/>
  <path d="M258 116h158" opacity=".5"/>
  <path d="M286 140h72"/>
  <path d="M286 162h104" opacity=".6"/>
  <path d="M286 184h52" opacity=".6"/>
  <circle cx="386" cy="172" r="20" fill="var(--accent)" stroke="var(--accent)" opacity=".16"/>
  <path d="M377 172l6 7 12-14" stroke="var(--accent)" stroke-width="2.2"/>
</g>
""")


# ------------------------------------------------------ Gestion scolaire
#
# Les six rôles. La page les décrit déjà dans un tableau, exhaustif mais
# plat : on y lit qui fait quoi, on n'y voit pas que l'accès est cloisonné.
# Le dessin montre le cloisonnement — six périmètres distincts sous une même
# école — ce que le tableau ne peut pas faire.

_ROLES = _svg("400 300", """
<g opacity=".8">
  <rect x="16" y="24" width="368" height="252" rx="14"/>
  <path d="M16 62h368" opacity=".7"/>
  <path d="M44 44h84" opacity=".45"/>
</g>
<g opacity=".45" stroke-dasharray="5 6">
  <path d="M138 74v192M262 74v192"/>
  <path d="M26 170h348"/>
</g>
<g>
  <circle cx="76" cy="106" r="11" opacity=".75"/>
  <path d="M60 134a16 16 0 0 1 32 0" opacity=".75"/>
  <path d="M46 150h60" opacity=".4"/>
  <rect x="66" y="88" width="20" height="7" rx="3"
        fill="var(--accent)" stroke="var(--accent)"/>
</g>
<g>
  <circle cx="200" cy="106" r="11" opacity=".75"/>
  <path d="M184 134a16 16 0 0 1 32 0" opacity=".75"/>
  <path d="M170 150h60" opacity=".4"/>
  <rect x="190" y="88" width="20" height="7" rx="3"
        fill="var(--accent)" stroke="var(--accent)" opacity=".65"/>
</g>
<g>
  <circle cx="324" cy="106" r="11" opacity=".75"/>
  <path d="M308 134a16 16 0 0 1 32 0" opacity=".75"/>
  <path d="M294 150h60" opacity=".4"/>
  <rect x="314" y="88" width="20" height="7" rx="3"
        fill="var(--accent)" stroke="var(--accent)" opacity=".65"/>
</g>
<g>
  <circle cx="76" cy="206" r="11" opacity=".75"/>
  <path d="M60 234a16 16 0 0 1 32 0" opacity=".75"/>
  <path d="M46 250h60" opacity=".4"/>
  <rect x="66" y="188" width="20" height="7" rx="3"
        fill="var(--accent)" stroke="var(--accent)" opacity=".65"/>
</g>
<g>
  <circle cx="200" cy="206" r="11" opacity=".75"/>
  <path d="M184 234a16 16 0 0 1 32 0" opacity=".75"/>
  <path d="M170 250h60" opacity=".4"/>
  <rect x="190" y="188" width="20" height="7" rx="3"
        fill="var(--accent)" stroke="var(--accent)" opacity=".65"/>
</g>
<g>
  <circle cx="324" cy="206" r="11" opacity=".75"/>
  <path d="M308 234a16 16 0 0 1 32 0" opacity=".75"/>
  <path d="M294 250h60" opacity=".4"/>
  <rect x="314" y="188" width="20" height="7" rx="3"
        fill="var(--accent)" stroke="var(--accent)" opacity=".65"/>
</g>
""")


# ------------------------------------------------------- Notes et bulletins
#
# Le bulletin. C'est l'objet que le directeur cherche des yeux quand il
# évalue une plateforme scolaire ; le montrer d'emblée vaut mieux que trois
# paragraphes sur la pondération des moyennes.

_BULLETIN = _svg("400 300", """
<g opacity=".45">
  <rect x="46" y="34" width="220" height="240" rx="8" fill="var(--fond-2)"/>
</g>
<g>
  <rect x="70" y="18" width="240" height="264" rx="8" fill="var(--fond-2)"/>
  <path d="M100 44h84" opacity=".55"/>
  <circle cx="190" cy="52" r="14" opacity=".45"/>
  <path d="M184 52l5 5 8-10" opacity=".45"/>
  <path d="M100 62h60" opacity=".35"/>
  <path d="M70 86h240" opacity=".7"/>

  <path d="M96 110h108M240 110h44" opacity=".8"/>
  <path d="M96 136h124M240 136h44" opacity=".45"/>
  <path d="M96 160h96M240 160h44" opacity=".45"/>
  <path d="M96 184h132M240 184h44" opacity=".45"/>
  <path d="M96 208h88M240 208h44" opacity=".45"/>
  <path d="M226 96v128" opacity=".4"/>

  <rect x="90" y="230" width="132" height="26" rx="6"
        fill="var(--accent)" stroke="var(--accent)" opacity=".14"/>
  <path d="M104 243h48" stroke="var(--accent)" stroke-width="2"/>
  <path d="M186 236h22M186 250h22" stroke="var(--accent)" stroke-width="2" opacity=".8"/>
</g>
<g opacity=".8">
  <circle cx="316" cy="238" r="34" stroke-dasharray="4 5"/>
  <path d="M296 240c10-14 16 12 24-2s12 6 18-4" stroke="var(--accent)" stroke-width="2"/>
</g>
""")


# ------------------------------------------------------------- Vie scolaire
#
# L'appel du matin, fait sur un téléphone qui a perdu le réseau. Le nuage
# barré est le seul détail qui compte : c'est l'argument que les écoles
# retiennent, et il ne se voit nulle part ailleurs sur la page.

_APPEL = _svg("400 300", """
<g>
  <rect x="112" y="14" width="176" height="272" rx="18" fill="var(--fond-2)"/>
  <path d="M112 56h176" opacity=".6"/>
  <path d="M172 32h56" opacity=".5"/>
  <path d="M112 250h176" opacity=".6"/>
  <path d="M182 268h36" opacity=".4"/>

  <g>
    <path d="M140 88h56" opacity=".75"/>
    <rect x="238" y="78" width="20" height="20" rx="5" fill="var(--accent)" stroke="var(--accent)"/>
    <path d="M243 88l4 4 7-8" stroke="var(--fond-2)" stroke-width="2"/>
  </g>
  <g>
    <path d="M140 126h44" opacity=".75"/>
    <rect x="238" y="116" width="20" height="20" rx="5" fill="var(--accent)" stroke="var(--accent)"/>
    <path d="M243 126l4 4 7-8" stroke="var(--fond-2)" stroke-width="2"/>
  </g>
  <g opacity=".8">
    <path d="M140 164h62"/>
    <rect x="238" y="154" width="20" height="20" rx="5"/>
    <path d="M244 160l8 8M252 160l-8 8" opacity=".8"/>
  </g>
  <g>
    <path d="M140 202h50" opacity=".75"/>
    <rect x="238" y="192" width="20" height="20" rx="5" fill="var(--accent)" stroke="var(--accent)"/>
    <path d="M243 202l4 4 7-8" stroke="var(--fond-2)" stroke-width="2"/>
  </g>
  <path d="M132 106h136M132 144h136M132 182h136" opacity=".2"/>
</g>
<g opacity=".7">
  <path d="M40 96a20 20 0 0 1 38-7 15 15 0 0 1 1 30H50a16 16 0 0 1-10-23Z"/>
  <path d="M34 74l52 52" stroke="var(--accent)" stroke-width="2.2"/>
</g>
<g opacity=".6">
  <circle cx="336" cy="212" r="26"/>
  <path d="M336 196v16l11 7"/>
</g>
""")


# ------------------------------------------------------------------ Finances
#
# Le reçu numéroté et la double devise. Deux choses qu'aucune école ne trouve
# dans un logiciel importé, et qui se lisent en une seconde sur un dessin.

_RECU = _svg("400 300", """
<g>
  <path d="M92 26h176v226l-22-14-22 14-22-14-22 14-22-14-22 14-22-14-22 14Z"
        fill="var(--fond-2)"/>
  <path d="M118 58h124" opacity=".7"/>
  <path d="M118 78h72" opacity=".35"/>
  <path d="M92 100h176" opacity=".5" stroke-dasharray="4 5"/>
  <path d="M118 126h84M222 126h22" opacity=".45"/>
  <path d="M118 150h64M214 150h30" opacity=".45"/>
  <path d="M118 174h92M206 174h38" opacity=".45"/>
  <path d="M92 196h176" opacity=".5" stroke-dasharray="4 5"/>
  <path d="M118 220h50" opacity=".8"/>
  <rect x="190" y="208" width="56" height="24" rx="5"
        fill="var(--accent)" stroke="var(--accent)" opacity=".16"/>
  <path d="M202 220h32" stroke="var(--accent)" stroke-width="2.2"/>
</g>
<g opacity=".8">
  <circle cx="52" cy="188" r="30"/>
  <path d="M52 168v40"/>
  <path d="M61 177a9 9 0 0 0-9-6h-4a8 8 0 0 0 0 16h8a8 8 0 0 1 0 16h-4a9 9 0 0 1-9-6"/>
</g>
<g opacity=".8">
  <circle cx="336" cy="116" r="30"/>
  <path d="M330 102h-14v28"/>
  <path d="M316 116h11"/>
  <path d="M356 105a13 13 0 1 0 0 22"/>
</g>
""")


# ---------------------------------------------------- Admissions/orientation
#
# Le classement au mérite, puis l'affectation. La page parle de concours et
# de vœux : ce qui la distingue est que l'ordre du classement décide de
# l'affectation, et c'est exactement ce que la flèche montre.

_CONCOURS = _svg("400 300", """
<g>
  <rect x="24" y="42" width="176" height="216" rx="10" fill="var(--fond-2)"/>
  <path d="M24 74h176" opacity=".6"/>
  <path d="M48 58h72" opacity=".5"/>
  <g>
    <circle cx="52" cy="104" r="11" fill="var(--accent)" stroke="var(--accent)" opacity=".2"/>
    <path d="M49 108v-8l-3 2" stroke="var(--accent)" stroke-width="1.8"/>
    <path d="M76 100h84" opacity=".8"/>
    <path d="M76 112h34" opacity=".4"/>
  </g>
  <g opacity=".7">
    <circle cx="52" cy="150" r="11"/>
    <path d="M48 146a4 4 0 1 1 6 4l-6 6h8"/>
    <path d="M76 146h68"/>
    <path d="M76 158h30" opacity=".55"/>
  </g>
  <g opacity=".55">
    <circle cx="52" cy="196" r="11"/>
    <path d="M48 191h7l-4 5a4 4 0 1 1-3 6"/>
    <path d="M76 192h76"/>
    <path d="M76 204h26" opacity=".7"/>
  </g>
  <path d="M76 236h58" opacity=".28"/>
</g>
<g opacity=".9">
  <path d="M218 150h44"/>
  <path d="M252 140l12 10-12 10"/>
</g>
<g>
  <rect x="280" y="66" width="96" height="70" rx="9" fill="var(--fond-2)"/>
  <path d="M302 94h52" opacity=".75"/>
  <path d="M302 112h34" opacity=".4"/>
  <path d="M280 66h6" stroke="var(--accent)" stroke-width="4"/>
</g>
<g>
  <rect x="280" y="164" width="96" height="70" rx="9" fill="var(--fond-2)"/>
  <path d="M302 192h52" opacity=".75"/>
  <path d="M302 210h34" opacity=".4"/>
  <path d="M280 164h6" stroke="var(--accent)" stroke-width="4"/>
</g>
""")


# ------------------------------------------------- Direction et pilotage
#
# Ce que le directeur regarde. Des barres, une courbe, un effectif : le
# tableau de bord est un objet visuel par nature, le décrire en prose est le
# seul cas où le texte est moins clair que le dessin.

_PILOTAGE = _svg("400 300", """
<g>
  <rect x="20" y="26" width="360" height="248" rx="12" fill="var(--fond-2)"/>
  <path d="M20 62h360" opacity=".6"/>
  <circle cx="40" cy="44" r="3" fill="currentColor" stroke="none" opacity=".4"/>
  <circle cx="52" cy="44" r="3" fill="currentColor" stroke="none" opacity=".4"/>
  <path d="M74 44h70" opacity=".4"/>
</g>
<g>
  <rect x="42" y="86" width="140" height="72" rx="8"/>
  <path d="M62 110h44" opacity=".45"/>
  <path d="M62 136h58" stroke="var(--accent)" stroke-width="3"/>
</g>
<g>
  <rect x="200" y="86" width="158" height="72" rx="8"/>
  <path d="M220 142v-16M240 142v-30M260 142v-22M280 142v-38"
        opacity=".55" stroke-width="5"/>
  <path d="M300 142v-46M320 142v-26M340 142v-34"
        stroke="var(--accent)" stroke-width="5" opacity=".85"/>
  <path d="M212 148h134" opacity=".4"/>
</g>
<g>
  <rect x="42" y="180" width="316" height="72" rx="8"/>
  <path d="M62 232l40-24 34 14 38-34 42 18 36-30 46 12"/>
  <circle cx="102" cy="208" r="3.4" fill="var(--accent)" stroke="var(--accent)"/>
  <circle cx="212" cy="192" r="3.4" fill="var(--accent)" stroke="var(--accent)"/>
  <circle cx="298" cy="176" r="3.4" fill="var(--accent)" stroke="var(--accent)"/>
  <path d="M62 200h6M62 216h6M62 232h6" opacity=".3"/>
</g>
""")


# ------------------------------------------------------------------------ IA
#
# L'IA propose, l'humain valide. La page insiste sur le fait qu'aucune
# décision pédagogique n'est prise par la machine ; le bouton de validation
# posé sous la phrase suggérée le dit plus vite qu'un paragraphe.

_IA = _svg("400 300", """
<g opacity=".55">
  <path d="M58 74l6-16 6 16 16 6-16 6-6 16-6-16-16-6Z"
        fill="var(--accent)" stroke="var(--accent)"/>
  <path d="M96 44l3.5-9 3.5 9 9 3.5-9 3.5-3.5 9-3.5-9-9-3.5Z"
        fill="var(--accent)" stroke="var(--accent)" opacity=".7"/>
</g>
<g>
  <rect x="46" y="112" width="308" height="86" rx="10" fill="var(--fond-2)"/>
  <path d="M46 112h6" stroke="var(--accent)" stroke-width="4"/>
  <path d="M72 140h224" opacity=".55" stroke-dasharray="6 5"/>
  <path d="M72 160h256" opacity=".55" stroke-dasharray="6 5"/>
  <path d="M72 180h148" opacity=".55" stroke-dasharray="6 5"/>
</g>
<g>
  <rect x="46" y="222" width="118" height="34" rx="8"
        fill="var(--accent)" stroke="var(--accent)" opacity=".16"/>
  <path d="M70 239l7 8 14-16" stroke="var(--accent)" stroke-width="2.2"/>
  <path d="M102 239h40" stroke="var(--accent)" stroke-width="2" opacity=".85"/>
</g>
<g opacity=".75">
  <rect x="180" y="222" width="118" height="34" rx="8"/>
  <path d="M204 246l4-12 22-22 8 8-22 22Z"/>
  <path d="M248 239h34" opacity=".7"/>
</g>
""")


DESSINS = {
    "ecole": _ECOLE,
    "cahiers": _CAHIERS,
    "roles": _ROLES,
    "bulletin": _BULLETIN,
    "appel": _APPEL,
    "recu": _RECU,
    "concours": _CONCOURS,
    "pilotage": _PILOTAGE,
    "ia": _IA,
}
