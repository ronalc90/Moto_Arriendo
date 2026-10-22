"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button } from "@/components/ui";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "unsupported" | "ios-install" | "denied" | "off" | "on" | "loading";

/** Lets the user turn on push notifications on this device. */
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setError(null);
    if (!vapidPublicKey) {
      setError("Las notificaciones aún no están configuradas en el servidor.");
      return;
    }
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { error: rpcError } = await createClient().rpc("save_push_subscription", {
        p_endpoint: json.endpoint,
        p_p256dh: json.keys.p256dh,
        p_auth: json.keys.auth,
        p_user_agent: navigator.userAgent,
      });
      if (rpcError) throw rpcError;
      setState("on");
    } catch {
      setError("No se pudieron activar las notificaciones en este dispositivo.");
      setState("off");
    }
  }

  async function disable() {
    setState("loading");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  }

  if (state === "loading") return <p className="text-sm text-ink-3">Revisando notificaciones…</p>;
  if (state === "unsupported")
    return <p className="text-sm text-ink-2">Este navegador no permite notificaciones. Prueba con Chrome en Android.</p>;
  if (state === "ios-install")
    return (
      <Alert tone="info">
        En iPhone: primero instala la app (Compartir → Agregar a inicio), ábrela desde el ícono y vuelve aquí para activar
        las notificaciones.
      </Alert>
    );
  if (state === "denied")
    return (
      <Alert tone="warn">
        Bloqueaste las notificaciones. Actívalas en los ajustes del navegador para este sitio y recarga la página.
      </Alert>
    );

  return (
    <div className="space-y-2">
      {state === "on" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-ok">
            <Bell className="size-4" /> Notificaciones activas en este dispositivo
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={disable}>
            <BellOff className="size-4" /> Desactivar
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={enable} size="md">
          <Bell className="size-4" /> Activar notificaciones en este celular
        </Button>
      )}
      {error ? <p className="text-sm text-bad">{error}</p> : null}
    </div>
  );
}
