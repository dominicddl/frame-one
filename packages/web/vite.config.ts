import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const matchUrl = env.MATCH_URL || "http://localhost:3001";

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      allowedHosts: true,
      proxy: {
        "/api": {
          target: matchUrl,
          changeOrigin: true,
        },
        "/assets/spots": {
          target: matchUrl,
          changeOrigin: true,
        },
      },
    },
    optimizeDeps: {
      include: ["@frame-one/shared"],
    },
  };
});
