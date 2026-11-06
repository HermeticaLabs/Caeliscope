import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const root = new URL('../', import.meta.url), read = (f) => readFileSync(new URL(f, root), 'utf8');

test('PWA: el manifiesto es válido, usa rutas relativas (sirve en subcarpeta) y sus íconos existen', () => {
  const m = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(m.name, 'Caeliscope'); assert.equal(m.display, 'standalone'); assert.equal(m.start_url, './'); assert.equal(m.scope, './');
  assert.ok(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512') && m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) { assert.ok(!i.src.startsWith('/'), i.src); if (!i.src.endsWith('.svg')) assert.ok(existsSync(new URL('public/' + i.src, root)), i.src); }
});
test('PWA: la versión del service worker coincide con package.json y no guarda lo externo', () => {
  const v = JSON.parse(read('package.json')).version, sw = read('public/sw.js');
  assert.ok(sw.includes(`CACHE_VERSION = '${v}'`), 'subir CACHE_VERSION en public/sw.js');
  assert.ok(sw.includes('url.origin !== self.location.origin'));
});
test('PWA: index.html enlaza el manifiesto, el ícono de Apple y el color de tema; sin correos personales', () => {
  const h = read('index.html'); assert.ok(h.includes('rel="manifest"') && h.includes('apple-touch-icon') && h.includes('theme-color'));
  for (const f of ['public/manifest.webmanifest', 'public/sw.js', 'index.html']) assert.ok(!/gmail|crizman/i.test(read(f)), f);
});
