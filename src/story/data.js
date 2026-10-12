// «Приключение»: shared story data — the creator's choices, the seven gems and the queens'
// blessings. Zones and their quest lines live in zones/*.js.

export const HEARTS = 5; // each queen's gem adds one more

// Outfit color schemes for the hero creator: the KayKit atlas is recolored, skin-like texels kept.
export const PALETTES = [
  { id: 'default', name: 'Родной', swatch: '#8a6a4a' },
  { id: 'forest', name: 'Лесной', hue: 112, sat: 0.9, swatch: '#3f8f45' },
  { id: 'sea', name: 'Морской', hue: 192, sat: 1, swatch: '#2f8fbf' },
  { id: 'night', name: 'Ночной', hue: 250, sat: 0.55, light: 0.8, swatch: '#3c3a6e' },
  { id: 'fire', name: 'Огненный', hue: 12, sat: 1.15, swatch: '#c8452a' },
  { id: 'royal', name: 'Королевский', hue: 285, sat: 1, swatch: '#7c3fa8' },
];
// Kingdom colors for villagers and queens (not offered in the creator).
export const PEOPLE_PALETTES = [
  { id: 'sand', hue: 38, sat: 0.9, light: 1.05 },
  { id: 'snow', hue: 200, sat: 0.35, light: 1.25 },
  { id: 'stone', hue: 6, sat: 0.85, light: 0.9 },
  { id: 'magic', hue: 300, sat: 1.1 },
  { id: 'dark', hue: 265, sat: 0.6, light: 0.6 },
  { id: 'gold', hue: 45, sat: 1.1, light: 1.1 },
];
export const SKINS = [
  { id: 'light', name: 'Светлая', light: 1.1, sat: 0.85, swatch: '#f3cfae' },
  { id: 'medium', name: 'Обычная', light: 1, swatch: '#d9a47c' },
  { id: 'dark', name: 'Тёмная', light: 0.52, sat: 0.65, swatch: '#7a4e33' },
];
export const BASES = [
  { model: 'Barbarian', name: 'Воин' },
  { model: 'Knight', name: 'Рыцарь' },
  { model: 'Mage', name: 'Маг' },
  { model: 'Rogue', name: 'Разбойник' },
  { model: 'Rogue_Hooded', name: 'Следопыт' },
];

// The seven gems of the queens' crowns, in the order they sit in the Crystal.
export const GEMS = [
  { id: 'emerald', name: 'Изумруд', color: '#3fd16b', queen: 'Флора' },
  { id: 'aquamarine', name: 'Аквамарин', color: '#3fd6ff', queen: 'Ундина' },
  { id: 'amber', name: 'Янтарь', color: '#ffb42e', queen: 'Зарина' },
  { id: 'ruby', name: 'Рубин', color: '#ff4d5e', queen: 'Агата' },
  { id: 'diamond', name: 'Алмаз', color: '#e8f6ff', queen: 'Снежана' },
  { id: 'amethyst', name: 'Аметист', color: '#b56cff', queen: 'Астра' },
  { id: 'obsidian', name: 'Обсидиан', color: '#7a54c4', queen: 'Обсидиана' },
];

export const BLESSINGS = [
  { id: 'bloom', name: 'Цветение', icon: '🌸', desc: 'Вне боя сердца понемногу восстанавливаются, колючие лозы расступаются' },
  { id: 'wave', name: 'Волна', icon: '🌊', desc: '+1 отскок каждому броску, и полёт быстрее' },
  { id: 'sun', name: 'Солнечный камень', icon: '☀️', desc: 'Оружие светится: освещает тьму и зажигает светильники' },
  { id: 'dash', name: 'Рывок', icon: '⚡', desc: 'Кнопка ⚡ — рывок с неуязвимостью, перепрыгивает пропасти' },
  { id: 'frost', name: 'Иней', icon: '❄️', desc: 'Попадание замораживает врага на 2 секунды' },
  { id: 'star', name: 'Звёздный путь', icon: '✨', desc: '↩ перезаряжается втрое быстрее, оружие возвращается быстрее' },
];
export const getGem = (id) => GEMS.find((x) => x.id === id) || null;
export const getBlessing = (id) => BLESSINGS.find((x) => x.id === id) || null;
