/* ==========================================================================
   Ardoise — Espace partenaire (portail des apporteurs d'affaires)
   --------------------------------------------------------------------------
   Application monopage à routeur de fragment (#/accueil, #/messages…).
   Autonome : aucun script de l'application des écoles ni de l'administration.

   SESSION : clé dédiée `ardoise_apporteur_jeton`. sessionStorage par défaut,
   localStorage seulement si « Rester connecté » est coché. Un 401 renvoie à
   l'écran d'accès et efface le jeton.

   L'ÉQUIPE EST UNE VOIX : dans la messagerie, toute réponse de l'équipe est
   signée « Équipe Ardoise ». Le portail ne reçoit ni ne montre jamais le nom,
   le rôle ou l'identifiant d'un compte d'administration.

   MONTANTS : tous viennent du serveur (encaissements réels), sauf ceux du
   simulateur du kit, présentés comme une estimation et jamais comme un dû.
   ========================================================================== */

(function () {
  'use strict';

  const API = (window.API_BASE_URL || 'https://scolaire-saas-backend.onrender.com').replace(/\/+$/, '');
  const CLE = 'ardoise_apporteur_jeton';
  const CLE_PROFIL = 'ardoise_apporteur_profil';
  const CLE_DRAPEAUX = 'ardoise.ap.drapeaux';
  const QR_SCRIPT = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  const TAUX_PROGRAMME = 20;
  const DUREE_PROGRAMME_MOIS = 24;
  const EQUIPE = 'Équipe Ardoise';
  const CONTACT_WHATSAPP = 'https://wa.me/243855035693';

  const BADGES = {
    apporteur_affaires: { libelle: "Apporteur d'affaires", icone: '🤝',
      texte: 'Présenter Ardoise aux écoles et contribuer à leur inscription. Actif dès la confirmation de votre adresse.' },
    configurateur: { libelle: 'Configurateur', icone: '🛠',
      texte: "Installer et configurer Ardoise dans une école (années, classes, cours, frais). Accordé après qualification." },
    formateur: { libelle: 'Formateur', icone: '🎓',
      texte: "Former les équipes des écoles à l'utilisation d'Ardoise. Accordé après qualification." },
    partenaire_strategique: { libelle: 'Partenaire stratégique', icone: '🏛',
      texte: 'Porter un réseau, une organisation ou une campagne à grande échelle, avec un partenariat dédié.' }
  };
  const ETAPES = [
    { cle: 'a_contacter', libelle: 'À contacter' },
    { cle: 'contacte', libelle: 'Contacté' },
    { cle: 'demonstration', libelle: 'Démo faite' },
    { cle: 'essai', libelle: 'En essai' },
    { cle: 'gagne', libelle: 'Inscrite' },
    { cle: 'perdu', libelle: 'Perdu' }
  ];
  const LIBELLES = {
    en_qualification: 'En qualification', actif: 'Actif', suspendu: 'Suspendu', retire: 'Retiré',
    proposee: 'En vérification', validee: 'Attribuée', rejetee: 'Non retenue', revoquee: 'Révoquée',
    gagnee: 'En vérification', due: 'À verser', reglee: 'Versée', annulee: 'Annulée', a_valider: 'En vérification',
    en_attente: 'Déclarée', rattachee: 'Rattachée', clos: 'Clos',
    declaration_apporteur: 'Votre déclaration', code_inscription: 'Code saisi à l’inscription', saisie_admin: 'Justificatif'
  };
  const TONS = {
    actif: 'succes', validee: 'succes', reglee: 'succes', rattachee: 'succes',
    en_qualification: 'attention', proposee: 'attention', due: 'attention', a_valider: 'attention',
    gagnee: 'info', en_attente: 'info', suspendu: 'danger', revoquee: 'danger', rejetee: 'danger'
  };
  const METHODES = { mobile_money: 'Mobile Money', virement: 'Virement bancaire', especes: 'Espèces', autre: 'Autre' };
  const JALONS = [
    { n: 1, titre: 'Première école' }, { n: 3, titre: 'Trois écoles' }, { n: 5, titre: 'Cinq écoles' },
    { n: 10, titre: 'Dix écoles' }, { n: 25, titre: 'Ambassadeur' }
  ];

  /* État partagé — déclaré avant tout code exécuté au chargement : les liens
     ?verification= et ?acces= affichent l'écran d'accès immédiatement. */
  let minuteries = [];
  function arreterMinuteries() { minuteries.forEach(clearInterval); minuteries = []; }

  /* ================================================================ Outils */

  const $ = (sel, racine) => (racine || document).querySelector(sel);
  const $$ = (sel, racine) => Array.from((racine || document).querySelectorAll(sel));
  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const icone = (nom) => `<svg aria-hidden="true"><use href="#i-${nom}"/></svg>`;
  const etiquette = (s, texte) => `<span class="etiquette ${TONS[s] || ''}">${esc(texte || LIBELLES[s] || String(s || '—').replace(/_/g, ' '))}</span>`;

  function dateLongue(v) {
    if (!v) return '—';
    const d = new Date(String(v).length === 10 ? `${v}T12:00:00` : v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function heure(v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  function relatif(v) {
    if (!v) return '';
    const d = new Date(v);
    const s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return 'à l’instant';
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400 && new Date().toDateString() === d.toDateString()) return heure(v);
    if (s < 7 * 86400) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  function jourSeparateur(v) {
    const d = new Date(v);
    const auj = new Date();
    const hier = new Date(Date.now() - 86400000);
    if (d.toDateString() === auj.toDateString()) return 'Aujourd’hui';
    if (d.toDateString() === hier.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function symbole(devise) {
    const d = String(devise || 'USD').toUpperCase();
    return d === 'USD' ? '$' : (d === 'CDF' || d === 'FC' ? 'FC' : d);
  }
  function argent(v, devise, brut) {
    const n = Number(v || 0);
    const texte = `${n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${symbole(devise)}`;
    return brut ? texte : `<span class="${n < 0 ? 'negatif' : ''}">${esc(texte)}</span>`;
  }
  /** { USD: 12, CDF: 0 } → « 12 $ » ; plusieurs devises jointes, jamais additionnées. */
  function montants(parDevise) {
    const l = Object.entries(parDevise || {}).filter(([, v]) => Math.abs(v) > 0.004);
    return l.length ? l.map(([d, v]) => argent(v, d, true)).join(' · ') : argent(0, 'USD', true);
  }
  function initiales(nom) {
    const p = String(nom || '?').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/);
    return ((p[0] || '?')[0] + ((p[1] || '')[0] || '')).toUpperCase();
  }
  function teinte(id) {
    const n = String(id || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    return ['', 'vert', 'bleu'][n % 3];
  }
  const avatar = (nom, id, classe) => `<span class="avatar ${classe || teinte(id)}" aria-hidden="true">${esc(initiales(nom))}</span>`;

  function toast(message, type) {
    const el = document.createElement('div');
    el.className = `toast ${type || ''}`;
    el.innerHTML = `<span>${esc(message)}</span><button type="button" aria-label="Fermer">${icone('fermer')}</button>`;
    el.querySelector('button').addEventListener('click', () => el.remove());
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }
  async function copier(texte, message) {
    try {
      await navigator.clipboard.writeText(texte);
    } catch (e) {
      const zone = document.createElement('textarea');
      zone.value = texte; document.body.appendChild(zone); zone.select();
      try { document.execCommand('copy'); } catch (err) { zone.remove(); toast('Copie impossible : sélectionnez le texte à la main.', 'danger'); return; }
      zone.remove();
    }
    toast(message || 'Copié.', 'succes');
  }
  function etatVide(nom, titre, texte, action) {
    return `<div class="vide"><div class="vide-icone">${icone(nom)}</div><h3>${esc(titre)}</h3>
      ${texte ? `<p>${texte}</p>` : ''}${action || ''}</div>`;
  }
  const drapeaux = {
    lire() { try { return JSON.parse(localStorage.getItem(CLE_DRAPEAUX) || '{}'); } catch (e) { return {}; } },
    poser(cle) { try { const d = drapeaux.lire(); d[cle] = true; localStorage.setItem(CLE_DRAPEAUX, JSON.stringify(d)); } catch (e) { /* */ } }
  };

  /** Fenêtre modale. `corps` est du HTML ; renvoie { racine, fermer }. */
  function modale({ titre, sousTitre, corps, large }) {
    const fond = document.createElement('div');
    fond.className = 'modale-fond';
    fond.innerHTML = `<div class="modale" role="dialog" aria-modal="true" aria-label="${esc(titre)}" ${large ? 'style="max-width:640px"' : ''}>
      <div class="modale-tete"><div style="flex:1"><h2>${esc(titre)}</h2>${sousTitre ? `<p>${sousTitre}</p>` : ''}</div>
        <button type="button" class="icone-bouton" data-fermer aria-label="Fermer">${icone('fermer')}</button></div>
      <div class="modale-corps">${corps}</div></div>`;
    const fermer = () => { fond.remove(); document.removeEventListener('keydown', echap); };
    const echap = (e) => { if (e.key === 'Escape') fermer(); };
    fond.addEventListener('click', (e) => { if (e.target === fond || e.target.closest('[data-fermer]')) fermer(); });
    document.addEventListener('keydown', echap);
    document.body.appendChild(fond);
    const premier = fond.querySelector('input:not([type=hidden]), select, textarea');
    if (premier) setTimeout(() => premier.focus(), 30);
    return { racine: fond, fermer };
  }
  function attente(bouton, actif, texte) {
    if (!bouton) return;
    if (actif) { bouton.dataset.texte = bouton.innerHTML; bouton.disabled = true; if (texte) bouton.textContent = texte; }
    else { bouton.disabled = false; if (bouton.dataset.texte) bouton.innerHTML = bouton.dataset.texte; }
  }

  /* =============================================================== Session */

  const session = {
    lire() { try { return sessionStorage.getItem(CLE) || localStorage.getItem(CLE); } catch (e) { return null; } },
    durable() { try { return Boolean(localStorage.getItem(CLE)); } catch (e) { return false; } },
    profil() {
      try { return JSON.parse(sessionStorage.getItem(CLE_PROFIL) || localStorage.getItem(CLE_PROFIL) || 'null'); } catch (e) { return null; }
    },
    enregistrer(jeton, profil, durable) {
      session.effacer();
      try {
        const stock = durable ? localStorage : sessionStorage;
        stock.setItem(CLE, jeton);
        stock.setItem(CLE_PROFIL, JSON.stringify(profil || {}));
      } catch (e) { /* navigation privée : la session vit le temps de l'onglet */ }
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
    if (reponse.status === 204) return {};
    const donnees = await reponse.json().catch(() => ({}));
    if (reponse.status === 401 && !options.public) {
      session.effacer();
      afficherAcces('connexion', donnees.message || 'Votre session a expiré. Reconnectez-vous.');
      const e = new Error(donnees.message || 'Session expirée.'); e.session = true; throw e;
    }
    if (!reponse.ok) {
      const e = new Error(donnees.message || 'Opération impossible.');
      e.code = donnees.code; e.status = reponse.status; throw e;
    }
    return donnees;
  }

  /* ========================================================= Écran d'accès */

  const ecranAcces = $('#ecran-acces');
  const application = $('#application');
  const blocs = {
    connexion: $('#form-connexion'), inscription: $('#form-inscription'), verifier: $('#bloc-verifier'),
    oubli: $('#form-oubli'), acces: $('#form-acces'), confirmation: $('#bloc-confirmation')
  };
  let emailEnAttente = '';

  function message(texte, type) {
    const err = $('#acces-erreur'); const ok = $('#acces-succes');
    err.hidden = true; ok.hidden = true;
    if (!texte) return;
    const zone = type === 'succes' ? ok : err;
    zone.textContent = texte; zone.hidden = false;
    return zone;
  }

  function montrer(nom) {
    Object.entries(blocs).forEach(([cle, el]) => { el.hidden = cle !== nom; });
    const onglets = $('#onglets-acces');
    onglets.hidden = !['connexion', 'inscription'].includes(nom);
    $$('button', onglets).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.onglet === nom)));
  }

  function afficherAcces(nom, texte, type) {
    application.hidden = true;
    ecranAcces.hidden = false;
    arreterMinuteries();
    montrer(nom || 'connexion');
    message(texte || '', type);
  }

  $$('#onglets-acces button').forEach((b) => b.addEventListener('click', () => { montrer(b.dataset.onglet); message(''); }));
  $$('[data-vers]').forEach((b) => b.addEventListener('click', () => {
    montrer(b.dataset.vers); message('');
    if (b.dataset.vers === 'oubli') blocs.oubli.email.value = blocs.connexion.email.value;
  }));

  blocs.connexion.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget; const bouton = f.querySelector('[type=submit]');
    if (!f.email.value.trim() || !f.mot_de_passe.value) { message('Adresse e-mail et mot de passe requis.'); return; }
    attente(bouton, true, 'Connexion…');
    try {
      const r = await api('/apporteurs/portail/connexion', { method: 'POST', public: true,
        body: { email: f.email.value.trim(), mot_de_passe: f.mot_de_passe.value } });
      session.enregistrer(r.access_token, r.apporteur, f.souvenir.checked);
      f.mot_de_passe.value = '';
      demarrer();
    } catch (err) {
      if (err.code === 'EMAIL_NON_VERIFIE') {
        emailEnAttente = f.email.value.trim();
        montrer('verifier');
        $('#verifier-texte').textContent = `Votre adresse ${emailEnAttente} n’est pas encore confirmée. Ouvrez le lien reçu par e-mail.`;
        message('');
      } else {
        message(err.message);
      }
    } finally { attente(bouton, false); }
  });

  blocs.inscription.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget; const bouton = f.querySelector('[type=submit]');
    const corps = Object.fromEntries(new FormData(f).entries());
    corps.profils_souhaites = $$('input[name="profils_souhaites"]:checked', f).map((c) => c.value);
    corps.consentement = f.consentement.checked;
    const manque = ['prenom', 'nom', 'email', 'telephone', 'ville', 'mot_de_passe'].find((k) => !String(corps[k] || '').trim());
    if (manque) { message('Tous les champs sont requis, sauf les rôles facultatifs.'); f[manque].focus(); return; }
    if (corps.mot_de_passe.length < 8) { message('Le mot de passe doit contenir au moins 8 caractères.'); f.mot_de_passe.focus(); return; }
    if (!corps.consentement) { message('Cochez la case d’accord pour continuer.'); return; }
    attente(bouton, true, 'Création…');
    try {
      const r = await api('/apporteurs/inscription', { method: 'POST', public: true, body: corps });
      emailEnAttente = r.email || corps.email;
      montrer('verifier');
      $('#verifier-texte').textContent = r.message;
      message('');
      f.reset();
    } catch (err) {
      const zone = message(err.message);
      if (err.code === 'COMPTE_EXISTANT' && zone) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'lien'; b.textContent = 'Se connecter';
        b.addEventListener('click', () => { montrer('connexion'); blocs.connexion.email.value = corps.email; message(''); });
        zone.appendChild(b);
      }
    } finally { attente(bouton, false); }
  });

  $('#bouton-renvoyer').addEventListener('click', async (e) => {
    const bouton = e.currentTarget;
    let email = emailEnAttente;
    if (!email) email = (window.prompt('Adresse e-mail de votre inscription :') || '').trim();
    if (!email) return;
    attente(bouton, true, 'Envoi…');
    try {
      const r = await api('/apporteurs/inscription/renvoyer', { method: 'POST', public: true, body: { email } });
      message(r.message, 'succes');
    } catch (err) { message(err.message); }
    finally { attente(bouton, false); }
  });

  blocs.oubli.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bouton = e.currentTarget.querySelector('[type=submit]');
    attente(bouton, true, 'Envoi…');
    try {
      const r = await api('/apporteurs/portail/lien-acces', { method: 'POST', public: true,
        body: { email: e.currentTarget.email.value.trim() } });
      message(r.message, 'succes');
    } catch (err) { message(err.message); }
    finally { attente(bouton, false); }
  });

  /* Liens reçus par e-mail : ?verification=… (inscription) ou ?acces=… (mot de passe). */
  const parametres = new URLSearchParams(location.search);
  const jetonVerification = parametres.get('verification');
  const jetonAcces = parametres.get('acces');
  if (jetonVerification || jetonAcces) history.replaceState(null, '', location.pathname + location.hash);

  if (jetonAcces) {
    afficherAcces('acces');
    blocs.acces.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget; const bouton = f.querySelector('[type=submit]');
      if (f.nouveau.value.length < 8) { message('Le mot de passe doit contenir au moins 8 caractères.'); return; }
      if (f.nouveau.value !== f.confirmation.value) { message('Les deux mots de passe ne correspondent pas.'); return; }
      attente(bouton, true, 'Enregistrement…');
      try {
        const r = await api('/apporteurs/portail/acces', { method: 'POST', public: true, body: { jeton: jetonAcces, mot_de_passe: f.nouveau.value } });
        session.enregistrer(r.access_token, r.apporteur, false);
        demarrer();
      } catch (err) { message(err.message); attente(bouton, false); }
    });
  } else if (jetonVerification) {
    afficherAcces('confirmation');
    api('/apporteurs/inscription/confirmer', { method: 'POST', public: true, body: { jeton: jetonVerification } })
      .then((r) => {
        session.enregistrer(r.access_token, r.apporteur, false);
        location.hash = '#/accueil?bienvenue=1';
        demarrer();
      })
      .catch((err) => {
        afficherAcces(err.code === 'LIEN_EXPIRE' ? 'verifier' : 'connexion', err.message);
      });
  }

  $('#bouton-deconnexion').addEventListener('click', async () => {
    try { await api('/apporteurs/portail/deconnexion', { method: 'POST', body: {} }); } catch (e) { /* on sort quand même */ }
    session.effacer();
    location.replace(location.pathname);
  });

  /* ============================================================== Apparence */

  function themeEffectif() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'clair' || t === 'sombre') return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair';
  }
  function etiqueterTheme() {
    const b = $('#bascule-theme');
    const sombre = themeEffectif() === 'sombre';
    b.innerHTML = `${icone(sombre ? 'soleil' : 'lune')}<span>${sombre ? 'Mode clair' : 'Mode sombre'}</span>`;
  }
  $('#bascule-theme').addEventListener('click', () => {
    const suivant = themeEffectif() === 'sombre' ? 'clair' : 'sombre';
    document.documentElement.setAttribute('data-theme', suivant);
    try { localStorage.setItem('ardoise.ap.theme', suivant); } catch (e) { /* */ }
    etiqueterTheme();
  });
  etiqueterTheme();

  /* ================================================================ Routeur */

  const vues = {};
  const cache = { moi: null };
  let routeCourante = '';

  async function moi(forcer) {
    if (!cache.moi || forcer) cache.moi = await api('/apporteurs/portail/moi');
    return cache.moi;
  }
  function codePrincipal(m) {
    const actifs = (m.codes || []).filter((c) => c.actif);
    return actifs.find((c) => !c.partenariat_id) || actifs[0] || null;
  }

  function entete(titre, sousTitre, actions) {
    $('#titre-page').textContent = titre;
    $('#sous-titre-page').textContent = sousTitre || '';
    $('#actions-page').innerHTML = actions || '';
    document.title = `${titre} — Espace partenaire Ardoise`;
  }

  function lireRoute() {
    const brut = (location.hash || '#/accueil').replace(/^#\/?/, '');
    const [nom, requete] = brut.split('?');
    return { nom: nom || 'accueil', params: Object.fromEntries(new URLSearchParams(requete || '')) };
  }

  async function rendre() {
    const { nom, params } = lireRoute();
    const vue = vues[nom] ? nom : 'accueil';
    routeCourante = vue;
    arreterMinuteries();
    demarrerSondageNonLus();
    $$('[data-route]').forEach((a) => a.classList.toggle('actif', a.dataset.route === vue));
    document.body.classList.remove('rail-ouvert');
    $('#voile').hidden = true;
    const contenu = $('#contenu');
    contenu.innerHTML = '<div class="grille"><div class="squelette" style="height:150px"></div><div class="grille g-3"><div class="squelette" style="height:110px"></div><div class="squelette" style="height:110px"></div><div class="squelette" style="height:110px"></div></div></div>';
    try {
      await vues[vue](contenu, params);
    } catch (err) {
      if (err.session || !session.lire() || routeCourante !== vue) return;
      contenu.innerHTML = etatVide('fermer', 'Impossible d’afficher cette section', esc(err.message),
        '<button class="bouton secondaire" data-recharger>Réessayer</button>');
      contenu.querySelector('[data-recharger]').addEventListener('click', rendre);
    }
  }

  window.addEventListener('hashchange', () => { if (session.lire() && !application.hidden) rendre(); });
  $('#ouvrir-rail').addEventListener('click', () => { document.body.classList.add('rail-ouvert'); $('#voile').hidden = false; });
  $('#voile').addEventListener('click', () => { document.body.classList.remove('rail-ouvert'); $('#voile').hidden = true; });

  /* ------------------------------------------------------- Non-lus (badge) */

  let sondageNonLus = null;
  function afficherNonLus(n) {
    $$('[data-non-lus]').forEach((p) => { p.hidden = !n; p.textContent = n > 99 ? '99+' : String(n); });
    const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
    document.title = n ? `(${n}) ${base}` : base;
  }
  async function rafraichirNonLus() {
    if (!session.lire() || document.hidden) return;
    try { afficherNonLus((await api('/apporteurs/portail/messagerie/non-lus')).non_lus || 0); } catch (e) { /* silencieux */ }
  }
  function demarrerSondageNonLus() {
    if (sondageNonLus) return;
    rafraichirNonLus();
    sondageNonLus = setInterval(rafraichirNonLus, 45000);
  }

  /* ================================================================== VUES */

  /* ---------------------------------------------------------------- Accueil */

  function totauxGains(d) {
    const enVerif = {}; const aVerser = {}; const recu = {};
    const ajouter = (cible, devise, v) => { cible[devise] = (cible[devise] || 0) + Number(v || 0); };
    Object.entries(d.commissions || {}).forEach(([dev, s]) => { ajouter(enVerif, dev, s.gagnee); ajouter(aVerser, dev, s.due); });
    Object.entries(d.prestations || {}).forEach(([dev, s]) => { ajouter(enVerif, dev, s.a_valider); ajouter(aVerser, dev, s.due); });
    (d.reglements || []).forEach((r) => ajouter(recu, r.devise, r.montant));
    const dernier = (d.reglements || []).map((r) => r.dernier).filter(Boolean).sort().pop();
    return { enVerif, aVerser, recu, dernier };
  }

  function lienPartage(texte) { return `https://wa.me/?text=${encodeURIComponent(texte)}`; }
  function messageCourt(lien) {
    return `Bonjour ! Je vous recommande Ardoise, la plateforme de gestion scolaire conçue pour les écoles de la RDC : élèves, notes, bulletins officiels, présences et frais, même avec une connexion instable. Essai gratuit ici : ${lien}`;
  }

  function graphiqueMois(series) {
    const mois = [];
    const d = new Date(); d.setDate(1);
    for (let i = 11; i >= 0; i--) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      mois.push({ cle: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`, libelle: x.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') });
    }
    const devises = [...new Set(series.map((s) => s.devise))];
    const devise = devises.includes('USD') ? 'USD' : (devises[0] || 'USD');
    const valeurs = mois.map((m) => series.filter((s) => s.mois === m.cle && s.devise === devise).reduce((t, s) => t + s.montant, 0));
    const max = Math.max(...valeurs, 0);
    return `<div class="graphique" role="img" aria-label="Commissions des douze derniers mois">
      ${mois.map((m, i) => `<div class="colonne">
        <div class="barre ${valeurs[i] ? '' : 'sans-valeur'}" style="height:${max ? Math.max(3, (valeurs[i] / max) * 100) : 3}%"
          ${valeurs[i] ? `data-valeur="${esc(argent(valeurs[i], devise, true))}"` : ''}></div>
        <small>${esc(m.libelle)}</small></div>`).join('')}
    </div>${devises.length > 1 ? `<p class="muet petit">Graphique en ${esc(symbole(devise))} ; les autres devises figurent dans vos gains.</p>` : ''}`;
  }

  function texteActivite(a) {
    switch (a.type) {
      case 'declaration': return { icone: 'prospects', texte: `Prospect déclaré : <strong>${esc(a.titre)}</strong>` };
      case 'attribution': return { icone: 'ecole', texte: a.statut === 'validee'
        ? `École attribuée : <strong>${esc(a.titre)}</strong>`
        : `Attribution ${esc((LIBELLES[a.statut] || a.statut).toLowerCase())} : <strong>${esc(a.titre)}</strong>` };
      case 'commission': return { icone: 'gains', texte: `Commission sur <strong>${esc(a.titre)}</strong>` };
      case 'reglement': return { icone: 'ok', texte: `Versement reçu <span class="mono muet">${esc(a.titre || '')}</span>` };
      default: return { icone: 'cloche', texte: esc(a.titre) };
    }
  }

  vues.accueil = async (contenu, params) => {
    const [m, d, p] = await Promise.all([moi(true), api('/apporteurs/portail/tableau-de-bord'), api('/apporteurs/portail/performance')]);
    const profil = m.profil;
    const code = codePrincipal(m);
    const g = totauxGains(d);
    const e = p.entonnoir;
    const actif = (m.badges || []).some((b) => b.badge === 'apporteur_affaires' && b.statut === 'actif');
    entete(`Bonjour ${profil.prenom || profil.nom}`, 'Votre activité partenaire en un coup d’œil.',
      code ? `<a class="bouton principal" href="#/kit">${icone('partage')} Partager mon lien</a>` : '');

    const fl = drapeaux.lire();
    const taches = [
      { fait: true, texte: 'Confirmer votre adresse e-mail', lien: '#/profil' },
      { fait: Boolean(profil.profession && profil.bio), texte: 'Compléter votre présentation', lien: '#/profil' },
      { fait: Boolean(profil.versement_methode), texte: 'Choisir comment recevoir vos gains', lien: '#/profil' },
      { fait: p.visites.total > 0 || fl.lien_partage, texte: 'Partager votre lien à une première école', lien: '#/kit' },
      { fait: e.prospects > 0, texte: 'Déclarer un premier prospect', lien: '#/prospects?nouveau=1' },
      { fait: Boolean(fl.presente), texte: 'Vous présenter à la communauté', lien: '#/messages?salon=communaute' }
    ];
    const faites = taches.filter((x) => x.fait).length;
    const maxEntonnoir = Math.max(e.visites_30j, e.prospects + e.essais_via_code, 1);
    const ecoles = e.ecoles_attribuees;

    contenu.innerHTML = `
      ${params.bienvenue ? `<div class="alerte succes" style="margin-bottom:18px">Bienvenue dans le programme ! Votre adresse est confirmée et votre espace est ouvert. Commencez par partager votre lien personnel.</div>` : ''}
      ${actif ? '' : '<div class="alerte info" style="margin-bottom:18px">Votre badge d’apporteur n’est pas actif pour le moment. Écrivez à l’équipe depuis la messagerie si vous pensez qu’il s’agit d’une erreur.</div>'}
      <section class="heros">
        <p class="heros-salut">${esc(profil.nom_public || '')}${code ? ` · code <span class="mono">${esc(code.code)}</span>` : ''}</p>
        <h2>Vos gains</h2>
        <div class="heros-chiffres">
          <div class="heros-chiffre"><span>En vérification</span><strong>${esc(montants(g.enVerif))}</strong><small>calculés sur des paiements reçus</small></div>
          <div class="heros-chiffre"><span>À verser</span><strong>${esc(montants(g.aVerser))}</strong><small>vérifiés, prochain versement</small></div>
          <div class="heros-chiffre"><span>Déjà reçu</span><strong>${esc(montants(g.recu))}</strong><small>${g.dernier ? `dernier le ${esc(dateLongue(g.dernier))}` : 'aucun versement encore'}</small></div>
        </div>
        ${code ? `<div class="heros-lien"><code>${esc(code.lien)}</code>
          <button type="button" class="bouton secondaire petit" data-copier-lien>${icone('copier')} Copier</button>
          <a class="bouton whatsapp petit" target="_blank" rel="noopener" href="${esc(lienPartage(messageCourt(code.lien)))}" data-partage>${icone('whatsapp')} WhatsApp</a></div>` : ''}
      </section>

      <section class="section grille g-4">
        <div class="carte stat"><div class="stat-tete"><span class="stat-icone bleu">${icone('oeil')}</span>Visites de votre lien</div>
          <div class="stat-valeur">${e.visites_30j}</div><div class="stat-detail">30 derniers jours · ${p.visites.total} au total</div></div>
        <div class="carte stat"><div class="stat-tete"><span class="stat-icone">${icone('prospects')}</span>Prospects suivis</div>
          <div class="stat-valeur">${e.prospects}</div><div class="stat-detail">${e.essais_via_code} essai(s) avec votre code</div></div>
        <div class="carte stat"><div class="stat-tete"><span class="stat-icone vert">${icone('ecole')}</span>Écoles attribuées</div>
          <div class="stat-valeur">${ecoles}</div><div class="stat-detail">${e.ecoles_en_verification ? `${e.ecoles_en_verification} en vérification` : 'validées par l’équipe'}</div></div>
        <div class="carte stat"><div class="stat-tete"><span class="stat-icone vert">${icone('gains')}</span>Écoles payantes</div>
          <div class="stat-valeur">${e.ecoles_payantes}</div><div class="stat-detail">ont déjà produit une commission</div></div>
      </section>

      <section class="section grille g-principal">
        <div class="pile">
          <div class="carte"><div class="carte-titre"><h3>Commissions, 12 derniers mois</h3><a href="#/gains" class="petit">Détail</a></div>
            ${graphiqueMois(p.commissions_par_mois || [])}</div>
          <div class="carte"><div class="carte-titre"><h3>Votre entonnoir</h3></div>
            <div class="entonnoir">
              ${[['Visites (30 j)', e.visites_30j], ['Prospects et essais', e.prospects + e.essais_via_code],
                 ['En vérification', e.ecoles_en_verification], ['Écoles attribuées', ecoles], ['Écoles payantes', e.ecoles_payantes]]
                .map(([l, v]) => `<div class="entonnoir-ligne"><span>${esc(l)}</span><div class="entonnoir-barre"><i style="width:${Math.min(100, (v / maxEntonnoir) * 100)}%"></i></div><strong>${v}</strong></div>`).join('')}
            </div></div>
          <div class="carte"><div class="carte-titre"><h3>Activité récente</h3></div>
            ${(d.activite || []).length ? `<ul class="activite">${d.activite.slice(0, 6).map((a) => {
              const t = texteActivite(a);
              return `<li><span class="pastille-type t-${esc(a.type)}">${icone(t.icone)}</span>
                <div><p>${t.texte}</p><small>${esc(dateLongue(a.le))} · ${etiquette(a.statut)}</small></div>
                <span class="montant">${a.montant !== null && a.montant !== undefined ? argent(a.montant, a.devise) : ''}</span></li>`;
            }).join('')}</ul>` : etatVide('cloche', 'Rien pour l’instant', 'Vos déclarations, attributions, commissions et versements apparaîtront ici.')}
          </div>
        </div>
        <div class="pile">
          ${faites < taches.length ? `<div class="carte"><div class="carte-titre"><h3>Bien démarrer</h3><span class="muet petit">${faites}/${taches.length}</span></div>
            <div class="progression"><i style="width:${(faites / taches.length) * 100}%"></i></div>
            <ul class="taches">${taches.map((x) => `<li class="${x.fait ? 'fait' : ''}"><a href="${x.lien}"><span class="coche">${x.fait ? icone('ok') : ''}</span><span>${esc(x.texte)}</span></a></li>`).join('')}</ul></div>` : ''}
          ${(p.rappels || []).length ? `<div class="carte"><div class="carte-titre"><h3>Relances à faire</h3><a href="#/prospects" class="petit">Prospects</a></div>
            <ul class="activite">${p.rappels.map((r) => `<li><span class="pastille-type">${icone('calendrier')}</span>
              <div><p><strong>${esc(r.ecole_nom)}</strong></p><small>${esc(r.ville || '')} · ${esc((ETAPES.find((x) => x.cle === r.etape) || {}).libelle || '')}</small></div>
              <span class="etiquette ${r.rappel_le < new Date().toISOString().slice(0, 10) ? 'danger' : 'attention'}">${esc(dateLongue(r.rappel_le))}</span></li>`).join('')}</ul></div>` : ''}
          <div class="carte"><div class="carte-titre"><h3>Vos jalons</h3><span class="muet petit">${ecoles} école(s)</span></div>
            <div class="jalons">${JALONS.map((j) => `<div class="jalon ${ecoles >= j.n ? 'atteint' : ''}" title="${esc(j.titre)}">${icone('trophee')}<strong>${j.n}</strong><small>${ecoles >= j.n ? 'atteint' : `encore ${j.n - ecoles}`}</small></div>`).join('')}</div></div>
          <div class="carte"><h3>Une question ?</h3><p>L’équipe Ardoise vous répond directement dans votre messagerie.</p>
            <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><a class="bouton secondaire petit" href="#/messages?equipe=1">${icone('messages')} Écrire à l’équipe</a>
            <a class="bouton discret petit" href="#/messages?salon=communaute">La communauté</a></div></div>
        </div>
      </section>`;

    const bouton = contenu.querySelector('[data-copier-lien]');
    if (bouton) bouton.addEventListener('click', () => { drapeaux.poser('lien_partage'); copier(code.lien, 'Lien copié. Collez-le dans WhatsApp, un SMS ou un e-mail.'); });
    const partage = contenu.querySelector('[data-partage]');
    if (partage) partage.addEventListener('click', () => drapeaux.poser('lien_partage'));
  };

  /* -------------------------------------------------------------- Prospects */

  function modaleProspect(m, rafraichir) {
    const partenariats = (m.partenariats || []).filter((p) => p.statut === 'actif');
    const { racine, fermer } = modale({
      titre: 'Nouveau prospect',
      sousTitre: 'Déclarez une école AVANT son inscription : la date de votre déclaration protège votre démarche.',
      corps: `<form novalidate>
        <label class="champ"><span>Nom de l’établissement</span><input name="ecole_nom" required maxlength="200" placeholder="ex. Complexe scolaire Les Bourgeons" /></label>
        <div class="duo">
          <label class="champ"><span>Ville</span><input name="ville" required maxlength="120" /></label>
          <label class="champ"><span>Où en êtes-vous ?</span><select name="etape">
            ${ETAPES.slice(0, 4).map((x) => `<option value="${x.cle}">${esc(x.libelle)}</option>`).join('')}</select></label>
        </div>
        <div class="duo">
          <label class="champ"><span>Personne rencontrée <em>(facultatif)</em></span><input name="contact_nom" maxlength="160" placeholder="ex. le Préfet des études" /></label>
          <label class="champ"><span>Téléphone <em>(facultatif)</em></span><input name="contact_telephone" maxlength="40" /></label>
        </div>
        <label class="champ"><span>Me rappeler de relancer le <em>(facultatif)</em></span><input type="date" name="rappel_le" /></label>
        ${partenariats.length ? `<label class="champ"><span>Dans le cadre du partenariat</span><select name="partenariat_id"><option value="">Aucun</option>
          ${partenariats.map((p) => `<option value="${esc(p.id)}">${esc(p.nom)}</option>`).join('')}</select></label>` : ''}
        <label class="champ"><span>Note <em>(facultatif)</em></span><textarea name="note" maxlength="2000" placeholder="Date de la rencontre, ce qui a été présenté…"></textarea></label>
        <div class="modale-pied"><button type="button" class="bouton discret" data-fermer>Annuler</button>
          <button type="submit" class="bouton principal">Enregistrer</button></div>
      </form>`
    });
    racine.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget; const bouton = f.querySelector('[type=submit]');
      const corps = Object.fromEntries(new FormData(f).entries());
      if (String(corps.ecole_nom).trim().length < 3) { toast("Le nom de l'établissement est requis.", 'danger'); return; }
      if (String(corps.ville).trim().length < 2) { toast('La ville est requise.', 'danger'); return; }
      attente(bouton, true, 'Enregistrement…');
      try {
        const r = await api('/apporteurs/portail/declarations', { method: 'POST', body: corps });
        toast(r.message, 'succes'); fermer(); rafraichir();
      } catch (err) { toast(err.message, 'danger'); attente(bouton, false); }
    });
  }

  function modaleSuivi(prospect, rafraichir) {
    const { racine, fermer } = modale({
      titre: prospect.ecole_nom,
      sousTitre: `${esc(prospect.ville || '')} · déclaré le ${esc(dateLongue(prospect.created_at))} · ${etiquette(prospect.statut)}`,
      corps: `<form novalidate>
        ${prospect.contact_nom || prospect.contact_telephone ? `<p class="muet petit" style="margin:0 0 14px">Contact : ${esc([prospect.contact_nom, prospect.contact_telephone].filter(Boolean).join(' · '))}</p>` : ''}
        ${prospect.note ? `<div class="alerte info">${esc(prospect.note)}</div>` : ''}
        <div class="duo">
          <label class="champ"><span>Étape</span><select name="etape">${ETAPES.map((x) => `<option value="${x.cle}" ${x.cle === prospect.etape ? 'selected' : ''}>${esc(x.libelle)}</option>`).join('')}</select></label>
          <label class="champ"><span>Relance le</span><input type="date" name="rappel_le" value="${esc(prospect.rappel_le || '')}" /></label>
        </div>
        <label class="champ"><span>Notes de suivi</span><textarea name="suivi_note" maxlength="2000" placeholder="Prochaine étape, objections, décideur…">${esc(prospect.suivi_note || '')}</textarea></label>
        ${prospect.statut === 'rejetee' && prospect.motif ? `<div class="alerte erreur">Décision de l’équipe : ${esc(prospect.motif)}</div>` : ''}
        <p class="muet petit">Le nom de l’école et la date de déclaration ne se modifient pas : ils constituent votre preuve d’antériorité.</p>
        <div class="modale-pied"><button type="button" class="bouton discret" data-fermer>Fermer</button>
          <button type="submit" class="bouton principal">Enregistrer</button></div>
      </form>`
    });
    racine.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget; const bouton = f.querySelector('[type=submit]');
      attente(bouton, true, 'Enregistrement…');
      try {
        await api(`/apporteurs/portail/declarations/${prospect.id}`, { method: 'PATCH',
          body: { etape: f.etape.value, rappel_le: f.rappel_le.value || null, suivi_note: f.suivi_note.value } });
        toast('Suivi enregistré.', 'succes'); fermer(); rafraichir();
      } catch (err) { toast(err.message, 'danger'); attente(bouton, false); }
    });
  }

  vues.prospects = async (contenu, params) => {
    const [d, m] = await Promise.all([api('/apporteurs/portail/declarations'), moi()]);
    entete('Prospects', 'Suivez chaque école, de la première rencontre à l’inscription.',
      `<button type="button" class="bouton principal" data-nouveau>${icone('plus')} Nouveau prospect</button>`);
    const tous = d.donnees || [];
    const suivis = tous.filter((x) => x.source === 'declaration_apporteur');
    const viaCode = tous.filter((x) => x.source !== 'declaration_apporteur');
    const aujourdhui = new Date().toISOString().slice(0, 10);
    let filtre = '';

    const carteProspect = (x) => `<button type="button" class="carte-prospect" draggable="true" data-id="${esc(x.id)}">
      <strong>${esc(x.ecole_nom)}</strong><span class="muet petit">${esc(x.ville || '')}${x.contact_nom ? ` · ${esc(x.contact_nom)}` : ''}</span>
      <div class="meta">${etiquette(x.statut)}
        ${x.rappel_le ? `<span class="rappel ${x.rappel_le < aujourdhui && !['gagne', 'perdu'].includes(x.etape) ? 'en-retard' : ''}">${icone('calendrier')} ${esc(dateLongue(x.rappel_le))}</span>` : ''}</div>
    </button>`;

    function dessiner() {
      const q = filtre.toLowerCase();
      const visibles = suivis.filter((x) => !q || `${x.ecole_nom} ${x.ville} ${x.contact_nom || ''}`.toLowerCase().includes(q));
      $('#kanban', contenu).innerHTML = ETAPES.map((et) => {
        const liste = visibles.filter((x) => (x.etape || 'a_contacter') === et.cle);
        return `<section class="colonne-kanban" data-etape="${et.cle}">
          <header><h3><i></i>${esc(et.libelle)}</h3><span class="compte">${liste.length}</span></header>
          ${liste.map(carteProspect).join('') || '<div class="vide-colonne">Glissez une carte ici</div>'}
        </section>`;
      }).join('');
      brancherKanban();
    }

    function brancherKanban() {
      $$('.carte-prospect', contenu).forEach((c) => {
        c.addEventListener('click', () => modaleSuivi(suivis.find((x) => x.id === c.dataset.id), () => rendre()));
        c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('glisse'); });
        c.addEventListener('dragend', () => c.classList.remove('glisse'));
      });
      $$('.colonne-kanban', contenu).forEach((col) => {
        col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('survol'); });
        col.addEventListener('dragleave', () => col.classList.remove('survol'));
        col.addEventListener('drop', async (e) => {
          e.preventDefault(); col.classList.remove('survol');
          const id = e.dataTransfer.getData('text/plain');
          const x = suivis.find((p) => p.id === id);
          if (!x || x.etape === col.dataset.etape) return;
          const avant = x.etape;
          x.etape = col.dataset.etape; dessiner();
          try {
            await api(`/apporteurs/portail/declarations/${id}`, { method: 'PATCH', body: { etape: x.etape } });
            if (x.etape === 'gagne') toast('Bravo ! Pensez à vérifier que l’école a bien saisi votre code à son inscription.', 'succes');
          } catch (err) { x.etape = avant; dessiner(); toast(err.message, 'danger'); }
        });
      });
    }

    contenu.innerHTML = suivis.length || viaCode.length ? `
      <div class="alerte info">Déclarer une école <strong>avant</strong> son inscription date votre démarche. L’équipe vérifie ensuite chaque rattachement avant qu’il ne produise une commission.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
        <label class="sr-only" for="filtre-prospects">Rechercher</label>
        <input id="filtre-prospects" class="saisie" style="max-width:320px" placeholder="Rechercher une école, une ville…" />
        <button type="button" class="bouton principal seulement-mobile" data-nouveau>${icone('plus')} Nouveau</button>
      </div>
      <div class="tableau-kanban" id="kanban"></div>
      ${viaCode.length ? `<section class="section"><div class="section-titre"><h2>Écoles venues par votre code</h2></div>
        <div class="tableau-conteneur"><table class="tableau tableau-mobile"><thead><tr><th>École</th><th>Origine</th><th>Date</th><th>Statut</th></tr></thead><tbody>
        ${viaCode.map((x) => `<tr><td><strong>${esc(x.ecole_nom)}</strong><div class="muet petit">${esc(x.ville || '')}</div></td>
          <td>${esc(LIBELLES[x.source] || x.source)}</td><td>${esc(dateLongue(x.created_at))}</td><td>${etiquette(x.statut)}</td></tr>`).join('')}
        </tbody></table></div></section>` : ''}`
      : etatVide('prospects', 'Aucun prospect pour l’instant',
        'Notez ici chaque école que vous rencontrez : vous suivez votre avancement, et la date de déclaration protège votre démarche.',
        `<button type="button" class="bouton principal" data-nouveau>${icone('plus')} Déclarer une école</button>`);

    if (suivis.length || viaCode.length) {
      dessiner();
      $('#filtre-prospects', contenu).addEventListener('input', (e) => { filtre = e.target.value; dessiner(); });
    }
    $$('[data-nouveau]').forEach((b) => b.addEventListener('click', () => modaleProspect(m, () => rendre())));
    if (params.nouveau) { history.replaceState(null, '', '#/prospects'); modaleProspect(m, () => rendre()); }
  };

  /* ----------------------------------------------------------------- Écoles */

  vues.ecoles = async (contenu) => {
    const d = await api('/apporteurs/portail/ecoles');
    entete('Mes écoles', 'Les écoles qui vous sont attribuées et la période pendant laquelle leurs paiements vous rapportent.');
    const liste = d.donnees || [];
    if (!liste.length) {
      contenu.innerHTML = etatVide('ecole', 'Aucune école attribuée pour le moment',
        'Une école vous est attribuée lorsqu’elle s’inscrit avec votre code, ou après vérification d’une déclaration faite avant son inscription.',
        `<a class="bouton principal" href="#/kit">${icone('partage')} Partager mon lien</a>`);
      return;
    }
    const pct = (a) => {
      if (!a.date_debut || !a.date_fin) return 0;
      const debut = new Date(a.date_debut).getTime(); const fin = new Date(a.date_fin).getTime();
      return Math.max(0, Math.min(100, ((Date.now() - debut) / (fin - debut)) * 100));
    };
    contenu.innerHTML = `<div class="grille g-2">${liste.map((a) => `
      <article class="carte carte-ecole">
        <div class="carte-ecole-tete"><div><h3>${esc(a.ecole_nom)}</h3><span class="muet petit">${esc(a.ecole_ville || '')} · ${esc(LIBELLES[a.source] || a.source)}${a.partenariat_nom ? ` · ${esc(a.partenariat_nom)}` : ''}</span></div>
          ${etiquette(a.statut)}</div>
        ${a.statut === 'validee' || a.statut === 'revoquee' ? `<div class="fenetre">
          <div class="fenetre-barre"><i style="width:${pct(a)}%"></i></div>
          <div class="fenetre-legende"><span>${esc(dateLongue(a.date_debut))}</span><span>${esc(dateLongue(a.revoquee_le || a.date_fin))}</span></div></div>` : ''}
        <div class="carte-ecole-chiffres">
          <div>Commission<strong>${a.taux_commission !== null && a.taux_commission !== undefined ? `${Number(a.taux_commission).toLocaleString('fr-FR')} %` : '—'}</strong></div>
          <div>Cumul<strong>${Number(a.commissions_total) ? esc(argent(a.commissions_total, a.devise, true)) : '—'}</strong></div>
          <div>Preuve du<strong>${esc(dateLongue(a.date_preuve))}</strong></div>
        </div>
        ${['rejetee', 'revoquee'].includes(a.statut) && a.motif_decision ? `<div class="alerte erreur" style="margin:0">${esc(a.motif_decision)}</div>` : ''}
        ${a.statut === 'proposee' ? '<p class="muet petit" style="margin:0">L’équipe vérifie ce rattachement. Il produira des commissions une fois validé.</p>' : ''}
      </article>`).join('')}</div>
      <p class="muet petit" style="margin-top:16px">Seuls le nom et la ville des écoles sont affichés : leurs données internes restent confidentielles.</p>`;
  };

  /* ------------------------------------------------------------------ Gains */

  vues.gains = async (contenu, params) => {
    const [r, d, m] = await Promise.all([api('/apporteurs/portail/releve'), api('/apporteurs/portail/tableau-de-bord'), moi()]);
    const g = totauxGains(d);
    const profil = m.profil;
    entete('Gains', 'Chaque montant, la façon dont il a été calculé, et son versement.',
      `<button type="button" class="bouton secondaire" data-csv>${icone('telecharger')} Relevé CSV</button>`);
    const onglet = ['commissions', 'prestations', 'versements'].includes(params.onglet) ? params.onglet : 'commissions';

    const tableaux = {
      commissions: () => (r.commissions || []).length ? `<div class="tableau-conteneur"><table class="tableau tableau-mobile">
        <thead><tr><th>Paiement du</th><th>École</th><th>Calcul</th><th class="num">Commission</th><th>Statut</th></tr></thead><tbody>
        ${r.commissions.map((l) => `<tr><td>${esc(dateLongue(l.date_paiement))}</td>
          <td><strong>${esc(l.ecole_nom)}</strong>${l.type === 'regularisation' ? ' <span class="etiquette danger">Régularisation</span>' : ''}</td>
          <td class="muet">${Number(l.taux).toLocaleString('fr-FR')} % de ${argent(l.montant_base, l.devise)}</td>
          <td class="num"><strong>${argent(l.montant, l.devise)}</strong></td>
          <td>${etiquette(l.statut)}${l.reglement_reference ? `<div class="mono muet petit">${esc(l.reglement_reference)}</div>` : ''}</td></tr>`).join('')}
        </tbody></table></div>` : etatVide('gains', 'Aucune commission pour le moment', 'Chaque paiement d’abonnement encaissé pour une de vos écoles attribuées apparaîtra ici, avec son calcul.'),
      prestations: () => (r.prestations || []).length ? `<div class="tableau-conteneur"><table class="tableau tableau-mobile">
        <thead><tr><th>Réalisée le</th><th>Prestation</th><th>Votre part</th><th class="num">Montant</th><th>Statut</th></tr></thead><tbody>
        ${r.prestations.map((l) => `<tr><td>${esc(dateLongue(l.date_realisation))}</td>
          <td><strong>${esc(l.libelle)}</strong><div class="muet petit">${esc(l.ecole_nom)}</div></td>
          <td class="muet">${Number(l.part_pourcent).toLocaleString('fr-FR')} % de ${argent(l.remuneration_totale, l.devise)}</td>
          <td class="num"><strong>${argent(l.montant, l.devise)}</strong></td><td>${etiquette(l.statut)}</td></tr>`).join('')}
        </tbody></table></div>` : etatVide('ecole', 'Aucune prestation enregistrée', 'Installations, formations et campagnes de capture réalisées avec un badge actif apparaîtront ici.'),
      versements: () => (r.reglements || []).length ? `<div class="tableau-conteneur"><table class="tableau tableau-mobile">
        <thead><tr><th>Date</th><th>Mode et référence</th><th class="num">Montant</th></tr></thead><tbody>
        ${r.reglements.map((l) => `<tr><td>${esc(dateLongue(l.date_reglement))}</td>
          <td>${esc(l.methode)}<div class="mono muet petit">${esc(l.reference)}</div></td>
          <td class="num"><strong>${argent(l.montant, l.devise)}</strong></td></tr>`).join('')}
        </tbody></table></div>` : etatVide('ok', 'Aucun versement pour le moment', 'Vos versements apparaîtront ici avec leur référence.')
    };

    contenu.innerHTML = `
      <section class="grille g-3">
        <div class="carte stat"><div class="stat-tete"><span class="stat-icone bleu">${icone('cible')}</span>En vérification</div>
          <div class="stat-valeur">${esc(montants(g.enVerif))}</div><div class="stat-detail">calculé sur un paiement réellement reçu, en cours de contrôle</div></div>
        <div class="carte stat"><div class="stat-tete"><span class="stat-icone">${icone('gains')}</span>À verser</div>
          <div class="stat-valeur">${esc(montants(g.aVerser))}</div><div class="stat-detail">vérifié, inclus dans votre prochain versement</div></div>
        <div class="carte stat"><div class="stat-tete"><span class="stat-icone vert">${icone('ok')}</span>Déjà reçu</div>
          <div class="stat-valeur">${esc(montants(g.recu))}</div><div class="stat-detail">${g.dernier ? `dernier versement le ${esc(dateLongue(g.dernier))}` : 'aucun versement encore'}</div></div>
      </section>
      <section class="section">
        ${profil.versement_methode
          ? `<div class="carte" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span class="stat-icone vert">${icone('gains')}</span>
              <div style="flex:1;min-width:200px"><strong>Vos versements : ${esc(METHODES[profil.versement_methode] || profil.versement_methode)}</strong>
              <div class="muet petit">${esc([profil.versement_titulaire, profil.versement_details].filter(Boolean).join(' · '))}</div></div>
              <a class="bouton discret petit" href="#/profil">Modifier</a></div>`
          : `<div class="alerte info" style="margin:0">Indiquez comment recevoir vos gains (Mobile Money, virement…) : <a href="#/profil">compléter mes préférences de versement</a>.</div>`}
      </section>
      <section class="section">
        <div class="onglets" role="tablist">
          ${[['commissions', 'Commissions'], ['prestations', 'Prestations'], ['versements', 'Versements']].map(([k, l]) =>
            `<button type="button" role="tab" data-onglet="${k}" aria-selected="${k === onglet}">${l}</button>`).join('')}
        </div>
        <div id="zone-onglet">${tableaux[onglet]()}</div>
      </section>
      <p class="muet petit">« En vérification » : calculé sur un paiement d’abonnement confirmé. « À verser » : vérifié. « Versée » : réglée, avec sa référence. Une question sur une ligne ? <a href="#/messages?equipe=1">Écrivez à l’équipe</a> en la citant.</p>`;

    $$('[data-onglet]', contenu).forEach((b) => b.addEventListener('click', () => {
      $$('[data-onglet]', contenu).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      $('#zone-onglet', contenu).innerHTML = tableaux[b.dataset.onglet]();
      history.replaceState(null, '', `#/gains?onglet=${b.dataset.onglet}`);
    }));
    $('[data-csv]').addEventListener('click', async () => {
      try {
        const rep = await api('/apporteurs/portail/releve?format=csv', { brut: true });
        const url = URL.createObjectURL(await rep.blob());
        const a = document.createElement('a'); a.href = url; a.download = 'releve-partenaire-ardoise.csv';
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      } catch (e) { toast(e.message, 'danger'); }
    });
  };

  /* ------------------------------------------------------------ Kit de partage */

  let promesseQr = null;
  function chargerQr() {
    if (window.QRCode) return Promise.resolve(window.QRCode);
    if (!promesseQr) {
      promesseQr = new Promise((resoudre, rejeter) => {
        const s = document.createElement('script');
        s.src = QR_SCRIPT; s.async = true; s.crossOrigin = 'anonymous';
        s.onload = () => resoudre(window.QRCode);
        s.onerror = () => { promesseQr = null; rejeter(new Error('QR indisponible')); };
        document.head.appendChild(s);
      });
    }
    return promesseQr;
  }

  function modelesMessages(lien, code, prixMin) {
    const prix = prixMin ? ` Les offres commencent à ${prixMin} par mois, avec un essai gratuit.` : ' Un essai gratuit permet de tout tester.';
    return [
      { titre: 'WhatsApp — court', texte: `Bonjour 👋 Je vous recommande Ardoise, la plateforme de gestion scolaire pensée pour les écoles de la RDC : notes, bulletins officiels, présences et frais, même avec une connexion instable.${prix}\n\nEssayez ici : ${lien}` },
      { titre: 'Message au chef d’établissement', texte: `Monsieur le Préfet / Madame la Directrice,\n\nJe me permets de vous présenter Ardoise, un logiciel de gestion scolaire conçu pour les écoles de la RDC. Il produit les bulletins officiels (primaire, secondaire, terminale) à partir des cotes saisies une seule fois, suit les présences et les frais scolaires (FC et USD) et fonctionne même quand la connexion est instable.${prix}\n\nVous pouvez créer l’espace de votre école ici : ${lien}\nSi vous le souhaitez, je passe vous en faire la démonstration.\n\nBien cordialement` },
      { titre: 'E-mail', texte: `Objet : Ardoise — gestion scolaire et bulletins officiels\n\nBonjour,\n\nArdoise aide les écoles de la RDC à tenir les élèves, les notes, les bulletins officiels, les présences et les frais scolaires dans un seul outil, accessible sur ordinateur et téléphone.${prix}\n\nLien d’inscription (code partenaire ${code} déjà rempli) : ${lien}\n\nJe reste disponible pour une démonstration.\n\nCordialement` }
    ];
  }

  vues.kit = async (contenu) => {
    const [m, catalogue] = await Promise.all([moi(), api('/catalogue/offres', { public: true }).catch(() => null)]);
    const codes = (m.codes || []).filter((c) => c.actif);
    entete('Kit de partage', 'Votre lien, vos messages prêts à envoyer, les prix à jour et un simulateur.');
    if (!codes.length) {
      contenu.innerHTML = etatVide('partage', 'Aucun code actif', 'Votre code personnel apparaît ici dès que votre badge d’apporteur est actif. Écrivez à l’équipe si besoin.',
        '<a class="bouton principal" href="#/messages?equipe=1">Écrire à l’équipe</a>');
      return;
    }
    const offres = ((catalogue && catalogue.offres) || []).filter((o) => o.tarifs && o.tarifs.mensuel);
    const prixMin = offres.length ? (() => {
      const o = offres.reduce((a, b) => (b.tarifs.mensuel.total < a.tarifs.mensuel.total ? b : a));
      return argent(o.tarifs.mensuel.total, o.devise, true);
    })() : null;
    let code = codePrincipal(m);

    contenu.innerHTML = `
      <section class="grille g-principal">
        <div class="carte lien-geant">
          <div class="carte-titre"><h3>Votre lien personnel</h3>
            ${codes.length > 1 ? `<select class="saisie" style="max-width:240px" id="choix-code">${codes.map((c) => `<option value="${esc(c.code)}" ${c.code === code.code ? 'selected' : ''}>${esc(c.partenariat_nom || c.libelle || 'Code personnel')} — ${esc(c.code)}</option>`).join('')}</select>` : ''}</div>
          <div><span class="muet petit">Votre code</span><div class="code-geant" id="code-geant"></div></div>
          <div class="lien-champ"><code id="lien-texte"></code>
            <button type="button" class="bouton principal" data-copier="lien">${icone('copier')} Copier le lien</button></div>
          <div class="partages">
            <a class="bouton whatsapp" target="_blank" rel="noopener" id="partage-wa">${icone('whatsapp')} WhatsApp</a>
            <a class="bouton secondaire" id="partage-sms">${icone('sms')} SMS</a>
            <a class="bouton secondaire" id="partage-mail">${icone('courriel')} E-mail</a>
            <button type="button" class="bouton secondaire" data-copier="code">${icone('copier')} Copier le code</button>
            ${navigator.share ? `<button type="button" class="bouton secondaire" id="partage-natif">${icone('partage')} Autre…</button>` : ''}
          </div>
          <p class="muet petit" style="margin:0">L’école ouvre votre lien et votre code est déjà rempli dans sa demande d’essai — même si elle revient s’inscrire plus tard sur le même appareil (30 jours).</p>
        </div>
        <div class="carte" style="text-align:center">
          <div class="carte-titre"><h3>QR code</h3></div>
          <div class="qr" id="qr"><span class="muet petit">Chargement…</span></div>
          <p class="muet petit">À imprimer sur une affiche ou à montrer pendant une réunion de parents.</p>
          <button type="button" class="bouton secondaire petit" id="telecharger-qr">${icone('telecharger')} Télécharger</button>
        </div>
      </section>

      <section class="section">
        <div class="section-titre"><h2>Messages prêts à envoyer</h2><span class="muet petit">Modifiez-les librement avant d’envoyer</span></div>
        <div class="grille g-3" id="modeles"></div>
      </section>

      <section class="section grille g-2">
        <div class="carte">
          <div class="carte-titre"><h3>Les offres et leurs prix</h3><a class="petit" href="/tarifs/" target="_blank" rel="noopener">Page tarifs</a></div>
          ${offres.length ? `<div class="offres">${offres.map((o) => `<div class="offre"><h4>${esc(o.nom.replace(/^Ardoise\s+/, ''))}</h4>
            <div class="prix">${esc(argent(o.tarifs.mensuel.total, o.devise, true))}<small> / mois</small></div>
            ${o.tarifs.annuel ? `<p>ou ${esc(argent(o.tarifs.annuel.total, o.devise, true))} / an${o.tarifs.annuel.economie ? ` (−${esc(argent(o.tarifs.annuel.economie, o.devise, true))})` : ''}</p>` : ''}
            <p>${esc(o.positionnement || '')}</p></div>`).join('')}</div>
            <p class="muet petit" style="margin:12px 0 0">Prix publics tirés en direct du catalogue d’Ardoise : ce sont ceux que vous pouvez annoncer. Aucune remise ne peut être promise sans accord écrit de l’équipe.</p>`
            : '<p class="muet">Le catalogue est momentanément indisponible. Consultez la <a href="/tarifs/" target="_blank" rel="noopener">page tarifs</a>.</p>'}
        </div>
        <div class="carte simulateur">
          <div class="carte-titre"><h3>${icone('calcul')} Simulateur</h3></div>
          ${offres.length ? `
            <label class="champ" style="margin:0"><span>Nombre d’écoles : <strong id="sim-n-texte">5</strong></span>
              <input type="range" id="sim-n" min="1" max="50" value="5" /></label>
            <div class="duo">
              <label class="champ"><span>Offre</span><select id="sim-offre">${offres.map((o, i) => `<option value="${i}">${esc(o.nom.replace(/^Ardoise\s+/, ''))}</option>`).join('')}</select></label>
              <label class="champ"><span>Paiement</span><select id="sim-formule"><option value="annuel">Annuel</option><option value="semestriel">Semestriel</option><option value="mensuel">Mensuel</option></select></label>
            </div>
            <div class="simulateur-resultat"><span class="muet petit">Commissions possibles sur ${DUREE_PROGRAMME_MOIS} mois</span>
              <strong id="sim-total">—</strong><span class="petit" id="sim-detail"></span></div>
            <p class="muet petit" style="margin:0">Estimation, pas une promesse : ${TAUX_PROGRAMME} % des paiements réellement encaissés pendant ${DUREE_PROGRAMME_MOIS} mois, selon les conditions en vigueur à la validation de chaque attribution. Une école qui ne paie pas ne rapporte rien.</p>`
            : '<p class="muet">Disponible dès que le catalogue répond.</p>'}
        </div>
      </section>

      <section class="section grille g-2">
        <div class="carte"><div class="carte-titre"><h3>Ce qui convainc les écoles</h3></div>
          <ul class="arguments">
            <li><span>Les <strong>bulletins officiels</strong> (primaire, secondaire, terminale) sortent des cotes saisies une seule fois : fini la recopie.</span></li>
            <li><span>Les <strong>frais scolaires</strong> se suivent en francs congolais ou en dollars, avec reçus.</span></li>
            <li><span>Ça marche avec une <strong>connexion instable</strong>, sur ordinateur comme sur téléphone.</span></li>
            <li><span>Chaque personne a <strong>son rôle</strong> : direction, secrétariat, titulaires, professeurs.</span></li>
            <li><span>Un <strong>essai gratuit</strong> pour tout tester, sans engagement.</span></li>
          </ul></div>
        <div class="carte"><div class="carte-titre"><h3>Répondre aux objections</h3></div>
          <details class="objection"><summary>« Nous n’avons pas Internet en permanence. »</summary><p>Ardoise est conçue pour les connexions instables : l’essentiel reste consultable, et la saisie reprend quand le réseau revient.</p></details>
          <details class="objection"><summary>« C’est trop cher pour nous. »</summary><p>${prixMin ? `L’offre la moins chère est à ${esc(prixMin)} par mois, ` : ''}sans limite d’élèves sur l’essentiel. Comparez avec le temps passé à recopier les bulletins chaque trimestre.</p></details>
          <details class="objection"><summary>« Nos enseignants ne sauront pas l’utiliser. »</summary><p>Un didacticiel guide chaque écran, et des formations sont proposées par des formateurs qualifiés.</p></details>
          <details class="objection"><summary>« Et nos données ? »</summary><p>Chaque école est isolée, chaque action est tracée, et les données ne sont partagées avec personne — pas même avec vous.</p></details>
        </div>
      </section>`;

    function appliquerCode() {
      $('#code-geant', contenu).textContent = code.code;
      $('#lien-texte', contenu).textContent = code.lien;
      $('#partage-wa', contenu).href = lienPartage(messageCourt(code.lien));
      $('#partage-sms', contenu).href = `sms:?&body=${encodeURIComponent(messageCourt(code.lien))}`;
      $('#partage-mail', contenu).href = `mailto:?subject=${encodeURIComponent('Ardoise — gestion scolaire')}&body=${encodeURIComponent(modelesMessages(code.lien, code.code, prixMin)[2].texte.replace(/^Objet : .*\n\n/, ''))}`;
      $('#modeles', contenu).innerHTML = modelesMessages(code.lien, code.code, prixMin).map((x, i) => `
        <div class="carte modele"><h3>${esc(x.titre)}</h3>
          <textarea class="saisie" data-modele="${i}">${esc(x.texte)}</textarea>
          <div class="partages"><button type="button" class="bouton secondaire petit" data-copier-modele="${i}">${icone('copier')} Copier</button>
            <a class="bouton whatsapp petit" target="_blank" rel="noopener" data-wa-modele="${i}" href="#">${icone('whatsapp')} Envoyer</a></div></div>`).join('');
      $$('[data-copier-modele]', contenu).forEach((b) => b.addEventListener('click', () => {
        drapeaux.poser('lien_partage');
        copier($(`[data-modele="${b.dataset.copierModele}"]`, contenu).value, 'Message copié.');
      }));
      $$('[data-wa-modele]', contenu).forEach((a) => a.addEventListener('click', () => {
        drapeaux.poser('lien_partage');
        a.href = lienPartage($(`[data-modele="${a.dataset.waModele}"]`, contenu).value);
      }));
      const zoneQr = $('#qr', contenu);
      chargerQr().then((QR) => {
        zoneQr.innerHTML = '';
        // eslint-disable-next-line no-new
        new QR(zoneQr, { text: code.lien, width: 328, height: 328, colorDark: '#141C18', colorLight: '#ffffff', correctLevel: QR.CorrectLevel.M });
      }).catch(() => { zoneQr.innerHTML = '<span class="muet petit">QR code indisponible hors connexion.</span>'; });
    }
    appliquerCode();

    const choix = $('#choix-code', contenu);
    if (choix) choix.addEventListener('change', () => { code = codes.find((c) => c.code === choix.value) || code; appliquerCode(); });
    $$('[data-copier]', contenu).forEach((b) => b.addEventListener('click', () => {
      drapeaux.poser('lien_partage');
      copier(b.dataset.copier === 'code' ? code.code : code.lien, b.dataset.copier === 'code' ? 'Code copié.' : 'Lien copié.');
    }));
    ['#partage-wa', '#partage-sms', '#partage-mail'].forEach((s) => $(s, contenu).addEventListener('click', () => drapeaux.poser('lien_partage')));
    const natif = $('#partage-natif', contenu);
    if (natif) natif.addEventListener('click', () => {
      drapeaux.poser('lien_partage');
      navigator.share({ title: 'Ardoise', text: messageCourt(code.lien) }).catch(() => {});
    });
    $('#telecharger-qr', contenu).addEventListener('click', () => {
      const source = $('#qr canvas', contenu) || $('#qr img', contenu);
      if (!source) { toast('QR code pas encore prêt.', 'danger'); return; }
      const a = document.createElement('a');
      a.href = source.tagName === 'CANVAS' ? source.toDataURL('image/png') : source.src;
      a.download = `qr-ardoise-${code.code}.png`;
      document.body.appendChild(a); a.click(); a.remove();
    });

    if (offres.length) {
      const PAIEMENTS = { mensuel: DUREE_PROGRAMME_MOIS, semestriel: DUREE_PROGRAMME_MOIS / 6, annuel: DUREE_PROGRAMME_MOIS / 12 };
      const calculer = () => {
        const n = Number($('#sim-n', contenu).value);
        const o = offres[Number($('#sim-offre', contenu).value)];
        const formule = $('#sim-formule', contenu).value;
        const tarif = o.tarifs[formule] || o.tarifs.mensuel;
        const nbPaiements = PAIEMENTS[o.tarifs[formule] ? formule : 'mensuel'];
        const parEcole = tarif.total * nbPaiements * TAUX_PROGRAMME / 100;
        $('#sim-n-texte', contenu).textContent = String(n);
        $('#sim-total', contenu).textContent = argent(parEcole * n, o.devise, true);
        $('#sim-detail', contenu).textContent = `${argent(parEcole, o.devise, true)} par école : ${TAUX_PROGRAMME} % de ${nbPaiements} paiement(s) de ${argent(tarif.total, o.devise, true)}.`;
      };
      ['#sim-n', '#sim-offre', '#sim-formule'].forEach((s) => $(s, contenu).addEventListener('input', calculer));
      calculer();
    }
  };

  /* --------------------------------------------------------------- Messages */

  vues.messages = async (contenu, params) => {
    const m = await moi();
    entete('Messages', 'L’équipe Ardoise, la communauté des partenaires et vos messages directs.',
      `<button type="button" class="bouton secondaire" data-annuaire>${icone('plus')} Nouveau message</button>`);
    let conversations = [];
    let courante = null;
    let messages = [];

    contenu.innerHTML = `<div class="messagerie" id="messagerie">
      <aside class="liste-conversations"><div class="liste-tete"><h3>Conversations</h3>
        <button type="button" class="icone-bouton" data-annuaire aria-label="Nouveau message direct">${icone('plus')}</button></div>
        <div id="liste-conv"></div></aside>
      <section class="fil" id="fil"><div class="fil-vide">${etatVide('messages', 'Choisissez une conversation', 'Écrivez à l’équipe, échangez avec la communauté ou contactez un autre partenaire.')}</div></section>
    </div>`;
    const racine = $('#messagerie', contenu);

    function apercu(c) {
      if (!c.dernier) return esc(c.description || '');
      const qui = c.dernier.est_moi ? 'Vous' : c.dernier.auteur_nom;
      return `${esc(qui)} : ${c.dernier.contenu === null ? '<em>message retiré</em>' : esc(c.dernier.contenu)}`;
    }
    function ligneConv(c) {
      const vignette = c.type === 'salon' ? `<span class="icone-salon">${esc(c.icone || '#')}</span>`
        : avatar(c.nom, c.interlocuteur_id || c.id, c.type === 'equipe' ? 'equipe' : '');
      return `<button type="button" class="conv ${courante && courante.id === c.id ? 'actif' : ''} ${c.non_lus ? 'non-lu' : ''}" data-conv="${esc(c.id)}">
        ${vignette}<span class="conv-texte"><strong>${esc(c.nom)}</strong><small>${apercu(c)}</small></span>
        <span class="conv-cote">${c.dernier ? esc(relatif(c.dernier.created_at)) : ''}${c.non_lus ? `<b class="pastille">${c.non_lus}</b>` : ''}</span></button>`;
    }
    function dessinerListe() {
      const groupes = [['equipe', 'Équipe'], ['salon', 'Salons'], ['directe', 'Messages directs']];
      $('#liste-conv', racine).innerHTML = groupes.map(([type, titre]) => {
        const l = conversations.filter((c) => c.type === type);
        if (!l.length && type !== 'directe') return '';
        return `<div class="groupe-conv">${titre}</div>${l.map(ligneConv).join('')
          || '<p class="muet petit" style="padding:4px 14px 12px;margin:0">Aucun pour l’instant. Touchez « + » pour écrire à un partenaire.</p>'}`;
      }).join('');
      $$('[data-conv]', racine).forEach((b) => b.addEventListener('click', () => ouvrir(b.dataset.conv)));
    }
    async function chargerListe() {
      const r = await api('/apporteurs/portail/messagerie');
      conversations = r.conversations || [];
      afficherNonLus(r.non_lus_total || 0);
      dessinerListe();
    }

    function bulles() {
      let jour = ''; let precedent = null;
      return messages.map((x) => {
        const j = new Date(x.created_at).toDateString();
        let html = '';
        if (j !== jour) { html += `<div class="jour-sep">${esc(jourSeparateur(x.created_at))}</div>`; jour = j; precedent = null; }
        const classe = x.est_moi ? 'moi' : (x.auteur_type === 'apporteur' ? '' : x.auteur_type);
        const suite = precedent && precedent.auteur_nom === x.auteur_nom && precedent.auteur_type === x.auteur_type
          && (new Date(x.created_at) - new Date(precedent.created_at)) < 5 * 60000;
        const montrerAuteur = !x.est_moi && !suite && courante.type !== 'directe';
        const cliquable = x.auteur_type === 'apporteur' && x.auteur_apporteur_id && !x.est_moi && courante.type === 'salon';
        html += `<div class="bulle-ligne ${classe} ${suite ? 'suite' : ''}">
          ${x.est_moi ? '' : avatar(x.auteur_nom, x.auteur_apporteur_id || x.auteur_type, x.auteur_type === 'apporteur' ? '' : 'equipe')}
          <div class="bulle ${x.supprime ? 'retire' : ''}">
            ${montrerAuteur ? `<button type="button" class="auteur ${cliquable ? 'cliquable' : ''}" ${cliquable ? `data-ecrire-a="${esc(x.auteur_apporteur_id)}" title="Écrire en privé"` : 'tabindex="-1"'}>${esc(x.auteur_nom)}</button>` : ''}
            <span class="texte">${x.supprime ? (x.supprime_par === 'equipe' ? 'Message retiré par l’équipe' : 'Message retiré') : esc(x.contenu)}</span>
            <span class="heure">${esc(heure(x.created_at))}</span>
            ${x.est_moi && !x.supprime ? `<button type="button" class="supprimer" data-retirer="${esc(x.id)}" aria-label="Retirer ce message">${icone('fermer')}</button>` : ''}
          </div></div>`;
        precedent = x;
        return html;
      }).join('');
    }
    function dessinerFil(defiler) {
      const zone = $('#fil-messages', racine);
      if (!zone) return;
      const enBas = zone.scrollHeight - zone.scrollTop - zone.clientHeight < 80;
      zone.innerHTML = messages.length ? bulles()
        : etatVide('messages', courante.type === 'equipe' ? 'Écrivez à l’équipe' : 'Lancez la conversation',
          courante.type === 'equipe' ? 'Une question sur le programme, une école, un montant ? Nous vous répondons ici.' : 'Soyez le premier à écrire.');
      if (defiler || enBas) zone.scrollTop = zone.scrollHeight;
      $$('[data-ecrire-a]', zone).forEach((b) => b.addEventListener('click', () => ecrireA(b.dataset.ecrireA)));
      $$('[data-retirer]', zone).forEach((b) => b.addEventListener('click', async () => {
        if (!window.confirm('Retirer ce message pour tout le monde ?')) return;
        try {
          await api(`/apporteurs/portail/messagerie/messages/${b.dataset.retirer}`, { method: 'DELETE' });
          const x = messages.find((y) => y.id === b.dataset.retirer);
          if (x) { x.supprime = true; x.contenu = null; x.supprime_par = 'auteur'; }
          dessinerFil();
        } catch (err) { toast(err.message, 'danger'); }
      }));
    }

    async function ouvrir(id, sansHistorique) {
      courante = conversations.find((c) => c.id === id);
      if (!courante) return;
      if (!sansHistorique) history.replaceState(null, '', `#/messages?c=${id}`);
      racine.classList.add('fil-ouvert');
      dessinerListe();
      const vignette = courante.type === 'salon' ? `<span class="icone-salon" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--surface-3);font-size:1.15rem">${esc(courante.icone || '#')}</span>`
        : avatar(courante.nom, courante.interlocuteur_id || courante.id, courante.type === 'equipe' ? 'equipe' : '');
      $('#fil', racine).innerHTML = `
        <header class="fil-tete"><button type="button" class="icone-bouton retour" aria-label="Retour aux conversations">${icone('retour')}</button>
          ${vignette}<div style="min-width:0"><h3>${esc(courante.nom)}</h3><p>${esc(courante.description || '')}</p></div></header>
        <div class="fil-messages" id="fil-messages"><div class="anneau-chargement"></div></div>
        ${courante.lecture_seule ? '<div class="composer-ferme">Seule l’équipe Ardoise publie dans ce salon.</div>'
          : `<form class="composer" id="composer"><label class="sr-only" for="saisie-message">Votre message</label>
              <textarea id="saisie-message" rows="1" maxlength="4000" placeholder="Écrire un message…"></textarea>
              <button type="submit" class="bouton principal" aria-label="Envoyer">${icone('envoyer')}</button></form>`}`;
      $('.retour', racine).addEventListener('click', () => { racine.classList.remove('fil-ouvert'); courante = null; history.replaceState(null, '', '#/messages'); dessinerListe(); });
      const r = await api(`/apporteurs/portail/messagerie/${id}/messages`);
      if (!courante || courante.id !== id) return;
      messages = r.messages || [];
      dessinerFil(true);
      marquerLu();
      const form = $('#composer', racine);
      if (form) {
        const zone = $('#saisie-message', form);
        const ajuster = () => { zone.style.height = 'auto'; zone.style.height = `${Math.min(zone.scrollHeight, 160)}px`; };
        zone.addEventListener('input', ajuster);
        zone.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(min-width: 861px)').matches) { e.preventDefault(); form.requestSubmit(); }
        });
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const texte = zone.value.trim();
          if (!texte) return;
          const bouton = form.querySelector('[type=submit]');
          bouton.disabled = true;
          try {
            const rep = await api(`/apporteurs/portail/messagerie/${id}/messages`, { method: 'POST', body: { contenu: texte } });
            messages.push(rep.message);
            zone.value = ''; ajuster();
            dessinerFil(true);
            if (courante.type === 'salon') drapeaux.poser('presente');
            courante.dernier = { auteur_nom: rep.message.auteur_nom, contenu: texte, est_moi: true, created_at: rep.message.created_at };
            dessinerListe();
          } catch (err) { toast(err.message, 'danger'); }
          finally { bouton.disabled = false; zone.focus(); }
        });
        if (window.matchMedia('(min-width: 861px)').matches) zone.focus();
      }
    }

    async function marquerLu() {
      if (!courante) return;
      if (courante.non_lus) { courante.non_lus = 0; dessinerListe(); }
      try { await api(`/apporteurs/portail/messagerie/${courante.id}/lu`, { method: 'POST', body: {} }); rafraichirNonLus(); } catch (e) { /* */ }
    }

    async function nouveautes() {
      if (document.hidden || routeCourante !== 'messages') return;
      try {
        if (courante) {
          const dernier = messages.length ? messages[messages.length - 1].created_at : null;
          const r = await api(`/apporteurs/portail/messagerie/${courante.id}/messages${dernier ? `?apres=${encodeURIComponent(dernier)}` : ''}`);
          const neufs = (r.messages || []).filter((x) => !messages.some((y) => y.id === x.id));
          if (neufs.length) { messages.push(...neufs); dessinerFil(); marquerLu(); }
        }
        await chargerListe();
      } catch (e) { /* le prochain passage réessaiera */ }
    }

    async function ecrireA(apporteurId) {
      try {
        const r = await api('/apporteurs/portail/messagerie/directe', { method: 'POST', body: { apporteur_id: apporteurId } });
        await chargerListe();
        ouvrir(r.id);
      } catch (err) { toast(err.message, 'danger'); }
    }

    async function annuaire() {
      const { racine: fenetre, fermer } = modale({
        titre: 'Écrire à un partenaire',
        sousTitre: 'Les partenaires qui ont choisi d’apparaître dans l’annuaire du programme.',
        large: true,
        corps: `<input class="saisie" id="recherche-annuaire" placeholder="Rechercher un nom, une ville, une profession…" style="margin-bottom:12px" />
          <div class="annuaire" id="liste-annuaire"><div class="anneau-chargement"></div></div>`
      });
      const dessiner = async (q) => {
        try {
          const r = await api(`/apporteurs/portail/messagerie/annuaire${q ? `?q=${encodeURIComponent(q)}` : ''}`);
          $('#liste-annuaire', fenetre).innerHTML = (r.partenaires || []).map((p) => `
            <div class="membre">${avatar(p.nom, p.id)}
              <div style="min-width:0"><strong>${esc(p.nom)}</strong> <small>${esc([p.ville, p.profession].filter(Boolean).join(' · '))}</small>
                ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">${(p.badges || []).map((b) => `<span class="etiquette">${esc((BADGES[b] || {}).icone || '')} ${esc((BADGES[b] || {}).libelle || b)}</span>`).join('')}</div></div>
              <button type="button" class="bouton secondaire petit" data-ecrire="${esc(p.id)}">Écrire</button></div>`).join('')
            || etatVide('chercher', 'Personne pour le moment', q ? 'Aucun partenaire ne correspond à cette recherche.' : 'Les autres partenaires apparaîtront ici.');
          $$('[data-ecrire]', fenetre).forEach((b) => b.addEventListener('click', () => { fermer(); ecrireA(b.dataset.ecrire); }));
        } catch (err) { $('#liste-annuaire', fenetre).innerHTML = `<div class="alerte erreur">${esc(err.message)}</div>`; }
      };
      let minuteur = null;
      $('#recherche-annuaire', fenetre).addEventListener('input', (e) => { clearTimeout(minuteur); minuteur = setTimeout(() => dessiner(e.target.value.trim()), 300); });
      dessiner('');
    }
    $$('[data-annuaire]').forEach((b) => b.addEventListener('click', annuaire));

    await chargerListe();
    const cible = params.c
      || (params.equipe && (conversations.find((c) => c.type === 'equipe') || {}).id)
      || (params.salon && (conversations.find((c) => c.slug === params.salon) || {}).id)
      || (window.matchMedia('(min-width: 861px)').matches && conversations[0] ? (conversations.find((c) => c.non_lus) || conversations.find((c) => c.type === 'equipe') || conversations[0]).id : null);
    if (cible) await ouvrir(cible, !params.c);
    if (!m.profil.visible_annuaire) {
      toast('Vous êtes masqué de l’annuaire : les autres partenaires ne peuvent pas vous écrire en privé. Modifiable dans votre profil.');
    }
    minuteries.push(setInterval(nouveautes, 6000));
  };

  /* ------------------------------------------------------------- Programme */

  vues.programme = async (contenu) => {
    const m = await moi();
    const parBadge = Object.fromEntries((m.badges || []).map((b) => [b.badge, b]));
    entete('Le programme', 'Quatre badges cumulables, et les règles qui s’appliquent à chacun.');
    contenu.innerHTML = `
      <section class="grille g-2">
        ${Object.entries(BADGES).map(([cle, def]) => {
          const b = parBadge[cle];
          const s = b ? b.statut : 'non_detenu';
          return `<article class="carte badge-carte ${esc(s)}"><span class="badge-medaille" aria-hidden="true">${def.icone}</span>
            <div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px"><h3 style="margin:0">${esc(def.libelle)}</h3>
              ${b ? etiquette(b.statut) : '<span class="etiquette">Non demandé</span>'}</div>
              <p class="muet petit" style="margin:0">${esc(def.texte)}</p>
              ${!b && cle !== 'apporteur_affaires' ? `<a class="petit" href="#/messages?equipe=1">Demander ce badge</a>` : ''}
              ${b && b.statut === 'en_qualification' ? '<p class="petit" style="margin:6px 0 0">L’équipe vous contactera pour la qualification.</p>' : ''}</div></article>`;
        }).join('')}
      </section>
      <section class="section grille g-principal">
        <div class="carte"><div class="carte-titre"><h3>Comment vous êtes rémunéré</h3></div>
          <div class="regles">
            <div class="regle"><strong>${TAUX_PROGRAMME}&nbsp;%</strong><div><h4>Apport d’une école</h4><p>De chaque paiement d’abonnement <em>effectivement encaissé</em> pour une école qui vous est attribuée, pendant ${DUREE_PROGRAMME_MOIS} mois à compter du début de l’attribution. Le taux est figé à la validation de l’attribution.</p></div></div>
            <div class="regle"><strong>60&nbsp;$</strong><div><h4>Installation &amp; configuration</h4><p>Le montant de la prestation au tarif public, partagé à parts égales si deux configurateurs la réalisent. Badge configurateur requis.</p></div></div>
            <div class="regle"><strong>Selon</strong><div><h4>Formation et capture</h4><p>Rémunérées séparément selon la prestation réellement réalisée, aux conditions convenues avec l’équipe avant la prestation.</p></div></div>
            <div class="regle"><strong>+</strong><div><h4>Prolongation</h4><p>Lorsqu’un partenariat produit des résultats importants, une prolongation peut être négociée, école par école.</p></div></div>
          </div>
          <p class="muet petit">Aucun revenu n’est garanti : la commission dépend des paiements réels des écoles.</p></div>
        <div class="pile">
          <div class="carte"><div class="carte-titre"><h3>Comment une école vous est attribuée</h3></div>
            <ol class="taches" style="list-style:decimal;padding-left:20px;gap:8px">
              <li>L’école s’inscrit avec <strong>votre lien ou votre code</strong>, ou vous l’avez <strong>déclarée avant</strong> son inscription.</li>
              <li>L’équipe <strong>vérifie</strong> le rattachement ; en cas de conflit, la preuve la plus ancienne l’emporte.</li>
              <li>Chaque paiement encaissé produit sa <strong>commission</strong>, visible dans vos gains.</li>
            </ol></div>
          <div class="carte"><h3>Vos engagements</h3>
            <p>Présenter Ardoise honnêtement (prix publics, fonctionnalités réelles), respecter la confidentialité des écoles, et déclarer vos démarches.</p>
            <p style="margin-top:10px"><a href="/apporteurs/" target="_blank" rel="noopener">Conditions complètes du programme</a></p></div>
        </div>
      </section>`;
  };

  /* ------------------------------------------------------------------ Profil */

  vues.profil = async (contenu) => {
    const m = await moi(true);
    const p = m.profil;
    const code = codePrincipal(m);
    entete('Profil et réglages', 'Vos coordonnées, votre présentation, vos versements et votre sécurité.');
    contenu.innerHTML = `
      <section class="grille g-principal">
        <div class="pile">
          <form class="carte" data-section="coordonnees" novalidate>
            <div class="carte-titre"><h3>Coordonnées</h3></div>
            <div class="duo">
              <label class="champ"><span>Téléphone / WhatsApp</span><input name="telephone" value="${esc(p.telephone || '')}" maxlength="40" /></label>
              <label class="champ"><span>Ville</span><input name="ville" value="${esc(p.ville || '')}" maxlength="120" /></label>
            </div>
            <div class="duo">
              <label class="champ"><span>Province</span><input name="province" value="${esc(p.province || '')}" maxlength="120" /></label>
              <label class="champ"><span>Organisation <em>(facultatif)</em></span><input name="organisation" value="${esc(p.organisation || '')}" maxlength="200" /></label>
            </div>
            <div class="modale-pied"><button type="submit" class="bouton principal">Enregistrer</button></div>
          </form>

          <form class="carte" data-section="presentation" novalidate>
            <div class="carte-titre"><h3>Présentation dans la communauté</h3></div>
            <label class="champ"><span>Profession</span><input name="profession" value="${esc(p.profession || '')}" maxlength="160" placeholder="ex. Préfet des études, consultant, formateur" /></label>
            <label class="champ"><span>Quelques mots sur vous <em>(600 caractères)</em></span><textarea name="bio" maxlength="600" placeholder="Votre réseau, vos villes, ce que vous aimez faire…">${esc(p.bio || '')}</textarea></label>
            <label class="case"><input type="checkbox" name="visible_annuaire" ${p.visible_annuaire ? 'checked' : ''} />
              <span>Apparaître dans l’annuaire des partenaires et recevoir des messages privés. Les autres voient : <strong>${esc(p.nom_public)}</strong>${p.ville ? `, ${esc(p.ville)}` : ''}, votre profession et votre présentation — jamais votre e-mail ni votre téléphone.</span></label>
            <div class="modale-pied"><button type="submit" class="bouton principal">Enregistrer</button></div>
          </form>

          <form class="carte" data-section="versements" novalidate>
            <div class="carte-titre"><h3>Recevoir mes gains</h3></div>
            <label class="champ"><span>Mode de versement préféré</span><select name="versement_methode"><option value="">À préciser</option>
              ${Object.entries(METHODES).map(([k, l]) => `<option value="${k}" ${p.versement_methode === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
            <div class="duo">
              <label class="champ"><span>Titulaire</span><input name="versement_titulaire" value="${esc(p.versement_titulaire || '')}" maxlength="160" /></label>
              <label class="champ"><span>Numéro ou compte</span><input name="versement_details" value="${esc(p.versement_details || '')}" maxlength="300" placeholder="ex. M-Pesa 081…, Airtel Money, IBAN" /></label>
            </div>
            <p class="muet petit" style="margin:0 0 8px">Ces informations servent uniquement à vous verser vos gains. Chaque versement apparaît dans vos gains avec sa référence.</p>
            <div class="modale-pied"><button type="submit" class="bouton principal">Enregistrer</button></div>
          </form>
        </div>

        <div class="pile">
          <div class="carte" style="text-align:center">
            <div style="display:grid;place-items:center;margin-bottom:10px">${avatar(`${p.prenom || ''} ${p.nom || ''}`, p.id).replace('class="avatar', 'style="width:68px;height:68px;font-size:1.3rem" class="avatar')}</div>
            <h3>${esc([p.prenom, p.nom].filter(Boolean).join(' '))}</h3>
            <p class="muet petit" style="margin:2px 0 0">${esc(p.email)}</p>
            ${code ? `<p class="petit" style="margin:8px 0 0">Code <span class="mono">${esc(code.code)}</span></p>` : ''}
            <p class="muet petit" style="margin:6px 0 0">Partenaire depuis le ${esc(dateLongue(p.created_at))}</p>
            <p class="muet petit" style="margin:12px 0 0">Pour changer de nom ou d’adresse e-mail, <a href="#/messages?equipe=1">écrivez à l’équipe</a>.</p>
          </div>

          <form class="carte" data-section="notifications" novalidate>
            <div class="carte-titre"><h3>Notifications</h3></div>
            <label class="case"><input type="checkbox" name="notifications_email" ${p.notifications_email ? 'checked' : ''} />
              <span>Me prévenir par e-mail quand l’équipe ou un partenaire m’écrit.</span></label>
            <div class="modale-pied"><button type="submit" class="bouton secondaire">Enregistrer</button></div>
          </form>

          <form class="carte" id="form-mdp" novalidate>
            <div class="carte-titre"><h3>Mot de passe</h3></div>
            <label class="champ"><span>Mot de passe actuel</span><input type="password" name="actuel" autocomplete="current-password" /></label>
            <label class="champ"><span>Nouveau mot de passe <em>(8 caractères au moins)</em></span><input type="password" name="nouveau" autocomplete="new-password" minlength="8" /></label>
            <p class="muet petit" style="margin:0 0 8px">Vos autres appareils seront déconnectés.</p>
            <div class="modale-pied"><button type="submit" class="bouton secondaire">Changer le mot de passe</button></div>
          </form>
        </div>
      </section>`;

    $$('form[data-section]', contenu).forEach((f) => f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bouton = f.querySelector('[type=submit]');
      const corps = {};
      $$('input, select, textarea', f).forEach((c) => { corps[c.name] = c.type === 'checkbox' ? c.checked : c.value; });
      attente(bouton, true, 'Enregistrement…');
      try {
        await api('/apporteurs/portail/moi', { method: 'PATCH', body: corps });
        toast('Enregistré.', 'succes');
        cache.moi = null;
      } catch (err) { toast(err.message, 'danger'); }
      finally { attente(bouton, false); }
    }));

    $('#form-mdp', contenu).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget; const bouton = f.querySelector('[type=submit]');
      if (f.nouveau.value.length < 8) { toast('Le nouveau mot de passe doit contenir au moins 8 caractères.', 'danger'); return; }
      attente(bouton, true, 'Modification…');
      try {
        const r = await api('/apporteurs/portail/mot-de-passe', { method: 'POST', body: { actuel: f.actuel.value, nouveau: f.nouveau.value } });
        session.enregistrer(r.access_token, r.apporteur, session.durable());
        f.reset();
        toast(r.message, 'succes');
      } catch (err) { toast(err.message, 'danger'); }
      finally { attente(bouton, false); }
    });
  };

  /* ============================================================== Démarrage */

  async function demarrer() {
    ecranAcces.hidden = true;
    application.hidden = false;
    cache.moi = null;
    const profil = session.profil() || {};
    const nom = [profil.prenom, profil.nom].filter(Boolean).join(' ') || profil.email || '—';
    $('#nom-rail').textContent = nom;
    $('#avatar-rail').textContent = initiales(nom);
    if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/accueil');
    await rendre();
    moi().then((m) => {
      const c = codePrincipal(m);
      $('#code-rail').textContent = c ? c.code : '';
      const n = [m.profil.prenom, m.profil.nom].filter(Boolean).join(' ');
      if (n) { $('#nom-rail').textContent = n; $('#avatar-rail').textContent = initiales(n); }
    }).catch(() => {});
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden && session.lire() && !application.hidden) rafraichirNonLus(); });
  window.addEventListener('storage', (e) => {
    if (e.key === CLE && !e.newValue && !session.lire()) location.replace(location.pathname);
  });

  if (!jetonAcces && !jetonVerification) {
    if (session.lire()) demarrer();
    else afficherAcces(location.hash.includes('inscription') ? 'inscription' : 'connexion');
  }
})();
