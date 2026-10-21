// Web Worker генерации: главный поток только раскладывает готовые буферы по сценам.
import { createTerrain } from './terrain.js';
import { runJob } from './jobs.js';

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
  try {
    const { msg, transfer } = runJob(terrain, m);
    self.postMessage(msg, transfer);
  } catch (err) {
    // ответ обязателен: иначе главный поток будет вечно ждать этот чанк
    self.postMessage({ type: 'error', id: m.id, gen: m.gen, message: String((err && err.message) || err) });
  }
};
