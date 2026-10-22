"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { submitInspection } from "./actions";
import { FileUpload } from "@/components/file-upload";
import { SubmitButton } from "@/components/action-form";
import { Alert, Button, Field, Input, Textarea, buttonClass, cx } from "@/components/ui";
import { CHECKLIST_ITEMS } from "@/lib/constants";
import type { ActionState } from "@/lib/action-state";

const PHOTO_STEPS = [
  { key: "photo_front", title: "Foto de frente", tip: "Párate frente a la moto. Que se vean la luz y la llanta delantera." },
  { key: "photo_back", title: "Foto de atrás", tip: "Que se vean la placa, la stop y la llanta trasera." },
  { key: "photo_left", title: "Lado izquierdo", tip: "Toma la moto completa desde el lado izquierdo." },
  { key: "photo_right", title: "Lado derecho", tip: "Toma la moto completa desde el lado derecho." },
  { key: "photo_dashboard", title: "Tablero", tip: "Acércate para que se lea bien el kilometraje." },
] as const;

export function InspectionWizard({ driverId, lastKm }: { driverId: string; lastKm: number }) {
  const [state, action] = useActionState<ActionState, FormData>(submitInspection, {});
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const [checks, setChecks] = useState<Record<string, "ok" | "check">>({});
  const total = PHOTO_STEPS.length + 1;

  if (state.ok) {
    return (
      <div className="rounded-3xl border border-ok/30 bg-ok-soft/50 p-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-ok" />
        <p className="mt-3 text-xl font-bold">¡Inspección enviada!</p>
        <p className="mt-1 text-ink-2">Gracias. Nos vemos la próxima semana.</p>
        <Link href="/conductor" className={buttonClass("primary", "lg", "mt-6 w-full")}>
          Volver al inicio
        </Link>
      </div>
    );
  }

  const isPhotoStep = step < PHOTO_STEPS.length;
  const current = PHOTO_STEPS[step];
  const allChecks = CHECKLIST_ITEMS.every((c) => checks[c.key]);

  return (
    <form action={action} className="space-y-5">
      {/* Progress */}
      <div>
        <div className="flex gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={cx("h-1.5 flex-1 rounded-full", i <= step ? "bg-brand-strong" : "bg-surface-2")} />
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-2">
          Paso {step + 1} de {total}
        </p>
      </div>

      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}

      {/* All photo inputs stay mounted so their values are submitted. */}
      {PHOTO_STEPS.map((p, i) => (
        <div key={p.key} className={i === step ? "space-y-3" : "hidden"}>
          <h2 className="text-xl font-bold">{p.title}</h2>
          <p className="text-ink-2">{p.tip}</p>
          <FileUpload
            name={p.key}
            bucket="inspections"
            folder={driverId}
            kind="image"
            capture
            big
            label="Tomar foto"
            onChange={(path) => setPhotos((s) => ({ ...s, [p.key]: path }))}
          />
        </div>
      ))}

      <div className={isPhotoStep ? "hidden" : "space-y-5"}>
        <h2 className="text-xl font-bold">Kilometraje y revisión</h2>
        <Field label="Kilometraje del tablero" htmlFor="km" hint={`Último registrado: ${lastKm.toLocaleString("es-CO")} km`}>
          <Input id="km" name="km" inputMode="numeric" placeholder="Ej: 1250" className="h-14 text-2xl font-bold" />
        </Field>
        <div className="space-y-2">
          <p className="text-sm font-medium">¿Cómo está cada parte?</p>
          {CHECKLIST_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5">
              <span className="font-medium">{item.label}</span>
              <div className="flex gap-2">
                {(["ok", "check"] as const).map((v) => (
                  <label
                    key={v}
                    className={cx(
                      "flex h-11 cursor-pointer items-center rounded-xl border px-4 text-sm font-semibold",
                      checks[item.key] === v
                        ? v === "ok"
                          ? "border-ok bg-ok text-white"
                          : "border-warn bg-warn-soft text-warn"
                        : "border-line text-ink-2",
                    )}
                  >
                    <input
                      type="radio"
                      name={item.key}
                      value={v}
                      className="sr-only"
                      checked={checks[item.key] === v}
                      onChange={() => setChecks((s) => ({ ...s, [item.key]: v }))}
                    />
                    {v === "ok" ? "Bien" : "Revisar"}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Field label="Observaciones (opcional)" htmlFor="notes">
          <Textarea id="notes" name="notes" placeholder="Ej: la llanta trasera está baja" />
        </Field>
      </div>

      <div className="flex gap-3">
        {step > 0 ? (
          <Button type="button" variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="size-5" />
          </Button>
        ) : null}
        {isPhotoStep ? (
          <Button
            type="button"
            size="lg"
            className="flex-1"
            disabled={!photos[current.key]}
            onClick={() => setStep((s) => s + 1)}
          >
            Siguiente <ArrowRight className="size-5" />
          </Button>
        ) : (
          <SubmitButton className="flex-1" pendingLabel="Enviando…" disabled={!allChecks}>
            Enviar inspección
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
