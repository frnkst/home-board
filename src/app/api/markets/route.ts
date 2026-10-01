import { NextResponse, type NextRequest } from "next/server";

import {
  authorizeAdminApi,
  providerErrorResponse,
} from "@/app/api/_lib/response";
import { marketDataProvider } from "@/lib/providers/markets/yahoo";

export async function GET(request: NextRequest) {
  const authError = await authorizeAdminApi();
  if (authError) return authError;
  try {
    const symbols = (request.nextUrl.searchParams.get("symbols") ?? "")
      .split(",")
      .map((symbol) => symbol.trim())
      .filter(Boolean);
    const quotes = await marketDataProvider.getQuotes(symbols);
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const from = new Date(now.getTime() - 45 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const histories = await mapWithConcurrency(quotes, 4, async (quote) => {
      try {
        return await marketDataProvider.getHistory(quote.symbol, { from, to });
      } catch {
        return null;
      }
    });
    return NextResponse.json({
      quotes: quotes.map((quote, index) => {
        const points = histories[index]?.points.slice(-30) ?? [];
        const first = points[0]?.close;
        const previousClose = quote.previousClose;
        return {
          ...quote,
          updatedAt: quote.observedAt,
          changePercent:
            previousClose && previousClose > 0
              ? ((quote.price - previousClose) / previousClose) * 100
              : first && points.length
                ? ((points.at(-1)!.close - first) / first) * 100
              : null,
          history: points.map((point) => ({
            at: `${point.date}T12:00:00Z`,
            value: point.close,
          })),
        };
      }),
      fetchedAt: new Date().toISOString(),
      stale: quotes.some((quote) => quote.stale),
    });
  } catch (error) {
    return providerErrorResponse(error);
  }

  async function mapWithConcurrency<T, R>(
    values: readonly T[],
    concurrency: number,
    operation: (value: T) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(values.length);
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(concurrency, values.length) }, async () => {
        while (cursor < values.length) {
          const index = cursor++;
          results[index] = await operation(values[index]!);
        }
      }),
    );
    return results;
  }
}
