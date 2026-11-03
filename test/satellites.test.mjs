import test from 'node:test';
import assert from 'node:assert/strict';
import { solveKepler, moonPositionKm } from '../src/satellites/orbits.mjs';
import { moonsOnSky } from '../src/satellites/sky.mjs';
import { MARS_PLUGIN } from '../src/satellites/mars.mjs';
import { JUPITER_PLUGIN } from '../src/satellites/jupiter.mjs';
import { elementsAt } from '../src/satellites/orbits.mjs';
import { insideSilhouette, shadowSpot } from '../src/satellites/sky.mjs';
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
    const p0 = moonPositionKm(m.elements, JD0 + 10), p1 = moonPositionKm(m.elements, JD0 + 10 + 360 / m.elements.nSid), sep = norm(p0.map((c, i) => c - p1[i]));
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
  assert.ok(Math.abs((360 / PHOBOS.elements.nSid) * 24 - 7.65) < 0.02); assert.ok(Math.abs((360 / DEIMOS.elements.nSid) * 24 - 30.3) < 0.05);
  const n = [Math.cos(52.9 * Math.PI / 180) * Math.cos(317.7 * Math.PI / 180), Math.cos(52.9 * Math.PI / 180) * Math.sin(317.7 * Math.PI / 180), Math.sin(52.9 * Math.PI / 180)];
  const a = moonPositionKm(PHOBOS.elements, JD0 + 50), b = moonPositionKm(PHOBOS.elements, JD0 + 50.01);
  const cr = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; assert.ok(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] > 0);
});
test('plugin registrado para Marte', () => { assert.equal(SAT_PLUGINS.length, 2); assert.equal(pluginFor('Jupiter').moons.length, 4); assert.equal(pluginFor('Marte').id, 'mars-mean'); assert.equal(pluginFor('Venus'), null); });

// Marte en ra=0, dec=0 a 0,5 UA; Sol en la dirección opuesta (oposición): la Tierra está entre el Sol y Marte
const mars = { ra_deg: 0, dec_deg: 0, dist_au: 0.5 }, sunOpp = { ra_deg: 180, dec_deg: 0, dist_au: 1 };
const fake = (p) => ({ radiusKm: 3389.5, pole: [270, 90], moons: [{ key: 'X', elements: { a: 9000, e: 0, w: 0, M: 0, i: 0, node: 0, nSid: 360, Papsis: 0, Pnode: 0, pole: [270, 90] } }] }); // polo en +z: órbita en el plano xy
test('oposición: Marte "lleno" desde la Tierra; una luna en el eje de visión delante es tránsito, detrás es ocultación', () => {
  // con ecuador = plano xy y Marte en la dirección +x, la luna en M=0 queda en +x (más lejos: detrás); en M=180, en −x (delante)
  const plug = (M) => ({ radiusKm: 3389.5, pole: [270, 90], moons: [{ key: 'X', elements: { a: 3000, e: 0, w: 0, M, i: 0, node: 0, nSid: 360, Papsis: 0, Pnode: 0, pole: [270, 90] } }] });
  const behind = moonsOnSky(plug(0), mars, sunOpp, JD0)[0], front = moonsOnSky(plug(180), mars, sunOpp, JD0)[0];
  assert.equal(behind.occulted, true); assert.equal(front.transit, true); assert.ok(Math.abs(behind.sepArcsec) < behind.diskArcsec);
  assert.equal(front.eclipsed, false);                                      // en oposición la cara iluminada mira a la Tierra
});
test('eclipse: detrás de Marte respecto del Sol y dentro del cilindro de sombra', () => {
  const plug = (M) => ({ radiusKm: 3389.5, pole: [270, 90], moons: [{ key: 'X', elements: { a: 3000, e: 0, w: 0, M, i: 0, node: 0, nSid: 360, Papsis: 0, Pnode: 0, pole: [270, 90] } }] });
  assert.equal(moonsOnSky(plug(0), mars, sunOpp, JD0)[0].eclipsed, true);   // el Sol queda en −x: la luna en +x está en la noche
  assert.equal(moonsOnSky(plug(180), mars, sunOpp, JD0)[0].eclipsed, false);
  const wide = { radiusKm: 3389.5, pole: [270, 90], moons: [{ key: 'X', elements: { a: 9375, e: 0, w: 0, M: 90, i: 0, node: 0, nSid: 360, Papsis: 0, Pnode: 0, pole: [270, 90] } }] };
  const o = moonsOnSky(wide, mars, sunOpp, JD0)[0]; assert.equal(o.eclipsed, false); assert.equal(o.occulted, false);
  assert.ok(Math.abs(o.dxArcsec) > 5 && Math.abs(o.sepArcsec - (9375 / (0.5 * 149597870.7)) * 206264.806) < 0.01);   // separación aparente = a / distancia
});
test('Fobos real: la separación aparente máxima es de pocos segundos de arco a oposición', () => {
  let mx = 0; for (let d = 0; d < 3; d += 0.01) mx = Math.max(mx, moonsOnSky(MARS_PLUGIN, { ra_deg: 10, dec_deg: -5, dist_au: 0.55 }, { ra_deg: 190, dec_deg: 2, dist_au: 1 }, JD0 + d)[0].sepArcsec);
  assert.ok(mx > 20 && mx < 30, String(mx));      // 9.4e3 km / 0.55 UA ≈ 23″
});

// ── Júpiter ──
const [IO, EUR, GAN, CAL] = JUPITER_PLUGIN.moons;
test('Júpiter: resonancia de Laplace λ₁ − 3λ₂ + 2λ₃ = 180° en cualquier fecha', () => {
  for (const yr of [-200, -50, 0, 10, 30, 120]) {
    const jd = JD0 + yr * 365.25, l = (m) => elementsAt(m.elements, jd).lambda, phi = (((l(IO) - 3 * l(EUR) + 2 * l(GAN)) % 360) + 360) % 360;
    assert.ok(Math.abs(phi - 180) < 0.6, `${yr}: ${phi}`);
  }
});
test('Júpiter: períodos siderales conocidos y órbitas casi ecuatoriales y circulares', () => {
  const P = JUPITER_PLUGIN.moons.map((m) => 360 / m.elements.nSid); [1.769138, 3.551181, 7.154553, 16.689017].forEach((x, i) => assert.ok(Math.abs(P[i] - x) < 2e-5, `${i} ${P[i]}`));
  for (const m of JUPITER_PLUGIN.moons) for (let d = 0; d < 200; d += 3.3) { const r = norm(moonPositionKm(m.elements, JD0 + d)), { a, e } = m.elements; assert.ok(r >= a * (1 - e) - 1e-6 && r <= a * (1 + e) + 1e-6); }
});
test('Júpiter: la máxima separación de Calisto en la oposición es de unos 8′ y la de Ío de unos 2′', () => {
  const jup = { ra_deg: 10, dec_deg: 0, dist_au: 4.2 }, sun = { ra_deg: 190, dec_deg: 0, dist_au: 1 };
  let mx = [0, 0, 0, 0]; for (let d = 0; d < 20; d += 0.02) moonsOnSky(JUPITER_PLUGIN, jup, sun, JD0 + d).forEach((s, i) => { mx[i] = Math.max(mx[i], s.sepArcsec); });
  assert.ok(mx[3] > 540 && mx[3] < 640, String(mx[3]));   // 1.88e6 km / 4.2 UA ≈ 600″
  assert.ok(mx[0] > 130 && mx[0] < 160, String(mx[0]));   // 4.2e5 km / 4.2 UA ≈ 143″
});
test('esferoide achatado: Júpiter visto de lado es una elipse de relación ~0,935', () => {
  const pole = [0, 0, 1], R = 71492, f = 0.06487, d = [1, 0, 0];             // línea de visión en el ecuador
  assert.equal(insideSilhouette([0, 0, R * 0.95], d, pole, R, f), false);       // eje polar: solo llega a R(1−f) = 66.854 km
  assert.equal(insideSilhouette([0, R * 0.99, 0], d, pole, R, f), true);        // en el ecuador llega a R
  assert.equal(insideSilhouette([0, 0, R * 0.93], d, pole, R, f), true);
  assert.equal(insideSilhouette([0, 0, R * 0.99], [0, 0, 1], pole, R, f), true);// visto desde el polo: círculo de radio R
});
test('sombra de una luna sobre el disco: en la oposición cae detrás de la luna, del lado que mira a la Tierra', () => {
  const R = 71492, pole = [0, 0, 1], toSun = [-1, 0, 0];                            // la Tierra y el Sol "detrás" de la luna: ambos en −x desde el planeta
  const hit = shadowSpot([-300000, 20000, 0], toSun, pole, R, 0.06487);              // luna del lado del Sol y la Tierra, desplazada 20.000 km al norte
  assert.ok(hit && hit[0] < 0 && Math.abs(hit[1] - 20000) < 1 && Math.abs(norm(hit) - R) < 100);   // toca la cara iluminada, en el mismo lugar proyectado
  assert.equal(shadowSpot([-300000, 200000, 0], toSun, pole, R, 0.06487), null);     // pasa de largo
  assert.equal(shadowSpot([300000, 0, 0], toSun, pole, R, 0.06487), null);           // luna del lado opuesto al Sol: su sombra se aleja del planeta
});
test('Júpiter: una luna entre el planeta y la Tierra proyecta su sombra sobre el disco (tránsito de sombra)', () => {
  const jup = { ra_deg: 0, dec_deg: 0, dist_au: 5 }, sun = { ra_deg: 180, dec_deg: 0, dist_au: 1 };   // oposición
  let found = 0; for (let d = 0; d < 20; d += 0.01) { const s = moonsOnSky(JUPITER_PLUGIN, jup, sun, JD0 + d)[2]; if (s.shadow && s.transit) { found++; assert.ok(Math.hypot(s.shadow.dxArcsec, s.shadow.dyArcsec) < s.diskArcsec * 1.01); } }
  assert.ok(found > 0);
});
