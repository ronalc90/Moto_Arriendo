"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FileUpload } from "@/components/file-upload";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { INCIDENT_KIND_LABEL, RESPONSIBLE_LABEL } from "@/lib/constants";
import { createIncident } from "../actions";

type Opt = { value: string; label: string };

function Party({ name, label }: { name: string; label: string }) {
  return (
    <Field label={label} htmlFor={name}>
      <Select id={name} name={name} defaultValue="pending">
        {Object.entries(RESPONSIBLE_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function IncidentForm({
  motos,
  drivers,
  currentDriver,
  defaultMoto,
  today,
}: {
  motos: Opt[];
  drivers: Opt[];
  currentDriver: Record<string, string>;
  defaultMoto: string;
  today: string;
}) {
  const [moto, setMoto] = useState(defaultMoto);
  const [driver, setDriver] = useState(currentDriver[defaultMoto] ?? "");

  return (
    <ActionForm action={createIncident} submitLabel="Registrar incidente">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Moto" htmlFor="motorcycle_id">
          <Select
            id="motorcycle_id"
            name="motorcycle_id"
            value={moto}
            onChange={(e) => {
              setMoto(e.target.value);
              setDriver(currentDriver[e.target.value] ?? "");
            }}
            required
          >
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
        <Field label="Conductor involucrado" htmlFor="driver_id">
          <Select id="driver_id" name="driver_id" value={driver} onChange={(e) => setDriver(e.target.value)}>
            <option value="">Ninguno / no aplica</option>
            {drivers.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue="fine">
            {Object.entries(INCIDENT_KIND_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha" htmlFor="occurred_on">
          <Input id="occurred_on" name="occurred_on" type="date" defaultValue={today} required />
        </Field>
        <Party name="responsible" label="Responsable" />
        <Party name="paid_by" label="¿Quién paga?" />
        <Field label="Costo" htmlFor="cost">
          <Input id="cost" name="cost" inputMode="numeric" placeholder="0" />
        </Field>
        <Field label="Referencia" htmlFor="reference" hint="N.º de comparendo, denuncia o reclamación.">
          <Input id="reference" name="reference" />
        </Field>
      </div>
      <Field label="¿Qué pasó?" htmlFor="description">
        <Textarea id="description" name="description" required />
      </Field>
      {moto ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <FileUpload key={`${moto}-${i}`} name="files" bucket="documents" folder={`incidents/${moto}`} kind="document" label={`Documento o foto ${i}`} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-3">Elige la moto para adjuntar documentos (comparendo, denuncia, fotos…).</p>
      )}
    </ActionForm>
  );
}
