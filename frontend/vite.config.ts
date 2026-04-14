import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // For GitHub Pages: set VITE_BASE_PATH=/police-map/ in env or use --base flag
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    proxy:
      mode === "development"
        ? {
            "/api": {
              target: "http://localhost:5000",
              changeOrigin: true,
            },
          }
        : undefined,
  },
}));
