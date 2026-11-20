import { Suspense } from "react";

import { CatalogResults, HomeCatalog } from "@/features/home-catalog/HomeCatalog";
import { parseTacticFilters } from "@/tactics/filter";
import { tacticsRepository } from "@/tactics/repository";

import styles from "./page.module.css";

export default async function HomePage() {
  const filters = parseTacticFilters({});
  const [tactics, drafts] = await Promise.all([
    tacticsRepository.list(filters),
    tacticsRepository.listDrafts(filters),
  ]);

  return (
    <div className={`site-shell ${styles.page}`}>
      <header className={styles.intro}>
        <p>Dust2 · готовый раунд за фризтайм</p>
        <h1>План на следующий раунд</h1>
        <p>Выбери сторону и состав — подкинем колл без длинной лекции.</p>
      </header>
      <Suspense fallback={<CatalogResults tactics={tactics} drafts={drafts} filters={filters} />}>
        <HomeCatalog tactics={tactics} drafts={drafts} />
      </Suspense>
    </div>
  );
}
