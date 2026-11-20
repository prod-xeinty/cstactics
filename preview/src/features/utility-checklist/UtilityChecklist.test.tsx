import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { tacticsFixtures } from "@/tactics/fixtures";

import { UtilityChecklist } from "./UtilityChecklist";

describe ("UtilityChecklist", () => {
    it ("содержит список гранат, гранаты и роли", () => {
        render(
            <UtilityChecklist nades={tacticsFixtures[0].nades} />,
        );

        const { container } = render(<UtilityChecklist nades={[]} />);

        expect(container).toBeEmptyDOMElement();

        expect(
            screen.getByRole("heading", { name: "Гранаты" }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("list", { name: "Список гранат" }),
        ).toBeInTheDocument();

        expect(screen.getAllByRole("listitem")).toHaveLength(2);

        expect(
            screen.getByText(
                "роль 2 → Смок → крест → когда лонг занят → закрыть проход с CT-спавна",
            ),
        ).toBeInTheDocument();
    })
})