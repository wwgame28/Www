// Подземное царство — Пещеры Обсидианы (down the village well). Darkness lit only by the glowing
// weapon, crystal braziers and glowing crystals; the black crystal that holds the queen; the Bone
// Throne of the Skeleton King.
import { clearOf, scatter, belt } from './util.js';

const roads = [[[0, 26], [0, 18], [-3, 8], [0, -4]], [[0, 18], [10, 10], [16, 7]], [[-3, 8], [-12, 6], [-16, 9]], [[0, -4], [-10, -8], [-15, -8]], [[0, -4], [10, -10], [15, -10]], [[0, -4], [0, -14]]];
const braziers = [[-16, 9], [16, 7], [-15, -8], [15, -10]];
const keep = clearOf(roads, [
  [0, 21, 4], [5, 19, 3], [-3, 19.5, 2.5], [9, 16, 2.5], [-9, 4, 2.5], [0, -4, 4], [0, -15, 6], [0, -21, 5], ...braziers.map(([x, z]) => [x, z, 2.6]),
]);
const rocks = [['@nature/rock_tallA', 2.4, 'round', { tint: 0x6a5a88 }], ['@nature/rock_tallC', 2, 'round', { tint: 0x5a4e78 }], ['@nature/stone_tallB', 2, 'round', { tint: 0x6a5a88 }],
  ['@nature/stone_tallE', 1.8, 'round', { tint: 0x5a4e78 }], ['@nature/rock_largeE', 2.2, 'round', { tint: 0x584c70 }], ['@halloween/bone_B', 0.8, 'round']];
const wallPieces = (half) => {
  const out = [];
  for (let u = -half; u <= half; u += 4) {
    out.push(['@cave/template-wall', u, -half - 1.4, 0, 4], ['@cave/template-wall', u, half + 1.4, 180, 4], ['@cave/template-wall', half + 1.4, u, 90, 4], ['@cave/template-wall', -half - 1.4, u, -90, 4]);
  }
  return out;
};

export const zone = {
  id: 'caves', name: 'Пещеры Обсидианы', kit: 'hex', size: { W: 26, D: 26 }, sky: 'night',
  look: { fog: 0x0c0916, near: 5, far: 23, hemi: [0x7a6aa8, 0x160e22, 0.6], sun: [0x9a8ac8, 0.4], bg: 0x0c0916 },
  lookDone: { fog: 0x1a1430, near: 12, far: 42, hemi: [0x9a8ac8, 0x2a1e40, 0.95], sun: [0xb8a8e8, 0.8], bg: 0x1a1430 },
  dark: true,
  weather: 'dust',
  ground: 0x2e2840, road: 0x433a58, roads,
  paint: [{ kind: 'rune', x: 0, z: -4, r: 3.2 }, { kind: 'rune', x: 0, z: -16, r: 6 }],
  spawn: { x: 0, z: 21, facing: Math.PI },
  campfire: { x: 5, z: 19 },
  entries: { north: [0, -10], east: [20, 0], west: [-20, 0], south: [0, 14] },
  enemyTint: 0x8a78b8,
  crystals: [[-20, 16, '#8a6cff', 2.2], [20, 18, '#5fd0ff', 2], [-21, -2, '#c07bff', 2.4], [22, -4, '#8a6cff', 2], [-12, -20, '#5fd0ff', 1.8],
    [12, -21, '#c07bff', 2.2], [-6, 12, '#8a6cff', 1.4], [8, 2, '#5fd0ff', 1.5], [-22, 22, '#c07bff', 1.8], [21, -22, '#8a6cff', 2]],
  props: [
    ['@nature/campfire_stones', 5, 19, 0, 1.6, 'round'],
    // the Bone Throne
    ['@halloween/crypt', 0, -23, 0, 6, 'box'], ['@dungeon/pillar_decorated', -6, -18, 0, 1.2, 'round'], ['@dungeon/pillar_decorated', 6, -18, 0, 1.2, 'round'],
    ['@dungeon/pillar', -9, -13, 0, 1.1, 'round'], ['@dungeon/pillar', 9, -13, 0, 1.1, 'round'], ['@halloween/coffin_decorated', -11, -20, 20, 2.2, 'box'],
    ['@halloween/coffin_decorated', 11, -20, -20, 2.2, 'box'], ['@dungeon/chest_gold', 4, -23, 0, 1.2, 'box'], ['@halloween/ribcage', -4, -21, 30, 1.2, 'round'],
    // the miners' corner at the entrance
    ['@dungeon/barrel_large', 11, 18, 0, 1.1, 'round'], ['@dungeon/crates_stacked', 12, 14, 20, 1.8, 'box'], ['@dungeon/torch_lit', -5.5, 22, 0, { h: 1.8 }, 'trunk'],
    ['@dungeon/torch_lit', 5.5, 23, 0, { h: 1.8 }, 'trunk'],
    ...scatter('caves:rocks', rocks, 34, [-25, -25, 25, 25], keep, 3.6),
  ],
  scenery: [
    ...wallPieces(26),
    ...[[-2, -20], [2, -20], [-3.5, -18.5], [3.5, -18.5]].map(([x, z]) => ['@halloween/skull_candle', x, z, 0, 0.6]),
    ['@halloween/candle_triple', -7, -16, 0, 0.7], ['@halloween/candle_triple', 7, -16, 0, 0.7], ['@dungeon/banner_red', -6, -19, 0, { h: 3 }], ['@dungeon/banner_red', 6, -19, 0, { h: 3 }],
    ['@halloween/bone_C', -10, 2, 40, 1], ['@halloween/skull', 12, -2, 0, 0.6], ['@halloween/bone_B', 4, 8, 90, 0.9],
  ],
  signs: [{ x: 3.5, z: 24, rot: 180, text: '↓ Наверх, в деревню' }],
  villagers: [
    { id: 'iskorka', name: 'Фонарщица Искорка', model: 'Rogue_Hooded', palette: 'dark', x: -3, z: 19.5, facing: 0.5,
      chatter: ['Без света тут пропадёшь. Держись светильников!', 'Говорят, королева Обсидиана плачет в своём кристалле.'] },
    { id: 'krot', name: 'Рудокоп Крот', model: 'Barbarian', palette: 'dark', x: 9, z: 16, facing: -1.6, hold: ['2H_Axe'],
      chatter: ['Я копал здесь всю жизнь, но такой тьмы не помню.', 'Костяной трон — на самом севере пещер. Туда даже скелеты боятся ходить.'] },
    { id: 'ghost', name: 'Призрак стражника', model: 'Knight', tint: 0x9fb4ff, x: -9, z: 4, facing: 0.9, ghost: true,
      chatter: ['Я видел, как королева сняла печать… Король обещал ей солнце. Обманул.', 'Она не злая, путник. Ей просто было одиноко в темноте.'] },
  ],
  queen: { name: 'Королева Обсидиана', model: 'Rogue_Hooded', palette: 'dark', crown: '#7a54c4', x: 0, z: -4, facing: 0, fixed: true, throne: 'dark',
    crest: { color: '#4a3080', symbol: '🔮' },
    chatter: ['…'], thanks: ['Иди к Костяному трону, {name}. Я верю в тебя.', 'Когда всё кончится, я хочу увидеть солнце. Настоящее.'] },
  gates: [{ id: 'toVillage', to: 'village', x: 0, z: 24.5, w: 3.4, arrive: { x: 4, z: 6.5, facing: 0 } }],
};

export const lines = [
  {
    id: 'depths', zone: 'caves', title: 'Тьма под островом', requires: { gems: 6, blessings: ['sun'] }, gem: 'obsidian', coins: 150, queen: 'prison',
    steps: [
      { type: 'talk', npc: 'iskorka', task: 'Поговори с фонарщицей Искоркой', lines: [
        'Ой! Свет! Твоё оружие светится, как маленькое солнце, {name}!',
        'Здесь, внизу, всё погасло с того дня, как королева Обсидиана сняла печать.',
        'Зажги четыре кристальных светильника. Они загораются только от солнечного света — от твоего оружия!',
      ], hint: 'Светильники зажигаются только светящимся оружием' },
      { type: 'targets', style: 'brazier', needs: 'sun', task: 'Зажги кристальные светильники', targets: braziers },
      { type: 'defend', task: 'Отбей теневых скелетов', banner: 'Тени идут на свет!',
        waves: [[['grunt', 3, 'north'], ['shooter', 1, 'west'], ['runner', 2, 'east']], [['tank', 2, 'north'], ['blinker', 2, 'west'], ['grunt', 3, 'east']]] },
      { type: 'targets', style: 'prison', r: 1.3, task: 'Разбей чёрный кристалл', targets: [[0, -4, 6]], hint: 'Кристалл крепкий — бей снова и снова' },
      { type: 'talk', npc: 'queen', queen: 'awake', task: 'Поговори с королевой Обсидианой', lines: [
        'Ты… освободил меня? После всего, что я натворила?',
        'Я — Обсидиана, младшая из семи сестёр. Я так хотела солнца, что поверила Королю скелетов. И сняла печать.',
        'Он разбил Кристалл и запер меня в чёрном камне. Я видела, как гаснут короны моих сестёр, и ничего не могла сделать.',
        'Возьми мой обсидиан — последний, седьмой камень. Король ждёт тебя на Костяном троне. Победи его, {name}.',
      ] },
    ],
  },
  {
    id: 'king', zone: 'caves', title: 'Костяной трон', requires: { done: ['depths'] }, coins: 300,
    steps: [
      { type: 'reach', task: 'Иди к Костяному трону', at: [0, -12, 3], banner: 'Король скелетов ждёт…' },
      { type: 'boss', task: 'Победи Короля скелетов', banner: 'Король скелетов!', at: [0, -16], hint: 'Щит спереди — бей сбоку, в спину или когда он устанет после рывка',
        boss: { name: 'Король скелетов', model: 'Skeleton_Warrior', scale: 2.7, r: 1.1, hp: 24, speed: 1.6, crown: true, shield: 'front', turn: 2, tired: 1.6, moves: ['summon', 'charge', 'volley', 'charge'], summon: ['grunt', 2],
          phases: [
            { at: 0.66, shield: null, vulnerable: 'stunned', moves: ['slam', 'summon', 'charge', 'slam'], text: 'Король сбрасывает щит! Бей, пока он оглушён' },
            { at: 0.33, vulnerable: null, moves: ['blink', 'volley', 'summon', 'charge'], speed: 2.1, every: 2.4, text: 'Последняя ярость Короля!' },
          ] } },
      { type: 'talk', npc: 'queen', task: 'Поговори с королевой Обсидианой', lines: [
        'Он побеждён! Король скелетов рассыпался в прах!',
        'Семь камней снова вместе, {name}. Поднимайся в деревню — Кристалл ждёт.',
        'А я… я пойду с тобой. Я хочу увидеть солнце.',
      ] },
    ],
  },
];
