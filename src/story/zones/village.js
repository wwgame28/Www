// Деревня Перекрёсток — the middle of the island: the broken Crystal, four gates to the kingdoms and
// the well down to the caves. Props: [model, x, z, rotation°, size, shape, opts]; '@kit/model' takes a
// model from another kit; opts: { hurts, chasm, unless: blessing, tint }. Scenery has no colliders.
const walls = (side) => {
  // A wall with a gate in the middle of one side, just outside the playable square.
  const out = [];
  const at = (u) => (side === 'n' ? [u, -27.6, 0] : side === 's' ? [u, 27.6, 180] : side === 'e' ? [27.6, u, 90] : [-27.6, u, -90]);
  const mid = side === 'e' ? 2 : side === 'w' ? 4 : 0;
  out.push(['wall_straight_gate', ...at(mid).slice(0, 2), at(mid)[2], 6]);
  for (const k of [-1, 1]) for (const d of [5.5, 10.5, 15.5]) { const p = at(mid + k * d); out.push(['wall_straight', p[0], p[1], p[2], 5]); }
  return out;
};

export const zone = {
  id: 'village', name: 'Деревня Перекрёсток', kit: 'hex', size: { W: 26, D: 26 }, sky: 'day',
  look: { fog: 0xbfd6f2, near: 30, far: 80, hemi: [0xe2ecff, 0x5b7a3c, 1.3], sun: [0xfff0d8, 2.3] },
  ground: 0x7cba5c, road: 0xcdb083,
  roads: [[[0, 27], [0, 12], [1, 0], [0, -12], [0, -27]], [[-27, 4], [-14, 5], [-2, 4], [12, 2], [27, 2]], [[0, 12], [6, 10], [12, 13]]],
  spawn: { x: 0, z: 20, facing: Math.PI },
  campfire: { x: 4, z: 13 },
  entries: { north: [0, -24], east: [24, 2], west: [-24, 4], south: [0, 24] },
  crystal: { x: -2.5, z: 1.5 }, // the Crystal-Guardian: one facet lights for each returned gem
  props: [
    ['building_tavern_blue', -10, -4, 90, 8, 'box'],
    ['building_market_blue', 9, -8, -90, 7, 'box'],
    ['building_blacksmith_blue', -10, 11.5, 90, 7, 'box'],
    ['building_home_A_blue', -13, -18, 30, 5.5, 'box'],
    ['building_home_B_blue', 13, -17, -20, 6, 'box'],
    ['building_home_A_blue', -4, -17, 0, 5.5, 'box'],
    ['building_church_blue', -19, -9, 90, 7.5, 'box'],
    ['building_windmill_blue', 18, 16, 0, 6, 'round'],
    ['building_well_blue', 4, 3, 0, 2.4, 'round'],
    ['crate_A_big', 6.5, -4, 15, 1.2, 'box'], ['barrel', 7.5, -2.6, 0, 0.9, 'round'], ['sack', -6.5, 14, 0, 0.9, 'round'],
    ['resource_lumber', -13, 17, 20, 2.4, 'cap'], ['wheelbarrow', 7, 15.5, -30, 1.6, 'cap'], ['tent', 20, -5, -15, 3.2, 'round'],
    ['fence_wood_straight', 12, -1, 70, 3.2, 'cap'], ['fence_wood_straight', 21, 9, 70, 3.2, 'cap'],
    ['trees_A_large', -20, 19, 0, { h: 6 }, 'round'], ['trees_B_large', 20, -20, 40, { h: 6 }, 'round'], ['trees_A_large', -21, -21, 80, { h: 6 }, 'round'],
    ['@nature/campfire_stones', 4, 13, 0, 1.6, 'round'],
    ['@nature/sign', 3, -20, 200, 1.2, 'round'],
    ['@nature/statue_column', -2.5, 1.5, 0, 1.1, 'round'],
  ],
  scenery: [
    ...walls('n'), ...walls('s'), ...walls('e'), ...walls('w'),
    ['mountain_A_grass_trees', -36, -34, 0, 20], ['mountain_B_grass_trees', 36, -34, 60, 22], ['mountain_A_grass_trees', 36, 34, 120, 18],
    ['mountain_B_grass_trees', -36, 34, 200, 20], ['hills_A_trees', -18, 36, 0, 14], ['hills_B_trees', 18, 36, 90, 14],
    ['hills_A_trees', 36, -16, 30, 14], ['hills_B_trees', -36, -16, 150, 14], ['hills_A_trees', 36, 18, 210, 13], ['hills_B_trees', -36, 18, 300, 13],
    ['flag_blue', 14, 4.5, 0, { h: 2.6 }],
  ],
  signs: [
    { x: 3, z: -23, rot: 0, text: 'Лес Флоры ↑' }, { x: 23, z: 5, rot: -90, text: 'Царство морей →' },
    { x: -3, z: 23, rot: 180, text: 'Пустыня Зарины ↓' }, { x: -23, z: 1, rot: 90, text: '← Горы Агаты' },
  ],
  villagers: [
    { id: 'elder', name: 'Старейшина Ульв', model: 'Mage', tint: 0xeee6d6, x: 2.5, z: -0.5, facing: 0.2, hold: ['2H_Staff'],
      chatter: [
        'Камни семи королев погасли, {name}. Верни их в Кристалл — каждый зажжёт свою грань.',
        'Лес, море, пустыня и горы ждут тебя. Снег, магия и пещеры откроются благословениями королев.',
        'Колодец ведёт в пещеры Обсидианы. Спускайся, когда соберёшь шесть камней и солнечный свет.',
      ] },
    { id: 'guard', name: 'Стражник Бор', model: 'Knight', tint: 0xb8c8e0, x: -2.5, z: -21, facing: 0, hold: ['1H_Sword', 'Round_Shield'],
      chatter: ['За северными воротами лес Флоры. Там бродят скелеты, держи оружие наготове.', 'Говорят, лес сохнет с тех пор, как королева Флора уснула.'] },
    { id: 'mila', name: 'Мила', model: 'Rogue', tint: 0xf0c8d8, x: 9.6, z: -1.4, facing: -0.9,
      chatter: ['На востоке море Ундины. Моя бабушка видела Царицу морей своими глазами!', 'В пустыне на юге есть оазис, а в горах на западе — шахтёры королевы Агаты.'] },
    { id: 'smith', name: 'Кузнец Гром', model: 'Barbarian', tint: 0xd0b090, x: -6, z: 7.5, facing: 0.7, hold: ['Mug'],
      chatter: ['Хороший бросок — половина победы. Вторая половина — успеть подобрать!', 'Каждая королева дарит сердце тому, кто ей поможет. Береги их!'] },
  ],
  // The seven queens come to the feast once the Skeleton King is beaten.
  feast: [
    { id: 'q-flora', chatter: ['Спасибо, {name}! Лес снова поёт.'], name: 'Королева Флора', model: 'Rogue', palette: 'forest', crown: '#3fd16b', x: -6, z: 0, portrait: 'queen-nature' },
    { id: 'q-undina', chatter: ['Море спокойно, маяк горит. Царство морей у тебя в долгу, {name}.'], name: 'Царица морей Ундина', model: 'Rogue_Hooded', palette: 'sea', crown: '#3fd6ff', x: -5.5, z: 4.5, portrait: 'queen-sea' },
    { id: 'q-zarina', chatter: ['Загадка для тебя, {name}: что светит ярче солнца? Верное сердце!'], name: 'Королева Зарина', model: 'Mage', palette: 'sand', crown: '#ffb42e', x: -2.5, z: 6.5 },
    { id: 'q-agata', chatter: ['Хорошая работа, {name}. Горняки сложат о тебе песню.'], name: 'Королева Агата', model: 'Knight', palette: 'stone', crown: '#ff4d5e', x: 1, z: 5.5 },
    { id: 'q-snezhana', chatter: ['Метели больше нет. Приходи кататься на санках, {name}!'], name: 'Королева Снежана', model: 'Rogue', palette: 'snow', crown: '#e8f6ff', x: 1.5, z: 2 },
    { id: 'q-astra', chatter: ['Звёзды снова на своих местах! Ну, почти все.'], name: 'Королева Астра', model: 'Mage', palette: 'magic', crown: '#b56cff', x: -6.5, z: -3.5 },
    { id: 'q-obsidiana', chatter: ['Прости меня, {name}. Я больше никогда не поверю тьме.'], name: 'Королева Обсидиана', model: 'Rogue_Hooded', palette: 'dark', crown: '#7a54c4', x: -2.5, z: -3 },
  ],
  gates: [
    { id: 'toForest', to: 'forest', x: 0, z: -24.5, w: 4, requires: { flags: ['awakened'] }, closed: 'Сначала помоги деревне', arrive: { x: 0, z: 24.5, facing: Math.PI } },
    { id: 'toBeach', to: 'beach', x: 24.5, z: 2, w: 4, requires: { flags: ['awakened'] }, closed: 'Сначала помоги деревне', arrive: { x: -25.5, z: 2, facing: Math.PI / 2 } },
    { id: 'toDesert', to: 'desert', x: 0, z: 24.5, w: 4, requires: { flags: ['awakened'] }, closed: 'Сначала помоги деревне', arrive: { x: 0, z: -25.5, facing: 0 } },
    { id: 'toMountains', to: 'mountains', x: -24.5, z: 4, w: 4, requires: { flags: ['awakened'] }, closed: 'Сначала помоги деревне', arrive: { x: 25.5, z: 4, facing: -Math.PI / 2 } },
    { id: 'toCaves', to: 'caves', x: 4, z: 3, w: 3.4, requires: { gems: 6, blessings: ['sun'] }, closed: 'Колодец ведёт в пещеры. Нужны шесть камней королев и «Солнечный камень»', arrive: { x: 0, z: 21, facing: Math.PI } },
  ],
};

export const lines = [
  {
    id: 'awakening', zone: 'village', title: 'Глава 1 · Пробуждение', flag: 'awakened',
    steps: [
      { type: 'talk', npc: 'elder', task: 'Поговори со старейшиной у колодца', lines: [
        'Наконец-то ты проснулся, {name}! Случилась беда: Король скелетов вырвался из-под земли и разбил Кристалл-хранитель.',
        'Без Кристалла мёртвые встают, а камни в коронах семи королев погасли. Каждое царство накрыло своё проклятие.',
        'Но сначала проверим твою руку. На площадке у мельницы стоят мишени — сбей все три.',
      ] },
      { type: 'targets', task: 'Сбей 3 мишени у мельницы', targets: [[14, 2.5], [17.5, 7], [13.5, 10]], hint: 'Брось оружие, а потом подбери его или нажми ↩' },
      { type: 'defend', task: 'Отбей нападение на деревню', banner: 'Нападение на деревню!',
        waves: [[['grunt', 4, 'north']], [['grunt', 3, 'east'], ['grunt', 2, 'west'], ['runner', 2, 'north']]] },
      { type: 'collect', task: 'Подбери светящийся осколок', at: 'lastKill', item: 'shard' },
      { type: 'talk', npc: 'elder', task: 'Отнеси осколок старейшине', reward: 100, lines: [
        'Это же Сердце Кристалла! Видишь, как оно светится у тебя в руках? Оно выбрало тебя, {name}.',
        'Семь королев — сёстры. Флора в лесу, Ундина у моря, Зарина в пустыне, Агата в горах, Снежана за перевалом, Астра в звёздной чаще.',
        'А младшая, Обсидиана, правила пещерами. Это она сняла печать — Король обманул её.',
        'Помоги королевам снять проклятия, и они вернут свои камни. Все четыре ворота для тебя открыты. Возьми монеты — и в путь!',
      ] },
    ],
  },
  {
    id: 'finale', zone: 'village', title: 'Праздник Семи Корон', requires: { done: ['king'] }, ending: true, coins: 500,
    steps: [
      { type: 'talk', npc: 'elder', task: 'Вернись к старейшине у Кристалла', lines: [
        'Ты победил Короля скелетов, {name}! Смотри — все семь граней Кристалла сияют.',
        'Королевы пришли на праздник. Впервые за сто лет сёстры снова вместе — и даже Обсидиана.',
        'С этого дня ты — Хранитель Кристалла. Остров Семи Корон спасён!',
      ] },
    ],
  },
];
