"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/** Friendly error screen for any page (in Spanish). */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <AlertTriangle className="size-12 text-warn" />
      <h1 className="mt-4 text-xl font-bold">Algo salió mal</h1>
      <p className="mt-2 text-ink-2">
        No pudimos cargar esta pantalla. Revisa tu conexión a internet e intenta de nuevo.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => retry()}
          className="inline-flex h-12 items-center gap-2 rounded-2xl bg-brand px-5 font-semibold text-brand-ink"
        >
          <RotateCw className="size-5" /> Reintentar
        </button>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="inline-flex h-12 items-center rounded-2xl border border-line bg-surface px-5 font-medium">
          Ir al inicio
        </a>
      </div>
    </main>
  );
}
