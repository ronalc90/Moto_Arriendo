import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Collapsible } from "@/components/collapsible";
import { PushToggle } from "@/components/push-toggle";
import { TestNotificationButton } from "./test-button";
import { PurgeTestDataButton } from "./purge-button";
import { Download } from "lucide-react";
import { Badge, Card, Field, Input, PageHeader, SectionTitle, Select } from "@/components/ui";
import { buttonClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS, formatDateTime, formatThousands } from "@/lib/format";
import { createAdmin, saveEmailSettings, updateSettings } from "./actions";

export const metadata: Metadata = { title: "Configuración" };

const ACTION_LABEL: Record<string, string> = {
  insert: "creó",
  update: "modificó",
  delete: "eliminó",
  payment_approved: "aprobó",
  payment_rejected: "rechazó",
  payment_pending: "devolvió a revisión",
  password_reset: "cambió la contraseña de",
};
const TABLE_LABEL: Record<string, string> = {
  payments: "pago",
  contracts: "contrato",
  drivers: "conductor",
  motorcycles: "moto",
  loans: "préstamo",
  documents: "documento",
  exempt_days: "día exento",
  inspections: "inspección",
  damage_reports: "reporte de daño",
  profiles: "usuario",
  maintenance_records: "mantenimiento",
  incidents: "incidente",
  expenses: "gasto",
  app_config: "configuración",
};

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: s }, { data: admins }, { data: audit }, { data: status }, { data: vapid }] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("profiles").select("id, full_name, email, active").eq("role", "admin").order("created_at"),
    supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(40),
    supabase.rpc("admin_app_config_status"),
    supabase.rpc("vapid_public_key"),
  ]);
  const { data: hasTestData } = await supabase.rpc("has_test_data");
  const names = new Map((admins ?? []).map((a) => [a.id, a.full_name]));
  const cfg = (status ?? {}) as { email_enabled?: boolean; email_from?: string; push_enabled?: boolean };

  return (
    <>
      <PageHeader title="Configuración" />

      <SectionTitle>Avisos</SectionTitle>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={cfg.push_enabled ? "ok" : "warn"}>Notificaciones push {cfg.push_enabled ? "activas" : "sin configurar"}</Badge>
          <Badge tone={cfg.email_enabled ? "ok" : "neutral"}>Correo {cfg.email_enabled ? "activo" : "sin configurar"}</Badge>
          <Badge tone="ok">Revisión automática cada 15 min</Badge>
        </div>
        <PushToggle vapidPublicKey={(vapid as string | null) ?? null} />
        <TestNotificationButton />
      </Card>

      <SectionTitle>Reglas del negocio</SectionTitle>
      <Card>
        <ActionForm action={updateSettings} submitLabel="Guardar configuración" submitSize="md">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del negocio" htmlFor="business_name">
              <Input id="business_name" name="business_name" defaultValue={s?.business_name} />
            </Field>
            <Field label="Día de la inspección semanal" htmlFor="inspection_weekday">
              <Select id="inspection_weekday" name="inspection_weekday" defaultValue={s?.inspection_weekday}>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tarifa diaria por defecto" htmlFor="default_daily_rate">
              <Input id="default_daily_rate" name="default_daily_rate" inputMode="numeric" defaultValue={formatThousands(s?.default_daily_rate)} />
            </Field>
            <Field label="Abono diario por defecto" htmlFor="default_daily_installment">
              <Input
                id="default_daily_installment"
                name="default_daily_installment"
                inputMode="numeric"
                defaultValue={formatThousands(s?.default_daily_installment)}
              />
            </Field>
            <Field label="Hora del recordatorio de pago" htmlFor="payment_reminder_time">
              <Input
                id="payment_reminder_time"
                name="payment_reminder_time"
                type="time"
                defaultValue={String(s?.payment_reminder_time ?? "19:00").slice(0, 5)}
              />
            </Field>
          </div>
          <p className="pt-2 text-sm font-semibold">Mantenimiento por kilometraje</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Primera revisión desde (km)" htmlFor="first_service_min_km">
              <Input id="first_service_min_km" name="first_service_min_km" inputMode="numeric" defaultValue={s?.first_service_min_km} />
            </Field>
            <Field label="Primera revisión hasta (km)" htmlFor="first_service_km">
              <Input id="first_service_km" name="first_service_km" inputMode="numeric" defaultValue={s?.first_service_km} />
            </Field>
            <Field label="Cambio de aceite cada (km)" htmlFor="oil_change_interval_km">
              <Input id="oil_change_interval_km" name="oil_change_interval_km" inputMode="numeric" defaultValue={s?.oil_change_interval_km} />
            </Field>
            <Field label="Revisión general cada (km)" htmlFor="general_service_interval_km">
              <Input
                id="general_service_interval_km"
                name="general_service_interval_km"
                inputMode="numeric"
                defaultValue={s?.general_service_interval_km}
              />
            </Field>
            <Field label="Avisar cuando falten (km)" htmlFor="maintenance_alert_km">
              <Input id="maintenance_alert_km" name="maintenance_alert_km" inputMode="numeric" defaultValue={s?.maintenance_alert_km} />
            </Field>
          </div>
        </ActionForm>
      </Card>

      <SectionTitle>Administradores</SectionTitle>
      <Card className="divide-y divide-line p-0">
        {(admins ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-semibold">{a.full_name}</p>
              <p className="text-xs text-ink-2">{a.email}</p>
            </div>
            <Badge tone={a.active ? "ok" : "neutral"}>{a.active ? "Activo" : "Inactivo"}</Badge>
          </div>
        ))}
      </Card>
      <div className="mt-3 space-y-3">
        <Collapsible title="Agregar administrador (ej: tu socio)">
          <ActionForm action={createAdmin} submitLabel="Crear administrador" submitSize="md" resetOnSuccess>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nombre" htmlFor="full_name">
                <Input id="full_name" name="full_name" required />
              </Field>
              <Field label="Correo" htmlFor="email">
                <Input id="email" name="email" type="email" required />
              </Field>
              <Field label="Contraseña" htmlFor="admin_password">
                <Input id="admin_password" name="password" minLength={8} required autoComplete="new-password" />
              </Field>
            </div>
          </ActionForm>
        </Collapsible>
        <Collapsible title="Avisos por correo (Resend)">
          <p className="mb-3 text-sm text-ink-2">
            Opcional. Crea una cuenta gratis en resend.com con tu correo, copia tu API key (empieza por <code>re_</code>) y
            pégala aquí. Con la cuenta gratis los correos llegan al correo con el que te registraste en Resend.
          </p>
          <ActionForm action={saveEmailSettings} submitLabel="Guardar" submitSize="md" resetOnSuccess>
            <Field label="API key de Resend" htmlFor="resend_api_key" hint={cfg.email_enabled ? "Ya hay una clave guardada; escribe otra para cambiarla." : undefined}>
              <Input id="resend_api_key" name="resend_api_key" autoComplete="off" placeholder="re_..." />
            </Field>
            <Field label="Remitente" htmlFor="email_from">
              <Input id="email_from" name="email_from" defaultValue={cfg.email_from ?? "Moto Arriendo <onboarding@resend.dev>"} />
            </Field>
          </ActionForm>
        </Collapsible>
      </div>

      <SectionTitle>Respaldo y datos</SectionTitle>
      <Card className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-ink-2">
            Descarga un Excel con todo: motos, conductores, contratos, pagos, préstamos, gastos, mantenimientos e
            incidentes. Hazlo cada semana y guárdalo en tu Drive o correo.
          </p>
          <a href="/api/exportar?tipo=respaldo" className={buttonClass("secondary", "md", "inline-flex items-center gap-2")}>
            <Download className="size-4" /> Descargar respaldo (Excel)
          </a>
        </div>
        {hasTestData ? (
          <div className="space-y-2 border-t border-line pt-4">
            <p className="text-sm text-ink-2">
              Todavía hay <strong className="text-ink">datos de prueba</strong> (motos PRU01A, PRU02A, PRU03A y conductores
              de prueba con celulares 300 000 000X). Bórralos antes de empezar a usar la app de verdad. Tus datos reales no
              se tocan.
            </p>
            <PurgeTestDataButton />
          </div>
        ) : null}
      </Card>

      <SectionTitle>Registro de cambios (auditoría)</SectionTitle>
      <Card className="divide-y divide-line p-0 text-sm">
        {(audit ?? []).map((a) => (
          <div key={a.id} className="px-4 py-2.5">
            <span className="font-medium">{a.actor_id ? names.get(a.actor_id) ?? "Conductor" : "Sistema"}</span>{" "}
            {ACTION_LABEL[a.action] ?? a.action} {TABLE_LABEL[a.table_name] ?? a.table_name}
            <span className="text-ink-3"> · {formatDateTime(a.created_at)}</span>
          </div>
        ))}
      </Card>
    </>
  );
}
