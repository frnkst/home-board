import "server-only";

import { z } from "zod";

import { ProviderError } from "@/lib/providers/errors";
import { fetchProviderText } from "@/lib/providers/http";
import type {
  MarketDataProvider,
  MarketHistory,
  MarketHistoryPoint,
  MarketQuote,
} from "@/lib/providers/markets/types";

const STOOQ_URL = "https://stooq.com/q";
const symbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(/^[A-Za-z0-9.^=-]+$/);
const dateSchema = z.iso.date();

export class StooqMarketDataProvider implements MarketDataProvider {
  async getQuotes(symbols: string[]): Promise<MarketQuote[]> {
    const parsed = z.array(symbolSchema).min(1).max(20).safeParse(symbols);
    if (!parsed.success) throw new ProviderError("INVALID_REQUEST");
    const url = new URL(`${STOOQ_URL}/l/`);
    url.searchParams.set("s", parsed.data.map(toStooqSymbol).join(","));
    url.searchParams.set("f", "sd2t2ohlcvn");
    url.searchParams.set("h", "");
    url.searchParams.set("e", "csv");
    const csv = await fetchProviderText(
      url,
      {
        headers: { Accept: "text/csv" },
        next: { revalidate: 900 },
      },
      10_000,
    );
    const rows = parseCsv(csv);
    if (rows.length < 2) throw new ProviderError("INVALID_RESPONSE");
    const header = rows[0].map((cell) => cell.toLowerCase());
    const fetchedAt = new Date().toISOString();
    const requestedSymbols = new Map(
      parsed.data.map((symbol) => [toStooqSymbol(symbol), symbol.toUpperCase()]),
    );
    const quotes = rows.slice(1).flatMap((row) => {
      const data = Object.fromEntries(header.map((key, i) => [key, row[i]]));
      const close = finiteNumber(data.close);
      if (!data.symbol || !data.date || !data.time || close === null) return [];
      const observedAt = parseStooqDateTime(data.date, data.time);
      return [
        {
          symbol:
            requestedSymbols.get(data.symbol.toLowerCase()) ??
            data.symbol.toUpperCase(),
          name: nullableText(data.name),
          currency: inferCurrency(data.symbol),
          price: close,
          open: finiteNumber(data.open),
          high: finiteNumber(data.high),
          low: finiteNumber(data.low),
          previousClose: null,
          volume: finiteNumber(data.volume),
          observedAt,
          fetchedAt,
          delayed: true as const,
          stale: isStale(observedAt),
        },
      ];
    });
    if (quotes.length === 0) throw new ProviderError("NOT_FOUND");
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
    const url = new URL(`${STOOQ_URL}/d/l/`);
    url.searchParams.set("s", toStooqSymbol(parsed.data.symbol));
    url.searchParams.set("d1", parsed.data.from.replaceAll("-", ""));
    url.searchParams.set("d2", parsed.data.to.replaceAll("-", ""));
    url.searchParams.set("i", "d");
    const csv = await fetchProviderText(
      url,
      {
        headers: { Accept: "text/csv" },
        next: { revalidate: 3_600 },
      },
      10_000,
    );
    const rows = parseCsv(csv);
    if (rows.length < 1) throw new ProviderError("INVALID_RESPONSE");
    const header = rows[0].map((cell) => cell.toLowerCase());
    const points = rows.slice(1).map((row) =>
      historyPoint(Object.fromEntries(header.map((key, i) => [key, row[i]]))),
    );
    if (points.length === 0) throw new ProviderError("NOT_FOUND");
    const observedAt = `${points.at(-1)!.date}T23:59:59Z`;
    return {
      symbol: parsed.data.symbol.toUpperCase(),
      currency: inferCurrency(toStooqSymbol(parsed.data.symbol)),
      points,
      observedAt,
      fetchedAt: new Date().toISOString(),
      delayed: true,
      stale: isStale(observedAt),
    };
  }
}

export const marketDataProvider: MarketDataProvider =
  new StooqMarketDataProvider();

function historyPoint(row: Record<string, string | undefined>): MarketHistoryPoint {
  const date = row.date;
  const open = finiteNumber(row.open);
  const high = finiteNumber(row.high);
  const low = finiteNumber(row.low);
  const close = finiteNumber(row.close);
  if (!dateSchema.safeParse(date).success || [open, high, low, close].includes(null))
    throw new ProviderError("INVALID_RESPONSE");
  return {
    date: date!,
    open: open!,
    high: high!,
    low: low!,
    close: close!,
    volume: finiteNumber(row.volume),
  };
}

function toStooqSymbol(symbol: string): string {
  const normalized = symbol.toLowerCase();
  return normalized.includes(".") || normalized.startsWith("^")
    ? normalized
    : `${normalized}.us`;
}

function parseStooqDateTime(date: string, time: string): string {
  if (!/^\d{8}$/.test(date) || !/^\d{6}$/.test(time))
    throw new ProviderError("INVALID_RESPONSE");
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(
    0,
    2,
  )}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`;
}

function finiteNumber(value: string | undefined): number | null {
  if (!value || value === "N/D") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableText(value: string | undefined): string | null {
  return value && value !== "N/D" ? value : null;
}

function inferCurrency(symbol: string): string | null {
  const suffix = symbol.toLowerCase().split(".").at(-1);
  return suffix === "us"
    ? "USD"
    : suffix === "ch"
      ? "CHF"
      : suffix === "de"
        ? "EUR"
        : suffix === "uk"
          ? "GBP"
          : null;
}

function isStale(observedAt: string): boolean {
  return Date.now() - Date.parse(observedAt) > 5 * 86_400_000;
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (char === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new ProviderError("INVALID_RESPONSE");
  if (field || row.length) {
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}
