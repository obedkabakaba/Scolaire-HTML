/** Régressions du Centre Support, exécutables sans navigateur. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('support.html', 'utf8');
const js = fs.readFileSync('support-page.js', 'utf8');
const css = fs.readFileSync('support-abonnements.css', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

test('chaque élément utilisé par le script existe dans la page', () => {
  const idsHtml = new Set([
    ...Array.from(html.matchAll(/\bid="([^"]+)"/g), (m) => m[1]),
    ...Array.from(js.matchAll(/\bid=\\?"([^"\\]+)\\?"/g), (m) => m[1])
  ]);
  const idsScript = new Set(Array.from(js.matchAll(/\$\('([^']+)'\)/g), (m) => m[1]));
  const absents = Array.from(idsScript).filter((id) => !idsHtml.has(id));
  assert.deepEqual(absents, []);
});

test('création et réponse utilisent de vrais formulaires accessibles', () => {
  assert.match(html, /<form id="form-demande"[^>]*novalidate>/);
  assert.match(html, /<button type="submit"[^>]*id="creer"/);
  assert.match(html, /<form id="form-reponse">/);
  assert.match(html, /<button type="submit"[^>]*id="envoyer-reponse"/);
  assert.match(js, /form-demande'\)\.addEventListener\('submit'/);
  assert.match(js, /form-reponse'\)\.addEventListener\('submit'/);
});

test('les conversations ne sont ni persistées ni placées dans les requêtes', () => {
  const executable = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executable, /(?:localStorage|sessionStorage|indexedDB)\s*\./i);
  assert.doesNotMatch(executable, /caches\s*\./i);
  assert.doesNotMatch(executable, /ecole_id|ecoleId/,
    "l'identité de l'école doit venir du jeton vérifié par l'API");
  assert.match(sw, /if\(url\.origin!==self\.location\.origin\)[\s\S]*event\.respondWith\(fetch\(req\)/,
    "les réponses API authentifiées doivent rester hors du cache applicatif");
});

test('les données renvoyées par l’API sont échappées avant insertion HTML', () => {
  for (const expression of [
    'esc(ticket.sujet)', 'esc(ticket.reference)', 'esc(reponse.ticket.sujet)',
    'esc(reponse.ticket.reference)', 'esc(message.contenu)', 'esc(message.auteur'
  ]) {
    assert.ok(js.includes(expression), `${expression} doit rester échappé`);
  }
});

test('les pannes réseau ont un délai, un message et une action de reprise', () => {
  assert.match(js, /AbortController/);
  assert.match(js, /18000/);
  assert.match(html, /id="etat-connexion"[^>]*aria-live="polite"/);
  assert.match(js, /id="reessayer-liste"/);
  assert.match(js, /id="reessayer-detail"/);
});

test('le style Support reste relié aux variables du thème Ardoise', () => {
  const support = css.slice(css.indexOf('/* Support */'));
  assert.match(support, /var\(--craie-2\)/);
  assert.match(support, /var\(--texte-sombre\)/);
  assert.match(support, /var\(--ocre\)/);
  assert.doesNotMatch(support, /#[0-9a-f]{3,8}/i,
    'aucune couleur fixe ne doit casser les thèmes Clair, Nuit ou Doux');
});

test('la nouvelle page Support est disponible dans la coquille PWA', () => {
  const version = sw.match(/const VERSION='ardoise-v(\d+)'/);
  assert.ok(version && Number(version[1]) >= 65, 'Le cache doit inclure la livraison du Support (v65 ou ultérieure).');
  for (const fichier of ['support.html', 'support-page.js', 'support-abonnements.css']) {
    assert.ok(sw.includes(`'${fichier}'`), `${fichier} doit être précaché`);
  }
});
