import { defineConfig } from "vitest/config";

// Integration tests only. They talk to a real Supabase project, so they need
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the environment and are skipped
// otherwise. A single fork keeps trip setup/teardown isolated between files.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.integration.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
