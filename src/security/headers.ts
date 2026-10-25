// Защитные заголовки на все ответы воркера (вешаются в worker/index.ts).

const TURNSTILE = "https://challenges.cloudflare.com";
const STEAM_LOGIN = "https://steamcommunity.com";
const STEAM_AVATARS = "https://avatars.steamstatic.com https://*.steamstatic.com";

/**
 * Боевая CSP. В script-src пока 'unsafe-inline': vinext вставляет в HTML встроенные скрипты без nonce.
 * Строгая версия скриптов — в Report-Only ниже; когда vinext научится nonce, переносим её сюда.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${TURNSTILE}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: ${STEAM_AVATARS}`,
  "font-src 'self'",
  "connect-src 'self'",
  `frame-src ${TURNSTILE}`,
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  // После POST формы входа идёт редирект в Steam — form-action проверяет и его.
  `form-action 'self' ${STEAM_LOGIN}`,
].join("; ");

export const CONTENT_SECURITY_POLICY_REPORT_ONLY = `script-src 'self' ${TURNSTILE}; object-src 'none'; base-uri 'none'`;

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "Content-Security-Policy-Report-Only": CONTENT_SECURITY_POLICY_REPORT_ONLY,
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

/** Новый Response с защитными заголовками. Уже выставленные приложением не перетираем. */
export function withSecurityHeaders(response: Response): Response {
  const res = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!res.headers.has(name)) res.headers.set(name, value);
  }
  return res;
}
