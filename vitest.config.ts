import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure-logic tests over the domain modules (export, search, migrations);
    // no DOM needed. Test files carry the `_test` suffix.
    environment: "node",
    include: ["tests/**/*_test.ts"],
  },
});
