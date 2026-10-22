import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, MessageCircle, Phone, Plus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { AdminDocumentForm } from "@/components/admin-document-form";
import { Collapsible } from "@/components/collapsible";
import { DeleteButton } from "@/components/delete-button";
import { DocumentList } from "@/components/document-list";
import { ReviewDocument } from "@/components/review-document";
import { Alert, Badge, ButtonLink, Card, EmptyState, Field, Input, PageHeader, SectionTitle, Stat, buttonClass } from "@/components/ui";
import { LightBadge } from "@/components/traffic-light";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { documentUrls } from "@/lib/storage";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { formatCOP, formatDate, formatDateTime, formatPhone } from "@/lib/format";
import { reminderText, whatsappLink } from "@/lib/whatsapp";
import type { ContractOverview, DocumentRow, Driver, LoanBalance, Payment } from "@/lib/types";
import { deleteDocument } from "../../documents-actions";
import { resetDriverPassword, setDriverActive, updateDriver } from "../actions";
import { DriverFields } from "../driver-fields";

export const metadata: Metadata = { title: "Conductor" };

export default async function DriverDetailPage({ params, searchParams }: PageProps<"/admin/conductores/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("drivers")
    .select("*, profiles!inner(id, full_name, phone, data_consent_at, active, username, onboarded_at, must_change_password)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const driver = data as Driver & {
    profiles: {
      id: string;
      full_name: string;
      phone: string | null;
      data_consent_at: string | null;
      active: boolean;
      username: string | null;
      onboarded_at: string | null;
      must_change_password: boolean;
    };
  };
  const login = driver.profiles.username ?? formatPhone(driver.profiles.phone);

  const [overviewRes, loansRes, paymentsRes, docsRes] = await Promise.all([
    supabase.from("contract_overview").select("*").eq("driver_id", id).eq("status", "active").maybeSingle(),
    supabase.from("loan_balances").select("*").eq("driver_id", id).order("loan_date", { ascending: false }),
    supabase
      .from("payments")
      .select("*, motorcycles(plate)")
      .eq("driver_id", id)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase.from("documents").select("*").eq("driver_id", id).order("created_at", { ascending: false }),
  ]);
  const o = overviewRes.data as ContractOverview | null;
  const loans = (loansRes.data as LoanBalance[]) ?? [];
  // Only one active loan per driver: more money is added to that loan.
  const activeLoan = loans.find((l) => l.status === "active");
  const payments = (paymentsRes.data as Array<Payment & { motorcycles: { plate: string } }>) ?? [];
  const docs = (docsRes.data as DocumentRow[]) ?? [];
  const urls = await documentUrls(docs);
  const wa = whatsappLink(driver.profiles.phone, reminderText(driver.profiles.full_name, o?.total_debt ?? 0, o?.late_days ?? 0));

  return (
    <>
      <Link href="/admin/conductores" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-2">
        <ArrowLeft className="size-4" /> Conductores
      </Link>
      <PageHeader
        title={driver.profiles.full_name}
        subtitle={[
          `Usuario: ${login}`,
          driver.national_id ? `CC ${driver.national_id}` : null,
          driver.profiles.phone ? formatPhone(driver.profiles.phone) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={driver.status === "active" ? <Badge tone="ok">Activo</Badge> : <Badge>Inactivo</Badge>}
      />

      {sp.nuevo ? (
        <div className="mb-4">
          <Alert tone="ok">
            Conductor creado. Ya puede entrar con el usuario <strong>{login}</strong> y la contraseña que le asignaste. Al
            entrar por primera vez la app le pedirá sus datos y una contraseña propia. Ahora crea su contrato.
          </Alert>
        </div>
      ) : null}

      {!driver.profiles.onboarded_at ? (
        <div className="mb-4">
          <Alert tone="warn">
            {driver.profiles.data_consent_at
              ? "Ya entró a la app pero todavía no termina de llenar sus datos."
              : "Todavía no ha entrado a la app. La primera vez le pedirá sus datos (cédula, licencia, contacto de emergencia) y una contraseña propia."}
          </Alert>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {driver.profiles.phone ? (
          <a href={`tel:${driver.profiles.phone}`} className={buttonClass("secondary", "md")}>
            <Phone className="size-4" /> Llamar
          </a>
        ) : null}
        {wa ? (
          <a href={wa} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md")}>
            <MessageCircle className="size-4" /> WhatsApp {o && o.late_days > 0 ? "(cobro)" : "(recordatorio)"}
          </a>
        ) : null}
        {o ? (
          <ButtonLink href={`/admin/pagos/nuevo?contrato=${o.id}`} variant="secondary" size="md">
            <Plus className="size-4" /> Registrar pago
          </ButtonLink>
        ) : (
          <ButtonLink href={`/admin/contratos/nuevo?conductor=${id}`} size="md">
            <Plus className="size-4" /> Crear contrato
          </ButtonLink>
        )}
      </div>

      {o ? (
        <>
          <SectionTitle>Contrato vigente</SectionTitle>
          <Link href={`/admin/contratos/${o.id}`}>
            <Card className="hover:border-brand-strong">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    Moto {o.plate} · {formatCOP(o.daily_rate)}/día
                  </p>
                  <p className="text-sm text-ink-2">Desde {formatDate(o.start_date)}</p>
                </div>
                <LightBadge light={o.light} lateDays={o.late_days} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-ink-3">Debería pagar</p>
                  <p className="font-semibold tabular">{formatCOP(o.expected_rate)}</p>
                </div>
                <div>
                  <p className="text-ink-3">Pagado (tarifa)</p>
                  <p className="font-semibold tabular">{formatCOP(o.paid_rate)}</p>
                </div>
                <div>
                  <p className="text-ink-3">Deuda total</p>
                  <p className="font-semibold tabular text-bad">{formatCOP(o.total_debt)}</p>
                </div>
                <div>
                  <p className="text-ink-3">En revisión</p>
                  <p className="font-semibold tabular">{formatCOP(o.pending_amount)}</p>
                </div>
              </div>
            </Card>
          </Link>
        </>
      ) : null}

      <SectionTitle
        action={
          activeLoan ? (
            <Link href={`/admin/prestamos/${activeLoan.id}`} className="text-sm font-medium text-info">
              Sumar al préstamo activo
            </Link>
          ) : (
            <Link href={`/admin/prestamos/nuevo?conductor=${id}`} className="text-sm font-medium text-info">
              + Nuevo préstamo
            </Link>
          )
        }
      >
        Préstamos
      </SectionTitle>
      {loans.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {loans.map((l) => (
            <Link key={l.id} href={`/admin/prestamos/${l.id}`}>
              <Card className="hover:border-brand-strong">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{l.concept}</p>
                  <Badge tone={l.status === "paid" ? "ok" : "warn"}>{l.status === "paid" ? "Pagado" : "Activo"}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-2">
                  Saldo <strong className="text-ink">{formatCOP(l.balance)}</strong> de {formatCOP(l.amount)} · abono{" "}
                  {formatCOP(l.daily_installment)}/día {l.installment_required ? "(obligatorio)" : "(voluntario)"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin préstamos." />
      )}

      <SectionTitle>Pagos</SectionTitle>
      {payments.length ? (
        <Card className="divide-y divide-line p-0">
          {payments.map((p) => (
            <Link key={p.id} href={`/admin/pagos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold tabular">{formatCOP(p.total_amount)}</p>
                <p className="text-xs text-ink-2">
                  {formatDate(p.paid_on)} · {PAYMENT_METHOD_LABEL[p.method]} · {p.motorcycles?.plate}
                  {p.installment_amount ? ` · abono ${formatCOP(p.installment_amount)}` : ""}
                </p>
              </div>
              <Badge tone={p.status === "approved" ? "ok" : p.status === "rejected" ? "bad" : "warn"}>
                {PAYMENT_STATUS_LABEL[p.status]}
              </Badge>
              <ChevronRight className="size-5 text-ink-3" />
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState title="Sin pagos todavía." />
      )}

      <SectionTitle>Documentos</SectionTitle>
      <DocumentList
        docs={docs}
        urls={urls}
        empty="Sin documentos."
        actions={(d) => (
          <div className="flex flex-col items-end gap-1">
            {d.review_status === "pending" ? <ReviewDocument id={d.id} /> : null}
            <DeleteButton action={deleteDocument} id={d.id} />
          </div>
        )}
      />
      <div className="mt-3 space-y-3">
        <Collapsible title="Agregar documento (licencia, cédula, antecedentes…)">
          <AdminDocumentForm entity="driver" entityId={id} />
        </Collapsible>
        <Collapsible title="Editar datos del conductor">
          <ActionForm action={updateDriver} submitLabel="Guardar cambios" submitSize="md">
            <input type="hidden" name="id" value={id} />
            <DriverFields driver={driver} fullName={driver.profiles.full_name} />
          </ActionForm>
        </Collapsible>
        <Collapsible title="Asignar nueva contraseña">
          <ActionForm action={resetDriverPassword} submitLabel="Asignar contraseña" submitSize="md" resetOnSuccess>
            <input type="hidden" name="profile_id" value={driver.profiles.id} />
            <Field label="Nueva contraseña" htmlFor="password" hint="Mínimo 4 caracteres. Al entrar, la app le pedirá cambiarla.">
              <Input id="password" name="password" minLength={4} required autoComplete="new-password" />
            </Field>
          </ActionForm>
        </Collapsible>
        <Collapsible title={driver.status === "active" ? "Desactivar conductor" : "Activar conductor"}>
          <p className="mb-3 text-sm text-ink-2">
            {driver.status === "active"
              ? "Al desactivarlo ya no podrá entrar a la app. Su historial se conserva. Termina primero su contrato."
              : "Al activarlo podrá volver a entrar con su celular y contraseña."}
          </p>
          <ActionForm
            action={setDriverActive}
            submitLabel={driver.status === "active" ? "Desactivar" : "Activar"}
            submitVariant={driver.status === "active" ? "danger" : "success"}
            submitSize="md"
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="active" value={driver.status === "active" ? "false" : "true"} />
          </ActionForm>
        </Collapsible>
      </div>
      <p className="mt-6 text-xs text-ink-3">
        {driver.profiles.data_consent_at
          ? `Aceptó el tratamiento de datos (Ley 1581) el ${formatDateTime(driver.profiles.data_consent_at)}.`
          : "Aún no ha entrado a la app ni aceptado el tratamiento de datos."}
      </p>
      <div className="h-4" />
      <Stat label="Depósito" value={formatCOP(driver.deposit_amount)} hint={driver.referred_by ? `Referido por ${driver.referred_by}` : undefined} />
    </>
  );
}
