import test from 'node:test';
import assert from 'node:assert/strict';
import { angularRadius, apparentDiameterArcsec, centralMeridianTurns, discFrame, illuminatedFraction, sunFromBody, PLANET_DATA } from '../src/planet-math.mjs';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('diámetros aparentes típicos', () => {
  near(apparentDiameterArcsec('Jupiter', 4.2), 46.8, 0.8);     // Júpiter cerca de la oposición ~ 47"
  near(apparentDiameterArcsec('Marte', 0.5), 18.7, 0.5);
  near(apparentDiameterArcsec('Venus', 0.28), 59.5, 1.5);
  near(angularRadius(PLANET_DATA.Sol.km, 1) * (180 / Math.PI) * 60, 16, 0.1);   // radio del Sol ~ 16'
});

test('el meridiano central avanza con el signo de la rotación', () => {
  const a = centralMeridianTurns('Jupiter', 2461000), b = centralMeridianTurns('Jupiter', 2461000 + 0.41354 / 4);
  near((((b - a) % 1) + 1) % 1, 0.75, 1e-6);                   // prograda: el meridiano central retrocede un cuarto de vuelta
  const c = centralMeridianTurns('Venus', 2461000), d = centralMeridianTurns('Venus', 2461000 + 243.0185 / 4);
  near((((d - c) % 1) + 1) % 1, 0.25, 1e-6);                   // retrógrada: avanza
  assert.ok(centralMeridianTurns('Marte', 2461234.5) >= 0 && centralMeridianTurns('Marte', 2461234.5) < 1);
});

// Marco: derecha = +x, arriba = +y, el cuerpo está en -z de la cámara (mira hacia -z), así que "hacia nosotros" es +z.
const SX = [1, 0, 0], SY = [0, 1, 0], DIR = [0, 0, -1];

test('luna llena / nueva / cuarto según donde esté el Sol', () => {
  // cuerpo a 1 UA, Sol detrás de nosotros (en +z)
  let f = discFrame(SX, SY, DIR, sunFromBody(DIR, 1, [0, 0, 1], 1), [0, 1, 0]);
  near(illuminatedFraction(f.L), 1);                              // Sol detrás de nosotros: lleno
  near(f.L[2], 1);
  // Sol justo detrás del cuerpo respecto a nosotros: nuevo
  f = discFrame(SX, SY, DIR, sunFromBody(DIR, 1, [0, 0, -1], 3), [0, 1, 0]);
  near(f.L[2], -1);
  near(illuminatedFraction(f.L), 0);
  // Sol a la derecha, a la misma distancia: el cuerpo en -z y el Sol en +x a 1 UA → luz casi lateral desde la derecha
  f = discFrame(SX, SY, DIR, [1, 0, 0], [0, 1, 0]);
  near(f.L[0], 1); near(illuminatedFraction(f.L), 0.5);
});

test('el polo se expresa en el marco del disco', () => {
  const f = discFrame(SX, SY, DIR, [0, 0, 1], [0, 0, 1]);      // polo apuntando al observador
  near(f.N[2], 1);
  const g = discFrame(SX, SY, DIR, [0, 0, 1], [0, 2, 0]);      // polo hacia arriba (se normaliza)
  near(g.N[1], 1);
});

test('Venus interior: fase creciente cuando el Sol queda a un lado y más lejos', () => {
  // Venus a 0.5 UA hacia -z; Sol a 1 UA formando 40° con la línea de visión
  const th = (40 * Math.PI) / 180, sunDir = [Math.sin(th), 0, -Math.cos(th)];
  const f = discFrame(SX, SY, DIR, sunFromBody(DIR, 0.5, sunDir, 1), [0, 1, 0]);
  assert.ok(f.L[2] > -1 && f.L[2] < 1);
  assert.ok(f.L[0] > 0.5);                                      // el lado iluminado es el derecho
});
