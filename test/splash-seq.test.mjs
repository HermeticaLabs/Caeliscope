import test from 'node:test';
import assert from 'node:assert/strict';
import { splashState, E } from '../src/splash-seq.mjs';

test('secuencia: Hermetica → Caelis Engine → Caeliscope, sin solaparse', () => {
  const mid = (a, b) => (a + b) / 2;
  const h = splashState(3000), e = splashState(mid(E.in1, E.out0)), ti = splashState(E.out1 + 4000);
  assert.ok(h.hermetica > 0.99 && h.engine === 0 && h.title === 0);
  assert.ok(e.engine > 0.99 && e.hermetica === 0 && e.title === 0);
  assert.ok(ti.title > 0.99 && ti.engine === 0 && ti.hermetica === 0);
});
test('Caelis Engine dura en pantalla lo mismo que Hermetica', () => {
  const dur = (f) => { let n = 0; for (let t = 0; t < 20000; t += 10) if (f(splashState(t)) > 0.99) n += 10; return n; };
  assert.equal(dur((s) => s.engine), dur((s) => s.hermetica));
});
test('el título permanece en pantalla', () => {
  assert.ok(splashState(60000).title > 0.99);
});
