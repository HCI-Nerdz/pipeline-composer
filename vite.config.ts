import { defineConfig } from "vite";

export default defineConfig({
  base: "/pipeline-composer/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
