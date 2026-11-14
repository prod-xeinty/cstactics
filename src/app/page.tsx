import { headers } from "next/headers";
import { getCurrentSession } from "@/auth/current-user";
import { readCookie, SESSION_COOKIE } from "@/auth/session";
import { CSRF_FIELD, csrfTokenFor } from "@/security/csrf";
import { getPlatform } from "@/platform";
import { latestGamePatch } from "@/patches/repository";
import { PatchNotice } from "@/patches/PatchNotice";
import { TacticCarousel } from "./TacticCarousel";
import { demoTactics } from "./home-data";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [h, params] = await Promise.all([headers(), searchParams]);
  const session = await getCurrentSession(h.get("cookie"));
  const sessionToken = readCookie(h.get("cookie"), SESSION_COOKIE);
  const csrf = session && sessionToken ? await csrfTokenFor(sessionToken) : null;
  let patch = null;
  try { patch = await latestGamePatch((await getPlatform()).db); } catch { /* next dev без D1 */ }
  return <main>
    <PatchNotice patch={patch} />
    {params.login === "failed" && <p role="alert" className={styles.loginError}>Не вышло зайти через Steam. Попробуй ещё раз.</p>}
    <div className={styles.container}>
      <TacticCarousel />
      <section className={styles.more} id="tactics" aria-labelledby="more-heading">
        <div className={styles.sectionIntro}><p className={styles.eyebrow}>Из блокнота</p><h2 id="more-heading">Ещё раунды на Dust2</h2><p>Пока это черновики. Проверим их в игре — тогда откроем оценки и полный разбор.</p></div>
        <div className={styles.tacticList}>{demoTactics.map((tactic, index) => <article key={tactic.title} className={styles.tacticRow}><span className={styles.rowNumber}>0{index + 1}</span><div><h3>{tactic.title}</h3><p>{tactic.call}</p></div><span className={styles.rowMeta}>{tactic.side} · {tactic.team}</span></article>)}</div>
      </section>
      <section className={styles.explainer} aria-labelledby="explainer-heading">
        <p className={styles.eyebrow}>Как это работает</p><h2 id="explainer-heading">Раунд, который можно заколить быстро</h2>
        <div className={styles.steps}><p><b>01 / Выбирай состав</b><span>Дуо, тройка или полный стак.</span></p><p><b>02 / Читай колл</b><span>Короткая версия — перед раундом, детали — перед каткой.</span></p><p><b>03 / Сверяй свой уровень</b><span>Когда появятся проверенные тактики и голоса, покажем оценки игроков твоей FACEIT-группы.</span></p></div>
      </section>
      {session && csrf && (session.user.role === "moderator" || session.user.role === "admin") && <form method="post" action="/api/patches" className={styles.patchForm}><h2>Добавить обнову CS2</h2><input type="hidden" name={CSRF_FIELD} value={csrf} /><label>Версия <input name="version" required maxLength={80} /></label><label>Дата <input name="releasedAt" type="date" required /></label><button type="submit">Добавить обнову</button></form>}
    </div>
  </main>;
}
