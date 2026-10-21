// Облака: несколько low-poly «комков» на высоте 150–230 м, плывут по ветру и повторяются плиткой вокруг игрока.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, mixSeed } from './noise.js';

const MAX = 40;

const vertex = /* glsl */ `
uniform vec3 uCam;
uniform float uRadius;
varying float vLight;
varying float vFade;
varying float vDist;
uniform vec3 uSunDir;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vLight = 0.55 + 0.45 * max(dot(n, normalize(uSunDir + vec3(0.0, 0.6, 0.0))), 0.0) + 0.15 * n.y;
  vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vDist = length(center.xz - uCam.xz);
  vFade = 1.0 - smoothstep(uRadius * 0.75, uRadius, vDist);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const fragment = /* glsl */ `
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec3 uHorizon;
uniform float uRadius;
varying float vLight;
varying float vFade;
varying float vDist;
void main() {
  vec3 col = mix(uShade, uLit, clamp(vLight, 0.0, 1.0));
  col = mix(col, uHorizon, smoothstep(uRadius * 0.25, uRadius, vDist) * 0.75);
  gl_FragColor = vec4(col, vFade * 0.92);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function cloudGeometry() {
  const parts = [];
  const rand = mulberry32(7);
  for (let i = 0; i < 6; i++) {
    const r = 14 + rand() * 14;
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1, 0.42, 1);
    g.translate((rand() - 0.5) * 70, (rand() - 0.3) * 6, (rand() - 0.5) * 34);
    g.deleteAttribute('uv');
    parts.push(g);
  }
  const g = mergeGeometries(parts, false);
  g.computeVertexNormals();
  return g;
}

export class Clouds {
  constructor(scene) {
    this.uniforms = {
      uCam: { value: new THREE.Vector3() },
      uRadius: { value: 900 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uLit: { value: new THREE.Color('#ffffff') },
      uShade: { value: new THREE.Color('#c9d6ea') },
      uHorizon: { value: new THREE.Color('#c2e1ff') },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.InstancedMesh(cloudGeometry(), mat, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 12;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.base = [];
    this.drift = 0;
    this.count = 0;
    this.tile = 1800;
    this.white = new THREE.Color(1, 1, 1);
    this.night = new THREE.Color(0.05, 0.065, 0.12);
    this.tmp = new THREE.Color();
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
  }

  setSeed(seed) {
    const rand = mulberry32(mixSeed(seed, 900));
    this.base = [];
    for (let i = 0; i < MAX; i++) {
      this.base.push({
        u: rand(),
        v: rand(),
        y: 150 + rand() * 80,
        s: 0.7 + rand() * 1.1,
        rot: rand() * Math.PI * 2,
      });
    }
  }

  configure(count, view) {
    this.count = Math.min(MAX, count);
    const r = Math.max(view * 1.6, 700);
    this.uniforms.uRadius.value = r;
    this.tile = Math.max(1800, 2 * r + 200);
  }

  update(dt, cam, sky) {
    this.drift += dt * 3.5;
    const u = this.uniforms;
    u.uCam.value.copy(cam);
    u.uSunDir.value.copy(sky.elevation > -0.05 ? sky.sunDir : sky.moonDir);
    const day = sky.daylight;
    this.tmp.copy(sky.cur.sun).lerp(this.white, 0.55);
    u.uLit.value.copy(this.night).lerp(this.tmp, day);
    u.uShade.value.copy(u.uLit.value).multiplyScalar(0.72).lerp(sky.cur.top, 0.25);
    u.uHorizon.value.copy(sky.cur.horizon);
    const R = u.uRadius.value;
    let n = 0;
    for (let i = 0; i < this.count; i++) {
      const b = this.base[i];
      const T = this.tile;
      const half = T / 2;
      const wx = cam.x + ((((b.u * T + this.drift - cam.x + half) % T) + T) % T) - half;
      const wz = cam.z + ((((b.v * T + this.drift * 0.35 - cam.z + half) % T) + T) % T) - half;
      if (Math.hypot(wx - cam.x, wz - cam.z) > R) continue;
      this.v.set(wx, b.y, wz);
      this.q.setFromAxisAngle(this.up, b.rot);
      this.s.setScalar(b.s);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
