import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Auto-discover every experiment folder with an index.html
// so you never have to edit this file when adding new ones.
const experimentsDir = resolve(__dirname, 'experiments');
const experimentInputs = {};

if (existsSync(experimentsDir)) {
  for (const name of readdirSync(experimentsDir)) {
    const htmlPath = resolve(experimentsDir, name, 'index.html');
    if (existsSync(htmlPath)) {
      experimentInputs[`experiment_${name}`] = htmlPath;
    }
  }
}

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...experimentInputs,
      },
    },
    outDir: 'dist',
  },
  server: {
    port: 5173,
    open: true,
  },
});
