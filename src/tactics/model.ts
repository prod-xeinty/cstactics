export type Side = "T" | "CT";
export type FaceitBand = "low" | "mid" | "high";
export type TeamSize = 2 | 3 | 4 | 5;
export type Economy = "eco" | "force" | "full" | "any";
export type Difficulty = 1 | 2 | 3;

export interface RatingSummary {
  works: number;
  easy: number;
  voteCount: number;
  demo: true;
}

export interface TacticFilters {
  map: "dust2";
  side: Side | "all";
  teamSize: TeamSize | "all";
  band: FaceitBand;
}

export interface TacticSummary {
  id: string;
  slug: string;
  map: "dust2";
  side: Side;
  teamSize: TeamSize;
  economy: Economy;
  difficulty: Difficulty;
  spawnDependent: boolean;
  title: string;
  call: string;
  duration: string;
  gameVersion: string;
  status: "draft" | "pending" | "published" | "rejected";
  featured: boolean;
  mapImage: string;
  mapAlt: string;
  ratings: Record<FaceitBand, RatingSummary>;
}

export interface TacticRole {
  spawnZone: string;
  task: string;
  nades: string;
  fixed?: boolean;
}

export interface TacticNade {
  who: string;
  type: "smoke" | "flash" | "molotov" | "he" | "decoy";
  to: string;
  from?: string;
  when: string;
  why: string;
}

export interface Tactic extends TacticSummary {
  quick: string[];
  roles: TacticRole[];
  roleFallback?: string;
  nades: TacticNade[];
  flow?: string[];
  fallback?: string;
  postPlant?: string;
  counters?: string;
  videoUrl?: string;
  source: "authors" | "player";
  authorId: string;
  createdAt: string;
  updatedAt: string;
}
