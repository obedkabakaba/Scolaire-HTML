/* Studio de bulletins + scène de génération — vérification dans un vrai Chromium.
 * API entièrement simulée : aucune donnée réelle, aucun serveur Ardoise.
 *   node test-studio-browser.cjs            (STUDIO_SHOTS=dossier pour garder les captures)
 */
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const { chromium } = require('playwright');
const root = __dirname;
const dossierCaptures = process.env.STUDIO_SHOTS || null;

const user = { id: 42, ecole_id: 1, nom: 'Exemple', prenom: 'Direction', roles: ['directeur'], email: 'test@example.invalid' };
const MAQUETTE = `<!doctype html><html><body style="margin:0;width:794px;height:1123px;font-family:Times;background:#fff">
<div style="padding:30px 40px"><h2 style="text-align:center;margin:0">RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</h2>
<p style="text-align:center;margin:4px 0 24px">BULLETIN DE L'ÉLÈVE</p>
<p>NOM DE L'ÉLÈVE : ..............................................</p><p>CLASSE : ..................... ANNÉE : ..............</p>
<table style="width:100%;border-collapse:collapse;margin-top:24px" border="1">
<tr><th style="width:34%">BRANCHES</th><th>P1</th><th>P2</th><th>EX</th><th>TOT</th><th>P3</th><th>P4</th><th>EX</th><th>TOT</th><th>T.G.</th></tr>
${Array.from({ length: 12 }, () => '<tr style="height:28px">' + '<td></td>'.repeat(10) + '</tr>').join('')}
</table><p style="margin-top:30px">POURCENTAGE : ........ PLACE : ........</p></div></body></html>`;

let zones = [], suivant = 1;
const patchsModele = [], apercusDemandes = [];
const RECONSTRUCTION = { version: 1, rempli: true, orientation: 'portrait', police: 'serif', images: [], remarques: 'Données manuscrites ignorées.',
  blocs: [
    { type: 'champs', colonnes: 2, champs: [{ libelle: 'ÉLÈVE', cle: 'nom_complet' }, { libelle: 'CLASSE', cle: 'classe' }] },
    { type: 'tableau', branches: 'dynamique', ordre: 'maximum', maxima: 'par_groupe',
      colonnes: [{ entete: 'BRANCHES', groupe: null, sous_groupe: null, source: 'cours', largeur: 40 }, { entete: 'T.G.', groupe: null, sous_groupe: null, source: 'tg', largeur: 20 }],
      synthese: [{ libelle: 'TOTAUX', famille: 'total' }] }
  ] };
const patchs = [];

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const f = path.join(root, decodeURIComponent(u.pathname));
  if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
  const ext = path.extname(f);
  res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' })[ext] || 'application/octet-stream');
  res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch(process.env.STUDIO_BROWSER ? { executablePath: process.env.STUDIO_BROWSER } : {});

  // Une « photo » de bulletin vierge, et un vrai PDF pour la visionneuse.
  const outil = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await outil.setContent(MAQUETTE);
  const imageBulletin = await outil.screenshot();
  const pdf = await outil.pdf({ format: 'A4' });
  await outil.close();

  const modele = { id: 'm1', nom: 'Bulletin de l’école', type: 'annuel', actif: false, est_global: false, est_officiel: false,
    fichier_source_url: 'https://stockage.test/fond.png', layout: null };

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
  await ctx.addInitScript((u) => {
    localStorage.setItem('ardoise_user', JSON.stringify(u));
    localStorage.setItem('ardoise_access_token', 'test'); localStorage.setItem('ardoise_token', 'test');
    // Chromium sans interface n'embarque pas de lecteur PDF : on simule celui
    // d'un navigateur de bureau. La variante mobile est vérifiée plus bas.
    if (!window.__mobile) Object.defineProperty(Navigator.prototype, 'pdfViewerEnabled', { get: () => true });
  }, user);
  await ctx.route('**/*', async (route) => {
    const r = route.request(); const url = new URL(r.url());
    if (url.origin === base) return route.continue();
    if (url.hostname === 'stockage.test') return route.fulfill({ status: 200, contentType: 'image/png', body: imageBulletin });
    if (/google|gstatic|cdnjs/.test(url.hostname)) return route.abort();
    const p = url.pathname, m = r.method();
    const json = (v, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(v) });
    if (p === '/modeles-bulletins' && m === 'GET') return json([modele]);
    if (p === '/modeles-bulletins/m1/zones' && m === 'GET') return json(zones);
    if (p === '/modeles-bulletins/m1/zones' && m === 'POST') {
      const z = { id: 'z' + suivant++, ...JSON.parse(r.postData()) }; zones.push(z); return json({ id: z.id }, 201);
    }
    if (p.startsWith('/modeles-bulletins/zones/') && m === 'PATCH') {
      const id = p.split('/').pop(); const corps = JSON.parse(r.postData()); patchs.push(corps);
      Object.assign(zones.find((z) => z.id === id), corps); return json({ message: 'ok' });
    }
    if (p.startsWith('/modeles-bulletins/zones/') && m === 'DELETE') {
      zones = zones.filter((z) => z.id !== p.split('/').pop()); return json({ message: 'ok' });
    }
    if (p === '/modeles-bulletins/m1/suggerer-zones') {
      await new Promise((ok) => setTimeout(ok, 600));
      zones.push({ id: 'z' + suivant++, cle: 'nom_complet', x: 27, y: 9.6, largeur: 40, hauteur: 2.2, taille: 11 });
      zones.push({ id: 'z' + suivant++, cle: 'tableau_cotes', x: 5, y: 22.4, largeur: 90, hauteur: 30, taille: 8,
        config: { type: 'tableau', lignes: 12, ordre: 'alphabetique', colonnes: [
          { source: 'cours', largeur: 34 }, ...['p1', 'p2', 'ex', 'tot1', 'p3', 'p4', 'ex2', 'tot2', 'tg'].map((s) => ({ source: s, largeur: 7.33 }))] } });
      return json({ nb: 2, message: '2 zone(s) proposée(s).' });
    }
    if (p === '/modeles-bulletins/m1/apercu' && url.searchParams.get('format') !== 'html') {
      await new Promise((ok) => setTimeout(ok, 2500));
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: pdf });
    }
    if (p === '/modeles-bulletins/m1/activer') { modele.actif = true; return json({ message: 'ok' }); }
    if (p === '/modeles-bulletins/m1/reconstruire') {
      await new Promise((ok) => setTimeout(ok, 700));
      return json({ message: 'Bulletin reconstruit.', reconstruction: RECONSTRUCTION });
    }
    if (p === '/modeles-bulletins/m1' && m === 'PATCH') { patchsModele.push(JSON.parse(r.postData())); return json({ message: 'ok' }); }
    if (p === '/modeles-bulletins/m1/apercu' && url.searchParams.get('format') === 'html') {
      const n = Number(url.searchParams.get('nb')) || 8; apercusDemandes.push(n);
      const lignes = Array.from({ length: n }, (_, i) => `<tr><td class="branche">Branche ${i + 1}</td><td>12</td></tr>`).join('');
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html><head><style>table{border-collapse:collapse}td{border:1px solid #000}</style></head><body><div class="page"><h3>BULLETIN</h3><table>${lignes}</table></div></body></html>` });
    }
    return json({});
  });

  const page = await ctx.newPage(); const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.stack));
  await page.goto(base + '/generateur-modeles.html');
  await page.locator('.carte-modele').first().click();
  await page.waitForSelector('.st-canvas img');
  await page.waitForFunction(() => document.querySelector('.st-canvas img').complete);

  // 1. L'IA propose les zones, le tableau des cotes compris.
  await page.locator('[data-action="ia"]').click();
  await page.waitForSelector('.st-zone.st-tableau');
  assert.equal(await page.locator('.st-zone').count(), 2);
  assert.equal(await page.locator('.st-tableau .st-ligne-fictive').count(), 12, 'aperçu : une ligne fictive par ligne du modèle');

  // 2. Sélection du tableau, puis glisser d'un séparateur de colonnes.
  await page.locator('.st-zone.st-tableau').click({ position: { x: 300, y: 120 } });
  await page.waitForSelector('.st-colonnes li');
  assert.equal(await page.locator('.st-colonnes li').count(), 10);
  const sep = page.locator('.st-tableau .st-separateur').first();
  const b = await sep.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + 40); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 30, b.y + 40, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(500);
  const dernier = patchs.filter((x) => x.config).pop();
  assert.ok(dernier && dernier.config.colonnes[0].largeur < 34, 'la 1re colonne a rétréci');
  assert.ok(Math.abs(dernier.config.colonnes.reduce((t, c) => t + c.largeur, 0) - 100) < 0.5, 'la somme des largeurs est conservée');

  // 3. Déplacement d'un champ au clavier.
  await page.locator('.st-liste li, [data-onglet="zones"]').first().click();
  await page.locator('[data-onglet="zones"]').click();
  await page.locator('.st-liste li').first().click();
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(800);
  assert.ok(patchs.some((x) => x.x !== undefined), 'la position est enregistrée');
  if (dossierCaptures) await page.screenshot({ path: path.join(dossierCaptures, 'studio.png') });

  // 4. Aperçu PDF : la scène s'ouvre aussitôt, puis la visionneuse intégrée — aucune fenêtre surgissante.
  let popups = 0; ctx.on('page', () => popups++);
  await page.locator('[data-action="pdf"]').click();
  await page.waitForSelector('.gs-voile .gs-feuille');
  await page.waitForTimeout(1200);
  if (dossierCaptures) await page.screenshot({ path: path.join(dossierCaptures, 'generation.png') });
  await page.waitForSelector('.gs-cadre', { timeout: 10000 });
  await page.waitForTimeout(800);
  if (dossierCaptures) await page.screenshot({ path: path.join(dossierCaptures, 'visionneuse.png') });
  assert.equal(popups, 0, 'aucune fenêtre surgissante');
  assert.match(await page.locator('.gs-cadre').getAttribute('src'), /^blob:/);
  await page.locator('.gs-fermer').click();

  // 5. Réduction en arrière-plan, puis pastille « prête ».
  await page.locator('[data-action="pdf"]').click();
  await page.locator('.gs-reduire').click();
  await page.waitForSelector('.gs-pastille.prete', { timeout: 10000 });
  await page.locator('.gs-pastille').click();
  await page.waitForSelector('.gs-cadre');

  await page.locator('.gs-fermer').click();

  // 7. Plan d'évaluation : reporter une branche de l'examen S1 vers l'examen S2.
  const planPage = await ctx.newPage();
  planPage.on('pageerror', (e) => erreurs.push(e.stack));
  const epreuves = [
    { id: 'p1', libelle: '1re période', type: 'periode', numero: 1, regroupement: 'Semestre 1', cloturee: false },
    { id: 'p2', libelle: '2e période', type: 'periode', numero: 2, regroupement: 'Semestre 1', cloturee: false },
    { id: 'e1', libelle: 'Examen S1', type: 'examen', numero: 3, regroupement: 'Semestre 1', cloturee: false },
    { id: 'p3', libelle: '3e période', type: 'periode', numero: 1, regroupement: 'Semestre 2', cloturee: false },
    { id: 'e2', libelle: 'Examen S2', type: 'examen', numero: 3, regroupement: 'Semestre 2', cloturee: false }
  ];
  const coursPlan = [{ id: 'c1', nom: 'Mathématiques', maximum: 20, maximum_examen: null }, { id: 'c2', nom: 'Français', maximum: 10, maximum_examen: null }];
  let envoiPlan = null;
  await planPage.route('https://scolaire-saas-backend.onrender.com/plan-evaluation**', (route) => {
    if (route.request().method() === 'PUT') { envoiPlan = JSON.parse(route.request().postData()); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Plan enregistré.', ecrites: 2, retirees: 0, recalculs: 1 }) }); }
    const cases = [];
    coursPlan.forEach((c) => epreuves.forEach((e) => { const d = e.type === 'examen' ? c.maximum * 2 : c.maximum; cases.push({ cours_id: c.id, periode_id: e.id, defaut: d, maximum: d, portee: 'defaut', motif: null }); }));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ disponible: true, classe: null, epreuves, cours: coursPlan, cases, nb_exceptions: 0 }) });
  });
  await planPage.route('https://scolaire-saas-backend.onrender.com/annees-scolaires**', (route) => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(route.request().url().includes('proposition') ? {} : [{ id: 'a1', libelle: '2026-2027', active: true, cloturee: false }]) }));
  await planPage.route('https://scolaire-saas-backend.onrender.com/periodes**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await planPage.goto(base + '/annee-scolaire.html');
  await planPage.locator('.onglet[data-onglet="plan"]').click();
  await planPage.waitForSelector('.plan-table');
  assert.equal(await planPage.locator('.plan-table tbody tr').count(), 2);
  await planPage.locator('#plan-report-cours input[value="c1"]').check();
  await planPage.locator('#plan-report-appliquer').click();
  assert.equal(await planPage.locator('input[data-k="c1|e1"]').inputValue(), 'NE');
  assert.equal(await planPage.locator('input[data-k="c1|e2"]').inputValue(), '80');
  if (dossierCaptures) await planPage.screenshot({ path: path.join(dossierCaptures, 'plan.png'), fullPage: true });
  await planPage.locator('#plan-enregistrer').click();
  await planPage.waitForTimeout(400);
  assert.deepEqual(envoiPlan.cases.map((c) => [c.periode_id, c.maximum]).sort(), [['e1', 0], ['e2', 80]]);
  await planPage.close();

  // 6 bis. Photo déjà remplie : reconstruction du bulletin, aperçu adapté au nombre de branches.
  await page.locator('[data-onglet="ajouter"]').click();
  await page.locator('[data-action="reconstruire"]').click();
  await page.locator('.voile-confirmation .valider').click();
  await page.waitForSelector('.sr-analyse');
  if (dossierCaptures) await page.screenshot({ path: path.join(dossierCaptures, 'reconstruction-analyse.png') });
  await page.waitForSelector('.sr-apercu iframe');
  await page.waitForFunction(() => { const f = document.querySelector('.sr-apercu iframe'); return f && f.contentDocument && f.contentDocument.querySelectorAll('td.branche').length === 13; });
  await page.locator('[data-a="nb"]').selectOption('8');
  await page.waitForFunction(() => document.querySelector('.sr-apercu iframe').contentDocument.querySelectorAll('td.branche').length === 8);
  assert.deepEqual(apercusDemandes.slice(-2), [13, 8], 'l’aperçu suit le nombre de branches choisi');
  await page.locator('[data-ouvrir="0"]').click();
  await page.locator('input[data-c="blocs.0.champs.0.libelle"]').fill('NOM DE L’ÉLÈVE');
  await page.waitForTimeout(900);
  const dernierPatch = patchsModele.filter((x) => x.reconstruction).pop();
  assert.equal(dernierPatch.reconstruction.blocs[0].champs[0].libelle, 'NOM DE L’ÉLÈVE');
  if (dossierCaptures) await page.screenshot({ path: path.join(dossierCaptures, 'reconstruction-studio.png') });

  // 6. Sur téléphone : pas de cadre PDF, deux grands boutons, toujours sans fenêtre surgissante.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Mobile Safari/537.36' });
  const tel = await mobile.newPage();
  await tel.goto(base + '/generation-scene.css'); // origine de test, sans la page complète
  await tel.setContent('<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family:sans-serif;background:#eee"><link rel="stylesheet" href="' + base + '/generation-scene.css"><script src="' + base + '/generation-scene.js"></script>');
  await tel.waitForFunction(() => window.ArdoiseGeneration);
  await tel.evaluate((b64) => {
    const octets = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    ArdoiseGeneration.lancer({ titre: 'Génération des bulletins', sujet: '4e A · 1re période', dureeEstimee: 6,
      requete: () => new Promise((ok) => setTimeout(() => ok(new Response(new Blob([octets], { type: 'application/pdf' }))), 1800)) });
  }, pdf.toString('base64'));
  await tel.waitForTimeout(900);
  if (dossierCaptures) await tel.screenshot({ path: path.join(dossierCaptures, 'generation-mobile.png') });
  await tel.waitForSelector('.gs-pret-mobile');
  assert.equal(await tel.locator('.gs-cadre').count(), 0);
  if (dossierCaptures) await tel.screenshot({ path: path.join(dossierCaptures, 'pret-mobile.png') });
  await mobile.close();

  if (erreurs.length) console.error('Erreurs :', erreurs);
  assert.deepEqual(erreurs, []);
  console.log('✓ Studio et scène de génération vérifiés (' + patchs.length + ' écritures).');
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
