import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Отдельный конфиг, чтобы vitest не тянул vinext и Cloudflare-плагин из vite.config.ts.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
