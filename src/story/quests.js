// The chapter/step machine of «Приключение». Pure: it reads and changes the world state from
// world.js (story progress, targets, raid, shard, villager markers) and emits events for the UI.
import { CHAPTERS, BASES, PALETTES, SKINS } from './data.js';
import { WEAPONS } from '../weapons.js';

const emit = (g, type, data = {}) => g.events.push({ type, ...data });
export const chapterOf = (s) => CHAPTERS[s.chapter] || null;
export function stepOf(s) {
  const ch = chapterOf(s);
  return ch && !ch.soon ? ch.steps[s.step] || null : null;
}
export const say = (g, text) => text.replaceAll('{name}', g.heroName);

// Set the world up for the current step: targets to hit, a raid, the shard, who has the «!».
export function beginStep(g) {
  const st = stepOf(g.story);
  g.targets = []; g.raid = null; g.shard = null; g.advanceT = -1;
  for (const v of g.villagers) v.quest = false;
  if (!st) { emit(g, 'stepStart', { task: taskOf(g)?.text, soon: true }); return; }
  if (st.type === 'talk') g.villagers.find((v) => v.id === st.npc).quest = true;
  else if (st.type === 'targets') g.targets = st.targets.map(([x, z], i) => ({ id: i + 1, x, z, r: 0.6, hit: false, t: 0 }));
  else if (st.type === 'defend') g.raid = { wave: 0, waves: st.waves, queue: [], t: 0, breakT: 1.2 };
  else if (st.type === 'collect') {
    const [x, z] = g.story.drop || [g.area.campfire.x + 1.5, g.area.campfire.z - 1.5];
    g.shard = { x, z };
  }
  emit(g, 'stepStart', { task: taskOf(g)?.text, hint: st.hint, banner: st.banner, kind: st.type });
}

// The objective is met: go on after a short pause (so the last target falls, the last raider drops).
export function objectiveMet(g, pause = 1) {
  if (g.advanceT >= 0) return;
  g.advanceT = pause;
  if (pause <= 0) completeStep(g);
}

export function completeStep(g) {
  const st = stepOf(g.story), ch = chapterOf(g.story);
  g.advanceT = -1;
  if (!st) return;
  if (st.flag && !g.story.flags.includes(st.flag)) g.story.flags.push(st.flag);
  if (st.reward) emit(g, 'reward', { coins: st.reward });
  g.story.step++;
  if (g.story.step >= ch.steps.length) {
    g.story.chapter++; g.story.step = 0;
    emit(g, 'chapterDone', { title: ch.title, next: chapterOf(g.story)?.title || null });
  }
  if (stepOf(g.story)?.type !== 'collect') g.story.drop = null;
  emit(g, 'save');
  beginStep(g);
}

// World events that move the current objective along.
export function onEvent(g, ev) {
  const st = stepOf(g.story);
  if (!st) return;
  if (st.type === 'targets' && ev.type === 'target' && g.targets.every((t) => t.hit)) objectiveMet(g, 1.2);
  else if (st.type === 'defend' && ev.type === 'raidDone') {
    g.story.drop = [ev.x, ev.z]; // the shard falls where the last raider did
    objectiveMet(g, 1.4);
  } else if (st.type === 'collect' && ev.type === 'shard') objectiveMet(g, 0.6);
  else if (st.type === 'talk' && ev.type === 'talkEnd' && ev.quest) objectiveMet(g, 0);
  else if (st.type === 'reach' && ev.type === 'gate' && ev.id === st.gate) objectiveMet(g, 0);
}

// The task line on top of the screen and the point the arrow shows.
export function taskOf(g) {
  const st = stepOf(g.story);
  if (!st) {
    const ch = chapterOf(g.story);
    return { text: ch ? `${ch.title} — продолжение скоро` : 'Остров спасён!', x: null, z: null };
  }
  const h = g.hero, near = (list) => list.reduce((b, o) => (!b || Math.hypot(o.x - h.x, o.z - h.z) < Math.hypot(b.x - h.x, b.z - h.z) ? o : b), null);
  let at = null, text = st.task;
  if (st.type === 'talk') at = g.villagers.find((v) => v.id === st.npc);
  else if (st.type === 'targets') {
    const left = g.targets.filter((t) => !t.hit);
    text = `${st.task} · ${g.targets.length - left.length}/${g.targets.length}`;
    at = near(left);
  } else if (st.type === 'defend') {
    if (g.raid?.wave) text = `${st.task} · волна ${g.raid.wave}/${g.raid.waves.length}`;
    at = near(g.enemies.filter((e) => !e.dead));
  } else if (st.type === 'collect') at = g.shard;
  else if (st.type === 'reach') at = g.gates.find((x) => x.id === st.gate);
  return { text, x: at ? at.x : null, z: at ? at.z : null };
}

// ---------- save ----------
export const blankStory = () => ({ hero: null, chapter: 0, step: 0, flags: [], drop: null });
const pick = (list, id, key = 'id') => (list.some((x) => x[key] === id) ? id : list[0][key]);

// The hero from the creator, cleaned up: known base, palette, skin and weapon, a short name.
export function repairHero(h) {
  if (!h || typeof h !== 'object') return null;
  const name = String(h.name ?? '').replace(/[<>]/g, '').trim().slice(0, 14) || 'Герой';
  return { base: pick(BASES, h.base, 'model'), palette: pick(PALETTES, h.palette), skin: SKINS.some((s) => s.id === h.skin) ? h.skin : 'medium', weapon: pick(WEAPONS, h.weapon), name };
}

// Saves are repaired on load like the shop's: unknown chapters, steps and junk are reset.
export function repairStory(s) {
  const out = blankStory();
  if (!s || typeof s !== 'object') return out;
  out.hero = repairHero(s.hero);
  const ch = Math.floor(Number(s.chapter));
  out.chapter = ch >= 0 && ch <= CHAPTERS.length ? ch : 0;
  const steps = CHAPTERS[out.chapter]?.steps?.length ?? 0;
  const st = Math.floor(Number(s.step));
  out.step = st >= 0 && st < steps ? st : 0;
  out.flags = Array.isArray(s.flags) ? [...new Set(s.flags.filter((f) => typeof f === 'string' && f.length < 40))] : [];
  out.drop = Array.isArray(s.drop) && s.drop.length === 2 && s.drop.every(Number.isFinite) ? [s.drop[0], s.drop[1]] : null;
  return out;
}
