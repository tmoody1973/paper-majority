import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'jsdom',
    // Node 26 defines a disabled `localStorage` global that shadows the one jsdom
    // installs, so browser-storage assertions fail. Turn Node's copy off in the
    // worker and let jsdom own the Web Storage API.
    pool: 'forks',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['./src/test/setup.ts'],
    // Playwright owns everything under e2e/; Vitest must not try to run those specs.
    exclude: ['**/node_modules/**', '**/.next/**', 'e2e/**'],
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
});
