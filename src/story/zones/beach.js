// Царство морей — Пляж Ундины (east of the village). Sand, palms, a harbor town and a pier, the
// lighthouse, the shallows where waves roll in, the Queen of the Seas on her rock — and her portrait
// on a big sign at the way into the harbor.
import { clearOf, scatter, belt } from './util.js';

const roads = [[[-28, 2], [-12, 2], [0, 4], [8, 8], [12, 12]], [[-12, 2], [-14, 10], [-14, 22]], [[0, 4], [2, -8], [1, -16]], [[2, -8], [9, -15], [11, -18]]];
const braziers = [[9.5, -12], [11, -1.5], [9, 18]];
const pearls = [[18, -6], [22, 4], [17, 19], [4, -11], [21, -16]];
const keep = clearOf(roads, [
  [-24, 2, 4], [-17, -3, 3], [-12, 3, 2.5], [7, 9, 2.5], [-6, 17, 2.5], [10.5, -17.5, 2.5], [0, -19, 4.5], [-4, 8, 3.5],
  ...braziers.map(([x, z]) => [x, z, 2.5]), ...pearls.map(([x, z]) => [x, z, 2]), [15, -2, 5], [13, -21, 4],
]);
const palms = [['@nature/tree_palm', { h: 5.5 }, 'trunk'], ['@nature/tree_palmBend', { h: 5 }, 'trunk'], ['@nature/tree_palmTall', { h: 7 }, 'trunk'],
  ['@nature/tree_palmDetailedShort', { h: 4.5 }, 'trunk'], ['@nature/tree_palmDetailedTall', { h: 6.5 }, 'trunk'], ['@nature/tree_palmShort', { h: 4 }, 'trunk']];
const shore = [['@nature/rock_largeC', 1.8, 'round'], ['@nature/rock_smallA', 0.9, 'round'], ['@nature/stone_largeB', 1.5, 'round'], ['@nature/plant_bush', 1.1, 'round']];
const water = [{ kind: 'water', x: 21, z: -8.5, w: 14, d: 39 }, { kind: 'water', x: 21, z: 20.5, w: 14, d: 15 }];

export const zone = {
  id: 'beach', name: 'Царство морей', kit: 'hex', size: { W: 28, D: 28 }, sky: 'day',
  look: { fog: 0x8ea3b6, near: 22, far: 66, hemi: [0xc2d2e2, 0x4d5b52, 1.05], sun: [0xd8e4f0, 1.5] },
  lookDone: { fog: 0xc4e6f4, near: 30, far: 85, hemi: [0xe8f4ff, 0x6b7a5a, 1.35], sun: [0xfff2d8, 2.5] },
  weather: 'rain', weatherDone: null,
  ground: 0xe6cf98, road: 0xc8a46c, roads,
  paint: [...water.map((w) => ({ ...w, kind: 'shallow' })), { kind: 'shallow', x: 21, z: 12, w: 14, d: 2 }],
  sea: { x: 14 }, // open sea east of x = 14 (render)
  spawn: { x: -24, z: 2, facing: 2.1 }, // looking at the queen's portrait
  campfire: { x: -6, z: 8 },
  entries: { sea1: [19, -5.5], sea2: [18, 6], sea3: [19, 18], north: [-4, -24] },
  enemyTint: 0x8fd6cf,
  areas: [...water, { kind: 'push', look: 'wave', x: 21, z: 0, w: 14, d: 56, dir: [-1, 0], strength: 2.6, period: 8, on: 1.8, warn: 1.2, shot: 0.3 }],
  props: [
    ['@nature/campfire_stones', -6, 8, 0, 1.6, 'round'],
    // the harbor town
    ['building_tavern_blue', -16, 15, 0, 7, 'box'], ['building_home_A_blue', -22, 22, 20, 5.5, 'box'], ['building_home_B_blue', -8, 23.5, 180, 5.5, 'box'],
    ['building_market_blue', -20.5, 7, 90, 6.5, 'box'], ['building_home_B_blue', -22, -12, 60, 5.5, 'box'],
    ['crate_A_big', 7.5, 15, 15, 1.2, 'box'], ['barrel', 9.5, 16, 0, 0.9, 'round'], ['crate_long_A', 5.5, 10.5, 70, 1.8, 'box'], ['sack', 4.5, 13, 0, 0.9, 'round'],
    ['barrel', -11, 9, 0, 0.9, 'round'], ['crate_B_big', -12, 10.5, 30, 1.2, 'box'],
    // the lighthouse on its rocks
    ['building_tower_A_blue', 13, -21.5, 0, 4.6, 'round'], ['@nature/rock_largeD', 16.5, -23.5, 30, 2.4, 'round'], ['@nature/rock_tallA', 9.5, -24.5, 0, 1.8, 'round'],
    // the queen's rock
    ['@nature/rock_largeF', -3.5, -22, 0, 3, 'round'], ['@nature/rock_largeE', 4, -22.5, 90, 2.6, 'round'],
    // rocks in the shallows and pier posts: things to bank a throw off
    ['@nature/rock_largeC', 19, -9.5, 0, 2.2, 'round'], ['@nature/rock_largeD', 21.5, 2.5, 60, 2, 'round'], ['@nature/rock_largeC', 24, -18, 120, 2.4, 'round'],
    ...[15, 19, 23].flatMap((x) => [['@nature/stump_round', x, 10.7, 0, 0.55, 'round'], ['@nature/stump_round', x, 13.3, 0, 0.55, 'round']]),
    // canoes on the sand
    ['@nature/canoe', 8.5, -6, 20, 2.4, 'cap'], ['@nature/canoe', 11.5, 5, -30, 2.4, 'cap'], ['@nature/canoe_paddle', 7, -4.5, 60, 1.2, 'cap'],
    ...scatter('beach:palms', palms, 26, [-27, -27, 13, 27], keep, 3.6),
    ...scatter('beach:shore', shore, 14, [-26, -26, 13, 26], keep, 3),
  ],
  scenery: [
    // the pier
    ...[12, 14, 16, 18, 20, 22, 24].map((x) => ['@nature/path_wood', x, 12, 90, 2.2]),
    ...belt('beach:belt', [['mountain_A_grass_trees', 18], ['hills_A_trees', 14], ['hills_B_trees', 14]], 28, { skip: [[-31, 2, 7], [34, 0, 90]] }),
    ['@nature/tree_palmTall', -24, -24, 0, { h: 7 }], ['@nature/tree_palmBend', -26, 26, 80, { h: 6 }],
    ['waterplant_A', 17, -14, 0, 1], ['waterplant_B', 23, 9, 0, 1], ['waterlily_A', 18, 22, 0, 1],
  ],
  signs: [{ x: -24, z: -1.5, rot: 90, text: '← Деревня' }],
  portraits: [{ x: -17, z: -3, rot: -60, image: 'queen-sea', title: 'Царица морей Ундина', big: true }],
  villagers: [
    { id: 'briz', name: 'Капитан Бриз', model: 'Knight', palette: 'sea', x: -12, z: 3.5, facing: -Math.PI / 2, hold: ['1H_Sword'],
      chatter: ['Море — как Царица: красивое, но с характером.', 'Говорят, Капитан Утопленник когда-то был лучшим моряком гавани.'] },
    { id: 'perla', name: 'Рыбачка Перла', model: 'Rogue', palette: 'sea', x: 7, z: 8.5, facing: Math.PI / 2,
      chatter: ['Рыба ушла на глубину — боится шторма.', 'Видел вывеску у входа в гавань? Это наша Царица Ундина!'] },
    { id: 'kai', name: 'Юнга Кай', model: 'Rogue_Hooded', palette: 'sea', x: -6, z: 17.5, facing: 0.6,
      chatter: ['Когда вырасту, стану капитаном!', 'Я видел, как утопленники выходят из воды. Брр!'] },
    { id: 'faros', name: 'Смотритель маяка Фарос', model: 'Mage', tint: 0xe8f0ff, x: 10.5, z: -17.5, facing: -0.6, hold: ['2H_Staff'],
      chatter: ['Маяк гаснет вместе с камнем Царицы. Всё связано, {name}.', 'Сверху видно всё море. Даже корабль-призрак на горизонте.'] },
  ],
  queen: { name: 'Царица морей Ундина', model: 'Rogue_Hooded', palette: 'sea', crown: '#3fd6ff', x: 0, z: -19, facing: 0, fixed: true, throne: 'sea', portrait: 'queen-sea',
    chatter: ['Шторм не слушается меня… Помоги капитану Бризу, путник.'],
    thanks: ['Море спокойно, {name}. Можешь искупаться — только не дразни крабов.', 'Моя сестра Флора живёт в лесу. Мы спорим, что красивее — волны или листья.'] },
  gates: [{ id: 'toVillage', to: 'village', x: -26.5, z: 2, w: 4, arrive: { x: 22.5, z: 2, facing: -Math.PI / 2 } }],
};

export const lines = [{
  id: 'sea', zone: 'beach', title: 'Буря над гаванью', requires: { flags: ['awakened'] }, gem: 'aquamarine', blessing: 'wave', coins: 150,
  steps: [
    { type: 'talk', npc: 'briz', task: 'Поговори с капитаном Бризом', lines: [
      'Эй, на берегу! Ты, видно, {name} — о тебе уже шепчутся чайки.',
      'Неделю над гаванью шторм. Камень в короне Царицы Ундины погас, и море перестало её слушаться.',
      'Корабли не видят берега. Зажги три сигнальных костра у воды — пусть знают, куда плыть.',
    ] },
    { type: 'targets', style: 'brazier', task: 'Зажги сигнальные костры', targets: braziers, hint: 'Попади оружием в костёр, чтобы зажечь его' },
    { type: 'talk', npc: 'perla', task: 'Поговори с рыбачкой Перлой', lines: [
      'Костры горят! Спасибо, {name}.',
      'Утопленники разорвали ожерелье Царицы, и жемчуг рассыпался по отмели.',
      'Собери пять жемчужин. Только осторожно — волны сбивают с ног!',
    ] },
    { type: 'collect', task: 'Собери жемчуг Царицы', item: 'pearl', items: pearls, hint: 'Волна накатывает с моря — пережди её или беги' },
    { type: 'defend', task: 'Отбей утопленников', banner: 'Утопленники выходят из моря!',
      waves: [[['grunt', 3, 'sea1'], ['grunt', 2, 'sea2']], [['runner', 2, 'sea3'], ['grunt', 3, 'sea1'], ['shooter', 1, 'sea2']]] },
    { type: 'boss', task: 'Победи Капитана Утопленника', banner: 'Капитан Утопленник!', at: [15, -2], hint: 'У Капитана щит спереди. Увернись от рывка — он устанет, тогда бей! Или зайди сбоку',
      boss: { name: 'Капитан Утопленник', model: 'Skeleton_Rogue', scale: 2.2, hp: 12, speed: 1.5, shield: 'front', turn: 1.8, tired: 2, moves: ['charge', 'charge', 'volley'],
        phases: [{ at: 0.5, moves: ['charge', 'summon', 'charge', 'volley'], summon: ['grunt', 2], text: 'Капитан зовёт команду!' }] } },
    { type: 'talk', npc: 'queen', task: 'Поговори с Царицей морей', lines: [
      'Стой. Кто посмел вернуть свет в мой аквамарин? …А, это ты, {name}.',
      'Я — Ундина, Царица морей. Сто лет я правлю этим берегом, и ни разу шторм не длился так долго.',
      'Ты прогнал Капитана Утопленника и собрал мой жемчуг. Море снова слушает меня.',
      'Возьми аквамарин для Кристалла и моё благословение — «Волна». Твои броски станут быстрее и будут отскакивать на один раз больше.',
    ] },
  ],
}];
