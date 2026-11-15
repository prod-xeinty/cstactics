/** Общие типы продукта. Данные FACEIT не сохраняются в User. */
export type Side = "T" | "CT";
export type FaceitBand = "low" | "mid" | "high" | "none";
export type Economy = "eco" | "force" | "full" | "any";
export type TeamSize = 2 | 3 | 4 | 5;
export type Difficulty = 1 | 2 | 3;

export interface User {
  id: string;
  steamId64: string;
  nickname: string;
  avatarUrl?: string;
  role: "user" | "moderator" | "admin";
}

export interface Tactic {
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
  quick: string[];
  roles: { spawnZone: string; task: string; nades: string; fixed?: boolean }[];
  roleFallback?: string;
  nades: { who: string; type: "smoke" | "flash" | "molotov" | "he" | "decoy"; to: string; from?: string; when: string; why: string }[];
  flow?: string[];
  fallback?: string;
  postPlant?: string;
  counters?: string;
  videoUrl?: string;
  gameVersion: string;
  source: "authors" | "player";
  authorId: string;
  status: "draft" | "pending" | "published" | "rejected";
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Clutch {
  id: string;
  map: "dust2";
  side: Side;
  enemies: 1 | 2 | 3 | 4 | 5;
  bomb: "none" | "A" | "B";
  you: string;
  idea: string;
  position: string;
  listen: string;
  nade?: string;
  mistake: string;
}

/** Для карточек: тот же набор полей приходит из fixtures или опубликованного каталога. */
export type TacticPreview = Readonly<Pick<Tactic, "slug" | "title" | "side" | "teamSize" | "economy" | "difficulty" | "call">> & {
  readonly quick: readonly string[];
  readonly verified: boolean;
};

export function economyLabel(economy: Economy): string {
  return { eco: "Эко", force: "Форс", full: "Фулл бай", any: "Любая" }[economy];
}

export function teamLabel(size: TeamSize): string {
  return size === 3 ? "3 игрока" : `${size} игроков`;
}
