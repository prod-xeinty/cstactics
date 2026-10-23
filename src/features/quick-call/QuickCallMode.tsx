"use client";

import Link from "next/link";
import { useState } from "react";

import type { Tactic } from "@/tactics/model";

import styles from "./QuickCallMode.module.css";

import {
    getNextStep,
    getPrevStep,
} from "@/features/quick-call/step-navigation";

export interface QuickCallModeProps {
  tactic: Tactic;
  alternativeSlug: string | null;
}

export function QuickCallMode({ tactic, alternativeSlug }: QuickCallModeProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const lastStepIndex = tactic.quick.length - 1;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === lastStepIndex;

  const goBack = () => setStepIndex((current) => getPrevStep(current));
  const goNext = () => setStepIndex((current) => getNextStep(current, tactic.quick.length));

  return (
    <section className={styles.mode} aria-labelledby="quick-call-step">
      <div className={styles.progress}>
        <p>Шаг {stepIndex + 1} из {tactic.quick.length}</p>
        <div className={styles.track} aria-hidden="true">
          <span style={{ width: `${((stepIndex + 1) / tactic.quick.length) * 100}%` }} />
        </div>
      </div>

      <div className={styles.callout}>
        <p>Скажи команде</p>
        <h1 id="quick-call-step">{tactic.quick[stepIndex]}</h1>
      </div>

      <div className={styles.controls}>
        <button type="button" onClick={goBack} disabled={isFirstStep}>Назад</button>
        {isLastStep ? (
          <Link className={styles.primary} href={`/tactics/${tactic.slug}`}>
            Открыть полный план
          </Link>
        ) : (
          <button className={styles.primary} type="button" onClick={goNext}>Следующий шаг</button>
        )}
      </div>

      <ol className={styles.roles} aria-label="Роли команды">
        {tactic.roles.map((role, index) => (
          <li key={`${role.spawnZone}-${index}`} aria-label={`Роль ${index + 1}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{role.task}</strong>
              <p>{role.spawnZone} · {role.nades}</p>
            </div>
          </li>
        ))}
      </ol>

      {alternativeSlug ? <Link className={styles.alternative} href={`/call/${alternativeSlug}`}>Другой колл</Link> : null}
    </section>
  );
}
