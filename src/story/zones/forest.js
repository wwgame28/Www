// Царство природы — Лес Флоры (north of the village). Three skeleton camps, the herbalist's hut, a
// stream with a bridge, the Throne-Oak of the sleeping queen; thorns close the way to Astra's realm.
import { clearOf, scatter, belt } from './util.js';

const roads = [[[0, 28], [0, 20], [-2, 11], [-2, 1], [0, -9], [0, -14]], [[0, 20], [7, 18], [14, 17]], [[-2, 1], [10, -8], [20, -21], [21, 28 * -1]]];
const camps = [
  { x: -16, z: 13, units: [['grunt', 2], ['shooter', 1]] },
  { x: 15, z: -3, units: [['runner', 2], ['grunt', 1]] },
  { x: -13, z: -15, units: [['grunt', 2], ['shooter', 1], ['tank', 1]] },
];
const flowers = [[-22, 0], [9, -10], [23, 5], [-6, -6]];
const keep = clearOf(roads, [
  [0, 24, 4], [5, 20, 3.5], [-2.5, 20.5, 2.5], [-9, 17, 2.5], [15, 17, 3], [19, 18, 4.5], [0, -17, 5], [4.5, -14.5, 2.5], [0, -10, 5],
  ...camps.map((c) => [c.x, c.z, 5]), ...flowers.map(([x, z]) => [x, z, 2.2]), [21, -24, 5], [-2, 6, 3],
]);
const trees = [['@nature/tree_default', { h: 6 }, 'trunk'], ['@nature/tree_oak', { h: 6.5 }, 'trunk'], ['@nature/tree_detailed', { h: 6 }, 'trunk'],
  ['@nature/tree_fat', { h: 5.5 }, 'trunk'], ['@nature/tree_tall', { h: 7 }, 'trunk'], ['@nature/tree_pineTallA', { h: 7 }, 'trunk']];
const small = [['@nature/plant_bush', 1.2, 'round'], ['@nature/plant_bushDetailed', 1.4, 'round'], ['@nature/stump_old', 1, 'round'], ['@nature/rock_largeA', 1.6, 'round'], ['@nature/log', 1.8, 'cap']];

export const zone = {
  id: 'forest', name: 'Лес Флоры', kit: 'hex', size: { W: 28, D: 28 }, sky: 'day',
  look: { fog: 0xa9c9a2, near: 24, far: 70, hemi: [0xdaf2d2, 0x3d5c2a, 1.25], sun: [0xfff0cc, 2.1] },
  ground: 0x5d9c46, road: 0x9c7a52, roads,
  paint: [{ kind: 'water', x: -15.7, z: 6, w: 24.6, d: 3 }, { kind: 'water', x: 13.7, z: 6, w: 28.6, d: 3 }, { kind: 'water', x: -2, z: 6, w: 3.2, d: 3 }],
  spawn: { x: 0, z: 23, facing: Math.PI },
  campfire: { x: 5, z: 20 },
  entries: { north: [0, -24], east: [24, 0], west: [-24, 0], south: [0, 22] },
  enemyTint: 0xa8d890,
  areas: [{ kind: 'water', x: -15.7, z: 6, w: 24.6, d: 3 }, { kind: 'water', x: 13.7, z: 6, w: 28.6, d: 3 }],
  props: [
    ['@nature/campfire_stones', 5, 20, 0, 1.6, 'round'],
    // camps: tents, fires, dried trees
    ['@nature/tent_detailedOpen', -19, 16, 30, 3, 'round'], ['@nature/campfire_logs', -16, 13, 0, 1, 'round'], ['@nature/tree_default_fall', -21, 9, 0, { h: 5 }, 'trunk'], ['@nature/tree_oak_fall', -12, 17.5, 0, { h: 5.5 }, 'trunk'],
    ['@nature/tent_smallClosed', 18.5, -5.5, -40, 2.4, 'round'], ['@nature/campfire_logs', 15, -3, 0, 1, 'round'], ['@nature/tree_fat_fall', 11.5, -6.5, 0, { h: 5 }, 'trunk'], ['@nature/tree_detailed_fall', 19.5, 0.5, 0, { h: 5.5 }, 'trunk'],
    ['@nature/tent_detailedClosed', -16, -18.5, 10, 3, 'round'], ['@nature/campfire_logs', -13, -15, 0, 1, 'round'], ['@nature/tree_default_fall', -8.5, -18, 0, { h: 5 }, 'trunk'], ['@nature/tree_tall', -18, -11.5, 0, { h: 6 }, 'trunk'],
    // the herbalist's hut and her mushrooms
    ['building_home_A_green', 19.5, 19, -30, 5.5, 'box'], ['@nature/mushroom_redTall', 13, 13.5, 0, 1.4, 'round'], ['@nature/mushroom_redGroup', 16.5, 22.5, 0, 1.4, 'round'],
    ['@nature/mushroom_tanTall', 23, 13, 0, 1.4, 'round'], ['@nature/mushroom_tanGroup', 11, 21, 0, 1.2, 'round'],
    // the lumberjack's yard
    ['@nature/log_large', -12.5, 19.5, 20, 3, 'cap'], ['@nature/log_stack', -9.5, 14, -10, 2, 'box'], ['@nature/stump_roundDetailed', -6.5, 15.5, 0, 1.1, 'round'],
    // the Throne-Oak: a ring of giant trees
    ['@nature/tree_oak', -7.5, -20, 0, { h: 9 }, 'trunk'], ['@nature/tree_oak', 7.5, -20, 140, { h: 9 }, 'trunk'], ['@nature/tree_detailed', -9.5, -12.5, 60, { h: 8 }, 'trunk'],
    ['@nature/tree_detailed', 9.5, -12.5, 200, { h: 8 }, 'trunk'], ['@nature/tree_fat', 0, -25, 0, { h: 8 }, 'trunk'],
    // thorns on the way to the starry thicket (gone with «Цветение»)
    ...[17, 19, 21, 23, 25].map((x, i) => ['@nature/plant_bushLargeTriangle', x, -22.5 - (i % 2) * 0.6, i * 40, 2.2, 'round', { hurts: true, unless: 'bloom', tint: 0x5a3b4a }]),
    ...scatter('forest:trees', trees, 46, [-27, -27, 27, 27], keep, 4.2),
    ...scatter('forest:small', small, 22, [-26, -26, 26, 26], keep, 3),
  ],
  scenery: [
    ...belt('forest:belt', [['trees_A_large', 14], ['trees_B_large', 14], ['mountain_A_grass_trees', 20], ['hills_A_trees', 14]], 28, { skip: [[0, 31, 7], [21, -31, 7]] }),
    ['@nature/bridge_wood', -2, 6, 90, 3.6],
    ['@nature/lily_large', -10, 6.4, 0, 1], ['@nature/lily_large', 8, 5.6, 0, 1.2], ['@nature/lily_large', 18, 6.3, 0, 0.9],
    ...scatter('forest:flowers', [['@nature/flower_yellowA', 0.6], ['@nature/flower_redA', 0.6], ['@nature/flower_purpleA', 0.6], ['@nature/grass_leafsLarge', 0.8]], 40, [-26, -26, 26, 26], clearOf(roads, [[0, -17, 2.5]], 1.4), 1.5),
    ...[-3, -1.5, 1.5, 3].map((x) => ['@nature/flower_yellowA', x, -14.5, 0, 0.7]),
  ],
  signs: [{ x: 3.5, z: 25, rot: 180, text: '↓ Деревня' }, { x: 17.5, z: -19.5, rot: 0, text: 'Звёздная чаща ↑' }],
  portraits: [{ x: 4.6, z: -14.2, rot: 200, image: 'queen-nature', title: 'Королева природы Флора' }],
  villagers: [
    { id: 'yasen', name: 'Охотник Ясень', model: 'Rogue_Hooded', palette: 'forest', x: -2.5, z: 20.5, facing: 0.3,
      chatter: ['Тише шагай — лес слушает.', 'Видишь колючки на северо-востоке? Их наслало проклятие. Только королева может их убрать.'] },
    { id: 'mint', name: 'Травница Мята', model: 'Mage', palette: 'forest', x: 14.5, z: 16.5, facing: -0.9, hold: ['1H_Wand'],
      chatter: ['Мухоморы не ешь! Даже если очень хочется.', 'Королева Флора поёт деревьям, и они растут. Без неё лес засыпает.'] },
    { id: 'pen', name: 'Дровосек Пень', model: 'Barbarian', tint: 0xb89a70, x: -9, z: 17, facing: 0.8, hold: ['2H_Axe'],
      chatter: ['Я рублю только сухие деревья. Живые — королевины.', 'Скелеты сожгли мою поленницу. Ну ничего, наколю новую!'] },
  ],
  queen: { name: 'Королева Флора', model: 'Rogue', palette: 'forest', crown: '#3fd16b', x: 0, z: -17, facing: 0, fixed: true, throne: 'nature', portrait: 'queen-nature',
    chatter: ['…'], thanks: ['Лес снова поёт, {name}. Спасибо тебе!', 'Передай привет моей сестре Ундине, если будешь у моря.'] },
  gates: [
    { id: 'toVillage', to: 'village', x: 0, z: 26.5, w: 4, arrive: { x: 0, z: -22.5, facing: 0 } },
    { id: 'toMagic', to: 'magic', x: 21, z: -26.5, w: 4, requires: { blessings: ['bloom'] }, closed: 'Колючие лозы не пускают. Нужно благословение Флоры', arrive: { x: 20, z: 25, facing: Math.PI } },
  ],
};

export const lines = [{
  id: 'nature', zone: 'forest', title: 'Лес шёпотов', requires: { flags: ['awakened'] }, gem: 'emerald', blessing: 'bloom', coins: 150, queen: 'asleep',
  steps: [
    { type: 'talk', npc: 'yasen', task: 'Поговори с охотником Ясенем', lines: [
      'Стой, путник! А, это ты, {name} — тот, кого выбрало Сердце Кристалла. Слыхали, слыхали.',
      'Беда у нас: королева Флора уснула на Троне-дубе, и лес сохнет без её песни.',
      'Скелеты разбили в чаще три лагеря. Пока они там, деревья не оживут. Разгони их!',
    ] },
    { type: 'clear', task: 'Разгони лагеря скелетов', banner: 'Лагеря скелетов', camps, hint: 'Скелеты стерегут лагерь и бросаются, если подойти близко' },
    { type: 'talk', npc: 'mint', task: 'Зайди к травнице Мяте', lines: [
      'Ох, {name}, лагеря разогнаны! Слышишь — птицы вернулись.',
      'Королеву Флору усыпило проклятие. Разбудить её может только отвар из солнечных цветов.',
      'Найди четыре цветка — они светятся золотом даже в чаще.',
    ] },
    { type: 'collect', task: 'Собери солнечные цветы', item: 'flower', items: flowers },
    { type: 'boss', task: 'Победи Тернового вожака', banner: 'Терновый вожак!', at: [0, -9],
      boss: { name: 'Терновый вожак', model: 'Skeleton_Warrior', scale: 2.2, hp: 12, speed: 1.7, moves: ['charge', 'summon'], summon: ['grunt', 2],
        phases: [{ at: 0.5, moves: ['charge', 'summon', 'volley'], speed: 2.0, text: 'Вожак рассвирепел!' }] } },
    { type: 'talk', npc: 'queen', queen: 'awake', task: 'Поговори с королевой Флорой', lines: [
      'Ах… Я спала так долго. Это ты разбудил меня, {name}? Лес снова поёт!',
      'Король скелетов украл свет моего изумруда, но твоё Сердце Кристалла вернуло его.',
      'Возьми изумруд и отнеси его в Кристалл. И прими моё благословение — «Цветение».',
      'Теперь твои раны будут затягиваться сами, а колючие лозы на северо-востоке расступятся. За ними — звёздная чаща моей сестры Астры.',
    ] },
  ],
}];
