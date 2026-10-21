// Небо, солнце, луна, звёзды, свет и туман. Цвета меняются по высоте солнца (ключевые кадры).
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

// Ключевые кадры по высоте солнца e = sin(угла над горизонтом)
const KEYS = [
  { e: -1, top: '#050916', horizon: '#0f1730', glow: '#000000', sun: '#000000', sunI: 0, moonI: 0.55, hemiSky: '#2f4378', hemiGround: '#151b29', hemiI: 0.55, stars: 1, water: '#0b1b2e' },
  { e: -0.2, top: '#08102a', horizon: '#18244a', glow: '#120f2a', sun: '#000000', sunI: 0, moonI: 0.5, hemiSky: '#33477c', hemiGround: '#171d2b', hemiI: 0.58, stars: 1, water: '#0e2036' },
  { e: -0.07, top: '#1b2a5a', horizon: '#4a3f6e', glow: '#7a4060', sun: '#ff7a4a', sunI: 0, moonI: 0.12, hemiSky: '#46507e', hemiGround: '#1d2030', hemiI: 0.62, stars: 0.55, water: '#1a2a4a' },
  { e: 0.02, top: '#3a5c9a', horizon: '#f2a364', glow: '#ff8a40', sun: '#ffa060', sunI: 1.1, moonI: 0, hemiSky: '#8a8fb0', hemiGround: '#3a3530', hemiI: 0.8, stars: 0, water: '#2f5a7a' },
  { e: 0.14, top: '#4b82d0', horizon: '#ffd3a2', glow: '#ffb070', sun: '#ffd2a0', sunI: 2.2, moonI: 0, hemiSky: '#b8c8e8', hemiGround: '#5a5440', hemiI: 0.95, stars: 0, water: '#2f6f96' },
  { e: 0.38, top: '#3d82dd', horizon: '#c2e1ff', glow: '#fff1d6', sun: '#fff3e2', sunI: 2.9, moonI: 0, hemiSky: '#cfe4ff', hemiGround: '#6d7a52', hemiI: 1.1, stars: 0, water: '#2a76a8' },
  { e: 1, top: '#2e76d8', horizon: '#b6dbff', glow: '#fff6e6', sun: '#fffaf0', sunI: 3.1, moonI: 0, hemiSky: '#d2e8ff', hemiGround: '#728052', hemiI: 1.15, stars: 0, water: '#2a7ab0' },
];
const COLOR_KEYS = ['top', 'horizon', 'glow', 'sun', 'hemiSky', 'hemiGround', 'water'];
for (const k of KEYS) for (const c of COLOR_KEYS) k[c] = new THREE.Color(k[c]);

const TILT = 0.5; // наклон пути солнца к югу (+z)

const domeVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const domeFragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform float uSunVis;
uniform float uMoonVis;
varying vec3 vDir;
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float t = pow(clamp(h, 0.0, 1.0), 0.45);
  vec3 col = mix(uHorizon, uTop, t);
  float sd = max(dot(d, uSunDir), 0.0);
  col += uGlow * pow(sd, 6.0) * (1.0 - t * 0.8) * 0.55;
  col += uSunColor * (smoothstep(0.99935, 0.9997, sd) * 2.0 + pow(sd, 350.0) * 0.5) * uSunVis;
  float md = max(dot(d, uMoonDir), 0.0);
  float disc = smoothstep(0.99955, 0.99975, md);
  col = mix(col, vec3(0.88, 0.91, 1.0), disc * uMoonVis);
  // мягкий ореол: экспонента от угла, без «колец» от pow с большой степенью
  float ang = acos(clamp(md, -1.0, 1.0));
  col += vec3(0.38, 0.47, 0.72) * exp(-ang * 14.0) * 0.22 * uMoonVis;
  col += (hash12(gl_FragCoord.xy) - 0.5) * (1.5 / 255.0);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const starVertex = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uAlpha;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 dir = normalize(world.xyz - cameraPosition);
  float twinkle = 0.75 + 0.25 * sin(uTime * (1.5 + aPhase) + aPhase * 17.0);
  vAlpha = uAlpha * twinkle * smoothstep(0.02, 0.18, dir.y);
  vColor = color;
  gl_PointSize = aSize;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const starFragment = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.1, length(c)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}`;

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uSunVis: { value: 1 },
      uMoonVis: { value: 0 },
    };
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: domeVertex,
        fragmentShader: domeFragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    // небо рисуется после непрозрачной геометрии: закрашиваются только пустые пиксели
    this.dome.renderOrder = 10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    const rand = mulberry32(20240607);
    const n = 1400;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const phase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      pos[i * 3] = r * Math.cos(a);
      pos[i * 3 + 1] = u;
      pos[i * 3 + 2] = r * Math.sin(a);
      const warm = rand();
      const b = 0.55 + 0.45 * rand() ** 3;
      col[i * 3] = b * (warm > 0.8 ? 1 : 0.85);
      col[i * 3 + 1] = b * 0.9;
      col[i * 3 + 2] = b * (warm < 0.3 ? 1 : 0.85);
      size[i] = 1.2 + 2.2 * rand() ** 4;
      phase[i] = rand() * 3;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    sg.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.starUniforms = { uTime: { value: 0 }, uAlpha: { value: 0 } };
    this.stars = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({
        uniforms: this.starUniforms,
        vertexShader: starVertex,
        fragmentShader: starFragment,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    this.stars.frustumCulled = false;
    this.stars.renderOrder = 11;
    this.starPivot = new THREE.Group();
    // ось вращения неба наклонена к северу (−z), как полярная звезда
    this.starPivot.rotation.x = -0.75;
    this.starPivot.add(this.stars);
    this.group.add(this.starPivot);
    scene.add(this.group);

    this.light = new THREE.DirectionalLight(0xffffff, 2.5);
    this.light.position.set(0, 100, 0);
    scene.add(this.light);
    scene.add(this.light.target);
    this.hemi = new THREE.HemisphereLight(0xcfe4ff, 0x6d7a52, 1);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xb6dbff, 100, 400);

    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.lightDir = new THREE.Vector3();
    this.cur = Object.fromEntries(COLOR_KEYS.map((k) => [k, new THREE.Color()]));
    this.daylight = 1; // 0 ночь … 1 день — для звуков и HUD
    this.elevation = 1;
    this.shadowRange = 50;
  }

  setRadius(r) {
    this.dome.scale.setScalar(r);
    this.stars.scale.setScalar(r * 0.97);
  }

  // t: 0 — полночь, 0.25 — рассвет, 0.5 — полдень, 0.75 — закат
  update(t, focus, elapsed) {
    const a = (t - 0.25) * Math.PI * 2;
    const s = Math.sin(a);
    this.sunDir.set(Math.cos(a), s * Math.cos(TILT), s * Math.sin(TILT)).normalize();
    this.moonDir.copy(this.sunDir).negate();
    const e = this.sunDir.y;
    this.elevation = e;

    let i = 0;
    while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
    const k0 = KEYS[i];
    const k1 = KEYS[i + 1];
    const f = Math.min(1, Math.max(0, (e - k0.e) / (k1.e - k0.e)));
    for (const c of COLOR_KEYS) this.cur[c].copy(k0[c]).lerp(k1[c], f);
    const lerp = (key) => k0[key] + (k1[key] - k0[key]) * f;
    const sunI = lerp('sunI');
    const moonI = lerp('moonI');
    const hemiI = lerp('hemiI');
    const stars = lerp('stars');

    const u = this.uniforms;
    u.uTop.value.copy(this.cur.top);
    u.uHorizon.value.copy(this.cur.horizon);
    u.uGlow.value.copy(this.cur.glow);
    u.uSunColor.value.copy(this.cur.sun);
    u.uSunDir.value.copy(this.sunDir);
    u.uMoonDir.value.copy(this.moonDir);
    u.uSunVis.value = Math.min(1, Math.max(0, (e + 0.05) / 0.1));
    u.uMoonVis.value = Math.min(1, Math.max(0, (-e + 0.02) / 0.15));
    this.starUniforms.uAlpha.value = stars;
    this.starUniforms.uTime.value = elapsed;
    this.stars.visible = stars > 0.01;
    this.starPivot.rotation.y = t * Math.PI * 2;

    // свет: днём от солнца, ночью от луны; переключение — когда оба почти погасли
    const useSun = sunI >= moonI;
    this.lightDir.copy(useSun ? this.sunDir : this.moonDir);
    const lightY = Math.max(this.lightDir.y, 0);
    this.light.intensity = useSun ? sunI * Math.min(1, lightY * 6 + 0.15) : moonI * Math.min(1, lightY * 3);
    if (useSun) this.light.color.copy(this.cur.sun);
    else this.light.color.setRGB(0.62, 0.72, 1.0);
    this.hemi.color.copy(this.cur.hemiSky);
    this.hemi.groundColor.copy(this.cur.hemiGround);
    this.hemi.intensity = hemiI;
    this.scene.fog.color.copy(this.cur.horizon);
    this.daylight = Math.min(1, Math.max(0, (e + 0.06) / 0.25));

    this.group.position.copy(focus);
    // источник света следует за игроком, тень привязана к сетке текселей — без дрожания
    const L = this.light;
    const snap = (this.shadowRange * 2) / (L.shadow.mapSize.x || 1024);
    const tx = Math.round(focus.x / snap) * snap;
    const tz = Math.round(focus.z / snap) * snap;
    L.target.position.set(tx, focus.y, tz);
    L.position.set(tx + this.lightDir.x * 200, focus.y + Math.max(this.lightDir.y, 0.1) * 200, tz + this.lightDir.z * 200);
    L.target.updateMatrixWorld();
  }

  setShadows(on, size, range) {
    const L = this.light;
    L.castShadow = on;
    this.shadowRange = range;
    if (!on) return;
    L.shadow.mapSize.set(size, size);
    const c = L.shadow.camera;
    c.left = -range;
    c.right = range;
    c.top = range;
    c.bottom = -range;
    c.near = 10;
    c.far = 450;
    c.updateProjectionMatrix();
    L.shadow.bias = -0.0006;
    L.shadow.normalBias = 0.6;
    if (L.shadow.map) {
      L.shadow.map.dispose();
      L.shadow.map = null;
    }
  }
}
