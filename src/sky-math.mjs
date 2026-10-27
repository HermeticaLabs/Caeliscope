// Matemática de vista del observador. Convención: azimut desde el Norte hacia el Este.
// Ejes Three.js: +x = Este, +y = cenit, -z = Norte.
const D2R = Math.PI / 180;

export function dirFromAltAz(altDeg, azDeg) {
  const a = altDeg * D2R, z = azDeg * D2R;
  return [Math.cos(a) * Math.sin(z), Math.sin(a), -Math.cos(a) * Math.cos(z)];
}

export function separationDeg(alt1, az1, alt2, az2) {
  const p = dirFromAltAz(alt1, az1), q = dirFromAltAz(alt2, az2);
  const dot = p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  return Math.acos(Math.max(-1, Math.min(1, dot))) / D2R;
}

// Un objeto está a la vista si su separación angular con el centro de la vista
// es menor que la mitad del campo de visión (vertical).
export function inView(viewAlt, viewAz, alt, az, fovDeg) {
  return separationDeg(viewAlt, viewAz, alt, az) <= fovDeg / 2;
}

const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Color de fondo del cielo según la altura del Sol (rgb 0..1).
export function skyColor(sunAltDeg) {
  const dusk = clamp01((sunAltDeg + 18) / 18);
  const day = clamp01(sunAltDeg / 12);
  const c = lerp([0.012, 0.016, 0.04], [0.1, 0.12, 0.3], dusk);
  return lerp(c, [0.35, 0.58, 0.9], day);
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const off = (a, b, k) => [a[0] - b[0] * k, a[1] - b[1] * k, a[2] - b[2] * k];
const unit = (a) => { const n = Math.hypot(...a) || 1; return a.map((v) => v / n); };

// Luz y norte lunar en coordenadas de pantalla (x derecha, y arriba, z hacia el observador).
// moonDir, sunDir, ncpDir: direcciones unitarias; right/up: ejes de la cámara.
// L = dirección de la luz sobre el disco (L.z = -cos de la elongación: +1 luna llena, -1 luna nueva).
// N = hacia dónde apunta el norte lunar en pantalla (el polo norte celeste proyectado sobre el disco).
export function moonOrientation(moonDir, sunDir, ncpDir, right, up) {
  const cosE = Math.max(-1, Math.min(1, dot(moonDir, sunDir)));
  const sinE = Math.sqrt(1 - cosE * cosE);
  const t = unit(off(sunDir, moonDir, cosE));
  const dx = dot(t, right), dy = dot(t, up), dl = Math.hypot(dx, dy) || 1;
  const tn = unit(off(ncpDir, moonDir, dot(ncpDir, moonDir)));
  const nx = dot(tn, right), ny = dot(tn, up), nl = Math.hypot(nx, ny) || 1;
  return { L: [(sinE * dx) / dl, (sinE * dy) / dl, -cosE], N: [nx / nl, ny / nl] };
}

// Paleta del cielo según la altura del Sol: [altura, cenit, horizonte, color del resplandor, intensidad].
const KEYS = [
  [-18, [0.004, 0.006, 0.016], [0.012, 0.016, 0.035], [1, 0.45, 0.2], 0],
  [-12, [0.01, 0.02, 0.07], [0.06, 0.06, 0.14], [1, 0.45, 0.2], 0.35],
  [-6, [0.04, 0.08, 0.22], [0.35, 0.28, 0.38], [1, 0.5, 0.22], 0.8],
  [0, [0.12, 0.25, 0.55], [0.9, 0.6, 0.45], [1, 0.62, 0.3], 1],
  [10, [0.2, 0.43, 0.82], [0.74, 0.82, 0.95], [1, 0.85, 0.6], 0.5],
  [30, [0.17, 0.4, 0.8], [0.68, 0.8, 0.95], [1, 0.9, 0.7], 0.25],
];
export function skyPalette(sunAltDeg) {
  const a = Math.min(30, Math.max(-18, sunAltDeg));
  let i = 0; while (i < KEYS.length - 2 && a > KEYS[i + 1][0]) i++;
  const [a0, ...c0] = KEYS[i], [a1, ...c1] = KEYS[i + 1], t = (a - a0) / (a1 - a0);
  const mix = (x, y) => x.map((v, k) => v + (y[k] - v) * t);
  return { zenith: mix(c0[0], c1[0]), horizon: mix(c0[1], c1[1]), glow: mix(c0[2], c1[2]),
    glowA: c0[3] + (c1[3] - c0[3]) * t, night: clamp01((-12 - sunAltDeg) / 6) };
}

// Tinte del Sol y la Luna por masa de aire (Kasten-Young): enrojecen al acercarse al horizonte.
export function extinction(altDeg) {
  const h = Math.max(altDeg, -1);
  const X = 1 / (Math.sin(h * D2R) + 0.50572 * Math.pow(h + 6.07995, -1.6364));
  const T = [0.03, 0.07, 0.14].map((k) => Math.exp(-k * (X - 1)));
  const m = Math.max(...T);
  return T.map((v) => v / m);
}

// Durante un eclipse solar casi total el cielo se parece al crepúsculo profundo: el Sol sigue alto pero casi no llega luz.
// dark (0..1) viene de eclipseDarkness(); devuelve la altura "efectiva" del Sol para la paleta del cielo y el brillo de las estrellas.
export const EFFECTIVE_TOTALITY_ALT = -7;
export const eclipseAlt = (sunAltDeg, dark) => sunAltDeg * (1 - dark) + EFFECTIVE_TOTALITY_ALT * dark;
