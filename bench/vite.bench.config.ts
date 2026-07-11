// Benchmark build config: builds bench/bench.html alongside index.html so the
// FPS harness (bench/run-fps.mjs) can run against the production bundle.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig({
  root: repoRoot,
  plugins: [react()],
  build: {
    outDir: "dist-bench",
    rollupOptions: {
      input: {
        main: resolve(repoRoot, "index.html"),
        bench: resolve(repoRoot, "bench/bench.html"),
      },
    },
  },
});
