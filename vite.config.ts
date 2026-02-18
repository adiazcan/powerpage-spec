/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Power Pages site URL for local dev proxy — set VITE_PP_SITE_URL in .env.local
const PP_SITE_URL =
  process.env['VITE_PP_SITE_URL'] ?? 'https://placeholder.powerappsportals.com';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        // Power Pages code-site serves web files at root, not under /assets/
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/_api': {
        target: PP_SITE_URL,
        changeOrigin: true,
        secure: true,
      },
      '/_layout': {
        target: PP_SITE_URL,
        changeOrigin: true,
        secure: true,
      },
      '/Account': {
        target: PP_SITE_URL,
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
