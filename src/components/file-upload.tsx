"use client";

import { useId, useRef, useState } from "react";
import { Camera, FileText, Loader2, RefreshCw, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage, randomName } from "@/lib/image";
import { cx } from "@/components/ui";
import { MAX_DOC_BYTES, MAX_IMAGE_BYTES } from "@/lib/constants";

type Kind = "image" | "document";

const ACCEPT: Record<Kind, string> = {
  image: "image/jpeg,image/png,image/webp,image/heic,image/heif",
  document: "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf",
};

/**
 * Uploads a file straight from the phone to a private Storage bucket.
 * Photos are compressed first (max 1600 px, JPG). The storage path is stored
 * in a hidden input called `name`, so the surrounding <form> sends it to the
 * server action, which validates it again.
 */
export function FileUpload({
  name,
  bucket,
  folder,
  kind = "image",
  capture = false,
  label = "Subir archivo",
  hint,
  required,
  big = false,
  onChange,
}: {
  name: string;
  bucket: "receipts" | "inspections" | "damages" | "documents" | "contracts";
  folder: string;
  kind?: Kind;
  capture?: boolean;
  label?: string;
  hint?: string;
  required?: boolean;
  big?: boolean;
  onChange?: (path: string | null) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    const isPdf = file.type === "application/pdf";
    if (kind === "image" && !file.type.startsWith("image/")) {
      setError("Solo se permiten fotos (JPG o PNG).");
      return;
    }
    if (kind === "document" && !isPdf && !file.type.startsWith("image/")) {
      setError("Solo se permiten fotos o PDF.");
      return;
    }
    setBusy(true);
    try {
      let body: Blob = file;
      let ext = "pdf";
      let contentType = "application/pdf";
      if (!isPdf) {
        body = await compressImage(file);
        ext = "jpg";
        contentType = "image/jpeg";
      }
      const limit = isPdf ? MAX_DOC_BYTES : MAX_IMAGE_BYTES;
      if (body.size > limit) {
        setError(`El archivo es muy grande (máximo ${Math.round(limit / 1024 / 1024)} MB).`);
        return;
      }
      const target = `${folder.replace(/\/$/, "")}/${randomName(ext)}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(target, body, { contentType, upsert: false });
      if (upErr) {
        setError("No se pudo subir el archivo. Revisa tu conexión e intenta de nuevo.");
        return;
      }
      setPath(target);
      setFileName(file.name);
      setPreview(isPdf ? null : URL.createObjectURL(body));
      onChange?.(target);
    } catch {
      setError("No se pudo procesar el archivo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const Icon = busy ? Loader2 : capture ? Camera : Upload;

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={path ?? ""} required={required} />
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPT[kind]}
        capture={capture ? "environment" : undefined}
        className="sr-only"
        onChange={(e) => handle(e.target.files?.[0])}
        disabled={busy}
      />
      {path ? (
        <div className="flex items-center gap-3 rounded-2xl border border-ok/40 bg-ok-soft/40 p-2.5">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Vista previa" className="size-20 rounded-xl object-cover" />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-xl bg-surface">
              <FileText className="size-8 text-ink-2" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ok">Listo ✓</p>
            <p className="truncate text-xs text-ink-2">{fileName}</p>
          </div>
          <label
            htmlFor={id}
            className="flex cursor-pointer items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2"
          >
            <RefreshCw className="size-4" /> Cambiar
          </label>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={cx(
            "flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-surface text-ink transition-colors hover:border-brand-strong",
            big ? "min-h-36 flex-col p-6 text-lg font-semibold" : "min-h-14 px-4 py-3 text-[15px] font-medium",
            busy && "pointer-events-none opacity-70",
          )}
        >
          <Icon className={cx(big ? "size-10" : "size-5", busy && "animate-spin")} />
          {busy ? "Subiendo…" : label}
        </label>
      )}
      {error ? <p className="text-sm text-bad">{error}</p> : hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}
