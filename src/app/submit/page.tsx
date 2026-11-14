import { headers } from "next/headers";
import { getCurrentSession } from "@/auth/current-user";
import { readCookie, SESSION_COOKIE } from "@/auth/session";
import { csrfTokenFor } from "@/security/csrf";
import { SubmitForm } from "./SubmitForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const cookie = (await headers()).get("cookie");
  const session = await getCurrentSession(cookie);
  if (!session) return <main className={styles.page}><p className={styles.eyebrow}>Своя тактика</p><h1>Зайди через Steam</h1><p>Так мы сможем подписать тактику твоим ником и сообщить, когда её проверят.</p><a className={styles.action} href="/login">Войти через Steam</a></main>;
  const token = readCookie(cookie, SESSION_COOKIE);
  if (!token) return null;
  return <main className={styles.page}><p className={styles.eyebrow}>Из твоего блокнота</p><h1>Своя тактика</h1><p className={styles.lead}>Запиши раунд так, чтобы его можно было заколить во фризтайме. После отправки проверим в игре, потом покажем в каталоге.</p><SubmitForm csrf={await csrfTokenFor(token)} /></main>;
}
