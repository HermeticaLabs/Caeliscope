// Paisaje del horizonte: una silueta por capas, de lejos a cerca (cerros lejanos, lomas, bosque, primer plano con casas).
// Se genera aquí, una sola vez, como alturas angulares (grados) por cada azimut. La GPU las dibuja y la CPU las usa para
// saber qué queda tapado por un cerro o una casa (etiquetas, clics). Determinista: misma semilla, mismo paisaje.
export const LAND_W = 4096;                       // muestras alrededor de los 360° (0.088° cada una)
export const LANDSCAPES = [
  { id: 0, name: 'Sin paisaje (horizonte plano)' },
  { id: 1, name: 'Campo con cerros' },
  { id: 2, name: 'Pueblo' },
  { id: 3, name: 'Montañas y bosque' },
];

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const wrap = (i, W) => ((i % W) + W) % W;

// Ruido periódico en [0,1]: suma de senos de frecuencia entera (así cierra perfecto en 360°).
function periodicNoise(W, rand, kMax, decay) {
  const ph = [], am = [];
  for (let k = 1; k <= kMax; k++) { ph.push(rand() * 6.2831853); am.push(k ** -decay); }
  const out = new Float32Array(W); let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < W; i++) {
    const t = (i / W) * 6.2831853; let s = 0;
    for (let k = 1; k <= kMax; k++) s += am[k - 1] * Math.sin(k * t + ph[k - 1]);
    out[i] = s; lo = Math.min(lo, s); hi = Math.max(hi, s);
  }
  for (let i = 0; i < W; i++) out[i] = Math.min(1, Math.max(0, (out[i] - lo) / (hi - lo)));
  return out;
}

// Parámetros de cada paisaje: [ancho de los cerros lejanos, ...]
const PRESETS = {
  1: { far: [1.5, 7.5, 1.5, 24, 1.2], mid: [0.8, 3.4, 1.0, 30, 1.0], forest: { dens: 0.55, hMin: 0.9, hMax: 2.6, wMin: 0.5, wMax: 1.3 }, houses: { n: 4, wMin: 1.0, wMax: 1.6, wall: [0.5, 0.8], roof: [0.35, 0.55] }, front: 'poplar' },
  2: { far: [1.0, 5.0, 1.3, 20, 1.2], mid: [0.5, 2.0, 1.0, 30, 1.0], forest: { dens: 0.35, hMin: 0.8, hMax: 2.0, wMin: 0.5, wMax: 1.2 }, houses: { n: 17, wMin: 2.0, wMax: 3.6, wall: [1.0, 1.8], roof: [0.7, 1.2] }, front: 'poplar' },
  3: { far: [3.0, 14, 1.4, 26, 1.1], mid: [1.5, 6.0, 1.15, 40, 1.0], forest: { dens: 0.75, hMin: 2.0, hMax: 6.0, wMin: 0.8, wMax: 2.0 }, houses: { n: 1, wMin: 2.2, wMax: 2.8, wall: [1.0, 1.4], roof: [0.8, 1.0] }, front: 'pine' },
};

// Devuelve { kind, W, h: Float32Array(4*W) (capas 0..3 intercaladas, en grados), info: Float32Array(4*W), maxH }.
// info (solo en casas): [coordenada horizontal 0..1 dentro de la casa, altura de los muros, id, ancho en grados]; fuera: [-1,0,0,0].
export function buildLandscape(kind, W = LAND_W, seed = 2026) {
  const h = new Float32Array(4 * W), info = new Float32Array(4 * W).fill(0);
  for (let i = 0; i < W; i++) info[4 * i] = -1;
  const P = PRESETS[kind];
  if (!P) return { kind, W, h, info, maxH: 0 };
  const rand = rng(seed + kind * 101), degPer = 360 / W, set = (L, i, v) => { if (v > h[4 * wrap(i, W) + L]) h[4 * wrap(i, W) + L] = v; };

  const [b0, a0, p0, k0, d0] = P.far, n0 = periodicNoise(W, rand, k0, d0);
  const [b1, a1, p1, k1, d1] = P.mid, n1 = periodicNoise(W, rand, k1, d1);
  for (let i = 0; i < W; i++) { h[4 * i] = b0 + a0 * n0[i] ** p0; h[4 * i + 1] = b1 + a1 * n1[i] ** p1; }

  // capa 2: bosque. Las copas se agrupan en manchas (ruido de baja frecuencia) y cada árbol es un conífero o una copa redonda.
  const mask = periodicNoise(W, rand, 7, 0.6), F = P.forest, base2 = new Float32Array(W);
  for (let i = 0; i < W; i++) base2[i] = h[4 * i + 1] * 0.55 + 0.15;
  for (let i = 0; i < W; i++) h[4 * i + 2] = base2[i];
  for (let az = 0; az < 360; az += 0.35) {
    const c = Math.round(az / degPer);
    if (mask[wrap(c, W)] < 1 - F.dens || rand() > 0.9) continue;
    const w = F.wMin + rand() * (F.wMax - F.wMin), ht = F.hMin + rand() * (F.hMax - F.hMin), conifer = rand() < (kind === 3 ? 0.8 : 0.45);
    const half = Math.ceil(w / 2 / degPer);
    for (let j = -half; j <= half; j++) {
      const t = Math.abs(j) / half, prof = conifer ? (1 - t) ** 0.85 : Math.sqrt(Math.max(0, 1 - t * t)) ** 0.9;
      set(2, c + j, base2[wrap(c, W)] + ht * prof);
    }
  }

  // capa 3: primer plano
  const base3 = periodicNoise(W, rand, 60, 0.9);
  for (let i = 0; i < W; i++) h[4 * i + 3] = 0.02 + 0.12 * base3[i];
  const taken = [];
  const free = (a, w) => taken.every(([b, v]) => Math.abs(((a - b + 540) % 360) - 180) > (w + v) / 2 + 1.0);
  const H = P.houses; let id = 1;
  for (let tries = 0, placed = 0; placed < H.n && tries < 400; tries++) {
    const az = rand() * 360, w = H.wMin + rand() * (H.wMax - H.wMin);
    if (!free(az, w)) continue;
    taken.push([az, w]); placed++;
    const wall = H.wall[0] + rand() * (H.wall[1] - H.wall[0]), roof = H.roof[0] + rand() * (H.roof[1] - H.roof[0]), chim = rand() < 0.6, cx = 0.15 + rand() * 0.2;
    const c = Math.round(az / degPer), half = Math.round(w / 2 / degPer), b = base3[wrap(c, W)] * 0.12 + 0.02, houseId = id++;
    for (let j = -half; j <= half; j++) {
      const u = (j + half) / (2 * half), x = j / half;                     // x en -1..1
      let top = wall + roof * (1 - Math.abs(x));                           // techo a dos aguas
      if (chim && x > cx && x < cx + 0.12) top = Math.max(top, wall + roof * (1 - cx) + 0.22);
      const idx = 4 * wrap(c + j, W);
      h[idx + 3] = Math.max(h[idx + 3], b + top);
      info[idx] = u; info[idx + 1] = wall; info[idx + 2] = houseId; info[idx + 3] = w;
    }
  }
  // árboles de primer plano (álamos delgados en el campo, pinos grandes en la montaña)
  const nTrees = P.front === 'pine' ? 9 : 7, spec = P.front === 'pine' ? { w: [1.4, 2.6], h: [4.5, 9] } : { w: [0.35, 0.6], h: [2.4, 4.2] };
  for (let t = 0, placed = 0; placed < nTrees && t < 300; t++) {
    const az = rand() * 360, w = spec.w[0] + rand() * (spec.w[1] - spec.w[0]);
    if (!free(az, w)) continue;
    taken.push([az, w]); placed++;
    const ht = spec.h[0] + rand() * (spec.h[1] - spec.h[0]), c = Math.round(az / degPer), half = Math.round(w / 2 / degPer);
    for (let j = -half; j <= half; j++) { const tt = Math.abs(j) / half, prof = P.front === 'pine' ? (1 - tt) ** 0.9 : Math.sqrt(1 - tt * tt) ** 0.55; set(3, c + j, base3[wrap(c, W)] * 0.12 + 0.02 + ht * prof); }
  }
  let maxH = 0; for (let i = 0; i < 4 * W; i++) maxH = Math.max(maxH, h[i]);
  return { kind, W, h, info, maxH };
}

// Altura (grados) de lo más alto que tapa el cielo en ese azimut. 0 si no hay paisaje.
export function skylineAt(land, azDeg) {
  if (!land || !land.maxH) return 0;
  const i = wrap(Math.floor((((azDeg % 360) + 360) % 360) / 360 * land.W), land.W);
  return Math.max(land.h[4 * i], land.h[4 * i + 1], land.h[4 * i + 2], land.h[4 * i + 3]);
}
