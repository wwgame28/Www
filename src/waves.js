import { createRng } from './rng.js';

export const ENEMY_TYPES = {
  grunt: { speed: 1.6, hp: 1, r: 0.4, from: 1, model: ['Skeleton_Minion'], scale: 1 },
  runner: { speed: 3.0, hp: 1, r: 0.35, from: 3, model: ['Skeleton_Rogue'], scale: 0.95 },
  tank: { speed: 1.1, hp: 2, r: 0.55, from: 5, model: ['Skeleton_Warrior'], scale: 1.25 },
  splitter: { speed: 1.8, hp: 1, r: 0.45, from: 7, model: ['Skeleton_Mage'], scale: 1.05 },
  ufo: { speed: 2.2, hp: 1, r: 0.5, from: 9, model: ['enemy-ufo-a'], scale: 1, flying: true },
};

const WEIGHTS = { grunt: 6, runner: 3, tank: 2, splitter: 2, ufo: 2 };

// Deterministic spawn list for a wave: same seed + wave → same enemies, sides and timing.
export function planWave(seed, wave) {
  const rng = createRng(`${seed}:wave:${wave}`);
  const types = Object.keys(ENEMY_TYPES).filter((t) => ENEMY_TYPES[t].from <= wave);
  const total = types.reduce((s, t) => s + WEIGHTS[t], 0);
  const count = 4 + 2 * wave;
  const interval = Math.max(0.35, 1.4 - wave * 0.08);
  const spawns = [];
  for (let i = 0; i < count; i++) {
    let roll = rng.next() * total, type = types[0];
    for (const t of types) { roll -= WEIGHTS[t]; if (roll <= 0) { type = t; break; } }
    spawns.push({
      type,
      side: rng.pick(['top', 'top', 'left', 'right', 'bottom']),
      along: rng.range(-0.9, 0.9),
      at: i * interval + rng.range(0, interval * 0.5),
      model: rng.pick(ENEMY_TYPES[type].model),
    });
  }
  return spawns;
}

export const speedFactor = (wave) => Math.min(1.6, 1 + 0.04 * wave);
