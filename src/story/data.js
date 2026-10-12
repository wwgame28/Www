// The story mode «Приключение»: the island's zones, villagers and chapters. Pure data.
// Props use the arcade's layout entries: [model, x, z, rotation°, size, shape] (see locations.js);
// '@kit/model' takes a model from another kit. Scenery is visual only (no collider).

export const HEARTS = 5;

// Outfit color schemes for the hero creator: the KayKit atlas is recolored, skin-like texels kept.
export const PALETTES = [
  { id: 'default', name: 'Родной', swatch: '#8a6a4a' },
  { id: 'forest', name: 'Лесной', hue: 112, sat: 0.9, swatch: '#3f8f45' },
  { id: 'sea', name: 'Морской', hue: 192, sat: 1, swatch: '#2f8fbf' },
  { id: 'night', name: 'Ночной', hue: 250, sat: 0.55, light: 0.8, swatch: '#3c3a6e' },
  { id: 'fire', name: 'Огненный', hue: 12, sat: 1.15, swatch: '#c8452a' },
  { id: 'royal', name: 'Королевский', hue: 285, sat: 1, swatch: '#7c3fa8' },
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

export const ZONES = {
  village: {
    id: 'village', name: 'Деревня', kit: 'hex', size: { W: 26, D: 26 }, sky: 'day',
    look: { fog: 0xbfd6f2, near: 30, far: 80, hemi: [0xe2ecff, 0x5b7a3c, 1.3], sun: [0xfff0d8, 2.3] },
    ground: 0x7cba5c, road: 0xcdb083,
    // Roads painted on the ground: polylines of [x, z] points, 3 m wide.
    roads: [[[0, 27], [0, 12], [1, 0], [0, -12], [0, -27]], [[1, 0], [10, 3], [16, 6]], [[0, 12], [-8, 10], [-12, 6]]],
    spawn: { x: 0, z: 20, facing: Math.PI },
    campfire: { x: 4, z: 13 },
    // Where raiders come from: points just inside the zone edge.
    entries: { north: [0, -24], east: [24, 2], west: [-24, 4], south: [0, 24] },
    props: [
      ['building_tavern_blue', -10, -3, 90, 8, 'box'],
      ['building_market_blue', 9, -8, -90, 7, 'box'],
      ['building_blacksmith_blue', -10, 11, 90, 7, 'box'],
      ['building_home_A_blue', -15, -15, 30, 5.5, 'box'],
      ['building_home_B_blue', 13, -17, -20, 6, 'box'],
      ['building_home_A_blue', -4, -17, 0, 5.5, 'box'],
      ['building_church_blue', -17, 2, 90, 8, 'box'],
      ['building_windmill_blue', 18, 16, 0, 6, 'round'],
      ['building_well_blue', 4, 3, 0, 2.4, 'round'],
      ['crate_A_big', 6.5, -4, 15, 1.2, 'box'], ['barrel', 7.5, -2.6, 0, 0.9, 'round'], ['sack', -6.5, 13, 0, 0.9, 'round'],
      ['resource_lumber', -13, 16, 20, 2.4, 'cap'], ['wheelbarrow', 7, 14, -30, 1.6, 'cap'], ['tent', 20, -4, -15, 3.2, 'round'],
      ['fence_wood_straight', 12, 0, 70, 3.2, 'cap'], ['fence_wood_straight', 20, 10, 70, 3.2, 'cap'],
      ['trees_A_large', -20, 18, 0, { h: 6 }, 'round'], ['trees_B_large', 20, -20, 40, { h: 6 }, 'round'], ['trees_A_large', -21, -21, 80, { h: 6 }, 'round'],
      ['@nature/campfire_stones', 4, 13, 0, 1.6, 'round'],
      ['@nature/sign', 3, -20, 200, 1.2, 'round'],
    ],
    scenery: [
      // Mountains and hills ring the village; the wall and its gate close the north.
      ['mountain_A_grass_trees', -32, -10, 0, 20], ['mountain_B_grass_trees', 32, 8, 60, 22], ['mountain_A_grass_trees', 30, -24, 120, 18],
      ['mountain_B_grass_trees', -30, 22, 200, 20], ['hills_A_trees', -18, 33, 0, 16], ['hills_B_trees', 18, 33, 90, 16],
      ['hills_A_trees', 34, 30, 30, 14], ['hills_B_trees', -36, -32, 150, 16],
      ['wall_straight_gate', 0, -27.6, 0, 6], ['wall_straight', -5.5, -27.6, 0, 5], ['wall_straight', 5.5, -27.6, 0, 5],
      ['wall_straight', -10.5, -27.6, 0, 5], ['wall_straight', 10.5, -27.6, 0, 5], ['wall_straight', -15.5, -27.6, 0, 5], ['wall_straight', 15.5, -27.6, 0, 5],
      ['flag_blue', 14, 4, 0, { h: 2.6 }],
    ],
    villagers: [
      { id: 'elder', name: 'Старейшина Ульв', model: 'Mage', tint: 0xeee6d6, x: 2.5, z: 1, facing: 0.2, hold: ['2H_Staff'],
        chatter: ['Кристалл берёг наш остров сто лет. Мы вернём его, я верю.'] },
      { id: 'guard', name: 'Стражник Бор', model: 'Knight', tint: 0xb8c8e0, x: -2.5, z: -21, facing: 0, hold: ['1H_Sword', 'Round_Shield'],
        chatter: ['За воротами лес. Там бродят скелеты, держи оружие наготове.'] },
      { id: 'mila', name: 'Мила', model: 'Rogue', tint: 0xf0c8d8, x: 9.6, z: -1.4, facing: -0.9,
        chatter: ['Вчера из-под земли полезли кости. Хорошо, что ты здесь!', 'Говорят, в руинах на севере живёт сам Король скелетов.'] },
      { id: 'smith', name: 'Кузнец Гром', model: 'Barbarian', tint: 0xd0b090, x: -6, z: 7, facing: 0.7, hold: ['Mug'],
        chatter: ['Хороший бросок — половина победы. Вторая половина — успеть подобрать!'] },
    ],
    gates: [{ id: 'toForest', to: 'forest', x: 0, z: -24.5, w: 4, flag: 'ch1done' }],
  },
};

// A chapter is a list of steps; each step has one objective. Text may use {name} (the hero's name).
// Finishing a step can set a flag (opens gates) and pay coins (reward).
export const CHAPTERS = [
  {
    id: 1, title: 'Глава 1 · Пробуждение', zone: 'village',
    steps: [
      { type: 'talk', npc: 'elder', task: 'Поговори со старейшиной у колодца', lines: [
        'Наконец-то ты проснулся, {name}! Случилась беда: Король скелетов разбил Кристалл-хранитель нашего острова.',
        'Осколки разлетелись по острову, и мёртвые встают из земли. Без кристалла деревня не выстоит.',
        'Но сначала проверим твою руку. На площадке у мельницы стоят мишени — сбей все три.',
      ] },
      { type: 'targets', task: 'Сбей 3 мишени у мельницы', targets: [[14, 2], [17.5, 6.5], [13.5, 9.5]],
        hint: 'Брось оружие, а потом подбери его или нажми ↩' },
      { type: 'defend', task: 'Отбей нападение на деревню', banner: 'Нападение на деревню!',
        waves: [[['grunt', 4, 'north']], [['grunt', 3, 'east'], ['grunt', 2, 'west'], ['runner', 2, 'north']]] },
      { type: 'collect', task: 'Подбери осколок кристалла', at: 'lastKill' },
      { type: 'talk', npc: 'elder', task: 'Отнеси осколок старейшине', reward: 100, flag: 'ch1done', lines: [
        'Это он — осколок Кристалла! Один из пяти.',
        'Остальные ищи в лесу и в руинах на севере. Стражник Бор откроет тебе ворота.',
        'Возьми монеты за работу. И будь осторожен, {name}.',
      ] },
      { type: 'reach', gate: 'toForest', task: 'Иди к северным воротам' },
    ],
  },
  { id: 2, title: 'Глава 2 · Лес шёпотов', zone: 'forest', soon: true },
  { id: 3, title: 'Глава 3 · Пропавший караван', zone: 'forest', soon: true },
  { id: 4, title: 'Глава 4 · Руины', zone: 'ruins', soon: true },
  { id: 5, title: 'Глава 5 · Король скелетов', zone: 'ruins', soon: true },
];
