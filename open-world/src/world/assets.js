// Загрузка текстур с прогрессом. Слои земли: цвет (RGB) и высота (серое) из двух картинок-столбиков
// собираются в один массив текстур RGBA (альфа — высота) с мипмапами и анизотропной фильтрацией.
import * as THREE from 'three';
import layersMeta from '../assets/terrain/layers.json';

import albedoHi from '../assets/terrain/albedo-hi.webp?url';
import heightHi from '../assets/terrain/height-hi.webp?url';
import albedoLo from '../assets/terrain/albedo-lo.webp?url';
import heightLo from '../assets/terrain/height-lo.webp?url';
import noise from '../assets/misc/noise.webp?url';
import waterNormal from '../assets/misc/water-normal.webp?url';
import grass from '../assets/misc/grass.webp?url';
import barkOak from '../assets/trees/bark-oak.webp?url';
import barkOakN from '../assets/trees/bark-oak-n.webp?url';
import barkBirch from '../assets/trees/bark-birch.webp?url';
import barkBirchN from '../assets/trees/bark-birch-n.webp?url';
import barkPine from '../assets/trees/bark-pine.webp?url';
import barkPineN from '../assets/trees/bark-pine-n.webp?url';
import leavesOak from '../assets/trees/leaves-oak.webp?url';
import leavesAspen from '../assets/trees/leaves-aspen.webp?url';
import leavesPine from '../assets/trees/leaves-pine.webp?url';
import palmFrond from '../assets/trees/palm-frond.webp?url';
import palmBark from '../assets/trees/palm-bark.webp?url';
import cactus from '../assets/trees/cactus.webp?url';

const TERRAIN = {
  hi: { albedo: albedoHi, height: heightHi },
  lo: { albedo: albedoLo, height: heightLo },
};

const TEXTURES = {
  noise: { src: noise, color: false, repeat: true },
  waterNormal: { src: waterNormal, color: false, repeat: true },
  grass: { src: grass, color: true },
  barkOak: { src: barkOak, color: true, repeat: true },
  barkOakN: { src: barkOakN, color: false, repeat: true },
  barkBirch: { src: barkBirch, color: true, repeat: true },
  barkBirchN: { src: barkBirchN, color: false, repeat: true },
  barkPine: { src: barkPine, color: true, repeat: true },
  barkPineN: { src: barkPineN, color: false, repeat: true },
  leavesOak: { src: leavesOak, color: true },
  leavesAspen: { src: leavesAspen, color: true },
  leavesPine: { src: leavesPine, color: true },
  palmFrond: { src: palmFrond, color: true },
  palmBark: { src: palmBark, color: true, repeat: true },
  cactus: { src: cactus, color: true, repeat: true },
};

export class Assets {
  constructor(renderer) {
    this.renderer = renderer;
    this.tex = {};
    this.terrain = { hi: null, lo: null };
    this.meta = layersMeta;
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  // Обычные текстуры (общие для всех качеств); onProgress(0..1)
  async loadCommon(onProgress) {
    const loader = new THREE.TextureLoader();
    const entries = Object.entries(TEXTURES);
    let done = 0;
    await Promise.all(
      entries.map(async ([key, d]) => {
        const t = await loader.loadAsync(d.src);
        t.colorSpace = d.color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        if (d.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = this.anisotropy;
        this.tex[key] = t;
        done++;
        onProgress?.(done / entries.length);
      }),
    );
  }

  // Массив слоёв земли нужного разрешения ('hi' | 'lo'); повторный вызов отдаёт готовый
  async loadTerrain(res, onProgress) {
    if (this.terrain[res]) return this.terrain[res];
    const src = TERRAIN[res];
    const [a, h] = await Promise.all([decode(src.albedo), decode(src.height)]);
    onProgress?.(0.8);
    const size = a.width;
    const layers = Math.round(a.height / size);
    const data = new Uint8Array(size * size * layers * 4);
    const A = a.data;
    const H = h.data;
    for (let i = 0, n = size * size * layers; i < n; i++) {
      const o = i * 4;
      data[o] = A[o];
      data[o + 1] = A[o + 1];
      data[o + 2] = A[o + 2];
      data[o + 3] = H[o];
    }
    const t = new THREE.DataArrayTexture(data, size, size, layers);
    t.format = THREE.RGBAFormat;
    t.type = THREE.UnsignedByteType;
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = this.anisotropy;
    t.needsUpdate = true;
    this.terrain[res] = { texture: t, size };
    onProgress?.(1);
    return this.terrain[res];
  }
}

// Картинка → пиксели RGBA без цветовых преобразований (важно для высот)
async function decode(src) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Не удалось загрузить ${src}: ${res.status}`);
  const blob = await res.blob();
  let bmp;
  try {
    bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  } catch {
    bmp = await createImageBitmap(blob);
  }
  const w = bmp.width;
  const h = bmp.height;
  let canvas;
  if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(w, h);
  else {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  bmp.close?.();
  return { width: w, height: h, data: img.data };
}
