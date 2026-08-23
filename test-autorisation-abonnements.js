/** Régression exécutable sans navigateur : l'URL directe fuit immédiatement. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

test('un Professeur ouvert directement sur abonnements.html est renvoyé vers son espace', () => {
  const source = fs.readFileSync('abonnements-page.js', 'utf8');
  let destination = null;
  const session = {
    connecte: () => true,
    roles: () => ['professeur']
  };
  const contexte = {
    window: { ArdoiseSession: session },
    ArdoiseSession: session,
    location: { replace: (page) => { destination = page; } }
  };

  assert.doesNotThrow(() => vm.runInNewContext(source, contexte));
  assert.strictEqual(destination, 'espace-professeur.html');
});
