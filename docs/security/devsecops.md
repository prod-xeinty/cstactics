# DevSecOps-конвейер

Что проверяется автоматически, как гонять то же самое локально и что нужно включить в настройках репозитория.

## Проверки на каждый PR

| Workflow | Что делает | Падает, если |
|---|---|---|
| `CI` (`ci.yml`) | `npm ci` → типы → ESLint → тесты → сборка | любая проверка красная |
| `Security` → gitleaks (`security.yml`) | ищет секреты во **всей** истории коммитов | найден ключ, токен, пароль |
| `Security` → npm audit (`security.yml`) | уязвимости зависимостей через `scripts/audit.mjs` | critical в любых зависимостях или high в продовых без исключения |
| `CodeQL` (`codeql.yml`) | статический анализ TS/JS, набор `security-extended` | найдена уязвимость (результаты — Security → Code scanning) |
| Dependabot (`dependabot.yml`) | раз в неделю PR с обновлениями npm и GitHub Actions | — |

`Security` и `CodeQL` ещё и раз в неделю по расписанию: новые уязвимости появляются без наших коммитов.

### Общие правила для workflow
- Токен `GITHUB_TOKEN` — только чтение (`permissions: contents: read`), шире — точечно (CodeQL: `security-events: write`).
- `actions/checkout` с `persist-credentials: false`: токен не остаётся в `.git` для следующих шагов.
- Сторонние экшены закреплены по **SHA коммита**, а не по тегу (тег можно перевесить на вредный код). Dependabot сам обновляет SHA.
- Бинарники, которые качаем руками (gitleaks), сверяем по sha256 из официального релиза.

## Исключения для npm audit

`security/audit-allowlist.json`. Каждое исключение — GHSA-идентификатор, **причина** и **срок** (`expires`). После срока проверка снова падает: обнови пакет или продли с новым обоснованием.

Сейчас одно: `braces` (GHSA-vfj7-8cjw-p6xm) — приходит через vinext в плагине сборки, в рантайм сайта не попадает, исправленной версии нет.

## Локально

```bash
npm run check        # типы, линтер, тесты, сборка — как CI
npm run audit:deps   # зависимости — как Security / npm audit
```

gitleaks (нужен бинарник с https://github.com/gitleaks/gitleaks/releases):

```bash
gitleaks git --config .gitleaks.toml --redact .   # вся история
gitleaks dir --config .gitleaks.toml --redact src # только файлы
```

## Что включить в настройках репозитория (нужен Admin — владелец репо)

### 1. Защита `main`
Settings → Rules → Rulesets → **New branch ruleset**:
- Target: `main` (Default branch), Enforcement: **Active**.
- **Restrict deletions**, **Block force pushes**.
- **Require a pull request before merging**: 1 approval, «Dismiss stale approvals», «Require review from Code Owners».
- **Require status checks to pass**, «Require branches to be up to date»; добавить проверки:
  - `Проверки` (CI)
  - `Секреты (gitleaks)`
  - `Зависимости (npm audit)`
  - `CodeQL (TS/JS)`

  Проверки появятся в списке, когда хотя бы раз прогонятся.
- Bypass list — пустой (правила и для админа).

### 2. Code security (Settings → Code security)
- **Dependency graph**, **Dependabot alerts**, **Dependabot security updates** — включить.
- **Secret scanning** и **Push protection** — включить: GitHub сам не даст запушить известный формат ключа.
- **Private vulnerability reporting** — включить (для `SECURITY.md`).
- **Code scanning**: настраивается через `codeql.yml`, «default setup» не включать — будет конфликт.

### 3. Actions (Settings → Actions → General)
- Workflow permissions: **Read repository contents** (по умолчанию для токена).
- «Allow GitHub Actions to create and approve pull requests» — выключено.
