import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ZONES, CHAPTERS, BASES, PALETTES, SKINS, HEARTS } from '../src/story/data.js';
import { createWorld, stepWorld, nextLine, talkTo, FAINT_T, REST_R } from '../src/story/world.js';
import { stepOf, taskOf, repairStory, blankStory } from '../src/story/quests.js';
import { solidContact } from '../src/solid.js';
import { FOOTPRINTS } from '../src/footprints.js';
import { WEAPONS } from '../src/weapons.js';
import { heroDef, recolorPixels, mainClothHue } from '../src/story/hero.js';

const asset = (kit, model) => new URL(`../assets/${kit}/${model}.glb`, import.meta.url);
const kitOf = (zone, m) => (m.startsWith('@') ? m.slice(1).split('/') : [zone.kit, m]);
const DT = 1 / 60;
const fresh = (extra = {}) => createWorld({ story: { ...blankStory(), ...extra }, weaponId: 'ricochet', heroName: 'Тест' });
const run = (g, sec, input = () => ({})) => {
  const evs = [];
  for (let i = 0; i < sec / DT; i++) { stepWorld(g, DT, input(g)); evs.push(...g.events); g.events.length = 0; }
  return evs;
};
const toward = (g, x, z, stop = 0.4) => {
  const dx = x - g.hero.x, dz = z - g.hero.z, d = Math.hypot(dx, dz);
  return d > stop ? { x: dx / d, z: dz / d } : { x: 0, z: 0 };
};

test('zone models, villagers and creator choices exist', () => {
  for (const zone of Object.values(ZONES)) {
    for (const [m] of [...zone.props, ...zone.scenery]) {
      const [kit, model] = kitOf(zone, m);
      assert.ok(existsSync(asset(kit, model)), `${zone.id}: ${kit}/${model}.glb`);
    }
    for (const [m] of zone.props) assert.ok(FOOTPRINTS[kitOf(zone, m).join('/')], `${zone.id}: footprint of ${m}`);
    for (const v of zone.villagers) assert.ok(existsSync(asset('heroes', v.model)), `${v.id} model`);
  }
  assert.ok(existsSync(asset('hex', 'target')));
  for (const b of BASES) assert.ok(existsSync(asset('heroes', b.model)), b.model);
  assert.equal(new Set(PALETTES.map((p) => p.id)).size, PALETTES.length);
  assert.equal(new Set(SKINS.map((p) => p.id)).size, SKINS.length);
});

test('spawn, campfire, villagers, targets and entries stand on free ground inside the zone', () => {
  for (const zone of Object.values(ZONES)) {
    const g = createWorld({ zoneId: zone.id, story: blankStory(), weaponId: 'ricochet' });
    const free = (x, z, r, what) => {
      assert.ok(Math.abs(x) < zone.size.W - r && Math.abs(z) < zone.size.D - r, `${what} inside`);
      for (const o of g.solids) if (o.model !== 'campfire_stones') assert.equal(solidContact(o, x, z, r), null, `${what} clear of ${o.model}`);
    };
    free(zone.spawn.x, zone.spawn.z, 0.5, 'spawn');
    free(zone.campfire.x, zone.campfire.z + 1.8, 0.5, 'wake-up spot');
    for (const v of zone.villagers) free(v.x, v.z, 0.6, v.id);
    for (const [x, z] of Object.values(zone.entries)) free(x, z, 0.5, `entry ${x},${z}`);
    for (const ch of CHAPTERS.filter((c) => c.zone === zone.id && !c.soon)) {
      for (const st of ch.steps) {
        if (st.type === 'targets') for (const [x, z] of st.targets) free(x, z, 0.7, `target ${x},${z}`);
        if (st.type === 'talk') assert.ok(zone.villagers.some((v) => v.id === st.npc), `${st.npc} lives in ${zone.id}`);
        if (st.type === 'reach') assert.ok(zone.gates.some((t) => t.id === st.gate), `gate ${st.gate}`);
        if (st.type === 'defend') for (const w of st.waves) for (const [, , e] of w) assert.ok(zone.entries[e], `entry ${e}`);
      }
    }
  }
});

// A simple player: walks to the task, talks, throws at the nearest target or raider, picks the
// weapon up again. Plays chapter 1 from the first word to the gate.
function bot(g) {
  const h = g.hero, p = g.projectile, st = stepOf(g.story);
  if (g.talk) { nextLine(g); return {}; }
  const live = g.enemies.filter((e) => !e.dead && e.rise <= 0);
  const goal = live.length ? live.reduce((a, b) => (Math.hypot(a.x - h.x, a.z - h.z) < Math.hypot(b.x - h.x, b.z - h.z) ? a : b))
    : st?.type === 'targets' ? g.targets.find((t) => !t.hit) : null;
  if (p.state === 'dropped') return { move: toward(g, p.x, p.z), recall: g.recallT === 0 };
  if (goal && p.state === 'held') {
    const d = Math.hypot(goal.x - h.x, goal.z - h.z);
    if (d < 7) return { fire: { x: goal.x, z: goal.z } };
    return { move: toward(g, goal.x, goal.z) };
  }
  if (p.state !== 'held') return {};
  const t = taskOf(g);
  if (st?.type === 'talk' && g.near === st.npc) return { talk: true };
  return t.x === null ? {} : { move: toward(g, t.x, t.z, st?.type === 'talk' ? 1.6 : 0.2) };
}

test('chapter 1 plays through: elder, targets, raid, shard, reward, gate', () => {
  const g = fresh();
  const seen = [];
  for (let i = 0; i < 400 / DT && g.story.chapter === 0; i++) {
    stepWorld(g, DT, bot(g));
    seen.push(...g.events.map((e) => e.type));
    g.events.length = 0;
  }
  assert.equal(g.story.chapter, 1, `chapter 1 done (stuck at step ${g.story.step}: ${taskOf(g).text})`);
  for (const t of ['talkEnd', 'target', 'raidWave', 'kill', 'raidDone', 'shard', 'reward', 'gate', 'chapterDone', 'save']) assert.ok(seen.includes(t), t);
  assert.equal(seen.filter((t) => t === 'target').length, 3);
  const waves = seen.filter((t) => t === 'raidWave').length, faints = seen.filter((t) => t === 'faint').length;
  assert.ok(waves >= 2 && waves <= 2 * (faints + 1), 'two raid waves, again after each faint');
  assert.ok(g.story.flags.includes('ch1done'));
  assert.match(taskOf(g).text, /продолжение скоро/);
});

test('the quest dialogue uses the hero name and only the quest villager has the marker', () => {
  const g = fresh();
  assert.deepEqual(g.villagers.filter((v) => v.quest).map((v) => v.id), ['elder']);
  g.hero.x = g.villagers[0].x; g.hero.z = g.villagers[0].z + 1.5;
  assert.ok(talkTo(g, 'elder'));
  assert.match(g.talk.lines[0], /Тест/);
  while (nextLine(g));
  assert.equal(g.story.step, 1);
  g.hero.x = -6; g.hero.z = 8.5; // the smith only chats
  assert.ok(talkTo(g, 'smith'));
  assert.equal(g.talk.quest, false);
  nextLine(g);
  assert.equal(g.story.step, 1);
});

test('a raider hit costs one heart, knocks back and gives a moment of safety', () => {
  const g = fresh({ step: 2 });
  run(g, 0.1);
  g.raid = null; // a hand-made fight
  g.enemies.push({ id: 99, type: 'grunt', model: 'Skeleton_Minion', x: g.hero.x, z: g.hero.z - 0.5, r: 0.4, hp: 1, speed: 1.6, flying: false, dead: false, facing: 0, hurtT: 0, rise: 0, stunT: 0, home: null, chasing: true });
  const evs = run(g, 0.6);
  assert.equal(evs.filter((e) => e.type === 'hit').length, 1, 'one hit inside the safe time');
  assert.equal(g.hearts, HEARTS - 1);
  assert.ok(Math.hypot(g.hero.x - g.enemies[0].x, g.hero.z - g.enemies[0].z) > 1, 'knocked away');
});

test('at zero hearts the hero faints and wakes at the campfire; the raid starts over', () => {
  const g = fresh({ step: 2 });
  const evs = run(g, 6); // first wave is up
  assert.ok(evs.some((e) => e.type === 'raidWave'));
  g.hearts = 1;
  const e = g.enemies.find((x) => !x.dead);
  e.rise = 0; e.x = g.hero.x + 0.3; e.z = g.hero.z;
  const after = run(g, FAINT_T + 0.2);
  assert.ok(after.some((x) => x.type === 'faint') && after.some((x) => x.type === 'wake'));
  assert.equal(g.over, false);
  assert.equal(g.hearts, HEARTS);
  assert.ok(Math.hypot(g.hero.x - g.campfire.x, g.hero.z - g.campfire.z) < 3, 'woke at the campfire');
  assert.equal(g.raid.wave, 0, 'raid restarted');
  assert.ok(g.enemies.every((x) => x.dead));
});

test('the campfire gives hearts back only when nobody is near', () => {
  const g = fresh({ step: 1 });
  g.hearts = 2;
  g.hero.x = g.campfire.x; g.hero.z = g.campfire.z + REST_R - 0.8;
  run(g, 2);
  assert.equal(g.hearts, HEARTS);
  g.hearts = 2;
  g.enemies.push({ id: 98, type: 'grunt', model: 'Skeleton_Minion', x: g.hero.x + 4, z: g.hero.z + 1, r: 0.4, hp: 1, speed: 0, flying: false, dead: false, facing: 0, hurtT: 0, rise: 0, stunT: 0, home: null, chasing: true });
  run(g, 2);
  assert.equal(g.hearts, 2);
});

test('a closed gate says so once per visit; it opens with its flag', () => {
  const g = fresh({ step: 1 });
  const gate = g.gates[0];
  g.hero.x = gate.x; g.hero.z = gate.z + 0.5;
  let evs = run(g, 0.5);
  assert.equal(evs.filter((e) => e.type === 'gateClosed').length, 1);
  g.hero.z = gate.z + 6; run(g, 0.2);
  g.story.flags.push(gate.flag);
  g.hero.z = gate.z + 0.5;
  evs = run(g, 0.2);
  assert.ok(evs.some((e) => e.type === 'gate' && e.to === gate.to));
});

test('camp guards chase inside the aggro radius and go home past the leash', () => {
  const g = fresh({ step: 1 });
  const home = { x: -12, z: -8 };
  g.enemies.push({ id: 97, type: 'grunt', model: 'Skeleton_Minion', x: home.x, z: home.z, r: 0.4, hp: 1, speed: 1.6, flying: false, dead: false, facing: 0, hurtT: 0, rise: 0, stunT: 0, home, chasing: false });
  const e = g.enemies.at(-1);
  g.hero.x = 10; g.hero.z = 20;
  run(g, 1);
  assert.equal(e.chasing, false);
  assert.ok(Math.hypot(e.x - home.x, e.z - home.z) < 0.3, 'stays home');
  g.hero.x = home.x + 6; g.hero.z = home.z + 5;
  run(g, 0.2);
  assert.equal(e.chasing, true);
  g.hero.x = 15; g.hero.z = 20; g.hurtT = 99;
  run(g, 4);
  assert.equal(e.chasing, false);
});

test('story saves are repaired on load', () => {
  assert.deepEqual(repairStory(null), blankStory());
  assert.deepEqual(repairStory({ chapter: 'x', step: -3, flags: 'no', drop: [1] }), blankStory());
  const s = repairStory({ hero: { base: 'Knight', palette: 'sea', skin: 'dark', weapon: 'snake', name: '  <b>Лис</b>  ' }, chapter: 0, step: 3, flags: ['ch1done', 'ch1done', 5], drop: [2, -4] });
  assert.deepEqual(s.hero, { base: 'Knight', palette: 'sea', skin: 'dark', weapon: 'snake', name: 'bЛис/b' });
  assert.equal(s.step, 3);
  assert.deepEqual(s.flags, ['ch1done']);
  assert.deepEqual(s.drop, [2, -4]);
  const odd = repairStory({ hero: { base: 'Dragon', palette: '?', skin: 7, weapon: 'laser', name: '' }, chapter: 1, step: 4 });
  assert.deepEqual(odd.hero, { base: BASES[0].model, palette: PALETTES[0].id, skin: 'medium', weapon: WEAPONS[0].id, name: 'Герой' });
  assert.equal(odd.step, 0, 'chapter 2 has no steps yet');
});

test('creator heroes throw their weapon with the props their model really has', () => {
  const look = (base, weapon) => heroDef({ base, weapon, palette: 'sea', skin: 'dark', name: 'Т' });
  const barb = look('Barbarian', 'ricochet');
  assert.equal(barb.heldProp, '1H_Axe');
  assert.equal(barb.handCopy, false);
  assert.deepEqual(barb.hold, ['1H_Axe']);
  const knightAxe = look('Knight', 'ricochet');
  assert.deepEqual(knightAxe.hold, []);
  assert.equal(knightAxe.handCopy, true, 'no axe in the knight kit: a copy rides in the hand');
  assert.equal(look('Rogue_Hooded', 'snake').heldProp, 'Knife');
  const orb = look('Knight', 'lightning');
  assert.equal(orb.proj.orb, true);
  assert.equal(orb.handCopy, false);
  assert.deepEqual(look('Mage', 'lightning').hold, ['2H_Staff']);
  for (const w of WEAPONS) for (const b of BASES) assert.equal(look(b.model, w.id).weapon, w.id);
  assert.equal(barb.recolor.palette.id, 'sea');
  assert.equal(barb.recolor.skin.id, 'dark');
});

test('the outfit recolor turns cloth to the palette hue and keeps metal; skin changes tone', () => {
  // Texels: purple cloth, a second cloth color, peach skin, gray metal.
  const px = new Uint8ClampedArray([110, 60, 160, 255, 200, 60, 60, 255, 242, 194, 158, 255, 150, 150, 150, 255]);
  const uvs = [0.1, 0.1, 1.1, 0.1, 0.6, 0.1]; // texel 0 twice (1.1 repeats), texel 1 once
  const main = mainClothHue(px, 2, uvs);
  assert.ok(main > 260 && main < 290, `main hue ${main}`);
  const out = new Uint8ClampedArray(px);
  recolorPixels(out, PALETTES.find((p) => p.id === 'forest'), SKINS.find((s) => s.id === 'dark'), main);
  const [r, g, b] = out.slice(0, 3);
  assert.ok(g > r && g > b, `cloth turned green: ${[r, g, b]}`);
  assert.ok(out[8] < px[8] - 60, 'skin darker');
  assert.deepEqual([...out.slice(12, 15)], [150, 150, 150], 'metal stays');
  const same = new Uint8ClampedArray(px);
  recolorPixels(same, PALETTES[0], SKINS.find((s) => s.id === 'medium'), main);
  assert.deepEqual([...same], [...px], 'the default look changes nothing');
});
