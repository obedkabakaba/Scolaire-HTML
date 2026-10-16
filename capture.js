/* ==========================================================================
   Ardoise — Espace de capture (campagne de capture sur le terrain)
   --------------------------------------------------------------------------
   capture.html?mission=<id>                partenaire (jeton du portail)
   capture.html?mission=<id>&mode=equipe    équipe Ardoise (session Super Admin,
                                            même onglet que la console)

   Parcours sur place : choisir une classe → toucher un élève → « Prendre la
   photo » (recadrée 3:4 et compressée ici, ≈ 100 Ko, avant l'envoi) →
   compléter la fiche → élève suivant sans photo. Un élève absent de la liste
   s'enregistre avec « + Élève ».

   RIEN N'EST GARDÉ SUR L'APPAREIL : les données vivent en mémoire le temps de
   la page, jamais dans localStorage ; les liens de photo expirent en 10 min.
   Le serveur refuse tout dès que l'accès se ferme (part terminée, mission
   close, échéance) : la page affiche alors l'écran « fermé » et oublie tout.
   ========================================================================== */

(function () {
  'use strict';

  const API = (window.API_BASE_URL || 'https://scolaire-saas-backend.onrender.com').replace(/\/+$/, '');
  const params = new URLSearchParams(location.search);
  const MISSION = String(params.get('mission') || '');
  const EQUIPE = params.get('mode') === 'equipe';
  const BASE = EQUIPE ? `/super-admin/capture/${encodeURIComponent(MISSION)}` : `/apporteurs/portail/capture/${encodeURIComponent(MISSION)}`;
  const RETOUR = EQUIPE ? 'super-admin.html#/apporteurs/missions' : 'espace-apporteur.html#/missions?onglet=miennes';
  const PHOTO = { largeur: 600, hauteur: 800, qualite: 0.85 };
  const CHECKLIST = [
    ['classes_appelees', EQUIPE ? 'Toutes les classes ont été appelées' : 'Toutes mes classes ont été appelées'],
    ['photos_verifiees', 'Photos vérifiées (visage net, cadré, bien rattaché à l’élève)'],
    ['identites_controlees', 'Noms et dates de naissance contrôlés avec le titulaire ou le registre'],
    ['responsables_saisis', 'Responsable et téléphone saisis pour chaque élève'],
    ['absents_signales', 'Élèves absents signalés à la direction'],
    ['liste_remise_direction', 'Point de fin fait avec la direction']
  ];
  const CHAMPS = [
    ['nom', 'Nom', 'text', 80], ['postnom', 'Postnom', 'text', 80], ['prenom', 'Prénom', 'text', 80],
    ['sexe', 'Sexe', 'sexe'], ['date_naissance', 'Date de naissance', 'date'], ['lieu_naissance', 'Lieu de naissance', 'text', 120],
    ['adresse', 'Adresse', 'text', 250], ['telephone', 'Téléphone de l’élève', 'tel', 40],
    ['responsable_nom', 'Nom du responsable', 'text', 120], ['responsable_telephone', 'Téléphone du responsable', 'tel', 40],
    ['responsable_email', 'E-mail du responsable', 'email', 160], ['responsable_adresse', 'Adresse du responsable', 'text', 250]
  ];

  const $ = (sel, racine) => (racine || document).querySelector(sel);
  const $$ = (sel, racine) => Array.from((racine || document).querySelectorAll(sel));
  const esc = (v) => String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const icone = (n) => `<svg aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const racine = $('#cap');

  /* État en mémoire seulement. */
  let resume = null;
  let vue = { nom: 'classes' };
  let eleves = [];
  let ferme = false;

  function toast(message, type) {
    const el = document.createElement('div');
    el.className = `toast ${type || ''}`;
    el.innerHTML = `<span>${esc(message)}</span><button type="button" aria-label="Fermer">${icone('fermer')}</button>`;
    el.querySelector('button').addEventListener('click', () => el.remove());
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }
  function attente(bouton, actif, texte) {
    if (!bouton) return;
    if (actif) { bouton.dataset.libelle = bouton.innerHTML; bouton.disabled = true; bouton.textContent = texte || 'Patientez…'; }
    else { bouton.disabled = false; if (bouton.dataset.libelle) bouton.innerHTML = bouton.dataset.libelle; }
  }
  function dateCourte(v) {
    if (!v) return '—';
    const d = new Date(String(v).length === 10 ? `${v}T12:00:00` : v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const nomComplet = (e) => [e.nom, e.postnom, e.prenom].filter(Boolean).join(' ');

  /* ============================================================ Session */

  function lireStockage(cle) {
    for (const s of [() => sessionStorage, () => localStorage]) {
      try { const v = s().getItem(cle); if (v) return { valeur: v, depot: s() }; } catch (e) { /* indisponible */ }
    }
    return null;
  }
  function jeton() {
    const j = lireStockage(EQUIPE ? 'ardoise_admin_access_token' : 'ardoise_apporteur_jeton');
    return j ? j.valeur : null;
  }
  let rafraichissement = null;
  async function rafraichirEquipe() {
    if (!EQUIPE) return null;
    if (rafraichissement) return rafraichissement;
    const r = lireStockage('ardoise_admin_refresh_token');
    if (!r) return null;
    rafraichissement = (async () => {
      try {
        const rep = await fetch(`${API}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: r.valeur }) });
        if (!rep.ok) return null;
        const d = await rep.json();
        try { r.depot.setItem('ardoise_admin_access_token', d.access_token); } catch (e) { /* */ }
        return d.access_token;
      } catch (e) { return null; } finally { setTimeout(() => { rafraichissement = null; }, 0); }
    })();
    return rafraichissement;
  }

  async function api(chemin, options = {}) {
    if (ferme) throw new Error('Accès fermé.');
    const executer = (j) => fetch(API + BASE + chemin, {
      method: options.method || 'GET',
      cache: 'no-store',
      headers: Object.assign({ Accept: 'application/json', Authorization: `Bearer ${j}` },
        options.binaire ? { 'Content-Type': options.type } : (options.body ? { 'Content-Type': 'application/json' } : {})),
      body: options.binaire ? options.binaire : (options.body ? JSON.stringify(options.body) : undefined)
    });
    let j = jeton();
    if (!j) { ecranSession(); throw Object.assign(new Error('Connexion requise.'), { session: true }); }
    let rep;
    try { rep = await executer(j); } catch (e) { throw new Error('Réseau indisponible. Vérifiez la connexion et réessayez : rien n’est perdu.'); }
    if (rep.status === 401 && EQUIPE) {
      j = await rafraichirEquipe();
      if (j) rep = await executer(j);
    }
    const d = await rep.json().catch(() => ({}));
    if (rep.status === 401) { ecranSession(); throw Object.assign(new Error(d.message || 'Session expirée.'), { session: true }); }
    if (rep.status === 403 && /^(CAPTURE_(?!CLASSE)|BADGE_INACTIF)/.test(d.code || '')) {
      ecranFerme(d.message);
      throw Object.assign(new Error(d.message), { ferme: true });
    }
    if (!rep.ok) throw Object.assign(new Error(d.message || 'Opération impossible.'), { code: d.code, statut: rep.status, corps: d });
    return d;
  }

  /* ========================================================= Écrans fixes */

  function oublier() { resume = null; eleves = []; fermerModale(); }

  function ecranFerme(message) {
    ferme = true;
    oublier();
    racine.innerHTML = `<div class="cap-ferme">${icone('cadenas')}
      <h1 style="font-family:var(--titre);font-size:1.3rem;margin:12px 0 6px">Espace de capture fermé</h1>
      <p class="muet">${esc(message || 'Vous n’avez plus accès à cette campagne.')}</p>
      <p><a class="bouton secondaire" href="${RETOUR}">Retour aux missions</a></p></div>`;
  }
  function ecranSession() {
    oublier();
    racine.innerHTML = `<div class="cap-ferme">${icone('cadenas')}
      <h1 style="font-family:var(--titre);font-size:1.3rem;margin:12px 0 6px">Connexion requise</h1>
      <p class="muet">${EQUIPE ? 'Ouvrez cette campagne depuis la console Super Admin, dans le même onglet.' : 'Votre session a expiré. Reconnectez-vous à votre espace partenaire puis rouvrez la campagne.'}</p>
      <p><a class="bouton principal" href="${RETOUR}">${EQUIPE ? 'Console Super Admin' : 'Espace partenaire'}</a></p></div>`;
  }

  /* ============================================================ Entête */

  function entete(titre, retourVersClasses) {
    const t = resume.total || { effectif: 0, avec_photo: 0 };
    const pct = t.effectif ? Math.round((100 * t.avec_photo) / t.effectif) : 0;
    const m = resume.mission;
    return `<header class="cap-barre">
      <div class="cap-barre-ligne">
        ${retourVersClasses
          ? `<button type="button" class="cap-retour" data-classes aria-label="Retour aux classes">${icone('retour')}</button>`
          : `<a class="cap-retour" href="${RETOUR}" aria-label="Retour aux missions">${icone('retour')}</a>`}
        <h1>${esc(titre)}</h1>
        <span class="etiquette ${EQUIPE ? 'info' : 'succes'}">${esc(resume.acteur.nom)}</span>
      </div>
      <div class="cap-meta">
        <span>${esc(m.ecole_nom)}${m.ville ? ` · ${esc(m.ville)}` : ''}</span>
        <span><strong>${t.avec_photo}</strong> / ${t.effectif} élèves photographiés (${pct} %)</span>
        <span>Vous : ${resume.moi.eleves_photographies} photo(s) · ${resume.moi.eleves_crees} enregistré(s)</span>
        <span>${icone('cadenas')} jusqu’au ${esc(dateCourte(m.acces_expire_le))}</span>
      </div>
      <div class="jauge" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
    </header>`;
  }

  function lierEntete() {
    const b = $('[data-classes]', racine);
    if (b) b.addEventListener('click', () => afficherClasses(true));
  }

  /* ============================================================ Classes */

  async function afficherClasses(recharger) {
    if (recharger || !resume) resume = await api('/');
    vue = { nom: 'classes' };
    eleves = [];
    const classes = resume.classes;
    const carte = (c, attr) => {
      const complet = c.effectif > 0 && c.avec_photo >= c.effectif;
      return `<button type="button" class="cap-classe ${complet ? 'complete' : ''}" ${attr} ${c.dans_mon_perimetre === false ? 'disabled title="Classe confiée à un autre membre de l’équipe"' : ''}>
        <strong>${esc(c.nom)}</strong>
        <span>${c.avec_photo} / ${c.effectif} photo(s)${c.dans_mon_perimetre === false ? ' · autre membre' : ''}</span>
        <div class="jauge"><i style="width:${c.effectif ? Math.round((100 * c.avec_photo) / c.effectif) : 0}%"></i></div></button>`;
    };
    racine.innerHTML = entete('Campagne de capture', false) + `
      ${resume.mission.description ? `<div class="alerte info">${esc(resume.mission.description)}</div>` : ''}
      ${resume.perimetre_limite ? '<div class="alerte info">L’équipe vous a confié certaines classes : les autres sont grisées.</div>' : ''}
      <div class="cap-outils">
        <input type="search" class="saisie" id="cap-recherche" placeholder="Chercher un élève (nom ou matricule)…" autocomplete="off" enterkeyhint="search" />
        <button type="button" class="bouton secondaire" data-nouvel>${icone('plus')} Élève</button>
      </div>
      <div id="cap-resultats"></div>
      <h2 class="cap-titre-section">Classes</h2>
      ${classes.length ? `<div class="cap-classes">${classes.map((c) => carte(c, `data-classe="${esc(c.id)}"`)).join('')}
        ${resume.sans_classe.effectif ? carte({ nom: 'Sans classe', ...resume.sans_classe }, 'data-sans-classe') : ''}</div>`
        : '<div class="alerte attention">Aucune classe n’est encore créée dans cette école. Les élèves peuvent être enregistrés sans classe ; prévenez la direction pour qu’elle crée ses classes.</div>'}
      <h2 class="cap-titre-section">Fin de mission</h2>
      <div class="carte"><p class="petit" style="margin-top:0">${EQUIPE
        ? 'Quand tout est fait, terminez la campagne : l’accès de tous les partenaires à la liste se ferme et la mission passe en vérification.'
        : 'Quand vos classes sont faites, terminez votre part : votre accès à la liste des élèves se fermera aussitôt.'}</p>
        <button type="button" class="bouton secondaire" data-terminer>${icone('ok')} ${EQUIPE ? 'Terminer la campagne' : 'Terminer ma part'}</button></div>`;
    lierEntete();
    $$('[data-classe]', racine).forEach((b) => b.addEventListener('click', () => {
      const c = classes.find((x) => x.id === b.dataset.classe);
      afficherClasse({ classe_id: c.id, titre: c.nom });
    }));
    const sc = $('[data-sans-classe]', racine);
    if (sc) sc.addEventListener('click', () => afficherClasse({ sans_classe: '1', titre: 'Élèves sans classe' }));
    $('[data-nouvel]', racine).addEventListener('click', () => ouvrirFiche(null));
    $('[data-terminer]', racine).addEventListener('click', modaleTerminer);
    let minuterie = null;
    $('#cap-recherche').addEventListener('input', (e) => {
      clearTimeout(minuterie);
      const q = e.target.value.trim();
      if (q.length < 2) { $('#cap-resultats').innerHTML = ''; return; }
      minuterie = setTimeout(() => rechercher(q), 450);
    });
  }

  async function rechercher(q) {
    const zone = $('#cap-resultats');
    zone.innerHTML = '<p class="muet petit">Recherche…</p>';
    try {
      const d = await api(`/eleves?q=${encodeURIComponent(q)}`);
      eleves = d.eleves;
      zone.innerHTML = eleves.length ? `<div class="cap-liste" style="margin-bottom:14px">${eleves.map(ligneEleve).join('')}</div>`
        : '<p class="muet petit">Aucun élève trouvé. Il n’est peut-être pas encore enregistré : utilisez « + Élève ».</p>';
      lierLignes(zone);
    } catch (e) { if (!e.ferme && !e.session) zone.innerHTML = `<p class="petit" style="color:var(--rouge)">${esc(e.message)}</p>`; }
  }

  /* ============================================================ Une classe */

  function vignette(e) {
    return e.photo_url ? `<img class="cap-vignette" src="${esc(e.photo_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
      : `<span class="cap-vignette">${icone('profil')}</span>`;
  }
  function ligneEleve(e) {
    return `<button type="button" class="cap-eleve" data-eleve="${esc(e.id)}">${vignette(e)}
      <span><span class="nom">${esc(nomComplet(e))}</span><br /><span class="sous">${esc(e.matricule || '')}${e.classe_nom ? ` · ${esc(e.classe_nom)}` : ''}</span></span>
      ${e.a_photo ? '<span class="etiquette succes">Photo</span>' : '<span class="etiquette attention">À photographier</span>'}</button>`;
  }
  function lierLignes(zone) {
    $$('[data-eleve]', zone).forEach((b) => b.addEventListener('click', () => ouvrirFiche(eleves.find((x) => x.id === b.dataset.eleve))));
  }

  async function afficherClasse(filtre) {
    vue = { nom: 'classe', filtre };
    racine.innerHTML = entete(filtre.titre, true) + '<p class="cap-vide">Chargement de la classe…</p>';
    lierEntete();
    const q = filtre.classe_id ? `classe_id=${encodeURIComponent(filtre.classe_id)}` : 'sans_classe=1';
    try {
      eleves = (await api(`/eleves?${q}`)).eleves;
    } catch (e) {
      if (!e.ferme && !e.session) { toast(e.message, 'danger'); afficherClasses(false); }
      return;
    }
    rendreClasse();
  }

  function rendreClasse() {
    const f = vue.filtre;
    const sansPhoto = eleves.filter((e) => !e.a_photo);
    const avec = eleves.filter((e) => e.a_photo);
    racine.innerHTML = entete(f.titre, true) + `
      <p class="petit muet">${eleves.length} élève(s) · ${avec.length} photographié(s) · ${sansPhoto.length} restant(s)</p>
      ${eleves.length ? '' : '<div class="cap-vide">Aucun élève enregistré dans cette classe. Ajoutez-les avec « + Élève ».</div>'}
      ${sansPhoto.length ? `<h2 class="cap-titre-section">À photographier</h2><div class="cap-liste">${sansPhoto.map(ligneEleve).join('')}</div>` : ''}
      ${avec.length ? `<h2 class="cap-titre-section">Déjà photographiés</h2><div class="cap-liste">${avec.map(ligneEleve).join('')}</div>` : ''}
      <button type="button" class="bouton principal cap-flottant" data-nouvel>${icone('plus')} Élève</button>`;
    lierEntete();
    lierLignes(racine);
    $('[data-nouvel]', racine).addEventListener('click', () => ouvrirFiche(null, f.classe_id));
  }

  /* ====================================================== Fiche d'un élève */

  let modaleOuverte = null;
  function fermerModale() { if (modaleOuverte) { modaleOuverte.remove(); modaleOuverte = null; } }
  function modale(titre, sousTitre, corps) {
    fermerModale();
    const fond = document.createElement('div');
    fond.className = 'modale-fond';
    fond.innerHTML = `<div class="modale" role="dialog" aria-modal="true" aria-labelledby="cap-modale-titre">
      <div class="modale-tete"><div style="flex:1;min-width:0"><h2 id="cap-modale-titre">${titre}</h2>${sousTitre ? `<p>${sousTitre}</p>` : ''}</div>
      <button type="button" class="cap-retour" data-fermer aria-label="Fermer">${icone('fermer')}</button></div>${corps}</div>`;
    fond.addEventListener('click', (e) => { if (e.target === fond || e.target.closest('[data-fermer]')) fermerModale(); });
    document.body.appendChild(fond);
    modaleOuverte = fond;
    return fond;
  }

  function champsFiche(e, classeParDefaut) {
    const v = (k) => (e ? e[k] : '') || '';
    const classes = resume.classes.filter((c) => c.dans_mon_perimetre !== false);
    const classeActuelle = e ? e.classe_id : (classeParDefaut || '');
    const champ = ([k, libelle, type, max]) => {
      if (type === 'sexe') {
        return `<label class="champ"><span>${libelle}</span><select name="sexe"><option value="">—</option>
          <option value="F" ${v('sexe') === 'F' ? 'selected' : ''}>Féminin</option><option value="M" ${v('sexe') === 'M' ? 'selected' : ''}>Masculin</option></select></label>`;
      }
      const valeur = type === 'date' ? String(v(k)).slice(0, 10) : v(k);
      return `<label class="champ"><span>${libelle}${k === 'nom' ? ' *' : ''}</span><input name="${k}" type="${type}" value="${esc(valeur)}"
        ${max ? `maxlength="${max}"` : ''} ${type === 'date' ? `max="${new Date().toISOString().slice(0, 10)}"` : ''} autocomplete="off" ${k === 'nom' ? 'required' : ''} /></label>`;
    };
    return `
      ${resume.classes.length ? `<label class="champ"><span>Classe${e ? '' : ' *'}</span><select name="classe_id">
        ${e ? '' : '<option value="">Choisir…</option>'}
        ${classes.map((c) => `<option value="${esc(c.id)}" ${c.id === classeActuelle ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}
        ${e && classeActuelle && !classes.some((c) => c.id === classeActuelle) ? `<option value="${esc(classeActuelle)}" selected>${esc(e.classe_nom || 'Classe actuelle')}</option>` : ''}
      </select></label>` : ''}
      <p class="cap-titre-section">Élève</p>
      <div class="cap-grille">${CHAMPS.slice(0, 8).map(champ).join('')}</div>
      <p class="cap-titre-section">Responsable</p>
      <div class="cap-grille">${CHAMPS.slice(8).map(champ).join('')}</div>`;
  }

  function lireFormulaire(form, avant) {
    const corps = {};
    for (const [k] of CHAMPS) {
      const el = form.elements[k];
      if (!el) continue;
      const val = el.value.trim();
      const ancien = avant ? String(avant[k] || '').slice(0, k === 'date_naissance' ? 10 : undefined) : '';
      if (!avant ? val : val !== ancien) corps[k] = val;
    }
    if (form.elements.classe_id) {
      const c = form.elements.classe_id.value;
      if (!avant ? c : c && c !== avant.classe_id) corps.classe_id = c;
    }
    return corps;
  }

  function ouvrirFiche(e, classeParDefaut) {
    const nouveau = !e;
    const m = modale(nouveau ? 'Enregistrer un élève' : esc(nomComplet(e)),
      nouveau ? 'Absent de la liste de l’école : saisissez-le, puis prenez sa photo.' : esc([e.matricule, e.classe_nom].filter(Boolean).join(' · ')),
      `${nouveau ? '' : `<div class="cap-fiche-photo"><div class="cap-cadre" id="cap-cadre">${e.photo_url ? `<img src="${esc(e.photo_url)}" alt="Photo de ${esc(nomComplet(e))}" referrerpolicy="no-referrer" />` : icone('profil')}</div>
        <button type="button" class="bouton principal plein" data-photo>${icone('appareil')} ${e.a_photo ? 'Reprendre la photo' : 'Prendre la photo'}</button>
        <p class="muet petit" style="margin:0;text-align:center">Visage centré, de face, sur fond clair. La photo est recadrée automatiquement.</p></div>`}
      <form novalidate>${champsFiche(e, classeParDefaut)}
        <div id="cap-doublons"></div>
        <div class="modale-pied">
          ${nouveau ? '' : `<button type="button" class="bouton discret" data-suivant>Suivant sans photo ${icone('suivant')}</button>`}
          <button type="submit" class="bouton ${nouveau ? 'principal' : 'secondaire'}">${nouveau ? 'Enregistrer l’élève' : 'Enregistrer la fiche'}</button>
        </div></form>`);
    const form = $('form', m);
    form.addEventListener('submit', (evt) => { evt.preventDefault(); enregistrerFiche(form, e, false); });
    if (!nouveau) {
      $('[data-photo]', m).addEventListener('click', () => choisirPhoto(e));
      $('[data-suivant]', m).addEventListener('click', () => suivantSansPhoto(e));
    }
  }

  async function enregistrerFiche(form, avant, confirmerDoublon) {
    const bouton = $('[type=submit]', form);
    const corps = lireFormulaire(form, avant);
    if (!avant && !corps.nom) { toast('Le nom de l’élève est obligatoire.', 'danger'); return; }
    if (!avant && form.elements.classe_id && !corps.classe_id) { toast('Choisissez la classe de l’élève.', 'danger'); return; }
    if (avant && !Object.keys(corps).length) { toast('Aucune modification.', ''); return; }
    if (confirmerDoublon) corps.confirmer_doublon = true;
    attente(bouton, true, 'Enregistrement…');
    try {
      const r = avant
        ? await api(`/eleves/${avant.id}`, { method: 'PATCH', body: corps })
        : await api('/eleves', { method: 'POST', body: corps });
      toast(r.message, 'succes');
      if (avant) {
        Object.assign(avant, r.eleve);
        if (vue.nom === 'classe') rendreClasse();
        attente(bouton, false);
      } else {
        resume.moi.eleves_crees += 1;
        resume.total.effectif += 1;
        const cl = resume.classes.find((c) => c.id === r.eleve.classe_id);
        if (cl) cl.effectif += 1;
        r.eleve.classe_nom = cl ? cl.nom : null;
        if (vue.nom === 'classe' && (vue.filtre.classe_id || null) === (r.eleve.classe_id || null)) { eleves.push(r.eleve); rendreClasse(); }
        else eleves.push(r.eleve);
        ouvrirFiche(r.eleve); // enchaîner sur la photo
      }
    } catch (err) {
      attente(bouton, false);
      if (err.ferme || err.session) return;
      if (err.code === 'DOUBLON_PROBABLE') {
        const zone = $('#cap-doublons', modaleOuverte);
        zone.innerHTML = `<div class="alerte attention">${esc(err.message)}</div>
          ${(err.corps.doublons || []).map((d) => `<div class="cap-doublon"><strong>${esc(nomComplet(d))}</strong> · ${esc(d.matricule || '')} · ${esc(d.classe_nom || 'sans classe')}${d.date_naissance ? ` · né(e) le ${esc(dateCourte(d.date_naissance))}` : ''}</div>`).join('')}
          <button type="button" class="bouton secondaire plein" data-homonyme style="margin-top:6px">C’est un autre enfant : enregistrer quand même</button>`;
        $('[data-homonyme]', zone).addEventListener('click', () => enregistrerFiche(form, avant, true));
        return;
      }
      toast(err.message, 'danger');
    }
  }

  function suivantSansPhoto(e) {
    const i = eleves.indexOf(e);
    const suivant = eleves.slice(i + 1).concat(eleves.slice(0, Math.max(0, i))).find((x) => !x.a_photo && x !== e);
    if (suivant) ouvrirFiche(suivant);
    else { fermerModale(); toast('Tous les élèves de cette liste ont une photo.', 'succes'); }
  }

  /* ============================================================ Photo */

  let eleveEnPhoto = null;
  const entree = $('#cap-fichier');
  function choisirPhoto(e) {
    eleveEnPhoto = e;
    entree.value = '';
    entree.click();
  }
  entree.addEventListener('change', async () => {
    const fichier = entree.files && entree.files[0];
    const e = eleveEnPhoto;
    entree.value = '';
    if (!fichier || !e) return;
    const cadre = $('#cap-cadre');
    const bouton = modaleOuverte ? $('[data-photo]', modaleOuverte) : null;
    attente(bouton, true, 'Préparation…');
    let blob;
    try {
      blob = await preparerPhoto(fichier);
    } catch (err) {
      attente(bouton, false);
      toast('Cette image ne peut pas être lue. Reprenez la photo.', 'danger');
      return;
    }
    const apercu = URL.createObjectURL(blob);
    if (cadre) cadre.innerHTML = `<img src="${apercu}" alt="" /><div class="cap-envoi">Envoi…</div>`;
    if (bouton) bouton.textContent = 'Envoi de la photo…';
    try {
      const avaitPhoto = e.a_photo;
      const r = await api(`/eleves/${e.id}/photo`, { method: 'POST', binaire: blob, type: 'image/jpeg' });
      Object.assign(e, r.eleve);
      if (!avaitPhoto) {
        resume.total.avec_photo += 1;
        resume.moi.eleves_photographies += 1;
        const cl = resume.classes.find((c) => c.id === e.classe_id);
        if (cl) cl.avec_photo += 1;
      }
      toast(r.message, 'succes');
      if (vue.nom === 'classe') rendreClasse();
      // Enchaîner : élève suivant sans photo, s'il y en a un.
      const reste = eleves.some((x) => !x.a_photo);
      if (reste && vue.nom === 'classe') suivantSansPhoto(e); else ouvrirFiche(e);
    } catch (err) {
      if (err.ferme || err.session) return;
      if (cadre) { const voile = $('.cap-envoi', cadre); if (voile) voile.textContent = 'Échec de l’envoi'; }
      attente(bouton, false);
      toast(err.message, 'danger');
    } finally {
      setTimeout(() => URL.revokeObjectURL(apercu), 30000);
    }
  });

  /** Recadre au centre en 3:4, réduit à 600×800 et compresse en JPEG. */
  async function preparerPhoto(fichier) {
    const image = await new Promise((ok, ko) => {
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('illisible')); };
      img.src = url;
    });
    const ratio = PHOTO.largeur / PHOTO.hauteur;
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;
    if (!sw || !sh) throw new Error('illisible');
    let sx = 0;
    let sy = 0;
    if (sw / sh > ratio) { const l = sh * ratio; sx = (sw - l) / 2; sw = l; } else { const h = sw / ratio; sy = (sh - h) / 2.5; sh = h; }
    const canvas = document.createElement('canvas');
    canvas.width = PHOTO.largeur;
    canvas.height = PHOTO.hauteur;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, sx, Math.max(0, sy), sw, sh, 0, 0, canvas.width, canvas.height);
    return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('compression'))), 'image/jpeg', PHOTO.qualite));
  }

  /* ============================================================ Fin */

  function modaleTerminer() {
    const m = modale(EQUIPE ? 'Terminer la campagne' : 'Terminer ma part',
      EQUIPE ? 'L’accès de tous les partenaires se ferme ; la mission passe en vérification.' : 'Votre accès à la liste des élèves se fermera aussitôt.',
      `<form novalidate>
        <fieldset class="liste-controle"><legend>Ce qui a été fait</legend>
          ${CHECKLIST.map(([k, l]) => `<label class="case"><input type="checkbox" name="${k}" /><span>${esc(l)}</span></label>`).join('')}</fieldset>
        <label class="champ"><span>Déroulement</span><textarea name="compte_rendu" maxlength="4000" required
          placeholder="Classes faites, élèves absents, fiches que l’école doit compléter, remarques…"></textarea></label>
        <div class="modale-pied"><button type="button" class="bouton discret" data-fermer>Annuler</button>
          <button type="submit" class="bouton principal">${EQUIPE ? 'Terminer la campagne' : 'Terminer ma part'}</button></div></form>`);
    $('form', m).addEventListener('submit', async (evt) => {
      evt.preventDefault();
      const f = evt.currentTarget;
      const bouton = $('[type=submit]', f);
      if (f.compte_rendu.value.trim().length < 20) { toast('Décrivez le déroulement en quelques phrases.', 'danger'); return; }
      if (!window.confirm(EQUIPE ? 'Terminer la campagne pour toute l’équipe ?' : 'Terminer votre part ? Vous ne pourrez plus ouvrir la liste des élèves.')) return;
      attente(bouton, true, 'Envoi…');
      try {
        const r = await api('/terminer', { method: 'POST', body: { compte_rendu: f.compte_rendu.value, checklist: Object.fromEntries(CHECKLIST.map(([k]) => [k, f[k].checked])) } });
        ecranFerme(r.message);
      } catch (err) { attente(bouton, false); if (!err.ferme && !err.session) toast(err.message, 'danger'); }
    });
  }

  /* ============================================================ Démarrage */

  // Rien ne doit survivre à la page : ni dans l'historique (bfcache), ni ailleurs.
  window.addEventListener('pagehide', oublier);
  window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });

  if (!/^[0-9a-f-]{36}$/i.test(MISSION)) {
    ecranFerme('Lien incomplet : ouvrez la campagne depuis vos missions.');
  } else {
    afficherClasses(true).catch((e) => {
      if (!e.ferme && !e.session) {
        racine.innerHTML = `<div class="cap-ferme"><p>${esc(e.message)}</p><p><button type="button" class="bouton principal" id="cap-reessayer">Réessayer</button></p></div>`;
        $('#cap-reessayer').addEventListener('click', () => location.reload());
      }
    });
  }
})();
