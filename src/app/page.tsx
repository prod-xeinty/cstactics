import { headers } from "next/headers";
import { getCurrentSession } from "@/auth/current-user";
import { readCookie, SESSION_COOKIE } from "@/auth/session";
import { CSRF_FIELD, csrfTokenFor } from "@/security/csrf";
import { getPlatform } from "@/platform";
import { latestGamePatch } from "@/patches/repository";
import { PatchNotice } from "@/patches/PatchNotice";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

// Заглушка. Настоящая главная и шапка — задача #4; кнопка входа тут временно, чтобы проверить #9.
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [h, params] = await Promise.all([headers(), searchParams]);
  const session = await getCurrentSession(h.get("cookie"));
  const sessionToken = readCookie(h.get("cookie"), SESSION_COOKIE);
  const csrf = session && sessionToken ? await csrfTokenFor(sessionToken) : null;
  let patch = null;
  try {
    patch = await latestGamePatch((await getPlatform()).db);
  } catch {
    // В обычном next dev нет биндинга D1.
  }

  return (
    <main>
      <PatchNotice patch={patch} />
      <h1>КОЛЛ.GG</h1>
      <p>Каркас живой. Сайт скоро будет.</p>
      {params.login === "failed" && <p>Не вышло зайти через Steam. Попробуй ещё раз.</p>}
      {session ? (
        <form method="post" action="/api/auth/logout">
          {csrf && <input type="hidden" name={CSRF_FIELD} value={csrf} />}
          <p>
            Ты зашёл как <b>{session.user.nickname}</b>
          </p>
          <button type="submit">Выйти</button>
        </form>
      ) : (
        <p>
          <a href="/login">Войти через Steam</a>
        </p>
      )}
      {session && csrf && (session.user.role === "moderator" || session.user.role === "admin") && (
        <form method="post" action="/api/patches" className={styles.patchForm}>
          <h2>Добавить обнову CS2</h2>
          <input type="hidden" name={CSRF_FIELD} value={csrf} />
          <label>Версия <input name="version" required maxLength={80} /></label>
          <label>Дата <input name="releasedAt" type="date" required /></label>
          <button type="submit">Добавить обнову</button>
        </form>
      )}
    </main>
  );
}
