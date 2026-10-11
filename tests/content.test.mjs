import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { HEROES, getHero } from '../src/heroes.js';
import { WEAPONS, launch, stepProjectile } from '../src/weapons.js';
import { LOCATIONS, ARENA, getLocation, layoutFor } from '../src/locations.js';
import { ENEMY_TYPES } from '../src/waves.js';
import { createGame, step } from '../src/game.js';
import { load } from '../src/progress.js';

const asset = (kit, model) => new URL(`../assets/${kit}/${model}.glb`, import.meta.url);
const DT = 1 / 60;

test('every hero has a real weapon and existing model, prop and projectile files', () => {
  assert.equal(new Set(HEROES.map((h) => h.id)).size, HEROES.length);
  for (const h of HEROES) {
    assert.ok(WEAPONS.some((w) => w.id === h.weapon), `${h.id} weapon`);
    assert.ok(existsSync(asset('heroes', h.model)), `${h.id} model`);
    assert.ok(h.hold.length > 0, `${h.id} holds something`);
    if (!h.proj.orb) assert.ok(existsSync(asset(h.proj.kit, h.proj.model)), `${h.id} projectile`);
  }
  assert.ok(HEROES.filter((h) => h.unlock === 0).length >= 2, 'at least two heroes from the start');
});

test('old weapon ids and missing ids resolve to a hero', () => {
  assert.equal(getHero('boomerang').id, 'knight');
  assert.equal(getHero('blackhole').id, 'stonemage');
  assert.equal(getHero('nope').id, HEROES[0].id);
});

test('every location and enemy model exists on disk', () => {
  for (const l of LOCATIONS) {
    for (const m of [...layoutFor(l).solids, ...l.decor]) assert.ok(existsSync(asset(m.kit, m.model)), `${l.id}: ${m.kit}/${m.model}`);
    assert.ok(layoutFor(l).solids.length >= 6, `${l.id} has room for obstacles`);
  }
  for (const [type, t] of Object.entries(ENEMY_TYPES)) {
    for (const m of t.model) assert.ok(existsSync(asset(m.startsWith('enemy-ufo') ? 'towerdefense' : 'skeletons', m)), `${type}: ${m}`);
  }
  assert.equal(getLocation('cave').id, 'dungeon');
});

test('portal walls wrap the projectile to the opposite side', () => {
  const world = { arena: ARENA, solids: [], enemies: [], hero: { x: 0, z: 0 }, rule: { wrap: true } };
  const p = launch('ricochet', { x: ARENA.W - 1, z: 0 }, { x: ARENA.W + 5, z: 0 });
  let wrapped = false;
  for (let i = 0; i < 30 && p.state === 'flying'; i++) { stepProjectile(p, DT, world); if (p.x < 0) wrapped = true; }
  assert.ok(wrapped, 'came back from the left side');
});

test('rising skeletons are harmless until they are out of the ground', () => {
  const g = createGame({ seed: 'r', locationId: 'forest', weaponId: 'ricochet', heroId: 'barbarian' });
  for (let i = 0; i < 90 && !g.enemies.length; i++) step(g, DT, {});
  const e = g.enemies[0];
  assert.ok(e.rise > 0, 'spawned rising');
  const start = { x: e.x, z: e.z };
  g.hero.x = e.x; g.hero.z = e.z; // stand right on it
  step(g, DT, {});
  assert.equal(g.over, false, 'no damage while rising');
  assert.deepEqual({ x: e.x, z: e.z }, start, 'does not move while rising');
});

test('old saves migrate to heroes and renamed locations', () => {
  const mem = new Map([['ricochet:v1', JSON.stringify({ weapon: 'snake', location: 'cave', bestScore: 900, settings: { sound: false } })]]);
  const d = load({ getItem: (k) => mem.get(k) ?? null });
  assert.equal(d.hero, 'rogue');
  assert.equal(d.weapon, undefined);
  assert.equal(d.location, 'dungeon');
  assert.equal(d.settings.sound, false);
  assert.equal(d.settings.quality, 'high');
});
