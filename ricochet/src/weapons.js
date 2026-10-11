// Each weapon is one projectile with its own trajectory. Simulation only — no rendering here.
// A projectile is `flying` until its trajectory ends, then `dropped` (pick it up) or back in hand.

export const WEAPONS = [
  { id: 'ricochet', name: 'Рикошет', model: 'blaster-a', unlock: 0, catchable: true, desc: 'Прямо, 3 отскока' },
  { id: 'boomerang', name: 'Бумеранг', model: 'blaster-c', unlock: 300, catchable: false, desc: 'Дуга и возврат в руку' },
  { id: 'snake', name: 'Змей', model: 'blaster-e', unlock: 800, catchable: true, desc: 'Волна, 2 отскока' },
  { id: 'spiral', name: 'Спираль', model: 'blaster-g', unlock: 1500, catchable: true, desc: 'Раскручивается у цели' },
  { id: 'lightning', name: 'Молния', model: 'blaster-j', unlock: 2500, catchable: true, desc: 'Цепь до 6 врагов' },
  { id: 'orbit', name: 'Орбита', model: 'blaster-m', unlock: 4000, catchable: false, desc: 'Кружит вокруг тебя' },
  { id: 'blackhole', name: 'Чёрная дыра', model: 'blaster-q', unlock: 6000, catchable: true, desc: 'Стягивает и взрывает' },
];

export const getWeapon = (id) => WEAPONS.find((w) => w.id === id) || WEAPONS[0];

export const PROJECTILE_R = 0.3;

const norm = (x, z) => {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
};

// Reflect a moving point off the arena walls and circular solids. Returns true if it bounced.
export function bounce(p, world) {
  const { W, D } = world.arena;
  let hit = false;
  if (p.x < -W + PROJECTILE_R) { p.x = -W + PROJECTILE_R; p.vx = Math.abs(p.vx); hit = true; }
  if (p.x > W - PROJECTILE_R) { p.x = W - PROJECTILE_R; p.vx = -Math.abs(p.vx); hit = true; }
  if (p.z < -D + PROJECTILE_R) { p.z = -D + PROJECTILE_R; p.vz = Math.abs(p.vz); hit = true; }
  if (p.z > D - PROJECTILE_R) { p.z = D - PROJECTILE_R; p.vz = -Math.abs(p.vz); hit = true; }
  for (const o of world.solids) {
    const dx = p.x - o.x, dz = p.z - o.z;
    const dist = Math.hypot(dx, dz), min = o.r + PROJECTILE_R;
    if (dist < min && dist > 1e-6) {
      const nx = dx / dist, nz = dz / dist;
      const dot = p.vx * nx + p.vz * nz;
      if (dot < 0) { p.vx -= 2 * dot * nx; p.vz -= 2 * dot * nz; }
      p.x = o.x + nx * min; p.z = o.z + nz * min;
      hit = true;
    }
  }
  return hit;
}

const clampToArena = (p, world) => {
  const { W, D } = world.arena;
  p.x = Math.max(-W + PROJECTILE_R, Math.min(W - PROJECTILE_R, p.x));
  p.z = Math.max(-D + PROJECTILE_R, Math.min(D - PROJECTILE_R, p.z));
};

export function launch(weaponId, hero, target) {
  const [dx, dz] = norm(target.x - hero.x, target.z - hero.z);
  const p = {
    weapon: weaponId, state: 'flying', t: 0,
    x: hero.x + dx * 0.5, z: hero.z + dz * 0.5, vx: 0, vz: 0,
    bounces: 0, hits: new Set(), kills: 0, events: [],
    ox: hero.x, oz: hero.z, tx: target.x, tz: target.z,
  };
  const speed = { ricochet: 18, boomerang: 13, snake: 14, spiral: 15, lightning: 20, orbit: 0, blackhole: 0 }[weaponId];
  p.vx = dx * speed; p.vz = dz * speed;
  if (weaponId === 'boomerang') {
    // Aim the start of the arc to the left so the curve sweeps through the target.
    const a = Math.atan2(dz, dx) - 0.75;
    p.vx = Math.cos(a) * speed; p.vz = Math.sin(a) * speed;
  }
  if (weaponId === 'snake') { p.bx = p.x; p.bz = p.z; }
  if (weaponId === 'spiral') { p.phase = 'travel'; p.travel = Math.hypot(target.x - p.x, target.z - p.z) / speed; }
  if (weaponId === 'lightning') p.jumps = 0;
  if (weaponId === 'orbit') { p.angle = Math.atan2(dz, dx); }
  if (weaponId === 'blackhole') {
    const dist = Math.hypot(target.x - p.x, target.z - p.z);
    p.sx = p.x; p.sz = p.z;
    p.cx = (p.x + target.x) / 2 - dz * dist * 0.35; // control point bulges sideways
    p.cz = (p.z + target.z) / 2 + dx * dist * 0.35;
    p.duration = Math.max(0.35, dist / 12);
    p.phase = 'travel';
  }
  return p;
}

export function drop(p) {
  p.state = 'dropped';
  p.pull = null;
  p.vx *= 0.25; p.vz *= 0.25;
}

const STEPS = {
  ricochet(p, dt, world) {
    p.x += p.vx * dt; p.z += p.vz * dt;
    if (bounce(p, world)) {
      p.bounces++;
      p.events.push('bounce');
      if (p.bounces > 3) drop(p);
    }
    if (p.t > 3) drop(p);
  },

  boomerang(p, dt, world) {
    const speed = Math.hypot(p.vx, p.vz);
    if (p.t < 0.9) {
      const a = Math.atan2(p.vz, p.vx) + 1.7 * dt; // constant curvature
      p.vx = Math.cos(a) * speed; p.vz = Math.sin(a) * speed;
    } else {
      const [hx, hz] = norm(world.hero.x - p.x, world.hero.z - p.z);
      const s = Math.min(16, speed + 10 * dt);
      p.vx = hx * s; p.vz = hz * s;
      if (Math.hypot(world.hero.x - p.x, world.hero.z - p.z) < 0.7) {
        p.state = 'held';
        p.events.push('return');
        return;
      }
    }
    p.x += p.vx * dt; p.z += p.vz * dt;
    if (bounce(p, world)) p.events.push('bounce');
    if (p.t > 4) drop(p);
  },

  snake(p, dt, world) {
    // The base point travels straight and bounces; the projectile sways sideways around it.
    const base = { x: p.bx, z: p.bz, vx: p.vx, vz: p.vz };
    base.x += base.vx * dt; base.z += base.vz * dt;
    if (bounce(base, world)) {
      p.bounces++;
      p.events.push('bounce');
    }
    p.bx = base.x; p.bz = base.z; p.vx = base.vx; p.vz = base.vz;
    const [dx, dz] = norm(p.vx, p.vz);
    const sway = 1.2 * Math.sin(p.t * 11);
    p.x = p.bx - dz * sway; p.z = p.bz + dx * sway;
    clampToArena(p, world);
    if (p.bounces > 2 || p.t > 3.2) drop(p);
  },

  spiral(p, dt, world) {
    if (p.phase === 'travel') {
      p.x += p.vx * dt; p.z += p.vz * dt;
      const hitWall = bounce(p, world);
      if (p.t >= p.travel || hitWall) {
        p.phase = 'spin'; p.cx = p.x; p.cz = p.z; p.spinT = 0; p.angle = Math.atan2(p.vz, p.vx);
      }
      return;
    }
    p.spinT += dt;
    p.angle += 9 * dt;
    const r = 0.3 + 3.2 * (p.spinT / 1.4);
    p.x = p.cx + Math.cos(p.angle) * r; p.z = p.cz + Math.sin(p.angle) * r;
    p.vx = -Math.sin(p.angle) * 9 * r; p.vz = Math.cos(p.angle) * 9 * r;
    clampToArena(p, world);
    if (p.spinT >= 1.4) drop(p);
  },

  lightning(p, dt, world) {
    p.x += p.vx * dt; p.z += p.vz * dt;
    if (bounce(p, world)) {
      p.bounces++;
      p.events.push('bounce');
      if (p.bounces > 1) drop(p);
    }
    if (p.t > 2.5) drop(p);
  },

  orbit(p, dt, world) {
    p.angle += 7 * dt;
    const r = 1 + 5 * Math.min(1, p.t / 3);
    p.x = world.hero.x + Math.cos(p.angle) * r; p.z = world.hero.z + Math.sin(p.angle) * r;
    p.vx = -Math.sin(p.angle) * 7 * r; p.vz = Math.cos(p.angle) * 7 * r;
    clampToArena(p, world);
    if (p.t >= 3) drop(p);
  },

  blackhole(p, dt, world) {
    if (p.phase === 'travel') {
      const u = Math.min(1, p.t / p.duration), v = 1 - u;
      const nx = v * v * p.sx + 2 * v * u * p.cx + u * u * p.tx;
      const nz = v * v * p.sz + 2 * v * u * p.cz + u * u * p.tz;
      p.vx = (nx - p.x) / dt; p.vz = (nz - p.z) / dt;
      p.x = nx; p.z = nz;
      clampToArena(p, world);
      if (u >= 1) { p.phase = 'pull'; p.pullT = 0; p.pull = { x: p.x, z: p.z, r: 4, strength: 6 }; p.vx = p.vz = 0; }
      return;
    }
    p.pullT += dt;
    if (p.pullT >= 1.2) {
      p.events.push('explode');
      p.explosion = { x: p.x, z: p.z, r: 3 };
      drop(p);
    }
  },
};

// Called by the game after a flying projectile touches an enemy.
export function onEnemyHit(p, enemy, world) {
  if (p.weapon !== 'lightning') return;
  p.jumps++;
  if (p.jumps >= 6) { drop(p); return; }
  let best = null, bestD = 5;
  for (const e of world.enemies) {
    if (e.dead || p.hits.has(e.id)) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d < bestD) { best = e; bestD = d; }
  }
  if (!best) { drop(p); return; }
  const [dx, dz] = norm(best.x - p.x, best.z - p.z);
  p.vx = dx * 20; p.vz = dz * 20;
  p.events.push('chain');
}

export function stepProjectile(p, dt, world) {
  if (p.state === 'flying') {
    p.t += dt;
    STEPS[p.weapon](p, dt, world);
  } else if (p.state === 'dropped') {
    const friction = world.rule?.dropSlide ? 0.6 : 6;
    const k = Math.max(0, 1 - friction * dt);
    p.vx *= k; p.vz *= k;
    p.x += p.vx * dt; p.z += p.vz * dt;
    bounce(p, world);
  }
}
