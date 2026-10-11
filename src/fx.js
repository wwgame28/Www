// Particle effects (three.quarks): one-shot bursts from small pools, a glowing trail behind the
// projectile, and looping flames on torches/candles. Additive soft dots, so they also feed the bloom.
import * as THREE from 'three';
import {
  BatchedRenderer, ParticleSystem, RenderMode, ConstantValue, IntervalValue, ConstantColor, Vector4,
  Vector3 as QVec3, SphereEmitter, ConeEmitter, ColorOverLife, SizeOverLife, PiecewiseBezier, Bezier, Gradient, ApplyForce,
} from 'three.quarks';

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.65)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const toV4 = (hex, a = 1) => { const c = new THREE.Color(hex); return new Vector4(c.r, c.g, c.b, a); };

export function createFx(scene, { budget = 1 } = {}) {
  const batch = new BatchedRenderer();
  scene.add(batch);
  const material = new THREE.MeshBasicMaterial({ map: softDot(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const n = (x) => Math.max(1, Math.round(x * budget)); // fewer particles on the low graphics setting

  function make({ count = 0, rate = 0, speed, life, size, gravity = 0, radius = 0.15, cone = false, looping = false }) {
    const ps = new ParticleSystem({
      duration: 1, looping, worldSpace: true, autoDestroy: false,
      startLife: new IntervalValue(...life), startSpeed: new IntervalValue(...speed), startSize: new IntervalValue(...size),
      startColor: new ConstantColor(new Vector4(1, 1, 1, 1)),
      emissionOverTime: new ConstantValue(rate),
      emissionBursts: count ? [{ time: 0, count: new ConstantValue(n(count)), cycle: 1, interval: 0.01, probability: 1 }] : [],
      shape: cone ? new ConeEmitter({ radius, angle: 0.35, thickness: 1, arc: Math.PI * 2 }) : new SphereEmitter({ radius, thickness: 1, arc: Math.PI * 2 }),
      material, renderMode: RenderMode.BillBoard,
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

  // Glowing trail that follows the projectile while it flies.
  const trail = make({ rate: 0, speed: [0, 0.2], life: [0.25, 0.4], size: [0.22, 0.34], looping: true, radius: 0.05 });
  function setTrail(color, x, y, z, on) {
    trail.emitter.position.set(x, y, z);
    trail.emissionOverTime = new ConstantValue(on ? n(70) : 0);
    if (color !== trail.userColor) { trail.startColor = new ConstantColor(toV4(color)); trail.userColor = color; }
  }

  // Looping flames for the current location (torches, candles, jack-o'-lanterns).
  let flames = [];
  function setFlames(points) {
    for (const ps of flames) { batch.deleteSystem(ps); ps.dispose(); }
    flames = points.slice(0, 10).map(({ x, y, z, color = 0xff9a3a, scale = 1 }) => {
      const ps = make({ rate: n(16 * scale), speed: [0.5, 1.1], life: [0.35, 0.6], size: [0.1 * scale, 0.2 * scale], looping: true, cone: true, radius: 0.05 * scale });
      ps.startColor = new ConstantColor(toV4(color));
      ps.emitter.position.set(x, y, z);
      return ps;
    });
  }

  return { update: (dt) => batch.update(dt), burst, setTrail, setFlames };
}
