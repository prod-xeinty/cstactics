"use client";

import { useFaceitProfile } from "@/faceit/useFaceitProfile";
import { splitPersonalized, type PersonalTactic } from "@/tactics/personalized";
import type { CatalogBand } from "@/tactics/catalog";
import styles from "./page.module.css";

const bandNames: Record<CatalogBand, string> = { low: "Лоу", mid: "Мид", high: "Хай" };
const bands: CatalogBand[] = ["low", "mid", "high"];

export function PersonalTactics({ tactics, unavailable }: { tactics: PersonalTactic[]; unavailable: boolean }) {
  const profile = useFaceitProfile();
  if (!profile) return <><p className={styles.eyebrow}>Под твоё эло</p><h1>Ищем твой FACEIT</h1><p role="status">Сверяем уровень и готовим подборку…</p></>;
  if (profile.status === "unavailable") return <><p className={styles.eyebrow}>Под твоё эло</p><h1>FACEIT пока не отвечает</h1><p>Попробуй обновить страницу чуть позже.</p></>;
  if (profile.status === "not_found") return <><p className={styles.eyebrow}>Под твоё эло</p><h1>Профиль FACEIT не нашли</h1><p>Тактики всё равно можно посмотреть в каталоге.</p><a className={styles.action} href="/tactics">Открыть каталог</a></>;
  const band = profile.band;
  const { recommended, other } = splitPersonalized(tactics, band);
  return <>
    <p className={styles.eyebrow}>Твой FACEIT: {profile.level} лвл · {profile.elo} эло</p>
    <h1>Тактики для {profile.level} лвл</h1>
    <p className={styles.lead}>Твоя шкала — {bandNames[band]}. Оценки появятся, когда тактику проверят минимум пять игроков этой группы.</p>
    {unavailable ? <p role="alert">База тактик сейчас недоступна. Попробуй позже.</p> : tactics.length === 0 ? <div className={styles.empty}><h2>Пока нет проверенных тактик</h2><p>В каталоге уже можно посмотреть демо-черновики. Опубликуем раунды после проверки в игре.</p><a href="/tactics" className={styles.action}>Открыть каталог</a></div> : <>
      <section aria-labelledby="recommended-heading"><h2 id="recommended-heading">Заходят на твоём уровне</h2>{recommended.length ? <div className={styles.grid}>{recommended.map((t) => <Card key={t.id} tactic={t} ownBand={band} />)}</div> : <p className={styles.emptyLine}>Пока нет тактик с оценкой от 4.0 и хотя бы пятью голосами.</p>}</section>
      <section aria-labelledby="other-heading"><h2 id="other-heading">Пока не заходят или мало голосов</h2>{other.length ? <div className={styles.grid}>{other.map((t) => <Card key={t.id} tactic={t} ownBand={band} />)}</div> : <p className={styles.emptyLine}>Здесь пока пусто.</p>}</section>
    </>}
  </>;
}

function Card({ tactic, ownBand }: { tactic: PersonalTactic; ownBand: CatalogBand }) {
  return <article className={styles.card}>
    <div className={styles.meta}>Dust2 · {tactic.side} · {tactic.teamSize} игрока{tactic.source === "player" && ` · От игрока ${tactic.author}`}</div>
    <h3>{tactic.title}</h3><p>{tactic.call}</p>
    <p className={styles.ownScore}>Твоя шкала: {tactic.scores[ownBand].works === null ? "мало голосов" : `Работает ${tactic.scores[ownBand].works.toFixed(1)} · Легко зайти ${tactic.scores[ownBand].easy?.toFixed(1)}`}</p>
    <div className={styles.comparison}>{bands.map((band) => <span key={band}>{bandNames[band]} {tactic.scores[band].works?.toFixed(1) ?? "—"}</span>)}</div>
  </article>;
}
