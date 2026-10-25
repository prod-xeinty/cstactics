import { currentRequestId } from "./context";

// Структурированные логи: одна запись = один JSON-объект (Workers Logs индексирует его поля).
// Правило: в логи не попадают секреты, cookie, токены, Steam ID, IP и параметры запросов.
// Поэтому всё, что логируем, проходит через redact().

export type LogLevel = "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const HIDDEN = "[скрыто]";
const MAX_STRING = 500;
const MAX_DEPTH = 4;

// Ключи, значения которых никогда не пишем.
const SENSITIVE_KEY =
  /(cookie|token|secret|password|passwd|authorization|auth|session|csrf|apikey|api_key|private|signature|sig$|nonce|steam|openid|claimed|identity|ip$|^ip|forwarded|real-ip|email|phone|nick|persona|avatar|user-?agent)/i;

// Steam ID внутри любых строк (например, в тексте ошибки): SteamID64, STEAM_0:1:123, [U:1:123].
const STEAM_ID = /7656119\d{10}|STEAM_[0-5]:[01]:\d+|\[U:1:\d+\]/g;
// IP-адреса внутри строк.
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IPV6 = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}\b/gi;
// Длинные токеноподобные строки (base64url / hex) внутри текста.
const TOKENISH = /\b[A-Za-z0-9_-]{32,}\b/g;

function scrubString(value: string): string {
  let s = value;
  // URL: оставляем только путь.
  s = s.replace(/\bhttps?:\/\/[^\s"'<>]+/g, (url) => {
    try {
      const u = new URL(url);
      return `${u.origin}${u.pathname}`;
    } catch {
      return "[url]";
    }
  });
  // Относительные пути тоже без параметров: /api/x?state=… → /api/x
  s = s.replace(/(^|[\s"'(])(\/[^\s?"'<>]*)\?[^\s"'<>)]*/g, "$1$2");
  s = s.replace(STEAM_ID, "[steamid]").replace(IPV4, "[ip]").replace(IPV6, "[ip]").replace(TOKENISH, "[token]");
  return s.length > MAX_STRING ? `${s.slice(0, MAX_STRING)}…` : s;
}

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) return { name: value.name, message: scrubString(value.message) };
  if (depth >= MAX_DEPTH) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? HIDDEN : redact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function write(level: LogLevel, event: string, fields: LogFields = {}): void {
  // Логгер никогда не роняет запрос: даже если в полях объект, который бросает при чтении.
  let record: Record<string, unknown>;
  try {
    record = { level, event, requestId: currentRequestId(), ...(redact(fields) as LogFields) };
  } catch {
    record = { level, event, requestId: currentRequestId(), logError: "поля не удалось записать" };
  }
  try {
    // Объект, а не строка: так Workers Logs разбирает поля и по ним можно фильтровать.
    if (level === "error") console.error(record);
    else if (level === "warn") console.warn(record);
    else console.log(record);
  } catch {
    // писать некуда — молчим
  }
}

export const log = {
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields),
};
