// Cloudflare Turnstile: проверка токена капчи на сервере (клиенту не доверяем).

export const TURNSTILE_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_FIELD = "cf-turnstile-response";

export type TurnstileFailure =
  | "missing_token"
  | "rejected"
  | "bad_hostname"
  | "bad_action"
  | "unreachable"
  | "test_key_outside_localhost";

// Тестовые секреты Cloudflare: всегда «да» / всегда «нет» / «токен уже использован».
const TEST_SECRET_RE = /^[123]x0{31}AA$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isTurnstileTestSecret(secret: string): boolean {
  return TEST_SECRET_RE.test(secret);
}

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
  const testSecret = isTurnstileTestSecret(opts.secret);
  // Тестовый секрет пропускает любой токен — допускаем его только на localhost, иначе капча была бы фикцией.
  if (testSecret && !LOCAL_HOSTS.has(opts.expectedHostname)) return { ok: false, reason: "test_key_outside_localhost" };

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
  // Тестовые ключи отвечают hostname "example.com" — принимаем это только с тестовым секретом (а он — только на localhost).
  const hostnameOk = data.hostname === opts.expectedHostname || (testSecret && data.hostname === "example.com");
  if (!hostnameOk) return { ok: false, reason: "bad_hostname" };
  // С тестовым секретом action в ответе пустой; с боевым — требуем строгого совпадения.
  if (opts.expectedAction && !testSecret && data.action !== opts.expectedAction) {
    return { ok: false, reason: "bad_action" };
  }
  return { ok: true };
}
