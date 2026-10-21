// Высота, влажность, биом и цвет земли в любой точке мира.
// Чистые функции без three.js: одинаково работают в воркере, в основном потоке и в тестах.
import { CONFIG } from '../config.js';
import { createNoise2D, fbm, ridged, mixSeed, smoothstep, clamp01, lerp } from './noise.js';

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

const PAL = {};
for (const [k, hex] of Object.entries(CONFIG.colors)) PAL[k] = hexToLinear(hex);

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

  // Цвет земли (линейный RGB) с мягкими переходами между биомами
  function color(x, z, h, c, moist, ny, jitter, out, o) {
    const b = T.moistureBlend;
    const wDesert = smoothstep(T.desertMoisture + b, T.desertMoisture - b, moist);
    const wForest = smoothstep(T.forestMoisture - b, T.forestMoisture + b, moist);
    let r = lerp(PAL.plains[0], PAL.desert[0], wDesert);
    let g = lerp(PAL.plains[1], PAL.desert[1], wDesert);
    let bl = lerp(PAL.plains[2], PAL.desert[2], wDesert);
    r = lerp(r, PAL.forest[0], wForest);
    g = lerp(g, PAL.forest[1], wForest);
    bl = lerp(bl, PAL.forest[2], wForest);

    const rockLine = T.rockLine + jitter * T.rockJitter;
    const alpine = smoothstep(rockLine - 34, rockLine - 10, h) * (1 - wDesert) * 0.75;
    r = lerp(r, PAL.alpine[0], alpine);
    g = lerp(g, PAL.alpine[1], alpine);
    bl = lerp(bl, PAL.alpine[2], alpine);

    const wRock = Math.max(smoothstep(rockLine - 6, rockLine + 6, h), smoothstep(T.steepRock + 0.1, T.steepRock - 0.08, ny));
    if (wRock > 0) {
      const rr = lerp(PAL.rock[0], PAL.desertRock[0], wDesert);
      const rg = lerp(PAL.rock[1], PAL.desertRock[1], wDesert);
      const rb = lerp(PAL.rock[2], PAL.desertRock[2], wDesert);
      r = lerp(r, rr, wRock);
      g = lerp(g, rg, wRock);
      bl = lerp(bl, rb, wRock);
    }

    const snowLine = T.snowLine + jitter * T.snowJitter;
    const wSnow = smoothstep(snowLine - 4, snowLine + 4, h) * smoothstep(0.42, 0.68, ny);
    if (wSnow > 0) {
      r = lerp(r, PAL.snow[0], wSnow);
      g = lerp(g, PAL.snow[1], wSnow);
      bl = lerp(bl, PAL.snow[2], wSnow);
    }

    const beachTop = T.beachTop + jitter * T.beachJitter;
    const coastal = 1 - smoothstep(T.beachMaxContinent - 0.08, T.beachMaxContinent, c);
    const wBeach = (1 - smoothstep(beachTop - 0.4, beachTop + 0.6, h)) * coastal;
    if (wBeach > 0) {
      r = lerp(r, PAL.beach[0], wBeach);
      g = lerp(g, PAL.beach[1], wBeach);
      bl = lerp(bl, PAL.beach[2], wBeach);
    }

    const wWet = (1 - smoothstep(0, 0.7, Math.abs(h - sea - 0.15))) * 0.6;
    if (wWet > 0) {
      r = lerp(r, PAL.wetSand[0], wWet);
      g = lerp(g, PAL.wetSand[1], wWet);
      bl = lerp(bl, PAL.wetSand[2], wWet);
    }

    if (h < sea) {
      const depth = sea - h;
      const deep = smoothstep(0, 18, depth);
      const k = smoothstep(0, 1.2, depth);
      r = lerp(r, lerp(PAL.seabedShallow[0], PAL.seabedDeep[0], deep), k);
      g = lerp(g, lerp(PAL.seabedShallow[1], PAL.seabedDeep[1], deep), k);
      bl = lerp(bl, lerp(PAL.seabedShallow[2], PAL.seabedDeep[2], deep), k);
    }

    const v = 1 + 0.07 * nVar(x * 0.09, z * 0.09) + 0.035 * nVar(x * 0.45 + 100, z * 0.45 - 100);
    out[o] = r * v;
    out[o + 1] = g * v;
    out[o + 2] = bl * v;
  }

  return { seed, fields, height, surface, classify, biomeAt, color };
}
