import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { AdminDocumentForm } from "@/components/admin-document-form";
import { Collapsible } from "@/components/collapsible";
import { DeleteButton } from "@/components/delete-button";
import { DocumentList } from "@/components/document-list";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, SectionTitle, Stat } from "@/components/ui";
import { LightBadge } from "@/components/traffic-light";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOwners } from "@/lib/admin";
import { signedUrls } from "@/lib/storage";
import { DAMAGE_STATUS_LABEL, MOTORCYCLE_STATUS_LABEL } from "@/lib/constants";
import { formatCOP, formatDate } from "@/lib/format";
import type { ContractOverview, DamageReport, DocumentRow, Inspection, Motorcycle } from "@/lib/types";
import { deleteDocument } from "../../documents-actions";
import { updateMotorcycle } from "../actions";
import { MotorcycleFields } from "../motorcycle-fields";
import { MaintenanceSection } from "./maintenance-section";

export const metadata: Metadata = { title: "Moto" };

export default async function MotorcycleDetailPage({ params }: PageProps<"/admin/motos/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data: moto } = await supabase.from("motorcycles").select("*").eq("id", id).maybeSingle();
  if (!moto) notFound();
  const m = moto as Motorcycle;

  const [docsRes, contractRes, inspRes, damageRes, owners, incomeRes] = await Promise.all([
    supabase.from("documents").select("*").eq("motorcycle_id", id).order("expires_on", { ascending: false }),
    supabase.from("contract_overview").select("*").eq("motorcycle_id", id).eq("status", "active").maybeSingle(),
    supabase.from("inspections").select("*").eq("motorcycle_id", id).order("inspected_on", { ascending: false }).limit(10),
    supabase.from("damage_reports").select("*").eq("motorcycle_id", id).order("created_at", { ascending: false }).limit(10),
    getOwners(),
    supabase.from("payments").select("rate_amount").eq("motorcycle_id", id).eq("status", "approved"),
  ]);
  const docs = (docsRes.data as DocumentRow[]) ?? [];
  const urls = await signedUrls("documents", docs.map((d) => d.file_path));
  const contract = contractRes.data as ContractOverview | null;
  const produced = (incomeRes.data ?? []).reduce((s, r) => s + r.rate_amount, 0);
  const recovery = m.purchase_price ? Math.min(100, Math.round((produced / m.purchase_price) * 100)) : null;

  return (
    <>
      <Link href="/admin/motos" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Motos
      </Link>
      <PageHeader
        title={m.plate}
        subtitle={`${m.brand} ${m.model}${m.year ? ` ${m.year}` : ""} · ${owners.find((o) => o.value === m.owner_id)?.label ?? ""}`}
        action={
          <Badge tone={m.status === "active" ? "ok" : m.status === "inactive" ? "neutral" : "warn"}>
            {MOTORCYCLE_STATUS_LABEL[m.status]}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Kilometraje" value={`${m.current_km.toLocaleString("es-CO")} km`} />
        <Stat label="Producido (tarifas)" value={formatCOP(produced)} />
        <Stat label="Valor de compra" value={m.purchase_price ? formatCOP(m.purchase_price) : "—"} hint={m.purchase_date ? formatDate(m.purchase_date) : undefined} />
        <Stat label="Recuperado" value={recovery !== null ? `${recovery}%` : "—"} tone={recovery !== null && recovery >= 100 ? "ok" : undefined} />
      </div>

      <SectionTitle>Conductor actual</SectionTitle>
      {contract ? (
        <Link href={`/admin/contratos/${contract.id}`}>
          <Card className="flex items-center gap-3 hover:border-brand-strong">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{contract.driver_name}</p>
              <p className="text-sm text-ink-2">
                Desde {formatDate(contract.start_date)} · {formatCOP(contract.daily_rate)}/día
              </p>
            </div>
            <LightBadge light={contract.light} lateDays={contract.late_days} />
            <ChevronRight className="size-5 text-ink-3" />
          </Card>
        </Link>
      ) : (
        <EmptyState title="La moto no tiene contrato vigente.">
          <Link href={`/admin/contratos/nuevo?moto=${m.id}`} className="font-semibold text-info">
            Crear contrato
          </Link>
        </EmptyState>
      )}

      <SectionTitle>Documentos</SectionTitle>
      <DocumentList
        docs={docs}
        urls={urls}
        empty="Sin documentos. Sube el SOAT, el seguro y la tarjeta de propiedad."
        actions={(d) => <DeleteButton action={deleteDocument} id={d.id} label="Eliminar documento" />}
      />
      <div className="mt-3">
        <Collapsible title="Agregar documento (SOAT, seguro, técnico-mecánica…)">
          <AdminDocumentForm entity="motorcycle" entityId={m.id} />
        </Collapsible>
      </div>

      <MaintenanceSection motorcycleId={m.id} currentKm={m.current_km} />

      <SectionTitle action={<Link href={`/admin/inspecciones?moto=${m.id}`} className="text-sm font-medium text-ink-2">Ver todas</Link>}>
        Inspecciones
      </SectionTitle>
      {inspRes.data?.length ? (
        <Card className="divide-y divide-line p-0">
          {(inspRes.data as Inspection[]).map((i) => {
            const issues = Object.values(i.checklist).filter((v) => v === "check").length;
            return (
              <Link key={i.id} href={`/admin/inspecciones/${i.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{formatDate(i.inspected_on)}</p>
                  <p className="text-xs text-ink-2">{i.km.toLocaleString("es-CO")} km</p>
                </div>
                {issues ? <Badge tone="warn">{issues} por revisar</Badge> : <Badge tone="ok">Todo bien</Badge>}
                {i.reviewed_at ? <Badge>Revisada</Badge> : null}
                <ChevronRight className="size-5 text-ink-3" />
              </Link>
            );
          })}
        </Card>
      ) : (
        <EmptyState title="Sin inspecciones todavía." />
      )}

      <SectionTitle>Reportes de daño</SectionTitle>
      {damageRes.data?.length ? (
        <Card className="divide-y divide-line p-0">
          {(damageRes.data as DamageReport[]).map((d) => (
            <Link key={d.id} href={`/admin/danos/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="truncate">{d.description}</p>
                <p className="text-xs text-ink-2">{formatDate(d.reported_on)}</p>
              </div>
              <Badge tone={d.status === "closed" ? "ok" : d.status === "in_repair" ? "info" : "warn"}>
                {DAMAGE_STATUS_LABEL[d.status]}
              </Badge>
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState title="Sin daños reportados." />
      )}

      <SectionTitle>Datos de la moto</SectionTitle>
      <Collapsible title="Editar datos">
        <ActionForm action={updateMotorcycle} submitLabel="Guardar cambios" submitSize="md">
          <input type="hidden" name="id" value={m.id} />
          <MotorcycleFields moto={m} owners={owners} />
        </ActionForm>
      </Collapsible>
      <div className="mt-6">
        <ButtonLink href={`/admin/incidentes?moto=${m.id}`} variant="secondary" size="md">
          Incidentes de esta moto
        </ButtonLink>
      </div>
    </>
  );
}
