import { headers } from "next/headers";
import { getCurrentSession } from "@/auth/current-user";

export const dynamic = "force-dynamic";

// Заглушка. Настоящая главная и шапка — задача #4; кнопка входа тут временно, чтобы проверить #9.
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [h, params] = await Promise.all([headers(), searchParams]);
  const session = await getCurrentSession(h.get("cookie"));

  return (
    <main>
      <h1>КОЛЛ.GG</h1>
      <p>Каркас живой. Сайт скоро будет.</p>
      {params.login === "failed" && <p>Не вышло зайти через Steam. Попробуй ещё раз.</p>}
      {session ? (
        <form method="post" action="/api/auth/logout">
          <p>
            Ты зашёл как <b>{session.user.nickname}</b>
          </p>
          <button type="submit">Выйти</button>
        </form>
      ) : (
        <p>
          <a href="/api/auth/steam/login">Войти через Steam</a>
        </p>
      )}
    </main>
  );
}
