// Satélites sobre el cielo: posición aparente respecto del centro del planeta (este, norte, línea de visión), con tránsito, ocultación, eclipse por la sombra del planeta
// y sombra de la luna sobre el disco del planeta. El planeta es un esferoide achatado. Se apoya solo en lo que el motor ya resuelve del planeta y del Sol (ra, dec, distancia).
import { moonPositionKm } from './orbits.mjs';

const D2R = Math.PI / 180, AU_KM = 149597870.7, ARCSEC = 206264.806;
const eq = (ra, dec, r) => [r * Math.cos(dec * D2R) * Math.cos(ra * D2R), r * Math.cos(dec * D2R) * Math.sin(ra * D2R), r * Math.sin(dec * D2R)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const n = norm(a); return a.map((c) => c / n); }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ¿El punto p (km, planeta en el origen) cae dentro de la silueta del esferoide (radio ecuatorial R, achatamiento f, eje polar n) vista a lo largo de la dirección d?
// La silueta es una elipse: semieje mayor R (perpendicular al eje proyectado) y menor b = sqrt(Rp²·cos²B + R²·sin²B), con sen B = n·d.
export function insideSilhouette(p, d, n, R, f) {
  const k = dot(p, d), q = [p[0] - k * d[0], p[1] - k * d[1], p[2] - k * d[2]], sB = Math.abs(dot(n, d)), Rp = R * (1 - f), b = Math.sqrt(Rp * Rp * (1 - sB * sB) + R * R * sB * sB);
  const pr = [n[0] - dot(n, d) * d[0], n[1] - dot(n, d) * d[1], n[2] - dot(n, d) * d[2]], pn = norm(pr);
  if (pn < 1e-9) return norm(q) < R;                                                    // visto desde el polo: un círculo
  const m = pr.map((c) => c / pn), M = cross(d, m), u = dot(q, M), v = dot(q, m);
  return (u / R) ** 2 + (v / b) ** 2 < 1;
}

// Punto de la superficie del esferoide donde la sombra de la luna (en p, con el Sol en la dirección toSun) toca al planeta; null si no lo toca.
export function shadowSpot(p, toSun, n, R, f) {
  const s = 1 / (1 - f), sc = (v) => { const h = dot(v, n); return [v[0] + (s - 1) * h * n[0], v[1] + (s - 1) * h * n[1], v[2] + (s - 1) * h * n[2]]; };   // esferoide -> esfera de radio R
  const o = sc(p), dir = sc(toSun.map((c) => -c)), A = dot(dir, dir), B = 2 * dot(o, dir), C = dot(o, o) - R * R, disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A); if (t <= 0) return null;
  return [p[0] - t * toSun[0], p[1] - t * toSun[1], p[2] - t * toSun[2]];
}

// Cuánto tapan los anillos (opacidad 0..1) a un punto p (km, planeta en el origen) visto desde la Tierra: los anillos son el plano ecuatorial del planeta; tapan si el rayo
// observador → luna cruza el plano dentro de algún anillo ANTES de llegar a la luna (la luna está detrás de ellos).
export function ringCover(p, d, n, rings) {
  const dn = dot(d, n); if (Math.abs(dn) < 1e-9) return 0;
  const t = -dot(p, n) / dn; if (t >= 0) return 0;                                      // el plano queda del lado de la luna que mira lejos de la Tierra: no tapa
  const q = [p[0] + t * d[0], p[1] + t * d[1], p[2] + t * d[2]], rho = norm(q);
  let o = 0; for (const r of rings) if (rho >= r.rIn && rho <= r.rOut) o = Math.max(o, r.opacity); return o;
}

// plugin: { planet, radiusKm (ecuatorial), flattening, pole: [ra, dec], moons: [{ key, elements }] }; planet/sun: cuerpos con ra_deg, dec_deg, dist_au
export function moonsOnSky(plugin, planet, sun, jd) {
  const a = planet.ra_deg * D2R, d = planet.dec_deg * D2R, dist = planet.dist_au * AU_KM;
  const los = eq(planet.ra_deg, planet.dec_deg, 1);                                     // de la Tierra hacia el planeta
  const east = [-Math.sin(a), Math.cos(a), 0], north = [-Math.cos(a) * Math.sin(d), -Math.sin(a) * Math.sin(d), Math.cos(d)];
  const toSun = unit(sub(eq(sun.ra_deg, sun.dec_deg, sun.dist_au * AU_KM), eq(planet.ra_deg, planet.dec_deg, dist)));   // del planeta al Sol
  const R = plugin.radiusKm, f = plugin.flattening || 0, pole = eq(plugin.pole[0], plugin.pole[1], 1), diskArcsec = (R / dist) * ARCSEC;
  return plugin.moons.map((m) => {
    const p = moonPositionKm(m.elements, jd), x = dot(p, east), y = dot(p, north), z = dot(p, los);   // z > 0: más lejos que el planeta
    const proj = Math.hypot(x, y), behind = z > 0, onDisk = insideSilhouette(p, los, pole, R, f);
    const sunSide = dot(p, toSun);
    const sh = shadowSpot(p, toSun, pole, R, f);
    const shadowVisible = !!sh && dot(sh, los) < 0;                                     // la mancha cae del lado que mira a la Tierra
    return {
      key: m.key, xKm: x, yKm: y, zKm: z, radiusKm: norm(p),
      dxArcsec: (x / dist) * ARCSEC, dyArcsec: (y / dist) * ARCSEC, sepArcsec: (proj / dist) * ARCSEC, sepRadii: proj / R,
      occulted: behind && onDisk, transit: !behind && onDisk,
      eclipsed: sunSide < 0 && insideSilhouette(p, toSun, pole, R, f),                  // sombra cilíndrica del planeta (el cono real se estrecha apenas a estas distancias)
      shadow: shadowVisible ? { dxArcsec: (dot(sh, east) / dist) * ARCSEC, dyArcsec: (dot(sh, north) / dist) * ARCSEC } : null,
      ringCover: plugin.rings ? ringCover(p, los, pole, plugin.rings) : 0,
      diskArcsec,
    };
  });
}
