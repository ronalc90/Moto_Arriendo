import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Badge, ButtonLink, Card, Field, PageHeader, SectionTitle, Select, Textarea } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { DAMAGE_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import type { DamageReport } from "@/lib/types";
import { updateDamage } from "../actions";

export const metadata: Metadata = { title: "Reporte de daño" };

export default async function DamageDetailPage({ params }: PageProps<"/admin/danos/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("damage_reports")
    .select("*, motorcycles(id, plate), drivers(profiles(full_name))")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const d = data as DamageReport & { motorcycles: { id: string; plate: string }; drivers: { profiles: { full_name: string } } };
  const urls = await signedUrls("damages", d.photos, 600);

  return (
    <>
      <Link href="/admin/danos" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Daños
      </Link>
      <PageHeader
        title={`Daño en ${d.motorcycles.plate}`}
        subtitle={`${d.drivers.profiles.full_name} · ${formatDate(d.reported_on)}`}
        action={
          <Badge tone={d.status === "closed" ? "ok" : d.status === "in_repair" ? "info" : "warn"}>
            {DAMAGE_STATUS_LABEL[d.status]}
          </Badge>
        }
      />
      <Card>
        <p className="whitespace-pre-line text-[15px]">{d.description}</p>
      </Card>
      {d.photos.length ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {d.photos.map((p) => (
            <a key={p} href={urls.get(p)} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls.get(p)} alt="Foto del daño" className="aspect-square w-full rounded-2xl border border-line object-cover" />
            </a>
          ))}
        </div>
      ) : null}

      <SectionTitle>Gestión</SectionTitle>
      <Card>
        {d.closed_at ? <p className="mb-3 text-sm text-ink-2">Cerrado el {formatDateTime(d.closed_at)}</p> : null}
        <ActionForm action={updateDamage} submitLabel="Guardar" submitSize="md">
          <input type="hidden" name="id" value={d.id} />
          <Field label="Estado" htmlFor="status">
            <Select id="status" name="status" defaultValue={d.status}>
              {Object.entries(DAMAGE_STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Respuesta / solución (la ve el conductor)" htmlFor="resolution_notes">
            <Textarea id="resolution_notes" name="resolution_notes" defaultValue={d.resolution_notes ?? ""} />
          </Field>
        </ActionForm>
      </Card>
      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href={`/admin/motos/${d.motorcycles.id}`} variant="secondary" size="md">
          Registrar arreglo en la moto
        </ButtonLink>
        <ButtonLink href={`/admin/incidentes/nuevo?moto=${d.motorcycles.id}`} variant="secondary" size="md">
          Convertir en incidente
        </ButtonLink>
      </div>
    </>
  );
}
