# -*- coding: utf-8 -*-
"""FONCTIONNALITÉS — vie scolaire et finances de l'école."""

from base import (rendre, fil, hero, cta_final, faq_bloc, faq_jsonld,
                  pour_aller_plus_loin)
from contenu_fonctionnalites_a import bloc_offres


# ======================================================== VIE SCOLAIRE
def vie_scolaire():
    f_html, f_ld = fil([("Accueil", "/"), ("Fonctionnalités", "/fonctionnalites/"),
                        ("Vie scolaire", None)])

    questions = [
        ("L'appel fonctionne-t-il sans connexion&nbsp;?",
         "<p>Oui. Ardoise s'installe comme une application et conserve ce qui est "
         "nécessaire à l'appel. Un titulaire peut faire sa liste dans une classe "
         "sans réseau ; la saisie part dès que la connexion revient. C'est la "
         "raison pour laquelle le mode hors ligne a été construit en premier : "
         "l'appel est quotidien et ne peut pas attendre.</p>"),
        ("Qui fait l'appel&nbsp;: le titulaire ou chaque professeur&nbsp;?",
         "<p>C'est un réglage de l'école. Trois modes existent : appel par le "
         "titulaire une fois par jour, appel par chaque professeur à son heure, "
         "ou appel confié à une personne chargée de la discipline. Vous choisissez "
         "celui qui correspond à votre organisation, pas l'inverse.</p>"),
        ("D'où viennent les points de discipline&nbsp;?",
         "<p>De votre règlement intérieur. Vous l'importez, l'IA en extrait les "
         "manquements et les sanctions, et vous validez la grille obtenue avant "
         "qu'elle serve. Rien n'est appliqué sur la base d'un barème que vous "
         "n'avez pas relu. Les règles peuvent aussi être saisies à la main, sans "
         "aucun recours à l'IA.</p>"),
        ("Le capital conduite descend-il tout seul&nbsp;?",
         "<p>Chaque élève démarre la période avec le capital fixé par l'école — "
         "vingt points par défaut. Les incidents enregistrés le font varier selon "
         "la grille validée, dans les deux sens : un fait positif peut en rendre. "
         "Le résultat alimente la note de conduite du bulletin, que la direction "
         "applique en un geste ou corrige à la main.</p>"),
    ]

    corps = f_html + hero(
        "Fonctionnalités · Vie scolaire",
        "Présences, discipline et emploi du temps&nbsp;: ce qui se passe entre deux bulletins",
        "L'appel quotidien, les absences et leurs motifs, les incidents rapportés au "
        "règlement de l'établissement, les heures de cours de chaque classe. Trois "
        "registres qui, sur papier, ne se croisent jamais — et qui, dans Ardoise, "
        "alimentent le bulletin et les rapports.",
        [("/tarifs/", "Présences dès Ascension · discipline et horaire dès Prime", "ocre"),
         ("/tarifs/comparer/", "Comparer les offres", "secondaire")],
    
        illustration=("appel", "Une feuille d'appel remplie hors ligne"),
    ) + """
<section class="section" id="presences">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Présences</span>
      <h2>L'appel, fait en classe, sans papier et sans réseau</h2>
      <p class="chapeau">
        Un registre d'appel papier remplit son office jusqu'au jour où il faut
        savoir combien de fois un élève a manqué depuis septembre. Ardoise répond
        à cette question en une seconde, parce que la question est posée à une
        base de données et non à une pile de cahiers.
      </p>
    </div>

    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Une liste, quatre statuts</h3>
        <p>Présent, absent, retard, absence justifiée, avec un motif libre. La
           liste du jour se remplit d'un doigt sur téléphone, classe entière en
           une minute.</p>
      </article>
      <article class="carte">
        <h3>Les jours de cours de votre école</h3>
        <p>Ardoise ne compte pas les jours où l'école ne travaille pas : jours de
           la semaine ouvrés, congés, fêtes et jours spéciaux du calendrier sont
           exclus des statistiques d'assiduité.</p>
      </article>
      <article class="carte">
        <h3>Correction tracée</h3>
        <p>Une présence modifiée après coup conserve le nom de celui qui l'avait
           saisie d'abord, le motif de la modification et sa date. Un parent qui
           conteste obtient une réponse, pas une hypothèse.</p>
      </article>
    </div>

    <div class="encart" id="hors-ligne">
      <h3>Le mode hors ligne, en pratique</h3>
      <p>Ardoise s'installe sur le téléphone ou l'ordinateur comme une
         application. Les écrans utilisés récemment restent disponibles sans
         réseau, l'appel et la consultation continuent, et ce qui a été saisi
         part au retour de la connexion. Dans un pays où la coupure est un
         événement de la semaine et non de l'année, ce n'est pas un raffinement.</p>
    </div>
  </div>
</section>

<section class="section alt" id="discipline">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Discipline</span>
      <h2>Votre règlement intérieur, appliqué de la même façon à tout le monde</h2>
      <p class="chapeau">
        La difficulté de la discipline scolaire n'est pas de sanctionner : c'est de
        sanctionner deux élèves identiquement pour le même fait, six mois d'écart,
        par deux surveillants différents.
      </p>
    </div>

    <div class="grille-cartes deux">
      <article class="carte etoffee">
        <h3>Du texte au barème</h3>
        <p>Vous importez votre règlement intérieur. Ardoise en tire une liste de
           règles — code, libellé, catégorie, sens positif ou négatif, points,
           mesure associée — que vous relisez et validez. Tant que vous n'avez pas
           validé, rien ne s'applique.</p>
        <ul class="mini-liste">
          <li>Règles éditables une par une après validation</li>
          <li>Barème saisi à la main si vous préférez</li>
          <li>Le règlement validé reste la référence, archivé</li>
        </ul>
      </article>
      <article class="carte etoffee">
        <h3>Du barème au bulletin</h3>
        <p>Un incident est enregistré avec sa date, sa règle, son élève, sa classe
           et sa période. Le capital conduite de l'élève évolue en conséquence, et
           la direction peut appliquer d'un geste les notes de conduite de toute
           une classe sur le bulletin.</p>
        <ul class="mini-liste">
          <li>Faits positifs reconnus autant que les manquements</li>
          <li>Historique complet par élève</li>
          <li>Résumé par classe pour le conseil de discipline</li>
        </ul>
      </article>
    </div>
  </div>
</section>

<section class="section" id="emploi-du-temps">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Emploi du temps et calendrier</span>
      <h2>Les heures de cours, vues du bon côté selon qui regarde</h2>
    </div>

    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Créneaux et vacations</h3>
        <p>Vous définissez vos créneaux horaires — libellé, heure de début, heure
           de fin — éventuellement par vacation, pour les écoles qui font matin et
           après-midi. L'emploi du temps se construit ensuite classe par classe,
           jour par jour, sur ces créneaux.</p>
      </article>
      <article class="carte">
        <h3>Trois lectures du même horaire</h3>
        <p>La grille de la classe pour le titulaire, « mon emploi du temps » pour
           chaque professeur, et « aujourd'hui » pour savoir ce qui se passe
           maintenant. Une seule saisie, trois vues.</p>
      </article>
      <article class="carte">
        <h3>Exceptions et jours spéciaux</h3>
        <p>Un créneau raccourci un jour donné, une classe qui décale son horaire,
           un jour férié, une semaine de congé, une journée pédagogique : les
           exceptions sont enregistrées et prises en compte par les présences.</p>
      </article>
    </div>

    <div class="deux-colonnes-texte">
      <div>
        <h3>Le calendrier de l'établissement</h3>
        <p>Examens, réunions de parents, journées portes ouvertes, congés : les
           événements de l'année sont placés sur un calendrier partagé, visible
           par le personnel et publiable sur le site de l'école.</p>
      </div>
      <div>
        <h3>Ce que la vie scolaire alimente</h3>
        <p>Les présences produisent le taux d'assiduité des rapports ; la
           discipline produit la conduite du bulletin ; l'emploi du temps sert
           l'appel par professeur. Rien de tout cela n'est un registre isolé.
           <a href="/fonctionnalites/direction-et-pilotage/">Voir les rapports</a>.</p>
      </div>
    </div>
  </div>
</section>
""" + f"""
<section class="section alt">
  <div class="conteneur">
    {bloc_offres("Les présences sont dans les quatre offres. L'emploi du temps, la "
                 "discipline avec capital conduite et la lecture du règlement intérieur "
                 "par l'IA arrivent avec l'offre Prime.")}
  </div>
</section>
"""

    corps += faq_bloc("Présences et discipline, en pratique", questions)

    corps += pour_aller_plus_loin([
        ("/fonctionnalites/notes-et-bulletins/", "Notes et bulletins",
         "Où la conduite et l'assiduité finissent par apparaître."),
        ("/fonctionnalites/ia/", "Lecture du règlement par l'IA",
         "Comment un texte devient une grille de discipline validée."),
        ("/fonctionnalites/direction-et-pilotage/", "Rapports d'assiduité",
         "Absences par classe, par période, par élève."),
        ("/securite/", "Traçabilité",
         "Qui a saisi, qui a modifié, quand — sur chaque registre."),
    ])

    corps += cta_final(
        "L'appel de demain matin peut déjà se faire ici.",
        "Un titulaire formé en dix minutes fait sa classe entière en une minute, "
        "réseau ou pas.",
        [("/contact/", "Demander une présentation", "principal"),
         ("/tarifs/", "Voir les offres", "secondaire")])

    return rendre(
        "fonctionnalites/vie-scolaire/index.html",
        "/fonctionnalites/vie-scolaire/",
        "Présences, discipline et emploi du temps — Ardoise",
        "Appel quotidien utilisable hors connexion, absences justifiées, incidents de "
        "discipline rapportés au règlement intérieur, capital conduite et emploi "
        "du temps.",
        corps, actif="produit", jsonld=[f_ld, faq_jsonld(questions)],
    )


# ============================================================ FINANCES
def finances():
    f_html, f_ld = fil([("Accueil", "/"), ("Fonctionnalités", "/fonctionnalites/"),
                        ("Finances de l'école", None)])

    questions = [
        ("Peut-on encaisser en francs et en dollars&nbsp;?",
         "<p>Oui, et c'est prévu dès la première offre. L'école fixe sa devise de "
         "référence et son taux de change ; chaque paiement est enregistré dans la "
         "devise réellement reçue, avec le taux appliqué ce jour-là. Les totaux "
         "restent justes même quand le taux bouge en cours d'année, parce que "
         "chaque encaissement conserve le sien.</p>"),
        ("Le reçu est-il numéroté&nbsp;?",
         "<p>Chaque encaissement donne lieu à un reçu numéroté, portant le nom de "
         "l'élève, le montant, la devise, la date et la personne qui a encaissé. "
         "Le numéro est attribué par la plateforme : deux reçus ne peuvent pas "
         "porter le même, et un reçu ne peut pas exister sans paiement.</p>"),
        ("Ardoise gère-t-elle les arriérés d'une année sur l'autre&nbsp;?",
         "<p>Oui. Les dettes antérieures d'un élève sont visibles à côté de sa "
         "situation de l'année en cours, et le solde total apparaît lors de "
         "l'encaissement. Le secrétariat n'a pas à consulter le cahier de l'année "
         "précédente pour savoir où en est une famille.</p>"),
        ("La comptabilité est-elle une vraie comptabilité&nbsp;?",
         "<p>C'est une comptabilité de caisse, adaptée à un établissement scolaire, "
         "pas un logiciel comptable certifié. Elle enregistre les entrées et les "
         "sorties par catégorie, tient la trésorerie en francs et en dollars, "
         "conserve les pièces justificatives et produit la paie du personnel. "
         "Elle répond à la question « où est passé l'argent », pas à celle d'un "
         "bilan fiscal.</p>"),
        ("Qui peut voir les chiffres&nbsp;?",
         "<p>La direction et les personnes qu'elle habilite. Un professeur ne voit "
         "aucun montant ; un secrétaire encaisse sans accéder à la caisse "
         "générale. Chaque écriture porte le nom de celui qui l'a passée.</p>"),
    ]

    corps = f_html + hero(
        "Fonctionnalités · Finances",
        "Les frais scolaires, la caisse et la paie&nbsp;: l'argent de l'école, au clair",
        "Une grille de frais par classe, des encaissements en francs comme en dollars, "
        "un reçu à chaque paiement, et — pour les établissements qui tiennent une "
        "comptabilité — la caisse, les dépenses et les salaires dans la même "
        "plateforme que les élèves.",
        [("/tarifs/", "Frais dès Ascension · comptabilité et paie dès Pilote", "ocre"),
         ("/tarifs/comparer/", "Comparer les offres", "secondaire")],
    
        illustration=("recu", "Un recu numerote en francs et en dollars"),
    ) + """
<section class="section" id="frais">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Frais scolaires</span>
      <h2>Qui a payé quoi, combien il reste, et depuis quand</h2>
      <p class="chapeau">
        Trois questions auxquelles un cahier d'encaissement répond mal, et qu'une
        direction se pose chaque semaine.
      </p>
    </div>

    <div class="grille-cartes trois">
      <article class="carte">
        <h3>La grille des frais</h3>
        <p>Un ou plusieurs frais par année scolaire, avec leur libellé — minerval,
           frais d'examen, uniforme — et leur montant, applicables à toute l'école
           ou à une classe précise. Le montant est exprimé en francs ou en
           dollars, avec le taux du jour.</p>
      </article>
      <article class="carte">
        <h3>Les encaissements</h3>
        <p>Paiement partiel ou total, dans la devise réellement reçue, avec mode
           de paiement, référence et note. Le solde de l'élève se met à jour, les
           dettes antérieures comprises. Un reçu numéroté est produit.</p>
      </article>
      <article class="carte">
        <h3>La vue d'ensemble</h3>
        <p>Recettes de l'école, taux de recouvrement, liste des élèves en retard,
           situation classe par classe. Le directeur n'attend plus un état
           manuscrit pour savoir où en est le minerval.</p>
      </article>
    </div>

    <div class="encart" id="devises">
      <h3>Deux devises, un seul solde juste</h3>
      <p>La double devise n'est pas un affichage : chaque paiement conserve le
         taux de change appliqué au moment où il a été reçu. Une famille qui paie
         une moitié en francs en octobre et l'autre en dollars en février voit un
         solde exact, et l'école conserve la traçabilité du taux utilisé pour
         chaque écriture. Le taux de référence de l'école est modifiable, daté, et
         porte le nom de celui qui l'a changé.</p>
    </div>
  </div>
</section>

<section class="section alt" id="impayes">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Impayés</span>
      <h2>Conditionner le bulletin au paiement — si votre école le décide</h2>
    </div>
    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Un réglage, pas une règle</h3>
        <p>Le blocage du bulletin pour impayé est désactivé par défaut. Une école
           qui ne souhaite pas le pratiquer n'a rien à faire.</p>
      </article>
      <article class="carte">
        <h3>Un seuil de tolérance</h3>
        <p>Vous fixez le pourcentage d'impayé au-delà duquel le bulletin est
           retenu. Une famille à jour à 90 % n'est pas traitée comme une famille
           qui n'a rien versé.</p>
      </article>
      <article class="carte">
        <h3>Des dérogations nominatives</h3>
        <p>Un élève dont la situation le justifie reçoit une dérogation motivée,
           enregistrée avec son motif. La décision reste celle de la direction, et
           elle est écrite.</p>
      </article>
    </div>
  </div>
</section>

<section class="section" id="comptabilite">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Comptabilité et paie</span>
      <h2>La caisse de l'établissement, au-delà du minerval</h2>
      <p class="chapeau">
        À partir de l'offre Pilote, Ardoise cesse de ne compter que les recettes
        scolaires et tient la caisse complète : ce qui entre, ce qui sort, et ce
        que coûte le personnel.
      </p>
    </div>

    <div class="grille-cartes deux">
      <article class="carte etoffee">
        <h3>Caisse et dépenses</h3>
        <ul class="mini-liste">
          <li>Catégories d'entrée et de sortie propres à votre école</li>
          <li>Mouvement daté, avec bénéficiaire, référence et mode de paiement</li>
          <li>Pièce justificative attachée à l'écriture</li>
          <li>Trésorerie tenue en francs et en dollars</li>
          <li>Chaque écriture porte le nom de son auteur</li>
        </ul>
      </article>
      <article class="carte etoffee">
        <h3>Contrats et salaires</h3>
        <ul class="mini-liste">
          <li>Contrat par membre du personnel : poste, salaire de base, devise</li>
          <li>Paie mensuelle préparée en une fois pour tout l'établissement</li>
          <li>Primes et retenues ligne par ligne, net calculé</li>
          <li>Salaire payé qui génère automatiquement sa sortie de caisse</li>
          <li>États mensuels et historique par personne</li>
        </ul>
      </article>
    </div>
  </div>
</section>
""" + f"""
<section class="section alt">
  <div class="conteneur">
    {bloc_offres("Frais scolaires, encaissements, reçus numérotés et double devise sont "
                 "dans les quatre offres, y compris Ascension. La comptabilité de caisse, "
                 "les dépenses et la paie du personnel arrivent avec l'offre Pilote.")}
  </div>
</section>
"""

    corps += faq_bloc("Argent, devises et reçus", questions)

    corps += pour_aller_plus_loin([
        ("/fonctionnalites/notes-et-bulletins/", "Notes et bulletins",
         "Le lien entre solde impayé et remise du bulletin."),
        ("/fonctionnalites/direction-et-pilotage/", "Rapports financiers",
         "Recouvrement, recettes par classe, exports."),
        ("/securite/", "Qui voit quoi",
         "Comment l'accès aux montants est restreint et tracé."),
        ("/tarifs/", "Les offres",
         "À partir de quel niveau la comptabilité est incluse."),
    ])

    corps += cta_final(
        "Savoir où en est le minerval ne devrait pas prendre trois jours.",
        "Nous reprenons votre grille de frais actuelle et vous montrons ce que "
        "donne une semaine d'encaissements dans Ardoise.",
        [("/contact/", "Demander une présentation", "principal"),
         ("/tarifs/comparer/", "Comparer les offres", "secondaire")])

    return rendre(
        "fonctionnalites/finances/index.html",
        "/fonctionnalites/finances/",
        "Frais scolaires, caisse et paie de l'école — Ardoise",
        "Grille des frais par classe, encaissements en francs et en dollars, reçus "
        "numérotés, suivi des impayés, comptabilité de caisse et salaires.",
        corps, actif="produit", jsonld=[f_ld, faq_jsonld(questions)],
    )


def construire():
    return [vie_scolaire(), finances()]
