import { ActionForm } from "@/components/admin/ActionForm";
import { DeleteResource, EmptyState, Fields, ItemActions, PageHeader, Toggle } from "@/components/admin/AdminUI";
import { saveWebpage } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";

export default async function WebpagesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("webpages").select("*").order("sort_order").order("id");
  const items = data ?? [];
  return <>
    <PageHeader eyebrow="Einbettungen" title="Webseiten" description="Sichere HTTPS-Seiten als eigene Ansichten einbinden." />
    <section className="admin-card admin-create"><h2>Webseite hinzufügen</h2><WebForm order={items.length} /></section>
    <section className="admin-list">
      {items.length ? items.map((item, index) => <details className="admin-item" key={item.id}>
        <summary><span className="item-number">{index + 1}</span><span><strong>{item.title}</strong><small>{item.url}</small></span><b>{item.enabled ? "Aktiv" : "Aus"}</b></summary>
        <div className="admin-item-body">
          <ItemActions id={item.id} resource="webpages" canMoveUp={index > 0} canMoveDown={index < items.length - 1} />
          <WebForm item={item} order={item.sort_order} />
          <DeleteResource id={item.id} resource="webpages" />
        </div>
      </details>) : <EmptyState>Noch keine Webseiten vorhanden.</EmptyState>}
    </section>
  </>;
}

function WebForm({ item, order }: { item?: { id: string; title: string; url: string; refresh_seconds: number; enabled: boolean }; order: number }) {
  return <ActionForm action={saveWebpage}>
    {item ? <input type="hidden" name="id" value={item.id} /> : null}<input type="hidden" name="sort_order" value={order} />
    <Fields>
      <label><span>Titel</span><input name="title" required maxLength={120} defaultValue={item?.title} /></label>
      <label className="wide"><span>HTTPS-Adresse</span><input name="url" type="url" inputMode="url" required pattern="https://.*" placeholder="https://…" defaultValue={item?.url} /></label>
      <label><span>Neu laden nach (Sek.)</span><input name="refresh_seconds" type="number" min={30} max={86400} defaultValue={item?.refresh_seconds ?? 300} /></label>
    </Fields><Toggle defaultChecked={item?.enabled ?? true} />
  </ActionForm>;
}
