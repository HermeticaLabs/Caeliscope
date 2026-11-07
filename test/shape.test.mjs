import test from 'node:test';
import assert from 'node:assert/strict';
import { SAT_PLUGINS } from '../src/satellites/index.mjs';
import { SHAPES, moonFrame, lonLatOf, illuminatedFraction } from '../src/satellites/shape.mjs';
import { moonPositionKm } from '../src/satellites/orbits.mjs';
import { MOON_MAPS, LOOK } from '../src/satellites/maps.mjs';

const JD = 2461000.5, dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2], cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const planetAt = (dist) => ({ ra_deg: 10, dec_deg: 5, dist_au: dist }), sun = { ra_deg: 190, dec_deg: -5, dist_au: 1 };

test('Formas: toda luna de los plugins tiene semiejes coherentes con su radio medio y semieje a ≥ b ≥ c', () => {
  for (const pl of SAT_PLUGINS) for (const m of pl.moons) {
    const s = SHAPES[m.key]; assert.ok(s, m.key); assert.ok(s.a >= s.b && s.b >= s.c, m.key);
    const mean = Math.cbrt(s.a * s.b * s.c); assert.ok(Math.abs(mean - m.meanRadiusKm) / m.meanRadiusKm < 0.1, `${m.key} ${mean} vs ${m.meanRadiusKm}`);
    assert.ok(MOON_MAPS[m.key] || LOOK[m.key] || m.key === 'Nereid' || m.key === 'Titan', `${m.key} sin mapa ni aspecto`);
  }
});
test('Marco de cada luna: base ortonormal derecha, a mira al planeta y c es el norte', () => {
  for (const pl of SAT_PLUGINS) for (const m of pl.moons) {
    const f = moonFrame(pl, m, planetAt(pl.planet === 'Marte' ? 1.5 : 5), sun, JD), p = moonPositionKm(m.elements, JD);
    for (const v of [f.a, f.b, f.c]) assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-9);
    assert.ok(Math.abs(dot(f.a, f.b)) < 1e-9 && Math.abs(dot(f.a, f.c)) < 1e-9);
    const t = cross(f.a, f.b); assert.ok(dot(t, f.c) > 0.999999, m.key);
    if (!SHAPES[m.key].spinDays) assert.ok(dot(f.a, p) / Math.hypot(...p) < -0.999999, m.key);   // sincrónica: el eje a apunta siempre al planeta
  }
});
test('Norte: igual al de la órbita, salvo Tritón y las lunas de Urano, que lo tienen invertido', () => {
  const ang = (pl, key) => { const m = pl.moons.find((q) => q.key === key), p0 = moonPositionKm(m.elements, JD), p1 = moonPositionKm(m.elements, JD + 0.01), h = cross(p0, [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]), f = moonFrame(pl, m, planetAt(5), sun, JD); return dot(f.c, h) / Math.hypot(...h); };
  const by = (id) => SAT_PLUGINS.find((p) => p.planet === id);
  assert.ok(ang(by('Júpiter') || by('Jupiter'), 'Io') > 0.999); assert.ok(ang(by('Neptuno'), 'Triton') < -0.999); assert.ok(ang(by('Urano'), 'Titania') < -0.999);
});
test('Iluminación: en oposición el ángulo de fase es pequeño y la luna se ve casi llena', () => {
  const j = SAT_PLUGINS.find((p) => p.moons.some((m) => m.key === 'Io')), op = { ra_deg: 190 + 180, dec_deg: 5, dist_au: 4.2 };
  const f = moonFrame(j, j.moons[0], { ...op, ra_deg: 10 }, { ra_deg: 190, dec_deg: -5, dist_au: 1 }, JD);
  assert.ok(f.phaseAngleDeg < 12, String(f.phaseAngleDeg)); assert.ok(illuminatedFraction(f) > 0.98);
  const ll = lonLatOf(f, f.a); assert.ok(Math.abs(ll.lonE - 0) < 1e-6 || Math.abs(ll.lonE - 360) < 1e-6);    // el punto subplanetario es la longitud 0
});
test('Nereida gira (sin sincronía): su eje a cambia con el tiempo; Titán no tiene mapa pero sí aspecto', () => {
  const n = SAT_PLUGINS.find((p) => p.planet === 'Neptuno'), m = n.moons.find((q) => q.key === 'Nereid');
  const f1 = moonFrame(n, m, planetAt(30), sun, JD), f2 = moonFrame(n, m, planetAt(30), sun, JD + 0.1); assert.ok(dot(f1.a, f2.a) < 0.99);
  assert.ok(!MOON_MAPS.Titan && LOOK.Titan);
});

test('Mapas: cada mapa declarado como presente existe en public/moons y los demás no se piden', async () => {
  const { existsSync } = await import('node:fs'), { PRESENT } = await import('../src/satellites/maps.mjs');
  for (const k of PRESENT) assert.ok(existsSync(new URL(`../public/moons/${MOON_MAPS[k].file}`, import.meta.url)), k);
});
