"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";

/** Filters admin screens by motorcycle owner (?propietario=<id>). */
export function OwnerFilter({ owners, value }: { owners: { value: string; label: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <Select
      aria-label="Filtrar por propietario"
      value={value}
      className="h-10 w-auto min-w-40 text-sm"
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value) next.set("propietario", e.target.value);
        else next.delete("propietario");
        router.push(`${pathname}${next.size ? `?${next}` : ""}`);
      }}
    >
      <option value="">Todos los propietarios</option>
      {owners.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
