import { ActionForm } from "@/components/admin/ActionForm";
import { DeleteResource, EmptyState, Fields, ItemActions, PageHeader, Toggle } from "@/components/admin/AdminUI";
import { saveCountdown } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { formatZurichDateTimeLocal } from "@/lib/domain/date-time";

export default async function CountdownsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("countdowns").select("*").order("sort_order").order("id");
  const items = data ?? [];
  return (
    <>
      <PageHeader eyebrow="Vorfreude" title="Countdowns" description="Ferien, Geburtstage und alles, worauf ihr hinfiebert." />
      <section className="admin-card admin-create"><h2>Neuer Countdown</h2><CountdownForm order={items.length} /></section>
      <section className="admin-list">
        {items.length ? items.map((item, index) => (
          <details className="admin-item" key={item.id}>
            <summary><span className="item-number">{index + 1}</span><span><strong>{item.title}</strong><small>{new Intl.DateTimeFormat("de-CH", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Zurich" }).format(new Date(item.target_at))}</small></span><b>{item.enabled ? "Aktiv" : "Aus"}</b></summary>
            <div className="admin-item-body">
              <ItemActions id={item.id} resource="countdowns" canMoveUp={index > 0} canMoveDown={index < items.length - 1} />
              <CountdownForm item={item} order={item.sort_order} />
              <DeleteResource id={item.id} resource="countdowns" />
            </div>
          </details>
        )) : <EmptyState>Noch keine Countdowns vorhanden.</EmptyState>}
      </section>
    </>
  );
}

function CountdownForm({ item, order }: { item?: { id: string; title: string; target_at: string; color: string | null; enabled: boolean }; order: number }) {
  return <ActionForm action={saveCountdown}>
    {item ? <input type="hidden" name="id" value={item.id} /> : null}<input type="hidden" name="sort_order" value={order} />
    <Fields>
      <label className="wide"><span>Titel</span><input name="title" required maxLength={120} defaultValue={item?.title} /></label>
      <label><span>Zieldatum</span><input name="target_at" type="datetime-local" required defaultValue={formatZurichDateTimeLocal(item?.target_at)} /></label>
      <label><span>Farbe</span><input name="color" type="color" defaultValue={item?.color ?? "#2f7d68"} /></label>
    </Fields><Toggle defaultChecked={item?.enabled ?? true} />
  </ActionForm>;
}
