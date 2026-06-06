import { defineConfig } from "vitest/config";

// Tests are pure TS (no DOM/plugins needed) -> kept separate from vite.config.ts
// to avoid Vite plugin type clashes between vite and vitest's bundled vite.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
