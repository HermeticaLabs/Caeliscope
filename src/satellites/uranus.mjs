// Plugin de Urano: Miranda, Ariel, Umbriel, Titania y Oberón. Elementos medios en el plano ecuatorial de Urano (referencia GUST86) con movimientos medios siderales clásicos.
// El eje de Urano está inclinado unos 98°: las órbitas se ven casi de canto o casi de frente según la época, y las lunas "giran" alrededor del planeta como una diana.
// Modelo medio, no una efeméride de precisión: sin precesión secular (las lunas mayores son casi circulares y casi ecuatoriales; Miranda es la excepción, con i ≈ 4,3°).
// Las fases iniciales (M, ω, Ω) son valores medios de partida; la forma, los períodos y la geometría (tránsito, ocultación, eclipse) son físicamente coherentes.
// Polo orbital (dirección del momento angular de las lunas): opuesto al polo de rotación IAU (257,311; −15,175), porque Urano gira en sentido retrógrado y las lunas lo acompañan.
const POLE = [77.311, 15.175];
export const URANUS_PLUGIN = {
  id: 'uranus-gust-mean', planet: 'Urano', radiusKm: 25559, flattening: 0.0229, pole: POLE,
  model: 'Mean elements in the Uranian equatorial plane (reference ephemeris GUST86), mean longitude propagated with the classical sidereal mean motions; no secular precession',
  moons: [
    { key: 'Miranda', name: { en: 'Miranda', es: 'Miranda' }, meanRadiusKm: 235.8, mag: 15.8, color: '#cfd3d6', elements: { a: 129900, e: 0.0013, w: 68.3, M: 311.3, i: 4.34, node: 326.4, nSid: 254.6907312, apsisDir: 1, Papsis: 0, Pnode: 0, pole: POLE } },
    { key: 'Ariel', name: { en: 'Ariel', es: 'Ariel' }, meanRadiusKm: 578.9, mag: 14.2, color: '#d8d6d0', elements: { a: 190900, e: 0.0012, w: 115.3, M: 39.5, i: 0.04, node: 22.4, nSid: 142.8356608, apsisDir: 1, Papsis: 0, Pnode: 0, pole: POLE } },
    { key: 'Umbriel', name: { en: 'Umbriel', es: 'Umbriel' }, meanRadiusKm: 584.7, mag: 14.8, color: '#8e8c88', elements: { a: 266000, e: 0.0039, w: 84.7, M: 12.5, i: 0.13, node: 33.5, nSid: 86.8688975, apsisDir: 1, Papsis: 0, Pnode: 0, pole: POLE } },
    { key: 'Titania', name: { en: 'Titania', es: 'Titania' }, meanRadiusKm: 788.4, mag: 13.7, color: '#bdb5a8', elements: { a: 436300, e: 0.0011, w: 284.4, M: 24.6, i: 0.08, node: 99.8, nSid: 41.3514243, apsisDir: 1, Papsis: 0, Pnode: 0, pole: POLE } },
    { key: 'Oberon', name: { en: 'Oberon', es: 'Oberón' }, meanRadiusKm: 761.4, mag: 13.9, color: '#a89e92', elements: { a: 583500, e: 0.0014, w: 104.4, M: 283.1, i: 0.07, node: 279.8, nSid: 26.7394892, apsisDir: 1, Papsis: 0, Pnode: 0, pole: POLE } },
  ],
};
