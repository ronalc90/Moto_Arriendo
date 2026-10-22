import { ActionForm } from "@/components/action-form";
import { DeleteButton } from "@/components/delete-button";
import { Card, EmptyState, Field, Input, Select } from "@/components/ui";
import { WEEKDAYS, bogotaToday, formatDate, weekday } from "@/lib/format";
import { addExemptDays, deleteExemptDay } from "./actions";

type ExemptRow = { id: string; day: string; reason: string; label?: string };

export function ExemptDaysList({ rows }: { rows: ExemptRow[] }) {
  if (!rows.length) return <EmptyState title="No hay días exentos." />;
  return (
    <Card className="divide-y divide-line p-0">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {WEEKDAYS[weekday(r.day)]} {formatDate(r.day)}
              {r.label ? <span className="font-normal text-ink-2"> · {r.label}</span> : null}
            </p>
            <p className="text-xs text-ink-2">{r.reason}</p>
          </div>
          <DeleteButton action={deleteExemptDay} id={r.id} label="Quitar día exento" />
        </div>
      ))}
    </Card>
  );
}

export function ExemptDaysForm({
  contractId,
  contracts,
}: {
  contractId?: string;
  contracts?: { value: string; label: string }[];
}) {
  const today = bogotaToday();
  return (
    <ActionForm action={addExemptDays} submitLabel="Marcar como exento" submitSize="md" resetOnSuccess>
      {contractId ? (
        <input type="hidden" name="contract_id" value={contractId} />
      ) : (
        <Field label="Contrato" htmlFor="contract_id">
          <Select id="contract_id" name="contract_id" defaultValue="" required>
            <option value="" disabled>
              Elige…
            </option>
            {(contracts ?? []).map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde" htmlFor="from">
          <Input id="from" name="from" type="date" defaultValue={today} required />
        </Field>
        <Field label="Hasta (opcional)" htmlFor="to">
          <Input id="to" name="to" type="date" />
        </Field>
      </div>
      <Field label="Motivo" htmlFor="reason">
        <Input id="reason" name="reason" required placeholder="Ej: moto en taller por garantía" />
      </Field>
    </ActionForm>
  );
}
