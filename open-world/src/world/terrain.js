// Высота, влажность, биом и слои земли в любой точке мира.
// Чистые функции без three.js: одинаково работают в воркере, в основном потоке и в тестах.
import { CONFIG } from '../config.js';
import { createNoise2D, fbm, ridged, mixSeed, smoothstep, clamp01 } from './noise.js';

export const BIOME = { OCEAN: 0, LAKE: 1, BEACH: 2, PLAINS: 3, FOREST: 4, DESERT: 5, MOUNTAINS: 6, SNOW: 7 };

export const BIOMES = [
  { key: 'ocean', name: 'Океан', chip: '#3d8fd1', surface: 'water' },
  { key: 'lake', name: 'Озеро', chip: '#57a9d9', surface: 'water' },
  { key: 'beach', name: 'Пляж', chip: '#eedb9f', surface: 'sand' },
  { key: 'plains', name: 'Равнины', chip: '#8dc05a', surface: 'grass' },
  { key: 'forest', name: 'Лес', chip: '#4c8a3c', surface: 'forest' },
  { key: 'desert', name: 'Пустыня', chip: '#e6c587', surface: 'sand' },
  { key: 'mountains', name: 'Горы', chip: '#9a948b', surface: 'rock' },
  { key: 'snow', name: 'Снежные вершины', chip: '#f2f6fb', surface: 'snow' },
];

export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function hexToLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)];
}

// Слои текстуры земли (порядок как в src/assets/terrain/layers.json)
export const LAYERS = ['grass', 'forest', 'sand', 'desert', 'rocky', 'cliff', 'snow', 'dry'];
export const LAYER_COUNT = LAYERS.length;
export const LAYER = { GRASS: 0, FOREST: 1, SAND: 2, DESERT: 3, ROCKY: 4, CLIFF: 5, SNOW: 6, DRY: 7 };
const SEA_L = CONFIG.world.seaLevel;

export function createTerrain(seed) {
  const T = CONFIG.terrain;
  const sea = CONFIG.world.seaLevel;
  const nWarpA = createNoise2D(mixSeed(seed, 1));
  const nWarpB = createNoise2D(mixSeed(seed, 2));
  const nCont = createNoise2D(mixSeed(seed, 3));
  const nHills = createNoise2D(mixSeed(seed, 4));
  const nMask = createNoise2D(mixSeed(seed, 5));
  const nRidge = createNoise2D(mixSeed(seed, 6));
  const nDune = createNoise2D(mixSeed(seed, 7));
  const nDetail = createNoise2D(mixSeed(seed, 8));
  const nMoist = createNoise2D(mixSeed(seed, 9));
  const nJitter = createNoise2D(mixSeed(seed, 10));
  const nVar = createNoise2D(mixSeed(seed, 11));

  const sx = [];
  const sy = [];
  for (let i = 0; i < T.continentSpline.length; i += 2) {
    sx.push(T.continentSpline[i]);
    sy.push(T.continentSpline[i + 1]);
  }
  function spline(c) {
    if (c <= sx[0]) return sy[0];
    for (let i = 1; i < sx.length; i++) {
      if (c <= sx[i]) return sy[i - 1] + ((sy[i] - sy[i - 1]) * (c - sx[i - 1])) / (sx[i] - sx[i - 1]);
    }
    return sy[sy.length - 1];
  }

  const scratch = { h: 0, c: 0, moist: 0, mask: 0, jitter: 0 };

  // Все поля в точке: высота h, континентальность c, влажность, маска гор, сдвиг границ биомов
  function fields(x, z, out = scratch) {
    const ws = T.warpScale;
    const wx = x + T.warpAmp * fbm(nWarpA, x * ws, z * ws, 2);
    const wz = z + T.warpAmp * fbm(nWarpB, x * ws, z * ws, 2);
    const c = fbm(nCont, wx * T.continentScale, wz * T.continentScale, T.continentOctaves) * T.continentStretch + T.continentBias;
    let h = spline(c);
    const land = smoothstep(-0.06, 0.22, c);
    h += fbm(nHills, wx * T.hillsScale, wz * T.hillsScale, T.hillsOctaves) * T.hillsAmp * (0.2 + 0.8 * land);
    const moist = clamp01(
      0.5 + 0.5 * T.moistureStretch * fbm(nMoist, x * T.moistureScale + 17.3, z * T.moistureScale - 41.9, T.moistureOctaves),
    );
    const mask =
      smoothstep(T.mountainMaskLow, T.mountainMaskHigh, fbm(nMask, wx * T.mountainMaskScale, wz * T.mountainMaskScale, 3)) *
      smoothstep(0.1, 0.4, c);
    if (mask > 0) h += mask * ridged(nRidge, wx * T.mountainScale, wz * T.mountainScale, T.mountainOctaves) * T.mountainAmp;
    const dry = smoothstep(T.desertMoisture + 0.04, T.desertMoisture - 0.08, moist) * land * (1 - mask);
    if (dry > 0) {
      const d = 1 - Math.abs(nDune(x * T.duneScaleX, z * T.duneScaleZ));
      h += dry * d * d * T.duneAmp;
    }
    h += nDetail(x * T.detailScale, z * T.detailScale) * T.detailAmp * (0.3 + 0.7 * land);
    out.h = h;
    out.c = c;
    out.moist = moist;
    out.mask = mask;
    out.jitter = nJitter(x * T.jitterScale, z * T.jitterScale);
    return out;
  }

  function height(x, z) {
    return fields(x, z, scratch).h;
  }

  // Поверхность ровно такой, какой её рисует ближняя сетка LOD0: высота и нормаль треугольника
  const surf = { h: 0, nx: 0, ny: 1, nz: 0 };
  function surface(x, z, out = surf) {
    const s = CONFIG.world.chunkSize / CONFIG.lod.segments[0];
    const gx = Math.floor(x / s);
    const gz = Math.floor(z / s);
    const fx = x / s - gx;
    const fz = z / s - gz;
    const x0 = gx * s;
    const z0 = gz * s;
    const hb = height(x0 + s, z0);
    const hc = height(x0, z0 + s);
    let dhdx;
    let dhdz;
    if (fx + fz <= 1) {
      const ha = height(x0, z0);
      out.h = ha + (hb - ha) * fx + (hc - ha) * fz;
      dhdx = (hb - ha) / s;
      dhdz = (hc - ha) / s;
    } else {
      const hd = height(x0 + s, z0 + s);
      out.h = hd + (hc - hd) * (1 - fx) + (hb - hd) * (1 - fz);
      dhdx = (hd - hc) / s;
      dhdz = (hd - hb) / s;
    }
    const inv = 1 / Math.sqrt(dhdx * dhdx + 1 + dhdz * dhdz);
    out.nx = -dhdx * inv;
    out.ny = inv;
    out.nz = -dhdz * inv;
    return out;
  }

  function classify(h, c, moist, ny, jitter) {
    if (h < sea - 0.3) return c > T.lakeMinContinent ? BIOME.LAKE : BIOME.OCEAN;
    if (h > T.snowLine + jitter * T.snowJitter) return BIOME.SNOW;
    if (h < T.beachTop + jitter * T.beachJitter && c < T.beachMaxContinent) return BIOME.BEACH;
    if (h > T.rockLine + jitter * T.rockJitter || (ny < T.steepRock && h > 20)) return BIOME.MOUNTAINS;
    if (moist < T.desertMoisture) return BIOME.DESERT;
    if (moist > T.forestMoisture) return BIOME.FOREST;
    return BIOME.PLAINS;
  }

  const bf = { h: 0, c: 0, moist: 0, mask: 0, jitter: 0 };
  function biomeAt(x, z) {
    const s = surface(x, z);
    const f = fields(x, z, bf);
    return classify(s.h, f.c, f.moist, s.ny, f.jitter);
  }

  // Слои земли для шейдера: 8 весов (байты, сумма 255) в W[wo..wo+7] и оттенок (×127,5) в Tn[to..to+3].
  // Порядок слоёв — как в текстуре: трава, лесная подстилка, песок, сухая земля, щебень, скала, снег, сухая трава.
  const lw = new Float64Array(LAYER_COUNT);
  function layers(x, z, h, c, moist, ny, jitter, W, wo, Tn, to) {
    lw.fill(0);
    const b = T.moistureBlend;
    const wDesert = smoothstep(T.desertMoisture + b, T.desertMoisture - b, moist);
    const wForest = smoothstep(T.forestMoisture - b, T.forestMoisture + b, moist);
    const v1 = nVar(x * 0.021, z * 0.021);
    const v2 = nVar(x * 0.11 + 31.7, z * 0.11 - 17.3);
    let grass = (1 - wDesert) * (1 - wForest);
    let forest = (1 - wDesert) * wForest;
    let dry = 0;
    let rocky = 0;
    // полоса выгоревшей травы на границе со степью и пятна сухой травы на лугах
    const dryBand = smoothstep(T.desertMoisture + 0.15 + 0.04 * v1, T.desertMoisture + 0.02, moist) * (1 - wDesert);
    dry = grass * Math.max(dryBand, smoothstep(0.35, 0.7, v1) * 0.45);
    grass -= dry;
    // в лесу — поляны с травой
    const glade = forest * smoothstep(0.15, 0.55, v1 * 0.55 + v2 * 0.45) * 0.7;
    forest -= glade;
    grass += glade;
    // к границе скал луга становятся альпийскими: трава редеет, проступает щебень
    const rockLine = T.rockLine + jitter * T.rockJitter;
    const alpine = smoothstep(rockLine - 34, rockLine - 8, h) * (1 - wDesert);
    if (alpine > 0) {
      const veg = grass + forest + dry;
      grass = (grass + forest) * (1 - alpine) + veg * alpine * 0.5;
      forest = 0;
      dry = dry * (1 - alpine) + veg * alpine * 0.22;
      rocky += veg * alpine * 0.28;
    }
    // на крутых склонах трава не держится — щебень и земля
    const erosion = smoothstep(0.94, 0.8, ny) * 0.65;
    if (erosion > 0) {
      const moved = (grass + dry) * erosion;
      grass *= 1 - erosion;
      dry *= 1 - erosion;
      rocky += moved * 0.6;
      forest += moved * 0.4;
    }
    lw[0] = grass;
    lw[1] = forest;
    lw[3] = wDesert;
    lw[4] = rocky;
    lw[7] = dry;
    // выше линии скал — щебень, на обрывах — скала
    const wRockH = smoothstep(rockLine - 6, rockLine + 6, h);
    const wSteep = smoothstep(T.steepRock + 0.14, T.steepRock - 0.04, ny) * smoothstep(SEA_L + 0.2, SEA_L + 1.5, h);
    const keep = (1 - wRockH) * (1 - wSteep);
    if (keep < 1) {
      for (let i = 0; i < LAYER_COUNT; i++) lw[i] *= keep;
      lw[4] += wRockH * (1 - wSteep);
      lw[5] += wSteep;
    }
    // снег на пологих местах выше снеговой линии
    const snowLine = T.snowLine + jitter * T.snowJitter;
    const wSnow = smoothstep(snowLine - 4, snowLine + 4, h) * smoothstep(0.55, 0.75, ny);
    if (wSnow > 0) {
      for (let i = 0; i < LAYER_COUNT; i++) lw[i] *= 1 - wSnow;
      lw[6] += wSnow;
    }
    // пляж у моря, у озёр — илистый берег с галькой
    const coastal = 1 - smoothstep(T.beachMaxContinent - 0.08, T.beachMaxContinent, c);
    const beachTop = T.beachTop + jitter * T.beachJitter;
    const wBeach = (1 - smoothstep(beachTop - 0.4, beachTop + 0.6, h)) * coastal;
    const wBank = (1 - smoothstep(SEA_L + 0.1, SEA_L + 1.1, h)) * (1 - coastal);
    const shore = Math.max(wBeach, wBank);
    if (shore > 0) {
      for (let i = 0; i < LAYER_COUNT; i++) lw[i] *= 1 - shore;
      lw[2] += wBeach;
      lw[1] += wBank * 0.55;
      lw[4] += wBank * 0.45;
    }
    // дно: у берега песок, глубже — ил и камни
    if (h < SEA_L) {
      const k = smoothstep(0, 0.6, SEA_L - h);
      const sandy = (1 - smoothstep(1.5, 10, SEA_L - h)) * (0.5 + 0.5 * coastal);
      for (let i = 0; i < LAYER_COUNT; i++) lw[i] *= 1 - k;
      lw[2] += k * sandy;
      lw[4] += k * (1 - sandy) * 0.55;
      lw[1] += k * (1 - sandy) * 0.45;
    }
    let sum = 0;
    for (let i = 0; i < LAYER_COUNT; i++) sum += lw[i];
    // байты с суммой ровно 255: остаток округления — самому весомому слою
    let total = 0;
    let top = 0;
    for (let i = 0; i < LAYER_COUNT; i++) {
      const q = Math.round((lw[i] / sum) * 255);
      W[wo + i] = q;
      total += q;
      if (lw[i] > lw[top]) top = i;
    }
    W[wo + top] = Math.max(0, Math.min(255, W[wo + top] + 255 - total));

    // оттенок: лес темнее, песчаник в пустыне красноватый, лёгкая пятнистость
    let r = 1;
    let g = 1;
    let bl = 1;
    const fw = lw[1] / sum + (wForest * lw[0]) / sum;
    r -= 0.08 * fw;
    g -= 0.03 * fw;
    bl -= 0.07 * fw;
    const desertRock = ((lw[4] + lw[5]) / sum) * wDesert;
    r += 0.22 * desertRock;
    g -= 0.06 * desertRock;
    bl -= 0.26 * desertRock;
    const grassy = (lw[0] + lw[7]) / sum;
    r *= 1 + 0.05 * v1 * grassy;
    bl *= 1 - 0.06 * v1 * grassy;
    const v = 1 + 0.06 * nVar(x * 0.09, z * 0.09) + 0.03 * nVar(x * 0.45 + 100, z * 0.45 - 100);
    Tn[to] = Math.min(255, Math.round(r * v * 127.5));
    Tn[to + 1] = Math.min(255, Math.round(g * v * 127.5));
    Tn[to + 2] = Math.min(255, Math.round(bl * v * 127.5));
    Tn[to + 3] = 255;
  }

  return { seed, fields, height, surface, classify, biomeAt, layers };
}
