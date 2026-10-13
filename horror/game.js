// «Плотность» — хоррор с лидаром: квартира видна только как облако точек, Жилец — как дыра в нём.
import * as THREE from '../vendor/three.module.min.js';
import { buildApartment, trace, collide, roomAt, ROOMS, NOTES, NODES, navPath, neighbourRooms, shiftGroup } from './world.js';
import * as AI from './ai.js';
import { Sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const sfx = new Sfx();
let settings = AI.loadSettings();
const aiOn = () => !!settings.key;

// ---------- Рендер ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
camera.rotation.order = 'YXZ';

const MAX = 160000;
const geo = new THREE.BufferGeometry();
const aPos = new THREE.BufferAttribute(new Float32Array(MAX * 3), 3);
const aBirth = new THREE.BufferAttribute(new Float32Array(MAX).fill(-1e6), 1);
const aDist = new THREE.BufferAttribute(new Float32Array(MAX), 1);
const aKind = new THREE.BufferAttribute(new Float32Array(MAX), 1);
const aStale = new THREE.BufferAttribute(new Float32Array(MAX), 1);
const ATTRS = [aPos, aBirth, aDist, aKind, aStale];
for (const a of ATTRS) a.setUsage(THREE.DynamicDrawUsage);
geo.setAttribute('position', aPos);
geo.setAttribute('aBirth', aBirth);
geo.setAttribute('aDist', aDist);
geo.setAttribute('aKind', aKind);
geo.setAttribute('aStale', aStale);
geo.setDrawRange(0, 0);
geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(5, 1.3, 4), 30);
const boxOf = new Int16Array(MAX).fill(-1);
let head = 0, count = 0, dirtyLo = Infinity, dirtyHi = -1, wrapped = false;

const uniforms = {
  uTime: { value: 0 }, uSize: { value: 0.012 }, uScale: { value: 800 }, uDiff: { value: 0 },
  uFadeA: { value: 40 }, uFadeB: { value: 70 }, uGlitch: { value: 0 },
};
const mat = new THREE.ShaderMaterial({
  uniforms, transparent: true, depthWrite: true,
  vertexShader: `
    attribute float aBirth; attribute float aDist; attribute float aKind; attribute float aStale;
    uniform float uTime, uSize, uScale, uDiff, uFadeA, uFadeB, uGlitch;
    varying vec3 vColor; varying float vAlpha;
    void main() {
      vec3 p = position;
      if (uGlitch > 0.0) { p.x += sin(p.y * 37.0 + uTime * 41.0) * 0.06 * uGlitch; p.z += cos(p.y * 23.0 - uTime * 33.0) * 0.06 * uGlitch; }
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float age = uTime - aBirth;
      float a = 1.0 - smoothstep(uFadeA, uFadeB, age);
      float d = clamp(aDist / 7.0, 0.0, 1.0);
      vec3 c = mix(vec3(0.92, 0.97, 1.0), vec3(0.12, 0.38, 1.0), smoothstep(0.0, 0.6, d));
      c = mix(c, vec3(0.22, 0.1, 0.6), smoothstep(0.6, 1.0, d));
      if (aKind > 0.5 && aKind < 1.5) c = vec3(1.0, 0.82, 0.35);
      else if (aKind > 1.5 && aKind < 2.5) c = vec3(0.95, 0.25, 0.2);
      else if (aKind > 2.5 && aKind < 3.5) c = vec3(0.85, 0.95, 0.85);
      c += (1.0 - smoothstep(0.0, 0.35, age)) * 0.7;
      if (uDiff > 0.5) {
        if (aStale > 0.5) { c = vec3(1.0, 0.12, 0.12); a = max(a, 0.9); }
        else if (aKind > 3.5) c = vec3(1.0, 0.6, 0.1);
        else c *= 0.22;
      }
      vColor = c; vAlpha = a;
      gl_PointSize = clamp(uSize * uScale / max(-mv.z, 0.15), 1.5, 9.0);
    }`,
  fragmentShader: `
    varying vec3 vColor; varying float vAlpha;
    void main() {
      vec2 q = gl_PointCoord - 0.5; float r = dot(q, q);
      if (r > 0.25 || vAlpha < 0.03) discard;
      gl_FragColor = vec4(vColor, vAlpha * (1.0 - r * 2.0));
    }`,
});
const cloud = new THREE.Points(geo, mat);
cloud.frustumCulled = false;
scene.add(cloud);

// Жилец: невидимое тело, которое пишет только глубину — старые точки за ним пропадают, и в облаке видна дыра.
const occ = new THREE.MeshBasicMaterial({ colorWrite: false });
const monsterMesh = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 1.1, 4, 10), occ);
body.position.y = 0.78;
const headM = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), occ);
headM.position.y = 1.66;
const arms = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.14), occ);
arms.position.y = 1.2;
monsterMesh.add(body, headM, arms);
monsterMesh.renderOrder = -1;
monsterMesh.visible = false;
scene.add(monsterMesh);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  uniforms.uScale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
}
addEventListener('resize', resize);
resize();

// ---------- Состояние ----------
let world, S;
const runId = { v: 0 };

function newGame() {
  runId.v++;
  world = buildApartment();
  S = {
    phase: 'play', time: 0,
    p: { x: 1.45, z: 7.35, yaw: 0, pitch: -0.05 },
    battery: 100, scanIdle: 0, noise: 0, stepAcc: 0, hearT: 0, tickAcc: 0,
    notesRead: 0, notes: [false, false, false, false], readProg: [0, 0, 0, 0],
    sealOpen: false, doorOpen: false, ghostUntil: 0, glitchUntil: 0,
    impulseLeft: 0, impulseCd: 0, diff: false,
    m: { x: 7.9, z: 1.4, active: false, state: 'dormant', path: [], speed: 0.6, wait: 0, stepT: 0 },
    heartT: 0, events: [], radio: [], dialog: [], directorNext: 35, directorBusy: false, sisterBusy: false,
    subUntil: 0, cause: '',
  };
  clearCloud();
  $('radioLog').innerHTML = '';
  setDiff(false);
}

function clearCloud() {
  aBirth.array.fill(-1e6);
  aStale.array.fill(0);
  boxOf.fill(-1);
  head = 0; count = 0; wrapped = true;
  geo.setDrawRange(0, 0);
}

function addPoint(h) {
  const i = head;
  const j = (Math.random() - 0.5) * 0.012;
  aPos.array[i * 3] = h.x + j; aPos.array[i * 3 + 1] = h.y + (Math.random() - 0.5) * 0.012; aPos.array[i * 3 + 2] = h.z - j;
  aBirth.array[i] = S ? S.time : 0;
  aDist.array[i] = h.dist;
  const b = h.box;
  aKind.array[i] = b.kind === 'note' && !S?.notes[b.note] ? 1 : b.kind === 'door' ? 2 : b.kind === 'ghost' ? 3 : b.rev > 0 ? 4 : 0;
  aStale.array[i] = 0;
  boxOf[i] = b.id;
  if (i < dirtyLo) dirtyLo = i;
  if (i > dirtyHi) dirtyHi = i;
  head = (head + 1) % MAX;
  if (head === 0) wrapped = true;
  if (count < MAX) { count++; geo.setDrawRange(0, count); }
}

function flushCloud() {
  for (const a of ATTRS) {
    a.clearUpdateRanges();
    if (wrapped || (a === aStale && staleDirty)) a.needsUpdate = true;
    else if (dirtyHi >= dirtyLo) { a.addUpdateRange(dirtyLo * a.itemSize, (dirtyHi - dirtyLo + 1) * a.itemSize); a.needsUpdate = true; }
  }
  wrapped = false; staleDirty = false; dirtyLo = Infinity; dirtyHi = -1;
}
let staleDirty = false;
function markStale(boxes) {
  const ids = new Set(boxes.map((b) => b.id));
  for (let i = 0; i < count; i++) if (ids.has(boxOf[i])) aStale.array[i] = 1;
  staleDirty = true;
}

// ---------- Сканирование ----------
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
const monsterBox = { id: -1, kind: 'monster', min: [0, 0, 0], max: [0, 0, 0] };

function castRays(n, half, maxT, onHit) {
  camera.updateMatrixWorld();
  const e = camera.matrixWorld.elements;
  right.set(e[0], e[1], e[2]); up.set(e[4], e[5], e[6]); fwd.set(-e[8], -e[9], -e[10]);
  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
  const opts = { monster: S.m.active ? monsterBox : null, ghost: S.time < S.ghostUntil };
  const th = Math.tan(half);
  for (let k = 0; k < n; k++) {
    const r = th * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
    const u = Math.cos(a) * r, v = Math.sin(a) * r;
    let dx = fwd.x + right.x * u + up.x * v, dy = fwd.y + right.y * u + up.y * v, dz = fwd.z + right.z * u + up.z * v;
    const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    const h = trace(world, ox, oy, oz, dx, dy, dz, maxT, opts);
    if (h) { addPoint(h); onHit?.(h); }
  }
}

function castSphere(n) {
  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
  const opts = { monster: S.m.active ? monsterBox : null, ghost: S.time < S.ghostUntil };
  for (let k = 0; k < n; k++) {
    const z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    const h = trace(world, ox, oy, oz, s * Math.cos(a), z, s * Math.sin(a), 14, opts);
    if (h) addPoint(h);
  }
}

// ---------- Ввод ----------
const input = { mx: 0, my: 0, fan: false, beam: false, keys: new Set() };
const joy = { id: null, ox: 0, oy: 0 };
const look = { id: null, x: 0, y: 0 };
const ctl = $('controls');

ctl.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.cbtn') || S?.phase !== 'play') return;
  if (e.pointerType === 'mouse') { canvas.requestPointerLock?.(); return; }
  if (e.clientX < innerWidth * 0.45 && joy.id === null) {
    joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY;
    showJoy(e.clientX, e.clientY, e.clientX, e.clientY);
  } else if (look.id === null) {
    look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY;
  }
});
addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) {
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const d = Math.hypot(dx, dy), R = 55;
    if (d > R) { dx *= R / d; dy *= R / d; }
    input.mx = dx / R; input.my = -dy / R;
    showJoy(joy.ox, joy.oy, joy.ox + dx, joy.oy + dy);
  } else if (e.pointerId === look.id) {
    turn((e.clientX - look.x) * 0.0055, (e.clientY - look.y) * 0.0055);
    look.x = e.clientX; look.y = e.clientY;
  }
});
const endPointer = (e) => {
  if (e.pointerId === joy.id) { joy.id = null; input.mx = input.my = 0; $('joyBase').classList.add('hidden'); $('joyKnob').classList.add('hidden'); }
  if (e.pointerId === look.id) look.id = null;
};
addEventListener('pointerup', endPointer);
addEventListener('pointercancel', endPointer);
function showJoy(bx, by, kx, ky) {
  const b = $('joyBase'), k = $('joyKnob');
  b.classList.remove('hidden'); k.classList.remove('hidden');
  b.style.left = bx + 'px'; b.style.top = by + 'px'; k.style.left = kx + 'px'; k.style.top = ky + 'px';
  $('joyHint').classList.add('hidden');
}
function turn(dx, dy) {
  S.p.yaw -= dx;
  S.p.pitch = Math.max(-1.35, Math.min(1.35, S.p.pitch - dy));
}

// Мышь и клавиатура.
addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas && S?.phase === 'play') turn(e.movementX * 0.0025, e.movementY * 0.0025); });
canvas.addEventListener('mousedown', (e) => {
  if (S?.phase !== 'play') return;
  if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
  if (e.button === 0) input.fan = true;
  if (e.button === 2) input.beam = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) input.fan = false; if (e.button === 2) input.beam = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && S?.phase === 'play' && !matchMedia('(pointer: coarse)').matches && $('radio').classList.contains('hidden')) pause(); });
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  input.keys.add(e.code);
  if (S?.phase !== 'play') { if (e.code === 'Escape' && S?.phase === 'pause') resume(); return; }
  if (e.code === 'Space') impulse();
  if (e.code === 'KeyQ' || e.code === 'Tab') { e.preventDefault(); setDiff(!S.diff); }
  if (e.code === 'KeyR') { e.preventDefault(); openRadio(); }
  if (e.code === 'Escape') pause();
});
addEventListener('keyup', (e) => input.keys.delete(e.code));

const hold = (id, key) => {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); input[key] = true; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch { /* синтетическое касание */ } });
  const off = () => { input[key] = false; el.classList.remove('on'); };
  el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
};
hold('fanBtn', 'fan');
hold('beamBtn', 'beam');
$('impBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); impulse(); });
$('diffBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); setDiff(!S.diff); });
$('radioBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); openRadio(); });

function setDiff(on) {
  if (!S) return;
  S.diff = on; uniforms.uDiff.value = on ? 1 : 0;
  $('diffBtn').classList.toggle('on', on);
}

function impulse() {
  if (S.impulseCd > 0 || S.battery < 30) return;
  S.battery -= 30; S.impulseCd = 7; S.impulseLeft = 0.45; S.scanIdle = 0;
  sfx.impulse();
  noise(40, 1);
}

// ---------- Шум и Жилец ----------
function noise(radius, level) {
  S.noise = Math.max(S.noise, level);
  const m = S.m;
  if (!m.active) return;
  const d = Math.hypot(m.x - S.p.x, m.z - S.p.z);
  if (d < radius) goTo(S.p.x + (Math.random() - 0.5) * 0.6, S.p.z + (Math.random() - 0.5) * 0.6, 1.15, 'hunt');
}

function goTo(x, z, speed, state) {
  const m = S.m;
  m.path = navPath(m, { x, z }); m.speed = speed; m.state = state; m.wait = 0;
}

function activateMonster() {
  const m = S.m;
  m.active = true; m.state = 'wander'; m.wait = 4;
  monsterMesh.visible = true;
}

function monsterUpdate(dt) {
  const m = S.m;
  if (!m.active) { if (S.notesRead >= 1 || S.time > 150) activateMonster(); else return; }
  if (m.path.length) {
    const t = m.path[0], dx = t.x - m.x, dz = t.z - m.z, d = Math.hypot(dx, dz), st = m.speed * dt;
    if (d <= st) { m.x = t.x; m.z = t.z; m.path.shift(); } else { m.x += (dx / d) * st; m.z += (dz / d) * st; monsterMesh.rotation.y = Math.atan2(dx, dz); }
    m.stepT -= dt;
  } else if ((m.wait -= dt) <= 0) {
    if (m.state === 'hunt') {
      const room = ROOMS[roomAt(m.x, m.z)];
      goTo(room.x0 + 0.4 + Math.random() * (room.x1 - room.x0 - 0.8), room.z0 + 0.4 + Math.random() * (room.z1 - room.z0 - 0.8), 0.7, 'search');
      m.wait = 2.5;
    } else {
      const here = roomAt(S.p.x, S.p.z);
      const pool = NODES.filter((n) => !n.rooms.includes(here) || Math.random() < 0.25);
      const n = pool[Math.floor(Math.random() * pool.length)];
      goTo(n.x, n.z, 0.55, 'wander');
      m.wait = 2 + Math.random() * 5;
    }
  }
  monsterBox.min[0] = m.x - 0.2; monsterBox.min[1] = 0; monsterBox.min[2] = m.z - 0.2;
  monsterBox.max[0] = m.x + 0.2; monsterBox.max[1] = 1.82; monsterBox.max[2] = m.z + 0.2;
  monsterMesh.position.set(m.x, 0, m.z);

  const dx = m.x - S.p.x, dz = m.z - S.p.z, d = Math.hypot(dx, dz);
  if (d < 0.55) return die();
  // Шаги, сердце, треск.
  if (m.path.length && d < 7 && m.stepT <= 0) { m.stepT = m.state === 'hunt' ? 0.42 : 0.7; sfx.step(panTo(dx, dz, d), 0.28 * (1 - d / 7)); }
  if (d < 5) {
    S.heartT -= dt;
    if (S.heartT <= 0) { S.heartT = 0.35 + d * 0.22; sfx.heart(0.4 * (1 - d / 5)); }
  }
  const danger = Math.max(0, Math.min(1, 1 - (d - 0.6) / 3.5));
  sfx.setDread(danger);
  $('vignette').style.opacity = (danger * 0.9).toFixed(2);
}

function panTo(dx, dz, d) {
  const rx = Math.cos(S.p.yaw), rz = -Math.sin(S.p.yaw);
  return d > 0.01 ? (dx * rx + dz * rz) / d : 0;
}

// ---------- Кадр ----------
function update(dt) {
  S.time += dt;
  const p = S.p;
  // Ходьба.
  let mx = input.mx, my = input.my;
  const k = input.keys;
  if (k.has('KeyW') || k.has('ArrowUp')) my += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) my -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  if (ml > 0.1) {
    const sp = 1.5 * dt, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const ox = p.x, oz = p.z;
    [p.x, p.z] = collide(world, p.x + (fx * my + rx * mx) * sp, p.z + (fz * my + rz * mx) * sp, 0.24);
    S.stepAcc += Math.hypot(p.x - ox, p.z - oz);
    if (S.stepAcc > 0.75) { S.stepAcc = 0; sfx.step(0, 0.06); noise(1.4, 0.15); }
  }
  if (S.doorOpen && p.z > 7.95) return win();
  camera.position.set(p.x, 1.6 + Math.sin(S.time * 7) * 0.012 * Math.min(ml, 1), p.z);
  camera.rotation.set(p.pitch, p.yaw, 0);

  // Сканер.
  S.impulseCd = Math.max(0, S.impulseCd - dt);
  const scanning = (input.fan || input.beam) && S.battery > 0;
  if (scanning) {
    S.scanIdle = 0;
    const beam = input.beam && !input.fan;
    S.battery = Math.max(0, S.battery - (beam ? 2.2 : 5.5) * dt);
    let read = -1;
    if (beam) castRays(Math.round(5400 * dt), 0.05, 12, (h) => { if (h.box.kind === 'note' && !h.mirrored && h.dist < 2.6) read = h.box.note; });
    else castRays(Math.round(9600 * dt), 0.45, 9);
    if (read >= 0) readNote(read, dt);
    S.tickAcc += dt * (beam ? 14 : 26);
    while (S.tickAcc > 1) { S.tickAcc -= 1; sfx.tick(beam); }
    S.hearT -= dt;
    if (S.hearT <= 0) { S.hearT = 0.4; noise(beam ? 2.8 : 6, beam ? 0.3 : 0.75); }
  } else {
    S.scanIdle += dt;
    if (S.scanIdle > 0.8) S.battery = Math.min(100, S.battery + 3.2 * dt);
  }
  if (S.impulseLeft > 0) { S.impulseLeft -= dt; castSphere(Math.round(32000 * dt)); }
  $('cross').classList.toggle('beam', input.beam && !input.fan);
  S.noise = Math.max(0, S.noise - dt * 0.5);

  monsterUpdate(dt);
  if (S.phase !== 'play') return;
  uniforms.uGlitch.value = S.time < S.glitchUntil ? 1 : 0;

  if (S.time >= S.directorNext && !S.directorBusy) director();
  if (S.time > S.subUntil) $('sub').style.opacity = '0';
}

let hudT = 0;
function hud(dt) {
  if ((hudT -= dt) > 0) return;
  hudT = 0.1;
  $('room').textContent = ROOMS[roomAt(S.p.x, S.p.z)].name;
  $('notesCount').textContent = `Записки ${S.notesRead}/4${S.doorOpen ? ' · выход открыт' : ''}`;
  $('batBar').firstElementChild.style.transform = `scaleX(${(S.battery / 100).toFixed(3)})`;
  $('noiseBar').firstElementChild.style.transform = `scaleX(${Math.min(1, S.noise).toFixed(3)})`;
  $('impBtn').classList.toggle('cool', S.impulseCd > 0 || S.battery < 30);
  const prog = input.beam && S.readProg.find((v, i) => v > 0 && !S.notes[i]);
  $('reading').textContent = prog ? `ЧТЕНИЕ ${Math.round(prog * 100)}%` : '';
}

// ---------- Записки ----------
function readNote(n, dt) {
  if (S.notes[n]) return;
  S.readProg[n] = Math.min(1, S.readProg[n] + dt / 1.3);
  if (S.readProg[n] < 1) return;
  S.notes[n] = true; S.notesRead++;
  sfx.chime();
  subtitle(NOTES[n], null, 9, true);
  renderJournal();
  if (S.notesRead === 3 && !S.sealOpen) {
    S.sealOpen = true;
    const seal = world.byName.seal;
    seal.removed = true; markStale([seal]);
    const dx = 7.95 - S.p.x, dz = 3 - S.p.z;
    setTimeout(() => sfx.creak(panTo(dx, dz, Math.hypot(dx, dz)), 0.35), 2500);
    S.events.push('в зале появилась дверь в детскую');
  }
  if (S.notesRead === 4) {
    S.doorOpen = true;
    const door = world.byName.entrance;
    door.removed = true; markStale([door]);
    setTimeout(() => sfx.unlockDoor(), 1800);
    S.events.push('входная дверь открылась');
  }
  director(`игрок прочитал записку ${n + 1}: «${NOTES[n]}»`);
}

function renderJournal() {
  $('journal').innerHTML = '';
  S.notes.forEach((r, i) => { if (r) { const li = document.createElement('li'); li.textContent = NOTES[i]; $('journal').append(li); } });
  if (!S.notesRead) $('journal').innerHTML = '<li style="color:var(--muted)">Пока ничего. Ищи жёлтые точки и читай их ЛУЧОМ.</li>';
}

function subtitle(text, who, sec = 6, isNote = false) {
  const el = $('sub');
  el.classList.toggle('note', isNote);
  el.innerHTML = '';
  if (who) { const b = document.createElement('b'); b.textContent = who + ': '; el.append(b); }
  el.append(document.createTextNode(text));
  el.style.opacity = '1';
  S.subUntil = S.time + sec;
}

// ---------- Режиссёр ----------
function monsterInfo() {
  const m = S.m;
  if (!m.active) return 'ещё спит в детской';
  const d = Math.hypot(m.x - S.p.x, m.z - S.p.z);
  const where = ROOMS[roomAt(m.x, m.z)].name.toLowerCase();
  const what = { hunt: 'охотится на звук', search: 'ищет игрока', stalk: 'подкрадывается', wander: 'бродит' }[m.state] || 'бродит';
  return `${what}, комната: ${where}, до игрока ${d.toFixed(1)} м`;
}
function stateFor(trigger) {
  return {
    t: Math.round(S.time), room: ROOMS[roomAt(S.p.x, S.p.z)].name, notesRead: S.notesRead, doorOpen: S.doorOpen,
    noise: S.noise > 0.6 ? 'громко' : S.noise > 0.2 ? 'тихо' : 'нет', monster: monsterInfo(), battery: Math.round(S.battery), trigger,
  };
}

function scripted(trigger) {
  if (trigger) {
    const lines = ['Это ты? Это правда ты?', 'Он двигает вещи, пока ты не смотришь.', 'Детская. Её не было. Не было!', 'Иди. Не оборачивайся на зеркало.'];
    return { event: 'whisper', text: lines[Math.min(S.notesRead - 1, 3)], target: null };
  }
  const opts = [['none', 30], ['whisper', 18], ['knock', 12], ['shift', 14], ['glitch', 8]];
  if (S.m.active) opts.push(['approach', 10], ['retreat', 5]);
  if (S.notesRead >= 2) opts.push(['mirror', 6]);
  let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
  const ev = opts.find((o) => (r -= o[1]) < 0)[0];
  return { event: ev, text: AI.FALLBACK_WHISPERS[Math.floor(Math.random() * AI.FALLBACK_WHISPERS.length)], target: null };
}

async function director(trigger) {
  if (S.directorBusy) return;
  S.directorBusy = true;
  const run = runId.v;
  let dir = null;
  if (aiOn()) {
    setAi('busy');
    try {
      const raw = await AI.chat({ key: settings.key, model: settings.model, messages: AI.directorMessages(stateFor(trigger), { radio: S.radio.slice(-3), events: S.events.slice(-5) }), maxTokens: 300, temperature: 1 });
      dir = AI.parseDirective(raw);
      setAi(dir ? 'ok' : 'err', dir ? '' : 'режиссёр ответил не JSON');
    } catch (e) { setAi('err', e.message); }
  }
  if (run !== runId.v) return;
  if (!dir) dir = scripted(trigger);
  S.directorBusy = false;
  S.directorNext = S.time + 22 + Math.random() * 14;
  if (S.phase === 'play' || S.phase === 'pause') apply(dir);
}

function apply(dir) {
  const p = S.p, m = S.m;
  S.events.push(dir.event + (dir.target ? `(${dir.target})` : ''));
  if (S.events.length > 12) S.events.shift();
  const fromRoom = (key) => { const r = ROOMS[key]; const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, dx = cx - p.x, dz = cz - p.z, d = Math.hypot(dx, dz); return { pan: panTo(dx, dz, d), vol: Math.max(0.12, 0.45 - d * 0.04) }; };
  switch (dir.event) {
    case 'whisper':
      sfx.radio(0.5);
      setTimeout(() => { subtitle(dir.text, 'Рация', 6); voice(dir.text); }, 450);
      break;
    case 'knock': {
      const here = roomAt(p.x, p.z);
      const key = dir.target && dir.target !== here ? dir.target : neighbourRooms(here)[0];
      const s = fromRoom(key); sfx.knock(s.pan, s.vol);
      break;
    }
    case 'shift': {
      const groups = ['wardrobe', 'armchair', 'coffee', 'chair', 'table', 'sofa', 'coats', 'toys'];
      for (let tries = 0; tries < 8; tries++) {
        const g = groups[Math.floor(Math.random() * groups.length)];
        const a = Math.random() * Math.PI * 2, len = 0.4 + Math.random() * 0.5;
        const moved = shiftGroup(world, g, Math.cos(a) * len, Math.sin(a) * len, p);
        if (moved) {
          markStale(moved);
          const b = moved[0], dx = (b.min[0] + b.max[0]) / 2 - p.x, dz = (b.min[2] + b.max[2]) / 2 - p.z, d = Math.hypot(dx, dz);
          sfx.creak(panTo(dx, dz, d), Math.max(0.08, 0.3 - d * 0.03));
          break;
        }
      }
      break;
    }
    case 'approach':
      if (m.active && m.state !== 'hunt') {
        const rooms = neighbourRooms(roomAt(p.x, p.z));
        const key = rooms[Math.floor(Math.random() * rooms.length)];
        const n = NODES.filter((nd) => nd.rooms.length === 1 && nd.rooms[0] === key)[0];
        if (n) goTo(n.x, n.z, 0.8, 'stalk');
      }
      break;
    case 'retreat':
      if (m.active && m.state !== 'hunt') {
        const far = NODES.reduce((a, b) => (Math.hypot(b.x - p.x, b.z - p.z) > Math.hypot(a.x - p.x, a.z - p.z) ? b : a));
        goTo(far.x, far.z, 0.9, 'wander');
      }
      break;
    case 'mirror': S.ghostUntil = S.time + 45; break;
    case 'glitch': S.glitchUntil = S.time + 1.2; sfx.burst({ dur: 0.9, freq: 2400, q: 0.5, vol: 0.12 }); break;
  }
}

function voice(text) { if (settings.tts) sfx.say(text); }

function setAi(state, msg = '') {
  const dot = $('aiDot');
  dot.className = aiOn() ? state : '';
  $('aiText').textContent = !aiOn() ? 'ИИ выкл' : state === 'err' ? `ИИ: ${msg}`.slice(0, 42) : state === 'busy' ? 'ИИ думает…' : 'ИИ на связи';
}

// ---------- Рация ----------
function openRadio() {
  if (S.phase !== 'play') return;
  document.exitPointerLock?.();
  input.fan = input.beam = false; input.mx = input.my = 0; joy.id = look.id = null;
  $('radio').classList.remove('hidden');
  $('radioInput').focus();
}
function closeRadio() { $('radio').classList.add('hidden'); $('radioInput').blur(); }
$('radioClose').addEventListener('click', closeRadio);
$('radioForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('radioInput').value.trim();
  if (!text || S.sisterBusy) return;
  $('radioInput').value = '';
  logRadio('me', text);
  S.radio.push(text); if (S.radio.length > 6) S.radio.shift();
  S.dialog.push({ role: 'user', content: text });
  sfx.radio(0.4);
  noise(7, 0.8); // рацию слышно
  S.sisterBusy = true;
  const run = runId.v;
  let reply = '';
  if (aiOn()) {
    setAi('busy');
    try { reply = AI.cleanLine(await AI.chat({ key: settings.key, model: settings.model, messages: AI.sisterMessages(stateFor(), S.dialog), maxTokens: 300 })); setAi('ok'); } catch (err) { setAi('err', err.message); }
  } else {
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (run !== runId.v) return;
  S.sisterBusy = false;
  if (!reply) reply = AI.FALLBACK_REPLIES[Math.floor(Math.random() * AI.FALLBACK_REPLIES.length)];
  S.dialog.push({ role: 'assistant', content: reply });
  sfx.radio(0.3);
  logRadio('her', reply);
  subtitle(reply, 'Аня', 7);
  voice(reply);
});
function logRadio(cls, text) {
  const d = document.createElement('div');
  d.className = cls; d.textContent = (cls === 'me' ? '> ' : 'Аня: ') + text;
  $('radioLog').append(d);
  $('radioLog').scrollTop = 1e6;
}

// ---------- Экраны ----------
const show = (id, on) => $(id).classList.toggle('hidden', !on);
function start() {
  sfx.unlock();
  newGame();
  for (const id of ['menu', 'end', 'pause', 'settings']) show(id, false);
  show('hud', true); show('controls', true);
  $('joyHint').classList.remove('hidden');
  renderJournal(); setAi(aiOn() ? 'ok' : '');
  subtitle('Нет света. Держи ВЕЕР, чтобы увидеть комнату. Записки Ани светятся жёлтым — читай их ЛУЧОМ вблизи.', null, 9);
}
function pause() {
  if (S?.phase !== 'play') return;
  S.phase = 'pause'; closeRadio();
  input.fan = input.beam = false;
  sfx.suspend();
  renderJournal(); show('pause', true);
}
function resume() {
  S.phase = 'play'; show('pause', false); sfx.resume();
}
function finish(kind) {
  S.phase = 'end';
  closeRadio(); document.exitPointerLock?.();
  show('controls', false); show('hud', false);
  $('endTitle').textContent = kind === 'win' ? 'СНАРУЖИ' : 'ДЫРА В ОБЛАКЕ';
  $('endText').textContent = AI.FALLBACK_EPILOGUE[kind];
  $('endStats').textContent = `Время: ${Math.floor(S.time / 60)}:${String(Math.floor(S.time % 60)).padStart(2, '0')} · записки ${S.notesRead}/4`;
  show('end', true);
  if (aiOn()) {
    const run = runId.v;
    const said = S.dialog.slice(-6).map((d) => `${d.role === 'user' ? 'Игрок' : 'Аня'}: ${d.content}`).join('\n');
    const summary = `Финал: ${kind === 'win' ? 'игрок вышел из квартиры через входную дверь' : `Жилец поймал игрока в комнате «${ROOMS[roomAt(S.p.x, S.p.z)].name}»`}, на ${Math.round(S.time)}-й секунде. Прочитано записок: ${S.notesRead} из 4.${S.notes.map((r, i) => (r ? `\nЗаписка: ${NOTES[i]}` : '')).join('')}${said ? `\nРазговор по рации:\n${said}` : ''}`;
    $('endText').style.opacity = '0.5';
    AI.chat({ key: settings.key, model: settings.model, messages: AI.epilogueMessages(summary), maxTokens: 400 })
      .then((t) => { if (run === runId.v) { $('endText').textContent = AI.cleanLine(t); voice(AI.cleanLine(t)); } })
      .catch(() => {})
      .finally(() => { $('endText').style.opacity = '1'; });
  }
}
function die() { sfx.death(); finish('death'); }
function win() { sfx.chime(); finish('win'); }

$('startBtn').addEventListener('click', start);
$('againBtn').addEventListener('click', start);
$('restartBtn').addEventListener('click', start);
$('resumeBtn').addEventListener('click', resume);
$('pauseBtn').addEventListener('click', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------- Настройки ИИ ----------
let settingsFrom = 'menu';
function openSettings(from) {
  settingsFrom = from;
  $('keyInput').value = settings.key; $('modelInput').value = settings.model; $('ttsInput').checked = settings.tts;
  $('testStatus').textContent = '';
  show(from, false); show('settings', true);
}
function readSettings() {
  settings = { key: $('keyInput').value.trim(), model: $('modelInput').value.trim() || AI.DEFAULT_MODEL, tts: $('ttsInput').checked };
  AI.saveSettings(settings);
}
$('settingsBtn').addEventListener('click', () => openSettings('menu'));
$('pSettingsBtn').addEventListener('click', () => openSettings('pause'));
$('saveBtn').addEventListener('click', () => { readSettings(); show('settings', false); show(settingsFrom, true); menuAi(); if (S) setAi(aiOn() ? 'ok' : ''); });
$('clearKeyBtn').addEventListener('click', () => { $('keyInput').value = ''; readSettings(); $('testStatus').textContent = 'Ключ удалён.'; });
$('testBtn').addEventListener('click', async () => {
  readSettings();
  const st = $('testStatus');
  if (!settings.key) { st.className = 'small status-err'; st.textContent = 'Сначала вставь ключ.'; return; }
  st.className = 'small'; st.textContent = 'Стучусь в рацию…';
  sfx.unlock();
  const t0 = performance.now();
  try {
    const reply = AI.cleanLine(await AI.chat({ key: settings.key, model: settings.model, messages: AI.sisterMessages({ t: 0, room: 'Прихожая', notesRead: 0, doorOpen: false, noise: 'нет', monster: 'спит', battery: 100 }, [{ role: 'user', content: 'Аня, ты меня слышишь?' }]), maxTokens: 300 }));
    st.className = 'small status-ok'; st.textContent = `Работает (${((performance.now() - t0) / 1000).toFixed(1)} с). Аня: «${reply}»`;
    voice(reply);
  } catch (e) { st.className = 'small status-err'; st.textContent = `Ошибка: ${e.message}`; }
});
$('loadModelsBtn').addEventListener('click', async () => {
  const st = $('testStatus');
  st.className = 'small'; st.textContent = 'Загружаю список…';
  try {
    const r = await fetch(AI.OR_MODELS_URL);
    const data = (await r.json()).data || [];
    const price = (m) => Number(m.pricing?.prompt || 0) + Number(m.pricing?.completion || 0);
    data.sort((a, b) => price(a) - price(b));
    const list = $('modelList'); list.innerHTML = '';
    for (const m of data) { const o = document.createElement('option'); o.value = m.id; o.label = `${m.name || m.id} · $${(Number(m.pricing?.prompt || 0) * 1e6).toFixed(2)}/M`; list.append(o); }
    st.textContent = `Моделей: ${data.length}. Начни вводить название в поле «Модель» (дешёвые сверху; бесплатные с «:free» могут тормозить).`;
  } catch (e) { st.className = 'small status-err'; st.textContent = `Не удалось: ${e.message}`; }
});
function menuAi() { $('menuAi').textContent = aiOn() ? `ИИ включён · ${settings.model}` : 'ИИ выключен — Аня и режиссёр на заготовках.'; }
menuAi();

// ---------- Цикл ----------
// В меню сканер сам ощупывает прихожую.
let last = performance.now(), menuYaw = 0;
const menuWorld = buildApartment();
function attract(dt) {
  world = menuWorld;
  menuYaw += dt * 0.25;
  camera.position.set(1.6, 1.6, 7.2);
  camera.rotation.set(-0.15 + Math.sin(menuYaw * 0.7) * 0.25, menuYaw, 0);
  const keep = S;
  S = { time: performance.now() / 1000, m: { active: false }, ghostUntil: 0, notes: [] };
  uniforms.uTime.value = S.time;
  castRays(70, 0.4, 9);
  S = keep;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!S) attract(dt);
  else if (S.phase === 'play') { update(dt); hud(dt); uniforms.uTime.value = S.time; }
  flushCloud();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// Отладка: ?debug открывает состояние в консоли.
if (location.search.includes('debug')) window.__p = { get S() { return S; }, apply, director, world: () => world };
