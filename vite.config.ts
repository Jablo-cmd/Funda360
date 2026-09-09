import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // `/` for local dev, `vite preview` and the Playwright e2e server (which
  // all expect root paths); the GitHub Pages deploy job sets
  // DEPLOY_BASE=/Funda360/ so the built asset URLs resolve under the
  // project-site sub-path. A future custom-domain deploy just leaves
  // DEPLOY_BASE unset.
  base: process.env.DEPLOY_BASE || '/',
  plugins: [react(), tsconfigPaths()],
  server: {
    port: 5173,
  },
});
