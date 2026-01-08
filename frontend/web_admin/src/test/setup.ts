import "@testing-library/jest-dom/vitest";

// Tests in this repo focus on non-UI logic (auth + stores).
// JSDOM provides `localStorage` for deterministic authStore tests.
