// Cuadrículas y líneas de referencia como segmentos [x,y,z, x,y,z, ...] de vectores unitarios.
import { dirFromAltAz } from './sky-math.mjs';
import { equatorialVector } from './stars.mjs';

function polyline(pts, out) { for (let i = 0; i < pts.length - 1; i++) out.push(...pts[i], ...pts[i + 1]); }
const range = (a, b, s) => { const r = []; for (let v = a; v <= b + 1e-9; v += s) r.push(v); return r; };

// Cuadrícula azimutal (ejes de la escena): círculos de altura y meridianos cada 15°.
export function azimuthalGrid() {
  const out = [];
  for (const alt of range(-75, 75, 15)) polyline(range(0, 360, 3).map((az) => dirFromAltAz(alt, az)), out);
  for (const az of range(0, 345, 15)) polyline(range(-90, 90, 5).map((alt) => dirFromAltAz(alt, az)), out);
  return new Float32Array(out);
}

// Cuadrícula ecuatorial "de la fecha": paralelos de declinación cada 15° y horas de AR cada 1h.
export function equatorialGrid() {
  const out = [];
  for (const dec of range(-75, 75, 15)) polyline(range(0, 360, 3).map((ra) => equatorialVector(ra, dec)), out);
  for (const ra of range(0, 345, 15)) polyline(range(-90, 90, 5).map((dec) => equatorialVector(ra, dec)), out);
  return new Float32Array(out);
}

// Eclíptica en coordenadas ecuatoriales de la fecha, con la oblicuidad que entrega Caelis.
export function eclipticLine(oblDeg) {
  const e = (oblDeg * Math.PI) / 180, out = [];
  polyline(range(0, 360, 3).map((l) => { const a = (l * Math.PI) / 180; return [Math.cos(a), Math.sin(a) * Math.cos(e), Math.sin(a) * Math.sin(e)]; }), out);
  return new Float32Array(out);
}

// Meridiano local: círculo máximo Norte - cenit - Sur - nadir.
export function meridianLine() {
  const out = [];
  polyline([...range(-90, 90, 3).map((alt) => dirFromAltAz(alt, 0)), ...range(87, -90, -3).map((alt) => dirFromAltAz(alt, 180))], out);
  return new Float32Array(out);
}
