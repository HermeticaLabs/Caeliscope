import test from 'node:test';
import assert from 'node:assert/strict';
import { solveKepler, moonPositionKm } from '../src/satellites/orbits.mjs';
import { moonsOnSky } from '../src/satellites/sky.mjs';
import { MARS_PLUGIN } from '../src/satellites/mars.mjs';
import { pluginFor, SAT_PLUGINS } from '../src/satellites/index.mjs';

const JD0 = 2451545.0, [PHOBOS, DEIMOS] = MARS_PLUGIN.moons;
const norm = (v) => Math.hypot(...v);
test('Kepler: E - e·sen E = M para varias excentricidades', () => {
  for (const e of [0, 0.015, 0.3, 0.9]) for (const M of [0, 0.5, 2, 3.1, 5.5]) { const E = solveKepler(M, e); assert.ok(Math.abs(E - e * Math.sin(E) - M) < 1e-10, `${e} ${M}`); }
});
test('Fobos y Deimos: distancias entre a(1−e) y a(1+e)', () => {
  for (const m of MARS_PLUGIN.moons) for (let d = 0; d < 400; d += 7.3) {
    const r = norm(moonPositionKm(m.elements, JD0 + d)), { a, e } = m.elements; assert.ok(r >= a * (1 - e) - 1e-6 && r <= a * (1 + e) + 1e-6, `${m.key} ${r}`);
  }
});
test('el período orbital se cumple: tras P días la posición casi se repite (salvo la lenta precesión)', () => {
  for (const m of MARS_PLUGIN.moons) {
    const p0 = moonPositionKm(m.elements, JD0 + 10), p1 = moonPositionKm(m.elements, JD0 + 10 + m.elements.P), sep = norm(p0.map((c, i) => c - p1[i]));
    assert.ok(sep / m.elements.a < 0.02, `${m.key} ${sep}`);
  }
});
test('las órbitas son casi ecuatoriales: la altura sobre el ecuador de Marte es pequeña', () => {
  const pole = (ra, dec) => [Math.cos(dec * Math.PI / 180) * Math.cos(ra * Math.PI / 180), Math.cos(dec * Math.PI / 180) * Math.sin(ra * Math.PI / 180), Math.sin(dec * Math.PI / 180)];
  for (const m of MARS_PLUGIN.moons) {
    const n = pole(...m.elements.pole); let mx = 0;
    for (let d = 0; d < 800; d += 3.7) { const p = moonPositionKm(m.elements, JD0 + d); mx = Math.max(mx, Math.abs(p[0] * n[0] + p[1] * n[1] + p[2] * n[2]) / norm(p)); }
    assert.ok(Math.abs(Math.asin(mx) * 180 / Math.PI - m.elements.i) < 0.15, `${m.key} ${Math.asin(mx) * 180 / Math.PI}`);   // la altura máxima = la inclinación
  }
});
test('Fobos da la vuelta en ~7 h 39 min y Deimos en ~30 h 18 min; sentido directo (antihorario visto desde el polo norte de Marte)', () => {
  assert.ok(Math.abs(PHOBOS.elements.P * 24 - 7.65) < 0.02); assert.ok(Math.abs(DEIMOS.elements.P * 24 - 30.3) < 0.05);
  const n = [Math.cos(52.9 * Math.PI / 180) * Math.cos(317.7 * Math.PI / 180), Math.cos(52.9 * Math.PI / 180) * Math.sin(317.7 * Math.PI / 180), Math.sin(52.9 * Math.PI / 180)];
  const a = moonPositionKm(PHOBOS.elements, JD0 + 50), b = moonPositionKm(PHOBOS.elements, JD0 + 50.01);
  const cr = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; assert.ok(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] > 0);
});
test('plugin registrado para Marte', () => { assert.equal(SAT_PLUGINS.length, 1); assert.equal(pluginFor('Marte').id, 'mars-mean'); assert.equal(pluginFor('Venus'), null); });

// Marte en ra=0, dec=0 a 0,5 UA; Sol en la dirección opuesta (oposición): la Tierra está entre el Sol y Marte
const mars = { ra_deg: 0, dec_deg: 0, dist_au: 0.5 }, sunOpp = { ra_deg: 180, dec_deg: 0, dist_au: 1 };
const fake = (p) => ({ radiusKm: 3389.5, moons: [{ key: 'X', elements: { a: 9000, e: 0, w: 0, M: 0, i: 0, node: 0, P: 1, Papsis: 0, Pnode: 0, pole: [270, 90] } }] }); // polo en +z: órbita en el plano xy
test('oposición: Marte "lleno" desde la Tierra; una luna en el eje de visión delante es tránsito, detrás es ocultación', () => {
  // con ecuador = plano xy y Marte en la dirección +x, la luna en M=0 queda en +x (más lejos: detrás); en M=180, en −x (delante)
  const plug = (M) => ({ radiusKm: 3389.5, moons: [{ key: 'X', elements: { a: 3000, e: 0, w: 0, M, i: 0, node: 0, P: 1, Papsis: 0, Pnode: 0, pole: [270, 90] } }] });
  const behind = moonsOnSky(plug(0), mars, sunOpp, JD0)[0], front = moonsOnSky(plug(180), mars, sunOpp, JD0)[0];
  assert.equal(behind.occulted, true); assert.equal(front.transit, true); assert.ok(Math.abs(behind.sepArcsec) < behind.diskArcsec);
  assert.equal(front.eclipsed, false);                                      // en oposición la cara iluminada mira a la Tierra
});
test('eclipse: detrás de Marte respecto del Sol y dentro del cilindro de sombra', () => {
  const plug = (M) => ({ radiusKm: 3389.5, moons: [{ key: 'X', elements: { a: 3000, e: 0, w: 0, M, i: 0, node: 0, P: 1, Papsis: 0, Pnode: 0, pole: [270, 90] } }] });
  assert.equal(moonsOnSky(plug(0), mars, sunOpp, JD0)[0].eclipsed, true);   // el Sol queda en −x: la luna en +x está en la noche
  assert.equal(moonsOnSky(plug(180), mars, sunOpp, JD0)[0].eclipsed, false);
  const wide = { radiusKm: 3389.5, moons: [{ key: 'X', elements: { a: 9375, e: 0, w: 0, M: 90, i: 0, node: 0, P: 1, Papsis: 0, Pnode: 0, pole: [270, 90] } }] };
  const o = moonsOnSky(wide, mars, sunOpp, JD0)[0]; assert.equal(o.eclipsed, false); assert.equal(o.occulted, false);
  assert.ok(Math.abs(o.dxArcsec) > 5 && Math.abs(o.sepArcsec - (9375 / (0.5 * 149597870.7)) * 206264.806) < 0.01);   // separación aparente = a / distancia
});
test('Fobos real: la separación aparente máxima es de pocos segundos de arco a oposición', () => {
  let mx = 0; for (let d = 0; d < 3; d += 0.01) mx = Math.max(mx, moonsOnSky(MARS_PLUGIN, { ra_deg: 10, dec_deg: -5, dist_au: 0.55 }, { ra_deg: 190, dec_deg: 2, dist_au: 1 }, JD0 + d)[0].sepArcsec);
  assert.ok(mx > 20 && mx < 30, String(mx));      // 9.4e3 km / 0.55 UA ≈ 23″
});
