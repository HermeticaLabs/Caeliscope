// Estrellas: del catálogo J2000 al cielo del observador. Todo en una matriz 3x3.
const D2R = Math.PI / 180, AS = D2R / 3600;

// Precesión J2000 -> fecha (IAU 1976). T = siglos julianos desde J2000 (TT). Fila mayor.
export function precessionMatrix(T) {
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) * AS;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) * AS;
  const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) * AS;
  const [cz, sz, cx, sx, ct, st] = [Math.cos(zeta), Math.sin(zeta), Math.cos(z), Math.sin(z), Math.cos(th), Math.sin(th)];
  return [
    cz * ct * cx - sz * sx, -sz * ct * cx - cz * sx, -st * cx,
    cz * ct * sx + sz * cx, -sz * ct * sx + cz * cx, -st * sx,
    cz * st, -sz * st, ct,
  ];
}

const mul = (A, B) => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => A[3 * i] * B[j] + A[3 * i + 1] * B[3 + j] + A[3 * i + 2] * B[6 + j]));

// Vector ecuatorial (J2000) -> ejes de la escena (x = Este, y = cenit, -z = Norte).
// lstDeg: tiempo sidéreo local aparente (lo entrega Caelis en meta.sidereal.lst_deg).
export function skyRotation(lstDeg, latDeg, T = 0) {
  const L = lstDeg * D2R, f = latDeg * D2R;
  const [sL, cL, sf, cf] = [Math.sin(L), Math.cos(L), Math.sin(f), Math.cos(f)];
  const M = [-sL, cL, 0, cf * cL, cf * sL, sf, sf * cL, sf * sL, -cf];
  return mul(M, precessionMatrix(T));
}

export function equatorialVector(raDeg, decDeg) {
  const a = raDeg * D2R, d = decDeg * D2R;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

// Color aproximado desde el índice B-V (azulada -> blanca -> anaranjada -> rojiza).
const BV = [[-0.3, [0.62, 0.72, 1]], [0, [0.8, 0.87, 1]], [0.6, [1, 0.96, 0.88]], [1.0, [1, 0.85, 0.66]], [1.6, [1, 0.66, 0.46]]];
export function bvToRGB(bv) {
  const x = Math.min(1.6, Math.max(-0.3, bv));
  for (let i = 0; i < BV.length - 1; i++) {
    const [x0, c0] = BV[i], [x1, c1] = BV[i + 1];
    if (x <= x1) { const t = (x - x0) / (x1 - x0); return c0.map((v, k) => v + (c1[k] - v) * t); }
  }
  return BV[BV.length - 1][1];
}

// Magnitud límite visible según la altura del Sol: 6.5 de noche cerrada, ninguna estrella de día.
export function magLimit(sunAltDeg) {
  const t = Math.min(1, Math.max(0, (sunAltDeg + 18) / 18));
  return 6.5 - 8.5 * t;
}

export function buildStarArrays(stars) {
  const n = stars.length, pos = new Float32Array(3 * n), mag = new Float32Array(n), col = new Float32Array(3 * n);
  stars.forEach(([ra, dec, m, bv], i) => {
    pos.set(equatorialVector(ra, dec), 3 * i); mag[i] = m; col.set(bvToRGB(bv), 3 * i);
  });
  return { pos, mag, col };
}

// Constelaciones: segmentos [ra1,dec1,ra2,dec2] -> pares de vectores unitarios.
// Cada segmento se parte en tramos de a lo más maxStepDeg siguiendo el círculo máximo: en las proyecciones de ojo de pez
// un arco largo NO es una recta en pantalla, y un solo tramo recto se separaría de la curva real.
export function buildSegmentPositions(segs, maxStepDeg = 2) {
  const out = [];
  for (const [r1, d1, r2, d2] of segs) {
    const a = equatorialVector(r1, d1), b = equatorialVector(r2, d2);
    const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), om = Math.acos(dot);
    const n = Math.max(1, Math.ceil(om / (maxStepDeg * D2R))), so = Math.sin(om);
    let prev = a;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const w0 = so < 1e-9 ? 1 - t : Math.sin((1 - t) * om) / so, w1 = so < 1e-9 ? t : Math.sin(t * om) / so;
      const q = k === n ? b : [0, 1, 2].map((i) => w0 * a[i] + w1 * b[i]);
      out.push(...prev, ...q); prev = q;
    }
  }
  return new Float32Array(out);
}
// Las líneas aparecen con el crepúsculo (Sol a -6°) y están completas con la noche cerrada (-18°).
export const lineAlpha = (sunAltDeg) => Math.min(1, Math.max(0, (-sunAltDeg - 6) / 12));
// Magnitud máxima de las estrellas con nombre: más nombres al acercar la vista.
export const labelMagLimit = (fovDeg) => Math.min(3.0, Math.max(1.2, 1.2 + (100 - fovDeg) * 0.03));

// Vector ecuatorial J2000 -> altura y azimut con la matriz de skyRotation.
export function horizontalOf(M, e) {
  const x = M[0] * e[0] + M[1] * e[1] + M[2] * e[2], y = M[3] * e[0] + M[4] * e[1] + M[5] * e[2], z = M[6] * e[0] + M[7] * e[1] + M[8] * e[2];
  return { alt: Math.asin(Math.max(-1, Math.min(1, y))) / D2R, az: (Math.atan2(x, -z) / D2R + 360) % 360 };
}
// Búsqueda sin tildes ni mayúsculas.
export const normName = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
