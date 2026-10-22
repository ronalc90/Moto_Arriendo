"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Bell,
  BarChart3,
  Bike,
  Siren,
  Wallet,
  CalendarDays,
  CalendarOff,
  ClipboardCheck,
  FileText,
  HandCoins,
  Home,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShieldAlert,
  UserRound,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { cx } from "@/components/ui";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number };

const ICONS = {
  home: Home,
  receipt: ReceiptText,
  bike: Bike,
  users: Users,
  file: FileText,
  loan: HandCoins,
  calendarOff: CalendarOff,
  calendar: CalendarDays,
  check: ClipboardCheck,
  damage: ShieldAlert,
  wrench: Wrench,
  settings: Settings,
  user: UserRound,
  bell: Bell,
  chart: BarChart3,
  siren: Siren,
  wallet: Wallet,
} satisfies Record<string, LucideIcon>;
export type IconName = keyof typeof ICONS;

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Responsive shell: sidebar on desktop, bottom tab bar on phones.
 * `primary` items go to the bottom bar (max 4); the rest live under "Más".
 */
export function AppShell({
  children,
  primary,
  secondary = [],
  rootHref,
  userName,
  roleLabel,
  unread = 0,
}: {
  children: ReactNode;
  primary: NavItem[];
  secondary?: NavItem[];
  rootHref: string;
  userName: string;
  roleLabel: string;
  unread?: number;
}) {
  const notificationsHref = `${rootHref}/avisos`;
  const bell = (
    <Link
      href={notificationsHref}
      className="relative rounded-xl p-2 text-ink-2 hover:bg-surface-2"
      aria-label={unread ? `Avisos (${unread} sin leer)` : "Avisos"}
    >
      <Bell className="size-5" />
      {unread ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-bad px-1 text-center text-[11px] font-bold leading-5 text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const all = [...primary, ...secondary];

  const link = (item: NavItem, onClick?: () => void) => {
    const Icon = ICONS[item.icon];
    const active = isActive(pathname, item.href, item.href === rootHref);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClick}
        className={cx(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
          active ? "bg-brand text-brand-ink" : "text-[#c3c6cc] hover:bg-white/5 hover:text-white",
        )}
      >
        <Icon className="size-5 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.badge ? (
          <span className="rounded-full bg-bad px-2 py-0.5 text-xs font-bold text-white">{item.badge}</span>
        ) : null}
      </Link>
    );
  };

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-asphalt p-4 md:flex">
        <Link href={rootHref} className="mb-6 flex items-center gap-3 px-2">
          <Image src="/icons/icon-192.png" alt="" width={36} height={36} className="rounded-xl" />
          <span className="text-lg font-bold text-[#f5f4ef]">Moto Arriendo</span>
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {all.map((i) => link(i))}
          {link({ href: notificationsHref, label: "Avisos", icon: "bell", badge: unread })}
        </nav>
        <div className="mt-4 border-t border-white/10 pt-4">
          <Link href="/cuenta" className="block px-3 text-sm text-[#c3c6cc] hover:text-white">
            <span className="block font-semibold text-[#f5f4ef]">{userName}</span>
            {roleLabel} · Mi cuenta
          </Link>
          <form action="/salir" method="post" className="mt-3">
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#c3c6cc] hover:bg-white/5 hover:text-white">
              <LogOut className="size-4" /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur md:hidden">
          <Link href={rootHref} className="flex items-center gap-2">
            <Image src="/icons/icon-192.png" alt="" width={30} height={30} className="rounded-lg" />
            <span className="font-bold">Moto Arriendo</span>
          </Link>
          <div className="flex items-center gap-1">
            {bell}
            <Link href="/cuenta" className="max-w-36 truncate rounded-xl px-2 py-2 text-sm text-ink-2" aria-label="Mi cuenta">
              {userName.split(" ")[0]}
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 sm:px-6 md:pb-10 md:pt-8">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden">
          <div className="mx-auto flex max-w-lg">
            {primary.slice(0, 4).map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item.href, item.href === rootHref);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium",
                    active ? "text-ink" : "text-ink-3",
                  )}
                >
                  <span className={cx("rounded-full px-4 py-1", active && "bg-brand text-brand-ink")}>
                    <Icon className="size-5" />
                  </span>
                  {item.label}
                  {item.badge ? (
                    <span className="absolute top-1 right-[22%] rounded-full bg-bad px-1.5 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium text-ink-3"
            >
              <span className="rounded-full px-4 py-1">
                <Menu className="size-5" />
              </span>
              Más
            </button>
          </div>
        </nav>

        {/* Mobile "Más" sheet */}
        {open ? (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
            <button className="absolute inset-0 bg-black/50" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
            <div className="safe-bottom absolute inset-x-0 bottom-0 rounded-t-3xl bg-asphalt p-4">
              <div className="mb-3 flex items-center justify-between px-2">
                <span className="font-semibold text-[#f5f4ef]">Menú</span>
                <button onClick={() => setOpen(false)} className="p-2 text-[#c3c6cc]" aria-label="Cerrar">
                  <X className="size-5" />
                </button>
              </div>
              <nav className="grid gap-1">
                {[...secondary, { href: "/cuenta", label: "Mi cuenta", icon: "user" as const }].map((i) =>
                  link(i, () => setOpen(false)),
                )}
              </nav>
              <form action="/salir" method="post" className="mt-2 border-t border-white/10 pt-2">
                <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-[#c3c6cc]">
                  <LogOut className="size-5" /> Cerrar sesión
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
