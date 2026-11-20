import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TacticDetails } from "@/features/tactic-details/TacticDetails";
import { latestKnownPatch } from "@/patches/fixtures";
import type { TacticFilters } from "@/tactics/model";
import { tacticsRepository } from "@/tactics/repository";

import styles from "./page.module.css";

interface TacticPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  const filters: TacticFilters = {
    map: "dust2",
    side: "all",
    teamSize: "all",
    band: "mid",
  };
  const [tactics, drafts] = await Promise.all([
    tacticsRepository.list(filters),
    tacticsRepository.listDrafts(filters),
  ]);

  return [...tactics, ...drafts].map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: TacticPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tactic = await tacticsRepository.bySlug(slug);

  return tactic
    ? { title: `${tactic.title} · КОЛЛ.GG` }
    : { title: "Тактика не найдена · КОЛЛ.GG" };
}

export default async function TacticPage({ params }: TacticPageProps) {
  const { slug } = await params;
  const tactic = await tacticsRepository.bySlug(slug);
  if (!tactic) notFound();

  return (
    <div className={`site-shell ${styles.page}`}>
      <header className={styles.header}>
        <Link href="/">← К тактикам</Link>
        <p>Dust2 · разбор раунда</p>
      </header>
      <TacticDetails tactic={tactic} latestPatchVersion={latestKnownPatch?.version} />
    </div>
  );
}
