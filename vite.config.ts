import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Served at the root of the custom domain funda360.aurisnexus.co.za
  // (GitHub Pages, CNAME in public/), so the default base "/" is correct.
  // `DEPLOY_BASE` is still honoured for a hypothetical future sub-path
  // deploy, but nothing sets it.
  base: process.env.DEPLOY_BASE || '/',
  plugins: [react(), tsconfigPaths()],
  server: {
    port: 5173,
  },
});
