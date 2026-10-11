// Soft lock for the third-person fire button: the enemy nearest the crosshair direction, if it is
// close to the center of the view and nothing solid stands in between. Pure, so it is unit-tested.

const MIN_D = 1, MAX_D = 16;
const CONE = (10 * Math.PI) / 180;      // half-angle of the lock cone…
const CONE_NEAR = (16 * Math.PI) / 180; // …wider for enemies closer than 4 m
const STICKY = 1.4;                     // a new target must score 1.4× better to steal the lock

function clearLine(a, b, solids) {
  const bx = b.x - a.x, bz = b.z - a.z, l2 = bx * bx + bz * bz || 1;
  for (const o of solids) {
    const t = Math.max(0, Math.min(1, ((o.x - a.x) * bx + (o.z - a.z) * bz) / l2));
    if (Math.hypot(a.x + bx * t - o.x, a.z + bz * t - o.z) < o.r) return false;
  }
  return true;
}

// dir: unit view direction on the ground; visible(e): is the enemy on screen.
export function pickTarget(hero, dir, enemies, solids, prevId = null, visible = () => true) {
  const heading = Math.atan2(dir.x, dir.z);
  let best = null, bestScore = Infinity, prev = null, prevScore = Infinity;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - hero.x, dz = e.z - hero.z, d = Math.hypot(dx, dz);
    if (d < MIN_D || d > MAX_D) continue;
    const a = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - heading), Math.cos(Math.atan2(dx, dz) - heading)));
    const cone = d < 4 ? CONE_NEAR : CONE;
    if (a > cone || !clearLine(hero, e, solids) || !visible(e)) continue;
    const score = a / cone + (0.35 * d) / MAX_D;
    if (e.id === prevId) { prev = e; prevScore = score; }
    if (score < bestScore) { best = e; bestScore = score; }
  }
  return prev && bestScore * STICKY >= prevScore ? prev : best;
}
