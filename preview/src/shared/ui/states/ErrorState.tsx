interface ErrorStateProps {
  onRetry?: () => void;
}

import styles from "./States.module.css";

export function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <section className={styles.state} aria-labelledby="error-title">
      <h2 id="error-title">Тактики не загрузились</h2>
      <p>Фильтры сохранили. Попробуй ещё раз.</p>
      {onRetry ? <button type="button" onClick={onRetry}>Повторить</button> : null}
    </section>
  );
}
