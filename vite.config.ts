import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    open: "/examples/index.html",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, "src/index.js"),
      formats: ["es"],
      fileName: () => "relay.js",
    },
    rollupOptions: {
      output: {
        assetFileNames: (info) => {
          if (info.name?.endsWith(".css")) return "relay.css";
          return "[name][extname]";
        },
      },
    },
  },
});
