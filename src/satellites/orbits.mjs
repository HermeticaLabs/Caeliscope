// Órbita media de un satélite natural respecto del centro de su planeta, con elementos medios referidos a su plano de Laplace local.
// Funciones puras: elementos + instante -> posición en km en el marco ecuatorial ICRF (x hacia el equinoccio, z al polo norte celeste), con el planeta en el origen.
const D2R = Math.PI / 180, JD_J2000 = 2451545.0, YEAR = 365.25;
const wrap = (x) => ((x % 360) + 360) % 360;

// Ecuación de Kepler E - e sen E = M (M en radianes), por Newton.
export function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 30; i++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-13) break; }
  return E;
}

// el: { a (km), e, w, M, i, node (grados, a la época), P (días), Papsis (años, 0 = sin precesión), Pnode (años; el nodo regresa), pole: [ra, dec] del plano de Laplace }
// La anomalía media avanza con P; el nodo retrocede con Pnode y el periapsis avanza con Papsis (precesión secular media).
export function elementsAt(el, jd) {
  const dt = jd - JD_J2000;
  return {
    M: wrap(el.M + (360 / el.P) * dt),
    w: wrap(el.w + (el.Papsis ? (360 / (el.Papsis * YEAR)) * dt : 0)),
    node: wrap(el.node - (el.Pnode ? (360 / (el.Pnode * YEAR)) * dt : 0)),
  };
}

export function moonPositionKm(el, jd) {
  const { M, w, node } = elementsAt(el, jd), E = solveKepler(M * D2R, el.e);
  const xo = el.a * (Math.cos(E) - el.e), yo = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);   // en el plano orbital, eje x al periapsis
  const cw = Math.cos(w * D2R), sw = Math.sin(w * D2R), ci = Math.cos(el.i * D2R), si = Math.sin(el.i * D2R), cn = Math.cos(node * D2R), sn = Math.sin(node * D2R);
  const x1 = xo * cw - yo * sw, y1 = xo * sw + yo * cw;                       // giro por el argumento del periapsis
  const x2 = x1, y2 = y1 * ci, z2 = y1 * si;                                  // inclinación respecto del plano de Laplace
  const lx = x2 * cn - y2 * sn, ly = x2 * sn + y2 * cn, lz = z2;              // giro por el nodo: marco del plano de Laplace (x = su nodo ascendente sobre el ecuador)
  // del plano de Laplace al ecuador: Rz(α + 90°) · Rx(90° − δ), con (α, δ) el polo del plano
  const a = (el.pole[0] + 90) * D2R, t = (90 - el.pole[1]) * D2R, ct = Math.cos(t), st = Math.sin(t);
  const ex = lx, ey = ly * ct - lz * st, ez = ly * st + lz * ct;
  return [ex * Math.cos(a) - ey * Math.sin(a), ex * Math.sin(a) + ey * Math.cos(a), ez];
}
