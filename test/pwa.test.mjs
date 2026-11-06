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
test('PWA: el service worker lleva un marcador que cada compilación sustituye por un identificador único, y no guarda lo externo', async () => {
  const { stampServiceWorker, PLACEHOLDER } = await import('../scripts/stamp-sw.mjs'), { mkdtempSync, writeFileSync, readFileSync: rf } = await import('node:fs'), { tmpdir } = await import('node:os'), { join } = await import('node:path');
  const sw = read('public/sw.js'); assert.ok(sw.includes(`CACHE_VERSION = '${PLACEHOLDER}'`)); assert.ok(sw.includes('url.origin !== self.location.origin'));
  const dir = mkdtempSync(join(tmpdir(), 'sw-')); writeFileSync(join(dir, 'sw.js'), sw);
  const id1 = stampServiceWorker(dir, '9.9.9', 1000), out = rf(join(dir, 'sw.js'), 'utf8');
  assert.ok(id1.startsWith('9.9.9-') && out.includes(`'${id1}'`) && !out.includes(PLACEHOLDER));
  writeFileSync(join(dir, 'sw.js'), sw); assert.notEqual(stampServiceWorker(dir, '9.9.9', 2000), id1);     // otra compilación, otro identificador
  assert.ok(read('vite.config.js').includes('stampServiceWorker'));
});
test('PWA: index.html enlaza el manifiesto, el ícono de Apple y el color de tema; sin correos personales', () => {
  const h = read('index.html'); assert.ok(h.includes('rel="manifest"') && h.includes('apple-touch-icon') && h.includes('theme-color'));
  for (const f of ['public/manifest.webmanifest', 'public/sw.js', 'index.html']) assert.ok(!/gmail|crizman/i.test(read(f)), f);
});
