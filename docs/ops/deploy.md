# Деплой

## Автоматически (после настройки)

Workflow **«Деплой»** (`.github/workflows/deploy.yml`):

1. срабатывает, когда **CI зелёный на пуше в `main`** (то есть после мержа PR), — или вручную **с ветки `main`**: Actions → «Деплой» → Run workflow;
2. деплоит **только последний `main`** и только если на нём зелёная проверка CI: повторный запуск старого CI не откатит прод на старый код;
3. `npm ci --ignore-scripts` → `build:vinext` (**без токена**) → **миграции D1** → **деплой** собранного прямо через `wrangler deploy --config dist/server/wrangler.json` (Durable Object создаётся/обновляется сам). Токен видят только шаги миграций и деплоя и только wrangler: `vinext-cloudflare deploy` даже с `--skip-build` загружал бы конфиг сборки и плагины при токене в окружении;
4. **смоук боевого сайта** (`scripts/smoke-prod.mjs`): `/api/health` ok (база, лимитер), `X-Request-Id`, CSP, `/` и `/login` отвечают 200. Не прошёл — прогон красный, GitHub пришлёт письмо.

Деплои идут строго по одному. Окружение GitHub — `production` (там видна история деплоев и ссылка на сайт).

Пока не включён (переменная `DEPLOY_ENABLED`), прогон зелёный и пишет «выключен» — и **не трогает окружение** (иначе GitHub создал бы `production` сам, без правил по веткам). После включения пропавший секрет — красный прогон.

Отдельно от GitHub Actions работает Cloudflare Workers Builds: он уже деплоит `main` в production. Его PR Preview требует отдельной настройки ниже. Красный Preview Build не означает, что production-деплой после слияния упал; проверяй оба прогона отдельно.

## Preview для PR

У Preview есть отдельная D1 `kollgg-preview` (`2add319a-375b-479a-9308-3ef92429b602`). В `wrangler.jsonc` она указана только в `previews.d1_databases`, а production `DB` остаётся `kollgg`. Каждый Preview получает собственный Durable Object лимитера. Секреты Steam и FACEIT в Preview не скопированы: вход и персональная подборка там не тестируются до отдельной безопасной настройки.

После добавления SQL-миграции сначала примени её к Preview D1 с локального терминала в корне репозитория:

```powershell
npx wrangler d1 migrations apply PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc
```

В Cloudflare Dashboard → Workers & Pages → `cstactics` → Settings → Builds для **Preview / Non-production** задай:

- Build command: `npm run build:vinext`
- Preview / Deploy command: `npx wrangler preview --config dist/server/wrangler.json`

Сейчас в панели стоит `npx wrangler preview` без сборки: он читает корневой конфиг, а этому Next/vinext-приложению нужен сгенерированный `dist/server/wrangler.json` и `dist/client`. Production-команды не меняй. Локальная проверка всего пути: `npm run preview:vinext` (создаст/обновит Preview с именем текущей ветки).

Перед включением R2 для #12 добавь в `previews` отдельные тестовые бакеты; боевые бакеты в PR не подключай.

Известное ограничение: сразу после деплоя смоук может попасть в старую версию воркера (обе отвечают одинаково) — тогда он подтверждает старую. Для MVP приемлемо; позже — номер версии в `/api/health`.

### Настройка (один раз)
1. **Владелец аккаунта Cloudflare `xeinty`:** https://dash.cloudflare.com/profile/api-tokens → Create Token → **Custom token** (не шаблон «Edit Cloudflare Workers» — он даёт лишнее: R2, KV, логи, маршруты зон):
   - **Account → Workers Scripts → Edit** (деплой воркера и Durable Objects);
   - **Account → D1 → Edit** (миграции);
   - **Account → Account Settings → Read** (если без него wrangler ругается);
   - Account Resources — только свой аккаунт; **зоны не выбирать**; **срок действия** — например, год, с напоминанием продлить.
   
   Это **отдельный** токен: не аналитика и не бэкап. Даже урезанный он почти полный доступ к аккаунту — главная защита — окружение ниже.
2. **prod-xeinty (Admin)**, **до** включения: https://github.com/prod-xeinty/cstactics/settings/environments → New environment → `production` →
   1. **Deployment branches and tags: Selected → `main`** — токен деплоя не достанется workflow из других веток;
   2. Environment secrets: `CLOUDFLARE_API_TOKEN` = токен из п. 1, `CLOUDFLARE_ACCOUNT_ID`;
   3. **Required reviewers** (рекомендуется) + **Prevent self-review** — каждый деплой ждёт «Approve» второго человека.

   **Не** класть токен деплоя в секреты уровня репозитория: их получает любой workflow с любой ветки.
3. **Включить:** Settings → Secrets and variables → Actions → Variables → `DEPLOY_ENABLED` = `1`.
4. Actions → «Деплой» → Run workflow → убедиться, что смоук зелёный.

### Supabase Storage для видео (один раз)

Проект: `https://inqwhzfhxkxaznckypdw.supabase.co`. Значение secret key в репозиторий, issue, PR и логи не вставлять.

1. Supabase Dashboard → Storage → New bucket:
   - `tactic-videos-private`: **Public bucket выключен**, лимит файла 10 МБ, MIME `video/mp4` и `video/webm`;
   - `tactic-videos-public`: **Public bucket включён**, лимит файла 10 МБ, те же MIME.
2. Supabase Dashboard → Project Settings → API Keys: скопировать серверный `sb_secret_…`. Не использовать anon/publishable key.
3. На своей машине из корня проекта выполнить `npx wrangler secret put SUPABASE_SECRET_KEY`, вставить ключ в скрытый prompt Wrangler и подтвердить.
4. Для локальной проверки добавить `SUPABASE_SECRET_KEY=...` только в `.dev.vars` (файл игнорируется Git).
5. После деплоя открыть `/api/health`: `media_private` и `media_public` должны быть `ok`, не `skipped` или `fail`.

Политики Storage для пользовательских ролей не нужны: браузер не обращается к Supabase напрямую, все операции выполняет Worker с серверным ключом.

## Правила для миграций
- Миграции применяются **до** нового кода, а откатывается при сбое только код. Поэтому миграции — **только добавляющие**: новые таблицы и колонки (с `DEFAULT` или `NULL`), новые индексы. Старый код должен работать на новой схеме.
- CI проверяет это сам (`scripts/check-migrations.mjs`): `DROP`, переименование, `DELETE`, `UPDATE` в новых миграциях — красный PR. Если так и задумано — метка PR **«разрушающая миграция»** и в описании план: когда, точка отката Time Travel, что с кодом.
- Удалить/переименовать колонку — в **два релиза**: сначала код перестаёт её использовать, потом отдельной миграцией удаляем.
- Перед рискованной миграцией помнить про Time Travel (`docs/ops/backup-restore.md`): можно откатить базу на минуту до миграции.

## Откат
```
npx wrangler deployments list           # что и когда задеплоено
npx wrangler rollback                   # вернуть предыдущую версию кода
```
Откат кода не трогает базу. Если сломала миграция — Time Travel (`docs/ops/backup-restore.md`, раздел А).

## Вручную (как раньше, если автодеплой не настроен)
```
git checkout main && git pull
npm install
npm run db:migrate:remote
npm run build:vinext
npm run deploy:vinext
node scripts/smoke-prod.mjs https://cstactics.xeinty.workers.dev
```
