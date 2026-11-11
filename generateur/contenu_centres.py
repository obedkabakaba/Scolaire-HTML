# -*- coding: utf-8 -*-
"""FONCTIONNALITÉS — l'espace des centres de formation."""

from base import (rendre, fil, hero, cta_final, faq_bloc, faq_jsonld,
                  pour_aller_plus_loin)


def centres():
    f_html, f_ld = fil([("Accueil", "/"), ("Fonctionnalités", "/fonctionnalites/"),
                        ("Centres de formation", None)])

    questions = [
        ("Ardoise convient-il à un centre qui n'est pas une école&nbsp;?",
         "<p>Oui. Un centre de formation a son propre espace : pas de classes, pas de "
         "bulletins, pas d'année scolaire, mais des programmes, des sessions, des "
         "groupes, des coachs et des apprenants. Le vocabulaire s'adapte au centre "
         "(coach ou formateur, apprenant ou stagiaire, session ou promotion).</p>"),
        ("Y a-t-il une limite au nombre d'apprenants&nbsp;?",
         "<p>Non. Les trois offres des centres — Tremplin, Envol et Horizon — donnent "
         "des apprenants, des coachs et des comptes illimités. Elles se distinguent "
         "par les outils : archives, documents officiels et indicateurs à partir "
         "d'Envol, ventes aux entreprises avec Horizon.</p>"),
        ("Les apprenants peuvent-ils s'inscrire eux-mêmes&nbsp;?",
         "<p>Oui. Le site du centre (myardoise.com/votre-centre) présente vos "
         "formations, propose un test de niveau et reçoit les préinscriptions. "
         "Chaque demande arrive dans « Demandes du site » et devient un apprenant en "
         "un clic.</p>"),
        ("La classe en ligne a-t-elle une limite de durée&nbsp;?",
         "<p>Non. La Classe Ardoise est la classe en ligne d'Ardoise, sans service "
         "tiers ni minuteur : mode Salle (salle dessinée, avatars, main levée) ou "
         "mode Visio, tableau, sondages, partage d'écran, et un mode connexion "
         "faible qui se propose de lui-même quand le réseau faiblit.</p>"),
        ("Combien coûte l'installation&nbsp;?",
         "<p>Rien si vous l'installez vous-même : le didacticiel vous guide étape par "
         "étape. Si vous préférez que nous le fassions, l'installation et la "
         "configuration d'un centre coûtent 35&nbsp;$, une seule fois.</p>"),
    ]

    corps = f_html + hero(
        "Fonctionnalités · Centres de formation",
        "Le centre de formation entier, de l'inscription au certificat",
        "Centre d'anglais, de langues, d'informatique, de couture, de métiers&nbsp;: "
        "Ardoise tient vos sessions, vos groupes, l'appel, les paiements par tranches "
        "et les certificats, publie votre site avec test de niveau et ouvre votre "
        "classe en ligne — sur ordinateur comme sur téléphone.",
        [("/essai/", "Essayer 7 jours gratuitement", "ocre"),
         ("/tarifs/#centres-de-formation", "Voir les offres des centres", "secondaire")],
    ) + """
<section class="section">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Le quotidien du centre</span>
      <h2>Ce que l'accueil, la caisse et les coachs font chaque jour</h2>
    </div>
    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Sessions, groupes et planning</h3>
        <p>Une session par rentrée, des groupes avec leur coach, leur horaire et
           leurs places. Les séances se planifient en deux clics et les rappels
           partent tout seuls.</p>
      </article>
      <article class="carte">
        <h3>L'appel, même au QR code</h3>
        <p>Le coach fait l'appel en quelques secondes, ou les apprenants scannent le
           QR code affiché en salle. Assiduité et absences répétées sont suivies
           sans effort.</p>
      </article>
      <article class="carte">
        <h3>Paiements par tranches</h3>
        <p>Encaissement en dollars ou en francs, reçu numéroté, restes à payer
           visibles d'un coup d'œil et relances préparées par WhatsApp.</p>
      </article>
      <article class="carte">
        <h3>Évaluations et certificats</h3>
        <p>Tests de placement, mi-parcours et finaux ; niveau atteint ; certificat
           à votre logo avec QR code vérifiable par n'importe quel employeur.</p>
      </article>
      <article class="carte">
        <h3>Leçons en ligne</h3>
        <p>Des leçons avec quiz que les apprenants révisent entre deux cours —
           l'assistant IA peut les préparer pour vous.</p>
      </article>
      <article class="carte">
        <h3>Espace apprenant</h3>
        <p>Planning, classe en ligne, leçons, résultats et certificats, depuis le
           site du centre, même avec une connexion faible.</p>
      </article>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Classe Ardoise</span>
      <h2>Votre classe en ligne, sans minuteur et sans abonnement à part</h2>
      <p class="chapeau">Deux modes, un bouton pour passer de l'un à l'autre&nbsp;: la
        Salle — vue d'en haut, chaque apprenant prend sa place avec son avatar, lève
        la main, reçoit la parole — et la Visio classique. Tableau, sondages,
        partage d'écran, enregistrement du cours, et un mode connexion faible
        proposé automatiquement quand le réseau ralentit.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Piloter et grandir</span>
      <h2>Ce qui fait la différence entre les offres</h2>
    </div>
    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Archives</h3>
        <p>Chaque session passée, ses résultats et ses anciens apprenants — à relancer
           et à réinscrire en un clic. Exports Excel des apprenants, paiements,
           présences et résultats.</p>
      </article>
      <article class="carte">
        <h3>Documents officiels</h3>
        <p>Attestations d'inscription et d'assiduité, relevés de résultats et cartes
           d'apprenant avec photo et QR code, à votre nom et à votre logo.</p>
      </article>
      <article class="carte">
        <h3>Clients entreprises</h3>
        <p>Formations vendues aux entreprises, ONG et administrations&nbsp;: fichier
           clients, devis numérotés, factures et suivi des règlements.</p>
      </article>
    </div>
    <p class="rappel-separation">Apprenants illimités dans les trois offres&nbsp;:
      <strong>Tremplin</strong> 20&nbsp;$ par mois, <strong>Envol</strong> 35&nbsp;$,
      <strong>Horizon</strong> 59&nbsp;$. <a href="/tarifs/#centres-de-formation">Comparer les offres</a>
      · <a href="/services/#centres-de-formation">Installation par nos soins : 35&nbsp;$</a>.</p>
  </div>
</section>
"""

    corps += faq_bloc("Ce que les centres nous demandent", questions)
    corps += pour_aller_plus_loin([
        ("/tarifs/#centres-de-formation", "Offres des centres",
         "Tremplin, Envol, Horizon : ce que chacune contient."),
        ("/services/#centres-de-formation", "Services pour les centres",
         "Installation à 35 $, formation de l'équipe, saisie des apprenants."),
        ("/fonctionnalites/ia/", "Intelligence artificielle",
         "Leçons, quiz et messages préparés par l'assistant."),
        ("/securite/", "Sécurité et données",
         "Chaque centre est isolé ; chaque rôle ne voit que ce qui le concerne."),
    ])
    corps += cta_final(
        "Ouvrez votre centre sur Ardoise aujourd'hui.",
        "Sept jours d'essai gratuit, sans carte bancaire. Vos données restent si vous "
        "continuez.",
        [("/essai/", "Essayer gratuitement", "principal"),
         ("/contact/", "Parler à l'équipe", "secondaire")])

    return rendre(
        "fonctionnalites/centres-de-formation/index.html",
        "/fonctionnalites/centres-de-formation/",
        "Logiciel pour centre de formation (langues, informatique, métiers) — Ardoise",
        "Sessions, groupes, appel par QR code, paiements par tranches, certificats "
        "vérifiables, site avec test de niveau et classe en ligne sans limite de "
        "durée. Apprenants illimités, dès 20 $ par mois.",
        corps, actif="produit", jsonld=[f_ld, faq_jsonld(questions)],
    )


def construire():
    return [centres()]
