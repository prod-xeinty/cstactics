"use client";

import { useSearchParams } from "next/navigation";

import styles from "@/app/page.module.css";
import { FeaturedTactic } from "@/features/featured-tactic/FeaturedTactic";
import { TacticFilters } from "@/features/tactic-filters/TacticFilters";
import { TacticList } from "@/features/tactic-list/TacticList";
import { matchesTacticFilters, parseTacticFilters, sortTacticsForBand } from "@/tactics/filter";
import type { TacticFilters as Filters, TacticSummary } from "@/tactics/model";

interface CatalogProps {
  tactics: readonly TacticSummary[];
  drafts: readonly TacticSummary[];
}

export function HomeCatalog(props: CatalogProps) {
  const params = useSearchParams();
  return <CatalogResults {...props} filters={parseTacticFilters(params)} />;
}

export function CatalogResults({ tactics, drafts, filters }: CatalogProps & { filters: Filters }) {
  const matching = sortTacticsForBand(tactics.filter((tactic) => matchesTacticFilters(tactic, filters)), filters.band);
  const featured = matching.find((tactic) => tactic.featured) ?? null;
  const matchingDrafts = drafts.filter((tactic) => matchesTacticFilters(tactic, filters));

  return (
    <>
      <TacticFilters filters={filters} />
      {matchingDrafts.length > 0 ? (
        <section className={styles.alternatives} aria-labelledby="draft-tactics-title">
          <div className={styles.sectionHeading}>
            <h2 id="draft-tactics-title">Новые тактики · на проверке</h2>
            <p>Черновики для прогона в CS2.</p>
          </div>
          <TacticList tactics={matchingDrafts} band={filters.band} />
        </section>
      ) : null}
      {featured ? <FeaturedTactic tactic={featured} band={filters.band} /> : null}
      {matching.length > 0 ? (
        <section className={styles.alternatives} aria-labelledby="catalog-tactics-title">
          <div className={styles.sectionHeading}>
            <h2 id="catalog-tactics-title">Тактики Dust2</h2>
          </div>
          <TacticList tactics={matching} band={filters.band} />
        </section>
      ) : null}
      {matching.length === 0 && matchingDrafts.length === 0 ? <TacticList tactics={[]} band={filters.band} /> : null}
    </>
  );
}
