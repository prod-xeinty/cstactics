import type { Tactic } from "@/tactics/model";

export interface GamePatch {
  version: string;
  releasedAt: string;
}

type PatchableTactic = Pick<Tactic, "status" | "gameVersion">;

export function shouldShowPatchNotice(
  latestPatch: GamePatch | null,
  tactics: readonly PatchableTactic[],
): boolean {
  if (!latestPatch) return false;

  const published = tactics.filter(({ status }) => status === "published");
  return published.length > 0 && published.some(({ gameVersion }) => gameVersion !== latestPatch.version);
}
