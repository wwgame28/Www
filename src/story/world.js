// The open world of «Приключение»: one zone of the island at a time. The state has the arcade's shape
// (hero, projectile, enemies, solids, arena, loc, time, events…) so render.js draws it the same way;
// the extras are hearts, villagers and the queen, the quest objects (targets, raid, camps, items,
// object to protect, boss), hazards (areas, climate, rockfall), enemy shots and the gates.
// Deterministic: random choices come from a seeded rng.
import { getWeapon, launch, stepProjectile, onEnemyHit, recall, drop, PROJECTILE_R } from '../weapons.js';
import { solidContact } from '../solid.js';
import { solidFrom } from '../locations.js';
import { ENEMY_TYPES } from '../waves.js';
import { blankMods } from '../perks.js';
import { slideAroundSolids } from '../game.js';
import { createRng } from '../rng.js';
import { ZONES } from './zones/index.js';
import { beginStep, completeStep, onEvent, stepOf, lineOf, say, meets, maxHearts } from './quests.js';
import { forgeMods, forgeHearts, BOOTS_STEP } from './forge.js';
import { ground, drift, portalJump, stepClimate, stepRockfall, inArea, gust } from './hazards.js';
import { foeStep, makeBoss, bossBlocks, turnTo } from './foes.js';
import { SCROLLS, SCROLL_REWARD } from './chronicle.js';

const HERO_SPEED = 5.2;
const HERO_R = 0.4;
const RECALL_COOLDOWN = 4, STAR_RECALL = 1.3;
// The open world has no walls nearby to bounce the weapon back: past this distance from where it was
// thrown it falls down, so it never lands on the other side of the zone.
export const MAX_RANGE = 14;
const PICKUP_R = 1.1, VACUUM_R = 1.8;
export const HURT_T = 1.2;   // invulnerable after a hit (the hero blinks)
const KNOCK = 7;             // m/s: a hit throws the hero back
const STUN_T = 0.6;          // the attacker stops for a moment after a hit
export const FAINT_T = 2.2;  // lying down before waking at the campfire
export const TALK_R = 2.4;   // «Говорить» reach
const CALM_R = 7;            // no talking or resting with an enemy this close
export const REST_R = 2.6;   // hearts come back around the campfire…
const REST_T = 0.6;          // …one every 0.6 s
const AGGRO_R = 9, LEASH_R = 16; // camp guards chase inside AGGRO_R and go home past LEASH_R from it
const RISE_TIME = 0.9;
const RAID_DIST = 13;        // raiders rise this far from the hero, on their entry's side
const ITEM_R = 1.2;
export const DASH = { speed: 14, time: 0.26, cooldown: 2.2 };
const BLOOM = { calm: 4, every: 6 };  // «Цветение»: a heart every 6 s after 4 s without enemies near
const FROST_T = 2;                    // «Иней»: frozen seconds after a hit (bosses a third of it)
const LIGHT_WARM = 3.6;               // a lit lantern or brazier warms this far
const OBJECT_HIT_EVERY = 1.2;

const emit = (g, type, data = {}) => g.events.push({ type, ...data });

// story: the save's story ({ zone, flags, gems, blessings, lines, done, drop }), kept up to date here
// ('save' events say when to store it). arrive: where the hero enters ({ x, z, facing }), else the
// zone's spawn.
export function createWorld({ zoneId = 'village', story, weaponId, heroName = 'Герой', arrive = null }) {
  const area = ZONES[zoneId] || ZONES.village;
  const s = { flags: [], gems: [], blessings: [], lines: {}, done: [], drop: null, ...story };
  s.flags = [...s.flags]; s.gems = [...s.gems]; s.blessings = [...s.blessings]; s.lines = { ...s.lines }; s.done = [...s.done]; s.scrolls = [...(s.scrolls || [])];
  s.zone = area.id;
  const has = (b) => s.blessings.includes(b);
  const solids = zoneProps(area, s).map((e) => solidOf(area, e));
  for (const w of area.walls || []) solids.push(...wallSolids(w));
  if (area.queen) { // her throne, just behind her
    const q = area.queen;
    solids.push({ x: q.x - Math.sin(q.facing) * 1.0, z: q.z - Math.cos(q.facing) * 1.0, rot: q.facing, hx: 0.55, hz: 0.25, r: 0.2, h: 2.5 });
  }
  const { x, z, facing } = arrive || area.spawn;
  const mods = blankMods();
  if (has('wave')) { mods.bounce += 1; mods.shotSpeed += 1; }
  for (const [k, n] of Object.entries(forgeMods(s))) mods[k] += n; // Кузница Грома
  const g = {
    mode: 'story', area, loc: { id: area.id, look: area.look, rule: {} }, weapon: getWeapon(weaponId), heroName,
    solids, arena: area.size, areas: (area.areas || []).filter((a) => !a.until || !s.done.includes(a.until)).map((a) => ({ ...a })), rng: createRng(`story:${area.id}`),
    rockfall: area.rockfall && !(area.rockfall.until && s.done.includes(area.rockfall.until)) ? area.rockfall : null,
    hero: { x, z, vx: 0, vz: 0, r: HERO_R, facing, moving: 0 },
    projectile: { state: 'held', x, z, vx: 0, vz: 0, hits: new Set(), events: [] },
    enemies: [], nextId: 1, shots: [], nextShot: 1, rocks: [], rockT: 3,
    zone: null, recallT: 0, mods, choosing: null, // arcade fields render/main read
    score: 0, pendingMult: 1, shotMult: 1,
    time: 0, over: false, events: [], killer: null,
    hearts: maxHearts(s), maxHearts: maxHearts(s), hurtT: 0, faintT: 0, restT: 0, calmT: 0, regenT: 0, slowT: 0,
    temp: 0, climateT: 0,
    dashT: 0, dashCd: 0, dashing: false, dashDir: null,
    villagers: [...area.villagers, ...(area.queen ? [{ ...area.queen, id: 'queen', isQueen: true }] : []), ...(s.done.includes('king') ? area.feast || [] : [])]
      .map((v) => ({ ...v, quest: false, chat: 0 })),
    queenState: 'awake',
    gates: area.gates.map((t) => ({ ...t, inside: Math.hypot(x - t.x, z - t.z) < t.w / 2 + 0.4 })), // arriving inside a gate doesn't use it
    campfire: { ...area.campfire },
    targets: [], raid: null, items: [], camps: [], object: null, reach: null, advanceT: -1, lastKill: null, setup: null,
    lights: [], // lit lanterns and braziers: { x, z, warm }
    scrolls: SCROLLS.filter((p) => p.unlock.scroll.zone === area.id).map((p) => ({ id: p.id, x: p.unlock.scroll.x, z: p.unlock.scroll.z, taken: s.scrolls.includes(p.id) })),
    stepT: 0, // seconds left of a timed step (0: no timer)
    near: null, talk: null, // nearest villager in reach; the open dialogue { id, name, lines, i, quest, portrait, crest }
    story: s, glow: has('sun'), blessed: has,
  };
  // Helpers foes.js needs (bound to this world).
  g.freeSpot = (px, pz, r) => freeSpot(g, px, pz, r);
  g.addEnemy = (type, px, pz, extra) => addEnemy(g, type, px, pz, extra);
  g.hurt = (e, d, why) => hitHero(g, e, d, why);
  g.blocked = (e) => g.solids.some((o) => !o.chasm && solidContact(o, e.x, e.z, e.r));
  beginStep(g);
  return g;
}

// A straight wall segment of the zone: one capsule solid along it (scenery draws its look).
export function wallSolids({ from, to, r = 0.45, chasm = false }) {
  const dx = to[0] - from[0], dz = to[1] - from[1], len = Math.hypot(dx, dz);
  return [{ x: (from[0] + to[0]) / 2, z: (from[1] + to[1]) / 2, rot: Math.atan2(-dz, dx), r, hx: len / 2, hz: 0, wall: true, chasm }];
}

// The zone's props as they stand for this story: thorns gone with «Цветение» and the like.
export const zoneProps = (area, s) => area.props.filter((e) => !e[6]?.unless || !s.blessings.includes(e[6].unless));

// A prop's solid: a model's footprint (locations.js), or a prefab's box ('#cabin').
export function solidOf(area, e) {
  const opts = e[6] || {};
  if (!e[0].startsWith('#')) return { ...solidFrom(area.kit, e), ...opts };
  const [name, x, z, rot, size] = e, [bw, bh, bd] = area.prefabs[name.slice(1)].box, k = size / Math.max(bw, bd);
  return { kit: '#', model: name, x, z, rot: (rot * Math.PI) / 180, r: 0.06, hx: (bw * k) / 2 - 0.06, hz: (bd * k) / 2 - 0.06, h: bh * k, fit: { r: size / 2 }, ...opts };
}

export const isOpen = (g, gate) => meets(g.story, gate.requires);

const heroSolids = (g) => g.solids.filter((o) => !(o.chasm && g.dashing));
function pushOut(b, solids) {
  let touched = null;
  for (const o of solids) {
    const c = solidContact(o, b.x, b.z, b.r);
    if (c) { b.x += c.nx * c.pen; b.z += c.nz * c.pen; touched = touched || o; }
  }
  return touched;
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
  for (let i = 0; i < 160; i++) {
    const a = i * 2.4, d = 0.35 * Math.sqrt(i);
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    if (free(g, px, pz, r)) return { x: px, z: pz };
  }
  return { x, z };
}

function addEnemy(g, type, x, z, extra = {}) {
  const def = ENEMY_TYPES[type];
  const e = { id: g.nextId++, type, model: def.model[0], scale: def.scale, x, z, r: def.r, hp: def.hp, maxHp: def.hp, speed: def.speed, flying: !!def.flying,
    dead: false, facing: 0, hurtT: 0, rise: 0, stunT: 0, frozenT: 0, home: null, chasing: true, ...extra };
  g.enemies.push(e);
  return e;
}

// ---------- quest setup: camps and bosses ----------
function setupStep(g) {
  const st = stepOf(g), kind = g.setup;
  g.setup = null;
  if (!st) return;
  if (kind === 'clear') {
    for (const c of g.camps) {
      let i = 0;
      for (const [type, n] of c.units) {
        for (let k = 0; k < n; k++, i++) {
          const a = i * 2.1, p = freeSpot(g, c.x + Math.cos(a) * 1.6, c.z + Math.sin(a) * 1.6, ENEMY_TYPES[type].r);
          c.ids.push(addEnemy(g, type, p.x, p.z, { home: { x: p.x, z: p.z }, chasing: false, camp: c.id }).id);
        }
      }
    }
  } else if (kind === 'boss') {
    const d = st.boss, [bx, bz] = st.at;
    const p = freeSpot(g, bx, bz, d.r ?? 0.9);
    const e = addEnemy(g, 'boss', p.x, p.z, { model: d.model, scale: d.scale ?? 2.1, r: d.r ?? 0.9, hp: d.hp, maxHp: d.hp, speed: d.speed ?? 1.6, rise: 1.2, boss: makeBoss(d) });
    emit(g, 'spawn', { x: e.x, z: e.z, id: e.id, flying: false, rise: e.rise, boss: true });
    emit(g, 'bossStart', { name: d.name, hp: e.hp });
  }
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
  const focus = g.raid.target === 'object' ? g.object : h;
  const dx = ex - focus.x, dz = ez - focus.z, d = Math.hypot(dx, dz) || 1;
  const k = Math.min(d, RAID_DIST) / d, side = (s.i - (s.count - 1) / 2) * 1.4;
  const r = ENEMY_TYPES[s.type].r;
  let pos = freeSpot(g, focus.x + dx * k - (dz / d) * side, focus.z + dz * k + (dx / d) * side, r);
  if (Math.hypot(pos.x - h.x, pos.z - h.z) < 5) pos = freeSpot(g, ex, ez, r); // never on top of the hero
  const e = addEnemy(g, s.type, pos.x, pos.z, { rise: RISE_TIME, target: g.raid.target || 'hero' });
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
  if (p) p.kills = (p.kills || 0) + 1;
  g.lastKill = { x: e.x, z: e.z };
  const tricks = [];
  const banks = Math.min(3, p?.banks || 0);
  if (banks) tricks.push(banks > 1 ? `Рикошет ×${banks}` : 'Рикошет');
  emit(g, 'kill', { x: e.x, z: e.z, points: 0, combo: p?.kills || 1, id: e.id, vx: p?.vx || 0, vz: p?.vz || 0, px: p?.x ?? e.x, pz: p?.z ?? e.z, tricks, boss: !!e.boss, decoy: !!e.decoy });
  if (e.type === 'splitter') {
    for (const s of [-1, 1]) {
      const c = addEnemy(g, 'runner', e.x + s * 0.5, e.z, { split: true, home: e.home, chasing: e.chasing, camp: e.camp });
      p?.hits.add(c.id);
      if (e.camp) g.camps.find((x) => x.id === e.camp)?.ids.push(c.id);
    }
  }
  if (e.boss) {
    for (const x of g.enemies) if (!x.dead && x !== e) { x.dead = true; x.deadT = 0; x.vanish = !!x.decoy; }
    emit(g, 'bossDown', { x: e.x, z: e.z, name: e.boss.name });
  }
  if (e.camp) {
    const c = g.camps.find((x) => x.id === e.camp);
    if (c && !c.cleared && c.ids.every((id) => g.enemies.find((x) => x.id === id)?.dead !== false)) {
      c.cleared = true;
      emit(g, 'camp', { x: c.x, z: c.z, id: c.id, left: g.camps.filter((x) => !x.cleared).length });
    }
  }
}

function damage(g, e, p) {
  p.hits.add(e.id);
  if (e.boss) { e.lastBank = p.banks || 0; e.lastThrow = p; }
  if (e.boss && bossBlocks(e, p)) {
    emit(g, 'block', { x: e.x, z: e.z, id: e.id, why: e.boss.vulnerable === 'stunned' ? 'stun' : 'shield' });
    p.vx = -p.vx * 0.8; p.vz = -p.vz * 0.8;
    return;
  }
  const bank = e.boss && (p.banks || 0) >= 1; // a bank shot hits a boss twice as hard
  e.hp -= bank ? 2 : 1;
  e.hurtT = 0.2;
  if (bank) emit(g, 'bank', { x: e.x, z: e.z, id: e.id });
  if (g.blessed('frost')) e.frozenT = e.boss ? FROST_T / 3 : FROST_T;
  if (e.hp <= 0) killEnemy(g, e, p);
  else {
    emit(g, 'hurt', { x: e.x, z: e.z, id: e.id });
    if (e.boss) emit(g, 'bossHit', { hp: e.hp, max: e.maxHp, x: e.x, z: e.z });
  }
}

// A boss can be hit again by the same throw after it bounced off something.
const canHit = (e, p) => !p.hits.has(e.id) || (e.boss && e.lastThrow === p && (p.banks || 0) > e.lastBank);

// Something hurt the hero: an enemy (knocks back away from it), a shot, a rock, the climate.
function hitHero(g, src, d, why = 'touch') {
  const h = g.hero;
  if (g.over || g.hurtT > 0 || g.dashing) return;
  g.hearts--;
  g.hurtT = HURT_T;
  if (src && d > 1e-3) {
    const nx = (h.x - src.x) / d, nz = (h.z - src.z) / d;
    h.vx = nx * KNOCK; h.vz = nz * KNOCK;
    if (src.id && !src.boss) { src.stunT = STUN_T; src.x -= nx * 0.4; src.z -= nz * 0.4; }
  }
  if (g.area.frostTouch && why === 'touch') g.slowT = 1.2;
  emit(g, 'hit', { x: h.x, z: h.z, hearts: g.hearts, by: src?.id ?? null, why });
  if (g.hearts <= 0) {
    g.over = true; g.killer = src?.id ?? null; g.faintT = FAINT_T; g.talk = null;
    emit(g, 'faint', { x: h.x, z: h.z });
  }
}

// After fainting: wake at the campfire with full hearts; fights of the step start over.
function wake(g) {
  const h = g.hero, p = freeSpot(g, g.campfire.x, g.campfire.z + 1.8, h.r);
  g.over = false; g.killer = null;
  Object.assign(h, { x: p.x, z: p.z, vx: 0, vz: 0, moving: 0, facing: Math.PI });
  g.hearts = g.maxHearts; g.hurtT = HURT_T; g.temp = 0; g.slowT = 0;
  g.projectile = { state: 'held', x: h.x, z: h.z, vx: 0, vz: 0, hits: new Set(), events: [] };
  g.shots = []; g.rocks = [];
  const st = stepOf(g), kind = st?.type;
  if (kind === 'defend' || kind === 'protect') {
    const reached = g.raid?.wave || 0; // the waves already beaten stay beaten: the one in progress starts over
    for (const e of g.enemies) if (!e.dead) { e.dead = true; e.vanish = true; e.deadT = 0; }
    beginStep(g);
    if (g.raid) g.raid.wave = Math.max(0, reached - 1);
  } else if (kind === 'boss') { // the boss keeps its wounds and waits at its place; its helpers vanish
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (!e.boss) { e.dead = true; e.vanish = true; e.deadT = 0; continue; }
      const p = freeSpot(g, st.at[0], st.at[1], e.r);
      Object.assign(e, { x: p.x, z: p.z, frozenT: 0, stunT: 0 });
      Object.assign(e.boss, { move: null, stunT: 0, nextT: 2.5 });
    }
  } else for (const e of g.enemies) if (!e.dead && e.home) { e.chasing = false; e.x = e.home.x; e.z = e.home.z; e.hp = e.maxHp; }
  emit(g, 'wake', { x: h.x, z: h.z });
}

// ---------- talking ----------
// A rewarded ad gets the fainted hero up on the spot (instead of at the campfire): full hearts and a
// few safe seconds; the fight, the raid or the boss go on where they were.
export const REVIVE_SAFE = 2.5;
export function revive(g) {
  if (!g.over) return false;
  g.over = false; g.killer = null; g.faintT = 0;
  g.hearts = g.maxHearts; g.hurtT = REVIVE_SAFE; g.temp = 0; g.slowT = 0;
  emit(g, 'revive', { x: g.hero.x, z: g.hero.z });
  return true;
}

export function talkTo(g, id) {
  const v = g.villagers.find((x) => x.id === id);
  if (!v || g.talk || g.over) return false;
  const st = stepOf(g);
  const quest = v.quest && st?.type === 'talk' && st.npc === v.id;
  const chatter = v.isQueen ? queenChatter(g, v) : v.chatter;
  const lines = quest ? st.lines : [chatter[v.chat++ % chatter.length]];
  g.talk = { id: v.id, name: v.name, lines: lines.map((l) => say(g, l)), i: 0, quest, portrait: v.portrait || null, crest: v.crest || null, queen: !!v.isQueen };
  emit(g, 'talk', { id: v.id, quest, queen: !!v.isQueen });
  return true;
}
function queenChatter(g, v) {
  const done = lineOf(g) === null;
  return done ? v.thanks || v.chatter : v.chatter;
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

// ---------- the hero ----------
function stepHero(g, dt, input, talking) {
  const h = g.hero;
  g.hurtT = Math.max(0, g.hurtT - dt);
  g.slowT = Math.max(0, g.slowT - dt);
  g.dashCd = Math.max(0, g.dashCd - dt);
  const mx = talking ? 0 : input.move?.x || 0, mz = talking ? 0 : input.move?.z || 0;
  // «Рывок»: a burst along the stick (or the facing) with a moment of safety.
  if (input.dash && g.blessed('dash') && g.dashCd === 0 && !talking) {
    const l = Math.hypot(mx, mz);
    g.dashDir = l > 0.2 ? [mx / l, mz / l] : [Math.sin(h.facing), Math.cos(h.facing)];
    g.dashT = DASH.time; g.dashCd = DASH.cooldown; g.dashing = true;
    emit(g, 'dash', { x: h.x, z: h.z, dx: g.dashDir[0], dz: g.dashDir[1] });
  }
  const gr = ground(g, h.x, h.z);
  if (g.dashing) {
    g.dashT -= dt;
    h.vx = g.dashDir[0] * DASH.speed; h.vz = g.dashDir[1] * DASH.speed;
    if (g.dashT <= 0) { g.dashing = false; h.vx *= 0.3; h.vz *= 0.3; }
  } else {
    const sp = HERO_SPEED * (1 + BOOTS_STEP * g.mods.speed) * gr.slow * (g.slowT > 0 ? 0.55 : 1);
    const k = Math.min(1, gr.friction * dt);
    h.vx += (mx * sp - h.vx) * k;
    h.vz += (mz * sp - h.vz) * k;
  }
  const dr = drift(g, h.x, h.z, 'hero');
  h.x += (h.vx + dr.vx) * dt; h.z += (h.vz + dr.vz) * dt;
  clampTo(g, h);
  const touched = pushOut(h, heroSolids(g));
  if (touched?.hurts) hitHero(g, touched, Math.max(0.1, Math.hypot(h.x - touched.x, h.z - touched.z)), 'thorns');
  for (const v of g.villagers) pushOutOf(h, v.x, v.z, 0.4);
  for (const t of g.targets) if (!t.hit) pushOutOf(h, t.x, t.z, 0.35);
  if (g.object) pushOutOf(h, g.object.x, g.object.z, g.object.r);
  portalJump(g, h, h.vx || Math.sin(h.facing), h.vz || Math.cos(h.facing));
  h.moving = Math.hypot(h.vx, h.vz);
  if (h.moving > 0.3) h.facing = Math.atan2(h.vx, h.vz);
}

// Quicksand: standing in the middle too long costs a heart and throws the hero out.
function stepQuicksand(g, dt) {
  const h = g.hero;
  const q = g.areas.find((a) => a.kind === 'quicksand' && Math.hypot(h.x - a.x, h.z - a.z) < a.r * 0.35);
  g.sinkT = q ? (g.sinkT || 0) + dt : 0;
  if (q && g.sinkT > 1.2) { g.sinkT = 0; hitHero(g, { x: q.x, z: q.z }, Math.max(0.1, Math.hypot(h.x - q.x, h.z - q.z)), 'sand'); }
}

// ---------- the thrown weapon ----------
function stepWeapon(g, dt, input, talking) {
  const h = g.hero;
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
    p.tHits = {};
    if (g.blessed('star')) p.recallSpeed = 24;
    g.recallT = g.blessed('star') ? STAR_RECALL : RECALL_COOLDOWN;
    emit(g, 'recall', { x: p.x, z: p.z });
  }
  const world = { arena: g.arena, solids: g.solids.filter((o) => !o.chasm), enemies: g.enemies.filter((e) => !e.under), hero: h, rule: g.loc.rule };
  const wasFlying = p.state === 'flying';
  stepProjectile(p, dt, world);
  if (p.state === 'flying' && p.weapon !== 'recall' && p.weapon !== 'orbit') {
    const dr = drift(g, p.x, p.z, 'shot');
    if (dr.vx || dr.vz) {
      p.vx += dr.vx * dt * 3; p.vz += dr.vz * dt * 3;
      if (p.bx !== undefined) { p.bx += dr.vx * dt; p.bz += dr.vz * dt; } // the snake's base point
      p.x += dr.vx * dt; p.z += dr.vz * dt;
    }
    // Shots fly through the stone rings too — except the boomerang, which always comes home.
    if (p.weapon !== 'boomerang' && portalJump(g, p, p.vx, p.vz) && p.bx !== undefined) { p.bx = p.x; p.bz = p.z; }
  }
  if (p.state === 'flying' && !['recall', 'orbit', 'boomerang', 'blackhole'].includes(p.weapon) && Math.hypot(p.x - p.ox, p.z - p.oz) > MAX_RANGE) drop(p);
  for (const ev of p.events) {
    if (ev === 'bounce') p.banks = (p.banks || 0) + 1;
    emit(g, ev, { x: p.x, z: p.z });
  }
  p.events.length = 0;
  if (p.state === 'flying') {
    const pr = p.r || PROJECTILE_R;
    for (const e of g.enemies) {
      if (e.dead || e.under || e.rise > 0.4 || !canHit(e, p) || Math.hypot(e.x - p.x, e.z - p.z) >= e.r + pr) continue;
      damage(g, e, p);
      onEnemyHit(p, e, world);
    }
    for (const t of g.targets) hitTarget(g, t, p.x, p.z, pr, p);
  }
  if (p.explosion) {
    const ex = p.explosion;
    p.explosion = null;
    for (const e of g.enemies) if (!e.dead && !e.under && Math.hypot(e.x - ex.x, e.z - ex.z) < ex.r + e.r) { if (!e.boss) e.hp = 1; damage(g, e, p); }
    for (const t of g.targets) hitTarget(g, t, ex.x, ex.z, ex.r, p);
  }
  if (wasFlying && p.state === 'dropped') emit(g, 'drop', { x: p.x, z: p.z });
  const dHero = Math.hypot(p.x - h.x, p.z - h.z);
  // Close by, the dropped weapon jumps to the hand; the forge's magnet pulls it in from further away.
  const pull = dHero < VACUUM_R ? 8 : g.mods.magnet && dHero < 2.5 + 2 * g.mods.magnet ? 2 + 1.5 * g.mods.magnet : 0;
  if (p.state === 'dropped' && dHero > 1e-3 && pull) {
    const s = Math.min(1, (pull * dt) / dHero);
    p.x += (h.x - p.x) * s; p.z += (h.z - p.z) * s;
  }
  if (p.state === 'flying' && p.weapon !== 'recall' && g.weapon.catchable && p.t > 0.25 && dHero < 0.75) {
    p.state = 'held';
    emit(g, 'catch', { x: h.x, z: h.z });
  } else if (p.state === 'dropped' && Math.hypot(p.x - h.x, p.z - h.z) < PICKUP_R) {
    p.state = 'held';
    emit(g, 'pickup', { x: h.x, z: h.z });
  }
}

// Targets of every style (targets, fires to light, obelisks, rifts, boulders, the black crystal):
// some take several hits, some light only with the glowing weapon («Солнечный камень»).
function hitTarget(g, t, x, z, r, p) {
  if (t.hit || Math.hypot(t.x - x, t.z - z) >= t.r + r) return;
  const banks = p.banks || 0;
  p.tHits ??= {};
  if (p.tHits[t.id] !== undefined && p.tHits[t.id] >= banks) return; // once per pass: again only after a bounce
  p.tHits[t.id] = banks;
  if (t.needs === 'sun' && !g.glow) { emit(g, 'needLight', { x: t.x, z: t.z, id: t.id }); return; }
  t.hp--;
  if (t.hp > 0) { emit(g, 'targetHurt', { x: t.x, z: t.z, id: t.id, hp: t.hp, style: t.style }); return; }
  t.hit = true;
  if (['brazier', 'lantern', 'obelisk'].includes(t.style)) g.lights.push({ x: t.x, z: t.z, warm: g.area.climate ? LIGHT_WARM : 0, style: t.style });
  emit(g, 'target', { x: t.x, z: t.z, id: t.id, left: g.targets.filter((o) => !o.hit).length, vx: p.vx, vz: p.vz, style: t.style });
}

// ---------- enemies ----------
function stepEnemies(g, dt, talking) {
  const h = g.hero;
  let threat = false;
  for (const e of g.enemies) {
    if (e.dead) { e.deadT = (e.deadT || 0) + dt; continue; }
    e.hurtT = Math.max(0, e.hurtT - dt);
    if (e.lifeT !== undefined && (e.lifeT -= dt) <= 0) { e.dead = true; e.vanish = true; e.deadT = 0; continue; } // decoys fade
    const dx = h.x - e.x, dz = h.z - e.z, d = Math.hypot(dx, dz) || 1;
    if (e.rise > 0) { e.rise = Math.max(0, e.rise - dt); e.facing = Math.atan2(dx, dz); threat = true; continue; }
    if (e.frozenT > 0) { e.frozenT = Math.max(0, e.frozenT - dt); continue; }
    if (e.home) {
      const fromHome = Math.hypot(e.x - e.home.x, e.z - e.home.z);
      if (!e.chasing && d < AGGRO_R) e.chasing = true;
      else if (e.chasing && (fromHome > LEASH_R || d > LEASH_R)) e.chasing = false;
    }
    if (e.chasing && d < CALM_R) threat = true;
    if (e.stunT > 0) { e.stunT = Math.max(0, e.stunT - dt); continue; }
    // Raiders of a «protect» step go for the object unless the hero stands right in their way.
    const obj = e.target === 'object' && g.object && d > 2 ? g.object : null;
    const kind = obj ? null : foeStep(g, e, dt, d);
    if (kind !== 'stay') {
      const goal = obj || (e.chasing ? h : e.home);
      const sp = e.speed * (e.flying ? 1 : ground(g, e.x, e.z).slow);
      const tx = goal.x - e.x, tz = goal.z - e.z, td = Math.hypot(tx, tz);
      const reach = obj ? obj.r + e.r + 0.15 : 0.15;
      if (td > reach) {
        e.x += (tx / td) * sp * dt; e.z += (tz / td) * sp * dt;
        turnTo(e, Math.atan2(tx, tz), dt);
      } else if (obj) {
        e.facing = Math.atan2(tx, tz);
        e.atkT = (e.atkT ?? 0) + dt;
        if (e.atkT >= OBJECT_HIT_EVERY) { e.atkT = 0; hitObject(g, e); }
      }
      if (!e.flying) {
        pushOut(e, g.solids);
        if (td > reach) slideAroundSolids(g, e, goal, sp * dt);
      }
    }
    if (!e.flying) clampTo(g, e);
    if (e.under) continue;
    if ((e.chasing || e.target === 'object') && g.hurtT === 0 && !talking && d < e.r + h.r - 0.08) {
      hitHero(g, e, d);
      if (g.over) break;
    }
  }
  const alive = g.enemies.filter((e) => !e.dead && !e.under);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.r + b.r;
      if (d < min && d > 1e-6) {
        const s = (min - d) / 2, wa = a.boss ? 0.1 : 1, wb = b.boss ? 0.1 : 1; // bosses aren't shoved around
        a.x -= (dx / d) * s * wa; a.z -= (dz / d) * s * wa; b.x += (dx / d) * s * wb; b.z += (dz / d) * s * wb;
      }
    }
  }
  g.enemies = g.enemies.filter((e) => !e.dead || e.deadT < 1.5); // render has seen them fall by then
  return threat;
}

function hitObject(g, e) {
  const o = g.object;
  if (!o || o.hp <= 0) return;
  o.hp--;
  emit(g, 'objectHit', { x: o.x, z: o.z, hp: o.hp, max: o.max, by: e.id });
  if (o.hp > 0) return;
  emit(g, 'objectLost', { x: o.x, z: o.z, name: o.name });
  for (const x of g.enemies) if (!x.dead) { x.dead = true; x.vanish = true; x.deadT = 0; }
  beginStep(g); // try again
}

// Enemy shots fly straight, stop at solids and hurt the hero.
function stepShots(g, dt) {
  const h = g.hero;
  for (const s of g.shots) {
    s.t += dt;
    s.x += s.vx * dt; s.z += s.vz * dt;
    if (s.t > 2.8 || Math.abs(s.x) > g.arena.W || Math.abs(s.z) > g.arena.D || g.solids.some((o) => !o.chasm && solidContact(o, s.x, s.z, s.r))) { s.dead = true; continue; }
    if (!g.over && Math.hypot(s.x - h.x, s.z - h.z) < s.r + h.r) {
      s.dead = true;
      hitHero(g, s, Math.hypot(h.x - s.x, h.z - s.z) || 0.1, 'shot');
    }
  }
  g.shots = g.shots.filter((s) => !s.dead);
}

// ---------- the step ----------
// input: { move: {x, z}, fire: {x, z} | null, recall: bool, talk: bool («Говорить»), dash: bool (⚡) }
// The forge sold an upgrade while this world runs: the new levels count at once, a new heart comes full.
export function applyForge(g, forge) {
  const mods = forgeMods(g.story), hearts = forgeHearts(g.story);
  g.story.forge = { ...forge };
  for (const [k, n] of Object.entries(forgeMods(g.story))) g.mods[k] += n - mods[k];
  const more = forgeHearts(g.story) - hearts;
  g.maxHearts += more;
  g.hearts = Math.min(g.maxHearts, g.hearts + Math.max(0, more));
}

export function stepWorld(g, dt, input = {}) {
  const from = g.events.length;
  g.time += dt;
  if (g.over) {
    g.faintT -= dt;
    if (g.faintT <= 0) wake(g);
    return;
  }
  if (g.setup) setupStep(g);
  const h = g.hero, talking = !!g.talk;
  stepHero(g, dt, input, talking);
  stepQuicksand(g, dt);
  stepWeapon(g, dt, input, talking);
  for (const t of g.targets) if (t.hit) t.t += dt; // render: how long it has been falling
  stepRaid(g, dt);
  const threat = stepEnemies(g, dt, talking);
  stepShots(g, dt);
  for (const r of stepRockfall(g, dt)) {
    emit(g, 'rock', { x: r.x, z: r.z, r: r.r });
    const d = Math.hypot(h.x - r.x, h.z - r.z);
    if (d < r.r + h.r * 0.5) hitHero(g, r, d || 0.1, 'rock');
  }
  if (!talking && stepClimate(g, dt)) hitHero(g, null, 0, g.area.climate.kind);
  for (const a of g.areas) if (a.kind === 'push') { const s = gust(a, g.time); if (s.warning !== a.warned) { a.warned = s.warning; if (s.warning && inArea(a, h.x, h.z)) emit(g, 'gustWarn', { dir: a.dir, kind: a.look || 'wind' }); } }

  if (!g.over) {
    for (const it of g.items) {
      if (it.taken || Math.hypot(it.x - h.x, it.z - h.z) >= ITEM_R) continue;
      it.taken = true;
      emit(g, 'item', { x: it.x, z: it.z, kind: it.kind, left: g.items.filter((x) => !x.taken).length });
    }
    if (g.reach && Math.hypot(g.reach.x - h.x, g.reach.z - h.z) < g.reach.r) { g.reach = null; emit(g, 'reached', { x: h.x, z: h.z }); }
    // A scroll of the «Летопись»: a page opens (all of them: a reward).
    for (const sc of g.scrolls) {
      if (sc.taken || Math.hypot(sc.x - h.x, sc.z - h.z) >= ITEM_R) continue;
      sc.taken = true;
      g.story.scrolls.push(sc.id);
      const all = SCROLLS.every((p) => g.story.scrolls.includes(p.id));
      emit(g, 'scroll', { x: sc.x, z: sc.z, id: sc.id, found: g.story.scrolls.length, of: SCROLLS.length, all });
      if (all) emit(g, 'reward', { coins: SCROLL_REWARD });
      emit(g, 'save');
    }
    // A timed step: out of time, it starts over.
    if (g.stepT > 0 && !talking && g.advanceT < 0) {
      g.stepT = Math.max(0, g.stepT - dt);
      if (g.stepT === 0) { emit(g, 'timeUp', { x: h.x, z: h.z }); beginStep(g); }
    }
    // Hearts come back at the campfire, and with «Цветение» anywhere calm.
    const resting = !threat && g.hearts < g.maxHearts && Math.hypot(g.campfire.x - h.x, g.campfire.z - h.z) < REST_R;
    g.restT = resting ? g.restT + dt : 0;
    if (g.restT >= REST_T) { g.restT = 0; g.hearts++; emit(g, 'heal', { x: h.x, z: h.z, hearts: g.hearts }); }
    g.calmT = threat ? 0 : g.calmT + dt;
    if (g.blessed('bloom') && g.calmT > BLOOM.calm && g.hearts < g.maxHearts) {
      g.regenT += dt;
      if (g.regenT >= BLOOM.every) { g.regenT = 0; g.hearts++; emit(g, 'heal', { x: h.x, z: h.z, hearts: g.hearts, bloom: true }); }
    } else g.regenT = 0;
    // Who is in reach for «Говорить» (and turns to the hero).
    g.near = null;
    if (!threat && !talking) {
      let best = Infinity;
      for (const v of g.villagers) {
        if (v.isQueen && ['hidden', 'frozen', 'asleep'].includes(g.queenState)) continue;
        const d = Math.hypot(v.x - h.x, v.z - h.z), score = d - (v.quest ? TALK_R : 0); // whoever has a task comes first
        if (d < TALK_R && score < best) { best = score; g.near = v.id; }
      }
    }
    for (const v of g.villagers) {
      const d = Math.hypot(v.x - h.x, v.z - h.z);
      v.look = !v.fixed && (d < 4 || g.talk?.id === v.id) ? Math.atan2(h.x - v.x, h.z - v.z) : null;
    }
    if (input.talk && g.near) talkTo(g, g.near);
    // Gates: an open one takes the hero through; a closed one says why, once per visit.
    for (const t of g.gates) {
      const inside = Math.hypot(h.x - t.x, h.z - t.z) < t.w / 2 + 0.4;
      if (inside && !t.inside) emit(g, isOpen(g, t) ? 'gate' : 'gateClosed', { id: t.id, to: t.to, arrive: t.arrive || null, text: t.closed || null });
      t.inside = inside;
    }
  }

  // Quest progress from this step's events.
  for (let i = from; i < g.events.length; i++) onEvent(g, g.events[i]);
  if (g.advanceT > 0 && (g.advanceT -= dt) <= 0) completeStep(g);
}
