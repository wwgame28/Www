// Растительность и камни: процедурные low-poly модели и InstancedMesh на каждый тип.
// Деревья, камни и цветы — общие меши на весь мир (пересобираются при переходе между чанками),
// трава — свой InstancedMesh на ближний чанк (отсекается по видимости камеры).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { createVegMaterial, shared } from './materials.js';

const S = CONFIG.world.chunkSize;

function lin(hex) {
  return new THREE.Color(hex);
}

// Часть модели: без uv, без индексов, с цветом вершин и маской окраски
function part(geo, color, tint, { pos = null, rot = null, scale = null, colorFn = null } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const m = new THREE.Matrix4();
  m.compose(
    pos ? new THREE.Vector3(...pos) : new THREE.Vector3(),
    rot ? new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)) : new THREE.Quaternion(),
    scale ? new THREE.Vector3(...scale) : new THREE.Vector3(1, 1, 1),
  );
  g.applyMatrix4(m);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const tm = new Float32Array(p.count);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let t = tint;
    if (colorFn) t = colorFn(p.getX(i), p.getY(i), p.getZ(i), c);
    else c.copy(color);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    tm[i] = t;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('tintMask', new THREE.BufferAttribute(tm, 1));
  return g;
}

function merge(parts) {
  const g = mergeGeometries(parts, false);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const WHITE = lin('#ffffff');
const grey = (k) => new THREE.Color(k, k, k);

// Камень: икосаэдр с детерминированными вмятинами (по позиции вершины, без трещин)
function rockGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    const k = 0.78 + 0.34 * (h - Math.floor(h));
    p.setXYZ(i, x * k, Math.max(y * k, -0.35), z * k);
  }
  return merge([part(g, WHITE, 1, { colorFn: (x, y, z, c) => (c.copy(grey(y > 0.2 ? 1.06 : 0.9)), 1) })]);
}

function buildGeometries() {
  const trunk = lin('#6b4a32');
  const bark = lin('#7a5a3e');
  const birchBark = lin('#e9e4d8');
  const palmBark = lin('#a27c50');
  const snow = lin('#f4f7fb');
  const near = {};
  const far = {};

  near.pine = merge([
    part(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 5), trunk, 0, { pos: [0, 1.1, 0] }),
    part(new THREE.ConeGeometry(2.1, 3, 7), grey(0.82), 1, { pos: [0, 2.9, 0] }),
    part(new THREE.ConeGeometry(1.6, 2.6, 7), grey(0.94), 1, { pos: [0, 4.2, 0], rot: [0, 0.4, 0] }),
    part(new THREE.ConeGeometry(1.05, 2.2, 7), grey(1.06), 1, { pos: [0, 5.4, 0], rot: [0, 0.9, 0] }),
  ]);
  far.pine = merge([part(new THREE.ConeGeometry(1.9, 5.6, 6, 1, true), grey(0.92), 1, { pos: [0, 3.9, 0] })]);

  const snowy = (yCut) => (x, y, z, c) => {
    if (y > yCut) {
      c.copy(snow);
      return 0;
    }
    c.copy(grey(0.9));
    return 1;
  };
  near.snowPine = merge([
    part(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 5), trunk, 0, { pos: [0, 1.1, 0] }),
    part(new THREE.ConeGeometry(2.1, 3, 7, 2), WHITE, 1, { pos: [0, 2.9, 0], colorFn: snowy(3.1) }),
    part(new THREE.ConeGeometry(1.6, 2.6, 7, 2), WHITE, 1, { pos: [0, 4.2, 0], rot: [0, 0.4, 0], colorFn: snowy(4.3) }),
    part(new THREE.ConeGeometry(1.05, 2.2, 7, 2), WHITE, 1, { pos: [0, 5.4, 0], rot: [0, 0.9, 0], colorFn: snowy(5.2) }),
  ]);
  far.snowPine = merge([part(new THREE.ConeGeometry(1.9, 5.6, 6, 2, true), WHITE, 1, { pos: [0, 3.9, 0], colorFn: snowy(4.6) })]);

  near.oak = merge([
    part(new THREE.CylinderGeometry(0.22, 0.32, 2.6, 6), bark, 0, { pos: [0, 1.3, 0] }),
    part(new THREE.CylinderGeometry(0.1, 0.14, 1.2, 5), bark, 0, { pos: [0.45, 2.6, 0.1], rot: [0, 0, -0.7] }),
    part(new THREE.IcosahedronGeometry(1.75, 0), grey(0.9), 1, { pos: [0, 3.6, 0] }),
    part(new THREE.IcosahedronGeometry(1.3, 0), grey(1), 1, { pos: [1.0, 3.2, 0.45], rot: [0.3, 0.5, 0] }),
    part(new THREE.IcosahedronGeometry(1.2, 0), grey(1.08), 1, { pos: [-0.75, 4.2, -0.35], rot: [0.6, 0.2, 0.1] }),
  ]);
  far.oak = merge([
    part(new THREE.CylinderGeometry(0.2, 0.3, 2.4, 4, 1, true), bark, 0, { pos: [0, 1.2, 0] }),
    part(new THREE.OctahedronGeometry(2.2, 0), grey(0.98), 1, { pos: [0, 3.7, 0], scale: [1, 0.9, 1] }),
  ]);

  near.birch = merge([
    part(new THREE.CylinderGeometry(0.11, 0.17, 3.8, 5), birchBark, 0, { pos: [0, 1.9, 0] }),
    part(new THREE.IcosahedronGeometry(1.1, 0), grey(0.95), 1, { pos: [0, 4.5, 0], scale: [1, 1.55, 1] }),
    part(new THREE.IcosahedronGeometry(0.8, 0), grey(1.08), 1, { pos: [0.55, 3.7, 0.2], scale: [1, 1.3, 1] }),
  ]);
  far.birch = merge([
    part(new THREE.CylinderGeometry(0.1, 0.15, 3.4, 3, 1, true), birchBark, 0, { pos: [0, 1.7, 0] }),
    part(new THREE.OctahedronGeometry(1.25, 0), grey(1), 1, { pos: [0, 4.4, 0], scale: [1, 1.6, 1] }),
  ]);

  const palmParts = [];
  for (let i = 0; i < 4; i++) {
    palmParts.push(
      part(new THREE.CylinderGeometry(0.15, 0.19, 1.45, 6), palmBark, 0, {
        pos: [0.1 * i * i, 0.7 + 1.3 * i, 0],
        rot: [0, 0, -0.07 * i],
      }),
    );
  }
  const top = [0.95, 5.55, 0];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    palmParts.push(
      part(new THREE.ConeGeometry(0.42, 2.8, 3), grey(0.85 + 0.05 * (i % 3)), 1, {
        pos: [top[0] + Math.cos(a) * 1.15, top[1] - 0.25, top[2] + Math.sin(a) * 1.15],
        rot: [0, -a, Math.PI / 2 + 0.45],
        scale: [1, 1, 0.3],
      }),
    );
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    palmParts.push(
      part(new THREE.IcosahedronGeometry(0.16, 0), lin('#6b4b2a'), 0, {
        pos: [top[0] + Math.cos(a) * 0.22, top[1] - 0.35, top[2] + Math.sin(a) * 0.22],
      }),
    );
  }
  near.palm = merge(palmParts);
  far.palm = merge([
    part(new THREE.CylinderGeometry(0.15, 0.19, 5.2, 4, 1, true), palmBark, 0, { pos: [0.45, 2.6, 0], rot: [0, 0, -0.17] }),
    part(new THREE.OctahedronGeometry(1.9, 0), grey(0.9), 1, { pos: [0.95, 5.4, 0], scale: [1, 0.35, 1] }),
  ]);

  near.cactus = merge([
    part(new THREE.CylinderGeometry(0.32, 0.36, 2.8, 7), grey(1), 1, { pos: [0, 1.4, 0] }),
    part(new THREE.SphereGeometry(0.32, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), grey(1.05), 1, { pos: [0, 2.8, 0] }),
    part(new THREE.CylinderGeometry(0.17, 0.17, 0.6, 6), grey(0.95), 1, { pos: [0.5, 1.25, 0], rot: [0, 0, Math.PI / 2] }),
    part(new THREE.CylinderGeometry(0.19, 0.19, 1.0, 6), grey(1), 1, { pos: [0.8, 1.7, 0] }),
    part(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 6), grey(0.95), 1, { pos: [-0.45, 1.85, 0], rot: [0, 0, Math.PI / 2] }),
    part(new THREE.CylinderGeometry(0.17, 0.17, 0.75, 6), grey(1), 1, { pos: [-0.7, 2.2, 0] }),
    part(new THREE.ConeGeometry(0.12, 0.18, 5), lin('#ff7fb0'), 0, { pos: [0, 2.98, 0] }),
  ]);

  near.bush = merge([
    part(new THREE.IcosahedronGeometry(0.75, 0), grey(0.92), 1, { pos: [0, 0.45, 0], scale: [1.25, 0.8, 1.15] }),
    part(new THREE.IcosahedronGeometry(0.5, 0), grey(1.05), 1, { pos: [0.55, 0.35, 0.3] }),
    part(new THREE.IcosahedronGeometry(0.45, 0), grey(1), 1, { pos: [-0.45, 0.3, -0.35] }),
  ]);

  const twigs = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + (i % 2) * 0.3;
    const tilt = 0.45 + 0.12 * (i % 3);
    twigs.push(
      part(new THREE.ConeGeometry(0.05, 1.0 + 0.15 * (i % 3), 3), grey(1), 1, {
        pos: [Math.cos(a) * 0.22, 0.45, Math.sin(a) * 0.22],
        rot: [Math.sin(a) * tilt, 0, -Math.cos(a) * tilt],
      }),
    );
  }
  near.deadBush = merge(twigs);

  near.rock = rockGeometry();

  near.flower = merge([
    part(new THREE.CylinderGeometry(0.018, 0.022, 0.36, 3), lin('#4f8a3a'), 0, { pos: [0, 0.18, 0] }),
    part(new THREE.OctahedronGeometry(0.1, 0), grey(1), 1, { pos: [0, 0.39, 0], scale: [1, 0.55, 1] }),
    part(new THREE.IcosahedronGeometry(0.035, 0), lin('#ffe066'), 0, { pos: [0, 0.43, 0] }),
  ]);

  return { near, far };
}

// Пучок травы: четыре изогнутых треугольника-травинки, нормали смотрят вверх (мягкий свет)
function grassGeometry() {
  const pos = [];
  const col = [];
  const blades = 5;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + b * 0.9;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const off = 0.06 + 0.05 * (b % 2);
    const cx = ca * off;
    const cz = sa * off;
    const w = 0.05;
    const h = 0.3 + 0.07 * (b % 3);
    const lean = 0.13;
    // основание поперёк направления наклона
    pos.push(cx - sa * w, 0, cz + ca * w, cx + sa * w, 0, cz - ca * w, cx + ca * lean, h, cz + sa * lean);
    col.push(0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 1.08, 1.08, 1.08);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const n = pos.length / 3;
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(n).fill(0).flatMap(() => [0, 1, 0]), 3));
  g.setAttribute('tintMask', new THREE.Float32BufferAttribute(new Array(n).fill(1), 1));
  g.computeBoundingSphere();
  return g;
}

function createInstanced(geometry, material, capacity) {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

function markRange(attr, count) {
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, count * attr.itemSize);
  attr.needsUpdate = true;
}

// Группы типов: что и до какого расстояния показывать
const GROUP = {
  pine: 'tree',
  snowPine: 'tree',
  oak: 'tree',
  birch: 'tree',
  palm: 'tree',
  rock: 'rock',
  cactus: 'small',
  bush: 'small',
  deadBush: 'small',
  flower: 'flower',
};

export class Vegetation {
  constructor(scene) {
    this.scene = scene;
    const geos = buildGeometries();
    this.grassGeo = grassGeometry();
    this.materials = {
      treeNear: createVegMaterial({ sway: 0.028, swayBase: 1.6 }),
      treeFar: createVegMaterial({ fade: shared.uTreeFade }),
      rock: createVegMaterial({ fade: shared.uTreeFade }),
      small: createVegMaterial({ sway: 0.03, swayBase: 0.2, fade: shared.uSmallFade }),
      flower: createVegMaterial({ sway: 0.22, swayBase: 0.05, flat: false, fade: shared.uGrassFade }),
      grass: createVegMaterial({ sway: 0.28, swayBase: 0, flat: false, side: THREE.DoubleSide, fade: shared.uGrassFade, keepNormal: true }),
    };
    this.meshes = {};
    for (const [type, geo] of Object.entries(geos.near)) {
      const g = GROUP[type];
      const mat = g === 'tree' ? this.materials.treeNear : this.materials[g];
      this.meshes[type] = createInstanced(geo, mat, 512);
      scene.add(this.meshes[type]);
    }
    for (const [type, geo] of Object.entries(geos.far)) {
      const key = `${type}Far`;
      this.meshes[key] = createInstanced(geo, this.materials.treeFar, 1024);
      scene.add(this.meshes[key]);
    }
    this.grassPool = [];
    this.grassCapacity = Math.round(S / CONFIG.veg.grassCell) ** 2;
    this.shadows = false;
    this.counts = {};
    this.instances = 0;
  }

  setShadows(on) {
    this.shadows = on;
    for (const [key, mesh] of Object.entries(this.meshes)) {
      const big = !key.endsWith('Far') && key !== 'flower';
      mesh.castShadow = on && big;
      mesh.receiveShadow = false;
    }
  }

  ensureCapacity(key, need) {
    const mesh = this.meshes[key];
    if (mesh.instanceMatrix.count >= need) return mesh;
    let cap = mesh.instanceMatrix.count;
    while (cap < need) cap *= 2;
    const next = createInstanced(mesh.geometry, mesh.material, cap);
    next.castShadow = mesh.castShadow;
    this.scene.remove(mesh);
    mesh.dispose();
    this.scene.add(next);
    this.meshes[key] = next;
    return next;
  }

  // chunks: [{ cx, cz, dist, veg }] — пересобрать общие меши вокруг точки (ox, oz)
  rebuild(chunks, ox, oz, limits) {
    const plan = {};
    const add = (key, chunk, data) => {
      (plan[key] ||= { count: 0, list: [] }).list.push([chunk, data]);
      plan[key].count += data.count;
    };
    for (const ch of chunks) {
      const d = ch.dist;
      for (const [type, data] of Object.entries(ch.veg.types)) {
        if (!data.count) continue;
        const g = GROUP[type];
        if (g === 'tree') {
          if (d <= limits.treeNear) add(type, ch, data);
          else if (d <= limits.treeFar) add(`${type}Far`, ch, data);
        } else if (g === 'rock') {
          if (d <= limits.treeFar) add(type, ch, data);
        } else if (g === 'small') {
          if (d <= limits.smallFar) add(type, ch, data);
        } else if (g === 'flower') {
          if (d <= limits.flowerFar) add(type, ch, data);
        }
      }
    }
    let total = 0;
    for (const key of Object.keys(this.meshes)) {
      const p = plan[key];
      const need = p ? p.count : 0;
      const mesh = this.ensureCapacity(key, Math.max(need, 1));
      const M = mesh.instanceMatrix.array;
      const C = mesh.instanceColor.array;
      let k = 0;
      if (p) {
        for (const [ch, data] of p.list) {
          const dx = ch.cx * S - ox;
          const dz = ch.cz * S - oz;
          M.set(data.matrices, k * 16);
          C.set(data.colors, k * 3);
          for (let i = 0; i < data.count; i++) {
            const o = (k + i) * 16;
            M[o + 12] += dx;
            M[o + 14] += dz;
          }
          k += data.count;
        }
      }
      mesh.count = k;
      mesh.position.set(ox, 0, oz);
      mesh.updateMatrix();
      mesh.visible = k > 0;
      if (k > 0) {
        markRange(mesh.instanceMatrix, k);
        markRange(mesh.instanceColor, k);
      }
      this.counts[key] = k;
      total += k;
    }
    this.instances = total;
  }

  acquireGrass(cx, cz, data, minY, maxY) {
    let mesh = this.grassPool.pop();
    if (!mesh) {
      mesh = new THREE.InstancedMesh(this.grassGeo, this.materials.grass, this.grassCapacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.grassCapacity * 3), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.matrixAutoUpdate = false;
      mesh.boundingSphere = new THREE.Sphere();
    }
    const count = Math.min(data.count, this.grassCapacity);
    mesh.instanceMatrix.array.set(count === data.count ? data.matrices : data.matrices.subarray(0, count * 16));
    mesh.instanceColor.array.set(count === data.count ? data.colors : data.colors.subarray(0, count * 3));
    mesh.count = count;
    markRange(mesh.instanceMatrix, count);
    markRange(mesh.instanceColor, count);
    mesh.position.set(cx * S, 0, cz * S);
    mesh.updateMatrix();
    const half = S / 2;
    mesh.boundingSphere.center.set(half, (minY + maxY) / 2, half);
    mesh.boundingSphere.radius = Math.sqrt(half * half * 2 + ((maxY - minY) / 2 + 1) ** 2);
    this.scene.add(mesh);
    return mesh;
  }

  releaseGrass(mesh) {
    this.scene.remove(mesh);
    this.grassPool.push(mesh);
  }
}
