import type { NextConfig } from "next";

const pages = process.env.CSTACTICS_PAGES === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/cstactics";
const nextConfig: NextConfig = pages ? {
  output: "export",
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  trailingSlash: true,
  images: { unoptimized: true },
} : {};

export default nextConfig;
