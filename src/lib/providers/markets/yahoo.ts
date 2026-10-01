import "server-only";

import { z } from "zod";

import { ProviderError } from "@/lib/providers/errors";
import { fetchProviderJson } from "@/lib/providers/http";
import type {
  MarketDataProvider,
  MarketHistory,
  MarketHistoryPoint,
  MarketQuote,
} from "@/lib/providers/markets/types";

const YAHOO_URL = "https://query1.finance.yahoo.com";
const symbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(/^[A-Za-z0-9.^=-]+$/);
const dateSchema = z.iso.date();

const chartResponseSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({
            currency: z.string().nullish(),
            symbol: z.string(),
            shortName: z.string().nullish(),
            longName: z.string().nullish(),
            regularMarketPrice: z.number().nullish(),
            regularMarketTime: z.number().nullish(),
            chartPreviousClose: z.number().nullish(),
            previousClose: z.number().nullish(),
          }),
          timestamp: z.array(z.number()).nullish(),
          indicators: z.object({
            quote: z.array(
              z.object({
                open: z.array(z.number().nullable()).nullish(),
                high: z.array(z.number().nullable()).nullish(),
                low: z.array(z.number().nullable()).nullish(),
                close: z.array(z.number().nullable()).nullish(),
                volume: z.array(z.number().nullable()).nullish(),
              }),
            ),
          }),
        }),
      )
      .nullish(),
    error: z.unknown().nullish(),
  }),
});

const searchResponseSchema = z.object({
  quotes: z.array(
    z.object({
      symbol: z.string(),
      quoteType: z.string().optional(),
    }),
  ),
});

export class YahooMarketDataProvider implements MarketDataProvider {
  async getQuotes(symbols: string[]): Promise<MarketQuote[]> {
    const parsed = z.array(symbolSchema).min(1).max(20).safeParse(symbols);
    if (!parsed.success) throw new ProviderError("INVALID_REQUEST");
    const results = await Promise.allSettled(
      parsed.data.map(async (requestedSymbol) => {
        const yahooSymbol = await resolveYahooSymbol(requestedSymbol);
        const chart = await fetchChart(yahooSymbol, {
          range: "5d",
          interval: "1d",
          revalidate: 900,
        });
        return quoteFromChart(requestedSymbol.toUpperCase(), chart);
      }),
    );
    const quotes = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    if (quotes.length === 0) {
      const failure = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      throw failure?.reason instanceof ProviderError
        ? failure.reason
        : new ProviderError("NOT_FOUND");
    }
    return quotes;
  }

  async getHistory(
    symbol: string,
    options: { from: string; to: string },
  ): Promise<MarketHistory> {
    const parsed = z
      .object({ symbol: symbolSchema, from: dateSchema, to: dateSchema })
      .refine((value) => value.from <= value.to)
      .safeParse({ symbol, ...options });
    if (!parsed.success) throw new ProviderError("INVALID_REQUEST");
    if (
      Date.parse(`${parsed.data.to}T00:00:00Z`) -
        Date.parse(`${parsed.data.from}T00:00:00Z`) >
      5 * 366 * 86_400_000
    ) {
      throw new ProviderError("INVALID_REQUEST");
    }
    const yahooSymbol = await resolveYahooSymbol(parsed.data.symbol);
    const period1 = Math.floor(
      Date.parse(`${parsed.data.from}T00:00:00Z`) / 1000,
    );
    const period2 =
      Math.floor(Date.parse(`${parsed.data.to}T00:00:00Z`) / 1000) + 86_400;
    const chart = await fetchChart(yahooSymbol, {
      period1: String(period1),
      period2: String(period2),
      interval: "1d",
      revalidate: 3_600,
    });
    const points = historyFromChart(chart);
    if (points.length === 0) throw new ProviderError("NOT_FOUND");
    const observedAt = chart.meta.regularMarketTime
      ? new Date(chart.meta.regularMarketTime * 1000).toISOString()
      : `${points.at(-1)!.date}T23:59:59Z`;
    return {
      symbol: parsed.data.symbol.toUpperCase(),
      currency: chart.meta.currency ?? null,
      points,
      observedAt,
      fetchedAt: new Date().toISOString(),
      delayed: true,
      stale: isStale(observedAt),
    };
  }
}

export const marketDataProvider: MarketDataProvider =
  new YahooMarketDataProvider();

function isStale(observedAt: string): boolean {
  return Date.now() - Date.parse(observedAt) > 5 * 86_400_000;
}

type Chart = z.infer<typeof chartResponseSchema>["chart"]["result"] extends
  | (infer Result)
  | null
  | undefined
  ? Result extends Array<infer Item>
    ? Item
    : never
  : never;

async function fetchChart(
  symbol: string,
  options: Record<string, string | number>,
): Promise<Chart> {
  const url = new URL(
    `/v8/finance/chart/${encodeURIComponent(symbol)}`,
    YAHOO_URL,
  );
  for (const [key, value] of Object.entries(options)) {
    if (key !== "revalidate") url.searchParams.set(key, String(value));
  }
  url.searchParams.set("events", "history");
  const payload = await fetchProviderJson(
    url,
    {
      headers: { "User-Agent": "Mozilla/5.0 HomeBoard/1.0" },
      next: { revalidate: Number(options.revalidate ?? 900) },
    },
    10_000,
  );
  const parsed = chartResponseSchema.safeParse(payload);
  const chart = parsed.success ? parsed.data.chart.result?.[0] : null;
  if (!chart) throw new ProviderError("NOT_FOUND");
  return chart;
}

function quoteFromChart(requestedSymbol: string, chart: Chart): MarketQuote {
  const series = chart.indicators.quote[0];
  if (!series) throw new ProviderError("INVALID_RESPONSE");
  const price = chart.meta.regularMarketPrice ?? lastNumber(series.close);
  if (price === null) throw new ProviderError("NOT_FOUND");
  const observedAt = chart.meta.regularMarketTime
    ? new Date(chart.meta.regularMarketTime * 1000).toISOString()
    : new Date((chart.timestamp?.at(-1) ?? Date.now() / 1000) * 1000).toISOString();
  return {
    symbol: requestedSymbol,
    name: chart.meta.longName ?? chart.meta.shortName ?? null,
    currency: chart.meta.currency ?? null,
    price,
    open: lastNumber(series.open),
    high: lastNumber(series.high),
    low: lastNumber(series.low),
    previousClose:
      chart.meta.chartPreviousClose ??
      chart.meta.previousClose ??
      previousNumber(series.close),
    volume: lastNumber(series.volume),
    observedAt,
    fetchedAt: new Date().toISOString(),
    delayed: true,
    stale: isStale(observedAt),
  };
}

function historyFromChart(chart: Chart): MarketHistoryPoint[] {
  const series = chart.indicators.quote[0];
  if (!series) throw new ProviderError("INVALID_RESPONSE");
  return (chart.timestamp ?? []).flatMap((timestamp, index) => {
    const open = series.open?.[index];
    const high = series.high?.[index];
    const low = series.low?.[index];
    const close = series.close?.[index];
    if (
      typeof open !== "number" ||
      typeof high !== "number" ||
      typeof low !== "number" ||
      typeof close !== "number"
    ) {
      return [];
    }
    return [{
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume:
        typeof series.volume?.[index] === "number"
          ? series.volume[index]
          : null,
    }];
  });
}

async function resolveYahooSymbol(symbol: string): Promise<string> {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(normalized)) {
    return normalizeExchangeSuffix(normalized);
  }
  const url = new URL("/v1/finance/search", YAHOO_URL);
  url.searchParams.set("q", normalized);
  url.searchParams.set("quotesCount", "1");
  url.searchParams.set("newsCount", "0");
  const payload = await fetchProviderJson(
    url,
    {
      headers: { "User-Agent": "Mozilla/5.0 HomeBoard/1.0" },
      next: { revalidate: 86_400 },
    },
    10_000,
  );
  const parsed = searchResponseSchema.safeParse(payload);
  const result = parsed.success ? parsed.data.quotes[0] : null;
  if (!result) throw new ProviderError("NOT_FOUND");
  return result.symbol;
}

function normalizeExchangeSuffix(symbol: string): string {
  if (symbol.endsWith(".CH")) return `${symbol.slice(0, -3)}.SW`;
  if (symbol.endsWith(".US")) return symbol.slice(0, -3);
  if (symbol.endsWith(".UK")) return `${symbol.slice(0, -3)}.L`;
  return symbol;
}

function lastNumber(values: (number | null)[] | null | undefined): number | null {
  return [...(values ?? [])].reverse().find((value) => value !== null) ?? null;
}

function previousNumber(
  values: (number | null)[] | null | undefined,
): number | null {
  const numbers = (values ?? []).filter(
    (value): value is number => value !== null,
  );
  return numbers.at(-2) ?? null;
}
