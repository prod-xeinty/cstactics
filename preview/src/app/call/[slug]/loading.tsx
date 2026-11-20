import styles from "./page.module.css";

export default function LoadingQuickCall() {
  return (
    <div className={`site-shell ${styles.page}`} aria-busy="true" aria-label="Загружаем быстрый колл">
      <p>Готовим короткий колл…</p>
    </div>
  );
}
