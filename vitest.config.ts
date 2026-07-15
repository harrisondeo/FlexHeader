import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [react(), WxtVitest()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
