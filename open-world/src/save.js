// Сохранения в localStorage. Любая ошибка хранилища (приватный режим, квота) — игра просто работает без него.
import { CONFIG } from './config.js';

export const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : (JSON.parse(raw) ?? fallback);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* хранилище недоступно */
    }
  },
};

const KEY = CONFIG.save.key;

// { seed: '482913', player: {x,y,z,yaw,pitch,flying} | null, time, day, settings }
export function loadSave() {
  const data = storage.get(KEY, null);
  if (!data || typeof data !== 'object') return { seed: null, player: null, time: null, day: 1, settings: {} };
  const p = data.player;
  const validPlayer =
    p && [p.x, p.y, p.z, p.yaw, p.pitch].every((v) => typeof v === 'number' && Number.isFinite(v)) ? p : null;
  return {
    seed: typeof data.seed === 'string' && data.seed.length <= 64 ? data.seed : null,
    player: validPlayer,
    time: typeof data.time === 'number' && data.time >= 0 && data.time < 1 ? data.time : null,
    day: Number.isInteger(data.day) && data.day > 0 ? data.day : 1,
    settings: data.settings && typeof data.settings === 'object' ? data.settings : {},
  };
}

export function writeSave(state) {
  return storage.set(KEY, { v: 1, ...state, savedAt: Date.now() });
}
