import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: { NODE_ENV: "test", JWT_SECRET: "test-secret" },
    setupFiles: ["./tests/setup.js"],
    // One in-memory MongoDB per file; run files one after another to keep memory low in CI.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    coverage: { include: ["src/**"], reporter: ["text", "html"] },
  },
});
