import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Auth API (Fastify) - we keep this separate from the main API proxy
      // so other backend services can still live behind /api.
      // Example: /auth-api/admin/auth/login -> http://localhost:3000/admin/auth/login
      "/auth-api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/auth-api/, ""),
      },
      // Allow the dashboard to call the API without CORS hassles in dev.
      // With VITE_API_BASE_URL="/api/v1", requests are proxied to the backend.
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
})
