"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import {
  formatZurichDateTimeLocal,
  parseZurichDateTimeLocal,
} from "@/lib/domain/date-time";
import { recurrenceSchema } from "@/lib/domain/schemas";
import { searchPlaces, searchStops } from "@/lib/providers";
import { createClient } from "@/lib/supabase/server";

export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  results?: Array<{
    id: string;
    title: string;
    subtitle: string;
    values?: Record<string, string>;
  }>;
};

const id = z.string().uuid();
const nullableText = (maximum: number) =>
  z.string().trim().max(maximum).transform((value) => value || null);
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false")])
  .optional()
  .transform((value) => value === "on" || value === "true");
const sortOrder = z.coerce.number().int().min(0);
const localDateTime = z.string().min(1).transform((value, context) => {
  try {
    return parseZurichDateTimeLocal(value);
  } catch {
    context.addIssue({ code: "custom", message: "Ungültiges Datum." });
    return z.NEVER;
  }
});

function errorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Bitte Eingaben prüfen.";
  }
  return error instanceof Error ? error.message : "Unbekannter Fehler.";
}

async function run(
  operation: () => Promise<void>,
  success: string,
): Promise<ActionState> {
  try {
    await requireAdmin();
    await operation();
    revalidatePath("/admin", "layout");
    return { status: "success", message: success };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function assertDatabaseSuccess(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const eventInput = z
  .object({
    id: id.optional(),
    title: requiredText(120),
    description: nullableText(2000),
    starts_at: localDateTime,
    ends_at: localDateTime,
    all_day: checkbox,
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional(),
    enabled: checkbox,
    recurrence_frequency: z
      .enum(["none", "daily", "weekly", "monthly", "yearly"])
      .default("none"),
    recurrence_interval: z.coerce.number().int().min(1).max(365).default(1),
    recurrence_count: z
      .union([z.literal(""), z.coerce.number().int().min(1).max(1000)])
      .optional(),
  })
  .refine((data) => new Date(data.ends_at) > new Date(data.starts_at), {
    message: "Das Ende muss nach dem Beginn liegen.",
    path: ["ends_at"],
  });

export async function saveEvent(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = eventInput.parse(values(formData));
    const recurrence =
      input.recurrence_frequency === "none"
        ? null
        : recurrenceSchema.parse({
            frequency: input.recurrence_frequency,
            interval: input.recurrence_interval,
            count: input.recurrence_count || undefined,
          });
    const payload = {
      title: input.title,
      description: input.description,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      all_day: input.all_day,
      color: input.color ?? null,
      enabled: input.enabled,
      recurrence,
    };
    const supabase = await createClient();
    const result = input.id
      ? await supabase.from("events").update(payload).eq("id", input.id)
      : await supabase.from("events").insert(payload);
    assertDatabaseSuccess(result.error);
  }, "Termin gespeichert.");
}

const orderedInputs = {
  countdowns: z.object({
    id: id.optional(),
    title: requiredText(120),
    target_at: localDateTime,
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    enabled: checkbox,
    sort_order: sortOrder,
  }),
  live_countdowns: z.object({
    id: id.optional(),
    title: requiredText(120),
    mode: z.enum(["duration", "clock"]),
    duration_minutes: z.coerce.number().int().min(1).max(10080).optional(),
    clock_time: z
      .union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)])
      .optional()
      .transform((value) => value || undefined),
    completion_text: requiredText(500),
    enabled: checkbox,
    sort_order: sortOrder,
  }),
  market_symbols: z.object({
    id: id.optional(),
    symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9.^=-]{1,24}$/),
    label: requiredText(80),
    currency: z.string().trim().toUpperCase().length(3),
    enabled: checkbox,
    sort_order: sortOrder,
  }),
  webpages: z.object({
    id: id.optional(),
    title: requiredText(120),
    url: z
      .string()
      .url("Bitte eine gültige URL eingeben.")
      .refine((url) => url.startsWith("https://"), "Nur HTTPS ist erlaubt."),
    refresh_seconds: z.coerce.number().int().min(30).max(86400),
    enabled: checkbox,
    sort_order: sortOrder,
  }),
  custom_texts: z.object({
    id: id.optional(),
    title: nullableText(120),
    body: requiredText(10000),
    enabled: checkbox,
    sort_order: sortOrder,
  }),
};

export async function saveCountdown(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = orderedInputs.countdowns.parse(values(formData));
    const supabase = await createClient();
    const result = input.id
      ? await supabase.from("countdowns").update(input).eq("id", input.id)
      : await supabase.from("countdowns").insert(input);
    assertDatabaseSuccess(result.error);
  }, "Countdown gespeichert.");
}

function nextZurichClockTarget(clockTime: string, now = new Date()) {
  const localNow = formatZurichDateTimeLocal(now);
  const date = localNow.slice(0, 10);
  let target = new Date(parseZurichDateTimeLocal(`${date}T${clockTime}`));
  if (target.getTime() <= now.getTime()) {
    const tomorrow = new Date(now.getTime() + 26 * 3_600_000);
    const tomorrowDate = formatZurichDateTimeLocal(tomorrow).slice(0, 10);
    target = new Date(
      parseZurichDateTimeLocal(`${tomorrowDate}T${clockTime}`),
    );
  }
  return target.toISOString();
}

export async function saveLiveCountdown(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = orderedInputs.live_countdowns.parse(values(formData));
    if (input.mode === "duration" && !input.duration_minutes) {
      throw new Error("Bitte eine Dauer in Minuten eingeben.");
    }
    if (input.mode === "clock" && !input.clock_time) {
      throw new Error("Bitte eine Zielzeit eingeben.");
    }
    const targetAt =
      input.mode === "duration"
        ? new Date(
            Date.now() + (input.duration_minutes ?? 0) * 60_000,
          ).toISOString()
        : nextZurichClockTarget(input.clock_time!);
    const payload = {
      title: input.title,
      target_at: targetAt,
      completion_text: input.completion_text,
      enabled: input.enabled,
      sort_order: input.sort_order,
    };
    const supabase = await createClient();
    const result = input.id
      ? await supabase.from("live_countdowns").update(payload).eq("id", input.id)
      : await supabase.from("live_countdowns").insert(payload);
    assertDatabaseSuccess(result.error);
  }, "Live Countdown gestartet.");
}

export async function saveMarketSymbol(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = orderedInputs.market_symbols.parse(values(formData));
    const supabase = await createClient();
    const result = input.id
      ? await supabase.from("market_symbols").update(input).eq("id", input.id)
      : await supabase.from("market_symbols").insert(input);
    assertDatabaseSuccess(result.error);
  }, "Ticker-Symbol gespeichert.");
}

export async function saveWebpage(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = orderedInputs.webpages.parse(values(formData));
    const supabase = await createClient();
    const result = input.id
      ? await supabase.from("webpages").update(input).eq("id", input.id)
      : await supabase.from("webpages").insert(input);
    assertDatabaseSuccess(result.error);
  }, "Webseite gespeichert.");
}

export async function saveCustomText(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = orderedInputs.custom_texts.parse(values(formData));
    const supabase = await createClient();
    const result = input.id
      ? await supabase.from("custom_texts").update(input).eq("id", input.id)
      : await supabase.from("custom_texts").insert(input);
    assertDatabaseSuccess(result.error);
  }, "Text gespeichert.");
}

const deleteInput = z.object({
  id,
  resource: z.enum([
    "events",
    "countdowns",
    "live_countdowns",
    "market_symbols",
    "webpages",
    "custom_texts",
    "playlist_entries",
  ]),
});

export async function deleteResource(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = deleteInput.parse(values(formData));
    const supabase = await createClient();
    switch (input.resource) {
      case "events":
        assertDatabaseSuccess(
          (await supabase.from("events").delete().eq("id", input.id)).error,
        );
        break;
      case "countdowns":
        assertDatabaseSuccess(
          (await supabase.from("countdowns").delete().eq("id", input.id)).error,
        );
        break;
      case "live_countdowns":
        assertDatabaseSuccess(
          (await supabase.from("live_countdowns").delete().eq("id", input.id))
            .error,
        );
        break;
      case "market_symbols":
        assertDatabaseSuccess(
          (await supabase.from("market_symbols").delete().eq("id", input.id))
            .error,
        );
        break;
      case "webpages":
        assertDatabaseSuccess(
          (await supabase.from("webpages").delete().eq("id", input.id)).error,
        );
        break;
      case "custom_texts":
        assertDatabaseSuccess(
          (await supabase.from("custom_texts").delete().eq("id", input.id))
            .error,
        );
        break;
      case "playlist_entries":
        assertDatabaseSuccess(
          (await supabase.from("playlist_entries").delete().eq("id", input.id))
            .error,
        );
        break;
    }
  }, "Eintrag gelöscht.");
}

const photoInput = z.object({
  caption: nullableText(240),
  sort_order: sortOrder,
  enabled: checkbox,
});

export async function uploadPhoto(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = photoInput.parse(values(formData));
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Bitte ein Bild auswählen.");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Das Bild darf höchstens 10 MB gross sein.");
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      throw new Error("Erlaubt sind JPEG, PNG, WebP und GIF.");
    }
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
    const storagePath = `${new Date().getUTCFullYear()}/${randomUUID()}${extension ? `.${extension}` : ""}`;
    const supabase = await createClient();
    const upload = await supabase.storage.from("photos").upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
    assertDatabaseSuccess(upload.error);
    const inserted = await supabase.from("photos").insert({
      storage_path: storagePath,
      caption: input.caption,
      sort_order: input.sort_order,
      enabled: input.enabled,
    });
    if (inserted.error) {
      await supabase.storage.from("photos").remove([storagePath]);
      throw inserted.error;
    }
  }, "Foto hochgeladen.");
}

export async function updatePhoto(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = photoInput.extend({ id }).parse(values(formData));
    const supabase = await createClient();
    assertDatabaseSuccess(
      (
        await supabase
          .from("photos")
          .update({
            caption: input.caption,
            sort_order: input.sort_order,
            enabled: input.enabled,
          })
          .eq("id", input.id)
      ).error,
    );
  }, "Foto aktualisiert.");
}

export async function deletePhoto(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = z.object({ id, storage_path: z.string().min(1) }).parse(values(formData));
    const supabase = await createClient();
    assertDatabaseSuccess(
      (await supabase.storage.from("photos").remove([input.storage_path])).error,
    );
    assertDatabaseSuccess(
      (await supabase.from("photos").delete().eq("id", input.id)).error,
    );
  }, "Foto gelöscht.");
}

const playlistInput = z.object({
  id: id.optional(),
  kind: z.enum([
    "overview",
    "weather",
    "departures",
    "events",
    "countdowns",
    "live_countdown",
    "markets",
    "photos",
    "webpage",
    "custom_text",
  ]),
  reference_id: z
    .union([z.literal(""), id])
    .transform((value) => value || null),
  duration_seconds: z.coerce.number().int().min(5).max(3600),
  sort_order: sortOrder,
  enabled: checkbox,
});

export async function savePlaylistEntry(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = playlistInput.parse(values(formData));
    const supabase = await createClient();
    const result = input.id
      ? await supabase.from("playlist_entries").update(input).eq("id", input.id)
      : await supabase.from("playlist_entries").insert(input);
    assertDatabaseSuccess(result.error);
  }, "Playlist gespeichert.");
}

const orderInput = z.object({
  id,
  resource: z.enum([
    "countdowns",
    "live_countdowns",
    "market_symbols",
    "photos",
    "webpages",
    "custom_texts",
    "playlist_entries",
  ]),
  direction: z.enum(["up", "down"]),
});

export async function moveResource(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = orderInput.parse(values(formData));
    const supabase = await createClient();
    const move = async (
      table: typeof input.resource,
    ) => {
      const query = await supabase
        .from(table)
        .select("id, sort_order")
        .order("sort_order")
        .order("id");
      assertDatabaseSuccess(query.error);
      const rows = query.data ?? [];
      const index = rows.findIndex((row) => row.id === input.id);
      const otherIndex = input.direction === "up" ? index - 1 : index + 1;
      if (index < 0 || otherIndex < 0 || otherIndex >= rows.length) return;
      const current = rows[index];
      const other = rows[otherIndex];
      if (!current || !other) return;
      const reordered = [...rows];
      [reordered[index], reordered[otherIndex]] = [
        reordered[otherIndex],
        reordered[index],
      ];
      for (const [position, row] of reordered.entries()) {
        assertDatabaseSuccess(
          (await supabase.from(table).update({ sort_order: position }).eq("id", row.id))
            .error,
        );
      }
    };
    await move(input.resource);
  }, "Reihenfolge geändert.");
}

export async function forceDisplayEntry(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const entryId = id.parse(formData.get("id"));
    const supabase = await createClient();
    const entry = await supabase
      .from("playlist_entries")
      .select("id")
      .eq("id", entryId)
      .eq("enabled", true)
      .maybeSingle();
    assertDatabaseSuccess(entry.error);
    if (!entry.data) throw new Error("Diese Ansicht ist deaktiviert.");
    assertDatabaseSuccess(
      (
        await supabase
          .from("display_state")
          .update({
            forced_entry_id: entryId,
            paused_at: new Date().toISOString(),
          })
          .eq("id", true)
      ).error,
    );
  }, "Ansicht fixiert.");
}

export async function resumeDisplayCycle(): Promise<ActionState> {
  return run(async () => {
    const supabase = await createClient();
    assertDatabaseSuccess(
      (
        await supabase
          .from("display_state")
          .update({
            forced_entry_id: null,
            paused_at: null,
            playlist_started_at: new Date().toISOString(),
          })
          .eq("id", true)
      ).error,
    );
  }, "Automatischer Wechsel fortgesetzt.");
}

const settingsInput = z.object({
  household_name: requiredText(80),
  weather_place_name: requiredText(120),
  weather_latitude: z.coerce.number().min(-90).max(90),
  weather_longitude: z.coerce.number().min(-180).max(180),
  weather_forecast_days: z.coerce.number().int().min(1).max(16),
  transport_stop_name: requiredText(120),
  transport_stop_id: requiredText(80),
  transport_departure_count: z.coerce.number().int().min(1).max(20),
});

export async function saveSettings(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = settingsInput.parse(values(formData));
    const supabase = await createClient();
    assertDatabaseSuccess(
      (
        await supabase
          .from("app_settings")
          .update(input)
          .eq("id", true)
      ).error,
    );
  }, "Einstellungen gespeichert.");
}

export async function searchWeatherPlaces(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();
    const query = requiredText(100).parse(formData.get("query"));
    const data = await searchPlaces({ query, limit: 8, language: "de" });
    return {
      status: "success",
      message: data.places.length ? undefined : "Keine Orte gefunden.",
      results: data.places.map((place) => ({
        id: `${place.latitude},${place.longitude}`,
        title: place.name,
        subtitle: [place.region, place.country].filter(Boolean).join(", "),
        values: {
          weather_place_name: place.name,
          weather_latitude: String(place.latitude),
          weather_longitude: String(place.longitude),
        },
      })),
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function searchTransportStops(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();
    const query = requiredText(100).parse(formData.get("query"));
    const data = await searchStops({ query, limit: 8 });
    return {
      status: "success",
      message: data.stops.length ? undefined : "Keine Haltestellen gefunden.",
      results: data.stops.map((station) => ({
        id: station.id,
        title: station.name,
        subtitle: station.id ? `Haltestellen-ID ${station.id}` : "ÖV-Haltestelle",
        values: {
          transport_stop_name: station.name,
          transport_stop_id: station.id,
        },
      })),
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function selectWeatherPlace(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = settingsInput
      .pick({
        weather_place_name: true,
        weather_latitude: true,
        weather_longitude: true,
      })
      .parse(values(formData));
    const supabase = await createClient();
    assertDatabaseSuccess(
      (await supabase.from("app_settings").update(input).eq("id", true)).error,
    );
  }, "Wetterort ausgewählt und gespeichert.");
}

export async function selectTransportStop(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const input = settingsInput
      .pick({ transport_stop_name: true, transport_stop_id: true })
      .parse(values(formData));
    const supabase = await createClient();
    assertDatabaseSuccess(
      (await supabase.from("app_settings").update(input).eq("id", true)).error,
    );
  }, "Haltestelle ausgewählt und gespeichert.");
}
