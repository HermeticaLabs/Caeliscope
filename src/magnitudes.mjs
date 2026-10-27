// Magnitudes aparentes de Sol, Luna y planetas a partir de lo que entrega Caelis (distancias, elongación).
// Planetas: Mallama y Hilton (2018), "Computing Apparent Planetary Magnitudes for The Astronomical Almanac".
// Luna: ley de fase clásica (Allen). Todas devuelven la magnitud visual V.
const D2R = Math.PI / 180, log10 = Math.log10;
export const AU_KM = 149597870.7;

export const sunMagnitude = (distAu) => -26.74 + 5 * log10(distAu);

// phaseAngleDeg: ángulo Sol-Luna-observador (0 = llena). distKm: distancia a la Luna.
export function moonMagnitude(distKm, phaseAngleDeg) {
  const a = Math.abs(phaseAngleDeg);
  return -12.73 + 0.026 * a + 4e-9 * a ** 4 + 5 * log10(distKm / 384400);
}

// Inclinación de los anillos de Saturno vista desde la Tierra: seno de la latitud saturnocéntrica de la Tierra.
// Polo norte de Saturno (J2000): AR 40.589°, Dec 83.537°. raDeg/decDeg: posición de Saturno vista desde la Tierra.
export function saturnRingSinB(raDeg, decDeg) {
  const [a, d, a0, d0] = [raDeg, decDeg, 40.589, 83.537].map((v) => v * D2R);
  const dotPole = Math.sin(d) * Math.sin(d0) + Math.cos(d) * Math.cos(d0) * Math.cos(a - a0);   // polo · (Tierra→Saturno)
  return -dotPole;                                                                              // polo · (Saturno→Tierra)
}

const poly = (c, x) => c.reduceRight((acc, k) => acc * x + k, 0);

// r: distancia heliocéntrica (UA), d: distancia a la Tierra (UA), i: ángulo de fase (grados), sinB: solo para Saturno.
export function planetMagnitude(name, r, d, i, sinB = 0) {
  const rd = 5 * log10(r * d);
  switch (name) {
    case 'Mercurio': return -0.613 + poly([0, 6.3280e-2, -1.6336e-3, 3.3644e-5, -3.4265e-7, 1.6893e-9, -3.0334e-12], i) + rd;
    case 'Venus': return (i <= 163.7 ? -4.384 + poly([0, -1.044e-3, 3.687e-4, -2.814e-6, 8.938e-9], i) : 236.05828 - 2.81914 * i + 8.39034e-3 * i * i) + rd;
    case 'Marte': return (i <= 50 ? -1.601 + 0.02267 * i - 0.0001302 * i * i : -0.367 - 0.02573 * i + 0.0003445 * i * i) + rd;
    case 'Jupiter': return -9.395 - 3.7e-4 * i + 6.16e-4 * i * i + rd;
    case 'Saturno': { const s = Math.abs(sinB); return -8.914 - 1.825 * s + 0.026 * i - 0.378 * s * Math.exp(-2.25 * i) + rd; }
    case 'Urano': return -7.110 + 6.587e-3 * i + 1.045e-4 * i * i + rd;
    case 'Neptuno': return -6.90 + rd;
    default: return NaN;
  }
}

export const NAKED_EYE_LIMIT = 6.5;
