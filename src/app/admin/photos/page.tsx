import { ActionForm } from "@/components/admin/ActionForm";
import { EmptyState, Fields, ItemActions, PageHeader, Toggle } from "@/components/admin/AdminUI";
import { deletePhoto, updatePhoto, uploadPhoto } from "@/lib/actions/admin";
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
      <p className="admin-hint">JPEG, PNG, WebP oder GIF · maximal 10 MB · privat gespeichert</p>
      <ActionForm action={uploadPhoto} encType="multipart/form-data" submitLabel="Bild hochladen">
        <Fields>
          <label className="wide file-field"><span>Bild auswählen</span><input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required /></label>
          <label className="wide"><span>Bildlegende (optional)</span><input name="caption" maxLength={240} /></label>
        </Fields>
        <input type="hidden" name="sort_order" value={photos.length} /><Toggle />
      </ActionForm>
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
