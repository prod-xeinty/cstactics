import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QuickCallMode } from "@/features/quick-call/QuickCallMode";
import { tacticsRepository } from "@/tactics/repository";

import styles from "./page.module.css";

interface QuickCallPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: QuickCallPageProps): Promise<Metadata> {
  const tactic = await tacticsRepository.bySlug((await params).slug);

  return tactic
    ? { title: `${tactic.title} — быстрый колл · КОЛЛ.GG` }
    : { title: "Колл не найден · КОЛЛ.GG" };
}

export default async function QuickCallPage({ params }: QuickCallPageProps) {
  const tactic = await tacticsRepository.bySlug((await params).slug);
  if (!tactic) notFound();

  const related = await tacticsRepository.list({
    map: tactic.map,
    side: tactic.side,
    teamSize: tactic.teamSize,
    band: "mid",
  });
  const alternativeSlug = related.find(({ slug }) => slug !== tactic.slug)?.slug ?? null;

  return (
    <div className={`site-shell ${styles.page}`}>
      <header className={styles.header}>
        <Link href="/">← К рекомендациям</Link>
        <p>Freeze time · Dust2</p>
        <h2>{tactic.title}</h2>
      </header>
      <QuickCallMode tactic={tactic} alternativeSlug={alternativeSlug} />
    </div>
  );
}
