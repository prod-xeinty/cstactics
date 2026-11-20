import Image from "next/image";
import Link from "next/link";

import { UtilityChecklist } from "@/features/utility-checklist/UtilityChecklist";
import {
    formatDifficulty,
    formatEconomy,
    formatFaceitBand,
    formatRatingSummary,
    formatSide,
    formatTeamSize,
} from "@/tactics/format";
import type { FaceitBand, Tactic } from "@/tactics/model";

import styles from "./TacticDetails.module.css";

interface TacticDetailsProps {
    tactic: Tactic;
    latestPatchVersion?: string;
}

const faceitBands: readonly FaceitBand[] = ["low", "mid", "high"];
const dust2Overview = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/images/maps/dust2-overview.webp`;

export function TacticDetails({ tactic, latestPatchVersion }: TacticDetailsProps) {
    const { roles, roleFallback, flow, fallback, postPlant, counters } = tactic;
    const isDraft = tactic.status === "draft";
    const isDemo = tactic.gameVersion?.startsWith("demo-");
    const isCurrent = tactic.gameVersion === latestPatchVersion;
    const roundNotes = [
        { title: "Если пошло не так", text: fallback },
        { title: "Пост-плант", text: postPlant },
        { title: "Чем контрят", text: counters },
    ].filter(({ text }) => Boolean(text));

    return (
        <article className={styles.article}>
            <header className={styles.header}>
                <h1 className={styles.title}>{tactic.title}</h1>
                <p className={styles.call}>{tactic.call}</p>

                <Link
                    className={styles.quickCallLink}
                    href={`/call/${tactic.slug}`}
                >
                    Запустить быстрый колл
                </Link>
            </header>

            <dl className={styles.metadata}>
                <div className={styles.metadataItem}>
                    <dt className={styles.metadataLabel}>Сторона</dt>
                    <dd className={styles.metadataValue}>
                        {formatSide(tactic.side)}
                    </dd>
                </div>

                <div className={styles.metadataItem}>
                    <dt className={styles.metadataLabel}>Состав</dt>
                    <dd className={styles.metadataValue}>
                        {formatTeamSize(tactic.teamSize)}
                    </dd>
                </div>

                <div className={styles.metadataItem}>
                    <dt className={styles.metadataLabel}>Экономика</dt>
                    <dd className={styles.metadataValue}>
                        {formatEconomy(tactic.economy)}
                    </dd>
                </div>

                <div className={styles.metadataItem}>
                    <dt className={styles.metadataLabel}>Сложность</dt>
                    <dd className={styles.metadataValue}>
                        {formatDifficulty(tactic.difficulty)}
                    </dd>
                </div>

                <div className={styles.metadataItem}>
                    <dt className={styles.metadataLabel}>Зависит от спавна</dt>
                    <dd className={styles.metadataValue}>{tactic.spawnDependent ? "Да" : "Нет"}</dd>
                </div>

                <div className={styles.metadataItem}>
                    <dt className={styles.metadataLabel}>Версия CS2</dt>
                    <dd className={styles.metadataValue}>
                        {isDraft ? "На проверке в игре" : isDemo ? "Демо-версия" : tactic.gameVersion ?? "Версия не указана"}
                        {!isDraft && !isDemo && tactic.gameVersion && latestPatchVersion ? (
                            <span className={isCurrent ? styles.patchCurrent : styles.patchStale}>
                                {isCurrent ? "Чекнуто на новом патче" : "Не чекали после обновы"}
                            </span>
                        ) : null}
                    </dd>
                </div>
            </dl>

            <section className={styles.quick}>
                <h2 className={styles.sectionTitle}>Быстрая версия</h2>

                <ol
                    className={styles.quickList}
                    aria-label="Быстрая версия"
                >
                    {tactic.quick.map((step, index) => (
                        <li
                            className={styles.quickItem}
                            key={`${tactic.slug}-quick-${index}`}
                        >
                            {step}
                        </li>
                    ))}
                </ol>
            </section>

            <details className={styles.map}>
                <summary>Схема Dust2 с коллаутами</summary>
                <figure className={styles.mapFigure}>
                    <Image
                        className={styles.mapImage}
                        src={dust2Overview}
                        alt="Общая схема Dust2 с подписями позиций на A, Б и миде"
                        width={1208}
                        height={1302}
                        unoptimized
                    />
                    <figcaption>
                        <a href={dust2Overview}>Открыть схему в полном размере</a>
                    </figcaption>
                </figure>
            </details>

            {roles.length > 0 || roleFallback ? (
                <section className={styles.quick} aria-labelledby="tactic-roles">
                    <h2 id="tactic-roles" className={styles.sectionTitle}>Роли по спавнам</h2>
                    {roles.length > 0 ? (
                        <ul className={styles.roleList} role="list">
                            {roles.map((role, index) => (
                                <li className={styles.roleItem} key={`${role.spawnZone}-${index}`}>
                                    <p className={styles.roleSpawn}>{role.spawnZone}</p>
                                    <div>
                                        <p>{role.task}</p>
                                        {role.nades ? <p className={styles.roleNades}>Гранаты: {role.nades}</p> : null}
                                        {role.fixed ? <p className={styles.roleNades}>Фиксированная роль</p> : null}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    {roleFallback ? (
                        <div className={styles.roundNote}>
                            <h3>Запасной вариант по ролям</h3>
                            <p>{roleFallback}</p>
                        </div>
                    ) : null}
                </section>
            ) : null}

            <UtilityChecklist nades={tactic.nades} />

            {flow?.length ? (
                <section className={styles.quick} aria-labelledby="tactic-flow">
                    <h2 id="tactic-flow" className={styles.sectionTitle}>Ход раунда</h2>
                    <ol className={styles.quickList} role="list" aria-labelledby="tactic-flow">
                        {flow.map((step, index) => (
                            <li className={styles.quickItem} key={`${tactic.slug}-flow-${index}`}>{step}</li>
                        ))}
                    </ol>
                </section>
            ) : null}

            {roundNotes.length > 0 ? (
                <section className={styles.quick} aria-labelledby="tactic-round-notes">
                    <h2 id="tactic-round-notes" className={styles.sectionTitle}>Разбор раунда</h2>
                    {roundNotes.map(({ title, text }) => (
                        <div className={styles.roundNote} key={title}>
                            <h3>{title}</h3>
                            <p>{text}</p>
                        </div>
                    ))}
                </section>
            ) : null}

            {isDraft ? null : <section className={styles.quick} aria-labelledby="tactic-ratings">
                <h2 id="tactic-ratings" className={styles.sectionTitle}>Демо-оценки по FACEIT</h2>
                <div className={styles.ratingGrid}>
                    {faceitBands.map((band) => {
                        const rating = formatRatingSummary(tactic.ratings[band]);
                        return (
                            <div className={styles.ratingCard} key={band}>
                                <h3>{formatFaceitBand(band)}</h3>
                                {rating.enoughVotes ? (
                                    <dl>
                                        <div><dt>Работает</dt><dd>{rating.works} / 5</dd></div>
                                        <div><dt>Легко зайти</dt><dd>{rating.easy} / 5</dd></div>
                                    </dl>
                                ) : <p>Мало голосов</p>}
                                <p className={styles.voteCount}>{rating.votes}</p>
                            </div>
                        );
                    })}
                </div>
            </section>}
        </article>
    );
}
