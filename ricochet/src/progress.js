import { WEAPONS } from './weapons.js';
import { LOCATIONS } from './locations.js';

const KEY = 'ricochet:v1';
const blank = () => ({ best: {}, bestWave: 0, bestScore: 0, daily: {}, settings: { sound: true, quality: 'high', leftHanded: false }, weapon: 'ricochet', location: 'forest' });

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    return raw ? { ...blank(), ...JSON.parse(raw) } : blank();
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

export const weaponUnlocked = (data, w) => data.bestScore >= w.unlock;
export const locationUnlocked = (data, l) => data.bestWave >= l.unlockWave;
export const unlockedWeapons = (data) => WEAPONS.filter((w) => weaponUnlocked(data, w));
export const unlockedLocations = (data) => LOCATIONS.filter((l) => locationUnlocked(data, l));
