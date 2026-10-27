// Pruebas del buscador de eventos con el MOTOR REAL (requiere: npm run sync).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const has = existsSync(new URL('../src/engine/caelis-engine.generated.mjs', import.meta.url));
const opts = { skip: has ? false : 'falta el motor: ejecuta npm run sync' };
const { CaelisAPI } = has ? await import('../src/engine/caelis-engine.generated.mjs') : { CaelisAPI: null };
const { findPhase, findSunLongitude, findEclipse, localSolarInfo } = await import('../src/events.mjs');

const evalAt = (ms) => { const j = ms / 86400000 + 2440587.5; return CaelisAPI.getSnapshotAt(j + CaelisAPI.deltaT(j) / 86400, -33.45, -70.66); };
const U = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi);
const min = (a, b) => Math.abs(a - b) / 60000;
const hoy = U(2026, 10, 9);

test('luna nueva 10 oct 2026 (~15:50 UTC) y luna llena 26 oct 2026 (~04:12 UTC)', opts, () => {
  assert.ok(min(findPhase(evalAt, hoy, 0, 1), U(2026, 10, 10, 15, 50)) < 10);
  assert.ok(min(findPhase(evalAt, hoy, 180, 1), U(2026, 10, 26, 4, 12)) < 10);
});

test('equinoccio 20 mar 2026 (14:46 UTC) y solsticio 21 dic 2026 (20:50 UTC)', opts, () => {
  assert.ok(min(findSunLongitude(evalAt, U(2026, 3, 1), 0, 1), U(2026, 3, 20, 14, 46)) < 5);
  assert.ok(min(findSunLongitude(evalAt, hoy, 270, 1), U(2026, 12, 21, 20, 50)) < 5);
});

test('eclipse solar total 12 ago 2026 (~17:46 UTC) y anular 6 feb 2027', opts, async () => {
  const a = await findEclipse(evalAt, hoy, 'solar', -1), b = await findEclipse(evalAt, hoy, 'solar', 1);
  assert.equal(a.type, 'total'); assert.ok(min(a.ms, U(2026, 8, 12, 17, 46)) < 10, new Date(a.ms).toISOString());
  assert.equal(b.type, 'anular'); assert.ok(min(b.ms, U(2027, 2, 6, 16, 0)) < 15, new Date(b.ms).toISOString());
});

test('eclipse lunar total 3 mar 2026 (~11:33 UTC), parcial 28 ago 2026 y penumbral 20 feb 2027', opts, async () => {
  const a = await findEclipse(evalAt, U(2026, 2, 20), 'lunar', 1);
  assert.equal(a.type, 'total'); assert.ok(min(a.ms, U(2026, 3, 3, 11, 33)) < 10, new Date(a.ms).toISOString());
  const b = await findEclipse(evalAt, hoy, 'lunar', -1);
  assert.equal(b.type, 'parcial'); assert.ok(min(b.ms, U(2026, 8, 28, 4, 13)) < 15, new Date(b.ms).toISOString());
  const c = await findEclipse(evalAt, hoy, 'lunar', 1);
  assert.equal(c.type, 'penumbral'); assert.ok(min(c.ms, U(2027, 2, 20, 23, 12)) < 20, new Date(c.ms).toISOString());
});

test('circunstancias locales: el 12 ago 2026 el eclipse no es visible desde Santiago', opts, () => {
  const l = localSolarInfo(evalAt, U(2026, 8, 12, 17, 46));
  assert.equal(l.visible, false);
});

test('findEclipseWhere: solo devuelve el eclipse que cumple y localSolarKind clasifica lo visible', { skip: !has }, async () => {
  const { findEclipseWhere, localSolarKind } = await import('../src/events.mjs');
  const { getSnapshotAt, deltaT } = CaelisAPI;
  const ev = (ms) => { const j = ms / 86400000 + 2440587.5; return getSnapshotAt(j + deltaT(j) / 86400, -33.45, -70.66); };
  // desde Santiago, el primer eclipse solar visible después de oct 2026 es el anular del 6 feb 2027, visto parcial
  const r = await findEclipseWhere(ev, Date.UTC(2026, 9, 26), 'solar', 1, (x) => localSolarKind(localSolarInfo(ev, x.ms)) !== null, 5);
  assert.ok(r); assert.equal(new Date(r.ms).toISOString().slice(0, 10), '2027-02-06');
  assert.equal(localSolarKind(localSolarInfo(ev, r.ms)), 'parcial');
  // un eclipse lunar que se pide con tipo imposible en una ventana corta no aparece
  assert.equal(await findEclipseWhere(ev, Date.UTC(2026, 9, 26), 'solar', 1, () => false, 2), null);
  // hacia atrás
  const b = await findEclipseWhere(ev, Date.UTC(2026, 9, 26), 'lunar', -1, (x) => x.type === 'total' && ev(x.ms).bodies.Luna.alt_apparent_deg > 0, 10);
  assert.ok(b && b.ms < Date.UTC(2026, 9, 26) && b.type === 'total');
});
