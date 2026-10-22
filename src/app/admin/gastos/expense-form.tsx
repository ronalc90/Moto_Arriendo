"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FileUpload } from "@/components/file-upload";
import { Field, Input, Select } from "@/components/ui";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/constants";
import { createExpense } from "./actions";

export function ExpenseForm({ motos, today }: { motos: { value: string; label: string }[]; today: string }) {
  const [moto, setMoto] = useState(motos.length === 1 ? motos[0].value : "");
  return (
    <ActionForm action={createExpense} submitLabel="Registrar gasto" submitSize="md" resetOnSuccess>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Moto" htmlFor="motorcycle_id">
          <Select id="motorcycle_id" name="motorcycle_id" value={moto} onChange={(e) => setMoto(e.target.value)} required>
            <option value="" disabled>
              Elige…
            </option>
            {motos.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Categoría" htmlFor="category">
          <Select id="category" name="category" defaultValue="soat">
            {Object.entries(EXPENSE_CATEGORY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha" htmlFor="spent_on">
          <Input id="spent_on" name="spent_on" type="date" defaultValue={today} required />
        </Field>
        <Field label="Valor" htmlFor="amount">
          <Input id="amount" name="amount" inputMode="numeric" placeholder="450.000" required />
        </Field>
      </div>
      <Field label="Descripción" htmlFor="description">
        <Input id="description" name="description" placeholder="Ej: SOAT 2026-2027" />
      </Field>
      {moto ? (
        <FileUpload key={moto} name="file" bucket="documents" folder={`expenses/${moto}`} kind="document" label="Soporte (opcional)" />
      ) : null}
    </ActionForm>
  );
}
