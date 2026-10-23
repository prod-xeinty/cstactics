import {describe, expect, it} from "vitest";

import {
    formatDifficulty,
    formatEconomy,
    formatFaceitBand,
    formatNadeType,
    formatRatingSummary,
    formatSide,
    formatTeamSize,
    formatNade,
} from "../format";

describe("подписи тактики", () => {
    it("форматирует сторону, состав, сложность, экономику и FACEIT-группу", () => {
        expect(formatSide("T")).toBe("Атака · T");
        expect(formatSide("CT")).toBe("Защита · CT");
        expect(formatTeamSize(2)).toBe("Дуо");
        expect(formatTeamSize(5)).toBe("Фулл стак");
        expect(formatDifficulty(3)).toBe("Сложная · 3/3");
        expect(formatEconomy("force")).toBe("Форс");
        expect(formatFaceitBand("high")).toBe("Хай · 8–10 лвл");
    });
});

describe("formatRatingSummary", () => {
    it("показывает две оценки при пяти и более голосах", () => {
        expect(
            formatRatingSummary({works: 4.25, easy: 3.8, voteCount: 5, demo: true}),
        ).toEqual({
            works: "4,3",
            easy: "3,8",
            votes: "5 голосов",
            enoughVotes: true,
            demoLabel: "Демо-оценки",
        });
    });

    it("скрывает обе оценки, когда голосов меньше пяти", () => {
        expect(
            formatRatingSummary({works: 4.9, easy: 4.7, voteCount: 4, demo: true}),
        ).toEqual({
            works: "мало голосов",
            easy: "мало голосов",
            votes: "4 голоса",
            enoughVotes: false,
            demoLabel: "Демо-оценки",
        });
    });
});

describe("подписи гранат", () => {
    it("переводит типы гранат в названия для интерфейса", () => {
        expect(formatNadeType("smoke")).toBe("Смок");
        expect(formatNadeType("flash")).toBe("Флешка");
        expect(formatNadeType("molotov")).toBe("Молик");
        expect(formatNadeType("he")).toBe("Хаешка");
        expect(formatNadeType("decoy")).toBe("Декой");
    });
});

describe("formatNade", () => {
    it("формирует описание гранаты без точки броска", () => {
        expect(
            formatNade({
                who: "роль 2",
                type: "smoke",
                to: "крест",
                when: "когда лонг занят",
                why: "закрыть проход с CT-спавна",
            }),
        ).toBe(
            "роль 2 → Смок → крест → когда лонг занят → закрыть проход с CT-спавна",
        );
    });

    it("добавляет точку броска, когда она указана", () => {
        expect(
            formatNade({
                who: "роль 1",
                type: "smoke",
                to: "иксбокс",
                from: "T-спавн",
                when: "на старте",
                why: "помочь выйти на кат",
            }),
        ).toBe(
            "роль 1 → Смок → иксбокс (откуда: T-спавн) → на старте → помочь выйти на кат",
        );
    });
});