// Enemy kinds of the open world beyond plain chasers — shooters, burrowers, blinkers — and the
// bosses with their moves (charge, summon, volley, slam, blink, clones). Pure, deterministic: random
// choices come from the world's seeded rng. Used by world.js, which owns movement and damage.
import { ENEMY_TYPES } from '../waves.js';

const SHOT_SPEED = 7.5;
const SHOT_LIFE = 2.8;
export const MAX_MINIONS = 6;

const emit = (g, type, data = {}) => g.events.push({ type, ...data });

export function shoot(g, from, tx, tz, speed = SHOT_SPEED, kind = 'bone') {
  const dx = tx - from.x, dz = tz - from.z, d = Math.hypot(dx, dz) || 1;
  const s = { id: g.nextShot++, x: from.x + (dx / d) * (from.r + 0.2), z: from.z + (dz / d) * (from.r + 0.2), vx: (dx / d) * speed, vz: (dz / d) * speed, r: 0.25, t: 0, kind };
  g.shots.push(s);
  emit(g, 'enemyShot', { x: s.x, z: s.z, id: s.id });
  return s;
}

// A fan of shots around the direction to the hero.
function fan(g, e, count, spread, speed) {
  const h = g.hero, base = Math.atan2(h.x - e.x, h.z - e.z);
  for (let i = 0; i < count; i++) {
    const a = base + (count > 1 ? (i / (count - 1) - 0.5) * spread : 0);
    shoot(g, e, e.x + Math.sin(a) * 5, e.z + Math.cos(a) * 5, speed, 'bone');
  }
}

// Bosses with a shield turn slowly (def.turn rad/s), so a quick hero can get round them.
export function turnTo(e, a, dt) {
  const rate = e.boss?.def.turn;
  if (!rate) { e.facing = a; return; }
  const d = Math.atan2(Math.sin(a - e.facing), Math.cos(a - e.facing));
  e.facing += Math.max(-rate * dt, Math.min(rate * dt, d));
}

// Kind-specific behaviour before the common chase. Returns 'stay' when the enemy must not walk this
// step (shooting stance, underground, blinking), else null.
export function foeStep(g, e, dt, d) {
  const def = ENEMY_TYPES[e.type], h = g.hero;
  if (e.boss) return bossStep(g, e, dt, d);
  if (def.range && e.chasing) { // shooter: keeps its distance and throws bones
    e.fireT = (e.fireT ?? def.fireEvery * (0.5 + 0.5 * g.rng.next())) - dt;
    if (e.fireT <= 0 && d < def.range + 3) { e.fireT = def.fireEvery; shoot(g, e, h.x, h.z); }
    if (d < def.range) {
      if (d < def.range - 2.5) { const k = (e.speed * 0.6 * dt) / d; e.x -= (h.x - e.x) * k; e.z -= (h.z - e.z) * k; }
      e.facing = Math.atan2(h.x - e.x, h.z - e.z);
      return 'stay';
    }
  }
  if (def.burrow && e.chasing) { // burrower: dives under the sand and comes up next to the hero
    e.burrowT = (e.burrowT ?? 3 + g.rng.next() * 2) - dt;
    if (e.under) {
      const k = Math.min(1, (3.2 * dt) / Math.max(d, 1e-3));
      e.x += (h.x - e.x) * k * (d > 2.6 ? 1 : 0); e.z += (h.z - e.z) * k * (d > 2.6 ? 1 : 0);
      if (e.burrowT <= 0) { e.under = false; e.rise = 0.6; e.burrowT = 3.5 + g.rng.next() * 2; emit(g, 'emerge', { x: e.x, z: e.z, id: e.id }); }
      return 'stay';
    }
    if (e.burrowT <= 0 && d > 1.2) { e.under = true; e.burrowT = 1.6; emit(g, 'burrow', { x: e.x, z: e.z, id: e.id }); return 'stay'; }
  }
  if (def.blink && e.chasing) { // blinker: vanishes and appears beside the hero
    e.blinkT = (e.blinkT ?? 2 + g.rng.next() * 2) - dt;
    if (e.blinkAt && e.blinkT <= 0) {
      e.x = e.blinkAt.x; e.z = e.blinkAt.z; e.blinkAt = null; e.blinkT = 4 + g.rng.next() * 1.5;
      emit(g, 'blink', { x: e.x, z: e.z, id: e.id });
    } else if (!e.blinkAt && e.blinkT <= 0.5 && d > 2.5) {
      const a = g.rng.range(0, Math.PI * 2);
      e.blinkAt = g.freeSpot(h.x + Math.sin(a) * 3, h.z + Math.cos(a) * 3, e.r);
      emit(g, 'blinkWarn', { x: e.blinkAt.x, z: e.blinkAt.z, id: e.id });
    }
    if (e.blinkAt) return 'stay';
  }
  return null;
}

// ---------- bosses ----------
// def: { name, model, scale, hp, speed, shield: 'front' | null, vulnerable: 'stunned' | null,
//        moves: ['charge' | 'summon' | 'volley' | 'slam' | 'blink' | 'clones'], every, summon: [type, n],
//        phases: [{ at: hp fraction, moves, speed, every }] }
export function makeBoss(def) {
  return { name: def.name, def, moves: def.moves, every: def.every ?? 3.2, nextT: 1.5, i: 0, move: null, stunT: 0, phase: 0, shield: def.shield ?? null, vulnerable: def.vulnerable ?? null };
}

export function bossStep(g, e, dt, d) {
  const b = e.boss, h = g.hero, def = b.def;
  // Phases at hp thresholds.
  const ph = def.phases?.[b.phase];
  if (ph && e.hp <= ph.at * e.maxHp) {
    b.phase++;
    b.moves = ph.moves ?? b.moves; b.every = ph.every ?? b.every; if (ph.speed) e.speed = ph.speed;
    if ('shield' in ph) b.shield = ph.shield;
    if ('vulnerable' in ph) b.vulnerable = ph.vulnerable;
    if (ph.summon) b.summon = ph.summon;
    emit(g, 'bossPhase', { name: b.name, text: ph.text || 'Босс в ярости!' });
  }
  if (b.stunT > 0) { b.stunT -= dt; return 'stay'; }
  const m = b.move;
  if (!m) {
    b.nextT -= dt;
    if (b.nextT > 0) return null; // chases between moves
    const kind = b.moves[b.i++ % b.moves.length];
    b.move = { kind, t: 0, stage: 'windup', dir: null };
    emit(g, 'bossMove', { kind, id: e.id, x: e.x, z: e.z, r: kind === 'slam' ? def.slamR ?? 3.8 : 0 });
    return 'stay';
  }
  m.t += dt;
  const wind = { charge: 0.75, summon: 0.6, volley: 0.55, slam: 1.0, blink: 0.45, clones: 0.6 }[m.kind];
  if (m.stage === 'windup') {
    turnTo(e, Math.atan2(h.x - e.x, h.z - e.z), dt);
    if (m.t < wind) return 'stay';
    m.stage = 'act'; m.t = 0;
    const toward = Math.atan2(h.x - e.x, h.z - e.z);
    if (m.kind === 'charge') { const a = def.turn ? e.facing : toward; m.dir = [Math.sin(a), Math.cos(a)]; }
    else if (m.kind === 'summon') {
      const [type, n] = b.summon || def.summon || ['grunt', 2];
      const alive = g.enemies.filter((x) => !x.dead && !x.boss).length;
      for (let i = 0; i < Math.min(n, MAX_MINIONS - alive); i++) {
        const a = toward + Math.PI + (i - (n - 1) / 2) * 0.9;
        const p = g.freeSpot(e.x + Math.sin(a) * 2.2, e.z + Math.cos(a) * 2.2, ENEMY_TYPES[type].r);
        const c = g.addEnemy(type, p.x, p.z, { rise: 0.9 });
        emit(g, 'spawn', { x: c.x, z: c.z, id: c.id, flying: false, rise: c.rise });
      }
    } else if (m.kind === 'volley') fan(g, e, def.volley ?? 5, def.spread ?? 1.0, def.shotSpeed ?? 7);
    else if (m.kind === 'slam') {
      const r = def.slamR ?? 3.8;
      emit(g, 'slam', { x: e.x, z: e.z, r, id: e.id });
      if (d < r + h.r && !g.dashing && g.hurtT === 0) g.hurt(e, d, 'slam');
      b.stunT = def.stun ?? 2.2;
      emit(g, 'bossStunned', { id: e.id, t: b.stunT });
    } else if (m.kind === 'blink' || m.kind === 'clones') {
      if (m.kind === 'clones') {
        for (const s of [-1, 1]) {
          const a = toward + Math.PI / 2 * s;
          const p = g.freeSpot(h.x - Math.sin(a) * 5, h.z - Math.cos(a) * 5, e.r);
          const c = g.addEnemy(e.type, p.x, p.z, { decoy: true, hp: 1, maxHp: 1, model: e.model, scale: e.scale, r: e.r, speed: e.speed * 0.9, lifeT: 9 });
          emit(g, 'spawn', { x: c.x, z: c.z, id: c.id, flying: false, rise: 0, decoy: true });
        }
      }
      const a = g.rng.range(0, Math.PI * 2);
      const p = g.freeSpot(h.x + Math.sin(a) * 5, h.z + Math.cos(a) * 5, e.r);
      emit(g, 'blink', { x: e.x, z: e.z, id: e.id });
      e.x = p.x; e.z = p.z;
      emit(g, 'blink', { x: e.x, z: e.z, id: e.id });
    }
    return 'stay';
  }
  // act / recover
  if (m.kind === 'charge' && m.t < 0.75) {
    const s = 10 * dt;
    e.x += m.dir[0] * s; e.z += m.dir[1] * s;
    e.facing = Math.atan2(m.dir[0], m.dir[1]);
    if (g.blocked(e)) { b.stunT = def.stun ?? 1.4; b.move = null; b.nextT = b.every; emit(g, 'bossStunned', { id: e.id, t: b.stunT, wall: true }); }
    return 'stay';
  }
  if (m.kind === 'charge' && def.tired && !m.rested) { m.rested = true; b.stunT = def.tired; emit(g, 'bossStunned', { id: e.id, t: b.stunT }); return 'stay'; }
  if (m.t > (m.kind === 'charge' ? 1.2 : 0.5)) { b.move = null; b.nextT = b.every; }
  return 'stay';
}

// Can this hit hurt the boss? A front shield blocks hits that fly into its face; 'stunned' bosses
// take damage only while stunned. Decoys and plain enemies are always hurt.
export function bossBlocks(e, p) {
  const b = e.boss;
  if (!b) return false;
  if (b.vulnerable === 'stunned' && b.stunT <= 0) return true;
  if (b.shield === 'front' && b.stunT <= 0) {
    const v = Math.hypot(p.vx, p.vz);
    if (v < 1e-3) return false;
    const fx = Math.sin(e.facing), fz = Math.cos(e.facing);
    return (p.vx * fx + p.vz * fz) / v < -0.35; // flying into its face
  }
  return false;
}
