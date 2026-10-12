// The cosmetics shop: catalog, prices, today's deals, coins for a run, buy/equip rules. Looks only —
// nothing here changes gameplay, so friends' records stay comparable. Pure (no DOM, no three.js) and
// unit-tested; how each item looks is in cosmetics.js.
import { createRng } from './rng.js';

export const CATEGORIES = [
  { id: 'skin', name: 'Герой' },
  { id: 'weapon', name: 'Оружие' },
  { id: 'trail', name: 'Следы' },
];

export const CATALOG = [
  { id: 'skin-gold', cat: 'skin', name: 'Золото', price: 600, blurb: 'Герой из чистого золота', swatch: 'linear-gradient(135deg,#fff1a8,#ffc43d 45%,#a86b00)' },
  { id: 'skin-ice', cat: 'skin', name: 'Лёд', price: 600, blurb: 'Ледяная статуя с инеем по краям', swatch: 'linear-gradient(135deg,#ffffff,#7fd6ff 50%,#2b7fb3)' },
  { id: 'skin-shadow', cat: 'skin', name: 'Тень', price: 600, blurb: 'Тёмный силуэт с фиолетовым сиянием', swatch: 'radial-gradient(circle at 35% 30%,#9a4dff,#221c30 60%)' },
  { id: 'skin-flame', cat: 'skin', name: 'Пламя', price: 600, blurb: 'Горит, а вокруг летят искры', swatch: 'radial-gradient(circle at 50% 70%,#ffd27a,#ff5a10 45%,#7a1000)' },
  { id: 'skin-ghost', cat: 'skin', name: 'Призрак', price: 600, blurb: 'Полупрозрачный и светится', swatch: 'radial-gradient(circle at 40% 35%,#ffffff,#b6ffe4 50%,#3a8a72)' },
  { id: 'weapon-gold', cat: 'weapon', name: 'Золото', price: 400, blurb: 'Золотое оружие в руке и в полёте', swatch: 'linear-gradient(135deg,#fff0b8,#ffc72e 50%,#8a5a00)' },
  { id: 'weapon-ice', cat: 'weapon', name: 'Лёд', price: 400, blurb: 'Ледяное, блестит на свету', swatch: 'linear-gradient(135deg,#ffffff,#8fe3ff 55%,#3a8fc0)' },
  { id: 'weapon-neon', cat: 'weapon', name: 'Неон', price: 400, blurb: 'Светится розовым неоном', swatch: 'radial-gradient(circle,#14101e 38%,#ff2bd6 58%,#33f0ff 80%)' },
  { id: 'weapon-crystal', cat: 'weapon', name: 'Кристалл', price: 400, blurb: 'Прозрачный фиолетовый кристалл', swatch: 'linear-gradient(135deg,#ffd6ff,#a66bff 55%,#4a148f)' },
  { id: 'weapon-lava', cat: 'weapon', name: 'Лава', price: 400, blurb: 'Тёмный камень с раскалёнными жилами', swatch: 'radial-gradient(circle at 50% 60%,#ffb02a,#ff4a1a 40%,#2a1108 75%)' },
  { id: 'trail-fire', cat: 'trail', name: 'Огонь', price: 300, blurb: 'Огненный хвост с дымком', swatch: 'linear-gradient(90deg,#801000,#ff4a0a,#ffa21a,#fff3b0)' },
  { id: 'trail-stars', cat: 'trail', name: 'Звёзды', price: 300, blurb: 'Сыплет мерцающими звёздочками', swatch: 'radial-gradient(circle,#ffffff 10%,#ffe27a 32%,#1e2440 70%)' },
  { id: 'trail-snow', cat: 'trail', name: 'Снежинки', price: 300, blurb: 'Оставляет кружащиеся снежинки', swatch: 'radial-gradient(circle,#ffffff 20%,#9fdcff 50%,#1e2440 75%)' },
  { id: 'trail-dark', cat: 'trail', name: 'Тьма', price: 300, blurb: 'Чёрный дым и фиолетовые искры', swatch: 'radial-gradient(circle,#d09bff 10%,#1c1030 50%,#0a0612)' },
  { id: 'trail-rainbow', cat: 'trail', name: 'Радуга', price: 1000, blurb: 'Радужная полоса за каждым броском', swatch: 'linear-gradient(90deg,#ff3b3b,#ff9a1a,#ffe81a,#3dff5a,#2bd5ff,#4a5bff,#b33bff)' },
];

export const DEAL_OFF = 0.3;  // today's deals: −30 %
export const COIN_CAP = 1000; // coins per run before the record ×2 (the strongest runs score 15 000+)
export const DAILY_BONUS = 20;

export const getItem = (id) => CATALOG.find((i) => i.id === id) || null;

// Today's deals: one item per category, the same for everybody on the same date.
export function dealsFor(dateKey) {
  const rng = createRng(`deals:${dateKey}`);
  return CATEGORIES.map((c) => rng.pick(CATALOG.filter((i) => i.cat === c.id)).id);
}

export function priceOf(id, dateKey) {
  const it = getItem(id);
  if (!it) return Infinity;
  return dealsFor(dateKey).includes(id) ? Math.round((it.price * (1 - DEAL_OFF)) / 10) * 10 : it.price;
}

// Coins for a finished run: score ÷ 10 (capped), ×2 for a new record on the location, +20 for the
// first daily challenge of the day.
export function coinsFor(score, { record = false, daily = false } = {}) {
  const base = Math.min(COIN_CAP, Math.floor(Math.max(0, score) / 10));
  const doubled = record && base > 0;
  return { base, record: doubled, daily, total: (doubled ? base * 2 : base) + (daily ? DAILY_BONUS : 0) };
}

export const owns = (data, id) => id === null || data.owned.includes(id);

// Mutates `data`. Buying also puts the item on.
export function buy(data, id, dateKey) {
  const it = getItem(id);
  if (!it) return { ok: false, reason: 'unknown' };
  if (data.owned.includes(id)) return { ok: false, reason: 'owned' };
  const price = priceOf(id, dateKey);
  if (data.coins < price) return { ok: false, reason: 'coins', need: price - data.coins };
  data.coins -= price;
  data.owned.push(id);
  data.look[it.cat] = id;
  return { ok: true, price };
}

// id null puts the free default look back on.
export function equip(data, cat, id) {
  if (!CATEGORIES.some((c) => c.id === cat)) return false;
  if (id !== null && (getItem(id)?.cat !== cat || !data.owned.includes(id))) return false;
  data.look[cat] = id;
  return true;
}

// Repairs a saved shop state (old saves have none; ids may come from a newer or older version).
export function sanitize(data) {
  data.coins = Math.max(0, Math.floor(Number(data.coins) || 0));
  data.owned = Array.isArray(data.owned) ? [...new Set(data.owned.filter((id) => getItem(id)))] : [];
  const look = data.look && typeof data.look === 'object' ? data.look : {};
  data.look = {};
  for (const c of CATEGORIES) data.look[c.id] = getItem(look[c.id])?.cat === c.id && data.owned.includes(look[c.id]) ? look[c.id] : null;
  data.dailyBonus = typeof data.dailyBonus === 'string' ? data.dailyBonus : '';
  return data;
}
