import Link from "next/link";

import styles from "./States.module.css";

export function EmptyState() {
  return (
    <section className={styles.state} aria-labelledby="empty-title">
      <h2 id="empty-title">Под такой колл пока пусто</h2>
      <p>Сбрось фильтры — покажем все проверенные варианты.</p>
      <Link href="/">Сбросить фильтры</Link>
    </section>
  );
}
