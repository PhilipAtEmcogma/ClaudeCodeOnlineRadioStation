import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

// Plugin to copy service worker to dist
function copyServiceWorker() {
  return {
    name: 'copy-service-worker',
    closeBundle() {
      const src = resolve(__dirname, 'public/service-worker.js');
      const dest = resolve(__dirname, 'dist/service-worker.js');
      if (existsSync(src)) {
        copyFileSync(src, dest);
        console.log('✓ Copied service-worker.js to dist/');
      }
    }
  };
}

export default defineConfig({
  root: 'public',
  base: './',
  plugins: [copyServiceWorker()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html'),
      },
      output: {
        assetFileNames: (assetInfo) => {
          // Keep simple filenames for easier debugging
          const name = assetInfo.name;
          if (name.endsWith('.css')) return 'styles.[hash].css';
          if (name.endsWith('.js')) return 'app.[hash].js';
          return '[name].[hash].[ext]';
        },
        chunkFileNames: '[name].[hash].js',
        entryFileNames: '[name].[hash].js',
        manualChunks: {
          // Split HLS.js into its own chunk for better caching
          hls: ['hls.js'],
        },
      },
    },
    cssMinify: true,
    assetsInlineLimit: 0, // Don't inline assets
  },
  server: {
    port: 5173,
    open: false,
  },
});
