import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, copyFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The browser-only modules (render, ui, main…) aren't imported by other tests; at least make sure
// every source file parses, so a broken edit can't ship a blank page.
test('every source module parses', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ricochet-syntax-'));
  for (const root of ['src', 'horror']) {
    const src = new URL(`../${root}/`, import.meta.url);
    for (const f of readdirSync(src, { recursive: true }).filter((x) => x.endsWith('.js'))) {
      const copy = join(dir, `${root}_${f.replaceAll('/', '_').replace(/\.js$/, '.mjs')}`);
      copyFileSync(new URL(f, src), copy);
      const r = spawnSync(process.execPath, ['--check', copy], { encoding: 'utf8' });
      assert.equal(r.status, 0, `${root}/${f}: ${r.stderr.split('\n').slice(0, 5).join('\n')}`);
    }
  }
});
