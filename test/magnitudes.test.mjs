import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { sunMagnitude, moonMagnitude, planetMagnitude, saturnRingSinB, AU_KM } from '../src/magnitudes.mjs';
import { planetPhase, elongationDeg } from '../src/astro-fmt.mjs';

const near = (a, b, tol, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} ${a.toFixed(3)} vs ${b}`);

test('Sol y Luna', () => {
  near(sunMagnitude(1), -26.74, 1e-9); assert.ok(sunMagnitude(1.0167) > sunMagnitude(0.9833));
  near(moonMagnitude(384400, 0), -12.73, 1e-9, 'llena');
  near(moonMagnitude(384400, 90), -10.1, 0.3, 'cuarto');
  assert.ok(moonMagnitude(356500, 0) < moonMagnitude(406700, 0), 'perigeo más brillante que apogeo');
});

test('planetas en configuraciones conocidas', () => {
  near(planetMagnitude('Jupiter', 5.2, 4.2, 0), -2.7, 0.2, 'Júpiter en oposición');
  near(planetMagnitude('Marte', 1.3913, 0.3849, 5), -2.78, 0.2, 'Marte oposición 2018');
  near(planetMagnitude('Urano', 19.2, 18.2, 0.5), 5.7, 0.2, 'Urano');
  near(planetMagnitude('Neptuno', 29.95, 29.1, 0.5), 7.8, 0.2, 'Neptuno');
  near(planetMagnitude('Saturno', 9.5, 8.5, 1, Math.sin(26 * Math.PI / 180)), 0.0, 0.3, 'Saturno con anillos abiertos');
  near(planetMagnitude('Venus', 0.72, 0.43, 125), -4.8, 0.2, 'Venus en su máximo brillo');
  near(planetMagnitude('Mercurio', 0.39, 1.3, 15), -1.9, 0.5, 'Mercurio en conjunción superior');
});

test('Venus: continuidad en el cambio de fórmula (163.7°) y los anillos de Saturno cambian el brillo', () => {
  near(planetMagnitude('Venus', 1, 1, 163.69), planetMagnitude('Venus', 1, 1, 163.71), 0.02, 'continuidad');
  assert.ok(planetMagnitude('Saturno', 9.5, 8.5, 1, 0.45) < planetMagnitude('Saturno', 9.5, 8.5, 1, 0) - 0.8, 'anillos abiertos suman >0.8 mag');
});

const has = existsSync(new URL('../src/engine/caelis-engine.generated.mjs', import.meta.url));
test('con el motor real: inclinación de los anillos y magnitudes de hoy', { skip: has ? false : 'falta el motor' }, async () => {
  const { CaelisAPI } = await import('../src/engine/caelis-engine.generated.mjs');
  const snap = (y, m, d) => { const j = Date.UTC(y, m - 1, d) / 86400000 + 2440587.5; return CaelisAPI.getSnapshotAt(j + CaelisAPI.deltaT(j) / 86400, -33.45, -70.66).bodies; };
  const B = (b) => Math.asin(saturnRingSinB(b.Saturno.ra_deg, b.Saturno.dec_deg)) * 180 / Math.PI;
  assert.ok(Math.abs(B(snap(2025, 3, 23))) < 1.0, 'anillos de canto el 23 mar 2025: ' + B(snap(2025, 3, 23)));
  const b17 = B(snap(2017, 9, 15)); assert.ok(b17 > 24 && b17 < 28.5, 'máxima apertura norte 2017: ' + b17);
  const mag = (b, n) => { const el = elongationDeg(b[n].ra_deg, b[n].dec_deg, b.Sol.ra_deg, b.Sol.dec_deg); const p = planetPhase(b[n].dist_au, b.Sol.dist_au, el); return planetMagnitude(n, p.r, b[n].dist_au, p.phaseAngle, n === 'Saturno' ? saturnRingSinB(b[n].ra_deg, b[n].dec_deg) : 0); };
  const hoy = snap(2026, 10, 11);
  for (const [n, lo, hi] of [['Venus', -4.9, -3.0], ['Jupiter', -2.9, -1.5], ['Saturno', -0.5, 1.5], ['Urano', 5.3, 6.1], ['Neptuno', 7.5, 8.1], ['Marte', -1.5, 2.0], ['Mercurio', -2.8, 4]]) {
    const m = mag(hoy, n); assert.ok(m > lo && m < hi, `${n} ${m.toFixed(2)}`);
  }
  // la distancia a la Luna en luna llena (3 mar 2026) es ~ 384 000 km y su magnitud ~ -12.6 a -12.8
  const l = snap(2026, 3, 3), el = elongationDeg(l.Luna.ra_deg, l.Luna.dec_deg, l.Sol.ra_deg, l.Sol.dec_deg);
  const pa = planetPhase(l.Luna.dist_km / AU_KM, l.Sol.dist_au, el).phaseAngle;
  near(moonMagnitude(l.Luna.dist_km, pa), -12.7, 0.3, 'Luna llena');
});
