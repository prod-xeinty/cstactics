/**
 * Ключ клиента для лимитов. На Cloudflare это CF-Connecting-IP (его ставит Cloudflare, клиент подделать не может).
 * IPv6 сводим к подсети /64: у одного абонента обычно целая /64, и перебор адресов внутри неё не должен обходить лимит.
 */
export function clientIp(request: Request): string {
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) return "unknown";
  // IPv4 в IPv6-записи (::ffff:1.2.3.4) — это обычный IPv4-клиент.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) return mapped[1];
  return ip.includes(":") ? ipv6Prefix64(ip) : ip;
}

export function ipv6Prefix64(ip: string): string {
  const addr = ip.split("%")[0].toLowerCase();
  const [head, tail = ""] = addr.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = addr.includes("::") && tail ? tail.split(":") : [];
  const missing = addr.includes("::") ? 8 - headParts.length - tailParts.length : 0;
  const full = [...headParts, ...Array(Math.max(0, missing)).fill("0"), ...tailParts];
  return `${full
    .slice(0, 4)
    .map((h) => (h ? h.replace(/^0+(?=.)/, "") : "0"))
    .join(":")}::/64`;
}
