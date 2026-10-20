import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "КОЛЛ.GG — тактики для CS2",
  description: "Готовые планы раундов для команды на Dust2.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <a className="skip-link" href="#main-content">
          Перейти к содержимому
        </a>
        <header className="site-shell site-header">
          <Link className="site-logo" href="/" aria-label="КОЛЛ.GG — на главную">
            КОЛЛ<span>.GG</span>
          </Link>
          <nav aria-label="Основная навигация">
            <Link className="site-nav-link" href="/">
              Тактики
            </Link>
          </nav>
        </header>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
