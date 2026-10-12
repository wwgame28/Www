// Снежное царство — Пики Снежаны (over the mountain pass). Eternal blizzard and cold, log cabins
// with snowy roofs, reindeer, a frozen lake, the ice palace and the queen frozen in ice.
import { clearOf, scatter, belt } from './util.js';

const roads = [[[28, 20], [18, 16], [10, 10], [2, 8]], [[10, 10], [14, 0], [16, -10]], [[2, 8], [-6, 10], [-14, 8]], [[0, -11], [0, -16]]];
const lanterns = [[-10, 2], [9.5, -7.5], [-4, -10.5]];
const crystals = [[-21, -12], [22, -19], [-18, 19], [5, 21]];
const lake = { x: 0, z: -1, r: 8.5 };
const keep = clearOf(roads, [
  [24, 20, 4], [18, 14, 3.5], [2.5, 18, 2], [15.5, 16.5, 2.5], [0, -14, 4.5], [-4.5, -13, 2], [11, 9.5, 2], [-14, 8, 2.5], [lake.x, lake.z, lake.r + 1.5],
  [17, 5, 4.5], [21, -7, 4.5], [13, -15, 4.5], ...lanterns.map(([x, z]) => [x, z, 2.4]), ...crystals.map(([x, z]) => [x, z, 2.2]),
]);
const pines = [['@holiday/tree-snow-a', { h: 6 }, 'trunk'], ['@holiday/tree-snow-b', { h: 5 }, 'trunk'], ['@holiday/tree-snow-c', { h: 6.5 }, 'trunk'],
  ['@holiday/rocks-large', 2.4, 'round'], ['@holiday/rocks-medium', 1.6, 'round'], ['@holiday/snow-pile', 1.6, 'round']];
const cabin = (x, z, rot) => ['#cabin', x, z, rot, 4.6, 'box'];

export const zone = {
  id: 'snow', name: 'Пики Снежаны', kit: 'hex', size: { W: 28, D: 28 }, sky: 'morning',
  look: { fog: 0xd6e2ee, near: 14, far: 50, hemi: [0xf0f6ff, 0x7a8aa0, 1.2], sun: [0xe6f0ff, 1.7] },
  lookDone: { fog: 0xe4eef8, near: 30, far: 85, hemi: [0xf6faff, 0x8a9ab0, 1.35], sun: [0xfff6e8, 2.3] },
  weather: 'snow', weatherDone: 'flakes',
  ground: 0xeef3f8, road: 0xc8d6e4, roads,
  paint: [{ kind: 'ice', ...lake }],
  spawn: { x: 24, z: 20, facing: -Math.PI / 2 },
  campfire: { x: 18, z: 14 },
  entries: { north: [0, -16], west: [-22, 0], east: [22, 0], south: [2.5, 18] },
  enemyTint: 0xc4ecff,
  frostTouch: true,
  climate: { kind: 'cold', rate: 1 / 32, recover: 0.3, every: 3, label: 'Холод' },
  areas: [
    { kind: 'ice', ...lake, friction: 1.3 },
    { kind: 'drift', x: -19, z: -2, r: 4 }, { kind: 'drift', x: 8, z: 18, r: 3.5 },
    { kind: 'warm', x: 17, z: 5, r: 4 }, { kind: 'warm', x: 21, z: -7, r: 4 }, { kind: 'warm', x: 13, z: -15, r: 4 },
  ],
  prefabs: {
    // A log cabin 1 × 2 tiles of the Holiday Kit with a snowy gable roof (native units).
    cabin: { box: [1.3, 2.5, 2.3], pieces: [
      ['@holiday/cabin-doorway', 0, 0, 0.5, 0], ['@holiday/cabin-window-a', 0, 0, -0.5, 180],
      ['@holiday/cabin-wall', 0, 0, -0.5, 90], ['@holiday/cabin-window-a', 0, 0, 0.5, 90],
      ['@holiday/cabin-wall', 0, 0, -0.5, -90], ['@holiday/cabin-wall', 0, 0, 0.5, -90],
      ['@holiday/cabin-corner', 0, 0, 0.5, 0], ['@holiday/cabin-corner', 0, 0, 0.5, 90], ['@holiday/cabin-corner', 0, 0, -0.5, 180], ['@holiday/cabin-corner', 0, 0, -0.5, -90],
      ['@holiday/cabin-roof-snow-point', 0, 1, -0.5, 0], ['@holiday/cabin-roof-snow-point', 0, 1, 0.5, 0],
    ] },
  },
  props: [
    ['@nature/campfire_stones', 18, 14, 0, 1.6, 'round'],
    cabin(17, 5, -90), cabin(21, -7, -90), cabin(13, -15, 0),
    // the ice palace
    ['building_castle_blue', 0, -22, 0, 10, 'box', { tint: 0xdff4ff }], ['building_tower_A_blue', -8.5, -19, 0, 4, 'round', { tint: 0xdff4ff }],
    ['building_tower_A_blue', 8.5, -19, 0, 4, 'round', { tint: 0xdff4ff }],
    ['@holiday/sled-long', 21.5, 11, 30, 2.2, 'cap'], ['@holiday/sled', 14, 17.5, -20, 1.4, 'cap'], ['@holiday/present-a-cube', 15, 7.5, 0, 0.8, 'box'],
    ['@holiday/present-b-round', 18.5, 1.5, 0, 0.8, 'round'], ['@holiday/bench', 9, 13.5, 30, 1.8, 'cap'], ['@holiday/snow-bunker', -20, 12, 40, 2.6, 'round'],
    ['@holiday/tree-decorated-snow', 10.5, 16.5, 0, { h: 4 }, 'trunk'],
    ...scatter('snow:pines', pines, 36, [-27, -27, 27, 27], keep, 4),
  ],
  scenery: [
    ...belt('snow:belt', [['@holiday/tree-snow-a', 7], ['@holiday/tree-snow-c', 8], ['mountain_A', 20], ['mountain_B', 22], ['@holiday/rocks-large', 6]], 28, { gap: 5, skip: [[31, 20, 7]] }),
    ['@holiday/reindeer', 20.5, 17.5, -40, { h: 1.6 }], ['@holiday/reindeer', 22.5, 15, -80, { h: 1.5 }],
    ['@holiday/snow-flat-large', -8, 16, 0, 5], ['@holiday/snow-flat', 12, -2, 30, 3], ['@holiday/lights-colored', 17, 9.2, 0, 2.4],
    ...[[-5, -16], [5, -16]].map(([x, z]) => ['@holiday/lantern', x, z, 0, { h: 2.2 }]),
  ],
  signs: [{ x: 24.5, z: 16.5, rot: -90, text: 'Горы →' }],
  villagers: [
    { id: 'sever', name: 'Оленевод Север', model: 'Knight', palette: 'snow', x: 15.5, z: 16.5, facing: 2.6, hold: ['2H_Sword'],
      chatter: ['Олени чуют метель за день. В этот раз они не уходят из загона уже месяц.', 'Грейся у костра! Тут без огня не выжить.'] },
    { id: 'nutcracker', name: 'Щелкунчик-страж', prop: '@holiday/nutcracker', size: 1.7, x: -4.5, z: -13, facing: 0, fixed: true,
      chatter: ['Стоять! Ать-два! Королеву охраняю я!', 'Королева Снежана застыла во льду, а я — на посту. Ать-два.'] },
    { id: 'vanilka', name: 'Пряничная Ванилька', prop: '@holiday/gingerbread-woman', size: 0.9, x: 11, z: 9.5, facing: 2.2,
      chatter: ['Я пеку самые сладкие пряники на острове! Хрум!', 'Только не ешь меня, ладно?'] },
    { id: 'knopka', name: 'Снеговик Кнопка', prop: '@holiday/snowman-hat', size: 1.7, x: -14, z: 8, facing: 1.2,
      chatter: ['Морковка — это мой нос. Не трогай!', 'Мне в метель хорошо, а вот остальным холодно…'] },
  ],
  queen: { name: 'Королева Снежана', model: 'Rogue', palette: 'snow', crown: '#e8f6ff', x: 0, z: -14, facing: 0, fixed: true, throne: 'snow',
    crest: { color: '#7ab8e8', symbol: '❄️' },
    chatter: ['…'], thanks: ['Метели больше нет, {name}. Приходи кататься на санках!', 'Иней — подарок от меня. Заморозь Короля скелетов!'] },
  gates: [{ id: 'toMountains', to: 'mountains', x: 26.5, z: 20, w: 4, arrive: { x: -24.5, z: 21, facing: Math.PI / 2 } }],
};

export const lines = [{
  id: 'snow', zone: 'snow', title: 'Вечная метель', requires: { blessings: ['dash'] }, gem: 'diamond', blessing: 'frost', coins: 150, queen: 'frozen',
  steps: [
    { type: 'talk', npc: 'sever', task: 'Поговори с оленеводом Севером', lines: [
      'Ты перепрыгнул пропасть? Ну и ну! Добро пожаловать в Снежное царство, {name}.',
      'Метель не утихает с тех пор, как погас алмаз королевы Снежаны. Сама королева застыла во льду у своего дворца.',
      'Зажги три фонаря вокруг озера. Их тёплый свет отгонит метель.',
    ], hint: 'Холодно! Грейся у костра, у домиков и у зажжённых фонарей' },
    { type: 'targets', style: 'lantern', task: 'Зажги фонари у озера', targets: lanterns },
    { type: 'talk', npc: 'knopka', task: 'Поговори со снеговиком Кнопкой', lines: [
      'Привет! Я Кнопка. Я знаю, как растопить лёд вокруг королевы!',
      'Нужны четыре ледяных кристалла — в них спрятано тепло старого солнца. Звучит странно, но это правда!',
      'Они блестят в снегу по краям царства. Удачи — и не замёрзни!',
    ] },
    { type: 'collect', task: 'Собери ледяные кристаллы', item: 'crystal', items: crystals },
    { type: 'defend', task: 'Отбей ледяных скелетов', banner: 'Ледяные скелеты идут на дворец!',
      waves: [[['grunt', 3, 'north'], ['runner', 2, 'west']], [['tank', 1, 'north'], ['grunt', 3, 'east'], ['runner', 2, 'south']]], hint: 'Касание ледяного скелета замедляет' },
    { type: 'boss', task: 'Победи Хозяина Вьюги', banner: 'Хозяин Вьюги!', at: [0, -4],
      boss: { name: 'Хозяин Вьюги', model: 'Skeleton_Warrior', scale: 2.3, hp: 14, speed: 1.6, moves: ['volley', 'summon', 'charge'], summon: ['grunt', 2], volley: 6, spread: 1.2,
        phases: [{ at: 0.5, moves: ['volley', 'charge', 'volley', 'summon'], speed: 2, text: 'Вьюга усиливается!' }] } },
    { type: 'talk', npc: 'queen', queen: 'awake', task: 'Поговори с королевой Снежаной', lines: [
      'Как… тепло. Лёд растаял? Это ты, {name}?',
      'Я — Снежана, королева снегов. Хозяин Вьюги заморозил меня в тот день, когда погас мой алмаз.',
      'Возьми алмаз — он чище любого льда. Отнеси его в Кристалл.',
      'И вот моё благословение — «Иней». Каждый твой удар будет замораживать врага.',
    ] },
  ],
}];
