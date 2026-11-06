/* ==========================================================================
   SITE D'UN CENTRE DE FORMATION — chargé par site-ecole.js
   --------------------------------------------------------------------------
   Même adresse que les écoles (myardoise.com/<adresse>), mêmes thèmes,
   mêmes règles de sécurité (tout texte par e(), toute URL par urlSure()),
   mais d'autres rubriques :
     #/             accueil                  #/test-niveau   test d'anglais
     #/formations   programmes et groupes    #/inscription   préinscription
     #/apprenant    espace apprenant         #/certificat    vérification
     #/contact
   L'espace apprenant s'ouvre avec le matricule et le code d'accès remis par
   le centre ; ils restent dans sessionStorage, effacé à la fermeture.
   ========================================================================== */
window.ArdoiseSiteCentre = function (donnees, o) {
  'use strict';
  var e = o.e, urlSure = o.urlSure, ico = o.ico, API = o.API, CODE = o.CODE, APERCU = o.APERCU;
  var d = donnees, ec = d.ecole, F = d.formation || {};
  var c = o.normaliser(ec.site_config || {});
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var etat = { page: null, apprenant: null, onglet: 'accueil', test: null };

  o.appliquerApparence(c);
  o.favicon(ec);

  var domaine = F.domaine_libelle || 'Formation';
  var anglais = !!F.test_niveau;
  function lieu() { return [ec.commune, ec.ville].filter(Boolean).join(', ') || ec.province || ''; }
  function slogan() { return c.slogan || ec.site_message_accueil || (anglais ? 'Parlez anglais avec assurance — au travail, en voyage, partout.' : 'Des formations concrètes, des coachs disponibles, des résultats mesurables.'); }
  function argent(v, devise) { return v === null || v === undefined ? '' : o.montant(v, devise); }
  function dateCourte(v) { return o.dateLongue(v); }
  function heure(v) { return v ? String(v).slice(0, 5) : ''; }
  var MODES = { presentiel: 'Présentiel', en_ligne: 'En ligne', hybride: 'Hybride' };

  /* ------------------------------------------------------------------ */
  /*  Coquille                                                          */
  /* ------------------------------------------------------------------ */
  var RUBRIQUES = [['accueil', 'Accueil'], ['formations', 'Formations']];
  if (anglais) RUBRIQUES.push(['test-niveau', 'Test de niveau']);
  RUBRIQUES.push(['inscription', 'S’inscrire'], ['certificat', 'Vérifier un certificat'], ['contact', 'Contact']);
  function lien(p) { return '#/' + (p === 'accueil' ? '' : p); }

  function coquille() {
    var marque = '<a class="marque" href="#/">' + o.blason(ec) + '<span class="textes"><span class="nom">' + e(ec.nom) + '</span><span class="lieu">' + e([domaine, lieu()].filter(Boolean).join(' · ')) + '</span></span></a>';
    var haut = '<div class="bandeau-haut"><div class="contenant"><div class="coord">' +
      (ec.telephone ? '<span>' + ico('telephone') + '<a href="' + e(o.tel(ec.telephone)) + '">' + e(ec.telephone) + '</a></span>' : '') +
      (ec.email ? '<span>' + ico('courriel') + '<a href="mailto:' + e(ec.email) + '">' + e(ec.email) + '</a></span>' : '') +
      '</div><div class="coord"><a href="#/apprenant">Espace apprenant</a></div></div></div>';
    var menu = RUBRIQUES.map(function (r) { return '<a href="' + lien(r[0]) + '" data-page="' + r[0] + '">' + e(r[1]) + '</a>'; }).join('');
    var tiroir = RUBRIQUES.map(function (r) { return '<a class="lien" href="' + lien(r[0]) + '" data-page="' + r[0] + '">' + e(r[1]) + '<span>›</span></a>'; }).join('') +
      '<div class="actions"><a class="bouton plein" href="#/apprenant">' + ico('cadenas') + 'Espace apprenant</a>' +
      (ec.telephone ? '<a class="bouton contour plein" href="' + e(o.tel(ec.telephone)) + '">' + ico('telephone') + 'Appeler le centre</a>' : '') + '</div>';
    $('#site').innerHTML = haut + '<header class="entete" id="entete"><div class="contenant">' + marque +
      '<nav class="menu" aria-label="Menu principal">' + menu + '</nav><a class="bouton bouton-entete" href="#/apprenant">' + ico('cadenas') + 'Espace apprenant</a>' +
      '<button class="burger" id="burger" aria-label="Ouvrir le menu" aria-expanded="false"><span></span></button></div></header><div class="tiroir" id="tiroir">' + tiroir + '</div>' +
      '<main id="contenu" tabindex="-1"></main>' + pied() + (APERCU ? '<div class="bandeau-apercu">Aperçu — modifications non enregistrées</div>' : '');
    $('#burger').addEventListener('click', function () { var ouvert = document.body.classList.toggle('menu-ouvert'); this.setAttribute('aria-expanded', ouvert ? 'true' : 'false'); });
    $$('#tiroir a').forEach(function (a) { a.addEventListener('click', function () { document.body.classList.remove('menu-ouvert'); }); });
  }
  function pied() {
    return '<footer class="pied"><div class="contenant"><div class="colonnes"><div><a class="marque" href="#/">' + o.blason(ec) + '<span class="textes"><span class="nom">' + e(ec.nom) + '</span><span class="lieu">' + e(lieu()) + '</span></span></a>' +
      '<p class="devise">' + e(slogan()) + '</p>' + o.liensReseaux(c) + '</div>' +
      '<div><h4>Le centre</h4><ul>' + RUBRIQUES.map(function (r) { return '<li><a href="' + lien(r[0]) + '">' + e(r[1]) + '</a></li>'; }).join('') + '</ul></div>' +
      '<div><h4>Apprenants</h4><ul><li><a href="#/apprenant">Mon espace</a></li><li><a href="#/apprenant">Leçons en ligne</a></li><li><a href="#/certificat">Vérifier un certificat</a></li></ul></div>' +
      '<div><h4>Nous trouver</h4><ul>' + (ec.adresse ? '<li>' + e(ec.adresse) + '</li>' : '') + (lieu() ? '<li>' + e(lieu()) + '</li>' : '') +
      (ec.telephone ? '<li><a href="' + e(o.tel(ec.telephone)) + '">' + e(ec.telephone) + '</a></li>' : '') + (ec.email ? '<li><a href="mailto:' + e(ec.email) + '">' + e(ec.email) + '</a></li>' : '') + '</ul></div></div>' +
      '<div class="bas"><span>© ' + new Date().getFullYear() + ' ' + e(ec.nom) + '.</span><a href="/connexion.html">Accès du personnel</a></div></div></footer>';
  }
  function heros(titre, chapeau, fil) {
    var couv = urlSure(c.couverture_url);
    return '<section class="heros-page">' + (couv ? '<div class="photo" style="background-image:url(\'' + e(couv).replace(/'/g, '%27') + '\')"></div>' : '') +
      '<div class="contenant"><div class="fil"><a href="#/">Accueil</a><span>/</span><span>' + e(fil || titre) + '</span></div><h1>' + e(titre) + '</h1>' + (chapeau ? '<p class="chapeau">' + e(chapeau) + '</p>' : '') + '</div></section>';
  }
  function entete(sur, titre, chapeau, cls) {
    return '<div class="entete-section apparait ' + (cls || '') + '">' + (sur ? '<span class="surtitre">' + e(sur) + '</span>' : '') + '<h2>' + e(titre) + '</h2>' + (chapeau ? '<p class="chapeau">' + e(chapeau) + '</p>' : '') + '</div>';
  }
  function vide(icone, texte) { return '<div class="vide">' + ico(icone) + e(texte) + '</div>'; }

  /* ------------------------------------------------------------------ */
  /*  Blocs                                                              */
  /* ------------------------------------------------------------------ */
  function cartesProgrammes(max) {
    var ps = (F.programmes || []).slice(0, max || 40);
    if (!ps.length) return vide('livre', 'Le catalogue des formations sera publié ici très prochainement.');
    return '<div class="grille g3">' + ps.map(function (p) {
      return '<article class="carte vivante apparait"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' + (p.niveau ? '<span class="etiquette">' + e(p.niveau) + '</span>' : '') + '<span class="etiquette">' + e(MODES[p.mode] || '') + '</span></div>' +
        '<h3>' + e(p.nom) + '</h3>' + (p.description ? '<p class="petit">' + e(p.description) + '</p>' : '') +
        '<ul class="liste-coches" style="margin:14px 0">' + [p.duree_semaines ? p.duree_semaines + ' semaines' : '', p.heures_total ? Number(p.heures_total) + ' heures de cours' : '', p.prochaine_rentree ? 'Prochaine rentrée : ' + dateCourte(p.prochaine_rentree) : '', p.niveau_suivant ? 'Ensuite : ' + p.niveau_suivant : '', Number(p.frais_inscription) > 0 ? 'Frais d’inscription : ' + argent(p.frais_inscription, p.devise) + ' (une seule fois)' : ''].filter(Boolean).map(function (x) { return '<li>' + e(x) + '</li>'; }).join('') + '</ul>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:auto;flex-wrap:wrap">' + (p.prix != null && Number(p.prix) > 0 ? '<strong style="font-size:1.25rem">' + e(argent(p.prix, p.devise)) + '</strong>' : '<span></span>') +
        '<a class="bouton" href="#/inscription?programme=' + encodeURIComponent(p.nom) + '">S’inscrire</a></div></article>';
    }).join('') + '</div>';
  }
  function tableGroupes() {
    var gs = F.groupes || [];
    if (!gs.length) return vide('calendrier', 'Les prochains groupes seront annoncés ici. Préinscrivez-vous pour être prévenu.');
    return '<div class="tableau-conteneur apparait"><table><thead><tr><th>Groupe</th><th>Session</th><th>Formation</th><th>Début</th><th>Horaire</th><th>Mode</th><th class="nombre">Places</th><th></th></tr></thead><tbody>' +
      gs.map(function (g) {
        return '<tr><td><strong>' + e(g.nom) + '</strong></td><td>' + e(g.session || '—') + '</td><td>' + e([g.programme, g.niveau].filter(Boolean).join(' · ')) + '</td><td>' + e(g.date_debut ? dateCourte(g.date_debut) : 'À venir') + '</td><td>' + e(g.horaire || '—') + '</td><td>' + e(MODES[g.mode] || '') + '</td>' +
          '<td class="nombre">' + (g.places === null || g.places === undefined ? '—' : g.places === 0 ? 'Complet' : e(g.places)) + '</td><td>' + (g.places === 0 ? '' : '<a class="lien-fleche" href="#/inscription?groupe=' + encodeURIComponent(g.nom) + '&programme=' + encodeURIComponent(g.programme || '') + '">Réserver</a>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  /* Les sessions : le rythme du centre. Une rentrée datée, avec sa date
     limite d'inscription, crée l'urgence qui remplit les groupes. */
  function blocSessions() {
    var ss = F.sessions || [];
    if (!ss.length) return '';
    return '<section class="section" style="padding-bottom:0"><div class="contenant"><div class="grille g' + Math.min(ss.length, 2) + '">' + ss.slice(0, 2).map(function (x) {
      var ouverte = x.statut === 'inscriptions' && (!x.inscriptions_fin || String(x.inscriptions_fin).slice(0, 10) >= new Date().toISOString().slice(0, 10));
      return '<div class="session-ouverte apparait"><div><span class="etiquette" style="background:rgba(255,255,255,.18);color:inherit">' + (x.statut === 'en_cours' ? 'Session en cours' : ouverte ? 'Inscriptions ouvertes' : 'Prochaine session') + '</span>' +
        '<h3 style="margin-top:10px">' + e(x.nom) + '</h3><p>' + e(['Du ' + dateCourte(x.date_debut) + ' au ' + dateCourte(x.date_fin), x.inscriptions_fin && ouverte ? 'inscriptions jusqu’au ' + dateCourte(x.inscriptions_fin) : '', x.groupes ? x.groupes + ' groupe(s)' : ''].filter(Boolean).join(' · ')) + '</p></div>' +
        (ouverte ? '<a class="bouton blanc" href="#/inscription">Réserver ma place</a>' : '') + '</div>';
    }).join('') + '</div></div></section>';
  }
  function chiffres() {
    var k = F.chiffres || {}, l = [];
    if (k.apprenants > 0) l.push([k.apprenants, 'apprenants formés']);
    if (k.certificats > 0) l.push([k.certificats, 'certificats délivrés']);
    if (k.programmes > 0) l.push([k.programmes, k.programmes > 1 ? 'formations proposées' : 'formation proposée']);
    if (k.satisfaction) l.push([String(k.satisfaction).replace('.', ',') + '/5', 'satisfaction (' + k.avis + ' avis)']);
    if ((F.coachs || []).length) l.push([F.coachs.length, F.coachs.length > 1 ? 'coachs' : 'coach']);
    if (l.length < 2) return '';
    return '<section class="section sombre"><div class="contenant"><div class="chiffres apparait">' + l.slice(0, 4).map(function (x) {
      return '<div class="chiffre"><div class="nb" data-compte="' + e(x[0]) + '">' + e(x[0]) + '</div><div class="libelle">' + e(x[1]) + '</div></div>';
    }).join('') + '</div></div></section>';
  }
  function coachs() {
    var cs = F.coachs || [];
    if (!cs.length) return '';
    return '<section class="section"><div class="contenant">' + entete('L’équipe', 'Vos coachs', 'Des formateurs qui vous suivent personnellement, séance après séance.', 'centre') +
      '<div class="grille g' + Math.min(cs.length, 3) + '">' + cs.map(function (x) {
        var photo = urlSure(x.photo_url);
        return '<article class="carte apparait" style="text-align:center"><div style="width:84px;height:84px;border-radius:50%;margin:0 auto 14px;overflow:hidden;background:var(--accent-doux);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.5rem;color:var(--accent)">' +
          (photo ? '<img src="' + e(photo) + '" alt="" style="width:100%;height:100%;object-fit:cover" loading="lazy">' : e(o.initiales(x.nom))) + '</div><h3>' + e(x.nom) + '</h3>' +
          (x.specialites ? '<p class="petit" style="color:var(--accent);font-weight:600">' + e(x.specialites) + '</p>' : '') + (x.bio ? '<p class="petit">' + e(x.bio) + '</p>' : '') + '</article>';
      }).join('') + '</div></div></section>';
  }
  function temoignages() {
    var ts = (F.temoignages || []).concat((c.temoignages || []).map(function (t) { return { commentaire: t.texte, auteur: t.auteur, note: 5 }; }));
    if (!ts.length) return '';
    return '<section class="section surface"><div class="contenant">' + entete('Ils en parlent', 'L’avis de nos apprenants', null, 'centre') +
      '<div class="grille g' + Math.min(ts.length, 3) + '">' + ts.slice(0, 3).map(function (t) {
        return '<figure class="carte temoignage apparait" style="margin:0"><div style="color:var(--accent);letter-spacing:2px">' + '★★★★★'.slice(0, t.note || 5) + '</div><blockquote>« ' + e(t.commentaire) + ' »</blockquote>' +
          '<figcaption><span class="rond">' + e(o.initiales(t.auteur || '?')) + '</span><span><strong>' + e(t.auteur) + '</strong><small>Apprenant</small></span></figcaption></figure>';
      }).join('') + '</div></div></section>';
  }
  function appel() {
    return '<section class="section"><div class="contenant"><div class="appel apparait"><div><h2>' + (anglais ? 'Prêt à progresser en anglais ?' : 'Prêt à vous former ?') + '</h2><p>' +
      (anglais ? 'Testez votre niveau gratuitement en 15 minutes, puis réservez votre place dans le groupe qui vous correspond.' : 'Préinscrivez-vous en deux minutes : le centre vous rappelle pour confirmer votre groupe.') + '</p></div><div class="actions">' +
      (anglais ? '<a class="bouton blanc" href="#/test-niveau">Tester mon niveau</a>' : '') + '<a class="bouton ' + (anglais ? 'clair' : 'blanc') + '" href="#/inscription">Me préinscrire</a></div></div></div></section>';
  }

  /* ------------------------------------------------------------------ */
  /*  Pages                                                              */
  /* ------------------------------------------------------------------ */
  function pageAccueil() {
    var couv = urlSure(c.couverture_url);
    var g0 = (F.groupes || [])[0];
    var pastille = g0 ? '<a class="pastille" href="#/formations" style="text-decoration:none"><i></i>Inscriptions ouvertes' + (g0.date_debut ? ' — prochain groupe le ' + e(dateCourte(g0.date_debut)) : '') + '</a>' : '<span class="pastille"><i></i>' + e(domaine) + '</span>';
    var actions = '<div class="actions">' + (anglais ? '<a class="bouton blanc" href="#/test-niveau">Tester mon niveau gratuitement</a>' : '<a class="bouton blanc" href="#/formations">Voir les formations</a>') + '<a class="bouton clair" href="#/inscription">Me préinscrire</a></div>';
    var art = couv ? '' : '<div class="art" style="right:max(-80px,calc(50% - 720px));bottom:-10px;width:min(620px,70vw);opacity:.85">' + o.illustration(false) + '</div>';
    var h = '<section class="heros">' + (couv ? '<div class="photo" style="background-image:url(\'' + e(couv).replace(/'/g, '%27') + '\')"></div>' : '') + '<div class="voile"></div>' + art +
      '<div class="contenant dedans"><div class="texte">' + pastille + '<h1>' + e(ec.nom) + '</h1><p class="accroche">' + e(slogan()) + '</p>' + actions + '</div></div></section>';
    var acces = [['#/formations', 'livre', 'Nos formations', (F.programmes || []).length + ' programme(s), groupes du matin, du soir et du week-end']];
    if (anglais) acces.push(['#/test-niveau', 'graphique', 'Test de niveau', 'Gratuit, 30 questions, résultat immédiat']);
    acces.push(['#/apprenant', 'cadenas', 'Espace apprenant', 'Planning, leçons en ligne, résultats et certificats']);
    acces.push(['#/contact', 'telephone', 'Nous contacter', 'Une question ? Le centre vous répond']);
    h += '<div class="contenant acces"><div class="grille g4">' + acces.map(function (a) { return '<a class="carte-acces" href="' + a[0] + '"><span class="ico">' + ico(a[1]) + '</span><span><strong>' + e(a[2]) + '</strong><span>' + e(a[3]) + '</span></span></a>'; }).join('') + '</div></div>';
    var presentation = ec.site_description || (ec.nom + ' accompagne jeunes et professionnels ' + (lieu() ? 'à ' + lieu() : '') + ' avec des formations pratiques, en petits groupes, encadrées par des coachs disponibles. Chaque apprenant suit sa progression en ligne et reçoit un certificat vérifiable à la fin de sa formation.');
    var atouts = c.atouts && c.atouts.length ? c.atouts : [
      { titre: 'Petits groupes', texte: 'Chacun parle, pratique et reçoit l’attention du coach.' },
      { titre: 'Horaires adaptés', texte: 'Des groupes en journée, le soir et le week-end, pour concilier formation et travail.' },
      { titre: 'Leçons en ligne', texte: 'Révisez entre les séances avec des leçons et des quiz corrigés.' },
      { titre: 'Certificat vérifiable', texte: 'Un certificat numéroté que tout employeur peut vérifier en ligne.' }
    ];
    h += blocSessions();
    h += '<section class="section"><div class="contenant deux-colonnes"><div class="apparait"><span class="surtitre">Bienvenue</span><h2>' + e(c.mission ? 'Notre mission' : 'Apprendre vraiment, à votre rythme') + '</h2>' +
      '<p class="chapeau texte-libre" style="margin-top:20px">' + e(c.mission || presentation) + '</p><div style="height:18px"></div><a class="lien-fleche" href="#/formations">Découvrir les formations</a></div>' +
      '<div class="grille g2">' + atouts.slice(0, 4).map(function (x, i) { return '<article class="carte vivante apparait"><div class="ico">' + ico(['equipe', 'horloge', 'livre', 'bouclier'][i % 4]) + '</div><h3>' + e(x.titre) + '</h3><p class="petit">' + e(x.texte) + '</p></article>'; }).join('') + '</div></div></section>';
    h += chiffres();
    h += '<section class="section alt"><div class="contenant"><div class="entete-section ligne apparait"><div><span class="surtitre">Catalogue</span><h2>Nos formations</h2></div><a class="lien-fleche" href="#/formations">Toutes les formations et les horaires</a></div>' + cartesProgrammes(6) + '</div></section>';
    h += coachs() + temoignages() + appel();
    return h;
  }

  function pageFormations() {
    return heros('Formations', 'Programmes, niveaux, durées, prix et prochains groupes.') + blocSessions() +
      '<section class="section"><div class="contenant">' + entete('Catalogue', 'Les programmes') + cartesProgrammes() + '</div></section>' +
      '<section class="section alt"><div class="contenant">' + entete('Calendrier', 'Prochains groupes', 'Les groupes ouverts aux inscriptions et les places restantes.') + tableGroupes() + '</div></section>' + appel();
  }

  function parametre(nom) {
    var m = (window.location.hash.split('?')[1] || '').split('&').map(function (x) { return x.split('='); }).filter(function (x) { return x[0] === nom; })[0];
    return m ? decodeURIComponent(m[1] || '') : '';
  }

  function pageInscription() {
    var ps = F.programmes || [], gs = F.groupes || [];
    var choixProg = parametre('programme'), choixGroupe = parametre('groupe');
    var niveau = etat.test ? etat.test.niveau : '';
    if (c.inscriptions_en_ligne === false || (c.pages && c.pages.inscriptions === false)) {
      return heros('S’inscrire', 'Les inscriptions se font à l’accueil du centre.') + '<section class="section"><div class="contenant">' + vide('telephone', 'Passez au centre ou appelez-nous : nous vous indiquerons le prochain groupe.') + '</div></section>';
    }
    return heros('S’inscrire', 'Préinscrivez-vous en deux minutes : le centre vous recontacte pour confirmer votre groupe et les modalités de paiement.') +
      '<section class="section"><div class="contenant deux-colonnes" style="align-items:start"><div class="apparait"><span class="surtitre">Comment ça marche</span><h2>Trois étapes</h2>' +
      '<div class="etapes" style="margin-top:24px;grid-template-columns:1fr">' + [['Préinscription', 'Vous remplissez ce formulaire, sans rien payer.'], ['Appel du centre', anglais ? 'Le centre confirme votre niveau (ou vous propose le test) et le groupe adapté.' : 'Le centre confirme le groupe et l’horaire qui vous conviennent.'], ['Première séance', 'Vous recevez vos accès à l’espace apprenant et vous commencez.']].map(function (x, i) {
        return '<div class="etape apparait"><span class="pastille-num">' + (i + 1) + '</span><h3>' + e(x[0]) + '</h3><p>' + e(x[1]) + '</p></div>';
      }).join('') + '</div>' + (anglais && !niveau ? '<p class="petit" style="margin-top:18px">Vous ne connaissez pas votre niveau ? <a href="#/test-niveau">Passez le test gratuit</a> d’abord.</p>' : '') + '</div>' +
      '<form class="panneau formulaire apparait" data-centre="preinscription" novalidate><div class="message" role="status"></div>' +
      '<div class="champ"><label for="ci-prog">Formation souhaitée <em>*</em></label><select id="ci-prog" name="programme_souhaite" required><option value="">— Choisir —</option>' +
      ps.map(function (p) { return '<option' + (p.nom === choixProg ? ' selected' : '') + '>' + e(p.nom) + '</option>'; }).join('') + '<option>Je ne sais pas encore — conseillez-moi</option></select></div>' +
      (gs.length ? '<div class="champ"><label for="ci-groupe">Groupe ou horaire préféré</label><select id="ci-groupe" name="groupe_souhaite"><option value="">— Indifférent —</option>' + gs.map(function (g) { return '<option' + (g.nom === choixGroupe ? ' selected' : '') + ' value="' + e(g.nom) + '">' + e(g.nom + (g.horaire ? ' — ' + g.horaire : '')) + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="ligne"><div class="champ"><label for="ci-mode">Mode</label><select id="ci-mode" name="mode_souhaite"><option value="">— Indifférent —</option><option value="presentiel">Présentiel</option><option value="en_ligne">En ligne</option><option value="hybride">Hybride</option></select></div>' +
      '<div class="champ"><label for="ci-niv">Niveau estimé</label><input id="ci-niv" name="niveau_estime" maxlength="40" value="' + e(niveau) + '" placeholder="' + (anglais ? 'ex. A2, ou « débutant »' : 'ex. débutant') + '"></div></div>' +
      '<div class="ligne"><div class="champ"><label for="ci-nom">Nom complet <em>*</em></label><input id="ci-nom" name="nom" required maxlength="120" autocomplete="name"></div>' +
      '<div class="champ"><label for="ci-tel">Téléphone (WhatsApp) <em>*</em></label><input id="ci-tel" name="telephone" type="tel" maxlength="40" autocomplete="tel" placeholder="+243 …"></div></div>' +
      '<div class="ligne"><div class="champ"><label for="ci-mail">E-mail</label><input id="ci-mail" name="email" type="email" maxlength="160" autocomplete="email"></div>' +
      '<div class="champ"><label for="ci-prof">Profession / études</label><input id="ci-prof" name="profession" maxlength="120"></div></div>' +
      '<div class="champ"><label for="ci-dispo">Disponibilités</label><input id="ci-dispo" name="disponibilites" maxlength="200" placeholder="ex. le soir après 17 h, le samedi"></div>' +
      '<div class="champ"><label for="ci-obj">Votre objectif</label><textarea id="ci-obj" name="objectif" maxlength="500" style="min-height:80px" placeholder="ex. réussir un entretien en anglais, obtenir une bourse…"></textarea></div>' +
      '<div class="pot" aria-hidden="true"><label>Ne pas remplir<input name="site_web" tabindex="-1" autocomplete="off"></label></div>' +
      '<button class="bouton plein" type="submit">Envoyer ma préinscription</button></form></div></section>';
  }

  function pageContact() {
    return heros('Contact', 'Une question sur une formation, un horaire ou un paiement ? Écrivez-nous.') +
      '<section class="section"><div class="contenant deux-colonnes" style="align-items:start"><div class="apparait"><span class="surtitre">Coordonnées</span><h2>Nous trouver</h2><ul class="liste-coches" style="margin-top:20px">' +
      (ec.adresse ? '<li>' + e(ec.adresse) + '</li>' : '') + (lieu() ? '<li>' + e(lieu()) + '</li>' : '') + (ec.telephone ? '<li><a href="' + e(o.tel(ec.telephone)) + '">' + e(ec.telephone) + '</a></li>' : '') + (ec.email ? '<li><a href="mailto:' + e(ec.email) + '">' + e(ec.email) + '</a></li>' : '') + (c.horaires ? '<li>' + e(c.horaires) + '</li>' : '') + '</ul>' + o.liensReseaux(c) + '</div>' +
      '<form class="panneau formulaire apparait" data-centre="contact" novalidate><div class="message" role="status"></div>' +
      '<div class="ligne"><div class="champ"><label for="cc-nom">Nom <em>*</em></label><input id="cc-nom" name="nom" required maxlength="120"></div><div class="champ"><label for="cc-tel">Téléphone</label><input id="cc-tel" name="telephone" type="tel" maxlength="40"></div></div>' +
      '<div class="champ"><label for="cc-mail">E-mail</label><input id="cc-mail" name="email" type="email" maxlength="160"></div>' +
      '<div class="champ"><label for="cc-msg">Message <em>*</em></label><textarea id="cc-msg" name="message" required maxlength="3000"></textarea></div>' +
      '<div class="pot" aria-hidden="true"><label>Ne pas remplir<input name="site_web" tabindex="-1" autocomplete="off"></label></div><button class="bouton plein" type="submit">Envoyer</button></form></div></section>';
  }

  /* ---------------------------- Test de niveau ----------------------- */
  function pageTest() {
    if (!anglais) return pageAccueil();
    setTimeout(chargerTest, 0);
    return heros('Test de niveau d’anglais', 'Gratuit et sans engagement : 30 questions, environ 15 minutes. Votre niveau (A1 à C1) s’affiche à la fin et le centre vous propose le groupe adapté.') +
      '<section class="section"><div class="contenant" id="zone-test" style="max-width:860px"><div class="ecran-etat" style="min-height:200px"><div class="anneau"></div>Chargement du test…</div></div></section>';
  }
  function chargerTest() {
    var zone = $('#zone-test'); if (!zone) return;
    if (APERCU) { zone.innerHTML = vide('graphique', 'Aperçu : le test fonctionnera une fois le site publié.'); return; }
    fetch(API + '/public/centre/' + encodeURIComponent(CODE) + '/test-niveau').then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (t) {
      var reponses = new Array(t.questions.length);
      var html = '<form id="form-test" novalidate>' + t.questions.map(function (q) {
        return '<div class="panneau apparait vu" style="margin-bottom:14px;padding:20px"><div class="petit" style="color:var(--texte-doux);margin-bottom:6px">Question ' + (q.numero + 1) + ' / ' + t.questions.length + '</div><p style="font-weight:600;margin:0 0 12px">' + e(q.question) + '</p>' +
          '<div style="display:grid;gap:8px">' + q.choix.map(function (ch, j) { return '<label style="display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--bordure);border-radius:10px;cursor:pointer"><input type="radio" name="q' + q.numero + '" value="' + j + '"> ' + e(ch) + '</label>'; }).join('') + '</div></div>';
      }).join('') +
        '<div class="panneau formulaire apparait vu"><div class="message" role="status"></div><h3>Recevoir mon résultat</h3><p class="petit">Le centre vous rappelle pour vous proposer le groupe qui vous correspond.</p>' +
        '<div class="ligne"><div class="champ"><label for="tn-nom">Nom complet <em>*</em></label><input id="tn-nom" name="nom" required maxlength="120"></div><div class="champ"><label for="tn-tel">Téléphone (WhatsApp) <em>*</em></label><input id="tn-tel" name="telephone" type="tel" maxlength="40"></div></div>' +
        '<div class="ligne"><div class="champ"><label for="tn-mail">E-mail</label><input id="tn-mail" name="email" type="email" maxlength="160"></div><div class="champ"><label for="tn-dispo">Disponibilités</label><input id="tn-dispo" name="disponibilites" maxlength="200"></div></div>' +
        '<div class="champ"><label for="tn-obj">Pourquoi apprendre l’anglais ?</label><input id="tn-obj" name="objectif" maxlength="500"></div>' +
        '<div class="pot" aria-hidden="true"><label>Ne pas remplir<input name="site_web" tabindex="-1" autocomplete="off"></label></div><button class="bouton plein" type="submit">Voir mon niveau</button></div></form>';
      zone.innerHTML = html;
      var f = $('#form-test');
      $$('input[type=radio]', f).forEach(function (r) { r.addEventListener('change', function () { reponses[Number(r.name.slice(1))] = Number(r.value); }); });
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var msg = $('.message', f);
        var corps = { reponses: reponses.map(function (x) { return x === undefined ? null : x; }) };
        ['nom', 'telephone', 'email', 'disponibilites', 'objectif', 'site_web'].forEach(function (k) { corps[k] = (f.elements[k].value || '').trim(); });
        if (reponses.filter(function (x) { return x !== undefined; }).length < 10) { o.afficher(msg, 'Répondez à au moins 10 questions.', 'erreur'); return; }
        if (!corps.nom || (!corps.telephone && !corps.email)) { o.afficher(msg, 'Indiquez votre nom et un téléphone ou un e-mail.', 'erreur'); return; }
        var b = $('button[type=submit]', f); b.disabled = true;
        fetch(API + '/public/centre/' + encodeURIComponent(CODE) + '/test-niveau', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            b.disabled = false;
            if (!res.ok) { o.afficher(msg, res.j.message || 'Envoi impossible.', 'erreur'); return; }
            etat.test = res.j;
            var det = res.j.detail || {};
            zone.innerHTML = '<div class="panneau apparait vu" style="text-align:center"><span class="surtitre">Votre résultat</span><div style="font-size:4rem;font-weight:800;color:var(--accent);line-height:1.1;margin:10px 0">' + e(res.j.niveau) + '</div>' +
              '<p class="chapeau">' + e(res.j.description) + '</p><p class="petit">' + e(res.j.bonnes) + ' bonnes réponses sur ' + e(res.j.total) + ' (' + e(res.j.score) + ' %)</p>' +
              '<div class="tuiles" style="margin:20px 0">' + Object.keys(det).map(function (k) { return '<div class="tuile' + (det[k].bonnes >= 4 ? ' bonne' : '') + '"><small>' + e(k) + '</small><b>' + e(det[k].bonnes) + '/' + e(det[k].total) + '</b></div>'; }).join('') + '</div>' +
              '<p>' + e(res.j.message) + '</p><div class="actions" style="justify-content:center;display:flex;gap:10px;flex-wrap:wrap;margin-top:16px"><a class="bouton" href="#/inscription">Réserver ma place</a><a class="bouton contour" href="#/formations">Voir les groupes</a></div></div>';
            window.scrollTo(0, 0);
          }).catch(function () { b.disabled = false; o.afficher(msg, 'Connexion impossible. Réessayez.', 'erreur'); });
      });
    }).catch(function () { zone.innerHTML = vide('vide', 'Le test n’est pas disponible pour le moment.'); });
  }

  /* ---------------------------- Vérification ------------------------- */
  function pageCertificat() {
    return heros('Vérifier un certificat', 'Employeur, université, ambassade : vérifiez qu’un certificat a bien été délivré par ' + ec.nom + '.') +
      '<section class="section"><div class="contenant" style="max-width:720px"><form class="panneau formulaire apparait vu" id="form-verif" novalidate><div class="message" role="status"></div>' +
      '<div class="champ"><label for="cv-code">Code de vérification (imprimé au bas du certificat)</label><input id="cv-code" maxlength="11" required value="' + e(parametre('code')) + '" placeholder="XXXXX-XXXXX" style="text-transform:uppercase;letter-spacing:.12em;font-family:ui-monospace,monospace"></div>' +
      '<button class="bouton plein" type="submit">Vérifier</button></form><div id="res-verif" style="margin-top:20px"></div></div></section>';
  }
  function brancherVerification() {
    var f = $('#form-verif'); if (!f) return;
    // Arrivée par le QR code du certificat : le code est déjà là, on vérifie aussitôt.
    if (parametre('code')) setTimeout(function () { f.dispatchEvent(new Event('submit', { cancelable: true })); }, 0);
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var code = $('#cv-code').value.trim().toUpperCase().replace(/\s+/g, '');
      if (!/^[A-Z0-9]{5}-?[A-Z0-9]{5}$/.test(code)) { o.afficher($('.message', f), 'Le code a la forme XXXXX-XXXXX.', 'erreur'); return; }
      if (code.indexOf('-') < 0) code = code.slice(0, 5) + '-' + code.slice(5);
      fetch(API + '/public/certificat/' + encodeURIComponent(code)).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (res) {
        var z = $('#res-verif');
        if (!res.ok) { z.innerHTML = '<div class="message visible erreur">' + e(res.j.message || 'Aucun certificat ne correspond à ce code.') + '</div>'; return; }
        var x = res.j.certificat;
        z.innerHTML = '<div class="panneau"><div class="message visible ' + (res.j.valide ? 'succes' : 'erreur') + '">' + e(res.j.message) + '</div><table style="width:100%;margin-top:14px"><tbody>' +
          [['Titulaire', [x.prenom, x.nom].filter(Boolean).join(' ')], ['Formation', x.programme_nom], ['Niveau', x.niveau], ['Mention', x.mention], ['Heures suivies', x.heures], ['Délivré le', dateCourte(x.date_delivrance)], ['Numéro', x.numero], ['Centre', x.centre + (x.ville ? ' — ' + x.ville : '')]]
            .filter(function (l) { return l[1]; }).map(function (l) { return '<tr><td style="padding:6px 0;color:var(--texte-doux)">' + e(l[0]) + '</td><td style="padding:6px 0;font-weight:600">' + e(l[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      }).catch(function () { o.afficher($('.message', f), 'Connexion impossible. Réessayez.', 'erreur'); });
    });
  }

  /* ---------------------------- Espace apprenant --------------------- */
  var CLE = 'centre-' + String(CODE).toLowerCase() + '-apprenant';
  function identifiants() { try { return JSON.parse(sessionStorage.getItem(CLE) || 'null'); } catch (x) { return null; } }
  function memoriser(v) { try { if (v) sessionStorage.setItem(CLE, JSON.stringify(v)); else sessionStorage.removeItem(CLE); } catch (x) { /* privé */ } }
  function appelApprenant(chemin, corps) {
    return fetch(API + '/public/centre/' + encodeURIComponent(CODE) + '/apprenant' + chemin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, identifiants(), corps || {})) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var er = new Error(j.message || 'Erreur'); er.status = r.status; throw er; } return j; }); },
        function () { var er = new Error('Pas de connexion internet.'); er.horsLigne = true; throw er; });
  }

  /* HORS CONNEXION — l'espace reste lisible, les réponses partent plus tard.
     La dernière version de l'espace et les leçons ouvertes sont gardées sur
     le téléphone (localStorage). Une réponse de quiz envoyée sans réseau est
     mise en file et renvoyée dès que la connexion revient. */
  var CLE_CACHE = 'centre-' + String(CODE).toLowerCase() + '-cache';
  var CLE_FILE = 'centre-' + String(CODE).toLowerCase() + '-file';
  function lireCache() { try { return JSON.parse(localStorage.getItem(CLE_CACHE) || '{}'); } catch (x) { return {}; } }
  function ecrireCache(c) { try { localStorage.setItem(CLE_CACHE, JSON.stringify(c)); } catch (x) { /* plein : tant pis */ } }
  function mettreEnCache(cle, valeur) { var id = identifiants(); if (!id) return; var c = lireCache(); if (c.matricule !== id.matricule) c = { matricule: id.matricule }; c[cle] = { valeur: valeur, le: Date.now() }; ecrireCache(c); }
  function depuisCache(cle) { var id = identifiants(), c = lireCache(); return id && c.matricule === id.matricule && c[cle] ? c[cle] : null; }
  function fileAttente() { try { return JSON.parse(localStorage.getItem(CLE_FILE) || '[]'); } catch (x) { return []; } }
  function enFile(chemin, corps) { var f = fileAttente(); f.push({ chemin: chemin, corps: corps, le: Date.now() }); try { localStorage.setItem(CLE_FILE, JSON.stringify(f.slice(-30))); } catch (x) {} }
  function viderFile() {
    var f = fileAttente(); if (!f.length || !identifiants()) return;
    try { localStorage.setItem(CLE_FILE, '[]'); } catch (x) {}
    f.reduce(function (p, item) { return p.then(function () { return appelApprenant(item.chemin, item.corps).catch(function (err) { if (err.horsLigne) enFile(item.chemin, item.corps); }); }); }, Promise.resolve())
      .then(function () { if (!fileAttente().length && etat.apprenant) { bandeau('Connexion retrouvée : vos réponses en attente ont été envoyées.', 'succes'); } });
  }
  window.addEventListener('online', viderFile);
  function bandeau(texte, type) {
    var b = $('#bandeau-reseau'); if (!b) { b = document.createElement('div'); b.id = 'bandeau-reseau'; b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:50;padding:12px 14px;border-radius:12px;font-size:.9rem;box-shadow:0 8px 24px rgba(0,0,0,.2)'; document.body.appendChild(b); }
    b.style.background = type === 'succes' ? '#E7F6EC' : '#FFF4E0'; b.style.color = type === 'succes' ? '#1D5E33' : '#7A4A12';
    b.textContent = texte; clearTimeout(b._t); b._t = setTimeout(function () { b.remove(); }, 7000);
  }
  function lecteurVideo(url) {
    var u = urlSure(url); if (!u) return '';
    var yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
    if (yt) return '<div style="position:relative;padding-top:56.25%;border-radius:14px;overflow:hidden;background:#000"><iframe src="https://www.youtube-nocookie.com/embed/' + e(yt[1]) + '?rel=0" title="Vidéo" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>';
    var dr = u.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
    if (dr) return '<div style="position:relative;padding-top:56.25%;border-radius:14px;overflow:hidden;background:#000"><iframe src="https://drive.google.com/file/d/' + e(dr[1]) + '/preview" title="Vidéo" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="autoplay; fullscreen" allowfullscreen loading="lazy"></iframe></div>';
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) return '<video controls preload="none" src="' + e(u) + '" style="width:100%;border-radius:14px;background:#000"></video>';
    return '<a class="bouton" target="_blank" rel="noopener" href="' + e(u) + '">▶ Ouvrir la vidéo</a>';
  }
  function pageApprenant() {
    setTimeout(etat.apprenant ? dessinerEspace : (identifiants() ? chargerEspace : formulaireConnexion), 0);
    return heros('Espace apprenant', 'Votre planning, vos leçons en ligne, vos résultats, vos paiements et vos certificats.') +
      '<section class="section" style="padding-top:clamp(40px,6vw,70px)"><div class="contenant" id="zone-apprenant"><div class="ecran-etat" style="min-height:200px"><div class="anneau"></div>Chargement…</div></div></section>';
  }
  function formulaireConnexion(message, apres) {
    var z = $('#zone-apprenant'); if (!z) return;
    z.innerHTML = '<div class="connexion-famille"><div class="apparait vu"><span class="surtitre">Connexion</span><h2>Accédez à votre espace</h2><p class="chapeau" style="margin:18px 0 28px">Le centre vous a remis un matricule et un code d’accès à votre inscription. Vous les avez perdus ? Demandez-les à l’accueil.</p>' +
      '<div class="carte-code" aria-hidden="true"><div class="puce-or"></div><div style="font-weight:700">' + e(ec.nom) + '</div><div class="ligne-code"><span>Matricule</span><span>Code d’accès</span></div><div style="display:flex;justify-content:space-between;margin-top:4px"><span class="valeur-code">AP-2026-00001</span><span class="valeur-code">K7P•••</span></div></div></div>' +
      '<form class="panneau formulaire apparait vu" id="form-apprenant" novalidate><div class="message' + (message ? ' visible erreur' : '') + '" role="status">' + e(message || '') + '</div>' +
      '<div class="champ"><label for="ap-mat">Matricule</label><input id="ap-mat" autocomplete="username" autocapitalize="characters" required placeholder="ex. AP-2026-00001"></div>' +
      '<div class="champ"><label for="ap-code">Code d’accès</label><input id="ap-code" autocomplete="current-password" autocapitalize="characters" maxlength="12" required style="text-transform:uppercase;letter-spacing:.14em;font-family:ui-monospace,monospace" placeholder="XXXXXX"></div>' +
      '<button class="bouton plein" type="submit">' + ico('cadenas') + 'Entrer</button></form></div>';
    $('#form-apprenant').addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (APERCU) { o.afficher($('.message', this), 'Aperçu : l’espace apprenant fonctionnera une fois le site publié.', 'info'); return; }
      memoriser({ matricule: $('#ap-mat').value.trim(), code_acces: $('#ap-code').value.trim().toUpperCase() });
      (apres || chargerEspace)();
    });
  }
  function chargerEspace() {
    var z = $('#zone-apprenant'); if (!z) return;
    z.innerHTML = '<div class="ecran-etat" style="min-height:200px"><div class="anneau"></div>Chargement…</div>';
    appelApprenant('').then(function (D) { etat.apprenant = D; mettreEnCache('espace', D); dessinerEspace(); viderFile(); }).catch(function (err) {
      if (err.status === 401 || err.status === 404) { memoriser(null); formulaireConnexion(err.message); return; }
      var c = depuisCache('espace');
      if (c) {
        etat.apprenant = c.valeur; etat.horsLigne = true; dessinerEspace();
        bandeau('Hors connexion : vous consultez la version enregistrée le ' + new Date(c.le).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '.', 'info');
        return;
      }
      z.innerHTML = vide('vide', 'Connexion au serveur impossible. Vérifiez votre réseau puis rechargez la page.');
    });
  }
  function tuile(lib, val, cls) { return '<div class="tuile ' + (cls || '') + '"><small>' + e(lib) + '</small><b>' + val + '</b></div>'; }
  function dessinerEspace() {
    var z = $('#zone-apprenant'), D = etat.apprenant; if (!z || !D) return;
    var A = D.apprenant, I = D.indicateurs;
    var onglets = [['accueil', 'accueil', 'Mon planning'], ['replays', 'presence', 'Cours enregistrés' + ((D.replays || []).filter(function (r) { return !r.valide_at; }).length ? ' (' + D.replays.filter(function (r) { return !r.valide_at; }).length + ')' : '')], ['lecons', 'livre', 'Leçons en ligne'], ['resultats', 'resultats', 'Mes résultats'], ['paiements', 'portefeuille', 'Paiements'], ['certificats', 'etoile', 'Certificats']];
    if (!D.reglages || D.reglages.avis !== false) onglets.push(['avis', 'coeur', 'Donner mon avis']);
    z.innerHTML = '<div class="tableau-bord"><aside class="panneau profil-eleve"><div class="avatar">' + e(o.initiales([A.prenom, A.nom].join(' '))) + '</div><h3 style="margin:0">' + e([A.prenom, A.nom].filter(Boolean).join(' ')) + '</h3>' +
      '<div class="meta">' + e(A.niveau_actuel ? 'Niveau ' + A.niveau_actuel : 'Niveau à évaluer') + '</div><span class="matricule">' + e(A.matricule) + '</span>' +
      '<nav class="onglets-famille">' + onglets.map(function (x) { return '<button data-onglet="' + x[0] + '" class="' + (x[0] === etat.onglet ? 'actif' : '') + '">' + ico(x[1]) + e(x[2]) + '</button>'; }).join('') + '</nav>' +
      '<button class="bouton contour plein" style="margin-top:14px" data-agenda>' + ico('calendrier') + 'Ajouter à mon agenda</button>' +
      '<button class="bouton contour plein" style="margin-top:8px" data-sortir>' + ico('sortie') + 'Se déconnecter</button></aside><div class="panneau" id="volet-apprenant"></div></div>';
    $$('[data-onglet]', z).forEach(function (b) { b.addEventListener('click', function () { etat.onglet = b.getAttribute('data-onglet'); dessinerEspace(); }); });
    $('[data-sortir]', z).addEventListener('click', function () { memoriser(null); etat.apprenant = null; try { localStorage.removeItem(CLE_CACHE); } catch (x) {} formulaireConnexion(); });
    $('[data-agenda]', z).addEventListener('click', function () {
      appelApprenant('/agenda').then(function (l) {
        var v2 = $('#volet-apprenant');
        v2.innerHTML = '<h2 style="font-size:1.5rem">Mon agenda</h2><p class="chapeau">Vos cours apparaissent dans l’agenda de votre téléphone, avec une alerte une heure avant. Tout se met à jour automatiquement.</p>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px"><a class="bouton" target="_blank" rel="noopener" href="' + e(l.google) + '">Android / Google Agenda</a><a class="bouton contour" href="' + e(l.webcal) + '">iPhone</a></div><p class="petit" style="margin-top:14px;color:var(--texte-doux)">Ce lien est personnel : ne le partagez pas.</p>';
      }).catch(function (err) { bandeau(err.message, 'info'); });
    });
    var v = $('#volet-apprenant');
    var titre = function (t, s) { return '<div style="margin-bottom:22px"><h2 style="font-size:1.6rem">' + e(t) + '</h2>' + (s ? '<p class="petit" style="color:var(--texte-doux);margin:6px 0 0">' + e(s) + '</p>' : '') + '</div>'; };
    if (etat.onglet === 'accueil') {
      var aVenir = D.seances.filter(function (s) { return String(s.date_seance).slice(0, 10) >= new Date().toISOString().slice(0, 10) && s.statut !== 'faite'; });
      var devoirs = D.seances.filter(function (s) { return s.devoirs; }).slice(-3).reverse();
      v.innerHTML = titre('Bonjour ' + (A.prenom || A.nom) + ' !', D.inscriptions.length ? D.inscriptions.map(function (i) { return i.groupe + (i.horaire ? ' — ' + i.horaire : ''); }).join(' · ') : 'Vous n’êtes inscrit dans aucun groupe pour le moment.') +
        '<div class="tuiles">' + tuile('Assiduité', I.taux_presence === null ? '—' : Math.round(I.taux_presence) + ' %', I.taux_presence >= 85 ? 'bonne' : I.taux_presence !== null && I.taux_presence < 70 ? 'alerte' : '') + tuile('Séances suivies', e(I.seances_suivies)) + tuile('Leçons terminées', e(I.lecons_terminees) + ' / ' + e(I.lecons_disponibles)) + '</div>' +
        '<h3 style="margin:26px 0 10px">Prochaines séances</h3>' + (aVenir.length ? '<div class="agenda">' + aVenir.slice(0, 8).map(function (s) {
          var dt = o.dateObj(s.date_seance);
          var ajd = String(s.date_seance).slice(0, 10) === new Date().toISOString().slice(0, 10);
          return '<div class="evenement"><div class="jour"><b>' + (dt ? dt.getDate() : '') + '</b><small>' + (dt ? o.MOIS_COURTS[dt.getMonth()] : '') + '</small></div><div><strong>' + e(s.groupe) + (s.heure_debut ? ' — ' + e(heure(s.heure_debut)) : '') + '</strong><span>' + e(s.theme || (s.mode === 'enregistre' ? 'Cours enregistré' : MODES[s.mode]) || '') + '</span>' +
            (s.ma_presence ? '<div class="petit" style="color:#1D5E33;margin-top:4px">✓ Présence enregistrée</div>' : '') +
            (s.en_ligne ? '<div style="margin-top:6px"><a class="bouton" style="padding:6px 12px;font-size:.85rem" href="#/classe?s=' + e(s.ref) + '">' + (ajd ? 'Rejoindre la classe' : 'Voir la classe en ligne') + '</a></div>' : (D.reglages && D.reglages.pointage_qr && ajd ? '<div class="petit" style="margin-top:4px;color:var(--texte-doux)">En salle : scannez le QR code affiché par votre coach.</div>' : '')) + '</div></div>';
        }).join('') + '</div>' : vide('calendrier', 'Aucune séance programmée pour le moment.')) +
        (devoirs.length ? '<h3 style="margin:26px 0 10px">Devoirs</h3>' + devoirs.map(function (s) { return '<div class="carte" style="margin-bottom:10px"><small class="petit" style="color:var(--texte-doux)">' + e(dateCourte(s.date_seance)) + ' · ' + e(s.groupe) + '</small><p style="margin:6px 0 0" class="texte-libre">' + e(s.devoirs) + '</p></div>'; }).join('') : '');
    } else if (etat.onglet === 'replays') {
      var rs = D.replays || [];
      v.innerHTML = titre('Cours enregistrés', D.reglages && D.reglages.replay_compte_presence ? 'Vous avez manqué un cours ou votre connexion a coupé ? Suivez l’enregistrement : votre présence est comptée après ' + D.reglages.replay_minutes_min + ' minutes.' : 'Revoyez vos cours quand vous voulez.') +
        (rs.length ? '<div class="grille g2">' + rs.map(function (r) {
          return '<article class="carte" style="display:flex;flex-direction:column;gap:6px"><span class="petit" style="color:var(--texte-doux)">' + e(dateCourte(r.date_seance)) + ' · ' + e(r.groupe) + '</span><h3 style="margin:2px 0">' + e(r.theme || 'Cours du ' + dateCourte(r.date_seance)) + '</h3>' +
            (r.valide_at ? '<span class="etiquette" style="background:#E7F6EC;color:#1D5E33;align-self:flex-start">Suivi ✓</span>' : '') +
            '<a class="bouton" style="margin-top:auto" href="#/replay?s=' + e(r.ref) + '">' + (r.valide_at ? 'Revoir' : 'Suivre le cours') + '</a></article>';
        }).join('') + '</div>' : vide('presence', 'Aucun cours enregistré pour le moment. Votre coach les publie après les séances en ligne.'));
    } else if (etat.onglet === 'lecons') {
      v.innerHTML = titre('Leçons en ligne', 'Révisez entre les séances. Chaque quiz est corrigé immédiatement.') + (D.lecons.length ? '<div class="grille g2">' + D.lecons.map(function (l) {
        return '<article class="carte" style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;gap:6px;flex-wrap:wrap">' + (l.niveau ? '<span class="etiquette">' + e(l.niveau) + '</span>' : '') + (l.progression === 'terminee' ? '<span class="etiquette" style="background:#E7F6EC;color:#1D5E33">Terminée' + (l.score !== null ? ' · ' + Math.round(l.score) + ' %' : '') + '</span>' : '') + '</div>' +
          '<h3 style="margin:4px 0">' + e(l.titre) + '</h3>' + (l.resume ? '<p class="petit">' + e(l.resume) + '</p>' : '') + '<p class="petit" style="color:var(--texte-doux)">' + e([l.duree_minutes ? l.duree_minutes + ' min' : '', l.questions ? l.questions + ' question(s)' : '', l.video_url ? 'vidéo' : ''].filter(Boolean).join(' · ')) + '</p>' +
          '<button class="bouton" style="margin-top:auto" data-lecon="' + e(l.id) + '">' + (l.progression === 'terminee' ? 'Revoir' : l.progression ? 'Continuer' : 'Commencer') + '</button></article>';
      }).join('') + '</div>' : vide('livre', 'Votre coach publiera bientôt des leçons pour votre programme.'));
      $$('[data-lecon]', v).forEach(function (b) { b.addEventListener('click', function () { ouvrirLecon(b.getAttribute('data-lecon')); }); });
    } else if (etat.onglet === 'resultats') {
      var ev = D.evaluations;
      v.innerHTML = titre('Mes résultats', 'Vos évaluations, du test de placement à l’examen final.') + (ev.length ? '<div class="bulletins">' + ev.slice().reverse().map(function (x) {
        var p = x.score_global === null ? null : Math.round(Number(x.score_global));
        return '<div class="bulletin"><div class="periode">' + e({ placement: 'Placement', quiz: 'Quiz', mi_parcours: 'Mi-parcours', final: 'Examen final', oral: 'Oral' }[x.type] || x.type) + ' · ' + e(dateCourte(x.date_evaluation)) + '</div>' +
          '<div class="jauge" style="--p:' + (p === null ? 0 : p) + (p !== null && p < 50 ? ';--couleur-jauge:#D2462E' : '') + '" data-texte="' + (p === null ? '—' : p + '%') + '"></div>' + (x.niveau_atteint ? '<div class="mention">Niveau ' + e(x.niveau_atteint) + '</div>' : '') +
          ['score_oral', 'score_ecrit', 'score_comprehension_orale', 'score_comprehension_ecrite'].filter(function (k) { return x[k] !== null; }).map(function (k) { return '<div class="rang">' + e({ score_oral: 'Oral', score_ecrit: 'Écrit', score_comprehension_orale: 'Compréhension orale', score_comprehension_ecrite: 'Compréhension écrite' }[k]) + ' : ' + Math.round(x[k]) + '</div>'; }).join('') +
          (x.commentaire ? '<div class="rang" style="font-style:italic">' + e(x.commentaire) + '</div>' : '') + '</div>';
      }).join('') + '</div>' : vide('resultats', 'Aucune évaluation pour le moment.'));
    } else if (etat.onglet === 'paiements') {
      v.innerHTML = titre('Paiements', 'Ce que vous avez réglé et ce qu’il reste à payer.') + (D.inscriptions.length ? '<div class="tableau-conteneur"><table><thead><tr><th>Formation</th><th class="nombre">Montant</th><th class="nombre">Payé</th><th class="nombre">Reste</th></tr></thead><tbody>' +
        D.inscriptions.map(function (i) { return '<tr><td>' + e([i.programme, i.groupe].filter(Boolean).join(' — ')) + '</td><td class="nombre">' + e(argent(i.montant, i.devise)) + '</td><td class="nombre">' + e(argent(i.paye, i.devise)) + '</td><td class="nombre"><strong>' + e(argent(i.reste, i.devise)) + '</strong></td></tr>'; }).join('') + '</tbody></table></div>' : '') +
        (D.paiements.length ? '<h3 style="margin:24px 0 10px">Reçus</h3><div class="tableau-conteneur"><table><thead><tr><th>Reçu</th><th>Date</th><th class="nombre">Montant</th></tr></thead><tbody>' + D.paiements.map(function (p) { return '<tr><td>' + e(p.numero_recu) + '</td><td>' + e(dateCourte(p.date_paiement)) + '</td><td class="nombre">' + e(argent(p.montant, p.devise)) + '</td></tr>'; }).join('') + '</tbody></table></div>' : vide('portefeuille', 'Aucun paiement enregistré.'));
    } else if (etat.onglet === 'certificats') {
      v.innerHTML = titre('Certificats', 'Vos certificats et leur code de vérification, à communiquer à un employeur.') + (D.certificats.length ? D.certificats.map(function (x) {
        return '<div class="carte" style="margin-bottom:12px"><span class="etiquette">' + e(x.numero) + '</span><h3 style="margin:10px 0 4px">' + e(x.programme_nom) + '</h3><p class="petit">' + e([x.niveau ? 'Niveau ' + x.niveau : '', x.mention ? 'Mention ' + x.mention : '', x.heures ? x.heures + ' h' : '', 'délivré le ' + dateCourte(x.date_delivrance)].filter(Boolean).join(' · ')) + '</p>' +
          '<p class="petit">Code de vérification : <strong style="font-family:ui-monospace,monospace;letter-spacing:.08em">' + e(x.code_verification) + '</strong> — à vérifier sur <a href="#/certificat">cette page</a>.</p></div>';
      }).join('') : vide('etoile', 'Votre certificat apparaîtra ici à la fin de votre formation. Le certificat papier est remis par le centre.'));
    } else if (etat.onglet === 'avis') {
      var groupes = D.inscriptions.filter(function (i) { return i.statut === 'active' || i.statut === 'terminee'; });
      v.innerHTML = titre('Donner mon avis', 'Votre avis est lu par le chef de centre. Il aide à améliorer les cours (un avis par semaine et par groupe).') + (groupes.length ? '<form class="formulaire" id="form-avis" novalidate><div class="message" role="status"></div>' +
        '<div class="champ"><label for="av-g">Groupe</label><select id="av-g">' + groupes.map(function (g) { return '<option value="' + e(g.groupe_ref) + '">' + e(g.groupe) + (g.coach ? ' — ' + e(g.coach) : '') + '</option>'; }).join('') + '</select></div>' +
        '<div class="champ"><label>Votre note</label><div class="bascule" id="av-note">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-n="' + n + '"' + (n === 5 ? ' class="actif"' : '') + '>' + '★'.repeat(n) + '</button>'; }).join('') + '</div></div>' +
        '<div class="champ"><label for="av-c">Commentaire (facultatif)</label><textarea id="av-c" maxlength="1000" placeholder="Ce qui vous plaît, ce qui pourrait être amélioré…"></textarea></div><button class="bouton plein" type="submit">Envoyer mon avis</button></form>' : vide('coeur', 'Vous pourrez donner votre avis dès votre inscription dans un groupe.'));
      var note = 5;
      $$('#av-note button', v).forEach(function (b) { b.addEventListener('click', function () { note = Number(b.getAttribute('data-n')); $$('#av-note button', v).forEach(function (x) { x.classList.toggle('actif', x === b); }); }); });
      var fa = $('#form-avis', v); if (fa) fa.addEventListener('submit', function (ev2) {
        ev2.preventDefault();
        appelApprenant('/avis', { groupe: $('#av-g').value, note: note, commentaire: $('#av-c').value.trim() })
          .then(function (r) { o.afficher($('.message', fa), r.message, 'succes'); $('#av-c').value = ''; })
          .catch(function (err) { o.afficher($('.message', fa), err.message, 'erreur'); });
      });
    }
  }
  function ouvrirLecon(id) {
    var v = $('#volet-apprenant');
    v.innerHTML = '<div class="ecran-etat" style="min-height:200px"><div class="anneau"></div>Ouverture de la leçon…</div>';
    appelApprenant('/lecon', { lecon: id, action: 'ouvrir' }).then(function (r) { mettreEnCache('lecon:' + id, r); return r; }, function (err) {
      var c = err.horsLigne && depuisCache('lecon:' + id);
      if (c) { bandeau('Hors connexion : leçon enregistrée sur votre téléphone.', 'info'); return c.valeur; }
      throw err;
    }).then(function (r) {
      var l = r.lecon, choix = new Array(l.quiz.length);
      var video = urlSure(l.video_url), doc = urlSure(l.ressource_url);
      v.innerHTML = '<button class="lien-fleche" data-retour style="background:none;border:0;cursor:pointer;padding:0;margin-bottom:14px">← Toutes les leçons</button><h2 style="font-size:1.6rem;margin:0 0 6px">' + e(l.titre) + '</h2>' +
        (l.resume ? '<p class="chapeau">' + e(l.resume) + '</p>' : '') + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:14px 0">' + (video ? '<a class="bouton" target="_blank" rel="noopener" href="' + e(video) + '">▶ Regarder la vidéo</a>' : '') + (doc ? '<a class="bouton contour" target="_blank" rel="noopener" href="' + e(doc) + '">' + ico('document') + 'Document</a>' : '') + '</div>' +
        (urlSure(l.audio_url) ? '<div class="carte" style="margin:10px 0"><strong>Version audio</strong> <span class="petit" style="color:var(--texte-doux)">— idéale avec une petite connexion</span><audio controls preload="none" src="' + e(l.audio_url) + '" style="width:100%;margin-top:8px"></audio></div>' : '') +
        (l.contenu ? '<div class="texte-libre" style="line-height:1.7;margin:18px 0">' + e(l.contenu) + '</div>' : '') +
        (l.quiz.length ? '<h3 style="margin-top:26px">Quiz — ' + l.quiz.length + ' question(s)</h3><form id="form-quiz" novalidate>' + l.quiz.map(function (q) {
          return '<div class="carte" style="margin-bottom:10px" data-q="' + q.numero + '"><p style="font-weight:600;margin:0 0 10px">' + (q.numero + 1) + '. ' + e(q.question) + '</p><div style="display:grid;gap:6px">' + q.choix.map(function (ch, j) {
            return '<label style="display:flex;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--bordure);border-radius:10px;cursor:pointer" data-choix="' + j + '"><input type="radio" name="q' + q.numero + '" value="' + j + '"> ' + e(ch) + '</label>';
          }).join('') + '</div><div class="petit" data-explication style="margin-top:8px"></div></div>';
        }).join('') + '<div class="message" role="status"></div><button class="bouton plein" type="submit">Valider mes réponses</button></form>' : '<button class="bouton plein" data-terminer>J’ai terminé cette leçon</button><div class="message" role="status" style="margin-top:10px"></div>');
      $('[data-retour]', v).addEventListener('click', function () { chargerEspace(); });
      function terminer(reponses, zoneMsg) {
        appelApprenant('/lecon', { lecon: id, action: 'terminer', reponses: reponses }).then(function (res) {
          if (res.total) {
            res.correction.forEach(function (cr) {
              var bloc = $('[data-q="' + cr.numero + '"]', v); if (!bloc) return;
              $$('[data-choix]', bloc).forEach(function (lab) { var j = Number(lab.getAttribute('data-choix')); if (j === cr.bonne) lab.style.cssText += ';border-color:#1D5E33;background:#E7F6EC'; else if (j === reponses[cr.numero]) lab.style.cssText += ';border-color:#8F2318;background:#FDECEA'; });
              if (cr.explication) $('[data-explication]', bloc).textContent = cr.explication;
            });
            o.afficher(zoneMsg, 'Score : ' + res.score + ' % (' + res.bonnes + '/' + res.total + '). ' + (res.score >= 80 ? 'Excellent travail !' : res.score >= 50 ? 'Bien — relisez les explications pour progresser.' : 'Relisez la leçon et réessayez : c’est comme ça qu’on progresse.'), res.score >= 50 ? 'succes' : 'info');
          } else {
            o.afficher(zoneMsg, 'Leçon marquée comme terminée. Bravo !', 'succes');
          }
          etat.apprenant = null;
          appelApprenant('').then(function (D) { etat.apprenant = D; }).catch(function () {});
        }).catch(function (err) {
          if (err.horsLigne) { enFile('/lecon', { lecon: id, action: 'terminer', reponses: reponses }); o.afficher(zoneMsg, 'Pas de connexion : vos réponses sont gardées et seront envoyées automatiquement dès que le réseau revient.', 'info'); return; }
          o.afficher(zoneMsg, err.message, 'erreur');
        });
      }
      var fq = $('#form-quiz', v);
      if (fq) {
        $$('input[type=radio]', fq).forEach(function (rd) { rd.addEventListener('change', function () { choix[Number(rd.name.slice(1))] = Number(rd.value); }); });
        fq.addEventListener('submit', function (ev) { ev.preventDefault(); if (choix.filter(function (x) { return x !== undefined; }).length < l.quiz.length) { o.afficher($('.message', fq), 'Répondez à toutes les questions.', 'erreur'); return; } terminer(choix, $('.message', fq)); });
      } else {
        $('[data-terminer]', v).addEventListener('click', function () { terminer([], $('.message', v)); });
      }
    }).catch(function (err) { v.innerHTML = vide('vide', err.message || 'Leçon indisponible.'); });
  }

  /* ---------------------------- Classe en ligne ---------------------- */
  function parametreHash(nom) {
    var m = (window.location.hash.split('?')[1] || '').split('&').map(function (x) { return x.split('='); }).filter(function (x) { return x[0] === nom; })[0];
    return m ? decodeURIComponent(m[1] || '') : '';
  }
  function exigerConnexion(suite) {
    if (identifiants()) { suite(); return; }
    formulaireConnexion(null, suite);
  }
  function pageClasse() {
    setTimeout(function () { exigerConnexion(chargerClasse); }, 0);
    return heros('Classe en ligne', 'Votre présence est enregistrée dès que vous rejoignez — même si la connexion coupe ensuite.') +
      '<section class="section" style="padding-top:clamp(30px,5vw,60px)"><div class="contenant" id="zone-apprenant"><div class="ecran-etat" style="min-height:200px"><div class="anneau"></div>Ouverture de la classe…</div></div></section>';
  }
  function chargerClasse() {
    var z = $('#zone-apprenant'); if (!z) return;
    var ref = parametreHash('s');
    appelApprenant('/rejoindre', { seance: ref }).then(function (r) {
      var v = r.visio || {}, leger = window.matchMedia('(max-width: 700px)').matches;
      var visio = '';
      if (r.ouverte && v.fournisseur === 'ardoise') {
        visio = '<div class="panneau" style="text-align:center"><div style="font-size:3rem" aria-hidden="true">🏫</div><h3>La classe est ouverte</h3><p class="chapeau" style="margin:8px auto 18px;max-width:540px">Choisissez votre avatar, prenez une place, levez la main pour parler. Ça marche dans votre navigateur, sans rien installer ; si votre connexion est lente, la classe vous propose le <strong>mode connexion faible</strong> (le son et le tableau d’abord).</p>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button class="bouton" data-entrer-classe>Entrer dans la classe</button>' + (v.secours && v.secours.url ? '<a class="bouton contour" target="_blank" rel="noopener" href="' + e(v.secours.url_leger || v.secours.url) + '">Visio de secours</a>' : '') + '</div></div>';
      }
      else if (r.ouverte && v.integrer && v.url) visio = '<iframe src="' + e(leger ? v.url_leger : v.url) + '" allow="camera; microphone; fullscreen; autoplay" allowfullscreen style="width:100%;aspect-ratio:16/10;border:0;border-radius:16px;background:#111"></iframe>';
      else if (r.ouverte && v.url) visio = '<div class="panneau" style="text-align:center"><h3>La classe est ouverte</h3><p class="chapeau" style="margin:8px auto 18px;max-width:520px">La visio s’ouvre dans l’application <strong>Jitsi Meet</strong> (gratuite, à installer une fois) ou dans votre navigateur.</p>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><a class="bouton" target="_blank" rel="noopener" href="' + e(leger ? v.url_leger : v.url) + '">Rejoindre la visio</a>' + (v.url_application ? '<a class="bouton contour" href="' + e(v.url_application) + '">Ouvrir dans l’application</a>' : '') + '<a class="bouton contour" target="_blank" rel="noopener" href="' + e(v.url_leger) + '">Mode connexion faible</a></div></div>';
      else if (!r.ouverte) visio = '<div class="panneau" style="text-align:center"><h3>La classe n’est pas encore ouverte</h3><p class="chapeau">' + e(r.message) + '</p></div>';
      z.innerHTML = '<div class="message visible ' + (r.presence || !r.ouverte ? (r.ouverte ? 'succes' : 'info') : 'info') + '" style="margin-bottom:16px">' + e(r.message) + '</div>' + visio +
        '<div class="grille g2" style="margin-top:18px"><div class="carte"><h3>Connexion difficile ?</h3><ul class="liste-coches" style="margin-top:10px"><li><span>Choisissez le <strong>mode connexion faible</strong> : le son passe en priorité, l’image est réduite.</span></li><li><span>Coupez votre caméra et gardez le micro fermé quand vous ne parlez pas.</span></li><li><span>Si ça coupe : pas de panique, votre présence est déjà comptée. Le cours sera disponible en <strong>replay</strong> dans « Cours enregistrés ».</span></li></ul></div>' +
        '<div class="carte"><h3>' + e(r.seance.groupe) + '</h3><p class="petit">' + e(dateCourte(r.seance.date_seance)) + (r.seance.heure_debut ? ' à ' + e(heure(r.seance.heure_debut)) : '') + (r.seance.theme ? ' · ' + e(r.seance.theme) : '') + '</p>' + (r.seance.devoirs ? '<p class="texte-libre" style="margin-top:8px"><strong>Devoirs :</strong> ' + e(r.seance.devoirs) + '</p>' : '') +
        '<a class="lien-fleche" href="#/apprenant" style="margin-top:10px;display:inline-block">Retour à mon espace</a></div></div>';
      var bec = $('[data-entrer-classe]', z);
      if (bec) {
        var entrer = function () {
          bec.disabled = true; bec.textContent = 'Ouverture…';
          Promise.all([appelApprenant('/classe', { seance: ref }), chargerClasseArdoise()]).then(function (res) {
            window.ClasseArdoise.ouvrir({ api: API, paquet: res[0], quitter: function () { bec.disabled = false; bec.textContent = 'Revenir dans la classe'; } });
          }).catch(function (err) { bec.disabled = false; bec.textContent = 'Entrer dans la classe'; window.alert(err.horsLigne ? 'Pas de connexion internet.' : err.message); });
        };
        bec.addEventListener('click', entrer);
      }
    }).catch(function (err) {
      if (err.status === 401) { memoriser(null); formulaireConnexion(err.message, chargerClasse); return; }
      z.innerHTML = vide('vide', err.horsLigne ? 'Pas de connexion internet. Dès qu’elle revient, rechargez cette page : le cours sera aussi disponible en replay.' : err.message);
    });
  }
  function chargerClasseArdoise() {
    if (window.ClasseArdoise) return Promise.resolve();
    return new Promise(function (ok, ko) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/classe-ardoise.css?v=3'; document.head.appendChild(l);
      var sc = document.createElement('script'); sc.src = '/classe-ardoise.js?v=3'; sc.onload = function () { ok(); };
      sc.onerror = function () { var er = new Error('Impossible de charger la classe.'); er.horsLigne = true; ko(er); };
      document.head.appendChild(sc);
    });
  }
  function pageReplay() {
    setTimeout(function () { exigerConnexion(chargerReplay); }, 0);
    return heros('Cours enregistré', 'Suivez le cours à votre rythme ; votre présence est comptée quand vous l’avez suivi.') +
      '<section class="section" style="padding-top:clamp(30px,5vw,60px)"><div class="contenant" id="zone-apprenant"><div class="ecran-etat" style="min-height:200px"><div class="anneau"></div>Chargement…</div></div></section>';
  }
  function chargerReplay() {
    var z = $('#zone-apprenant'); if (!z) return;
    var ref = parametreHash('s');
    appelApprenant('/replay', { seance: ref, action: 'ouvrir' }).then(function (r) {
      var depart = Date.now() - r.minutes_passees * 60000;
      z.innerHTML = '<h2 style="font-size:1.5rem;margin:0 0 4px">' + e(r.theme || 'Cours du ' + dateCourte(r.date_seance)) + '</h2><p class="petit" style="color:var(--texte-doux);margin:0 0 14px">' + e(r.groupe) + ' · ' + e(dateCourte(r.date_seance)) + '</p>' + lecteurVideo(r.url) +
        (r.devoirs ? '<div class="carte" style="margin-top:14px"><strong>Devoirs</strong><p class="texte-libre" style="margin:6px 0 0">' + e(r.devoirs) + '</p></div>' : '') +
        '<div class="panneau" style="margin-top:16px;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><strong data-chrono></strong><div class="petit" style="color:var(--texte-doux)">' + (r.compte_presence ? 'Votre présence est comptée après ' + r.minutes_min + ' minutes de suivi.' : 'Validez quand vous avez terminé.') + '</div></div>' +
        '<button class="bouton" data-valider' + (r.valide ? ' disabled' : '') + '>' + (r.valide ? 'Cours suivi ✓' : 'J’ai suivi le cours') + '</button></div><div class="message" role="status" style="margin-top:10px"></div>';
      var chrono = $('[data-chrono]', z), bouton = $('[data-valider]', z);
      function tic() {
        var min = Math.floor((Date.now() - depart) / 60000);
        if (!chrono || !document.body.contains(chrono)) return;
        chrono.textContent = r.valide ? 'Cours validé' : (min >= r.minutes_min ? 'Temps de suivi atteint (' + min + ' min)' : 'Temps de suivi : ' + min + ' / ' + r.minutes_min + ' min');
        setTimeout(tic, 15000);
      }
      tic();
      bouton.addEventListener('click', function () {
        appelApprenant('/replay', { seance: ref, action: 'valider' }).then(function (v) { bouton.disabled = true; bouton.textContent = 'Cours suivi ✓'; r.valide = true; tic(); o.afficher($('.message', z), v.message, 'succes'); etat.apprenant = null; })
          .catch(function (err) { o.afficher($('.message', z), err.horsLigne ? 'Pas de connexion : réessayez dans un instant.' : err.message, 'info'); });
      });
    }).catch(function (err) { z.innerHTML = vide('vide', err.message); });
  }
  function pagePointer() {
    setTimeout(function () { exigerConnexion(pointerMaintenant); }, 0);
    return heros('Présence', 'Pointage de votre présence au cours.') + '<section class="section"><div class="contenant" id="zone-apprenant" style="max-width:640px"><div class="ecran-etat" style="min-height:200px"><div class="anneau"></div>Enregistrement de votre présence…</div></div></section>';
  }
  function pointerMaintenant() {
    var z = $('#zone-apprenant'); if (!z) return;
    appelApprenant('/pointer', { seance: parametreHash('s'), code: parametreHash('c') }).then(function (r) {
      z.innerHTML = '<div class="panneau" style="text-align:center"><div style="font-size:3rem">✅</div><h2>' + e(r.message) + '</h2><a class="bouton" href="#/apprenant" style="margin-top:14px">Mon espace</a></div>';
    }).catch(function (err) {
      if (err.status === 401) { memoriser(null); formulaireConnexion(err.message, pointerMaintenant); return; }
      z.innerHTML = '<div class="panneau" style="text-align:center"><div style="font-size:3rem">⚠️</div><h2>Présence non enregistrée</h2><p class="chapeau">' + e(err.horsLigne ? 'Pas de connexion internet. Réessayez, ou signalez-vous à votre coach.' : err.message) + '</p><button class="bouton" data-retry style="margin-top:14px">Réessayer</button></div>';
      $('[data-retry]', z).addEventListener('click', pointerMaintenant);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Formulaires de demande                                             */
  /* ------------------------------------------------------------------ */
  function brancherDemandes() {
    $$('form[data-centre]').forEach(function (f) {
      var type = f.getAttribute('data-centre');
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var zone = $('.message', f), corps = { type: type };
        $$('input[name], select[name], textarea[name]', f).forEach(function (ch) { corps[ch.name] = ch.value.trim(); });
        var err = type === 'preinscription' && !corps.programme_souhaite ? 'Choisissez une formation.' : !corps.nom ? 'Indiquez votre nom.' : !corps.telephone && !corps.email ? 'Indiquez un téléphone ou un e-mail.' : type === 'contact' && !corps.message ? 'Écrivez votre message.' : null;
        if (err) { o.afficher(zone, err, 'erreur'); return; }
        if (APERCU) { o.afficher(zone, 'Aperçu : le formulaire fonctionnera une fois le site publié.', 'info'); return; }
        if (type === 'preinscription' && etat.test) corps.message = 'Test de niveau en ligne : ' + etat.test.niveau + ' (' + etat.test.score + ' %)';
        var b = $('button[type=submit]', f); b.disabled = true;
        fetch(API + '/public/ecole/' + encodeURIComponent(CODE) + '/demandes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) { b.disabled = false; if (!res.ok) { o.afficher(zone, res.j.message || 'Envoi impossible.', 'erreur'); return; } f.reset(); o.afficher(zone, res.j.message || 'Envoyé. Merci !', 'succes'); })
          .catch(function () { b.disabled = false; o.afficher(zone, 'Connexion impossible. Vérifiez votre réseau.', 'erreur'); });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Navigation                                                         */
  /* ------------------------------------------------------------------ */
  var PAGES = { accueil: pageAccueil, formations: pageFormations, 'test-niveau': pageTest, inscription: pageInscription, apprenant: pageApprenant, certificat: pageCertificat, contact: pageContact,
    classe: pageClasse, replay: pageReplay, pointer: pagePointer };
  var TITRES = { classe: 'Classe en ligne', replay: 'Cours enregistré', pointer: 'Présence', formations: 'Formations', 'test-niveau': 'Test de niveau', inscription: 'S’inscrire', apprenant: 'Espace apprenant', certificat: 'Vérifier un certificat', contact: 'Contact' };
  function naviguer() {
    var cle = (window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'accueil');
    if (!PAGES[cle]) cle = 'accueil';
    var changement = cle !== etat.page;
    etat.page = cle;
    $('#contenu').innerHTML = PAGES[cle]();
    document.title = (cle === 'accueil' ? '' : TITRES[cle] + ' — ') + ec.nom;
    $$('[data-page]').forEach(function (a) { a.classList.toggle('actif', a.getAttribute('data-page') === cle); });
    document.body.classList.remove('menu-ouvert');
    brancherDemandes();
    brancherVerification();
    o.animer();
    if (changement) window.scrollTo(0, 0);
  }

  coquille();
  $('#chargement').style.display = 'none';
  $('#site').style.display = '';
  if (!window.__ardoiseCentreNavigue) {
    window.__ardoiseCentreNavigue = true;
    window.addEventListener('hashchange', function () { if (window.__ardoiseCentreNaviguer) window.__ardoiseCentreNaviguer(); });
  }
  window.__ardoiseCentreNaviguer = naviguer;
  naviguer();
};
