import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import manifest from './manifest.json' assert { type: 'json' };

export default defineConfig({
  plugins: [react(), crx({ manifest: manifest as any })],
});
