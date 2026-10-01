import { describe, expect, it } from "vitest";

import {
  formatZurichDateTimeLocal,
  parseZurichDateTimeLocal,
} from "@/lib/domain/date-time";

describe("Zurich datetime-local conversion", () => {
  it.each([
    ["2026-01-15T08:30", "2026-01-15T07:30:00.000Z"],
    ["2026-07-15T08:30", "2026-07-15T06:30:00.000Z"],
  ])("round-trips %s across the correct DST offset", (local, instant) => {
    expect(parseZurichDateTimeLocal(local)).toBe(instant);
    expect(formatZurichDateTimeLocal(instant)).toBe(local);
  });

  it("rejects a local time skipped by the spring DST transition", () => {
    expect(() => parseZurichDateTimeLocal("2026-03-29T02:30")).toThrow();
  });
});
