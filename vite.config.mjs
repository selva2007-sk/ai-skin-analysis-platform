import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [{ default: react }, { default: tailwindcss }] = await Promise.all([
  import("@vitejs/plugin-react"),
  import("@tailwindcss/vite")
]);

export default defineConfig({
  // Relative base makes the build resilient when loaded from Capacitor's local server
  // and in other offline/static hosting scenarios.
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000'
    }
  },
  build: {
    // Single shared build output for web and Capacitor.
    outDir: "dist",
    // Windows can hold locks on the output directory (e.g., when Android tooling
    // or a static server is reading it). Avoid hard-deleting the folder on build.
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
