import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Keep web deep links rooted at / while using relative assets inside Capacitor.
  base: process.env.CAPACITOR_BUILD === '1' ? './' : '/',
  plugins: [react(), tailwindcss()],
  build: { cssCodeSplit: false },
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } } },
});
