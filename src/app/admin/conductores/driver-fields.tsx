import { Field, Input, Textarea } from "@/components/ui";
import { formatThousands } from "@/lib/format";
import type { Driver } from "@/lib/types";

export function DriverFields({ driver, fullName, hideName }: { driver?: Driver; fullName?: string; hideName?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {hideName ? null : (
        <Field label="Nombre completo" htmlFor="full_name">
          <Input id="full_name" name="full_name" defaultValue={fullName} required autoComplete="off" />
        </Field>
      )}
      <Field label="Cédula" htmlFor="national_id">
        <Input id="national_id" name="national_id" defaultValue={driver?.national_id ?? ""} inputMode="numeric" />
      </Field>
      <Field label="Número de licencia" htmlFor="license_number">
        <Input id="license_number" name="license_number" defaultValue={driver?.license_number ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoría" htmlFor="license_category">
          <Input id="license_category" name="license_category" defaultValue={driver?.license_category ?? "A2"} />
        </Field>
        <Field label="Licencia vence" htmlFor="license_expires_on">
          <Input id="license_expires_on" name="license_expires_on" type="date" defaultValue={driver?.license_expires_on ?? ""} />
        </Field>
      </div>
      <Field label="Contacto de emergencia" htmlFor="emergency_contact_name">
        <Input id="emergency_contact_name" name="emergency_contact_name" defaultValue={driver?.emergency_contact_name ?? ""} />
      </Field>
      <Field label="Celular de emergencia" htmlFor="emergency_contact_phone">
        <Input
          id="emergency_contact_phone"
          name="emergency_contact_phone"
          inputMode="tel"
          defaultValue={driver?.emergency_contact_phone ?? ""}
        />
      </Field>
      <Field label="Referido por" htmlFor="referred_by">
        <Input id="referred_by" name="referred_by" defaultValue={driver?.referred_by ?? ""} />
      </Field>
      <Field label="Depósito" htmlFor="deposit_amount">
        <Input
          id="deposit_amount"
          name="deposit_amount"
          inputMode="numeric"
          defaultValue={driver?.deposit_amount ? formatThousands(driver.deposit_amount) : ""}
          placeholder="0"
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notas" htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={driver?.notes ?? ""} />
        </Field>
      </div>
    </div>
  );
}
