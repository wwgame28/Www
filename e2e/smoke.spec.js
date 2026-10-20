import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('index.html loads', async ({ page }) => {
  await page.goto(pathToFileURL(resolve('index.html')).href);
  await expect(page).toHaveTitle('Рикошет');
});
