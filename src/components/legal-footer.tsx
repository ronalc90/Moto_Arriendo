import Link from "next/link";
import { cx } from "@/components/ui";

/** Links to the public legal pages. */
export function LegalFooter({ className, dark = false }: { className?: string; dark?: boolean }) {
  const link = dark ? "text-[#c3c6cc] hover:text-white" : "text-ink-3 hover:text-ink";
  return (
    <nav className={cx("flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs", className)} aria-label="Información legal">
      <Link href="/acerca" className={link}>
        Quiénes somos
      </Link>
      <Link href="/privacidad" className={link}>
        Tratamiento de datos
      </Link>
      <Link href="/cookies" className={link}>
        Cookies
      </Link>
      <Link href="/terminos" className={link}>
        Términos de uso
      </Link>
    </nav>
  );
}
