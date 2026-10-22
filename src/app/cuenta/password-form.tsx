"use client";

import { useActionState } from "react";
import { changePassword, type PasswordState } from "./actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="ok">Contraseña actualizada.</Alert> : null}
      <Field label="Nueva contraseña" htmlFor="password" hint="Mínimo 6 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required />
      </Field>
      <Field label="Repite la contraseña" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={6} required />
      </Field>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
