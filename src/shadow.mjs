// Geometría de la sombra de un eclipse: conos de umbra y penumbra de la Luna (eclipse solar) o de la Tierra (eclipse lunar).
// Funciones puras que reciben cuerpos con la forma de un snapshot de Caelis (lon/lat eclípticas geocéntricas y distancia).
import { sepDeg } from './events.mjs';

const D2R = Math.PI / 180, AU_KM = 149597870.7, R_SUN = 696000, R_MOON = 1737.4, R_EARTH = 6378.14, MOON_K = 0.2725076;
const wrap360 = (x) => ((x % 360) + 360) % 360, wrap180 = (x) => wrap360(x + 180) - 180;
const lonOf = (b) => b.lon_ecl_geocentric_deg ?? b.lon_ecl_deg, latOf = (b) => b.lat_ecl_geocentric_deg ?? b.lat_ecl_deg;
const vec = (lon, lat, r) => [r * Math.cos(lat * D2R) * Math.cos(lon * D2R), r * Math.cos(lat * D2R) * Math.sin(lon * D2R), r * Math.sin(lat * D2R)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => { const n = norm(a); return [a[0] / n, a[1] / n, a[2] / n]; };

// ¿Más cerca de una conjunción (sombra de la Luna sobre la Tierra) o de una oposición (sombra de la Tierra sobre la Luna)?
export const shadowMode = (moon, sun) => (sepDeg(lonOf(moon), latOf(moon), lonOf(sun), latOf(sun)) < 90 ? 'solar' : 'lunar');

// Eclipse solar. El eje de la sombra va del centro del Sol al de la Luna; se mide a lo largo de él (a, en km desde la Luna) y a lo ancho.
// Plano fundamental: el que pasa por el centro de la Tierra perpendicular al eje; radios en radios terrestres (l2 < 0: la umbra no llega, antumbra = anular).
export function solarShadow(moon, sun) {
  const M = vec(lonOf(moon), latOf(moon), moon.dist_km), S = vec(lonOf(sun), latOf(sun), sun.dist_au * AU_KM);
  const axis = sub(M, S), Dms = norm(axis), u = unit(axis);
  const Lu = (R_MOON * Dms) / (R_SUN - R_MOON);               // largo del cono de umbra desde la Luna
  const sE = -dot(M, u);                                      // distancia a lo largo del eje de la Luna a la Tierra
  const umbraAt = (a) => R_MOON - (a * (R_SUN - R_MOON)) / Dms, penAt = (a) => R_MOON + (a * (R_SUN + R_MOON)) / Dms;
  const north = [0, 0, 1], np = unit(sub(north, u.map((c) => c * dot(north, u)))), right = cross(u, np);   // visto desde el Sol, con el norte eclíptico arriba
  const px = dot(M, right) / R_EARTH, py = dot(M, np) / R_EARTH, gamma = Math.hypot(px, py);
  const l1 = penAt(sE) / R_EARTH, l2 = umbraAt(sE) / R_EARTH;
  let kind = 'none';
  if (gamma <= 0.9972) kind = l2 > 0 ? 'total' : 'anular';
  else if (gamma < 1 + Math.abs(l2)) kind = l2 > 0 ? 'total' : 'anular';
  else if (gamma < 1 + l1) kind = 'parcial';
  return { Dms, Lu, sE, umbraAt, penAt, px, py, gamma, l1, l2, kind, rMoon: R_MOON, rEarth: R_EARTH, umbraKm: Math.abs(l2) * R_EARTH, penumbraKm: l1 * R_EARTH };
}

// Eclipse lunar: la Luna frente a la umbra y la penumbra de la Tierra, a la distancia de la Luna; todo en grados (ancho de cielo).
export function lunarShadow(moon, sun) {
  const sM0 = moon.dist_km, pm = Math.asin(R_EARTH / sM0) / D2R, ps = 8.794 / 3600 / sun.dist_au, sS = 959.63 / 3600 / sun.dist_au, sM = MOON_K * pm;
  const ru = 1.02 * (pm + ps - sS), rp = 1.02 * (pm + ps + sS);
  const dx = wrap180(lonOf(moon) - lonOf(sun) - 180), dy = latOf(moon) + latOf(sun), sep = Math.hypot(dx, dy);
  const kind = sep <= ru - sM ? 'total' : sep < ru + sM ? 'parcial' : sep < rp + sM ? 'penumbral' : 'none';
  return { ru, rp, sM, dx, dy, sep, kind, umbMag: Math.max(0, (ru + sM - sep) / (2 * sM)), penMag: Math.max(0, (rp + sM - sep) / (2 * sM)) };
}
