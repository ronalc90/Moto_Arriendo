"use client";

import { useState, useTransition } from "react";
import { Eraser } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { purgeTestData } from "./actions";

/** Two-step button that removes the seed/test data before going live. */
export function PurgeTestDataButton() {
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  if (msg?.ok) return <Alert tone="ok">{msg.text}</Alert>;
  return (
    <div className="space-y-3">
      {armed ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="danger"
            size="md"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await purgeTestData();
                setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Listo" : r.error ?? "Error" });
                setArmed(false);
              })
            }
          >
            <Eraser className="size-4" /> {pending ? "Borrando…" : "Sí, borrar los datos de prueba"}
          </Button>
          <Button type="button" variant="ghost" size="md" disabled={pending} onClick={() => setArmed(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button type="button" variant="secondary" size="md" onClick={() => setArmed(true)}>
          <Eraser className="size-4" /> Borrar datos de prueba
        </Button>
      )}
      {msg && !msg.ok ? <Alert tone="bad">{msg.text}</Alert> : null}
    </div>
  );
}
