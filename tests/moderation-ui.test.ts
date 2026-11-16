import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ModerationCard } from "@/app/moderation/ModerationCard";

describe("карточка заявки", () => {
  it("показывает текст игрока без исполнения HTML и даёт оба решения", () => {
    const html = renderToStaticMarkup(createElement(ModerationCard, { tactic: {
      id: "x", author: "<b>Автор</b>", createdAt: "2026-11-15T00:00:00.000Z",
      title: "<script>alert(1)</script>", side: "T", teamSize: 5, economy: "full", difficulty: 2,
      gameVersion: "v1", spawnDependent: false, call: "Идём на A", quick: ["Забираем лонг"],
      roles: [], roleFallback: "", nades: [], flow: "", fallback: "", postPlant: "", counters: "",
      videoUrl: "/media/media",
    }, csrf: "safe-token" }));
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;Автор&lt;/b&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Автор</b>");
    expect(html).toContain("value=\"published\"");
    expect(html).toContain("value=\"rejected\"");
    expect(html).toContain("Без привязки к спавну");
    expect(html).toContain("<video");
    expect(html).toContain("src=\"/media/media\"");
  });
});
