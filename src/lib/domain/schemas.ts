import { z } from "zod";

export const HOME_TIME_ZONE = "Europe/Zurich" as const;

const idSchema = z.uuid();
const timestampSchema = z.iso.datetime({ offset: true });
const titleSchema = z.string().trim().min(1).max(120);

export const recurrenceSchema = z
  .object({
    frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
    interval: z.number().int().min(1).max(365).default(1),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    count: z.number().int().min(1).max(1000).optional(),
    until: timestampSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.weekdays && value.frequency !== "weekly") {
      context.addIssue({
        code: "custom",
        path: ["weekdays"],
        message: "Wochentage sind nur bei wöchentlicher Wiederholung erlaubt.",
      });
    }
  });

export const appSettingsSchema = z.object({
  id: z.literal(true),
  householdName: z.string().trim().min(1).max(80),
  timezone: z.literal(HOME_TIME_ZONE),
  locale: z.literal("de-CH"),
  weatherPlaceName: z.string().trim().min(1).max(120),
  weatherLatitude: z.number().min(-90).max(90),
  weatherLongitude: z.number().min(-180).max(180),
  weatherForecastDays: z.number().int().min(1).max(16),
  transportStopName: z.string().trim().min(1).max(120),
  transportStopId: z.string().trim().min(1).max(80),
  transportDepartureCount: z.number().int().min(1).max(20),
  updatedAt: timestampSchema,
});

export const eventSchema = z
  .object({
    id: idSchema,
    title: titleSchema,
    description: z.string().max(2000).nullable(),
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    allDay: z.boolean(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
    recurrence: recurrenceSchema.nullable(),
    enabled: z.boolean(),
  })
  .refine(
    (event) => new Date(event.endsAt).getTime() > new Date(event.startsAt).getTime(),
    { path: ["endsAt"], message: "Das Ende muss nach dem Beginn liegen." },
  );

export const countdownSchema = z.object({
  id: idSchema,
  title: titleSchema,
  targetAt: timestampSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0),
});

export const marketSymbolSchema = z.object({
  id: idSchema,
  symbol: z.string().trim().min(1).max(24).regex(/^[A-Z0-9.^=-]+$/),
  label: z.string().trim().min(1).max(80),
  currency: z.string().trim().length(3).toUpperCase(),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0),
});

export const photoSchema = z.object({
  id: idSchema,
  storagePath: z.string().min(1).max(512).refine((path) => !path.startsWith("/")),
  caption: z.string().trim().max(240).nullable(),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0),
});

export const webpageSchema = z.object({
  id: idSchema,
  title: titleSchema,
  url: z.url().refine((url) => /^https?:\/\//.test(url)),
  refreshSeconds: z.number().int().min(30).max(86400),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0),
});

export const customTextSchema = z.object({
  id: idSchema,
  title: titleSchema.nullable(),
  body: z.string().trim().min(1).max(10000),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0),
});

export const playlistKindSchema = z.enum([
  "overview",
  "weather",
  "departures",
  "events",
  "countdowns",
  "markets",
  "photos",
  "webpage",
  "custom_text",
]);

export const playlistEntrySchema = z.object({
  id: idSchema,
  kind: playlistKindSchema,
  referenceId: idSchema.nullable(),
  durationSeconds: z.number().int().min(5).max(3600),
  sortOrder: z.number().int().min(0),
  enabled: z.boolean(),
});

export const displayStateSchema = z.object({
  id: z.literal(true),
  playlistStartedAt: timestampSchema,
  pausedAt: timestampSchema.nullable(),
  forcedEntryId: idSchema.nullable(),
  updatedAt: timestampSchema,
});

export const domainSchemas = {
  appSettings: appSettingsSchema,
  event: eventSchema,
  countdown: countdownSchema,
  marketSymbol: marketSymbolSchema,
  photo: photoSchema,
  webpage: webpageSchema,
  customText: customTextSchema,
  playlistEntry: playlistEntrySchema,
  displayState: displayStateSchema,
} as const;
