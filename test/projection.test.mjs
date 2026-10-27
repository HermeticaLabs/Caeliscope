import test from 'node:test';
import assert from 'node:assert/strict';
import { viewBasis, focalPx, projectDir, unprojectPx, localFrame, maxFov } from '../src/projection.mjs';
import { dirFromAltAz } from '../src/sky-math.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} vs ${b}`);
const D2R = Math.PI / 180;

test('la base de la vista es ortonormal y el Este queda a la derecha mirando al Norte', () => {
  const b = viewBasis(0, 20);
  const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
  close(dot(b.fwd, b.right), 0, 1e-12, 'f.r'); close(dot(b.fwd, b.up), 0, 1e-12, 'f.u'); close(dot(b.right, b.up), 0, 1e-12, 'r.u');
  const e = projectDir(viewBasis(0, 0), 0, 500, dirFromAltAz(0, 30));   // 30° al Este del Norte
  assert.ok(e.x > 0 && Math.abs(e.y) < 1e-9);
  const z = projectDir(viewBasis(0, 0), 0, 500, dirFromAltAz(30, 0));   // 30° sobre el horizonte
  assert.ok(z.y > 0);
  const zen = viewBasis(123, 90);                                         // mirando al cenit: base bien definida
  close(Math.hypot(...zen.up), 1, 1e-12, 'up en el cenit');
});

for (const mode of [0, 1, 2]) {
  test(`modo ${mode}: proyectar y desproyectar devuelve la misma dirección`, () => {
    const b = viewBasis(75, 33), f = focalPx(mode, 90, 800);
    for (const [alt, az] of [[33, 75], [10, 120], [60, 20], [-5, 100], [40, 150]]) {
      const d = dirFromAltAz(alt, az), p = projectDir(b, mode, f, d);
      if (!p) continue;
      const q = unprojectPx(b, mode, f, p.x, p.y);
      for (let i = 0; i < 3; i++) close(q[i], d[i], 1e-9, `modo ${mode} (${alt},${az})`);
    }
  });
  test(`modo ${mode}: el campo vertical llena exactamente la altura de la pantalla`, () => {
    const b = viewBasis(0, 0), fov = mode === 2 ? 80 : 120, f = focalPx(mode, fov, 900);
    const p = projectDir(b, mode, f, dirFromAltAz(fov / 2, 0));
    close(p.y, 450, 1e-6, 'borde superior'); close(p.x, 0, 1e-9, 'x');
  });
}

// Deformación local: razón entre la escala tangencial y la radial de un círculo pequeño a θ del centro de la vista.
function distortion(mode, thetaDeg) {
  const b = viewBasis(0, 0), f = 500, eps = 1e-4;
  const at = (alt, az) => projectDir(b, mode, f, dirFromAltAz(alt, az));
  const th = thetaDeg;                                   // objeto sobre el meridiano: radial = altura, tangencial = azimut
  const c = at(th, 0), r1 = at(th + eps / D2R, 0), t1 = at(th, 0);                // radial
  const radial = Math.hypot(r1.x - c.x, r1.y - c.y) / eps;
  const az = eps / D2R / Math.cos(th * D2R);                                        // un paso de longitud eps sobre la esfera
  const t2 = at(th, az), tang = Math.hypot(t2.x - t1.x, t2.y - t1.y) / eps;
  return tang / radial;
}

test('la estereográfica es conforme: a 70° del centro los objetos siguen redondos', () => {
  close(distortion(0, 70), 1, 0.002, 'estereográfica');
  close(distortion(0, 20), 1, 0.002, 'estereográfica 20°');
});
test('la perspectiva rectilínea sí ovala los objetos hacia los bordes (el defecto que se veía antes)', () => {
  const d = distortion(2, 60);
  assert.ok(d > 1.8 || d < 0.56, `razón ${d}`);       // a 60° estira x2 en una dirección
});
test('el ojo de pez equidistante deforma poco a 70°, mucho menos que la perspectiva', () => {
  const d = Math.abs(Math.log(distortion(1, 70))), p = Math.abs(Math.log(distortion(2, 70)));
  assert.ok(d < p / 2, `${d} vs ${p}`);
});

test('el marco local apunta al cenit, también en el cenit exacto', () => {
  const f = localFrame(dirFromAltAz(30, 120));
  assert.ok(f.up[1] > 0.8);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  close(dot(f.up, dirFromAltAz(30, 120)), 0, 1e-12, 'perpendicular');
  close(Math.hypot(...localFrame([0, 1, 0]).right), 1, 1e-12, 'cenit');
  assert.equal(maxFov(2), 120);
});
