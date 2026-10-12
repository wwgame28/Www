import { createRng } from './rng.js';
import { FOOTPRINTS } from './footprints.js';
import { solidContact } from './solid.js';

// Arena is centered on the origin: x in [-W, W], z in [-D, D] (−z is the top of the screen).
export const ARENA = { W: 8, D: 12 };

const d = (kit, model, fit, edge = false) => ({ kit, model, fit, edge });
// Hand-placed obstacles: [model, x, z, rotation°, size, shape]. size is the footprint's longest side in
// meters, or { h } for the height. shape: 'round' (a circle around the silhouette), 'trunk' (only the
// trunk is solid, shots fly under the crown), 'box' (the exact footprint), 'cap' (a capsule: walls, cars,
// fences). '@kit/model' borrows a model from another kit. M() adds a piece and its mirror image, so both
// halves of the arena play the same.
const M = (m, x, z, rot, size, shape) => [[m, x, z, rot, size, shape], [m, -x, z, -rot, size, shape]];
const P = (m, x, z, rot, size, shape) => [[m, x, z, rot, size, shape]];

// `layout` are the solids (bounce + block); `decor` is visual only, scattered by a seeded RNG.
// `look` is the light: fog color and range, hemisphere [sky, ground, intensity], sun [color, intensity],
// optional sun position and a plain background instead of the sky. `rule` holds the location's twist.
export const LOCATIONS = [
  {
    id: 'forest', name: 'Лес', icon: '🌲', unlockWave: 0, sky: 'day', desc: 'Деревья и камни отражают снаряд',
    ground: 0x6fb35a, wall: 0x4a7a3a, kit: 'nature',
    look: { fog: 0xb2c6f2, near: 30, far: 72, hemi: [0xdde8ff, 0x5b7a3c, 1.3], sun: [0xfff2d8, 2.3] },
    // Clearing: tall trees in the side bands, round bumpers in the middle, two fences aimed at the far spawns.
    layout: [
      ...M('tree_oak', -6.0, -7.5, 0, { h: 3.0 }, 'trunk'), ...M('tree_fat', -6.2, 1.0, 40, { h: 2.6 }, 'trunk'), ...M('tree_default', -5.8, 8.8, 0, { h: 3.2 }, 'trunk'),
      ...M('@hex/fence_wood_straight', -3.6, -5.0, 10, 2.6, 'cap'),
      ...P('stump_round', 0, -7.0, 0, 1.3, 'round'),
      ...M('rock_largeB', -2.6, -9.2, 0, 1.6, 'cap'),
      ...M('stump_round', -3.4, 7.6, 0, 1.1, 'round'),
    ],
    decor: [d('nature', 'plant_bushLarge', 0.6), d('nature', 'grass_large', 0.4), d('nature', 'mushroom_redGroup', 0.3)],
    rule: {},
  },
  {
    id: 'city', name: 'Город', icon: '🏙', unlockWave: 3, sky: 'day', desc: 'Машины и мусорки — крепкие укрытия',
    ground: 0x6b6f78, wall: 0x9aa0aa, kit: 'city',
    look: { fog: 0xb6c4e4, near: 28, far: 70, hemi: [0xdde4ee, 0x6a6c72, 1.3], sun: [0xffffff, 2.2] },
    // Crossroads: cars parked along the roads are long flat bank walls; a crashed car in the junction.
    layout: [
      ...P('car_taxi', -1.5, -8.6, 0, 2.8, 'cap'), ...P('car_police', 1.5, 9.2, 0, 2.8, 'cap'),
      ...P('car_sedan', -5.2, -5.4, 90, 2.8, 'cap'), ...P('car_sedan', 5.2, -2.6, 90, 2.8, 'cap'),
      ...P('car_police', 0, -4.2, 35, 2.8, 'cap'),
      ...M('dumpster', -5.9, -9.6, 90, 1.7, 'box'), ...M('dumpster', -5.9, 5.0, 90, 1.7, 'box'),
      ...M('box_A', -5.2, 9.8, 15, 0.8, 'box'),
    ],
    decor: [d('city', 'streetlight', 0.35, true), d('city', 'bush', 0.4), d('city', 'trafficlight_A', 0.35, true), d('city', 'trash_B', 0.3), d('city', 'bench', 0.5)],
    rule: {},
  },
  {
    id: 'dungeon', name: 'Подземелье', icon: '🕯', unlockWave: 6, sky: 'night', desc: 'Темно — свет только вокруг тебя',
    ground: 0x4a4550, wall: 0x2e2a35, kit: 'dungeon',
    look: { fog: 0x0b0a10, near: 9, far: 28, bg: 0x0b0a10, hemi: [0x6b5c8f, 0x16121c, 0.45], sun: [0x9fa8ff, 0.3] },
    // Colonnade: two rows of pillars split the nave from the aisles; low barriers; treasure at the far end.
    layout: [
      ...M('pillar', -4.4, -8.6, 0, 1.0, 'round'), ...M('pillar_decorated', -4.4, -2.6, 0, 1.2, 'round'), ...M('pillar', -4.4, 7.0, 0, 1.0, 'round'),
      ...M('barrier', -4.4, -5.6, 90, 2.4, 'cap'),
      ...P('chest_gold', 0, -9.0, 0, 1.2, 'box'),
      ...M('barrel_large', -2.0, -6.0, 0, 0.9, 'round'),
      ...M('crates_stacked', -6.0, 2.4, 0, 1.3, 'box'),
      ...M('rubble_large', -2.4, 9.2, 20, 2.4, 'cap'),
    ],
    decor: [d('dungeon', 'torch_lit', 0.25, true), d('dungeon', 'candle_triple', 0.25), d('dungeon', 'box_small', 0.3), d('dungeon', 'trunk_small_A', 0.35)],
    rule: { heroLight: true },
  },
  {
    id: 'winter', name: 'Зимняя деревня', icon: '❄️', unlockWave: 9, sky: 'morning', desc: 'Лёд: скользишь, снаряд катится',
    ground: 0xe8f1f8, wall: 0xa9c4d8, kit: 'holiday', bloom: 0.25,
    look: { fog: 0xf6dcc8, near: 28, far: 72, hemi: [0xfff1e6, 0xc9d9ea, 1.15], sun: [0xffd3a8, 2.0], sunPos: [-12, 7, 5] },
    // Frozen pond: the middle stays open; trees on the rim near the walls; presents as bumpers.
    layout: [
      ...M('tree-snow-a', -5.8, -9.4, 0, { h: 2.4 }, 'round'), ...M('tree-snow-b', -5.8, -2.0, 0, { h: 2.3 }, 'round'), ...M('tree-snow-c', -6.0, 6.0, 0, { h: 2.4 }, 'round'),
      ...P('snowman', 0, -10.0, 0, 1.3, 'round'),
      ...M('present-a-cube', -3.0, 7.0, 20, 0.9, 'box'), ...M('present-a-cube', -2.6, -9.3, -10, 0.8, 'box'),
      ...M('rocks-large', -5.4, 9.4, 15, 2.0, 'round'),
    ],
    decor: [d('holiday', 'snow-pile', 0.5), d('holiday', 'sled', 0.6), d('holiday', 'lantern', 0.3)],
    rule: { friction: 1.6, dropSlide: true },
  },
  {
    id: 'river', name: 'Река у крепости', icon: '🏰', unlockWave: 12, sky: 'day', desc: 'Река замедляет всех',
    ground: 0x8bbf5c, wall: 0x7a6650, kit: 'hex',
    look: { fog: 0xb2c6f2, near: 32, far: 78, hemi: [0xdde8ff, 0x6b8a4a, 1.35], sun: [0xfff4e0, 2.3] },
    // Ford: ruined fortress walls on the north bank send shots back to the hero; a camp in the south.
    layout: [
      ...M('tree_single_A', -6.3, -9.2, 0, { h: 2.9 }, 'trunk'),
      ...M('rock_single_A', -1.8, -4.4, 30, 1.4, 'round'),
      ...M('@hex/wall_straight', -3.8, -7.8, 0, 2.4, 'cap'),
      ...P('trees_A_medium', 0, -9.6, 0, 1.8, 'round'),
      ...M('tent', -5.6, 7.6, 25, 1.9, 'round'),
      ...M('crate_A_big', -2.6, 9.4, 10, 1.0, 'box'),
      ...M('weaponrack', -6.0, 2.4, 90, 1.4, 'cap'),
      ...M('barrel', -2.8, 5.6, 0, 0.8, 'round'),
    ],
    decor: [d('hex', 'flag_red', 0.35, true), d('hex', 'sack', 0.3), d('hex', 'bucket_arrows', 0.3), d('hex', 'wheelbarrow', 0.45)],
    rule: { river: { z: -1.5, half: 1.3, slow: 0.5 } },
  },
  {
    id: 'cemetery', name: 'Кладбище', icon: '🎃', unlockWave: 15, sky: 'night', desc: 'Туман: враги появляются из ниоткуда',
    ground: 0x5d6b4a, wall: 0x3b3a33, kit: 'halloween',
    look: { fog: 0x262c3e, near: 8, far: 22, bg: 0x262c3e, hemi: [0x8a98c8, 0x1e2418, 0.55], sun: [0xa9b8ff, 0.9], sunPos: [6, 12, -6] },
    // Grave alley: a path down the middle; two rows of headstones per side (small flat mirrors); dead trees in the corners.
    layout: [
      ...M('gravestone', -3.2, -8.0, 0, 1.0, 'box'), ...M('grave_A', -6.0, -8.0, 0, 1.2, 'box'),
      ...M('gravestone', -3.2, -3.5, 0, 1.0, 'box'), ...M('grave_A', -6.0, -3.5, 0, 1.2, 'box'),
      ...M('grave_A', -3.4, 8.0, 180, 1.2, 'box'), ...M('gravestone', -6.0, 8.0, 180, 1.0, 'box'),
      ...M('tree_dead_large', -6.2, -10.0, 30, { h: 3.4 }, 'trunk'),
      ...M('shrine_candles', -2.2, -10.0, 0, 1.1, 'round'),
    ],
    decor: [d('halloween', 'pumpkin_orange_jackolantern', 0.3), d('halloween', 'skull_candle', 0.2), d('halloween', 'lantern_standing', 0.3, true), d('halloween', 'fence_broken', 0.8, true), d('halloween', 'bone_A', 0.2)],
    rule: { heroLight: true },
  },
  {
    id: 'space', name: 'Космостанция', icon: '🚀', unlockWave: 18, sky: 'alien', desc: 'Порталы: снаряд выходит с другой стороны',
    ground: 0xb4785a, wall: 0x6ad1ff, kit: 'space',
    look: { fog: 0xd8c5e9, near: 30, far: 75, hemi: [0xf0d8ff, 0x8a4a36, 1.25], sun: [0xffd9c0, 2.4] },
    // Dock: the walls are portals, so every bounce comes from the ring of blocks around a central hub.
    layout: [
      ...P('structure_low', 0, -5.0, 0, 2.6, 'round'),
      ...M('cargo_A_stacked', -4.2, -5.0, 0, 1.5, 'box'), ...P('containers_A', 0, -9.6, 0, 1.8, 'box'), ...P('containers_C', 0, -1.2, 45, 1.6, 'box'),
      ...M('lander_A', -5.4, 8.6, 0, 2.2, 'round'),
      ...M('rocks_B', -2.8, 7.4, 30, 1.6, 'round'),
      ...M('rock_A', -5.8, -9.4, 0, 1.2, 'round'),
    ],
    decor: [d('space', 'lights', 0.35, true), d('space', 'cargo_B', 0.4), d('space', 'windturbine_low', 0.5, true), d('space', 'rock_B', 0.35), d('space', 'solarpanel', 0.6, true)],
    rule: { wrap: true },
  },
];

export const getLocation = (id) => LOCATIONS.find((l) => l.id === id) || (id === 'cave' ? LOCATIONS.find((l) => l.id === 'dungeon') : LOCATIONS[0]);

// One layout entry → a solid sized like its model will be drawn. `fit` tells the renderer how to scale it.
export function solidFrom(kit, [model, x, z, rotDeg, size, shape]) {
  if (model.startsWith('@')) [kit, model] = model.slice(1).split('/');
  const [mx, my, mz] = FOOTPRINTS[`${kit}/${model}`];
  const s = typeof size === 'object' ? size.h / my : size / Math.max(mx, mz);
  const fx = mx * s, fz = mz * s;
  const o = { kit, model, x, z, rot: (rotDeg * Math.PI) / 180, h: my * s, fit: typeof size === 'object' ? { height: size.h } : { r: size / 2 } };
  if (shape === 'trunk') return { ...o, r: 0.32 };
  if (shape === 'round') return { ...o, r: 0.46 * Math.max(fx, fz) };
  if (shape === 'box') return { ...o, r: 0.06, hx: fx / 2 - 0.06, hz: fz / 2 - 0.06 };
  const r = Math.min(fx, fz) / 2, half = (Math.max(fx, fz) - Math.min(fx, fz)) / 2; // capsule along the long side
  return { ...o, r, hx: fx >= fz ? half : 0, hz: fx >= fz ? 0 : half };
}

// Fixed layout per location so scores on the same location are comparable.
export function layoutFor(loc) {
  const solids = loc.layout.map((e) => solidFrom(loc.kit, e));
  const rng = createRng('layout:' + loc.id);
  const decor = [];
  for (let i = 0; i < 16; i++) {
    const def = rng.pick(loc.decor);
    const edge = def.edge || rng.next() < 0.5;
    const x = edge ? rng.pick([-1, 1]) * (ARENA.W + rng.range(0.6, 2.2)) : rng.range(-ARENA.W, ARENA.W);
    const z = rng.range(-ARENA.D, ARENA.D);
    if (!edge && solids.some((s) => solidContact(s, x, z, 0.6))) continue;
    decor.push({ ...def, x, z, rot: rng.range(0, Math.PI * 2) });
  }
  return { solids, decor };
}
