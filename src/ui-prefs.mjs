// Preferencias de accesibilidad de la interfaz: tamaño del texto (3 pasos) y opacidad de los paneles. Funciones puras, con prueba.
export const TEXT_STEPS = [1, 1.2, 1.4];        // 0 = tamaño original; los otros agrandan todo el texto en proporción
export const OPACITY_MIN = 0.2, OPACITY_MAX = 1;
export const nextTextStep = (i) => (i + 1) % TEXT_STEPS.length;
export const clampOpacity = (v) => { const x = Number(v); return Number.isFinite(x) ? Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, x)) : OPACITY_MAX; };
export function parsePrefs(raw) {
  try {
    const o = JSON.parse(raw || 'null') || {};
    return { nm: o.nm === true, ts: Number.isInteger(o.ts) && o.ts >= 0 && o.ts < TEXT_STEPS.length ? o.ts : 0, op: o.op === undefined ? OPACITY_MAX : clampOpacity(o.op) };
  } catch { return { nm: false, ts: 0, op: OPACITY_MAX }; }
}
