# КОЛЛ.GG (рабочее название)

Сайт с тактиками для CS2: готовые раунды от «заколил во фризтайме» до полного разбора гранат, клатч-ситуации и оценки тактик по уровням FACEIT. Сейчас — только Dust2.

- `AGENTS.md` — весь контекст проекта: решения, экраны, шаблон тактики, словарик Dust2, модель данных, правила для AI-агентов. **Читать первым.**
- `CLAUDE.md` — подключает `AGENTS.md` для Claude.
- `design/prototype-main.dc.html` — исходник кликабельного прототипа (референс для вёрстки).
- `.env.example` — какие секреты понадобятся. Реальные значения — только в `.dev.vars` / Workers Secrets, в git не коммитим.

## Запуск

Нужен Node 22+.

```bash
npm install
npm run dev:vinext      # http://localhost:3001 — Workers-рантайм, локальные D1 и R2
```

Проверка, что база и хранилище видны: открой `http://localhost:3001/api/health`, должно быть `{"ok":true,...}`.

| Команда | Что делает |
|---|---|
| `npm run dev:vinext` | Основной режим разработки (vinext на Workers-рантайме с локальными D1/R2) |
| `npm run dev` | Обычный `next dev` на :3000. Страницы работают, `/api/health` отвечает 503: биндингов Cloudflare тут нет |
| `npm run build:vinext` | Продакшн-сборка в `dist/` |
| `npm run start:vinext` | Собранный воркер локально через Wrangler (после `build:vinext`) |
| `npm run typecheck` | Проверка типов |
| `npm run cf-typegen` | Перегенерировать типы биндингов `worker-configuration.d.ts` (в git не лежит, создаётся при `npm install`; запускай после правок `wrangler.jsonc`) |
| `npm test` | Тесты (Vitest) |
| `npm run db:generate` | Сгенерировать SQL-миграцию из `src/db/schema.ts` |
| `npm run db:migrate:local` | Применить SQL-миграции из `migrations/` к локальной D1 |
| `npm run db:migrate:remote` | Применить миграции к боевой D1 (перед деплоем, если появились новые) |

Перед первым запуском `dev:vinext` примени миграции к локальной базе: `npm run db:migrate:local`.

## Вход через Steam

- `/api/auth/steam/login` → Steam → `/api/auth/steam/callback` → сессия в cookie `__Host-session` (в базе только SHA-256 токена), живёт 30 дней.
- `/api/auth/me` — кто вошёл, `POST /api/auth/logout` — выход (только со своего сайта).
- Ответ Steam проверяем у самого Steam (`check_authentication`), плюс `return_to`, `claimed_id`, одноразовый `response_nonce`.
- Ник и аватар: с секретом `STEAM_API_KEY` — через Steam Web API, без него — из публичного профиля.

## Куда что класть

- `src/app/` — страницы и маршруты (Next App Router).
- `src/platform/` — интерфейсы платформы (`Database`, `ObjectStorage`). Бизнес-логика ходит в базу и хранилище только через них; Cloudflare-биндинги трогает один файл `cloudflare.ts`.
- `src/auth/`, `src/users/` — вход через Steam и сессии.
- `src/db/schema.ts` и `migrations/` — схема D1 (Drizzle) и SQL-миграции. Сейчас там `users`, `sessions`, `openid_nonces`; остальное — #11.
- `tests/` — тесты; база в тестах — встроенный SQLite из Node с настоящими миграциями.

## Пробный деплой на Cloudflare

Нужен аккаунт Cloudflare и `npx wrangler login`. Один раз (на вопрос «добавить в конфиг?» отвечай **нет**):

```bash
npx wrangler d1 create kollgg                          # в выводе будет database_id
```

Вставь `database_id` в `wrangler.jsonc`, потом:

```bash
npm run build:vinext
npm run deploy:vinext
```

После деплоя открой `https://kollgg.<твой-поддомен>.workers.dev/api/health` — должно быть `{"ok":true,...}`.

**R2 пока отключён**: для него нужна платёжная карта на аккаунте Cloudflare. Бакеты закомментированы в `wrangler.jsonc`, в `/api/health` они показываются как `skipped`. Когда дойдём до загрузки видео (#12): включить R2 в панели, создать бакеты `kollgg-media-private` и `kollgg-media-public`, раскомментировать `r2_buckets`, запустить `npm run cf-typegen`. Секреты на сервер — через `npx wrangler secret put ИМЯ`.
