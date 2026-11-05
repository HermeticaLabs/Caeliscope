// Plugin de Neptuno: Tritón y Nereida. Elementos medios respecto del ecuador de Neptune con movimientos medios siderales clásicos.
// Tritón es el caso especial del sistema solar: órbita casi circular pero RETRÓGRADA (inclinación ≈157° sobre el ecuador de Neptuno), así que recorre su órbita en sentido contrario al giro del planeta.
// Nereida tiene una de las órbitas más excéntricas conocidas (e ≈ 0,75): pasa de ~1,4 a ~9,7 millones de km y tarda casi un año en dar la vuelta.
// Modelo medio, no una efeméride de precisión: sin precesión secular y con fases iniciales (M, ω, Ω) de partida aproximadas. Se omiten las lunas menores (Proteo y otras, de magnitud ≥ 19,7).
const POLE = [299.36, 43.46];
export const NEPTUNE_PLUGIN = {
  id: 'neptune-mean', planet: 'Neptuno', radiusKm: 24764, flattening: 0.0171, pole: POLE,
  model: 'Mean elements relative to the Neptunian equator, mean longitude propagated with the classical sidereal mean motions; no secular precession',
  moons: [
    { key: 'Triton', name: { en: 'Triton', es: 'Tritón' }, meanRadiusKm: 1353.4, mag: 13.5, color: '#e6d9cf', elements: { a: 354759, e: 0.00002, w: 0.0, M: 0.0, i: 156.9, node: 177.0, nSid: 61.2572645, apsisDir: 1, Papsis: 0, Pnode: 0, pole: POLE } },
    { key: 'Nereid', name: { en: 'Nereid', es: 'Nereida' }, meanRadiusKm: 178.5, mag: 19.2, color: '#b9bcc2', elements: { a: 5513818, e: 0.7507, w: 281.0, M: 318.0, i: 32.55, node: 334.0, nSid: 0.9996218, apsisDir: 1, Papsis: 0, Pnode: 0, pole: POLE } },
  ],
};
