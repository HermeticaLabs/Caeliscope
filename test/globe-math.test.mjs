import test from 'node:test';
import assert from 'node:assert/strict';
import { latLonToVec, vecToLatLon, northTangent, rayHitSphere, subsolarPoint, panPerPx, journeyPose, GROUND_D, fadeColor, wrap180 } from '../src/globe-math.mjs';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
test('latitud/longitud <-> vector ida y vuelta', () => {
  for (const [la, lo] of [[0, 0], [-33.45, -70.66], [45, 170], [-89, -179], [60, 90]]) { const r = vecToLatLon(latLonToVec(la, lo)); near(r.lat, la); near(wrap180(r.lon - lo), 0); }
});
test('convención: lon 0 a +x, norte a +y, este hacia -z', () => {
  assert.deepEqual(latLonToVec(0, 0).map((x) => +x.toFixed(9)), [1, 0, 0]);
  assert.deepEqual(latLonToVec(90, 0).map((x) => +x.toFixed(9)), [0, 1, 0]);
  const e = latLonToVec(0, 90); near(e[2], -1); near(e[0], 0);
});
test('el tangente norte es unitario y perpendicular al punto', () => {
  for (const [la, lo] of [[-33, -70], [10, 120], [70, -10]]) {
    const P = latLonToVec(la, lo), N = northTangent(la, lo);
    near(Math.hypot(...N), 1); near(P[0] * N[0] + P[1] * N[1] + P[2] * N[2], 0);
    assert.ok(N[1] > 0);
  }
});
test('rayo contra la esfera: da el punto cercano o null', () => {
  const h = rayHitSphere([0, 0, 5], [0, 0, -1]); near(h[2], 1);
  assert.equal(rayHitSphere([0, 3, 5], [0, 0, -1]), null);
  assert.equal(rayHitSphere([0, 0, 5], [0, 0, 1]), null);
});
test('punto subsolar: latitud = declinación, longitud = AR - tiempo sidéreo de Greenwich', () => {
  const s = subsolarPoint(100, 20, 130); near(s.lat, 20); near(s.lon, -30);
  near(subsolarPoint(10, 0, 350).lon, 20);
});
test('arco por píxel decrece al acercarse', () => { assert.ok(panPerPx(1.2, 30, 800) < panPerPx(4, 30, 800)); });
test('viaje: empieza en la vista inicial y termina a ras del suelo mirando al horizonte', () => {
  const from = { d: 4.5, lat: 10, lon: 50 }, pin = { lat: -33.45, lon: -70.66 };
  const a = journeyPose(0, from, pin), z = journeyPose(1, from, pin);
  near(a.d, 4.5); near(a.lat, 10); near(a.lon, 50); assert.equal(a.lookBlend, 0);
  near(z.d, GROUND_D); near(z.lat, pin.lat); near(wrap180(z.lon - pin.lon), 0); near(z.lookBlend, 1);
  let prev = Infinity; for (let i = 0; i <= 20; i++) { const d = journeyPose(i / 20, from, pin).d; assert.ok(d <= prev + 1e-12); prev = d; }
  // al final la dirección de mirada es casi horizontal (perpendicular a la vertical local)
  const P = latLonToVec(pin.lat, pin.lon), cam = P.map((x) => x * z.d), dir = z.look.map((x, i) => x - cam[i]), n = Math.hypot(...dir);
  const up = (dir[0] * P[0] + dir[1] * P[1] + dir[2] * P[2]) / n; assert.ok(Math.abs(up) < 0.05, `inclinación ${up}`);
});
test('el viaje toma el camino corto por la longitud', () => {
  const m = journeyPose(0.3, { d: 4, lat: 0, lon: 170 }, { lat: 0, lon: -170 });
  assert.ok(Math.abs(wrap180(m.lon - 180)) < 12, `lon ${m.lon}`);
});
test('color de la cortina: oscuro de noche, claro de día', () => {
  assert.ok(fadeColor(-20)[2] < 20); assert.ok(fadeColor(30)[2] > 200);
});
