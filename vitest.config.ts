import { defineConfig, configDefaults } from "vitest/config";

// Unit tests are pure TS (no DOM/plugins needed) -> kept separate from
// vite.config.ts to avoid Vite plugin type clashes.
// Integration tests (*.integration.test.ts) hit a real Supabase project and are
// excluded here; run them with `npm run test:integration`.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: [...configDefaults.exclude, "**/*.integration.test.ts"],
  },
});
