// Capa de detalle: teselas de imagen satelital (NASA GIBS) que se superponen al globo base cuando la cámara se acerca.
import * as THREE from 'three';
import { latLonToVec, vecToLatLon, rayHitSphere, clamp } from './globe-math.mjs';
import { yToLat, xToLon, tileKey, tilesForSamples, zoomForGround, groundMetersPerPx, lonToX, latToY, TILE_PX } from './tiles-math.mjs';

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/';
// Fuentes en orden de preferencia: si la primera no responde, se prueba la siguiente. {z}/{y}/{x} es el esquema XYZ estándar.
export const TILE_SOURCES = [
  { name: 'NASA Blue Marble (relieve)', url: GIBS + 'BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg', maxZ: 8 },
  { name: 'NASA Blue Marble', url: GIBS + 'BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg', maxZ: 8 },
  { name: 'NASA Blue Marble', url: GIBS + 'BlueMarble_NextGeneration/default/2004-08-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg', maxZ: 8 },
];
export const MIN_Z = 5, MAX_CONCURRENT = 6, MAX_CACHED = 260, SEGS = 8, RADIUS = 1.0001;

const TILE_VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main(){ vUv = uv; vN = normalize(position); vP = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;

export class TileLayer {
  constructor(globe, fragmentShader, sources = TILE_SOURCES) {
    const q = new URLSearchParams(location.search);       // ?tilesUrl=...{z}/{y}/{x}... sirve para probar con otro servidor de teselas
    if (q.get('tilesUrl')) sources = [{ name: 'servidor de prueba', url: q.get('tilesUrl'), maxZ: +(q.get('tilesZ') || 8) }];
    this.globe = globe; this.sources = sources; this.src = 0; this.fs = fragmentShader;
    this.cache = new Map(); this.inflight = 0; this.frame = 0; this.t = 0; this.fails = 0; this.oks = 0; this.enabled = true; this.status = '';
    this.group = new THREE.Group(); globe.scene.add(this.group); this.wanted = []; this.onStatus = null;
  }
  setStatus(s) { if (s !== this.status) { this.status = s; if (this.onStatus) this.onStatus(s); } }
  url(z, x, y) { return this.sources[this.src].url.replace('{z}', z).replace('{y}', y).replace('{x}', x); }
  // Qué teselas hacen falta para lo que se ve ahora (cada ~120 ms)
  plan() {
    const g = this.globe, cam = g.camera, H = g.h || innerHeight, ray = new THREE.Raycaster(), samples = [];
    let centerHit = null, cdist = 0;
    for (let iy = 0; iy <= 4; iy++) for (let ix = 0; ix <= 6; ix++) {
      ray.setFromCamera(new THREE.Vector2((ix / 6) * 2 - 1, (iy / 4) * 2 - 1), cam);
      const o = ray.ray.origin, d = ray.ray.direction, hit = rayHitSphere([o.x, o.y, o.z], [d.x, d.y, d.z]); if (!hit) continue;
      const ll = vecToLatLon(hit); samples.push(ll);
      if (ix === 3 && iy === 2) { centerHit = ll; cdist = Math.hypot(hit[0] - o.x, hit[1] - o.y, hit[2] - o.z); }
    }
    if (!centerHit || samples.length < 3) return [];
    const maxZ = this.sources[this.src].maxZ;
    let zt = zoomForGround(groundMetersPerPx(cdist, 30, H), centerHit.lat, MIN_Z, maxZ);
    if (zt < MIN_Z) return [];
    for (;;) {
      const list = [];
      for (let z = MIN_Z; z <= zt; z++) list.push(...tilesForSamples(samples, z, z === zt ? 1 : 0));
      if (list.length <= 110 || zt <= MIN_Z) {
        const dc = (t) => Math.hypot(t.x + 0.5 - lonToX(centerHit.lon, t.z), t.y + 0.5 - latToY(centerHit.lat, t.z));
        return list.sort((a, b) => a.z - b.z || dc(a) - dc(b));
      }
      zt--;
    }
  }
  makeMesh(z, x, y, tex) {
    const pos = [], uv = [], idx = [], n = SEGS, e = 0.5 / TILE_PX;
    const y0 = y, y1 = y + 1;
    for (let i = 0; i <= n; i++) {
      const lat = yToLat(y0 + (y1 - y0) * (i / n), z);
      for (let j = 0; j <= n; j++) {
        const lon = xToLon(x + j / n, z), v = latLonToVec(lat, lon);
        pos.push(v[0] * RADIUS, v[1] * RADIUS, v[2] * RADIUS); uv.push(e + (1 - 2 * e) * (j / n), 1 - (e + (1 - 2 * e) * (i / n)));
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = i * (n + 1) + j, c = a + n + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ vertexShader: TILE_VS, fragmentShader: this.fs, transparent: true, depthWrite: false,
      uniforms: { ...this.globe.shared, uTile: { value: tex }, uAlpha: { value: 0 } } });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = -10 + z; this.group.add(mesh); return mesh;
  }
  request(t) {
    const k = tileKey(t.z, t.x, t.y); let rec = this.cache.get(k);
    if (!rec) { rec = { state: 'new', z: t.z, x: t.x, y: t.y, seen: 0, alpha: 0, mesh: null, tex: null, tries: 0 }; this.cache.set(k, rec); }
    rec.seen = this.frame;
    if (rec.state !== 'new' || this.inflight >= MAX_CONCURRENT) return rec;
    rec.state = 'loading'; this.inflight++;
    const img = new Image(); img.crossOrigin = 'anonymous'; const srcIdx = this.src;
    img.onload = () => {
      this.inflight--; this.oks++; this.fails = 0;
      if (!this.cache.has(k)) return;
      const tex = new THREE.Texture(img); tex.needsUpdate = true; tex.anisotropy = 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
      rec.tex = tex; rec.mesh = this.makeMesh(rec.z, rec.x, rec.y, tex); rec.state = 'ready'; this.setStatus('activo');
    };
    img.onerror = () => {
      this.inflight--; rec.state = 'error'; rec.at = performance.now();
      if (srcIdx !== this.src) { rec.state = 'new'; return; }
      this.fails++;
      if (this.oks === 0 && this.fails >= 8) { // esta fuente no responde: se prueba la siguiente
        if (this.src + 1 < this.sources.length) { this.src++; this.fails = 0; for (const r of this.cache.values()) if (r.state === 'error') r.state = 'new'; }
        else { this.enabled = false; this.setStatus('no disponible'); }
      }
    };
    img.src = this.url(t.z, t.x, t.y); return rec;
  }
  update(dt) {
    this.frame++; this.t += dt;
    if (!this.enabled) return;
    if (!this.nextPlan || this.t >= this.nextPlan) {
      this.nextPlan = this.t + 0.12; this.wanted = this.plan();
      const seen = new Set();
      for (const t of this.wanted) { seen.add(tileKey(t.z, t.x, t.y)); this.request(t); }
      if (this.wanted.length && !this.status) this.setStatus('cargando');
      if (!this.wanted.length && this.status === 'cargando') this.setStatus('');
      this.visible = seen;
      if (this.cache.size > MAX_CACHED) this.evict();
    }
    for (const [k, r] of this.cache) {
      if (!r.mesh) continue;
      const on = this.visible && this.visible.has(k);
      r.mesh.visible = on || r.alpha > 0;
      r.alpha = clamp(r.alpha + (on ? dt * 3.2 : -dt * 2.5), 0, 1); r.mesh.material.uniforms.uAlpha.value = r.alpha;
    }
  }
  evict() {
    const olds = [...this.cache.entries()].filter(([, r]) => this.frame - r.seen > 120).sort((a, b) => a[1].seen - b[1].seen);
    for (const [k, r] of olds.slice(0, this.cache.size - Math.floor(MAX_CACHED * 0.7))) {
      if (r.mesh) { this.group.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); }
      if (r.tex) r.tex.dispose(); this.cache.delete(k);
    }
  }
  get active() { return this.status === 'activo'; }
}
