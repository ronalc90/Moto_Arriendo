"use client";

import { useActionState } from "react";
import { LogOut } from "lucide-react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { FileUpload } from "@/components/file-upload";
import { completeWelcome, type WelcomeState } from "./actions";

const CATEGORIES = ["A1", "A2", "B1", "B2", "B3", "C1", "C2", "C3"];

export function WelcomeForm({
  askData,
  askPassword,
  phoneLocked,
  driverId,
  initial,
}: {
  askData: boolean;
  askPassword: boolean;
  phoneLocked: boolean;
  driverId: string;
  initial: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<WelcomeState, FormData>(completeWelcome, {});
  const v = { ...initial, ...(state.values ?? {}) };

  return (
    <>
      <form action={action} className="mt-6 space-y-6">
        {state.error ? <Alert tone="bad">{state.error}</Alert> : null}

        {askData ? (
          <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold">Tus datos</h2>
            <Field label="Nombre completo" htmlFor="full_name">
              <Input id="full_name" name="full_name" defaultValue={v.full_name} required autoComplete="name" />
            </Field>
            <Field
              label="Tu celular"
              htmlFor="phone"
              hint={phoneLocked ? "Es tu usuario para entrar; si cambió, avísale al administrador." : "10 dígitos, ej: 3001234567"}
            >
              <Input id="phone" name="phone" defaultValue={v.phone} inputMode="tel" required readOnly={phoneLocked} autoComplete="tel" />
            </Field>
            <Field label="Número de cédula" htmlFor="national_id">
              <Input id="national_id" name="national_id" defaultValue={v.national_id} inputMode="numeric" required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número de licencia" htmlFor="license_number">
                <Input id="license_number" name="license_number" defaultValue={v.license_number} required />
              </Field>
              <Field label="Categoría" htmlFor="license_category">
                <Select id="license_category" name="license_category" defaultValue={v.license_category || "A2"} required>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="La licencia vence el" htmlFor="license_expires_on">
              <Input id="license_expires_on" name="license_expires_on" type="date" defaultValue={v.license_expires_on} required />
            </Field>
            <Field label="Contacto de emergencia" htmlFor="emergency_contact_name" hint="Alguien a quien llamar si te pasa algo.">
              <Input id="emergency_contact_name" name="emergency_contact_name" defaultValue={v.emergency_contact_name} required />
            </Field>
            <Field label="Celular del contacto" htmlFor="emergency_contact_phone">
              <Input
                id="emergency_contact_phone"
                name="emergency_contact_phone"
                defaultValue={v.emergency_contact_phone}
                inputMode="tel"
                required
              />
            </Field>
          </section>
        ) : null}

        {askData ? (
          <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
            <div>
              <h2 className="font-semibold">Fotos de tus documentos</h2>
              <p className="mt-1 text-sm text-ink-2">
                Pon cada documento sobre una mesa, con buena luz y sin flash. Que se vea completo y se lean los números. La app
                te avisa si la foto sale borrosa u oscura.
              </p>
            </div>
            <p className="text-sm font-semibold">Cédula</p>
            <FileUpload name="id_front" bucket="documents" folder={driverId} kind="image" capture checkQuality required label="Foto del FRENTE de la cédula" />
            <FileUpload name="id_back" bucket="documents" folder={driverId} kind="image" capture checkQuality required label="Foto del REVERSO de la cédula" />
            <p className="pt-2 text-sm font-semibold">Licencia de conducción</p>
            <FileUpload name="lic_front" bucket="documents" folder={driverId} kind="image" capture checkQuality required label="Foto del FRENTE de la licencia" />
            <FileUpload name="lic_back" bucket="documents" folder={driverId} kind="image" capture checkQuality required label="Foto del REVERSO de la licencia" />
          </section>
        ) : null}

        {askPassword ? (
          <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
            <div>
              <h2 className="font-semibold">Tu contraseña</h2>
              <p className="mt-1 text-sm text-ink-2">
                Cambia la contraseña que te dio el administrador por una que solo tú sepas.
              </p>
            </div>
            <Field label="Nueva contraseña" htmlFor="password" hint="Mínimo 6 caracteres.">
              <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required />
            </Field>
            <Field label="Repite la contraseña" htmlFor="confirm">
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={6} required />
            </Field>
          </section>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Guardando…" : "Guardar y entrar"}
        </Button>
      </form>
      <form action="/salir" method="post" className="mt-6 text-center">
        <button className="inline-flex items-center gap-2 text-sm font-medium text-ink-2">
          <LogOut className="size-4" /> Salir
        </button>
      </form>
    </>
  );
}
