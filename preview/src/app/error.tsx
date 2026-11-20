"use client";

import { ErrorState } from "@/shared/ui/states/ErrorState";

import styles from "./page.module.css";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={`site-shell ${styles.error}`}>
      <ErrorState onRetry={reset} />
    </div>
  );
}
