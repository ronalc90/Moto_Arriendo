import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión" };

/** Shown by the service worker when there is no internet connection. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-asphalt px-6 text-center">
      <p className="text-5xl" aria-hidden>
        📶
      </p>
      <h1 className="mt-4 text-2xl font-bold text-[#f5f4ef]">Sin conexión</h1>
      <p className="mt-2 max-w-xs text-[#c3c6cc]">
        Revisa tus datos o el wifi y vuelve a intentar. Tus pagos no se pierden: súbelos cuando tengas señal.
      </p>
      <a href="/" className="mt-6 rounded-2xl bg-brand px-6 py-3 font-semibold text-brand-ink">
        Reintentar
      </a>
    </main>
  );
}
