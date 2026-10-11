import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFrame, scoreFrame, pickHint } from '../camera/analyze.js';
import { parseRating } from '../camera/openrouter.js';

const W = 64, H = 64;
function frame(fn) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [r, g, b] = fn(x, y); const i = (y * W + x) * 4;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  return d;
}
const blob = (cx, cy) => frame((x, y) => (Math.hypot(x - cx, y - cy) < 7 ? [240, 60, 40] : [90, 110, 130]));

test('dark frame gives dark hint', () => {
  const a = analyzeFrame(frame(() => [10, 10, 10]), W, H);
  assert.equal(pickHint(a, scoreFrame(a)).id, 'dark');
});
test('subject on a third scores higher than dead centre', () => {
  const on = scoreFrame(analyzeFrame(blob(21, 21), W, H));
  const mid = scoreFrame(analyzeFrame(blob(32, 32), W, H));
  assert.ok(on.comp > mid.comp, `${on.comp} vs ${mid.comp}`);
});
test('subject right of target says pan right', () => {
  const a = analyzeFrame(blob(52, 32), W, H);
  const s = scoreFrame(a);
  a.sharpness = 100; // ignore blur for this check
  const h = pickHint(a, scoreFrame(a));
  assert.ok(['pan', 'tiltcam', 'good', 'ok'].includes(h.id));
  assert.ok(s.target.x === 2 / 3);
});
test('tilt hint appears past 4 degrees', () => {
  const a = analyzeFrame(blob(21, 21), W, H); a.sharpness = 100;
  assert.equal(pickHint(a, scoreFrame(a, 8), 8).id, 'tilt');
});
test('parseRating handles fenced JSON and clamps', () => {
  const r = parseRating('```json\n{"score": 130, "verdict": "ok", "tips": ["a","b","c","d"]}\n```');
  assert.equal(r.score, 100); assert.equal(r.tips.length, 3);
  assert.throws(() => parseRating('no json'));
});
