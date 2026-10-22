"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

const KEY = "ma-cookie-notice-v1";

/**
 * Informative notice: the app only uses strictly necessary cookies (session),
 * so no consent choices are needed — just transparency.
 */
export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(localStorage.getItem(KEY) !== "ok");
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  function close() {
    try {
      localStorage.setItem(KEY, "ok");
    } catch {
      // private mode: just hide it for now
    }
    setShow(false);
  }

  return (
    <div className="safe-bottom fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg rounded-2xl border border-line bg-surface p-4 shadow-xl" role="dialog" aria-label="Aviso de cookies">
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 size-5 shrink-0 text-brand-strong" />
        <p className="flex-1 text-sm text-ink-2">
          Solo usamos cookies necesarias para mantener tu sesión iniciada. No usamos cookies de publicidad ni de
          seguimiento.{" "}
          <Link href="/cookies" className="font-semibold text-info">
            Más información
          </Link>
        </p>
        <button onClick={close} className="rounded-lg p-1 text-ink-3 hover:bg-surface-2" aria-label="Cerrar aviso">
          <X className="size-5" />
        </button>
      </div>
      <button onClick={close} className="mt-3 h-10 w-full rounded-xl bg-brand text-sm font-semibold text-brand-ink">
        Entendido
      </button>
    </div>
  );
}
