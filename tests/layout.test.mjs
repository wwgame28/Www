import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS, ARENA, layoutFor } from '../src/locations.js';
import { solidContact } from '../src/solid.js';
import { createGame, step } from '../src/game.js';

const { W, D } = ARENA;

test('layouts keep the start clear, stay inside the walls and leave the spawn lanes open', () => {
  for (const loc of LOCATIONS) {
    const { solids } = layoutFor(loc);
    assert.ok(solids.length >= 8, `${loc.id} has obstacles`);
    for (const o of solids) {
      assert.equal(solidContact(o, 0, 3, 2.6), null, `${loc.id}: ${o.model} crowds the start`);
      const c = Math.abs(Math.cos(o.rot)), s = Math.abs(Math.sin(o.rot)), hx = o.hx || 0, hz = o.hz || 0;
      assert.ok(Math.abs(o.x) + hx * c + hz * s + o.r <= W && Math.abs(o.z) + hx * s + hz * c + o.r <= D, `${loc.id}: ${o.model} pokes through a wall`);
    }
    let blocked = 0, n = 0; // walkers rise 0.9 m inside each wall
    for (let i = 0; i <= 40; i++) {
      const t = -0.9 + (1.8 * i) / 40;
      for (const [x, z] of [[t * W, -D + 0.9], [t * W, D - 0.9], [-W + 0.9, t * D], [W - 0.9, t * D]]) {
        n++;
        if (solids.some((o) => solidContact(o, x, z, 0.4))) blocked++;
      }
    }
    assert.ok(blocked / n < 0.1, `${loc.id}: ${((100 * blocked) / n).toFixed(0)}% of spawn spots inside a solid`);
  }
});

test('walkers get round every layout to the hero (nobody stays stuck behind a wall)', () => {
  for (const loc of LOCATIONS) {
    const { solids } = layoutFor(loc);
    for (const [hx, hz] of [[0, 3], [0, -6], [-5, -9], [5, 9], [-6.5, 0]]) {
      if (solids.some((o) => solidContact(o, hx, hz, 0.45))) continue;
      for (const [x, z] of [[0, -D + 0.9], [-W + 0.9, 0], [W - 0.9, -6], [4, D - 0.9], [-4, -D + 0.9]]) {
        const g = createGame({ seed: 's', locationId: loc.id, weaponId: 'ricochet' });
        g.breakT = 99; g.hero.x = hx; g.hero.z = hz;
        g.enemies.push({ id: 1, type: 'grunt', model: 'm', x, z, r: 0.4, hp: 1, speed: 1.6, flying: false, dead: false, facing: 0, hurtT: 0, rise: 0 });
        for (let t = 0; t < 40 && !g.over; t += 1 / 60) step(g, 1 / 60, {});
        assert.ok(g.over, `${loc.id}: a walker from (${x}, ${z}) never reached the hero at (${hx}, ${hz})`);
      }
    }
  }
});

test('a projectile bounces off a box face like a mirror', () => {
  const g = createGame({ seed: 'b', locationId: 'forest', weaponId: 'ricochet' });
  g.solids = [{ x: 0, z: -4, rot: 0, r: 0.06, hx: 2, hz: 0.3 }];
  g.breakT = 99;
  step(g, 1 / 60, { fire: { x: 0, z: -10 } });
  let back = false;
  for (let i = 0; i < 60; i++) { step(g, 1 / 60); if (g.projectile.vz > 0) { back = true; break; } }
  assert.ok(back, 'shot straight at the box comes straight back');
  assert.ok(Math.abs(g.projectile.vx) < 1e-6);
});
