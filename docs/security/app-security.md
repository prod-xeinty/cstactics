# Защита приложения (#24)

Что защищает запросы к сайту и как это подключать в новых маршрутах (голоса #13, анкета #7, модерация #14).

## Слои

| Что | Где | Как работает |
|---|---|---|
| Защитные заголовки | `src/security/headers.ts`, вешаются в `worker/index.ts` | CSP, HSTS, nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, COOP — на каждый ответ воркера |
| CSRF | `src/security/csrf.ts` | 1) Origin / `Sec-Fetch-Site` = наш сайт; 2) для залогиненного — CSRF-токен = SHA-256(`csrf:v1:` + токен сессии) в поле формы `csrf` или заголовке `x-csrf-token` |
| Лимиты запросов | `src/security/rate-limit.ts` → `Platform.rateLimiter` → Durable Object `RateLimiterObject` | фиксированное окно на ключ `правило:субъект`, один DO на ключ, счётчик только в памяти |
| Капча | `src/security/turnstile.ts`, `src/auth/login-config.ts` | Cloudflare Turnstile, токен проверяется **на сервере** (`siteverify`), сверяются hostname и action |
| Запрет HTML из строк | `eslint.config.js` | `dangerouslySetInnerHTML` — ошибка линтера |

## Правила для нового изменяющего маршрута (POST/PUT/PATCH/DELETE)

```ts
if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
const platform = await getPlatform();
const limited = await enforceRateLimit(platform.rateLimiter, "vote", user.id); // правило — в RATE_LIMITS
if (limited) return limited;
if (!(await isValidCsrfToken(sessionToken, await submittedCsrfToken(request)))) {
  return new Response("Forbidden", { status: 403 });
}
// + Turnstile, если форма публичная (анкета): verifyTurnstile({ ..., expectedAction: "submit" })
```

GET ничего не меняет. В форму залогиненного кладём `<input type="hidden" name="csrf" value={await csrfTokenFor(sessionToken)} />`.

## Лимиты сейчас

| Правило | Субъект | Лимит |
|---|---|---|
| `loginStart` | IP | 10 / мин |
| `loginCallback` | IP | 10 / мин |
| `logout` | IP | 30 / мин |

IP — из `CF-Connecting-IP` (ставит Cloudflare). Если Durable Object недоступен, запрос **пропускаем** и пишем в лог (fail-open): лучше пропустить спам, чем уронить вход всем. Для голосов и анкеты можно выбрать fail-closed.

Бесплатный тариф Durable Objects: 100 000 запросов в сутки (каждый лимитируемый запрос = 1 запрос к DO). В хранилище DO не пишем — там всего 100 000 записей в сутки.

## Turnstile

- **Выключен**, пока в `wrangler.jsonc` → `vars.TURNSTILE_SITE_KEY` пусто. `/api/health` показывает `"turnstile": "off"`.
- **Включён**: site key задан и есть секрет `TURNSTILE_SECRET_KEY` (`npx wrangler secret put TURNSTILE_SECRET_KEY`).
- **Ошибка настройки**: site key есть, секрета нет → вход закрыт («временно не работает»), `/api/health` → `"turnstile": "fail"`. Специально: без капчи не пускаем, раз её включили.
- Локально — тестовые ключи Cloudflare в `.dev.vars`: site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA` (всегда «да») или `2x0000000000000000000000000000000AA` (всегда «нет»).

Вход: `/login` (форма + виджет) → `POST /api/auth/steam/login` (Origin, лимит, Turnstile) → Steam → `/api/auth/steam/callback` (лимит, state, подпись Steam). Старые ссылки `GET /api/auth/steam/login` перенаправляются на `/login`.

## CSP: что ещё не строго

`script-src` в боевой CSP содержит `'unsafe-inline'`: vinext встраивает в HTML скрипты без nonce. Строгий вариант (`script-src 'self' https://challenges.cloudflare.com`) отправляется как `Content-Security-Policy-Report-Only` — браузер сообщает о нарушениях в консоли, но не блокирует. Когда vinext научится nonce — переносим в боевую CSP.

Заголовки ставит только воркер: под обычным `next dev` их нет.
