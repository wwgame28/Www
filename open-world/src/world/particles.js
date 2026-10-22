// Частицы из пула: пыль при приземлении, всплески воды, облачка песка и снега под ногами.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { atmo } from './atmosphere.js';

const vertex = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(-mvPosition.z, 0.1);
  vAlpha = aAlpha;
  vColor = color;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const fragment = /* glsl */ `
uniform vec3 uLightDir;
uniform vec3 uLightColor;
varying float vAlpha;
varying vec3 vColor;
#include <fog_pars_fragment>
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.15, d) * vAlpha;
  if (a < 0.01) discard;
  // пылинки освещены как матовая поверхность: солнце сверху-сбоку плюс доля рассеянного света
  vec3 light = uLightColor * (max(uLightDir.y, 0.0) * 0.8 + 0.2) / 3.14159;
  gl_FragColor = vec4(vColor * light * 1.6, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Particles {
  constructor(scene) {
    const max = CONFIG.particles.max;
    this.max = max;
    this.items = [];
    for (let i = 0; i < max; i++) this.items.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, ttl: 1, size: 1, g: 0, r: 1, gg: 1, b: 1 });
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    const attr = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', attr(this.pos, 3));
    geo.setAttribute('color', attr(this.col, 3));
    geo.setAttribute('aSize', attr(this.size, 1));
    geo.setAttribute('aAlpha', attr(this.alpha, 1));
    geo.setDrawRange(0, 0);
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 400 } }]);
    Object.assign(this.uniforms, atmo);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vertex.replace('void main() {', '#include <fog_pars_vertex>\nvoid main() {'),
      fragmentShader: fragment,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
    this.color = new THREE.Color();
    this.enabled = true;
  }

  setViewportHeight(h, fovDeg) {
    this.uniforms.uScale.value = h / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  // opts: { color, count, speed, up, life, size, gravity, spread }
  emit(x, y, z, opts) {
    if (!this.enabled) return;
    this.color.set(opts.color);
    const n = opts.count;
    let made = 0;
    for (const p of this.items) {
      if (made >= n) break;
      if (p.alive) continue;
      const a = Math.random() * Math.PI * 2;
      const s = opts.speed * (0.4 + Math.random() * 0.6);
      const spread = opts.spread ?? 0.3;
      p.alive = true;
      p.x = x + Math.cos(a) * spread * Math.random();
      p.y = y + 0.05;
      p.z = z + Math.sin(a) * spread * Math.random();
      p.vx = Math.cos(a) * s;
      p.vz = Math.sin(a) * s;
      p.vy = opts.up * (0.6 + Math.random() * 0.6);
      p.ttl = opts.life * (0.7 + Math.random() * 0.6);
      p.life = p.ttl;
      p.size = opts.size * (0.7 + Math.random() * 0.6);
      p.g = opts.gravity ?? 6;
      const v = 0.9 + Math.random() * 0.2;
      p.r = this.color.r * v;
      p.gg = this.color.g * v;
      p.b = this.color.b * v;
      made++;
    }
  }

  update(dt) {
    let k = 0;
    for (const p of this.items) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy -= p.g * dt;
      const drag = Math.max(0, 1 - 2.5 * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = p.life / p.ttl;
      this.pos[k * 3] = p.x;
      this.pos[k * 3 + 1] = p.y;
      this.pos[k * 3 + 2] = p.z;
      this.col[k * 3] = p.r;
      this.col[k * 3 + 1] = p.gg;
      this.col[k * 3 + 2] = p.b;
      this.size[k] = p.size * (1.3 - 0.5 * t);
      this.alpha[k] = Math.min(1, t * 2.2) * 0.85;
      k++;
    }
    const geo = this.points.geometry;
    geo.setDrawRange(0, k);
    if (k > 0) {
      for (const name of ['position', 'color', 'aSize', 'aAlpha']) {
        const a = geo.attributes[name];
        a.clearUpdateRanges();
        a.addUpdateRange(0, k * a.itemSize);
        a.needsUpdate = true;
      }
    }
    this.points.visible = k > 0;
  }
}
