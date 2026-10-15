# -*- coding: utf-8 -*-
"""
/apporteurs/ — DEVENIR APPORTEUR D'AFFAIRES

Une page de recrutement, et une seule : elle s'adresse à des personnes qui ne
sont pas des clients (directeurs à la retraite, formateurs, réseaux d'écoles,
organisations) et qui se demandent toutes la même chose — « qu'est-ce que je
fais, et qu'est-ce que je touche ? ».

TROIS RÈGLES D'ÉCRITURE
-----------------------
1. Aucun revenu promis. Chaque montant cité est un TARIF PUBLIC déjà affiché
   ailleurs sur le site, ou un exemple de calcul présenté comme tel.
2. Aucune condition inventée. Ce qui n'est pas fixé par le programme (part
   reversée sur une formation ou une capture, calendrier des versements, prix
   de la formation de qualification) est dit « convenu » ou « précisé à
   l'entrée dans le programme », jamais chiffré.
3. Une candidature n'accorde rien : la page le dit, le serveur l'applique.
"""

from base import rendre, fil, hero, cta_final, faq_bloc, faq_jsonld, pour_aller_plus_loin


FORMULAIRE = """
    <form class="formulaire" data-formulaire-apporteur novalidate>
      <div class="duo">
        <div>
          <label for="ap_nom">Nom *</label>
          <input type="text" id="ap_nom" name="nom" required autocomplete="family-name" maxlength="120" />
        </div>
        <div>
          <label for="ap_prenom">Prénom</label>
          <input type="text" id="ap_prenom" name="prenom" autocomplete="given-name" maxlength="120" />
        </div>
      </div>

      <div class="duo">
        <div>
          <label for="ap_telephone">Téléphone ou WhatsApp *</label>
          <input type="tel" id="ap_telephone" name="telephone" required autocomplete="tel"
                 placeholder="+243 8XX XXX XXX" maxlength="40" />
        </div>
        <div>
          <label for="ap_email">Adresse e-mail</label>
          <input type="email" id="ap_email" name="email" autocomplete="email" maxlength="200" />
        </div>
      </div>

      <div class="duo">
        <div>
          <label for="ap_ville">Ville *</label>
          <input type="text" id="ap_ville" name="ville" required autocomplete="address-level2" maxlength="120" />
        </div>
        <div>
          <label for="ap_province">Province</label>
          <input type="text" id="ap_province" name="province" autocomplete="address-level1" maxlength="120" />
        </div>
      </div>

      <div class="duo">
        <div>
          <label for="ap_profession">Profession</label>
          <input type="text" id="ap_profession" name="profession" maxlength="160"
                 placeholder="ex. Préfet des études, formateur, consultant" />
        </div>
        <div>
          <label for="ap_organisation">Organisation (facultatif)</label>
          <input type="text" id="ap_organisation" name="organisation" maxlength="200"
                 placeholder="ex. réseau d'écoles, association, entreprise" />
        </div>
      </div>

      <fieldset class="groupe-cases">
        <legend>Ce qui vous intéresse (plusieurs choix possibles)</legend>
        <label class="case"><input type="checkbox" name="profils_souhaites" value="apporteur_affaires" checked />
          <span>Présenter Ardoise aux écoles — apporteur d'affaires</span></label>
        <label class="case"><input type="checkbox" name="profils_souhaites" value="configurateur" />
          <span>Installer et configurer Ardoise — configurateur</span></label>
        <label class="case"><input type="checkbox" name="profils_souhaites" value="formateur" />
          <span>Former les équipes des écoles — formateur</span></label>
        <label class="case"><input type="checkbox" name="profils_souhaites" value="partenaire_strategique" />
          <span>Porter une initiative à grande échelle — partenaire stratégique</span></label>
      </fieldset>

      <div>
        <label for="ap_reseau">Les écoles ou réseaux que vous connaissez</label>
        <textarea id="ap_reseau" name="reseau" maxlength="3000"
                  placeholder="Combien d'établissements, dans quelles villes, quel lien vous avez avec eux…"></textarea>
      </div>

      <div>
        <label for="ap_motivation">Pourquoi vous, et pourquoi Ardoise ? *</label>
        <textarea id="ap_motivation" name="motivation" required maxlength="3000"
                  placeholder="Quelques phrases suffisent."></textarea>
      </div>

      <div>
        <label for="ap_experience">Expérience utile (facultatif)</label>
        <textarea id="ap_experience" name="experience" maxlength="3000"
                  placeholder="Informatique, formation d'adultes, gestion scolaire, vente…"></textarea>
      </div>

      <!-- Champ piège : invisible pour une personne, rempli par les robots. -->
      <div class="sr-only" aria-hidden="true">
        <label for="ap_site_web">Ne pas remplir</label>
        <input type="text" id="ap_site_web" name="site_web" tabindex="-1" autocomplete="off" />
      </div>

      <label class="case">
        <input type="checkbox" name="consentement" value="true" required />
        <span>J'accepte qu'Ardoise conserve ces informations pour examiner ma candidature et me recontacter.
        <a href="/confidentialite.html">Confidentialité</a></span>
      </label>

      <div class="message-retour" data-retour hidden></div>
      <button class="bouton ocre" type="submit">Envoyer ma candidature</button>
      <p class="aide">Une candidature n'ouvre aucun accès et n'attribue aucun badge : elle est
      examinée par l'équipe Ardoise, qui vous recontacte.</p>
    </form>
"""

PRESELECTION = """<script>
/* Arrivée depuis un lien « ?profil=formateur » : la case correspondante est
   cochée d'avance. Purement confortable — la page fonctionne sans. */
(function () {
  var profil = new URLSearchParams(location.search).get('profil');
  if (!profil) return;
  var c = document.querySelector('input[name="profils_souhaites"][value="' + profil + '"]');
  if (c) c.checked = true;
})();
</script>"""


def apporteurs():
    f_html, f_ld = fil([("Accueil", "/"), ("Devenir apporteur d'affaires", None)])

    questions = [
        ("Combien puis-je gagner&nbsp;?",
         "<p>Il n'existe pas de montant garanti. Votre commission est un pourcentage "
         "des paiements d'abonnement <strong>réellement encaissés</strong> par Ardoise "
         "pour les écoles qui vous sont attribuées : une école qui ne paie pas ne "
         "rapporte rien, une école qui paie son année rapporte 20&nbsp;% de ce paiement. "
         "Les prestations d'installation, de formation et de capture sont rémunérées "
         "à part, quand vous les réalisez.</p>"),
        ("Faut-il être informaticien&nbsp;?",
         "<p>Pas pour présenter Ardoise : il suffit de connaître des écoles et de "
         "comprendre ce qui leur prend du temps. Les badges de configurateur et de "
         "formateur, eux, demandent des compétences précises, vérifiées avant d'être "
         "accordés.</p>"),
        ("Puis-je cumuler plusieurs rôles&nbsp;?",
         "<p>Oui. Les quatre badges sont indépendants : vous pouvez être apporteur "
         "d'affaires, puis devenir configurateur et formateur après qualification, et "
         "porter en plus un partenariat. Chaque activité est rémunérée selon ses "
         "propres règles.</p>"),
        ("Comment Ardoise sait-elle que j'ai apporté une école&nbsp;?",
         "<p>Par une preuve datée : votre code saisi par l'école à son inscription, "
         "le lien personnel qui le remplit pour elle, ou une déclaration que vous "
         "faites dans votre espace avant son inscription. Chaque rattachement est "
         "ensuite vérifié par l'équipe Ardoise avant de produire une commission.</p>"),
        ("Et si deux personnes présentent la même école&nbsp;?",
         "<p>Une école n'est attribuée qu'à un seul apporteur. En cas de revendications "
         "multiples, la preuve vérifiable la plus ancienne est retenue, et la décision "
         "est motivée et conservée dans l'historique.</p>"),
        ("Une école déjà cliente peut-elle m'être attribuée&nbsp;?",
         "<p>En principe non : le programme rémunère l'arrivée de nouvelles écoles. "
         "Une exception reste possible sur décision motivée, et elle ne porte alors que "
         "sur les paiements futurs.</p>"),
        ("Est-ce que je vois les données des écoles&nbsp;?",
         "<p>Non. Votre espace affiche le nom et la ville des écoles qui vous sont "
         "attribuées, et le détail de vos commissions. Les élèves, les notes, les "
         "finances et les contacts des écoles restent confidentiels — y compris pour "
         "vous.</p>"),
        ("Quand suis-je payé&nbsp;?",
         "<p>Une commission est versée après vérification de l'encaissement qui l'a "
         "produite. Les modalités de versement vous sont présentées lors de l'examen de "
         "votre candidature, et chaque versement apparaît dans votre relevé avec sa "
         "référence.</p>"),
        ("La formation de configurateur est-elle payante&nbsp;?",
         "<p>Elle peut l'être. Ses conditions vous sont communiquées avant votre "
         "inscription, et rien ne vous est demandé sans votre accord préalable.</p>"),
    ]

    corps = f_html + hero(
        "Programme apporteurs d'affaires",
        "Faites entrer Ardoise dans les écoles que vous connaissez",
        "Vous connaissez des établissements qui tiennent encore leurs bulletins sur "
        "papier ou sur Excel ? Aidez-les à se moderniser, et soyez rémunéré sur ce "
        "que leurs abonnements rapportent réellement — puis, si vous en avez les "
        "compétences, sur les installations et formations que vous réalisez.",
        [("#candidature", "Déposer ma candidature", "ocre"),
         ("#conditions", "Voir les conditions", "secondaire")],
        mention="Aucun revenu garanti : la rémunération dépend des paiements réels des écoles.",
        aparte="<h2>Déjà apporteur&nbsp;?</h2>"
               "<p>Retrouvez vos codes, vos écoles attribuées, vos commissions et vos "
               "règlements dans votre espace personnel.</p>"
               "<p><a class=\"lien-fleche\" href=\"/espace-apporteur.html\">Accéder à mon espace</a></p>",
    ) + """
<section class="section">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Ce que vous recommandez</span>
      <h2>Ardoise, en quelques mots</h2>
      <p class="chapeau">Une plateforme de gestion scolaire conçue pour les écoles de la RDC :
      ce que vous présentez est un outil qui fait gagner du temps à une direction, pas une promesse.</p>
    </div>
    <div class="grille-cartes trois">
      <article class="carte">
        <span class="probleme">Bulletins et résultats</span>
        <h3>Les bulletins officiels sans recopier</h3>
        <p>Notes, moyennes, classements et bulletins officiels RDC — primaire, secondaire,
           terminale — produits à partir des cotes saisies une seule fois.</p>
      </article>
      <article class="carte">
        <span class="probleme">Vie de l'école</span>
        <h3>Élèves, présences, frais</h3>
        <p>Dossiers des élèves, appel, frais scolaires et reçus en francs congolais ou en dollars,
           consultables même quand la connexion est instable.</p>
      </article>
      <article class="carte">
        <span class="probleme">Prix publics</span>
        <h3>Des offres lisibles</h3>
        <p>Quatre offres publiées, de 30 à 159 $ par mois, avec un essai gratuit et des
           services d'accompagnement facultatifs. <a href="/tarifs/">Voir les tarifs</a>.</p>
      </article>
    </div>
  </div>
</section>

<section class="section alt" id="badges">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Quatre badges, cumulables</span>
      <h2>Un même programme, plusieurs façons d'y contribuer</h2>
      <p class="chapeau">Les badges sont indépendants : vous pouvez en détenir un, deux, trois ou les
      quatre. Aucun ne donne accès aux données des écoles ni à l'administration d'Ardoise.</p>
    </div>
    <div class="grille-cartes deux">
      <article class="carte etoffee">
        <span class="probleme">Badge 1</span>
        <h3>Apporteur d'affaires</h3>
        <p>Vous présentez Ardoise aux écoles et contribuez à leur inscription. C'est le point
           d'entrée du programme : un code et un lien personnels permettent de reconnaître
           les écoles que vous avez apportées.</p>
      </article>
      <article class="carte etoffee">
        <span class="probleme">Badge 2 — après qualification</span>
        <h3>Configurateur</h3>
        <p>Vous réalisez l'installation et la configuration d'Ardoise dans une école : années,
           classes, cours, coefficients, frais. Le badge est accordé après vérification de vos
           compétences ; la formation qui y prépare peut être payante.</p>
      </article>
      <article class="carte etoffee">
        <span class="probleme">Badge 3 — après qualification</span>
        <h3>Formateur</h3>
        <p>Vous formez les équipes des écoles à l'utilisation d'Ardoise : direction, secrétariat,
           titulaires, professeurs. Le badge est accordé après vérification de votre pratique
           de la plateforme et de la formation.</p>
      </article>
      <article class="carte etoffee">
        <span class="probleme">Badge 4</span>
        <h3>Partenaire stratégique / institutionnel</h3>
        <p>Vous portez une initiative capable d'amener un grand nombre d'établissements —
           réseau d'écoles, organisation, campagne. Un partenariat dédié, avec son propre code,
           permet de suivre chaque école qui en provient.</p>
      </article>
    </div>
  </div>
</section>

<section class="section" id="conditions">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Rémunération</span>
      <h2>Comment vous êtes rémunéré</h2>
      <p class="chapeau">Chaque activité a sa propre règle. Les montants cités sont les tarifs publics
      d'Ardoise ; aucun n'est un revenu garanti.</p>
    </div>
    <div class="enveloppe-tableau">
      <table class="tableau-guide">
        <thead>
          <tr><th scope="col">Activité</th><th scope="col">Rémunération</th><th scope="col">Conditions</th></tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Apport d'une école</th>
            <td><strong>20&nbsp;%</strong> des paiements d'abonnement effectivement encaissés</td>
            <td>Pendant deux ans à compter du début de l'attribution, pour une école attribuée
                et validée par l'équipe Ardoise. Rien n'est dû sur un paiement non encaissé.</td>
          </tr>
          <tr>
            <th scope="row">Installation &amp; configuration</th>
            <td>Le montant de la prestation : <strong>60&nbsp;$</strong> au tarif public, ou
                <strong>30&nbsp;$ chacun</strong> si deux configurateurs la réalisent ensemble</td>
            <td>Badge configurateur actif ; prestation réellement réalisée et vérifiée.</td>
          </tr>
          <tr>
            <th scope="row">Formation</th>
            <td>Selon la formation réellement dispensée (tarifs publics : 30, 60 ou 100&nbsp;$
                selon la formule)</td>
            <td>Badge formateur actif ; rémunération séparée des commissions, convenue avec
                l'équipe Ardoise avant la prestation.</td>
          </tr>
          <tr>
            <th scope="row">Capture des données et photos des élèves</th>
            <td>Selon la campagne réalisée (tarif public : 0,50&nbsp;$ par élève)</td>
            <td>Service facultatif ; conditions convenues avant la campagne.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="encart" style="margin-top:22px">
      <h3>Exemple de calcul — pas une promesse</h3>
      <p>Une école qui vous est attribuée règle 590&nbsp;$ pour une année d'Ardoise Prime. Si ce
         paiement est encaissé pendant votre période d'attribution, il produit une commission de
         118&nbsp;$ (20&nbsp;% de 590&nbsp;$). Si l'école ne paie pas, la commission est nulle.</p>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Attribution</span>
      <h2>Comment une école vous est attribuée</h2>
    </div>
    <div class="grille-etapes">
      <article class="etape">
        <span class="num">1</span>
        <h3>Votre code</h3>
        <p>Une fois votre candidature retenue, vous recevez un code et un lien personnels,
           consultables dans votre espace.</p>
      </article>
      <article class="etape">
        <span class="num">2</span>
        <h3>La preuve</h3>
        <p>L'école saisit votre code en demandant son essai, ou vous la déclarez dans votre
           espace avant son inscription. Ces preuves sont datées.</p>
      </article>
      <article class="etape">
        <span class="num">3</span>
        <h3>La vérification</h3>
        <p>L'équipe Ardoise vérifie le rattachement et le valide. Une école n'est attribuée
           qu'à une seule personne ; en cas de conflit, la preuve la plus ancienne l'emporte.</p>
      </article>
      <article class="etape">
        <span class="num">4</span>
        <h3>Le suivi</h3>
        <p>Chaque paiement encaissé produit sa commission, visible ligne par ligne dans votre
           relevé, jusqu'à son règlement.</p>
      </article>
    </div>
  </div>
</section>

<section class="section">
  <div class="conteneur grille-deux">
    <div>
      <span class="eyebrow">Initiatives à grande échelle</span>
      <h2>Le statut de partenaire stratégique</h2>
      <p>Une fédération, un réseau confessionnel, une organisation ou une campagne peut faire
         adopter Ardoise par de nombreuses écoles, sans toujours connaître leur nom à l'avance.
         Le partenariat est conçu pour ce cas :</p>
      <ul class="liste-avantages">
        <li>un partenariat identifié, avec son code et son lien de référencement dédiés ;</li>
        <li>chaque école qui en provient, même par une inscription indirecte, est rattachée sur
            une preuve vérifiable — code saisi, liste nominative, attestation de l'établissement ;</li>
        <li>un relevé école par école : inscription, attribution, paiements encaissés,
            commissions ;</li>
        <li>lorsqu'un partenariat produit des résultats importants, une prolongation
            exceptionnelle de la période de commission peut être négociée — école par école,
            et validée par une personne autorisée d'Ardoise.</li>
      </ul>
    </div>
    <aside class="colonne-aside">
      <div class="encart">
        <h2>Vous portez une initiative&nbsp;?</h2>
        <p>Cochez « partenaire stratégique » dans le formulaire et décrivez votre réseau :
           nous organiserons un échange pour définir le partenariat.</p>
        <p><a class="lien-fleche" href="#candidature">Présenter mon initiative</a></p>
      </div>
    </aside>
  </div>
</section>

<section class="section alt">
  <div class="conteneur">
    <div class="section-entete">
      <span class="eyebrow">Vos engagements</span>
      <h2>Ce que le programme attend de vous</h2>
    </div>
    <div class="grille-cartes trois">
      <article class="carte">
        <h3>Présenter Ardoise honnêtement</h3>
        <p>Les prix publics, les fonctionnalités réelles, l'essai gratuit — sans promesse que
           la plateforme ne tient pas, ni remise qui n'a pas été accordée par Ardoise.</p>
      </article>
      <article class="carte">
        <h3>Respecter la confidentialité</h3>
        <p>Ce que vous apprenez d'une école en la configurant ou en la formant reste dans
           l'école : ses élèves, ses notes et ses finances ne se partagent avec personne.</p>
      </article>
      <article class="carte">
        <h3>Déclarer votre démarche</h3>
        <p>Votre code, votre lien ou votre déclaration sont ce qui vous protège : c'est sur
           eux, et sur eux seuls, que l'attribution d'une école est décidée.</p>
      </article>
    </div>
  </div>
</section>

<section class="section" id="candidature">
  <div class="conteneur grille-deux">
    <div>
      <div class="section-entete">
        <span class="eyebrow">Candidature</span>
        <h2>Rejoindre le programme</h2>
        <p class="chapeau">Quelques minutes suffisent. Nous examinons chaque candidature et vous
        recontactons.</p>
      </div>
      """ + FORMULAIRE + """
    </div>
    <aside class="colonne-aside">
      <div class="encart">
        <h2>Une question avant de candidater&nbsp;?</h2>
        <ul class="mini-liste">
          <li><a href="https://wa.me/243855035693" rel="noopener">WhatsApp : 0855 035 693</a></li>
          <li><a href="mailto:myardoise@gmail.com">myardoise@gmail.com</a></li>
          <li>Kinshasa, République démocratique du Congo</li>
        </ul>
      </div>
      <div class="encart">
        <h2>Ce qui se passe ensuite</h2>
        <ul class="mini-liste">
          <li>Votre candidature est examinée par l'équipe Ardoise.</li>
          <li>Si elle est retenue, votre profil est créé et vous recevez un lien pour activer
              votre espace.</li>
          <li>Les badges sont accordés un à un ; configurateur et formateur après qualification.</li>
        </ul>
      </div>
      <div class="encart">
        <h2>Déjà apporteur&nbsp;?</h2>
        <p><a class="lien-fleche" href="/espace-apporteur.html">Accéder à mon espace</a></p>
      </div>
    </aside>
  </div>
</section>
"""

    corps += faq_bloc("Les questions qu'on nous pose", questions, id_section="faq-apporteurs")

    corps += pour_aller_plus_loin([
        ("/tarifs/", "Les tarifs d'Ardoise",
         "Les quatre offres que vous présenterez, et leurs prix publics."),
        ("/services/", "Les services d'accompagnement",
         "Installation, formation et capture : ce que réalisent les configurateurs et formateurs."),
        ("/fonctionnalites/", "Les fonctionnalités",
         "Ce qu'Ardoise couvre, module par module."),
        ("/essai/", "L'essai gratuit",
         "La page où les écoles saisissent votre code."),
    ])

    corps += cta_final(
        "Vous connaissez des écoles qui en ont besoin.",
        "Présentez-leur Ardoise, et suivez chaque résultat depuis votre espace.",
        [("#candidature", "Déposer ma candidature", "principal"),
         ("/contact/", "Nous parler d'abord", "secondaire")])

    return rendre(
        "apporteurs/index.html", "/apporteurs/",
        "Devenir apporteur d'affaires Ardoise — programme et conditions",
        "Présentez Ardoise aux écoles de la RDC : 20 % des abonnements encaissés pendant "
        "deux ans, installation et formation rémunérées après qualification.",
        corps, actif="ressources", jsonld=[f_ld, faq_jsonld(questions)],
        scripts=PRESELECTION,
    )


def construire():
    return [apporteurs()]
