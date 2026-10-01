import { beforeEach, describe, expect, it, vi } from "vitest";

import departuresFixture from "@/lib/providers/__fixtures__/transport-departures.json";
import stopsFixture from "@/lib/providers/__fixtures__/transport-stops.json";

vi.mock("server-only", () => ({}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("transport.opendata.ch adapter", () => {
  beforeEach(() => fetchMock.mockReset());

  it("normalizes valid stops and drops incomplete results", async () => {
    fetchMock.mockResolvedValue(jsonResponse(stopsFixture));
    const { searchStops } = await import("@/lib/providers/transport");
    const result = await searchStops({ query: "Zürich", limit: 5 });

    expect(result.stops).toEqual([
      {
        id: "8503000",
        name: "Zürich HB",
        latitude: 47.378177,
        longitude: 8.540192,
        distanceMetres: 42,
      },
    ]);
  });

  it("uses real-time departure and platform prognosis", async () => {
    fetchMock.mockResolvedValue(jsonResponse(departuresFixture));
    const { getDepartures } = await import("@/lib/providers/transport");
    const result = await getDepartures({ stationId: "8503000", limit: 10 });

    expect(result.departures[0]).toEqual(
      expect.objectContaining({
        line: "IC 5",
        expectedAt: "2026-10-01T09:35:00+0200",
        delayMinutes: 3,
        platform: "8",
      }),
    );
  });

  it("rejects invalid station identifiers without fetching", async () => {
    const { getDepartures } = await import("@/lib/providers/transport");
    await expect(
      getDepartures({ stationId: "<script>", limit: 10 }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

