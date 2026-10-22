// Растительность и камни: модели из trees/forest.js, по InstancedMesh на форму и уровень детализации.
// Деревья: полная модель → упрощённая → импостер; кусты, кактусы и камни — два уровня;
// трава — пучки-карточки, свой InstancedMesh на каждый ближний чанк (отсекается по видимости камеры).
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  shared,
  createBarkMaterial,
  createLeafMaterial,
  createGrassMaterial,
  createRockMaterial,
  createPlantMaterial,
  createImpostorMaterial,
} from './materials.js';
import { buildEzForm, buildPalmForm, buildCactusForm, buildRockForm, bakeImpostors } from './trees/forest.js';

const S = CONFIG.world.chunkSize;
const TR = CONFIG.trees;
const AUTUMN = [4.2, 4.2, 4.2];

function createInstanced(geometry, material, capacity) {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  return mesh;
}

function markRange(attr, count) {
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, count * attr.itemSize);
  attr.needsUpdate = true;
}

// Пучок травы: три скрещённые карточки; нормали почти вверх и чуть наружу — мягкий свет, как у газона
function grassGeometry() {
  const pos = [];
  const nrm = [];
  const uv = [];
  const idx = [];
  const W = 1.05;
  const H = 0.62;
  for (let q = 0; q < 3; q++) {
    const a = (q / 3) * Math.PI + 0.3;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const base = pos.length / 3;
    for (const [u, v] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]) {
      const x = (u - 0.5) * W;
      pos.push(c * x, v * H, s * x);
      const n = new THREE.Vector3(c * (u - 0.5) * 0.7, 1, s * (u - 0.5) * 0.7).normalize();
      nrm.push(n.x, n.y, n.z);
      uv.push(u, v);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function impostorGeometry() {
  const g = new THREE.PlaneGeometry(1, 1);
  g.translate(0, 0.5, 0);
  g.deleteAttribute('uv');
  return g;
}

// Ячейка: один InstancedMesh, который может пересоздаваться при росте числа экземпляров
class Slot {
  constructor(scene, geometry, material, { cast = false, receive = false, capacity = 256 } = {}) {
    this.scene = scene;
    this.cast = cast;
    this.receive = receive;
    this.mesh = createInstanced(geometry, material, capacity);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = receive;
    scene.add(this.mesh);
    this.shadows = false;
  }

  setShadows(on) {
    this.shadows = on;
    this.mesh.castShadow = on && this.cast;
  }

  ensure(need) {
    const mesh = this.mesh;
    if (mesh.instanceMatrix.count >= need) return mesh;
    let cap = mesh.instanceMatrix.count;
    while (cap < need) cap *= 2;
    const next = createInstanced(mesh.geometry, mesh.material, cap);
    next.castShadow = mesh.castShadow;
    next.receiveShadow = mesh.receiveShadow;
    this.scene.remove(mesh);
    mesh.dispose();
    this.scene.add(next);
    this.mesh = next;
    return next;
  }

  dispose(disposeGeometry) {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    if (disposeGeometry) this.mesh.geometry.dispose();
  }
}

export class Vegetation {
  constructor(scene) {
    this.scene = scene;
    this.models = {};
    this.slots = [];
    this.materials = [];
    this.geometries = [];
    this.atlas = null;
    this.grassPool = [];
    this.grassGeo = grassGeometry();
    this.grassCapacity = Math.ceil(S / CONFIG.veg.grassCell) ** 2;
    this.grassMaterial = null;
    this.shadows = false;
    this.counts = {};
    this.instances = 0;
    this.tier = '';
  }

  // Модели и материалы: после загрузки текстур и при смене качества (меняется размер импостеров)
  build(renderer, assets, tier) {
    if (this.tier === tier) return;
    this.tier = tier;
    this.dispose();
    const t = assets.tex;
    const low = tier === 'low';
    const mat = (m) => (this.materials.push(m), m);
    const geo = (g) => (this.geometries.push(g), g);
    const bark = {
      Pine: mat(createBarkMaterial(t.barkPine, t.barkPineN)),
      Oak: mat(createBarkMaterial(t.barkOak, t.barkOakN)),
      Birch: mat(createBarkMaterial(t.barkBirch, t.barkBirchN, { roughness: 0.8 })),
    };
    const barkTex = { Pine: t.barkPine, Oak: t.barkOak, Birch: t.barkBirch };
    const leafTex = { Pine: t.leavesPine, Oak: t.leavesOak, Aspen: t.leavesAspen };
    const smallFade = shared.uSmallFade;
    const bakeList = [];
    const trees = [];

    for (const [sp, spec] of Object.entries(TR.species)) {
      spec.seeds.forEach((seed, i) => {
        const form = buildEzForm(spec, seed, true);
        geo(form.near);
        geo(form.mid);
        if (spec.small) {
          const b = spec.leaves ? mat(createBarkMaterial(barkTex[spec.bark], t[`bark${spec.bark}N`], { fade: smallFade })) : mat(createBarkMaterial(barkTex[spec.bark], t[`bark${spec.bark}N`], { fade: smallFade, tint: spec.barkTint }));
          const mats = spec.leaves ? [b, mat(createLeafMaterial(leafTex[spec.leaves], { fade: smallFade }))] : [b];
          this.addModel(`${sp}${i}`, 'small', { near: [low ? form.mid : form.near, mats], mid: [form.mid, mats] });
          return;
        }
        const leaves = mat(createLeafMaterial(leafTex[spec.leaves], { recolor: spec.recolor, snowy: spec.snowy }));
        const mats = [bark[spec.bark], leaves];
        const side = Math.max(form.radius * 2, form.height) * 1.06;
        const row = bakeList.length;
        bakeList.push({
          geo: form.near,
          side,
          parts: [
            { map: barkTex[spec.bark], alphaTest: 0 },
            { map: leafTex[spec.leaves], alphaTest: 0.5, recolor: spec.recolor, snowy: spec.snowy },
          ],
        });
        trees.push({ key: `${sp}${i}`, row, side, recolor: spec.recolor });
        this.addModel(`${sp}${i}`, 'tree', { near: [low ? form.mid : form.near, mats], mid: [form.mid, mats] });
        if (sp === 'oak') {
          const autumn = mat(createLeafMaterial(leafTex.Oak, { recolor: AUTUMN }));
          trees.push({ key: `oakAutumn${i}`, row, side, recolor: AUTUMN });
          this.addModel(`oakAutumn${i}`, 'tree', { near: [low ? form.mid : form.near, [bark.Oak, autumn]], mid: [form.mid, [bark.Oak, autumn]] });
        }
      });
    }

    // пальмы
    const palmBark = mat(createPlantMaterial(t.palmBark, { flex: 0.012, roughness: 0.9 }));
    const palmFrond = mat(createPlantMaterial(t.palmFrond, { alphaTest: 0.5, side: THREE.DoubleSide, translucency: 0.5, flex: 0.05, flutter: 0.025, roughness: 0.7, keepNormal: true }));
    for (let i = 0; i < CONFIG.veg.forms.palm; i++) {
      const seed = 4100 + i * 37;
      const near = buildPalmForm(seed, true);
      const mid = buildPalmForm(seed, false);
      geo(near.geo);
      geo(mid.geo);
      const side = Math.max(near.radius * 2, near.height) * 1.06;
      const row = bakeList.length;
      bakeList.push({ geo: near.geo, side, parts: [{ map: t.palmBark, alphaTest: 0 }, { map: t.palmFrond, alphaTest: 0.5 }] });
      trees.push({ key: `palm${i}`, row, side });
      this.addModel(`palm${i}`, 'tree', { near: [low ? mid.geo : near.geo, [palmBark, palmFrond]], mid: [mid.geo, [palmBark, palmFrond]] });
    }

    // кактусы и камни
    const cactusMat = mat(createPlantMaterial(t.cactus, { flex: 0, flutter: 0, roughness: 0.55, fade: smallFade }));
    for (let i = 0; i < CONFIG.veg.forms.cactus; i++) {
      const c = buildCactusForm(7300 + i * 59);
      geo(c.geo);
      this.addModel(`cactus${i}`, 'small', { near: [c.geo, [cactusMat]] });
    }
    const rockNear = mat(createRockMaterial(null));
    const rockFar = mat(createRockMaterial(shared.uTreeFade));
    for (let i = 0; i < CONFIG.veg.rockVariants; i++) {
      const near = buildRockForm(900 + i * 71, low ? TR.rock.detailFar + 1 : TR.rock.detailNear);
      const far = buildRockForm(900 + i * 71, TR.rock.detailFar);
      geo(near.geo);
      geo(far.geo);
      this.addModel(`rock${i}`, 'rock', { near: [near.geo, rockNear], mid: [far.geo, rockFar] });
    }

    // импостеры дальних деревьев
    this.atlas = bakeImpostors(renderer, bakeList, TR.impostor.size[tier] || 128);
    const quad = geo(impostorGeometry());
    for (const tr of trees) {
      const m = mat(createImpostorMaterial(this.atlas, tr.row, tr.side, { recolor: tr.recolor || null, fade: shared.uTreeFade }));
      this.models[tr.key].far = new Slot(this.scene, quad, m, { capacity: 256 });
      this.slots.push(this.models[tr.key].far);
    }

    this.grassMaterial = mat(createGrassMaterial(t.grass, shared.uGrassFade));
    for (const g of this.grassPool) g.material = this.grassMaterial;
    this.setShadows(this.shadows);
  }

  addModel(key, group, lods) {
    const model = { group, near: null, mid: null, far: null };
    for (const [lod, spec] of Object.entries(lods)) {
      if (!spec) continue;
      const [geometry, material] = spec;
      const near = lod === 'near';
      const slot = new Slot(this.scene, geometry, material, { cast: near, receive: group !== 'rock' || near });
      model[lod] = slot;
      this.slots.push(slot);
    }
    this.models[key] = model;
  }

  dispose() {
    for (const s of this.slots) s.dispose(false);
    this.slots = [];
    this.models = {};
    for (const m of this.materials) m.dispose();
    for (const g of this.geometries) g.dispose();
    this.materials = [];
    this.geometries = [];
    if (this.atlas) for (const rt of this.atlas.targets) rt.dispose();
    this.atlas = null;
  }

  setShadows(on) {
    this.shadows = on;
    for (const s of this.slots) s.setShadows(on);
    for (const g of this.grassPool) g.receiveShadow = on;
  }

  // chunks: [{ cx, cz, dist, veg }] — пересобрать общие меши вокруг точки (ox, oz)
  rebuild(chunks, ox, oz, limits) {
    const plan = new Map();
    const add = (slot, ch, data) => {
      let p = plan.get(slot);
      if (!p) plan.set(slot, (p = { count: 0, list: [] }));
      p.list.push([ch, data]);
      p.count += data.count;
    };
    for (const ch of chunks) {
      const d = ch.dist;
      for (const key in ch.veg.types) {
        const data = ch.veg.types[key];
        const m = this.models[key];
        if (!data.count || !m) continue;
        let slot = null;
        if (m.group === 'tree') slot = d <= limits.treeNear ? m.near : d <= limits.treeMid ? m.mid : d <= limits.treeFar ? m.far : null;
        else if (m.group === 'small') slot = d <= limits.smallNear ? m.near : d <= limits.smallFar ? m.mid || m.near : null;
        else slot = d <= limits.treeNear ? m.near : d <= limits.treeFar ? m.mid : null;
        if (slot) add(slot, ch, data);
      }
    }
    let total = 0;
    for (const slot of this.slots) {
      const p = plan.get(slot);
      const mesh = slot.ensure(Math.max(p ? p.count : 0, 1));
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
      total += k;
    }
    this.instances = total;
  }

  acquireGrass(cx, cz, data, minY, maxY) {
    let mesh = this.grassPool.pop();
    if (!mesh) {
      const g = this.grassGeo.clone();
      g.setAttribute('aVariant', new THREE.InstancedBufferAttribute(new Float32Array(this.grassCapacity), 1));
      g.attributes.aVariant.setUsage(THREE.DynamicDrawUsage);
      mesh = new THREE.InstancedMesh(g, this.grassMaterial, this.grassCapacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.grassCapacity * 3), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.matrixAutoUpdate = false;
      mesh.receiveShadow = this.shadows;
      mesh.boundingSphere = new THREE.Sphere();
    }
    mesh.material = this.grassMaterial;
    const count = Math.min(data.count, this.grassCapacity);
    mesh.instanceMatrix.array.set(count === data.count ? data.matrices : data.matrices.subarray(0, count * 16));
    mesh.instanceColor.array.set(count === data.count ? data.colors : data.colors.subarray(0, count * 3));
    const va = mesh.geometry.attributes.aVariant;
    va.array.set(count === data.count ? data.variants : data.variants.subarray(0, count));
    mesh.count = count;
    markRange(mesh.instanceMatrix, count);
    markRange(mesh.instanceColor, count);
    markRange(va, count);
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
