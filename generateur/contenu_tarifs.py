# -*- coding: utf-8 -*-
"""
TARIFS — deux pages, deux intentions.

/tarifs/          → « combien ça coûte » : les quatre offres, leur prix, leur cible.
/tarifs/comparer/ → « laquelle prendre » : le tableau ligne par ligne.

Les prix sont écrits dans le HTML autant que rafraîchis par l'API : un moteur
de recherche ne lit pas catalogue.js. Les attributs data- restent identiques à
ceux de l'ancienne page pour que le script de régénération côté serveur
continue de fonctionner.
"""

from base import (rendre, fil, hero, cta_final, faq_bloc, faq_jsonld,
                  pour_aller_plus_loin, SITE)
import illustrations

SELECTEUR = """
<div class="selecteur-periode" role="group" aria-label="Périodicité de facturation">
  <button type="button" data-periode="mensuel" aria-pressed="false">Mensuel</button>
  <button type="button" data-periode="semestriel" aria-pressed="false">Semestriel</button>
  <button type="button" data-periode="annuel" aria-pressed="true">Annuel</button>
</div>
<p class="note-periode" data-note-periode>Sans engagement. Résiliable d'un mois sur l'autre.</p>
"""


def carte(code, nom, positionnement, prix, mois, semestriel, annuel,
          mois_sem, mois_an, eco_sem, eco_an, cible, points, limites,
          badge=None, ocre=False):
    b = f'<span class="badge">{badge}</span>' if badge else ""
    lis = "".join(f"<li>{p}</li>" for p in points)
    lim = "".join(f"<span>{l}</span>" for l in limites)
    classe = "offre mise-en-avant" if badge else "offre"
    bouton = "ocre" if ocre else "secondaire"
    visuel = illustrations.offre(code, f"L'offre Ardoise {nom.split()[-1]}")

    # Le HTML statique doit être typographié comme le fera catalogue.js, sinon
    # la page « saute » à l'hydratation : virgule décimale, espace fine
    # insécable pour les milliers.
    an_txt = f"{annuel:,}".replace(",", " ")
    mois_txt = str(mois_an).replace(".", ",")

    return f"""<article class="{classe}" id="{code}" data-offre="{code}" data-devise="USD"
  data-prix-mensuel="{prix}" data-mois-mensuel="{mois}" data-eco-mensuel="0" data-pct-mensuel="0"
  data-prix-semestriel="{semestriel}" data-mois-semestriel="{mois_sem}" data-eco-semestriel="{eco_sem}" data-pct-semestriel="8"
  data-prix-annuel="{annuel}" data-mois-annuel="{mois_an}" data-eco-annuel="{eco_an}" data-pct-annuel="17">
  {b}
  {visuel}
  <h2 class="nom">{nom}</h2>
  <div class="positionnement">{positionnement}</div>
  <div class="prix" data-prix><span class="devise">$</span>{an_txt}<span class="periode-prix">/ an</span></div>
  <div class="par-mois" data-par-mois>soit {mois_txt}&nbsp;$ par mois</div>
  <div class="facturation" data-facturation>Facturé {an_txt}&nbsp;$ en une fois, une fois par an.</div>
  <span class="economie" data-economie hidden></span>
  <div class="cible">{cible}</div>
  <ul>{lis}</ul>
  <div class="limites">{lim}</div>
  <a class="bouton {bouton} pleine-largeur" href="/contact/?offre={code}">Demander cette offre</a>
</article>"""


CARTES = "\n".join([
    carte("ascension", "Ardoise Ascension", "L'essentiel pour gérer votre établissement",
          30, 30, 165, 300, "27.50", "25", 15, 60,
          "Écoles qui digitalisent leur gestion et veulent un logiciel complet dès "
          "le premier jour — quel que soit leur effectif.",
          ["Élèves, classes, sections, options, cours",
           "Années scolaires, trimestres ou semestres",
           "Notes, travaux, moyennes, classements, mentions",
           "Bulletins officiels RDC et bulletin annuel",
           "Présences",
           "Frais scolaires, encaissements et reçus (FC et&nbsp;$)",
           "Journal d'activité",
           "Didacticiel intégré et assistant d'aide",
           "Application installable, travail hors ligne"],
          ["<strong>Élèves illimités · Comptes illimités</strong>",
           "<strong>Archivage illimité</strong> des années scolaires",
           "100 générations IA / mois"]),

    carte("prime", "Ardoise Prime", "Une gestion plus complète, connectée et automatisée",
          59, 59, 325, 590, "54.17", "49.17", 29, 118,
          "Établissements dont l'administration sature et qui veulent organiser la vie scolaire.",
          ["<span class=\"herite\">Tout Ascension</span>",
           "Emploi du temps et créneaux",
           "Discipline : incidents, règlement, capital conduite",
           "Messages groupés aux parents et au personnel",
           "Site public de l'école et résultats en ligne",
           "Éditeur de modèles de bulletins",
           "Espace Discipline et comptes dédiés",
           "Lecture du règlement intérieur par l'IA"],
          ["<strong>Élèves illimités · Comptes illimités</strong>",
           "<strong>Archivage illimité</strong> des années scolaires",
           "400 générations IA / mois"],
          badge="Le plus choisi", ocre=True),

    carte("pilote", "Ardoise Pilote", "Des outils avancés pour piloter l'établissement",
          99, 99, 545, 990, "90.83", "82.50", 49, 198,
          "Établissements avec une direction, une comptabilité et des procédures "
          "d'admission — quel que soit leur effectif.",
          ["<span class=\"herite\">Tout Prime</span>",
           "Comptabilité : caisse, catégories, dépenses",
           "Paie : contrats et salaires du personnel",
           "Espace Comptabilité et comptes dédiés",
           "Concours d'admission et classement des candidats",
           "Orientation des élèves au mérite",
           "Session de repêchage de fin d'année",
           "Rapports avancés et tableaux de bord",
           "Questions sur vos données en langage naturel"],
          ["<strong>Élèves illimités · Comptes illimités</strong>",
           "<strong>Archivage illimité</strong> des années scolaires",
           "1 500 générations IA / mois"]),

    carte("infinite", "Ardoise Infinite", "L'expérience Ardoise complète, sans compromis",
          159, 159, 875, 1590, "145.83", "132.50", 79, 318,
          "Grands établissements et structures multi-vacations qui exploitent Ardoise de bout en bout.",
          ["<span class=\"herite\">Tout Pilote</span>",
           "Assistant WhatsApp pour les parents et le personnel",
           "5 000 générations IA par mois",
           "Archives et historique illimités",
           "Support prioritaire"],
          ["<strong>Élèves illimités · Comptes illimités</strong>",
           "<strong>Archivage illimité</strong> des années scolaires",
           "5 000 générations IA / mois · e-mails sans limite"]),
])


# ============================================================== /tarifs/
def tarifs():
    f_html, f_ld = fil([("Accueil", "/"), ("Tarifs", None)])

    questions = [
        ("Quelle offre choisir pour mon école&nbsp;?",
         "<p>Ce sont les modules dont vous avez besoin qui donnent la réponse, "
         "jamais votre effectif : les quatre offres acceptent un nombre illimité "
         "d'élèves et de comptes. Ascension couvre tout le cœur du métier — élèves, "
         "notes, bulletins, présences, frais. Prime ajoute l'emploi du temps, la "
         "discipline, la communication aux parents et le site public. Pilote ajoute "
         "la comptabilité, la paie, les concours d'admission, l'orientation et le "
         "repêchage. Infinite ajoute l'assistant WhatsApp et le support "
         "prioritaire.</p>"),
        ("Y a-t-il une limite au nombre d'élèves&nbsp;?",
         "<p>Non, dans aucune des quatre offres. Élèves, comptes utilisateurs, "
         "classes et années scolaires archivées sont illimités partout — y compris "
         "en Ascension. Une école qui grandit n'a pas besoin d'un logiciel plus "
         "cher, elle a besoin du même logiciel. Ce que vous choisissez en changeant "
         "d'offre, ce sont des modules et des espaces métiers, pas un quota. Seuls "
         "les générations d'IA et les e-mails sortants restent chiffrés, parce "
         "qu'ils ont un coût réel à chaque appel.</p>"),
        ("Peut-on changer d'offre en cours d'année&nbsp;?",
         "<p>Oui, dans les deux sens, et sans condition de volume puisqu'il n'y en "
         "a plus. Le passage à une offre supérieure est immédiat. Le retour à une "
         "offre inférieure prend effet à l'échéance en cours : les modules non "
         "compris deviennent inaccessibles, mais <strong>aucune donnée n'est "
         "supprimée</strong> — elles redeviennent visibles telles quelles si vous "
         "remontez plus tard.</p>"),
        ("Pourquoi payer à l'année plutôt qu'au mois&nbsp;?",
         "<p>Parce que l'annuel vaut dix mensualités : deux mois sont offerts, soit "
         "17 % de remise. Le semestriel en vaut cinq et demie, soit 8 %. Le "
         "mensuel reste sans engagement, et c'est délibéré : une école qui "
         "découvre la plateforme ne doit pas s'engager sur douze mois pour "
         "l'essayer.</p>"),
        ("L'installation et la formation sont-elles comprises&nbsp;?",
         "<p>Non, et c'est ce qui garde l'abonnement à ce prix. Le didacticiel "
         "intégré et l'assistant d'aide sont compris dans les quatre offres, ce "
         "qui permet à une école de se paramétrer seule. L'installation, la "
         "formation et la campagne de capture sont des prestations ponctuelles, "
         "disponibles avec n'importe quelle offre. "
         "<a href=\"/services/\">Voir les services</a>.</p>"),
    ]

    corps = f_html + hero(
        "Tarifs",
        "Le niveau qui correspond à votre école, pas celui qu'on vous impose",
        "Quatre offres, un seul produit. Le cœur du métier — élèves, notes, bulletins, "
        "présences, frais scolaires — est dans les quatre, y compris la première, "
        "et sans limite de nombre d'élèves ni de comptes. Ce qui change, c'est "
        "l'étendue des métiers couverts et la profondeur de l'administration.",
        mention="Prix en dollars américains. Deux mois offerts au paiement annuel.",
    ) + f"""
<section class="section" style="padding-top:24px">
  <div class="conteneur">
    {SELECTEUR}
    <div class="grille-offres">
      {CARTES}
    </div>
    <p class="rappel-separation">
      <strong>L'abonnement ne contient aucune prestation humaine.</strong>
      Installation, formation et campagne de capture sont facturées à part et
      restent disponibles avec les quatre offres, au même prix.
      <a href="/services/">Voir les services complémentaires</a>.
    </p>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Choisir</span>
      <h2>Trois questions suffisent en général</h2>
    </div>
    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Quels métiers travaillent dessus&nbsp;?</h3>
        <p>Direction et enseignants suffisent&nbsp;? Ascension. Ajoutez le
           secrétariat et la discipline&nbsp;: Prime. La comptabilité&nbsp;:
           Pilote. Le nombre d'élèves n'entre pas en ligne de compte.</p>
      </article>
      <article class="carte">
        <h3>Tenez-vous une caisse&nbsp;?</h3>
        <p>Si l'école suit ses dépenses et paie des salaires depuis la plateforme,
           il faut Pilote — quelle que soit sa taille.</p>
      </article>
      <article class="carte">
        <h3>Organisez-vous un test d'entrée&nbsp;?</h3>
        <p>Concours d'admission et orientation au mérite sont dans Pilote. Une
           petite école qui fait passer un concours a intérêt à y aller
           directement.</p>
      </article>
    </div>
    <p class="apres-grille">
      <a class="bouton secondaire" href="/tarifs/comparer/">Comparer les quatre offres ligne par ligne</a>
    </p>
  </div>
</section>
"""

    corps += faq_bloc("Avant de choisir", questions, id_section="faq-tarifs")

    corps += pour_aller_plus_loin([
        ("/tarifs/comparer/", "Comparatif détaillé",
         "Chaque fonction, chaque module, chaque espace métier, offre par offre."),
        ("/services/", "Services complémentaires",
         "Installation, formation, campagne de capture."),
        ("/fonctionnalites/", "Toutes les fonctionnalités",
         "Ce que fait Ardoise, domaine par domaine."),
        ("/faq/", "Questions fréquentes",
         "Engagement, données, connexion, changement d'offre."),
    ])

    corps += cta_final(
        "Pas certain du niveau qui convient ?",
        "Dites-nous ce que votre école gère déjà et quels métiers y travaillent. "
        "Nous vous disons quelle offre suffit — y compris quand c'est la moins chère.",
        [("/contact/", "Être rappelé", "principal"),
         ("/services/", "Voir l'accompagnement", "secondaire")])

    offres_ld = {
        "@type": "Product",
        "name": "Ardoise — logiciel de gestion scolaire",
        "description": "Plateforme de gestion scolaire pour les établissements de la RDC.",
        "brand": {"@type": "Brand", "name": "Ardoise"},
        "offers": [
            {"@type": "Offer", "name": "Ardoise Ascension", "price": "30",
             "priceCurrency": "USD", "url": f"{SITE}/tarifs/#ascension",
             "availability": "https://schema.org/InStock",
             "description": "Abonnement mensuel. 165 $ pour six mois, 300 $ pour un an. Élèves et comptes illimités."},
            {"@type": "Offer", "name": "Ardoise Prime", "price": "59",
             "priceCurrency": "USD", "url": f"{SITE}/tarifs/#prime",
             "availability": "https://schema.org/InStock",
             "description": "Abonnement mensuel. 325 $ pour six mois, 590 $ pour un an."},
            {"@type": "Offer", "name": "Ardoise Pilote", "price": "99",
             "priceCurrency": "USD", "url": f"{SITE}/tarifs/#pilote",
             "availability": "https://schema.org/InStock",
             "description": "Abonnement mensuel. 545 $ pour six mois, 990 $ pour un an."},
            {"@type": "Offer", "name": "Ardoise Infinite", "price": "159",
             "priceCurrency": "USD", "url": f"{SITE}/tarifs/#infinite",
             "availability": "https://schema.org/InStock",
             "description": "Abonnement mensuel. 875 $ pour six mois, 1 590 $ pour un an."},
        ],
    }

    return rendre(
        "tarifs/index.html", "/tarifs/",
        "Tarifs — Ardoise Ascension, Prime, Pilote et Infinite",
        "Les quatre offres d'Ardoise, de 30 à 159 $ par mois. Deux mois offerts au "
        "paiement annuel. Élèves, notes, bulletins et frais scolaires dans les quatre.",
        corps, actif="tarifs", jsonld=[f_ld, offres_ld, faq_jsonld(questions)],
    )


# ===================================================== /tarifs/comparer/
LIGNES = [
    ("groupe", "Le cœur du métier — dans les quatre offres"),
    ("oooo", "Élèves, dossiers et historique scolaire"),
    ("oooo", "Classes, sections, options et cours"),
    ("oooo", "Années scolaires, trimestres ou semestres"),
    ("oooo", "Notes, travaux, moyennes et classements"),
    ("oooo", "Bulletins officiels RDC et bulletin annuel"),
    ("oooo", "Mentions et règle d'égalité paramétrables"),
    ("oooo", "Présences"),
    ("oooo", "Frais scolaires, encaissements et reçus"),
    ("oooo", "Double devise franc congolais / dollar"),
    ("oooo", "Contrôle des impayés et dérogations"),
    ("oooo", "Reconduction annuelle et clôture de période"),
    ("oooo", "Archives des années clôturées et exports"),
    ("oooo", "Journal d'activité et traçabilité"),
    ("oooo", "Didacticiel intégré et assistant d'aide"),
    ("oooo", "Travail hors ligne et application installable"),

    ("groupe", "Organisation et vie scolaire"),
    ("nooo", "Emploi du temps, créneaux et vacations"),
    ("nooo", "Discipline, règlement intérieur et capital conduite"),
    ("nooo", "Messages groupés aux parents et au personnel"),
    ("nooo", "Site public de l'école et résultats en ligne"),
    ("nooo", "Éditeur de modèles de bulletins"),

    ("groupe", "Pilotage et administration"),
    ("nnoo", "Comptabilité : caisse, catégories et dépenses"),
    ("nnoo", "Paie : contrats et salaires du personnel"),
    ("nnoo", "Concours d'admission et classement des candidats"),
    ("nnoo", "Orientation au mérite"),
    ("nnoo", "Session de repêchage de fin d'année"),
    ("nnoo", "Rapports avancés et tableaux de bord"),

    ("groupe", "Intelligence artificielle"),
    ("oooo", "Assistant d'aide contextuelle"),
    ("oooo", "Appréciations et observations générées"),
    ("oooo", "Analyse d'un fichier avant import"),
    ("nooo", "Lecture du règlement intérieur"),
    ("nnoo", "Questions sur vos données en langage naturel"),
    ("nnoo", "Signaux de décrochage et recherche d'archives"),
    ("nnno", "Assistant WhatsApp parents et personnel"),
    ("val", "Générations IA par mois", "100", "400", "1 500", "5 000"),

    ("groupe", "Espaces métier — les comptes que l'offre autorise"),
    ("oooo", "Espace Direction"),
    ("oooo", "Espace Préfecture des études"),
    ("oooo", "Espace Secrétariat"),
    ("oooo", "Espace Enseignement"),
    ("oooo", "Espace Titulariat"),
    ("nooo", "Espace Discipline"),
    ("nnoo", "Espace Comptabilité"),

    ("groupe", "Capacité — identique dans les quatre offres"),
    ("val", "Élèves", "Illimité", "Illimité", "Illimité", "Illimité"),
    ("val", "Comptes utilisateurs", "Illimité", "Illimité", "Illimité", "Illimité"),
    ("val", "Classes", "Illimité", "Illimité", "Illimité", "Illimité"),
    ("val", "Années scolaires archivées", "Illimité", "Illimité", "Illimité", "Illimité"),
    ("val", "Documents et pièces jointes", "Sans quota", "Sans quota", "Sans quota", "Sans quota"),
    ("val", "E-mails sortants par mois", "500", "3 000", "15 000", "Sans limite"),

    ("groupe", "Prix"),
    ("val", "Par mois", "30 $", "59 $", "99 $", "159 $"),
    ("val", "Par semestre", "165 $", "325 $", "545 $", "875 $"),
    ("val", "Par an — deux mois offerts", "300 $", "590 $", "990 $", "1 590 $"),

    ("groupe", "Accompagnement"),
    ("nnno", "Support prioritaire"),
]


def _tableau():
    out = []
    for ligne in LIGNES:
        genre = ligne[0]
        if genre == "groupe":
            out.append(f'<tr class="groupe"><th scope="row" colspan="5">{ligne[1]}</th></tr>')
        elif genre == "val":
            _, libelle, a, b, c, d = ligne
            out.append(
                f'<tr><th scope="row">{libelle}</th>'
                f'<td class="valeur">{a}</td><td class="valeur">{b}</td>'
                f'<td class="valeur">{c}</td><td class="valeur">{d}</td></tr>'
            )
        else:
            motif = genre  # quatre caractères : o = inclus, n = absent
            cells = ""
            for ch in motif:
                cells += ('<td class="oui">✓</td>' if ch == "o" else '<td class="non">—</td>')
            out.append(f'<tr><th scope="row">{ligne[1]}</th>{cells}</tr>')
    return "\n".join(out)


def comparer():
    f_html, f_ld = fil([("Accueil", "/"), ("Tarifs", "/tarifs/"), ("Comparer", None)])

    questions = [
        ("Une offre inférieure retire-t-elle des fonctions du cœur du métier&nbsp;?",
         "<p>Non. Le premier bloc du tableau ne contient que des ✓ : élèves, notes, "
         "bulletins officiels, présences et frais scolaires sont dans les quatre "
         "offres. Une école en Ascension produit exactement les mêmes bulletins "
         "qu'une école en Infinite.</p>"),
        ("Que veut dire « illimité »&nbsp;?",
         "<p>Qu'aucun plafond commercial n'est appliqué. Élèves, comptes, classes et "
         "années archivées sont illimités dans les quatre offres — Ascension "
         "comprise. Seuls restent gradués les deux postes qui coûtent réellement à "
         "l'appel : les générations IA et le volume d'e-mails sortants. Des "
         "protections techniques subsistent sur la taille des fichiers, mais elles "
         "relèvent de la sécurité, pas de l'abonnement.</p>"),
        ("Peut-on acheter une fonction à l'unité&nbsp;?",
         "<p>Non pour les fonctions logicielles : elles sont regroupées en offres, "
         "ce qui garde la grille lisible. Oui pour les prestations humaines — "
         "installation, formation, capture — qui s'achètent séparément avec "
         "n'importe quelle offre.</p>"),
    ]

    corps = f_html + hero(
        "Tarifs · Comparatif",
        "Les quatre offres d'Ardoise, ligne par ligne",
        "Le tableau complet : chaque fonction, chaque module, chaque espace métier, "
        "chaque quota d'IA. "
        "Le premier bloc est le plus important — il ne contient que des ✓, et ce "
        "sont les fonctions qu'aucune offre ne retire.",
        [("/tarifs/", "Voir les prix et les cartes d'offres", "secondaire")],
        illustration=("comparer-offres", "Les quatre niveaux des offres Ardoise"),
    ) + f"""
<section class="section" style="padding-top:24px">
  <div class="conteneur">
    <div class="enveloppe-tableau">
      <table class="comparatif">
        <caption class="sr-only">
          Comparaison des fonctionnalités, limites, capacités IA et prix des quatre offres Ardoise
        </caption>
        <thead>
          <tr>
            <th scope="col">&nbsp;</th>
            <th scope="col"><a href="/tarifs/#ascension">Ascension</a></th>
            <th scope="col"><a href="/tarifs/#prime">Prime</a></th>
            <th scope="col"><a href="/tarifs/#pilote">Pilote</a></th>
            <th scope="col"><a href="/tarifs/#infinite">Infinite</a></th>
          </tr>
        </thead>
        <tbody>
          {_tableau()}
          <tr><th scope="row">Installation, formation, campagne de capture</th>
            <td colspan="4" style="font-size:.85rem">
              Services complémentaires — disponibles avec les quatre offres, au même
              prix. <a href="/services/">Voir le détail</a>
            </td></tr>
        </tbody>
      </table>
    </div>
    <p class="note-tableau">
      Aucune ligne de ce tableau ne dépend de la taille de votre école : élèves,
      comptes, classes et archives sont illimités dans les quatre offres. Ce que
      le tableau départage, ce sont les métiers et les modules.
    </p>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Lecture rapide</span>
      <h2>Trois seuils, et tout se décide</h2>
    </div>
    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Ascension → Prime</h3>
        <p>Le passage se fait quand l'administration sature : il faut un emploi du
           temps, une discipline tenue, et la possibilité d'écrire à toutes les
           familles d'un coup.</p>
      </article>
      <article class="carte">
        <h3>Prime → Pilote</h3>
        <p>Le passage se fait quand l'école devient un établissement : une caisse à
           tenir, des salaires à payer, un concours à organiser, des chiffres à
           produire pour la tutelle.</p>
      </article>
      <article class="carte">
        <h3>Pilote → Infinite</h3>
        <p>Le passage se fait quand l'école veut lire ses propres chiffres :
           analytique avancée, plusieurs vacations à arbitrer, des parents qu'on
           veut joindre par WhatsApp, et un accompagnement dédié.</p>
      </article>
    </div>
  </div>
</section>
"""

    corps += faq_bloc("Comprendre le tableau", questions, id_section="faq-comparatif")

    corps += pour_aller_plus_loin([
        ("/tarifs/", "Les prix",
         "Mensuel, semestriel, annuel — et ce que chaque offre contient."),
        ("/fonctionnalites/", "Les fonctionnalités en détail",
         "Une page par domaine, pour comprendre avant de comparer."),
        ("/services/", "Services complémentaires",
         "Ce qui n'est dans aucune offre, et se paie une fois."),
        ("/contact/", "Se faire conseiller",
         "Nous disons souvent aux écoles de prendre moins cher."),
    ])

    corps += cta_final(
        "Le tableau ne remplace pas une conversation de dix minutes.",
        "Décrivez votre école, nous vous disons quelle colonne vous suffit.",
        [("/contact/", "Être rappelé", "principal"),
         ("/tarifs/", "Revoir les prix", "secondaire")])

    return rendre(
        "tarifs/comparer/index.html", "/tarifs/comparer/",
        "Comparatif des offres Ardoise — Ascension à Infinite",
        "Tableau comparatif des quatre offres Ardoise : fonctionnalités, modules, espaces "
        "métier, quotas d'IA et prix. Élèves, comptes et archives illimités partout.",
        corps, actif="tarifs", jsonld=[f_ld, faq_jsonld(questions)],
    )


def construire():
    return [tarifs(), comparer()]
