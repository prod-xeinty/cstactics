export const patchNoticeStorageKey = (version: string) =>
  `collgg:patch-notice:${version}`;

export function createPatchNoticeStorage(storage: Storage | null | undefined) {
  return {
    isDismissed(version: string) {
      try {
        return storage?.getItem(patchNoticeStorageKey(version)) === "dismissed";
      } catch {
        return false;
      }
    },
    dismiss(version: string) {
      try {
        storage?.setItem(patchNoticeStorageKey(version), "dismissed");
      } catch {
        // Закрытие работает и без localStorage: состояние останется до перезагрузки.
      }
    },
  };
}
