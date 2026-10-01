import { beforeEach, describe, expect, it, vi } from "vitest";

import currentFixture from "@/lib/providers/__fixtures__/open-meteo-current.json";
import forecastFixture from "@/lib/providers/__fixtures__/open-meteo-forecast.json";
import placesFixture from "@/lib/providers/__fixtures__/open-meteo-places.json";

vi.mock("server-only", () => ({}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("Open-Meteo adapter", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("normalizes place search results", async () => {
    fetchMock.mockResolvedValue(jsonResponse(placesFixture));
    const { searchPlaces } = await import("@/lib/providers/open-meteo");
    const result = await searchPlaces({ query: "Zürich", limit: 3 });

    expect(result.places).toEqual([
      expect.objectContaining({
        id: "2657896",
        name: "Zürich",
        countryCode: "CH",
        latitude: 47.36667,
      }),
    ]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("count=3");
  });

  it("normalizes current weather with an offset timestamp", async () => {
    fetchMock.mockResolvedValue(jsonResponse(currentFixture));
    const { getCurrentWeather } = await import("@/lib/providers/open-meteo");
    const result = await getCurrentWeather({
      latitude: 47.37,
      longitude: 8.55,
    });

    expect(result).toEqual(
      expect.objectContaining({
        observedAt: "2026-10-01T09:00:00+02:00",
        temperatureCelsius: 14.2,
        weatherCode: 2,
        isDay: true,
      }),
    );
  });

  it("normalizes aligned daily forecasts", async () => {
    fetchMock.mockResolvedValue(jsonResponse(forecastFixture));
    const { getWeatherForecast } = await import("@/lib/providers/open-meteo");
    const result = await getWeatherForecast({
      latitude: 47.37,
      longitude: 8.55,
      days: 2,
    });

    expect(result.days).toHaveLength(2);
    expect(result.days[1]).toEqual(
      expect.objectContaining({
        date: "2026-10-02",
        precipitationProbabilityPercent: 80,
        sunset: "2026-10-02T19:02:00+02:00",
      }),
    );
  });

  it("rejects malformed upstream data with a normalized error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ current: {} }));
    const { getCurrentWeather } = await import("@/lib/providers/open-meteo");
    await expect(
      getCurrentWeather({ latitude: 47.37, longitude: 8.55 }),
    ).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      message: "Der Datendienst hat unerwartete Daten geliefert.",
    });
  });

  it("normalizes request timeouts", async () => {
    fetchMock.mockRejectedValue(
      new DOMException("The operation timed out", "TimeoutError"),
    );
    const { searchPlaces } = await import("@/lib/providers/open-meteo");
    await expect(searchPlaces({ query: "Zürich" })).rejects.toMatchObject({
      code: "TIMEOUT",
      message: "Der Datendienst hat nicht rechtzeitig geantwortet.",
      retryable: true,
    });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
