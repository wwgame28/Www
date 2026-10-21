// Обложка для соцсетей (1200×630) из самой игры: живописная точка мира + название.
// Запуск: сначала `npm run build && npx vite preview --port 4173`, затем
//   node scripts/make-cover.mjs http://127.0.0.1:4173/ [сид]
// Нужен пакет playwright (локально или глобально через NODE_PATH). Результат: public/og-cover.png
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] || 'http://127.0.0.1:4173/';
const seed = process.argv[3] || '482913';

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(url);
await page.waitForFunction(() => window.__game && window.__game.state === 'menu');
await page.fill('#seed-input', seed);
await page.click('#btn-play');
await page.waitForFunction(() => window.__game.state === 'play', null, { timeout: 120000 });

// Точка обзора: суша у берега, в кадре и море, и горы
const view = await page.evaluate(() => {
  const t = window.__game.world.terrain;
  let best = null;
  for (let r = 100; r < 2500; r += 50) {
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = t.height(x, z);
      if (h < 4 || h > 30) continue;
      for (let k = 0; k < 12; k++) {
        const yaw = (k / 12) * Math.PI * 2;
        let sea = 0;
        let peak = 0;
        let near = 0;
        for (let d = 60; d <= 700; d += 40) {
          for (const off of [-0.35, 0, 0.35]) {
            const hx = t.height(x - Math.sin(yaw + off) * d, z - Math.cos(yaw + off) * d);
            if (hx < -2) sea++;
            if (hx > 70) peak = Math.max(peak, hx);
            if (d < 200 && hx > 0) near++;
          }
        }
        const score = Math.min(sea, 18) + Math.min(peak, 160) / 8 + Math.min(near, 8);
        if (!best || score > best.score) best = { x, z, h, yaw, score };
      }
    }
  }
  return best;
});

await page.evaluate((v) => {
  const g = window.__game;
  g.player.flying = true;
  g.player.place(v.x, v.z, v.h + 34, v.yaw, -0.2);
  g.world.time = 0.71;
  document.getElementById('hud').hidden = true;
  document.getElementById('debug').hidden = true;
}, view);

// дождаться, пока догрузятся чанки вокруг
for (let i = 0; i < 120; i++) {
  const busy = await page.evaluate(() => {
    const s = window.__game.world.chunks.collectStats();
    return s.queued + s.inFlight;
  });
  if (!busy) break;
  await page.waitForTimeout(500);
}
await page.evaluate(() => {
  window.__game.world.time = 0.71;
  const el = document.createElement('div');
  el.innerHTML = `<div style="position:fixed;left:64px;bottom:60px;color:#f3f6fb;font-family:Unbounded,Manrope,sans-serif;text-shadow:0 4px 24px rgba(4,10,22,.55)">
    <div style="font-size:84px;font-weight:700;line-height:.95;text-transform:uppercase;letter-spacing:-.01em">Открытый<br><span style="color:#ffc861">мир</span></div>
    <div style="margin-top:18px;font:800 26px Manrope,sans-serif;color:#f3f6fb;opacity:.92">бесконечный генеративный ландшафт</div></div>`;
  document.body.appendChild(el);
});
await page.waitForTimeout(2500);
const png = await page.screenshot();
await writeFile(new URL('../public/og-cover.png', import.meta.url), png);
console.log('cover saved, view', JSON.stringify(view));
await browser.close();
