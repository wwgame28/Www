import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../src/game.js';
import { solidContact } from '../src/solid.js';

const DT = 1 / 60;
const grunt = (g, x, z) => { const e = { id: g.nextId++, type: 'grunt', model: 'Skeleton_Minion', x, z, r: 0.4, hp: 1, speed: 0, dead: false, facing: 0, hurtT: 0, rise: 0 }; g.enemies.push(e); return e; };
// A game in wave 1 with no spawns left and nothing on the field.
function quiet(seed = 'mech', weaponId = 'ricochet') {
  const g = createGame({ seed, locationId: 'forest', weaponId });
  while (g.wave === 0) step(g, DT);
  g.queue.length = 0; g.enemies.length = 0; g.events.length = 0;
  grunt(g, g.arena.W - 1, g.arena.D - 1); // a far, still skeleton keeps the wave going (no perk pause)
  return g;
}
const runUntil = (g, f, n = 600) => { const seen = []; for (let i = 0; i < n && !f(seen); i++) { step(g, DT); seen.push(...g.events); g.events.length = 0; } return seen; };

test('a kill after bounces is a trick shot worth more', () => {
  const g = quiet();
  g.zone = null; g.solids = [];
  const e = grunt(g, g.hero.x, g.hero.z - 4);
  step(g, DT, { fire: { x: e.x, z: e.z } });
  g.projectile.banks = 2; // as if it had bounced twice on the way
  const kill = runUntil(g, (s) => s.some((v) => v.type === 'kill')).find((v) => v.type === 'kill');
  assert.deepEqual(kill.tricks, ['Рикошет ×2']);
  assert.equal(kill.points, 30, '(10 + 2×10) × 1');
});

test('bounces off a wall are counted for the trick bonus', () => {
  const g = quiet();
  g.solids = [];
  step(g, DT, { fire: { x: g.hero.x, z: -20 } });
  runUntil(g, (s) => s.some((v) => v.type === 'bounce'));
  assert.ok(g.projectile.banks >= 1);
});

test('the golden zone sits on a free spot and triples a kill inside it', () => {
  const g = quiet('zone');
  const z = g.zone;
  assert.ok(z && z.r === 2);
  assert.ok(Math.abs(z.x) <= g.arena.W - z.r && Math.abs(z.z) <= g.arena.D - z.r, 'inside the arena');
  assert.ok(!g.solids.some((o) => solidContact(o, z.x, z.z, 0.8)), 'not inside a solid');
  assert.ok(Math.hypot(z.x - g.hero.x, z.z - g.hero.z) >= 3.5, 'not under the hero');
  g.solids = [];
  g.hero.x = z.x; g.hero.z = z.z + 5; // stand 5 m from the zone center and shoot into it
  const e = grunt(g, z.x, z.z);
  step(g, DT, { fire: { x: e.x, z: e.z } });
  const kill = runUntil(g, (s) => s.some((v) => v.type === 'kill')).find((v) => v.type === 'kill');
  assert.ok(kill.tricks.includes('Золото ×3'));
  assert.equal(kill.points, 30);
  const next = createGame({ seed: 'zone', locationId: 'forest', weaponId: 'ricochet' });
  while (next.wave < 2) { step(next, DT); next.queue.length = 0; next.enemies.forEach((x) => { x.dead = true; }); if (next.choosing) next.choosing = null; }
  assert.notDeepEqual(next.zone, z, 'the zone moves every wave');
});

test('recall flies the dropped projectile back through enemies, then cools down', () => {
  const g = quiet('recall');
  g.zone = null; g.solids = [];
  const p = g.projectile;
  p.state = 'dropped'; p.x = g.hero.x; p.z = g.hero.z - 8; p.vx = p.vz = 0;
  grunt(g, g.hero.x, g.hero.z - 4);
  step(g, DT, { recall: true });
  assert.equal(g.projectile.state, 'flying');
  assert.equal(g.recallT > 5.9, true);
  const seen = runUntil(g, () => g.projectile.state === 'held');
  assert.ok(seen.some((v) => v.type === 'kill'), 'hit the skeleton on the way back');
  assert.ok(seen.some((v) => v.type === 'return'));
  assert.equal(g.pendingMult, 1, 'a recall is not a catch');
  g.projectile.state = 'dropped'; g.projectile.x = g.hero.x + 5;
  step(g, DT, { recall: true });
  assert.equal(g.projectile.state, 'dropped', 'still cooling down');
});
