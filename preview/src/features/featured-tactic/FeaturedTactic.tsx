import Link from "next/link";

import { TacticMeta } from "@/shared/ui/tactic-meta/TacticMeta";
import type { FaceitBand, TacticSummary } from "@/tactics/model";

import styles from "./FeaturedTactic.module.css";

export function FeaturedTactic({ tactic, band }: { tactic: TacticSummary; band: FaceitBand }) {
  return (
    <article className={styles.featured}>
      <div className={styles.number} aria-hidden="true">01</div>
      <div className={styles.content}>
        <p className={styles.label}>Рекомендация на раунд</p>
        <h2>{tactic.title}</h2>
        <p className={styles.call}>{tactic.call}</p>
        <TacticMeta tactic={tactic} band={band} />
        <div className={styles.actions}>
          <Link className={styles.primary} href={`/call/${tactic.slug}`}>Запустить быстрый колл</Link>
          <Link className={styles.secondary} href={`/tactics/${tactic.slug}`}>Открыть полный план</Link>
        </div>
      </div>
    </article>
  );
}
