// Seguimiento de un objeto: la cámara se mantiene centrada en él mientras pasa el tiempo.
// La montura es altacimutal (el horizonte siempre queda nivelado), como en Stellarium con el objeto bloqueado.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Diferencia de azimut por el camino más corto (-180..180) de "from" hacia "to".
export const wrapDelta = (to, from) => ((((to - from + 180) % 360) + 360) % 360) - 180;

// Un paso hacia el objetivo. Al engancharse se acerca suavemente (k = 0.2 por cuadro); una vez centrado
// ("locked") queda pegado al objeto sin retraso, aunque el tiempo corra a gran velocidad.
export function followStep(view, target, locked = false, ease = 0.2) {
  const k = locked ? 1 : ease;
  const da = wrapDelta(target.az, view.az), dAlt = clamp(target.alt, -90, 90) - view.alt;
  return {
    az: (((view.az + da * k) % 360) + 360) % 360,
    alt: view.alt + dAlt * k,
    locked: locked || (Math.abs(da) < 0.05 && Math.abs(dAlt) < 0.05),
  };
}
