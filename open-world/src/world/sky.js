// Небо: купол из таблицы рассеяния, солнце и луна, Млечный Путь, слой облаков и звёзды.
// Свет: одно направленное солнце (ночью — луна) с цветом из пропускания атмосферы
// и карта окружения из того же неба (рассеянный свет и отражения).
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { mulberry32 } from './noise.js';
import { Atmosphere, atmo, SKY_UV_GLSL, CLOUD_GLSL, luminance } from './atmosphere.js';

const A = CONFIG.atmosphere;
const TILT = A.sunTilt; // наклон пути солнца к югу (+z)

const domeVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const domeFragment = /* glsl */ `
uniform sampler2D uSkyLUT;
uniform vec3 uMoonDir;
uniform vec3 uSunDisk;
uniform vec3 uMoonDisk;
uniform vec3 uSunLight;
uniform vec3 uMoonLight;
uniform float uNight;
uniform mat3 uStarRot;
uniform float uTime;
varying vec3 vDir;
${SKY_UV_GLSL}
${CLOUD_GLSL}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float phaseHG(float c, float g) {
  float gg = g * g;
  return (1.0 - gg) / (4.0 * 3.14159265 * pow(max(1.0 + gg - 2.0 * g * c, 1e-4), 1.5));
}
void main() {
  vec3 d = normalize(vDir);
  // ниже горизонта — та же дымка, что у края дальности: земля и вода растворяются в ней без шва
  vec3 col = texture(uSkyLUT, skyUV(normalize(vec3(d.x, max(d.y, 0.0), d.z)))).rgb;

  // солнечный диск с потемнением к краю
  float sunAng = acos(clamp(dot(d, uSunDir), -1.0, 1.0)) / ${(A.sunDisk.radius).toFixed(5)};
  if (sunAng < 1.2) {
    float x = min(sunAng, 1.0);
    float limb = 1.0 - 0.55 * (1.0 - sqrt(1.0 - x * x));
    col += uSunDisk * limb * (1.0 - smoothstep(0.92, 1.08, sunAng));
  }
  // луна: диск с «морями» и мягким ореолом
  float md = dot(d, uMoonDir);
  float moonAng = acos(clamp(md, -1.0, 1.0)) / ${(A.moonDisk.radius).toFixed(5)};
  if (moonAng < 1.2) {
    vec3 t1 = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0001)));
    vec3 t2 = cross(t1, uMoonDir);
    vec2 q = vec2(dot(d, t1), dot(d, t2)) / ${(A.moonDisk.radius).toFixed(5)};
    float maria = texture(uNoiseTex, q * 0.23 + 0.31).b * 0.6 + texture(uNoiseTex, q * 0.5 + 0.7).r * 0.4;
    float shade = mix(1.0, 0.62, smoothstep(0.45, 0.7, maria));
    col += uMoonDisk * shade * (1.0 - smoothstep(0.94, 1.04, moonAng));
  }
  col += uMoonDisk * 0.0045 * exp(-acos(clamp(md, -1.0, 1.0)) * 9.0);

  // Млечный Путь: полоса вдоль большого круга, вращается вместе со звёздами
  if (uNight > 0.01) {
    vec3 sd = uStarRot * d;
    float band = exp(-(sd.y * sd.y) / 0.0256);
    vec2 g = vec2(atan(sd.z, sd.x), sd.y) * vec2(1.6, 4.0);
    float clump = texture(uNoiseTex, g * 0.21).r * 0.7 + texture(uNoiseTex, g * 0.63 + 0.4).g * 0.3;
    float dust = smoothstep(0.42, 0.6, texture(uNoiseTex, g * 0.37 + 0.2).b) * exp(-(sd.y * sd.y) / 0.0025);
    col += vec3(0.75, 0.8, 1.0) * band * smoothstep(0.35, 0.75, clump) * (1.0 - 0.7 * dust) * ${A.milkyWay.toFixed(4)} * uNight * smoothstep(0.0, 0.25, d.y);
  }

  // облака: один слой, освещение — три шага к источнику света по плоскости слоя
  float alpha = 0.0;
  if (d.y > 0.0 && uCloud.x > 0.01) {
    float t = (uCloud.z - cameraPosition.y) / d.y;
    vec3 p = cameraPosition + d * t;
    float dens = cloudShape(p.xz, 1.0);
    if (dens > 0.002) {
      bool byMoon = uSunDir.y < -0.04;
      vec3 L = byMoon ? uMoonDir : uSunDir;
      vec3 Lc = byMoon ? uMoonLight : uSunLight;
      vec2 stepv = L.xz / max(L.y, 0.12) * ${f1(A.clouds.lightStep)};
      float acc = 0.0;
      for (int i = 1; i <= 3; i++) acc += cloudShape(p.xz + stepv * float(i), 0.0);
      float lightT = exp(-(acc * 0.75 + dens * 0.9) * uCloud.y);
      float c = dot(d, L);
      float ph = 0.55 * phaseHG(c, 0.65) + 0.45 * phaseHG(c, -0.15);
      vec3 amb = texture(uSkyLUT, skyUV(vec3(0.0, 1.0, 0.0))).rgb * 1.6 + texture(uSkyLUT, skyUV(normalize(vec3(d.x, 0.05, d.z)))).rgb * 0.6;
      vec3 cc = Lc * lightT * (0.18 + ph * 2.2) * (1.0 - exp(-dens * 4.0)) + amb * (1.0 - 0.45 * dens);
      // воздушная перспектива: далёкие облака у горизонта тонут в дымке
      float haze = 1.0 - exp(-t / ${f1(A.clouds.hazeDistance)});
      cc = mix(cc, col, haze);
      alpha = (1.0 - exp(-dens * 3.2 * uCloud.y)) * smoothstep(0.0, 0.05, d.y) * (1.0 - 0.6 * haze);
      col = mix(col, cc, alpha);
    }
  }
  col += (hash12(gl_FragCoord.xy) - 0.5) * (1.0 / 255.0) * col;
  // звёзды нарисованы раньше: облака закрывают их через альфу (смешивание One, OneMinusSrcAlpha)
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function f1(v) {
  return Number.isInteger(v) ? `${v}.0` : `${v}`;
}

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
  if (a < 0.002) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.atmosphere = new Atmosphere();
    this.group = new THREE.Group();
    this.uniforms = Object.assign(
      {
        uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
        uSunDisk: { value: new THREE.Vector3() },
        uMoonDisk: { value: new THREE.Vector3() },
        uSunLight: { value: new THREE.Vector3() },
        uMoonLight: { value: new THREE.Vector3() },
        uNight: { value: 0 },
        uStarRot: { value: new THREE.Matrix3() },
        uTime: { value: 0 },
      },
      atmo,
    );
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 24),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: domeVertex,
        fragmentShader: domeFragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      }),
    );
    // небо рисуется после непрозрачной геометрии: закрашиваются только пустые пиксели
    this.dome.renderOrder = 10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    const rand = mulberry32(20240607);
    const n = 2600;
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
      const b = (0.25 + 0.75 * rand() ** 4) * A.stars;
      col[i * 3] = b * (warm > 0.8 ? 1 : 0.82);
      col[i * 3 + 1] = b * 0.88;
      col[i * 3 + 2] = b * (warm < 0.3 ? 1 : 0.82);
      size[i] = 1.1 + 2.0 * rand() ** 5;
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
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.stars.frustumCulled = false;
    this.stars.renderOrder = 9;
    this.starPivot = new THREE.Group();
    // ось вращения неба наклонена к северу (−z), как полярная звезда
    this.starPivot.rotation.x = -0.75;
    this.starPivot.add(this.stars);
    this.group.add(this.starPivot);
    scene.add(this.group);

    this.light = new THREE.DirectionalLight(0xffffff, 1);
    this.light.position.set(0, 100, 0);
    scene.add(this.light);
    scene.add(this.light.target);
    // туман three.js нужен ради define USE_FOG; near/far — растворение у края дальности
    scene.fog = new THREE.Fog(0x000000, 300, 400);

    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.lightDir = new THREE.Vector3();
    this.daylight = 1; // 0 ночь … 1 день — для звуков и HUD
    this.elevation = 1;
    this.shadowRange = 50;
    this.shadowFade = new THREE.Vector2(40, 50);
    this.cloudCover = 0.4;
    this.windDir = new THREE.Vector2(0.94, 0.34);
    this.cloudSeed = 0;
    this.tmpM4 = new THREE.Matrix4();
  }

  setSeed(seed) {
    const r = mulberry32((seed ^ 0x5bd1e995) >>> 0);
    this.cloudSeed = r() * 1000;
    const a = r() * Math.PI * 2;
    this.windDir.set(Math.cos(a), Math.sin(a));
    this.cloudOrigin = [r(), r(), r(), r()];
  }

  setRadius(r) {
    this.dome.scale.setScalar(r);
    this.stars.scale.setScalar(r * 0.97);
  }

  setTier(tier) {
    this.atmosphere.setTier(tier);
  }

  // Покрытие облаками медленно меняется: ясные дни сменяются облачными (детерминированно по сиду)
  weather(day, t) {
    const C = A.clouds;
    const x = day + t + this.cloudSeed;
    const w = 0.5 + 0.32 * Math.sin(x * ((2 * Math.PI) / C.period)) + 0.18 * Math.sin(x * 2.3 + 1.7);
    return C.coverage[0] + (C.coverage[1] - C.coverage[0]) * Math.min(1, Math.max(0, w));
  }

  // t: 0 — полночь, 0.25 — рассвет, 0.5 — полдень, 0.75 — закат
  update(t, day, focus, elapsed, renderer, dt) {
    const a = (t - 0.25) * Math.PI * 2;
    const s = Math.sin(a);
    this.sunDir.set(Math.cos(a), s * Math.cos(TILT), s * Math.sin(TILT)).normalize();
    this.moonDir.set(-this.sunDir.x, -this.sunDir.y, -this.sunDir.z * 0.6 - 0.25).normalize();
    const e = this.sunDir.y;
    this.elevation = e;

    const atm = this.atmosphere;
    atm.update(renderer, this.sunDir, this.moonDir, dt);
    const sT = atm.sunT;
    const mT = atm.moonT;
    const sunE = atm.sunE;
    const moonUp = Math.min(1, Math.max(0, (this.moonDir.y + 0.05) / 0.15));
    const moonE = atm.moonE * moonUp;
    const MT = A.moonTint;

    const u = this.uniforms;
    u.uMoonDir.value.copy(this.moonDir);
    u.uSunLight.value.set(sunE * sT[0], sunE * sT[1], sunE * sT[2]);
    u.uMoonLight.value.set(moonE * mT[0] * MT[0], moonE * mT[1] * MT[1], moonE * mT[2] * MT[2]);
    const disk = A.sunDisk.radiance;
    u.uSunDisk.value.copy(u.uSunLight.value).multiplyScalar(disk);
    // луна видна одинаково ярко при любой экспозиции
    const mb = (A.moonDisk.brightness / atm.exposure) * Math.min(1, Math.max(0, (this.moonDir.y + 0.02) / 0.08));
    u.uMoonDisk.value.set(mb * 0.96, mb * 0.98, mb);
    const night = Math.min(1, Math.max(0, (-e - 0.06) / 0.14));
    u.uNight.value = night / atm.exposure;
    u.uTime.value = elapsed;
    this.starUniforms.uAlpha.value = night / atm.exposure;
    this.starUniforms.uTime.value = elapsed;
    this.stars.visible = night > 0.01;
    this.starPivot.rotation.y = t * Math.PI * 2;
    this.starPivot.updateMatrixWorld();
    this.tmpM4.copy(this.starPivot.matrixWorld).invert();
    u.uStarRot.value.setFromMatrix4(this.tmpM4);

    // облака: покрытие по погоде, сдвиг ветром (в долях плитки шума)
    this.cloudCover = this.weather(day, t);
    const C = A.clouds;
    const drift = (elapsed * C.speed) / C.scale;
    const o = this.cloudOrigin || [0, 0, 0, 0];
    atmo.uCloud.value.set(this.cloudCover, C.density, C.altitude, C.shadow * Math.min(1, Math.max(0, (e - 0.02) / 0.1)));
    atmo.uCloudOffset.value.set(o[0] + this.windDir.x * drift, o[1] + this.windDir.y * drift, o[2] + this.windDir.x * drift * 1.6, o[3] + this.windDir.y * drift * 1.6);
    atmo.uSunDir.value.copy(this.sunDir);

    // свет: днём от солнца, ночью от луны; переключение — когда оба почти погасли
    const sunI = sunE * luminance(sT) * Math.min(1, Math.max(0, (e + 0.02) / 0.06));
    const moonI = moonE * luminance(mT);
    const useSun = sunI >= moonI;
    this.lightDir.copy(useSun ? this.sunDir : this.moonDir);
    const L = this.light;
    if (useSun) {
      const l = Math.max(luminance(sT), 1e-6);
      L.color.setRGB(sT[0] / l, sT[1] / l, sT[2] / l);
      L.intensity = sunI;
    } else {
      const l = Math.max(luminance(mT), 1e-6);
      L.color.setRGB((mT[0] / l) * MT[0], (mT[1] / l) * MT[1], (mT[2] / l) * MT[2]);
      L.intensity = moonI;
    }
    atmo.uLightDir.value.copy(this.lightDir);
    atmo.uLightColor.value.copy(useSun ? u.uSunLight.value : u.uMoonLight.value);
    // туман: ореол вокруг солнца в дымке
    atmo.uFogSunDir.value.copy(useSun ? this.sunDir : this.moonDir);
    atmo.uFogSunColor.value.copy(useSun ? u.uSunLight.value : u.uMoonLight.value).multiplyScalar(A.fog.sunGlowScale);
    this.daylight = Math.min(1, Math.max(0, (e + 0.06) / 0.25));

    this.group.position.copy(focus);
    // источник света следует за игроком, тень привязана к сетке текселей — без дрожания
    const snap = (this.shadowRange * 2) / (L.shadow.mapSize.x || 1024);
    const tx = Math.round(focus.x / snap) * snap;
    const tz = Math.round(focus.z / snap) * snap;
    L.target.position.set(tx, focus.y, tz);
    L.position.set(tx + this.lightDir.x * 300, focus.y + Math.max(this.lightDir.y, 0.08) * 300, tz + this.lightDir.z * 300);
    L.target.updateMatrixWorld();
  }

  get exposure() {
    return this.atmosphere.exposure;
  }

  get envTexture() {
    return this.atmosphere.envTexture;
  }

  setShadows(on, size, range) {
    const L = this.light;
    L.castShadow = on;
    this.shadowRange = range;
    this.shadowFade.set(range * 0.72, range * 0.94);
    if (!on) return;
    L.shadow.mapSize.set(size, size);
    const c = L.shadow.camera;
    c.left = -range;
    c.right = range;
    c.top = range;
    c.bottom = -range;
    c.near = 10;
    c.far = 700;
    c.updateProjectionMatrix();
    L.shadow.bias = -0.0004;
    L.shadow.normalBias = 0.05;
    L.shadow.radius = 2;
    if (L.shadow.map) {
      L.shadow.map.dispose();
      L.shadow.map = null;
    }
  }
}
