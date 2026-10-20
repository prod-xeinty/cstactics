import type {
  Difficulty,
  Economy,
  FaceitBand,
  RatingSummary,
  Side,
  TeamSize,
} from "./model";

const sideLabels: Record<Side, string> = {
  T: "Атака · T",
  CT: "Защита · CT",
};

const teamSizeLabels: Record<TeamSize, string> = {
  2: "Дуо",
  3: "Тройка",
  4: "Четверо",
  5: "Фулл стак",
};

const difficultyLabels: Record<Difficulty, string> = {
  1: "Простая · 1/3",
  2: "Средняя · 2/3",
  3: "Сложная · 3/3",
};

const economyLabels: Record<Economy, string> = {
  eco: "Эко",
  force: "Форс",
  full: "Фулл бай",
  any: "Любая экономика",
};

const faceitBandLabels: Record<FaceitBand, string> = {
  low: "Лоу · 1–3 лвл",
  mid: "Мид · 4–7 лвл",
  high: "Хай · 8–10 лвл",
};

export const formatSide = (side: Side) => sideLabels[side];
export const formatTeamSize = (teamSize: TeamSize) => teamSizeLabels[teamSize];
export const formatDifficulty = (difficulty: Difficulty) => difficultyLabels[difficulty];
export const formatEconomy = (economy: Economy) => economyLabels[economy];
export const formatFaceitBand = (band: FaceitBand) => faceitBandLabels[band];

const formatVotes = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun =
    mod10 === 1 && mod100 !== 11
      ? "голос"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "голоса"
        : "голосов";

  return `${count} ${noun}`;
};

const formatScore = (score: number) => score.toFixed(1).replace(".", ",");

export function formatRatingSummary(rating: RatingSummary) {
  const enoughVotes = rating.voteCount >= 5;

  return {
    works: enoughVotes ? formatScore(rating.works) : "мало голосов",
    easy: enoughVotes ? formatScore(rating.easy) : "мало голосов",
    votes: formatVotes(rating.voteCount),
    enoughVotes,
    demoLabel: "Демо-оценки",
  };
}
