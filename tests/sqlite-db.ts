// Тестовая реализация интерфейса Database поверх встроенного SQLite в Node — с настоящими миграциями.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import type { Database } from "@/platform";

export function createTestDb(): Database {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const f of readdirSync("migrations").filter((n) => n.endsWith(".sql")).sort()) {
    db.exec(readFileSync(`migrations/${f}`, "utf8").split("--> statement-breakpoint").join("\n"));
  }
  const norm = (p: readonly unknown[]) => p.map((v) => (v === undefined ? null : v)) as never[];
  return {
    async first<T>(sql: string, params: readonly unknown[] = []) {
      return (db.prepare(sql).get(...norm(params)) as T | undefined) ?? null;
    },
    async all<T>(sql: string, params: readonly unknown[] = []) {
      return db.prepare(sql).all(...norm(params)) as T[];
    },
    async run(sql: string, params: readonly unknown[] = []) {
      const r = db.prepare(sql).run(...norm(params));
      return { changes: Number(r.changes) };
    },
  };
}
