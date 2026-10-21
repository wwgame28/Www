// Потоковая загрузка мира: какие чанки нужны, в каком LOD, кто их считает и когда выгружать.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildChunkIndex, COLLIDER_STRIDE } from './chunkgen.js';
import { createTerrainMaterial } from './materials.js';

const S = CONFIG.world.chunkSize;
// числовой ключ чанка: без строк — без мусора для сборщика каждый кадр
const keyOf = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

function nearestDist(cx, cz, fx, fz) {
  const dx = Math.max(cx * S - fx, 0, fx - (cx + 1) * S);
  const dz = Math.max(cz * S - fz, 0, fz - (cz + 1) * S);
  return Math.sqrt(dx * dx + dz * dz);
}

export class ChunkManager {
  constructor(scene, vegetation) {
    this.scene = scene;
    this.veg = vegetation;
    this.material = createTerrainMaterial();
    this.indices = CONFIG.lod.segments.map((N) => new THREE.BufferAttribute(buildChunkIndex(N), 1));
    this.pools = CONFIG.lod.segments.map(() => []);
    this.chunks = new Map();
    this.queue = [];
    this.ready = [];
    this.jobs = new Map();
    this.nextId = 1;
    this.gen = 0;
    this.seed = 0;
    this.focus = { x: 0, z: 0, dirX: 0, dirZ: -1 };
    this.limits = { view: 384, lodScale: 1, vegDensity: 1, grassDensity: 1, treeNear: 100, treeFar: 320, smallFar: 90, flowerFar: 56 };
    this.vegDirty = true;
    this.vegTimer = 0;
    this.scanTimer = 0;
    this.scanAt = { x: NaN, z: NaN, dirX: 0, dirZ: 0 };
    this.vegOrigin = { x: NaN, z: NaN };
    this.stats = { loaded: 0, meshes: 0, queued: 0, inFlight: 0, lods: [0, 0, 0, 0, 0], genMs: 0, grass: 0 };
    this.workers = [];
    this.error = null;
    const n = Math.max(1, Math.min(CONFIG.streaming.workers, (navigator.hardwareConcurrency || 4) - 1));
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      const slot = { w, busy: 0 };
      w.onmessage = (e) => this.onMessage(slot, e.data);
      w.onerror = (e) => {
        this.error = e.message || 'worker error';
        console.error('Ошибка воркера генерации:', e.message || e);
      };
      this.workers.push(slot);
    }
  }

  // Новый сид: всё старое уходит в пулы, воркеры получают новый мир
  start(seed) {
    this.seed = seed;
    this.gen++;
    for (const ch of this.chunks.values()) this.release(ch);
    this.chunks.clear();
    this.queue.length = 0;
    this.ready.length = 0;
    for (const slot of this.workers) slot.w.postMessage({ type: 'init', seed, gen: this.gen });
    this.vegDirty = true;
    this.scanTimer = 0;
  }

  setLimits(q, viewChunks) {
    const prevVeg = this.limits.vegDensity;
    const prevGrass = this.limits.grassDensity;
    const view = viewChunks * S;
    const L = this.limits;
    L.view = view;
    L.lodScale = q.lodScale;
    L.vegDensity = q.vegDensity;
    L.grassDensity = q.grassDensity;
    L.treeFar = Math.min(q.treeFar, view * CONFIG.render.fogFarFactor);
    L.treeNear = Math.min(q.treeNear, L.treeFar);
    L.smallFar = Math.min(q.smallFar, L.treeFar);
    L.flowerFar = CONFIG.lod.distances[0] * q.lodScale;
    if (prevVeg !== L.vegDensity) {
      for (const ch of this.chunks.values()) {
        ch.veg = null;
        ch.vegPending = false;
      }
    }
    if (prevGrass !== L.grassDensity) {
      for (const ch of this.chunks.values()) if (ch.lod === 0) ch.lod = -2; // перезапросить LOD0 с новой травой
    }
    this.vegDirty = true;
    this.scanTimer = 0;
  }

  lodFor(d, current) {
    const D = CONFIG.lod.distances;
    const sc = this.limits.lodScale;
    let lod = D.length;
    for (let i = 0; i < D.length; i++) {
      if (d < D[i] * sc) {
        lod = i;
        break;
      }
    }
    // удаляясь, держим более детальный уровень ещё немного — без мигания на границе
    if (current >= 0 && lod > current && d < D[current] * sc + CONFIG.lod.hysteresis) return current;
    return lod;
  }

  update(dt, fx, fz, dirX, dirZ) {
    this.focus.x = fx;
    this.focus.z = fz;
    const len = Math.hypot(dirX, dirZ) || 1;
    this.focus.dirX = dirX / len;
    this.focus.dirZ = dirZ / len;
    // полный проход по сетке — только когда игрок сместился или повернулся, либо раз в 0,25 с
    this.scanTimer -= dt;
    const A = this.scanAt;
    const moved = Math.hypot(fx - A.x, fz - A.z);
    const turned = this.focus.dirX * A.dirX + this.focus.dirZ * A.dirZ < 0.97;
    if (!(moved < 1.5) || turned || this.scanTimer <= 0) {
      this.scanTimer = 0.25;
      A.x = fx;
      A.z = fz;
      A.dirX = this.focus.dirX;
      A.dirZ = this.focus.dirZ;
      this.schedule();
    }
    this.dispatch();
    this.applyReady();
    this.vegTimer -= dt;
    if (this.vegTimer <= 0) {
      this.vegTimer = CONFIG.streaming.vegRebuildSec;
      this.maybeRebuildVegetation();
      this.watchdog(performance.now());
    }
  }

  schedule() {
    const L = this.limits;
    const { x: fx, z: fz } = this.focus;
    const R = Math.ceil(L.view / S) + 1;
    const pcx = Math.floor(fx / S);
    const pcz = Math.floor(fz / S);
    const unloadAt = L.view + CONFIG.streaming.unloadMargin;

    for (const ch of this.chunks.values()) {
      ch.dist = nearestDist(ch.cx, ch.cz, fx, fz);
      if (ch.dist > unloadAt) {
        this.release(ch);
        this.chunks.delete(ch.key);
        this.vegDirty = true;
      }
    }

    for (let cz = pcz - R; cz <= pcz + R; cz++) {
      for (let cx = pcx - R; cx <= pcx + R; cx++) {
        const d = nearestDist(cx, cz, fx, fz);
        if (d > L.view) continue;
        const key = keyOf(cx, cz);
        let ch = this.chunks.get(key);
        if (!ch) {
          ch = { key, cx, cz, dist: d, lod: -1, mesh: null, pendingLod: -1, veg: null, vegPending: false, grass: null };
          this.chunks.set(key, ch);
        }
        const want = this.lodFor(d, ch.lod);
        ch.want = want;
        if (ch.lod !== want && ch.pendingLod !== want) this.enqueue(ch, 'terrain', want);
        if (!ch.veg && !ch.vegPending && d <= L.treeFar) this.enqueue(ch, 'veg', 0);
      }
    }
    // очередь: ближние и те, что впереди по взгляду, — первыми
    const { dirX, dirZ } = this.focus;
    for (const job of this.queue) {
      const ch = job.ch;
      const cx = (ch.cx + 0.5) * S - fx;
      const cz = (ch.cz + 0.5) * S - fz;
      const l = Math.hypot(cx, cz) || 1;
      const facing = Math.max(0, (cx * dirX + cz * dirZ) / l);
      job.prio = ch.dist - facing * 60 + (job.type === 'veg' ? 40 : 0) + (ch.mesh ? 90 : 0);
    }
    this.queue.sort((a, b) => a.prio - b.prio);
  }

  enqueue(ch, type, lod) {
    const existing = type === 'terrain' ? ch.qTerrain : ch.qVeg;
    if (existing && !existing.sent) {
      existing.lod = lod;
      if (type === 'terrain') ch.pendingLod = lod;
      return;
    }
    const job = { type, ch, lod, prio: 0, sent: false };
    if (type === 'terrain') {
      ch.qTerrain = job;
      ch.pendingLod = lod;
    } else {
      ch.qVeg = job;
      ch.vegPending = true;
    }
    this.queue.push(job);
  }

  dispatch() {
    const max = CONFIG.streaming.inFlightPerWorker;
    for (const slot of this.workers) {
      while (slot.busy < max && this.queue.length) {
        const job = this.queue.shift();
        const ch = job.ch;
        if (this.chunks.get(ch.key) !== ch) continue;
        job.sent = true;
        job.slot = slot;
        job.sentAt = performance.now();
        const id = this.nextId++;
        this.jobs.set(id, job);
        slot.busy++;
        if (job.type === 'terrain') {
          slot.w.postMessage({
            type: 'terrain',
            id,
            gen: this.gen,
            cx: ch.cx,
            cz: ch.cz,
            lod: job.lod,
            grass: job.lod === 0 ? this.limits.grassDensity : 0,
          });
        } else {
          slot.w.postMessage({ type: 'veg', id, gen: this.gen, cx: ch.cx, cz: ch.cz, density: this.limits.vegDensity });
        }
      }
    }
  }

  onMessage(slot, msg) {
    const job = this.jobs.get(msg.id);
    if (!job) return; // уже списано сторожем как потерянное
    slot.busy = Math.max(0, slot.busy - 1);
    this.jobs.delete(msg.id);
    if (msg.type === 'error') {
      console.error('Ошибка генерации чанка:', msg.message);
      this.forget(job);
      return;
    }
    if (msg.gen !== this.gen || msg.type === 'skip') return;
    this.stats.genMs = this.stats.genMs * 0.9 + (msg.ms || 0) * 0.1;
    this.ready.push({ job, msg });
  }

  // Задание без ответа: снять отметки «в работе», чтобы следующий проход запросил чанк заново
  forget(job) {
    const ch = job.ch;
    if (job.type === 'terrain') {
      if (ch.qTerrain === job) ch.qTerrain = null;
      if (ch.pendingLod === job.lod) ch.pendingLod = -1;
    } else {
      if (ch.qVeg === job) ch.qVeg = null;
      ch.vegPending = false;
    }
    this.scanTimer = 0;
  }

  // Сторож: ответ, который не пришёл за 15 с, считается потерянным
  watchdog(now) {
    for (const [id, job] of this.jobs) {
      if (now - job.sentAt < 15000) continue;
      this.jobs.delete(id);
      job.slot.busy = Math.max(0, job.slot.busy - 1);
      this.forget(job);
    }
  }

  applyReady() {
    const t0 = performance.now();
    const budget = CONFIG.streaming.applyBudgetMs;
    while (this.ready.length) {
      const { job, msg } = this.ready.shift();
      const ch = job.ch;
      const alive = this.chunks.get(ch.key) === ch;
      if (job.type === 'terrain') {
        if (ch.qTerrain === job) ch.qTerrain = null;
        if (ch.pendingLod === msg.lod) ch.pendingLod = -1;
        if (alive && (msg.lod === ch.want || !ch.mesh)) this.applyTerrain(ch, msg);
      } else {
        if (ch.qVeg === job) ch.qVeg = null;
        ch.vegPending = false;
        if (alive) {
          ch.veg = { types: msg.types, colliders: msg.colliders };
          this.vegDirty = true;
        }
      }
      if (performance.now() - t0 > budget) break;
    }
  }

  createMesh(lod) {
    const N = CONFIG.lod.segments[lod];
    const verts = (N + 1) * (N + 1) + 4 * (N + 1);
    const geo = new THREE.BufferGeometry();
    geo.setIndex(this.indices[lod]);
    for (const name of ['position', 'normal', 'color']) {
      const a = new THREE.BufferAttribute(new Float32Array(verts * 3), 3);
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
    }
    geo.boundingSphere = new THREE.Sphere();
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = true;
    mesh.userData.lod = lod;
    return mesh;
  }

  applyTerrain(ch, r) {
    const lod = r.lod;
    const mesh = this.pools[lod].pop() || this.createMesh(lod);
    const geo = mesh.geometry;
    geo.attributes.position.array.set(r.positions);
    geo.attributes.normal.array.set(r.normals);
    geo.attributes.color.array.set(r.colors);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    const half = S / 2;
    geo.boundingSphere.center.set(half, (r.minY + r.maxY) / 2, half);
    geo.boundingSphere.radius = Math.sqrt(half * half * 2 + ((r.maxY - r.minY) / 2) ** 2) + 0.5;
    mesh.position.set(ch.cx * S, 0, ch.cz * S);
    mesh.updateMatrix();
    if (ch.mesh) {
      this.scene.remove(ch.mesh);
      this.pools[ch.mesh.userData.lod].push(ch.mesh);
    }
    this.scene.add(mesh);
    ch.mesh = mesh;
    ch.lod = lod;
    ch.minY = r.minY;
    ch.maxY = r.maxY;
    if (ch.grass) {
      this.veg.releaseGrass(ch.grass);
      ch.grass = null;
    }
    if (r.grass && r.grass.count > 0) ch.grass = this.veg.acquireGrass(ch.cx, ch.cz, r.grass, r.minY, r.maxY);
  }

  release(ch) {
    if (ch.mesh) {
      this.scene.remove(ch.mesh);
      this.pools[ch.mesh.userData.lod].push(ch.mesh);
      ch.mesh = null;
    }
    if (ch.grass) {
      this.veg.releaseGrass(ch.grass);
      ch.grass = null;
    }
    if (ch.qTerrain && !ch.qTerrain.sent) this.queue.splice(this.queue.indexOf(ch.qTerrain), 1);
    if (ch.qVeg && !ch.qVeg.sent) this.queue.splice(this.queue.indexOf(ch.qVeg), 1);
    ch.qTerrain = null;
    ch.qVeg = null;
    ch.veg = null;
  }

  // Пересборка нужна, только когда чанк сменил «ступень» видимости растительности
  // (ближние деревья / дальние / мелочь / цветы) или пришли и ушли данные
  vegBand(d) {
    const L = this.limits;
    return (d <= L.treeNear ? 1 : 0) | (d <= L.treeFar ? 2 : 0) | (d <= L.smallFar ? 4 : 0) | (d <= L.flowerFar ? 8 : 0);
  }

  maybeRebuildVegetation() {
    const { x: fx, z: fz } = this.focus;
    let changed = this.vegDirty;
    for (const ch of this.chunks.values()) {
      if (!ch.veg) continue;
      const band = this.vegBand(ch.dist);
      if (band !== ch.vegBand) {
        ch.vegBand = band;
        changed = true;
      }
    }
    // далеко от начала координат пересборки — обновить его ради точности float32
    const moved = Math.hypot(fx - this.vegOrigin.x, fz - this.vegOrigin.z);
    if (!changed && !(moved > 2048)) return;
    const list = [];
    for (const ch of this.chunks.values()) if (ch.veg) list.push(ch);
    const ox = Math.floor(fx / S) * S;
    const oz = Math.floor(fz / S) * S;
    this.veg.rebuild(list, ox, oz, this.limits);
    this.vegOrigin.x = fx;
    this.vegOrigin.z = fz;
    this.vegDirty = false;
  }

  // Препятствия (стволы, кактусы, валуны) в радиусе r от точки — для коллизий игрока
  collidersNear(x, z, out) {
    out.length = 0;
    const cx0 = Math.floor((x - 4) / S);
    const cx1 = Math.floor((x + 4) / S);
    const cz0 = Math.floor((z - 4) / S);
    const cz1 = Math.floor((z + 4) / S);
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const ch = this.chunks.get(keyOf(cx, cz));
        if (!ch || !ch.veg) continue;
        const c = ch.veg.colliders;
        const ox = cx * S;
        const oz = cz * S;
        for (let i = 0; i < c.length; i += COLLIDER_STRIDE) {
          const wx = ox + c[i];
          const wz = oz + c[i + 1];
          if (Math.abs(wx - x) > 6 || Math.abs(wz - z) > 6) continue;
          out.push(wx, wz, c[i + 2], c[i + 3], c[i + 4]);
        }
      }
    }
    return out;
  }

  // Готов ли мир вокруг точки (для экрана загрузки): доля чанков с мешем в радиусе r
  readiness(x, z, r) {
    let need = 0;
    let have = 0;
    for (const ch of this.chunks.values()) {
      if (nearestDist(ch.cx, ch.cz, x, z) > r) continue;
      need++;
      if (ch.mesh) have++;
    }
    const center = this.chunks.get(keyOf(Math.floor(x / S), Math.floor(z / S)));
    const centerReady = center && center.lod === 0 && center.veg;
    if (!need) return 0;
    return centerReady ? have / need : Math.min(0.95, have / need);
  }

  collectStats() {
    const s = this.stats;
    s.loaded = this.chunks.size;
    s.queued = this.queue.length;
    s.inFlight = this.jobs.size;
    s.lods.fill(0);
    let meshes = 0;
    let grass = 0;
    for (const ch of this.chunks.values()) {
      if (ch.mesh) {
        meshes++;
        s.lods[ch.mesh.userData.lod]++;
      }
      if (ch.grass) grass += ch.grass.count;
    }
    s.meshes = meshes;
    s.grass = grass;
    s.workers = this.workers.length;
    return s;
  }
}
