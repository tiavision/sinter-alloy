// The library's own check (sinter's docs/libraries.md, "Checking a library"): `sinter check --strict` in this
// folder compiles and type-checks the fixture pages in fixtures/, which use the public components with the cases
// the library supports (a resource with an optimistic reorder, items from state with another language's words).
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

const PKG = resolve(import.meta.dirname, '..');

test('the fixture pages check with no error and no warning', () => {
  const r = spawnSync(process.execPath, [join(PKG, 'node_modules/@tiaforge-ui/sinter/dist/cli.js'), 'check', '--strict'], { cwd: PKG, encoding: 'utf8' });
  const out = r.stdout + r.stderr;
  expect(out.split('\n').filter((l) => / (error|warning) SN\d+/.test(l))).toEqual([]);
  expect(out).toMatch(/sinter check --strict: 10 page\(s\), 0 error\(s\), 0 warning\(s\)/);
  expect(r.status).toBe(0);
}, 300_000);
