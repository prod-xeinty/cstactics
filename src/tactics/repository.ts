import { tacticsFixtures } from "./fixtures";
import { sortTacticsForBand } from "./filter";
import type { Tactic, TacticFilters, TacticSummary } from "./model";

export interface TacticsRepository {
  list(filters: TacticFilters): Promise<TacticSummary[]>;
  featured(filters: TacticFilters): Promise<TacticSummary | null>;
  bySlug(slug: string): Promise<Tactic | null>;
}

const clone = <Value>(value: Value): Value => structuredClone(value);

const matchesFilters = (tactic: Tactic, filters: TacticFilters) =>
  tactic.status === "published" &&
  tactic.map === filters.map &&
  (filters.side === "all" || tactic.side === filters.side) &&
  (filters.teamSize === "all" || tactic.teamSize === filters.teamSize);

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
      .filter((tactic) => matchesFilters(tactic, filters))
      .map(toSummary);

    return sortTacticsForBand(summaries, filters.band);
  },

  async featured(filters) {
    const summaries = tacticsFixtures
      .filter((tactic) => tactic.featured && matchesFilters(tactic, filters))
      .map(toSummary);

    return sortTacticsForBand(summaries, filters.band)[0] ?? null;
  },

  async bySlug(slug) {
    const tactic = tacticsFixtures.find(
      (candidate) => candidate.slug === slug && candidate.status === "published",
    );

    return tactic ? clone(tactic) : null;
  },
};
