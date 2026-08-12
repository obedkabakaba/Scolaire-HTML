/* =============================================================================
   ARDOISE — CATALOGUE COMMERCIAL (client du site public)
   =============================================================================

   CE QU'IL FAIT
   -------------
   Un seul objet, `Catalogue`, partagé par index.html, tarifs.html et
   services.html. Il sait trois choses et rien d'autre :

     · lire les offres et les services depuis l'API ;
     · les mettre en forme (prix, économies, plafonds) ;
     · calculer l'estimation d'une campagne de capture.

   POURQUOI LES PRIX SONT DÉJÀ DANS LE HTML
   ----------------------------------------
   Parce qu'un moteur de recherche ne lit pas ce fichier. Les tarifs sont donc
   écrits dans les pages, ET rafraîchis ici au chargement. En cas de baisse de
   prix, le visiteur voit le nouveau tarif immédiatement ; le HTML est
   régénéré ensuite par `scripts/generer-tarifs-statiques.js`, côté serveur, à
   partir de la même API. La page n'invente jamais un chiffre, et si l'API est
   injoignable elle affiche le dernier prix publié plutôt qu'un trou.

   LE CALCUL DE LA CAMPAGNE NE SE FAIT PAS ICI
   -------------------------------------------
   Le simulateur affiche un résultat immédiat pendant la frappe — sans quoi il
   paraît cassé sur une connexion lente — puis le remplace par la réponse du
   serveur. C'est le serveur qui fait foi : c'est lui qui facturera.
   ============================================================================= */

(function (global) {
  'use strict';

  var API = (global.API_BASE_URL || 'https://scolaire-saas-backend.onrender.com')
              .replace(/\/+$/, '');

  var etat = { offres: null, services: null };

  /* ------------------------------------------------------------- Formatage */

  /**
   * Un montant, tel qu'on l'écrit sur une facture.
   *
   * Espace insécable avant le symbole et séparateur de milliers à la
   * française : « 1 110 $ », jamais « 1110$ ». Sur une grille où figurent
   * 190, 570 et 1 110, l'œil doit distinguer les ordres de grandeur d'un
   * coup — c'est précisément là que le directeur compare.
   */
  function montant(valeur, devise) {
    if (valeur === null || valeur === undefined || isNaN(valeur)) return '—';
    var n = Number(valeur);
    var entier = Math.round(n) === n;
    var texte = entier
      ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F')
      : n.toFixed(2).replace('.', ',');
    return texte + '\u00A0' + (devise === 'USD' || !devise ? '$' : devise);
  }

  /** Un plafond. `null` veut dire « sans limite », pas « inconnu ». */
  function plafond(valeur) {
    if (valeur === null || valeur === undefined) return 'Sans limite';
    return String(valeur).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
  }

  /* ---------------------------------------------------------------- Réseau */

  function recuperer(chemin) {
    return fetch(API + chemin, { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  /**
   * Charge les offres. Échoue en silence : la page garde ses prix publiés.
   *
   * Un bandeau « impossible de charger les tarifs » sur une page de vente
   * ferait fuir un visiteur pour un incident qui ne le concerne pas, alors
   * que les prix affichés sont exacts dans l'immense majorité des cas.
   */
  function chargerOffres() {
    if (etat.offres) return Promise.resolve(etat.offres);
    return recuperer('/catalogue/offres')
      .then(function (d) { etat.offres = d; return d; })
      .catch(function () { return null; });
  }

  function chargerServices() {
    if (etat.services) return Promise.resolve(etat.services);
    return recuperer('/catalogue/services')
      .then(function (d) { etat.services = d; return d; })
      .catch(function () { return null; });
  }

  /* -------------------------------------------------- Sélecteur de période */

  /**
   * Branche le sélecteur Mensuel / Semestriel / Annuel sur les cartes.
   *
   * Chaque carte porte ses trois prix en attributs `data-` écrits dans le
   * HTML : basculer de période ne demande donc aucun appel réseau, et
   * fonctionne même si l'API n'a pas répondu. Le rafraîchissement par l'API,
   * quand il arrive, réécrit ces mêmes attributs.
   */
  function brancherSelecteurPeriode(racine) {
    racine = racine || document;
    var boutons = racine.querySelectorAll('[data-periode]');
    var note = racine.querySelector('[data-note-periode]');

    /*
     * Pas de sélecteur sur toutes les pages.
     * ---------------------------------------------------------------------
     * Depuis le passage à un site multi-pages, la page d'accueil affiche
     * quatre cartes d'offres SANS le sélecteur Mensuel / Semestriel / Annuel :
     * elle donne un aperçu, le choix de périodicité se fait sur /tarifs/.
     *
     * Renvoyer ici, comme le faisait la version précédente, laissait ces
     * cartes hors du rafraîchissement : `rafraichirTarifs` réécrivait bien
     * leurs attributs `data-` depuis l'API, mais personne ne les repeignait,
     * et un changement de prix restait invisible sur la page la plus vue du
     * site. On continue donc, en neutralisant simplement ce qui suppose un
     * sélecteur.
     */

    function appliquer(periode) {
      boutons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.periode === periode));
      });

      racine.querySelectorAll('[data-offre]').forEach(function (carte) {
        var total = carte.dataset['prix' + majuscule(periode)];
        var parMois = carte.dataset['mois' + majuscule(periode)];
        var eco = carte.dataset['eco' + majuscule(periode)];
        var pct = carte.dataset['pct' + majuscule(periode)];
        var devise = carte.dataset.devise || 'USD';

        var elPrix = carte.querySelector('[data-prix]');
        var elParMois = carte.querySelector('[data-par-mois]');
        var elFact = carte.querySelector('[data-facturation]');
        var elEco = carte.querySelector('[data-economie]');

        if (elPrix) {
          elPrix.innerHTML = '<span class="devise">' + (devise === 'USD' ? '$' : devise)
            + '</span>' + Number(parMois || total).toLocaleString('fr-FR');
        }
        if (elParMois) elParMois.textContent = 'par mois';

        if (elFact) {
          elFact.textContent = periode === 'mensuel'
            ? 'Facturé ' + montant(total, devise) + ' chaque mois.'
            : 'Facturé ' + montant(total, devise) + ' '
              + (periode === 'semestriel' ? 'tous les six mois.' : 'une fois par an.');
        }

        if (elEco) {
          if (Number(eco) > 0) {
            elEco.hidden = false;
            elEco.textContent = 'Vous économisez ' + montant(eco, devise)
              + ' (' + pct + '\u00A0%)';
          } else {
            elEco.hidden = true;
          }
        }
      });

      if (note) {
        note.textContent = periode === 'mensuel'
          ? 'Sans engagement : vous pouvez arrêter, changer d\u2019offre ou passer au semestriel à tout moment.'
          : periode === 'semestriel'
            ? 'Réglé en une fois pour six mois. Le montant économisé est calculé par rapport au tarif mensuel.'
            : 'Réglé en une fois pour douze mois. Le montant économisé est calculé par rapport au tarif mensuel.';
      }

      // Seule une page qui PROPOSE le choix a le droit de le mémoriser.
      if (boutons.length) {
        try { global.localStorage.setItem('ardoise.periode', periode); } catch (e) { /* mode privé */ }
      }
    }

    boutons.forEach(function (b) {
      b.addEventListener('click', function () { appliquer(b.dataset.periode); });
    });

    var memorisee = null;
    try { memorisee = global.localStorage.getItem('ardoise.periode'); } catch (e) { /* */ }
    appliquer(memorisee || 'mensuel');

    return appliquer;
  }

  function majuscule(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ------------------------------------------------- Offres dépubliées */

  /**
   * Retire de la page ce que le Super Admin a dépublié.
   *
   * POURQUOI CE N'EST PAS OPTIONNEL
   * -------------------------------
   * Les cartes d'offres sont écrites dans le HTML (voir l'en-tête de ce
   * fichier). `rafraichirTarifs` en réécrivait les prix et ne faisait rien
   * d'autre : une offre désactivée ou retirée du site disparaissait bien de
   * l'API — donc de `/catalogue/offres` — mais sa carte restait affichée, avec
   * son dernier prix connu et son bouton « Demander cette offre ». Depuis
   * l'espace Super Admin, la bascule « Visible publiquement » paraissait donc
   * sans effet : elle en avait un, personne ne pouvait le voir.
   *
   * Trois endroits à traiter, parce que ce sont les trois où une offre
   * apparaît nommément : les cartes de /tarifs/ et de l'accueil, les colonnes
   * du tableau comparatif, et la liste déroulante du formulaire de contact.
   *
   * PRUDENCE VOLONTAIRE : on ne retire quelque chose que si l'API a répondu ET
   * a renvoyé au moins une offre. Une API injoignable, ou momentanément vide,
   * ne doit pas vider la page des tarifs — c'est la seule panne qui coûterait
   * plus cher que le bug qu'on corrige ici.
   */
  function appliquerDepublications(racine, offres) {
    if (!offres || !offres.length) return;

    var publies = {};
    offres.forEach(function (o) { if (o.code) publies[o.code] = true; });

    var doc = racine || document;
    masquerCartes(doc, publies);
    masquerColonnesComparatif(doc, publies);
    nettoyerListeDeroulante(doc, publies);
  }

  /** Les cartes d'offre, sur /tarifs/ comme sur l'accueil. */
  function masquerCartes(doc, publies) {
    var grilles = [];

    doc.querySelectorAll('[data-offre]').forEach(function (carte) {
      var retiree = !publies[carte.dataset.offre];
      // `hidden` seul ne suffit pas : la règle `.offre { display: … }` de la
      // feuille de style l'emporte sur le style par défaut du navigateur.
      carte.hidden = retiree;
      carte.style.display = retiree ? 'none' : '';
      if (retiree) carte.setAttribute('data-depubliee', 'oui');
      else carte.removeAttribute('data-depubliee');

      if (carte.parentNode && grilles.indexOf(carte.parentNode) === -1) grilles.push(carte.parentNode);
    });

    /* La grille est figée à quatre colonnes. Masquer une carte sans le dire à
       la feuille de style laisserait les trois autres serrées à gauche, avec
       un vide à droite exactement là où l'offre retirée se trouvait — ce qui
       se lit comme une page cassée plutôt que comme une offre en moins. */
    grilles.forEach(function (grille) {
      var visibles = 0;
      for (var i = 0; i < grille.children.length; i++) {
        var enfant = grille.children[i];
        if (enfant.hasAttribute('data-offre') && !enfant.hidden) visibles++;
      }
      grille.setAttribute('data-visibles', String(visibles));
    });
  }

  /**
   * Les colonnes du tableau comparatif.
   *
   * Le code de chaque offre se lit dans l'en-tête, qui pointe déjà vers
   * `/tarifs/#<code>`. Aucun attribut à ajouter au HTML : la page dit déjà
   * quelle colonne parle de quelle offre.
   *
   * Les lignes de groupe portent un `colspan` qui couvre tout le tableau ; il
   * faut le réduire d'autant, sinon le titre de groupe déborde d'une cellule
   * et décale visuellement toute la section.
   */
  function masquerColonnesComparatif(doc, publies) {
    doc.querySelectorAll('table.comparatif').forEach(function (table) {
      var entetes = table.querySelectorAll('thead th');
      var aRetirer = [];

      for (var i = 0; i < entetes.length; i++) {
        var lien = entetes[i].querySelector('a[href*="/tarifs/#"]');
        if (!lien) continue;
        var code = lien.getAttribute('href').split('#')[1];
        if (code && !publies[code]) aRetirer.push(i);
      }
      if (!aRetirer.length) return;

      table.querySelectorAll('tr').forEach(function (ligne) {
        var cellules = ligne.children;
        var groupe = cellules.length === 1 && cellules[0].hasAttribute('colspan');

        if (groupe) {
          /* Le colspan d'origine est mémorisé au premier passage : le déduire
             de la valeur courante ferait rétrécir la ligne un peu plus à
             chaque appel, et un second rafraîchissement suffirait à décaler
             tout le tableau. */
          if (!cellules[0].hasAttribute('data-colspan-origine')) {
            cellules[0].setAttribute('data-colspan-origine', cellules[0].getAttribute('colspan') || '1');
          }
          var origine = Number(cellules[0].getAttribute('data-colspan-origine'));
          cellules[0].setAttribute('colspan', String(Math.max(1, origine - aRetirer.length)));
          return;
        }
        aRetirer.forEach(function (index) {
          if (cellules[index]) {
            cellules[index].hidden = true;
            cellules[index].style.display = 'none';
          }
        });
      });
    });
  }

  /** La liste « Offre envisagée » du formulaire de contact. */
  function nettoyerListeDeroulante(doc, publies) {
    var select = doc.querySelector('#offre_envisagee');
    if (!select) return;

    [].slice.call(select.options).forEach(function (option) {
      if (!option.value || publies[option.value]) return;
      if (option.selected) select.value = '';
      option.parentNode.removeChild(option);
    });
  }

  /**
   * Réécrit les attributs de prix des cartes à partir de l'API, puis
   * réapplique la période affichée. Rien ne bouge si l'API n'a pas répondu.
   *
   * Retire aussi les offres dépubliées : un prix juste sur une offre qui n'est
   * plus vendue reste une offre qui n'est plus vendue.
   */
  function rafraichirTarifs(racine, reappliquer) {
    return chargerOffres().then(function (donnees) {
      if (!donnees || !donnees.offres) return;
      appliquerDepublications(racine, donnees.offres);
      (racine || document).querySelectorAll('[data-offre]').forEach(function (carte) {
        var offre = donnees.offres.find(function (o) { return o.code === carte.dataset.offre; });
        if (!offre) return;
        carte.dataset.devise = offre.devise;
        ['mensuel', 'semestriel', 'annuel'].forEach(function (p) {
          var t = offre.tarifs[p];
          if (!t) return;
          carte.dataset['prix' + majuscule(p)] = t.total;
          carte.dataset['mois' + majuscule(p)] = t.par_mois;
          carte.dataset['eco' + majuscule(p)] = t.economie;
          carte.dataset['pct' + majuscule(p)] = t.economie_pourcentage;
        });
      });
      if (typeof reappliquer === 'function') {
        var actif = (racine || document).querySelector('[data-periode][aria-pressed="true"]');
        reappliquer(actif ? actif.dataset.periode : 'mensuel');
      }
    });
  }

  /* ------------------------------------------------------------ Simulateur */

  /**
   * Simulateur de campagne de capture.
   *
   * Il porte son propre tarif de repli en `data-prix-unitaire`, écrit dans le
   * HTML depuis la base : le curseur répond instantanément même hors ligne.
   * Le serveur est ensuite interrogé, en le laissant décider — c'est lui qui
   * connaît le minimum facturable et les éventuelles règles à venir.
   */
  function brancherSimulateur(racine) {
    var bloc = (racine || document).querySelector('[data-simulateur-capture]');
    if (!bloc) return;

    var nombre = bloc.querySelector('[data-nb-eleves]');
    var curseur = bloc.querySelector('[data-curseur-eleves]');
    var sortie = bloc.querySelector('[data-montant-capture]');
    var detail = bloc.querySelector('[data-detail-capture]');
    var prixUnitaire = Number(bloc.dataset.prixUnitaire || 0.5);
    var devise = bloc.dataset.devise || 'USD';
    var minutier = null;

    function afficher(valeur) {
      var n = Math.max(0, Math.floor(Number(valeur) || 0));
      if (nombre && document.activeElement !== nombre) nombre.value = n;
      if (curseur && document.activeElement !== curseur) curseur.value = Math.min(n, Number(curseur.max));

      sortie.textContent = montant(n * prixUnitaire, devise);
      detail.textContent = n === 0
        ? 'Indiquez le nombre d\u2019élèves à saisir.'
        : plafond(n) + ' élèves × ' + montant(prixUnitaire, devise) + ' par élève';

      clearTimeout(minutier);
      if (n <= 0) return;
      minutier = setTimeout(function () { confirmerAupresDuServeur(n); }, 450);
    }

    function confirmerAupresDuServeur(n) {
      recuperer('/catalogue/estimation?service=campagne_capture&quantite=' + n)
        .then(function (r) {
          sortie.textContent = montant(r.montant_total, r.devise);
          var texte = plafond(r.quantite) + ' élèves × ' + montant(r.prix_unitaire, r.devise)
                    + ' par élève';
          if (r.minimum_applique) {
            texte += ' — minimum facturé : ' + plafond(r.minimum_applique) + ' élèves';
          }
          detail.textContent = texte;
        })
        .catch(function () { /* l'estimation locale reste affichée */ });
    }

    if (nombre)  nombre.addEventListener('input', function () { afficher(nombre.value); });
    if (curseur) curseur.addEventListener('input', function () { afficher(curseur.value); });
    afficher(nombre ? nombre.value : 300);
  }

  /* ------------------------------------------------- Formulaire de contact */

  function brancherFormulaireContact(racine) {
    var form = (racine || document).querySelector('[data-formulaire-accompagnement]');
    if (!form) return;
    var retour = form.querySelector('[data-retour]');
    var bouton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var donnees = Object.fromEntries(new FormData(form).entries());
      donnees.services_souhaites = Array.from(
        form.querySelectorAll('input[name="services_souhaites"]:checked')
      ).map(function (c) { return c.value; });
      delete donnees['services_souhaites[]'];

      bouton.disabled = true;
      var texteInitial = bouton.textContent;
      bouton.textContent = 'Envoi…';
      retour.hidden = true;

      fetch(API + '/catalogue/demande-accompagnement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees)
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          retour.hidden = false;
          retour.className = 'message-retour ' + (res.ok ? 'succes' : 'erreur');
          retour.textContent = res.d.message
            || (res.ok ? 'Demande envoyée.' : 'Votre demande n\u2019a pas pu être envoyée.');
          if (res.ok) form.reset();
        })
        .catch(function () {
          retour.hidden = false;
          retour.className = 'message-retour erreur';
          retour.textContent = 'Connexion impossible. Vérifiez votre réseau et réessayez.';
        })
        .finally(function () {
          bouton.disabled = false;
          bouton.textContent = texteInitial;
        });
    });
  }

  /* ------------------------------------------------------ Bascule de thème */

  function brancherTheme() {
    var bouton = document.querySelector('[data-bascule-theme]');
    var racine = document.documentElement;
    var memorise = null;
    try { memorise = localStorage.getItem('ardoise.theme'); } catch (e) { /* */ }
    if (memorise) racine.setAttribute('data-theme', memorise);
    if (!bouton) return;

    function etiqueter() {
      var sombre = racine.getAttribute('data-theme') === 'sombre'
        || (!racine.getAttribute('data-theme')
            && global.matchMedia('(prefers-color-scheme: dark)').matches);
      bouton.textContent = sombre ? '☀' : '☾';
      bouton.setAttribute('aria-label',
        sombre ? 'Passer en mode clair' : 'Passer en mode sombre');
    }

    bouton.addEventListener('click', function () {
      var sombre = racine.getAttribute('data-theme') === 'sombre'
        || (!racine.getAttribute('data-theme')
            && global.matchMedia('(prefers-color-scheme: dark)').matches);
      var suivant = sombre ? 'clair' : 'sombre';
      racine.setAttribute('data-theme', suivant);
      try { localStorage.setItem('ardoise.theme', suivant); } catch (e) { /* */ }
      etiqueter();
    });
    etiqueter();
  }

  /* ------------------------------------------------------------ Démarrage */

  function demarrer() {
    brancherTheme();
    var reappliquer = brancherSelecteurPeriode(document);
    rafraichirTarifs(document, reappliquer);
    brancherSimulateur(document);
    brancherFormulaireContact(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }

  global.Catalogue = {
    montant: montant,
    plafond: plafond,
    chargerOffres: chargerOffres,
    chargerServices: chargerServices,
    rafraichirTarifs: rafraichirTarifs
  };
})(window);
