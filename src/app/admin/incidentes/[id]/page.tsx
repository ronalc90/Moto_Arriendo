import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { FileUpload } from "@/components/file-upload";
import { Badge, Card, Field, Input, PageHeader, SectionTitle, Select, Textarea } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { INCIDENT_KIND_LABEL, RESPONSIBLE_LABEL } from "@/lib/constants";
import { formatCOP, formatDate, formatDateTime, formatThousands } from "@/lib/format";
import { updateIncident } from "../actions";
import { PartySelect } from "../incident-fields";

export const metadata: Metadata = { title: "Incidente" };

export default async function IncidentDetailPage({ params }: PageProps<"/admin/incidentes/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("incidents")
    .select("*, motorcycles(id, plate), drivers(id, profiles(full_name))")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const i = data as {
    id: string;
    kind: string;
    occurred_on: string;
    description: string;
    responsible: string;
    cost: number;
    paid_by: string;
    reference: string | null;
    files: string[];
    status: "open" | "closed";
    resolution_notes: string | null;
    closed_at: string | null;
    motorcycles: { id: string; plate: string };
    drivers: { id: string; profiles: { full_name: string } } | null;
  };
  const urls = await signedUrls("documents", i.files, 600);

  return (
    <>
      <Link href="/admin/incidentes" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Incidentes
      </Link>
      <PageHeader
        title={`${INCIDENT_KIND_LABEL[i.kind]} · ${i.motorcycles.plate}`}
        subtitle={`${formatDate(i.occurred_on)}${i.drivers ? ` · ${i.drivers.profiles.full_name}` : ""}${i.reference ? ` · Ref. ${i.reference}` : ""}`}
        action={<Badge tone={i.status === "open" ? "warn" : "ok"}>{i.status === "open" ? "Abierto" : "Cerrado"}</Badge>}
      />
      <Card>
        <p className="whitespace-pre-line">{i.description}</p>
        <p className="mt-3 text-sm text-ink-2">
          Costo {formatCOP(i.cost)} · responsable {RESPONSIBLE_LABEL[i.responsible]} · paga {RESPONSIBLE_LABEL[i.paid_by]}
          {i.closed_at ? ` · cerrado ${formatDateTime(i.closed_at)}` : ""}
        </p>
      </Card>
      {i.files.length ? (
        <>
          <SectionTitle>Documentos</SectionTitle>
          <Card className="divide-y divide-line p-0">
            {i.files.map((f, n) => (
              <a key={f} href={urls.get(f)} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-3 font-medium text-info">
                <ExternalLink className="size-4" /> Documento {n + 1}
              </a>
            ))}
          </Card>
        </>
      ) : null}
      <SectionTitle>Actualizar</SectionTitle>
      <Card>
        <ActionForm action={updateIncident} submitLabel="Guardar" submitSize="md">
          <input type="hidden" name="id" value={i.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <PartySelect name="responsible" label="Responsable" defaultValue={i.responsible} />
            <PartySelect name="paid_by" label="¿Quién paga?" defaultValue={i.paid_by} />
            <Field label="Costo" htmlFor="cost">
              <Input id="cost" name="cost" inputMode="numeric" defaultValue={formatThousands(i.cost)} />
            </Field>
            <Field label="Estado" htmlFor="status">
              <Select id="status" name="status" defaultValue={i.status}>
                <option value="open">Abierto</option>
                <option value="closed">Cerrado</option>
              </Select>
            </Field>
            <Field label="Referencia" htmlFor="reference">
              <Input id="reference" name="reference" defaultValue={i.reference ?? ""} />
            </Field>
          </div>
          <Field label="Solución / notas" htmlFor="resolution_notes">
            <Textarea id="resolution_notes" name="resolution_notes" defaultValue={i.resolution_notes ?? ""} />
          </Field>
          <FileUpload name="files" bucket="documents" folder={`incidents/${i.motorcycles.id}`} kind="document" label="Agregar documento" />
        </ActionForm>
      </Card>
    </>
  );
}
