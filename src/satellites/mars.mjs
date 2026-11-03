// Plugin de Marte: Fobos y Deimos. Elementos medios de JPL (época J2000.0 TDB, planos de Laplace locales; efeméride de referencia MAR099).
// Modelo medio kepleriano con precesión secular del nodo y del periapsis: coherente en forma, período, inclinación, tránsito y eclipse, no una efeméride de precisión.
export const MARS_PLUGIN = {
  id: 'mars-mean', planet: 'Marte', radiusKm: 3389.5,
  model: 'JPL mean elements (epoch J2000, local Laplace planes; reference ephemeris MAR099)',
  moons: [
    { key: 'Fobos', name: { en: 'Phobos', es: 'Fobos' }, meanRadiusKm: 11.1, mag: 11.3, elements: { a: 9375, e: 0.015, w: 216.3, M: 189.7, i: 1.1, node: 169.2, P: 0.3187, Papsis: 1.1, Pnode: 2.3, pole: [317.7, 52.9] } },
    { key: 'Deimos', name: { en: 'Deimos', es: 'Deimos' }, meanRadiusKm: 6.2, mag: 12.4, elements: { a: 23457, e: 0.0002, w: 0, M: 205.0, i: 1.8, node: 54.3, P: 1.2625, Papsis: 0, Pnode: 56.2, pole: [316.6, 53.5] } },
  ],
};
