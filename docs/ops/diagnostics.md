# Диагностика: где смотреть и что делать при сбое

Коротко: **`/api/health` → логи Workers по ID запроса → таблица частых поломок ниже.**

## 1. Быстрая проверка

`https://kollgg.kollgg-probe-test.workers.dev/api/health`

| Поле | `ok` | Если не `ok` |
|---|---|---|
| `checks.db` | база D1 отвечает | см. «База» ниже |
| `checks.rate_limiter` | Durable Object лимитов отвечает (проверка раз в 30 с) | лимиты сейчас не работают (запросы пропускаются) — см. «Лимиты» |
| `checks.media_*` | `skipped` — R2 пока не подключён (#12), это нормально | — |
| `checks.turnstile` | есть только при ошибке настройки | задан site key без секрета — вход закрыт |
| `turnstile` | `off` / `on` / `misconfigured` | — |

Код ответа: `200` — всё ок, `503` — что-то из `checks` в `fail`.

## 2. Найти ошибку по коду

На каждом ответе есть заголовок **`X-Request-Id`**, на странице «Что-то сломалось» — **код ошибки**. Это `cf-ray` Cloudflare (локально — случайный UUID).

**Панель Cloudflare** → Workers & Pages → `kollgg` → **Logs** (Workers Logs):
- поиск по `requestId` = код из страницы ошибки — наши записи;
- `event = request` — запись о каждом запросе (метод, путь, статус, время в мс);
- фильтр `level = error` — все ошибки за период; `event = server_error` — ответы 5xx.

Хранение — **3 дня**, до 200 000 записей в сутки (бесплатный тариф). Старше — не найти.

**В реальном времени** (в папке проекта): `npx wrangler tail kollgg` — поток логов, пока окно открыто.

### Наши события (`event`)

| Событие | Уровень | Что значит |
|---|---|---|
| `request` | info | каждый запрос: метод, путь, статус, `ms` |
| `server_error` | error | ответ 5xx (путь, статус) |
| `unhandled_error` | error | исключение вылетело мимо vinext |
| `session_lookup_failed` | error | не удалось проверить сессию (база не отвечает / нет таблиц) — игрок видит «не вошёл» |
| `steam_login_error` | error | внутренняя ошибка на возврате из Steam |
| `steam_login_failed` | warn | вход не прошёл проверку (`reason`: `bad_state`, `steam_rejected`, `replayed_nonce`…) |
| `turnstile_failed` | warn | капча не прошла (`reason`) |
| `turnstile_misconfigured` | error | site key без секрета |
| `rate_limited` | warn | сработал лимит (`rule`), пишется один раз на окно |
| `rate_limiter_unavailable` | error | Durable Object не ответил — лимиты пропускают (fail-open) |

### Что в логи не попадает
**Гарантия только для записей через `log.*`** (`src/observability/log.ts`): скрываются поля с cookie, токенами, секретами, CSRF, Steam ID, IP (в т.ч. `x-forwarded-for`), email, ником и аватаром Steam, user-agent; в тексте вычищаются Steam ID (`7656119…`, `STEAM_0:…`, `[U:1:…]`), IPv4/IPv6, параметры URL (и в относительных путях), длинные токеноподобные строки.

Правила:
- **не логируй объекты целиком** (запрос, заголовки, пользователя) — только нужные поля через `log.*`;
- **не клади данные игрока в текст ошибки** (`throw new Error(...)`): vinext сам пишет ошибки рендера через `console.error` со стеком, мимо нашей вычистки;
- встроенные записи Cloudflare о запросах **выключены** (`invocation_logs: false`): не проверено, что в них нет cookie и IP. Включать только после проверки на проде (см. ниже).

### Проверка после деплоя (один раз)
1. Открыть сайт, войти, затем зайти на `/api/health?x=1`.
2. Панель → Logs: убедиться, что в записях `request` нет `?x=1`, cookie, IP и Steam ID.
3. Если захотим встроенные записи: включить `invocation_logs: true` на время, повторить шаги 1–2 и посмотреть поля `$workers.event.request.*`. Есть cookie — выключить обратно; есть IP или гео — записать в вопрос по 152-ФЗ (#27).

## 3. Частые поломки

| Симптом | Причина | Что делать |
|---|---|---|
| 500 / «не вышло зайти», в логах `no such table` | не применена миграция | `npm run db:migrate:remote` → `y` |
| `checks.db: fail` | неверный `database_id` или база удалена | `npx wrangler d1 list`, сверить с `wrangler.jsonc` |
| `checks.rate_limiter: fail` | нет биндинга `RATE_LIMITER` / не применилась миграция DO | проверить `durable_objects` и `migrations` в `wrangler.jsonc`, задеплоить заново |
| `turnstile: misconfigured` | site key есть, секрета нет | `npx wrangler secret put TURNSTILE_SECRET_KEY` |
| `ERR_SSL_…` / не открывается только из РФ | ограничения провайдера на Cloudflare | проверить с мобильного интернета / VPN; это риск #20, не ошибка деплоя |
| ошибки `exceeded … free tier daily … limit` | кончился суточный лимит | ждать 03:00 МСК; см. «Лимиты» |

## 4. Лимиты

Бесплатный тариф, **на весь аккаунт** (пробная страница `kollgg-probe` тоже считается), сброс в 00:00 UTC = 03:00 МСК:

| Что | В сутки |
|---|---|
| Workers: запросы | 100 000 |
| D1: прочитано строк | 5 000 000 |
| D1: записано строк | 100 000 |
| Durable Objects: запросы | 100 000 |
| Workers Logs: записи | 200 000 |

При превышении операции этого типа **падают с ошибкой**, денег не списывают (карты нет).

Предупреждение: workflow **«Лимиты Cloudflare»** (`.github/workflows/usage-check.yml`) каждые 6 часов спрашивает расход через Cloudflare GraphQL Analytics и при **≥ 70%** открывает issue «Лимиты Cloudflare: …» на sK8le (GitHub пришлёт письмо); если issue уже открыт — дописывает комментарий. Таблица расхода — в Summary каждого прогона.

### Настройка (один раз)
1. **sK8le:** Cloudflare → My Profile → API Tokens → Create Token → Custom token: **только** право **Account → Account Analytics → Read**, ресурс — свой аккаунт. Это **отдельный** токен: не тот, что будет для деплоя (у задачи по расписанию не должно быть прав менять воркер). Account ID — на главной панели Cloudflare справа (или `npx wrangler whoami`).
2. **prod-xeinty (нужен Admin репо):** GitHub → Settings → Secrets and variables → Actions → New repository secret: `CF_ANALYTICS_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
3. Actions → «Лимиты Cloudflare» → **Run workflow**. Должна появиться таблица расхода. Если упало с `Cloudflare GraphQL: …` — неверное право токена или поле запроса: пришлите текст ошибки.

Пока секретов нет, workflow не падает, а пишет «не настроено». Issue ищется только среди созданных самим workflow (`github-actions[bot]`): чужой issue с тем же названием тревогу не перехватит. Ошибка GitHub API → прогон красный (письмо о падении), а не тихий пропуск.

R2 и Queues в проверке появятся вместе с ними (#12, фоновые задачи).

## 5. Бэкапы и откат данных

Time Travel (7 дней) и ежедневный зашифрованный бэкап — [backup-restore.md](backup-restore.md).

## 6. Если сайт лёг совсем

1. `/api/health` не открывается вообще → `npx wrangler deployments list` (что задеплоено), `npx wrangler tail kollgg` и открыть сайт — смотреть ошибку.
2. Сломал последний деплой → `npx wrangler rollback` (откат на предыдущую версию).
3. Не открывается только у части людей из РФ → см. #20.
