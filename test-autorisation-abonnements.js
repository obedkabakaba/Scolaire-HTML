/**
 * Régressions exécutables sans navigateur.
 *
 * Elles chargent la VRAIE table de session.js — pas une copie de test —
 * puis vérifient le comportement de chaque garde. Si la table change, ces
 * tests changent d'avis avec elle : c'est le but.
 *
 *     node --test test-autorisation-abonnements.js
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

/** Élément DOM minimal : session.js en construit quelques-uns au chargement. */
function element() {
  const e = {
    style: { cssText: '' },
    dataset: {},
    classList: { add() {}, remove() {}, contains: () => false },
    appendChild: (x) => x,
    removeChild: (x) => x,
    insertBefore: (x) => x,
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null,
    addEventListener() {}, remove() {}, focus() {},
    querySelector: () => null, querySelectorAll: () => [],
    innerHTML: '', textContent: '', hidden: false
  };
  e.parentNode = null;
  return e;
}

/** Évalue session.js dans un bac à sable et rend `window.ArdoiseAcces`. */
function chargerAcces(rolesStockes) {
  const stockage = {
    ardoise_user: JSON.stringify({ roles: rolesStockes || [] })
  };
  const faux = {
    getItem: (c) => (c in stockage ? stockage[c] : null),
    setItem: (c, v) => { stockage[c] = String(v); },
    removeItem: (c) => { delete stockage[c]; }
  };
  const fenetre = {
    localStorage: faux,
    sessionStorage: faux,
    location: { pathname: '/support.html', href: '', replace() {} },
    addEventListener() {},
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    fetch: () => new Promise(() => {}),
    document: {
      addEventListener() {},
      createElement: () => element(),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      documentElement: element(),
      head: element(),
      body: element(),
      readyState: 'complete'
    },
    console
  };
  fenetre.window = fenetre;
  const contexte = vm.createContext(fenetre);
  vm.runInContext(fs.readFileSync('session.js', 'utf8'), contexte);
  assert.ok(fenetre.ArdoiseAcces, 'session.js doit publier window.ArdoiseAcces');
  return fenetre.ArdoiseAcces;
}

test('la table réserve Abonnements au Directeur', () => {
  const acces = chargerAcces([]);
  assert.strictEqual(acces.peutGererAbonnements(['directeur']), true);
  assert.strictEqual(acces.peutGererAbonnements(['super_admin']), true);
  for (const role of ['professeur', 'titulaire', 'secretaire', 'comptable',
                      'prefet', 'charge_presences', 'directeur_discipline']) {
    assert.strictEqual(acces.peutGererAbonnements([role]), false,
      `${role} ne doit pas gérer l'abonnement`);
  }
});

test('un Professeur ne voit aucun écran réservé à un autre métier', () => {
  const acces = chargerAcces([]);
  const interdits = ['dashboard-directeur.html', 'comptabilite.html', 'frais-scolaires.html',
                     'utilisateurs.html', 'journal.html', 'parametres.html', 'archives.html',
                     'eleves.html', 'classes.html', 'abonnements.html',
                     'espace-secretaire.html', 'espace-titulaire.html'];
  for (const page of interdits) {
    assert.strictEqual(acces.peutVoirPage(page, ['professeur']), false, page);
  }
  const permis = ['espace-professeur.html', 'notes.html', 'messages.html',
                  'calendrier.html', 'emploi-du-temps.html', 'support.html',
                  'mon-profil.html'];
  for (const page of permis) {
    assert.strictEqual(acces.peutVoirPage(page, ['professeur']), true, page);
  }
});

test("l'URL de secours d'un rôle refusé est un écran qui lui est ouvert", () => {
  const acces = chargerAcces([]);
  const cas = {
    professeur: 'espace-professeur.html',
    titulaire: 'espace-titulaire.html',
    secretaire: 'espace-secretaire.html',
    comptable: 'frais-scolaires.html',
    prefet: 'dashboard-directeur.html',
    directeur: 'dashboard-directeur.html'
  };
  for (const [role, attendu] of Object.entries(cas)) {
    const repli = acces.pageDeRepli([role]);
    assert.strictEqual(repli, attendu, `${role} → ${repli}`);
    assert.strictEqual(acces.peutVoirPage(repli, [role]), true,
      `${role} est renvoyé sur une page qui lui est encore refusée`);
  }
  // Un compte sans aucun rôle métier ne doit pas boucler : il atterrit sur
  // son propre compte, ouvert à tous.
  assert.strictEqual(acces.pageDeRepli([]), 'mon-profil.html');
});

test('un Professeur ouvert directement sur abonnements.html est renvoyé vers son espace', () => {
  const acces = chargerAcces([]);
  const source = fs.readFileSync('abonnements-page.js', 'utf8');
  let destination = null;
  const session = { connecte: () => true, roles: () => ['professeur'] };
  const contexte = {
    window: { ArdoiseSession: session, ArdoiseAcces: acces },
    ArdoiseSession: session,
    ArdoiseAcces: acces,
    location: { replace: (page) => { destination = page; } }
  };
  assert.doesNotThrow(() => vm.runInNewContext(source, contexte));
  assert.strictEqual(destination, 'espace-professeur.html');
});

test('un Directeur reste sur abonnements.html', () => {
  const acces = chargerAcces([]);
  const source = fs.readFileSync('abonnements-page.js', 'utf8');
  let destination = null;
  const session = { connecte: () => true, roles: () => ['directeur'] };
  const contexte = {
    window: { ArdoiseSession: session, ArdoiseAcces: acces },
    ArdoiseSession: session,
    ArdoiseAcces: acces,
    location: { replace: (page) => { destination = page; } },
    // La suite du fichier touche au DOM : elle échouera, et c'est sans
    // importance ici. Seule compte l'absence de redirection.
    document: undefined
  };
  try { vm.runInNewContext(source, contexte); } catch (e) { /* DOM absent */ }
  assert.strictEqual(destination, null, 'le Directeur ne doit pas être redirigé');
});
