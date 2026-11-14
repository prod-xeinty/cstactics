import type { ReactNode } from "react";
import { headers } from "next/headers";
import { getCurrentSession } from "@/auth/current-user";
import { readCookie, SESSION_COOKIE } from "@/auth/session";
import { CSRF_FIELD, csrfTokenFor } from "@/security/csrf";
import styles from "./layout.module.css";
import "./globals.css";

export const metadata = {
  title: "КОЛЛ.GG",
  description: "Тактики для CS2: готовые раунды под твой уровень на FACEIT",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookie = (await headers()).get("cookie");
  const session = await getCurrentSession(cookie);
  const sessionToken = session ? readCookie(cookie, SESSION_COOKIE) : null;
  const csrf = sessionToken ? await csrfTokenFor(sessionToken) : null;
  return (
    <html lang="ru">
      <body>
        <div className={styles.shell}>
          <header className={styles.header}>
            <div className={styles.headerInner}>
              <a href="/" className={styles.logo} aria-label="КОЛЛ.GG — на главную">КОЛЛ<span>.GG</span></a>
              <nav className={styles.nav} aria-label="Основная навигация">
                <a href="/">Тактики</a>
              </nav>
              {session ? (
                <div className={styles.account}>
                  <span className={styles.nickname} title={session.user.nickname}>{session.user.nickname}</span>
                  <form method="post" action="/api/auth/logout">
                    {csrf && <input type="hidden" name={CSRF_FIELD} value={csrf} />}
                    <button type="submit" className={styles.headerAction}>Выйти</button>
                  </form>
                </div>
              ) : (
                <a href="/login" className={styles.headerAction}>Войти через Steam</a>
              )}
            </div>
          </header>
          <div className={styles.content}>{children}</div>
          <footer className={styles.footer}>
            <div className={styles.footerInner}>
              <p>КОЛЛ.GG — готовые раунды для CS2</p>
              <p>Сейчас играем на Dust2</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
