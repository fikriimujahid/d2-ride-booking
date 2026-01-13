import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // S3 static hosting friendly: relative asset paths so the app can be hosted
  // from an S3 bucket root or a subfolder without rewriting.
  base: './',
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Single backend API (Fastify modular monolith)
      // With VITE_API_BASE_URL="/api/v1", requests are proxied to the backend.
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true
      }
    },
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
})
