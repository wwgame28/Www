import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORGE, buyUpgrade, nextPrice, forgeLevel, forgeOpen, forgeMods, repairForge, blankForge, BOOTS_STEP } from '../src/story/forge.js';
import { createWorld, stepWorld, applyForge } from '../src/story/world.js';
import { blankStory, repairStory, maxHearts } from '../src/story/quests.js';

const DT = 1 / 60;
const awake = () => ({ ...blankStory(), flags: ['awakened'], done: ['awakening'] });
const world = (story) => createWorld({ zoneId: 'village', story, weaponId: 'ricochet', heroName: 'Тест' });

test('the forge opens with the village, sells levels at rising prices and stops at the top', () => {
  const closed = { coins: 9999, story: blankStory() };
  assert.equal(buyUpgrade(closed, 'heart').reason, 'closed');
  assert.equal(closed.coins, 9999);
  const data = { coins: 0, story: awake() };
  assert.ok(forgeOpen(data.story));
  assert.deepEqual(buyUpgrade(data, 'heart'), { ok: false, reason: 'coins', need: 150 });
  assert.equal(buyUpgrade(data, 'nope').reason, 'unknown');
  for (const u of FORGE) {
    for (let i = 1; i < u.prices.length; i++) assert.ok(u.prices[i] > u.prices[i - 1], `${u.id}: each level costs more`);
    data.coins = u.prices.reduce((a, b) => a + b, 0);
    for (let i = 0; i < u.prices.length; i++) assert.equal(buyUpgrade(data, u.id).level, i + 1);
    assert.equal(data.coins, 0, `${u.id}: exactly the sum of its prices`);
    assert.equal(nextPrice(data.story, u.id), null);
    data.coins = 1000;
    assert.equal(buyUpgrade(data, u.id).reason, 'max');
    assert.equal(data.coins, 1000);
  }
});

test('forge levels give hearts, bounces, the magnet and faster boots in the world', () => {
  const plain = world(awake());
  const story = { ...awake(), forge: { heart: 2, power: 1, magnet: 1, boots: 2 } };
  const g = world(story);
  assert.equal(g.maxHearts, plain.maxHearts + 2);
  assert.equal(g.hearts, g.maxHearts);
  assert.equal(maxHearts(story), maxHearts(awake()) + 2);
  assert.equal(g.mods.bounce, plain.mods.bounce + 1);
  assert.equal(g.mods.magnet, 1);
  assert.equal(g.mods.speed, 2);
  // Boots: the hero runs faster on the same ground.
  const runFor = (w) => { const x0 = w.hero.x; for (let i = 0; i < 30; i++) stepWorld(w, DT, { move: { x: 1, z: 0 } }); return w.hero.x - x0; };
  const a = runFor(world(awake())), b = runFor(world(story));
  assert.ok(b > a * (1 + BOOTS_STEP), `boots: ${b.toFixed(2)} m vs ${a.toFixed(2)} m`);
});

test('the magnet pulls a dropped weapon from further away', () => {
  const lying = (story) => {
    const g = world(story);
    Object.assign(g.projectile, { state: 'dropped', x: g.hero.x + 3, z: g.hero.z, vx: 0, vz: 0 });
    for (let i = 0; i < 20; i++) stepWorld(g, DT, {});
    return Math.hypot(g.projectile.x - g.hero.x, g.projectile.z - g.hero.z);
  };
  assert.ok(Math.abs(lying(awake()) - 3) < 1e-6, 'without the magnet it stays put');
  assert.ok(lying({ ...awake(), forge: { ...blankForge(), magnet: 1 } }) < 2.6, 'the magnet crawls it in');
});

test('an upgrade bought while playing counts at once; a new heart comes full', () => {
  const data = { coins: 2000, story: awake() };
  const g = world(data.story);
  const hearts = g.maxHearts;
  g.hearts = 2;
  assert.ok(buyUpgrade(data, 'heart').ok && buyUpgrade(data, 'power').ok);
  applyForge(g, data.story.forge);
  assert.equal(g.maxHearts, hearts + 1);
  assert.equal(g.hearts, 3);
  assert.equal(g.mods.bounce, 1);
  applyForge(g, data.story.forge); // the same levels again change nothing
  assert.equal(g.maxHearts, hearts + 1);
  assert.equal(g.mods.bounce, 1);
});

test('saves keep the forge, old saves get an empty one, broken levels are clamped', () => {
  assert.deepEqual(blankStory().forge, blankForge());
  assert.deepEqual(repairStory({ v: 2 }).forge, blankForge());
  assert.deepEqual(repairStory({ v: 2, forge: { heart: 9, power: -3, magnet: '1', boots: 'x', junk: 5 } }).forge, { heart: 3, power: 0, magnet: 1, boots: 0 });
  assert.deepEqual(repairForge(null), blankForge());
  const s = { ...awake(), forge: { heart: 1, power: 2, magnet: 0, boots: 1 } };
  assert.deepEqual(repairStory(JSON.parse(JSON.stringify(s))).forge, s.forge);
  assert.equal(forgeLevel(s, 'power'), 2);
  assert.deepEqual(forgeMods(s), { bounce: 2, magnet: 0, speed: 1 });
});
