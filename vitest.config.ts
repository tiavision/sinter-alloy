import { defineConfig } from 'vitest/config';
import sinter from '@tiaforge-ui/sinter/vite';

// The package's tests run against the sinter installed beside it (a devDependency). The sinter plugin lets the
// render tests import a component's script (its base class comes from the component's .html), through
// the package's link to itself in node_modules (test/link.ts, run before the tests).
export default defineConfig({
  plugins: [sinter({ libraries: ['@tiavision/sinter-alloy'] })],
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/link.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 180_000,
    // the tests that build apps run one file at a time: each starts Vite
    fileParallelism: false,
    env: { SINTER_STRICT: '' },
  },
});
