// Proyecciones del cielo visto desde el centro de la esfera (el observador).
// Las mismas fórmulas están en el GLSL (shaders.mjs): aquí sirven para etiquetas, clics y pruebas.
//   0 = estereográfica (conforme: los círculos siguen siendo círculos)
//   1 = equidistante (ojo de pez: la distancia en pantalla es proporcional al ángulo)
//   2 = rectilínea (perspectiva de cámara: estira y ovala los objetos hacia los bordes)
import { dirFromAltAz } from './sky-math.mjs';

export const PROJECTIONS = [
  { id: 0, name: 'Estereográfica', max: 180 },
  { id: 1, name: 'Equidistante (ojo de pez)', max: 180 },
  { id: 2, name: 'Perspectiva (rectilínea)', max: 120 },
];
export const MIN_FOV = 0.005;          // 18″: llena la pantalla con Mercurio
export const maxFov = (mode) => PROJECTIONS[mode].max;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Ejes de la vista (escena: +x Este, +y cenit, -z Norte). La cámara no tiene balanceo: el horizonte queda nivelado.
export function viewBasis(azDeg, altDeg) {
  const fwd = dirFromAltAz(altDeg, azDeg), right = dirFromAltAz(0, azDeg + 90);
  return { fwd, right, up: cross(right, fwd) };
}

// Distancia focal en píxeles para que el campo vertical (fovDeg) llene la altura de la pantalla.
export function focalPx(mode, fovDeg, heightPx) {
  const half = (fovDeg * Math.PI) / 360, h = heightPx / 2;
  if (mode === 0) return h / (2 * Math.tan(half / 2));
  if (mode === 1) return h / half;
  return h / Math.tan(half);
}

// Dirección (vector unitario) -> posición en píxeles desde el centro (x a la derecha, y hacia arriba). null si no se puede dibujar.
export function projectDir(basis, mode, f, d) {
  const cz = dot(d, basis.fwd), px = dot(d, basis.right), py = dot(d, basis.up);
  if (mode === 2) return cz <= 0.02 ? null : { x: (px / cz) * f, y: (py / cz) * f };
  const s = Math.hypot(px, py), th = Math.atan2(s, cz);
  if (th > 3.0) return null;
  const r = mode === 0 ? 2 * f * Math.tan(th / 2) : f * th;
  return s < 1e-12 ? { x: 0, y: 0 } : { x: (px / s) * r, y: (py / s) * r };
}

// Píxeles desde el centro -> dirección unitaria (inversa de projectDir).
export function unprojectPx(basis, mode, f, x, y) {
  const r = Math.hypot(x, y);
  const th = mode === 0 ? 2 * Math.atan(r / (2 * f)) : mode === 1 ? r / f : Math.atan(r / f);
  const kx = r < 1e-12 ? 0 : x / r, ky = r < 1e-12 ? 0 : y / r, c = Math.cos(th), s = Math.sin(th);
  return [0, 1, 2].map((i) => c * basis.fwd[i] + s * (kx * basis.right[i] + ky * basis.up[i]));
}

// Marco local de un objeto: derecha y arriba (hacia el cenit) en el plano tangente. Sirve para orientar discos.
export function localFrame(dir) {
  let up = [-dir[0] * dir[1], 1 - dir[1] * dir[1], -dir[2] * dir[1]];
  const n = Math.hypot(...up);
  up = n < 1e-6 ? [0, 0, -1] : up.map((v) => v / n);   // en el cenit exacto: el norte hace de "arriba"
  return { right: cross(dir, up), up };
}
