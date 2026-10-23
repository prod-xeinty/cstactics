import {describe, expect, it} from "vitest";

import {getNextStep, getPrevStep} from "./step-navigation";

describe("навигация по шагам", () => {
    describe("getNextStep", () => {
        it("возвращает индекс следующего шага", () => {
            expect(getNextStep(0, 3)).toBe(1);
        });

        it("остаётся на последнем шаге", () => {
            expect(getNextStep(2, 3)).toBe(2);
        });
    });

    describe("getPrevStep", () => {
        it("возвращает индекс предыдущего шага", () => {
            expect(getPrevStep(2)).toBe(1);
        });

        it("не возвращает индекс меньше нуля", () => {
            expect(getPrevStep(0)).toBe(0);
        });
    });
});