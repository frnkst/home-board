import { ActionForm } from "@/components/admin/ActionForm";
import {
  PageHeader,
  SectionLink,
} from "@/components/admin/AdminUI";
import {
  forceDisplayView,
  resumeDisplayCycle,
} from "@/lib/actions/admin";
import { getPlaylistFrame } from "@/lib/domain/playlist";
import type { PlaylistKind } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

const kindLabels: Record<PlaylistKind, string> = {
  overview: "Übersicht",
  weather: "Wetter",
  departures: "Abfahrten",
  events: "Termine",
  countdowns: "Countdowns",
  live_countdown: "Live Countdown",
  markets: "Ticker",
  photos: "Fotos",
  webpage: "Webseite",
  custom_text: "Eigener Text",
};

export default async function AdminOverview() {
  const supabase = await createClient();
  const [stateResult, playlistResult, events, countdowns, liveCountdowns, markets, photos, webpages, texts] =
    await Promise.all([
      supabase.from("display_state").select("*").eq("id", true).maybeSingle(),
      supabase.from("playlist_entries").select("*").order("sort_order").order("id"),
      supabase.from("events").select("id", { count: "exact", head: true }),
      supabase.from("countdowns").select("id", { count: "exact", head: true }),
      supabase.from("live_countdowns").select("id,title", { count: "exact" }).order("sort_order"),
      supabase.from("market_symbols").select("id", { count: "exact", head: true }),
      supabase.from("photos").select("id", { count: "exact", head: true }),
      supabase.from("webpages").select("id,title", { count: "exact" }).order("sort_order"),
      supabase.from("custom_texts").select("id,title", { count: "exact" }).order("sort_order"),
    ]);
  const state = stateResult.data;
  const playlist = playlistResult.data ?? [];
  const activePlaylist = playlist.filter((entry) => entry.enabled);
  const legacyForced = playlist.find((entry) => entry.id === state?.forced_entry_id);
  const forcedKind = state?.forced_kind ?? legacyForced?.kind ?? null;
  const forcedReferenceId =
    state?.forced_kind ? state.forced_reference_id : legacyForced?.reference_id;
  const automaticFrame = state
    ? getPlaylistFrame(
        activePlaylist.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          referenceId: entry.reference_id,
          durationSeconds: entry.duration_seconds,
          sortOrder: entry.sort_order,
          enabled: entry.enabled,
        })),
        new Date(state.playlist_started_at),
        new Date(),
      )
    : null;
  const currentKind =
    forcedKind ??
    activePlaylist.find((entry) => entry.id === automaticFrame?.entry.id)?.kind ??
    null;
  const fixedViews = (Object.keys(kindLabels) as PlaylistKind[]).map((kind) => ({
    kind,
    label: kindLabels[kind],
    referenceId: null,
  }));
  const contentViews = [
    ...(liveCountdowns.data ?? []).map((item) => ({
      kind: "live_countdown" as const,
      label: `Live Countdown · ${item.title}`,
      referenceId: item.id,
    })),
    ...(webpages.data ?? []).map((item) => ({
      kind: "webpage" as const,
      label: `Webseite · ${item.title}`,
      referenceId: item.id,
    })),
    ...(texts.data ?? []).map((item) => ({
      kind: "custom_text" as const,
      label: `Text · ${item.title || "Ohne Titel"}`,
      referenceId: item.id,
    })),
  ];
  const counts = [
    ["Termine", events.count ?? 0],
    ["Countdowns", countdowns.count ?? 0],
    ["Live Countdowns", liveCountdowns.count ?? 0],
    ["Ticker", markets.count ?? 0],
    ["Fotos", photos.count ?? 0],
    ["Webseiten", webpages.count ?? 0],
    ["Texte", texts.count ?? 0],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Donnerstag · Zuhause"
        title="Alles im Blick."
        description="Inhalte pflegen und bestimmen, was gerade auf dem Familienboard läuft."
      />
      <section className="display-control">
        <div>
          <span className={`status-dot ${forcedKind ? "paused" : ""}`} />
          <p>Aktuelle Anzeige</p>
          <h2>{currentKind ? kindLabels[currentKind] : "Keine aktive Ansicht"}</h2>
          <small>
            {forcedKind
              ? "Manuell fixiert – der Zeitplan ist pausiert."
              : automaticFrame
                ? `Automatischer Wechsel · nächste Ansicht um ${new Intl.DateTimeFormat("de-CH", { timeStyle: "short", timeZone: "Europe/Zurich" }).format(automaticFrame.nextChangeAt)} Uhr`
                : "Die Playlist enthält keine aktive Ansicht."}
          </small>
        </div>
        {forcedKind ? (
          <ActionForm action={resumeDisplayCycle} submitLabel="Wechsel fortsetzen" />
        ) : null}
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <h2>Direkt anzeigen</h2>
          <span>Ein Tippen pausiert den automatischen Wechsel.</span>
        </div>
        <div className="override-grid">
            {[...fixedViews, ...contentViews].map((view) => (
              <ActionForm
                action={forceDisplayView}
                submitLabel={view.label}
                key={`${view.kind}-${view.referenceId ?? "all"}`}
                className={
                  view.kind === forcedKind &&
                  view.referenceId === (forcedReferenceId ?? null)
                    ? "is-active"
                    : ""
                }
              >
                <input name="kind" type="hidden" value={view.kind} />
                <input name="reference_id" type="hidden" value={view.referenceId ?? ""} />
              </ActionForm>
            ))}
          </div>
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <h2>Inhalte</h2>
          <span>{counts.reduce((sum, item) => sum + Number(item[1]), 0)} Einträge gesamt</span>
        </div>
        <div className="admin-link-grid">
          <SectionLink href="/admin/events" title="Termine" detail={`${events.count ?? 0} Einträge`} />
          <SectionLink href="/admin/countdowns" title="Countdowns" detail={`${countdowns.count ?? 0} Einträge`} />
          <SectionLink href="/admin/live-countdowns" title="Live Countdowns" detail={`${liveCountdowns.count ?? 0} Timer`} />
          <SectionLink href="/admin/ticker" title="Ticker" detail={`${markets.count ?? 0} Symbole`} />
          <SectionLink href="/admin/photos" title="Fotos" detail={`${photos.count ?? 0} Bilder`} />
          <SectionLink href="/admin/webpages" title="Webseiten" detail={`${webpages.count ?? 0} Seiten`} />
          <SectionLink href="/admin/texts" title="Eigene Texte" detail={`${texts.count ?? 0} Texte`} />
        </div>
      </section>
    </>
  );
}
