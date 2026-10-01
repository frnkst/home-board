import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("German daily fact provider", () => {
  beforeEach(() => fetchMock.mockReset());

  it("normalizes a German daily fact", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        id: "fact-1",
        text: "Bienen können Gesichter erkennen.",
        source: "Example",
        source_url: "https://example.com/fact",
        language: "de",
      }),
    );
    const { getDailyFact } = await import("@/lib/providers/daily-fact");

    await expect(getDailyFact()).resolves.toEqual(
      expect.objectContaining({
        id: "fact-1",
        text: "Bienen können Gesichter erkennen.",
        source: "Example",
      }),
    );
    expect(fetchMock.mock.calls[0]?.[0].toString()).toContain("language=de");
  });

  it("rejects non-German responses", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        id: "fact-1",
        text: "Bees can recognize faces.",
        source: "Example",
        source_url: "https://example.com/fact",
        language: "en",
      }),
    );
    const { getDailyFact } = await import("@/lib/providers/daily-fact");

    await expect(getDailyFact()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
});
