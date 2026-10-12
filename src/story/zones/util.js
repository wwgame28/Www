// Helpers for laying out zones: deterministic scatters that keep paths and quest spots clear.
import { createRng } from '../../rng.js';

// Circles to keep clear along road polylines (every 2 m), plus explicit spots [[x, z, r]].
export function clearOf(roads = [], spots = [], r = 2.6) {
  const out = spots.map(([x, z, rr = 3]) => [x, z, rr]);
  for (const line of roads) {
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1], [bx, bz] = line[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
      for (let k = 0; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, r]);
    }
  }
  return out;
}

// `count` props picked from `models` ([name, size, shape, opts?]) inside the box [x0, z0, x1, z1],
// away from `avoid` circles and from each other (gap). Seeded: the same seed gives the same layout.
export function scatter(seed, models, count, [x0, z0, x1, z1], avoid = [], gap = 2.4) {
  const rng = createRng(seed), out = [], placed = [];
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const x = rng.range(x0, x1), z = rng.range(z0, z1);
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    if (placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < gap)) continue;
    const [m, size, shape, opts] = rng.pick(models);
    out.push(opts ? [m, +x.toFixed(2), +z.toFixed(2), Math.round(rng.range(0, 360)), size, shape, opts] : [m, +x.toFixed(2), +z.toFixed(2), Math.round(rng.range(0, 360)), size, shape]);
    placed.push([x, z]);
  }
  return out;
}

// A belt of scenery (no colliders) just outside the playable square: [model, x, z, rot, size].
export function belt(seed, models, half, { gap = 7, depth = 6, skip = [] } = {}) {
  const rng = createRng(seed), out = [];
  for (const side of ['n', 's', 'e', 'w']) {
    for (let u = -half - 4; u <= half + 4; u += gap * (0.8 + 0.4 * rng.next())) {
      const d = half + 2 + rng.next() * depth;
      const [x, z] = side === 'n' ? [u, -d] : side === 's' ? [u, d] : side === 'e' ? [d, u] : [-d, u];
      if (skip.some(([sx, sz, sr]) => Math.hypot(x - sx, z - sz) < sr)) continue;
      const [m, size] = rng.pick(models);
      out.push([m, +x.toFixed(1), +z.toFixed(1), Math.round(rng.range(0, 360)), size]);
    }
  }
  return out;
}
