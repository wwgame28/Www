import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { ARENA } from './locations.js';
import { ENEMY_TYPES } from './waves.js';

const WEAPON_COLORS = {
  ricochet: 0xffd34d, boomerang: 0x5fe0ff, snake: 0x7dff6a, spiral: 0xff7ad9,
  lightning: 0x9fb4ff, orbit: 0xffa03a, blackhole: 0xb06bff,
};
const TRAIL_LEN = 24;
const AIM_MAX = 200;
const ONE_SHOT = new Set(['Death_A', '1H_Ranged_Shoot', 'PickUp', 'Hit_A', 'Cheer']);
const kitFor = (model) => (model.startsWith('enemy-ufo') ? 'towerdefense' : 'kaykit');

export function createRenderer(canvas, { quality = 'high' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.5));
  renderer.shadowMap.enabled = quality === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 120);
  const loader = new GLTFLoader();
  const texLoader = new THREE.TextureLoader();
  const cache = new Map();
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1.4);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-6, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 18, bottom: -18, near: 1, far: 50 });
  const heroLight = new THREE.PointLight(0xffe2a8, 0, 9, 1.6);
  scene.add(hemi, sun, sun.target, heroLight);

  let level = null; // everything that belongs to the current location
  const occluders = []; // solid obstacles that fade out when they hide the hero
  let hero = null;
  const enemyViews = new Map();
  const dying = [];
  const particles = [];
  let proj = null;
  let menuSpin = 0;

  // ---------- assets ----------
  function loadModel(kit, name) {
    const key = `${kit}/${name}`;
    if (!cache.has(key)) cache.set(key, loader.loadAsync(`assets/${kit}/${name}.glb`));
    return cache.get(key);
  }

  function prepare(obj) {
    obj.traverse((o) => {
      if (o.isMesh) { o.castShadow = renderer.shadowMap.enabled; o.receiveShadow = true; }
    });
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
    if (opts.lay) { obj.rotation.x = Math.PI / 2; obj.updateMatrixWorld(true); } // lay tall models flat (bullets)
    return { obj: fit(obj, opts), animations: gltf.animations, inner: obj };
  }

  function animate(view, clipName, fade = 0.15) {
    if (!view.mixer || view.current === clipName) return;
    const clip = THREE.AnimationClip.findByName(view.animations, clipName);
    if (!clip) return;
    const next = view.mixer.clipAction(clip);
    if (ONE_SHOT.has(clipName)) { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; }
    next.reset();
    if (fade > 0) {
      next.fadeIn(fade).play();
      if (view.action) view.action.fadeOut(fade);
    } else { // a zero-length fade divides by zero inside three.js and leaves the rig in T-pose
      next.setEffectiveWeight(1).play();
      if (view.action && view.action !== next) view.action.stop();
    }
    view.action = next;
    view.current = clipName;
  }

  // ---------- level ----------
  async function setLocation(loc, layout, weapon) {
    if (level) { scene.remove(level); level.traverse((o) => o.geometry?.dispose?.()); }
    for (const v of enemyViews.values()) scene.remove(v.obj);
    enemyViews.clear();
    dying.length = 0;
    level = new THREE.Group();

    const sky = texLoader.load(`assets/sky/sky-${loc.sky}.jpg`);
    sky.mapping = THREE.EquirectangularReflectionMapping;
    sky.colorSpace = THREE.SRGBColorSpace;
    scene.background = sky;
    scene.fog = new THREE.Fog(loc.fog, 24, 60);
    hemi.intensity = 1.4 * loc.light;
    sun.intensity = 2.2 * loc.light;
    heroLight.intensity = loc.rule.heroLight ? 40 : 0;

    const outer = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: new THREE.Color(loc.ground).multiplyScalar(0.78) }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.W * 2, ARENA.D * 2), new THREE.MeshLambertMaterial({ color: loc.ground }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    level.add(outer, floor);

    const wallMat = new THREE.MeshLambertMaterial({ color: loc.wall });
    const wallH = 0.5, t = 0.3;
    for (const [w, d, x, z] of [
      [ARENA.W * 2 + t * 2, t, 0, -ARENA.D - t / 2], [ARENA.W * 2 + t * 2, t, 0, ARENA.D + t / 2],
      [t, ARENA.D * 2, -ARENA.W - t / 2, 0], [t, ARENA.D * 2, ARENA.W + t / 2, 0],
    ]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
      m.position.set(x, wallH / 2, z); m.castShadow = m.receiveShadow = true;
      level.add(m);
    }

    if (loc.rule.river) {
      const r = loc.rule.river;
      const water = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.W * 2, r.half * 2), new THREE.MeshLambertMaterial({ color: 0x3aa0e0, transparent: true, opacity: 0.85 }));
      water.rotation.x = -Math.PI / 2; water.position.set(0, 0.01, r.z);
      water.name = 'water';
      level.add(water);
    }

    const jobs = [];
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
      }));
    }

    // Hero (KayKit Rogue) with the blaster in the right hand slot.
    jobs.push((async () => {
      const h = await instance('kaykit', 'Rogue', { height: 1.3 });
      const b = await instance('blaster', weapon.model, { r: 0.3 });
      const slot = h.inner.getObjectByName('handslot.r');
      if (slot) {
        h.obj.updateMatrixWorld(true);
        const ws = slot.getWorldScale(new THREE.Vector3());
        b.obj.scale.divideScalar(ws.x); // keep the blaster's world size under the scaled skeleton
        slot.add(b.obj); // follows the hand; its rotation is set every frame to point where the hero faces
      } else {
        b.obj.position.set(-0.3, 0.55, 0.3);
        h.obj.add(b.obj);
      }
      // Ground ring so the hero stands out from enemies that use the same character style.
      const mark = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 28), new THREE.MeshBasicMaterial({ color: 0x5fd0ff, transparent: true, opacity: 0.9 }));
      mark.rotation.x = -Math.PI / 2; mark.position.y = 0.03;
      h.obj.add(mark);
      hero = { obj: h.obj, animations: h.animations, mixer: new THREE.AnimationMixer(h.inner), blaster: slot ? b.obj : null, slot };
      animate(hero, 'Idle');
      level.add(h.obj);
    })());

    // Projectile: foam bullet + glow + trail.
    jobs.push((async () => {
      const color = WEAPON_COLORS[weapon.id];
      const bullet = weapon.id === 'blackhole'
        ? await instance('blaster', 'grenade-a', { r: 0.25 })
        : await instance('blaster', 'bullet-foam', { r: 0.28, lay: true });
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }));
      glow.position.y = 0.2;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
      const group = new THREE.Group();
      group.add(bullet.obj, glow, ring);
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
      const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }));
      trail.frustumCulled = false;
      const hole = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({ color: 0x1a0830, transparent: true, opacity: 0.7 }));
      hole.visible = false;
      // Aim line: dashed preview of the real trajectory while a finger is held.
      const aimGeo = new THREE.BufferGeometry();
      aimGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AIM_MAX * 3), 3));
      const aim = new THREE.Line(aimGeo, new THREE.LineDashedMaterial({ color, dashSize: 0.35, gapSize: 0.2, transparent: true, opacity: 0.9 }));
      aim.frustumCulled = false; aim.visible = false;
      const aimEnd = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.38, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      aimEnd.rotation.x = -Math.PI / 2; aimEnd.visible = false;
      // Bright dots along the aim path: thin lines get lost in perspective.
      const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color }), AIM_MAX);
      dots.count = 0; dots.frustumCulled = false;
      level.add(group, trail, hole, aim, aimEnd, dots);
      proj = { group, glow, ring, trail, hole, aim, aimEnd, dots, color, filled: 0 };
    })());

    await Promise.all(jobs);
    scene.add(level);
    // Warm up enemy models used in this location so the first wave doesn't stutter.
    await Promise.all(Object.values(ENEMY_TYPES).flatMap((t) => t.model).map((m) => loadModel(kitFor(m), m)));
  }

  async function addEnemyView(e) {
    const def = ENEMY_TYPES[e.type];
    const v = await instance(kitFor(e.model), e.model, def.flying ? { r: e.r } : { height: 1.2 * def.scale });
    const view = { obj: v.obj, animations: v.animations, mixer: v.animations.length ? new THREE.AnimationMixer(v.inner) : null, flying: def.flying };
    animate(view, e.type === 'runner' || e.type === 'splitter' ? 'Running_A' : 'Walking_A');
    v.obj.position.set(e.x, 0, e.z);
    level.add(v.obj);
    return view;
  }

  // ---------- effects ----------
  const burstGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  function burst(x, z, color, n = 10, power = 4) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(burstGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.set(x, 0.5, z);
      const a = Math.random() * Math.PI * 2, s = power * (0.4 + Math.random() * 0.8);
      particles.push({ m, vx: Math.cos(a) * s, vy: 2 + Math.random() * 3, vz: Math.sin(a) * s, life: 0.6 });
      scene.add(m);
    }
  }

  function effect(ev) {
    if (ev.type === 'kill') burst(ev.x, ev.z, proj?.color ?? 0xffffff, 8 + ev.combo * 2);
    else if (ev.type === 'explode') burst(ev.x, ev.z, 0xb06bff, 30, 8);
    else if (ev.type === 'death') burst(ev.x, ev.z, 0xff4d4d, 24, 6);
    else if (ev.type === 'catch') burst(ev.x, ev.z, 0xffffff, 12, 3);
    else if (ev.type === 'shield') burst(ev.x, ev.z, 0x5fd0ff, 20, 5);
    else if (ev.type === 'shoot') { shootT = 0.35; if (hero) hero.current = null; }
  }

  // ---------- per frame ----------
  const pending = new Set();
  const qSlot = new THREE.Quaternion(), qHero = new THREE.Quaternion();
  const Q_BACK = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  function sync(g, dt, opts = {}) {
    if (!level) return;
    // Hero
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
        const fx = Math.sin(face), fz = Math.cos(face), m = g.hero.moving;
        const fwd = (g.hero.vx * fx + g.hero.vz * fz) / m;
        const side = (g.hero.vz * fx - g.hero.vx * fz) / m;
        clip = !tps || fwd > 0.55 ? 'Running_A' : fwd < -0.55 ? 'Walking_Backwards' : side > 0 ? 'Running_Strafe_Right' : 'Running_Strafe_Left';
      } else if (shootT > 0) clip = '1H_Ranged_Shoot';
      animate(hero, clip, 0.12);
      hero.mixer.update(dt);
      if (hero.blaster) {
        // World orientation = hero facing (muzzle is the model's −z, so turn it half way round).
        hero.obj.updateMatrixWorld(true);
        hero.slot.getWorldQuaternion(qSlot).invert();
        hero.obj.getWorldQuaternion(qHero);
        hero.blaster.quaternion.copy(qSlot).multiply(qHero).multiply(Q_BACK);
      }
      heroLight.position.set(g.hero.x, 2.5, g.hero.z);
    }
    if (view === 'tps' && !menu) placeCamera(dt);
    // Fade obstacles standing between the camera and the hero (third person only).
    for (const o of occluders) {
      let target = 1;
      if (view === 'tps' && !menu) {
        const ax = camera.position.x, az = camera.position.z, bx = heroPos.x - ax, bz = heroPos.z - az;
        const t = Math.max(0, Math.min(1, ((o.x - ax) * bx + (o.z - az) * bz) / (bx * bx + bz * bz || 1)));
        if (Math.hypot(ax + bx * t - o.x, az + bz * t - o.z) < o.r + 0.5) target = 0.22;
      }
      if (Math.abs(o.fade - target) > 0.01) {
        o.fade += (target - o.fade) * Math.min(1, dt * 10);
        for (const m of o.mats) { m.opacity = o.fade; m.depthWrite = o.fade > 0.9; }
      }
    }
    // Enemies
    for (const e of g.enemies) {
      let view = enemyViews.get(e.id);
      if (!view && !e.dead && !pending.has(e.id)) {
        pending.add(e.id);
        const owner = level;
        addEnemyView(e).then((v) => {
          pending.delete(e.id);
          if (e.dead || owner !== level) owner.remove(v.obj); // died or level changed while loading
          else enemyViews.set(e.id, v);
        });
        continue;
      }
      if (!view) continue;
      if (e.dead) {
        animate(view, 'Death_A', 0.05);
        dying.push({ view, t: 1.0 });
        enemyViews.delete(e.id);
        continue;
      }
      view.obj.position.set(e.x, view.flying ? 1.1 + Math.sin(g.time * 4 + e.id) * 0.15 : 0, e.z);
      view.obj.rotation.y = view.flying ? g.time * 2 : e.facing;
      const s = 1 + e.hurtT * 1.5;
      view.obj.scale.set(s, s, s);
      view.mixer?.update(dt);
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
      const held = p.state === 'held';
      proj.group.visible = !held;
      proj.ring.visible = p.state === 'dropped';
      proj.glow.visible = p.state === 'flying';
      const y = p.state === 'dropped' ? 0.25 + Math.sin(g.time * 6) * 0.08 : 0.55;
      proj.group.position.set(p.x, y - 0.2, p.z);
      proj.group.rotation.y += dt * (p.state === 'flying' ? 18 : 2);
      proj.ring.scale.setScalar(1 + Math.sin(g.time * 6) * 0.12);
      // Trail
      const pos = proj.trail.geometry.attributes.position;
      if (p.state === 'flying') {
        pos.array.copyWithin(3, 0, (TRAIL_LEN - 1) * 3);
        pos.array[0] = p.x; pos.array[1] = 0.55; pos.array[2] = p.z;
        if (proj.filled < TRAIL_LEN) { for (let i = proj.filled; i < TRAIL_LEN; i++) pos.array.set([p.x, 0.55, p.z], i * 3); proj.filled = TRAIL_LEN; }
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
    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life -= dt;
      q.vy -= 12 * dt;
      q.m.position.x += q.vx * dt; q.m.position.y = Math.max(0.05, q.m.position.y + q.vy * dt); q.m.position.z += q.vz * dt;
      q.m.material.opacity = Math.max(0, q.life / 0.6);
      if (q.life <= 0) { scene.remove(q.m); q.m.material.dispose(); particles.splice(i, 1); }
    }
    const water = level.getObjectByName('water');
    if (water) water.material.opacity = 0.78 + Math.sin(g.time * 2) * 0.07;
  }

  // ---------- camera ----------
  const PITCH = THREE.MathUtils.degToRad(58);
  let menu = false;
  let view = 'tps';      // 'tps' (behind the shoulder) | 'top' (whole arena from above)
  let yaw = 0;           // third-person camera heading; 0 looks toward −z
  let shootT = 0;
  const heroPos = new THREE.Vector3(0, 0, 3);
  const camGoal = new THREE.Vector3();
  function placeCamera(dt = 0) {
    if (view === 'tps' && !menu) {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
      camGoal.set(heroPos.x - fx * 5.4 + rx * 0.75, 3.4, heroPos.z - fz * 5.4 + rz * 0.75);
      if (dt > 0) camera.position.lerp(camGoal, 1 - Math.exp(-12 * dt));
      else camera.position.copy(camGoal);
      camera.lookAt(heroPos.x + fx * 5 + rx * 0.75, 0.9, heroPos.z + fz * 5 + rz * 0.75);
      return;
    }
    const aspect = renderer.domElement.clientWidth / Math.max(1, renderer.domElement.clientHeight);
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const needW = (ARENA.W + 0.6) / Math.tan(hfov / 2);
    const needD = ((ARENA.D + 0.8) * Math.sin(PITCH)) / Math.tan(vfov / 2);
    const dist = Math.max(needW, needD) * 1.02;
    if (menu) {
      const a = menuSpin;
      camera.position.set(Math.sin(a) * 19, 11, Math.cos(a) * 19);
      camera.lookAt(0, 0, 0);
      return;
    }
    camera.position.set(0, Math.sin(PITCH) * dist, Math.cos(PITCH) * dist + 0.4);
    camera.lookAt(0, 0, 0.4);
  }

  function resize() {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    placeCamera();
  }

  function render(dt) {
    if (menu) { menuSpin += dt * 0.12; placeCamera(); }
    renderer.render(scene, camera);
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
    for (const q of particles) { scene.remove(q.m); q.m.material.dispose(); }
    enemyViews.clear(); dying.length = 0; particles.length = 0; pending.clear();
    if (proj) { proj.filled = 0; setAim(null); }
    if (hero) { hero.current = null; animate(hero, 'Idle', 0); }
  }

  function setView(mode) {
    view = mode;
    camera.fov = mode === 'tps' ? 62 : 46;
    camera.updateProjectionMatrix();
    placeCamera();
  }

  function setMenu(on) { menu = on; placeCamera(); if (hero) hero.obj.visible = !on; if (proj) proj.group.visible = false; }

  return { setLocation, sync, render, resize, effect, screenToGround, worldToScreen, setMenu, setView, clearRun, setAim, renderer };
}
