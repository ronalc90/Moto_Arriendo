"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import { submitPayment } from "./actions";
import { FileUpload } from "@/components/file-upload";
import { SubmitButton } from "@/components/action-form";
import { Alert, buttonClass, cx, inputClass } from "@/components/ui";
import { formatCOP, formatThousands, parseCOP } from "@/lib/format";
import type { ActionState } from "@/lib/action-state";

const METHODS = [
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "transfer", label: "Transferencia" },
  { value: "cash", label: "Efectivo" },
];

export function PaymentForm({
  driverId,
  suggested,
  defaultMethod,
}: {
  driverId: string;
  suggested: number;
  defaultMethod: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(submitPayment, {});
  const [amount, setAmount] = useState(formatThousands(suggested));
  const [method, setMethod] = useState(defaultMethod);
  const [receipt, setReceipt] = useState<string | null>(null);

  if (state.ok) {
    return (
      <div className="rounded-3xl border border-ok/30 bg-ok-soft/50 p-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-ok" />
        <p className="mt-3 text-xl font-bold">¡Pago enviado!</p>
        <p className="mt-1 text-ink-2">Te avisamos cuando el administrador lo apruebe.</p>
        <Link href="/conductor" className={buttonClass("primary", "lg", "mt-6 w-full")}>
          Volver al inicio
        </Link>
      </div>
    );
  }

  const needsReceipt = method !== "cash";

  return (
    <form action={action} className="space-y-5">
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}

      {needsReceipt ? (
        <FileUpload
          name="receipt"
          bucket="receipts"
          folder={driverId}
          kind="document"
          capture
          big
          label="Tomar foto del comprobante"
          hint="También puedes elegir la captura de pantalla de Nequi o Daviplata."
          onChange={setReceipt}
        />
      ) : (
        <input type="hidden" name="receipt" value="" />
      )}

      <div>
        <label htmlFor="amount" className="mb-1.5 block text-sm font-medium">
          Monto
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-2xl font-bold text-ink-3">$</span>
          <input
            id="amount"
            name="amount"
            inputMode="numeric"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(formatThousands(parseCOP(e.target.value)))}
            className={cx(inputClass, "h-16 pl-9 text-3xl font-bold tabular")}
          />
        </div>
        <p className="mt-1 text-xs text-ink-3">Sugerido: {formatCOP(suggested)}. Puedes cambiarlo si pagaste otro valor.</p>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">¿Cómo pagaste?</legend>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <label
              key={m.value}
              className={cx(
                "flex h-12 cursor-pointer items-center justify-center rounded-xl border text-[15px] font-semibold",
                method === m.value ? "border-brand-strong bg-brand text-brand-ink" : "border-line bg-surface text-ink-2",
              )}
            >
              <input
                type="radio"
                name="method"
                value={m.value}
                checked={method === m.value}
                onChange={() => setMethod(m.value)}
                className="sr-only"
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      <SubmitButton className="h-16 w-full text-xl" pendingLabel="Enviando…" disabled={needsReceipt && !receipt}>
        <Send className="size-5" /> Enviar pago
      </SubmitButton>
    </form>
  );
}
