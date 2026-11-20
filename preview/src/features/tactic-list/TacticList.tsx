import { EmptyState } from "@/shared/ui/states/EmptyState";
import { ErrorState } from "@/shared/ui/states/ErrorState";
import type { FaceitBand, TacticSummary } from "@/tactics/model";

import { TacticListItem } from "./TacticListItem";
import styles from "./TacticList.module.css";

interface TacticListProps { tactics: readonly TacticSummary[]; band: FaceitBand; state?: "ready" | "error"; onRetry?: () => void; }

export function TacticList({ tactics, band, state = "ready", onRetry }: TacticListProps) {
  if (state === "error") return <ErrorState onRetry={onRetry} />;
  if (tactics.length === 0) return <EmptyState />;
  return <ol className={styles.list}>{tactics.map((tactic, index) => <TacticListItem key={tactic.id} tactic={tactic} band={band} index={index} />)}</ol>;
}
