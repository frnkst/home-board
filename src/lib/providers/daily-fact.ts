import "server-only";

import { z } from "zod";

import { ProviderError } from "@/lib/providers/errors";
import { fetchProviderJson } from "@/lib/providers/http";

const DAILY_FACT_URL =
  "https://uselessfacts.jsph.pl/api/v2/facts/today?language=de";

const dailyFactSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1).max(1000),
  source: z.string().trim().min(1).max(200),
  source_url: z.url(),
  language: z.literal("de"),
});

export type DailyFact = {
  id: string;
  text: string;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
};

export async function getDailyFact(): Promise<DailyFact> {
  const payload = await fetchProviderJson(
    new URL(DAILY_FACT_URL),
    {
      headers: { "User-Agent": "HomeBoard/1.0" },
      next: { revalidate: 86_400 },
    },
    10_000,
  );
  const parsed = dailyFactSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ProviderError("INVALID_RESPONSE", { cause: parsed.error });
  }
  return {
    id: parsed.data.id,
    text: parsed.data.text,
    source: parsed.data.source,
    sourceUrl: parsed.data.source_url,
    fetchedAt: new Date().toISOString(),
  };
}
