# -*- coding: utf-8 -*-
"""Guides éditoriaux et page de confiance du site public Ardoise.

Ces pages répondent à des questions réelles de direction d'école. Elles ne
répètent pas les fiches produit : chacune traite une décision complète, avec
des critères, une méthode et des liens vers les fonctionnalités concernées.
"""

from base import (SITE, DATE, rendre, fil, hero, cta_final,
                  pour_aller_plus_loin)


def article_ld(url, titre, description):
    return {
        "@type": "Article",
        "headline": titre,
        "description": description,
        "datePublished": DATE,
        "dateModified": DATE,
        "inLanguage": "fr-CD",
        "mainEntityOfPage": f"{SITE}{url}",
        "author": {"@type": "Organization", "name": "Ardoise", "url": SITE},
        "publisher": {
            "@type": "Organization",
            "name": "Ardoise",
            "url": SITE,
            "logo": {"@type": "ImageObject", "url": f"{SITE}/icone-512.png"},
        },
    }


def sommaire(items):
    liens = "".join(f'<li><a href="#{ancre}">{libelle}</a></li>'
                    for ancre, libelle in items)
    return f'''<nav class="sommaire-guide" aria-label="Sommaire de ce guide">
  <p>Dans ce guide</p>
  <ol>{liens}</ol>
</nav>'''


def hub():
    f_html, f_ld = fil([("Accueil", "/"), ("Guides", None)])
    corps = f_html + hero(
        "Ressources pour les écoles",
        "Des guides concrets pour mieux gérer et digitaliser une école",
        "Choisir un logiciel, préparer les données, travailler malgré une connexion "
        "instable et calculer le vrai budget : ces guides répondent aux décisions "
        "qu'une direction doit prendre avant de changer ses habitudes.",
        [("/contact/", "Poser une question", "secondaire")],
    ) + '''
<section class="section">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Commencer ici</span>
      <h2>Cinq décisions, cinq guides indépendants</h2>
      <p class="chapeau">Lisez seulement celui qui correspond au problème du jour.
         Chaque guide contient des critères vérifiables, pas une suite de promesses.</p>
    </div>
    <div class="grille-cartes deux">
      <article class="carte etoffee">
        <p class="meta-guide">Choix · 9 min</p>
        <h3><a href="/guides/choisir-logiciel-gestion-scolaire-rdc/">Comment choisir un logiciel de gestion scolaire en RDC ?</a></h3>
        <p>Les critères à vérifier pendant une démonstration : bulletins, rôles,
           sécurité, connexion, export des données, accompagnement et coût total.</p>
        <a class="lien-fleche" href="/guides/choisir-logiciel-gestion-scolaire-rdc/">Lire le guide</a>
      </article>
      <article class="carte etoffee">
        <p class="meta-guide">Méthode · 10 min</p>
        <h3><a href="/guides/digitaliser-ecole-rdc/">Comment digitaliser une école étape par étape ?</a></h3>
        <p>Une méthode en sept étapes, de l'inventaire des registres au bilan du
           premier mois, avec un pilote qui n'interrompt pas l'année scolaire.</p>
        <a class="lien-fleche" href="/guides/digitaliser-ecole-rdc/">Lire le guide</a>
      </article>
      <article class="carte etoffee">
        <p class="meta-guide">Comparatif · 8 min</p>
        <h3><a href="/guides/excel-ou-logiciel-gestion-scolaire/">Excel ou logiciel de gestion scolaire : que choisir ?</a></h3>
        <p>Les situations où Excel suffit encore, celles où il devient risqué, et
           les signes qui indiquent qu'une école doit passer à un système partagé.</p>
        <a class="lien-fleche" href="/guides/excel-ou-logiciel-gestion-scolaire/">Lire le comparatif</a>
      </article>
      <article class="carte etoffee">
        <p class="meta-guide">Terrain · 7 min</p>
        <h3><a href="/guides/logiciel-scolaire-connexion-instable/">Quel logiciel scolaire quand Internet est instable ?</a></h3>
        <p>Ce que « hors ligne » doit réellement vouloir dire, comment tester la
           synchronisation et quelles tâches ne doivent jamais dépendre du réseau.</p>
        <a class="lien-fleche" href="/guides/logiciel-scolaire-connexion-instable/">Lire le guide</a>
      </article>
      <article class="carte etoffee">
        <p class="meta-guide">Budget · 7 min</p>
        <h3><a href="/guides/prix-logiciel-gestion-scolaire-rdc/">Combien coûte un logiciel de gestion scolaire en RDC ?</a></h3>
        <p>Abonnement, installation, formation, saisie initiale et temps interne :
           une méthode simple pour calculer le budget de la première année.</p>
        <a class="lien-fleche" href="/guides/prix-logiciel-gestion-scolaire-rdc/">Calculer le budget</a>
      </article>
    </div>
  </div>
</section>
<section class="section alt">
  <div class="conteneur grille-deux">
    <div>
      <span class="eyebrow">Principe éditorial</span>
      <h2>Un bon guide doit aussi permettre de ne pas choisir Ardoise</h2>
      <p class="chapeau">Une petite école dont les fichiers sont propres, les accès
         bien contrôlés et les bulletins fiables peut raisonnablement rester sur
         Excel. Une direction doit d'abord identifier son problème, puis choisir
         l'outil — jamais l'inverse.</p>
    </div>
    <ul class="liste-points">
      <li><strong>Des critères testables</strong>, à reprendre pendant une démonstration.</li>
      <li><strong>Des coûts séparés</strong> entre abonnement et services facultatifs.</li>
      <li><strong>Des limites nommées</strong>, notamment sur le fonctionnement hors ligne.</li>
      <li><strong>Un contexte congolais</strong> : double devise, réseau irrégulier et bulletins RDC.</li>
    </ul>
  </div>
</section>
'''
    corps += cta_final(
        "Vous préparez la digitalisation de votre école ?",
        "Décrivez votre effectif, vos cycles et ce qui vous fait perdre du temps. "
        "Nous vous dirons par où commencer.",
        [("/contact/", "Parler de mon école", "principal"),
         ("/fonctionnalites/", "Voir le produit", "secondaire")])
    return rendre(
        "guides/index.html", "/guides/",
        "Guides de gestion scolaire et digitalisation en RDC — Ardoise",
        "Guides pratiques pour choisir un logiciel scolaire, digitaliser une école "
        "en RDC, comparer Excel, travailler hors ligne et calculer son budget.",
        corps, actif="ressources", jsonld=[f_ld, {
            "@type": "CollectionPage", "name": "Guides de gestion scolaire Ardoise",
            "url": f"{SITE}/guides/", "inLanguage": "fr-CD",
        }],
    )


def choisir():
    url = "/guides/choisir-logiciel-gestion-scolaire-rdc/"
    titre_article = "Comment choisir un logiciel de gestion scolaire en RDC ?"
    description = ("Sept critères concrets pour évaluer un logiciel scolaire en RDC : "
                   "bulletins, rôles, sécurité, connexion, données, support et budget.")
    f_html, f_ld = fil([
        ("Accueil", "/"), ("Guides", "/guides/"),
        ("Choisir un logiciel scolaire", None),
    ])
    corps = f_html + hero(
        "Guide de décision · 9 minutes",
        titre_article,
        "Une démonstration réussie ne prouve pas qu'un logiciel tiendra pendant la "
        "proclamation, l'encaissement des frais ou une coupure de réseau. Voici les "
        "vérifications à faire avec vos propres règles et vos propres documents.",
        [("/tarifs/comparer/", "Comparer les offres Ardoise", "secondaire")],
    ) + sommaire([
        ("besoin", "Partir des problèmes de l'école"),
        ("criteres", "Les sept critères à vérifier"),
        ("demonstration", "Organiser une vraie démonstration"),
        ("decision", "Décider sans se faire enfermer"),
    ]) + '''
<article class="article-guide">
  <section class="section" id="besoin">
    <div class="conteneur etroit">
      <h2>1. Écrivez d'abord ce que l'école veut corriger</h2>
      <p>« Nous voulons nous digitaliser » est trop vague pour choisir. Une direction
         doit nommer trois à cinq difficultés mesurables : les bulletins prennent dix
         jours, les paiements ne concordent pas avec la caisse, l'appel arrive trop
         tard, les listes d'élèves diffèrent entre le secrétariat et les titulaires,
         ou les archives d'une ancienne année sont introuvables.</p>
      <p>Classez ensuite ces difficultés par risque. Une erreur de note ou de caisse
         est plus grave qu'un rapport lent. Cette hiérarchie évite d'acheter une
         longue liste de fonctions spectaculaires qui ne résout pas le problème
         principal.</p>
      <div class="encart">
        <h3>Document à préparer avant toute démonstration</h3>
        <p>Prenez un bulletin réellement utilisé, une grille de frais, un horaire,
           la liste des rôles du personnel et un fichier d'élèves anonymisé. Demandez
           au fournisseur de montrer le parcours complet avec ces contraintes.</p>
      </div>
    </div>
  </section>

  <section class="section alt" id="criteres">
    <div class="conteneur">
      <div class="section-entete">
        <span class="eyebrow">Grille d'évaluation</span>
        <h2>2. Vérifiez sept critères qui survivront à la démonstration</h2>
      </div>
      <div class="grille-cartes deux">
        <article class="carte etoffee"><h3>Conformité académique</h3>
          <p>Le logiciel doit gérer les cycles de l'école, ses périodes, cours,
             coefficients et modèles de bulletin. Faites produire un bulletin
             primaire ou secondaire RDC, puis vérifiez une moyenne à la main.</p></article>
        <article class="carte etoffee"><h3>Droits par métier</h3>
          <p>Demandez ce que voient le directeur, le préfet, le secrétaire, le
             comptable, le titulaire et le professeur. Un menu caché ne suffit pas :
             l'accès doit aussi être refusé par le serveur.</p></article>
        <article class="carte etoffee"><h3>Traçabilité</h3>
          <p>Modifiez une note, annulez un paiement ou rouvrez une période. Le journal
             doit conserver l'auteur, l'heure, la cible et, pour une action sensible,
             le motif.</p></article>
        <article class="carte etoffee"><h3>Réseau et appareils</h3>
          <p>Testez sur un téléphone courant, avec un débit faible, puis coupez le
             réseau. Demandez précisément quelles opérations restent disponibles et
             comment les saisies se synchronisent.</p></article>
        <article class="carte etoffee"><h3>Propriété des données</h3>
          <p>Vérifiez les exports disponibles avant la signature : élèves, résultats,
             paiements, archives et bulletins. Une école doit pouvoir partir sans
             perdre son histoire.</p></article>
        <article class="carte etoffee"><h3>Accompagnement</h3>
          <p>Distinguez l'aide incluse, l'installation, la formation et la saisie
             initiale. Demandez qui répond, par quel canal, dans quel délai et ce que
             coûte chaque intervention.</p></article>
        <article class="carte etoffee"><h3>Coût complet</h3>
          <p>Comparez sur douze mois : abonnement, configuration, formation, saisie,
             matériel éventuel et temps du personnel. Le tarif mensuel seul ne décrit
             pas le coût de la transition.</p></article>
      </div>
    </div>
  </section>

  <section class="section" id="demonstration">
    <div class="conteneur etroit">
      <h2>3. Demandez une démonstration qui ressemble à une journée d'école</h2>
      <ol class="liste-points numerotee">
        <li><strong>Inscrire un élève</strong>, l'affecter à une classe et retrouver
            sa fiche depuis un autre rôle.</li>
        <li><strong>Saisir des notes</strong>, fermer la période, corriger une erreur
            et produire le bulletin utilisé par l'établissement.</li>
        <li><strong>Enregistrer un paiement</strong> en FC ou en dollars, imprimer un
            reçu, annuler l'opération et vérifier le journal.</li>
        <li><strong>Faire l'appel sur téléphone</strong> avec le réseau coupé, puis
            observer la synchronisation au retour de la connexion.</li>
        <li><strong>Exporter une classe</strong> et demander ce qui est récupérable
            si l'abonnement s'arrête.</li>
      </ol>
      <p>Attribuez une note de 0 à 3 à chaque test : absent, seulement annoncé,
         démontré avec difficulté, ou démontré complètement. La même grille doit être
         utilisée pour tous les fournisseurs.</p>
    </div>
  </section>

  <section class="section alt" id="decision">
    <div class="conteneur etroit">
      <h2>4. Commencez petit, mais préparez la sortie</h2>
      <p>Une école n'a pas besoin de basculer toutes ses opérations le même lundi.
         Un pilote sur une classe, une période ou un processus réduit le risque. Il
         faut toutefois fixer avant le test les conditions de réussite : temps de
         production des bulletins, taux de dossiers complets, écarts de caisse ou
         délai de remontée des présences.</p>
      <p>Enfin, lisez les règles de changement d'offre, de dépassement, de résiliation
         et d'export. Une solution est saine quand elle explique clairement comment
         entrer, évoluer et sortir.</p>
    </div>
  </section>
</article>
'''
    corps += pour_aller_plus_loin([
        ("/guides/digitaliser-ecole-rdc/", "Plan de digitalisation", "Passer du choix au déploiement."),
        ("/guides/prix-logiciel-gestion-scolaire-rdc/", "Calculer le budget", "Voir le coût complet sur un an."),
        ("/securite/", "Sécurité des données", "Comprendre les contrôles d'accès."),
        ("/fonctionnalites/", "Fonctionnalités Ardoise", "Vérifier Ardoise critère par critère."),
    ])
    corps += cta_final(
        "Testez ces critères sur Ardoise.",
        "Nous pouvons faire la démonstration à partir des documents de votre école.",
        [("/contact/", "Demander une démonstration", "principal"),
         ("/guides/", "Voir les autres guides", "secondaire")])
    return rendre(
        "guides/choisir-logiciel-gestion-scolaire-rdc/index.html", url,
        "Choisir un logiciel de gestion scolaire en RDC — Guide",
        description, corps, actif="ressources",
        jsonld=[f_ld, article_ld(url, titre_article, description)], og_type="article")


def digitaliser():
    url = "/guides/digitaliser-ecole-rdc/"
    titre_article = "Comment digitaliser une école en RDC, étape par étape"
    description = ("Méthode en sept étapes pour digitaliser une école en RDC sans "
                   "perturber l'année : données, équipe, pilote, formation et suivi.")
    f_html, f_ld = fil([
        ("Accueil", "/"), ("Guides", "/guides/"),
        ("Digitaliser une école", None),
    ])
    corps = f_html + hero(
        "Guide de mise en œuvre · 10 minutes",
        titre_article,
        "La difficulté n'est pas d'ouvrir des comptes. Elle est de transformer des "
        "registres, des habitudes et des responsabilités sans perdre une note, un "
        "paiement ou une journée de cours.",
        [("/services/installation/", "Voir l'installation accompagnée", "secondaire")],
    ) + sommaire([
        ("diagnostic", "Faire l'inventaire"),
        ("equipe", "Nommer l'équipe de transition"),
        ("donnees", "Nettoyer les données"),
        ("pilote", "Lancer un pilote"),
        ("deploiement", "Former et déployer"),
        ("mesure", "Mesurer après 30 jours"),
    ]) + '''
<article class="article-guide">
  <section class="section" id="diagnostic">
    <div class="conteneur etroit">
      <h2>1. Faire l'inventaire avant de saisir quoi que ce soit</h2>
      <p>Listez les sources actuelles : registres d'inscription, fichiers Excel,
         cahiers de frais, listes des cours, horaires, grilles de points et modèles
         de bulletin. Pour chaque document, notez qui le tient, à quelle fréquence
         il change et quelle autre personne en possède une copie.</p>
      <p>L'objectif est d'identifier la source officielle. Si trois listes donnent
         trois orthographes pour le même élève, la digitalisation ne doit pas choisir
         au hasard : une personne responsable tranche avant l'import.</p>
    </div>
  </section>

  <section class="section alt" id="equipe">
    <div class="conteneur etroit">
      <h2>2. Nommer une petite équipe de transition</h2>
      <p>Le directeur porte la décision, mais ne doit pas devenir l'unique personne
         qui configure. Désignez au minimum un responsable des données académiques,
         un responsable financier et une personne capable d'aider les utilisateurs
         au quotidien. Chacun valide son périmètre.</p>
      <div class="grille-cartes trois">
        <article class="carte"><h3>Direction</h3><p>Décide des règles, des rôles et du calendrier.</p></article>
        <article class="carte"><h3>Secrétariat</h3><p>Valide les élèves, classes et dossiers.</p></article>
        <article class="carte"><h3>Finance</h3><p>Valide frais, soldes initiaux et procédures d'annulation.</p></article>
      </div>
    </div>
  </section>

  <section class="section" id="donnees">
    <div class="conteneur etroit">
      <h2>3. Nettoyer et importer dans le bon ordre</h2>
      <ol class="liste-points numerotee">
        <li><strong>Structure de l'année</strong> : cycles, sections, options,
            classes, périodes et calendrier.</li>
        <li><strong>Référentiel académique</strong> : cours, coefficients,
            enseignants et affectations.</li>
        <li><strong>Élèves et responsables</strong> : matricules, identités,
            contacts, classes et doublons.</li>
        <li><strong>Règles financières</strong> : catégories de frais, échéances,
            devises et soldes de départ vérifiés.</li>
        <li><strong>Historique utile</strong> : n'importez que ce qui servira à une
            décision ou à une obligation d'archive.</li>
      </ol>
      <p>Conservez une copie figée des fichiers sources et un rapport de ce qui a été
         importé, corrigé ou rejeté. La qualité de la première base détermine la
         confiance des utilisateurs.</p>
    </div>
  </section>

  <section class="section alt" id="pilote">
    <div class="conteneur etroit">
      <h2>4. Tester un parcours complet sur un périmètre limité</h2>
      <p>Choisissez une classe représentative, pas nécessairement la plus facile.
         Pendant une à deux semaines, réalisez l'inscription, l'appel, la saisie des
         points, un paiement, une correction et un bulletin. Comparez le résultat au
         processus habituel.</p>
      <div class="encart">
        <h3>Ne maintenez pas deux vérités trop longtemps</h3>
        <p>Papier et logiciel peuvent coexister pendant le pilote. Dès que le parcours
           est validé, fixez une date à laquelle le système devient la source
           officielle. Sinon, chaque écart relance le débat sur « la bonne liste ».</p>
      </div>
    </div>
  </section>

  <section class="section" id="deploiement">
    <div class="conteneur etroit">
      <h2>5. Former chaque rôle sur ses gestes, puis élargir</h2>
      <p>Une formation générale de trois heures produit souvent peu de maîtrise.
         Montrez plutôt à chaque rôle les cinq à dix actions qu'il répétera : faire
         l'appel, saisir et valider les notes, encaisser et annuler, fermer une
         période, produire un rapport. Utilisez les vraies classes de l'école.</p>
      <p>Déployez ensuite par vague : secrétariat et structure, enseignants et vie
         scolaire, finances, puis rapports de direction. Prévoyez une personne de
         contact et un canal unique pour les incidents.</p>
    </div>
  </section>

  <section class="section alt" id="mesure">
    <div class="conteneur etroit">
      <h2>6. Mesurer le résultat au bout de 30 jours</h2>
      <ul class="liste-points">
        <li><strong>Dossiers complets</strong> : pourcentage d'élèves sans donnée essentielle manquante.</li>
        <li><strong>Délai de traitement</strong> : temps entre une saisie et son rapport ou bulletin.</li>
        <li><strong>Écarts corrigés</strong> : doublons, paiements sans justificatif, notes hors barème.</li>
        <li><strong>Utilisation réelle</strong> : rôles actifs et opérations réalisées, pas seulement comptes créés.</li>
        <li><strong>Incidents récurrents</strong> : ce qui exige une règle, une formation ou une correction.</li>
      </ul>
      <p>Le bilan doit produire une courte liste d'ajustements et un responsable pour
         chacun. La digitalisation est réussie quand le fonctionnement devient plus
         fiable, pas quand tous les écrans ont été visités.</p>
    </div>
  </section>
</article>
'''
    corps += pour_aller_plus_loin([
        ("/services/installation/", "Installation", "Faire paramétrer l'école par l'équipe Ardoise."),
        ("/services/formation/", "Formation", "Former chaque rôle sur ses propres données."),
        ("/services/campagne-de-capture/", "Campagne de capture", "Confier la saisie initiale des élèves."),
        ("/guides/excel-ou-logiciel-gestion-scolaire/", "Excel ou logiciel", "Savoir quand changer d'outil."),
    ])
    corps += cta_final(
        "Construisons le plan de votre école.",
        "L'installation reste facultative : vous pouvez suivre ce guide seul ou nous confier le paramétrage.",
        [("/contact/", "Préparer mon déploiement", "principal"),
         ("/services/", "Voir les services", "secondaire")])
    return rendre(
        "guides/digitaliser-ecole-rdc/index.html", url,
        "Comment digitaliser une école en RDC — Guide pratique",
        description, corps, actif="ressources",
        jsonld=[f_ld, article_ld(url, titre_article, description)], og_type="article")


def excel_ou_logiciel():
    url = "/guides/excel-ou-logiciel-gestion-scolaire/"
    titre_article = "Excel ou logiciel de gestion scolaire : que choisir ?"
    description = ("Comparatif pratique entre Excel et un logiciel de gestion scolaire : "
                   "coût, collaboration, sécurité, bulletins, paiements et croissance.")
    f_html, f_ld = fil([
        ("Accueil", "/"), ("Guides", "/guides/"),
        ("Excel ou logiciel scolaire", None),
    ])
    corps = f_html + hero(
        "Comparatif · 8 minutes",
        titre_article,
        "Excel n'est pas un mauvais outil. Il devient le mauvais outil quand plusieurs "
        "personnes doivent modifier les mêmes données, avec des droits différents et "
        "une trace fiable de chaque changement.",
    ) + sommaire([
        ("comparaison", "Comparer les deux approches"),
        ("excel-suffit", "Quand Excel peut suffire"),
        ("signaux", "Les signes qu'il faut changer"),
        ("transition", "Passer sans perdre ses données"),
    ]) + '''
<article class="article-guide">
  <section class="section" id="comparaison">
    <div class="conteneur">
      <div class="section-entete"><span class="eyebrow">Vue d'ensemble</span>
        <h2>La différence n'est pas le nombre de colonnes</h2></div>
      <div class="enveloppe-tableau">
        <table class="comparatif tableau-guide">
          <thead><tr><th>Besoin</th><th>Excel</th><th>Logiciel scolaire</th></tr></thead>
          <tbody>
            <tr><th scope="row">Démarrage</th><td>Rapide si le modèle existe déjà</td><td>Configuration initiale nécessaire</td></tr>
            <tr><th scope="row">Coût direct</th><td>Faible ou déjà absorbé</td><td>Abonnement et éventuels services</td></tr>
            <tr><th scope="row">Travail simultané</th><td>Conflits de versions possibles</td><td>Base unique partagée</td></tr>
            <tr><th scope="row">Droits d'accès</th><td>Difficiles à limiter cellule par cellule</td><td>Droits définis par rôle et action</td></tr>
            <tr><th scope="row">Historique</th><td>Versions du fichier, peu lisibles</td><td>Journal des actions sensibles</td></tr>
            <tr><th scope="row">Bulletins</th><td>Formules et publipostage à maintenir</td><td>Calcul et modèles intégrés</td></tr>
            <tr><th scope="row">Frais scolaires</th><td>Risque de copies et suppressions</td><td>Reçus, annulations et caisse liés</td></tr>
            <tr><th scope="row">Croissance</th><td>Complexité qui augmente vite</td><td>Structure conçue pour plusieurs rôles</td></tr>
            <tr><th scope="row">Sortie des données</th><td>Le fichier est déjà disponible</td><td>Dépend de la qualité des exports</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section alt" id="excel-suffit">
    <div class="conteneur etroit">
      <h2>Quand Excel peut encore être le bon choix</h2>
      <p>Excel peut suffire pour un petit établissement si une seule personne tient
         chaque fichier, si les règles de calcul sont stables, si les sauvegardes
         sont réellement faites et si les informations sensibles ne circulent pas
         par clés USB ou messageries privées.</p>
      <p>Il faut alors protéger les cellules de formule, documenter les colonnes,
         attribuer un identifiant unique à chaque élève, conserver une copie en
         lecture seule à chaque clôture et tester la restauration des sauvegardes.
         Un fichier bien gouverné vaut mieux qu'un logiciel mal adopté.</p>
    </div>
  </section>

  <section class="section" id="signaux">
    <div class="conteneur etroit">
      <h2>Six signes qu'Excel est devenu une dette</h2>
      <ul class="liste-points">
        <li><strong>Les mêmes élèves existent dans plusieurs fichiers</strong> et les listes ne concordent plus.</li>
        <li><strong>Plusieurs personnes s'échangent des copies</strong> nommées « final », « final2 » ou « corrigé ».</li>
        <li><strong>Une formule cassée est découverte à la proclamation</strong>, après impression des bulletins.</li>
        <li><strong>Le mot de passe du fichier donne accès à tout</strong>, sans distinguer professeur, comptable et direction.</li>
        <li><strong>Personne ne peut dire qui a changé une note ou supprimé un paiement</strong>.</li>
        <li><strong>Le départ d'une seule personne bloque l'école</strong>, parce qu'elle seule comprend les fichiers.</li>
      </ul>
      <p>Deux ou trois de ces signes justifient au minimum un audit du processus. Le
         passage à un logiciel devient prioritaire quand les erreurs touchent les
         résultats, l'argent ou la confidentialité des élèves.</p>
    </div>
  </section>

  <section class="section alt" id="transition">
    <div class="conteneur etroit">
      <h2>Passer d'Excel à un logiciel sans repartir de zéro</h2>
      <ol class="liste-points numerotee">
        <li>Figer une copie de chaque fichier et nommer sa personne responsable.</li>
        <li>Choisir un identifiant stable pour les élèves et supprimer les doublons.</li>
        <li>Normaliser dates, classes, sexes, numéros et noms de colonnes.</li>
        <li>Importer d'abord un échantillon et contrôler les rejets.</li>
        <li>Comparer les effectifs et soldes avant de valider l'import complet.</li>
        <li>Archiver le fichier source sans continuer à le modifier après la bascule.</li>
      </ol>
      <div class="encart"><h3>Question décisive à poser au fournisseur</h3>
        <p>« Montrez-nous l'import d'un vrai fichier imparfait, les erreurs détectées
           et l'écran de validation avant écriture. » Un import fiable explique ce
           qu'il refuse ; il ne transforme pas silencieusement les données.</p></div>
    </div>
  </section>
</article>
'''
    corps += pour_aller_plus_loin([
        ("/guides/digitaliser-ecole-rdc/", "Réussir la transition", "Le plan de déploiement en sept étapes."),
        ("/fonctionnalites/gestion-scolaire/", "Dossiers et imports", "Voir comment Ardoise structure les données."),
        ("/securite/", "Accès et traçabilité", "Comparer les protections au fichier partagé."),
        ("/tarifs/", "Tarifs Ardoise", "Comparer le coût au temps et aux risques actuels."),
    ])
    corps += cta_final(
        "Vous pouvez nous montrer un fichier anonymisé.",
        "Nous vous indiquerons ce qui peut être importé, ce qui doit être nettoyé et quelle offre correspond à l'effectif.",
        [("/contact/", "Évaluer mes fichiers", "principal"),
         ("/guides/", "Voir les guides", "secondaire")])
    return rendre(
        "guides/excel-ou-logiciel-gestion-scolaire/index.html", url,
        "Excel ou logiciel de gestion scolaire : le comparatif",
        description, corps, actif="ressources",
        jsonld=[f_ld, article_ld(url, titre_article, description)], og_type="article")


def connexion_instable():
    url = "/guides/logiciel-scolaire-connexion-instable/"
    titre_article = "Quel logiciel scolaire quand Internet est instable ?"
    description = ("Guide pour choisir un logiciel scolaire adapté à une connexion "
                   "instable : mode hors ligne, synchronisation, conflits, sécurité et tests.")
    f_html, f_ld = fil([
        ("Accueil", "/"), ("Guides", "/guides/"),
        ("Logiciel scolaire et connexion instable", None),
    ])
    corps = f_html + hero(
        "Guide terrain · 7 minutes",
        titre_article,
        "« Fonctionne hors ligne » peut désigner une page déjà ouverte comme une "
        "véritable saisie synchronisée. Une école doit savoir exactement ce qui reste "
        "possible pendant la coupure et ce qui se passe au retour du réseau.",
        [("/fonctionnalites/vie-scolaire/#hors-ligne", "Le hors-ligne dans Ardoise", "secondaire")],
    ) + sommaire([
        ("definition", "Définir le vrai besoin hors ligne"),
        ("tests", "Faire cinq tests"),
        ("conflits", "Comprendre la synchronisation"),
        ("organisation", "Prévoir une procédure de secours"),
    ]) + '''
<article class="article-guide">
  <section class="section" id="definition">
    <div class="conteneur etroit">
      <h2>1. Toutes les tâches n'ont pas le même besoin de réseau</h2>
      <p>L'appel doit pouvoir se faire au début du cours, même pendant une coupure.
         Consulter une liste récemment chargée peut aussi être utile. En revanche,
         produire un rapport consolidé ou modifier les paramètres de l'école peut
         raisonnablement attendre la reconnexion.</p>
      <p>Écrivez les tâches critiques et demandez pour chacune : l'écran s'ouvre-t-il,
         les données sont-elles lisibles, peut-on saisir, la saisie reste-t-elle sur
         l'appareil, et comment sait-on qu'elle est enfin arrivée au serveur ?</p>
    </div>
  </section>

  <section class="section alt" id="tests">
    <div class="conteneur">
      <div class="section-entete"><span class="eyebrow">Démonstration</span>
        <h2>2. Cinq tests à faire avec le mode avion</h2></div>
      <div class="grille-cartes deux">
        <article class="carte etoffee"><h3>Ouverture</h3><p>Chargez la classe, fermez l'application, activez le mode avion et rouvrez. Une simple page restée à l'écran n'est pas un mode hors ligne.</p></article>
        <article class="carte etoffee"><h3>Saisie</h3><p>Enregistrez plusieurs présences. L'interface doit distinguer clairement « conservé sur l'appareil » de « envoyé au serveur ».</p></article>
        <article class="carte etoffee"><h3>Redémarrage</h3><p>Éteignez puis rallumez le téléphone avant la reconnexion. Les saisies en attente ne doivent pas disparaître.</p></article>
        <article class="carte etoffee"><h3>Reconnexion</h3><p>Rétablissez le réseau et vérifiez le statut, l'heure de synchronisation et le résultat depuis un autre compte.</p></article>
        <article class="carte etoffee"><h3>Débit faible</h3><p>Testez aussi une connexion lente, plus fréquente qu'une coupure totale. L'application doit éviter de recharger inutilement de gros fichiers.</p></article>
      </div>
    </div>
  </section>

  <section class="section" id="conflits">
    <div class="conteneur etroit">
      <h2>3. Demandez ce qui se passe quand deux personnes modifient la même chose</h2>
      <p>Le risque principal n'est pas la coupure : c'est le conflit. Un titulaire
         corrige une présence hors ligne pendant qu'un responsable la modifie depuis
         un autre appareil. Au retour du réseau, le logiciel doit avoir une règle
         compréhensible : conserver la version la plus récente, donner priorité à un
         rôle, ou demander une résolution.</p>
      <p>Pour une donnée sensible, l'historique doit conserver les deux gestes. Une
         synchronisation qui écrase silencieusement une modification crée une fausse
         impression de fiabilité.</p>
      <div class="encart"><h3>Le cadenas du téléphone compte aussi</h3>
        <p>Les données gardées hors ligne se trouvent temporairement sur l'appareil.
           Il faut donc une session verrouillable, une déconnexion à distance et une
           politique simple en cas de téléphone perdu ou partagé.</p></div>
    </div>
  </section>

  <section class="section alt" id="organisation">
    <div class="conteneur etroit">
      <h2>4. Le logiciel ne remplace pas une procédure de coupure</h2>
      <ul class="liste-points">
        <li><strong>Charger les classes utiles</strong> avant la journée si le réseau est prévisible.</li>
        <li><strong>Identifier les saisies en attente</strong> avant de changer d'appareil ou de se déconnecter.</li>
        <li><strong>Ne pas partager un même compte</strong> : l'historique perdrait l'auteur réel.</li>
        <li><strong>Vérifier la synchronisation</strong> à une heure fixée, sans ressaisir immédiatement sur papier.</li>
        <li><strong>Conserver un secours minimal</strong> pour une panne longue ou un appareil indisponible.</li>
      </ul>
      <p>Dans Ardoise, le hors-ligne vise d'abord l'appel et la consultation d'écrans
         déjà chargés. Les opérations qui exigent une vue consolidée ou un contrôle
         serveur attendent la connexion. Cette limite doit être connue avant le
         déploiement.</p>
    </div>
  </section>
</article>
'''
    corps += pour_aller_plus_loin([
        ("/fonctionnalites/vie-scolaire/", "Présences et hors-ligne", "Voir les fonctions concernées dans Ardoise."),
        ("/guides/choisir-logiciel-gestion-scolaire-rdc/", "Choisir un logiciel", "La grille complète de démonstration."),
        ("/securite/", "Sécurité", "Protéger les sessions et les données scolaires."),
        ("/faq/", "Questions fréquentes", "Les réponses sur appareils et connexion."),
    ])
    corps += cta_final(
        "Testez Ardoise dans les conditions de votre école.",
        "Une démonstration utile peut se faire sur téléphone, avec le réseau volontairement coupé.",
        [("/contact/", "Organiser le test", "principal"),
         ("/fonctionnalites/vie-scolaire/", "Voir la vie scolaire", "secondaire")])
    return rendre(
        "guides/logiciel-scolaire-connexion-instable/index.html", url,
        "Logiciel scolaire et connexion Internet instable — Guide",
        description, corps, actif="ressources",
        jsonld=[f_ld, article_ld(url, titre_article, description)], og_type="article")


def prix_logiciel():
    url = "/guides/prix-logiciel-gestion-scolaire-rdc/"
    titre_article = "Combien coûte un logiciel de gestion scolaire en RDC ?"
    description = ("Calculez le budget réel d'un logiciel scolaire en RDC : abonnement, "
                   "installation, formation, saisie initiale et temps du personnel.")
    f_html, f_ld = fil([
        ("Accueil", "/"), ("Guides", "/guides/"),
        ("Prix d'un logiciel scolaire", None),
    ])
    corps = f_html + hero(
        "Guide budget · 7 minutes",
        titre_article,
        "Le prix affiché couvre rarement toute la première année. Pour comparer deux "
        "solutions, séparez l'usage récurrent du logiciel, la mise en place, la "
        "formation et le travail de préparation des données.",
        [("/tarifs/", "Voir les tarifs Ardoise", "secondaire")],
    ) + sommaire([
        ("postes", "Les cinq postes du budget"),
        ("ardoise", "Les prix Ardoise"),
        ("exemples", "Trois exemples de première année"),
        ("comparer", "Comparer correctement"),
    ]) + '''
<article class="article-guide">
  <section class="section" id="postes">
    <div class="conteneur">
      <div class="section-entete"><span class="eyebrow">Coût complet</span>
        <h2>1. Comptez cinq postes, même quand certains valent zéro</h2></div>
      <div class="grille-cartes trois">
        <article class="carte etoffee"><h3>Abonnement</h3><p>Le droit d'utiliser la plateforme, généralement lié à l'effectif, aux fonctions ou aux deux.</p></article>
        <article class="carte etoffee"><h3>Configuration</h3><p>Création de l'année, des classes, cours, périodes, règles et comptes du personnel.</p></article>
        <article class="carte etoffee"><h3>Formation</h3><p>Temps consacré à rendre chaque rôle autonome sur ses gestes quotidiens.</p></article>
        <article class="carte etoffee"><h3>Données initiales</h3><p>Nettoyage, dédoublonnage, saisie ou import des élèves et soldes de départ.</p></article>
        <article class="carte etoffee"><h3>Temps interne</h3><p>Heures du personnel mobilisées pour vérifier les données, tester et accompagner la transition.</p></article>
      </div>
      <p class="note-tableau">Ajoutez aussi le matériel seulement s'il est réellement nécessaire. Un logiciel web utilisable sur les téléphones et ordinateurs existants ne devrait pas imposer un appareil par utilisateur.</p>
    </div>
  </section>

  <section class="section alt" id="ardoise">
    <div class="conteneur etroit">
      <h2>2. Chez Ardoise, abonnement et services sont séparés</h2>
      <p>Les offres mensuelles sont Ascension à 35 $, Prime à 59 $, Pilote à 99 $
         et Infinite à 159 $. Le paiement annuel correspond à dix mensualités :
         respectivement 350 $, 590 $, 990 $ et 1 590 $. Les fonctions et plafonds
         exacts figurent dans le <a href="/tarifs/comparer/">tableau comparatif</a>.</p>
      <p>La configuration par l'équipe Ardoise coûte 60 $ en forfait unique. La
         formation coûte 30, 60 ou 100 $ selon la formule. La campagne de capture
         est facultative et facturée 0,50 $ par élève. Une école qui se configure,
         se forme et importe elle-même ne paie aucun de ces services.</p>
    </div>
  </section>

  <section class="section" id="exemples">
    <div class="conteneur">
      <div class="section-entete"><span class="eyebrow">Exemples transparents</span>
        <h2>3. Trois budgets de première année</h2>
        <p class="chapeau">Ces calculs utilisent les tarifs publiés d'Ardoise. Ils
           ne comprennent pas le temps interne de l'école.</p></div>
      <div class="grille-cartes trois">
        <article class="carte etoffee">
          <h3>École de 200 élèves</h3>
          <p class="tarif-carte">350 $ seule · 570 $ accompagnée</p>
          <p>Ascension annuelle : 350 $. Avec installation 60 $, formation complète
             60 $ et capture de 200 élèves 100 $ : total 570 $.</p>
        </article>
        <article class="carte etoffee">
          <h3>École de 500 élèves</h3>
          <p class="tarif-carte">590 $ seule · 960 $ accompagnée</p>
          <p>Prime annuelle : 590 $. Avec installation 60 $, formation complète
             60 $ et capture de 500 élèves 250 $ : total 960 $.</p>
        </article>
        <article class="carte etoffee">
          <h3>École de 1 200 élèves</h3>
          <p class="tarif-carte">990 $ seule · 1 750 $ accompagnée</p>
          <p>Pilote annuelle : 990 $. Avec installation 60 $, formation personnalisée
             100 $ et capture de 1 200 élèves 600 $ : total 1 750 $.</p>
        </article>
      </div>
      <p class="note-tableau">« Accompagnée » signifie ici que les trois services facultatifs sont pris. Une école peut en choisir un, deux ou aucun.</p>
    </div>
  </section>

  <section class="section alt" id="comparer">
    <div class="conteneur etroit">
      <h2>4. Comparez le coût par élève et le coût des erreurs évitées</h2>
      <p>Divisez le budget annuel par l'effectif pour obtenir un coût par élève. Puis
         confrontez-le au temps actuellement consacré à recopier les listes, corriger
         les bulletins, rechercher les paiements et reconstituer les archives.</p>
      <p>Ne transformez pas toutes les erreurs en dollars imaginaires. Mesurez plutôt
         trois indicateurs avant et après : heures de préparation des bulletins,
         écarts de caisse non expliqués et dossiers incomplets. Ce sont eux qui diront
         si l'investissement améliore réellement le fonctionnement.</p>
      <div class="encart"><h3>Questions à poser avant de signer</h3>
        <p>Le prix augmente-t-il pendant l'année ? Que se passe-t-il au dépassement ?
           Les sauvegardes, mises à jour, exports et support sont-ils inclus ? Peut-on
           arrêter sans payer la période suivante ?</p></div>
    </div>
  </section>
</article>
'''
    corps += pour_aller_plus_loin([
        ("/tarifs/", "Tarifs Ardoise", "Voir chaque offre et chaque périodicité."),
        ("/tarifs/comparer/", "Comparer les offres", "Vérifier fonctions et plafonds."),
        ("/services/", "Services facultatifs", "Installation, formation et capture séparées."),
        ("/guides/choisir-logiciel-gestion-scolaire-rdc/", "Choisir un logiciel", "Évaluer au-delà du prix."),
    ])
    corps += cta_final(
        "Obtenez un budget adapté à votre effectif.",
        "Indiquez le nombre d'élèves et les services souhaités ; nous détaillerons chaque ligne.",
        [("/contact/", "Demander un chiffrage", "principal"),
         ("/tarifs/", "Voir les offres", "secondaire")])
    return rendre(
        "guides/prix-logiciel-gestion-scolaire-rdc/index.html", url,
        "Prix d'un logiciel de gestion scolaire en RDC — Guide",
        description, corps, actif="ressources",
        jsonld=[f_ld, article_ld(url, titre_article, description)], og_type="article")


def a_propos():
    url = "/a-propos/"
    f_html, f_ld = fil([("Accueil", "/"), ("À propos", None)])
    corps = f_html + hero(
        "À propos d'Ardoise",
        "Un logiciel scolaire construit à Kinshasa pour les réalités du terrain",
        "Ardoise est une plateforme de gestion scolaire éditée par Obed Kabakaba. "
        "Elle part de contraintes concrètes des écoles congolaises : bulletins RDC, "
        "double devise, connexion irrégulière et responsabilités clairement séparées.",
        [("/contact/", "Parler avec Ardoise", "principal")],
    ) + '''
<section class="section">
  <div class="conteneur grille-deux">
    <div>
      <span class="eyebrow">Le projet</span>
      <h2>Réunir ce que l'école tient aujourd'hui dans plusieurs cahiers</h2>
      <p class="chapeau">Ardoise centralise les élèves, les cours, les présences,
         les notes, les bulletins, les frais scolaires et les rapports. Le produit
         est destiné aux établissements primaires et secondaires de la République
         démocratique du Congo, puis aux écoles francophones qui partagent des
         besoins proches.</p>
    </div>
    <ul class="liste-points">
      <li><strong>Édité à Kinshasa</strong>, au plus près du contexte d'utilisation.</li>
      <li><strong>Conçu pour plusieurs métiers</strong>, pas pour un compte administrateur partagé.</li>
      <li><strong>Abonnement distinct des services</strong>, afin de ne pas imposer une installation ou une formation.</li>
      <li><strong>Données exportables</strong>, parce que l'histoire d'une école lui appartient.</li>
    </ul>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete"><span class="eyebrow">Engagements</span>
      <h2>Ce qui guide les choix du produit</h2></div>
    <div class="grille-cartes trois">
      <article class="carte etoffee"><h3>Le métier avant l'effet</h3><p>Une fonction doit réduire une erreur, un délai ou une ambiguïté de responsabilité. L'IA propose et explique ; elle ne décide pas à la place de l'école.</p></article>
      <article class="carte etoffee"><h3>Des limites visibles</h3><p>Les quotas, plafonds, rôles, fonctions hors ligne et services payants doivent être expliqués avant la souscription.</p></article>
      <article class="carte etoffee"><h3>Une trace quand cela compte</h3><p>Notes, paiements, clôtures et paramètres sensibles doivent conserver leur auteur et leur date.</p></article>
    </div>
  </div>
</section>

<section class="section">
  <div class="conteneur grille-deux">
    <div>
      <span class="eyebrow">Éditeur</span>
      <h2>Obed Kabakaba</h2>
      <p class="chapeau">Fondateur et éditeur d'Ardoise, basé à Kinshasa,
         République démocratique du Congo.</p>
      <p class="groupe-cta">
        <a class="bouton ocre" href="mailto:myardoise@gmail.com">myardoise@gmail.com</a>
        <a class="bouton secondaire" href="https://wa.me/243855035693" rel="noopener">WhatsApp : 0855 035 693</a>
      </p>
    </div>
    <aside class="encart" style="margin-top:0">
      <h2>Informations publiques</h2>
      <ul class="mini-liste">
        <li>Nom du produit : Ardoise</li>
        <li>Activité : logiciel de gestion scolaire</li>
        <li>Zone principale : Kinshasa et RDC</li>
        <li>Site officiel : myardoise.com</li>
        <li><a href="/confidentialite.html">Politique de confidentialité</a></li>
      </ul>
    </aside>
  </div>
</section>
'''
    corps += pour_aller_plus_loin([
        ("/fonctionnalites/", "Le produit", "Comprendre les six domaines couverts."),
        ("/securite/", "Sécurité", "Lire les garanties et les limites."),
        ("/guides/", "Les guides", "Voir notre manière d'expliquer les décisions."),
        ("/contact/", "Contact", "Décrire votre école ou demander une démonstration."),
    ])
    return rendre(
        "a-propos/index.html", url,
        "À propos d'Ardoise — logiciel scolaire conçu à Kinshasa",
        "Découvrez Ardoise, logiciel de gestion scolaire édité par Obed Kabakaba à "
        "Kinshasa pour les écoles de la RDC et d'Afrique francophone.",
        corps, actif="ressources", jsonld=[f_ld, {
            "@type": "AboutPage", "name": "À propos d'Ardoise", "url": f"{SITE}{url}",
            "mainEntity": {
                "@type": "Organization", "name": "Ardoise", "url": SITE,
                "founder": {"@type": "Person", "name": "Obed Kabakaba"},
                "email": "myardoise@gmail.com",
                "address": {"@type": "PostalAddress", "addressLocality": "Kinshasa",
                            "addressCountry": "CD"},
                "contactPoint": {"@type": "ContactPoint", "telephone": "+243855035693",
                                 "contactType": "customer support", "availableLanguage": "fr"},
            },
        }])


def construire():
    return [hub(), choisir(), digitaliser(), excel_ou_logiciel(),
            connexion_instable(), prix_logiciel(), a_propos()]
