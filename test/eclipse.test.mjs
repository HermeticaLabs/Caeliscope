import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { solarObscuration, eclipseDarkness, moonTopoDist, eclToEq, umbraLUT, atmosphereFromDanjon, transmission } from '../src/eclipse.mjs';
import { eclipseAlt } from '../src/sky-math.mjs';

const close = (a, b, tol, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);

test('obscuración: sin contacto, total, anular y mitad', () => {
  assert.equal(solarObscuration(1, 0.27, 0.27), 0);
  close(solarObscuration(0, 0.27, 0.28), 1, 1e-12);
  close(solarObscuration(0, 0.27, 0.26), (0.26 / 0.27) ** 2, 1e-12, 'anular');
  close(solarObscuration(0.27, 0.27, 0.27), 0.3910, 0.001, 'discos iguales, centro en el borde'); // 2/3 - sqrt3/(2π)... = 0.391
});

test('oscuridad percibida: sube despacio y cae fuerte al final', () => {
  assert.equal(eclipseDarkness(0), 0); close(eclipseDarkness(0.9), 0.25, 1e-9); close(eclipseDarkness(0.99), 0.5, 1e-9);
  assert.equal(eclipseDarkness(1), 1);
  let p = -1; for (const o of [0, 0.3, 0.6, 0.9, 0.99, 0.999, 1]) { const d = eclipseDarkness(o); assert.ok(d >= p); p = d; }
});

test('el Sol efectivo baja hacia el crepúsculo con la totalidad', () => {
  close(eclipseAlt(60, 0), 60, 1e-9); close(eclipseAlt(60, 1), -7, 1e-9); assert.ok(eclipseAlt(60, 0.5) < 30);
});

test('distancia topocéntrica: Luna en el cenit queda más cerca por un radio terrestre', () => {
  close(moonTopoDist(384400, 90), 384400 - 6371, 1e-6); close(moonTopoDist(384400, -90), 384400 + 6371, 1e-6);
  assert.ok(moonTopoDist(384400, 0) > 384400 - 1);
});

test('eclíptica -> ecuatorial: solsticio de junio y equinoccio', () => {
  const j = eclToEq(90, 0, 23.4393); close(j.ra, 90, 1e-9); close(j.dec, 23.4393, 1e-9);
  const e = eclToEq(0, 0, 23.4393); close(e.ra, 0, 1e-9); close(e.dec, 0, 1e-9);
});

test('la atmósfera: rayos rasantes pierden el azul (Rayleigh); a ~25 km el ozono deja pasar el azul', () => {
  const t6 = transmission(6, atmosphereFromDanjon(2));
  assert.ok(t6[0] > 3 * t6[1] && t6[1] > 3 * t6[2], 'rojo > verde > azul en la troposfera alta');
  const t25 = transmission(25, atmosphereFromDanjon(2));
  assert.ok(t25[2] > t25[0], 'ozono: el azul gana sobre el rojo');
  const t0 = transmission(0, atmosphereFromDanjon(2));
  assert.ok(t0[0] < 1e-5, 'a nivel del mar casi nada pasa');
});

test('tabla de color de la umbra: rojiza adentro, más clara hacia afuera y 1 en la luz directa', () => {
  const lut = umbraLUT({ moonKm: 384400, sunRadiusRad: 0.004654, danjon: 2, n: 96, maxKm: 9000 });
  const px = (i) => [lut[3 * i], lut[3 * i + 1], lut[3 * i + 2]], lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const inner = px(15);
  assert.ok(inner[0] > inner[2] * 1.5, 'rojizo: ' + inner);
  assert.ok(lum(px(30)) > lum(px(2)), 'más brillo hacia el borde');
  assert.ok(lum(px(95)) > 0.98 && px(95).every((v) => v > 0.97), 'blanco en luz directa');
  for (let i = 1; i < 96; i++) assert.ok(lum(px(i)) >= lum(px(i - 1)) - 0.06, 'monótono aprox. en ' + i);
  const dark = umbraLUT({ moonKm: 384400, sunRadiusRad: 0.004654, danjon: 0, n: 96 }), bright = umbraLUT({ moonKm: 384400, sunRadiusRad: 0.004654, danjon: 4, n: 96 });
  assert.ok(lum([bright[45], bright[46], bright[47]]) > lum([dark[45], dark[46], dark[47]]), 'L=4 más brillante que L=0');
});

const has = existsSync(new URL('../src/engine/caelis-engine.generated.mjs', import.meta.url));
test('con el motor real: Luna eclipsada el 3 mar 2026 (11:33 UTC) está a ~0.5° del eje de la sombra', { skip: has ? false : 'falta el motor' }, async () => {
  const { CaelisAPI } = await import('../src/engine/caelis-engine.generated.mjs');
  const { sepDeg } = await import('../src/events.mjs');
  const ms = Date.UTC(2026, 2, 3, 11, 33), j = ms / 86400000 + 2440587.5;
  const b = CaelisAPI.getSnapshotAt(j + CaelisAPI.deltaT(j) / 86400, 35.68, 139.7).bodies;
  const sep = sepDeg(b.Luna.lon_ecl_geocentric_deg, b.Luna.lat_ecl_geocentric_deg, (b.Sol.lon_ecl_geocentric_deg + 180) % 360, -b.Sol.lat_ecl_geocentric_deg);
  assert.ok(sep < 0.7, 'sep ' + sep);
  const eq = eclToEq(b.Luna.lon_ecl_geocentric_deg, b.Luna.lat_ecl_geocentric_deg, CaelisAPI.getSnapshotAt(j + CaelisAPI.deltaT(j) / 86400, 0, 0).meta.obliquity.true_deg);
  assert.ok(Math.abs(eq.dec - b.Luna.dec_deg) < 1.2 && Math.abs(((eq.ra - b.Luna.ra_deg + 540) % 360) - 180) < 1.6, 'RA/Dec geocéntrica ≈ topocéntrica (paralaje ≤1°) ' + JSON.stringify(eq));
});
