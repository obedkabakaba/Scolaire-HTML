# -*- coding: utf-8 -*-
"""
PAGE D'ACCUEIL — découverte et conversion.

Règle tenue ici : chaque bloc dit assez pour donner envie, et pas assez pour
remplacer la page dédiée. Toute section se termine donc par un lien sortant.
Rien n'est expliqué deux fois sur le site — l'accueil renvoie, il ne détaille pas.
"""

from base import SITE, rendre, cta_final
import illustrations

# Les deux illustrations de l'accueil sont posées ici plutôt qu'au fil du
# texte : le corps de la page est une longue chaîne littérale, et y interpoler
# 2 ko de SVG rendrait le contenu rédactionnel illisible pour qui vient
# corriger une phrase.
ILLUS_ECOLE = illustrations.figure(
    "ecole", "Une école utilisant Ardoise", "illus-accueil")
ILLUS_CAHIERS = illustrations.figure(
    "cahiers", "Des registres épars réunis en un seul dossier", "illus-valeur")
ILLUS_ASCENSION = illustrations.offre("ascension", "L'offre Ardoise Ascension")
ILLUS_PRIME = illustrations.offre("prime", "L'offre Ardoise Prime")
ILLUS_PILOTE = illustrations.offre("pilote", "L'offre Ardoise Pilote")
ILLUS_INFINITE = illustrations.offre("infinite", "L'offre Ardoise Infinite")

CORPS = """
<!-- ==================================================================== HERO -->
<section class="hero regle">
  <div class="conteneur grille">
    <div>
      <p class="eyebrow">Plateforme de gestion scolaire</p>
      <h1>Le logiciel qui fait tourner <span class="accent">votre école</span>, du registre au bulletin.</h1>
      <p class="chapeau">
        Ardoise centralise la gestion académique, administrative et financière d'un
        établissement : élèves, notes, bulletins officiels, présences, frais scolaires.
        Conçue pour les écoles de la République démocratique du Congo, et pour celles
        d'Afrique francophone qui travaillent avec les mêmes contraintes.
      </p>
      <div class="groupe-cta">
        <a class="bouton ocre" href="/essai/">Essayer gratuitement 7 jours</a>
        <a class="bouton secondaire" href="/tarifs/">Voir les offres</a>
      </div>
      <p class="mention-cta">
        Essai gratuit sans carte bancaire. Ensuite à partir de 30&nbsp;$ par mois,
        sans engagement en mensuel, avec un nombre d'élèves et de comptes illimité.
        Fonctionne sur téléphone, et continue de fonctionner quand la connexion tombe.
      </p>
    </div>

    <div class="colonne-hero">
    @ILLUS_ECOLE@
    <div class="etages" aria-label="Les deux étages de l'offre Ardoise">
      <div class="etage abonnement">
        <div class="titre">L'abonnement <span class="rythme">récurrent</span></div>
        <p>Ce que vous payez pour utiliser Ardoise. Quatre niveaux, du plus simple
           au plus complet, en mensuel, semestriel ou annuel.</p>
        <a class="lien-fleche" href="/tarifs/">Voir les quatre offres</a>
      </div>
      <div class="plus">+ si vous le souhaitez</div>
      <div class="etage services">
        <div class="titre">Les services <span class="rythme">ponctuel</span></div>
        <p>Ce que vous payez pour qu'on vous accompagne : installer, former votre
           équipe, saisir vos élèves. Optionnel, avec n'importe quelle offre.</p>
        <a class="lien-fleche" href="/services/">Voir les services</a>
      </div>
    </div>
    </div>
  </div>
</section>

<div class="bandeau">
  <div class="conteneur">
    <div>
      <div class="chiffre">6</div>
      <div class="libelle">rôles distincts, du Directeur au professeur de matière</div>
    </div>
    <div>
      <div class="chiffre">FC / $</div>
      <div class="libelle">double devise pour les frais, avec taux de change tenu par l'école</div>
    </div>
    <div>
      <div class="chiffre">Hors ligne</div>
      <div class="libelle">l'appel et la saisie continuent quand le réseau tombe</div>
    </div>
    <div>
      <div class="chiffre">RDC</div>
      <div class="libelle">bulletins primaire, secondaire et terminale au format officiel</div>
    </div>
  </div>
</div>

<!-- ============================================================== VALEUR -->
<section class="section">
  <div class="conteneur">
    <div class="entete-illustre">
    <div class="section-entete">
      <span class="eyebrow">Pourquoi Ardoise</span>
      <h2>Une école tient dans un seul dossier, pas dans douze cahiers</h2>
      <p class="chapeau">
        Le temps perdu dans une école ne se perd pas dans le travail : il se perd
        entre les registres. La liste des élèves est chez la secrétaire, les cotes
        chez les professeurs, les paiements dans un cahier, et personne ne sait
        lequel des trois a raison. Ardoise met les trois au même endroit.
      </p>
    </div>
    @ILLUS_CAHIERS@
    </div>

    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Une seule saisie</h3>
        <p>Un élève inscrit une fois apparaît partout : liste d'appel, grille de
           cotes, bulletin, fiche de paiement. Plus de recopie, donc plus d'écart
           entre deux listes.</p>
      </article>
      <article class="carte">
        <h3>Des chiffres justes, tout de suite</h3>
        <p>Moyennes, pourcentages, classements et mentions sont calculés par la
           plateforme selon vos règles. La proclamation ne dépend plus d'une
           addition faite trois fois à la main.</p>
      </article>
      <article class="carte">
        <h3>Chacun voit ce qui le concerne</h3>
        <p>Le professeur voit ses classes, le titulaire la sienne, le comptable
           la caisse, le directeur l'ensemble. Personne ne se promène dans les
           données des autres.</p>
      </article>
    </div>
  </div>
</section>

<!-- ======================================================= LES SIX DOMAINES -->
<section class="section alt" id="domaines">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Ce que couvre Ardoise</span>
      <h2>Six domaines, un seul produit</h2>
      <p class="chapeau">
        Chacun a sa page : le résumé ci-dessous sert à savoir où aller, pas à tout
        comprendre d'un coup.
      </p>
    </div>

    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Gestion scolaire</h3>
        <p>Élèves, classes, sections, options, cours et coefficients, années
           scolaires, trimestres ou semestres, comptes et rôles du personnel.</p>
        <a class="lien-fleche" href="/fonctionnalites/gestion-scolaire/">En savoir plus</a>
      </article>
      <article class="carte">
        <h3>Notes et bulletins</h3>
        <p>Travaux, interrogations et examens, moyennes pondérées, classements,
           mentions, bulletins officiels RDC et bulletin annuel.</p>
        <a class="lien-fleche" href="/fonctionnalites/notes-et-bulletins/">En savoir plus</a>
      </article>
      <article class="carte">
        <h3>Vie scolaire</h3>
        <p>Appel quotidien, absences justifiées, incidents de discipline, capital
           conduite, emploi du temps et calendrier de l'établissement.</p>
        <a class="lien-fleche" href="/fonctionnalites/vie-scolaire/">En savoir plus</a>
      </article>
      <article class="carte">
        <h3>Finances de l'école</h3>
        <p>Grille des frais, encaissements en francs et en dollars, reçus numérotés,
           caisse, dépenses, contrats et salaires du personnel.</p>
        <a class="lien-fleche" href="/fonctionnalites/finances/">En savoir plus</a>
      </article>
      <article class="carte">
        <h3>Admissions et orientation</h3>
        <p>Concours d'admission, épreuves et correcteurs, classement des candidats,
           vœux d'orientation et affectation au mérite.</p>
        <a class="lien-fleche" href="/fonctionnalites/admissions-et-orientation/">En savoir plus</a>
      </article>
      <article class="carte">
        <h3>Direction et pilotage</h3>
        <p>Tableau de bord, rapports d'effectifs et de réussite, messages aux
           parents, site public de l'école, archives et journal d'activité.</p>
        <a class="lien-fleche" href="/fonctionnalites/direction-et-pilotage/">En savoir plus</a>
      </article>
    </div>

    <p class="apres-grille">
      <a class="bouton secondaire" href="/fonctionnalites/">Voir toutes les fonctionnalités</a>
    </p>
  </div>
</section>

<!-- ==================================================================== IA -->
<section class="section">
  <div class="conteneur grille-deux">
    <div>
      <span class="eyebrow">Intelligence artificielle</span>
      <h2>Présente dès la première offre, pas réservée à la dernière</h2>
      <p class="chapeau">
        L'IA d'Ardoise ne remplace aucune décision pédagogique. Elle écrit les
        phrases que personne n'a le temps d'écrire, explique la plateforme à
        celui qui s'y perd, et répond aux questions qu'on poserait à une base
        de données si on savait lui parler.
      </p>
      <a class="bouton secondaire" href="/fonctionnalites/ia/">Ce que fait l'IA d'Ardoise</a>
    </div>
    <ul class="liste-points">
      <li><strong>Appréciations de bulletin</strong> — proposées pour toute une
          classe à partir des résultats réels, relues et modifiables avant d'être
          appliquées.</li>
      <li><strong>Assistant d'aide</strong> — répond dans l'écran où vous êtes,
          sur le fonctionnement d'Ardoise, sans quitter la page.</li>
      <li><strong>Vos données en langage naturel</strong> — « quels élèves de 4e
          n'ont rien payé depuis janvier ? » devient une réponse, pas un export.</li>
      <li><strong>Lecture du règlement intérieur</strong> — votre règlement
          devient un barème de discipline exploitable, que vous validez.</li>
    </ul>
  </div>
</section>

<!-- ================================================================ OFFRES -->
<section class="section alt" id="offres">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Tarifs</span>
      <h2>Quatre offres, un seul produit</h2>
      <p class="chapeau">
        Aucune offre n'est une version amputée : le cœur du métier — élèves, notes,
        bulletins, présences, frais — est dans les quatre, sans limite de nombre
        d'élèves ni de comptes. Ce qui change est l'étendue des métiers couverts
        et la profondeur de l'administration.
      </p>
    </div>

    <div class="grille-offres compacte">
      <article class="offre" data-offre="ascension" data-devise="USD"
        data-prix-mensuel="30"  data-mois-mensuel="30"    data-eco-mensuel="0"  data-pct-mensuel="0"
        data-prix-semestriel="165" data-mois-semestriel="27.50" data-eco-semestriel="15" data-pct-semestriel="8"
        data-prix-annuel="300"  data-mois-annuel="25"  data-eco-annuel="60"  data-pct-annuel="17">
        @ILLUS_ASCENSION@
        <h3 class="nom">Ascension</h3>
        <div class="positionnement">Digitaliser l'essentiel</div>
        <div class="prix" data-prix><span class="devise">$</span>300<span class="periode-prix">/ an</span></div>
        <div class="par-mois" data-par-mois>soit 25&nbsp;$ par mois</div>
        <div class="cible">Le cœur du métier, élèves illimités.</div>
        <a class="bouton secondaire pleine-largeur" href="/tarifs/#ascension">Détail de l'offre</a>
      </article>

      <article class="offre mise-en-avant" data-offre="prime" data-devise="USD"
        data-prix-mensuel="59"  data-mois-mensuel="59"    data-eco-mensuel="0"  data-pct-mensuel="0"
        data-prix-semestriel="325" data-mois-semestriel="54.17" data-eco-semestriel="29" data-pct-semestriel="8"
        data-prix-annuel="590"  data-mois-annuel="49.17"  data-eco-annuel="118" data-pct-annuel="17">
        <span class="badge">Le plus choisi</span>
        @ILLUS_PRIME@
        <h3 class="nom">Prime</h3>
        <div class="positionnement">Automatiser et communiquer</div>
        <div class="prix" data-prix><span class="devise">$</span>590<span class="periode-prix">/ an</span></div>
        <div class="par-mois" data-par-mois>soit 49,17&nbsp;$ par mois</div>
        <div class="cible">Emploi du temps, discipline, communication.</div>
        <a class="bouton ocre pleine-largeur" href="/tarifs/#prime">Détail de l'offre</a>
      </article>

      <article class="offre" data-offre="pilote" data-devise="USD"
        data-prix-mensuel="99"  data-mois-mensuel="99"    data-eco-mensuel="0"  data-pct-mensuel="0"
        data-prix-semestriel="545" data-mois-semestriel="90.83" data-eco-semestriel="49" data-pct-semestriel="8"
        data-prix-annuel="990"  data-mois-annuel="82.50"  data-eco-annuel="198" data-pct-annuel="17">
        @ILLUS_PILOTE@
        <h3 class="nom">Pilote</h3>
        <div class="positionnement">Piloter l'établissement</div>
        <div class="prix" data-prix><span class="devise">$</span>990<span class="periode-prix">/ an</span></div>
        <div class="par-mois" data-par-mois>soit 82,50&nbsp;$ par mois</div>
        <div class="cible">Comptabilité, concours, orientation.</div>
        <a class="bouton secondaire pleine-largeur" href="/tarifs/#pilote">Détail de l'offre</a>
      </article>

      <article class="offre" data-offre="infinite" data-devise="USD"
        data-prix-mensuel="159" data-mois-mensuel="159"   data-eco-mensuel="0"  data-pct-mensuel="0"
        data-prix-semestriel="875" data-mois-semestriel="145.83" data-eco-semestriel="79" data-pct-semestriel="8"
        data-prix-annuel="1590" data-mois-annuel="132.50" data-eco-annuel="318" data-pct-annuel="17">
        @ILLUS_INFINITE@
        <h3 class="nom">Infinite</h3>
        <div class="positionnement">Exploiter Ardoise de bout en bout</div>
        <div class="prix" data-prix><span class="devise">$</span>1&#8239;590<span class="periode-prix">/ an</span></div>
        <div class="par-mois" data-par-mois>soit 132,50&nbsp;$ par mois</div>
        <div class="cible">Analytique avancée, WhatsApp, support prioritaire.</div>
        <a class="bouton secondaire pleine-largeur" href="/tarifs/#infinite">Détail de l'offre</a>
      </article>
    </div>

    <p class="apres-grille">
      <a class="bouton secondaire" href="/tarifs/">Voir les tarifs en détail</a>
      <a class="bouton secondaire" href="/tarifs/comparer/">Comparer les quatre offres</a>
    </p>
  </div>
</section>

<!-- ============================================================== SERVICES -->
<section class="section">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Services complémentaires</span>
      <h2>Si vous préférez qu'on s'en occupe</h2>
      <p class="chapeau">
        Trois prestations ponctuelles, achetables avec n'importe quelle offre, y
        compris la première. Aucune n'est obligatoire : une école peut tout faire
        elle-même, guidée par le didacticiel intégré.
      </p>
    </div>

    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Installation et configuration</h3>
        <p class="tarif-carte">60&nbsp;$ — forfait</p>
        <p>Nous paramétrons votre école à partir de vos documents : années, périodes,
           classes, cours, coefficients, mentions, grille des frais.</p>
        <a class="lien-fleche" href="/services/installation/">Ce qui est fait, précisément</a>
      </article>
      <article class="carte">
        <h3>Formation du personnel</h3>
        <p class="tarif-carte">30, 60 ou 100&nbsp;$</p>
        <p>De la séance de prise en main à la formation bâtie sur vos propres
           circuits internes, profil par profil.</p>
        <a class="lien-fleche" href="/services/formation/">Les trois formules</a>
      </article>
      <article class="carte">
        <h3>Campagne de capture</h3>
        <p class="tarif-carte">0,50&nbsp;$ par élève</p>
        <p>Nous transformons vos registres papier en base de données : identité,
           classe, responsable, matricule, contrôle des doublons.</p>
        <a class="lien-fleche" href="/services/campagne-de-capture/">Comment ça se passe</a>
      </article>
    </div>
  </div>
</section>

<!-- ============================================================== SÉCURITÉ -->
<section class="section alt">
  <div class="conteneur grille-deux">
    <div>
      <span class="eyebrow">Sécurité et accompagnement</span>
      <h2>Les données d'une école ne sortent pas de l'école</h2>
      <p class="chapeau">
        L'isolation entre établissements n'est pas une promesse commerciale : elle
        est appliquée par la base de données elle-même, sous chaque requête, pour
        chaque table. Une école ne peut pas lire les élèves d'une autre, même en
        cas d'erreur de programmation.
      </p>
      <a class="bouton secondaire" href="/securite/">Comment les données sont protégées</a>
    </div>
    <ul class="liste-points">
      <li><strong>Six rôles, des droits stricts</strong> — un professeur n'accède
          qu'à ses cours, un titulaire à sa classe.</li>
      <li><strong>Tout est tracé</strong> — qui a saisi, modifié, validé, signé,
          encaissé, et quand.</li>
      <li><strong>Vos données restent les vôtres</strong> — export des archives
          par année et par classe, à tout moment.</li>
      <li><strong>Une aide qui répond</strong> — didacticiel intégré, assistant
          d'aide, support par ticket depuis la plateforme.</li>
    </ul>
  </div>
</section>
"""

CORPS += """
<section class="section alt" aria-labelledby="guides-accueil">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Guides de gestion scolaire</span>
      <h2 id="guides-accueil">Préparer la décision avant de choisir l'outil</h2>
      <p class="chapeau">Des ressources pratiques, écrites pour les directions
         d'école qui veulent comparer, budgéter et déployer sans improviser.</p>
    </div>
    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Choisir un logiciel en RDC</h3>
        <p>Sept critères à tester : bulletins, rôles, sécurité, réseau, données,
           accompagnement et coût complet.</p>
        <a class="lien-fleche" href="/guides/choisir-logiciel-gestion-scolaire-rdc/">Lire le guide</a>
      </article>
      <article class="carte">
        <h3>Excel ou logiciel scolaire ?</h3>
        <p>Les cas où Excel suffit encore et les signaux qui indiquent qu'il est
           devenu risqué pour l'école.</p>
        <a class="lien-fleche" href="/guides/excel-ou-logiciel-gestion-scolaire/">Voir le comparatif</a>
      </article>
      <article class="carte">
        <h3>Calculer le budget réel</h3>
        <p>Abonnement, installation, formation, saisie initiale et temps interne,
           avec trois exemples chiffrés.</p>
        <a class="lien-fleche" href="/guides/prix-logiciel-gestion-scolaire-rdc/">Calculer le budget</a>
      </article>
    </div>
    <p class="apres-grille"><a class="bouton secondaire" href="/guides/">Voir tous les guides</a></p>
  </div>
</section>
"""

CORPS += cta_final(
    "Votre école, tenue à jour toute seule.",
    "Choisissez l'offre qui correspond à sa taille. L'accompagnement viendra si "
    "vous en avez besoin — et seulement à ce moment-là.",
    [("/tarifs/", "Voir les tarifs", "principal"),
     ("/contact/", "Être rappelé", "secondaire")],
)


JSONLD = [
    {
        "@type": "SoftwareApplication",
        "@id": f"{SITE}/#logiciel",
        "name": "Ardoise",
        "applicationCategory": "BusinessApplication",
        "applicationSubCategory": "Logiciel de gestion scolaire",
        "operatingSystem": "Web, Android, iOS",
        "inLanguage": "fr",
        "url": f"{SITE}/",
        "description": ("Plateforme de gestion scolaire qui centralise la gestion académique, "
                        "administrative et financière d'un établissement : élèves, notes, "
                        "bulletins officiels, présences, emploi du temps, frais scolaires "
                        "et comptabilité."),
        "featureList": [
            "Gestion des élèves et des classes",
            "Saisie des notes et calcul des moyennes",
            "Génération des bulletins officiels RDC",
            "Présences et discipline",
            "Frais scolaires et paiements",
            "Emploi du temps",
            "Comptabilité et paie",
            "Assistance par intelligence artificielle",
        ],
        "offers": [
            {"@type": "Offer", "name": "Ardoise Ascension", "price": "30", "priceCurrency": "USD",
             "url": f"{SITE}/tarifs/", "availability": "https://schema.org/InStock"},
            {"@type": "Offer", "name": "Ardoise Prime", "price": "59", "priceCurrency": "USD",
             "url": f"{SITE}/tarifs/", "availability": "https://schema.org/InStock"},
            {"@type": "Offer", "name": "Ardoise Pilote", "price": "99", "priceCurrency": "USD",
             "url": f"{SITE}/tarifs/", "availability": "https://schema.org/InStock"},
            {"@type": "Offer", "name": "Ardoise Infinite", "price": "159", "priceCurrency": "USD",
             "url": f"{SITE}/tarifs/", "availability": "https://schema.org/InStock"},
        ],
    },
    {
        "@type": "Organization",
        "@id": f"{SITE}/#organisation",
        "name": "Ardoise",
        "url": f"{SITE}/",
        "logo": f"{SITE}/icone-512.png",
        "founder": {"@type": "Person", "name": "Obed Kabakaba"},
        "email": "myardoise@gmail.com",
        "address": {"@type": "PostalAddress", "addressLocality": "Kinshasa",
                    "addressCountry": "CD"},
        "contactPoint": {"@type": "ContactPoint", "telephone": "+243855035693",
                         "contactType": "customer support", "availableLanguage": "fr"},
        "areaServed": [{"@type": "Country", "name": "République démocratique du Congo"}],
        "knowsAbout": ["gestion scolaire", "bulletins scolaires RDC", "digitalisation des écoles"],
    },
    {
        "@type": "WebSite",
        "@id": f"{SITE}/#site",
        "name": "Ardoise",
        "url": f"{SITE}/",
        "inLanguage": "fr",
        "publisher": {"@id": f"{SITE}/#organisation"},
    },
]


# Les marqueurs sont remplacés une seule fois, après que le corps ait été
# entièrement assemblé (le bloc CTA final s'y ajoute plus haut).
CORPS = (CORPS
         .replace("@ILLUS_ECOLE@", ILLUS_ECOLE)
         .replace("@ILLUS_CAHIERS@", ILLUS_CAHIERS)
         .replace("@ILLUS_ASCENSION@", ILLUS_ASCENSION)
         .replace("@ILLUS_PRIME@", ILLUS_PRIME)
         .replace("@ILLUS_PILOTE@", ILLUS_PILOTE)
         .replace("@ILLUS_INFINITE@", ILLUS_INFINITE))


def construire():
    return rendre(
        "index.html", "/",
        "Logiciel de gestion scolaire pour les écoles de la RDC — Ardoise",
        "Élèves, notes, bulletins officiels, présences et frais scolaires en une seule "
        "plateforme pour les écoles de la RDC. Essai gratuit 7 jours, puis dès 30 $/mois.",
        CORPS, actif=None, jsonld=JSONLD,
    )
