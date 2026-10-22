"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { login, type LoginState } from "./actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-4" noValidate>
      {notice && !state.error ? <Alert tone="warn">{notice}</Alert> : null}
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}

      <Field label="Usuario" htmlFor="user" hint="Conductores: el usuario que te dio el administrador (ej: hamer) o tu celular.">
        <Input
          id="user"
          name="user"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="hamer"
          defaultValue={state.user}
          required
        />
      </Field>

      <Field label="Contraseña" htmlFor="password">
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-3"
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <LogIn className="size-5" />
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
