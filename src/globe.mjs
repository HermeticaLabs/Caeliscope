// El globo terrestre: esfera con texturas reales, día y noche según el Sol de Caelis, atmósfera, nubes, pin y controles de arrastre/zoom.
import * as THREE from 'three';
import { TileLayer } from './tiles.mjs';
import { latLonToVec, vecToLatLon, rayHitSphere, panPerPx, journeyPose, clamp, wrap180, D2R } from './globe-math.mjs';
const BASE = import.meta.env?.BASE_URL ?? '/';   // ruta base del despliegue (raíz o subcarpeta)

export const MIN_D = 1.04, MAX_D = 9, FOV = 30;

const EARTH_VS = `
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * position); vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP,1.0); }`;
const SHADE_GLSL = `
vec3 shadeEarth(vec3 day, vec3 night, float w, vec3 N, vec3 V, vec3 L){
  float ndl = dot(N, L);
  float dayAmt = smoothstep(-0.10, 0.22, ndl);
  vec3 lit = day * (0.05 + pow(max(ndl, 0.0), 0.62) * 1.2);
  float tw = exp(-pow((ndl - 0.02) / 0.11, 2.0));                       // crepúsculo: borde rojizo del terminador
  lit += vec3(0.55, 0.20, 0.05) * tw * dot(day, vec3(0.33)) * 0.55;
  vec3 dark = day * 0.012 + night * vec3(1.25, 1.05, 0.8);              // lado nocturno: luces de ciudades
  vec3 col = mix(dark, lit, dayAmt);
  vec3 H = normalize(L + V);
  col += vec3(1.0, 0.93, 0.8) * pow(max(dot(N, H), 0.0), 220.0) * w * smoothstep(0.0, 0.3, ndl) * 0.5;   // brillo del océano
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += vec3(0.22, 0.45, 1.0) * rim * 0.55 * smoothstep(-0.25, 0.35, ndl);   // luz dispersada en el borde
  return col;
}`;
const EARTH_FS = `
precision highp float;
uniform sampler2D uDay, uNight, uSpec; uniform vec3 uSun, uCam;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
${SHADE_GLSL}
void main(){
  vec3 N = normalize(vN);
  gl_FragColor = vec4(shadeEarth(texture2D(uDay, vUv).rgb, texture2D(uNight, vUv).rgb, texture2D(uSpec, vUv).r, N, normalize(uCam - vP), normalize(uSun)), 1.0);
}`;
// Teselas de detalle: el color del día viene de la tesela; noche y océano, del mapa global
export const TILE_FS = `
precision highp float;
uniform sampler2D uTile, uNight, uSpec; uniform vec3 uSun, uCam; uniform float uAlpha;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
${SHADE_GLSL}
void main(){
  vec3 N = normalize(vN);
  vec2 g = vec2(atan(-N.z, N.x) / 6.2831853 + 0.5, asin(clamp(N.y, -1.0, 1.0)) / 3.1415927 + 0.5);
  gl_FragColor = vec4(shadeEarth(texture2D(uTile, vUv).rgb, texture2D(uNight, g).rgb, texture2D(uSpec, g).r, N, normalize(uCam - vP), normalize(uSun)), uAlpha);
}`;
const CLOUD_FS = `
precision highp float;
uniform sampler2D uCl; uniform vec3 uSun;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main(){
  vec3 N = normalize(vN); float ndl = dot(N, normalize(uSun));
  float a = texture2D(uCl, vUv).r;
  float lit = 0.03 + pow(max(ndl, 0.0), 0.7) * 1.05; lit += exp(-pow((ndl - 0.02) / 0.11, 2.0)) * 0.25;
  gl_FragColor = vec4(vec3(1.0, 0.98, 0.96) * lit, a * 0.85);
}`;
const ATMO_VS = `varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP,1.0); }`;
const ATMO_FS = `
precision highp float;
uniform vec3 uSun, uCam; uniform float uK;
varying vec3 vP;
void main(){
  vec3 d = normalize(vP - uCam);
  float t0 = -dot(uCam, d);
  vec3 q = t0 > 0.0 ? uCam + d * t0 : uCam;                          // punto del rayo más cercano al planeta
  float h = length(q) - 1.0;
  float g = exp(-max(h, 0.0) / 0.028) * (h < 0.0 ? 0.0 : 1.0);
  float lit = smoothstep(-0.35, 0.45, dot(normalize(q), normalize(uSun)));
  vec3 col = mix(vec3(0.20, 0.38, 0.95), vec3(0.45, 0.72, 1.0), pow(lit, 2.0));
  col = mix(col, vec3(1.0, 0.45, 0.2), exp(-pow((dot(normalize(q), normalize(uSun)) - 0.0) / 0.12, 2.0)) * 0.35);
  gl_FragColor = vec4(col * g * lit * uK, 1.0);
}`;

const STAR_GVS = `attribute float aMag; attribute float aBv; uniform float uPx; varying vec3 vC; varying float vA;
void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float b = clamp((6.8 - aMag) / 6.0, 0.0, 1.0); gl_PointSize = uPx * (1.1 + 3.4 * pow(b, 1.6)); vA = 0.22 + 0.78 * pow(b, 1.2);
  vC = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.82, 0.62), smoothstep(0.0, 1.5, aBv)); }`;
const STAR_GFS = `precision highp float; varying vec3 vC; varying float vA;
void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = clamp(1.0 - d, 0.0, 1.0); a *= a; gl_FragColor = vec4(vC * vA * a * 1.15, 1.0); }`;

export class Globe {
  constructor(renderer, layer) {
    this.renderer = renderer; this.layer = layer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.003, 300);
    this.center = { lat: 20, lon: 0 }; this.d = 6; this.sunVec = new THREE.Vector3(1, 0.2, 0.4).normalize();
    this.pin = null; this.pinT = 0; this.spin = 0; this.goal = null; this.interactive = false; this.inertia = { lat: 0, lon: 0 };
    this.pose = null; this.time = 0; this.onPick = null; this.onChange = null; this.atmoK = 1;
    const load = (url) => { const t = new THREE.TextureLoader().load(url, () => { this.ready++; }); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
    this.ready = 0;
    this.starGroup = new THREE.Group(); this.scene.add(this.starGroup);   // estrellas reales (Hipparcos), giradas con el tiempo sidéreo
    fetch(`${BASE}stars.json`).then((r) => r.json()).then((o) => this._buildStars(o.stars)).catch(() => {});
    this.U = { uDay: { value: load(`${BASE}earth/day.jpg`) }, uNight: { value: load(`${BASE}earth/night.jpg`) }, uSpec: { value: load(`${BASE}earth/water.jpg`) }, uSun: { value: this.sunVec }, uCam: { value: this.camera.position } };
    this.shared = { uNight: this.U.uNight, uSpec: this.U.uSpec, uSun: this.U.uSun, uCam: this.U.uCam };
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.ShaderMaterial({ vertexShader: EARTH_VS, fragmentShader: EARTH_FS, uniforms: this.U }));
    this.scene.add(this.earth);
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(1.006, 96, 48), new THREE.ShaderMaterial({ vertexShader: EARTH_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false,
      uniforms: { uCl: { value: load(`${BASE}earth/clouds.jpg`) }, uSun: this.U.uSun } }));
    this.clouds.renderOrder = 1; this.scene.add(this.clouds);
    this.atmoU = { uSun: this.U.uSun, uCam: this.U.uCam, uK: { value: 1 } };
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(1.14, 96, 48), new THREE.ShaderMaterial({ vertexShader: ATMO_VS, fragmentShader: ATMO_FS, uniforms: this.atmoU,
      transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
    this.atmo.renderOrder = 2; this.scene.add(this.atmo);
    // pin: tallo, cabeza dorada y anillo que late
    const gold = new THREE.MeshBasicMaterial({ color: 0xdcb450 }), ringMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    this.pinG = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.07, 8), gold); stem.position.y = 0.035;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 20, 12), gold); head.position.y = 0.075;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.022, 48), ringMat); this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.0015;
    this.pinG.add(stem, head, this.ring); this.pinG.visible = false; this.pinG.renderOrder = 3; this.scene.add(this.pinG);
    this.tiles = new TileLayer(this, TILE_FS); this.tiles.enabled = !/[?&]tiles=off/.test(location.search);
    this._bindControls();
  }
  _buildStars(stars) {
    const n = stars.length, pos = new Float32Array(n * 3), mag = new Float32Array(n), bv = new Float32Array(n);
    stars.forEach(([ra, dec, m, c], i) => { const v = latLonToVec(dec, ra); pos[3 * i] = v[0] * 100; pos[3 * i + 1] = v[1] * 100; pos[3 * i + 2] = v[2] * 100; mag[i] = m; bv[i] = c; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1)); g.setAttribute('aBv', new THREE.BufferAttribute(bv, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: this.renderer.getPixelRatio() } },
      vertexShader: STAR_GVS, fragmentShader: STAR_GFS });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = -2; this.starGroup.add(pts);
  }
  setSidereal(gmstDeg) { this.starGroup.rotation.y = -gmstDeg * D2R; }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.h = h; this.fit = Math.max(1, h / w); }
  fitD(d) { return d * (this.fit || 1); }   // en pantallas verticales el globo se aleja para caber a lo ancho
  setSun(lat, lon) { const v = latLonToVec(lat, lon); this.sunVec.set(v[0], v[1], v[2]); }
  setPin(lat, lon, animate = true) {
    if (lat == null) { this.pin = null; this.pinG.visible = false; return; }
    this.pin = { lat, lon }; const v = latLonToVec(lat, lon), P = new THREE.Vector3(v[0], v[1], v[2]);
    this.pinG.position.copy(P); this.pinG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), P.clone().normalize());
    if (animate) this.pinT = 0; else this.pinT = 1;
    this.pinG.visible = true;
  }
  flyTo(lat, lon, d) { this.goal = { lat: clamp(lat, -85, 85), lon, d: d ?? this.d }; this.inertia.lat = this.inertia.lon = 0; }
  setPose(p) { this.pose = p; } // posición forzada de la cámara durante el viaje (null: libre)
  _bindControls() {
    const L = this.layer, ptr = new Map(); let down = null, last = 0;
    L.addEventListener('pointerdown', (e) => {
      if (!this.interactive) return; ptr.set(e.pointerId, [e.clientX, e.clientY]); L.setPointerCapture(e.pointerId); this.goal = null; this.inertia.lat = this.inertia.lon = 0;
      if (ptr.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), pinch: false }; else if (down) down.pinch = true; last = performance.now();
    });
    L.addEventListener('pointermove', (e) => {
      const prev = ptr.get(e.pointerId); if (!prev || !this.interactive) return; ptr.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptr.size === 2) { const o = [...ptr.entries()].find(([id]) => id !== e.pointerId)[1];
        const d0 = Math.hypot(prev[0] - o[0], prev[1] - o[1]), d1 = Math.hypot(e.clientX - o[0], e.clientY - o[1]); if (d0 > 0 && d1 > 0) this.d = clamp(this.d * d0 / d1, MIN_D, MAX_D * (this.fit || 1)); return; }
      const now = performance.now(), dt = Math.max((now - last) / 1000, 0.008); last = now;
      const k = panPerPx(this.d, FOV, this.h || innerHeight) / D2R, dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      const dlon = (-dx * k) / Math.max(Math.cos(this.center.lat * D2R), 0.25), dlat = dy * k;
      this._move(dlat, dlon); this.inertia.lat = dlat / dt; this.inertia.lon = dlon / dt;
    });
    const up = (e) => {
      const had = ptr.delete(e.pointerId); if (!had) return;
      if (down && !down.pinch && ptr.size === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 600) {
        this.inertia.lat = this.inertia.lon = 0; const p = this.pick(e.clientX, e.clientY); if (p && this.onPick) this.onPick(p);
      } else if (performance.now() - last > 90) this.inertia.lat = this.inertia.lon = 0;
      if (ptr.size === 0) down = null;
    };
    L.addEventListener('pointerup', up); L.addEventListener('pointercancel', up);
    L.addEventListener('wheel', (e) => { if (!this.interactive) return; e.preventDefault(); this.goal = null; this.zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  }
  zoomBy(f) { this.d = clamp(this.d * f, MIN_D, MAX_D * (this.fit || 1)); }
  _move(dlat, dlon) { this.center.lat = clamp(this.center.lat + dlat, -85, 85); this.center.lon = wrap180(this.center.lon + dlon); }
  pick(cx, cy) { // latitud y longitud del punto de la Tierra bajo el cursor, o null si cae en el espacio
    const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    const r = new THREE.Raycaster(); r.setFromCamera(ndc, this.camera);
    const hit = rayHitSphere([r.ray.origin.x, r.ray.origin.y, r.ray.origin.z], [r.ray.direction.x, r.ray.direction.y, r.ray.direction.z]);
    return hit && vecToLatLon(hit);
  }
  render(dt) {
    this.time += dt;
    if (!this.pose) {
      if (this.spin) this.center.lon = wrap180(this.center.lon + this.spin * dt);
      if (this.goal) { // acercamiento suave al destino
        const k = 1 - Math.exp(-dt * 2.6), g = this.goal;
        this.center.lat += (g.lat - this.center.lat) * k; this.center.lon = wrap180(this.center.lon + wrap180(g.lon - this.center.lon) * k); this.d *= Math.pow(g.d / this.d, k);
        if (Math.abs(g.lat - this.center.lat) < 0.02 && Math.abs(wrap180(g.lon - this.center.lon)) < 0.02 && Math.abs(Math.log(g.d / this.d)) < 0.003) this.goal = null;
      } else if (this.interactive && (Math.abs(this.inertia.lat) > 0.05 || Math.abs(this.inertia.lon) > 0.05)) {
        this._move(this.inertia.lat * dt, this.inertia.lon * dt); const f = Math.exp(-dt * 3.2); this.inertia.lat *= f; this.inertia.lon *= f;
      }
    }
    const c = this.pose ? this.pose : { d: this.d, lat: this.center.lat, lon: this.center.lon, look: [0, 0, 0] };
    const v = latLonToVec(c.lat, c.lon); this.camera.position.set(v[0] * c.d, v[1] * c.d, v[2] * c.d);
    this.camera.up.set(0, 1, 0); this.camera.lookAt(c.look[0], c.look[1], c.look[2]);
    this.camera.updateMatrixWorld();
    this.atmoU.uK.value = this.atmoK; this.clouds.rotation.y += dt * 0.004;
    // el pin conserva un tamaño razonable en pantalla y late con suavidad
    if (this.pin) {
      this.pinT = Math.min(1, this.pinT + dt / 0.7); const e = this.pinT, over = 1 + 0.35 * Math.sin(Math.min(e, 1) * Math.PI) * (1 - e);
      const s = clamp((c.d - 1) * 0.42, 0.012, 1.5) * e * over; this.pinG.scale.setScalar(Math.max(s, 1e-4));
      const ph = (this.time % 2) / 2; this.ring.scale.setScalar(1 + ph * 2.2); this.ring.material.opacity = 0.8 * (1 - ph);
    }
    this.tiles.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
  applyJourney(s, from, pin) { this.pose = journeyPose(s, from, pin); }
}
