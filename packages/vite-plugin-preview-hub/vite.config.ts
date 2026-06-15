import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: [
    {
      attw: { level: "error", profile: "esm-only" },
      clean: true,
      dts: {
        tsgo: true,
      },
      entry: ["src/index.ts", "src/devtools-client.ts"],
      fixedExtension: true,
      format: "esm",
      fromVite: true,
      minify: "dce-only",
      nodeProtocol: true,
      publint: true,
      sourcemap: false,
      treeshake: true,
      // `vite` (and later `@vitejs/devtools-kit`) are consumed for types only, so they are
      // erased from the bundle and unplugin-unused would flag them as unused peers. Ignore them.
      unused: { ignore: ["vite", "@vitejs/devtools-kit"] },
    },
  ],
});
