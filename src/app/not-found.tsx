import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <SearchX className="size-12 text-ink-3" />
      <h1 className="mt-4 text-xl font-bold">No encontramos esta página</h1>
      <p className="mt-2 text-ink-2">Puede que el enlace esté mal escrito o que el registro ya no exista.</p>
      <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-2xl bg-brand px-5 font-semibold text-brand-ink">
        Ir al inicio
      </Link>
    </main>
  );
}
