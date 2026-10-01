"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function PhotoUploadForm({ sortOrder }: { sortOrder: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);

  async function upload(formData: FormData) {
    setPending(true);
    setFeedback(null);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setPending(false);
      setFeedback({ status: "error", message: "Bitte ein Bild auswählen." });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setPending(false);
      setFeedback({
        status: "error",
        message: "Das Bild darf höchstens 50 MB gross sein.",
      });
      return;
    }
    const extension = EXTENSIONS[file.type];
    if (!extension) {
      setPending(false);
      setFeedback({
        status: "error",
        message: "Erlaubt sind JPEG, PNG, WebP und GIF.",
      });
      return;
    }

    const storagePath = `${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${extension}`;
    const supabase = createClient();
    try {
      const uploaded = await supabase.storage
        .from("photos")
        .upload(storagePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
      if (uploaded.error) {
        setFeedback({ status: "error", message: uploaded.error.message });
        return;
      }

      const caption = String(formData.get("caption") ?? "").trim() || null;
      const inserted = await supabase.from("photos").insert({
        storage_path: storagePath,
        caption,
        sort_order: sortOrder,
        enabled: formData.get("enabled") === "on",
      });
      if (inserted.error) {
        await supabase.storage.from("photos").remove([storagePath]);
        setFeedback({ status: "error", message: inserted.error.message });
        return;
      }

      formRef.current?.reset();
      setFeedback({ status: "success", message: "Foto hochgeladen." });
      router.refresh();
    } catch {
      setFeedback({
        status: "error",
        message: "Der Upload ist fehlgeschlagen. Bitte erneut versuchen.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      ref={formRef}
      action={upload}
      encType="multipart/form-data"
    >
      <div className="admin-fields">
        <label className="wide file-field">
          <span>Bild auswählen</span>
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            required
          />
        </label>
        <label className="wide">
          <span>Bildlegende (optional)</span>
          <input name="caption" maxLength={240} />
        </label>
      </div>
      <label className="admin-toggle">
        <input name="enabled" type="checkbox" defaultChecked />
        <span>Auf dem Board anzeigen</span>
      </label>
      <button className="admin-button" type="submit" disabled={pending}>
        {pending ? "Bild wird hochgeladen …" : "Bild hochladen"}
      </button>
      {feedback ? (
        <p
          className={`admin-feedback ${feedback.status}`}
          role={feedback.status === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}
