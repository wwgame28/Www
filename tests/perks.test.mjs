import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERKS, blankMods, offerPerks, applyPerk } from '../src/perks.js';
import { launch, stepProjectile, previewPath } from '../src/weapons.js';
import { ARENA } from '../src/locations.js';
import { createGame, step, choosePerk } from '../src/game.js';

const DT = 1 / 60;
const world = (hero) => ({ arena: ARENA, solids: [], enemies: [], hero, rule: {} });

test('perk offers are deterministic, unique and respect weapon and max level', () => {
  const m = blankMods();
  const a = offerPerks('s', 2, m, 'ricochet'), b = offerPerks('s', 2, m, 'ricochet');
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 3);
  for (let w = 1; w < 30; w++) assert.ok(!offerPerks('s', w, m, 'orbit').includes('bounce'), 'no bounce perk for orbit');
  for (const p of PERKS) for (let i = 0; i < 5; i++) applyPerk(m, p.id);
  assert.ok(PERKS.every((p) => m[p.id] === p.max));
  assert.deepEqual(offerPerks('s', 3, m, 'ricochet'), []);
});

test('+1 bounce perk adds a bounce to the ricochet', () => {
  const count = (mods) => {
    const p = launch('ricochet', { x: 0, z: 0 }, { x: 1, z: 0.3 }, mods);
    let n = 0;
    while (p.state === 'flying') { stepProjectile(p, DT, world({ x: 0, z: 0 })); n += p.events.length; p.events.length = 0; }
    return n;
  };
  assert.equal(count({}), 4);
  assert.equal(count({ bounce: 1 }), 5);
});

test('size and speed perks scale the projectile', () => {
  const p = launch('ricochet', { x: 0, z: 0 }, { x: 0, z: -5 }, { size: 2, shotSpeed: 1 });
  assert.ok(Math.abs(p.r - 0.3 * 1.7) < 1e-9);
  assert.ok(Math.abs(Math.hypot(p.vx, p.vz) - 18 * 1.2) < 1e-9);
});

test('aim preview follows the real trajectory', () => {
  const hero = { x: 0, z: 3 }, target = { x: 2, z: -4 };
  const path = previewPath('ricochet', hero, target, world(hero));
  const p = launch('ricochet', hero, target);
  for (let i = 0; i < 40; i++) stepProjectile(p, DT, world(hero));
  const pt = path[20]; // every 2nd step is sampled: index 20 ≈ step 40
  assert.ok(Math.hypot(pt.x - p.x, pt.z - p.z) < 1e-9);
  assert.ok(path.length > 10);
});

test('clearing a wave pauses for a perk choice; picking applies it and resumes', () => {
  const g = createGame({ seed: 'p', locationId: 'forest', weaponId: 'ricochet' });
  for (let i = 0; i < 60; i++) step(g, DT, {});
  g.queue = []; g.enemies.forEach((e) => (e.dead = true));
  step(g, DT, {});
  assert.equal(g.choosing.length, 3);
  const t = g.time;
  step(g, DT, {});
  assert.equal(g.time, t, 'game is paused while choosing');
  assert.equal(choosePerk(g, 'nope'), false);
  const pick = g.choosing[0];
  assert.equal(choosePerk(g, pick), true);
  assert.equal(g.mods[pick], 1);
  assert.equal(g.choosing, null);
  for (let i = 0; i < 120; i++) step(g, DT, {});
  assert.equal(g.wave, 2);
});

test('shield absorbs one touch and destroys the attacker', () => {
  const g = createGame({ seed: 'p', locationId: 'forest', weaponId: 'ricochet' });
  g.breakT = 99; g.mods.shield = 1;
  g.enemies.push({ id: 7, type: 'grunt', x: g.hero.x, z: g.hero.z + 0.3, r: 0.4, hp: 1, speed: 1, dead: false, hurtT: 0 });
  step(g, DT, {});
  assert.equal(g.over, false);
  assert.equal(g.enemies[0].dead, true);
  assert.equal(g.mods.shield, 0);
});

test('magnet pulls a dropped projectile toward the hero', () => {
  const g = createGame({ seed: 'p', locationId: 'forest', weaponId: 'ricochet' });
  g.breakT = 99; g.solids = []; g.mods.magnet = 1;
  g.projectile = { state: 'dropped', x: g.hero.x + 3, z: g.hero.z, vx: 0, vz: 0, hits: new Set(), events: [] };
  for (let i = 0; i < 90; i++) step(g, DT, {});
  assert.equal(g.projectile.state, 'held');
});
