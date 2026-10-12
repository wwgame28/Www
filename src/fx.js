// Particle effects (three.quarks): one-shot bursts from small pools, the projectile's trail (a preset
// from cosmetics.js), the «Пламя» skin's embers and looping flames on torches/candles. One 2×2 canvas
// atlas (soft dot, star, snowflake, smoke) is shared by all particles, so they batch into one additive
// draw call (+1 normal-blended batch only while a trail uses smoke/snowflakes).
import * as THREE from 'three';
import {
  BatchedRenderer, ParticleSystem, RenderMode, ConstantValue, IntervalValue, ConstantColor, Vector4,
  Vector3 as QVec3, SphereEmitter, ConeEmitter, ColorOverLife, SizeOverLife, PiecewiseBezier, Bezier, Gradient, ApplyForce, RotationOverLife,
} from 'three.quarks';
import { TRAILS } from './cosmetics.js';

function drawSoftDot(g, ox, oy) {
  const r = g.createRadialGradient(ox + 32, oy + 32, 0, ox + 32, oy + 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.65)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(ox, oy, 64, 64);
}
function drawStar(g, ox, oy) {
  const cx = ox + 32, cy = oy + 32;
  const halo = g.createRadialGradient(cx, cy, 0, cx, cy, 30);
  halo.addColorStop(0, 'rgba(255,255,255,.55)'); halo.addColorStop(0.4, 'rgba(255,255,255,.18)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo; g.fillRect(ox, oy, 64, 64);
  g.save();
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 10.5 : 27;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
  g.shadowColor = 'rgba(255,255,255,.9)'; g.shadowBlur = 5;
  g.fillStyle = '#fff'; g.fill();
  g.restore();
}
function drawSnowflake(g, ox, oy) {
  const cx = ox + 32, cy = oy + 32;
  const arms = (w, color) => {
    g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3, ca = Math.cos(a), sa = Math.sin(a);
      const P = (d, side, len) => { // a side branch at distance d, angle ±50°
        const bx = cx + ca * d, by = cy + sa * d, b = a + side * 0.87;
        g.moveTo(bx, by); g.lineTo(bx + Math.cos(b) * len, by + Math.sin(b) * len);
      };
      g.beginPath();
      g.moveTo(cx, cy); g.lineTo(cx + ca * 25, cy + sa * 25);
      P(13, 1, 8); P(13, -1, 8); P(19, 1, 5); P(19, -1, 5);
      g.stroke();
    }
  };
  arms(7, 'rgba(40,110,200,.85)'); // blue outline: still readable on white snow
  arms(3.2, '#ffffff');
}
function drawSmoke(g, ox, oy) {
  for (const [x, y, r, a] of [[32, 34, 24, 0.55], [22, 28, 15, 0.5], [42, 26, 14, 0.5], [26, 42, 13, 0.45], [42, 41, 13, 0.45]]) {
    const s = g.createRadialGradient(ox + x, oy + y, 0, ox + x, oy + y, r);
    s.addColorStop(0, `rgba(255,255,255,${a})`); s.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = s; g.fillRect(ox, oy, 64, 64);
  }
}
function atlas() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  drawSoftDot(g, 0, 0); drawStar(g, 64, 0); drawSnowflake(g, 0, 64); drawSmoke(g, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const toV4 = (hex, a = 1) => { const c = new THREE.Color(hex); return new Vector4(c.r, c.g, c.b, a); };
const toV3 = (hex) => { const c = new THREE.Color(hex); return new QVec3(c.r, c.g, c.b); };

export function createFx(scene, { budget = 1 } = {}) {
  const batch = new BatchedRenderer();
  scene.add(batch);
  const map = atlas();
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const normal = new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.NormalBlending, depthWrite: false });
  const n = (x) => Math.max(1, Math.round(x * budget)); // fewer particles on the low graphics setting
  const TILES = { uTileCount: 2, vTileCount: 2 };

  function make({ count = 0, rate = 0, speed, life, size, gravity = 0, radius = 0.15, cone = false, looping = false }) {
    const ps = new ParticleSystem({
      duration: 1, looping, worldSpace: true, autoDestroy: false,
      startLife: new IntervalValue(...life), startSpeed: new IntervalValue(...speed), startSize: new IntervalValue(...size),
      startColor: new ConstantColor(new Vector4(1, 1, 1, 1)),
      emissionOverTime: new ConstantValue(rate),
      emissionBursts: count ? [{ time: 0, count: new ConstantValue(n(count)), cycle: 1, interval: 0.01, probability: 1 }] : [],
      shape: cone ? new ConeEmitter({ radius, angle: 0.35, thickness: 1, arc: Math.PI * 2 }) : new SphereEmitter({ radius, thickness: 1, arc: Math.PI * 2 }),
      material, renderMode: RenderMode.BillBoard, ...TILES, startTileIndex: new ConstantValue(0),
    });
    ps.addBehavior(new ColorOverLife(new Gradient([[new QVec3(1, 1, 1), 0], [new QVec3(1, 1, 1), 1]], [[1, 0], [0, 1]])));
    ps.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.8, 0.45, 0), 0]])));
    if (gravity) ps.addBehavior(new ApplyForce(new QVec3(0, -1, 0), new ConstantValue(gravity)));
    if (cone) ps.emitter.rotation.x = -Math.PI / 2; // cones emit along +z; point them up
    if (!looping) ps.pause();
    batch.addSystem(ps);
    scene.add(ps.emitter);
    return ps;
  }

  const KINDS = {
    spark: { pool: 6, count: 14, speed: [2.5, 6], life: [0.2, 0.4], size: [0.08, 0.16], gravity: 6 },
    hit: { pool: 6, count: 26, speed: [2, 5.5], life: [0.3, 0.6], size: [0.12, 0.26], gravity: 5, radius: 0.3 },
    big: { pool: 2, count: 70, speed: [4, 9], life: [0.4, 0.8], size: [0.18, 0.4], gravity: 3, radius: 0.6 },
    ring: { pool: 3, count: 20, speed: [1.5, 3], life: [0.3, 0.5], size: [0.1, 0.2], radius: 0.4 },
    dust: { pool: 4, count: 16, speed: [0.6, 1.6], life: [0.5, 0.9], size: [0.25, 0.5], gravity: 0.6, radius: 0.45, cone: true },
  };
  const pools = {};
  for (const [k, def] of Object.entries(KINDS)) pools[k] = { i: 0, list: Array.from({ length: def.pool }, () => make(def)) };

  function burst(kind, x, y, z, color) {
    const pool = pools[kind];
    const ps = pool.list[pool.i++ % pool.list.length];
    ps.startColor = new ConstantColor(toV4(color));
    ps.emitter.position.set(x, y, z);
    ps.emitter.updateMatrixWorld(true);
    ps.restart();
  }

  // ---------- trail: one preset = 1-2 looping systems that follow the projectile ----------
  function makeTrailSystem(s, tint) {
    const rate = new ConstantValue(0); // mutated, never re-allocated per frame
    const ps = new ParticleSystem({
      duration: 1, looping: true, worldSpace: true, autoDestroy: false,
      startLife: new IntervalValue(...s.life), startSpeed: new IntervalValue(...s.speed), startSize: new IntervalValue(...s.size),
      startColor: new ConstantColor(s.tint ? toV4(tint) : new Vector4(1, 1, 1, 1)),
      startRotation: s.spin ? new IntervalValue(0, Math.PI * 2) : new ConstantValue(0),
      emissionOverTime: rate,
      shape: new SphereEmitter({ radius: s.radius ?? 0.05, thickness: 1, arc: Math.PI * 2 }),
      material: s.blend === 'norm' ? normal : material, renderMode: RenderMode.BillBoard, ...TILES, startTileIndex: new ConstantValue(s.tile),
    });
    const col = s.color ? s.color.map(([h, p]) => [toV3(h), p]) : [[new QVec3(1, 1, 1), 0], [new QVec3(1, 1, 1), 1]];
    ps.addBehavior(new ColorOverLife(new Gradient(col, s.alpha ?? [[1, 0], [0, 1]])));
    const curve = s.grow ? new Bezier(0.6, 0.95, 1.25, 1.5) : s.flat ? new Bezier(1, 1, 0.9, 0.55) : s.twinkle ? new Bezier(0.4, 1.15, 1, 0.1) : new Bezier(1, 0.8, 0.45, 0);
    ps.addBehavior(new SizeOverLife(new PiecewiseBezier([[curve, 0]])));
    if (s.up) ps.addBehavior(new ApplyForce(new QVec3(0, 1, 0), new ConstantValue(s.up)));
    if (s.gravity) ps.addBehavior(new ApplyForce(new QVec3(0, -1, 0), new ConstantValue(s.gravity)));
    if (s.spin) ps.addBehavior(new RotationOverLife(new IntervalValue(-s.spin, s.spin)));
    batch.addSystem(ps);
    scene.add(ps.emitter);
    return { ps, rate, max: n(s.rate) };
  }
  let trail = [];
  let trailKey = null;
  function setTrailStyle(id, tint) {
    const key = `${id}:${tint}`;
    if (key === trailKey) return;
    for (const t of trail) { batch.deleteSystem(t.ps); scene.remove(t.ps.emitter); t.ps.dispose(); }
    trail = (TRAILS[id] || TRAILS.default).systems.map((s) => makeTrailSystem(s, tint));
    trailKey = key;
  }
  setTrailStyle('default', 0xffffff);
  function setTrail(color, x, y, z, on) {
    for (const t of trail) {
      t.ps.emitter.position.set(x, y, z);
      t.rate.value = on ? t.max : 0;
    }
  }

  // ---------- hero aura (skin «Пламя»: rising embers) ----------
  let aura = null;
  const auraRate = new ConstantValue(0);
  function setAura(kind) {
    if (aura) { batch.deleteSystem(aura); scene.remove(aura.emitter); aura.dispose(); aura = null; }
    if (kind !== 'embers') return;
    aura = new ParticleSystem({
      duration: 1, looping: true, worldSpace: true, autoDestroy: false,
      startLife: new IntervalValue(0.5, 0.9), startSpeed: new IntervalValue(0.1, 0.4), startSize: new IntervalValue(0.06, 0.12),
      startColor: new ConstantColor(new Vector4(1, 1, 1, 1)), emissionOverTime: auraRate,
      shape: new SphereEmitter({ radius: 0.35, thickness: 1, arc: Math.PI * 2 }),
      material, renderMode: RenderMode.BillBoard, ...TILES, startTileIndex: new ConstantValue(0),
    });
    aura.addBehavior(new ColorOverLife(new Gradient([[toV3(0xffd27a), 0], [toV3(0xff5a1a), 0.6], [toV3(0x801000), 1]], [[1, 0], [0.8, 0.6], [0, 1]])));
    aura.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.8, 0.45, 0), 0]])));
    aura.addBehavior(new ApplyForce(new QVec3(0, 1, 0), new ConstantValue(2.2)));
    batch.addSystem(aura);
    scene.add(aura.emitter);
  }
  function moveAura(x, y, z, on) {
    if (!aura) return;
    aura.emitter.position.set(x, y, z);
    auraRate.value = on ? n(14) : 0;
  }

  // Looping flames for the current location (torches, candles, jack-o'-lanterns).
  let flames = [];
  function setFlames(points) {
    for (const ps of flames) { batch.deleteSystem(ps); ps.dispose(); }
    flames = points.slice(0, 14).map(({ x, y, z, color = 0xff9a3a, scale = 1 }) => {
      const ps = make({ rate: n(16 * scale), speed: [0.5, 1.1], life: [0.35, 0.6], size: [0.1 * scale, 0.2 * scale], looping: true, cone: true, radius: 0.05 * scale });
      ps.startColor = new ConstantColor(toV4(color));
      ps.emitter.position.set(x, y, z);
      return ps;
    });
  }

  // Weather of a story zone: one looping system that follows the hero (rain, blizzard, sand…).
  const WEATHER = {
    rain: { rate: 150, life: [0.5, 0.8], speed: [0.2, 0.6], size: [0.05, 0.09], gravity: 32, tile: 0, color: 0xc8dcff, alpha: 0.75 },
    snow: { rate: 110, life: [3.5, 5.5], speed: [0.2, 0.8], size: [0.12, 0.22], gravity: 0.7, wind: [2.2, 0], tile: 2, blend: 'norm', color: 0xffffff },
    flakes: { rate: 26, life: [4, 6], speed: [0.1, 0.4], size: [0.1, 0.18], gravity: 0.5, tile: 2, blend: 'norm', color: 0xffffff },
    sand: { rate: 46, life: [1.6, 2.6], speed: [0.2, 0.8], size: [0.6, 1.3], wind: [5, 1.2], tile: 3, blend: 'norm', color: 0xe8c890, alpha: 0.55 },
    sparkle: { rate: 26, life: [2, 3.2], speed: [0.1, 0.4], size: [0.12, 0.24], up: 0.5, tile: 1, color: 0xe0b8ff },
    dust: { rate: 20, life: [3, 5], speed: [0.05, 0.25], size: [0.06, 0.12], up: 0.08, tile: 0, color: 0xa890ff, alpha: 0.6 },
  };
  let weather = null;
  function setWeather(kind) {
    if (weather) { batch.deleteSystem(weather); scene.remove(weather.emitter); weather.dispose(); weather = null; }
    const w = WEATHER[kind];
    if (!w) return;
    weather = new ParticleSystem({
      duration: 1, looping: true, worldSpace: true, autoDestroy: false,
      startLife: new IntervalValue(...w.life), startSpeed: new IntervalValue(...w.speed), startSize: new IntervalValue(...w.size),
      startColor: new ConstantColor(toV4(w.color, w.alpha ?? 1)), emissionOverTime: new ConstantValue(n(w.rate)),
      shape: new SphereEmitter({ radius: 11, thickness: 1, arc: Math.PI * 2 }),
      material: w.blend === 'norm' ? normal : material, renderMode: RenderMode.BillBoard, ...TILES, startTileIndex: new ConstantValue(w.tile),
    });
    weather.addBehavior(new ColorOverLife(new Gradient([[new QVec3(1, 1, 1), 0], [new QVec3(1, 1, 1), 1]], [[0, 0], [1, 0.15], [1, 0.8], [0, 1]])));
    if (w.gravity) weather.addBehavior(new ApplyForce(new QVec3(0, -1, 0), new ConstantValue(w.gravity)));
    if (w.up) weather.addBehavior(new ApplyForce(new QVec3(0, 1, 0), new ConstantValue(w.up)));
    if (w.wind) weather.addBehavior(new ApplyForce(new QVec3(w.wind[0], 0, w.wind[1]).normalize(), new ConstantValue(Math.hypot(...w.wind))));
    weather.emitter.scale.set(1, 0.35, 1); // a wide flat cloud of particles
    batch.addSystem(weather);
    scene.add(weather.emitter);
  }
  function moveWeather(x, z, y = 5) { if (weather) weather.emitter.position.set(x, y, z); }

  return { update: (dt) => batch.update(dt), burst, setTrail, setTrailStyle, setFlames, setAura, moveAura, setWeather, moveWeather };
}
