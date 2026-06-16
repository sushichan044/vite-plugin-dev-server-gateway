import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["pnpm-lock.yaml", "CHANGELOG.md", "**/.react-router/**", ".sushichan044/**"],
    jsdoc: {
      commentLineStrategy: "multiline",
    },
    sortImports: true,
  },
  lint: {
    categories: {
      correctness: "error",
      nursery: "error",
      perf: "error",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    env: {
      browser: true,
      node: true,
    },
    plugins: ["import", "node", "unicorn"],
    jsPlugins: ["vite-plus/oxlint-plugin"],
    rules: {
      "import/consistent-type-specifier-style": "error",
      "typescript/array-type": ["error", { default: "array-simple" }],
      "typescript/ban-ts-comment": "error",
      "typescript/consistent-type-assertions": "error",
      "typescript/consistent-type-imports": "error",
      "typescript/no-misused-promises": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-unnecessary-type-assertion": "error",
      "typescript/no-unnecessary-type-conversion": "error",
      "typescript/no-unsafe-call": "error",
      "typescript/non-nullable-type-assertion-style": "error",
      "node/no-path-concat": "error",
      "unicorn/custom-error-definition": "error",
      // This package is a published Vite plugin: its public types must reference the real `vite`
      // peer dependency, not vite-plus's vendored copies. Keep importing Vite types from "vite".
      "vite-plus/prefer-vite-plus-imports": "off",
    },
  },
  test: {
    benchmark: {
      include: ["**/*.{bench,benchmark}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    },
    projects: [
      {
        test: {
          name: "vite-plugin-dev-server-gateway",
          include: [
            "packages/vite-plugin-dev-server-gateway/**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
          ],
        },
      },
      {
        test: {
          name: "e2e",
          include: ["packages/e2e/**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
          // Spawning real Vite dev servers (gateway + instances) is slower than unit tests.
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
    ],
    passWithNoTests: true,
    typecheck: {
      enabled: true,
    },
  },
});
