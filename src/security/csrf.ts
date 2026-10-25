import { sha256Hex } from "@/auth/crypto";

// Защита от CSRF в два слоя:
// 1) запрос пришёл с нашего сайта (Origin или Sec-Fetch-Site);
// 2) для залогиненного — CSRF-токен в форме/заголовке, выведенный из токена сессии.
//    Токен сессии лежит в HttpOnly-cookie, чужая страница его не знает и не может посчитать CSRF-токен.
//    Обратно из CSRF-токена токен сессии не восстановить (SHA-256), поэтому показывать его в HTML безопасно.

export const CSRF_FIELD = "csrf";
export const CSRF_HEADER = "x-csrf-token";

export function isSameOrigin(request: Request): boolean {
  const origin = new URL(request.url).origin;
  const fromOrigin = request.headers.get("origin");
  if (fromOrigin !== null) return fromOrigin === origin;
  // Origin бывает пустым (старые браузеры, некоторые редиректы) — тогда верим Sec-Fetch-Site.
  return request.headers.get("sec-fetch-site") === "same-origin";
}

export async function csrfTokenFor(sessionToken: string): Promise<string> {
  return sha256Hex(`csrf:v1:${sessionToken}`);
}

export async function isValidCsrfToken(sessionToken: string | undefined, submitted: string | null): Promise<boolean> {
  if (!sessionToken || !submitted || submitted.length > 128) return false;
  const expected = await csrfTokenFor(sessionToken);
  // Длины всегда равны (hex SHA-256), сравниваем без раннего выхода.
  let diff = expected.length ^ submitted.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (submitted.charCodeAt(i) || 0);
  return diff === 0;
}

/** CSRF-токен из заголовка или из поля формы (тело читаем с клона, чтобы обработчик мог прочитать его сам). */
export async function submittedCsrfToken(request: Request): Promise<string | null> {
  const header = request.headers.get(CSRF_HEADER);
  if (header) return header;
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await request.clone().formData();
    const v = form.get(CSRF_FIELD);
    return typeof v === "string" ? v : null;
  }
  return null;
}
