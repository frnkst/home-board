import { ActionForm } from "@/components/admin/ActionForm";
import { DeleteResource, EmptyState, Fields, ItemActions, PageHeader, Toggle } from "@/components/admin/AdminUI";
import { saveMarketSymbol } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";

export default async function TickerPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("market_symbols").select("*").order("sort_order").order("id");
  const items = data ?? [];
  return <>
    <PageHeader eyebrow="Märkte" title="Ticker-Symbole" description="Börsenkurse und Währungen in der gewünschten Reihenfolge." />
    <section className="admin-card admin-create"><h2>Symbol hinzufügen</h2><SymbolForm order={items.length} /></section>
    <section className="admin-list">
      {items.length ? items.map((item, index) => <details className="admin-item" key={item.id}>
        <summary><span className="item-number">{index + 1}</span><span><strong>{item.symbol}</strong><small>{item.label} · {item.currency}</small></span><b>{item.enabled ? "Aktiv" : "Aus"}</b></summary>
        <div className="admin-item-body">
          <ItemActions id={item.id} resource="market_symbols" canMoveUp={index > 0} canMoveDown={index < items.length - 1} />
          <SymbolForm item={item} order={item.sort_order} />
          <DeleteResource id={item.id} resource="market_symbols" />
        </div>
      </details>) : <EmptyState>Noch keine Symbole vorhanden.</EmptyState>}
    </section>
  </>;
}

function SymbolForm({ item, order }: { item?: { id: string; symbol: string; label: string; currency: string; enabled: boolean }; order: number }) {
  return <ActionForm action={saveMarketSymbol}>
    {item ? <input type="hidden" name="id" value={item.id} /> : null}<input type="hidden" name="sort_order" value={order} />
    <Fields>
      <label><span>Symbol</span><input name="symbol" required maxLength={24} autoCapitalize="characters" placeholder="AAPL" defaultValue={item?.symbol} /></label>
      <label><span>Bezeichnung</span><input name="label" required maxLength={80} placeholder="Apple" defaultValue={item?.label} /></label>
      <label><span>Währung</span><input name="currency" required minLength={3} maxLength={3} autoCapitalize="characters" defaultValue={item?.currency ?? "CHF"} /></label>
    </Fields><Toggle defaultChecked={item?.enabled ?? true} />
  </ActionForm>;
}
