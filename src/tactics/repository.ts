import { tacticsFixtures } from "./fixtures";
import { matchesTacticFilters, sortTacticsForBand } from "./filter";
import type { Tactic, TacticFilters, TacticSummary } from "./model";

export interface TacticsRepository {
  list(filters: TacticFilters): Promise<TacticSummary[]>;
  listDrafts(filters: TacticFilters): Promise<TacticSummary[]>;
  featured(filters: TacticFilters): Promise<TacticSummary | null>;
  bySlug(slug: string): Promise<Tactic | null>;
}

const clone = <Value>(value: Value): Value => structuredClone(value);

async function loadPreviewDrafts(): Promise<readonly Tactic[]> {
  if (process.env.NODE_ENV !== "development" && process.env.CSTACTICS_PAGES !== "1") return [];
  const { importedTactics } = await import("./imported-tactics");
  return importedTactics;
}

const toSummary = (tactic: Tactic): TacticSummary => {
  return clone({
    id: tactic.id,
    slug: tactic.slug,
    map: tactic.map,
    side: tactic.side,
    teamSize: tactic.teamSize,
    economy: tactic.economy,
    difficulty: tactic.difficulty,
    spawnDependent: tactic.spawnDependent,
    title: tactic.title,
    call: tactic.call,
    duration: tactic.duration,
    gameVersion: tactic.gameVersion,
    status: tactic.status,
    featured: tactic.featured,
    mapImage: tactic.mapImage,
    mapAlt: tactic.mapAlt,
    ratings: tactic.ratings,
  });
};

export const tacticsRepository: TacticsRepository = {
  async list(filters) {
    const summaries = tacticsFixtures
      .filter((tactic) => tactic.status === "published" && matchesTacticFilters(tactic, filters))
      .map(toSummary);

    return sortTacticsForBand(summaries, filters.band);
  },

  async listDrafts(filters) {
    return (await loadPreviewDrafts()).filter((tactic) => matchesTacticFilters(tactic, filters)).map(toSummary);
  },

  async featured(filters) {
    const summaries = tacticsFixtures
      .filter((tactic) => tactic.status === "published" && tactic.featured && matchesTacticFilters(tactic, filters))
      .map(toSummary);

    return sortTacticsForBand(summaries, filters.band)[0] ?? null;
  },

  async bySlug(slug) {
    const tactic = tacticsFixtures.find(
      (candidate) => candidate.slug === slug && candidate.status === "published",
    ) ?? (await loadPreviewDrafts()).find((candidate) => candidate.slug === slug);

    return tactic ? clone(tactic) : null;
  },
};
