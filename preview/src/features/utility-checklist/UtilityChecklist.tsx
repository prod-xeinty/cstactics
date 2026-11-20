import type {TacticNade} from "@/tactics/model";

import {formatNade} from "@/tactics/format";

import styles from "./UtilityChecklist.module.css";

interface UtilityChecklistProps {
    nades: readonly TacticNade[];
}

export function UtilityChecklist({
                                     nades,
                                 }: UtilityChecklistProps) {

    if (nades.length === 0) {
        return null;
    }

    return (
        <section className={styles.section}>
            <h2 className={styles.heading}>Гранаты</h2>

            <ol className={styles.list}
                aria-label="Список гранат">
                {nades.map((nade, index) => (
                    <li className={styles.item}
                        key={`${nade.who}-${nade.type}-${nade.to}-${index}`}>
            <span className={styles.number}>
              {String(index + 1).padStart(2, "0")}
            </span>

                        <p className={styles.description}>{formatNade(nade)}</p>
                    </li>
                ))}
            </ol>
        </section>
    );
}