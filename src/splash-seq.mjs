// Secuencia del splash: Hermetica Labs → Caelis Engine → Caeliscope.
// Envuelve la línea de tiempo base (timeline.mjs) sin tocarla: la etapa de Caelis Engine
// reutiliza exactamente la mecánica y el tiempo en pantalla de Hermetica (mismos tiempos,
// desplazados ENGINE_SHIFT ms) y el título/subtítulo se retrasan ese mismo tiempo.
import { splashState as baseState } from './timeline.mjs';

export { veilAlpha, IN_MS, OUT_MS, SKY_VEIL_MS, LEAVE_VEIL_MS } from './timeline.mjs';

export const ENGINE_SHIFT = 4400;
export const E = { in0: 900 + ENGINE_SHIFT, in1: 1900 + ENGINE_SHIFT, out0: 3900 + ENGINE_SHIFT, out1: 4900 + ENGINE_SHIFT };

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ramp = (t, a, b) => { const u = clamp01((t - a) / (b - a)); return u * u * (3 - 2 * u); };

export function splashState(t, d = -1) {
  const st = baseState(t, d);
  const late = baseState(t - ENGINE_SHIFT, d);
  const gone = d >= 0 ? clamp01(1 - d / 600) : 1; // se desvanece al descartar el splash
  const engine = ramp(t, E.in0, E.in1) * (1 - ramp(t, E.out0, E.out1)) * gone;
  return { ...st, engine, title: late.title, sub: late.sub };
}
