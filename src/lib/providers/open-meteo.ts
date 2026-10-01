import "server-only";

import { z } from "zod";

import { ProviderError } from "@/lib/providers/errors";
import { fetchProviderJson } from "@/lib/providers/http";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export const placeSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(100),
  limit: z.number().int().min(1).max(10).default(5),
  language: z.enum(["de", "en", "fr", "it"]).default("de"),
});

export const weatherLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine(isTimeZone)
    .default("Europe/Zurich"),
});

const placeResponseSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        elevation: z.number().optional(),
        country_code: z.string().optional(),
        country: z.string().optional(),
        admin1: z.string().optional(),
        timezone: z.string().optional(),
      }),
    )
    .optional(),
});

const currentResponseSchema = z.object({
  timezone: z.string(),
  utc_offset_seconds: z.number(),
  current: z.object({
    time: z.string(),
    interval: z.number(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    precipitation: z.number(),
    weather_code: z.number().int(),
    wind_speed_10m: z.number(),
    wind_direction_10m: z.number(),
    is_day: z.union([z.literal(0), z.literal(1)]),
  }),
  current_units: z.object({
    temperature_2m: z.string(),
    apparent_temperature: z.string(),
    precipitation: z.string(),
    wind_speed_10m: z.string(),
  }),
});

const forecastResponseSchema = z.object({
  timezone: z.string(),
  utc_offset_seconds: z.number(),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number().int()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_sum: z.array(z.number()),
    precipitation_probability_max: z.array(z.number().nullable()),
    sunrise: z.array(z.string()),
    sunset: z.array(z.string()),
    wind_speed_10m_max: z.array(z.number()),
  }),
  daily_units: z.object({
    temperature_2m_max: z.string(),
    precipitation_sum: z.string(),
    wind_speed_10m_max: z.string(),
  }),
});

export interface WeatherPlace {
  id: string;
  name: string;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  elevationMetres: number | null;
  timezone: string | null;
}

export interface CurrentWeather {
  observedAt: string;
  fetchedAt: string;
  stale: boolean;
  timezone: string;
  temperatureCelsius: number;
  apparentTemperatureCelsius: number;
  precipitationMm: number;
  weatherCode: number;
  windSpeedKmh: number;
  windDirectionDegrees: number;
  isDay: boolean;
}

export interface WeatherForecastDay {
  date: string;
  weatherCode: number;
  temperatureMaxCelsius: number;
  temperatureMinCelsius: number;
  precipitationMm: number;
  precipitationProbabilityPercent: number | null;
  sunrise: string;
  sunset: string;
  windSpeedMaxKmh: number;
}

export interface WeatherForecast {
  fetchedAt: string;
  stale: boolean;
  timezone: string;
  days: WeatherForecastDay[];
}

export async function searchPlaces(
  input: { query: string; limit?: number; language?: string },
): Promise<{ places: WeatherPlace[]; fetchedAt: string; stale: false }> {
  const parsed = placeSearchInputSchema.safeParse(input);
  if (!parsed.success) throw new ProviderError("INVALID_REQUEST");
  const url = new URL(GEOCODING_URL);
  url.searchParams.set("name", parsed.data.query);
  url.searchParams.set("count", String(parsed.data.limit));
  url.searchParams.set("language", parsed.data.language);
  url.searchParams.set("format", "json");
  const raw = await fetchProviderJson(url, { next: { revalidate: 86_400 } });
  const response = parseResponse(placeResponseSchema, raw);
  return {
    places: (response.results ?? []).map((place) => ({
      id: String(place.id),
      name: place.name,
      region: place.admin1 ?? null,
      country: place.country ?? null,
      countryCode: place.country_code ?? null,
      latitude: place.latitude,
      longitude: place.longitude,
      elevationMetres: place.elevation ?? null,
      timezone: place.timezone ?? null,
    })),
    fetchedAt: new Date().toISOString(),
    stale: false,
  };
}

export async function getCurrentWeather(
  input: { latitude: number; longitude: number; timezone?: string },
): Promise<CurrentWeather> {
  const location = parseInput(weatherLocationSchema, input);
  const url = weatherUrl(location);
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day",
  );
  const raw = await fetchProviderJson(url, { next: { revalidate: 300 } });
  const response = parseResponse(currentResponseSchema, raw);
  const observedAt = zonedIso(response.current.time, response.utc_offset_seconds);
  return {
    observedAt,
    fetchedAt: new Date().toISOString(),
    stale: Date.now() - Date.parse(observedAt) > 30 * 60_000,
    timezone: response.timezone,
    temperatureCelsius: response.current.temperature_2m,
    apparentTemperatureCelsius: response.current.apparent_temperature,
    precipitationMm: response.current.precipitation,
    weatherCode: response.current.weather_code,
    windSpeedKmh: response.current.wind_speed_10m,
    windDirectionDegrees: response.current.wind_direction_10m,
    isDay: response.current.is_day === 1,
  };
}

export async function getWeatherForecast(
  input: {
    latitude: number;
    longitude: number;
    timezone?: string;
    days?: number;
  },
): Promise<WeatherForecast> {
  const location = parseInput(weatherLocationSchema, input);
  const days = z.number().int().min(1).max(16).default(7).safeParse(input.days);
  if (!days.success) throw new ProviderError("INVALID_REQUEST");
  const url = weatherUrl(location);
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,wind_speed_10m_max",
  );
  url.searchParams.set("forecast_days", String(days.data));
  const raw = await fetchProviderJson(url, { next: { revalidate: 1_800 } });
  const response = parseResponse(forecastResponseSchema, raw);
  const daily = response.daily;
  const lengths = Object.values(daily).map((values) => values.length);
  if (new Set(lengths).size !== 1) throw new ProviderError("INVALID_RESPONSE");
  return {
    fetchedAt: new Date().toISOString(),
    stale: false,
    timezone: response.timezone,
    days: daily.time.map((date, index) => ({
      date,
      weatherCode: daily.weather_code[index],
      temperatureMaxCelsius: daily.temperature_2m_max[index],
      temperatureMinCelsius: daily.temperature_2m_min[index],
      precipitationMm: daily.precipitation_sum[index],
      precipitationProbabilityPercent:
        daily.precipitation_probability_max[index],
      sunrise: zonedIso(daily.sunrise[index], response.utc_offset_seconds),
      sunset: zonedIso(daily.sunset[index], response.utc_offset_seconds),
      windSpeedMaxKmh: daily.wind_speed_10m_max[index],
    })),
  };
}

function weatherUrl(location: z.output<typeof weatherLocationSchema>): URL {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("timezone", location.timezone);
  return url;
}

function parseInput<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.output<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ProviderError("INVALID_REQUEST");
  return parsed.data;
}

function parseResponse<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.output<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ProviderError("INVALID_RESPONSE", { cause: parsed.error });
  return parsed.data;
}

function zonedIso(localTime: string, offsetSeconds: number): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(
    localTime,
  );
  if (!match) throw new ProviderError("INVALID_RESPONSE");
  const sign = offsetSeconds >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetSeconds);
  const offset = `${String(Math.floor(absolute / 3600)).padStart(2, "0")}:${String(
    Math.floor((absolute % 3600) / 60),
  ).padStart(2, "0")}`;
  return `${match[1]}T${match[2]}:${match[3] ?? "00"}${sign}${offset}`;
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("de-CH", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
