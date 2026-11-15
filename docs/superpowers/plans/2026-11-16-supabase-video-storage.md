# Supabase Video Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Безопасно принимать видео до 10 МБ, хранить его приватно в Supabase и публиковать только повторно проверенные байты.

**Architecture:** Supabase REST реализует существующий платформенный `ObjectStorage`. Серверный маршрут анкеты проверяет и сохраняет приватный объект, сервис публикации повторно валидирует его и копирует под новый неизменяемый ключ, а публичный media-route отдаёт только опубликованные записи.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Cloudflare Workers, D1, Supabase Storage REST.

**Spec:** `docs/superpowers/specs/2026-11-16-supabase-video-storage-design.md`

## Global Constraints

- MP4/WebM, не больше 10 МБ; проверка на клиенте и сервере.
- Service role key существует только на сервере и не логируется.
- Пользовательский контент остаётся `pending` до модерации.
- Ключи объектов создаёт сервер; запись выполняется без upsert.
- UI-тексты, комментарии и коммиты — на русском.

## Review Focus

- MIME не совпадает с magic bytes: отклонить до записи в хранилище.
- Объект изменился после загрузки: не публиковать при несовпадении размера, MIME или SHA-256.
- Хранилище не настроено или недоступно: не создавать частично готовую тактику.
- Повторная публикация или конфликт: не открыть непроверенный объект.
- Запрос чужого, pending или неизвестного media-id: вернуть 404 без утечки метаданных.

---

### Task 1: Supabase-адаптер хранилища

**Files:**
- Create: `src/platform/supabase-storage.ts`
- Create: `tests/supabase-storage.test.ts`
- Modify: `src/platform/types.ts`
- Modify: `src/platform/cloudflare.ts`
- Modify: `wrangler.jsonc`
- Modify: `.env.example`

**Interfaces:**
- Produces: `createSupabaseStorage(config, bucket): ObjectStorage`; `get()` возвращает поток и фактические метаданные, `put()` поддерживает `onlyIfAbsent`.

- [ ] Написать тесты REST-контракта, HTTPS-валидации URL, create-only загрузки и ошибок Supabase.
- [ ] Запустить тест и увидеть ожидаемый RED из-за отсутствующего адаптера.
- [ ] Реализовать минимальный адаптер и подключить его вместо отсутствующих R2-биндингов.
- [ ] Запустить тесты адаптера и платформы до GREEN.

### Task 2: Проверка и приватная загрузка

**Files:**
- Create: `src/tactics/video.ts`
- Create: `tests/video.test.ts`
- Modify: `src/app/api/tactics/route.ts`
- Modify: `tests/submission-route.test.ts`
- Modify: `src/app/submit/SubmitForm.tsx`

**Interfaces:**
- Produces: `inspectVideo(bytes, claimedType)` с фактическим MIME, расширением, размером и SHA-256; `privateVideoKey(tacticId, mediaId, extension)`.

- [ ] Написать тесты MP4/WebM, неверной сигнатуры, размера и детерминированных метаданных.
- [ ] Запустить их и подтвердить RED.
- [ ] Реализовать валидатор и подключить приватную create-only загрузку с записью `tactic_media` и `/media/<id>`.
- [ ] Обновить клиентский текст и убрать заглушку «загрузку ещё готовим».
- [ ] Запустить маршрутные и unit-тесты до GREEN.

### Task 3: Повторная проверка при публикации

**Files:**
- Create: `src/tactics/video-publication.ts`
- Create: `tests/video-publication.test.ts`
- Modify: `src/app/api/moderation/[id]/route.ts`
- Modify: `src/tactics/moderation.ts`
- Modify: `tests/moderation.test.ts`

**Interfaces:**
- Produces: `prepareTacticMediaForPublication(platform, tacticId)`; копия создаётся только после сверки фактических байтов с D1.

- [ ] Написать тесты успешной копии и отказов при несовпадении размера, MIME и checksum.
- [ ] Запустить их и подтвердить RED.
- [ ] Реализовать повторную проверку, новый публичный ключ и безопасный порядок изменения статусов.
- [ ] Подключить сервис к модерации и проверить GREEN.

### Task 4: Безопасная выдача и документация

**Files:**
- Create: `src/app/media/[id]/route.ts`
- Create: `tests/media-route.test.ts`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-10-19-cloudflare-architecture-design.md`
- Modify: `docs/ops/deploy.md`

**Interfaces:**
- Produces: `GET /media/<media-id>` с видео только для пары `tactic=published` и `media=published`.

- [ ] Написать тесты 200/404 и безопасных заголовков, подтвердить RED.
- [ ] Реализовать маршрут выдачи и подтвердить GREEN.
- [ ] Зафиксировать замену R2 на Supabase Storage для MVP и команды настройки без значений секретов.
- [ ] Запустить `npm run check` и сверить каждый критерий issue #12.
