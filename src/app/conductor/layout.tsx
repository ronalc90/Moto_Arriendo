import { AppShell, type NavItem } from "@/components/app-shell";
import { requireDriver } from "@/lib/auth";

export default async function DriverLayout({ children }: LayoutProps<"/conductor">) {
  const profile = await requireDriver();

  const primary: NavItem[] = [
    { href: "/conductor", label: "Inicio", icon: "home" },
    { href: "/conductor/pagar", label: "Pagar", icon: "receipt" },
    { href: "/conductor/calendario", label: "Calendario", icon: "calendar" },
    { href: "/conductor/inspeccion", label: "Inspección", icon: "check" },
  ];
  const secondary: NavItem[] = [
    { href: "/conductor/dano", label: "Reportar daño", icon: "damage" },
    { href: "/conductor/documentos", label: "Mis documentos", icon: "file" },
  ];

  return (
    <AppShell
      primary={primary}
      secondary={secondary}
      rootHref="/conductor"
      userName={profile.full_name}
      roleLabel="Conductor"
    >
      <div className="mx-auto max-w-xl">{children}</div>
    </AppShell>
  );
}
