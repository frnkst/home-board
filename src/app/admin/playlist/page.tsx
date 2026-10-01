import { ActionForm } from "@/components/admin/ActionForm";
import { DeleteResource, EmptyState, Fields, ItemActions, PageHeader, Toggle } from "@/components/admin/AdminUI";
import { savePlaylistEntry } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";

const kinds = [
  ["overview", "Übersicht"], ["weather", "Wetter"], ["departures", "Abfahrten"],
  ["events", "Termine"], ["countdowns", "Countdowns"], ["markets", "Ticker"],
  ["photos", "Fotos"], ["webpage", "Webseite"], ["custom_text", "Eigener Text"],
] as const;

export default async function PlaylistPage() {
  const supabase = await createClient();
  const [entriesResult, pagesResult, textsResult] = await Promise.all([
    supabase.from("playlist_entries").select("*").order("sort_order").order("id"),
    supabase.from("webpages").select("id,title").order("sort_order"),
    supabase.from("custom_texts").select("id,title").order("sort_order"),
  ]);
  const entries = entriesResult.data ?? [];
  const references = [
    ...(pagesResult.data ?? []).map((item) => ({ ...item, kind: "webpage" })),
    ...(textsResult.data ?? []).map((item) => ({ ...item, kind: "custom_text" })),
  ];
  return <>
    <PageHeader eyebrow="Ablauf" title="Playlist" description="Ansichten dürfen mehrfach vorkommen – jeweils mit eigener Anzeigedauer." />
    <section className="admin-card admin-create"><h2>Ansicht hinzufügen</h2><PlaylistForm order={entries.length} references={references} /></section>
    <section className="admin-list playlist-list">
      {entries.length ? entries.map((entry, index) => <details className="admin-item" key={entry.id}>
        <summary><span className="item-number">{index + 1}</span><span><strong>{kinds.find(([key]) => key === entry.kind)?.[1]}</strong><small>{entry.duration_seconds} Sekunden {entry.reference_id ? "· verknüpfter Inhalt" : "· Übersicht"}</small></span><b>{entry.enabled ? "Aktiv" : "Aus"}</b></summary>
        <div className="admin-item-body">
          <ItemActions id={entry.id} resource="playlist_entries" canMoveUp={index > 0} canMoveDown={index < entries.length - 1} />
          <PlaylistForm entry={entry} order={entry.sort_order} references={references} />
          <DeleteResource id={entry.id} resource="playlist_entries" />
        </div>
      </details>) : <EmptyState>Die Playlist ist noch leer.</EmptyState>}
    </section>
  </>;
}

type Reference = { id: string; title: string | null; kind: string };
function PlaylistForm({ entry, order, references }: {
  entry?: { id: string; kind: "overview" | "weather" | "departures" | "events" | "countdowns" | "markets" | "photos" | "webpage" | "custom_text"; reference_id: string | null; duration_seconds: number; enabled: boolean };
  order: number; references: Reference[];
}) {
  return <ActionForm action={savePlaylistEntry}>
    {entry ? <input type="hidden" name="id" value={entry.id} /> : null}<input type="hidden" name="sort_order" value={order} />
    <Fields>
      <label><span>Ansicht</span><select name="kind" defaultValue={entry?.kind ?? "events"}>{kinds.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label><span>Bestimmter Inhalt (optional)</span><select name="reference_id" defaultValue={entry?.reference_id ?? ""}><option value="">Gesamtansicht</option>{references.map((reference) => <option value={reference.id} key={reference.id}>{reference.kind === "webpage" ? "Webseite" : "Text"}: {reference.title || "Ohne Titel"}</option>)}</select></label>
      <label><span>Dauer in Sekunden</span><input name="duration_seconds" type="number" min={5} max={3600} defaultValue={entry?.duration_seconds ?? 30} /></label>
    </Fields><Toggle defaultChecked={entry?.enabled ?? true} />
  </ActionForm>;
}
