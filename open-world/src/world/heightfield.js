// Карта высот земли вокруг игрока — для воды: глубина под поверхностью, цвет толщи, пена у берега.
// Тороидальная текстура: мировая клетка (x, z) живёт в текселе (x mod N, z mod N), поэтому при движении
// ничего не сдвигается — новые чанки просто перезаписывают свои квадраты.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const S = CONFIG.world.chunkSize;
const H = CONFIG.water.heightfield;

export class Heightfield {
  constructor() {
    this.N = H.size;
    this.cell = H.cell;
    this.span = this.N * this.cell;
    this.per = S / this.cell; // текселей на сторону чанка
    const deep = THREE.DataUtils.toHalfFloat(H.unknownDepth);
    this.data = new Uint16Array(this.N * this.N).fill(deep);
    this.texture = new THREE.DataTexture(this.data, this.N, this.N, THREE.RedFormat, THREE.HalfFloatType);
    this.texture.wrapS = this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.magFilter = this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
    this.dirty = false;
    this.timer = 0;
    this.uniforms = {
      uHeightfield: { value: this.texture },
      uHeightSpan: { value: this.span },
    };
  }

  // Записать чанк по его сетке LOD: positions — вершины (N+1)², шаг step
  writeChunk(cx, cz, positions, segments) {
    const E = segments + 1;
    const step = S / segments;
    const per = this.per;
    const N = this.N;
    const tx0 = cx * per;
    const tz0 = cz * per;
    for (let j = 0; j < per; j++) {
      const lz = (j + 0.5) * this.cell;
      const fz = Math.min(segments - 1e-6, lz / step);
      const gj = Math.floor(fz);
      const tz = fz - gj;
      const row = ((((tz0 + j) % N) + N) % N) * N;
      for (let i = 0; i < per; i++) {
        const lx = (i + 0.5) * this.cell;
        const fx = Math.min(segments - 1e-6, lx / step);
        const gi = Math.floor(fx);
        const t = fx - gi;
        const a = positions[(gj * E + gi) * 3 + 1];
        const b = positions[(gj * E + gi + 1) * 3 + 1];
        const c = positions[((gj + 1) * E + gi) * 3 + 1];
        const d = positions[((gj + 1) * E + gi + 1) * 3 + 1];
        const h = (a + (b - a) * t) * (1 - tz) + (c + (d - c) * t) * tz;
        const v = Math.max(-60, Math.min(60, h));
        this.data[row + ((((tx0 + i) % N) + N) % N)] = THREE.DataUtils.toHalfFloat(v);
      }
    }
    this.dirty = true;
  }

  update(dt) {
    this.timer -= dt;
    if (!this.dirty || this.timer > 0) return;
    this.timer = 1 / H.uploadHz;
    this.dirty = false;
    this.texture.needsUpdate = true;
  }
}
