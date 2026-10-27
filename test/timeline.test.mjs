import test from 'node:test';
import assert from 'node:assert/strict';
import { splashState, veilAlpha, T } from '../src/timeline.mjs';

test('portada: empieza sin texto y solo la interacción trae la interfaz', () => {
  const a = splashState(0); assert.equal(a.hermetica + a.title + a.sub + a.ui, 0);
  const h = splashState(60000); assert.equal(h.ui, 0); assert.equal(h.done, false); assert.ok(h.title > 0.99); assert.equal(h.flying, false); assert.equal(h.pinned, false); assert.equal(h.spin, 3);   // el logo espera, la Tierra gira, sin pin
  const z = splashState(60000, T.dismiss + 1); assert.equal(z.flying, true); assert.equal(z.pinned, true); assert.equal(z.spin, 0); assert.equal(z.ui, 1); assert.equal(z.title, 0); assert.equal(z.done, true);
});
test('Hermetica Labs dura 4 s y sale antes de que entre Caeliscope', () => {
  assert.equal(T.hOut1 - T.hIn0, 4000);
  assert.ok(splashState(3000).hermetica > 0.99);
  assert.equal(splashState(T.hOut1).hermetica, 0);
  assert.equal(splashState(T.hOut1).title, 0);
  assert.ok(splashState(T.tIn1).title > 0.99);
  for (let t = 0; t < 12000; t += 100) for (const d of [-1, 0, 400, 900, 1300]) { const s = splashState(t, d); for (const k of ['hermetica', 'title', 'sub', 'ui']) assert.ok(s[k] >= 0 && s[k] <= 1); assert.ok(!(s.hermetica > 0.01 && s.title > 0.01), `solapan a ${t}`); }
});
test('la cortina es transparente al inicio y opaca al llegar al suelo', () => { assert.equal(veilAlpha(0), 0); assert.equal(veilAlpha(0.5), 0); assert.equal(veilAlpha(1), 1); assert.ok(veilAlpha(0.9) > 0 && veilAlpha(0.9) < 1); });
