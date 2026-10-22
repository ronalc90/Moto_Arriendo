import { Construction } from "lucide-react";
import { ButtonLink, Card } from "@/components/ui";

/** Temporary placeholder for sections delivered in Phase 1. */
export default function ComingSoon() {
  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      <Construction className="mx-auto size-10 text-brand-strong" />
      <h1 className="mt-3 text-lg font-semibold">Esta sección llega pronto</h1>
      <ButtonLink href="/conductor" variant="secondary" className="mt-4">
        Volver al inicio
      </ButtonLink>
    </Card>
  );
}
