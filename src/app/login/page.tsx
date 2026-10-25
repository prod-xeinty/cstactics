import { getPlatform } from "@/platform";
import { turnstileConfig } from "@/auth/login-config";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  captcha: "Капча не прошла. Попробуй ещё раз.",
  unavailable: "Вход временно не работает. Мы уже чиним.",
};

// Временная страница входа (дизайн — #4/#6). Капча Turnstile, если включена, потом редирект в Steam.
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  let siteKey: string | null = null;
  try {
    const cfg = turnstileConfig(await getPlatform());
    if (cfg.mode === "on") siteKey = cfg.siteKey;
  } catch {
    // обычный next dev без Cloudflare — капчи нет
  }
  const error = params.error ? ERRORS[params.error] : undefined;

  return (
    <main>
      <h1>Вход</h1>
      <p>Заходим через Steam — пароль Steam мы не видим и не храним.</p>
      {error && <p role="alert">{error}</p>}
      <form method="post" action="/api/auth/steam/login">
        {siteKey && <div className="cf-turnstile" data-sitekey={siteKey} data-action="login" />}
        <button type="submit">Войти через Steam</button>
      </form>
      {siteKey && <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />}
    </main>
  );
}
