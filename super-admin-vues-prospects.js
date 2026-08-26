/* ==========================================================================
   Ardoise — Super Admin : demandes d'accompagnement (prospects)
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
  const badgeOrigine = (c) => ui.badge(trouverOrigine(c).libelle || c || '—', trouverOrigine(c).ton || 'neutre');
  const badgeStatut = (c) => ui.badge(libelleStatut(c), trouver(c).ton);

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

  function historiqueReponses(demande) {
    const reponses = Array.isArray(demande.reponses) ? demande.reponses : [];
    if (!reponses.length) {
      return '<div class="sa-muet">Aucune réponse officielle envoyée pour le moment.</div>';
    }

    return reponses.map((r) => `
      <div class="sa-encart" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
          <strong>${esc(r.sujet || 'Réponse Ardoise')}</strong>
          ${r.envoye ? ui.badge('Envoyé', 'succes') : ui.badge('Échec', 'danger')}
        </div>
        <div class="sa-muet" style="margin:4px 0 8px">
          ${esc(fmt.date(r.created_at))}${r.envoye_par_nom ? ` · ${esc(r.envoye_par_nom)}` : ''}
          · ${esc(r.destinataire || '')}
        </div>
        <div class="sa-texte">${esc(r.message || '').replace(/\n/g, '<br />')}</div>
        ${r.erreur ? `<div class="sa-negatif" style="margin-top:8px">${esc(r.erreur)}</div>` : ''}
      </div>`).join('');
  }

  function ouvrirFiche(demande, ecoles) {
    const info = (libelle, valeurHtml) => valeurHtml
      ? `<div class="sa-fiche-ligne"><span class="sa-muet">${esc(libelle)}</span><div>${valeurHtml}</div></div>`
      : '';

    const services = (demande.services_souhaites || []).length
      ? demande.services_souhaites.map((s) => `<span class="sa-etiquette">${esc(s)}</span>`).join(' ')
      : '';
    const libre = demande.origine === 'message_libre';
    const sujetDefaut = libre && demande.sujet
      ? `Re: ${demande.sujet}`
      : 'Suite à votre demande auprès d’Ardoise';

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
          ${info(libre ? 'Son message' : 'Sa situation', demande.message
            ? `<p class="sa-texte">${esc(demande.message).replace(/\n/g, '<br />')}</p>` : '')}
          ${info('École rattachée', demande.ecole_liee_nom ? esc(demande.ecole_liee_nom) : '')}
          ${info('Dernier suivi par', demande.traite_par_nom ? esc(demande.traite_par_nom) : '')}
        </div>

        <hr class="sa-separateur" />

        <h3 style="margin:0 0 12px">Réponse officielle Ardoise</h3>
        ${demande.contact_email ? `
          <div class="sa-encart" style="margin-bottom:12px">
            Cette réponse sera envoyée à <strong>${esc(demande.contact_email)}</strong> avec l’identité officielle Ardoise.
          </div>
          <label class="sa-champ-bloc">
            <span>Objet</span>
            <input class="sa-champ" id="fiche-reponse-sujet" maxlength="180" value="${esc(sujetDefaut)}" />
          </label>
          <label class="sa-champ-bloc">
            <span>Message</span>
            <textarea class="sa-champ" id="fiche-reponse-message" rows="7" maxlength="12000"
              placeholder="Rédigez ici la réponse officielle à envoyer au prospect…"></textarea>
          </label>
          <button class="sa-bouton sa-bouton-principal" type="button" data-role="envoyer-reponse">Envoyer la réponse officielle</button>
        ` : `
          <div class="sa-encart">
            <strong>Réponse e-mail indisponible.</strong> Ce prospect n’a pas renseigné d’adresse e-mail.
            Le numéro de téléphone reste accessible dans ses coordonnées.
          </div>`}

        <div style="margin-top:18px">
          <h3 style="margin:0 0 12px">Historique des réponses</h3>
          ${historiqueReponses(demande)}
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
          <small class="sa-note">À renseigner une fois l'école créée dans Ardoise.</small>
        </label>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Fermer</button>
        <button class="sa-bouton sa-bouton-principal" data-role="valider">Enregistrer</button>`
    });

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());

    const envoyer = modale.querySelector('[data-role="envoyer-reponse"]');
    if (envoyer) {
      envoyer.addEventListener('click', async () => {
        const sujet = modale.querySelector('#fiche-reponse-sujet').value.trim();
        const message = modale.querySelector('#fiche-reponse-message').value.trim();
        if (!message) {
          SA.toast('Écrivez le message avant de l’envoyer.', 'danger');
          return;
        }

        envoyer.disabled = true;
        const texteBouton = envoyer.textContent;
        envoyer.textContent = 'Envoi en cours…';
        try {
          await SA.api(`/super-admin/prospects/${demande.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ reponse: { sujet, message } })
          });
          modale.fermer();
          SA.toast('Réponse officielle envoyée.', 'succes');
          SA.rafraichirVue();
        } catch (err) {
          envoyer.disabled = false;
          envoyer.textContent = texteBouton;
          SA.toast(err.message || 'La réponse n’a pas pu être envoyée.', 'danger');
        }
      });
    }

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
    sousTitre: 'Demandes du site public, réponses officielles et suivi commercial.',

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
          rendu: (l) => `<strong>${esc(l.contact_nom)}</strong>${l.ecole_nom ? `<div class="sa-muet">${esc(l.ecole_nom)}</div>` : ''}` },
        { cle: 'origine', titre: 'Origine', rendu: (l) => badgeOrigine(l.origine) },
        { cle: 'coordonnees', titre: 'Coordonnées', rendu: contact },
        { cle: 'sujet', titre: 'Sujet / Ville',
          rendu: (l) => l.origine === 'message_libre' ? esc(l.sujet || '') : esc(l.ville || '') },
        { cle: 'nb_eleves_estime', titre: 'Élèves', classe: 'sa-num',
          rendu: (l) => l.nb_eleves_estime ? fmt.nombre(l.nb_eleves_estime) : '' },
        { cle: 'offre_nom', titre: 'Offre visée', rendu: (l) => esc(l.offre_nom || '') },
        { cle: 'created_at', titre: 'Reçue', rendu: (l) => `${esc(fmt.date(l.created_at))}<div>${anciennete(l)}</div>` },
        { cle: 'statut', titre: 'Statut', rendu: (l) => badgeStatut(l.statut) },
        { cle: 'actions', titre: '',
          rendu: (l) => `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-fiche="${esc(l.id)}">Ouvrir</button>` }
      ];

      const orig = d.origines || {};
      const totalOrigines = Object.values(orig).reduce((s, o) => s + (o.total || 0), 0);

      const pastilleOrigine = (cle, libelle, total, nouvelles) => {
        const actif = (params.origine || '') === cle;
        const marque = nouvelles ? `${nouvelles} / ${total}` : String(total);
        return `<button class="sa-bouton sa-bouton-petit ${actif ? 'sa-bouton-principal' : 'sa-bouton-secondaire'}" data-origine="${cle}">${esc(libelle)} <span class="sa-mono">${esc(marque)}</span></button>`;
      };

      const pastille = (cle, libelle) => {
        const actif = (params.statut || '') === cle;
        const n = cle ? (c[cle] || 0) : Object.values(c).reduce((s, v) => s + v, 0);
        return `<button class="sa-bouton sa-bouton-petit ${actif ? 'sa-bouton-principal' : 'sa-bouton-secondaire'}" data-statut="${cle}">${esc(libelle)} <span class="sa-mono">${n}</span></button>`;
      };

      conteneur.innerHTML = `
        <section class="sa-section">
          ${c.nouvelle ? `<div class="sa-encart"><strong>${fmt.nombre(c.nouvelle)}</strong> demande(s) en attente de réponse. Le site public annonce un retour sous 48 heures ouvrées.</div>` : ''}
          <div class="sa-filtres">
            ${pastille('', 'Toutes')}
            ${STATUTS.map((s) => pastille(s.cle, s.libelle)).join('')}
            <input class="sa-champ sa-champ-recherche" id="filtre-recherche" type="search"
                   placeholder="Nom, école, ville, téléphone, sujet, message…" value="${esc(params.recherche || '')}" />
          </div>
          <div class="sa-filtres">
            ${pastilleOrigine('', 'Les deux flux', totalOrigines)}
            ${ORIGINES.map((o) => pastilleOrigine(o.cle, o.libelle, (orig[o.cle] || {}).total || 0, (orig[o.cle] || {}).nouvelles || 0)).join('')}
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

      const majEtRendre = (p) => { SA.majParams(p); SA.rafraichirVue(); };

      conteneur.querySelectorAll('[data-statut]').forEach((b) =>
        b.addEventListener('click', () => majEtRendre({ statut: b.dataset.statut || undefined, page: 1 })));
      conteneur.querySelectorAll('[data-origine]').forEach((b) =>
        b.addEventListener('click', () => majEtRendre({ origine: b.dataset.origine || undefined, page: 1 })));

      const rech = document.getElementById('filtre-recherche');
      if (rech) {
        rech.addEventListener('input', SA.antiRebond(() => majEtRendre({ recherche: rech.value || undefined, page: 1 }), 380));
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
