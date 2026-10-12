import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, CATEGORIES, dealsFor, priceOf, coinsFor, buy, equip, sanitize, getItem, COIN_CAP } from '../src/shop.js';
import { load } from '../src/progress.js';

const fresh = (coins = 0) => sanitize({ coins });

test('the catalog has 15 cosmetics, 5 per category, unique ids', () => {
  assert.equal(CATALOG.length, 15);
  for (const c of CATEGORIES) assert.equal(CATALOG.filter((i) => i.cat === c.id).length, 5, c.id);
  assert.equal(new Set(CATALOG.map((i) => i.id)).size, 15);
  assert.ok(CATALOG.every((i) => i.price > 0 && i.name && i.blurb && i.swatch));
});

test('today\'s deals: one per category, the same for everybody that day, 30 % off', () => {
  const d = dealsFor('2026-10-12');
  assert.deepEqual(d, dealsFor('2026-10-12'));
  assert.deepEqual(d.map((id) => getItem(id).cat), ['skin', 'weapon', 'trail']);
  const days = new Set(Array.from({ length: 20 }, (_, i) => dealsFor(`2026-11-${String(i + 1).padStart(2, '0')}`).join()));
  assert.ok(days.size > 5, 'deals change from day to day');
  const skin = d[0];
  assert.equal(priceOf(skin, '2026-10-12'), 420);
  const notDeal = CATALOG.find((i) => i.cat === 'skin' && i.id !== skin);
  assert.equal(priceOf(notDeal.id, '2026-10-12'), 600);
});

test('coins: score ÷ 10, capped, ×2 for a record, +20 for the first daily of the day', () => {
  assert.deepEqual(coinsFor(487), { base: 48, record: false, daily: false, total: 48 });
  assert.equal(coinsFor(487, { record: true }).total, 96);
  assert.equal(coinsFor(487, { record: true, daily: true }).total, 116);
  assert.equal(coinsFor(0, { record: true }).total, 0, 'a zero run is no record bonus');
  assert.equal(coinsFor(60000).base, COIN_CAP);
  assert.equal(coinsFor(-5).total, 0);
});

test('buying takes coins once, puts the item on; equip only what you own', () => {
  const data = fresh(1000);
  const id = CATALOG.find((i) => i.cat === 'weapon' && !dealsFor('2026-10-12').includes(i.id)).id;
  assert.deepEqual(buy(data, id, '2026-10-12'), { ok: true, price: 400 });
  assert.equal(data.coins, 600);
  assert.equal(data.look.weapon, id);
  assert.equal(buy(data, id, '2026-10-12').reason, 'owned');
  const poor = fresh(100);
  assert.deepEqual(buy(poor, 'trail-rainbow', '2026-10-12').need > 0, true);
  assert.equal(poor.coins, 100);
  assert.equal(equip(data, 'skin', 'skin-gold'), false, 'not owned');
  assert.equal(equip(data, 'skin', id), false, 'wrong category');
  assert.equal(equip(data, 'weapon', null), true);
  assert.equal(data.look.weapon, null);
});

test('old saves get an empty wallet; broken shop data is repaired', () => {
  const store = (v) => ({ getItem: () => JSON.stringify(v) });
  const old = load(store({ bestScore: 900, hero: 'knight' }));
  assert.equal(old.coins, 0);
  assert.deepEqual(old.owned, []);
  assert.deepEqual(old.look, { skin: null, weapon: null, trail: null });
  const odd = load(store({ coins: '77.9', owned: ['skin-gold', 'nope', 'skin-gold'], look: { skin: 'skin-gold', trail: 'trail-fire' } }));
  assert.equal(odd.coins, 77);
  assert.deepEqual(odd.owned, ['skin-gold']);
  assert.deepEqual(odd.look, { skin: 'skin-gold', weapon: null, trail: null }, 'cannot wear what you do not own');
});
