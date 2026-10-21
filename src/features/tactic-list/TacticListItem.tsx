import Link from "next/link";

import { formatRatingSummary, formatSide, formatTeamSize } from "@/tactics/format";
import type { FaceitBand, TacticSummary } from "@/tactics/model";

import styles from "./TacticList.module.css";

export function TacticListItem({ tactic, band, index }: { tactic: TacticSummary; band: FaceitBand; index: number }) {
  const rating = formatRatingSummary(tactic.ratings[band]);
  return (
    <li className={styles.item}>
      <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
      <div className={styles.copy}>
        <Link href={`/tactics/${tactic.slug}`}>{tactic.title}</Link>
        <p>{tactic.call}</p>
        <span>{formatSide(tactic.side)} · {formatTeamSize(tactic.teamSize)} · {tactic.duration}</span>
      </div>
      <dl className={styles.rating}>
        <div><dt>Работает</dt><dd>{rating.works}</dd></div>
        <div><dt>Легко зайти</dt><dd>{rating.easy}</dd></div>
        <span>{rating.demoLabel} · {rating.votes}</span>
      </dl>
    </li>
  );
}
