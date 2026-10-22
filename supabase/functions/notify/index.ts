// Supabase Edge Function "notify"
// - Called by pg_cron every 15 minutes ({"generate": true}) and right after new
//   notifications are inserted ({"generate": false}).
// - Delivers pending notifications by Web Push (all users) and e-mail (admins,
//   only if a Resend API key is configured).
// Authentication: header x-cron-key must match private.app_config('cron').
// The service_role key is provided automatically by Supabase to this function.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import webpush from "npm:web-push@3.6.7";

type Sub = { endpoint: string; p256dh: string; auth: string };
type Row = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  push_sent_at: string | null;
  email_sent_at: string | null;
  profile_id: string;
  profiles: { role: "admin" | "driver"; email: string | null; active: boolean };
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

async function config(key: string): Promise<string | null> {
  const { data } = await supabase.rpc("get_app_config", { p_key: key });
  return (data as string | null) ?? null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const expected = await config("cron");
  const given = req.headers.get("x-cron-key");
  if (!expected || !given || given !== expected) return new Response("Unauthorized", { status: 401 });

  let generate = false;
  try {
    generate = Boolean((await req.json())?.generate);
  } catch {
    // empty body
  }

  let created = 0;
  if (generate) {
    const { data, error } = await supabase.rpc("generate_notifications");
    if (error) console.error("generate_notifications", error.message);
    created = (data as number) ?? 0;
  }

  const [vapidPublic, vapidPrivate, vapidSubject, resendKey, emailFrom, appUrl] = await Promise.all([
    config("vapid_public"),
    config("vapid_private"),
    config("vapid_subject"),
    config("resend_api_key"),
    config("email_from"),
    config("app_url"),
  ]);
  const pushEnabled = Boolean(vapidPublic && vapidPrivate);
  if (pushEnabled) webpush.setVapidDetails(vapidSubject ?? "mailto:admin@example.com", vapidPublic!, vapidPrivate!);

  const since = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from("notifications")
    .select("id, title, body, url, push_sent_at, email_sent_at, profile_id, profiles!inner(role, email, active)")
    .gte("created_at", since)
    .or("push_sent_at.is.null,email_sent_at.is.null")
    .order("created_at")
    .limit(200);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const pending = ((rows as unknown as Row[]) ?? []).filter((r) => r.profiles.active);
  const profileIds = [...new Set(pending.filter((r) => !r.push_sent_at).map((r) => r.profile_id))];
  const subsByProfile = new Map<string, Sub[]>();
  if (profileIds.length) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("profile_id, endpoint, p256dh, auth")
      .in("profile_id", profileIds);
    for (const s of subs ?? []) {
      const list = subsByProfile.get(s.profile_id) ?? [];
      list.push(s);
      subsByProfile.set(s.profile_id, list);
    }
  }

  let pushed = 0;
  let emailed = 0;
  const dead = new Set<string>();
  const started = Date.now();

  for (const n of pending) {
    // Stay well inside the function's time limit; the rest goes in the next run.
    if (Date.now() - started > 40_000) break;
    const done: { push_sent_at?: string; email_sent_at?: string } = {};
    // Web push (marked as handled even when the user has no subscription)
    if (!n.push_sent_at) {
      const subs = subsByProfile.get(n.profile_id) ?? [];
      if (pushEnabled) {
        await Promise.all(
          subs.map(async (s) => {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                JSON.stringify({ title: n.title, body: n.body, url: n.url ?? "/", tag: n.id }),
                { TTL: 60 * 60 * 12, timeout: 5000 }, // never let one slow endpoint stall the run
              );
            } catch (e) {
              const code = (e as { statusCode?: number }).statusCode;
              if (code === 404 || code === 410) dead.add(s.endpoint);
              else console.error("push", code, (e as Error).message);
            }
          }),
        );
      }
      done.push_sent_at = new Date().toISOString();
      pushed++;
    }

    // E-mail only for admins with a real address, when Resend is configured
    if (!n.email_sent_at) {
      if (n.profiles.role === "admin" && n.profiles.email && resendKey) {
        const link = `${appUrl ?? ""}${n.url ?? "/"}`;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: emailFrom ?? "Moto Arriendo <onboarding@resend.dev>",
            to: [n.profiles.email],
            subject: n.title,
            html: `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#16181b">
              <p style="font-size:18px;font-weight:700;margin:0 0 8px">${escapeHtml(n.title)}</p>
              <p style="margin:0 0 16px">${escapeHtml(n.body)}</p>
              <a href="${link}" style="background:#ffc21a;color:#16181b;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">Abrir Moto Arriendo</a>
            </div>`,
          }),
          signal: AbortSignal.timeout(8000),
        }).catch((e) => {
          console.error("email", (e as Error).message);
          return null;
        });
        if (res?.ok) {
          done.email_sent_at = new Date().toISOString();
          emailed++;
        } else if (res) console.error("email", res.status, await res.text());
      } else {
        done.email_sent_at = new Date().toISOString(); // nothing to send for this channel
      }
    }

    // Mark each notification as soon as it is handled, so a later failure or
    // timeout never makes us send it twice.
    if (done.push_sent_at || done.email_sent_at) {
      await supabase.from("notifications").update(done).eq("id", n.id);
    }
  }

  if (dead.size) await supabase.from("push_subscriptions").delete().in("endpoint", [...dead]);

  return new Response(
    JSON.stringify({ created, pushed, emailed, removed_subscriptions: dead.size }),
    { headers: { "Content-Type": "application/json" } },
  );
});
