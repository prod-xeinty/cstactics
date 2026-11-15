import { notFound } from "next/navigation";
import { demoTactics } from "@/app/home-data";
import { getPlatform } from "@/platform";
import { getPublishedDetail, type TacticDetail } from "@/tactics/detail";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const economyNames: Record<string, string> = { eco: "Эко", force: "Форс", full: "Фулл бай", any: "Любая" };
const nadeNames: Record<string, string> = { smoke: "Смок", flash: "Флешка", molotov: "Молик", he: "Хаешка", decoy: "Декой" };
const bands = [{ key: "low", label: "Лоу · 1–3" }, { key: "mid", label: "Мид · 4–7" }, { key: "high", label: "Хай · 8–10" }] as const;

function demoDetail(slug: string): TacticDetail | null {
  const tactic = demoTactics.find((item) => item.slug === slug);
  if (!tactic) return null;
  return {
    id: tactic.slug, slug: tactic.slug, title: tactic.title, call: tactic.call, quick: [...tactic.quick],
    side: tactic.side, teamSize: tactic.teamSize, economy: tactic.economy, difficulty: Number(tactic.difficulty[0]),
    gameVersion: "", author: "", source: "authors", roles: [], roleFallback: "", nades: [], flow: [],
    fallback: "", postPlant: "", counters: "", videoUrl: null,
    ratings: {
      low: { votes: 0, works: null, easy: null }, mid: { votes: 0, works: null, easy: null },
      high: { votes: 0, works: null, easy: null }, none: { votes: 0, works: null, easy: null },
    },
  };
}

export default async function TacticDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const demo = demoDetail(slug);
  let detail: TacticDetail | null = null;
  try { detail = await getPublishedDetail((await getPlatform()).db, slug); }
  catch { if (!demo) return <main className={styles.page}><a className={styles.back} href="/tactics">← В каталог</a><div className={styles.notice} role="alert"><h1>Разбор пока не загрузился</h1><p>Попробуй открыть страницу чуть позже.</p></div></main>; }
  detail ??= demo;
  if (!detail) notFound();
  const isDemo = detail === demo;
  return <main className={styles.page}>
    <a className={styles.back} href="/tactics">← Все тактики</a>
    <header className={styles.hero}>
      <div className={styles.kicker}><span>КОЛЛ.GG / Dust2 / {detail.side}</span><span>{isDemo ? "Демо-черновик" : "Разбор тактики"}</span></div>
      <h1>{detail.title}</h1>
      <p className={styles.call}>{detail.call}</p>
      <div className={styles.meta}><span>Dust2</span><span>{detail.side}</span><span>{detail.teamSize} игроков</span><span>{economyNames[detail.economy] ?? detail.economy}</span><span>Сложность {detail.difficulty}/3</span>{detail.gameVersion && <span>Версия: {detail.gameVersion}</span>}</div>
      {isDemo ? <p className={styles.warning}>Это демо-черновик. Тактику и гранаты ещё надо проверить в игре. Голосовать пока нельзя.</p> : <p className={styles.byline}>{detail.source === "player" ? `От игрока ${detail.author}` : "От авторов КОЛЛ.GG"}</p>}
    </header>
    <div className={styles.columns}>
      <div className={styles.primary}>
        <section className={styles.section} aria-labelledby="quick"><div className={styles.sectionHead}><span>01</span><h2 id="quick">Быстрая версия</h2></div>{detail.quick.length ? <ol className={styles.steps}>{detail.quick.map((line, i) => <li key={i}><span>0{i + 1}</span><p>{line}</p></li>)}</ol> : <Empty />}</section>
        <section className={styles.section} aria-labelledby="roles"><div className={styles.sectionHead}><span>02</span><h2 id="roles">Роли по спавну</h2></div>{detail.roles.length ? <ol className={styles.roles}>{detail.roles.map((role, i) => <li key={i}><span className={styles.roleNumber}>{i + 1}</span><div><h3>{role.spawnZone || `Роль ${i + 1}`}{role.fixed && <small> · фиксированная</small>}</h3><p>{role.task}</p>{role.nades && <p className={styles.muted}>Гранаты: {role.nades}</p>}</div></li>)}</ol> : <Empty />}{detail.roleFallback && <p className={styles.note}><b>Если нужного спавна нет:</b> {detail.roleFallback}</p>}</section>
        <section className={styles.section} aria-labelledby="nades"><div className={styles.sectionHead}><span>03</span><h2 id="nades">Гранаты</h2></div>{detail.nades.length ? <ol className={styles.nades}>{detail.nades.map((nade, i) => <li key={i}><span className={styles.nadeNumber}>{String(i + 1).padStart(2, "0")}</span><div><h3>{nadeNames[nade.type] ?? nade.type} → {nade.to}</h3><p>{nade.who}{nade.from ? ` · откуда: ${nade.from}` : ""}</p><p><b>Когда:</b> {nade.when}</p><p><b>Зачем:</b> {nade.why}</p></div></li>)}</ol> : <Empty />}</section>
        <section className={styles.section} aria-labelledby="flow"><div className={styles.sectionHead}><span>04</span><h2 id="flow">Ход раунда</h2></div>{detail.flow.length ? <ol className={styles.textList}>{detail.flow.map((line, i) => <li key={i}>{line}</li>)}</ol> : <Empty />}</section>
      </div>
      <aside className={styles.secondary} aria-label="Дополнения к разбору">
        <section className={styles.sideSection}><h2>Если пошло не так</h2>{detail.fallback ? <p>{detail.fallback}</p> : <Empty />}</section>
        <section className={styles.sideSection}><h2>Пост-плант</h2>{detail.postPlant ? <p>{detail.postPlant}</p> : <Empty />}</section>
        <section className={styles.sideSection}><h2>Чем контрят</h2>{detail.counters ? <p>{detail.counters}</p> : <Empty />}</section>
        <section className={styles.sideSection}><h2>Видео</h2>{detail.videoUrl ? <video controls preload="metadata" src={detail.videoUrl} className={styles.video}>Твой браузер не поддерживает видео.</video> : <Empty />}</section>
        <section className={styles.sideSection}><h2>Оценки игроков</h2>{isDemo ? <p className={styles.muted}>Откроем после проверки в игре.</p> : <div className={styles.ratings}>{bands.map(({ key, label }) => <div key={key}><h3>{label}</h3><p>{detail.ratings[key].works === null ? `Мало голосов (${detail.ratings[key].votes}/5)` : `Работает ${detail.ratings[key].works}/5 · Легко зайти ${detail.ratings[key].easy}/5`}</p></div>)}</div>}</section>
      </aside>
    </div>
    <a className={styles.endLink} href="/tactics">← Вернуться в каталог</a>
  </main>;
}

function Empty() { return <p className={styles.muted}>Пока не добавлено.</p>; }
