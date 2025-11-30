import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';

// Plugin to generate and inject manifest into service worker
function injectServiceWorkerManifest() {
  return {
    name: 'inject-service-worker-manifest',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      const swSrc = resolve(__dirname, 'public/service-worker.js');
      const swDest = resolve(distDir, 'service-worker.js');

      if (!existsSync(swSrc)) {
        console.error('✗ service-worker.js not found');
        return;
      }

      // Read all files in dist to find hashed filenames
      const files = readdirSync(distDir);

      // Find the hashed CSS and JS files
      const cssFile = files.find(f => f.startsWith('styles.') && f.endsWith('.css'));
      const mainJsFile = files.find(f => f.startsWith('main.') && f.endsWith('.js'));
      const hlsJsFile = files.find(f => f.startsWith('hls.') && f.endsWith('.js'));

      // Build the precache assets array with actual filenames
      const precacheAssets = [
        '/',
        '/index.html',
        cssFile ? `/${cssFile}` : null,
        mainJsFile ? `/${mainJsFile}` : null,
        hlsJsFile ? `/${hlsJsFile}` : null,
        '/favicon.svg',
        '/RadioCalicoLogoTM.png',
        '/RadioCalicoLogoTM.webp',
      ].filter(Boolean); // Remove null entries

      // Read service worker source
      let swContent = readFileSync(swSrc, 'utf-8');

      // Replace the hardcoded PRECACHE_ASSETS with the actual manifest
      const assetsJson = JSON.stringify(precacheAssets, null, 2).replace(/\n/g, '\n  ');
      swContent = swContent.replace(
        /const PRECACHE_ASSETS = \[[\s\S]*?\];/,
        `const PRECACHE_ASSETS = ${assetsJson};`
      );

      // Remove console.log statements for production
      swContent = swContent.replace(/\s*console\.(log|error|warn|info)\([^)]*\);?\n?/g, '');

      // Write the modified service worker to dist
      writeFileSync(swDest, swContent);
      console.log('✓ Generated service-worker.js with manifest:', precacheAssets);
    }
  };
}

export default defineConfig({
  root: 'public',
  base: './',
  plugins: [injectServiceWorkerManifest()],
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
