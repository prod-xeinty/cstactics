import type { PendingTactic } from "@/tactics/moderation";
import { CSRF_FIELD } from "@/security/csrf";
import styles from "./page.module.css";

export function ModerationCard({ tactic, csrf }: { tactic: PendingTactic; csrf: string }) {
  const target = `/api/moderation/${encodeURIComponent(tactic.id)}`;
  return <article className={styles.card}>
    <div className={styles.cardTop}><span>От игрока · {tactic.author}</span><time dateTime={tactic.createdAt}>{new Date(tactic.createdAt).toLocaleDateString("ru-RU")}</time></div>
    <h2>{tactic.title}</h2>
    <p className={styles.call}>{tactic.call}</p>
    <p className={styles.meta}>Dust2 · {tactic.side} · {tactic.teamSize} игрока · {tactic.economy} · сложность {tactic.difficulty}/3 · {tactic.spawnDependent ? "Роли зависят от спавна" : "Без привязки к спавну"} · версия {tactic.gameVersion}</p>
    <details className={styles.details}><summary>Развернуть весь раунд</summary>
      <section><h3>Быстрая версия</h3><ol>{tactic.quick.map((line, index) => <li key={index}>{line}</li>)}</ol></section>
      <section><h3>Роли по спавну</h3>{tactic.roles.length ? <ul>{tactic.roles.map((role, index) => <li key={index}>{role.spawnZone} → {role.task}{role.nades && ` · ${role.nades}`}{role.fixed && " · фиксированная"}</li>)}</ul> : <p>Роли не расписаны</p>}{tactic.roleFallback && <p>Если на нужном спавне никого: {tactic.roleFallback}</p>}</section>
      <section><h3>Гранаты</h3>{tactic.nades.length ? <ul>{tactic.nades.map((nade, index) => <li key={index}>{nade.who}: {nade.type} на {nade.to} · {nade.when} · {nade.why}</li>)}</ul> : <p>Гранаты не расписаны</p>}</section>
      {tactic.flow && <section><h3>Ход раунда</h3><p>{tactic.flow}</p></section>}
      {tactic.fallback && <section><h3>Если пошло не так</h3><p>{tactic.fallback}</p></section>}
      {tactic.postPlant && <section><h3>Пост-плант</h3><p>{tactic.postPlant}</p></section>}
      {tactic.counters && <section><h3>Чем контрят</h3><p>{tactic.counters}</p></section>}
    </details>
    <div className={styles.actions}>
      <form action={target} method="post"><input type="hidden" name={CSRF_FIELD} value={csrf} /><input type="hidden" name="action" value="published" /><button className={styles.publish} type="submit">Прогнали в игре · публиковать</button></form>
      <form action={target} method="post" className={styles.reject}><input type="hidden" name={CSRF_FIELD} value={csrf} /><input type="hidden" name="action" value="rejected" /><label>Что поправить автору?<textarea name="reason" required maxLength={500} rows={2} placeholder="Например, смок надо перепроверить" /></label><button type="submit">Отклонить</button></form>
    </div>
  </article>;
}
