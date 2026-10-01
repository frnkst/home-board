import { ActionForm } from "@/components/admin/ActionForm";
import {
  DeleteResource,
  EmptyState,
  Fields,
  ItemActions,
  PageHeader,
  Toggle,
} from "@/components/admin/AdminUI";
import { saveLiveCountdown } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";

const timeFormatter = new Intl.DateTimeFormat("de-CH", {
  timeZone: "Europe/Zurich",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function LiveCountdownsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("live_countdowns")
    .select("*")
    .order("sort_order")
    .order("id");
  const items = data ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Auf die Sekunde"
        title="Live Countdowns"
        description="Starte einen Timer für eine Dauer oder bis zu einer bestimmten Uhrzeit."
      />
      <section className="admin-card admin-create">
        <h2>Neuen Countdown starten</h2>
        <LiveCountdownForm order={items.length} />
      </section>
      <section className="admin-list">
        {items.length ? (
          items.map((item, index) => (
            <details className="admin-item" key={item.id}>
              <summary>
                <span className="item-number">{index + 1}</span>
                <span>
                  <strong>{item.title}</strong>
                  <small>Ziel: {timeFormatter.format(new Date(item.target_at))}</small>
                </span>
                <b>{item.enabled ? "Aktiv" : "Aus"}</b>
              </summary>
              <div className="admin-item-body">
                <ItemActions
                  id={item.id}
                  resource="live_countdowns"
                  canMoveUp={index > 0}
                  canMoveDown={index < items.length - 1}
                />
                <LiveCountdownForm item={item} order={item.sort_order} />
                <DeleteResource id={item.id} resource="live_countdowns" />
              </div>
            </details>
          ))
        ) : (
          <EmptyState>Noch keine Live Countdowns vorhanden.</EmptyState>
        )}
      </section>
    </>
  );
}

function LiveCountdownForm({
  item,
  order,
}: {
  item?: {
    id: string;
    title: string;
    completion_text: string;
    enabled: boolean;
  };
  order: number;
}) {
  return (
    <ActionForm action={saveLiveCountdown}>
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="sort_order" value={order} />
      <Fields>
        <label className="wide">
          <span>Titel</span>
          <input
            name="title"
            required
            maxLength={120}
            placeholder="Pizza ist fertig in …"
            defaultValue={item?.title}
          />
        </label>
        <label>
          <span>Countdown-Typ</span>
          <select name="mode" defaultValue="duration">
            <option value="duration">Dauer ab jetzt</option>
            <option value="clock">Bis zu einer Uhrzeit</option>
          </select>
        </label>
        <label>
          <span>Dauer in Minuten</span>
          <input name="duration_minutes" type="number" min={1} max={10080} defaultValue={15} />
        </label>
        <label>
          <span>Oder Zielzeit</span>
          <input name="clock_time" type="time" />
        </label>
        <label className="wide">
          <span>Text, wenn die Zeit abgelaufen ist</span>
          <input
            name="completion_text"
            required
            maxLength={500}
            placeholder="Fertig! Kommt alle an den Tisch."
            defaultValue={item?.completion_text}
          />
        </label>
      </Fields>
      <Toggle defaultChecked={item?.enabled ?? true} />
    </ActionForm>
  );
}
