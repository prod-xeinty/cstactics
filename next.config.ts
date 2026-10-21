import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Без оптимизации картинок на сборке и без `use cache`: во vinext поддержка частичная (AGENTS.md, раздел 8).
  images: { unoptimized: true },
  // `next dev` сам дописывает англоязычные блоки в AGENTS.md — а это общий файл для двух агентов. Выключаем.
  agentRules: false,
  experimental: { agentFeedback: false },
};

export default nextConfig;
