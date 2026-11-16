import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseStorage } from "@/platform/supabase-storage";

const config = {
  url: "https://inqwhzfhxkxaznckypdw.supabase.co",
  secretKey: "server-secret",
};

describe("Supabase Storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("не принимает произвольный origin для серверного ключа", () => {
    expect(() => createSupabaseStorage({ ...config, url: "http://example.test" }, "private-bucket")).toThrow("SUPABASE_URL");
    expect(() => createSupabaseStorage({ ...config, url: "https://example.test" }, "private-bucket")).toThrow("SUPABASE_URL");
  });

  it("загружает объект без upsert и не кладёт ключ в URL", async () => {
    const fetchMock = vi.fn(async () => Response.json([]));
    vi.stubGlobal("fetch", fetchMock);
    const storage = createSupabaseStorage(config, "private-bucket");

    await storage.put("pending/тактика/video.mp4", new Uint8Array([1, 2, 3]).buffer, {
      contentType: "video/mp4",
      onlyIfAbsent: true,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://inqwhzfhxkxaznckypdw.supabase.co/storage/v1/object/private-bucket/pending/%D1%82%D0%B0%D0%BA%D1%82%D0%B8%D0%BA%D0%B0/video.mp4");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers)).toMatchObject({});
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer server-secret");
    expect(new Headers(init.headers).get("apikey")).toBe("server-secret");
    expect(new Headers(init.headers).get("x-upsert")).toBe("false");
    expect(new Headers(init.headers).get("content-type")).toBe("video/mp4");
    expect(url).not.toContain("server-secret");
  });

  it("для нового sb_secret использует только apikey, а legacy JWT также Bearer", async () => {
    const fetchMock = vi.fn(async () => Response.json([]));
    vi.stubGlobal("fetch", fetchMock);
    await createSupabaseStorage({ ...config, secretKey: "sb_secret_test" }, "private-bucket").list();
    let headers = new Headers((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers);
    expect(headers.get("apikey")).toBe("sb_secret_test");
    expect(headers.get("authorization")).toBeNull();
    fetchMock.mockClear();
    await createSupabaseStorage({ ...config, secretKey: "eyJlegacy" }, "private-bucket").list();
    headers = new Headers((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers);
    expect(headers.get("authorization")).toBe("Bearer eyJlegacy");
  });

  it("возвращает поток вместе с фактическими метаданными и скрывает 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "video/webm", "content-length": "3" } }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const storage = createSupabaseStorage(config, "private-bucket");

    const object = await storage.get("pending/video.webm");
    expect(object).not.toBeNull();
    expect(object && { size: object.size, contentType: object.contentType }).toEqual({ size: 3, contentType: "video/webm" });
    expect(new Uint8Array(await new Response(object!.body).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(await storage.get("missing.webm")).toBeNull();
  });

  it("скачивает только запрошенный диапазон и проверяет ответ origin", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([2, 3]), { status: 206, headers: {
      "content-type": "video/webm", "content-length": "2", "content-range": "bytes 1-2/4",
    } }));
    vi.stubGlobal("fetch", fetchMock);
    const storage = createSupabaseStorage(config, "private-bucket");
    const object = await storage.get("video.webm", { start: 1, end: 2 });
    expect(new Headers((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers).get("range")).toBe("bytes=1-2");
    expect(object?.size).toBe(4);
    expect(new Uint8Array(await new Response(object!.body).arrayBuffer())).toEqual(new Uint8Array([2, 3]));
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }));
    await expect(storage.get("video.webm", { start: 1, end: 2 })).rejects.toThrow("диапазон");
  });

  it("показывает код ошибки Supabase без содержимого ответа", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("внутренние детали", { status: 507 })));
    const storage = createSupabaseStorage(config, "private-bucket");
    await expect(storage.list({ limit: 1 })).rejects.toThrow("Supabase Storage: 507");
    await expect(storage.list({ limit: 1 })).rejects.not.toThrow("внутренние детали");
  });
});
