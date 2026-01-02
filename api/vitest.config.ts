import { defineConfig } from "vitest/config";

// CI-friendly: Node environment, deterministic, no network/env dependencies.
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/__tests__/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
});
