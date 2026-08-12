# -*- coding: utf-8 -*-
"""
SERVICES COMPLÉMENTAIRES — un hub et trois pages de prestation.

Chaque prestation a sa page parce que chacune répond à une question différente,
posée par une personne différente, à un moment différent : « je démarre et je
ne veux pas paramétrer », « mon personnel ne sait pas s'en servir », « j'ai
1 200 élèves sur des fiches papier ». Les fusionner reviendrait à obliger les
trois à lire les deux autres.
"""

from base import (rendre, fil, hero, cta_final, faq_bloc, faq_jsonld,
                  pour_aller_plus_loin, SITE)


def service_ld(nom, description, prix, unite=None):
    offre = {
        "@type": "Offer",
        "price": str(prix),
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock",
    }
    if unite:
        offre["priceSpecification"] = {
            "@type": "UnitPriceSpecification",
            "price": str(prix), "priceCurrency": "USD",
            "unitText": unite,
        }
    return {
        "@type": "Service",
        "name": nom,
        "description": description,
        "serviceType": "Prestation d'accompagnement",
        "provider": {"@type": "Organization", "name": "Ardoise", "url": f"{SITE}/"},
        "areaServed": {"@type": "Country", "name": "République démocratique du Congo"},
        "offers": offre,
    }


# ============================================================ /services/
def hub():
    f_html, f_ld = fil([("Accueil", "/"), ("Services", None)])

    questions = [
        ("Les services sont-ils obligatoires&nbsp;?",
         "<p>Aucun. Une école peut créer son compte, se paramétrer seule en suivant "
         "le didacticiel intégré, et n'acheter jamais aucune prestation. Les "
         "services existent pour les établissements qui préfèrent que le travail "
         "soit fait, ou fait plus vite.</p>"),
        ("Faut-il un abonnement pour acheter un service&nbsp;?",
         "<p>Oui. Les prestations s'appliquent à une école existante dans Ardoise ; "
         "elles ne se vendent pas seules. En revanche, elles s'achètent avec "
         "n'importe quelle offre, y compris la première : une école en Ascension "
         "peut commander la formation personnalisée à 100 $.</p>"),
        ("Peut-on tout prendre d'un coup&nbsp;?",
         "<p>Oui, et c'est l'enchaînement le plus fréquent chez une école qui part "
         "de zéro : installation, campagne de capture, puis formation — dans cet "
         "ordre, parce qu'on forme mieux une équipe sur ses propres élèves que "
         "sur une base vide.</p>"),
    ]

    corps = f_html + hero(
        "Services complémentaires",
        "Nous pouvons faire le travail d'installation à votre place",
        "Trois prestations ponctuelles, facturées une fois, indépendantes de "
        "l'abonnement : paramétrer votre école, former votre personnel, saisir vos "
        "élèves. Aucune n'est obligatoire, et toutes sont disponibles avec les "
        "quatre offres.",
        [("/contact/", "Demander un accompagnement", "ocre"),
         ("/tarifs/", "Voir les offres d'abonnement", "secondaire")],
        illustration=("services",
                      "L'installation, la formation et la capture Ardoise"),
    ) + """
<section class="section">
  <div class="conteneur">
    <div class="grille-services">
      <article class="service">
        <h2>Installation &amp; configuration</h2>
        <div class="tarif">60&nbsp;$ <small>forfait unique</small></div>
        <div class="rythme-facturation">Une intervention, généralement sous 72 heures</div>
        <p>Nous créons votre école et la paramétrons entièrement à partir de vos
           documents : années, périodes, sections, options, classes, cours,
           coefficients, mentions, seuils et grille des frais.</p>
        <ul>
          <li>Vous fournissez vos documents d'organisation</li>
          <li>Vous récupérez une plateforme conforme, pas un formulaire vide</li>
          <li>Vérification finale avec la direction</li>
        </ul>
        <a class="bouton secondaire pleine-largeur" href="/services/installation/">Ce qui est fait, en détail</a>
      </article>

      <article class="service">
        <h2>Formation du personnel</h2>
        <div class="tarif">30, 60 ou 100&nbsp;$ <small>selon la profondeur</small></div>
        <div class="rythme-facturation">D'une séance d'1 h 30 à une journée complète</div>
        <p>Trois formules, de la prise en main des gestes quotidiens à une
           formation bâtie sur vos propres circuits internes, donnée séparément à
           chaque profil d'utilisateur.</p>
        <ul>
          <li>Sur place ou à distance</li>
          <li>Support écrit remis à l'équipe</li>
          <li>Séance de suivi dans la formule personnalisée</li>
        </ul>
        <a class="bouton secondaire pleine-largeur" href="/services/formation/">Les trois formules</a>
      </article>

      <article class="service">
        <h2>Campagne de capture</h2>
        <div class="tarif">0,50&nbsp;$ <small>par élève</small></div>
        <div class="rythme-facturation">Comptez une semaine pour 500 élèves</div>
        <p>Nous transformons vos registres papier en base de données : identité
           complète, responsable et coordonnées, affectation en classe, matricules
           et codes d'accès, contrôle des doublons.</p>
        <ul>
          <li>250 $ pour 500 élèves, 600 $ pour 1 200</li>
          <li>Liste de vérification remise à la fin</li>
          <li>Vous passez d'une armoire de fiches à une école consultable</li>
        </ul>
        <a class="bouton ocre pleine-largeur" href="/services/campagne-de-capture/">Comment ça se passe</a>
      </article>
    </div>

    <p class="rappel-separation">
      <strong>Deux choses distinctes.</strong> L'abonnement est ce que vous payez
      pour utiliser Ardoise, tous les mois. Les services sont ce que vous payez
      une fois pour qu'on vous accompagne. Ne pas les confondre évite de croire
      qu'on vend une formation déguisée en fonctionnalité.
      <a href="/tarifs/">Voir les offres d'abonnement</a>.
    </p>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Dans quel ordre</span>
      <h2>L'enchaînement d'une école qui part de zéro</h2>
    </div>
    <div class="grille-etapes">
      <article class="etape">
        <span class="num">1</span>
        <h3>Abonnement</h3>
        <p>Vous choisissez l'offre correspondant à votre taille. L'école existe.</p>
      </article>
      <article class="etape">
        <span class="num">2</span>
        <h3>Installation</h3>
        <p>Nous paramétrons la structure : classes, cours, coefficients, frais.
           La plateforme ressemble à votre école.</p>
      </article>
      <article class="etape">
        <span class="num">3</span>
        <h3>Capture</h3>
        <p>Nous saisissons vos élèves. Les listes d'appel et les grilles de cotes
           sont remplies.</p>
      </article>
      <article class="etape">
        <span class="num">4</span>
        <h3>Formation</h3>
        <p>Nous formons votre équipe sur vos propres données — plus efficace que
           sur une base d'exemple.</p>
      </article>
    </div>
  </div>
</section>
"""

    corps += faq_bloc("Avant de commander", questions, id_section="faq-services")

    corps += pour_aller_plus_loin([
        ("/services/installation/", "Installation et configuration",
         "Le détail de ce que nous paramétrons, et ce que nous ne faisons pas."),
        ("/services/formation/", "Formation du personnel",
         "Express, complète ou personnalisée : laquelle pour qui."),
        ("/services/campagne-de-capture/", "Campagne de capture",
         "Combien coûte la saisie de 500, 1 000 ou 2 000 élèves."),
        ("/tarifs/", "Offres d'abonnement",
         "Ce que vous payez pour utiliser Ardoise, tous les mois."),
    ])

    corps += cta_final(
        "Dites-nous où en est votre école.",
        "Registres papier, fichiers Excel, ancien logiciel abandonné : "
        "nous avons déjà repris les trois.",
        [("/contact/", "Demander un accompagnement", "principal"),
         ("/tarifs/", "Voir les offres", "secondaire")])

    return rendre(
        "services/index.html", "/services/",
        "Installation, formation et saisie des élèves — Services Ardoise",
        "Installation et configuration de votre école (60 $), formation du personnel "
        "(30 à 100 $), campagne de capture des élèves (0,50 $ par élève). "
        "Optionnels.",
        corps, actif="services", jsonld=[f_ld, faq_jsonld(questions)],
    )


# ================================================ /services/installation/
def installation():
    f_html, f_ld = fil([("Accueil", "/"), ("Services", "/services/"),
                        ("Installation et configuration", None)])

    questions = [
        ("Pourquoi 60&nbsp;$ et pas un devis&nbsp;?",
         "<p>Parce que le travail est le même d'une école à l'autre : lire vos "
         "documents et remplir des écrans de paramétrage. Un forfait unique évite "
         "la négociation et la mauvaise surprise. Il ne varie pas avec le nombre "
         "d'élèves — c'est la campagne de capture qui, elle, dépend du volume.</p>"),
        ("Combien de temps cela prend-il&nbsp;?",
         "<p>Une intervention, généralement sous 72 heures à partir du moment où "
         "nous avons vos documents. Le délai dépend surtout de la rapidité avec "
         "laquelle l'école fournit sa liste de classes, de cours et de "
         "coefficients.</p>"),
        ("Puis-je le faire moi-même&nbsp;?",
         "<p>Oui, et beaucoup d'écoles le font. Le didacticiel intégré guide le "
         "paramétrage étape par étape, et l'assistant d'aide répond aux questions "
         "dans l'écran où elles se posent. L'installation payante fait gagner du "
         "temps ; elle ne débloque rien d'inaccessible autrement.</p>"),
        ("Les élèves sont-ils saisis pendant l'installation&nbsp;?",
         "<p>Non, et c'est volontaire : ce sont deux travaux de nature différente. "
         "L'installation prépare la structure ; la saisie des élèves un par un est "
         "la <a href=\"/services/campagne-de-capture/\">campagne de capture</a>, "
         "facturée 0,50 $ par élève.</p>"),
    ]

    corps = f_html + hero(
        "Services · Installation",
        "Votre école prête à l'emploi, paramétrée par notre équipe",
        "Nous créons votre établissement dans Ardoise et le configurons entièrement "
        "à partir de vos documents. Vous récupérez une plateforme qui ressemble déjà "
        "à votre école, pas une série de formulaires vides à remplir un soir de "
        "septembre.",
        [("/contact/", "Commander l'installation", "ocre"),
         ("/services/", "Voir les autres services", "secondaire")],
        mention="60 $, forfait unique · une intervention, généralement sous 72 heures",
        illustration=("installation", "Le paramétrage complet d'une école"),
    ) + """
<section class="section">
  <div class="conteneur grille-deux">
    <div>
      <span class="eyebrow">Ce qui est fait</span>
      <h2>Sept opérations, et l'école est utilisable</h2>
      <p class="chapeau">
        Le paramétrage d'une école n'est pas difficile : il est long, minutieux, et
        il conditionne tout ce qui suit. Un coefficient oublié se remarque au
        premier bulletin.
      </p>
      <a class="bouton secondaire" href="/contact/">Demander l'installation</a>
    </div>
    <ul class="liste-points numerotee">
      <li>Création de l'école et du compte Directeur</li>
      <li>Années scolaires et périodes — trimestres ou semestres</li>
      <li>Sections, options, classes et cours avec leurs coefficients</li>
      <li>Système de notation, mentions et seuils de promotion</li>
      <li>Grille des frais scolaires et devise de référence</li>
      <li>Création des comptes du personnel et attribution des rôles</li>
      <li>Vérification finale, écran par écran, avec la direction</li>
    </ul>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="grille-cartes deux">
      <article class="carte etoffee">
        <h3>Ce que nous vous demandons</h3>
        <ul class="mini-liste">
          <li>Un abonnement Ardoise actif, quel qu'il soit</li>
          <li>La liste de vos classes, avec sections et options</li>
          <li>La liste de vos cours et de leurs coefficients</li>
          <li>Votre système de notation et vos mentions</li>
          <li>Votre grille de frais et votre devise de référence</li>
          <li>La liste du personnel à qui créer un compte</li>
        </ul>
        <p class="apres-liste">Une photo lisible d'un document manuscrit suffit :
           nous n'exigeons pas de fichier Excel.</p>
      </article>
      <article class="carte etoffee">
        <h3>Ce qui n'est pas compris</h3>
        <ul class="mini-liste">
          <li><strong>La saisie des élèves un par un</strong> — c'est la
              <a href="/services/campagne-de-capture/">campagne de capture</a>,
              facturée 0,50 $ par élève.</li>
          <li><strong>La formation du personnel</strong> — c'est la
              <a href="/services/formation/">formation</a>, à partir de 30 $.</li>
        </ul>
        <p class="apres-liste">Nous préférons l'écrire que le laisser découvrir :
           une prestation dont le périmètre est flou finit toujours mal.</p>
      </article>
    </div>
  </div>
</section>

<section class="section">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Pour qui</span>
      <h2>Toute école qui démarre et préfère ne pas paramétrer elle-même</h2>
    </div>
    <div class="grille-cartes trois">
      <article class="carte">
        <h3>L'école qui n'a jamais rien informatisé</h3>
        <p>Personne dans l'établissement n'a l'habitude de ce type d'outil. Faire
           paramétrer évite trois semaines d'hésitation.</p>
      </article>
      <article class="carte">
        <h3>L'école pressée</h3>
        <p>La rentrée est dans dix jours. L'installation sous 72 heures laisse le
           temps de saisir les élèves et de former l'équipe.</p>
      </article>
      <article class="carte">
        <h3>Le complexe scolaire</h3>
        <p>Plusieurs sections, plusieurs vacations, des dizaines de cours et de
           coefficients : le paramétrage devient un vrai travail.</p>
      </article>
    </div>
  </div>
</section>
"""

    corps += faq_bloc("Questions sur l'installation", questions,
                      id_section="faq-installation")

    corps += pour_aller_plus_loin([
        ("/services/campagne-de-capture/", "Campagne de capture",
         "L'étape suivante : la saisie de vos élèves."),
        ("/services/formation/", "Formation du personnel",
         "Une fois l'école paramétrée, apprendre à s'en servir."),
        ("/fonctionnalites/gestion-scolaire/", "Ce que nous paramétrons",
         "Classes, cours, coefficients, périodes — le détail fonctionnel."),
        ("/tarifs/", "Offres d'abonnement",
         "L'installation suppose un abonnement actif, n'importe lequel."),
    ])

    corps += cta_final(
        "Envoyez-nous vos documents, nous vous rendons une école.",
        "Une liste de classes, une liste de cours, une grille de frais. "
        "C'est suffisant pour commencer.",
        [("/contact/", "Commander l'installation", "principal"),
         ("/services/", "Voir les autres services", "secondaire")])

    return rendre(
        "services/installation/index.html", "/services/installation/",
        "Installation et configuration de votre école — Ardoise (60 $)",
        "Nous paramétrons votre école à partir de vos documents : années, périodes, "
        "sections, options, classes, cours, coefficients et frais. Forfait 60 $.",
        corps, actif="services",
        jsonld=[f_ld,
                service_ld("Installation et configuration Ardoise",
                           "Paramétrage complet d'un établissement scolaire dans Ardoise "
                           "à partir de ses documents d'organisation.", 60),
                faq_jsonld(questions)],
    )


# =================================================== /services/formation/
def formation():
    f_html, f_ld = fil([("Accueil", "/"), ("Services", "/services/"),
                        ("Formation du personnel", None)])

    questions = [
        ("Sur place ou à distance&nbsp;?",
         "<p>Les deux sont possibles pour les trois formules. À distance coûte le "
         "même prix et convient bien aux équipes déjà à l'aise avec un ordinateur ; "
         "sur place vaut mieux quand une partie du personnel découvre "
         "l'informatique.</p>"),
        ("Combien de personnes peut-on former&nbsp;?",
         "<p>La formation express et la formation complète s'adressent à un groupe "
         "réuni. La formation personnalisée procède au contraire par sessions "
         "séparées, un profil à la fois — direction, secrétariat, titulaires, "
         "professeurs — parce que ces quatre métiers n'utilisent pas les mêmes "
         "écrans.</p>"),
        ("Faut-il vraiment payer une formation&nbsp;?",
         "<p>Pas nécessairement. Le didacticiel intégré et l'assistant d'aide sont "
         "compris dans les quatre offres et suffisent à beaucoup d'équipes. La "
         "formation payante se justifie quand le personnel est nombreux, peu "
         "familier de l'outil informatique, ou quand l'école veut que ses propres "
         "procédures soient respectées à la lettre.</p>"),
        ("Faut-il que l'école soit déjà paramétrée&nbsp;?",
         "<p>Oui. On ne forme pas utilement sur une base vide : les gestes "
         "s'apprennent sur vos classes, vos cours et vos élèves. Si votre école "
         "n'est pas encore configurée, commencez par "
         "<a href=\"/services/installation/\">l'installation</a>.</p>"),
    ]

    corps = f_html + hero(
        "Services · Formation",
        "Former votre personnel, du geste quotidien à vos procédures internes",
        "Trois formules, de la séance de prise en main à la formation construite sur "
        "les circuits réels de votre établissement. Sur place ou à distance, avec "
        "n'importe quelle offre d'abonnement.",
        [("/contact/", "Demander une formation", "ocre"),
         ("/services/", "Voir les autres services", "secondaire")],
        mention="30, 60 ou 100 $ selon la profondeur · une école déjà paramétrée est requise",
        illustration=("formation", "Une équipe scolaire formée à Ardoise"),
    ) + """
<section class="section">
  <div class="conteneur">
    <div class="grille-services">
      <article class="service">
        <h2>Formation express</h2>
        <div class="tarif">30&nbsp;$ <small>forfait</small></div>
        <div class="rythme-facturation">Environ 1 h 30, une séance</div>
        <p>Les gestes quotidiens, et rien d'autre : de quoi permettre à l'équipe de
           commencer à travailler dès le lendemain.</p>
        <ul>
          <li>Connexion et rôles de chacun</li>
          <li>Saisie des notes et des travaux</li>
          <li>Appel et présences</li>
          <li>Génération d'un bulletin de bout en bout</li>
          <li>Questions-réponses</li>
        </ul>
        <a class="bouton secondaire pleine-largeur" href="/contact/?service=formation_express">Demander cette formation</a>
      </article>

      <article class="service">
        <h2>Formation complète</h2>
        <div class="tarif">60&nbsp;$ <small>forfait</small></div>
        <div class="rythme-facturation">Une demi-journée</div>
        <p>L'ensemble de la plateforme, module par module, avec les cas particuliers
           que rencontre réellement une école.</p>
        <ul>
          <li>Tout le contenu de la formation express</li>
          <li>Dossiers élèves, inscriptions et sorties</li>
          <li>Bulletins de période, de semestre et annuels</li>
          <li>Frais scolaires, paiements et reçus</li>
          <li>Clôture de période et fin d'année</li>
          <li>Cas particuliers et erreurs fréquentes</li>
          <li>Support écrit remis à l'équipe</li>
        </ul>
        <a class="bouton secondaire pleine-largeur" href="/contact/?service=formation_complete">Demander cette formation</a>
      </article>

      <article class="service">
        <h2>Formation personnalisée</h2>
        <div class="tarif">100&nbsp;$ <small>forfait</small></div>
        <div class="rythme-facturation">Une journée, plusieurs sessions par profil</div>
        <p>Bâtie sur vos circuits : qui saisit, qui valide, qui encaisse, qui signe.
           Donnée séparément à chaque profil concerné.</p>
        <ul>
          <li>Tout le contenu de la formation complète</li>
          <li>Étude préalable de vos circuits internes</li>
          <li>Sessions séparées par profil</li>
          <li>Exercices sur vos propres données</li>
          <li>Fiches de procédure à vos noms de rôles</li>
          <li>Séance de suivi à distance après quelques semaines</li>
        </ul>
        <a class="bouton ocre pleine-largeur" href="/contact/?service=formation_personnalisee">Demander cette formation</a>
      </article>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Choisir</span>
      <h2>Laquelle pour quelle école</h2>
    </div>
    <div class="enveloppe-tableau">
      <table class="comparatif">
        <caption class="sr-only">Comparaison des trois formules de formation</caption>
        <thead>
          <tr><th scope="col">&nbsp;</th><th scope="col">Express</th>
              <th scope="col">Complète</th><th scope="col">Personnalisée</th></tr>
        </thead>
        <tbody>
          <tr><th scope="row">Prix</th>
            <td class="valeur">30 $</td><td class="valeur">60 $</td><td class="valeur">100 $</td></tr>
          <tr><th scope="row">Durée</th>
            <td class="valeur">1 h 30</td><td class="valeur">Demi-journée</td><td class="valeur">Journée</td></tr>
          <tr><th scope="row">Gestes quotidiens</th>
            <td class="oui">✓</td><td class="oui">✓</td><td class="oui">✓</td></tr>
          <tr><th scope="row">Fin de période et fin d'année</th>
            <td class="non">—</td><td class="oui">✓</td><td class="oui">✓</td></tr>
          <tr><th scope="row">Frais scolaires et reçus</th>
            <td class="non">—</td><td class="oui">✓</td><td class="oui">✓</td></tr>
          <tr><th scope="row">Support écrit remis</th>
            <td class="non">—</td><td class="oui">✓</td><td class="oui">✓</td></tr>
          <tr><th scope="row">Sessions séparées par profil</th>
            <td class="non">—</td><td class="non">—</td><td class="oui">✓</td></tr>
          <tr><th scope="row">Fiches de procédure à vos rôles</th>
            <td class="non">—</td><td class="non">—</td><td class="oui">✓</td></tr>
          <tr><th scope="row">Séance de suivi</th>
            <td class="non">—</td><td class="non">—</td><td class="oui">✓</td></tr>
        </tbody>
      </table>
    </div>
    <p class="note-tableau">
      Les trois formules s'achètent avec n'importe quelle offre d'abonnement, y
      compris Ascension.
    </p>
  </div>
</section>
"""

    corps += faq_bloc("Questions sur la formation", questions, id_section="faq-formation")

    corps += pour_aller_plus_loin([
        ("/services/installation/", "Installation",
         "L'étape qui doit précéder : une école paramétrée."),
        ("/fonctionnalites/ia/", "Assistant d'aide inclus",
         "Ce que le didacticiel intégré fait gratuitement, dans les quatre offres."),
        ("/services/campagne-de-capture/", "Campagne de capture",
         "Former sur ses propres élèves plutôt que sur une base d'exemple."),
        ("/faq/", "Questions fréquentes",
         "Ce que les écoles demandent avant de s'engager."),
    ])

    corps += cta_final(
        "Une équipe formée en une demi-journée ne rappelle plus.",
        "Dites-nous combien de personnes et quels profils, nous vous disons "
        "quelle formule suffit.",
        [("/contact/", "Demander une formation", "principal"),
         ("/services/", "Voir les autres services", "secondaire")])

    return rendre(
        "services/formation/index.html", "/services/formation/",
        "Formation du personnel au logiciel Ardoise — 30, 60 ou 100 $",
        "Trois formules de formation à Ardoise : express à 30 $, complète à 60 $, "
        "personnalisée à 100 $. Sur place ou à distance, profil par profil.",
        corps, actif="services",
        jsonld=[f_ld,
                service_ld("Formation du personnel à Ardoise",
                           "Formation à l'usage de la plateforme Ardoise, de la prise "
                           "en main aux procédures internes de l'établissement.", 30),
                faq_jsonld(questions)],
    )


# ========================================== /services/campagne-de-capture/
def capture():
    f_html, f_ld = fil([("Accueil", "/"), ("Services", "/services/"),
                        ("Campagne de capture", None)])

    questions = [
        ("Pourquoi 0,50&nbsp;$ par élève et pas un forfait&nbsp;?",
         "<p>Parce que le travail est proportionnel au nombre de fiches à lire et à "
         "saisir. Un forfait ferait payer la même chose à une école de 200 élèves "
         "et à un complexe de 2 000. Le prix à l'élève est le seul qui reste juste "
         "dans les deux cas.</p>"),
        ("Combien de temps faut-il&nbsp;?",
         "<p>Comptez une semaine pour 500 élèves. Le délai dépend surtout de la "
         "lisibilité de vos registres : des fiches d'inscription remplies au stylo "
         "et rangées par classe vont beaucoup plus vite qu'un cahier tenu sur "
         "trois années.</p>"),
        ("Que se passe-t-il si un nom est illisible&nbsp;?",
         "<p>Il est signalé plutôt qu'inventé. À la fin de la campagne, vous "
         "recevez une liste de vérification qui rassemble les incertitudes, les "
         "doublons probables et les fiches incomplètes. Vous tranchez ; nous ne "
         "devinons pas.</p>"),
        ("Les photos et les actes de naissance sont-ils saisis&nbsp;?",
         "<p>Non. La campagne couvre les données d'identité et de scolarité, pas la "
         "photographie des élèves ni la numérisation des pièces d'état civil. Les "
         "notes des années antérieures n'en font pas partie non plus.</p>"),
        ("Puis-je saisir moi-même&nbsp;?",
         "<p>Bien sûr. Ardoise accepte un import de fichier, analysé par l'IA "
         "colonne par colonne avant écriture, et la saisie manuelle reste "
         "possible. La campagne s'adresse aux écoles dont les données ne sont "
         "sur aucun fichier.</p>"),
    ]

    corps = f_html + hero(
        "Services · Campagne de capture",
        "Nous constituons votre base d'élèves à partir de vos registres",
        "La campagne de capture est le travail de saisie qui transforme une armoire "
        "de fiches en école consultable en trois clics. Notre équipe collecte, "
        "saisit, vérifie et charge les informations de chaque élève.",
        [("/contact/", "Demander une estimation", "ocre"),
         ("/services/", "Voir les autres services", "secondaire")],
        mention="0,50 $ par élève · comptez une semaine pour 500 élèves",
        illustration=("capture", "La capture des portraits et dossiers élèves"),
    ) + """
<section class="section">
  <div class="conteneur grille-deux">
    <div>
      <span class="eyebrow">Le calcul</span>
      <h2>Un tarif à l'élève, sans palier ni minimum caché</h2>
      <p class="chapeau">
        Le prix se calcule au nombre d'élèves saisis, point. Une école de 500 élèves
        paie 250 $ ; une école de 1 200 en paie 600.
      </p>
      <div class="simulateur" data-simulateur-capture data-prix-unitaire="0.5">
        <label for="nb-eleves">Nombre d'élèves à saisir</label>
        <div class="champ">
          <input type="number" id="nb-eleves" data-nb-eleves value="500" min="0" max="20000" step="10" />
          <input type="range" data-curseur-eleves value="500" min="0" max="3000" step="10"
                 aria-label="Curseur du nombre d'élèves" />
        </div>
        <div class="resultat">
          <div class="montant" data-montant-capture>250&nbsp;$</div>
          <div class="detail" data-detail-capture>500 élèves × 0,50 $</div>
        </div>
        <p class="avertissement">
          Estimation indicative. Le montant définitif est celui du bon de commande,
          établi sur le nombre d'élèves réellement saisis.
        </p>
      </div>
    </div>
    <ul class="liste-points">
      <li><strong>250 élèves</strong> — 125 $</li>
      <li><strong>500 élèves</strong> — 250 $</li>
      <li><strong>800 élèves</strong> — 400 $</li>
      <li><strong>1 200 élèves</strong> — 600 $</li>
      <li><strong>2 000 élèves</strong> — 1 000 $</li>
    </ul>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Le déroulé</span>
      <h2>Sept opérations, de vos registres à votre première liste d'appel</h2>
    </div>
    <div class="grille-etapes">
      <article class="etape"><span class="num">1</span><h3>Récupération</h3>
        <p>Nous prenons vos registres ou vos fiches d'inscription — originaux ou
           photographies lisibles.</p></article>
      <article class="etape"><span class="num">2</span><h3>Identité</h3>
        <p>Nom, postnom, prénom, sexe, date et lieu de naissance de chaque élève.</p></article>
      <article class="etape"><span class="num">3</span><h3>Responsable</h3>
        <p>Nom du responsable, téléphone, adresse, courriel s'il existe.</p></article>
      <article class="etape"><span class="num">4</span><h3>Affectation</h3>
        <p>Chaque élève est rattaché à sa classe, telle qu'elle existe dans votre
           école paramétrée.</p></article>
      <article class="etape"><span class="num">5</span><h3>Matricules et codes</h3>
        <p>Attribution des matricules et des codes d'accès permettant aux familles
           de consulter les résultats.</p></article>
      <article class="etape"><span class="num">6</span><h3>Contrôle</h3>
        <p>Détection des doublons, des dates impossibles et des fiches
           incomplètes.</p></article>
      <article class="etape"><span class="num">7</span><h3>Chargement</h3>
        <p>Mise en base et remise d'une liste de vérification à la direction.</p></article>
    </div>
  </div>
</section>

<section class="section">
  <div class="conteneur">
    <div class="grille-cartes deux">
      <article class="carte etoffee">
        <h3>Ce qu'il nous faut</h3>
        <ul class="mini-liste">
          <li>Un abonnement Ardoise actif</li>
          <li>Une école déjà paramétrée, avec ses classes créées —
              <a href="/services/installation/">voir l'installation</a></li>
          <li>Des registres lisibles ou des fiches d'inscription</li>
        </ul>
      </article>
      <article class="carte etoffee">
        <h3>Ce qui n'est pas compris</h3>
        <ul class="mini-liste">
          <li>La photographie des élèves</li>
          <li>La numérisation des pièces d'état civil</li>
          <li>La saisie des notes des années antérieures</li>
        </ul>
        <p class="apres-liste">Ces travaux peuvent être discutés séparément, mais
           ils ne sont pas dans le tarif à 0,50 $.</p>
      </article>
    </div>
  </div>
</section>
"""

    corps += faq_bloc("Questions sur la campagne de capture", questions,
                      id_section="faq-capture")

    corps += pour_aller_plus_loin([
        ("/services/installation/", "Installation",
         "L'étape préalable : des classes qui existent pour y ranger les élèves."),
        ("/fonctionnalites/gestion-scolaire/", "Le dossier élève",
         "Ce que contient une fiche une fois saisie."),
        ("/services/formation/", "Formation",
         "Former l'équipe sur vos vrais élèves, une fois la base constituée."),
        ("/securite/", "Vos données",
         "Ce que devient l'information que nous saisissons pour vous."),
    ])

    corps += cta_final(
        "Vos registres deviennent une école consultable.",
        "Donnez-nous un nombre d'élèves approximatif, nous vous renvoyons "
        "un délai et un montant.",
        [("/contact/", "Demander une estimation", "principal"),
         ("/services/", "Voir les autres services", "secondaire")])

    return rendre(
        "services/campagne-de-capture/index.html", "/services/campagne-de-capture/",
        "Campagne de capture des données élèves — Ardoise (0,50 $/élève)",
        "Nous saisissons vos élèves à partir de vos registres papier : identité, "
        "responsable, classe, matricule et code d'accès. 0,50 $ par élève, soit 250 $ "
        "pour 500 élèves.",
        corps, actif="services",
        jsonld=[f_ld,
                service_ld("Campagne de capture des données élèves",
                           "Saisie des dossiers d'élèves à partir des registres papier "
                           "d'un établissement scolaire, avec contrôle des doublons.",
                           "0.50", unite="élève"),
                faq_jsonld(questions)],
    )


def construire():
    return [hub(), installation(), formation(), capture()]
