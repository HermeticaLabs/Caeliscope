import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ABOUT, aboutHtml, ABOUT_VERSION, CONTACT, STORAGE_KEYS } from '../src/about.mjs';

test('Acerca de: EN y ES tienen las mismas secciones y la misma cantidad de párrafos', () => {
  assert.deepEqual(ABOUT.en.sections.map((s) => [s.id, s.p.length]), ABOUT.es.sections.map((s) => [s.id, s.p.length]));
});
test('Acerca de: la versión coincide con package.json y el contacto es el público', () => {
  assert.equal(ABOUT_VERSION, JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version);
  assert.equal(CONTACT, 'hermeticalabs.dev@proton.me');
});
test('Acerca de: ningún texto contiene correos personales ni nombres de terceros ajenos al proyecto', () => {
  for (const l of ['en', 'es']) { const h = aboutHtml(l).toLowerCase(); for (const bad of ['gmail', 'gemini', 'stellarium', 'crizman']) assert.ok(!h.includes(bad), bad); }
});
test('Acerca de: las claves de almacenamiento declaradas existen en el código', () => {
  const src = ['main.mjs', 'i18n.mjs', 'ui-prefs.mjs'].map((f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')).join('\n');
  for (const k of STORAGE_KEYS) assert.ok(src.includes(k), k);
});
