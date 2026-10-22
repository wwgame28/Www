// Задания генерации — одни и те же для Web Worker и для запасного режима в основном потоке.
import { buildTerrainChunk, buildVegetationChunk } from './chunkgen.js';

// m: { type: 'terrain' | 'veg', id, gen, cx, cz, lod, grass, density } → ответ и список буферов для передачи
export function runJob(terrain, m) {
  const t0 = performance.now();
  if (m.type === 'terrain') {
    const r = buildTerrainChunk(terrain, m.cx, m.cz, m.lod, m.grass);
    const transfer = [r.positions.buffer, r.normals.buffer, r.splat.buffer, r.tint.buffer];
    if (r.grass) transfer.push(r.grass.matrices.buffer, r.grass.colors.buffer, r.grass.variants.buffer);
    return { msg: { type: 'terrain', id: m.id, gen: m.gen, cx: m.cx, cz: m.cz, lod: m.lod, ms: performance.now() - t0, ...r }, transfer };
  }
  const r = buildVegetationChunk(terrain, m.cx, m.cz, m.density);
  const transfer = [r.colliders.buffer];
  for (const t of Object.values(r.types)) transfer.push(t.matrices.buffer, t.colors.buffer);
  return { msg: { type: 'veg', id: m.id, gen: m.gen, cx: m.cx, cz: m.cz, ms: performance.now() - t0, ...r }, transfer };
}
