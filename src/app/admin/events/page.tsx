import { ActionForm } from "@/components/admin/ActionForm";
import {
  DeleteResource,
  EmptyState,
  Fields,
  PageHeader,
  Toggle,
} from "@/components/admin/AdminUI";
import { saveEvent } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { formatZurichDateTimeLocal } from "@/lib/domain/date-time";

export default async function EventsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").order("starts_at");
  const events = data ?? [];
  return (
    <>
      <PageHeader eyebrow="Kalender" title="Termine" description="Einmalige und wiederkehrende Ereignisse für das Board." />
      <section className="admin-card admin-create">
        <h2>Neuer Termin</h2>
        <EventForm />
      </section>
      <section className="admin-list">
        {events.length ? events.map((event) => (
          <details className="admin-item" key={event.id}>
            <summary>
              <span className="item-color" style={{ background: event.color ?? "#ff6b35" }} />
              <span><strong>{event.title}</strong><small>{new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: event.all_day ? undefined : "short", timeZone: "Europe/Zurich" }).format(new Date(event.starts_at))}</small></span>
              <b>{event.enabled ? "Aktiv" : "Aus"}</b>
            </summary>
            <div className="admin-item-body">
              <EventForm event={event} />
              <DeleteResource id={event.id} resource="events" />
            </div>
          </details>
        )) : <EmptyState>Noch keine Termine vorhanden.</EmptyState>}
      </section>
    </>
  );
}

function EventForm({ event }: { event?: {
  id: string; title: string; description: string | null; starts_at: string; ends_at: string;
  all_day: boolean; color: string | null; recurrence: unknown; enabled: boolean;
} }) {
  const recurrence = event?.recurrence as { frequency?: string; interval?: number; count?: number } | null;
  return (
    <ActionForm action={saveEvent}>
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <Fields>
        <label className="wide"><span>Titel</span><input name="title" required maxLength={120} defaultValue={event?.title} /></label>
        <label><span>Beginn</span><input name="starts_at" type="datetime-local" required defaultValue={formatZurichDateTimeLocal(event?.starts_at)} /></label>
        <label><span>Ende</span><input name="ends_at" type="datetime-local" required defaultValue={formatZurichDateTimeLocal(event?.ends_at)} /></label>
        <label><span>Farbe</span><input name="color" type="color" defaultValue={event?.color ?? "#ff6b35"} /></label>
        <label><span>Wiederholung</span>
          <select name="recurrence_frequency" defaultValue={recurrence?.frequency ?? "none"}>
            <option value="none">Keine</option><option value="daily">Täglich</option>
            <option value="weekly">Wöchentlich</option><option value="monthly">Monatlich</option>
            <option value="yearly">Jährlich</option>
          </select>
        </label>
        <label><span>Alle …</span><input name="recurrence_interval" type="number" min={1} max={365} defaultValue={recurrence?.interval ?? 1} /></label>
        <label><span>Max. Wiederholungen</span><input name="recurrence_count" type="number" min={1} max={1000} defaultValue={recurrence?.count ?? ""} placeholder="Unbegrenzt" /></label>
        <label className="wide"><span>Notiz</span><textarea name="description" maxLength={2000} defaultValue={event?.description ?? ""} /></label>
      </Fields>
      <div className="toggle-row">
        <label className="admin-toggle"><input name="all_day" type="checkbox" defaultChecked={event?.all_day} /><span>Ganztägig</span></label>
        <Toggle defaultChecked={event?.enabled ?? true} />
      </div>
    </ActionForm>
  );
}
