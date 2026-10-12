import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { BASES, PALETTES, SKINS, GEMS, BLESSINGS, HEARTS } from '../src/story/data.js';
import { ZONES, LINES } from '../src/story/zones/index.js';
import { createWorld, stepWorld, nextLine, talkTo, FAINT_T, REST_R, MAX_RANGE, DASH, zoneProps } from '../src/story/world.js';
import { stepOf, lineOf, taskOf, repairStory, blankStory, meets } from '../src/story/quests.js';
import { inArea } from '../src/story/hazards.js';
import { solidContact } from '../src/solid.js';
import { FOOTPRINTS } from '../src/footprints.js';
import { WEAPONS } from '../src/weapons.js';
import { heroDef, recolorPixels, mainClothHue } from '../src/story/hero.js';
import { play } from './bot.mjs';

const asset = (kit, model) => new URL(`../assets/${kit}/${model}.glb`, import.meta.url);
const kitOf = (zone, m) => (m.startsWith('@') ? m.slice(1).split('/') : [zone.kit, m]);
const DT = 1 / 60;
const ALL = ['emerald', 'aquamarine', 'amber', 'ruby', 'diamond', 'amethyst'];
const BLESS = ['bloom', 'wave', 'sun', 'dash', 'frost', 'star'];
const base = { ...blankStory(), flags: ['awakened'], done: ['awakening'] };
const world = (zoneId, story = base, extra = {}) => createWorld({ zoneId, story, weaponId: 'ricochet', heroName: 'Тест', ...extra });
const run = (g, sec, input = () => ({})) => {
  const evs = [];
  for (let i = 0; i < sec / DT; i++) { stepWorld(g, DT, input(g)); evs.push(...g.events); g.events.length = 0; }
  return evs;
};
const foe = (g, extra) => { const e = g.addEnemy('grunt', g.hero.x, g.hero.z - 4, extra); return e; };

test('every zone model, prefab piece, villager and portrait exists', () => {
  for (const zone of Object.values(ZONES)) {
    const models = [...zone.props.map((e) => e[0]), ...zone.scenery.map((e) => e[0]), ...Object.values(zone.prefabs || {}).flatMap((p) => p.pieces.map((x) => x[0]))];
    for (const m of models) {
      if (m.startsWith('#')) { assert.ok(zone.prefabs?.[m.slice(1)], `${zone.id}: prefab ${m}`); continue; }
      const [kit, model] = kitOf(zone, m);
      assert.ok(existsSync(asset(kit, model)), `${zone.id}: ${kit}/${model}.glb`);
    }
    for (const e of zone.props) if (!e[0].startsWith('#')) assert.ok(FOOTPRINTS[kitOf(zone, e[0]).join('/')], `${zone.id}: footprint of ${e[0]}`);
    for (const v of [...zone.villagers, ...(zone.queen ? [zone.queen] : []), ...(zone.feast || [])]) {
      if (v.prop) assert.ok(existsSync(asset(...kitOf(zone, v.prop))), `${v.id} prop`);
      else assert.ok(existsSync(asset('heroes', v.model)), `${v.name} model`);
      if (v.portrait) assert.ok(existsSync(new URL(`../assets/story/${v.portrait}.jpg`, import.meta.url)), `${v.portrait}.jpg`);
    }
    for (const p of zone.portraits || []) assert.ok(existsSync(new URL(`../assets/story/${p.image}.jpg`, import.meta.url)), `${p.image}.jpg`);
  }
  assert.ok(existsSync(asset('hex', 'target')));
  for (const b of BASES) assert.ok(existsSync(asset('heroes', b.model)), b.model);
  assert.equal(new Set(PALETTES.map((p) => p.id)).size, PALETTES.length);
  assert.equal(new Set(SKINS.map((p) => p.id)).size, SKINS.length);
});

test('quest lines are well formed: known zones, villagers, gates, gems and blessings', () => {
  assert.equal(new Set(LINES.map((l) => l.id)).size, LINES.length);
  for (const l of LINES) {
    const zone = ZONES[l.zone];
    assert.ok(zone, `${l.id}: zone ${l.zone}`);
    if (l.gem) assert.ok(GEMS.some((x) => x.id === l.gem), `${l.id}: gem`);
    if (l.blessing) assert.ok(BLESSINGS.some((x) => x.id === l.blessing), `${l.id}: blessing`);
    for (const st of l.steps) {
      if (st.type === 'talk') assert.ok(st.npc === 'queen' ? zone.queen : zone.villagers.some((v) => v.id === st.npc), `${l.id}: ${st.npc} lives in ${zone.id}`);
      if (st.type === 'reach' && st.gate) assert.ok(zone.gates.some((t) => t.id === st.gate), `${l.id}: gate ${st.gate}`);
      if (st.type === 'defend' || st.type === 'protect') for (const w of st.waves) for (const [, , e] of w) assert.ok(zone.entries[e], `${l.id}: entry ${e}`);
      assert.ok(st.task, `${l.id}: every step has a task line`);
    }
  }
  // Every gem is given by exactly one line; every blessing too.
  for (const gem of GEMS) assert.equal(LINES.filter((l) => l.gem === gem.id).length, 1, gem.id);
  for (const b of BLESSINGS) assert.equal(LINES.filter((l) => l.blessing === b.id).length, 1, b.id);
});

test('key spots stand on free ground inside their zone', () => {
  for (const zone of Object.values(ZONES)) {
    const g = world(zone.id, { ...base, blessings: BLESS });
    const free = (x, z, r, what) => {
      assert.ok(Math.abs(x) < zone.size.W - r && Math.abs(z) < zone.size.D - r, `${zone.id}: ${what} inside`);
      for (const o of g.solids) if (o.model !== 'campfire_stones') assert.equal(solidContact(o, x, z, r), null, `${zone.id}: ${what} clear of ${o.model || 'wall'} at ${o.x.toFixed(1)},${o.z.toFixed(1)}`);
    };
    free(zone.spawn.x, zone.spawn.z, 0.5, 'spawn');
    free(zone.campfire.x, zone.campfire.z + 1.8, 0.5, 'wake-up spot');
    for (const v of [...zone.villagers, ...(zone.queen ? [zone.queen] : [])]) free(v.x, v.z, 0.5, v.name);
    for (const [k, [x, z]] of Object.entries(zone.entries)) free(x, z, 0.5, `entry ${k}`);
    for (const l of LINES.filter((x) => x.zone === zone.id)) {
      for (const st of l.steps) {
        if (st.type === 'targets') for (const [x, z] of st.targets) if (st.style !== 'prison') free(x, z, 0.7, `${l.id} target ${x},${z}`);
        if (st.type === 'collect' && st.items) for (const [x, z] of st.items) free(x, z, 0.5, `${l.id} item ${x},${z}`);
        if (st.type === 'clear') for (const c of st.camps) free(c.x + 1.6, c.z, 0.4, `${l.id} camp ${c.x},${c.z}`);
        if (st.type === 'boss') free(st.at[0], st.at[1], st.boss.r ?? 0.9, `${l.id} boss`);
        if (st.type === 'reach' && st.at) free(st.at[0], st.at[1], 0.5, `${l.id} reach`);
        if (st.type === 'protect') free(st.object.x, st.object.z, st.object.r, `${l.id} object`);
      }
    }
  }
});

test('gates lead to real zones, arrive on free ground and never bounce the hero straight back', () => {
  for (const zone of Object.values(ZONES)) {
    for (const t of zone.gates) {
      const to = ZONES[t.to];
      assert.ok(to, `${zone.id} → ${t.to}`);
      assert.ok(to.gates.some((b) => b.to === zone.id), `${t.to} has a way back to ${zone.id}`);
      const g = world(t.to, { ...base, blessings: BLESS, gems: ALL }, { arrive: t.arrive });
      const evs = run(g, 0.5);
      assert.ok(!evs.some((e) => e.type === 'gate'), `arriving in ${t.to} from ${zone.id} doesn't use a gate`);
    }
  }
  const g = world('village', blankStory());
  g.hero.x = 24; g.hero.z = 2;
  const evs = run(g, 0.3);
  assert.ok(evs.some((e) => e.type === 'gateClosed' && e.to === 'beach'), 'kingdom gates wait for chapter 1');
});

const LINE_RUNS = [
  ['awakening', 'village', blankStory()],
  ['nature', 'forest', base], ['sea', 'beach', base], ['sand', 'desert', base], ['stone', 'mountains', base],
  ['snow', 'snow', { ...base, blessings: ['dash'], done: ['awakening', 'stone'] }],
  ['magic', 'magic', { ...base, blessings: ['bloom'], done: ['awakening', 'nature'] }],
  ['depths', 'caves', { ...base, gems: ALL, blessings: BLESS }],
  ['king', 'caves', { ...base, gems: [...ALL, 'obsidian'], blessings: BLESS, done: ['awakening', 'depths'] }],
  ['finale', 'village', { ...base, done: ['awakening', 'king'] }],
];
for (const [id, zone, story] of LINE_RUNS) {
  for (const weapon of ['ricochet', ...(id === 'sea' || id === 'stone' ? ['boomerang'] : [])]) {
    test(`quest line «${id}» plays through to the end (${weapon})`, () => {
      const g = createWorld({ zoneId: zone, story, weaponId: weapon, heroName: 'Бот' });
      const seen = play(g, 900, (w) => w.story.done.includes(id));
      assert.ok(g.story.done.includes(id), `stuck at step ${g.story.lines[id]}: ${taskOf(g).text}`);
      assert.ok(seen.includes('lineDone') && seen.includes('save'));
      const l = LINES.find((x) => x.id === id);
      if (l.gem) assert.ok(g.story.gems.includes(l.gem));
      if (l.blessing) assert.ok(g.story.blessings.includes(l.blessing));
      if (l.gem) assert.equal(g.maxHearts, HEARTS + g.story.gems.length, 'a gem is one more heart');
    });
  }
}

test('lines open in the open order: four kingdoms after chapter 1, the rest with blessings and gems', () => {
  const open = (s, zone) => !!lineOf(world(zone, s));
  assert.equal(open(blankStory(), 'forest'), false);
  for (const z of ['forest', 'beach', 'desert', 'mountains']) assert.ok(open(base, z), z);
  assert.equal(open(base, 'snow'), false);
  assert.ok(open({ ...base, blessings: ['dash'] }, 'snow'));
  assert.equal(open(base, 'magic'), false);
  assert.ok(open({ ...base, blessings: ['bloom'] }, 'magic'));
  assert.equal(open({ ...base, gems: ALL.slice(0, 5), blessings: ['sun'] }, 'caves'), false);
  assert.ok(open({ ...base, gems: ALL, blessings: ['sun'] }, 'caves'));
  const well = ZONES.village.gates.find((t) => t.to === 'caves');
  assert.equal(meets({ ...base, gems: ALL, blessings: [] }, well.requires), false, 'the caves need the sun stone');
  assert.match(taskOf(world('village', base)).text, /0\/7/);
});

test('thorns hurt and vanish with «Цветение»; the chasm only lets a dash through', () => {
  const g = world('forest');
  const thorn = g.solids.find((o) => o.hurts);
  assert.ok(thorn, 'thorns in the forest');
  g.hero.x = thorn.x; g.hero.z = thorn.z + thorn.r + 0.35;
  const evs = run(g, 0.3, () => ({ move: { x: 0, z: -1 } }));
  assert.ok(evs.some((e) => e.type === 'hit' && e.why === 'thorns'));
  assert.ok(!world('forest', { ...base, blessings: ['bloom'] }).solids.some((o) => o.hurts));
  assert.ok(zoneProps(ZONES.forest, { blessings: ['bloom'] }).length < ZONES.forest.props.length);

  const m = world('mountains', { ...base, blessings: ['dash'] });
  const cross = (dash) => {
    m.hero.x = -18.5; m.hero.z = 20; m.dashCd = 0;
    let t = 0;
    run(m, 1.2, () => ({ move: { x: -1, z: 0 }, dash: dash && t++ === 6 }));
    return m.hero.x < -21;
  };
  assert.equal(cross(false), false, 'walking stops at the chasm');
  assert.ok(cross(true), 'a dash jumps it');
  assert.ok(DASH.speed * DASH.time > 2 * 0.9 + 2 * 0.4, 'the dash is longer than the chasm is wide');
});

test('a hit costs a heart and knocks back; at zero the hero wakes at the campfire, a boss keeps its wounds', () => {
  const g = world('forest', { ...base, lines: { nature: 4 } }); // the boss step
  run(g, 0.1);
  const boss = g.enemies.find((e) => e.boss);
  assert.ok(boss, 'the boss came');
  boss.hp = 5; boss.rise = 0;
  g.hearts = 1;
  boss.x = g.hero.x + 0.5; boss.z = g.hero.z;
  const evs = run(g, FAINT_T + 0.3);
  assert.ok(evs.some((e) => e.type === 'faint') && evs.some((e) => e.type === 'wake'));
  assert.equal(g.hearts, g.maxHearts);
  assert.ok(Math.hypot(g.hero.x - g.campfire.x, g.hero.z - g.campfire.z) < 3);
  assert.equal(boss.hp, 5, 'still wounded');
  assert.ok(!boss.dead);
});

test('the campfire and «Цветение» give hearts back only when nobody is near', () => {
  const g = world('beach');
  g.hearts = 2;
  g.hero.x = g.campfire.x; g.hero.z = g.campfire.z + REST_R - 0.8;
  run(g, 2);
  assert.equal(g.hearts, g.maxHearts);
  const b = world('beach', { ...base, blessings: ['bloom'] });
  b.hero.x = -20; b.hero.z = -20; b.hearts = 3;
  run(b, 11);
  assert.equal(b.hearts, 4, 'one heart after the calm time and one interval');
  foe(b, { speed: 0 });
  b.hearts = 3;
  run(b, 11);
  assert.equal(b.hearts, 3, 'no healing with an enemy close');
});

test('blessings change the rules: «Волна» bounces, «Иней» freezes, «Звёздный путь» recalls fast', () => {
  assert.equal(world('beach', { ...base, blessings: ['wave'] }).mods.bounce, 1);
  const f = world('beach', { ...base, blessings: ['frost'] });
  const e = foe(f, { hp: 3, maxHp: 3 });
  f.hero.x = -20; f.hero.z = -18; e.x = -20; e.z = -22;
  run(f, 0.6, (w) => (w.projectile.state === 'held' ? { fire: { x: e.x, z: e.z } } : {}));
  assert.ok(e.hp < 3 && e.frozenT > 0, 'frozen after the hit');
  const s = world('beach', { ...base, blessings: ['star'] });
  s.hero.x = -20; s.hero.z = -18;
  run(s, 3, (w) => (w.projectile.state === 'held' && w.time < 0.1 ? { fire: { x: -20, z: 0 } } : { recall: true }));
  assert.ok(s.recallT <= 1.3);
});

test('a throw falls down after MAX_RANGE in the open world', () => {
  const g = world('village', base);
  g.hero.x = -20; g.hero.z = 20;
  run(g, 3, (w) => (w.time < 0.05 ? { fire: { x: 20, z: 20 } } : {}));
  assert.equal(g.projectile.state, 'dropped');
  assert.ok(Math.hypot(g.projectile.x - -20, g.projectile.z - 20) < MAX_RANGE + 2);
});

test('cold builds up away from warm spots and hurts when full; quicksand drags and sinks', () => {
  const g = world('snow', { ...base, blessings: ['dash'] });
  g.hero.x = -20; g.hero.z = -20;
  const evs = run(g, 40);
  assert.ok(g.temp === 1 && evs.some((e) => e.type === 'hit' && e.why === 'cold'));
  g.hero.x = g.campfire.x; g.hero.z = g.campfire.z + 1.8;
  run(g, 5);
  assert.ok(g.temp < 0.1, 'warmed up at the fire');
  const d = world('desert');
  const q = d.areas.find((a) => a.kind === 'quicksand');
  d.hero.x = q.x + q.r * 0.8; d.hero.z = q.z;
  const sink = run(d, 4);
  assert.ok(sink.some((e) => e.type === 'hit' && e.why === 'sand'), 'pulled in and hurt');
});

test('rockfall warns first, then hurts only the one standing under it', () => {
  const g = world('mountains');
  g.hero.x = 2; g.hero.z = -3;
  const evs = run(g, 6);
  const warn = evs.find((e) => e.type === 'rockWarn'), rock = evs.find((e) => e.type === 'rock');
  assert.ok(warn && rock && evs.indexOf(warn) < evs.indexOf(rock));
  assert.ok(!world('mountains', { ...base, done: ['awakening', 'stone'] }).rockfall, 'it stops once the kingdom is saved');
});

test('portals move the hero and the weapon; the gravity well pulls them', () => {
  const g = world('magic', { ...base, blessings: ['bloom'] });
  const p = g.areas.find((a) => a.kind === 'portal');
  g.hero.x = p.a[0] + 1.6; g.hero.z = p.a[1];
  const evs = run(g, 1, (w) => ({ move: w.hero.portalT ? { x: 0, z: 0 } : { x: -1, z: 0 } }));
  assert.ok(evs.some((e) => e.type === 'portal'));
  assert.ok(Math.hypot(g.hero.x - p.b[0], g.hero.z - p.b[1]) < 3, 'came out of the other ring');
  const w = world('magic', { ...base, blessings: ['bloom'] }), well = w.areas.find((a) => a.kind === 'pull');
  w.hero.x = well.x + well.r - 1; w.hero.z = well.z;
  run(w, 1);
  assert.ok(Math.hypot(w.hero.x - well.x, w.hero.z - well.z) < well.r - 1.2, 'dragged toward the middle');
});

test('bosses: a front shield blocks throws into its face; it tires after a charge; bank shots hit twice', () => {
  const g = world('beach', { ...base, lines: { sea: 5 } });
  run(g, 0.05);
  const boss = g.enemies.find((e) => e.boss);
  boss.rise = 0; boss.x = 0; boss.z = 0; boss.facing = 0; // looks toward +z
  g.hero.x = 0; g.hero.z = 6;
  boss.boss.nextT = 99;
  const front = run(g, 0.5, (w) => (w.projectile.state === 'held' && w.time < 0.2 ? { fire: { x: 0, z: 0 } } : {}));
  assert.ok(front.some((e) => e.type === 'block'), 'blocked in the face');
  assert.equal(boss.hp, boss.maxHp);
  boss.boss.stunT = 2; // tired: the shield is down
  g.projectile = { state: 'held', x: g.hero.x, z: g.hero.z, vx: 0, vz: 0, hits: new Set(), events: [] };
  boss.x = 0; boss.z = 0;
  const t0 = g.time;
  run(g, 0.5, (w) => (w.projectile.state === 'held' && w.time - t0 < 0.1 ? { fire: { x: 0, z: 0 } } : {}));
  assert.ok(boss.hp < boss.maxHp, 'hurt while tired');
  const s = world('mountains', { ...base, lines: { stone: 4 } });
  run(s, 0.05);
  const giant = s.enemies.find((e) => e.boss);
  assert.equal(giant.boss.vulnerable, 'stunned');
});

test('protecting: raiders go for the object, losing it starts the step over', () => {
  const g = world('desert', { ...base, lines: { sand: 2 } });
  assert.ok(g.object && g.raid?.target === 'object');
  g.hero.x = 20; g.hero.z = -20;
  const evs = run(g, 120);
  assert.ok(evs.some((e) => e.type === 'objectHit'));
  assert.ok(evs.some((e) => e.type === 'objectLost'));
  assert.equal(g.object.hp, g.object.max, 'a fresh caravan');
});

test('enemy kinds: shooters throw bones, burrowers dive and come up, blinkers jump next to the hero', () => {
  const g = world('village', base);
  g.hero.x = 0; g.hero.z = 18;
  g.addEnemy('shooter', 0, 12);
  g.addEnemy('burrower', -6, 18);
  g.addEnemy('blinker', 8, 22);
  const evs = run(g, 12, (w) => { w.hurtT = 1; return { move: { x: Math.cos(w.time * 0.8), z: Math.sin(w.time * 0.8) } }; }); // runs in circles, untouchable
  for (const t of ['enemyShot', 'burrow', 'emerge', 'blinkWarn', 'blink']) assert.ok(evs.some((e) => e.type === t), t);
});

test('talking: the quest dialogue uses the hero name; queens have portraits or crests', () => {
  const g = world('village', blankStory());
  const elder = g.villagers.find((v) => v.id === 'elder');
  g.hero.x = elder.x; g.hero.z = elder.z + 1.5;
  assert.ok(talkTo(g, 'elder'));
  assert.match(g.talk.lines[0], /Тест/);
  while (nextLine(g));
  assert.equal(g.story.lines.awakening, 1);
  const b = world('beach', { ...base, lines: { sea: 6 } });
  assert.ok(talkTo(b, 'queen'));
  assert.equal(b.talk.portrait, 'queen-sea');
  for (const z of Object.values(ZONES)) if (z.queen) assert.ok(z.queen.portrait || z.queen.crest, `${z.queen.name} has a portrait or a crest`);
});

test('story saves: part A saves become the village line; junk is cleaned; areas know their shapes', () => {
  assert.deepEqual(repairStory(null), blankStory());
  const old = repairStory({ chapter: 0, step: 3, flags: ['x'], hero: { base: 'Mage', name: 'Ann' } });
  assert.equal(old.lines.awakening, 3);
  assert.equal(old.hero.base, 'Mage');
  const done = repairStory({ chapter: 1, step: 0, flags: ['ch1done'] });
  assert.ok(done.done.includes('awakening') && done.flags.includes('awakened'));
  const v2 = repairStory({ v: 2, zone: 'beach', gems: ['ruby', 'fake'], blessings: ['dash', 'fly'], lines: { sea: 3, nope: 1, sand: 99 }, done: ['nature', 'zzz'], drop: [1, 2] });
  assert.deepEqual(v2.gems, ['ruby']);
  assert.deepEqual(v2.blessings, ['dash']);
  assert.deepEqual(v2.lines, { sea: 3 });
  assert.deepEqual(v2.done, ['nature']);
  assert.equal(v2.zone, 'beach');
  assert.equal(repairStory({ v: 2, zone: 'mars' }).zone, 'village');
  const odd = repairStory({ hero: { base: 'Dragon', palette: '?', skin: 7, weapon: 'laser', name: '' } });
  assert.deepEqual(odd.hero, { base: BASES[0].model, palette: PALETTES[0].id, skin: 'medium', weapon: WEAPONS[0].id, name: 'Герой' });
  assert.ok(inArea({ x: 0, z: 0, r: 1 }, 0.5, 0) && !inArea({ x: 0, z: 0, w: 2, d: 2 }, 0, 1.5));
});

test('creator heroes throw their weapon with the props their model really has', () => {
  const look = (b, weapon) => heroDef({ base: b, weapon, palette: 'sea', skin: 'dark', name: 'Т' });
  const barb = look('Barbarian', 'ricochet');
  assert.equal(barb.heldProp, '1H_Axe');
  assert.equal(barb.handCopy, false);
  assert.deepEqual(look('Knight', 'ricochet').hold, []);
  assert.equal(look('Knight', 'ricochet').handCopy, true);
  assert.equal(look('Rogue_Hooded', 'snake').heldProp, 'Knife');
  assert.equal(look('Knight', 'lightning').handCopy, false);
  assert.deepEqual(look('Mage', 'lightning').hold, ['2H_Staff']);
  for (const w of WEAPONS) for (const b of BASES) assert.equal(look(b.model, w.id).weapon, w.id);
});

test('the outfit recolor turns cloth to the palette hue and keeps metal; skin changes tone', () => {
  const px = new Uint8ClampedArray([110, 60, 160, 255, 200, 60, 60, 255, 242, 194, 158, 255, 150, 150, 150, 255]);
  const main = mainClothHue(px, 2, [0.1, 0.1, 1.1, 0.1, 0.6, 0.1]);
  assert.ok(main > 260 && main < 290, `main hue ${main}`);
  const out = new Uint8ClampedArray(px);
  recolorPixels(out, PALETTES.find((p) => p.id === 'forest'), SKINS.find((s) => s.id === 'dark'), main);
  const [r, gg, b] = out.slice(0, 3);
  assert.ok(gg > r && gg > b, `cloth turned green: ${[r, gg, b]}`);
  assert.ok(out[8] < px[8] - 60, 'skin darker');
  assert.deepEqual([...out.slice(12, 15)], [150, 150, 150], 'metal stays');
  const same = new Uint8ClampedArray(px);
  recolorPixels(same, PALETTES[0], SKINS.find((s) => s.id === 'medium'), main);
  assert.deepEqual([...same], [...px]);
});
