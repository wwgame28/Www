// Biome hazards of the open world, driven by the zone's data: areas (circles {x, z, r} or
// rectangles {x, z, w, d}), the climate (cold or heat) and rockfall. Pure functions over the world
// state of world.js; deterministic (rockfall uses the world's seeded rng).

export const inArea = (a, x, z) => (a.r !== undefined ? Math.hypot(x - a.x, z - a.z) < a.r : Math.abs(x - a.x) < a.w / 2 && Math.abs(z - a.z) < a.d / 2);

// How the ground under a walker moves it: a speed factor (water, drifts, quicksand, webs) and the
// friction of the velocity smoothing (low on ice: the walker slides).
export function ground(g, x, z) {
  let slow = 1, friction = 14;
  for (const a of g.areas) {
    if (!inArea(a, x, z)) continue;
    if (a.kind === 'water' || a.kind === 'drift' || a.kind === 'quicksand' || a.kind === 'web') slow = Math.min(slow, a.slow ?? { water: 0.55, drift: 0.7, quicksand: 0.5, web: 0.45 }[a.kind]);
    else if (a.kind === 'ice') friction = Math.min(friction, a.friction ?? 1.4);
  }
  return { slow, friction };
}

// A gusting area (waves, wind) is active during the last `on` seconds of every `period`, and warns
// `warn` seconds before that.
export function gust(a, t) {
  const ph = (((t + (a.phase || 0)) % a.period) + a.period) % a.period, start = a.period - a.on;
  return { active: ph >= start, warning: ph >= start - (a.warn ?? 1) && ph < start };
}

// Extra velocity (m/s) on a body at (x, z): gusts push along their direction, gravity wells and
// quicksand pull toward their middle. `who`: 'hero' | 'shot' | 'foe' (wind blows thrown weapons more).
export function drift(g, x, z, who) {
  let vx = 0, vz = 0;
  for (const a of g.areas) {
    if (a.kind === 'push') {
      if (!inArea(a, x, z) || !gust(a, g.time).active) continue;
      const k = a.strength * (who === 'shot' ? (a.shot ?? 1.4) : who === 'foe' ? 0.5 : 1);
      vx += a.dir[0] * k; vz += a.dir[1] * k;
    } else if (a.kind === 'pull' || a.kind === 'quicksand') {
      const dx = a.x - x, dz = a.z - z, d = Math.hypot(dx, dz);
      if (d > a.r || d < 0.05) continue;
      const k = (a.strength ?? (a.kind === 'pull' ? 3 : 1.6)) * (who === 'shot' ? (a.kind === 'pull' ? 2.5 : 0) : 1) * (0.35 + 0.65 * (1 - d / a.r));
      vx += (dx / d) * k; vz += (dz / d) * k;
    }
  }
  return { vx, vz };
}

// Stone rings in pairs: a body stepping into one leaves the other, a little ahead along its motion.
// Returns true when it jumped (each body waits `b.portalT` before the next jump).
export function portalJump(g, b, vx, vz) {
  if ((b.portalT || 0) > g.time) return false;
  for (const p of g.areas) {
    if (p.kind !== 'portal') continue;
    for (const [from, to] of [[p.a, p.b], [p.b, p.a]]) {
      if (Math.hypot(b.x - from[0], b.z - from[1]) > (p.r || 0.9)) continue;
      const l = Math.hypot(vx, vz) || 1;
      b.x = to[0] + (vx / l) * ((p.r || 0.9) + 0.6); b.z = to[1] + (vz / l) * ((p.r || 0.9) + 0.6);
      b.portalT = g.time + 0.8;
      g.events.push({ type: 'portal', x: to[0], z: to[1], fx: from[0], fz: from[1] });
      return true;
    }
  }
  return false;
}

// Warm spots for the climate: 'warm' areas (fires, shade, the oasis), the campfire, lit lanterns.
export function isWarm(g, x, z) {
  if (Math.hypot(g.campfire.x - x, g.campfire.z - z) < 4) return true;
  if (g.areas.some((a) => a.kind === 'warm' && inArea(a, x, z))) return true;
  return g.lights.some((l) => Math.hypot(l.x - x, l.z - z) < (l.warm ?? 0));
}

// Cold (snow) or heat (desert): g.temp grows away from warm spots and falls near them; when full it
// costs a heart every few seconds. Returns true when it hurt.
export function stepClimate(g, dt) {
  const c = g.area.climate;
  if (!c) return false;
  const warm = isWarm(g, g.hero.x, g.hero.z);
  g.temp = Math.max(0, Math.min(1, g.temp + (warm ? -(c.recover ?? 0.25) : c.rate) * dt));
  if (g.temp < 1) { g.climateT = 0; return false; }
  g.climateT += dt;
  if (g.climateT < (c.every ?? 3)) return false;
  g.climateT = 0;
  return true;
}

// Rockfall (mountains): every `every` seconds a shadow appears near the hero, the rock lands
// `fall` seconds later. Returns the rocks that landed this step: [{ x, z, r }].
export function stepRockfall(g, dt) {
  const rf = g.rockfall;
  if (!rf) return [];
  const landed = [];
  for (const r of g.rocks) {
    r.t -= dt;
    if (r.t <= 0) landed.push(r);
  }
  g.rocks = g.rocks.filter((r) => r.t > 0);
  if (!rf.rect || inArea(rf.rect, g.hero.x, g.hero.z)) {
    g.rockT -= dt;
    if (g.rockT <= 0) {
      g.rockT = rf.every * (0.7 + 0.6 * g.rng.next());
      const a = g.rng.range(0, Math.PI * 2), d = g.rng.range(0, 2.5);
      const lead = 0.6; // aims a little where the hero is running
      const rock = { x: g.hero.x + g.hero.vx * lead + Math.cos(a) * d, z: g.hero.z + g.hero.vz * lead + Math.sin(a) * d, r: 1.3, t: rf.fall ?? 1.2 };
      g.rocks.push(rock);
      g.events.push({ type: 'rockWarn', x: rock.x, z: rock.z, r: rock.r, t: rock.t });
    }
  }
  return landed;
}
