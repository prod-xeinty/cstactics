import { z } from "zod";

export const places = ["T-спавн", "лонг", "двери лонга", "яма", "крест", "дефолт A", "гусь", "кат", "мид", "нижний мид", "иксбокс", "мидовые двери", "CT-спавн", "верхний туннель", "нижний туннель", "окно", "двери Б", "задний плент Б"] as const;
export const spawnZones = ["ближние к лонгу", "центр", "ближние к миду", "ближние к A", "ближние к Б"] as const;
const line = z.string().trim().min(1).max(300);
const optional = z.string().trim().max(2000).default("");

export const submissionSchema = z.object({
  title: z.string().trim().min(1).max(100),
  side: z.enum(["T", "CT"]), teamSize: z.number().int().min(2).max(5),
  economy: z.enum(["eco", "force", "full", "any"]), difficulty: z.number().int().min(1).max(3),
  gameVersion: line, spawnDependent: z.boolean(), call: line,
  quick: z.array(line).min(1).max(4),
  roles: z.array(z.object({ spawnZone: z.enum(spawnZones), task: line, nades: z.string().trim().max(300), fixed: z.boolean() })).max(5),
  roleFallback: optional,
  nades: z.array(z.object({ who: line, type: z.enum(["smoke", "flash", "molotov", "he", "decoy"]), to: z.enum(places), when: line, why: line })).max(12),
  flow: optional, fallback: optional, postPlant: optional, counters: optional,
}).strict();

/** Сохранённое содержимое дополняется только серверной ссылкой на медиа. */
export const storedSubmissionSchema = submissionSchema.extend({
  videoUrl: z.string().regex(/^\/media\/[a-zA-Z0-9_-]{1,128}$/).optional(),
}).strict();

export type Submission = z.infer<typeof submissionSchema>;
export type StoredSubmission = z.infer<typeof storedSubmissionSchema>;
