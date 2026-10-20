// Вход через Steam: OpenID 2.0. Steam не выдаёт подписанных токенов, которые можно проверить локально,
// поэтому подлинность ответа подтверждаем у самого Steam запросом check_authentication.

export const STEAM_OP_ENDPOINT = "https://steamcommunity.com/openid/login";
const OPENID_NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";
// SteamID64 обычного аккаунта: 7656119 + 10 цифр.
const CLAIMED_ID_RE = /^https:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/;
const NONCE_TIME_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/;
const REQUIRED_SIGNED = ["op_endpoint", "claimed_id", "identity", "return_to", "response_nonce", "assoc_handle"];

const NONCE_MAX_AGE_MS = 5 * 60 * 1000;
const NONCE_MAX_SKEW_MS = 60 * 1000;
const CHECK_TIMEOUT_MS = 5000;

export function buildSteamLoginUrl(returnTo: string, realm: string): string {
  const url = new URL(STEAM_OP_ENDPOINT);
  url.searchParams.set("openid.ns", OPENID_NS);
  url.searchParams.set("openid.mode", "checkid_setup");
  url.searchParams.set("openid.return_to", returnTo);
  url.searchParams.set("openid.realm", realm);
  url.searchParams.set("openid.identity", IDENTIFIER_SELECT);
  url.searchParams.set("openid.claimed_id", IDENTIFIER_SELECT);
  return url.toString();
}

export type VerifyFailure =
  | "not_id_res"
  | "bad_ns"
  | "bad_op_endpoint"
  | "bad_return_to"
  | "bad_claimed_id"
  | "unsigned_fields"
  | "bad_nonce"
  | "stale_nonce"
  | "steam_rejected"
  | "steam_unreachable"
  | "replayed_nonce";

export type VerifyResult = { ok: true; steamId64: string } | { ok: false; reason: VerifyFailure };

export interface VerifyOptions {
  /** Ровно тот return_to, который мы отправляли в Steam. */
  expectedReturnTo: string;
  now: Date;
  fetch: typeof fetch;
  /** Атомарно запомнить nonce. false — такой уже был (повтор ответа). */
  claimNonce: (nonce: string, expiresAt: Date) => Promise<boolean>;
}

export async function verifySteamResponse(params: URLSearchParams, opts: VerifyOptions): Promise<VerifyResult> {
  const get = (k: string) => params.get(`openid.${k}`);

  if (get("mode") !== "id_res") return { ok: false, reason: "not_id_res" };
  if (get("ns") !== OPENID_NS) return { ok: false, reason: "bad_ns" };
  if (get("op_endpoint") !== STEAM_OP_ENDPOINT) return { ok: false, reason: "bad_op_endpoint" };
  if (get("return_to") !== opts.expectedReturnTo) return { ok: false, reason: "bad_return_to" };

  const claimed = get("claimed_id") ?? "";
  const match = CLAIMED_ID_RE.exec(claimed);
  if (!match || get("identity") !== claimed) return { ok: false, reason: "bad_claimed_id" };

  const signed = new Set((get("signed") ?? "").split(","));
  if (!REQUIRED_SIGNED.every((f) => signed.has(f)) || !get("sig")) {
    return { ok: false, reason: "unsigned_fields" };
  }

  const nonce = get("response_nonce") ?? "";
  const nonceTime = NONCE_TIME_RE.exec(nonce);
  if (!nonceTime || nonce.length > 255) return { ok: false, reason: "bad_nonce" };
  const issuedAt = Date.parse(nonceTime[1]);
  const age = opts.now.getTime() - issuedAt;
  if (Number.isNaN(issuedAt) || age > NONCE_MAX_AGE_MS || age < -NONCE_MAX_SKEW_MS) {
    return { ok: false, reason: "stale_nonce" };
  }

  // Спрашиваем Steam, подписывал ли он этот ответ. Отправляем все openid.* как есть, меняем только mode.
  const body = new URLSearchParams();
  for (const [k, v] of params) if (k.startsWith("openid.")) body.set(k, v);
  body.set("openid.mode", "check_authentication");

  let text: string;
  try {
    const res = await opts.fetch(STEAM_OP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, reason: "steam_unreachable" };
    text = await res.text();
  } catch {
    return { ok: false, reason: "steam_unreachable" };
  }
  const isValid = text.split("\n").some((line) => line.trim() === "is_valid:true");
  if (!isValid) return { ok: false, reason: "steam_rejected" };

  // nonce запоминаем только после проверки подписи, чтобы мусорные запросы не забивали таблицу.
  const fresh = await opts.claimNonce(nonce, new Date(issuedAt + NONCE_MAX_AGE_MS));
  if (!fresh) return { ok: false, reason: "replayed_nonce" };

  return { ok: true, steamId64: match[1] };
}
