import type { Clutch, TacticPreview } from "./types";

/** Непроверенные примеры для разработки интерфейса. Не публиковать как игровые советы. */
export interface FixtureTactic extends TacticPreview {
  readonly kind: "fixture";
  readonly verified: false;
}

export interface FixtureClutch extends Readonly<Clutch> {
  readonly kind: "fixture";
  readonly verified: false;
}

export const fixtureTactics = [
  { kind: "fixture", verified: false, slug: "demo-a-split", title: "Сплит A: лонг + кат", side: "T", teamSize: 5, economy: "full", difficulty: 2, call: "Трое лонг, двое кат, заход вместе по смоку на крест.", quick: ["Трое забирают лонг, двое ждут в нижнем миде", "Смок на CT и на крест, флешка над дверями лонга", "Встал смок на крест — заходим с двух сторон разом"] },
  { kind: "fixture", verified: false, slug: "demo-b-rush", title: "Раш Б через туннели", side: "T", teamSize: 5, economy: "force", difficulty: 1, call: "Все в туннели, смоки в окно и на двери, влетаем толпой.", quick: ["Все пятеро в верхний туннель", "Смок в окно и на двери Б, две флешки над выходом", "Влетаем толпой, бомбу на задний плент"] },
  { kind: "fixture", verified: false, slug: "demo-ct-retake-b", title: "Ретейк Б втроём", side: "CT", teamSize: 3, economy: "full", difficulty: 2, call: "Смок на туннель, флешки через двери, заход с двух сторон.", quick: ["Собираемся у дверей Б и в окне", "Смок на выход из туннеля, флешки через двери", "Заходим с дверей и окна одновременно"] },
] as const satisfies readonly FixtureTactic[];

/** Здесь только подписи-заготовки: игровые действия надо проверить в игре. */
export const fixtureClutches = [
  { kind: "fixture", verified: false, id: "demo-clutch-t-1v2", map: "dust2", side: "T", enemies: 2, bomb: "A", you: "Уточнить позицию", idea: "Добавить идею после проверки", position: "Уточнить позицию", listen: "Добавить звуковой ориентир", mistake: "Записать типичную ошибку" },
  { kind: "fixture", verified: false, id: "demo-clutch-ct-1v1", map: "dust2", side: "CT", enemies: 1, bomb: "B", you: "Уточнить позицию", idea: "Добавить идею после проверки", position: "Уточнить позицию", listen: "Добавить звуковой ориентир", mistake: "Записать типичную ошибку" },
] as const satisfies readonly FixtureClutch[];
