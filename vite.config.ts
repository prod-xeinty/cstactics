import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

// @vitejs/plugin-rsc руками не подключаем: vinext делает это сам (иначе ошибка дубликата).
export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] } }),
  ],
});
