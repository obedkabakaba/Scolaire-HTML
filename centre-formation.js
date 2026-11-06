/* ==========================================================================
   ARDOISE — ESPACE CENTRE DE FORMATION (centre-formation.html)
   --------------------------------------------------------------------------
   Une seule page, des rubriques adressées par l'ancre (#/apprenants…), un
   menu qui dépend du rôle :
     directeur   chef de centre — tout
     prefet      adjoint pédagogique — tout sauf les finances
     secretaire  accueil — apprenants, groupes, appel, demandes, encaissements
     comptable   caisse — tableau de bord, finances
     professeur  coach — son espace, SES groupes, appel, leçons, évaluations

   Le serveur décide de tout (rôles, périmètre du coach, cloisonnement) ;
   ce fichier n'affiche que ce qu'il reçoit. Tout texte passe par e().
   ========================================================================== */
(function () {
  'use strict';

  var S = window.ArdoiseSession;
  if (!S || !S.connecte()) { window.location.replace('connexion.html'); return; }

  var etat = { ctx: null, roles: [], cache: {}, route: '' };
  // Toutes les routes de cet espace vivent sous /formation (routes/formation.routes.js).
  var PREFIXE_API = '/formation';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------------ */
  /*  Outils                                                             */
  /* ------------------------------------------------------------------ */
  function e(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function urlSure(v) { return typeof v === 'string' && /^https?:\/\//i.test(v.trim()) ? v.trim() : null; }
  function nombre(v, d) {
    if (v === null || v === undefined || v === '' || isNaN(Number(v))) return '—';
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d == null ? 1 : d }).format(Number(v));
  }
  function argent(v, devise) {
    if (v === null || v === undefined || v === '') return '—';
    var n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(v) || 0);
    return (devise || deviseCentre()) === 'FC' ? n + ' FC' : n + ' $';
  }
  function pct(v) { return v === null || v === undefined ? '—' : nombre(v, 0) + ' %'; }
  function dateFr(v, long) {
    if (!v) return '—';
    var d = new Date(String(v).length === 10 ? v + 'T00:00:00' : v);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('fr-FR', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function heure(v) { return v ? String(v).slice(0, 5) : ''; }
  function aujourdhui(decalage) { var d = new Date(Date.now() + (decalage || 0) * 86400000); return d.toISOString().slice(0, 10); }
  function nomComplet(o) { return [o.prenom, o.nom].filter(Boolean).join(' ') || o.nom || '—'; }
  function deviseCentre() { return (etat.ctx && etat.ctx.centre.devise) || 'USD'; }
  function a(role) { return etat.roles.indexOf(role) !== -1; }
  function unDe() { for (var i = 0; i < arguments.length; i++) if (a(arguments[i])) return true; return false; }
  function coachSeul() { return !!(etat.ctx && etat.ctx.moi.coach_seulement); }
  function tel(v) { return String(v || '').replace(/[^\d+]/g, ''); }
  function lienWhatsApp(telephone, texte) {
    var n = tel(telephone).replace(/^\+/, '');
    if (!n) return null;
    if (n.length === 9) n = '243' + n;
    if (n.charAt(0) === '0') n = '243' + n.slice(1);
    return 'https://wa.me/' + n + (texte ? '?text=' + encodeURIComponent(texte) : '');
  }
  var LIBELLES = {
    statut_apprenant: { prospect: 'Prospect', actif: 'Actif', en_pause: 'En pause', termine: 'Terminé', abandon: 'Abandon' },
    statut_groupe: { planifie: 'Planifié', en_cours: 'En cours', termine: 'Terminé', annule: 'Annulé' },
    statut_seance: { prevue: 'Prévue', faite: 'Donnée', annulee: 'Annulée', reportee: 'Reportée' },
    mode: { presentiel: 'Présentiel', en_ligne: 'En ligne', hybride: 'Hybride' },
    type_eval: { placement: 'Test de placement', quiz: 'Quiz', mi_parcours: 'Mi-parcours', final: 'Examen final', oral: 'Oral' },
    paiement: { especes: 'Espèces', mobile_money: 'Mobile money', banque: 'Banque', carte: 'Carte', autre: 'Autre' },
    depense: { salaire_coach: 'Paie des coachs', salaire_personnel: 'Salaires du personnel', loyer: 'Loyer', materiel: 'Matériel', marketing: 'Publicité', internet: 'Internet', electricite: 'Électricité', transport: 'Transport', taxes: 'Taxes', autre: 'Autre' },
    competence: { general: 'Général', oral: 'Expression orale', ecrit: 'Expression écrite', comprehension_orale: 'Compréhension orale', comprehension_ecrite: 'Compréhension écrite', grammaire: 'Grammaire', vocabulaire: 'Vocabulaire', prononciation: 'Prononciation' },
    risque: { faible: 'Faible', moyen: 'Moyen', eleve: 'Élevé' },
    appreciation: { excellent: 'Excellent', bon: 'Bon', a_suivre: 'À suivre', critique: 'Critique', non_mesure: 'Non mesuré' },
    demande: { preinscription: 'Préinscription', test_niveau: 'Test de niveau', contact: 'Message', rendez_vous: 'Rendez-vous' },
    statut_inscription: { active: 'En cours', terminee: 'Terminée', abandon: 'Abandon', suspendue: 'Suspendue', attente: 'Liste d’attente' },
    statut_session: { preparation: 'En préparation', inscriptions: 'Inscriptions ouvertes', en_cours: 'En cours', cloturee: 'Clôturée' },
    decision: { niveau_suivant: 'Admis — niveau suivant', admis_fin_parcours: 'Admis — fin de parcours', refaire_niveau: 'Refaire le niveau', non_evalue: 'Non évalué', attente_precedente: 'Était en attente' },
    divers: { nouvelle: 'Nouvelle', en_cours: 'En cours', traitee: 'Traitée', archivee: 'Archivée', valide: 'Valide', revoque: 'Révoqué' }
  };
  function options(cle) { return Object.keys(LIBELLES[cle]).map(function (k) { return [k, LIBELLES[cle][k]]; }); }
  function badgeStatut(type, v) {
    var couleurs = { actif: 'vert', en_cours: 'vert', faite: 'vert', valide: 'vert', traitee: 'vert', active: 'vert', terminee: 'bleu',
      planifie: 'bleu', prevue: 'bleu', prospect: 'ambre', nouvelle: 'ambre', en_pause: 'ambre', reportee: 'ambre', en_cours_demande: 'bleu',
      abandon: 'rouge', annule: 'rouge', annulee: 'rouge', revoque: 'rouge', termine: '', attente: 'ambre', inscriptions: 'vert', preparation: 'bleu', cloturee: '' };
    var lib = (LIBELLES[type] && LIBELLES[type][v]) || LIBELLES.divers[v] || v || '—';
    return '<span class="cf-badge ' + (couleurs[v] || '') + '">' + e(lib) + '</span>';
  }
  function jauge(v, neutre) {
    if (v === null || v === undefined) return '<span class="doux">—</span>';
    var cls = neutre ? '' : v >= 80 ? 'bon' : v >= 60 ? 'moyen' : 'faible';
    return '<div style="display:flex;align-items:center;gap:8px"><div class="cf-jauge ' + cls + '" style="flex:1"><span style="width:' + Math.max(2, Math.min(100, v)) + '%"></span></div><span style="font-size:.8rem;min-width:38px;text-align:right">' + nombre(v, 0) + ' %</span></div>';
  }

  function api(chemin, opts) {
    return S.appelApi(PREFIXE_API + chemin, opts).then(function (r) {
      if (r.status === 204) return null;
      return r.json().catch(function () { return {}; }).then(function (corps) {
        if (!r.ok) {
          var msg = (corps && corps.message) || 'Erreur ' + r.status;
          // Fonction réservée à une offre supérieure : dire laquelle et où la prendre.
          if (corps && corps.code === 'offre_insuffisante') msg += ' Elle est comprise dans Formation Pro et Premium : menu Abonnement (chef de centre).';
          var err = new Error(msg);
          err.status = r.status; err.code = corps && corps.code; throw err;
        }
        return corps;
      });
    });
  }
  function envoyer(chemin, methode, corps) { return api(chemin, { method: methode, body: corps || {} }); }

  function toast(texte, erreur) {
    var t = document.createElement('div');
    t.className = 'cf-toast' + (erreur ? ' erreur' : '');
    t.setAttribute('role', 'status');
    t.textContent = texte;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, erreur ? 6000 : 3500);
  }
  function echec(err) { toast((err && err.message) || 'Une erreur est survenue.', true); }

  /* Modale : renvoie { el, fermer }. Les boutons portent data-action. */
  function modale(titre, corps, opts) {
    opts = opts || {};
    var v = document.createElement('div');
    v.className = 'cf-voile';
    v.innerHTML = '<div class="cf-modale' + (opts.large ? ' large' : '') + '" role="dialog" aria-modal="true" aria-label="' + e(titre) + '">' +
      '<header><h2>' + e(titre) + '</h2><button type="button" data-fermer aria-label="Fermer">×</button></header>' +
      '<div class="corps">' + corps + '</div>' +
      (opts.pied ? '<footer>' + opts.pied + '</footer>' : '') + '</div>';
    document.body.appendChild(v);
    function fermer() { v.remove(); document.removeEventListener('keydown', echap); }
    function echap(ev) { if (ev.key === 'Escape') fermer(); }
    document.addEventListener('keydown', echap);
    v.addEventListener('click', function (ev) { if (ev.target === v || ev.target.hasAttribute('data-fermer')) fermer(); });
    var premier = v.querySelector('input,select,textarea'); if (premier) setTimeout(function () { premier.focus(); }, 30);
    return { el: v, fermer: fermer };
  }

  /* Formulaires déclaratifs. */
  function champ(c, valeurs) {
    var v = valeurs && valeurs[c.nom] !== undefined && valeurs[c.nom] !== null ? valeurs[c.nom] : (c.defaut !== undefined ? c.defaut : '');
    var attr = ' name="' + e(c.nom) + '"' + (c.requis ? ' required' : '') + (c.placeholder ? ' placeholder="' + e(c.placeholder) + '"' : '');
    var html;
    if (c.type === 'select') {
      html = '<select' + attr + '>' + (c.vide !== false ? '<option value="">' + e(c.vide || '—') + '</option>' : '') +
        c.options.map(function (o) { return '<option value="' + e(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + e(o[1]) + '</option>'; }).join('') + '</select>';
    } else if (c.type === 'textarea') {
      html = '<textarea' + attr + ' rows="' + (c.lignes || 4) + '">' + e(v) + '</textarea>';
    } else if (c.type === 'case') {
      return '<label class="case' + (c.plein ? ' plein' : '') + '"><input type="checkbox" name="' + e(c.nom) + '"' + (v === true || v === 'true' ? ' checked' : '') + '> ' + e(c.libelle) + '</label>';
    } else {
      var type = { nombre: 'number', date: 'date', heure: 'time', email: 'email', tel: 'tel', url: 'url' }[c.type] || 'text';
      var val = c.type === 'date' && v ? String(v).slice(0, 10) : c.type === 'heure' && v ? String(v).slice(0, 5) : v;
      html = '<input type="' + type + '"' + attr + (c.type === 'nombre' ? ' step="' + (c.pas || 'any') + '" min="' + (c.min != null ? c.min : 0) + '"' : '') + ' value="' + e(val) + '">';
    }
    return '<label class="' + (c.plein ? 'plein' : '') + '">' + e(c.libelle) + (c.requis ? ' *' : '') + html + (c.aide ? '<span class="aide">' + e(c.aide) + '</span>' : '') + '</label>';
  }
  function formulaire(champs, valeurs) { return '<form class="cf-form" novalidate>' + champs.map(function (c) { return champ(c, valeurs); }).join('') + '</form>'; }
  function lire(form, champs) {
    var o = {};
    champs.forEach(function (c) {
      var el = form.elements[c.nom]; if (!el) return;
      if (c.type === 'case') o[c.nom] = el.checked;
      else if (c.type === 'nombre') o[c.nom] = el.value === '' ? null : Number(el.value);
      else o[c.nom] = el.value.trim() === '' ? null : el.value.trim();
    });
    return o;
  }
  /** Modale avec formulaire : `envoi(donnees)` renvoie une promesse. */
  function modaleFormulaire(titre, champs, valeurs, envoi, opts) {
    opts = opts || {};
    var m = modale(titre, (opts.avant || '') + formulaire(champs, valeurs) + (opts.apres || ''), {
      large: opts.large,
      pied: '<button class="cf-btn" data-fermer type="button">Annuler</button><button class="cf-btn principal" data-valider type="button">' + e(opts.bouton || 'Enregistrer') + '</button>'
    });
    var form = $('form', m.el);
    var bouton = $('[data-valider]', m.el);
    function valider() {
      var d = lire(form, champs);
      var manquant = champs.filter(function (c) { return c.requis && (d[c.nom] === null || d[c.nom] === ''); })[0];
      if (manquant) { toast('« ' + manquant.libelle + ' » est requis.', true); form.elements[manquant.nom].focus(); return; }
      bouton.disabled = true;
      Promise.resolve(envoi(d, m)).then(function (r) { if (r !== false) m.fermer(); }).catch(echec).then(function () { bouton.disabled = false; });
    }
    bouton.addEventListener('click', valider);
    form.addEventListener('submit', function (ev) { ev.preventDefault(); valider(); });
    return m;
  }

  function tableau(colonnes, lignes, opts) {
    opts = opts || {};
    if (!lignes.length) return '<div class="cf-vide"><strong>' + e(opts.videTitre || 'Rien pour le moment') + '</strong>' + e(opts.vide || '') + '</div>';
    return '<div class="cf-table-zone"><table class="cf-table"><thead><tr>' + colonnes.map(function (c) { return '<th' + (c.num ? ' class="num"' : '') + '>' + e(c.titre) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      lignes.map(function (l, i) {
        return '<tr' + (opts.clic ? ' class="cliquable" data-index="' + i + '"' : '') + '>' + colonnes.map(function (c) { return '<td' + (c.num ? ' class="num"' : '') + '>' + c.rendu(l) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function brancherClic(zone, lignes, fn) {
    $$('tr.cliquable', zone).forEach(function (tr) {
      tr.addEventListener('click', function (ev) { if (ev.target.closest('a,button')) return; fn(lignes[Number(tr.getAttribute('data-index'))]); });
    });
  }
  function kpi(libelle, valeur, detail, cls) {
    return '<div class="cf-kpi"><div class="libelle">' + e(libelle) + '</div><div class="valeur">' + valeur + '</div>' + (detail ? '<div class="detail ' + (cls || '') + '">' + detail + '</div>' : '') + '</div>';
  }
  function page(titre, sousTitre, actions, corps) {
    $('#cf-principal').innerHTML = '<div class="cf-entete"><div><h1>' + e(titre) + '</h1>' + (sousTitre ? '<p>' + sousTitre + '</p>' : '') + '</div><div class="cf-actions">' + (actions || '') + '</div></div><div id="cf-contenu">' + (corps || '<div class="cf-chargement">Chargement…</div>') + '</div>';
    return $('#cf-contenu');
  }
  function charger(cle, chemin, forcer) {
    if (!forcer && etat.cache[cle]) return Promise.resolve(etat.cache[cle]);
    return api(chemin).then(function (d) { etat.cache[cle] = d; return d; });
  }
  function oublier() { for (var i = 0; i < arguments.length; i++) delete etat.cache[arguments[i]]; }

  /* ------------------------------------------------------------------ */
  /*  Navigation                                                         */
  /* ------------------------------------------------------------------ */
  var IC = {
    sessions: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/><circle cx="18.5" cy="18" r="2.5"/>',
    tableau: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    moi: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    apprenants: '<path d="M12 4 2 9l10 5 10-5z"/><path d="M6 11.5V17c0 1.5 3 3 6 3s6-1.5 6-3v-5.5"/>',
    groupes: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5a3 3 0 0 1 0 6"/><path d="M18 20a5 5 0 0 0-3-4.6"/>',
    seances: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="m9 15 2 2 4-4"/>',
    lecons: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z"/><path d="m10 8 4 2.5-4 2.5z"/>',
    evaluations: '<path d="M4 20h4L18 10a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5 17.5 10.5"/>',
    certificats: '<circle cx="12" cy="9" r="5"/><path d="m8.5 13.5-1.5 7.5 5-3 5 3-1.5-7.5"/>',
    coachs: '<path d="M3 20h18"/><rect x="5" y="11" width="3" height="7"/><rect x="10.5" y="7" width="3" height="11"/><rect x="16" y="4" width="3" height="14"/>',
    programmes: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>',
    finances: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10"/><path d="M14.5 9.5A2.5 2.5 0 0 0 12 8.5h-.5a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4H12a2.5 2.5 0 0 1-2.5-1"/>',
    demandes: '<path d="M4 4h16v12H5.2L4 17.5z"/><path d="M8 9h8"/><path d="M8 12h5"/>',
    assistant: '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
    site: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18"/><path d="M12 3a15 15 0 0 0 0 18"/>',
    calendrier: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M7 13h2"/><path d="M11 13h2"/><path d="M15 13h2"/><path d="M7 17h2"/><path d="M11 17h2"/>',
    reglages: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
  };
  var NAV = [
    ['tableau', 'Tableau de bord', ['directeur', 'prefet', 'comptable']],
    ['sessions', 'Sessions', ['directeur', 'prefet', 'secretaire', 'comptable']],
    ['moi', 'Mon espace coach', ['professeur']],
    ['apprenants', 'Apprenants', ['directeur', 'prefet', 'secretaire', 'comptable', 'professeur']],
    ['groupes', 'Groupes', ['directeur', 'prefet', 'secretaire', 'comptable', 'professeur']],
    ['seances', 'Planning et appel', ['directeur', 'prefet', 'secretaire', 'professeur']],
    ['calendrier', 'Calendrier', ['directeur', 'prefet', 'secretaire', 'comptable', 'professeur']],
    ['lecons', 'Leçons en ligne', ['directeur', 'prefet', 'professeur']],
    ['evaluations', 'Évaluations', ['directeur', 'prefet', 'secretaire', 'professeur']],
    ['certificats', 'Certificats', ['directeur', 'prefet', 'secretaire']],
    ['coachs', 'Coachs et KPI', ['directeur', 'prefet']],
    ['programmes', 'Programmes', ['directeur', 'prefet']],
    ['finances', 'Finances', ['directeur', 'comptable', 'secretaire']],
    ['demandes', 'Demandes du site', ['directeur', 'prefet', 'secretaire']],
    ['assistant', 'Assistant IA', ['directeur', 'prefet', 'secretaire', 'professeur']],
    ['site', 'Site du centre', ['directeur', 'prefet']],
    ['reglages', 'Réglages du centre', ['directeur', 'prefet']]
  ];
  function libelleNav(n) {
    var L = { moi: 'Mon espace ' + voc('coach', 'coach').toLowerCase(), apprenants: voc('apprenants', 'Apprenants'), groupes: voc('groupes', 'Groupes'),
      sessions: voc('sessions', 'Sessions'), coachs: voc('coachs', 'Coachs') + ' et KPI' };
    return L[n[0]] || n[1];
  }
  function rubriquesPermises() {
    return NAV.filter(function (n) {
      if (n[0] === 'moi') return a('professeur');
      if (n[0] === 'sessions' && cfg().fonctionnement && cfg().fonctionnement.sessions === false) return false;
      // Accès ouverts par le chef de centre (Réglages) : la rubrique apparaît.
      if (n[0] === 'finances' && ((a('prefet') && acces('adjoint_finances')) || (a('professeur') && acces('coach_encaisse')))) return true;
      return n[2].some(a);
    });
  }
  function accueil() {
    if (coachSeul()) return 'moi';
    if (unDe('directeur', 'prefet', 'comptable')) return 'tableau';
    return 'apprenants';
  }
  function dessinerRail() {
    var c = etat.ctx;
    $('#cf-centre').innerHTML = '<strong>' + e(c.centre.nom) + '</strong><span>' + e(c.centre.domaine_libelle) + (c.centre.ville ? ' · ' + e(c.centre.ville) : '') + '</span>';
    $('#cf-nav').innerHTML = rubriquesPermises().map(function (n) {
      var pastille = n[0] === 'demandes' && c.compteurs.demandes_nouvelles ? '<span class="pastille">' + c.compteurs.demandes_nouvelles + '</span>' : '';
      if (n[0] === 'calendrier' && c.compteurs.rappels_a_envoyer && unDe('directeur', 'prefet', 'secretaire')) pastille = '<span class="pastille" title="Rappels WhatsApp à envoyer">' + c.compteurs.rappels_a_envoyer + '</span>';
      return '<li><a href="#/' + n[0] + '" data-route="' + n[0] + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + IC[n[0]] + '</svg>' + e(libelleNav(n)) + pastille + '</a></li>';
    }).join('');
    var bas = '<a href="messages.html">Messages</a>';
    if (a('directeur')) bas += '<a href="parametres.html">Paramètres du centre</a><a href="utilisateurs.html">Comptes du personnel</a><a href="abonnements.html">Abonnement</a>';
    bas += '<a href="mon-profil.html">Mon profil</a><a href="support.html">Aide et support</a><button type="button" id="cf-deconnexion">↩ Se déconnecter</button>';
    $('#cf-rail-bas').innerHTML = bas;
    if (!$('#cf-aide')) {
      var ba = document.createElement('button');
      ba.id = 'cf-aide'; ba.className = 'cf-aide'; ba.type = 'button'; ba.setAttribute('aria-label', 'Aide et tutoriels'); ba.textContent = '?';
      ba.addEventListener('click', aideEcran);
      document.body.appendChild(ba);
    }
    $('#cf-deconnexion').addEventListener('click', function () {
      var rt = S.lire('ardoise_refresh_token');
      fetch(S.baseAPI() + '/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: rt }) })
        .catch(function () {}).then(function () { S.terminer(); });
    });
  }

  var ROUTES = {};
  function naviguer() {
    var route = (window.location.hash.replace(/^#\/?/, '').split('?')[0]) || accueil();
    var permises = rubriquesPermises().map(function (n) { return n[0]; });
    // La salle virtuelle s'ouvre depuis une séance ; elle n'est pas au menu.
    if (unDe('directeur', 'prefet', 'secretaire', 'professeur')) permises.push('salle');
    if (permises.indexOf(route) === -1) route = accueil();
    etat.route = route;
    $$('#cf-nav a').forEach(function (l) { l.classList.toggle('actif', l.getAttribute('data-route') === route); });
    $('#cf-rail').classList.remove('ouvert');
    document.title = 'Ardoise — ' + ((NAV.filter(function (n) { return n[0] === route; })[0] || [])[1] || 'Centre de formation');
    window.scrollTo(0, 0);
    try { ROUTES[route](); astucePremiereVisite(); } catch (err) { console.error(err); echec(err); }
  }

  /* ------------------------------------------------------------------ */
  /*  Tableau de bord du chef de centre                                  */
  /* ------------------------------------------------------------------ */
  ROUTES.tableau = function () {
    var z = page('Tableau de bord', 'Ce qui se passe dans votre centre, et ce qui demande votre attention aujourd’hui.',
      (a('directeur') || a('prefet') ? '<button class="cf-btn" data-analyse>✦ Analyse IA du centre</button>' : '') +
      (unDe('directeur', 'prefet', 'secretaire') ? '<a class="cf-btn principal" href="#/apprenants?nouveau">+ Nouvel apprenant</a>' : ''));
    var b = $('[data-analyse]'); if (b) b.addEventListener('click', function () { window.location.hash = '#/assistant?analyse'; });
    Promise.all([api('/tableau-de-bord'), a('directeur') || a('comptable') ? api('/bilan?mois=6').catch(function () { return null; }) : Promise.resolve(null)]).then(function (r) {
      var d = r[0], bilan = r[1], k = d.chiffres, dv = d.devise;
      var evol = k.encaisse_mois_precedent > 0 ? Math.round((k.encaisse_mois - k.encaisse_mois_precedent) / k.encaisse_mois_precedent * 100) : null;
      var html = carteDemarrage() + (cfg().fonctionnement && cfg().fonctionnement.sessions === false ? '' : banniereSessions(d));
      html += '<div class="cf-grille-kpi">' +
        kpi('Apprenants actifs', nombre(k.apprenants_actifs, 0), '+' + k.nouveaux_30j + ' sur 30 jours' + (k.prospects ? ' · ' + k.prospects + ' prospect(s)' : '')) +
        kpi('Groupes en cours', nombre(k.groupes_en_cours, 0), k.groupes_planifies + ' planifié(s) · ' + k.coachs_actifs + ' coach(s)') +
        kpi('Assiduité (30 j)', pct(k.taux_presence_30j), k.seances_semaine_faites + '/' + k.seances_semaine + ' séances cette semaine') +
        kpi('Satisfaction (90 j)', k.satisfaction_90j ? nombre(k.satisfaction_90j, 1) + ' / 5' : '—', k.avis_90j + ' avis d’apprenants') +
        (unDe('directeur', 'comptable') ? kpi('Encaissé ce mois', argent(k.encaisse_mois, dv), evol === null ? 'Mois précédent : ' + argent(k.encaisse_mois_precedent, dv) : (evol >= 0 ? '▲ ' : '▼ ') + Math.abs(evol) + ' % vs mois précédent', evol === null ? '' : evol >= 0 ? 'hausse' : 'baisse') +
          kpi('Résultat du mois', argent(k.resultat_mois, dv), 'Dépenses : ' + argent(k.depenses_mois, dv), k.resultat_mois >= 0 ? 'hausse' : 'baisse') +
          kpi('Reste à encaisser', argent(k.impayes, dv), 'Soldes des formations en cours') : '') +
        kpi('Heures données (mois)', nombre(k.heures_mois, 1) + ' h', k.seances_non_cloturees ? k.seances_non_cloturees + ' séance(s) sans appel' : 'Tous les appels sont faits', k.seances_non_cloturees ? 'baisse' : 'hausse') +
        kpi('Conversion du site (90 j)', pct(k.taux_conversion_90j), k.demandes_90j + ' demande(s) reçue(s)') +
        kpi('Abandons (90 j)', pct(k.taux_abandon_90j), k.apprenants_a_risque + ' apprenant(s) à risque élevé', k.apprenants_a_risque ? 'baisse' : '') +
        kpi('Réinscription', pct(k.taux_reinscription), d.derniere_session ? 'après « ' + e(d.derniere_session.nom) + ' »' : 'mesurée à la fin d’une session', k.taux_reinscription === null ? '' : k.taux_reinscription >= 60 ? 'hausse' : 'baisse') +
        kpi('Certificats délivrés', nombre(k.certificats, 0), k.lecons_publiees + ' leçon(s) en ligne publiée(s)') +
        '</div>';

      html += '<div class="cf-deux"><div>';
      html += '<div class="cf-carte"><h2>À faire aujourd’hui <small>' + d.alertes.length + ' point(s)</small></h2>' +
        (d.alertes.length ? d.alertes.map(function (al) {
          return '<div class="cf-alerte ' + e(al.niveau) + '"><b>' + e({ critique: 'Urgent', attention: 'Attention', info: 'Info' }[al.niveau]) + '</b><span>' + e(al.texte) + '</span>' + (al.lien ? '<a href="' + e(al.lien) + '">Voir</a>' : '') + '</div>';
        }).join('') : '<div class="cf-vide"><strong>Rien d’urgent</strong>Les appels sont faits et aucun apprenant n’est en alerte.</div>') + '</div>';
      html += '<div class="cf-carte"><h2>Prochaines séances <small>aujourd’hui et les 2 jours suivants</small></h2>' +
        tableau([
          { titre: 'Quand', rendu: function (s) { return e(dateFr(s.date_seance)) + ' <span class="doux">' + e(heure(s.heure_debut)) + '</span>'; } },
          { titre: 'Groupe', rendu: function (s) { return e(s.groupe_nom) + (s.salle ? ' <span class="doux">· ' + e(s.salle) + '</span>' : ''); } },
          { titre: 'Coach', rendu: function (s) { return e(s.coach_nom || '—'); } },
          { titre: '', rendu: function (s) { return '<button class="cf-btn petit" data-appel="' + e(s.id) + '">Appel</button>'; } }
        ], d.prochaines_seances, { videTitre: 'Aucune séance prévue', vide: 'Planifiez les séances depuis la rubrique Groupes.' }) + '</div>';
      html += '</div><div>';
      html += '<div class="cf-carte" data-risques><h2>Apprenants à risque d’abandon <small>à appeler cette semaine</small></h2>' +
        tableau([
          { titre: 'Apprenant', rendu: function (x) { return '<strong>' + e(nomComplet(x)) + '</strong><div class="doux">' + e(x.groupes || '') + '</div>'; } },
          { titre: 'Risque', rendu: function (x) { return '<span class="cf-badge ' + (x.indicateurs.risque.niveau === 'eleve' ? 'rouge' : 'ambre') + '">' + e(LIBELLES.risque[x.indicateurs.risque.niveau]) + ' · ' + x.indicateurs.risque.score + '</span><div class="doux">' + e(x.indicateurs.risque.raisons.join(' · ')) + '</div>'; } },
          { titre: '', rendu: function (x) { var w = lienWhatsApp(x.telephone, 'Bonjour ' + (x.prenom || x.nom) + ', ici ' + etat.ctx.centre.nom + '. Nous ne vous avons pas vu récemment : tout va bien ? Votre place vous attend.'); return w ? '<a class="cf-btn petit" target="_blank" rel="noopener" href="' + e(w) + '">WhatsApp</a>' : ''; } }
        ], d.a_risque, { clic: true, videTitre: 'Aucun apprenant en alerte', vide: 'L’assiduité, les paiements et la progression sont bons.' }) + '</div>';
      if (d.coachs.length) {
        html += '<div class="cf-carte"><h2>Coachs — score des 30 derniers jours <small><a href="#/coachs">Détail</a></small></h2>' + d.coachs.map(function (c) {
          var ind = c.indicateurs;
          return '<div style="display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid var(--cf-ligne)"><span class="cf-score ' + e(ind.appreciation) + '">' + (ind.score === null ? '—' : ind.score) + '</span><div style="flex:1;min-width:0"><strong>' + e(nomComplet(c)) + '</strong><div class="doux" style="font-size:.8rem">' + nombre(ind.heures_donnees) + ' h · présence ' + pct(ind.taux_presence) + ' · satisfaction ' + (ind.satisfaction_moyenne ? nombre(ind.satisfaction_moyenne, 1) + '/5' : '—') + '</div></div>' + badgeStatut('appreciation', ind.appreciation) + '</div>';
        }).join('') + '</div>';
      }
      html += '</div></div>';

      if (bilan) html += '<div class="cf-carte"><h2>Encaissements et dépenses — 6 derniers mois <small>en ' + e(bilan.devise) + '</small></h2>' + graphiqueMensuel(bilan) + '</div>';
      if (d.niveaux.length) {
        var max = Math.max.apply(null, d.niveaux.map(function (n) { return n.n; }));
        html += '<div class="cf-deux"><div class="cf-carte"><h2>Répartition par niveau</h2>' + d.niveaux.map(function (n) {
          return '<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px"><span style="width:90px;font-size:.84rem">' + e(n.niveau) + '</span><div class="cf-jauge" style="flex:1;height:10px"><span style="width:' + (n.n / max * 100) + '%"></span></div><span style="width:28px;text-align:right;font-size:.84rem">' + n.n + '</span></div>';
        }).join('') + '</div>';
        html += '<div class="cf-carte"><h2>Remplissage des groupes</h2>' + (d.remplissage.length ? d.remplissage.map(function (g) {
          var t = g.capacite ? Math.round(g.inscrits / g.capacite * 100) : null;
          return '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:.84rem"><span>' + e(g.nom) + '</span><span class="doux">' + g.inscrits + (g.capacite ? ' / ' + g.capacite : ' inscrits') + '</span></div>' + (t !== null ? jauge(t, true) : '') + '</div>';
        }).join('') : '<div class="cf-vide">Aucun groupe ouvert.</div>') + '</div></div>';
      }
      z.innerHTML = html;
      brancherDemarrage(z);
      $$('[data-appel]', z).forEach(function (bt) { bt.addEventListener('click', function () { ouvrirAppel(bt.getAttribute('data-appel')); }); });
      brancherClic($('[data-risques]', z), d.a_risque, function (x) { ficheApprenant(x.id); });
      brancherBulles(z);
    }).catch(function (err) { z.innerHTML = '<div class="cf-vide"><strong>Impossible de charger le tableau de bord</strong>' + e(err.message) + '</div>'; });
  };

  function banniereSessions(d) {
    var blocs = [];
    [['En cours', d.session_en_cours], ['Prochaine rentrée', d.prochaine_session]].forEach(function (x) {
      var s = x[1]; if (!s) return;
      var jours = s.jours_restants_inscription;
      blocs.push('<div class="cf-session-bandeau"><div><span class="cf-badge ' + (x[0] === 'En cours' ? 'vert' : 'bleu') + '">' + e(x[0]) + '</span><h3>' + e(s.nom) + '</h3><div class="doux">' + e(dateFr(s.date_debut)) + ' → ' + e(dateFr(s.date_fin)) + (jours !== null && jours >= 0 && x[0] !== 'En cours' ? ' · inscriptions closes dans ' + jours + ' j' : '') + '</div></div>' +
        '<div class="cf-session-chiffres"><div><b>' + s.inscrits + (s.places ? '<small>/' + s.places + '</small>' : '') + '</b>inscrits</div><div><b>' + pct(s.taux_remplissage) + '</b>remplissage</div>' + (s.objectif_inscrits ? '<div><b>' + pct(s.taux_objectif) + '</b>de l’objectif</div>' : '') + (s.en_attente ? '<div><b>' + s.en_attente + '</b>en attente</div>' : '') + '</div>' +
        '<a class="cf-btn petit" href="#/sessions">Gérer</a></div>');
    });
    if (!blocs.length) return '<div class="cf-encadre">Aucune session en cours ni à venir. <a href="#/sessions">Créez votre prochaine rentrée</a> : les groupes, les inscriptions et les réinscriptions s’organisent par session.</div>';
    return '<div class="cf-sessions-bandeaux">' + blocs.join('') + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /*  Sessions (rentrées)                                                 */
  /* ------------------------------------------------------------------ */
  var CHAMPS_SESSION = [
    { nom: 'nom', libelle: 'Nom de la session', requis: true, plein: true, placeholder: 'ex. Session de janvier 2027' },
    { nom: 'date_debut', libelle: 'Début des cours', type: 'date', requis: true }, { nom: 'date_fin', libelle: 'Fin des cours', type: 'date', requis: true },
    { nom: 'inscriptions_debut', libelle: 'Ouverture des inscriptions', type: 'date' }, { nom: 'inscriptions_fin', libelle: 'Clôture des inscriptions', type: 'date' },
    { nom: 'statut', libelle: 'Statut', type: 'select', vide: false, options: options('statut_session'), defaut: 'inscriptions' },
    { nom: 'objectif_inscrits', libelle: 'Objectif d’inscrits', type: 'nombre', pas: 1 },
    { nom: 'notes', libelle: 'Notes', type: 'textarea', plein: true, lignes: 2 }
  ];
  ROUTES.sessions = function () {
    var gere = unDe('directeur', 'prefet');
    var z = page('Sessions', 'Un centre vit par rentrées : chaque session a ses dates, ses inscriptions, ses groupes par niveau et ses examens. À la clôture, réinscrivez vos apprenants au niveau suivant.', gere ? '<button class="cf-btn principal" data-nouvelle>+ Nouvelle session</button>' : '');
    function lister() {
      api('/sessions').then(function (ss) {
        oublier('sessions');
        etat.cache.sessions = ss;
        z.innerHTML = ss.length ? '<div class="cf-cartes cf-cartes-sessions">' + ss.map(function (s) {
          var termine = s.statut === 'cloturee';
          return '<div class="cf-fiche"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><h3>' + e(s.nom) + '</h3><div class="meta">' + e(dateFr(s.date_debut)) + ' → ' + e(dateFr(s.date_fin)) +
            (s.inscriptions_fin ? '<br>Inscriptions jusqu’au ' + e(dateFr(s.inscriptions_fin)) : '') + '</div></div>' + badgeStatut('statut_session', s.statut) + '</div>' +
            '<div class="cf-mini"><div><b>' + s.inscrits + '</b>inscrits</div><div><b>' + s.groupes + '</b>groupe(s)</div><div><b>' + pct(s.taux_remplissage) + '</b>remplissage</div>' +
            '<div><b>' + argent(s.encaisse) + '</b>encaissé</div><div><b>' + argent(s.reste) + '</b>à encaisser</div><div><b>' + pct(s.taux_abandon) + '</b>abandons</div>' +
            (termine || s.taux_reussite !== null ? '<div><b>' + pct(s.taux_reussite) + '</b>réussite</div><div><b>' + pct(s.taux_reinscription) + '</b>réinscription</div><div><b>' + s.certifies + '</b>certifiés</div>' : '') + '</div>' +
            (s.objectif_inscrits ? '<div class="meta">Objectif : ' + s.objectif_inscrits + ' inscrits</div>' + jauge(s.taux_objectif, true) : '') +
            (s.en_attente ? '<div class="meta" style="color:var(--cf-ambre)">' + s.en_attente + ' apprenant(s) en liste d’attente</div>' : '') +
            '<div class="bas"><button class="cf-btn petit" data-detail="' + e(s.id) + '">Groupes</button>' +
            (gere ? '<button class="cf-btn petit" data-modifier="' + e(s.id) + '">Modifier</button>' : '') +
            (gere && !termine ? '<button class="cf-btn petit" data-cloturer="' + e(s.id) + '">Clôturer</button>' : '') +
            (gere ? '<button class="cf-btn petit" data-suivante="' + e(s.id) + '">Préparer la suivante</button>' : '') +
            (unDe('directeur', 'prefet', 'secretaire') && ss.some(function (x) { return x.statut !== 'cloturee' && String(x.date_debut) > String(s.date_debut); }) ? '<button class="cf-btn petit principal" data-reinscrire="' + e(s.id) + '">Réinscrire vers la suivante</button>' : '') + '</div></div>';
        }).join('') + '</div>' : '<div class="cf-vide"><strong>Aucune session</strong>Créez votre première rentrée (par exemple « Session de janvier »), puis rattachez-y vos groupes.</div>';
        var par = {}; ss.forEach(function (s) { par[s.id] = s; });
        $$('[data-detail]', z).forEach(function (b) { b.addEventListener('click', function () { detailSession(b.getAttribute('data-detail')); }); });
        $$('[data-modifier]', z).forEach(function (b) { b.addEventListener('click', function () { var s = par[b.getAttribute('data-modifier')]; modaleFormulaire('Modifier ' + s.nom, CHAMPS_SESSION, s, function (d) { return envoyer('/sessions/' + s.id, 'PATCH', d).then(function () { toast('Session enregistrée.'); lister(); }); }, { large: true }); }); });
        $$('[data-cloturer]', z).forEach(function (b) { b.addEventListener('click', function () {
          var s = par[b.getAttribute('data-cloturer')];
          if (!window.confirm('Clôturer « ' + s.nom + ' » ? Les groupes et les inscriptions en cours seront marqués terminés. Pensez d’abord à saisir les examens finaux et à délivrer les certificats.')) return;
          envoyer('/sessions/' + s.id + '/cloturer', 'POST').then(function (r) { toast('Session clôturée (' + r.groupes_termines + ' groupe(s)). Préparez maintenant la suivante et réinscrivez vos apprenants.'); oublier('groupes'); lister(); }).catch(echec);
        }); });
        $$('[data-suivante]', z).forEach(function (b) { b.addEventListener('click', function () {
          var s = par[b.getAttribute('data-suivante')];
          var debut = new Date(Date.parse(String(s.date_fin).slice(0, 10)) + 7 * 86400000);
          var duree = Date.parse(String(s.date_fin).slice(0, 10)) - Date.parse(String(s.date_debut).slice(0, 10));
          var iso = function (d) { return d.toISOString().slice(0, 10); };
          modaleFormulaire('Préparer la session suivante', CHAMPS_SESSION.filter(function (c) { return c.nom !== 'statut'; }), { date_debut: iso(debut), date_fin: iso(new Date(debut.getTime() + duree)), inscriptions_fin: iso(new Date(debut.getTime() - 86400000)), objectif_inscrits: s.objectif_inscrits }, function (d) {
            return envoyer('/sessions/' + s.id + '/preparer-suivante', 'POST', d).then(function (r) { toast(r.message); oublier('groupes'); lister(); });
          }, { large: true, bouton: 'Créer et recopier les groupes', avant: '<div class="cf-encadre">Les groupes de « ' + e(s.nom) + ' » (programme, coach, horaire, salle, capacité) sont recopiés dans la nouvelle session. Vous ajusterez ensuite, puis planifierez les séances.</div>' });
        }); });
        $$('[data-reinscrire]', z).forEach(function (b) { b.addEventListener('click', function () { assistantReinscription(par[b.getAttribute('data-reinscrire')], ss); }); });
      }).catch(function (err) { z.innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
    }
    var bn = $('[data-nouvelle]'); if (bn) bn.addEventListener('click', function () {
      modaleFormulaire('Nouvelle session', CHAMPS_SESSION, { statut: 'inscriptions' }, function (d) { return envoyer('/sessions', 'POST', d).then(function () { toast('Session créée. Rattachez-y vos groupes (rubrique Groupes).'); lister(); }); }, { large: true });
    });
    lister();
  };

  function detailSession(id) {
    var m = modale('Session', '<div class="cf-chargement">Chargement…</div>', { large: true });
    api('/sessions/' + id).then(function (d) {
      $('header h2', m.el).textContent = d.session.nom;
      $('.corps', m.el).innerHTML = tableau([
        { titre: 'Groupe', rendu: function (g) { return '<strong>' + e(g.nom) + '</strong><div class="doux">' + e([g.programme_nom, g.niveau].filter(Boolean).join(' · ')) + '</div>'; } },
        { titre: 'Coach', rendu: function (g) { return e(g.coach_nom || '—'); } },
        { titre: 'Horaire', rendu: function (g) { return e(g.horaire || '—'); } },
        { titre: 'Remplissage', rendu: function (g) { return g.inscrits + (g.capacite ? ' / ' + g.capacite : '') + (g.en_attente ? ' <span class="cf-badge ambre">+' + g.en_attente + ' en attente</span>' : ''); } },
        { titre: 'Statut', rendu: function (g) { return badgeStatut('statut_groupe', g.statut); } }
      ], d.groupes, { clic: true, videTitre: 'Aucun groupe dans cette session', vide: 'Créez un groupe en choisissant cette session, ou modifiez un groupe existant.' });
      brancherClic(m.el, d.groupes, function (g) { m.fermer(); detailGroupe(g.id); });
    }).catch(function (err) { $('.corps', m.el).innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
  }

  function assistantReinscription(source, sessions) {
    // On ne réinscrit que vers une session qui commence après celle-ci.
    var cibles = sessions.filter(function (s) { return s.id !== source.id && s.statut !== 'cloturee' && String(s.date_debut) > String(source.date_debut); });
    if (!cibles.length) { toast('Aucune session ne suit « ' + source.nom + ' » : créez-la d’abord (bouton « Préparer la suivante »).', true); return; }
    var m = modale('Réinscriptions — depuis « ' + source.nom + ' »', '<div class="cf-filtres"><label class="doux">Vers la session <select data-cible>' + cibles.map(function (s) { return '<option value="' + e(s.id) + '">' + e(s.nom) + '</option>'; }).join('') + '</select></label></div><div data-zone><div class="cf-chargement">Chargement…</div></div>',
      { large: true, pied: '<button class="cf-btn" data-fermer>Fermer</button><button class="cf-btn principal" data-valider>Réinscrire la sélection</button>' });
    var donnees = null;
    function charger_() {
      $('[data-zone]', m.el).innerHTML = '<div class="cf-chargement">Chargement…</div>';
      api('/sessions/' + source.id + '/reinscriptions?vers=' + $('[data-cible]', m.el).value).then(function (d) {
        donnees = d;
        var opts = '<option value="">— Ne pas réinscrire —</option>' + d.groupes_cible.map(function (g) { return '<option value="' + e(g.id) + '">' + e(g.nom + (g.programme_nom ? ' — ' + g.programme_nom : '') + (g.capacite ? ' (' + g.inscrits + '/' + g.capacite + ')' : '')) + '</option>'; }).join('');
        $('[data-zone]', m.el).innerHTML = (d.groupes_cible.length ? '' : '<div class="cf-encadre">La session cible n’a encore aucun groupe ouvert.</div>') +
          '<p class="doux" style="font-size:.84rem">Proposition automatique : admis (certificat, ou examen final ≥ ' + d.seuil_admission + '/100) → groupe du niveau suivant ; sinon, même niveau. Vous pouvez tout modifier. Un groupe complet place l’apprenant en liste d’attente.</p>' +
          (d.propositions.length ? '<div class="cf-table-zone"><table class="cf-table"><thead><tr><th><input type="checkbox" data-tous checked></th><th>Apprenant</th><th>Groupe actuel</th><th>Résultat</th><th>Proposition</th><th>Nouveau groupe</th></tr></thead><tbody>' + d.propositions.map(function (x, i) {
            return '<tr data-i="' + i + '"><td><input type="checkbox" data-coche' + (x.groupe_propose ? ' checked' : '') + '></td><td><strong>' + e(nomComplet(x)) + '</strong><div class="doux">' + e(x.matricule) + '</div></td><td>' + e(x.groupe_nom) + '<div class="doux">' + e(x.programme_nom || '') + '</div></td>' +
              '<td>' + (x.score_final !== null ? nombre(x.score_final, 0) + '/100' : '—') + (x.certifie ? ' <span class="cf-badge vert">Certifié</span>' : '') + '<div class="doux">présence ' + pct(x.taux_presence) + '</div></td>' +
              '<td><span class="cf-badge ' + (x.decision === 'niveau_suivant' ? 'vert' : x.decision === 'refaire_niveau' ? 'ambre' : '') + '">' + e(LIBELLES.decision[x.decision] || x.decision) + '</span>' + (x.programme_suivant_nom && x.decision === 'niveau_suivant' ? '<div class="doux">→ ' + e(x.programme_suivant_nom) + '</div>' : '') + '</td>' +
              '<td><select data-groupe style="padding:6px;border:1.5px solid var(--cf-ligne);border-radius:8px;max-width:240px">' + opts + '</select></td></tr>';
          }).join('') + '</tbody></table></div>' : '<div class="cf-vide"><strong>Tout le monde est déjà réinscrit</strong>ou aucun apprenant n’a suivi cette session.</div>');
        $$('tbody tr', m.el).forEach(function (tr) { var x = d.propositions[Number(tr.getAttribute('data-i'))]; $('[data-groupe]', tr).value = x.groupe_propose || ''; });
        var tous = $('[data-tous]', m.el); if (tous) tous.addEventListener('change', function () { $$('[data-coche]', m.el).forEach(function (c) { c.checked = tous.checked; }); });
      }).catch(function (err) { $('[data-zone]', m.el).innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
    }
    $('[data-cible]', m.el).addEventListener('change', charger_);
    $('[data-valider]', m.el).addEventListener('click', function () {
      if (!donnees) return;
      var lignes = $$('tbody tr', m.el).filter(function (tr) { return $('[data-coche]', tr).checked && $('[data-groupe]', tr).value; }).map(function (tr) {
        return { inscription_id: donnees.propositions[Number(tr.getAttribute('data-i'))].inscription_id, groupe_id: $('[data-groupe]', tr).value };
      });
      if (!lignes.length) { toast('Cochez au moins un apprenant et choisissez son groupe.', true); return; }
      envoyer('/sessions/' + source.id + '/reinscriptions', 'POST', { lignes: lignes }).then(function (r) {
        toast(r.message); oublier('groupes'); charger_();
        var b = $('[data-wa-relance]', m.el); if (b) b.remove();
      }).catch(echec);
    });
    charger_();
  }

  /* Graphique : deux séries (encaissements, dépenses), une échelle, légende,
     bulle au survol, et la table des valeurs juste dessous (accessibilité). */
  function graphiqueMensuel(b) {
    var max = Math.max(1, Math.max.apply(null, b.mensuel.map(function (m) { return Math.max(m.encaissements, m.depenses); })));
    var mois = function (m) { var d = new Date(m + '-01T00:00:00'); return d.toLocaleDateString('fr-FR', { month: 'short' }); };
    return '<div class="cf-legende"><span><i style="background:var(--serie-1)"></i>Encaissements</span><span><i style="background:var(--serie-2)"></i>Dépenses</span>' +
      (b.conversion_incomplete ? '<span>Montants dans l’autre devise non convertis : renseignez le taux de change.</span>' : '') + '</div>' +
      '<div class="cf-graphe" role="img" aria-label="Encaissements et dépenses par mois">' + b.mensuel.map(function (m) {
        var bulle = mois(m.mois) + ' — encaissé ' + argent(m.encaissements, b.devise) + ' · dépensé ' + argent(m.depenses, b.devise) + ' · résultat ' + argent(m.resultat, b.devise);
        return '<div class="mois"><div class="barres" data-bulle="' + e(bulle) + '"><div class="barre s1" style="height:' + (m.encaissements / max * 100) + '%"></div><div class="barre s2" style="height:' + (m.depenses / max * 100) + '%"></div></div></div>';
      }).join('') + '</div><div class="cf-axe">' + b.mensuel.map(function (m) { return '<span>' + e(mois(m.mois)) + '</span>'; }).join('') + '</div>' +
      '<details style="margin-top:10px"><summary class="doux" style="cursor:pointer;font-size:.82rem">Voir les valeurs</summary>' + tableau([
        { titre: 'Mois', rendu: function (m) { return e(mois(m.mois)) + ' ' + e(m.mois.slice(0, 4)); } },
        { titre: 'Encaissements', num: true, rendu: function (m) { return argent(m.encaissements, b.devise); } },
        { titre: 'Dépenses', num: true, rendu: function (m) { return argent(m.depenses, b.devise); } },
        { titre: 'Résultat', num: true, rendu: function (m) { return '<strong>' + argent(m.resultat, b.devise) + '</strong>'; } }
      ], b.mensuel) + '</details>';
  }
  function brancherBulles(zone) {
    var bulle = null;
    $$('[data-bulle]', zone).forEach(function (el) {
      el.addEventListener('mouseenter', function () { bulle = document.createElement('div'); bulle.className = 'cf-bulle'; bulle.textContent = el.getAttribute('data-bulle'); document.body.appendChild(bulle); });
      el.addEventListener('mousemove', function (ev) { if (bulle) { bulle.style.left = Math.min(window.innerWidth - 260, ev.clientX + 12) + 'px'; bulle.style.top = (ev.clientY - 44) + 'px'; } });
      el.addEventListener('mouseleave', function () { if (bulle) bulle.remove(); bulle = null; });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Espace coach                                                       */
  /* ------------------------------------------------------------------ */
  ROUTES.moi = function () {
    var z = page('Mon espace coach', 'Vos groupes, vos séances à venir, vos appels à faire et vos indicateurs.',
      '<a class="cf-btn" href="#/assistant">✦ Préparer une leçon avec l’IA</a><a class="cf-btn principal" href="#/seances">Planning et appel</a>');
    api('/moi').then(function (d) {
      var k = d.indicateurs || {};
      var aCloturer = d.seances.filter(function (s) { return s.statut !== 'faite' && s.date_seance <= aujourdhui(); });
      var html = '<div class="cf-grille-kpi">' +
        kpi('Mon score (30 j)', k.score === null || k.score === undefined ? '—' : k.score + ' / 100', LIBELLES.appreciation[k.appreciation] || '') +
        kpi('Heures données', nombre(k.heures_donnees) + ' h', k.objectif_heures_mois ? 'Objectif : ' + nombre(k.objectif_heures_mois) + ' h / mois' : (k.seances_faites || 0) + ' séance(s)') +
        kpi('Présence de mes apprenants', pct(k.taux_presence), (k.apprenants_actifs || 0) + ' apprenant(s) actif(s)') +
        kpi('Satisfaction', k.satisfaction_moyenne ? nombre(k.satisfaction_moyenne, 1) + ' / 5' : '—', (k.avis_nombre || 0) + ' avis') +
        kpi('Réalisation', pct(k.taux_realisation), (k.seances_annulees || 0) + ' annulée(s) · ' + (k.seances_non_cloturees || 0) + ' sans appel', k.seances_non_cloturees ? 'baisse' : '') +
        kpi('Progression moyenne', k.progression_moyenne === null || k.progression_moyenne === undefined ? '—' : (k.progression_moyenne >= 0 ? '+' : '') + nombre(k.progression_moyenne) + ' pts', 'entre première et dernière évaluation') +
        '</div>';
      if (aCloturer.length) html += '<div class="cf-encadre"><strong>' + aCloturer.length + ' séance(s) à clôturer.</strong> Faites l’appel : c’est ce qui compte vos heures et l’assiduité de vos apprenants.</div>';
      html += '<div class="cf-deux"><div class="cf-carte"><h2>Mes séances</h2>' + (d.seances.length ? '<div class="cf-chrono">' + d.seances.map(function (s) {
        var urgent = s.statut !== 'faite' && s.date_seance <= aujourdhui();
        return '<div class="item"><div class="date">' + e(dateFr(s.date_seance)) + '<br>' + e(heure(s.heure_debut)) + '</div><div><strong>' + e(s.groupe_nom) + '</strong> ' + badgeStatut('statut_seance', s.statut) +
          '<div class="doux" style="font-size:.82rem">' + e(s.theme || 'Thème à préciser') + (s.salle ? ' · ' + e(s.salle) : '') + '</div>' +
          '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"><button class="cf-btn petit' + (urgent ? ' principal' : '') + '" data-appel="' + e(s.id) + '">' + (s.statut === 'faite' ? 'Revoir l’appel' : 'Faire l’appel') + '</button>' +
          (['en_ligne', 'hybride', 'enregistre'].indexOf(s.mode) >= 0 ? '<a class="cf-btn petit" href="#/salle?s=' + e(s.id) + '">🎥 Salle virtuelle</a>' : (cfg().en_ligne && cfg().en_ligne.pointage_qr ? '<a class="cf-btn petit" href="#/salle?s=' + e(s.id) + '">▦ QR de présence</a>' : '')) + '</div></div></div>';
      }).join('') + '</div>' : '<div class="cf-vide"><strong>Aucune séance planifiée</strong>Le chef de centre planifie les séances de vos groupes.</div>') + '</div>';
      html += '<div><div class="cf-carte"><h2>Mes groupes</h2>' + tableau([
        { titre: 'Groupe', rendu: function (g) { return '<strong>' + e(g.nom) + '</strong><div class="doux">' + e(g.programme_nom || '') + '</div>'; } },
        { titre: 'Horaire', rendu: function (g) { return e(g.horaire || '—'); } },
        { titre: 'Inscrits', num: true, rendu: function (g) { return g.inscrits; } }
      ], d.groupes, { clic: true, videTitre: 'Aucun groupe attribué' }) + '</div>';
      html += '<div class="cf-carte"><h2>Mes apprenants à suivre</h2>' + tableau([
        { titre: 'Apprenant', rendu: function (x) { return '<strong>' + e(nomComplet(x)) + '</strong><div class="doux">' + e(x.indicateurs.risque.raisons.join(' · ')) + '</div>'; } },
        { titre: 'Présence', rendu: function (x) { return jauge(x.indicateurs.taux_presence); } }
      ], d.a_risque, { videTitre: 'Tout le monde suit', vide: 'Aucun de vos apprenants n’est en alerte.' }) + '</div>';
      html += blocSignatureCoach();
      html += '<div class="cf-carte"><h2>Avis récents de mes apprenants</h2>' + (d.avis.length ? d.avis.map(function (av) {
        return '<div style="padding:6px 0;border-bottom:1px solid var(--cf-ligne)"><strong>' + '★★★★★'.slice(0, av.note) + '<span class="doux">' + '★★★★★'.slice(av.note) + '</span></strong> <span class="doux">' + e(dateFr(av.created_at)) + ' · ' + e(av.groupe_nom || '') + '</span>' + (av.commentaire ? '<div style="font-size:.86rem">' + e(av.commentaire) + '</div>' : '') + '</div>';
      }).join('') : '<div class="cf-vide">Pas encore d’avis. Les apprenants notent leurs séances depuis leur espace.</div>') + '</div></div></div>';
      z.innerHTML = html;
      $$('[data-appel]', z).forEach(function (b) { b.addEventListener('click', function () { ouvrirAppel(b.getAttribute('data-appel'), ROUTES.moi); }); });
      $$('[data-televerser]', z).forEach(function (inp) { inp.addEventListener('change', function () { televerserIdentite(inp.getAttribute('data-televerser'), inp); }); });
      if ($('[data-apercu="signature"]', z)) chargerApercuDocument('signature', true);
      brancherClic(z, d.groupes, function (g) { detailGroupe(g.id); });
    }).catch(function (err) { z.innerHTML = '<div class="cf-vide"><strong>Impossible de charger votre espace</strong>' + e(err.message) + '</div>'; });
  };

  /* ------------------------------------------------------------------ */
  /*  Apprenants                                                         */
  /* ------------------------------------------------------------------ */
  var CHAMPS_APPRENANT = [
    { nom: 'prenom', libelle: 'Prénom' }, { nom: 'nom', libelle: 'Nom', requis: true },
    { nom: 'telephone', libelle: 'Téléphone (WhatsApp)', type: 'tel', placeholder: '+243 8…' }, { nom: 'email', libelle: 'E-mail', type: 'email' },
    { nom: 'sexe', libelle: 'Sexe', type: 'select', options: [['F', 'Femme'], ['M', 'Homme']] }, { nom: 'date_naissance', libelle: 'Date de naissance', type: 'date' },
    { nom: 'profession', libelle: 'Profession / études' }, { nom: 'source', libelle: 'Comment nous a-t-il connus ?', type: 'select', options: [['bouche_a_oreille', 'Bouche-à-oreille'], ['site', 'Site internet'], ['facebook', 'Facebook'], ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['affiche', 'Affiche / flyer'], ['radio', 'Radio'], ['entreprise', 'Entreprise partenaire'], ['autre', 'Autre']] },
    { nom: 'niveau_initial', libelle: 'Niveau initial', placeholder: 'ex. A2' }, { nom: 'statut', libelle: 'Statut', type: 'select', vide: false, options: options('statut_apprenant'), defaut: 'actif' },
    { nom: 'objectif', libelle: 'Objectif de l’apprenant', type: 'textarea', plein: true, lignes: 2, placeholder: 'ex. Réussir un entretien d’embauche en anglais' },
    { nom: 'notes', libelle: 'Notes internes', type: 'textarea', plein: true, lignes: 2 }
  ];

  ROUTES.apprenants = function () {
    var peutCreer = unDe('directeur', 'prefet', 'secretaire') || (a('professeur') && acces('coach_inscrit'));
    var z = page('Apprenants', 'Indicateurs individuels : assiduité, progression, leçons suivies, paiements et risque d’abandon.',
      peutCreer ? '<button class="cf-btn" data-export>Exporter (CSV)</button><button class="cf-btn principal" data-nouveau>+ Nouvel apprenant</button>' : '');
    z.innerHTML = '<div class="cf-filtres"><input type="search" placeholder="Rechercher (nom, matricule, téléphone)" data-q style="min-width:260px"><select data-statut><option value="actif">Actifs</option><option value="prospect">Prospects</option><option value="en_pause">En pause</option><option value="termine">Terminés</option><option value="abandon">Abandons</option><option value="tous">Tous</option></select><select data-risque><option value="">Tous les risques</option><option value="eleve">Risque élevé</option><option value="moyen">Risque moyen</option></select></div><div data-liste><div class="cf-chargement">Chargement…</div></div>';
    var donnees = [];
    function afficher() {
      var q = $('[data-q]', z).value.trim().toLowerCase();
      var r = $('[data-risque]', z).value;
      var liste = donnees.filter(function (x) {
        return (!q || [x.nom, x.prenom, x.matricule, x.telephone].join(' ').toLowerCase().indexOf(q) !== -1) && (!r || x.indicateurs.risque.niveau === r);
      });
      var zone = $('[data-liste]', z);
      zone.innerHTML = '<div class="cf-carte">' + tableau([
        { titre: 'Apprenant', rendu: function (x) { return '<strong>' + e(nomComplet(x)) + '</strong><div class="doux">' + e(x.matricule) + (x.groupes ? ' · ' + e(x.groupes) : '') + '</div>'; } },
        { titre: 'Niveau', rendu: function (x) { return e(x.niveau_actuel || x.niveau_initial || '—'); } },
        { titre: 'Présence', rendu: function (x) { return jauge(x.indicateurs.taux_presence); } },
        { titre: 'Leçons', rendu: function (x) { return x.indicateurs.lecons_disponibles ? x.indicateurs.lecons_terminees + '/' + x.indicateurs.lecons_disponibles : '—'; } },
        { titre: 'Dernier score', num: true, rendu: function (x) { return x.indicateurs.dernier_score === null ? '—' : nombre(x.indicateurs.dernier_score, 0) + (x.indicateurs.gain !== null ? ' <span class="doux">(' + (x.indicateurs.gain >= 0 ? '+' : '') + nombre(x.indicateurs.gain, 0) + ')</span>' : ''); } },
        { titre: 'Solde', num: true, rendu: function (x) { return x.indicateurs.solde > 0 ? '<span style="color:var(--cf-rouge)">' + argent(x.indicateurs.solde) + '</span>' : '<span class="doux">À jour</span>'; } },
        { titre: 'Risque', rendu: function (x) { var n = x.indicateurs.risque.niveau; return '<span class="cf-badge ' + (n === 'eleve' ? 'rouge' : n === 'moyen' ? 'ambre' : 'vert') + '" title="' + e(x.indicateurs.risque.raisons.join(' · ')) + '">' + e(LIBELLES.risque[n]) + '</span>'; } }
      ], liste, { clic: true, videTitre: donnees.length ? 'Aucun résultat' : 'Aucun apprenant', vide: donnees.length ? 'Modifiez la recherche.' : 'Inscrivez votre premier apprenant, ou convertissez une demande arrivée par le site.' }) + '</div>';
      brancherClic(zone, liste, function (x) { ficheApprenant(x.id); });
    }
    function chargerListe() {
      var st = $('[data-statut]', z).value;
      api('/kpi/apprenants?statut=' + encodeURIComponent(st)).then(function (d) { donnees = d.apprenants; afficher(); }).catch(function (err) { $('[data-liste]', z).innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
    }
    $('[data-q]', z).addEventListener('input', afficher);
    $('[data-risque]', z).addEventListener('change', afficher);
    $('[data-statut]', z).addEventListener('change', chargerListe);
    var bn = $('[data-nouveau]'); if (bn) bn.addEventListener('click', function () { nouvelApprenant(chargerListe); });
    var be = $('[data-export]'); if (be) be.addEventListener('click', function () {
      exporterCsv('apprenants.csv', ['Matricule', 'Nom', 'Prénom', 'Téléphone', 'Groupes', 'Niveau', 'Présence %', 'Dernier score', 'Solde', 'Risque'],
        donnees.map(function (x) { return [x.matricule, x.nom, x.prenom, x.telephone, x.groupes, x.niveau_actuel || x.niveau_initial, x.indicateurs.taux_presence, x.indicateurs.dernier_score, x.indicateurs.solde, LIBELLES.risque[x.indicateurs.risque.niveau]]; }));
    });
    chargerListe();
    if (/nouveau/.test(window.location.hash) && peutCreer) nouvelApprenant(chargerListe);
  };

  function exporterCsv(nom, entetes, lignes) {
    var csv = [entetes].concat(lignes).map(function (l) { return l.map(function (v) { var s = v === null || v === undefined ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';'); }).join('\n');
    var lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    lien.download = nom; document.body.appendChild(lien); lien.click(); lien.remove();
  }

  function groupesOptions() {
    return charger('groupes', '/groupes').then(function (gs) {
      return gs.filter(function (g) { return g.statut === 'planifie' || g.statut === 'en_cours'; }).map(function (g) {
        return [g.id, g.nom + (g.programme_nom ? ' — ' + g.programme_nom : '') + (g.capacite ? ' (' + g.inscrits + '/' + g.capacite + ')' : '')];
      });
    });
  }

  function nouvelApprenant(apres) {
    groupesOptions().then(function (opts) {
      var champs = CHAMPS_APPRENANT.concat([
        { nom: 'groupe_id', libelle: 'Inscrire directement dans le groupe', type: 'select', options: opts, vide: '— Plus tard —', plein: true },
        { nom: 'montant_du', libelle: 'Montant de la formation', type: 'nombre', aide: 'Laissez vide pour reprendre le prix du programme.' },
        { nom: 'remise', libelle: 'Remise accordée', type: 'nombre' }
      ]);
      modaleFormulaire('Nouvel apprenant', champs, {}, function (d) {
        return avecListeAttente(function (attente) { if (attente) d.liste_attente = true; return envoyer('/apprenants', 'POST', d); }).then(function (r) {
          oublier('groupes');
          afficherIdentifiants(r);
          if (apres) apres();
        });
      }, { large: true, bouton: 'Inscrire' });
    });
  }

  /* Groupe complet : on propose la liste d'attente plutôt que de perdre l'apprenant. */
  function avecListeAttente(appel) {
    return appel(false).catch(function (err) {
      if (err.code !== 'groupe_complet') throw err;
      if (!window.confirm(err.message + '\n\nInscrire en liste d’attente ? Vous confirmerez sa place dès qu’elle se libère.')) throw new Error('Inscription annulée.');
      return appel(true);
    });
  }

  function afficherIdentifiants(r) {
    var adresse = espaceApprenantUrl();
    var texte = 'Bienvenue chez ' + etat.ctx.centre.nom + ' ! Votre espace apprenant : ' + adresse + ' — Matricule : ' + r.matricule + ' — Code d’accès : ' + r.code_acces;
    var w = lienWhatsApp(r.telephone, texte);
    modale('Accès de ' + nomComplet(r), '<p>Remettez ces identifiants à l’apprenant. Il y retrouve son planning, ses leçons en ligne, ses résultats, ses paiements et ses certificats.</p>' +
      '<p>Adresse : <span class="cf-code">' + e(adresse) + '</span></p><p>Matricule : <span class="cf-code">' + e(r.matricule) + '</span> &nbsp; Code d’accès : <span class="cf-code">' + e(r.code_acces) + '</span></p>' +
      (etat.ctx.centre.site_publie ? '' : '<div class="cf-encadre">Le site du centre n’est pas encore publié : l’espace apprenant s’ouvrira dès sa publication (rubrique Site du centre).</div>'),
      { pied: (w ? '<a class="cf-btn principal" target="_blank" rel="noopener" href="' + e(w) + '">Envoyer par WhatsApp</a>' : '') + '<button class="cf-btn" data-copier>Copier le message</button><button class="cf-btn" data-fermer>Fermer</button>' })
      .el.querySelector('[data-copier]').addEventListener('click', function () { navigator.clipboard.writeText(texte).then(function () { toast('Message copié.'); }); });
  }
  function adresseSite() {
    var c = etat.ctx.centre;
    return 'https://myardoise.com/' + (c.site_adresse || ('ecole.html?code=' + encodeURIComponent(c.code)));
  }
  function espaceApprenantUrl() { return adresseSite() + '#/apprenant'; }

  function ficheApprenant(id) {
    var m = modale('Fiche apprenant', '<div class="cf-chargement">Chargement…</div>', { large: true });
    api('/apprenants/' + id).then(function (d) {
      var x = d.identite, s = d.synthese.indicateurs;
      var peutGerer = unDe('directeur', 'prefet', 'secretaire');
      var w = lienWhatsApp(x.telephone, 'Bonjour ' + (x.prenom || x.nom) + ', ');
      var corps = '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px"><div><h3 style="margin:0;font-size:1.25rem">' + e(nomComplet(x)) + '</h3><div class="doux">' + e(x.matricule) + ' · ' + badgeStatut('statut_apprenant', x.statut) + (x.profession ? ' · ' + e(x.profession) : '') + '</div>' +
        (x.objectif ? '<div style="margin-top:6px;font-size:.88rem"><strong>Objectif :</strong> ' + e(x.objectif) + '</div>' : '') + '</div>' +
        '<div class="cf-actions">' + (w ? '<a class="cf-btn petit" target="_blank" rel="noopener" href="' + e(w) + '">WhatsApp</a>' : '') + (x.telephone ? '<a class="cf-btn petit" href="tel:' + e(tel(x.telephone)) + '">Appeler</a>' : '') +
        '<button class="cf-btn petit" data-ia-suivi>✦ Bilan IA</button>' + (peutGerer ? '<button class="cf-btn petit" data-modifier>Modifier</button><button class="cf-btn petit" data-code>Code d’accès</button><button class="cf-btn petit" data-inscrire>Inscrire dans un groupe</button>' : '') +
        (unDe('directeur', 'comptable', 'secretaire') ? '<button class="cf-btn petit principal" data-payer>Encaisser</button>' : '') + '</div></div>' +
        '<div class="cf-grille-kpi">' + kpi('Assiduité', pct(s.taux_presence), s.seances_suivies + ' séance(s) suivie(s), ' + s.absences + ' absence(s)') +
        kpi('Niveau', e(x.niveau_actuel || '—'), 'Initial : ' + e(x.niveau_initial || '—')) +
        kpi('Leçons en ligne', s.lecons_disponibles ? s.lecons_terminees + ' / ' + s.lecons_disponibles : '—', pct(s.progression_lecons) + ' de progression') +
        kpi('Évaluations', s.dernier_score === null ? '—' : nombre(s.dernier_score, 0) + ' / 100', s.gain !== null ? (s.gain >= 0 ? '+' : '') + nombre(s.gain, 0) + ' pts depuis le début' : 'moyenne ' + nombre(s.score_moyen, 0), s.gain > 0 ? 'hausse' : s.gain < 0 ? 'baisse' : '') +
        (d.paiements.length || unDe('directeur', 'comptable', 'secretaire') ? kpi('Solde', s.solde > 0 ? argent(s.solde) : 'À jour', 'Payé : ' + argent(s.montant_paye) + ' / ' + argent(s.montant_du), s.solde > 0 ? 'baisse' : 'hausse') : '') +
        kpi('Risque d’abandon', e(LIBELLES.risque[s.risque.niveau]) + ' · ' + s.risque.score, e(s.risque.raisons.join(' · ') || 'Aucun signal'), s.risque.niveau === 'faible' ? 'hausse' : 'baisse') + '</div>';
      corps += '<div class="cf-onglets"><button class="actif" data-o="inscriptions">Formations</button><button data-o="presences">Présences</button><button data-o="evaluations">Évaluations</button><button data-o="lecons">Leçons</button>' + (d.paiements.length ? '<button data-o="paiements">Paiements</button>' : '') + '<button data-o="certificats">Certificats</button></div><div data-volet></div>';
      $('.corps', m.el).innerHTML = corps;
      var volets = {
        inscriptions: function () {
          return tableau([
            { titre: 'Groupe', rendu: function (i) { return '<strong>' + e(i.groupe_nom) + '</strong><div class="doux">' + e(i.programme_nom || '') + ' · ' + e(i.coach_nom || '') + '</div>'; } },
            { titre: 'Statut', rendu: function (i) { return badgeStatut('statut_inscription', i.statut); } },
            { titre: 'Montant', num: true, rendu: function (i) { return argent(Number(i.montant_du) - Number(i.remise), i.devise) + (Number(i.remise) ? ' <span class="doux">(remise ' + argent(i.remise, i.devise) + ')</span>' : ''); } },
            { titre: 'Payé', num: true, rendu: function (i) { return argent(i.paye, i.devise); } },
            { titre: '', rendu: function (i) { return peutGerer && i.statut === 'active' ? '<button class="cf-btn petit danger" data-abandon="' + e(i.id) + '">Abandon</button>' : ''; } }
          ], d.inscriptions, { videTitre: 'Aucune formation', vide: 'Inscrivez l’apprenant dans un groupe.' });
        },
        presences: function () {
          return tableau([
            { titre: 'Date', rendu: function (p) { return e(dateFr(p.date_seance)); } },
            { titre: 'Groupe', rendu: function (p) { return e(p.groupe_nom) + (p.theme ? ' <span class="doux">· ' + e(p.theme) + '</span>' : ''); } },
            { titre: 'Présence', rendu: function (p) { return '<span class="cf-badge ' + ({ present: 'vert', retard: 'ambre', absent: 'rouge', excuse: 'bleu' }[p.statut]) + '">' + e({ present: 'Présent', retard: 'Retard', absent: 'Absent', excuse: 'Excusé' }[p.statut]) + '</span>'; } }
          ], d.presences, { videTitre: 'Aucun appel enregistré' });
        },
        evaluations: function () {
          return tableau([
            { titre: 'Date', rendu: function (v) { return e(dateFr(v.date_evaluation)); } },
            { titre: 'Type', rendu: function (v) { return e(LIBELLES.type_eval[v.type] || v.type); } },
            { titre: 'Oral', num: true, rendu: function (v) { return nombre(v.score_oral, 0); } },
            { titre: 'Écrit', num: true, rendu: function (v) { return nombre(v.score_ecrit, 0); } },
            { titre: 'Compr. orale', num: true, rendu: function (v) { return nombre(v.score_comprehension_orale, 0); } },
            { titre: 'Compr. écrite', num: true, rendu: function (v) { return nombre(v.score_comprehension_ecrite, 0); } },
            { titre: 'Global', num: true, rendu: function (v) { return '<strong>' + nombre(v.score_global, 0) + '</strong>'; } },
            { titre: 'Niveau', rendu: function (v) { return e(v.niveau_atteint || '—'); } }
          ], d.evaluations.slice().reverse(), { videTitre: 'Aucune évaluation' });
        },
        lecons: function () {
          return tableau([
            { titre: 'Leçon', rendu: function (l) { return e(l.titre); } },
            { titre: 'Statut', rendu: function (l) { return l.statut === 'terminee' ? '<span class="cf-badge vert">Terminée</span>' : '<span class="cf-badge">Commencée</span>'; } },
            { titre: 'Score du quiz', num: true, rendu: function (l) { return l.score === null ? '—' : nombre(l.score, 0) + ' %'; } }
          ], d.lecons, { videTitre: 'Aucune leçon ouverte', vide: 'L’apprenant suit ses leçons depuis son espace en ligne.' });
        },
        paiements: function () {
          return tableau([
            { titre: 'Reçu', rendu: function (p) { return '<span class="cf-code">' + e(p.numero_recu) + '</span>'; } },
            { titre: 'Date', rendu: function (p) { return e(dateFr(p.date_paiement)); } },
            { titre: 'Mode', rendu: function (p) { return e(LIBELLES.paiement[p.mode] || p.mode); } },
            { titre: 'Montant', num: true, rendu: function (p) { return (p.annule ? '<s>' : '') + argent(p.montant, p.devise) + (p.annule ? '</s> <span class="cf-badge rouge">Annulé</span>' : ''); } },
            { titre: '', rendu: function (p) { return '<button class="cf-btn petit" data-recu="' + e(p.id) + '">Reçu</button>'; } }
          ], d.paiements);
        },
        certificats: function () {
          return tableau([
            { titre: 'Numéro', rendu: function (c) { return '<span class="cf-code">' + e(c.numero) + '</span>'; } },
            { titre: 'Formation', rendu: function (c) { return e(c.programme_nom) + (c.niveau ? ' · ' + e(c.niveau) : ''); } },
            { titre: 'Mention', rendu: function (c) { return e(c.mention || '—'); } },
            { titre: 'Statut', rendu: function (c) { return badgeStatut('', c.statut); } },
            { titre: '', rendu: function (c) { return unDe('directeur', 'prefet', 'secretaire') ? '<button class="cf-btn petit" data-cert="' + e(c.id) + '">Imprimer</button>' : ''; } }
          ], d.certificats, { videTitre: 'Aucun certificat', vide: 'Délivrez-le depuis la rubrique Certificats à la fin de la formation.' });
        }
      };
      function voir(o) {
        $$('[data-o]', m.el).forEach(function (b) { b.classList.toggle('actif', b.getAttribute('data-o') === o); });
        var v = $('[data-volet]', m.el); v.innerHTML = volets[o]();
        $$('[data-recu]', v).forEach(function (b) { b.addEventListener('click', function () { imprimerRecu(b.getAttribute('data-recu')); }); });
        $$('[data-cert]', v).forEach(function (b) { b.addEventListener('click', function () { imprimerCertificat(b.getAttribute('data-cert')); }); });
        $$('[data-abandon]', v).forEach(function (b) {
          b.addEventListener('click', function () {
            if (!window.confirm('Marquer cette inscription comme abandonnée ? Elle compte dans le taux d’abandon du coach.')) return;
            envoyer('/inscriptions/' + b.getAttribute('data-abandon'), 'PATCH', { statut: 'abandon' }).then(function () { m.fermer(); toast('Abandon enregistré.'); ficheApprenant(id); }).catch(echec);
          });
        });
      }
      $$('[data-o]', m.el).forEach(function (b) { b.addEventListener('click', function () { voir(b.getAttribute('data-o')); }); });
      voir('inscriptions');
      var bt;
      if ((bt = $('[data-modifier]', m.el))) bt.addEventListener('click', function () {
        m.fermer();
        modaleFormulaire('Modifier ' + nomComplet(x), CHAMPS_APPRENANT, x, function (v) { return envoyer('/apprenants/' + id, 'PATCH', v).then(function () { toast('Fiche mise à jour.'); naviguer(); }); }, { large: true });
      });
      if ((bt = $('[data-code]', m.el))) bt.addEventListener('click', function () {
        api('/apprenants/' + id + '/code').then(function (c) { m.fermer(); afficherIdentifiants({ matricule: c.matricule, code_acces: c.code_acces, telephone: x.telephone, nom: x.nom, prenom: x.prenom }); }).catch(echec);
      });
      if ((bt = $('[data-inscrire]', m.el))) bt.addEventListener('click', function () {
        groupesOptions().then(function (opts) {
          m.fermer();
          modaleFormulaire('Inscrire ' + nomComplet(x), [
            { nom: 'groupe_id', libelle: 'Groupe', type: 'select', options: opts, requis: true, plein: true },
            { nom: 'montant_du', libelle: 'Montant de la formation', type: 'nombre', aide: 'Vide : prix du programme.' },
            { nom: 'remise', libelle: 'Remise', type: 'nombre' }
          ], {}, function (v) { v.apprenant_id = id; return avecListeAttente(function (attente) { if (attente) v.liste_attente = true; return envoyer('/inscriptions', 'POST', v); }).then(function (r) { oublier('groupes'); toast(r.statut === 'attente' ? 'Inscrit en liste d’attente.' : 'Inscription enregistrée.'); ficheApprenant(id); }); });
        });
      });
      if ((bt = $('[data-payer]', m.el))) bt.addEventListener('click', function () { m.fermer(); nouvelEncaissement({ apprenant: x, inscriptions: d.inscriptions }, function () { ficheApprenant(id); }); });
      if ((bt = $('[data-ia-suivi]', m.el))) bt.addEventListener('click', function () {
        bt.disabled = true; bt.textContent = 'Analyse…';
        envoyer('/ia', 'POST', { mode: 'suivi', apprenant_id: id }).then(function (r) { afficherSortieIa('Bilan de progression — ' + nomComplet(x), r.resultat, x.telephone); }).catch(echec).then(function () { bt.disabled = false; bt.textContent = '✦ Bilan IA'; });
      });
    }).catch(function (err) { $('.corps', m.el).innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
  }

  /* ------------------------------------------------------------------ */
  /*  Programmes                                                          */
  /* ------------------------------------------------------------------ */
  var CHAMPS_PROGRAMME = [
    { nom: 'nom', libelle: 'Nom du programme', requis: true, plein: true, placeholder: 'ex. Anglais général — Intermédiaire' },
    { nom: 'niveau', libelle: 'Niveau', placeholder: 'ex. B1' }, { nom: 'categorie', libelle: 'Catégorie', placeholder: 'ex. Anglais des affaires' },
    { nom: 'duree_semaines', libelle: 'Durée (semaines)', type: 'nombre', pas: 1 }, { nom: 'heures_total', libelle: 'Volume horaire (h)', type: 'nombre' },
    { nom: 'prix', libelle: 'Prix', type: 'nombre' }, { nom: 'devise', libelle: 'Devise', type: 'select', vide: false, options: [['USD', 'Dollar (USD)'], ['FC', 'Franc congolais (FC)']] },
    { nom: 'mode', libelle: 'Mode', type: 'select', vide: false, options: options('mode') }, { nom: 'ordre', libelle: 'Ordre d’affichage', type: 'nombre', pas: 1 },
    { nom: 'frais_inscription', libelle: 'Frais d’inscription (nouveaux apprenants)', type: 'nombre', aide: 'Payés une seule fois, à la première inscription au centre.' },
    { nom: 'description', libelle: 'Description (affichée sur le site)', type: 'textarea', plein: true },
    { nom: 'publie', libelle: 'Afficher sur le site du centre', type: 'case', defaut: true }, { nom: 'actif', libelle: 'Programme actif', type: 'case', defaut: true }
  ];
  function champsProgramme(ps, courant) {
    return CHAMPS_PROGRAMME.concat([{ nom: 'programme_suivant_id', libelle: 'Niveau suivant du parcours', type: 'select', plein: true, vide: '— Fin de parcours —', aide: 'Utilisé pour réinscrire les admis à la fin d’une session.', options: ps.filter(function (p) { return !courant || p.id !== courant; }).map(function (p) { return [p.id, p.nom]; }) }]);
  }
  ROUTES.programmes = function () {
    var z = page('Programmes', 'Ce que votre centre propose : niveaux, durées, prix. Les programmes publiés apparaissent sur votre site.', '<button class="cf-btn principal" data-nouveau>+ Nouveau programme</button>');
    function lister(forcer) {
      charger('programmes', '/programmes', forcer).then(function (ps) {
        z.innerHTML = '<div class="cf-carte">' + tableau([
          { titre: 'Programme', rendu: function (p) { return '<strong>' + e(p.nom) + '</strong><div class="doux">' + e([p.niveau, p.categorie, LIBELLES.mode[p.mode]].filter(Boolean).join(' · ')) + '</div>'; } },
          { titre: 'Durée', rendu: function (p) { return e([p.duree_semaines ? p.duree_semaines + ' sem.' : '', p.heures_total ? nombre(p.heures_total) + ' h' : ''].filter(Boolean).join(' · ') || '—'); } },
          { titre: 'Parcours', rendu: function (p) { return p.programme_suivant_nom ? '→ ' + e(p.programme_suivant_nom) : '<span class="doux">Fin de parcours</span>'; } },
          { titre: 'Prix', num: true, rendu: function (p) { return argent(p.prix, p.devise) + (Number(p.frais_inscription) ? '<div class="doux">+ ' + argent(p.frais_inscription, p.devise) + ' d’inscription</div>' : ''); } },
          { titre: 'Groupes', num: true, rendu: function (p) { return p.groupes_actifs; } },
          { titre: 'Inscrits', num: true, rendu: function (p) { return p.inscrits; } },
          { titre: 'Site', rendu: function (p) { return !p.actif ? '<span class="cf-badge">Archivé</span>' : p.publie ? '<span class="cf-badge vert">Publié</span>' : '<span class="cf-badge ambre">Brouillon</span>'; } }
        ], ps, { clic: true, videTitre: 'Aucun programme', vide: 'Créez votre catalogue : chaque groupe se rattache à un programme.' }) + '</div>';
        brancherClic(z, ps, function (p) {
          var m = modaleFormulaire('Modifier le programme', champsProgramme(ps, p.id), p, function (d) { return envoyer('/programmes/' + p.id, 'PATCH', d).then(function () { toast('Programme enregistré.'); lister(true); }); }, { large: true });
          var pied = $('footer', m.el);
          pied.insertAdjacentHTML('afterbegin', '<button class="cf-btn danger" data-suppr style="margin-right:auto">Supprimer</button>');
          $('[data-suppr]', pied).addEventListener('click', function () {
            if (!window.confirm('Supprimer ce programme ?')) return;
            api('/programmes/' + p.id, { method: 'DELETE' }).then(function (r) { m.fermer(); toast(r && r.message ? r.message : 'Programme supprimé.'); lister(true); }).catch(echec);
          });
        });
      }).catch(echec);
    }
    $('[data-nouveau]').addEventListener('click', function () {
      modaleFormulaire('Nouveau programme', champsProgramme(etat.cache.programmes || []), { devise: deviseCentre(), publie: true, actif: true }, function (d) { return envoyer('/programmes', 'POST', d).then(function () { toast('Programme créé.'); lister(true); }); }, { large: true });
    });
    lister(true);
  };

  /* ------------------------------------------------------------------ */
  /*  Coachs et KPI                                                       */
  /* ------------------------------------------------------------------ */
  var CHAMPS_COACH = [
    { nom: 'prenom', libelle: 'Prénom' }, { nom: 'nom', libelle: 'Nom', requis: true },
    { nom: 'email', libelle: 'E-mail (identifiant de connexion)', type: 'email', requis: true }, { nom: 'telephone', libelle: 'Téléphone', type: 'tel' },
    { nom: 'specialites', libelle: 'Spécialités', plein: true, placeholder: 'ex. Conversation, IELTS, Business English' },
    { nom: 'taux_horaire', libelle: 'Rémunération par heure', type: 'nombre' }, { nom: 'devise', libelle: 'Devise', type: 'select', vide: false, options: [['USD', 'USD'], ['FC', 'FC']] },
    { nom: 'objectif_heures_mois', libelle: 'Objectif d’heures par mois', type: 'nombre' },
    { nom: 'bio', libelle: 'Présentation (site)', type: 'textarea', plein: true, lignes: 3 },
    { nom: 'publie_site', libelle: 'Présenter ce coach sur le site du centre', type: 'case' }, { nom: 'actif', libelle: 'Coach actif', type: 'case', defaut: true }
  ];
  ROUTES.coachs = function () {
    var z = page('Coachs et indicateurs', 'Score de chaque coach sur la période : réalisation des séances, assiduité, satisfaction, rétention et progression des apprenants.',
      '<select class="cf-btn" data-periode><option value="30">30 derniers jours</option><option value="90" selected>90 derniers jours</option><option value="365">12 derniers mois</option></select>' +
      (a('directeur') ? '<button class="cf-btn principal" data-nouveau>+ Nouveau coach</button>' : ''));
    function lister() {
      z.innerHTML = '<div class="cf-chargement">Calcul des indicateurs…</div>';
      var jours = Number($('[data-periode]').value);
      Promise.all([api('/kpi/coachs?du=' + aujourdhui(-jours) + '&au=' + aujourdhui()), api('/coachs')]).then(function (r) {
        var k = r[0], profils = {}; r[1].forEach(function (p) { profils[p.id] = p; });
        var html = '<div class="cf-encadre">Le score sur 100 combine : réalisation des séances (' + k.poids.realisation + ' %), présence des apprenants (' + k.poids.presence + ' %), satisfaction (' + k.poids.satisfaction + ' %), rétention (' + k.poids.retention + ' %) et progression aux évaluations (' + k.poids.progression + ' %). Une donnée absente n’est pas comptée comme zéro : son poids passe aux autres.</div>';
        html += k.coachs.length ? '<div class="cf-cartes">' + k.coachs.map(function (c) {
          var i = c.indicateurs;
          return '<div class="cf-fiche"><div style="display:flex;gap:12px;align-items:center"><span class="cf-score ' + e(i.appreciation) + '">' + (i.score === null ? '—' : i.score) + '</span><div><h3>' + e(nomComplet(c)) + '</h3><div class="meta">' + e(c.specialites || 'Coach') + (c.actif ? '' : ' · inactif') + '</div></div></div>' +
            '<div class="cf-mini"><div><b>' + nombre(i.heures_donnees) + ' h</b>données</div><div><b>' + pct(i.taux_presence) + '</b>présence</div><div><b>' + (i.satisfaction_moyenne ? nombre(i.satisfaction_moyenne, 1) : '—') + '</b>satisfaction</div>' +
            '<div><b>' + pct(i.taux_realisation) + '</b>réalisation</div><div><b>' + pct(i.taux_retention) + '</b>rétention</div><div><b>' + (i.progression_moyenne === null ? '—' : (i.progression_moyenne >= 0 ? '+' : '') + nombre(i.progression_moyenne, 0)) + '</b>progression</div></div>' +
            '<div class="meta">' + i.groupes_actifs + ' groupe(s) · ' + i.apprenants_actifs + ' apprenant(s) · ' + i.seances_faites + ' séance(s) données' + (i.seances_non_cloturees ? ' · <span style="color:var(--cf-rouge)">' + i.seances_non_cloturees + ' sans appel</span>' : '') + '</div>' +
            (a('directeur') ? '<div class="meta">Revenus générés : <strong>' + argent(i.revenus_generes, k.devise) + '</strong> · coût estimé : ' + argent(i.cout_estime, c.devise) + '</div>' : '') +
            '<div class="bas">' + badgeStatut('appreciation', i.appreciation) + (a('directeur') ? '<button class="cf-btn petit" data-modifier="' + e(c.coach_id) + '">Modifier</button>' : '') + (lienWhatsApp(c.telephone) ? '<a class="cf-btn petit" target="_blank" rel="noopener" href="' + e(lienWhatsApp(c.telephone)) + '">WhatsApp</a>' : '') + '</div></div>';
        }).join('') + '</div>' : '<div class="cf-vide"><strong>Aucun coach</strong>Ajoutez vos coachs : chacun reçoit un compte et ne voit que ses groupes.</div>';
        z.innerHTML = html;
        $$('[data-modifier]', z).forEach(function (b) {
          b.addEventListener('click', function () {
            var p = profils[b.getAttribute('data-modifier')] || {};
            modaleFormulaire('Modifier ' + nomComplet(p), CHAMPS_COACH.filter(function (c) { return c.nom !== 'email'; }), p, function (d) { return envoyer('/coachs/' + p.id, 'PATCH', d).then(function () { toast('Coach mis à jour.'); lister(); }); }, { large: true });
          });
        });
      }).catch(function (err) { z.innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
    }
    $('[data-periode]').addEventListener('change', lister);
    var bn = $('[data-nouveau]'); if (bn) bn.addEventListener('click', function () {
      modaleFormulaire('Nouveau coach', CHAMPS_COACH, { devise: deviseCentre(), actif: true }, function (d) {
        return envoyer('/coachs', 'POST', d).then(function (r) {
          oublier('coachs');
          modale('Compte du coach créé', '<p>' + e(r.message) + '</p>' + (r.mot_de_passe_provisoire ? '<p>Code du centre : <span class="cf-code">' + e(etat.ctx.centre.code) + '</span><br>Identifiant : <span class="cf-code">' + e(r.email) + '</span><br>Mot de passe provisoire : <span class="cf-code">' + e(r.mot_de_passe_provisoire) + '</span></p><div class="cf-encadre">Ce mot de passe n’est affiché qu’une fois. Notez-le ou envoyez-le maintenant.</div>' : ''), { pied: '<button class="cf-btn principal" data-fermer>J’ai noté</button>' });
          lister();
        });
      }, { large: true, bouton: 'Créer le compte' });
    });
    lister();
  };

  /* ------------------------------------------------------------------ */
  /*  Groupes                                                             */
  /* ------------------------------------------------------------------ */
  function champsGroupe(programmes, coachs, sessions) {
    return [
      { nom: 'nom', libelle: 'Nom du groupe', requis: true, placeholder: 'ex. B1 — Soir — Janvier' },
      { nom: 'session_id', libelle: 'Session', type: 'select', vide: '— Hors session —', options: (sessions || []).filter(function (s) { return s.statut !== 'cloturee'; }).map(function (s) { return [s.id, s.nom]; }) },
      { nom: 'programme_id', libelle: 'Programme', type: 'select', options: programmes.map(function (p) { return [p.id, p.nom]; }) },
      { nom: 'coach_id', libelle: 'Coach', type: 'select', options: coachs.map(function (c) { return [c.id, nomComplet(c)]; }) },
      { nom: 'capacite', libelle: 'Places', type: 'nombre', pas: 1 },
      { nom: 'date_debut', libelle: 'Début', type: 'date' }, { nom: 'date_fin', libelle: 'Fin', type: 'date' },
      { nom: 'horaire', libelle: 'Horaire', placeholder: 'ex. Lun, Mer, Ven — 17h30 à 19h' }, { nom: 'salle', libelle: 'Salle' },
      { nom: 'mode', libelle: 'Mode', type: 'select', vide: false, options: options('mode') }, { nom: 'lien_visio', libelle: 'Lien de visioconférence', type: 'url', placeholder: 'https://meet.google.com/…' },
      { nom: 'statut', libelle: 'Statut', type: 'select', vide: false, options: options('statut_groupe'), defaut: 'planifie' },
      { nom: 'ouvert_inscriptions', libelle: 'Ouvert aux inscriptions sur le site', type: 'case', defaut: true }
    ];
  }
  ROUTES.groupes = function () {
    var gere = unDe('directeur', 'prefet') || (a('secretaire') && acces('accueil_planifie'));
    var z = page('Groupes', 'Chaque groupe suit un programme avec un coach, sur un horaire. Ouvrez-en un pour voir ses membres, ses séances et faire l’appel.', gere ? '<button class="cf-btn principal" data-nouveau>+ Nouveau groupe</button>' : '');
    function lister(forcer) {
      charger('groupes', '/groupes', forcer).then(function (gs) {
        z.innerHTML = '<div class="cf-carte">' + tableau([
          { titre: 'Groupe', rendu: function (g) { return '<strong>' + e(g.nom) + '</strong><div class="doux">' + e(g.programme_nom || 'Sans programme') + ' · ' + e(LIBELLES.mode[g.mode]) + '</div>'; } },
          { titre: 'Session', rendu: function (g) { return e(g.session_nom || '—'); } },
          { titre: 'Coach', rendu: function (g) { return e(g.coach_nom || '—'); } },
          { titre: 'Horaire', rendu: function (g) { return e(g.horaire || '—') + (g.salle ? '<div class="doux">' + e(g.salle) + '</div>' : ''); } },
          { titre: 'Dates', rendu: function (g) { return e(dateFr(g.date_debut)) + ' → ' + e(dateFr(g.date_fin)); } },
          { titre: 'Inscrits', num: true, rendu: function (g) { return g.inscrits + (g.capacite ? ' / ' + g.capacite : '') + (g.en_attente ? '<div class="doux" style="color:var(--cf-ambre)">+' + g.en_attente + ' en attente</div>' : ''); } },
          { titre: 'Séances', num: true, rendu: function (g) { return g.seances_faites + ' / ' + g.seances_total; } },
          { titre: 'Statut', rendu: function (g) { return badgeStatut('statut_groupe', g.statut); } }
        ], gs, { clic: true, videTitre: 'Aucun groupe', vide: gere ? 'Créez un groupe à partir d’un programme et attribuez-lui un coach.' : '' }) + '</div>';
        brancherClic(z, gs, function (g) { detailGroupe(g.id); });
      }).catch(echec);
    }
    var bn = $('[data-nouveau]'); if (bn) bn.addEventListener('click', function () {
      Promise.all([charger('programmes', '/programmes'), charger('coachs', '/coachs'), charger('sessions', '/sessions')]).then(function (r) {
        var enCours = r[2].filter(function (s) { return s.statut === 'inscriptions' || s.statut === 'preparation'; })[0];
        modaleFormulaire('Nouveau groupe', champsGroupe(r[0].filter(function (p) { return p.actif; }), r[1].filter(function (c) { return c.actif; }), r[2]), { session_id: enCours ? enCours.id : null, date_debut: enCours ? String(enCours.date_debut).slice(0, 10) : null, date_fin: enCours ? String(enCours.date_fin).slice(0, 10) : null }, function (d) {
          return envoyer('/groupes', 'POST', d).then(function (g) { toast('Groupe créé. Planifiez maintenant ses séances.'); lister(true); planifier(g); });
        }, { large: true });
      }).catch(echec);
    });
    lister(true);
  };

  function planifier(g, apres) {
    var champs = [
      { nom: 'date_debut', libelle: 'Du', type: 'date', requis: true }, { nom: 'date_fin', libelle: 'Au', type: 'date', requis: true },
      { nom: 'heure_debut', libelle: 'Heure de début', type: 'heure' }, { nom: 'duree_minutes', libelle: 'Durée (minutes)', type: 'nombre', pas: 5, defaut: 90 }
    ];
    var jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    modaleFormulaire('Planifier les séances — ' + g.nom, champs, { date_debut: g.date_debut, date_fin: g.date_fin }, function (d, m) {
      d.jours = $$('[name=jour]:checked', m.el).map(function (c) { return Number(c.value); });
      if (!d.jours.length) { toast('Cochez au moins un jour.', true); return false; }
      return envoyer('/groupes/' + g.id + '/planifier', 'POST', d).then(function (r) { toast(r.message); oublier('groupes'); if (apres) apres(); });
    }, { bouton: 'Planifier', apres: '<p style="font-size:.82rem;font-weight:600;color:var(--cf-doux);margin:14px 0 6px">Jours de cours</p><div class="cf-jours">' + jours.map(function (j, i) { return '<label><input type="checkbox" name="jour" value="' + (i + 1) + '">' + j + '</label>'; }).join('') + '</div><p class="doux" style="font-size:.8rem">Les séances déjà planifiées à une date ne sont pas dupliquées.</p>' });
  }

  function detailGroupe(id) {
    var m = modale('Groupe', '<div class="cf-chargement">Chargement…</div>', { large: true });
    api('/groupes/' + id).then(function (d) {
      var g = d.groupe, gere = unDe('directeur', 'prefet') || (a('secretaire') && acces('accueil_planifie'));
      var planifie = gere || (a('professeur') && acces('coach_planifie'));
      $('header h2', m.el).textContent = g.nom;
      var html = '<div class="doux" style="margin-bottom:10px">' + e([g.session_nom, g.programme_nom, g.coach_nom ? 'Coach : ' + g.coach_nom : '', g.horaire, g.salle, LIBELLES.mode[g.mode]].filter(Boolean).join(' · ')) + ' ' + badgeStatut('statut_groupe', g.statut) + '</div>' +
        '<div class="cf-actions" style="margin-bottom:12px">' + (gere ? '<button class="cf-btn petit" data-modifier>Modifier</button>' : '') + (planifie ? '<button class="cf-btn petit" data-planifier>Planifier des séances</button>' : '') +
        (unDe('directeur', 'prefet', 'professeur') ? '<button class="cf-btn petit" data-seance>+ Séance</button>' : '') +
        '<button class="cf-btn petit" data-evaluer>Saisir une évaluation</button>' + (urlSure(g.lien_visio) ? '<a class="cf-btn petit" target="_blank" rel="noopener" href="' + e(g.lien_visio) + '">Lien visio</a>' : '') +
        '<button class="cf-btn petit" data-wa>Message au groupe</button></div>';
      html += '<div class="cf-onglets"><button class="actif" data-o="membres">Membres (' + d.membres.filter(function (x) { return x.statut_inscription === 'active'; }).length + ')</button><button data-o="seances">Séances (' + d.seances.length + ')</button></div><div data-volet></div>';
      $('.corps', m.el).innerHTML = html;
      function voir(o) {
        $$('[data-o]', m.el).forEach(function (b) { b.classList.toggle('actif', b.getAttribute('data-o') === o); });
        var v = $('[data-volet]', m.el);
        if (o === 'membres') {
          v.innerHTML = tableau([
            { titre: 'Apprenant', rendu: function (x) { return '<strong>' + e(nomComplet(x)) + '</strong><div class="doux">' + e(x.matricule) + (x.niveau_actuel ? ' · ' + e(x.niveau_actuel) : '') + '</div>'; } },
            { titre: 'Présence', rendu: function (x) { return jauge(x.taux_presence === null ? null : Math.round(x.taux_presence)); } },
            { titre: 'Payé', num: true, rendu: function (x) { var reste = Number(x.montant_du) - Number(x.remise) - Number(x.paye); return argent(x.paye, x.devise) + (reste > 0 ? '<div class="doux" style="color:var(--cf-rouge)">reste ' + argent(reste, x.devise) + '</div>' : ''); } },
            { titre: 'Inscription', rendu: function (x) { return badgeStatut('statut_inscription', x.statut_inscription) + (x.certifie ? ' <span class="cf-badge vert">Certifié</span>' : '') + (x.statut_inscription === 'attente' && unDe('directeur', 'prefet', 'secretaire') ? ' <button class="cf-btn petit" data-confirmer="' + e(x.inscription_id) + '">Confirmer</button>' : ''); } }
          ], d.membres, { clic: true, videTitre: 'Aucun inscrit', vide: 'Inscrivez des apprenants depuis la rubrique Apprenants.' });
          brancherClic(v, d.membres, function (x) { m.fermer(); ficheApprenant(x.id); });
          $$('[data-confirmer]', v).forEach(function (b) { b.addEventListener('click', function () { envoyer('/inscriptions/' + b.getAttribute('data-confirmer'), 'PATCH', { statut: 'active' }).then(function () { toast('Place confirmée.'); m.fermer(); detailGroupe(id); }).catch(echec); }); });
        } else {
          v.innerHTML = tableau([
            { titre: 'Date', rendu: function (s) { return e(dateFr(s.date_seance)) + ' <span class="doux">' + e(heure(s.heure_debut)) + '</span>'; } },
            { titre: 'Thème', rendu: function (s) { return e(s.theme || s.lecon_titre || '—'); } },
            { titre: 'Présents', num: true, rendu: function (s) { return s.appels ? s.presents + ' / ' + s.appels : '—'; } },
            { titre: 'Statut', rendu: function (s) { return badgeStatut('statut_seance', s.statut); } },
            { titre: '', rendu: function (s) { return s.statut === 'annulee' ? '' : '<button class="cf-btn petit" data-appel="' + e(s.id) + '">Appel</button>'; } }
          ], d.seances, { videTitre: 'Aucune séance', vide: 'Planifiez les séances de ce groupe.' });
          $$('[data-appel]', v).forEach(function (b) { b.addEventListener('click', function () { m.fermer(); ouvrirAppel(b.getAttribute('data-appel'), function () { detailGroupe(id); }); }); });
        }
      }
      $$('[data-o]', m.el).forEach(function (b) { b.addEventListener('click', function () { voir(b.getAttribute('data-o')); }); });
      voir('membres');
      var bt;
      if ((bt = $('[data-modifier]', m.el))) bt.addEventListener('click', function () {
        Promise.all([charger('programmes', '/programmes'), charger('coachs', '/coachs'), charger('sessions', '/sessions')]).then(function (r) {
          m.fermer();
          modaleFormulaire('Modifier ' + g.nom, champsGroupe(r[0], r[1], r[2]), g, function (v) { return envoyer('/groupes/' + id, 'PATCH', v).then(function () { oublier('groupes'); toast('Groupe mis à jour.'); naviguer(); }); }, { large: true });
        });
      });
      if ((bt = $('[data-planifier]', m.el))) bt.addEventListener('click', function () { m.fermer(); planifier(g, function () { detailGroupe(id); }); });
      if ((bt = $('[data-seance]', m.el))) bt.addEventListener('click', function () { m.fermer(); nouvelleSeance(g.id, function () { detailGroupe(id); }); });
      if ((bt = $('[data-evaluer]', m.el))) bt.addEventListener('click', function () { m.fermer(); saisirEvaluation(g.id, d.membres.filter(function (x) { return x.statut_inscription === 'active'; })); });
      $('[data-wa]', m.el).addEventListener('click', function () {
        var tels = d.membres.filter(function (x) { return x.statut_inscription === 'active' && x.telephone; });
        modale('Message au groupe ' + g.nom, '<p class="doux">Rédigez le message, puis envoyez-le à chaque apprenant par WhatsApp (un clic par personne).</p><form class="cf-form"><label class="plein">Message<textarea data-msg rows="4">Bonjour, rappel : prochaine séance du groupe ' + e(g.nom) + (g.horaire ? ' (' + e(g.horaire) + ')' : '') + '. — ' + e(etat.ctx.centre.nom) + '</textarea></label></form><div data-liens style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px"></div>', {});
        var mm = $$('.cf-voile').pop();
        function liens() { var t = $('[data-msg]', mm).value; $('[data-liens]', mm).innerHTML = tels.length ? tels.map(function (x) { return '<a class="cf-btn petit" target="_blank" rel="noopener" href="' + e(lienWhatsApp(x.telephone, t)) + '">' + e(nomComplet(x)) + '</a>'; }).join('') : '<span class="doux">Aucun numéro enregistré.</span>'; }
        $('[data-msg]', mm).addEventListener('input', liens); liens();
      });
    }).catch(function (err) { $('.corps', m.el).innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
  }

  /* ------------------------------------------------------------------ */
  /*  Planning et appel                                                   */
  /* ------------------------------------------------------------------ */
  var decalageSemaine = 0;
  ROUTES.seances = function () {
    var z = page('Planning et appel', 'La semaine du centre. Cliquez une séance pour faire l’appel, noter le thème et les devoirs. En orange : séance passée sans appel.',
      '<button class="cf-btn" data-prec>← Semaine précédente</button><button class="cf-btn" data-auj>Cette semaine</button><button class="cf-btn" data-suiv>Semaine suivante →</button>' + (unDe('directeur', 'prefet', 'professeur') ? '<button class="cf-btn principal" data-nouvelle>+ Séance</button>' : ''));
    function lundi() { var d = new Date(); d.setHours(0, 0, 0, 0); var j = (d.getDay() + 6) % 7; d.setDate(d.getDate() - j + decalageSemaine * 7); return d; }
    function iso(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
    function afficher() {
      var l = lundi(), fin = new Date(l.getTime() + 6 * 86400000);
      z.innerHTML = '<div class="cf-chargement">Chargement…</div>';
      Promise.all([api('/seances?du=' + iso(l) + '&au=' + iso(fin)), api('/seances?statut=prevue&au=' + aujourdhui(-1))]).then(function (r) {
        var ss = r[0], enRetard = r[1];
        var jours = [];
        for (var i = 0; i < 7; i++) { var d = new Date(l.getTime() + i * 86400000); jours.push(iso(d)); }
        var html = enRetard.length ? '<div class="cf-encadre"><strong>' + enRetard.length + ' séance(s) passée(s) sans appel</strong> — ' + enRetard.slice(0, 6).map(function (s) { return '<a href="#" data-appel="' + e(s.id) + '">' + e(s.groupe_nom) + ' (' + e(dateFr(s.date_seance)) + ')</a>'; }).join(', ') + (enRetard.length > 6 ? '…' : '') + '</div>' : '';
        html += '<div class="cf-semaine">' + jours.map(function (j) {
          var duJour = ss.filter(function (s) { return String(s.date_seance).slice(0, 10) === j; });
          return '<div class="jour' + (j === aujourdhui() ? ' aujourdhui' : '') + '"><h4>' + e(dateFr(j, true)) + '</h4>' + duJour.map(function (s) {
            var cls = s.statut === 'faite' ? 'faite' : s.statut === 'annulee' ? 'annulee' : (j < aujourdhui() ? 'a-cloturer' : '');
            return '<div class="seance ' + cls + '" data-appel="' + e(s.id) + '"><strong>' + e(heure(s.heure_debut) || '—') + '</strong> ' + e(s.groupe_nom) + '<div class="doux">' + e(s.coach_nom || '') + (s.salle ? ' · ' + e(s.salle) : '') + '</div>' + (s.statut === 'faite' ? '<div class="doux">' + s.presents + '/' + s.appels + ' présents</div>' : '') + '</div>';
          }).join('') + '</div>';
        }).join('') + '</div>';
        z.innerHTML = html;
        $$('[data-appel]', z).forEach(function (b) { b.addEventListener('click', function (ev) { ev.preventDefault(); ouvrirAppel(b.getAttribute('data-appel'), afficher); }); });
      }).catch(function (err) { z.innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
    }
    $('[data-prec]').addEventListener('click', function () { decalageSemaine--; afficher(); });
    $('[data-suiv]').addEventListener('click', function () { decalageSemaine++; afficher(); });
    $('[data-auj]').addEventListener('click', function () { decalageSemaine = 0; afficher(); });
    var bn = $('[data-nouvelle]'); if (bn) bn.addEventListener('click', function () { nouvelleSeance(null, afficher); });
    afficher();
  };

  function nouvelleSeance(groupeId, apres) {
    Promise.all([charger('groupes', '/groupes'), unDe('directeur', 'prefet', 'professeur') ? charger('lecons', '/lecons').catch(function () { return []; }) : Promise.resolve([])]).then(function (r) {
      var champs = [
        { nom: 'groupe_id', libelle: 'Groupe', type: 'select', requis: true, options: r[0].filter(function (g) { return g.statut !== 'termine' && g.statut !== 'annule'; }).map(function (g) { return [g.id, g.nom]; }) },
        { nom: 'date_seance', libelle: 'Date', type: 'date', requis: true, defaut: aujourdhui() },
        { nom: 'heure_debut', libelle: 'Heure', type: 'heure' }, { nom: 'duree_minutes', libelle: 'Durée (minutes)', type: 'nombre', defaut: 90 },
        { nom: 'mode', libelle: 'Mode', type: 'select', vide: false, options: [['presentiel', 'Présentiel'], ['en_ligne', 'En ligne (visio)'], ['hybride', 'Hybride'], ['enregistre', 'Cours préenregistré (replay)']] },
        { nom: 'enregistrement_url', libelle: 'Lien de la vidéo (cours préenregistré)', type: 'url', placeholder: 'https://youtu.be/…' },
        { nom: 'theme', libelle: 'Thème', plein: true },
        { nom: 'lecon_id', libelle: 'Leçon en ligne associée', type: 'select', plein: true, options: r[1].map(function (l) { return [l.id, l.titre]; }) }
      ];
      modaleFormulaire('Nouvelle séance', champs, { groupe_id: groupeId }, function (d) { return envoyer('/seances', 'POST', d).then(function () { toast('Séance ajoutée.'); if (apres) apres(); }); });
    }).catch(echec);
  }

  function ouvrirAppel(seanceId, apres) {
    var m = modale('Appel', '<div class="cf-chargement">Chargement…</div>', { large: true });
    api('/seances/' + seanceId + '/appel').then(function (d) {
      var s = d.seance, choix = {};
      var enLigneS = ['en_ligne', 'hybride', 'enregistre'].indexOf(s.mode) >= 0;
      // En ligne : seuls ceux qui ont rejoint (ou suivi le replay) sont présents par défaut.
      d.apprenants.forEach(function (x) { choix[x.id] = x.statut || (enLigneS ? 'absent' : 'present'); });
      $('header h2', m.el).textContent = 'Appel — ' + dateFr(s.date_seance, true) + (s.heure_debut ? ' à ' + heure(s.heure_debut) : '');
      var html = (s.statut === 'faite' ? '<div class="cf-encadre">Séance déjà clôturée : vous pouvez corriger l’appel.</div>' : '') +
        '<div class="cf-actions" style="margin-bottom:10px"><button class="cf-btn petit" data-tous="present">Tous présents</button>' +
        (enLigneS || (cfg().en_ligne && cfg().en_ligne.pointage_qr) ? '<a class="cf-btn petit" href="#/salle?s=' + e(seanceId) + '" data-fermer>' + (enLigneS ? '🎥 Salle virtuelle' : '▦ QR de présence') + '</a>' : '') +
        '<span class="doux" style="align-self:center;font-size:.82rem">' + (enLigneS ? 'Les apprenants connectés à la classe sont déjà notés.' : 'Par défaut, chacun est noté présent.') + '</span></div>' +
        (d.apprenants.length ? '<div class="cf-appel">' + d.apprenants.map(function (x) {
          return '<div class="ligne" data-id="' + e(x.id) + '"><div><strong>' + e(nomComplet(x)) + '</strong> <span class="doux">' + e(x.matricule) + '</span></div><div class="choix">' + ['present', 'retard', 'absent', 'excuse'].map(function (st) {
            return '<button type="button" data-st="' + st + '" class="' + st + '">' + { present: 'Présent', retard: 'Retard', absent: 'Absent', excuse: 'Excusé' }[st] + '</button>';
          }).join('') + '</div></div>';
        }).join('') + '</div>' : '<div class="cf-vide">Aucun apprenant inscrit dans ce groupe.</div>') +
        '<form class="cf-form" style="margin-top:14px"><label class="plein">Thème de la séance<input name="theme" value="' + e(s.theme || '') + '"></label><label>Notes du coach<textarea name="notes_coach" rows="2">' + e(s.notes_coach || '') + '</textarea></label><label>Devoirs (visibles par les apprenants)<textarea name="devoirs" rows="2">' + e(s.devoirs || '') + '</textarea></label></form>';
      $('.corps', m.el).innerHTML = html;
      $('.cf-modale', m.el).insertAdjacentHTML('beforeend', '<footer>' + (s.statut !== 'faite' && s.statut !== 'annulee' ? '<button class="cf-btn danger" data-annuler style="margin-right:auto">Annuler la séance</button>' : '') + '<button class="cf-btn" data-fermer>Fermer</button><button class="cf-btn principal" data-enregistrer>Enregistrer l’appel</button></footer>');
      function peindre() { $$('.ligne', m.el).forEach(function (l) { var id = l.getAttribute('data-id'); $$('[data-st]', l).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-st') === choix[id]); }); }); }
      $$('.ligne [data-st]', m.el).forEach(function (b) { b.addEventListener('click', function () { choix[b.closest('.ligne').getAttribute('data-id')] = b.getAttribute('data-st'); peindre(); }); });
      $('[data-tous]', m.el).addEventListener('click', function () { Object.keys(choix).forEach(function (k) { choix[k] = 'present'; }); peindre(); });
      peindre();
      $('[data-enregistrer]', m.el).addEventListener('click', function () {
        var f = $('form', m.el);
        envoyer('/seances/' + seanceId + '/appel', 'PUT', {
          presences: Object.keys(choix).map(function (k) { return { apprenant_id: k, statut: choix[k] }; }),
          theme: f.elements.theme.value, notes_coach: f.elements.notes_coach.value, devoirs: f.elements.devoirs.value, cloturer: true
        }).then(function (r) { m.fermer(); toast('Appel enregistré (' + r.enregistrees + ' apprenant(s)).'); if (apres) apres(); }).catch(echec);
      });
      var ba = $('[data-annuler]', m.el); if (ba) ba.addEventListener('click', function () {
        var motif = window.prompt('Motif de l’annulation (coupure, absence du coach, jour férié…) :');
        if (!motif) return;
        envoyer('/seances/' + seanceId, 'PATCH', { statut: 'annulee', motif_annulation: motif }).then(function () { m.fermer(); toast('Séance annulée.'); if (apres) apres(); }).catch(echec);
      });
    }).catch(function (err) { $('.corps', m.el).innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
  }

  /* ------------------------------------------------------------------ */
  /*  Leçons en ligne                                                     */
  /* ------------------------------------------------------------------ */
  ROUTES.lecons = function () {
    var z = page('Leçons en ligne', 'Votre bibliothèque de cours : contenu, vidéo, ressources et quiz corrigé automatiquement. Les apprenants les suivent depuis leur espace, à leur rythme.',
      '<button class="cf-btn" data-ia>✦ Générer avec l’IA</button><button class="cf-btn principal" data-nouvelle>+ Nouvelle leçon</button>');
    function lister(forcer) {
      charger('lecons', '/lecons', forcer).then(function (ls) {
        z.innerHTML = '<div class="cf-carte">' + tableau([
          { titre: 'Leçon', rendu: function (l) { return '<strong>' + e(l.titre) + '</strong><div class="doux">' + e([l.programme_nom || 'Tous programmes', l.niveau, LIBELLES.competence[l.competence]].filter(Boolean).join(' · ')) + '</div>'; } },
          { titre: 'Contenu', rendu: function (l) { return [l.video_url ? 'Vidéo' : '', l.ressource_url ? 'Ressource' : '', l.questions ? l.questions + ' question(s)' : ''].filter(Boolean).join(' · ') || '<span class="doux">Texte</span>'; } },
          { titre: 'Terminée par', num: true, rendu: function (l) { return l.terminees + (l.score_moyen !== null ? ' <span class="doux">· ' + nombre(l.score_moyen, 0) + ' %</span>' : ''); } },
          { titre: 'Auteur', rendu: function (l) { return e(l.auteur || '—'); } },
          { titre: 'État', rendu: function (l) { return l.publiee ? '<span class="cf-badge vert">Publiée</span>' : '<span class="cf-badge ambre">Brouillon</span>'; } }
        ], ls, { clic: true, videTitre: 'Aucune leçon', vide: 'Écrivez votre première leçon, ou demandez à l’assistant IA de la préparer.' }) + '</div>';
        brancherClic(z, ls, function (l) { api('/lecons/' + l.id).then(function (d) { editerLecon(d, function () { lister(true); }); }).catch(echec); });
      }).catch(echec);
    }
    $('[data-nouvelle]').addEventListener('click', function () { editerLecon({ publiee: false, quiz: [] }, function () { lister(true); }); });
    $('[data-ia]').addEventListener('click', function () { window.location.hash = '#/assistant?lecon'; });
    lister(true);
  };

  function editerLecon(l, apres) {
    charger('programmes', '/programmes').then(function (ps) {
      var champs = [
        { nom: 'titre', libelle: 'Titre', requis: true, plein: true },
        { nom: 'programme_id', libelle: 'Programme', type: 'select', vide: '— Tous les programmes —', options: ps.map(function (p) { return [p.id, p.nom]; }) },
        { nom: 'niveau', libelle: 'Niveau', placeholder: 'ex. A2' },
        { nom: 'competence', libelle: 'Compétence', type: 'select', vide: false, options: options('competence') }, { nom: 'duree_minutes', libelle: 'Durée estimée (min)', type: 'nombre' },
        { nom: 'resume', libelle: 'Résumé', type: 'textarea', plein: true, lignes: 2 },
        { nom: 'contenu', libelle: 'Contenu de la leçon', type: 'textarea', plein: true, lignes: 10 },
        { nom: 'video_url', libelle: 'Lien vidéo (YouTube…)', type: 'url' }, { nom: 'ressource_url', libelle: 'Document (Drive, PDF…)', type: 'url' },
        { nom: 'audio_url', libelle: 'Version audio (connexions faibles)', type: 'url', aide: 'Un audio de 10 minutes pèse 20 fois moins qu’une vidéo.' },
        { nom: 'ordre', libelle: 'Ordre', type: 'nombre', pas: 1 }, { nom: 'publiee', libelle: 'Publier pour les apprenants', type: 'case' }
      ];
      var quiz = (l.quiz || []).map(function (q) { return { question: q.question, choix: q.choix.slice(), bonne: q.bonne, explication: q.explication || '' }; });
      var m = modaleFormulaire(l.id ? 'Modifier la leçon' : 'Nouvelle leçon', champs, l, function (d) {
        d.quiz = quiz.filter(function (q) { return q.question && q.choix.filter(Boolean).length >= 2; });
        return (l.id ? envoyer('/lecons/' + l.id, 'PATCH', d) : envoyer('/lecons', 'POST', d)).then(function () { oublier('lecons'); toast('Leçon enregistrée.'); if (apres) apres(); });
      }, { large: true, apres: '<h3 style="margin:18px 0 8px;font-size:1rem">Quiz <span class="doux" style="font-weight:400;font-size:.82rem">— corrigé automatiquement, les réponses ne sont jamais montrées avant la validation</span></h3><div data-quiz></div><button class="cf-btn petit" type="button" data-ajout>+ Question</button>' });
      function peindre() {
        $('[data-quiz]', m.el).innerHTML = quiz.map(function (q, i) {
          return '<div class="cf-quiz-q" data-i="' + i + '"><div class="entete"><span>Question ' + (i + 1) + '</span><button type="button" class="cf-btn petit danger" data-retirer>Retirer</button></div>' +
            '<input class="cf-q" style="width:100%;padding:8px;border:1.5px solid var(--cf-ligne);border-radius:8px;margin-bottom:6px" value="' + e(q.question) + '" placeholder="Énoncé">' +
            q.choix.map(function (c, j) { return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px"><input type="radio" name="bonne-' + i + '" value="' + j + '"' + (q.bonne === j ? ' checked' : '') + ' title="Bonne réponse"><input class="cf-c" data-j="' + j + '" style="flex:1;padding:6px;border:1.5px solid var(--cf-ligne);border-radius:8px" value="' + e(c) + '" placeholder="Choix ' + (j + 1) + '"></div>'; }).join('') +
            '<input class="cf-x" style="width:100%;padding:6px;border:1.5px dashed var(--cf-ligne);border-radius:8px" value="' + e(q.explication) + '" placeholder="Explication affichée après la réponse (facultatif)"></div>';
        }).join('') || '<p class="doux" style="font-size:.85rem">Aucune question.</p>';
        $$('.cf-quiz-q', m.el).forEach(function (bloc) {
          var i = Number(bloc.getAttribute('data-i'));
          $('.cf-q', bloc).addEventListener('input', function (ev) { quiz[i].question = ev.target.value; });
          $('.cf-x', bloc).addEventListener('input', function (ev) { quiz[i].explication = ev.target.value; });
          $$('.cf-c', bloc).forEach(function (c) { c.addEventListener('input', function () { quiz[i].choix[Number(c.getAttribute('data-j'))] = c.value; }); });
          $$('[type=radio]', bloc).forEach(function (r) { r.addEventListener('change', function () { quiz[i].bonne = Number(r.value); }); });
          $('[data-retirer]', bloc).addEventListener('click', function () { quiz.splice(i, 1); peindre(); });
        });
      }
      $('[data-ajout]', m.el).addEventListener('click', function () { quiz.push({ question: '', choix: ['', '', '', ''], bonne: 0, explication: '' }); peindre(); });
      peindre();
      if (l.id && (unDe('directeur', 'prefet') || l.cree_par === etat.ctx.moi.id)) {
        $('footer', m.el).insertAdjacentHTML('afterbegin', '<button class="cf-btn danger" data-suppr style="margin-right:auto">Supprimer</button>');
        $('[data-suppr]', m.el).addEventListener('click', function () {
          if (!window.confirm('Supprimer cette leçon et la progression des apprenants ?')) return;
          api('/lecons/' + l.id, { method: 'DELETE' }).then(function () { m.fermer(); oublier('lecons'); toast('Leçon supprimée.'); if (apres) apres(); }).catch(echec);
        });
      }
    }).catch(echec);
  }

  /* ------------------------------------------------------------------ */
  /*  Évaluations                                                         */
  /* ------------------------------------------------------------------ */
  ROUTES.evaluations = function () {
    var z = page('Évaluations', 'Tests de placement, quiz, mi-parcours, examens finaux et oraux. Notes sur 100 par compétence : le niveau atteint met à jour le niveau de l’apprenant.', '<button class="cf-btn principal" data-saisir>Saisir une évaluation de groupe</button>');
    api('/evaluations').then(function (ev) {
      z.innerHTML = '<div class="cf-carte">' + tableau([
        { titre: 'Date', rendu: function (v) { return e(dateFr(v.date_evaluation)); } },
        { titre: 'Apprenant', rendu: function (v) { return '<strong>' + e(nomComplet(v)) + '</strong><div class="doux">' + e(v.groupe_nom || '') + '</div>'; } },
        { titre: 'Type', rendu: function (v) { return e(LIBELLES.type_eval[v.type]); } },
        { titre: 'Oral', num: true, rendu: function (v) { return nombre(v.score_oral, 0); } },
        { titre: 'Écrit', num: true, rendu: function (v) { return nombre(v.score_ecrit, 0); } },
        { titre: 'C. orale', num: true, rendu: function (v) { return nombre(v.score_comprehension_orale, 0); } },
        { titre: 'C. écrite', num: true, rendu: function (v) { return nombre(v.score_comprehension_ecrite, 0); } },
        { titre: 'Global', num: true, rendu: function (v) { return '<strong>' + nombre(v.score_global, 0) + '</strong>'; } },
        { titre: 'Niveau', rendu: function (v) { return e(v.niveau_atteint || '—'); } }
      ], ev, { videTitre: 'Aucune évaluation', vide: 'Saisissez les résultats d’un groupe en une fois.' }) + '</div>';
    }).catch(echec);
    $('[data-saisir]').addEventListener('click', function () {
      charger('groupes', '/groupes', true).then(function (gs) {
        modaleFormulaire('Choisir le groupe', [{ nom: 'groupe_id', libelle: 'Groupe', type: 'select', requis: true, plein: true, options: gs.map(function (g) { return [g.id, g.nom]; }) }], {}, function (d) {
          return api('/groupes/' + d.groupe_id).then(function (g) { saisirEvaluation(d.groupe_id, g.membres.filter(function (x) { return x.statut_inscription === 'active'; })); });
        }, { bouton: 'Continuer' });
      }).catch(echec);
    });
  };

  function saisirEvaluation(groupeId, membres) {
    var ling = etat.ctx.centre.linguistique;
    var cols = ling ? [['score_oral', 'Oral'], ['score_ecrit', 'Écrit'], ['score_comprehension_orale', 'C. orale'], ['score_comprehension_ecrite', 'C. écrite']] : [['score_global', 'Note /100']];
    var corps = formulaire([
      { nom: 'type', libelle: 'Type', type: 'select', vide: false, options: options('type_eval'), defaut: 'quiz' },
      { nom: 'date_evaluation', libelle: 'Date', type: 'date', defaut: aujourdhui() }
    ], {}) + '<div class="cf-table-zone" style="margin-top:12px"><table class="cf-table"><thead><tr><th>Apprenant</th>' + cols.map(function (c) { return '<th>' + e(c[1]) + '</th>'; }).join('') + '<th>Niveau</th><th>Commentaire</th></tr></thead><tbody>' +
      membres.map(function (x) {
        return '<tr data-id="' + e(x.id) + '"><td>' + e(nomComplet(x)) + '</td>' + cols.map(function (c) { return '<td><input type="number" min="0" max="100" data-c="' + c[0] + '" style="width:70px;padding:6px;border:1.5px solid var(--cf-ligne);border-radius:6px"></td>'; }).join('') +
          '<td><input data-c="niveau_atteint" style="width:64px;padding:6px;border:1.5px solid var(--cf-ligne);border-radius:6px" placeholder="auto"></td><td><input data-c="commentaire" style="width:180px;padding:6px;border:1.5px solid var(--cf-ligne);border-radius:6px"></td></tr>';
      }).join('') + '</tbody></table></div>' + (ling ? '<p class="doux" style="font-size:.8rem">Le score global est la moyenne des compétences saisies ; le niveau (A1…C1) est déduit si vous le laissez vide.</p>' : '');
    var m = modale('Saisie des résultats', membres.length ? corps : '<div class="cf-vide">Aucun apprenant actif dans ce groupe.</div>', { large: true, pied: '<button class="cf-btn" data-fermer>Annuler</button><button class="cf-btn principal" data-ok>Enregistrer</button>' });
    $('[data-ok]', m.el).addEventListener('click', function () {
      var f = $('form', m.el);
      var resultats = $$('tbody tr', m.el).map(function (tr) {
        var o = { apprenant_id: tr.getAttribute('data-id') };
        $$('[data-c]', tr).forEach(function (i) { if (i.value !== '') o[i.getAttribute('data-c')] = i.type === 'number' ? Number(i.value) : i.value; });
        return o;
      });
      envoyer('/evaluations', 'POST', { type: f.elements.type.value, date_evaluation: f.elements.date_evaluation.value, groupe_id: groupeId, resultats: resultats })
        .then(function (r) { m.fermer(); toast(r.enregistrees + ' résultat(s) enregistré(s).'); if (etat.route === 'evaluations') naviguer(); }).catch(echec);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Certificats                                                         */
  /* ------------------------------------------------------------------ */
  ROUTES.certificats = function () {
    var z = page('Certificats', 'À la place d’un bulletin : un certificat numéroté, avec un code que tout employeur peut vérifier sur votre site.', unDe('directeur', 'prefet') ? '<button class="cf-btn principal" data-delivrer>Délivrer un certificat</button>' : '');
    function lister() {
      api('/certificats').then(function (cs) {
        z.innerHTML = '<div class="cf-carte">' + tableau([
          { titre: 'Numéro', rendu: function (c) { return '<span class="cf-code">' + e(c.numero) + '</span>'; } },
          { titre: 'Apprenant', rendu: function (c) { return '<strong>' + e(nomComplet(c)) + '</strong><div class="doux">' + e(c.matricule) + '</div>'; } },
          { titre: 'Formation', rendu: function (c) { return e(c.programme_nom) + (c.niveau ? ' · ' + e(c.niveau) : ''); } },
          { titre: 'Mention', rendu: function (c) { return e(c.mention || '—'); } },
          { titre: 'Délivré le', rendu: function (c) { return e(dateFr(c.date_delivrance)); } },
          { titre: 'Code de vérification', rendu: function (c) { return '<span class="cf-code">' + e(c.code_verification) + '</span>'; } },
          { titre: '', rendu: function (c) { return c.statut === 'valide' ? '<button class="cf-btn petit" data-imprimer="' + e(c.id) + '">Imprimer</button>' + (a('directeur') ? ' <button class="cf-btn petit danger" data-revoquer="' + e(c.id) + '">Révoquer</button>' : '') : '<span class="cf-badge rouge">Révoqué</span>'; } }
        ], cs, { videTitre: 'Aucun certificat délivré', vide: 'Délivrez-le à la fin d’une formation, depuis un groupe terminé.' }) + '</div>';
        $$('[data-imprimer]', z).forEach(function (b) { b.addEventListener('click', function () { imprimerCertificat(b.getAttribute('data-imprimer')); }); });
        $$('[data-revoquer]', z).forEach(function (b) { b.addEventListener('click', function () { if (window.confirm('Révoquer ce certificat ? La vérification en ligne l’indiquera comme révoqué.')) envoyer('/certificats/' + b.getAttribute('data-revoquer') + '/revoquer', 'POST').then(function () { toast('Certificat révoqué.'); lister(); }).catch(echec); }); });
      }).catch(echec);
    }
    var bd = $('[data-delivrer]'); if (bd) bd.addEventListener('click', function () {
      charger('groupes', '/groupes', true).then(function (gs) {
        modaleFormulaire('Délivrer — choisir le groupe', [{ nom: 'groupe_id', libelle: 'Groupe', type: 'select', requis: true, plein: true, options: gs.map(function (g) { return [g.id, g.nom + ' (' + LIBELLES.statut_groupe[g.statut] + ')']; }) }], {}, function (d) {
          return api('/groupes/' + d.groupe_id).then(function (g) {
            var eligibles = g.membres.filter(function (x) { return !x.certifie && x.statut_inscription !== 'abandon'; });
            var m = modale('Délivrer les certificats — ' + g.groupe.nom, eligibles.length ? '<p class="doux">Cochez les apprenants qui ont validé la formation. La mention vient de leur examen final, les heures de leurs présences.</p>' + eligibles.map(function (x) {
              return '<label style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--cf-ligne)"><input type="checkbox" value="' + e(x.inscription_id) + '" checked> ' + e(nomComplet(x)) + ' <span class="doux">· présence ' + (x.taux_presence === null ? '—' : Math.round(x.taux_presence) + ' %') + '</span></label>';
            }).join('') : '<div class="cf-vide">Tous les apprenants de ce groupe ont déjà leur certificat.</div>', { pied: '<button class="cf-btn" data-fermer>Annuler</button><button class="cf-btn principal" data-ok>Délivrer</button>' });
            $('[data-ok]', m.el).addEventListener('click', function () {
              var ids = $$('input:checked', m.el).map(function (c) { return c.value; });
              ids.reduce(function (p, id) { return p.then(function () { return envoyer('/certificats', 'POST', { inscription_id: id }); }); }, Promise.resolve())
                .then(function () { m.fermer(); toast(ids.length + ' certificat(s) délivré(s).'); lister(); }).catch(echec);
            });
          });
        }, { bouton: 'Continuer' });
      }).catch(echec);
    });
    lister();
  };

  function fenetreImpression(titre, html) {
    var w = window.open('', '_blank');
    if (!w) { toast('Autorisez les fenêtres surgissantes pour imprimer.', true); return; }
    w.document.write('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>' + e(titre) + '</title><style>' +
      'body{font-family:Georgia,"Times New Roman",serif;color:#1F2B24;margin:0;padding:24px}@page{margin:12mm}' +
      '.cert{border:10px double #C98A3E;padding:48px 56px;text-align:center;max-width:900px;margin:auto;min-height:540px;position:relative}' +
      '.cert h1{font-size:44px;letter-spacing:.08em;margin:8px 0 4px;color:#A96F2E}.cert .centre{font-size:20px;letter-spacing:.05em;text-transform:uppercase}' +
      '.cert .nom{font-size:34px;margin:18px 0;border-bottom:1px solid #ccc;display:inline-block;padding:0 24px 6px}.cert p{font-size:17px;line-height:1.6}' +
      '.cert .bas{display:flex;justify-content:space-between;margin-top:46px;font-size:14px;text-align:left}.cert .verif{font-family:monospace;font-size:13px;color:#555;margin-top:28px}' +
      '.recu{font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #ddd;padding:24px}.recu h1{font-size:20px;margin:0}.recu table{width:100%;border-collapse:collapse;margin:14px 0}.recu td{padding:7px 4px;border-bottom:1px solid #eee;font-size:14px}.recu td:last-child{text-align:right}.recu .total{font-size:20px;font-weight:bold}' +
      '</style></head><body>' + html + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>');
    w.document.close();
  }

  /* Guilloché : un motif de rosace tracé en SVG, comme sur les diplômes et les
     billets. Impossible à reproduire proprement à la photocopieuse — c'est
     aussi pour cela qu'on l'emploie. */
  function guilloche(couleur, rayon, n, opacite) {
    var d = '';
    for (var k = 0; k < n; k++) {
      var pts = [];
      for (var t = 0; t <= 360; t += 3) {
        var rad = t * Math.PI / 180;
        var r = rayon * (0.72 + 0.28 * Math.cos(6 * rad + k * Math.PI / n));
        pts.push((r * Math.cos(rad + k * 0.12)).toFixed(1) + ',' + (r * Math.sin(rad + k * 0.12)).toFixed(1));
      }
      d += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + couleur + '" stroke-width=".45" opacity="' + opacite + '"/>';
    }
    return d;
  }
  function bordureGuilloche(couleur) {
    var motif = '';
    for (var k = 0; k < 7; k++) {
      var p = 'M0 ' + (6 + k * 0.6);
      for (var x = 0; x <= 240; x += 3) p += ' L' + x + ' ' + (6 + 5 * Math.sin((x + k * 4) / 6.5)).toFixed(2);
      motif += '<path d="' + p + '" fill="none" stroke="' + couleur + '" stroke-width=".35" opacity=".55"/>';
    }
    return motif;
  }

  function imprimerCertificat(id) {
    api('/certificats/' + id).then(function (c) {
      var m = c.modele || {}, couleur = /^#[0-9a-f]{6}$/i.test(m.couleur || '') ? m.couleur : '#1E4E8C', or = '#B08A3E';
      var logo = urlSure(c.logo_url), cachet = urlSure(c.cachet_url), sigChef = urlSure(c.signature_url), sigCoach = urlSure(c.signature_coach_url);
      var nom = nomComplet(c), annee = new Date(c.date_delivrance).getFullYear();
      var detail = [c.niveau ? 'Niveau <strong>' + e(c.niveau) + '</strong>' : '', m.afficher_mentions !== false && c.mention ? 'Mention <strong>' + e(c.mention) + '</strong>' : '', m.afficher_heures !== false && c.heures ? '<strong>' + e(nombre(c.heures)) + '</strong> heures de formation' : ''].filter(Boolean).join('<span class="sep">◆</span>');
      var sceau = '<svg class="sceau" viewBox="-60 -60 120 120" aria-hidden="true"><defs><radialGradient id="or" cx="35%" cy="30%"><stop offset="0" stop-color="#F6E3A1"/><stop offset=".55" stop-color="#D4AF5A"/><stop offset="1" stop-color="#9C7428"/></radialGradient>' +
        '<path id="arc" d="M0,0 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0"/></defs>' +
        '<path d="M-22 30 L-34 62 L-22 55 L-14 66 L-8 34 Z" fill="' + couleur + '"/><path d="M22 30 L34 62 L22 55 L14 66 L8 34 Z" fill="' + couleur + '"/>' +
        (function () { var d = ''; for (var k = 0; k < 36; k++) { var a = k * 10 * Math.PI / 180; d += (k ? ' L' : 'M') + (52 * Math.cos(a)).toFixed(1) + ' ' + (52 * Math.sin(a)).toFixed(1) + ' L' + (46 * Math.cos(a + 0.087)).toFixed(1) + ' ' + (46 * Math.sin(a + 0.087)).toFixed(1); } return '<path d="' + d + ' Z" fill="url(#or)"/>'; })() +
        '<circle r="43" fill="none" stroke="#FFF7DA" stroke-width="1.2" opacity=".8"/><circle r="31" fill="none" stroke="#8A6420" stroke-width=".8" stroke-dasharray="1.5 2"/>' +
        '<text font-family="Montserrat,Arial" font-size="6.6" font-weight="700" letter-spacing="1.6" fill="#5E4310"><textPath href="#arc" startOffset="2%">' + e(String(c.centre_nom).toUpperCase().slice(0, 34)) + ' ★ CERTIFIÉ ★</textPath></text>' +
        '<text y="4" text-anchor="middle" font-family="Cormorant Garamond,Georgia" font-size="' + (c.niveau && String(c.niveau).length > 3 ? 11 : 17) + '" font-weight="700" fill="#5E4310">' + e(c.niveau || '★') + '</text>' +
        '<text y="17" text-anchor="middle" font-family="Montserrat,Arial" font-size="6.5" font-weight="600" fill="#5E4310">' + annee + '</text></svg>';
      var signatures = '<div class="signature">' + (sigChef ? '<img src="' + e(sigChef) + '" alt="">' : '<div class="vide"></div>') + '<div class="trait"></div><strong>' + e(c.signataire || 'Le chef de centre') + '</strong><small>Chef de centre</small></div>' +
        (c.coach_nom ? '<div class="signature">' + (sigCoach ? '<img src="' + e(sigCoach) + '" alt="">' : '<div class="vide"></div>') + '<div class="trait"></div><strong>' + e(c.coach_nom) + '</strong><small>' + e(voc('coach', 'Coach')) + ' formateur</small></div>' : '');
      var verif = '<div class="verif">' + (c.qr_svg || '') + '<div><strong style="white-space:nowrap">N° ' + e(c.numero) + '</strong><br>Code de vérification<br><span class="code">' + e(c.code_verification) + '</span><br><small>Scannez pour vérifier l’authenticité</small></div></div>';
      var polices = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Great+Vibes&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">';
      var commun = '@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0;background:#fff}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        '.page{width:297mm;height:210mm;position:relative;overflow:hidden;font-family:Montserrat,Arial,sans-serif;color:#1d2430}' +
        '.nom{font-family:"Great Vibes","Allura","Brush Script MT","Segoe Script","Lucida Handwriting",cursive;font-size:46pt;line-height:1.1;color:#1d2430}.sep{color:' + or + ';margin:0 10px;font-size:8pt;vertical-align:2px}' +
        '.signature{width:58mm;text-align:center;font-size:8.5pt}.signature img{height:16mm;max-width:52mm;object-fit:contain;display:block;margin:0 auto -3mm}.signature .vide{height:13mm}.signature .trait{border-top:1px solid #1d2430;margin:0 4mm 1.5mm}.signature small{display:block;color:#6b7280;font-size:7.5pt}' +
        '.verif{display:flex;gap:3mm;align-items:center;font-size:7.4pt;line-height:1.45;color:#374151}.verif svg{width:22mm;height:22mm}.verif .code{font-family:"IBM Plex Mono",monospace;font-size:9pt;letter-spacing:1px;color:#111}' +
        '.sceau{width:34mm;height:34mm;filter:drop-shadow(0 1mm 1.2mm rgba(0,0,0,.25))}.cachet{position:absolute;width:30mm;height:30mm;object-fit:contain;opacity:.85;mix-blend-mode:multiply}';
      var html;
      if (m.modele === 'moderne') {
        html = '<style>' + commun + '.bande{position:absolute;left:0;top:0;bottom:0;width:78mm;background:' + couleur + ';color:#fff;padding:16mm 10mm;display:flex;flex-direction:column;align-items:center;text-align:center}' +
          '.bande img.logo{max-width:50mm;max-height:34mm;object-fit:contain;filter:drop-shadow(0 1mm 2mm rgba(0,0,0,.25))}.bande .centre{font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:10pt;margin-top:6mm}.bande .lieu{opacity:.8;font-size:8pt;margin-top:1mm}' +
          '.bande .niveau{margin-top:auto;border:1.5px solid rgba(255,255,255,.6);border-radius:50%;width:38mm;height:38mm;display:flex;flex-direction:column;align-items:center;justify-content:center}.bande .niveau b{font-size:24pt;font-family:"Cormorant Garamond",serif}.bande .niveau small{font-size:7pt;letter-spacing:.2em}' +
          '.contenu{position:absolute;left:78mm;right:0;top:0;bottom:0;padding:20mm 18mm 14mm 20mm;display:flex;flex-direction:column}' +
          '.titre{font-size:9pt;letter-spacing:.42em;color:' + couleur + ';font-weight:700}.grand{font-family:"Cormorant Garamond",serif;font-size:44pt;font-weight:600;margin:2mm 0 8mm;color:#111}' +
          '.texte{font-size:10.5pt;color:#4b5563}.formation{font-family:"Cormorant Garamond",serif;font-size:24pt;font-weight:600;color:' + couleur + ';margin:3mm 0}.detail{font-size:10pt;margin-top:3mm}' +
          '.pied{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:6mm}.filigrane{position:absolute;right:-20mm;bottom:-20mm;width:130mm;opacity:.05}' +
          '.rosace-m{position:absolute;right:-38mm;top:-38mm;width:130mm;height:130mm}.filet{width:60mm;height:1.2mm;background:linear-gradient(90deg,' + or + ',transparent);margin:-4mm 0 8mm}</style>' +
          '<div class="page"><svg class="rosace-m" viewBox="-100 -100 200 200">' + guilloche(couleur, 96, 12, .08) + '</svg><div class="bande">' + (logo ? '<img class="logo" src="' + e(logo) + '" alt="">' : '') + '<div class="centre">' + e(c.centre_nom) + '</div><div class="lieu">' + e([c.commune, c.ville].filter(Boolean).join(' · ')) + '</div>' +
          (c.niveau ? '<div class="niveau"><small>NIVEAU</small><b>' + e(c.niveau) + '</b></div>' : '') + '</div>' +
          (logo ? '<img class="filigrane" src="' + e(logo) + '" alt="">' : '') +
          '<div class="contenu"><div class="titre">CERTIFICAT DE FORMATION</div><div class="grand">Certificat</div><div class="filet"></div><div class="texte">Décerné à</div><div class="nom">' + e(nom) + '</div>' +
          '<div class="texte" style="margin-top:4mm">pour avoir suivi avec succès la formation</div><div class="formation">' + e(c.programme_nom) + '</div><div class="detail">' + detail + '</div>' +
          '<div class="texte" style="margin-top:5mm;font-size:9pt">Délivré à ' + e(c.ville || '') + ', le ' + e(dateFr(c.date_delivrance)) + '</div>' +
          '<div class="pied">' + verif + '<div style="display:flex;gap:6mm;position:relative">' + (cachet ? '<img class="cachet" style="left:8mm;top:-6mm" src="' + e(cachet) + '" alt="">' : '') + signatures + '</div></div></div></div>';
      } else if (m.modele === 'classique') {
        html = '<style>' + commun + '.page{padding:12mm}.cadre{height:100%;border:2.5px solid #1d2430;outline:1px solid #1d2430;outline-offset:-6px;padding:14mm 22mm;text-align:center;display:flex;flex-direction:column;align-items:center}' +
          '.entete img{max-height:22mm;max-width:50mm;object-fit:contain}.centre{font-family:"Cormorant Garamond",serif;font-size:17pt;letter-spacing:.12em;text-transform:uppercase;font-weight:600;margin-top:2mm}' +
          'h1{font-family:"Cormorant Garamond",serif;font-weight:500;font-size:38pt;letter-spacing:.3em;margin:6mm 0 2mm}.texte{font-family:"Cormorant Garamond",serif;font-size:14pt}.formation{font-family:"Cormorant Garamond",serif;font-size:21pt;font-weight:700;margin:2mm 0}' +
          '.pied{margin-top:auto;width:100%;display:flex;justify-content:space-between;align-items:flex-end}</style>' +
          '<div class="page"><div class="cadre"><div class="entete">' + (logo ? '<img src="' + e(logo) + '" alt="">' : '') + '<div class="centre">' + e(c.centre_nom) + '</div></div><h1>CERTIFICAT</h1><div class="texte">Nous certifions que</div><div class="nom" style="margin:3mm 0">' + e(nom) + '</div>' +
          '<div class="texte">a suivi avec succès la formation</div><div class="formation">' + e(c.programme_nom) + '</div><div class="texte" style="font-size:12pt">' + detail + '</div>' +
          '<div class="texte" style="font-size:11pt;margin-top:4mm">Fait à ' + e(c.ville || '') + ', le ' + e(dateFr(c.date_delivrance)) + '</div>' +
          '<div class="pied">' + verif + '<div style="display:flex;gap:6mm;position:relative">' + (cachet ? '<img class="cachet" style="left:8mm;top:-8mm" src="' + e(cachet) + '" alt="">' : '') + signatures + '</div></div></div></div>';
      } else {
        // PRESTIGE
        html = '<style>' + commun + '.fond{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,#fffdf6 0%,#fbf5e6 60%,#f3e8cc 100%)}' +
          '.bord{position:absolute;inset:7mm;border:1.6mm solid ' + couleur + ';}.bord2{position:absolute;inset:10.5mm;border:.4mm solid ' + or + '}.bord3{position:absolute;inset:12mm;border:.2mm solid ' + or + '}' +
          '.frise{position:absolute;left:12mm;right:12mm;height:12px}.frise svg{width:100%;height:12px}.frise.h{top:13mm}.frise.b{bottom:13mm;transform:scaleY(-1)}' +
          '.rosace{position:absolute;width:120mm;height:120mm;left:50%;top:50%;transform:translate(-50%,-52%);opacity:.9}' +
          '.coin{position:absolute;width:22mm;height:22mm}.coin svg{width:100%;height:100%}.c1{left:11mm;top:11mm}.c2{right:11mm;top:11mm;transform:scaleX(-1)}.c3{left:11mm;bottom:11mm;transform:scaleY(-1)}.c4{right:11mm;bottom:11mm;transform:scale(-1,-1)}' +
          '.filigrane{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:120mm;max-height:110mm;opacity:.06}' +
          '.contenu{position:absolute;inset:20mm 34mm 21mm;display:flex;flex-direction:column;align-items:center;text-align:center}' +
          '.entete{display:flex;align-items:center;gap:5mm}.entete img{max-height:20mm;max-width:42mm;object-fit:contain}.centre{font-family:"Cormorant Garamond",serif;font-size:16pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:' + couleur + '}.lieu{font-size:7.5pt;letter-spacing:.3em;color:#6b7280;text-transform:uppercase}' +
          '.sur{font-size:8.5pt;letter-spacing:.5em;color:' + or + ';font-weight:600;margin-top:6mm}h1{font-family:"Cormorant Garamond",serif;font-size:50pt;font-weight:600;letter-spacing:.12em;margin:0;color:#1d2430;line-height:1}' +
          '.orn{color:' + or + ';letter-spacing:6px;font-size:10pt;margin:1mm 0 3mm}.texte{font-family:"Cormorant Garamond",serif;font-size:14pt;color:#374151;font-style:italic}' +
          '.nom{margin:1mm 0 0}.soul{width:120mm;height:4mm}.formation{font-family:"Cormorant Garamond",serif;font-size:23pt;font-weight:700;color:' + couleur + ';margin:1mm 0 2mm}.detail{font-size:9.5pt;letter-spacing:.04em}' +
          '.pied{margin-top:auto;width:100%;display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:6mm}.pied .gauche{justify-self:start}.pied .droite{justify-self:end;display:flex;gap:4mm;position:relative}.date{font-size:8.5pt;color:#4b5563;margin-top:2mm}</style>' +
          '<div class="page"><div class="fond"></div><svg class="rosace" viewBox="-100 -100 200 200">' + guilloche(or, 96, 14, .11) + guilloche(couleur, 60, 10, .06) + '</svg>' +
          (logo ? '<img class="filigrane" src="' + e(logo) + '" alt="">' : '') +
          '<div class="bord"></div><div class="bord2"></div><div class="bord3"></div>' +
          '<div class="frise h"><svg viewBox="0 0 240 12" preserveAspectRatio="none">' + bordureGuilloche(or) + '</svg></div><div class="frise b"><svg viewBox="0 0 240 12" preserveAspectRatio="none">' + bordureGuilloche(or) + '</svg></div>' +
          [1, 2, 3, 4].map(function (k) { return '<div class="coin c' + k + '"><svg viewBox="0 0 40 40"><path d="M2 38 C2 18 18 2 38 2" fill="none" stroke="' + or + '" stroke-width="1.2"/><path d="M8 38 C8 22 22 8 38 8" fill="none" stroke="' + couleur + '" stroke-width=".8"/><circle cx="10" cy="10" r="3.2" fill="' + or + '"/></svg></div>'; }).join('') +
          '<div class="contenu"><div class="entete">' + (logo ? '<img src="' + e(logo) + '" alt="">' : '') + '<div><div class="centre">' + e(c.centre_nom) + '</div><div class="lieu">' + e([c.commune, c.ville].filter(Boolean).join(' · ')) + '</div></div></div>' +
          '<div class="sur">CERTIFICAT DE RÉUSSITE</div><h1>Certificat</h1><div class="orn">◆ ◆ ◆</div><div class="texte">Il est certifié que</div>' +
          '<div class="nom">' + e(nom) + '</div><svg class="soul" viewBox="0 0 300 10"><path d="M0 5 Q75 0 150 5 T300 5" fill="none" stroke="' + or + '" stroke-width="1"/></svg>' +
          '<div class="texte">a suivi avec succès et assiduité la formation</div><div class="formation">' + e(c.programme_nom) + '</div><div class="detail">' + detail + '</div>' +
          '<div class="pied"><div class="gauche">' + verif + '</div><div style="text-align:center">' + sceau + '<div class="date">Fait à ' + e(c.ville || '') + ', le ' + e(dateFr(c.date_delivrance)) + '</div></div>' +
          '<div class="droite">' + (cachet ? '<img class="cachet" style="right:30mm;top:-12mm" src="' + e(cachet) + '" alt="">' : '') + signatures + '</div></div></div></div>';
      }
      var w = window.open('', '_blank');
      if (!w) { toast('Autorisez les fenêtres surgissantes pour imprimer.', true); return; }
      w.document.write('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Certificat ' + e(c.numero) + ' — ' + e(nom) + '</title>' + polices + '</head><body>' + html +
        '<script>(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print()},400)})<\/script></body></html>');
      w.document.close();
    }).catch(echec);
  }
  function imprimerRecu(id) {
    api('/paiements/' + id + '/recu').then(function (p) {
      fenetreImpression('Reçu ' + p.numero_recu, '<div class="recu">' + (urlSure(p.logo_url) ? '<img src="' + e(p.logo_url) + '" alt="" style="max-height:50px;float:right">' : '') + '<h1>' + e(p.centre_nom) + '</h1><div style="font-size:13px;color:#666">' + e([p.adresse, p.commune, p.ville].filter(Boolean).join(', ')) + (p.centre_telephone ? ' · ' + e(p.centre_telephone) : '') + '</div>' +
        '<h2 style="font-size:16px;margin:18px 0 4px">REÇU N° ' + e(p.numero_recu) + (p.annule ? ' — ANNULÉ' : '') + '</h2><div style="font-size:13px">Date : ' + e(dateFr(p.date_paiement)) + '</div>' +
        '<table><tr><td>Apprenant</td><td>' + e(nomComplet(p)) + ' (' + e(p.matricule) + ')</td></tr><tr><td>Formation</td><td>' + e([p.programme_nom, p.groupe_nom].filter(Boolean).join(' — ') || '—') + '</td></tr>' +
        '<tr><td>Mode de paiement</td><td>' + e(LIBELLES.paiement[p.mode] || p.mode) + (p.reference ? ' · réf. ' + e(p.reference) : '') + '</td></tr>' +
        '<tr><td class="total">Montant reçu</td><td class="total">' + argent(p.montant, p.devise) + '</td></tr>' +
        (p.reste !== null ? '<tr><td>Reste à payer sur la formation</td><td>' + argent(p.reste, p.devise_reference || p.devise) + '</td></tr>' : '') + '</table>' +
        '<div style="font-size:13px">Encaissé par : ' + e(p.caissier || '—') + '</div><div style="margin-top:40px;font-size:13px">Signature et cachet</div></div>');
    }).catch(echec);
  }

  /* ------------------------------------------------------------------ */
  /*  Finances                                                            */
  /* ------------------------------------------------------------------ */
  var ongletFinances = 'encaissements';
  ROUTES.finances = function () {
    var caisse = unDe('directeur', 'comptable') || (a('secretaire') && acces('accueil_finances')) || (a('prefet') && acces('adjoint_finances'));
    var z = page('Finances', 'Encaissements, dépenses, paie des coachs et bilan. Chaque montant garde sa devise ; les totaux sont convertis au taux du centre.',
      '<button class="cf-btn principal" data-encaisser>+ Encaisser</button>' + (caisse ? '<button class="cf-btn" data-depense>+ Dépense</button>' : ''));
    var onglets = [['encaissements', 'Encaissements'], ['impayes', 'Restes à payer']];
    if (caisse) onglets = onglets.concat([['depenses', 'Dépenses'], ['paie', 'Paie des coachs'], ['bilan', 'Bilan']]);
    if (!onglets.some(function (o) { return o[0] === ongletFinances; })) ongletFinances = 'encaissements';
    z.innerHTML = '<div class="cf-onglets">' + onglets.map(function (o) { return '<button data-o="' + o[0] + '"' + (o[0] === ongletFinances ? ' class="actif"' : '') + '>' + o[1] + '</button>'; }).join('') + '</div><div data-volet><div class="cf-chargement">Chargement…</div></div>';
    var volet = $('[data-volet]', z);
    var V = {
      encaissements: function () {
        var du = aujourdhui(-30);
        api('/paiements?du=' + du).then(function (ps) {
          var parDevise = {}; ps.filter(function (p) { return !p.annule; }).forEach(function (p) { parDevise[p.devise] = (parDevise[p.devise] || 0) + Number(p.montant); });
          volet.innerHTML = '<div class="cf-grille-kpi">' + Object.keys(parDevise).map(function (d) { return kpi('Encaissé sur 30 jours (' + d + ')', argent(parDevise[d], d)); }).join('') + kpi('Reçus émis', ps.length) + '</div><div class="cf-carte">' + tableau([
            { titre: 'Reçu', rendu: function (p) { return '<span class="cf-code">' + e(p.numero_recu) + '</span>'; } },
            { titre: 'Date', rendu: function (p) { return e(dateFr(p.date_paiement)); } },
            { titre: 'Apprenant', rendu: function (p) { return e(nomComplet(p)) + '<div class="doux">' + e(p.groupe_nom || '') + '</div>'; } },
            { titre: 'Mode', rendu: function (p) { return e(LIBELLES.paiement[p.mode]) + (p.reference ? '<div class="doux">' + e(p.reference) + '</div>' : ''); } },
            { titre: 'Montant', num: true, rendu: function (p) { return (p.annule ? '<s>' : '<strong>') + argent(p.montant, p.devise) + (p.annule ? '</s>' : '</strong>'); } },
            { titre: '', rendu: function (p) { return '<button class="cf-btn petit" data-recu="' + e(p.id) + '">Reçu</button>' + (caisse && !p.annule ? ' <button class="cf-btn petit danger" data-annul="' + e(p.id) + '">Annuler</button>' : p.annule ? ' <span class="cf-badge rouge" title="' + e(p.motif_annulation || '') + '">Annulé</span>' : ''); } }
          ], ps, { videTitre: 'Aucun encaissement sur 30 jours' }) + '</div>';
          $$('[data-recu]', volet).forEach(function (b) { b.addEventListener('click', function () { imprimerRecu(b.getAttribute('data-recu')); }); });
          $$('[data-annul]', volet).forEach(function (b) { b.addEventListener('click', function () { var motif = window.prompt('Motif de l’annulation du reçu :'); if (motif) envoyer('/paiements/' + b.getAttribute('data-annul') + '/annuler', 'POST', { motif: motif }).then(function () { toast('Reçu annulé.'); V.encaissements(); }).catch(echec); }); });
        }).catch(function (err) { volet.innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
      },
      impayes: function () {
        var source = caisse ? api('/bilan?mois=1').then(function (b) { return b.impayes; }) : api('/kpi/apprenants').then(function (d) { return d.apprenants.filter(function (x) { return x.indicateurs.solde > 0; }).map(function (x) { return { id: x.id, nom: x.nom, prenom: x.prenom, telephone: x.telephone, matricule: x.matricule, groupe_nom: x.groupes, reste: x.indicateurs.solde, devise: deviseCentre() }; }); });
        source.then(function (lignes) {
          volet.innerHTML = '<div class="cf-carte">' + tableau([
            { titre: 'Apprenant', rendu: function (x) { return '<strong>' + e(nomComplet(x)) + '</strong><div class="doux">' + e(x.matricule) + '</div>'; } },
            { titre: 'Formation', rendu: function (x) { return e(x.groupe_nom || '—'); } },
            { titre: 'Reste', num: true, rendu: function (x) { return '<strong style="color:var(--cf-rouge)">' + argent(x.reste, x.devise) + '</strong>'; } },
            { titre: '', rendu: function (x) { var w = lienWhatsApp(x.telephone, 'Bonjour ' + (x.prenom || x.nom) + ', petit rappel amical de ' + etat.ctx.centre.nom + ' : il reste un solde à régler pour votre formation. Vous pouvez payer à l’accueil ou par mobile money. Merci !'); return (w ? '<a class="cf-btn petit" target="_blank" rel="noopener" href="' + e(w) + '">Relancer</a> ' : '') + '<button class="cf-btn petit principal" data-payer="' + e(x.id) + '">Encaisser</button>'; } }
          ], lignes, { videTitre: 'Aucun impayé', vide: 'Toutes les formations en cours sont réglées.' }) + '</div>';
          $$('[data-payer]', volet).forEach(function (b) { b.addEventListener('click', function () { nouvelEncaissement({ apprenantId: b.getAttribute('data-payer') }, V.impayes); }); });
        }).catch(function (err) { volet.innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
      },
      depenses: function () {
        api('/depenses?du=' + aujourdhui(-90)).then(function (ds) {
          volet.innerHTML = '<div class="cf-carte"><h2>Dépenses des 90 derniers jours</h2>' + tableau([
            { titre: 'Date', rendu: function (d) { return e(dateFr(d.date_depense)); } },
            { titre: 'Catégorie', rendu: function (d) { return e(LIBELLES.depense[d.categorie]); } },
            { titre: 'Libellé', rendu: function (d) { return e(d.libelle) + (d.coach_nom ? '<div class="doux">' + e(d.coach_nom) + '</div>' : ''); } },
            { titre: 'Montant', num: true, rendu: function (d) { return argent(d.montant, d.devise); } },
            { titre: '', rendu: function (d) { return '<button class="cf-btn petit danger" data-suppr="' + e(d.id) + '">Supprimer</button>'; } }
          ], ds, { videTitre: 'Aucune dépense' }) + '</div>';
          $$('[data-suppr]', volet).forEach(function (b) { b.addEventListener('click', function () { if (window.confirm('Supprimer cette dépense ?')) api('/depenses/' + b.getAttribute('data-suppr'), { method: 'DELETE' }).then(function () { toast('Dépense supprimée.'); V.depenses(); }).catch(echec); }); });
        }).catch(function (err) { volet.innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
      },
      paie: function () {
        var d = new Date(), du = new Date(d.getFullYear(), d.getMonth(), 1), au = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        var iso = function (x) { return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
        volet.innerHTML = '<div class="cf-filtres"><label class="doux">Du <input type="date" data-du value="' + iso(du) + '"></label><label class="doux">au <input type="date" data-au value="' + iso(au) + '"></label><button class="cf-btn" data-calc>Calculer</button></div><div data-paie></div>';
        function calc() {
          var q = '?du=' + $('[data-du]', volet).value + '&au=' + $('[data-au]', volet).value;
          api('/paie' + q).then(function (p) {
            $('[data-paie]', volet).innerHTML = '<div class="cf-encadre">Calcul : heures des séances <strong>données</strong> (appel fait) × rémunération horaire du coach. Une séance sans appel n’est pas payée : elle n’a pas eu lieu pour le système.</div><div class="cf-carte">' + tableau([
              { titre: 'Coach', rendu: function (c) { return '<strong>' + e(c.coach_nom) + '</strong>'; } },
              { titre: 'Séances', num: true, rendu: function (c) { return c.seances; } },
              { titre: 'Heures', num: true, rendu: function (c) { return nombre(c.heures, 2) + ' h'; } },
              { titre: 'Taux', num: true, rendu: function (c) { return argent(c.taux_horaire, c.devise) + '/h'; } },
              { titre: 'Dû', num: true, rendu: function (c) { return '<strong>' + argent(c.montant, c.devise) + '</strong>'; } },
              { titre: 'Déjà payé', num: true, rendu: function (c) { return argent(c.deja_paye, c.devise); } },
              { titre: '', rendu: function (c) { return c.reste > 0 ? '<button class="cf-btn petit principal" data-payer-coach="' + e(c.coach_id) + '">Payer ' + argent(c.reste, c.devise) + '</button>' : '<span class="cf-badge vert">Réglé</span>'; } }
            ], p.coachs, { videTitre: 'Aucun coach' }) + '</div>';
            $$('[data-payer-coach]', volet).forEach(function (b) {
              b.addEventListener('click', function () {
                if (!window.confirm('Enregistrer ce paiement comme dépense « Paie des coachs » ?')) return;
                envoyer('/paie', 'POST', { coach_id: b.getAttribute('data-payer-coach'), du: p.du, au: p.au }).then(function () { toast('Paie enregistrée.'); calc(); }).catch(echec);
              });
            });
          }).catch(echec);
        }
        $('[data-calc]', volet).addEventListener('click', calc); calc();
      },
      bilan: function () {
        api('/bilan?mois=12').then(function (b) {
          var t = b.totaux;
          volet.innerHTML = '<div class="cf-grille-kpi">' + kpi('Encaissé (12 mois)', argent(t.encaissements, b.devise)) + kpi('Dépensé (12 mois)', argent(t.depenses, b.devise)) +
            kpi('Résultat', argent(t.resultat, b.devise), t.marge !== null ? 'Marge : ' + nombre(t.marge) + ' %' : '', t.resultat >= 0 ? 'hausse' : 'baisse') + kpi('Reste à encaisser', argent(t.impayes, b.devise)) + '</div>' +
            '<div class="cf-carte"><h2>Évolution mensuelle <small>en ' + e(b.devise) + (b.taux_change_usd_fc ? ' · taux ' + nombre(b.taux_change_usd_fc, 0) + ' FC/$' : '') + '</small></h2>' + graphiqueMensuel(b) + '</div>' +
            '<div class="cf-deux"><div class="cf-carte"><h2>Revenus par programme</h2>' + tableau([
              { titre: 'Programme', rendu: function (p) { return e(p.programme); } }, { titre: 'Apprenants', num: true, rendu: function (p) { return p.apprenants; } },
              { titre: 'Encaissé', num: true, rendu: function (p) { return argent(p.total, b.devise); } }
            ], b.revenus_par_programme) + '</div><div class="cf-carte"><h2>Dépenses par catégorie</h2>' + tableau([
              { titre: 'Catégorie', rendu: function (d) { return e(LIBELLES.depense[d.categorie]); } }, { titre: 'Montant', num: true, rendu: function (d) { return argent(d.total, b.devise); } }
            ], b.depenses_par_categorie) + '</div></div>' +
            '<p><button class="cf-btn" data-export>Exporter le bilan (CSV)</button></p>';
          brancherBulles(volet);
          $('[data-export]', volet).addEventListener('click', function () { exporterCsv('bilan-centre.csv', ['Mois', 'Encaissements', 'Dépenses', 'Résultat'], b.mensuel.map(function (m) { return [m.mois, m.encaissements, m.depenses, m.resultat]; })); });
        }).catch(function (err) { volet.innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
      }
    };
    $$('[data-o]', z).forEach(function (b) { b.addEventListener('click', function () { ongletFinances = b.getAttribute('data-o'); $$('[data-o]', z).forEach(function (x) { x.classList.toggle('actif', x === b); }); volet.innerHTML = '<div class="cf-chargement">Chargement…</div>'; V[ongletFinances](); }); });
    $('[data-encaisser]').addEventListener('click', function () { nouvelEncaissement({}, function () { V[ongletFinances](); }); });
    var bd = $('[data-depense]'); if (bd) bd.addEventListener('click', function () {
      charger('coachs', '/coachs').then(function (cs) {
        modaleFormulaire('Nouvelle dépense', [
          { nom: 'categorie', libelle: 'Catégorie', type: 'select', requis: true, options: options('depense') }, { nom: 'date_depense', libelle: 'Date', type: 'date', defaut: aujourdhui() },
          { nom: 'libelle', libelle: 'Libellé', requis: true, plein: true }, { nom: 'montant', libelle: 'Montant', type: 'nombre', requis: true },
          { nom: 'devise', libelle: 'Devise', type: 'select', vide: false, options: [['USD', 'USD'], ['FC', 'FC']], defaut: deviseCentre() },
          { nom: 'coach_id', libelle: 'Coach concerné (paie)', type: 'select', options: cs.map(function (c) { return [c.id, nomComplet(c)]; }) },
          { nom: 'note', libelle: 'Note', type: 'textarea', plein: true, lignes: 2 }
        ], {}, function (d) { return envoyer('/depenses', 'POST', d).then(function () { toast('Dépense enregistrée.'); V[ongletFinances](); }); });
      }).catch(echec);
    });
    V[ongletFinances]();
  };

  function nouvelEncaissement(contexte, apres) {
    var preparer = contexte.apprenant ? Promise.resolve({ apprenant: contexte.apprenant, inscriptions: contexte.inscriptions || [] })
      : contexte.apprenantId ? api('/apprenants/' + contexte.apprenantId).then(function (d) { return { apprenant: d.identite, inscriptions: d.inscriptions }; })
      : api('/apprenants?statut=actif').then(function (liste) { return { liste: liste }; });
    preparer.then(function (p) {
      var champs = [];
      if (p.liste) champs.push({ nom: 'apprenant_id', libelle: 'Apprenant', type: 'select', requis: true, plein: true, options: p.liste.map(function (x) { return [x.id, nomComplet(x) + ' — ' + x.matricule + (x.solde > 0 ? ' (reste ' + argent(x.solde) + ')' : '')]; }) });
      if (p.inscriptions && p.inscriptions.length) champs.push({ nom: 'inscription_id', libelle: 'Formation', type: 'select', plein: true, vide: '— Automatique —', options: p.inscriptions.filter(function (i) { return i.statut !== 'abandon'; }).map(function (i) { var reste = Number(i.montant_du) - Number(i.remise) - Number(i.paye); return [i.id, i.groupe_nom + ' — reste ' + argent(reste, i.devise)]; }) });
      champs = champs.concat([
        { nom: 'montant', libelle: 'Montant reçu', type: 'nombre', requis: true }, { nom: 'devise', libelle: 'Devise', type: 'select', vide: false, options: [['USD', 'USD'], ['FC', 'FC']], defaut: deviseCentre() },
        { nom: 'mode', libelle: 'Mode', type: 'select', vide: false, options: options('paiement'), defaut: 'especes' }, { nom: 'reference', libelle: 'Référence (mobile money, banque)' },
        { nom: 'date_paiement', libelle: 'Date', type: 'date', defaut: aujourdhui() }, { nom: 'note', libelle: 'Note', plein: true }
      ]);
      modaleFormulaire('Encaisser' + (p.apprenant ? ' — ' + nomComplet(p.apprenant) : ''), champs, {}, function (d) {
        if (p.apprenant) d.apprenant_id = p.apprenant.id;
        return envoyer('/paiements', 'POST', d).then(function (r) {
          modale('Paiement enregistré', '<p>Reçu <span class="cf-code">' + e(r.numero_recu) + '</span> — ' + argent(r.montant, r.devise) + '.</p>', { pied: '<button class="cf-btn" data-fermer>Fermer</button><button class="cf-btn principal" data-imp>Imprimer le reçu</button>' })
            .el.querySelector('[data-imp]').addEventListener('click', function () { imprimerRecu(r.id); });
          if (apres) apres();
        });
      }, { bouton: 'Encaisser et émettre le reçu' });
    }).catch(echec);
  }

  /* ------------------------------------------------------------------ */
  /*  Demandes du site                                                    */
  /* ------------------------------------------------------------------ */
  ROUTES.demandes = function () {
    var z = page('Demandes du site', 'Préinscriptions, tests de niveau passés en ligne et messages arrivés par votre site. Rappelez vite : c’est là que se gagnent les inscriptions.', '<a class="cf-btn" href="#/site">Partager le site</a>');
    function lister() {
      api('/demandes').then(function (ds) {
        z.innerHTML = '<div class="cf-carte">' + tableau([
          { titre: 'Reçue', rendu: function (d) { return e(dateFr(d.created_at)); } },
          { titre: 'Type', rendu: function (d) { return '<span class="cf-badge ' + (d.type === 'test_niveau' ? 'bleu' : d.type === 'preinscription' ? 'vert' : '') + '">' + e(LIBELLES.demande[d.type] || d.type) + '</span>'; } },
          { titre: 'Personne', rendu: function (d) { return '<strong>' + e(d.nom) + '</strong><div class="doux">' + e([d.telephone, d.email].filter(Boolean).join(' · ')) + '</div>'; } },
          { titre: 'Détail', rendu: function (d) {
            var x = d.donnees || {};
            if (d.type === 'test_niveau') return 'Niveau <strong>' + e(x.niveau) + '</strong> (' + e(x.score) + ' %)' + (x.objectif ? '<div class="doux">' + e(x.objectif) + '</div>' : '');
            if (d.type === 'preinscription') return e(x.programme_souhaite || x.classe_souhaitee || '') + (x.disponibilites ? '<div class="doux">Disponible : ' + e(x.disponibilites) + '</div>' : '');
            return e((d.message || '').slice(0, 120));
          } },
          { titre: 'Statut', rendu: function (d) { return badgeStatut('', d.statut); } },
          { titre: '', rendu: function (d) {
            var w = lienWhatsApp(d.telephone, 'Bonjour ' + d.nom.split(' ')[0] + ', merci pour votre intérêt pour ' + etat.ctx.centre.nom + ' ! ');
            return (w ? '<a class="cf-btn petit" target="_blank" rel="noopener" href="' + e(w) + '">WhatsApp</a> ' : '') + (d.statut !== 'traitee' && d.statut !== 'archivee' ? '<button class="cf-btn petit principal" data-conv="' + e(d.id) + '">Inscrire</button> <button class="cf-btn petit" data-arch="' + e(d.id) + '">Archiver</button>' : '');
          } }
        ], ds, { videTitre: 'Aucune demande', vide: 'Partagez l’adresse de votre site sur WhatsApp, Facebook et vos affiches.' }) + '</div>';
        $$('[data-arch]', z).forEach(function (b) { b.addEventListener('click', function () { envoyer('/demandes/' + b.getAttribute('data-arch'), 'PATCH', { statut: 'archivee' }).then(lister).catch(echec); }); });
        $$('[data-conv]', z).forEach(function (b) {
          b.addEventListener('click', function () {
            groupesOptions().then(function (opts) {
              modaleFormulaire('Convertir en apprenant', [
                { nom: 'groupe_id', libelle: 'Inscrire dans le groupe', type: 'select', vide: '— Plus tard (prospect) —', options: opts, plein: true },
                { nom: 'montant_du', libelle: 'Montant de la formation', type: 'nombre', aide: 'Vide : prix du programme.' }, { nom: 'remise', libelle: 'Remise', type: 'nombre' }
              ], {}, function (d) {
                return envoyer('/demandes/' + b.getAttribute('data-conv') + '/convertir', 'POST', d).then(function (r) { oublier('groupes'); etat.ctx.compteurs.demandes_nouvelles = Math.max(0, etat.ctx.compteurs.demandes_nouvelles - 1); dessinerRail(); naviguer(); afficherIdentifiants(r); });
              }, { bouton: 'Créer l’apprenant' });
            });
          });
        });
      }).catch(echec);
    }
    lister();
  };

  /* ------------------------------------------------------------------ */
  /*  Assistant IA                                                        */
  /* ------------------------------------------------------------------ */
  var MODES_IA = [
    ['lecon', 'Préparer une leçon', 'Objectifs, déroulé, vocabulaire, exercices et quiz corrigé, prêt à publier.'],
    ['quiz', 'Créer un quiz', 'Questions à choix multiples avec explications, sur le sujet de votre choix.'],
    ['message', 'Rédiger un message', 'Bienvenue, absence, relance de paiement, nouveau groupe… prêt pour WhatsApp.'],
    ['analyse', 'Analyser mon centre', 'Lecture de vos indicateurs et plan d’action priorisé (direction).'],
    ['question', 'Poser une question', 'Pédagogie, marketing, organisation : avec les chiffres de votre centre.']
  ];
  ROUTES.assistant = function () {
    var modes = MODES_IA.filter(function (m) { return !((m[0] === 'analyse' || m[0] === 'question') && coachSeul()); });
    var initial = (window.location.hash.split('?')[1] || '').trim();
    var mode = modes.some(function (m) { return m[0] === initial; }) ? initial : modes[0][0];
    var z = page('Assistant IA', 'Un assistant qui connaît votre centre. Il propose ; vous relisez et décidez. Aucune donnée personnelle de vos apprenants ne lui est transmise, hormis leur prénom quand vous lui demandez un message.');
    z.innerHTML = '<div class="cf-ia-modes">' + modes.map(function (m) { return '<button data-mode="' + m[0] + '"><b>' + e(m[1]) + '</b><span>' + e(m[2]) + '</span></button>'; }).join('') + '</div><div class="cf-carte" data-form></div><div data-sortie></div>';
    function choisir(md) {
      mode = md;
      $$('[data-mode]', z).forEach(function (b) { b.classList.toggle('actif', b.getAttribute('data-mode') === md); });
      var niveau = etat.ctx.centre.linguistique ? 'A2' : 'Débutant';
      var C = {
        lecon: [{ nom: 'theme', libelle: 'Thème de la leçon', requis: true, plein: true, placeholder: 'ex. Se présenter en entretien d’embauche' }, { nom: 'niveau', libelle: 'Niveau', defaut: niveau }, { nom: 'duree_minutes', libelle: 'Durée de la séance (min)', type: 'nombre', defaut: 90 }, { nom: 'public', libelle: 'Public', plein: true, placeholder: 'ex. jeunes diplômés, employés de banque' }, { nom: 'consigne', libelle: 'Consignes particulières', type: 'textarea', plein: true, lignes: 2 }],
        quiz: [{ nom: 'sujet', libelle: 'Sujet', requis: true, plein: true }, { nom: 'niveau', libelle: 'Niveau', defaut: niveau }, { nom: 'nombre', libelle: 'Nombre de questions', type: 'nombre', defaut: 8 }],
        message: [{ nom: 'objet', libelle: 'Objet', type: 'select', vide: false, options: [['bienvenue', 'Bienvenue'], ['rappel_seance', 'Rappel de séance'], ['absence', 'Après des absences'], ['relance_paiement', 'Relance de paiement'], ['felicitations', 'Félicitations'], ['promotion', 'Nouveau groupe / promotion'], ['libre', 'Autre']] }, { nom: 'langue', libelle: 'Langue', type: 'select', vide: false, options: [['fr', 'Français'], ['en', 'Anglais']] }, { nom: 'apprenant_id', libelle: 'Apprenant (facultatif)', type: 'select', plein: true, vide: '— Message collectif —', options: [] }, { nom: 'consigne', libelle: 'Précisions', type: 'textarea', plein: true, lignes: 2 }],
        analyse: [{ nom: 'consigne', libelle: 'Votre préoccupation du moment (facultatif)', type: 'textarea', plein: true, lignes: 2, placeholder: 'ex. Les inscriptions baissent depuis septembre' }],
        question: [{ nom: 'question', libelle: 'Votre question', type: 'textarea', requis: true, plein: true, lignes: 3, placeholder: 'ex. Comment réduire les abandons au deuxième mois ?' }]
      }[md];
      var zf = $('[data-form]', z);
      zf.innerHTML = formulaire(C, {}) + '<div style="margin-top:12px;display:flex;justify-content:flex-end"><button class="cf-btn principal" data-generer>✦ Générer</button></div>';
      if (md === 'message') api('/apprenants?statut=actif').then(function (ls) {
        var sel = zf.querySelector('[name=apprenant_id]');
        ls.forEach(function (x) { var o = document.createElement('option'); o.value = x.id; o.textContent = nomComplet(x); sel.appendChild(o); });
      }).catch(function () {});
      $('[data-generer]', zf).addEventListener('click', function () {
        var d = lire($('form', zf), C);
        var manque = C.filter(function (c) { return c.requis && !d[c.nom]; })[0];
        if (manque) { toast('« ' + manque.libelle + ' » est requis.', true); return; }
        d.mode = md;
        var bt = this; bt.disabled = true; bt.textContent = 'L’assistant réfléchit…';
        $('[data-sortie]', z).innerHTML = '<div class="cf-chargement">Rédaction en cours (quelques secondes)…</div>';
        envoyer('/ia', 'POST', d).then(function (r) {
          $('[data-sortie]', z).innerHTML = '';
          rendreSortieIa($('[data-sortie]', z), md, r.resultat, d);
          if (r.quota) toast('Générations IA restantes ce mois : ' + r.quota.restant);
        }).catch(function (err) { $('[data-sortie]', z).innerHTML = ''; echec(err); }).then(function () { bt.disabled = false; bt.textContent = '✦ Générer'; });
      });
    }
    $$('[data-mode]', z).forEach(function (b) { b.addEventListener('click', function () { choisir(b.getAttribute('data-mode')); }); });
    choisir(mode);
  };

  function liste(titre, items, fn) {
    if (!items || !items.length) return '';
    return '<h3>' + e(titre) + '</h3><ul>' + items.map(function (x) { return '<li>' + (fn ? fn(x) : e(x)) + '</li>'; }).join('') + '</ul>';
  }
  function rendreSortieIa(zone, mode, r, demande) {
    var html = '<div class="cf-carte"><h2>Proposition de l’assistant <small>à relire avant usage</small></h2><div class="cf-ia-sortie">';
    if (r.texte) html += e(r.texte);
    if (mode === 'lecon') {
      html += '<h3 style="margin-top:0">' + e(r.titre || '') + '</h3>' + (r.resume ? '<p>' + e(r.resume) + '</p>' : '') + liste('Objectifs', r.objectifs) +
        liste('Déroulé', r.deroule, function (x) { return '<strong>' + e(x.etape) + '</strong> (' + e(x.minutes) + ' min) — ' + e(x.activite); }) +
        (r.contenu ? '<h3>Contenu</h3>' + e(r.contenu) : '') + liste('Vocabulaire', r.vocabulaire, function (v) { return '<strong>' + e(v.terme) + '</strong> : ' + e(v.sens) + (v.exemple ? ' — <em>' + e(v.exemple) + '</em>' : ''); }) +
        liste('Exercices', r.exercices) + (r.devoirs ? '<h3>Devoirs</h3>' + e(r.devoirs) : '');
    }
    if (r.quiz && r.quiz.length) html += liste('Quiz (' + r.quiz.length + ' questions)', r.quiz, function (q) { return e(q.question) + '<br><span class="doux">' + q.choix.map(function (c, i) { return (i === q.bonne ? '✔ ' : '') + e(c); }).join(' · ') + '</span>'; });
    if (mode === 'analyse') {
      html += (r.synthese ? '<p>' + e(r.synthese) + '</p>' : '') + liste('Points forts', r.points_forts) + liste('Points d’attention', r.points_attention) +
        liste('Plan d’action', r.actions, function (x) { return '<span class="cf-badge ' + (x.priorite === 'haute' ? 'rouge' : x.priorite === 'moyenne' ? 'ambre' : '') + '">' + e(x.priorite) + '</span> <strong>' + e(x.action) + '</strong> — ' + e(x.responsable) + (x.indicateur ? ' <span class="doux">(' + e(x.indicateur) + ')</span>' : ''); }) +
        liste('Conseils par coach', r.coachs, function (x) { return '<strong>' + e(x.coach) + '</strong> : ' + e(x.conseil); });
    }
    if (mode === 'suivi') {
      html += (r.bilan ? '<p>' + e(r.bilan) + '</p>' : '') + liste('Forces', r.forces) + liste('À travailler', r.a_travailler) + liste('Conseils pour la semaine', r.conseils) + (r.message_apprenant ? '<h3>Message à l’apprenant</h3>' + e(r.message_apprenant) : '');
    }
    html += '</div><div class="cf-actions" style="margin-top:12px">';
    if (mode === 'lecon' || mode === 'quiz') html += '<button class="cf-btn principal" data-enregistrer>Enregistrer comme leçon (brouillon)</button>';
    html += '<button class="cf-btn" data-copier>Copier</button>';
    html += '</div></div>';
    zone.innerHTML = html;
    var texteBrut = $('.cf-ia-sortie', zone).innerText;
    $('[data-copier]', zone).addEventListener('click', function () { navigator.clipboard.writeText(r.message_apprenant || r.texte || texteBrut).then(function () { toast('Copié.'); }); });
    var be = $('[data-enregistrer]', zone);
    if (be) be.addEventListener('click', function () {
      var contenu = mode === 'lecon' ? [r.contenu, r.vocabulaire && r.vocabulaire.length ? '\nVOCABULAIRE\n' + r.vocabulaire.map(function (v) { return '• ' + v.terme + ' : ' + v.sens + (v.exemple ? ' — ' + v.exemple : ''); }).join('\n') : '', r.exercices && r.exercices.length ? '\nEXERCICES\n' + r.exercices.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n') : '', r.devoirs ? '\nDEVOIRS\n' + r.devoirs : ''].filter(Boolean).join('\n') : '';
      editerLecon({ titre: r.titre || demande.sujet || demande.theme, niveau: r.niveau || demande.niveau, competence: r.competence || 'general', resume: r.resume, contenu: contenu, duree_minutes: demande.duree_minutes, quiz: r.quiz || [], publiee: false }, function () { window.location.hash = '#/lecons'; });
    });
  }
  function afficherSortieIa(titre, r, telephone) {
    var m = modale(titre, '<div data-z></div>', { large: true });
    rendreSortieIa($('[data-z]', m.el), 'suivi', r, {});
    if (r.message_apprenant && lienWhatsApp(telephone)) {
      $('.cf-actions', m.el).insertAdjacentHTML('afterbegin', '<a class="cf-btn principal" target="_blank" rel="noopener" href="' + e(lienWhatsApp(telephone, r.message_apprenant)) + '">Envoyer le message par WhatsApp</a>');
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Site du centre                                                      */
  /* ------------------------------------------------------------------ */
  ROUTES.site = function () {
    var c = etat.ctx.centre;
    var adresse = adresseSite();
    var z = page('Site du centre', 'Votre vitrine en ligne : programmes, groupes ouverts, coachs, test de niveau, préinscription, espace apprenant et vérification des certificats.', '<a class="cf-btn principal" href="site-public.html">Personnaliser le site</a>');
    var partage = 'Découvrez ' + c.nom + ' : nos formations, nos horaires et les inscriptions en ligne' + (c.linguistique && c.domaine === 'anglais' ? ', et testez gratuitement votre niveau d’anglais' : '') + ' 👉 ' + adresse;
    z.innerHTML = '<div class="cf-carte"><h2>Votre adresse</h2><p style="font-size:1.1rem"><span class="cf-code">' + e(adresse) + '</span></p>' +
      (c.site_publie ? '<p><span class="cf-badge vert">En ligne</span></p>' : '<div class="cf-encadre">Le site n’est pas encore publié. Ouvrez « Personnaliser le site », choisissez l’apparence, puis activez la publication. L’espace apprenant et le test de niveau s’ouvrent avec lui.</div>') +
      '<div class="cf-actions"><a class="cf-btn" target="_blank" rel="noopener" href="' + e(adresse) + '">Ouvrir le site</a><button class="cf-btn" data-copier>Copier l’adresse</button><a class="cf-btn" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(partage) + '">Partager sur WhatsApp</a><a class="cf-btn" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(adresse) + '">Partager sur Facebook</a></div></div>' +
      '<div class="cf-deux"><div class="cf-carte"><h2>Ce que montre votre site</h2><ul style="line-height:1.8;margin:0;padding-left:18px"><li>Vos <strong>programmes publiés</strong>, avec durée et prix</li><li>Les <strong>groupes ouverts</strong> et les places restantes</li><li>Les <strong>coachs</strong> que vous choisissez de présenter</li>' + (c.domaine === 'anglais' ? '<li>Le <strong>test de niveau d’anglais</strong> gratuit (30 questions)</li>' : '') + '<li>La <strong>préinscription en ligne</strong>, qui arrive dans « Demandes du site »</li><li>L’<strong>espace apprenant</strong> : planning, leçons en ligne, quiz, résultats, paiements</li><li>La <strong>vérification des certificats</strong> pour les employeurs</li><li>Les <strong>avis</strong> positifs de vos apprenants</li></ul></div>' +
      '<div class="cf-carte"><h2>Conseils pour remplir votre centre</h2><ul style="line-height:1.7;margin:0;padding-left:18px"><li>Mettez l’adresse du site sur vos affiches, flyers et cartes de visite.</li><li>Publiez-la en statut WhatsApp chaque début de mois, avec la date du prochain groupe.</li><li>Rappelez chaque demande le jour même : la conversion chute après 48 h.</li><li>Demandez à vos apprenants satisfaits de laisser un avis depuis leur espace.</li></ul></div></div>';
    $('[data-copier]', z).addEventListener('click', function () { navigator.clipboard.writeText(adresse).then(function () { toast('Adresse copiée.'); }); });
  };

  /* ------------------------------------------------------------------ */
  /*  Réglages du centre : vocabulaire, accès ouverts, en ligne, rappels  */
  /* ------------------------------------------------------------------ */
  function cfg() { return (etat.ctx && etat.ctx.config) || {}; }
  function acces(cle) { return !!(cfg().acces && cfg().acces[cle]); }
  function voc(cle, defaut) { var v = cfg().vocabulaire || {}; return v[cle] || defaut; }

  var SECTIONS_REGLAGES = [
    ['fonctionnement', 'Fonctionnement du centre', 'Chaque centre a sa manière de faire : adaptez Ardoise à la vôtre.', [
      ['sessions', 'case', 'Nous travaillons par sessions (rentrées datées)', 'Décochez si vos apprenants entrent toute l’année (entrées permanentes) : la rubrique Sessions disparaît.'],
      ['capacite_stricte', 'case', 'Respecter strictement le nombre de places d’un groupe', 'Décochez pour autoriser le surbooking.'],
      ['liste_attente', 'case', 'Proposer une liste d’attente quand un groupe est complet'],
      ['frais_inscription', 'case', 'Facturer des frais d’inscription aux nouveaux apprenants'],
      ['seuil_admission', 'nombre', 'Note minimale pour passer au niveau suivant (/100)'],
      ['seuil_alerte_presence', 'nombre', 'Signaler un apprenant sous ce taux d’assiduité (%)'],
      ['avis_apprenants', 'case', 'Les apprenants peuvent noter leurs cours'],
      ['test_niveau', 'case', 'Proposer le test de niveau sur le site (centres d’anglais)']
    ]],
    ['acces', 'Accès ouverts', 'Par défaut chaque rôle a un périmètre prudent. Ouvrez seulement ce dont votre équipe a besoin : chaque accès est vérifié par le serveur.', [
      ['coach_encaisse', 'case', 'Le coach peut encaisser les paiements de SES apprenants'],
      ['coach_voit_soldes', 'case', 'Le coach voit ce que doivent ses apprenants'],
      ['coach_planifie', 'case', 'Le coach planifie les séances de SES groupes'],
      ['coach_inscrit', 'case', 'Le coach peut inscrire des apprenants dans SES groupes'],
      ['accueil_planifie', 'case', 'L’accueil crée les groupes et planifie les séances'],
      ['accueil_finances', 'case', 'L’accueil voit les dépenses, la paie et le bilan'],
      ['adjoint_finances', 'case', 'L’adjoint pédagogique voit les finances']
    ]],
    ['paie', 'Paie des coachs', 'Le montant saisi pour chaque coach est payé par unité choisie ici.', [
      ['mode', 'choix', 'Mode de paie', '', [['heure', 'À l’heure de cours donnée'], ['seance', 'À la séance donnée'], ['mensuel', 'Forfait mensuel']]]
    ]],
    ['en_ligne', 'Cours en ligne et présence', 'La présence se compte même si la connexion coupe : au clic sur « Rejoindre », au QR code en salle, ou par le replay.', [
      ['fournisseur', 'choix', 'Outil de classe en ligne', 'La Classe Ardoise est intégrée : sans limite de durée, avatars, main levée, tableau, sondages, mode connexion faible. Une visio Jitsi de secours reste proposée.', [['ardoise', 'Classe Ardoise (intégrée, recommandée)'], ['jitsi', 'Jitsi Meet (gratuit, s’ouvre dans l’application)'], ['lien', 'Notre lien Google Meet / Zoom / Teams']]],
      ['micros_libres', 'case', 'Classe Ardoise : les apprenants ouvrent leur micro sans attendre que le coach leur donne la parole'],
      ['debit_video_max', 'nombre', 'Classe Ardoise : débit total que le coach partage entre les apprenants (kbit/s, 2500 conseillé)'],
      ['domaine_jitsi', 'texte', 'Serveur Jitsi (visio de secours ou outil Jitsi)', 'meet.jit.si par défaut. Avec votre propre serveur (ou 8x8.vc), la visio Jitsi peut s’afficher directement dans Ardoise.'],
      ['integrer', 'case', 'Afficher la visio directement dans Ardoise (serveur propre uniquement)'],
      ['retard_minutes', 'nombre', 'Au-delà de combien de minutes un apprenant est « en retard »'],
      ['pointage_qr', 'case', 'Pointage par QR code en présentiel (l’apprenant scanne, la présence est faite)'],
      ['replay_compte_presence', 'case', 'Suivre le cours enregistré (replay) compte comme présent'],
      ['replay_minutes_min', 'nombre', 'Temps minimal passé sur le replay (minutes)'],
      ['replay_jours', 'nombre', 'Délai pour suivre un replay (jours)']
    ]],
    ['rappels', 'Rappels automatiques', 'Ardoise rappelle les cours aux coachs et aux apprenants, relance les soldes et vous prévient avant la clôture des inscriptions.', [
      ['actifs', 'case', 'Envoyer les rappels automatiques'],
      ['coach_veille', 'case', 'Rappeler au coach son cours la veille au soir'],
      ['coach_heures_avant', 'nombre', 'Rappeler au coach … heures avant'],
      ['apprenant_veille', 'case', 'Rappeler aux apprenants leur cours la veille au soir'],
      ['apprenant_heures_avant', 'nombre', 'Rappeler aux apprenants … heures avant'],
      ['appel_oublie', 'case', 'Rappeler au coach une séance passée sans appel'],
      ['paiement_jours', 'nombre', 'Relancer un solde … jours après l’inscription (au plus une fois par semaine)'],
      ['email', 'case', 'Envoyer aussi par e-mail'],
      ['whatsapp_manuel', 'case', 'Préparer les messages WhatsApp des apprenants sans e-mail (envoi en un clic)']
    ]],
    ['certificat', 'Certificat', 'Le document que vos apprenants montreront à leurs employeurs.', [
      ['modele', 'choix', 'Modèle', '', [['prestige', 'Prestige — guilloché, sceau doré'], ['moderne', 'Moderne — bandeau de couleur'], ['classique', 'Classique — sobre']]],
      ['couleur', 'couleur', 'Couleur du centre'],
      ['signature_coach', 'case', 'Le coach signe aux côtés du chef de centre'],
      ['afficher_heures', 'case', 'Afficher les heures de formation suivies'],
      ['afficher_mentions', 'case', 'Afficher la mention']
    ]],
    ['vocabulaire', 'Vocabulaire', 'Les mots de votre centre : formateur, professeur, stagiaire, étudiant, module, cycle…', [
      ['coach', 'texte', 'Au singulier — coach'], ['coachs', 'texte', 'Au pluriel — coachs'],
      ['apprenant', 'texte', 'Au singulier — apprenant'], ['apprenants', 'texte', 'Au pluriel — apprenants'],
      ['session', 'texte', 'Au singulier — session'], ['sessions', 'texte', 'Au pluriel — sessions'],
      ['groupe', 'texte', 'Au singulier — groupe'], ['groupes', 'texte', 'Au pluriel — groupes']
    ]]
  ];

  ROUTES.reglages = function () {
    var chef = a('directeur');
    var z = page('Réglages du centre', 'Identité visuelle, fonctionnement, accès de l’équipe, cours en ligne, rappels et certificat.' + (chef ? '' : ' Seul le chef de centre peut les modifier.'),
      chef ? '<button class="cf-btn principal" data-enregistrer>Enregistrer les réglages</button>' : '');
    api('/reglages').then(function (d) {
      var c = d.config;
      var html = '<div class="cf-carte"><h2>Identité visuelle <small>le fond du logo est retiré automatiquement</small></h2><div class="cf-identite">' +
        ['logo', 'cachet', 'signature'].map(function (t) {
          var titres = { logo: 'Logo du centre', cachet: 'Cachet', signature: 'Ma signature' };
          var aides = { logo: 'Certificats, reçus, site, espace apprenant.', cachet: 'Apposé sur les certificats.', signature: 'Signature du chef de centre sur les certificats.' };
          return '<div class="cf-identite-bloc"><div class="cf-identite-apercu damier" data-apercu="' + t + '">' + (t === 'logo' && urlSure(etat.ctx.centre.logo_url) ? '<img src="' + e(etat.ctx.centre.logo_url) + '" alt="">' : '<span class="doux">Aucun</span>') + '</div>' +
            '<strong>' + titres[t] + '</strong><div class="doux" style="font-size:.78rem">' + aides[t] + '</div>' + (chef ? '<label class="cf-btn petit" style="margin-top:6px">Choisir une image<input type="file" accept="image/*" hidden data-televerser="' + t + '"></label>' : '') + '</div>';
        }).join('') + '</div></div>';
      html += SECTIONS_REGLAGES.map(function (sec) {
        return '<div class="cf-carte"><h2>' + e(sec[1]) + '</h2><p class="doux" style="margin:-4px 0 12px;font-size:.86rem">' + e(sec[2]) + '</p><div class="cf-reglages">' + sec[3].map(function (ch) {
          var val = (c[sec[0]] || {})[ch[0]], nom = sec[0] + '.' + ch[0], dis = chef ? '' : ' disabled';
          if (ch[1] === 'case') return '<label class="cf-interrupteur"><input type="checkbox" data-cle="' + nom + '"' + (val ? ' checked' : '') + dis + '><span class="cf-curseur"></span><span><strong>' + e(ch[2]) + '</strong>' + (ch[3] ? '<small>' + e(ch[3]) + '</small>' : '') + '</span></label>';
          if (ch[1] === 'choix') return '<label class="cf-champ-reglage"><span><strong>' + e(ch[2]) + '</strong></span><select data-cle="' + nom + '"' + dis + '>' + ch[4].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + e(o[1]) + '</option>'; }).join('') + '</select></label>';
          var type = ch[1] === 'nombre' ? 'number' : ch[1] === 'couleur' ? 'color' : 'text';
          return '<label class="cf-champ-reglage"><span><strong>' + e(ch[2]) + '</strong>' + (ch[3] ? '<small>' + e(ch[3]) + '</small>' : '') + '</span><input type="' + type + '" data-cle="' + nom + '" value="' + e(val) + '"' + dis + '></label>';
        }).join('') + '</div></div>';
      }).join('');
      html += '<div class="cf-encadre">Devise, taux de change USD/FC, adresse et téléphone du centre : <a href="parametres.html">Paramètres généraux</a>.</div>';
      z.innerHTML = html;
      chargerApercuDocument('cachet'); chargerApercuDocument('signature');
      $$('[data-televerser]', z).forEach(function (inp) { inp.addEventListener('change', function () { televerserIdentite(inp.getAttribute('data-televerser'), inp); }); });
      var be = $('[data-enregistrer]');
      if (be) be.addEventListener('click', function () {
        var corps = {};
        $$('[data-cle]', z).forEach(function (el) {
          var p = el.getAttribute('data-cle').split('.');
          corps[p[0]] = corps[p[0]] || {};
          corps[p[0]][p[1]] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
        });
        be.disabled = true;
        envoyer('/reglages', 'PUT', corps).then(function (r) {
          etat.ctx.config = r.config; toast(r.message); dessinerRail();
        }).catch(echec).then(function () { be.disabled = false; });
      });
    }).catch(function (err) { z.innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
  };

  function chargerApercuDocument(type, mien) {
    var chemin = ['/uploads/documents', '?type=', type, mien ? '&mine=true' : ''].join('');
    S.appelApi(chemin).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var z = document.querySelector('[data-apercu="' + type + '"]');
      if (z && d && urlSure(d.url)) z.innerHTML = '<img src="' + e(d.url) + '" alt="">';
    }).catch(function () {});
  }

  /** Logo, cachet ou signature : détourage dans le navigateur, puis envoi. */
  function televerserIdentite(type, input) {
    var brut = input.files && input.files[0];
    input.value = '';
    if (!brut) return;
    var titres = { logo: 'Détourer le logo', cachet: 'Détourer le cachet', signature: 'Détourer la signature' };
    var preparer = window.ArdoiseDetourage ? window.ArdoiseDetourage.proposer(brut, { titre: titres[type], tolerance: type === 'logo' ? 55 : 80 }) : Promise.resolve(brut);
    preparer.then(function (fichier) {
      var fd = new FormData();
      fd.append('fichier', fichier, fichier.name || (type + '.png'));
      if (type !== 'logo') fd.append('type', type);
      return S.appelApi(type === 'logo' ? '/uploads/logo-ecole' : '/uploads/document', { method: 'POST', body: fd }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.message || 'Envoi impossible.'); return j; });
      });
    }).then(function (j) {
      var z = document.querySelector('[data-apercu="' + type + '"]');
      if (z && urlSure(j.url)) z.innerHTML = '<img src="' + e(j.url) + '" alt="">';
      if (type === 'logo' && urlSure(j.url)) etat.ctx.centre.logo_url = j.url;
      toast({ logo: 'Logo enregistré.', cachet: 'Cachet enregistré.', signature: 'Signature enregistrée.' }[type]);
    }).catch(echec);
  }

  /* ------------------------------------------------------------------ */
  /*  Calendrier et rappels                                               */
  /* ------------------------------------------------------------------ */
  var calendrierEtat = { mois: null, vue: null };
  var TYPES_EVT = { examen: 'Examen', reunion: 'Réunion', portes_ouvertes: 'Portes ouvertes', ferie: 'Jour férié / fermeture', atelier: 'Atelier', ceremonie: 'Remise de certificats', autre: 'Autre' };
  ROUTES.calendrier = function () {
    if (!calendrierEtat.mois) { var d0 = new Date(); calendrierEtat.mois = new Date(d0.getFullYear(), d0.getMonth(), 1); }
    if (!calendrierEtat.vue) calendrierEtat.vue = window.matchMedia('(max-width: 900px)').matches ? 'agenda' : 'mois';
    var gere = unDe('directeur', 'prefet', 'secretaire');
    var z = page('Calendrier', 'Séances, rentrées, clôtures d’inscription, examens et événements du centre. Abonnez-vous pour tout retrouver dans votre agenda de téléphone.',
      '<button class="cf-btn" data-prec>‹</button><button class="cf-btn" data-auj>Aujourd’hui</button><button class="cf-btn" data-suiv>›</button>' +
      '<button class="cf-btn" data-vue>' + (calendrierEtat.vue === 'mois' ? 'Vue agenda' : 'Vue mois') + '</button>' +
      '<button class="cf-btn" data-abonner>📅 S’abonner dans mon agenda</button>' + (gere ? '<button class="cf-btn principal" data-evt>+ Événement</button>' : ''));
    var iso = function (d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
    function afficher() {
      var m = calendrierEtat.mois;
      var debut = new Date(m.getFullYear(), m.getMonth(), 1), fin = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      var g0 = new Date(debut); g0.setDate(g0.getDate() - ((g0.getDay() + 6) % 7));
      var g1 = new Date(fin); g1.setDate(g1.getDate() + (6 - (g1.getDay() + 6) % 7));
      z.innerHTML = '<div class="cf-chargement">Chargement…</div>';
      Promise.all([api('/calendrier?du=' + iso(g0) + '&au=' + iso(g1)), unDe('directeur', 'prefet', 'secretaire', 'professeur') ? api('/rappels').catch(function () { return []; }) : Promise.resolve([])]).then(function (r) {
        var d = r[0], rappels = r[1];
        var items = {};
        function ajouter(jour, it) { (items[jour] = items[jour] || []).push(it); }
        d.seances.forEach(function (s) { ajouter(s.date_seance, { genre: 'seance', s: s, heure: heure(s.heure_debut), titre: s.groupe_nom, cls: s.statut === 'faite' ? 'faite' : s.statut === 'annulee' ? 'annulee' : (s.date_seance < aujourdhui() ? 'a-cloturer' : (['en_ligne', 'enregistre', 'hybride'].indexOf(s.mode) >= 0 ? 'en-ligne' : '')) }); });
        d.evenements.forEach(function (ev) {
          var j = new Date(ev.date_debut + 'T00:00:00'), f = new Date((ev.date_fin || ev.date_debut) + 'T00:00:00');
          for (var x = new Date(j); x <= f; x.setDate(x.getDate() + 1)) ajouter(iso(x), { genre: 'evenement', ev: ev, heure: heure(ev.heure_debut), titre: ev.titre, cls: 'evt-' + ev.type });
        });
        d.sessions.forEach(function (s) {
          ajouter(s.date_debut, { genre: 'session', titre: 'Début — ' + s.nom, cls: 'jalon' });
          ajouter(s.date_fin, { genre: 'session', titre: 'Fin — ' + s.nom, cls: 'jalon' });
          if (s.inscriptions_fin) ajouter(s.inscriptions_fin, { genre: 'session', titre: 'Clôture des inscriptions — ' + s.nom, cls: 'jalon' });
        });
        var titreMois = m.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        var html = '<div class="cf-cal-titre">' + e(titreMois.charAt(0).toUpperCase() + titreMois.slice(1)) + '</div>' +
          '<div class="cf-legende"><span><i style="background:var(--cf-bleu)"></i>Séance</span><span><i style="background:#6250d6"></i>En ligne</span><span><i style="background:var(--cf-vert)"></i>Donnée</span><span><i style="background:var(--cf-ambre)"></i>Sans appel</span><span><i style="background:var(--cf-accent)"></i>Événement</span><span><i style="background:#1F2B24"></i>Session</span></div>';
        if (calendrierEtat.vue === 'mois') {
          html += '<div class="cf-cal">' + ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(function (j) { return '<div class="cf-cal-entete">' + j + '</div>'; }).join('');
          for (var x = new Date(g0); x <= g1; x.setDate(x.getDate() + 1)) {
            var j = iso(x), liste = (items[j] || []).sort(function (p, q) { return (p.heure || '') < (q.heure || '') ? -1 : 1; });
            html += '<div class="cf-cal-jour' + (x.getMonth() !== m.getMonth() ? ' hors' : '') + (j === aujourdhui() ? ' aujourdhui' : '') + '" data-jour="' + j + '"><div class="num">' + x.getDate() + '</div>' +
              liste.slice(0, 4).map(function (it, k) { return '<div class="cf-cal-item ' + e(it.cls) + '" data-j="' + j + '" data-k="' + k + '">' + (it.heure ? '<b>' + e(it.heure) + '</b> ' : '') + e(it.titre) + '</div>'; }).join('') +
              (liste.length > 4 ? '<div class="cf-cal-plus" data-voir="' + j + '">+' + (liste.length - 4) + ' de plus</div>' : '') + '</div>';
          }
          html += '</div>';
        } else {
          var jours = Object.keys(items).filter(function (j) { return j >= iso(debut) && j <= iso(fin); }).sort();
          html += jours.length ? '<div class="cf-agenda">' + jours.map(function (j) {
            return '<div class="cf-agenda-jour' + (j === aujourdhui() ? ' aujourdhui' : '') + '"><h4>' + e(dateFr(j, true)) + '</h4>' + items[j].map(function (it, k) {
              return '<div class="cf-cal-item ' + e(it.cls) + '" data-j="' + j + '" data-k="' + k + '">' + (it.heure ? '<b>' + e(it.heure) + '</b> ' : '') + e(it.titre) + (it.s && it.s.coach_nom ? ' <span class="doux">· ' + e(it.s.coach_nom) + '</span>' : '') + '</div>';
            }).join('') + '</div>';
          }).join('') + '</div>' : '<div class="cf-vide"><strong>Rien ce mois-ci</strong>Planifiez des séances ou ajoutez un événement.</div>';
        }
        html += panneauRappels(rappels);
        z.innerHTML = html;
        $$('.cf-cal-item', z).forEach(function (el) {
          el.addEventListener('click', function () {
            var it = items[el.getAttribute('data-j')][Number(el.getAttribute('data-k'))];
            if (it.genre === 'seance') choisirActionSeance(it.s, afficher);
            else if (it.genre === 'evenement' && gere) editerEvenement(it.ev, afficher);
          });
        });
        $$('[data-voir]', z).forEach(function (el) { el.addEventListener('click', function () { calendrierEtat.vue = 'agenda'; naviguer(); }); });
        if (gere) $$('.cf-cal-jour', z).forEach(function (el) { el.addEventListener('dblclick', function () { editerEvenement({ date_debut: el.getAttribute('data-jour') }, afficher); }); });
        brancherRappels(z, afficher);
      }).catch(function (err) { z.innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; });
    }
    $('[data-prec]').addEventListener('click', function () { calendrierEtat.mois = new Date(calendrierEtat.mois.getFullYear(), calendrierEtat.mois.getMonth() - 1, 1); afficher(); });
    $('[data-suiv]').addEventListener('click', function () { calendrierEtat.mois = new Date(calendrierEtat.mois.getFullYear(), calendrierEtat.mois.getMonth() + 1, 1); afficher(); });
    $('[data-auj]').addEventListener('click', function () { var t = new Date(); calendrierEtat.mois = new Date(t.getFullYear(), t.getMonth(), 1); afficher(); });
    $('[data-vue]').addEventListener('click', function () { calendrierEtat.vue = calendrierEtat.vue === 'mois' ? 'agenda' : 'mois'; naviguer(); });
    $('[data-abonner]').addEventListener('click', abonnementAgenda);
    var bev = $('[data-evt]'); if (bev) bev.addEventListener('click', function () { editerEvenement({ date_debut: aujourdhui() }, afficher); });
    afficher();
  };

  function choisirActionSeance(s, apres) {
    var enLigne = ['en_ligne', 'hybride', 'enregistre'].indexOf(s.mode) >= 0;
    var m = modale(s.groupe_nom + ' — ' + dateFr(s.date_seance, true), '<p class="doux">' + e([heure(s.heure_debut), s.salle, s.coach_nom, LIBELLES.mode[s.mode] || (s.mode === 'enregistre' ? 'Cours enregistré' : '')].filter(Boolean).join(' · ')) + ' ' + badgeStatut('statut_seance', s.statut) + '</p>' +
      (s.theme ? '<p><strong>Thème :</strong> ' + e(s.theme) + '</p>' : ''),
      { pied: '<button class="cf-btn" data-fermer>Fermer</button>' + (enLigne || cfg().en_ligne.pointage_qr ? '<a class="cf-btn" href="#/salle?s=' + e(s.id) + '" data-fermer>' + (enLigne ? '🎥 Salle virtuelle' : '▦ QR de présence') + '</a>' : '') + '<button class="cf-btn principal" data-appel>Faire l’appel</button>' });
    $('[data-appel]', m.el).addEventListener('click', function () { m.fermer(); ouvrirAppel(s.id, apres); });
  }

  function editerEvenement(ev, apres) {
    charger('groupes', '/groupes').then(function (gs) {
      var champs = [
        { nom: 'titre', libelle: 'Titre', requis: true, plein: true }, { nom: 'type', libelle: 'Type', type: 'select', vide: false, options: Object.keys(TYPES_EVT).map(function (k) { return [k, TYPES_EVT[k]]; }) },
        { nom: 'groupe_id', libelle: 'Groupe concerné', type: 'select', vide: '— Tout le centre —', options: gs.map(function (g) { return [g.id, g.nom]; }) },
        { nom: 'date_debut', libelle: 'Date', type: 'date', requis: true }, { nom: 'date_fin', libelle: 'Jusqu’au (facultatif)', type: 'date' },
        { nom: 'heure_debut', libelle: 'Heure de début', type: 'heure' }, { nom: 'heure_fin', libelle: 'Heure de fin', type: 'heure' },
        { nom: 'description', libelle: 'Description', type: 'textarea', plein: true, lignes: 3 }, { nom: 'visible_apprenants', libelle: 'Visible par les apprenants (espace et agenda)', type: 'case', defaut: true }
      ];
      var m = modaleFormulaire(ev.id ? 'Modifier l’événement' : 'Nouvel événement', champs, ev, function (d) {
        return (ev.id ? envoyer('/evenements/' + ev.id, 'PATCH', d) : envoyer('/evenements', 'POST', d)).then(function () { toast('Événement enregistré.'); if (apres) apres(); });
      }, { large: true });
      if (ev.id) {
        $('footer', m.el).insertAdjacentHTML('afterbegin', '<button class="cf-btn danger" data-suppr style="margin-right:auto">Supprimer</button>');
        $('[data-suppr]', m.el).addEventListener('click', function () { api('/evenements/' + ev.id, { method: 'DELETE' }).then(function () { m.fermer(); toast('Événement supprimé.'); if (apres) apres(); }).catch(echec); });
      }
    });
  }

  function abonnementAgenda() {
    api('/calendrier/abonnement').then(function (l) {
      var m = modale('Mon agenda Ardoise', '<p>Ajoutez ' + (l.portee === 'coach' ? 'vos cours' : 'le calendrier du centre') + ' à <strong>Google Agenda</strong>, au calendrier de votre <strong>téléphone</strong> ou à Outlook : tout se met à jour tout seul, avec une alerte une heure avant chaque cours.</p>' +
        '<div class="cf-actions" style="margin:12px 0"><a class="cf-btn principal" target="_blank" rel="noopener" href="' + e(l.google) + '">Ajouter à Google Agenda</a><a class="cf-btn" href="' + e(l.webcal) + '">iPhone / Outlook</a><button class="cf-btn" data-copier>Copier le lien</button></div>' +
        '<p class="doux" style="font-size:.82rem">Ce lien est personnel : ne le partagez pas. Il ne montre que ' + (l.portee === 'coach' ? 'vos propres cours' : 'le planning du centre') + '.</p>', {});
      $('[data-copier]', m.el).addEventListener('click', function () { navigator.clipboard.writeText(l.ics).then(function () { toast('Lien copié.'); }); });
    }).catch(echec);
  }

  function panneauRappels(rappels) {
    if (!unDe('directeur', 'prefet', 'secretaire', 'professeur')) return '';
    var aEnvoyer = rappels.filter(function (r) { return r.statut === 'a_envoyer'; });
    var envoyes = rappels.filter(function (r) { return r.statut !== 'a_envoyer'; });
    var r = cfg().rappels || {};
    return '<div class="cf-carte" style="margin-top:16px"><h2>Rappels <small>' + (r.actifs ? 'automatiques : activés' : 'automatiques : désactivés') + '</small></h2>' +
      '<p class="doux" style="font-size:.86rem;margin-top:-4px">Coachs : la veille' + (r.coach_veille ? '' : ' (désactivé)') + ' et ' + (r.coach_heures_avant || 0) + ' h avant leur cours, dans Ardoise et sur leur téléphone. Apprenants : la veille et ' + (r.apprenant_heures_avant || 0) + ' h avant, par e-mail — ou par WhatsApp en un clic ci-dessous pour ceux qui n’ont pas d’e-mail.</p>' +
      (aEnvoyer.length ? '<h3 style="font-size:.95rem;margin:14px 0 8px">À envoyer par WhatsApp (' + aEnvoyer.length + ')</h3><div class="cf-rappels">' + aEnvoyer.slice(0, 60).map(function (x) {
        var w = lienWhatsApp(x.telephone, x.message);
        return '<div class="cf-rappel"><div><strong>' + e(nomComplet(x)) + '</strong> <span class="cf-badge ' + (x.nature === 'paiement' ? 'ambre' : 'bleu') + '">' + e(x.nature === 'paiement' ? 'Solde' : 'Cours') + '</span><div class="doux" style="font-size:.8rem">' + e(x.message.slice(0, 160)) + (x.message.length > 160 ? '…' : '') + '</div></div>' +
          '<div class="cf-actions">' + (w ? '<a class="cf-btn petit principal" target="_blank" rel="noopener" href="' + e(w) + '" data-envoye="' + e(x.id) + '">Envoyer</a>' : '') + '<button class="cf-btn petit" data-ignorer="' + e(x.id) + '">Ignorer</button></div></div>';
      }).join('') + '</div>' : '<div class="cf-vide" style="padding:16px">Aucun message en attente.</div>') +
      (envoyes.length ? '<details style="margin-top:10px"><summary class="doux" style="cursor:pointer;font-size:.84rem">' + envoyes.length + ' rappel(s) déjà envoyé(s) ces 14 derniers jours</summary>' + tableau([
        { titre: 'Quand', rendu: function (x) { return e(dateFr(x.created_at)); } },
        { titre: 'Apprenant', rendu: function (x) { return e(nomComplet(x)); } },
        { titre: 'Canal', rendu: function (x) { return e({ email: 'E-mail', whatsapp_manuel: 'WhatsApp', interne: 'Ardoise' }[x.canal] || x.canal); } },
        { titre: 'Message', rendu: function (x) { return '<span class="doux">' + e(x.message.slice(0, 90)) + '</span>'; } }
      ], envoyes.slice(0, 50)) + '</details>' : '') +
      (unDe('directeur', 'prefet') ? '<div class="cf-actions" style="margin-top:12px"><button class="cf-btn petit" data-lancer>Préparer les rappels maintenant</button><a class="cf-btn petit" href="#/reglages">Régler les rappels</a></div>' : '') + '</div>';
  }
  function brancherRappels(z, apres) {
    $$('[data-envoye]', z).forEach(function (b) { b.addEventListener('click', function () { envoyer('/rappels/' + b.getAttribute('data-envoye'), 'PATCH', { statut: 'fait' }).then(function () { b.closest('.cf-rappel').remove(); }).catch(function () {}); }); });
    $$('[data-ignorer]', z).forEach(function (b) { b.addEventListener('click', function () { envoyer('/rappels/' + b.getAttribute('data-ignorer'), 'PATCH', { statut: 'ignore' }).then(function () { b.closest('.cf-rappel').remove(); }).catch(echec); }); });
    var bl = $('[data-lancer]', z); if (bl) bl.addEventListener('click', function () {
      bl.disabled = true;
      envoyer('/rappels/executer', 'POST').then(function (r) { toast((r.coachs + r.apprenants + r.paiements + r.appels) + ' rappel(s) préparé(s).'); apres(); }).catch(echec).then(function () { bl.disabled = false; });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Salle virtuelle (coach) — visio, présents, leçon, replay, QR        */
  /* ------------------------------------------------------------------ */
  var minuteurSalle = null;
  /** La Classe Ardoise (classe-ardoise.js / .css), chargée à la première entrée seulement. */
  function chargerClasseArdoise() {
    if (window.ClasseArdoise) return Promise.resolve();
    return new Promise(function (ok, ko) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'classe-ardoise.css?v=1'; document.head.appendChild(l);
      var sc = document.createElement('script'); sc.src = 'classe-ardoise.js?v=1'; sc.onload = function () { ok(); }; sc.onerror = function () { ko(new Error('Impossible de charger la classe : vérifiez la connexion.')); };
      document.head.appendChild(sc);
    });
  }
  ROUTES.salle = function () {
    var id = (window.location.hash.split('?s=')[1] || '').split('&')[0];
    if (minuteurSalle) { clearInterval(minuteurSalle); minuteurSalle = null; }
    var z = page('Salle virtuelle', 'Votre classe en ligne : les apprenants qui rejoignent sont notés présents automatiquement, même si leur connexion coupe ensuite.', '<a class="cf-btn" href="#/seances">← Planning</a>');
    if (!id) { z.innerHTML = '<div class="cf-vide">Ouvrez la salle depuis une séance du planning.</div>'; return; }
    var leger = false;
    function dessiner(d) {
      var s = d.seance, v = d.visio, enLigne = v.en_ligne;
      $('.cf-entete h1').textContent = (enLigne ? 'Salle virtuelle — ' : 'Présence — ') + s.groupe_nom;
      $('.cf-entete p').textContent = dateFr(s.date_seance, true) + (s.heure_debut ? ' à ' + heure(s.heure_debut) : '') + (s.theme ? ' · ' + s.theme : '');
      var presents = d.presences.filter(function (p) { return p.statut === 'present' || p.statut === 'retard'; }).length;
      var visio;
      if (enLigne && v.fournisseur === 'ardoise') visio = '<div class="cf-salle-visio cf-classe-ardoise"><div class="cf-ca-illus" aria-hidden="true">🏫</div><strong>La Classe Ardoise est prête</strong>' +
        '<p>Votre salle de classe en ligne, sans limite de durée : les apprenants entrent avec leur avatar et prennent une place, lèvent la main, répondent aux sondages. Vous donnez la parole, écrivez au tableau, partagez votre écran.</p>' +
        '<div class="cf-actions" style="justify-content:center"><button class="cf-btn principal" data-entrer-classe>Entrer dans la classe</button>' + (v.secours && v.secours.url ? '<a class="cf-btn" target="_blank" rel="noopener" href="' + e(v.secours.url) + '" title="Si un réseau bloque tout : une visio Jitsi de secours">Visio de secours</a>' : '') + '</div>' +
        '<p class="doux" style="font-size:.78rem;margin-top:10px">Conseil : branchez-vous en Wi-Fi ou en 4G et gardez cette page au premier plan. Si votre connexion sature, passez au tableau sans vidéo.</p></div>';
      else if (!enLigne) visio = '<div class="cf-salle-visio vide"><strong>Séance en présentiel</strong><p>Affichez le QR code ci-contre sur un écran ou imprimez-le : chaque apprenant le scanne avec son téléphone et sa présence est faite.</p></div>';
      else if (v.integrer && v.url) visio = '<iframe class="cf-salle-iframe" src="' + e(leger ? v.url_leger : v.url) + '" allow="camera; microphone; fullscreen; display-capture; autoplay" allowfullscreen></iframe>';
      else if (v.url) visio = '<div class="cf-salle-visio"><div class="cf-salle-icone">🎥</div><strong>La salle est prête</strong><p>La visio s’ouvre dans l’application Jitsi Meet (téléphone) ou un nouvel onglet. Les apprenants rejoignent depuis leur espace apprenant ; vous voyez ici qui est connecté.</p>' +
        '<div class="cf-actions" style="justify-content:center"><a class="cf-btn principal" target="_blank" rel="noopener" href="' + e(v.url) + '">Démarrer la visio</a><a class="cf-btn" target="_blank" rel="noopener" href="' + e(v.url_leger) + '">Mode connexion faible</a>' + (v.url_application ? '<a class="cf-btn" href="' + e(v.url_application) + '">Ouvrir dans l’application</a>' : '') + '<button class="cf-btn" data-copier-salle>Copier le lien</button></div></div>';
      else visio = '<div class="cf-salle-visio vide"><strong>Aucun lien de visio</strong><p>Ajoutez votre lien Google Meet / Zoom sur le groupe ou la séance, ou choisissez Jitsi dans les Réglages du centre.</p></div>';
      z.innerHTML = '<div class="cf-salle"><div class="cf-salle-principal">' + visio +
        (enLigne && v.fournisseur !== 'ardoise' ? '<div class="cf-salle-faible"><strong>Connexion difficile ?</strong> <span>1. Passez en <a href="#" data-leger>mode connexion faible</a> (audio seul, image 180p). 2. Coupez votre caméra : le son passe mieux. 3. Publiez l’enregistrement après le cours : les apprenants qui ont décroché le suivent en replay et leur présence est comptée.</span></div>' : '') +
        '</div><aside class="cf-salle-cote"><div class="cf-onglets" data-onglets-salle><button class="actif" data-o="presents">Présents ' + presents + '/' + d.presences.length + '</button><button data-o="lecon">Leçon</button><button data-o="notes">Devoirs</button><button data-o="replay">Replay</button>' + (d.pointage ? '<button data-o="qr">QR</button>' : '') + '</div><div data-volet-salle></div>' +
        '<button class="cf-btn principal" style="width:100%;margin-top:12px;justify-content:center" data-cloturer>Clôturer et enregistrer l’appel</button></aside></div>';
      var volets = {
        presents: function () {
          return '<div class="cf-appel">' + d.presences.map(function (p) {
            var etatP = p.statut === 'present' || p.statut === 'retard' ? '<span class="cf-badge ' + (p.statut === 'retard' ? 'ambre' : 'vert') + '">' + (p.statut === 'retard' ? 'En retard' : 'Présent') + '</span>' : p.statut ? badgeStatut('', p.statut) : '<span class="cf-badge">Pas encore</span>';
            return '<div class="ligne"><div><strong>' + e(nomComplet(p)) + '</strong><div class="doux" style="font-size:.76rem">' + e({ visio: 'via la classe en ligne', pointage: 'via le QR code', replay: 'via le replay', appel: 'appel du coach' }[p.source] || '') + (p.arrivee_at ? ' · ' + new Date(p.arrivee_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '') + '</div></div>' + etatP + '</div>';
          }).join('') + '</div><p class="doux" style="font-size:.78rem">Actualisé toutes les 20 secondes.</p>';
        },
        lecon: function () {
          var l = s.lecon;
          return l ? '<h3 style="margin:4px 0 8px">' + e(l.titre) + '</h3>' + (urlSure(l.video_url) ? '<a class="cf-btn petit" target="_blank" rel="noopener" href="' + e(l.video_url) + '">Vidéo</a> ' : '') + (urlSure(l.ressource_url) ? '<a class="cf-btn petit" target="_blank" rel="noopener" href="' + e(l.ressource_url) + '">Document</a>' : '') + '<div style="white-space:pre-wrap;font-size:.88rem;line-height:1.6;margin-top:10px">' + e(l.contenu || '') + '</div>'
            : '<div class="cf-vide" style="padding:16px">Aucune leçon associée. Associez-en une à la séance (planning) pour l’avoir sous les yeux pendant le cours.</div>';
        },
        notes: function () {
          return '<form class="cf-form" style="grid-template-columns:1fr"><label>Thème<input name="theme" value="' + e(s.theme || '') + '"></label><label>Devoirs (visibles par les apprenants)<textarea name="devoirs" rows="4">' + e(s.devoirs || '') + '</textarea></label><label>Notes du coach<textarea name="notes_coach" rows="3">' + e(s.notes_coach || '') + '</textarea></label></form><button class="cf-btn petit" data-sauver-notes>Enregistrer</button>';
        },
        replay: function () {
          return '<p class="doux" style="font-size:.84rem">Collez le lien de l’enregistrement (YouTube non répertorié, Google Drive…). Les apprenants le suivent depuis leur espace ; ' + (d.reglages.replay_compte_presence ? 'après ' + d.reglages.replay_minutes_min + ' min, leur présence est comptée.' : 'la présence n’est pas comptée (réglage du centre).') + '</p>' +
            '<form class="cf-form" style="grid-template-columns:1fr"><label>Lien de l’enregistrement<input name="enregistrement_url" type="url" value="' + e(s.enregistrement_url || '') + '" placeholder="https://youtu.be/…"></label></form>' +
            '<div class="cf-actions"><button class="cf-btn petit principal" data-publier-replay>Publier le replay</button>' + (s.mode === 'enregistre' && s.statut !== 'faite' ? '<button class="cf-btn petit" data-cours-enregistre>Marquer le cours enregistré comme donné</button>' : '') + '</div>';
        },
        qr: function () {
          return d.pointage ? '<div class="cf-qr">' + d.pointage.qr_svg + '<div class="cf-code" style="font-size:1.4rem;margin-top:8px">' + e(d.pointage.code) + '</div><p class="doux" style="font-size:.8rem">Les apprenants scannent ce QR avec leur téléphone (appareil photo). Valable de 30 min avant le cours à 15 min après la fin.</p><button class="cf-btn petit" data-plein-ecran-qr>Afficher en grand</button></div>' : '';
        }
      };
      var courant = 'presents';
      function voir(o) {
        courant = o;
        $$('[data-onglets-salle] button', z).forEach(function (b) { b.classList.toggle('actif', b.getAttribute('data-o') === o); });
        var vz = $('[data-volet-salle]', z); vz.innerHTML = volets[o]();
        var bn = $('[data-sauver-notes]', vz); if (bn) bn.addEventListener('click', function () { var f = $('form', vz); envoyer('/seances/' + id, 'PATCH', { theme: f.elements.theme.value, devoirs: f.elements.devoirs.value, notes_coach: f.elements.notes_coach.value }).then(function () { toast('Enregistré.'); }).catch(echec); });
        var br = $('[data-publier-replay]', vz); if (br) br.addEventListener('click', function () { envoyer('/seances/' + id, 'PATCH', { enregistrement_url: $('form', vz).elements.enregistrement_url.value || null }).then(function () { toast('Replay publié dans l’espace des apprenants.'); recharger(); }).catch(echec); });
        var bc = $('[data-cours-enregistre]', vz); if (bc) bc.addEventListener('click', function () { envoyer('/seances/' + id, 'PATCH', { statut: 'faite' }).then(function () { toast('Cours enregistré marqué comme donné : il compte dans vos heures.'); recharger(); }).catch(echec); });
        var bq = $('[data-plein-ecran-qr]', vz); if (bq) bq.addEventListener('click', function () { var mm = modale('Présence — ' + s.groupe_nom, '<div class="cf-qr grand">' + d.pointage.qr_svg + '<div class="cf-code" style="font-size:2rem;margin-top:10px">' + e(d.pointage.code) + '</div><p>Scannez avec l’appareil photo de votre téléphone.</p></div>', { large: true }); mm.el.classList.add('cf-voile-qr'); });
      }
      $$('[data-onglets-salle] button', z).forEach(function (b) { b.addEventListener('click', function () { voir(b.getAttribute('data-o')); }); });
      voir(courant);
      var bl = $('[data-leger]', z); if (bl) bl.addEventListener('click', function (ev) { ev.preventDefault(); if (v.integrer) { leger = !leger; dessiner(d); } else window.open(v.url_leger, '_blank', 'noopener'); });
      var bcp = $('[data-copier-salle]', z); if (bcp) bcp.addEventListener('click', function () { navigator.clipboard.writeText(v.url.split('#')[0]).then(function () { toast('Lien de la salle copié.'); }); });
      $('[data-cloturer]', z).addEventListener('click', function () { ouvrirAppel(id, recharger); });
      var bec = $('[data-entrer-classe]', z);
      if (bec) bec.addEventListener('click', function () {
        bec.disabled = true; bec.textContent = 'Ouverture…';
        Promise.all([envoyer('/seances/' + id + '/classe', 'POST', {}), chargerClasseArdoise()]).then(function (r) {
          window.ClasseArdoise.ouvrir({ api: S.baseAPI(), paquet: r[0], quitter: function () { recharger(); } });
        }).catch(echec).then(function () { bec.disabled = false; bec.textContent = 'Entrer dans la classe'; });
      });
      dessiner.majPresences = function (nd) { d.presences = nd.presences; if (courant === 'presents') voir('presents'); var b = $('[data-o="presents"]', z); if (b) b.textContent = 'Présents ' + nd.presences.filter(function (p) { return p.statut === 'present' || p.statut === 'retard'; }).length + '/' + nd.presences.length; };
    }
    function recharger() { api('/seances/' + id + '/salle').then(dessiner).catch(function (err) { z.innerHTML = '<div class="cf-vide">' + e(err.message) + '</div>'; }); }
    recharger();
    minuteurSalle = setInterval(function () {
      if (etat.route !== 'salle') { clearInterval(minuteurSalle); minuteurSalle = null; return; }
      api('/seances/' + id + '/salle').then(function (nd) { if (dessiner.majPresences) dessiner.majPresences(nd); }).catch(function () {});
    }, 20000);
  };

  /* ------------------------------------------------------------------ */
  /*  Didacticiel : premiers pas, visite guidée, astuces par écran        */
  /* ------------------------------------------------------------------ */
  function etapesDemarrage() {
    var c = etat.ctx.compteurs, k = etat.ctx.centre;
    var e2 = [
      { cle: 'logo', titre: 'Ajoutez votre logo', texte: 'Il apparaît sur les certificats, les reçus et votre site. Son fond est retiré automatiquement.', fait: !!k.logo_url, route: 'reglages', cible: '[data-televerser="logo"]' },
      { cle: 'programmes', titre: 'Créez vos programmes', texte: 'Ce que vous vendez : niveaux, durées, prix. Reliez-les en parcours (A1 → A2 → B1).', fait: c.programmes > 0, route: 'programmes', cible: '[data-nouveau]' },
      { cle: 'coachs', titre: 'Ajoutez vos ' + voc('coachs', 'coachs').toLowerCase(), texte: 'Chacun reçoit son compte et ne voit que ses groupes.', fait: c.coachs > 0, route: 'coachs', cible: '[data-nouveau]' }
    ];
    if (cfg().fonctionnement && cfg().fonctionnement.sessions !== false) e2.push({ cle: 'sessions', titre: 'Ouvrez votre première ' + voc('session', 'session').toLowerCase(), texte: 'La rentrée : dates, période d’inscription, objectif d’inscrits.', fait: c.sessions > 0, route: 'sessions', cible: '[data-nouvelle]' });
    e2.push(
      { cle: 'groupes', titre: 'Créez un ' + voc('groupe', 'groupe').toLowerCase(), texte: 'Un programme, un coach, un horaire, des places.', fait: c.groupes > 0, route: 'groupes', cible: '[data-nouveau]' },
      { cle: 'seances', titre: 'Planifiez les séances', texte: 'En deux clics depuis le groupe : jours, heure, durée. Les rappels partent tout seuls.', fait: c.seances > 0, route: 'groupes', cible: 'tr.cliquable' },
      { cle: 'apprenants', titre: 'Inscrivez vos ' + voc('apprenants', 'apprenants').toLowerCase(), texte: 'Ils reçoivent leur accès à l’espace apprenant (planning, cours en ligne, résultats).', fait: c.apprenants > 0, route: 'apprenants', cible: '[data-nouveau]' },
      { cle: 'lecons', titre: 'Publiez une leçon en ligne', texte: 'Pour réviser entre les cours — l’assistant IA peut la préparer pour vous.', fait: c.lecons > 0, route: 'lecons', cible: '[data-ia]' },
      { cle: 'site', titre: 'Publiez votre site', texte: 'myardoise.com/votre-centre : formations, test de niveau, inscriptions en ligne.', fait: !!k.site_publie, route: 'site', cible: '.cf-entete .cf-btn.principal' }
    );
    return e2;
  }
  function carteDemarrage() {
    if (!a('directeur')) return '';
    var etapes = etapesDemarrage(), faites = etapes.filter(function (x) { return x.fait; }).length;
    if (faites === etapes.length || localStorage.getItem('cf-demarrage-masque') === etat.ctx.centre.code) return '';
    return '<div class="cf-carte cf-demarrage"><h2>Premiers pas — ' + faites + ' / ' + etapes.length + ' <small><button class="cf-lien" data-masquer-demarrage>Masquer</button></small></h2>' + jauge(Math.round(faites / etapes.length * 100), true) +
      '<div class="cf-etapes">' + etapes.map(function (x, i) {
        return '<div class="cf-etape' + (x.fait ? ' faite' : '') + '"><span class="cf-etape-num">' + (x.fait ? '✓' : i + 1) + '</span><div><strong>' + e(x.titre) + '</strong><div class="doux" style="font-size:.8rem">' + e(x.texte) + '</div></div>' + (x.fait ? '' : '<button class="cf-btn petit" data-guider="' + e(x.cle) + '">Me guider</button>') + '</div>';
      }).join('') + '</div></div>';
  }
  function brancherDemarrage(z) {
    var bm = $('[data-masquer-demarrage]', z); if (bm) bm.addEventListener('click', function () { localStorage.setItem('cf-demarrage-masque', etat.ctx.centre.code); bm.closest('.cf-carte').remove(); });
    $$('[data-guider]', z).forEach(function (b) {
      b.addEventListener('click', function () {
        var x = etapesDemarrage().filter(function (y) { return y.cle === b.getAttribute('data-guider'); })[0];
        window.location.hash = '#/' + x.route;
        setTimeout(function () { projecteur([{ cible: x.cible, titre: x.titre, texte: x.texte }]); }, 700);
      });
    });
  }

  var ASTUCES = {
    tableau: [['.cf-sessions-bandeaux, .cf-encadre', 'Vos sessions', 'La rentrée en cours et la prochaine : inscrits, remplissage, objectif.'], ['.cf-grille-kpi', 'Vos indicateurs', 'Assiduité, satisfaction, encaissements, réinscription : l’essentiel du centre en un coup d’œil.'], ['.cf-alerte', 'À faire aujourd’hui', 'Chaque alerte dit quoi faire et mène au bon écran.']],
    sessions: [['[data-nouvelle]', 'Une session = une rentrée', 'Créez-la, rattachez-y vos groupes. À la fin : clôturez, préparez la suivante, réinscrivez.']],
    apprenants: [['[data-nouveau]', 'Inscrire un apprenant', 'Il reçoit un matricule et un code pour son espace en ligne.'], ['.cf-filtres', 'Filtrer', 'Cherchez un nom, un téléphone, ou affichez seulement les apprenants à risque.']],
    groupes: [['tr.cliquable', 'Ouvrir un groupe', 'Membres, séances, planification, message WhatsApp au groupe.']],
    seances: [['.cf-semaine', 'Votre semaine', 'Cliquez une séance pour faire l’appel. En orange : séance passée sans appel.']],
    calendrier: [['[data-abonner]', 'Dans votre téléphone', 'Abonnez-vous : vos cours apparaissent dans Google Agenda avec une alerte.'], ['.cf-cal, .cf-agenda', 'Double-cliquez un jour', 'pour y ajouter un examen, une réunion ou une fermeture.']],
    salle: [['[data-onglets-salle]', 'Présents en direct', 'Les apprenants qui rejoignent sont notés tout seuls. Clôturez l’appel à la fin.']],
    lecons: [['[data-ia]', 'Laissez l’IA préparer', 'Une leçon complète avec quiz en quelques secondes, à relire et publier.']],
    finances: [['[data-encaisser]', 'Encaisser', 'Chaque paiement donne un reçu numéroté, imprimable.']],
    reglages: [['.cf-interrupteur', 'À votre manière', 'Ouvrez des accès à votre équipe, choisissez la paie, les rappels, le certificat.']]
  };
  function projecteur(etapes, i) {
    i = i || 0;
    $$('.cf-projo, .cf-bulle-guide').forEach(function (x) { x.remove(); });
    var et = etapes[i]; if (!et) return;
    var cible = null;
    String(et.cible).split(',').some(function (sel) { cible = document.querySelector(sel.trim()); return !!cible; });
    if (!cible) { if (i + 1 < etapes.length) projecteur(etapes, i + 1); else toast(et.titre + ' — ' + et.texte); return; }
    cible.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(function () {
      var r = cible.getBoundingClientRect();
      var p = document.createElement('div'); p.className = 'cf-projo';
      p.style.cssText = 'top:' + (r.top - 6) + 'px;left:' + (r.left - 6) + 'px;width:' + (r.width + 12) + 'px;height:' + (Math.min(r.height, window.innerHeight * .6) + 12) + 'px';
      var b = document.createElement('div'); b.className = 'cf-bulle-guide';
      b.innerHTML = '<strong>' + e(et.titre) + '</strong><p>' + e(et.texte) + '</p><div class="cf-actions"><span class="doux" style="font-size:.76rem;margin-right:auto">' + (i + 1) + ' / ' + etapes.length + '</span><button class="cf-btn petit" data-fin>Terminer</button>' + (i + 1 < etapes.length ? '<button class="cf-btn petit principal" data-suite>Suivant</button>' : '') + '</div>';
      document.body.appendChild(p); document.body.appendChild(b);
      var bas = r.bottom + 14 + 160 < window.innerHeight;
      b.style.top = (bas ? r.bottom + 14 : Math.max(10, r.top - 14 - b.offsetHeight)) + 'px';
      b.style.left = Math.max(10, Math.min(window.innerWidth - b.offsetWidth - 10, r.left)) + 'px';
      $('[data-fin]', b).addEventListener('click', function () { p.remove(); b.remove(); });
      var bs = $('[data-suite]', b); if (bs) bs.addEventListener('click', function () { projecteur(etapes, i + 1); });
    }, 350);
  }
  function aideEcran() {
    var astuces = ASTUCES[etat.route] || [];
    var m = modale('Aide et tutoriels', '<p>Écran : <strong>' + e(((NAV.filter(function (n) { return n[0] === etat.route; })[0] || [])[1]) || etat.route) + '</strong></p>' +
      (astuces.length ? '<ul style="line-height:1.7">' + astuces.map(function (x) { return '<li><strong>' + e(x[1]) + '</strong> — ' + e(x[2]) + '</li>'; }).join('') + '</ul>' : '<p class="doux">Pas d’astuce particulière pour cet écran.</p>') +
      (a('directeur') ? '<h3 style="font-size:1rem">Premiers pas du centre</h3><div class="cf-etapes">' + etapesDemarrage().map(function (x, i) { return '<div class="cf-etape' + (x.fait ? ' faite' : '') + '"><span class="cf-etape-num">' + (x.fait ? '✓' : i + 1) + '</span><div><strong>' + e(x.titre) + '</strong></div></div>'; }).join('') + '</div>' : ''),
      { pied: '<a class="cf-btn" href="#/assistant?question" data-fermer>Poser une question à l’assistant</a><a class="cf-btn" href="support.html">Contacter le support</a>' + (astuces.length ? '<button class="cf-btn principal" data-visite>Visite guidée de l’écran</button>' : '') });
    var bv = $('[data-visite]', m.el); if (bv) bv.addEventListener('click', function () { m.fermer(); projecteur(astuces.map(function (x) { return { cible: x[0], titre: x[1], texte: x[2] }; })); });
  }
  function astucePremiereVisite() {
    var cle = 'cf-vu-' + etat.route;
    try { if (localStorage.getItem(cle) || !ASTUCES[etat.route]) return; localStorage.setItem(cle, '1'); } catch (x) { return; }
    var t = ASTUCES[etat.route][0];
    setTimeout(function () {
      var b = document.createElement('div'); b.className = 'cf-astuce';
      b.innerHTML = '<strong>💡 ' + e(t[1]) + '</strong><span>' + e(t[2]) + '</span><button class="cf-lien" data-visite>Visite guidée</button><button class="cf-lien" data-ok>OK</button>';
      document.body.appendChild(b);
      $('[data-ok]', b).addEventListener('click', function () { b.remove(); });
      $('[data-visite]', b).addEventListener('click', function () { b.remove(); projecteur(ASTUCES[etat.route].map(function (x) { return { cible: x[0], titre: x[1], texte: x[2] }; })); });
      setTimeout(function () { if (b.parentNode) b.remove(); }, 12000);
    }, 1200);
  }

  /* Le coach dépose sa signature (certificats) depuis son espace. */
  function blocSignatureCoach() {
    if (!a('professeur') || !(cfg().certificat || {}).signature_coach) return '';
    return '<div class="cf-carte"><h2>Ma signature <small>apposée sur les certificats de vos apprenants</small></h2><div class="cf-identite"><div class="cf-identite-bloc"><div class="cf-identite-apercu damier" data-apercu="signature"><span class="doux">Aucune</span></div>' +
      '<label class="cf-btn petit" style="margin-top:6px">Photographier ma signature<input type="file" accept="image/*" capture="environment" hidden data-televerser="signature"></label><div class="doux" style="font-size:.78rem">Signez sur une feuille blanche, photographiez : le fond est retiré.</div></div></div></div>';
  }

  /* ------------------------------------------------------------------ */
  /*  Démarrage                                                           */
  /* ------------------------------------------------------------------ */
  $('.cf-menu-mobile').addEventListener('click', function () { $('#cf-rail').classList.toggle('ouvert'); });
  api('/contexte').then(function (ctx) {
    etat.ctx = ctx;
    etat.roles = ctx.moi.roles || [];
    try {
      var u = S.utilisateur();
      if (u && u.type_structure !== 'centre_formation') { u.type_structure = 'centre_formation'; S.ecrire('ardoise_user', JSON.stringify(u)); }
    } catch (err) { /* sans conséquence */ }
    dessinerRail();
    $('#cf-chargement-initial').remove();
    window.addEventListener('hashchange', naviguer);
    naviguer();
  }).catch(function (err) {
    var el = $('#cf-chargement-initial');
    if (err.code === 'pas_un_centre') {
      try { var u = S.utilisateur(); if (u) { u.type_structure = 'ecole'; S.ecrire('ardoise_user', JSON.stringify(u)); } } catch (x) {}
      el.innerHTML = '<div class="cf-vide"><strong>Cet espace est réservé aux centres de formation</strong>Votre établissement est enregistré comme école. <a href="dashboard-directeur.html">Retour à votre tableau de bord</a></div>';
      return;
    }
    el.innerHTML = '<div class="cf-vide"><strong>Impossible d’ouvrir l’espace du centre</strong>' + e(err.message) + '<br><br><button class="cf-btn" onclick="location.reload()">Réessayer</button></div>';
  });
})();
