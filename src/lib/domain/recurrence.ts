import { HOME_TIME_ZONE, recurrenceSchema } from "@/lib/domain/schemas";
import type {
  CalendarEvent,
  EventOccurrence,
  Recurrence,
} from "@/lib/domain/types";

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: HOME_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getZonedParts(date: Date): DateParts {
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return values as DateParts;
}

function partsAsUtc(parts: DateParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

function zonedPartsToDate(parts: DateParts): Date {
  const desired = partsAsUtc(parts);
  let timestamp = desired;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const difference = desired - partsAsUtc(getZonedParts(new Date(timestamp)));
    if (difference === 0) break;
    timestamp += difference;
  }
  return new Date(timestamp);
}

function calendarDate(parts: DateParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function withCalendarDate(date: Date, time: DateParts): DateParts {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: time.hour,
    minute: time.minute,
    second: time.second,
  };
}

function isScheduledDate(
  candidate: Date,
  startDate: Date,
  recurrence: Recurrence,
): boolean {
  const dayDistance = Math.round(
    (candidate.getTime() - startDate.getTime()) / 86_400_000,
  );

  switch (recurrence.frequency) {
    case "daily":
      return dayDistance % recurrence.interval === 0;
    case "weekly": {
      const startMondayOffset = (startDate.getUTCDay() + 6) % 7;
      const weekDistance = Math.floor(
        (dayDistance + startMondayOffset) / 7,
      );
      const weekdays = recurrence.weekdays ?? [startDate.getUTCDay()];
      return (
        weekDistance % recurrence.interval === 0 &&
        weekdays.includes(candidate.getUTCDay())
      );
    }
    case "monthly": {
      const monthDistance =
        (candidate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
        candidate.getUTCMonth() -
        startDate.getUTCMonth();
      return (
        monthDistance % recurrence.interval === 0 &&
        candidate.getUTCDate() === startDate.getUTCDate()
      );
    }
    case "yearly":
      return (
        (candidate.getUTCFullYear() - startDate.getUTCFullYear()) %
          recurrence.interval ===
          0 &&
        candidate.getUTCMonth() === startDate.getUTCMonth() &&
        candidate.getUTCDate() === startDate.getUTCDate()
      );
  }
}

/**
 * Expands an event using calendar time in Europe/Zurich. Range end is exclusive;
 * occurrences overlapping either boundary are included.
 */
export function expandEventRecurrences(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date,
): EventOccurrence[] {
  if (!(rangeStart < rangeEnd)) {
    throw new RangeError("rangeStart must be before rangeEnd");
  }

  const recurrence = event.recurrence
    ? recurrenceSchema.parse(event.recurrence)
    : null;
  const eventStart = new Date(event.startsAt);
  const duration = new Date(event.endsAt).getTime() - eventStart.getTime();
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new RangeError("event must have a positive duration");
  }

  const occurrences: EventOccurrence[] = [];
  const append = (start: Date, occurrenceIndex: number) => {
    const end = new Date(start.getTime() + duration);
    if (start < rangeEnd && end > rangeStart) {
      occurrences.push({
        ...event,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        sourceEventId: event.id,
        occurrenceIndex,
      });
    }
  };

  append(eventStart, 0);
  if (!recurrence) return occurrences;

  const startParts = getZonedParts(eventStart);
  const startCalendarDate = calendarDate(startParts);
  const until = recurrence.until ? new Date(recurrence.until) : null;
  const maxCount = recurrence.count ?? Number.POSITIVE_INFINITY;
  let generated = 1;
  const candidateDate = new Date(startCalendarDate);

  // The schema caps count and callers provide a finite range; this is a final
  // safeguard against malformed dates or accidentally unbounded expansion.
  for (let scannedDays = 0; scannedDays < 366_000; scannedDays += 1) {
    candidateDate.setUTCDate(candidateDate.getUTCDate() + 1);
    if (!isScheduledDate(candidateDate, startCalendarDate, recurrence)) continue;

    const candidate = zonedPartsToDate(withCalendarDate(candidateDate, startParts));
    if (candidate >= rangeEnd || (until && candidate > until)) break;
    if (generated >= maxCount) break;
    append(candidate, generated);
    generated += 1;
  }

  return occurrences;
}

export function expandEvents(
  events: readonly CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): EventOccurrence[] {
  return events
    .flatMap((event) =>
      event.enabled
        ? expandEventRecurrences(event, rangeStart, rangeEnd)
        : [],
    )
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime() ||
        left.id.localeCompare(right.id),
    );
}
