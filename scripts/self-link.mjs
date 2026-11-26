// Links the package into its own node_modules (node_modules/@tiavision/sinter-alloy → ..), as an app that installs it
// has it: sinter serves a library component's script only for a configured library, `sinter({ libraries })`, which
// the tests and the preview build name. Run by the tests' global setup and by `npm run preview:build`.
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function selfLink() {
  const pkg = resolve(import.meta.dirname, '..');
  const link = join(pkg, 'node_modules/@tiavision/sinter-alloy');
  if (existsSync(link)) return;
  mkdirSync(join(pkg, 'node_modules/@tiavision'), { recursive: true });
  symlinkSync('../..', link, 'dir');
}

if (import.meta.url === `file://${process.argv[1]}`) selfLink();
