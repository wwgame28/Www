// Кузница Грома: upgrades of the adventure's hero for coins. The smith in the village sells them (and
// the pause menu, once the forge is open); each one has a few levels with rising prices. Pure: it
// reads and changes the save (data.coins and data.story.forge); world.js turns the levels into extra
// hearts and perk levels (perks.js ids), so the arcade's perks and the forge share one meaning.

export const FORGE = [
  { id: 'heart', icon: '❤️', name: 'Крепкое сердце', desc: '+1 сердце', prices: [150, 300, 600] },
  { id: 'power', icon: '↯', name: 'Сильный бросок', desc: 'Оружие отскакивает ещё раз', prices: [250, 500] },
  { id: 'magnet', icon: '🧲', name: 'Магнит', desc: 'Упавшее оружие само ползёт к тебе', prices: [150, 350] },
  { id: 'boots', icon: '👟', name: 'Лёгкие сапоги', desc: 'Бег быстрее на 10%', prices: [200, 400] },
];
export const FORGE_OPENS = 'awakened'; // the forge opens with the village (the first line of chapter 1)
export const BOOTS_STEP = 0.1;         // run speed per level of the boots

export const getUpgrade = (id) => FORGE.find((u) => u.id === id) || null;
export const blankForge = () => Object.fromEntries(FORGE.map((u) => [u.id, 0]));
export const forgeLevel = (story, id) => story?.forge?.[id] || 0;
export const forgeOpen = (story) => !!story?.flags?.includes(FORGE_OPENS);
export const forgeMaxed = (story) => FORGE.every((u) => forgeLevel(story, u.id) >= u.prices.length);

// The price of the next level, or null when the upgrade is at its top level.
export function nextPrice(story, id) {
  const u = getUpgrade(id), l = forgeLevel(story, id);
  return u && l < u.prices.length ? u.prices[l] : null;
}

// Mutates data: takes the coins and raises the level.
export function buyUpgrade(data, id) {
  const u = getUpgrade(id);
  if (!u) return { ok: false, reason: 'unknown' };
  if (!forgeOpen(data.story)) return { ok: false, reason: 'closed' };
  const price = nextPrice(data.story, id);
  if (price === null) return { ok: false, reason: 'max' };
  if (data.coins < price) return { ok: false, reason: 'coins', need: price - data.coins };
  data.coins -= price;
  data.story.forge = { ...blankForge(), ...data.story.forge, [id]: forgeLevel(data.story, id) + 1 };
  return { ok: true, price, level: data.story.forge[id] };
}

// What the world gets: perk levels and extra hearts.
export const forgeMods = (story) => ({ bounce: forgeLevel(story, 'power'), magnet: forgeLevel(story, 'magnet'), speed: forgeLevel(story, 'boots') });
export const forgeHearts = (story) => forgeLevel(story, 'heart');

// Repairs a saved forge (old saves have none; levels stay within each upgrade's range).
export function repairForge(f) {
  const out = blankForge();
  if (f && typeof f === 'object') for (const u of FORGE) out[u.id] = Math.max(0, Math.min(u.prices.length, Math.floor(Number(f[u.id])) || 0));
  return out;
}
