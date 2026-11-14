import { headers } from "next/headers";
import { getCurrentSession } from "@/auth/current-user";
import { getPlatform } from "@/platform";
import { listPersonalized, type PersonalTactic } from "@/tactics/personalized";
import { PersonalTactics } from "./PersonalTactics";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function ForMePage() {
  const session = await getCurrentSession((await headers()).get("cookie"));
  if (!session) return <main className={styles.page}><p className={styles.eyebrow}>Под твоё эло</p><h1>Сначала зайди через Steam</h1><p>Тогда найдём твою FACEIT-группу и покажем, какие раунды заходят игрокам твоего уровня.</p><a className={styles.action} href="/login">Войти через Steam</a></main>;
  let tactics: PersonalTactic[] = [];
  let unavailable = false;
  try { tactics = await listPersonalized((await getPlatform()).db); } catch { unavailable = true; }
  return <main className={styles.page}><PersonalTactics tactics={tactics} unavailable={unavailable} /></main>;
}
