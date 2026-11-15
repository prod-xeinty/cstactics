import { getPlatform, type Database } from "@/platform";
import type { Metadata } from "next";
import { hasPublishedTactics, parseCatalogFilters, type CatalogTactic } from "@/tactics/catalog";
import { fixtureTacticSource, publishedTacticSource, readList } from "@/tactics/source";
import { economyLabel, teamLabel } from "@/tactics/types";
import { OG_IMAGE_URL, SITE_NAME, SITE_ORIGIN } from "@/seo/site";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Тактики Dust2 | ${SITE_NAME}`,
  description: "Каталог тактик CS2 на Dust2: выбирай сторону, состав и FACEIT-шкалу.",
  alternates: { canonical: `${SITE_ORIGIN}/tactics` },
  openGraph: {
    title: `Тактики Dust2 | ${SITE_NAME}`, description: "Найди готовый раунд под свой состав.",
    url: `${SITE_ORIGIN}/tactics`, siteName: SITE_NAME, type: "website", locale: "ru_RU",
    images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: `${SITE_NAME} — тактики Dust2` }],
  },
};
const economyNames: Record<string, string> = { eco: "Эко", force: "Форс", full: "Фулл бай", any: "Любая" };

export default async function TacticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseCatalogFilters(await searchParams);
  const demoTactics = await readList(fixtureTacticSource);
  let published: readonly CatalogTactic[] = [];
  let hasPublished = false;
  let unavailable = false;
  let db: Database | null = null;
  try { db = (await getPlatform()).db; } catch { /* next dev без D1: показываем черновики */ }
  if (db) {
    try {
      [hasPublished, published] = await Promise.all([hasPublishedTactics(db), readList(publishedTacticSource(db, filters))]);
    } catch { unavailable = true; }
  }
  const showDemo = !hasPublished && !unavailable;
  const demo = showDemo ? demoTactics.filter((t) =>
    (filters.side === "all" || t.side === filters.side) && (filters.team === "all" || t.teamSize === Number(filters.team)),
  ) : [];

  return <main className={styles.page}>
    <header className={styles.intro}><p>КОЛЛ.GG / Dust2</p><h1>Каталог тактик</h1><span>Найди раунд под свой состав. Оценки появятся, когда игроки проверят тактики в игре.</span></header>
    <form method="get" action="/tactics" className={styles.filters} aria-label="Фильтры каталога">
      <label>Сторона<select name="side" defaultValue={filters.side}><option value="all">Все</option><option value="T">T</option><option value="CT">CT</option></select></label>
      <label>Состав<select name="team" defaultValue={filters.team}><option value="all">Любой</option><option value="2">Дуо</option><option value="3">Тройка</option><option value="5">Фулл стак</option></select></label>
      <label>Оценки и сортировка для<select name="band" defaultValue={filters.band}><option value="low">Лоу · 1–3 лвл</option><option value="mid">Мид · 4–7 лвл</option><option value="high">Хай · 8–10 лвл</option></select></label>
      <button type="submit">Показать</button><a href="/tactics" className={styles.reset}>Сбросить</a>
    </form>
    {unavailable ? <div className={styles.empty} role="alert"><h2>Каталог пока не загрузился</h2><p>Попробуй обновить страницу чуть позже.</p></div> : <>
      <div className={styles.resultHead}><p>Найдено: <b>{showDemo ? demo.length : published.length}</b> {showDemo ? "черновиков" : "тактик"}</p><p>Dust2 · {filters.band === "low" ? "Лоу" : filters.band === "high" ? "Хай" : "Мид"}</p></div>
      {showDemo && <p className={styles.demoBanner}>Пока нет опубликованных тактик. Показываем демо-черновики: гранаты ещё надо проверить в игре, голосовать за них нельзя.</p>}
      {showDemo ? (demo.length ? <div className={styles.grid}>{demo.map((t, i) => <article className={styles.card} key={t.title}><div className={styles.cardTop}><span>0{i + 1} / Dust2</span><span>Черновик</span></div><h2><a href={`/tactics/${t.slug}`}>{t.title}</a></h2><p className={styles.call}>{t.call}</p><div className={styles.meta}><span>{t.side}</span><span>{teamLabel(t.teamSize)}</span><span>{economyLabel(t.economy)}</span><span>Сложность {t.difficulty}/3</span></div><p className={styles.rating}>Мало голосов</p></article>)}</div> : <Empty />) : (published.length ? <div className={styles.grid}>{published.map((t, i) => <article className={styles.card} key={t.id}><div className={styles.cardTop}><span>0{i + 1} / Dust2</span><span>Проверено</span></div><h2><a href={`/tactics/${t.slug}`}>{t.title}</a></h2><p className={styles.call}>{t.call}</p><div className={styles.meta}><span>{t.side}</span><span>{t.teamSize} игрока</span><span>{economyNames[t.economy] ?? t.economy}</span><span>Сложность {t.difficulty}/3</span></div><p className={styles.rating}>{t.works === null ? `Мало голосов (${t.voteCount})` : `Работает ${t.works} · Легко зайти ${t.easy} · ${t.voteCount} голосов`}</p></article>)}</div> : <Empty />)}
    </>}
  </main>;
}

function Empty() { return <div className={styles.empty}><h2>Под этот фильтр пока пусто</h2><p>Попробуй другую сторону или состав.</p><a href="/tactics">Сбросить фильтры</a></div>; }
