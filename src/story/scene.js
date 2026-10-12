// Draws a zone of «Приключение»: the painted ground and water, props (with prefab cabins), scenery,
// signs and the queens' portraits, villagers and the queen on her throne, quest objects (targets,
// items, the caravan), hazards (rocks, portals, wells, waves), enemy shots and boss warnings, the
// village Crystal, weather and lights. render.js builds it with its loaders and calls sync() with the
// world state every frame. Visual only: the simulation lives in world.js.
import * as THREE from 'three';
import { solidOf, zoneProps } from './world.js';
import { gust } from './hazards.js';
import { LINES } from './zones/index.js';
import { PALETTES, PEOPLE_PALETTES, SKINS, GEMS } from './data.js';
import { SCROLLS } from './chronicle.js';

const scrollsOf = (zone) => SCROLLS.filter((p) => p.unlock.scroll.zone === zone).map((p) => ({ id: p.id, x: p.unlock.scroll.x, z: p.unlock.scroll.z }));

const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const kitOf = (area, m) => (m.startsWith('@') ? m.slice(1).split('/') : [area.kit, m]);
const sizeFit = (size) => (typeof size === 'object' ? { height: size.h } : { r: size / 2 });
const palette = (id) => PALETTES.find((p) => p.id === id) || PEOPLE_PALETTES.find((p) => p.id === id) || null;
const MEDIUM = SKINS.find((s) => s.id === 'medium');
// Models that carry a flame (fraction of the height, flame size).
const FLAMES = { torch_lit: [0.95, 1], candle_triple: [1, 0.6], lantern: [0.8, 0.7], skull_candle: [1, 0.6], shrine_candles: [0.75, 0.6], lantern_standing: [0.8, 0.7] };
const THRONES = {
  nature: { seat: 0x7a5232, back: 0x5c3d24, trim: 0x3fae4a, deco: 'leaves' },
  sea: { seat: 0x2f6f8f, back: 0x49b6d8, trim: 0x9ff0ff, deco: 'waves', glow: 0x2fb8e0 },
  sand: { seat: 0xd9b46a, back: 0xc79a4a, trim: 0xffd27a, deco: 'sun', glow: 0xffa020 },
  stone: { seat: 0x6a6460, back: 0x57524e, trim: 0xd83a48, deco: 'spikes' },
  snow: { seat: 0xcfe8f8, back: 0xe8f6ff, trim: 0x9fd8ff, deco: 'spikes', glow: 0x9fd8ff, glass: true },
  magic: { seat: 0x6a3fa0, back: 0x8a5ac8, trim: 0xffd27a, deco: 'star', glow: 0xb56cff },
  dark: { seat: 0x2a2038, back: 0x3a2a50, trim: 0x8a6cff, deco: 'spikes', glow: 0x7a54c4 },
};

export const zoneSaved = (area, story) => {
  const own = LINES.filter((l) => l.zone === area.id && !l.side);
  return own.length > 0 && own.every((l) => story.done.includes(l.id));
};

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const hex = (c) => `#${new THREE.Color(c).getHexString()}`;

export function createStoryScene(ctx) {
  const { instance, loadModel, animate, addOccluder, recolorMaterial, fx, texLoader, kick, high } = ctx;
  let level = null, area = null, story = null;
  let st = null; // everything this zone shows, rebuilt with the zone

  // ---------- ground ----------
  function ground() {
    const { W, D } = area.size, N = 1024, sx = N / (W * 2), sz = N / (D * 2);
    const base = new THREE.Color(area.ground), road = new THREE.Color(area.road);
    const P = (x, z) => [(x + W) * sx, (z + D) * sz];
    const tex = canvasTexture(N, N, (g) => {
      g.fillStyle = hex(base); g.fillRect(0, 0, N, N);
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      g.globalAlpha = 0.35;
      for (let i = 0; i < 260; i++) {
        g.fillStyle = hex(base.clone().multiplyScalar(0.86 + rnd() * 0.28));
        g.beginPath(); g.arc(rnd() * N, rnd() * N, 10 + rnd() * 40, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      const shape = (a, fill) => {
        g.beginPath();
        if (a.r !== undefined) { const [cx, cy] = P(a.x, a.z); g.ellipse(cx, cy, a.r * sx, a.r * sz, 0, 0, Math.PI * 2); }
        else { const [x0, y0] = P(a.x - a.w / 2, a.z - a.d / 2); g.rect(x0, y0, a.w * sx, a.d * sz); }
        if (fill) { g.fillStyle = fill; g.fill(); }
      };
      for (const a of area.paint || []) {
        if (a.kind === 'water' || a.kind === 'shallow') { shape(a, a.kind === 'water' ? '#3f8fc8' : '#6fcfd8'); g.globalAlpha = 0.5; g.lineWidth = 6; g.strokeStyle = '#e8f8ff'; shape(a); g.stroke(); g.globalAlpha = 1; }
        else if (a.kind === 'ice') {
          shape(a, '#cfe6f6');
          g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3;
          for (let i = 0; i < 14; i++) { const [cx, cy] = P(a.x + (rnd() - 0.5) * a.r * 1.4, a.z + (rnd() - 0.5) * a.r * 1.4); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (rnd() - 0.5) * 60, cy + (rnd() - 0.5) * 60); g.stroke(); }
        } else if (a.kind === 'quicksand') {
          shape(a, '#b98a48');
          g.strokeStyle = 'rgba(80,50,20,.45)'; g.lineWidth = 4;
          const [cx, cy] = P(a.x, a.z);
          for (let r = 0.3; r < 1; r += 0.22) { g.beginPath(); g.ellipse(cx, cy, a.r * sx * r, a.r * sz * r, r * 3, 0.3, Math.PI * 1.7); g.stroke(); }
        } else if (a.kind === 'chasm') {
          const [x0, y0] = P(a.x - a.w / 2, a.z - a.d / 2), gr = g.createLinearGradient(x0, 0, x0 + a.w * sx, 0);
          gr.addColorStop(0, '#3a3530'); gr.addColorStop(0.2, '#08070a'); gr.addColorStop(0.8, '#08070a'); gr.addColorStop(1, '#3a3530');
          g.fillStyle = gr; g.fillRect(x0, y0, a.w * sx, a.d * sz);
        } else if (a.kind === 'rune') {
          const [cx, cy] = P(a.x, a.z);
          g.strokeStyle = 'rgba(200,160,255,.75)'; g.lineWidth = 5;
          for (const k of [1, 0.78]) { g.beginPath(); g.ellipse(cx, cy, a.r * sx * k, a.r * sz * k, 0, 0, Math.PI * 2); g.stroke(); }
          for (let i = 0; i < 8; i++) { const t = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(t) * a.r * sx * 0.78, cy + Math.sin(t) * a.r * sz * 0.78); g.lineTo(cx + Math.cos(t) * a.r * sx, cy + Math.sin(t) * a.r * sz); g.stroke(); }
        }
      }
      g.lineCap = g.lineJoin = 'round';
      for (const [w, col, a] of [[4, base.clone().lerp(road, 0.5), 0.6], [3, road, 1]]) {
        g.strokeStyle = hex(col); g.globalAlpha = a; g.lineWidth = w * sx;
        for (const line of area.roads) { g.beginPath(); line.forEach(([x, z], i) => g[i ? 'lineTo' : 'moveTo'](...P(x, z))); g.stroke(); }
      }
    });
    tex.anisotropy = 4;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, D * 2), new THREE.MeshLambertMaterial({ map: tex }));
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(W * 2 + 160, D * 2 + 160), new THREE.MeshLambertMaterial({ color: base.clone().multiplyScalar(0.8) }));
    for (const m of [floor, rim]) { m.rotation.x = -Math.PI / 2; m.receiveShadow = true; level.add(m); }
    rim.position.y = -0.02;
    // Water you can see through: ponds and streams, and the beach's shallows and open sea.
    const waterMat = new THREE.MeshLambertMaterial({ color: 0x4fb6e0, transparent: true, opacity: 0.45, depthWrite: false });
    for (const a of area.paint || []) {
      if (a.kind !== 'water' && a.kind !== 'shallow') continue;
      const geo = a.r !== undefined ? new THREE.CircleGeometry(a.r, 32) : new THREE.PlaneGeometry(a.w, a.d);
      const m = new THREE.Mesh(geo, waterMat);
      m.rotation.x = -Math.PI / 2; m.position.set(a.x, 0.035, a.z);
      level.add(m);
    }
    if (area.sea) {
      const deep = new THREE.Mesh(new THREE.PlaneGeometry(220, 260), new THREE.MeshLambertMaterial({ color: 0x1f6f9e }));
      deep.rotation.x = -Math.PI / 2; deep.position.set(W + 110, 0.02, 0);
      level.add(deep);
      st.foam = new THREE.Mesh(new THREE.PlaneGeometry(1.6, D * 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      st.foam.rotation.x = -Math.PI / 2; st.foam.position.y = 0.06;
      level.add(st.foam);
    }
  }

  // ---------- props, prefabs, scenery ----------
  function tintObj(obj, tint) {
    const c = new THREE.Color(tint);
    obj.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.multiply(c); } });
  }
  async function prefab(name, size) {
    const def = area.prefabs[name.slice(1)], group = new THREE.Group();
    await Promise.all(def.pieces.map(async ([m, x, y, z, rot]) => {
      const [kit, model] = kitOf(area, m);
      const o = (await loadModel(kit, model)).scene.clone();
      o.traverse((c) => { if (c.isMesh) { c.castShadow = high; c.receiveShadow = true; } });
      o.position.set(x, y, z); o.rotation.y = (rot * Math.PI) / 180;
      group.add(o);
    }));
    group.scale.setScalar(size / Math.max(def.box[0], def.box[2]));
    const wrap = new THREE.Group();
    wrap.add(group);
    return wrap;
  }
  const flamePts = [];
  async function placeProp(e) {
    const o = solidOf(area, e), opts = e[6] || {};
    const obj = e[0].startsWith('#') ? await prefab(e[0], e[4]) : (await instance(o.kit, o.model, { ...o.fit, center: true })).obj;
    if (opts.tint) tintObj(obj, opts.tint);
    obj.position.set(o.x, 0, o.z); obj.rotation.y = o.rot;
    level.add(obj);
    const box = new THREE.Box3().setFromObject(obj), h = box.max.y;
    // A tree's crown is much wider than its trunk: it fades when it hides the hero, too.
    const crown = e[5] === 'trunk' ? (Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2) * 0.8 : 0;
    if (h > 1.4) addOccluder(obj, o.x, o.z, Math.max(o.r, (o.hx || 0) + o.r, (o.hz || 0) + o.r, crown));
    const f = FLAMES[o.model];
    if (f) flamePts.push({ x: o.x, y: h * f[0], z: o.z, scale: f[1] });
    if (opts.hurts) st.thorns.push(obj);
  }
  async function placeScenery([m, x, z, rot, size, opts]) {
    const [kit, model] = kitOf(area, m);
    const { obj } = await instance(kit, model, { ...sizeFit(size), center: true });
    if (opts?.tint) tintObj(obj, opts.tint);
    obj.position.set(x, 0, z); obj.rotation.y = (rot * Math.PI) / 180;
    level.add(obj);
    const box = new THREE.Box3().setFromObject(obj), f = FLAMES[model];
    // Trees and hills around the edge fade when the camera backs into them.
    // (A mountain narrows toward the camera's height: only its core counts.)
    if (box.max.y > 2) addOccluder(obj, x, z, (Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2) * (box.max.y > 8 ? 0.55 : 1));
    if (f) flamePts.push({ x, y: box.max.y * f[0], z, scale: f[1] });
  }

  // ---------- signs and portraits ----------
  const wood = new THREE.MeshLambertMaterial({ color: 0x7a5232 });
  function board(w, h, tex) {
    const g = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    face.position.z = 0.045;
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.08), wood);
    g.add(back, face);
    return g;
  }
  function sign({ x, z, rot, text }) {
    const tex = canvasTexture(512, 128, (g, W, H) => {
      g.fillStyle = '#c99a62'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#7a5232'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10);
      g.fillStyle = '#3a2410'; g.font = '800 54px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, W / 2, H / 2 + 3, W - 40);
    });
    const s = new THREE.Group(), b = board(2.2, 0.55, tex);
    b.position.y = 1.55;
    for (const px of [-0.85, 0.85]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.1), wood); p.position.set(px, 0.9, -0.02); s.add(p); }
    s.add(b);
    s.position.set(x, 0, z); s.rotation.y = (rot * Math.PI) / 180;
    level.add(s);
  }
  function portrait({ x, z, rot, image, title, big }) {
    const w = big ? 2.7 : 1.5, h = w * (640 / 517);
    const tex = texLoader.load(`assets/story/${image}.jpg`);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Group(), b = board(w, h, tex), y0 = big ? 1.6 : 1.2;
    b.position.y = y0 + h / 2;
    const plate = board(w * 0.9, 0.36, canvasTexture(512, 80, (g, W, H) => {
      g.fillStyle = '#2b5f7a'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffe9a8'; g.font = '800 40px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(title, W / 2, H / 2 + 2, W - 30);
    }));
    plate.position.y = y0 - 0.3;
    for (const px of [-w / 2 + 0.05, w / 2 - 0.05]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, y0 + h + 0.25, 0.14), wood); p.position.set(px, (y0 + h + 0.25) / 2, -0.06); s.add(p); }
    s.add(b, plate);
    s.position.set(x, 0, z); s.rotation.y = (rot * Math.PI) / 180;
    level.add(s);
    st.portraitSolids.push({ x, z });
  }

  // ---------- people ----------
  let markTex = null, zzTex = null;
  function sprite(kind) {
    if (kind === 'mark' && !markTex) markTex = canvasTexture(128, 128, (g) => {
      g.fillStyle = '#ffd34d'; g.strokeStyle = '#14182b'; g.lineWidth = 10;
      g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#14182b'; g.font = '900 84px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 64, 70);
    });
    if (kind === 'zz' && !zzTex) zzTex = canvasTexture(128, 128, (g) => {
      g.fillStyle = '#ffffff'; g.strokeStyle = '#3a4a7a'; g.lineWidth = 6; g.font = '900 54px system-ui, sans-serif';
      g.strokeText('Z', 20, 92); g.fillText('Z', 20, 92); g.font = '900 38px system-ui, sans-serif'; g.strokeText('z', 72, 52); g.fillText('z', 72, 52);
    });
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: kind === 'mark' ? markTex : zzTex, depthWrite: false }));
    m.scale.setScalar(0.5); m.visible = false;
    return m;
  }
  function crown(color) {
    const g = new THREE.Group(), gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.7, roughness: 0.3, emissive: 0x6a4800, emissiveIntensity: 0.4 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.08, 16, 1, true), gold);
    g.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2, spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), gold);
      spike.position.set(Math.sin(a) * 0.15, 0.09, Math.cos(a) * 0.15);
      g.add(spike);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, flatShading: true }));
    gem.position.set(0, 0.03, 0.17);
    g.add(gem);
    return g;
  }
  function throne(style) {
    const s = THRONES[style] || THRONES.stone, g = new THREE.Group();
    const mat = (c, glow) => (s.glass ? new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.8, roughness: 0.15, emissive: glow || 0, emissiveIntensity: glow ? 0.35 : 0 })
      : new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, emissive: glow || 0, emissiveIntensity: glow ? 0.35 : 0 }));
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.1), mat(s.seat));
    seat.position.y = 0.25;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.3), mat(s.back, s.glow));
    back.position.set(0, 1.25, -0.5);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.8, 4), mat(s.back, s.glow));
    top.position.set(0, 2.9, -0.5); top.rotation.y = Math.PI / 4; top.scale.z = 0.3;
    g.add(seat, back, top);
    for (const x of [-0.7, 0.7]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 1.0), mat(s.trim)); arm.position.set(x, 0.75, -0.05); g.add(arm); }
    const trim = new THREE.MeshStandardMaterial({ color: s.trim, emissive: s.trim, emissiveIntensity: 0.5, roughness: 0.4 });
    if (s.deco === 'leaves') for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), trim); l.position.set(-0.8 + (i % 5) * 0.4, 2.3 + Math.floor(i / 5) * 0.45, -0.45); g.add(l); }
    if (s.deco === 'waves' || s.deco === 'spikes') for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7 + (i % 2) * 0.4, 5), trim); c.position.set(-0.6 + i * 0.3, 2.75, -0.5); g.add(c); }
    if (s.deco === 'sun') { const d = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), trim); d.position.set(0, 2.1, -0.34); g.add(d); }
    if (s.deco === 'star') { const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), trim); d.position.set(0, 3.4, -0.5); d.scale.z = 0.4; g.add(d); st.spinners.push(d); }
    g.traverse((m) => { if (m.isMesh) { m.castShadow = high; m.receiveShadow = true; } });
    return g;
  }
  async function person(v) {
    let view;
    if (v.prop) {
      const [kit, model] = kitOf(area, v.prop);
      const { obj } = await instance(kit, model, { height: v.size || 1.4 });
      view = { obj, mixer: null, prop: true, face: v.facing, bob: Math.random() * 6 };
    } else {
      const h = await instance('heroes', v.model, { height: 1.3 });
      for (const side of ['handslotl', 'handslotr']) for (const c of h.inner.getObjectByName(side)?.children ?? []) c.visible = !!v.hold?.includes(c.name);
      const body = [];
      h.inner.traverse((m) => { if (m.isMesh && !/handslot/.test(m.parent?.name ?? '')) body.push(m); });
      if (v.crown && v.model === 'Mage') for (const m of body) if (/Hat/i.test(m.name)) m.visible = false; // the crown replaces the wizard hat
      const pal = palette(v.palette);
      if (pal) {
        const uvs = body.flatMap((m) => Array.from(m.geometry.attributes.uv?.array ?? []));
        for (const m of body) m.material = recolorMaterial(m.material, { palette: { id: pal.id, ...pal }, skin: MEDIUM }, uvs);
      } else if (v.tint) {
        const tint = new THREE.Color(v.tint);
        for (const m of body) { m.material = m.material.clone(); m.material.color.multiply(tint); }
      }
      if (v.ghost) for (const m of body) { m.material = m.material.clone(); Object.assign(m.material, { transparent: true, opacity: 0.55, depthWrite: false }); m.material.emissive?.setHex(0x3a5aa8); m.castShadow = false; }
      view = { obj: h.obj, mixer: new THREE.AnimationMixer(h.inner), animations: h.animations, face: v.facing };
      animate(view, 'Idle', 0);
      view.mixer.update(Math.random() * 2); // idles out of step
      if (v.crown) {
        const top = new THREE.Box3();
        for (const m of body) if (m.visible) top.expandByObject(m);
        const c = crown(v.crown);
        c.position.y = top.max.y - 0.06;
        h.obj.add(c);
      }
    }
    view.mark = sprite('mark');
    view.mark.position.y = 1.85;
    view.obj.add(view.mark);
    view.obj.position.set(v.x, 0, v.z); view.obj.rotation.y = v.facing;
    level.add(view.obj);
    return view;
  }

  // ---------- quest objects ----------
  const glowMat = (c, k = 1.4) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.2, flatShading: true });
  function beam(color) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4, 10, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
    b.position.y = 2;
    return b;
  }
  async function targetView(t) {
    const g = new THREE.Group();
    g.rotation.order = 'YXZ';
    const view = { obj: g, t, lit: false, style: t.style };
    if (t.style === 'target') g.add((await instance('hex', 'target', { height: 1.5, center: true })).obj);
    else if (t.style === 'brazier') {
      const stone = new THREE.MeshStandardMaterial({ color: area.dark ? 0x4a3f60 : 0x8a8478, roughness: 0.8 });
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.0, 8), stone); post.position.y = 0.5;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.22, 0.3, 10), stone); bowl.position.y = 1.12;
      const coal = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 6), glowMat(area.dark ? 0x6a5aff : 0x553322, 0.15)); coal.position.y = 1.2; coal.scale.y = 0.4;
      g.add(post, bowl, coal);
      view.coal = coal; view.flameY = 1.35;
    } else if (t.style === 'lantern') {
      g.add((await instance('holiday', 'lantern', { height: 2.2, center: true })).obj);
      const glass = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glowMat(0x553300, 0.1)); glass.position.y = 1.9;
      g.add(glass); view.coal = glass; view.flameY = 1.85;
    } else if (t.style === 'obelisk') {
      const { obj } = await instance('nature', 'statue_obelisk', { height: 3.2, center: true });
      g.add(obj);
      const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), glowMat(0x553311, 0.1)); rune.position.y = 3.45;
      g.add(rune); view.coal = rune; view.flameY = null;
    } else if (t.style === 'rift') {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 28), new THREE.MeshBasicMaterial({ map: swirlTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      disc.position.y = 1.3;
      g.add(disc); view.disc = disc; st.billboards.push(disc);
    } else if (t.style === 'boulder') {
      g.add((await instance('hex', 'rock_single_D', { height: 1.6, center: true })).obj);
    } else if (t.style === 'prison') {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(1.25, 0), new THREE.MeshStandardMaterial({ color: 0x1a1028, emissive: 0x4a2a8a, emissiveIntensity: 0.6, transparent: true, opacity: 0.82, roughness: 0.1, flatShading: true }));
      c.scale.y = 1.4; c.position.y = 1.4;
      g.add(c); view.crystal = c;
    }
    g.position.set(t.x, 0, t.z);
    if (t.style === 'target') g.rotation.y = Math.atan2(ctx.heroPos.x - t.x, ctx.heroPos.z - t.z);
    level.add(g);
    return view;
  }
  let swirl = null;
  function swirlTex() {
    swirl ??= canvasTexture(128, 128, (g) => {
      const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(200,120,255,.9)'); r.addColorStop(0.75, 'rgba(90,40,200,.6)'); r.addColorStop(1, 'rgba(40,10,90,0)');
      g.fillStyle = r; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = 'rgba(255,230,255,.8)'; g.lineWidth = 4;
      for (let i = 0; i < 4; i++) { g.beginPath(); for (let k = 0; k < 40; k++) { const a = (i / 4) * Math.PI * 2 + k * 0.16, rr = 6 + k * 1.4; g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); } g.stroke(); }
    });
    return swirl;
  }
  // Quest items: models standing on the ground (flowers, mushrooms, jugs, pryaniki…) or glowing
  // things that float and turn (gems, pearls, stars, medals). [kit, model, height] or a maker.
  const ITEMS = {
    flower: { color: 0xffd34d, model: ['nature', 'flower_yellowA', 0.7], glow: [0xffc830, 0.55] },
    mushroom: { color: 0x9fffd0, model: ['nature', 'mushroom_red', 0.6], glow: [0x7fffc0, 0.5] },
    jug: { color: 0x7fd8ff, model: ['nature', 'pot_small', 0.6] },
    cookie: { color: 0xffb46a, model: ['holiday', 'gingerbread-man', 0.75] },
    ore: { color: 0xff9a5a, model: ['hex', 'resource_stone', 0.55] },
    bottle: { color: 0x9fffd8, make: () => bottleMesh(), lie: true },
    pearl: { color: 0xffffff, make: () => new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfff8f0, emissive: 0xffd8f0, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.3 })) },
    star: { color: 0xffe27a, make: () => new THREE.Mesh(starGeo(), glowMat(0xffe27a, 1.3)) },
    medal: { color: 0xffd34d, make: () => medalMesh() },
    sunstone: { color: 0xffb42e, make: () => gemMesh(0xffb42e) },
    crystal: { color: 0x9fe8ff, make: () => gemMesh(0x9fe8ff) },
    shard: { color: 0x7ff3ff, make: () => gemMesh(0x7ff3ff) },
    scroll: { color: 0xffe9a8, make: () => scrollMesh() },
  };
  function gemMesh(c) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), glowMat(c, 1.4)); m.scale.y = 1.6; return m; }
  function bottleMesh() {
    const g = new THREE.Group(), glass = new THREE.MeshStandardMaterial({ color: 0x6fd8a8, transparent: true, opacity: 0.6, roughness: 0.05, emissive: 0x1a6a4a, emissiveIntensity: 0.4 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 12), glass), neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.14, 10), glass);
    neck.position.y = 0.24;
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a32 })); cork.position.y = 0.33;
    const note = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0x6a5a3a, emissiveIntensity: 0.4 }));
    g.add(body, neck, cork, note);
    g.rotation.z = Math.PI / 2 - 0.25; // lies in the sand
    g.scale.setScalar(1.6);
    return g;
  }
  function medalMesh() {
    const g = new THREE.Group(), gold = glowMat(0xffc83d, 0.8);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), gold); disc.rotation.x = Math.PI / 2;
    const star = new THREE.Mesh(starGeo(), glowMat(0xfff2b0, 1)); star.scale.setScalar(0.45); star.position.z = 0.04;
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.02), new THREE.MeshStandardMaterial({ color: 0x3a6ad8 })); ribbon.position.y = 0.3;
    g.add(disc, star, ribbon);
    return g;
  }
  function scrollMesh() {
    const g = new THREE.Group(), paper = new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffd88a, emissiveIntensity: 0.5, roughness: 0.6 });
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.46, 14), paper); roll.rotation.z = Math.PI / 2;
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a32 });
    for (const x of [-0.27, 0.27]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), wood); k.rotation.z = Math.PI / 2; k.position.x = x; g.add(k); }
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.018, 6, 16), new THREE.MeshStandardMaterial({ color: 0xd83a48 })); tie.rotation.y = Math.PI / 2;
    g.add(roll, tie);
    return g;
  }
  async function itemView(it) {
    const g = new THREE.Group(), def = ITEMS[it.kind] || ITEMS.shard, color = def.color;
    let gem;
    if (def.model) {
      const [kit, model, h] = def.model;
      gem = (await instance(kit, model, { height: h, center: true })).obj;
      if (def.glow) { const glow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glowMat(def.glow[0], 1.2)); glow.position.y = def.glow[1]; gem.add(glow); }
    } else gem = def.make();
    if (def.lie) gem.position.y = 0.2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
    g.add(gem, ring, beam(color));
    g.position.set(it.x, 0, it.z);
    level.add(g);
    return { obj: g, gem, ring, it, spin: !def.model && !def.lie, baseY: def.lie ? 0.2 : 0 };
  }
  function starGeo() {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.12 : 0.3; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    return new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }).center();
  }

  // ---------- the village Crystal ----------
  function crystalCluster(x, z, color, h, lit = true) {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 + 0.08 * (i % 3), 0), lit ? glowMat(color, 1.1) : new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.6, flatShading: true }));
      c.scale.y = h * (0.7 + 0.25 * (i % 2)) * 1.6;
      c.position.set(Math.cos(i * 1.7) * 0.35, c.scale.y * 0.2, Math.sin(i * 1.7) * 0.35);
      c.rotation.z = (i - 1.5) * 0.18;
      g.add(c);
    }
    g.position.set(x, 0, z);
    level.add(g);
    return g;
  }
  function villageCrystal() {
    const { x, z } = area.crystal, g = new THREE.Group(), whole = story.done.includes('king');
    GEMS.forEach((gem, i) => {
      const lit = story.gems.includes(gem.id), a = (i / GEMS.length) * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), lit ? glowMat(gem.color, 1.5) : new THREE.MeshStandardMaterial({ color: 0x4a4a55, roughness: 0.7, flatShading: true }));
      c.scale.y = 1.7;
      c.position.set(Math.sin(a) * 0.32, 0, Math.cos(a) * 0.32);
      g.add(c);
    });
    const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), whole ? glowMat(0xffffff, 1.8) : glowMat(0x7ff3ff, story.flags.includes('awakened') ? 0.9 : 0.25));
    heart.scale.y = 1.8;
    g.add(heart);
    g.position.set(x, 1.75, z);
    level.add(g);
    st.spinners.push(g);
  }

  // ---------- build ----------
  async function build(zoneArea, zoneStory, zoneLevel) {
    area = zoneArea; story = zoneStory; level = zoneLevel;
    flamePts.length = 0;
    st = {
      people: new Map(), targets: null, targetViews: [], items: null, itemViews: [], object: null, thorns: [], spinners: [], billboards: [], portraitSolids: [],
      rocks: [], shots: [], marks: [], swirls: [], scrollViews: [], foam: null, lights: [], queenState: null, zz: null, ice: null, prison: null, throne: null, objHp: null,
    };
    ground();
    const jobs = [];
    for (const e of zoneProps(area, story)) jobs.push(placeProp(e));
    for (const e of area.scenery) jobs.push(placeScenery(e));
    for (const s of area.signs || []) sign(s);
    for (const p of area.portraits || []) portrait(p);
    const people = [...area.villagers, ...(area.queen ? [{ ...area.queen, id: 'queen' }] : []), ...(story.done.includes('king') ? area.feast || [] : [])];
    for (const v of people) jobs.push(person(v).then((view) => st.people.set(v.id, view)));
    if (area.queen) {
      const q = area.queen, t = throne(q.throne);
      t.position.set(q.x - Math.sin(q.facing) * 0.55, 0, q.z - Math.cos(q.facing) * 0.55); t.rotation.y = q.facing;
      level.add(t); st.throne = t;
      addOccluder(t, t.position.x, t.position.z, 0.9);
    }
    for (const [x, z, c, h] of area.crystals || []) crystalCluster(x, z, new THREE.Color(c).getHex(), h / 2);
    if (area.crystal) villageCrystal();
    for (const p of (area.areas || []).filter((a) => a.kind === 'portal')) {
      for (const [x, z] of [p.a, p.b]) { // a swirl filling the stone ring's hole (the ring is scenery)
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), new THREE.MeshBasicMaterial({ map: swirlTex(), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        d.position.set(x, 1.62, z);
        level.add(d); st.swirls.push(d);
      }
    }
    for (const w of (area.areas || []).filter((a) => a.kind === 'pull')) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(w.r, 40), new THREE.MeshBasicMaterial({ map: swirlTex(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      d.rotation.x = -Math.PI / 2; d.position.set(w.x, 0.05, w.z);
      level.add(d); st.spinners.push(d);
    }
    if (area.object) jobs.push(loadModel('hex', area.object.model));
    for (const sc of scrollsOf(area.id)) if (!(story.scrolls || []).includes(sc.id)) jobs.push(itemView({ ...sc, kind: 'scroll' }).then((v) => st.scrollViews.push(v)));
    jobs.push(loadModel('hex', 'target'), loadModel('hex', 'rock_single_D'), loadModel('hex', 'rock_single_A'));
    const mine = st;
    await Promise.all(jobs);
    if (st !== mine) return; // another zone was opened meanwhile
    flamePts.unshift({ x: area.campfire.x, y: 0.28, z: area.campfire.z, scale: 1.5, color: area.fireColor });
    st.baseFlames = [...flamePts];
    fx.setFlames(flamePts);
    fx.setWeather(zoneSaved(area, story) ? area.weatherDone : area.weather);
    // A few lights for dark zones: the weapon's glow and the nearest fires and crystals.
    if (area.dark) {
      for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffb070, 0, 9, 1.6); level.add(l); st.lights.push(l); }
      st.weaponLight = new THREE.PointLight(0xfff0b0, 0, 8, 1.4);
      level.add(st.weaponLight);
    }
  }

  // ---------- per frame ----------
  function syncTargets(g, dt) {
    if (st.targets !== g.targets) {
      for (const v of st.targetViews) level.remove(v.obj);
      const own = st.targets = g.targets;
      st.targetViews = [];
      for (const t of own) targetView(t).then((v) => { if (st.targets === own) st.targetViews.push(v); else level.remove(v.obj); });
    }
    for (const v of st.targetViews) {
      const t = v.t;
      if (v.disc) v.disc.rotation.z += dt * (t.hit ? 10 : 2.5);
      if (!t.hit) {
        if (v.shakeT > 0) { v.shakeT -= dt; v.obj.position.x = t.x + Math.sin(v.shakeT * 60) * 0.06; } else v.obj.position.x = t.x;
        continue;
      }
      if (v.style === 'target') {
        const k = Math.min(1, t.t / 0.35);
        v.obj.rotation.x = -(Math.PI / 2) * k * k; // falls away from the hero
        v.obj.position.y = -Math.max(0, t.t - 1.2) * 1.2;
        v.obj.visible = t.t < 2.4;
      } else if (v.style === 'rift' || v.style === 'boulder' || v.style === 'prison') {
        const k = Math.max(0, 1 - t.t / 0.45);
        v.obj.scale.setScalar(k);
        v.obj.visible = k > 0;
      } else if (!v.lit) { // a fire, lantern or obelisk lights up
        v.lit = true;
        v.coal.material = glowMat(v.style === 'obelisk' ? 0xffb42e : area.dark ? 0xb090ff : 0xff9a3a, 1.6);
        if (v.flameY) { st.baseFlames.push({ x: t.x, y: v.flameY, z: t.z, scale: 1.1, color: area.dark ? 0xb090ff : undefined }); fx.setFlames(st.baseFlames); }
        if (v.style === 'obelisk') v.obj.add(beam(0xffb42e));
      }
    }
  }
  function syncItems(g, dt) {
    if (st.items !== g.items) {
      for (const v of st.itemViews) level.remove(v.obj);
      const own = st.items = g.items;
      st.itemViews = [];
      for (const it of own) itemView(it).then((v) => { if (st.items === own) st.itemViews.push(v); else level.remove(v.obj); });
    }
    for (const v of st.scrollViews) { // a found scroll vanishes
      if (v.obj.visible && g.scrolls.find((x) => x.id === v.it.id)?.taken) { v.obj.visible = false; fx.burst('ring', v.it.x, 0.8, v.it.z, 0xffe9a8); }
      v.gem.position.y = 0.7 + Math.sin(g.time * 2 + v.it.x) * 0.1; v.gem.rotation.y += dt;
    }
    for (const v of st.itemViews) {
      v.obj.visible = !v.it.taken;
      v.gem.position.y = v.spin ? 0.75 + Math.sin(g.time * 2.5 + v.it.id) * 0.12 : v.baseY; // gems float, flowers grow
      if (v.spin) v.gem.rotation.y += dt * 1.8;
      v.ring.scale.setScalar(1 + Math.sin(g.time * 5) * 0.1);
    }
  }
  function syncObject(g) {
    const o = g.object;
    if (!o) { if (st.object) { level.remove(st.object); st.object = null; } return; }
    if (!st.object) {
      const def = area.object || { model: 'wheelbarrow', scale: 2 };
      st.object = new THREE.Group();
      instance('hex', def.model, { r: o.r * 1.1, center: true }).then(({ obj }) => st.object?.add(obj));
      st.objHp = new THREE.Sprite(new THREE.SpriteMaterial({ depthWrite: false }));
      st.objHp.scale.set(1.6, 0.25, 1); st.objHp.position.y = 2.2;
      st.object.add(st.objHp); st.objHpShown = -1;
      st.object.position.set(o.x, 0, o.z);
      level.add(st.object);
    }
    if (st.objHpShown !== o.hp) {
      st.objHpShown = o.hp;
      st.objHp.material.map?.dispose();
      st.objHp.material.map = canvasTexture(256, 40, (c, W, H) => {
        c.fillStyle = 'rgba(20,24,43,.8)'; c.fillRect(0, 0, W, H);
        c.fillStyle = o.hp / o.max > 0.35 ? '#7ee07a' : '#ff6b6b'; c.fillRect(4, 4, (W - 8) * (o.hp / o.max), H - 8);
      });
      st.objHp.material.needsUpdate = true;
    }
  }
  function syncQueen(g) {
    const v = st.people.get('queen');
    if (!v) return;
    const s = g.queenState;
    if (s === st.queenState) return;
    const was = st.queenState;
    st.queenState = s;
    v.obj.visible = s !== 'hidden';
    if (st.zz) { v.obj.remove(st.zz); st.zz = null; }
    for (const k of ['ice', 'prison']) if (st[k]) { level.remove(st[k]); st[k] = null; }
    if (v.mixer) v.mixer.timeScale = s === 'frozen' || s === 'prison' ? 0 : 1;
    if (s === 'asleep') {
      if (v.mixer) { v.current = null; animate(v, 'Death_A', 0); v.mixer.update(3); }
      st.zz = sprite('zz'); st.zz.visible = true; st.zz.position.y = 1.2; v.obj.add(st.zz);
    } else if (s === 'frozen') {
      st.ice = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2, 1.3), new THREE.MeshStandardMaterial({ color: 0xcfefff, transparent: true, opacity: 0.55, roughness: 0.05, emissive: 0x3a8ac8, emissiveIntensity: 0.25, depthWrite: false }));
      st.ice.position.set(v.obj.position.x, 1, v.obj.position.z);
      level.add(st.ice);
    } else if (s === 'prison') { // shut in a dark crystal (the quest's own crystal takes over when it is the target)
      st.prison = new THREE.Mesh(new THREE.OctahedronGeometry(1.25, 0), new THREE.MeshStandardMaterial({ color: 0x1a1028, emissive: 0x4a2a8a, emissiveIntensity: 0.6, transparent: true, opacity: 0.78, roughness: 0.1, flatShading: true }));
      st.prison.scale.y = 1.4; st.prison.position.set(v.obj.position.x, 1.4, v.obj.position.z);
      level.add(st.prison);
    } else if (s === 'awake' && v.mixer && was) {
      v.current = null; animate(v, 'Cheer', 0.2);
      setTimeout(() => { if (st?.people.get('queen') === v) animate(v, 'Idle', 0.3); }, 2200);
      fx.burst('big', v.obj.position.x, 1.2, v.obj.position.z, 0xffe27a);
    } else if (s === 'awake' && v.mixer) { v.current = null; animate(v, 'Idle', 0); }
  }
  function syncShots(g, dt) {
    while (st.shots.length < g.shots.length) {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.24, 2, 6), new THREE.MeshStandardMaterial({ color: 0xf2ead8, emissive: 0x8a7a60, emissiveIntensity: 0.6 }));
      level.add(m); st.shots.push(m);
    }
    st.shots.forEach((m, i) => {
      const s = g.shots[i];
      m.visible = !!s;
      if (!s) return;
      m.position.set(s.x, 0.8, s.z);
      m.rotation.z += dt * 14; m.rotation.y = Math.atan2(s.vx, s.vz);
    });
  }
  function syncRocks(dt) {
    for (let i = st.rocks.length - 1; i >= 0; i--) {
      const r = st.rocks[i];
      r.t -= dt;
      const k = 1 - Math.max(0, r.t) / r.total;
      r.shadow.material.opacity = 0.25 + 0.4 * k;
      r.shadow.scale.setScalar(0.4 + 0.6 * k);
      if (r.rock) {
        r.rock.visible = r.t < 0.45;
        r.rock.position.y = r.t > 0 ? Math.max(0, (r.t / 0.45) * 9) : -Math.min(1.4, -r.t * 1.2);
      }
      if (r.t < -1.2) { level.remove(r.shadow); if (r.rock) level.remove(r.rock); st.rocks.splice(i, 1); }
    }
  }
  function syncMarks(dt) {
    for (let i = st.marks.length - 1; i >= 0; i--) {
      const m = st.marks[i];
      m.t += dt;
      const k = Math.min(1, m.t / m.life);
      if (m.grow) m.obj.scale.setScalar(m.from + (m.to - m.from) * k);
      m.obj.material.opacity = m.alpha * (1 - (m.fade ? k : 0)) * (m.pulse ? 0.6 + 0.4 * Math.sin(m.t * 20) : 1);
      if (m.follow) { m.obj.position.x = m.follow.x; m.obj.position.z = m.follow.z; if (m.turn) m.obj.rotation.z = -m.follow.facing; }
      if (m.t >= m.life) { level.remove(m.obj); st.marks.splice(i, 1); }
    }
  }
  const ringGeo = new THREE.RingGeometry(0.85, 1, 48), discGeo = new THREE.CircleGeometry(1, 32);
  function mark(x, z, { r = 1, color = 0xff4d4d, life = 1, alpha = 0.7, grow = false, from = 0.2, ring = true, fade = true, pulse = false, follow = null } = {}) {
    const m = new THREE.Mesh(ring ? ringGeo : discGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.06, z); m.scale.setScalar(grow ? from * r : r);
    level.add(m);
    st.marks.push({ obj: m, t: 0, life, alpha, grow, from: from * r, to: r, fade, pulse, follow });
    return m;
  }
  function arrow(e, len = 6) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, len), new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.45, depthWrite: false }));
    m.geometry.translate(0, len / 2, 0);
    m.rotation.x = -Math.PI / 2; m.position.set(e.x, 0.07, e.z); m.rotation.z = -e.facing + Math.PI;
    level.add(m);
    st.marks.push({ obj: m, t: 0, life: 0.75, alpha: 0.5, fade: false, pulse: true, follow: e, turn: true });
  }
  function syncLights(g, hero) {
    if (!area.dark) return;
    const p = g.projectile;
    st.weaponLight.intensity = g.glow && p.state !== 'held' ? 26 : 0;
    st.weaponLight.position.set(p.x, 0.9, p.z);
    const lit = [...st.targetViews.filter((v) => v.lit).map((v) => ({ x: v.t.x, z: v.t.z, c: 0xb090ff })), { x: g.campfire.x, z: g.campfire.z, c: 0xffa860 },
      ...(area.crystals || []).map(([x, z, c]) => ({ x, z, c: new THREE.Color(c).getHex(), soft: true }))];
    lit.sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z));
    st.lights.forEach((l, i) => {
      const s = lit[i];
      l.intensity = s ? (s.soft ? 10 : 24) : 0;
      if (s) { l.color.setHex(s.c); l.position.set(s.x, 1.6, s.z); }
    });
  }

  function sync(g, dt, camera) {
    if (!st) return;
    for (const s of g.villagers) {
      const v = st.people.get(s.id);
      if (!v) continue;
      v.mark.visible = s.quest && !(s.isQueen && ['hidden', 'frozen', 'asleep'].includes(g.queenState));
      v.mark.position.y = (v.prop ? 1.9 : 1.85) + Math.sin(g.time * 3) * 0.06;
      if (!s.fixed || v.prop) { v.face += angleTo(v.face, s.look ?? s.facing) * (1 - Math.exp(-6 * dt)); v.obj.rotation.y = v.face; }
      if (v.prop) v.obj.position.y = Math.abs(Math.sin(g.time * 2 + v.bob)) * 0.05;
    }
    syncQueen(g);
    syncTargets(g, dt);
    if (st.prison) st.prison.visible = !st.targetViews.some((v) => v.style === 'prison');
    syncItems(g, dt);
    syncObject(g);
    syncShots(g, dt);
    syncRocks(dt);
    syncMarks(dt);
    syncLights(g, g.hero);
    for (const s of st.spinners) s.rotation.y += dt * 0.8;
    for (const b of st.billboards) { b.quaternion.copy(camera.quaternion); }
    for (const d of st.swirls) d.rotation.z += dt * 2.2;
    if (st.foam) {
      const w = g.areas.find((a) => a.kind === 'push' && a.look === 'wave');
      const s = w && gust(w, g.time);
      if (s?.active) {
        const ph = ((((g.time + (w.phase || 0)) % w.period) + w.period) % w.period - (w.period - w.on)) / w.on;
        st.foam.position.x = w.x + w.w / 2 - ph * w.w;
        st.foam.material.opacity = 0.55 * Math.sin(Math.PI * ph);
      } else st.foam.material.opacity = 0;
    }
    fx.moveWeather(g.hero.x, g.hero.z);
  }

  function effect(ev, g) {
    if (!st) return;
    const t = ev.type;
    if (t === 'rockWarn') {
      const r = { t: ev.t, total: ev.t, shadow: mark(ev.x, ev.z, { r: ev.r, color: 0x1a1410, life: 99, alpha: 0.35, ring: false, fade: false }), rock: null };
      st.marks.pop(); // the rock owns its shadow
      instance('hex', 'rock_single_A', { height: 1.2, center: true }).then(({ obj }) => { r.rock = obj; obj.position.set(ev.x, 9, ev.z); obj.visible = false; level.add(obj); });
      st.rocks.push(r);
    } else if (t === 'rock') { fx.burst('dust', ev.x, 0.1, ev.z, 0x8a7a68); fx.burst('dust', ev.x, 0.1, ev.z, 0x8a7a68); kick(0.25); }
    else if (t === 'bossMove') {
      const e = g.enemies.find((x) => x.id === ev.id);
      if (!e) return;
      if (ev.kind === 'charge') arrow(e);
      else if (ev.kind === 'slam') mark(e.x, e.z, { r: ev.r, life: 1, grow: true, alpha: 0.75, pulse: true });
      else if (ev.kind === 'summon') fx.burst('ring', e.x, 0.3, e.z, 0x8a5aff);
      else if (ev.kind === 'volley') fx.burst('spark', e.x, 1.2, e.z, 0xffffff);
    } else if (t === 'slam') { mark(ev.x, ev.z, { r: ev.r, life: 0.45, grow: true, from: 0.5, color: 0xffe0b0, alpha: 0.9 }); fx.burst('dust', ev.x, 0.1, ev.z, 0x8a7a68); kick(0.55); }
    else if (t === 'blinkWarn') mark(ev.x, ev.z, { r: 0.8, color: 0xb56cff, life: 0.5, alpha: 0.8, pulse: true });
    else if (t === 'blink') fx.burst('ring', ev.x, 0.9, ev.z, 0xb56cff);
    else if (t === 'burrow' || t === 'emerge') fx.burst('dust', ev.x, 0.1, ev.z, 0xc8a060);
    else if (t === 'portal') { fx.burst('ring', ev.fx, 1, ev.fz, 0xd08bff); fx.burst('ring', ev.x, 1, ev.z, 0xd08bff); }
    else if (t === 'targetHurt') { const v = st.targetViews.find((x) => x.t.id === ev.id); if (v) v.shakeT = 0.3; fx.burst('spark', ev.x, 1, ev.z, ev.style === 'prison' ? 0xb07bff : 0xd8c8b0); }
    else if (t === 'target') {
      const c = { brazier: 0xff9a3a, lantern: 0xffd27a, obelisk: 0xffb42e, rift: 0xd08bff, boulder: 0x9a8a78, prison: 0xb07bff }[ev.style] || 0xffd34d;
      fx.burst(ev.style === 'boulder' || ev.style === 'prison' ? 'big' : 'hit', ev.x, 1, ev.z, c);
    } else if (t === 'item') fx.burst('ring', ev.x, 0.8, ev.z, 0xffe27a);
    else if (t === 'needLight') fx.burst('spark', ev.x, 1.2, ev.z, 0x8a8aa8);
    else if (t === 'objectHit') fx.burst('spark', ev.x, 0.8, ev.z, 0xffa040);
    else if (t === 'dash') fx.burst('ring', ev.x, 0.6, ev.z, 0xffe27a);
  }

  // Real-time animation (also in menus): people breathe, crystals turn.
  function update(dt) {
    if (!st) return;
    for (const v of st.people.values()) v.mixer?.update(dt);
  }

  function clear() { st = null; area = null; }
  return { build, sync, effect, update, clear, crown, saved: () => (area ? zoneSaved(area, story) : false) };
}
