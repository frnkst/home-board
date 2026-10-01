import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (operation: () => unknown) => operation,
}));
vi.mock("@/lib/env.server", () => ({
  getServerEnv: () => ({
    OPENROUTER_API_KEY: "test-key",
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const weather = {
  current: {
    temperatureCelsius: 12,
    apparentTemperatureCelsius: 10,
    precipitationMm: 0,
    weatherCode: 3,
    windSpeedKmh: 18,
  },
  forecast: [{
    date: "2026-10-01",
    temperatureMaxCelsius: 17,
    temperatureMinCelsius: 8,
    precipitationMm: 4,
    precipitationProbabilityPercent: 70,
    windSpeedMaxKmh: 25,
    weatherCode: 61,
  }],
};

describe("OpenRouter clothing advice", () => {
  beforeEach(() => fetchMock.mockReset());

  it("returns exactly three validated German clothing tips", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [
                "Lange Hose und warmer Pullover",
                "Leichte Regenjacke mitnehmen",
                "Geschlossene, wasserfeste Schuhe",
              ],
            }),
          },
        }],
      }),
    );
    const { getClothingAdvice } = await import("@/lib/providers/openrouter");
    const result = await getClothingAdvice(weather, {
      latitude: 47.37,
      longitude: 8.54,
      name: "Zürich",
    });

    expect(result?.items).toHaveLength(3);
    expect(result?.items[1]).toBe("Leichte Regenjacke mitnehmen");
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.model).toBe("openai/gpt-4o-mini");
    expect(request.response_format.json_schema.schema.properties.items).toEqual(
      expect.objectContaining({ minItems: 3, maxItems: 3 }),
    );
  });

  it("rejects malformed model output", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        choices: [{ message: { content: '{"items":["Nur ein Tipp"]}' } }],
      }),
    );
    const { getClothingAdvice } = await import("@/lib/providers/openrouter");

    await expect(
      getClothingAdvice(weather, {
        latitude: 47.37,
        longitude: 8.54,
        name: "Zürich",
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
