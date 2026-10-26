# Деплой

## Автоматически (после настройки)

Workflow **«Деплой»** (`.github/workflows/deploy.yml`):

1. срабатывает, когда **CI зелёный на пуше в `main`** (то есть после мержа PR), — или вручную **с ветки `main`**: Actions → «Деплой» → Run workflow;
2. деплоит **только последний `main`** и только если на нём зелёная проверка CI: повторный запуск старого CI не откатит прод на старый код;
3. `npm ci --ignore-scripts` → `build:vinext` (**без токена**) → **миграции D1** → **деплой** собранного прямо через `wrangler deploy --config dist/server/wrangler.json` (Durable Object создаётся/обновляется сам). Токен видят только шаги миграций и деплоя и только wrangler: `vinext-cloudflare deploy` даже с `--skip-build` загружал бы конфиг сборки и плагины при токене в окружении;
4. **смоук боевого сайта** (`scripts/smoke-prod.mjs`): `/api/health` ok (база, лимитер), `X-Request-Id`, CSP, `/` и `/login` отвечают 200. Не прошёл — прогон красный, GitHub пришлёт письмо.

Деплои идут строго по одному. Окружение GitHub — `production` (там видна история деплоев и ссылка на сайт).

Пока не включён (переменная `DEPLOY_ENABLED`), прогон зелёный и пишет «выключен» — и **не трогает окружение** (иначе GitHub создал бы `production` сам, без правил по веткам). После включения пропавший секрет — красный прогон.

Известное ограничение: сразу после деплоя смоук может попасть в старую версию воркера (обе отвечают одинаково) — тогда он подтверждает старую. Для MVP приемлемо; позже — номер версии в `/api/health`.

### Настройка (один раз)
1. **sK8le:** https://dash.cloudflare.com/profile/api-tokens → Create Token → **Custom token** (не шаблон «Edit Cloudflare Workers» — он даёт лишнее: R2, KV, логи, маршруты зон):
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
node scripts/smoke-prod.mjs https://kollgg.kollgg-probe-test.workers.dev
```
