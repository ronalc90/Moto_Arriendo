import { AppShell, type NavItem } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const [{ count: pendingPayments }, { count: unread }] = await Promise.all([
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  const primary: NavItem[] = [
    { href: "/admin", label: "Hoy", icon: "home" },
    { href: "/admin/pagos", label: "Pagos", icon: "receipt", badge: pendingPayments ?? 0 },
    { href: "/admin/motos", label: "Motos", icon: "bike" },
    { href: "/admin/conductores", label: "Conductores", icon: "users" },
  ];
  const secondary: NavItem[] = [
    { href: "/admin/contratos", label: "Contratos", icon: "file" },
    { href: "/admin/prestamos", label: "Préstamos", icon: "loan" },
    { href: "/admin/dias-exentos", label: "Días exentos", icon: "calendarOff" },
    { href: "/admin/inspecciones", label: "Inspecciones", icon: "check" },
    { href: "/admin/danos", label: "Daños", icon: "damage" },
    { href: "/admin/incidentes", label: "Incidentes", icon: "siren" },
    { href: "/admin/gastos", label: "Gastos", icon: "wallet" },
    { href: "/admin/reportes", label: "Reportes", icon: "chart" },
    { href: "/admin/configuracion", label: "Configuración", icon: "settings" },
  ];

  return (
    <AppShell
      primary={primary}
      secondary={secondary}
      rootHref="/admin"
      userName={profile.full_name}
      roleLabel="Administrador"
      unread={unread ?? 0}
    >
      {children}
    </AppShell>
  );
}
