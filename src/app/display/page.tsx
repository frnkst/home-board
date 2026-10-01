import { DisplayBoard } from "@/components/display/display-board";
import type { DisplayData } from "@/components/display/types";
import { getPublicEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/auth";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

import "./display.css";

export const dynamic = "force-dynamic";

function emptyData(error: string | null = null): DisplayData {
  return {
    settings: null,
    events: [],
    countdowns: [],
    marketSymbols: [],
    photos: [],
    webpages: [],
    customTexts: [],
    playlist: [],
    displayState: null,
    loadedAt: new Date().toISOString(),
    error,
  };
}

async function loadDisplayData(): Promise<DisplayData> {
  try {
    getPublicEnv();
  } catch {
    return emptyData(
      "Home Board ist noch nicht eingerichtet. Supabase-Umgebungsvariablen fehlen.",
    );
  }

  try {
    const supabase = await createClient();
    const [
      settings,
      events,
      countdowns,
      marketSymbols,
      photos,
      webpages,
      customTexts,
      playlist,
      displayState,
    ] = await Promise.all([
      supabase.from("app_settings").select("*").eq("id", true).maybeSingle(),
      supabase.from("events").select("*").eq("enabled", true),
      supabase.from("countdowns").select("*").eq("enabled", true),
      supabase.from("market_symbols").select("*").eq("enabled", true),
      supabase.from("photos").select("*").eq("enabled", true),
      supabase.from("webpages").select("*").eq("enabled", true),
      supabase.from("custom_texts").select("*").eq("enabled", true),
      supabase.from("playlist_entries").select("*").eq("enabled", true),
      supabase.from("display_state").select("*").eq("id", true).maybeSingle(),
    ]);

    const queryError = [
      settings,
      events,
      countdowns,
      marketSymbols,
      photos,
      webpages,
      customTexts,
      playlist,
      displayState,
    ].find((result) => result.error)?.error;
    if (queryError) throw queryError;

    const signedPhotos = await Promise.all(
      (photos.data ?? []).map(async (photo) => {
        const { data } = await supabase.storage
          .from("photos")
          .createSignedUrl(photo.storage_path, 60 * 60);
        return {
          id: photo.id,
          storagePath: photo.storage_path,
          caption: photo.caption,
          enabled: photo.enabled,
          sortOrder: photo.sort_order,
          signedUrl: data?.signedUrl ?? null,
        };
      }),
    );

    const data: DisplayData = {
      settings: settings.data
        ? {
            id: true,
            householdName: settings.data.household_name,
            timezone: "Europe/Zurich",
            locale: "de-CH",
            weatherPlaceName: settings.data.weather_place_name,
            weatherLatitude: settings.data.weather_latitude,
            weatherLongitude: settings.data.weather_longitude,
            weatherForecastDays: settings.data.weather_forecast_days,
            transportStopName: settings.data.transport_stop_name,
            transportStopId: settings.data.transport_stop_id,
            transportDepartureCount: settings.data.transport_departure_count,
            updatedAt: settings.data.updated_at,
          }
        : null,
      events: (events.data ?? []).map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        allDay: event.all_day,
        color: event.color,
        recurrence: event.recurrence as Json as never,
        enabled: event.enabled,
      })),
      countdowns: (countdowns.data ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        targetAt: item.target_at,
        color: item.color,
        enabled: item.enabled,
        sortOrder: item.sort_order,
      })),
      marketSymbols: (marketSymbols.data ?? []).map((item) => ({
        id: item.id,
        symbol: item.symbol,
        label: item.label,
        currency: item.currency,
        enabled: item.enabled,
        sortOrder: item.sort_order,
      })),
      photos: signedPhotos,
      webpages: (webpages.data ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        refreshSeconds: item.refresh_seconds,
        enabled: item.enabled,
        sortOrder: item.sort_order,
      })),
      customTexts: (customTexts.data ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        enabled: item.enabled,
        sortOrder: item.sort_order,
      })),
      playlist: (playlist.data ?? []).map((item) => ({
        id: item.id,
        kind: item.kind,
        referenceId: item.reference_id,
        durationSeconds: item.duration_seconds,
        sortOrder: item.sort_order,
        enabled: item.enabled,
      })),
      displayState: displayState.data
        ? {
            id: true,
            playlistStartedAt: displayState.data.playlist_started_at,
            pausedAt: displayState.data.paused_at,
            forcedEntryId: displayState.data.forced_entry_id,
            updatedAt: displayState.data.updated_at,
          }
        : null,
      loadedAt: new Date().toISOString(),
      error: null,
    };

    return data;
  } catch {
    return emptyData(
      "Die Anzeige konnte keine Verbindung zur Home-Board-Datenbank herstellen.",
    );
  }
}

export default async function DisplayPage() {
  await requireAdmin();
  const data = await loadDisplayData();
  return <DisplayBoard initialData={data} />;
}
