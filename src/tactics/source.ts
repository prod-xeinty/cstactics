import type { Database } from "@/platform";
import { listCatalog, type CatalogFilters, type CatalogTactic } from "./catalog";
import { fixtureClutches, fixtureTactics, type FixtureClutch, type FixtureTactic } from "./fixtures";

/** Компонент получает данные через props и не зависит от способа их чтения. */
export interface ListSource<T> {
  list(): Promise<readonly T[]>;
}

export function readList<T>(source: ListSource<T>): Promise<readonly T[]> {
  return source.list();
}

export const fixtureTacticSource: ListSource<FixtureTactic> = {
  async list() { return fixtureTactics; },
};

export const fixtureClutchSource: ListSource<FixtureClutch> = {
  async list() { return fixtureClutches; },
};

export function publishedTacticSource(db: Database, filters: CatalogFilters): ListSource<CatalogTactic> {
  return { list: () => listCatalog(db, filters) };
}
