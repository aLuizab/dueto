import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./core", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  optimizeDeps: { exclude: ["sql.js"] },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome130",
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173, strictPort: true },
});
