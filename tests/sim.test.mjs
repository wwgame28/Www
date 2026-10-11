import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, hashString, todayKey } from '../src/rng.js';
import { planWave } from '../src/waves.js';
import { WEAPONS, launch, stepProjectile, PROJECTILE_R } from '../src/weapons.js';
import { ARENA, LOCATIONS, layoutFor } from '../src/locations.js';
import { createGame, step } from '../src/game.js';
import { encodeChallenge, decodeChallenge, challengeFromHash, challengeUrl } from '../src/share.js';
import { record, load, save } from '../src/progress.js';

const DT = 1 / 60;
const emptyWorld = (hero = { x: 0, z: 3 }) => ({ arena: ARENA, solids: [], enemies: [], hero, rule: {} });

test('rng is deterministic per seed and differs across seeds', () => {
  const a = createRng('2026-10-11'), b = createRng('2026-10-11'), c = createRng('2026-10-12');
  const sa = [a.next(), a.next(), a.next()];
  assert.deepEqual(sa, [b.next(), b.next(), b.next()]);
  assert.notDeepEqual(sa, [c.next(), c.next(), c.next()]);
  assert.equal(hashString('x'), hashString('x'));
  assert.equal(todayKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('waves are deterministic and grow', () => {
  assert.deepEqual(planWave('s', 4), planWave('s', 4));
  assert.equal(planWave('s', 1).length, 6);
  assert.equal(planWave('s', 10).length, 24);
  assert.ok(planWave('s', 1).every((e) => e.type === 'grunt'));
  const late = new Set(planWave('s', 12).map((e) => e.type));
  assert.ok(late.size >= 3, 'late waves mix enemy types');
});

test('every weapon trajectory stays inside the arena and eventually ends', () => {
  for (const w of WEAPONS) {
    const hero = { x: 0, z: 3 };
    const p = launch(w.id, hero, { x: 3, z: -6 });
    let t = 0;
    while (p.state === 'flying' && t < 8) {
      stepProjectile(p, DT, emptyWorld(hero));
      t += DT;
      assert.ok(Math.abs(p.x) <= ARENA.W - PROJECTILE_R + 1e-6, `${w.id} x in bounds`);
      assert.ok(Math.abs(p.z) <= ARENA.D - PROJECTILE_R + 1e-6, `${w.id} z in bounds`);
    }
    assert.notEqual(p.state, 'flying', `${w.id} ends within 8s`);
  }
});

test('ricochet bounces 3 times before dropping', () => {
  const p = launch('ricochet', { x: 0, z: 0 }, { x: 1, z: 0.3 });
  let bounces = 0;
  while (p.state === 'flying') {
    stepProjectile(p, DT, emptyWorld());
    bounces += p.events.filter((e) => e === 'bounce').length;
    p.events.length = 0;
  }
  assert.equal(p.state, 'dropped');
  assert.equal(bounces, 4); // 3 bounces, the 4th wall contact ends it
});

test('boomerang curves away from a straight line and returns to the hero', () => {
  const hero = { x: 0, z: 3 };
  const p = launch('boomerang', hero, { x: 0, z: -5 });
  let maxSide = 0;
  while (p.state === 'flying') {
    stepProjectile(p, DT, emptyWorld(hero));
    maxSide = Math.max(maxSide, Math.abs(p.x));
  }
  assert.ok(maxSide > 1, 'path is curved');
  assert.equal(p.state, 'held');
});

test('orbit radius grows around the hero', () => {
  const hero = { x: 0, z: 0 };
  const p = launch('orbit', hero, { x: 1, z: 0 });
  stepProjectile(p, DT, emptyWorld(hero));
  const r0 = Math.hypot(p.x, p.z);
  for (let i = 0; i < 100; i++) stepProjectile(p, DT, emptyWorld(hero));
  assert.ok(Math.hypot(p.x, p.z) > r0 + 2);
});

test('snake sways sideways from its straight base path', () => {
  const p = launch('snake', { x: 0, z: 6 }, { x: 0, z: -6 });
  let maxSide = 0;
  for (let i = 0; i < 30; i++) { stepProjectile(p, DT, emptyWorld()); maxSide = Math.max(maxSide, Math.abs(p.x)); }
  assert.ok(maxSide > 0.8);
});

test('layouts are fixed per location and keep the spawn area clear', () => {
  for (const loc of LOCATIONS) {
    const a = layoutFor(loc), b = layoutFor(loc);
    assert.deepEqual(a.solids, b.solids);
    assert.ok(a.solids.length >= 4, `${loc.id} has obstacles`);
    assert.ok(a.solids.every((o) => Math.hypot(o.x, o.z - 3) > 2.6), `${loc.id} spawn clear`);
  }
});

test('one shot through two enemies scores a combo; catching gives x2 next shot', () => {
  const g = createGame({ seed: 't', locationId: 'forest', weaponId: 'ricochet' });
  g.solids = [];
  g.breakT = 99; // hold waves
  g.enemies.push(
    { id: 101, type: 'grunt', x: 0, z: 0, r: 0.4, hp: 1, speed: 0, dead: false, hurtT: 0 },
    { id: 102, type: 'grunt', x: 0, z: -2, r: 0.4, hp: 1, speed: 0, dead: false, hurtT: 0 },
  );
  step(g, DT, { fire: { x: 0, z: -9 } });
  for (let i = 0; i < 30; i++) step(g, DT, {});
  assert.equal(g.enemies.filter((e) => e.dead).length, 2);
  assert.equal(g.score, 10 + 20);
  assert.equal(g.bestCombo, 2);

  // Catch: put the hero on the returning path.
  for (let i = 0; i < 300 && g.projectile.state === 'flying'; i++) {
    g.hero.x = g.projectile.x; g.hero.z = g.projectile.z;
    step(g, DT, {});
  }
  assert.equal(g.projectile.state, 'held');
  assert.equal(g.pendingMult, 2);
});

test('tank needs two separate shots', () => {
  const g = createGame({ seed: 't', locationId: 'forest', weaponId: 'ricochet' });
  g.solids = []; g.breakT = 99;
  g.enemies.push({ id: 1, type: 'tank', x: 0, z: 0, r: 0.55, hp: 2, speed: 0, dead: false, hurtT: 0 });
  step(g, DT, { fire: { x: 0, z: -9 } });
  for (let i = 0; i < 400; i++) step(g, DT, {});
  assert.equal(g.enemies[0].dead, false);
  assert.equal(g.enemies[0].hp, 1);
});

test('touching an enemy ends the run; dropped projectile is picked up', () => {
  const g = createGame({ seed: 't', locationId: 'forest', weaponId: 'ricochet' });
  g.breakT = 99;
  g.projectile = { state: 'dropped', x: g.hero.x + 0.3, z: g.hero.z, vx: 0, vz: 0, hits: new Set(), events: [] };
  step(g, DT, {});
  assert.equal(g.projectile.state, 'held');
  g.enemies.push({ id: 9, type: 'grunt', x: g.hero.x, z: g.hero.z + 0.3, r: 0.4, hp: 1, speed: 1, dead: false, hurtT: 0 });
  step(g, DT, {});
  assert.equal(g.over, true);
});

test('waves start on their own and clearing one gives a bonus', () => {
  const g = createGame({ seed: 'w', locationId: 'forest', weaponId: 'ricochet' });
  for (let i = 0; i < 60; i++) step(g, DT, {});
  assert.equal(g.wave, 1);
  g.queue = []; g.enemies.forEach((e) => (e.dead = true));
  step(g, DT, {});
  assert.equal(g.score, 50);
});

test('challenge link round-trips and rejects garbage', () => {
  const c = { date: '2026-10-11', location: 'cave', weapon: 'spiral', score: 1240, combo: 5, wave: 7 };
  assert.deepEqual(decodeChallenge(encodeChallenge(c)), c);
  const url = challengeUrl('https://x.test/ricochet/#old', c);
  assert.deepEqual(challengeFromHash(new URL(url).hash), c);
  assert.equal(decodeChallenge('!!!'), null);
  assert.equal(challengeFromHash('#nothing'), null);
});

test('records track best per location and daily', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const d = load(storage);
  assert.deepEqual(record(d, { score: 100, wave: 3, location: 'forest' }, '2026-10-11'), { newBest: true, newDaily: true });
  assert.deepEqual(record(d, { score: 50, wave: 2, location: 'forest' }, '2026-10-11'), { newBest: false, newDaily: false });
  save(d, storage);
  assert.equal(load(storage).best.forest, 100);
  assert.equal(load({ getItem() { throw new Error('blocked'); } }).bestScore, 0);
});
