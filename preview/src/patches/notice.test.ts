import { describe, expect, it } from "vitest";

import { shouldShowPatchNotice } from "./notice";

describe("shouldShowPatchNotice", () => {
  const latestPatch = { version: "2.1", releasedAt: "2026-10-20" };

  it("не показывает плашку без патча или опубликованных тактик", () => {
    expect(shouldShowPatchNotice(null, [])).toBe(false);
    expect(
      shouldShowPatchNotice(latestPatch, [{ status: "draft", gameVersion: "2.0" }]),
    ).toBe(false);
  });

  it("не показывает плашку, если все опубликованные тактики актуальны", () => {
    expect(
      shouldShowPatchNotice(latestPatch, [
        { status: "published", gameVersion: "2.1" },
        { status: "published", gameVersion: "2.1" },
      ]),
    ).toBe(false);
  });

  it("показывает плашку, если опубликованная тактика устарела", () => {
    expect(
      shouldShowPatchNotice(latestPatch, [
        { status: "published", gameVersion: "2.0" },
        { status: "pending", gameVersion: "1.9" },
      ]),
    ).toBe(true);
  });
});
