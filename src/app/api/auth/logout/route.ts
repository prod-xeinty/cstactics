import { getPlatform } from "@/platform";
import { clearCookie, deleteSession, readCookie, SESSION_COOKIE } from "@/auth/session";

export const dynamic = "force-dynamic";

// Выход — только POST и только со своего сайта (защита от CSRF: чужая страница не разлогинит игрока).
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const fromOrigin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fromOrigin !== origin && fetchSite !== "same-origin") {
    return new Response("Forbidden", { status: 403 });
  }

  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (token) {
    const platform = await getPlatform();
    await deleteSession(platform.db, token);
  }
  const headers = new Headers({ Location: "/", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
  return new Response(null, { status: 303, headers });
}
