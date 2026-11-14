"use client";

import { useState } from "react";
import { demoTactics } from "./home-data";
import styles from "./page.module.css";

export function TacticCarousel() {
  const [index, setIndex] = useState(0);
  const tactic = demoTactics[index];
  const move = (delta: number) => setIndex((current) => (current + delta + demoTactics.length) % demoTactics.length);
  return <section className={styles.featured} aria-label="Черновики тактик Dust2" onKeyDown={(event) => { if (event.key === "ArrowLeft") move(-1); if (event.key === "ArrowRight") move(1); }}>
    <div className={styles.featuredTop}><span className={styles.eyebrow}>Блокнот / Dust2 / Черновик</span><span className={styles.counter}>0{index + 1} / 0{demoTactics.length}</span></div>
    <div className={styles.featuredBody} key={index} aria-live="polite">
      <div className={styles.featuredMain}><p className={styles.overline}>Готовый раунд за пару коллов</p><h1>{tactic.title}</h1><p className={styles.call}>{tactic.call}</p><div className={styles.tags} aria-label="Параметры тактики"><span>Dust2</span><span>{tactic.side}</span><span>{tactic.team}</span><span>{tactic.economy}</span><span>Сложность {tactic.difficulty}</span></div><p className={styles.demoNote}>Демо-черновик. Перед каткой проверь гранаты в игре.</p></div>
      <div className={styles.quickBlock}><p className={styles.quickLabel}>Быстрая версия</p><ol>{tactic.quick.map((line) => <li key={line}>{line}</li>)}</ol><div className={styles.ratingNote}><p>Оценки игроков</p><div><span>Лоу</span><span>Мид</span><span>Хай</span></div><small>Пока мало голосов — тактика не опубликована.</small></div></div>
    </div>
    <div className={styles.carouselControls}><div className={styles.dots} aria-label="Выбрать тактику">{demoTactics.map((item, dot) => <button key={item.title} type="button" aria-label={`Показать тактику ${dot + 1}: ${item.title}`} aria-current={dot === index ? "true" : undefined} className={dot === index ? styles.activeDot : ""} onClick={() => setIndex(dot)} />)}</div><div className={styles.arrows}><button type="button" aria-label="Предыдущая тактика" onClick={() => move(-1)}>←</button><button type="button" aria-label="Следующая тактика" onClick={() => move(1)}>→</button></div></div>
  </section>;
}
