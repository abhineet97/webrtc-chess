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
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["app/lib/**"],
  },
  lint: {
    ignorePatterns: ["app/lib/**"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
