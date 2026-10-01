import { describe, expect, it } from "vitest";

import { expandEventRecurrences } from "@/lib/domain/recurrence";
import type { CalendarEvent } from "@/lib/domain/types";

const baseEvent: CalendarEvent = {
  id: "1a7fb710-181c-4cf1-a6ca-96f29598514a",
  title: "Termin",
  description: null,
  startsAt: "2026-03-28T08:00:00.000Z",
  endsAt: "2026-03-28T09:00:00.000Z",
  allDay: false,
  color: null,
  recurrence: { frequency: "daily", interval: 1 },
  enabled: true,
};

describe("expandEventRecurrences", () => {
  it("keeps Zurich wall-clock time across the daylight-saving transition", () => {
    const occurrences = expandEventRecurrences(
      baseEvent,
      new Date("2026-03-28T00:00:00Z"),
      new Date("2026-03-31T00:00:00Z"),
    );

    expect(occurrences.map((occurrence) => occurrence.startsAt)).toEqual([
      "2026-03-28T08:00:00.000Z",
      "2026-03-29T07:00:00.000Z",
      "2026-03-30T07:00:00.000Z",
    ]);
  });

  it("supports weekday schedules, interval and count", () => {
    const occurrences = expandEventRecurrences(
      {
        ...baseEvent,
        startsAt: "2026-09-28T07:00:00.000Z",
        endsAt: "2026-09-28T08:00:00.000Z",
        recurrence: {
          frequency: "weekly",
          interval: 2,
          weekdays: [1, 3],
          count: 4,
        },
      },
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-11-01T00:00:00Z"),
    );

    expect(occurrences.map((occurrence) => occurrence.startsAt)).toEqual([
      "2026-09-28T07:00:00.000Z",
      "2026-09-30T07:00:00.000Z",
      "2026-10-12T07:00:00.000Z",
      "2026-10-14T07:00:00.000Z",
    ]);
  });

  it("includes occurrences that overlap the requested range", () => {
    const occurrences = expandEventRecurrences(
      { ...baseEvent, recurrence: null },
      new Date("2026-03-28T08:30:00Z"),
      new Date("2026-03-28T10:00:00Z"),
    );
    expect(occurrences).toHaveLength(1);
  });
});
