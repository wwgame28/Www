import { createRng } from './rng.js';

// Arena is centered on the origin: x in [-W, W], z in [-D, D] (−z is the top of the screen).
export const ARENA = { W: 8, D: 12 };

const o = (kit, model, r) => ({ kit, model, r });
const d = (kit, model, fit, edge = false) => ({ kit, model, fit, edge });

// `obstacles` are solid circles (bounce + block); `decor` is visual only.
// `r`/`fit` is the footprint radius a model is scaled to, so kits with different units line up.
// `rule` holds the location's one twist; `desc` explains it on the location card.
export const LOCATIONS = [
  {
    id: 'forest', name: 'Лес', icon: '🌲', unlockWave: 0, sky: 'day', desc: 'Деревья и камни отражают снаряд',
    ground: 0x6fb35a, wall: 0x4a7a3a, fog: 0xbfe3a8, light: 1.0, obstacleCount: 11,
    obstacles: [o('nature', 'tree_oak', 0.7), o('nature', 'tree_default', 0.6), o('nature', 'tree_fat', 0.7), o('nature', 'rock_largeA', 0.8), o('nature', 'stump_round', 0.5)],
    decor: [d('nature', 'plant_bushLarge', 0.6), d('nature', 'grass_large', 0.4), d('nature', 'mushroom_redGroup', 0.3)],
    rule: {},
  },
  {
    id: 'city', name: 'Город', icon: '🏙', unlockWave: 3, sky: 'day', desc: 'Машины и мусорки — крепкие укрытия',
    ground: 0x6b6f78, wall: 0x9aa0aa, fog: 0xc9d3dd, light: 1.0, obstacleCount: 11,
    obstacles: [o('city', 'car_taxi', 0.9), o('city', 'car_police', 0.9), o('city', 'car_sedan', 0.9), o('city', 'dumpster', 0.6), o('city', 'watertower', 0.8), o('city', 'box_A', 0.45)],
    decor: [d('city', 'streetlight', 0.35, true), d('city', 'bush', 0.4), d('city', 'trafficlight_A', 0.35, true), d('city', 'trash_B', 0.3), d('city', 'bench', 0.5)],
    rule: {},
  },
  {
    id: 'dungeon', name: 'Подземелье', icon: '🕯', unlockWave: 6, sky: 'night', desc: 'Темно — свет только вокруг тебя',
    ground: 0x4a4550, wall: 0x2e2a35, fog: 0x15131b, light: 0.35, obstacleCount: 13,
    obstacles: [o('dungeon', 'pillar', 0.5), o('dungeon', 'pillar_decorated', 0.55), o('dungeon', 'barrel_large', 0.5), o('dungeon', 'crates_stacked', 0.7), o('dungeon', 'rubble_large', 0.7), o('dungeon', 'chest_gold', 0.55), o('dungeon', 'keg', 0.5)],
    decor: [d('dungeon', 'torch_lit', 0.25, true), d('dungeon', 'candle_triple', 0.25), d('dungeon', 'box_small', 0.3), d('dungeon', 'trunk_small_A', 0.35)],
    rule: { heroLight: true },
  },
  {
    id: 'winter', name: 'Зимняя деревня', icon: '❄️', unlockWave: 9, sky: 'morning', desc: 'Лёд: скользишь, снаряд катится',
    ground: 0xe8f1f8, wall: 0xa9c4d8, fog: 0xdfeaf3, light: 0.85, bloom: 0.25, obstacleCount: 11,
    obstacles: [o('holiday', 'tree-snow-a', 0.6), o('holiday', 'tree-snow-b', 0.6), o('holiday', 'snowman', 0.5), o('holiday', 'rocks-large', 0.7), o('holiday', 'present-a-cube', 0.45)],
    decor: [d('holiday', 'snow-pile', 0.5), d('holiday', 'sled', 0.6), d('holiday', 'lantern', 0.3)],
    rule: { friction: 1.6, dropSlide: true },
  },
  {
    id: 'river', name: 'Река у крепости', icon: '🏰', unlockWave: 12, sky: 'day', desc: 'Река замедляет всех',
    ground: 0x8bbf5c, wall: 0x7a6650, fog: 0xc9dcae, light: 1.0, obstacleCount: 10,
    obstacles: [o('hex', 'tree_single_A', 0.6), o('hex', 'trees_A_medium', 0.8), o('hex', 'rock_single_A', 0.6), o('hex', 'crate_A_big', 0.5), o('hex', 'tent', 0.8), o('hex', 'weaponrack', 0.6), o('hex', 'barrel', 0.45)],
    decor: [d('hex', 'flag_red', 0.35, true), d('hex', 'sack', 0.3), d('hex', 'bucket_arrows', 0.3), d('hex', 'wheelbarrow', 0.45)],
    rule: { river: { z: -1.5, half: 1.3, slow: 0.5 } },
  },
  {
    id: 'cemetery', name: 'Кладбище', icon: '🎃', unlockWave: 15, sky: 'night', desc: 'Туман: враги появляются из ниоткуда',
    ground: 0x5d6b4a, wall: 0x3b3a33, fog: 0x2a2f38, light: 0.55, obstacleCount: 12,
    obstacles: [o('halloween', 'grave_A', 0.5), o('halloween', 'gravestone', 0.45), o('halloween', 'crypt', 1.0), o('halloween', 'tree_dead_large', 0.7), o('halloween', 'coffin', 0.5), o('halloween', 'shrine_candles', 0.55), o('halloween', 'tree_pine_orange_medium', 0.6)],
    decor: [d('halloween', 'pumpkin_orange_jackolantern', 0.3), d('halloween', 'skull_candle', 0.2), d('halloween', 'lantern_standing', 0.3, true), d('halloween', 'fence_broken', 0.8, true), d('halloween', 'bone_A', 0.2)],
    rule: { heroLight: true, fogNear: 6, fogFar: 22 },
  },
  {
    id: 'space', name: 'Космостанция', icon: '🚀', unlockWave: 18, sky: 'alien', desc: 'Порталы: снаряд выходит с другой стороны',
    ground: 0xb4785a, wall: 0x6ad1ff, fog: 0xe0b9a0, light: 1.0, obstacleCount: 10,
    obstacles: [o('space', 'cargo_A_stacked', 0.7), o('space', 'containers_A', 0.8), o('space', 'containers_C', 0.8), o('space', 'rock_A', 0.6), o('space', 'rocks_B', 0.7), o('space', 'structure_low', 0.9), o('space', 'lander_A', 1.0)],
    decor: [d('space', 'lights', 0.35, true), d('space', 'cargo_B', 0.4), d('space', 'windturbine_low', 0.5, true), d('space', 'rock_B', 0.35), d('space', 'solarpanel', 0.6, true)],
    rule: { wrap: true },
  },
];

export const getLocation = (id) => LOCATIONS.find((l) => l.id === id) || (id === 'cave' ? LOCATIONS.find((l) => l.id === 'dungeon') : LOCATIONS[0]);

// Fixed layout per location (seeded by its id) so scores on the same location are comparable.
export function layoutFor(loc) {
  const rng = createRng('layout:' + loc.id);
  const solids = [];
  const keepClear = (x, z, r) =>
    Math.hypot(x, z - 3) > 2.6 + r && // hero spawn area
    solids.every((s) => Math.hypot(s.x - x, s.z - z) > s.r + r + 1.4) &&
    !(loc.rule.river && Math.abs(z - loc.rule.river.z) < loc.rule.river.half + r + 0.3);
  for (let tries = 0; solids.length < loc.obstacleCount && tries < 400; tries++) {
    const def = rng.pick(loc.obstacles);
    const x = rng.range(-ARENA.W + 1.2, ARENA.W - 1.2);
    const z = rng.range(-ARENA.D + 1.6, ARENA.D - 1.6);
    if (keepClear(x, z, def.r)) solids.push({ ...def, x, z, rot: rng.range(0, Math.PI * 2) });
  }
  const decor = [];
  for (let i = 0; i < 16; i++) {
    const def = rng.pick(loc.decor);
    const edge = def.edge || rng.next() < 0.5;
    const x = edge ? rng.pick([-1, 1]) * (ARENA.W + rng.range(0.6, 2.2)) : rng.range(-ARENA.W, ARENA.W);
    const z = rng.range(-ARENA.D, ARENA.D);
    if (!edge && solids.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 0.6)) continue;
    decor.push({ ...def, x, z, rot: rng.range(0, Math.PI * 2) });
  }
  return { solids, decor };
}
