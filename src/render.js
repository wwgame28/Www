import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { Water } from 'three/addons/objects/Water.js';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect } from 'postprocessing';
import { ARENA } from './locations.js';
import { ENEMY_TYPES } from './waves.js';
import { createFx } from './fx.js';

const TRAIL_LEN = 24;
const AIM_MAX = 200;
const ONE_SHOT = new Set(['Death_A', '1H_Ranged_Shoot', 'Throw', 'Spellcast_Shoot', 'PickUp', 'Hit_A', 'Cheer', 'Spawn_Ground_Skeletons']);
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
  const occluders = [];               // solid obstacles that fade out when they hide the hero
  let hero = null;
  let heroDef = null;
  let water = null;
  const enemyViews = new Map();
  const dying = [];
  let proj = null;
  let menuSpin = 0;

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

  // Scale a model so its footprint radius (or height) matches the simulation.
  function fit(obj, { r, height }) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const s = height ? height / size.y : (r * 2) / Math.max(size.x, size.z, 1e-3);
    obj.scale.multiplyScalar(s);
    const b2 = new THREE.Box3().setFromObject(obj);
    obj.position.y -= b2.min.y;
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

  function animate(v, clipName, fade = 0.15) {
    if (!v.mixer || v.current === clipName) return;
    const clip = THREE.AnimationClip.findByName(v.animations, clipName);
    if (!clip) return;
    const next = v.mixer.clipAction(clip);
    if (ONE_SHOT.has(clipName)) { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; }
    next.reset();
    if (fade > 0) {
      next.fadeIn(fade).play();
      if (v.action) v.action.fadeOut(fade);
    } else { // a zero-length fade divides by zero inside three.js and leaves the rig in T-pose
      next.setEffectiveWeight(1).play();
      if (v.action && v.action !== next) v.action.stop();
    }
    v.action = next;
    v.current = clipName;
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
  async function setLocation(loc, layout) {
    if (level) { scene.remove(level); level.traverse((o) => o.geometry?.dispose?.()); }
    for (const v of enemyViews.values()) scene.remove(v.obj);
    enemyViews.clear();
    dying.length = 0;
    water = null;
    level = new THREE.Group();

    const sky = texLoader.load(`assets/sky/sky-${loc.sky}.jpg`);
    sky.mapping = THREE.EquirectangularReflectionMapping;
    sky.colorSpace = THREE.SRGBColorSpace;
    scene.background = sky;
    scene.fog = new THREE.Fog(loc.fog, loc.rule.fogNear ?? 24, loc.rule.fogFar ?? 60);
    hemi.intensity = 1.4 * loc.light;
    sun.intensity = 2.2 * loc.light;
    heroLight.intensity = loc.rule.heroLight ? 40 : 0;
    if (bloom) bloom.intensity = loc.bloom ?? 1.1; // bright scenes (snow) would wash out

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
    occluders.length = 0;
    for (const o of layout.solids) {
      jobs.push(instance(o.kit, o.model, { r: o.r * 1.15 }).then(({ obj }) => {
        obj.position.set(o.x, 0, o.z); obj.rotation.y = o.rot; level.add(obj);
        // Own materials so this obstacle alone can fade when it blocks the third-person camera.
        const mats = [];
        obj.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; mats.push(m.material); } });
        occluders.push({ x: o.x, z: o.z, r: o.r, mats, fade: 1 });
      }));
    }
    for (const o of layout.decor) {
      jobs.push(instance(o.kit, o.model, { r: o.fit }).then(({ obj }) => {
        obj.position.set(o.x, 0, o.z); obj.rotation.y = o.rot; level.add(obj);
        const f = FLAMES[o.model];
        if (f) {
          const hgt = new THREE.Box3().setFromObject(obj).max.y;
          flames.push({ x: o.x, y: hgt * f.y, z: o.z, scale: f.scale ?? 1 });
        }
      }));
    }
    await Promise.all(jobs);
    fx.setFlames(flames);
    scene.add(level);
    // Warm up enemy models so the first wave doesn't stutter.
    await Promise.all(Object.values(ENEMY_TYPES).flatMap((t) => t.model).map((m) => loadModel(kitFor(m), m)));
  }

  // ---------- hero ----------
  async function setHero(def) {
    heroDef = def;
    const h = await instance('heroes', def.model, { height: 1.3 });
    if (heroDef !== def) return; // another hero was picked while this one loaded
    // Show only this hero's props (the KayKit model carries every prop of its class in the hands).
    for (const side of ['handslot.l', 'handslot.r']) {
      const slot = h.inner.getObjectByName(side);
      for (const c of slot?.children ?? []) c.visible = def.hold.includes(c.name);
    }
    if (def.tint) {
      const tint = new THREE.Color(def.tint);
      h.inner.traverse((m) => { if (m.isMesh && !/handslot/.test(m.parent?.name ?? '')) { m.material = m.material.clone(); m.material.color.multiply(tint); } });
    }
    // Ground ring so the hero stands out from the skeletons.
    const mark = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 28), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.9 }));
    mark.rotation.x = -Math.PI / 2; mark.position.y = 0.03;
    h.obj.add(mark);

    // Projectile: the hero's object (axe, shield, rock…) or a glowing orb for mages.
    const color = def.color;
    const group = new THREE.Group();
    const spinner = new THREE.Group();
    if (!def.proj.orb) {
      const p = await instance(def.proj.kit, def.proj.model, { r: 0.32 });
      p.obj.position.y = -0.15;
      spinner.add(p.obj);
    } else {
      spinner.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6) })));
    }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -0.17;
    group.add(spinner, glow, ring);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }));
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
    heroRoot.add(h.obj, group, trail, hole, aim, aimEnd, dots);
    group.visible = false;
    hero = { obj: h.obj, animations: h.animations, mixer: new THREE.AnimationMixer(h.inner), shootClip: def.shoot };
    animate(hero, 'Idle', 0);
    proj = { group, spinner, spin: def.proj.spin !== false, glow, ring, trail, hole, aim, aimEnd, dots, color, filled: 0 };
    if (menu) placeCamera();
  }

  async function addEnemyView(e) {
    const def = ENEMY_TYPES[e.type];
    const v = await instance(kitFor(e.model), e.model, def.flying ? { r: e.r } : { height: 1.25 * def.scale });
    const vw = { obj: v.obj, animations: v.animations, mixer: v.animations.length ? new THREE.AnimationMixer(v.inner) : null, flying: def.flying,
      walk: e.type === 'runner' || e.type === 'splitter' ? 'Running_A' : 'Walking_D_Skeletons' };
    animate(vw, e.rise > 0 ? 'Spawn_Ground_Skeletons' : vw.walk, 0);
    v.obj.position.set(e.x, 0, e.z);
    level.add(v.obj);
    return vw;
  }

  // ---------- effects ----------
  function effect(ev) {
    const c = proj?.color ?? 0xffffff;
    if (ev.type === 'kill') fx.burst('hit', ev.x, 0.7, ev.z, c);
    else if (ev.type === 'bounce' || ev.type === 'chain') fx.burst('spark', ev.x, 0.55, ev.z, c);
    else if (ev.type === 'hurt') fx.burst('spark', ev.x, 0.8, ev.z, 0xffffff);
    else if (ev.type === 'explode') fx.burst('big', ev.x, 0.6, ev.z, c);
    else if (ev.type === 'death') fx.burst('big', ev.x, 0.8, ev.z, 0xff4d4d);
    else if (ev.type === 'catch' || ev.type === 'pickup' || ev.type === 'return') fx.burst('ring', ev.x, 0.6, ev.z, 0xffffff);
    else if (ev.type === 'shield') fx.burst('ring', ev.x, 0.8, ev.z, 0x5fd0ff);
    else if (ev.type === 'shoot') { shootT = 0.45; if (hero) hero.current = null; }
  }

  // ---------- per frame ----------
  const pending = new Set();
  // Fade obstacles standing between the camera and the hero (third person and the menu close-ups).
  function fadeOccluders(dt) {
    const active = menu || view === 'tps';
    for (const o of occluders) {
      let target = 1;
      if (active) {
        const ax = camera.position.x, az = camera.position.z, bx = heroPos.x - ax, bz = heroPos.z - az;
        const t = Math.max(0, Math.min(1, ((o.x - ax) * bx + (o.z - az) * bz) / (bx * bx + bz * bz || 1)));
        if (Math.hypot(ax + bx * t - o.x, az + bz * t - o.z) < o.r + 0.5) target = 0.22;
      }
      if (Math.abs(o.fade - target) > 0.01) {
        o.fade += (target - o.fade) * Math.min(1, dt * 10);
        for (const m of o.mats) { m.opacity = o.fade; m.depthWrite = o.fade > 0.9; }
      }
    }
  }
  function sync(g, dt, opts = {}) {
    if (!level) return;
    if (opts.yaw !== undefined) yaw = opts.yaw;
    heroPos.set(g.hero.x, 0, g.hero.z);
    if (hero) {
      const tps = view === 'tps';
      const face = tps ? yaw + Math.PI : g.hero.facing; // third person: always face where the camera looks
      hero.obj.position.copy(heroPos);
      hero.obj.rotation.y = face;
      shootT = Math.max(0, shootT - dt);
      let clip = 'Idle';
      if (g.over) clip = 'Death_A';
      else if (g.hero.moving > 0.4) {
        // Pick the locomotion clip from the move direction relative to where the hero faces.
        const fx_ = Math.sin(face), fz_ = Math.cos(face), m = g.hero.moving;
        const fwd = (g.hero.vx * fx_ + g.hero.vz * fz_) / m;
        const side = (g.hero.vz * fx_ - g.hero.vx * fz_) / m;
        clip = !tps || fwd > 0.55 ? 'Running_A' : fwd < -0.55 ? 'Walking_Backwards' : side > 0 ? 'Running_Strafe_Right' : 'Running_Strafe_Left';
      } else if (shootT > 0) clip = hero.shootClip;
      animate(hero, clip, 0.12);
      hero.mixer.update(dt);
      heroLight.position.set(g.hero.x, 2.5, g.hero.z);
    }
    if (view === 'tps' && !menu) placeCamera(dt);
    fadeOccluders(dt);
    // Enemies
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
      if (e.dead) {
        animate(v, 'Death_A', 0.05);
        dying.push({ view: v, t: 1.1 });
        enemyViews.delete(e.id);
        continue;
      }
      if (e.rise <= 0) animate(v, v.walk, 0.2);
      v.obj.position.set(e.x, v.flying ? 1.1 + Math.sin(g.time * 4 + e.id) * 0.15 : 0, e.z);
      v.obj.rotation.y = v.flying ? g.time * 2 : e.facing;
      const s = 1 + e.hurtT * 1.5;
      v.obj.scale.set(s, s, s);
      v.mixer?.update(dt);
    }
    for (let i = dying.length - 1; i >= 0; i--) {
      const d = dying[i];
      d.t -= dt;
      d.view.mixer?.update(dt);
      d.view.obj.position.y -= d.view.flying ? dt * 3 : 0;
      if (d.t <= 0) { level.remove(d.view.obj); dying.splice(i, 1); }
    }
    // Projectile
    if (proj) {
      const p = g.projectile;
      const flying = p.state === 'flying';
      proj.group.visible = p.state !== 'held';
      proj.ring.visible = p.state === 'dropped';
      proj.glow.visible = flying;
      const y = p.state === 'dropped' ? 0.32 + Math.sin(g.time * 6) * 0.08 : 0.6;
      proj.group.position.set(p.x, y, p.z);
      if (proj.spin) proj.spinner.rotation.y += dt * (flying ? 16 : 1.5);
      else if (flying && (p.vx || p.vz)) proj.spinner.rotation.y = Math.atan2(p.vx, p.vz);
      proj.ring.scale.setScalar(1 + Math.sin(g.time * 6) * 0.12);
      fx.setTrail(proj.color, p.x, y, p.z, flying);
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
  }

  // ---------- camera ----------
  const PITCH = THREE.MathUtils.degToRad(58);
  let menu = false;      // false | 'menu' (orbit around the hero in the arena) | 'showcase' (hero close-up)
  let view = 'tps';      // 'tps' (behind the shoulder) | 'top' (whole arena from above)
  let yaw = 0;           // third-person camera heading; 0 looks toward −z
  let shootT = 0;
  const heroPos = new THREE.Vector3(0, 0, 3);
  const camGoal = new THREE.Vector3();
  function placeCamera(dt = 0) {
    if (menu) {
      const a = menuSpin, close = menu === 'showcase';
      const r = close ? 4.2 : 7.5, hgt = close ? 1.25 : 3.6;
      camera.position.set(heroPos.x + Math.sin(a) * r, hgt, heroPos.z + Math.cos(a) * r);
      camera.lookAt(heroPos.x, close ? 0.25 : 1.1, heroPos.z); // close-up: aim low so the hero sits above the card
      return;
    }
    if (view === 'tps') {
      const fx_ = -Math.sin(yaw), fz_ = -Math.cos(yaw), rx = -fz_, rz = fx_;
      camGoal.set(heroPos.x - fx_ * 5.4 + rx * 0.75, 3.4, heroPos.z - fz_ * 5.4 + rz * 0.75);
      if (dt > 0) camera.position.lerp(camGoal, 1 - Math.exp(-12 * dt));
      else camera.position.copy(camGoal);
      camera.lookAt(heroPos.x + fx_ * 5 + rx * 0.75, 0.9, heroPos.z + fz_ * 5 + rz * 0.75);
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
  }

  function resize() {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
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
      menuSpin += dt * (menu === 'showcase' ? 0.35 : 0.12);
      placeCamera();
      if (hero) { hero.obj.position.copy(heroPos); hero.obj.rotation.y = menuSpin + Math.PI * 0.15; hero.mixer.update(dt); }
      fadeOccluders(dt);
    }
    adaptResolution(dt);
    fx.update(dt);
    if (water?.material.uniforms?.time) water.material.uniforms.time.value += dt * 0.6;
    if (composer) composer.render(dt);
    else renderer.render(scene, camera);
  }

  function screenToGround(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(groundPlane, hit) ? { x: hit.x, z: hit.z } : null;
  }

  const tmp = new THREE.Vector3();
  function worldToScreen(x, y, z) {
    tmp.set(x, y, z).project(camera);
    const behind = tmp.z > 1;
    if (behind) { tmp.x = -tmp.x; tmp.y = -tmp.y; } // points behind the camera project mirrored
    const r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((tmp.x + 1) / 2) * r.width, y: r.top + ((1 - tmp.y) / 2) * r.height, inside: !behind && Math.abs(tmp.x) <= 1 && Math.abs(tmp.y) <= 1 };
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
  function clearRun() {
    for (const v of enemyViews.values()) level?.remove(v.obj);
    for (const d of dying) level?.remove(d.view.obj);
    enemyViews.clear(); dying.length = 0; pending.clear();
    heroPos.set(0, 0, 3);
    if (proj) { proj.filled = 0; proj.group.visible = false; setAim(null); fx.setTrail(proj.color, 0, 0, 0, false); }
    if (hero) { hero.current = null; animate(hero, 'Idle', 0); }
  }

  function setView(mode) {
    view = mode;
    camera.fov = mode === 'tps' ? 62 : 46;
    camera.updateProjectionMatrix();
    placeCamera();
  }

  function setMenu(mode) { menu = mode || false; placeCamera(); if (proj) proj.group.visible = false; }

  return { setLocation, setHero, sync, render, resize, effect, screenToGround, worldToScreen, setMenu, setView, clearRun, setAim, renderer };
}
