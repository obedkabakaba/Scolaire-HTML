/* Ardoise — Publication des résultats aux familles (écran Bulletins)
   ---------------------------------------------------------------------------
   Commande réservée au directeur et au préfet des études : pour chaque
   période, et pour chacun des deux canaux par lesquels un parent voit un
   résultat — le site officiel de l'école et l'assistant WhatsApp —, choisir
   de publier maintenant, de programmer une date, ou de retirer.

   Le serveur reste juge : la route /publication-resultats refuse tout autre
   rôle. Ce fichier ne fait que montrer la commande à ceux qui peuvent s'en
   servir.

   Dépend de `appelApi` et `afficherMessage`, définis par bulletins.html. */
(function () {
  'use strict';

  var ROLES_DIRECTION = ['directeur', 'prefet'];
  var CANAUX = [
    { cle: 'site', libelle: 'Site officiel', aide: 'Consultation avec le matricule et le code d’accès' },
    { cle: 'whatsapp', libelle: 'Assistant WhatsApp', aide: 'Réponse aux parents enregistrés (offre avec WhatsApp)' }
  ];

  function roles() {
    try {
      var u = JSON.parse(sessionStorage.getItem('ardoise_user') || localStorage.getItem('ardoise_user') || 'null');
      return (u && u.roles) || [];
    } catch (e) { return []; }
  }
  if (!roles().some(function (r) { return ROLES_DIRECTION.indexOf(r) !== -1; })) return;
  if (typeof window.appelApi !== 'function' && typeof appelApi !== 'function') return;

  function api(chemin, options) { return appelApi(chemin, options); }
  function flash(texte, type) {
    if (typeof afficherMessage === 'function') afficherMessage(texte, type);
  }
  function echapper(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dateLisible(iso) {
    return new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  /** Valeur par défaut du champ « programmer » : demain, 8 h, heure locale. */
  function demainHuitHeures() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T08:00';
  }

  /* ------------------------------------------------------------- styles */
  var style = document.createElement('style');
  style.textContent = [
    '.pub-voile{display:none;position:fixed;inset:0;background:rgba(31,43,36,.45);align-items:center;justify-content:center;padding:16px;z-index:60}',
    '.pub-voile.visible{display:flex}',
    '.pub-boite{background:var(--craie-2);border-radius:var(--r-carte);padding:24px;max-width:860px;width:100%;max-height:92vh;overflow-y:auto}',
    '.pub-boite h2{font-family:var(--police-titre);font-weight:600;font-size:1.25rem;margin:0 0 6px}',
    '.pub-intro{color:var(--texte-att);font-size:.86rem;margin:0 0 16px;line-height:1.55}',
    '.pub-periode{border:1.5px solid var(--bordure);border-radius:var(--r-bouton);padding:14px;margin-bottom:12px;background:var(--craie)}',
    '.pub-entete{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px}',
    '.pub-entete strong{font-size:.98rem}',
    '.pub-entete small{color:var(--texte-att);font-size:.78rem}',
    '.pub-canaux{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}',
    '.pub-canal{background:var(--craie-2);border-radius:var(--r-petit);padding:10px 12px}',
    '.pub-canal .titre{font-weight:600;font-size:.86rem}',
    '.pub-canal .aide{color:var(--texte-att);font-size:.74rem;margin:2px 0 8px}',
    '.pub-etat{display:inline-block;font-size:.74rem;font-weight:600;padding:3px 8px;border-radius:999px;margin-bottom:8px}',
    '.pub-etat.non_publie{background:rgba(107,114,105,.15);color:var(--texte-att)}',
    '.pub-etat.publie{background:rgba(76,122,90,.16);color:var(--vert-ok)}',
    '.pub-etat.programme{background:rgba(201,138,62,.18);color:var(--ocre-dark)}',
    '.pub-actions{display:flex;gap:6px;flex-wrap:wrap}',
    '.pub-programmer{display:none;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center}',
    '.pub-programmer.visible{display:flex}',
    '.pub-programmer input{font:inherit;font-size:.82rem;padding:5px 8px;border:1.5px solid var(--bordure);border-radius:var(--r-petit);background:var(--craie-2);color:inherit;min-width:0}',
    '.pub-pied{display:flex;justify-content:flex-end;margin-top:8px}',
    '.pub-alerte{background:rgba(201,138,62,.14);border-radius:var(--r-petit);padding:10px 12px;font-size:.84rem;margin-bottom:14px}'
  ].join('');
  document.head.appendChild(style);

  /* ----------------------------------------------------- bouton + modale */
  var bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton bouton-secondaire';
  bouton.id = 'bouton-publication-resultats';
  bouton.textContent = '📣 Publication des résultats';
  var entete = document.querySelector('.entete-page');
  if (!entete) return;
  entete.appendChild(bouton);

  var voile = document.createElement('div');
  voile.className = 'pub-voile';
  voile.setAttribute('role', 'dialog');
  voile.setAttribute('aria-modal', 'true');
  voile.setAttribute('aria-labelledby', 'pub-titre');
  voile.innerHTML =
    '<div class="pub-boite">'
    + '<h2 id="pub-titre">Publication des résultats aux familles</h2>'
    + '<p class="pub-intro">Choisissez, période par période, quand les parents peuvent voir les résultats : '
    + 'sur le <strong>site officiel</strong> de l’école et par l’<strong>assistant WhatsApp</strong>. '
    + 'Vous pouvez publier tout de suite, ou programmer une date et une heure : les résultats s’ouvriront seuls. '
    + 'Seuls les bulletins <strong>signés</strong> sont montrés, même après publication.</p>'
    + '<div id="pub-contenu"><p class="pub-intro">Chargement…</p></div>'
    + '<div class="pub-pied"><button type="button" class="bouton bouton-secondaire" id="pub-fermer">Fermer</button></div>'
    + '</div>';
  document.body.appendChild(voile);

  function fermer() { voile.classList.remove('visible'); }
  document.getElementById('pub-fermer').addEventListener('click', fermer);
  voile.addEventListener('click', function (e) { if (e.target === voile) fermer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });

  function etiquette(etat) {
    if (etat.etat === 'publie') {
      return '<span class="pub-etat publie">Publié' + (etat.date ? ' depuis le ' + echapper(dateLisible(etat.date)) : '') + '</span>';
    }
    if (etat.etat === 'programme') {
      return '<span class="pub-etat programme">Programmé le ' + echapper(dateLisible(etat.date)) + '</span>';
    }
    return '<span class="pub-etat non_publie">Non publié</span>';
  }

  function blocCanal(periode, canal) {
    var etat = periode[canal.cle];
    var id = periode.id + '-' + canal.cle;
    return '<div class="pub-canal">'
      + '<div class="titre">' + canal.libelle + '</div>'
      + '<div class="aide">' + canal.aide + '</div>'
      + etiquette(etat)
      + '<div class="pub-actions">'
      + (etat.etat !== 'publie'
        ? '<button type="button" class="bouton bouton-principal bouton-petit" data-pub="publier" data-periode="' + periode.id + '" data-canal="' + canal.cle + '">Publier maintenant</button>'
        : '')
      + '<button type="button" class="bouton bouton-secondaire bouton-petit" data-pub="ouvrir-programmation" data-cible="' + id + '">'
      + (etat.etat === 'programme' ? 'Changer la date' : 'Programmer…') + '</button>'
      + (etat.etat !== 'non_publie'
        ? '<button type="button" class="bouton bouton-secondaire bouton-petit" data-pub="retirer" data-periode="' + periode.id + '" data-canal="' + canal.cle + '">'
          + (etat.etat === 'programme' ? 'Annuler' : 'Retirer') + '</button>'
        : '')
      + '</div>'
      + '<div class="pub-programmer" id="prog-' + id + '">'
      + '<input type="datetime-local" aria-label="Date et heure de publication" value="' + demainHuitHeures() + '" />'
      + '<button type="button" class="bouton bouton-principal bouton-petit" data-pub="programmer" data-periode="' + periode.id + '" data-canal="' + canal.cle + '">Valider</button>'
      + '</div>'
      + '</div>';
  }

  function rendre(donnees) {
    var zone = document.getElementById('pub-contenu');
    var html = '';
    if (!donnees.controle_actif) {
      html += '<div class="pub-alerte">La commande de publication sera disponible dès la prochaine mise à jour du serveur. '
        + 'En attendant, les bulletins signés restent visibles comme avant.</div>';
    }
    if (!donnees.periodes.length) {
      zone.innerHTML = html + '<p class="pub-intro">Aucune période n’est créée pour l’année active.</p>';
      return;
    }
    html += donnees.periodes.map(function (p) {
      return '<div class="pub-periode">'
        + '<div class="pub-entete"><strong>' + echapper(p.libelle) + '</strong>'
        + '<small>' + p.nb_bulletins_signes + ' bulletin' + (p.nb_bulletins_signes > 1 ? 's' : '') + ' signé' + (p.nb_bulletins_signes > 1 ? 's' : '')
        + (p.modifiee_par ? ' · dernière décision : ' + echapper(p.modifiee_par) : '') + '</small></div>'
        + '<div class="pub-canaux">' + CANAUX.map(function (c) { return blocCanal(p, c); }).join('') + '</div>'
        + '</div>';
    }).join('');
    zone.innerHTML = html;
  }

  async function charger() {
    var r = await api('/publication-resultats');
    if (!r) return;
    var donnees = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      document.getElementById('pub-contenu').innerHTML =
        '<p class="pub-intro">' + echapper(donnees.message || 'Chargement impossible.') + '</p>';
      return;
    }
    rendre(donnees);
  }

  async function envoyer(periodeId, canal, action, date) {
    var corps = { canal: canal, action: action };
    try { corps.fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
    if (date) corps.date = date;
    var r = await api('/publication-resultats/' + encodeURIComponent(periodeId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps)
    });
    if (!r) return;
    var donnees = await r.json().catch(function () { return {}; });
    flash(donnees.message || (r.ok ? 'Enregistré.' : 'Erreur.'), r.ok ? 'succes' : 'erreur');
    if (!r.ok) {
      // L'erreur se lit aussi DANS la fenêtre : le bandeau de la page est
      // caché derrière le voile.
      window.alert(donnees.message || 'Enregistrement impossible.');
      return;
    }
    charger();
  }

  voile.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pub]');
    if (!b) return;
    var action = b.dataset.pub;
    if (action === 'ouvrir-programmation') {
      var bloc = document.getElementById('prog-' + b.dataset.cible);
      if (bloc) bloc.classList.toggle('visible');
      return;
    }
    if (action === 'programmer') {
      var champ = b.parentElement.querySelector('input');
      if (!champ || !champ.value) { window.alert('Choisissez la date et l’heure.'); return; }
      // Le champ est en heure LOCALE de l'appareil ; le serveur reçoit l'instant exact.
      envoyer(b.dataset.periode, b.dataset.canal, 'programmer', new Date(champ.value).toISOString());
      return;
    }
    if (action === 'retirer'
      && !window.confirm('Les parents ne verront plus ces résultats sur ce canal. Continuer ?')) return;
    envoyer(b.dataset.periode, b.dataset.canal, action);
  });

  bouton.addEventListener('click', function () {
    voile.classList.add('visible');
    charger();
  });
})();
