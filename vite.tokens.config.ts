import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, "src/tokens-entry.js"),
      formats: ["es"],
      fileName: () => "tokens.js",
    },
    rollupOptions: {
      output: {
        assetFileNames: (info) => {
          if (info.name?.endsWith(".css")) return "tokens.css";
          return "[name][extname]";
        },
      },
    },
  },
});
