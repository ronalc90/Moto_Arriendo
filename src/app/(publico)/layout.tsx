import Image from "next/image";
import Link from "next/link";
import { LegalFooter } from "@/components/legal-footer";
import { OWNER } from "@/lib/legal";

/** Public pages (legal / about) — readable without signing in. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <Image src="/icons/icon-192.png" alt="" width={30} height={30} className="rounded-lg" />
            {OWNER.business}
          </Link>
          <Link href="/login" className="rounded-xl bg-brand px-3 py-1.5 text-sm font-semibold text-brand-ink">
            Entrar
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <article className="legal space-y-4 text-[15px] leading-relaxed text-ink-2">{children}</article>
      </main>
      <footer className="border-t border-line py-6">
        <LegalFooter />
        <p className="mt-2 text-center text-xs text-ink-3">
          © {new Date().getFullYear()} {OWNER.business} · {OWNER.name} · {OWNER.city}
        </p>
      </footer>
    </div>
  );
}
