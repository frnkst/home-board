import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const quotesFixture = readFileSync(
  new URL("../__fixtures__/stooq-quotes.csv", import.meta.url),
  "utf8",
);
const historyFixture = readFileSync(
  new URL("../__fixtures__/stooq-history.csv", import.meta.url),
  "utf8",
);
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("Stooq market adapter", () => {
  beforeEach(() => fetchMock.mockReset());

  it("normalizes delayed quotes and preserves quoted names", async () => {
    fetchMock.mockResolvedValue(new Response(quotesFixture));
    const { StooqMarketDataProvider } = await import(
      "@/lib/providers/markets/stooq"
    );
    const result = await new StooqMarketDataProvider().getQuotes([
      "AAPL",
      "NESN.CH",
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      expect.objectContaining({
        symbol: "AAPL",
        name: "Apple Inc",
        currency: "USD",
        price: 227.75,
        delayed: true,
      }),
    );
    expect(result[1].currency).toBe("CHF");
  });

  it("normalizes bounded daily history", async () => {
    fetchMock.mockResolvedValue(new Response(historyFixture));
    const { StooqMarketDataProvider } = await import(
      "@/lib/providers/markets/stooq"
    );
    const result = await new StooqMarketDataProvider().getHistory("AAPL", {
      from: "2026-09-01",
      to: "2026-10-01",
    });

    expect(result.points).toHaveLength(2);
    expect(result.points[1]).toEqual({
      date: "2026-09-30",
      open: 224.8,
      high: 227.2,
      low: 224.1,
      close: 226.95,
      volume: 41000123,
    });
  });

  it("normalizes upstream failures", async () => {
    fetchMock.mockResolvedValue(new Response("busy", { status: 503 }));
    const { StooqMarketDataProvider } = await import(
      "@/lib/providers/markets/stooq"
    );
    await expect(
      new StooqMarketDataProvider().getQuotes(["AAPL"]),
    ).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      message: "Der Datendienst ist momentan nicht erreichbar.",
    });
  });
});
