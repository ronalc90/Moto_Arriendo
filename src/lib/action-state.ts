export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Monotonic value so effects can react to repeated successes. */
  at?: number;
};

export function fail(error: string): ActionState {
  return { ok: false, error, at: Date.now() };
}

export function done(message?: string): ActionState {
  return { ok: true, message, at: Date.now() };
}

/** Turns a Postgres / Supabase error into a friendly Spanish message. */
export function dbError(error: { message?: string; code?: string } | null | undefined, fallback = "No se pudo guardar. Intenta de nuevo."): string {
  if (!error) return fallback;
  const msg = error.message ?? "";
  if (error.code === "23505") {
    if (msg.includes("plate")) return "Ya existe una moto con esa placa.";
    if (msg.includes("national_id")) return "Ya existe un conductor con esa cédula.";
    if (msg.includes("one_active_per_driver")) return "Ese conductor ya tiene un contrato vigente.";
    if (msg.includes("one_active_per_motorcycle")) return "Esa moto ya tiene un contrato vigente.";
    if (msg.includes("exempt_days")) return "Ese día ya está marcado como exento.";
    return "Ese registro ya existe.";
  }
  if (error.code === "42501" || /row-level security/i.test(msg)) return "No tienes permiso para hacer esto.";
  if (error.code === "23514") return "Algún dato no es válido. Revisa los valores.";
  if (error.code === "P0001" && msg) return msg; // our own RAISE EXCEPTION messages are already in Spanish
  return fallback;
}
