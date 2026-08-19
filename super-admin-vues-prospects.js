/* ==========================================================================
   Ardoise — Super Admin : demandes d'accompagnement (prospects)
   --------------------------------------------------------------------------
   Ce que le site public dépose, et le travail qui s'ensuit : rappeler,
   qualifier, convertir — ou classer sans suite.

   DEUX FLUX ARRIVENT ICI, ET IL FAUT LES DISTINGUER
   -------------------------------------------------
   Le formulaire « Demander un accompagnement » dépose des PROSPECTS. La page
   « Écrivez-nous » dépose des MESSAGES : un parent, un professeur, une école
   qui pose une question avant même de savoir si elle achètera. Les traiter du
   même geste ferait rappeler un parent comme on rappelle un prospect.

   Ils partagent la file — une seule boîte, sinon la seconde finit par n'être
   lue par personne — mais chaque ligne porte son origine, et le filtre permet
   de ne voir que l'un ou l'autre.

   La file est triée par le serveur : les demandes non traitées d'abord, puis
   les plus récentes. Un prospect de mardi qu'on n'a pas rappelé passe devant
   celui d'hier qu'on a déjà appelé, ce qui est le seul ordre qui serve à
   quelque chose dans une file de rappel.

   Rien n'est supprimable depuis cet écran. Une demande sans suite se classe ;
   elle ne s'efface pas. Le taux de conversion d'un canal d'acquisition ne se
   calcule pas sur une liste dont on a retiré les échecs.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui } = SA;

  const STATUTS = [
    { cle: 'nouvelle',   libelle: 'Nouvelle',      ton: 'attention' },
    { cle: 'contactee',  libelle: 'Contactée',     ton: 'info' },
    { cle: 'convertie',  libelle: 'Convertie',     ton: 'succes' },
    { cle: 'sans_suite', libelle: 'Sans suite',    ton: 'neutre' }
  ];

  const ORIGINES = [
    { cle: 'site_public',   libelle: 'Accompagnement', ton: 'info' },
    { cle: 'message_libre', libelle: 'Message libre',  ton: 'neutre' }
  ];

  const trouver = (c) => STATUTS.find((s) => s.cle === c) || {};
  const libelleStatut = (c) => trouver(c).libelle || c;

  const trouverOrigine = (c) => ORIGINES.find((o) => o.cle === c) || {};

  /* Une origine inconnue — une ligne plus ancienne, ou un flux futur — est
     affichée telle quelle plutôt que masquée : mieux vaut un code technique
     qu'une ligne dont on ne sait plus d'où elle vient. */
  const badgeOrigine = (c) => ui.badge(trouverOrigine(c).libelle || c || '—',
                                       trouverOrigine(c).ton || 'neutre');

  /*
   * Badge dessiné ici plutôt que par `ui.badgeStatut`.
   *
   * La table `SA.ui.tonStatut` du noyau ne connaît aucun des quatre statuts
   * commerciaux : les quatre sortiraient en gris, et « convertie » ne se
   * distinguerait pas de « sans suite » — exactement les deux qu'il faut
   * séparer d'un coup d'œil. Les tons vivent donc dans STATUTS ci-dessus,
   * à côté des libellés, plutôt que d'enrichir une table partagée pour un
   * seul écran.
   */
  const badgeStatut = (c) => ui.badge(libelleStatut(c), trouver(c).ton);

  /** Un lien cliquable quand le canal existe, un tiret sinon. */
  function contact(demande) {
    const morceaux = [];
    if (demande.contact_telephone) {
      morceaux.push(`<a href="tel:${esc(demande.contact_telephone)}" class="sa-mono">${esc(demande.contact_telephone)}</a>`);
    }
    if (demande.contact_email) {
      morceaux.push(`<a href="mailto:${esc(demande.contact_email)}">${esc(demande.contact_email)}</a>`);
    }
    return morceaux.length ? morceaux.join('<br />') : '<span class="sa-muet">—</span>';
  }

  /**
   * Depuis combien de temps la demande attend.
   *
   * Affiché parce que le site promet un rappel sous 48 heures ouvrées : sans
   * ce repère, l'engagement n'est vérifiable par personne. Au-delà de deux
   * jours sur une demande encore « nouvelle », le délai passe en rouge.
   */
  function anciennete(demande) {
    const heures = (Date.now() - new Date(demande.created_at).getTime()) / 36e5;
    if (!Number.isFinite(heures)) return '—';

    const texte = heures < 1 ? "à l'instant"
      : heures < 24 ? `il y a ${Math.floor(heures)} h`
      : `il y a ${Math.floor(heures / 24)} j`;

    const enRetard = demande.statut === 'nouvelle' && heures > 48;
    return enRetard
      ? `<span class="sa-negatif" title="Au-delà des 48 heures annoncées sur le site">${esc(texte)}</span>`
      : `<span class="sa-muet">${esc(texte)}</span>`;
  }

  /** Fiche complète, ouverte au clic sur une ligne. */
  function ouvrirFiche(demande, ecoles) {
    const info = (libelle, valeurHtml) => valeurHtml
      ? `<div class="sa-fiche-ligne"><span class="sa-muet">${esc(libelle)}</span><div>${valeurHtml}</div></div>`
      : '';

    const services = (demande.services_souhaites || []).length
      ? demande.services_souhaites.map((s) => `<span class="sa-etiquette">${esc(s)}</span>`).join(' ')
      : '';

    const libre = demande.origine === 'message_libre';

    const modale = SA.modale({
      titre: libre ? (demande.sujet || `Message de ${demande.contact_nom}`) : demande.contact_nom,
      sousTitre: libre
        ? demande.contact_nom
        : ([demande.ecole_nom, demande.ville].filter(Boolean).join(' — ') || 'Aucune école indiquée'),
      large: true,
      contenu: `
        <div class="sa-fiche">
          ${info('Reçue le', `${esc(fmt.date(demande.created_at))} · ${anciennete(demande)}`)}
          ${info('Origine', badgeOrigine(demande.origine))}
          ${info('Sujet', demande.sujet ? esc(demande.sujet) : '')}
          ${info('Contact', contact(demande))}
          ${info('Élèves (estimation)', demande.nb_eleves_estime ? fmt.nombre(demande.nb_eleves_estime) : '')}
          ${info('Offre envisagée', demande.offre_nom ? esc(demande.offre_nom) : '')}
          ${info('Services souhaités', services)}
          ${info(demande.origine === 'message_libre' ? 'Son message' : 'Sa situation', demande.message
            ? `<p class="sa-texte">${esc(demande.message).replace(/\n/g, '<br />')}</p>` : '')}
          ${info('École rattachée', demande.ecole_liee_nom ? esc(demande.ecole_liee_nom) : '')}
          ${info('Dernier suivi par', demande.traite_par_nom ? esc(demande.traite_par_nom) : '')}
        </div>

        <hr class="sa-separateur" />

        <label class="sa-champ-bloc">
          <span>Statut</span>
          <select class="sa-champ" id="fiche-statut">
            ${STATUTS.map((s) => `<option value="${s.cle}" ${demande.statut === s.cle ? 'selected' : ''}>${esc(s.libelle)}</option>`).join('')}
          </select>
        </label>

        <label class="sa-champ-bloc">
          <span>Rattacher à une école</span>
          <select class="sa-champ" id="fiche-ecole">
            <option value="">Aucune — prospect non converti</option>
            ${ecoles.map((e) => `<option value="${esc(e.id)}" ${demande.ecole_id === e.id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}
          </select>
          <small class="sa-note">À renseigner une fois l'école créée dans Ardoise. C'est ce
            rattachement qui permet de mesurer ce que le site public rapporte réellement.</small>
        </label>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Fermer</button>
        <button class="sa-bouton sa-bouton-principal" data-role="valider">Enregistrer</button>`
    });

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());

    modale.querySelector('[data-role="valider"]').addEventListener('click', async () => {
      const bouton = modale.querySelector('[data-role="valider"]');
      bouton.disabled = true;
      try {
        await SA.api(`/super-admin/prospects/${demande.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            statut: modale.querySelector('#fiche-statut').value,
            ecole_id: modale.querySelector('#fiche-ecole').value || null
          })
        });
        modale.fermer();
        SA.toast('Demande mise à jour.', 'succes');
        SA.rafraichirVue();
      } catch (err) {
        bouton.disabled = false;
        SA.toast(err.message || 'Enregistrement impossible.', 'danger');
      }
    });
  }

  SA.enregistrerVue('prospects', {
    titre: 'Demandes et messages',
    sousTitre: 'Ce que le site public a déposé — demandes d\'accompagnement et '
             + 'messages libres — et où en est chaque réponse.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(7, 46);

      const [d, ecoles] = await Promise.all([
        SA.api(SA.url('/super-admin/prospects', {
          statut: params.statut, origine: params.origine,
          recherche: params.recherche, page: params.page
        })),
        SA.api('/super-admin/ecoles?taille=200').catch(() => ({ donnees: [] }))
      ]);
      const listeEcoles = ecoles.donnees || ecoles.ecoles || [];

      const c = d.compteurs || {};

      const colonnes = [
        { cle: 'contact_nom', titre: 'Contact',
          rendu: (l) => `<strong>${esc(l.contact_nom)}</strong>
            ${l.ecole_nom ? `<div class="sa-muet">${esc(l.ecole_nom)}</div>` : ''}` },
        { cle: 'origine', titre: 'Origine', rendu: (l) => badgeOrigine(l.origine) },
        { cle: 'coordonnees', titre: 'Coordonnées', rendu: contact },
        /* Un message libre n'a ni ville, ni effectif, ni offre : sa colonne
           utile est le sujet. Une seule colonne sert donc les deux flux, plutôt
           que d'ajouter une septième vide une ligne sur deux. */
        { cle: 'sujet', titre: 'Sujet / Ville',
          rendu: (l) => l.origine === 'message_libre'
            ? esc(l.sujet || '')
            : esc(l.ville || '') },
        { cle: 'nb_eleves_estime', titre: 'Élèves', classe: 'sa-num',
          rendu: (l) => l.nb_eleves_estime ? fmt.nombre(l.nb_eleves_estime) : '' },
        { cle: 'offre_nom', titre: 'Offre visée', rendu: (l) => esc(l.offre_nom || '') },
        { cle: 'created_at', titre: 'Reçue',
          rendu: (l) => `${esc(fmt.date(l.created_at))}<div>${anciennete(l)}</div>` },
        { cle: 'statut', titre: 'Statut', rendu: (l) => badgeStatut(l.statut) },
        { cle: 'actions', titre: '',
          rendu: (l) => `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
                          data-fiche="${esc(l.id)}">Ouvrir</button>` }
      ];

      const orig = d.origines || {};
      const totalOrigines = Object.values(orig).reduce((s, o) => s + (o.total || 0), 0);

      /* Le compteur affiché est le nombre de lignes ENCORE NOUVELLES, pas le
         total : c'est ce qui reste à faire qui décide sur quel flux on clique.
         Le total ne dit que l'ancienneté du canal. */
      const pastilleOrigine = (cle, libelle, total, nouvelles) => {
        const actif = (params.origine || '') === cle;
        const marque = nouvelles ? `${nouvelles} / ${total}` : String(total);
        return `<button class="sa-bouton sa-bouton-petit ${actif ? 'sa-bouton-principal' : 'sa-bouton-secondaire'}"
                  data-origine="${cle}"
                  title="${nouvelles ? nouvelles + ' non traitée(s) sur ' + total : total + ' au total'}"
                  >${esc(libelle)} <span class="sa-mono">${esc(marque)}</span></button>`;
      };

      const pastille = (cle, libelle) => {
        const actif = (params.statut || '') === cle;
        const n = cle ? (c[cle] || 0) : Object.values(c).reduce((s, v) => s + v, 0);
        return `<button class="sa-bouton sa-bouton-petit ${actif ? 'sa-bouton-principal' : 'sa-bouton-secondaire'}"
                  data-statut="${cle}">${esc(libelle)} <span class="sa-mono">${n}</span></button>`;
      };

      conteneur.innerHTML = `
        <section class="sa-section">
          ${c.nouvelle
            ? `<div class="sa-encart">
                 <strong>${fmt.nombre(c.nouvelle)}</strong> demande(s) en attente de rappel.
                 Le site public annonce un retour sous 48 heures ouvrées.
               </div>`
            : ''}

          <div class="sa-filtres">
            ${pastille('', 'Toutes')}
            ${STATUTS.map((s) => pastille(s.cle, s.libelle)).join('')}
            <input class="sa-champ sa-champ-recherche" id="filtre-recherche" type="search"
                   placeholder="Nom, école, ville, téléphone, sujet, message…"
                   value="${esc(params.recherche || '')}" />
          </div>

          <div class="sa-filtres">
            ${pastilleOrigine('', 'Les deux flux', totalOrigines)}
            ${ORIGINES.map((o) => pastilleOrigine(
                o.cle, o.libelle, (orig[o.cle] || {}).total || 0,
                (orig[o.cle] || {}).nouvelles || 0)).join('')}
          </div>

          ${ui.tableau({
            colonnes, lignes: d.donnees, cliquable: true,
            vide: params.statut
              ? `Aucune demande « ${libelleStatut(params.statut)} »`
              : params.origine
                ? `Aucune ligne pour « ${trouverOrigine(params.origine).libelle || params.origine} »`
                : 'Aucune demande ni message reçu pour le moment'
          })}
          ${ui.pagination(d.pagination)}
        </section>`;

      /* ---------------------------------------------------------- Écoutes */

      const majEtRendre = (p) => { SA.majParams(p); SA.rafraichirVue(); };

      conteneur.querySelectorAll('[data-statut]').forEach((b) =>
        b.addEventListener('click', () => majEtRendre({
          statut: b.dataset.statut || undefined, page: 1
        })));

      conteneur.querySelectorAll('[data-origine]').forEach((b) =>
        b.addEventListener('click', () => majEtRendre({
          origine: b.dataset.origine || undefined, page: 1
        })));

      const rech = document.getElementById('filtre-recherche');
      if (rech) {
        rech.addEventListener('input', SA.antiRebond(() => majEtRendre({
          recherche: rech.value || undefined, page: 1
        }), 380));
      }

      const parId = (id) => d.donnees.find((x) => String(x.id) === String(id));

      conteneur.querySelectorAll('[data-fiche]').forEach((b) =>
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          const demande = parId(b.dataset.fiche);
          if (demande) ouvrirFiche(demande, listeEcoles);
        }));

      conteneur.querySelectorAll('tr[data-id]').forEach((tr) =>
        tr.addEventListener('click', () => {
          const demande = parId(tr.dataset.id);
          if (demande) ouvrirFiche(demande, listeEcoles);
        }));

      conteneur.querySelectorAll('[data-page]').forEach((b) =>
        b.addEventListener('click', () => majEtRendre({ page: b.dataset.page })));
    }
  });
})();
