// Buscador de eventos astronómicos sobre cualquier efeméride con la forma de un snapshot de Caelis:
// evalAt(ms) -> { bodies: { Sol, Luna } } con lon/lat eclípticas geocéntricas y distancias.
import { elongationDeg } from './astro-fmt.mjs';

const D2R = Math.PI / 180, DAY = 86400000, MOON_RATE = 12.19, SUN_RATE = 0.9856;
const wrap360 = (x) => ((x % 360) + 360) % 360;
const wrap180 = (x) => wrap360(x + 180) - 180;
const lon = (b) => b.lon_ecl_geocentric_deg ?? b.lon_ecl_deg;
const lat = (b) => b.lat_ecl_geocentric_deg ?? b.lat_ecl_deg;
const tick = () => new Promise((r) => setTimeout(r, 0));

export function sepDeg(l1, b1, l2, b2) {
  const [a, c, d, e] = [l1, b1, l2, b2].map((v) => v * D2R);
  const x = Math.sin(c) * Math.sin(e) + Math.cos(c) * Math.cos(e) * Math.cos(a - d);
  return Math.acos(Math.max(-1, Math.min(1, x))) / D2R;
}

// Raíz de f(t) (grados, envuelta) por secante, partiendo de una estimación.
function solve(f, t0, ratePerDay) {
  let t = t0, ft = f(t), tp = null, fp = null;
  for (let i = 0; i < 30 && Math.abs(ft) > 1e-7; i++) {
    let slope = ratePerDay / DAY;
    if (tp !== null && t !== tp) { const s = (ft - fp) / (t - tp); if (s > 0.2 * slope && s < 5 * slope) slope = s; }
    tp = t; fp = ft; t -= ft / slope; ft = f(t);
  }
  return t;
}

// Primer instante posterior (dir=1) o anterior (dir=-1) a startMs en que angleAt(t) = target.
function findAngle(angleAt, startMs, target, dir, rate) {
  const delta = dir > 0 ? wrap360(target - angleAt(startMs)) : wrap360(angleAt(startMs) - target);
  const span = (delta < 1e-6 ? 360 : delta) / rate * DAY;
  return solve((t) => wrap180(angleAt(t) - target), startMs + dir * span, rate);
}

// Fases: elongación eclíptica Luna - Sol = 0 (nueva), 90, 180 (llena), 270.
export function findPhase(evalAt, startMs, targetDeg, dir = 1) {
  const e = (t) => { const b = evalAt(t).bodies; return wrap360(lon(b.Luna) - lon(b.Sol)); };
  return findAngle(e, startMs, targetDeg, dir, MOON_RATE);
}

// Equinoccios y solsticios: longitud eclíptica APARENTE del Sol (con nutación y aberración, la de lon_ecl_deg) = 0, 90, 180, 270.
// La geocéntrica geométrica adelantaría el evento unos 5 minutos.
export function findSunLongitude(evalAt, startMs, targetDeg, dir = 1) {
  return findAngle((t) => { const b = evalAt(t).bodies.Sol; return wrap360(b.lon_ecl_deg ?? lon(b)); }, startMs, targetDeg, dir, SUN_RATE);
}

export function minimize(fn, a, b, iters = 40) { // sección áurea
  const g = 0.6180339887;
  let c = b - g * (b - a), d = a + g * (b - a), fc = fn(c), fd = fn(d);
  for (let i = 0; i < iters; i++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = fn(c); }
    else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = fn(d); }
  }
  return (a + b) / 2;
}

const piMoon = (km) => Math.asin(6378.14 / km) / D2R;   // paralaje horizontal lunar (grados)
const MOON_K = 0.2725076;                                // radio lunar / radio terrestre
const sunRadius = (au) => 959.63 / 3600 / au;            // semidiámetro solar (grados)

// Eclipse solar (Meeus cap. 54): gamma = distancia del eje de la sombra al centro de la Tierra, en radios terrestres.
export function solarEclipseInfo(s) {
  const m = s.bodies.Luna, u = s.bodies.Sol;
  const sep = sepDeg(lon(m), lat(m), lon(u), lat(u)), pm = piMoon(m.dist_km);
  const gamma = Math.sin(sep * D2R) / Math.sin(pm * D2R);
  if (gamma > 1.5433 + 0.0046) return null;
  const sM = MOON_K * pm, sS = sunRadius(u.dist_au);
  return { type: gamma < 0.9972 ? (sM > sS ? 'total' : 'anular') : 'parcial', gamma, sepDeg: sep };
}

// Eclipse lunar: separación Luna - centro de la sombra, con radios de umbra y penumbra (+2%).
export function lunarEclipseInfo(s) {
  const m = s.bodies.Luna, u = s.bodies.Sol;
  const sep = sepDeg(lon(m), lat(m), wrap360(lon(u) + 180), -lat(u));
  const pm = piMoon(m.dist_km), ps = 8.794 / 3600 / u.dist_au, sS = sunRadius(u.dist_au), sM = MOON_K * pm;
  const ru = 1.02 * (pm + ps - sS), rp = 1.02 * (pm + ps + sS);
  if (sep >= rp + sM) return null;
  const penMag = (rp + sM - sep) / (2 * sM);
  if (sep >= ru + sM) return { type: 'penumbral', penMag, umbMag: 0, sepDeg: sep };
  return { type: sep <= ru - sM ? 'total' : 'parcial', umbMag: (ru + sM - sep) / (2 * sM), penMag, sepDeg: sep };
}

// Siguiente (dir=1) o anterior (dir=-1) eclipse, recorriendo lunaciones sucesivas.
export async function findEclipse(evalAt, startMs, kind, dir = 1, onProgress, maxLunations = 16) {
  const target = kind === 'solar' ? 0 : 180;
  const sepAt = (t) => {
    const b = evalAt(t).bodies;
    return kind === 'solar' ? sepDeg(lon(b.Luna), lat(b.Luna), lon(b.Sol), lat(b.Sol)) : sepDeg(lon(b.Luna), lat(b.Luna), wrap360(lon(b.Sol) + 180), -lat(b.Sol));
  };
  let from = startMs;
  for (let k = 1; k <= maxLunations; k++) {
    const t = findPhase(evalAt, from, target, dir);
    const g = minimize(sepAt, t - 3 * 3600000, t + 3 * 3600000, 30);
    const s = evalAt(g), info = kind === 'solar' ? solarEclipseInfo(s) : lunarEclipseInfo(s);
    if (info) return { ms: g, kind, ...info };
    from = t + dir * DAY;
    onProgress?.(k); await tick();
  }
  return null;
}

// Circunstancias locales de un eclipse solar con las posiciones topocéntricas de Caelis (RA/Dec de la Luna ya incluyen la paralaje).
export function localSolarInfo(evalAt, centerMs) {
  const sepAt = (t) => { const b = evalAt(t).bodies; return elongationDeg(b.Luna.ra_deg, b.Luna.dec_deg, b.Sol.ra_deg, b.Sol.dec_deg); };
  const t = minimize(sepAt, centerMs - 4 * 3600000, centerMs + 4 * 3600000, 30);
  const b = evalAt(t).bodies, sep = sepAt(t);
  const sM = MOON_K * piMoon(b.Luna.dist_km), sS = sunRadius(b.Sol.dist_au);
  return { ms: t, mag: (sS + sM - sep) / (2 * sS), sepDeg: sep, sunAlt: b.Sol.alt_apparent_deg, visible: sep < sS + sM, type: sM > sS ? 'total' : 'anular', sS, sM };
}

// Qué ve el observador de un eclipse solar: 'total' o 'anular' si la Luna queda dentro del disco solar (o lo cubre) en su máximo,
// 'parcial' si solo lo muerde, o null si no toca el disco o el Sol está bajo el horizonte en el máximo.
export function localSolarKind(l) {
  if (!l.visible || l.sunAlt <= 0) return null;
  if (l.sepDeg <= Math.abs(l.sS - l.sM)) return l.sM > l.sS ? 'total' : 'anular';
  return 'parcial';
}

// Eclipse (solar o lunar) siguiente o anterior que cumpla `accept(r)`, recorriendo lunaciones sucesivas hasta `maxYears` años.
// Descarta enseguida las lunaciones donde la latitud de la Luna en la conjunción es demasiado grande para haber eclipse.
// onProgress(años recorridos) permite mostrar avance; cede el hilo cada tanto para no congelar la página.
export async function findEclipseWhere(evalAt, startMs, kind, dir, accept, maxYears = 30, onProgress) {
  const target = kind === 'solar' ? 0 : 180, limit = startMs + dir * maxYears * 365.25 * DAY;
  const sepAt = (t) => {
    const b = evalAt(t).bodies;
    return kind === 'solar' ? sepDeg(lon(b.Luna), lat(b.Luna), lon(b.Sol), lat(b.Sol)) : sepDeg(lon(b.Luna), lat(b.Luna), wrap360(lon(b.Sol) + 180), -lat(b.Sol));
  };
  let from = startMs, n = 0;
  while ((limit - from) * dir > 0) {
    const t = findPhase(evalAt, from, target, dir);
    from = t + dir * DAY;
    if ((limit - t) * dir < 0) break;
    if (++n % 12 === 0) { onProgress?.(Math.round(Math.abs(t - startMs) / (365.25 * DAY))); await tick(); }
    const bm = evalAt(t).bodies, bl = kind === 'solar' ? lat(bm.Luna) : lat(bm.Luna) + lat(bm.Sol);
    if (Math.abs(bl) > 2) continue;
    const g = minimize(sepAt, t - 3 * 3600000, t + 3 * 3600000, 30);
    const info = kind === 'solar' ? solarEclipseInfo(evalAt(g)) : lunarEclipseInfo(evalAt(g));
    if (!info) continue;
    const r = { ms: g, kind, ...info };
    if (accept(r)) return r;
  }
  return null;
}
