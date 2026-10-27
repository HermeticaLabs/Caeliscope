// Matemática de teselas de mapa (Web Mercator, esquema XYZ estándar): conversión con latitud/longitud, nivel de zoom y qué teselas se ven.
import { clamp, D2R } from './globe-math.mjs';

export const EARTH_R = 6371008.8, EQUATOR_M = 40075016.686, TILE_PX = 256, MAX_LAT = 85.0511287798;
export const lonToX = (lon, z) => ((lon + 180) / 360) * 2 ** z;
export const latToY = (lat, z) => { const p = clamp(lat, -MAX_LAT, MAX_LAT) * D2R; return ((1 - Math.asinh(Math.tan(p)) / Math.PI) / 2) * 2 ** z; };
export const xToLon = (x, z) => (x / 2 ** z) * 360 - 180;
export const yToLat = (y, z) => Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) / D2R;
export function tileBounds(z, x, y) { return { lon0: xToLon(x, z), lon1: xToLon(x + 1, z), latN: yToLat(y, z), latS: yToLat(y + 1, z) }; }
export const wrapX = (x, z) => ((x % 2 ** z) + 2 ** z) % 2 ** z;
export const tileKey = (z, x, y) => `${z}/${x}/${y}`;

// Nivel de zoom cuyo píxel de tesela mide a lo sumo ~1.3 veces el píxel de pantalla en el suelo.
export function zoomForGround(metersPerPx, lat, minZ = 0, maxZ = 8) {
  const z = Math.ceil(Math.log2((EQUATOR_M * Math.max(Math.cos(lat * D2R), 0.2)) / (TILE_PX * metersPerPx)) - 0.35);
  return clamp(z, minZ - 1, maxZ);
}
export function groundMetersPerPx(distToSurface, fovDeg, heightPx) { return (distToSurface * 2 * Math.tan((fovDeg * D2R) / 2) * EARTH_R) / heightPx; }

// Teselas de un nivel que tocan los puntos muestreados en pantalla, más un anillo de vecinas.
export function tilesForSamples(samples, z, ring = 1) {
  const n = 2 ** z, out = new Map();
  for (const s of samples) {
    const cx = Math.floor(lonToX(s.lon, z)), cy = clamp(Math.floor(latToY(s.lat, z)), 0, n - 1);
    for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
      const y = cy + dy; if (y < 0 || y >= n) continue;
      const x = wrapX(cx + dx, z), k = tileKey(z, x, y); if (!out.has(k)) out.set(k, { z, x, y });
    }
  }
  return [...out.values()];
}
