# Frontend MVP «Блокнот тактик» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task by task. For every feature or bugfix, follow `superpowers:test-driven-development`; before declaring completion, follow `superpowers:verification-before-completion`.

**Goal:** Реализовать первый рабочий frontend КОЛЛ.GG с главной, быстрым коллом и детальной страницей тактики в утверждённой системе «Блокнот тактик».

**Architecture:** Next.js App Router с серверными страницами по умолчанию и небольшими клиентскими островами для фильтров, меню, шагов и `localStorage`. Страницы получают данные только через `TacticsRepository`; первая реализация читает локальные типизированные fixtures, поэтому последующая замена на D1 не затронет UI. Обычный Next.js остаётся основным циклом разработки, а vinext добавляет проверяемую сборку и деплой на Cloudflare Workers.

**Tech Stack:** Next.js 16, React, TypeScript, vinext, CSS Modules, Vitest, Testing Library, Playwright, ESLint, Cloudflare Workers/Wrangler.

**Spec:** `docs/superpowers/specs/2026-10-20-tactics-notebook-frontend-design.md`

## Global Constraints

- Следовать `AGENTS.md` и `DESIGN.md`; UI-тексты, комментарии и коммиты — на русском.
- Использовать только коллауты Dust2 из `AGENTS.md`; демо-оценки явно помечать как демо.
- Не добавлять Steam, FACEIT API, D1, R2, голосование и отправку тактики на этом этапе.
- Не смешивать «Блокнот тактик» с бордовым направлением; без градиентов, стекломорфизма, неона и эмодзи.
- Не рендерить пользовательский текст через `dangerouslySetInnerHTML`.
- Минимальная интерактивная зона — 44 px; длинные русские строки должны переноситься без горизонтального скролла.
- Сначала писать падающий тест, затем минимальную реализацию, затем рефакторинг. После каждой задачи делать отдельный коммит.
- Не коммитить `.env*`, секреты, `.next/`, `.vinext/`, `node_modules/`, Playwright traces и локальные отчёты.

## Review Focus

Во время реализации и ревью отдельно проверить пять вероятных источников ошибок:

1. Неизвестные или испорченные query-параметры фильтров безопасно приводятся к значениям по умолчанию, а URL содержит только поддерживаемые значения.
2. Неизвестный `slug` на обоих динамических маршрутах возвращает 404, а не пустую страницу или исключение.
3. Пустой результат сохраняет выбранные фильтры, показывает понятный сброс и после сброса возвращает рекомендации.
4. Длинный заголовок и UI на ширине 390 px не создают горизонтальный скролл; меню, фильтры и кнопки доступны с клавиатуры.
5. Отсутствующий, повреждённый или недоступный `localStorage` не ломает `PatchNotice`; переход за последний шаг быстрого колла не выходит за границы массива.

---

## Task 1: Поднять Next.js, vinext и тестовый контур

**Files:**

- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `next-env.d.ts`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `.gitignore`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.module.css`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `tests/smoke/app-shell.test.tsx`
- Modify after initialization: `vite.config.ts`
- Modify after initialization: `wrangler.jsonc`

**Step 1: Создать минимальный Next.js App Router проект**

Добавить вручную минимальные конфигурации и установить зависимости:

```powershell
npm install next@latest react@latest react-dom@latest
npm install -D typescript @types/node @types/react @types/react-dom eslint eslint-config-next vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

В `package.json` сразу определить команды `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:run`, `test:e2e`.

**Step 2: Написать падающий smoke-тест оболочки**

`tests/smoke/app-shell.test.tsx` должен проверить русское название сайта и наличие ссылки «Тактики» в корневом layout. До реализации layout тест обязан падать.

Run: `npm run test:run -- tests/smoke/app-shell.test.tsx`

Expected: FAIL — название или ссылка отсутствуют.

**Step 3: Реализовать минимальный layout и стартовую страницу**

В `src/app/layout.tsx` задать `lang="ru"`, metadata, глобальные стили и доступную ссылку пропуска к контенту. В `src/app/globals.css` перенести токены цвета, размеров, фокуса и базовой типографики из `DESIGN.md`; страницу оставить минимальной, без преждевременной сборки настоящей главной.

Run: `npm run test:run -- tests/smoke/app-shell.test.tsx`

Expected: PASS.

**Step 4: Проверить обычный Next.js цикл**

Run: `npm run lint; npm run typecheck; npm run build`

Expected: три команды завершаются с кодом 0.

**Step 5: Подключить vinext по официальному пути Cloudflare**

Run: `npx vinext check`

Expected: отчёт совместимости без блокирующих ошибок.

Run: `npx vinext init`

В интерактивном выборе указать Cloudflare Workers. Проверить сгенерированные `vite.config.ts`, `wrangler.jsonc` и scripts; сохранить обычные команды Next.js рядом с `dev:vinext` и `build:vinext`.

Run: `npm run build:vinext`

Expected: production-сборка vinext завершается с кодом 0.

**Step 6: Настроить Playwright и запустить пустой контур**

Настроить `webServer` на `npm run dev`, Chromium и базовые viewport-проекты 1440 × 1024 и 390 × 844. Пока не добавлять содержательные E2E-сценарии.

Run: `npx playwright install chromium; npm run test:e2e -- --list`

Expected: конфигурация загружается без ошибок.

**Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json next-env.d.ts next.config.ts eslint.config.mjs .gitignore src/app vitest.config.ts vitest.setup.ts playwright.config.ts tests/smoke vite.config.ts wrangler.jsonc
git commit -m "chore: поднять frontend и тестовый контур"
```

**Учебная точка:** объяснить, зачем проекту одновременно обычная Next.js-сборка и vinext, и вместе прочитать scripts в `package.json`.

## Task 2: Описать домен и локальный репозиторий тактик

**Files:**

- Create: `src/tactics/model.ts`
- Create: `src/tactics/schema.ts`
- Create: `src/tactics/fixtures.ts`
- Create: `src/tactics/repository.ts`
- Create: `src/tactics/filter.ts`
- Create: `src/tactics/format.ts`
- Create: `src/tactics/__tests__/filter.test.ts`
- Create: `src/tactics/__tests__/repository.test.ts`
- Create: `src/tactics/__tests__/format.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Public interfaces:**

```ts
export type Side = "T" | "CT";
export type FaceitBand = "low" | "mid" | "high";
export type TeamSize = 2 | 3 | 4 | 5;

export interface TacticFilters {
  map: "dust2";
  side: Side | "all";
  teamSize: TeamSize | "all";
  band: FaceitBand;
}

export interface TacticsRepository {
  list(filters: TacticFilters): Promise<TacticSummary[]>;
  featured(filters: TacticFilters): Promise<TacticSummary | null>;
  bySlug(slug: string): Promise<Tactic | null>;
}

export function parseTacticFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): TacticFilters;

export const tacticsRepository: TacticsRepository;
```

`Tactic` расширяет модель из `AGENTS.md` только полями представления, которые нужны утверждённым экранам: `duration`, `ratings`, `mapImage`, `mapAlt`; бизнес-поля не переименовывать.

**Step 1: Установить Zod и написать падающие тесты фильтров**

Run: `npm install zod`

Проверить: значения по умолчанию, все валидные комбинации, неизвестные query-значения, повторяющиеся параметры и сортировку рейтинга выбранной FACEIT-группы.

Run: `npm run test:run -- src/tactics/__tests__/filter.test.ts`

Expected: FAIL — модуль ещё не реализован.

**Step 2: Реализовать типы, схему и parser фильтров**

Использовать Zod для границы входных данных. Не бросать исключение на пользовательском query: возвращать безопасные defaults `dust2/all/all/mid`.

Run: `npm run test:run -- src/tactics/__tests__/filter.test.ts`

Expected: PASS.

**Step 3: Написать падающие тесты репозитория**

Проверить фильтрацию по стороне и составу, выбор featured, детерминированную сортировку, пустой результат, известный и неизвестный slug. Отдельно проверить, что возвращаемые массивы нельзя использовать для мутации исходного fixture.

Run: `npm run test:run -- src/tactics/__tests__/repository.test.ts`

Expected: FAIL.

**Step 4: Добавить 6–8 fixtures и in-memory реализацию**

Использовать только Dust2 и коллауты из `AGENTS.md`. Все числа рейтингов снабдить полем/лейблом `demo: true`. Добавить минимум одну длинную русскую строку и комбинацию фильтров без результатов для последующей проверки UI.

Run: `npm run test:run -- src/tactics/__tests__/repository.test.ts`

Expected: PASS.

**Step 5: Написать и реализовать форматирование метаданных**

Проверить подписи стороны, состава, сложности, экономики и FACEIT-группы. Компоненты не должны сами собирать эти строки из условных операторов.

Run: `npm run test:run -- src/tactics/__tests__/format.test.ts`

Expected: сначала FAIL, после минимальной реализации PASS.

**Step 6: Commit**

```bash
git add package.json package-lock.json src/tactics
git commit -m "feat: добавить модель и демо-репозиторий тактик"
```

**Учебная точка:** вместе проследить путь `URL → Zod → TacticFilters → TacticsRepository` и вручную добавить один fixture.

## Task 3: Собрать общую оболочку и компоненты дизайн-системы

**Files:**

- Create: `src/shared/ui/site-header/SiteHeader.tsx`
- Create: `src/shared/ui/site-header/SiteHeader.module.css`
- Create: `src/shared/ui/site-header/SiteHeader.test.tsx`
- Create: `src/shared/ui/tactic-meta/TacticMeta.tsx`
- Create: `src/shared/ui/tactic-meta/TacticMeta.module.css`
- Create: `src/shared/ui/tactic-meta/TacticMeta.test.tsx`
- Create: `src/shared/ui/tactic-map/TacticMap.tsx`
- Create: `src/shared/ui/tactic-map/TacticMap.module.css`
- Create: `src/shared/ui/tactic-map/TacticMap.test.tsx`
- Create: `src/shared/ui/states/EmptyState.tsx`
- Create: `src/shared/ui/states/ErrorState.tsx`
- Create: `src/shared/ui/states/States.module.css`
- Create: `src/shared/ui/patch-notice/PatchNotice.tsx`
- Create: `src/shared/ui/patch-notice/PatchNotice.module.css`
- Create: `src/shared/ui/patch-notice/PatchNotice.test.tsx`
- Create: `src/patches/storage.ts`
- Create: `src/patches/storage.test.ts`
- Create: `public/images/dust2-notebook-map.webp`
- Create: `public/images/dust2-notebook-map-mobile.webp`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Step 1: Подготовить содержательные растровые схемы**

На основе `design/references/notebook-*.png` создать через ImageGen две версии одной чистой схемы Dust2 без текста интерфейса: desktop около 1600 × 1200 и mobile около 900 × 1200. Сохранить WebP в указанные пути. Не воспроизводить карту набором `div`.

**Step 2: Написать падающие component-тесты**

Проверить:

- открытие/закрытие мобильного меню и возвращение фокуса;
- доступный `alt` у карты и отсутствие декоративного дубля для screen reader;
- русские подписи метаданных;
- закрытие `PatchNotice`, ключ с версией патча и корректную работу при исключении `localStorage`.

Run: `npm run test:run -- src/shared/ui src/patches`

Expected: FAIL.

**Step 3: Реализовать общие компоненты**

`SiteHeader` содержит логотип, ссылки «Тактики» и «Под твоё эло», поиск-заглушку только как визуальное поле и мобильное меню. `PatchNotice` получает `patchVersion`, `releasedAt` и текст через props; storage-утилита скрывает браузерный API за безопасным интерфейсом. `TacticMap` использует `next/image` с корректным `sizes`.

Run: `npm run test:run -- src/shared/ui src/patches`

Expected: PASS.

**Step 4: Подключить оболочку к layout**

Добавить `SiteHeader`, `PatchNotice`, `<main id="main-content">` и footer. Не создавать ложную авторизацию: кнопка Steam ведёт на недоступное действие с честной подписью «Скоро» или отсутствует согласно макету первого этапа.

Run: `npm run lint; npm run typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app src/shared src/patches public/images
git commit -m "feat: собрать оболочку Блокнота тактик"
```

**Учебная точка:** показать границу server/client components на примере `SiteHeader` и `PatchNotice`.

## Task 4: Реализовать главную и URL-фильтры

**Files:**

- Create: `src/features/tactic-filters/TacticFilters.tsx`
- Create: `src/features/tactic-filters/TacticFilters.module.css`
- Create: `src/features/tactic-filters/TacticFilters.test.tsx`
- Create: `src/features/featured-tactic/FeaturedTactic.tsx`
- Create: `src/features/featured-tactic/FeaturedTactic.module.css`
- Create: `src/features/tactic-list/TacticList.tsx`
- Create: `src/features/tactic-list/TacticListItem.tsx`
- Create: `src/features/tactic-list/TacticList.module.css`
- Create: `src/features/tactic-list/TacticList.test.tsx`
- Create: `src/app/loading.tsx`
- Create: `src/app/error.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.module.css`

**Step 1: Написать падающие тесты фильтров и состояний списка**

Проверить управление `select`/segmented controls клавиатурой, сериализацию только поддерживаемых query, кнопку сброса, data/empty/error состояния и сохранение фильтров при повторе.

Run: `npm run test:run -- src/features/tactic-filters src/features/tactic-list`

Expected: FAIL.

**Step 2: Реализовать клиентский остров фильтров**

`TacticFilters` получает нормализованные filters и меняет URL через `useRouter`/`useSearchParams`; вычисление рекомендаций остаётся на серверной странице после навигации. Сброс ведёт к каноническому `/` без лишних query.

Run: `npm run test:run -- src/features/tactic-filters`

Expected: PASS.

**Step 3: Реализовать серверную главную**

`src/app/page.tsx` читает `searchParams`, вызывает только `tacticsRepository`, показывает «План на следующий раунд», рекомендацию, содержательную схему, быстрый колл и альтернативы. Ссылки ведут на `/call/[slug]` и `/tactics/[slug]`. Каталог остаётся ссылкой/CTA с честной пометкой будущего этапа, без несуществующего рабочего экрана.

**Step 4: Добавить loading и error состояния**

`loading.tsx` резервирует высоту hero и списка без скачка layout. `error.tsx` — клиентская граница с русским сообщением и `reset()`. Для пустой выборки использовать общий `EmptyState` со сбросом.

Run: `npm run test:run -- src/features src/tactics`

Expected: PASS.

**Step 5: Визуально сверить главную**

Run: `npm run dev`

Сравнить `/` с `design/references/notebook-home.png` при 1440 × 1024 и 390 × 844. Проверить отсутствие горизонтального скролла, перенос длинного заголовка и 44 px targets.

**Step 6: Commit**

```bash
git add src/app src/features
git commit -m "feat: реализовать главную с фильтрами тактик"
```

**Учебная точка:** самостоятельно изменить один фильтр, посмотреть новый URL и объяснить, почему состояние в URL удобнее скрытого React state.

## Task 5: Реализовать быстрый колл

**Files:**

- Create: `src/features/quick-call/QuickCallMode.tsx`
- Create: `src/features/quick-call/QuickCallMode.module.css`
- Create: `src/features/quick-call/QuickCallMode.test.tsx`
- Create: `src/app/call/[slug]/page.tsx`
- Create: `src/app/call/[slug]/loading.tsx`
- Create: `src/app/call/[slug]/page.module.css`

**Public interface:**

```ts
export interface QuickCallModeProps {
  tactic: Tactic;
  alternativeSlug: string | null;
}
```

**Step 1: Написать падающие тесты режима**

Проверить начальный шаг, переход вперёд/назад, запрет выхода за границы, пять ролей, доступные названия кнопок и ссылку на полный разбор. Кнопка «Другой колл» должна вести на заранее выбранный детерминированный alternative slug, а не использовать случайность в браузере.

Run: `npm run test:run -- src/features/quick-call/QuickCallMode.test.tsx`

Expected: FAIL.

**Step 2: Реализовать QuickCallMode**

Клиентским оставить только индекс активного шага. Крупный колл и роли приходят из server component через props. На последнем шаге кнопка «Дальше» disabled или меняет подпись на «Открыть полный план».

Run: `npm run test:run -- src/features/quick-call/QuickCallMode.test.tsx`

Expected: PASS.

**Step 3: Реализовать динамический маршрут**

Страница получает тактику через `bySlug`; при `null` вызывает `notFound()`. Альтернативу выбирает сервер из того же нормализованного списка. Добавить metadata по названию тактики и loading skeleton.

Run: `npm run typecheck; npm run build`

Expected: PASS, маршрут входит в сборку.

**Step 4: Визуально сверить экран**

Сравнить с `design/references/notebook-quick-call.png` при 1440 × 1024 и 390 × 844. Главный колл и следующая кнопка должны быть видны без прокрутки на типовом телефоне, насколько позволяет длина текста.

**Step 5: Commit**

```bash
git add src/features/quick-call src/app/call
git commit -m "feat: добавить быстрый режим колла"
```

**Учебная точка:** самостоятельно дописать тест последнего шага и затем проверить его в браузере.

## Task 6: Реализовать детальную страницу тактики

**Files:**

- Create: `src/features/round-steps/RoundSteps.tsx`
- Create: `src/features/round-steps/RoundSteps.module.css`
- Create: `src/features/round-steps/RoundSteps.test.tsx`
- Create: `src/features/role-assignments/RoleAssignments.tsx`
- Create: `src/features/role-assignments/RoleAssignments.module.css`
- Create: `src/features/role-assignments/RoleAssignments.test.tsx`
- Create: `src/features/utility-checklist/UtilityChecklist.tsx`
- Create: `src/features/utility-checklist/UtilityChecklist.module.css`
- Create: `src/features/utility-checklist/UtilityChecklist.test.tsx`
- Create: `src/app/tactics/[slug]/page.tsx`
- Create: `src/app/tactics/[slug]/loading.tsx`
- Create: `src/app/tactics/[slug]/page.module.css`
- Create: `src/app/not-found.tsx`

**Step 1: Написать падающие component-тесты**

Проверить нумерацию максимум четырёх шагов, роли 1–5, запасную роль, список гранат в формате «кто → что → куда → триггер → зачем» и отсутствие пустых секций при необязательных данных.

Run: `npm run test:run -- src/features/round-steps src/features/role-assignments src/features/utility-checklist`

Expected: FAIL.

**Step 2: Реализовать секции разбора**

Использовать семантические `ol`, `dl`, `section` и заголовки. Не превращать текст fixture в HTML. Тайминги и технические метки можно выводить JetBrains Mono; основной текст остаётся Golos Text.

Run: `npm run test:run -- src/features/round-steps src/features/role-assignments src/features/utility-checklist`

Expected: PASS.

**Step 3: Собрать серверную страницу**

Показать заголовок, metadata, быстрый колл, карту, шаги, роли, утилити, fallback, post-plant, counters, статус патча и версию игры. Добавить ссылки «Запустить быстрый колл» и «К списку». Неизвестный slug вызывает `notFound()`; общий `not-found.tsx` предлагает вернуться на главную.

Run: `npm run typecheck; npm run build`

Expected: PASS.

**Step 4: Визуально сверить страницу**

Сравнить с `design/references/notebook-detail.png` и `design/references/notebook-tactic-card.png` при 1440 × 1024 и 390 × 844. На mobile порядок: колл и действие → схема → шаги → роли → утилити.

**Step 5: Commit**

```bash
git add src/features/round-steps src/features/role-assignments src/features/utility-checklist src/app/tactics src/app/not-found.tsx
git commit -m "feat: добавить полный разбор тактики"
```

**Учебная точка:** самостоятельно изменить порядок одной мобильной секции через CSS Grid и объяснить, почему DOM-порядок всё равно должен оставаться логичным.

## Task 7: Покрыть пользовательские маршруты E2E

**Files:**

- Create: `tests/e2e/home-filters.spec.ts`
- Create: `tests/e2e/quick-call.spec.ts`
- Create: `tests/e2e/tactic-detail.spec.ts`
- Create: `tests/e2e/patch-notice.spec.ts`
- Create: `tests/e2e/accessibility-mobile.spec.ts`
- Modify: `playwright.config.ts`

**Step 1: Написать E2E-сценарии по спецификации**

Покрыть:

- главная → изменение фильтров → URL → открытие рекомендации;
- empty state → сброс → возвращение рекомендации;
- главная → быстрый колл → шаги → полный разбор;
- главная → детальная страница;
- неизвестные slug → 404;
- закрытие `PatchNotice` → reload → плашка остаётся скрытой;
- мобильное меню, последовательность Tab, видимый focus и отсутствие горизонтального overflow на 390 px;
- длинный русский заголовок.

Run: `npm run test:e2e`

Expected: первый запуск выявляет недостающие интеграционные детали; исправлять только продуктовый код, не ослаблять assertions.

**Step 2: Устранить найденные дефекты**

Для каждого дефекта сначала добавить максимально узкий unit/component regression test, затем внести минимальное исправление и снова запустить соответствующий E2E.

Run: `npm run test:e2e`

Expected: PASS во всех viewport-проектах.

**Step 3: Commit**

```bash
git add tests/e2e playwright.config.ts src
git commit -m "test: покрыть маршруты Блокнота тактик"
```

**Учебная точка:** запустить один Playwright-тест в headed/UI режиме, поставить паузу и посмотреть локаторы вместо CSS-селекторов.

## Task 8: Провести финальный visual QA и оформить передачу

**Files:**

- Create: `design-qa.md`
- Create: `design/qa/home-desktop.png`
- Create: `design/qa/home-mobile.png`
- Create: `design/qa/quick-call-desktop.png`
- Create: `design/qa/quick-call-mobile.png`
- Create: `design/qa/tactic-detail-desktop.png`
- Create: `design/qa/tactic-detail-mobile.png`
- Modify as defects require: `src/**/*.tsx`
- Modify as defects require: `src/**/*.module.css`
- Modify as defects require: `src/app/globals.css`

**Step 1: Снять контрольные скриншоты**

Через браузер снять все три маршрута при 1440 × 1024 и 390 × 844. Сохранить только финальные кадры в `design/qa/`; временные скриншоты не коммитить.

**Step 2: Заполнить design-qa.md**

Для каждого экрана сравнить с соответствующим `design/references/notebook-*.png` и отметить:

- иерархию и композицию;
- типографику и переносы;
- цвета и отсутствие бордового направления;
- состояния hover/focus/disabled;
- mobile flow и overflow;
- расхождения P0, P1, P2, P3.

**Step 3: Исправить все P0–P2**

Каждое поведенческое исправление начать с regression test. Допустимые P3 явно перечислить как осознанные расхождения. Завершить документ строкой `final result: passed` только после повторной проверки.

**Step 4: Запустить полный verification gate**

Run:

```powershell
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run build:vinext
npm run test:e2e
git diff --check
git status --short
```

Expected: все команды завершаются с кодом 0; в status только ожидаемые файлы перед коммитом.

**Step 5: Commit**

```bash
git add design-qa.md design/qa src tests
git commit -m "docs: завершить визуальную проверку frontend MVP"
```

**Step 6: Подготовить PR к ревью**

В описании PR перечислить три маршрута, команды проверки, ссылку на spec/plan, известные P3-расхождения и учебные части, выполненные владельцем проекта. Не выполнять merge без отдельного решения пользователя.

**Учебная точка:** пользователь сам проводит финальный ручной smoke-test по трём маршрутам и отмечает результат в PR checklist.

