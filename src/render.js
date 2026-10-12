import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { Water } from 'three/addons/objects/Water.js';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect } from 'postprocessing';
import { ARENA } from './locations.js';
import { solidExtent } from './solid.js';
import { ENEMY_TYPES } from './waves.js';
import { createFx } from './fx.js';
import { SKINS, WEAPONS, TRAILS, RAINBOW, lookMaterial, orbMesh, hullFor } from './cosmetics.js';
import { recolorPixels, mainClothHue } from './story/hero.js';
import { createStoryScene, zoneSaved } from './story/scene.js';

const TRAIL_LEN = 24;
const AIM_MAX = 200;
const ONE_SHOT = new Set(['Death_A', 'Death_C_Skeletons', '1H_Ranged_Shoot', 'Throw', 'Spellcast_Shoot', 'PickUp', 'Hit_A', 'Spawn_Ground']);
// Speed (m/s) at which a clip's feet stay planted: hero clips for the 1.3 m hero, skeleton clips for 1.25 m.
const STRIDE = { Running_A: 1.7, Running_Strafe_Left: 1.7, Running_Strafe_Right: 1.7, Walking_Backwards: 0.35 };
const ENEMY_STRIDE = { Running_A: 1.86, Running_B: 1.2 };
// Where each locomotion clip moves relative to the facing (radians, + is to the right).
const SECTOR = { Running_A: 0, Running_Strafe_Right: Math.PI / 2, Walking_Backwards: Math.PI, Running_Strafe_Left: -Math.PI / 2 };
// Upper-body tracks (spine and up): the arms throw while the legs keep running.
const UPPER = /^(spine|chest|head|upperarm[lr]|lowerarm[lr]|wrist[lr]|hand[lr]|handslot[lr]|elbowIK[lr]|handIK[lr])\./;
const SHOT_AT = { Throw: 0.55 }; // start just before the release (0.72 s), so the hand lets go as the projectile leaves
const SHOOT_T = 0.5;
// Resting pose of a dropped projectile per spin mode: tilt of the spinner and height of its middle.
const DROP_POSE = { tumble: { x: Math.PI - 0.6, y: 0.25 }, point: { x: 0.96, y: 0.2 }, whirl: { x: 0.96, y: 0.32 }, disc: { x: 0, y: 0.05 }, roll: { x: 0, y: 0.14 } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a)); // signed shortest turn from a to b
const kitFor = (model) => (model.startsWith('enemy-ufo') ? 'towerdefense' : model.startsWith('Skeleton_') ? 'skeletons' : 'heroes');
// Decor that carries a flame; y is the flame height as a fraction of the model height.
const FLAMES = {
  torch_lit: { y: 0.95 }, candle_triple: { y: 1.0, scale: 0.6 }, lantern_standing: { y: 0.8, scale: 0.7 },
  skull_candle: { y: 1.0, scale: 0.6 }, pumpkin_orange_jackolantern: { y: 0.55, scale: 0.8 }, lantern: { y: 0.6, scale: 0.6 },
};

export function createRenderer(canvas, { quality = 'high' } = {}) {
  const high = quality === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 2 : 1.5));
  renderer.shadowMap.enabled = high;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.3, 120);
  const loader = new GLTFLoader();
  const texLoader = new THREE.TextureLoader();
  const cache = new Map();
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const fx = createFx(scene, { budget: high ? 1 : 0.5 });
  let rect = canvas.getBoundingClientRect(); // cached: reading it every touch/frame forces a layout

  // Bloom + vignette on the "beautiful" setting; plain rendering otherwise (cheaper, cooler phone).
  let composer = null, bloom = null;
  if (high) {
    composer = new EffectComposer(renderer, { multisampling: 4 });
    composer.addPass(new RenderPass(scene, camera));
    bloom = new BloomEffect({ intensity: 1.1, luminanceThreshold: 0.72, luminanceSmoothing: 0.25, mipmapBlur: true });
    composer.addPass(new EffectPass(camera, bloom,
      new VignetteEffect({ darkness: 0.42, offset: 0.32 })));
  }

  const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1.4);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-6, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 18, bottom: -18, near: 1, far: 50 });
  const heroLight = new THREE.PointLight(0xffe2a8, 0, 10, 1.6);
  scene.add(hemi, sun, sun.target, heroLight);

  let level = null;                   // everything that belongs to the current location
  const heroRoot = new THREE.Group(); // hero + its projectile visuals (swapped when the hero changes)
  scene.add(heroRoot);
  const occluders = [];               // obstacles that fade out when they hide the hero
  let hero = null;
  let heroDef = null;
  let water = null;
  const enemyViews = new Map();
  const dying = [];
  let proj = null;
  let menuSpin = 0;
  let look = null; // current location's light and fog (see locations.js)
  let gear = { skin: null, weapon: null, trail: null }; // cosmetics worn (shop ids; null = the default look)
  let orbit = false; // shop trail preview: the weapon circles the hero
  let orbitA = 0;
  let storyOn = false;   // a story zone is on show (setZone)
  let enemyTint = null;  // its skeletons' color (sandy, icy, mossy…)

  // Dark patches where skeletons climb out of the ground (a short warning before they come).
  const decals = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), new THREE.MeshBasicMaterial({ color: 0x140e0a, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.025; m.visible = false; m.userData.t = 0;
    scene.add(m);
    return m;
  });
  let decalI = 0;

  // The golden zone: kills inside it score ×3; it moves every wave (pops in at its new spot).
  const zone = new THREE.Group();
  const zoneRing = new THREE.Mesh(new THREE.RingGeometry(1.86, 2, 48), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.9, depthWrite: false }));
  const zoneFill = new THREE.Mesh(new THREE.CircleGeometry(1.86, 48), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.14, depthWrite: false }));
  for (const m of [zoneRing, zoneFill]) m.rotation.x = -Math.PI / 2;
  zone.add(zoneRing, zoneFill);
  zone.position.y = 0.035; zone.visible = false; zone.userData = { x: NaN, z: NaN, pop: 1 };
  scene.add(zone);
  function syncZone(g, dt) {
    const z = g.zone;
    zone.visible = !!z && !g.over;
    if (!z) return;
    const u = zone.userData;
    if (z.x !== u.x || z.z !== u.z) { u.x = z.x; u.z = z.z; u.pop = 0; zone.position.x = z.x; zone.position.z = z.z; }
    u.pop = Math.min(1, u.pop + dt / 0.35);
    const k = u.pop < 1 ? 1 - (1 - u.pop) ** 3 : 1;
    zone.scale.setScalar((z.r / 2) * (0.4 + 0.6 * k));
    zoneRing.material.opacity = 0.75 + 0.2 * Math.sin(g.time * 4);
  }
  function decal(x, z) {
    const m = decals[decalI++ % decals.length];
    m.position.x = x; m.position.z = z; m.userData.t = 1.3; m.visible = true;
  }

  // ---------- assets ----------
  function loadModel(kit, name) {
    const key = `${kit}/${name}`;
    if (!cache.has(key)) cache.set(key, loader.loadAsync(`assets/${kit}/${name}.glb`));
    return cache.get(key);
  }

  function prepare(obj) {
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = renderer.shadowMap.enabled; o.receiveShadow = true; } });
    return obj;
  }

  // Scale a model so its footprint radius (or height) matches the simulation. `center` puts the middle
  // of its footprint on the origin (some kit pieces sit off-center, e.g. on a hex tile's edge).
  function fit(obj, { r, height, center = false }) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const s = height ? height / size.y : (r * 2) / Math.max(size.x, size.z, 1e-3);
    obj.scale.multiplyScalar(s);
    const b2 = new THREE.Box3().setFromObject(obj);
    obj.position.y -= b2.min.y;
    if (center) { const c = b2.getCenter(new THREE.Vector3()); obj.position.x -= c.x; obj.position.z -= c.z; }
    const wrap = new THREE.Group();
    wrap.add(obj);
    return wrap;
  }

  async function instance(kit, name, opts) {
    const gltf = await loadModel(kit, name);
    const obj = prepare(cloneSkinned(gltf.scene)); // skeleton-aware clone (KayKit characters are skinned)
    if (opts.lay) { obj.rotation.x = Math.PI / 2; obj.updateMatrixWorld(true); }
    return { obj: fit(obj, opts), animations: gltf.animations, inner: obj };
  }

  // Switch a view (or one body layer of the hero) to a clip. Returns the new action, if it switched.
  // `at` starts the clip at that time.
  function animate(v, clipName, fade = 0.15, at = null) {
    if (!v.mixer || v.current === clipName) return null;
    const clip = THREE.AnimationClip.findByName(v.animations, clipName);
    if (!clip) return null;
    const next = v.mixer.clipAction(clip);
    if (next === v.action) {
      // Same clip asked again (e.g. after a shot while running): never fade an action into itself —
      // that drives its weight to 0 and leaves the rig in the rest pose. Restart one-shots only.
      if (ONE_SHOT.has(clipName)) { next.reset().setEffectiveWeight(1).play(); if (at !== null) next.time = at; }
      v.current = clipName;
      return null;
    }
    if (ONE_SHOT.has(clipName)) { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; }
    const prev = v.action;
    next.reset();
    next.timeScale = 1;
    // Between two locomotion clips keep the feet in step (same phase of the stride).
    if (prev && STRIDE[clipName] && STRIDE[v.current]) next.time = (prev.time / prev.getClip().duration) * clip.duration;
    if (at !== null) next.time = at;
    if (fade > 0) {
      next.fadeIn(fade).play();
      if (prev) prev.fadeOut(fade);
    } else { // a zero-length fade divides by zero inside three.js and leaves the rig in T-pose
      next.setEffectiveWeight(1).play();
      if (prev && prev !== next) prev.stop();
    }
    v.action = next;
    v.current = clipName;
    return next;
  }

  // Tileable normal map for the water shader, generated instead of downloaded.
  function waterNormals() {
    const N = 128, c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d'), img = g.createImageData(N, N);
    const h = (x, y) => Math.sin((x / N) * Math.PI * 4) * 0.5 + Math.sin(((x + y) / N) * Math.PI * 6) * 0.3 + Math.sin((y / N) * Math.PI * 8 + Math.sin((x / N) * Math.PI * 2) * 2) * 0.4;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
      const nx = -dx * 2, ny = -dy * 2, l = Math.hypot(nx, ny, 1), i = (y * N + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255; img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // ---------- level ----------
  // Own materials so this obstacle alone can fade when it hides the hero from the camera.
  function addOccluder(obj, x, z, r) {
    const mats = [];
    obj.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); mats.push(m.material); } });
    occluders.push({ x, z, r, h: new THREE.Box3().setFromObject(obj).max.y, mats, fade: 1 });
  }

  // An empty level with the place's sky, fog and light (an arcade location or a story zone).
  function newLevel(loc) {
    if (level) { scene.remove(level); level.traverse((o) => o.geometry?.dispose?.()); }
    for (const v of enemyViews.values()) scene.remove(v.obj);
    enemyViews.clear();
    dying.length = 0;
    water = null;
    occluders.length = 0;
    if (storyOn) storyScene.clear();
    storyOn = false; enemyTint = null;
    fx.setWeather(null);
    sun.target.position.set(0, 0, 0);
    level = new THREE.Group();

    const sky = loc.look.bg !== undefined ? null : texLoader.load(`assets/sky/sky-${loc.sky}.jpg`);
    if (sky) { sky.mapping = THREE.EquirectangularReflectionMapping; sky.colorSpace = THREE.SRGBColorSpace; }
    const L = look = loc.look;
    scene.background = L.bg !== undefined ? new THREE.Color(L.bg) : sky; // fog-colored where the fog hides the sky
    scene.fog = new THREE.Fog(L.fog, L.near, L.far);
    hemi.color.setHex(L.hemi[0]); hemi.groundColor.setHex(L.hemi[1]); hemi.intensity = L.hemi[2];
    sun.color.setHex(L.sun[0]); sun.intensity = L.sun[1];
    sun.position.set(...(L.sunPos || [-6, 14, 6]));
    heroLight.intensity = loc.rule?.heroLight ? 40 : 0;
    if (bloom) bloom.intensity = loc.bloom ?? 1.1; // bright scenes (snow) would wash out
  }

  async function setLocation(loc, layout) {
    newLevel(loc);

    const outer = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: new THREE.Color(loc.ground).multiplyScalar(0.78) }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.W * 2, ARENA.D * 2), new THREE.MeshLambertMaterial({ color: loc.ground }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    level.add(outer, floor);

    const wallMat = loc.rule.wrap
      ? new THREE.MeshBasicMaterial({ color: loc.wall, transparent: true, opacity: 0.55 }) // glowing portal walls
      : new THREE.MeshLambertMaterial({ color: loc.wall });
    const wallH = loc.rule.wrap ? 0.25 : 0.5, t = 0.3;
    for (const [w, d, x, z] of [
      [ARENA.W * 2 + t * 2, t, 0, -ARENA.D - t / 2], [ARENA.W * 2 + t * 2, t, 0, ARENA.D + t / 2],
      [t, ARENA.D * 2, -ARENA.W - t / 2, 0], [t, ARENA.D * 2, ARENA.W + t / 2, 0],
    ]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
      m.position.set(x, wallH / 2, z); m.castShadow = m.receiveShadow = !loc.rule.wrap;
      level.add(m);
    }

    if (loc.rule.river) {
      const r = loc.rule.river, geo = new THREE.PlaneGeometry(ARENA.W * 2 + 8, r.half * 2);
      if (high) {
        water = new Water(geo, {
          textureWidth: 256, textureHeight: 256, waterNormals: waterNormals(),
          sunDirection: sun.position.clone().normalize(), sunColor: 0xffffff, waterColor: 0x1d6f9e, distortionScale: 2.2, fog: true,
        });
        water.material.uniforms.size.value = 3;
      } else {
        water = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x3aa0e0, transparent: true, opacity: 0.85 }));
      }
      water.rotation.x = -Math.PI / 2; water.position.set(0, 0.02, r.z);
      level.add(water);
    }

    const jobs = [];
    const flames = [];
    for (const o of layout.solids) {
      jobs.push(instance(o.kit, o.model, { ...o.fit, center: true }).then(({ obj }) => {
        obj.position.set(o.x, 0, o.z); obj.rotation.y = o.rot; level.add(obj);
        addOccluder(obj, o.x, o.z, solidExtent(o));
      }));
    }
    for (const o of layout.decor) {
      jobs.push(instance(o.kit, o.model, { r: o.fit }).then(({ obj }) => {
        obj.position.set(o.x, 0, o.z); obj.rotation.y = o.rot; level.add(obj);
        const hgt = new THREE.Box3().setFromObject(obj).max.y;
        if (hgt > 1.2) addOccluder(obj, o.x, o.z, o.fit); // tall edge trees/buildings can hide the hero at the walls
        const f = FLAMES[o.model];
        if (f) flames.push({ x: o.x, y: hgt * f.y, z: o.z, scale: f.scale ?? 1 });
      }));
    }
    await Promise.all(jobs);
    fx.setFlames(flames);
    scene.add(level);
    // Warm up enemy models so the first wave doesn't stutter.
    await Promise.all(Object.values(ENEMY_TYPES).flatMap((t) => t.model).map((m) => loadModel(kitFor(m), m)));
  }

  // ---------- story zones ----------
  // A zone of the story's island, drawn by story/scene.js. A saved kingdom gets its clear sky back.
  async function setZone(area, story) {
    const saved = zoneSaved(area, story);
    newLevel({ ...area, look: saved && area.lookDone ? area.lookDone : area.look });
    storyOn = true;
    enemyTint = area.enemyTint !== undefined ? new THREE.Color(area.enemyTint) : null;
    heroLight.intensity = area.dark ? 30 : 0;
    const own = level;
    await storyScene.build(area, story, level);
    if (own !== level) return; // another place was opened while this one loaded
    scene.add(level);
    await Promise.all(Object.values(ENEMY_TYPES).flatMap((t) => t.model).map((m) => loadModel(kitFor(m), m)));
  }

  let lastG = null; // the story world last drawn (scene.js effects look up enemies in it)
  function syncStory(g, dt) {
    lastG = g;
    storyScene.sync(g, dt, camera);
    if (hero) hero.obj.visible = !(g.hurtT > 0 && !g.over) || Math.floor(g.time * 14) % 2 === 0; // blinks while safe after a hit
    // The sun's shadow box follows the hero around the big zone.
    const [sx, sy, sz] = look.sunPos || [-6, 14, 6];
    sun.position.set(g.hero.x + sx, sy, g.hero.z + sz);
    sun.target.position.set(g.hero.x, 0, g.hero.z);
  }

  // The creator's outfit colors: the KayKit atlas recolored once per model, palette and skin tone.
  const recolors = new Map();
  // uvs: the texture coordinates of the meshes that wear it (the clothes' main color is read there).
  function recolorMaterial(mat, { palette, skin }, uvs) {
    const key = `${mat.uuid}:${palette.id}:${skin.id}`;
    if (recolors.has(key)) return recolors.get(key);
    let out = mat;
    const src = mat.map;
    if (src?.image && (palette.hue !== undefined || skin.light !== 1)) {
      const N = 512, c = document.createElement('canvas');
      c.width = c.height = N;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(src.image, 0, 0, N, N);
      const d = ctx.getImageData(0, 0, N, N);
      recolorPixels(d.data, palette, skin, mainClothHue(d.data, N, uvs));
      ctx.putImageData(d, 0, 0);
      const tex = new THREE.CanvasTexture(c);
      for (const k of ['flipY', 'colorSpace', 'wrapS', 'wrapT', 'magFilter', 'minFilter']) tex[k] = src[k];
      out = mat.clone();
      out.map = tex;
    }
    recolors.set(key, out);
    return out;
  }

  // ---------- hero ----------
  async function setHero(def) {
    heroDef = def;
    const h = await instance('heroes', def.model, { height: 1.3 });
    if (heroDef !== def) return; // another hero was picked while this one loaded
    h.obj.updateMatrixWorld(true);
    // Show only this hero's props (the KayKit model carries every prop of its class in the hands).
    const held = []; // what is in the hand only while the projectile is (the thrown prop, a staff gem)
    let staff = null;
    for (const side of ['handslot.l', 'handslot.r']) {
      const slot = h.inner.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(side)); // GLTFLoader drops the dot: 'handslotr'
      for (const c of slot?.children ?? []) {
        c.visible = def.hold.includes(c.name);
        if (c.name === def.heldProp) held.push(c);
        if (c.visible && /Staff|Wand/.test(c.name)) staff = c;
      }
    }
    const S = def.recolor ? null : SKINS[gear.skin], W = WEAPONS[gear.weapon];
    if (def.recolor) {
      const body = [];
      h.inner.traverse((m) => { if (m.isMesh && !/handslot/.test(m.parent?.name ?? '')) body.push(m); });
      const uvs = body.flatMap((m) => Array.from(m.geometry.attributes.uv?.array ?? []));
      for (const m of body) m.material = recolorMaterial(m.material, def.recolor, uvs);
    } else if (S) { // one restyled body material for the whole hero (all KayKit parts share one atlas material)
      let bodyMat = null;
      h.inner.traverse((m) => { if (m.isMesh && !/handslot/.test(m.parent?.name ?? '')) { bodyMat ??= lookMaterial(m.material, S); m.material = bodyMat; if (S.shadow === false) m.castShadow = false; } });
    } else if (def.tint) {
      const tint = new THREE.Color(def.tint);
      h.inner.traverse((m) => { if (m.isMesh && !/handslot/.test(m.parent?.name ?? '')) { m.material = m.material.clone(); m.material.color.multiply(tint); } });
    }
    const restyle = (root) => { // weapon skin on a prop or projectile model (own material copy)
      if (!W) return;
      let mat = null;
      const meshes = [];
      root.traverse((m) => { if (m.isMesh && !m.userData.hull) meshes.push(m); });
      for (const m of meshes) {
        mat ??= lookMaterial(m.material, W.mat);
        m.material = mat;
        if (W.hull) { const hl = hullFor(m, W.hull); hl.userData.hull = true; m.add(hl); }
      }
    };
    for (const side of ['handslotl', 'handslotr']) {
      for (const c of h.inner.getObjectByName(side)?.children ?? []) if (c.visible && !/Spellbook/.test(c.name)) restyle(c);
    }
    // Ground ring so the hero stands out from the skeletons.
    const mark = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 28), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.9 }));
    mark.rotation.x = -Math.PI / 2; mark.position.y = 0.03;
    h.obj.add(mark);

    // Projectile: group (position) → dir (heading) → bank (tilt) → spinner (spin) → align → model.
    const color = def.color;
    const group = new THREE.Group(), dir = new THREE.Group(), bank = new THREE.Group(), spinner = new THREE.Group();
    group.add(dir); dir.add(bank); bank.add(spinner);
    const mode = def.proj.orb ? 'orb' : def.proj.spin;
    if (!def.proj.orb) {
      const p = await instance(def.proj.kit, def.proj.model, def.proj.len ? { height: def.proj.len } : { r: 0.32 });
      if (heroDef !== def) return;
      p.obj.position.sub(new THREE.Box3().setFromObject(p.obj).getCenter(new THREE.Vector3())); // spin around its middle
      const align = new THREE.Group();
      if (mode === 'tumble') align.rotation.y = Math.PI / 2;     // blade plane along the flight path
      else if (mode === 'disc') align.rotation.x = -Math.PI / 2; // lies flat, like a frisbee
      else if (mode === 'point' || mode === 'whirl') align.rotation.x = Math.PI / 2; // tip forward / flat blade
      restyle(p.obj);
      align.add(p.obj);
      spinner.add(align);
      if (def.handCopy) { // a half-size copy rides in the hand while the projectile is held
        const copy = prepare((await loadModel(def.proj.kit, def.proj.model)).scene.clone());
        if (heroDef !== def) return;
        copy.scale.setScalar(0.5); copy.quaternion.set(0, -1, 0, 0); // same mount as the KayKit hand props
        restyle(copy);
        h.inner.getObjectByName('handslotr')?.add(copy);
        held.push(copy);
      }
    } else {
      spinner.add(W ? orbMesh(W, 0.2) : new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6) })));
      if (staff?.geometry) { // a glowing gem on the staff/wand tip: the spell is ready
        staff.geometry.computeBoundingBox();
        const b = staff.geometry.boundingBox, ws = staff.getWorldScale(new THREE.Vector3()).x || 1;
        const gem = W ? orbMesh(W, 0.08 / ws) : new THREE.Mesh(new THREE.SphereGeometry(0.08 / ws, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6) }));
        gem.position.set((b.min.x + b.max.x) / 2, b.max.y + 0.05 / ws, (b.min.z + b.max.z) / 2);
        staff.add(gem);
        held.push(gem);
      }
    }
    const accent = W?.accent ?? color;
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.35, depthWrite: false }));
    group.add(glow);
    // Where the dropped projectile lies: a ring on the ground and a light beam you can see from afar.
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 10, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
    const T = TRAILS[gear.trail];
    let trailMat;
    if (T?.line === 'rainbow') { // vertex colors: red at the head … violet at the tail
      const cols = new Float32Array(TRAIL_LEN * 3), c = new THREE.Color();
      for (let i = 0; i < TRAIL_LEN; i++) { const f = (i / (TRAIL_LEN - 1)) * (RAINBOW.length - 1), k = Math.floor(f); c.setHex(RAINBOW[k]).lerp(new THREE.Color(RAINBOW[Math.min(k + 1, RAINBOW.length - 1)]), f - k); cols.set([c.r, c.g, c.b], i * 3); }
      trailGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      trailMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
    } else trailMat = new THREE.LineBasicMaterial({ color: T?.line ?? accent, transparent: true, opacity: 0.8 });
    const trail = new THREE.Line(trailGeo, trailMat);
    fx.setTrailStyle(gear.trail || 'default', accent);
    fx.setAura(S?.aura);
    trail.frustumCulled = false;
    const hole = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({ color: 0x1a0830, transparent: true, opacity: 0.7 }));
    hole.visible = false;
    // Aim line: dashed preview of the real trajectory while a finger is held, plus bright dots.
    const aimGeo = new THREE.BufferGeometry();
    aimGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AIM_MAX * 3), 3));
    const aim = new THREE.Line(aimGeo, new THREE.LineDashedMaterial({ color, dashSize: 0.35, gapSize: 0.2, transparent: true, opacity: 0.9 }));
    aim.frustumCulled = false; aim.visible = false;
    const aimEnd = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.38, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    aimEnd.rotation.x = -Math.PI / 2; aimEnd.visible = false;
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color }), AIM_MAX);
    dots.count = 0; dots.frustumCulled = false;

    heroRoot.clear();
    heroRoot.add(h.obj, group, ring, beacon, trail, hole, aim, aimEnd, dots);
    group.visible = ring.visible = beacon.visible = false;
    // One mixer, two layers: legs (locomotion) and arms (locomotion, or the throw while it plays).
    const mixer = new THREE.AnimationMixer(h.inner);
    const layer = (upper) => ({ mixer, animations: h.animations.map((c) => new THREE.AnimationClip(c.name, c.duration, c.tracks.filter((t) => UPPER.test(t.name) === upper))) });
    hero = { obj: h.obj, mixer, legs: layer(false), arms: layer(true), shootClip: def.shoot, held: held.map((node) => ({ node, base: node.scale.clone() })), popT: 1, sector: null };
    animate(hero.legs, 'Idle', 0);
    animate(hero.arms, 'Idle', 0);
    proj = { group, dir, bank, spinner, mode, glow, ring, beacon, trail, hole, aim, aimEnd, dots, color, accent, filled: 0, heading: 0, turn: 0, px: 0, pz: 0, dropT: -1 };
    if (menu) placeCamera();
  }

  async function addEnemyView(e) {
    const def = ENEMY_TYPES[e.type];
    const scale = e.scale ?? def.scale;
    const v = await instance(kitFor(e.model), e.model, def.flying ? { r: e.r } : { height: 1.25 * scale });
    // Own materials (clones share them) so a hit can flash just this one white.
    const mats = [];
    v.obj.traverse((m) => { if (m.isMesh && m.material.emissive) { m.material = m.material.clone(); m.material.emissive.setRGB(1, 1, 1); m.material.emissiveIntensity = 0; mats.push(m.material); } });
    for (const m of mats) {
      if (enemyTint) m.color.multiply(enemyTint);
      if (e.decoy) Object.assign(m, { transparent: true, opacity: 0.5, depthWrite: false }); // the Mirror Mage's clones
    }
    if (e.boss?.def.crown) { // the Skeleton King
      const c = storyScene.crown(0xb56cff);
      c.scale.setScalar(scale * 1.15);
      c.position.y = new THREE.Box3().setFromObject(v.obj).max.y - 0.1 * scale;
      v.obj.add(c);
    }
    const walk = e.type === 'runner' ? 'Running_A' : 'Running_B';
    const vw = { obj: v.obj, animations: v.animations, mixer: v.animations.length ? new THREE.AnimationMixer(v.inner) : null, flying: def.flying,
      walk, stride: ENEMY_STRIDE[walk] * scale, spd: e.speed, pop: e.split ? 0 : 1, flash: 0, mats, knock: null };
    const a = animate(vw, e.rise > 0 ? 'Spawn_Ground' : walk, 0);
    if (a && e.rise > 0) a.timeScale = a.getClip().duration / Math.max(0.4, e.rise); // out of the ground exactly when the rise ends
    v.obj.position.set(e.x, 0, e.z);
    level.add(v.obj);
    return vw;
  }

  // ---------- effects ----------
  let trauma = 0, shakeT = 0; // camera shake: trauma 0..1 decays; the shake is trauma²
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const kick = (a) => { if (!calm.matches) trauma = Math.min(1, trauma + a); };
  let shotFace = null;

  function effect(ev) {
    const c = proj?.accent ?? 0xffffff, t = ev.type;
    if (t === 'kill') {
      fx.burst('hit', ev.x, 0.7, ev.z, c);
      const v = enemyViews.get(ev.id);
      if (v) {
        v.flash = 1;
        // The body flies along the shot (or away from a slow projectile / explosion).
        const fast = Math.hypot(ev.vx || 0, ev.vz || 0) > 2;
        const dx = fast ? ev.vx : ev.x - (ev.px ?? ev.x), dz = fast ? ev.vz : ev.z - (ev.pz ?? ev.z), l = Math.hypot(dx, dz);
        v.knock = { x: l > 1e-3 ? dx / l : 0, z: l > 1e-3 ? dz / l : -1, big: ev.combo >= 3 };
      }
      kick(Math.min(0.7, 0.3 + 0.1 * (ev.combo - 1)));
    } else if (t === 'hurt') {
      fx.burst('spark', ev.x, 0.8, ev.z, 0xffffff);
      const v = enemyViews.get(ev.id);
      if (v) v.flash = 1;
    } else if (t === 'bounce' || t === 'chain') fx.burst('spark', ev.x, 0.55, ev.z, c);
    else if (t === 'explode') { fx.burst('big', ev.x, 0.6, ev.z, c); kick(0.6); }
    else if (t === 'death') { fx.burst('big', ev.x, 0.8, ev.z, 0xff4d4d); kick(0.6); }
    else if (t === 'catch' || t === 'pickup' || t === 'return') { fx.burst('ring', ev.x, 0.6, ev.z, 0xffffff); if (t === 'catch') kick(0.2); }
    else if (t === 'shield') {
      fx.burst('ring', ev.x, 0.8, ev.z, 0x5fd0ff); kick(0.4);
      const v = enemyViews.get(ev.id);
      if (v) { const dx = ev.x - heroPos.x, dz = ev.z - heroPos.z, l = Math.hypot(dx, dz) || 1; v.flash = 1; v.knock = { x: dx / l, z: dz / l, big: true }; }
    } else if (t === 'drop') fx.burst('dust', ev.x, 0.05, ev.z, 0x6e6252);
    else if (t === 'recall') { fx.burst('ring', ev.x, 0.6, ev.z, c); kick(0.15); }
    else if (t === 'spawn' && !ev.flying) { fx.burst('dust', ev.x, 0.05, ev.z, 0x6e6252); decal(ev.x, ev.z); }
    else if (t === 'hit') { fx.burst('big', ev.x, 0.9, ev.z, 0xff4d4d); kick(0.5); }
    else if (t === 'faint') { fx.burst('big', ev.x, 0.8, ev.z, 0xff4d4d); kick(0.6); }
    else if (t === 'heal') fx.burst('ring', ev.x, 0.9, ev.z, 0x7ee07a);
    else if (t === 'wake') fx.burst('ring', ev.x, 0.6, ev.z, 0xffd34d);
    else if (t === 'target') { fx.burst('hit', ev.x, 1.0, ev.z, 0xffd34d); kick(0.25); }
    else if (t === 'block') { fx.burst('ring', ev.x, 1.2, ev.z, 0x9fd8ff); kick(0.2); }
    else if (t === 'bossDown') { fx.burst('big', ev.x, 1, ev.z, 0xffe27a); fx.burst('big', ev.x, 1.4, ev.z, 0xff4d4d); kick(0.9); }
    else if (t === 'bossStunned') { const v = enemyViews.get(ev.id); if (v) fx.burst('ring', v.obj.position.x, 2.4, v.obj.position.z, 0xffe27a); }
    else if (t === 'shoot') {
      shootT = SHOOT_T;
      shotFace = ev.tx !== undefined ? Math.atan2(ev.tx - ev.x, ev.tz - ev.z) : null;
      if (hero) hero.arms.current = null; // restart the throw even if the last one is still playing
    }
    if (storyOn && lastG) storyScene.effect(ev, lastG);
  }

  // A hit flashes the enemy white; «Иней» (ice) tints it frosty blue while it stays frozen.
  function flash(v, dt, ice = false) {
    if (v.flash <= 0 && ice === !!v.ice) return;
    v.flash = Math.max(0, v.flash - dt / 0.1); // stays white through a hit-stop (dt 0)
    v.ice = ice;
    for (const m of v.mats) {
      if (v.flash > 0 || !ice) { m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 1.6 * v.flash; }
      else { m.emissive.setRGB(0.3, 0.7, 1); m.emissiveIntensity = 0.9; }
    }
  }

  // ---------- per frame ----------
  const pending = new Set();
  // Fade obstacles standing between the camera and the hero (third person and the menu close-ups),
  // but only those the camera→chest line really passes through, not the low ones it flies over.
  function fadeOccluders(dt) {
    const active = menu || view === 'tps';
    const ax = camera.position.x, ay = camera.position.y, az = camera.position.z, bx = heroPos.x - ax, bz = heroPos.z - az;
    for (const o of occluders) {
      let target = 1;
      if (active) {
        const t = clamp(((o.x - ax) * bx + (o.z - az) * bz) / (bx * bx + bz * bz || 1), 0, 1);
        if (Math.hypot(ax + bx * t - o.x, az + bz * t - o.z) < o.r + 0.5 && ay + (0.9 - ay) * t < o.h + 0.2) target = 0.22;
      }
      if (o.fade === target) continue;
      o.fade = Math.abs(o.fade - target) < 0.01 ? target : o.fade + (target - o.fade) * Math.min(1, dt * 10);
      const see = o.fade < 0.99; // transparent only while fading: opaque objects are cheaper and sort right
      for (const m of o.mats) {
        m.opacity = o.fade; m.depthWrite = o.fade > 0.9;
        if (m.transparent !== see) { m.transparent = see; m.needsUpdate = true; }
      }
    }
  }

  // Locomotion clip for the move direction relative to the facing; keeps the current one until the
  // direction is well inside another sector (no flicker around 45°).
  function locomotion(g, face) {
    const m = g.hero.moving, sf = Math.sin(face), cf = Math.cos(face);
    const a = Math.atan2((g.hero.vz * sf - g.hero.vx * cf) / m, (g.hero.vx * sf + g.hero.vz * cf) / m);
    const off = (n) => Math.abs(angleTo(a, SECTOR[n]));
    if (hero.sector && off(hero.sector) < Math.PI / 4 + 0.2) return hero.sector;
    hero.sector = Object.keys(SECTOR).reduce((b, n) => (off(n) < off(b) ? n : b));
    return hero.sector;
  }

  function syncHero(g, dt) {
    const tps = view === 'tps', p = g.projectile;
    let goal = tps ? yaw + Math.PI : g.hero.facing; // third person: face where the camera looks…
    if (tps && shootT > 0 && shotFace !== null) goal = shotFace; // …except toward the shot while throwing
    heroFace += angleTo(heroFace, goal) * (1 - Math.exp(-25 * dt));
    hero.obj.position.copy(heroPos);
    hero.obj.rotation.y = heroFace;
    shootT = Math.max(0, shootT - dt);
    let legs = 'Idle', ts = 1;
    if (g.over) legs = 'Death_A';
    else if (g.choosing) legs = 'Cheer';
    else if (g.hero.moving > 0.4) {
      legs = tps ? locomotion(g, heroFace) : 'Running_A';
      // Play the stride as fast as the hero really moves, so the feet don't slide.
      if (legs === 'Walking_Backwards' && g.hero.moving > 2) { legs = 'Running_A'; ts = -1.8; } // a run played backwards
      else ts = clamp(g.hero.moving / STRIDE[legs], 0.6, 1.9);
    } else hero.sector = null;
    const L = hero.legs, A = hero.arms;
    animate(L, legs, 0.12);
    if (L.action) L.action.timeScale = ts;
    const arms = !g.over && !g.choosing && shootT > 0 ? hero.shootClip : legs;
    if (arms === hero.shootClip) animate(A, arms, 0.06, SHOT_AT[arms] ?? 0);
    else if (A.current !== arms) animate(A, arms, 0.15, L.action?.time ?? 0); // back in step with the legs
    if (A.current === legs && A.action) A.action.timeScale = ts;
    hero.mixer.update(dt);
    // The thrown prop leaves the hand; it pops back in when the projectile returns.
    const inHand = p.state === 'held';
    for (const h of hero.held) {
      if (inHand && !h.node.visible) hero.popT = 0;
      h.node.visible = inHand;
    }
    if (hero.popT < 0.18) {
      hero.popT += dt;
      const k = Math.min(1, hero.popT / 0.18), s = k < 0.6 ? (k / 0.6) * 1.25 : 1.25 - (0.25 * (k - 0.6)) / 0.4;
      for (const h of hero.held) h.node.scale.copy(h.base).multiplyScalar(s);
    }
    heroLight.position.set(g.hero.x, 2.5, g.hero.z);
    fx.moveAura(g.hero.x, 0.75, g.hero.z, true);
  }

  function syncProjectile(g, dt) {
    const p = g.projectile, s = proj.spinner;
    const flying = p.state === 'flying', dropped = p.state === 'dropped';
    proj.group.visible = !!p.state && p.state !== 'held';
    proj.glow.visible = flying;
    proj.ring.visible = proj.beacon.visible = dropped;
    proj.group.scale.setScalar((p.r || 0.3) / 0.3); // the big-projectile perk shows
    // Heading from the visual motion, so it also follows curved paths (snake, spiral, orbit).
    const mx = p.x - proj.px, mz = p.z - proj.pz;
    if (flying && mx * mx + mz * mz > 1e-6) {
      const hd = Math.atan2(mx, mz);
      proj.turn = dt > 0 ? angleTo(proj.heading, hd) / dt : 0;
      proj.heading = hd;
    }
    proj.px = p.x; proj.pz = p.z;
    proj.dir.rotation.y = proj.heading;
    let y = 0.6;
    if (p.state === 'held') { s.rotation.set(0, 0, 0); proj.bank.rotation.z = 0; proj.dropT = -1; }
    else if (flying) {
      proj.dropT = -1;
      const m = proj.mode;
      if (m === 'tumble') s.rotation.x += 20 * dt; // end over end
      else if (m === 'disc') {
        s.rotation.y += 18 * dt;
        proj.bank.rotation.z += (clamp(-proj.turn * 0.12, -0.35, 0.35) - proj.bank.rotation.z) * Math.min(1, dt * 8); // leans into the curve
      } else if (m === 'whirl') s.rotation.y += 22 * dt;
      else if (m === 'roll') { s.rotation.x += 7 * dt; s.rotation.y += 5 * dt; }
    } else if (dropped) {
      if (proj.dropT < 0) { proj.dropT = 0; s.rotation.x %= Math.PI * 2; s.rotation.y %= Math.PI * 2; }
      proj.dropT += dt;
      const pose = DROP_POSE[proj.mode], t = proj.dropT;
      if (pose) { // falls, bounces once and stays stuck blade-down (or flat)
        const k = Math.min(1, t / 0.2);
        y = pose.y + (0.6 - pose.y) * (1 - k * k) + (t > 0.2 && t < 0.34 ? 0.07 * Math.sin((Math.PI * (t - 0.2)) / 0.14) : 0);
        const f = Math.min(1, dt * 18);
        s.rotation.x += angleTo(s.rotation.x, pose.x) * f;
        if (proj.mode === 'disc') { s.rotation.y += 18 * Math.exp(-5 * t) * dt; proj.bank.rotation.z = 0.3 * Math.exp(-4 * t) * Math.sin(16 * t); } // coin wobble
        else if (proj.mode !== 'roll') s.rotation.y += angleTo(s.rotation.y, 0) * f;
      } else y = 0.32 + Math.sin(g.time * 6) * 0.08; // orbs hover
    }
    proj.group.position.set(p.x, y, p.z);
    proj.ring.position.set(p.x, 0.04, p.z);
    proj.ring.scale.setScalar(1 + Math.sin(g.time * 6) * 0.12);
    proj.beacon.position.set(p.x, 1.5, p.z);
    fx.setTrail(proj.accent, p.x, y, p.z, flying && !g.over && !g.choosing);
    const pos = proj.trail.geometry.attributes.position;
    if (flying) {
      pos.array.copyWithin(3, 0, (TRAIL_LEN - 1) * 3);
      pos.array[0] = p.x; pos.array[1] = y; pos.array[2] = p.z;
      if (proj.filled < TRAIL_LEN) { for (let i = proj.filled; i < TRAIL_LEN; i++) pos.array.set([p.x, y, p.z], i * 3); proj.filled = TRAIL_LEN; }
      pos.needsUpdate = true;
      proj.trail.visible = true;
    } else {
      proj.trail.visible = false;
      proj.filled = 0;
    }
    proj.hole.visible = !!p.pull;
    if (p.pull) {
      proj.hole.position.set(p.pull.x, 0.6, p.pull.z);
      proj.hole.scale.setScalar(0.5 + p.pullT * 0.6);
    }
  }

  function syncEnemies(g, dt) {
    for (const e of g.enemies) {
      const v = enemyViews.get(e.id);
      if (!v && !e.dead && !pending.has(e.id)) {
        pending.add(e.id);
        const owner = level;
        addEnemyView(e).then((nv) => {
          pending.delete(e.id);
          if (e.dead || owner !== level) owner.remove(nv.obj); // died or level changed while loading
          else enemyViews.set(e.id, nv);
        });
        continue;
      }
      if (!v) continue;
      if (e.dead && e.vanish) { // gone in a puff (a clone fading, the rest of a raid when the hero faints)
        fx.burst(e.decoy ? 'ring' : 'dust', e.x, e.decoy ? 0.9 : 0.1, e.z, e.decoy ? 0xb56cff : 0x6e6252);
        level.remove(v.obj); enemyViews.delete(e.id); continue;
      }
      if (e.under) { // a burrower travels under the sand: only its dust shows
        v.obj.visible = false; v.wasUnder = true;
        if ((v.dustT = (v.dustT || 0) - dt) <= 0) { v.dustT = 0.45; fx.burst('dust', e.x, 0.05, e.z, 0xc8a060); }
        v.obj.position.set(e.x, 0, e.z);
        continue;
      }
      if (v.wasUnder) { // …and climbs back out
        v.wasUnder = false; v.obj.visible = true; v.current = null;
        const a = animate(v, 'Spawn_Ground', 0);
        if (a) a.timeScale = a.getClip().duration / 0.6;
      }
      if (e.dead) {
        const kn = v.knock || { x: Math.sin(e.facing + Math.PI), z: Math.cos(e.facing + Math.PI), big: false };
        const big = kn.big && !!THREE.AnimationClip.findByName(v.animations, 'Death_C_Skeletons');
        animate(v, big ? 'Death_C_Skeletons' : 'Death_A', 0.05);
        if (!v.flying) v.obj.rotation.y = Math.atan2(-kn.x, -kn.z); // both death clips fall toward the model's −z
        v.obj.scale.setScalar(0.3 + 0.7 * v.pop);
        dying.push({ view: v, age: 0, life: big ? 1.6 : 1.3, sink: big ? 1.1 : 0.8, x0: v.obj.position.x, z0: v.obj.position.z,
          dx: kn.x, dz: kn.z, push: big ? 0.3 : 0.7, hop: big ? 0.25 : 0 });
        enemyViews.delete(e.id);
        continue;
      }
      if (g.over) animate(v, e.id === g.killer ? 'Taunt' : 'Idle', 0.25);
      else if (e.rise <= 0) animate(v, v.walk, 0.15);
      const px = v.obj.position.x, pz = v.obj.position.z;
      v.obj.position.set(e.x, v.flying ? 1.1 + Math.sin(g.time * 4 + e.id) * 0.15 : 0, e.z);
      v.obj.rotation.y = v.flying ? g.time * 2 : e.facing;
      // Stride speed follows the real speed (smoothed over 0.15 s), so the feet don't slide.
      if (dt > 0) v.spd += (Math.hypot(e.x - px, e.z - pz) / dt - v.spd) * (1 - Math.exp(-dt / 0.15));
      if (v.current === v.walk && v.action) v.action.timeScale = clamp(v.spd / v.stride, 0.75, 2);
      v.pop = Math.min(1, v.pop + dt / 0.15); // split children pop in
      const k = e.hurtT / 0.2, base = 0.3 + 0.7 * v.pop; // squash on a hit
      v.obj.scale.set(base * (1 + 0.25 * k), base * (1 - 0.2 * k), base * (1 + 0.25 * k));
      flash(v, dt, e.frozenT > 0);
      v.mixer?.update(e.frozenT > 0 ? 0 : dt);
    }
    for (let i = dying.length - 1; i >= 0; i--) {
      const d = dying[i], o = d.view.obj;
      d.age += dt;
      if (d.age < 2.1) d.view.mixer?.update(dt);
      flash(d.view, dt);
      if (d.view.flying) o.position.y -= dt * 3;
      else { // knocked back with ease-out, then sinks into the ground
        const k = Math.min(1, d.age / 0.25), ease = 1 - (1 - k) * (1 - k);
        o.position.set(d.x0 + d.dx * d.push * ease, d.hop * Math.sin(Math.PI * k) - Math.max(0, d.age - d.sink) * 1.6, d.z0 + d.dz * d.push * ease);
      }
      if (d.age >= d.life) { level.remove(o); dying.splice(i, 1); }
    }
    for (const m of decals) {
      if (!m.visible) continue;
      m.userData.t -= dt;
      m.material.opacity = 0.5 * clamp(m.userData.t / 0.5, 0, 1);
      if (m.userData.t <= 0) m.visible = false;
    }
  }

  function sync(g, dt, opts = {}) {
    if (!level) return;
    if (opts.yaw !== undefined) yaw = opts.yaw;
    heroPos.set(g.hero.x, 0, g.hero.z);
    if (hero) syncHero(g, dt);
    if (view === 'tps' && !menu) placeCamera(dt);
    fadeOccluders(dt);
    syncEnemies(g, dt);
    if (proj) syncProjectile(g, dt);
    syncZone(g, dt);
    if (g.mode === 'story' && storyOn) syncStory(g, dt);
  }

  // ---------- camera ----------
  const PITCH = THREE.MathUtils.degToRad(58);
  let menu = false;      // false | 'menu' (orbit around the hero in the arena) | 'showcase' (hero close-up) | 'shop' | 'creator'
  let view = 'tps';      // 'tps' (behind the shoulder) | 'top' (whole arena from above)
  let yaw = 0;           // third-person camera heading; 0 looks toward −z
  let shootT = 0;
  let heroFace = Math.PI;
  const heroPos = new THREE.Vector3(0, 0, 3);
  const storyScene = createStoryScene({ instance, loadModel, animate, addOccluder, recolorMaterial, fx, texLoader, kick, high, heroPos });
  const pivot = new THREE.Vector3(0, 0, 3); // smoothed hero position the third-person camera follows
  // Third person: a vertical FOV that keeps ~42° across a portrait phone (62–72°).
  const tpsFov = () => clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(21)) / Math.max(0.1, camera.aspect))), 62, 72);
  const fovNow = () => (menu ? 62 : view === 'tps' ? tpsFov() : 46);
  // From above the camera is much farther away than behind the shoulder: push the fog back as far,
  // or dark foggy places (dungeon, cemetery) would turn black.
  function setFog(extra) {
    if (!look || !scene.fog) return;
    scene.fog.near = look.near + extra; scene.fog.far = look.far + extra;
  }
  function placeCamera(dt = null) { // dt null: snap
    setFog(0);
    if (menu) {
      // [distance, camera height, look-at height]: the close-ups aim low so the hero sits above the
      // screen's bottom card (the shop's card is taller, so it aims lower still).
      const [r, hgt, look] = menu === 'shop' ? [5.0, 1.0, -0.95] : menu === 'creator' ? [4.15, 1.0, -0.6] : menu === 'showcase' ? [4.2, 1.25, 0.25] : [7.5, 3.6, 1.1];
      camera.position.set(heroPos.x + Math.sin(menuSpin) * r, hgt, heroPos.z + Math.cos(menuSpin) * r);
      camera.lookAt(heroPos.x, look, heroPos.z);
      return;
    }
    if (view === 'tps') {
      // High over the shoulder so the arena around the hero shows; turning stays instant (yaw isn't smoothed).
      if (dt === null) pivot.copy(heroPos); else pivot.lerp(heroPos, 1 - Math.exp(-10 * dt));
      const fx_ = -Math.sin(yaw), fz_ = -Math.cos(yaw), rx = -fz_, rz = fx_;
      camera.position.set(pivot.x - fx_ * 4.6 + rx * 0.3, 5.6, pivot.z - fz_ * 4.6 + rz * 0.3);
      camera.lookAt(pivot.x + fx_ * 3.5 + rx * 0.3, 0.4, pivot.z + fz_ * 3.5 + rz * 0.3);
      return;
    }
    const aspect = renderer.domElement.clientWidth / Math.max(1, renderer.domElement.clientHeight);
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const needW = (ARENA.W + 0.6) / Math.tan(hfov / 2);
    const needD = ((ARENA.D + 0.8) * Math.sin(PITCH)) / Math.tan(vfov / 2);
    const dist = Math.max(needW, needD) * 1.02;
    camera.position.set(0, Math.sin(PITCH) * dist, Math.cos(PITCH) * dist + 0.4);
    camera.lookAt(0, 0, 0.4);
    setFog(Math.max(0, dist - 7));
  }

  // Applied after placeCamera each frame (real time, so it keeps shaking through a hit-stop).
  function shake(dt) {
    trauma = Math.max(0, trauma - 1.8 * dt);
    if (trauma <= 0 || menu) return;
    shakeT += dt;
    const s = trauma * trauma * (view === 'tps' ? 1 : 0.35);
    const n = (f1, f2, o) => 0.6 * Math.sin(shakeT * f1 * 6.283 + o) + 0.4 * Math.sin(shakeT * f2 * 6.283 + o * 1.7);
    camera.rotateX(n(23, 29, 0.3) * 0.035 * s);
    camera.rotateY(n(25, 31, 1.1) * 0.035 * s);
    camera.rotateZ(n(27, 24, 2.3) * 0.052 * s);
  }

  function resize() {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.fov = fovNow();
    camera.updateProjectionMatrix();
    rect = renderer.domElement.getBoundingClientRect();
    placeCamera();
  }

  // If the phone can't keep ~45 fps, render fewer pixels (step by step, never below 1×): smoother
  // play and less heat. Only real frames count — no GPU means this never kicks in during tests.
  let perfT = 0, perfFrames = 0;
  function adaptResolution(dt) {
    if (!dt || dt > 0.25) return; // skip paused or backgrounded frames
    perfT += dt; perfFrames++;
    if (perfT < 2.5) return;
    const fps = perfFrames / perfT;
    perfT = 0; perfFrames = 0;
    const pr = renderer.getPixelRatio();
    if (fps < 45 && fps > 8 && pr > 1) { renderer.setPixelRatio(Math.max(1, pr - 0.25)); resize(); }
  }

  function render(dt) {
    if (menu) {
      menuSpin += dt * (menu === 'menu' ? 0.12 : 0.35);
      placeCamera();
      if (hero) { hero.obj.visible = true; hero.obj.position.copy(heroPos); hero.obj.rotation.y = menuSpin + Math.PI * 0.15; hero.mixer.update(dt); fx.moveAura(heroPos.x, 0.75, heroPos.z, true); }
      if (proj && orbit && menu === 'shop') previewOrbit(dt);
      fadeOccluders(dt);
    } else if (view !== 'tps') placeCamera(); // re-placed every frame so the shake never adds up
    if (storyOn) storyScene.update(dt);
    shake(dt);
    adaptResolution(dt);
    fx.update(dt);
    if (water?.material.uniforms?.time) water.material.uniforms.time.value += dt * 0.6;
    if (composer) composer.render(dt);
    else renderer.render(scene, camera);
  }

  // The shop's trail preview: the projectile circles the hero with its trail on.
  function previewOrbit(dt) {
    orbitA += dt * 2.6;
    const R = 0.95, x = heroPos.x + Math.sin(orbitA) * R, z = heroPos.z + Math.cos(orbitA) * R, y = 0.85 + Math.sin(orbitA * 2) * 0.12;
    proj.group.visible = true; proj.glow.visible = true; proj.ring.visible = proj.beacon.visible = false;
    proj.group.scale.setScalar(1);
    proj.group.position.set(x, y, z);
    proj.dir.rotation.y = orbitA + Math.PI / 2; // heading along the circle
    const s = proj.spinner, m = proj.mode;
    if (m === 'tumble') s.rotation.x += 20 * dt; else if (m === 'disc') s.rotation.y += 18 * dt; else if (m === 'whirl') s.rotation.y += 22 * dt; else if (m === 'roll') { s.rotation.x += 7 * dt; s.rotation.y += 5 * dt; }
    for (const h of hero.held) h.node.visible = false;
    fx.setTrail(proj.accent, x, y, z, true);
    const pos = proj.trail.geometry.attributes.position;
    pos.array.copyWithin(3, 0, (TRAIL_LEN - 1) * 3);
    pos.array[0] = x; pos.array[1] = y; pos.array[2] = z;
    if (proj.filled < TRAIL_LEN) { for (let i = proj.filled; i < TRAIL_LEN; i++) pos.array.set([x, y, z], i * 3); proj.filled = TRAIL_LEN; }
    pos.needsUpdate = true;
    proj.trail.visible = true;
  }
  // Cosmetics: presetGear before the first hero loads; setGear rebuilds the current hero in the new look
  // (preview: the shop's orbiting-trail preview).
  function presetGear(g) { gear = { ...gear, ...g }; }
  function setGear(g, preview = false) {
    const next = { ...gear, ...g };
    if (next.skin === gear.skin && next.weapon === gear.weapon && next.trail === gear.trail && orbit === preview) return Promise.resolve();
    gear = next; orbit = preview;
    const d = heroDef;
    if (!d) return Promise.resolve();
    heroDef = null;
    return setHero(d);
  }

  function screenToGround(cx, cy) {
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(groundPlane, hit) ? { x: hit.x, z: hit.z } : null;
  }

  const tmp = new THREE.Vector3();
  function worldToScreen(x, y, z) {
    tmp.set(x, y, z).project(camera);
    const behind = tmp.z > 1;
    if (behind) { tmp.x = -tmp.x; tmp.y = -tmp.y; } // points behind the camera project mirrored
    return { x: rect.left + ((tmp.x + 1) / 2) * rect.width, y: rect.top + ((1 - tmp.y) / 2) * rect.height, inside: !behind && Math.abs(tmp.x) <= 1 && Math.abs(tmp.y) <= 1 };
  }

  const dummy = new THREE.Object3D();
  function setAim(points) {
    if (!proj) return;
    const on = !!points && points.length > 1;
    proj.aim.visible = proj.aimEnd.visible = on;
    proj.dots.count = 0;
    if (!on) return;
    const n = Math.min(points.length, AIM_MAX);
    const arr = proj.aim.geometry.attributes.position.array;
    for (let i = 0; i < n; i++) { arr[i * 3] = points[i].x; arr[i * 3 + 1] = 0.35; arr[i * 3 + 2] = points[i].z; }
    proj.aim.geometry.setDrawRange(0, n);
    proj.aim.geometry.attributes.position.needsUpdate = true;
    proj.aim.computeLineDistances();
    const last = points[n - 1];
    proj.aimEnd.position.set(last.x, 0.04, last.z);
    let k = 0;
    for (let i = 1; i < n; i += 2) { dummy.position.set(points[i].x, 0.35, points[i].z); dummy.updateMatrix(); proj.dots.setMatrixAt(k++, dummy.matrix); }
    proj.dots.count = k;
    proj.dots.instanceMatrix.needsUpdate = true;
  }

  // Drop everything left over from the previous run (enemy ids restart at 1 in a new game).
  // at: where the hero starts (default: the arena's start spot).
  function clearRun(at = null) {
    for (const v of enemyViews.values()) level?.remove(v.obj);
    for (const d of dying) level?.remove(d.view.obj);
    enemyViews.clear(); dying.length = 0; pending.clear();
    heroPos.set(at?.x ?? 0, 0, at?.z ?? 3); pivot.copy(heroPos);
    heroFace = Math.PI; trauma = 0; shootT = 0;
    for (const m of decals) m.visible = false;
    zone.visible = false; zone.userData.x = NaN;
    if (proj) {
      proj.filled = 0; proj.dropT = -1;
      proj.group.visible = proj.ring.visible = proj.beacon.visible = false;
      setAim(null); fx.setTrail(proj.color, 0, 0, 0, false);
    }
    if (hero) {
      hero.sector = null; hero.popT = 1;
      for (const l of [hero.legs, hero.arms]) { l.current = null; animate(l, 'Idle', 0); }
      for (const h of hero.held) { h.node.visible = true; h.node.scale.copy(h.base); }
    }
  }

  function setView(mode) {
    view = mode;
    camera.fov = fovNow();
    camera.updateProjectionMatrix();
    placeCamera();
  }

  function setMenu(mode) {
    menu = mode || false;
    camera.fov = fovNow();
    camera.updateProjectionMatrix();
    placeCamera();
    if (proj) proj.group.visible = proj.ring.visible = proj.beacon.visible = false;
  }

  return { setLocation, setZone, setHero, sync, render, resize, effect, screenToGround, worldToScreen, setMenu, setView, clearRun, setAim, renderer, setGear, presetGear };
}
