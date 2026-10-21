// «Открытый мир» — точка входа: рендер, машина состояний, игровой цикл, сохранения.
import './ui/fonts.css';
import './ui/style.css';
import * as THREE from 'three';
import { CONFIG, STEP } from './config.js';
import { World } from './world/world.js';
import { Particles } from './world/particles.js';
import { BIOMES } from './world/terrain.js';
import { parseSeed, randomSeedText } from './world/noise.js';
import { Player } from './player/controller.js';
import { Input } from './player/input.js';
import { TouchControls } from './player/touch.js';
import { Hud } from './ui/hud.js';
import { Screens, bindSettings } from './ui/screens.js';
import { DebugOverlay } from './ui/debug.js';
import { AudioEngine } from './audio/audio.js';
import { loadSave, writeSave } from './save.js';

const $ = (id) => document.getElementById(id);
const SEA = CONFIG.world.seaLevel;
const isTouchDevice = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);
document.body.classList.toggle('is-touch', isTouchDevice);
if (isTouchDevice) $('lbl-sens').textContent = 'Чувствительность обзора';

// ---------- Настройки и сохранение ----------
const saved = loadSave();
const settings = { ...CONFIG.defaults };
for (const [k, v] of Object.entries(saved.settings)) {
  if (k in settings && (settings[k] === null || typeof v === typeof settings[k])) settings[k] = v;
}
if (!CONFIG.quality[settings.quality]) settings.quality = isTouchDevice ? 'medium' : 'high';
if (!(settings.viewDistance >= 3 && settings.viewDistance <= 10)) settings.viewDistance = CONFIG.quality[settings.quality].viewDistance;
if (typeof settings.reduceMotion !== 'boolean') settings.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Рендер ----------
const canvas = $('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isTouchDevice || window.devicePixelRatio < 2,
    powerPreference: 'high-performance',
    stencil: false,
  });
} catch (e) {
  $('screen-fatal').hidden = false;
  throw e;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.player.fov.base, 1, 0.1, 1000);
camera.rotation.order = 'YXZ';

const world = new World(scene);
const particles = new Particles(scene);
const player = new Player(world);
const input = new Input(canvas);
const touch = new TouchControls($('touch'), input);
const hud = new Hud();
const screens = new Screens();
const debug = new DebugOverlay();
const audio = new AudioEngine();

const game = {
  seedText: '',
  active: false, // в этом мире уже шла игра (позицию можно сохранять)
  started: false,
};
let baseFov = CONFIG.player.fov.base;
let pixelScale = 1;
let needRender = true;
let stateName = '';
let state = null;
let settingsReturn = 'menu';

function applyPixelRatio() {
  const q = CONFIG.quality[settings.quality];
  const base = Math.min(window.devicePixelRatio || 1, q.pixelRatio);
  renderer.setPixelRatio(Math.max(0.5, base * pixelScale));
  particles.setViewportHeight(canvas.clientHeight * renderer.getPixelRatio(), camera.fov);
}

function applyQuality() {
  const q = CONFIG.quality[settings.quality];
  if (renderer.shadowMap.enabled !== q.shadows) {
    renderer.shadowMap.enabled = q.shadows;
    scene.traverse((o) => {
      if (o.material) o.material.needsUpdate = true;
    });
  }
  world.applySettings(q, settings.viewDistance, camera);
  pixelScale = 1;
  applyPixelRatio();
  needRender = true;
}

function applySettings(key) {
  input.sensitivity = settings.sensitivity;
  input.invertY = settings.invertY;
  audio.setVolumes(settings);
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
  particles.enabled = !settings.reduceMotion;
  debug.setVisible(settings.showDebug);
  if (!key || key === 'quality' || key === 'viewDistance') applyQuality();
  needRender = true;
}

function computeBaseFov(aspect) {
  const P = CONFIG.player.fov;
  const h = THREE.MathUtils.degToRad(P.minHorizontal);
  const vForH = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / aspect));
  return Math.min(P.maxVertical, Math.max(P.base, vForH));
}

function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  baseFov = computeBaseFov(camera.aspect);
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
  applyPixelRatio();
  hud.sizeCompass();
  if (touch.stickId === null) touch.resetStick();
  needRender = true;
}
window.addEventListener('resize', resize);

// ---------- Сохранения ----------
function persist() {
  if (game.active) {
    saved.seed = game.seedText;
    saved.player = player.serialize();
    saved.time = world.time;
    saved.day = world.day;
  }
  saved.settings = { ...settings };
  writeSave(saved);
}

// ---------- Мир и сид ----------
const seedInput = $('seed-input');
const menuCam = { angle: 0, focus: new THREE.Vector3() };

function hasProgress(text) {
  return saved.seed === text && !!saved.player;
}

function updatePlayLabel() {
  $('btn-play').textContent = hasProgress(seedInput.value.trim()) ? 'Продолжить' : 'Играть';
}

function setWorldSeed(text) {
  text = text.trim() || randomSeedText();
  const seed = parseSeed(text);
  game.seedText = text;
  game.active = false;
  if (seed !== world.seed || !world.terrain) world.setSeed(seed);
  const resume = hasProgress(text);
  const spot = resume ? saved.player : world.findSpawn();
  menuCam.focus.set(spot.x, Math.max(world.terrain.height(spot.x, spot.z), SEA), spot.z);
  menuCam.angle = resume ? saved.player.yaw : world.findSpawnYaw(spot.x, spot.z);
  world.time = resume && saved.time != null ? saved.time : CONFIG.time.startTime;
  world.day = resume ? saved.day : 1;
  updatePlayLabel();
}

function startGame() {
  audio.unlock();
  const text = seedInput.value.trim();
  if (text !== game.seedText || !world.terrain) setWorldSeed(text);
  seedInput.value = game.seedText;
  if (hasProgress(game.seedText)) {
    const p = saved.player;
    player.flying = !!p.flying;
    player.place(p.x, p.z, p.y, p.yaw, p.pitch);
  } else {
    const s = world.findSpawn();
    player.flying = false;
    player.place(s.x, s.z, null, world.findSpawnYaw(s.x, s.z), -0.06);
    world.time = CONFIG.time.startTime;
    world.day = 1;
  }
  game.active = true;
  if (!input.usingTouch && !isTouchDevice) input.requestLock();
  setState('loading');
}

function newWorld() {
  const text = randomSeedText();
  seedInput.value = text;
  saved.player = null;
  saved.seed = text;
  setWorldSeed(text);
  startGame();
}

function resumeGame() {
  audio.unlock();
  if (!input.usingTouch && !isTouchDevice) input.requestLock();
  setState('play');
}

// ---------- Состояния ----------
let loadingTime = 0;
let acc = 0;
const intent = { move: { x: 0, y: 0 }, run: false, up: false, down: false };
const timers = { hud: 0, biome: 0, water: 0, autosave: CONFIG.save.autosaveSec };
const biomeState = { id: -1, candidate: -1, since: 0, toasted: -1 };
let nearWater = 0;
let firstPlay = true;
let flyHinted = false;

const states = {
  menu: {
    enter() {
      screens.show('menu');
      hud.show(false);
      touch.setVisible(false);
      input.enabled = false;
      input.exitLock();
      game.active = false;
      updatePlayLabel();
      audio.setPaused(false);
    },
    update(dt) {
      world.advanceTime(dt, 0.6);
      if (!settings.reduceMotion) menuCam.angle += dt * 0.035;
      const f = menuCam.focus;
      const r = 80;
      const cx = f.x + Math.sin(menuCam.angle) * r;
      const cz = f.z + Math.cos(menuCam.angle) * r;
      const ground = Math.max(world.terrain.height(cx, cz), SEA);
      camera.position.set(cx, Math.max(ground + 16, f.y + 24), cz);
      camera.lookAt(f.x, f.y + 4, f.z);
      if (Math.abs(camera.fov - baseFov) > 0.01) {
        camera.fov = baseFov;
        camera.updateProjectionMatrix();
      }
      world.update(dt, camera, f);
      audio.update(dt, ambienceState(f, false));
    },
  },

  loading: {
    enter() {
      screens.show('loading');
      $('loading-seed').textContent = game.seedText;
      $('loading-bar').style.width = '0%';
      hud.show(false);
      touch.setVisible(false);
      loadingTime = 0;
    },
    update(dt) {
      player.applyCamera(camera, 1, baseFov, true);
      world.update(dt, camera, player.pos);
      const p = world.chunks.readiness(player.pos.x, player.pos.z, CONFIG.streaming.startRadius);
      $('loading-bar').style.width = `${Math.round(p * 100)}%`;
      loadingTime += dt;
      if (p >= 1 && loadingTime > 0.25) setState('play');
    },
  },

  play: {
    enter() {
      screens.show(null);
      hud.show(true);
      input.enabled = true;
      const touchMode = input.usingTouch || isTouchDevice;
      touch.setVisible(touchMode);
      touch.setFlying(player.flying);
      hud.setLockHint(!touchMode && !input.locked);
      audio.setPaused(false);
      acc = 0;
      biomeState.id = -1;
      timers.hud = 0;
      if (firstPlay) {
        firstPlay = false;
        hud.hint(
          touchMode
            ? 'Стик слева — идти, до края — бег. Свайп справа — осмотреться.'
            : 'WASD — идти · Shift — бег · Space — прыжок · F — полёт · Esc — пауза',
        );
      }
    },
    exit() {
      input.enabled = false;
      input.clear();
      touch.setVisible(false);
      hud.setLockHint(false);
      persist();
    },
    update(dt) {
      input.pollGamepad(dt);
      if (input.pressed('pause')) {
        setState('pause');
        return;
      }
      player.look(input.look.dx, input.look.dy);
      if (input.pressed('jump')) player.requestJump();
      if (input.pressed('fly')) {
        player.setFlying(!player.flying);
        touch.setFlying(player.flying);
        if (player.flying && !flyHinted) {
          flyHinted = true;
          hud.hint(
            input.usingTouch || isTouchDevice
              ? 'Полёт: «Вверх» и «Вниз» меняют высоту, стик до края — быстрее.'
              : 'Полёт: Space — вверх, C — вниз, Shift — быстрее, F — приземлиться.',
            6,
          );
        }
      }
      input.moveVector(intent.move);
      intent.run = input.held('run');
      intent.up = input.held('jump');
      intent.down = input.held('down');

      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        player.fixedUpdate(STEP, intent);
        acc -= STEP;
        steps++;
      }
      if (steps === 5) acc = 0;
      handlePlayerEvents();

      world.advanceTime(dt);
      player.applyCamera(camera, acc / STEP, baseFov, settings.reduceMotion);
      world.update(dt, camera, player.pos);
      particles.update(dt);
      hud.drawCompass(player.yaw);
      trackBiome(dt);

      timers.water -= dt;
      if (timers.water <= 0) {
        timers.water = 0.5;
        nearWater = sampleNearWater(player.pos.x, player.pos.z);
      }
      timers.hud -= dt;
      if (timers.hud <= 0) {
        timers.hud = 1 / CONFIG.ui.hudHz;
        hud.update({
          x: player.pos.x,
          y: player.pos.y,
          z: player.pos.z,
          biome: BIOMES[biomeState.id],
          time: world.time,
          day: world.day,
          flying: player.flying,
        });
      }
      audio.update(dt, ambienceState(player.pos, true));
      timers.autosave -= dt;
      if (timers.autosave <= 0) {
        timers.autosave = CONFIG.save.autosaveSec;
        persist();
      }
      adaptResolution(dt);
    },
  },

  pause: {
    enter() {
      screens.show('pause');
      $('pause-seed').textContent = game.seedText;
      input.exitLock();
      audio.setPaused(true);
      persist();
    },
    update() {},
  },

  settings: {
    enter() {
      screens.show('settings');
      refreshSettingsForm();
    },
    update(dt) {
      if (settingsReturn === 'menu') states.menu.update(dt);
    },
  },
};

function setState(name) {
  if (state && state.exit) state.exit();
  stateName = name;
  state = states[name];
  if (state.enter) state.enter();
  needRender = true;
}

// ---------- Игровые события: звук, частицы, подписи ----------
const SURFACE_DUST = { grass: '#a89a74', forest: '#8a7a58', sand: '#e9d3a0', snow: '#f4f7fb', rock: '#a6a197', water: '#dff2ff' };

function currentSurface() {
  if (player.wadeDepth > 0.15 || player.inWater) return 'water';
  return BIOMES[biomeState.id]?.surface || 'grass';
}

function handlePlayerEvents() {
  const surface = currentSurface();
  const { x, y, z } = player.pos;
  for (const ev of player.events) {
    switch (ev.type) {
      case 'step':
        audio.sfx?.step(surface, ev.run);
        if (surface === 'sand' || surface === 'snow') {
          particles.emit(x, y, z, { color: SURFACE_DUST[surface], count: ev.run ? 4 : 2, speed: 0.8, up: 0.8, life: 0.5, size: 0.18, gravity: 2 });
        } else if (surface === 'water') {
          particles.emit(x, SEA, z, { color: SURFACE_DUST.water, count: 3, speed: 1, up: 1.6, life: 0.45, size: 0.12, gravity: 7 });
        }
        break;
      case 'jump':
        audio.sfx?.jump(surface);
        break;
      case 'land':
        audio.sfx?.land(surface, ev.impact);
        particles.emit(x, y, z, {
          color: SURFACE_DUST[surface],
          count: Math.min(24, 6 + Math.round(ev.impact * 1.2)),
          speed: 1.5 + ev.impact * 0.12,
          up: 1.2,
          life: 0.7,
          size: 0.22,
          gravity: 3,
          spread: 0.5,
        });
        break;
      case 'splash':
        audio.sfx?.splash(ev.power);
        particles.emit(x, SEA, z, { color: SURFACE_DUST.water, count: 16 + Math.round(ev.power * 20), speed: 2.2, up: 4.5, life: 0.8, size: 0.16, gravity: 9, spread: 0.6 });
        break;
      case 'swim':
        audio.sfx?.swim();
        particles.emit(x, SEA + 0.05, z, { color: SURFACE_DUST.water, count: 4, speed: 1.2, up: 1.2, life: 0.5, size: 0.12, gravity: 6 });
        break;
      case 'fly':
        audio.sfx?.fly(ev.on);
        break;
    }
  }
  player.events.length = 0;
}

function trackBiome(dt) {
  timers.biome -= dt;
  if (timers.biome > 0) return;
  timers.biome = 0.25;
  const id = world.biomeAt(player.pos.x, player.pos.z);
  if (biomeState.id === -1) {
    biomeState.id = id;
    biomeState.candidate = id;
    biomeState.since = 0;
    if (biomeState.toasted !== id) {
      biomeState.toasted = id;
      hud.toast(BIOMES[id].name, BIOMES[id].chip);
    }
    return;
  }
  biomeState.id = id;
  if (id !== biomeState.candidate) {
    biomeState.candidate = id;
    biomeState.since = 0;
  } else {
    biomeState.since += 0.25;
    // подпись — только когда биом «устоялся», иначе в полёте она мелькала бы
    if (biomeState.since >= 1.25 && biomeState.toasted !== id) {
      biomeState.toasted = id;
      hud.toast(BIOMES[id].name, BIOMES[id].chip);
    }
  }
}

function sampleNearWater(px, pz) {
  let wet = 0;
  let total = 0;
  for (const r of [10, 28, 55]) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + r;
      const h = world.terrain.height(px + Math.cos(a) * r, pz + Math.sin(a) * r);
      const w = 1 / r;
      total += w;
      if (h < SEA) wet += w;
    }
  }
  return Math.min(1, (wet / total) * 1.6);
}

const ambient = { altitude: 0, speed: 0, flying: false, swimming: false, nearWater: 0, daylight: 1, biome: 'plains' };
const menuBiome = { key: 'plains', timer: 0 };
function ambienceState(pos, inPlay) {
  let key;
  if (inPlay) key = BIOMES[biomeState.id]?.key;
  else {
    // в меню биом под камерой меняется медленно — не пересчитываем каждый кадр
    menuBiome.timer -= 1;
    if (menuBiome.timer <= 0) {
      menuBiome.timer = 30;
      menuBiome.key = BIOMES[world.biomeAt(pos.x, pos.z)].key;
    }
    key = menuBiome.key;
  }
  ambient.altitude = pos.y - SEA;
  ambient.speed = inPlay ? (player.flying ? player.vel.length() : player.speed) : 0;
  ambient.flying = inPlay && player.flying;
  ambient.swimming = inPlay && player.swimming;
  ambient.nearWater = inPlay ? nearWater : 0.3;
  ambient.daylight = world.sky.daylight;
  ambient.biome = key || 'plains';
  return ambient;
}

// ---------- Адаптивное разрешение: держим FPS, жертвуя чёткостью ----------
const adapt = { t: 0, frames: 0, good: 0 };
function adaptResolution(dt) {
  const A = CONFIG.render.adaptive;
  adapt.t += dt;
  adapt.frames++;
  if (adapt.t < A.window) return;
  const fps = adapt.frames / adapt.t;
  adapt.t = 0;
  adapt.frames = 0;
  if (fps < A.lowFps && pixelScale > A.minScale) {
    pixelScale = Math.max(A.minScale, pixelScale - 0.1);
    adapt.good = 0;
    applyPixelRatio();
  } else if (fps > A.highFps) {
    adapt.good++;
    if (adapt.good >= 4 && pixelScale < 1) {
      pixelScale = Math.min(1, pixelScale + 0.05);
      adapt.good = 0;
      applyPixelRatio();
    }
  } else {
    adapt.good = 0;
  }
}

// ---------- Кнопки и формы ----------
function onClick(id, fn) {
  $(id).addEventListener('click', (e) => {
    audio.unlock();
    audio.sfx?.click();
    fn(e);
  });
}
onClick('btn-play', startGame);
onClick('btn-new', newWorld);
onClick('btn-settings', () => {
  settingsReturn = 'menu';
  setState('settings');
});
onClick('btn-resume', resumeGame);
onClick('btn-pause-settings', () => {
  settingsReturn = 'pause';
  setState('settings');
});
onClick('btn-pause-new', newWorld);
onClick('btn-menu', () => {
  persist();
  // в меню камера облетает место, где остановился игрок
  const p = player.pos;
  menuCam.focus.set(p.x, Math.max(world.terrain.height(p.x, p.z), SEA), p.z);
  menuCam.angle = player.yaw;
  setState('menu');
});
onClick('btn-settings-done', () => {
  persist();
  setState(settingsReturn);
});
onClick('btn-pause', () => setState('pause'));
onClick('lock-hint', () => input.requestLock());
onClick('btn-copy-seed', () => {
  const done = () => hud.toast('Сид скопирован');
  if (navigator.clipboard) navigator.clipboard.writeText(game.seedText).then(done, () => {});
});
onClick('seed-random', () => {
  const btn = $('seed-random');
  btn.classList.remove('spin');
  void btn.offsetWidth;
  btn.classList.add('spin');
  seedInput.value = randomSeedText();
  setWorldSeed(seedInput.value);
});

let seedTimer = 0;
seedInput.addEventListener('input', () => {
  updatePlayLabel();
  clearTimeout(seedTimer);
  seedTimer = setTimeout(() => {
    if (seedInput.value.trim() && seedInput.value.trim() !== game.seedText) setWorldSeed(seedInput.value);
  }, 700);
});
seedInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    seedInput.blur();
    startGame();
  }
});

canvas.addEventListener('click', () => {
  if (stateName === 'play' && !input.locked && !input.usingTouch && !isTouchDevice) input.requestLock();
});

input.onLockChange = (locked) => {
  if (stateName === 'play' && !locked && !input.usingTouch) setState('pause');
  hud.setLockHint(stateName === 'play' && !locked && !input.usingTouch && !isTouchDevice);
};
input.onAnyGesture = () => audio.unlock();

window.addEventListener('keydown', (e) => {
  if (e.target === seedInput) return;
  if (e.code === 'Backquote' || e.code === 'F3') {
    e.preventDefault();
    settings.showDebug = !settings.showDebug;
    debug.setVisible(settings.showDebug);
    refreshSettingsForm();
    persist();
  } else if (stateName === 'pause' && (e.code === 'KeyP' || e.code === 'Enter')) {
    resumeGame();
  } else if (stateName === 'settings' && e.code === 'Escape') {
    persist();
    setState(settingsReturn);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (stateName === 'play') setState('pause');
    persist();
    audio.setPaused(true);
  } else if (stateName !== 'pause' && !(stateName === 'settings' && settingsReturn === 'pause')) {
    audio.setPaused(false);
  }
});
window.addEventListener('pagehide', persist);
window.addEventListener('blur', () => {
  if (stateName === 'play' && !(input.usingTouch || isTouchDevice)) setState('pause');
});

const refreshSettingsForm = bindSettings(settings, (key) => {
  applySettings(key);
  persist();
});

// ---------- Цикл ----------
let last = performance.now();
let menuFrame = 0;
const maxFps = isTouchDevice ? CONFIG.render.mobileMaxFps : 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  if (maxFps && dt < 1 / maxFps - 0.003) return;
  last = now;
  dt = Math.min(dt, 0.25);
  debug.frame(dt);
  state.update(dt);
  hud.tick(dt);
  const live = stateName === 'play' || stateName === 'loading';
  const menuLike = stateName === 'menu' || (stateName === 'settings' && settingsReturn === 'menu');
  let render = needRender;
  if (live) render = true;
  else if (menuLike) render = !isTouchDevice || (menuFrame++ & 1) === 0;
  if (render) {
    renderer.render(scene, camera);
    needRender = false;
  }
  if (debug.visible) {
    debug.update(dt, {
      chunks: world.chunks.collectStats(),
      render: renderer.info.render,
      memory: renderer.info.memory,
      pixelRatio: renderer.getPixelRatio(),
      instances: world.veg.instances,
      player,
      seed: game.seedText,
      biome: BIOMES[world.biomeAt(player.pos.x, player.pos.z)]?.name || '',
    });
  }
  input.endFrame();
}

// ---------- Старт ----------
seedInput.value = saved.seed || randomSeedText();
applySettings();
resize();
setWorldSeed(seedInput.value);
setState('menu');
requestAnimationFrame(frame);

// Ручка для автотестов и отладки из консоли
window.__game = {
  get state() {
    return stateName;
  },
  player,
  world,
  settings,
  camera,
  renderer,
  audio,
  persist,
};
