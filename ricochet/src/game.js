import { ARENA, getLocation, layoutFor } from './locations.js';
import { getWeapon, launch, stepProjectile, onEnemyHit, PROJECTILE_R } from './weapons.js';
import { ENEMY_TYPES, planWave, speedFactor } from './waves.js';

const HERO_SPEED = 5.2;
const HERO_R = 0.4;
const WAVE_BREAK = 1.6;

export function createGame({ seed, locationId, weaponId }) {
  const loc = getLocation(locationId);
  const { solids, decor } = layoutFor(loc);
  const g = {
    seed, loc, weapon: getWeapon(weaponId), solids, decor, arena: ARENA,
    hero: { x: 0, z: 3, vx: 0, vz: 0, r: HERO_R, facing: Math.PI, moving: 0 },
    projectile: { state: 'held', x: 0, z: 3, vx: 0, vz: 0, hits: new Set(), events: [] },
    enemies: [], nextId: 1,
    wave: 0, waveT: 0, queue: [], breakT: 0.6,
    score: 0, bestCombo: 0, shotMult: 1, pendingMult: 1,
    time: 0, over: false, events: [],
  };
  return g;
}

const emit = (g, type, data = {}) => g.events.push({ type, ...data });

function startWave(g) {
  g.wave++;
  g.waveT = 0;
  g.queue = planWave(g.seed, g.wave);
  emit(g, 'wave', { wave: g.wave });
}

function spawnPos(g, s) {
  const { W, D } = g.arena;
  switch (s.side) {
    case 'left': return { x: -W - 0.6, z: s.along * D };
    case 'right': return { x: W + 0.6, z: s.along * D };
    case 'bottom': return { x: s.along * W, z: D + 0.6 };
    default: return { x: s.along * W, z: -D - 0.6 };
  }
}

function addEnemy(g, type, x, z, model) {
  const def = ENEMY_TYPES[type];
  const e = {
    id: g.nextId++, type, model: model || def.model[0], x, z, r: def.r, hp: def.hp,
    speed: def.speed * speedFactor(g.wave), flying: !!def.flying, dead: false, facing: 0, hurtT: 0,
  };
  g.enemies.push(e);
  return e;
}

const inRiver = (g, z) => {
  const r = g.loc.rule.river;
  return r && Math.abs(z - r.z) < r.half;
};

function pushOutOfSolids(g, b) {
  for (const o of g.solids) {
    const dx = b.x - o.x, dz = b.z - o.z, d = Math.hypot(dx, dz), min = o.r + b.r;
    if (d < min && d > 1e-6) { b.x = o.x + (dx / d) * min; b.z = o.z + (dz / d) * min; }
  }
}

function killEnemy(g, e, p) {
  e.dead = true;
  p.kills = (p.kills || 0) + 1;
  const points = 10 * p.kills * g.shotMult;
  g.score += points;
  g.bestCombo = Math.max(g.bestCombo, p.kills);
  emit(g, 'kill', { x: e.x, z: e.z, points, combo: p.kills, id: e.id });
  if (e.type === 'splitter') {
    for (const side of [-1, 1]) {
      const child = addEnemy(g, 'runner', e.x + side * 0.5, e.z, 'character-e');
      p.hits.add(child.id); // spawned by this shot — it can't be killed by the same pass
    }
  }
}

function damage(g, e, p) {
  p.hits.add(e.id);
  e.hp--;
  e.hurtT = 0.2;
  if (e.hp <= 0) killEnemy(g, e, p);
  else emit(g, 'hurt', { x: e.x, z: e.z, id: e.id });
}

// input: { move: {x, z} with length 0..1, fire: {x, z} | null }
export function step(g, dt, input = {}) {
  if (g.over) return;
  g.time += dt;
  const rule = g.loc.rule;
  const h = g.hero, p = g.projectile;

  // Hero movement (ice uses low friction so the hero slides).
  const slow = inRiver(g, h.z) ? rule.river.slow : 1;
  const mx = input.move?.x || 0, mz = input.move?.z || 0;
  const k = Math.min(1, (rule.friction || 14) * dt);
  h.vx += (mx * HERO_SPEED * slow - h.vx) * k;
  h.vz += (mz * HERO_SPEED * slow - h.vz) * k;
  h.x += h.vx * dt; h.z += h.vz * dt;
  h.x = Math.max(-g.arena.W + h.r, Math.min(g.arena.W - h.r, h.x));
  h.z = Math.max(-g.arena.D + h.r, Math.min(g.arena.D - h.r, h.z));
  pushOutOfSolids(g, h);
  h.moving = Math.hypot(h.vx, h.vz);
  if (h.moving > 0.3) h.facing = Math.atan2(h.vx, h.vz);

  // Fire.
  if (input.fire && p.state === 'held') {
    g.projectile = launch(g.weapon.id, h, input.fire);
    g.shotMult = g.pendingMult;
    g.pendingMult = 1;
    h.facing = Math.atan2(input.fire.x - h.x, input.fire.z - h.z);
    emit(g, 'shoot', { x: h.x, z: h.z, mult: g.shotMult });
  }
  const proj = g.projectile;
  if (proj.state === 'held') { proj.x = h.x; proj.z = h.z; }

  const world = { arena: g.arena, solids: g.solids, enemies: g.enemies, hero: h, rule };
  stepProjectile(proj, dt, world);
  for (const ev of proj.events) emit(g, ev, { x: proj.x, z: proj.z });
  proj.events.length = 0;

  // Projectile vs enemies.
  if (proj.state === 'flying') {
    for (const e of g.enemies) {
      if (e.dead || proj.hits.has(e.id)) continue;
      if (Math.hypot(e.x - proj.x, e.z - proj.z) < e.r + PROJECTILE_R) {
        damage(g, e, proj);
        onEnemyHit(proj, e, world);
      }
    }
  }
  if (proj.explosion) {
    const ex = proj.explosion;
    proj.explosion = null;
    for (const e of g.enemies) {
      if (!e.dead && Math.hypot(e.x - ex.x, e.z - ex.z) < ex.r + e.r) { e.hp = 1; damage(g, e, proj); }
    }
  }

  // Catch in flight (×2 next shot) or pick up from the floor.
  const dHero = Math.hypot(proj.x - h.x, proj.z - h.z);
  if (proj.state === 'flying' && g.weapon.catchable && proj.t > 0.25 && dHero < 0.75) {
    proj.state = 'held';
    g.pendingMult = 2;
    emit(g, 'catch', { x: h.x, z: h.z });
  } else if (proj.state === 'dropped' && dHero < 0.85) {
    proj.state = 'held';
    emit(g, 'pickup', { x: h.x, z: h.z });
  }

  // Waves.
  if (g.queue.length === 0 && g.enemies.every((e) => e.dead)) {
    if (g.wave > 0 && g.breakT === 0) {
      g.score += 50 * g.wave;
      emit(g, 'waveClear', { wave: g.wave, bonus: 50 * g.wave });
      g.breakT = WAVE_BREAK;
    }
    g.breakT = Math.max(0, g.breakT - dt);
    if (g.breakT === 0) { startWave(g); g.breakT = 0; }
  } else {
    g.waveT += dt;
    while (g.queue.length && g.queue[0].at <= g.waveT) {
      const s = g.queue.shift();
      const pos = spawnPos(g, s);
      addEnemy(g, s.type, pos.x, pos.z, s.model);
    }
  }

  // Enemies chase the hero.
  const pull = proj.pull;
  for (const e of g.enemies) {
    if (e.dead) continue;
    e.hurtT = Math.max(0, e.hurtT - dt);
    const dx = h.x - e.x, dz = h.z - e.z, d = Math.hypot(dx, dz) || 1;
    const sp = e.speed * (!e.flying && inRiver(g, e.z) ? rule.river.slow : 1);
    e.x += (dx / d) * sp * dt; e.z += (dz / d) * sp * dt;
    e.facing = Math.atan2(dx, dz);
    if (pull) {
      const px = pull.x - e.x, pz = pull.z - e.z, pd = Math.hypot(px, pz);
      if (pd < pull.r && pd > 0.05) {
        const f = pull.strength * (1 - pd / pull.r) * dt;
        e.x += (px / pd) * f; e.z += (pz / pd) * f;
      }
    }
    if (!e.flying) pushOutOfSolids(g, e);
    if (d < e.r + h.r - 0.08) {
      g.over = true;
      emit(g, 'death', { x: h.x, z: h.z });
      return;
    }
  }
  // Light separation so crowds don't stack into one point.
  const alive = g.enemies.filter((e) => !e.dead);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.r + b.r;
      if (d < min && d > 1e-6) {
        const push = (min - d) / 2;
        a.x -= (dx / d) * push; a.z -= (dz / d) * push;
        b.x += (dx / d) * push; b.z += (dz / d) * push;
      }
    }
  }
  if (g.enemies.length > 80) g.enemies = alive;
}

export function result(g) {
  return { score: g.score, combo: g.bestCombo, wave: g.wave, location: g.loc.id, weapon: g.weapon.id };
}
