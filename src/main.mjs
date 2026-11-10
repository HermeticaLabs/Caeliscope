import '@fontsource-variable/jost';
import '@fontsource-variable/cormorant';
import * as THREE from 'three';
import { CaelisAPI } from './engine/caelis-engine.generated.mjs';
import { dirFromAltAz, skyPalette, extinction, moonOrientation, eclipseAlt } from './sky-math.mjs';
import { skyRotation, magLimit, buildStarArrays, buildSegmentPositions, lineAlpha, labelMagLimit, equatorialVector, horizontalOf, normName, precessionMatrix } from './stars.mjs';
import { fmtHMS, fmtDMS, planetPhase, elongationDeg, riseSetFromSamples, refractionDeg } from './astro-fmt.mjs';
import { findPhase, findSunLongitude, findEclipseWhere, localSolarInfo, localSolarKind, lunarEclipseInfo } from './events.mjs';
import { buildExport, toText, fileName, ROUNDING_MOON } from './snapshot-json.mjs';
import { TEXT_STEPS, nextTextStep, clampOpacity, parsePrefs } from './ui-prefs.mjs';
import { aboutHtml, ABOUT } from './about.mjs';
import { t as T, getLang, setLang, onLang, initLang, applyStatic, locale, bodyName, conName, starName } from './i18n.mjs';
import { azimuthalGrid, equatorialGrid, eclipticLine, meridianLine } from './grids.mjs';
import { MIN_FOV, maxFov, viewBasis, focalPx, projectDir, unprojectPx } from './projection.mjs';
import { followStep } from './tracking.mjs';
import { buildLandscape, skylineAt, LAND_W } from './landscape.mjs';
import { tzAt, toInputValue, fromInputValue, dayIndex, fmtOffset, zoneName, fmtClock, fmtHM, fmtDateTime, partsAt, wallToMs, stepWall } from './timezone.mjs';
import { Globe } from './globe.mjs';
import { createLru } from './lru.mjs';
import { moonsOnSky } from './satellites/sky.mjs';
import { SAT_PLUGINS, pluginFor, moonName } from './satellites/index.mjs';
import { createMoonRenderer } from './satellites/render.mjs';
import { moonFrame, lonLatOf, illuminatedFraction } from './satellites/shape.mjs';
import { CENTER, PRESETS, project as proj3, orbit, zoomBy, autoZ, extent } from './view3d.mjs';
import { slideTo, findFree } from './winpos.mjs';
import { solarShadow, lunarShadow, shadowMode } from './shadow.mjs';
import { SAROS_DAYS, sarosReturn, BODY_ORDER, rangesFor, rangeConfig, cycleDays, usesModal, retroFlags, stations, retroColor, tickPlan, tickTimes, rosettePoint, fitPoints } from './trajectory.mjs';
import { fadeColor, wrap180 } from './globe-math.mjs';
import { splashState, veilAlpha, IN_MS, OUT_MS, SKY_VEIL_MS, LEAVE_VEIL_MS } from './splash-seq.mjs';
import { sunMagnitude, moonMagnitude, planetMagnitude, saturnRingSinB, AU_KM, NAKED_EYE_LIMIT } from './magnitudes.mjs';
import { solarObscuration, eclipseDarkness, moonTopoDist, eclToEq, umbraLUT } from './eclipse.mjs';
import { DOME_VS, DOME_FS, GROUND_VS, GROUND_FS, STAR_VS, STAR_FS, LINE_VS, LINE_FS, TRAIL_VS, BILL_VS_SRC, SUN_FS, MOON_FS, PLANET_FS } from './shaders.mjs';
import { PLANET_DATA, angularRadius, apparentDiameterArcsec, centralMeridianTurns, discFrame, sunFromBody, SATURN_RING_OUTER } from './planet-math.mjs';
const BASE = import.meta.env?.BASE_URL ?? '/';   // ruta base del despliegue (raíz o subcarpeta)

initLang();
// Accesibilidad: tamaño del texto (3 pasos, todo el texto crece en proporción) y opacidad de los paneles (solo el fondo)
const UI_KEY = 'caeliscope.ui';
const ui = (() => { try { return parsePrefs(localStorage.getItem(UI_KEY)); } catch { return parsePrefs(null); } })();
const tsNow = () => TEXT_STEPS[ui.ts];
const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* sin almacenamiento */ } };
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
  if (el.scrollWidth > el.clientWidth) el.style.fontSize = Math.max(8, parseFloat(getComputedStyle(el).fontSize) * (el.clientWidth / el.scrollWidth) * 0.97).toFixed(2) + 'px';
  fitKey = key;
}
addEventListener('resize', () => { fitKey = ''; });
let goal = null; // destino suave de la cámara

// ── Seguimiento: la cámara acompaña a un cuerpo celeste (o estrella) mientras pasa el tiempo,  ──
let track = null, trackLocked = false;              // { kind: 'body', key } | { kind: 'star', i }; locked = ya centrado: se pega al objeto sin retraso
const sameObj = (a, b) => !!a && !!b && a.kind === b.kind && (a.kind === 'body' ? a.key === b.key : a.kind === 'moon' ? a.key === b.key && a.planet === b.planet : a.i === b.i);
function trackTarget() {                            // posición actual (az, alt) del objeto seguido
  if (!track || !last || !rotM) return null;
  if (track.kind === 'body' || track.kind === 'moon') { const b = last[track.kind === 'moon' ? track.planet : track.key]; return b && { az: b.az_deg, alt: b.alt_apparent_deg }; }   // una luna se sigue con su planeta
  return horizontalOf(rotM, starVec(track.i));
}
function updateTrackUI() {
  const chip = $('trackChip'); chip.hidden = !track;
  if (track) {
    const tg = trackTarget(), name = track.kind === 'body' ? bodyName(track.key) : track.kind === 'moon' ? moonLabel(track) : (starNameOf(track.i) || T('chip.star'));
    $('trackName').textContent = T('chip.followingN', { name }) + (tg && tg.alt < 0 ? T('chip.below') : '');
  }
  $('cTrack').setAttribute('aria-pressed', sameObj(track, sel));
}
function startTrack(obj) { track = obj ? { kind: obj.kind, key: obj.key, i: obj.i, planet: obj.planet } : null; trackLocked = false; goal = null; updateTrackUI(); }
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
const moonsFor = (planet) => { const pl = pluginFor(planet); return pl && lastSnap ? { pl, list: moonsOnSky(pl, last[planet], last.Sol, lastSnap.meta.jd_tt) } : null; };
toggle('tAz', (on) => { gridAz.visible = showAzL = on; });
toggle('tEq', (on) => { gridEq.visible = showEqL = on; });
toggle('tEcl', (on) => { showEcl = on; if (gridEcl) gridEcl.visible = on; });
toggle('tMer', (on) => { gridMer.visible = on; });
toggle('tMW', (on) => { showMW = on; applyMW(); });
toggle('tGround', (on) => { ground.visible = on; });

// ── Textos sobre el cielo (lienzo 2D encima, con la misma proyección) ──
const ov = $('labels'), octx = ov.getContext('2d');
let skyAlt = -30;                                   // altura "efectiva" del Sol (incluye el oscurecimiento del eclipse)
// Etiquetas de las trayectorias: fechas (u horas) a lo largo del trazo y estaciones de retrogradación (℞ al empezar, D al terminar)
const rgLoc = () => (getLang() === 'es' ? 'es' : 'en-GB');
function fmtTick(ms, plan, p) {
  if (plan.unit === 'hour') return fmtHM(ms, obsTz);
  const f = plan.unit === 'day' ? { day: 'numeric', month: 'short' } : plan.unit === 'month' ? (new Date(ms).getUTCMonth() === 0 ? { month: 'short', year: '2-digit' } : { month: 'short' }) : { year: 'numeric' };
  return new Intl.DateTimeFormat(rgLoc(), { timeZone: 'UTC', ...f }).format(ms);
}
function drawPathLabels(at, atV) {
  octx.font = `${11 * tsNow()}px Georgia`; octx.textAlign = 'left';
  for (const p of paths.values()) {
    if (!p.pts.length || !p.plan) continue;
    const pos = (q) => (p.long ? (rotDate ? at(q.v, rotDate) : null) : atV(q.v));
    octx.fillStyle = rgbCss(p.col);
    for (const k of p.ticks) {
      const c = pos(p.pts[k.i]); if (!c) continue;
      octx.globalAlpha = 0.9; octx.beginPath(); octx.arc(c[0], c[1], 2.2, 0, 6.2832); octx.fill();
      octx.globalAlpha = 0.85; octx.fillText(fmtTick(k.t, p.plan, p), c[0] + 6, c[1] - 6);
    }
    octx.fillStyle = rgbCss(p.rcol); octx.globalAlpha = 1;
    for (const st of p.sts) { const c = pos(p.pts[st.i]); if (!c) continue; octx.fillText(st.kind === 'R' ? '℞' : 'D', c[0] + 6, c[1] + 12); octx.beginPath(); octx.arc(c[0], c[1], 3, 0, 6.2832); octx.stroke(); }
    octx.globalAlpha = 1;
  }
}
// Satélites naturales (plugins): se dibujan alrededor de su planeta cuando el zoom los separa; nunca entran en estelas, geometrías ni rosetas.
// Dibujo de lunas con forma, fase y textura (un solo renderizador WebGL compartido). Si WebGL no está disponible, se dibujan como discos.
let moonR = null, moonRFailed = false;
function getMoonR() {
  if (moonR || moonRFailed) return moonR;
  try { moonR = createMoonRenderer(BASE); moonR.setOnTexture(() => { dirty = true; refreshCard(); }); } catch { moonRFailed = true; }
  return moonR;
}
const frameOf = (pl, def) => moonFrame(pl, def, last[pl.planet], last.Sol, lastSnap.meta.jd_tt);
function moonSprite(g, pl, def, s, at2, c, r, dpr) {                    // copia la luna al cielo con la orientación que tiene en pantalla (norte y este del cielo)
  const R = getMoonR(); if (!R) return false;
  const f = frameOf(pl, def), half = r * Math.max(f.shape.a, f.shape.b, f.shape.c) / def.meanRadiusKm;
  const p0 = at2(s.dxArcsec, s.dyArcsec), pe = at2(s.dxArcsec + 5, s.dyArcsec), pn = at2(s.dxArcsec, s.dyArcsec + 5); if (!p0 || !pe || !pn) return false;
  const u = (p) => { const x = p[0] - p0[0], y = p[1] - p0[1], n = Math.hypot(x, y) || 1; return [x / n, y / n]; }, e = u(pe), n = u(pn);
  const cvs = R.draw(def.key, f, { eclipsed: s.eclipsed, transit: s.transit }, Math.min(512, 2 * half * dpr));
  g.save(); g.translate(c[0], c[1]); g.transform(-e[0], -e[1], -n[0], -n[1], 0, 0); g.drawImage(cvs, -half, -half, 2 * half, 2 * half); g.restore(); return true;   // la imagen tiene el oeste a la derecha y el sur abajo
}
function drawPortrait() {                                                // retrato de la ficha: la luna como se ve desde la Tierra, con el norte celeste arriba
  const cv = $('cPort'), m = sel && sel.kind === 'moon' ? moonSel() : null, R = m && getMoonR();
  cv.hidden = !R; if (!R) return;
  const css = 176, dpr = Math.min(2, devicePixelRatio || 1); if (cv.width !== css * dpr) { cv.width = cv.height = css * dpr; cv.style.width = cv.style.height = css + 'px'; }
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(R.draw(m.def.key, frameOf(m.pl, m.def), { eclipsed: m.s.eclipsed, transit: false }, cv.width), 0, 0);
}
// Proyector de un planeta: desplazamiento angular (″ este, ″ norte) respecto de su centro -> pantalla. Lo comparten el dibujo, la selección y la mira.
function moonProjector(pl, atV) {
  const b = last[pl.planet], vM = dirFromAltAz(b.alt_apparent_deg, b.az_deg), E0 = equatorialVector(b.ra_deg, b.dec_deg), a = b.ra_deg * D2R, d = b.dec_deg * D2R, R0 = rotVec(rotM, E0);
  const east = [-Math.sin(a), Math.cos(a), 0], north = [-Math.cos(a) * Math.sin(d), -Math.sin(a) * Math.sin(d), Math.cos(d)];
  return (dx, dy) => {
    const ex = dx / 206264.806, ey = dy / 206264.806, E1 = [0, 1, 2].map((i) => E0[i] + ex * east[i] + ey * north[i]), R1 = rotVec(rotM, E1);
    const v = [vM[0] + R1[0] - R0[0], vM[1] + R1[1] - R0[1], vM[2] + R1[2] - R0[2]], n = Math.hypot(...v); return atV([v[0] / n, v[1] / n, v[2] / n]);
  };
}
const moonRadiusPx = (pl, def) => Math.max(2.4, (def.meanRadiusKm / pl.radiusKm) * (bodyPx[pl.planet] || 0));   // radio real de la luna en pantalla (mínimo un punto)
const projectVisible = (v) => (hiddenDir(v) ? null : project(v));
const moonLabel = (o) => { const pl = pluginFor(o.planet), def = pl && pl.moons.find((q) => q.key === o.key); return def ? moonName(def, getLang()) : o.key; };
function moonSel() {                                                                   // datos vivos de la luna seleccionada, o null si ya no se muestran lunas
  if (!sel || sel.kind !== 'moon' || !ui.mn || !last || !rotM) return null;
  const pl = pluginFor(sel.planet), m = pl && moonsFor(sel.planet); if (!m) return null;
  const s = m.list.find((q) => q.key === sel.key), def = pl.moons.find((q) => q.key === sel.key); return s && def ? { pl, def, s, b: last[sel.planet] } : null;
}
// Satélites naturales (plugins): se dibujan alrededor de su planeta cuando el zoom los separa; nunca entran en estelas, geometrías ni rosetas.
function drawMoons(atV) {
  for (const pl of SAT_PLUGINS) {
    const b = last[pl.planet]; if (!b || (bodyPx[pl.planet] || 0) < 4) continue;
    const m = moonsFor(pl.planet); if (!m) continue;
    octx.font = `${11 * tsNow()}px Georgia`; octx.textAlign = 'left';
    const at2 = moonProjector(pl, atV), rpx = (def) => moonRadiusPx(pl, def);
    for (const s of m.list) {                                                           // sombras de las lunas sobre el disco del planeta
      if (!s.shadow || s.occulted) continue;
      const def = pl.moons.find((q) => q.key === s.key), c = at2(s.shadow.dxArcsec, s.shadow.dyArcsec); if (!c) continue;
      octx.fillStyle = 'rgba(0,0,0,.78)'; octx.beginPath(); octx.arc(c[0], c[1], Math.max(1.5, rpx(def) * 0.95), 0, 6.2832); octx.fill();
    }
    for (const s of m.list) {
      if (s.occulted || s.ringCover > 0.9) continue;
      const def = pl.moons.find((q) => q.key === s.key), c = at2(s.dxArcsec, s.dyArcsec); if (!c) continue; const r = rpx(def);
      octx.globalAlpha = 1 - 0.6 * (s.ringCover || 0);                                  // detrás de un anillo translúcido se ve atenuada
      if (!(r >= 5 && moonSprite(octx, pl, def, s, at2, c, r, Math.min(devicePixelRatio || 1, 2)))) {   // pequeña o sin WebGL: disco liso
        octx.fillStyle = s.eclipsed ? 'rgba(150,70,50,.9)' : s.transit ? 'rgba(60,58,62,.92)' : (def.color || '#e1e1d7');
        octx.beginPath(); octx.arc(c[0], c[1], r, 0, 6.2832); octx.fill(); octx.strokeStyle = 'rgba(0,0,0,.6)'; octx.lineWidth = 1; octx.stroke();
      }
      if (showNames || (bodyPx[pl.planet] || 0) >= 10) { octx.fillStyle = 'rgba(205,200,255,.9)'; octx.fillText(moonName(def, getLang()), c[0] + r + 5, c[1] - 6); }
      octx.globalAlpha = 1;
    }
  }
}
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
    octx.font = `${13 * tsNow()}px Georgia`; octx.textAlign = 'left'; const mlim = labelMagLimit(view.fov);
    for (const s of names) {
      if (s.mag > mlim || s.mag > lim - 0.5) continue;
      const p = at(s.e); if (!p) continue;
      octx.fillStyle = `rgba(235,235,245,${clamp((lim - s.mag) / 1.5, 0, 1) * 0.85})`; octx.fillText(starName(s.name), p[0] + 9, p[1]);
    }
  }
  if (showConst && a > 0.02) {
    octx.font = `italic ${12 * tsNow()}px Georgia`; octx.textAlign = 'center'; octx.fillStyle = `rgba(180,165,255,${0.8 * a})`;
    for (const c of conLabels) { const p = at(c.e); if (p) octx.fillText(conName(c.name), p[0], p[1]); }
  }
  octx.font = `${11 * tsNow()}px Georgia`; octx.textAlign = 'center';
  if (showAzL) {
    octx.fillStyle = 'rgba(110,200,210,0.85)';
    for (let az = 30; az < 360; az += 30) { if (az % 90) { const p = atV(dirFromAltAz(1.5, az)); if (p) octx.fillText(az + '°', p[0], p[1]); } }
  }
  if (showEqL && rotDate) {
    octx.fillStyle = 'rgba(230,160,90,0.85)';
    for (let ra = 0; ra < 360; ra += 30) { const p = at(equatorialVector(ra, 0), rotDate); if (p) octx.fillText(ra / 15 + 'h', p[0], p[1] - 8); }
    for (const dec of [-60, -30, 30, 60]) { const p = at(equatorialVector(0, dec), rotDate); if (p) octx.fillText((dec > 0 ? '+' : '') + dec + '°', p[0] + 14, p[1]); }
  }
  if (ui.pl && paths.size) drawPathLabels(at, atV);
  // puntos cardinales, Sol, Luna y planetas
  octx.font = `${14 * tsNow()}px Georgia`; octx.fillStyle = '#fff';
  [['N', 0], ['E', 90], ['S', 180], [getLang() === 'es' ? 'O' : 'W', 270]].forEach(([c, az]) => { const p = atV(dirFromAltAz(Math.max(3, skylineAt(land, az) + 1.3), az)); if (p) octx.fillText(c, p[0], p[1]); });
  octx.font = `${13 * tsNow()}px Georgia`;
  const tag = (key, text, color, dy) => {
    const b = last[key]; if (!b) return;
    const p = atV(dirFromAltAz(b.alt_apparent_deg, b.az_deg)); if (!p) return;
    const px = bodyPx[key] || 0, off = dy < 0 ? Math.min(dy, -(px + 14)) : Math.max(dy, px + 14);
    octx.fillStyle = color; octx.fillText(text, p[0], p[1] + off);
  };
  if (!(eclNow.dark > 0.5)) { tag('Sol', bodyName('Sol'), '#dcb450', -26); }
  tag('Luna', bodyName('Luna'), '#dcb450', 26);
  for (const n of PNAMES) if ((magsVis[n] ?? 0) < lim + 0.4 || (bodyPx[n] || 0) > 4) tag(n, bodyName(n), '#b4a5ff', 16);
  if (ui.mn) drawMoons(atV);
  const sp = sel && selScreen();
  if (sp) { // mira discreta: cuatro cuadritos (arriba, abajo, izquierda, derecha) alrededor del objeto
    const ms0 = sel.kind === 'moon' ? moonSel() : null, R = sel.kind === 'body' ? Math.max(14, (bodyPx[sel.key] || 0) + 8) : ms0 ? Math.max(9, moonRadiusPx(ms0.pl, ms0.def) + 6) : 14, q = 5; octx.strokeStyle = 'rgba(255,255,255,0.85)'; octx.lineWidth = 1;
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
  if (sel.kind === 'moon') { const m = moonSel(); return m ? moonProjector(m.pl, project)(m.s.dxArcsec, m.s.dyArcsec) : null; }
  return project(rotVec(rotM, starVec(sel.i)));
}
function pick(px, py, touch = false) { // el objeto más cercano al clic: primero cuerpos, luego estrellas visibles
  if (!last || !rotM) return null;
  let best = null; const k = touch ? 1.7 : 1;                                           // con el dedo la zona de toque es más grande
  const cand = (item, s, rad, bias) => {
    const d = Math.hypot(s[0] - px, s[1] - py);
    if (d <= rad * k && (!best || d - bias < best.sc)) best = { ...item, sc: d - bias };
  };
  const tryIt = (item, v, rad, bias) => { const s = project(v); if (s) cand(item, s, rad, bias); };
  if (ui.mn) for (const pl of SAT_PLUGINS) {                                           // lunas: ganan al planeta cuando el clic cae sobre ellas
    const b = last[pl.planet]; if (!b || (bodyPx[pl.planet] || 0) < 4 || hiddenAltAz(b.alt_apparent_deg, b.az_deg, 0.3)) continue;
    const m = moonsFor(pl.planet); if (!m) continue; const at2 = moonProjector(pl, projectVisible);
    for (const q of m.list) { if (q.occulted || q.ringCover > 0.9) continue; const def = pl.moons.find((x) => x.key === q.key), c = at2(q.dxArcsec, q.dyArcsec); if (c) cand({ kind: 'moon', planet: pl.planet, key: q.key }, c, Math.max(12, moonRadiusPx(pl, def) + 8), 40); }
  }
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
  return best && { kind: best.kind, key: best.key, i: best.i, planet: best.planet };
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
  const bk = sel.kind === 'moon' ? sel.planet : sel.key, h0 = bk === 'Sol' || bk === 'Luna' ? -0.2666 : 0; // radio del disco; la altura aparente ya incluye refracción
  let k = 0;
  (function chunk() {
    if (rsKey !== key) return;
    for (let c = 0; c < 15 && k < n; c++, k++) alts.push(snapAt(t0 + k * step).bodies[bk].alt_apparent_deg);
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
    const ms = ui.mn ? moonsFor(sel.key) : null;
    if (ms) for (const s of ms.list) rows.push([moonName(ms.pl.moons.find((q) => q.key === s.key), getLang()), `${s.sepArcsec.toFixed(1)}″ ${T(s.dxArcsec >= 0 ? 'sat.east' : 'sat.west')} · ${T(s.occulted ? 'sat.occulted' : s.ringCover > 0.9 ? 'sat.rings' : s.transit ? 'sat.transit' : s.eclipsed ? 'sat.eclipsed' : 'sat.visible')}${s.shadow && !s.occulted ? ' · ' + T('sat.shadow') : ''}`]);
  } else if (sel.kind === 'moon') {
    const m = moonSel();
    if (m) {
      const { pl, def, s, b } = m, el = def.elements, rKm = Math.hypot(s.xKm, s.yKm, s.zKm), asec = 2 * def.meanRadiusKm / (b.dist_au * 149597870.7) * 206264.806;
      title = moonName(def, getLang()); wiki = def.name.en; sub = T('sub.moonOf', { planet: bodyName(sel.planet) });
      rows.push([T('row.mag'), fmtMag(def.mag)], [T('row.apparent'), `${asec.toFixed(asec < 1 ? 3 : 2)}″`], [T('row.planetDist'), `${Math.round(rKm).toLocaleString(locale())} km · ${(rKm / pl.radiusKm).toFixed(1)} R`]);
      const fr = frameOf(pl, def), sh = fr.shape, se = lonLatOf(fr, fr.toObs), triax = Math.max(sh.a, sh.b, sh.c) / Math.min(sh.a, sh.b, sh.c) > 1.01;
      if (triax) rows.push([T('row.shape'), `${(2 * sh.a).toFixed(sh.a < 100 ? 1 : 0)} × ${(2 * sh.b).toFixed(sh.b < 100 ? 1 : 0)} × ${(2 * sh.c).toFixed(sh.c < 100 ? 1 : 0)} km`]);
      rows.push([T('row.phase'), `${(illuminatedFraction(fr) * 100).toFixed(0)}%`], [T('row.subEarth'), sh.spinDays ? '—' : `${se.lonE.toFixed(0)}°E ${se.lat >= 0 ? '+' : ''}${se.lat.toFixed(0)}°`]);
      rows.push([T('row.sep'), `${s.sepArcsec.toFixed(1)}″ ${T(s.dxArcsec >= 0 ? 'sat.east' : 'sat.west')}`]);
      rows.push([T('row.period'), `${(360 / el.nSid).toFixed(el.nSid > 20 ? 3 : 2)} ${T('unit.d')} · ${T(el.i > 90 ? 'sat.retro' : 'sat.prograde')}`]);
      rows.push([T('row.radec'), `${fmtHMS((b.ra_deg + s.dxArcsec / 3600 / Math.cos(b.dec_deg * D2R) + 360) % 360)}  ${fmtDMS(b.dec_deg + s.dyArcsec / 3600)}`], [T('row.azalt'), `${fmtDMS(b.az_deg, false, 3)}  ${fmtDMS(b.alt_apparent_deg)}`]);
      rows.push([T('row.state'), T(s.occulted ? 'sat.occulted' : s.ringCover > 0.9 ? 'sat.rings' : s.transit ? 'sat.transit' : s.eclipsed ? 'sat.eclipsed' : 'sat.visible') + (s.shadow ? ' · ' + T('sat.shadow') : '')], [T('row.vis'), T(b.alt_apparent_deg >= 0 ? 'row.up' : 'row.down')]);
    } else { title = moonLabel(sel); sub = T('sub.moonOf', { planet: bodyName(sel.planet) }); }
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
// ── Vista para desarrolladores: la ficha se da vuelta y muestra el JSON en vivo de Caelis Engine ──
let jsonOpen = false, jsonText = '', jsonObj = null;
function currentExport() {
  if (!sel || !lastSnap || !rotM) return null;
  const observer = { lat: obs.lat, lon: obs.lon };
  if (sel.kind === 'body') return buildExport({ kind: 'body', key: bodyName(sel.key, 'en'), engineKey: sel.key, name: bodyName(sel.key, 'en'), rounding: ui.mn && moonsFor(sel.key) ? ROUNDING_MOON : undefined, data: lastSnap.bodies[sel.key], snap: lastSnap, observer, extra: sel.key === 'Luna' ? lastSnap.luna : (() => { const ms = ui.mn ? moonsFor(sel.key) : null; return ms ? { satellites: { plugin: ms.pl.id, model: ms.pl.model, moons: ms.list.map((s) => ({ id: ms.pl.moons.find((q) => q.key === s.key)?.name.en ?? s.key, east_arcsec: +s.dxArcsec.toFixed(3), north_arcsec: +s.dyArcsec.toFixed(3), separation_arcsec: +s.sepArcsec.toFixed(3), line_of_sight_km: Math.round(s.zKm), transit: s.transit, occulted: s.occulted, behind_rings_opacity: s.ringCover, in_planet_shadow: s.eclipsed, shadow_on_disc: !!s.shadow })) } } : undefined; })() });
  if (sel.kind === 'moon') {
    const m = moonSel(); if (!m) return null; const { pl, def, s } = m;
    return buildExport({ kind: 'moon', key: def.name.en, name: def.name.en, rounding: ROUNDING_MOON, snap: lastSnap, observer, data: { planet: bodyName(sel.planet, 'en'), planet_engine_key: sel.planet, east_arcsec: +s.dxArcsec.toFixed(3), north_arcsec: +s.dyArcsec.toFixed(3), separation_arcsec: +s.sepArcsec.toFixed(3), position_km: [s.xKm, s.yKm, s.zKm].map(Math.round), transit: s.transit, occulted: s.occulted, in_planet_shadow: s.eclipsed, shadow_on_disc: !!s.shadow, behind_rings_opacity: s.ringCover, mean_radius_km: def.meanRadiusKm, magnitude: def.mag, orbit: def.elements },
      extra: { plugin: pl.id, model: pl.model, planet_position: lastSnap.bodies[sel.planet] } });
  }
  const s = starCat[sel.i], info = starInfo && starInfo[sel.i], h = horizontalOf(rotM, starVec(sel.i));
  return buildExport({ kind: 'star', key: 'star:' + sel.i, name: starName(starNameOf(sel.i), 'en') || (info && info[1] ? `HIP ${info[1]}` : `star ${sel.i}`), snap: lastSnap, observer,
    data: { ra_j2000_deg: s[0], dec_j2000_deg: s[1], magnitude: s[2], bv_index: s[3], hip: info ? info[1] : null, az_deg: h.az, alt_geometric_deg: h.alt, lst_deg: lastSnap.meta.sidereal.lst_deg } });
}
function showFace() {
  const on = jsonOpen && ui.js;
  $('cRows').hidden = on; $('cJsonView').hidden = !on;
  if (!on) return;
  $('cWiki').hidden = true;
  jsonObj = currentExport(); const txt = jsonObj ? toText(jsonObj) : '';
  if (txt !== jsonText && !(document.activeElement === $('jPre') && getSelection().toString())) { jsonText = txt; $('jPre').textContent = txt; }   // no pisa un texto que se está seleccionando
}
function flipCard(next) {                      // media vuelta: la ficha se pone de canto, cambia la cara y se abre de nuevo
  const f = $('cFace'); if (!f.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { jsonOpen = next; refreshCard(); return; }
  f.animate([{ transform: 'perspective(700px) rotateX(0)' }, { transform: 'perspective(700px) rotateX(90deg)' }], { duration: 170, easing: 'ease-in' }).onfinish = () => {
    jsonOpen = next; refreshCard();
    f.animate([{ transform: 'perspective(700px) rotateX(-90deg)' }, { transform: 'perspective(700px) rotateX(0)' }], { duration: 190, easing: 'ease-out' });
  };
}
$('cJson').onclick = () => flipCard(!jsonOpen);
$('jCopy').onclick = async () => {
  const b = $('jCopy');
  try { await navigator.clipboard.writeText(jsonText); } catch { const r = document.createRange(); r.selectNodeContents($('jPre')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand?.('copy'); s.removeAllRanges(); }
  b.textContent = T('json.copied'); setTimeout(() => { b.textContent = T('json.copy'); }, 1200);
};
$('jDown').onclick = () => {
  if (!jsonObj) return; const url = URL.createObjectURL(new Blob([jsonText], { type: 'application/json' })), a = document.createElement('a');
  a.href = url; a.download = fileName(jsonObj); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
};
function refreshCard() {
  const card = $('card');
  updatePaths();
  if (sel && sel.kind === 'moon' && !moonSel()) sel = null;          // si ya no se muestran lunas, la ficha de la luna se cierra
  if (!sel || !last || !rotM) { card.hidden = true; return; }
  if (Math.abs(speed) < 60) ensureRS();
  const d = describe();
  $('cTitle').textContent = d.title; $('cSub').textContent = d.sub;
  const t = $('cRows'); t.replaceChildren();
  for (const [a, b] of d.rows) { const tr = t.insertRow(); tr.insertCell().textContent = a; tr.insertCell().textContent = b; }
  drawPortrait();
  const w = $('cWiki'); w.hidden = !d.wiki;
  if (d.wiki) w.href = `https://${getLang()}.wikipedia.org/w/index.php?search=` + encodeURIComponent(d.wiki);
  const cp = $('cPath'), pc = rgbCss(colorOf(sel));
  cp.style.setProperty('--pc', pc); cp.setAttribute('aria-pressed', paths.has(pathId(sel)));
  $('cZoom').hidden = sel.kind === 'star'; cp.hidden = sel.kind === 'moon';
  const ca = $('cAll'); ca.hidden = sel.kind !== 'star'; ca.style.setProperty('--pc', rgbCss(STAR_PATH)); ca.setAttribute('aria-pressed', trails.on); ca.lastChild.textContent = trailLabel();
  $('cJson').hidden = !ui.js; if (!ui.js) jsonOpen = false;
  $('cJson').setAttribute('aria-pressed', jsonOpen); showFace(); card.hidden = false; updateTrackUI();
}
$('cClose').onclick = () => { sel = null; rsKey = ''; rs = null; refreshCard(); updateTrackUI(); };
const toggleTrack = () => { if (!sel) return; if (sameObj(track, sel)) stopTrack(); else startTrack(sel); };
$('cTrack').onclick = toggleTrack;
$('cZoom').onclick = () => { if (sel) zoomTo(sel.kind === 'moon' ? { kind: 'body', key: sel.planet } : sel); };
$('trackStop').onclick = stopTrack;


// ── Trayectorias: cada objeto activado conserva la suya, con su color (±12 h alrededor del instante actual, un punto cada 10 min) ──
// Lo ya recorrido se dibuja tenue y lo que viene, más claro. Los cuerpos se consultan a Caelis en tandas; las estrellas se calculan directo.
const PATH_STEP = 600000, PATH_HALF = 72, PATH_BUCKET = 6 * 3600000;
// Alcance de la trayectoria de cada astro (menú en cascada de Opciones): ±12 h en el cielo del observador, ±3 / ±6 meses contra las estrellas,
// ciclo sinódico, roseta completa (planetas) o analema (Sol). En los alcances largos se dibuja en coordenadas ecuatoriales de la fecha (fijas respecto de las estrellas).
// El tramo en retrogradación (ascensión recta decreciente) se dibuja con otro color, derivado del color del astro.
const rangeOf = (key) => ui.sp[key] || '12h';
const cfgOf = (p) => p.cf;
const PATH_COLORS = { Sol: [1, 0.82, 0.24], Luna: [0.86, 0.9, 1], Mercurio: [0.78, 0.72, 0.62], Venus: [1, 0.6, 0.8], Marte: [1, 0.33, 0.25], Jupiter: [1, 0.66, 0.3], Saturno: [0.9, 0.76, 0.36], Urano: [0.43, 0.89, 0.93], Neptuno: [0.38, 0.5, 1] };
const STAR_PATH = [0.72, 0.82, 1];
const rgbCss = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
const paths = new Map();                                    // id -> { obj, col, past, fut, key, pts, splitAt }
const pathId = (o) => (o.kind === 'body' ? o.key : o.kind === 'moon' ? 'moon:' + o.planet + ':' + o.key : 'star:' + o.i);
const colorOf = (o) => (o.kind === 'body' ? PATH_COLORS[o.key] || [1, 0.82, 0.35] : STAR_PATH);
const trails = { on: false, mode: 0, mesh: null, key: '', live: null, liveKey: '', t0: 0 };   // trayectorias de todas las estrellas brillantes; mode: 0 apagado, 1 en vivo, 2 ciclo completo
const trailLabel = () => T(['card.all', 'card.allLive', 'card.allCycle'][trails.mode]);
function renderPathChip() {
  const chip = $('pathChip'); chip.replaceChildren();
  const pill = (label, col, onRemove) => {
    const e = document.createElement('span'); e.className = 'pp'; e.style.setProperty('--pc', rgbCss(col)); e.append(label + ' ');
    const x = document.createElement('button'); x.textContent = '✕'; x.setAttribute('aria-label', T('chip.removePath', { name: label })); x.onclick = onRemove; e.append(x); chip.append(e);
  };
  for (const [id, p] of paths) pill(p.obj.kind === 'body' ? bodyName(p.obj.key) + (p.range === '12h' ? '' : ' · ' + T('rng.s.' + p.range)) : (starNameOf(p.obj.i) || T('chip.star')), p.col, () => { removePath(id); refreshCard(); });
  if (trails.on) pill(T(trails.mode === 1 ? 'chip.trailsLive' : 'chip.trailsCycle'), STAR_PATH, () => setTrailMode(0));
  chip.hidden = !paths.size && !trails.on;
}
const geomCache = createLru(5), HEAVY = new Set(['syn', 'ros', 'ana']);   // como mucho 5 geometrías largas guardadas; las más antiguas se descartan
const pmeshes = (p) => [p.past, p.fut, p.pastR, p.futR];
function addPath(o) {
  const id = pathId(o); if (paths.has(id)) return;
  const col = colorOf(o), range = o.kind === 'body' ? rangeOf(o.key) : '12h', cf = rangeConfig(o.key, range), long = o.kind === 'body' && cf.long, rot = long ? dateU : idU, rcol = retroColor(col);
  const mk = (c, al) => makeLines(new Float32Array(6), c, rot, al, 4);
  const p = { obj: { kind: o.kind, key: o.key, i: o.i }, col, rcol, range, cf, long, anchor: simMs, past: mk(col, 0.35), fut: mk(col, 0.95), pastR: mk(rcol, 0.45), futR: mk(rcol, 1), key: '', pts: [], live: [], splitAt: 0, ticks: [], plan: null, sts: [] };
  if (HEAVY.has(range)) { const heavy = [...paths].filter(([, q]) => HEAVY.has(q.range)); while (heavy.length >= 3) removePath(heavy.shift()[0]); }   // a lo sumo 3 geometrías largas calculándose o en pantalla a la vez
  paths.set(id, p); for (const m of pmeshes(p)) m.visible = false;
  renderPathChip();
}
function removePath(id) {
  const p = paths.get(id); if (!p) return;
  for (const m of pmeshes(p)) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  paths.delete(id); if (geo.id === id) closeGeo(); renderPathChip();
}
function setSeg(mesh, a) {
  mesh.geometry.dispose(); mesh.geometry = new THREE.BufferGeometry(); mesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(a), 3)); mesh.visible = a.length >= 6;
}
function splitPath(p) {
  const pa = [], pr = [], fa = [], fr = [], pts = p.pts;
  for (let i = 0; i + 1 < pts.length; i++) {
    const A = pts[i], B = pts[i + 1], past = B.t <= simMs, retro = B.retro || A.retro, dst = past ? (retro ? pr : pa) : (retro ? fr : fa);
    dst.push(A.v[0], A.v[1], A.v[2], B.v[0], B.v[1], B.v[2]);
  }
  setSeg(p.past, pa); setSeg(p.pastR, pr); setSeg(p.fut, fa); setSeg(p.futR, fr); p.splitAt = simMs;
}
function computePath(id, p, key, bucket) {
  const o = p.obj, cf = cfgOf(p), tc = cf.anchored ? p.anchor : (bucket + 0.5) * cf.bucket, pts = [];
  const finish = () => {
    const fl = o.kind === 'body' && o.key !== 'Sol' && o.key !== 'Luna' ? retroFlags(pts.map((q) => q.ra)) : pts.map(() => false);
    pts.forEach((q, i) => { q.retro = fl[i]; });
    p.sts = stations(fl); p.plan = tickPlan(pts[pts.length - 1].t - pts[0].t);
    p.ticks = tickTimes(pts[0].t, pts[pts.length - 1].t, p.plan).map((t) => ({ t, i: Math.min(pts.length - 1, Math.max(0, Math.round((t - pts[0].t) / cf.step))) }));
    p.pts = pts; splitPath(p);
    if (ck) geomCache.set(ck, { pts, sts: p.sts, plan: p.plan, ticks: p.ticks });
  };
  const ck = o.kind === 'body' && p.range !== '12h' ? `${o.key}|${p.range}|${cf.anchored ? Math.round(p.anchor / 60000) : bucket}|${obs.lat}|${obs.lon}` : null, hit = ck && geomCache.get(ck);
  if (hit) { p.live = hit.pts; p.sts = hit.sts; p.plan = hit.plan; p.ticks = hit.ticks; p.pts = hit.pts; return splitPath(p); }
  if (o.kind === 'star') {
    const e = starVec(o.i);
    for (let k = -cf.half; k <= cf.half; k++) { const t = tc + k * cf.step; pts.push({ t, v: rotVec(skyRotation(lstNow + (360.98564736629 * (t - simMs)) / 86400000, obs.lat, tNow), e), ra: 0 }); }
    return finish();
  }
  let k = -cf.half; p.live = pts;
  (function chunk() {
    if (p.key !== key || !paths.has(id)) return;
    for (let c = 0; c < 24 && k <= cf.half; c++, k++) {
      const t = tc + k * cf.step, sn = snapAt(t), b = sn.bodies[o.key], su = sn.bodies.Sol;
      pts.push({ t, v: p.long ? equatorialVector(b.ra_deg, b.dec_deg) : dirFromAltAz(b.alt_apparent_deg, b.az_deg), ra: b.ra_deg, alt: b.alt_apparent_deg, az: b.az_deg, lon: b.lon_ecl_geocentric_deg ?? b.lon_ecl_deg, lat: b.lat_ecl_geocentric_deg ?? b.lat_ecl_deg ?? 0, sunLon: su.lon_ecl_geocentric_deg ?? su.lon_ecl_deg, r: o.key === 'Luna' ? b.dist_km : b.dist_au });
    }
    if (k <= cf.half) setTimeout(chunk, 0); else finish();
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
  for (const [id, p] of paths) {
    const cf = cfgOf(p), bucket = Math.floor(simMs / cf.bucket), key = `${bucket}|${obs.lat}|${obs.lon}|${p.range}`;
    if (p.key !== key) { p.key = key; computePath(id, p, key, bucket); }
    else if (Math.abs(simMs - p.splitAt) > cf.step && p.pts.length) splitPath(p);
  }
  updateTrails(Math.floor(simMs / PATH_BUCKET));
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
$('cPath').onclick = () => { if (!sel) return; const id = pathId(sel); if (paths.has(id)) removePath(id); else { addPath(sel); if (sel.kind === 'body' && usesModal(rangeOf(sel.key))) openGeo(id); } refreshCard(); };
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
let lastSnap = null;
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
  last = snap.bodies; lastSnap = snap;
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
      look = kind === 'solar' ? 'Sol' : 'Luna'; setShadow(true);
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
const ptrs = new Map(); let lastTap = null, lastTapWasTouch = false;
let down = null;
const clampFov = (v) => clamp(v, MIN_FOV, maxFov(view.mode));
cv.addEventListener('pointerdown', (e) => {
  ptrs.set(e.pointerId, [e.clientX, e.clientY]); goal = null; cv.setPointerCapture(e.pointerId);
  if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), pinch: false, touch: e.pointerType !== 'mouse' }; else if (down) down.pinch = true;
});
cv.addEventListener('pointerup', (e) => {
  ptrs.delete(e.pointerId);
  if (down && !down.pinch && ptrs.size === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < (down.touch ? 18 : 6) && performance.now() - down.t < (down.touch ? 800 : 600)) {   // un toque con el dedo siempre se mueve unos píxeles
    const now = performance.now(), dbl = down.touch && lastTap && now - lastTap.t < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 36;
    lastTapWasTouch = down.touch; lastTap = down.touch && !dbl ? { t: now, x: e.clientX, y: e.clientY } : null;
    if (dbl) followAt(e.clientX, e.clientY, true);                                  // doble toque = seguir (en pantallas táctiles no siempre llega el evento dblclick)
    else { sel = pick(e.clientX, e.clientY, down.touch); rsKey = ''; rs = null; refreshCard(); }
  }
  if (ptrs.size === 0) down = null;
});
function followAt(x, y, touch) {                      // doble clic / doble toque sobre un objeto: lo selecciona y lo sigue
  const p = pick(x, y, touch); if (!p) return;
  sel = p; rsKey = ''; rs = null; startTrack(p); refreshCard();
  if (p.kind === 'moon') { const m = moonSel(); if (m) { const f = clamp(Math.max(zoomFovFor(p.planet), 2.6 * m.s.sepArcsec / 3600), MIN_FOV, 60); if (view.fov > f * 1.2) goal = { az: m.b.az_deg, alt: m.b.alt_apparent_deg, fov: f }; } }
  else if (p.kind === 'body' && view.fov > zoomFovFor(p.key) * 1.2) goal = { az: last[p.key].az_deg, alt: last[p.key].alt_apparent_deg, fov: zoomFovFor(p.key) };
}
cv.addEventListener('dblclick', (e) => { if (!lastTapWasTouch) followAt(e.clientX, e.clientY, false); });
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
  if (e.key === 'n' || e.key === 'N') toggleNight();
  if (e.key === 't' || e.key === 'T') toggleTrack();
  if ((e.key === 'c' || e.key === 'C') && sel) { stopTrack(); const t = sel.kind === 'body' || sel.kind === 'moon' ? { az: last[sel.kind === 'moon' ? sel.planet : sel.key].az_deg, alt: last[sel.kind === 'moon' ? sel.planet : sel.key].alt_apparent_deg } : horizontalOf(rotM, starVec(sel.i)); goal = { az: t.az, alt: clamp(t.alt, -90, 90) }; }
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

// ── Menú en cascada "Alcance de la trayectoria": cada astro con sus propios alcances ──
const geo = { id: null, n: 0, stamp: '', m3: false, view: { ...CENTER }, zex: 'auto' };
const rgSpanText = (b, id) => { const d = cycleDays(b, id); return T('rng.' + id, { d: d && d.toFixed(d < 100 ? 2 : 0).replace(/\.?0+$/, ''), y: d && (d / 365.25).toFixed(1) }); };
function buildRgMenu() {
  const list = $('rgList'); list.replaceChildren();
  for (const b of BODY_ORDER) {
    const li = document.createElement('li'), bt = document.createElement('button'); bt.type = 'button'; bt.setAttribute('role', 'menuitem');
    const dot = document.createElement('span'); dot.className = 'pdot'; dot.style.setProperty('--pc', rgbCss(PATH_COLORS[b]));
    const nm = document.createElement('span'); nm.append(dot, bodyName(b)); bt.append(nm, Object.assign(document.createElement('span'), { textContent: '▸' }));
    const ul = document.createElement('ul'); ul.setAttribute('role', 'menu');
    for (const id of rangesFor(b)) {
      const l2 = document.createElement('li'), r = document.createElement('button'); r.type = 'button'; r.setAttribute('role', 'menuitem'); r.dataset.b = b; r.dataset.r = id; r.textContent = rgSpanText(b, id);
      if (rangeOf(b) === id) r.className = 'cur'; l2.append(r); ul.append(l2);
    }
    li.append(bt, ul);
    li.addEventListener('mouseenter', () => { for (const o of list.querySelectorAll('li.open')) o.classList.remove('open'); li.classList.add('open'); });
    li.addEventListener('mouseleave', () => li.classList.remove('open'));
    bt.addEventListener('click', (ev) => { ev.stopPropagation(); const open = li.classList.contains('open'); for (const o of list.querySelectorAll('li.open')) o.classList.remove('open'); if (!open) li.classList.add('open'); });
    list.append(li);
  }
}
function setRgOpen(on) {
  const l = $('rgList'); l.hidden = !on; $('rgBtn').setAttribute('aria-expanded', on);
  if (on) { const sr = $('side').getBoundingClientRect(), br = $('rgBtn').getBoundingClientRect(); l.style.top = (br.bottom - sr.top + 3) + 'px'; }
  else for (const o of l.querySelectorAll('li.open')) o.classList.remove('open');
}
$('rgBtn').onclick = (e) => { e.stopPropagation(); setRgOpen($('rgList').hidden); };
$('rgList').addEventListener('click', (e) => {
  const r = e.target.closest('button[data-r]'); if (!r) return;
  const b = r.dataset.b, id = r.dataset.r;
  if (id === '12h') delete ui.sp[b]; else ui.sp[b] = id;
  saveUi(); const o = { kind: 'body', key: b }, pid = pathId(o);
  removePath(pid); addPath(o); if (usesModal(id)) openGeo(pid);
  buildRgMenu(); setRgOpen(false); refreshCard(); dirty = true;
});
document.addEventListener('click', (e) => { if (!$('rgMenu').contains(e.target) && !$('rgList').contains(e.target)) setRgOpen(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('rgList').hidden) { setRgOpen(false); e.stopImmediatePropagation(); } }, true);

// ── Ventana de geometría: cómo se genera, en vivo, el ciclo / roseta / analema del astro ──
const geoTitle = () => { const p = paths.get(geo.id); if (p) $('gwTitle').textContent = bodyName(p.obj.key) + ' · ' + T('geo.' + p.range); };
function openGeo(id) {
  if (!paths.has(id)) return; geo.id = id; geo.n = 0; geo.stamp = ''; geo.view = { ...CENTER }; geo.zex = 'auto'; $('geoWin').hidden = false; geoTitle(); syncGeoUi(); requestAnimationFrame(() => ensureWin($('geoWin')));
  $('gwNote').textContent = T(paths.get(id).range === 'ana' ? 'geo.noteAna' : paths.get(id).range === 'saros' ? 'geo.noteSaros' : id === 'Luna' ? 'geo.noteMoon' : 'geo.noteRot');
  dirty = true;
}
function closeGeo() { geo.id = null; $('geoWin').hidden = true; }
$('gwClose').onclick = closeGeo;
$('gwReplay').onclick = () => { geo.n = 0; geo.stamp = ''; };
function drawGeo() {
  if (!geo.id) return;
  const p = paths.get(geo.id); if (!p) return closeGeo();
  const win = $('geoWin'); if (win.classList.contains('mini')) return;
  const pts = p.pts.length ? p.pts : p.live, total = 2 * p.cf.half + 1;
  if (!pts.length) return;
  geo.n = Math.min(pts.length, geo.n + Math.max(2, total / 240));
  const stamp = [Math.floor(geo.n), pts.length, Math.round(simMs / 60000), p.range, tsNow(), getLang(), ui.pl, win.clientWidth, geo.m3, geo.view.yaw, geo.view.pitch, geo.view.zoom, geo.zex, !!p.pts.length].join('|');
  if (stamp === geo.stamp) return; geo.stamp = stamp;
  const cv = $('gwCanvas'), W = cv.clientWidth || 280, dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(W * dpr)) { cv.width = cv.height = Math.round(W * dpr); } cv.style.height = W + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, W);
  const k = tsNow(), ana = p.range === 'ana', n = Math.floor(geo.n), isMoon = p.obj.key === 'Luna';
  let xy;
  if (ana) {
    const maz = pts.reduce((a, q) => a + q.az, 0) / pts.length, mal = pts.reduce((a, q) => a + q.alt, 0) / pts.length;
    xy = pts.map((q) => [((q.az - maz + 540) % 360) - 180, q.alt - mal]);
  } else xy = pts.map((q) => rosettePoint(p.range === 'saros' ? q.lon - q.sunLon : q.lon, q.r));   // Saros: Sol fijo a la derecha
  const ci = Math.min(Math.max(0, Math.round((simMs - pts[0].t) / p.cf.step)), pts.length - 1), sunNow = !ana && !isMoon ? rosettePoint(pts[ci].sunLon, 1) : null;
  if (geo.m3 && p.pts.length) { draw3D(g, W, k, p, pts, xy, ana, isMoon, ci); return $('gwStat').textContent = T('geo.done', { span: geoSpan(p) }); }
  const fit = fitPoints(xy, W, 26 * k, sunNow ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : []);
  g.lineWidth = 1; g.font = `${10 * k}px Georgia`; g.textBaseline = 'middle';
  if (!ana) {
    const [cx, cy] = fit.to([0, 0]);
    if (sunNow) { g.strokeStyle = 'rgba(255,210,60,.3)'; g.setLineDash([3, 4]); g.beginPath(); g.arc(cx, cy, fit.k, 0, 6.2832); g.stroke(); }
    g.setLineDash([]); g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(cx - 5, cy); g.lineTo(cx + 5, cy); g.moveTo(cx, cy - 5); g.lineTo(cx, cy + 5); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.textAlign = 'left'; g.fillText(T('geo.earth'), cx + 8, cy + 10);
    g.fillStyle = 'rgba(255,255,255,.45)'; g.textAlign = 'right'; g.fillText(p.range === 'saros' ? '☉ →' : 'γ 0°', W - 5, cy - 8);
    const sp = sunNow ? fit.to(sunNow) : null;
    if (sp) { g.fillStyle = '#ffd23c'; g.textAlign = 'center'; g.beginPath(); g.arc(sp[0], sp[1], 4, 0, 6.2832); g.fill(); g.fillText('☉', sp[0], sp[1] - 10 * k); }
  } else {
    g.strokeStyle = 'rgba(255,255,255,.15)'; const [cx, cy] = fit.to([0, 0]);
    g.beginPath(); g.moveTo(0, cy); g.lineTo(W, cy); g.moveTo(cx, 0); g.lineTo(cx, W); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.textAlign = 'right'; g.fillText('az →', W - 6, cy - 8); g.textAlign = 'left'; g.fillText('alt ↑', cx + 6, 10 * k);
  }
  const retro = p.rcol && rgbCss(p.rcol), base = rgbCss(p.col);
  g.lineWidth = 1.6; g.lineJoin = 'round';
  for (let i = 1; i < n && i < pts.length; i++) {
    const a = fit.to(xy[i - 1]), b = fit.to(xy[i]); g.strokeStyle = pts[i].retro ? retro : base;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  // marca del instante actual (o la punta del trazo mientras se dibuja) y su línea desde la Tierra
  const hi = Math.min(ci, n - 1);
  if (hi >= 0) {
    const c = fit.to(xy[hi]);
    if (!ana) { const e = fit.to([0, 0]); g.strokeStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(e[0], e[1]); g.lineTo(c[0], c[1]); g.stroke(); }
    g.fillStyle = pts[hi].retro ? retro : base; g.strokeStyle = '#fff'; g.beginPath(); g.arc(c[0], c[1], 4.5, 0, 6.2832); g.fill(); g.stroke();
  }
  if (ui.pl && p.plan && p.pts.length) {
    g.textAlign = 'left'; g.fillStyle = 'rgba(235,235,245,.8)';
    for (const tk of p.ticks) if (tk.i < n) { const c = fit.to(xy[tk.i]); g.beginPath(); g.arc(c[0], c[1], 1.8, 0, 6.2832); g.fill(); const right = c[0] > W - 48 * k; g.textAlign = right ? 'right' : 'left'; g.fillText(fmtTick(tk.t, p.plan, p), c[0] + (right ? -4 : 4), c[1] - 5); }
    g.fillStyle = retro; for (const st of p.sts) if (st.i < n) { const c = fit.to(xy[st.i]); g.fillText(st.kind === 'R' ? '℞' : 'D', c[0] + 5, c[1] + 9); }
  }
  const done = p.pts.length && n >= pts.length;
  $('gwStat').textContent = done ? T('geo.done', { span: geoSpan(p) }) : T('geo.drawing', { n: Math.min(99, Math.floor((100 * n) / total)) });
}
const geoSpan = (p) => { const cd = cycleDays(p.obj.key, p.range); return cd >= 1000 ? (cd / 365.25).toFixed(1) + (getLang() === 'es' ? ' años' : ' years') : Math.round(cd) + (getLang() === 'es' ? ' días' : ' days'); };
// Vista 3D de un ciclo completo: planetas y Luna en coordenadas eclípticas geocéntricas (X hacia γ 0°, Z al norte eclíptico); analema en azimut, altura y tiempo.
function draw3D(g, W, k, p, pts, xy, ana, isMoon, ci) {
  let w;
  if (ana) {
    const e = Math.max(...xy.map((q) => Math.max(Math.abs(q[0]), Math.abs(q[1])))), t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    w = xy.map((q, i) => [q[0], q[1], ((pts[i].t - t0) / (t1 - t0) - 0.5) * 1.8 * e]);
  } else {
    w = pts.map((q) => { const c = Math.cos(q.lat * Math.PI / 180), lo = (p.range === 'saros' ? q.lon - q.sunLon : q.lon) * Math.PI / 180; return [q.r * c * Math.cos(lo), q.r * c * Math.sin(lo), q.r * Math.sin(q.lat * Math.PI / 180)]; });
    const z = geo.zex === 'auto' ? autoZ(w) : 1; geo.zn = z; $('gwZ').textContent = geo.zex === 'auto' ? T('geo.zex', { n: z }) : T('geo.zex1'); if (z !== 1) for (const q of w) q[2] *= z;
  }
  const ext = extent(w) * (ana ? 1.1 : 1.05), sc = ((W / 2 - 26 * k) / ext) * geo.view.zoom, v = geo.view, cx = W / 2, cy = W / 2;
  const P = (q) => { const r = proj3(q, v); return { x: cx + r.x * sc, y: cy - r.up * sc, d: r.depth / ext }; };
  g.lineWidth = 1; g.font = `${10 * k}px Georgia`; g.textBaseline = 'middle'; g.textAlign = 'center';
  // ejes X, Y, Z con su etiqueta; en los planetas, además, el anillo de 1 UA sobre el plano de la eclíptica
  const ax = [[[1, 0, 0], ana ? T('geo.axAz') : T('geo.axX'), '#ff8a7a'], [[0, 1, 0], ana ? T('geo.axAlt') : T('geo.axY'), '#8aff9a'], [[0, 0, 1], ana ? T('geo.axT') : T('geo.axZ'), '#8ab4ff']];
  for (const [d, label, col] of ax) {
    const a = P(d.map((c) => -c * ext * 0.9)), b = P(d.map((c) => c * ext * 0.9)); g.strokeStyle = col; g.globalAlpha = 0.45; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = col; g.fillText(label, b.x + (b.x >= cx ? 9 : -9) * k, b.y);
  }
  if (!ana && !isMoon) { g.strokeStyle = 'rgba(255,210,60,.3)'; g.setLineDash([3, 4]); g.beginPath(); for (let i = 0; i <= 72; i++) { const a = (i / 72) * 6.2832, q = P([Math.cos(a), Math.sin(a), 0]); i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); } g.stroke(); g.setLineDash([]); }
  const o = P([0, 0, 0]); if (!ana) { g.fillStyle = '#8fc1ff'; g.beginPath(); g.arc(o.x, o.y, 3.5, 0, 6.2832); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.textAlign = 'left'; g.fillText(T('sh.earth'), o.x + 6, o.y + 9); }
  const base = rgbCss(p.col), retro = rgbCss(p.rcol); g.lineWidth = 1.6; g.lineJoin = 'round'; g.lineCap = 'round';
  let prev = P(w[0]);
  for (let i = 1; i < w.length; i++) {
    const q = P(w[i]); g.globalAlpha = Math.min(1, Math.max(0.25, 0.65 + 0.7 * ((q.d + prev.d) / 2))); g.strokeStyle = pts[i].retro ? retro : base;
    g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(q.x, q.y); g.stroke(); prev = q;
  }
  g.globalAlpha = 1; const c = P(w[ci]); g.fillStyle = pts[ci].retro ? retro : base; g.strokeStyle = '#fff'; g.beginPath(); g.arc(c.x, c.y, 4.5, 0, 6.2832); g.fill(); g.stroke();
  g.fillStyle = 'rgba(235,235,245,.65)'; g.textAlign = 'left'; g.fillText(T('geo.hint3d'), 6, W - 10 * k);
  if (!ana && geo.zn !== 1) { g.textAlign = 'right'; g.fillText(T('geo.zex', { n: geo.zn }), W - 6, 10 * k); }
}
function syncGeoUi() {
  $('gwMode').textContent = T(geo.m3 ? 'geo.m2' : 'geo.m3'); $('gwMode').setAttribute('aria-pressed', geo.m3);
  $('gwTools').hidden = !geo.m3; $('gwReplay').hidden = geo.m3; $('gwCanvas').classList.toggle('m3', geo.m3);
  const p = paths.get(geo.id); $('gwZ').hidden = !!p && p.range === 'ana';
  $('gwZ').textContent = geo.zex === 'auto' ? T('geo.zex', { n: geo.zn || '·' }) : T('geo.zex1'); geo.stamp = ''; dirty = true;
}
$('gwMode').onclick = () => { geo.m3 = !geo.m3; geo.view = { ...CENTER }; syncGeoUi(); };
$('gwCenter').onclick = () => { geo.view = { ...CENTER }; geo.zex = 'auto'; syncGeoUi(); };
for (const [id, name] of [['gwTop', 'top'], ['gwFront', 'front'], ['gwSide', 'side']]) $(id).onclick = () => { geo.view = { ...geo.view, ...PRESETS[name] }; geo.stamp = ''; };
$('gwZ').onclick = () => { geo.zex = geo.zex === 'auto' ? 1 : 'auto'; syncGeoUi(); };
{ // arrastrar para girar (X, Y, Z), rueda para acercar, doble clic para centrar
  const cv = $('gwCanvas'); let drag = null;
  cv.addEventListener('pointerdown', (e) => { if (!geo.m3) return; drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (!drag) return; geo.view = orbit(geo.view, e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY }; });
  const end = () => { drag = null; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', (e) => { if (!geo.m3) return; e.preventDefault(); geo.view = zoomBy(geo.view, e.deltaY); }, { passive: false });
  cv.addEventListener('dblclick', () => { if (geo.m3) $('gwCenter').click(); });
}

// ── Ventanas flotantes (geometría y guía de sombra): se arrastran desde la barra de título y nunca se superponen con otro panel ──
const FLOAT_KEY = 'caeliscope.winpos'; let fpos = {}; try { fpos = JSON.parse(localStorage.getItem(FLOAT_KEY) || '{}') || {}; } catch { /* sin almacenamiento */ }
const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
const othersOf = (el) => [...document.querySelectorAll('.hud.skyhud')].filter((o) => o !== el && o.id !== 'fovBox' && !o.hidden && getComputedStyle(o).display !== 'none').map(rectOf);
const placeWin = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; };
let ensuring = false;
function ensureWin(el) {
  if (el.hidden || ensuring || el.classList.contains('dragging')) return;
  ensuring = true;
  try {
    const sv = fpos[el.id]; if (sv && !el.dataset.placed) { placeWin(el, sv.x, sv.y); } el.dataset.placed = '1';
    const r = rectOf(el), f = findFree(r, othersOf(el), innerWidth, innerHeight);
    if (Math.abs(f.x - r.x) > 0.5 || Math.abs(f.y - r.y) > 0.5) placeWin(el, f.x, f.y);
  } finally { ensuring = false; }
}
for (const el of [$('geoWin'), $('eclWin')]) {
  const bar = el.querySelector('.phdr'); let d = null;
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = rectOf(el); d = { px: e.clientX, py: e.clientY, x: r.x, y: r.y }; bar.setPointerCapture(e.pointerId); el.classList.add('dragging');
  });
  bar.addEventListener('pointermove', (e) => {
    if (!d) return; const r = rectOf(el), n = slideTo(r, d.x + e.clientX - d.px, d.y + e.clientY - d.py, othersOf(el), innerWidth, innerHeight);
    if (n.x !== r.x || n.y !== r.y) placeWin(el, n.x, n.y);
  });
  const end = () => { if (!d) return; d = null; el.classList.remove('dragging'); const r = rectOf(el); fpos[el.id] = { x: Math.round(r.x), y: Math.round(r.y) }; try { localStorage.setItem(FLOAT_KEY, JSON.stringify(fpos)); } catch { /* sin almacenamiento */ } };
  bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
  if (window.ResizeObserver) new ResizeObserver(() => ensureWin(el)).observe(el);
}
addEventListener('resize', () => { for (const el of [$('geoWin'), $('eclWin')]) ensureWin(el); });

// ── Guía de sombra: conos de umbra y penumbra del eclipse (solar: sombra de la Luna; lunar: sombra de la Tierra) en el instante actual ──
const ecl = { open: false, stamp: '' };
function setShadow(on) {
  ecl.open = on; $('eclWin').hidden = !on; $('tShadow').setAttribute('aria-pressed', on); ecl.stamp = ''; dirty = true; if (on) requestAnimationFrame(() => ensureWin($('eclWin')));
}
$('tShadow').onclick = () => setShadow(!ecl.open);
$('ewClose').onclick = () => setShadow(false);
function setSaros(on) {
  const f = (ms) => new Intl.DateTimeFormat(rgLoc(), { dateStyle: 'medium', timeZone: obsTz }).format(ms);
  $('ewSaros').textContent = on ? T('sh.saros', { prev: f(sarosReturn(simMs, -1)), next: f(sarosReturn(simMs, 1)) }) : '';
}
function drawShadow() {
  if (!ecl.open || !last || $('eclWin').classList.contains('mini')) return;
  const stamp = [Math.round(simMs / 30000), tsNow(), getLang(), $('eclWin').clientWidth].join('|');
  if (stamp === ecl.stamp) return; ecl.stamp = stamp;
  const cv = $('ewCanvas'), W = cv.clientWidth || 280, dpr = Math.min(2, devicePixelRatio || 1), k = tsNow();
  if (cv.width !== Math.round(W * dpr)) cv.width = cv.height = Math.round(W * dpr); cv.style.height = W + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, W); g.textBaseline = 'middle'; g.font = `${10 * k}px Georgia`;
  const moon = last.Luna, sun = last.Sol, mode = shadowMode(moon, sun), f2 = (x, n = 2) => x.toFixed(n);
  $('ewTitle').textContent = T(mode === 'solar' ? 'sh.solar' : 'sh.lunar');
  const disc = (x, y, r, fill, stroke, dash) => { g.beginPath(); g.arc(x, y, Math.max(r, 0.5), 0, 6.2832); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.setLineDash(dash || []); g.strokeStyle = stroke; g.stroke(); g.setLineDash([]); } };
  if (mode === 'solar') {
    const S = solarShadow(moon, sun), x0 = 0.1 * W, sx = (0.78 * W) / S.sE, f = Math.max(1, Math.round((0.09 * W * S.sE) / (0.78 * W * S.rEarth))), yc = 0.23 * W, ty = (t) => yc - t * sx * f;
    $('ewNote').textContent = T('sh.noteSolar', { f });
    const aMax = S.sE * 1.1, poly = (fn, aEnd, fill) => { g.beginPath(); g.moveTo(x0, ty(fn(0))); g.lineTo(x0 + aEnd * sx, ty(fn(aEnd))); g.lineTo(x0 + aEnd * sx, ty(-fn(aEnd))); g.lineTo(x0, ty(-fn(0))); g.closePath(); g.fillStyle = fill; g.fill(); };
    poly(S.penAt, aMax, 'rgba(255,255,255,.14)');
    const aU = Math.min(S.Lu, aMax); poly(S.umbraAt, aU, 'rgba(0,0,0,.75)');
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, yc); g.lineTo(x0 + aMax * sx, yc); g.setLineDash([2, 4]); g.stroke(); g.setLineDash([]);
    if (S.Lu < aMax) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.setLineDash([3, 3]); for (const sg of [1, -1]) { g.beginPath(); g.moveTo(x0 + S.Lu * sx, yc); g.lineTo(x0 + aMax * sx, ty(sg * -S.umbraAt(aMax))); g.stroke(); } g.setLineDash([]); }
    disc(x0, yc, S.rMoon * sx * f, '#d8d8d8'); disc(x0 + S.sE * sx, ty(S.gamma * S.rEarth), S.rEarth * sx * f, '#2c5f9e', '#8fc1ff');
    g.fillStyle = '#dcdcdc'; g.textAlign = 'left'; g.fillText(T('sh.moon'), x0 - 4, yc + 14 * k); g.textAlign = 'center'; g.fillText(T('sh.earth'), Math.min(x0 + S.sE * sx, W - 18 * k), Math.min(0.46 * W, ty(S.gamma * S.rEarth) + S.rEarth * sx * f + 10 * k));
    g.fillStyle = '#ffd23c'; g.textAlign = 'left'; g.fillText(T('sh.toSun'), 4, 9 * k); g.strokeStyle = '#ffd23c'; g.beginPath(); g.moveTo(4, 16 * k); g.lineTo(0, 16 * k); g.stroke();
    // plano fundamental (a escala): círculo de la Tierra, penumbra y umbra / antumbra
    const cy = 0.74 * W, R = Math.min(3, Math.max(1.2, S.gamma + S.l1 + 0.1)), sc = (0.23 * W) / R, sxp = W / 2 + S.px * sc, syp = cy - S.py * sc;
    g.save(); g.beginPath(); g.rect(0, 0.5 * W, W, 0.5 * W); g.clip();
    disc(sxp, syp, S.l1 * sc, 'rgba(255,255,255,.16)', 'rgba(255,255,255,.4)');
    S.l2 > 0 ? disc(sxp, syp, S.l2 * sc, 'rgba(0,0,0,.8)', '#fff') : disc(sxp, syp, -S.l2 * sc, null, '#fff', [3, 3]);
    disc(W / 2, cy, sc, 'rgba(44,95,158,.55)', '#8fc1ff'); g.restore();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.textAlign = 'left'; g.fillText('N ↑', 6, 0.53 * W);
    setSaros(S.kind !== 'none');
    $('ewStat').textContent = S.kind === 'none' && S.gamma > 3 ? T('sh.k.none') : T('sh.statSolar', { kind: T('sh.k.' + S.kind), g: f2(S.gamma), u: Math.round(S.umbraKm).toLocaleString(locale()), p: Math.round(S.penumbraKm).toLocaleString(locale()) });
  } else {
    const L = lunarShadow(moon, sun), R = Math.max(L.rp + 0.3, Math.hypot(L.dx, L.dy) + L.sM + 0.1), sc = (W / 2 - 12 * k) / R, cx = W / 2, cy = W / 2, mx = cx - L.dx * sc, my = cy - L.dy * sc;
    $('ewNote').textContent = T('sh.noteLunar');
    disc(cx, cy, L.rp * sc, 'rgba(255,255,255,.12)', 'rgba(255,255,255,.35)'); disc(cx, cy, L.ru * sc, 'rgba(70,16,0,.7)', 'rgba(255,140,90,.7)');
    disc(mx, my, L.sM * sc, '#d9d9d2');
    g.save(); g.beginPath(); g.arc(mx, my, L.sM * sc, 0, 6.2832); g.clip();
    disc(cx, cy, L.rp * sc, 'rgba(0,0,0,.25)'); disc(cx, cy, L.ru * sc, 'rgba(150,40,10,.7)'); g.restore();
    disc(mx, my, L.sM * sc, null, 'rgba(255,255,255,.8)');
    g.fillStyle = 'rgba(255,255,255,.7)'; g.textAlign = 'left'; g.fillText(T('sh.moon'), mx + L.sM * sc + 4, my);
    setSaros(L.kind !== 'none');
    $('ewStat').textContent = T('sh.statLunar', { kind: T('sh.l.' + L.kind), um: f2(L.umbMag), pm: f2(L.penMag) });
  }
}

// ── Idioma: inglés por defecto; el botón EN / ES cambia la interfaz, los nombres de los astros y las constelaciones ──
function applyUi() {
  const r = document.documentElement.style;
  r.setProperty('--ts', tsNow()); r.setProperty('--op', ui.op);
  for (const b of document.querySelectorAll('.txtsw')) b.querySelectorAll('span').forEach((sp, i) => sp.classList.toggle('on', i === ui.ts));
  $('panelOp').value = Math.round(ui.op * 100);
  $('tPL').setAttribute('aria-pressed', ui.pl); $('tMoons').setAttribute('aria-pressed', ui.mn); $('tJson').setAttribute('aria-pressed', ui.js); if (!ui.js) jsonOpen = false;
  document.body.classList.toggle('night', ui.nm); $('tNight').setAttribute('aria-pressed', ui.nm);
  fitKey = ''; dirty = true;
}
for (const b of document.querySelectorAll('.txtsw')) b.onclick = () => { ui.ts = nextTextStep(ui.ts); saveUi(); applyUi(); };
const toggleNight = () => { ui.nm = !ui.nm; saveUi(); applyUi(); };
$('tNight').onclick = toggleNight;
$('tMoons').onclick = () => { ui.mn = !ui.mn; saveUi(); applyUi(); refreshCard(); };
$('tPL').onclick = () => { ui.pl = !ui.pl; saveUi(); applyUi(); };
$('tJson').onclick = () => { ui.js = !ui.js; saveUi(); applyUi(); refreshCard(); };
$('panelOp').oninput = (e) => { ui.op = clampOpacity(+e.target.value / 100); saveUi(); applyUi(); };
// PWA: se registra el service worker (solo en producción) y se ofrece instalar la app cuando el navegador lo permite.
let installEvt = null;
if ('serviceWorker' in navigator && import.meta.env?.PROD) addEventListener('load', () => navigator.serviceWorker.register(`${BASE}sw.js`).catch(() => { /* sin service worker: la app funciona igual, solo en línea */ }));
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('abInstall').hidden = false; });
addEventListener('appinstalled', () => { installEvt = null; $('abInstall').hidden = true; });
$('abInstall').onclick = async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch { /* cerrado */ } installEvt = null; $('abInstall').hidden = true; };
function renderAbout() { const A = ABOUT[getLang()] || ABOUT.en; $('abTitle').textContent = A.title; $('abClose').setAttribute('aria-label', A.close); $('abClose').title = A.close; $('abBody').innerHTML = aboutHtml(getLang()); $('abContact').textContent = A.contact; $('abInstall').textContent = A.install; $('abDocs').href = `docs/${getLang() === 'es' ? 'es' : 'en'}/inicio.html`; for (const [id, k] of [['abDocs', 'altDocs'], ['abRepo', 'altRepo'], ['abEngine', 'altEngine'], ['abHerm', 'altHerm']]) { const e = $(id); e.title = A[k]; e.setAttribute('aria-label', A[k]); } }
let aboutFrom = null;
function showAbout(on) { $('aboutWin').hidden = !on; $('aboutVeil').hidden = !on; if (on) { aboutFrom = document.activeElement; renderAbout(); $('abClose').focus(); } else if (aboutFrom && aboutFrom.focus) aboutFrom.focus(); }
$('abClose').onclick = () => showAbout(false); $('aboutVeil').onclick = () => showAbout(false);
$('skyLogo').onclick = () => showAbout(true); $('gAbout').onclick = () => showAbout(true);
$('skyLogo').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showAbout(true); } });
document.addEventListener('keydown', (e) => { if ($('aboutWin').hidden) return; if (e.key === 'Escape') showAbout(false); e.stopImmediatePropagation(); }, true);
function applyLang() {
  applyStatic(); if (!$('aboutWin').hidden) renderAbout(); syncGeoUi(); rebuildObjList(); buildEvMenu(); relabelDrums(); setSpeed(speed); setDanjonLbl(); renderGDetail(); buildRgMenu(); ecl.stamp = ''; if (geo.id) { geo.stamp = ''; geoTitle(); }
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
    alpha($('sHerm'), st.hermetica); alpha($('sEngine'), st.engine); alpha($('sTitle'), st.title); alpha($('sSub'), st.sub); alpha($('sSkip'), st.skip); alpha($('sVig'), Math.max(st.hermetica, st.engine, st.title) * 0.9);
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
addEventListener('pointerdown', splashPoke);          // la portada se cierra con un clic o un toque en cualquier lugar, o con cualquier tecla; mover el ratón ya no la cierra
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
    drawLabels(); drawGeo(); drawShadow();
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
applyUi(); applyLang();
requestAnimationFrame(frame);
window.__sky = { setTrailMode, zoomBody(key) { sel = { kind: 'body', key }; refreshCard(); zoomTo(sel); }, get last() { return last; }, get paths() { return paths; }, get trails() { return trails; }, globe, goSky, newLocation, skip() { splashPoke(); }, setLang, get mode() { return appMode; }, get flowT() { return flowT; }, get track() { return track; }, get locked() { return trackLocked; }, setLandscape, get mags() { return mags; }, get land() { return land; }, view, obs, get simMs() { return simMs; }, set simMs(v) { simMs = v; dirty = true; }, set speed(v) { speed = v; }, update, get eclNow() { return eclNow; }, set danjon(v) { danjon = v; dirty = true; } };   // para pruebas automáticas
