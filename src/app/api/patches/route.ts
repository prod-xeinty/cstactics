import { getPlatform } from "@/platform";
import { getCurrentSession } from "@/auth/current-user";
import { readCookie, SESSION_COOKIE } from "@/auth/session";
import { isSameOrigin, isValidCsrfToken, submittedCsrfToken } from "@/security/csrf";
import { clientIp } from "@/security/client-ip";
import { enforceRateLimit } from "@/security/rate-limit";
import { addGamePatch, latestGamePatch, newPatchSchema } from "@/patches/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const platform = await getPlatform();
  return Response.json({ patch: await latestGamePatch(platform.db) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });

  const session = await getCurrentSession(request.headers.get("cookie"));
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.role !== "moderator" && session.user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!(await isValidCsrfToken(token, await submittedCsrfToken(request)))) {
    return new Response("Forbidden", { status: 403 });
  }

  const platform = await getPlatform();
  const limited = await enforceRateLimit(platform.rateLimiter, "patch", `${session.user.id}:${clientIp(request)}`);
  if (limited) return limited;

  const form = await request.formData();
  const parsed = newPatchSchema.safeParse({ version: form.get("version"), releasedAt: form.get("releasedAt") });
  if (!parsed.success) return new Response("Нужны версия и дата обновы", { status: 400 });
  const added = await addGamePatch(platform.db, parsed.data, new Date());
  if (!added) return new Response("Такая версия уже есть", { status: 409 });
  return new Response(null, { status: 303, headers: { Location: "/", "Cache-Control": "no-store" } });
}
