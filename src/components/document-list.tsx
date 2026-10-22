import { ExternalLink, FileText } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui";
import { DOC_TYPE_LABEL } from "@/lib/constants";
import { bogotaToday, formatDate } from "@/lib/format";
import type { DocumentRow } from "@/lib/types";

function daysBetween(from: string, to: string) {
  const [a, b] = [from, to].map((d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)));
  return Math.round((b - a) / 86400000);
}

export function ExpiryBadge({ expiresOn }: { expiresOn: string | null }) {
  if (!expiresOn) return null;
  const left = daysBetween(bogotaToday(), expiresOn);
  if (left < 0) return <Badge tone="bad">Vencido</Badge>;
  if (left <= 7) return <Badge tone="bad">Vence en {left} d</Badge>;
  if (left <= 30) return <Badge tone="warn">Vence en {left} d</Badge>;
  return <Badge tone="ok">Vigente</Badge>;
}

/** List of documents with links (short-lived signed URLs) to open them. */
export function DocumentList({
  docs,
  urls,
  empty = "No hay documentos.",
  actions,
}: {
  docs: DocumentRow[];
  urls: Map<string, string>;
  empty?: string;
  actions?: (doc: DocumentRow) => React.ReactNode;
}) {
  if (!docs.length) return <EmptyState title={empty} />;
  return (
    <Card className="divide-y divide-line p-0">
      {docs.map((d) => {
        const url = d.file_path ? urls.get(d.file_path) : null;
        return (
          <div key={d.id} className="flex items-center gap-3 px-4 py-3">
            <FileText className="size-5 shrink-0 text-ink-3" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}</p>
              <p className="text-xs text-ink-2">
                {d.starts_on ? `Desde ${formatDate(d.starts_on)} · ` : ""}
                {d.expires_on ? `Vence ${formatDate(d.expires_on)}` : "Sin vencimiento"}
                {d.notes ? ` · ${d.notes}` : ""}
              </p>
            </div>
            <ExpiryBadge expiresOn={d.expires_on} />
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-2 text-ink-2 hover:bg-surface-2"
                aria-label="Abrir documento"
              >
                <ExternalLink className="size-5" />
              </a>
            ) : null}
            {actions?.(d)}
          </div>
        );
      })}
    </Card>
  );
}
