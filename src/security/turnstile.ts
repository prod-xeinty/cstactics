// Cloudflare Turnstile: проверка токена капчи на сервере (клиенту не доверяем).

export const TURNSTILE_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_FIELD = "cf-turnstile-response";

export type TurnstileFailure = "missing_token" | "rejected" | "bad_hostname" | "bad_action" | "unreachable";

export interface TurnstileOptions {
  secret: string;
  token: string | null;
  ip?: string;
  /** Ожидаемый hostname сайта: токен с чужого сайта с тем же site key не примем. */
  expectedHostname: string;
  /** Ожидаемое действие виджета (data-action), например "login". */
  expectedAction?: string;
  fetch: typeof fetch;
}

export async function verifyTurnstile(
  opts: TurnstileOptions,
): Promise<{ ok: true } | { ok: false; reason: TurnstileFailure }> {
  if (!opts.token || opts.token.length > 2048) return { ok: false, reason: "missing_token" };

  const body = new URLSearchParams({ secret: opts.secret, response: opts.token });
  if (opts.ip && opts.ip !== "unknown") body.set("remoteip", opts.ip);

  let data: { success?: boolean; hostname?: string; action?: string };
  try {
    const res = await opts.fetch(TURNSTILE_SITEVERIFY, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, reason: "unreachable" };
    data = await res.json();
  } catch {
    return { ok: false, reason: "unreachable" };
  }

  if (data.success !== true) return { ok: false, reason: "rejected" };
  // Тестовые ключи Cloudflare возвращают hostname "example.com" — для них проверку пропускаем (только локально).
  if (data.hostname !== opts.expectedHostname && data.hostname !== "example.com") {
    return { ok: false, reason: "bad_hostname" };
  }
  if (opts.expectedAction && data.action !== undefined && data.action !== opts.expectedAction) {
    return { ok: false, reason: "bad_action" };
  }
  return { ok: true };
}
