import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TASKS, POOLS, CHEST, tasksFor, today, track, claim, openChest, chestReady, chestCoins, waiting, streakNow, yesterday, repairTasks, taskText, dayStreak } from '../src/tasks.js';
import { platformOf, createAds, AD_GAP } from '../src/monetize.js';

const D1 = '2026-10-12', D2 = '2026-10-13', D4 = '2026-10-15';
const finish = (data, day) => { for (const t of today(data, day).list) track(data, day, t.id, t.goal); };

test('every day has one task from each pool, the same for everybody', () => {
  for (const day of [D1, D2, '2026-12-31', '2027-01-01']) {
    const list = tasksFor(day);
    assert.deepEqual(list.map((t) => TASKS.find((x) => x.id === t.id).pool), POOLS);
    assert.deepEqual(tasksFor(day), list, 'deterministic');
    for (const t of list) assert.ok(TASKS.find((x) => x.id === t.id).goals.includes(t.goal));
  }
  assert.equal(yesterday('2026-03-01'), '2026-02-28');
  assert.equal(yesterday('2027-01-01'), '2026-12-31');
});

test('events count up to the goal; the best combo counts, not the sum', () => {
  const data = { coins: 0 };
  const day = today(data, D1);
  const t = day.list[0];
  if (t.id === 'combo') {
    assert.deepEqual(track(data, D1, 'combo', 1), []);
    track(data, D1, 'combo', 2);
    assert.equal(t.n, 2, 'a better combo replaces a smaller one');
    track(data, D1, 'combo', 1);
    assert.equal(t.n, 2);
  } else {
    track(data, D1, t.id, 3);
    assert.equal(t.n, Math.min(3, t.goal));
  }
  assert.deepEqual(track(data, D1, 'nothing'), []);
  assert.equal(track(data, D1, t.id, 999).length, 1, 'finished once');
  assert.equal(t.n, t.goal, 'never past the goal');
  assert.deepEqual(track(data, D1, t.id, 5), [], 'a finished task stays finished');
});

test('rewards are claimed once each; the chest opens after all three, ×2 for an ad', () => {
  const data = { coins: 0 };
  const list = today(data, D1).list;
  assert.equal(claim(data, D1, list[0].id).ok, false, 'not done yet');
  finish(data, D1);
  assert.equal(waiting(data, D1), 3);
  assert.equal(openChest(data, D1).ok, false, 'rewards first');
  const sum = list.reduce((s, t) => s + t.coins, 0);
  assert.equal(claim(data, D1, list[0].id, 2).coins, list[0].coins * 2);
  claim(data, D1, list[1].id); claim(data, D1, list[2].id);
  assert.equal(claim(data, D1, list[1].id).ok, false, 'only once');
  assert.equal(data.coins, sum + list[0].coins);
  assert.ok(chestReady(data.dayTasks));
  assert.equal(waiting(data, D1), 1);
  const r = openChest(data, D1);
  assert.deepEqual(r, { ok: true, coins: CHEST.base, streak: 1 });
  assert.equal(openChest(data, D1).ok, false, 'one chest a day');
  assert.equal(waiting(data, D1), 0);
});

test('the streak grows on days in a row, resets after a missed day, the chest grows up to a cap', () => {
  const data = { coins: 0 };
  const day = (d) => { finish(data, d); for (const t of today(data, d).list) claim(data, d, t.id); return openChest(data, d); };
  assert.equal(day(D1).streak, 1);
  assert.equal(streakNow(data, D2), 1, 'alive the next day');
  const r2 = day(D2);
  assert.equal(r2.streak, 2);
  assert.equal(r2.coins, CHEST.base + CHEST.perDay);
  assert.equal(streakNow(data, D4), 0, 'a missed day breaks it');
  assert.equal(day(D4).streak, 1);
  assert.equal(chestCoins(1), CHEST.base);
  assert.equal(chestCoins(CHEST.days), chestCoins(CHEST.days + 20), 'capped');
  assert.ok(chestCoins(CHEST.days) > chestCoins(CHEST.days - 1));
});

test('a new day brings new tasks and a closed chest; saves are repaired', () => {
  const data = { coins: 0 };
  finish(data, D1);
  today(data, D2);
  assert.equal(data.dayTasks.date, D2);
  assert.ok(data.dayTasks.list.every((t) => t.n === 0 && !t.claimed));
  assert.equal(data.dayTasks.chest, false);
  const saved = JSON.parse(JSON.stringify(data.dayTasks));
  saved.list[0].n = 999; saved.list.push({ id: 'junk', n: 3 });
  const fixed = repairTasks(saved);
  assert.equal(fixed.list.length, 3);
  assert.equal(fixed.list[0].n, fixed.list[0].goal, 'clamped to the goal');
  assert.deepEqual(repairTasks(null), repairTasks({ date: 'yesterday', streak: -4 }));
  assert.equal(repairTasks({ streak: '3', last: D1 }).streak, 3);
});

test('task texts use the right Russian plural', () => {
  const text = (id, goal) => taskText({ id, goal });
  assert.equal(text('waves', 3), 'Пройди 3 волны в аркаде');
  assert.equal(text('waves', 5), 'Пройди 5 волн в аркаде');
  assert.equal(text('kills', 21), 'Победи 21 скелета');
  assert.equal(text('runs', 2), 'Сыграй 2 забега в аркаде');
  assert.equal(text('steps', 11), 'Выполни 11 шагов заданий в «Приключении»');
  assert.equal(dayStreak(1), '1 день'); assert.equal(dayStreak(3), '3 дня'); assert.equal(dayStreak(12), '12 дней');
});

test('without a portal there are no ads; a portal is picked only from the known list', async () => {
  assert.equal(platformOf({ search: '' }, undefined), '');
  assert.equal(platformOf({ search: '?platform=Yandex' }), 'yandex');
  assert.equal(platformOf({ search: '?platform=evil.com' }), '');
  assert.equal(platformOf({ search: '' }, 'poki'), 'poki');
  const none = createAds({ platform: '', make: undefined });
  await none.ready;
  assert.equal(none.can(), false);
  assert.equal(await none.rewarded(), false);
  assert.equal(await none.interstitial(), false);
  none.gameplay(true); none.loaded(); // no-ops
});

test('a rewarded ad pays only when watched; breaks are spaced out; the game is muted meanwhile', async () => {
  const calls = [];
  let t = 1000, pay = true;
  const ads = createAds({
    platform: 'fake', now: () => t,
    hooks: { pause: () => calls.push('pause'), resume: () => calls.push('resume') },
    make: async () => ({ loaded() {}, gameplay: (on) => calls.push(on ? 'start' : 'stop'), rewarded: async () => pay, interstitial: async () => calls.push('break') }),
  });
  await ads.ready;
  assert.ok(ads.can());
  assert.equal(await ads.rewarded(), true);
  pay = false;
  assert.equal(await ads.rewarded(), false);
  assert.deepEqual(calls, ['pause', 'resume', 'pause', 'resume']);
  calls.length = 0;
  assert.equal(await ads.interstitial(), false, 'too soon after the rewarded ad');
  t += AD_GAP;
  assert.equal(await ads.interstitial(), true);
  assert.equal(await ads.interstitial(), false, 'spaced out');
  assert.deepEqual(calls, ['pause', 'break', 'resume']);
  calls.length = 0;
  ads.gameplay(true); ads.gameplay(true); ads.gameplay(false);
  assert.deepEqual(calls, ['start', 'stop'], 'only changes are sent');
});
