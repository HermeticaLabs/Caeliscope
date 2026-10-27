// Cronología de la portada y de las transiciones (funciones puras de tiempo, en milisegundos).
import { clamp, smoothstep } from './globe-math.mjs';

// Hermetica Labs dura 4 s en pantalla (1 s entra, 2 s plena, 1 s sale). Luego entra Caeliscope y la Tierra sigue girando, sin marcador.
// El logo permanece hasta que la persona interactúa (clic, arrastre, toque, rueda, tecla o mover el ratón): entonces el globo vuela a la ubicación,
// aparece el pin, el logo se desvanece y entra el panel. (d = ms desde la interacción.)
export const T = { hIn0: 900, hIn1: 1900, hOut0: 3900, hOut1: 4900, tIn0: 5300, tIn1: 6600, sIn0: 6200, sIn1: 7400, hint: 1500,
  pin: 600, ui0: 800, dismiss: 1800 };
export const IN_MS = 4600, OUT_MS = 3400, SKY_VEIL_MS = 1500, LEAVE_VEIL_MS = 700;
export const SPIN_DEG_S = 3;

const ramp = (t, a, b) => smoothstep(a, b, t);
// t: ms desde el inicio. d: ms desde que la persona interactuó (negativo = aún no).
export function splashState(t, d = -1) {
  const dd = Math.max(0, d), gone = d >= 0 ? 1 - ramp(dd, 0, 900) : 1;
  return {
    hermetica: ramp(t, T.hIn0, T.hIn1) * (1 - ramp(t, T.hOut0, T.hOut1)) * gone,
    title: ramp(t, T.tIn0, T.tIn1) * gone,
    sub: ramp(t, T.sIn0, T.sIn1) * gone,
    skip: ramp(t, T.hint, T.hint + 1000) * gone * 0.45,
    ui: d >= 0 ? ramp(dd, T.ui0, T.dismiss) : 0,
    spin: SPIN_DEG_S * (d >= 0 ? 1 - ramp(dd, 0, 1400) : 1),
    flying: d >= 0, pinned: d >= T.pin, done: d >= T.dismiss,
  };
}
// Opacidad de la cortina de color: transparente en el espacio y opaca al llegar a la atmósfera (s = avance del viaje, 0 a 1).
export const veilAlpha = (s) => smoothstep(0.82, 1, clamp(s, 0, 1));
