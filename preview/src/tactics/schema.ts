import { z } from "zod";

export const tacticFiltersSchema = z.object({
  map: z.literal("dust2").catch("dust2"),
  side: z.enum(["T", "CT", "all"]).catch("all"),
  teamSize: z
    .union([
      z.literal("all"),
      z.coerce.number().pipe(z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)])),
    ])
    .catch("all"),
  band: z.enum(["low", "mid", "high"]).catch("mid"),
});
