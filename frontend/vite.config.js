import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages project site — absolute base so assets load with or without trailing slash
export default defineConfig({
  plugins: [react()],
  base: '/dtube-local-video/',
});
