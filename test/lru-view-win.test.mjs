import test from 'node:test';
import assert from 'node:assert/strict';
import { createLru } from '../src/lru.mjs';
import { CENTER, PRESETS, project, orbit, zoomBy, autoZ } from '../src/view3d.mjs';
import { overlaps, slideTo, findFree, clampRect } from '../src/winpos.mjs';

test('la caché guarda como máximo 5 y descarta el menos usado', () => {
  const c = createLru(5); for (let i = 1; i <= 6; i++) c.set('k' + i, i);
  assert.equal(c.size, 5); assert.equal(c.has('k1'), false); assert.equal(c.get('k6'), 6);
  c.get('k2'); c.set('k7', 7);                        // k2 se usó: sale k3
  assert.deepEqual(c.keys(), ['k4', 'k5', 'k6', 'k2', 'k7']);
  for (let i = 0; i < 1000; i++) c.set('x' + i, i); assert.equal(c.size, 5);
});
test('vistas fijas: arriba conserva X e Y; de frente muestra Z hacia arriba', () => {
  const top = project([2, 3, 5], { ...PRESETS.top, zoom: 1 }); assert.ok(Math.abs(top.x - 2) < 1e-9 && Math.abs(top.up - 3) < 1e-9);
  const fr = project([2, 3, 5], { ...PRESETS.front, zoom: 1 }); assert.ok(Math.abs(fr.x - 2) < 1e-9 && Math.abs(fr.up - 5) < 1e-9);
  const sd = project([2, 3, 5], { ...PRESETS.side, zoom: 1 }); assert.ok(Math.abs(sd.x + 3) < 1e-9 && Math.abs(sd.up - 5) < 1e-9);
});
test('girar 360° vuelve al punto de partida; el cabeceo se limita a ±90° y el zoom a un rango', () => {
  let v = CENTER; v = orbit(v, 600, 0); assert.ok(Math.abs(v.yaw - ((CENTER.yaw + 360) % 360)) < 1e-9 || Math.abs(v.yaw - (CENTER.yaw + 360)) < 1e-9);
  assert.equal(orbit(CENTER, 0, -9999).pitch, 90); assert.equal(orbit(CENTER, 0, 9999).pitch, -90);
  assert.equal(zoomBy(CENTER, -1e6).zoom, 8); assert.equal(zoomBy(CENTER, 1e6).zoom, 0.4);
});
test('exageración de Z: 1 si es plano, más si el plano está inclinado, con tope', () => {
  assert.equal(autoZ([[1, 0, 0], [0, 1, 0]]), 1); assert.equal(autoZ([[1, 0, 0.05], [0, 1, -0.05]]), 5); assert.equal(autoZ([[1, 0, 1e-6]]), 80);
});
test('ventanas: no se superponen al arrastrar y se acomodan si ya chocan', () => {
  const a = { x: 0, y: 0, w: 100, h: 100 }, b = { x: 200, y: 0, w: 100, h: 100 };
  assert.equal(overlaps(a, { ...b, x: 50 }), true); assert.equal(overlaps(a, b), false);
  const r = slideTo(a, 150, 0, [b], 1000, 800); assert.equal(overlaps(r, b), false);        // topa con b: no entra
  const s = slideTo(a, 150, 150, [b], 1000, 800); assert.equal(overlaps(s, b), false);
  const f = findFree({ x: 210, y: 10, w: 100, h: 100 }, [b], 1000, 800); assert.equal(overlaps(f, b), false);
  assert.deepEqual(clampRect({ x: 950, y: -5, w: 100, h: 100 }, 1000, 800), { x: 900, y: 0, w: 100, h: 100 });
});
