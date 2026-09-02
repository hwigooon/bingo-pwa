import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const base = env.VITE_BASE_PATH || "/";

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg", "apple-touch-icon.png"],
        manifest: {
          name: "Bingo Club",
          short_name: "Bingo",
          description: "친구들과 실시간으로 즐기는 맞춤형 빙고 게임",
          theme_color: "#101525",
          background_color: "#080b14",
          display: "standalone",
          orientation: "portrait-primary",
          start_url: ".",
          scope: ".",
          lang: "ko-KR",
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
          ]
        },
        workbox: {
          navigateFallbackDenylist: [/^\/functions\//],
          cleanupOutdatedCaches: true
        }
      })
    ]
  };
});
