// Генерация данных чанка: сетка рельефа с LOD, трава, деревья, камни, цветы, препятствия.
// Запускается в Web Worker; без three.js, поэтому проверяется и в Node-тестах.
import { CONFIG } from '../config.js';
import { hash2i, mixSeed } from './noise.js';
import { BIOMES, hexToLinear } from './terrain.js';

const S = CONFIG.world.chunkSize;
const SEA = CONFIG.world.seaLevel;

const VC = {};
for (const [k, v] of Object.entries(CONFIG.vegColors)) {
  if (Array.isArray(v)) VC[k] = v.map(hexToLinear);
  else VC[k] = Object.fromEntries(Object.entries(v).map(([b, hex]) => [b, hexToLinear(hex)]));
}

// Поля на сетке N×N клеток с рамкой в одну точку (для нормалей у края)
function sampleGrid(terrain, cx, cz, N) {
  const step = S / N;
  const G = N + 3;
  const H = new Float64Array(G * G);
  const C = new Float32Array(G * G);
  const M = new Float32Array(G * G);
  const J = new Float32Array(G * G);
  const ox = cx * S;
  const oz = cz * S;
  const f = { h: 0, c: 0, moist: 0, mask: 0, jitter: 0 };
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      terrain.fields(ox + (i - 1) * step, oz + (j - 1) * step, f);
      const g = j * G + i;
      H[g] = f.h;
      C[g] = f.c;
      M[g] = f.moist;
      J[g] = f.jitter;
    }
  }
  const NY = new Float32Array(G * G);
  const NX = new Float32Array(G * G);
  const NZ = new Float32Array(G * G);
  for (let j = 1; j < G - 1; j++) {
    for (let i = 1; i < G - 1; i++) {
      const g = j * G + i;
      const nx = (H[g - 1] - H[g + 1]) / (2 * step);
      const nz = (H[g - G] - H[g + G]) / (2 * step);
      const inv = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
      NX[g] = nx * inv;
      NY[g] = inv;
      NZ[g] = nz * inv;
    }
  }
  return { N, G, step, ox, oz, H, C, M, J, NX, NY, NZ };
}

// Билинейное значение поля сетки в локальной точке чанка
function bilinear(grid, A, lx, lz) {
  const { G, step, N } = grid;
  const fx = Math.min(N - 1e-6, Math.max(0, lx / step));
  const fz = Math.min(N - 1e-6, Math.max(0, lz / step));
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const g = (j + 1) * G + (i + 1);
  const a = A[g] + (A[g + 1] - A[g]) * tx;
  const b = A[g + G] + (A[g + G + 1] - A[g + G]) * tx;
  return a + (b - a) * tz;
}

// Высота треугольника сетки (так же режет клетки, как индексный буфер)
function gridSurface(grid, lx, lz) {
  const { G, step, N, H } = grid;
  const fx0 = Math.min(N - 1e-6, Math.max(0, lx / step));
  const fz0 = Math.min(N - 1e-6, Math.max(0, lz / step));
  const i = Math.floor(fx0);
  const j = Math.floor(fz0);
  const fx = fx0 - i;
  const fz = fz0 - j;
  const g = (j + 1) * G + (i + 1);
  const hb = H[g + 1];
  const hc = H[g + G];
  if (fx + fz <= 1) {
    const ha = H[g];
    return ha + (hb - ha) * fx + (hc - ha) * fz;
  }
  const hd = H[g + G + 1];
  return hd + (hc - hd) * (1 - fx) + (hb - hd) * (1 - fz);
}

export function buildTerrainChunk(terrain, cx, cz, lod, grassDensity = 0) {
  const N = CONFIG.lod.segments[lod];
  const grid = sampleGrid(terrain, cx, cz, N);
  const { G, step, H, C, M, J, NX, NY, NZ, ox, oz } = grid;
  const E = N + 1;
  const V = E * E;
  const total = V + 4 * E;
  const positions = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const g = (j + 1) * G + (i + 1);
      const o = (j * E + i) * 3;
      const h = H[g];
      positions[o] = i * step;
      positions[o + 1] = h;
      positions[o + 2] = j * step;
      normals[o] = NX[g];
      normals[o + 1] = NY[g];
      normals[o + 2] = NZ[g];
      terrain.color(ox + i * step, oz + j * step, h, C[g], M[g], NY[g], J[g], colors, o);
      if (h < minY) minY = h;
      if (h > maxY) maxY = h;
    }
  }
  // «Юбки»: копия краёв, опущенная вниз, закрывает щели между соседями разных LOD
  const depth = CONFIG.terrain.skirtDepth + step * 0.5;
  let k = V * 3;
  const skirt = (v) => {
    const o = v * 3;
    positions[k] = positions[o];
    positions[k + 1] = positions[o + 1] - depth;
    positions[k + 2] = positions[o + 2];
    for (let c = 0; c < 3; c++) {
      normals[k + c] = normals[o + c];
      colors[k + c] = colors[o + c];
    }
    k += 3;
  };
  for (let i = 0; i <= N; i++) skirt(i);
  for (let i = 0; i <= N; i++) skirt(N * E + i);
  for (let j = 0; j <= N; j++) skirt(j * E);
  for (let j = 0; j <= N; j++) skirt(j * E + N);

  const result = { positions, normals, colors, minY: minY - depth, maxY };
  if (lod === 0 && grassDensity > 0) result.grass = buildGrass(terrain, cx, cz, grid, grassDensity);
  return result;
}

// Индексы сетки N×N и её юбок. Диагональ клетки — из (i+1, j) в (i, j+1).
export function buildChunkIndex(N) {
  const E = N + 1;
  const V = E * E;
  const idx = new Uint16Array(N * N * 6 + 4 * N * 6);
  let p = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * E + i;
      const b = a + 1;
      const c = a + E;
      const d = c + 1;
      idx[p++] = a;
      idx[p++] = c;
      idx[p++] = b;
      idx[p++] = b;
      idx[p++] = c;
      idx[p++] = d;
    }
  }
  const skirt = (start, edge, flip) => {
    for (let t = 0; t < N; t++) {
      const e0 = edge(t);
      const e1 = edge(t + 1);
      const k0 = start + t;
      const k1 = start + t + 1;
      if (flip) {
        idx[p++] = e0;
        idx[p++] = k0;
        idx[p++] = e1;
        idx[p++] = e1;
        idx[p++] = k0;
        idx[p++] = k1;
      } else {
        idx[p++] = e0;
        idx[p++] = e1;
        idx[p++] = k0;
        idx[p++] = e1;
        idx[p++] = k1;
        idx[p++] = k0;
      }
    }
  };
  skirt(V, (t) => t, false);
  skirt(V + E, (t) => N * E + t, true);
  skirt(V + 2 * E, (t) => t * E, true);
  skirt(V + 3 * E, (t) => t * E + N, false);
  return idx;
}

function pushInstance(store, type, x, y, z, rot, sx, sy, sz, color) {
  let s = store[type];
  if (!s) s = store[type] = { m: [], c: [] };
  const c = Math.cos(rot);
  const n = Math.sin(rot);
  s.m.push(c * sx, 0, -n * sx, 0, 0, sy, 0, 0, n * sz, 0, c * sz, 0, x, y, z, 1);
  s.c.push(color[0], color[1], color[2]);
}

function packStore(store) {
  const out = {};
  for (const [type, s] of Object.entries(store)) {
    out[type] = { matrices: new Float32Array(s.m), colors: new Float32Array(s.c), count: s.c.length / 3 };
  }
  return out;
}

function shade(base, k) {
  return [base[0] * k, base[1] * k, base[2] * k];
}

function buildGrass(terrain, cx, cz, grid, density) {
  const cfg = CONFIG.veg;
  const n = Math.round(S / cfg.grassCell);
  const cell = S / n;
  const seed = terrain.seed;
  const sA = mixSeed(seed, 101);
  const sB = mixSeed(seed, 102);
  const sC = mixSeed(seed, 103);
  const sD = mixSeed(seed, 104);
  const sE = mixSeed(seed, 105);
  const { G, step, C, M, J, NY } = grid;
  const store = {};
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const gx = cx * n + i;
      const gz = cz * n + j;
      const r0 = hash2i(sA, gx, gz);
      if (r0 >= 0.9 * density) continue;
      const lx = (i + hash2i(sB, gx, gz)) * cell;
      const lz = (j + hash2i(sC, gx, gz)) * cell;
      const h = gridSurface(grid, lx, lz);
      if (h < SEA + 0.25) continue;
      const g = (Math.round(lz / step) + 1) * G + Math.round(lx / step) + 1;
      if (NY[g] < cfg.maxGrassSlope) continue;
      const key = BIOMES[terrain.classify(h, C[g], M[g], NY[g], J[g])].key;
      const p = cfg.grassP[key] || 0;
      if (r0 >= p * density) continue;
      const r1 = hash2i(sD, gx, gz);
      const r2 = hash2i(sE, gx, gz);
      const s = 0.7 + 0.6 * r1;
      const tint = VC.grass[key] || VC.grass.plains;
      pushInstance(store, 'grass', lx, h - 0.04, lz, r2 * Math.PI * 2, s, s * (0.75 + 0.5 * r2), s, shade(tint, 0.85 + 0.3 * r1));
    }
  }
  const packed = packStore(store).grass;
  return packed || { matrices: new Float32Array(0), colors: new Float32Array(0), count: 0 };
}

export function buildVegetationChunk(terrain, cx, cz, density) {
  const cfg = CONFIG.veg;
  const n = Math.round(S / cfg.cell);
  const cell = S / n;
  const grid = sampleGrid(terrain, cx, cz, n);
  const seed = terrain.seed;
  const s0 = mixSeed(seed, 201);
  const s1 = mixSeed(seed, 202);
  const s2 = mixSeed(seed, 203);
  const s3 = mixSeed(seed, 204);
  const s4 = mixSeed(seed, 205);
  const s5 = mixSeed(seed, 206);
  const ox = cx * S;
  const oz = cz * S;
  const store = {};
  const colliders = [];
  let maxP = 0;
  for (const rules of Object.values(cfg.rules)) {
    let sum = 0;
    for (const [, p] of rules) sum += p;
    maxP = Math.max(maxP, sum);
  }

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const gx = cx * n + i;
      const gz = cz * n + j;
      const r0 = hash2i(s0, gx, gz);
      if (r0 >= maxP * density) continue;
      const lx = (i + 0.1 + 0.8 * hash2i(s1, gx, gz)) * cell;
      const lz = (j + 0.1 + 0.8 * hash2i(s2, gx, gz)) * cell;
      const surf = terrain.surface(ox + lx, oz + lz);
      const h = surf.h;
      const ny = surf.ny;
      const biome = terrain.classify(
        h,
        bilinear(grid, grid.C, lx, lz),
        bilinear(grid, grid.M, lx, lz),
        ny,
        bilinear(grid, grid.J, lx, lz),
      );
      const key = BIOMES[biome].key;
      const rules = cfg.rules[key];
      if (!rules) continue;
      let type = null;
      let acc = 0;
      for (const [t, p] of rules) {
        acc += p * density;
        if (r0 < acc) {
          type = t;
          break;
        }
      }
      if (!type) continue;
      const isRock = type === 'rock';
      if (h < SEA + (isRock ? -0.5 : 0.4)) continue;
      if (!isRock && ny < cfg.maxTreeSlope) continue;

      const r3 = hash2i(s3, gx, gz);
      const r4 = hash2i(s4, gx, gz);
      const r5 = hash2i(s5, gx, gz);
      const [smin, smax, sink] = cfg.scale[type];
      const rot = r4 * Math.PI * 2;
      if (isRock) {
        const big = key === 'mountains' || key === 'snow' ? 1.5 : 1;
        const s = (smin + (smax - smin) * r3 * r3) * big;
        const sx = s * (0.8 + 0.5 * r5);
        const sy = s * (0.5 + 0.5 * r4);
        const sz = s * (0.8 + 0.5 * (1 - r5));
        const base = VC.rock[key] || VC.rock.plains;
        const y = h - sink * sy;
        pushInstance(store, 'rock', lx, y, lz, rot, sx, sy, sz, shade(base, 0.85 + 0.3 * r5));
        if (sy > 0.55) colliders.push(lx, lz, 0.8 * Math.max(sx, sz), y + 0.85 * sy, 1);
        continue;
      }
      const s = smin + (smax - smin) * r3;
      const sy = s * (0.9 + 0.25 * r5);
      let palette = VC[type];
      if (type === 'oak' && r5 < cfg.autumnChance && key === 'forest') palette = VC.oakAutumn;
      const color = shade(palette[Math.floor(r5 * 997) % palette.length], 0.88 + 0.24 * r4);
      const y = h - sink;
      pushInstance(store, type, lx, y, lz, rot, s, sy, s, color);
      if (type === 'cactus') colliders.push(lx, lz, 0.45 * s, y + 3 * sy, 0);
      else if (type !== 'bush' && type !== 'deadBush') colliders.push(lx, lz, 0.32 * s, y + 9 * sy, 0);
    }
  }

  // Цветы: мелкая сетка, только на равнинах, в лесу и на горных лугах
  const nf = Math.round(S / cfg.flowerCell);
  const fcell = S / nf;
  const f0 = mixSeed(seed, 301);
  const f1 = mixSeed(seed, 302);
  const f2 = mixSeed(seed, 303);
  const f3 = mixSeed(seed, 304);
  for (let j = 0; j < nf; j++) {
    for (let i = 0; i < nf; i++) {
      const gx = cx * nf + i;
      const gz = cz * nf + j;
      const r0 = hash2i(f0, gx, gz);
      if (r0 >= 0.12 * density) continue;
      const lx = (i + hash2i(f1, gx, gz)) * fcell;
      const lz = (j + hash2i(f2, gx, gz)) * fcell;
      const hApprox = bilinear(grid, grid.H, lx, lz);
      const ny = bilinear(grid, grid.NY, lx, lz);
      const key =
        BIOMES[
          terrain.classify(hApprox, bilinear(grid, grid.C, lx, lz), bilinear(grid, grid.M, lx, lz), ny, bilinear(grid, grid.J, lx, lz))
        ].key;
      const p = cfg.flowerP[key] || 0;
      if (r0 >= p * density || ny < cfg.maxGrassSlope || hApprox < SEA + 0.5) continue;
      const h = terrain.surface(ox + lx, oz + lz).h;
      const r3 = hash2i(f3, gx, gz);
      const [smin, smax, sink] = cfg.scale.flower;
      const s = smin + (smax - smin) * r3;
      // в одной полянке — близкие цвета: палитра выбирается по крупной клетке
      const patch = hash2i(f3, Math.floor(gx / 4), Math.floor(gz / 4));
      const col = VC.flowers[Math.floor((patch * 0.7 + r3 * 0.3) * VC.flowers.length) % VC.flowers.length];
      pushInstance(store, 'flower', lx, h - sink, lz, r3 * 6.283, s, s, s, col);
    }
  }

  return { types: packStore(store), colliders: new Float32Array(colliders) };
}

// Препятствие в colliders: x, z (локально в чанке), радиус, верх, можно ли стоять сверху
export const COLLIDER_STRIDE = 5;

export const VEG_TYPES = ['pine', 'snowPine', 'oak', 'birch', 'palm', 'cactus', 'bush', 'deadBush', 'rock', 'flower'];
