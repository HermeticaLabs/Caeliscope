import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLandscape, skylineAt, LAND_W, LANDSCAPES } from '../src/landscape.mjs';

test('sin paisaje: horizonte plano', () => {
  const l = buildLandscape(0); assert.equal(l.maxH, 0); assert.equal(skylineAt(l, 123), 0); assert.equal(skylineAt(null, 5), 0);
});

test('determinista, acotado y cerrado en 360° para cada paisaje', () => {
  for (const { id } of LANDSCAPES.slice(1)) {
    const a = buildLandscape(id), b = buildLandscape(id);
    assert.deepEqual(a.h, b.h, 'mismo resultado dos veces');
    assert.ok(a.maxH > 1 && a.maxH < 26, `alturas razonables (${id}): ${a.maxH}`);
    for (let i = 0; i < a.h.length; i++) assert.ok(a.h[i] >= 0 && Number.isFinite(a.h[i]));
    // los cerros lejanos y las lomas no tienen saltos entre muestras vecinas (incluido el cierre 359.9° -> 0°)
    for (const L of [0, 1]) for (let i = 0; i < LAND_W; i++) assert.ok(Math.abs(a.h[4 * i + L] - a.h[4 * ((i + 1) % LAND_W) + L]) < 0.35, `salto capa ${L} en ${i}`);
    assert.ok(buildLandscape(id, LAND_W, 7).h.some((v, i) => v !== a.h[i]), 'otra semilla, otro paisaje');
  }
});

test('el bosque tiene copas irregulares y el pueblo tiene casas con muros verticales y techos', () => {
  const f = buildLandscape(1), t2 = [], range = [];
  for (let i = 0; i < LAND_W; i++) t2.push(f.h[4 * i + 2]);
  assert.ok(Math.max(...t2) - Math.min(...t2) > 1.0, 'árboles sobresalen de las lomas');
  const p = buildLandscape(2);
  const houses = new Set(); for (let i = 0; i < LAND_W; i++) if (p.info[4 * i] >= 0) houses.add(p.info[4 * i + 2]);
  assert.ok(houses.size >= 10, 'casas: ' + houses.size);
  for (let i = 0; i < LAND_W; i++) {
    const u = p.info[4 * i]; if (u < 0) continue;
    assert.ok(u >= 0 && u <= 1 && p.info[4 * i + 1] > 0.5 && p.info[4 * i + 3] > 1.5, 'datos de casa válidos');
    assert.ok(p.h[4 * i + 3] >= p.info[4 * i + 1], 'la silueta llega al menos a la altura del muro');
  }
  assert.ok(buildLandscape(3).maxH > p.maxH, 'las montañas son más altas que el pueblo');
});

test('skylineAt envuelve el azimut y coincide con el máximo de las capas', () => {
  const l = buildLandscape(3);
  assert.equal(skylineAt(l, 10), skylineAt(l, 370)); assert.equal(skylineAt(l, -350), skylineAt(l, 10));
  const i = 1000, az = (i + 0.5) * 360 / LAND_W;
  assert.equal(skylineAt(l, az), Math.max(l.h[4 * i], l.h[4 * i + 1], l.h[4 * i + 2], l.h[4 * i + 3]));
});
