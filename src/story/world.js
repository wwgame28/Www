// The open world of «Приключение»: one zone of the island at a time. The state has the arcade's shape
// (hero, projectile, enemies, solids, arena, loc, time, events…) so render.js draws it the same way;
// the extras are hearts, villagers, targets, the raid, the shard and the gates. Deterministic.
import { getWeapon, launch, stepProjectile, onEnemyHit, recall, PROJECTILE_R } from '../weapons.js';
import { solidContact } from '../solid.js';
import { solidFrom } from '../locations.js';
import { ENEMY_TYPES } from '../waves.js';
import { blankMods } from '../perks.js';
import { slideAroundSolids } from '../game.js';
import { HEARTS, ZONES } from './data.js';
import { beginStep, completeStep, onEvent, stepOf, say } from './quests.js';

const HERO_SPEED = 5.2;
const HERO_R = 0.4;
const RECALL_COOLDOWN = 6;
const PICKUP_R = 1.1, VACUUM_R = 1.8;
export const HURT_T = 1.2;   // invulnerable after a hit (the hero blinks)
const KNOCK = 7;             // m/s: a hit throws the hero back
const STUN_T = 0.6;          // the attacker stops for a moment after a hit
export const FAINT_T = 2.2;  // lying down before waking at the campfire
export const TALK_R = 2.4;   // «Говорить» reach
const CALM_R = 7;            // no talking or resting with a raider this close
export const REST_R = 2.6;   // hearts come back around the campfire…
const REST_T = 0.6;          // …one every 0.6 s
const AGGRO_R = 9, LEASH_R = 16; // camp guards chase inside AGGRO_R and go home past LEASH_R from it
const RISE_TIME = 0.9;
const RAID_DIST = 13;        // raiders rise this far from the hero, on their entry's side
const SHARD_R = 1.2;

const emit = (g, type, data = {}) => g.events.push({ type, ...data });

// story: { chapter, step, flags, drop } from the save (kept up to date here; 'save' events say when).
export function createWorld({ zoneId = 'village', story, weaponId, heroName = 'Герой' }) {
  const area = ZONES[zoneId];
  const solids = area.props.map((e) => solidFrom(area.kit, e));
  const { x, z, facing } = area.spawn;
  const g = {
    mode: 'story', area, loc: { id: area.id, look: area.look, rule: {} }, weapon: getWeapon(weaponId), heroName,
    solids, arena: area.size,
    hero: { x, z, vx: 0, vz: 0, r: HERO_R, facing, moving: 0 },
    projectile: { state: 'held', x, z, vx: 0, vz: 0, hits: new Set(), events: [] },
    enemies: [], nextId: 1,
    zone: null, recallT: 0, mods: blankMods(), choosing: null, // arcade fields render/main read
    score: 0, pendingMult: 1, shotMult: 1,
    time: 0, over: false, events: [], killer: null,
    hearts: HEARTS, maxHearts: HEARTS, hurtT: 0, faintT: 0, restT: 0,
    villagers: area.villagers.map((v) => ({ ...v, quest: false, chat: 0 })),
    gates: area.gates.map((t) => ({ ...t, inside: false })),
    campfire: { ...area.campfire },
    targets: [], raid: null, shard: null, advanceT: -1, lastKill: null,
    near: null, talk: null, // nearest villager in reach; the open dialogue { id, name, lines, i, quest }
    story: { chapter: 0, step: 0, flags: [], drop: null, ...story, flags: [...(story?.flags || [])] },
  };
  beginStep(g);
  return g;
}

export const isOpen = (g, gate) => g.story.flags.includes(gate.flag);

function pushOutOfSolids(g, b) {
  for (const o of g.solids) {
    const c = solidContact(o, b.x, b.z, b.r);
    if (c) { b.x += c.nx * c.pen; b.z += c.nz * c.pen; }
  }
}
function pushOutOf(b, x, z, r) {
  const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz), min = r + b.r;
  if (d < min && d > 1e-6) { b.x += (dx / d) * (min - d); b.z += (dz / d) * (min - d); }
}
const clampTo = (g, b) => {
  b.x = Math.max(-g.arena.W + b.r, Math.min(g.arena.W - b.r, b.x));
  b.z = Math.max(-g.arena.D + b.r, Math.min(g.arena.D - b.r, b.z));
};
const free = (g, x, z, r) => Math.abs(x) < g.arena.W - r && Math.abs(z) < g.arena.D - r && !g.solids.some((o) => solidContact(o, x, z, r + 0.2));

// The nearest free spot to (x, z) on a spiral around it.
function freeSpot(g, x, z, r) {
  for (let i = 0; i < 120; i++) {
    const a = i * 2.4, d = 0.35 * Math.sqrt(i);
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    if (free(g, px, pz, r)) return { x: px, z: pz };
  }
  return { x, z };
}

function addEnemy(g, type, x, z, extra = {}) {
  const def = ENEMY_TYPES[type];
  const e = { id: g.nextId++, type, model: def.model[0], x, z, r: def.r, hp: def.hp, speed: def.speed, flying: !!def.flying,
    dead: false, facing: 0, hurtT: 0, rise: 0, stunT: 0, home: null, chasing: true, ...extra };
  g.enemies.push(e);
  return e;
}

// ---------- raids: waves of raiders from the zone's entries ----------
function planRaid(groups) {
  const out = [];
  groups.forEach(([type, count, entry], gi) => {
    for (let i = 0; i < count; i++) out.push({ type, entry, i, count, at: gi * 0.3 + i * 0.55 });
  });
  return out.sort((a, b) => a.at - b.at);
}

function spawnRaider(g, s) {
  const h = g.hero, [ex, ez] = g.area.entries[s.entry];
  const dx = ex - h.x, dz = ez - h.z, d = Math.hypot(dx, dz) || 1;
  const k = Math.min(d, RAID_DIST) / d, side = (s.i - (s.count - 1) / 2) * 1.4;
  const r = ENEMY_TYPES[s.type].r;
  let pos = freeSpot(g, h.x + dx * k - (dz / d) * side, h.z + dz * k + (dx / d) * side, r);
  if (Math.hypot(pos.x - h.x, pos.z - h.z) < 5) pos = freeSpot(g, ex, ez, r); // never on top of the hero
  const e = addEnemy(g, s.type, pos.x, pos.z, { rise: RISE_TIME });
  emit(g, 'spawn', { x: e.x, z: e.z, id: e.id, flying: false, rise: e.rise });
}

function stepRaid(g, dt) {
  const r = g.raid;
  if (!r || r.done) return;
  if (r.queue.length === 0 && g.enemies.every((e) => e.dead)) {
    if (r.wave >= r.waves.length) {
      r.done = true;
      emit(g, 'raidDone', { x: g.lastKill?.x ?? g.hero.x, z: g.lastKill?.z ?? g.hero.z });
      return;
    }
    r.breakT -= dt;
    if (r.breakT > 0) return;
    r.wave++; r.t = 0; r.breakT = 1.6;
    r.queue = planRaid(r.waves[r.wave - 1]);
    emit(g, 'raidWave', { wave: r.wave, of: r.waves.length });
    return;
  }
  r.t += dt;
  while (r.queue.length && r.queue[0].at <= r.t) spawnRaider(g, r.queue.shift());
}

// ---------- fights ----------
function killEnemy(g, e, p) {
  e.dead = true;
  e.deadT = 0;
  p.kills = (p.kills || 0) + 1;
  g.lastKill = { x: e.x, z: e.z };
  const tricks = [];
  const banks = Math.min(3, p.banks || 0);
  if (banks) tricks.push(banks > 1 ? `Рикошет ×${banks}` : 'Рикошет');
  emit(g, 'kill', { x: e.x, z: e.z, points: 0, combo: p.kills, id: e.id, vx: p.vx, vz: p.vz, px: p.x, pz: p.z, tricks });
  if (e.type === 'splitter') {
    for (const s of [-1, 1]) {
      const c = addEnemy(g, 'runner', e.x + s * 0.5, e.z);
      c.split = true;
      p.hits.add(c.id);
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

function hitHero(g, e, d) {
  const h = g.hero, nx = (h.x - e.x) / d, nz = (h.z - e.z) / d;
  g.hearts--;
  g.hurtT = HURT_T;
  h.vx = nx * KNOCK; h.vz = nz * KNOCK;
  e.stunT = STUN_T;
  e.x -= nx * 0.4; e.z -= nz * 0.4;
  emit(g, 'hit', { x: h.x, z: h.z, hearts: g.hearts, by: e.id });
  if (g.hearts <= 0) {
    g.over = true; g.killer = e.id; g.faintT = FAINT_T; g.talk = null;
    emit(g, 'faint', { x: h.x, z: h.z });
  }
}

// After fainting: wake at the campfire with full hearts; a raid starts over, raiders vanish.
function wake(g) {
  const h = g.hero, p = freeSpot(g, g.campfire.x, g.campfire.z + 1.8, h.r);
  g.over = false; g.killer = null;
  Object.assign(h, { x: p.x, z: p.z, vx: 0, vz: 0, moving: 0, facing: Math.PI });
  g.hearts = g.maxHearts; g.hurtT = HURT_T;
  g.projectile = { state: 'held', x: h.x, z: h.z, vx: 0, vz: 0, hits: new Set(), events: [] };
  for (const e of g.enemies) if (!e.dead) { e.dead = true; e.vanish = true; e.deadT = 0; }
  if (stepOf(g.story)?.type === 'defend') beginStep(g);
  emit(g, 'wake', { x: h.x, z: h.z });
}

// ---------- talking ----------
export function talkTo(g, id) {
  const v = g.villagers.find((x) => x.id === id);
  if (!v || g.talk || g.over) return false;
  const st = stepOf(g.story);
  const quest = v.quest && st?.type === 'talk' && st.npc === v.id;
  const lines = quest ? st.lines : [v.chatter[v.chat++ % v.chatter.length]];
  g.talk = { id: v.id, name: v.name, lines: lines.map((l) => say(g, l)), i: 0, quest };
  emit(g, 'talk', { id: v.id, quest });
  return true;
}

// The next line of the open dialogue; closing it after the last line. Returns whether it is still open.
export function nextLine(g) {
  const t = g.talk;
  if (!t) return false;
  if (++t.i < t.lines.length) return true;
  g.talk = null;
  const ev = { type: 'talkEnd', id: t.id, quest: t.quest };
  g.events.push(ev);
  onEvent(g, ev);
  return false;
}

// ---------- the step ----------
// input: { move: {x, z}, fire: {x, z} | null, recall: bool, talk: bool (the «Говорить» button) }
export function stepWorld(g, dt, input = {}) {
  const from = g.events.length;
  g.time += dt;
  if (g.over) {
    g.faintT -= dt;
    if (g.faintT <= 0) wake(g);
    return;
  }
  const h = g.hero, talking = !!g.talk;
  g.hurtT = Math.max(0, g.hurtT - dt);

  // Movement (no running while a dialogue is open).
  const mx = talking ? 0 : input.move?.x || 0, mz = talking ? 0 : input.move?.z || 0;
  const k = Math.min(1, 14 * dt);
  h.vx += (mx * HERO_SPEED - h.vx) * k;
  h.vz += (mz * HERO_SPEED - h.vz) * k;
  h.x += h.vx * dt; h.z += h.vz * dt;
  clampTo(g, h);
  pushOutOfSolids(g, h);
  for (const v of g.villagers) pushOutOf(h, v.x, v.z, 0.4);
  for (const t of g.targets) if (!t.hit) pushOutOf(h, t.x, t.z, 0.35);
  h.moving = Math.hypot(h.vx, h.vz);
  if (h.moving > 0.3) h.facing = Math.atan2(h.vx, h.vz);

  // Throw and recall (as in the arcade).
  if (!talking && input.fire && g.projectile.state === 'held') {
    g.projectile = launch(g.weapon.id, h, input.fire, g.mods);
    h.facing = Math.atan2(input.fire.x - h.x, input.fire.z - h.z);
    emit(g, 'shoot', { x: h.x, z: h.z, mult: 1, tx: input.fire.x, tz: input.fire.z });
  }
  const p = g.projectile;
  if (p.state === 'held') { p.x = h.x; p.z = h.z; }
  g.recallT = Math.max(0, g.recallT - dt);
  if (input.recall && p.state === 'dropped' && g.recallT === 0) {
    recall(p);
    g.recallT = RECALL_COOLDOWN;
    emit(g, 'recall', { x: p.x, z: p.z });
  }
  const world = { arena: g.arena, solids: g.solids, enemies: g.enemies, hero: h, rule: g.loc.rule };
  const wasFlying = p.state === 'flying';
  stepProjectile(p, dt, world);
  for (const ev of p.events) {
    if (ev === 'bounce') p.banks = (p.banks || 0) + 1;
    emit(g, ev, { x: p.x, z: p.z });
  }
  p.events.length = 0;
  if (p.state === 'flying') {
    const pr = p.r || PROJECTILE_R;
    for (const e of g.enemies) {
      if (e.dead || p.hits.has(e.id) || Math.hypot(e.x - p.x, e.z - p.z) >= e.r + pr) continue;
      damage(g, e, p);
      onEnemyHit(p, e, world);
    }
    for (const t of g.targets) {
      if (t.hit || Math.hypot(t.x - p.x, t.z - p.z) >= t.r + pr) continue;
      t.hit = true;
      emit(g, 'target', { x: t.x, z: t.z, id: t.id, left: g.targets.filter((x) => !x.hit).length, vx: p.vx, vz: p.vz });
    }
  }
  if (p.explosion) {
    const ex = p.explosion;
    p.explosion = null;
    for (const e of g.enemies) if (!e.dead && Math.hypot(e.x - ex.x, e.z - ex.z) < ex.r + e.r) { e.hp = 1; damage(g, e, p); }
    for (const t of g.targets) {
      if (t.hit || Math.hypot(t.x - ex.x, t.z - ex.z) >= ex.r + t.r) continue;
      t.hit = true;
      emit(g, 'target', { x: t.x, z: t.z, id: t.id, left: g.targets.filter((x) => !x.hit).length, vx: 0, vz: 0 });
    }
  }
  if (wasFlying && p.state === 'dropped') emit(g, 'drop', { x: p.x, z: p.z });
  const dHero = Math.hypot(p.x - h.x, p.z - h.z);
  if (p.state === 'dropped' && dHero > 1e-3 && dHero < VACUUM_R) {
    const s = Math.min(1, (8 * dt) / dHero);
    p.x += (h.x - p.x) * s; p.z += (h.z - p.z) * s;
  }
  if (p.state === 'flying' && p.weapon !== 'recall' && g.weapon.catchable && p.t > 0.25 && dHero < 0.75) {
    p.state = 'held';
    emit(g, 'catch', { x: h.x, z: h.z });
  } else if (p.state === 'dropped' && Math.hypot(p.x - h.x, p.z - h.z) < PICKUP_R) {
    p.state = 'held';
    emit(g, 'pickup', { x: h.x, z: h.z });
  }
  for (const t of g.targets) if (t.hit) t.t += dt; // render: how long it has been falling

  stepRaid(g, dt);

  // Enemies: raiders chase; camp guards chase inside their aggro radius and walk home past the leash.
  let threat = false;
  for (const e of g.enemies) {
    if (e.dead) { e.deadT = (e.deadT || 0) + dt; continue; }
    e.hurtT = Math.max(0, e.hurtT - dt);
    const dx = h.x - e.x, dz = h.z - e.z, d = Math.hypot(dx, dz) || 1;
    if (e.rise > 0) { e.rise = Math.max(0, e.rise - dt); e.facing = Math.atan2(dx, dz); threat = true; continue; }
    if (e.home) {
      const fromHome = Math.hypot(e.x - e.home.x, e.z - e.home.z);
      if (!e.chasing && d < AGGRO_R) e.chasing = true;
      else if (e.chasing && (fromHome > LEASH_R || d > LEASH_R)) e.chasing = false;
    }
    if (e.chasing && d < CALM_R) threat = true;
    if (e.stunT > 0) { e.stunT = Math.max(0, e.stunT - dt); continue; }
    const goal = e.chasing ? h : e.home;
    const tx = goal.x - e.x, tz = goal.z - e.z, td = Math.hypot(tx, tz);
    if (td > 0.15) {
      e.x += (tx / td) * e.speed * dt; e.z += (tz / td) * e.speed * dt;
      e.facing = Math.atan2(tx, tz);
    }
    if (!e.flying) {
      pushOutOfSolids(g, e);
      if (td > 0.15) slideAroundSolids(g, e, goal, e.speed * dt); // walk round a house instead of pressing into it
      clampTo(g, e);
    }
    if (e.chasing && g.hurtT === 0 && !talking && d < e.r + h.r - 0.08) {
      hitHero(g, e, d);
      if (g.over) break;
    }
  }
  const alive = g.enemies.filter((e) => !e.dead);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.r + b.r;
      if (d < min && d > 1e-6) {
        const s = (min - d) / 2;
        a.x -= (dx / d) * s; a.z -= (dz / d) * s; b.x += (dx / d) * s; b.z += (dz / d) * s;
      }
    }
  }
  g.enemies = g.enemies.filter((e) => !e.dead || e.deadT < 1.5); // render has seen them fall by then

  if (!g.over) {
    // The shard: walk over it.
    if (g.shard && Math.hypot(g.shard.x - h.x, g.shard.z - h.z) < SHARD_R) {
      emit(g, 'shard', { x: g.shard.x, z: g.shard.z });
      g.shard = null;
    }
    // The campfire gives hearts back while nobody is chasing.
    const resting = !threat && g.hearts < g.maxHearts && Math.hypot(g.campfire.x - h.x, g.campfire.z - h.z) < REST_R;
    g.restT = resting ? g.restT + dt : 0;
    if (g.restT >= REST_T) { g.restT = 0; g.hearts++; emit(g, 'heal', { x: h.x, z: h.z, hearts: g.hearts }); }
    // Who is in reach for «Говорить» (and turns to the hero).
    g.near = null;
    if (!threat && !talking) {
      let best = TALK_R;
      for (const v of g.villagers) {
        const d = Math.hypot(v.x - h.x, v.z - h.z);
        if (d < best) { best = d; g.near = v.id; }
      }
    }
    for (const v of g.villagers) {
      const d = Math.hypot(v.x - h.x, v.z - h.z);
      v.look = d < 4 || g.talk?.id === v.id ? Math.atan2(h.x - v.x, h.z - v.z) : null;
    }
    if (input.talk && g.near) talkTo(g, g.near);
    // Gates: an open one lets the hero through; a closed one says so once per visit.
    for (const t of g.gates) {
      const inside = Math.hypot(h.x - t.x, h.z - t.z) < t.w / 2 + 0.4;
      if (inside && !t.inside) emit(g, isOpen(g, t) ? 'gate' : 'gateClosed', { id: t.id, to: t.to });
      t.inside = inside;
    }
  }

  // Quest progress from this step's events.
  for (let i = from; i < g.events.length; i++) onEvent(g, g.events[i]);
  if (g.advanceT > 0 && (g.advanceT -= dt) <= 0) completeStep(g);
}
