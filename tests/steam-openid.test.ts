import { describe, expect, it, vi } from "vitest";
import { buildSteamLoginUrl, STEAM_OP_ENDPOINT, verifySteamResponse } from "@/auth/steam-openid";

const RETURN_TO = "https://kollgg.test/api/auth/steam/callback?state=abc";
const NOW = new Date("2026-10-20T19:00:00Z");
const STEAM_ID = "76561198000000001";

function steamParams(over: Record<string, string> = {}): URLSearchParams {
  const p = new URLSearchParams({
    state: "abc",
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": STEAM_OP_ENDPOINT,
    "openid.claimed_id": `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    "openid.identity": `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    "openid.return_to": RETURN_TO,
    "openid.response_nonce": "2026-10-20T18:59:30Zqwerty",
    "openid.assoc_handle": "1234567890",
    "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "c2lnbmF0dXJl",
  });
  for (const [k, v] of Object.entries(over)) p.set(k, v);
  return p;
}

function steamSays(isValid: boolean) {
  return vi.fn(async () => new Response(`ns:http://specs.openid.net/auth/2.0\nis_valid:${isValid}\n`));
}

function opts(fetchImpl: ReturnType<typeof vi.fn>, claim = vi.fn(async () => true)) {
  return { expectedReturnTo: RETURN_TO, now: NOW, fetch: fetchImpl as unknown as typeof fetch, claimNonce: claim };
}

describe("buildSteamLoginUrl", () => {
  it("ведёт на Steam с нашим return_to", () => {
    const url = new URL(buildSteamLoginUrl(RETURN_TO, "https://kollgg.test"));
    expect(url.origin + url.pathname).toBe(STEAM_OP_ENDPOINT);
    expect(url.searchParams.get("openid.return_to")).toBe(RETURN_TO);
    expect(url.searchParams.get("openid.mode")).toBe("checkid_setup");
  });
});

describe("verifySteamResponse", () => {
  it("пускает настоящий ответ и спрашивает Steam через check_authentication", async () => {
    const f = steamSays(true);
    const res = await verifySteamResponse(steamParams(), opts(f));
    expect(res).toEqual({ ok: true, steamId64: STEAM_ID });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const sent = new URLSearchParams(String(init.body));
    expect(sent.get("openid.mode")).toBe("check_authentication");
    expect(sent.get("openid.sig")).toBe("c2lnbmF0dXJl");
    expect(sent.has("state")).toBe(false);
  });

  it("не пускает, если Steam не подтвердил подпись", async () => {
    expect(await verifySteamResponse(steamParams(), opts(steamSays(false)))).toEqual({
      ok: false,
      reason: "steam_rejected",
    });
  });

  it("не пускает, если Steam недоступен", async () => {
    const f = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await verifySteamResponse(steamParams(), opts(f))).toEqual({ ok: false, reason: "steam_unreachable" });
  });

  it("не пускает чужой return_to (открытый редирект / подмена сайта)", async () => {
    const p = steamParams({ "openid.return_to": "https://evil.test/api/auth/steam/callback?state=abc" });
    const f = steamSays(true);
    expect(await verifySteamResponse(p, opts(f))).toEqual({ ok: false, reason: "bad_return_to" });
    expect(f).not.toHaveBeenCalled();
  });

  it("не пускает подменённый op_endpoint", async () => {
    const p = steamParams({ "openid.op_endpoint": "https://evil.test/openid/login" });
    expect(await verifySteamResponse(p, opts(steamSays(true)))).toEqual({ ok: false, reason: "bad_op_endpoint" });
  });

  it.each([
    ["чужой домен", "https://evil.test/openid/id/76561198000000001"],
    ["http вместо https", "http://steamcommunity.com/openid/id/76561198000000001"],
    ["не 17 цифр", "https://steamcommunity.com/openid/id/123"],
    ["хвост после id", "https://steamcommunity.com/openid/id/76561198000000001/x"],
  ])("не пускает кривой claimed_id: %s", async (_name, claimed) => {
    const p = steamParams({ "openid.claimed_id": claimed, "openid.identity": claimed });
    expect(await verifySteamResponse(p, opts(steamSays(true)))).toEqual({ ok: false, reason: "bad_claimed_id" });
  });

  it("не пускает, если identity не совпадает с claimed_id", async () => {
    const p = steamParams({ "openid.identity": "https://steamcommunity.com/openid/id/76561198000000002" });
    expect(await verifySteamResponse(p, opts(steamSays(true)))).toEqual({ ok: false, reason: "bad_claimed_id" });
  });

  it("не пускает, если важные поля не подписаны", async () => {
    const p = steamParams({ "openid.signed": "signed,op_endpoint,claimed_id,identity" });
    expect(await verifySteamResponse(p, opts(steamSays(true)))).toEqual({ ok: false, reason: "unsigned_fields" });
  });

  it("не пускает старый nonce", async () => {
    const p = steamParams({ "openid.response_nonce": "2026-10-20T18:40:00Zold" });
    expect(await verifySteamResponse(p, opts(steamSays(true)))).toEqual({ ok: false, reason: "stale_nonce" });
  });

  it("не пускает повтор того же ответа (nonce уже был)", async () => {
    const claim = vi.fn(async () => false);
    expect(await verifySteamResponse(steamParams(), opts(steamSays(true), claim))).toEqual({
      ok: false,
      reason: "replayed_nonce",
    });
  });

  it("не трогает таблицу nonce, пока Steam не подтвердил подпись", async () => {
    const claim = vi.fn(async () => true);
    await verifySteamResponse(steamParams(), opts(steamSays(false), claim));
    expect(claim).not.toHaveBeenCalled();
  });

  it("не пускает cancel (игрок отменил вход)", async () => {
    const p = steamParams({ "openid.mode": "cancel" });
    expect(await verifySteamResponse(p, opts(steamSays(true)))).toEqual({ ok: false, reason: "not_id_res" });
  });
});
