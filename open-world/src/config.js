// «Открытый мир» — все числа баланса и настройки генерации в одном месте.
//
// Арт-направление: фотореализм — физическое небо и свет, PBR-материалы с фототекстурами,
// воздушная перспектива, тени, живая растительность. Настроение: спокойное исследование без цели.
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
      plains: [['oak', 0.028], ['birch', 0.014], ['bush', 0.05], ['rock', 0.012]],
      forest: [['pine', 0.19], ['oak', 0.07], ['birch', 0.06], ['bush', 0.07], ['rock', 0.015]],
      desert: [['cactus', 0.045], ['deadBush', 0.07], ['rock', 0.025]],
      beach: [['palm', 0.05], ['rock', 0.012]],
      mountains: [['pine', 0.04], ['bush', 0.03], ['rock', 0.09]],
      snow: [['snowPine', 0.045], ['rock', 0.05]],
    },
    maxTreeSlope: 0.78, // нормаль.y деревьев не ниже
    // трава: клетка (м), насыщенность и доля цветочных полян по биомам
    grassCell: 0.85,
    grassFill: 0.95,
    maxGrassSlope: 0.78,
    flowerP: { plains: 0.3, forest: 0.08, mountains: 0.35 },
    // [мин, макс] масштаба и насколько основание уходит в землю (м)
    scale: {
      pine: [0.8, 1.3, 0.2],
      snowPine: [0.75, 1.2, 0.2],
      oak: [0.8, 1.25, 0.2],
      birch: [0.85, 1.2, 0.2],
      palm: [0.85, 1.2, 0.2],
      cactus: [0.7, 1.3, 0.15],
      bush: [0.7, 1.25, 0.12],
      deadBush: [0.6, 1.1, 0.1],
      rock: [0.45, 2.2, 0.3],
    },
    // сколько разных форм у вида (генерируются при загрузке) и препятствие ствола: [радиус, высота] на масштаб 1
    forms: { pine: 3, snowPine: 2, oak: 3, birch: 2, palm: 2, bush: 3, deadBush: 2, cactus: 2 },
    trunk: { pine: [0.3, 9], snowPine: [0.3, 9], oak: [0.38, 9], birch: [0.22, 9], palm: [0.26, 7], cactus: [0.42, 3] },
    rockVariants: 3,
    autumnChance: 0.14,
  },

  // Модели деревьев: пресеты ez-tree, высота вида (м), формы — разные сиды.
  // near/mid — прореживание колец, сегментов, мелких веток и листьев для ближней и средней модели.
  trees: {
    near: { sectionStep: 2, segmentDiv: 1.6, leafKeep: 2, leafScale: 1.4 },
    mid: { sectionStep: 3, segmentDiv: 2.5, maxLevel: 1, leafKeep: 6, leafScale: 2.4, billboard: 'single' },
    impostor: { frames: 8, size: { low: 96, medium: 128, high: 192, ultra: 256 } },
    species: {
      pine: { preset: 'pine_medium', height: 18, bark: 'Pine', leaves: 'Pine', seeds: [101, 202, 303], near: { leafKeep: 3, leafScale: 1.6 }, mid: { maxLevel: 0 } },
      snowPine: { preset: 'pine_small', height: 12, bark: 'Pine', leaves: 'Pine', snowy: true, seeds: [17, 29], near: { leafKeep: 3, leafScale: 1.6 }, mid: { maxLevel: 0 } },
      oak: { preset: 'oak_medium', height: 13, bark: 'Oak', leaves: 'Oak', seeds: [7, 19, 31] },
      birch: { preset: 'aspen_medium', height: 16, bark: 'Birch', leaves: 'Aspen', recolor: [0.27, 0.4, 0.13], seeds: [5, 23] },
      bush: { preset: 'bush_2', height: 1.7, bark: 'Oak', leaves: 'Oak', seeds: [3, 9, 27], small: true },
      deadBush: { preset: 'bush_2', height: 1.1, bark: 'Oak', leaves: null, barkTint: '#a09890', seeds: [4, 8], small: true },
    },
    palm: { height: 7.5, lean: 0.9, rings: 12, fronds: 13, frondLength: 3.8, frondWidth: 1.25, frondSegments: 7 },
    cactus: { height: 3.2, radius: 0.33, ribs: 12 },
    rock: { detailNear: 4, detailFar: 1, roughness: 0.32 },
  },

  // Оттенки растительности (sRGB, множитель к текстуре: белый — без изменений).
  // У осенних дубов листва перекрашивается по яркости в эти цвета.
  vegColors: {
    pine: ['#ffffff', '#f2f7ee', '#e9f0e6', '#f7fbf0'],
    snowPine: ['#ffffff', '#eef4ee'],
    oak: ['#ffffff', '#f4f8e8', '#ecf3e2', '#fbfbea'],
    oakAutumn: ['#e8902c', '#d0582a', '#e6b43c', '#c8742a'],
    birch: ['#ffffff', '#f8f8e4', '#f0f6dc'],
    palm: ['#ffffff', '#f2f6e6'],
    cactus: ['#ffffff', '#eef6ee'],
    bush: ['#ffffff', '#eef4e4', '#e4ecda'],
    deadBush: ['#ffffff', '#ece4dc'],
    rock: {
      mountains: '#ffffff',
      desert: '#e8b48c',
      beach: '#f2ead8',
      snow: '#eef2f6',
      plains: '#f4f2ec',
      forest: '#e4e8dc',
    },
  },

  // Качество графики. Дальность — в чанках, расстояния растительности — в метрах.
  // tier — какой набор шейдеров и текстур брать: low — телефоны, ultra — мощные видеокарты.
  quality: {
    low: {
      tier: 'low',
      textures: 'lo',
      pixelRatio: 1,
      viewDistance: 4,
      lodScale: 0.75,
      vegDensity: 0.55,
      grassDensity: 0.45,
      grassFar: 26,
      treeNear: 32,
      treeMid: 90,
      treeFar: 210,
      smallFar: 55,
      shadows: false,
      shadowSize: 0,
      shadowRange: 0,
      post: false,
      msaa: 0,
      bloom: false,
    },
    medium: {
      tier: 'medium',
      textures: 'lo',
      pixelRatio: 1.5,
      viewDistance: 6,
      lodScale: 1,
      vegDensity: 0.8,
      grassDensity: 0.7,
      grassFar: 36,
      treeNear: 48,
      treeMid: 130,
      treeFar: 320,
      smallFar: 85,
      shadows: true,
      shadowSize: 1024,
      shadowRange: 42,
      post: true,
      msaa: 2,
      bloom: false,
    },
    high: {
      tier: 'high',
      textures: 'hi',
      pixelRatio: 2,
      viewDistance: 8,
      lodScale: 1.25,
      vegDensity: 1,
      grassDensity: 1,
      grassFar: 48,
      treeNear: 70,
      treeMid: 170,
      treeFar: 460,
      smallFar: 120,
      shadows: true,
      shadowSize: 2048,
      shadowRange: 60,
      post: true,
      msaa: 4,
      bloom: true,
    },
    ultra: {
      tier: 'ultra',
      textures: 'hi',
      pixelRatio: 2,
      viewDistance: 10,
      lodScale: 1.5,
      vegDensity: 1,
      grassDensity: 1,
      grassFar: 62,
      treeNear: 95,
      treeMid: 220,
      treeFar: 600,
      smallFar: 150,
      shadows: true,
      shadowSize: 4096,
      shadowRange: 85,
      post: true,
      msaa: 4,
      bloom: true,
    },
  },

  render: {
    fogNearFactor: 0.62, // у края дальности земля растворяется в небе: с этой доли дальности
    fogFarFactor: 0.97,
    adaptive: { minScale: 0.6, lowFps: 50, highFps: 58, window: 1.5 },
    mobileMaxFps: 60,
    toneMapping: 'agx',
    bloom: { strength: 0.1, radius: 0.4, threshold: 3.2 }, // порог — во сколько раз ярче белого на экране
    vignette: 0.22,
    grain: 0.018,
    saturation: 1.06,
    contrast: 1.04,
  },

  // Атмосфера и небо: физические константы рассеяния (Земля) и художественные настройки
  atmosphere: {
    planetRadius: 6360000,
    atmosphereHeight: 100000,
    rayleigh: [5.802e-6, 13.558e-6, 33.1e-6], // 1/м
    ozone: [0.65e-6, 1.881e-6, 0.085e-6],
    mieScatter: 3.996e-6,
    mieExtinction: 4.4e-6,
    rayleighHeight: 8000,
    mieHeight: 1200,
    mieG: 0.8,
    multiScatter: 0.6,
    groundAlbedo: 0.12,
    viewerAltitude: 250,
    sunIlluminance: 6, // условные единицы: белая поверхность под полуденным солнцем ≈ 1,9
    moonIlluminance: 0.16,
    moonTint: [0.55, 0.7, 1.0],
    sunTilt: 0.5, // наклон пути солнца к югу, рад
    sunDisk: { radius: 0.0055, radiance: 22 },
    moonDisk: { radius: 0.0062, brightness: 1.6 },
    stars: 0.9,
    milkyWay: 0.05,
    lut: {
      low: { width: 128, height: 64, viewSteps: 12, lightSteps: 5 },
      medium: { width: 192, height: 96, viewSteps: 18, lightSteps: 6 },
      high: { width: 256, height: 128, viewSteps: 24, lightSteps: 8 },
      ultra: { width: 256, height: 128, viewSteps: 28, lightSteps: 8 },
    },
    lutHz: 10,
    envHz: 2,
    envSize: [128, 64],
    // экспозиция: средняя яркость сцены (альбедо × освещённость / π) приводится к key
    exposure: { key: 0.2, albedo: 0.2, min: 0.12, max: 5, adapt: 1.2, airglow: 0.004 },
    fog: { density: 0.0007, falloff: 1 / 320, baseHeight: 0, sunGlow: 1, sunGlowScale: 0.012 },
    clouds: {
      altitude: 1700,
      scale: 12000, // м на плитку шума
      speed: 7, // м/с
      density: 1,
      shadow: 0.62,
      coverage: [0.08, 0.7],
      period: 3.3, // игровых суток на цикл погоды
      lightStep: 170,
      hazeDistance: 42000,
    },
  },

  // Вода: поглощение и рассеяние толщи (1/м), пена у берега, карта высот дна вокруг игрока
  water: {
    absorption: [0.42, 0.075, 0.055],
    scatter: [0.012, 0.03, 0.034],
    foamDepth: 0.55,
    normalScale: [6.5, 19],
    normalStrength: 0.55,
    heightfield: { size: 512, cell: 2, uploadHz: 4, unknownDepth: -40 },
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
