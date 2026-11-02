// Alcances de trayectoria por astro, ciclos sinódicos, rosetas, etiquetas de fecha y color de retrogradación. Funciones puras, con prueba.
export const DAY = 86400000;

// Período sinódico (días) y cantidad de ciclos sinódicos que cierran (aprox.) la roseta completa.
export const SYNODIC = { Luna: 29.530589, Mercurio: 115.8775, Venus: 583.9214, Marte: 779.9361, Jupiter: 398.884, Saturno: 378.0919, Urano: 369.656, Neptuno: 367.4867 };
export const ROSETTE_CYCLES = { Mercurio: 22, Venus: 5, Marte: 7, Jupiter: 11, Saturno: 28, Urano: 83, Neptuno: 164 };
export const BODY_ORDER = ['Sol', 'Luna', 'Mercurio', 'Venus', 'Marte', 'Jupiter', 'Saturno', 'Urano', 'Neptuno'];

// Alcances disponibles para cada astro, en orden de menú.
export function rangesFor(body) {
  if (body === 'Sol') return ['12h', '3m', '6m', 'ana'];
  if (body === 'Luna') return ['12h', '3m', '6m', 'syn'];
  return ROSETTE_CYCLES[body] ? ['12h', '3m', '6m', 'syn', 'ros'] : ['12h', '3m', '6m'];
}
export const isRange = (body, id) => rangesFor(body).includes(id);
export const cycleDays = (body, id) => (id === 'syn' ? SYNODIC[body] : id === 'ros' ? SYNODIC[body] * ROSETTE_CYCLES[body] : id === 'ana' ? 365.2422 : null);

// Configuración de cálculo: step (ms entre puntos), half (puntos a cada lado del centro), bucket (ms tras los cuales se recalcula),
// long (true = coordenadas ecuatoriales de la fecha, contra las estrellas), anchored (true = ancla fija al crearla: analema).
export function rangeConfig(body, id) {
  if (id === '3m') return { long: true, step: DAY, half: 90, bucket: DAY, anchored: false };
  if (id === '6m') return { long: true, step: DAY, half: 180, bucket: DAY, anchored: false };
  if (id === 'syn') { const span = SYNODIC[body] * DAY; return { long: true, step: span / 240, half: 120, bucket: span / 8, anchored: false }; }
  if (id === 'ros') {
    const span = SYNODIC[body] * ROSETTE_CYCLES[body] * DAY, step = Math.max(DAY, span / 3000);
    return { long: true, step, half: Math.round(span / step / 2), bucket: span / 8, anchored: false };
  }
  if (id === 'ana') return { long: false, step: DAY, half: 183, bucket: Infinity, anchored: true };   // mismo instante del día, un año
  return { long: false, step: 600000, half: 72, bucket: 6 * 3600000, anchored: false };               // '12h'
}
export const usesModal = (id) => id === 'syn' || id === 'ros' || id === 'ana';

// Normaliza el mapa de alcances guardado: solo astros y alcances válidos.
export function parseRanges(o) {
  const out = {};
  if (o && typeof o === 'object') for (const b of BODY_ORDER) if (typeof o[b] === 'string' && isRange(b, o[b]) && o[b] !== '12h') out[b] = o[b];
  return out;
}

// ¿Retrogradando? La ascensión recta disminuye entre el punto anterior y el siguiente (envolviendo 0/360).
const wrap180 = (x) => ((x + 540) % 360) - 180;
export function retroFlags(ras) {
  return ras.map((_, i) => { const a = ras[Math.max(0, i - 1)], b = ras[Math.min(ras.length - 1, i + 1)]; return wrap180(b - a) < 0; });
}
// Estaciones: índices donde cambia el sentido (directo -> retro = 'R', retro -> directo = 'D').
export function stations(flags) {
  const out = [];
  for (let i = 1; i < flags.length; i++) if (flags[i] !== flags[i - 1]) out.push({ i, kind: flags[i] ? 'R' : 'D' });
  return out;
}

// Color de retrogradación: mismo tono familiar del cuerpo, desplazado y más luminoso para distinguirlo. rgb en 0..1.
export function retroColor(rgb) {
  const [r, g, b] = rgb, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-9) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 150) % 360;                                  // giro de tono grande, pero sobre el mismo brillo del cuerpo
  const l = Math.min(0.72, Math.max(0.58, (mx + mn) / 2)), s = 0.85, c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [a, bb, cc] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [a + m, bb + m, cc + m];
}

// Plan de marcas de fecha para un intervalo: { unit, k } con a lo más ~14 marcas.
export function tickPlan(spanMs) {
  const d = spanMs / DAY;
  if (d <= 2) return { unit: 'hour', k: 3 };
  if (d <= 60) return { unit: 'day', k: d <= 20 ? 2 : 5 };
  if (d <= 400) return { unit: 'month', k: 1 };
  const y = d / 365.25;
  if (y <= 14) return { unit: 'year', k: 1 };
  for (const k of [2, 5, 10, 20, 50]) if (y / k <= 14) return { unit: 'year', k };
  return { unit: 'year', k: 100 };
}
export function tickTimes(t0, t1, plan = tickPlan(t1 - t0)) {
  const out = [], { unit, k } = plan;
  if (unit === 'hour' || unit === 'day') {
    const s = (unit === 'hour' ? 3600000 : DAY) * k;
    for (let t = Math.ceil(t0 / s) * s; t <= t1; t += s) out.push(t);
  } else if (unit === 'month') {
    const d = new Date(t0); let y = d.getUTCFullYear(), m = d.getUTCMonth();
    for (let t = Date.UTC(y, m, 1); t <= t1; m += k, t = Date.UTC(y, m, 1)) if (t >= t0) out.push(t);
  } else {
    let y = Math.ceil(new Date(t0).getUTCFullYear() / k) * k;
    for (let t = Date.UTC(y, 0, 1); t <= t1; y += k, t = Date.UTC(y, 0, 1)) if (t >= t0) out.push(t);
  }
  return out.slice(0, 40);
}

// Geocéntrico, longitud eclíptica fija respecto de las estrellas (Tierra al centro, 0° a la derecha, antihorario visto desde el norte eclíptico).
// Así Venus dibuja su roseta de 5 pétalos en 8 años: 13 órbitas suyas contra 8 de la Tierra = 5 conjunciones inferiores.
export const wrap360 = (x) => ((x % 360) + 360) % 360;
export function rosettePoint(lonDeg, r) { const a = (lonDeg * Math.PI) / 180; return [r * Math.cos(a), r * Math.sin(a)]; }

// Escala común para dibujar una lista de puntos [x,y] dentro de un cuadrado de `size` px (con `pad`), manteniendo la proporción.
export function fitPoints(pts, size, pad, extra = []) {
  let mx = 1e-9;
  for (const p of [...pts, ...extra]) mx = Math.max(mx, Math.abs(p[0]), Math.abs(p[1]));
  const k = (size / 2 - pad) / mx;
  return { k, cx: size / 2, cy: size / 2, to: (p) => [size / 2 + p[0] * k, size / 2 - p[1] * k] };
}
