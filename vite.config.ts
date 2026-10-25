import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relatieve paden, zodat de site werkt op GitHub Pages (https://<naam>.github.io/games/).
  base: './',
  plugins: [react(), tailwindcss()],
  // KaTeX maakt de bundel groter dan 500 kB; dat is geen probleem voor deze site.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    environment: 'jsdom',
  },
});
