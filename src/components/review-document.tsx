"use client";

import { useActionState, useState } from "react";
import { Check, X } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { reviewDocument } from "@/app/admin/documents-actions";

/** Approve a driver's document, or reject it with a reason the driver will see. */
export function ReviewDocument({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reviewDocument, {} as ActionState);
  const [rejecting, setRejecting] = useState(false);
  if (state.ok) return <span className="text-xs font-semibold text-ok">{state.message}</span>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="id" value={id} />
      {rejecting ? (
        <>
          <input type="hidden" name="decision" value="rejected" />
          <input
            name="review_notes"
            required
            minLength={3}
            placeholder="¿Qué está mal? Ej: borrosa"
            className="h-9 w-44 rounded-lg border border-line bg-surface px-2 text-sm"
            autoFocus
          />
          <button type="submit" disabled={pending} className="rounded-lg bg-bad px-2.5 py-1.5 text-xs font-semibold text-white">
            {pending ? "…" : "Rechazar"}
          </button>
          <button type="button" onClick={() => setRejecting(false)} className="rounded-lg px-2 py-1.5 text-xs text-ink-2">
            No
          </button>
        </>
      ) : (
        <>
          <button
            type="submit"
            name="decision"
            value="approved"
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg bg-ok px-2.5 py-1.5 text-xs font-semibold text-white"
          >
            <Check className="size-3.5" /> Se lee bien
          </button>
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-bad hover:bg-bad-soft"
          >
            <X className="size-3.5" /> No se lee
          </button>
        </>
      )}
      {state.error ? <span className="w-full text-xs text-bad">{state.error}</span> : null}
    </form>
  );
}
