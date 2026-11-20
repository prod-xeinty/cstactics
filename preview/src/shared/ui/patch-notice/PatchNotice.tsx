"use client";

import { useState } from "react";

import { createPatchNoticeStorage } from "@/patches/storage";

import styles from "./PatchNotice.module.css";

interface PatchNoticeProps {
  version: string;
  releasedAt: string;
}

export function PatchNotice({ version, releasedAt }: PatchNoticeProps) {
  const [visible, setVisible] = useState(() => {
    const storage = typeof window === "undefined" ? null : window.localStorage;
    return !createPatchNoticeStorage(storage).isDismissed(version);
  });

  if (!visible) return null;

  const dismiss = () => {
    const storage = typeof window === "undefined" ? null : window.localStorage;
    createPatchNoticeStorage(storage).dismiss(version);
    setVisible(false);
  };

  return (
    <div className={styles.notice} role="status">
      <p>
        Вышла обнова CS2 {releasedAt}. Раскидки могут лететь не туда — чекайте гранаты
        в оффлайне перед каткой.
      </p>
      <button type="button" onClick={dismiss} aria-label="Закрыть предупреждение">
        Закрыть
      </button>
    </div>
  );
}
