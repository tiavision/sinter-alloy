// A throwaway app that uses the package as an app does: installed in node_modules (a link to this folder, and to the
// sinter and temper beside it), named in `sinter({ libraries })`, its pages the fixture pages (with `head` added to
// each), its helpers and types modules theirs, and temper's styles and icons through a module every page loads.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const PKG = resolve(import.meta.dirname, '..');
const linked = (name: string) => realpathSync(join(PKG, 'node_modules', name));

export function app(head = ''): { root: string; remove: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'sinter-alloy-app-'));
  const files: Record<string, string> = {
    'src/styles.ts': "import '@tiaforge-ui/temper/all.css';\nimport 'virtual:temper-icons.css';\nimport '../fixtures.css';\n",
  };
  for (const f of readdirSync(join(PKG, 'fixtures'))) {
    const s = readFileSync(join(PKG, 'fixtures', f), 'utf8');
    files[f.endsWith('.ts') ? `src/${f}` : f] = f.endsWith('.html')
      ? s.replace('<meta charset="utf-8">', `<meta charset="utf-8">${head}<script type="module" src="/src/styles.ts"></script>`)
      : s;
  }
  for (const [f, s] of Object.entries(files)) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    writeFileSync(join(root, f), s);
  }
  mkdirSync(join(root, 'node_modules/@tiaforge-ui'), { recursive: true });
  mkdirSync(join(root, 'node_modules/@tiavision'), { recursive: true });
  symlinkSync(PKG, join(root, 'node_modules/@tiavision/sinter-alloy'), 'dir');
  for (const n of ['@tiaforge-ui/sinter', '@tiaforge-ui/temper', 'lucide-static']) symlinkSync(linked(n), join(root, 'node_modules', n), 'dir');
  return { root, remove: () => rmSync(root, { recursive: true, force: true }) };
}
