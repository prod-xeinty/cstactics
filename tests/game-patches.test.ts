import { describe, expect, it } from "vitest";
import { createTestDb } from "./sqlite-db";
import { addGamePatch, latestGamePatch, patchStatusLabel, tacticPatchStatus } from "@/patches/repository";

describe("версии игры", () => {
  it("сохраняет патчи и выбирает последний по дате выпуска", async () => {
    const db = createTestDb();
    await addGamePatch(db, { version: "patch-b", releasedAt: "2026-10-21" }, new Date("2026-10-22T00:00:00Z"));
    await addGamePatch(db, { version: "patch-a", releasedAt: "2026-10-20" }, new Date("2026-10-22T00:00:00Z"));
    expect(await latestGamePatch(db)).toMatchObject({ version: "patch-b" });
    expect(await addGamePatch(db, { version: "patch-b", releasedAt: "2026-10-21" }, new Date())).toBe(false);
  });

  it("сверяет проверенную версию тактики с текущим патчем", async () => {
    const db = createTestDb();
    expect(await tacticPatchStatus(db, "patch-a")).toBeNull();
    await addGamePatch(db, { version: "patch-a", releasedAt: "2026-10-20" }, new Date());
    expect(await tacticPatchStatus(db, "patch-a")).toBe("checked");
    await addGamePatch(db, { version: "patch-b", releasedAt: "2026-10-21" }, new Date());
    expect(await tacticPatchStatus(db, "patch-a")).toBe("outdated");
    expect(await tacticPatchStatus(db, "patch-b")).toBe("checked");
    expect(await tacticPatchStatus(db, "unverified-demo")).toBe("outdated");
    expect(patchStatusLabel.checked).toBe("Чекнуто на новом патче");
    expect(patchStatusLabel.outdated).toBe("Не чекали после обновы");
  });
});
