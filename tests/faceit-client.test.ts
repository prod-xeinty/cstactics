import { describe, expect, it, vi } from "vitest";
import { lookupFaceitProfile } from "@/faceit/client";

const STEAM_ID = "76561199876410025";
const KEY = "test-server-key";

describe("FACEIT Data API", () => {
  it.each([
    [1, "low"], [3, "low"], [4, "mid"], [7, "mid"], [8, "high"], [10, "high"],
  ] as const)("относит уровень %i к шкале %s", async (level, band) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ games: { cs2: { skill_level: level, faceit_elo: 1750 } } }));
    const result = await lookupFaceitProfile(STEAM_ID, { apiKey: KEY, fetch: fetchMock });
    expect(result).toEqual({ status: "ready", level, elo: 1750, band });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`https://open.faceit.com/data/v4/players?game=cs2&game_player_id=${STEAM_ID}`);
    expect(options.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(options.cache).toBe("no-store");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("404 и профиль без CS2 означают отсутствие профиля для игры", async () => {
    const missing = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    expect(await lookupFaceitProfile(STEAM_ID, { apiKey: KEY, fetch: missing })).toEqual({ status: "not_found", band: "none" });
    const noCs2 = vi.fn().mockResolvedValue(Response.json({ games: { csgo: { skill_level: 5 } } }));
    expect(await lookupFaceitProfile(STEAM_ID, { apiKey: KEY, fetch: noCs2 })).toEqual({ status: "not_found", band: "none" });
  });

  it("не считает неполные данные игрока отсутствием FACEIT", async () => {
    for (const body of [
      { games: { cs2: { skill_level: 0, faceit_elo: 1750 } } },
      { games: { cs2: { skill_level: 5 } } },
      { games: { cs2: { skill_level: 5, faceit_elo: "1750" } } },
    ]) {
      const fetchMock = vi.fn().mockResolvedValue(Response.json(body));
      expect(await lookupFaceitProfile(STEAM_ID, { apiKey: KEY, fetch: fetchMock })).toEqual({ status: "unavailable" });
    }
  });

  it("не отправляет запрос без ключа или с некорректным Steam ID", async () => {
    const fetchMock = vi.fn();
    expect(await lookupFaceitProfile(STEAM_ID, { fetch: fetchMock })).toEqual({ status: "unavailable" });
    expect(await lookupFaceitProfile("bad", { apiKey: KEY, fetch: fetchMock })).toEqual({ status: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ошибки FACEIT и сети не превращает в шкалу без FACEIT", async () => {
    for (const status of [401, 403, 429, 503]) {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }));
      expect(await lookupFaceitProfile(STEAM_ID, { apiKey: KEY, fetch: fetchMock })).toEqual({ status: "unavailable" });
    }
    const failed = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await lookupFaceitProfile(STEAM_ID, { apiKey: KEY, fetch: failed })).toEqual({ status: "unavailable" });
  });
});
