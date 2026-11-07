// Mapas de superficie de las lunas. Cada archivo (JPG equirectangular) vive en public/moons/<archivo>.
// Un mapa solo se pide si su clave está en PRESENT: así no hay errores 404 mientras no estén todos los archivos.
// centerLonE: longitud este (°) que queda en el centro de la imagen; flipX: la imagen aumenta hacia el oeste (se invierte).
// Títan no necesita mapa: su superficie es invisible bajo la bruma naranja, y el degradado liso ES su aspecto real.
export const MOON_MAPS = {
  Io: { file: 'io.jpg', centerLonE: 0 }, Europa: { file: 'europa.jpg', centerLonE: 0 }, Ganimedes: { file: 'ganymede.jpg', centerLonE: 0 }, Calisto: { file: 'callisto.jpg', centerLonE: 0 },
  Mimas: { file: 'mimas.jpg', centerLonE: 0 }, Encelado: { file: 'enceladus.jpg', centerLonE: 0 }, Tetis: { file: 'tethys.jpg', centerLonE: 0 }, Dione: { file: 'dione.jpg', centerLonE: 0 }, Rea: { file: 'rhea.jpg', centerLonE: 0 },
  Miranda: { file: 'miranda.jpg', centerLonE: 0 }, Ariel: { file: 'ariel.jpg', centerLonE: 0 }, Umbriel: { file: 'umbriel.jpg', centerLonE: 0 }, Titania: { file: 'titania.jpg', centerLonE: 0 }, Oberon: { file: 'oberon.jpg', centerLonE: 0 },
  Triton: { file: 'triton.jpg', centerLonE: 0 }, Fobos: { file: 'phobos.jpg', centerLonE: 0 }, Deimos: { file: 'deimos.jpg', centerLonE: 0 },
};
export const PRESENT = new Set([]);   // se completa a medida que se entregan los archivos reales
// Apariencia sin mapa: color base y contraste del moteado procedural (valores de partida; los mapas reales lo reemplazan).
export const LOOK = {
  Titan: { base: '#d6a24a', contrast: 0.02 }, Nereid: { base: '#8f9196', contrast: 0.18 }, Fobos: { base: '#6e6a66', contrast: 0.22 }, Deimos: { base: '#8a8178', contrast: 0.18 },
  Io: { base: '#d8c36a', contrast: 0.28 }, Europa: { base: '#d9d4c8', contrast: 0.12 }, Ganimedes: { base: '#a39d94', contrast: 0.26 }, Calisto: { base: '#6f6a64', contrast: 0.22 },
  default: { base: '#b9b5ad', contrast: 0.16 },
};
