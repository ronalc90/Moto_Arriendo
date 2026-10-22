"use client";

import { useActionState, useState } from "react";
import { acceptDataPolicy } from "./actions";
import { Alert, Button } from "@/components/ui";

export function ConsentForm() {
  const [checked, setChecked] = useState(false);
  const [state, action, pending] = useActionState(acceptDataPolicy, { error: undefined as string | undefined });

  return (
    <form action={action} className="mt-5 space-y-4">
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
        <input
          type="checkbox"
          name="accept"
          className="mt-0.5 size-6 shrink-0 accent-[var(--brand-strong)]"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span className="text-[15px] text-ink">
          Leí y acepto la autorización de tratamiento de mis datos personales.
        </span>
      </label>
      <Button type="submit" size="lg" className="w-full" disabled={!checked || pending}>
        {pending ? "Guardando…" : "Aceptar y continuar"}
      </Button>
    </form>
  );
}
