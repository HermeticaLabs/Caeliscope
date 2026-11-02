import test from 'node:test';
import assert from 'node:assert/strict';
import { SYNODIC, ROSETTE_CYCLES, rangesFor, rangeConfig, cycleDays, parseRanges, retroFlags, stations, retroColor, tickPlan, tickTimes, rosettePoint, fitPoints, usesModal, DAY } from '../src/trajectory.mjs';

test('cada astro ofrece sus alcances; solo el Sol tiene analema y solo los planetas tienen roseta', () => {
  assert.deepEqual(rangesFor('Sol'), ['12h', '3m', '6m', 'ana']);
  assert.deepEqual(rangesFor('Luna'), ['12h', '3m', '6m', 'syn']);
  for (const p of Object.keys(ROSETTE_CYCLES)) assert.deepEqual(rangesFor(p), ['12h', '3m', '6m', 'syn', 'ros']);
});
test('ciclos: sinódico de la Luna y roseta de Venus (5 ciclos ≈ 8 años)', () => {
  assert.ok(Math.abs(cycleDays('Luna', 'syn') - 29.53) < 0.01);
  assert.ok(Math.abs(cycleDays('Venus', 'ros') / 365.25 - 8) < 0.05);
  assert.ok(Math.abs(SYNODIC.Mercurio - 116) < 1);
  assert.ok(Math.abs(cycleDays('Mercurio', 'syn') - 115.88) < 0.01);
});
test('la configuración cubre el ciclo completo con una cantidad acotada de puntos', () => {
  for (const [b, id] of [['Luna', 'syn'], ['Venus', 'ros'], ['Neptuno', 'ros'], ['Marte', 'syn'], ['Sol', 'ana']]) {
    const c = rangeConfig(b, id), pts = 2 * c.half + 1;
    assert.ok(pts <= 3100, `${b} ${id} ${pts}`);
    assert.ok(Math.abs(c.step * 2 * c.half - cycleDays(b, id) * DAY) < c.step * 2, `${b} ${id}`);
  }
  assert.equal(rangeConfig('Sol', 'ana').anchored, true); assert.equal(rangeConfig('Sol', 'ana').long, false);
  assert.equal(rangeConfig('Marte', '3m').long, true); assert.equal(rangeConfig('Marte', '12h').long, false);
});
test('el modal se abre solo para ciclo, roseta y analema', () => {
  assert.deepEqual(['12h', '3m', '6m', 'syn', 'ros', 'ana'].map(usesModal), [false, false, false, true, true, true]);
});
test('parseRanges descarta alcances inválidos', () => {
  assert.deepEqual(parseRanges({ Sol: 'ana', Luna: 'ros', Marte: '6m', Foo: 'syn', Venus: 5 }), { Sol: 'ana', Marte: '6m' });
  assert.deepEqual(parseRanges(3), {}); assert.deepEqual(parseRanges(null), {});
});
test('retrogradación: AR decreciente (envolviendo 0/360) y estaciones', () => {
  const ras = [10, 11, 12, 12.5, 12.2, 11.8, 11.5, 11.7, 12.2, 13];
  const f = retroFlags(ras); assert.equal(f[1], false); assert.equal(f[5], true); assert.equal(f[9], false);
  const st = stations(f); assert.deepEqual(st.map((s) => s.kind), ['R', 'D']);
  assert.deepEqual(retroFlags([359, 359.5, 0.2, 0.9]), [false, false, false, false]);
  assert.equal(retroFlags([1, 0.5, 359.8, 359.2])[1], true);
});
test('el color de retrogradación es distinto del base pero luminoso y válido', () => {
  for (const c of [[1, 0.33, 0.25], [0.86, 0.9, 1], [0.38, 0.5, 1], [1, 0.6, 0.8]]) {
    const r = retroColor(c); assert.ok(r.every((v) => v >= 0 && v <= 1));
    assert.ok(Math.hypot(r[0] - c[0], r[1] - c[1], r[2] - c[2]) > 0.25, String(c));
  }
});
test('marcas de fecha: cada 3 h, cada pocos días, mensuales o anuales según el alcance', () => {
  assert.deepEqual(tickPlan(DAY), { unit: 'hour', k: 3 });
  assert.equal(tickPlan(29.5 * DAY).unit, 'day'); assert.equal(tickPlan(180 * DAY).unit, 'month');
  assert.equal(tickPlan(2922 * DAY).unit, 'year'); assert.ok(tickPlan(60000 * DAY).k >= 10);
  const t0 = Date.UTC(2026, 0, 10), t1 = Date.UTC(2026, 6, 10), m = tickTimes(t0, t1);
  assert.equal(m.length, 6); assert.equal(new Date(m[0]).getUTCDate(), 1); assert.equal(new Date(m[0]).getUTCMonth(), 1);
  const y = tickTimes(Date.UTC(2026, 5, 1), Date.UTC(2034, 5, 1)); assert.equal(y.length, 8);
  assert.ok(tickTimes(0, 164 * 365.25 * DAY * 3).length <= 40);
});
test('roseta: longitud 0° a la derecha, 90° arriba', () => {
  const [x, y] = rosettePoint(0, 0.7); assert.ok(Math.abs(x - 0.7) < 1e-12 && Math.abs(y) < 1e-12);
  const [x2, y2] = rosettePoint(90, 1); assert.ok(Math.abs(x2) < 1e-9 && Math.abs(y2 - 1) < 1e-12);
  const f = fitPoints([[2, 0], [0, -1]], 200, 10); const [px, py] = f.to([2, 0]); assert.ok(Math.abs(px - 190) < 1e-9 && Math.abs(py - 100) < 1e-9);
});
test('Venus: 5 pétalos = 13 órbitas suyas menos 8 de la Tierra en 8 años', () => {
  const years = cycleDays('Venus', 'ros') / 365.25, venusOrbits = years / 0.61519726, earthOrbits = years;
  assert.ok(Math.abs(venusOrbits - 13) < 0.1); assert.ok(Math.abs(venusOrbits - earthOrbits - 5) < 0.1);
});
