import "server-only";

import { unstable_cache } from "next/cache";
import { z } from "zod";

import { getServerEnv } from "@/lib/env.server";
import { ProviderError } from "@/lib/providers/errors";
import { fetchProviderJson } from "@/lib/providers/http";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

const adviceSchema = z.object({
  items: z.array(z.string().trim().min(1).max(90)).length(3),
});

const responseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string() }),
    }),
  ).min(1),
});

export type ClothingAdvice = z.infer<typeof adviceSchema> & {
  generatedAt: string;
};

export type ClothingAdviceWeather = {
  current: {
    temperatureCelsius: number;
    apparentTemperatureCelsius: number;
    precipitationMm: number;
    weatherCode: number;
    windSpeedKmh: number;
  };
  forecast: Array<{
    date: string;
    temperatureMaxCelsius: number;
    temperatureMinCelsius: number;
    precipitationMm: number;
    precipitationProbabilityPercent: number | null;
    windSpeedMaxKmh: number;
    weatherCode: number;
  }>;
};

export async function getClothingAdvice(
  weather: ClothingAdviceWeather,
  location: { latitude: number; longitude: number; name: string },
): Promise<ClothingAdvice | null> {
  const apiKey = getServerEnv().OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const locationKey = `${location.latitude.toFixed(3)}-${location.longitude.toFixed(3)}`;
  const getCachedAdvice = unstable_cache(
    () => generateClothingAdvice(apiKey, weather, location.name),
    ["weather-clothing-advice", locationKey],
    { revalidate: 3_600 },
  );
  return getCachedAdvice();
}

async function generateClothingAdvice(
  apiKey: string,
  weather: ClothingAdviceWeather,
  locationName: string,
): Promise<ClothingAdvice> {
  const payload = await fetchProviderJson(
    new URL(OPENROUTER_URL),
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://home.void0.ch",
        "X-Title": "Home Board",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 180,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "clothing_advice",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                items: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: { type: "string" },
                },
              },
              required: ["items"],
            },
          },
        },
        messages: [
          {
            role: "system",
            content:
              "Du gibst einer Familie in der Schweiz drei kurze, konkrete Kleidungstipps auf Deutsch. Berücksichtige Tageszeit, Temperatur, Regen, Wind und Sonne. Nenne nur tragbare Kleidung oder praktische Wetterartikel. Jeder Tipp hat höchstens acht Wörter. Keine Einleitung, keine Wiederholungen.",
          },
          {
            role: "user",
            content: JSON.stringify({
              location: locationName,
              current: weather.current,
              nextDays: weather.forecast.slice(0, 2),
            }),
          },
        ],
      }),
    },
    15_000,
  );
  const response = responseSchema.safeParse(payload);
  if (!response.success) {
    throw new ProviderError("INVALID_RESPONSE", {
      cause: response.error,
    });
  }
  let content: unknown;
  try {
    content = JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    throw new ProviderError("INVALID_RESPONSE", { cause: error });
  }
  const advice = adviceSchema.safeParse(content);
  if (!advice.success) {
    throw new ProviderError("INVALID_RESPONSE", { cause: advice.error });
  }
  return { ...advice.data, generatedAt: new Date().toISOString() };
}
