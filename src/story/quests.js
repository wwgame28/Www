// The quest machine of «Приключение». Every kingdom has its own quest line; lines run side by side
// (open world): the active line is the first unfinished one of the current zone whose requirements
// are met. Side lines (side: true, the ⭐ errands) come after their kingdom's own line. Pure: it reads
// and changes the world state from world.js and emits events for the UI.
import { BASES, PALETTES, SKINS, GEMS, BLESSINGS } from './data.js';
import { LINES, ZONES } from './zones/index.js';
import { WEAPONS } from '../weapons.js';
import { SCROLLS, getPage } from './chronicle.js';
import { blankForge, repairForge, forgeHearts } from './forge.js';

const emit = (g, type, data = {}) => g.events.push({ type, ...data });
export const say = (g, text) => text.replaceAll('{name}', g.heroName);
export const getLine = (id) => LINES.find((l) => l.id === id) || null;

// Requirements of a line or a gate: { flags: [], blessings: [], gems: n, done: [] }.
export function meets(s, req) {
  if (!req) return true;
  return (req.flags || []).every((f) => s.flags.includes(f)) && (req.blessings || []).every((b) => s.blessings.includes(b))
    && (req.done || []).every((d) => s.done.includes(d)) && s.gems.length >= (req.gems || 0);
}

export const lineOf = (g) => LINES.find((l) => l.zone === g.area.id && !g.story.done.includes(l.id) && meets(g.story, l.requires)) || null;
export function stepOf(g) {
  const l = lineOf(g);
  return l ? l.steps[g.story.lines[l.id] || 0] || null : null;
}

// Set the world up for the current step: targets, raiders, camps, items, the object to protect, a
// boss, who has the «!», how the queen looks.
export function beginStep(g) {
  const st = stepOf(g);
  g.targets = []; g.raid = null; g.items = []; g.camps = []; g.object = null; g.reach = null; g.advanceT = -1; g.setup = null;
  g.stepT = st?.time || 0; // a timed step: seconds to finish it (world.js counts down)
  for (const v of g.villagers) v.quest = false;
  // How the queen looks now: the line's start state, changed by the steps so far ('asleep', 'frozen'…).
  const l = lineOf(g);
  g.queenState = 'awake';
  if (l) { g.queenState = l.queen || 'awake'; for (let i = 0; i <= (g.story.lines[l.id] || 0); i++) if (l.steps[i]?.queen) g.queenState = l.steps[i].queen; }
  if (!st) { emit(g, 'stepStart', { task: taskOf(g).text, idle: true }); return; }
  const t = st.type;
  if (t === 'talk') { const v = g.villagers.find((x) => x.id === st.npc); if (v) v.quest = true; }
  else if (t === 'targets') {
    g.targets = st.targets.map(([x, z, hp = 1], i) => ({ id: i + 1, x, z, r: st.r || 0.6, hp, hit: false, t: 0, style: st.style || 'target', needs: st.needs || null }));
  } else if (t === 'defend') g.raid = { wave: 0, waves: st.waves, queue: [], t: 0, breakT: 1.2 };
  else if (t === 'protect') {
    const o = st.object;
    g.object = { x: o.x, z: o.z, r: o.r || 0.9, hp: o.hp, max: o.hp, model: o.model, name: o.name };
    g.raid = { wave: 0, waves: st.waves, queue: [], t: 0, breakT: 1.6, target: 'object' };
  } else if (t === 'clear') g.camps = st.camps.map((c, i) => ({ id: i + 1, x: c.x, z: c.z, units: c.units, ids: [], cleared: false }));
  else if (t === 'collect') {
    const pts = st.at === 'lastKill' ? [g.story.drop || [g.campfire.x + 1.5, g.campfire.z - 1.5]] : st.items;
    g.items = pts.map(([x, z], i) => ({ id: i + 1, x, z, kind: st.item || 'shard', taken: false }));
  } else if (t === 'reach') {
    if (st.at) g.reach = { x: st.at[0], z: st.at[1], r: st.at[2] || 2 };
  }
  g.setup = t === 'clear' || t === 'boss' ? t : null; // world.js spawns camps and bosses on its next step
  emit(g, 'stepStart', { task: taskOf(g).text, hint: st.hint, banner: st.banner, kind: t, side: !!l.side, first: !g.story.lines[l.id], time: g.stepT });
}

// The objective is met: go on after a short pause (so the last target falls, the last raider drops).
export function objectiveMet(g, pause = 1) {
  if (g.advanceT >= 0) return;
  g.advanceT = pause;
  if (pause <= 0) completeStep(g);
}

export function completeStep(g) {
  const l = lineOf(g), st = stepOf(g), s = g.story;
  g.advanceT = -1;
  if (!st) return;
  if (st.flag && !s.flags.includes(st.flag)) s.flags.push(st.flag);
  if (st.reward) emit(g, 'reward', { coins: st.reward });
  s.lines[l.id] = (s.lines[l.id] || 0) + 1;
  emit(g, 'stepDone', { line: l.id, side: !!l.side }); // «Задания дня» count these
  if (s.lines[l.id] >= l.steps.length) finishLine(g, l);
  if (stepOf(g)?.at !== 'lastKill') s.drop = null;
  emit(g, 'save');
  beginStep(g);
}

// A kingdom saved: its gem and the queen's blessing (each gem is one more heart).
function finishLine(g, l) {
  const s = g.story;
  s.done.push(l.id);
  delete s.lines[l.id];
  if (l.flag && !s.flags.includes(l.flag)) s.flags.push(l.flag);
  if (l.gem && !s.gems.includes(l.gem)) { s.gems.push(l.gem); g.maxHearts = maxHearts(s); g.hearts = g.maxHearts; }
  if (l.blessing && !s.blessings.includes(l.blessing)) s.blessings.push(l.blessing);
  if (l.coins) emit(g, 'reward', { coins: l.coins });
  emit(g, 'lineDone', { id: l.id, title: l.title, gem: l.gem || null, blessing: l.blessing || null, ending: !!l.ending });
}

export const maxHearts = (s) => 5 + s.gems.length + forgeHearts(s); // a heart per queen's gem and per forge level

// World events that move the current objective along.
export function onEvent(g, ev) {
  const st = stepOf(g);
  if (!st) return;
  const t = st.type;
  if (t === 'targets' && ev.type === 'target' && g.targets.every((x) => x.hit)) objectiveMet(g, 1.2);
  else if ((t === 'defend' || t === 'protect') && ev.type === 'raidDone') { g.story.drop = [ev.x, ev.z]; objectiveMet(g, 1.4); }
  else if (t === 'clear' && ev.type === 'camp' && g.camps.every((c) => c.cleared)) { g.story.drop = [ev.x, ev.z]; objectiveMet(g, 1.4); }
  else if (t === 'collect' && ev.type === 'item' && g.items.every((x) => x.taken)) objectiveMet(g, 0.6);
  else if (t === 'talk' && ev.type === 'talkEnd' && ev.quest) objectiveMet(g, 0);
  else if (t === 'reach' && ((ev.type === 'gate' && ev.id === st.gate) || (ev.type === 'reached'))) objectiveMet(g, 0);
  else if (t === 'boss' && ev.type === 'bossDown') { g.story.drop = [ev.x, ev.z]; objectiveMet(g, 2); }
}

const near = (h, list) => list.reduce((b, o) => (!b || Math.hypot(o.x - h.x, o.z - h.z) < Math.hypot(b.x - h.x, b.z - h.z) ? o : b), null);

// The task line on top of the screen and the point the arrow shows.
export function taskOf(g) {
  const st = stepOf(g), h = g.hero;
  if (!st) return hubTask(g);
  let at = null, text = st.task;
  const count = (done, all) => `${st.task} · ${done}/${all}`;
  if (st.type === 'talk') at = g.villagers.find((v) => v.id === st.npc);
  else if (st.type === 'targets') { const left = g.targets.filter((x) => !x.hit); text = count(g.targets.length - left.length, g.targets.length); at = near(h, left); }
  else if (st.type === 'defend' || st.type === 'protect') {
    if (g.raid?.wave) text = `${st.task} · волна ${g.raid.wave}/${g.raid.waves.length}`;
    at = near(h, g.enemies.filter((e) => !e.dead)) || g.object;
  } else if (st.type === 'clear') { const left = g.camps.filter((c) => !c.cleared); text = count(g.camps.length - left.length, g.camps.length); at = near(h, left); }
  else if (st.type === 'collect') { const left = g.items.filter((x) => !x.taken); if (g.items.length > 1) text = count(g.items.length - left.length, g.items.length); at = near(h, left); }
  else if (st.type === 'reach') at = g.reach || g.gates.find((x) => x.id === st.gate);
  else if (st.type === 'boss') at = g.enemies.find((e) => e.boss && !e.dead) || null;
  if (lineOf(g).side) text = `⭐ ${text}`;
  return { text, x: at ? at.x : null, z: at ? at.z : null };
}

// Between kingdoms: where to go next — the nearest gate toward a kingdom's own line; once those are
// all done, toward the ⭐ errands left.
function hubTask(g) {
  const s = g.story;
  const toward = (side) => g.gates.filter((t) => meets(s, t.requires) && ZONES[t.to]
    && LINES.some((l) => l.zone === t.to && !!l.side === side && !s.done.includes(l.id) && meets(s, l.requires)));
  const main = toward(false), gate = near(g.hero, main.length ? main : toward(true));
  const at = { x: gate ? gate.x : null, z: gate ? gate.z : null };
  if (s.done.includes('finale')) {
    const left = LINES.filter((l) => l.side && !s.done.includes(l.id)).length;
    return { text: left ? `Остров спасён! ⭐ Поручений осталось: ${left}` : 'Остров Семи Корон спасён!', ...(left ? at : { x: null, z: null }) };
  }
  const here = g.area.id === 'village';
  return { text: here ? `Верни камни королев · ${s.gems.length}/${GEMS.length}` : 'Здесь всё спокойно — иди дальше', ...at };
}

// ---------- save ----------
export const blankStory = () => ({ v: 2, hero: null, zone: 'village', flags: [], gems: [], blessings: [], lines: {}, done: [], drop: null, scrolls: [], read: [], forge: blankForge() });
const pick = (list, id, key = 'id') => (list.some((x) => x[key] === id) ? id : list[0][key]);
const strings = (a, ok) => (Array.isArray(a) ? [...new Set(a.filter((x) => typeof x === 'string' && x.length < 40 && ok(x)))] : []);

// The hero from the creator, cleaned up: known base, palette, skin and weapon, a short name.
export function repairHero(h) {
  if (!h || typeof h !== 'object') return null;
  const name = String(h.name ?? '').replace(/[<>]/g, '').trim().slice(0, 14) || 'Герой';
  return { base: pick(BASES, h.base, 'model'), palette: pick(PALETTES, h.palette), skin: SKINS.some((s) => s.id === h.skin) ? h.skin : 'medium', weapon: pick(WEAPONS, h.weapon), name };
}

// Saves are repaired on load like the shop's. Part A saves ({ chapter, step }) become the
// «Пробуждение» line of the village.
export function repairStory(s) {
  const out = blankStory();
  if (!s || typeof s !== 'object') return out;
  out.hero = repairHero(s.hero);
  out.flags = strings(s.flags, () => true);
  if (s.v !== 2 && 'chapter' in s) {
    if (Number(s.chapter) >= 1) { out.done = ['awakening']; out.flags = [...new Set([...out.flags, 'awakened'])]; }
    else if (Number(s.step) >= 5) { out.done = ['awakening']; out.flags = [...new Set([...out.flags, 'awakened'])]; }
    else out.lines.awakening = Math.max(0, Math.floor(Number(s.step)) || 0);
  } else {
    out.done = strings(s.done, (id) => !!getLine(id));
    out.gems = strings(s.gems, (id) => GEMS.some((x) => x.id === id));
    out.blessings = strings(s.blessings, (id) => BLESSINGS.some((x) => x.id === id));
    for (const [id, n] of Object.entries(s.lines && typeof s.lines === 'object' ? s.lines : {})) {
      const l = getLine(id), k = Math.floor(Number(n));
      if (l && !out.done.includes(id) && k >= 0 && k < l.steps.length) out.lines[id] = k;
    }
    out.zone = ZONES[s.zone] ? s.zone : 'village';
    out.scrolls = strings(s.scrolls, (id) => SCROLLS.some((p) => p.id === id)); // the «Летопись»: scrolls found, pages read
    out.read = strings(s.read, (id) => !!getPage(id));
    out.forge = repairForge(s.forge); // Кузница Грома levels
  }
  out.drop = Array.isArray(s.drop) && s.drop.length === 2 && s.drop.every(Number.isFinite) ? [s.drop[0], s.drop[1]] : null;
  return out;
}
