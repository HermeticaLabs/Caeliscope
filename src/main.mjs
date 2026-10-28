import '@fontsource-variable/jost';
import '@fontsource-variable/cormorant';
import * as THREE from 'three';
import { CaelisAPI } from './engine/caelis-engine.generated.mjs';
import { dirFromAltAz, skyPalette, extinction, moonOrientation, eclipseAlt } from './sky-math.mjs';
import { skyRotation, magLimit, buildStarArrays, buildSegmentPositions, lineAlpha, labelMagLimit, equatorialVector, horizontalOf, normName, precessionMatrix } from './stars.mjs';
import { fmtHMS, fmtDMS, planetPhase, elongationDeg, riseSetFromSamples, refractionDeg } from './astro-fmt.mjs';
import { findPhase, findSunLongitude, findEclipseWhere, localSolarInfo, localSolarKind, lunarEclipseInfo } from './events.mjs';
import { t as T, getLang, setLang, onLang, initLang, applyStatic, locale, bodyName, conName, starName } from './i18n.mjs';
import { azimuthalGrid, equatorialGrid, eclipticLine, meridianLine } from './grids.mjs';
import { MIN_FOV, maxFov, viewBasis, focalPx, projectDir, unprojectPx } from './projection.mjs';
import { followStep } from './tracking.mjs';
import { buildLandscape, skylineAt, LAND_W } from './landscape.mjs';
import { tzAt, toInputValue, fromInputValue, dayIndex, fmtOffset, zoneName, fmtClock, fmtHM, fmtDateTime, partsAt, wallToMs, stepWall } from './timezone.mjs';
import { Globe } from './globe.mjs';
import { fadeColor, wrap180 } from './globe-math.mjs';
import { splashState, veilAlpha, IN_MS, OUT_MS, SKY_VEIL_MS, LEAVE_VEIL_MS } from './timeline.mjs';
import { sunMagnitude, moonMagnitude, planetMagnitude, saturnRingSinB, AU_KM, NAKED_EYE_LIMIT } from './magnitudes.mjs';
import { solarObscuration, eclipseDarkness, moonTopoDist, eclToEq, umbraLUT } from './eclipse.mjs';
import { DOME_VS, DOME_FS, GROUND_VS, GROUND_FS, STAR_VS, STAR_FS, LINE_VS, LINE_FS, TRAIL_VS, BILL_VS_SRC, SUN_FS, MOON_FS, PLANET_FS } from './shaders.mjs';
import { PLANET_DATA, angularRadius, apparentDiameterArcsec, centralMeridianTurns, discFrame, sunFromBody, SATURN_RING_OUTER } from './planet-math.mjs';
const BASE = import.meta.env?.BASE_URL ?? '/';   // ruta base del despliegue (raíz o subcarpeta)

initLang();
const { getSnapshotAt, deltaT } = CaelisAPI;
const D2R = Math.PI / 180;
const $ = (id) => document.getElementById(id);
const obs = { lat: -33.45, lon: -70.66 };
try { const o = JSON.parse(localStorage.getItem('caeliscope.obs') || 'null'); if (o && Math.abs(o.lat) <= 90 && Math.abs(o.lon) <= 180) { obs.lat = o.lat; obs.lon = o.lon; } } catch { /* sin almacenamiento: se usa el valor por defecto */ }
let obsTz = tzAt(obs.lat, obs.lon);                        // zona horaria real del lugar del observador
const refreshTz = () => { obsTz = tzAt(obs.lat, obs.lon); };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit3 = (a) => { const n = Math.hypot(...a) || 1; return a.map((v) => v / n); };
const rotVec = (M, e) => [M[0] * e[0] + M[1] * e[1] + M[2] * e[2], M[3] * e[0] + M[4] * e[1] + M[5] * e[2], M[6] * e[0] + M[7] * e[1] + M[8] * e[2]];

// ── Vista: el observador está en el centro de la esfera celeste y solo gira la mirada ──────────────
// La proyección por defecto es estereográfica (conforme), la habitual en los planetarios: los discos y las estrellas
// conservan su forma en toda la pantalla. La perspectiva de cámara (rectilínea) estira y ovala todo hacia los bordes.
const view = { az: 0, alt: 20, fov: 100, mode: 0 };
const projU = { uFwd: { value: new THREE.Vector3() }, uRight: { value: new THREE.Vector3() }, uUp: { value: new THREE.Vector3() },
  uF: { value: 500 }, uMode: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } };
let basis = viewBasis(0, 20), focal = 500;
function setProjection() {
  basis = viewBasis(view.az, view.alt); focal = focalPx(view.mode, view.fov, innerHeight);
  projU.uFwd.value.set(...basis.fwd); projU.uRight.value.set(...basis.right); projU.uUp.value.set(...basis.up);
  projU.uF.value = focal; projU.uMode.value = view.mode; projU.uRes.value.set(innerWidth, innerHeight);
}
const scr = (d) => projectDir(basis, view.mode, focal, d);           // píxeles desde el centro (y hacia arriba) o null
const toCanvas = (p) => [innerWidth / 2 + p.x, innerHeight / 2 - p.y];
const drdth = (th) => view.mode === 1 ? focal : view.mode === 0 ? focal / Math.cos(th / 2) ** 2 : focal / Math.cos(th) ** 2;   // escala local en píxeles por radián
function screenTangents(d, p) {                                       // ejes "derecha" y "arriba" de la pantalla, en 3D, sobre el punto d
  const t = (x, y) => { const q = unprojectPx(basis, view.mode, focal, p.x + x, p.y + y); const k = dot3(q, d); return unit3([q[0] - d[0] * k, q[1] - d[1] * k, q[2] - d[2] * k]); };
  const sx = t(1, 0), sy = t(0, 1);
  return { sx, sy };
}

// ── Escena ─────────────────────────────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);      // solo para cumplir con Three.js: todo se proyecta en los sombreadores
const QUAD = new THREE.PlaneGeometry(2, 2);
const mk = (vs, fs, uniforms, o = {}) => new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms: { ...projU, ...uniforms },
  transparent: true, depthWrite: false, depthTest: false, ...o });
const add = (obj, order) => { obj.frustumCulled = false; obj.renderOrder = order; scene.add(obj); return obj; };
const ADD = { blending: THREE.AdditiveBlending };
const C3 = () => new THREE.Color();

// Cúpula del cielo (pantalla completa, un cálculo por píxel con la proyección inversa)
const domeU = { uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uZenith: { value: C3() }, uHorizon: { value: C3() }, uGlow: { value: C3() },
  uGlowA: { value: 0 }, uNight: { value: 0 }, uRot: { value: new THREE.Matrix3() }, uMW: { value: null }, uHasMW: { value: 0 }, uMWColor: { value: 0 },
  uMWGain: { value: 0.9 }, uGlare: { value: 1 }, uRing: { value: 0 } };
add(new THREE.Mesh(QUAD, mk(DOME_VS, DOME_FS, domeU, { transparent: false })), -10);
let mwBase = 0.9, mwScale = 0.4, showMW = true;     // la Vía Láctea parte en el nivel 8 de 50 (0.4 de 2.5)
const applyMW = () => { domeU.uMWGain.value = showMW ? mwBase * mwScale : 0; };
applyMW();
const mwLoader = new THREE.TextureLoader();
const useMW = (t, colored) => {
  t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; domeU.uMW.value = t; domeU.uHasMW.value = 1;
  domeU.uMWColor.value = colored ? 1 : 0; mwBase = colored ? 1.0 : 0.9; applyMW();
};
mwLoader.load(`${BASE}milkyway_nasa.jpg`, (t) => useMW(t, true), undefined, () =>
  mwLoader.load(`${BASE}milkyway.png`, (t) => useMW(t, false), undefined, () => console.info('Sin Vía Láctea.')));

// Suelo y paisaje: se dibuja al final y tapa todo lo que queda bajo la silueta del horizonte (cerros, árboles, casas)
const groundU = { uGround: { value: C3() }, uHaze: { value: C3() }, uCol0: { value: C3() }, uCol1: { value: C3() }, uCol2: { value: C3() }, uCol3: { value: C3() },
  uH: { value: null }, uI: { value: null }, uW: { value: LAND_W }, uMaxH: { value: 0 }, uLamps: { value: 0 } };
const ground = add(new THREE.Mesh(QUAD, mk(GROUND_VS, GROUND_FS, groundU, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor })), 100);   // el sombreador entrega alfa premultiplicado
let land = null;
function setLandscape(kind) {
  const W = Math.min(LAND_W, renderer.capabilities.maxTextureSize);
  land = buildLandscape(kind, W);
  for (const [key, arr] of [['uH', land.h], ['uI', land.info]]) {
    const t = new THREE.DataTexture(arr, W, 1, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
    groundU[key].value?.dispose(); groundU[key].value = t;
  }
  groundU.uW.value = W; groundU.uMaxH.value = land.maxH; dirty = true;
}
// ¿Queda ese punto del cielo tapado por el suelo, un cerro, un árbol o una casa?
const azOf = (v) => (Math.atan2(v[0], -v[2]) / D2R + 360) % 360;
const hiddenAltAz = (alt, az, margin = 0) => ground.visible && alt < skylineAt(land, az) - margin;
const hiddenDir = (v) => hiddenAltAz(Math.asin(clamp(v[1], -1, 1)) / D2R, azOf(v));

// Estrellas reales (catálogo Hipparcos, magnitud <= 6), orientadas con el tiempo sidéreo de Caelis
const starU = { uRot: { value: new THREE.Matrix3() }, uPx: { value: renderer.getPixelRatio() }, uMagLim: { value: 6.5 }, uSize: { value: 6.4 }, uBoost: { value: 1 } };
let starPts = null, starCat = [], starPos = null;
fetch(`${BASE}stars.json`).then((r) => r.json()).then((cat) => {
  const a = buildStarArrays(cat.stars), g = new THREE.BufferGeometry();
  starCat = cat.stars; starPos = a.pos;
  g.setAttribute('position', new THREE.BufferAttribute(a.pos, 3));
  g.setAttribute('aMag', new THREE.BufferAttribute(a.mag, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(a.col, 3));
  starPts = add(new THREE.Points(g, mk(STAR_VS, STAR_FS, starU, ADD)), 1);
}).catch(() => console.info('Sin /stars.json: no se dibujan estrellas.'));

// Planetas: puntos cuyo brillo y tamaño salen de la magnitud aparente calculada en cada cuadro (src/magnitudes.mjs).
// Neptuno (mag ~7.8) no se ve a simple vista; se dibuja como un punto tenue y la ficha lo aclara.
const PLANETS = { Mercurio: [0xb8b0a0], Venus: [0xfff4d0], Marte: [0xff7a50], Jupiter: [0xf0dcb8], Saturno: [0xe8d090], Urano: [0x9fe8f0], Neptuno: [0x6f8cff] };
const PNAMES = Object.keys(PLANETS), planetDirs = new Float32Array(PNAMES.length * 3);
let planetPts = null, planetMagAttr = null;
let mags = {}, magsVis = {};             // magnitudes aparentes por cuerpo (magsVis: acotadas a 6.3 para poder dibujarlas)
const planetU = { uRot: { value: new THREE.Matrix3() }, uPx: starU.uPx, uMagLim: starU.uMagLim, uSize: { value: 8.5 }, uBoost: { value: 1 } };
{
  const g = new THREE.BufferGeometry(), col = new Float32Array(PNAMES.length * 3), mag = new Float32Array(PNAMES.length);
  PNAMES.forEach((n, i) => { new THREE.Color(PLANETS[n][0]).toArray(col, 3 * i); mag[i] = 0; });
  g.setAttribute('position', new THREE.BufferAttribute(planetDirs, 3)); planetMagAttr = new THREE.BufferAttribute(mag, 1);
  g.setAttribute('aMag', planetMagAttr); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  planetPts = add(new THREE.Points(g, mk(STAR_VS, STAR_FS, planetU, ADD)), 2);
}

// Sol y Luna: discos de tamaño fijo en pantalla, colocados con la proyección. Un disco siempre es redondo, esté donde esté.
const SUN_K = 6, MOON_K = 1.15;                    // medio lado del cartel, en radios del cuerpo
const mkBill = (fs, uniforms, order) => {
  const m = new THREE.Mesh(QUAD, new THREE.ShaderMaterial({ vertexShader: BILL_VS_SRC, fragmentShader: fs, transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uRes: projU.uRes, uCenter: { value: new THREE.Vector2() }, uHalf: { value: 0 }, ...uniforms }, ...(fs === SUN_FS ? { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor } : {}) }));
  return add(m, order);
};
const sunU = { uTint: { value: new THREE.Vector3(1, 1, 1) }, uObsc: { value: 0 }, uCorona: { value: 0 }, uChromo: { value: 0 }, uCAng: { value: 0 }, uK: { value: SUN_K }, uDiamond: { value: 0 }, uMoonDir: { value: new THREE.Vector2(1, 0) },
  uTex: { value: null }, uHasTex: { value: 0 }, uRpx: { value: 1 }, uCM: { value: 0 }, uTexMean: { value: 0.6135 }, uP: { value: new THREE.Vector3(0, 1, 0) } };
const LUT_N = 96, MAX_KM = 9000, lutData = new Uint8Array(LUT_N * 4);
const lutTex = new THREE.DataTexture(lutData, LUT_N, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
lutTex.minFilter = lutTex.magFilter = THREE.LinearFilter; lutTex.needsUpdate = true;
const moonTex = new THREE.TextureLoader();
const moonU = { uL: { value: new THREE.Vector3(0, 0, 1) }, uN: { value: new THREE.Vector2(0, 1) }, uTex: { value: null }, uHasTex: { value: 0 }, uLonOff: { value: 0 },
  uTint: { value: new THREE.Vector3(1, 1, 1) }, uLut: { value: lutTex }, uShadowOn: { value: 0 }, uMaxKm: { value: MAX_KM }, uQ: { value: new THREE.Vector2() },
  uSunOff: { value: new THREE.Vector2(9, 9) }, uSunR: { value: 0 }, uDay: { value: 0 } };
moonTex.load(`${BASE}moon.jpg`, (t) => { t.wrapS = THREE.RepeatWrapping; moonU.uTex.value = t; moonU.uHasTex.value = 1; },
  undefined, () => console.info('Sin /moon.jpg: la Luna se dibuja lisa.'));
const sun = mkBill(SUN_FS, sunU, 10), moon = mkBill(MOON_FS, moonU, 11);

// Discos planetarios: esfera con textura (Solar System Scope, CC BY 4.0) iluminada por el Sol. Solo se dibujan cuando miden unos píxeles; antes son los puntos de arriba.
const surfTex = new THREE.TextureLoader();
const loadSurf = (file, done, mips = true) => surfTex.load(`${BASE}planets/${file}`, (t) => {
  t.wrapS = THREE.RepeatWrapping; if (!mips) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; } else t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); done(t);
}, undefined, () => console.info(`Sin planets/${file}: se dibuja sin textura.`));
loadSurf('sun.jpg', (t) => { sunU.uTex.value = t; sunU.uHasTex.value = 1; });
const PLANET_LOOK = {     // suavidad del terminador, cuánto se aplana el sombreado (rocas: casi plano), oscurecimiento al limbo, ganancia y color si falta la textura
  Mercurio: { soft: 0.03, flat: 0.55, limb: 0.15, gain: 1.15, base: [0.6, 0.58, 0.55], file: 'mercury.jpg' },
  Venus: { soft: 0.28, flat: 0.0, limb: 0.35, gain: 1.25, base: [0.95, 0.88, 0.7], file: 'venus.jpg' },
  Marte: { soft: 0.04, flat: 0.25, limb: 0.2, gain: 1.2, base: [0.75, 0.4, 0.28], file: 'mars.jpg' },
  Jupiter: { soft: 0.1, flat: 0.0, limb: 0.5, gain: 1.2, base: [0.85, 0.75, 0.6], file: 'jupiter.jpg' },
  Saturno: { soft: 0.1, flat: 0.0, limb: 0.45, gain: 1.2, base: [0.85, 0.78, 0.55], file: 'saturn.jpg' },
  Urano: { soft: 0.12, flat: 0.0, limb: 0.55, gain: 1.25, base: [0.6, 0.85, 0.9], file: 'uranus.jpg' },
  Neptuno: { soft: 0.12, flat: 0.0, limb: 0.55, gain: 1.45, base: [0.3, 0.45, 0.9], file: 'neptune.jpg' },
};
const ringTexU = { value: null };
loadSurf('saturn-rings.png', (t) => { ringTexU.value = t; }, false);
const pdisc = {}, pstate = {}, bodyPx = {};          // pdisc: malla y uniformes; pstate: geometría de la consulta actual; bodyPx: radio en pantalla (para clic, mira y etiquetas)
for (const n of PNAMES) {
  const L = PLANET_LOOK[n], k = n === 'Saturno' ? 2.5 : 1.25;
  const u = { uTex: { value: null }, uRingTex: ringTexU, uL: { value: new THREE.Vector3(0, 0, 1) }, uP: { value: new THREE.Vector3(0, 1, 0) }, uTint: { value: new THREE.Vector3(1, 1, 1) },
    uBase: { value: new THREE.Vector3(...L.base) }, uCM: { value: 0 }, uK: { value: k }, uRpx: { value: 1 }, uSoft: { value: L.soft }, uFlat: { value: L.flat }, uLimb: { value: L.limb },
    uRing: { value: n === 'Saturno' ? 1 : 0 }, uA: { value: 1 }, uHasTex: { value: 0 }, uGain: { value: L.gain } };
  pdisc[n] = { mesh: mkBill(PLANET_FS, u, 12), u, k };
  pdisc[n].mesh.visible = false;
  loadSurf(L.file, (t) => { u.uTex.value = t; u.uHasTex.value = 1; });
}

const bodies = {};       // estado actual de Sol y Luna
let sunState = null;
let eclNow = { obsc: 0, dark: 0, sepDeg: 99, rSun: 0, rMoon: 0 };
let danjon = 2, lutKey = '';
function ensureLut(moonKm, sunRad) {
  const key = `${danjon}|${Math.round(moonKm / 1500)}`;
  if (key === lutKey) return; lutKey = key;
  const a = umbraLUT({ moonKm, sunRadiusRad: sunRad, danjon, n: LUT_N, maxKm: MAX_KM });
  for (let i = 0; i < LUT_N; i++) { for (let k = 0; k < 3; k++) lutData[4 * i + k] = Math.round(a[3 * i + k] * 255); lutData[4 * i + 3] = 255; }
  lutTex.needsUpdate = true;
}
// Los discos se agrandan para verse bien en un campo amplio; durante un eclipse (Sol y Luna cerca) van a tamaño real para que la geometría sea exacta.
const boostFor = (sepDeg) => 1 + (clamp(view.fov / 30, 1, 3) - 1) * smooth(1.5, 6, sepDeg);

function placeBill(mesh, d, ang, k, boost) {
  const p = scr(d), th = Math.acos(clamp(dot3(d, basis.fwd), -1, 1));
  if (!p) { mesh.visible = false; return null; }
  const half = clamp(drdth(th) * Math.tan(ang) * k * boost, 0, 20000);
  mesh.visible = half > 0.2; mesh.material.uniforms.uCenter.value.set(p.x, p.y); mesh.material.uniforms.uHalf.value = half;
  return { p, half, rad: half / k };
}
// Se llama en cada cuadro: reposiciona los discos y la orientación de la Luna para la vista actual.
function orient() {
  if (!bodies.moon || !bodies.sun) return;
  const sd = dirFromAltAz(bodies.sun.alt, bodies.sun.az), md = dirFromAltAz(bodies.moon.alt, bodies.moon.az);
  const boost = boostFor(eclNow.sepDeg);
  const s = placeBill(sun, sd, bodies.sun.ang, SUN_K, boost), m = placeBill(moon, md, bodies.moon.ang, MOON_K, boost);
  if (m) {
    const { sx, sy } = screenTangents(md, m.p);
    const o = moonOrientation(md, sd, dirFromAltAz(obs.lat, 0), sx, sy);
    moonU.uL.value.set(...o.L); moonU.uN.value.set(...o.N);
    if (s) { moonU.uSunOff.value.set((s.p.x - m.p.x) / m.rad, (s.p.y - m.p.y) / m.rad); moonU.uSunR.value = s.rad / m.rad; } else moonU.uSunR.value = 0;
    if (eclNow.shadowOn) {                                              // posición del eje de la sombra de la Tierra sobre el disco lunar, en radios lunares
      const A = eclNow.antiSun, M = eclNow.moonGeo, k = dot3(A, M), off = [A[0] - M[0] * k, A[1] - M[1] * k, A[2] - M[2] * k], r = 1737.4 / bodies.moon.distKm;
      moonU.uQ.value.set(dot3(off, sx) / r, dot3(off, sy) / r);
    }
  }
  if (s) {
    const { sx, sy } = screenTangents(sd, s.p), poleE = eclNow.eclPole;     // los serpentines de la corona siguen la eclíptica (≈ ecuador solar)
    sunU.uCAng.value = poleE ? Math.atan2(dot3(poleE, sy), dot3(poleE, sx)) + Math.PI / 2 : 0;
    if (m) { const dx = m.p.x - s.p.x, dy = m.p.y - s.p.y, n = Math.hypot(dx, dy) || 1; sunU.uMoonDir.value.set(dx / n, dy / n); }
    if (sunState) { sunU.uP.value.set(dot3(sunState.pole, sx), dot3(sunState.pole, sy), -dot3(sunState.pole, sd)); sunU.uCM.value = sunState.cm; }
    sunU.uRpx.value = s.rad;
  }
  bodyPx.Sol = s ? s.rad : 0; bodyPx.Luna = m ? m.rad : 0;
  placePlanets();
  setLiveWindow();
}
function placePlanets() {
  const lim = starU.uMagLim.value;
  PNAMES.forEach((n, i) => {
    const ps = pstate[n], pd = pdisc[n]; if (!ps) return;
    const r = placeBill(pd.mesh, ps.dir, ps.ang, pd.k, 1), px = r ? r.rad : 0;
    bodyPx[n] = px * (n === 'Saturno' ? SATURN_RING_OUTER : 1);
    pd.mesh.visible = !!r && px >= 0.7;
    planetMagAttr.array[i] = px > 3 ? 30 : (magsVis[n] ?? 0);            // con disco visible se apaga el punto
    if (!pd.mesh.visible) return;
    const { sx, sy } = screenTangents(ps.dir, r.p), f = discFrame(sx, sy, ps.dir, ps.sunVec, ps.pole), u = pd.u;
    u.uL.value.set(...f.L); u.uP.value.set(...f.N); u.uCM.value = ps.cm; u.uRpx.value = px; u.uTint.value.set(...ps.tint);
    u.uA.value = Math.max(clamp((lim - (mags[n] ?? 0) + 2.5) / 2, 0, 1), smooth(8, 40, px) * 0.95);   // de día solo se ven los brillantes, salvo con mucho zoom
  });
  planetMagAttr.needsUpdate = true;
}

// ── Objetos buscables ──
// Cada objeto se registra con su nombre en ambos idiomas ({ en, es }): se encuentra escribiendo cualquiera de los dos, y la lista sugerida sigue el idioma activo.
const registry = new Map(), objList = $('objs'), searchable = [];
function register(nm, fn) {
  const n = typeof nm === 'string' ? { en: nm, es: nm } : nm;
  registry.set(normName(n.en), fn); registry.set(normName(n.es), fn); searchable.push(n);
}
function rebuildObjList() {
  objList.replaceChildren(); const seen = new Set();
  for (const n of searchable) { const v = n[getLang()]; if (seen.has(v)) continue; seen.add(v); const o = document.createElement('option'); o.value = v; objList.appendChild(o); }
}
const bi = (k) => ({ en: bodyName(k, 'en'), es: bodyName(k, 'es') });
const say = (msg) => { $('msg').textContent = msg; };
// La línea de hora ("05:14:20 Santiago, UTC−3 · 08:14:20 UTC") se queda siempre en una sola línea: si no cabe, se reduce la letra hasta que quepa.
let fitKey = '';
function fitClock(key) {
  const el = $('clock'); if (key === fitKey || !el.clientWidth) return;
  el.style.fontSize = '';
  if (el.scrollWidth > el.clientWidth) el.style.fontSize = Math.max(8, 13 * (el.clientWidth / el.scrollWidth) * 0.97).toFixed(2) + 'px';
  fitKey = key;
}
addEventListener('resize', () => { fitKey = ''; });
let goal = null; // destino suave de la cámara

// ── Seguimiento: la cámara acompaña a un cuerpo celeste (o estrella) mientras pasa el tiempo,  ──
let track = null, trackLocked = false;              // { kind: 'body', key } | { kind: 'star', i }; locked = ya centrado: se pega al objeto sin retraso
const sameObj = (a, b) => !!a && !!b && a.kind === b.kind && (a.kind === 'body' ? a.key === b.key : a.i === b.i);
function trackTarget() {                            // posición actual (az, alt) del objeto seguido
  if (!track || !last || !rotM) return null;
  if (track.kind === 'body') { const b = last[track.key]; return b && { az: b.az_deg, alt: b.alt_apparent_deg }; }
  return horizontalOf(rotM, starVec(track.i));
}
function updateTrackUI() {
  const chip = $('trackChip'); chip.hidden = !track;
  if (track) {
    const tg = trackTarget(), name = track.kind === 'body' ? bodyName(track.key) : (starNameOf(track.i) || T('chip.star'));
    $('trackName').textContent = T('chip.followingN', { name }) + (tg && tg.alt < 0 ? T('chip.below') : '');
  }
  $('cTrack').setAttribute('aria-pressed', sameObj(track, sel));
}
function startTrack(obj) { track = obj ? { kind: obj.kind, key: obj.key, i: obj.i } : null; trackLocked = false; goal = null; updateTrackUI(); }
function stopTrack() { if (track) { track = null; updateTrackUI(); } }

// ── Líneas: constelaciones, cuadrículas ──
const idU = { value: new THREE.Matrix3() }, dateU = { value: new THREE.Matrix3() };
const makeLines = (pos, rgb, rot, a, order = 3) => {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = add(new THREE.LineSegments(g, mk(LINE_VS, LINE_FS, { uRot: rot, uCol: { value: new THREE.Color(...rgb) }, uA: { value: a } }, ADD)), order);
  return m;
};
const lineU = { uRot: starU.uRot, uA: { value: 0.35 }, uCol: { value: new THREE.Color(0.55, 0.5, 0.95) } };
let lineMesh = null, names = [], conLabels = [], rotM = null, showConst = false, showNames = false;      // por defecto el cielo parte limpio: sin constelaciones ni nombres
fetch(`${BASE}sky-overlay.json`).then((r) => r.json()).then((o) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(buildSegmentPositions(o.segments), 3));
  lineMesh = add(new THREE.LineSegments(g, mk(LINE_VS, LINE_FS, lineU, ADD)), 3); lineMesh.visible = showConst;
  names = o.stars.map(([ra, dec, mag, name]) => ({ e: equatorialVector(ra, dec), ra, dec, mag, name }));
  conLabels = o.labels.map(([ra, dec, name]) => ({ e: equatorialVector(ra, dec), name }));
  names.forEach((n) => register({ en: starName(n.name, 'en'), es: n.name }, () => rotM && horizontalOf(rotM, n.e)));
  conLabels.forEach((c) => register({ en: conName(c.name, 'en'), es: c.name }, () => rotM && horizontalOf(rotM, c.e)));
  rebuildObjList();
}).catch(() => console.info('Sin /sky-overlay.json: no hay constelaciones ni nombres.'));
const makeGrid = (pos, rgb, rot, a = 0.5) => { const m = makeLines(pos, rgb, rot, a); m.visible = false; return m; };
const gridAz = makeGrid(azimuthalGrid(), [0.3, 0.75, 0.8], idU), gridEq = makeGrid(equatorialGrid(), [0.85, 0.6, 0.3], dateU), gridMer = makeGrid(meridianLine(), [0.9, 0.9, 1.0], idU, 0.7);
let gridEcl = null, showAzL = false, showEqL = false, showEcl = false, rotDate = null;

const toggle = (id, set) => { const b = $(id); b.onclick = () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); set(on); dirty = true; }; };
toggle('tConst', (on) => { showConst = on; if (lineMesh) lineMesh.visible = on; });
toggle('tNames', (on) => { showNames = on; });
toggle('tAz', (on) => { gridAz.visible = showAzL = on; });
toggle('tEq', (on) => { gridEq.visible = showEqL = on; });
toggle('tEcl', (on) => { showEcl = on; if (gridEcl) gridEcl.visible = on; });
toggle('tMer', (on) => { gridMer.visible = on; });
toggle('tMW', (on) => { showMW = on; applyMW(); });
toggle('tGround', (on) => { ground.visible = on; });

// ── Textos sobre el cielo (lienzo 2D encima, con la misma proyección) ──
const ov = $('labels'), octx = ov.getContext('2d');
let skyAlt = -30;                                   // altura "efectiva" del Sol (incluye el oscurecimiento del eclipse)
function drawLabels() {
  const w = innerWidth, h = innerHeight; octx.clearRect(0, 0, w, h);
  if (!rotM || !last) return;
  const lim = magLimit(skyAlt), a = lineAlpha(skyAlt);
  const atV = (v) => { // posición en pantalla de una dirección de la escena, o null
    if (hiddenDir(v)) return null;
    const p = scr(v); if (!p) return null;
    const c = toCanvas(p); return c[0] < -30 || c[0] > w + 30 || c[1] < -30 || c[1] > h + 30 ? null : c;
  };
  const at = (e, M = rotM) => atV(rotVec(M, e));
  octx.textBaseline = 'middle';
  if (showNames) {
    octx.font = '13px Georgia'; octx.textAlign = 'left'; const mlim = labelMagLimit(view.fov);
    for (const s of names) {
      if (s.mag > mlim || s.mag > lim - 0.5) continue;
      const p = at(s.e); if (!p) continue;
      octx.fillStyle = `rgba(235,235,245,${clamp((lim - s.mag) / 1.5, 0, 1) * 0.85})`; octx.fillText(starName(s.name), p[0] + 9, p[1]);
    }
  }
  if (showConst && a > 0.02) {
    octx.font = 'italic 12px Georgia'; octx.textAlign = 'center'; octx.fillStyle = `rgba(180,165,255,${0.8 * a})`;
    for (const c of conLabels) { const p = at(c.e); if (p) octx.fillText(conName(c.name), p[0], p[1]); }
  }
  octx.font = '11px Georgia'; octx.textAlign = 'center';
  if (showAzL) {
    octx.fillStyle = 'rgba(110,200,210,0.85)';
    for (let az = 30; az < 360; az += 30) { if (az % 90) { const p = atV(dirFromAltAz(1.5, az)); if (p) octx.fillText(az + '°', p[0], p[1]); } }
  }
  if (showEqL && rotDate) {
    octx.fillStyle = 'rgba(230,160,90,0.85)';
    for (let ra = 0; ra < 360; ra += 30) { const p = at(equatorialVector(ra, 0), rotDate); if (p) octx.fillText(ra / 15 + 'h', p[0], p[1] - 8); }
    for (const dec of [-60, -30, 30, 60]) { const p = at(equatorialVector(0, dec), rotDate); if (p) octx.fillText((dec > 0 ? '+' : '') + dec + '°', p[0] + 14, p[1]); }
  }
  // puntos cardinales, Sol, Luna y planetas
  octx.font = '14px Georgia'; octx.fillStyle = '#fff';
  [['N', 0], ['E', 90], ['S', 180], [getLang() === 'es' ? 'O' : 'W', 270]].forEach(([c, az]) => { const p = atV(dirFromAltAz(Math.max(3, skylineAt(land, az) + 1.3), az)); if (p) octx.fillText(c, p[0], p[1]); });
  octx.font = '13px Georgia';
  const tag = (key, text, color, dy) => {
    const b = last[key]; if (!b) return;
    const p = atV(dirFromAltAz(b.alt_apparent_deg, b.az_deg)); if (!p) return;
    const px = bodyPx[key] || 0, off = dy < 0 ? Math.min(dy, -(px + 14)) : Math.max(dy, px + 14);
    octx.fillStyle = color; octx.fillText(text, p[0], p[1] + off);
  };
  if (!(eclNow.dark > 0.5)) { tag('Sol', bodyName('Sol'), '#dcb450', -26); }
  tag('Luna', bodyName('Luna'), '#dcb450', 26);
  for (const n of PNAMES) if ((magsVis[n] ?? 0) < lim + 0.4 || (bodyPx[n] || 0) > 4) tag(n, bodyName(n), '#b4a5ff', 16);
  const sp = sel && selScreen();
  if (sp) { // mira discreta: cuatro cuadritos (arriba, abajo, izquierda, derecha) alrededor del objeto
    const R = sel.kind === 'body' ? Math.max(14, (bodyPx[sel.key] || 0) + 8) : 14, q = 5; octx.strokeStyle = 'rgba(255,255,255,0.85)'; octx.lineWidth = 1;
    for (const [dx, dy] of [[0, -R], [0, R], [-R, 0], [R, 0]]) octx.strokeRect(Math.round(sp[0] + dx - q / 2) + 0.5, Math.round(sp[1] + dy - q / 2) + 0.5, q, q);
  }
}

// ── Selección de objetos y ficha con datos de Caelis ──
let sel = null, rs = null, rsKey = '', lstNow = 0, tNow = 0, lunaNow = null, starNames = null;
const BODY_KEYS = ['Sol', 'Luna', ...PNAMES];
const starVec = (i) => [starPos[3 * i], starPos[3 * i + 1], starPos[3 * i + 2]];
function project(v) { const p = scr(v); return p && toCanvas(p); }
function selScreen() {
  if (!sel || !last || !rotM) return null;
  if (sel.kind === 'body') { const b = last[sel.key]; return project(dirFromAltAz(b.alt_apparent_deg, b.az_deg)); }
  return project(rotVec(rotM, starVec(sel.i)));
}
function pick(px, py) { // el objeto más cercano al clic: primero cuerpos, luego estrellas visibles
  if (!last || !rotM) return null;
  let best = null;
  const tryIt = (item, v, rad, bias) => {
    const s = project(v); if (!s) return;
    const d = Math.hypot(s[0] - px, s[1] - py);
    if (d <= rad && (!best || d - bias < best.sc)) best = { ...item, sc: d - bias };
  };
  for (const k of BODY_KEYS) {
    const b = last[k];
    if (b && !hiddenAltAz(b.alt_apparent_deg, b.az_deg, 0.3)) tryIt({ kind: 'body', key: k }, dirFromAltAz(b.alt_apparent_deg, b.az_deg), Math.max(28, (bodyPx[k] || 0) + 6), 14);
  }
  if (starPos) {
    const lim = magLimit(skyAlt);
    for (let i = 0; i < starCat.length; i++) {
      if (starCat[i][2] > lim) continue;
      const v = rotVec(rotM, starVec(i));
      if (hiddenDir(v)) continue;
      tryIt({ kind: 'star', i }, v, 15, (6.5 - starCat[i][2]) * 1.2);
    }
  }
  return best && { kind: best.kind, key: best.key, i: best.i };
}
let starInfo = null; // por estrella: [nombre, número Hipparcos, tipo 0 propio / 1 Bayer-Flamsteed / 2 solo HIP]
fetch(`${BASE}star-names.json`).then((r) => r.json()).then((a) => { starInfo = a; dirty = true; refreshCard(); updateTrackUI(); }).catch(() => console.info('Sin /star-names.json: solo las estrellas con nombre de la lista corta.'));
const starNameOf = (i) => starName((starInfo && starInfo[i] && starInfo[i][0]) || overlayNames().get(i));
function overlayNames() { // nombres de la lista corta, por coincidencia de posición
  if (!starNames) {
    starNames = new Map();
    for (const n of names) {
      for (let k = 0; k < starCat.length; k++) {
        const s = starCat[k];
        if (Math.abs(s[1] - n.dec) < 0.002 && Math.abs((((s[0] - n.ra + 540) % 360) - 180) * Math.cos(n.dec * D2R)) < 0.002) { starNames.set(k, n.name); break; }
      }
    }
  }
  return starNames;
}
const hm = (ms) => {
  const dd = dayIndex(ms, obsTz) - dayIndex(simMs, obsTz);
  return fmtHM(ms, obsTz) + (dd === 1 ? T('row.tomorrow') : dd === -1 ? T('row.yesterday') : '');
};
function ensureRS() { // orto y ocaso de las próximas 26 h, calculados con Caelis (cuerpos) o con el tiempo sidéreo (estrellas)
  if (!sel) return;
  const key = `${JSON.stringify(sel)}|${Math.floor(simMs / 3600000)}|${obs.lat}|${obs.lon}`;
  if (key === rsKey) return;
  rsKey = key; rs = null;
  const step = 900000, n = 105, t0 = simMs, alts = [];
  if (sel.kind === 'star') {
    const e = starVec(sel.i);
    for (let k = 0; k < n; k++) alts.push(horizontalOf(skyRotation(lstNow + (360.98564736629 * k * step) / 86400000, obs.lat, tNow), e).alt);
    rs = riseSetFromSamples(alts, t0, step, -0.5667); return;
  }
  const h0 = sel.key === 'Sol' || sel.key === 'Luna' ? -0.2666 : 0; // radio del disco; la altura aparente ya incluye refracción
  let k = 0;
  (function chunk() {
    if (rsKey !== key) return;
    for (let c = 0; c < 15 && k < n; c++, k++) alts.push(snapAt(t0 + k * step).bodies[sel.key].alt_apparent_deg);
    if (k < n) setTimeout(chunk, 0); else { rs = riseSetFromSamples(alts, t0, step, h0); refreshCard(); }
  })();
}
function describe() {
  const rows = [];
  let title, sub, wiki;
  if (sel.kind === 'body') {
    const b = last[sel.key], sun = last.Sol;
    title = bodyName(sel.key); wiki = title;
    sub = T(sel.key === 'Sol' ? 'sub.sun' : sel.key === 'Luna' ? 'sub.moon' : 'sub.planet');
    rows.push([T('row.mag'), fmtMag(mags[sel.key])]);
    if (sel.key === 'Sol') { if (eclNow.obsc > 0.0005) rows.push([T('row.covered'), `${(eclNow.obsc * 100).toFixed(eclNow.obsc > 0.99 ? 3 : 1)}%`]); }
    { const rad = sel.key === 'Sol' || sel.key === 'Luna' ? bodies[sel.key === 'Sol' ? 'sun' : 'moon'].ang : angularRadius(PLANET_DATA[sel.key].km, b.dist_au), as = 2 * rad / D2R * 3600;
      rows.push([T('row.apparent'), as >= 120 ? `${(as / 60).toFixed(1)}′` : `${as.toFixed(1)}″`]); }
    rows.push([T('row.dist'), sel.key === 'Luna' ? `${Math.round(b.dist_km).toLocaleString(locale())} km` : `${b.dist_au.toFixed(4)} ${T('unit.au')}`]);
    rows.push([T('row.radec'), `${fmtHMS(b.ra_deg)}  ${fmtDMS(b.dec_deg)}`]);
    rows.push([T('row.azalt'), `${fmtDMS(b.az_deg, false, 3)}  ${fmtDMS(b.alt_apparent_deg)}`]);
    rows.push([T('row.ecl'), `${fmtDMS(b.lon_ecl_geocentric_deg ?? b.lon_ecl_deg, false, 3)}  ${fmtDMS(b.lat_ecl_geocentric_deg ?? b.lat_ecl_deg)}`]);
    if (sel.key !== 'Sol') {
      const el = elongationDeg(b.ra_deg, b.dec_deg, sun.ra_deg, sun.dec_deg);
      if (sel.key === 'Luna' && lunaNow) rows.push([T('row.phase'), `${(lunaNow.illumination * 100).toFixed(0)}%`]);
      else { const ph = planetPhase(b.dist_au, sun.dist_au, el); rows.push([T('row.phase'), `${(ph.illum * 100).toFixed(0)}%`], [T('row.sunDist'), `${ph.r.toFixed(4)} ${T('unit.au')}`]); }
      rows.push([T('row.elong'), `${el.toFixed(1)}°`]);
    }
    if (mags[sel.key] > NAKED_EYE_LIMIT) rows.push([T('row.obs'), T('row.needsScope')]);
    rows.push([T('row.state'), T(b.alt_apparent_deg >= 0 ? 'row.up' : 'row.down')]);
  } else {
    const s = starCat[sel.i], e = starVec(sel.i), name = starNameOf(sel.i);
    const info = starInfo && starInfo[sel.i], hip = info && info[1];
    title = name || (hip ? `HIP ${hip}` : T('chip.star')); sub = T(info && info[2] === 2 ? 'sub.starCat' : 'sub.star'); wiki = info && info[2] !== 2 ? name : null;
    const h = horizontalOf(rotM, e), Pm = precessionMatrix(tNow), v = rotVec(Pm, e);
    rows.push([T('row.mag'), s[2].toFixed(2)], [T('row.bv'), s[3].toFixed(2)]);
    if (hip) rows.push([T('row.hip'), `HIP ${hip}`]);
    rows.push([T('row.radec'), `${fmtHMS((Math.atan2(v[1], v[0]) / D2R + 360) % 360)}  ${fmtDMS(Math.asin(v[2]) / D2R)}`]);
    rows.push([T('row.radec2000'), `${fmtHMS(s[0])}  ${fmtDMS(s[1])}`]);
    rows.push([T('row.azalt'), `${fmtDMS(h.az, false, 3)}  ${fmtDMS(h.alt + refractionDeg(h.alt))}`]);
    rows.push([T('row.state'), T(h.alt >= -0.5667 ? 'row.up' : 'row.down')]);
  }
  if (rs) {
    if (rs.state === 'siempre') rows.push([T('row.vis'), T('row.always')]);
    else if (rs.state === 'nunca') rows.push([T('row.vis'), T('row.never')]);
    else rows.push([T('row.rise'), rs.rise ? hm(rs.rise) : '-'], [T('row.set'), rs.set ? hm(rs.set) : '-']);
  } else rows.push([T('row.rise'), '…'], [T('row.set'), '…']);   // mismo alto que el resultado, para que la ficha no se desplace al llegar el cálculo
  return { title, sub, rows, wiki };
}
function refreshCard() {
  const card = $('card');
  updatePaths();
  if (!sel || !last || !rotM) { card.hidden = true; return; }
  if (Math.abs(speed) < 60) ensureRS();
  const d = describe();
  $('cTitle').textContent = d.title; $('cSub').textContent = d.sub;
  const t = $('cRows'); t.replaceChildren();
  for (const [a, b] of d.rows) { const tr = t.insertRow(); tr.insertCell().textContent = a; tr.insertCell().textContent = b; }
  const w = $('cWiki'); w.hidden = !d.wiki;
  if (d.wiki) w.href = `https://${getLang()}.wikipedia.org/w/index.php?search=` + encodeURIComponent(d.wiki);
  const cp = $('cPath'), pc = rgbCss(colorOf(sel));
  cp.style.setProperty('--pc', pc); cp.setAttribute('aria-pressed', paths.has(pathId(sel)));
  $('cZoom').hidden = sel.kind !== 'body';
  const ca = $('cAll'); ca.hidden = sel.kind !== 'star'; ca.style.setProperty('--pc', rgbCss(STAR_PATH)); ca.setAttribute('aria-pressed', trails.on); ca.lastChild.textContent = trailLabel();
  card.hidden = false; updateTrackUI();
}
$('cClose').onclick = () => { sel = null; rsKey = ''; rs = null; refreshCard(); updateTrackUI(); };
const toggleTrack = () => { if (!sel) return; if (sameObj(track, sel)) stopTrack(); else startTrack(sel); };
$('cTrack').onclick = toggleTrack;
$('cZoom').onclick = () => { if (sel) zoomTo(sel); };
$('trackStop').onclick = stopTrack;


// ── Trayectorias: cada objeto activado conserva la suya, con su color (±12 h alrededor del instante actual, un punto cada 10 min) ──
// Lo ya recorrido se dibuja tenue y lo que viene, más claro. Los cuerpos se consultan a Caelis en tandas; las estrellas se calculan directo.
const PATH_STEP = 600000, PATH_HALF = 72, PATH_BUCKET = 6 * 3600000;
const PATH_COLORS = { Sol: [1, 0.82, 0.24], Luna: [0.86, 0.9, 1], Mercurio: [0.78, 0.72, 0.62], Venus: [1, 0.6, 0.8], Marte: [1, 0.33, 0.25], Jupiter: [1, 0.66, 0.3], Saturno: [0.9, 0.76, 0.36], Urano: [0.43, 0.89, 0.93], Neptuno: [0.38, 0.5, 1] };
const STAR_PATH = [0.72, 0.82, 1];
const rgbCss = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
const paths = new Map();                                    // id -> { obj, col, past, fut, key, pts, splitAt }
const pathId = (o) => (o.kind === 'body' ? o.key : 'star:' + o.i);
const colorOf = (o) => (o.kind === 'body' ? PATH_COLORS[o.key] || [1, 0.82, 0.35] : STAR_PATH);
const trails = { on: false, mode: 0, mesh: null, key: '', live: null, liveKey: '', t0: 0 };   // trayectorias de todas las estrellas brillantes; mode: 0 apagado, 1 en vivo, 2 ciclo completo
const trailLabel = () => T(['card.all', 'card.allLive', 'card.allCycle'][trails.mode]);
function setSegments(mesh, pts) {
  const a = new Float32Array(Math.max(0, pts.length - 1) * 6);
  for (let i = 0; i < pts.length - 1; i++) { a.set(pts[i], 6 * i); a.set(pts[i + 1], 6 * i + 3); }
  mesh.geometry.dispose(); mesh.geometry = new THREE.BufferGeometry(); mesh.geometry.setAttribute('position', new THREE.BufferAttribute(a, 3)); mesh.visible = pts.length > 1;
}
function renderPathChip() {
  const chip = $('pathChip'); chip.replaceChildren();
  const pill = (label, col, onRemove) => {
    const e = document.createElement('span'); e.className = 'pp'; e.style.setProperty('--pc', rgbCss(col)); e.append(label + ' ');
    const x = document.createElement('button'); x.textContent = '✕'; x.setAttribute('aria-label', T('chip.removePath', { name: label })); x.onclick = onRemove; e.append(x); chip.append(e);
  };
  for (const [id, p] of paths) pill(p.obj.kind === 'body' ? bodyName(p.obj.key) : (starNameOf(p.obj.i) || T('chip.star')), p.col, () => { removePath(id); refreshCard(); });
  if (trails.on) pill(T(trails.mode === 1 ? 'chip.trailsLive' : 'chip.trailsCycle'), STAR_PATH, () => setTrailMode(0));
  chip.hidden = !paths.size && !trails.on;
}
function addPath(o) {
  const id = pathId(o); if (paths.has(id)) return;
  const col = colorOf(o);
  paths.set(id, { obj: { kind: o.kind, key: o.key, i: o.i }, col, past: makeLines(new Float32Array(6), col, idU, 0.35, 4), fut: makeLines(new Float32Array(6), col, idU, 0.95, 4), key: '', pts: [], splitAt: 0 });
  for (const m of [paths.get(id).past, paths.get(id).fut]) m.visible = false;
  renderPathChip();
}
function removePath(id) {
  const p = paths.get(id); if (!p) return;
  for (const m of [p.past, p.fut]) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  paths.delete(id); renderPathChip();
}
function splitPath(p) {
  const past = p.pts.filter((q) => q.t <= simMs).map((q) => q.v), fut = p.pts.filter((q) => q.t >= simMs).map((q) => q.v);
  if (past.length && fut.length) fut.unshift(past[past.length - 1]);
  setSegments(p.past, past); setSegments(p.fut, fut); p.splitAt = simMs;
}
function computePath(id, p, key, bucket) {
  const o = p.obj, tc = (bucket + 0.5) * PATH_BUCKET, pts = [];
  if (o.kind === 'star') {
    const e = starVec(o.i);
    for (let k = -PATH_HALF; k <= PATH_HALF; k++) { const t = tc + k * PATH_STEP; pts.push({ t, v: rotVec(skyRotation(lstNow + (360.98564736629 * (t - simMs)) / 86400000, obs.lat, tNow), e) }); }
    p.pts = pts; return splitPath(p);
  }
  let k = -PATH_HALF;
  (function chunk() {
    if (p.key !== key || !paths.has(id)) return;
    for (let c = 0; c < 12 && k <= PATH_HALF; c++, k++) { const t = tc + k * PATH_STEP, b = snapAt(t).bodies[o.key]; pts.push({ t, v: dirFromAltAz(b.alt_apparent_deg, b.az_deg) }); }
    if (k <= PATH_HALF) setTimeout(chunk, 0); else { p.pts = pts; splitPath(p); }
  })();
}
const TRAIL_MAG = 5.0, TRAIL_N = 36, TRAIL_STEP = 1200000;   // estrellas hasta magnitud 5; ±12 h cada 20 min
function updateTrails(bucket) {
  updateLiveTrails();
  if (trails.mode !== 2 || !starCat.length) { if (trails.mesh) trails.mesh.visible = false; return; }
  const key = `${bucket}|${obs.lat}|${obs.lon}|${starCat.length}`;
  if (key === trails.key) { if (trails.mesh) trails.mesh.visible = true; return; }
  trails.key = key;
  const tc = (bucket + 0.5) * PATH_BUCKET, idx = [];
  for (let i = 0; i < starCat.length; i++) if (starCat[i][2] <= TRAIL_MAG) idx.push(i);
  const mats = []; for (let k = -TRAIL_N; k <= TRAIL_N; k++) mats.push(skyRotation(lstNow + (360.98564736629 * (tc + k * TRAIL_STEP - simMs)) / 86400000, obs.lat, tNow));
  const a = new Float32Array(idx.length * 2 * TRAIL_N * 3); let o = 0;
  for (const i of idx) {
    const e = starVec(i); let prev = rotVec(mats[0], e);
    for (let k = 1; k < mats.length; k++) { const v = rotVec(mats[k], e); a[o++] = prev[0]; a[o++] = prev[1]; a[o++] = prev[2]; a[o++] = v[0]; a[o++] = v[1]; a[o++] = v[2]; prev = v; }
  }
  if (!trails.mesh) trails.mesh = makeLines(new Float32Array(6), STAR_PATH, idU, 0.3, 4);
  trails.mesh.geometry.dispose(); trails.mesh.geometry = new THREE.BufferGeometry(); trails.mesh.geometry.setAttribute('position', new THREE.BufferAttribute(a, 3)); trails.mesh.visible = true;
}
function updatePaths() {
  if (!last || !rotM) return;
  const bucket = Math.floor(simMs / PATH_BUCKET), key = `${bucket}|${obs.lat}|${obs.lon}`;
  for (const [id, p] of paths) {
    if (p.key !== key) { p.key = key; computePath(id, p, key, bucket); }
    else if (Math.abs(simMs - p.splitAt) > PATH_STEP && p.pts.length) splitPath(p);
  }
  updateTrails(bucket);
}
// Estelas en vivo: se precalculan ±24 h alrededor del instante en que se activan y solo se muestra lo recorrido entre ese instante y el actual (crecen al correr el tiempo, hacia delante o hacia atrás)
const LIVE_N = 72, LIVE_STEP = 1200000;
function updateLiveTrails() {
  if (trails.mode !== 1 || !starCat.length || !rotM) { if (trails.live) trails.live.visible = false; return; }
  if (Math.abs(simMs - trails.t0) > 48 * 3600000) trails.t0 = simMs;               // tras un salto grande de fecha, vuelve a empezar desde ahí
  const key = `${trails.t0}|${obs.lat}|${obs.lon}|${starCat.length}`;
  if (key !== trails.liveKey) {
    trails.liveKey = key;
    const idx = []; for (let i = 0; i < starCat.length; i++) if (starCat[i][2] <= TRAIL_MAG) idx.push(i);
    const mats = []; for (let k = -LIVE_N; k <= LIVE_N; k++) mats.push(skyRotation(lstNow + (360.98564736629 * (trails.t0 + k * LIVE_STEP - simMs)) / 86400000, obs.lat, tNow));
    const segs = idx.length * 2 * LIVE_N, P0 = new Float32Array(segs * 6), P1 = new Float32Array(segs * 6), T = new Float32Array(segs * 4), W = new Float32Array(segs * 2);
    let s = 0;
    for (const i of idx) {
      const e = starVec(i); let prev = rotVec(mats[0], e);
      for (let k = 1; k < mats.length; k++) {
        const v = rotVec(mats[k], e), t0 = (k - 1 - LIVE_N) * LIVE_STEP / 1000, t1 = (k - LIVE_N) * LIVE_STEP / 1000;
        for (let w = 0; w < 2; w++, s++) { P0.set(prev, 3 * s); P1.set(v, 3 * s); T[2 * s] = t0; T[2 * s + 1] = t1; W[s] = w; }
        prev = v;
      }
    }
    if (!trails.live) { trails.live = add(new THREE.LineSegments(new THREE.BufferGeometry(), mk(TRAIL_VS, LINE_FS, { uRot: idU, uWin: { value: new THREE.Vector2() }, uCol: { value: new THREE.Color(...STAR_PATH) }, uA: { value: 0.3 } }, ADD)), 4); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P0, 3)); g.setAttribute('aP1', new THREE.BufferAttribute(P1, 3)); g.setAttribute('aT', new THREE.BufferAttribute(T, 2)); g.setAttribute('aW', new THREE.BufferAttribute(W, 1));
    trails.live.geometry.dispose(); trails.live.geometry = g;
  }
  trails.live.visible = true; setLiveWindow();
}
function setLiveWindow() {                         // llamado en cada cuadro: la ventana de tiempo visible sigue al reloj simulado
  if (!trails.live || trails.mode !== 1) return;
  const now = (simMs - trails.t0) / 1000;
  trails.live.material.uniforms.uWin.value.set(Math.min(0, now), Math.max(0, now));
}
function setTrailMode(m) { trails.mode = m; trails.on = m > 0; trails.key = ''; if (m === 1) { trails.t0 = simMs; trails.liveKey = ''; } if (m === 0 && trails.live) trails.live.visible = false; renderPathChip(); refreshCard(); dirty = true; }
$('cPath').onclick = () => { if (!sel) return; const id = pathId(sel); if (paths.has(id)) removePath(id); else addPath(sel); refreshCard(); };
$('cAll').onclick = () => setTrailMode((trails.mode + 1) % 3);

function selectionForName(value) {            // lo que se busca por nombre también queda seleccionado (ficha y botón Seguir)
  const v = normName(value);
  const key = BODY_KEYS.find((k) => normName(bodyName(k, 'en')) === v || normName(bodyName(k, 'es')) === v);
  if (key) return { kind: 'body', key };
  const n = names.find((x) => normName(x.name) === v || normName(starName(x.name, 'en')) === v);
  if (n) { for (const [i, nm] of overlayNames()) if (nm === n.name) return { kind: 'star', i }; }
  return null;
}

// ── Tiempo y motor ─────────────────────────────────────────────────────────────
let simMs = Date.now(), speed = 1, dirty = true, lastUpdate = 0, last = null, engineUs = 0;
setLandscape(1);
const fmtMag = (m) => (Number.isFinite(m) ? m.toFixed(2).replace('-', '−') : '—');

register(bi('Sol'), () => last && { alt: last.Sol.alt_apparent_deg, az: last.Sol.az_deg });
register(bi('Luna'), () => last && { alt: last.Luna.alt_apparent_deg, az: last.Luna.az_deg });
for (const n of PNAMES) register(bi(n), () => last && last[n] && { alt: last[n].alt_apparent_deg, az: last[n].az_deg });
rebuildObjList();

const toLocalInput = (ms) => toInputValue(ms, obsTz);

function snapAt(ms) {
  const jdUtc = ms / 86400000 + 2440587.5;
  return getSnapshotAt(jdUtc + deltaT(jdUtc) / 86400, obs.lat, obs.lon);
}

// Geometría del eclipse en un instante: separación topocéntrica Sol-Luna y fracción del disco solar tapada.
function eclipseGeometry(bodies) {
  const { Sol, Luna } = bodies;
  const sd = dirFromAltAz(Sol.alt_apparent_deg, Sol.az_deg), md = dirFromAltAz(Luna.alt_apparent_deg, Luna.az_deg);
  const sep = Math.acos(clamp(dot3(sd, md), -1, 1));
  const rSun = Math.asin(696000 / (Sol.dist_au * 149597870.7));
  const rMoon = Math.asin(1737.4 / moonTopoDist(Luna.dist_km, Luna.alt_geometric_deg ?? Luna.alt_apparent_deg));
  const obsc = solarObscuration(sep, rSun, rMoon);
  return { sepDeg: sep / D2R, rSun, rMoon, obsc, dark: eclipseDarkness(obsc) };
}

function update() {
  const t0 = performance.now();
  const snap = snapAt(simMs);
  engineUs = (performance.now() - t0) * 1000;
  last = snap.bodies;
  const { Sol, Luna } = last;
  lstNow = snap.meta.sidereal.lst_deg; tNow = (snap.meta.jd_tt - 2451545) / 36525; lunaNow = snap.luna;
  rotM = skyRotation(lstNow, obs.lat, tNow); starU.uRot.value.set(...rotM);
  rotDate = skyRotation(lstNow, obs.lat, 0); dateU.value.set(...rotDate); domeU.uRot.value.set(...rotM);

  // Eclipse solar: cuánto del Sol tapa la Luna y qué tan oscuro se ve el cielo
  const eg = eclipseGeometry(last);
  eclNow = { ...eg };
  const sunAlt = Sol.alt_apparent_deg, dark = eg.dark;
  skyAlt = eclipseAlt(sunAlt, dark);
  bodies.sun = { alt: sunAlt, az: Sol.az_deg, ang: eg.rSun };
  bodies.moon = { alt: Luna.alt_apparent_deg, az: Luna.az_deg, ang: eg.rMoon, distKm: Luna.dist_km };

  // Eclipse lunar: dirección geocéntrica de la Luna y del eje de la sombra de la Tierra (opuesto al Sol), en ejes de la escena
  const obl = snap.meta.obliquity.true_deg;
  const mEq = eclToEq(Luna.lon_ecl_geocentric_deg, Luna.lat_ecl_geocentric_deg, obl);
  eclNow.moonGeo = rotVec(rotDate, equatorialVector(mEq.ra, mEq.dec));
  eclNow.antiSun = rotVec(rotDate, equatorialVector((Sol.ra_deg + 180) % 360, -Sol.dec_deg));
  const eclPoleEq = eclToEq(0, 90, obl); eclNow.eclPole = rotVec(rotDate, equatorialVector(eclPoleEq.ra, eclPoleEq.dec));
  const shadowKm = Math.acos(clamp(dot3(eclNow.moonGeo, eclNow.antiSun), -1, 1)) * Luna.dist_km;
  eclNow.shadowOn = shadowKm < MAX_KM + 1737.4 * 1.3;
  moonU.uShadowOn.value = eclNow.shadowOn ? 1 : 0;
  if (eclNow.shadowOn) ensureLut(Luna.dist_km, eg.rSun);

  // Cielo (la paleta usa la altura efectiva del Sol)
  const pal = skyPalette(skyAlt);
  domeU.uZenith.value.setRGB(...pal.zenith); domeU.uHorizon.value.setRGB(...pal.horizon); domeU.uGlow.value.setRGB(...pal.glow);
  domeU.uGlowA.value = pal.glowA * (1 - dark); domeU.uNight.value = pal.night;
  domeU.uGlare.value = Math.pow(Math.max(1 - eg.obsc, 0), 0.6);
  domeU.uRing.value = dark * dark * smooth(-2, 8, sunAlt);
  domeU.uSunDir.value.set(...dirFromAltAz(sunAlt, Sol.az_deg));
  const hz = pal.horizon, tone = (k, b, m = [1, 1, 1]) => [hz[0] * k * m[0] + b, hz[1] * k * m[1] + b, hz[2] * k * m[2] + b];
  groundU.uGround.value.setRGB(...tone(0.16, 0.008, [0.85, 1.05, 0.8]));    // césped: ligeramente verdoso de día
  groundU.uHaze.value.setRGB(...tone(0.55, 0));
  groundU.uCol0.value.setRGB(...tone(0.50, 0.006)); groundU.uCol1.value.setRGB(...tone(0.34, 0.005));
  groundU.uCol2.value.setRGB(...tone(0.19, 0.004)); groundU.uCol3.value.setRGB(...tone(0.08, 0.003));
  groundU.uLamps.value = clamp((2 - skyAlt) / 8, 0, 1);                      // las luces se encienden al anochecer (y en la totalidad)

  // Sol: tinte por masa de aire, corona y cromosfera solo cuando casi todo el disco está tapado
  sunU.uTint.value.set(...extinction(sunAlt));
  sunU.uObsc.value = eg.obsc; sunU.uCorona.value = smooth(0.6, 0.85, dark); sunU.uChromo.value = smooth(0.5, 0.85, dark);
  sunU.uDiamond.value = smooth(0.985, 0.998, eg.obsc) * (1 - smooth(0.9995, 0.99995, eg.obsc));
  moonU.uTint.value.set(...extinction(Luna.alt_apparent_deg));
  moonU.uDay.value = clamp((skyAlt + 6) / 10, 0, 1);

  // magnitudes aparentes (Mallama y Hilton 2018 para los planetas)
  const elo = (b) => elongationDeg(b.ra_deg, b.dec_deg, Sol.ra_deg, Sol.dec_deg);
  mags = { Sol: sunMagnitude(Sol.dist_au), Luna: moonMagnitude(Luna.dist_km, planetPhase(Luna.dist_km / AU_KM, Sol.dist_au, elo(Luna)).phaseAngle) };
  PNAMES.forEach((n, i) => {
    const b = last[n]; if (!b) return;
    planetDirs.set(dirFromAltAz(b.alt_apparent_deg, b.az_deg), 3 * i);
    const ph = planetPhase(b.dist_au, Sol.dist_au, elo(b));
    mags[n] = planetMagnitude(n, ph.r, b.dist_au, ph.phaseAngle, n === 'Saturno' ? saturnRingSinB(b.ra_deg, b.dec_deg) : 0);
    magsVis[n] = Math.min(mags[n], 6.3); planetMagAttr.array[i] = magsVis[n];
  });
  planetMagAttr.needsUpdate = true;
  planetPts.geometry.attributes.position.needsUpdate = true;
  // geometría de los discos: dirección, tamaño, hacia dónde está el Sol visto desde cada planeta y el eje norte (ejes de la escena)
  const sunDirG = rotVec(rotDate, equatorialVector(Sol.ra_deg, Sol.dec_deg)), poleOf = (nm) => rotVec(rotDate, equatorialVector(...PLANET_DATA[nm].pole));
  sunState = { pole: poleOf('Sol'), cm: centralMeridianTurns('Sol', snap.meta.jd_tt) };
  for (const n of PNAMES) {
    const b = last[n]; if (!b) continue;
    pstate[n] = { dir: dirFromAltAz(b.alt_apparent_deg, b.az_deg), ang: angularRadius(PLANET_DATA[n].km, b.dist_au),
      sunVec: sunFromBody(rotVec(rotDate, equatorialVector(b.ra_deg, b.dec_deg)), b.dist_au, sunDirG, Sol.dist_au),
      pole: poleOf(n), cm: centralMeridianTurns(n, snap.meta.jd_tt), tint: extinction(b.alt_apparent_deg) };
  }

  if (!gridEcl) { gridEcl = makeGrid(eclipticLine(obl), [1, 0.85, 0.3], dateU, 0.7); gridEcl.visible = showEcl; }
  lineU.uA.value = 0.35 * lineAlpha(skyAlt);
  if (lineMesh) lineMesh.visible = showConst && lineU.uA.value > 0.005;
  starU.uMagLim.value = magLimit(skyAlt);
  if (starPts) starPts.visible = starU.uMagLim.value > -1.4;

  const f = (x) => x.toFixed(1) + '°';
  { const zs = `${zoneName(obsTz)}|${fmtOffset(simMs, obsTz)}`; $('clock').innerHTML = `<b>${fmtClock(simMs, obsTz)}</b> <small>${T('clock.zone', { zone: zoneName(obsTz), off: fmtOffset(simMs, obsTz), utc: new Date(simMs).toISOString().slice(11, 19) })}</small>`; fitClock(zs); }
  renderDrums(); ensureDayGradient(); $('dayLabel').textContent = dayLabel(sunAlt);
  $('sol').textContent = T('info.sun', { alt: f(sunAlt), az: f(Sol.az_deg) });
  $('luna').textContent = T('info.moon', { alt: f(Luna.alt_apparent_deg), az: f(Luna.az_deg), ill: (snap.luna.illumination * 100).toFixed(0) });
  $('perf').textContent = T('info.perf', { us: engineUs.toFixed(0) });
  $('ecl').textContent = eclipseText(snap, eg);
  lastUpdate = performance.now(); dirty = false;
  refreshCard();
}

// Línea de estado de eclipse en el panel
function eclipseText(snap, eg) {
  if (eg.obsc > 0.0005 && last.Sol.alt_apparent_deg > -1) {
    const pct = (eg.obsc * 100).toFixed(eg.obsc > 0.99 ? 3 : 1);
    if (eg.obsc >= 0.99995) return T(eg.rMoon >= eg.rSun ? 'ecl.solarTotal' : 'ecl.solarAnnular');
    return T('ecl.solarPct', { pct });
  }
  const li = lunarEclipseInfo(snap);
  if (li) {
    const where = last.Luna.alt_apparent_deg < 0 ? T('ecl.below') : '';
    if (li.umbMag > 0) return T('ecl.lunar', { type: T('ecl.type.' + li.type), mag: li.umbMag.toFixed(2), where });
    return T('ecl.pen', { mag: li.penMag.toFixed(2), where });
  }
  return '';
}

// Campo de visión que deja el disco de un cuerpo ocupando ~40% de la altura de la pantalla (Saturno cuenta con sus anillos)
function zoomFovFor(key) {
  const rad = key === 'Sol' ? bodies.sun.ang : key === 'Luna' ? bodies.moon.ang : angularRadius(PLANET_DATA[key].km, last[key].dist_au);
  return clamp(2 * rad / D2R * 2.5 * (key === 'Saturno' ? SATURN_RING_OUTER : 1), MIN_FOV, 60);
}
function zoomTo(o) {
  if (o.kind !== 'body') return;
  startTrack(o); const b = last[o.key];
  goal = { az: b.az_deg, alt: b.alt_apparent_deg, fov: zoomFovFor(o.key) };
}
// ── Buscador de eventos (fases, estaciones y eclipses calculados con Caelis) ──
// Los eclipses se buscan SOLO si se ven desde la ubicación del observador: solar = el Sol sobre el horizonte en el máximo local y el disco tocado por la Luna;
// lunar = la Luna sobre el horizonte en el máximo. Se salta todo lo que no cumpla y se sigue con el siguiente.
const fmtLocal = (ms) => fmtDateTime(ms, obsTz);
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
const EV_SPAN = { 'solar:total': 300, 'solar:annular': 300, 'solar:parcial': 80, solar: 80, lunar: 40, 'lunar:total': 60, 'lunar:parcial': 40, 'lunar:penumbral': 40 };   // años máximos de búsqueda
const EVENTS = [
  { id: 'solar', label: 'ev.solar', sub: [['solar:total', 'ev.total'], ['solar:parcial', 'ev.partial'], ['solar:annular', 'ev.annular']] },
  { id: 'lunar', label: 'ev.lunar', sub: [['lunar:total', 'ev.total'], ['lunar:parcial', 'ev.partial'], ['lunar:penumbral', 'ev.penumbral']] },
  { id: 'new', label: 'ev.new' }, { id: 'season', label: 'ev.season' },
];
let evSel = 'solar', evBusy = false;
const evName = (id) => { const [k, sub] = id.split(':'), e = EVENTS.find((x) => x.id === k); return T(e.label) + (sub ? ' · ' + T(e.sub.find((q) => q[0] === id)[1]) : ''); };
function buildEvMenu() {
  const list = $('evList'); list.replaceChildren();
  const item = (id, label, cur) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.dataset.ev = id; if (cur) b.className = 'cur'; b.textContent = label; return b; };
  for (const e of EVENTS) {
    const li = document.createElement('li'), b = item(e.id, T(e.label), evSel === e.id || evSel.startsWith(e.id + ':'));
    if (e.sub) {
      b.append(Object.assign(document.createElement('span'), { textContent: '▸' }));
      const ul = document.createElement('ul'); ul.setAttribute('role', 'menu');
      for (const [sid, key] of e.sub) { const l2 = document.createElement('li'); l2.append(item(sid, T(key), evSel === sid)); ul.append(l2); }
      const note = document.createElement('span'); note.className = 'note'; note.textContent = T('ev.visibleNote'); ul.append(note);
      li.append(b, ul);
      li.addEventListener('mouseenter', () => { for (const o of list.querySelectorAll('li.open')) o.classList.remove('open'); li.classList.add('open'); });
      li.addEventListener('mouseleave', () => li.classList.remove('open'));
      b.addEventListener('click', (ev) => {                                // sin cursor (táctil): un toque abre la cascada; con ratón, el clic elige "cualquier tipo" y la cascada se abre al pasar
        if (!matchMedia('(hover: none)').matches) return;
        ev.stopPropagation(); const open = li.classList.contains('open'); for (const o of list.querySelectorAll('li.open')) o.classList.remove('open'); if (!open) li.classList.add('open');
      });
    } else li.append(b);
    list.append(li);
  }
  $('evLabel').textContent = evName(evSel);
}
function setEvMenuOpen(on) { $('evList').hidden = !on; $('evBtn').setAttribute('aria-expanded', on); if (!on) for (const o of $('evList').querySelectorAll('li.open')) o.classList.remove('open'); }
$('evBtn').onclick = (e) => { e.stopPropagation(); setEvMenuOpen($('evList').hidden); };
$('evList').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-ev]'); if (!b) return;
  evSel = b.dataset.ev; buildEvMenu(); setEvMenuOpen(false);
});
document.addEventListener('click', (e) => { if (!$('evMenu').contains(e.target)) setEvMenuOpen(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('evList').hidden) { setEvMenuOpen(false); e.stopImmediatePropagation(); } }, true);

async function searchEvent(dir) {
  if (evBusy) return;
  const [kind, sub] = evSel.split(':'), from = simMs + dir * 6 * 3600000, yrs = EV_SPAN[evSel] ?? 40;
  evBusy = true; say(T('ev.searching'));
  try {
    let ms, look = 'Luna', text, fov;
    if (kind === 'solar' || kind === 'lunar') {
      const info = {};                                           // circunstancias locales del eclipse aceptado
      const accept = (r) => {
        if (kind === 'solar') {
          const l = localSolarInfo(snapAt, r.ms), k = localSolarKind(l); if (!k) return false;
          if (sub && sub !== (k === 'anular' ? 'annular' : k)) return false;
          info.l = l; info.k = k; return true;
        }
        if (sub && sub !== r.type) return false;
        return snapAt(r.ms).bodies.Luna.alt_apparent_deg > 0;
      };
      const r = await findEclipseWhere(snapAt, from, kind, dir, accept, yrs, (y) => say(T('ev.searchingN', { n: y })));
      const what = T('ev.what.' + (sub ? evSel.replace(':', '.') : kind));
      if (!r) return say(T(dir > 0 ? 'ev.none' : 'ev.noneBack', { what, years: yrs }));
      look = kind === 'solar' ? 'Sol' : 'Luna';
      if (kind === 'solar') {
        ms = info.l.ms; fov = 14;
        const g = eclipseGeometry(snapAt(ms).bodies), shown = T('ev.what.solar.' + ({ anular: 'annular', parcial: 'partial' }[info.k] || info.k));
        text = T('ev.res.solar', { what: cap(shown), time: fmtLocal(ms), cover: g.obsc >= 0.99995 ? T('ev.res.cover.total') : T('ev.res.cover.pct', { pct: (g.obsc * 100).toFixed(1) }), below: '' }).trim();
      } else {
        ms = r.ms; fov = 25;
        text = T('ev.res.lunar', { what: cap(T('ev.what.lunar.' + (r.type === 'parcial' ? 'partial' : r.type))), time: fmtLocal(ms), mag: (r.umbMag > 0 ? r.umbMag : r.penMag).toFixed(2), up: T('ev.res.moonUp') });
      }
    } else if (kind === 'season') {
      const c = [0, 90, 180, 270].map((t0) => findSunLongitude(snapAt, from, t0, dir));
      ms = dir > 0 ? Math.min(...c) : Math.max(...c); look = 'Sol'; fov = 60;
      text = T('ev.season.' + c.indexOf(ms)) + ': ' + fmtLocal(ms);
    } else {
      ms = findPhase(snapAt, from, 0, dir); fov = 60;
      text = T('ev.res.new', { time: fmtLocal(ms) });
    }
    simMs = ms; setSpeed(0); update();
    const b = last[look]; stopTrack(); goal = { az: b.az_deg, alt: Math.max(b.alt_apparent_deg, -5), fov };
    say(text);
  } catch (err) { console.error(err); say(T('ev.error', { msg: err.message })); }
  finally { evBusy = false; }
}
$('evPrev').onclick = () => searchEvent(-1);
$('evNext').onclick = () => searchEvent(1);

// ── Controles ──────────────────────────────────────────────────────────────────
const cv = $('c');
const ptrs = new Map();
let down = null;
const clampFov = (v) => clamp(v, MIN_FOV, maxFov(view.mode));
cv.addEventListener('pointerdown', (e) => {
  ptrs.set(e.pointerId, [e.clientX, e.clientY]); goal = null; cv.setPointerCapture(e.pointerId);
  if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), pinch: false }; else if (down) down.pinch = true;
});
cv.addEventListener('pointerup', (e) => {
  ptrs.delete(e.pointerId);
  if (down && !down.pinch && ptrs.size === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 600) {
    sel = pick(e.clientX, e.clientY); rsKey = ''; rs = null; refreshCard();
  }
  if (ptrs.size === 0) down = null;
});
cv.addEventListener('dblclick', (e) => {            // doble clic sobre un objeto: lo selecciona y lo sigue
  const p = pick(e.clientX, e.clientY); if (!p) return;
  sel = p; rsKey = ''; rs = null; startTrack(p); refreshCard();
  if (p.kind === 'body' && view.fov > zoomFovFor(p.key) * 1.2) goal = { az: last[p.key].az_deg, alt: last[p.key].alt_apparent_deg, fov: zoomFovFor(p.key) };
});
cv.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); down = null; });
cv.addEventListener('pointermove', (e) => {
  const prev = ptrs.get(e.pointerId); if (!prev) return;
  ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 2) { // pellizco: zoom
    const other = [...ptrs.entries()].find(([id]) => id !== e.pointerId)[1];
    const d0 = Math.hypot(prev[0] - other[0], prev[1] - other[1]), d1 = Math.hypot(e.clientX - other[0], e.clientY - other[1]);
    if (d0 > 0 && d1 > 0) view.fov = clampFov((view.fov * d0) / d1);
    return;
  }
  if (track && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) stopTrack();   // arrastrar a mano suelta el seguimiento
  const k = 1 / focal / D2R;       // grados por píxel en el centro de la pantalla (en todas las proyecciones la escala central es f)
  view.az = (view.az - (e.clientX - prev[0]) * k + 360) % 360;
  view.alt = clamp(view.alt + (e.clientY - prev[1]) * k, -90, 90);
});
cv.addEventListener('wheel', (e) => { e.preventDefault(); goal = null; view.fov = clampFov(view.fov * Math.exp(e.deltaY * 0.0012)); }, { passive: false });
$('now').onclick = () => { simMs = Date.now(); setSpeed(1); dirty = true; };
$('mw').oninput = (e) => { mwScale = +e.target.value; applyMW(); };
$('land').onchange = (e) => setLandscape(+e.target.value);
$('proj').onchange = (e) => { view.mode = +e.target.value; view.fov = clampFov(view.fov); };
const setDanjonLbl = () => { $('danjonLbl').textContent = T('opt.danjon', { v: danjon.toFixed(1) }); };
$('danjon').oninput = (e) => { danjon = +e.target.value; setDanjonLbl(); dirty = true; };
$('geo').onclick = () => navigator.geolocation
  ? navigator.geolocation.getCurrentPosition((p) => {
      obs.lat = +p.coords.latitude.toFixed(3); obs.lon = +p.coords.longitude.toFixed(3); refreshTz();
      $('lat').value = obs.lat; $('lon').value = obs.lon; dirty = true; say(T('info.located'));
    }, () => say(T('info.noGeo')))
  : say(T('info.noGeoApi'));
$('q').onchange = (e) => {
  const fn = registry.get(normName(e.target.value)), p = fn && fn();
  if (!p) return say(T('info.notFound', { q: e.target.value }));
  stopTrack(); goal = { az: p.az, alt: clamp(p.alt, -90, 90) };
  const picked = selectionForName(e.target.value); if (picked) { sel = picked; rsKey = ''; rs = null; refreshCard(); }
  const shown = picked ? (picked.kind === 'body' ? bodyName(picked.key) : starNameOf(picked.i) || e.target.value) : e.target.value;
  say(p.alt < 0 ? T('info.below', { name: shown, alt: p.alt.toFixed(0) }) : T('info.above', { name: shown, alt: p.alt.toFixed(0) }));
};
// ── Barra de tiempo: ruedas de fecha y hora, deslizador del día y velocidades hacia adelante y hacia atrás ──
const PAUSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>', PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>';
let prevSpeed = 1;
function setSpeed(v) {
  speed = v; if (v) prevSpeed = v;
  document.querySelectorAll('#speedRow button').forEach((b) => b.classList.toggle('on', +b.dataset.sp === v));
  const pp = $('playPause'); pp.innerHTML = v ? PAUSE_SVG : PLAY_SVG; pp.classList.toggle('on', !v); pp.title = T(v ? 'time.pause' : 'time.resume');
}
const togglePause = () => setSpeed(speed ? 0 : prevSpeed || 1);
document.querySelectorAll('#speedRow button').forEach((b) => { b.onclick = () => setSpeed(+b.dataset.sp); });
$('playPause').onclick = togglePause;
const unitLabel = (u) => T('unit.' + u);
const drumLabel = (b) => T(+b.dataset.d > 0 ? 'unit.inc' : 'unit.dec', { u: unitLabel(b.dataset.u) });
function buildDrums(el, units, sep) {
  units.forEach((u, i) => {
    if (i) { const x = document.createElement('span'); x.className = 'sep'; x.textContent = sep; el.append(x); }
    const d = document.createElement('div'); d.className = 'drum';
    d.innerHTML = `<button data-u="${u}" data-d="1">▲</button><span class="val${u === 'year' ? ' y' : ''}" data-v="${u}"></span><button data-u="${u}" data-d="-1">▼</button>`;
    el.append(d);
  });
}
buildDrums($('dDate'), ['year', 'month', 'day'], '-'); buildDrums($('dTime'), ['hour', 'minute', 'second'], ':');
const relabelDrums = () => document.querySelectorAll('.drum button').forEach((b) => b.setAttribute('aria-label', drumLabel(b)));
{ // mantener pulsado repite el paso
  let t1 = 0, t2 = 0; const stop = () => { clearTimeout(t1); clearInterval(t2); };
  const step = (b) => { simMs = stepWall(simMs, b.dataset.u, +b.dataset.d, obsTz); dirty = true; };
  document.querySelectorAll('.drum').forEach((d) => d.addEventListener('wheel', (e) => { e.preventDefault(); step(d.querySelector(`button[data-d="${e.deltaY < 0 ? 1 : -1}"]`)); }, { passive: false }));
  document.querySelectorAll('.drum button').forEach((b) => {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); step(b); stop(); t1 = setTimeout(() => { t2 = setInterval(() => step(b), 90); }, 420); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); step(b); } });
  });
}
const pad2 = (n) => String(n).padStart(2, '0');
function renderDrums() {
  const p = partsAt(simMs, obsTz);
  for (const u of ['year', 'month', 'day', 'hour', 'minute', 'second']) { const el = document.querySelector(`[data-v="${u}"]`), v = u === 'year' ? String(p.year) : pad2(p[u]); if (el.textContent !== v) el.textContent = v; }
  if (!dayDrag) $('dayRange').value = p.hour * 60 + p.minute;
}
let dayDrag = false;
$('dayRange').addEventListener('pointerdown', () => { dayDrag = true; });
addEventListener('pointerup', () => { dayDrag = false; });
$('dayRange').addEventListener('input', (e) => { const p = partsAt(simMs, obsTz); simMs = wallToMs(Date.UTC(p.year, p.month - 1, p.day, 0, +e.target.value, 0), obsTz); dirty = true; });
// Franja del día: el color sigue la altura del Sol (calculada con Caelis cada 30 min), como una barra de luz del día
const dayGrad = { key: '', alts: [] };
const dayColor = (alt) => {
  const k = smooth(-18, 3, alt), tw = Math.exp(-(((alt + 3) / 5) ** 2)) * 0.9, day = [32, 104, 132];
  return `rgb(${Math.round(day[0] * k + 70 * tw)},${Math.round(day[1] * k + 28 * tw)},${Math.round(day[2] * k + 10 * tw)})`;
};
function ensureDayGradient() {
  const key = `${dayIndex(simMs, obsTz)}|${obs.lat}|${obs.lon}`; if (key === dayGrad.key) return;
  dayGrad.key = key; dayGrad.alts = [];
  const p = partsAt(simMs, obsTz), mid = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0), alts = [];
  let k = 0;
  (function chunk() {
    if (dayGrad.key !== key) return;
    for (let c = 0; c < 6 && k <= 48; c++, k++) alts.push(snapAt(wallToMs(mid + k * 1800000, obsTz)).bodies.Sol.alt_apparent_deg);
    if (k <= 48) return void setTimeout(chunk, 0);
    dayGrad.alts = alts;
    $('dayRange').style.background = `linear-gradient(to right, ${alts.map((a, i) => `${dayColor(a)} ${(i / 48) * 100}%`).join(', ')})`;
    dirty = true;
  })();
}
function dayLabel(sunAlt) {
  const p = partsAt(simMs, obsTz), i = Math.round((p.hour * 60 + p.minute) / 30), A = dayGrad.alts;
  const rising = A.length === 49 ? A[Math.min(48, i + 1)] > A[Math.max(0, i - 1)] : p.hour < 12;
  if (sunAlt >= 6) return T('day.day');
  if (sunAlt >= -0.83) return T(rising ? 'day.sunrise' : 'day.sunset');
  if (sunAlt >= -18) return T(rising ? 'day.dawn' : 'day.dusk');
  return T('day.night');
}
setSpeed(speed);
// Pantalla completa
if (!document.fullscreenEnabled) $('fsBtn').hidden = true;
const toggleFS = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); };
$('fsBtn').onclick = toggleFS;
document.addEventListener('fullscreenchange', () => resize());
// Calendario: fecha y hora locales del lugar, y un botón "Ir" que aplica el cambio (o "Cancelar" para cerrar sin cambiar nada)
{
  const pop = $('calPop'), btn = $('calBtn');
  const show = (on) => { pop.hidden = !on; btn.setAttribute('aria-expanded', on); $('calErr').textContent = ''; };
  const open = () => { const v = toLocalInput(simMs); $('calDate').value = v.slice(0, 10); $('calTime').value = v.slice(11, 16); show(true); $('calDate').focus(); };
  const go = () => {
    const ms = fromInputValue(`${$('calDate').value}T${$('calTime').value}`, obsTz);
    if (!Number.isFinite(ms)) { $('calErr').textContent = T('cal.invalid'); return; }
    simMs = ms; setSpeed(0); dirty = true; show(false);
  };
  btn.onclick = (e) => { e.stopPropagation(); if (pop.hidden) open(); else show(false); };
  $('calGo').onclick = go; $('calCancel').onclick = () => show(false);
  pop.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } else if (e.key === 'Escape') { e.stopPropagation(); show(false); btn.focus(); } });
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) show(false); });
}
// Paneles minimizables (el estado se recuerda en este navegador)
const minApply = [];
{
  const KEY = 'caeliscope.min'; let st = {}; try { st = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* sin almacenamiento */ }
  if (innerWidth < 700) { st.info ??= true; st.side ??= true; }   // en pantallas angostas parten minimizados
  const bar = $('bar'), setBarH = () => document.documentElement.style.setProperty('--barH', bar.offsetHeight + 'px');
  document.querySelectorAll('[data-min]').forEach((el) => {
    const id = el.dataset.min, btn = el.querySelector('.minbtn');
    const apply = () => { el.classList.toggle('mini', !!st[id]); btn.textContent = st[id] ? '+' : '–'; btn.title = T(st[id] ? 'panel.restore' : 'panel.min'); btn.setAttribute('aria-label', T(st[id] ? 'panel.restoreAria' : 'panel.minAria')); setBarH(); fitKey = ''; dirty = true; };
    btn.onclick = () => { st[id] = !st[id]; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* sin almacenamiento */ } apply(); };
    apply(); minApply.push(apply);
  });
  if (window.ResizeObserver) new ResizeObserver(setBarH).observe(bar); setBarH();
}
// Indicador del campo de visión: aparece solo mientras se hace zoom
let fovShown = view.fov, fovTimer = 0;
const fmtFov = (f) => (f >= 10 ? f.toFixed(0) + '°' : f >= 1 ? f.toFixed(1) + '°' : f >= 0.1 ? f.toFixed(2) + '°' : f >= 1 / 60 ? (f * 60).toFixed(1) + '′' : (f * 3600).toFixed(0) + '″');
function fovTick() {
  if (Math.abs(Math.log(view.fov / fovShown)) < 1e-3) return;
  fovShown = view.fov; const b = $('fovBox'); b.textContent = T('fov', { v: fmtFov(view.fov) }); b.classList.add('show');
  clearTimeout(fovTimer); fovTimer = setTimeout(() => b.classList.remove('show'), 1400);
}
addEventListener('keydown', (e) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('clean');
  const gk = { z: 'tAz', e: 'tEq', 4: 'tEcl', 6: 'tMer' }[e.key.toLowerCase()]; if (gk) $(gk).click();
  if (e.key === 'Escape') $('cClose').click();
  if (e.key === 'f' || e.key === 'F') toggleFS();
  if (e.key === 't' || e.key === 'T') toggleTrack();
  if ((e.key === 'c' || e.key === 'C') && sel) { stopTrack(); const t = sel.kind === 'body' ? { az: last[sel.key].az_deg, alt: last[sel.key].alt_apparent_deg } : horizontalOf(rotM, starVec(sel.i)); goal = { az: t.az, alt: clamp(t.alt, -90, 90) }; }
  if (e.key === ' ') {
    e.preventDefault();
    togglePause();
  }
});
for (const id of ['lat', 'lon']) $(id).onchange = () => {
  const v = +$(id).value;
  if (id === 'lat') obs.lat = clamp(v, -90, 90); else obs.lon = clamp(v, -180, 180);
  refreshTz();
  dirty = true;
};

// ── Idioma: inglés por defecto; el botón EN / ES cambia la interfaz, los nombres de los astros y las constelaciones ──
function applyLang() {
  applyStatic(); rebuildObjList(); buildEvMenu(); relabelDrums(); setSpeed(speed); setDanjonLbl(); renderGDetail();
  for (const f of minApply) f();
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', b.dataset.lang === getLang());
  frame.gt = ''; fitKey = ''; renderPathChip(); updateTrackUI(); refreshCard(); dirty = true;
}
for (const b of document.querySelectorAll('[data-lang]')) b.onclick = () => setLang(b.dataset.lang);
onLang(applyLang);

// ── Globo terrestre, portada y viajes entre el espacio y el cielo del observador ─────────────────────────────
const globe = new Globe(renderer, $('globeLayer'));
globe.resize(innerWidth, innerHeight); globe.center = { lat: 18, lon: wrap180(obs.lon + 70) }; globe.d = globe.fitD(6.2);
let appMode = 'splash', flowT = 0, dismissT = -1, journeyFrom = null, flew = false, pinned = false, gpA = 0;     // splash | globe | in | sky | leaving | out
const veil = $('veil'), gp = $('gpanel'), alpha = (el, a) => { el.style.opacity = a.toFixed(3); el.style.setProperty('--a', a.toFixed(3)); };
$('lat').value = obs.lat; $('lon').value = obs.lon;
const saveObs = () => { try { localStorage.setItem('caeliscope.obs', JSON.stringify(obs)); } catch { /* sin almacenamiento */ } };
function setObserver(lat, lon) {
  const la = +clamp(lat, -90, 90).toFixed(3), lo = +clamp(lon, -180, 180).toFixed(3), moved = la !== obs.lat || lo !== obs.lon;
  obs.lat = la; obs.lon = lo; refreshTz(); $('lat').value = la; $('lon').value = lo; saveObs();
  if (moved) { stopTrack(); sel = null; rs = null; rsKey = ''; refreshCard(); }
  dirty = true;
}
const setGlobeInputs = (p) => { $('glat').value = (+p.lat).toFixed(2); $('glon').value = (+p.lon).toFixed(2); };
const readGlobeInputs = () => { const la = parseFloat($('glat').value), lo = parseFloat($('glon').value); return Number.isFinite(la) && Number.isFinite(lo) ? { lat: clamp(la, -90, 90), lon: clamp(lo, -180, 180) } : null; };
let gStatus = '';
const renderGDetail = () => {
  const name = globe.tiles.sources[globe.tiles.src]?.name ?? '';
  $('gDetail').textContent = { cargando: T('globe.detail.loading'), activo: T('globe.detail.on', { name }), 'no disponible': T('globe.detail.off') }[gStatus] || '';
};
globe.tiles.onStatus = (st) => { // estado del detalle cartográfico, visible en el panel del globo
  gStatus = st; renderGDetail();
};
globe.onPick = (p) => { globe.setPin(p.lat, p.lon); setGlobeInputs(p); };
for (const id of ['glat', 'glon']) $(id).onchange = () => { const p = readGlobeInputs(); if (p) { globe.setPin(p.lat, p.lon); globe.flyTo(p.lat, p.lon); } };
$('gZp').onclick = () => globe.zoomBy(0.7); $('gZm').onclick = () => globe.zoomBy(1 / 0.7);
$('gGeo').onclick = () => navigator.geolocation
  ? navigator.geolocation.getCurrentPosition((g) => { const p = { lat: g.coords.latitude, lon: g.coords.longitude }; globe.setPin(p.lat, p.lon); setGlobeInputs(p); globe.flyTo(p.lat, p.lon); }, () => {})
  : null;
function goSky() { // el globo se acerca al pin y se transforma en el cielo del observador
  if (appMode !== 'globe') return;
  const p = readGlobeInputs() || globe.pin; if (!p) return;
  globe.setPin(p.lat, p.lon, false); setObserver(p.lat, p.lon); update();
  veil.style.background = `rgb(${fadeColor(last.Sol.alt_apparent_deg)})`;
  journeyFrom = { d: globe.d, lat: globe.center.lat, lon: globe.center.lon };
  globe.interactive = false; globe.goal = null; globe.spin = 0; appMode = 'in'; flowT = 0;
}
function newLocation() { // desde el cielo: la cortina cubre la vista y el globo vuelve a alejarse
  if (appMode !== 'sky') return;
  veil.style.background = `rgb(${fadeColor(last ? last.Sol.alt_apparent_deg : 0)})`; appMode = 'leaving'; flowT = 0;
}
function flowTick(ms) {
  flowT += ms;
  if (appMode === 'splash') {
    if (dismissT >= 0) dismissT += ms;
    const st = splashState(flowT, dismissT);
    alpha($('sHerm'), st.hermetica); alpha($('sTitle'), st.title); alpha($('sSub'), st.sub); alpha($('sSkip'), st.skip); alpha($('sVig'), Math.max(st.hermetica, st.title) * 0.9);
    globe.spin = -st.spin;
    if (st.flying && !flew) { flew = true; globe.flyTo(obs.lat, obs.lon, globe.fitD(4.4)); }
    if (st.pinned && !pinned) { pinned = true; globe.setPin(obs.lat, obs.lon); setGlobeInputs(obs); }
    gpA = st.ui;
    if (st.done) { appMode = 'globe'; globe.interactive = true; $('splash').hidden = true; }
  } else if (appMode === 'globe') gpA += (1 - gpA) * Math.min(1, ms / 150);
  else if (appMode === 'in') {
    const s = Math.min(1, flowT / IN_MS); globe.applyJourney(s, journeyFrom, globe.pin); alpha(veil, veilAlpha(s)); gpA = Math.max(0, gpA - ms / 250);
    if (s >= 1) { appMode = 'sky'; flowT = 0; document.body.classList.remove('mode-globe'); globe.setPose(null); goal = null; dirty = true; }
  } else if (appMode === 'sky') alpha(veil, Math.max(0, 1 - flowT / SKY_VEIL_MS) ** 1.5);
  else if (appMode === 'leaving') {
    alpha(veil, Math.min(1, flowT / LEAVE_VEIL_MS));
    if (flowT >= LEAVE_VEIL_MS) {
      journeyFrom = { d: globe.fitD(4.4), lat: obs.lat, lon: obs.lon }; globe.setPin(obs.lat, obs.lon, false); setGlobeInputs(obs);
      document.body.classList.add('mode-globe'); globe.interactive = false; appMode = 'out'; flowT = 0;
    }
  } else if (appMode === 'out') {
    const s = Math.max(0, 1 - flowT / OUT_MS); globe.applyJourney(s, journeyFrom, globe.pin); alpha(veil, veilAlpha(s));
    if (s <= 0) { globe.setPose(null); globe.center = { lat: journeyFrom.lat, lon: journeyFrom.lon }; globe.d = journeyFrom.d; globe.interactive = true; appMode = 'globe'; alpha(veil, 0); }
  }
  alpha(gp, gpA); gp.style.pointerEvents = gpA > 0.6 ? 'auto' : 'none';
}
function splashPoke() { if (appMode === 'splash' && dismissT < 0) { dismissT = 0; } }   // cualquier interacción cierra la portada
$('globeLayer').addEventListener('pointerdown', splashPoke);
addEventListener('wheel', splashPoke, { passive: true });
let moved = 0, lastMX = null, lastMY = 0;
addEventListener('pointermove', (e) => { if (lastMX !== null) moved += Math.hypot(e.clientX - lastMX, e.clientY - lastMY); lastMX = e.clientX; lastMY = e.clientY; if (moved > 60 && flowT > 1200) splashPoke(); });
$('gGo').onclick = goSky; $('newLoc').onclick = newLocation;
addEventListener('keydown', (e) => {
  if (appMode === 'splash') { splashPoke(); return; }
  if (e.key === 'Enter' && appMode === 'globe') { e.preventDefault(); goSky(); }
  else if ((e.key === 'l' || e.key === 'L') && appMode === 'sky' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) newLocation();
});

function resize() {
  const d = Math.min(devicePixelRatio, 2); ov.width = innerWidth * d; ov.height = innerHeight * d; octx.setTransform(d, 0, 0, d, 0, 0);
  renderer.setSize(innerWidth, innerHeight, false); globe.resize(innerWidth, innerHeight); setProjection();
}
addEventListener('resize', resize); resize();

function frame(t) {
  const dt = last === null ? 0 : (t - (frame.t || t)) / 1000; frame.t = t;
  flowTick(Math.min(dt, 0.1) * 1000);
  if (speed) { simMs += dt * speed * 1000; if (Math.abs(speed) >= 20 || t - lastUpdate > 250) dirty = true; }
  if (dirty) update();
  if (appMode === 'sky' || appMode === 'leaving') {
    if (goal) { // giro suave hacia el destino por el camino más corto
      const da = ((goal.az - view.az + 540) % 360) - 180;
      view.az = (view.az + da * 0.15 + 360) % 360; view.alt += (goal.alt - view.alt) * 0.15;
      let fdone = true;
      if (goal.fov) { view.fov = clampFov(view.fov * Math.pow(goal.fov / view.fov, 0.12)); fdone = Math.abs(Math.log(goal.fov / view.fov)) < 0.01; }
      if (Math.abs(da) < 0.05 && Math.abs(goal.alt - view.alt) < 0.05 && fdone) goal = null;
    }
    const tt = trackTarget();
    if (tt) { // la cámara acompaña al objeto: se acerca con suavidad y, una vez centrada, queda clavada en él (sin retraso aunque el tiempo corra rápido)
      const st = followStep(view, tt, trackLocked, 1 - Math.exp(-Math.max(dt, 0.016) * 10));
      view.az = st.az; view.alt = st.alt; trackLocked = st.locked;
    }
    if (appMode === 'sky') fovTick(); else fovShown = view.fov;
    setProjection();
    orient();
    renderer.render(scene, camera);
    drawLabels();
  } else {
    if (last) { const S = last.Sol; globe.setSun(S.dec_deg, wrap180(S.ra_deg - (lstNow - obs.lon))); globe.setSidereal(lstNow - obs.lon); }
    globe.render(Math.min(dt, 0.1));
    if (performance.now() - (frame.gtT || 0) > 400) {        // la hora del globo se refresca unas 2 veces por segundo
      frame.gtT = performance.now();
      const pp = globe.pin || obs, tz = tzAt(pp.lat, pp.lon), gt = T('globe.time', { time: fmtHM(simMs, tz), zone: zoneName(tz), off: fmtOffset(simMs, tz), utc: new Date(simMs).toISOString().slice(0, 16).replace('T', ' ') });
      if (gt !== frame.gt) { frame.gt = gt; $('gTime').textContent = gt; }
    }
  }
  requestAnimationFrame(frame);
}
applyLang();
requestAnimationFrame(frame);
window.__sky = { setTrailMode, zoomBody(key) { sel = { kind: 'body', key }; refreshCard(); zoomTo(sel); }, get last() { return last; }, get paths() { return paths; }, get trails() { return trails; }, globe, goSky, newLocation, skip() { splashPoke(); }, setLang, get mode() { return appMode; }, get flowT() { return flowT; }, get track() { return track; }, get locked() { return trackLocked; }, setLandscape, get mags() { return mags; }, get land() { return land; }, view, obs, get simMs() { return simMs; }, set simMs(v) { simMs = v; dirty = true; }, set speed(v) { speed = v; }, update, get eclNow() { return eclNow; }, set danjon(v) { danjon = v; dirty = true; } };   // para pruebas automáticas
