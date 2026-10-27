// Geometría de los discos planetarios: tamaño, orientación del eje y dirección de la luz solar vistos desde la Tierra.
// Todo es matemática pura (vectores en los ejes de la escena), así que se prueba sin navegador.
//
// Radios ecuatoriales (km) y ejes de rotación según el informe del grupo de trabajo IAU/IAG (época J2000).
// Los periodos de rotación son sidéreos, con signo: negativo = rotación retrógrada.
export const KM_PER_AU = 149597870.7;
export const PLANET_DATA = {
  Sol:      { km: 695700,  pole: [286.13, 63.87],  period: 25.38 },
  Mercurio: { km: 2439.7,  pole: [281.01, 61.45],  period: 58.6462 },
  Venus:    { km: 6051.8,  pole: [272.76, 67.16],  period: -243.0185 },
  Marte:    { km: 3389.5,  pole: [317.68, 52.89],  period: 1.025957 },
  Jupiter:  { km: 71492,   pole: [268.06, 64.50],  period: 0.41354 },
  Saturno:  { km: 60268,   pole: [40.59, 83.54],   period: 0.44401 },
  Urano:    { km: 25559,   pole: [257.31, -15.18], period: -0.71833 },
  Neptuno:  { km: 24764,   pole: [299.36, 43.46],  period: 0.67125 },
};
export const SATURN_RING_OUTER = 2.4;      // radios de Saturno que cubre la tira de textura de los anillos

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };

// Radio angular (rad) de un cuerpo de radio `km` visto desde `distAu`.
export const angularRadius = (km, distAu) => Math.asin(Math.min(1, km / (distAu * KM_PER_AU)));

// Diámetro aparente en segundos de arco.
export const apparentDiameterArcsec = (name, distAu) => 2 * angularRadius(PLANET_DATA[name].km, distAu) * (180 / Math.PI) * 3600;

// Meridiano central (en vueltas, 0..1) bajo el observador: una marca que avanza con el tiempo según la rotación del cuerpo.
// Es decorativo: la textura no está referida a un meridiano origen calibrado, pero gira al ritmo real.
export function centralMeridianTurns(name, jdTT) {
  const p = PLANET_DATA[name].period, t = -((jdTT - 2451545) / p);
  return ((t % 1) + 1) % 1;
}

// Marco del disco: ejes de pantalla (derecha sx, arriba sy) y hacia el observador (z = -dirección del cuerpo).
// `sunFromBody` = vector del cuerpo al Sol (cualquier longitud); `pole` = eje norte del cuerpo.
// Devuelve la luz L y el polo N expresados en ese marco (x derecha, y arriba, z hacia nosotros).
export function discFrame(sx, sy, bodyDir, sunFromBody, pole) {
  const z = [-bodyDir[0], -bodyDir[1], -bodyDir[2]], l = unit(sunFromBody), n = unit(pole);
  return { L: [dot(l, sx), dot(l, sy), dot(l, z)], N: [dot(n, sx), dot(n, sy), dot(n, z)] };
}

// Fracción iluminada del disco visto (0..1) a partir de la luz L en el marco del disco: (1 + cos del ángulo de fase) / 2.
export const illuminatedFraction = (L) => (1 + L[2]) / 2;

// Vector del cuerpo al Sol: ambos dados desde la Tierra (dirección unitaria y distancia en UA).
export function sunFromBody(bodyDir, bodyAu, sunDir, sunAu) {
  return sub([sunDir[0] * sunAu, sunDir[1] * sunAu, sunDir[2] * sunAu], [bodyDir[0] * bodyAu, bodyDir[1] * bodyAu, bodyDir[2] * bodyAu]);
}
