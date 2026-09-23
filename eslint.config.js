import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  {
    // Build output and dependencies are out of scope for the linter — and
    // `native/ios` / `native/android` are exactly that: `expo prebuild`
    // regenerates them from `native/app.config.js` and its config plugins, so
    // anything the linter said about them would be said about generated code.
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      // The desktop shell's own trees: Rust build output, and the site copied
      // in from `dist/` (both gitignored — see tauri/README.md).
      "tauri/target/**",
      "tauri/webroot/**",
      "tauri/node_modules/**",
      "native/node_modules/**",
      "native/ios/**",
      "native/android/**",
      "native/.expo/**",
    ],
  },
  js.configs.recommended,
  {
    // Node tooling scripts (icon generation, SEO checks) and agent-skill
    // helpers. These run under Node, so expose its globals rather than the
    // browser's.
    files: [
      "scripts/**/*.mjs",
      "tauri/scripts/**/*.mjs",
      ".agent/skills/**/*.mjs",
    ],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
  },
  {
    // The native wrapper's Node-side JavaScript: its Expo config, its config
    // plugin, its Metro config and its bundle script. All CommonJS or ESM
    // under Node, none of it shipped to a device.
    files: ["native/**/*.{js,mjs}"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
  },
  {
    files: [
      "src/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      // The native wrapper's app sources. Linted from here rather than from a
      // second config inside `native/`, so there is one set of rules for the
      // repo — but note `native/` has its own dependency tree and its own
      // `tsc` (`npm --prefix native run typecheck`), which is what actually
      // type-checks these against react-native and expo.
      "native/**/*.{ts,tsx}",
      "vite.config.ts",
      "vitest.config.ts",
      "pwa-plugin.ts",
    ],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // TypeScript checks for undefined identifiers itself; the core rule
      // only produces false positives for DOM/Web globals.
      "no-undef": "off",
      // Defer to the TS-aware rule, which also honours the `_`-prefix
      // convention for intentionally unused parameters.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      // Rules that arrived enabled-by-default in the ESLint 10 /
      // eslint-plugin-react-hooks 7 majors; they fire on deliberate, working
      // patterns. Mirrors the framework's own configuration.
      "no-useless-assignment": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
