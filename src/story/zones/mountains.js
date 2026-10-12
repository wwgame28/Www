// Горное царство — Горы Агаты (west of the village). Rocky paths under falling stones, a windy
// plateau, the miners' camp, the blocked mine, the red fortress, and the pass to the snow kingdom
// behind a chasm only «Рывок» can cross.
import { clearOf, scatter, belt } from './util.js';

const roads = [[[28, 4], [18, 6], [6, 2], [-6, -2], [-12, -3]], [[6, 2], [2, -8], [0, -14]], [[6, 2], [0, 12], [-10, 18], [-19, 20]], [[18, 6], [18, 14]]];
const boulders = [[-11.5, -7], [-10.5, -3], [-11.5, 1], [-8, -5]];
const chasm = { x: -21, z0: 13.5, z1: 28 };
const keep = clearOf(roads, [
  [24, 4, 4], [18, 9, 3.5], [20, 5.5, 2.5], [15.5, 13, 2.5], [22.5, 13.5, 2.5], [0, -14.5, 4.5], [-14.5, -3, 5],
  ...boulders.map(([x, z]) => [x, z, 2.4]), [chasm.x, 20.5, 5], [-24.5, 21, 4], [-16, 21, 3],
]);
const rocks = [['@nature/rock_tallA', 2.2, 'round'], ['@nature/rock_tallC', 1.8, 'round'], ['@nature/rock_tallG', 2, 'round'], ['@nature/stone_tallB', 2, 'round'],
  ['@nature/stone_tallE', 1.8, 'round'], ['rock_single_A', 2, 'round'], ['rock_single_C', 1.8, 'round'], ['@nature/tree_pineTallA', { h: 6 }, 'trunk'], ['@nature/tree_pineTallB', { h: 6.5 }, 'trunk']];

export const zone = {
  id: 'mountains', name: 'Горы Агаты', kit: 'hex', size: { W: 28, D: 28 }, sky: 'morning',
  look: { fog: 0xb6b8c4, near: 26, far: 74, hemi: [0xe0e4f0, 0x5a5048, 1.25], sun: [0xfff0dc, 2.3], sunPos: [10, 16, 4] },
  ground: 0x8e8778, road: 0xa08868, roads,
  paint: [{ kind: 'chasm', x: chasm.x, z: (chasm.z0 + chasm.z1) / 2, w: 2.4, d: chasm.z1 - chasm.z0 }],
  spawn: { x: 24, z: 4, facing: -Math.PI / 2 },
  campfire: { x: 18, z: 9 },
  entries: { west: [-22, 6], north: [2, -12], south: [6, 22], mine: [-13.5, -3] },
  enemyTint: 0xc4bcb2,
  rockfall: { every: 3.2, fall: 1.2, rect: { x: 2, z: -3, w: 34, d: 26 }, until: 'stone' },
  areas: [{ kind: 'push', look: 'wind', x: -14, z: -16, w: 24, d: 18, dir: [0.98, 0.2], strength: 3, period: 9, on: 2, warn: 1.2, shot: 1.8 }],
  // The chasm (only a dash crosses it) and the cliff that closes the pass from the north.
  walls: [{ from: [chasm.x, chasm.z0], to: [chasm.x, chasm.z1 + 1], r: 0.9, chasm: true }, { from: [-29, 13], to: [chasm.x - 0.5, 13], r: 0.8 }],
  props: [
    ['@nature/campfire_stones', 18, 9, 0, 1.6, 'round'],
    // the miners' camp
    ['building_home_A_red', 23.5, 19.5, 200, 5, 'box'], ['building_blacksmith_red', 13.5, 20.5, 180, 6, 'box'], ['building_home_B_red', 24, -9, 260, 5, 'box'],
    ['pallet', 20.5, 1, 20, 1.6, 'box'], ['crate_long_B', 16, 2.5, 80, 1.8, 'box'], ['ladder', 22, 9.5, 0, 1.6, 'cap'], ['resource_stone', 13.5, 8, 0, 2, 'round'],
    // the mine and its rubble
    ['building_mine_red', -19.5, -3, 90, 7, 'box'], ['resource_stone', -16, -9, 30, 2, 'round'], ['crate_long_A', -15.5, 3.5, 10, 1.8, 'box'],
    // the fortress
    ['building_castle_red', 0, -22, 0, 10, 'box'], ['building_tower_A_red', -8.5, -19, 0, 4, 'round'], ['building_tower_A_red', 8.5, -19, 0, 4, 'round'],
    ['building_tower_base_red', -16, -21, 0, 3.5, 'round'], ['flag_red', -4.5, -16.5, 0, { h: 3 }, 'trunk'], ['flag_red', 4.5, -16.5, 0, { h: 3 }, 'trunk'],
    // the cliff along the pass
    ...[-27.5, -25, -22.5].map((x, i) => ['@nature/cliff_block_rock', x, 12.4, i * 90, 2.6, 'box']),
    ...scatter('mountains:rocks', rocks, 40, [-27, -27, 27, 27], keep, 3.8),
  ],
  scenery: [
    ...belt('mountains:belt', [['mountain_A', 22], ['mountain_B', 22], ['mountain_C', 20], ['mountain_C_grass_trees', 20]], 28, { skip: [[31, 4, 7]] }),
    ['building_bridge_A', chasm.x, 19.5, 90, 3.4], // the broken bridge's stub
    ['@nature/rock_largeF', chasm.x - 1.8, 15, 40, 1.6], ['@nature/rock_largeF', chasm.x + 1.8, 26, 200, 1.6],
    ['weaponrack', 17, 16.5, 180, 1.4], ['crate_A_big', 24.5, 11, 0, 1.1],
  ],
  signs: [{ x: 24, z: 0.5, rot: -90, text: 'Деревня →' }, { x: -17, z: 18, rot: 90, text: '← Снежный перевал' }],
  villagers: [
    { id: 'flint', name: 'Бригадир Кремень', model: 'Barbarian', palette: 'stone', x: 20, z: 5.5, facing: -Math.PI / 2, hold: ['2H_Axe'],
      chatter: ['В горах главное — смотреть вверх. Видишь тень — отходи!', 'Наша королева Агата сама машет киркой. Сильнее неё никого нет!'] },
    { id: 'gear', name: 'Механик Шестерня', model: 'Knight', tint: 0xb0b4bc, x: 15.5, z: 13, facing: 2.2,
      chatter: ['Мост через пропасть рухнул. Перепрыгнуть её может только тот, у кого есть рывок.', 'Ветер на плато такой, что сносит даже брошенный топор.'] },
    { id: 'ore', name: 'Горнячка Руда', model: 'Rogue', palette: 'stone', x: 22.5, z: 13.5, facing: -2.4,
      chatter: ['Каменные стражи раньше охраняли шахту. Теперь они слушают Короля скелетов.', 'За перевалом — Снежное царство. Там вечная зима.'] },
  ],
  queen: { name: 'Королева Агата', model: 'Knight', palette: 'stone', crown: '#ff4d5e', x: 0, z: -14.5, facing: 0, fixed: true, throne: 'stone',
    crest: { color: '#b33a3a', symbol: '⛏️' },
    chatter: ['…'], thanks: ['Шахта снова работает, {name}. Заходи в гости — покажу рубиновую жилу.', 'Рывок пригодится тебе на перевале. Снежана будет рада гостю.'] },
  gates: [
    { id: 'toVillage', to: 'village', x: 26.5, z: 4, w: 4, arrive: { x: -22.5, z: 4, facing: Math.PI / 2 } },
    { id: 'toSnow', to: 'snow', x: -26.5, z: 21, w: 4, requires: { blessings: ['dash'] }, closed: 'Мост рухнул. Нужен «Рывок» королевы Агаты', arrive: { x: 25.5, z: 20, facing: -Math.PI / 2 } },
  ],
};

export const lines = [{
  id: 'stone', zone: 'mountains', title: 'Гул в горах', requires: { flags: ['awakened'] }, gem: 'ruby', blessing: 'dash', coins: 150, queen: 'hidden',
  steps: [
    { type: 'talk', npc: 'flint', task: 'Поговори с бригадиром Кремнем', lines: [
      'Ну и грохот! Слышишь? Горы гудят с тех пор, как погас рубин королевы Агаты.',
      'Обвал запер шахту, а королева как раз спустилась туда спасать моих ребят.',
      'Разбей валуны у входа в шахту. И смотри вверх — камни сыплются!',
    ], hint: 'Видишь тень на земле — отбегай, сейчас упадёт камень' },
    { type: 'targets', style: 'boulder', r: 0.9, task: 'Разбей валуны у шахты', targets: boulders.map(([x, z]) => [x, z, 2]), hint: 'Каждый валун — с двух ударов' },
    { type: 'defend', task: 'Отбей каменных стражей', banner: 'Каменные стражи проснулись!',
      waves: [[['golem', 2, 'mine'], ['grunt', 2, 'west']], [['golem', 2, 'north'], ['grunt', 3, 'mine'], ['shooter', 1, 'west']]] },
    { type: 'reach', task: 'Войди в шахту', at: [-14.5, -3, 2.5], banner: 'Из шахты доносится гул…' },
    { type: 'boss', task: 'Победи Каменного великана', banner: 'Каменный великан!', at: [-13, -3], hint: 'Великана не пробить — пока он не оглушён после удара о землю',
      boss: { name: 'Каменный великан', model: 'Skeleton_Warrior', scale: 2.6, r: 1.1, hp: 9, speed: 1.2, vulnerable: 'stunned', moves: ['slam', 'charge', 'slam', 'summon'], summon: ['golem', 1], slamR: 4, stun: 2.4,
        phases: [{ at: 0.45, moves: ['slam', 'charge', 'summon'], speed: 1.5, text: 'Великан трясёт горы!' }] } },
    { type: 'talk', npc: 'queen', queen: 'awake', task: 'Поговори с королевой Агатой', lines: [
      'Фух! Спасибо, {name}. Этот великан держал меня в шахте, как в мышеловке.',
      'Я — Агата, королева гор. Мои шахтёры живы, а это главное.',
      'Вот мой рубин — пусть он вернётся в Кристалл.',
      'И моё благословение — «Рывок». Нажми ⚡, и ты рванёшь вперёд так быстро, что ни камень, ни скелет тебя не заденут. Пропасть на перевале тебе теперь не помеха.',
    ] },
  ],
},
  {
    id: 'gear-rubble', zone: 'mountains', title: 'Завал на дороге', side: true, requires: { done: ['stone'] }, coins: 100,
    steps: [
      { type: 'talk', npc: 'gear', task: 'Поговори с механиком Шестернёй', lines: [
        'Камнепад кончился, но дорогу к старой крепости завалило.',
        'Разбей валуны, {name}. Только бей сильно — каждый с двух ударов!',
      ] },
      { type: 'targets', style: 'boulder', r: 0.9, task: 'Разбей валуны на дороге', targets: [[8, 1, 2], [-1, 0, 2], [4, -12, 2], [-6, -15, 2]] },
      { type: 'talk', npc: 'gear', task: 'Вернись к механику Шестерне', lines: [
        'Дорога свободна! Теперь вагонетки снова поедут.',
        'Эти дороги начали строить Зодчие, а закончили горняки Агаты. Горняки умеют слушать камень — он им поёт.',
      ] },
    ],
  },
  {
    id: 'ore-guardian', zone: 'mountains', title: 'Последний страж', side: true, requires: { done: ['gear-rubble'] }, coins: 130,
    steps: [
      { type: 'talk', npc: 'ore', task: 'Поговори с горнячкой Рудой', lines: [
        'Один каменный страж так и не уснул. Он бродит у старой крепости и никого не пускает.',
        'Он не злой — его заколдовал Король скелетов. Победи его, и чары спадут.',
      ] },
      { type: 'boss', task: 'Победи Древнего стража', banner: 'Древний страж!', at: [-1, -11],
        boss: { name: 'Древний страж', model: 'Skeleton_Warrior', scale: 1.9, r: 0.9, hp: 8, speed: 1.3, moves: ['charge', 'slam', 'summon'], summon: ['grunt', 2], slamR: 3.2 } },
      { type: 'talk', npc: 'ore', task: 'Вернись к горнячке Руде', lines: [
        'Страж уснул… и улыбается во сне. Спасибо, {name}.',
        'Горняки сложат про тебя песню. Слова я уже придумала, а мотив — за Кремнём.',
      ] },
    ],
  },
];
