import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: { input: ['index.html', 'curator/index.html'] }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  }
});
