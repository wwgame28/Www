// The hero from the creator: a render definition (the shape of heroes.js) and the outfit recolor.
import { HEROES } from '../heroes.js';
import { PALETTES, SKINS } from './data.js';

// Props baked into each KayKit model's hands.
const PROPS = {
  Barbarian: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'],
  Knight: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'],
  Mage: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'],
  Rogue: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'],
  Rogue_Hooded: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'],
};

// The base model throws the weapon of the arcade hero that carries it: same projectile, throw and
// color. It holds that hero's props only if its own kit has them; otherwise a small copy of the
// projectile rides in the hand.
export function heroDef(look) {
  const arcade = HEROES.find((h) => h.weapon === look.weapon) || HEROES[0];
  const own = PROPS[look.base] || [];
  const heldProp = own.includes(arcade.heldProp) ? arcade.heldProp : undefined;
  return {
    id: `story:${look.base}:${look.weapon}:${look.palette}:${look.skin}`, name: look.name, model: look.base, weapon: arcade.weapon,
    hold: arcade.hold.filter((p) => own.includes(p)), proj: arcade.proj, heldProp,
    handCopy: !arcade.proj.orb && (arcade.handCopy || !heldProp), color: arcade.color, shoot: arcade.shoot,
    recolor: { palette: PALETTES.find((p) => p.id === look.palette) || PALETTES[0], skin: SKINS.find((s) => s.id === look.skin) || SKINS[1] },
  };
}

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, Math.min(1, s), l];
}
function rgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
// Skin (peach), plain (metal, white, black), leather (wood, leather, hair) or cloth (the rest).
export function texelKind(h, s, l) {
  if (h >= 12 && h <= 34 && s >= 0.35 && s <= 0.9 && l >= 0.64 && l <= 0.93) return 'skin';
  if (s < 0.2 || l < 0.1 || l > 0.95) return 'plain';
  if (h >= 8 && h <= 48 && s < 0.62 && l < 0.62) return 'leather';
  return 'cloth';
}

// The clothes' main hue: the most common hue among cloth-colored texels the model really uses
// (sampled at its vertices' texture coordinates, which repeat; size: the texture's side in texels).
export function mainClothHue(a, size, uvs) {
  const bins = new Float64Array(36);
  const at = (u) => Math.min(size - 1, Math.floor((u - Math.floor(u)) * size));
  for (let i = 0; i < uvs.length; i += 2) {
    const x = at(uvs[i]), y = at(uvs[i + 1]);
    const k = (y * size + x) * 4, [h, s, l] = hsl(a[k], a[k + 1], a[k + 2]);
    if (texelKind(h, s, l) === 'cloth') bins[Math.floor(h / 10) % 36] += 1;
  }
  let top = 0;
  for (let i = 1; i < 36; i++) if (bins[i] > bins[top]) top = i;
  return bins[top] ? top * 10 + 5 : null;
}

// Recolor RGBA texels in place: skin gets the skin tone; cloth turns so that its main hue lands on
// the palette's hue (other cloth colors keep their distance to it). The main cloth color gets at
// least some saturation, so grayish robes still take the new color.
export function recolorPixels(a, palette, skin, main) {
  const turn = palette.hue === undefined || main === null ? null : palette.hue - main;
  const floor = 0.5 * (palette.sat ?? 1);
  for (let i = 0; i < a.length; i += 4) {
    let [h, s, l] = hsl(a[i], a[i + 1], a[i + 2]);
    const kind = texelKind(h, s, l);
    if (kind === 'skin' && skin.light !== 1) { l = Math.min(0.97, l * skin.light); s = Math.min(1, s * (skin.sat ?? 1)); }
    else if (kind === 'cloth' && turn !== null) {
      if (Math.abs(((h - main + 540) % 360) - 180) <= 35) s = Math.max(s, floor);
      h = (((h + turn) % 360) + 360) % 360;
      s = Math.min(1, s * (palette.sat ?? 1)); l = Math.min(0.97, l * (palette.light ?? 1));
    } else continue;
    [a[i], a[i + 1], a[i + 2]] = rgb(h, s, l);
  }
}
