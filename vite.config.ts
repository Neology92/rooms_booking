import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/  (test config lives in vitest.config.ts)
// PWA: installable, app-like standalone, offline shell (the UI loads offline; live
// data still needs the network). Only same-origin build assets are precached —
// Supabase calls always hit the network.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Room Sign-up",
        short_name: "Rooms",
        description: "Sign up for rooms on a group trip and see who's where, live.",
        lang: "en",
        theme_color: "#2563eb",
        background_color: "#f9fafb",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,svg}"],
      },
    }),
  ],
});
