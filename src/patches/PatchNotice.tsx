"use client";

import { useState, useSyncExternalStore } from "react";
import type { GamePatch } from "./repository";
import styles from "./PatchNotice.module.css";

const STORAGE_KEY = "dismissed-game-patch";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function storedVersion() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function serverVersion() {
  return undefined;
}

export function PatchNotice({ patch }: { patch: GamePatch | null }) {
  const dismissedVersion = useSyncExternalStore(subscribe, storedVersion, serverVersion);
  const [dismissedHere, setDismissedHere] = useState<string | null>(null);

  if (!patch || dismissedVersion === undefined || dismissedVersion === patch.version || dismissedHere === patch.version) return null;

  const version = patch.version;
  const date = new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(patch.releasedAt));

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, version);
    } catch {
      // Если хранилище недоступно, плашку всё равно можно закрыть на этой странице.
    }
    setDismissedHere(version);
  }

  return (
    <aside className={styles.notice} role="status">
      <p>Вышла обнова CS2 {date}. Раскидки могут лететь не туда — чекайте гранаты в оффлайне перед каткой.</p>
      <button type="button" onClick={dismiss} aria-label="Закрыть предупреждение об обнове">×</button>
    </aside>
  );
}
