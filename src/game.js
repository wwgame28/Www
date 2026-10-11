import { ARENA, getLocation, layoutFor } from './locations.js';
import { getWeapon, launch, stepProjectile, onEnemyHit, PROJECTILE_R } from './weapons.js';
import { ENEMY_TYPES, planWave, speedFactor } from './waves.js';
import { blankMods, offerPerks, applyPerk } from './perks.js';

const HERO_SPEED = 5.2;
const HERO_R = 0.4;
const WAVE_BREAK = 1.6;
const PICKUP_R = 1.1;  // hand reach for a dropped projectile (× long-reach perk)
const VACUUM_R = 1.8;  // inside this the projectile flies to the hand by itself

export function createGame({ seed, locationId, weaponId, heroId = null }) {
  const loc = getLocation(locationId);
  const { solids, decor } = layoutFor(loc);
  const g = {
    seed, loc, weapon: getWeapon(weaponId), heroId, solids, decor, arena: ARENA,
    hero: { x: 0, z: 3, vx: 0, vz: 0, r: HERO_R, facing: Math.PI, moving: 0 },
    projectile: { state: 'held', x: 0, z: 3, vx: 0, vz: 0, hits: new Set(), events: [] },
    enemies: [], nextId: 1,
    wave: 0, waveT: 0, queue: [], breakT: 0.6,
    score: 0, bestCombo: 0, shotMult: 1, pendingMult: 1,
    mods: blankMods(), choosing: null, // perk ids offered after a cleared wave; the game waits for a pick
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

// Walkers rise out of the ground just inside the walls; flyers come in from outside.
const RISE_TIME = 0.9;
function spawnPos(g, s, flying) {
  const { W, D } = g.arena;
  const k = flying ? 0.6 : -0.9;
  switch (s.side) {
    case 'left': return { x: -W - k, z: s.along * D };
    case 'right': return { x: W + k, z: s.along * D };
    case 'bottom': return { x: s.along * W, z: D + k };
    default: return { x: s.along * W, z: -D - k };
  }
}

function addEnemy(g, type, x, z, model) {
  const def = ENEMY_TYPES[type];
  const e = {
    id: g.nextId++, type, model: model || def.model[0], x, z, r: def.r, hp: def.hp,
    speed: def.speed * speedFactor(g.wave), flying: !!def.flying, dead: false, facing: 0, hurtT: 0, rise: 0,
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
  emit(g, 'kill', { x: e.x, z: e.z, points, combo: p.kills, id: e.id, vx: p.vx, vz: p.vz, px: p.x, pz: p.z }); // render throws the body along the hit
  if (e.type === 'splitter') {
    for (const side of [-1, 1]) {
      const child = addEnemy(g, 'runner', e.x + side * 0.5, e.z, ENEMY_TYPES.runner.model[0]);
      child.split = true; // render pops it in (it doesn't rise from the ground)
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
  if (g.over || g.choosing) return;
  g.time += dt;
  const rule = g.loc.rule;
  const h = g.hero, p = g.projectile;

  // Hero movement (ice uses low friction so the hero slides).
  const slow = (inRiver(g, h.z) ? rule.river.slow : 1) * (1 + 0.12 * g.mods.speed);
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
    g.projectile = launch(g.weapon.id, h, input.fire, g.mods);
    g.shotMult = g.pendingMult;
    g.pendingMult = 1;
    h.facing = Math.atan2(input.fire.x - h.x, input.fire.z - h.z);
    emit(g, 'shoot', { x: h.x, z: h.z, mult: g.shotMult, tx: input.fire.x, tz: input.fire.z });
  }
  const proj = g.projectile;
  if (proj.state === 'held') { proj.x = h.x; proj.z = h.z; }

  const world = { arena: g.arena, solids: g.solids, enemies: g.enemies, hero: h, rule };
  const wasFlying = proj.state === 'flying';
  stepProjectile(proj, dt, world);
  for (const ev of proj.events) emit(g, ev, { x: proj.x, z: proj.z });
  proj.events.length = 0;

  // Projectile vs enemies.
  if (proj.state === 'flying') {
    for (const e of g.enemies) {
      if (e.dead || proj.hits.has(e.id)) continue;
      if (Math.hypot(e.x - proj.x, e.z - proj.z) < e.r + (proj.r || PROJECTILE_R)) {
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

  if (wasFlying && proj.state === 'dropped') emit(g, 'drop', { x: proj.x, z: proj.z });

  // Getting the projectile back: within 1.8 m it hops into the hand on its own (8 m/s); the magnet
  // perk reaches further and crawls it in.
  const dHero = Math.hypot(proj.x - h.x, proj.z - h.z);
  if (proj.state === 'dropped' && dHero > 1e-3) {
    const speed = dHero < VACUUM_R ? 8 : g.mods.magnet && dHero < 2.5 + 2 * g.mods.magnet ? 2 + 1.5 * g.mods.magnet : 0;
    if (speed) {
      const k = Math.min(1, (speed * dt) / dHero);
      proj.x += (h.x - proj.x) * k; proj.z += (h.z - proj.z) * k;
    }
  }
  // Catch in flight (×2 next shot) or pick up from the floor.
  const reach = 1 + 0.5 * g.mods.reach;
  if (proj.state === 'flying' && g.weapon.catchable && proj.t > 0.25 && dHero < 0.75 * reach) {
    proj.state = 'held';
    g.pendingMult = 2;
    emit(g, 'catch', { x: h.x, z: h.z });
  } else if (proj.state === 'dropped' && Math.hypot(proj.x - h.x, proj.z - h.z) < PICKUP_R * reach) {
    proj.state = 'held';
    emit(g, 'pickup', { x: h.x, z: h.z });
  }

  // Waves.
  if (g.queue.length === 0 && g.enemies.every((e) => e.dead)) {
    if (g.wave > 0 && g.breakT === 0) {
      g.score += 50 * g.wave;
      emit(g, 'waveClear', { wave: g.wave, bonus: 50 * g.wave });
      g.breakT = WAVE_BREAK;
      const offer = offerPerks(g.seed, g.wave, g.mods, g.weapon.id);
      if (offer.length) { g.choosing = offer; emit(g, 'perkChoice', { options: offer }); return; }
    }
    g.breakT = Math.max(0, g.breakT - dt);
    if (g.breakT === 0) { startWave(g); g.breakT = 0; }
  } else {
    g.waveT += dt;
    while (g.queue.length && g.queue[0].at <= g.waveT) {
      const s = g.queue.shift();
      const flying = !!ENEMY_TYPES[s.type].flying;
      let pos = spawnPos(g, s, flying);
      // Never rise right next to the hero: mirror along the wall instead (still deterministic).
      if (Math.hypot(pos.x - h.x, pos.z - h.z) < 3.5) pos = spawnPos(g, { ...s, along: -s.along }, flying);
      const e = addEnemy(g, s.type, pos.x, pos.z, s.model);
      if (!flying) e.rise = RISE_TIME; // harmless and still while climbing out of the ground
      emit(g, 'spawn', { x: e.x, z: e.z, id: e.id, flying, rise: e.rise });
    }
  }

  // Enemies chase the hero.
  const pull = proj.pull;
  for (const e of g.enemies) {
    if (e.dead) continue;
    e.hurtT = Math.max(0, e.hurtT - dt);
    const dx = h.x - e.x, dz = h.z - e.z, d = Math.hypot(dx, dz) || 1;
    if (e.rise > 0) { e.rise = Math.max(0, e.rise - dt); e.facing = Math.atan2(dx, dz); continue; }
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
      if (g.mods.shield > 0) { // the shield takes the hit and destroys the attacker
        g.mods.shield--;
        e.dead = true;
        emit(g, 'shield', { x: e.x, z: e.z, id: e.id, left: g.mods.shield });
        continue;
      }
      g.over = true;
      g.killer = e.id;
      emit(g, 'death', { x: h.x, z: h.z, by: e.id });
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

export function choosePerk(g, id) {
  if (!g.choosing?.includes(id)) return false;
  applyPerk(g.mods, id);
  g.choosing = null;
  emit(g, 'perk', { id, level: g.mods[id] });
  return true;
}

export function result(g) {
  return { score: g.score, combo: g.bestCombo, wave: g.wave, location: g.loc.id, weapon: g.weapon.id, hero: g.heroId };
}
