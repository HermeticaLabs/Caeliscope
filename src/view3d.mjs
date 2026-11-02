// Vista 3D de una geometría de ciclo completo: rotación en X, Y y Z, zoom y vistas fijas. Ortográfica, sobre un canvas 2D. Funciones puras, con prueba.
// Mundo: x a la derecha, y hacia arriba en el dibujo plano, z fuera del plano (norte eclíptico).
const D2R = Math.PI / 180, clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const CENTER = { yaw: -28, pitch: 52, zoom: 1 };
export const PRESETS = { top: { yaw: 0, pitch: 0 }, front: { yaw: 0, pitch: 90 }, side: { yaw: 90, pitch: 90 } };
// pitch 0 = vista desde arriba (plano XY); 90 = de canto (plano XZ). yaw gira alrededor de Z.
export function project(p, v) {
  const y = v.yaw * D2R, q = v.pitch * D2R, x1 = p[0] * Math.cos(y) - p[1] * Math.sin(y), y1 = p[0] * Math.sin(y) + p[1] * Math.cos(y);
  return { x: x1, up: y1 * Math.cos(q) + p[2] * Math.sin(q), depth: p[2] * Math.cos(q) - y1 * Math.sin(q) };
}
export const orbit = (v, dx, dy) => ({ ...v, yaw: ((v.yaw + dx * 0.6) % 360 + 360) % 360, pitch: clamp(v.pitch - dy * 0.6, -90, 90) });
export const zoomBy = (v, wheel) => ({ ...v, zoom: clamp(v.zoom * Math.exp(-wheel * 0.0015), 0.4, 8) });
// Exageración de Z para que la inclinación del plano se vea: ≥1, con tope. Devuelve 1 si no hace falta.
export function autoZ(pts) {
  let mxy = 1e-12, mz = 0; for (const p of pts) { mxy = Math.max(mxy, Math.abs(p[0]), Math.abs(p[1])); mz = Math.max(mz, Math.abs(p[2])); }
  return mz < 1e-12 ? 1 : clamp(Math.round((0.25 * mxy) / mz), 1, 80);
}
export const extent = (pts) => { let m = 1e-12; for (const p of pts) m = Math.max(m, Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2])); return m; };
