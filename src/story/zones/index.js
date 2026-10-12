// All zones of the island and their quest lines.
import * as village from './village.js';
import * as forest from './forest.js';
import * as beach from './beach.js';
import * as desert from './desert.js';
import * as mountains from './mountains.js';
import * as snow from './snow.js';
import * as magic from './magic.js';
import * as caves from './caves.js';

const all = [village, forest, beach, desert, mountains, snow, magic, caves];
export const ZONES = Object.fromEntries(all.map((m) => [m.zone.id, m.zone]));
export const LINES = all.flatMap((m) => m.lines);
