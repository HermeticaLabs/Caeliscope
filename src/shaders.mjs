import { SATURN_RING_OUTER } from './planet-math.mjs';
// Sombreadores (GLSL). La proyección es la MISMA fórmula que src/projection.mjs (que se prueba con pruebas unitarias):
//   0 estereográfica  r = 2f·tan(θ/2)   (conforme: un círculo sigue siendo círculo en cualquier parte de la pantalla)
//   1 equidistante    r = f·θ
//   2 rectilínea      r = f·tan(θ)      (la de una cámara normal: estira los bordes)
// θ es el ángulo entre la dirección del objeto y el centro de la vista; r la distancia en píxeles al centro.

export const PROJ_GLSL = /* glsl */ `
uniform vec3 uFwd, uRight, uUp;
uniform float uF, uMode;
uniform vec2 uRes;                       // tamaño de la pantalla en píxeles CSS
const float TH_MAX = 3.0;

float thetaOf(float r) {
  if (uMode < 0.5) return 2.0 * atan(r / (2.0 * uF));
  if (uMode < 1.5) return min(r / uF, 3.14159);
  return atan(r / uF);
}
// dirección del cielo -> posición de recorte; fuera de la proyección se envía fuera de pantalla
vec4 projectToClip(vec3 d) {
  float z = dot(d, uFwd), x = dot(d, uRight), y = dot(d, uUp);
  float s = length(vec2(x, y));
  float th = atan(s, z);
  bool bad = th > TH_MAX || (uMode > 1.5 && z < 0.02);
  if (bad) return vec4(3.0, 3.0, 3.0, 1.0);
  float r = uMode < 0.5 ? 2.0 * uF * tan(0.5 * th) : (uMode < 1.5 ? uF * th : uF * tan(th));
  vec2 dir = s > 1e-7 ? vec2(x, y) / s : vec2(0.0);
  return vec4(dir * r * 2.0 / uRes, 0.0, 1.0);
}
// píxel (NDC) -> dirección del cielo
vec3 unprojectNdc(vec2 ndc) {
  vec2 px = ndc * uRes * 0.5;
  float r = length(px);
  float th = thetaOf(r);
  vec2 k = r > 1e-6 ? px / r : vec2(1.0, 0.0);
  return cos(th) * uFwd + sin(th) * (k.x * uRight + k.y * uUp);
}
`;

const QUAD_VS = /* glsl */ `varying vec2 vNdc; void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Disco o cartel colocado por la CPU: centro en píxeles desde el centro de la pantalla y medio lado en píxeles.
const BILL_VS = /* glsl */ `
uniform vec2 uRes, uCenter; uniform float uHalf; varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4((uCenter + position.xy * uHalf) * 2.0 / uRes, 0.0, 1.0); }`;

// ── Cúpula: degradado del cielo, resplandor, Vía Láctea y el anillo naranja del horizonte en la totalidad ──
export const DOME_VS = QUAD_VS;
export const DOME_FS = /* glsl */ `${PROJ_GLSL}
varying vec2 vNdc;
uniform vec3 uSunDir, uZenith, uHorizon, uGlow;
uniform float uGlowA, uNight, uHasMW, uMWColor, uMWGain, uGlare, uRing;
uniform mat3 uRot; uniform sampler2D uMW;
void main(){
  vec3 d = normalize(unprojectNdc(vNdc));
  float h = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.45));
  float cs = max(dot(d, uSunDir), 0.0);
  col += uGlow * uGlowA * uGlare * (0.8 * pow(cs, 6.0) + pow(cs, 60.0)) * (1.0 - 0.6 * h);
  // resplandor tenue del horizonte de noche (luz difusa de la atmósfera y de los poblados): permite ver las siluetas del paisaje
  col += vec3(0.034, 0.036, 0.048) * pow(1.0 - h, 3.0) * uNight;
  // totalidad: se ve un "atardecer en 360°" porque más allá de la sombra de la Luna todavía es de día
  col += vec3(1.0, 0.52, 0.26) * uRing * pow(1.0 - h, 5.0) * 0.55;
  if (uNight > 0.0 && uHasMW > 0.5) {
    vec3 e = d * uRot;                                   // dirección del cielo -> ecuatorial
    vec2 uv = vec2(0.5 - atan(e.y, e.x) / 6.2831853, asin(clamp(e.z, -1.0, 1.0)) / 3.1415927 + 0.5);
    col += texture2D(uMW, uv).rgb * mix(vec3(0.55, 0.62, 0.85), vec3(1.0), uMWColor) * uMWGain * uNight * smoothstep(0.0, 0.3, d.y);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// ── Suelo y paisaje: todo lo que está bajo la silueta del horizonte. Se dibuja al final y tapa lo que queda detrás.
//    La silueta viene de la CPU (src/landscape.mjs) como alturas por azimut: 4 capas, de lejos (cerros) a cerca (casas y árboles).
//    Las capas lejanas se mezclan con la bruma del horizonte (perspectiva atmosférica); las casas tienen ventanas que se encienden de noche. ──
export const GROUND_VS = QUAD_VS;
export const GROUND_FS = /* glsl */ `${PROJ_GLSL}
varying vec2 vNdc;
uniform sampler2D uH, uI; uniform float uW, uMaxH, uLamps;
uniform vec3 uGround, uHaze, uCol0, uCol1, uCol2, uCol3;
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y); }
vec4 skyline(float az01){                                  // alturas (grados) de las 4 capas, con interpolación entre muestras
  float x = az01 * uW - 0.5, i0 = floor(x), f = x - i0;
  float a = (mod(i0, uW) + 0.5) / uW, b = (mod(i0 + 1.0, uW) + 0.5) / uW;
  return mix(texture2D(uH, vec2(a, 0.5)), texture2D(uH, vec2(b, 0.5)), f);
}
void layer(inout vec4 P, vec3 col, float h, float alt, float w){
  float c = clamp((h - alt) / w + 0.5, 0.0, 1.0);
  P = vec4(col * c, c) + P * (1.0 - c);
}
void main(){
  vec3 d = unprojectNdc(vNdc);
  float alt = degrees(asin(clamp(d.y, -1.0, 1.0)));
  float w = max(fwidth(alt), 1e-4);
  if (alt > uMaxH + 1.0) discard;
  float az01 = fract(atan(d.x, -d.z) / 6.2831853);
  vec4 h = skyline(az01);
  vec4 P = vec4(0.0);
  layer(P, mix(uCol0, uHaze, 0.55 * exp(-alt / 1.6)), h.x, alt, w);
  layer(P, mix(uCol1, uHaze, 0.40 * exp(-alt / 1.2)), h.y, alt, w);
  layer(P, mix(uCol2, uHaze, 0.25 * exp(-alt / 0.8)), h.z, alt, w);

  // primer plano: objetos (casas, árboles) sobre el horizonte y suelo con textura bajo él
  vec3 obj = uCol3;
  vec4 inf = texture2D(uI, vec2((floor(az01 * uW) + 0.5) / uW, 0.5));
  if (inf.x >= 0.0 && alt > 0.05) {                         // ventanas: se encienden de noche
    float width = inf.w, wall = inf.y;
    float cols = max(1.0, floor(width / 0.8)), rows = wall > 1.25 ? 2.0 : 1.0;
    vec2 g = vec2(inf.x * cols, (alt - 0.12) / wall * rows), cell = floor(g), fr = fract(g);
    bool win = fr.x > 0.3 && fr.x < 0.7 && fr.y > 0.3 && fr.y < 0.75 && g.y > 0.0 && g.y < rows;
    float on = step(0.45, hash21(cell + vec2(inf.z * 7.3, inf.z * 1.7)));
    if (win) obj = mix(obj * 1.5, vec3(1.0, 0.78, 0.42), on * uLamps * 0.95);
  }
  vec3 grd = uGround;
  if (alt < 0.0) {                                           // el suelo: textura en perspectiva (plano a 1.7 m bajo los ojos)
    float dist = min(1.7 / tan(radians(max(-alt, 0.02))), 3000.0);
    vec2 xz = d.xz / max(length(d.xz), 1e-4) * dist;
    float n = 0.5 * vnoise(xz * 0.30) + 0.3 * vnoise(xz * 1.6 + 7.0) + 0.2 * vnoise(vec2(xz.x * 9.0, xz.y * 2.2) + 3.0), near = exp(-dist / 160.0);
    grd *= 1.0 + 0.5 * near + (n - 0.5) * 1.1 * near;
    grd = mix(grd, uHaze, exp(radians(alt) * 38.0) * 0.8);
  }
  layer(P, mix(obj, grd, clamp(0.5 - alt / w, 0.0, 1.0)), h.w, alt, w);
  if (P.a <= 0.0) discard;
  gl_FragColor = P;                                          // alfa premultiplicado
}`;

// ── Estrellas y planetas: puntos que siempre son redondos, estén donde estén en la pantalla ──
export const STAR_VS = /* glsl */ `${PROJ_GLSL}
attribute float aMag; attribute vec3 aColor; uniform mat3 uRot; uniform float uPx, uMagLim, uSize, uBoost;
varying vec3 vC; varying float vA;
void main(){
  gl_Position = projectToClip(uRot * position);
  float vis = 1.0 - smoothstep(uMagLim - 0.4, uMagLim + 0.4, aMag);
  vA = vis * clamp(1.0 - (aMag - 1.0) * 0.11, 0.25, 1.0);
  vC = aColor;
  gl_PointSize = clamp(uSize - 0.85 * aMag, 1.6, 16.0) * uPx * uBoost;
}`;
export const STAR_FS = /* glsl */ `varying vec3 vC; varying float vA;
void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = 1.0 - smoothstep(0.0, 1.0, r);
  gl_FragColor = vec4(vC * vA * a * a * 1.4, 1.0); }`;

// ── Líneas (constelaciones, cuadrículas, eclíptica, meridiano) ──
export const LINE_VS = /* glsl */ `${PROJ_GLSL}
uniform mat3 uRot; void main(){ gl_Position = projectToClip(uRot * position); }`;
// Estelas "en vivo": cada segmento lleva su inicio (position), su fin (aP1) y sus tiempos (aT, segundos desde el inicio).
// Solo se dibuja la parte que cae dentro de la ventana uWin = [desde, hasta], con el extremo recortado exacto: la estela crece sin saltos.
export const TRAIL_VS = /* glsl */ `${PROJ_GLSL}
attribute vec3 aP1; attribute vec2 aT; attribute float aW; uniform mat3 uRot; uniform vec2 uWin;
void main(){
  float lo = max(aT.x, uWin.x), hi = min(aT.y, uWin.y);
  if (hi <= lo) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float s = clamp((mix(lo, hi, aW) - aT.x) / (aT.y - aT.x), 0.0, 1.0);
  gl_Position = projectToClip(uRot * mix(position, aP1, s));
}`;
export const LINE_FS = /* glsl */ `uniform vec3 uCol; uniform float uA; void main(){ gl_FragColor = vec4(uCol * uA, 1.0); }`;


// ── Textura sobre una esfera vista desde fuera: P = punto de la esfera en el marco del disco (x derecha, y arriba, z hacia nosotros),
//    n = eje norte en ese marco, cm = meridiano central (vueltas). Se muestrea con el nivel de detalle que corresponde al tamaño en pantalla. ──
const SPHERE_GLSL = /* glsl */ `
vec3 sphereTex(sampler2D tex, vec3 P, vec3 n, float cm, float rpx){
  vec3 e1 = vec3(0.0, 0.0, 1.0) - n.z * n; e1 /= max(length(e1), 1e-3);
  vec3 e2 = cross(n, e1);
  float lon = atan(dot(P, e2), dot(P, e1)), lat = asin(clamp(dot(P, n), -1.0, 1.0));
  float lod = max(0.0, log2(260.7 / max(rpx, 1.0)));
  return textureLod(tex, vec2(0.5 + lon / 6.2831853 + cm, 0.5 + lat / 3.14159265), lod).rgb;
}`;

// ── Planetas: esfera con textura iluminada por el Sol (fase y terminador reales) y, en Saturno, los anillos con sombras mutuas ──
export const PLANET_FS = /* glsl */ `
uniform sampler2D uTex, uRingTex; uniform vec3 uL, uP, uTint, uBase;
uniform float uCM, uK, uRpx, uSoft, uFlat, uLimb, uRing, uA, uHasTex, uGain;
varying vec2 vUv;
${SPHERE_GLSL}
const float RING_OUT = ${SATURN_RING_OUTER.toFixed(2)};
float ringA(float rho){ return rho < RING_OUT ? texture2D(uRingTex, vec2(rho / RING_OUT, 0.5)).a * 1.2 : 0.0; }
void main(){
  vec2 q = (vUv * 2.0 - 1.0) * uK;
  float r = length(q);
  vec3 n = normalize(uP), L = normalize(uL);
  float z = sqrt(max(0.0, 1.0 - min(r, 1.0) * min(r, 1.0)));
  vec3 P = vec3(q, z);
  float edge = clamp((1.0 - r) * uRpx + 0.5, 0.0, 1.0);
  vec3 pc = vec3(0.0); float pa = 0.0;
  if (edge > 0.0) {
    float lam = dot(P, L);
    float lit = smoothstep(-uSoft, uSoft * 0.6 + 0.02, lam);
    float shade = mix(max(lam, 0.0), 1.0, uFlat) * (1.0 - uLimb * (1.0 - z));
    vec3 alb = uHasTex > 0.5 ? sphereTex(uTex, P, n, uCM, uRpx) : uBase;
    if (uRing > 0.5 && abs(dot(n, L)) > 0.01) {                 // sombra de los anillos sobre el planeta
      float s = -dot(n, P) / dot(n, L);
      if (s > 0.0) shade *= 1.0 - 0.85 * ringA(length(P + s * L));
    }
    pc = alb * shade * uGain; pa = edge * lit;
  }
  vec3 rc = vec3(0.0); float ra = 0.0;
  if (uRing > 0.5 && abs(n.z) > 0.002) {
    float t = -(n.x * q.x + n.y * q.y) / n.z;
    vec3 Q = vec3(q, t);
    float rho = length(Q);
    if (!(r < 1.0 && t < 0.0)) {                                // la parte de atrás queda oculta por el planeta
      vec4 rt = texture2D(uRingTex, vec2(rho / RING_OUT, 0.5));
      ra = rho < RING_OUT ? min(rt.a * 1.2, 1.0) : 0.0;
      float sameSide = (dot(n, L) * n.z > 0.0) ? 1.0 : 0.22;    // vistos por la cara no iluminada, los anillos solo transmiten un poco de luz
      float b = dot(Q, L);
      float inShadow = (b < 0.0 && dot(Q, Q) - b * b < 1.0) ? 0.12 : 1.0;
      rc = rt.rgb * sameSide * (sameSide > 0.5 ? inShadow : 1.0) * uGain * 1.1;
    }
  }
  float A = ra + pa * (1.0 - ra);
  if (A < 0.003) discard;
  vec3 rgb = (rc * ra + pc * pa * (1.0 - ra)) / A;
  gl_FragColor = vec4(rgb * uTint, A * uA);
}`;

// ── Sol: disco con oscurecimiento al limbo, resplandor, y durante la totalidad: corona, cromosfera y protuberancias.
//    Cerca de la totalidad aparece el "anillo de diamante": el último destello solar con un halo muy brillante. ──
export const BILL_VS_SRC = BILL_VS;
export const SUN_FS = /* glsl */ `
uniform vec3 uTint; uniform float uObsc, uCorona, uChromo, uCAng, uK, uDiamond, uHasTex, uRpx, uCM, uTexMean; uniform vec2 uMoonDir; uniform vec3 uP; uniform sampler2D uTex; varying vec2 vUv;
${SPHERE_GLSL}
float bump(float a, float c, float w){ float d = abs(mod(a - c + 3.14159, 6.28318) - 3.14159); return exp(-(d * d) / (w * w)); }
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p) * uK;                                   // distancia al centro en radios solares
  if (r > uK) discard;
  float edge = 1.0 - smoothstep(0.5 * uK, uK, r);             // todo se desvanece antes del borde del cartel
  float vis = max(1.0 - uObsc, 0.0);
  float core = 1.0 - smoothstep(0.985, 1.0, r);
  float mu = sqrt(max(0.0, 1.0 - min(r, 1.0) * min(r, 1.0)));
  vec3 disc = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.97, 0.85), sqrt(mu)) * mix(1.6, 0.9, smoothstep(30.0, 200.0, uRpx));   // con zoom el disco deja de saturar y se ve la granulación
  if (uHasTex > 0.5 && r < 1.0) {                              // manchas y granulación: solo se aprecian con zoom
    vec3 Ps = vec3(p * uK, mu);
    float lum = dot(sphereTex(uTex, Ps, uP, uCM, uRpx), vec3(0.299, 0.587, 0.114));
    float k = clamp(lum / uTexMean, 0.0, 1.6);
    disc *= mix(1.0, 0.7 + 0.45 * k, smoothstep(6.0, 40.0, uRpx));       // de lejos el Sol es un disco liso; de cerca aparece el detalle
  }
  // el resplandor depende de lo que quede visible del Sol, pero nunca desaparece del todo
  float halo = step(1.0, r) * exp(-(r - 1.0) * 1.1) * 0.55 * (1.0 - smoothstep(2.0, 4.0, r)) * (0.12 + 0.88 * pow(vis, 0.6));
  vec3 col = disc * core + vec3(1.0, 0.8, 0.5) * halo;

  // anillo de diamante: el último trozo de fotosfera está en el limbo opuesto a la Luna
  vec2 g = -uMoonDir * 0.985, q = p * uK - g;
  float dq = length(q);
  col += vec3(1.0, 0.95, 0.85) * uDiamond * (2.4 * exp(-dq * 3.2) + 0.9 * exp(-dq * 0.9) * (1.0 - smoothstep(4.0, 9.0, dq)));

  float ang = atan(p.y, p.x) - uCAng;
  // corona: parte interna que cae como r^-3, y serpentines largos sobre el ecuador solar (ruido suave, sin sectores marcados)
  float eq = pow(abs(cos(ang)), 1.4);
  float rr = max(r, 1.0);
  // rayos coronales: varias frecuencias de ángulo; se vuelven más finos y contrastados con la distancia
  float f = 0.55 * sin(ang * 5.0 + 0.7) + 0.35 * sin(ang * 8.0 + 2.9) + 0.30 * sin(ang * 13.0 + 5.1) + 0.20 * sin(ang * 21.0 + 1.1) + 0.12 * sin(ang * 34.0 + 3.3) + 0.14 * sin(ang * 55.0 + 0.4) + 0.10 * sin(ang * 89.0 + 2.2);
  float rays = pow(clamp(0.5 + 0.5 * f, 0.0, 1.0), 1.5);
  float sharp = smoothstep(1.0, 2.5, rr);
  float inner = 1.25 * pow(rr, -4.2) * (0.85 + 0.3 * rays);
  float streamer = 0.66 * (0.22 + 0.78 * eq) * mix(0.55, 0.05 + 2.0 * rays * rays, sharp) * exp(-(rr - 1.0) / (0.38 + 0.95 * eq));
  float polar = 0.22 * (1.0 - eq) * exp(-(rr - 1.0) / 0.55) * (0.6 + 0.8 * rays);       // penachos cortos en los polos
  float wing = 0.07 * eq * exp(-(rr - 1.0) / 1.2);
  vec3 cor = (vec3(1.0, 0.96, 0.90) * (inner + streamer + polar) + vec3(0.78, 0.86, 1.0) * wing) * smoothstep(0.97, 1.03, r) * edge;
  col += cor * uCorona;

  // cromosfera (anillo rosado fino) y protuberancias: solo se ven cuando la fotosfera está casi tapada
  float hgt = 0.040 * bump(ang, 0.9, 0.10) + 0.075 * bump(ang, 2.6, 0.07) + 0.030 * bump(ang, 4.4, 0.14) + 0.055 * bump(ang, 5.5, 0.05);
  float chromo = smoothstep(0.995, 1.004, r) * (1.0 - smoothstep(1.006 + hgt * 0.5, 1.012 + hgt, r));
  col += vec3(1.0, 0.28, 0.34) * chromo * uChromo * 1.5;
  gl_FragColor = vec4(col * uTint * edge, core);          // alfa = cobertura del disco: el disco tapa el cielo y el resplandor se suma
}`;

// ── Luna: fase con textura, y color de la sombra de la Tierra (tabla calculada con dispersión de Rayleigh + ozono) ──
export const MOON_FS = /* glsl */ `
uniform vec3 uTint; uniform vec3 uL; uniform vec2 uN; uniform sampler2D uTex, uLut;
uniform float uHasTex, uLonOff, uDay, uShadowOn, uMaxKm, uSunR; uniform vec2 uQ, uSunOff; varying vec2 vUv;
void main(){
  vec2 p = (vUv * 2.0 - 1.0) * 1.15; float r = length(p); if (r > 1.0) discard;
  float z = sqrt(1.0 - r * r);
  float lit = smoothstep(-0.03, 0.14, dot(vec3(p, z), uL));
  vec3 alb = vec3(0.80, 0.78, 0.73);
  if (uHasTex > 0.5) {
    float e = p.x * uN.y - p.y * uN.x, n = p.x * uN.x + p.y * uN.y;       // este lunar a la derecha del norte
    alb = texture2D(uTex, vec2(0.5 + atan(e, z) / 6.2831853 + uLonOff, 0.5 + asin(clamp(n, -1.0, 1.0)) / 3.1415927)).rgb;
  }
  // eclipse solar: donde la Luna tapa al Sol es negra; en el resto, de día, el lado oscuro es transparente (se ve el cielo)
  float sunIn = 1.0 - smoothstep(uSunR - 0.03, uSunR + 0.03, length(p - uSunOff));
  float k = uDay * (1.0 - sunIn);
  vec3 col = alb * mix(0.025 + 0.975 * lit, 1.0, k) * uTint;      // de día el color es el de la roca iluminada y la fase la da la transparencia
  if (uShadowOn > 0.5) {                                                  // eclipse lunar: distancia al eje de la sombra, en km
    float rho = length(p - uQ) * 1737.4;
    col *= texture2D(uLut, vec2(clamp(rho / uMaxKm, 0.0, 1.0) * 0.99 + 0.005, 0.5)).rgb;
  }
  float a = (1.0 - smoothstep(0.985, 1.0, r)) * (1.0 - k * (1.0 - lit));
  gl_FragColor = vec4(col, a);
}`;
