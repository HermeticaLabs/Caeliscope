import test from 'node:test';
import assert from 'node:assert/strict';
import { lonToX, latToY, xToLon, yToLat, tileBounds, wrapX, zoomForGround, groundMetersPerPx, tilesForSamples, EQUATOR_M } from '../src/tiles-math.mjs';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
test('Mercator: ida y vuelta y valores conocidos', () => {
  near(lonToX(0, 1), 1); near(latToY(0, 1), 1); near(lonToX(-180, 5), 0); near(lonToX(180, 5), 32);
  for (const [la, lo] of [[-33.45, -70.66], [45.42, -75.7], [80, 10]]) { near(yToLat(latToY(la, 7), 7), la, 1e-9); near(xToLon(lonToX(lo, 7), 7), lo, 1e-9); }
  // Santiago de Chile en el nivel 8 cae en la tesela x=77, y=153 (esquema estándar XYZ)
  assert.equal(Math.floor(lonToX(-70.66, 8)), 77); assert.equal(Math.floor(latToY(-33.45, 8)), 153);
});
test('límites de una tesela son consistentes con las vecinas', () => {
  const a = tileBounds(6, 20, 30), b = tileBounds(6, 21, 30), c = tileBounds(6, 20, 31);
  near(a.lon1, b.lon0); near(a.latS, c.latN); assert.ok(a.latN > a.latS);
});
test('zoom por resolución: más cerca, más nivel; sube con la latitud menor', () => {
  const far = zoomForGround(20000, 0, 5, 8), near_ = zoomForGround(600, 0, 5, 8);
  assert.ok(far < near_); assert.equal(near_, 8); assert.equal(zoomForGround(EQUATOR_M / (256 * 2 ** 6), 0, 5, 8), 6);
  assert.ok(zoomForGround(1500, 60, 5, 8) <= zoomForGround(1500, 0, 5, 8));
});
test('resolución en el suelo desde la cámara', () => { const m = groundMetersPerPx(0.12, 30, 800); assert.ok(m > 500 && m < 700, String(m)); });
test('teselas cubren el punto y su anillo, sin repetir, y envuelven el antimeridiano', () => {
  const t = tilesForSamples([{ lat: -33.45, lon: -70.66 }], 8); assert.equal(t.length, 9);
  assert.ok(t.some((q) => q.x === 77 && q.y === 153));
  const w = tilesForSamples([{ lat: 0, lon: 179.9 }], 4, 1); assert.ok(w.some((q) => q.x === 0) && w.some((q) => q.x === 15));
  assert.equal(tilesForSamples([{ lat: 0, lon: 0 }, { lat: 0, lon: 0 }], 3, 0).length, 1);
  assert.equal(wrapX(-1, 4), 15);
});
