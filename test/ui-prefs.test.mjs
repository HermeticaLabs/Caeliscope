import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXT_STEPS, nextTextStep, clampOpacity, parsePrefs } from '../src/ui-prefs.mjs';

test('el tamaño de texto recorre pequeño, mediano y grande y vuelve al inicio', () => {
  assert.equal(TEXT_STEPS[0], 1);
  assert.deepEqual([0, 1, 2].map(nextTextStep), [1, 2, 0]);
  assert.ok(TEXT_STEPS[1] > 1 && TEXT_STEPS[2] > TEXT_STEPS[1]);
});
test('la opacidad se limita entre 20% y 100%', () => {
  assert.equal(clampOpacity(0), 0.2); assert.equal(clampOpacity(5), 1); assert.equal(clampOpacity(0.55), 0.55); assert.equal(clampOpacity('x'), 1);
});
test('modo nocturno: solo se activa con true', () => { assert.equal(parsePrefs('{"nm":true}').nm, true); assert.equal(parsePrefs('{"nm":1}').nm, false); });
test('preferencias guardadas: valores válidos se respetan y lo corrupto vuelve al valor por defecto', () => {
  assert.deepEqual(parsePrefs('{"ts":2,"op":0.4}'), { nm: false, ts: 2, op: 0.4 });
  assert.deepEqual(parsePrefs(null), { nm: false, ts: 0, op: 1 });
  assert.deepEqual(parsePrefs('no es json'), { nm: false, ts: 0, op: 1 });
  assert.deepEqual(parsePrefs('{"ts":9,"op":-3}'), { nm: false, ts: 0, op: 0.2 });
});
