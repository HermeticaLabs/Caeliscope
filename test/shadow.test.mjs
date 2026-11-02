import test from 'node:test';
import assert from 'node:assert/strict';
import { solarShadow, lunarShadow, shadowMode } from '../src/shadow.mjs';
import { solarEclipseInfo } from '../src/events.mjs';

const sun = (lon, lat = 0) => ({ lon_ecl_geocentric_deg: lon, lat_ecl_geocentric_deg: lat, dist_au: 1 });
const moon = (lon, lat, d = 384400) => ({ lon_ecl_geocentric_deg: lon, lat_ecl_geocentric_deg: lat, dist_km: d });

test('conjunción exacta: el eje pasa por el centro de la Tierra, penumbra ≈ 0,5 radios terrestres y umbra diminuta', () => {
  const s = solarShadow(moon(100, 0), sun(100));
  assert.ok(s.gamma < 1e-6); assert.ok(s.l1 > 0.5 && s.l1 < 0.6, String(s.l1)); assert.ok(Math.abs(s.l2) < 0.05);
  assert.ok(s.Lu > 370000 && s.Lu < 380000, String(s.Lu));        // el cono de umbra casi llega a la Tierra
  assert.ok(['total', 'anular'].includes(s.kind));
});
test('la Luna cerca del perigeo da umbra que llega a la Tierra (total); lejos, antumbra (anular)', () => {
  assert.equal(solarShadow(moon(100, 0, 357000), sun(100)).kind, 'total');
  assert.equal(solarShadow(moon(100, 0, 406000), sun(100)).kind, 'anular');
});
test('gamma coincide con la fórmula de Meeus de events.mjs', () => {
  const m = moon(100.3, 0.5), u = sun(100);
  const g1 = solarShadow(m, u).gamma, g2 = solarEclipseInfo({ bodies: { Luna: { ...m, dist_km: 384400 }, Sol: u } })?.gamma;
  assert.ok(Math.abs(g1 - g2) / g2 < 0.03, `${g1} vs ${g2}`);
});
test('según la separación: central, parcial o sin eclipse', () => {
  assert.equal(solarShadow(moon(100, 0.2), sun(100)).kind !== 'none', true);
  assert.equal(solarShadow(moon(100, 1.0), sun(100)).kind, 'parcial');
  assert.equal(solarShadow(moon(100, 1.6), sun(100)).kind, 'none');
});
test('eclipse lunar: total, parcial, penumbral y sin eclipse según la separación al centro de la sombra', () => {
  const k = (lat) => lunarShadow(moon(280, lat), sun(100)).kind;
  assert.equal(k(0), 'total'); assert.equal(k(0.6), 'parcial'); assert.equal(k(1.2), 'penumbral'); assert.equal(k(2.2), 'none');
  const l = lunarShadow(moon(280, 0), sun(100)); assert.ok(Math.abs(l.ru - 0.7) < 0.03, String(l.ru)); assert.ok(l.umbMag > 1);
});
test('modo: luna nueva = solar, luna llena = lunar', () => {
  assert.equal(shadowMode(moon(100, 0), sun(100)), 'solar'); assert.equal(shadowMode(moon(280, 0), sun(100)), 'lunar');
});
