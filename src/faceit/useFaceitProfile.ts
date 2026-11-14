"use client";

import { useEffect, useState } from "react";
import type { FaceitLookup } from "./client";

export function useFaceitProfile() {
  const [profile, setProfile] = useState<FaceitLookup | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/faceit/me", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data: unknown = await response.json();
        if (data && typeof data === "object" && "profile" in data) return data.profile as FaceitLookup;
        return { status: "unavailable" } as FaceitLookup;
      })
      .then(setProfile)
      .catch(() => { if (!controller.signal.aborted) setProfile({ status: "unavailable" }); });
    return () => controller.abort();
  }, []);
  return profile;
}
