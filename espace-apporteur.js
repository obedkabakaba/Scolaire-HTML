/* ==========================================================================
   Ardoise — Espace apporteur d'affaires (portail personnel)
   --------------------------------------------------------------------------
   Application monopage à routeur de fragment, sur le modèle de l'espace
   Super Admin et avec ses classes `sa-` — mais un noyau à part, volontairement
   minimal : ce portail n'a ni les droits, ni la session, ni les référentiels
   du Super Admin, et ne doit dépendre d'aucun de ses fichiers de script.

   SESSION : clé dédiée `ardoise_apporteur_jeton`. sessionStorage par défaut,
   localStorage seulement si « Rester connecté » est coché. Un 401 renvoie à
   l'écran de connexion et efface le jeton.
   ========================================================================== */

(function () {
  'use strict';

  const API = (window.API_BASE_URL || 'https://scolaire-saas-backend.onrender.com').replace(/\/+$/, '');
  const CLE = 'ardoise_apporteur_jeton';
  const CLE_PROFIL = 'ardoise_apporteur_profil';

  const BADGES = {
    apporteur_affaires: { libelle: "Apporteur d'affaires", icone: '🤝',
      texte: 'Présenter Ardoise aux écoles et contribuer à leur acquisition.' },
    configurateur: { libelle: 'Configurateur', icone: '🛠',
      texte: "Réaliser l'installation et la configuration du logiciel dans une école, après qualification." },
    formateur: { libelle: 'Formateur', icone: '🎓',
      texte: "Dispenser les formations d'utilisation d'Ardoise, après qualification." },
    partenaire_strategique: { libelle: 'Partenaire stratégique / institutionnel', icone: '🏛',
      texte: 'Porter des initiatives, campagnes ou partenariats à grande échelle.' }
  };
  const LIBELLES = {
    en_qualification: 'En qualification', actif: 'Actif', suspendu: 'Suspendu', retire: 'Retiré',
    proposee: 'En vérification', validee: 'Validée', rejetee: 'Non retenue', revoquee: 'Révoquée',
    gagnee: 'Gagnée', due: 'À verser', reglee: 'Versée', annulee: 'Annulée', a_valider: 'En vérification',
    en_attente: 'En attente', rattachee: 'Rattachée', clos: 'Clos',
    declaration_apporteur: 'Votre déclaration', code_inscription: 'Code saisi à l’inscription', saisie_admin: 'Justificatif'
  };
  const TONS = {
    actif: 'succes', validee: 'succes', reglee: 'succes', rattachee: 'succes',
    en_qualification: 'attention', proposee: 'attention', due: 'attention', a_valider: 'attention', en_attente: 'attention',
    gagnee: 'info', suspendu: 'danger', revoquee: 'danger'
  };

  /* ---------------------------------------------------------------- Outils */

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const badge = (texte, ton) => `<span class="sa-badge ton-${ton || 'neutre'}">${esc(texte)}</span>`;
  const statut = (s) => badge(LIBELLES[s] || String(s || '—').replace(/_/g, ' '), TONS[s] || 'neutre');
  const date = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  function argent(v, devise) {
    if (v === null || v === undefined || v === '') return '<span class="sa-muet">—</span>';
    const n = Number(v);
    const texte = n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `<span class="${n < 0 ? 'sa-negatif' : ''}">${esc(texte)} <span class="sa-devise">${esc(devise || '')}</span></span>`;
  }
  function totaux(obj, ordre) {
    const devises = Object.keys(obj || {});
    if (!devises.length) return '<span class="sa-muet ap-vide">Aucun montant pour le moment</span>';
    return devises.map((d) => ordre.filter((s) => obj[d][s] !== undefined)
      .map((s) => `<div>${statut(s)} ${argent(obj[d][s], d)}</div>`).join('')).join('');
  }
  function tableau(colonnes, lignes, vide) {
    if (!lignes || !lignes.length) {
      return `<div class="sa-conteneur-tableau"><div class="sa-etat-vide"><div class="sa-etat-vide-titre">${esc(vide)}</div></div></div>`;
    }
    return `<div class="sa-conteneur-tableau"><table class="sa-tableau">
      <thead><tr>${colonnes.map((c) => `<th class="${c.classe || ''}">${esc(c.titre)}</th>`).join('')}</tr></thead>
      <tbody>${lignes.map((l) => `<tr>${colonnes.map((c) => {
        const v = c.rendu(l);
        return `<td class="${c.classe || ''}">${v === '' || v === null || v === undefined ? '<span class="sa-muet">—</span>' : v}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  const carte = (valeur, etiquette, detail, ton) => `
    <div class="sa-carte-stat${ton ? ` ton-${ton}` : ''}">
      <div class="sa-carte-valeur">${valeur}</div>
      <div class="sa-carte-etiquette">${esc(etiquette)}</div>
      ${detail ? `<div class="sa-carte-detail">${detail}</div>` : ''}
    </div>`;
  function toast(message, type) {
    let zone = document.getElementById('sa-toasts');
    if (!zone) { zone = document.createElement('div'); zone.id = 'sa-toasts'; document.body.appendChild(zone); }
    const el = document.createElement('div');
    el.className = `sa-toast ton-${type || 'info'}`;
    el.innerHTML = `<span>${esc(message)}</span><button aria-label="Fermer">×</button>`;
    el.querySelector('button').addEventListener('click', () => el.remove());
    zone.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  /* --------------------------------------------------------------- Session */

  const session = {
    lire() {
      try { return sessionStorage.getItem(CLE) || localStorage.getItem(CLE); } catch (e) { return null; }
    },
    profil() {
      try { return JSON.parse(sessionStorage.getItem(CLE_PROFIL) || localStorage.getItem(CLE_PROFIL) || 'null'); } catch (e) { return null; }
    },
    enregistrer(jeton, profil, durable) {
      session.effacer();
      try {
        const stock = durable ? localStorage : sessionStorage;
        stock.setItem(CLE, jeton);
        stock.setItem(CLE_PROFIL, JSON.stringify(profil || {}));
      } catch (e) { /* navigation privée : la session vivra le temps de l'onglet */ }
    },
    effacer() {
      try { [sessionStorage, localStorage].forEach((s) => { s.removeItem(CLE); s.removeItem(CLE_PROFIL); }); } catch (e) { /* */ }
    }
  };

  async function api(chemin, options = {}) {
    const jeton = session.lire();
    let reponse;
    try {
      reponse = await fetch(API + chemin, {
        method: options.method || 'GET',
        headers: Object.assign({ Accept: 'application/json' },
          options.body ? { 'Content-Type': 'application/json' } : {},
          jeton && !options.public ? { Authorization: `Bearer ${jeton}` } : {}),
        body: options.body ? JSON.stringify(options.body) : undefined
      });
    } catch (e) {
      throw new Error('Serveur injoignable. Vérifiez votre connexion et réessayez.');
    }
    if (options.brut) {
      if (!reponse.ok) throw new Error('Téléchargement impossible.');
      return reponse;
    }
    const donnees = await reponse.json().catch(() => ({}));
    if (reponse.status === 401 && !options.public) {
      session.effacer();
      afficherConnexion(donnees.message || 'Votre session a expiré. Reconnectez-vous.');
      throw new Error(donnees.message || 'Session expirée.');
    }
    if (!reponse.ok) throw new Error(donnees.message || 'Opération impossible.');
    return donnees;
  }

  /* -------------------------------------------------------- Écran d'accès */

  const ecran = document.getElementById('ecran-connexion');
  const application = document.getElementById('application');
  const zoneErreur = document.getElementById('erreur-connexion');
  const zoneSucces = document.getElementById('succes-connexion');
  const formConnexion = document.getElementById('formulaire-connexion');
  const formLien = document.getElementById('formulaire-lien');
  const formAcces = document.getElementById('formulaire-acces');

  function messageAcces(texte, type) {
    zoneErreur.classList.remove('visible');
    zoneSucces.hidden = true;
    if (!texte) return;
    if (type === 'succes') { zoneSucces.textContent = texte; zoneSucces.hidden = false; }
    else { zoneErreur.textContent = texte; zoneErreur.classList.add('visible'); }
  }

  function montrerFormulaire(cible) {
    [formConnexion, formLien, formAcces].forEach((f) => { f.hidden = f !== cible; });
  }

  function afficherConnexion(message) {
    application.style.display = 'none';
    ecran.style.display = '';
    montrerFormulaire(formConnexion);
    document.getElementById('connexion-titre').textContent = 'Ardoise — Espace apporteur';
    messageAcces(message || '');
  }

  formConnexion.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bouton = document.getElementById('bouton-connexion');
    bouton.disabled = true; bouton.textContent = 'Connexion…';
    try {
      const r = await api('/apporteurs/portail/connexion', { method: 'POST', public: true, body: {
        email: document.getElementById('champ-email').value.trim(),
        mot_de_passe: document.getElementById('champ-mot-de-passe').value
      } });
      session.enregistrer(r.access_token, r.apporteur, document.getElementById('case-souvenir').checked);
      document.getElementById('champ-mot-de-passe').value = '';
      demarrer();
    } catch (err) {
      messageAcces(err.message);
    } finally {
      bouton.disabled = false; bouton.textContent = 'Se connecter';
    }
  });

  document.getElementById('lien-oubli').addEventListener('click', () => {
    montrerFormulaire(formLien); messageAcces('');
    document.getElementById('champ-email-lien').value = document.getElementById('champ-email').value;
  });
  document.getElementById('retour-connexion').addEventListener('click', () => { montrerFormulaire(formConnexion); messageAcces(''); });

  formLien.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bouton = document.getElementById('bouton-lien');
    bouton.disabled = true;
    try {
      const r = await api('/apporteurs/portail/lien-acces', { method: 'POST', public: true,
        body: { email: document.getElementById('champ-email-lien').value.trim() } });
      messageAcces(r.message, 'succes');
    } catch (err) { messageAcces(err.message); }
    finally { bouton.disabled = false; }
  });

  /* Lien d'accès reçu par e-mail : ?acces=… */
  const jetonAcces = new URLSearchParams(location.search).get('acces');
  if (jetonAcces) {
    history.replaceState(null, '', location.pathname + location.hash);
    montrerFormulaire(formAcces);
    document.getElementById('connexion-titre').textContent = 'Choisissez votre mot de passe';
    document.getElementById('connexion-intro').textContent =
      'Ce lien personnel ne sert qu’une fois. Votre mot de passe vous servira ensuite à vous connecter.';
    formAcces.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nouveau = document.getElementById('champ-nouveau').value;
      if (nouveau !== document.getElementById('champ-confirmation').value) {
        messageAcces('Les deux mots de passe ne correspondent pas.'); return;
      }
      const bouton = document.getElementById('bouton-acces');
      bouton.disabled = true;
      try {
        const r = await api('/apporteurs/portail/acces', { method: 'POST', public: true, body: { jeton: jetonAcces, mot_de_passe: nouveau } });
        session.enregistrer(r.access_token, r.apporteur, false);
        demarrer();
      } catch (err) { messageAcces(err.message); bouton.disabled = false; }
    });
  }

  document.getElementById('bouton-deconnexion').addEventListener('click', async () => {
    try { await api('/apporteurs/portail/deconnexion', { method: 'POST', body: {} }); } catch (e) { /* on sort quand même */ }
    session.effacer();
    location.replace(location.pathname);
  });

  /* --------------------------------------------------------------- Routeur */

  const vues = {};
  let moiCache = null;

  async function moi(forcer) {
    if (!moiCache || forcer) moiCache = await api('/apporteurs/portail/moi');
    return moiCache;
  }

  function entete(titre, sousTitre, actions) {
    document.getElementById('sa-entete').innerHTML = `
      <button class="sa-bouton-nav" aria-label="Ouvrir la navigation" data-nav>☰</button>
      <div><h1>${esc(titre)}</h1>${sousTitre ? `<p class="sa-sous-titre">${esc(sousTitre)}</p>` : ''}</div>
      <div class="sa-entete-actions" id="sa-entete-actions">${actions || ''}</div>`;
    document.querySelector('[data-nav]').addEventListener('click', (e) => {
      e.stopPropagation(); document.body.classList.toggle('sa-nav-ouverte');
    });
  }

  async function rendre() {
    const route = (location.hash || '#/tableau-de-bord').replace(/^#\/?/, '').split('?')[0] || 'tableau-de-bord';
    const vue = vues[route] || vues['tableau-de-bord'];
    document.querySelectorAll('.sa-menu a').forEach((a) => a.classList.toggle('actif', a.dataset.route === route));
    const contenu = document.getElementById('sa-contenu');
    contenu.innerHTML = '<div class="sa-squelettes"><div class="sa-squelette" style="height:96px"></div><div class="sa-squelette" style="height:220px"></div></div>';
    document.body.classList.remove('sa-nav-ouverte');
    try {
      await vue(contenu);
    } catch (err) {
      if (!session.lire()) return;
      contenu.innerHTML = `<div class="sa-etat-erreur"><div class="sa-etat-vide-titre">Impossible d'afficher cette section</div>
        <div class="sa-etat-vide-detail">${esc(err.message)}</div>
        <button class="sa-bouton sa-bouton-secondaire" data-recharger style="margin-top:14px">Réessayer</button></div>`;
      contenu.querySelector('[data-recharger]').addEventListener('click', rendre);
    }
  }

  /* ---------------------------------------------------------------- Vues */

  vues['tableau-de-bord'] = async (contenu) => {
    const [m, d] = await Promise.all([moi(true), api('/apporteurs/portail/tableau-de-bord')]);
    const p = m.profil;
    entete(`Bonjour ${p.prenom || p.nom}`, 'Vos résultats, à partir des seuls paiements réellement encaissés.');
    const actifs = m.badges.filter((b) => b.statut === 'actif');
    const n = (o, k) => (o || {})[k] || 0;
    contenu.innerHTML = `
      <section class="sa-section">
        <div class="sa-grille-stats">
          ${carte(n(d.attributions, 'validee'), 'Écoles attribuées', n(d.attributions, 'proposee') ? `${n(d.attributions, 'proposee')} en vérification` : '', 'succes')}
          ${carte(n(d.declarations, 'en_attente'), 'Prospects déclarés en attente', '', n(d.declarations, 'en_attente') ? 'attention' : null)}
          ${carte(actifs.length, actifs.length > 1 ? 'Badges actifs' : 'Badge actif', actifs.map((b) => esc((BADGES[b.badge] || {}).libelle || b.badge)).join(', '))}
          ${carte(m.codes.filter((c) => c.actif).length, 'Codes de référencement actifs', '', 'info')}
        </div>
      </section>
      <section class="sa-section sa-grille-2">
        <div class="sa-panneau">
          <h2 class="sa-section-titre">Commissions sur abonnements</h2>
          ${totaux(d.commissions, ['gagnee', 'due', 'reglee'])}
          <p class="sa-note">« Gagnée » : calculée sur un paiement d’abonnement confirmé, en cours de vérification. « À verser » : vérifiée. « Versée » : réglée.</p>
        </div>
        <div class="sa-panneau">
          <h2 class="sa-section-titre">Prestations</h2>
          ${totaux(d.prestations, ['a_valider', 'due', 'reglee'])}
          <h2 class="sa-section-titre" style="margin-top:16px">Déjà reçu</h2>
          ${(d.reglements || []).length ? d.reglements.map((r) => `<div>${argent(r.montant, r.devise)} <span class="sa-muet">— dernier versement le ${esc(date(r.dernier))}</span></div>`).join('') : '<span class="sa-muet ap-vide">Aucun versement pour le moment</span>'}
        </div>
      </section>
      ${actifs.length ? '' : `<div class="sa-encart">Aucun de vos badges n’est encore actif. L’équipe Ardoise vous contactera pour la qualification. En attendant, vous pouvez déjà déclarer les écoles que vous rencontrez.</div>`}`;
  };

  vues.codes = async (contenu) => {
    const m = await moi();
    entete('Mes codes et liens', 'À transmettre aux écoles : c’est ce qui permet de reconnaître que vous les avez apportées.');
    contenu.innerHTML = `
      <section class="sa-section">
        <div class="sa-encart">L’école saisit votre code dans le formulaire d’essai gratuit, ou ouvre directement votre lien : le code y est déjà rempli.
          Le rattachement est ensuite <strong>vérifié par l’équipe Ardoise</strong> avant de produire des commissions.</div>
        ${m.codes.map((c) => `
          <div class="sa-panneau" style="margin-bottom:12px">
            <div class="ap-code">
              <div>
                <span class="sa-mono ap-code-valeur">${esc(c.code)}</span> ${c.actif ? badge('Actif', 'succes') : badge('Désactivé', 'neutre')}
                <div class="sa-muet">${esc(c.partenariat_nom ? `Partenariat : ${c.partenariat_nom}` : (c.libelle || 'Code personnel'))}</div>
                <div class="sa-muet ap-lien">${esc(c.lien)}</div>
              </div>
              ${c.actif ? `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-copier="${esc(c.lien)}">Copier le lien</button>` : ''}
            </div>
          </div>`).join('') || '<div class="sa-etat-vide"><div class="sa-etat-vide-titre">Aucun code pour le moment</div></div>'}
      </section>
      ${m.partenariats.length ? `<section class="sa-section"><h2 class="sa-section-titre">Mes partenariats</h2>
        ${tableau([
          { titre: 'Initiative', rendu: (l) => `<strong>${esc(l.nom)}</strong><div class="sa-muet">${esc(l.perimetre || '')}</div>` },
          { titre: 'Période', rendu: (l) => `${esc(date(l.date_debut))}${l.date_fin ? ` → ${esc(date(l.date_fin))}` : ''}` },
          { titre: 'Statut', rendu: (l) => statut(l.statut) }
        ], m.partenariats, '')}</section>` : ''}`;
    contenu.querySelectorAll('[data-copier]').forEach((b) => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copier); toast('Lien copié.', 'succes'); }
      catch (e) { toast('Copie impossible : sélectionnez le lien à la main.', 'attention'); }
    }));
  };

  vues.ecoles = async (contenu) => {
    const d = await api('/apporteurs/portail/ecoles');
    entete('Mes écoles', 'Les écoles qui vous sont attribuées, et la période pendant laquelle leurs paiements vous rapportent.');
    contenu.innerHTML = `
      <section class="sa-section">
        ${tableau([
          { titre: 'École', rendu: (l) => `<strong>${esc(l.ecole_nom)}</strong><div class="sa-muet">${esc(l.ecole_ville || '')}</div>` },
          { titre: 'Origine', rendu: (l) => `${esc(LIBELLES[l.source] || l.source)}${l.partenariat_nom ? `<div class="sa-muet">${esc(l.partenariat_nom)}</div>` : ''}` },
          { titre: 'Commission', rendu: (l) => l.taux_commission !== null && l.taux_commission !== undefined
            ? `${Number(l.taux_commission).toLocaleString('fr-FR')} % des paiements encaissés` : '' },
          { titre: 'Période', rendu: (l) => l.date_debut ? `${esc(date(l.date_debut))} → ${esc(date(l.date_fin))}` : '' },
          { titre: 'Cumul', classe: 'sa-num', rendu: (l) => Number(l.commissions_total) ? argent(l.commissions_total, l.devise) : '' },
          { titre: 'Statut', rendu: (l) => `${statut(l.statut)}${['rejetee', 'revoquee'].includes(l.statut) && l.motif_decision ? `<div class="sa-muet">${esc(l.motif_decision)}</div>` : ''}` }
        ], d.donnees, 'Aucune école attribuée pour le moment')}
        <p class="sa-note">Seuls le nom et la ville des écoles sont affichés : leurs données internes restent confidentielles.</p>
      </section>`;
  };

  vues.releve = async (contenu) => {
    const d = await api('/apporteurs/portail/releve');
    entete('Commissions et relevé', 'Chaque montant, la façon dont il a été calculé, et son règlement.',
      '<button class="sa-bouton sa-bouton-secondaire" data-csv>Télécharger le relevé (CSV)</button>');
    document.querySelector('[data-csv]').addEventListener('click', async () => {
      try {
        const r = await api('/apporteurs/portail/releve?format=csv', { brut: true });
        const url = URL.createObjectURL(await r.blob());
        const a = document.createElement('a'); a.href = url; a.download = 'releve-apporteur-ardoise.csv';
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      } catch (e) { toast(e.message, 'danger'); }
    });
    contenu.innerHTML = `
      <section class="sa-section">
        <h2 class="sa-section-titre">Commissions sur abonnements</h2>
        ${tableau([
          { titre: 'Paiement du', rendu: (l) => esc(date(l.date_paiement)) },
          { titre: 'École', rendu: (l) => `${esc(l.ecole_nom)}${l.type === 'regularisation' ? ' ' + badge('Régularisation', 'danger') : ''}` },
          { titre: 'Calcul', classe: 'sa-num', rendu: (l) => `${Number(l.taux).toLocaleString('fr-FR')} % de ${argent(l.montant_base, l.devise)}` },
          { titre: 'Commission', classe: 'sa-num', rendu: (l) => `<strong>${argent(l.montant, l.devise)}</strong>` },
          { titre: 'Statut', rendu: (l) => `${statut(l.statut)}${l.reglement_reference ? `<div class="sa-mono">${esc(l.reglement_reference)}</div>` : ''}` }
        ], d.commissions, 'Aucune commission pour le moment')}
      </section>
      <section class="sa-section">
        <h2 class="sa-section-titre">Prestations</h2>
        ${tableau([
          { titre: 'Réalisée le', rendu: (l) => esc(date(l.date_realisation)) },
          { titre: 'Prestation', rendu: (l) => `${esc(l.libelle)}<div class="sa-muet">${esc(l.ecole_nom)}</div>` },
          { titre: 'Votre part', classe: 'sa-num', rendu: (l) => `${Number(l.part_pourcent).toLocaleString('fr-FR')} % de ${argent(l.remuneration_totale, l.devise)}` },
          { titre: 'Montant', classe: 'sa-num', rendu: (l) => `<strong>${argent(l.montant, l.devise)}</strong>` },
          { titre: 'Statut', rendu: (l) => statut(l.statut) }
        ], d.prestations, 'Aucune prestation enregistrée')}
      </section>
      <section class="sa-section">
        <h2 class="sa-section-titre">Règlements reçus</h2>
        ${tableau([
          { titre: 'Date', rendu: (l) => esc(date(l.date_reglement)) },
          { titre: 'Montant', classe: 'sa-num', rendu: (l) => `<strong>${argent(l.montant, l.devise)}</strong>` },
          { titre: 'Mode et référence', rendu: (l) => `${esc(l.methode)}<div class="sa-mono">${esc(l.reference)}</div>` }
        ], d.reglements, 'Aucun règlement pour le moment')}
      </section>`;
  };

  vues.declarations = async (contenu) => {
    const [d, m] = await Promise.all([api('/apporteurs/portail/declarations'), moi()]);
    entete('Déclarer un prospect', 'Signalez une école AVANT son inscription : votre déclaration date votre démarche.');
    const partenariats = m.partenariats.filter((p) => p.statut === 'actif');
    contenu.innerHTML = `
      <section class="sa-section sa-grille-2">
        <div class="sa-panneau">
          <h2 class="sa-section-titre">Nouvelle déclaration</h2>
          <form id="form-declaration">
            <label class="sa-champ-bloc"><span>Nom de l’établissement <em class="sa-requis">*</em></span>
              <input class="sa-champ" name="ecole_nom" required maxlength="200" /></label>
            <label class="sa-champ-bloc"><span>Ville <em class="sa-requis">*</em></span>
              <input class="sa-champ" name="ville" required maxlength="120" /></label>
            <label class="sa-champ-bloc"><span>Personne rencontrée</span>
              <input class="sa-champ" name="contact_nom" maxlength="160" placeholder="ex. le Préfet des études" /></label>
            <label class="sa-champ-bloc"><span>Téléphone de l’école (facultatif)</span>
              <input class="sa-champ" name="contact_telephone" maxlength="40" /></label>
            ${partenariats.length ? `<label class="sa-champ-bloc"><span>Dans le cadre du partenariat</span>
              <select class="sa-champ" name="partenariat_id"><option value="">Aucun</option>
                ${partenariats.map((p) => `<option value="${esc(p.id)}">${esc(p.nom)}</option>`).join('')}</select></label>` : ''}
            <label class="sa-champ-bloc"><span>Note</span>
              <textarea class="sa-champ" name="note" rows="3" maxlength="2000" placeholder="Date de la rencontre, ce qui a été présenté…"></textarea></label>
            <button class="sa-bouton sa-bouton-principal" type="submit">Enregistrer la déclaration</button>
          </form>
        </div>
        <div class="sa-panneau">
          <h2 class="sa-section-titre">Comment l’attribution est décidée</h2>
          <ul class="sa-texte">
            <li>Une école est attribuée sur une <strong>preuve datée</strong> : votre code saisi à son inscription, une déclaration préalable comme celle-ci, ou un justificatif écrit.</li>
            <li>Chaque attribution est <strong>vérifiée et validée</strong> par l’équipe Ardoise avant de produire des commissions.</li>
            <li>Si plusieurs apporteurs revendiquent la même école, la preuve vérifiable la plus ancienne est retenue.</li>
            <li>Une école déjà cliente avant votre démarche n’est en principe pas attribuable.</li>
          </ul>
        </div>
      </section>
      <section class="sa-section">
        <h2 class="sa-section-titre">Mes déclarations</h2>
        ${tableau([
          { titre: 'Déclarée le', rendu: (l) => esc(date(l.created_at)) },
          { titre: 'École', rendu: (l) => `<strong>${esc(l.ecole_nom)}</strong><div class="sa-muet">${esc(l.ville || '')}</div>` },
          { titre: 'Origine', rendu: (l) => esc(LIBELLES[l.source] || l.source) },
          { titre: 'Statut', rendu: (l) => `${statut(l.statut)}${l.statut === 'rejetee' && l.motif ? `<div class="sa-muet">${esc(l.motif)}</div>` : ''}` }
        ], d.donnees, 'Aucune déclaration')}
      </section>`;
    const form = document.getElementById('form-declaration');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bouton = form.querySelector('button[type=submit]');
      bouton.disabled = true;
      try {
        const corps = Object.fromEntries(new FormData(form).entries());
        const r = await api('/apporteurs/portail/declarations', { method: 'POST', body: corps });
        toast(r.message, 'succes');
        rendre();
      } catch (err) { toast(err.message, 'danger'); bouton.disabled = false; }
    });
  };

  vues.programme = async (contenu) => {
    const m = await moi();
    const parBadge = Object.fromEntries(m.badges.map((b) => [b.badge, b]));
    entete('Le programme', 'Quatre badges indépendants et cumulables, et les règles qui s’appliquent à chacun.');
    contenu.innerHTML = `
      <section class="sa-section">
        <div class="ap-grille-badges">
          ${Object.keys(BADGES).map((cle) => {
            const b = parBadge[cle];
            return `<div class="sa-panneau ap-badge">
              <div class="ap-badge-tete"><span class="ap-badge-icone">${BADGES[cle].icone}</span><strong>${esc(BADGES[cle].libelle)}</strong></div>
              <div>${b ? statut(b.statut) : badge('Non détenu', 'neutre')}</div>
              <div class="sa-muet">${esc(BADGES[cle].texte)}</div>
            </div>`;
          }).join('')}
        </div>
      </section>
      <section class="sa-section">
        <div class="sa-panneau sa-texte">
          <p><strong>Apport d’établissement.</strong> Une commission sur les paiements d’abonnement <em>effectivement encaissés</em> pour chaque école qui vous est attribuée, pendant la durée prévue par le programme — 20 % pendant deux ans, selon les conditions en vigueur au jour de la validation de l’attribution. Aucun revenu n’est garanti : la commission dépend des paiements réels des écoles.</p>
          <p><strong>Installation et configuration.</strong> Réservées aux configurateurs qualifiés. La personne qui réalise la configuration perçoit le montant de référence de la prestation ; à deux, il est partagé à parts égales.</p>
          <p><strong>Formation et capture.</strong> Rémunérées séparément, selon la prestation réellement réalisée, aux conditions convenues avec l’équipe Ardoise.</p>
          <p><strong>Prolongation.</strong> Une prolongation exceptionnelle peut être négociée lorsqu’un partenariat produit des résultats importants ; elle est décidée école par école et validée par une personne autorisée.</p>
          <p class="sa-muet">Une question sur un montant ? Écrivez à <a href="mailto:myardoise@gmail.com">myardoise@gmail.com</a> ou sur <a href="https://wa.me/243855035693" rel="noopener">WhatsApp</a> en citant la ligne de votre relevé.</p>
        </div>
      </section>`;
  };

  /* ------------------------------------------------------------- Démarrage */

  function demarrer() {
    const profil = session.profil() || {};
    ecran.style.display = 'none';
    application.style.display = '';
    document.getElementById('sa-identite').textContent = [profil.prenom, profil.nom].filter(Boolean).join(' ') || profil.email || '—';
    moiCache = null;
    rendre();
  }

  window.addEventListener('hashchange', () => { if (session.lire()) rendre(); });
  document.addEventListener('click', (e) => {
    if (document.body.classList.contains('sa-nav-ouverte') && !e.target.closest('.sa-navigation') && !e.target.closest('[data-nav]')) {
      document.body.classList.remove('sa-nav-ouverte');
    }
  });
  window.addEventListener('storage', (e) => {
    if (e.key === CLE && !e.newValue && !session.lire()) location.replace(location.pathname);
  });

  if (!jetonAcces && session.lire()) demarrer();
})();
