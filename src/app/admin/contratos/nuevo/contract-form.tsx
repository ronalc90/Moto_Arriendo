"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FileUpload } from "@/components/file-upload";
import { Field, Input, Select, Textarea, cx } from "@/components/ui";
import { WEEKDAYS } from "@/lib/format";
import { createContract } from "../actions";

type Opt = { value: string; label: string };

export function ContractForm({
  drivers,
  motorcycles,
  defaultDriver,
  defaultMoto,
  defaultRate,
  today,
}: {
  drivers: Opt[];
  motorcycles: Opt[];
  defaultDriver: string;
  defaultMoto: string;
  defaultRate: string;
  today: string;
}) {
  const [driver, setDriver] = useState(defaultDriver);
  const [rest, setRest] = useState<number[]>([0]);

  return (
    <ActionForm action={createContract} submitLabel="Crear contrato" pendingLabel="Creando…">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Conductor" htmlFor="driver_id" hint="Solo conductores activos sin contrato vigente.">
          <Select id="driver_id" name="driver_id" value={driver} onChange={(e) => setDriver(e.target.value)} required>
            <option value="" disabled>
              Elige…
            </option>
            {drivers.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Moto" htmlFor="motorcycle_id" hint="Solo motos sin contrato vigente.">
          <Select id="motorcycle_id" name="motorcycle_id" defaultValue={defaultMoto} required>
            <option value="" disabled>
              Elige…
            </option>
            {motorcycles.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tarifa diaria" htmlFor="daily_rate" hint="Entre $35.000 y $50.000 normalmente.">
          <Input id="daily_rate" name="daily_rate" inputMode="numeric" defaultValue={defaultRate} required />
        </Field>
        <Field label="Fecha de inicio" htmlFor="start_date">
          <Input id="start_date" name="start_date" type="date" defaultValue={today} required />
        </Field>
        <Field label="Hora límite de pago" htmlFor="payment_deadline">
          <Input id="payment_deadline" name="payment_deadline" type="time" defaultValue="21:00" required />
        </Field>
        <Field label="Días de atraso para devolver la moto" htmlFor="max_late_days">
          <Input id="max_late_days" name="max_late_days" type="number" min={1} max={30} defaultValue={3} required />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Día(s) de descanso (sin cobro)</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const on = rest.includes(d);
            return (
              <label
                key={d}
                className={cx(
                  "flex h-11 cursor-pointer items-center rounded-xl border px-3.5 text-sm font-semibold",
                  on ? "border-brand-strong bg-brand text-brand-ink" : "border-line bg-surface text-ink-2",
                )}
              >
                <input
                  type="checkbox"
                  name="rest_weekdays"
                  value={d}
                  checked={on}
                  onChange={() => setRest((r) => (on ? r.filter((x) => x !== d) : [...r, d]))}
                  className="sr-only"
                />
                {WEEKDAYS[d]}
              </label>
            );
          })}
        </div>
      </fieldset>

      {driver ? (
        <FileUpload
          key={driver}
          name="file"
          bucket="contracts"
          folder={driver}
          kind="document"
          label="PDF del contrato firmado (puedes subirlo después)"
        />
      ) : (
        <p className="text-sm text-ink-3">Elige el conductor para poder subir el contrato firmado.</p>
      )}
      <Field label="Notas" htmlFor="notes">
        <Textarea id="notes" name="notes" />
      </Field>
    </ActionForm>
  );
}
