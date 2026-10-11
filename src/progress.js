import { HEROES, getHero } from './heroes.js';
import { LOCATIONS, getLocation } from './locations.js';

const KEY = 'ricochet:v1';
const blank = () => ({ best: {}, bestWave: 0, bestScore: 0, daily: {}, settings: { sound: true, quality: 'high', aimAssist: true }, hero: 'barbarian', location: 'forest' });

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : {};
    const data = { ...blank(), ...saved };
    data.settings = { ...blank().settings, ...saved.settings };
    // Saves from before heroes stored a weapon id; the hero carrying that weapon replaces it.
    data.hero = getHero(saved.hero || saved.weapon || data.hero).id;
    delete data.weapon;
    data.location = getLocation(data.location).id; // e.g. the old 'cave' became 'dungeon'
    return data;
  } catch {
    return blank();
  }
}

export function save(data, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(data)); } catch { /* private mode: progress lives for this session only */ }
}

// Returns which records the run beat, and mutates `data`.
export function record(data, run, dailyKey) {
  const out = { newBest: false, newDaily: false };
  const best = data.best[run.location] || 0;
  if (run.score > best) { data.best[run.location] = run.score; out.newBest = true; }
  data.bestScore = Math.max(data.bestScore, run.score);
  data.bestWave = Math.max(data.bestWave, run.wave);
  if (dailyKey && run.score > (data.daily[dailyKey] || 0)) { data.daily[dailyKey] = run.score; out.newDaily = true; }
  return out;
}

export const heroUnlocked = (data, h) => data.bestScore >= h.unlock;
export const locationUnlocked = (data, l) => data.bestWave >= l.unlockWave;
export const unlockedHeroes = (data) => HEROES.filter((h) => heroUnlocked(data, h));
export const unlockedLocations = (data) => LOCATIONS.filter((l) => locationUnlocked(data, l));
