/* =============================================================================
   ARDOISE — DIDACTICIEL D'INSTALLATION
   =============================================================================

   Un bouton d'aide sur chaque écran, qui répond à UNE question : « qu'est-ce
   que je dois faire maintenant ? »

   PÉRIMÈTRE VOLONTAIREMENT ÉTROIT
   -------------------------------
   Ce module ne raconte pas comment utiliser toute la plateforme. Il accompagne
   L'INSTALLATION : il dit où en est la configuration, quelle est la prochaine
   étape, et signale ce qui a été commencé mais laissé incomplet — un réglage à
   moitié fait ne se voit nulle part et casse quelque chose trois écrans plus
   loin.

   Pour le reste — « comment je saisis mes cotes », « pourquoi ce bouton est
   grisé » — il renvoie à l'assistant de la messagerie, qui dialogue, et au
   manuel du rôle, toujours disponible.

   POURQUOI UN SEUL FICHIER PARTAGÉ
   --------------------------------
   Trente-huit copies d'un même panneau d'aide, ce sont trente-huit versions
   qui divergent au premier changement. Chaque page charge ce fichier et
   déclare son nom d'écran ; tout le reste est ici.

   INSTALLATION DANS UNE PAGE
   --------------------------
     <script src="didacticiel.js" data-ecran="Classes"></script>

   Placé juste avant </body>. L'attribut `data-ecran` sert à orienter la
   réponse de l'assistant ; s'il manque, le nom du fichier est utilisé.
   ========================================================================== */

(function () {
  'use strict';

  // La page de connexion et le changement de mot de passe n'ont pas de session :
  // y afficher un bouton d'aide qui appelle l'API produirait une erreur.
  const PAGES_SANS_AIDE = ['index.html', 'connexion.html', 'changer-mot-de-passe.html', ''];
  const fichier = (window.location.pathname.split('/').pop() || '').toLowerCase();
  if (PAGES_SANS_AIDE.includes(fichier)) return;

  const script = document.currentScript;
  const nomEcran = (script && script.dataset.ecran)
    || fichier.replace('.html', '').replace(/-/g, ' ');

  function lireStockage(cle) {
    try { return localStorage.getItem(cle) || sessionStorage.getItem(cle); }
    catch (e) { return null; }
  }

  const jeton = lireStockage('ardoise_access_token');
  if (!jeton) return;   // pas connecté : rien à afficher

  let utilisateur = null;
  try { utilisateur = JSON.parse(lireStockage('ardoise_user') || 'null'); } catch (e) {}
  const roles = (utilisateur && utilisateur.roles) || [];
  const configure = roles.some(function (r) {
    return ['directeur', 'prefet', 'super_admin'].indexOf(r) !== -1;
  });

  const API = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) || window.API_BASE_URL || '';

  function appeler(chemin) {
    return fetch(API + chemin, { headers: { Authorization: 'Bearer ' + lireStockage('ardoise_access_token') } });
  }

  function echapper(t) {
    const d = document.createElement('div');
    d.textContent = t == null ? '' : String(t);
    return d.innerHTML;
  }

  // ---------------------------------------------------------------------------
  //  Habillage
  // ---------------------------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = [
    '.ard-aide-bouton{position:fixed;right:20px;bottom:20px;z-index:400;width:46px;height:46px;',
    'border-radius:50%;border:none;background:var(--ardoise,#2f4f4f);color:#fff;font-size:1.25rem;',
    'font-weight:600;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,0.22);font-family:inherit;}',
    '.ard-aide-bouton:hover{transform:translateY(-1px);}',
    /* La pastille signale qu'il reste une étape bloquante. Sans elle, personne
       n'ouvrirait un panneau d'aide de sa propre initiative. */
    '.ard-aide-bouton .ard-pastille{position:absolute;top:-2px;right:-2px;width:14px;height:14px;',
    'border-radius:50%;background:#c98a3e;border:2px solid #fff;}',
    '.ard-aide-voile{position:fixed;inset:0;background:rgba(31,43,36,0.45);z-index:401;display:none;',
    'align-items:center;justify-content:center;padding:20px;}',
    '.ard-aide-voile.ouvert{display:flex;}',
    '.ard-aide-panneau{background:var(--craie-2,#fbfaf7);border-radius:12px;padding:26px;max-width:560px;',
    'width:100%;max-height:88vh;overflow-y:auto;font-family:inherit;color:var(--texte-sombre,#22302a);}',
    '.ard-aide-panneau h2{font-size:1.2rem;margin:0 0 4px 0;}',
    '.ard-aide-panneau .ard-sous{font-size:0.84rem;color:var(--texte-att,#6b7269);margin:0 0 18px 0;}',
    '.ard-jauge{height:6px;border-radius:3px;background:rgba(0,0,0,0.08);overflow:hidden;margin-bottom:6px;}',
    '.ard-jauge span{display:block;height:100%;background:var(--vert-ok,#4c7a5a);}',
    '.ard-etape{border:1px solid var(--bordure,#e2ded4);border-radius:8px;padding:14px 16px;margin-bottom:12px;}',
    '.ard-etape h3{font-size:0.98rem;margin:0 0 6px 0;}',
    '.ard-etape .ard-ecran{font-size:0.76rem;color:var(--texte-att,#6b7269);text-transform:uppercase;',
    'letter-spacing:0.04em;margin-bottom:8px;}',
    '.ard-etape p{font-size:0.87rem;line-height:1.5;margin:0 0 8px 0;}',
    '.ard-etape .ard-piege{font-size:0.83rem;background:rgba(201,138,62,0.12);border-left:3px solid #c98a3e;',
    'padding:8px 11px;border-radius:4px;margin:0;}',
    '.ard-alerte{font-size:0.85rem;background:rgba(178,58,46,0.10);border-left:3px solid #b23a2e;',
    'padding:9px 12px;border-radius:4px;margin-bottom:10px;}',
    '.ard-aide-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap;}',
    '.ard-aide-actions button,.ard-aide-actions a{padding:9px 16px;border-radius:6px;border:1.5px solid var(--bordure,#e2ded4);',
    'background:none;font-size:0.86rem;cursor:pointer;font-family:inherit;text-decoration:none;color:inherit;}',
    '.ard-aide-actions .ard-principal{background:var(--ardoise,#2f4f4f);color:#fff;border-color:var(--ardoise,#2f4f4f);}',
    '.ard-termine{font-size:0.88rem;line-height:1.55;}'
  ].join('');
  document.head.appendChild(style);

  const bouton = document.createElement('button');
  bouton.className = 'ard-aide-bouton';
  bouton.type = 'button';
  bouton.title = "Aide — où en est la configuration ?";
  bouton.setAttribute('aria-label', 'Aide');
  bouton.innerHTML = '?';
  document.body.appendChild(bouton);

  const voile = document.createElement('div');
  voile.className = 'ard-aide-voile';
  voile.innerHTML = '<div class="ard-aide-panneau" role="dialog" aria-modal="true"><div id="ard-aide-corps"></div></div>';
  document.body.appendChild(voile);

  function fermer() { voile.classList.remove('ouvert'); }
  voile.addEventListener('click', function (e) { if (e.target === voile) fermer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });

  // ---------------------------------------------------------------------------
  //  Contenu
  // ---------------------------------------------------------------------------
  const LIENS = {
    'Paramètres': 'parametres.html', 'Structure': 'structure.html',
    'Structure › Années scolaires': 'structure.html', 'Structure › Périodes': 'structure.html',
    'Structure › Vacations, puis Emploi du temps › Créneaux': 'emploi-du-temps.html',
    'Structure › Sections et Options': 'structure.html', 'Structure › Cours': 'structure.html',
    'Structure › Classes': 'classes.html', 'Structure › Classes › Cours de la classe': 'classes.html',
    'Utilisateurs': 'utilisateurs.html', 'Élèves': 'eleves.html',
    'Paramètres › Notation, Mentions, Modèles de bulletins': 'parametres.html',
    'Discipline › Barème': 'discipline.html', 'Finances › Frais': 'finances.html',
    'Emploi du temps, Calendrier': 'emploi-du-temps.html'
  };

  function piedDePage() {
    return '<div class="ard-aide-actions">'
      + '<a href="messages.html?assistant=1">Poser une question à l\'assistant</a>'
      + '<button type="button" class="ard-principal" id="ard-fermer">Fermer</button>'
      + '</div>';
  }

  function brancherFermeture() {
    const b = document.getElementById('ard-fermer');
    if (b) b.addEventListener('click', fermer);
  }

  function afficherAideSimple() {
    document.getElementById('ard-aide-corps').innerHTML =
      '<h2>Aide</h2>'
      + '<p class="ard-sous">Écran : ' + echapper(nomEcran) + '</p>'
      + '<p class="ard-termine">La configuration de l\'école est gérée par la direction. '
      + 'Pour une question sur l\'utilisation de cet écran — une manipulation, un bouton, '
      + 'un mot de vocabulaire — l\'assistant de la messagerie répond, et le manuel de votre '
      + 'rôle décrit les procédures pas à pas.</p>'
      + piedDePage();
    brancherFermeture();
  }

  function afficherEtat(d) {
    const corps = document.getElementById('ard-aide-corps');
    let html = '<h2>Configuration de l\'école</h2>'
      + '<p class="ard-sous">Écran actuel : ' + echapper(nomEcran) + '</p>'
      + '<div class="ard-jauge"><span style="width:' + d.progression + '%"></span></div>'
      + '<p class="ard-sous">' + d.progression + ' % de la configuration effectuée</p>';

    // Les alertes AVANT la prochaine étape : un réglage incomplet fait des
    // dégâts silencieux, il passe avant l'avancement.
    (d.alertes || []).forEach(function (a) {
      html += '<div class="ard-alerte"><strong>Étape ' + a.etape + ' — ' + echapper(a.titre)
        + '</strong><br/>' + echapper(a.alerte) + '</div>';
    });

    if (d.prochaine_etape) {
      const e = d.prochaine_etape;
      const lien = LIENS[e.ecran];
      html += '<div class="ard-etape">'
        + '<div class="ard-ecran">Prochaine étape · ' + echapper(e.ecran) + '</div>'
        + '<h3>' + e.etape + '. ' + echapper(e.titre) + '</h3>'
        + '<p>' + echapper(e.quoi) + '</p>'
        + '<p><em>' + echapper(e.pourquoi) + '</em></p>'
        + '<p class="ard-piege">' + echapper(e.piege) + '</p>'
        + (lien ? '<div class="ard-aide-actions"><a class="ard-principal" href="' + lien + '">Aller à l\'écran</a></div>' : '')
        + '</div>';
    } else if (d.termine) {
      html += '<p class="ard-termine">La configuration essentielle est complète. '
        + 'Les étapes facultatives — discipline, frais, emploi du temps — peuvent être '
        + 'faites au fil de l\'eau.</p>';
    }

    html += piedDePage();
    corps.innerHTML = html;
    brancherFermeture();
  }

  let etatCharge = null;

  function ouvrir() {
    voile.classList.add('ouvert');
    if (!configure) { afficherAideSimple(); return; }
    if (etatCharge) { afficherEtat(etatCharge); return; }

    document.getElementById('ard-aide-corps').innerHTML = '<h2>Configuration de l\'école</h2><p class="ard-sous">Vérification…</p>';
    appeler('/assistant/etat-installation')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) { afficherAideSimple(); return; }
        etatCharge = d;
        afficherEtat(d);
      })
      // Une aide qui tombe en panne ne doit pas laisser un panneau vide.
      .catch(function () { afficherAideSimple(); });
  }

  bouton.addEventListener('click', ouvrir);

  // Signalement discret : la pastille n'apparaît que s'il reste une étape
  // bloquante ou un réglage incomplet, et seulement pour qui peut y remédier.
  if (configure) {
    appeler('/assistant/etat-installation')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        etatCharge = d;
        if (d.prochaine_etape || (d.alertes && d.alertes.length)) {
          const pastille = document.createElement('span');
          pastille.className = 'ard-pastille';
          bouton.appendChild(pastille);
        }
      })
      .catch(function () { /* silence : l'aide reste ouvrable à la main */ });
  }
})();
