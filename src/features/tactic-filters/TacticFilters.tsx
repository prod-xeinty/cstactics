"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";

import type { FaceitBand, Side, TacticFilters as Filters, TeamSize } from "@/tactics/model";

import styles from "./TacticFilters.module.css";

const defaults: Filters = { map: "dust2", side: "all", teamSize: "all", band: "mid" };

export function serializeTacticFilters(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.side !== defaults.side) params.set("side", filters.side);
  if (filters.teamSize !== defaults.teamSize) params.set("teamSize", String(filters.teamSize));
  if (filters.band !== defaults.band) params.set("band", filters.band);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function TacticFilters({ filters }: { filters: Filters }) {
  const router = useRouter();
  const replace = (next: Partial<Filters>) =>
    router.replace(serializeTacticFilters({ ...filters, ...next }));
  const changeSide = (event: ChangeEvent<HTMLSelectElement>) =>
    replace({ side: event.target.value as Side | "all" });
  const changeTeamSize = (event: ChangeEvent<HTMLSelectElement>) =>
    replace({
      teamSize: event.target.value === "all" ? "all" : (Number(event.target.value) as TeamSize),
    });
  const changeBand = (event: ChangeEvent<HTMLSelectElement>) =>
    replace({ band: event.target.value as FaceitBand });

  return (
    <form className={styles.filters} aria-label="Фильтры тактик" onSubmit={(event) => event.preventDefault()}>
      <label><span>Карта</span><select value="dust2" disabled><option value="dust2">Dust2</option></select></label>
      <label><span>Сторона</span><select value={filters.side} onChange={changeSide}><option value="all">Любая</option><option value="T">Атака · T</option><option value="CT">Защита · CT</option></select></label>
      <label><span>Состав</span><select value={filters.teamSize} onChange={changeTeamSize}><option value="all">Любой</option><option value="2">Дуо</option><option value="3">Тройка</option><option value="4">Четверо</option><option value="5">Фулл стак</option></select></label>
      <label><span>Оценки для</span><select value={filters.band} onChange={changeBand}><option value="low">Лоу · 1–3</option><option value="mid">Мид · 4–7</option><option value="high">Хай · 8–10</option></select></label>
      <button type="button" onClick={() => router.replace("/")}>Сбросить фильтры</button>
    </form>
  );
}
