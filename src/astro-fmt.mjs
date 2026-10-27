// Formato de coordenadas y cálculos de la ficha de objeto (puros, sin dependencias).
const D2R = Math.PI / 180;
const pad = (n, w = 2) => String(n).padStart(w, '0');

// Ascensión recta en grados -> "00h 44m 30.7s"
export function fmtHMS(deg) {
  let t = Math.round((((deg % 360) + 360) % 360) / 15 * 36000);   // décimas de segundo de tiempo
  if (t >= 864000) t -= 864000;
  const h = Math.floor(t / 36000), m = Math.floor((t % 36000) / 600), s = (t % 600) / 10;
  return `${pad(h)}h ${pad(m)}m ${pad(s.toFixed(1), 4)}s`;
}

// Ángulo en grados -> "+01° 50′ 05.8″" (signed=false para azimut, con wide=3 -> "075°")
export function fmtDMS(deg, signed = true, wide = 2) {
  const t = Math.round(Math.abs(deg) * 36000);
  const d = Math.floor(t / 36000), m = Math.floor((t % 36000) / 600), s = (t % 600) / 10;
  return `${signed ? (deg < 0 ? '-' : '+') : ''}${pad(d, wide)}° ${pad(m)}′ ${pad(s.toFixed(1), 4)}″`;
}

export function elongationDeg(ra1, dec1, ra2, dec2) {
  const [a1, d1, a2, d2] = [ra1, dec1, ra2, dec2].map((v) => v * D2R);
  const c = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(a1 - a2);
  return Math.acos(Math.max(-1, Math.min(1, c))) / D2R;
}

// Fase de un planeta a partir de lo que entrega el motor: distancia geocéntrica, distancia del Sol y elongación.
// Triángulo Tierra-Sol-planeta: r^2 = delta^2 + R^2 - 2 delta R cos(elongación).
export function planetPhase(delta, R, elongDeg) {
  const r = Math.sqrt(Math.max(0, delta * delta + R * R - 2 * delta * R * Math.cos(elongDeg * D2R)));
  const cosI = Math.max(-1, Math.min(1, (r * r + delta * delta - R * R) / (2 * r * delta)));
  return { r, phaseAngle: Math.acos(cosI) / D2R, illum: (1 + cosI) / 2 };
}

// Refracción de Saemundsson (la misma que usa Caelis): altura geométrica -> corrección en grados.
export function refractionDeg(altDeg) {
  if (altDeg < -1) return 0;
  return 1.02 / Math.tan((altDeg + 10.3 / (altDeg + 5.11)) * D2R) / 60;
}

// Orto y ocaso a partir de alturas muestreadas cada stepMs desde startMs; h0 = altura del horizonte efectivo.
export function riseSetFromSamples(alts, startMs, stepMs, h0) {
  let rise = null, set = null;
  for (let i = 0; i < alts.length - 1; i++) {
    const a = alts[i] - h0, b = alts[i + 1] - h0;
    if (a < 0 && b >= 0 && rise === null) rise = startMs + (i + a / (a - b)) * stepMs;
    if (a >= 0 && b < 0 && set === null) set = startMs + (i + a / (a - b)) * stepMs;
  }
  if (rise === null && set === null) return { rise, set, state: alts[0] >= h0 ? 'siempre' : 'nunca' };
  return { rise, set, state: null };
}
