// Plugin de Júpiter: los cuatro galileanos. Elementos medios de JPL (época J2000.0 TDB, planos de Laplace locales; efeméride de referencia JUP365)
// con los movimientos medios siderales clásicos (Lieske), que cumplen la resonancia de Laplace n₁ − 3n₂ + 2n₃ = 0 y por eso λ₁ − 3λ₂ + 2λ₃ = 180° siempre.
// El nodo retrocede; el periapsis de Ío y Europa retrocede (excentricidad forzada por la resonancia) y el de Ganímedes y Calisto avanza. Modelo medio, no una efeméride de precisión.
export const JUPITER_PLUGIN = {
  id: 'jupiter-galilean-mean', planet: 'Jupiter', radiusKm: 71492, flattening: 0.06487, pole: [268.057, 64.495],
  model: 'Hermetica Labs Keplerian propagation of JPL mean elements (J2000, local Laplace planes, ref. JUP365)',
  moons: [
    { key: 'Io', name: { en: 'Io', es: 'Ío' }, meanRadiusKm: 1821.6, mag: 5.0, color: '#f0d9a0', elements: { a: 421800, e: 0.004, w: 49.1, M: 330.9, i: 0.0, node: 0.0, nSid: 203.4889538, apsisDir: -1, Papsis: 1.333, Pnode: 0, pole: [268.1, 64.5] } },
    { key: 'Europa', name: { en: 'Europa', es: 'Europa' }, meanRadiusKm: 1560.8, mag: 5.3, color: '#f4efe6', elements: { a: 671100, e: 0.009, w: 45.0, M: 345.4, i: 0.5, node: 184.0, nSid: 101.3747235, apsisDir: -1, Papsis: 1.394, Pnode: 30.202, pole: [268.1, 64.5] } },
    { key: 'Ganimedes', name: { en: 'Ganymede', es: 'Ganímedes' }, meanRadiusKm: 2631.2, mag: 4.6, color: '#c9bba8', elements: { a: 1070400, e: 0.001, w: 198.3, M: 324.8, i: 0.2, node: 58.5, nSid: 50.3176081, apsisDir: 1, Papsis: 68.301, Pnode: 137.812, pole: [268.2, 64.6] } },
    { key: 'Calisto', name: { en: 'Callisto', es: 'Calisto' }, meanRadiusKm: 2410.3, mag: 5.7, color: '#8f8780', elements: { a: 1882700, e: 0.007, w: 43.8, M: 87.4, i: 0.3, node: 309.1, nSid: 21.5710715, apsisDir: 1, Papsis: 277.921, Pnode: 577.264, pole: [268.7, 64.8] } },
  ],
};
