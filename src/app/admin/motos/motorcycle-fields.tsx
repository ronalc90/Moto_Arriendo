import { Field, Input, Select, Textarea } from "@/components/ui";
import { MOTORCYCLE_STATUS_LABEL } from "@/lib/constants";
import { formatThousands } from "@/lib/format";
import type { Option } from "@/lib/admin";
import type { Motorcycle } from "@/lib/types";

/** Shared inputs for creating / editing a motorcycle. */
export function MotorcycleFields({ moto, owners, defaultOwner }: { moto?: Motorcycle; owners: Option[]; defaultOwner?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Placa" htmlFor="plate">
        <Input id="plate" name="plate" required defaultValue={moto?.plate} placeholder="ABC12D" className="uppercase" />
      </Field>
      <Field label="Propietario" htmlFor="owner_id">
        <Select id="owner_id" name="owner_id" defaultValue={moto?.owner_id ?? defaultOwner} required>
          {owners.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Marca" htmlFor="brand">
        <Input id="brand" name="brand" defaultValue={moto?.brand ?? "Bajaj"} required />
      </Field>
      <Field label="Modelo" htmlFor="model">
        <Input id="model" name="model" defaultValue={moto?.model ?? "Boxer CT100"} required />
      </Field>
      <Field label="Año" htmlFor="year">
        <Input id="year" name="year" inputMode="numeric" defaultValue={moto?.year ?? new Date().getFullYear()} />
      </Field>
      <Field label="Cilindraje (cc)" htmlFor="engine_cc">
        <Input id="engine_cc" name="engine_cc" inputMode="numeric" defaultValue={moto?.engine_cc ?? 100} />
      </Field>
      <Field label="Color" htmlFor="color">
        <Input id="color" name="color" defaultValue={moto?.color ?? ""} />
      </Field>
      <Field label="Proveedor GPS" htmlFor="gps_provider">
        <Input id="gps_provider" name="gps_provider" defaultValue={moto?.gps_provider ?? ""} />
      </Field>
      <Field label="Valor de compra" htmlFor="purchase_price">
        <Input
          id="purchase_price"
          name="purchase_price"
          inputMode="numeric"
          defaultValue={moto?.purchase_price ? formatThousands(moto.purchase_price) : ""}
          placeholder="5.990.000"
        />
      </Field>
      <Field label="Fecha de compra" htmlFor="purchase_date" hint="Con esta fecha se calcula la primera técnico-mecánica (2 años).">
        <Input id="purchase_date" name="purchase_date" type="date" defaultValue={moto?.purchase_date ?? ""} />
      </Field>
      <Field label="Kilometraje actual" htmlFor="current_km">
        <Input id="current_km" name="current_km" inputMode="numeric" defaultValue={moto?.current_km ?? 0} />
      </Field>
      <Field label="Estado" htmlFor="status">
        <Select id="status" name="status" defaultValue={moto?.status ?? "active"}>
          {Object.entries(MOTORCYCLE_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notas" htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={moto?.notes ?? ""} />
        </Field>
      </div>
    </div>
  );
}
