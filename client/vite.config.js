import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Redirige las llamadas /api al backend Express para evitar problemas de CORS en dev.
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
