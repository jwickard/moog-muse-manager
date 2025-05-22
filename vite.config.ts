import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: false,
    assetsDir: 'assets'
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'process.env.DEBUG': JSON.stringify(process.env.DEBUG),
  },
  css: {
    postcss: './postcss.config.js', // Explicitly point to PostCSS config
  },
}); 