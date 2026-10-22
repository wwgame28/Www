// Вода: сетка вокруг игрока с волнами в вершинном шейдере. Глубина под каждой точкой — из карты высот
// дна (heightfield.js): по ней свет поглощается по каналам (красный гаснет первым — бирюзовое мелководье,
// тёмно-синяя глубина), дно просвечивает. Отражение — небо из таблицы рассеяния по Френелю,
// блики солнца, пена у берега. Смешивание с предумноженной альфой: дно под водой уже нарисовано.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { WAVES_GLSL, shared } from './materials.js';
import { atmo, SKY_UV_GLSL, CLOUD_GLSL } from './atmosphere.js';

const W = CONFIG.water;
const v3 = (a) => `vec3(${a.map((x) => x.toFixed(4)).join(', ')})`;

const vertex = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormalW;
#include <fog_pars_vertex>
${WAVES_GLSL}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.y += waveHeight(wp.xz, uTime);
  vec2 g = waveGrad(wp.xz, uTime);
  vNormalW = normalize(vec3(-g.x, 1.0, -g.y));
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const fragment = /* glsl */ `
uniform float uTime;
uniform float uSea;
uniform sampler2D uWaterNormal;
uniform sampler2D uHeightfield;
uniform float uHeightSpan;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec2 uWindDir;
varying vec3 vWorld;
varying vec3 vNormalW;
#include <common>
#include <fog_pars_fragment>
#ifndef USE_FOG
uniform sampler2D uSkyLUT;
${SKY_UV_GLSL}
#endif
${CLOUD_GLSL}
const vec3 ABSORB = ${v3(W.absorption)};
const vec3 SCATTER = ${v3(W.scatter)};
vec3 waterN(vec2 uv) {
  vec3 t = texture(uWaterNormal, uv).rgb;
  return vec3(t.r * 2.0 - 1.0, t.b, t.g * 2.0 - 1.0);
}
void main() {
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  // рябь: две карты нормалей, бегущие по ветру с разной скоростью; вдали слабее (без мерцания)
  vec2 wd = uWindDir;
  vec3 n1 = waterN(vWorld.xz / ${W.normalScale[0].toFixed(2)} + wd * uTime * 0.045);
  vec3 n2 = waterN(vec2(vWorld.x * 0.8 - vWorld.z * 0.6, vWorld.x * 0.6 + vWorld.z * 0.8) / ${W.normalScale[1].toFixed(2)} - wd.yx * uTime * 0.021);
  float detail = ${W.normalStrength.toFixed(3)} * mix(1.0, 0.3, smoothstep(25.0, 260.0, dist));
  vec3 N = normalize(vNormalW + vec3(n1.x + n2.x, 0.0, n1.z + n2.z) * detail);
  bool under = !gl_FrontFacing;
  if (under) N = -N;

  // глубина под точкой (вертикальная) и путь луча в толще
  vec2 rel = vWorld.xz - cameraPosition.xz;
  bool known = max(abs(rel.x), abs(rel.y)) < uHeightSpan * 0.47;
  float ground = known ? texture(uHeightfield, vWorld.xz / uHeightSpan).r : -40.0;
  float depth = max(uSea - ground, 0.0);
  float path = depth / max(abs(V.y), 0.12) * 0.85;
  vec3 T = exp(-ABSORB * path);

  // свет, падающий в воду: солнце (или луна) с тенью облаков плюс небо сверху
  float shade = cloudShadow(vWorld);
  vec3 skyTop = texture(uSkyLUT, skyUV(vec3(0.0, 1.0, 0.0))).rgb;
  vec3 Ein = uLightColor * max(uLightDir.y, 0.0) * shade + skyTop * 2.4;
  // однократное рассеяние в толще: альбедо однородной среды × освещённость
  vec3 albedo = SCATTER / (ABSORB + SCATTER);
  vec3 body = albedo * Ein * (1.0 / 3.14159) * (1.0 - T);

  // отражение неба и солнечные блики
  float ndv = max(dot(N, V), 0.0);
  float F = 0.02 + 0.98 * pow(max(1.0 - ndv, 0.0), 5.0);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  vec3 refl = texture(uSkyLUT, skyUV(normalize(R))).rgb;
  float rl = max(dot(R, uLightDir), 0.0);
  vec3 glint = uLightColor * shade * (pow(rl, 1400.0) * 60.0 + pow(rl, 160.0) * 2.0) * F * 4.0;

  // пена: у кромки и на мелководье, рваными пятнами, бегущими к берегу
  float foam = 0.0;
  if (known && depth < ${(W.foamDepth * 3).toFixed(2)}) {
    float edge = 1.0 - smoothstep(0.0, ${W.foamDepth.toFixed(3)}, depth);
    float waves = 0.5 + 0.5 * sin(depth * 9.0 - uTime * 2.2 + texture(uNoiseTex, vWorld.xz * 0.05).r * 6.0);
    float n = texture(uNoiseTex, vWorld.xz * 0.21 + vec2(uTime * 0.013, -uTime * 0.009)).g;
    foam = clamp(edge * 1.2 - n * 0.9 + waves * edge * 0.35, 0.0, 1.0) * smoothstep(0.0, 0.06, depth);
  }
  vec3 foamCol = Ein * 0.26;

  vec3 col = refl * F + body * (1.0 - F) + glint;
  float alpha = 1.0 - (1.0 - F) * (T.r + T.g + T.b) / 3.0;
  col = mix(col, foamCol, foam);
  alpha = mix(alpha, 1.0, foam);
  if (under) {
    col = albedo * Ein * 0.25;
    alpha = 0.92;
  }
  // мягкий край у самого берега: вода не обрывается жёсткой линией
  if (known) alpha *= smoothstep(0.0, 0.08, depth + 0.02);
  alpha = clamp(alpha, 0.0, 1.0);
  #ifdef USE_FOG
  col = applyAtmoFog(col / max(alpha, 1e-3)) * alpha;
  #endif
  #if defined( TONE_MAPPING )
  col = toneMapping(col / max(alpha, 1e-3)) * alpha;
  #endif
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

export class Water {
  constructor(scene, heightfield) {
    this.segments = 140;
    this.size = 1000;
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    Object.assign(this.uniforms, atmo, heightfield.uniforms, {
      uTime: shared.uTime,
      uSea: shared.uSea,
      uWindDir: shared.uWindDir,
      uWaterNormal: { value: null },
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(this.makeGeometry(this.size), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }

  setTextures(tex) {
    this.uniforms.uWaterNormal.value = tex.waterNormal;
  }

  // Сетка гуще у центра: квадраты растут к краю (волны рядом — подробные, вдали — дешёвые)
  makeGeometry(size) {
    const n = this.segments;
    const g = new THREE.PlaneGeometry(2, 2, n, n);
    g.rotateX(-Math.PI / 2);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.max(Math.abs(x), Math.abs(z));
      const k = r > 0 ? (Math.pow(r, 1.8) / r) * (size / 2) : 0;
      p.setXYZ(i, x * k, 0, z * k);
    }
    g.computeBoundingSphere();
    return g;
  }

  setSize(viewMeters) {
    const size = Math.ceil((viewMeters + 80) * 2);
    if (Math.abs(size - this.size) < 1) return;
    this.size = size;
    this.mesh.geometry.dispose();
    this.mesh.geometry = this.makeGeometry(size);
  }

  update(focus) {
    // сдвиг сетки шагом ближних клеток — волны не «плывут» вместе с игроком
    const cell = Math.max(0.5, (this.size / 2) * Math.pow(1 / this.segments, 1.8) * 2);
    this.mesh.position.set(Math.round(focus.x / cell) * cell, CONFIG.world.seaLevel, Math.round(focus.z / cell) * cell);
  }
}
