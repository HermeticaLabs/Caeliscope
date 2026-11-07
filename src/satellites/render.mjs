// Dibujo de una luna con forma (elipsoide triaxial), orientación real, fase y textura. Un solo renderizador WebGL compartido
// dibuja cada luna en un lienzo pequeño que luego se copia al cielo (2D) o al retrato de la ficha.
import * as THREE from 'three';
import { MOON_MAPS, PRESENT, LOOK } from './maps.mjs';

const hash = (x, y, s) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, s, period) {                                          // ruido de valores con costura horizontal (la textura envuelve la esfera)
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0), w = (v) => ((v % period) + period) % period;
  const a = hash(w(x0), y0, s), b = hash(w(x0 + 1), y0, s), c = hash(w(x0), y0 + 1, s), d = hash(w(x0 + 1), y0 + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// Textura provisional cuando no hay mapa real: color base con moteado de varias escalas (Titán, liso, es su aspecto verdadero).
export function proceduralTexture(key, W = 256) {
  const H = W / 2, look = LOOK[key] || LOOK.default, [r, g, b] = hexRgb(look.base), seed = [...key].reduce((s, ch) => s + ch.charCodeAt(0), 7);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g2 = c.getContext('2d'), img = g2.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let n = 0, amp = 1, tot = 0, f = 4;
    for (let o = 0; o < 5; o++) { n += amp * vnoise((x / W) * f, (y / H) * f / 2 + 7 * o, seed + o, f); tot += amp; amp *= 0.5; f *= 2; }
    const k = 1 + (n / tot - 0.5) * 2 * look.contrast, i = (y * W + x) * 4;
    img.data[i] = Math.min(255, r * k); img.data[i + 1] = Math.min(255, g * k); img.data[i + 2] = Math.min(255, b * k); img.data[i + 3] = 255;
  }
  g2.putImageData(img, 0, 0); return c;
}

export function createMoonRenderer(base = '/') {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const sunL = new THREE.DirectionalLight(0xffffff, 3), amb = new THREE.AmbientLight(0xffffff, 0);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), null); scene.add(mesh, sunL, sunL.target, amb);
  const mats = new Map(), loading = new Set();

  function materialFor(key) {
    let m = mats.get(key); if (m) return m;
    const tex = new THREE.CanvasTexture(proceduralTexture(key)); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
    m = new THREE.MeshLambertMaterial({ map: tex }); mats.set(key, m);
    const cfg = MOON_MAPS[key];
    if (cfg && PRESENT.has(key) && !loading.has(key)) {                      // mapa real: se pide una sola vez y reemplaza al provisional
      loading.add(key);
      new THREE.TextureLoader().load(`${base}moons/${cfg.file}`, (t) => {
        t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
        t.repeat.x = cfg.flipX ? -1 : 1; t.offset.x = cfg.flipX ? cfg.centerLonE / 360 : -cfg.centerLonE / 360;
        m.map = t; m.needsUpdate = true; if (onTexture) onTexture(key);
      }, undefined, () => { /* sin archivo: se queda el provisional */ });
    }
    return m;
  }
  let onTexture = null;

  // Dibuja la luna vista desde la Tierra (norte celeste arriba, este a la izquierda, como en el cielo). state: { eclipsed, transit }.
  function draw(key, frame, state, px) {
    const sh = frame.shape, mx = Math.max(sh.a, sh.b, sh.c), size = Math.max(8, Math.min(512, Math.round(px)));
    renderer.setPixelRatio(1); renderer.setSize(size, size, false);
    mesh.material = materialFor(key); mesh.scale.set(sh.a / mx, sh.c / mx, sh.b / mx);
    const [a, b, c] = [frame.a, frame.b, frame.c], basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(...a), new THREE.Vector3(...c), new THREE.Vector3(-b[0], -b[1], -b[2]));
    mesh.quaternion.setFromRotationMatrix(basis);
    const ob = new THREE.Vector3(...frame.toObs); cam.position.copy(ob).multiplyScalar(10); cam.up.set(0, 0, 1); cam.lookAt(0, 0, 0);
    sunL.position.set(...frame.toSun).multiplyScalar(10);
    if (state && state.eclipsed) { sunL.intensity = 0; amb.color.set(0x8a3a2a); amb.intensity = 0.55; }   // en la sombra del planeta: apenas un tinte rojizo
    else { sunL.intensity = state && state.transit ? 1.6 : 3; amb.color.set(0xffffff); amb.intensity = 0.012; }
    renderer.render(scene, cam); return canvas;
  }
  return { draw, setOnTexture(fn) { onTexture = fn; }, dispose() { renderer.dispose(); } };
}
