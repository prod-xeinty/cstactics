import type { FaceitBand, TacticFilters, TacticSummary } from "./model";
import { tacticFiltersSchema } from "./schema";

type FilterParams = URLSearchParams | Record<string, string | string[] | undefined>;

const readParams = (params: FilterParams): Record<string, string | undefined> => {
  if (params instanceof URLSearchParams) {
    const readOne = (key: string) => {
      const values = params.getAll(key);
      return values.length === 1 ? values[0] : undefined;
    };

    return {
      map: readOne("map"),
      side: readOne("side"),
      teamSize: readOne("teamSize"),
      band: readOne("band"),
    };
  }

  const readOne = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };

  return {
    map: readOne("map"),
    side: readOne("side"),
    teamSize: readOne("teamSize"),
    band: readOne("band"),
  };
};

export function parseTacticFilters(params: FilterParams): TacticFilters {
  return tacticFiltersSchema.parse(readParams(params));
}

export function sortTacticsForBand(
  tactics: readonly TacticSummary[],
  band: FaceitBand,
): TacticSummary[] {
  return [...tactics].sort((left, right) => {
    const leftRating = left.ratings[band];
    const rightRating = right.ratings[band];

    return (
      rightRating.works - leftRating.works ||
      rightRating.voteCount - leftRating.voteCount ||
      left.slug.localeCompare(right.slug, "ru")
    );
  });
}
