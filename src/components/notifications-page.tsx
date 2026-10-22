import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { PushToggle } from "@/components/push-toggle";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

type Notification = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  created_at: string;
  read_at: string | null;
};

async function markAllRead() {
  "use server";
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", claims.claims.sub)
    .is("read_at", null);
  revalidatePath("/", "layout");
}

/** Notification center shared by admins and drivers. */
export async function NotificationsPage() {
  const supabase = await createClient();
  const [{ data }, { data: vapid }] = await Promise.all([
    supabase.from("notifications").select("id, title, body, url, created_at, read_at").order("created_at", { ascending: false }).limit(80),
    supabase.rpc("vapid_public_key"),
  ]);
  const rows = (data as Notification[]) ?? [];
  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <>
      <PageHeader
        title="Avisos"
        subtitle={unread ? `${unread} sin leer` : "Todo leído"}
        action={
          unread ? (
            <form action={markAllRead}>
              <button className="rounded-xl px-3 py-2 text-sm font-medium text-info hover:bg-surface-2">Marcar todo como leído</button>
            </form>
          ) : null
        }
      />
      <Card className="mb-4">
        <PushToggle vapidPublicKey={(vapid as string | null) ?? null} />
      </Card>
      {rows.length ? (
        <Card className="divide-y divide-line p-0">
          {rows.map((n) => (
            <Link
              key={n.id}
              href={n.url ?? "#"}
              className={cx("flex gap-3 px-4 py-3 hover:bg-surface-2", !n.read_at && "bg-brand/10")}
            >
              <span className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-brand-strong")} />
              <div className="min-w-0">
                <p className="font-semibold">{n.title}</p>
                <p className="text-sm text-ink-2">{n.body}</p>
                <p className="mt-0.5 text-xs text-ink-3">{formatDateTime(n.created_at)}</p>
              </div>
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState title="No tienes avisos todavía." />
      )}
    </>
  );
}
