import { defineConfig } from 'vite';

// Relative base so the build works from any static host or subfolder.
// admin.html is the admin-only save recovery page (src/admin.ts).
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: { input: { main: 'index.html', admin: 'admin.html' } },
  },
});
