"use client";

import { useEffect, useRef } from "react";
import { useFaceitProfile } from "./useFaceitProfile";
import styles from "./FaceitWelcome.module.css";

export function FaceitWelcome() {
  const profile = useFaceitProfile();
  const ref = useRef<HTMLDialogElement>(null);
  const shown = useRef(false);
  useEffect(() => { if (profile && !shown.current) { ref.current?.showModal(); shown.current = true; } }, [profile]);
  function close() {
    ref.current?.close();
    const url = new URL(window.location.href);
    url.searchParams.delete("welcome");
    window.history.replaceState(null, "", url);
  }
  return <dialog ref={ref} className={styles.dialog} onClose={close} aria-labelledby="faceit-welcome-title">
    <button type="button" className={styles.close} onClick={close} aria-label="Закрыть окно">×</button>
    <p className={styles.label}>Вход через Steam готов</p>
    <h2 id="faceit-welcome-title">{profile?.status === "ready" ? "Нашли твой FACEIT" : profile?.status === "not_found" ? "FACEIT не нашли" : "FACEIT пока не отвечает"}</h2>
    <p>{profile?.status === "ready" ? `${profile.level} лвл · ${profile.elo} эло. Подберём тактики под твою группу.` : profile?.status === "not_found" ? "Можно смотреть тактики и без FACEIT-профиля." : "Попробуй открыть подборку чуть позже."}</p>
    <a href="/for-me" className={styles.action}>Показать тактики под меня →</a>
  </dialog>;
}
