import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { patchNoticeStorageKey } from "@/patches/storage";

import { PatchNotice } from "./PatchNotice";

describe("PatchNotice", () => {
  beforeEach(() => window.localStorage.clear());

  it("закрывается и сохраняет версию патча", async () => {
    const user = userEvent.setup();
    render(<PatchNotice version="2.1" releasedAt="20 октября" />);

    await user.click(screen.getByRole("button", { name: "Закрыть предупреждение" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(patchNoticeStorageKey("2.1"))).toBe("dismissed");
  });
});
