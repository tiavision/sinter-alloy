// The preview page (preview/index.html): every component live over the page's state. `npm run preview:build`
// writes preview/dist with relative URLs, so it can be served from any path.
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import sinter from '@tiaforge-ui/sinter/vite';
import temper from '@tiaforge-ui/temper/vite';

const root = import.meta.dirname;

export default defineConfig({
  root,
  base: './',
  plugins: [
    sinter({ libraries: ['@tiavision/sinter-alloy'], prefetch: false }),
    temper({ paths: [root, resolve(root, '../sinter/components')], icons: { lucide: true } }),
  ],
  build: { outDir: resolve(root, 'dist'), emptyOutDir: true },
});
