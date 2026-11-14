import type { Database } from "@/platform";
import { z } from "zod";

export const newPatchSchema = z.object({
  version: z.string().trim().min(1).max(80),
  releasedAt: z.iso.date(),
});

export type NewPatch = z.infer<typeof newPatchSchema>;
export type GamePatch = { version: string; releasedAt: string };
export type TacticPatchStatus = "checked" | "outdated";

export function patchStatusForVersion(gameVersion: string, patch: GamePatch | null): TacticPatchStatus | null {
  if (!patch) return null;
  return patch.version === gameVersion ? "checked" : "outdated";
}

export const patchStatusLabel: Record<TacticPatchStatus, string> = {
  checked: "Чекнуто на новом патче",
  outdated: "Не чекали после обновы",
};

export async function latestGamePatch(db: Database): Promise<GamePatch | null> {
  const row = await db.first<{ version: string; released_at: string }>(
    "SELECT version, released_at FROM game_patches ORDER BY released_at DESC, created_at DESC, id DESC LIMIT 1",
  );
  return row ? { version: row.version, releasedAt: row.released_at } : null;
}

export async function addGamePatch(db: Database, input: NewPatch, now: Date): Promise<boolean> {
  const patch = newPatchSchema.parse(input);
  const result = await db.run(
    "INSERT OR IGNORE INTO game_patches (id, version, released_at, created_at) VALUES (?, ?, ?, ?)",
    [crypto.randomUUID(), patch.version, `${patch.releasedAt}T00:00:00.000Z`, now.toISOString()],
  );
  return result.changes === 1;
}

export async function tacticPatchStatus(db: Database, gameVersion: string): Promise<TacticPatchStatus | null> {
  return patchStatusForVersion(gameVersion, await latestGamePatch(db));
}
