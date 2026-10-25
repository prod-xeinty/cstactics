# Деплой

## Автоматически (после настройки)

Workflow **«Деплой»** (`.github/workflows/deploy.yml`):

1. срабатывает, когда **CI зелёный на пуше в `main`** (то есть после мержа PR), — или вручную: Actions → «Деплой» → Run workflow;
2. берёт **ровно тот коммит**, на котором прошёл CI;
3. `npm ci` → `build:vinext` → **миграции D1** (`wrangler d1 migrations apply DB --remote`) → **деплой** (`deploy:vinext`; Durable Object создаётся/обновляется сам);
4. **смоук боевого сайта** (`scripts/smoke-prod.mjs`): `/api/health` ok (база, лимитер), `X-Request-Id`, CSP, `/` и `/login` отвечают 200. Не прошёл — прогон красный, GitHub пришлёт письмо.

Деплои идут строго по одному. Окружение GitHub — `production` (там видна история деплоев и ссылка на сайт).

Пока секретов нет — прогон зелёный и пишет «не настроено».

### Настройка (один раз)
1. **sK8le:** https://dash.cloudflare.com/profile/api-tokens → Create Token → шаблон **«Edit Cloudflare Workers»**, и в том же токене добавить **Account → D1 → Edit** (для миграций). Ресурсы — только свой аккаунт и зона «All zones» не нужна. Это **отдельный** токен: не аналитика и не бэкап.
   У токена поставь **срок действия** и напоминание продлить.
2. **prod-xeinty (Admin):** https://github.com/prod-xeinty/cstactics/settings/environments → `production` (появится после первого прогона, или New environment) →
   1. **Deployment branches and tags: Selected → `main`** — токен деплоя не достанется workflow из других веток;
   2. Environment secrets: `CLOUDFLARE_API_TOKEN` = токен из п. 1, `CLOUDFLARE_ACCOUNT_ID`;
   3. *(по желанию)* **Required reviewers** — тогда каждый деплой ждёт нажатия «Approve».

   **Не** класть токен деплоя в секреты уровня репозитория: их получает любой workflow с любой ветки.
4. Actions → «Деплой» → Run workflow → убедиться, что смоук зелёный.

## Правила для миграций
- Миграции применяются **до** нового кода, а откатывается при сбое только код. Поэтому миграции — **только добавляющие**: новые таблицы и колонки (с `DEFAULT` или `NULL`), новые индексы. Старый код должен работать на новой схеме.
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
