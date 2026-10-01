import "server-only";

import { z } from "zod";

import { ProviderError } from "@/lib/providers/errors";
import { fetchProviderJson } from "@/lib/providers/http";

const BASE_URL = "https://transport.opendata.ch/v1";

export const stopSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(100),
  limit: z.number().int().min(1).max(10).default(5),
});

export const departuresInputSchema = z.object({
  stationId: z.string().trim().min(1).max(80).regex(/^[\w:. -]+$/),
  limit: z.number().int().min(1).max(20).default(10),
});

const coordinateSchema = z
  .object({ x: z.number().nullable(), y: z.number().nullable() })
  .nullable();

const locationsResponseSchema = z.object({
  stations: z.array(
    z.object({
      id: z.string().nullable(),
      name: z.string().nullable(),
      coordinate: coordinateSchema.optional(),
      distance: z.number().nullable().optional(),
    }),
  ),
});

const stationboardResponseSchema = z.object({
  station: z.object({ id: z.string().nullable(), name: z.string().nullable() }),
  stationboard: z.array(
    z.object({
      stop: z.object({
        departure: z.string().nullable(),
        delay: z.number().nullable().optional(),
        platform: z.string().nullable().optional(),
        prognosis: z
          .object({
            departure: z.string().nullable().optional(),
            platform: z.string().nullable().optional(),
          })
          .nullable()
          .optional(),
      }),
      name: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
      number: z.string().nullable().optional(),
      to: z.string().nullable().optional(),
      capacity1st: z.number().nullable().optional(),
      capacity2nd: z.number().nullable().optional(),
    }),
  ),
});

export interface TransportStop {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  distanceMetres: number | null;
}

export interface Departure {
  id: string;
  line: string;
  category: string | null;
  number: string | null;
  destination: string;
  scheduledAt: string;
  expectedAt: string;
  delayMinutes: number | null;
  platform: string | null;
  capacityFirstClass: number | null;
  capacitySecondClass: number | null;
}

export async function searchStops(
  input: z.input<typeof stopSearchInputSchema>,
): Promise<{ stops: TransportStop[]; fetchedAt: string; stale: false }> {
  const parsed = stopSearchInputSchema.safeParse(input);
  if (!parsed.success) throw new ProviderError("INVALID_REQUEST");
  const url = new URL(`${BASE_URL}/locations`);
  url.searchParams.set("query", parsed.data.query);
  url.searchParams.set("type", "station");
  const raw = await fetchProviderJson(url, { next: { revalidate: 86_400 } });
  const response = parseResponse(locationsResponseSchema, raw);
  return {
    stops: response.stations
      .filter(
        (stop): stop is typeof stop & { id: string; name: string } =>
          Boolean(stop.id && stop.name),
      )
      .slice(0, parsed.data.limit)
      .map((stop) => ({
        id: stop.id,
        name: stop.name,
        latitude: stop.coordinate?.x ?? null,
        longitude: stop.coordinate?.y ?? null,
        distanceMetres: stop.distance ?? null,
      })),
    fetchedAt: new Date().toISOString(),
    stale: false,
  };
}

export async function getDepartures(
  input: z.input<typeof departuresInputSchema>,
): Promise<{
  station: { id: string; name: string };
  departures: Departure[];
  fetchedAt: string;
  stale: boolean;
}> {
  const parsed = departuresInputSchema.safeParse(input);
  if (!parsed.success) throw new ProviderError("INVALID_REQUEST");
  const url = new URL(`${BASE_URL}/stationboard`);
  url.searchParams.set("id", parsed.data.stationId);
  url.searchParams.set("limit", String(parsed.data.limit));
  const raw = await fetchProviderJson(url, {
    next: { revalidate: 30 },
  });
  const response = parseResponse(stationboardResponseSchema, raw);
  if (!response.station.id || !response.station.name)
    throw new ProviderError("INVALID_RESPONSE");
  const fetchedAt = new Date().toISOString();
  return {
    station: { id: response.station.id, name: response.station.name },
    departures: response.stationboard.flatMap((item, index) => {
      if (!item.stop.departure || !item.to) return [];
      const expected = item.stop.prognosis?.departure ?? item.stop.departure;
      return [
        {
          id: `${response.station.id}:${item.stop.departure}:${item.name ?? index}`,
          line:
            item.name ??
            ([item.category, item.number].filter(Boolean).join(" ") || "–"),
          category: item.category ?? null,
          number: item.number ?? null,
          destination: item.to,
          scheduledAt: item.stop.departure,
          expectedAt: expected,
          delayMinutes: item.stop.delay ?? null,
          platform: item.stop.prognosis?.platform ?? item.stop.platform ?? null,
          capacityFirstClass: item.capacity1st ?? null,
          capacitySecondClass: item.capacity2nd ?? null,
        },
      ];
    }),
    fetchedAt,
    stale: false,
  };
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
