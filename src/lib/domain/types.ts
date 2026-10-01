import type { z } from "zod";

import type {
  appSettingsSchema,
  countdownSchema,
  customTextSchema,
  displayStateSchema,
  eventSchema,
  liveCountdownSchema,
  marketSymbolSchema,
  photoSchema,
  playlistEntrySchema,
  playlistKindSchema,
  recurrenceSchema,
  webpageSchema,
} from "@/lib/domain/schemas";

export type Recurrence = z.infer<typeof recurrenceSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type CalendarEvent = z.infer<typeof eventSchema>;
export type Countdown = z.infer<typeof countdownSchema>;
export type LiveCountdown = z.infer<typeof liveCountdownSchema>;
export type MarketSymbol = z.infer<typeof marketSymbolSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type Webpage = z.infer<typeof webpageSchema>;
export type CustomText = z.infer<typeof customTextSchema>;
export type PlaylistKind = z.infer<typeof playlistKindSchema>;
export type PlaylistEntry = z.infer<typeof playlistEntrySchema>;
export type DisplayState = z.infer<typeof displayStateSchema>;

export type EventOccurrence = Omit<CalendarEvent, "recurrence"> & {
  sourceEventId: string;
  recurrence: Recurrence | null;
  occurrenceIndex: number;
};
