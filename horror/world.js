// «Плотность»: квартира из коробок (AABB), луч лидара по ним, столкновения, комнаты и тропы Жильца.
// Чистая логика без DOM и three.js — её проверяют tests/horror.test.mjs.

export const H = 2.6; // высота потолка, м
const DOOR_H = 2.05;
const T = 0.06; // половина толщины стены

export const ROOMS = {
  hall: { name: 'Прихожая', x0: 0, x1: 3, z0: 5, z1: 8 },
  kitchen: { name: 'Кухня', x0: 0, x1: 3, z0: 0, z1: 5 },
  zal: { name: 'Зал', x0: 3, x1: 10, z0: 3, z1: 8 },
  bath: { name: 'Ванная', x0: 3, x1: 6, z0: 0, z1: 3 },
  child: { name: 'Детская', x0: 6, x1: 10, z0: 0, z1: 3 },
};

export function roomAt(x, z) {
  if (x < 3) return z < 5 ? 'kitchen' : 'hall';
  if (z >= 3) return 'zal';
  return x < 6 ? 'bath' : 'child';
}

// Записки Ани. Последняя открывает входную дверь.
export const NOTES = [
  'День 3. Ночью кто-то переставляет кружки. Сканер видит всё, кроме него.',
  'Не стой на месте, когда он рядом. Он слышит, как щёлкает сканер. Рацию тоже.',
  'В зеркале квартира больше, чем на самом деле. Там я видела себя. Я стояла спиной.',
  'У нас никогда не было детской. Дверь в прихожей открыта. Уходи и не оглядывайся.',
];

export function buildApartment() {
  const boxes = [];
  const add = (x0, y0, z0, x1, y1, z1, kind = 'solid', extra = {}) => {
    const b = { id: boxes.length, min: [x0, y0, z0], max: [x1, y1, z1], kind, rev: 0, removed: false, ...extra };
    boxes.push(b);
    return b;
  };
  // Стена вдоль оси x на линии z (от xa до xb) с проёмами [[g0, g1], …]; над проёмом — перемычка.
  const wallX = (z, xa, xb, gaps = []) => {
    let cur = xa;
    for (const [g0, g1] of gaps) {
      if (g0 > cur) add(cur, 0, z - T, g0, H, z + T);
      add(g0, DOOR_H, z - T, g1, H, z + T);
      cur = g1;
    }
    if (xb > cur) add(cur, 0, z - T, xb, H, z + T);
  };
  const wallZ = (x, za, zb, gaps = []) => {
    let cur = za;
    for (const [g0, g1] of gaps) {
      if (g0 > cur) add(x - T, 0, cur, x + T, H, g0);
      add(x - T, DOOR_H, g0, x + T, H, g1);
      cur = g1;
    }
    if (zb > cur) add(x - T, 0, cur, x + T, H, zb);
  };

  add(0, -0.1, 0, 10, 0, 8, 'floor');
  add(0, H, 0, 10, H + 0.1, 8, 'floor');
  // Наружные стены и входная дверь.
  wallX(0, 0, 10);
  wallX(8, 0, 10, [[1.0, 1.9]]);
  wallZ(0, 0, 8);
  wallZ(10, 0, 8);
  add(1.0, 0, 8 - T, 1.9, DOOR_H, 8 + T, 'door', { name: 'entrance' });
  // Внутренние стены.
  wallX(5, 0, 3, [[1.0, 1.9]]); // кухня | прихожая
  wallZ(3, 0, 8, [[6.0, 6.9]]); // кухня, прихожая | ванная, зал
  wallX(3, 3, 10, [[4.0, 4.9], [7.5, 8.4]]); // ванная, детская | зал
  wallZ(6, 0, 3); // ванная | детская
  add(7.5, 0, 3 - T, 8.4, DOOR_H, 3 + T, 'door', { name: 'seal' }); // детской «нет», пока не прочитана 3-я записка

  // Прихожая.
  add(0.06, 0, 7.3, 0.5, 0.5, 7.94); // обувница
  add(2.4, 0, 5.06, 2.94, 1.9, 5.7, 'solid', { group: 'coats' }); // вешалка с пальто
  // Кухня.
  add(0.06, 0, 0.4, 0.66, 0.9, 2.9); // столешница
  add(0.06, 1.5, 0.4, 0.4, 2.2, 2.9); // навесные шкафы
  add(0.06, 0, 3.0, 0.72, 1.9, 3.7); // холодильник
  add(1.4, 0.72, 1.6, 2.4, 0.77, 2.6, 'solid', { group: 'table' }); // стол
  for (const [lx, lz] of [[1.45, 1.65], [2.3, 1.65], [1.45, 2.5], [2.3, 2.5]]) add(lx, 0, lz, lx + 0.05, 0.72, lz + 0.05, 'solid', { group: 'table' });
  add(1.65, 0, 2.75, 2.05, 0.45, 3.15, 'solid', { group: 'chair' });
  add(1.65, 0.45, 3.1, 2.05, 0.95, 3.15, 'solid', { group: 'chair' });
  add(1.8, 0.77, 2.0, 2.05, 0.79, 2.2, 'note', { note: 0 });
  // Зал.
  add(8.9, 0, 4.4, 9.94, 0.45, 7.0, 'solid', { group: 'sofa' });
  add(9.6, 0.45, 4.4, 9.94, 0.95, 7.0, 'solid', { group: 'sofa' });
  add(3.06, 0, 3.3, 3.66, 2.1, 4.7, 'solid', { group: 'wardrobe' });
  add(5.0, 0, 7.4, 6.6, 0.5, 7.94); // тумба
  add(5.2, 0.5, 7.82, 6.4, 1.2, 7.88); // телевизор
  add(6.8, 0, 5.2, 8.0, 0.42, 6.0, 'solid', { group: 'coffee' });
  add(7.2, 0.42, 5.5, 7.45, 0.44, 5.7, 'note', { note: 1, group: 'coffee' });
  add(4.2, 0, 6.6, 5.0, 0.45, 7.4, 'solid', { group: 'armchair' });
  add(4.2, 0.45, 7.25, 5.0, 0.9, 7.4, 'solid', { group: 'armchair' });
  // Ванная.
  add(3.06, 0, 0.06, 4.0, 0.6, 1.8); // ванна
  add(4.4, 0.75, 0.06, 5.0, 0.9, 0.5); // раковина
  add(4.6, 0, 0.06, 4.8, 0.75, 0.3);
  add(4.3, 1.05, 0.06, 5.1, 1.85, 0.08, 'mirror');
  add(4.85, 0.9, 0.15, 4.98, 0.92, 0.35, 'note', { note: 2 });
  add(5.4, 0, 0.06, 5.94, 0.45, 0.7); // унитаз
  // Тот, кто стоит за спиной, — его видно только в зеркале.
  add(4.45, 0, 2.2, 4.9, 1.72, 2.5, 'ghost');
  add(4.56, 1.72, 2.26, 4.8, 1.98, 2.44, 'ghost');
  // Детская.
  add(8.4, 0, 0.06, 9.94, 0.5, 1.0); // кровать
  add(9.6, 0.5, 0.06, 9.94, 1.0, 1.0);
  add(6.3, 0, 0.3, 7.0, 0.4, 0.8, 'solid', { group: 'toys' });
  add(6.06, 0, 2.0, 6.6, 1.6, 2.94);
  add(9.0, 0.5, 0.4, 9.25, 0.52, 0.6, 'note', { note: 3 });

  return { boxes, byName: Object.fromEntries(boxes.filter((b) => b.name).map((b) => [b.name, b])) };
}

// Ближайшее пересечение луча с коробками. opts.ghost — видеть «призрака»; opts.extra — доп. коробка (Жилец).
export function raycast(boxes, ox, oy, oz, dx, dy, dz, maxT, opts = {}) {
  let best = maxT, hit = null, hitAxis = 0;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  const test = (b) => {
    let tmin = 0, tmax = best, ax = -1;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-9) {
        if (o[k] < b.min[k] || o[k] > b.max[k]) return;
        continue;
      }
      let t1 = (b.min[k] - o[k]) / d[k], t2 = (b.max[k] - o[k]) / d[k];
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      if (t1 > tmin) { tmin = t1; ax = k; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return;
    }
    if (ax >= 0 && tmin > 1e-4 && tmin < best) { best = tmin; hit = b; hitAxis = ax; }
  };
  for (const b of boxes) {
    if (b.removed) continue;
    if (b.kind === 'ghost' && !opts.ghost) continue;
    test(b);
  }
  if (opts.extra) test(opts.extra);
  return hit ? { t: best, box: hit, axis: hitAxis } : null;
}

// Луч сканера с одним отражением в зеркале: лидар считает зеркало проёмом,
// поэтому точка ложится «за стеклом» — в отражённую квартиру.
export function trace(world, ox, oy, oz, dx, dy, dz, maxT, opts = {}) {
  const h = raycast(world.boxes, ox, oy, oz, dx, dy, dz, maxT, { extra: opts.monster });
  if (!h || h.box.kind === 'monster') return null; // Жилец глотает луч — в облаке дыра
  if (h.box.kind !== 'mirror') {
    return { x: ox + dx * h.t, y: oy + dy * h.t, z: oz + dz * h.t, dist: h.t, box: h.box, mirrored: false };
  }
  const r = [dx, dy, dz];
  r[h.axis] = -r[h.axis];
  const px = ox + dx * h.t, py = oy + dy * h.t, pz = oz + dz * h.t;
  const h2 = raycast(world.boxes, px + r[0] * 1e-3, py + r[1] * 1e-3, pz + r[2] * 1e-3, r[0], r[1], r[2], maxT - h.t, { ghost: opts.ghost, extra: opts.monster });
  if (!h2 || h2.box.kind === 'monster' || h2.box.kind === 'mirror') return null;
  const t = h.t + h2.t;
  return { x: ox + dx * t, y: oy + dy * t, z: oz + dz * t, dist: t, box: h2.box, mirrored: true };
}

const BLOCKS = new Set(['solid', 'door']);
// Выталкивает круг игрока (x, z, радиус r) из мебели и стен.
export function collide(world, x, z, r) {
  for (let pass = 0; pass < 3; pass++) {
    for (const b of world.boxes) {
      if (b.removed || !BLOCKS.has(b.kind) || b.max[1] < 0.15 || b.min[1] > 1.7) continue;
      const cx = Math.min(Math.max(x, b.min[0]), b.max[0]);
      const cz = Math.min(Math.max(z, b.min[2]), b.max[2]);
      const ddx = x - cx, ddz = z - cz, d2 = ddx * ddx + ddz * ddz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2), k = (r - d) / d;
        x += ddx * k; z += ddz * k;
      } else {
        const pushes = [b.min[0] - r - x, b.max[0] + r - x, b.min[2] - r - z, b.max[2] + r - z];
        let bi = 0;
        for (let i = 1; i < 4; i++) if (Math.abs(pushes[i]) < Math.abs(pushes[bi])) bi = i;
        if (bi < 2) x += pushes[bi]; else z += pushes[bi];
      }
    }
  }
  return [x, z];
}

// Тропы Жильца: узлы в комнатах и дверях. Сквозь мебель он проходит — сквозь стены нет.
export const NODES = [
  { id: 'kitchen', x: 2.3, z: 4.1, rooms: ['kitchen'] },
  { id: 'kdoor', x: 1.45, z: 5.0, rooms: ['kitchen', 'hall'] },
  { id: 'hall', x: 1.6, z: 6.5, rooms: ['hall'] },
  { id: 'zdoor', x: 3.0, z: 6.45, rooms: ['hall', 'zal'] },
  { id: 'zal_w', x: 4.3, z: 5.2, rooms: ['zal'] },
  { id: 'zal_c', x: 6.4, z: 4.3, rooms: ['zal'] },
  { id: 'zal_e', x: 8.4, z: 4.0, rooms: ['zal'] },
  { id: 'bdoor', x: 4.45, z: 3.0, rooms: ['zal', 'bath'] },
  { id: 'bath', x: 4.7, z: 1.7, rooms: ['bath'] },
  { id: 'cdoor', x: 7.95, z: 3.0, rooms: ['zal', 'child'] },
  { id: 'child', x: 7.9, z: 1.6, rooms: ['child'] },
];
const EDGES = [['kitchen', 'kdoor'], ['kdoor', 'hall'], ['hall', 'zdoor'], ['zdoor', 'zal_w'], ['zal_w', 'zal_c'], ['zal_c', 'zal_e'],
  ['zal_w', 'bdoor'], ['bdoor', 'bath'], ['zal_e', 'cdoor'], ['zal_c', 'cdoor'], ['cdoor', 'child']];
const NEIGH = new Map(NODES.map((n) => [n.id, []]));
for (const [a, b] of EDGES) { NEIGH.get(a).push(b); NEIGH.get(b).push(a); }
const NODE = new Map(NODES.map((n) => [n.id, n]));
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Путь от точки до точки через двери: список точек, последняя — цель.
export function navPath(from, to) {
  const ra = roomAt(from.x, from.z), rb = roomAt(to.x, to.z);
  if (ra === rb) return [{ x: to.x, z: to.z }];
  const cost = new Map(), prev = new Map(), open = new Set();
  for (const n of NODES) if (n.rooms.includes(ra)) { cost.set(n.id, dist2d(from, n)); open.add(n.id); }
  let best = null, bestCost = Infinity;
  while (open.size) {
    let cur = null;
    for (const id of open) if (cur === null || cost.get(id) < cost.get(cur)) cur = id;
    open.delete(cur);
    const c = cost.get(cur), n = NODE.get(cur);
    if (n.rooms.includes(rb) && c + dist2d(n, to) < bestCost) { bestCost = c + dist2d(n, to); best = cur; }
    for (const nb of NEIGH.get(cur)) {
      const nc = c + dist2d(n, NODE.get(nb));
      if (!cost.has(nb) || nc < cost.get(nb)) { cost.set(nb, nc); prev.set(nb, cur); open.add(nb); }
    }
  }
  if (!best) return [{ x: to.x, z: to.z }];
  const path = [];
  for (let id = best; id; id = prev.get(id)) path.unshift({ x: NODE.get(id).x, z: NODE.get(id).z });
  path.push({ x: to.x, z: to.z });
  return path;
}

// Соседние с комнатой комнаты (через одну дверь).
export function neighbourRooms(room) {
  const out = new Set();
  for (const n of NODES) if (n.rooms.length > 1 && n.rooms.includes(room)) for (const r of n.rooms) if (r !== room) out.add(r);
  return [...out];
}

// Сдвигает группу мебели внутри её комнаты. Возвращает сдвинутые коробки или null.
export function shiftGroup(world, group, dx, dz, avoid) {
  const parts = world.boxes.filter((b) => b.group === group && !b.removed);
  if (!parts.length) return null;
  const room = ROOMS[roomAt((parts[0].min[0] + parts[0].max[0]) / 2, (parts[0].min[2] + parts[0].max[2]) / 2)];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const b of parts) { x0 = Math.min(x0, b.min[0]); x1 = Math.max(x1, b.max[0]); z0 = Math.min(z0, b.min[2]); z1 = Math.max(z1, b.max[2]); }
  dx = Math.min(Math.max(dx, room.x0 + T - x0), room.x1 - T - x1);
  dz = Math.min(Math.max(dz, room.z0 + T - z0), room.z1 - T - z1);
  if (Math.abs(dx) + Math.abs(dz) < 0.15) return null;
  if (avoid) {
    const cx = Math.min(Math.max(avoid.x, x0 + dx), x1 + dx), cz = Math.min(Math.max(avoid.z, z0 + dz), z1 + dz);
    if (Math.hypot(avoid.x - cx, avoid.z - cz) < 0.8) return null; // не давить игрока
  }
  for (const b of parts) { b.min[0] += dx; b.max[0] += dx; b.min[2] += dz; b.max[2] += dz; b.rev++; }
  return parts;
}
