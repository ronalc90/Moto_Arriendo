"use client";

import { useEffect } from "react";

/** Registers /sw.js so the app can be installed on the home screen. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Installing is optional; the app keeps working without it.
    });
  }, []);
  return null;
}
