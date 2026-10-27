// Idiomas: ambos diccionarios con las mismas claves y marcas, y todos los astros con nombre en inglés.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KEYS, t, setLang, getLang, locale, bodyName, bodyKeys, conName, conNamesEs, starName, LANGS } from '../src/i18n.mjs';

const marks = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
const read = (f) => JSON.parse(readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8'));
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('el idioma por defecto es el inglés', () => { assert.equal(getLang(), 'en'); assert.equal(locale(), 'en-GB'); });
test('en y es tienen exactamente las mismas claves y las mismas variables', () => {
  assert.deepEqual(KEYS('en').sort(), KEYS('es').sort());
  for (const k of KEYS('en')) { setLang('en'); const a = t(k); setLang('es'); const b = t(k); assert.equal(marks(a), marks(b), k); assert.ok(a && b, k); }
  setLang('en');
});
test('t() sustituye variables y devuelve la clave si falta', () => {
  assert.equal(t('cal.go'), 'Go'); setLang('es'); assert.equal(t('cal.go'), 'Ir'); assert.equal(t('cal.nope'), 'cal.nope'); setLang('en');
  assert.match(t('info.sun', { alt: '1°', az: '2°' }), /1°.*2°/);
});
test('cuerpos: Moon, Sun, Mars en inglés; Luna, Sol, Marte en español', () => {
  assert.deepEqual(['Sol', 'Luna', 'Marte', 'Jupiter', 'Saturno'].map((k) => bodyName(k, 'en')), ['Sun', 'Moon', 'Mars', 'Jupiter', 'Saturn']);
  assert.deepEqual(['Sol', 'Luna', 'Marte', 'Jupiter', 'Neptuno'].map((k) => bodyName(k, 'es')), ['Sol', 'Luna', 'Marte', 'Júpiter', 'Neptuno']);
  assert.equal(bodyKeys().length, 9);
});
test('las 89 constelaciones del catálogo tienen nombre latino en inglés', () => {
  const labels = read('sky-overlay.json').labels.map((l) => l[2]);
  const missing = labels.filter((n) => !conNamesEs().includes(n));
  assert.deepEqual(missing, []);
  assert.equal(conName('Gemelos', 'en'), 'Gemini'); assert.equal(conName('Osa Mayor', 'en'), 'Ursa Major'); assert.equal(conName('Orión', 'en'), 'Orion'); assert.equal(conName('Orión', 'es'), 'Orión');
});
test('nombres de estrellas: los españoles pasan al inglés y los demás quedan igual', () => {
  assert.equal(starName('Sirio', 'en'), 'Sirius'); assert.equal(starName('Vega', 'en'), 'Vega'); assert.equal(starName('Sirio', 'es'), 'Sirio'); assert.equal(starName(undefined, 'en'), undefined);
});
test('todo data-i18n del HTML existe en el diccionario', () => {
  for (const m of html.matchAll(/data-i18n(?:-html|-title|-ph|-aria)?="([^"]+)"/g)) assert.ok(KEYS('en').includes(m[1]), m[1]);
  assert.equal(LANGS.join(), 'en,es');
});
