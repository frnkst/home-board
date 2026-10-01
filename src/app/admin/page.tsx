import { ActionForm } from "@/components/admin/ActionForm";
import {
  EmptyState,
  PageHeader,
  SectionLink,
} from "@/components/admin/AdminUI";
import {
  forceDisplayEntry,
  resumeDisplayCycle,
} from "@/lib/actions/admin";
import { getPlaylistFrame } from "@/lib/domain/playlist";
import { createClient } from "@/lib/supabase/server";

const kindLabels = {
  overview: "Übersicht",
  weather: "Wetter",
  departures: "Abfahrten",
  events: "Termine",
  countdowns: "Countdowns",
  markets: "Ticker",
  photos: "Fotos",
  webpage: "Webseite",
  custom_text: "Eigener Text",
};

export default async function AdminOverview() {
  const supabase = await createClient();
  const [stateResult, playlistResult, events, countdowns, markets, photos, webpages, texts] =
    await Promise.all([
      supabase.from("display_state").select("*").eq("id", true).maybeSingle(),
      supabase.from("playlist_entries").select("*").order("sort_order").order("id"),
      supabase.from("events").select("id", { count: "exact", head: true }),
      supabase.from("countdowns").select("id", { count: "exact", head: true }),
      supabase.from("market_symbols").select("id", { count: "exact", head: true }),
      supabase.from("photos").select("id", { count: "exact", head: true }),
      supabase.from("webpages").select("id", { count: "exact", head: true }),
      supabase.from("custom_texts").select("id", { count: "exact", head: true }),
    ]);
  const state = stateResult.data;
  const playlist = playlistResult.data ?? [];
  const activePlaylist = playlist.filter((entry) => entry.enabled);
  const forced = playlist.find((entry) => entry.id === state?.forced_entry_id);
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
  const currentEntry = forced ?? activePlaylist.find((entry) => entry.id === automaticFrame?.entry.id);
  const counts = [
    ["Termine", events.count ?? 0],
    ["Countdowns", countdowns.count ?? 0],
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
          <span className={`status-dot ${forced ? "paused" : ""}`} />
          <p>Aktuelle Anzeige</p>
          <h2>{currentEntry ? kindLabels[currentEntry.kind] : "Keine aktive Ansicht"}</h2>
          <small>
            {forced
              ? "Manuell fixiert – der Zeitplan ist pausiert."
              : automaticFrame
                ? `Automatischer Wechsel · nächste Ansicht um ${new Intl.DateTimeFormat("de-CH", { timeStyle: "short", timeZone: "Europe/Zurich" }).format(automaticFrame.nextChangeAt)} Uhr`
                : "Die Playlist enthält keine aktive Ansicht."}
          </small>
        </div>
        {forced ? (
          <ActionForm action={resumeDisplayCycle} submitLabel="Wechsel fortsetzen" />
        ) : null}
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <h2>Direkt anzeigen</h2>
          <span>Ein Tippen pausiert den automatischen Wechsel.</span>
        </div>
        {activePlaylist.length ? (
          <div className="override-grid">
            {activePlaylist.map((entry, index) => (
              <ActionForm
                action={forceDisplayEntry}
                submitLabel={`${index + 1}. ${kindLabels[entry.kind]}`}
                key={entry.id}
                className={entry.id === forced?.id ? "is-active" : ""}
              >
                <input name="id" type="hidden" value={entry.id} />
              </ActionForm>
            ))}
          </div>
        ) : (
          <EmptyState>Lege zuerst Einträge in der Playlist an.</EmptyState>
        )}
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <h2>Inhalte</h2>
          <span>{counts.reduce((sum, item) => sum + Number(item[1]), 0)} Einträge gesamt</span>
        </div>
        <div className="admin-link-grid">
          <SectionLink href="/admin/events" title="Termine" detail={`${events.count ?? 0} Einträge`} />
          <SectionLink href="/admin/countdowns" title="Countdowns" detail={`${countdowns.count ?? 0} Einträge`} />
          <SectionLink href="/admin/ticker" title="Ticker" detail={`${markets.count ?? 0} Symbole`} />
          <SectionLink href="/admin/photos" title="Fotos" detail={`${photos.count ?? 0} Bilder`} />
          <SectionLink href="/admin/webpages" title="Webseiten" detail={`${webpages.count ?? 0} Seiten`} />
          <SectionLink href="/admin/texts" title="Eigene Texte" detail={`${texts.count ?? 0} Texte`} />
        </div>
      </section>
    </>
  );
}
