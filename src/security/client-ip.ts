/** IP клиента. На Cloudflare это CF-Connecting-IP (его ставит Cloudflare, клиент подделать не может). */
export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}
