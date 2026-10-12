// A test player for «Приключение»: finds paths on a grid, talks, throws at targets and enemies,
// collects, fights bosses, warms up, dodges falling rocks. Used by the story tests to prove that
// every quest line can be played to the end. Not a test file itself.
import { solidContact } from '../src/solid.js';
import { stepWorld, nextLine, TALK_R } from '../src/story/world.js';
import { stepOf } from '../src/story/quests.js';
import { inArea, isWarm } from '../src/story/hazards.js';

const DT = 1 / 60;
const CELL = 0.5;

export function makeNav(g) {
  const { W, D } = g.arena, nx = Math.round((2 * W) / CELL), nz = Math.round((2 * D) / CELL);
  const blocked = new Uint8Array(nx * nz);
  const wx = (i) => -W + (i + 0.5) * CELL, wz = (j) => -D + (j + 0.5) * CELL;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = wx(i), z = wz(j);
      if (Math.abs(x) > W - 0.45 || Math.abs(z) > D - 0.45) { blocked[j * nx + i] = 1; continue; }
      if (g.solids.some((o) => solidContact(o, x, z, 0.5))) blocked[j * nx + i] = 1;
      else if (g.villagers.some((v) => Math.hypot(v.x - x, v.z - z) < 0.85)) blocked[j * nx + i] = 1;
      else if (g.areas.some((a) => a.kind === 'quicksand' && inArea({ ...a, r: a.r + 0.3 }, x, z))) blocked[j * nx + i] = 2; // avoid, not wall
      else if (g.areas.some((a) => a.kind === 'portal' && [a.a, a.b].some(([px, pz]) => Math.hypot(x - px, z - pz) < (a.r || 0.9) + 0.6))) blocked[j * nx + i] = 1; // walks around the rings
    }
  }
  const ci = (x) => Math.max(0, Math.min(nx - 1, Math.floor((x + W) / CELL))), cj = (z) => Math.max(0, Math.min(nz - 1, Math.floor((z + D) / CELL)));
  function nearestFree(i, j) {
    for (let r = 0; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a < nx && b < nz && !blocked[b * nx + a]) return [a, b];
    }
    return [i, j];
  }
  function path(fx, fz, tx, tz) {
    const [si, sj] = nearestFree(ci(fx), cj(fz)), [ti, tj] = nearestFree(ci(tx), cj(tz));
    const prev = new Int32Array(nx * nz).fill(-1), q = [sj * nx + si];
    prev[q[0]] = q[0];
    const goal = tj * nx + ti;
    for (let k = 0; k < q.length && prev[goal] < 0; k++) {
      const c = q[k], i = c % nx, j = (c - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const n = b * nx + a;
        if (prev[n] >= 0 || blocked[n] === 1) continue;
        if (di && dj && (blocked[j * nx + a] === 1 || blocked[b * nx + i] === 1)) continue; // no corner cutting
        prev[n] = c; q.push(n);
      }
    }
    if (prev[goal] < 0) return null;
    const out = [];
    for (let c = goal; c !== prev[c]; c = prev[c]) out.push([wx(c % nx), wz((c - (c % nx)) / nx)]);
    return out.reverse();
  }
  return { path };
}

const clearLine = (g, ax, az, bx, bz) => {
  const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.3);
  for (let k = 1; k < n; k++) {
    const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
    if (g.solids.some((o) => !o.chasm && solidContact(o, x, z, 0.3))) return false;
  }
  return true;
};

export function makeBot(g) {
  const nav = makeNav(g);
  const st = { route: null, goal: null, replanT: 0, lastPos: null, stuckT: 0, wiggle: 0 };
  const walkTo = (x, z, stop = 0.5) => {
    const h = g.hero;
    if (Math.hypot(x - h.x, z - h.z) < stop) return { x: 0, z: 0 };
    st.replanT -= DT;
    if (!st.route || !st.goal || Math.hypot(st.goal[0] - x, st.goal[1] - z) > 1 || st.replanT <= 0) {
      st.route = nav.path(h.x, h.z, x, z) || [[x, z]]; st.goal = [x, z]; st.replanT = 1.5;
    }
    while (st.route.length > 1 && Math.hypot(st.route[0][0] - h.x, st.route[0][1] - h.z) < 0.45) st.route.shift();
    const [wx, wz] = st.route[0] || [x, z], dx = wx - h.x, dz = wz - h.z, d = Math.hypot(dx, dz) || 1;
    // unstick: if barely moving for a while, step sideways
    if (st.lastPos && Math.hypot(h.x - st.lastPos[0], h.z - st.lastPos[1]) < 0.01) st.stuckT += DT; else st.stuckT = 0;
    st.lastPos = [h.x, h.z];
    if (st.stuckT > 0.6) { st.wiggle = 0.5; st.stuckT = 0; st.replanT = 0; }
    if (st.wiggle > 0) { st.wiggle -= DT; return { x: -dz / d, z: dx / d }; }
    return { x: dx / d, z: dz / d };
  };
  const throwAt = (x, z, range = 7) => {
    const h = g.hero;
    if (Math.hypot(x - h.x, z - h.z) < range && clearLine(g, h.x, h.z, x, z)) return { fire: { x, z } };
    return { move: walkTo(x, z, 1.2) };
  };

  return function act() {
    const h = g.hero, p = g.projectile, step = stepOf(g);
    if (g.talk) { nextLine(g); return {}; }
    // Dodge falling rocks.
    const rock = g.rocks.find((r) => Math.hypot(r.x - h.x, r.z - h.z) < r.r + 0.8);
    if (rock) { const dx = h.x - rock.x, dz = h.z - rock.z, d = Math.hypot(dx, dz) || 1; return { move: { x: dx / d, z: dz / d } }; }
    const foes = g.enemies.filter((e) => !e.dead && !e.under && e.rise <= 0.3 && !e.decoy && (e.chasing || e.target === 'object' || e.boss));
    const decoys = g.enemies.filter((e) => !e.dead && e.decoy);
    const near = (list) => list.reduce((b, e) => (!b || Math.hypot(e.x - h.x, e.z - h.z) < Math.hypot(b.x - h.x, b.z - h.z) ? e : b), null);
    // Warm up when the climate is about to hurt and nobody is chasing.
    if (g.area.climate && g.temp > 0.72) st.warming = true;
    if (st.warming && (g.temp < 0.15 || !g.area.climate)) st.warming = false;
    if (st.warming && !foes.some((e) => Math.hypot(e.x - h.x, e.z - h.z) < 8)) {
      if (isWarm(g, h.x, h.z)) return {};
      const spots = [{ x: g.campfire.x, z: g.campfire.z + 1.8 }, ...g.lights, ...g.areas.filter((a) => a.kind === 'warm')];
      const s = near(spots);
      return { move: walkTo(s.x, s.z, 0.8) };
    }
    if (p.state === 'dropped') return g.recallT === 0 ? { recall: true } : { move: walkTo(p.x, p.z, 0.3) };
    // Step aside from a boss winding up a charge, and out of a slam's ring.
    const boss = foes.find((e) => e.boss);
    if (boss?.boss.move?.stage === 'windup' || (boss?.boss.move?.kind === 'charge' && boss.boss.move.t < 0.75)) {
      const m = boss.boss.move, dx = h.x - boss.x, dz = h.z - boss.z, d = Math.hypot(dx, dz) || 1;
      if (m.kind === 'charge' && d < 12) return { move: { x: -dz / d, z: dx / d } };
      if (m.kind === 'slam' && d < (boss.boss.def.slamR ?? 3.8) + 1.5) return { move: { x: dx / d, z: dz / d } };
    }
    let foe = near(foes);
    if (foe?.boss && foe.boss.vulnerable === 'stunned' && foe.boss.stunT <= 0) {
      // Wait for the slam: keep a few meters away, dodge out of its ring.
      const d = Math.hypot(foe.x - h.x, foe.z - h.z), others = foes.filter((e) => !e.boss);
      if (others.length) foe = near(others);
      else if (d < 6.5) { const dx = h.x - foe.x, dz = h.z - foe.z; return { move: { x: dx / d, z: dz / d } }; } else return {};
    }
    if (!foe && decoys.length && step?.type === 'boss') foe = near(decoys);
    const range = { snake: 5, orbit: 4.5, boomerang: 8 }[g.weapon.id] ?? 7;
    if (foe && p.state === 'held' && g.weapon.id === 'orbit' && step?.type === 'protect' && g.object && Math.hypot(g.object.x - h.x, g.object.z - h.z) > 3) {
      return { move: walkTo(g.object.x + 1.4, g.object.z + 1.4, 0.6) }; // the orbit guards whatever stands next to the hero
    }
    if (foe && p.state === 'held') return throwAt(foe.x, foe.z, range);
    if (foe) { // the weapon is flying: back away from anyone close
      const d = Math.hypot(foe.x - h.x, foe.z - h.z);
      return d < 3.5 ? { move: { x: (h.x - foe.x) / d, z: (h.z - foe.z) / d } } : { move: { x: 0, z: 0 } };
    }
    if (p.state !== 'held') return {};
    if (!step) return {};
    switch (step.type) {
      case 'talk': {
        const v = g.villagers.find((x) => x.id === step.npc);
        if (g.near === step.npc) return { talk: true };
        return { move: walkTo(v.x, v.z, TALK_R - 0.8) };
      }
      case 'targets': {
        const t = near(g.targets.filter((x) => !x.hit));
        if (!t) return {};
        if (st.targetsOf !== g.targets) { st.targetsOf = g.targets; st.tries = {}; }
        const tries = st.tries[t.id] || 0; // after misses (a curving throw hits a tree), step closer
        const a = throwAt(t.x, t.z, Math.max(2.2, 6 - 1.5 * Math.floor(tries / 2)));
        if (a.fire) st.tries[t.id] = tries + 1;
        return a;
      }
      case 'collect': { const it = near(g.items.filter((x) => !x.taken)); return it ? { move: walkTo(it.x, it.z, 0.2) } : {}; }
      case 'reach': { const at = g.reach || g.gates.find((x) => x.id === step.gate); return at ? { move: walkTo(at.x, at.z, 0.2) } : {}; }
      case 'clear': { const c = near(g.camps.filter((x) => !x.cleared)); return c ? { move: walkTo(c.x, c.z, 3) } : {}; }
      case 'protect': return g.object ? { move: walkTo(g.object.x + 1.6, g.object.z + 1.6, 0.6) } : {};
      default: return {};
    }
  };
}

// Plays the current zone until `done(g)` or the time runs out. Returns the event types seen.
export function play(g, seconds, done) {
  const act = makeBot(g), seen = [];
  for (let i = 0; i < seconds / DT && !done(g); i++) {
    stepWorld(g, DT, act());
    for (const e of g.events) seen.push(e.type);
    g.events.length = 0;
  }
  return seen;
}
