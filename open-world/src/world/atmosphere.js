// Атмосфера: рассеяние Рэлея и Ми с поглощением озоном (однократное, с поправкой на многократное).
// Небо считается в маленькую таблицу «направление → яркость» несколько раз в секунду; из неё берут цвет
// купол неба, туман (воздушная перспектива), отражения в воде и карта окружения для освещения.
// Здесь же — облака (общая функция для купола и теней на земле) и автоэкспозиция.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const A = CONFIG.atmosphere;
const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);
const v3 = (a) => `vec3(${a.map(f).join(', ')})`;

// ---------- Общий GLSL ----------
export const ATMO_GLSL = /* glsl */ `
const float A_PI = 3.14159265;
const float R_GROUND = ${f(A.planetRadius)};
const float R_TOP = ${f(A.planetRadius + A.atmosphereHeight)};
const vec3 BETA_R = ${v3(A.rayleigh)};
const vec3 BETA_O = ${v3(A.ozone)};
const float BETA_M_S = ${f(A.mieScatter)};
const float BETA_M_E = ${f(A.mieExtinction)};
const float H_R = ${f(A.rayleighHeight)};
const float H_M = ${f(A.mieHeight)};
const float MIE_G = ${f(A.mieG)};

vec3 atmoDensity(float h) {
  return vec3(exp(-h / H_R), exp(-h / H_M), max(0.0, 1.0 - abs(h - 25000.0) / 15000.0));
}
vec3 atmoExtinction(vec3 od) {
  return exp(-(BETA_R * od.x + BETA_M_E * od.y + BETA_O * od.z));
}
float distToTop(float r, float mu) {
  float disc = r * r * (mu * mu - 1.0) + R_TOP * R_TOP;
  return max(0.0, -r * mu + sqrt(max(disc, 0.0)));
}
float distToGround(float r, float mu) {
  float disc = r * r * (mu * mu - 1.0) + R_GROUND * R_GROUND;
  if (mu >= 0.0 || disc < 0.0) return -1.0;
  return -r * mu - sqrt(disc);
}
// Пропускание до верха атмосферы от радиуса r под косинусом зенита mu; тень планеты — мягкая
vec3 transmittanceToLight(float r, float mu, int steps) {
  float muH = -sqrt(max(0.0, 1.0 - (R_GROUND / r) * (R_GROUND / r)));
  float vis = smoothstep(muH - 0.006, muH + 0.006, mu);
  if (vis <= 0.0) return vec3(0.0);
  float tTop = distToTop(r, mu);
  float dt = tTop / float(steps);
  vec3 od = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= steps) break;
    float t = (float(i) + 0.5) * dt;
    od += atmoDensity(sqrt(r * r + t * t + 2.0 * r * mu * t) - R_GROUND);
  }
  return atmoExtinction(od * dt) * vis;
}
float phaseRayleigh(float c) { return 3.0 / (16.0 * A_PI) * (1.0 + c * c); }
float phaseMie(float c) {
  float g = MIE_G;
  float gg = g * g;
  return 3.0 / (8.0 * A_PI) * ((1.0 - gg) * (1.0 + c * c)) / ((2.0 + gg) * pow(max(1.0 + gg - 2.0 * g * c, 1e-4), 1.5));
}
`;

// Направление ↔ координаты таблицы неба: азимут по u, высота по v со сгущением у горизонта
export const SKY_UV_GLSL = /* glsl */ `
vec2 skyUV(vec3 d) {
  // в зените и надире азимут не определён: atan(0, 0) даёт NaN, который растёкся бы по карте окружения
  vec2 hz = dot(d.xz, d.xz) > 1e-10 ? d.xz : vec2(1.0, 0.0);
  float u = atan(hz.y, hz.x) * (0.5 / 3.14159265) + 0.5;
  float el = asin(clamp(d.y, -1.0, 1.0));
  float v = 0.5 + 0.5 * sign(el) * sqrt(abs(el) / 1.5707963);
  return vec2(u, v);
}
`;

// Облака: один слой на высоте uCloud.z, плотность из тайлящегося шума (три октавы); та же функция
// даёт тени облаков на земле, поэтому тень движется вместе с облаком, закрывшим солнце.
export const CLOUD_GLSL = /* glsl */ `
uniform sampler2D uNoiseTex;
uniform vec4 uCloud;       // x — покрытие 0..1, y — плотность, z — высота слоя, w — сила теней
uniform vec4 uCloudOffset; // сдвиг ветром двух октав
uniform vec3 uSunDir;
float cloudShape(vec2 p, float detail) {
  vec2 q = p * ${f(1 / A.clouds.scale)};
  // крупная форма (облачные поля) решает, где облака; средняя и мелкая — рваные края
  float base = texture(uNoiseTex, q + uCloudOffset.xy).r * 0.72 + texture(uNoiseTex, q * 2.3 + uCloudOffset.zw).g * 0.28;
  float u = clamp((base - 0.3) * 2.5, 0.0, 1.0);
  float c = uCloud.x;
  float d = smoothstep(1.0 - c - 0.05, 1.0 - c + 0.32, u);
  if (detail > 0.5 && d > 0.0) {
    float e = texture(uNoiseTex, q * 7.1 + uCloudOffset.xy * 2.3).r * 0.65 + texture(uNoiseTex, q * 17.3 - uCloudOffset.zw).g * 0.35;
    d = clamp(d - (1.0 - d) * (e - 0.35) * 1.4, 0.0, 1.0);
  }
  return d;
}
float cloudShadow(vec3 wp) {
  if (uCloud.w <= 0.0 || uSunDir.y <= 0.02) return 1.0;
  vec2 p = wp.xz + uSunDir.xz / max(uSunDir.y, 0.12) * (uCloud.z - wp.y);
  return 1.0 - uCloud.w * cloudShape(p, 0.0);
}
`;

// ---------- Таблица неба ----------
const lutVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const lutFragment = /* glsl */ `
precision highp float;
uniform vec3 uSun;
uniform vec3 uMoon;
uniform vec3 uSunE;
uniform vec3 uMoonE;
uniform float uAltitude;
varying vec2 vUv;
${ATMO_GLSL}
#ifndef VIEW_STEPS
#define VIEW_STEPS 24
#endif
#ifndef LIGHT_STEPS
#define LIGHT_STEPS 8
#endif
void main() {
  float az = (vUv.x - 0.5) * 2.0 * A_PI;
  float v2 = vUv.y * 2.0 - 1.0;
  float el = sign(v2) * v2 * v2 * 1.5707963;
  vec3 rd = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
  float r0 = R_GROUND + uAltitude;
  float mu = rd.y;
  float tMax = distToTop(r0, mu);
  float tG = distToGround(r0, mu);
  bool ground = tG > 0.0;
  if (ground) tMax = tG;
  float cs = dot(rd, uSun);
  float cm = dot(rd, uMoon);
  vec3 rs = vec3(0.0), ms = vec3(0.0), rm = vec3(0.0), mm = vec3(0.0);
  vec3 od = vec3(0.0);
  vec3 Tview = vec3(1.0);
  float r = r0;
  float N = float(VIEW_STEPS);
  for (int i = 0; i < VIEW_STEPS; i++) {
    float a0 = float(i) / N;
    float a1 = float(i + 1) / N;
    float dt = tMax * (a1 * a1 - a0 * a0);
    float t = tMax * (a0 + a1) * (a0 + a1) * 0.25;
    r = sqrt(r0 * r0 + t * t + 2.0 * r0 * mu * t);
    vec3 d = atmoDensity(r - R_GROUND);
    vec3 odMid = od + d * dt * 0.5;
    od += d * dt;
    Tview = atmoExtinction(odMid);
    vec3 Ts = transmittanceToLight(r, (r0 * uSun.y + t * cs) / r, LIGHT_STEPS);
    rs += d.x * dt * Tview * Ts;
    ms += d.y * dt * Tview * Ts;
    if (uMoonE.r + uMoonE.g + uMoonE.b > 0.0) {
      vec3 Tm = transmittanceToLight(r, (r0 * uMoon.y + t * cm) / r, LIGHT_STEPS);
      rm += d.x * dt * Tview * Tm;
      mm += d.y * dt * Tview * Tm;
    }
  }
  vec3 single = uSunE * (BETA_R * rs * phaseRayleigh(cs) + BETA_M_S * ms * phaseMie(cs))
              + uMoonE * (BETA_R * rm * phaseRayleigh(cm) + BETA_M_S * mm * phaseMie(cm));
  // многократное рассеяние — изотропная добавка, без неё сумерки слишком тёмные и насыщенные
  vec3 multi = (uSunE * (BETA_R * rs + BETA_M_S * ms) + uMoonE * (BETA_R * rm + BETA_M_S * mm)) * ${f(A.multiScatter / (4 * Math.PI))};
  vec3 col = single + multi;
  if (ground) {
    float muS = (r0 * uSun.y + tMax * cs) / r;
    float muM = (r0 * uMoon.y + tMax * cm) / r;
    vec3 E = uSunE * transmittanceToLight(r, muS, LIGHT_STEPS) * max(muS, 0.0)
           + uMoonE * transmittanceToLight(r, muM, LIGHT_STEPS) * max(muM, 0.0);
    col += Tview * E * ${f(A.groundAlbedo)} / A_PI;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// Перевод таблицы в обычную равнопромежуточную карту для PMREM: сверху небо, снизу — отсвет земли
const envFragment = /* glsl */ `
uniform sampler2D uSkyLUT;
uniform vec3 uGround;
varying vec2 vUv;
${SKY_UV_GLSL}
void main() {
  float az = (vUv.x - 0.5) * 2.0 * 3.14159265;
  float el = (vUv.y - 0.5) * 3.14159265;
  vec3 d = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
  // у three.js карта окружения развёрнута: u = atan(d.z, d.x) · 1/2π + 0,5 — то же, что в таблице
  vec3 sky = texture(uSkyLUT, skyUV(vec3(d.x, max(d.y, 0.0), d.z))).rgb;
  float k = smoothstep(-0.02, -0.25, d.y);
  gl_FragColor = vec4(mix(sky, uGround, k), 1.0);
}`;

// ---------- Туман: подменяем стандартные куски шейдеров three.js ----------
// Туман накладывается в линейном цвете до тональной компрессии — поэтому он живёт в tonemapping_fragment.
const FOG_PARS_VERTEX = /* glsl */ `
#ifdef USE_FOG
varying vec3 vFogWorld;
#endif`;

const FOG_VERTEX = /* glsl */ `
#ifdef USE_FOG
vFogWorld = (mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix);
#endif`;

const FOG_PARS_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform sampler2D uSkyLUT;
uniform vec4 uFogParams;   // x — плотность у базовой высоты (1/м), y — спад с высотой (1/м), z — базовая высота, w — ореол солнца
uniform vec3 uFogSunDir;
uniform vec3 uFogSunColor;
varying vec3 vFogWorld;
${SKY_UV_GLSL}
vec3 applyAtmoFog(vec3 col) {
  vec3 ray = vFogWorld - cameraPosition;
  float dist = length(ray);
  vec3 dir = ray / max(dist, 1e-3);
  // интеграл экспоненциальной по высоте плотности вдоль луча
  float k = uFogParams.y * ray.y;
  float line = abs(k) > 1e-3 ? (1.0 - exp(-k)) / k : 1.0 - 0.5 * k;
  float od = uFogParams.x * exp(-uFogParams.y * (cameraPosition.y - uFogParams.z)) * dist * line;
  float haze = 1.0 - exp(-max(od, 0.0));
  vec3 hd = normalize(vec3(dir.x, max(dir.y, 0.015), dir.z));
  vec3 skyH = texture(uSkyLUT, skyUV(hd)).rgb;
  float glow = pow(max(dot(dir, uFogSunDir), 0.0), 6.0) * uFogParams.w;
  col = mix(col, skyH + uFogSunColor * glow, haze);
  // у границы дальности земля растворяется в небе — шов с куполом не виден
  float edge = smoothstep(fogNear, fogFar, dist);
  if (edge > 0.0) col = mix(col, texture(uSkyLUT, skyUV(normalize(vec3(dir.x, max(dir.y, 0.0), dir.z)))).rgb, edge);
  return col;
}
#endif`;

const TONEMAPPING_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
gl_FragColor.rgb = applyAtmoFog(gl_FragColor.rgb);
#endif
#if defined( TONE_MAPPING )
gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`;

THREE.ShaderChunk.fog_pars_vertex = FOG_PARS_VERTEX;
THREE.ShaderChunk.fog_vertex = FOG_VERTEX;
THREE.ShaderChunk.fog_pars_fragment = FOG_PARS_FRAGMENT;
THREE.ShaderChunk.fog_fragment = '';
THREE.ShaderChunk.tonemapping_fragment = TONEMAPPING_FRAGMENT;

// ---------- Общие uniform'ы: одни и те же объекты подключаются ко всем материалам ----------
export const atmo = {
  uSkyLUT: { value: null },
  uFogParams: { value: new THREE.Vector4(A.fog.density, A.fog.falloff, A.fog.baseHeight, A.fog.sunGlow) },
  uFogSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uFogSunColor: { value: new THREE.Vector3(0, 0, 0) },
  uNoiseTex: { value: null },
  uCloud: { value: new THREE.Vector4(0.4, 1, A.clouds.altitude, A.clouds.shadow) },
  uCloudOffset: { value: new THREE.Vector4() },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  // основной свет сейчас (солнце или луна): направление и яркость с учётом пропускания атмосферы
  uLightDir: { value: new THREE.Vector3(0, 1, 0) },
  uLightColor: { value: new THREE.Vector3(1, 1, 1) },
};

// Подключить атмосферу к материалу в onBeforeCompile (или к uniforms ShaderMaterial)
export function withAtmosphere(uniforms) {
  return Object.assign(uniforms, atmo);
}

// ---------- То же рассеяние на JS: цвет прямого солнца и оценка освещённости для экспозиции ----------
const BR = A.rayleigh;
const BO = A.ozone;
const RG = A.planetRadius;
const RT = A.planetRadius + A.atmosphereHeight;

function densityJS(h, out) {
  out[0] = Math.exp(-h / A.rayleighHeight);
  out[1] = Math.exp(-h / A.mieHeight);
  out[2] = Math.max(0, 1 - Math.abs(h - 25000) / 15000);
  return out;
}

const _d = [0, 0, 0];
export function transmittanceJS(r, mu, out, steps = 24) {
  const muH = -Math.sqrt(Math.max(0, 1 - (RG / r) ** 2));
  const t0 = (mu - (muH - 0.006)) / 0.012;
  const vis = t0 <= 0 ? 0 : t0 >= 1 ? 1 : t0 * t0 * (3 - 2 * t0);
  if (vis <= 0) {
    out[0] = out[1] = out[2] = 0;
    return out;
  }
  const tTop = Math.max(0, -r * mu + Math.sqrt(Math.max(0, r * r * (mu * mu - 1) + RT * RT)));
  const dt = tTop / steps;
  let odR = 0;
  let odM = 0;
  let odO = 0;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) * dt;
    densityJS(Math.sqrt(r * r + t * t + 2 * r * mu * t) - RG, _d);
    odR += _d[0];
    odM += _d[1];
    odO += _d[2];
  }
  for (let c = 0; c < 3; c++) out[c] = Math.exp(-(BR[c] * odR + A.mieExtinction * odM + BO[c] * odO) * dt) * vis;
  return out;
}

export const luminance = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// ---------- Класс: таблица неба, карта окружения, экспозиция ----------
export class Atmosphere {
  constructor() {
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.lutUniforms = {
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uMoon: { value: new THREE.Vector3(0, -1, 0) },
      uSunE: { value: new THREE.Vector3() },
      uMoonE: { value: new THREE.Vector3() },
      uAltitude: { value: A.viewerAltitude },
    };
    this.envUniforms = { uSkyLUT: atmo.uSkyLUT, uGround: { value: new THREE.Color() } };
    this.envMaterial = new THREE.ShaderMaterial({ uniforms: this.envUniforms, vertexShader: lutVertex, fragmentShader: envFragment, depthTest: false, depthWrite: false });
    this.lut = null;
    this.lutMaterial = null;
    this.tier = '';
    this.envTarget = new THREE.WebGLRenderTarget(A.envSize[0], A.envSize[1], {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
    this.envTarget.texture.mapping = THREE.EquirectangularReflectionMapping;
    this.pmrem = null;
    this.envRT = null;
    this.lutTimer = 0;
    this.envTimer = 0;
    this.lastSun = new THREE.Vector3(9, 9, 9);
    this.sunT = [1, 1, 1];
    this.moonT = [1, 1, 1];
    this.sunE = A.sunIlluminance;
    this.moonE = A.moonIlluminance;
    this.exposure = 1;
    this.targetExposure = 1;
    this.forceUpdate = true;
  }

  // Размер таблицы и число шагов зависят от качества графики
  setTier(tier) {
    if (tier === this.tier) return;
    this.tier = tier;
    const L = A.lut[tier] || A.lut.medium;
    if (this.lut) this.lut.dispose();
    this.lut = new THREE.WebGLRenderTarget(L.width, L.height, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      generateMipmaps: false,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    });
    if (this.lutMaterial) this.lutMaterial.dispose();
    this.lutMaterial = new THREE.ShaderMaterial({
      uniforms: this.lutUniforms,
      vertexShader: lutVertex,
      fragmentShader: lutFragment,
      defines: { VIEW_STEPS: L.viewSteps, LIGHT_STEPS: L.lightSteps },
      depthTest: false,
      depthWrite: false,
    });
    atmo.uSkyLUT.value = this.lut.texture;
    this.forceUpdate = true;
  }

  // sunDir/moonDir — единичные векторы; dt — секунды кадра
  update(renderer, sunDir, moonDir, dt) {
    const r = RG + A.viewerAltitude;
    transmittanceJS(r, sunDir.y, this.sunT);
    transmittanceJS(r, moonDir.y, this.moonT);
    const moonUp = Math.max(0, Math.min(1, (moonDir.y + 0.05) / 0.15));
    const sunE = this.sunE;
    const moonE = this.moonE * moonUp;
    const MT = A.moonTint;
    this.lutUniforms.uSunE.value.set(sunE, sunE, sunE);
    this.lutUniforms.uMoonE.value.set(moonE * MT[0], moonE * MT[1], moonE * MT[2]);

    // экспозиция по оценке освещённости горизонтальной поверхности: прямой свет + небо
    const sunH = sunE * luminance(this.sunT) * Math.max(sunDir.y, 0);
    const moonH = moonE * luminance(this.moonT) * Math.max(moonDir.y, 0);
    const skyH = this.estimateSky(sunDir, moonDir, sunE, moonE);
    const E = sunH + moonH + skyH;
    const X = A.exposure;
    this.targetExposure = Math.min(X.max, Math.max(X.min, X.key / Math.max(E * X.albedo / Math.PI, 1e-6)));
    const k = this.forceUpdate ? 1 : 1 - Math.exp(-dt * X.adapt);
    this.exposure += (this.targetExposure - this.exposure) * k;

    // таблица неба — когда солнце заметно сдвинулось или прошло время
    this.lutTimer -= dt;
    const moved = this.lastSun.distanceToSquared(sunDir) > 1e-7;
    if (this.forceUpdate || (this.lutTimer <= 0 && moved)) {
      this.lutTimer = 1 / A.lutHz;
      this.lastSun.copy(sunDir);
      this.lutUniforms.uSun.value.copy(sunDir);
      this.lutUniforms.uMoon.value.copy(moonDir);
      this.renderQuad(renderer, this.lutMaterial, this.lut);
      this.envDirty = true;
    }
    this.envTimer -= dt;
    if (this.forceUpdate || (this.envDirty && this.envTimer <= 0)) {
      this.envTimer = 1 / A.envHz;
      this.envDirty = false;
      const g = A.groundAlbedo / Math.PI;
      const gl = (sunH + moonH + skyH) * g;
      this.envUniforms.uGround.value.setRGB(gl * 0.95, gl * 0.9, gl * 0.78);
      this.renderQuad(renderer, this.envMaterial, this.envTarget);
      if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(renderer);
      this.envRT = this.pmrem.fromEquirectangular(this.envTarget.texture, this.envRT);
    }
    this.forceUpdate = false;
  }

  // Освещённость горизонтальной площадки небом: грубая сумма по нескольким направлениям (без таблицы, на JS)
  estimateSky(sunDir, moonDir, sunE, moonE) {
    const e = Math.max(-0.3, sunDir.y);
    // аппроксимация по высоте солнца, подобрана по самой таблице: днём небо даёт ~12–18 % от прямого света
    const day = sunE * (0.02 + 0.13 * Math.max(0, e) ** 0.6) * smooth(-0.18, 0.05, e);
    const night = moonE * (0.02 + 0.1 * Math.max(0, moonDir.y) ** 0.6) * smooth(-0.1, 0.1, moonDir.y);
    return day + night + A.exposure.airglow;
  }

  renderQuad(renderer, material, target) {
    const prev = renderer.getRenderTarget();
    const prevXr = renderer.xr.enabled;
    renderer.xr.enabled = false;
    this.quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(this.quadScene, this.quadCam);
    renderer.setRenderTarget(prev);
    renderer.xr.enabled = prevXr;
  }

  get envTexture() {
    return this.envRT ? this.envRT.texture : null;
  }
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
