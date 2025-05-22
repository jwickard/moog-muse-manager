import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    electron([
      {
        entry: 'src/main/main.ts',
        vite: {
          build: {
            outDir: '.vite/build',
            rollupOptions: {
              external: ['better-sqlite3'],
            },
          },
        },
      },
      {
        entry: 'src/preload/preload.ts',
        vite: {
          build: {
            outDir: '.vite/build',
            rollupOptions: {
              external: ['better-sqlite3'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}); 