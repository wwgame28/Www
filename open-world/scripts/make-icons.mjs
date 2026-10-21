// Рендерит PNG-иконки из public/favicon.svg через Playwright (Chromium).
// Запуск: node scripts/make-icons.mjs  (нужен пакет playwright — локально или глобально через NODE_PATH)
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:#0d1626"><div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body></html>`,
  );
  const png = await page.screenshot({ omitBackground: false });
  await writeFile(new URL(`../public/icon-${size}.png`, import.meta.url), png);
  console.log(`icon-${size}.png`);
}
await browser.close();
