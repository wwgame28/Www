// Web Worker генерации: главный поток только раскладывает готовые буферы по сценам.
import { createTerrain } from './terrain.js';
import { buildTerrainChunk, buildVegetationChunk } from './chunkgen.js';

let terrain = null;
let gen = -1;

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    terrain = createTerrain(m.seed);
    gen = m.gen;
    return;
  }
  if (!terrain || m.gen !== gen) {
    self.postMessage({ type: 'skip', id: m.id, gen: m.gen });
    return;
  }
  const t0 = performance.now();
  if (m.type === 'terrain') {
    const r = buildTerrainChunk(terrain, m.cx, m.cz, m.lod, m.grass);
    const transfer = [r.positions.buffer, r.normals.buffer, r.colors.buffer];
    if (r.grass) transfer.push(r.grass.matrices.buffer, r.grass.colors.buffer);
    self.postMessage({ type: 'terrain', id: m.id, gen: m.gen, cx: m.cx, cz: m.cz, lod: m.lod, ms: performance.now() - t0, ...r }, transfer);
  } else if (m.type === 'veg') {
    const r = buildVegetationChunk(terrain, m.cx, m.cz, m.density);
    const transfer = [r.colliders.buffer];
    for (const t of Object.values(r.types)) transfer.push(t.matrices.buffer, t.colors.buffer);
    self.postMessage({ type: 'veg', id: m.id, gen: m.gen, cx: m.cx, cz: m.cz, ms: performance.now() - t0, ...r }, transfer);
  }
};
