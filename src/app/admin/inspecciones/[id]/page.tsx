import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Alert, Badge, Card, Field, PageHeader, SectionTitle, Textarea } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { CHECKLIST_ITEMS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Inspection } from "@/lib/types";
import { reviewInspection } from "../actions";

export const metadata: Metadata = { title: "Inspección" };

const PHOTOS = [
  { key: "photo_front", label: "Frente" },
  { key: "photo_back", label: "Atrás" },
  { key: "photo_left", label: "Izquierda" },
  { key: "photo_right", label: "Derecha" },
  { key: "photo_dashboard", label: "Tablero" },
] as const;

export default async function InspectionDetailPage({ params }: PageProps<"/admin/inspecciones/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("inspections")
    .select("*, motorcycles(plate), drivers(profiles(full_name))")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const i = data as Inspection & { motorcycles: { plate: string }; drivers: { profiles: { full_name: string } } };
  const urls = await signedUrls("inspections", PHOTOS.map((p) => i[p.key]), 600);

  return (
    <>
      <Link href="/admin/inspecciones" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Inspecciones
      </Link>
      <PageHeader
        title={`${i.motorcycles.plate} · ${formatDate(i.inspected_on)}`}
        subtitle={`${i.drivers.profiles.full_name} · ${i.km.toLocaleString("es-CO")} km`}
        action={i.reviewed_at ? <Badge>Revisada</Badge> : <Badge tone="info">Nueva</Badge>}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PHOTOS.map((p) => {
          const url = urls.get(i[p.key]);
          return (
            <a key={p.key} href={url} target="_blank" rel="noreferrer" className="block">
              <Card className="p-1.5">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={p.label} className="aspect-[3/4] w-full rounded-xl object-cover" />
                ) : (
                  <div className="aspect-[3/4] rounded-xl bg-surface-2" />
                )}
                <p className="px-1 pt-1.5 text-center text-sm font-medium">{p.label}</p>
              </Card>
            </a>
          );
        })}
      </div>

      <SectionTitle>Lista de chequeo</SectionTitle>
      <Card className="divide-y divide-line p-0">
        {CHECKLIST_ITEMS.map((c) => (
          <div key={c.key} className="flex items-center justify-between px-4 py-2.5">
            <span>{c.label}</span>
            {i.checklist[c.key] === "ok" ? <Badge tone="ok">Bien</Badge> : <Badge tone="warn">Revisar</Badge>}
          </div>
        ))}
      </Card>
      {i.notes ? (
        <div className="mt-3">
          <Alert tone="info">Observaciones del conductor: {i.notes}</Alert>
        </div>
      ) : null}

      <SectionTitle>Revisión</SectionTitle>
      <Card>
        {i.reviewed_at ? (
          <p className="mb-3 text-sm text-ink-2">
            Revisada el {formatDateTime(i.reviewed_at)}
            {i.review_notes ? ` · ${i.review_notes}` : ""}
          </p>
        ) : null}
        <ActionForm action={reviewInspection} submitLabel={i.reviewed_at ? "Actualizar revisión" : "Marcar como revisada"} submitSize="md">
          <input type="hidden" name="id" value={i.id} />
          <Field label="Notas de la revisión (opcional)" htmlFor="review_notes">
            <Textarea id="review_notes" name="review_notes" defaultValue={i.review_notes ?? ""} />
          </Field>
        </ActionForm>
      </Card>
    </>
  );
}
