import { ARENA, getLocation, layoutFor } from './locations.js';
import { getWeapon, launch, stepProjectile, onEnemyHit, recall, PROJECTILE_R } from './weapons.js';
import { createRng } from './rng.js';
import { ENEMY_TYPES, planWave, speedFactor } from './waves.js';
import { blankMods, offerPerks, applyPerk } from './perks.js';
import { solidContact } from './solid.js';

const HERO_SPEED = 5.2;
const HERO_R = 0.4;
const WAVE_BREAK = 1.6;
const RECALL_COOLDOWN = 6; // seconds between two recalls (↩)
const ZONE_R = 2;          // golden zone radius; kills inside it score ×3
const FAR_SHOT = 12;       // a kill this far from the hero is a long throw
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
    zone: null, recallT: 0, // golden zone { x, z, r } (moves every wave); recall cooldown
    score: 0, bestCombo: 0, shotMult: 1, pendingMult: 1,
    mods: blankMods(), choosing: null, // perk ids offered after a cleared wave; the game waits for a pick
    time: 0, over: false, events: [],
  };
  return g;
}

const emit = (g, type, data = {}) => g.events.push({ type, ...data });

// The golden zone moves to a new free spot every wave (deterministic from the seed and the wave).
function placeZone(g) {
  const rng = createRng(`${g.seed}:zone:${g.wave}`);
  const { W, D } = g.arena;
  for (let i = 0; i < 60; i++) {
    const x = rng.range(-W + ZONE_R + 0.5, W - ZONE_R - 0.5), z = rng.range(-D + ZONE_R + 1, D - ZONE_R - 1);
    if (Math.hypot(x - g.hero.x, z - g.hero.z) < 3.5) continue; // not right under the hero
    if (g.solids.some((o) => solidContact(o, x, z, 0.8))) continue;
    g.zone = { x, z, r: ZONE_R };
    return;
  }
  g.zone = null;
}

function startWave(g) {
  g.wave++;
  g.waveT = 0;
  g.queue = planWave(g.seed, g.wave);
  placeZone(g);
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
    const c = solidContact(o, b.x, b.z, b.r);
    if (c) { b.x += c.nx * c.pen; b.z += c.nz * c.pen; }
  }
}

// Walkers chase in a straight line, so a solid between them and the hero could hold them on its far
// side forever (a wall's middle, a box face, dead center behind a pillar). A walker pressing into a
// solid walks round it: the side is picked once on contact (the end with the shorter way to the hero)
// and kept while it presses, so it never flip-flops. Deterministic: positions only.
export function slideAroundSolids(g, e, h, step) {
  let o = null, c = null;
  for (const s of g.solids) { c = solidContact(s, e.x, e.z, e.r + 0.02); if (c) { o = s; break; } }
  const dx = h.x - e.x, dz = h.z - e.z, d = Math.hypot(dx, dz) || 1;
  if (!o || (dx * c.nx + dz * c.nz) / d > -0.2) { e.slide = 0; return; }
  const tx = -c.nz, tz = c.nx; // tangent: round the solid counter-clockwise
  if (!o.hx && !o.hz && Math.abs(dx * tx + dz * tz) / d > 0.05) { e.slide = 0; return; } // round pillars: the chase slides off by itself unless dead center
  if (!e.slide || e.slideOn !== o) {
    e.slideOn = o;
    let s = dx * tx + dz * tz >= 0 ? 1 : -1;
    if (o.hx || o.hz) {
      const cs = Math.cos(o.rot || 0), sn = Math.sin(o.rot || 0), hx = o.hx || 0, hz = o.hz || 0;
      const useX = Math.max(hx, hz) > 1.5 * Math.min(hx, hz) + 0.2 ? hx >= hz : Math.abs(tx * cs - tz * sn) >= Math.abs(tx * sn + tz * cs);
      const ux = useX ? cs : sn, uz = useX ? -sn : cs, ext = (useX ? hx : hz) + o.r + e.r + 0.05;
      let best = Infinity;
      for (const k of [1, -1]) {
        const px = o.x + ux * ext * k, pz = o.z + uz * ext * k;
        const len = Math.hypot(px - e.x, pz - e.z) + Math.hypot(h.x - px, h.z - pz) + (Math.abs(px) > g.arena.W || Math.abs(pz) > g.arena.D ? 50 : 0);
        const side = (px - e.x) * tx + (pz - e.z) * tz;
        if (len < best && Math.abs(side) > 1e-3) { best = len; s = side > 0 ? 1 : -1; }
      }
    }
    e.slide = s;
  }
  e.x += tx * e.slide * step; e.z += tz * e.slide * step;
}

// Never rise inside a solid: slide the spawn point along its wall until it is 0.2 m clear.
function clearSpot(g, pos, r, alongX) {
  for (let k = 0; k <= 40; k++) {
    const off = 0.15 * Math.ceil(k / 2) * (k % 2 ? 1 : -1);
    const x = pos.x + (alongX ? off : 0), z = pos.z + (alongX ? 0 : off);
    if (!g.solids.some((o) => solidContact(o, x, z, r + 0.2))) return { x, z };
  }
  return pos;
}

function killEnemy(g, e, p) {
  e.dead = true;
  p.kills = (p.kills || 0) + 1;
  // Trick shots: after bounces, through a portal, from far away, inside the golden zone.
  const tricks = [];
  let bonus = 0, mult = g.shotMult;
  const banks = Math.min(3, p.banks || 0);
  if (banks) { tricks.push(banks > 1 ? `Рикошет ×${banks}` : 'Рикошет'); bonus += 10 * banks; }
  if (p.portal) { tricks.push('Через портал'); bonus += 30; }
  if (Math.hypot(e.x - g.hero.x, e.z - g.hero.z) >= FAR_SHOT) { tricks.push('Дальний бросок'); bonus += 20; }
  if (g.zone && Math.hypot(e.x - g.zone.x, e.z - g.zone.z) < g.zone.r) { tricks.push('Золото ×3'); mult *= 3; }
  const points = (10 * p.kills + bonus) * mult;
  g.score += points;
  g.bestCombo = Math.max(g.bestCombo, p.kills);
  emit(g, 'kill', { x: e.x, z: e.z, points, combo: p.kills, id: e.id, vx: p.vx, vz: p.vz, px: p.x, pz: p.z, tricks }); // render throws the body along the hit
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

// input: { move: {x, z} with length 0..1, fire: {x, z} | null, recall: bool (the ↩ button) }
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

  // Recall (↩): a dropped projectile flies back to the hand.
  g.recallT = Math.max(0, g.recallT - dt);
  if (input.recall && proj.state === 'dropped' && g.recallT === 0) {
    recall(proj);
    g.recallT = RECALL_COOLDOWN;
    emit(g, 'recall', { x: proj.x, z: proj.z });
  }

  const world = { arena: g.arena, solids: g.solids, enemies: g.enemies, hero: h, rule };
  const wasFlying = proj.state === 'flying';
  stepProjectile(proj, dt, world);
  for (const ev of proj.events) {
    if (ev === 'bounce') proj.banks = (proj.banks || 0) + 1; // for the trick-shot bonus
    emit(g, ev, { x: proj.x, z: proj.z });
  }
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
  if (proj.state === 'flying' && proj.weapon !== 'recall' && g.weapon.catchable && proj.t > 0.25 && dHero < 0.75 * reach) {
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
      if (!flying) pos = clearSpot(g, pos, ENEMY_TYPES[s.type].r, s.side === 'top' || s.side === 'bottom');
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
    if (!e.flying) {
      pushOutOfSolids(g, e);
      slideAroundSolids(g, e, h, sp * dt);
      e.x = Math.max(-g.arena.W + e.r, Math.min(g.arena.W - e.r, e.x)); // a push never takes a walker through the wall
      e.z = Math.max(-g.arena.D + e.r, Math.min(g.arena.D - e.r, e.z));
    }
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
