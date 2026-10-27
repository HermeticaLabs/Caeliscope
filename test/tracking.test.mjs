import test from 'node:test';
import assert from 'node:assert/strict';
import { followStep, wrapDelta } from '../src/tracking.mjs';

const near = (a, b, t = 1e-9) => assert.ok(Math.abs(a - b) <= t, `${a} vs ${b}`);

test('wrapDelta toma el camino corto a través del Norte', () => {
  near(wrapDelta(10, 350), 20); near(wrapDelta(350, 10), -20); near(wrapDelta(180, 0), -180);
  near(wrapDelta(90, 90), 0); near(wrapDelta(-30, 30), -60); near(wrapDelta(725, 5), 0);
});

test('se acerca suave y converge, pasando por el Norte sin dar la vuelta larga', () => {
  let v = { az: 350, alt: 10 }, locked = false;
  const target = { az: 20, alt: 40 };
  const seen = [];
  for (let i = 0; i < 80 && !locked; i++) { const s = followStep(v, target, locked); seen.push(s.az); v = { az: s.az, alt: s.alt }; locked = s.locked; }
  assert.ok(locked, 'termina enganchado');
  near(v.az, 20, 0.06); near(v.alt, 40, 0.06);
  assert.ok(seen.every((a) => a >= 349.9 || a <= 20.1), 'nunca pasa por el sur');
});

test('enganchado: queda exactamente sobre el objeto aunque se mueva muy rápido y respeta ±90° de altura', () => {
  let s = followStep({ az: 100, alt: 20 }, { az: 100.01, alt: 20.01 }, true);
  near(s.az, 100.01); near(s.alt, 20.01);
  s = followStep({ az: 0, alt: 10 }, { az: 270, alt: -120 }, true);
  near(s.az, 270); near(s.alt, -90);
  assert.equal(s.locked, true);
});

test('no se declara enganchado mientras esté lejos', () => {
  assert.equal(followStep({ az: 0, alt: 0 }, { az: 30, alt: 0 }, false).locked, false);
});
