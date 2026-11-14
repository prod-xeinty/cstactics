import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./sqlite-db";
import { csrfTokenFor } from "@/security/csrf";
import { latestGamePatch } from "@/patches/repository";

const mocks = vi.hoisted(() => ({
  getPlatform: vi.fn(),
  getCurrentSession: vi.fn(),
  enforceRateLimit: vi.fn(async () => null),
}));

vi.mock("@/platform", () => ({ getPlatform: mocks.getPlatform }));
vi.mock("@/auth/current-user", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/security/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));

import { GET, POST } from "@/app/api/patches/route";

const TOKEN = "test-session-token";

async function request(data: Record<string, string>, csrf = "") {
  return new Request("https://example.test/api/patches", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      cookie: `__Host-session=${TOKEN}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ ...data, csrf }),
  });
}

describe("маршрут обновы", () => {
  beforeEach(() => {
    mocks.getPlatform.mockReset();
    mocks.getCurrentSession.mockReset();
    mocks.enforceRateLimit.mockClear();
    mocks.getPlatform.mockResolvedValue({ db: createTestDb(), rateLimiter: {} });
  });

  it("не даёт добавить патч без входа и без роли модератора", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);
    expect((await POST(await request({ version: "patch-a", releasedAt: "2026-10-20" }))).status).toBe(401);
    mocks.getCurrentSession.mockResolvedValue({ user: { id: "u1", role: "user" } });
    expect((await POST(await request({ version: "patch-a", releasedAt: "2026-10-20" }))).status).toBe(403);
  });

  it("требует CSRF и принимает только корректный патч", async () => {
    mocks.getCurrentSession.mockResolvedValue({ user: { id: "u1", role: "moderator" } });
    const valid = { version: "patch-a", releasedAt: "2026-10-20" };
    expect((await POST(await request(valid))).status).toBe(403);
    const csrf = await csrfTokenFor(TOKEN);
    expect((await POST(await request({ ...valid, releasedAt: "2026-02-30" }, csrf))).status).toBe(400);
    expect((await POST(await request(valid, csrf))).status).toBe(303);
    expect((await POST(await request(valid, csrf))).status).toBe(409);
    const response = await GET();
    const body = (await response.json()) as { patch: { version: string } };
    expect(body.patch.version).toBe("patch-a");
    expect(await latestGamePatch((await mocks.getPlatform()).db)).toMatchObject({ version: "patch-a" });
  });
});
