// On-device frame analysis: exposure, sharpness, subject position vs rule of thirds.
// Pure functions over RGBA pixel data so they can be unit-tested in Node.

export const THIRDS = [
  { x: 1 / 3, y: 1 / 3 }, { x: 2 / 3, y: 1 / 3 },
  { x: 1 / 3, y: 2 / 3 }, { x: 2 / 3, y: 2 / 3 },
];

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function analyzeFrame(data, w, h) {
  const luma = new Float32Array(w * h);
  let sum = 0, mr = 0, mg = 0, mb = 0;
  for (let i = 0, p = 0; p < w * h; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    luma[p] = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += luma[p]; mr += r; mg += g; mb += b;
  }
  const n = w * h;
  const meanLuma = sum / n / 255;
  mr /= n; mg /= n; mb /= n;

  // Sharpness: variance of the Laplacian on luma.
  let lm = 0, lv = 0, cnt = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    const l = 4 * luma[p] - luma[p - 1] - luma[p + 1] - luma[p - w] - luma[p + w];
    lm += l; lv += l * l; cnt++;
  }
  const sharpness = lv / cnt - (lm / cnt) ** 2;

  // Saliency on an 8x8 grid: colour/brightness distance from the frame mean.
  const G = 8, sal = new Float32Array(G * G);
  let total = 0, cx = 0, cy = 0;
  for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
    let r = 0, g = 0, b = 0, c = 0;
    const x0 = Math.floor(gx * w / G), x1 = Math.floor((gx + 1) * w / G);
    const y0 = Math.floor(gy * h / G), y1 = Math.floor((gy + 1) * h / G);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; c++;
    }
    const d = Math.hypot(r / c - mr, g / c - mg, b / c - mb) / 441;
    const s = d * d;
    sal[gy * G + gx] = s; total += s;
    cx += s * (gx + 0.5) / G; cy += s * (gy + 0.5) / G;
  }
  const hasSubject = total > 0.02;
  return {
    meanLuma, sharpness,
    hasSubject,
    subject: hasSubject ? { x: cx / total, y: cy / total } : { x: 0.5, y: 0.5 },
  };
}

export function nearestThird(pt) {
  let best = THIRDS[0], bd = Infinity;
  for (const t of THIRDS) {
    const d = Math.hypot(t.x - pt.x, t.y - pt.y);
    if (d < bd) { bd = d; best = t; }
  }
  return { point: best, dist: bd };
}

// roll: device tilt in degrees (null when unavailable)
export function scoreFrame(a, roll = null) {
  const exposure = 1 - clamp(Math.abs(a.meanLuma - 0.45) / 0.4);
  const sharp = clamp((a.sharpness - 15) / 85);
  const { point, dist } = nearestThird(a.subject);
  const comp = a.hasSubject ? 1 - clamp(dist / 0.35) : 0.5;
  const level = roll == null ? 1 : 1 - clamp(Math.abs(roll) / 10);
  const score = Math.round(100 * (0.3 * exposure + 0.25 * sharp + 0.35 * comp + 0.1 * level));
  return { score, exposure, sharp, comp, level, target: point };
}

// One most important hint, by priority.
export function pickHint(a, s, roll = null) {
  if (a.meanLuma < 0.2) return { id: 'dark', text: 'Слишком темно — найдите свет' };
  if (a.meanLuma > 0.85) return { id: 'bright', text: 'Пересвет — уйдите от яркого света' };
  if (s.sharp < 0.15) return { id: 'blur', text: 'Нерезко — держите телефон ровно' };
  if (roll != null && Math.abs(roll) > 4) {
    return { id: 'tilt', text: roll > 0 ? 'Горизонт завален — наклоните влево' : 'Горизонт завален — наклоните вправо' };
  }
  if (a.hasSubject && s.comp < 0.6) {
    const dx = a.subject.x - s.target.x, dy = a.subject.y - s.target.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { id: 'pan', text: dx > 0 ? 'Сдвиньте кадр вправо' : 'Сдвиньте кадр влево' };
    }
    return { id: 'tiltcam', text: dy > 0 ? 'Наклоните камеру вниз' : 'Наклоните камеру вверх' };
  }
  if (s.score >= 75) return { id: 'good', text: 'Отличный кадр — снимайте!' };
  return { id: 'ok', text: 'Ищите ракурс интереснее' };
}
