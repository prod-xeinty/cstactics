import { describe, expect, it, vi } from "vitest";
import { csrfTokenFor } from "@/security/csrf";

const mocks = vi.hoisted(() => ({ getCurrentSession: vi.fn() }));
vi.mock("@/auth/current-user", () => ({ getCurrentSession: mocks.getCurrentSession }));

import { GET } from "@/app/api/auth/me/route";

const TOKEN = "secret-session-token";
const request = () => new Request("https://example.test/api/auth/me", { headers: { cookie: `__Host-session=${TOKEN}` } });

describe("профиль текущего игрока", () => {
  it("отдаёт отдельный CSRF-токен только вошедшему игроку", async () => {
    mocks.getCurrentSession.mockResolvedValue({ user: { steam_id64: "76561199876410025", nickname: "xeinty", avatar_url: null, role: "user" } });
    const response = await GET(request());
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as { csrfToken: string; user: { nickname: string } };
    expect(body.user.nickname).toBe("xeinty");
    expect(body.csrfToken).toBe(await csrfTokenFor(TOKEN));
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });

  it("анониму не отдаёт CSRF-токен", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);
    expect(await (await GET(request())).json()).toEqual({ user: null, csrfToken: null });
  });
});
