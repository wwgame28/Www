// Материалы мира: дешёвый Lambert + небольшие вставки в шейдеры three.js.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Общие uniform'ы: время, уровень моря, сила ветра, дистанции растворения растительности
export const shared = {
  uTime: { value: 0 },
  uSea: { value: CONFIG.world.seaLevel },
  uWind: { value: 1 },
  uFoam: { value: 1 },
  uGrassFade: { value: new THREE.Vector2(40, 56) },
  uSmallFade: { value: new THREE.Vector2(70, 90) },
  uTreeFade: { value: new THREE.Vector2(290, 320) },
};

// Волны: та же формула в шейдере воды, в пене прибоя и в покачивании пловца (JS)
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

const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

export function createTerrainMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uSea = shared.uSea;
    shader.uniforms.uFoam = shared.uFoam;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWorldPos;
uniform float uTime;
uniform float uSea;
uniform float uFoam;
${NOISE_GLSL}
${WAVES_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float grain = vnoise(vWorldPos.xz * 1.7) * 0.6 + vnoise(vWorldPos.xz * 0.31) * 0.4;
diffuseColor.rgb *= 0.92 + 0.16 * grain;
// пена считается только у кромки воды — остальная земля не платит за волны
if (abs(vWorldPos.y - uSea) < 0.7) {
  float d = vWorldPos.y - (uSea + waveHeight(vWorldPos.xz, uTime));
  float band = 1.0 - smoothstep(0.02, 0.3, abs(d + 0.03));
  float foamN = vnoise(vWorldPos.xz * 1.3 + vec2(uTime * 0.6, -uTime * 0.4));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.94, 0.96), band * smoothstep(0.25, 0.7, foamN) * uFoam);
}`,
      );
  };
  m.customProgramCacheKey = () => 'terrain-v2';
  return m;
}

// Растительность: цвет экземпляра красит только части с tintMask=1 (крона), ствол остаётся своим.
// sway — амплитуда покачивания на метр высоты выше swayBase, fade — uniform растворения вдали.
// keepNormal — у двусторонних травинок обратная сторона освещается как лицевая (без переворота нормали).
export function createVegMaterial({ sway = 0, swayBase = 0.8, flat = true, side = THREE.FrontSide, fade = null, keepNormal = false }) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: flat, side });
  const key = `veg-${sway}-${swayBase}-${flat}-${side}-${fade ? 'f' : 'n'}-${keepNormal}`;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uWind = shared.uWind;
    if (fade) shader.uniforms.uFade = fade;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float tintMask;
uniform float uTime;
uniform float uWind;
${fade ? 'uniform vec2 uFade;' : ''}`,
      )
      .replace(
        '#include <color_vertex>',
        `vColor = vec4(1.0);
#ifdef USE_COLOR
vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, tintMask);
#endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
vec3 instWorld = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
${
  sway > 0
    ? `float swayAmt = ${sway.toFixed(4)} * uWind * max(position.y - ${swayBase.toFixed(3)}, 0.0);
float ph = uTime * 1.7 + instWorld.x * 0.21 + instWorld.z * 0.17;
transformed.x += sin(ph) * swayAmt;
transformed.z += cos(ph * 0.83) * swayAmt * 0.7;`
    : ''
}
${
  fade
    ? `float fadeK = 1.0 - smoothstep(uFade.x, uFade.y, distance(instWorld.xz, cameraPosition.xz));
transformed *= fadeK;`
    : ''
}
#endif`,
      );
    if (keepNormal) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''),
      );
    }
  };
  m.customProgramCacheKey = () => key;
  return m;
}
