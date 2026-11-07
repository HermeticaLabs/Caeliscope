// Forma y orientación de cada luna: semiejes del elipsoide triaxial, eje norte, rotación sincrónica y geometría de iluminación vista desde la Tierra.
// Todo en vectores ecuatoriales (ICRF), la misma base que usa orbits.mjs. Funciones puras: no tocan el navegador.
import { moonPositionKm } from './orbits.mjs';

const D2R = Math.PI / 180, AU_KM = 149597870.7;
// Semiejes en km: a apunta al planeta, b va a lo largo de la órbita, c es el eje polar (literatura: Thomas 2010, Archinal et al. 2018).
export const SHAPES = {
  Fobos: { a: 13.03, b: 11.4, c: 9.14 }, Deimos: { a: 7.8, b: 6.0, c: 5.1 },
  Io: { a: 1829.4, b: 1819.4, c: 1815.7 }, Europa: { a: 1562.6, b: 1560.3, c: 1559.5 }, Ganimedes: { a: 2632.4, b: 2632.3, c: 2632.3 }, Calisto: { a: 2410.3, b: 2410.3, c: 2410.3 },
  Mimas: { a: 207.8, b: 196.7, c: 190.6 }, Encelado: { a: 256.6, b: 251.4, c: 248.3 }, Tetis: { a: 538.4, b: 528.3, c: 526.3 }, Dione: { a: 563.4, b: 561.3, c: 559.6 }, Rea: { a: 765.0, b: 763.1, c: 762.4 }, Titan: { a: 2575, b: 2575, c: 2575 },
  Miranda: { a: 240.4, b: 234.2, c: 232.9 }, Ariel: { a: 581.1, b: 577.9, c: 577.7 }, Umbriel: { a: 584.7, b: 584.7, c: 584.7 }, Titania: { a: 788.9, b: 788.9, c: 788.9 }, Oberon: { a: 761.4, b: 761.4, c: 761.4 },
  Triton: { a: 1353.4, b: 1353.4, c: 1353.4 }, Nereid: { a: 180, b: 170, c: 150, spinDays: 0.48 },   // Nereida no está en rotación sincrónica; su período (~11,5 h) es incierto: solo aproximado
};
// Norte de cada luna (convención IAU): el de la órbita, salvo en Tritón y las lunas de Urano, que giran en sentido retrógrado respecto de su planeta.
export const NORTH_SIGN = { Urano: -1, Neptuno: -1 };

const eq = (ra, dec, r = 1) => [r * Math.cos(dec * D2R) * Math.cos(ra * D2R), r * Math.cos(dec * D2R) * Math.sin(ra * D2R), r * Math.sin(dec * D2R)];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const norm = (u) => Math.hypot(u[0], u[1], u[2]);
const unit = (u) => { const n = norm(u); return [u[0] / n, u[1] / n, u[2] / n]; };
const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
const scale = (u, k) => [u[0] * k, u[1] * k, u[2] * k];

// Marco de la luna: a (hacia el planeta), b (este en longitud 0), c (norte), más las direcciones a la Tierra y al Sol vistas desde la luna.
export function moonFrame(plugin, def, planet, sun, jd) {
  const el = def.elements, p = moonPositionKm(el, jd), p1 = moonPositionKm(el, jd + 0.01), h = cross(p, sub(p1, p));
  const north = scale(unit(h), NORTH_SIGN[plugin.planet] || 1);
  let a = scale(unit(p), -1), b = cross(north, a);
  const sh = SHAPES[def.key] || { a: def.meanRadiusKm, b: def.meanRadiusKm, c: def.meanRadiusKm };
  if (sh.spinDays) {                                                       // sin sincronía: gira alrededor del norte
    const th = ((jd - 2451545) / sh.spinDays) * 2 * Math.PI, c0 = Math.cos(th), s0 = Math.sin(th);
    const a2 = [a[0] * c0 + b[0] * s0, a[1] * c0 + b[1] * s0, a[2] * c0 + b[2] * s0]; b = cross(north, a2); a = a2;
  }
  const dist = planet.dist_au * AU_KM, toObs = scale(eq(planet.ra_deg, planet.dec_deg, 1), -1);
  const toSun = unit(sub(eq(sun.ra_deg, sun.dec_deg, sun.dist_au * AU_KM), eq(planet.ra_deg, planet.dec_deg, dist)));
  return { a, b, c: north, toObs, toSun, shape: sh, phaseAngleDeg: Math.acos(Math.max(-1, Math.min(1, dot(toObs, toSun)))) / D2R };
}

// Longitud (este positivo) y latitud del punto de la superficie que mira en cierta dirección.
export function lonLatOf(frame, dir) {
  const x = dot(dir, frame.a), y = dot(dir, frame.b), z = dot(dir, frame.c);
  return { lonE: ((Math.atan2(y, x) / D2R) + 360) % 360, lat: Math.asin(Math.max(-1, Math.min(1, z))) / D2R };
}
export const illuminatedFraction = (frame) => (1 + Math.cos(frame.phaseAngleDeg * D2R)) / 2;
