// Ник и аватар игрока из Steam. С ключом — через Steam Web API, без ключа — из публичного XML профиля.
// Любая ошибка не ломает вход: в крайнем случае ник = SteamID64, аватара нет.

export interface SteamProfile {
  nickname: string;
  avatarUrl: string | null;
}

const TIMEOUT_MS = 4000;
const AVATAR_HOSTS = [".steamstatic.com", "steamcdn-a.akamaihd.net"];

export function cleanNickname(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  // Убираем управляющие символы, обрезаем. Экранирование при выводе — забота React.
  const cleaned = raw.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮]/g, "").trim();
  return cleaned.length > 0 ? Array.from(cleaned).slice(0, 64).join("") : fallback;
}

export function cleanAvatarUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const ok = AVATAR_HOSTS.some((h) => (h.startsWith(".") ? url.hostname.endsWith(h) : url.hostname === h));
    return ok ? url.toString() : null;
  } catch {
    return null;
  }
}

function xmlField(xml: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`).exec(xml);
  return m ? (m[1] ?? m[2]) : undefined;
}

export async function fetchSteamProfile(
  steamId64: string,
  opts: { apiKey?: string; fetch: typeof fetch },
): Promise<SteamProfile> {
  const fallback: SteamProfile = { nickname: steamId64, avatarUrl: null };
  try {
    if (opts.apiKey) {
      const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
      url.searchParams.set("key", opts.apiKey);
      url.searchParams.set("steamids", steamId64);
      const res = await opts.fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.ok) {
        const data = (await res.json()) as { response?: { players?: Array<Record<string, unknown>> } };
        const p = data.response?.players?.find((x) => x.steamid === steamId64);
        if (p) return { nickname: cleanNickname(p.personaname, steamId64), avatarUrl: cleanAvatarUrl(p.avatarfull) };
      }
    }
    const res = await opts.fetch(`https://steamcommunity.com/profiles/${steamId64}/?xml=1`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return fallback;
    const xml = await res.text();
    return {
      nickname: cleanNickname(xmlField(xml, "steamID"), steamId64),
      avatarUrl: cleanAvatarUrl(xmlField(xml, "avatarFull")),
    };
  } catch {
    return fallback;
  }
}
