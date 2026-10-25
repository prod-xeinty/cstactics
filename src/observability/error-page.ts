// Страница «что-то сломалось» с кодом ошибки — игрок присылает код, мы находим запрос в логах.
// Без внешних ресурсов и скриптов (CSP), ID уже очищен (requestIdFrom), но всё равно экранируем.

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function errorPage(requestId: string, status = 500): Response {
  const id = escapeHtml(requestId);
  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Что-то сломалось — КОЛЛ.GG</title>
<style>body{font-family:system-ui,sans-serif;background:#F3EFE4;color:#17243A;margin:0;padding:48px 16px}main{max-width:560px;margin:0 auto}code{font-family:ui-monospace,monospace;background:#FBF8F0;border:1px solid #C9C3B7;padding:2px 6px}a{color:#B64232}</style>
</head><body><main>
<h1>Что-то сломалось</h1>
<p>Это у нас, не у тебя. Попробуй обновить страницу через минуту.</p>
<p>Если повторяется — скинь нам код ошибки: <code>${id}</code></p>
<p><a href="/">На главную</a></p>
</main></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Request-Id": requestId },
  });
}
