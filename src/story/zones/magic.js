// Магическое царство — Звёздная чаща Астры (behind the forest's thorns). Pink and golden trees,
// glowing crystals, stone rings that are portals, a gravity well in the middle, wizard towers and
// the queen scattered into star shards.
import { clearOf, scatter, belt } from './util.js';

const roads = [[[20, 28], [18, 20], [8, 14], [0, 6]], [[0, 6], [0, -10]], [[0, 6], [-12, 4], [-18, 12]], [[0, 6], [12, 0], [19, 3]], [[0, -2], [-12, -10], [-19, -16]], [[0, -2], [10, -12], [15, -15]]];
const rifts = [[-13, -4], [12, 11], [21, -21]];
const stars = [[-23, 22], [23, -9], [-5, -22]];
const portals = [{ kind: 'portal', a: [-19, 14], b: [15, -15], r: 1 }, { kind: 'portal', a: [-20, -16], b: [19, 3], r: 1 }];
const well = { kind: 'pull', x: 0, z: 2, r: 4.5, strength: 2.6 };
const keep = clearOf(roads, [
  [20, 24, 4], [11, 22, 3.5], [14, 20, 2.5], [6, 18, 2.5], [-8, 14, 2.5], [18, 16, 4], [0, -14, 6], [0, -6, 5], [well.x, well.z, well.r + 1],
  ...rifts.map(([x, z]) => [x, z, 2.5]), ...stars.map(([x, z]) => [x, z, 2.2]), ...portals.flatMap((p) => [[...p.a, 4], [...p.b, 4]]),
]);
const trees = [['@nature/tree_default_fall', { h: 6 }, 'trunk', { tint: 0xff9ad5 }], ['@nature/tree_oak_fall', { h: 6.5 }, 'trunk', { tint: 0xffc8f0 }],
  ['@nature/tree_detailed_fall', { h: 6 }, 'trunk'], ['@nature/tree_blocks_fall', { h: 5.5 }, 'trunk', { tint: 0xd9b0ff }],
  ['@nature/mushroom_redTall', 1.6, 'round', { tint: 0xc8a0ff }], ['@nature/mushroom_tanTall', 1.5, 'round', { tint: 0x9ad8ff }]];
const obelisks = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
  return ['@nature/statue_obelisk', +(Math.sin(a) * 5.5).toFixed(2), +(-14 + Math.cos(a) * 5.5).toFixed(2), 0, 1.2, 'round', { tint: 0xd8c8ff }];
});

export const zone = {
  id: 'magic', name: 'Звёздная чаща Астры', kit: 'hex', size: { W: 28, D: 28 }, sky: 'night',
  look: { fog: 0x2a1f4a, near: 20, far: 62, hemi: [0xb8a0ff, 0x2a1a40, 1.15], sun: [0xd8c8ff, 1.3] },
  weather: 'sparkle',
  ground: 0x5a4580, road: 0xa98fd8, roads, fireColor: 0xb070ff,
  paint: [{ kind: 'rune', x: 0, z: -14, r: 6.5 }, { kind: 'rune', x: well.x, z: well.z, r: well.r }, ...portals.flatMap((p) => [{ kind: 'rune', x: p.a[0], z: p.a[1], r: 1.8 }, { kind: 'rune', x: p.b[0], z: p.b[1], r: 1.8 }])],
  spawn: { x: 20, z: 24, facing: Math.PI },
  campfire: { x: 11, z: 22 },
  entries: { north: [0, -20], east: [22, 0], west: [-22, 0], south: [0, 20] },
  enemyTint: 0xd6b0ff,
  areas: [...portals, well],
  crystals: [[-16, -2, '#c08bff', 2.2], [7, -20, '#7fe0ff', 1.8], [-22, 6, '#ff8be0', 2], [24, 14, '#9ab0ff', 2.4], [-9, 21, '#c08bff', 1.6], [16, -24, '#ff8be0', 2]],
  props: [
    ['@nature/campfire_stones', 11, 22, 0, 1.6, 'round'],
    ['building_tower_A_blue', 18.5, 16, 0, 4.4, 'round', { tint: 0xd8b8ff }], ['building_tower_B_blue', -18, -23, 0, 4.6, 'round', { tint: 0xd8b8ff }],
    ['building_church_green', 21, -5, -90, 6, 'box', { tint: 0xe0c8ff }],
    ...obelisks,
    ['@halloween/shrine_candles', -8, 17.5, 180, 1.6, 'box'], ['@dungeon/candle_triple', 4, 16.5, 0, 0.6, 'round'],
    ...scatter('magic:trees', trees, 40, [-27, -27, 27, 27], keep, 4),
  ],
  scenery: [
    // the stone rings: step into one and come out of its twin (the swirl in the ring is drawn by scene.js)
    ...portals.flatMap((p) => [['@nature/statue_ring', ...p.a, 0, { h: 2.6 }], ['@nature/statue_ring', ...p.b, 0, { h: 2.6 }]]),
    ...belt('magic:belt', [['@nature/tree_fat_fall', 7], ['@nature/tree_default_fall', 6], ['mountain_C', 20], ['hills_C', 14]], 28, { gap: 6, skip: [[20, 31, 7]] }),
    ...scatter('magic:flowers', [['@nature/flower_purpleA', 0.6], ['@nature/flower_purpleB', 0.6], ['@nature/plant_flatTall', 0.8]], 36, [-26, -26, 26, 26], clearOf(roads, [], 1.4), 1.6)
      .map(([m, x, z, r, s]) => [m, x, z, r, s]),
  ],
  signs: [{ x: 23.5, z: 25, rot: 180, text: '↓ Лес Флоры' }],
  villagers: [
    { id: 'orion', name: 'Звездочёт Орион', model: 'Mage', palette: 'magic', x: 14, z: 19.5, facing: 2.6, hold: ['2H_Staff'],
      chatter: ['Звёзды сбились с пути! Вчера Большая Медведица гуляла по южному небу.', 'Каменные кольца — порталы. Брось сквозь них оружие — оно вылетит из другого кольца!'] },
    { id: 'iskra', name: 'Ученица Искра', model: 'Rogue', palette: 'magic', x: 6, z: 18, facing: 2.9,
      chatter: ['Я хотела наколдовать кота, а получился скелет. Ой.', 'Воронка в середине тянет к себе всё — даже брошенное оружие.'] },
    { id: 'statue', name: 'Говорящая статуя', prop: '@nature/statue_head', size: 1.6, x: -8, z: 14, facing: 2.4, fixed: true,
      chatter: ['Я видела, как королева рассыпалась на три звезды. Найди их!', 'Тише… я думаю. Уже триста лет.'] },
  ],
  queen: { name: 'Королева Астра', model: 'Mage', palette: 'magic', crown: '#b56cff', x: 0, z: -14, facing: 0, fixed: true, throne: 'magic',
    crest: { color: '#8a4fd6', symbol: '✨' },
    chatter: ['…'], thanks: ['Звёзды снова на своих местах! Ну, почти все.', 'Возвращай оружие почаще — с моим благословением это проще простого.'] },
  gates: [{ id: 'toForest', to: 'forest', x: 20, z: 26.5, w: 4, arrive: { x: 21, z: -23.5, facing: 0 } }],
};

export const lines = [{
  id: 'magic', zone: 'magic', title: 'Дикая магия', requires: { blessings: ['bloom'] }, gem: 'amethyst', blessing: 'star', coins: 150, queen: 'hidden',
  steps: [
    { type: 'talk', npc: 'orion', task: 'Поговори со звездочётом Орионом', lines: [
      'О! Гость из леса! Ты прошёл сквозь лозы Флоры — значит, ты {name}, о котором поют звёзды.',
      'Когда погас аметист королевы Астры, магия вырвалась на волю. В чаще открылись разрывы — дыры в звёздное небо.',
      'Закрой три разрыва — просто попади в каждый. Каменные кольца помогут: это порталы.',
    ], hint: 'Войди в каменное кольцо — выйдешь из парного' },
    { type: 'targets', style: 'rift', r: 0.9, task: 'Закрой магические разрывы', targets: rifts },
    { type: 'talk', npc: 'iskra', task: 'Поговори с ученицей Искрой', lines: [
      'Разрывы закрыты! Ты настоящий волшебник, {name}. Ну, почти.',
      'Королева Астра рассыпалась на три звёздных осколка, когда пыталась удержать магию.',
      'Собери их — и она соберётся снова! Осколки светятся в самых дальних уголках чащи.',
    ] },
    { type: 'collect', task: 'Собери звёздные осколки', item: 'star', items: stars, hint: 'Воронка в середине тянет к себе — обходи её' },
    { type: 'boss', task: 'Победи Зеркального мага', banner: 'Зеркальный маг!', at: [0, -6], hint: 'Маг делает копии — настоящий тот, что не тает',
      boss: { name: 'Зеркальный маг', model: 'Skeleton_Mage', scale: 2.1, hp: 12, speed: 1.5, moves: ['clones', 'volley', 'blink'],
        phases: [{ at: 0.5, moves: ['clones', 'volley', 'blink', 'volley'], every: 2.6, text: 'Зеркальный маг множится!' }] } },
    { type: 'talk', npc: 'queen', queen: 'awake', task: 'Поговори с королевой Астрой', lines: [
      'Ой-ой, голова кружится… Я снова целая! Спасибо, {name}!',
      'Я — Астра, королева звёзд и магии. Зеркальный маг хотел забрать мою силу себе.',
      'Вот мой аметист. Он немного звенит — это нормально, это магия.',
      'И моё благословение — «Звёздный путь»: твоё оружие будет возвращаться к тебе втрое быстрее.',
    ] },
  ],
},
  {
    id: 'orion-stars', zone: 'magic', title: 'Звездопад', side: true, requires: { done: ['magic'] }, coins: 120,
    steps: [
      { type: 'talk', npc: 'orion', task: 'Поговори со звездочётом Орионом', lines: [
        'Звёзды вернулись на небо, но некоторые снова упали в чащу!',
        'Поймай шесть упавших звёзд, пока они не погасли. Времени совсем немного — беги!',
      ] },
      { type: 'collect', task: 'Поймай упавшие звёзды', item: 'star', time: 80, items: [[-12, 10], [12, 13], [9, 2], [-10, 0], [13, -8], [-12, -10]], hint: 'Время пошло! Каменные кольца сокращают путь' },
      { type: 'talk', npc: 'orion', task: 'Вернись к звездочёту Ориону', lines: [
        'Шесть звёзд! Смотри, как они поднимаются обратно в небо.',
        'Мы, звездочёты, считаем звёзды уже тысячу лет. Каждая из них — слово из Песни Первосвета.',
      ] },
    ],
  },
  {
    id: 'statue-runes', zone: 'magic', title: 'Руны Говорящей статуи', side: true, requires: { done: ['orion-stars'] }, coins: 130,
    steps: [
      { type: 'talk', npc: 'statue', task: 'Поговори с Говорящей статуей', lines: [
        'Я… ПОМНЮ… ЗОДЧИХ. ОНИ… ВЫРЕЗАЛИ… МЕНЯ… ИЗ… ЛУННОГО… КАМНЯ.',
        'ЗАЖГИ… ЧЕТЫРЕ… РУНЫ… И… Я… ПОКАЖУ… ДОРОГУ… В… НЕБО.',
      ] },
      { type: 'targets', style: 'obelisk', r: 0.8, task: 'Зажги руны Зодчих', targets: [[-3, 7], [-21, 0], [3, -21], [12, 13]] },
      { type: 'talk', npc: 'statue', task: 'Вернись к Говорящей статуе', lines: [
        'РУНЫ… ГОРЯТ. ВИДИШЬ… СВЕТ… НАД… ЧАЩЕЙ?',
        'ТАМ… НЕБЕСНЫЕ… ОСТРОВА. ТУДА… УШЛИ… ЗОДЧИЕ. КОГДА-НИБУДЬ… ТЫ… ПОЛЕТИШЬ… ТУДА.',
      ] },
    ],
  },
];
