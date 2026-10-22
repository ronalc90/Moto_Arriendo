"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

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

  // Rendered inline (not floating) so it never covers the login button on small phones.
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-line bg-surface p-3" role="note" aria-label="Aviso de cookies">
      <Cookie className="mt-0.5 size-5 shrink-0 text-brand-strong" />
      <p className="flex-1 text-[13px] leading-snug text-ink-2">
        Solo usamos cookies necesarias para mantener tu sesión iniciada; nada de publicidad ni seguimiento.{" "}
        <Link href="/cookies" className="font-semibold text-info">
          Más información
        </Link>
      </p>
      <button type="button" onClick={close} className="rounded-lg px-2 py-1 text-[13px] font-semibold text-ink-2 hover:bg-surface-2" aria-label="Cerrar aviso de cookies">
        Entendido
      </button>
    </div>
  );
}
