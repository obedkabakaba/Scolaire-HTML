/* ==========================================================================
   Ardoise — Espace Super Admin : COMMUNICATIONS
   --------------------------------------------------------------------------
   Quatre pièces, réunies parce qu'elles parlent toutes de messages :

     1. LA CLOCHE de la barre haute — les alertes non lues, relues chaque
        minute, ouvertes d'un clic sans quitter l'écran en cours ;
     2. LA BOÎTE DE RÉCEPTION (#/communications) — tout ce que la plateforme
        signale au Super Admin, filtrable par catégorie, avec l'état de
        l'envoi par e-mail et par WhatsApp ;
     3. LES PRÉFÉRENCES (#/communications/preferences) — quoi recevoir, et
        par quelle voie : plateforme, e-mail, WhatsApp, catégorie par
        catégorie ;
     4. LA RÉDACTION ASSISTÉE — un bouton « Rédiger avec l'IA » posé sous
        chaque zone de l'espace où l'on écrit un message (réponse à un
        ticket, annonce, motif de refus, message à un apporteur…), y compris
        dans les fenêtres ouvertes après coup.

   Chargé après la coque (icônes, pastilles du rail) et avant la palette.
   ========================================================================== */

(function () {
  'use strict';

  if (!window.SA) return;
  const { esc, fmt, ui } = SA;
  const BASE = '/super-admin/communications';

  const ICONE_CLOCHE = '<svg class="sa-svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8.5 3 8.5H3S6 15 6 8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/></svg>';
  const ICONE_ETINCELLE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';

  /** Libellés courts des catégories, pour les puces (le serveur fait foi pour la liste). */
  const LIBELLES = {
    support: 'Support', paiements: 'Paiements', prospects: 'Site public',
    demonstrations: 'Essais', services: 'Services', apporteurs: 'Apporteurs', incidents: 'Incidents'
  };

  /** Le lien stocké est '/super-admin.html#/support' : on n'en garde que la route. */
  function routeDuLien(lien) {
    const m = /#\/?(.*)$/.exec(String(lien || ''));
    return m && m[1] ? m[1] : 'communications';
  }

  /* ======================================================================
     1. LA CLOCHE
     ====================================================================== */

  const cloche = document.getElementById('sa-cloche');
  const panneauCloche = document.getElementById('sa-cloche-panneau');
  const pastille = document.getElementById('sa-cloche-pastille');
  const iconeCloche = document.querySelector('.sa-cloche-icone');
  if (iconeCloche) iconeCloche.innerHTML = ICONE_CLOCHE;

  let nonLues = null;      // null = non mesuré
  let minuteurCloche = null;

  function poserCompteur(n) {
    nonLues = n;
    if (pastille) {
      pastille.hidden = !n;
      pastille.textContent = n > 99 ? '99+' : String(n || '');
    }
    if (cloche) cloche.setAttribute('aria-label', n ? `Notifications — ${n} non lue(s)` : 'Notifications');
    if (SA.coque && SA.coque.majCompteurs) {
      SA.coque.majCompteurs({ boite: n === null ? null : { n, ton: 'danger' } });
    }
  }

  async function relireCompteur() {
    clearTimeout(minuteurCloche);
    if (!SA.session.connecte()) return;
    if (document.visibilityState === 'visible') {
      try {
        const d = await SA.api(`${BASE}/boite/compteur`);
        const avant = nonLues;
        poserCompteur(Number(d.non_lues) || 0);
        // Une nouvelle alerte pendant qu'on travaille : un mot discret, pas une sirène.
        if (avant !== null && nonLues > avant) {
          SA.toast(`${nonLues - avant} nouvelle(s) notification(s).`, 'info', 6000);
          if (panneauCloche && !panneauCloche.hidden) remplirPanneau();
        }
      } catch (err) {
        // Route absente (backend pas encore déployé) ou panne : pas de pastille plutôt qu'un zéro.
        poserCompteur(null);
      }
    }
    minuteurCloche = setTimeout(relireCompteur, 60 * 1000);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && SA.session.connecte()) relireCompteur();
  });

  function elementAlerte(n, compact) {
    const canaux = etatsEnvoi(n);
    return `
      <a class="sa-alerte${n.lu ? '' : ' non-lue'}${compact ? ' compacte' : ''}" href="#/${esc(routeDuLien(n.lien))}" data-id="${esc(n.id)}">
        <span class="sa-alerte-point" aria-hidden="true"></span>
        <span class="sa-alerte-corps">
          <span class="sa-alerte-tete">
            <span class="sa-alerte-cat cat-${esc(n.categorie)}">${esc(LIBELLES[n.categorie] || n.categorie)}</span>
            <span class="sa-alerte-quand" title="${esc(fmt.dateHeure(n.created_at))}">${esc(fmt.relatif(n.created_at))}</span>
          </span>
          <span class="sa-alerte-titre">${esc(n.titre || 'Notification')}</span>
          ${n.contenu ? `<span class="sa-alerte-texte">${esc(n.contenu)}</span>` : ''}
          ${!compact && (n.ecole_nom || canaux) ? `<span class="sa-alerte-pied">
              ${n.ecole_nom ? `<span>${esc(n.ecole_nom)}</span>` : ''}${canaux}</span>` : ''}
        </span>
      </a>`;
  }

  /** Puces « e-mail envoyé », « WhatsApp en échec »… : ce que l'alerte est devenue hors de la plateforme. */
  function etatsEnvoi(n) {
    const puces = [];
    const libelle = { envoye: 'envoyé', en_attente: 'en file', en_cours: 'en cours', echoue: 'échec', abandonne: 'abandonné' };
    if (n.email_statut) {
      const ton = n.email_statut === 'envoye' ? 'succes' : (/echoue|abandonne/.test(n.email_statut) ? 'danger' : 'neutre');
      puces.push(`<span class="sa-puce-canal ton-${ton}" title="${esc(n.email_adresse || '')}">E-mail ${esc(libelle[n.email_statut] || n.email_statut)}</span>`);
    }
    if (n.whatsapp_statut) {
      const lu = n.whatsapp_livraison === 'read' ? 'lu' : n.whatsapp_livraison === 'delivered' ? 'reçu' : null;
      const ton = n.whatsapp_statut === 'envoye' ? 'succes' : n.whatsapp_statut === 'echoue' ? 'danger' : 'neutre';
      puces.push(`<span class="sa-puce-canal ton-${ton}" title="${esc(n.whatsapp_erreur || '')}">WhatsApp ${esc(lu || libelle[n.whatsapp_statut] || n.whatsapp_statut)}</span>`);
    }
    return puces.join('');
  }

  async function remplirPanneau() {
    panneauCloche.innerHTML = `
      <div class="sa-cloche-entete">
        <strong>Notifications</strong>
        <button type="button" class="sa-lien-bouton" data-role="tout-lu">Tout marquer lu</button>
      </div>
      <div class="sa-cloche-liste">${ui.squelette(3, 52)}</div>
      <div class="sa-cloche-pied">
        <a href="#/communications">Tout voir</a>
        <a href="#/communications/preferences">Préférences</a>
      </div>`;
    const liste = panneauCloche.querySelector('.sa-cloche-liste');
    try {
      const d = await SA.api(`${BASE}/boite?taille=8`);
      poserCompteur(Number(d.non_lues) || 0);
      liste.innerHTML = (d.donnees || []).length
        ? d.donnees.map((n) => elementAlerte(n, true)).join('')
        : '<p class="sa-cloche-vide">Rien de nouveau. Les alertes de la plateforme arriveront ici.</p>';
    } catch (err) {
      liste.innerHTML = `<p class="sa-cloche-vide">${esc(err.message || 'Notifications indisponibles.')}</p>`;
    }
  }

  function basculerPanneau(ouvrir) {
    if (!panneauCloche || !cloche) return;
    const etat = typeof ouvrir === 'boolean' ? ouvrir : panneauCloche.hidden;
    panneauCloche.hidden = !etat;
    cloche.setAttribute('aria-expanded', String(etat));
    cloche.classList.toggle('actif', etat);
    if (etat) remplirPanneau();
  }

  async function marquer(id, lu = true) {
    await SA.api(`${BASE}/boite/${encodeURIComponent(id)}/lu`, { method: 'PATCH', body: JSON.stringify({ lu }) });
  }

  if (cloche && panneauCloche) {
    cloche.addEventListener('click', (ev) => { ev.stopPropagation(); basculerPanneau(); });
    document.addEventListener('click', (ev) => {
      if (!panneauCloche.hidden && !ev.target.closest('#sa-cloche-zone')) basculerPanneau(false);
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !panneauCloche.hidden) { basculerPanneau(false); cloche.focus(); }
    });
    panneauCloche.addEventListener('click', async (ev) => {
      const toutLu = ev.target.closest('[data-role="tout-lu"]');
      if (toutLu) {
        ev.preventDefault();
        try { await SA.api(`${BASE}/boite/tout-lu`, { method: 'POST', body: '{}' }); remplirPanneau(); }
        catch (err) { SA.toast(err.message, 'danger'); }
        return;
      }
      const alerte = ev.target.closest('.sa-alerte');
      if (alerte && alerte.classList.contains('non-lue')) {
        marquer(alerte.getAttribute('data-id')).then(() => relireCompteur()).catch(() => {});
      }
      if (ev.target.closest('a')) basculerPanneau(false);
    });
  }

  /* ======================================================================
     2. BOÎTE DE RÉCEPTION
     ====================================================================== */

  SA.enregistrerVue('communications', {
    titre: 'Boîte de réception',
    sousTitre: 'Tout ce que la plateforme vous signale : tickets, paiements, demandes du site, essais, apporteurs, incidents.',

    async rendu(conteneur, params) {
      const etat = { categorie: params.categorie || '', etat: params.etat || '', page: Number(params.page) || 1 };
      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `
          <button class="sa-bouton sa-bouton-secondaire" data-role="tout-lu">Tout marquer lu</button>
          <a class="sa-bouton sa-bouton-secondaire" href="#/communications/preferences">Préférences</a>`;
        actions.querySelector('[data-role="tout-lu"]').addEventListener('click', async (ev) => {
          ev.currentTarget.disabled = true;
          try {
            const r = await SA.api(`${BASE}/boite/tout-lu`, { method: 'POST', body: JSON.stringify({ categorie: etat.categorie || undefined }) });
            SA.toast(`${r.marquees} notification(s) marquée(s) comme lue(s).`, 'succes');
            relireCompteur();
            charger();
          } catch (err) { SA.toast(err.message, 'danger'); }
          finally { ev.currentTarget.disabled = false; }
        });
      }

      conteneur.innerHTML = `
        <div class="sa-boite">
          <aside class="sa-boite-filtres" aria-label="Catégories" id="cm-categories">${ui.squelette(6, 34)}</aside>
          <section class="sa-boite-liste">
            <div class="sa-boite-barre">
              <div class="sa-onglets" role="tablist">
                <button class="sa-onglet${etat.etat ? '' : ' actif'}" data-etat="">Toutes</button>
                <button class="sa-onglet${etat.etat === 'non_lues' ? ' actif' : ''}" data-etat="non_lues">Non lues</button>
              </div>
            </div>
            <div id="cm-liste">${ui.squelette(5, 70)}</div>
            <div id="cm-pagination"></div>
          </section>
        </div>`;

      conteneur.querySelectorAll('[data-etat]').forEach((b) => b.addEventListener('click', () => {
        etat.etat = b.getAttribute('data-etat'); etat.page = 1;
        conteneur.querySelectorAll('[data-etat]').forEach((x) => x.classList.toggle('actif', x === b));
        charger();
      }));

      async function charger() {
        SA.majParams({ categorie: etat.categorie, etat: etat.etat, page: etat.page > 1 ? etat.page : '' });
        const requete = new URLSearchParams({ page: etat.page, taille: 20 });
        if (etat.categorie) requete.set('categorie', etat.categorie);
        if (etat.etat) requete.set('etat', etat.etat);
        const zone = conteneur.querySelector('#cm-liste');
        try {
          const d = await SA.api(`${BASE}/boite?${requete}`);
          poserCompteur(Number(d.non_lues) || 0);
          dessinerCategories(d.categories || [], d.non_lues);
          zone.innerHTML = (d.donnees || []).length
            ? `<div class="sa-alertes">${d.donnees.map((n) => `
                <div class="sa-alerte-ligne">
                  ${elementAlerte(n, false)}
                  <button type="button" class="sa-lien-bouton" data-basculer="${esc(n.id)}" data-lu="${n.lu ? '1' : ''}">
                    ${n.lu ? 'Marquer non lue' : 'Marquer lue'}</button>
                </div>`).join('')}</div>`
            : ui.etatVide(etat.etat ? 'Aucune notification non lue' : 'Aucune notification',
              'Les tickets, paiements à vérifier, demandes du site et autres alertes apparaîtront ici.');
          conteneur.querySelector('#cm-pagination').innerHTML = ui.pagination(d.pagination);
        } catch (err) {
          zone.innerHTML = ui.etatErreur(err.message);
        }
      }

      function dessinerCategories(categories, total) {
        const zone = conteneur.querySelector('#cm-categories');
        const bouton = (code, libelle, n) => `
          <button type="button" class="sa-boite-cat${etat.categorie === code ? ' actif' : ''}" data-categorie="${esc(code)}">
            <span>${esc(libelle)}</span>${n ? `<span class="sa-compteur ton-danger">${esc(n)}</span>` : ''}
          </button>`;
        zone.innerHTML = bouton('', 'Toutes les catégories', total)
          + categories.map((c) => bouton(c.code, c.libelle, c.non_lues)).join('');
      }

      // Écouteurs posés sur la racine de l'écran, jamais sur #sa-contenu : ce
      // conteneur survit aux changements d'écran et les accumulerait.
      const racine = conteneur.querySelector('.sa-boite');
      racine.addEventListener('click', async (ev) => {
        const cat = ev.target.closest('[data-categorie]');
        if (cat) { etat.categorie = cat.getAttribute('data-categorie'); etat.page = 1; charger(); return; }
        const page = ev.target.closest('[data-page]');
        if (page && !page.disabled) { etat.page = Number(page.getAttribute('data-page')); charger(); return; }
        const bascule = ev.target.closest('[data-basculer]');
        if (bascule) {
          try { await marquer(bascule.getAttribute('data-basculer'), !bascule.getAttribute('data-lu')); relireCompteur(); charger(); }
          catch (err) { SA.toast(err.message, 'danger'); }
          return;
        }
        const alerte = ev.target.closest('.sa-alerte.non-lue');
        if (alerte) marquer(alerte.getAttribute('data-id')).then(relireCompteur).catch(() => {});
      });

      await charger();
    }
  });

  /* ======================================================================
     3. PRÉFÉRENCES DE NOTIFICATION
     ====================================================================== */

  SA.enregistrerVue('communications/preferences', {
    titre: 'Préférences de notification',
    sousTitre: 'Choisissez ce que vous voulez recevoir, et par quelle voie : dans la plateforme, par e-mail, sur WhatsApp.',

    async rendu(conteneur) {
      const d = await SA.api(`${BASE}/preferences`);
      const p = d.preferences;
      const etatCanaux = d.etat_canaux || {};

      conteneur.innerHTML = `<div class="sa-preferences">
        ${d.migration_appliquee ? '' : `<div class="sa-encart sa-encart-attention" style="margin-bottom:16px">
          <strong>Migration 068 à appliquer.</strong> Vos choix ne pourront pas être enregistrés tant que la table
          <code>preferences_notifications_super_admin</code> n'existe pas. En attendant, tout arrive dans la plateforme et par e-mail.</div>`}

        <h2 class="sa-section-titre">Par où vous prévenir</h2>
        <div class="sa-canaux">
          <div class="sa-panneau sa-canal">
            <div class="sa-canal-tete">
              <div><strong>Dans la plateforme</strong><p class="sa-muet">La cloche en haut de l'écran et la boîte de réception.</p></div>
              <span class="sa-badge ton-succes">toujours disponible</span>
            </div>
          </div>

          <div class="sa-panneau sa-canal">
            <div class="sa-canal-tete">
              <div><strong>E-mail</strong><p class="sa-muet">${etatCanaux.email_configure ? 'Envoi par Resend.' : 'RESEND_API_KEY absente sur le serveur : aucun e-mail ne partira.'}</p></div>
              <label class="sa-interrupteur"><input type="checkbox" id="pf-email-actif" ${p.email_actif ? 'checked' : ''}><span></span>
                <span class="sa-visuellement-cache">Recevoir par e-mail</span></label>
            </div>
            <label class="sa-champ-bloc"><span>Adresse — vide : celle de votre compte</span>
              <input class="sa-champ" id="pf-email" type="email" maxlength="200" value="${esc(p.email_adresse)}"
                     placeholder="${esc(d.email_compte || 'adresse@exemple.com')}"></label>
            <button type="button" class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-tester="email">Envoyer un e-mail de test</button>
          </div>

          <div class="sa-panneau sa-canal">
            <div class="sa-canal-tete">
              <div><strong>WhatsApp</strong><p class="sa-muet">${etatCanaux.whatsapp_configure
                ? `Envoi par le gabarit Meta « ${esc(etatCanaux.whatsapp_modele || '')} ».`
                : 'WhatsApp n’est pas configuré sur le serveur (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID).'}</p></div>
              <label class="sa-interrupteur"><input type="checkbox" id="pf-wa-actif" ${p.whatsapp_actif ? 'checked' : ''}><span></span>
                <span class="sa-visuellement-cache">Recevoir sur WhatsApp</span></label>
            </div>
            <label class="sa-champ-bloc"><span>Numéro WhatsApp</span>
              <input class="sa-champ" id="pf-wa" type="tel" maxlength="20" value="${p.whatsapp_numero ? '+' + esc(p.whatsapp_numero) : ''}"
                     placeholder="0855035693 ou +243855035693"></label>
            <p class="sa-note">Meta n'accepte qu'un message pré-approuvé (gabarit) pour écrire le premier : tant que le gabarit
              n'est pas approuvé, les envois WhatsApp sont refusés et le motif s'affiche dans la boîte de réception.</p>
            <button type="button" class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-tester="whatsapp">Envoyer un WhatsApp de test</button>
          </div>
        </div>

        <h2 class="sa-section-titre" style="margin-top:26px">Ce que vous voulez recevoir
          <span class="sa-annexe">Décochez ce qui ne vous intéresse pas, canal par canal.</span></h2>
        <div class="sa-conteneur-tableau">
          <table class="sa-tableau sa-grille-preferences">
            <thead><tr>
              <th>Catégorie</th>
              ${d.canaux.map((c) => `<th class="sa-centre"><label class="sa-tout-cocher">
                <input type="checkbox" data-colonne="${esc(c.code)}"> ${esc(c.libelle)}</label></th>`).join('')}
            </tr></thead>
            <tbody>
              ${d.categories.map((cat) => `<tr>
                <td><strong>${esc(cat.libelle)}</strong><div class="sa-muet" style="font-size:.78rem">${esc(cat.description)}</div></td>
                ${d.canaux.map((c) => `<td class="sa-centre"><input type="checkbox" aria-label="${esc(cat.libelle)} — ${esc(c.libelle)}"
                    data-cat="${esc(cat.code)}" data-canal="${esc(c.code)}" ${p.categories[cat.code] && p.categories[cat.code][c.code] ? 'checked' : ''}></td>`).join('')}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="sa-barre-enregistrer">
          <span class="sa-muet" id="pf-etat"></span>
          <button type="button" class="sa-bouton sa-bouton-principal" id="pf-enregistrer">Enregistrer mes préférences</button>
        </div></div>`;
      const racine = conteneur.querySelector('.sa-preferences');

      const cases = () => [...conteneur.querySelectorAll('input[data-cat]')];
      const synchroniserColonnes = () => {
        conteneur.querySelectorAll('input[data-colonne]').forEach((tete) => {
          const col = cases().filter((x) => x.getAttribute('data-canal') === tete.getAttribute('data-colonne'));
          tete.checked = col.every((x) => x.checked);
          tete.indeterminate = !tete.checked && col.some((x) => x.checked);
        });
      };
      synchroniserColonnes();
      const modifie = () => { conteneur.querySelector('#pf-etat').textContent = 'Modifications non enregistrées.'; };
      racine.addEventListener('change', (ev) => {
        const tete = ev.target.closest('input[data-colonne]');
        if (tete) cases().filter((x) => x.getAttribute('data-canal') === tete.getAttribute('data-colonne'))
          .forEach((x) => { x.checked = tete.checked; });
        synchroniserColonnes();
        modifie();
      });
      racine.addEventListener('input', (ev) => { if (ev.target.matches('#pf-email, #pf-wa')) modifie(); });

      async function enregistrer() {
        const categories = {};
        cases().forEach((x) => {
          const cat = x.getAttribute('data-cat');
          categories[cat] = categories[cat] || {};
          categories[cat][x.getAttribute('data-canal')] = x.checked;
        });
        const corps = {
          email_actif: conteneur.querySelector('#pf-email-actif').checked,
          email_adresse: conteneur.querySelector('#pf-email').value.trim(),
          whatsapp_actif: conteneur.querySelector('#pf-wa-actif').checked,
          whatsapp_numero: conteneur.querySelector('#pf-wa').value.trim(),
          categories
        };
        return SA.api(`${BASE}/preferences`, { method: 'PUT', body: JSON.stringify(corps) });
      }

      conteneur.querySelector('#pf-enregistrer').addEventListener('click', async (ev) => {
        const bouton = ev.currentTarget;
        bouton.disabled = true;
        try {
          const r = await enregistrer();
          conteneur.querySelector('#pf-etat').textContent = 'Enregistré.';
          if (r.preferences && r.preferences.whatsapp_numero) conteneur.querySelector('#pf-wa').value = '+' + r.preferences.whatsapp_numero;
          SA.toast(r.message || 'Préférences enregistrées.', 'succes');
        } catch (err) { SA.toast(err.message, 'danger', 8000); }
        finally { bouton.disabled = false; }
      });

      conteneur.querySelectorAll('[data-tester]').forEach((b) => b.addEventListener('click', async () => {
        const canal = b.getAttribute('data-tester');
        b.disabled = true;
        const libelle = b.textContent;
        b.textContent = 'Envoi…';
        try {
          // Le test part vers ce qui est À L'ÉCRAN : on enregistre d'abord.
          await enregistrer();
          conteneur.querySelector('#pf-etat').textContent = 'Enregistré.';
          const r = await SA.api(`${BASE}/preferences/test`, { method: 'POST', body: JSON.stringify({ canal }) });
          SA.toast(r.message, 'succes', 8000);
        } catch (err) { SA.toast(err.message, 'danger', 12000); }
        finally { b.disabled = false; b.textContent = libelle; }
      }));
    }
  });

  /* ======================================================================
     4. RÉDACTION ASSISTÉE PAR L'IA — partout où l'on écrit un message
     ----------------------------------------------------------------------
     Un observateur repère chaque <textarea> de l'espace, y compris dans les
     fenêtres ouvertes plus tard, et pose dessous la barre « Rédiger avec
     l'IA ». Sont écartées les zones qui ne sont pas des messages : questions
     posées à l'IA elle-même, JSON, contenu de base de connaissance, champs en
     lecture seule — et celles qui ont déjà leur propre assistant.
     ====================================================================== */

  const EXCLUS = /^(ia-question|cc-question|ia-ctx|ia-cmp-msg|ia-conseil|fiche-reponse-message|cc-nr-|cc-nd-|kb-)/;

  /** Nature du message, d'après le champ puis l'écran : elle règle le ton et la forme du brouillon. */
  function natureDe(zone) {
    const id = zone.id || '';
    const route = (SA.routeCourante && SA.routeCourante.chemin) || '';
    if (id === 't-reponse') return { nature: 'reponse_ticket' };
    if (id === 'n-contenu') return { nature: 'annonce_ecoles', sujet: '#n-titre' };
    if (id === 'grp-contenu') return { nature: 'annonce_ecoles', sujet: '#grp-titre' };
    if (id === 't-description') return { nature: 'libre', sujet: '#t-sujet' };
    if (id === 'cc-mt-message') return { nature: 'maintenance' };
    if (id === 'renouv-motif') return { nature: 'motif' };
    if (/note|commentaire|motif|desc/.test(id)) return { nature: 'note_interne' };
    if (/^apporteurs/.test(route)) return { nature: 'message_apporteur' };
    if (/^support/.test(route)) return { nature: 'reponse_ticket' };
    return { nature: 'libre' };
  }

  /** Ce que le Super Admin a sous les yeux : la fenêtre ouverte, sinon l'écran. */
  function contexteDe(zone) {
    const hote = zone.closest('.sa-modale') || zone.closest('.am-fil') || document.getElementById('sa-contenu');
    if (!hote) return '';
    const copie = hote.cloneNode(true);
    copie.querySelectorAll('textarea, input, select, button, script, style, .sa-ia-redaction').forEach((x) => x.remove());
    const titre = document.querySelector('#sa-entete h1');
    return [titre ? titre.textContent.trim() : '', (copie.textContent || '').replace(/\s+/g, ' ').trim()]
      .filter(Boolean).join(' — ').slice(-5000);
  }

  function poserAssistant(zone) {
    zone.setAttribute('data-ia-pret', '1');
    if (zone.readOnly || zone.disabled || zone.hasAttribute('data-sans-ia') || EXCLUS.test(zone.id || '')) return;
    if (zone.closest('.ia-studio, .cc-copilote, [data-sans-ia]')) return;

    const barre = document.createElement('div');
    barre.className = 'sa-ia-redaction';
    barre.innerHTML = `
      <button type="button" class="sa-ia-bouton" data-ia="ouvrir" aria-expanded="false">${ICONE_ETINCELLE}<span>Rédiger avec l'IA</span></button>
      <span class="sa-ia-rapides">
        <button type="button" class="sa-lien-bouton" data-ia-action="ameliorer">Améliorer</button>
        <button type="button" class="sa-lien-bouton" data-ia-action="corriger">Corriger</button>
        <button type="button" class="sa-lien-bouton" data-ia-action="raccourcir">Raccourcir</button>
      </span>
      <button type="button" class="sa-lien-bouton" data-ia="annuler" hidden>↶ Revenir à mon texte</button>
      <div class="sa-ia-panneau" hidden>
        <input class="sa-champ" data-ia="consigne" maxlength="800"
               placeholder="Ce que le message doit dire, en une phrase (ex. : rassurer l'école, le correctif arrive demain)">
        <select class="sa-champ" data-ia="ton" aria-label="Ton du message">
          <option value="professionnel">Professionnel</option>
          <option value="empathique">Empathique</option>
          <option value="direct">Direct</option>
          <option value="formel">Formel</option>
        </select>
        <button type="button" class="sa-bouton sa-bouton-principal sa-bouton-petit" data-ia-action="rediger">Proposer</button>
      </div>
      <div class="sa-ia-etat" aria-live="polite"></div>`;
    zone.insertAdjacentElement('afterend', barre);

    const panneau = barre.querySelector('.sa-ia-panneau');
    const etat = barre.querySelector('.sa-ia-etat');
    const annuler = barre.querySelector('[data-ia="annuler"]');
    let sauvegarde = null;

    barre.querySelector('[data-ia="ouvrir"]').addEventListener('click', (ev) => {
      panneau.hidden = !panneau.hidden;
      ev.currentTarget.setAttribute('aria-expanded', String(!panneau.hidden));
      if (!panneau.hidden) barre.querySelector('[data-ia="consigne"]').focus();
    });
    barre.querySelector('[data-ia="consigne"]').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); barre.querySelector('[data-ia-action="rediger"]').click(); }
    });

    annuler.addEventListener('click', () => {
      if (!sauvegarde) return;
      zone.value = sauvegarde.texte;
      if (sauvegarde.champSujet) sauvegarde.champSujet.value = sauvegarde.sujet;
      zone.dispatchEvent(new Event('input', { bubbles: true }));
      sauvegarde = null;
      annuler.hidden = true;
      etat.textContent = '';
    });

    barre.querySelectorAll('[data-ia-action]').forEach((b) => b.addEventListener('click', async () => {
      const action = b.getAttribute('data-ia-action');
      const { nature, sujet } = natureDe(zone);
      const champSujet = sujet ? (zone.closest('.sa-modale') || document).querySelector(sujet) : null;
      if (action !== 'rediger' && !zone.value.trim()) {
        etat.textContent = 'Écrivez d’abord quelques mots, ou ouvrez « Rédiger avec l’IA ».';
        return;
      }
      barre.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      etat.textContent = 'L’IA rédige…';
      try {
        const r = await SA.api(`${BASE}/redaction-ia`, {
          method: 'POST',
          body: JSON.stringify({
            nature, action,
            ton: barre.querySelector('[data-ia="ton"]').value,
            consigne: barre.querySelector('[data-ia="consigne"]').value,
            brouillon: zone.value,
            sujet: champSujet ? champSujet.value : '',
            avec_sujet: Boolean(champSujet),
            contexte: contexteDe(zone)
          })
        });
        sauvegarde = { texte: zone.value, champSujet, sujet: champSujet ? champSujet.value : '' };
        zone.value = r.message;
        if (champSujet && r.sujet && !champSujet.value.trim()) champSujet.value = r.sujet;
        zone.dispatchEvent(new Event('input', { bubbles: true }));
        zone.focus();
        annuler.hidden = false;
        panneau.hidden = true;
        etat.textContent = 'Proposition de l’IA : relisez avant d’envoyer.';
      } catch (err) {
        etat.textContent = err.message || 'Rédaction indisponible.';
      } finally {
        barre.querySelectorAll('button').forEach((x) => { x.disabled = false; });
      }
    }));
  }

  let scanPrevu = false;
  function scanner() {
    scanPrevu = false;
    document.querySelectorAll('#application textarea:not([data-ia-pret]), .sa-voile textarea:not([data-ia-pret])')
      .forEach(poserAssistant);
  }
  new MutationObserver(() => {
    if (scanPrevu) return;
    scanPrevu = true;
    requestAnimationFrame(scanner);
  }).observe(document.body, { childList: true, subtree: true });

  /* Exposé pour un écran qui crée sa zone hors du DOM observé. */
  SA.poserRedactionIA = poserAssistant;

  /* ======================================================================
     5. Démarrage — après ouverture de session
     ====================================================================== */

  const demarrerOriginal = SA.demarrer;
  SA.demarrer = async function () {
    const resultat = await demarrerOriginal.apply(this, arguments);
    relireCompteur();
    scanner();
    return resultat;
  };
  SA.communications = { relireCompteur };
})();
