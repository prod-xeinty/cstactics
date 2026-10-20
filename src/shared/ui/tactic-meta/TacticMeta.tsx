import {
  formatDifficulty,
  formatEconomy,
  formatFaceitBand,
  formatRatingSummary,
  formatSide,
  formatTeamSize,
} from "@/tactics/format";
import type { FaceitBand, TacticSummary } from "@/tactics/model";

import styles from "./TacticMeta.module.css";

interface TacticMetaProps {
  tactic: TacticSummary;
  band: FaceitBand;
}

export function TacticMeta({ tactic, band }: TacticMetaProps) {
  const rating = formatRatingSummary(tactic.ratings[band]);

  return (
    <div className={styles.wrapper}>
      <dl className={styles.meta}>
        <div><dt>Карта</dt><dd>Dust2</dd></div>
        <div><dt>Сторона</dt><dd>{formatSide(tactic.side)}</dd></div>
        <div><dt>Состав</dt><dd>{formatTeamSize(tactic.teamSize)}</dd></div>
        <div><dt>Закуп</dt><dd>{formatEconomy(tactic.economy)}</dd></div>
        <div><dt>Сложность</dt><dd>{formatDifficulty(tactic.difficulty)}</dd></div>
        <div><dt>FACEIT</dt><dd>{formatFaceitBand(band)}</dd></div>
      </dl>
      <div className={styles.ratings} aria-label={`Оценки: ${rating.demoLabel}`}>
        <span className={styles.demo}>{rating.demoLabel}</span>
        <span>Работает: <strong>{rating.works}</strong></span>
        <span>Легко зайти: <strong>{rating.easy}</strong></span>
        <span className={styles.votes}>{rating.votes}</span>
      </div>
    </div>
  );
}
