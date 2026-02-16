import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 51731,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:43001",
    },
  },
});
