import { Field, Select } from "@/components/ui";
import { RESPONSIBLE_LABEL } from "@/lib/constants";

export function PartySelect({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <Field label={label} htmlFor={name}>
      <Select id={name} name={name} defaultValue={defaultValue ?? "pending"}>
        {Object.entries(RESPONSIBLE_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </Field>
  );
}
