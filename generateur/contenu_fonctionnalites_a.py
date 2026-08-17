# -*- coding: utf-8 -*-
"""
FONCTIONNALITÉS — hub + gestion scolaire + notes et bulletins.

Chaque page dédiée répond à UNE intention de recherche et décrit ce que le
produit fait réellement. Aucune fonction n'est annoncée ici qui n'existe pas
dans le dépôt : la liste vient des routes de l'API et des écrans de
l'application, pas d'une brochure.
"""

from base import (rendre, fil, hero, cta_final, faq_bloc, faq_jsonld,
                  pour_aller_plus_loin, SITE)
import illustrations


def bloc_offres(texte):
    return f"""<div class="encart-offre">
  <p><strong>Dans quelle offre&nbsp;?</strong> {texte}</p>
  <p class="liens-encart">
    <a href="/tarifs/">Voir les offres</a> ·
    <a href="/tarifs/comparer/">Comparer ligne par ligne</a>
  </p>
</div>"""


# =============================================================== HUB
def hub():
    f_html, f_ld = fil([("Accueil", "/"), ("Fonctionnalités", None)])

    corps = f_html + hero(
        "Fonctionnalités",
        "Tout ce qu'une école fait dans l'année, dans une seule plateforme",
        "Ardoise couvre le cycle complet d'un établissement : inscrire, enseigner, "
        "coter, discipliner, encaisser, proclamer, archiver. Six domaines, décrits "
        "chacun sur sa propre page — celle-ci sert à choisir par où commencer.",
        [("/tarifs/", "Voir les offres", "ocre"),
         ("/contact/", "Demander une présentation", "secondaire")],
        illustration=("fonctionnalites",
                      "Les domaines fonctionnels réunis dans Ardoise"),
    ) + """
<section class="section">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Vue d'ensemble</span>
      <h2>Six domaines fonctionnels</h2>
      <p class="chapeau">
        Ils ne sont pas indépendants, et c'est l'intérêt : un élève inscrit dans
        le premier apparaît dans les cinq autres. Une note saisie remonte au
        bulletin, au classement, au rapport de réussite et à la décision de
        passage sans qu'aucune donnée soit ressaisie.
      </p>
    </div>

    <div class="grille-cartes deux">
      <article class="carte etoffee">
        <h3><a href="/fonctionnalites/gestion-scolaire/">Gestion scolaire</a></h3>
        <p>La base de l'établissement : dossiers d'élèves et matricules, classes,
           sections et options, cours et coefficients, années scolaires découpées
           en trimestres ou en semestres, comptes du personnel et rôles.</p>
        <ul class="mini-liste">
          <li>Dossier élève complet, responsable et coordonnées</li>
          <li>Classes par cycle, vacation, titulaire et capacité</li>
          <li>Reconduction d'une année sur l'autre</li>
        </ul>
        <a class="lien-fleche" href="/fonctionnalites/gestion-scolaire/">En savoir plus</a>
      </article>

      <article class="carte etoffee">
        <h3><a href="/fonctionnalites/notes-et-bulletins/">Notes et bulletins</a></h3>
        <p>Le cœur du métier : travaux et interrogations, saisie par grille,
           validation, moyennes pondérées, classements, mentions, et les bulletins
           officiels de la RDC au format attendu.</p>
        <ul class="mini-liste">
          <li>Bulletins primaire, secondaire, terminale et annuel</li>
          <li>Classement avec règle d'égalité paramétrable</li>
          <li>Session de repêchage et décision de passage</li>
        </ul>
        <a class="lien-fleche" href="/fonctionnalites/notes-et-bulletins/">En savoir plus</a>
      </article>

      <article class="carte etoffee">
        <h3><a href="/fonctionnalites/vie-scolaire/">Vie scolaire</a></h3>
        <p>Ce qui se passe entre deux bulletins : l'appel quotidien, les absences,
           les incidents de discipline rapportés au règlement de l'école, l'emploi
           du temps et le calendrier.</p>
        <ul class="mini-liste">
          <li>Appel utilisable hors connexion</li>
          <li>Capital conduite calculé sur des règles écrites</li>
          <li>Emploi du temps par classe, par professeur, par vacation</li>
        </ul>
        <a class="lien-fleche" href="/fonctionnalites/vie-scolaire/">En savoir plus</a>
      </article>

      <article class="carte etoffee">
        <h3><a href="/fonctionnalites/finances/">Finances de l'école</a></h3>
        <p>Les frais scolaires en francs et en dollars, les encaissements et les
           reçus, puis, un cran plus loin, la caisse de l'établissement, les
           dépenses et les salaires du personnel.</p>
        <ul class="mini-liste">
          <li>Reçu numéroté à chaque encaissement</li>
          <li>Taux de change tenu par l'école</li>
          <li>Trésorerie, catégories de dépenses, paie mensuelle</li>
        </ul>
        <a class="lien-fleche" href="/fonctionnalites/finances/">En savoir plus</a>
      </article>

      <article class="carte etoffee">
        <h3><a href="/fonctionnalites/admissions-et-orientation/">Admissions et orientation</a></h3>
        <p>Le concours d'entrée, de l'inscription des candidats à la publication
           des résultats, puis l'orientation des élèves vers les options selon
           leurs vœux et leurs résultats.</p>
        <ul class="mini-liste">
          <li>Épreuves, correcteurs et classement automatique</li>
          <li>Candidats admis convertis en élèves en un geste</li>
          <li>Affectation au mérite avec vœu et solution de repli</li>
        </ul>
        <a class="lien-fleche" href="/fonctionnalites/admissions-et-orientation/">En savoir plus</a>
      </article>

      <article class="carte etoffee">
        <h3><a href="/fonctionnalites/direction-et-pilotage/">Direction et pilotage</a></h3>
        <p>Ce que le directeur regarde : effectifs, réussite, assiduité, recettes.
           Et ce qu'il envoie : messages aux parents, annonces, résultats publiés
           en ligne pour les familles.</p>
        <ul class="mini-liste">
          <li>Rapports exportables, palmarès, moyennes par cours</li>
          <li>Messages groupés, notifications, historique</li>
          <li>Archives par année et journal d'activité</li>
        </ul>
        <a class="lien-fleche" href="/fonctionnalites/direction-et-pilotage/">En savoir plus</a>
      </article>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Transversal</span>
      <h2>Ce qui traverse tous les domaines</h2>
    </div>
    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Intelligence artificielle</h3>
        <p>Assistant d'aide, appréciations de bulletin, analyse d'un fichier
           d'élèves avant import, questions sur vos données en langage naturel.</p>
        <a class="lien-fleche" href="/fonctionnalites/ia/">Ce que fait l'IA</a>
      </article>
      <article class="carte">
        <h3>Six rôles, des droits stricts</h3>
        <p>Directeur, Préfet, Secrétaire, Titulaire, Professeur, et l'accès des
           familles aux résultats. Chacun ne voit que son périmètre.</p>
        <a class="lien-fleche" href="/securite/">Comment l'accès est contrôlé</a>
      </article>
      <article class="carte">
        <h3>Téléphone et hors ligne</h3>
        <p>Ardoise s'installe comme une application. L'appel et la consultation
           continuent quand le réseau tombe, et se synchronisent au retour.</p>
        <a class="lien-fleche" href="/fonctionnalites/vie-scolaire/#hors-ligne">Le mode hors ligne</a>
      </article>
    </div>
  </div>
</section>
"""

    corps += pour_aller_plus_loin([
        ("/tarifs/comparer/", "Comparer les offres",
         "Quelle fonction est dans quelle offre, ligne par ligne."),
        ("/fonctionnalites/ia/", "L'intelligence artificielle",
         "Ce qu'elle fait, ce qu'elle ne fait pas."),
        ("/securite/", "Sécurité et données",
         "Isolation par école, rôles, traçabilité, sauvegardes."),
        ("/services/", "Se faire accompagner",
         "Installation, formation, saisie de vos élèves."),
    ])

    corps += cta_final(
        "Une démonstration vaut mieux qu'une liste.",
        "Dites-nous la taille de votre école et ce qui vous prend le plus de temps. "
        "Nous vous montrons la partie d'Ardoise qui vous concerne.",
        [("/contact/", "Demander une présentation", "principal"),
         ("/tarifs/", "Voir les offres", "secondaire")])

    return rendre(
        "fonctionnalites/index.html", "/fonctionnalites/",
        "Fonctionnalités du logiciel de gestion scolaire Ardoise",
        "Élèves, notes et bulletins RDC, présences, discipline, emploi du temps, frais "
        "scolaires, comptabilité, admissions et IA : les six domaines couverts "
        "par Ardoise.",
        corps, actif="produit", jsonld=[f_ld],
    )


# =================================================== GESTION SCOLAIRE
def gestion_scolaire():
    f_html, f_ld = fil([("Accueil", "/"), ("Fonctionnalités", "/fonctionnalites/"),
                        ("Gestion scolaire", None)])

    questions = [
        ("Peut-on importer une liste d'élèves depuis Excel&nbsp;?",
         "<p>Oui. Vous déposez votre fichier, Ardoise l'analyse et vous montre ce "
         "qu'il a compris colonne par colonne : quelle colonne contient le nom, "
         "laquelle le matricule, laquelle la classe. Vous corrigez ce qui est mal "
         "interprété, puis vous appliquez. Les doublons et les lignes incomplètes "
         "sont signalés avant l'import, pas après.</p>"),
        ("Que devient un élève qui quitte l'école en cours d'année&nbsp;?",
         "<p>Il passe en sortie avec un motif — transfert, abandon, exclusion, "
         "départ volontaire, diplômé — et une date. Il disparaît des listes "
         "d'appel et des grilles de cotes, mais son dossier, ses notes et ses "
         "paiements restent consultables dans les archives. Rien n'est effacé.</p>"),
        ("Une même personne peut-elle être professeur et titulaire&nbsp;?",
         "<p>Oui, c'est l'une des deux combinaisons de rôles autorisées, avec "
         "Préfet et Directeur. En dehors de ces deux cas, une personne n'a qu'un "
         "seul rôle : c'est ce qui rend le contrôle d'accès lisible et les "
         "responsabilités traçables.</p>"),
        ("Faut-il tout ressaisir chaque année&nbsp;?",
         "<p>Non. La reconduction reprend la structure de l'année précédente — "
         "classes, cours, coefficients, frais — et fait passer les élèves dans la "
         "classe suivante selon leurs résultats et le seuil de promotion que vous "
         "avez fixé. Vous relisez et vous ajustez ; vous ne recréez pas.</p>"),
    ]

    corps = f_html + hero(
        "Fonctionnalités · Gestion scolaire",
        "Élèves, classes et cours&nbsp;: la structure de l'école, tenue une fois pour toutes",
        "Le dossier d'un élève, la composition d'une classe, la liste des cours et "
        "leurs coefficients, le découpage de l'année : c'est le socle sur lequel "
        "reposent les notes, les bulletins, les présences et les frais. Ardoise le "
        "tient à jour à un seul endroit.",
        [("/tarifs/", "Disponible dès l'offre Ascension", "ocre"),
         ("/fonctionnalites/notes-et-bulletins/", "Voir les notes et bulletins", "secondaire")],
    
        illustration=("roles", "Les six roles et leurs perimetres"),
    ) + f"""
<section class="section">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Élèves</span>
      <h2>Un dossier par élève, et une seule liste dans toute l'école</h2>
      <p class="chapeau">
        Dans la plupart des établissements, la liste des élèves existe en quatre
        exemplaires qui ne concordent pas : celle du secrétariat, celle du
        titulaire, celle du comptable et celle affichée au mur. Ardoise n'en tient
        qu'une.
      </p>
    </div>

    <div class="grille-cartes deux">
      <article class="carte">
        <h3>Ce que contient le dossier</h3>
        <ul class="mini-liste">
          <li>Nom, postnom, prénom, sexe, date et lieu de naissance</li>
          <li>Matricule attribué par l'école, unique et vérifié</li>
          <li>Adresse, téléphone, photo</li>
          <li>Responsable : nom, téléphone, adresse, courriel</li>
          <li>Classe de l'année en cours et historique des années passées</li>
          <li>Code d'accès pour la consultation des résultats en ligne</li>
        </ul>
      </article>
      <article class="carte">
        <h3>Inscription, réinscription, sortie</h3>
        <p>Un élève est inscrit, réinscrit d'une année à l'autre, ou sorti avec un
           motif daté. Les trois mouvements laissent une trace : l'historique
           classe par classe et année par année reste attaché au dossier.</p>
        <p>Un élève resté sans aucune note sur l'année peut être sorti
           automatiquement en fin d'exercice — un réglage que l'école active ou
           non selon ses habitudes.</p>
      </article>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Structure</span>
      <h2>Sections, options, classes&nbsp;: l'organisation réelle d'un établissement congolais</h2>
    </div>

    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Sections et options</h3>
        <p>Une section regroupe des options — Scientifique, Commerciale, Pédagogie
           générale, Coupe et couture. Chaque option peut porter un critère
           d'accès : moyenne globale minimale, ou résultat minimal dans une
           branche précise. Ce critère sert ensuite à l'orientation.</p>
      </article>
      <article class="carte">
        <h3>Classes</h3>
        <p>Une classe appartient à un cycle (primaire ou secondaire), à une
           section et à une option, porte un niveau et une division, un titulaire,
           une capacité, et éventuellement une vacation — matin, après-midi — pour
           les écoles qui tournent en deux services.</p>
      </article>
      <article class="carte">
        <h3>Cours et coefficients</h3>
        <p>Chaque cours porte son maximum de points, son maximum d'examen, son
           coefficient, son domaine et son groupe de domaine. Une classe peut
           déroger au maximum d'un cours sans toucher au reste : la 6e année n'est
           pas obligée de coter comme la 1re.</p>
      </article>
    </div>

    <div class="deux-colonnes-texte">
      <div>
        <h3>Le primaire et le secondaire ne se ressemblent pas</h3>
        <p>Ardoise le sait. Le cycle primaire dispose de sa liste de cours
           officiels, de son bulletin propre et de ses règles de calcul ; le
           secondaire des siennes, avec les classes terminales traitées à part.
           Une école qui fait les deux gère les deux dans la même plateforme,
           sans mélanger les modèles.</p>
      </div>
      <div>
        <h3>Trimestres ou semestres, au choix</h3>
        <p>L'année scolaire se découpe en périodes — trimestres ou semestres —
           avec leurs dates. Une période se clôture quand tout est saisi, ce qui
           gèle les notes ; elle peut être rouverte par la direction, et
           l'opération est journalisée. Les semestres regroupent leurs périodes
           pour produire les bulletins semestriels.</p>
      </div>
    </div>
  </div>
</section>

<section class="section" id="roles">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Personnel</span>
      <h2>Six rôles, et personne ne se promène chez les autres</h2>
      <p class="chapeau">
        Le contrôle d'accès n'est pas un réglage d'affichage : il est appliqué à
        chaque requête, jusque dans la base de données.
      </p>
    </div>

    <div class="enveloppe-tableau">
      <table class="comparatif">
        <caption class="sr-only">Les rôles d'Ardoise et leur périmètre</caption>
        <thead>
          <tr><th scope="col">Rôle</th><th scope="col">Ce qu'il fait</th></tr>
        </thead>
        <tbody>
          <tr><th scope="row">Directeur</th>
            <td>Vue complète de l'établissement : structure, personnel, notes,
                finances, rapports, paramètres, clôtures et signatures.</td></tr>
          <tr><th scope="row">Préfet</th>
            <td>Le pilotage pédagogique et disciplinaire, avec les mêmes droits que
                la direction sur la scolarité.</td></tr>
          <tr><th scope="row">Secrétaire</th>
            <td>Inscriptions, dossiers d'élèves, encaissements et reçus, courriers
                et messages.</td></tr>
          <tr><th scope="row">Titulaire</th>
            <td>Sa classe : appel, discipline, appréciations, suivi des bulletins,
                et selon le réglage de l'école, leur génération.</td></tr>
          <tr><th scope="row">Professeur</th>
            <td>Ses cours dans ses classes, et rien d'autre : travaux, cotes,
                récapitulatifs.</td></tr>
          <tr><th scope="row">Famille</th>
            <td>Consultation des résultats de son enfant, par code d'accès, sur le
                site public de l'école.</td></tr>
        </tbody>
      </table>
    </div>
    <p class="note-tableau">
      Une personne ne cumule qu'exceptionnellement deux rôles : Professeur et
      Titulaire, ou Préfet et Directeur. Toute autre combinaison est refusée par
      la plateforme.
    </p>
  </div>
</section>

<section class="section alt" id="annee">
  <div class="conteneur">
    <div class="entete-illustre">
      <div class="section-entete">
        <span class="eyebrow">Fin d'année</span>
        <h2>Passer d'une année à l'autre sans tout recommencer</h2>
      </div>
      {illustrations.figure("passage-annee", "Le passage sécurisé d'une année scolaire à la suivante", "illus-section")}
    </div>
    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Reconduction</h3>
        <p>Les classes, les cours, les coefficients et la grille des frais de
           l'année qui s'achève servent de modèle à la suivante. Vous ajustez au
           lieu de ressaisir.</p>
      </article>
      <article class="carte">
        <h3>Passage de classe</h3>
        <p>Chaque élève est proposé au passage, au redoublement ou à la sortie
           selon sa moyenne annuelle et les seuils de promotion et de redoublement
           fixés par l'école. Vous voyez l'aperçu avant d'exécuter.</p>
      </article>
      <article class="carte">
        <h3>Archives</h3>
        <p>L'année close reste consultable : classes, élèves, notes, bulletins,
           paiements. Elle s'exporte par année ou par classe, en un fichier.</p>
      </article>
    </div>
  </div>
</section>
""" + f"""
<section class="section">
  <div class="conteneur">
    {bloc_offres("La gestion scolaire est incluse dans les quatre offres, sans "
                 "restriction fonctionnelle et sans limite de volume : élèves, "
                 "classes et années archivées sont illimités partout, y compris en "
                 "Ascension. Ce qui change d'une offre à l'autre, ce sont les modules "
                 "et les espaces métiers ouverts — pas le nombre d'élèves.")}
  </div>
</section>
"""

    corps += faq_bloc("Ce qu'on nous demande sur la gestion des élèves", questions)

    corps += pour_aller_plus_loin([
        ("/fonctionnalites/notes-et-bulletins/", "Notes et bulletins",
         "Ce que devient un élève une fois inscrit : cotes, moyennes, bulletin."),
        ("/fonctionnalites/vie-scolaire/", "Vie scolaire",
         "Présences, discipline et emploi du temps de la classe."),
        ("/services/campagne-de-capture/", "Campagne de capture",
         "Nous saisissons vos élèves à partir de vos registres, 0,50 $ par élève."),
        ("/services/installation/", "Installation et configuration",
         "Nous paramétrons classes, cours et coefficients à votre place."),
    ])

    corps += cta_final(
        "Votre structure est déjà écrite quelque part.",
        "Sur des registres, dans un classeur Excel, dans la tête de votre secrétaire. "
        "Nous savons la transformer en école paramétrée.",
        [("/contact/", "Nous en parler", "principal"),
         ("/services/installation/", "Voir l'installation", "secondaire")])

    return rendre(
        "fonctionnalites/gestion-scolaire/index.html",
        "/fonctionnalites/gestion-scolaire/",
        "Gestion des élèves, classes et cours — Ardoise",
        "Dossiers d'élèves et matricules, classes par section et option, cours et "
        "coefficients, années en trimestres ou semestres, rôles du personnel.",
        corps, actif="produit", jsonld=[f_ld, faq_jsonld(questions)],
    )


# ================================================= NOTES ET BULLETINS
def notes_bulletins():
    f_html, f_ld = fil([("Accueil", "/"), ("Fonctionnalités", "/fonctionnalites/"),
                        ("Notes et bulletins", None)])

    questions = [
        ("Les bulletins sont-ils au format officiel de la RDC&nbsp;?",
         "<p>Oui. Ardoise produit le bulletin primaire, le bulletin secondaire et "
         "celui des classes terminales aux formats attendus, en-tête et armoiries "
         "comprises, ainsi que le bulletin semestriel et le bulletin annuel. Une "
         "école qui utilise un modèle particulier peut en composer un dans "
         "l'éditeur de modèles, à partir de l'offre Prime.</p>"),
        ("Qui peut générer et signer un bulletin&nbsp;?",
         "<p>La direction, toujours. Les titulaires, si l'école les y autorise — "
         "soit tous, soit une liste nominative. Un bulletin signé est daté et "
         "porte le nom du signataire ; sa modification après signature est un "
         "réglage que l'école active ou refuse.</p>"),
        ("Comment sont départagés deux élèves à la même moyenne&nbsp;?",
         "<p>Par la règle d'égalité que vous choisissez pour l'établissement, "
         "appliquée uniformément à toutes les classes. Le classement n'est donc "
         "jamais le résultat d'une décision prise au cas par cas devant un "
         "parent qui conteste.</p>"),
        ("Peut-on bloquer un bulletin pour impayé&nbsp;?",
         "<p>Oui, et c'est un réglage de l'école, pas une règle imposée. Vous "
         "pouvez bloquer la remise du bulletin au-delà d'un seuil d'impayé, "
         "tolérer un pourcentage, et accorder une dérogation nominative à un "
         "élève dont la situation le justifie. La dérogation est motivée et "
         "tracée.</p>"),
        ("Une note peut-elle être modifiée après validation&nbsp;?",
         "<p>Une note validée est verrouillée pour le professeur. La direction "
         "peut la dévalider pour permettre une correction ; l'opération est "
         "inscrite au journal d'activité avec son auteur et sa date. Après "
         "clôture de la période, plus rien ne bouge sans réouverture explicite.</p>"),
    ]

    corps = f_html + hero(
        "Fonctionnalités · Notes et bulletins",
        "Des cotes saisies une fois, un bulletin prêt le jour de la proclamation",
        "Travaux, interrogations, examens, moyennes pondérées, classements, mentions, "
        "et le bulletin officiel imprimé sans avoir refait une seule addition. "
        "C'est le module qu'une école regarde en premier, et celui qui fait gagner "
        "le plus de temps.",
        [("/tarifs/", "Disponible dès l'offre Ascension", "ocre"),
         ("/tarifs/comparer/", "Comparer les offres", "secondaire")],
    
        illustration=("bulletin", "Un bulletin scolaire genere par Ardoise"),
    ) + f"""
<section class="section">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Saisie</span>
      <h2>La grille de cotes, telle qu'un professeur la remplit</h2>
      <p class="chapeau">
        Une classe, un cours, une période : la liste des élèves et les colonnes à
        remplir. Rien à chercher, rien à ouvrir dans un autre écran.
      </p>
    </div>

    <div class="grille-cartes deux">
      <article class="carte">
        <h3>Travaux et cotes</h3>
        <p>Le professeur crée ses travaux — interrogation, devoir, examen — avec
           leur maximum de points et leur ordre. Il saisit les résultats élève par
           élève, et la cote de période se compose à partir de ces travaux ou se
           saisit directement, selon la manière de travailler de l'école.</p>
        <ul class="mini-liste">
          <li>Maximum de points propre à chaque travail</li>
          <li>Récapitulatif de classe pour relire l'ensemble</li>
          <li>Fiche de cotes imprimable pour l'archivage papier</li>
        </ul>
      </article>
      <article class="carte">
        <h3>Validation et verrouillage</h3>
        <p>Une cote saisie n'est pas définitive tant qu'elle n'est pas validée. La
           validation la fige et la fait entrer dans les moyennes ; la
           dévalidation, réservée à la direction, permet la correction et laisse
           une trace.</p>
        <ul class="mini-liste">
          <li>Qui a saisi, qui a validé, à quelle date</li>
          <li>Recalcul global à la demande</li>
          <li>Clôture de période qui gèle l'ensemble</li>
        </ul>
      </article>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Calculs</span>
      <h2>Les moyennes suivent vos règles, pas celles d'un logiciel étranger</h2>
    </div>
    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Pondération</h3>
        <p>Chaque cours porte son coefficient et son maximum, avec une valeur
           dérogatoire possible par classe. Les moyennes de période, de semestre
           et d'année en découlent, exprimées en points et en pourcentage.</p>
      </article>
      <article class="carte">
        <h3>Classement</h3>
        <p>Le rang de chaque élève dans sa classe est calculé automatiquement, avec
           une règle d'égalité définie une fois pour l'établissement — ce qui rend
           le classement défendable devant un parent.</p>
      </article>
      <article class="carte">
        <h3>Mentions</h3>
        <p>Les mentions sont vos seuils, écrits une fois : libellé, borne basse,
           borne haute. Elles s'appliquent à tous les bulletins, sans intervention.</p>
      </article>
    </div>
  </div>
</section>

<section class="section" id="bulletins">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Bulletins</span>
      <h2>Cinq bulletins, tous produits depuis les mêmes données</h2>
    </div>

    <div class="grille-cartes deux">
      <article class="carte etoffee">
        <h3>Les formats officiels</h3>
        <ul class="mini-liste">
          <li><strong>Bulletin primaire</strong> — mise en page et cours officiels
              du cycle primaire</li>
          <li><strong>Bulletin secondaire</strong> — format attendu par
              l'inspection</li>
          <li><strong>Classes terminales</strong> — variante propre aux classes de
              fin de cycle</li>
          <li><strong>Bulletin semestriel</strong> — regroupement des périodes du
              semestre</li>
          <li><strong>Bulletin annuel</strong> — synthèse de l'année et décision
              de passage</li>
        </ul>
      </article>
      <article class="carte etoffee">
        <h3>Ce que le bulletin porte</h3>
        <ul class="mini-liste">
          <li>Cotes par cours, totaux, pourcentage, maximum</li>
          <li>Rang dans la classe et effectif</li>
          <li>Mention, conduite et application</li>
          <li>Observation du titulaire, rédigeable avec l'aide de l'IA</li>
          <li>Signature datée et nominative</li>
        </ul>
        <p class="apres-liste">Le fichier PDF est conservé et peut être régénéré à
           l'identique des années plus tard.</p>
      </article>
    </div>

    <div class="deux-colonnes-texte">
      <div>
        <h3>Votre propre modèle, si le vôtre est particulier</h3>
        <p>À partir de l'offre Prime, l'éditeur de modèles permet de composer le
           bulletin de votre établissement : zones, positions, polices, tailles.
           Un modèle peut être affecté à une classe pour les bulletins de période
           et un autre pour le bulletin annuel.</p>
      </div>
      <div>
        <h3>Remise conditionnée au paiement, si vous le décidez</h3>
        <p>L'école peut bloquer la remise du bulletin au-delà d'un seuil d'impayé,
           avec un pourcentage de tolérance, et accorder une dérogation motivée à
           un élève. Le réglage est explicite et réversible ; la dérogation est
           nominative et tracée.
           <a href="/fonctionnalites/finances/#impayes">Voir le contrôle des impayés</a>.</p>
      </div>
    </div>
  </div>
</section>

<section class="section alt" id="fin-annee">
  <div class="conteneur">
    <div class="entete-illustre">
      <div class="section-entete">
        <span class="eyebrow">Fin d'année</span>
        <h2>Repêchage, décision de passage, proclamation</h2>
        <p class="chapeau">
          La partie de l'année où une erreur de calcul se paie le plus cher, et où
          les additions se font traditionnellement à la main, la nuit, en salle des
          professeurs.
        </p>
      </div>
      {illustrations.figure("publication-resultats", "La validation et la publication contrôlée des résultats", "illus-section")}
    </div>

    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Session de repêchage</h3>
        <p>Vous fixez les règles : seuil d'échec par cours, nombre maximum de
           cours repêchables, fourchette de moyenne rendant éligible, politique de
           note retenue — plafonnée, remplacée ou moyennée. Ardoise établit la
           liste des élèves éligibles et des cours concernés.</p>
      </article>
      <article class="carte">
        <h3>Copies et résultats</h3>
        <p>Les cotes de repêchage sont saisies, la moyenne recalculée, et la
           décision — admis après repêchage ou redoublant — enregistrée avec la
           moyenne avant et après. La session se clôture, et le résultat entre
           dans le bulletin annuel.</p>
      </article>
      <article class="carte">
        <h3>Passage et sortie</h3>
        <p>Le seuil de promotion et le seuil de redoublement de l'école
           déterminent la proposition faite pour chaque élève. Vous validez classe
           par classe, et l'année suivante démarre avec les bons effectifs.</p>
      </article>
    </div>
  </div>
</section>
""" + f"""
<section class="section">
  <div class="conteneur">
    {bloc_offres("Notes, calculs, classements, mentions et les cinq bulletins sont "
                 "dans les quatre offres. L'éditeur de modèles de bulletins arrive avec "
                 "Prime ; la session de repêchage et les rapports avancés avec Pilote.")}
  </div>
</section>
"""

    corps += faq_bloc("Les questions des directeurs sur les bulletins", questions)

    corps += pour_aller_plus_loin([
        ("/fonctionnalites/ia/", "Appréciations générées",
         "Comment l'IA rédige les observations de bulletin, et qui garde la main."),
        ("/fonctionnalites/finances/", "Frais scolaires",
         "Le lien entre paiement et remise du bulletin."),
        ("/fonctionnalites/direction-et-pilotage/", "Rapports et palmarès",
         "Taux de réussite, moyennes par cours, palmarès de fin de période."),
        ("/tarifs/comparer/", "Comparer les offres",
         "Où s'arrête Ascension, où commence Prime."),
    ])

    corps += cta_final(
        "La prochaine proclamation peut se préparer autrement.",
        "Montrez-nous comment vous produisez vos bulletins aujourd'hui, "
        "nous vous montrons ce que ça devient.",
        [("/contact/", "Demander une présentation", "principal"),
         ("/tarifs/", "Voir les offres", "secondaire")])

    return rendre(
        "fonctionnalites/notes-et-bulletins/index.html",
        "/fonctionnalites/notes-et-bulletins/",
        "Notes, moyennes et bulletins scolaires RDC — Ardoise",
        "Saisie des cotes, moyennes pondérées, classements, mentions et bulletins "
        "officiels primaire, secondaire, terminale, semestriel et annuel.",
        corps, actif="produit", jsonld=[f_ld, faq_jsonld(questions)],
    )


def construire():
    return [hub(), gestion_scolaire(), notes_bulletins()]
