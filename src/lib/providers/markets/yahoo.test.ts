import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function chartResponse(symbol: string) {
  return {
    chart: {
      result: [{
        meta: {
          currency: symbol === "NESN.SW" ? "CHF" : "USD",
          symbol,
          shortName: symbol === "NESN.SW" ? "Nestlé" : "Apple Inc.",
          regularMarketPrice: symbol === "NESN.SW" ? 74.95 : 227.75,
          regularMarketTime: 1_790_841_600,
          chartPreviousClose: symbol === "NESN.SW" ? 75.2 : 226.95,
        },
        timestamp: [1_790_668_800, 1_790_755_200],
        indicators: {
          quote: [{
            open: [223.1, 224.8],
            high: [225.2, 227.2],
            low: [222.5, 224.1],
            close: [224.75, 226.95],
            volume: [38_000_123, 41_000_123],
          }],
        },
      }],
      error: null,
    },
  };
}

describe("Yahoo market adapter", () => {
  beforeEach(() => fetchMock.mockReset());

  it("normalizes delayed quotes and Swiss exchange suffixes", async () => {
    fetchMock.mockImplementation((input: URL | RequestInfo) => {
      const url = String(input);
      return Promise.resolve(
        Response.json(chartResponse(url.includes("NESN.SW") ? "NESN.SW" : "AAPL")),
      );
    });
    const { YahooMarketDataProvider } = await import(
      "@/lib/providers/markets/yahoo"
    );
    const result = await new YahooMarketDataProvider().getQuotes([
      "AAPL",
      "NESN.CH",
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      expect.objectContaining({
        symbol: "AAPL",
        name: "Apple Inc.",
        currency: "USD",
        price: 227.75,
        delayed: true,
      }),
    );
    expect(fetchMock.mock.calls[1]?.[0].toString()).toContain("NESN.SW");
    expect(result[1].currency).toBe("CHF");
  });

  it("normalizes bounded daily history", async () => {
    fetchMock.mockResolvedValue(Response.json(chartResponse("AAPL")));
    const { YahooMarketDataProvider } = await import(
      "@/lib/providers/markets/yahoo"
    );
    const result = await new YahooMarketDataProvider().getHistory("AAPL", {
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
    const { YahooMarketDataProvider } = await import(
      "@/lib/providers/markets/yahoo"
    );
    await expect(
      new YahooMarketDataProvider().getQuotes(["AAPL"]),
    ).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      message: "Der Datendienst ist momentan nicht erreichbar.",
    });
  });
});
