// Plugin de Saturno: Mimas, Encélado, Tetis, Dione, Rea y Titán. Elementos medios de JPL (época J2000.0 TDB, planos de Laplace locales; efeméride de referencia SAT441)
// con los movimientos medios siderales clásicos. Reproduce las resonancias Encélado–Dione (2λ₄ − λ₂ − ϖ₂) y Mimas–Tetis (2λ₁ − 4λ₃ + Ω₁ + Ω₃).
// Modelo medio, no una efeméride de precisión. Los anillos (C, B, Cassini, A) son el plano ecuatorial de Saturno: ocultan a las lunas que pasan detrás de ellos.
export const SATURN_PLUGIN = {
  id: 'saturn-classical-mean', planet: 'Saturno', radiusKm: 60268, flattening: 0.09796, pole: [40.589, 83.537],
  model: 'JPL mean elements (epoch J2000, local Laplace planes; reference ephemeris SAT441), mean longitude propagated with the classical sidereal mean motions',
  rings: [
    { rIn: 74658, rOut: 91975, opacity: 0.15 },     // anillo C
    { rIn: 91975, rOut: 117507, opacity: 1.0 },     // anillo B (opaco)
    { rIn: 122053, rOut: 136774, opacity: 0.6 },    // anillo A (la división de Cassini, entre B y A, es casi transparente)
  ],
  moons: [
    { key: 'Mimas', name: { en: 'Mimas', es: 'Mimas' }, meanRadiusKm: 198.2, mag: 12.9, color: '#e8e8e8', elements: { a: 186000, e: 0.020, w: 160.4, M: 275.3, i: 1.6, node: 66.2, nSid: 381.994555, apsisDir: 1, Papsis: 0.493, Pnode: 0.986, pole: [40.6, 83.5] } },
    { key: 'Encelado', name: { en: 'Enceladus', es: 'Encélado' }, meanRadiusKm: 252.1, mag: 11.7, color: '#ffffff', elements: { a: 238400, e: 0.005, w: 119.5, M: 57.0, i: 0.0, node: 0.0, nSid: 262.7318996, apsisDir: 1, Papsis: 2.916, Pnode: 0, pole: [40.6, 83.5] } },
    { key: 'Tetis', name: { en: 'Tethys', es: 'Tetis' }, meanRadiusKm: 531.1, mag: 10.2, color: '#f0f0ea', elements: { a: 295000, e: 0.001, w: 335.3, M: 0.0, i: 1.1, node: 273.0, nSid: 190.6979085, apsisDir: 1, Papsis: 0, Pnode: 4.982, pole: [40.6, 83.5] } },
    { key: 'Dione', name: { en: 'Dione', es: 'Dione' }, meanRadiusKm: 561.4, mag: 10.4, color: '#e6e3dc', elements: { a: 377700, e: 0.002, w: 116.0, M: 212.0, i: 0.0, node: 0.0, nSid: 131.5349316, apsisDir: 1, Papsis: 11.698, Pnode: 0, pole: [40.6, 83.5] } },
    { key: 'Rea', name: { en: 'Rhea', es: 'Rea' }, meanRadiusKm: 763.8, mag: 9.7, color: '#d9d5cc', elements: { a: 527200, e: 0.001, w: 44.3, M: 31.5, i: 0.3, node: 133.7, nSid: 79.6900478, apsisDir: 1, Papsis: 33.939, Pnode: 35.775, pole: [40.6, 83.5] } },
    { key: 'Titan', name: { en: 'Titan', es: 'Titán' }, meanRadiusKm: 2574.7, mag: 8.4, color: '#e2b46a', elements: { a: 1221900, e: 0.029, w: 78.3, M: 11.7, i: 0.3, node: 78.6, nSid: 22.5769768, apsisDir: 1, Papsis: 346.68, Pnode: 687.37, pole: [36.4, 84.0] } },
  ],
};
