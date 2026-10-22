"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import type { ActionState } from "@/lib/action-state";

/** Small two-step delete button (no browser confirm dialogs). */
export function DeleteButton({
  action,
  id,
  label = "Eliminar",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const [armed, setArmed] = useState(false);
  if (state.ok) return null;
  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      {armed ? (
        <>
          <button type="submit" disabled={pending} className="rounded-lg bg-bad px-2.5 py-1.5 text-xs font-semibold text-white">
            {pending ? "…" : "Confirmar"}
          </button>
          <button type="button" onClick={() => setArmed(false)} className="rounded-lg px-2 py-1.5 text-xs text-ink-2">
            No
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="rounded-lg p-2 text-ink-3 hover:bg-bad-soft hover:text-bad"
          aria-label={label}
          title={label}
        >
          <Trash2 className="size-4" />
        </button>
      )}
      {state.error ? <span className="text-xs text-bad">{state.error}</span> : null}
    </form>
  );
}
