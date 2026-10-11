import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTarget } from '../src/aim.js';
import { createGame, step } from '../src/game.js';

const hero = { x: 0, z: 0 }, ahead = { x: 0, z: -1 };
const foe = (id, x, z) => ({ id, x, z, dead: false });

test('aim assist locks what is near the crosshair and in the clear', () => {
  assert.equal(pickTarget(hero, ahead, [foe(1, 0.5, -6)], [])?.id, 1);
  assert.equal(pickTarget(hero, ahead, [foe(1, 4, -6)], []), null, '34° off is outside the cone');
  assert.equal(pickTarget(hero, ahead, [foe(1, 0.8, -3)], [])?.id, 1, 'close enemies get a wider cone');
  assert.equal(pickTarget(hero, ahead, [foe(1, 0, -17)], []), null, 'too far');
  assert.equal(pickTarget(hero, ahead, [foe(1, 0, -0.5)], []), null, 'too close');
  assert.equal(pickTarget(hero, ahead, [foe(1, 0, -6)], [{ x: 0, z: -3, r: 0.8 }]), null, 'blocked by a solid');
  assert.equal(pickTarget(hero, ahead, [foe(1, 0, -6)], [], null, () => false), null, 'off screen');
  assert.equal(pickTarget(hero, ahead, [{ ...foe(1, 0, -6), dead: true }], []), null);
});

test('aim assist keeps its target unless another is clearly better', () => {
  const a = foe(1, 0.4, -6), b = foe(2, 0.3, -6);
  assert.equal(pickTarget(hero, ahead, [a, b], [], 1).id, 1, 'sticky');
  assert.equal(pickTarget(hero, ahead, [a, b], []).id, 2, 'without a lock the better one wins');
  assert.equal(pickTarget(hero, ahead, [foe(1, 0.9, -6), foe(2, 0, -6)], [], 1).id, 2, 'much better steals it');
});

test('events carry what the feedback needs', () => {
  const g = createGame({ seed: 'feel', locationId: 'forest', weaponId: 'ricochet' });
  g.solids = [];
  g.enemies.push({ id: 99, type: 'grunt', model: 'Skeleton_Minion', x: 0, z: 0, r: 0.4, hp: 1, speed: 0, dead: false, facing: 0, hurtT: 0, rise: 0 });
  const seen = [];
  step(g, 1 / 60, { fire: { x: 0, z: -5 } });
  for (let i = 0; i < 120 && !seen.some((e) => e.type === 'kill'); i++) { seen.push(...g.events); g.events.length = 0; step(g, 1 / 60); }
  seen.push(...g.events);
  const shot = seen.find((e) => e.type === 'shoot'), kill = seen.find((e) => e.type === 'kill');
  assert.deepEqual([shot.tx, shot.tz], [0, -5]);
  assert.ok(kill && Number.isFinite(kill.vx) && Number.isFinite(kill.px), 'kill has the hit direction');

  const d = createGame({ seed: 'feel2', locationId: 'forest', weaponId: 'ricochet' });
  d.breakT = 99; // no waves
  d.enemies.push({ id: 7, type: 'grunt', model: 'Skeleton_Minion', x: d.hero.x, z: d.hero.z - 0.5, r: 0.4, hp: 1, speed: 1, dead: false, facing: 0, hurtT: 0, rise: 0 });
  for (let i = 0; i < 60 && !d.over; i++) step(d, 1 / 60);
  assert.ok(d.over);
  assert.equal(d.killer, 7, 'the killer is known (it taunts on the game-over screen)');
});
