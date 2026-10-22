"use client";

import { useState, useTransition } from "react";
import { BellRing } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { sendTestNotification } from "./actions";

export function TestNotificationButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        size="md"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await sendTestNotification();
            setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Enviada" : r.error ?? "Error" });
          })
        }
      >
        <BellRing className="size-4" /> {pending ? "Enviando…" : "Enviar notificación de prueba"}
      </Button>
      {msg ? <Alert tone={msg.ok ? "ok" : "bad"}>{msg.text}</Alert> : null}
    </div>
  );
}
