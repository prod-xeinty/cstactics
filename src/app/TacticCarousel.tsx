"use client";

import { useState } from "react";
import { economyLabel, teamLabel, type TacticPreview } from "@/tactics/types";
import styles from "./page.module.css";

export function TacticCarousel({ tactics }: { tactics: readonly TacticPreview[] }) {
  const [index, setIndex] = useState(0);
  if (!tactics.length) return null;
  const activeIndex = index % tactics.length;
  const tactic = tactics[activeIndex];
  const move = (delta: number) => setIndex((current) => (current + delta + tactics.length) % tactics.length);
  return <section className={styles.featured} aria-label="Тактики Dust2" onKeyDown={(event) => { if (event.key === "ArrowLeft") move(-1); if (event.key === "ArrowRight") move(1); }}>
    <div className={styles.featuredTop}><span className={styles.eyebrow}>Блокнот / Dust2 / {tactic.verified ? "Проверено" : "Черновик"}</span><span className={styles.counter}>0{activeIndex + 1} / 0{tactics.length}</span></div>
    <div className={styles.featuredBody} key={activeIndex} aria-live="polite">
      <div className={styles.featuredMain}><p className={styles.overline}>Готовый раунд за пару коллов</p><h1>{tactic.title}</h1><p className={styles.call}>{tactic.call}</p><div className={styles.tags} aria-label="Параметры тактики"><span>Dust2</span><span>{tactic.side}</span><span>{teamLabel(tactic.teamSize)}</span><span>{economyLabel(tactic.economy)}</span><span>Сложность {tactic.difficulty}/3</span></div><a className={styles.detailLink} href={`/tactics/${tactic.slug}`}>Полный разбор →</a>{!tactic.verified && <p className={styles.demoNote}>Демо-черновик. Перед каткой проверь гранаты в игре.</p>}</div>
      <div className={styles.quickBlock}><p className={styles.quickLabel}>Быстрая версия</p><ol>{tactic.quick.map((line) => <li key={line}>{line}</li>)}</ol><div className={styles.ratingNote}><p>Оценки игроков</p><div><span>Лоу</span><span>Мид</span><span>Хай</span></div><small>{tactic.verified ? "Оценки смотри в разборе." : "Пока мало голосов — тактика не опубликована."}</small></div></div>
    </div>
    <div className={styles.carouselControls}><div className={styles.dots} aria-label="Выбрать тактику">{tactics.map((item, dot) => <button key={item.title} type="button" aria-label={`Показать тактику ${dot + 1}: ${item.title}`} aria-current={dot === activeIndex ? "true" : undefined} className={dot === activeIndex ? styles.activeDot : ""} onClick={() => setIndex(dot)} />)}</div><div className={styles.arrows}><button type="button" aria-label="Предыдущая тактика" onClick={() => move(-1)}>←</button><button type="button" aria-label="Следующая тактика" onClick={() => move(1)}>→</button></div></div>
  </section>;
}
