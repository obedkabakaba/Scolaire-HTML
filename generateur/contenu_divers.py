# -*- coding: utf-8 -*-
"""SÉCURITÉ, FAQ et CONTACT."""

from base import (rendre, fil, hero, cta_final, faq_bloc, faq_jsonld,
                  pour_aller_plus_loin, SITE)


# =========================================================== /securite/
def securite():
    f_html, f_ld = fil([("Accueil", "/"), ("Sécurité", None)])

    questions = [
        ("Où sont hébergées les données&nbsp;?",
         "<p>Sur une infrastructure d'hébergement professionnelle, dans des centres "
         "de données gérés par des opérateurs spécialisés, avec sauvegardes "
         "régulières. Les données ne sont pas stockées sur un serveur installé "
         "dans une école ni sur l'ordinateur d'un membre du personnel.</p>"),
        ("Une autre école peut-elle voir mes élèves&nbsp;?",
         "<p>Non, et la garantie n'est pas seulement applicative. Chaque requête "
         "s'exécute dans un contexte lié à l'école connectée, et les règles de "
         "sécurité de la base filtrent les lignes accessibles table par table. "
         "Même une erreur de programmation qui oublierait un filtre ne ferait "
         "pas apparaître les données d'un autre établissement.</p>"),
        ("Que voit exactement l'équipe Ardoise&nbsp;?",
         "<p>Un administrateur de la plateforme peut, pour porter assistance, "
         "observer l'interface d'une école. Cet accès est délibérément contraint : "
         "il est limité dans le temps, strictement en lecture — aucune écriture "
         "n'est possible — et il est enregistré avec le motif, l'adresse et "
         "l'horaire. Le journal continue par ailleurs de nommer la personne "
         "réelle, jamais l'identité observée.</p>"),
        ("Que se passe-t-il si je résilie&nbsp;?",
         "<p>Vos données restent exportables : archives par année et par classe, "
         "bulletins déjà produits. Nous considérons qu'un logiciel qui retient les "
         "données d'une école pour l'empêcher de partir ne mérite pas qu'on lui "
         "confie celles d'un enfant.</p>"),
        ("Les mots de passe sont-ils protégés&nbsp;?",
         "<p>Ils ne sont jamais stockés en clair : seule une empreinte "
         "cryptographique est conservée, calculée avec un algorithme conçu pour "
         "résister aux tentatives de retrouver le mot de passe d'origine. "
         "Personne, chez Ardoise, ne peut lire le mot de passe d'un directeur.</p>"),
    ]

    corps = f_html + hero(
        "Sécurité et données",
        "Les données d'une école ne sortent pas de l'école",
        "Une plateforme scolaire manipule des informations sur des mineurs, des "
        "résultats qui décident d'une orientation et des sommes d'argent. Cette page "
        "décrit comment l'accès à ces données est contrôlé, tracé et limité — "
        "concrètement, pas en principe.",
        [("/contact/", "Poser une question précise", "secondaire")],
        illustration=("securite", "La protection et la traçabilité des données"),
    ) + """
<section class="section">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Isolation</span>
      <h2>Une école ne peut pas lire les données d'une autre</h2>
      <p class="chapeau">
        C'est la promesse centrale d'une plateforme partagée par plusieurs
        établissements, et la seule qui ne supporte aucune exception.
      </p>
    </div>

    <div class="grille-cartes deux">
      <article class="carte etoffee">
        <h3>Le filtrage est dans la base, pas seulement dans le code</h3>
        <p>À chaque requête, l'identité de l'école connectée est posée dans le
           contexte de la transaction, et les règles de sécurité au niveau des
           lignes filtrent ce qui est visible, table par table. Une requête qui
           oublierait un filtre ne renverrait pas les données d'un autre
           établissement : elle ne renverrait rien.</p>
      </article>
      <article class="carte etoffee">
        <h3>Le raisonnement derrière</h3>
        <p>Une isolation qui repose uniquement sur des conditions écrites dans le
           code tient tant que personne n'oublie d'en écrire une. La faire
           appliquer par la base de données déplace la garantie du côté où
           l'oubli n'est pas possible. C'est plus contraignant à développer, et
           c'est le bon endroit pour cette contrainte.</p>
      </article>
    </div>
  </div>
</section>

<section class="section alt" id="acces">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Accès</span>
      <h2>Six rôles, et personne ne voit plus que son métier</h2>
    </div>
    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Des droits par rôle</h3>
        <p>Un professeur atteint ses cours dans ses classes ; un titulaire sa
           classe ; un secrétaire les dossiers et les encaissements ; la direction
           l'ensemble. Le contrôle est appliqué à chaque appel, pas seulement à
           l'affichage du menu.</p>
      </article>
      <article class="carte">
        <h3>Des cumuls encadrés</h3>
        <p>Une personne n'a qu'un rôle, sauf deux combinaisons prévues :
           Professeur et Titulaire, Préfet et Directeur. Toute autre combinaison
           est refusée — ce qui garde les responsabilités lisibles.</p>
      </article>
      <article class="carte">
        <h3>Des sessions maîtrisées</h3>
        <p>La connexion repose sur un jeton de courte durée renouvelé par une
           session enregistrée, révocable. Un mot de passe provisoire doit être
           changé à la première connexion.</p>
      </article>
    </div>
  </div>
</section>

<section class="section" id="tracabilite">
  <div class="conteneur grille-deux">
    <div>
      <span class="eyebrow">Traçabilité</span>
      <h2>Chaque geste qui engage porte un nom et une heure</h2>
      <p class="chapeau">
        Dans une école, la question n'est presque jamais « qu'est-ce qui est
        écrit ? » mais « qui l'a écrit, et quand ? ». Ardoise répond aux deux.
      </p>
      <a class="bouton secondaire" href="/fonctionnalites/direction-et-pilotage/#memoire">Voir le journal d'activité</a>
    </div>
    <ul class="liste-points">
      <li><strong>Notes</strong> — qui a saisi, qui a validé, qui a dévalidé.</li>
      <li><strong>Bulletins</strong> — qui a signé, à quelle date.</li>
      <li><strong>Présences</strong> — l'auteur de la saisie initiale est conservé
          même après correction, avec le motif de la modification.</li>
      <li><strong>Argent</strong> — chaque encaissement, chaque écriture de caisse
          et chaque salaire portent le nom de leur auteur.</li>
      <li><strong>Périodes</strong> — clôture et réouverture journalisées.</li>
      <li><strong>Paramètres</strong> — taux de change, seuils, réglages sensibles.</li>
    </ul>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Exploitation</span>
      <h2>Ce qui protège la plateforme au quotidien</h2>
    </div>
    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Mots de passe</h3>
        <p>Jamais stockés en clair. Seule une empreinte résistante est conservée,
           et la réinitialisation passe par un lien à usage unique qui expire.</p>
      </article>
      <article class="carte">
        <h3>Limitation de débit</h3>
        <p>Les points d'entrée publics et les fonctions coûteuses sont plafonnés :
           un formulaire public ne peut pas être noyé sous des envois
           automatiques, ni l'IA appelée en boucle.</p>
      </article>
      <article class="carte">
        <h3>Sauvegardes</h3>
        <p>Sauvegardes enregistrées avec leur date, leur portée et leur résultat.
           Une sauvegarde dont on ne sait pas si elle a réussi n'est pas une
           sauvegarde.</p>
      </article>
      <article class="carte">
        <h3>Requêtes de l'IA</h3>
        <p>Exécutées en lecture seule, bornées à l'école qui interroge et
           interrompues au-delà d'un délai court.
           <a href="/fonctionnalites/ia/#garde-fous">Voir les garde-fous</a>.</p>
      </article>
      <article class="carte">
        <h3>Observation encadrée</h3>
        <p>L'assistance qui regarde l'écran d'une école le fait sans droit
           d'écriture, pour une durée limitée, avec motif et horaire enregistrés.</p>
      </article>
      <article class="carte">
        <h3>Réversibilité</h3>
        <p>Export des archives par année et par classe, bulletins téléchargeables.
           Vos données sortent quand vous le décidez.</p>
      </article>
    </div>
  </div>
</section>

<section class="section">
  <div class="conteneur">
    <div class="encart">
      <h3>Ce que cette page ne prétend pas</h3>
      <p>Aucun logiciel n'est invulnérable, et une page de site ne remplace pas un
         audit. Ce qui est décrit ici est ce qui est réellement en place :
         isolation appliquée par la base, contrôle des rôles à chaque requête,
         journalisation des gestes qui engagent, sauvegardes suivies et accès
         d'assistance contraint. Si votre établissement a des exigences
         particulières — clauses contractuelles, restitution périodique,
         localisation des données —
         <a href="/contact/">posez-nous la question directement</a>.</p>
    </div>
  </div>
</section>
"""

    corps += faq_bloc("Les questions qu'on nous pose sur les données", questions,
                      id_section="faq-securite")

    corps += pour_aller_plus_loin([
        ("/fonctionnalites/ia/", "Garde-fous de l'IA",
         "Lecture seule, périmètre borné, journalisation."),
        ("/fonctionnalites/direction-et-pilotage/", "Journal et archives",
         "Ce qui est tracé, et comment le relire."),
        ("/confidentialite.html", "Politique de confidentialité",
         "Le texte complet sur le traitement des données."),
        ("/contact/", "Nous écrire",
         "Pour une question précise ou une exigence contractuelle."),
    ])

    corps += cta_final(
        "Une question précise mérite une réponse précise.",
        "Écrivez-nous : nous répondons sur ce qui existe, pas sur ce qui serait "
        "agréable à annoncer.",
        [("/contact/", "Poser une question", "principal"),
         ("/fonctionnalites/", "Voir les fonctionnalités", "secondaire")])

    return rendre(
        "securite/index.html", "/securite/",
        "Sécurité et protection des données scolaires — Ardoise",
        "Isolation stricte entre établissements appliquée par la base de données, six "
        "rôles aux droits contrôlés, journal d'activité, sauvegardes et export de "
        "vos archives.",
        corps, actif="produit", jsonld=[f_ld, faq_jsonld(questions)],
    )


# =============================================================== /faq/
GROUPES = [
    ("Choisir Ardoise", [
        ("Qu'est-ce qu'Ardoise, en une phrase&nbsp;?",
         "<p>Une plateforme qui centralise la gestion académique, administrative et "
         "financière d'un établissement scolaire : élèves, notes, bulletins "
         "officiels, présences, discipline, emploi du temps, frais scolaires et "
         "comptabilité. <a href=\"/fonctionnalites/\">Voir les fonctionnalités</a>.</p>"),
        ("Ardoise convient-elle au primaire, au secondaire, ou aux deux&nbsp;?",
         "<p>Aux deux, y compris dans le même établissement. Les cycles sont "
         "distingués : cours officiels, bulletins et règles de calcul propres au "
         "primaire d'un côté, au secondaire de l'autre, avec un traitement à part "
         "pour les classes terminales.</p>"),
        ("Quelle offre choisir pour mon école&nbsp;?",
         "<p>Le nombre d'élèves tranche dans la plupart des cas : Ascension jusqu'à "
         "250, Prime jusqu'à 600, Pilote jusqu'à 1 500, Infinite au-delà. Si votre "
         "école tient une comptabilité, organise un concours d'admission ou fait "
         "de l'orientation, prenez Pilote même en dessous de 600 élèves. "
         "<a href=\"/tarifs/comparer/\">Comparer les offres</a>.</p>"),
        ("Peut-on essayer avant de payer&nbsp;?",
         "<p>L'abonnement mensuel est sans engagement : c'est la façon la plus "
         "simple d'essayer sans s'enfermer. Pour une présentation guidée sur une "
         "école de votre taille, <a href=\"/contact/\">demandez à être rappelé</a>.</p>"),
    ]),
    ("Prix et facturation", [
        ("Combien coûte Ardoise&nbsp;?",
         "<p>De 35 à 159 $ par mois selon l'offre. Le semestriel vaut cinq "
         "mensualités et demie (8 % de remise), l'annuel en vaut dix (deux mois "
         "offerts, 17 %). <a href=\"/tarifs/\">Voir les tarifs</a>.</p>"),
        ("Y a-t-il des frais d'entrée obligatoires&nbsp;?",
         "<p>Non. L'installation, la formation et la campagne de capture sont des "
         "prestations facultatives. Une école peut se paramétrer seule à l'aide du "
         "didacticiel intégré et ne payer que son abonnement.</p>"),
        ("Peut-on changer d'offre en cours d'année&nbsp;?",
         "<p>Oui. La montée est immédiate ; la descente prend effet à l'échéance en "
         "cours et suppose que vos volumes tiennent dans les nouveaux plafonds.</p>"),
        ("Que se passe-t-il si je dépasse le plafond d'élèves&nbsp;?",
         "<p>Les données existantes restent consultables et modifiables ; seuls les "
         "ajouts sont suspendus jusqu'au changement d'offre. Aucun trimestre n'est "
         "interrompu par un plafond.</p>"),
        ("En quelle devise facture-t-on&nbsp;?",
         "<p>L'abonnement est libellé en dollars américains. À l'intérieur de la "
         "plateforme, les frais scolaires de l'école se gèrent en francs "
         "congolais comme en dollars, avec le taux de change tenu par "
         "l'établissement.</p>"),
    ]),
    ("Fonctionnement au quotidien", [
        ("Faut-il installer un logiciel&nbsp;?",
         "<p>Non. Ardoise s'utilise dans un navigateur et peut s'ajouter à l'écran "
         "d'accueil d'un téléphone ou d'un ordinateur comme une application, sans "
         "passer par une boutique.</p>"),
        ("Ça marche sans connexion&nbsp;?",
         "<p>En partie, et c'est délibéré. L'appel et la consultation des écrans "
         "récemment ouverts continuent hors ligne ; ce qui a été saisi part au "
         "retour du réseau. "
         "<a href=\"/fonctionnalites/vie-scolaire/#hors-ligne\">Voir le mode hors ligne</a>.</p>"),
        ("Ça marche sur téléphone&nbsp;?",
         "<p>Oui, et c'est la façon dont la plupart des titulaires font l'appel. "
         "L'interface est conçue pour un écran de téléphone d'entrée de gamme "
         "avant de l'être pour un grand écran.</p>"),
        ("Combien de temps faut-il pour démarrer&nbsp;?",
         "<p>Le paramétrage d'une école de taille moyenne prend quelques heures "
         "réparties sur deux ou trois jours si vous le faites vous-même, ou une "
         "intervention sous 72 heures si vous "
         "<a href=\"/services/installation/\">commandez l'installation</a>. La saisie "
         "des élèves est le poste le plus long — comptez une semaine pour 500 "
         "élèves.</p>"),
        ("Peut-on importer des élèves depuis Excel&nbsp;?",
         "<p>Oui. Le fichier est analysé colonne par colonne, la correspondance "
         "vous est proposée, les doublons et lignes incomplètes sont signalés — et "
         "vous validez avant que quoi que ce soit ne soit écrit.</p>"),
    ]),
    ("Notes, bulletins et fin d'année", [
        ("Les bulletins sont-ils conformes au format officiel de la RDC&nbsp;?",
         "<p>Oui : bulletin primaire, bulletin secondaire et bulletin des classes "
         "terminales, plus le bulletin semestriel et le bulletin annuel. Un modèle "
         "propre à l'établissement peut être composé dans l'éditeur de modèles, à "
         "partir de l'offre Prime.</p>"),
        ("Qui peut générer les bulletins&nbsp;?",
         "<p>La direction, et les titulaires si l'école les y autorise — tous, ou "
         "une liste nominative. <a href=\"/fonctionnalites/notes-et-bulletins/\">"
         "Voir le détail</a>.</p>"),
        ("Peut-on retenir un bulletin pour impayé&nbsp;?",
         "<p>Oui, si l'école active ce réglage, avec un seuil de tolérance et des "
         "dérogations nominatives motivées. Le blocage est désactivé par "
         "défaut.</p>"),
        ("Comment se passe le passage de classe&nbsp;?",
         "<p>Ardoise propose pour chaque élève le passage, le redoublement ou la "
         "sortie selon sa moyenne annuelle et les seuils fixés par l'école. Vous "
         "voyez l'aperçu, vous ajustez, puis vous exécutez — et l'année suivante "
         "démarre avec les bons effectifs.</p>"),
    ]),
    ("Intelligence artificielle", [
        ("L'IA est-elle incluse dans toutes les offres&nbsp;?",
         "<p>Oui. L'assistant d'aide et la génération des appréciations sont "
         "disponibles dès Ascension. Ce qui change, c'est le volume mensuel — de "
         "100 à 5 000 générations — et deux capacités d'analyse. "
         "<a href=\"/fonctionnalites/ia/\">Voir le détail</a>.</p>"),
        ("L'IA peut-elle modifier mes données&nbsp;?",
         "<p>Non. Ses requêtes s'exécutent sous un rôle technique en lecture seule, "
         "borné à votre école et interrompu au-delà d'un délai court.</p>"),
        ("Mes données servent-elles à entraîner un modèle&nbsp;?",
         "<p>Les données de votre école servent à répondre à vos propres demandes. "
         "Pour le détail du traitement, voir la "
         "<a href=\"/confidentialite.html\">politique de confidentialité</a>.</p>"),
    ]),
    ("Données et sécurité", [
        ("Une autre école peut-elle voir mes données&nbsp;?",
         "<p>Non. L'isolation est appliquée par la base de données elle-même, "
         "sous chaque requête et table par table. "
         "<a href=\"/securite/\">Voir la page sécurité</a>.</p>"),
        ("Puis-je récupérer mes données&nbsp;?",
         "<p>Oui, à tout moment : export des archives par année scolaire et par "
         "classe, bulletins déjà produits téléchargeables.</p>"),
        ("Que voit l'équipe Ardoise&nbsp;?",
         "<p>Un accès d'assistance existe, strictement en lecture, limité dans le "
         "temps, et enregistré avec son motif et son horaire.</p>"),
    ]),
    ("Accompagnement et support", [
        ("La formation est-elle incluse dans l'abonnement&nbsp;?",
         "<p>Le didacticiel intégré et l'assistant d'aide le sont, dans les quatre "
         "offres. La formation par un formateur est un service complémentaire "
         "facturé 30, 60 ou 100 $. "
         "<a href=\"/services/formation/\">Voir les formules</a>.</p>"),
        ("Qu'est-ce qu'une campagne de capture&nbsp;?",
         "<p>Le travail de saisie qui transforme vos registres papier en base de "
         "données : identité, responsable, classe, matricule, contrôle des "
         "doublons. 0,50 $ par élève, soit 250 $ pour 500 élèves. "
         "<a href=\"/services/campagne-de-capture/\">Voir le détail</a>.</p>"),
        ("Comment obtenir de l'aide une fois en service&nbsp;?",
         "<p>Par l'assistant d'aide dans l'écran où la question se pose, par le "
         "didacticiel, et par un ticket de support ouvert depuis la plateforme. "
         "Le support prioritaire est une caractéristique de l'offre Infinite.</p>"),
    ]),
]


def faq():
    f_html, f_ld = fil([("Accueil", "/"), ("Questions fréquentes", None)])

    blocs = []
    toutes = []
    for titre, questions in GROUPES:
        toutes.extend(questions)
        details = "".join(
            f"<details><summary>{q}</summary><div>{r}</div></details>"
            for q, r in questions
        )
        blocs.append(f'<p class="faq-groupe">{titre}</p>{details}')

    corps = f_html + hero(
        "Questions fréquentes",
        "Ce que les directeurs demandent avant de signer",
        "Vingt-huit questions, classées par sujet, avec des réponses qui n'esquivent "
        "pas. Quand la réponse est « non », elle est écrite « non ».",
        [("/contact/", "Poser une autre question", "secondaire")],
    ) + f"""
<section class="section" style="padding-top:32px">
  <div class="conteneur">
    <div class="faq">
      {"".join(blocs)}
    </div>
  </div>
</section>
"""

    corps += pour_aller_plus_loin([
        ("/tarifs/comparer/", "Comparer les offres",
         "Le tableau complet, si votre question portait sur le contenu d'une offre."),
        ("/fonctionnalites/", "Les fonctionnalités",
         "Une page par domaine, pour aller au-delà de la réponse courte."),
        ("/securite/", "Sécurité et données",
         "Isolation, rôles, traçabilité, export."),
        ("/contact/", "Nous écrire",
         "Si votre question n'est pas ici, elle nous intéresse."),
    ])

    corps += cta_final(
        "Il reste toujours une question que personne n'a posée.",
        "Écrivez-la. Nous répondons sous 48 heures ouvrées, et nous ajoutons "
        "à cette page celles qui reviennent.",
        [("/contact/", "Poser ma question", "principal"),
         ("/tarifs/", "Voir les offres", "secondaire")])

    return rendre(
        "faq/index.html", "/faq/",
        "Questions fréquentes sur Ardoise — logiciel de gestion scolaire",
        "Offres et prix, mise en route, bulletins officiels RDC, mode hors ligne, IA, "
        "sécurité des données et accompagnement : les réponses aux questions des "
        "directeurs.",
        corps, actif="ressources", jsonld=[f_ld, faq_jsonld(toutes)],
    )


# ============================================================ /contact/
FORMULAIRE = """
    <form class="formulaire" data-formulaire-accompagnement novalidate>
      <div class="duo">
        <div>
          <label for="contact_nom">Votre nom</label>
          <input type="text" id="contact_nom" name="contact_nom" required autocomplete="name" />
        </div>
        <div>
          <label for="ecole_nom">Nom de l'école</label>
          <input type="text" id="ecole_nom" name="ecole_nom" autocomplete="organization" />
        </div>
      </div>

      <div class="duo">
        <div>
          <label for="contact_telephone">Téléphone</label>
          <input type="tel" id="contact_telephone" name="contact_telephone" autocomplete="tel" />
        </div>
        <div>
          <label for="contact_email">Adresse e-mail</label>
          <input type="email" id="contact_email" name="contact_email" autocomplete="email" />
        </div>
      </div>
      <p class="aide">Un téléphone ou un e-mail suffit — il en faut au moins un pour vous rappeler.</p>

      <div class="duo">
        <div>
          <label for="ville">Ville</label>
          <input type="text" id="ville" name="ville" autocomplete="address-level2" />
        </div>
        <div>
          <label for="nb_eleves_estime">Nombre d'élèves (approximatif)</label>
          <input type="number" id="nb_eleves_estime" name="nb_eleves_estime" min="0" max="100000" />
        </div>
      </div>

      <div>
        <label for="offre_envisagee">Offre envisagée</label>
        <select id="offre_envisagee" name="offre_envisagee">
          <option value="">Je ne sais pas encore</option>
          <option value="ascension">Ardoise Ascension</option>
          <option value="prime">Ardoise Prime</option>
          <option value="pilote">Ardoise Pilote</option>
          <option value="infinite">Ardoise Infinite</option>
        </select>
      </div>

      <fieldset style="border:0">
        <legend class="aide" style="margin-bottom:8px">Services qui vous intéressent (facultatif)</legend>
        <label style="font-weight:400"><input type="checkbox" name="services_souhaites" value="installation" /> Installation &amp; configuration</label>
        <label style="font-weight:400"><input type="checkbox" name="services_souhaites" value="formation_complete" /> Formation du personnel</label>
        <label style="font-weight:400"><input type="checkbox" name="services_souhaites" value="campagne_capture" /> Campagne de capture</label>
      </fieldset>

      <div>
        <label for="message">Votre situation en quelques mots</label>
        <textarea id="message" name="message" placeholder="Combien de classes, ce que vous gérez déjà sur ordinateur, ce qui vous prend le plus de temps…"></textarea>
      </div>

      <div class="message-retour" data-retour hidden></div>
      <button class="bouton ocre" type="submit">Envoyer ma demande</button>
    </form>
"""

PRESELECTION = """<script>
/* Préremplit l'offre ou le service quand on arrive depuis /tarifs/ ou /services/
   avec ?offre=prime ou ?service=formation_complete. Purement confortable :
   la page fonctionne à l'identique sans ce script. */
(function () {
  var p = new URLSearchParams(location.search);
  var offre = p.get('offre');
  if (offre) {
    var select = document.getElementById('offre_envisagee');
    if (select && [].some.call(select.options, function (o) { return o.value === offre; })) {
      select.value = offre;
    }
  }
  var service = p.get('service');
  if (service) {
    var cle = service.indexOf('formation') === 0 ? 'formation_complete' : service;
    var c = document.querySelector('input[name="services_souhaites"][value="' + cle + '"]');
    if (c) c.checked = true;
  }
})();
</script>"""


def contact():
    f_html, f_ld = fil([("Accueil", "/"), ("Contact", None)])

    corps = f_html + hero(
        "Parler à quelqu'un",
        "Dites-nous où en est votre école",
        "Nous vous rappelons sous 48 heures ouvrées pour vous orienter vers l'offre "
        "qui convient — et vous dire si un service d'accompagnement vous serait "
        "vraiment utile, ou non. Il nous arrive souvent de conseiller l'offre la "
        "moins chère.",
    ) + f"""
<section class="section" style="padding-top:24px">
  <div class="conteneur grille-deux">
    <div>
      {FORMULAIRE}
    </div>
    <aside class="colonne-aside">
      <div class="encart">
        <h2>Contact direct</h2>
        <ul class="mini-liste">
          <li><a href="mailto:myardoise@gmail.com">myardoise@gmail.com</a></li>
          <li><a href="https://wa.me/243855035693" rel="noopener">WhatsApp : 0855 035 693</a></li>
          <li>Kinshasa, République démocratique du Congo</li>
        </ul>
      </div>
      <div class="encart">
        <h2>Ce qui nous aide à répondre vite</h2>
        <ul class="mini-liste">
          <li>Le nombre approximatif d'élèves</li>
          <li>Le nombre de classes et les cycles concernés</li>
          <li>Ce que vous gérez déjà sur ordinateur</li>
          <li>Ce qui vous prend le plus de temps aujourd'hui</li>
        </ul>
      </div>
      <div class="encart">
        <h2>Vous cherchez peut-être</h2>
        <ul class="mini-liste">
          <li><a href="/tarifs/">Les prix des quatre offres</a></li>
          <li><a href="/tarifs/comparer/">Le comparatif ligne par ligne</a></li>
          <li><a href="/services/">Les services d'accompagnement</a></li>
          <li><a href="/faq/">Les questions fréquentes</a></li>
          <li><a href="/connexion.html">Accéder à mon école</a></li>
        </ul>
      </div>
    </aside>
  </div>
</section>
"""

    corps += pour_aller_plus_loin([
        ("/fonctionnalites/", "Les fonctionnalités",
         "Pour préparer la conversation, ou vous en dispenser."),
        ("/tarifs/", "Les tarifs",
         "De 35 à 159 $ par mois selon la taille de l'école."),
        ("/services/", "Les services",
         "Installation, formation, saisie de vos élèves."),
        ("/securite/", "Sécurité",
         "Si votre question porte sur les données."),
    ])

    return rendre(
        "contact/index.html", "/contact/",
        "Contacter Ardoise — demander un accompagnement",
        "Décrivez votre école : nous vous rappelons sous 48 heures ouvrées pour vous "
        "orienter vers l'offre adaptée — et vers un service seulement s'il est "
        "utile.",
        corps, actif="ressources", jsonld=[f_ld],
        scripts=PRESELECTION,
    )


def construire():
    return [securite(), faq(), contact()]
