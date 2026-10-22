// Модели растительности. Деревья и кусты — из генератора ez-tree: у каждой формы ближняя и средняя
// детализация (одна и та же форма, прорежены кольца, ветки и листья). Пальма, кактус и камни —
// процедурно. Для дальних деревьев «запекаются» импостеры: снимки ближней модели с 8 сторон
// (цвет и нормали), которые потом рисуются одной карточкой, повёрнутой к камере.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config.js';
import { mulberry32 } from '../noise.js';
import { TreeGenerator } from './ez/generator.js';
import TreeOptions from './ez/options.js';
import { PRESETS } from './ez/presets.js';

const TR = CONFIG.trees;

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

class Builder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.col = [];
    this.wind = [];
    this.idx = [];
    this.groups = [];
  }

  get count() {
    return this.pos.length / 3;
  }

  vertex(x, y, z, nx, ny, nz, u, v, ao, flex, flutter) {
    this.pos.push(x, y, z);
    this.nrm.push(nx, ny, nz);
    this.uv.push(u, v);
    this.col.push(ao, ao, ao);
    this.wind.push(flex, flutter);
    return this.count - 1;
  }

  // Начать группу материала (индексы, добавленные после, относятся к ней)
  group(materialIndex) {
    const last = this.groups[this.groups.length - 1];
    if (last) last.count = this.idx.length - last.start;
    this.groups.push({ start: this.idx.length, count: 0, materialIndex });
  }

  build() {
    const last = this.groups[this.groups.length - 1];
    if (last) last.count = this.idx.length - last.start;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.wind, 2));
    g.setIndex(this.idx);
    for (const gr of this.groups) if (gr.count > 0) g.addGroup(gr.start, gr.count, gr.materialIndex);
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- Деревья ez-tree ----------
function generate(spec, seed, lod) {
  const opt = new TreeOptions();
  opt.copy(structuredClone(PRESETS[spec.preset]));
  opt.seed = seed;
  if (lod.billboard) opt.leaves.billboard = lod.billboard;
  const gen = new TreeGenerator(opt, lod);
  gen.generate();
  return gen;
}

function rawHeight(gen) {
  let h = 0;
  for (let i = 1; i < gen.branches.verts.length; i += 3) h = Math.max(h, gen.branches.verts[i]);
  for (let i = 1; i < gen.leaves.verts.length; i += 3) h = Math.max(h, gen.leaves.verts[i]);
  return h;
}

// Ветви (группа 0) и листья (группа 1) в метрах: затенение внутри кроны, веса ветра
function ezGeometry(spec, gen, k, crown) {
  const b = new Builder();
  const B = gen.branches;
  const L = gen.leaves;
  const H = spec.height;
  const flexByLevel = [0.3, 0.8, 1, 1];
  b.group(0);
  for (let i = 0; i < B.verts.length / 3; i++) {
    const x = B.verts[i * 3] * k;
    const y = B.verts[i * 3 + 1] * k;
    const z = B.verts[i * 3 + 2] * k;
    const lvl = B.levels[i];
    const ao = (0.62 + 0.38 * smooth(0, H * 0.45, y)) * (lvl >= 2 ? 0.92 : 1);
    b.vertex(x, y, z, B.normals[i * 3], B.normals[i * 3 + 1], B.normals[i * 3 + 2], B.uvs[i * 2] * 2, B.uvs[i * 2 + 1], ao, flexByLevel[Math.min(lvl, 3)], lvl >= 2 ? 0.5 : 0);
  }
  for (const v of B.indices) b.idx.push(v);
  if (spec.leaves && L.verts.length) {
    const base = b.count;
    b.group(1);
    const { cx, cy, cz, rx, ry } = crown;
    for (let i = 0; i < L.verts.length / 3; i++) {
      const x = L.verts[i * 3] * k;
      const y = L.verts[i * 3 + 1] * k;
      const z = L.verts[i * 3 + 2] * k;
      // нормали «от центра кроны»: крона освещается как объём, а не как набор плоскостей
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const dz = (z - cz) / rx;
      const d = Math.hypot(dx, dy, dz) || 1;
      let nx = L.normals[i * 3] * 0.25 + (dx / d) * 0.75;
      let ny = L.normals[i * 3 + 1] * 0.25 + (dy / d) * 0.75;
      let nz = L.normals[i * 3 + 2] * 0.25 + (dz / d) * 0.75;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const ao = (0.42 + 0.58 * smooth(0.15, 1.05, d)) * (0.72 + 0.28 * smooth(cy - ry, cy + ry, y));
      b.vertex(x, y, z, nx, ny, nz, L.uvs[i * 2], L.uvs[i * 2 + 1], ao, 1, 1);
    }
    for (const v of L.indices) b.idx.push(v + base);
  }
  return b.build();
}

function crownOf(gen, k) {
  const v = gen.leaves.verts;
  const n = v.length / 3;
  if (!n) return { cx: 0, cy: 1, cz: 0, rx: 1, ry: 1 };
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    cx += v[i * 3] * k;
    cy += v[i * 3 + 1] * k;
    cz += v[i * 3 + 2] * k;
    minY = Math.min(minY, v[i * 3 + 1] * k);
    maxY = Math.max(maxY, v[i * 3 + 1] * k);
  }
  cx /= n;
  cy /= n;
  cz /= n;
  let rx = 0.5;
  for (let i = 0; i < n; i++) rx = Math.max(rx, Math.hypot(v[i * 3] * k - cx, v[i * 3 + 2] * k - cz));
  return { cx, cy, cz, rx, ry: Math.max(0.5, (maxY - minY) / 2) };
}

function bounds(geo) {
  const p = geo.attributes.position.array;
  let h = 0;
  let r = 0;
  for (let i = 0; i < p.length; i += 3) {
    h = Math.max(h, p[i + 1]);
    r = Math.max(r, Math.hypot(p[i], p[i + 2]));
  }
  return { height: h, radius: r };
}

export function buildEzForm(spec, seed, wantMid = true) {
  const nearLod = { ...TR.near, ...(spec.near || {}) };
  const near = generate(spec, seed, nearLod);
  const k = spec.height / rawHeight(near);
  const crown = crownOf(near, k);
  const out = { near: ezGeometry(spec, near, k, crown) };
  if (wantMid) {
    const mid = generate(spec, seed, { ...TR.mid, ...(spec.mid || {}) });
    out.mid = ezGeometry(spec, mid, k, crown);
  }
  Object.assign(out, bounds(out.near));
  return out;
}

// ---------- Пальма: изогнутый кольчатый ствол и вайи-перья ----------
export function buildPalmForm(seed, detail) {
  const P = TR.palm;
  const rand = mulberry32(seed);
  const H = P.height * (0.88 + 0.24 * rand());
  const lean = P.lean * (0.5 + rand());
  const la = rand() * Math.PI * 2;
  const lx = Math.cos(la);
  const lz = Math.sin(la);
  const b = new Builder();
  const rings = detail ? P.rings : 5;
  const segs = detail ? 9 : 5;
  const center = (t) => [lx * lean * t * t, H * t, lz * lean * t * t];
  b.group(0);
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const [cx, cy, cz] = center(t);
    const rad = 0.2 * (1 - 0.32 * t) + 0.12 * (1 - smooth(0, 0.14, t));
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      b.vertex(cx + ca * rad, cy, cz + sa * rad, ca, 0.15, sa, j / segs, cy / 0.6, 0.7 + 0.3 * t, 0.5, 0);
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let j = 0; j < segs; j++) {
      const a = r * (segs + 1) + j;
      const c = a + segs + 1;
      b.idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  b.group(1);
  const [tx, ty, tz] = center(1);
  const n = detail ? P.fronds : 9;
  const S = detail ? P.frondSegments : 4;
  for (let f = 0; f < n; f++) {
    const az = (f / n) * Math.PI * 2 + rand() * 0.4;
    const dx = Math.cos(az);
    const dz = Math.sin(az);
    const e0 = 0.35 + 0.55 * rand() - (f % 3 === 0 ? 0.35 : 0);
    const droop = 1.1 + 0.7 * rand();
    const len = P.frondLength * (0.8 + 0.3 * rand());
    const fold = 0.42;
    let px = tx;
    let py = ty;
    let pz = tz;
    const base = b.count;
    for (let i = 0; i <= S; i++) {
      const t = i / S;
      const el = e0 - droop * t * t;
      const ce = Math.cos(el);
      const fx = dx * ce;
      const fy = Math.sin(el);
      const fz = dz * ce;
      // поперёк вайи — горизонтально, половинки чуть подняты (сложена вдоль средней жилки)
      const sx = -dz;
      const sz = dx;
      const w = (P.frondWidth / 2) * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.04));
      const lift = Math.sin(fold) * w;
      const out = Math.cos(fold) * w;
      // нормаль — примерно «вверх от вайи»
      let nx = -fx * fy;
      let ny = ce * ce + 0.3;
      let nz = -fz * fy;
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const ao = 0.75 + 0.25 * t;
      b.vertex(px + sx * out, py + lift, pz + sz * out, nx, ny, nz, t, 1, ao, 1, 1);
      b.vertex(px, py, pz, nx, ny, nz, t, 0.5, ao * 0.95, 1, 1);
      b.vertex(px - sx * out, py + lift, pz - sz * out, nx, ny, nz, t, 0, ao, 1, 1);
      px += fx * (len / S);
      py += fy * (len / S);
      pz += fz * (len / S);
    }
    for (let i = 0; i < S; i++) {
      const a = base + i * 3;
      const c = a + 3;
      b.idx.push(a, c, a + 1, a + 1, c, c + 1);
      b.idx.push(a + 1, c + 1, a + 2, a + 2, c + 1, c + 2);
    }
  }
  const geo = b.build();
  return { geo, ...bounds(geo) };
}

// ---------- Кактус-сагуаро: ребристый ствол и 0–2 «руки» ----------
function tube(b, path, radius, ribs, segs, vScale) {
  const base = b.count;
  let len = 0;
  const N = path.length;
  // рамка, переносимая вдоль пути (без скручивания)
  let prevT = null;
  let nrm = new THREE.Vector3(1, 0, 0);
  const tan = new THREE.Vector3();
  const bin = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const p = path[i];
    const q = path[Math.min(N - 1, i + 1)];
    const o = path[Math.max(0, i - 1)];
    tan.set(q[0] - o[0], q[1] - o[1], q[2] - o[2]).normalize();
    if (prevT) {
      const axis = new THREE.Vector3().crossVectors(prevT, tan);
      const s = axis.length();
      if (s > 1e-5) nrm.applyAxisAngle(axis.normalize(), Math.asin(Math.min(1, s)));
    } else {
      nrm = new THREE.Vector3(0, 0, 1).cross(tan);
      if (nrm.lengthSq() < 1e-6) nrm.set(1, 0, 0);
      nrm.normalize();
    }
    prevT = tan.clone();
    bin.crossVectors(tan, nrm).normalize();
    if (i > 0) len += Math.hypot(p[0] - o[0], p[1] - o[1], p[2] - o[2]);
    const r = radius(i / (N - 1));
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const rr = r * (1 + 0.075 * Math.cos(a * ribs));
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      const x = p[0] + (nrm.x * cx + bin.x * cy) * rr;
      const y = p[1] + (nrm.y * cx + bin.y * cy) * rr;
      const z = p[2] + (nrm.z * cx + bin.z * cy) * rr;
      b.vertex(x, y, z, nrm.x * cx + bin.x * cy, nrm.y * cx + bin.y * cy, nrm.z * cx + bin.z * cy, (j / segs) * (ribs / 8), len * vScale, 0.8 + 0.2 * Math.min(1, p[1] / 2), 0.4, 0);
    }
  }
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a = base + i * (segs + 1) + j;
      const c = a + segs + 1;
      b.idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
}

export function buildCactusForm(seed) {
  const C = TR.cactus;
  const rand = mulberry32(seed);
  const H = C.height * (0.85 + 0.3 * rand());
  const R = C.radius;
  const b = new Builder();
  b.group(0);
  const segs = C.ribs * 2;
  const vScale = 1 / (2 * Math.PI * R);
  const trunk = [];
  for (let i = 0; i <= 10; i++) trunk.push([0, (H - R * 0.6) * (i / 10), 0]);
  // купол сверху: сужение по окружности
  for (let i = 1; i <= 4; i++) trunk.push([0, H - R * 0.6 + R * 0.6 * Math.sin((i / 4) * Math.PI * 0.5), 0]);
  tube(b, trunk, (t) => (t < 10 / 14 ? R : R * Math.cos(((t - 10 / 14) / (4 / 14)) * Math.PI * 0.5) + 0.01), C.ribs, segs, vScale);
  const arms = Math.floor(rand() * 3);
  for (let k = 0; k < arms; k++) {
    const az = rand() * Math.PI * 2 + k * Math.PI;
    const dx = Math.cos(az);
    const dz = Math.sin(az);
    const y0 = H * (0.32 + 0.22 * rand());
    const out = 0.42 + 0.2 * rand();
    const up = 0.7 + 0.7 * rand();
    const r = R * 0.62;
    const path = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 0.5;
      path.push([dx * (R * 0.6 + out * Math.sin(a)), y0 + out * (1 - Math.cos(a)), dz * (R * 0.6 + out * Math.sin(a))]);
    }
    const top = path[path.length - 1];
    for (let i = 1; i <= 4; i++) path.push([top[0], top[1] + up * (i / 4), top[2]]);
    for (let i = 1; i <= 3; i++) path.push([top[0], top[1] + up + r * 0.6 * Math.sin((i / 3) * Math.PI * 0.5), top[2]]);
    const n = path.length;
    tube(b, path, (t) => (t < (n - 4) / (n - 1) ? r : r * Math.cos(((t - (n - 4) / (n - 1)) / (3 / (n - 1))) * Math.PI * 0.5) + 0.01), C.ribs, segs, vScale);
  }
  const geo = b.build();
  geo.computeVertexNormals();
  return { geo, ...bounds(geo) };
}

// ---------- Камни: сфера с шумом и сколами-плоскостями ----------
function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise3(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), u), l(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), u), v),
    l(l(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), u), l(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), u), v),
    w,
  );
}

export function buildRockForm(seed, detail) {
  const rand = mulberry32(seed);
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const planes = [];
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const e = (rand() - 0.3) * 1.2;
    planes.push([Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e), 0.62 + 0.25 * rand()]);
  }
  const o = rand() * 100;
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const n = vnoise3(x * 1.7 + o, y * 1.7, z * 1.7) * 0.6 + vnoise3(x * 4.1 + o, y * 4.1, z * 4.1) * 0.3 + vnoise3(x * 9 + o, y * 9, z * 9) * 0.1;
    const r = 0.78 + 0.42 * n;
    x *= r;
    y *= r * 0.72;
    z *= r;
    // сколы: всё, что вылезает за плоскость, прижимается к ней
    for (const [px, py, pz, d] of planes) {
      const over = x * px + y * py + z * pz - d;
      if (over > 0) {
        x -= px * over;
        y -= py * over;
        z -= pz * over;
      }
    }
    y = Math.max(y, -0.32);
    p.setXYZ(i, x, y, z);
    const ao = 0.62 + 0.38 * smooth(-0.3, 0.45, y);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return { geo: g, height: 1, radius: 1.2 };
}

// ---------- Импостеры ----------
const bakeVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vCol;
varying vec3 vN;
void main() {
  vUv = uv;
  vCol = color;
  vN = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const bakeAlbedo = /* glsl */ `
uniform sampler2D map;
uniform float alphaTest;
uniform vec3 tint;
uniform vec3 recolor;
uniform float snowy;
varying vec2 vUv;
varying vec3 vCol;
varying vec3 vN;
void main() {
  vec4 t = texture2D(map, vUv);
  if (t.a < alphaTest) discard;
  vec3 c = t.rgb;
  if (recolor.r > 0.0) c = vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))) * recolor;
  c *= tint * vCol;
  if (snowy > 0.5) c = mix(c, vec3(0.86, 0.9, 0.95) * vCol, smoothstep(0.2, 0.65, normalize(vN).y) * 0.85);
  gl_FragColor = vec4(c, 1.0);
}`;

const bakeNormal = /* glsl */ `
uniform sampler2D map;
uniform float alphaTest;
varying vec2 vUv;
varying vec3 vN;
void main() {
  vec4 t = texture2D(map, vUv);
  if (t.a < alphaTest) discard;
  gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, 1.0);
}`;

// forms: [{ geo, side, parts: [{ map, alphaTest, tint, recolor, snowy } по группам] }]; F — размер кадра
export function bakeImpostors(renderer, forms, F) {
  const frames = TR.impostor.frames;
  const W = frames * F;
  const H = forms.length * F;
  const opts = {
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    depthBuffer: true,
  };
  const albedo = new THREE.WebGLRenderTarget(W, H, { ...opts, colorSpace: THREE.SRGBColorSpace });
  const normal = new THREE.WebGLRenderTarget(W, H, { ...opts });
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const mkAlbedo = (part) =>
    new THREE.ShaderMaterial({
      uniforms: {
        map: { value: part.map },
        alphaTest: { value: part.alphaTest || 0 },
        tint: { value: new THREE.Color(part.tint ?? 0xffffff) },
        recolor: { value: new THREE.Vector3(...(part.recolor || [0, 0, 0])) },
        snowy: { value: part.snowy ? 1 : 0 },
      },
      vertexShader: bakeVertex,
      fragmentShader: bakeAlbedo,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
  const mkNormal = (part) =>
    new THREE.ShaderMaterial({
      uniforms: { map: { value: part.map }, alphaTest: { value: part.alphaTest || 0 } },
      vertexShader: bakeVertex,
      fragmentShader: bakeNormal,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
  const prev = {
    target: renderer.getRenderTarget(),
    autoClear: renderer.autoClear,
    clear: renderer.getClearColor(new THREE.Color()),
    alpha: renderer.getClearAlpha(),
    toneMapping: renderer.toneMapping,
  };
  renderer.autoClear = false;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  for (const rt of [albedo, normal]) {
    rt.scissorTest = false;
    renderer.setRenderTarget(rt);
    renderer.clear(true, true, false);
  }
  const mesh = new THREE.Mesh();
  scene.add(mesh);
  const disposable = [];
  forms.forEach((form, row) => {
    const side = form.side;
    cam.left = -side / 2;
    cam.right = side / 2;
    cam.bottom = -side * 0.02;
    cam.top = side * 0.98;
    cam.near = 0.1;
    cam.far = side * 4;
    cam.updateProjectionMatrix();
    mesh.geometry = form.geo;
    const albedoMats = form.parts.map(mkAlbedo);
    const normalMats = form.parts.map(mkNormal);
    disposable.push(...albedoMats, ...normalMats);
    for (let k = 0; k < frames; k++) {
      const th = (k / frames) * Math.PI * 2;
      cam.position.set(Math.sin(th) * side * 2, side * 0.48, Math.cos(th) * side * 2);
      cam.lookAt(0, side * 0.48, 0);
      for (const [rt, mats] of [
        [albedo, albedoMats],
        [normal, normalMats],
      ]) {
        rt.viewport.set(k * F, row * F, F, F);
        rt.scissor.set(k * F, row * F, F, F);
        rt.scissorTest = true;
        mesh.material = mats;
        renderer.setRenderTarget(rt);
        renderer.render(scene, cam);
      }
    }
  });
  for (const rt of [albedo, normal]) {
    rt.scissorTest = false;
    rt.viewport.set(0, 0, W, H);
    rt.scissor.set(0, 0, W, H);
  }
  renderer.setRenderTarget(prev.target);
  renderer.autoClear = prev.autoClear;
  renderer.toneMapping = prev.toneMapping;
  renderer.setClearColor(prev.clear, prev.alpha);
  for (const m of disposable) m.dispose();
  return { albedo: albedo.texture, normal: normal.texture, targets: [albedo, normal], rows: forms.length, frames };
}
