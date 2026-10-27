// Física de los eclipses a partir de lo que entrega Caelis. Todo puro y probado, sin dependencias.
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ── Eclipse solar ─────────────────────────────────────────────────────────────

// Distancia del observador a la Luna a partir de la distancia geocéntrica y la altura geométrica de la Luna.
export function moonTopoDist(distKm, altGeomDeg, observerRadiusKm = 6371) {
  const s = Math.sin(altGeomDeg * D2R);
  return Math.sqrt(distKm * distKm + observerRadiusKm * observerRadiusKm - 2 * distKm * observerRadiusKm * s);
}

// Fracción del ÁREA del disco solar tapada por la Luna. d, rSun y rMoon en cualquier unidad angular (misma para los tres).
export function solarObscuration(d, rSun, rMoon) {
  if (d >= rSun + rMoon) return 0;
  if (d <= Math.abs(rSun - rMoon)) return rMoon >= rSun ? 1 : (rMoon * rMoon) / (rSun * rSun);
  const a = (d * d + rMoon * rMoon - rSun * rSun) / (2 * d * rMoon), b = (d * d + rSun * rSun - rMoon * rMoon) / (2 * d * rSun);
  const k = Math.sqrt((-d + rMoon + rSun) * (d + rMoon - rSun) * (d - rMoon + rSun) * (d + rMoon + rSun));
  const area = rMoon * rMoon * Math.acos(clamp(a, -1, 1)) + rSun * rSun * Math.acos(clamp(b, -1, 1)) - 0.5 * k;
  return clamp(area / (Math.PI * rSun * rSun), 0, 1);
}

// Qué tan oscuro se percibe el cielo (0 = día normal, 1 = totalidad). El ojo responde a la luz de forma logarítmica:
// con el 90% del Sol tapado casi no se nota, y la caída fuerte ocurre en el último minuto.
export function eclipseDarkness(obscuration) {
  return clamp(-Math.log10(Math.max(1 - obscuration, 1e-4)) / 4, 0, 1);
}

// Longitud y latitud eclípticas -> ascensión recta y declinación (grados), con la oblicuidad indicada.
export function eclToEq(lonDeg, latDeg, oblDeg) {
  const l = lonDeg * D2R, b = latDeg * D2R, e = oblDeg * D2R;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  return { ra: (((ra / D2R) % 360) + 360) % 360, dec: dec / D2R };
}

// ── Eclipse lunar: color de la Luna dentro de la sombra de la Tierra ──────────────────────────────
// La Luna eclipsada solo recibe la luz que se refracta en la atmósfera terrestre. Un rayo que roza la Tierra a una
// altura h de perigeo: (1) se curva hacia el eje de la sombra (≈1.07° a nivel del mar, proporcional a la densidad);
// (2) se debilita por dispersión de Rayleigh (∝ λ⁻⁴: el azul desaparece y queda el rojo), (3) por la banda de Chappuis
// del ozono (absorbe el amarillo-naranja: el borde azul turquesa de la umbra), y (4) por nubes y aerosoles de la troposfera.
// La intensidad que llega a un punto de la Luna a distancia ρ del eje es la suma, sobre el disco solar, de los rayos
// que terminan ahí, diluida por la divergencia que produce la propia refracción.
const RE = 6378.14, H_AIR = 8.4, H_AER = 2.2, REF0 = 0.0187;           // km, km, km, rad
const LAMBDA_UM = [0.64, 0.55, 0.46];                                    // rojo, verde, azul (µm)
const rayleighVert = (l) => 0.008569 * l ** -4 * (1 + 0.0113 * l ** -2 + 0.00013 * l ** -4);
const TAU_R = LAMBDA_UM.map(rayleighVert);                               // profundidad óptica vertical
const TAU_O3 = [0.028, 0.0266, 0.002];                                   // 300 UD de ozono (sección eficaz de Chappuis)
const TAU_AER = LAMBDA_UM.map((l) => 0.10 * (l / 0.55) ** -1.3);         // aerosol troposférico, vertical
const H_STEP = 0.5, H_MAX = 150;

let columns = null;                                                      // columnas oblicuas (relativas a la vertical) por altura
function slantColumns() {
  if (columns) return columns;
  const n = Math.round(H_MAX / H_STEP) + 1, out = { air: new Float64Array(n), o3: new Float64Array(n), aer: new Float64Array(n), strat: new Float64Array(n) };
  const o3 = (z) => Math.exp(-0.5 * ((z - 25) / 6.5) ** 2) / (Math.sqrt(2 * Math.PI) * 6.5);   // normalizada a columna vertical = 1
  const st = (z) => Math.exp(-0.5 * ((z - 19) / 4.5) ** 2) / (Math.sqrt(2 * Math.PI) * 4.5);
  for (let i = 0; i < n; i++) {
    const b = RE + i * H_STEP;
    let a = 0, o = 0, r = 0, s = 0;
    for (let x = -3000; x <= 3000; x += 4) {                              // a lo largo del rayo; z = altura sobre la superficie
      const z = Math.sqrt(b * b + x * x) - RE;
      a += Math.exp(-z / H_AIR) / H_AIR; r += Math.exp(-z / H_AER) / H_AER; o += o3(z); s += st(z);
    }
    out.air[i] = a * 4; out.aer[i] = r * 4; out.o3[i] = o * 4; out.strat[i] = s * 4;
  }
  return (columns = out);
}

// Danjon L (0 = muy oscura … 4 = muy brillante) -> cuánto bloquean la troposfera (nubes y aerosol) y la estratosfera (volcánico).
export function atmosphereFromDanjon(L) {
  const l = clamp(L, 0, 4);
  return { tropo: Math.exp(1.1 * (2 - l)), strat: 0.10 * Math.max(0, (2 - l) / 2) };
}

// Transmisión (rojo, verde, azul) de un rayo con perigeo a la altura h (km).
export function transmission(h, { tropo = 1, strat = 0 } = {}) {
  const c = slantColumns(), i = clamp(Math.round(h / H_STEP), 0, c.air.length - 1);
  return [0, 1, 2].map((k) => {
    const tau = TAU_R[k] * c.air[i] + TAU_O3[k] * c.o3[i] + tropo * TAU_AER[k] * c.aer[i] + strat * (LAMBDA_UM[k] / 0.55) ** -1.0 * c.strat[i];
    return Math.exp(-tau);
  });
}

const bend = (h) => REF0 * Math.exp(-h / H_AIR);
const lateral = (h, D) => RE + h - D * bend(h);                          // posición lateral (km) de un rayo central al llegar a la Luna

// Luz que llega a una distancia ρ (km) del eje de la sombra, relativa a la luz solar plena, por canal.
// moonKm = distancia Tierra-Luna; sunRadiusRad = semidiámetro solar (rad).
export function umbraIntensity(rho, moonKm, sunRadiusRad, atm, nPsi = 17) {
  const D = moonKm, F0 = lateral(0, D), F1 = lateral(H_MAX, D);
  let acc = [0, 0, 0], wsum = 0;
  const g = (x) => {                                                      // aporte de los rayos que llegan al lado x del eje
    if (x >= F1) return [1, 1, 1];
    if (x < F0) return [0, 0, 0];
    let lo = 0, hi = H_MAX;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (lateral(m, D) < x) lo = m; else hi = m; }
    const h = (lo + hi) / 2, T = transmission(h, atm);
    const dil = 1 / (1 + (D * REF0 / H_AIR) * Math.exp(-h / H_AIR));      // dilución por la divergencia de la refracción
    const geo = Math.min((RE + h) / Math.max(Math.abs(x), 150), 4);        // convergencia hacia el eje (acotada)
    return T.map((t) => t * dil * geo);
  };
  for (let j = 0; j < nPsi; j++) {
    const u = -1 + (2 * (j + 0.5)) / nPsi, w = Math.sqrt(1 - u * u), psi = u * sunRadiusRad;     // ψ: punto del disco solar
    const a = g(rho - D * psi), b = g(-rho - D * psi);
    for (let k = 0; k < 3; k++) acc[k] += w * (a[k] + b[k]);
    wsum += w;
  }
  return acc.map((v) => v / wsum);
}

// Tabla de colores para el sombreador: n muestras de ρ = 0 … maxKm. Devuelve colores ya listos para mostrar (RGB 0..1).
// El rango de brillo es enorme (de 1 a 1/100 000). Se comprime solo el brillo (gamma) y el tono se conserva casi entero
// (chroma < 1 lo suaviza un poco), porque comprimir cada canal por separado borraría el color rojizo.
export function umbraLUT({ moonKm, sunRadiusRad, danjon = 2, n = 96, maxKm = 9000, gamma = 0.2, chroma = 0.9 }) {
  const atm = atmosphereFromDanjon(danjon), out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const I = umbraIntensity((i / (n - 1)) * maxKm, moonKm, sunRadiusRad, atm, 33);
    const Y = 0.30 * I[0] + 0.59 * I[1] + 0.11 * I[2];
    if (Y <= 0) continue;
    const Yd = Math.min(Y, 1) ** gamma;
    let c = I.map((v) => (v / Y) ** chroma);
    const norm = 0.30 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    c = c.map((v) => v / norm);
    const k = Math.max(c[0], c[1], c[2], 1e-6);
    const s = Math.max(1, (Yd * k) / 1) ; // evita pasar de 1 en un canal sin perder tono
    for (let j = 0; j < 3; j++) out[3 * i + j] = clamp((Yd * c[j]) / s, 0, 1);
  }
  return out;
}
