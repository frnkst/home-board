import { ActionForm } from "@/components/admin/ActionForm";
import { DeleteResource, EmptyState, Fields, ItemActions, PageHeader, Toggle } from "@/components/admin/AdminUI";
import { saveCustomText } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";

export default async function TextsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("custom_texts").select("*").order("sort_order").order("id");
  const items = data ?? [];
  return <>
    <PageHeader eyebrow="Mitteilungen" title="Eigene Texte" description="Kurze Nachrichten, Erinnerungen und Familiennotizen." />
    <section className="admin-card admin-create"><h2>Text hinzufügen</h2><TextForm order={items.length} /></section>
    <section className="admin-list">
      {items.length ? items.map((item, index) => <details className="admin-item" key={item.id}>
        <summary><span className="item-number">{index + 1}</span><span><strong>{item.title || "Ohne Titel"}</strong><small>{item.body.slice(0, 90)}</small></span><b>{item.enabled ? "Aktiv" : "Aus"}</b></summary>
        <div className="admin-item-body">
          <ItemActions id={item.id} resource="custom_texts" canMoveUp={index > 0} canMoveDown={index < items.length - 1} />
          <TextForm item={item} order={item.sort_order} />
          <DeleteResource id={item.id} resource="custom_texts" />
        </div>
      </details>) : <EmptyState>Noch keine Texte vorhanden.</EmptyState>}
    </section>
  </>;
}

function TextForm({ item, order }: { item?: { id: string; title: string | null; body: string; enabled: boolean }; order: number }) {
  return <ActionForm action={saveCustomText}>
    {item ? <input type="hidden" name="id" value={item.id} /> : null}<input type="hidden" name="sort_order" value={order} />
    <Fields>
      <label className="wide"><span>Titel (optional)</span><input name="title" maxLength={120} defaultValue={item?.title ?? ""} /></label>
      <label className="wide"><span>Text</span><textarea name="body" required maxLength={10000} rows={6} defaultValue={item?.body} /></label>
    </Fields><Toggle defaultChecked={item?.enabled ?? true} />
  </ActionForm>;
}
