// Economy bot for «Рикошет»: plays the real pure simulation (/home/user/Www/src/game.js, read-only import)
// at a skill k in [0, 1] (0 = sloppy beginner, 1 = good player) and reports score + timing per run.
import { createGame, step, result, choosePerk } from '../../../src/game.js';
import { HEROES } from '../../../src/heroes.js';
import { solidContact } from '../../../src/solid.js';

const DEG = Math.PI / 180;
const DT = 1 / 60;

// Skill knobs. Sloppy: aims at the nearest skeleton with ~12° error, slow to throw, dodges only what is
// close, steers with a noisy thumb, random perks, never tries to catch. Good: 2.5° error, leads targets,
// lines up combos, catches the ricochet, takes the perks in a sensible order.
export function profile(k) {
  const L = (a, b) => a + (b - a) * k;
  return {
    k,
    aimSigma: L(12, 2.5) * DEG,
    distNoise: L(0.15, 0.05),
    react: L(0.8, 0.3),          // s from "projectile in hand" to the throw
    replan: L(0.3, 0.08),        // s between stick decisions
    space: L(0, 0.3),            // weight of 'end up in open space' when dodging
    awareness: L(6, 10),         // m: farther skeletons are ignored when dodging
    stickNoise: L(20, 0) * DEG,
    pSmart: k,                   // chance a throw is a lined-up combo/cluster shot (else: nearest enemy)
    pLead: k,                    // chance the aim leads a moving target
    pCatch: k,                   // chance to go for a catch when the ricochet comes back
    pPerk: k,                    // chance to take perks by priority (else random)
    horizon: k >= 0.5 ? [0.25, 0.5, 0.75, 1.0] : [0.25, 0.5],
    orbitRange: L(5, 3.5),
  };
}

function rngOf(str) {
  let a = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { a ^= str.charCodeAt(i); a = Math.imul(a, 16777619); }
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DIRS = [...Array(16)].map((_, i) => [Math.cos((i * Math.PI) / 8), Math.sin((i * Math.PI) / 8)]).concat([[0, 0]]);
const PSPEED = { ricochet: 18, boomerang: 13, snake: 14, spiral: 15, lightning: 20, orbit: 0, blackhole: 12 };
const PRIORITY = ['shield', 'magnet', 'size', 'speed', 'reach', 'shotSpeed', 'bounce'];

function planMove(g, bot, prof) {
  const h = g.hero, p = g.projectile, { W, D } = g.arena;
  const speed = 5.2 * (1 + 0.12 * g.mods.speed);
  const tau = 1 / (g.loc.rule.friction || 14); // velocity response time (ice: ~0.6 s)
  const near = [];
  for (const e of g.enemies) if (!e.dead && Math.hypot(e.x - h.x, e.z - h.z) < prof.awareness) near.push(e);
  let goal = null, goalW = 0, goalV = null;
  const dHero = Math.hypot(p.x - h.x, p.z - h.z);
  if (p.state === 'dropped') { goal = p; goalW = 3; }
  else if (p.state === 'flying' && bot.catching && p.t > 0.1 && dHero < 6 && (p.vx * (h.x - p.x) + p.vz * (h.z - p.z)) > 0) {
    goal = p; goalW = 2.2; goalV = { x: p.vx, z: p.vz };
  } else if (!near.length) { goal = { x: 0, z: 1 }; goalW = 0.5; }
  const hz = prof.horizon, Tend = hz[hz.length - 1];
  const d0 = goal ? Math.hypot(goal.x - h.x, goal.z - h.z) : 0;
  let best = DIRS[16], bestS = -Infinity;
  for (const [ux, uz] of DIRS) {
    // Walk the hero forward along this stick direction in 0.05 s steps, with the same velocity response
    // and solid push-out as the sim, so rocks and fences that would block it are seen.
    let minClear = 9, gMin = d0, px = h.x, pz = h.z, vx = h.vx, vz = h.vz, t = 0, hi = 0;
    const kv = Math.min(1, 0.05 / tau);
    while (hi < hz.length) {
      vx += (ux * speed - vx) * kv; vz += (uz * speed - vz) * kv;
      px = clamp(px + vx * 0.05, -W + h.r, W - h.r); pz = clamp(pz + vz * 0.05, -D + h.r, D - h.r);
      for (const o of g.solids) { const c = solidContact(o, px, pz, h.r); if (c) { px += c.nx * c.pen; pz += c.nz * c.pen; } }
      t += 0.05;
      if (t + 1e-9 < hz[hi]) continue;
      const T = hz[hi++];
      const wT = T <= 0.5 ? 1 : T <= 1 ? 0.6 : 0.35; // later horizons matter less
      for (const e of near) {
        const tm = Math.max(0, T - e.rise);
        const d = Math.hypot(px - e.x, pz - e.z);
        const clear = (d - Math.min(d, e.speed * tm) - (e.r + h.r)) / wT + (wT < 1 ? 1.2 * (1 - wT) : 0);
        if (clear < minClear) minClear = clear;
      }
      if (goal) {
        const gx = goalV ? goal.x + goalV.x * T : goal.x, gz = goalV ? goal.z + goalV.z * T : goal.z;
        gMin = Math.min(gMin, Math.hypot(gx - px, gz - pz));
      }
    }
    const ex = px, ez = pz;
    let s = 0;
    if (minClear < 1.2) s -= 8 * (1.2 - minClear) ** 2;
    if (minClear < 0) s -= 10;
    const wd = Math.min(W - Math.abs(ex), D - Math.abs(ez));
    const wx = W - Math.abs(ex), wz = D - Math.abs(ez);
    if (near.length) s -= Math.max(0, 2 - wd) * 0.6 + (wx < 2 && wz < 2 ? 1.5 : 0); // corners are traps
    let ttc = 9;
    for (const e of near) ttc = Math.min(ttc, Math.max(0, Math.hypot(ex - e.x, ez - e.z) - e.r - h.r) / Math.max(0.5, e.speed) + Math.max(0, e.rise - Tend));
    s += prof.space * Math.min(3, ttc);
    let crowd = 0;
    for (const e of near) crowd += 1 / Math.max(1, Math.hypot(ex - e.x, ez - e.z));
    s -= crowd * 0.5;
    if (goal) {
      const maxProg = goalV ? Math.max(0.5, Math.min(d0, speed * Tend)) : Math.min(d0, speed * Tend);
      if (maxProg > 0.05) s += (goalW * (d0 - gMin)) / maxProg;
    }
    if (s > bestS) { bestS = s; best = [ux, uz]; }
  }
  if (prof.stickNoise && (best[0] || best[1])) {
    const a = Math.atan2(best[1], best[0]) + gauss(bot.rng) * prof.stickNoise;
    best = [Math.cos(a), Math.sin(a)];
  }
  return { x: best[0], z: best[1] };
}

function predicted(e, h, t) {
  if (e.rise > t) return { x: e.x, z: e.z };
  const tm = t - Math.max(0, e.rise);
  const dx = h.x - e.x, dz = h.z - e.z, d = Math.hypot(dx, dz) || 1;
  const s = Math.min(d - 0.8, e.speed * tm);
  return { x: e.x + (dx / d) * Math.max(0, s), z: e.z + (dz / d) * Math.max(0, s) };
}

function chooseTarget(g, prof, smart, lead) {
  const h = g.hero, w = g.weapon.id;
  const alive = g.enemies.filter((e) => !e.dead);
  if (!alive.length) return null;
  const dist = (e) => Math.hypot(e.x - h.x, e.z - h.z);
  alive.sort((a, b) => dist(a) - dist(b));
  const nearest = alive[0];
  if (w === 'orbit') { // the fire orbit circles the hero: throw when skeletons are close
    const active = alive.filter((e) => e.rise < 0.4);
    if (!active.length) return null;
    const close = active.filter((e) => dist(e) - e.r - h.r < 6);
    const go = dist(active[0]) - active[0].r - h.r < prof.orbitRange || (smart && close.length >= 3);
    return go ? { x: active[0].x, z: active[0].z } : null;
  }
  if (!smart) {
    const pt = lead ? predicted(nearest, h, dist(nearest) / (PSPEED[w] || 15)) : nearest;
    return { x: pt.x, z: pt.z };
  }
  const size = 1 + 0.35 * g.mods.size;
  let best = null, bestS = -Infinity;
  for (const e of alive.slice(0, 14)) {
    const d = dist(e);
    const tf = w === 'blackhole' ? d / (12 * (1 + 0.2 * g.mods.shotSpeed)) + 0.8 : w === 'spiral' ? d / 15 + 0.5 : d / (PSPEED[w] || 15);
    const pt = lead ? predicted(e, h, tf) : { x: e.x, z: e.z };
    let s = 0;
    if (w === 'blackhole' || w === 'spiral') {
      const R = w === 'blackhole' ? 3 * size + 0.4 : 3;
      for (const o of alive) {
        const q = predicted(o, h, tf);
        const dd = Math.hypot(q.x - pt.x, q.z - pt.z);
        if (dd < R) s += 1; else if (w === 'blackhole' && dd < 4 * size) s += 0.4;
      }
      if (d < 3) s -= 1.5; // too close: it would pull them onto the hero
      s -= d * 0.04;
    } else if (w === 'lightning') {
      const hit = new Set([e.id]); let cur = e, n = 1;
      while (n < 6) {
        let nb = null, nd = 5;
        for (const o of alive) if (!hit.has(o.id)) { const dd = Math.hypot(o.x - cur.x, o.z - cur.z); if (dd < nd) { nd = dd; nb = o; } }
        if (!nb) break; hit.add(nb.id); cur = nb; n++;
      }
      s = n - d * 0.05;
    } else { // ricochet / snake / boomerang: skeletons along the line through the target
      const dx = (pt.x - h.x) / (d || 1), dz = (pt.z - h.z) / (d || 1);
      const half = w === 'snake' ? 1.6 : w === 'boomerang' ? 1.2 : 0.75;
      for (const o of alive) {
        const ox = o.x - h.x, oz = o.z - h.z, along = ox * dx + oz * dz;
        if (along < 0 || along > 16) continue;
        if (Math.abs(ox * dz - oz * dx) < half) s += 1;
      }
      s -= d * 0.06;
      if (e.rise > 0) s -= 0.3;
    }
    if (s > bestS) { bestS = s; best = { x: pt.x, z: pt.z }; }
  }
  return best;
}

function perkPick(options, g, bot, prof) {
  if (bot.rng() >= prof.pPerk) return options[Math.floor(bot.rng() * options.length)];
  const pr = PRIORITY.filter((id) => !(g.weapon.id === 'boomerang' && (id === 'magnet' || id === 'reach')) && !(g.weapon.id === 'orbit' && id === 'shotSpeed'));
  for (const id of pr) if (options.includes(id)) return id;
  return options[0];
}

// One run until death (or a cap). Returns the score/wave plus an estimate of the real seconds it takes
// on the phone: sim time + hit-stops/slow-mo + perk screen (0.9 s delay + ~2.5 s to pick) + death
// slow-mo (1.4 s) + ~5 s on the "Забег окончен" screen before «Ещё раз».
export function runBot({ heroId, seed, loc, k, maxTime = 1800, stopWave = 60, tag = '', onStep = null, over = null }) {
  const prof = { ...profile(k), ...over };
  const hero = HEROES.find((x) => x.id === heroId);
  const g = createGame({ seed, locationId: loc, weaponId: hero.weapon, heroId });
  const bot = { rng: rngOf(`${seed}|${heroId}|${loc}|${k}|${tag}`), heldT: 0, mv: { x: 0, z: 0 }, planT: 0, catching: false };
  const st = { hero: heroId, loc, k, seed, shots: 0, kills: 0, catches: 0, combo4: 0, explodes: 0, shields: 0, perkPicks: 0, killPts: 0, bonusPts: 0, multPts: 0, cleared: 0 };
  let prevState = 'held';
  while (!g.over && g.time < maxTime && g.wave < stopWave) {
    if (g.choosing) { choosePerk(g, perkPick(g.choosing, g, bot, prof)); st.perkPicks++; continue; }
    bot.planT -= DT;
    if (bot.planT <= 0) { bot.mv = planMove(g, bot, prof); bot.planT = prof.replan; }
    let fire = null;
    const p = g.projectile;
    if (p.state === 'held') {
      bot.heldT += DT;
      if (bot.heldT >= prof.react) {
        const smart = bot.rng() < prof.pSmart, lead = bot.rng() < prof.pLead;
        const tg = chooseTarget(g, prof, smart, lead);
        if (tg) {
          const h = g.hero;
          const a = Math.atan2(tg.z - h.z, tg.x - h.x) + gauss(bot.rng) * prof.aimSigma;
          const dist = Math.max(1.2, Math.hypot(tg.x - h.x, tg.z - h.z) * (1 + gauss(bot.rng) * prof.distNoise));
          fire = { x: h.x + Math.cos(a) * dist, z: h.z + Math.sin(a) * dist };
          bot.catching = g.weapon.catchable && ['ricochet', 'snake', 'lightning'].includes(g.weapon.id) && bot.rng() < prof.pCatch;
        }
      }
    } else bot.heldT = 0;
    step(g, DT, { move: bot.mv, fire });
    if (onStep) onStep(g, bot);
    for (const ev of g.events) {
      if (ev.type === 'shoot') st.shots++;
      else if (ev.type === 'kill') { st.kills++; st.killPts += ev.points; if (ev.combo === 4) st.combo4++; if (g.shotMult > 1) st.multPts += ev.points / 2; }
      else if (ev.type === 'catch') st.catches++;
      else if (ev.type === 'explode') st.explodes++;
      else if (ev.type === 'shield') st.shields++;
      else if (ev.type === 'waveClear') { st.cleared = ev.wave; st.bonusPts += ev.bonus; }
    }
    g.events.length = 0;
    if (g.projectile.state !== prevState) prevState = g.projectile.state;
  }
  const r = result(g);
  const extra = 0.04 * st.kills + 0.15 * st.combo4 + 0.08 * st.explodes + 0.09 * st.shields
    + st.cleared * 0.315 + st.perkPicks * (0.9 + 2.5) + 1.4 + 5;
  return { ...st, score: r.score, wave: r.wave, combo: r.combo, simTime: +g.time.toFixed(1), realTime: +(g.time + extra).toFixed(1), capped: !g.over };
}
