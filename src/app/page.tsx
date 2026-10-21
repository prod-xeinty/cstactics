import { FeaturedTactic } from "@/features/featured-tactic/FeaturedTactic";
import { TacticFilters } from "@/features/tactic-filters/TacticFilters";
import { TacticList } from "@/features/tactic-list/TacticList";
import { parseTacticFilters } from "@/tactics/filter";
import { tacticsRepository } from "@/tactics/repository";

import styles from "./page.module.css";

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomeProps) {
  const filters = parseTacticFilters(await searchParams);
  const [featured, tactics] = await Promise.all([
    tacticsRepository.featured(filters),
    tacticsRepository.list(filters),
  ]);
  const alternatives = featured
    ? tactics.filter(({ id }) => id !== featured.id).slice(0, 3)
    : [];

  return (
    <div className={`site-shell ${styles.page}`}>
      <header className={styles.intro}>
        <p>Dust2 · готовый раунд за фризтайм</p>
        <h1>План на следующий раунд</h1>
        <p>Выбери сторону и состав — подкинем колл без длинной лекции.</p>
      </header>
      <TacticFilters filters={filters} />
      {featured ? <FeaturedTactic tactic={featured} band={filters.band} /> : <TacticList tactics={[]} band={filters.band} />}
      {featured ? (
        <section className={styles.alternatives} aria-labelledby="alternatives-title">
          <div className={styles.sectionHeading}>
            <h2 id="alternatives-title">Другие варианты</h2>
            <p>Полный каталог появится следующим этапом.</p>
          </div>
          <TacticList tactics={alternatives} band={filters.band} />
        </section>
      ) : null}
    </div>
  );
}
