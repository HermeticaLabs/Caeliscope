import test from 'node:test';
import assert from 'node:assert/strict';
import { dirFromAltAz, separationDeg, inView, moonOrientation } from '../src/sky-math.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('direcciones cardinales y cenit', () => {
  const n = dirFromAltAz(0, 0), e = dirFromAltAz(0, 90), s = dirFromAltAz(0, 180), z = dirFromAltAz(90, 0);
  near(n[2], -1); near(e[0], 1); near(s[2], 1); near(z[1], 1);
});

test('la dirección es un vector unitario', () => {
  const d = dirFromAltAz(37.2, 211.9);
  near(Math.hypot(...d), 1);
});

test('Luna cerca del cenit con azimut opuesto a la cámara SÍ está a la vista', () => {
  // Luna a 80° de altura y azimut 90°; cámara mirando a 80° de altura y azimut 270°.
  assert.ok(separationDeg(80, 90, 80, 270) < 21);
  assert.ok(inView(80, 270, 80, 90, 75));
  // La regla antigua (|dAz| < FOV*0.7) la habría descartado:
  const dAz = Math.abs(((90 - 270 + 540) % 360) - 180);
  assert.ok(!(dAz < 75 * 0.7));
});

test('un objeto lejos de la vista no se dibuja', () => {
  assert.ok(!inView(0, 0, 80, 90, 75));
});

const R_ = [1, 0, 0], U_ = [0, 1, 0]; // cámara mirando al norte, sin giro: este a la derecha

test('fase: luna llena, nueva y cuarto', () => {
  const m = dirFromAltAz(0, 0), ncp = dirFromAltAz(-33.45, 0);
  near(moonOrientation(m, dirFromAltAz(0, 180), ncp, R_, U_).L[2], 1);   // llena
  near(moonOrientation(m, dirFromAltAz(0, 0), ncp, R_, U_).L[2], -1);    // nueva
  const q = moonOrientation(m, dirFromAltAz(0, 90), ncp, R_, U_).L;      // Sol al este
  near(q[2], 0); near(q[0], 1);                                          // limbo iluminado a la derecha
});

test('hemisferio sur: el norte lunar apunta hacia abajo con la Luna en el horizonte norte', () => {
  const o = moonOrientation(dirFromAltAz(0, 0), dirFromAltAz(0, 90), dirFromAltAz(-33.45, 0), R_, U_);
  assert.ok(o.N[1] < -0.99);
});

// ── Estrellas ──────────────────────────────────────────────────────────────────
import { skyRotation, equatorialVector, precessionMatrix, magLimit } from '../src/stars.mjs';

function altAz(raDeg, decDeg, lstDeg, latDeg, T = 0) {
  const m = skyRotation(lstDeg, latDeg, T), e = equatorialVector(raDeg, decDeg);
  const v = [0, 1, 2].map((i) => m[3 * i] * e[0] + m[3 * i + 1] * e[1] + m[3 * i + 2] * e[2]); // x=E, y=cenit, z=Sur
  const alt = Math.asin(v[1]) * 180 / Math.PI;
  const az = ((Math.atan2(v[0], -v[2]) * 180 / Math.PI) + 360) % 360;
  return { alt, az };
}
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} vs ${b}`);

test('coincide con la salida real del motor Caelis (Marte y Sol, 2026-10-07 09:34 UTC, Santiago)', () => {
  const lst = 89.211925, lat = -33.45;
  const mars = altAz(128.03295212213493, 20.016385475446114, lst, lat);
  close(mars.alt, 24.968644608140586, 0.02, 'Marte alt'); close(mars.az, 40.52264631433053, 0.02, 'Marte az');
  const sol = altAz(193.01437709854537, -5.575935215959837, lst, lat);
  close(sol.alt, -8.311748601737794, 0.02, 'Sol alt'); close(sol.az, 102.3688096576069, 0.02, 'Sol az');
});

test('el polo norte celeste está a una altura igual a la latitud, hacia el norte', () => {
  const p = altAz(0, 90, 123, -33.45);
  close(p.alt, -33.45, 1e-9, 'alt'); close(p.az % 360, 0, 1e-6, 'az');
});

test('precesión: en 26.3 años el punto (0,0) se corre ~0.337° en AR y ~0.146° en Dec', () => {
  const P = precessionMatrix(0.263), e = [1, 0, 0];
  const v = [0, 1, 2].map((i) => P[3 * i] * e[0] + P[3 * i + 1] * e[1] + P[3 * i + 2] * e[2]);
  close(Math.atan2(v[1], v[0]) * 180 / Math.PI, 0.337, 0.01, 'AR'); close(Math.asin(v[2]) * 180 / Math.PI, 0.146, 0.01, 'Dec');
});

test('de día no se ven estrellas y de noche cerrada se ven hasta magnitud 6.5', () => {
  assert.ok(magLimit(10) < -1.5); close(magLimit(-30), 6.5, 1e-9, 'noche');
});

import { buildSegmentPositions, lineAlpha, labelMagLimit } from '../src/stars.mjs';
import { readFileSync } from 'node:fs';

test('datos de constelaciones: segmentos válidos y nombres de estrellas conocidas', () => {
  const o = JSON.parse(readFileSync(new URL('../public/sky-overlay.json', import.meta.url), 'utf8'));
  const pos = buildSegmentPositions(o.segments);
  assert.ok(pos.length >= o.segments.length * 6 && pos.length % 6 === 0);
  for (let i = 0; i < pos.length; i += 6) { // ningún tramo supera ~2°
    const d = pos[i] * pos[i + 3] + pos[i + 1] * pos[i + 4] + pos[i + 2] * pos[i + 5];
    assert.ok(Math.acos(Math.min(1, d)) < 2.01 * Math.PI / 180, 'tramo largo');
  }
  for (let i = 0; i < pos.length; i += 3) close(Math.hypot(pos[i], pos[i + 1], pos[i + 2]), 1, 1e-5, 'unitario');
  assert.equal(o.labels.length, 89);
  const sirio = o.stars.find((s) => s[3] === 'Sirio');
  close(sirio[0], 101.287, 0.01, 'AR Sirio'); close(sirio[1], -16.716, 0.01, 'Dec Sirio');
  assert.ok(o.stars.some((s) => s[3] === 'Acrux') || o.stars.some((s) => /Cruz|Acrux/.test(s[3])));
});

test('las líneas aparecen en el crepúsculo y los nombres aumentan al acercar', () => {
  close(lineAlpha(10), 0, 1e-9, 'día'); close(lineAlpha(-30), 1, 1e-9, 'noche'); close(lineAlpha(-12), 0.5, 1e-9, 'crepúsculo');
  close(labelMagLimit(100), 1.2, 1e-9, 'lejos'); close(labelMagLimit(40), 3.0, 1e-9, 'cerca');
});

import { skyPalette, extinction } from '../src/sky-math.mjs';
test('cielo: noche cerrada oscura con Vía Láctea; día azul sin Vía Láctea', () => {
  const n = skyPalette(-30), d = skyPalette(40);
  assert.equal(n.night, 1); assert.equal(d.night, 0);
  assert.ok(n.zenith[2] < 0.05); assert.ok(d.zenith[2] > d.zenith[0] * 3);
});
test('extinción: el Sol enrojece en el horizonte y no cambia en el cenit', () => {
  const z = extinction(90), h = extinction(2);
  close(z[0], 1, 0.01, 'r'); close(z[2], 1, 0.01, 'b');
  assert.ok(h[0] === 1 && h[2] < 0.5 * h[1] && h[1] < 0.9);
});

import { horizontalOf, normName } from '../src/stars.mjs';
test('horizontalOf coincide con la salida real del motor (Marte)', () => {
  const h = horizontalOf(skyRotation(89.211925, -33.45), equatorialVector(128.03295212213493, 20.016385475446114));
  close(h.alt, 24.968644608140586, 0.02, 'alt'); close(h.az, 40.52264631433053, 0.02, 'az');
});
test('búsqueda: ignora tildes y mayúsculas', () => {
  assert.equal(normName('  ÁGUILA '), 'aguila'); assert.equal(normName('Orión'), 'orion');
});

import { fmtHMS, fmtDMS, planetPhase, refractionDeg, riseSetFromSamples, elongationDeg } from '../src/astro-fmt.mjs';
import { azimuthalGrid, equatorialGrid, eclipticLine, meridianLine } from '../src/grids.mjs';

test('formato: AR en horas y ángulos en grados, formato astronómico estándar', () => {
  assert.equal(fmtHMS(11.1279), '00h 44m 30.7s');
  assert.equal(fmtDMS(1 + 50 / 60 + 5.8 / 3600), '+01° 50′ 05.8″');
  assert.equal(fmtDMS(75 + 36 / 60 + 58 / 3600, false, 3), '075° 36′ 58.0″');
  assert.equal(fmtDMS(-0.5), '-00° 30′ 00.0″');
  assert.equal(fmtHMS(359.9999999), '00h 00m 00.0s');
});

test('fase de planeta: cuadratura da 85.4% y oposición 100%', () => {
  const q = planetPhase(1, 1, 90);
  close(q.illum, 0.8536, 1e-3, 'cuadratura'); close(q.r, Math.SQRT2, 1e-9, 'r');
  close(planetPhase(4, 1, 180).illum, 1, 1e-9, 'oposición');
  close(elongationDeg(0, 0, 90, 0), 90, 1e-9, 'elongación');
});

test('refracción de Saemundsson: ~0.48° en el horizonte y ~0.036° a 25°', () => {
  close(refractionDeg(0), 0.4828, 0.005, 'horizonte'); close(refractionDeg(25), 0.036, 0.002, '25°');
});

test('orto y ocaso por interpolación de alturas muestreadas', () => {
  const alts = Array.from({ length: 105 }, (_, k) => 40 * Math.sin((2 * Math.PI * (k * 0.25 - 6)) / 24)); // cruza 0 a las 6 h y 18 h
  const r = riseSetFromSamples(alts, 0, 900000, 0);
  close(r.rise / 3600000, 6, 0.02, 'orto'); close(r.set / 3600000, 18, 0.02, 'ocaso');
  assert.equal(riseSetFromSamples([10, 12, 11], 0, 900000, 0).state, 'siempre');
  assert.equal(riseSetFromSamples([-10, -12, -11], 0, 900000, 0).state, 'nunca');
});

test('cuadrículas: vectores unitarios y la eclíptica llega a la declinación = oblicuidad', () => {
  for (const g of [azimuthalGrid(), equatorialGrid(), eclipticLine(23.44), meridianLine()]) {
    assert.ok(g.length > 0 && g.length % 6 === 0);
    for (let i = 0; i < g.length; i += 3) close(Math.hypot(g[i], g[i + 1], g[i + 2]), 1, 1e-4, 'unitario');
  }
  const e = eclipticLine(23.44); let maxDec = 0;
  for (let i = 2; i < e.length; i += 3) maxDec = Math.max(maxDec, Math.asin(e[i]) * 180 / Math.PI);
  close(maxDec, 23.44, 0.01, 'declinación máxima');
});
