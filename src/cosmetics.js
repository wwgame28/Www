// Shop cosmetics: the recipes that build each look (the catalog, prices and rules are in shop.js).
// Hero skins and weapon skins re-style cloned KayKit materials (MeshStandardMaterial + atlas map)
// through one shared shader patch (desaturate the atlas, fresnel rim, luminance glow, rim alpha);
// trails are particle presets for fx.js.
import * as THREE from 'three';

// rim / glow are [hex, strength]; env is envMapIntensity (0 = no env map).
export const SKINS = {
  'skin-gold': { desat: 1, lift: 0.3, color: 0xffc43d, metalness: 0.9, roughness: 0.28, env: 1.25, emissive: 0x2e1a00, rim: [0xffe08a, 0.45], rimPow: 3 },
  'skin-ice': { desat: 0.92, lift: 0.25, color: 0x7fd6ff, metalness: 0.1, roughness: 0.12, env: 0.9, emissive: 0x062a44, rim: [0xeafcff, 0.95], rimPow: 2.2 },
  'skin-shadow': { desat: 1, color: 0x221c30, metalness: 0, roughness: 0.85, env: 0, emissive: 0x040207, rim: [0x9a4dff, 0.85], rimPow: 3 },
  'skin-flame': { desat: 1, color: 0xff3a12, metalness: 0, roughness: 0.8, env: 0, emissive: 0x6a0c00, glow: [0xff5a10, 0.35], glowPow: 2, rim: [0xffb020, 1.4], rimPow: 2.2, aura: 'embers' },
  'skin-ghost': { desat: 1, lift: 0.4, color: 0xb6ffe4, metalness: 0, roughness: 1, env: 0, emissive: 0x15503f, rim: [0xc4fff0, 1.1], rimPow: 1.8, rimAlpha: 0.9, opacity: 0.42, shadow: false },
};

export const WEAPONS = {
  'weapon-gold': { mat: { desat: 1, lift: 0.3, color: 0xffc72e, metalness: 0.92, roughness: 0.24, env: 1.4, emissive: 0x3a2400, rim: [0xfff0b8, 0.6], rimPow: 3 }, accent: 0xffd34d, orb: { shape: 'sphere', color: 0xffd34d } },
  'weapon-ice': { mat: { desat: 1, lift: 0.3, color: 0x8fe3ff, metalness: 0.1, roughness: 0.08, env: 1.0, emissive: 0x1a6a9a, rim: [0xffffff, 1.0], rimPow: 2 }, accent: 0xbfefff, orb: { shape: 'ico', color: 0xbfefff } },
  'weapon-neon': { mat: { desat: 1, color: 0x14101e, metalness: 0, roughness: 0.4, env: 0, glow: [0xff2bd6, 2.4], glowPow: 1, rim: [0x33f0ff, 1.3], rimPow: 2.5 }, hull: 0xff2bd6, accent: 0xff3bd4, orb: { shape: 'ring', color: 0xff3bd4, ring: 0x33f0ff } },
  'weapon-crystal': { mat: { desat: 1, lift: 0.35, color: 0xa66bff, metalness: 0, roughness: 0.05, env: 2.0, emissive: 0x4a148f, rim: [0xffd6ff, 1.1], rimPow: 1.6, rimAlpha: 0.7, opacity: 0.65, flat: true }, accent: 0xc08cff, orb: { shape: 'gem', color: 0xd2a6ff } },
  'weapon-lava': { mat: { desat: 1, color: 0x2a1108, metalness: 0, roughness: 0.95, env: 0, emissive: 0x5a0a00, glow: [0xff7a10, 2.6], glowPow: 3, rim: [0xffb02a, 0.7], rimPow: 2.5 }, accent: 0xff4a1a, orb: { shape: 'lava', color: 0xff4a14 } },
};

const hexCol = (h) => new THREE.Color(h);

// ---------- procedural studio environment for metals and gloss (made once) ----------
let env = null;
export function studioEnv() {
  if (env) return env;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, '#fffaf0'); v.addColorStop(0.3, '#c9d3e2'); v.addColorStop(0.48, '#7d8796');
  v.addColorStop(0.52, '#4a4038'); v.addColorStop(0.75, '#2a231d'); v.addColorStop(1, '#120f0c');
  g.fillStyle = v; g.fillRect(0, 0, 256, 128);
  // two soft "softboxes" so metal sparkles as the hero turns
  for (const [x, y, r] of [[60, 34, 26], [190, 42, 18]]) {
    const s = g.createRadialGradient(x, y, 0, x, y, r);
    s.addColorStop(0, 'rgba(255,255,255,1)'); s.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = s; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  env = new THREE.CanvasTexture(c);
  env.mapping = THREE.EquirectangularReflectionMapping;
  env.colorSpace = THREE.SRGBColorSpace;
  return env;
}

// ---------- the shared shader patch ----------
const KEY = 'ricochet-look-v1';
function patch(mat, r) {
  const rim = r.rim ? hexCol(r.rim[0]).multiplyScalar(r.rim[1]) : new THREE.Color(0);
  const glow = r.glow ? hexCol(r.glow[0]).multiplyScalar(r.glow[1]) : new THREE.Color(0);
  const u = mat.userData.look = {
    uDesat: { value: r.desat ?? 0 }, uLift: { value: r.lift ?? 0 }, uRim: { value: rim }, uRimPow: { value: r.rimPow ?? 3 },
    uRimAlpha: { value: r.rimAlpha ?? 0 }, uGlow: { value: glow }, uGlowPow: { value: r.glowPow ?? 1 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDesat, uLift, uRimPow, uRimAlpha, uGlowPow;\nuniform vec3 uRim, uGlow;')
      .replace('#include <map_fragment>', `float lookLum = 1.0;
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  lookLum = dot( sampledDiffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, vec3( mix( uLift, 1.0, lookLum ) ), uDesat );
  diffuseColor *= sampledDiffuseColor;
#endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  float lookRim = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), uRimPow );
  totalEmissiveRadiance += uRim * lookRim + uGlow * pow( lookLum, uGlowPow );
  diffuseColor.a = mix( diffuseColor.a, 1.0, lookRim * uRimAlpha );`);
  };
  mat.customProgramCacheKey = () => KEY;
}

// A restyled copy of a KayKit material (the original stays shared and untouched).
export function lookMaterial(base, r) {
  const m = base.clone();
  m.color.setHex(r.color);
  m.metalness = r.metalness ?? 0;
  m.roughness = r.roughness ?? 0.5;
  m.emissive.setHex(r.emissive ?? 0);
  m.emissiveIntensity = 1;
  if (r.env) { m.envMap = studioEnv(); m.envMapIntensity = r.env; }
  if (r.opacity !== undefined && r.opacity < 1) { m.transparent = true; m.opacity = r.opacity; m.depthWrite = true; }
  if (r.flat) m.flatShading = true;
  patch(m, r);
  return m;
}

// ---------- orb (and staff gem) per weapon skin ----------
export function orbMesh(w, radius) {
  const o = w?.orb;
  const c = new THREE.Color(o ? o.color : 0xffffff);
  if (!o || o.shape === 'sphere') return new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), new THREE.MeshBasicMaterial({ color: c.multiplyScalar(1.6) }));
  if (o.shape === 'ico') {
    return new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.08, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: c, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.1, envMap: studioEnv(), envMapIntensity: 1.2, flatShading: true }));
  }
  if (o.shape === 'gem') {
    const g = new THREE.OctahedronGeometry(radius * 1.15, 0);
    g.scale(0.8, 1.35, 0.8);
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.65, roughness: 0.05, metalness: 0, envMap: studioEnv(), envMapIntensity: 1.6, flatShading: true }));
  }
  if (o.shape === 'lava') {
    return new THREE.Mesh(new THREE.DodecahedronGeometry(radius * 1.05, 0), new THREE.MeshStandardMaterial({ color: 0x1c0703, emissive: c, emissiveIntensity: 1.25, roughness: 0.9, flatShading: true }));
  }
  if (o.shape === 'ring') {
    const core = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.8, 16, 12), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.6) }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.35, radius * 0.12, 6, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(o.ring).multiplyScalar(1.5) }));
    ring.rotation.x = Math.PI / 2.6;
    core.add(ring);
    return core;
  }
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), new THREE.MeshBasicMaterial({ color: c.multiplyScalar(1.6) }));
}

// Neon outline: an inverted hull around a prop mesh (back faces of a slightly bigger copy).
export function hullFor(mesh, color, t = 0.025) {
  mesh.geometry.computeBoundingBox();
  const s = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
  const ws = mesh.getWorldScale(new THREE.Vector3());
  const k = (a, w) => 1 + (2 * t) / Math.max(1e-3, a * Math.abs(w));
  const hull = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4), side: THREE.BackSide }));
  const c = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
  hull.scale.set(k(s.x, ws.x), k(s.y, ws.y), k(s.z, ws.z));
  hull.position.copy(c).multiply(new THREE.Vector3(1 - hull.scale.x, 1 - hull.scale.y, 1 - hull.scale.z));
  hull.castShadow = false;
  return hull;
}

// ---------- trails (particle presets for fx.setTrailStyle) ----------
// tile: 0 soft dot, 1 star, 2 snowflake, 3 smoke puff. blend: 'add' | 'norm'.
// color/alpha are gradients over the particle's life: [[hex|alpha, position 0..1], ...].
export const TRAILS = {
  default: { line: null, systems: [{ blend: 'add', tile: 0, rate: 70, life: [0.25, 0.4], speed: [0, 0.2], size: [0.22, 0.34], radius: 0.05, tint: true }] },
  'trail-fire': {
    line: 0xff7a1a,
    systems: [
      { blend: 'add', tile: 0, rate: 80, life: [0.25, 0.42], speed: [0.2, 0.6], size: [0.24, 0.38], radius: 0.08, up: 2.5,
        color: [[0xfff3b0, 0], [0xffa21a, 0.3], [0xff4a0a, 0.65], [0x801000, 1]], alpha: [[1, 0], [0.9, 0.5], [0, 1]] },
      { blend: 'norm', tile: 3, rate: 18, life: [0.5, 0.8], speed: [0.2, 0.5], size: [0.26, 0.42], radius: 0.1, up: 1.2, grow: true,
        color: [[0x4a3e36, 0], [0x2a2420, 1]], alpha: [[0, 0], [0.5, 0.25], [0, 1]] },
    ],
  },
  'trail-stars': {
    line: 0xffe9a0,
    systems: [
      { blend: 'add', tile: 1, rate: 26, life: [0.55, 0.85], speed: [0.3, 0.9], size: [0.2, 0.34], radius: 0.12, spin: 4, twinkle: true,
        color: [[0xffffff, 0], [0xffe27a, 0.5], [0xffc94a, 1]], alpha: [[1, 0], [0.35, 0.3], [1, 0.55], [0, 1]] },
      { blend: 'add', tile: 0, rate: 40, life: [0.2, 0.35], speed: [0, 0.3], size: [0.06, 0.12], radius: 0.06,
        color: [[0xfff6d0, 0], [0xfff6d0, 1]], alpha: [[1, 0], [0, 1]] },
    ],
  },
  'trail-snow': {
    line: 0xbfefff,
    systems: [
      { blend: 'norm', tile: 2, rate: 22, life: [0.7, 1.0], speed: [0.2, 0.5], size: [0.22, 0.34], radius: 0.1, gravity: 0.6, spin: 1.5,
        color: [[0xffffff, 0], [0xe6f7ff, 1]], alpha: [[1, 0], [1, 0.6], [0, 1]] },
      { blend: 'add', tile: 0, rate: 35, life: [0.25, 0.4], speed: [0, 0.2], size: [0.12, 0.2], radius: 0.05,
        color: [[0x9fdcff, 0], [0x5fb8ff, 1]], alpha: [[1, 0], [0, 1]] },
    ],
  },
  'trail-dark': {
    line: 0x2a1446,
    systems: [
      { blend: 'norm', tile: 3, rate: 30, life: [0.45, 0.7], speed: [0.1, 0.4], size: [0.3, 0.5], radius: 0.08, grow: true,
        color: [[0x1c1030, 0], [0x0a0612, 1]], alpha: [[0.9, 0], [0.6, 0.5], [0, 1]] },
      { blend: 'add', tile: 0, rate: 24, life: [0.3, 0.5], speed: [0.6, 1.6], size: [0.07, 0.13], radius: 0.1,
        color: [[0xd09bff, 0], [0x8a3dff, 1]], alpha: [[1, 0], [0, 1]] },
    ],
  },
  'trail-rainbow': {
    line: 'rainbow',
    systems: [
      { blend: 'norm', tile: 0, rate: 90, life: [0.5, 0.55], speed: [0, 0.1], size: [0.3, 0.36], radius: 0.03, flat: true,
        color: [[0xff3b3b, 0], [0xff9a1a, 0.17], [0xffe81a, 0.33], [0x3dff5a, 0.5], [0x2bd5ff, 0.67], [0x4a5bff, 0.83], [0xb33bff, 1]],
        alpha: [[1, 0], [1, 0.8], [0, 1]] },
      { blend: 'add', tile: 1, rate: 10, life: [0.4, 0.6], speed: [0.2, 0.5], size: [0.14, 0.22], radius: 0.1, spin: 3,
        color: [[0xffffff, 0], [0xffffff, 1]], alpha: [[1, 0], [0, 1]] },
    ],
  },
};
export const RAINBOW = [0xff3b3b, 0xff9a1a, 0xffe81a, 0x3dff5a, 0x2bd5ff, 0x4a5bff, 0xb33bff];
