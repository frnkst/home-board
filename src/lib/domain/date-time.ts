import { HOME_TIME_ZONE } from "@/lib/domain/schemas";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: HOME_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parts(date: Date) {
  return Object.fromEntries(
    partsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

export function parseZurichDateTimeLocal(value: string): string {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new RangeError("Ungültiges Datum.");
  const wanted = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  const wallClockUtc = Date.UTC(
    wanted.year,
    wanted.month - 1,
    wanted.day,
    wanted.hour,
    wanted.minute,
    wanted.second,
  );
  const candidates = [-2, -1, 0, 1, 2].map(
    (offsetHours) => new Date(wallClockUtc - offsetHours * 3_600_000),
  );
  const instant = candidates.find((candidate) => {
    const actual = parts(candidate);
    return Object.entries(wanted).every(([key, expected]) => actual[key] === expected);
  });
  if (!instant) throw new RangeError("Diese Uhrzeit existiert in Europe/Zurich nicht.");
  return instant.toISOString();
}

export function formatZurichDateTimeLocal(value?: string | Date): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const valueParts = parts(date);
  return `${valueParts.year}-${String(valueParts.month).padStart(2, "0")}-${String(
    valueParts.day,
  ).padStart(2, "0")}T${String(valueParts.hour).padStart(2, "0")}:${String(
    valueParts.minute,
  ).padStart(2, "0")}`;
}
