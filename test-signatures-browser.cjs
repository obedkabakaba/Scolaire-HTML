/* Signatures des apparences — vérification dans un vrai Chromium.
   Vrais scripts partagés (theme, ui, mobile, session, signatures), API simulées.
   Couvre : la déconnexion atteignable dans les 12 apparences (grand écran et
   écran bas), le garde-fou de secours, le rail Super Admin sur un écran bas,
   les widgets et scènes, l'animation de première connexion (une seule fois),
   l'annonce au changement d'apparence et l'absence de débordement mobile.
   SIGNATURES_BROWSER choisit un Chromium installé ; SIGNATURES_SHOT un dossier
   où déposer des captures. */
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const { chromium } = require('playwright');
const root = __dirname;
const THEMES = ['ardoise', 'studio', 'pure', 'nuit', 'yohali', 'elan', 'perspective', 'recre', 'nexus', 'orbite', 'fluide', 'vibra', 'pro', 'savane'];
const user = { id: 42, ecole_id: 1, nom: 'Exemple', prenom: 'Awa', roles: ['directeur'], email: 'test@example.invalid' };
const data = { effectifs: { nb_eleves: 428, nb_professeurs: 32, nb_classes: 18 }, taux_reussite_global: 86,
  impayes: { nb_eleves_en_retard: 7 }, annee_active: { libelle: '2026–2027' }, notes: { encodees: 340, attendues: 400, restantes: 60 },
  periode_courante: { libelle: 'Première période' }, etat_periodes_par_classe: [],
  evenements_a_venir: [{ titre: 'Réunion pédagogique', date_debut: '2026-09-12', type: 'reunion' }] };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const f = path.join(root, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
  if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
  let body = fs.readFileSync(f);
  if (u.searchParams.has('shell') && f.endsWith('.html')) {
    body = body.toString().replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, (m) => /ardoise_theme/.test(m) ? m : '')
      .replace(/<script[^>]+src="([^"]+)"[^>]*><\/script>/gi, (tag, src) => /^(theme|ui|mobile|session|acces-presences|evenements-types|didacticiel)\.js$/.test(src) || /^super-admin/.test(src) ? tag : '');
  }
  const ext = path.extname(f);
  res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' })[ext] || 'application/octet-stream');
  res.end(body);
});

async function contexte(browser, base, theme, extra) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([u, t, e]) => {
    if (sessionStorage.getItem('__init')) return;
    sessionStorage.setItem('__init', '1');
    localStorage.setItem('ardoise_user', JSON.stringify(u)); localStorage.setItem('ardoise_token', 'test');
    localStorage.setItem('ardoise_access_token', 'test'); localStorage.setItem('ardoise_theme', t);
    localStorage.setItem('ardoise_nav_position', 'gauche'); localStorage.setItem('ardoise_nav_compact', 'non');
    if (e && e.premiere) sessionStorage.setItem('ardoise_premiere_connexion', String(u.id));
    if (e && e.superAdmin) { u.roles = ['super_admin']; localStorage.setItem('ardoise_user', JSON.stringify(u)); }
  }, [user, theme, extra || {}]);
  await ctx.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === base) return route.continue();
    if (/google|gstatic/.test(url.hostname)) return route.abort();
    let v = {};
    if (url.pathname.endsWith('/dashboard/directeur')) v = data;
    else if (url.pathname.includes('/notifications')) v = [];
    else if (url.pathname.includes('/presences/resume-jour')) v = { nb_classes: 18, nb_classes_appelees: 18, total_absents: 3, total_retards: 0, classes: [] };
    else if (url.pathname.endsWith('/classes')) v = [{ id: 1, nom: '6e A', nb_eleves: 20 }];
    else if (url.pathname.endsWith('/utilisateurs/moi')) v = user;
    else if (url.pathname.endsWith('/ecoles/moi')) v = { id: 1, nom: 'École de démonstration', abonnement_statut: 'actif' };
    else if (url.pathname.includes('/messages')) v = { messages: [], non_lus: 0 };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
  });
  return ctx;
}

/* Le vrai bouton est atteignable : visible, dans l'écran (au besoin en faisant
   défiler son conteneur) et c'est bien lui qui reçoit le clic à cet endroit. */
async function sortieAtteignable(page) {
  return page.evaluate(() => {
    const b = document.getElementById('bouton-deconnexion-nav');
    if (!b) return { ok: false, raison: 'absent' };
    b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = b.getBoundingClientRect(), s = getComputedStyle(b);
    if (r.width < 8 || r.height < 8 || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.3) return { ok: false, raison: 'invisible', r: [r.x, r.y, r.width, r.height] };
    if (r.bottom > innerHeight + 1 || r.top < -1 || r.right > innerWidth + 1 || r.left < -1) return { ok: false, raison: 'hors écran', r: [r.x, r.y, r.width, r.height] };
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { ok: !!t && (t === b || b.contains(t)), raison: t ? 'recouvert par ' + t.className : 'rien', libelle: (b.innerText || getComputedStyle(b, '::after').content || '').trim() };
  });
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch(process.env.SIGNATURES_BROWSER ? { executablePath: process.env.SIGNATURES_BROWSER, headless: true } : { headless: true });
  const shot = process.env.SIGNATURES_SHOT;
  const echecs = [];

  /* 1. Les douze apparences : déconnexion, widget, scène, mobile. */
  for (const theme of THEMES) {
    const ctx = await contexte(browser, base, theme);
    const page = await ctx.newPage(); const erreurs = [];
    page.on('pageerror', (e) => { if (!/notifs\.filter/.test(e.message)) erreurs.push(e.message); });
    await page.goto(base + '/dashboard-directeur.html');
    await page.waitForSelector('.sg-widget', { timeout: 6000 });
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.sg-widget').count(), 1, theme + ' : un seul widget');
    if (theme !== 'fluide') assert.equal(await page.locator('.sg-scene').count(), 1, theme + ' : une scène');
    else assert.equal(await page.locator('.fl-fond').count(), 1, 'fluide : fond du lagon');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.sg), theme);
    for (const [w, h] of [[1440, 900], [1280, 640], [1024, 600]]) {
      await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(250);
      const etat = await sortieAtteignable(page);
      if (!etat.ok) echecs.push({ theme, w, h, ...etat });
      await page.evaluate(() => window.ArdoiseSignatures.verifierSortie());
      assert.equal(await page.locator('#sg-sortie-secours').count(), 0, theme + ' : pas de secours quand le vrai bouton est là (' + w + 'x' + h + ')');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    if (shot) await page.screenshot({ path: path.join(shot, 'signature-' + theme + '.png') });
    // Mobile : aucun débordement, le tiroir contient toujours la déconnexion.
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
    await page.waitForFunction(() => document.documentElement.scrollWidth - innerWidth <= 2, null, { timeout: 1500 }).catch(() => {});
    const debord = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (debord > 2) echecs.push({ theme, mobile: true, debord });
    const bouton = page.locator('.ard-mob-barre .ard-mob-bouton');
    if (await bouton.count()) {
      // La feuille de menu monte du bas en 0,5 s : on mesure une fois posée.
      await bouton.click(); await page.waitForTimeout(650);
      const tiroir = await sortieAtteignable(page);
      if (!tiroir.ok) echecs.push({ theme, tiroir: true, ...tiroir });
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(erreurs, [], theme + ' : erreurs de page');
    await ctx.close();
  }
  console.log('Déconnexion, widgets et scènes :', THEMES.length, 'apparences x 3 tailles + mobile');

  /* 2. Garde-fou : si une apparence masque le bouton, la commande de secours
        apparaît et déclenche le VRAI bouton (même gestionnaire de session). */
  {
    const ctx = await contexte(browser, base, 'ardoise');
    const page = await ctx.newPage();
    await page.goto(base + '/dashboard-directeur.html'); await page.waitForSelector('.sg-widget');
    // La visibilité suit une transition : on laisse passer une frame avant de mesurer.
    const masquer = async (oui) => {
      await page.evaluate((o) => {
        const b = document.getElementById('bouton-deconnexion-nav');
        if (o) b.style.setProperty('visibility', 'hidden', 'important'); else b.style.removeProperty('visibility');
      }, oui);
      await page.waitForTimeout(120);
      await page.evaluate(() => window.ArdoiseSignatures.verifierSortie());
    };
    await masquer(true);
    assert.equal(await page.locator('#sg-sortie-secours').isVisible(), true, 'le secours apparaît quand le bouton est masqué');
    await masquer(false);
    assert.equal(await page.locator('#sg-sortie-secours').count(), 0, 'le secours disparaît quand le vrai bouton revient');
    // Changement d'apparence : annonce de la devise, rideau sans bloquer les clics.
    await page.waitForTimeout(1300);
    await page.evaluate(() => window.ArdoiseTheme.appliquer('nuit', { synchroniserServeur: false }));
    await page.waitForSelector('.sg-annonce');
    assert.match(await page.locator('.sg-annonce').innerText(), /Nuit — La Veillée/);
    await page.waitForSelector('.sg-w-nuit');
    assert.equal(await page.locator('.sg-w-ardoise').count(), 0, 'le widget précédent est retiré');
    // En dernier : le clic du secours lance la vraie déconnexion de la page.
    await page.evaluate(() => { window.__clics = 0; document.getElementById('bouton-deconnexion-nav').addEventListener('click', (e) => { e.stopImmediatePropagation(); window.__clics++; }, true); });
    await masquer(true);
    await page.locator('#sg-sortie-secours').click();
    assert.equal(await page.evaluate(() => window.__clics), 1, 'le secours clique le vrai bouton');
    await ctx.close();
  }
  console.log('Garde-fou de déconnexion et annonce : OK');

  /* 3. Première connexion : l'accueil se joue une fois, se passe au clavier. */
  {
    const ctx = await contexte(browser, base, 'fluide', { premiere: true });
    const page = await ctx.newPage();
    await page.goto(base + '/dashboard-directeur.html');
    await page.waitForSelector('.sg-accueil');
    await page.waitForFunction(() => /Awa/.test(document.querySelector('.sg-accueil-titre').textContent), null, { timeout: 3000 });
    if (shot) { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(shot, 'signature-accueil.png') }); }
    await page.keyboard.press('Escape');
    await page.waitForSelector('.sg-accueil', { state: 'detached', timeout: 3000 });
    assert.equal(await page.evaluate(() => sessionStorage.getItem('ardoise_premiere_connexion')), null, 'drapeau consommé');
    await page.evaluate(() => sessionStorage.setItem('ardoise_premiere_connexion', '42'));
    await page.reload(); await page.waitForSelector('.sg-widget'); await page.waitForTimeout(400);
    assert.equal(await page.locator('.sg-accueil').count(), 0, 'jamais deux fois pour la même personne');
    await ctx.close();
  }
  console.log('Accueil de première connexion : OK');

  /* 4. Animations désactivées dans Mon profil : choix gardé sur l'appareil,
        appliqué avant le premier affichage, rien ne bouge, et réactivable. */
  {
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    await ctx2.addInitScript((u) => {
      if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
      localStorage.setItem('ardoise_user', JSON.stringify(u)); localStorage.setItem('ardoise_access_token', 'test'); localStorage.setItem('ardoise_theme', 'nuit');
    }, user);
    await ctx2.route('**/*', (route) => { const url = new URL(route.request().url()); if (url.origin === base) return route.continue(); if (/google|gstatic/.test(url.hostname)) return route.abort(); return route.fulfill({ status: 200, contentType: 'application/json', body: url.pathname.endsWith('/dashboard/directeur') ? JSON.stringify(data) : url.pathname.includes('/notifications') ? '[]' : url.pathname.endsWith('/utilisateurs/moi') ? JSON.stringify(user) : '{}' }); });
    const page = await ctx2.newPage();
    await page.goto(base + '/mon-profil.html');
    await page.waitForFunction(() => document.getElementById('case-animations') && document.getElementById('case-animations').dataset.pret);
    assert.equal(await page.locator('#case-animations').isChecked(), true, 'activées par défaut');
    await page.locator('#case-animations').uncheck();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.animations), 'non');
    assert.match(await page.locator('#confirmation-animations').innerText(), /désactivées/);
    // Rechargement : l'attribut est posé par l'amorçage, avant theme.js.
    await page.addInitScript(() => { document.addEventListener('readystatechange', () => { if (document.readyState === 'interactive') window.__avantTheme = document.documentElement.getAttribute('data-animations'); }); });
    await page.goto(base + '/dashboard-directeur.html'); await page.waitForSelector('.sg-w-nuit');
    assert.equal(await page.evaluate(() => window.__avantTheme), 'non', 'appliqué dès le premier affichage');
    const etoile = await page.locator('.sg-etoile').first().evaluate((n) => getComputedStyle(n).animationName);
    assert.equal(etoile, 'none', 'le ciel ne scintille plus');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.contenu')).animationDuration), '1e-05s');
    await page.waitForTimeout(1300);
    await page.evaluate(() => window.ArdoiseTheme.appliquer('vibra', { synchroniserServeur: false }));
    await page.waitForSelector('.sg-annonce');
    assert.equal(await page.locator('.sg-rideau').count(), 0, 'pas de rideau quand les animations sont coupées');
    // Accueil de première connexion : tout est lisible d'emblée.
    await page.evaluate(() => { sessionStorage.setItem('ardoise_premiere_connexion', '42'); localStorage.removeItem('ardoise_sg_accueil_vu_42'); });
    await page.reload(); await page.waitForSelector('.sg-accueil');
    const lettre = await page.locator('.sg-accueil .sg-lettre').first().evaluate((n) => getComputedStyle(n).transform);
    assert.equal(lettre, 'none', 'le nom est déjà écrit');
    assert.equal(await page.locator('.sg-accueil-go').isVisible(), true);
    await page.keyboard.press('Escape'); await page.waitForSelector('.sg-accueil', { state: 'detached' });
    // Réactivation depuis le profil.
    await page.goto(base + '/mon-profil.html');
    await page.waitForFunction(() => document.getElementById('case-animations').dataset.pret);
    assert.equal(await page.locator('#case-animations').isChecked(), false, 'le choix est retenu');
    await page.locator('#case-animations').check();
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-animations')), false);
    await ctx2.close();
  }
  console.log('Choix des animations : OK');

  /* 5. Super Admin sur un écran bas : Apparence, compte et sortie restent
        visibles ; les domaines défilent. */
  for (const theme of ['ardoise', 'fluide', 'nuit']) {
    const ctx = await contexte(browser, base, theme, { superAdmin: true });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1280, height: 520 });
    await page.goto(base + '/super-admin.html?shell');
    await page.evaluate(() => { const a = document.querySelector('.sa-application'); if (a) a.style.display = 'flex'; const c = document.getElementById('ecran-connexion'); if (c) c.style.display = 'none'; });
    await page.waitForSelector('#sa-rail-domaines .sa-rail-domaine');
    for (const sel of ['.sa-rail-pied a[data-route="apparence"]', '#sa-rail-profil', '.sa-rail-sortie']) {
      const r = await page.locator(sel).boundingBox();
      assert.ok(r && r.y >= 0 && r.y + r.height <= 520, theme + ' : ' + sel + ' visible sur un écran bas ' + JSON.stringify(r));
    }
    const defile = await page.evaluate(() => { const z = document.getElementById('sa-rail-domaines'); return { haut: z.scrollHeight, vue: z.clientHeight, oy: getComputedStyle(z).overflowY }; });
    assert.equal(defile.oy, 'auto'); assert.ok(defile.haut > defile.vue, 'les domaines débordent et défilent');
    await page.locator('#sa-rail-domaines').evaluate((z) => { z.scrollTop = z.scrollHeight; });
    const dernier = await page.locator('#sa-rail-domaines .sa-rail-domaine').last().boundingBox();
    assert.ok(dernier.y + dernier.height <= 520, 'le dernier domaine devient atteignable');
    await page.locator('#sa-rail-profil').click();
    assert.equal(await page.locator('#bouton-deconnexion').isVisible(), true, theme + ' : déconnexion dans le menu du compte');
    await page.keyboard.press('Escape');
    // Infobulle flottante : position fixe, hors du rail défilant.
    await page.locator('.sa-rail-sortie').hover();
    await page.waitForSelector('.sa-infobulle-flottante:not([hidden])');
    assert.equal(await page.locator('.sa-infobulle-flottante').innerText(), 'Se déconnecter');
    if (shot && theme === 'fluide') await page.screenshot({ path: path.join(shot, 'signature-super-admin.png') });
    await ctx.close();
  }
  console.log('Rail Super Admin défilant : OK');

  await browser.close(); server.close();
  if (echecs.length) { console.error('Échecs :', JSON.stringify(echecs, null, 1)); process.exit(1); }
  console.log('Signatures des apparences : tout est conforme.');
})().catch((e) => { console.error(e); process.exit(1); });
