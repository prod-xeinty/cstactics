import styles from "./page.module.css";

export default function Loading() {
  return (
    <div className={`site-shell ${styles.loading}`} aria-busy="true" aria-label="Загружаем тактики">
      <p>Собираем план на раунд…</p>
    </div>
  );
}
