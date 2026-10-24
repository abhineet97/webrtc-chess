import { defineConfig } from "vite-plus";

export default defineConfig({
  publicDir: "app/static",
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "main.[hash].js",
      },
    },
  },
  pack: {
    entry: ["server.ts"],
    outDir: "build",
    platform: "node",
  },
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    jsPlugins: ["vite-plus/oxlint-plugin"],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
