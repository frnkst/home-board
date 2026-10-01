import { ActionForm } from "@/components/admin/ActionForm";
import { EmptyState, ItemActions, PageHeader, Toggle } from "@/components/admin/AdminUI";
import { PhotoUploadForm } from "@/components/admin/PhotoUploadForm";
import { deletePhoto, updatePhoto } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";

export default async function PhotosPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("photos").select("*").order("sort_order").order("id");
  const photos = data ?? [];
  const signed = await Promise.all(photos.map(async (photo) => {
    const result = await supabase.storage.from("photos").createSignedUrl(photo.storage_path, 900);
    return { ...photo, preview: result.data?.signedUrl };
  }));
  return <>
    <PageHeader eyebrow="Galerie" title="Fotos" description="Private Bilder hochladen und ihre Reihenfolge festlegen." />
    <section className="admin-card admin-create">
      <h2>Foto hochladen</h2>
      <p className="admin-hint">JPEG, PNG, WebP oder GIF · maximal 50 MB · direkt und privat gespeichert</p>
      <PhotoUploadForm sortOrder={photos.length} />
    </section>
    <section className="photo-grid">
      {signed.length ? signed.map((photo, index) => <article className="photo-card" key={photo.id}>
        {/* Signed storage URLs are short-lived and cannot use a static Next image host. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo.preview ? <img src={photo.preview} alt={photo.caption || "Vorschau"} /> : <div className="photo-placeholder">Keine Vorschau</div>}
        <div className="photo-card-body">
          <ItemActions id={photo.id} resource="photos" canMoveUp={index > 0} canMoveDown={index < signed.length - 1} />
          <ActionForm action={updatePhoto}>
            <input type="hidden" name="id" value={photo.id} /><input type="hidden" name="sort_order" value={photo.sort_order} />
            <label><span>Bildlegende</span><input name="caption" maxLength={240} defaultValue={photo.caption ?? ""} /></label>
            <Toggle defaultChecked={photo.enabled} />
          </ActionForm>
          <ActionForm action={deletePhoto} submitLabel="Foto löschen" destructive>
            <input type="hidden" name="id" value={photo.id} /><input type="hidden" name="storage_path" value={photo.storage_path} />
          </ActionForm>
        </div>
      </article>) : <EmptyState>Noch keine Fotos vorhanden.</EmptyState>}
    </section>
  </>;
}
