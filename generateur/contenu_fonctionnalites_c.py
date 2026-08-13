# -*- coding: utf-8 -*-
"""FONCTIONNALITÉS — admissions et orientation, direction et pilotage, IA."""

from base import (rendre, fil, hero, cta_final, faq_bloc, faq_jsonld,
                  pour_aller_plus_loin)
from contenu_fonctionnalites_a import bloc_offres
import illustrations


# ============================================ ADMISSIONS ET ORIENTATION
def admissions():
    f_html, f_ld = fil([("Accueil", "/"), ("Fonctionnalités", "/fonctionnalites/"),
                        ("Admissions et orientation", None)])

    questions = [
        ("Un candidat admis doit-il être ressaisi comme élève&nbsp;?",
         "<p>Non. La conversion transforme les candidats admis en élèves inscrits, "
         "avec leur identité, leur responsable et leur affectation de classe. "
         "L'école peut même la rendre automatique à la publication des résultats. "
         "Le lien entre le candidat et l'élève est conservé, ce qui permet de "
         "retrouver la copie d'admission des années plus tard.</p>"),
        ("Peut-on faire corriger les épreuves par plusieurs enseignants&nbsp;?",
         "<p>Oui. Chaque épreuve reçoit son correcteur, qui ne voit que les copies "
         "de son épreuve et saisit ses points sans accéder au classement général. "
         "Le total et le rang ne sont composés qu'une fois toutes les épreuves "
         "renseignées.</p>"),
        ("Comment fonctionne l'orientation au mérite&nbsp;?",
         "<p>L'élève exprime un vœu et une option de repli. Chaque option porte "
         "son critère — moyenne globale minimale, ou résultat minimal dans une "
         "branche — et chaque classe sa capacité. La répartition classe les élèves "
         "éligibles par mérite et remplit les options dans la limite des places. "
         "La direction garde la main : toute décision peut être forcée, avec un "
         "motif enregistré.</p>"),
        ("Faut-il organiser un test pour utiliser le module&nbsp;?",
         "<p>Non. Une session peut fonctionner sur dossier plutôt que sur épreuve : "
         "vous inscrivez les candidats, vous décidez, vous publiez. Le mode test "
         "n'est qu'une des façons de conduire une admission.</p>"),
    ]

    corps = f_html + hero(
        "Fonctionnalités · Admissions et orientation",
        "Du concours d'entrée à l'affectation en option, sans tableau Excel",
        "Une session d'admission, ses épreuves, ses correcteurs, ses candidats, son "
        "classement et sa publication. Puis, pour les élèves déjà inscrits, "
        "l'orientation vers les options selon leurs vœux, leurs résultats et les "
        "places disponibles.",
        [("/tarifs/", "Disponible avec l'offre Pilote", "ocre"),
         ("/tarifs/comparer/", "Comparer les offres", "secondaire")],
    
        illustration=("concours", "Un classement de candidats et son affectation"),
    ) + """
<section class="section" id="concours">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Concours d'admission</span>
      <h2>Une session, de l'inscription du premier candidat à la proclamation</h2>
      <p class="chapeau">
        Le concours d'entrée est le moment de l'année où une école manipule le plus
        de chiffres en le moins de temps, souvent sur un classeur partagé entre
        trois personnes.
      </p>
    </div>

    <div class="grille-etapes">
      <article class="etape">
        <span class="num">1</span>
        <h3>Ouvrir la session</h3>
        <p>Libellé, année cible, classes visées, nombre de places, dates
           d'ouverture et de clôture, date du test. Une session peut viser une
           classe précise ou plusieurs.</p>
      </article>
      <article class="etape">
        <span class="num">2</span>
        <h3>Inscrire les candidats</h3>
        <p>Numéro de candidat attribué automatiquement, identité, responsable et
           coordonnées, école de provenance. Le dossier est constitué une fois et
           servira à l'inscription définitive.</p>
      </article>
      <article class="etape">
        <span class="num">3</span>
        <h3>Composer et corriger</h3>
        <p>Les épreuves portent leur maximum et leur ordre. Chaque épreuve reçoit
           son correcteur, qui ne voit que ses copies. Les points sont saisis
           épreuve par épreuve.</p>
      </article>
      <article class="etape">
        <span class="num">4</span>
        <h3>Classer et décider</h3>
        <p>Total et rang calculés, liste ordonnée, candidats recommandés signalés
           avec leur motif. La direction admet, refuse ou met en attente, et
           enregistre le désistement d'un candidat.</p>
      </article>
      <article class="etape">
        <span class="num">5</span>
        <h3>Publier</h3>
        <p>Les résultats sont publiés, avec la date et le nom de celui qui a
           publié. Les familles peuvent les consulter sur le site public de
           l'école.</p>
      </article>
      <article class="etape">
        <span class="num">6</span>
        <h3>Convertir en élèves</h3>
        <p>Les admis deviennent des élèves inscrits, affectés à leur classe, sans
           aucune ressaisie. Automatiquement si l'école l'a réglé ainsi.</p>
      </article>
    </div>
  </div>
</section>

<section class="section alt" id="orientation">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Orientation</span>
      <h2>Répartir les élèves entre les options, au mérite et sans contestation</h2>
      <p class="chapeau">
        Le passage en section, en fin de cycle d'orientation, produit chaque année
        les mêmes discussions. Une règle écrite d'avance et appliquée par la
        plateforme les raccourcit beaucoup.
      </p>
    </div>

    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Le vœu et le repli</h3>
        <p>Chaque élève exprime l'option qu'il souhaite et celle qu'il accepterait
           à défaut. Les deux sont enregistrées, ce qui évite de rappeler les
           familles une par une quand une option est pleine.</p>
      </article>
      <article class="carte">
        <h3>Le critère de l'option</h3>
        <p>Une option peut exiger une moyenne globale minimale, ou un résultat
           minimal dans une branche donnée — les mathématiques pour la
           scientifique, par exemple. Le critère est défini une fois, en clair.</p>
      </article>
      <article class="carte">
        <h3>La répartition</h3>
        <p>Ardoise classe les élèves éligibles et remplit les options dans la
           limite des capacités, puis affecte chacun à une classe. La direction
           peut forcer une décision, avec un motif qui reste attaché au dossier.</p>
      </article>
    </div>
  </div>
</section>
""" + f"""
<section class="section">
  <div class="conteneur">
    {bloc_offres("Le concours d'admission et l'orientation au mérite font partie de "
                 "l'offre Pilote et de l'offre Infinite. Une école plus petite qui "
                 "organise un test d'entrée a intérêt à prendre Pilote même en dessous "
                 "de 600 élèves.")}
  </div>
</section>
"""

    corps += faq_bloc("Concours et orientation", questions)

    corps += pour_aller_plus_loin([
        ("/fonctionnalites/gestion-scolaire/", "Gestion scolaire",
         "Sections, options et classes : la structure que l'orientation remplit."),
        ("/fonctionnalites/direction-et-pilotage/", "Site public de l'école",
         "Où les familles consultent les résultats publiés."),
        ("/tarifs/", "L'offre Pilote",
         "Ce qu'elle contient d'autre : comptabilité, paie, rapports avancés."),
        ("/services/installation/", "Installation",
         "Nous préparons sections, options et critères avec vous."),
    ])

    corps += cta_final(
        "Le prochain concours peut se tenir sans classeur partagé.",
        "Dites-nous combien de candidats vous attendez et combien d'épreuves vous "
        "faites composer.",
        [("/contact/", "Demander une présentation", "principal"),
         ("/tarifs/", "Voir l'offre Pilote", "secondaire")])

    return rendre(
        "fonctionnalites/admissions-et-orientation/index.html",
        "/fonctionnalites/admissions-et-orientation/",
        "Concours d'admission et orientation des élèves — Ardoise",
        "Sessions d'admission, épreuves et correcteurs, classement des candidats, "
        "publication des résultats, conversion en élèves et orientation au mérite.",
        corps, actif="produit", jsonld=[f_ld, faq_jsonld(questions)],
    )


# ============================================== DIRECTION ET PILOTAGE
def direction():
    f_html, f_ld = fil([("Accueil", "/"), ("Fonctionnalités", "/fonctionnalites/"),
                        ("Direction et pilotage", None)])

    questions = [
        ("Les parents reçoivent-ils vraiment les messages&nbsp;?",
         "<p>Un message part vers les canaux dont vous disposez : notification dans "
         "la plateforme pour le personnel, courriel pour les responsables dont "
         "l'adresse est connue, et assistant WhatsApp en offre Infinite. "
         "L'historique indique pour chaque envoi le nombre de destinataires "
         "atteints et le nombre d'échecs — vous savez ce qui est parti et ce qui "
         "n'est pas parti.</p>"),
        ("Que voit une famille sur le site public de l'école&nbsp;?",
         "<p>Ce que l'école publie : présentation, annonces, calendrier, et, avec "
         "le code d'accès de l'élève, ses résultats. Aucune donnée d'un autre "
         "élève n'est accessible, et le site se désactive d'un réglage.</p>"),
        ("Peut-on récupérer ses données&nbsp;?",
         "<p>Oui. Les archives s'exportent par année scolaire ou par classe. Les "
         "bulletins déjà produits restent téléchargeables. Vos données ne sont pas "
         "otages de l'abonnement.</p>"),
        ("Que trouve-t-on dans le journal d'activité&nbsp;?",
         "<p>Les actions qui engagent : création et modification de dossiers, "
         "validation et dévalidation de notes, signature de bulletins, "
         "encaissements, clôture et réouverture de période, changements de "
         "paramètres. Chaque ligne porte son auteur, sa cible et sa date.</p>"),
    ]

    corps = f_html + hero(
        "Fonctionnalités · Direction et pilotage",
        "Ce que le directeur regarde, et ce qu'il envoie",
        "Effectifs, taux de réussite, assiduité, recouvrement, palmarès : les chiffres "
        "d'un établissement, disponibles sans les demander à personne. Et de l'autre "
        "côté, les messages aux parents, les annonces et les résultats publiés en "
        "ligne.",
        [("/tarifs/", "Tableau de bord dès Ascension · rapports avancés dès Pilote", "ocre"),
         ("/tarifs/comparer/", "Comparer les offres", "secondaire")],
    
        illustration=("pilotage", "Le tableau de bord de la direction"),
    ) + f"""
<section class="section" id="rapports">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Rapports</span>
      <h2>Sept états, produits à la demande</h2>
      <p class="chapeau">
        Aucun ne demande de préparation : ils lisent les données du jour et
        s'exportent.
      </p>
    </div>

    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Effectifs</h3>
        <p>Nombre d'élèves par classe, par section, par option, par sexe, et
           évolution sur l'année. Le chiffre qu'on vous demande en premier à
           chaque réunion.</p>
      </article>
      <article class="carte">
        <h3>Réussite</h3>
        <p>Taux de réussite par classe et par période, nombre d'élèves au-dessus
           et en dessous du seuil de promotion, comparaison entre classes de même
           niveau.</p>
      </article>
      <article class="carte">
        <h3>Palmarès</h3>
        <p>Les meilleurs élèves par classe et par période, prêts pour la
           proclamation, sans qu'un titulaire ait à trier une liste à la main.</p>
      </article>
      <article class="carte">
        <h3>Moyennes par cours</h3>
        <p>La moyenne obtenue dans chaque branche, classe par classe. Un cours où
           toute une classe s'effondre se voit immédiatement.</p>
      </article>
      <article class="carte">
        <h3>Portées et progression</h3>
        <p>L'évolution des résultats d'une période à l'autre, pour distinguer une
           classe faible d'une classe qui décroche.</p>
      </article>
      <article class="carte">
        <h3>Finances et assiduité</h3>
        <p>Recouvrement des frais, recettes par classe, et taux de présence par
           classe et par période — les deux indicateurs qui annoncent les
           abandons.</p>
      </article>
    </div>
    <p class="note-tableau">Tous les rapports s'exportent en fichier, pour être
       joints à un procès-verbal ou transmis à l'inspection.</p>
  </div>
</section>

<section class="section alt" id="communication">
  <div class="conteneur">
    <div class="entete-illustre">
      <div class="section-entete">
        <span class="eyebrow">Communication</span>
        <h2>Parler à toute une classe sans écrire soixante messages</h2>
      </div>
      {illustrations.figure("communication-parents", "Une communication validée envoyée aux familles", "illus-section")}
    </div>

    <div class="grille-cartes deux">
      <article class="carte etoffee">
        <h3>Messages groupés</h3>
        <p>Vous choisissez une cible — une classe, un niveau, tous les
           responsables, le personnel, un rôle précis — vous écrivez une fois, et
           Ardoise envoie. L'historique conserve le message, sa cible, le nombre
           de destinataires et le nombre d'échecs.</p>
        <ul class="mini-liste">
          <li>Notification interne pour le personnel</li>
          <li>Courriel aux responsables dont l'adresse est connue</li>
          <li>Assistant WhatsApp en offre Infinite</li>
        </ul>
      </article>
      <article class="carte etoffee">
        <h3>Site public de l'école</h3>
        <p>Chaque établissement dispose d'une page publique : présentation,
           message d'accueil, annonces, calendrier. Les familles y consultent les
           résultats de leur enfant à l'aide de son code d'accès, sans compte à
           créer.</p>
        <ul class="mini-liste">
          <li>Activation et contenu réglés par l'école</li>
          <li>Codes d'accès générés et réinitialisables</li>
          <li>Annonces publiées ou retirées en un clic</li>
        </ul>
      </article>
    </div>
  </div>
</section>

<section class="section" id="memoire">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Mémoire de l'établissement</span>
      <h2>Archives, journal, et la possibilité de tout ressortir</h2>
    </div>

    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Archives par année</h3>
        <p>Une année clôturée reste navigable : ses classes, ses élèves, leurs
           notes et leurs bulletins. On y retrouve le dossier d'un ancien élève
           qui demande une attestation.</p>
      </article>
      <article class="carte">
        <h3>Exports</h3>
        <p>Export d'une année entière ou d'une classe, en un fichier. Vos données
           vous appartiennent et sortent de la plateforme quand vous le
           souhaitez.</p>
      </article>
      <article class="carte">
        <h3>Journal d'activité</h3>
        <p>Qui a saisi, validé, dévalidé, signé, encaissé, clôturé, modifié un
           paramètre — avec la date. Le journal règle les discussions au lieu de
           les nourrir.</p>
      </article>
    </div>

    <div class="encart">
      <h3>Tableau de bord et support</h3>
      <p>La page d'accueil du directeur rassemble les chiffres du jour : effectifs,
         présences, saisies en cours, situation financière, alertes de fin de
         période. Depuis la même plateforme, l'école ouvre un ticket de support et
         suit sa réponse ; les incidents techniques rencontrés sont remontés
         automatiquement à l'équipe Ardoise.</p>
    </div>
  </div>
</section>
""" + f"""
<section class="section alt">
  <div class="conteneur">
    {bloc_offres("Tableau de bord, archives et journal d'activité sont dans les quatre "
                 "offres. Les messages groupés et le site public de l'école arrivent avec "
                 "Prime ; les rapports avancés avec Pilote ; l'assistant WhatsApp et le "
                 "support prioritaire avec Infinite.")}
  </div>
</section>
"""

    corps += faq_bloc("Pilotage, communication et archives", questions)

    corps += pour_aller_plus_loin([
        ("/fonctionnalites/ia/", "Questions en langage naturel",
         "Interroger vos données sans passer par un rapport."),
        ("/securite/", "Traçabilité et sauvegardes",
         "Ce qui garantit que le journal dit vrai."),
        ("/fonctionnalites/finances/", "Finances",
         "D'où viennent les chiffres du rapport de recouvrement."),
        ("/tarifs/comparer/", "Comparer les offres",
         "Quels rapports dans quelle offre."),
    ])

    corps += cta_final(
        "Diriger sur des chiffres, pas sur des impressions.",
        "Nous vous montrons le tableau de bord avec une école de votre taille.",
        [("/contact/", "Demander une présentation", "principal"),
         ("/tarifs/", "Voir les offres", "secondaire")])

    return rendre(
        "fonctionnalites/direction-et-pilotage/index.html",
        "/fonctionnalites/direction-et-pilotage/",
        "Rapports, communication et archives scolaires — Ardoise",
        "Tableau de bord du directeur, rapports d'effectifs, de réussite et "
        "d'assiduité, messages groupés aux parents, archives et journal "
        "d'activité.",
        corps, actif="produit", jsonld=[f_ld, faq_jsonld(questions)],
    )


# ================================================================== IA
def ia():
    f_html, f_ld = fil([("Accueil", "/"), ("Fonctionnalités", "/fonctionnalites/"),
                        ("Intelligence artificielle", None)])

    questions = [
        ("L'IA décide-t-elle quelque chose à ma place&nbsp;?",
         "<p>Non. Elle propose un texte, une lecture ou une réponse ; l'application "
         "d'une appréciation, la validation d'un barème de discipline et toute "
         "décision de passage restent des gestes humains, faits par une personne "
         "identifiée et enregistrés à son nom.</p>"),
        ("L'IA peut-elle modifier mes données&nbsp;?",
         "<p>Non. Lorsqu'elle interroge la base pour répondre à une question, elle "
         "le fait sous un rôle technique dépourvu de tout droit d'écriture, limité "
         "à l'école qui pose la question et interrompu au bout d'un délai court. "
         "Une réponse fausse reste possible ; une donnée modifiée par l'IA, non.</p>"),
        ("Que se passe-t-il quand le quota mensuel est atteint&nbsp;?",
         "<p>Les fonctions d'IA s'arrêtent jusqu'au mois suivant ; le reste "
         "d'Ardoise continue de fonctionner normalement. Le quota va de 100 "
         "générations par mois en Ascension à 5 000 en Infinite, et la "
         "consommation est visible dans la plateforme.</p>"),
        ("Faut-il payer un supplément pour l'IA&nbsp;?",
         "<p>Non. Elle est comprise dans les quatre offres. Ce qui monte avec "
         "l'offre est le volume mensuel et deux capacités d'analyse : la lecture "
         "du règlement intérieur à partir de Prime, les questions sur vos données "
         "à partir de Pilote.</p>"),
        ("L'assistant WhatsApp, c'est quoi exactement&nbsp;?",
         "<p>Un numéro auquel un parent ou un membre du personnel écrit, et qui "
         "répond à partir des données de l'école : résultats d'un élève, solde de "
         "frais, prochaine échéance. Il est réservé à l'offre Infinite, et "
         "l'historique des échanges est conservé côté école.</p>"),
    ]

    corps = f_html + hero(
        "Fonctionnalités · Intelligence artificielle",
        "Une IA qui écrit, explique et cherche&nbsp;— et qui ne décide de rien",
        "L'intelligence artificielle d'Ardoise est présente dès la première offre. "
        "Elle sert trois usages précis : rédiger ce que personne n'a le temps de "
        "rédiger, expliquer la plateforme à celui qui s'y perd, et répondre à des "
        "questions posées à vos données en français ordinaire.",
        [("/tarifs/", "Incluse dans les quatre offres", "ocre"),
         ("/tarifs/comparer/", "Voir les quotas par offre", "secondaire")],
    
        illustration=("ia", "Une appreciation proposee, relue puis validee"),
    ) + """
<section class="section">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Rédaction</span>
      <h2>Les phrases que personne n'a le temps d'écrire</h2>
      <p class="chapeau">
        Un titulaire de 45 élèves doit produire 45 appréciations à chaque période.
        Sur trois périodes, cela fait 135 paragraphes — et c'est la raison pour
        laquelle ils finissent tous par se ressembler.
      </p>
    </div>

    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Appréciations de bulletin</h3>
        <p>Ardoise propose une appréciation par élève à partir de ses résultats
           réels : cotes, progression, cours en difficulté. Le titulaire relit,
           modifie ce qu'il veut, et applique. Rien n'est écrit sur le bulletin
           sans son geste.</p>
      </article>
      <article class="carte">
        <h3>Conseil de classe</h3>
        <p>Une synthèse de la classe avant le conseil : tendance générale, cours
           où le groupe décroche, élèves dont la situation mérite d'être évoquée.
           De quoi préparer une réunion, pas la remplacer.</p>
      </article>
      <article class="carte">
        <h3>Rédaction administrative</h3>
        <p>Convocation, communiqué, attestation, lettre aux parents : l'IA propose
           un texte que la direction ou le secrétariat corrige et envoie.</p>
      </article>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Assistance</span>
      <h2>Une aide qui connaît Ardoise, dans l'écran où vous êtes</h2>
    </div>

    <div class="grille-cartes deux">
      <article class="carte etoffee">
        <h3>Assistant d'aide contextuelle</h3>
        <p>« Comment je dévalide une note ? », « pourquoi ce bulletin ne se génère
           pas ? ». La réponse arrive dans la page, adaptée à votre rôle et à
           l'écran ouvert. C'est ce qui permet à une école de se paramétrer
           elle-même sans acheter de formation.</p>
        <ul class="mini-liste">
          <li>Didacticiel intégré, étape par étape</li>
          <li>Manuel consultable par rôle</li>
          <li>Suivi de la progression d'installation de l'école</li>
        </ul>
      </article>
      <article class="carte etoffee">
        <h3>Import de fichiers analysé</h3>
        <p>Vous déposez un fichier d'élèves. L'IA en lit la structure, propose une
           correspondance colonne par colonne, signale les doublons et les lignes
           douteuses. Vous corrigez avant d'appliquer, jamais après.</p>
        <ul class="mini-liste">
          <li>Fichiers tableur et documents texte</li>
          <li>Aperçu complet avant écriture</li>
          <li>Aucun import silencieux</li>
        </ul>
      </article>
    </div>
  </div>
</section>

<section class="section" id="analyse">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Analyse</span>
      <h2>Poser une question à votre école, en français</h2>
      <p class="chapeau">
        À partir de l'offre Pilote, la direction interroge ses propres données sans
        passer par un rapport prédéfini ni par un export.
      </p>
    </div>

    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Questions sur vos données</h3>
        <p>« Quels élèves de 4e commerciale n'ont rien versé depuis janvier ? »,
           « quelle classe a le plus d'absences au 2e trimestre ? ». La réponse
           est construite à partir de la base, pas devinée.</p>
      </article>
      <article class="carte">
        <h3>Signaux de décrochage</h3>
        <p>Croisement des résultats, des absences et des incidents pour signaler
           les élèves dont la trajectoire se dégrade — avant le bulletin, pas
           après.</p>
      </article>
      <article class="carte">
        <h3>Recherche dans les archives</h3>
        <p>Retrouver un ancien élève, une promotion, un résultat, sans savoir dans
           quelle année ni dans quelle classe chercher.</p>
      </article>
    </div>

    <div class="encart" id="garde-fous">
      <h3>Les garde-fous, puisque c'est la vraie question</h3>
      <ul class="mini-liste">
        <li><strong>Lecture seule.</strong> Les requêtes engendrées par l'IA
            s'exécutent sous un rôle technique sans aucun droit d'écriture ni de
            modification de structure.</li>
        <li><strong>Votre école, et rien d'autre.</strong> La requête est bornée à
            l'établissement qui la pose, par le même mécanisme d'isolation qui
            protège toute la plateforme.</li>
        <li><strong>Temps limité.</strong> Une requête trop longue est
            interrompue : une question mal formulée ne peut pas ralentir l'école.</li>
        <li><strong>Volume encadré.</strong> Quota mensuel par offre et limite de
            fréquence par minute, pour que le coût reste prévisible.</li>
        <li><strong>Tout est journalisé.</strong> Question posée, requête produite,
            durée, nombre de lignes, résultat. L'usage de l'IA est auditable comme
            le reste.</li>
      </ul>
      <p class="apres-liste"><a href="/securite/">Voir la page sécurité</a></p>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Discipline et parents</span>
      <h2>Deux usages plus spécifiques</h2>
    </div>
    <div class="grille-cartes deux">
      <article class="carte">
        <h3>Lecture du règlement intérieur</h3>
        <p>Votre règlement, écrit en prose, devient une grille de manquements avec
           leurs points et leurs mesures. Vous relisez, vous corrigez, vous
           validez — et seulement ensuite elle s'applique.
           <a href="/fonctionnalites/vie-scolaire/#discipline">Voir la discipline</a>.</p>
        <p class="mention-offre">À partir de l'offre Prime.</p>
      </article>
      <article class="carte">
        <h3>Assistant WhatsApp</h3>
        <p>Un parent écrit à un numéro et obtient les résultats de son enfant ou
           l'état de ses frais. Le personnel y accède aussi pour des consultations
           rapides. Les échanges sont conservés côté école.</p>
        <p class="mention-offre">Réservé à l'offre Infinite.</p>
      </article>
    </div>
  </div>
</section>
""" + f"""
<section class="section">
  <div class="conteneur">
    {bloc_offres("L'assistant d'aide et les appréciations sont dans les quatre offres. "
                 "Le quota mensuel monte de 100 générations en Ascension à 400 en Prime, "
                 "1 500 en Pilote et 5 000 en Infinite. La lecture du règlement arrive "
                 "avec Prime, les questions sur vos données avec Pilote, l'assistant "
                 "WhatsApp avec Infinite.")}
  </div>
</section>
"""

    corps += faq_bloc("Ce qu'on nous demande sur l'IA", questions)

    corps += pour_aller_plus_loin([
        ("/securite/", "Sécurité et données",
         "Isolation, rôles, journalisation — y compris pour l'IA."),
        ("/fonctionnalites/notes-et-bulletins/", "Notes et bulletins",
         "Où les appréciations générées finissent par apparaître."),
        ("/fonctionnalites/vie-scolaire/", "Discipline",
         "Le règlement intérieur transformé en barème validé."),
        ("/tarifs/comparer/", "Quotas par offre",
         "Combien de générations par mois selon le niveau."),
    ])

    corps += cta_final(
        "L'IA la plus utile est celle qu'on ne remarque pas.",
        "Elle écrit les 45 appréciations pendant que le titulaire relit. "
        "C'est tout ce qu'on lui demande.",
        [("/contact/", "Demander une présentation", "principal"),
         ("/tarifs/", "Voir les offres", "secondaire")])

    return rendre(
        "fonctionnalites/ia/index.html", "/fonctionnalites/ia/",
        "Intelligence artificielle pour la gestion scolaire — Ardoise",
        "Appréciations de bulletin générées, assistant d'aide contextuelle, analyse "
        "des fichiers avant import et questions sur vos données en langage "
        "naturel.",
        corps, actif="produit", jsonld=[f_ld, faq_jsonld(questions)],
    )


def construire():
    return [admissions(), direction(), ia()]
