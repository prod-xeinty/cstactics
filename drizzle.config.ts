import { defineConfig } from "drizzle-kit";

// Схему и модель данных ведёт задача #11. Здесь только каркас: SQL-миграции кладём в ./migrations,
// а применяет их wrangler (`npm run db:migrate:local`).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./migrations",
});
