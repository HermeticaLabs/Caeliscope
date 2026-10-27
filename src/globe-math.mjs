// Matemática pura del globo (sin Three.js): coordenadas, selección con el ratón, Sol subsolar y recorrido del viaje.
// Convención de ejes (coincide con la esfera de Three.js con su textura equirectangular): el meridiano 0 mira a +x,
// el norte es +y y el este crece hacia -z.
export const D2R = Math.PI / 180;
export const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function latLonToVec(lat, lon) {
  const p = lat * D2R, l = lon * D2R;
  return [Math.cos(p) * Math.cos(l), Math.sin(p), -Math.cos(p) * Math.sin(l)];
}
export function vecToLatLon(v) {
  const n = Math.hypot(v[0], v[1], v[2]);
  return { lat: Math.asin(clamp(v[1] / n, -1, 1)) / D2R, lon: Math.atan2(-v[2], v[0]) / D2R };
}
export function northTangent(lat, lon) { // vector unitario tangente a la esfera que apunta al norte
  const p = lat * D2R, l = lon * D2R;
  return [-Math.sin(p) * Math.cos(l), Math.cos(p), Math.sin(p) * Math.sin(l)];
}
export function rayHitSphere(o, d, r = 1) { // primer punto de la esfera que toca el rayo, o null
  const b = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
  const c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - r * r;
  const disc = b * b - c; if (disc < 0) return null;
  const t = -b - Math.sqrt(disc); if (t < 0) return null;
  return [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
}
export function subsolarPoint(raDeg, decDeg, gmstDeg) { return { lat: decDeg, lon: wrap180(raDeg - gmstDeg) }; }
export function panPerPx(d, fovDeg, heightPx) { // radianes de superficie por píxel en el centro de la pantalla
  return (2 * (d - 1) * Math.tan((fovDeg * D2R) / 2)) / heightPx;
}

// Recorrido de la cámara hacia el suelo (s de 0 a 1): se acerca, apunta al horizonte y queda a ras de la atmósfera.
export const GROUND_D = 1.02;
export function journeyPose(s, from, pin) {
  const e = easeInOut(clamp(s, 0, 1)), m = smoothstep(0, 0.55, s);
  const d = from.d * Math.pow(GROUND_D / from.d, e);
  const lat = from.lat + (pin.lat - from.lat) * m, lon = wrap180(from.lon + wrap180(pin.lon - from.lon) * m);
  const P = latLonToVec(pin.lat, pin.lon), N = northTangent(pin.lat, pin.lon), b = smoothstep(0.55, 1, s);
  return { d, lat, lon, look: [(P[0] + 0.9 * N[0]) * b, (P[1] + 0.9 * N[1]) * b, (P[2] + 0.9 * N[2]) * b], lookBlend: b };
}
// Color de la cortina de transición según la altura del Sol en el destino (día azul claro, noche casi negro).
export function fadeColor(sunAltDeg) {
  const t = smoothstep(-8, 4, sunAltDeg), A = [3, 5, 12], B = [96, 150, 214];
  return A.map((a, i) => Math.round(a + (B[i] - a) * t));
}
