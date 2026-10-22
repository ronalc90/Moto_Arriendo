"use client";

import { Fragment, useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, cx } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export function SubmitButton({
  children,
  pendingLabel = "Guardando…",
  variant = "primary",
  size = "lg",
  className,
  disabled,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  size?: "md" | "lg" | "sm";
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending || disabled}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/**
 * Generic form bound to a server action that returns ActionState.
 * Shows the error / success message and optionally resets on success.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Guardar",
  pendingLabel,
  submitVariant = "primary",
  submitSize = "lg",
  fullWidthSubmit = true,
  resetOnSuccess = false,
  className,
  hideSubmit = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel?: ReactNode;
  pendingLabel?: string;
  submitVariant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  submitSize?: "md" | "lg" | "sm";
  fullWidthSubmit?: boolean;
  resetOnSuccess?: boolean;
  className?: string;
  hideSubmit?: boolean;
}) {
  const [state, formAction] = useActionState(action, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (state.ok && resetOnSuccess) {
      ref.current?.reset();
      // Remount the fields so uploads and local state start fresh too.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGeneration((g) => g + 1);
    }
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={cx("space-y-4", className)}>
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <Fragment key={generation}>{children}</Fragment>
      {hideSubmit ? null : (
        <SubmitButton
          variant={submitVariant}
          size={submitSize}
          pendingLabel={pendingLabel}
          className={fullWidthSubmit ? "w-full" : undefined}
        >
          {submitLabel}
        </SubmitButton>
      )}
    </form>
  );
}
