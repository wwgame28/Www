import { createRng } from './rng.js';

// Arena is centered on the origin: x in [-W, W], z in [-D, D] (−z is the top of the screen).
export const ARENA = { W: 6, D: 10 };

// `obstacles` are solid circles (bounce + block); `decor` is visual only.
// `fit` is the footprint radius a model is scaled to, so kits with different units line up.
export const LOCATIONS = [
  {
    id: 'forest', name: 'Лес', unlockWave: 0, sky: 'day',
    ground: 0x6fb35a, wall: 0x4a7a3a, fog: 0xbfe3a8, light: 1.0,
    obstacleCount: 7,
    obstacles: [
      { kit: 'nature', model: 'tree_oak', r: 0.7 },
      { kit: 'nature', model: 'tree_default', r: 0.6 },
      { kit: 'nature', model: 'tree_fat', r: 0.7 },
      { kit: 'nature', model: 'rock_largeA', r: 0.8 },
      { kit: 'nature', model: 'stump_round', r: 0.5 },
    ],
    decor: [
      { kit: 'nature', model: 'plant_bushLarge', fit: 0.6 },
      { kit: 'nature', model: 'grass_large', fit: 0.4 },
      { kit: 'nature', model: 'mushroom_redGroup', fit: 0.3 },
    ],
    rule: {},
  },
  {
    id: 'cave', name: 'Пещера', unlockWave: 5, sky: 'night',
    ground: 0x5a5560, wall: 0x3a3640, fog: 0x1c1a22, light: 0.35,
    obstacleCount: 9,
    obstacles: [
      { kit: 'nature', model: 'rock_tallA', r: 0.6 },
      { kit: 'nature', model: 'rock_tallC', r: 0.6 },
      { kit: 'nature', model: 'stone_tallB', r: 0.5 },
      { kit: 'nature', model: 'stone_tallF', r: 0.5 },
      { kit: 'cave', model: 'template-detail', r: 0.8 },
    ],
    decor: [{ kit: 'cave', model: 'gate-rock', fit: 1.2, edge: true }],
    rule: { heroLight: true },
  },
  {
    id: 'winter', name: 'Зимняя деревня', unlockWave: 10, sky: 'morning',
    ground: 0xe8f1f8, wall: 0xa9c4d8, fog: 0xdfeaf3, light: 1.0,
    obstacleCount: 7,
    obstacles: [
      { kit: 'holiday', model: 'tree-snow-a', r: 0.6 },
      { kit: 'holiday', model: 'tree-snow-b', r: 0.6 },
      { kit: 'holiday', model: 'snowman', r: 0.5 },
      { kit: 'holiday', model: 'rocks-large', r: 0.7 },
      { kit: 'holiday', model: 'present-a-cube', r: 0.45 },
    ],
    decor: [
      { kit: 'holiday', model: 'snow-pile', fit: 0.5 },
      { kit: 'holiday', model: 'sled', fit: 0.6 },
      { kit: 'holiday', model: 'lantern', fit: 0.3 },
    ],
    rule: { friction: 1.6, dropSlide: true },
  },
  {
    id: 'river', name: 'Река у крепости', unlockWave: 15, sky: 'alien',
    ground: 0x8bbf5c, wall: 0x6b5a45, fog: 0xc9dcae, light: 1.0,
    obstacleCount: 6,
    obstacles: [
      { kit: 'towerdefense', model: 'tower-round-base', r: 0.7 },
      { kit: 'towerdefense', model: 'detail-tree-large', r: 0.6 },
      { kit: 'towerdefense', model: 'detail-rocks-large', r: 0.6 },
      { kit: 'towerdefense', model: 'wood-structure', r: 0.7 },
    ],
    decor: [{ kit: 'towerdefense', model: 'detail-crystal-large', fit: 0.4 }],
    rule: { river: { z: -1.5, half: 1.1, slow: 0.5 } },
  },
];

export const getLocation = (id) => LOCATIONS.find((l) => l.id === id) || LOCATIONS[0];

// Fixed layout per location (seeded by its id) so scores on the same location are comparable.
export function layoutFor(loc) {
  const rng = createRng('layout:' + loc.id);
  const solids = [];
  const keepClear = (x, z, r) =>
    Math.hypot(x, z - 3) > 2.6 + r && // hero spawn area
    solids.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r + 1.4) &&
    !(loc.rule.river && Math.abs(z - loc.rule.river.z) < loc.rule.river.half + r + 0.3);
  for (let tries = 0; solids.length < loc.obstacleCount && tries < 400; tries++) {
    const def = rng.pick(loc.obstacles);
    const x = rng.range(-ARENA.W + 1.2, ARENA.W - 1.2);
    const z = rng.range(-ARENA.D + 1.6, ARENA.D - 1.6);
    if (keepClear(x, z, def.r)) solids.push({ ...def, x, z, rot: rng.range(0, Math.PI * 2) });
  }
  const decor = [];
  for (let i = 0; i < 14; i++) {
    const def = rng.pick(loc.decor);
    const edge = def.edge || rng.next() < 0.5;
    const x = edge ? rng.pick([-1, 1]) * (ARENA.W + rng.range(0.6, 2.2)) : rng.range(-ARENA.W, ARENA.W);
    const z = rng.range(-ARENA.D, ARENA.D);
    if (!edge && solids.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.6)) continue;
    decor.push({ ...def, x, z, rot: rng.range(0, Math.PI * 2) });
  }
  return { solids, decor };
}
