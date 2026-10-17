/**
 * Ardoise — Plan d'évaluation (onglet de « Année scolaire »).
 *
 * La grille « branches × épreuves » de l'année : pour chaque case, sur
 * combien la branche est cotée à cette épreuve, ou si elle n'y est PAS
 * évaluée. Par défaut, chaque case suit le barème de la branche (période =
 * maximum, examen = son maximum d'examen, le double s'il n'est pas réglé) :
 * on ne saisit que les EXCEPTIONS.
 *
 * C'est ce qui permet de suivre un changement de logique de cotation sans
 * toucher au logiciel — par exemple une matière vue en 1re période qui n'est
 * examinée qu'à l'examen du second semestre : sa case « Examen S1 » passe à
 * « non évalué », et sa case « Examen S2 » reçoit le maximum cumulé.
 *
 * Le serveur (controllers/plan-evaluation.controller.js) applique ensuite ce
 * plan PARTOUT : saisie des cotes, pourcentages, places, repêchage, bulletins
 * officiels et modèles importés.
 *
 * Dépend des fonctions globales de la page : appelApi, afficherMessage.
 */
(function () {
  'use strict';

  var etat = { donnees: null, modifs: new Map(), anneeId: null, classeId: '' };
  // Fonctions de la page hôte, transmises à l'initialisation : sur
  // annee-scolaire.html, appelApi et afficherMessage ne sont pas globales.
  var api = function (c, o) { return window.appelApi(c, o); };
  var message = function (t, ty) { if (window.afficherMessage) window.afficherMessage(t, ty); };
  var peutModifier = false;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function nombre(v) { return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100).replace('.', ','); }
  function cle(coursId, periodeId) { return coursId + '|' + periodeId; }

  function racine() { return document.getElementById('onglet-plan'); }

  async function initialiser(options) {
    options = options || {};
    if (options.api) api = options.api;
    if (options.message) message = options.message;
    // L'onglet peut être ouvert avant que la page ait fini de charger ses
    // années : on les demande alors soi-même plutôt que d'afficher une liste vide.
    if (!options.annees || !options.annees.length) {
      var repA = await api('/annees-scolaires');
      var lues = repA && repA.ok ? await repA.json() : [];
      options.annees = Array.isArray(lues) ? lues : [];
    }
    var u = null;
    try { u = JSON.parse(sessionStorage.getItem('ardoise_user') || localStorage.getItem('ardoise_user') || 'null'); } catch (e) {}
    var roles = (u && u.roles) || [];
    peutModifier = roles.some(function (r) { return ['directeur', 'prefet', 'super_admin'].indexOf(r) !== -1; });

    var r = racine();
    r.querySelector('#plan-annee').innerHTML = options.annees.map(function (a) {
      return '<option value="' + a.id + '"' + (a.active ? ' selected' : '') + '>' + esc(a.libelle) + (a.cloturee ? ' (clôturée)' : '') + '</option>';
    }).join('');
    api('/classes').then(function (rep) { return rep && rep.ok ? rep.json() : []; }).then(function (classes) {
      r.querySelector('#plan-portee').innerHTML = '<option value="">Toute l’école (règle commune)</option>'
        + (Array.isArray(classes) ? classes : []).map(function (c) { return '<option value="' + c.id + '">Classe : ' + esc(c.nom) + '</option>'; }).join('');
    });
    if (!r.dataset.branche) {
      r.dataset.branche = '1';
      r.querySelector('#plan-annee').addEventListener('change', charger);
      r.querySelector('#plan-portee').addEventListener('change', charger);
      r.querySelector('#plan-enregistrer').addEventListener('click', enregistrer);
      r.querySelector('#plan-annuler').addEventListener('click', function () { etat.modifs.clear(); dessiner(); });
      r.querySelector('#plan-report-appliquer').addEventListener('click', appliquerReport);
    }
    r.querySelectorAll('.plan-ecriture').forEach(function (el) { el.hidden = !peutModifier; });
    charger();
  }

  async function charger() {
    var r = racine();
    etat.anneeId = r.querySelector('#plan-annee').value;
    etat.classeId = r.querySelector('#plan-portee').value;
    if (etat.modifs.size && !await window.ArdoiseUI.confirmer('Des modifications non enregistrées seront perdues. Continuer ?', { libelleValider: 'Continuer' })) return;
    etat.modifs.clear();
    if (!etat.anneeId) { r.querySelector('#plan-grille').innerHTML = '<p class="etat-vide-tableau">Créez d’abord une année scolaire.</p>'; return; }
    r.querySelector('#plan-grille').innerHTML = '<p class="etat-vide-tableau"><span class="spinner"></span>Chargement…</p>';
    var q = '/plan-evaluation?anneeScolaireId=' + encodeURIComponent(etat.anneeId) + (etat.classeId ? '&classeId=' + encodeURIComponent(etat.classeId) : '');
    var rep = await api(q);
    if (!rep) return;
    var d = await rep.json().catch(function () { return {}; });
    if (!rep.ok) { r.querySelector('#plan-grille').innerHTML = '<p class="etat-vide-tableau">' + esc(d.message || 'Chargement impossible.') + '</p>'; return; }
    etat.donnees = d;
    etat.cases = new Map(d.cases.map(function (c) { return [cle(c.cours_id, c.periode_id), c]; }));
    remplirReport();
    dessiner();
  }

  /** Valeur affichée d'une case : modification en cours, sinon ce que dit le serveur. */
  function valeurCase(c) {
    var k = cle(c.cours_id, c.periode_id);
    if (etat.modifs.has(k)) {
      var m = etat.modifs.get(k);
      // Exception retirée : la case reviendra au barème (ou à la règle de
      // l'école) — la valeur exacte s'affichera après l'enregistrement.
      return m === null ? { maximum: null, retour: true, defaut: c.defaut, portee: 'defaut', modifiee: true } : { maximum: m, portee: 'modif', modifiee: true };
    }
    return { maximum: c.maximum, portee: c.portee, modifiee: false, motif: c.motif };
  }

  function dessiner() {
    var d = etat.donnees;
    var conteneur = racine().querySelector('#plan-grille');
    if (!d.disponible) {
      conteneur.innerHTML = '<p class="plan-alerte">Le plan d’évaluation n’est pas encore activé sur le serveur (migration 072). '
        + 'La cotation suit le barème habituel de chaque branche.</p>';
      return;
    }
    if (!d.epreuves.length) { conteneur.innerHTML = '<p class="etat-vide-tableau">Aucune période ni examen pour cette année : créez-les dans l’onglet « Périodes ».</p>'; return; }
    if (!d.cours.length) { conteneur.innerHTML = '<p class="etat-vide-tableau">Aucune branche à afficher.</p>'; return; }

    // En-tête sur deux niveaux : regroupement (semestre/trimestre), puis épreuve.
    var groupes = [];
    d.epreuves.forEach(function (e) {
      var g = e.regroupement || 'Hors regroupement';
      if (!groupes.length || groupes[groupes.length - 1].nom !== g) groupes.push({ nom: g, n: 0 });
      groupes[groupes.length - 1].n++;
    });
    var html = '<table class="plan-table"><thead><tr><th rowspan="2" class="plan-branche">Branche</th>'
      + groupes.map(function (g) { return '<th colspan="' + g.n + '">' + esc(g.nom) + '</th>'; }).join('')
      + '<th rowspan="2" class="plan-total" title="Somme des maxima de l’année">Total<br/>année</th></tr><tr>'
      + d.epreuves.map(function (e) {
        return '<th class="' + (e.type === 'examen' ? 'plan-examen' : '') + '" title="' + esc(e.libelle) + (e.cloturee ? ' — clôturée' : '') + '">'
          + esc(abreger(e)) + (e.cloturee ? ' 🔒' : '') + '</th>';
      }).join('') + '</tr></thead><tbody>';

    d.cours.forEach(function (co) {
      var total = 0;
      html += '<tr><th class="plan-branche" scope="row">' + esc(co.nom) + '</th>';
      d.epreuves.forEach(function (e) {
        var c = etat.cases.get(cle(co.id, e.id));
        var v = valeurCase(c);
        total += Number(v.retour ? v.defaut : v.maximum) || 0;
        var classes = ['plan-case'];
        if (v.maximum !== null && Number(v.maximum) === 0) classes.push('noire');
        if (v.portee === 'ecole' && etat.classeId) classes.push('heritee');
        if (v.portee === 'classe' || (v.portee === 'ecole' && !etat.classeId)) classes.push('exception');
        if (v.modifiee) classes.push('modifiee');
        var titre = 'Barème habituel : ' + nombre(c.defaut)
          + (v.portee === 'ecole' && etat.classeId ? ' — règle de l’école' : '')
          + (v.motif ? ' — ' + v.motif : '');
        var aff = v.retour ? '' : (Number(v.maximum) === 0 ? 'NE' : nombre(Number(v.maximum)));
        html += '<td class="' + classes.join(' ') + '"><input type="text" inputmode="decimal" aria-label="' + esc(co.nom + ' — ' + e.libelle) + '"'
          + ' data-k="' + cle(co.id, e.id) + '" value="' + aff + '" title="' + esc(titre) + '"'
          + (v.retour ? ' placeholder="barème"' : '')
          + (!peutModifier || e.cloturee ? ' disabled' : '') + ' /></td>';
      });
      html += '<td class="plan-total">' + nombre(total) + '</td></tr>';
    });
    html += '</tbody></table>';
    conteneur.innerHTML = html;

    conteneur.querySelectorAll('input[data-k]').forEach(function (input) {
      input.addEventListener('focus', function () { input.select(); });
      input.addEventListener('change', function () { saisir(input); });
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
      });
    });
    majBarre();
  }

  function abreger(e) {
    if (e.type === 'examen') return 'Examen';
    return (e.numero ? e.numero + (e.numero === 1 ? 're' : 'e') + ' P.' : e.libelle);
  }

  /**
   * Règles de saisie, volontairement simples :
   *   · un nombre → ce maximum ;
   *   · 0, « NE », « - » ou « x » → non évalué à cette épreuve ;
   *   · case vidée → retour au barème habituel (ou à la règle de l'école).
   */
  function saisir(input) {
    var k = input.dataset.k;
    var c = etat.cases.get(k);
    var brut = input.value.trim().toLowerCase().replace(',', '.');
    var cible;
    if (brut === '') cible = null;
    else if (/^(0|ne|-|x|non)$/.test(brut)) cible = 0;
    else {
      var n = Number(brut);
      if (!Number.isFinite(n) || n < 0 || n > 1000) {
        message('Un maximum va de 0 (non évalué) à 1000.', 'erreur');
        dessiner(); return;
      }
      cible = n;
    }
    // Une exception « propre » est celle du niveau affiché : l'école quand
    // aucune classe n'est choisie, la classe sinon. C'est la seule que cet
    // écran crée ou retire ; une valeur héritée n'est jamais réécrite à
    // l'identique.
    var propre = etat.classeId ? c.portee === 'classe' : c.portee === 'ecole';
    var serveur = propre ? c.maximum : null;
    if (cible === serveur || (!propre && cible === c.maximum)) etat.modifs.delete(k);
    else etat.modifs.set(k, cible);
    dessiner();
  }

  function majBarre() {
    var n = etat.modifs.size;
    var r = racine();
    r.querySelector('#plan-etat').textContent = n ? n + ' case(s) modifiée(s), non enregistrée(s).' : 'Aucune modification en cours.';
    r.querySelector('#plan-enregistrer').disabled = !n;
    r.querySelector('#plan-annuler').disabled = !n;
  }

  async function enregistrer() {
    var motif = racine().querySelector('#plan-motif').value.trim();
    var cases = [];
    etat.modifs.forEach(function (maximum, k) {
      var p = k.split('|');
      cases.push({ cours_id: p[0], periode_id: p[1], maximum: maximum, motif: motif || null });
    });
    if (!cases.length) return;
    var bouton = racine().querySelector('#plan-enregistrer');
    bouton.disabled = true; bouton.textContent = 'Enregistrement…';
    var rep = await api('/plan-evaluation', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classeId: etat.classeId || null, cases: cases })
    });
    bouton.textContent = 'Enregistrer le plan';
    if (!rep) { bouton.disabled = false; return; }
    var d = await rep.json().catch(function () { return {}; });
    if (!rep.ok) { bouton.disabled = false; message(d.message || 'Enregistrement impossible.', 'erreur'); return; }
    message(d.message + (d.recalculs ? ' Totaux et places recalculés pour ' + d.recalculs + ' classe(s)/période(s).' : ''), 'succes');
    etat.modifs.clear();
    charger();
  }

  /* ------------------------------------------------------------------
     ASSISTANT « reporter des branches à un autre examen »
     ------------------------------------------------------------------ */
  function remplirReport() {
    var d = etat.donnees, r = racine();
    var examens = d.epreuves.filter(function (e) { return e.type === 'examen' && !e.cloturee; });
    var options = examens.map(function (e) { return '<option value="' + e.id + '">' + esc(e.libelle) + (e.regroupement ? ' (' + esc(e.regroupement) + ')' : '') + '</option>'; }).join('');
    r.querySelector('#plan-report-de').innerHTML = options;
    r.querySelector('#plan-report-vers').innerHTML = options;
    if (examens.length > 1) r.querySelector('#plan-report-vers').value = examens[examens.length - 1].id;
    r.querySelector('#plan-report-cours').innerHTML = d.cours.map(function (c) {
      return '<label><input type="checkbox" value="' + c.id + '" /> ' + esc(c.nom) + '</label>';
    }).join('');
    r.querySelector('#plan-report').hidden = !peutModifier || examens.length < 2;
  }

  function appliquerReport() {
    var r = racine();
    var de = r.querySelector('#plan-report-de').value, vers = r.querySelector('#plan-report-vers').value;
    var cumuler = r.querySelector('#plan-report-cumuler').checked;
    var choisis = Array.prototype.map.call(r.querySelectorAll('#plan-report-cours input:checked'), function (i) { return i.value; });
    if (!de || !vers || de === vers) { message('Choisissez deux examens différents.', 'erreur'); return; }
    if (!choisis.length) { message('Cochez au moins une branche.', 'erreur'); return; }
    choisis.forEach(function (coursId) {
      var source = etat.cases.get(cle(coursId, de));
      var cibleCase = etat.cases.get(cle(coursId, vers));
      var maxSource = Number(valeurCase(source).maximum) || 0;
      var maxCible = Number(valeurCase(cibleCase).maximum) || 0;
      etat.modifs.set(cle(coursId, de), 0);
      if (cumuler && maxSource) etat.modifs.set(cle(coursId, vers), maxCible + maxSource);
    });
    if (!r.querySelector('#plan-motif').value.trim()) {
      var libelleVers = r.querySelector('#plan-report-vers').selectedOptions[0].textContent;
      r.querySelector('#plan-motif').value = 'reporté à : ' + libelleVers;
    }
    dessiner();
    message(choisis.length + ' branche(s) reportée(s) dans la grille. Vérifiez, puis « Enregistrer le plan ».', 'succes');
  }

  window.ArdoisePlanEvaluation = { initialiser: initialiser };
})();
