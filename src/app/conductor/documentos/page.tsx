import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { DocumentList } from "@/components/document-list";
import { DocumentUploadFields } from "@/components/document-upload-fields";
import { Alert, Card, SectionTitle } from "@/components/ui";
import { getDriverContext } from "@/lib/driver";
import { createClient } from "@/lib/supabase/server";
import { documentUrls, signedUrl } from "@/lib/storage";
import { formatCOP, formatDate, formatTime, WEEKDAYS } from "@/lib/format";
import type { DocumentRow } from "@/lib/types";
import { uploadMyDocument } from "./actions";

export const metadata: Metadata = { title: "Mis documentos" };

export default async function DriverDocumentsPage() {
  const ctx = await getDriverContext();
  const supabase = await createClient();
  const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
  const docs = (data as DocumentRow[]) ?? [];
  const mine = docs.filter((d) => d.entity === "driver");
  const hasBoth = (type: string) =>
    mine.some((d) => d.doc_type === type && d.review_status !== "rejected" && d.back_file_path);
  const missing = [!hasBoth("national_id") ? "tu cédula" : null, !hasBoth("license") ? "tu licencia" : null].filter(Boolean);
  const moto = docs.filter((d) => d.entity === "motorcycle");
  const urls = await documentUrls(docs);
  const contractUrl = ctx.contract?.file_path ? await signedUrl("contracts", ctx.contract.file_path) : null;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Documentos y contrato</h1>

      {ctx.contract ? (
        <>
          <SectionTitle>Mi contrato</SectionTitle>
          <Card className="space-y-1 text-[15px]">
            <p>
              <span className="text-ink-2">Moto:</span> <strong>{ctx.motorcycle?.plate}</strong> ({ctx.motorcycle?.brand}{" "}
              {ctx.motorcycle?.model})
            </p>
            <p>
              <span className="text-ink-2">Tarifa diaria:</span> <strong>{formatCOP(ctx.contract.daily_rate)}</strong>
            </p>
            <p>
              <span className="text-ink-2">Descanso:</span>{" "}
              {ctx.contract.rest_weekdays.map((d) => WEEKDAYS[d]).join(", ") || "Ninguno"}
            </p>
            <p>
              <span className="text-ink-2">Pagar antes de:</span> {formatTime(ctx.contract.payment_deadline)}
            </p>
            <p>
              <span className="text-ink-2">Desde:</span> {formatDate(ctx.contract.start_date)}
            </p>
            <p>
              <span className="text-ink-2">Devolución de la moto con:</span> {ctx.contract.max_late_days} días de atraso
            </p>
            {contractUrl ? (
              <a href={contractUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 font-semibold text-info">
                <ExternalLink className="size-4" /> Ver contrato firmado (PDF)
              </a>
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionTitle>Documentos de la moto</SectionTitle>
      <DocumentList docs={moto} urls={urls} empty="Aún no hay documentos de la moto." />

      <SectionTitle>Mis documentos</SectionTitle>
      {missing.length ? (
        <div className="mb-3">
          <Alert tone="warn">
            Falta la foto de {missing.join(" y ")} por los dos lados (frente y reverso). Súbela abajo.
          </Alert>
        </div>
      ) : null}
      <DocumentList docs={mine} urls={urls} empty="Aún no has subido documentos." />

      <SectionTitle>Subir un documento</SectionTitle>
      <Card>
        <ActionForm action={uploadMyDocument} submitLabel="Guardar documento" resetOnSuccess>
          <DocumentUploadFields types={["national_id", "license", "background_check", "other"]} folder={ctx.driver.id} idPrefix="mydoc" />
        </ActionForm>
      </Card>
    </>
  );
}
