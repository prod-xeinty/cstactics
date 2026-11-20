import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { tacticsFixtures } from "@/tactics/fixtures";
import type { Tactic } from "@/tactics/model";

import { TacticDetails } from "./TacticDetails";

describe("TacticDetails", () => {
    it("показывает название тактики", () => {
        const tactic = tacticsFixtures[0];

        render(<TacticDetails tactic={tactic} />);

        expect(
            screen.getByRole("heading", { name: tactic.title }),
        ).toBeInTheDocument();
    });

    it("показывает основной колл", () => {
        const tactic = tacticsFixtures[0];

        render(<TacticDetails tactic={tactic} />);

        expect(
            screen.getByText(tactic.call),
        ).toBeInTheDocument();
    });

    it("показывает шаги быстрой версии по порядку", () => {
        const tactic = tacticsFixtures[0];

        render(<TacticDetails tactic={tactic} />);

        const list = screen.getByRole("list", {
            name: "Быстрая версия",
        });

        const items = within(list).getAllByRole("listitem");

        expect(items).toHaveLength(3);
        expect(items[0]).toHaveTextContent(
            "Трое забирают лонг, двое ждут в нижнем миде",
        );
        expect(items[1]).toHaveTextContent(
            "Смок на CT-спавн и на крест, флешка над дверями лонга",
        );
        expect(items[2]).toHaveTextContent(
            "Встал смок на крест — заходим с двух сторон разом",
        );
    });

    it("показывает основные характеристики тактики", () => {
        const tactic = tacticsFixtures[0];

        render(<TacticDetails tactic={tactic} />);

        expect(
            screen.getByText("Атака · T"),
        ).toBeInTheDocument();

        expect(
            screen.getByText("Фулл стак"),
        ).toBeInTheDocument();

        expect(
            screen.getByText("Фулл бай"),
        ).toBeInTheDocument();

        expect(
            screen.getByText("Средняя · 2/3"),
        ).toBeInTheDocument();
    });

    it.each([
        ["2.1", "2.1", "Чекнуто на новом патче"],
        ["2.0", "2.1", "Не чекали после обновы"],
        ["demo-2026-10", "demo-2026-10", "Демо-версия"],
    ])("показывает статус версии %s относительно %s", (gameVersion, latestPatchVersion, label) => {
        const tactic = { ...tacticsFixtures[0], gameVersion };
        render(<TacticDetails tactic={tactic} latestPatchVersion={latestPatchVersion} />);

        expect(screen.getByText(label)).toBeInTheDocument();
        if (gameVersion.startsWith("demo-")) {
            expect(screen.queryByText("Чекнуто на новом патче")).not.toBeInTheDocument();
        }
    });

    it("сравнивает три шкалы FACEIT и скрывает баллы при числе голосов меньше пяти", () => {
        const fixture = tacticsFixtures[0];
        const tactic = {
            ...fixture,
            ratings: { ...fixture.ratings, low: { ...fixture.ratings.low, voteCount: 4 } },
        };
        render(<TacticDetails tactic={tactic} />);

        const ratings = within(screen.getByRole("region", { name: "Демо-оценки по FACEIT" }));
        expect(ratings.getAllByRole("heading", { level: 3 })).toHaveLength(3);
        expect(ratings.getByText("Мало голосов")).toBeInTheDocument();
        expect(ratings.getByText("4 голоса")).toBeInTheDocument();
        expect(ratings.getAllByText("Работает")).toHaveLength(2);
        expect(ratings.getAllByText("Легко зайти")).toHaveLength(2);
    });

    it("показывает гранаты тактики", () => {
        const tactic = tacticsFixtures[0];

        render(<TacticDetails tactic={tactic} />);

        expect(
            screen.getByRole("heading", { name: "Гранаты" }),
        ).toBeInTheDocument();

        const nadeList = screen.getByRole("list", {
            name: "Список гранат",
        });

        expect(
            within(nadeList).getAllByRole("listitem"),
        ).toHaveLength(2);

        expect(
            within(nadeList).getByText(
                "роль 2 → Смок → крест → когда лонг занят → закрыть проход с CT-спавна",
            ),
        ).toBeInTheDocument();
    });

    it("показывает роли, гранаты и запасной вариант по ролям", () => {
        const tactic = tacticsFixtures[0];
        const [firstRole, ...otherRoles] = tactic.roles;
        render(<TacticDetails tactic={{ ...tactic, roles: [{ ...firstRole, fixed: true }, ...otherRoles] }} />);

        const roles = within(screen.getByRole("region", { name: "Роли по спавнам" }));
        const items = roles.getAllByRole("listitem");
        expect(items).toHaveLength(tactic.roles.length);
        expect(within(items[0]).getByText(firstRole.spawnZone)).toBeInTheDocument();
        expect(within(items[0]).getByText(firstRole.task)).toBeInTheDocument();
        expect(within(items[0]).getByText(`Гранаты: ${firstRole.nades}`)).toBeInTheDocument();
        expect(roles.getByText("Фиксированная роль")).toBeInTheDocument();
        expect(roles.getByText(tactic.roleFallback!)).toBeInTheDocument();
    });

    it("сохраняет порядок хода раунда и показывает план Б, пост-плант и контры", () => {
        const tactic: Tactic = tacticsFixtures[0];
        render(<TacticDetails tactic={tactic} />);

        const flow = screen.getByRole("list", { name: "Ход раунда" });
        expect(within(flow).getAllByRole("listitem").map((item) => item.textContent)).toEqual(tactic.flow);
        const notes = within(screen.getByRole("region", { name: "Разбор раунда" }));
        expect(notes.getByText(tactic.fallback!)).toBeInTheDocument();
        expect(notes.getByText(tactic.postPlant!)).toBeInTheDocument();
        expect(notes.getByText(tactic.counters!)).toBeInTheDocument();
    });

    it("скрывает незаполненные разделы и сохраняет заполненный план Б", () => {
        const tactic = tacticsFixtures[2];
        render(<TacticDetails tactic={{ ...tactic, roles: [], roleFallback: undefined, flow: [] }} />);

        expect(screen.queryByRole("heading", { name: "Роли по спавнам" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Ход раунда" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Пост-плант" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Чем контрят" })).not.toBeInTheDocument();
        expect(screen.getByText(tactic.fallback!)).toBeInTheDocument();
    });

    it("ссылается на быстрый режим текущей тактики", () => {
        const tactic = tacticsFixtures[0];

        render(<TacticDetails tactic={tactic} />);

        expect(
            screen.getByRole("link", {
                name: "Запустить быстрый колл",
            }),
        ).toHaveAttribute(
            "href",
            `/call/${tactic.slug}`,
        );
    });
});
