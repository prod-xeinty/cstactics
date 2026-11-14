// FACEIT Data API. Ответ живёт только во время запроса: срок допустимого кеширования не подтверждён.
export type FaceitBand = "low" | "mid" | "high" | "none";

export type FaceitLookup =
  | { status: "ready"; level: number; elo: number; band: Exclude<FaceitBand, "none"> }
  | { status: "not_found"; band: "none" }
  | { status: "unavailable" };

const STEAM_ID64 = /^\d{17}$/;
const TIMEOUT_MS = 4000;

function bandForLevel(level: number): Exclude<FaceitBand, "none"> {
  if (level <= 3) return "low";
  if (level <= 7) return "mid";
  return "high";
}

export async function lookupFaceitProfile(
  steamId64: string,
  opts: { apiKey?: string; fetch: typeof fetch },
): Promise<FaceitLookup> {
  if (!opts.apiKey || !STEAM_ID64.test(steamId64)) return { status: "unavailable" };

  const url = new URL("https://open.faceit.com/data/v4/players");
  url.searchParams.set("game", "cs2");
  url.searchParams.set("game_player_id", steamId64);

  try {
    const response = await opts.fetch(url, {
      headers: { Authorization: `Bearer ${opts.apiKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 404) return { status: "not_found", band: "none" };
    if (!response.ok) return { status: "unavailable" };

    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("games" in data)) return { status: "unavailable" };
    const games = data.games;
    if (!games || typeof games !== "object") return { status: "unavailable" };
    if (!("cs2" in games)) return { status: "not_found", band: "none" };
    const cs2 = games.cs2;
    if (!cs2 || typeof cs2 !== "object" || !("skill_level" in cs2) || !("faceit_elo" in cs2)) {
      return { status: "unavailable" };
    }
    const level = cs2.skill_level;
    const elo = cs2.faceit_elo;
    if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > 10 ||
        typeof elo !== "number" || !Number.isInteger(elo) || elo < 0) {
      return { status: "unavailable" };
    }
    return { status: "ready", level, elo, band: bandForLevel(level) };
  } catch {
    return { status: "unavailable" };
  }
}
