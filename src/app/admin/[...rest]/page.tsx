import { Construction } from "lucide-react";
import { ButtonLink, Card } from "@/components/ui";

/** Temporary placeholder for sections delivered in Phase 1. */
export default function ComingSoon() {
  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      <Construction className="mx-auto size-10 text-brand-strong" />
      <h1 className="mt-3 text-lg font-semibold">Esta sección llega en la Fase 1</h1>
      <p className="mt-1 text-sm text-ink-2">Ya está la base lista; la construimos en el siguiente paso.</p>
      <ButtonLink href="/admin" variant="secondary" className="mt-4">
        Volver a Hoy
      </ButtonLink>
    </Card>
  );
}
