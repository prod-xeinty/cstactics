// Текущий публичный адрес Worker. При подключении собственного домена меняем его здесь.
export const SITE_ORIGIN = "https://cstactics.xeinty.workers.dev";
export const SITE_NAME = "КОЛЛ.GG";
export const OG_IMAGE_URL = `${SITE_ORIGIN}/og-default.png`;

export function tacticUrl(slug: string): string {
  return `${SITE_ORIGIN}/tactics/${encodeURIComponent(slug)}`;
}
