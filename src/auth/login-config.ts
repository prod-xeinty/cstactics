import type { Platform } from "@/platform";

export type TurnstileConfig = { mode: "off" } | { mode: "on"; siteKey: string; secret: string } | { mode: "misconfigured" };

/**
 * Turnstile включается, когда задан публичный site key (wrangler.jsonc → vars).
 * Если site key есть, а secret нет — это ошибка настройки: вход закрываем, а не пропускаем без капчи.
 */
export function turnstileConfig(platform: Platform): TurnstileConfig {
  const siteKey = platform.publicVar("TURNSTILE_SITE_KEY");
  if (!siteKey) return { mode: "off" };
  const secret = platform.secret("TURNSTILE_SECRET_KEY");
  return secret ? { mode: "on", siteKey, secret } : { mode: "misconfigured" };
}
