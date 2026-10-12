// Царство песков — Пустыня Зарины (south of the village). Dunes in a sandstorm, the oasis, three
// obelisks, quicksand, the caravan, old ruins and the sandstone palace with its stone head guard.
import { clearOf, scatter, belt } from './util.js';

const roads = [[[0, -28], [0, -18], [-4, -8], [0, 4], [0, 12]], [[0, -18], [-8, -16], [-12, -12]], [[0, -18], [10, -18], [14, -19]], [[0, 4], [12, 8], [16, -4]], [[0, 4], [-12, 9], [-18, 12]]];
const obelisks = [[16, -6.5], [-19, 12], [10, 14.5]];
const quicksand = [{ kind: 'quicksand', x: 6, z: 0, r: 3 }, { kind: 'quicksand', x: -9, z: 3, r: 2.6 }, { kind: 'quicksand', x: 20.5, z: 7, r: 2.6 }];
const keep = clearOf(roads, [
  [0, -24, 4], [-6, -19, 3], [-5.5, -15, 2.5], [-19, -5, 2.5], [-4, -8, 4], [12, -18, 2.5], [0, 13.5, 4], [-4.5, 12.5, 2.5], [0, 8, 5],
  [-14, -12, 7], ...obelisks.map(([x, z]) => [x, z, 3]), ...quicksand.map((q) => [q.x, q.z, q.r + 1.5]),
]);
const desertBits = [['@nature/cactus_tall', { h: 2.6 }, 'trunk'], ['@nature/cactus_short', { h: 1.6 }, 'trunk'], ['@nature/rock_tallB', 2, 'round'],
  ['@nature/rock_tallE', 1.6, 'round'], ['@nature/rock_largeE', 2, 'round'], ['@nature/cactus_tall', { h: 3.2 }, 'trunk']];
const oasisPalms = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + 0.3, r = i % 2 ? 6.2 : 5.4;
  return [i % 3 ? '@nature/tree_palmTall' : '@nature/tree_palmBend', +(-14 + Math.cos(a) * r).toFixed(1), +(-12 + Math.sin(a) * r).toFixed(1), i * 45, { h: 6 }, 'trunk'];
});
const storm = { kind: 'push', look: 'sand', x: 0, z: 0, w: 56, d: 56, dir: [0.97, 0.24], strength: 2.2, period: 12, on: 2.5, warn: 1.5, shot: 1.6, until: 'sand' };

export const zone = {
  id: 'desert', name: 'Пустыня Зарины', kit: 'hex', size: { W: 28, D: 28 }, sky: 'day',
  look: { fog: 0xd9b98a, near: 16, far: 52, hemi: [0xffe8c8, 0x8a6a40, 1.2], sun: [0xffd8a0, 2.2] },
  lookDone: { fog: 0xf0dcb4, near: 30, far: 85, hemi: [0xfff0d8, 0x9a7a50, 1.35], sun: [0xffe6b8, 2.6] },
  weather: 'sand', weatherDone: null,
  ground: 0xe3c07c, road: 0xc9a060, roads,
  paint: [{ kind: 'shallow', x: -14, z: -12, r: 4.5 }, ...quicksand.map((q) => ({ ...q, kind: 'quicksand' }))],
  spawn: { x: 0, z: -24, facing: 0 },
  campfire: { x: -6, z: -19 },
  entries: { north: [0, -22], east: [24, -4], west: [-24, 4], south: [2, 10] },
  enemyTint: 0xe8cf98,
  climate: { kind: 'heat', rate: 1 / 38, recover: 0.3, every: 3, label: 'Жара' },
  areas: [
    { kind: 'water', x: -14, z: -12, r: 4.5, slow: 0.7 }, { kind: 'warm', x: -14, z: -12, r: 8.5 }, { kind: 'warm', x: 14, z: -21, r: 3.5 },
    { kind: 'warm', x: 0, z: 15, r: 4.5 }, { kind: 'warm', x: -15, z: -22, r: 3.5 }, ...quicksand, storm,
  ],
  props: [
    ['@nature/campfire_stones', -6, -19, 0, 1.6, 'round'],
    ...oasisPalms,
    ['@nature/tent_detailedClosed', -10, -23.5, 10, 3, 'round'], ['@nature/tent_detailedClosed', -20, -19, 60, 3, 'round'], ['@nature/pot_large', -12.5, -21, 0, 0.9, 'round'],
    ['@nature/tent_detailedOpen', 14.5, -21.5, -20, 3.2, 'round'], ['@nature/pot_small', 11, -21, 0, 0.6, 'round'], ['@nature/pot_large', 17.5, -19, 0, 0.9, 'round'],
    // the caravan's goods around the cart (the cart itself is the object to protect)
    ['crate_long_A', -7, -6, 20, 1.8, 'box'], ['sack', -1.5, -10, 0, 0.9, 'round'], ['barrel', -6.5, -10.5, 0, 0.9, 'round'],
    // ruins
    ['@nature/statue_column', 19.5, -12.5, 0, 1.4, 'round'], ['@nature/statue_columnDamaged', 22.5, -9, 30, 1.4, 'round'], ['@nature/statue_block', 24, -14.5, 15, 1.6, 'box'],
    ['@nature/statue_columnDamaged', 18, 19, 70, 1.4, 'round'], ['@nature/statue_column', -21, 19, 0, 1.4, 'round'],
    // the palace
    ['building_castle_yellow', 0, 22, 180, 11, 'box'], ['building_tower_A_yellow', -9, 19.5, 0, 4, 'round'], ['building_tower_A_yellow', 9, 19.5, 0, 4, 'round'],
    ['building_market_yellow', -18, 22.5, 0, 6, 'box'], ['building_home_A_yellow', 18.5, 22.5, 200, 5, 'box'], ['building_well_yellow', -19, -4, 0, 2.2, 'round'],
    ...scatter('desert:bits', desertBits, 30, [-27, -27, 27, 27], keep, 4),
  ],
  scenery: [
    ...belt('desert:belt', [['hills_A', 16], ['hills_B', 16], ['hills_C', 14], ['mountain_A', 18]], 28, { skip: [[0, -31, 7]] }),
    ['flag_yellow', -5, 15, 0, { h: 3 }], ['flag_yellow', 5, 15, 0, { h: 3 }],
    ['@nature/lily_large', -13, -11, 0, 1], ['@nature/lily_large', -15.5, -13.5, 0, 0.8],
  ],
  signs: [{ x: 3.5, z: -24.5, rot: 0, text: '↑ Деревня' }],
  object: { model: 'wheelbarrow', scale: 2.4 },
  villagers: [
    { id: 'hasan', name: 'Караванщик Хасан', model: 'Barbarian', palette: 'sand', x: -5.5, z: -15, facing: 0.5,
      chatter: ['Песок везде: в сапогах, в бороде, даже в супе!', 'Без воды в пустыне никак. Отдыхай в тени и у оазиса.'] },
    { id: 'mirage', name: 'Гадалка Мираж', model: 'Mage', palette: 'gold', x: 12, z: -18, facing: -0.9, hold: ['1H_Wand'],
      chatter: ['Загадка: что бежит, но не ходит? Ручей! Хи-хи.', 'Вижу в шаре… тебя! И много-много скелетов. Ой.'] },
    { id: 'ali', name: 'Водонос Али', model: 'Rogue', palette: 'sand', x: -19, z: -7, facing: 0.8,
      chatter: ['Вода из колодца оазиса — самая вкусная на острове!', 'Не стой в зыбучих песках — затянут!'] },
    { id: 'head', name: 'Каменная голова', prop: '@nature/statue_head', size: 1.8, x: -4.5, z: 12.5, facing: Math.PI, fixed: true,
      chatter: ['ТЫ… ПРОЙДЁШЬ… КОГДА… БУРЯ… СТИХНЕТ.', 'Я… СТЕРЕГУ… ЭТОТ… ДВОРЕЦ… ТЫСЯЧУ… ЛЕТ.'] },
  ],
  queen: { name: 'Королева Зарина', model: 'Mage', palette: 'gold', crown: '#ffb42e', x: 0, z: 14, facing: Math.PI, fixed: true, throne: 'sand',
    crest: { color: '#d99a2b', symbol: '☀️' },
    chatter: ['…'], thanks: ['Солнце снова светит над дюнами, {name}.', 'Загадка от королевы: у кого семь корон, но ни одной головы? У нашего острова!'] },
  gates: [{ id: 'toVillage', to: 'village', x: 0, z: -26.5, w: 4, arrive: { x: 0, z: 22.5, facing: Math.PI } }],
};

export const lines = [{
  id: 'sand', zone: 'desert', title: 'Песчаная буря', requires: { flags: ['awakened'] }, gem: 'amber', blessing: 'sun', coins: 150, queen: 'hidden',
  steps: [
    { type: 'talk', npc: 'hasan', task: 'Поговори с караванщиком Хасаном', lines: [
      'Салам, {name}! Хорошо, что ты пришёл. Буря засыпает дворец королевы Зарины.',
      'Королева заперлась внутри, а у ворот бродят песчаные скелеты.',
      'Гадалка Мираж говорит: бурю успокоят три древних обелиска. Попади в каждый — и они зажгутся.',
    ], hint: 'Жара! Отдыхай в тени пальм, шатров и у оазиса' },
    { type: 'targets', style: 'obelisk', r: 0.8, task: 'Зажги древние обелиски', targets: obelisks },
    { type: 'protect', task: 'Защити караван Хасана', banner: 'Песчаные скелеты нападают на караван!', object: { x: -4, z: -8, hp: 8, r: 1.2, name: 'Караван' },
      waves: [[['burrower', 3, 'east'], ['grunt', 2, 'west']], [['burrower', 3, 'south'], ['grunt', 2, 'east'], ['shooter', 1, 'west']]],
      hint: 'Скелеты бьют по повозке — не подпускай их' },
    { type: 'reach', task: 'Иди ко дворцу королевы', banner: 'Буря стихает…', at: [0, 10, 3] },
    { type: 'boss', task: 'Победи Песчаного фараона', banner: 'Песчаный фараон!', at: [0, 6],
      boss: { name: 'Песчаный фараон', model: 'Skeleton_Mage', scale: 2.1, hp: 14, speed: 1.5, moves: ['blink', 'volley', 'summon'], summon: ['burrower', 2],
        phases: [{ at: 0.5, moves: ['blink', 'volley', 'summon', 'volley'], every: 2.6, text: 'Фараон призывает бурю!' }] } },
    { type: 'talk', npc: 'queen', queen: 'awake', task: 'Поговори с королевой Зариной', lines: [
      'Ворота открыты… и буря стихла. Значит, ты разгадал загадку пустыни, {name}.',
      'Я — Зарина, королева песков. Фараон-самозванец держал меня во дворце, пока песок засыпал моё царство.',
      'Вот мой янтарь — в нём живёт свет полуденного солнца.',
      'И моё благословение — «Солнечный камень». Теперь твоё оружие будет светиться: с ним ты не пропадёшь даже в самой тёмной пещере.',
    ] },
  ],
},
  {
    id: 'ali-jugs', zone: 'desert', title: 'Кувшины для оазиса', side: true, requires: { done: ['sand'] }, coins: 90,
    steps: [
      { type: 'talk', npc: 'ali', task: 'Поговори с водоносом Али', lines: [
        'Буря кончилась, но разбросала мои кувшины по всей пустыне!',
        'Без них я не донесу воду до дворца. Найди четыре — они блестят на солнце. И не забывай отдыхать в тени!',
      ] },
      { type: 'collect', task: 'Найди кувшины в песках', item: 'jug', items: [[-2, 2], [13, -10], [-11, 0], [7, 13]] },
      { type: 'talk', npc: 'ali', task: 'Отнеси кувшины Али', lines: [
        'Все четыре! И ни одной трещинки.',
        'Мой дед говорил: оазис — это слеза королевы Зарины, упавшая в песок в день её рождения. Поэтому вода там самая вкусная.',
      ] },
    ],
  },
  {
    id: 'head-riddle', zone: 'desert', title: 'Загадка Каменной головы', side: true, requires: { done: ['ali-jugs'] }, coins: 120,
    steps: [
      { type: 'talk', npc: 'head', task: 'Поговори с Каменной головой', lines: [
        'ТЫ… ВЕРНУЛ… СОЛНЦЕ… ПУСТЫНЕ.',
        'Я… НЕ… ПРОСТО… ГОЛОВА. Я… ЗОДЧИЙ. Я… СТАЛ… КАМНЕМ… ЧТОБЫ… СТЕРЕЧЬ.',
        'ПРИНЕСИ… ТРИ… СОЛНЕЧНЫХ… КАМНЯ… ИЗ… РУИН. И… Я… РАССКАЖУ.',
      ] },
      { type: 'collect', task: 'Найди солнечные камни в руинах', item: 'sunstone', items: [[21, -14], [14, 21], [-21, 19]] },
      { type: 'talk', npc: 'head', task: 'Отнеси камни Каменной голове', lines: [
        'МЫ… ПРИШЛИ… СО… ЗВЁЗД… НА… ЛОДКАХ… ИЗ… СВЕТА.',
        'МЫ… ПОСТРОИЛИ… КРИСТАЛЛ… И… УШЛИ… НА… НЕБЕСНЫЕ… ОСТРОВА. А… Я… ОСТАЛСЯ.',
        'ПРОЧТИ… ЛЕТОПИСЬ… ГЕРОЙ.',
      ] },
    ],
  },
];
