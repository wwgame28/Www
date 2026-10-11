// A solid is a rounded box: center x/z, rotation rot (same sense as three.js rotation.y), core
// half-sizes hx/hz and rounding radius r. hx = hz = 0 is a circle; one of them 0 is a capsule (a wall,
// a car, a fence). Returns the push-out normal and depth for a circle of radius pr at (px, pz), or
// null when they don't touch.
export function solidContact(o, px, pz, pr) {
  const dx = px - o.x, dz = pz - o.z;
  if (!o.hx && !o.hz) {
    const d = Math.hypot(dx, dz), min = o.r + pr;
    return d < min && d > 1e-6 ? { nx: dx / d, nz: dz / d, pen: min - d } : null;
  }
  const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0);
  const lx = dx * c - dz * s, lz = dx * s + dz * c; // world → local
  const hx = o.hx || 0, hz = o.hz || 0;
  const qx = Math.max(-hx, Math.min(hx, lx)), qz = Math.max(-hz, Math.min(hz, lz));
  let ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
  if (d >= o.r + pr) return null;
  if (d < 1e-6) { // center inside the core: leave through the nearest face
    if (hx - Math.abs(lx) < hz - Math.abs(lz)) { ex = Math.sign(lx) || 1; ez = 0; d = -(hx - Math.abs(lx)); }
    else { ex = 0; ez = Math.sign(lz) || 1; d = -(hz - Math.abs(lz)); }
  } else { ex /= d; ez /= d; }
  return { nx: ex * c + ez * s, nz: -ex * s + ez * c, pen: o.r + pr - d }; // local → world
}

// Distance from a solid's center to its farthest edge (for quick rejects and fading).
export const solidExtent = (o) => Math.max(o.hx || 0, o.hz || 0) + o.r;
