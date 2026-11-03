// Satélites sobre el cielo: posición aparente respecto del centro del planeta (este, norte, línea de visión), con tránsito, ocultación y eclipse por la sombra del planeta.
// Se apoya solo en lo que el motor ya resuelve del planeta y del Sol (ra, dec, distancia): el motor no se toca.
import { moonPositionKm } from './orbits.mjs';

const D2R = Math.PI / 180, AU_KM = 149597870.7, ARCSEC = 206264.806;
const eq = (ra, dec, r) => [r * Math.cos(dec * D2R) * Math.cos(ra * D2R), r * Math.cos(dec * D2R) * Math.sin(ra * D2R), r * Math.sin(dec * D2R)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = (a) => Math.hypot(a[0], a[1], a[2]);

// plugin: { planet, radiusKm, moons: [{ key, elements }] }; planet/sun: cuerpos con ra_deg, dec_deg, dist_au
export function moonsOnSky(plugin, planet, sun, jd) {
  const a = planet.ra_deg * D2R, d = planet.dec_deg * D2R, dist = planet.dist_au * AU_KM;
  const los = eq(planet.ra_deg, planet.dec_deg, 1);                                     // de la Tierra hacia el planeta
  const east = [-Math.sin(a), Math.cos(a), 0], north = [-Math.cos(a) * Math.sin(d), -Math.sin(a) * Math.sin(d), Math.cos(d)];
  const toSun = (() => { const v = sub(eq(sun.ra_deg, sun.dec_deg, sun.dist_au * AU_KM), eq(planet.ra_deg, planet.dec_deg, dist)); const n = norm(v); return v.map((c) => c / n); })();   // del planeta al Sol
  const R = plugin.radiusKm, diskArcsec = (R / dist) * ARCSEC;
  return plugin.moons.map((m) => {
    const p = moonPositionKm(m.elements, jd), x = dot(p, east), y = dot(p, north), z = dot(p, los);   // z > 0: más lejos que el planeta
    const proj = Math.hypot(x, y), behind = z > 0, onDisk = proj < R;
    const sunSide = dot(p, toSun), shadowDist = Math.hypot(p[0] - sunSide * toSun[0], p[1] - sunSide * toSun[1], p[2] - sunSide * toSun[2]);
    return {
      key: m.key, xKm: x, yKm: y, zKm: z, radiusKm: norm(p),
      dxArcsec: (x / dist) * ARCSEC, dyArcsec: (y / dist) * ARCSEC, sepArcsec: (proj / dist) * ARCSEC, sepRadii: proj / R,
      occulted: behind && onDisk, transit: !behind && onDisk,
      eclipsed: sunSide < 0 && shadowDist < R,                                      // sombra cilíndrica del planeta (el cono real se estrecha apenas a esta distancia)
      diskArcsec,
    };
  });
}
