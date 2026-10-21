// «Открытый мир» — все числа баланса и настройки генерации в одном месте.
//
// Арт-направление: стилизованный low-poly с мягким пастельным светом.
// Настроение: спокойное исследование без цели и спешки.
// Ключевые слова: простор, свет, тишина.

export const CONFIG = {
  world: {
    chunkSize: 64, // м, сторона квадратного чанка
    seaLevel: 0, // м, общий уровень воды для океана и озёр
    maxHeight: 280, // м, верхняя граница рельефа (для рамок чанков)
  },

  // Рельеф. Масштабы шума — обратные длины волн в метрах.
  terrain: {
    warpScale: 1 / 420,
    warpAmp: 70,
    continentScale: 1 / 1700,
    continentOctaves: 4,
    continentStretch: 1.7,
    continentBias: 0.24,
    // континентальность → базовая высота, пары [c, h] (кусочно-линейно)
    continentSpline: [-1, -42, -0.4, -26, -0.12, -7, -0.02, -1.4, 0.05, 1.6, 0.25, 6, 0.6, 14, 1, 22],
    hillsScale: 1 / 280,
    hillsOctaves: 5,
    hillsAmp: 15,
    mountainMaskScale: 1 / 950,
    mountainMaskLow: 0.0,
    mountainMaskHigh: 0.36,
    mountainScale: 1 / 560,
    mountainOctaves: 5,
    mountainAmp: 200,
    duneScaleX: 1 / 95,
    duneScaleZ: 1 / 38,
    duneAmp: 3.2,
    detailScale: 1 / 36,
    detailAmp: 1.0,
    moistureScale: 1 / 820,
    moistureOctaves: 4,
    moistureStretch: 1.9,
    jitterScale: 1 / 160, // шум, который сдвигает границы биомов
    beachTop: 2.2,
    beachJitter: 0.9,
    beachMaxContinent: 0.38, // выше — берега внутренних озёр без пляжей
    lakeMinContinent: 0.2, // вода с такой континентальностью — озеро
    rockLine: 64,
    rockJitter: 10,
    snowLine: 112,
    snowJitter: 14,
    desertMoisture: 0.36,
    forestMoisture: 0.58,
    moistureBlend: 0.05,
    steepRock: 0.68, // нормаль.y ниже — голая скала
    skirtDepth: 5, // м, «юбка» чанка, прячет щели между LOD
  },

  // Цвета мира (sRGB). Перевод в линейное пространство — в генераторе.
  colors: {
    seabedShallow: '#d6c48f',
    seabedDeep: '#24505e',
    beach: '#eedb9f',
    wetSand: '#c9b17a',
    plains: '#8dc05a',
    forest: '#4c8a3c',
    desert: '#e6c587',
    desertRock: '#c98a5a',
    rock: '#8a847b',
    alpine: '#7f9c58',
    snow: '#f2f6fb',
  },

  // Уровни детализации. distances — граница (м, до ближайшей точки чанка) каждого уровня.
  lod: {
    segments: [64, 32, 16, 8, 4],
    distances: [56, 150, 290, 470],
    hysteresis: 12,
  },

  // Растительность и камни. p — вероятность на клетку vegCell×vegCell м.
  veg: {
    cell: 4,
    rules: {
      plains: [['oak', 0.03], ['birch', 0.012], ['bush', 0.05], ['rock', 0.012]],
      forest: [['pine', 0.2], ['oak', 0.075], ['birch', 0.06], ['bush', 0.06], ['rock', 0.015]],
      desert: [['cactus', 0.05], ['deadBush', 0.07], ['rock', 0.025]],
      beach: [['palm', 0.05], ['rock', 0.012]],
      mountains: [['pine', 0.04], ['rock', 0.09]],
      snow: [['snowPine', 0.045], ['rock', 0.05]],
    },
    flowerCell: 2.5,
    flowerP: { plains: 0.11, forest: 0.02, mountains: 0.03 },
    maxTreeSlope: 0.78, // нормаль.y деревьев не ниже
    grassCell: 1.15,
    grassP: { plains: 0.9, forest: 0.5, mountains: 0.35, beach: 0.04, desert: 0.03 },
    maxGrassSlope: 0.8,
    // какие типы видны далеко (у деревьев есть упрощённая дальняя модель)
    farTypes: ['pine', 'snowPine', 'oak', 'birch', 'palm', 'rock'],
    // [мин, макс] масштаба и насколько основание уходит в землю (м)
    scale: {
      pine: [0.8, 1.35, 0.2],
      snowPine: [0.75, 1.25, 0.2],
      oak: [0.8, 1.3, 0.2],
      birch: [0.85, 1.25, 0.2],
      palm: [0.85, 1.2, 0.2],
      cactus: [0.7, 1.3, 0.15],
      bush: [0.6, 1.2, 0.15],
      deadBush: [0.6, 1.1, 0.1],
      rock: [0.45, 2.2, 0.3],
      flower: [0.75, 1.25, 0.05],
    },
    autumnChance: 0.12,
  },

  // Цвета растительности (sRGB). У деревьев цвет кроны — на экземпляр, ствол свой.
  vegColors: {
    grass: { plains: '#a3d465', forest: '#64a048', mountains: '#8fab5e', beach: '#d4c982', desert: '#cdb66d' },
    pine: ['#2f6e3c', '#346f3a', '#2a6237', '#3b7a42'],
    snowPine: ['#2f6a40', '#35704a'],
    oak: ['#4f9a3f', '#5aa84a', '#468e3a', '#62a64e'],
    oakAutumn: ['#e0902c', '#cf5a2a', '#e6b43c'],
    birch: ['#a2cd5c', '#aed468', '#93c254'],
    palm: ['#4f9a3a', '#5ba646'],
    cactus: ['#4f8f4a', '#5a9a50'],
    bush: ['#4f8f3e', '#5b9a46', '#447f37'],
    deadBush: ['#8a6a45', '#7a5c3c'],
    rock: {
      mountains: '#8a847b',
      desert: '#c98a5a',
      beach: '#b9ab8f',
      snow: '#a9b0b8',
      plains: '#8d8a80',
      forest: '#7f7d74',
    },
    flowers: ['#ffffff', '#ffd84a', '#b57cff', '#ff8fb3', '#ff6b4a', '#7fb2ff'],
  },

  // Качество графики. Дальность — в чанках, расстояния растительности — в метрах.
  quality: {
    low: {
      pixelRatio: 1,
      viewDistance: 4,
      lodScale: 0.75,
      vegDensity: 0.55,
      grassDensity: 0.4,
      treeNear: 70,
      treeFar: 210,
      smallFar: 60,
      shadows: false,
      clouds: 10,
    },
    medium: {
      pixelRatio: 1.5,
      viewDistance: 6,
      lodScale: 1,
      vegDensity: 0.8,
      grassDensity: 0.7,
      treeNear: 100,
      treeFar: 320,
      smallFar: 90,
      shadows: false,
      clouds: 18,
    },
    high: {
      pixelRatio: 2,
      viewDistance: 8,
      lodScale: 1.25,
      vegDensity: 1,
      grassDensity: 1,
      treeNear: 140,
      treeFar: 460,
      smallFar: 130,
      shadows: true,
      clouds: 26,
    },
  },

  render: {
    fogNearFactor: 0.3, // туман начинается с доли дальности
    fogFarFactor: 0.94,
    adaptive: { minScale: 0.6, lowFps: 50, highFps: 58, window: 1.5 },
    shadowSize: 2048,
    shadowRange: 55,
    mobileMaxFps: 60,
  },

  streaming: {
    workers: 3, // максимум воркеров генерации
    inFlightPerWorker: 2,
    applyBudgetMs: 4, // сколько мс за кадр тратить на загрузку готовых чанков
    unloadMargin: 72, // м сверх дальности, прежде чем чанк выгружается
    vegRebuildSec: 0.25,
    startRadius: 110, // м вокруг игрока, которые должны быть готовы перед стартом
  },

  player: {
    eyeHeight: 1.65,
    radius: 0.35,
    walkSpeed: 4.6,
    runSpeed: 8.6,
    groundAccel: 42,
    airAccel: 9,
    jumpSpeed: 6.3,
    gravity: 20,
    maxFall: 55,
    coyoteTime: 0.1,
    jumpBuffer: 0.12,
    maxSlope: 0.56, // нормаль.y склона, на который уже не забраться
    swim: { floatDepth: 1.3, speed: 3, runSpeed: 4.2, buoyancy: 9, damping: 3.5, stroke: 4.6, bob: 0.07 },
    wade: { minDepth: 0.3, slow: 0.45 },
    fly: { speed: 24, fastSpeed: 75, accel: 5, clearance: 1.5, maxAltitude: 700 },
    look: { mouse: 0.0022, touch: 0.0058, gamepad: 2.6, pitchLimit: 1.5 },
    fov: { base: 72, runKick: 6, flyKick: 10, minHorizontal: 66, maxVertical: 95 },
    bob: { walkAmp: 0.045, runAmp: 0.07, walkStride: 1.55, runStride: 2.2 },
    landDip: { perSpeed: 0.022, max: 0.28, stiffness: 70, damping: 12 },
    spawnSearch: { step: 40, maxRadius: 4000, minHeight: 3, maxHeight: 40, clearance: 4.5 },
  },

  time: {
    dayLengthSec: 720, // полный цикл суток
    nightSpeed: 2.2, // ночь проходит быстрее
    startTime: 0.32, // 0 — полночь, 0.5 — полдень
  },

  // Уровни выставлены по замерам анализатором: фон ≈ −30…−24 dBFS RMS, пики шагов ≈ −18 dBFS
  audio: {
    wind: { base: 0.22, altitude: 0.0045, flight: 0.013, gust: 0.14, max: 0.9 },
    surf: { range: 70, level: 2 },
    birds: { minGap: 1.4, maxGap: 6, level: 0.3 },
    crickets: { level: 0.07, voices: 3 },
    steps: { level: 1.1 },
  },

  particles: { max: 160 },

  ui: {
    hudHz: 10,
    debugHz: 4,
    toastSec: 2.4,
    hintSec: 9,
  },

  save: {
    key: 'open-world-game:v1',
    autosaveSec: 5,
  },

  // Настройки игрока по умолчанию (качество подбирается по устройству).
  defaults: {
    quality: null,
    viewDistance: null,
    sensitivity: 1,
    volume: 0.8,
    ambience: 0.8,
    effects: 0.9,
    reduceMotion: null,
    invertY: false,
    showDebug: false,
  },
};

export const STEP = 1 / 60; // фиксированный шаг физики
