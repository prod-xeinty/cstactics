import type { Metadata } from "next";
import type { ReactNode } from "react";

import { latestKnownPatch } from "@/patches/fixtures";
import { shouldShowPatchNotice } from "@/patches/notice";
import { PatchNotice } from "@/shared/ui/patch-notice/PatchNotice";
import { SiteHeader } from "@/shared/ui/site-header/SiteHeader";
import { tacticsFixtures } from "@/tactics/fixtures";

import "./globals.css";

export const metadata: Metadata = {
  title: "КОЛЛ.GG — тактики для CS2",
  description: "Готовые планы раундов для команды на Dust2.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const showPatchNotice = shouldShowPatchNotice(latestKnownPatch, tacticsFixtures);

  return (
    <html lang="ru">
      <body>
        <a className="skip-link" href="#main-content">
          Перейти к содержимому
        </a>
        {showPatchNotice && latestKnownPatch ? (
          <PatchNotice
            version={latestKnownPatch.version}
            releasedAt={latestKnownPatch.releasedAt}
          />
        ) : null}
        <SiteHeader />
        <main id="main-content">{children}</main>
        <footer className="site-shell site-footer">
          <p>КОЛЛ.GG · демо-тактики Dust2</p>
          <p>Чекайте гранаты в оффлайне перед каткой.</p>
        </footer>
      </body>
    </html>
  );
}
