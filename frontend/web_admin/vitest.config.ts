import path from "path";
import { defineConfig } from "vitest/config";

// Separate config keeps test settings CI-friendly without affecting Vite runtime.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
});
