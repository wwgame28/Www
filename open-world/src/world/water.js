// Вода: одна полупрозрачная плоскость вокруг игрока с волнами в вершинном шейдере.
// Глубину «рисует» сам рельеф под водой (тёмный цвет дна), прибой — шейдер земли.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { WAVES_GLSL, shared } from './materials.js';

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
uniform vec3 uWater;
uniform vec3 uSky;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunVis;
uniform float uOpacity;
varying vec3 vWorld;
varying vec3 vNormalW;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec2 rip = vec2(
    sin(vWorld.x * 0.9 + vWorld.z * 0.3 + uTime * 2.1) + sin(vWorld.z * 1.7 - uTime * 1.4) * 0.5,
    cos(vWorld.z * 1.1 - vWorld.x * 0.4 + uTime * 1.7) + cos(vWorld.x * 1.9 + uTime * 1.2) * 0.5
  ) * 0.035;
  vec3 N = normalize(vNormalW + vec3(rip.x, 0.0, rip.y));
  if (!gl_FrontFacing) N = -N;
  float ndv = max(dot(N, V), 0.0);
  float fres = pow(1.0 - ndv, 4.0);
  vec3 R = reflect(-V, N);
  vec3 refl = mix(uHorizon, uSky, clamp(R.y * 1.6, 0.0, 1.0));
  vec3 col = mix(uWater, refl, 0.18 + 0.7 * fres);
  float spec = pow(max(dot(reflect(-uSunDir, N), V), 0.0), 140.0) * uSunVis;
  col += uSunColor * spec * 1.6;
  float alpha = mix(uOpacity, 0.96, fres) + spec * 0.5;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class Water {
  constructor(scene) {
    this.segments = 120;
    this.size = 1000;
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uWater: { value: new THREE.Color('#2a76a8') },
        uSky: { value: new THREE.Color('#3d82dd') },
        uHorizon: { value: new THREE.Color('#c2e1ff') },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color('#ffffff') },
        uSunVis: { value: 1 },
        uOpacity: { value: 0.62 },
      },
    ]);
    this.uniforms.uTime = shared.uTime;
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    this.mesh = new THREE.Mesh(this.makeGeometry(this.size), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }

  makeGeometry(size) {
    const g = new THREE.PlaneGeometry(size, size, this.segments, this.segments);
    g.rotateX(-Math.PI / 2);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    return g;
  }

  setSize(viewMeters) {
    const size = Math.ceil((viewMeters + 80) * 2);
    if (Math.abs(size - this.size) < 1) return;
    this.size = size;
    this.mesh.geometry.dispose();
    this.mesh.geometry = this.makeGeometry(size);
  }

  update(focus, sky) {
    const cell = this.size / this.segments;
    this.mesh.position.set(Math.round(focus.x / cell) * cell, CONFIG.world.seaLevel, Math.round(focus.z / cell) * cell);
    const u = this.uniforms;
    u.uWater.value.copy(sky.cur.water);
    u.uSky.value.copy(sky.cur.top);
    u.uHorizon.value.copy(sky.cur.horizon);
    u.uSunDir.value.copy(sky.sunDir);
    u.uSunColor.value.copy(sky.cur.sun);
    u.uSunVis.value = sky.uniforms.uSunVis.value;
  }
}
