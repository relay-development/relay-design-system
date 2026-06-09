/*
 * Static-site build for the preview page (examples/index.html).
 *   - bundles src/index.css via Tailwind v4
 *   - outputs ./site/index.html
 *
 * Hosted on GitHub Pages under
 *   https://relay-development.github.io/relay-design-system/
 * so asset URLs in the built HTML are prefixed with `/relay-design-system/`.
 * The dev server (npm run dev) uses vite.config.ts (not this file), so the
 * subpath doesn't affect local development.
 */
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { readdirSync } from "node:fs";

// Every generated catalog page (examples/*.html) becomes a rollup entry, so
// `npm run build:pages` must run first (it does — see build:site). Adding a
// page needs no change here.
const examplesDir = resolve(__dirname, "examples");
const input = Object.fromEntries(
  readdirSync(examplesDir)
    .filter((f) => f.endsWith(".html"))
    .map((f) => [f.replace(/\.html$/, ""), resolve(examplesDir, f)]),
);

export default defineConfig({
  base: "/relay-design-system/",
  root: examplesDir,
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    fs: {
      allow: [resolve(__dirname)],
    },
  },
  build: {
    outDir: resolve(__dirname, "site"),
    emptyOutDir: true,
    rollupOptions: { input },
  },
});
