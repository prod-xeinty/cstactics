import { describe, expect, it } from "vitest";

import { createPatchNoticeStorage, patchNoticeStorageKey } from "./storage";

describe("patch notice storage", () => {
  it("хранит закрытие отдельно для каждой версии", () => {
    const storage = createPatchNoticeStorage(window.localStorage);
    storage.dismiss("2.0");

    expect(window.localStorage.getItem(patchNoticeStorageKey("2.0"))).toBe("dismissed");
    expect(storage.isDismissed("2.0")).toBe(true);
    expect(storage.isDismissed("2.1")).toBe(false);
  });

  it("не ломает страницу, если браузерное хранилище недоступно", () => {
    const brokenStorage: Storage = {
      get length(): number {
        throw new Error("blocked");
      },
      clear: () => {
        throw new Error("blocked");
      },
      getItem: () => {
        throw new Error("blocked");
      },
      key: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const storage = createPatchNoticeStorage(brokenStorage);

    expect(storage.isDismissed("2.0")).toBe(false);
    expect(() => storage.dismiss("2.0")).not.toThrow();
  });
});
