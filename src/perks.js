import { createRng } from './rng.js';

// Upgrades offered after each cleared wave. Levels stack up to `max`.
export const PERKS = [
  { id: 'bounce', icon: '↯', name: '+1 отскок', desc: 'Пуля отскакивает ещё раз', max: 3, weapons: ['ricochet', 'snake', 'lightning'] },
  { id: 'size', icon: '⬤', name: 'Крупная пуля', desc: 'Пуля больше на 35%', max: 3 },
  { id: 'shotSpeed', icon: '➹', name: 'Быстрая пуля', desc: 'Пуля летит на 20% быстрее', max: 3 },
  { id: 'speed', icon: '👟', name: 'Быстрые ноги', desc: 'Бег быстрее на 12%', max: 3 },
  { id: 'magnet', icon: '🧲', name: 'Магнит', desc: 'Упавшая пуля сама ползёт к тебе', max: 3 },
  { id: 'reach', icon: '✋', name: 'Длинные руки', desc: 'Ловишь и подбираешь издалека', max: 2 },
  { id: 'shield', icon: '🛡', name: 'Щит', desc: 'Переживёшь одно касание врага', max: 3 },
];

export const getPerk = (id) => PERKS.find((p) => p.id === id);

export const blankMods = () => Object.fromEntries(PERKS.map((p) => [p.id, 0]));

// Deterministic for a seed + wave + current levels, so a daily run offers everyone the same picks.
export function offerPerks(seed, wave, mods, weaponId, count = 3) {
  const pool = PERKS.filter((p) => mods[p.id] < p.max && (!p.weapons || p.weapons.includes(weaponId)));
  const rng = createRng(`${seed}:perk:${wave}`);
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0].id);
  return out;
}

export function applyPerk(mods, id) {
  const p = getPerk(id);
  if (p && mods[id] < p.max) mods[id]++;
  return mods;
}
