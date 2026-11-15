import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCurrentSession } from "@/auth/current-user";
import { readCookie, SESSION_COOKIE } from "@/auth/session";
import { getPlatform } from "@/platform";
import { csrfTokenFor } from "@/security/csrf";
import { listPendingTactics } from "@/tactics/moderation";
import { ModerationCard } from "./ModerationCard";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Тактики на проверке | КОЛЛ.GG", robots: { index: false, follow: false } };

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const cookie = (await headers()).get("cookie");
  const session = await getCurrentSession(cookie);
  if (!session || (session.user.role !== "moderator" && session.user.role !== "admin")) notFound();
  const token = readCookie(cookie, SESSION_COOKIE);
  if (!token) notFound();
  const csrf = await csrfTokenFor(token);
  const tactics = await listPendingTactics((await getPlatform()).db);
  const done = (await searchParams).done;
  return <main className={styles.page}>
    <header className={styles.intro}><p>КОЛЛ.GG / проверка</p><h1>Тактики на проверке</h1><span>Сначала прогоняем раунд в игре. Затем публикуем или сохраняем причину отклонения.</span></header>
    {(done === "published" || done === "rejected") && <p className={styles.notice} role="status">{done === "published" ? "Тактика опубликована." : "Тактика отклонена, причина сохранена."}</p>}
    <p className={styles.count}>В очереди: {tactics.length}{tactics.length === 50 && "+"}</p>
    {tactics.length ? <div className={styles.list}>{tactics.map((tactic) => <ModerationCard key={tactic.id} tactic={tactic} csrf={csrf} />)}</div> : <div className={styles.empty}><h2>Очередь пустая</h2><p>Новых раундов от игроков пока нет.</p></div>}
  </main>;
}
