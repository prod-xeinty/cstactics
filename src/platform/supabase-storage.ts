import type { ObjectStorage, StoredObjectInfo } from "./types";

export interface SupabaseStorageConfig {
  url: string;
  serviceRoleKey: string;
}

function projectUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("SUPABASE_URL должен быть адресом проекта Supabase"); }
  if (url.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) || url.username || url.password || url.port) {
    throw new Error("SUPABASE_URL должен быть HTTPS-адресом проекта *.supabase.co");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

const pathPart = (value: string) => value.split("/").map(encodeURIComponent).join("/");

export function createSupabaseStorage(config: SupabaseStorageConfig, bucket: string): ObjectStorage {
  const base = projectUrl(config.url);
  if (!config.serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY не задан");
  if (!bucket || bucket.includes("/")) throw new Error("Некорректное имя бакета Supabase");
  const headers = () => ({ Authorization: `Bearer ${config.serviceRoleKey}`, apikey: config.serviceRoleKey });
  const endpoint = (key = "") => new URL(`storage/v1/object/${encodeURIComponent(bucket)}${key ? `/${pathPart(key)}` : ""}`, base).toString();
  const checked = async (response: Response) => {
    if (!response.ok) throw new Error(`Supabase Storage: ${response.status}`);
    return response;
  };

  return {
    async list(options) {
      const response = await checked(await fetch(endpoint().replace("/object/", "/object/list/"), {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: options?.prefix ?? "", limit: options?.limit ?? 100, offset: 0 }),
      }));
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("Supabase Storage: некорректный ответ списка");
      return data.flatMap((item): StoredObjectInfo[] => {
        if (!item || typeof item !== "object" || !("name" in item) || typeof item.name !== "string") return [];
        const metadata = "metadata" in item && item.metadata && typeof item.metadata === "object" ? item.metadata : null;
        const size = metadata && "size" in metadata && typeof metadata.size === "number" ? metadata.size : 0;
        return [{ key: item.name, size }];
      });
    },
    async put(key, body, options) {
      await checked(await fetch(endpoint(key), {
        method: "POST",
        headers: {
          ...headers(),
          "Content-Type": options?.contentType ?? "application/octet-stream",
          "x-upsert": options?.onlyIfAbsent === false ? "true" : "false",
        },
        body,
      }));
    },
    async get(key) {
      const response = await fetch(endpoint(key), { headers: headers() });
      if (response.status === 404) return null;
      await checked(response);
      if (!response.body) throw new Error("Supabase Storage: пустой ответ объекта");
      const rawSize = response.headers.get("content-length");
      const size = rawSize !== null && /^\d+$/.test(rawSize) ? Number(rawSize) : null;
      return { body: response.body, size, contentType: response.headers.get("content-type") };
    },
    async delete(key) {
      const response = await fetch(endpoint(key), { method: "DELETE", headers: headers() });
      if (response.status !== 404) await checked(response);
    },
  };
}
