// Материалы мира: PBR (MeshStandardMaterial) со вставками в шейдеры three.js.
// Земля смешивает до трёх слоёв фототекстур по весам из генератора и по высотам самих текстур,
// растительность качается на ветру, листва и трава просвечивают на солнце,
// всем освещённым материалам добавлены тени облаков и атмосферный туман (atmosphere.js).
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { atmo, CLOUD_GLSL } from './atmosphere.js';

// Общие uniform'ы: время, уровень моря, ветер, дистанции растворения растительности
export const shared = {
  uTime: { value: 0 },
  uSea: { value: CONFIG.world.seaLevel },
  uWind: { value: 1 },
  uWindDir: { value: new THREE.Vector2(0.94, 0.34) },
  uGrassFade: { value: new THREE.Vector2(40, 56) },
  uSmallFade: { value: new THREE.Vector2(70, 90) },
  uTreeFade: { value: new THREE.Vector2(290, 320) },
};

// Волны: та же формула в шейдере воды и в покачивании пловца (JS)
export const WAVES_GLSL = /* glsl */ `
float waveHeight(vec2 p, float t) {
  return sin(dot(p, vec2(0.12, 0.05)) + t * 1.1) * 0.10
       + sin(dot(p, vec2(-0.06, 0.11)) + t * 0.8) * 0.08
       + sin(dot(p, vec2(0.21, -0.17)) + t * 1.7) * 0.035;
}
vec2 waveGrad(vec2 p, float t) {
  return vec2(0.12, 0.05) * cos(dot(p, vec2(0.12, 0.05)) + t * 1.1) * 0.10
       + vec2(-0.06, 0.11) * cos(dot(p, vec2(-0.06, 0.11)) + t * 0.8) * 0.08
       + vec2(0.21, -0.17) * cos(dot(p, vec2(0.21, -0.17)) + t * 1.7) * 0.035;
}
`;

export function waveHeight(x, z, t) {
  return (
    Math.sin(x * 0.12 + z * 0.05 + t * 1.1) * 0.1 +
    Math.sin(-x * 0.06 + z * 0.11 + t * 0.8) * 0.08 +
    Math.sin(x * 0.21 - z * 0.17 + t * 1.7) * 0.035
  );
}

// Тень у края карты теней плавно исчезает — граница её действия не видна
THREE.ShaderChunk.shadowmap_pars_fragment = THREE.ShaderChunk.shadowmap_pars_fragment.replaceAll(
  'return mix( 1.0, shadow, shadowIntensity );',
  `vec2 shadowEdge = abs( shadowCoord.xy - 0.5 );
		return mix( 1.0, shadow, shadowIntensity * ( 1.0 - smoothstep( 0.36, 0.48, max( shadowEdge.x, shadowEdge.y ) ) ) );`,
);

// Освещение: прямой свет приглушается тенью облака; у листвы и травы — просвет на солнце (TRANSLUCENT)
const LIGHTS_BEGIN = THREE.ShaderChunk.lights_fragment_begin
  .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= cloudShade;')
  .replace(
    /(RE_Direct\( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight \);\s*\}\s*#pragma unroll_loop_end\s*#endif\s*#if \( NUM_RECT_AREA_LIGHTS)/,
    (m) =>
      m.replace(
        'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
        `RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
		#ifdef TRANSLUCENT
		{
			float back = saturate( dot( -geometryNormal, directLight.direction ) );
			float through = pow( saturate( dot( geometryViewDir, -directLight.direction ) ), 3.0 );
			reflectedLight.directDiffuse += directLight.color * material.diffuseColor * ( back * 0.35 + through * 0.9 ) * translucency * RECIPROCAL_PI;
		}
		#endif`,
      ),
  );

const WIND_GLSL = /* glsl */ `
uniform float uTime;
uniform float uWind;
uniform vec2 uWindDir;
// Покачивание: основание неподвижно, гибкость растёт к верхушке; порывы бегут по миру волной
vec3 windSway(vec3 base, float h, float flex, float flutter, vec3 p) {
  float gust = 0.65 + 0.35 * sin(uTime * 0.7 - dot(base.xz, uWindDir) * 0.05);
  float ph = uTime * 1.3 + base.x * 0.21 + base.z * 0.17;
  vec2 bend = uWindDir * (0.55 + 0.45 * sin(ph)) * gust * uWind * flex * h * h;
  vec3 off = vec3(bend.x, -0.25 * (bend.x * bend.x + bend.y * bend.y), bend.y);
  off += vec3(sin(uTime * 6.3 + p.x * 3.1 + p.y * 1.7), sin(uTime * 7.1 + p.z * 2.7), cos(uTime * 5.7 + p.y * 2.3 + p.z * 1.3)) * flutter * uWind * gust;
  return off;
}
`;

// Общая часть всех освещённых материалов: мировая позиция, тени облаков, uniform'ы атмосферы
function patchLit(shader, { translucency = 0 } = {}) {
  Object.assign(shader.uniforms, atmo, {
    uTime: shared.uTime,
    uWind: shared.uWind,
    uWindDir: shared.uWindDir,
    uSea: shared.uSea,
  });
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nvarying vec3 vWorldPos;`)
    .replace('#include <project_vertex>', `#include <project_vertex>\nvWorldPos = (mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix);`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\nvarying vec3 vWorldPos;\n${CLOUD_GLSL}\n${translucency ? `#define TRANSLUCENT\nconst float translucency = ${translucency.toFixed(3)};` : ''}`)
    .replace('#include <lights_fragment_begin>', `float cloudShade = cloudShadow(vWorldPos);\n${LIGHTS_BEGIN}`);
}

// ---------- Земля ----------
export const terrainUniforms = {
  uTerrain: { value: null },
  uTexSize: { value: 1024 },
  uTile: { value: [3.2, 4, 5, 6, 4.5, 9, 7, 3.2] },
  uBump: { value: [0.035, 0.04, 0.025, 0.04, 0.06, 0.32, 0.05, 0.035] },
  uRough: { value: [0.95, 0.92, 0.88, 0.95, 0.86, 0.8, 0.55, 0.96] },
  uNormalFade: { value: new THREE.Vector2(55, 130) },
};

const TERRAIN_PARS = /* glsl */ `
uniform highp sampler2DArray uTerrain;
uniform float uTexSize;
uniform float uTile[8];
uniform float uBump[8];
uniform float uRough[8];
uniform vec2 uNormalFade;
uniform float uSea;
uniform float uTime;
varying vec4 vSplatA;
varying vec4 vSplatB;
varying vec4 vTint;
varying vec3 vNormalW;

// Выборка слоя: L — номер, uv в плитках, производные uv по экрану
vec4 layerTex(int L, vec2 uv, vec2 gx, vec2 gy) {
  return textureGrad(uTerrain, vec3(uv, float(L)), gx, gy);
}
// Проекции: сверху для всех слоёв, у скалы — с трёх сторон (без растяжения на обрывах)
struct Proj { vec2 uv; vec2 gx; vec2 gy; vec3 U; vec3 V; float w; };
Proj projTop(vec3 p, vec3 dpx, vec3 dpy, float tile) {
  return Proj(p.xz / tile, dpx.xz / tile, dpy.xz / tile, vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), 1.0);
}
Proj projX(vec3 p, vec3 dpx, vec3 dpy, float tile, float s) {
  return Proj(vec2(p.z * s, -p.y) / tile, vec2(dpx.z * s, -dpx.y) / tile, vec2(dpy.z * s, -dpy.y) / tile, vec3(0.0, 0.0, s), vec3(0.0, -1.0, 0.0), 1.0);
}
Proj projZ(vec3 p, vec3 dpx, vec3 dpy, float tile, float s) {
  return Proj(vec2(-p.x * s, -p.y) / tile, vec2(-dpx.x * s, -dpx.y) / tile, vec2(-dpy.x * s, -dpy.y) / tile, vec3(-s, 0.0, 0.0), vec3(0.0, -1.0, 0.0), 1.0);
}
// Две масштабные копии против заметного повтора: вдали крупная (повёрнутая) берёт верх
const mat2 ROT2 = mat2(0.7986, -0.6018, 0.6018, 0.7986);
vec4 layerSample(int L, Proj pr, float far) {
  vec4 a = layerTex(L, pr.uv, pr.gx, pr.gy);
  #ifdef TERRAIN_HQ
  if (far > 0.02) {
    vec4 b = layerTex(L, ROT2 * pr.uv * 0.27 + 0.37, ROT2 * pr.gx * 0.27, ROT2 * pr.gy * 0.27);
    a = mix(a, b, far);
  }
  #endif
  return a;
}
`;

const TERRAIN_MAIN = /* glsl */ `
vec3 wp = vWorldPos;
vec3 dpx = dFdx(wp);
vec3 dpy = dFdy(wp);
vec3 Ng = normalize(vNormalW);
float camDist = length(wp - cameraPosition);
float far = smoothstep(18.0, 90.0, camDist) * 0.55;

// три самых весомых слоя
float W[8];
W[0] = vSplatA.x; W[1] = vSplatA.y; W[2] = vSplatA.z; W[3] = vSplatA.w;
W[4] = vSplatB.x; W[5] = vSplatB.y; W[6] = vSplatB.z; W[7] = vSplatB.w;
int Ls[3];
float Ws[3];
for (int k = 0; k < 3; k++) {
  int best = 0;
  for (int i = 1; i < 8; i++) if (W[i] > W[best]) best = i;
  Ls[k] = best;
  Ws[k] = max(W[best], 0.0);
  W[best] = -1.0;
}
// скала — на три стороны по нормали, остальное сверху
vec3 tw = pow(abs(Ng), vec3(6.0));
tw /= (tw.x + tw.y + tw.z);
vec4 S[3];
Proj P[3];
for (int k = 0; k < 3; k++) {
  if (k > 0 && Ws[k] < 0.02) { S[k] = vec4(0.0); P[k] = P[0]; continue; }
  int L = Ls[k];
  float tile = uTile[L];
  if (L == 5) {
    vec4 acc = vec4(0.0);
    Proj main = projTop(wp, dpx, dpy, tile);
    float wMax = tw.y;
    if (tw.y > 0.05) acc += layerSample(L, main, 0.0) * tw.y;
    if (tw.x > 0.05) {
      Proj px = projX(wp, dpx, dpy, tile, sign(Ng.x));
      acc += layerSample(L, px, 0.0) * tw.x;
      if (tw.x > wMax) { main = px; wMax = tw.x; }
    }
    if (tw.z > 0.05) {
      Proj pz = projZ(wp, dpx, dpy, tile, sign(Ng.z));
      acc += layerSample(L, pz, 0.0) * tw.z;
      if (tw.z > wMax) { main = pz; wMax = tw.z; }
    }
    float wsum = (tw.y > 0.05 ? tw.y : 0.0) + (tw.x > 0.05 ? tw.x : 0.0) + (tw.z > 0.05 ? tw.z : 0.0);
    S[k] /= max(wsum, 1e-4);
    P[k] = main;
  } else {
    P[k] = projTop(wp, dpx, dpy, tile);
    S[k] = layerSample(L, P[k], far);
  }
}
// смешивание по высоте текстур: в стыках камни торчат из травы, а не просвечивают
float depthB = 0.18;
float h0 = S[0].a + Ws[0];
float h1 = Ws[1] > 0.02 ? S[1].a + Ws[1] : -9.0;
float h2 = Ws[2] > 0.02 ? S[2].a + Ws[2] : -9.0;
float hm = max(h0, max(h1, h2)) - depthB;
vec3 bw = max(vec3(h0, h1, h2) - hm, 0.0);
bw /= max(bw.x + bw.y + bw.z, 1e-4);
vec3 albedo = S[0].rgb * bw.x + S[1].rgb * bw.y + S[2].rgb * bw.z;
float hBlend = S[0].a * bw.x + S[1].a * bw.y + S[2].a * bw.z;
float terrRough = uRough[Ls[0]] * bw.x + uRough[Ls[1]] * bw.y + uRough[Ls[2]] * bw.z;
int dom = bw.x >= bw.y && bw.x >= bw.z ? 0 : (bw.y >= bw.z ? 1 : 2);

// крупные пятна: земля не выглядит одинаковой на сотни метров
float macro = texture(uNoiseTex, wp.xz * (1.0 / 230.0)).r * 0.65 + texture(uNoiseTex, wp.xz * (1.0 / 53.0) + 0.37).g * 0.35;
albedo *= 0.8 + 0.42 * macro;
albedo *= vTint.rgb * 2.0;

// рельеф текстуры: нормаль по разности высот у главного слоя
vec3 terrN = Ng;
float nf = 1.0 - smoothstep(uNormalFade.x, uNormalFade.y, camDist);
if (nf > 0.01) {
  int L = Ls[dom];
  Proj pr = P[dom];
  float e = max(1.0 / uTexSize, max(length(pr.gx), length(pr.gy)));
  float hc = layerTex(L, pr.uv, pr.gx, pr.gy).a;
  float hu = layerTex(L, pr.uv + vec2(e, 0.0), pr.gx, pr.gy).a;
  float hv = layerTex(L, pr.uv + vec2(0.0, e), pr.gx, pr.gy).a;
  float k = uBump[L] / (e * uTile[L]) * nf;
  terrN = normalize(Ng - ((hu - hc) * k) * pr.U - ((hv - hc) * k) * pr.V);
}

// мокрый берег и дно: темнее и глаже; на мелководье — блики каустики
float aboveSea = wp.y - uSea;
if (aboveSea < 1.2) {
  float wet = 1.0 - smoothstep(0.05, 1.0, aboveSea);
  float porous = 1.0 - (Ls[dom] == 5 ? 0.6 : 0.0);
  albedo *= mix(1.0, 0.58, wet * porous);
  terrRough = mix(terrRough, 0.22, wet);
  #ifdef TERRAIN_HQ
  if (aboveSea < 0.0) {
    float depth = -aboveSea;
    vec2 cq = wp.xz * 0.19;
    float c1 = texture(uNoiseTex, cq + vec2(uTime * 0.021, uTime * 0.013)).b;
    float c2 = texture(uNoiseTex, cq * 1.13 - vec2(uTime * 0.017, -uTime * 0.019) + 0.5).b;
    float caust = pow(1.0 - abs(c1 - c2), 12.0) * smoothstep(0.0, 0.4, depth) * (1.0 - smoothstep(1.5, 7.0, depth));
    albedo += albedo * caust * 2.2 * cloudShadow(wp);
  }
  #endif
}
float terrAO = mix(0.55, 1.0, hBlend);
diffuseColor.rgb = albedo;
`;

const TERRAIN_AO = /* glsl */ `
{
  float ambientOcclusion = terrAO;
  reflectedLight.indirectDiffuse *= ambientOcclusion;
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    float dotNVao = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNVao, ambientOcclusion, material.roughness );
  #endif
}
`;

export function createTerrainMaterial(hq) {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, envMapIntensity: 1 });
  m.defines = hq ? { TERRAIN_HQ: '' } : {};
  m.onBeforeCompile = (shader) => {
    patchLit(shader);
    Object.assign(shader.uniforms, terrainUniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 splatA;
attribute vec4 splatB;
attribute vec4 tint;
varying vec4 vSplatA;
varying vec4 vSplatB;
varying vec4 vTint;
varying vec3 vNormalW;`,
      )
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvSplatA = splatA;\nvSplatB = splatB;\nvTint = tint;\nvNormalW = normal;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${TERRAIN_PARS}`)
      .replace('#include <map_fragment>', TERRAIN_MAIN)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = terrRough;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(terrN, 0.0)).xyz);')
      .replace('#include <aomap_fragment>', TERRAIN_AO);
  };
  m.customProgramCacheKey = () => `terrain-pbr-${hq ? 'hq' : 'lq'}`;
  return m;
}

// ---------- Растительность ----------
// Общий вершинный код для экземпляров: позиция основания экземпляра в мире
const INSTANCE_BASE = /* glsl */ `
vec3 instBase = vec3(0.0);
float instScale = 1.0;
#ifdef USE_INSTANCING
instBase = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
instScale = length(instanceMatrix[1].xyz);
#endif
`;

// Растворение вдали: экземпляр сжимается в точку между uFade.x и uFade.y
const FADE_GLSL = /* glsl */ `
float fadeK = 1.0 - smoothstep(uFade.x, uFade.y, distance(instBase.xz, cameraPosition.xz));
transformed *= fadeK;
`;

function vegPatch(shader, { wind, fade, translucency, keepNormal, extraVertex = '', extraVertexPars = '', afterMap = '', extraFragment = '', extraFragmentPars = '' }) {
  patchLit(shader, { translucency });
  if (fade) shader.uniforms.uFade = fade;
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
${WIND_GLSL}
${fade ? 'uniform vec2 uFade;' : ''}
${extraVertexPars}`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
${INSTANCE_BASE}
${extraVertex}
${wind ? wind : ''}
${fade ? FADE_GLSL : ''}`,
    );
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${extraFragmentPars}`);
  if (afterMap) shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\n${afterMap}`);
  if (extraFragment) shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `${extraFragment}\n#include <alphatest_fragment>`);
  if (keepNormal) {
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  }
}

// Кора: ствол почти не гнётся, ветви — сильнее (aWind.x — изгиб, aWind.y — дрожь)
export function createBarkMaterial(map, normalMap, { tint = 0xffffff, fade = null, roughness = 0.92 } = {}) {
  const m = new THREE.MeshStandardMaterial({ map, normalMap, roughness, metalness: 0, color: tint, vertexColors: true });
  m.normalScale.set(1.2, 1.2);
  m.onBeforeCompile = (shader) => {
    vegPatch(shader, {
      fade,
      extraVertexPars: 'attribute vec2 aWind;',
      wind: 'transformed += windSway(instBase, position.y * 0.1, aWind.x * 0.045, aWind.y * 0.006, position);',
    });
    shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', BARK_COLOR_VERTEX);
  };
  m.customProgramCacheKey = () => `bark-${fade ? 'f' : 'n'}`;
  return m;
}

// Листва: карточки с альфой, двусторонние, просвечивают; RECOLOR перекрашивает по яркости (берёза, осень), SNOWY — снег сверху
export function createLeafMaterial(map, { recolor = null, snowy = false, fade = null, alphaTest = 0.5 } = {}) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest, side: THREE.DoubleSide, roughness: 0.78, metalness: 0, vertexColors: true });
  m.defines = {};
  if (recolor) m.defines.RECOLOR = '';
  if (snowy) m.defines.SNOWY = '';
  const uRecolor = { value: new THREE.Vector3(...(recolor || [1, 1, 1])) };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRecolor = uRecolor;
    vegPatch(shader, {
      fade,
      translucency: 0.55,
      keepNormal: true,
      extraVertexPars: 'attribute vec2 aWind;\nvarying float vUpN;',
      extraVertex: 'vUpN = normalize(mat3(modelMatrix) * normal).y;',
      wind: 'transformed += windSway(instBase, position.y * 0.1, aWind.x * 0.045, aWind.y * 0.03, position);',
      extraFragmentPars: 'varying float vUpN;\nuniform vec3 uRecolor;',
      afterMap: `
#ifdef RECOLOR
diffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))) * uRecolor;
#endif`,
      extraFragment: `
#ifdef SNOWY
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.95), smoothstep(0.2, 0.65, vUpN) * 0.85);
#endif`,
    });
  };
  m.customProgramCacheKey = () => `leaf-${!!recolor}-${snowy}-${fade ? 'f' : 'n'}`;
  return m;
}

// Трава: атлас 2×2, вариант — атрибут экземпляра; низ пучка темнее (затенение у земли)
export function createGrassMaterial(map, fade) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    vegPatch(shader, {
      fade,
      translucency: 0.7,
      keepNormal: true,
      extraVertexPars: 'attribute float aVariant;\nvarying float vBlade;',
      extraVertex: `
vBlade = uv.y;
#ifdef USE_MAP
vMapUv = vec2((uv.x + mod(aVariant, 2.0)) * 0.5, uv.y * 0.5 + (aVariant < 2.0 ? 0.5 : 0.0));
#endif`,
      wind: 'transformed += windSway(instBase, uv.y * 0.9, 0.16, 0.012, position + instBase);',
      extraFragmentPars: 'varying float vBlade;',
      extraFragment: 'diffuseColor.rgb *= mix(0.45, 1.05, smoothstep(0.0, 0.75, vBlade));',
    });
  };
  m.customProgramCacheKey = () => 'grass-card';
  return m;
}

// Камень: трёхсторонняя проекция слоёв скалы и щебня из массива земли, сверху — мох или песок
export function createRockMaterial(fade) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    patchLit(shader);
    Object.assign(shader.uniforms, terrainUniforms);
    if (fade) shader.uniforms.uFade = fade;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${fade ? 'uniform vec2 uFade;' : ''}\nvarying vec3 vObjPos;\nvarying vec3 vObjN;\nvarying vec3 vRockTint;\nvarying vec3 vNormalWr;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
${INSTANCE_BASE}
vObjPos = position * 1.0 + instBase * 0.37;
vObjN = normal;
vRockTint = vec3(1.0);
#ifdef USE_INSTANCING_COLOR
vRockTint = instanceColor.rgb;
#endif
#ifdef USE_INSTANCING
vNormalWr = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
#else
vNormalWr = normalize(mat3(modelMatrix) * normal);
#endif
${fade ? FADE_GLSL : ''}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform highp sampler2DArray uTerrain;
varying vec3 vObjPos;
varying vec3 vObjN;
varying vec3 vRockTint;
varying vec3 vNormalWr;`,
      )
      .replace(
        '#include <map_fragment>',
        `
vec3 rp = vObjPos * 0.42;
vec3 rn = normalize(vObjN);
vec3 rw = pow(abs(rn), vec3(4.0));
rw /= rw.x + rw.y + rw.z;
vec4 rx = texture(uTerrain, vec3(rp.zy, 5.0));
vec4 ry = texture(uTerrain, vec3(rp.xz, 4.0));
vec4 rz = texture(uTerrain, vec3(rp.xy, 5.0));
vec4 rock = rx * rw.x + ry * rw.y + rz * rw.z;
vec3 rcol = rock.rgb * vRockTint;
// сверху — налёт: мох в лесу и на равнине, снег или песок — по оттенку экземпляра
float top = smoothstep(0.55, 0.85, normalize(vNormalWr).y + (rock.a - 0.5) * 0.4);
vec3 moss = texture(uTerrain, vec3(rp.xz * 1.3, 0.0)).rgb * vec3(0.8, 0.95, 0.7);
rcol = mix(rcol, moss * vRockTint, top * 0.75);
diffuseColor.rgb = rcol;
float rockAO = mix(0.6, 1.0, rock.a);`,
      )
      .replace(
        '#include <aomap_fragment>',
        `reflectedLight.indirectDiffuse *= rockAO;`,
      );
  };
  m.customProgramCacheKey = () => `rock-${fade ? 'f' : 'n'}`;
  return m;
}

// Простой текстурный материал растений (кактус, ствол пальмы) с покачиванием
export function createPlantMaterial(map, { alphaTest = 0, side = THREE.FrontSide, translucency = 0, fade = null, flex = 0.03, flutter = 0.004, roughness = 0.8, keepNormal = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest, side, roughness, metalness: 0, vertexColors: true });
  m.onBeforeCompile = (shader) =>
    vegPatch(shader, {
      fade,
      translucency,
      keepNormal,
      wind: `transformed += windSway(instBase, position.y * 0.12, ${flex.toFixed(4)}, ${flutter.toFixed(4)}, position);`,
    });
  m.customProgramCacheKey = () => `plant-${alphaTest}-${side}-${translucency}-${fade ? 'f' : 'n'}-${flex}-${flutter}-${keepNormal}`;
  return m;
}

// Кора не перекрашивается цветом экземпляра (он для листвы) — только затенение вершин
export const BARK_COLOR_VERTEX = /* glsl */ `
#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR
vColor.rgb *= color;
#endif
`;

// Импостер: карточка поворачивается к камере вокруг вертикали, кадр атласа выбирается
// по направлению взгляда в системе дерева; соседние кадры смешиваются, нормали — из второго атласа.
export function createImpostorMaterial(atlas, row, side, { recolor = null, fade = null } = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0 });
  m.defines = recolor ? { RECOLOR: '' } : {};
  const uniforms = {
    uImpAlbedo: { value: atlas.albedo },
    uImpNormal: { value: atlas.normal },
    uImpRow: { value: row },
    uImpRows: { value: atlas.rows },
    uImpFrames: { value: atlas.frames },
    uImpSide: { value: side },
    uRecolor: { value: new THREE.Vector3(...(recolor || [1, 1, 1])) },
  };
  m.onBeforeCompile = (shader) => {
    patchLit(shader);
    Object.assign(shader.uniforms, uniforms);
    if (fade) shader.uniforms.uFade = fade;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uImpFrames;
uniform float uImpSide;
${fade ? 'uniform vec2 uFade;' : ''}
varying vec2 vImpUv;
varying float vImpFrame;
varying vec3 vImpX;
varying vec3 vImpZ;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec3 impBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
vec3 impAx = normalize((modelMatrix * instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
vec3 impAz = normalize((modelMatrix * instanceMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
float impSx = length(instanceMatrix[0].xyz);
float impSy = length(instanceMatrix[1].xyz);
vec3 toCam = cameraPosition - impBase;
vec3 fwd = normalize(vec3(toCam.x, 0.0, toCam.z) + vec3(1e-5, 0.0, 0.0));
vec3 right = vec3(fwd.z, 0.0, -fwd.x);
float az = atan(dot(fwd, impAx), dot(fwd, impAz));
vImpFrame = mod(az / 6.2831853 * uImpFrames + uImpFrames, uImpFrames);
vImpUv = vec2(position.x + 0.5, position.y);
vImpX = impAx;
vImpZ = impAz;
float impFade = 1.0;
${fade ? 'impFade = 1.0 - smoothstep(uFade.x, uFade.y, length(toCam.xz));' : ''}
vec3 impWorld = impBase + (right * position.x * impSx + vec3(0.0, (position.y - 0.02) * impSy, 0.0)) * uImpSide * impFade;`,
      )
      .replace('#include <project_vertex>', 'vec4 mvPosition = viewMatrix * vec4(impWorld, 1.0);\ngl_Position = projectionMatrix * mvPosition;')
      .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4(impWorld, 1.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uImpAlbedo;
uniform sampler2D uImpNormal;
uniform float uImpRow;
uniform float uImpRows;
uniform float uImpFrames;
uniform vec3 uRecolor;
varying vec2 vImpUv;
varying float vImpFrame;
varying vec3 vImpX;
varying vec3 vImpZ;
vec2 impUV(float f) { return vec2((f + vImpUv.x) / uImpFrames, (uImpRow + vImpUv.y) / uImpRows); }`,
      )
      .replace(
        '#include <map_fragment>',
        `
float f0 = floor(vImpFrame);
float ft = vImpFrame - f0;
float f1 = mod(f0 + 1.0, uImpFrames);
vec4 alb = mix(texture(uImpAlbedo, impUV(f0)), texture(uImpAlbedo, impUV(f1)), ft);
// в мипмапах альфа «худеет» — вдали её подтягиваем, чтобы кроны не редели
float impDist = length(vWorldPos - cameraPosition);
if (alb.a * (1.0 + smoothstep(60.0, 420.0, impDist)) < 0.42) discard;
diffuseColor.rgb = alb.rgb / max(alb.a, 0.001);
#ifdef RECOLOR
diffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))) * uRecolor;
#endif
vec4 nrm = mix(texture(uImpNormal, impUV(f0)), texture(uImpNormal, impUV(f1)), ft);
vec3 nObj = normalize(nrm.rgb / max(nrm.a, 0.001) * 2.0 - 1.0);
vec3 impN = normalize(vImpX * nObj.x + vec3(0.0, nObj.y, 0.0) + vImpZ * nObj.z);`,
      )
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(impN, 0.0)).xyz);');
  };
  m.customProgramCacheKey = () => `impostor-${recolor ? 'r' : 'n'}-${fade ? 'f' : 'n'}`;
  return m;
}
