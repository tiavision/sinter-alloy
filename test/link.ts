// Vitest's global setup: links the package into its own node_modules (node_modules/@tiavision/sinter-alloy → ..), as an
// app that installs it has it. sinter serves a library component's script (and the base class it imports from the
// component's .html) only for a configured library, `sinter({ libraries: ['@tiavision/sinter-alloy'] })` in
// vitest.config.ts, so the render tests import the script through this link.
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

export default function setup() {
  const pkg = resolve(import.meta.dirname, '..');
  const link = join(pkg, 'node_modules/@tiavision/sinter-alloy');
  if (existsSync(link)) return;
  mkdirSync(join(pkg, 'node_modules/@tiavision'), { recursive: true });
  symlinkSync('../..', link, 'dir');
}
