import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createTerrain, BIOMES } from '../src/world/terrain.js';
import { buildTerrainChunk, buildVegetationChunk, buildChunkIndex, COLLIDER_STRIDE } from '../src/world/chunkgen.js';
import { parseSeed, createNoise2D } from '../src/world/noise.js';

const S = CONFIG.world.chunkSize;

test('один сид — одни и те же высоты, другой сид — другой мир', () => {
  const a = createTerrain(12345);
  const b = createTerrain(12345);
  const c = createTerrain(54321);
  let diff = 0;
  for (let i = 0; i < 500; i++) {
    const x = (i * 97.3) % 5000 - 2500;
    const z = (i * 61.7) % 5000 - 2500;
    assert.equal(a.height(x, z), b.height(x, z));
    if (Math.abs(a.height(x, z) - c.height(x, z)) > 0.5) diff++;
  }
  assert.ok(diff > 400, `разные сиды должны давать разный рельеф (${diff}/500)`);
});

test('буферы чанка совпадают побайтно для одного сида', () => {
  for (const lod of [0, 2, 4]) {
    const r1 = buildTerrainChunk(createTerrain(777), 3, -5, lod, 1);
    const r2 = buildTerrainChunk(createTerrain(777), 3, -5, lod, 1);
    assert.deepEqual(r1.positions, r2.positions);
    assert.deepEqual(r1.normals, r2.normals);
    assert.deepEqual(r1.colors, r2.colors);
    if (lod === 0) assert.deepEqual(r1.grass.matrices, r2.grass.matrices);
  }
  const v1 = buildVegetationChunk(createTerrain(777), -2, 4, 1);
  const v2 = buildVegetationChunk(createTerrain(777), -2, 4, 1);
  assert.deepEqual(v1, v2);
});

test('соседние чанки одного LOD сходятся без щелей и скачков света', () => {
  const t = createTerrain(2024);
  for (const lod of [0, 1, 3]) {
    const N = CONFIG.lod.segments[lod];
    const E = N + 1;
    const a = buildTerrainChunk(t, 0, 0, lod);
    const b = buildTerrainChunk(t, 1, 0, lod);
    const c = buildTerrainChunk(t, 0, 1, lod);
    for (let j = 0; j <= N; j++) {
      const va = (j * E + N) * 3;
      const vb = j * E * 3;
      assert.equal(a.positions[va + 1], b.positions[vb + 1]);
      for (let k = 0; k < 3; k++) assert.equal(a.normals[va + k], b.normals[vb + k]);
      for (let k = 0; k < 3; k++) assert.equal(a.colors[va + k], b.colors[vb + k]);
    }
    for (let i = 0; i <= N; i++) {
      assert.equal(a.positions[(N * E + i) * 3 + 1], c.positions[i * 3 + 1]);
    }
  }
});

test('индексы ссылаются только на существующие вершины, у каждого LOD полный набор', () => {
  for (const N of CONFIG.lod.segments) {
    const idx = buildChunkIndex(N);
    const total = (N + 1) * (N + 1) + 4 * (N + 1);
    assert.equal(idx.length, N * N * 6 + 4 * N * 6);
    let max = 0;
    for (const v of idx) max = Math.max(max, v);
    assert.ok(max < total);
  }
});

test('треугольники сетки смотрят вверх, а юбки — наружу', () => {
  const N = 8;
  const t = createTerrain(5);
  const r = buildTerrainChunk(t, 0, 0, 3);
  const idx = buildChunkIndex(N);
  const P = r.positions;
  const center = [S / 2, 0, S / 2];
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i] * 3, idx[i + 1] * 3, idx[i + 2] * 3];
    const ux = P[b] - P[a];
    const uy = P[b + 1] - P[a + 1];
    const uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a];
    const vy = P[c + 1] - P[a + 1];
    const vz = P[c + 2] - P[a + 2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    if (i < N * N * 6) {
      assert.ok(n[1] > 0, 'грань рельефа смотрит вниз');
    } else {
      const mx = (P[a] + P[b] + P[c]) / 3 - center[0];
      const mz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3 - center[2];
      assert.ok(n[0] * mx + n[2] * mz > 0, 'юбка смотрит внутрь чанка');
    }
  }
});

test('surface() для коллизий совпадает с треугольниками LOD0', () => {
  const t = createTerrain(31337);
  const cx = -3;
  const cz = 2;
  const r = buildTerrainChunk(t, cx, cz, 0);
  const N = CONFIG.lod.segments[0];
  const E = N + 1;
  const step = S / N;
  for (let k = 0; k < 300; k++) {
    const lx = ((k * 7.31) % (S - 0.01)) + 0.003;
    const lz = ((k * 3.77) % (S - 0.01)) + 0.002;
    const i = Math.floor(lx / step);
    const j = Math.floor(lz / step);
    const fx = lx / step - i;
    const fz = lz / step - j;
    const y = (ii, jj) => r.positions[(jj * E + ii) * 3 + 1];
    let expect;
    if (fx + fz <= 1) expect = y(i, j) + (y(i + 1, j) - y(i, j)) * fx + (y(i, j + 1) - y(i, j)) * fz;
    else expect = y(i + 1, j + 1) + (y(i, j + 1) - y(i + 1, j + 1)) * (1 - fx) + (y(i + 1, j) - y(i + 1, j + 1)) * (1 - fz);
    const got = t.surface(cx * S + lx, cz * S + lz).h;
    assert.ok(Math.abs(got - expect) < 1e-3, `${got} vs ${expect}`);
  }
});

test('растительность лежит внутри своего чанка и на земле', () => {
  const t = createTerrain(99);
  let total = 0;
  for (let cz = -3; cz <= 3; cz++) {
    for (let cx = -3; cx <= 3; cx++) {
      const v = buildVegetationChunk(t, cx, cz, 1);
      for (const [type, d] of Object.entries(v.types)) {
        assert.equal(d.matrices.length, d.count * 16);
        assert.equal(d.colors.length, d.count * 3);
        for (let i = 0; i < d.count; i++) {
          const x = d.matrices[i * 16 + 12];
          const y = d.matrices[i * 16 + 13];
          const z = d.matrices[i * 16 + 14];
          assert.ok(x >= 0 && x <= S && z >= 0 && z <= S, `${type} вне чанка`);
          const ground = t.surface(cx * S + x, cz * S + z).h;
          assert.ok(Math.abs(ground - y) < 1.5, `${type} висит: ${y} над ${ground}`);
          total++;
        }
      }
      assert.equal(v.colliders.length % COLLIDER_STRIDE, 0);
    }
  }
  assert.ok(total > 100, `слишком пусто: ${total}`);
});

test('все биомы встречаются на типичном сиде', () => {
  const t = createTerrain(parseSeed('482913'));
  const seen = new Set();
  for (let j = 0; j < 160; j++) {
    for (let i = 0; i < 160; i++) seen.add(t.biomeAt((i - 80) * 60, (j - 80) * 60));
  }
  for (const b of ['ocean', 'beach', 'plains', 'forest', 'desert', 'mountains', 'snow']) {
    assert.ok(seen.has(BIOMES.findIndex((x) => x.key === b)), `нет биома ${b}`);
  }
});

test('сид из текста: число — как есть, слово — стабильный хеш', () => {
  assert.equal(parseSeed('123'), 123);
  assert.equal(parseSeed(' 4294967295 '), 4294967295);
  assert.equal(parseSeed('Остров'), parseSeed('Остров'));
  assert.notEqual(parseSeed('Остров'), parseSeed('остров'));
  assert.equal(parseSeed(''), parseSeed('0'));
  const n = createNoise2D(1);
  for (let i = 0; i < 1000; i++) {
    const v = n(i * 0.37, i * 0.91);
    assert.ok(v >= -1 && v <= 1);
  }
});
