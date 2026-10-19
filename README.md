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
| `npm run db:migrate:local` | Применить SQL-миграции из `migrations/` к локальной D1 |

## Куда что класть

- `src/app/` — страницы и маршруты (Next App Router).
- `src/platform/` — интерфейсы платформы (`Database`, `ObjectStorage`). Бизнес-логика ходит в базу и хранилище только через них; Cloudflare-биндинги трогает один файл `cloudflare.ts`.
- `src/db/schema.ts` и `migrations/` — схема D1 (Drizzle) и SQL-миграции. Таблицы появятся в #11.

## Пробный деплой на Cloudflare

Нужен аккаунт Cloudflare и `npx wrangler login`. Один раз:

```bash
npx wrangler d1 create kollgg                          # в выводе будет database_id
npx wrangler r2 bucket create kollgg-media-private
npx wrangler r2 bucket create kollgg-media-public
```

Вставь `database_id` в `wrangler.jsonc` (сейчас там заглушка из нулей), потом:

```bash
npm run build:vinext
npm run deploy:vinext
```

После деплоя открой `https://kollgg.<твой-поддомен>.workers.dev/api/health` — должно быть `{"ok":true,...}`. Секреты на сервер — через `npx wrangler secret put ИМЯ`.
